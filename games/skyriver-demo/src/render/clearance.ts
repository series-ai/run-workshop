/**
 * @file clearance.ts — R17 loop-wide route clearance: the autopilot camera and shuttle must stay
 * outside every drawn concrete mass, all the way around the loop.
 *
 * Cycle-7 review found the chase camera clipping into walls at 42.0 s and 45.9 s of the lap (4-6
 * frames of room interiors filling the screen): the route itself ran into the city there. This pass
 * sweeps the exact poses the game draws (flightPresentation.autopilotTrackPose + cameraRig
 * writeCameraPose, at the slowest, cruise and boost camera distances) against every mass as it is
 * placed (city.ts warpRigid boxes, turned to their heading), and reports the smallest gap. Pure and
 * GL-free; tests/clearance.test.ts holds it at zero violations.
 */
import type { SkyriverCityLayout } from '../sim/derive';
import { CANYON_LOOP_LENGTH_M, type WarpOut } from './canyonWarp';
import { writeCameraPose, createCameraPoseScratch } from './cameraRig';
import { deriveCityMasses, warpRigid, type SkyriverMass } from './city';
import { autopilotTrackPose, type TrackPose } from './flightPresentation';

/** Camera sphere: the near plane and its corners, plus margin, metres. */
export const CLEARANCE_CAMERA_RADIUS_M = 8;
/** Shuttle sphere: the hull's half length plus margin, metres. */
export const CLEARANCE_SHUTTLE_RADIUS_M = 14;

export interface ClearanceHit {
  readonly what: 'camera' | 'shuttle';
  /** Track arc length (0 = lap start) and canyon v of the sample. */
  readonly u: number;
  readonly v: number;
  readonly mass: number;
  /** Sphere gap to the mass, metres (negative: inside it). */
  readonly gapM: number;
  readonly speed: number;
}

export interface ClearanceAudit {
  readonly samples: number;
  readonly masses: number;
  readonly violations: number;
  readonly minCameraGapM: number;
  readonly minShuttleGapM: number;
  /** Worst violations, one per (what, ~20 m stretch), worst first. */
  readonly worst: readonly ClearanceHit[];
}

interface PlacedBox {
  cx: number;
  cz: number;
  y0: number;
  y1: number;
  c: number;
  s: number;
  hx: number;
  hz: number;
  reach: number;
}

const boxWarp: WarpOut = { x: 0, z: 0, heading: 0 };

function place(mass: SkyriverMass): PlacedBox {
  warpRigid(mass.x, mass.z, mass.anchorV ?? mass.z, boxWarp);
  return {
    cx: boxWarp.x,
    cz: boxWarp.z,
    y0: mass.y0,
    y1: mass.y0 + mass.height,
    c: Math.cos(boxWarp.heading),
    s: Math.sin(boxWarp.heading),
    hx: mass.width * 0.5,
    hz: mass.depth * 0.5,
    reach: Math.hypot(mass.width, mass.depth) * 0.5,
  };
}

/** Signed distance from a point to a placed box (negative inside). */
function boxDistance(b: PlacedBox, x: number, y: number, z: number): number {
  const dx = x - b.cx;
  const dz = z - b.cz;
  // Box local axes: across = (cos h, -sin h), along = (sin h, cos h).
  const lx = Math.abs(dx * b.c - dz * b.s) - b.hx;
  const lz = Math.abs(dx * b.s + dz * b.c) - b.hz;
  const ly = Math.max(b.y0 - y, y - b.y1);
  const outside = Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0));
  return outside > 0 ? outside : Math.max(lx, ly, lz);
}

/**
 * R18: the drawn masses as a queryable field: `gap(x, y, z)` is the signed distance from a world
 * point to the nearest mass (negative inside one). Used by the impostor-traffic clearance test.
 */
export function createMassField(layout: SkyriverCityLayout): { gap(x: number, y: number, z: number): number } {
  const boxes = deriveCityMasses(layout).map(place);
  const cell = 400;
  const grid = new Map<string, number[]>();
  boxes.forEach((b, i) => {
    for (let gx = Math.floor((b.cx - b.reach) / cell); gx <= Math.floor((b.cx + b.reach) / cell); gx += 1) {
      for (let gz = Math.floor((b.cz - b.reach) / cell); gz <= Math.floor((b.cz + b.reach) / cell); gz += 1) {
        const key = `${gx}:${gz}`;
        let list = grid.get(key);
        if (list === undefined) grid.set(key, (list = []));
        list.push(i);
      }
    }
  });
  return {
    gap(x: number, y: number, z: number): number {
      const list = grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? [];
      let gap = Infinity;
      for (const i of list) gap = Math.min(gap, boxDistance(boxes[i]!, x, y, z));
      return gap;
    },
  };
}

/**
 * Sweeps the whole loop every `stepM` metres. Camera distances: slowest cruise, top cruise and full
 * boost (the boom pulls back with speed), with the orbit offsets at rest (autopilot).
 */
export function auditRouteClearance(layout: SkyriverCityLayout, stepM = 2): ClearanceAudit {
  const boxes = deriveCityMasses(layout).map(place);
  // Coarse grid on world xz so each sample only tests nearby boxes.
  const cell = 400;
  const grid = new Map<string, number[]>();
  boxes.forEach((b, i) => {
    const x0 = Math.floor((b.cx - b.reach) / cell);
    const x1 = Math.floor((b.cx + b.reach) / cell);
    const z0 = Math.floor((b.cz - b.reach) / cell);
    const z1 = Math.floor((b.cz + b.reach) / cell);
    for (let gx = x0; gx <= x1; gx += 1) {
      for (let gz = z0; gz <= z1; gz += 1) {
        const key = `${gx}:${gz}`;
        let list = grid.get(key);
        if (list === undefined) grid.set(key, (list = []));
        list.push(i);
      }
    }
  });
  const nearest = (x: number, y: number, z: number): { gap: number; mass: number } => {
    const list = grid.get(`${Math.floor(x / cell)}:${Math.floor(z / cell)}`) ?? [];
    let gap = Infinity;
    let mass = -1;
    for (const i of list) {
      const d = boxDistance(boxes[i]!, x, y, z);
      if (d < gap) { gap = d; mass = i; }
    }
    return { gap, mass };
  };

  const pose: TrackPose = { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  const camera = createCameraPoseScratch();
  const rest = { orbitYaw: 0, orbitPitch: 0 };
  const speeds: readonly (readonly [number, number])[] = [[40, 0], [260, 0], [260, 1]];
  let samples = 0;
  let violations = 0;
  let minCamera = Infinity;
  let minShuttle = Infinity;
  const hits: ClearanceHit[] = [];
  for (let u = 0; u < CANYON_LOOP_LENGTH_M; u += stepM) {
    autopilotTrackPose(u, pose);
    samples += 1;
    const ship = nearest(pose.x, pose.y, pose.z);
    const shipGap = ship.gap - CLEARANCE_SHUTTLE_RADIUS_M;
    minShuttle = Math.min(minShuttle, shipGap);
    if (shipGap < 0) {
      violations += 1;
      hits.push({ what: 'shuttle', u, v: pose.v, mass: ship.mass, gapM: shipGap, speed: 0 });
    }
    for (const [speed, boostT] of speeds) {
      const flight = { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch, speed, mode: 0 as const, autopilotT: 0, boostT, roll: pose.roll };
      writeCameraPose(camera, flight, rest);
      const cam = nearest(camera.position.x, camera.position.y, camera.position.z);
      const camGap = cam.gap - CLEARANCE_CAMERA_RADIUS_M;
      minCamera = Math.min(minCamera, camGap);
      if (camGap < 0) {
        violations += 1;
        hits.push({ what: 'camera', u, v: pose.v, mass: cam.mass, gapM: camGap, speed });
      }
    }
  }
  // One entry per (what, 20 m stretch), worst first.
  const byStretch = new Map<string, ClearanceHit>();
  for (const h of hits) {
    const key = `${h.what}:${Math.round(h.u / 20)}`;
    const prev = byStretch.get(key);
    if (prev === undefined || h.gapM < prev.gapM) byStretch.set(key, h);
  }
  const worst = [...byStretch.values()].sort((a, b) => a.gapM - b.gapM).slice(0, 60);
  return { samples, masses: boxes.length, violations, minCameraGapM: minCamera, minShuttleGapM: minShuttle, worst };
}
