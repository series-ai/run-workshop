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

import { deriveTrafficParams, TRAFFIC_ARCHETYPE_COUNT, TRAFFIC_MAX_CARS, TRAFFIC_MAX_ALTITUDE_M, TRAFFIC_MIN_ALTITUDE_M } from '../sim/derive';
import { CHASM_BOUNDS, SKYRIVER_TICK_RATE } from '../sim/systems';

import {
  SKYRIVER_OUTPUT_APPLY_GLSL,
  SKYRIVER_OUTPUT_PARS_GLSL,
  applySkyriverFog,
  skyriverFogUniforms,
} from './atmosphere';
import { TRACK_BASE_Y_M } from './flightPresentation';
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
const TRAFFIC_DRAW_CALLS = TRAFFIC_ARCHETYPE_COUNT + 1;

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

/** Rivers along the canyon, and rivers crossing it through the tower-row gaps. */
const ALONG_RIVERS = 20;
const CROSS_RIVERS = 10;
/** Share of cars on crossing rivers. */
const CROSS_SHARE = 0.16;
/** Along-canyon wrap span, metres: the presented canyon runs to |z| ~ 2700; the fade hides the seam. */
const ALONG_HALF_SPAN_M = 3400;
/** Crossing wrap span, metres, centred on the corridor. */
const CROSS_HALF_SPAN_M = 1500;
/** Fade-in/out distance at the wrap ends, metres. */
const WRAP_FADE_M = 700;
/** Inset from the corridor walls, metres. Inner tower faces sit at |x| >= 440. */
const WALL_MARGIN_M = 18;
/** Drawn altitude range of the rivers, metres. The top stays under the skybridges (>= 1900 m). */
/** T6R-2: no river skims the canyon bottom — a low layer of lights read as a floor plane. */
const RIVER_MIN_Y_M = 240;
const RIVER_MAX_Y_M = 1820;
/** Tight in-river scatter, metres, so a river reads as one stream. */
const RIVER_LATERAL_SCATTER_M = 7;
const RIVER_VERTICAL_SCATTER_M = 5;
/** Platoons per river, and how much of each platoon slot the cars occupy. */
const RIVER_PLATOONS = 11;
const PLATOON_FILL = 0.3;
/** Derived speeds (30..90 m/s) are scaled up: rivers must visibly stream past a 150 m/s shuttle. */
const SPEED_SCALE = 1.7;
/** Keep rivers out of the autopilot's own airspace so cars do not fly through the shuttle. */
/** T6R-2 road-read fix: along-canyon rivers start above the autopilot track's highest swell. */
const ALONG_MIN_Y_M = TRACK_BASE_Y_M + 300;
/** Rivers in the same altitude layer share a direction, so red and white never pair side by side. */
const DIRECTION_LAYER_M = 170;
/** Crossing rows sit at the gaps between derived tower rows (centres every 320 m). */
const ROW_PITCH_M = 320;

/** Escort cars: [lateral, lift, forward mean, forward swing] in metres, shuttle frame. */
const ESCORT_COUNT = 4;
const ESCORTS: readonly number[] = Object.freeze([
  -34, 6, 60, 38,
  40, -9, 22, 30,
  -72, 24, 150, 70,
  82, 16, 0, 0,
]);

/** Per-car size jitter, so a batch of identical hulls does not read as a clone army. */
const SIZE_MIN_SCALE = 0.95;
const SIZE_SCALE_SPAN = 0.35;

/** Distance dimming of the hull tint: far hulls sink into the haze. */
const DISTANCE_DIM_RANGE_M = 900;
const DISTANCE_DIM_FLOOR = 0.42;

/** Streak tuning: lamp offsets from the car centre, metres; trail seconds of motion. */
const HEAD_OFFSET_M = 2.4;
const TAIL_OFFSET_M = 2.5;
/** T6R-2: long continuous trails (platoon-mates' trails overlap into one ribbon), never dashes. */
const TAIL_TRAIL_S = 1.1;
const HEAD_TRAIL_S = 0.9;

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

/** 1-D value noise in [-1, 1] along lane `lane`, smoothstep-interpolated between integer samples. */
function valueNoise(lane: number, t: number): number {
  const cell = Math.floor(t);
  const f = t - cell;
  const smooth = f * f * (3 - 2 * f);
  const a = hash01(lane, cell);
  const b = hash01(lane, cell + 1);
  return (a + (b - a) * smooth) * 2 - 1;
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
const HEADLIGHT_R = 0.86;
const HEADLIGHT_G = 0.95;
const HEADLIGHT_B = 1;
const TAILLIGHT_R = 1;
const TAILLIGHT_G = 0.22;
const TAILLIGHT_B = 0.18;
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
  pushLightPatch(build, 0.62, 0.1, -2.21, 0.46, 0.26, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  pushLightPatch(build, -0.62, 0.1, -2.21, 0.46, 0.26, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);

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
  pushLightPatch(build, 0.52, -0.02, -2.97, 0.32, 0.32, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  pushLightPatch(build, -0.52, -0.02, -2.97, 0.32, 0.32, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);

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
attribute float aLamp;       // 0 head, 1 tail
attribute vec3 aCarPos;
attribute vec4 aCarDir;      // xyz unit velocity, w speed (m/s)
attribute float aCarFade;

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
  bool head = aLamp < 0.5;
  vec3 lamp = aCarPos + dir * ( head ? uHeadOffset : -uTailOffset );
  float trail = 1.2 + speed * ( head ? uHeadTrail : uTailTrail );
  vec3 tailEnd = lamp - dir * trail;

  vec4 v0 = viewMatrix * vec4( lamp, 1.0 );
  vec4 v1 = viewMatrix * vec4( tailEnd, 1.0 );
  // Radius: a real lamp size up close, a pixel floor far away (~1.3 px radius).
  // T6R-2: 3-4x thicker at the lamp, tapering to a thread at the trail end.
  float r0 = max( 0.7, -v0.z * uPixelAngle * 4.5 );
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
  vLamp = aLamp;

  // Directional lamps: a headlight shows to the front, a taillight to the rear.
  vec3 toCam = normalize( cameraPosition - lamp );
  float facing = dot( dir, toCam ) * ( head ? 1.0 : -1.0 );
  vIntensity = aCarFade * smoothstep( -0.35, 0.5, facing );

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
  float trail = pow( 1.0 - t, 1.3 );

  vec3 headColor = vec3( 1.0, 0.93, 0.82 );
  vec3 tailColor = vec3( 1.0, 0.07, 0.045 );
  vec3 lampColor = vLamp < 0.5 ? headColor : tailColor;
  vec3 color = ( lampColor * body + mix( lampColor, vec3( 1.0 ), 0.5 ) * core * 0.4 ) * trail;

  gl_FragColor = vec4( color * ( vIntensity * uIntensity ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #ifdef USE_FOG
    // Lights carry further through the rain than the concrete they pass: a softened fog curve.
    gl_FragColor.rgb *= pow( 1.0 - skyriverFogFactor(), uFogPenetration );
  #endif
}
`;

function buildStreakGeometry(capacity: number): InstancedBufferGeometry {
  const corner: number[] = [];
  const lamp: number[] = [];
  const index: number[] = [];
  for (let l = 0; l < 2; l += 1) {
    const base = l * 4;
    for (const [end, side] of [[0, -1], [0, 1], [1, 1], [1, -1]] as const) {
      corner.push(end, side);
      lamp.push(l);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(8 * 3), 3));
  geometry.setAttribute('aCorner', new BufferAttribute(new Float32Array(corner), 2));
  geometry.setAttribute('aLamp', new BufferAttribute(new Float32Array(lamp), 1));
  geometry.setIndex(index);
  const pos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const dir = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const fade = new InstancedBufferAttribute(new Float32Array(capacity), 1);
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

  // ---- Rivers: lane position, altitude, axis and direction. Derived from the seed by hashing.
  const riverCount = ALONG_RIVERS + CROSS_RIVERS;
  const riverLane = new Float32Array(riverCount);
  const riverY = new Float32Array(riverCount);
  const riverDirection = new Float32Array(riverCount);
  const riverSpeedScale = new Float32Array(riverCount);
  const seedSalt = options.seed | 0;
  for (let river = 0; river < riverCount; river += 1) {
    const along = river < ALONG_RIVERS;
    riverDirection[river] = river % 2 === 0 ? 1 : -1;
    riverSpeedScale[river] = 0.85 + 0.3 * hash01(seedSalt ^ 0x5eed, river * 7 + 1);
    if (along) {
      // Fifth Element layers, T6R-2: every along-canyon river flies above the autopilot band, at
      // many heights and lateral offsets. A stream converging on the vanishing point *below* the
      // shuttle reads as a road marking however it is drawn, so below the shuttle only crossing
      // rivers run (they cut across the view and never converge).
      const layer = (river + hash01(seedSalt, river * 3 + 2) * 0.8) / ALONG_RIVERS;
      const y = ALONG_MIN_Y_M + layer * (RIVER_MAX_Y_M - ALONG_MIN_Y_M);
      // Lanes stratified across the corridor (golden-ratio sequence), so both sides carry rivers.
      const laneFraction = (0.5 + river * 0.6180339887 + hash01(seedSalt, river * 3 + 1) * 0.08) % 1;
      const x = laneMinX + laneFraction * (laneMaxX - laneMinX);
      riverLane[river] = x;
      riverY[river] = clamp(y, RIVER_MIN_Y_M, RIVER_MAX_Y_M);
      riverDirection[river] = Math.floor(riverY[river] / DIRECTION_LAYER_M) % 2 === 0 ? 1 : -1;
    } else {
      // Crossing rivers ride the gap between two tower rows, deep down or high up.
      const crossIndex = river - ALONG_RIVERS;
      const row = Math.floor(hash01(seedSalt, river * 5 + 3) * 10) - 5;
      riverLane[river] = (row + 0.5) * ROW_PITCH_M;
      const high = crossIndex % 2 === 0;
      const y = high
        ? 1050 + hash01(seedSalt, river * 5 + 4) * 700
        : 90 + hash01(seedSalt, river * 5 + 4) * 230;
      riverY[river] = clamp(y, RIVER_MIN_Y_M, RIVER_MAX_Y_M);
    }
  }

  // ---- Per-car constants. Indexed by global car index, so a tier change recomputes nothing.
  const carRiver = new Uint16Array(maxCarCount);
  const carOffsetLateral = new Float32Array(maxCarCount);
  const carOffsetY = new Float32Array(maxCarCount);
  const carPhase = new Float32Array(maxCarCount);
  const carSpeed = new Float32Array(maxCarCount);
  const carBob = new Float32Array(maxCarCount);
  const sizeScale = new Float32Array(maxCarCount);
  const tintR = new Float32Array(maxCarCount);
  const tintG = new Float32Array(maxCarCount);
  const tintB = new Float32Array(maxCarCount);

  const archetypeTotals = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);
  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = params.archetype[car];
    if (archetype >= TRAFFIC_ARCHETYPE_COUNT) fail('SKYRIVER_TRAFFIC_ARCHETYPE_OUT_OF_RANGE');
    archetypeTotals[archetype] = archetypeTotals[archetype] + 1;
  }
  // Car indices grouped by archetype, each group ascending, so tier N is a prefix of every group.
  const groupCars: Int32Array[] = [];
  for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
    groupCars.push(new Int32Array(archetypeTotals[archetype]));
  }
  const groupFill = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);

  const altitudeSpan = TRAFFIC_MAX_ALTITUDE_M - TRAFFIC_MIN_ALTITUDE_M;
  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = params.archetype[car];
    const group = groupCars[archetype];
    group[groupFill[archetype]] = car;
    groupFill[archetype] = groupFill[archetype] + 1;

    // River choice: the derived band picks the altitude stratum, the lane the river within it.
    const crossing = hash01(car, 0xc205) < CROSS_SHARE;
    let river: number;
    if (crossing) {
      river = ALONG_RIVERS + Math.min(CROSS_RIVERS - 1, Math.floor(hash01(car, 0x7a11) * CROSS_RIVERS));
    } else {
      const stratum = (params.altitude[car] - TRAFFIC_MIN_ALTITUDE_M) / altitudeSpan;
      const jitter = (params.lane[car] * 0.5) * (4 / ALONG_RIVERS);
      river = Math.min(ALONG_RIVERS - 1, Math.max(0, Math.floor((stratum + jitter) * ALONG_RIVERS)));
    }
    carRiver[car] = river;
    carOffsetLateral[car] = params.lane[car] * RIVER_LATERAL_SCATTER_M;
    carOffsetY[car] = (hash01(car, 0x2f3b) * 2 - 1) * RIVER_VERTICAL_SCATTER_M;
    // Platoons: squeeze the derived phase into PLATOON_FILL of each platoon slot.
    const slot = params.phase[car] * RIVER_PLATOONS;
    const platoon = Math.floor(slot);
    carPhase[car] = (platoon + (slot - platoon) * PLATOON_FILL) / RIVER_PLATOONS;
    carSpeed[car] = Math.abs(params.speed[car]) * SPEED_SCALE * riverSpeedScale[river]
      * (0.94 + 0.12 * hash01(car, 0x51ed));
    carBob[car] = hash01(car, 0x7a17) * TAU;
    sizeScale[car] = SIZE_MIN_SCALE + hash01(car, 0x4e8d) * SIZE_SCALE_SPAN;

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

  const archetypeBuilds: MeshBuild[] = [buildCab(), buildInterceptor(), buildCommuter()];
  const archetypeLabels: string[] = ['cab', 'interceptor', 'commuter'];
  const trianglesPerArchetype: number[] = [];
  const geometries: BufferGeometry[] = [];
  const meshes: InstancedMesh[] = [];
  const matrixArrays: Float32Array[] = [];
  const colorArrays: Float32Array[] = [];

  for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
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
      uIntensity: { value: 2.4 },
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

  const objects: Object3D[] = [meshes[0], meshes[1], meshes[2], streakMesh];

  // T6R-2 escorts: the first ESCORT_COUNT cars fly with the shuttle (the anchor) instead of a
  // river, so the chase view always holds a few close vehicles with readable dark bodies and long
  // trails. Offsets are a pure function of time; the anchor is the presented shuttle pose.
  const anchor = new Float64Array(6); // x, y, z, forward x, forward z, speed
  let anchorValid = false;
  function setAnchor(x: number, y: number, z: number, yawTurns: number, speed: number): void {
    anchor[0] = x;
    anchor[1] = y;
    anchor[2] = z;
    anchor[3] = Math.sin(yawTurns * TAU);
    anchor[4] = Math.cos(yawTurns * TAU);
    anchor[5] = speed;
    anchorValid = true;
  }

  // ---- Mutable tier state. Written by setQuality(), read by the hot loop.
  const groupActive = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);
  let activeCars = 0;
  let streakBudget = 0;
  let streaksUsed = 0;

  const invDimRangeSq = 1 / (DISTANCE_DIM_RANGE_M * DISTANCE_DIM_RANGE_M);
  const alongSpan = ALONG_HALF_SPAN_M * 2;
  const crossSpan = CROSS_HALF_SPAN_M * 2;

  function setQuality(quality: TrafficQuality): void {
    assertQuality(quality, maxCarCount);
    if (quality.thrusterBudget > streakCapacity) fail('SKYRIVER_TRAFFIC_TIER_GLOW_OVER_CAPACITY');

    activeCars = quality.carCount;
    streakBudget = quality.thrusterBudget;

    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
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

    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      const group = groupCars[archetype];
      const active = groupActive[archetype];
      const matrices = matrixArrays[archetype];
      const colors = colorArrays[archetype];

      for (let slot = 0; slot < active; slot += 1) {
        const car = group[slot];
        const river = carRiver[car];
        const direction = riverDirection[river];
        const speed = carSpeed[car];
        const crossing = river >= ALONG_RIVERS;
        const span = crossing ? crossSpan : alongSpan;
        const halfSpan = span * 0.5;

        // Position along the river at continuous time, wrapped over the span.
        let s = (carPhase[car] * span + direction * speed * t) % span;
        if (s < 0) s += span;
        const along = s - halfSpan;
        const edge = halfSpan - Math.abs(along);
        let fade = smoothstep(0, WRAP_FADE_M, edge);
        let py = riverY[river] + carOffsetY[car] + Math.sin(t * 0.7 + carBob[car]) * 1.6;
        let carSpeedNow = speed;

        let px: number;
        let pz: number;
        let fx: number;
        let fz: number;
        if (car < ESCORT_COUNT && anchorValid) {
          const e = car * 4;
          const lateral = ESCORTS[e]!;
          const lift = ESCORTS[e + 1]!;
          let forward: number;
          let heading = 1;
          if (car === ESCORT_COUNT - 1) {
            // The oncoming one: passes the shuttle every ~3 s on the far side.
            forward = 520 - ((t * 330) % 1040);
            heading = -1;
          } else {
            forward = ESCORTS[e + 2]! + ESCORTS[e + 3]! * Math.sin(t * (0.13 + car * 0.04) + car * 1.7);
          }
          const ax = anchor[3]!;
          const az = anchor[4]!;
          // Right-hand vector in the sim basis (yaw 0 faces +z): (cos, 0, -sin) of the heading.
          px = clamp(anchor[0]! + ax * forward + az * lateral, laneMinX, laneMaxX);
          py = anchor[1]! + lift + Math.sin(t * 0.9 + car) * 1.2;
          pz = anchor[2]! + az * forward - ax * lateral;
          fx = ax * heading;
          fz = az * heading;
          carSpeedNow = heading > 0 ? anchor[5]! : 170;
          fade = 1;
        } else if (crossing) {
          px = along;
          pz = riverLane[river] + carOffsetLateral[car];
          fx = direction;
          fz = 0;
        } else {
          px = clamp(riverLane[river] + carOffsetLateral[car], laneMinX, laneMaxX);
          pz = along;
          fx = 0;
          fz = direction;
        }

        // Axis-aligned basis: right = up x forward, up = +Y.
        const scale = sizeScale[car];
        const offset = slot * 16;
        matrices[offset] = fz * scale;
        matrices[offset + 1] = 0;
        matrices[offset + 2] = -fx * scale;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = 0;
        matrices[offset + 5] = scale;
        matrices[offset + 6] = 0;
        matrices[offset + 7] = 0;
        matrices[offset + 8] = fx * scale;
        matrices[offset + 9] = 0;
        matrices[offset + 10] = fz * scale;
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
          streakDirArray[d + 1] = 0;
          streakDirArray[d + 2] = fz;
          streakDirArray[d + 3] = carSpeedNow;
          streakFadeArray[streaksUsed] = fade;
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
    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      triangles += trianglesPerArchetype[archetype] * groupActive[archetype];
    }
    triangles += streaksUsed * 4;
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
    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
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
