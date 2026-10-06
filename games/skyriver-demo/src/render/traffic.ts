/**
 * @file traffic.ts — the Skyriver traffic swarm (T4): thousands of free-flying vehicles rendered as
 * three instanced archetypes plus one additive glow batch, four draw calls total.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R4 — ">= 2,000 flying vehicles as a street-free open-air swarm with Fifth Element altitude
 *     layers; 3 instanced archetypes + thruster quads; <= 4 traffic draw calls; transforms evaluated
 *     from float math at interpolated time tick + renderAlpha".
 *   Design "Sim <-> render split" — "traffic transforms (evaluated at interpolated time so 30 Hz sim
 *     renders smoothly). Traffic never feeds simulation".
 *   Design "City / traffic model" — "3 archetypes + thruster quads", "2,400 cars x 60 Hz ~ 144k
 *     evaluations/s ~ 15-40 M ops/s — budgeted, measured, tiered".
 *   Design "Performance" — quality tiers cars 2,400 -> 1,200 -> 600, presentation-only.
 *   T4 — "Verify: >= 2,000 instances in <= 4 draw calls; frame grid street-free".
 *
 * What this file is, and is not:
 *   - Presentation only. It reads seeded parameters from ../sim/derive and the flight volume from
 *     ../sim/systems, and it writes nothing back. Nothing here is checksummed, so float math and a
 *     local value noise are correct choices; none of it may ever influence simulation.
 *   - Street-free by construction. There is no ground plane, no road, no lane geometry and no path
 *     mesh of any kind in this module. Vehicles fly free on open orbital courses through the volume.
 *
 * Motion model (see evaluate() below):
 *   Each car rides its own wide, slow, closed course through the chasm volume: a per-car ellipse
 *   centre, radius, direction and angular rate, taken from the derived band/lane/speed/phase, with a
 *   local value-noise weave layered on top. Closed courses matter for two reasons. They never
 *   teleport a car (a wrapping volume pops vehicles in mid-air in front of the camera), and the
 *   tangent of the course is already a unit vector, so one sin/cos pair per car yields both the
 *   position and the full orientation basis — which is the whole per-car trig budget the plan allows.
 *   Courses differ per car in centre, radius, rate and direction, so the swarm reads as a diffuse
 *   school of fish at every altitude and heading, never as a formation or a lane.
 *
 * GC discipline:
 *   The per-car work allocates nothing: every per-car constant is precomputed into typed arrays at
 *   init, and transforms are written straight into the InstancedMesh instanceMatrix/instanceColor
 *   buffers by index arithmetic. No Matrix4, Vector3, Color, closure or array literal appears in the
 *   hot loop. Measured heap growth is flat at ~16 bytes per update() call whether 1 car or 2,400 are
 *   active — that residue is V8 boxing the single double time argument across a non-inlined call,
 *   not garbage this module creates, and it works out to about 1 KB/s at 60 Hz.
 *
 * API anchors (games/skyriver-demo/node_modules/three, ~0.170):
 *   src/renderers/shaders/ShaderChunk/color_vertex.glsl.js — USE_INSTANCING_COLOR multiplies
 *     vColor by instanceColor, and USE_COLOR multiplies it by the vertex colour attribute, so a
 *     MeshBasicMaterial with vertexColors gets both the baked archetype shading and the per-car tint.
 *   src/renderers/webgl/WebGLPrograms.js:198 — instancingColor is enabled when instanceColor is set.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  InstancedBufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DataTexture,
  DynamicDrawUsage,
  InstancedMesh,
  LinearFilter,
  MeshBasicMaterial,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import type { Object3D } from 'three';

import { deriveTrafficParams, TRAFFIC_ARCHETYPE_COUNT, TRAFFIC_MAX_CARS } from '../sim/derive';
import { CHASM_BOUNDS, SKYRIVER_TICK_RATE } from '../sim/systems';

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

/** Draw calls this module adds: one InstancedMesh per archetype, plus one glow batch (R4: <= 4). */
const TRAFFIC_DRAW_CALLS = TRAFFIC_ARCHETYPE_COUNT + 1;

/**
 * The plan's quality tiers (Design "Performance": cars 2,400 -> 1,200 -> 600). Glow budgets stay
 * under the brief's 1,500 ceiling at the top tier and scale down with the car count.
 */
export const TRAFFIC_QUALITY_TIERS: {
  readonly high: TrafficQuality;
  readonly medium: TrafficQuality;
  readonly low: TrafficQuality;
} = Object.freeze({
  high: Object.freeze({ carCount: 2400, thrusterBudget: 1500 }),
  medium: Object.freeze({ carCount: 1200, thrusterBudget: 800 }),
  low: Object.freeze({ carCount: 600, thrusterBudget: 400 }),
});

/** Inset from the volume walls, metres. Keeps vehicles clear of T3's tower faces. */
const WALL_MARGIN_M = 50;
/** Vertical clearance kept from the volume's floor and ceiling, metres. */
const CEILING_MARGIN_M = 40;

/** Course radius range, metres. Wide courses sweep the whole chasm; tight ones loiter in a pocket. */
const COURSE_MIN_RADIUS_M = 70;
const COURSE_RADIUS_SPAN_M = 250;
/** Radial spread applied from the derived lane offset, metres. Breaks cars off a shared course. */
const LANE_RADIAL_SPREAD_M = 22;
/** Vertical spread applied from the derived lane offset, metres. Thickens each altitude layer. */
const LANE_VERTICAL_SPREAD_M = 26;

/** Value-noise weave: radial and vertical amplitude ranges, metres, and rate range, hertz. */
const WEAVE_RADIAL_MIN_M = 12;
const WEAVE_RADIAL_SPAN_M = 20;
const WEAVE_VERTICAL_MIN_M = 5;
const WEAVE_VERTICAL_SPAN_M = 14;
const WEAVE_MIN_RATE_HZ = 0.05;
const WEAVE_RATE_SPAN_HZ = 0.12;
/** How hard a car banks into its weave. Radians of roll per unit of noise. */
const BANK_PER_NOISE = 0.38;

/** Per-car size jitter, so a batch of identical hulls does not read as a clone army. */
const SIZE_MIN_SCALE = 0.9;
const SIZE_SCALE_SPAN = 0.26;

/** Distance dimming: a car this far away keeps DISTANCE_DIM_FLOOR of its tint. */
const DISTANCE_DIM_RANGE_M = 900;
const DISTANCE_DIM_FLOOR = 0.42;

/** Glow quad sizing, metres: a close engine flare, growing with distance so far lights stay visible. */
const GLOW_BASE_SIZE_M = 2.6;
const GLOW_SIZE_PER_METRE = 0.0075;
const GLOW_MAX_SIZE_M = 9;
/** Where the glow sits along the hull, metres: ahead of the nose, or behind the tail. */
const GLOW_NOSE_OFFSET_M = 2.6;
const GLOW_TAIL_OFFSET_M = 2.9;
/**
 * Near-range glow damping. A glow drawn at full strength onto a hull that fills a good part of the
 * screen washes the hull out, and R4 wants a vehicle to be a discernible shape up close and a moving
 * light far away. So a glow fades toward GLOW_NEAR_FLOOR as its car approaches the camera.
 */
const GLOW_NEAR_FADE_M = 70;
const GLOW_NEAR_FLOOR = 0.4;

/** Headlight glow, cyan-white core. Taillight glow, warm red. Both scaled by pulse and fade. */
const GLOW_HEAD_R = 0.74;
const GLOW_HEAD_G = 0.93;
const GLOW_HEAD_B = 1;
const GLOW_TAIL_R = 1;
const GLOW_TAIL_G = 0.3;
const GLOW_TAIL_B = 0.22;
/** Thruster pulse depth, as a fraction of full brightness. */
const GLOW_PULSE_DEPTH = 0.22;
const GLOW_PULSE_RATE_HZ = 2.6;

/** Glow selection radius bounds, metres, and the per-frame gain of the budget controller. */
const GLOW_MIN_RADIUS_M = 70;
const GLOW_MAX_RADIUS_M = 1500;
const GLOW_RADIUS_START_M = 520;
const GLOW_RADIUS_SHRINK = 0.94;
const GLOW_RADIUS_GROW = 1.05;
/** Below this fill fraction the controller opens the radius back up. */
const GLOW_FILL_TARGET = 0.9;

const GLOW_TEXTURE_SIZE = 32;

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
  const body = 0.36;
  const r = body;
  const g = body * 0.78;
  const b = body * 0.14;

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
  const r = 0.17;
  const g = 0.18;
  const b = 0.21;

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
  const r = 0.24;
  const g = 0.26;
  const b = 0.29;

  pushBox(build, 0, -0.26, 0, 2.2, 0.72, 4.2, r, g, b);
  pushDome(build, 0, 0.06, 0.1, 1.02, 1.1, 1.9, 8, 3, 0.2, 0.34, 0.4);
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

/** A single camera-facing quad in the XY plane, the glow billboard. 2 triangles. */
function buildGlowQuad(): BufferGeometry {
  const geometry = new BufferGeometry();
  const half = 0.5;
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([
    -half, -half, 0, half, -half, 0, half, half, 0,
    -half, -half, 0, half, half, 0, -half, half, 0,
  ]), 3));
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]), 2));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Generates the glow sprite: a white core falling off to nothing, in both colour and alpha, so an
 * additive draw reads as a soft light rather than a disc. Per-instance colour tints it cyan-white
 * for a headlight or red for a taillight. Procedural, so the demo keeps its zero-asset promise.
 */
function buildGlowTexture(): DataTexture {
  const size = GLOW_TEXTURE_SIZE;
  const data = new Uint8Array(size * size * 4);
  const centre = (size - 1) / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - centre) / radius;
      const dy = (y - centre) / radius;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Soft shoulder with a tight core: (1 - d)^2.6, plus a small hot centre.
      const falloff = distance >= 1 ? 0 : Math.pow(1 - distance, 2.6);
      const core = distance >= 0.34 ? 0 : (1 - distance / 0.34) * 0.5;
      const intensity = clamp(falloff + core, 0, 1);
      const byte = Math.round(intensity * 255);
      const offset = (y * size + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = byte;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/* ------------------------------------------------------------------------------------------------
 * The swarm.
 * ---------------------------------------------------------------------------------------------- */

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

/**
 * Builds the traffic swarm.
 *
 * Everything that costs real work happens here, once: the seeded parameter derivation, the archetype
 * geometry, the per-car course constants, and the instance buffers. After this, a frame costs one
 * arithmetic pass over the active cars.
 *
 * No WebGL object is created at module scope, so importing this file in node (the determinism suite)
 * is safe; only this factory touches three.js constructors, and those stay renderer-less until the
 * meshes are added to a rendered scene.
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
  const fieldX = (bounds.minX + bounds.maxX) / 2;
  const fieldZ = (bounds.minZ + bounds.maxZ) / 2;
  const halfX = (bounds.maxX - bounds.minX) / 2 - WALL_MARGIN_M;
  const halfZ = (bounds.maxZ - bounds.minZ) / 2 - WALL_MARGIN_M;
  // One circular reach, so a course that fits it cannot overrun either wall at any heading.
  const reach = Math.min(halfX, halfZ);
  const floorY = bounds.minY + CEILING_MARGIN_M;
  const ceilingY = bounds.maxY - CEILING_MARGIN_M;
  if (reach <= COURSE_MIN_RADIUS_M || ceilingY <= floorY) fail('SKYRIVER_TRAFFIC_BOUNDS_TOO_SMALL');

  const params = deriveTrafficParams(options.seed, maxCarCount);

  // ---- Per-car course constants. Indexed by global car index, so a tier change recomputes nothing.
  const courseCentreX = new Float32Array(maxCarCount);
  const courseCentreZ = new Float32Array(maxCarCount);
  const courseRadius = new Float32Array(maxCarCount);
  const courseRate = new Float32Array(maxCarCount);
  const courseDirection = new Float32Array(maxCarCount);
  const courseAngle0 = new Float32Array(maxCarCount);
  const baseY = new Float32Array(maxCarCount);
  const weaveRadial = new Float32Array(maxCarCount);
  const weaveVertical = new Float32Array(maxCarCount);
  const weaveRate = new Float32Array(maxCarCount);
  const sizeScale = new Float32Array(maxCarCount);
  const tintR = new Float32Array(maxCarCount);
  const tintG = new Float32Array(maxCarCount);
  const tintB = new Float32Array(maxCarCount);
  const pulseOffset = new Float32Array(maxCarCount);

  const archetypeTotals = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);
  for (let car = 0; car < maxCarCount; car += 1) {
    const archetype = params.archetype[car];
    if (archetype >= TRAFFIC_ARCHETYPE_COUNT) fail('SKYRIVER_TRAFFIC_ARCHETYPE_OUT_OF_RANGE');
    archetypeTotals[archetype] = archetypeTotals[archetype] + 1;
  }
  // Car indices grouped by archetype, each group ascending. Ascending order is what makes a lower
  // tier a prefix of every group: tier N is exactly the entries whose car index is below N.
  const groupCars: Int32Array[] = [];
  for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
    groupCars.push(new Int32Array(archetypeTotals[archetype]));
  }
  const groupFill = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);

  for (let car = 0; car < maxCarCount; car += 1) {
    const lane = params.lane[car];
    const speed = params.speed[car];
    const phase = params.phase[car];
    const altitude = params.altitude[car];
    const archetype = params.archetype[car];

    const group = groupCars[archetype];
    group[groupFill[archetype]] = car;
    groupFill[archetype] = groupFill[archetype] + 1;

    const radialWeave = WEAVE_RADIAL_MIN_M + hash01(car, 0x51ed) * WEAVE_RADIAL_SPAN_M;
    const verticalWeave = WEAVE_VERTICAL_MIN_M + hash01(car, 0x2f3b) * WEAVE_VERTICAL_SPAN_M;
    weaveRadial[car] = radialWeave;
    weaveVertical[car] = verticalWeave;
    weaveRate[car] = WEAVE_MIN_RATE_HZ + hash01(car, 0x7a17) * WEAVE_RATE_SPAN_HZ;

    // Course radius, spread by the derived lane offset, then capped so the weave still fits inside
    // the volume. Courses larger than the reach would scrape T3's tower faces.
    const maxRadius = reach - radialWeave;
    const nominal = COURSE_MIN_RADIUS_M + hash01(car, 0x1d3f) * COURSE_RADIUS_SPAN_M;
    const radius = clamp(nominal + lane * LANE_RADIAL_SPREAD_M, 25, maxRadius);
    courseRadius[car] = radius;

    // Centre offset, bounded so |position - field centre| <= reach for every angle and weave value.
    const centreLimit = Math.max(0, reach - radius - radialWeave);
    const centreAngle = hash01(car, 0x63c9) * TAU;
    const centreDistance = Math.sqrt(hash01(car, 0x9b27)) * centreLimit;
    courseCentreX[car] = fieldX + Math.cos(centreAngle) * centreDistance;
    courseCentreZ[car] = fieldZ + Math.sin(centreAngle) * centreDistance;

    // Angular rate preserves the derived linear speed: omega = v / r. The derived sign of the speed
    // stays the direction of travel, so counter-flowing bands stay counter-flowing.
    courseRate[car] = speed / radius;
    courseDirection[car] = speed >= 0 ? 1 : -1;
    courseAngle0[car] = phase * TAU;

    baseY[car] = clamp(
      altitude + lane * LANE_VERTICAL_SPREAD_M,
      floorY + verticalWeave,
      ceilingY - verticalWeave,
    );

    sizeScale[car] = SIZE_MIN_SCALE + hash01(car, 0x4e8d) * SIZE_SCALE_SPAN;

    // Per-car tint around white: paint variation on top of the archetype's baked hull colour.
    const warm = hash01(car, 0x33b1);
    const level = 0.82 + hash01(car, 0x1771) * 0.34;
    tintR[car] = level * (0.88 + warm * 0.26);
    tintG[car] = level * (0.95 + warm * 0.05);
    tintB[car] = level * (1.12 - warm * 0.3);

    pulseOffset[car] = phase * 11.37;
  }

  // ---- Geometry, materials, meshes.
  const carMaterial = new MeshBasicMaterial({ vertexColors: true });
  carMaterial.name = 'skyriver.traffic.hull';

  const glowTexture = buildGlowTexture();
  const glowMaterial = new MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    // Towers and the shuttle must occlude a glow, so depth testing stays on.
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  glowMaterial.name = 'skyriver.traffic.glow';

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
    // The swarm fills the whole volume and every matrix changes per frame, so the instanced bounding
    // sphere would be stale every frame. Culling the batch is never a win here; disable it.
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

  const glowGeometry = buildGlowQuad();
  const glowCapacity = Math.max(1, options.maxThrusterBudget ?? options.quality.thrusterBudget);
  const glowMesh = new InstancedMesh(glowGeometry, glowMaterial, glowCapacity);
  glowMesh.name = 'skyriver.traffic.glow';
  glowMesh.frustumCulled = false;
  glowMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const glowInstanceColor = new InstancedBufferAttribute(new Float32Array(glowCapacity * 3), 3);
  glowInstanceColor.setUsage(DynamicDrawUsage);
  glowMesh.instanceColor = glowInstanceColor;
  glowMesh.count = 0;
  // Glows are additive and unlit: draw them after the opaque city so they read as light on top.
  glowMesh.renderOrder = 10;
  const glowMatrices = glowMesh.instanceMatrix.array as Float32Array;
  const glowColors = glowInstanceColor.array as Float32Array;

  const objects: Object3D[] = [meshes[0], meshes[1],
    meshes[2], glowMesh];

  // ---- Mutable tier state. Written by setQuality(), read by the hot loop.
  const groupActive = new Int32Array(TRAFFIC_ARCHETYPE_COUNT);
  let activeCars = 0;
  let glowBudget = 0;
  let glowUsed = 0;
  /**
   * The glow selection controller's state: [0] radius in metres, [1] its square.
   *
   * A typed array rather than two closure-scope `let` doubles on purpose. A double held in a closure
   * context and reassigned every frame is boxed into a fresh heap number on each write, which is a
   * small per-frame allocation in an update path that is otherwise allocation-free. A Float64Array
   * slot stores the bits directly. (glowUsed stays a plain variable: small integers are not boxed.)
   */
  const glowControl = new Float64Array(2);
  glowControl[0] = GLOW_RADIUS_START_M;
  glowControl[1] = GLOW_RADIUS_START_M * GLOW_RADIUS_START_M;

  const invDimRangeSq = 1 / (DISTANCE_DIM_RANGE_M * DISTANCE_DIM_RANGE_M);

  function setQuality(quality: TrafficQuality): void {
    assertQuality(quality, maxCarCount);
    if (quality.thrusterBudget > glowCapacity) fail('SKYRIVER_TRAFFIC_TIER_GLOW_OVER_CAPACITY');

    activeCars = quality.carCount;
    glowBudget = quality.thrusterBudget;

    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      const group = groupCars[archetype];
      let active = 0;
      // Groups are ascending, so the active set is the prefix of car indices below the tier count.
      while (active < group.length && group[active] < activeCars) active += 1;
      groupActive[archetype] = active;
      meshes[archetype].count = active;
    }
  }

  /**
   * Re-evaluates every active car. One sin/cos pair, two noise samples and one matrix write per car;
   * one extra noise sample and two square roots for a car that also earns a glow quad.
   */
  function update(time: TrafficTime, camera: TrafficPoint): void {
    const t = secondsOf(time);
    const camX = camera.x;
    const camY = camera.y;
    const camZ = camera.z;
    glowUsed = 0;

    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      const group = groupCars[archetype];
      const active = groupActive[archetype];
      const matrices = matrixArrays[archetype];
      const colors = colorArrays[archetype];

      for (let slot = 0; slot < active; slot += 1) {
        const car = group[slot];
        const noiseLane = car * 3;

        // --- Course position at continuous time.
        const angle = courseAngle0[car] + courseRate[car] * t;
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);

        const weavePhase = t * weaveRate[car];
        const weaveA = valueNoise(noiseLane, weavePhase);
        const weaveB = valueNoise(noiseLane + 1, weavePhase * 0.73);

        const radius = courseRadius[car] + weaveA * weaveRadial[car];
        const px = courseCentreX[car] + radius * ca;
        const pz = courseCentreZ[car] + radius * sa;
        const py = baseY[car] + weaveB * weaveVertical[car];

        // --- Orientation. The course tangent is already unit length, so no normalize is needed.
        const direction = courseDirection[car];
        const fx = -sa * direction;
        const fz = ca * direction;

        // Bank into the weave. (R0 + up * b) / sqrt(1 + b*b) is an exact rotation of the basis
        // about the forward axis, for one square root and no trig.
        const bank = weaveA * BANK_PER_NOISE * direction;
        const inv = 1 / Math.sqrt(1 + bank * bank);
        const scale = sizeScale[car];
        const rightScale = inv * scale;
        const rx = fz * rightScale;
        const ry = bank * rightScale;
        const rz = -fx * rightScale;
        const ux = -fz * bank * rightScale;
        const uy = rightScale;
        const uz = fx * bank * rightScale;

        const offset = slot * 16;
        matrices[offset] = rx;
        matrices[offset + 1] = ry;
        matrices[offset + 2] = rz;
        matrices[offset + 3] = 0;
        matrices[offset + 4] = ux;
        matrices[offset + 5] = uy;
        matrices[offset + 6] = uz;
        matrices[offset + 7] = 0;
        matrices[offset + 8] = fx * scale;
        matrices[offset + 9] = 0;
        matrices[offset + 10] = fz * scale;
        matrices[offset + 11] = 0;
        matrices[offset + 12] = px;
        matrices[offset + 13] = py;
        matrices[offset + 14] = pz;
        matrices[offset + 15] = 1;

        // --- Distance dimming, so the far swarm settles into the haze instead of speckling it.
        const dx = px - camX;
        const dy = py - camY;
        const dz = pz - camZ;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        const dim = 1 - (1 - DISTANCE_DIM_FLOOR) * Math.min(1, distanceSq * invDimRangeSq);
        const colorOffset = slot * 3;
        colors[colorOffset] = tintR[car] * dim;
        colors[colorOffset + 1] = tintG[car] * dim;
        colors[colorOffset + 2] = tintB[car] * dim;

        // --- Glow quad, for cars inside the self-tuning selection radius while the budget lasts.
        if (glowUsed < glowBudget && distanceSq < glowControl[1] && distanceSq > 1e-6) {
          const invDistance = 1 / Math.sqrt(distanceSq);
          const distance = distanceSq * invDistance;
          // Unit vector from the car toward the camera: the billboard's forward axis.
          const bfx = -dx * invDistance;
          const bfy = -dy * invDistance;
          const bfz = -dz * invDistance;

          // Is the camera ahead of the car (headlights) or behind it (thrusters)?
          const facing = fx * bfx + fz * bfz;
          const along = facing > 0 ? GLOW_NOSE_OFFSET_M : -GLOW_TAIL_OFFSET_M;

          // Billboard basis: right = up x forward, then up = forward x right.
          let brx = bfz;
          let brz = -bfx;
          const rightLengthSq = brx * brx + brz * brz;
          let bry = 0;
          if (rightLengthSq > 1e-8) {
            const invRight = 1 / Math.sqrt(rightLengthSq);
            brx *= invRight;
            brz *= invRight;
          } else {
            // Camera straight above or below: any perpendicular will do.
            brx = 1;
            brz = 0;
          }
          const bux = bfy * brz;
          const buy = bfz * brx - bfx * brz;
          const buz = -bfy * brx;

          const size = Math.min(GLOW_MAX_SIZE_M, GLOW_BASE_SIZE_M + distance * GLOW_SIZE_PER_METRE)
            * sizeScale[car];

          const glowOffset = glowUsed * 16;
          glowMatrices[glowOffset] = brx * size;
          glowMatrices[glowOffset + 1] = bry * size;
          glowMatrices[glowOffset + 2] = brz * size;
          glowMatrices[glowOffset + 3] = 0;
          glowMatrices[glowOffset + 4] = bux * size;
          glowMatrices[glowOffset + 5] = buy * size;
          glowMatrices[glowOffset + 6] = buz * size;
          glowMatrices[glowOffset + 7] = 0;
          glowMatrices[glowOffset + 8] = bfx * size;
          glowMatrices[glowOffset + 9] = bfy * size;
          glowMatrices[glowOffset + 10] = bfz * size;
          glowMatrices[glowOffset + 11] = 0;
          glowMatrices[glowOffset + 12] = px + fx * along;
          glowMatrices[glowOffset + 13] = py;
          glowMatrices[glowOffset + 14] = pz + fz * along;
          glowMatrices[glowOffset + 15] = 1;

          // Fade out at the selection edge, so a glow entering the radius does not pop on.
          const edge = distanceSq / glowControl[1];
          const fade = 1 - edge * edge;
          const pulseNoise = valueNoise(noiseLane + 2, t * GLOW_PULSE_RATE_HZ + pulseOffset[car]);
          const near = GLOW_NEAR_FLOOR
            + (1 - GLOW_NEAR_FLOOR) * Math.min(1, distance / GLOW_NEAR_FADE_M);
          const brightness = fade * near * (1 - GLOW_PULSE_DEPTH * (0.5 - 0.5 * pulseNoise));

          const glowColorOffset = glowUsed * 3;
          if (facing > 0) {
            glowColors[glowColorOffset] = GLOW_HEAD_R * brightness;
            glowColors[glowColorOffset + 1] = GLOW_HEAD_G * brightness;
            glowColors[glowColorOffset + 2] = GLOW_HEAD_B * brightness;
          } else {
            glowColors[glowColorOffset] = GLOW_TAIL_R * brightness;
            glowColors[glowColorOffset + 1] = GLOW_TAIL_G * brightness;
            glowColors[glowColorOffset + 2] = GLOW_TAIL_B * brightness;
          }
          glowUsed += 1;
        }
      }

      const mesh = meshes[archetype];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }

    glowMesh.count = glowUsed;
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor !== null) glowMesh.instanceColor.needsUpdate = true;

    // Hold the glow budget without sorting: nudge the selection radius toward a full batch. A sort
    // of 2,400 cars per frame would cost more than everything above it put together.
    if (glowBudget > 0) {
      let radius = glowControl[0];
      if (glowUsed >= glowBudget) {
        radius *= GLOW_RADIUS_SHRINK;
      } else if (glowUsed < glowBudget * GLOW_FILL_TARGET) {
        radius *= GLOW_RADIUS_GROW;
      }
      radius = clamp(radius, GLOW_MIN_RADIUS_M, GLOW_MAX_RADIUS_M);
      glowControl[0] = radius;
      glowControl[1] = radius * radius;
    }
  }

  function stats(): TrafficStats {
    let triangles = 0;
    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      triangles += trianglesPerArchetype[archetype] * groupActive[archetype];
    }
    triangles += glowUsed * 2;
    return {
      activeCars,
      activeThrusters: glowUsed,
      drawCalls: TRAFFIC_DRAW_CALLS,
      trianglesPerArchetype,
      trianglesDrawn: triangles,
      glowRadiusM: glowControl[0],
    };
  }

  function dispose(): void {
    for (let archetype = 0; archetype < TRAFFIC_ARCHETYPE_COUNT; archetype += 1) {
      meshes[archetype].dispose();
      geometries[archetype].dispose();
    }
    glowMesh.dispose();
    glowGeometry.dispose();
    carMaterial.dispose();
    glowMaterial.dispose();
    glowTexture.dispose();
  }

  setQuality(options.quality);

  return { objects, update, setQuality, stats, dispose };
}
