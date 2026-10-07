/**
 * @file traffic.ts — the Skyriver traffic (T4, reworked in T6R): thousands of free-flying vehicles
 * that read as crossing rivers of light, in four draw calls.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R4 — ">= 2,000 flying vehicles as a street-free open-air swarm with Fifth Element altitude
 *     layers; 3 instanced archetypes + thruster quads; <= 4 traffic draw calls; transforms evaluated
 *     from float math at interpolated time tick + renderAlpha".
 *   Design "Sim <-> render split" — traffic is presentation-derived and never feeds simulation.
 *   Design "Performance" — quality tiers cars 2,400 -> 1,200 -> 600, presentation-only.
 *
 * T6R P0 "no light rivers". The T4 swarm flew every car on its own small orbit inside the 800 m
 * flight box, so the view was a uniform snow of grey/yellow pills with tiny glows on the nearest
 * 1,500. The approved Neon Rain bar is the opposite: dark vehicles whose head- and taillights form
 * long streams converging down the canyon at many altitudes, crossed by streams through the tower
 * gaps. This module now draws exactly that:
 *   - Rivers. Each car joins one river: most run along the canyon (z) in a tight lateral lane at one
 *     altitude, alternating direction; the rest cross the canyon (x) through the gaps between tower
 *     rows, high up and deep down. Cars bunch into platoons, so a river reads as a stream with gaps.
 *     Rivers wrap over a span far longer than the visible canyon and fade out at the wrap ends, so
 *     no car ever pops in front of the camera.
 *   - Dark hulls. The archetypes keep their silhouettes but carry dark paint; only the light patches
 *     stay bright. Hulls now take the shared altitude fog (T4 left it unwired, so they never hazed).
 *   - Light streaks. One additive draw holds a head streak (white) and a tail streak (red) per car.
 *     Each is a view-space capsule from the lamp backward along the velocity, length proportional
 *     to speed, with a pixel-size floor so a 3 m lamp 2 km away still covers ~2 px. Each lamp is
 *     directional: headlights show to the cars' front, taillights to their rear. Lights penetrate
 *     the haze further than concrete (a softer fog curve), which is what makes distant rivers read.
 * Draw calls: 3 hull archetypes + 1 streak batch = 4 (plan R4 ceiling, unchanged).
 *
 * Street-free by construction: no ground plane, no road, no lane geometry. A "river" exists only as
 * the shared course of the cars on it. Rivers keep clear of the T6R skybridge altitudes, so no car
 * ever rides a structure.
 *
 * GC discipline: per-car constants are precomputed into typed arrays; the per-frame loop writes
 * instance matrices and streak attributes by index arithmetic and allocates nothing.
 */
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  AdditiveBlending,
  DoubleSide,
} from 'three';
import type { Object3D } from 'three';

import { deriveTrafficParams, TRAFFIC_ARCHETYPE_COUNT, TRAFFIC_MAX_CARS } from '../sim/derive';
import { CHASM_BOUNDS, SKYRIVER_TICK_RATE } from '../sim/systems';

import {
  SKYRIVER_OUTPUT_APPLY_GLSL,
  SKYRIVER_OUTPUT_PARS_GLSL,
  applySkyriverFog,
  skyriverFogUniforms,
} from './atmosphere';
import { CANYON_LOOP_LENGTH_M, warpCanyon, warpDirection, type WarpOut } from './canyonWarp';
import { routeAltitude, routeLateral } from './routeProfile';
import { TRAFFIC_TICK_RATE_HZ } from './trafficTypes';
import type {
  SkyriverTraffic,
  SkyriverTrafficOptions,
  TrafficBounds,
  TrafficPoint,
  TrafficQuality,
  TrafficStats,
  TrafficTime,
} from './trafficTypes';

export { TRAFFIC_TICK_RATE_HZ } from './trafficTypes';
export type {
  SkyriverTraffic,
  SkyriverTrafficOptions,
  TrafficBounds,
  TrafficPoint,
  TrafficQuality,
  TrafficStats,
  TrafficTime,
} from './trafficTypes';

const TAU = Math.PI * 2;

/** Per-archetype triangle ceiling from the brief. Exceeding it is a build error, not a warning. */
const MAX_TRIANGLES_PER_ARCHETYPE = 800;

/** Draw calls this module adds: one InstancedMesh per archetype, plus one streak batch (R4: <= 4). */
/**
 * T7-5: six render archetypes from the sim's three. Each derived archetype splits into its own
 * shape and a variant (cab -> hunchback van, interceptor -> saucer commuter, commuter -> long bus
 * with a window strip), so near traffic reads as many kinds of vehicle. Presentation only.
 */
const RENDER_ARCHETYPES = TRAFFIC_ARCHETYPE_COUNT * 2;
const VARIANT_SHARE = 0.45;
const TRAFFIC_DRAW_CALLS = RENDER_ARCHETYPES + 1;

/**
 * The plan's quality tiers (Design "Performance": cars 2,400 -> 1,200 -> 600). T6R: every active car
 * now carries its light streaks — the streak batch is one cheap instanced draw, and a car without its
 * lights is exactly the "unlit pill" the review rejected — so the light budget equals the car count.
 */
export const TRAFFIC_QUALITY_TIERS: {
  readonly high: TrafficQuality;
  readonly medium: TrafficQuality;
  readonly low: TrafficQuality;
} = Object.freeze({
  high: Object.freeze({ carCount: 2400, thrusterBudget: 2400 }),
  medium: Object.freeze({ carCount: 1200, thrusterBudget: 1200 }),
  low: Object.freeze({ carCount: 600, thrusterBudget: 600 }),
});

/**
 * T7-3 traffic model: actual cars, not light ribbons. The reference footage's traffic is a volume
 * of small angular vehicles at every height, each drifting, climbing and banking on its own, read
 * as dark silhouettes with head/tail light dots. Ribbons (rivers) are gone. Each car now has:
 *   - a home in canyon space: its own lateral position across the corridor and altitude (a
 *     continuous spread, no layers or lanes), and its own direction (random per car, so no stream
 *     of one colour ever forms);
 *   - organic motion: slow lateral drift and climb/dive sines of its own amplitude and period, with
 *     heading, pitch and bank derived from that motion;
 *   - speed along the canyon; the city loop wraps, so a car simply circles the city.
 * With random direction per car, continuous lateral/vertical spread and the winding sightline, the
 * volume cannot line up into parallel bands (the zero-road gate), by construction.
 * A chase band of CHASE_COUNT cars lives in a window around the shuttle at its own altitude, so
 * real bodies always pass close by.
 */
/** Corridor half-width cars use, metres (inner terraces stand at |x| >= 405, grime annexes 372). */
const CAR_CORRIDOR_HALF_M = 340;
const CAR_MIN_Y_M = 120;
/** Under the skybridges (>= 2700 m): no car ever meets a structure. */
const CAR_MAX_Y_M = 2600;
const DRIFT_MIN_M = 12;
const DRIFT_SPAN_M = 50;
const CLIMB_MIN_M = 6;
const CLIMB_SPAN_M = 34;
const SPEED_SCALE = 1.3;
/** Chase band: cars streaming past the shuttle within a window around it. */
/** T7-4: more and bigger neighbours, so passing them reads as passing cars. */
const CHASE_COUNT = 110;
const CHASE_SIZE_MIN = 3.2;
const CHASE_SIZE_SPAN = 1.4;
const CHASE_WINDOW_M = 1400;
const CHASE_FADE_M = 160;
/**
 * R11 established traffic patterns. Cars belong to STREAMS — flight corridors, not drawn lanes:
 * each stream holds one direction around the city on its own altitude shelf, follows the canyon's
 * winding (it lives in canyon space), meanders slowly across the corridor and wobbles ±10-20 m in
 * height, and carries its cars in 2-4 loose sub-rows. Density pulses along it (clumps and gaps,
 * like real traffic). Stream pairs swap shelves at three interchanges, where they cross at distinct
 * altitudes (merge/branch points). Each car holds the stream's heading with a small personal jink,
 * surges ±40 m around its clump (speed varies inside the stream's band) and drifts a few metres in
 * its row. The pattern is carried by the flow, not by geometry: no crisp rows, no even spacing.
 * [x across, shelf y, direction, sub-rows, width m, speed m/s, meander m, wobble m, pulses, share]
 */
const STREAMS: readonly (readonly number[])[] = Object.freeze([
  [-230, 560, 1, 4, 95, 60, 70, 14, 9, 0.17],   // freight, low
  [210, 780, -1, 2, 26, 170, 45, 12, 15, 0.09],  // express
  [-140, 1060, 1, 3, 52, 105, 60, 18, 12, 0.13], // standard
  [250, 1320, -1, 3, 48, 115, 55, 16, 11, 0.13], // standard
  [-275, 1620, 1, 2, 24, 180, 40, 10, 16, 0.09], // express
  [-300, 1900, -1, 4, 100, 65, 60, 20, 8, 0.15], // freight, high
  [190, 2240, 1, 3, 52, 110, 50, 15, 10, 0.12],  // standard, pristine
  [130, 400, -1, 3, 60, 95, 65, 14, 12, 0.12],   // standard, grime
]);
/** Interchanges: [stream a, stream b, v] — the pair swaps shelves (and sides) through a 1.1 km ramp. */
const INTERCHANGES: readonly (readonly [number, number, number])[] = Object.freeze([
  [0, 7, -4100], [2, 3, 1500], [4, 5, 4800],
]);
const INTERCHANGE_RAMP_M = 1100;
const STREAM_SHARE = 0.85;
const CHASE_STREAM_SHARE = 0.8;
const SURGE_M = 40;
/** Personal jink: heading wobble amplitude, radians (~3 degrees). */
const JINK_RAD = 0.055;

/** Escort streaks are this fraction of a car's. */
const ESCORT_STREAK_SCALE = 0.5;
/** Inset from the corridor walls for escorts, metres. */
const WALL_MARGIN_M = 18;
/** Bodies stay drawn to here (fog takes them first); beyond, only the light dots remain. */
const HULL_DRAW_DISTANCE_M = 1300;

/** Escort cars: [lateral, lift, forward mean, forward swing] in metres, shuttle frame. */
const ESCORT_COUNT = 4;
const ESCORTS: readonly number[] = Object.freeze([
  // T7-2: every escort flies level with or above the shuttle and off its line. A light trail
  // under the shuttle projects straight down the frame toward the camera and reads as a lane line.
  -38, 8, 60, 38,
  48, 5, 30, 26,
  -78, 26, 150, 70,
  88, 18, 0, 0,
]);

/** Per-car size jitter, so a batch of identical hulls does not read as a clone army. */
/** T7-3: bigger bodies (vans and buses in the reference) so silhouettes read at chase distance. */
const SIZE_MIN_SCALE = 1.5;
const SIZE_SCALE_SPAN = 1.0;

/** Distance dimming of the hull tint: far hulls sink into the haze. */
const DISTANCE_DIM_RANGE_M = 900;
const DISTANCE_DIM_FLOOR = 0.42;

/** Streak tuning: lamp offsets from the car centre, metres; trail seconds of motion. */
const HEAD_OFFSET_M = 2.4;
const TAIL_OFFSET_M = 2.5;
/** T6R-2: long continuous trails (platoon-mates' trails overlap into one ribbon), never dashes. */
/** T7-3: short per-car tails only — lights are dots with a brief smear, never ribbons. */
const TAIL_TRAIL_S = 0.09;
const HEAD_TRAIL_S = 0.02;

function fail(code: string): never {
  throw new Error(code);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/* ------------------------------------------------------------------------------------------------
 * Local hash and value noise.
 *
 * Presentation-only, and deliberately not the sim's deterministic math: this never reaches state, so
 * it must be cheap rather than cross-engine exact. Math.imul keeps the mixing in int32 lanes.
 * ---------------------------------------------------------------------------------------------- */

/** Mixes two integers to a float in [0, 1). */
function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ b, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}


/* ------------------------------------------------------------------------------------------------
 * Procedural low-poly archetype geometry.
 *
 * Built in code from plain quads and triangles: no loaders, no addons, no assets. Faces carry baked
 * directional shading and emissive light patches in the vertex colour attribute, so the hulls read
 * as solid shapes and their lights read as lights under an unlit material — which keeps traffic
 * independent of whatever lighting rig T3 installs.
 * ---------------------------------------------------------------------------------------------- */

interface MeshBuild {
  readonly position: number[];
  readonly normal: number[];
  readonly color: number[];
}

function newBuild(): MeshBuild {
  return { position: [], normal: [], color: [] };
}

function buildTriangles(build: MeshBuild): number {
  return build.position.length / 9;
}

/**
 * Appends one triangle with a flat normal, winding it so the normal points away from the interior
 * reference point. Deriving the winding from an interior point rather than by hand removes the whole
 * class of inside-out face bugs from the hull definitions below.
 */
function pushTriOut(
  build: MeshBuild,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  ix: number, iy: number, iz: number,
  r: number, g: number, b: number,
): void {
  const e1x = bx - ax;
  const e1y = by - ay;
  const e1z = bz - az;
  const e2x = cx - ax;
  const e2y = cy - ay;
  const e2z = cz - az;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length === 0) fail('SKYRIVER_TRAFFIC_DEGENERATE_FACE');
  nx /= length;
  ny /= length;
  nz /= length;

  // Outward test against the interior point. A face whose normal points inward is wound backwards.
  const outward = nx * (ax - ix) + ny * (ay - iy) + nz * (az - iz);
  const flip = outward < 0;
  if (flip) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }

  const p = build.position;
  const n = build.normal;
  const c = build.color;
  if (flip) {
    p.push(ax, ay, az, cx, cy, cz, bx, by, bz);
  } else {
    p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  }
  for (let vertex = 0; vertex < 3; vertex += 1) {
    n.push(nx, ny, nz);
    c.push(r, g, b);
  }
}

/** Appends a planar quad A-B-C-D as two outward-wound triangles. */
function pushQuadOut(
  build: MeshBuild,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  dx: number, dy: number, dz: number,
  ix: number, iy: number, iz: number,
  r: number, g: number, b: number,
): void {
  pushTriOut(build, ax, ay, az, bx, by, bz, cx, cy, cz, ix, iy, iz, r, g, b);
  pushTriOut(build, ax, ay, az, cx, cy, cz, dx, dy, dz, ix, iy, iz, r, g, b);
}

/** Baked face shades, brightest on top. A cheap stand-in for a light rig, in vertex colours. */
const SHADE_TOP = 1;
const SHADE_FRONT = 0.76;
const SHADE_SIDE_RIGHT = 0.66;
const SHADE_SIDE_LEFT = 0.58;
const SHADE_BACK = 0.5;
const SHADE_BOTTOM = 0.34;

/** Appends an axis-aligned box, shaded per face. 12 triangles. */
function pushBox(
  build: MeshBuild,
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  r: number, g: number, b: number,
): void {
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const z0 = cz - sz / 2;
  const z1 = cz + sz / 2;

  pushQuadOut(build, x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, cx, cy, cz,
    r * SHADE_TOP, g * SHADE_TOP, b * SHADE_TOP);
  pushQuadOut(build, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, cx, cy, cz,
    r * SHADE_BOTTOM, g * SHADE_BOTTOM, b * SHADE_BOTTOM);
  pushQuadOut(build, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, cx, cy, cz,
    r * SHADE_FRONT, g * SHADE_FRONT, b * SHADE_FRONT);
  pushQuadOut(build, x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, cx, cy, cz,
    r * SHADE_BACK, g * SHADE_BACK, b * SHADE_BACK);
  pushQuadOut(build, x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, cx, cy, cz,
    r * SHADE_SIDE_RIGHT, g * SHADE_SIDE_RIGHT, b * SHADE_SIDE_RIGHT);
  pushQuadOut(build, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, cx, cy, cz,
    r * SHADE_SIDE_LEFT, g * SHADE_SIDE_LEFT, b * SHADE_SIDE_LEFT);
}

/**
 * Appends an emissive patch in the XY plane: a headlight or taillight. Set slightly off the hull face
 * it sits on, so it never z-fights with it.
 */
function pushLightPatch(
  build: MeshBuild,
  cx: number, cy: number, z: number,
  width: number, height: number,
  r: number, g: number, b: number,
): void {
  const x0 = cx - width / 2;
  const x1 = cx + width / 2;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  // Interior reference on the hull's centreline at the opposite end, so the patch faces outward.
  pushQuadOut(build, x0, y0, z, x1, y0, z, x1, y1, z, x0, y1, z, cx, cy, 0, r, g, b);
}

/** Appends a low-poly half-ellipsoid canopy. (stacks - 1) * segments * 2 + segments triangles. */
function pushDome(
  build: MeshBuild,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number,
  segments: number, stacks: number,
  r: number, g: number, b: number,
): void {
  for (let stack = 0; stack < stacks; stack += 1) {
    const p0 = (stack / stacks) * (Math.PI / 2);
    const p1 = ((stack + 1) / stacks) * (Math.PI / 2);
    const y0 = cy + ry * Math.sin(p0);
    const y1 = cy + ry * Math.sin(p1);
    const f0 = Math.cos(p0);
    const f1 = Math.cos(p1);
    // Top stacks sit nearer the apex and catch more light: grade the shade up the dome.
    const shade = SHADE_FRONT + (SHADE_TOP - SHADE_FRONT) * ((stack + 0.5) / stacks);
    const sr = r * shade;
    const sg = g * shade;
    const sb = b * shade;

    for (let segment = 0; segment < segments; segment += 1) {
      const a0 = (segment / segments) * TAU;
      const a1 = ((segment + 1) / segments) * TAU;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);

      const ax = cx + rx * f0 * c0;
      const az = cz + rz * f0 * s0;
      const bx = cx + rx * f0 * c1;
      const bz = cz + rz * f0 * s1;

      if (stack === stacks - 1) {
        // Apex fan: the upper ring has collapsed to a point.
        pushTriOut(build, ax, y0, az, bx, y0, bz, cx, y1, cz, cx, cy, cz, sr, sg, sb);
      } else {
        const dx = cx + rx * f1 * c1;
        const dz = cz + rz * f1 * s1;
        const ex = cx + rx * f1 * c0;
        const ez = cz + rz * f1 * s0;
        pushQuadOut(build, ax, y0, az, bx, y0, bz, dx, y1, dz, ex, y1, ez, cx, cy, cz, sr, sg, sb);
      }
    }
  }
}

/** Emissive patch colours. Values near 1 read as lights against the dim hull shades at night. */
// R11: HDR lamp bars — above the bloom threshold, so a near car reads as a dark body with one hot
// light bar (the streak lamp dots fade out up close; far away only the lamp pairs remain).
const HEADLIGHT_R = 2.0;
const HEADLIGHT_G = 2.15;
const HEADLIGHT_B = 2.3;
const TAILLIGHT_R = 4.0;
const TAILLIGHT_G = 0.3;
const TAILLIGHT_B = 0.2;
const SIGN_R = 1;
const SIGN_G = 0.72;
const SIGN_B = 0.2;

/**
 * Archetype 0 — "cab": a boxy yellow compact, the workhorse silhouette of the swarm.
 * Forward is +Z throughout, matching the orientation basis evaluate() builds.
 */
function buildCab(): MeshBuild {
  const build = newBuild();
  // T6R: dark paint; the instance tint picks the hue, the lamps carry the light.
  const body = 0.075;
  const r = body;
  const g = body * 0.9;
  const b = body * 0.85;

  pushBox(build, 0, 0, 0, 2, 0.8, 4.4, r, g, b);
  pushBox(build, 0, 0.72, -0.2, 1.72, 0.76, 2.4, r * 0.82, g * 0.82, b * 0.82);
  pushBox(build, 0, -0.08, 2.32, 1.6, 0.52, 0.56, r * 0.9, g * 0.9, b * 0.9);
  pushBox(build, 0, 1.2, 0.1, 0.9, 0.24, 0.5, SIGN_R, SIGN_G, SIGN_B);
  pushBox(build, 1.14, -0.16, -0.6, 0.36, 0.5, 1.9, 0.2, 0.2, 0.22);
  pushBox(build, -1.14, -0.16, -0.6, 0.36, 0.5, 1.9, 0.2, 0.2, 0.22);

  pushLightPatch(build, 0.56, -0.04, 2.61, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, -0.56, -0.04, 2.61, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, 0.1, -2.21, 1.75, 0.2, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);

  return build;
}

/** Archetype 1 — "interceptor": a sharp gunmetal wedge, the fast traffic of the upper bands. */
function buildInterceptor(): MeshBuild {
  const build = newBuild();
  const r = 0.06;
  const g = 0.064;
  const b = 0.075;

  // Tapered prism: nose point, a mid ring at z = 0.4, a tail ring at z = -2.6.
  const noseZ = 3.1;
  const midZ = 0.4;
  const tailZ = -2.6;
  const mx = 0.95;
  const myLow = -0.3;
  const myHigh = 0.42;
  const mxTop = 0.74;
  const tx = 0.55;
  const tyLow = -0.22;
  const tyHigh = 0.3;
  const txTop = 0.44;

  // Mid ring, clockwise from the lower right: lower-right, lower-left, upper-left, upper-right.
  const m0x = mx; const m0y = myLow;
  const m1x = -mx; const m1y = myLow;
  const m2x = -mxTop; const m2y = myHigh;
  const m3x = mxTop; const m3y = myHigh;
  const t0x = tx; const t0y = tyLow;
  const t1x = -tx; const t1y = tyLow;
  const t2x = -txTop; const t2y = tyHigh;
  const t3x = txTop; const t3y = tyHigh;

  const shades = [SHADE_BOTTOM, SHADE_SIDE_LEFT, SHADE_TOP, SHADE_SIDE_RIGHT];
  const ringX = [m0x, m1x, m2x, m3x];
  const ringY = [m0y, m1y, m2y, m3y];
  const tipX = [t0x, t1x, t2x, t3x];
  const tipY = [t0y, t1y, t2y, t3y];

  for (let edge = 0; edge < 4; edge += 1) {
    const next = (edge + 1) % 4;
    const shade = shades[edge];
    const sr = r * shade;
    const sg = g * shade;
    const sb = b * shade;
    // Nose fan.
    pushTriOut(build,
      ringX[edge], ringY[edge], midZ,
      ringX[next], ringY[next], midZ,
      0, 0.05, noseZ,
      0, 0, 0, sr * 1.08, sg * 1.08, sb * 1.08);
    // Body panel.
    pushQuadOut(build,
      ringX[edge], ringY[edge], midZ,
      ringX[next], ringY[next], midZ,
      tipX[next], tipY[next], tailZ,
      tipX[edge], tipY[edge], tailZ,
      0, 0, 0, sr, sg, sb);
  }
  // Tail cap.
  pushQuadOut(build, t0x, t0y, tailZ, t1x, t1y, tailZ, t2x, t2y, tailZ, t3x, t3y, tailZ,
    0, 0, 0, r * SHADE_BACK, g * SHADE_BACK, b * SHADE_BACK);

  pushBox(build, 0, 0.48, 1, 0.56, 0.32, 1.3, 0.1, 0.16, 0.2);
  pushBox(build, 0.52, -0.02, -2.78, 0.4, 0.4, 0.36, 0.14, 0.15, 0.17);
  pushBox(build, -0.52, -0.02, -2.78, 0.4, 0.4, 0.36, 0.14, 0.15, 0.17);

  // Swept fins, one quad each. Interior reference below the fin so both faces wind outward-ish;
  // fins are thin plates, so a single-sided plate is the honest low-poly choice here.
  pushQuadOut(build, 0.9, -0.1, -1.1, 1.9, 0.72, -2.5, 1.9, 0.52, -2.72, 0.9, -0.3, -1.3,
    0, -2, -1.8, r * 0.9, g * 0.9, b * 0.9);
  pushQuadOut(build, -0.9, -0.1, -1.1, -1.9, 0.72, -2.5, -1.9, 0.52, -2.72, -0.9, -0.3, -1.3,
    0, -2, -1.8, r * 0.9, g * 0.9, b * 0.9);

  pushLightPatch(build, 0, 0.06, 3.14, 0.9, 0.12, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, -0.02, -2.97, 1.4, 0.16, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);

  return build;
}

/** Archetype 2 — "commuter": a pale bus-like hull under a bubble canopy, the slow mid bands. */
function buildCommuter(): MeshBuild {
  const build = newBuild();
  const r = 0.07;
  const g = 0.076;
  const b = 0.085;

  pushBox(build, 0, -0.26, 0, 2.2, 0.72, 4.2, r, g, b);
  pushDome(build, 0, 0.06, 0.1, 1.02, 1.1, 1.9, 8, 3, 0.05, 0.09, 0.12);
  pushBox(build, 0.96, -0.74, -0.1, 0.26, 0.4, 2.6, 0.16, 0.17, 0.19);
  pushBox(build, -0.96, -0.74, -0.1, 0.26, 0.4, 2.6, 0.16, 0.17, 0.19);

  pushLightPatch(build, 0.62, -0.26, 2.11, 0.5, 0.26, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, -0.62, -0.26, 2.11, 0.5, 0.26, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, -0.26, -2.11, 1.5, 0.2, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);

  return build;
}

/** T7-5 variant — hunchback van: a tall rear box over a short sloped nose. */
function buildVan(): MeshBuild {
  const build = newBuild();
  const r = 0.085;
  const g = 0.08;
  const b = 0.075;
  pushBox(build, 0, 0, -0.3, 2.3, 1.1, 3.6, r, g, b);
  pushBox(build, 0, 0.95, -0.7, 2.1, 0.95, 2.6, r * 0.9, g * 0.9, b * 0.9);
  pushBox(build, 0, -0.15, 1.85, 2.1, 0.75, 0.9, r, g, b);
  pushBox(build, 0, 0.55, 1.2, 1.8, 0.35, 0.5, 0.04, 0.07, 0.1);
  pushBox(build, 1.2, -0.45, -0.4, 0.3, 0.45, 2.6, 0.15, 0.15, 0.16);
  pushBox(build, -1.2, -0.45, -0.4, 0.3, 0.45, 2.6, 0.15, 0.15, 0.16);
  pushLightPatch(build, 0.7, -0.1, 2.31, 0.45, 0.25, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, -0.7, -0.1, 2.31, 0.45, 0.25, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, 1.05, -2.11, 1.9, 0.18, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  return build;
}

/** T7-5 variant — saucer commuter: a flat disc with a raised dome and a lit rim. */
function buildSaucer(): MeshBuild {
  const build = newBuild();
  const r = 0.07;
  const g = 0.075;
  const b = 0.085;
  // Disc: a low dome above and an inverted shallow dome below, as two half-ellipsoids.
  pushDome(build, 0, 0, 0, 2.2, 0.45, 2.6, 12, 2, r, g, b);
  pushBox(build, 0, -0.18, 0, 2.6, 0.32, 3.0, r * 0.6, g * 0.6, b * 0.6);
  pushDome(build, 0, 0.3, -0.2, 0.95, 0.75, 1.2, 8, 3, 0.05, 0.1, 0.14);
  pushLightPatch(build, 0, -0.05, 1.52, 1.6, 0.14, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, -0.05, -1.52, 1.8, 0.16, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  return build;
}

/** T7-5 variant — long bus: an elongated box with a lit window strip down each side. */
function buildBus(): MeshBuild {
  const build = newBuild();
  const r = 0.09;
  const g = 0.085;
  const b = 0.07;
  pushBox(build, 0, 0, 0, 2.4, 1.6, 8.2, r, g, b);
  pushBox(build, 0, 0.95, -0.3, 2.0, 0.3, 6.6, r * 0.8, g * 0.8, b * 0.8);
  for (const side of [-1, 1]) {
    // Window strip: warm cabin light along the flank (planar patch facing out).
    pushQuadOut(build,
      side * 1.215, 0.15, -3.5,
      side * 1.215, 0.15, 3.3,
      side * 1.215, 0.6, 3.3,
      side * 1.215, 0.6, -3.5,
      0, 0.3, 0, 2.2, 1.5, 0.75);
  }
  pushLightPatch(build, 0.75, -0.3, 4.12, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, -0.75, -0.3, 4.12, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, 0.3, -4.12, 2.0, 0.22, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  return build;
}

/** Converts a build to a non-indexed, flat-shaded BufferGeometry and enforces the triangle budget. */
function toGeometry(build: MeshBuild, label: string): BufferGeometry {
  const triangles = buildTriangles(build);
  if (triangles === 0) fail('SKYRIVER_TRAFFIC_EMPTY_ARCHETYPE: ' + label);
  if (triangles > MAX_TRIANGLES_PER_ARCHETYPE) {
    fail('SKYRIVER_TRAFFIC_ARCHETYPE_OVER_BUDGET: ' + label + ' ' + String(triangles));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(build.position), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(build.normal), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(build.color), 3));
  geometry.computeBoundingSphere();
  return geometry;
}


/* ------------------------------------------------------------------------------------------------
 * Light streak batch: one instanced draw, two capsules (head, tail) per car.
 * ---------------------------------------------------------------------------------------------- */

const STREAK_VERTEX = /* glsl */ `
attribute vec2 aCorner;      // x: 0 lamp end, 1 trail end; y: side -1..1
attribute float aLamp;       // 0/2 head (left/right), 1/3 tail (left/right)
attribute vec3 aCarPos;
attribute vec4 aCarDir;      // xyz unit velocity, w speed (m/s)
attribute vec2 aCarFade;     // fade, body scale

uniform float uPixelAngle;   // radians per drawing-buffer pixel, vertically
uniform float uHeadOffset;
uniform float uTailOffset;
uniform float uHeadTrail;
uniform float uTailTrail;

varying vec2 vCapsule;       // x along in radius units, y across -1..1
varying float vLengthR;      // capsule body length in radius units
varying float vLamp;
varying float vIntensity;

#include <fog_pars_vertex>

void main() {
  vec3 dir = aCarDir.xyz;
  float speed = aCarDir.w;
  float kind = mod( aLamp, 2.0 );
  bool head = kind < 0.5;
  float lampSide = aLamp < 1.5 ? -1.0 : 1.0;
  vec3 rightW = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 1e-5 ) );
  float scale = aCarFade.y;
  vec3 lamp = aCarPos + ( dir * ( head ? uHeadOffset : -uTailOffset ) + rightW * lampSide * 0.72 ) * scale;
  float trail = 1.2 + speed * ( head ? uHeadTrail : uTailTrail );
  vec3 tailEnd = lamp - dir * trail;

  vec4 v0 = viewMatrix * vec4( lamp, 1.0 );
  vec4 v1 = viewMatrix * vec4( tailEnd, 1.0 );
  // Radius: a real lamp size up close, a pixel floor far away (~1.3 px radius).
  // T6R-2: 3-4x thicker at the lamp, tapering to a thread at the trail end.
  float r0 = max( 0.9, -v0.z * uPixelAngle * 3.4 );
  float r1 = max( 0.35, -v1.z * uPixelAngle * 1.1 );
  vec2 d = v1.xy - v0.xy;
  float len = length( d );
  vec2 axis = len > 1e-4 ? d / len : vec2( 0.0, -1.0 );
  vec2 side = vec2( -axis.y, axis.x );
  float rMean = 0.5 * ( r0 + r1 );

  float end = aCorner.x;
  float r = mix( r0, r1, end );
  vec4 v = mix( v0, v1, end );
  // Extend past both ends by the radius, so the quad covers the rounded caps.
  v.xy += axis * ( end * 2.0 - 1.0 ) * r + side * aCorner.y * r;

  vLengthR = len / rMean;
  vCapsule = vec2( mix( -1.0, vLengthR + 1.0, end ), aCorner.y );
  vLamp = kind;

  // Directional lamps: a headlight shows to the front, a taillight to the rear.
  vec3 toCam = normalize( cameraPosition - lamp );
  float facing = dot( dir, toCam ) * ( head ? 1.0 : -1.0 );
  // T7: the red tail trail reads from almost any angle (a long-exposure streak); the white head
  // lamp only toward the front, so crossing rivers read as red ribbons with white oncoming points.
  vIntensity = aCarFade.x * ( head ? smoothstep( 0.1, 0.7, facing ) : smoothstep( -0.85, 0.3, facing ) );
  // R11: up close the body's own lamp bar carries the read; the dot pair fades in with distance.
  vIntensity *= smoothstep( 140.0, 300.0, length( cameraPosition - lamp ) );

  #ifdef USE_FOG
    vFogDepth = - v.z;
    vSkyFogHeight = lamp.y;
  #endif
  gl_Position = projectionMatrix * v;
}
`;

const STREAK_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uFogPenetration;

varying vec2 vCapsule;
varying float vLengthR;
varying float vLamp;
varying float vIntensity;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}

void main() {
  float x = vCapsule.x;
  float along = clamp( x, 0.0, vLengthR );
  float dist = length( vec2( x - along, vCapsule.y ) );
  float body = exp( - dist * dist * 1.6 );
  float core = exp( - dist * dist * 10.0 );
  // Brightest at the lamp, fading down the trail.
  float t = vLengthR > 0.0 ? along / vLengthR : 0.0;
  // max(): with fast-math division t can land a hair above 1, and pow(negative) is NaN.
  // Head: a white-to-bright gradient that stays lit most of its length; tail: a red falloff.
  float trail = pow( max( 1.0 - t, 0.0 ), vLamp < 0.5 ? 0.7 : 1.2 );

  vec3 headColor = vec3( 1.0, 0.93, 0.82 );
  vec3 tailColor = vec3( 1.0, 0.07, 0.045 );
  vec3 lampColor = vLamp < 0.5 ? headColor : tailColor;
  vec3 color = ( lampColor * body + mix( lampColor, vec3( 1.0 ), 0.5 ) * core * 0.4 ) * trail;

  gl_FragColor = vec4( color * ( vIntensity * uIntensity ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #ifdef USE_FOG
    // Lights carry further through the rain than the concrete they pass: a softened fog curve.
    gl_FragColor.rgb *= pow( max( 1.0 - skyriverFogFactor(), 0.0 ), uFogPenetration );
  #endif
}
`;

function buildStreakGeometry(capacity: number): InstancedBufferGeometry {
  const corner: number[] = [];
  const lamp: number[] = [];
  const index: number[] = [];
  // T7-5: four lamps per car — a white head pair and a red tail pair (lamp id = kind + 2 * side).
  for (let l = 0; l < 4; l += 1) {
    const base = l * 4;
    for (const [end, side] of [[0, -1], [0, 1], [1, 1], [1, -1]] as const) {
      corner.push(end, side);
      lamp.push(l);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(16 * 3), 3));
  geometry.setAttribute('aCorner', new BufferAttribute(new Float32Array(corner), 2));
  geometry.setAttribute('aLamp', new BufferAttribute(new Float32Array(lamp), 1));
  geometry.setIndex(index);
  const pos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const dir = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const fade = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
  pos.setUsage(DynamicDrawUsage);
  dir.setUsage(DynamicDrawUsage);
  fade.setUsage(DynamicDrawUsage);
  geometry.setAttribute('aCarPos', pos);
  geometry.setAttribute('aCarDir', dir);
  geometry.setAttribute('aCarFade', fade);
  geometry.instanceCount = 0;
  return geometry;
}

/** Resolves either accepted time form to continuous seconds. */
function secondsOf(time: TrafficTime): number {
  const seconds = typeof time === 'number' ? time : (time.tick + time.alpha) / TRAFFIC_TICK_RATE_HZ;
  if (!Number.isFinite(seconds)) fail('SKYRIVER_TRAFFIC_TIME_INVALID');
  return seconds;
}

function assertQuality(quality: TrafficQuality, maxCarCount: number): void {
  if (!Number.isInteger(quality.carCount) || quality.carCount < 1) {
    fail('SKYRIVER_TRAFFIC_TIER_CARS_INVALID');
  }
  if (quality.carCount > maxCarCount) fail('SKYRIVER_TRAFFIC_TIER_OVER_MAX');
  if (!Number.isInteger(quality.thrusterBudget) || quality.thrusterBudget < 0) {
    fail('SKYRIVER_TRAFFIC_TIER_GLOW_INVALID');
  }
  if (quality.thrusterBudget > quality.carCount) fail('SKYRIVER_TRAFFIC_TIER_GLOW_OVER_CARS');
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Builds the traffic.
 *
 * Everything that costs real work happens here, once: the seeded parameter derivation, the river
 * assignment, the archetype geometry and the instance buffers. After this, a frame costs one
 * arithmetic pass over the active cars.
 */
export function createSkyriverTraffic(options: SkyriverTrafficOptions): SkyriverTraffic {
  if (TRAFFIC_TICK_RATE_HZ !== SKYRIVER_TICK_RATE) {
    // A silent mismatch here would make interpolated traffic drift against the shuttle.
    fail('SKYRIVER_TRAFFIC_TICK_RATE_MISMATCH');
  }

  const maxCarCount = options.maxCarCount ?? options.quality.carCount;
  if (!Number.isInteger(maxCarCount) || maxCarCount < 1 || maxCarCount > TRAFFIC_MAX_CARS) {
    fail('SKYRIVER_TRAFFIC_MAX_CARS_INVALID');
  }
  assertQuality(options.quality, maxCarCount);

  const bounds: TrafficBounds = options.bounds ?? CHASM_BOUNDS;
  const laneMinX = bounds.minX + WALL_MARGIN_M;
  const laneMaxX = bounds.maxX - WALL_MARGIN_M;
  if (laneMaxX <= laneMinX) fail('SKYRIVER_TRAFFIC_BOUNDS_TOO_SMALL');

  const params = deriveTrafficParams(options.seed, maxCarCount);

  const seedSalt = options.seed | 0;

  // ---- Per-car constants. Indexed by global car index, so a tier change recomputes nothing.
  const carHomeX = new Float32Array(maxCarCount);
  const carHomeY = new Float32Array(maxCarCount);
  const carPhase = new Float32Array(maxCarCount);
  const carSpeed = new Float32Array(maxCarCount);
  const carDirection = new Float32Array(maxCarCount);
  const carDriftA = new Float32Array(maxCarCount);
  const carDriftW = new Float32Array(maxCarCount);
  const carDriftP = new Float32Array(maxCarCount);
  const carClimbA = new Float32Array(maxCarCount);
  const carClimbW = new Float32Array(maxCarCount);
  const carClimbP = new Float32Array(maxCarCount);
  const sizeScale = new Float32Array(maxCarCount);
  /** R11: stream index per car, or 255 for a free floater. Chase cars use it as a nearest-stream rank. */
  const carStream = new Uint8Array(maxCarCount).fill(255);
  const carRow = new Float32Array(maxCarCount);
  const shareCumulative = STREAMS.reduce<number[]>((acc, st) => { acc.push((acc[acc.length - 1] ?? 0) + st[9]!); return acc; }, []);
  const tintR = new Float32Array(maxCarCount);
  const tintG = new Float32Array(maxCarCount);
  const tintB = new Float32Array(maxCarCount);

  const renderArchetype = new Uint8Array(maxCarCount);
  const archetypeTotals = new Int32Array(RENDER_ARCHETYPES);
  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = params.archetype[car];
    if (archetype >= TRAFFIC_ARCHETYPE_COUNT) fail('SKYRIVER_TRAFFIC_ARCHETYPE_OUT_OF_RANGE');
    const render = archetype + (hash01(car, 0x7e57) < VARIANT_SHARE ? TRAFFIC_ARCHETYPE_COUNT : 0);
    renderArchetype[car] = render;
    archetypeTotals[render] = archetypeTotals[render] + 1;
  }
  // Car indices grouped by archetype, each group ascending, so tier N is a prefix of every group.
  const groupCars: Int32Array[] = [];
  for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
    groupCars.push(new Int32Array(archetypeTotals[archetype]));
  }
  const groupFill = new Int32Array(RENDER_ARCHETYPES);

  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = renderArchetype[car]!;
    const group = groupCars[archetype];
    group[groupFill[archetype]] = car;
    groupFill[archetype] = groupFill[archetype] + 1;

    const h = (k: number): number => hash01(car ^ seedSalt, k);
    const chase = car >= ESCORT_COUNT && car < ESCORT_COUNT + CHASE_COUNT;
    carDirection[car] = h(0x11) < (chase ? 0.3 : 0.5) ? -1 : 1;
    if (chase) {
      // Chase band: mostly members of the streams nearest the shuttle (rank 0 or 1, re-picked each
      // frame), the rest free floaters at offsets kept off the shuttle's own line.
      if (h(0x41) < CHASE_STREAM_SHARE) {
        carStream[car] = h(0x42) < 0.65 ? 0 : 1;
        carRow[car] = h(0x43);
        carHomeX[car] = (h(0x21) * 2 - 1);
        carHomeY[car] = (h(0x22) * 2 - 1);
        carSpeed[car] = 0;
      } else {
        let lateral = (h(0x21) * 2 - 1) * 175;
        let lift = (h(0x22) * 2 - 1) * 70;
        if (Math.abs(lateral) < 35 && Math.abs(lift) < 20) lift = Math.sign(lift || 1) * (20 + h(0x23) * 30);
        if (lift < -10 && Math.abs(lateral) < 110) lateral = Math.sign(lateral || 1) * (110 + h(0x24) * 100);
        carHomeX[car] = lateral;
        carHomeY[car] = lift;
        carSpeed[car] = carDirection[car] > 0 ? 90 + h(0x25) * 110 : 60 + h(0x25) * 80;
      }
    } else if (h(0x41) < STREAM_SHARE) {
      const pick = h(0x42) * shareCumulative[shareCumulative.length - 1]!;
      let stream = 0;
      while (stream < STREAMS.length - 1 && shareCumulative[stream]! <= pick) stream += 1;
      const st = STREAMS[stream]!;
      carStream[car] = stream;
      carDirection[car] = st[2]!;
      carRow[car] = h(0x43);
      carHomeX[car] = (h(0x21) * 2 - 1);
      carHomeY[car] = (h(0x22) * 2 - 1);
      carSpeed[car] = st[5]!;
    } else {
      carHomeX[car] = (h(0x21) * 2 - 1) * CAR_CORRIDOR_HALF_M;
      carHomeY[car] = CAR_MIN_Y_M + Math.pow(h(0x22), 0.9) * (CAR_MAX_Y_M - CAR_MIN_Y_M);
      carSpeed[car] = Math.abs(params.speed[car]!) * SPEED_SCALE * (0.8 + 0.4 * h(0x25));
    }
    carPhase[car] = params.phase[car]!;
    if (carStream[car] !== 255 && !chase) {
      // Density pulses: squeeze the phase into clumps of varying fill, one set per stream.
      const st = STREAMS[carStream[car]!]!;
      const pulses = st[8]!;
      const slot = carPhase[car]! * pulses;
      const pulse = Math.floor(slot);
      const fill = 0.22 + 0.4 * hash01(carStream[car]! * 97 + pulse, 0x9a11);
      const offset = hash01(carStream[car]! * 131 + pulse, 0x9a12) * (1 - fill);
      carPhase[car] = (pulse + offset + Math.pow(slot - pulse, 0.8) * fill) / pulses;
    }
    carDriftA[car] = DRIFT_MIN_M + h(0x31) * DRIFT_SPAN_M;
    carDriftW[car] = 0.05 + h(0x32) * 0.13;
    carDriftP[car] = h(0x33) * TAU;
    carClimbA[car] = CLIMB_MIN_M + h(0x34) * CLIMB_SPAN_M;
    carClimbW[car] = 0.04 + h(0x35) * 0.12;
    carClimbP[car] = h(0x36) * TAU;
    sizeScale[car] = chase
      ? CHASE_SIZE_MIN + hash01(car, 0x4e8d) * CHASE_SIZE_SPAN
      : SIZE_MIN_SCALE + hash01(car, 0x4e8d) * SIZE_SCALE_SPAN;

    // Dark paint: gunmetal, oxblood, deep teal, near-black. The lamps carry the colour.
    const paint = hash01(car, 0x33b1);
    const level = 0.8 + hash01(car, 0x1771) * 0.4;
    if (paint < 0.4) {
      tintR[car] = level; tintG[car] = level; tintB[car] = level * 1.1;
    } else if (paint < 0.65) {
      tintR[car] = level * 1.5; tintG[car] = level * 0.55; tintB[car] = level * 0.55;
    } else if (paint < 0.85) {
      tintR[car] = level * 0.6; tintG[car] = level * 1.05; tintB[car] = level * 1.25;
    } else {
      tintR[car] = level * 0.55; tintG[car] = level * 0.55; tintB[car] = level * 0.6;
    }
  }

  // ---- Geometry, materials, meshes.
  const carMaterial = new MeshBasicMaterial({ vertexColors: true, fog: true });
  carMaterial.name = 'skyriver.traffic.hull';
  // T6R: the shared fog was never wired to the hulls, so distant cars stayed full-bright pills.
  applySkyriverFog(carMaterial);

  const archetypeBuilds: MeshBuild[] = [buildCab(), buildInterceptor(), buildCommuter(), buildVan(), buildSaucer(), buildBus()];
  const archetypeLabels: string[] = ['cab', 'interceptor', 'commuter', 'van', 'saucer', 'bus'];
  const trianglesPerArchetype: number[] = [];
  const geometries: BufferGeometry[] = [];
  const meshes: InstancedMesh[] = [];
  const matrixArrays: Float32Array[] = [];
  const colorArrays: Float32Array[] = [];

  for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
    const build = archetypeBuilds[archetype];
    const label = archetypeLabels[archetype];
    trianglesPerArchetype.push(buildTriangles(build));
    const geometry = toGeometry(build, label);
    geometries.push(geometry);

    const capacity = Math.max(1, archetypeTotals[archetype]);
    const mesh = new InstancedMesh(geometry, carMaterial, capacity);
    mesh.name = 'skyriver.traffic.' + label;
    // Every matrix changes per frame across the whole canyon; culling the batch is never a win.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    instanceColor.setUsage(DynamicDrawUsage);
    mesh.instanceColor = instanceColor;
    mesh.count = 0;
    meshes.push(mesh);
    matrixArrays.push(mesh.instanceMatrix.array as Float32Array);
    colorArrays.push(instanceColor.array as Float32Array);
  }

  const streakCapacity = Math.max(1, options.maxThrusterBudget ?? options.quality.thrusterBudget);
  const streakGeometry = buildStreakGeometry(streakCapacity);
  const streakMaterial = new ShaderMaterial({
    name: 'skyriver.traffic.streaks',
    vertexShader: STREAK_VERTEX,
    fragmentShader: STREAK_FRAGMENT,
    uniforms: {
      uPixelAngle: { value: 0.0012 },
      uHeadOffset: { value: HEAD_OFFSET_M },
      uTailOffset: { value: TAIL_OFFSET_M },
      uHeadTrail: { value: HEAD_TRAIL_S },
      uTailTrail: { value: TAIL_TRAIL_S },
      // T7: dense crossing ribbons overlap several trails per pixel; bloom supplies the glow.
      uIntensity: { value: 1.7 },
      uFogPenetration: { value: 0.2 },
      ...skyriverFogUniforms(),
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    // The capsule is built in view space and its winding flips with the projected axis: never cull.
    side: DoubleSide,
    fog: true,
  });
  applySkyriverFog(streakMaterial);
  const streakMesh = new Mesh(streakGeometry, streakMaterial);
  streakMesh.name = 'skyriver.traffic.streaks';
  streakMesh.frustumCulled = false;
  // Additive light on top of the opaque city and hulls.
  streakMesh.renderOrder = 10;
  const streakPos = streakGeometry.getAttribute('aCarPos') as InstancedBufferAttribute;
  const streakDir = streakGeometry.getAttribute('aCarDir') as InstancedBufferAttribute;
  const streakFade = streakGeometry.getAttribute('aCarFade') as InstancedBufferAttribute;
  const streakPosArray = streakPos.array as Float32Array;
  const streakDirArray = streakDir.array as Float32Array;
  const streakFadeArray = streakFade.array as Float32Array;

  const objects: Object3D[] = [...meshes, streakMesh];

  // T6R-2 escorts: the first ESCORT_COUNT cars fly with the shuttle (the anchor) instead of a
  // river, so the chase view always holds a few close vehicles with readable dark bodies and long
  // trails. Offsets are a pure function of time; the anchor is the presented shuttle pose.
  const anchor = new Float64Array(8); // x, y, z, forward x, forward z, speed, canyon v, canyon x
  let anchorValid = false;
  function setAnchor(x: number, y: number, z: number, yawTurns: number, speed: number, canyonV = z, canyonX = x): void {
    anchor[0] = x;
    anchor[1] = y;
    anchor[2] = z;
    anchor[3] = Math.sin(yawTurns * TAU);
    anchor[4] = Math.cos(yawTurns * TAU);
    anchor[5] = speed;
    anchor[6] = canyonV;
    anchor[7] = canyonX;
    anchorValid = true;
  }
  const carWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  const carDir = { x: 0, z: 0 };

  // ---- Mutable tier state. Written by setQuality(), read by the hot loop.
  const groupActive = new Int32Array(RENDER_ARCHETYPES);
  let activeCars = 0;
  let streakBudget = 0;
  let streaksUsed = 0;

  const invDimRangeSq = 1 / (DISTANCE_DIM_RANGE_M * DISTANCE_DIM_RANGE_M);

  // ---- R11 stream geometry: centre (x across, y) of stream k at canyon arc length v.
  const streamScratch = new Float64Array(2);
  const streamRank = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, STREAMS.length);
  const streamRankDist = new Float64Array(STREAMS.length);
  function swapWeight(v: number, at: number): number {
    let d = (v - at) % CANYON_LOOP_LENGTH_M;
    if (d < 0) d += CANYON_LOOP_LENGTH_M;
    const half = CANYON_LOOP_LENGTH_M * 0.5;
    return smoothstep(0, INTERCHANGE_RAMP_M, d) * (1 - smoothstep(half, half + INTERCHANGE_RAMP_M, d));
  }
  function streamCentre(k: number, v: number, out: Float64Array): void {
    const st = STREAMS[k]!;
    let x = st[0]!;
    let y = st[1]!;
    for (const [a, b, at] of INTERCHANGES) {
      if (k !== a && k !== b) continue;
      const partner = STREAMS[k === a ? b : a]!;
      const w = swapWeight(v, at);
      x += (partner[0]! - x) * w;
      y += (partner[1]! - y) * w;
    }
    out[0] = x + st[6]! * Math.sin((TAU * v) / (1800 + k * 230) + k * 1.3);
    out[1] = y + st[7]! * Math.sin((TAU * v) / (1300 + k * 170) + k * 2.1);
  }

  function setQuality(quality: TrafficQuality): void {
    assertQuality(quality, maxCarCount);
    if (quality.thrusterBudget > streakCapacity) fail('SKYRIVER_TRAFFIC_TIER_GLOW_OVER_CAPACITY');

    activeCars = quality.carCount;
    streakBudget = quality.thrusterBudget;

    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      const group = groupCars[archetype];
      let active = 0;
      while (active < group.length && group[active] < activeCars) active += 1;
      groupActive[archetype] = active;
      meshes[archetype].count = active;
    }
  }

  /**
   * Re-evaluates every active car: one wrap, one sine for the bob, one matrix write, and one streak
   * record. Allocates nothing.
   */
  function update(time: TrafficTime, camera: TrafficPoint): void {
    const t = secondsOf(time);
    const camX = camera.x;
    const camY = camera.y;
    const camZ = camera.z;
    streaksUsed = 0;
    // Chase cars join the streams nearest the shuttle: rank the stream shelves by height at its v.
    if (anchorValid) {
      for (let k = 0; k < STREAMS.length; k += 1) {
        streamCentre(k, anchor[6]!, streamScratch);
        streamRankDist[k] = Math.abs(streamScratch[1]! - anchor[1]!) + Math.abs(streamScratch[0]! - anchor[7]!) * 0.3;
        streamRank[k] = k;
      }
      streamRank.sort((a, b) => streamRankDist[a]! - streamRankDist[b]!);
    }

    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      const group = groupCars[archetype];
      const active = groupActive[archetype];
      const matrices = matrixArrays[archetype];
      const colors = colorArrays[archetype];

      for (let slot = 0; slot < active; slot += 1) {
        const car = group[slot];
        let direction = carDirection[car]!;
        let speed = carSpeed[car]!;
        let fade = 1;
        let streakSpeed = speed;
        let bank = 0;

        let px: number;
        let py: number;
        let pz: number;
        let fx: number;
        let fy = 0;
        let fz: number;
        if (car < ESCORT_COUNT && anchorValid) {
          const e = car * 4;
          const lateral = ESCORTS[e]!;
          const lift = ESCORTS[e + 1]!;
          let forward: number;
          let heading = 1;
          if (car === ESCORT_COUNT - 1) {
            forward = 520 - ((t * 330) % 1040);
            heading = -1;
          } else {
            forward = ESCORTS[e + 2]! + ESCORTS[e + 3]! * Math.sin(t * (0.13 + car * 0.04) + car * 1.7);
          }
          const ax = anchor[3]!;
          const az = anchor[4]!;
          px = anchor[0]! + ax * forward + az * lateral;
          py = anchor[1]! + lift + Math.sin(t * 0.9 + car) * 1.2;
          pz = anchor[2]! + az * forward - ax * lateral;
          fx = ax * heading;
          fz = az * heading;
          bank = 0.12 * Math.sin(t * 0.6 + car);
          streakSpeed = (heading > 0 ? anchor[5]! : 170) * ESCORT_STREAK_SCALE;
        } else {
          // Organic motion in canyon space: drift across, climb/dive, travel along the loop.
          const driftArg = t * carDriftW[car]! + carDriftP[car]!;
          const climbArg = t * carClimbW[car]! + carClimbP[car]!;
          const drift = carDriftA[car]! * Math.sin(driftArg);
          const driftRate = carDriftA[car]! * carDriftW[car]! * Math.cos(driftArg);
          const climb = carClimbA[car]! * Math.sin(climbArg);
          const climbRate = carClimbA[car]! * carClimbW[car]! * Math.cos(climbArg);
          let v: number;
          let x: number;
          let y: number;
          const isChase = car < ESCORT_COUNT + CHASE_COUNT && anchorValid;
          let streamSlope = 0;
          let inStream = false;
          let jink = 0;
          if (carStream[car]! !== 255 && (anchorValid || !isChase)) {
            // Stream member: the stream sets direction, speed band, shelf and corridor.
            inStream = true;
            const k = isChase ? streamRank[carStream[car]!]! : carStream[car]!;
            const st = STREAMS[k]!;
            direction = st[2]!;
            speed = st[5]! * (0.9 + 0.2 * carRow[car]!);
            const surgeArg = t * (0.3 + 0.25 * carRow[car]!) + carPhase[car]! * 97.0;
            const surge = SURGE_M * Math.sin(surgeArg);
            if (isChase) {
              const absolute = carPhase[car]! * CHASE_WINDOW_M + direction * speed * t + surge;
              let rel = (absolute - anchor[6]! + CHASE_WINDOW_M * 0.5) % CHASE_WINDOW_M;
              if (rel < 0) rel += CHASE_WINDOW_M;
              rel -= CHASE_WINDOW_M * 0.5;
              fade = smoothstep(0, CHASE_FADE_M, CHASE_WINDOW_M * 0.5 - Math.abs(rel));
              v = anchor[6]! + rel;
            } else {
              v = carPhase[car]! * CANYON_LOOP_LENGTH_M + direction * st[5]! * t + surge;
            }
            streamCentre(k, v, streamScratch);
            const cx = streamScratch[0]!;
            const cy = streamScratch[1]!;
            streamCentre(k, v + 4, streamScratch);
            streamSlope = (streamScratch[0]! - cx) / 4;
            const rows = st[3]!;
            const rowIndex = Math.min(rows - 1, Math.floor(carRow[car]! * rows));
            const spacing = st[4]! / Math.max(1, rows - 1);
            const rowOffset = (rowIndex - (rows - 1) / 2) * spacing;
            x = clamp(cx + rowOffset + carHomeX[car]! * spacing * 0.3 + 3 * Math.sin(driftArg),
              -CAR_CORRIDOR_HALF_M, CAR_CORRIDOR_HALF_M);
            y = cy + (rowIndex % 2 === 0 ? -3 : 3) + carHomeY[car]! * 3 + 2 * Math.sin(climbArg);
            jink = JINK_RAD * Math.sin(t * (0.5 + 0.4 * carRow[car]!) + carPhase[car]! * 53.0);
          } else if (isChase) {
            // Free floater near the shuttle.
            const absolute = carPhase[car]! * CHASE_WINDOW_M + direction * speed * t;
            let rel = (absolute - anchor[6]! + CHASE_WINDOW_M * 0.5) % CHASE_WINDOW_M;
            if (rel < 0) rel += CHASE_WINDOW_M;
            rel -= CHASE_WINDOW_M * 0.5;
            fade = smoothstep(0, CHASE_FADE_M, CHASE_WINDOW_M * 0.5 - Math.abs(rel));
            v = anchor[6]! + rel;
            x = clamp(routeLateral(v) + carHomeX[car]! + drift * 0.6, -CAR_CORRIDOR_HALF_M, CAR_CORRIDOR_HALF_M);
            y = routeAltitude(v) + carHomeY[car]! + climb * 0.6;
          } else {
            v = carPhase[car]! * CANYON_LOOP_LENGTH_M + direction * speed * t;
            x = clamp(carHomeX[car]! + drift, -CAR_CORRIDOR_HALF_M, CAR_CORRIDOR_HALF_M);
            y = carHomeY[car]! + climb;
          }
          warpCanyon(x, v, carWarp);
          px = carWarp.x;
          py = y;
          pz = carWarp.z;
          // Velocity in canyon space (across, along), then turned to world.
          const along = direction * speed;
          const vx = inStream ? (streamSlope + Math.tan(jink)) * along : driftRate;
          if (inStream) streakSpeed = speed;
          warpDirection(vx, along, carWarp.heading, carDir);
          const horizontal = Math.hypot(carDir.x, carDir.z) || 1;
          fx = carDir.x / horizontal;
          fz = carDir.z / horizontal;
          fy = inStream ? 0 : climbRate / Math.max(20, speed);
          // Bank into the drift (free) or the jink (stream): lateral acceleration over speed.
          bank = inStream
            ? clamp(jink * 3.0 * direction, -0.25, 0.25)
            : clamp((-carDriftA[car]! * carDriftW[car]! * carDriftW[car]! * Math.sin(driftArg)) / Math.max(20, speed) * 40 * direction, -0.45, 0.45);
        }

        const toCarX = px - camX;
        const toCarY = py - camY;
        const toCarZ = pz - camZ;
        // T7 hull LOD: past HULL_DRAW_DISTANCE_M a body is a few pixels that only bites dark beads
        // out of the ribbon behind it, so it collapses to nothing and the light carries the read.
        const hullVisible = toCarX * toCarX + toCarY * toCarY + toCarZ * toCarZ < HULL_DRAW_DISTANCE_M * HULL_DRAW_DISTANCE_M;

        // Basis: forward f (with a little pitch), right = f x up, then banked about f.
        const scale = hullVisible ? sizeScale[car]! : 0;
        const pitchY = clamp(fy, -0.35, 0.35);
        const fl = Math.sqrt(1 + pitchY * pitchY);
        const f0 = fx / fl;
        const f1 = pitchY / fl;
        const f2 = fz / fl;
        // right0 = normalize(up x f) in the horizontal plane: (fz, 0, -fx)
        const r0x = fz;
        const r0z = -fx;
        // up0 = f x right0
        const u0x = f1 * r0z;
        const u0y = f2 * r0x - f0 * r0z;
        const u0z = -f1 * r0x;
        const cb = Math.cos(bank);
        const sb = Math.sin(bank);
        const rx = (r0x * cb + u0x * sb) * scale;
        const ry = (u0y * sb) * scale;
        const rz = (r0z * cb + u0z * sb) * scale;
        const ux = (u0x * cb - r0x * sb) * scale;
        const uy = (u0y * cb) * scale;
        const uz = (u0z * cb - r0z * sb) * scale;
        const offset = slot * 16;
        matrices[offset] = rx;
        matrices[offset + 1] = ry;
        matrices[offset + 2] = rz;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = ux;
        matrices[offset + 5] = uy;
        matrices[offset + 6] = uz;
        matrices[offset + 7] = 0;
        matrices[offset + 8] = f0 * scale;
        matrices[offset + 9] = f1 * scale;
        matrices[offset + 10] = f2 * scale;
        matrices[offset + 11] = 0;
        matrices[offset + 12] = px;
        matrices[offset + 13] = py;
        matrices[offset + 14] = pz;
        matrices[offset + 15] = 1;

        const dx = px - camX;
        const dy = py - camY;
        const dz = pz - camZ;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const dim = (1 - (1 - DISTANCE_DIM_FLOOR) * Math.min(1, distanceSq * invDimRangeSq)) * fade;
        const colorOffset = slot * 3;
        colors[colorOffset] = tintR[car] * dim;
        colors[colorOffset + 1] = tintG[car] * dim;
        colors[colorOffset + 2] = tintB[car] * dim;

        if (streaksUsed < streakBudget) {
          const p = streaksUsed * 3;
          streakPosArray[p] = px;
          streakPosArray[p + 1] = py;
          streakPosArray[p + 2] = pz;
          const d = streaksUsed * 4;
          streakDirArray[d] = fx;
          streakDirArray[d + 1] = fy;
          streakDirArray[d + 2] = fz;
          streakDirArray[d + 3] = streakSpeed;
          streakFadeArray[streaksUsed * 2] = fade;
          streakFadeArray[streaksUsed * 2 + 1] = sizeScale[car]!;
          streaksUsed += 1;
        }
      }

      const mesh = meshes[archetype];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }

    streakGeometry.instanceCount = streaksUsed;
    streakPos.needsUpdate = true;
    streakDir.needsUpdate = true;
    streakFade.needsUpdate = true;
  }

  /** Radians per drawing-buffer pixel, vertically. The scene calls this on resize. */
  function setPixelAngle(radiansPerPixel: number): void {
    streakMaterial.uniforms.uPixelAngle!.value = radiansPerPixel;
  }

  function stats(): TrafficStats {
    let triangles = 0;
    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      triangles += trianglesPerArchetype[archetype] * groupActive[archetype];
    }
    triangles += streaksUsed * 8;
    return {
      activeCars,
      activeThrusters: streaksUsed,
      drawCalls: TRAFFIC_DRAW_CALLS,
      trianglesPerArchetype,
      trianglesDrawn: triangles,
      glowRadiusM: 0,
    };
  }

  function dispose(): void {
    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      meshes[archetype].dispose();
      geometries[archetype].dispose();
    }
    streakGeometry.dispose();
    carMaterial.dispose();
    streakMaterial.dispose();
  }

  setQuality(options.quality);

  return { objects, update, setQuality, setPixelAngle, setAnchor, stats, dispose };
}
