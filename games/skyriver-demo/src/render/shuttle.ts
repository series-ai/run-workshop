/**
 * @file shuttle.ts — the red transit shuttle the chase cam follows (T6, reworked in T6R).
 *
 * T6R root cause (P0 "pink block with legs"): the T6 `appendBox` destructured each face as
 * `[a, b, c]`, which shadowed the blue-channel parameter `b`. Every vertex got its corner index
 * (0..7) as blue, so the dark-red hull rendered fuchsia/white. The fog chunk and the colour-space
 * path were checked in a GPU browser and are not involved. The hull builder below takes colours as
 * one tuple, so a channel can no longer be shadowed by a loop variable.
 *
 * Cost: exactly 2 draw calls.
 *   (1) Hull: one merged, vertex-coloured MeshBasicMaterial. Regions are colour ranges, not
 *       materials: dark-red paint with baked face shading, near-black glazing, and HDR emissive
 *       values (> 1) for the taillight strip and nozzle throats. ACES rolls the HDR values off into
 *       a hot, saturated red instead of a clipped white.
 *   (2) Plume: one additive ShaderMaterial holding twin axial core flames, throat flares, and two
 *       analytic world ribbons. It swells on boost.
 * Draw-call budget (plan R3 <= 16): 7 city/atmosphere + 4 traffic + 2 shuttle = 13.
 *
 * Unlit by design: the scene has no Light objects, so shading is baked per face from a fixed key
 * direction plus a cool rim from the overcast, like the city and the traffic.
 */
import * as THREE from 'three';

import { applySkyriverFog } from './atmosphere';
import type { WorldWakeSamples } from './flightPresentation';
import { SKYRIVER_DEPTH_FADE_GLSL, SkyriverDepthSnapshot } from './depthFade';
import { skyriverDeclareStageRole } from './stageRoles';

export interface SkyriverShuttleUpdate {
  /** Shared 0..1 boost presentation value for the core plume and the world wake. */
  readonly boostVisual: number;
  /** Continuous time in seconds (tick + alpha) for the plume flicker phase. */
  readonly time: number;
  /** District hue multiplier used by the canopy reflection. */
  readonly districtTint?: readonly [number, number, number];
  /** Reused world wake buffer from flightPresentation.sampleWorldWake(). */
  readonly wake: WorldWakeSamples;
}

export interface SkyriverShuttle {
  readonly objects: readonly THREE.Object3D[];
  /** The hull and short core flames follow this pose. The world wake uses explicit samples. */
  setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number, rollTurns?: number): void;
  update(update: SkyriverShuttleUpdate): void;
  dispose(): void;
}

type Rgb = readonly [number, number, number];
type Vec3 = readonly [number, number, number];

/** Linear-space paint. The hull is a deep lacquered red, never pink. */
const PAINT: Rgb = [0.12, 0.006, 0.008];
const PAINT_DARK: Rgb = [0.05, 0.003, 0.004];
const GLAZING: Rgb = [0.012, 0.016, 0.024];
const TRIM: Rgb = [0.018, 0.018, 0.022];
/** HDR emissive: ACES maps this to a saturated, hot red. */
/** T7: tuned for the bloom pass — above its threshold, so the strip glows without washing out. */
const TAILLIGHT: Rgb = [2.4, 0.0, 0.0];
const TAILLIGHT_SOFT: Rgb = [0.9, 0.01, 0.008];
const THROAT: Rgb = [1.5, 0.32, 0.07];
const MARKER: Rgb = [0.25, 1.6, 2.0];
/** T7-2: panel seams (true black) and the bevel catch-light along the canopy base. */
const SEAM: Rgb = [0.004, 0.0, 0.0];
const BEVEL: Rgb = [0.34, 0.03, 0.035];
/** T7-2 neon environment tint per face side: the city's cyan on the right, magenta on the left. */
const ENV_RIGHT: Rgb = [0.0, 0.03, 0.045];
const ENV_LEFT: Rgb = [0.04, 0.0, 0.03];
const ENV_TOP: Rgb = [0.01, 0.02, 0.035];
/** T6R-2: the clearcoat catching the city — a narrow hot highlight along each shoulder line. */
const CLEARCOAT: Rgb = [0.8, 0.3, 0.33];

/** Key light from above-front-right; a cool rim from the overcast on up-facing faces. */
const KEY: Vec3 = normalize3([0.35, 0.85, 0.4]);
const RIM: Rgb = [0.012, 0.022, 0.04];

function normalize3(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
}

interface HullBuild {
  readonly positions: number[];
  readonly colors: number[];
  readonly normals: number[];
  readonly surfaceNormals: number[];
  readonly glass: number[];
}

interface IndexedHull {
  readonly positions: number[];
  readonly colors: number[];
  readonly normals: number[];
  readonly surfaceNormals: number[];
  readonly glass: number[];
  readonly indices: number[];
}

function indexHull(build: HullBuild): IndexedHull {
  const indexed: { positions: number[]; colors: number[]; normals: number[]; surfaceNormals: number[]; glass: number[]; indices: number[] } = {
    positions: [], colors: [], normals: [], surfaceNormals: [], glass: [], indices: [],
  };
  const slots = new Map<string, number>();
  for (let vertex = 0; vertex < build.positions.length / 3; vertex += 1) {
    const p = vertex * 3;
    const values = [
      build.positions[p]!, build.positions[p + 1]!, build.positions[p + 2]!,
      build.colors[p]!, build.colors[p + 1]!, build.colors[p + 2]!,
      build.normals[p]!, build.normals[p + 1]!, build.normals[p + 2]!,
      build.surfaceNormals[p]!, build.surfaceNormals[p + 1]!, build.surfaceNormals[p + 2]!,
      build.glass[vertex]!,
    ];
    const key = values.join(',');
    let slot = slots.get(key);
    if (slot === undefined) {
      slot = slots.size;
      slots.set(key, slot);
      indexed.positions.push(values[0]!, values[1]!, values[2]!);
      indexed.colors.push(values[3]!, values[4]!, values[5]!);
      indexed.normals.push(values[6]!, values[7]!, values[8]!);
      indexed.surfaceNormals.push(values[9]!, values[10]!, values[11]!);
      indexed.glass.push(values[12]!);
    }
    indexed.indices.push(slot);
  }
  return indexed;
}

/** One flat-shaded triangle. `emissive` colours skip the baked shading entirely. */
function pushTri(build: HullBuild, a: Vec3, b: Vec3, c: Vec3, color: Rgb, emissive: boolean, glass = 0): void {
  const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = normalize3([
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ]);
  let rgb: Rgb = color;
  if (!emissive) {
    // Double-sided material, so shade on |n·L| — winding cannot flip a face dark.
    const key = Math.abs(n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);
    // T7 sculpted-metal gradient: lit from the overcast above, undersides fall to near-black.
    // Up/down is resolved from the face centre's height (the material is double-sided, so the
    // winding cannot be trusted for the sign of n.y).
    const centreY = (a[1] + b[1] + c[1]) / 3;
    const vertical = Math.abs(n[1]);
    const facesUp = centreY > -0.3;
    const gradient = vertical > 0.6 ? (facesUp ? 1.35 : 0.12) : 0.55 + 0.45 * Math.min(1, Math.max(0, (centreY + 0.8) / 1.8));
    const shade = (0.3 + 0.75 * key) * gradient;
    const up = facesUp ? vertical : 0;
    // Environment reflection: which way the face looks decides which neon it mirrors.
    const centreX = (a[0] + b[0] + c[0]) / 3;
    const sideways = 1 - vertical;
    const env: Rgb = vertical > 0.6 && facesUp ? ENV_TOP : centreX > 0.4 ? ENV_RIGHT : centreX < -0.4 ? ENV_LEFT : [0, 0, 0];
    const envAmount = vertical > 0.6 ? 1 : sideways;
    rgb = [
      color[0] * shade + RIM[0] * up + env[0] * envAmount,
      color[1] * shade + RIM[1] * up + env[1] * envAmount,
      color[2] * shade + RIM[2] * up + env[2] * envAmount,
    ];
  }
  for (const p of [a, b, c]) {
    build.positions.push(p[0], p[1], p[2]);
    build.colors.push(rgb[0], rgb[1], rgb[2]);
    build.normals.push(n[0], n[1], n[2]);
    build.surfaceNormals.push(n[0], n[1], n[2]);
    build.glass.push(glass);
  }
}

/** Give the canopy reflection a continuous normal while keeping flat geometry normals for faces. */
function smoothGlassNormals(build: HullBuild): void {
  const sums = new Map<string, [number, number, number]>();
  for (let vertex = 0; vertex < build.glass.length; vertex += 3) {
    if (build.glass[vertex] !== 1) continue;
    const p = vertex * 3;
    const n = build.normals;
    const ax = build.positions[p]!;
    const ay = build.positions[p + 1]!;
    const az = build.positions[p + 2]!;
    const e1x = build.positions[p + 3]! - ax;
    const e1y = build.positions[p + 4]! - ay;
    const e1z = build.positions[p + 5]! - az;
    const e2x = build.positions[p + 6]! - ax;
    const e2y = build.positions[p + 7]! - ay;
    const e2z = build.positions[p + 8]! - az;
    const faceArea = Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x) * 0.5;
    for (let corner = 0; corner < 3; corner += 1) {
      const at = p + corner * 3;
      const key = `${build.positions[at]},${build.positions[at + 1]},${build.positions[at + 2]}`;
      const sum = sums.get(key) ?? [0, 0, 0];
      sum[0] += n[p]! * faceArea;
      sum[1] += n[p + 1]! * faceArea;
      sum[2] += n[p + 2]! * faceArea;
      sums.set(key, sum);
    }
  }
  for (let vertex = 0; vertex < build.glass.length; vertex += 1) {
    if (build.glass[vertex] !== 1) continue;
    const p = vertex * 3;
    const key = `${build.positions[p]},${build.positions[p + 1]},${build.positions[p + 2]}`;
    const sum = sums.get(key)!;
    const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    build.surfaceNormals[p] = sum[0] / length;
    build.surfaceNormals[p + 1] = sum[1] / length;
    build.surfaceNormals[p + 2] = sum[2] / length;
  }
}

function pushQuad(build: HullBuild, a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Rgb, emissive = false, glass = 0): void {
  pushTri(build, a, b, c, color, emissive, glass);
  pushTri(build, a, c, d, color, emissive, glass);
}

/** Emits the same six flat box faces as the baseline shuttle lights. */
function pushBox(build: HullBuild, centre: Vec3, size: Vec3, color: Rgb, emissive = false): void {
  const [cx, cy, cz] = centre;
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;
  const p = (sx: number, sy: number, sz: number): Vec3 => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  pushQuad(build, p(-1, -1, -1), p(1, -1, -1), p(1, 1, -1), p(-1, 1, -1), color, emissive);
  pushQuad(build, p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), color, emissive);
  pushQuad(build, p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), color, emissive);
  pushQuad(build, p(1, -1, -1), p(1, -1, 1), p(1, 1, 1), p(1, 1, -1), color, emissive);
  pushQuad(build, p(-1, 1, -1), p(1, 1, -1), p(1, 1, 1), p(-1, 1, 1), color, emissive);
  pushQuad(build, p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), color, emissive);
}

/**
 * A ring is a trapezoid cross-section at one z: half-widths at the floor and the roof line.
 * Consecutive rings are lofted into side, roof and floor panels.
 */
interface Ring {
  readonly z: number;
  readonly centerX?: number;
  readonly yLow: number;
  readonly yHigh: number;
  readonly halfLow: number;
  readonly halfHigh: number;
  /** T7-4: chamfer at the roof edges (and 55% of it at the floor edges), metres. 0 = sharp. */
  readonly round?: number;
}

type EdgeRole = 'floor' | 'side' | 'roof';

/** T7-4 rounded section: an octagon (two chamfers per side) so the hull stops reading as a slab. */
function ringOutline(r: Ring): { readonly points: readonly Vec3[]; readonly roles: readonly EdgeRole[] } {
  const c = r.round ?? 0;
  const cx = r.centerX ?? 0;
  if (c <= 0) {
    const [c0, c1, c2, c3] = ringCorners(r);
    return { points: [c0, c1, c2, c3], roles: ['floor', 'side', 'roof', 'side'] };
  }
  const cl = c * 0.55;
  return {
    points: [
      [cx - r.halfLow + cl, r.yLow, r.z],
      [cx + r.halfLow - cl, r.yLow, r.z],
      [cx + r.halfLow, r.yLow + cl, r.z],
      [cx + r.halfHigh, r.yHigh - c, r.z],
      [cx + r.halfHigh - c, r.yHigh, r.z],
      [cx - r.halfHigh + c, r.yHigh, r.z],
      [cx - r.halfHigh, r.yHigh - c, r.z],
      [cx - r.halfLow, r.yLow + cl, r.z],
    ],
    roles: ['floor', 'floor', 'side', 'roof', 'roof', 'roof', 'side', 'floor'],
  };
}

function ringCorners(r: Ring): readonly [Vec3, Vec3, Vec3, Vec3] {
  const cx = r.centerX ?? 0;
  return [
    [cx - r.halfLow, r.yLow, r.z],
    [cx + r.halfLow, r.yLow, r.z],
    [cx + r.halfHigh, r.yHigh, r.z],
    [cx - r.halfHigh, r.yHigh, r.z],
  ];
}

function loft(build: HullBuild, rings: readonly Ring[], side: Rgb, roof: Rgb, floor: Rgb, glass = 0): void {
  if (rings.some((ring) => (ring.round ?? 0) > 0)) {
    for (let i = 0; i + 1 < rings.length; i += 1) {
      const a = ringOutline(rings[i]!);
      const b = ringOutline(rings[i + 1]!);
      const n = a.points.length;
      for (let j = 0; j < n; j += 1) {
        const k = (j + 1) % n;
        const role = a.roles[j]!;
        pushQuad(build, a.points[j]!, b.points[j]!, b.points[k]!, a.points[k]!, role === 'roof' ? roof : role === 'floor' ? floor : side, false, glass);
      }
    }
    return;
  }
  for (let i = 0; i + 1 < rings.length; i += 1) {
    const [a0, a1, a2, a3] = ringCorners(rings[i]!);
    const [b0, b1, b2, b3] = ringCorners(rings[i + 1]!);
    pushQuad(build, a1, b1, b2, a2, side, false, glass); // starboard
    pushQuad(build, a3, b3, b0, a0, side, false, glass); // port
    pushQuad(build, a2, b2, b3, a3, roof, false, glass); // roof
    pushQuad(build, a0, b0, b1, a1, floor, false, glass); // floor
  }
}

function capRing(build: HullBuild, ring: Ring, color: Rgb): void {
  const { points } = ringOutline(ring);
  const centre: Vec3 = [ring.centerX ?? 0, (ring.yLow + ring.yHigh) / 2, ring.z];
  for (let j = 0; j < points.length; j += 1) {
    pushTri(build, centre, points[j]!, points[(j + 1) % points.length]!, color, false);
  }
}

function capPoint(build: HullBuild, ring: Ring, tip: Vec3, color: Rgb): void {
  const { points } = ringOutline(ring);
  for (let i = 0; i < points.length; i += 1) {
    pushTri(build, points[i]!, points[(i + 1) % points.length]!, tip, color, false);
  }
}

interface CanopyStation {
  readonly z: number;
  readonly halfWidth: number;
  readonly baseY: number;
  readonly crownY: number;
}

function canopyArch(station: CanopyStation): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= 8; i += 1) {
    const angle = (Math.PI * i) / 8;
    points.push([
      station.halfWidth * Math.cos(angle),
      station.baseY + (station.crownY - station.baseY) * Math.sin(angle),
      station.z,
    ]);
  }
  return points;
}

function loftCanopy(build: HullBuild, stations: readonly CanopyStation[]): void {
  const arches = stations.map(canopyArch);
  for (let i = 0; i + 1 < arches.length; i += 1) {
    const rear = arches[i]!;
    const front = arches[i + 1]!;
    for (let j = 0; j + 1 < rear.length; j += 1) {
      pushQuad(build, rear[j]!, rear[j + 1]!, front[j + 1]!, front[j]!, GLAZING, false, 1);
    }
  }
  const rear = arches[0]!;
  const front = arches[arches.length - 1]!;
  const rearCentre: Vec3 = [0, stations[0]!.baseY + 0.02, stations[0]!.z];
  const frontCentre: Vec3 = [0, stations[stations.length - 1]!.baseY + 0.02, stations[stations.length - 1]!.z];
  for (let i = 0; i + 1 < rear.length; i += 1) {
    pushTri(build, rearCentre, rear[i + 1]!, rear[i]!, GLAZING, false, 1);
    pushTri(build, frontCentre, front[i]!, front[i + 1]!, GLAZING, false, 1);
  }
}

/** Tail at z = TAIL_Z; the strip and the nozzles sit just behind it. */
const TAIL_Z = -5.6;
/** T7-3: nozzles sit in the two engine pods (rear corners, under the deck). */
const NOZZLE_X = 2.05;
const NOZZLE_Y = -0.42;
export const SHUTTLE_NOZZLE_ROOTS_LOCAL: readonly [Vec3, Vec3] = Object.freeze([
  Object.freeze([-NOZZLE_X, NOZZLE_Y, TAIL_Z - 0.5] as const),
  Object.freeze([NOZZLE_X, NOZZLE_Y, TAIL_Z - 0.5] as const),
]);
export const SHUTTLE_WAKE_SAMPLE_COUNT = 32;

function buildHull(): HullBuild {
  const build: HullBuild = { positions: [], colors: [], normals: [], surfaceNormals: [], glass: [] };

  // Low wedge body: widest over the rear deck, pinching to a blade nose. Nose at +Z.
  // T7-4 rounded wedge: ~10% wider, chamfered roof and floor edges and a softened nose, so the
  // side and top views read as a sculpted craft (the reference's bulk) while the chase keeps the
  // passing-wedge profile.
  const body: Ring[] = [
    { z: TAIL_Z, yLow: -0.72, yHigh: 0.82, halfLow: 2.7, halfHigh: 2.55, round: 0.5 },
    { z: -2.4, yLow: -0.84, yHigh: 0.9, halfLow: 3.3, halfHigh: 2.95, round: 0.55 },
    { z: 1.6, yLow: -0.76, yHigh: 0.66, halfLow: 3.0, halfHigh: 2.5, round: 0.5 },
    { z: 4.4, yLow: -0.62, yHigh: 0.28, halfLow: 2.35, halfHigh: 1.75, round: 0.4 },
    { z: 5.9, yLow: -0.5, yHigh: 0.0, halfLow: 1.55, halfHigh: 1.05, round: 0.25 },
    { z: 6.5, yLow: -0.38, yHigh: -0.2, halfLow: 0.72, halfHigh: 0.5, round: 0.1 },
  ];
  loft(build, body, PAINT, PAINT, PAINT_DARK);
  capRing(build, body[0]!, PAINT_DARK);
  capPoint(build, body[body.length - 1]!, [0, -0.24, 8.15], PAINT);

  // The canopy rises and falls across the hull as a continuous spine.
  const canopy: CanopyStation[] = [
    { z: -4.25, halfWidth: 1.88, baseY: 0.77, crownY: 0.86 },
    { z: -3.5, halfWidth: 2.18, baseY: 0.79, crownY: 1.24 },
    { z: -2.2, halfWidth: 2.2, baseY: 0.81, crownY: 1.53 },
    { z: -0.3, halfWidth: 2.0, baseY: 0.7, crownY: 1.72 },
    { z: 1.55, halfWidth: 1.68, baseY: 0.5, crownY: 1.49 },
    { z: 3.0, halfWidth: 1.28, baseY: 0.29, crownY: 0.92 },
    { z: 3.9, halfWidth: 0.82, baseY: 0.05, crownY: 0.25 },
  ];
  loftCanopy(build, canopy);

  // Fine red bevels follow the outer shoulder of the hull.
  for (let i = 0; i + 1 < body.length; i += 1) {
    const a = body[i]!;
    const b = body[i + 1]!;
    for (const side of [-1, 1]) {
      // On the rounded shoulder: where the roof meets its chamfer.
      const inset = 0.08;
      const ra = a.round ?? 0;
      const rb = b.round ?? 0;
      pushQuad(
        build,
        [side * (a.halfHigh - ra - inset), a.yHigh + 0.015, a.z],
        [side * (b.halfHigh - rb - inset), b.yHigh + 0.015, b.z],
        [side * (b.halfHigh - rb - inset - 0.14), b.yHigh + 0.02, b.z],
        [side * (a.halfHigh - ra - inset - 0.14), a.yHigh + 0.02, a.z],
        CLEARCOAT,
        true,
      );
    }
  }

  // Panel seams follow the side plates and the pointed nose.
  for (let i = 0; i + 1 < body.length; i += 1) {
    const a = body[i]!;
    const b = body[i + 1]!;
    for (const side of [-1, 1]) {
      const at = (r: Ring, k: number): Vec3 => {
        const y = r.yLow + (r.yHigh - r.yLow) * k;
        const half = r.halfLow + (r.halfHigh - r.halfLow) * k;
        return [side * (half + 0.025), y, r.z];
      };
      pushQuad(build, at(a, 0.52), at(b, 0.52), at(b, 0.58), at(a, 0.58), SEAM, true);
    }
  }
  pushQuad(build, [-1.45, 0.29, 4.12], [1.45, 0.29, 4.12], [1.45, 0.27, 4.26], [-1.45, 0.27, 4.26], SEAM, true);
  for (let i = 0; i + 1 < canopy.length; i += 1) {
    const a = canopy[i]!;
    const b = canopy[i + 1]!;
    for (const side of [-1, 1]) {
      pushQuad(build,
        [side * a.halfWidth, a.baseY + 0.01, a.z],
        [side * b.halfWidth, b.baseY + 0.01, b.z],
        [side * (b.halfWidth + 0.1), b.baseY - 0.07, b.z],
        [side * (a.halfWidth + 0.1), a.baseY - 0.07, a.z],
        BEVEL, true);
    }
  }

  // Two low pods hang below the hull. Their centres are the exported plume roots.
  for (const side of [-1, 1]) {
    const pod: Ring[] = [
      { centerX: side * NOZZLE_X, z: -5.92, yLow: -1.04, yHigh: -0.36, halfLow: 0.5, halfHigh: 0.62, round: 0.16 },
      { centerX: side * NOZZLE_X, z: -5.4, yLow: -1.08, yHigh: -0.34, halfLow: 0.62, halfHigh: 0.68, round: 0.18 },
      { centerX: side * NOZZLE_X, z: -3.35, yLow: -1.02, yHigh: -0.3, halfLow: 0.68, halfHigh: 0.72, round: 0.18 },
      { centerX: side * NOZZLE_X, z: -1.25, yLow: -0.86, yHigh: -0.26, halfLow: 0.52, halfHigh: 0.56, round: 0.14 },
    ];
    loft(build, pod, PAINT_DARK, TRIM, PAINT_DARK);
    capRing(build, pod[pod.length - 1]!, PAINT_DARK);
    for (let k = 0; k < 4; k += 1) {
      const z = -4.95 + k * 0.38;
      pushQuad(build,
        [side * NOZZLE_X - 0.38, -0.3, z], [side * NOZZLE_X + 0.38, -0.3, z],
        [side * NOZZLE_X + 0.38, -0.24, z + 0.06], [side * NOZZLE_X - 0.38, -0.24, z + 0.06],
        k === 0 ? BEVEL : SEAM, k === 0);
    }
  }

  // Angled fins grow from the shoulder and meet the rear pod fairings.
  for (const side of [-1, 1]) {
    pushQuad(build,
      [side * 2.85, 0.15, -2.45], [side * 4.15, -0.02, -4.3],
      [side * 4.0, -0.35, -5.15], [side * 2.7, -0.38, -4.62], PAINT_DARK);
    pushQuad(build,
      [side * 2.9, 0.18, -2.5], [side * 3.42, 0.22, -3.7],
      [side * 3.28, 0.18, -4.22], [side * 2.8, 0.13, -3.65], BEVEL, true);
  }

  // Recessed intake channels run under the belly. A narrow lip marks each channel edge.
  for (const side of [-1, 1]) {
    const x = side * 0.84;
    pushQuad(build, [x - 0.22, -0.88, -3.3], [x + 0.22, -0.88, -3.3],
      [x + 0.18, -0.88, 2.9], [x - 0.18, -0.88, 2.9], SEAM, true);
    pushQuad(build, [x - 0.28, -0.84, -3.1], [x - 0.22, -0.84, -3.1],
      [x - 0.18, -0.84, 2.7], [x - 0.24, -0.84, 2.7], TRIM);
    pushQuad(build, [x + 0.22, -0.84, -3.1], [x + 0.28, -0.84, -3.1],
      [x + 0.24, -0.84, 2.7], [x + 0.18, -0.84, 2.7], TRIM);
  }

  // Keep the established three-bar signature. The upper bar gives the full-width tail a clear edge.
  pushBox(build, [0, 0.7, TAIL_Z - 0.09], [5.0, 0.11, 0.1], TAILLIGHT, true);
  pushBox(build, [0, 0.46, TAIL_Z - 0.08], [5.4, 0.3, 0.1], TAILLIGHT, true);
  pushBox(build, [0, 0.24, TAIL_Z - 0.06], [4.6, 0.08, 0.08], TAILLIGHT_SOFT, true);

  // The throat centres stay on the two public roots. The collars follow the pod chamfer.
  for (const nozzleRoot of SHUTTLE_NOZZLE_ROOTS_LOCAL) {
    const [x, y] = nozzleRoot;
    const ellipse = (rx: number, ry: number, z: number): Vec3[] => Array.from({ length: 12 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 12;
      return [x + Math.cos(angle) * rx, y + Math.sin(angle) * ry, z];
    });
    const rearOuter = ellipse(0.68, 0.34, nozzleRoot[2] - 0.01);
    const rearInner = ellipse(0.52, 0.26, nozzleRoot[2] - 0.01);
    for (let i = 0; i < rearOuter.length; i += 1) {
      const next = (i + 1) % rearOuter.length;
      pushQuad(build, rearOuter[i]!, rearOuter[next]!, rearInner[next]!, rearInner[i]!, TRIM);
    }
    const outer = ellipse(0.52, 0.26, TAIL_Z - 0.453);
    const inner = ellipse(0.34, 0.15, TAIL_Z - 0.458);
    for (let i = 0; i < outer.length; i += 1) {
      const next = (i + 1) % outer.length;
      pushQuad(build, outer[i]!, outer[next]!, inner[next]!, inner[i]!, PAINT_DARK);
    }
    const core = ellipse(0.28, 0.11, TAIL_Z - 0.463);
    for (let i = 0; i < inner.length; i += 1) {
      const next = (i + 1) % inner.length;
      pushQuad(build, inner[i]!, inner[next]!, core[next]!, core[i]!, TRIM);
    }
    const centre: Vec3 = [x, y, TAIL_Z - 0.463];
    for (let i = 0; i < core.length; i += 1) {
      pushTri(build, centre, core[i]!, core[(i + 1) % core.length]!, THROAT, true);
    }
  }

  // Keep the two cyan service lights. They sit on the canopy shoulders, inside the hull profile.
  for (const side of [-1, 1]) {
    pushBox(build, [side * 1.62, 1.08, -3.9], [0.12, 0.08, 0.8], MARKER, true);
  }

  smoothGlassNormals(build);
  return build;
}

// --- plume ------------------------------------------------------------------------------------------

/**
 * Three primitives share one draw call, selected by `aKind`:
 *   0 — flame: an axial billboard pinned to the nozzle axis (-Z in hull space) that spins about the
 *       axis to face the camera, tapered from the throat to a point.
 *   1 — flare: a camera-facing disc at the throat, the bright core the chase cam always sees, even
 *       when it looks straight down the flame axis.
 */
const PLUME_VERTEX = /* glsl */ `
attribute vec3 aNozzle;
attribute vec2 aTS;     // t along the flame 0..1, s across -1..1
attribute float aKind;
attribute vec3 aWakeCenter;
attribute vec3 aWakeTangent;

uniform float uLength;
uniform vec2 uStripSize;
uniform float uWidth;
uniform float uFlare;
uniform float uWakeRootWidth;
uniform float uWakeTailWidth;

varying vec2 vTS;
varying float vKind;
varying float vWakeDistance;

void main() {
  if ( aKind > 2.5 ) {
    vec3 centre = aWakeCenter;
    vec3 tangent = normalize( aWakeTangent );
    vec3 right = cross( cameraPosition - centre, tangent );
    float rightLength = length( right );
    if ( rightLength < 1e-4 ) {
      right = cross( vec3( 0.0, 1.0, 0.0 ), tangent );
      rightLength = length( right );
    }
    right = rightLength > 1e-4 ? right / rightLength : vec3( 1.0, 0.0, 0.0 );
    float t = clamp( aTS.x, 0.0, 1.0 );
    float halfWidth = 0.5 * mix( uWakeRootWidth, uWakeTailWidth, t );
    vec3 world = centre + right * ( aTS.y * halfWidth );
    vTS = vec2( t, aTS.y );
    vKind = aKind;
    vWakeDistance = length( cameraPosition - centre );
    gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
    return;
  }

  vec3 nozzle = ( modelMatrix * vec4( aNozzle, 1.0 ) ).xyz;
  vec3 axis = normalize( mat3( modelMatrix ) * vec3( 0.0, 0.0, -1.0 ) );
  vec3 world;
  if ( aKind < 0.5 ) {
    float t = aTS.x;
    vec3 centre = nozzle + axis * ( t * uLength );
    vec3 toCam = cameraPosition - centre;
    vec3 right = cross( axis, toCam );
    float len = length( right );
    right = len > 1e-4 ? right / len : vec3( 1.0, 0.0, 0.0 );
    // Bulb just behind the throat, then a long taper to a point.
    float width = uWidth * ( 0.75 + 0.55 * sin( min( t * 6.0, 3.14159 ) * 0.5 ) ) * ( 1.0 - t );
    world = centre + right * ( aTS.y * 0.5 * width );
  } else if ( aKind < 1.5 ) {
    vec3 toCam = normalize( cameraPosition - nozzle );
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    vec3 up = cross( toCam, right );
    world = nozzle + toCam * 0.4 + ( right * aTS.x + up * aTS.y ) * uFlare;
  } else {
    // Strip glow: a bar in the tail plane, a little proud of the strip, sized past its ends.
    vec3 right = normalize( mat3( modelMatrix ) * vec3( 1.0, 0.0, 0.0 ) );
    vec3 up = normalize( mat3( modelMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
    world = nozzle + right * ( aTS.x * uStripSize.x * 0.5 ) + up * ( aTS.y * uStripSize.y * 0.5 );
  }
  vTS = aTS;
  vKind = aKind;
  vWakeDistance = 0.0;
  gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}
`;

const PLUME_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uTime;

${SKYRIVER_DEPTH_FADE_GLSL}

varying vec2 vTS;
varying float vKind;
varying float vWakeDistance;

void main() {
  vec3 outer = vec3( 0.18, 0.5, 1.0 );
  vec3 hot = vec3( 0.85, 0.95, 1.0 );
  vec3 color;
  float outputIntensity = uIntensity;
  float outputAlpha = 1.0;
  if ( vKind < 0.5 ) {
    float t = vTS.x;
    float s = vTS.y;
    float halo = exp( - s * s * 2.6 );
    float rest = max( 1.0 - t, 0.0 );
    float core = exp( - s * s * 26.0 ) * pow( rest, 2.2 );
    float along = smoothstep( 0.0, 0.03, t ) * pow( rest, 1.25 );
    // Shock diamonds drifting down the jet.
    float diamonds = 0.82 + 0.18 * sin( t * 46.0 - uTime * 70.0 );
    // T6R-2: the first fifth of the jet is white-hot.
    float throat = ( 1.0 - smoothstep( 0.12, 0.24, t ) ) * exp( - s * s * 5.0 );
    color = ( outer * halo * along * 0.8 + hot * core * 1.4 ) * diamonds + vec3( 1.0 ) * throat * 1.1;
  } else if ( vKind < 1.5 ) {
    float r = length( vTS );
    float disc = exp( - r * r * 5.0 );
    float pin = exp( - r * r * 40.0 );
    color = outer * disc * 0.35 + hot * pin * 0.7;
  } else if ( vKind < 2.5 ) {
    // The taillight strip's bloom: a hot red bar fading out vertically and at the ends.
    float across = exp( - vTS.y * vTS.y * 7.0 );
    float ends = 1.0 - smoothstep( 0.72, 1.0, abs( vTS.x ) );
    color = vec3( 1.0, 0.04, 0.03 ) * across * ends * 0.3 / max( uIntensity, 0.001 );
  } else {
    float t = clamp( vTS.x, 0.0, 1.0 );
    float side = vTS.y;
    float halo = exp( - side * side * 2.4 ) * pow( max( 1.0 - t, 0.0 ), 0.65 );
    float core = exp( - side * side * 18.0 ) * ( 1.0 - smoothstep( 0.12, 0.2, t ) );
    float tailFade = 1.0 - smoothstep( 0.86, 1.0, t );
    float distanceFade = 1.0 - smoothstep( 600.0, 3000.0, vWakeDistance );
    color = outer * halo * 0.42 + hot * core * 0.7;
    // Two ribbons overlap after the weld, so each carries half the shared brightness cap.
    outputIntensity = min( uIntensity * 0.16, 0.13 );
    outputAlpha = tailFade * distanceFade;
  }
  outputIntensity *= skyriverVisibilityFade();
  gl_FragColor = vec4( color * outputIntensity, outputAlpha );
}
`;

interface PlumeBuild {
  readonly geometry: THREE.BufferGeometry;
  readonly wakeStartVertices: readonly [number, number];
  readonly wakeCenters: Float32Array;
  readonly wakeTangents: Float32Array;
}

function buildPlumeGeometry(): PlumeBuild {
  const nozzle: number[] = [];
  const ts: number[] = [];
  const kind: number[] = [];
  const index: number[] = [];
  let vertex = 0;
  const SEGMENTS = 10;

  for (const nozzleRoot of SHUTTLE_NOZZLE_ROOTS_LOCAL) {
    const nx = nozzleRoot[0];
    const ny = nozzleRoot[1];
    const nz = nozzleRoot[2];
    // Flame strip: SEGMENTS quads along t.
    const base = vertex;
    for (let i = 0; i <= SEGMENTS; i += 1) {
      for (const s of [-1, 1]) {
        nozzle.push(nx, ny, nz);
        ts.push(i / SEGMENTS, s);
        kind.push(0);
        vertex += 1;
      }
    }
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = base + i * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    // Throat flare quad.
    const flare = vertex;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      nozzle.push(nx, ny, nz);
      ts.push(u, v);
      kind.push(1);
      vertex += 1;
    }
    index.push(flare, flare + 1, flare + 2, flare, flare + 2, flare + 3);
  }
  // Strip glow bar, centred on the taillight strip just behind the tail.
  const strip = vertex;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    nozzle.push(0, 0.42, TAIL_Z - 0.3);
    ts.push(u, v);
    kind.push(2);
    vertex += 1;
  }
  index.push(strip, strip + 1, strip + 2, strip, strip + 2, strip + 3);

  // Two world ribbons leave the exact nozzle roots and converge onto one path.
  const wakeStartVertices: [number, number] = [vertex, 0];
  for (let ribbon = 0; ribbon < 2; ribbon += 1) {
    wakeStartVertices[ribbon] = vertex;
    for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
      const t = i / (SHUTTLE_WAKE_SAMPLE_COUNT - 1);
      for (const side of [-1, 1]) {
        nozzle.push(0, 0, 0);
        ts.push(t, side);
        kind.push(3);
        vertex += 1;
      }
    }
    for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT - 1; i += 1) {
      const a = wakeStartVertices[ribbon] + i * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  // three requires a `position` attribute to size the draw; the shader builds positions itself.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertex * 3), 3));
  geometry.setAttribute('aNozzle', new THREE.Float32BufferAttribute(nozzle, 3));
  geometry.setAttribute('aTS', new THREE.Float32BufferAttribute(ts, 2));
  geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  const wakeCenters = new Float32Array(vertex * 3);
  const wakeTangents = new Float32Array(vertex * 3);
  const wakeCenterAttribute = new THREE.BufferAttribute(wakeCenters, 3);
  const wakeTangentAttribute = new THREE.BufferAttribute(wakeTangents, 3);
  wakeCenterAttribute.setUsage(THREE.DynamicDrawUsage);
  wakeTangentAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aWakeCenter', wakeCenterAttribute);
  geometry.setAttribute('aWakeTangent', wakeTangentAttribute);
  geometry.setIndex(index);
  return { geometry, wakeStartVertices, wakeCenters, wakeTangents };
}

/** Attached nozzle flames stay short; the world ribbon carries the long exhaust trail. */
// T7: intensities halved for the bloom pass, which now supplies the glow the raw values used to fake.
const PLUME_CRUISE = Object.freeze({ length: 8, width: 1.4, flare: 1.2, intensity: 0.55 });
// R13: boost glare capped (cycle-6: the boost plume bloomed into a white blob over the craft).
const PLUME_BOOST = Object.freeze({ length: 15, width: 2.3, flare: 1.5, intensity: 0.8 });

export function createSkyriverShuttle(options: { readonly depthFade?: SkyriverDepthSnapshot } = {}): SkyriverShuttle {
  const build = buildHull();
  const indexedHull = indexHull(build);
  const hullGeometry = new THREE.BufferGeometry();
  hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(indexedHull.positions, 3));
  hullGeometry.setAttribute('color', new THREE.Float32BufferAttribute(indexedHull.colors, 3));
  hullGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(indexedHull.normals, 3));
  hullGeometry.setAttribute('aSurfaceNormal', new THREE.Float32BufferAttribute(indexedHull.surfaceNormals, 3));
  hullGeometry.setAttribute('aGlass', new THREE.Float32BufferAttribute(indexedHull.glass, 1));
  hullGeometry.setIndex(indexedHull.indices);
  hullGeometry.computeBoundingSphere();
  const hullMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide });
  hullMaterial.name = 'skyriver.shuttle.hull';
  const districtTintUniform = { value: new THREE.Vector3(1, 1, 1) };
  hullMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uDistrictTint = districtTintUniform;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nattribute vec3 aSurfaceNormal;\nattribute float aGlass;\nvarying vec3 vGlassNormal;\nvarying vec3 vGlassWorldPosition;\nvarying float vGlass;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvGlassNormal = normalize( mat3( modelMatrix ) * aSurfaceNormal );\nvGlassWorldPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvGlass = aGlass;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform vec3 uDistrictTint;\nvarying vec3 vGlassNormal;\nvarying vec3 vGlassWorldPosition;\nvarying float vGlass;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec3 glassNormal = normalize( vGlassNormal );
vec3 glassView = normalize( cameraPosition - vGlassWorldPosition );
vec3 glassReflection = reflect( -glassView, glassNormal );
float glassGrazing = pow( 1.0 - abs( dot( glassNormal, glassView ) ), 2.0 );
float glassLongitude = atan( glassReflection.z, glassReflection.x );
float glassBandA = smoothstep( 0.76, 0.98, cos( glassLongitude * 11.0 + glassReflection.y * 2.7 ) );
float glassBandB = smoothstep( 0.84, 0.99, cos( glassLongitude * 4.0 - glassReflection.y * 4.2 ) );
float glassStreak = 0.035 + 0.2 * glassBandA + 0.08 * glassBandB;
diffuseColor.rgb += uDistrictTint * vGlass * glassGrazing * glassStreak;`,
    );
  };
  hullMaterial.customProgramCacheKey = () => 'skyriver-shuttle-hull-district-glass-v1';
  applySkyriverFog(hullMaterial);
  const hull = new THREE.Mesh(hullGeometry, hullMaterial);
  hull.name = 'skyriver.shuttle.hull';
  hull.rotation.order = 'YXZ';
  hull.frustumCulled = false;
  // R23 draw role: the player hull is opaque and depth-writing.
  skyriverDeclareStageRole(hull, 'opaque');

  const plumeBuild = buildPlumeGeometry();
  const plumeGeometry = plumeBuild.geometry;
  const wakeCenterAttribute = plumeGeometry.getAttribute('aWakeCenter') as THREE.BufferAttribute;
  const wakeTangentAttribute = plumeGeometry.getAttribute('aWakeTangent') as THREE.BufferAttribute;
  const fallbackVisibilityDepth = options.depthFade === undefined
    ? new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat)
    : null;
  if (fallbackVisibilityDepth !== null) {
    fallbackVisibilityDepth.minFilter = THREE.NearestFilter;
    fallbackVisibilityDepth.magFilter = THREE.NearestFilter;
    fallbackVisibilityDepth.generateMipmaps = false;
    fallbackVisibilityDepth.needsUpdate = true;
  }
  const visibilityUniforms = options.depthFade?.uniforms ?? {
    uVisibilityDepth: { value: fallbackVisibilityDepth },
    uVisibilityResolution: { value: new THREE.Vector2(1, 1) },
    uVisibilityCameraRange: { value: new THREE.Vector2(1, 14000) },
    uVisibilityFadeEnabled: { value: 0 },
  };
  const plumeMaterial = new THREE.ShaderMaterial({
    name: 'skyriver.shuttle.plume',
    vertexShader: PLUME_VERTEX,
    fragmentShader: PLUME_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    uniforms: {
      uLength: { value: PLUME_CRUISE.length },
      uWidth: { value: PLUME_CRUISE.width },
      uFlare: { value: PLUME_CRUISE.flare },
      uIntensity: { value: PLUME_CRUISE.intensity },
      uWakeRootWidth: { value: 2.5 },
      uWakeTailWidth: { value: 0.5 },
      uTime: { value: 0 },
      uStripSize: { value: new THREE.Vector2(8.6, 2.4) },
      ...visibilityUniforms,
    },
  });
  // The plume is parented to the hull, so the hull's pose is its pose — no copy per frame.
  const plume = new THREE.Mesh(plumeGeometry, plumeMaterial);
  plume.name = 'skyriver.shuttle.plume';
  plume.frustumCulled = false;
  plume.renderOrder = 12;
  // R23 draw role: transparent additive, depthWrite false. The plume is a CHILD of the opaque hull,
  // which is why the stages select by camera layer rather than by `visible`.
  skyriverDeclareStageRole(plume, 'transparent');
  if (options.depthFade !== undefined) {
    plume.onBeforeRender = (renderer) => options.depthFade!.capture(renderer);
  }
  hull.add(plume);

  return {
    objects: [hull],
    setPose(x: number, y: number, z: number, yawTurns: number, pitchTurns: number, rollTurns = 0): void {
      hull.position.set(x, y, z);
      hull.rotation.set(-pitchTurns * Math.PI * 2, yawTurns * Math.PI * 2, rollTurns * Math.PI * 2);
    },
    update({ boostVisual, time, districtTint = [1, 1, 1], wake }: SkyriverShuttleUpdate): void {
      // Pure function of the arguments: no accumulators, so a restore cannot leave a stale flare.
      const boost = Math.min(1, Math.max(0, boostVisual));
      const flicker = 0.92 + 0.08 * Math.sin(time * 37.0) * Math.sin(time * 11.0);
      const u = plumeMaterial.uniforms;
      u.uLength!.value = THREE.MathUtils.lerp(PLUME_CRUISE.length, PLUME_BOOST.length, boost) * (0.95 + 0.05 * flicker);
      u.uWidth!.value = THREE.MathUtils.lerp(PLUME_CRUISE.width, PLUME_BOOST.width, boost);
      u.uFlare!.value = THREE.MathUtils.lerp(PLUME_CRUISE.flare, PLUME_BOOST.flare, boost) * flicker;
      u.uIntensity!.value = THREE.MathUtils.lerp(PLUME_CRUISE.intensity, PLUME_BOOST.intensity, boost) * flicker;
      u.uWakeRootWidth!.value = wake.rootWidthM;
      u.uWakeTailWidth!.value = wake.tailWidthM;
      u.uTime!.value = time;
      districtTintUniform.value.set(districtTint[0], districtTint[1], districtTint[2]);

      for (let i = 0; i < SHUTTLE_WAKE_SAMPLE_COUNT; i += 1) {
        const source = i * 3;
        for (let ribbon = 0; ribbon < 2; ribbon += 1) {
          const ribbonCenters = ribbon === 0 ? wake.leftCenters : wake.rightCenters;
          const ribbonTangents = ribbon === 0 ? wake.leftTangents : wake.rightTangents;
          const left = (plumeBuild.wakeStartVertices[ribbon] + i * 2) * 3;
          const right = left + 3;
          for (let axis = 0; axis < 3; axis += 1) {
            const center = ribbonCenters[source + axis]!;
            const tangent = ribbonTangents[source + axis]!;
            plumeBuild.wakeCenters[left + axis] = center;
            plumeBuild.wakeCenters[right + axis] = center;
            plumeBuild.wakeTangents[left + axis] = tangent;
            plumeBuild.wakeTangents[right + axis] = tangent;
          }
        }
      }
      wakeCenterAttribute.needsUpdate = true;
      wakeTangentAttribute.needsUpdate = true;
    },
    dispose(): void {
      hullGeometry.dispose();
      hullMaterial.dispose();
      plumeGeometry.dispose();
      plumeMaterial.dispose();
      fallbackVisibilityDepth?.dispose();
    },
  };
}
