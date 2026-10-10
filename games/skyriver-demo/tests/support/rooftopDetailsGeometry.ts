import type { SkyriverMass, SkyriverCityTrims } from '../../src/render/city';
import { placeTrim, warpRigid } from '../../src/render/city';
import { CANYON_LOOP_LENGTH_M } from '../../src/render/canyonWarp';
import { autopilotTrackPose, type TrackPose } from '../../src/render/flightPresentation';
import { createCameraPoseScratch, writeCameraPose } from '../../src/render/cameraRig';
import { CLEARANCE_CAMERA_RADIUS_M, CLEARANCE_SHUTTLE_RADIUS_M } from '../../src/render/clearance';

export interface RoofBox {
  readonly x: number; readonly y: number; readonly z: number;
  readonly hx: number; readonly hy: number; readonly hz: number;
  readonly c: number; readonly s: number;
}

export function massRoofBox(mass: SkyriverMass): RoofBox {
  const p = warpRigid(mass.x, mass.z, mass.anchorV ?? mass.z, { x: 0, z: 0, heading: 0 });
  return { x: p.x, y: mass.y0 + mass.height / 2, z: p.z, hx: mass.width / 2, hy: mass.height / 2, hz: mass.depth / 2, c: Math.cos(p.heading), s: Math.sin(p.heading) };
}

export function trimRoofBox(trims: SkyriverCityTrims, index: number): RoofBox {
  const p = placeTrim(trims, index, { x: 0, z: 0, heading: 0, length: 0 });
  const xSize = p.length > 0 && trims.sx[index]! > trims.sz[index]! ? p.length : trims.sx[index]!;
  const zSize = p.length > 0 && trims.sz[index]! >= trims.sx[index]! ? p.length : trims.sz[index]!;
  return { x: p.x, y: trims.cy[index]!, z: p.z, hx: xSize / 2, hy: trims.sy[index]! / 2, hz: zSize / 2, c: Math.cos(p.heading), s: Math.sin(p.heading) };
}

/** One Float32 ULP at the actual coordinate magnitude. */
export function roofFloatUlp(value: number): number {
  const f = new Float32Array([Math.abs(value)]), bits = new Uint32Array(f.buffer);
  const old = f[0]!; bits[0] = bits[0]! + 1;
  return f[0]! - old;
}

export function roofBoxTolerance(box: RoofBox): number {
  return 2 * Math.max(...[box.x, box.y, box.z, box.hx, box.hy, box.hz].map(roofFloatUlp));
}

export function roofCorners(box: RoofBox): readonly (readonly [number, number, number])[] {
  return [-1, 1].flatMap(u => [-1, 1].map(v => [box.x + u * box.hx * box.c + v * box.hz * box.s, box.y - box.hy, box.z - u * box.hx * box.s + v * box.hz * box.c] as const));
}

/** All four real bottom corners, not the prop centre. */
export function roofSupportFailures(prop: RoofBox, support: RoofBox, insetM = 2): readonly string[] {
  const tolerance = Math.max(roofBoxTolerance(prop), roofBoxTolerance(support));
  const errors: string[] = [];
  for (const [i, corner] of roofCorners(prop).entries()) {
    const [x, y, z] = corner, dx = x - support.x, dz = z - support.z;
    if (Math.abs(y - (support.y + support.hy)) > tolerance) errors.push(`corner${i}:contact`);
    if (Math.abs(dx * support.c - dz * support.s) > support.hx - insetM + tolerance) errors.push(`corner${i}:x-inset`);
    if (Math.abs(dx * support.s + dz * support.c) > support.hz - insetM + tolerance) errors.push(`corner${i}:z-inset`);
  }
  return errors;
}

/** Full-volume OBB intersection. All boxes use the real upright rigid frame. */
export function roofBoxesConflict(a: RoofBox, b: RoofBox): boolean {
  const vertical = Math.min(a.y + a.hy, b.y + b.hy) - Math.max(a.y - a.hy, b.y - b.hy);
  if (vertical <= 0) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  if (Math.abs(dx) > Math.abs(a.c) * a.hx + Math.abs(a.s) * a.hz + Math.abs(b.c) * b.hx + Math.abs(b.s) * b.hz) return false;
  if (Math.abs(dz) > Math.abs(a.s) * a.hx + Math.abs(a.c) * a.hz + Math.abs(b.s) * b.hx + Math.abs(b.c) * b.hz) return false;
  const epsilon = Math.max(roofBoxTolerance(a), roofBoxTolerance(b));
  if (vertical <= epsilon) return false;
  for (const [x, z] of [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]]) {
    const ra = a.hx * Math.abs(a.c * x - a.s * z) + a.hz * Math.abs(a.s * x + a.c * z);
    const rb = b.hx * Math.abs(b.c * x - b.s * z) + b.hz * Math.abs(b.s * x + b.c * z);
    if (ra + rb - Math.abs(dx * x + dz * z) <= epsilon) return false;
  }
  return true;
}

export function roofBoxDistance(box: RoofBox, x: number, y: number, z: number): number {
  const dx = x - box.x, dz = z - box.z;
  const a = Math.abs(dx * box.c - dz * box.s) - box.hx;
  const b = Math.abs(y - box.y) - box.hy;
  const c = Math.abs(dx * box.s + dz * box.c) - box.hz;
  const out = Math.hypot(Math.max(0, a), Math.max(0, b), Math.max(0, c));
  return out > 0 ? out : Math.max(a, b, c);
}

/** Extent-expanded broad phase. A sphere cannot leave its tested cell range. */
export function roofRouteClearance(boxes: readonly RoofBox[]): { samples: number; violations: number; minHull: number; minCamera: number } {
  const grid = new Map<string, RoofBox[]>(), cell = 200;
  for (const box of boxes) {
    const reach = Math.hypot(box.hx, box.hz) + Math.max(CLEARANCE_CAMERA_RADIUS_M, CLEARANCE_SHUTTLE_RADIUS_M);
    for (let x = Math.floor((box.x - reach) / cell); x <= Math.floor((box.x + reach) / cell); x++) for (let z = Math.floor((box.z - reach) / cell); z <= Math.floor((box.z + reach) / cell); z++) {
      const key = `${x}:${z}`, list = grid.get(key) ?? []; list.push(box); grid.set(key, list);
    }
  }
  const gap = (x: number, y: number, z: number, radius: number) => {
    let result = Infinity;
    for (const box of grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? []) result = Math.min(result, roofBoxDistance(box, x, y, z) - radius);
    return result;
  };
  const pose: TrackPose = { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  const camera = createCameraPoseScratch();
  let samples = 0, violations = 0, minHull = Infinity, minCamera = Infinity;
  for (let u = 0; u < CANYON_LOOP_LENGTH_M; u += 2) {
    autopilotTrackPose(u, pose); samples++;
    const hull = gap(pose.x, pose.y, pose.z, CLEARANCE_SHUTTLE_RADIUS_M); minHull = Math.min(minHull, hull); if (hull < 0) violations++;
    for (const [speed, boostT] of [[40, 0], [260, 0], [260, 1]] as const) {
      writeCameraPose(camera, { ...pose, speed, mode: 0, autopilotT: 0, boostT }, { orbitYaw: 0, orbitPitch: 0 });
      const d = gap(camera.position.x, camera.position.y, camera.position.z, CLEARANCE_CAMERA_RADIUS_M); minCamera = Math.min(minCamera, d); if (d < 0) violations++;
    }
  }
  return { samples, violations, minHull, minCamera };
}

/** Actual unit-box instance matrix, with no source placement helper in this path. */
export function uploadedRoofBox(elements: ArrayLike<number>, offset: number): RoofBox {
  const sx = Math.hypot(elements[offset]!, elements[offset + 1]!, elements[offset + 2]!);
  const sy = Math.hypot(elements[offset + 4]!, elements[offset + 5]!, elements[offset + 6]!);
  const sz = Math.hypot(elements[offset + 8]!, elements[offset + 9]!, elements[offset + 10]!);
  return { x: elements[offset + 12]!, y: elements[offset + 13]!, z: elements[offset + 14]!, hx: sx / 2, hy: sy / 2, hz: sz / 2, c: elements[offset]! / sx, s: -elements[offset + 2]! / sx };
}
