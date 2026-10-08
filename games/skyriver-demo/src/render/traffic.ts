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
  DataTexture,
  DoubleSide,
  FloatType,
  NearestFilter,
  RGBAFormat,
  Vector2,
  Vector4,
} from 'three';
import type { Object3D } from 'three';

import { deriveTrafficParams, TRAFFIC_ARCHETYPE_COUNT, TRAFFIC_MAX_CARS } from '../sim/derive';
import { CHASM_BOUNDS, SKYRIVER_TICK_RATE } from '../sim/systems';

import {
  SKYRIVER_EMISSIVE_GAIN,
  SKYRIVER_OUTPUT_APPLY_GLSL,
  SKYRIVER_OUTPUT_PARS_GLSL,
  applySkyriverFog,
  skyriverFogUniforms,
} from './atmosphere';
import { skyriverDeclareStageRole } from './stageRoles';
import { CANYON_LOOP_LENGTH_M, warpCanyon, type WarpOut } from './canyonWarp';
import { routeAltitude, routeLateral } from './routeProfile';
import { TRAFFIC_TICK_RATE_HZ } from './trafficTypes';
import {
  cpuLightVisibilityAlpha,
  HULL_DRAW_DISTANCE_M,
  HULL_DRAW_FADE_START_M,
  IMPOSTOR_FAR_FALLOFF_BAND_M,
  IMPOSTOR_LIGHT_HANDOVER_BAND_M,
  IMPOSTOR_SUPPORT_TAPER_BAND,
} from './lightHandover';
import {
  FORK_RAMP_M,
  FORK_STREAM_COUNT,
  IMPOSTOR_PATHS,
  IMPOSTOR_RINGS,
  LANE_ROW_0,
  STREAMS,
  STREAM_CORRIDOR_HALF_M,
  STREAM_PATH_SAMPLES,
  STREAM_DESCRIPTORS,
  STREAM_PATH_STEP_M,
  STREAM_VARIANTS,
  WARP_ROW,
  bakedPathRow,
  carHops,
  cpuHopShare,
  deriveImpostorAttributes,
  evaluateCanyonPose,
  loopCentroid,
  newCanyonPose,
  newFlowSample,
  pathOfBakedRow,
  renderTrafficModel,
  sampleStreamFlow,
  sampleStreamPath,
  sampleWarpRow,
  scatterRowOf,
  type FlowInput,
  type RenderTrafficModel,
} from './trafficStreams';
import type {
  SkyriverTraffic,
  SkyriverTrafficOptions,
  TrafficBounds,
  TrafficPoint,
  TrafficQuality,
  TrafficStats,
  TrafficTime,
  TrafficTrailMode,
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
const RENDER_ARCHETYPES = TRAFFIC_ARCHETYPE_COUNT * 2 + 1;
/** R14: the seventh render archetype, a flatbed truck (freight). Share of all cars. */
const FLATBED_ARCHETYPE = TRAFFIC_ARCHETYPE_COUNT * 2;
const FLATBED_SHARE = 0.12;
const VARIANT_SHARE = 0.45;
/** R18: + one GPU impostor batch (the call came from merging the god-ray and searchlight beams). */
const TRAFFIC_DRAW_CALLS = RENDER_ARCHETYPES + 2;

/**
 * R18 GPU impostor traffic: per-tier counts (set from the measured frame-time curve, see the R18
 * report), and the band where they take over from the CPU cars: impostors fade in and the CPU cars'
 * lights fade out across one shared distance band, so far traffic hands over without a seam.
 */
export const IMPOSTORS_HIGH = 20000;
export const IMPOSTORS_MEDIUM = 10000;
/**
 * Impostors fade in over the shared band; the CPU cars' lights use its exact complement. Their hulls
 * are drawn to 1.3 km either way, so the mid range carries bodies while lights hand over smoothly.
 * Measured (R18): the chase frame is ~50-65% wall surface at 0.7-1.5 km, so the air the camera can
 * see traffic in is mostly the corridor in front of those walls; impostors start at 450 m to fill it.
 */
/** Impostor tier change: the larger set stays drawn while the difference fades, seconds. */
const IMPOSTOR_FADE_S = 1.2;

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
  high: Object.freeze({ carCount: 2400, thrusterBudget: 2400, trails: 'all' as const, impostors: IMPOSTORS_HIGH }),
  medium: Object.freeze({ carCount: 1200, thrusterBudget: 1200, trails: 'streams' as const, impostors: IMPOSTORS_MEDIUM }),
  low: Object.freeze({ carCount: 600, thrusterBudget: 600, trails: 'near' as const, impostors: 0 }),
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
/** R21: a free car's drift and climb sines run on a 20-40 s period (its heading preference). */
const FREE_DRIFT_PERIOD_MIN_S = 20;
const FREE_DRIFT_PERIOD_SPAN_S = 20;
const CLIMB_MIN_M = 6;
const CLIMB_SPAN_M = 34;
const SPEED_SCALE = 1.3;
/** Chase band: cars streaming past the shuttle within a window around it. */
/** T7-4: more and bigger neighbours, so passing them reads as passing cars. */
const CHASE_COUNT = 110;
const CHASE_SIZE_MIN = 3.2;
const CHASE_SIZE_SPAN = 1.4;
/**
 * R15: the window must divide the loop length. The route's canyon coordinate wraps by a whole loop
 * at the lap's halfway point; with a 1400 m window that shifted every close car ~200 m in one frame.
 */
const CHASE_WINDOW_M = CANYON_LOOP_LENGTH_M / 9;
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
 * The stream table itself (and its R18 GPU twin) lives in trafficStreams.ts.
 * R21 replaces the longitudinal surge with per-car band speeds, convoys and a lateral passing
 * offset, and adds the seeded fork and course-change network. The model owns all of it.
 */
const STREAM_SHARE = 0.85;
const CHASE_STREAM_SHARE = 0.8;
/** Personal jink: heading wobble amplitude, radians (~3 degrees). */
const JINK_RAD = 0.055;

/** Escort streaks are this fraction of a car's. */
const ESCORT_STREAK_SCALE = 0.5;
/** Inset from the corridor walls for escorts, metres. */
const WALL_MARGIN_M = 18;

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
/**
 * R16 light trails: a modest additive smear behind every car, length ~0.45 s of travel capped at
 * 60 m, low alpha so bloom integrates it. Red seen from behind, warm white seen from the front.
 */
/** R18 impostor sprite brightness before the emissive gain (bloom A/B tuned). */
export const IMPOSTOR_INTENSITY = 1.2;
const TRAIL_SECONDS = 0.45;
const TRAIL_MAX_M = 60;
const TRAIL_ALPHA = 0.25;
/**
 * R17 rods, not lines (cycle-7: long thin trails re-read as lane lines). A trail is at most this many
 * of its own car's lengths (so on screen it can never outrun 2 car lengths at any distance), its
 * width tapers from the lamp to this share at the end, and its alpha fades to zero along it.
 */
export const TRAIL_MAX_CAR_LENGTHS = 2;
export const TRAIL_END_WIDTH_SHARE = 0.3;
/** Lamp-to-lamp body length of a car at scale 1, metres (head + tail lamp offsets). */
export const TRAFFIC_CAR_LENGTH_M = HEAD_OFFSET_M + TAIL_OFFSET_M;
/** 'near' tier: trails on cars inside this camera distance (faded over the last 200 m). */
const TRAIL_NEAR_M = 700;

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
      0, 0.3, 0, 1.0, 0.62, 0.3);
  }
  pushLightPatch(build, 0.75, -0.3, 4.12, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, -0.75, -0.3, 4.12, 0.5, 0.3, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, 0.3, -4.12, 2.0, 0.22, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  return build;
}

/** R14 — flatbed truck: a low cab up front and a long open bed carrying crates (freight streams). */
function buildFlatbed(): MeshBuild {
  const build = newBuild();
  const r = 0.08;
  const g = 0.078;
  const b = 0.072;
  pushBox(build, 0, 0.35, 2.6, 2.3, 1.5, 1.9, r, g, b);
  pushBox(build, 0, 0.75, 2.2, 2.0, 0.5, 0.6, 0.04, 0.07, 0.1);
  pushBox(build, 0, -0.35, -1.3, 2.5, 0.35, 5.8, r * 0.9, g * 0.9, b * 0.9);
  pushBox(build, -0.5, 0.3, -0.4, 1.0, 0.95, 1.4, 0.16, 0.11, 0.07);
  pushBox(build, 0.55, 0.15, -2.2, 1.1, 0.65, 1.6, 0.09, 0.12, 0.13);
  pushBox(build, 0, 0.55, -3.6, 1.6, 1.15, 1.0, 0.14, 0.1, 0.08);
  pushBox(build, 1.3, -0.6, -1.3, 0.3, 0.4, 5.0, 0.15, 0.15, 0.16);
  pushBox(build, -1.3, -0.6, -1.3, 0.3, 0.4, 5.0, 0.15, 0.15, 0.16);
  pushLightPatch(build, 0, 0.1, 3.56, 1.7, 0.18, HEADLIGHT_R, HEADLIGHT_G, HEADLIGHT_B);
  pushLightPatch(build, 0, -0.35, -4.21, 2.1, 0.16, TAILLIGHT_R, TAILLIGHT_G, TAILLIGHT_B);
  return build;
}

/** Converts a build to a non-indexed, flat-shaded BufferGeometry and enforces the triangle budget. */
function toGeometry(build: MeshBuild, label: string): BufferGeometry {
  const triangles = buildTriangles(build);
  if (triangles === 0) fail('SKYRIVER_TRAFFIC_EMPTY_ARCHETYPE: ' + label);
  if (triangles > MAX_TRIANGLES_PER_ARCHETYPE) {
    fail('SKYRIVER_TRAFFIC_ARCHETYPE_OVER_BUDGET: ' + label + ' ' + String(triangles));
  }
  // R14 two-tone hull: a dark upper body over a lighter, warm-grey underside, so a close car reads
  // as a painted vehicle rather than a dark brick. Lamps (values > 0.9) are left untouched.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < build.position.length; i += 3) {
    minY = Math.min(minY, build.position[i]!);
    maxY = Math.max(maxY, build.position[i]!);
  }
  const split = minY + (maxY - minY) * 0.42;
  for (let v = 0; v < build.position.length / 3; v += 1) {
    const y = build.position[v * 3 + 1]!;
    const c = v * 3;
    if (Math.max(build.color[c]!, build.color[c + 1]!, build.color[c + 2]!) > 0.9) continue;
    // Body paint at 55% (exposure 1.75 lifted the R13 hulls to pale bricks); underside lifted a touch.
    build.color[c] = build.color[c]! * 0.55;
    build.color[c + 1] = build.color[c + 1]! * 0.55;
    build.color[c + 2] = build.color[c + 2]! * 0.55;
    if (y < split) {
      build.color[c] = build.color[c]! + 0.03;
      build.color[c + 1] = build.color[c + 1]! + 0.027;
      build.color[c + 2] = build.color[c + 2]! + 0.023;
    }
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
attribute vec4 aCarFade;     // fade, body scale, headlamp warmth (R14), trail weight (R16)

uniform float uPixelAngle;   // radians per drawing-buffer pixel, vertically
uniform float uHeadOffset;
uniform float uTailOffset;
uniform float uHeadTrail;
uniform float uTailTrail;
uniform float uTrailSeconds;
uniform float uTrailMax;
uniform float uTrailCarLengths;
uniform float uTrailEndWidth;

varying vec2 vCapsule;       // x along in radius units, y across -1..1
varying float vLengthR;      // capsule body length in radius units
varying float vLamp;
varying float vWarm;
varying float vIntensity;

#include <fog_pars_vertex>

void main() {
  vec3 dir = aCarDir.xyz;
  float speed = aCarDir.w;
  // R16: lamp 4 is the car's light trail, a long thin smear from the tail back along the velocity.
  bool isTrail = aLamp > 3.5;
  if ( isTrail && aCarFade.w <= 0.001 ) {
    // No trail this tier: a degenerate vertex outside the clip volume (no fragments, no fill).
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }
  float kind = isTrail ? 4.0 : mod( aLamp, 2.0 );
  bool head = kind < 0.5;
  float lampSide = isTrail ? 0.0 : ( aLamp < 1.5 ? -1.0 : 1.0 );
  vec3 rightW = normalize( cross( dir, vec3( 0.0, 1.0, 0.0 ) ) + vec3( 1e-5 ) );
  float scale = aCarFade.y;
  vec3 lamp = aCarPos + ( dir * ( head ? uHeadOffset : -uTailOffset ) + rightW * lampSide * 0.72 ) * scale;
  float trail = isTrail
    ? min( speed * uTrailSeconds, min( uTrailMax, uTrailCarLengths * ( uHeadOffset + uTailOffset ) * scale ) )
    : 1.2 + speed * ( head ? uHeadTrail : uTailTrail );
  vec3 tailEnd = lamp - dir * trail;

  vec4 v0 = viewMatrix * vec4( lamp, 1.0 );
  vec4 v1 = viewMatrix * vec4( tailEnd, 1.0 );
  if ( isTrail ) {
    // R17: the cap is on screen. A trail nearer the camera than its car projects longer than its
    // world length suggests, so it is shortened until its projected length is at most
    // uTrailCarLengths times the car's own projected length (two refinement steps).
    vec4 ch = viewMatrix * vec4( aCarPos + dir * uHeadOffset * scale, 1.0 );
    vec4 ct = viewMatrix * vec4( aCarPos - dir * uTailOffset * scale, 1.0 );
    float carScreen = length( ch.xy / max( - ch.z, 1.0 ) - ct.xy / max( - ct.z, 1.0 ) );
    for ( int k = 0; k < 2; k ++ ) {
      float trailScreen = length( v0.xy / max( - v0.z, 1.0 ) - v1.xy / max( - v1.z, 1.0 ) );
      float limit = uTrailCarLengths * carScreen;
      if ( trailScreen > limit && trailScreen > 0.0 ) {
        trail *= limit / trailScreen;
        tailEnd = lamp - dir * trail;
        v1 = viewMatrix * vec4( tailEnd, 1.0 );
      }
    }
  }
  // Radius: a real lamp size up close, a pixel floor far away (~1.3 px radius).
  // T6R-2: 3-4x thicker at the lamp, tapering to a thread at the trail end.
  // R16 trails: a thinner ribbon (~0.8 px floor), so they smear rather than paint bars.
  float r0 = isTrail ? max( 0.6, -v0.z * uPixelAngle * 1.6 ) : max( 0.9, -v0.z * uPixelAngle * 3.4 );
  // R17: the trail tapers to uTrailEndWidth of its head width (a rod, never a constant-width line).
  float r1 = isTrail ? r0 * uTrailEndWidth : max( 0.35, -v1.z * uPixelAngle * 1.1 );
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
  vWarm = aCarFade.z;

  // Directional lamps: a headlight shows to the front, a taillight to the rear.
  vec3 toCam = normalize( cameraPosition - lamp );
  float facing = dot( dir, toCam ) * ( head ? 1.0 : -1.0 );
  // T7: the red tail trail reads from almost any angle (a long-exposure streak); the white head
  // lamp only toward the front, so crossing rivers read as red ribbons with white oncoming points.
  vIntensity = aCarFade.x * ( head ? smoothstep( 0.1, 0.7, facing ) : smoothstep( -0.85, 0.3, facing ) );
  // R11: up close the body's own lamp bar carries the read; the dot pair fades in with distance.
  vIntensity *= smoothstep( 140.0, 300.0, length( cameraPosition - lamp ) );
  if ( isTrail ) {
    // Seen from the front the trail is the headlamps' warm white, from behind the tails' red
    // (vWarm carries the blend); it never slices through the camera.
    vWarm = smoothstep( -0.2, 0.4, dot( dir, toCam ) );
    vIntensity = aCarFade.x * aCarFade.w * smoothstep( 30.0, 90.0, length( cameraPosition - lamp ) );
  }

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
uniform float uTrailAlpha;

varying vec2 vCapsule;
varying float vLengthR;
varying float vLamp;
varying float vWarm;
varying float vIntensity;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}

void main() {
  float x = vCapsule.x;
  float along = clamp( x, 0.0, vLengthR );
  float dist = length( vec2( x - along, vCapsule.y ) );
  float support = 1.0 - smoothstep( ${IMPOSTOR_SUPPORT_TAPER_BAND[0].toFixed(2)}, ${IMPOSTOR_SUPPORT_TAPER_BAND[1].toFixed(2)}, dist );
  float body = exp( - dist * dist * 1.6 ) * support;
  float core = exp( - dist * dist * 10.0 );
  // Brightest at the lamp, fading down the trail.
  float t = vLengthR > 0.0 ? along / vLengthR : 0.0;
  // max(): with fast-math division t can land a hair above 1, and pow(negative) is NaN.
  // Head: a white-to-bright gradient that stays lit most of its length; tail: a red falloff.
  float trail = pow( max( 1.0 - t, 0.0 ), vLamp < 0.5 ? 0.7 : 1.2 );

  // R14: express streams burn pure white, freight mixes amber; tails are red everywhere.
  vec3 headColor = mix( vec3( 1.0, 0.97, 0.93 ), vec3( 1.0, 0.62, 0.22 ), vWarm );
  vec3 tailColor = vec3( 1.0, 0.07, 0.045 );
  vec3 lampColor = vLamp < 0.5 ? headColor : tailColor;
  vec3 color = ( lampColor * body + mix( lampColor, vec3( 1.0 ), 0.5 ) * core * 0.4 ) * trail;
  if ( vLamp > 3.5 ) {
    // R16 trail: soft body only (no hot core), red from behind / warm white from the front, low alpha.
    vec3 trailColor = mix( tailColor, vec3( 1.0, 0.86, 0.66 ), vWarm );
    color = trailColor * body * pow( max( 1.0 - t, 0.0 ), 1.4 ) * uTrailAlpha;
  }

  gl_FragColor = vec4( color * ( vIntensity * uIntensity ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #ifdef USE_FOG
    // Lights carry further through the rain than the concrete they pass: a softened fog curve.
    gl_FragColor.rgb *= pow( max( 1.0 - skyriverFogFactor(), 0.0 ), uFogPenetration );
  #endif
}
`;

/* ------------------------------------------------------------------------------------------------
 * R18 GPU impostor cars: one instanced quad per car, position evaluated here from the baked path
 * path table (trafficStreams.ts; impostorPosition is the CPU mirror — keep the two in step). Each
 * instance carries only (stream, arc offset, phase, seed) and a sub-row; update() advances uTime.
 * Drawn as a lamp sprite with a short micro-streak behind it: the head lamps' warm white seen from
 * the front, the tails' red from behind, 2-5 px at distance, brightness and size varied per car.
 * ---------------------------------------------------------------------------------------------- */

const IMPOSTOR_VERTEX = /* glsl */ `
attribute vec2 aCorner;      // x: 0 lamp end, 1 streak end; y: side -1..1
attribute vec4 aImp;         // logical path, arc offset 0..1, phase 0..1, appearance seed 0..1
attribute vec4 aFlow;        // sub-row, effective speed m/s, signed pass period s, pass amplitude m
attribute vec4 aRoute;       // baked row A, baked row B, hop start m, hop ramp m

uniform sampler2D uPaths;    // 8 streams x 4 variants, then 6 lanes, then the canyon warp row
uniform vec4 uStreamA[ NSTREAMS ]; // direction, nominal speed, sub-rows, width
uniform vec4 uForkSpan[ NFORKS ];  // fork 0 (start m, length m), fork 1 (start m, length m)
uniform vec4 uForkRamp[ NFORKS ];  // fork 0 ramp m, fork 1 ramp m, spare, spare
uniform vec4 uRingA[ NRINGS ];     // radius, altitude, direction, speed
uniform vec4 uRingB[ NRINGS ];     // sub-rows, width, radial meander, wobble
uniform float uRingLobes[ NRINGS ];
uniform vec2 uRingCentre;
uniform float uTime;
uniform float uLoop;
uniform float uPathStep;
uniform float uPathLast;
uniform float uCorridor;
uniform float uPixelAngle;
uniform vec2 uBand;          // impostors fade in over [x, y] metres from the camera
uniform vec2 uFarFalloff;    // brightness fades over [x, y] metres from the camera
uniform float uFadeFrom;     // instances at or above this index fade by uFadeK (tier change)
uniform float uFadeK;

varying vec2 vCapsule;
varying float vLengthR;
varying float vWarm;
varying float vIntensity;

#include <fog_pars_vertex>

vec4 pathAt( int row, float f ) {
  float i0 = min( floor( f ), uPathLast - 1.0 );
  float fr = f - i0;
  vec4 a = texelFetch( uPaths, ivec2( int( i0 ), row ), 0 );
  vec4 b = texelFetch( uPaths, ivec2( int( i0 ) + 1, row ), 0 );
  return mix( a, b, fr );
}

// R21 smooth ramps. The quintic has zero first and second derivative at both ends, so a branch or a
// course change starts and ends without a kink (trafficStreams.quintic is the same function).
float quintic( float u ) {
  float c = clamp( u, 0.0, 1.0 );
  return c * c * c * ( 10.0 - 15.0 * c + 6.0 * c * c );
}

float quinticRate( float u ) {
  if ( u <= 0.0 || u >= 1.0 ) return 0.0;
  float k = 1.0 - u;
  return 30.0 * u * u * k * k;
}

float forkBump( float d, float len, float ramp ) {
  if ( len <= 0.0 || d <= 0.0 || d >= len ) return 0.0;
  return quintic( d / ramp ) * ( 1.0 - quintic( ( d - len + ramp ) / ramp ) );
}

float forkBumpRate( float d, float len, float ramp ) {
  if ( len <= 0.0 || d <= 0.0 || d >= len ) return 0.0;
  return ( quinticRate( d / ramp ) / ramp ) * ( 1.0 - quintic( ( d - len + ramp ) / ramp ) )
    - quintic( d / ramp ) * ( quinticRate( ( d - len + ramp ) / ramp ) / ramp );
}

// One path's canyon offset for one car: the baked centre and slopes, the car's own sub-row, and the
// merge re-scatter. The re-scatter dissolves the sub-row structure across a branch using a
// decorrelated phase and restores it exactly at both ends of the support, so a branch never reads as
// a copy of the main line's rows and the join stays continuous.
void pathOffset( int bakedRow, int stream, int forkBits, float row, float seed, float scatter,
    float p, float f, out vec4 off ) {
  vec4 c = pathAt( bakedRow, f );
  vec4 st = uStreamA[ stream ];
  float rows = st.z;
  float spacing = st.w / max( 1.0, rows - 1.0 );
  float rowIndex = min( rows - 1.0, floor( row * rows ) );
  float rowLat = ( rowIndex - ( rows - 1.0 ) * 0.5 ) * spacing + ( seed - 0.5 ) * spacing * 0.6;
  float rowVert = mod( rowIndex, 2.0 ) < 0.5 ? - 3.0 : 3.0;
  float scatterLat = ( scatter - 0.5 ) * st.w;
  float scatterVert = ( scatter - 0.5 ) * 6.0;
  float bump = 0.0;
  float rate = 0.0;
  if ( stream < NFORKS && forkBits != 0 ) {
    vec4 span = uForkSpan[ stream ];
    vec4 ramp = uForkRamp[ stream ];
    if ( ( forkBits & 1 ) != 0 ) {
      float d = mod( p - span.x, uLoop );
      bump += forkBump( d, span.y, ramp.x );
      rate += forkBumpRate( d, span.y, ramp.x );
    }
    if ( ( forkBits & 2 ) != 0 ) {
      float d = mod( p - span.z, uLoop );
      bump += forkBump( d, span.w, ramp.y );
      rate += forkBumpRate( d, span.w, ramp.y );
    }
  }
  off.x = c.x + rowLat + ( scatterLat - rowLat ) * bump;
  off.y = c.y + rowVert + ( scatterVert - rowVert ) * bump;
  off.z = c.z + ( scatterLat - rowLat ) * rate;
  off.w = c.w + ( scatterVert - rowVert ) * rate;
}

void ringPose( int ring, out vec3 pos, out vec3 dir, out float arcM ) {
  // R18 air-traffic ring, world space (trafficStreams.impostorPosition's ring branch). Unchanged by
  // R21: the rings keep logical path ids 14..19, their surge, and their normalized population.
  vec4 ra = uRingA[ ring ];
  vec4 rb = uRingB[ ring ];
  float row = aFlow.x;
  float phase = aImp.z;
  float seed = aImp.w;
  float speed = ra.w * ( 0.9 + 0.2 * row );
  float surge = 110.0 * sin( uTime * ( 0.3 + 0.25 * row ) + phase * 97.0 );
  float theta = ( aImp.y * 6.28318530718 * ra.x + ra.z * speed * uTime + surge ) / ra.x;
  float rows = rb.x;
  float rowIndex = min( rows - 1.0, floor( row * rows ) );
  float spacing = rb.y / max( 1.0, rows - 1.0 );
  float rowOffset = ( rowIndex - ( rows - 1.0 ) * 0.5 ) * spacing + ( seed - 0.5 ) * spacing * 0.6;
  float fr = float( ring );
  float r = ra.x + rb.z * sin( uRingLobes[ ring ] * theta + fr * 1.7 ) + rowOffset;
  pos = vec3( uRingCentre.x + r * cos( theta ),
    ra.y + rb.w * sin( 3.0 * theta + fr * 2.3 ) + ( mod( rowIndex, 2.0 ) < 0.5 ? - 12.0 : 12.0 ) + ( fract( seed * 7.3 ) - 0.5 ) * 30.0 + 6.0 * sin( uTime * 0.33 + phase * 17.0 ),
    uRingCentre.y + r * sin( theta ) );
  dir = vec3( - sin( theta ), 0.0, cos( theta ) ) * ra.z;
  arcM = theta * ra.x;
}

void main() {
  int k = int( aImp.x + 0.5 );
  float row = aFlow.x;
  float phase = aImp.z;
  float seed = aImp.w;
  vec3 pos;
  vec3 dir;
  // Nominal canyon progress, unwrapped and signed, metres. It advances at exactly the car's
  // effective speed, so a probe can read it apart from the geometric world speed. Rings report
  // their circumferential arc. This is the variable in scope at the position capture anchor below.
  float canyonArcM = 0.0;
  if ( k >= NSTREAMS ) {
    ringPose( k - NSTREAMS, pos, dir, canyonArcM );
  } else {
  vec4 st = uStreamA[ k ];
  // R21: one seeded cruise speed per car, inside its class band. The R18 longitudinal surge is gone
  // (its derivative reached 60.5 m/s, which put most express cars outside their band).
  float speed = aFlow.y;
  float q = aImp.y * uLoop + st.x * speed * uTime;
  float lapIndex = floor( q / uLoop );
  float p = q - lapIndex * uLoop;
  canyonArcM = q;
  float f = p / uPathStep;
  int rowA = int( aRoute.x + 0.5 );
  int rowB = int( aRoute.y + 0.5 );
  int streamB = rowB < LANE_ROW_0 ? rowB / NVARIANTS : rowB - LANE_ROW_0 + NFORKS;
  int forkBits = k < NFORKS ? rowA - k * NVARIANTS : 0;
  float scatter = fract( aImp.z * 41.7 + aImp.w * 17.3 );
  // One course change per lap. Even laps run A -> B, odd laps B -> A: at the lap seam the ramp
  // weight and the lap parity flip together, so the weight is continuous and the car never snaps
  // back to its source stream. A weight that reset to zero each lap would teleport it.
  float u = ( p - aRoute.z ) / aRoute.w;
  float s = quintic( u );
  float sRate = quinticRate( u ) / aRoute.w;
  bool evenLap = mod( lapIndex, 2.0 ) < 0.5;
  float hopW = evenLap ? s : 1.0 - s;
  float hopRate = evenLap ? sRate : - sRate;
  vec4 offA;
  pathOffset( rowA, k, forkBits, row, seed, scatter, p, f, offA );
  vec4 offB = offA;
  if ( rowB != rowA ) pathOffset( rowB, streamB, forkBits, row, seed, scatter, p, f, offB );
  // Passing: a faster-than-median car slides to one side and back, with no neighbour query.
  float passPeriod = abs( aFlow.z );
  float passAmp = aFlow.z < 0.0 ? - aFlow.w : aFlow.w;
  float passArg = 6.28318530718 * ( uTime / passPeriod + phase );
  float passSin = sin( passArg * 0.5 );
  float pass = passAmp * passSin * passSin;
  float passRate = passAmp * ( 3.14159265359 / passPeriod ) * sin( passArg );
  float driftArg = uTime * 0.4 + phase * 31.0;
  float bobArg = uTime * 0.33 + phase * 17.0;
  float x = offA.x + ( offB.x - offA.x ) * hopW + pass + 3.0 * sin( driftArg );
  float y = offA.y + ( offB.y - offA.y ) * hopW + ( fract( seed * 7.3 ) - 0.5 ) * 6.0 + 2.0 * sin( bobArg );
  float dxdv = offA.z + ( offB.z - offA.z ) * hopW + ( offB.x - offA.x ) * hopRate;
  float dydv = offA.w + ( offB.w - offA.w ) * hopW + ( offB.y - offA.y ) * hopRate;
  x = clamp( x, - uCorridor, uCorridor );
  vec4 w = pathAt( WARP_ROW, f );
  vec2 h = normalize( w.zw );
  pos = vec3( w.x + x * h.x, y, w.y - x * h.y );
  // Heading from the car's own path, branch and course-change slopes included, so a branching car
  // never faces along the stream it left.
  float along = st.x * speed;
  float across = dxdv * along + passRate + 1.2 * cos( driftArg );
  float up = dydv * along + 0.66 * cos( bobArg );
  dir = normalize( vec3( along * h.y + across * h.x, up, along * h.x - across * h.y ) );
  }

  vec3 toCam = cameraPosition - pos;
  float dist = length( toCam );
  // Size and brightness vary per car; the streak is ~1.3 car lengths of motion behind the lamp.
  float scale = 1.6 + 1.0 * fract( seed * 13.37 );
  vec4 v0 = viewMatrix * vec4( pos, 1.0 );
  // Radius in pixels, not metres: every impostor is a crisp 3-5 px lamp dot at any range (a world-
  // size floor turned the mid-range ones into soft blobs under bloom), varied per car.
  float r0 = - v0.z * uPixelAngle * ( 1.8 + 1.0 * fract( seed * 5.1 ) );
  // Micro-streak: ~1.3 car lengths of motion, but never longer on screen than 2.2 dot radii.
  float streak = min( 5.0 * scale * 1.3, 2.2 * r0 );
  vec3 tailEnd = pos - dir * streak;
  vec4 v1 = viewMatrix * vec4( tailEnd, 1.0 );
  float r1 = r0 * 0.45;
  vec2 d = v1.xy - v0.xy;
  float len = length( d );
  vec2 axis = len > 1e-4 ? d / len : vec2( 0.0, - 1.0 );
  vec2 side = vec2( - axis.y, axis.x );
  float rMean = 0.5 * ( r0 + r1 );
  float end = aCorner.x;
  float r = mix( r0, r1, end );
  vec4 vv = mix( v0, v1, end );
  vv.xy += axis * ( end * 2.0 - 1.0 ) * r + side * aCorner.y * r;
  vLengthR = len / rMean;
  vCapsule = vec2( mix( - 1.0, vLengthR + 1.0, end ), aCorner.y );

  float facing = dot( dir, toCam / max( dist, 1.0 ) );
  vWarm = smoothstep( - 0.2, 0.3, facing );
  float tierPresence = float( gl_InstanceID ) >= uFadeFrom ? uFadeK : 1.0;
  // Far impostors integrate into the haze instead of stacking into a bloom wash. Their brightness
  // falls over the shared 2.5–6.5 km band and reaches zero with a smooth derivative.
  float handover = smoothstep( uBand.x, uBand.y, dist );
  float farBrightness = 1.0 - smoothstep( uFarFalloff.x, uFarFalloff.y, dist );
  vIntensity = ( 0.55 + 0.6 * fract( seed * 29.7 ) ) * handover * tierPresence * farBrightness;
  if ( vIntensity <= 0.001 ) {
    // Inside the CPU cars' band (or faded out): no fragments at all.
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    return;
  }
  #ifdef USE_FOG
    vFogDepth = - vv.z;
    vSkyFogHeight = pos.y;
  #endif
  gl_Position = projectionMatrix * vv;
}
`;

const IMPOSTOR_FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uFogPenetration;

varying vec2 vCapsule;
varying float vLengthR;
varying float vWarm;
varying float vIntensity;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}

void main() {
  float x = vCapsule.x;
  float along = clamp( x, 0.0, vLengthR );
  float dist = length( vec2( x - along, vCapsule.y ) );
  float support = 1.0 - smoothstep( ${IMPOSTOR_SUPPORT_TAPER_BAND[0].toFixed(2)}, ${IMPOSTOR_SUPPORT_TAPER_BAND[1].toFixed(2)}, dist );
  float body = exp( - dist * dist * 1.6 ) * support;
  float t = vLengthR > 0.0 ? along / vLengthR : 0.0;
  float fall = pow( max( 1.0 - t, 0.0 ), 1.2 );
  vec3 color = mix( vec3( 1.0, 0.07, 0.045 ), vec3( 1.0, 0.86, 0.66 ), vWarm ) * body * fall;
  gl_FragColor = vec4( color * ( vIntensity * uIntensity ), 1.0 );
${SKYRIVER_OUTPUT_APPLY_GLSL}
  #ifdef USE_FOG
    gl_FragColor.rgb *= pow( max( 1.0 - skyriverFogFactor(), 0.0 ), uFogPenetration );
  #endif
}
`;

/**
 * The impostor vertex source and the two names a GPU probe needs, exported read-only so a test or a
 * transform-feedback probe can check them without adding a production draw.
 *   - `IMPOSTOR_POSITION_ANCHOR_GLSL` occurs exactly once, after both position branches.
 *   - `IMPOSTOR_CANYON_ARC_GLSL` names the nominal canyon progress variable in scope there: the
 *     unwrapped signed canyon arc in metres, which advances at exactly the car's effective speed.
 */
export const IMPOSTOR_VERTEX_GLSL = IMPOSTOR_VERTEX;
export const IMPOSTOR_POSITION_ANCHOR_GLSL = 'vec3 toCam = cameraPosition - pos;';
export const IMPOSTOR_CANYON_ARC_GLSL = 'canyonArcM';

/** What a permanent car index is: its role in the swarm and the stream it belongs to. */
export type CarRole = 'escort' | 'chase-stream' | 'chase-free' | 'stream' | 'free';

export interface CarPlan {
  role: CarRole;
  /** Stream index, a chase rank for 'chase-stream', or 255 for a free car. */
  stream: number;
}

const carPlanShares = STREAMS.reduce<number[]>((acc, st) => { acc.push((acc[acc.length - 1] ?? 0) + st[9]!); return acc; }, []);

/**
 * The permanent role and stream of one car index. Pure in (seed, car) — no tier, no time — so a
 * quality change can never move a car, and the hop census below is exact rather than sampled.
 */
export function carTrafficPlan(seed: number, car: number, out: CarPlan): void {
  const h = (k: number): number => hash01(car ^ (seed | 0), k);
  if (car < ESCORT_COUNT) { out.role = 'escort'; out.stream = 255; return; }
  if (car < ESCORT_COUNT + CHASE_COUNT) {
    if (h(0x41) < CHASE_STREAM_SHARE) { out.role = 'chase-stream'; out.stream = h(0x42) < 0.65 ? 0 : 1; return; }
    out.role = 'chase-free';
    out.stream = 255;
    return;
  }
  if (h(0x41) < STREAM_SHARE) {
    const pick = h(0x42) * carPlanShares[carPlanShares.length - 1]!;
    let stream = 0;
    while (stream < STREAMS.length - 1 && carPlanShares[stream]! <= pick) stream += 1;
    out.role = 'stream';
    out.stream = stream;
    return;
  }
  out.role = 'free';
  out.stream = 255;
}

export interface HopCensus {
  readonly carCount: number;
  /** Normal stream cars in this tier. Escorts and the R15 sticky chase band are excluded. */
  readonly streamCars: number;
  readonly hopCars: number;
  readonly share: number;
}

/**
 * R21 course-change census for one tier. The hop decision depends only on the car index and the
 * seed's salt, so this reports exactly what the renderer does.
 */
export function trafficHopCensus(seed: number, carCount: number): HopCensus {
  const model = renderTrafficModel(seed);
  const plan: CarPlan = { role: 'free', stream: 255 };
  let streamCars = 0;
  let hopCars = 0;
  for (let car = 0; car < carCount; car += 1) {
    carTrafficPlan(seed, car, plan);
    if (plan.role !== 'stream') continue;
    streamCars += 1;
    if (carHops(car, model.carSalt, cpuHopShare(car))) hopCars += 1;
  }
  return { carCount, streamCars, hopCars, share: streamCars === 0 ? 0 : hopCars / streamCars };
}

function buildImpostorGeometry(model: RenderTrafficModel, capacity: number): InstancedBufferGeometry {
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(4 * 3), 3));
  geometry.setAttribute('aCorner', new BufferAttribute(new Float32Array([0, -1, 0, 1, 1, 1, 1, -1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  // R21: the same model instance the CPU cars read, so neither population rebakes the path table.
  const attrs = deriveImpostorAttributes(model.seed, capacity, model);
  geometry.setAttribute('aImp', new InstancedBufferAttribute(attrs.streamArcPhaseSeed, 4));
  geometry.setAttribute('aFlow', new InstancedBufferAttribute(attrs.flow, 4));
  geometry.setAttribute('aRoute', new InstancedBufferAttribute(attrs.route, 4));
  geometry.instanceCount = 0;
  return geometry;
}

function buildStreakGeometry(capacity: number): InstancedBufferGeometry {
  const corner: number[] = [];
  const lamp: number[] = [];
  const index: number[] = [];
  // T7-5: four lamps per car — a white head pair and a red tail pair (lamp id = kind + 2 * side).
  // R16: a fifth quad (lamp 4) is the car's light trail.
  for (let l = 0; l < 5; l += 1) {
    const base = l * 4;
    for (const [end, side] of [[0, -1], [0, 1], [1, 1], [1, -1]] as const) {
      corner.push(end, side);
      lamp.push(l);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(20 * 3), 3));
  geometry.setAttribute('aCorner', new BufferAttribute(new Float32Array(corner), 2));
  geometry.setAttribute('aLamp', new BufferAttribute(new Float32Array(lamp), 1));
  geometry.setIndex(index);
  const pos = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const dir = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  const fade = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
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
  /**
   * R21: one seed-owned traffic model. It holds the seeded fork and course-change network and the
   * baked path table, and both populations read it — the CPU cars below and the GPU impostors — so
   * they fly exactly the same corridors. The simulation never sees it.
   */
  const model = renderTrafficModel(options.seed);

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
  /** R12: 40% of express cars drop out beyond ~1 km, breaking the distant white dot-chains. */
  const carThinFar = new Uint8Array(maxCarCount);
  /** R14: headlamp warmth 0 (white) .. 1 (amber). */
  const carWarm = new Float32Array(maxCarCount);
  /**
   * R21 per-car flow, from the shared model. A stream car's speed is its own sample inside its class
   * band, not the stream's nominal speed, and its route records the branch it took and the course
   * change it makes once a lap. Every value is a function of the permanent car index, so a tier
   * change never moves a car.
   */
  const carCruiseMps = new Float32Array(maxCarCount);
  const carEffectiveMps = new Float32Array(maxCarCount);
  const carConvoy = new Uint8Array(maxCarCount);
  const carPassAmpM = new Float32Array(maxCarCount);
  const carPassPeriodS = new Float32Array(maxCarCount);
  const carForkBits = new Uint8Array(maxCarCount);
  const carRouteA = new Uint8Array(maxCarCount);
  const carRouteB = new Uint8Array(maxCarCount);
  const carHopStartM = new Float32Array(maxCarCount);
  const carHopRampM = new Float32Array(maxCarCount);
  /** Appearance seed 0..1: the sub-row jitter and the merge re-scatter read it. */
  const carAppearance = new Float32Array(maxCarCount);
  const tintR = new Float32Array(maxCarCount);
  const tintG = new Float32Array(maxCarCount);
  const tintB = new Float32Array(maxCarCount);

  /** Density pulse per stream car, so its convoy is shared with the rest of its clump. */
  const carFlowInput: FlowInput = { path: 0, index: 0, salt: 0, pulse: 0, row: 0, phase: 0, appearanceSeed: 0, hopShare: 0, allowForks: true };
  const carFlowScratch = newFlowSample();
  const carPlan: CarPlan = { role: 'free', stream: 255 };

  const renderArchetype = new Uint8Array(maxCarCount);
  const archetypeTotals = new Int32Array(RENDER_ARCHETYPES);
  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = params.archetype[car];
    if (archetype >= TRAFFIC_ARCHETYPE_COUNT) fail('SKYRIVER_TRAFFIC_ARCHETYPE_OUT_OF_RANGE');
    const render = hash01(car, 0xf1a7) < FLATBED_SHARE
      ? FLATBED_ARCHETYPE
      : archetype + (hash01(car, 0x7e57) < VARIANT_SHARE ? TRAFFIC_ARCHETYPE_COUNT : 0);
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
    // One definition of a car's role and stream, shared with trafficHopCensus.
    carTrafficPlan(options.seed, car, carPlan);
    if (carPlan.role === 'chase-stream') {
      // Chase band: members of the streams nearest the shuttle (rank 0 or 1, re-picked each frame).
      carStream[car] = carPlan.stream;
      carRow[car] = h(0x43);
      carHomeX[car] = (h(0x21) * 2 - 1);
      carHomeY[car] = (h(0x22) * 2 - 1);
      carSpeed[car] = 0;
    } else if (carPlan.role === 'chase-free') {
      // Free floaters near the shuttle, at offsets kept off its own line.
      let lateral = (h(0x21) * 2 - 1) * 175;
      let lift = (h(0x22) * 2 - 1) * 70;
      if (Math.abs(lateral) < 35 && Math.abs(lift) < 20) lift = Math.sign(lift || 1) * (20 + h(0x23) * 30);
      if (lift < -10 && Math.abs(lateral) < 110) lateral = Math.sign(lateral || 1) * (110 + h(0x24) * 100);
      carHomeX[car] = lateral;
      carHomeY[car] = lift;
      carSpeed[car] = carDirection[car] > 0 ? 90 + h(0x25) * 110 : 60 + h(0x25) * 80;
    } else if (carPlan.role === 'stream') {
      const st = STREAMS[carPlan.stream]!;
      carStream[car] = carPlan.stream;
      carThinFar[car] = st[5]! > 150 && h(0x51) < 0.4 ? 1 : 0;
      carDirection[car] = st[2]!;
      carRow[car] = h(0x43);
      carHomeX[car] = (h(0x21) * 2 - 1);
      carHomeY[car] = (h(0x22) * 2 - 1);
      // The R21 flow below replaces the stream's nominal speed with this car's own band sample.
      carSpeed[car] = st[5]!;
    } else if (carPlan.role === 'free' || carPlan.role === 'escort') {
      carSpeed[car] = Math.abs(params.speed[car]!) * SPEED_SCALE * (0.8 + 0.4 * h(0x25));
    }
    carPhase[car] = params.phase[car]!;
    if (carStream[car] !== 255) {
      // The sub-row jitter and the merge re-scatter read this as the car's appearance channel. The
      // 0.6 spacing factor reproduces the R11 jitter exactly: carHomeX is already in [-1, 1].
      carAppearance[car] = (carHomeX[car]! + 1) * 0.5;
    }
    if (carStream[car] !== 255) {
      // Density pulses: squeeze the phase into clumps of varying fill, one set per stream.
      const st = STREAMS[carStream[car]!]!;
      const pulses = st[8]!;
      const slot = carPhase[car]! * pulses;
      const pulse = Math.floor(slot);
      const fill = 0.22 + 0.4 * hash01(carStream[car]! * 97 + pulse, 0x9a11);
      const offset = hash01(carStream[car]! * 131 + pulse, 0x9a12) * (1 - fill);
      if (!chase) carPhase[car] = (pulse + offset + Math.pow(slot - pulse, 0.8) * fill) / pulses;
      // R21 flow: the class band, the convoy, the passing offset, the branch bits, and the course
      // change. The hop share follows the permanent index cohort, so the low tier (cars 0..599)
      // keeps fixed trajectories and the medium and high tiers both land near 15%.
      carFlowInput.path = carStream[car]!;
      carFlowInput.index = car;
      carFlowInput.salt = model.carSalt;
      carFlowInput.pulse = pulse;
      carFlowInput.row = carRow[car]!;
      carFlowInput.phase = carPhase[car]!;
      carFlowInput.appearanceSeed = carAppearance[car]!;
      carFlowInput.hopShare = chase ? 0 : cpuHopShare(car);
      carFlowInput.allowForks = !chase;
      sampleStreamFlow(model, carFlowInput, carFlowScratch);
      carCruiseMps[car] = carFlowScratch.sampledCruiseMps;
      carEffectiveMps[car] = carFlowScratch.effectiveMps;
      carConvoy[car] = carFlowScratch.convoy ? 1 : 0;
      carPassAmpM[car] = carFlowScratch.passAmplitudeM;
      carPassPeriodS[car] = carFlowScratch.passPeriodS;
      carForkBits[car] = carFlowScratch.forkBits;
      carRouteA[car] = carFlowScratch.bakedRowA;
      carRouteB[car] = carFlowScratch.bakedRowB;
      carHopStartM[car] = carFlowScratch.hopStartM;
      carHopRampM[car] = carFlowScratch.hopRampM;
      carSpeed[car] = carFlowScratch.effectiveMps;
      carWarm[car] = carFlowScratch.kind === 'express'
        ? 0
        : carFlowScratch.kind === 'freight' ? (h(0x52) < 0.5 ? 1 : 0.15) : 0.25 * h(0x52);
    }
    carDriftA[car] = DRIFT_MIN_M + h(0x31) * DRIFT_SPAN_M;
    // R21: a free car's heading preference rotates on a 20-40 s period, so its slow weave reads as
    // a flying car choosing its line instead of a near-static offset.
    carDriftW[car] = TAU / (FREE_DRIFT_PERIOD_MIN_S + h(0x32) * FREE_DRIFT_PERIOD_SPAN_S);
    carDriftP[car] = h(0x33) * TAU;
    carClimbA[car] = CLIMB_MIN_M + h(0x34) * CLIMB_SPAN_M;
    carClimbW[car] = TAU / (FREE_DRIFT_PERIOD_MIN_S + h(0x35) * FREE_DRIFT_PERIOD_SPAN_S);
    carClimbP[car] = h(0x36) * TAU;
    if (carStream[car] === 255 && !chase) {
      // R21: each free car's home range is inset by its own drift amplitude and a wall margin, so
      // its analytic motion stays inside the corridor and no lateral clamp can snap it.
      const lateralRoom = Math.max(0, CAR_CORRIDOR_HALF_M - carDriftA[car]! - WALL_MARGIN_M);
      carHomeX[car] = (h(0x21) * 2 - 1) * lateralRoom;
      const lowY = CAR_MIN_Y_M + carClimbA[car]! + WALL_MARGIN_M;
      const highY = CAR_MAX_Y_M - carClimbA[car]! - WALL_MARGIN_M;
      carHomeY[car] = lowY + Math.pow(h(0x22), 0.9) * (highY - lowY);
    }
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

  const archetypeBuilds: MeshBuild[] = [buildCab(), buildInterceptor(), buildCommuter(), buildVan(), buildSaucer(), buildBus(), buildFlatbed()];
  const archetypeLabels: string[] = ['cab', 'interceptor', 'commuter', 'van', 'saucer', 'bus', 'flatbed'];
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
    // R23 draw role, declared here where the hull material is built: opaque, depth-writing.
    skyriverDeclareStageRole(mesh, 'opaque');
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
      uTrailSeconds: { value: TRAIL_SECONDS },
      uTrailMax: { value: TRAIL_MAX_M },
      uTrailAlpha: { value: TRAIL_ALPHA },
      uTrailCarLengths: { value: TRAIL_MAX_CAR_LENGTHS },
      uTrailEndWidth: { value: TRAIL_END_WIDTH_SHARE },
      // T7: dense crossing ribbons overlap several trails per pixel; bloom supplies the glow.
      // R16: raised with the exposure trade (SKYRIVER_EMISSIVE_GAIN), so the lights hold their level.
      uIntensity: { value: 1.7 * SKYRIVER_EMISSIVE_GAIN },
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
  // R23 draw role: transparent additive, depthWrite false.
  skyriverDeclareStageRole(streakMesh, 'transparent');
  const streakPos = streakGeometry.getAttribute('aCarPos') as InstancedBufferAttribute;
  const streakDir = streakGeometry.getAttribute('aCarDir') as InstancedBufferAttribute;
  const streakFade = streakGeometry.getAttribute('aCarFade') as InstancedBufferAttribute;
  const streakPosArray = streakPos.array as Float32Array;
  const streakDirArray = streakDir.array as Float32Array;
  const streakFadeArray = streakFade.array as Float32Array;

  // ---- R18 GPU impostor cars, on the R21 shared model.
  const impostorCapacity = Math.max(0, options.maxImpostors ?? options.quality.impostors);
  const table = model.table;
  const pathTexture = new DataTexture(table.data, table.width, table.height, RGBAFormat, FloatType);
  pathTexture.minFilter = NearestFilter;
  pathTexture.magFilter = NearestFilter;
  pathTexture.needsUpdate = true;
  const impostorGeometry = buildImpostorGeometry(model, impostorCapacity);
  const impostorMaterial = new ShaderMaterial({
    name: 'skyriver.traffic.impostors',
    vertexShader: IMPOSTOR_VERTEX,
    fragmentShader: IMPOSTOR_FRAGMENT,
    defines: {
      NSTREAMS: IMPOSTOR_PATHS.length,
      NRINGS: IMPOSTOR_RINGS.length,
      NFORKS: FORK_STREAM_COUNT,
      NVARIANTS: STREAM_VARIANTS,
      LANE_ROW_0: LANE_ROW_0,
      WARP_ROW: WARP_ROW,
    },
    uniforms: {
      uPaths: { value: pathTexture },
      uStreamA: { value: IMPOSTOR_PATHS.map((st) => new Vector4(st[2]!, st[5]!, st[3]!, st[4]!)) },
      uForkSpan: { value: model.forks.map((list) => new Vector4(list[0]!.startM, list[0]!.lengthM, list[1]?.startM ?? 0, list[1]?.lengthM ?? 0)) },
      uForkRamp: { value: model.forks.map((list) => new Vector4(list[0]!.rampM, list[1]?.rampM ?? FORK_RAMP_M, 0, 0)) },
      uRingA: { value: IMPOSTOR_RINGS.map((r) => new Vector4(r[0]!, r[1]!, r[2]!, r[5]!)) },
      uRingB: { value: IMPOSTOR_RINGS.map((r) => new Vector4(r[3]!, r[4]!, r[6]!, r[7]!)) },
      uRingLobes: { value: IMPOSTOR_RINGS.map((r) => r[8]!) },
      uRingCentre: { value: new Vector2(loopCentroid().x, loopCentroid().z) },
      uTime: { value: 0 },
      uLoop: { value: CANYON_LOOP_LENGTH_M },
      uPathStep: { value: STREAM_PATH_STEP_M },
      uPathLast: { value: STREAM_PATH_SAMPLES },
      uCorridor: { value: STREAM_CORRIDOR_HALF_M },
      uPixelAngle: { value: 0.0012 },
      uBand: { value: new Vector2(...IMPOSTOR_LIGHT_HANDOVER_BAND_M) },
      uFarFalloff: { value: new Vector2(...IMPOSTOR_FAR_FALLOFF_BAND_M) },
      uFadeFrom: { value: 1e9 },
      uFadeK: { value: 1 },
      // Dim on purpose: tens of thousands of sub-pixel dots must integrate into the haze as light-river
      // texture, not bloom the sky into foam (the R12 sign-core lesson). Tuned in the R18 bloom A/B.
      uIntensity: { value: IMPOSTOR_INTENSITY * SKYRIVER_EMISSIVE_GAIN },
      uFogPenetration: { value: 0.2 },
      ...skyriverFogUniforms(),
    },
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    fog: true,
  });
  applySkyriverFog(impostorMaterial);
  const impostorMesh = new Mesh(impostorGeometry, impostorMaterial);
  impostorMesh.name = 'skyriver.traffic.impostors';
  impostorMesh.frustumCulled = false;
  impostorMesh.renderOrder = 9;
  // R23 draw role: transparent additive GPU impostors, depthWrite false.
  skyriverDeclareStageRole(impostorMesh, 'transparent');
  impostorMesh.visible = false;
  let impostorTier = 0;
  let impostorOverride: number | null = null;
  let impostorFrom = 0;
  let impostorTo = 0;
  let impostorChangeT = -1e9;
  let impostorPending = false;
  /**
   * 0..1: how far the CPU cars' far lights have handed over to the impostors. Follows the impostor
   * crossfade on a tier change (on/off), so the far lights never switch in one frame.
   */
  let impostorPresence = 0;
  function retargetImpostors(): void {
    const target = Math.min(impostorCapacity, impostorOverride ?? impostorTier);
    if (target === impostorTo) return;
    impostorFrom = impostorTo;
    impostorTo = target;
    impostorPending = true;
  }
  function setImpostorCount(count: number | null): void {
    impostorOverride = count === null ? null : Math.max(0, Math.floor(count));
    retargetImpostors();
  }
  function applyImpostors(t: number): void {
    if (impostorPending) { impostorChangeT = t; impostorPending = false; }
    const u = impostorMaterial.uniforms;
    u.uTime!.value = t;
    const k = Math.min(1, Math.max(0, (t - impostorChangeT) / IMPOSTOR_FADE_S));
    const drawn = k >= 1 ? impostorTo : Math.max(impostorFrom, impostorTo);
    impostorGeometry.instanceCount = drawn;
    u.uFadeFrom!.value = Math.min(impostorFrom, impostorTo);
    u.uFadeK!.value = k >= 1 ? 1 : impostorTo > impostorFrom ? k : 1 - k;
    impostorMesh.visible = drawn > 0;
    impostorPresence = impostorFrom === 0 && impostorTo > 0 ? k : impostorTo === 0 && impostorFrom > 0 ? 1 - k : impostorTo > 0 ? 1 : 0;
  }

  const objects: Object3D[] = [...meshes, streakMesh, impostorMesh];

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
  const carWarpRow = { x: 0, z: 0, cos: 0, sin: 0 };
  const carPose = newCanyonPose();
  const carDir = { x: 0, z: 0 };

  // ---- Mutable tier state. Written by setQuality(), read by the hot loop.
  const groupActive = new Int32Array(RENDER_ARCHETYPES);
  let activeCars = 0;
  let streakBudget = 0;
  let streaksUsed = 0;

  const invDimRangeSq = 1 / (DISTANCE_DIM_RANGE_M * DISTANCE_DIM_RANGE_M);

  // ---- R11 stream geometry: centre (x across, y) of stream k at canyon arc length v.
  const streamScratch = new Float64Array(3);
  const streamRank = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, STREAMS.length);
  const streamRankDist = new Float64Array(STREAMS.length);

  // ---- R15 sticky near-shuttle stream assignment (glitch fix). R11 re-ranked the streams every
  // frame, so when the order flipped every close car in that rank teleported 150-360 m at once
  // (measured: 27 cars at one tick). Ranks now hold their stream until another is nearer by a clear
  // margin and the current one has been held >= 2 s; on a switch each car hands over at its own
  // hashed moment, fading out on the old stream and in on the new (no car ever jumps visibly).
  const RANK_SWITCH_MARGIN_M = 160;
  const RANK_MIN_HOLD_S = 2;
  const HANDOFF_FADE_S = 0.35;
  const HANDOFF_SPREAD_S = 1.2;
  const rankCurrent = new Int16Array([-1, -1]);
  const rankPrevious = new Int16Array([-1, -1]);
  const rankSwitchT = new Float64Array([-1e9, -1e9]);
  function updateRankAssignment(t: number): void {
    for (let r = 0; r < 2; r += 1) {
      // A clock that ran backwards (restore/replay) drops any handoff in flight.
      if (t < rankSwitchT[r]!) { rankSwitchT[r] = -1e9; rankPrevious[r] = -1; }
      const other = rankCurrent[1 - r]!;
      let best = -1;
      for (let k = 0; k < streamRank.length; k += 1) {
        const candidate = streamRank[k]!;
        if (r === 1 && candidate === rankCurrent[0]) continue;
        if (r === 0 && candidate === other && other !== -1 && k > 0) continue;
        best = candidate;
        break;
      }
      const cur = rankCurrent[r]!;
      if (cur === -1) { rankCurrent[r] = best; continue; }
      if (best === cur || best === -1) continue;
      const better = streamRankDist[cur]! - streamRankDist[best]! > RANK_SWITCH_MARGIN_M;
      const held = t - rankSwitchT[r]! >= RANK_MIN_HOLD_S;
      const curTaken = r === 1 && cur === rankCurrent[0];
      // Never start a switch while the previous handoff is still running: cars not yet handed over
      // would jump straight from the old-old stream to the new one.
      const settled = t - rankSwitchT[r]! >= HANDOFF_SPREAD_S + 2 * HANDOFF_FADE_S;
      if (settled && ((better && held) || curTaken)) {
        rankPrevious[r] = cur;
        rankCurrent[r] = best;
        rankSwitchT[r] = t;
      }
    }
  }
  /** Stream for a chase car of rank r at time t, and the handoff fade multiplier (via out). */
  const handoff = { stream: 0, fade: 1 };
  function chaseStream(r: number, car: number, t: number): void {
    const prev = rankPrevious[r]!;
    const cur = rankCurrent[r]!;
    handoff.fade = 1;
    handoff.stream = cur;
    if (prev < 0) return;
    const d = t - rankSwitchT[r]! - hash01(car, 0x5b1f) * HANDOFF_SPREAD_S;
    if (d < 0) { handoff.stream = prev; return; }
    if (d < HANDOFF_FADE_S) { handoff.stream = prev; handoff.fade = 1 - d / HANDOFF_FADE_S; return; }
    if (d < 2 * HANDOFF_FADE_S) { handoff.fade = (d - HANDOFF_FADE_S) / HANDOFF_FADE_S; return; }
  }

  // ---- R15 tier transitions (glitch fix): a quality change no longer drops or adds 1,200 cars in one
  // frame. The larger set stays drawn for TIER_FADE_S while the cars beyond the smaller count fade.
  const TIER_FADE_S = 1.2;
  let tierFrom = -1;
  let tierTo = -1;
  let tierChangeT = -1;
  let tierPending = false;
  let tierBudget = 0;
  function applyTierTransition(t: number): void {
    if (tierPending) { tierChangeT = t; tierPending = false; }
    if (tierFrom < 0) return;
    if (t - tierChangeT >= TIER_FADE_S || t < tierChangeT) {
      tierFrom = -1;
      streakBudget = tierBudget;
      setActiveCount(tierTo);
    }
  }
  function tierFadeFor(car: number, t: number): number {
    if (tierFrom < 0 || car < Math.min(tierFrom, tierTo)) return 1;
    const k = Math.min(1, Math.max(0, (t - tierChangeT) / TIER_FADE_S));
    return tierTo > tierFrom ? k : 1 - k;
  }

  // ---- R16 light trails: per-tier budget, crossfaded on a tier change like the car counts.
  let trailFrom: TrafficTrailMode = options.quality.trails;
  let trailTo: TrafficTrailMode = options.quality.trails;
  let trailChangeT = -1e9;
  let trailPending = false;
  let trailsAllowed = true;
  const trailNearStartSq = (TRAIL_NEAR_M - 200) * (TRAIL_NEAR_M - 200);
  const trailNearEndSq = TRAIL_NEAR_M * TRAIL_NEAR_M;
  /** cls: 0 escort, 1 stream car, 2 free car. */
  function trailWeightFor(mode: TrafficTrailMode, cls: number, distanceSq: number): number {
    if (mode === 'all') return 1;
    if (mode === 'streams') return cls === 1 ? 1 : 0;
    return 1 - smoothstep(trailNearStartSq, trailNearEndSq, distanceSq);
  }
  function trailWeight(cls: number, distanceSq: number, t: number): number {
    if (!trailsAllowed) return 0;
    if (trailPending) { trailChangeT = t; trailPending = false; }
    const to = trailWeightFor(trailTo, cls, distanceSq);
    if (trailFrom === trailTo) return to;
    const k = smoothstep(0, TIER_FADE_S, t - trailChangeT);
    if (k >= 1) trailFrom = trailTo;
    return trailWeightFor(trailFrom, cls, distanceSq) * (1 - k) + to * k;
  }
  function setTrailsAllowed(allowed: boolean): void {
    trailsAllowed = allowed;
  }

  function setActiveCount(n: number): void {
    activeCars = n;
    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      const group = groupCars[archetype];
      let active = 0;
      while (active < group.length && group[active] < n) active += 1;
      groupActive[archetype] = active;
      meshes[archetype].count = active;
    }
  }
  // R12 perf: each stream's centre line is baked once into a path table (8 m steps around the loop),
  // so a car costs one table lookup. R18: the table is shared with the GPU impostor cars
  // (trafficStreams.ts), so both populations fly exactly the same corridors. R21: the table now
  // holds four branch variants per stream and the analytic d/dv slopes.
  const mainRowSample = { cx: 0, cy: 0, sx: 0, sy: 0 };
  /** Main-variant centre (x, y) and lateral slope of stream k at v, for the chase-rank ranking. */
  function streamCentre(k: number, v: number, out: Float64Array): void {
    let w = v % CANYON_LOOP_LENGTH_M;
    if (w < 0) w += CANYON_LOOP_LENGTH_M;
    sampleStreamPath(model.table, bakedPathRow(k, 0), w / STREAM_PATH_STEP_M, mainRowSample);
    out[0] = mainRowSample.cx;
    out[1] = mainRowSample.cy;
    out[2] = mainRowSample.sx;
  }
  /** Loads a non-chase stream car's stored R21 flow back into the shared sample shape. */
  function loadCarFlow(car: number, out: typeof carFlowScratch): void {
    const path = carStream[car]!;
    out.path = path;
    out.kind = STREAM_DESCRIPTORS[path]!.kind;
    out.direction = STREAM_DESCRIPTORS[path]!.direction;
    out.sampledCruiseMps = carCruiseMps[car]!;
    out.convoy = carConvoy[car] === 1;
    out.convoyRatio = out.convoy ? carEffectiveMps[car]! / carCruiseMps[car]! : 1;
    out.effectiveMps = carEffectiveMps[car]!;
    out.passAmplitudeM = carPassAmpM[car]!;
    out.passPeriodS = carPassPeriodS[car]!;
    out.forkBits = carForkBits[car]!;
    out.bakedRowA = carRouteA[car]!;
    out.bakedRowB = carRouteB[car]!;
    out.hop = out.bakedRowB !== out.bakedRowA;
    out.hopTarget = out.hop ? pathOfBakedRow(out.bakedRowB) : path;
    out.hopStartM = carHopStartM[car]!;
    out.hopRampM = carHopRampM[car]!;
    out.scatterRow = scatterRowOf(carPhase[car]!, carAppearance[car]!);
  }

  function setQuality(quality: TrafficQuality): void {
    assertQuality(quality, maxCarCount);
    if (quality.thrusterBudget > streakCapacity) fail('SKYRIVER_TRAFFIC_TIER_GLOW_OVER_CAPACITY');

    streakBudget = quality.thrusterBudget;
    impostorTier = quality.impostors;
    retargetImpostors();
    if (quality.trails !== trailTo) {
      trailFrom = trailTo;
      trailTo = quality.trails;
      trailPending = true;
    }
    if (activeCars > 0 && quality.carCount !== activeCars && tierTo !== quality.carCount) {
      // Mid-flight change: draw the larger set while the difference fades (applyTierTransition).
      tierFrom = tierFrom >= 0 ? tierTo : activeCars;
      tierTo = quality.carCount;
      tierPending = true;
      tierBudget = quality.thrusterBudget;
      streakBudget = Math.min(streakCapacity, Math.max(quality.thrusterBudget, tierFrom));
      setActiveCount(Math.max(tierFrom, tierTo));
      return;
    }
    setActiveCount(quality.carCount);
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
      updateRankAssignment(t);
    }
    applyTierTransition(t);

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
            // R15: fade at the wrap ends (it used to pop in 520 m ahead and vanish 520 m behind).
            fade = smoothstep(0, 140, 520 - Math.abs(forward));
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
          let inStream = false;
          let jink = 0;
          if (carStream[car]! !== 255 && (anchorValid || !isChase)) {
            // Stream member on the shared R21 model: the stream sets direction, shelf and corridor;
            // the car's own flow sets its cruise speed, convoy, passing, branch and course change.
            inStream = true;
            let k = carStream[car]!;
            if (isChase) {
              chaseStream(carStream[car]!, car, t);
              k = handoff.stream;
              fade *= handoff.fade;
              // A sticky R15 car's stream is a rank the handoff can move, so its flow is sampled for
              // the stream it is on now. It never forks and never hops: R15 owns its route.
              carFlowInput.path = k;
              carFlowInput.index = car;
              carFlowInput.salt = model.carSalt;
              carFlowInput.pulse = Math.floor(carPhase[car]! * STREAMS[k]![8]!);
              carFlowInput.row = carRow[car]!;
              carFlowInput.phase = carPhase[car]!;
              carFlowInput.appearanceSeed = carAppearance[car]!;
              carFlowInput.hopShare = 0;
              carFlowInput.allowForks = false;
              sampleStreamFlow(model, carFlowInput, carFlowScratch);
            } else {
              loadCarFlow(car, carFlowScratch);
            }
            direction = carFlowScratch.direction;
            speed = carFlowScratch.effectiveMps;
            if (isChase) {
              const absolute = carPhase[car]! * CHASE_WINDOW_M + direction * speed * t;
              let rel = (absolute - anchor[6]! + CHASE_WINDOW_M * 0.5) % CHASE_WINDOW_M;
              if (rel < 0) rel += CHASE_WINDOW_M;
              rel -= CHASE_WINDOW_M * 0.5;
              fade *= smoothstep(0, CHASE_FADE_M, CHASE_WINDOW_M * 0.5 - Math.abs(rel));
              v = anchor[6]! + rel;
            } else {
              v = carPhase[car]! * CANYON_LOOP_LENGTH_M + direction * speed * t;
            }
            evaluateCanyonPose(model, carFlowScratch, v, t, carPhase[car]!, carAppearance[car]!, carRow[car]!, carPose);
            x = clamp(carPose.x, -CAR_CORRIDOR_HALF_M, CAR_CORRIDOR_HALF_M);
            y = carPose.y;
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
          let headingCos: number;
          let headingSin: number;
          if (inStream) {
            // R21: a stream car reads the baked warp row, the row the GPU impostors sample, so both
            // populations share one corridor instead of two near-identical ones.
            sampleWarpRow(model.table, carPose.wrappedM / STREAM_PATH_STEP_M, carWarpRow);
            px = carWarpRow.x + x * carWarpRow.cos;
            pz = carWarpRow.z - x * carWarpRow.sin;
            headingCos = carWarpRow.cos;
            headingSin = carWarpRow.sin;
          } else {
            warpCanyon(x, v, carWarp);
            px = carWarp.x;
            pz = carWarp.z;
            headingCos = Math.cos(carWarp.heading);
            headingSin = Math.sin(carWarp.heading);
          }
          py = y;
          // Velocity in canyon space (across, along, up), then turned to world. A stream car's
          // across and up rates come from its own path: branch and course-change slopes included.
          const along = direction * speed;
          const across = inStream ? (carPose.dxdv + Math.tan(jink)) * along + carPose.xRate : driftRate;
          const up = inStream ? carPose.dydv * along + carPose.yRate : climbRate;
          if (inStream) streakSpeed = speed;
          // along = (sin h, cos h), across = (cos h, -sin h)
          carDir.x = along * headingSin + across * headingCos;
          carDir.z = along * headingCos - across * headingSin;
          const horizontal = Math.hypot(carDir.x, carDir.z) || 1;
          fx = carDir.x / horizontal;
          fz = carDir.z / horizontal;
          fy = up / Math.max(20, Math.abs(speed));
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
        // R15 glitch fix: the hard cut made ~20 bodies a second blink in or out on screen; bodies now
        // shrink away over the last 220 m (sub-pixel by then), so nothing pops.
        const toCarDist = Math.sqrt(toCarX * toCarX + toCarY * toCarY + toCarZ * toCarZ);
        const hullLod = 1 - smoothstep(HULL_DRAW_FADE_START_M, HULL_DRAW_DISTANCE_M, toCarDist);
        fade *= tierFadeFor(car, t);

        // Basis: forward f (with a little pitch), right = f x up, then banked about f.
        // Bodies vanish with their fade (a faded car is never left as a small dark block).
        const scale = sizeScale[car]! * hullLod * smoothstep(0, 0.45, fade);
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
        const distanceM = Math.sqrt(distanceSq);
        const legacyFarAlpha = carThinFar[car] === 1
          ? 1 - smoothstep(900 * 900, 1150 * 1150, distanceSq)
          : 1;
        // Hull bars, streak lamps, and trails use one fade. Low tier keeps its prior far response.
        const lightFade = fade * cpuLightVisibilityAlpha(distanceM, impostorPresence, legacyFarAlpha);
        const dim = (1 - (1 - DISTANCE_DIM_FLOOR) * Math.min(1, distanceSq * invDimRangeSq)) * lightFade;
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
          const f4 = streaksUsed * 4;
          streakFadeArray[f4] = lightFade;
          streakFadeArray[f4 + 1] = sizeScale[car]!;
          streakFadeArray[f4 + 2] = carWarm[car]!;
          streakFadeArray[f4 + 3] = trailWeight(car < ESCORT_COUNT && anchorValid ? 0 : carStream[car]! !== 255 ? 1 : 2, distanceSq, t);
          streaksUsed += 1;
        }
      }

      const mesh = meshes[archetype];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }

    streakGeometry.instanceCount = streaksUsed;
    applyImpostors(t);
    streakPos.needsUpdate = true;
    streakDir.needsUpdate = true;
    streakFade.needsUpdate = true;
  }

  /** Radians per drawing-buffer pixel, vertically. The scene calls this on resize. */
  function setPixelAngle(radiansPerPixel: number): void {
    impostorMaterial.uniforms.uPixelAngle!.value = radiansPerPixel;
    streakMaterial.uniforms.uPixelAngle!.value = radiansPerPixel;
  }

  function stats(): TrafficStats {
    let triangles = 0;
    for (let archetype = 0; archetype < RENDER_ARCHETYPES; archetype += 1) {
      triangles += trianglesPerArchetype[archetype] * groupActive[archetype];
    }
    triangles += streaksUsed * 10 + impostorGeometry.instanceCount * 2;
    return {
      activeCars,
      activeThrusters: streaksUsed,
      impostors: impostorGeometry.instanceCount,
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
    impostorGeometry.dispose();
    impostorMaterial.dispose();
    pathTexture.dispose();
  }

  setQuality(options.quality);

  return { objects, update, setQuality, setTrailsAllowed, setImpostorCount, setPixelAngle, setAnchor, stats, dispose };
}
