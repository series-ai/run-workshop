/**
 * @file trafficStreams.ts — the traffic streams (R11) as shared data, and the R18 GPU impostor cars.
 *
 * R11 streams are flight corridors in canyon space: each holds one direction around the loop on its
 * own altitude shelf, meanders across the corridor, wobbles in height, carries its cars in loose
 * sub-rows, and swaps shelves with a partner at interchanges. traffic.ts evaluates its ~2,400 CPU
 * cars on them. R18 adds impostor cars: 8,000-20,000 light sprites per tier whose positions are
 * evaluated entirely in the vertex shader from a baked path texture (this module bakes it), so the
 * sky fills with traffic at no per-car CPU cost. `impostorPosition` is the CPU mirror of the shader
 * math, for tests (continuity, clearance) and probes.
 *
 * Pure, GL-free, node-testable. Everything is a function of the seed.
 */
import { CANYON_LOOP_LENGTH_M, warpCanyon, type WarpOut } from './canyonWarp';

const TAU = Math.PI * 2;
const L = CANYON_LOOP_LENGTH_M;

/**
 * [x across, shelf y, direction, sub-rows, width m, speed m/s, meander m, wobble m, pulses, share]
 * See traffic.ts (R11) for the design notes.
 */
export const STREAMS: readonly (readonly number[])[] = Object.freeze([
  [-230, 560, 1, 4, 95, 60, 70, 14, 9, 0.17],   // freight, low
  [210, 780, -1, 2, 26, 170, 45, 12, 15, 0.09],  // express
  [-140, 1060, 1, 3, 52, 105, 60, 18, 12, 0.13], // standard
  [250, 1320, -1, 3, 48, 115, 55, 16, 11, 0.13], // standard
  [-275, 1620, 1, 2, 24, 180, 40, 10, 16, 0.09], // express
  [-300, 1900, -1, 4, 100, 65, 60, 20, 8, 0.15], // freight, high
  [190, 2240, 1, 3, 52, 110, 50, 15, 10, 0.12],  // standard, pristine
  [130, 400, -1, 3, 60, 95, 65, 14, 12, 0.12],   // standard, grime
]);
/**
 * R18 GPU-only impostor lanes, same schema (share = weight among the impostors only). Inside the
 * corridor (|x| <= the corridor half-width, so clear of every wall and of the warp's fold at bend
 * centres): four upper-canyon lanes above the route's highest climb, where the chase camera looks
 * up the canyon slot, and two deep lanes in the grime above the service deck.
 */
export const IMPOSTOR_LANES: readonly (readonly number[])[] = Object.freeze([
  [-150, 2650, 1, 4, 160, 140, 90, 40, 10, 0.1],  // upper canyon
  [170, 2900, -1, 5, 220, 120, 110, 50, 9, 0.1],
  [-60, 3150, 1, 4, 200, 160, 120, 60, 11, 0.08],
  [120, 3400, -1, 3, 140, 190, 100, 50, 13, 0.07],
  [-120, 200, -1, 3, 120, 70, 80, 25, 9, 0.06],   // deep
  [160, 290, 1, 3, 110, 80, 70, 25, 8, 0.05],
]);
/** Every path an impostor can fly: the CPU streams (indices 0..7, same rows) then the lanes. */
export const IMPOSTOR_PATHS: readonly (readonly number[])[] = Object.freeze([...STREAMS, ...IMPOSTOR_LANES]);
/**
 * R18 air-traffic rings: world-space closed lanes round the city, high over the rooflines. From
 * inside the winding canyon the chase camera cannot see any canyon traffic beyond ~700 m (measured:
 * 0 of 19,000 canyon impostors in the frustum at 14 s and 26 s; the canyon turns behind its walls),
 * so the volume the operator asked for has to fly where the camera sees range: the sky over the
 * walls and the distant city. [radius m, altitude m, direction, rows, width m, speed m/s,
 * radial meander m, wobble m, meander lobes, share]. Centred on the loop's centroid.
 */
export const IMPOSTOR_RINGS: readonly (readonly number[])[] = Object.freeze([
  [3000, 3600, 1, 5, 420, 170, 600, 180, 5, 0.17],
  [3900, 4100, -1, 6, 520, 150, 750, 220, 4, 0.19],
  [4900, 3800, 1, 4, 380, 210, 900, 200, 7, 0.17],
  [5900, 4600, -1, 5, 480, 180, 800, 260, 6, 0.17],
  [7000, 4300, 1, 6, 600, 230, 900, 250, 5, 0.16],
  [8200, 5000, -1, 4, 500, 160, 1000, 300, 3, 0.14],
]);
/** Impostor shares: canyon streams, canyon lanes, sky rings. */
const IMPOSTOR_STREAM_SHARE = 0.25;
const IMPOSTOR_LANE_SHARE = 0.1;
const IMPOSTOR_RING_SHARE = 0.2;
/**
 * The rest are free floaters: scattered through the whole corridor volume like the CPU free cars
 * (random lateral and height homes, slow drift and climb, either direction). Measured (R18): the
 * baseline's scattered distant dots were mostly those, and stream rows alone left the far canyon
 * emptier than before.
 */
export const IMPOSTOR_FREE_MIN_Y_M = 120;
export const IMPOSTOR_FREE_MAX_Y_M = 2600;
/**
 * Impostor path indices: streams and lanes (table rows, < IMPOSTOR_PATHS.length), then rings, then
 * one index for every free floater.
 */
export const IMPOSTOR_PATH_COUNT = 8 + 6 + 6 + 1;
export const IMPOSTOR_FREE_INDEX = IMPOSTOR_PATH_COUNT - 1;

let centroidCache: { x: number; z: number } | null = null;
/** The loop's centroid in world xz, the rings' centre. */
export function loopCentroid(): { x: number; z: number } {
  if (centroidCache !== null) return centroidCache;
  const o: WarpOut = { x: 0, z: 0, heading: 0 };
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (let v = 0; v < L; v += 20) {
    warpCanyon(0, v, o);
    sx += o.x;
    sz += o.z;
    n += 1;
  }
  centroidCache = { x: sx / n, z: sz / n };
  return centroidCache;
}

/** Interchanges: [stream a, stream b, v] — the pair swaps shelves (and sides) through a 1.1 km ramp. */
export const INTERCHANGES: readonly (readonly [number, number, number])[] = Object.freeze([
  [0, 7, -4100], [2, 3, 1500], [4, 5, 4800],
]);
export const INTERCHANGE_RAMP_M = 1100;
/** Path table resolution, metres along the loop. */
export const STREAM_PATH_STEP_M = 8;
export const STREAM_PATH_SAMPLES = Math.ceil(L / STREAM_PATH_STEP_M);
/** Stream surge amplitude, metres: express streams surge harder so distant chains break up. */
export const STREAM_SURGE_M = 40;
export const STREAM_EXPRESS_SURGE_M = 110;
/** Cars stay inside the corridor, metres either side of the canyon centreline. */
export const STREAM_CORRIDOR_HALF_M = 340;

/**
 * R18: meander and wobble periods are rounded so a whole number of them fits the loop. The R11
 * periods (1800 + 230 k, 1300 + 170 k metres) did not divide it, so every stream jumped sideways by
 * up to twice its meander where the loop closes; with tens of thousands of impostors that seam would
 * be a visible teleport line. The rounded periods differ from R11's by under 3%.
 */
function loopPeriod(metres: number): number {
  return L / Math.max(1, Math.round(L / metres));
}
export function streamMeanderPeriod(k: number): number {
  return loopPeriod(1800 + k * 230);
}
export function streamWobblePeriod(k: number): number {
  return loopPeriod(1300 + k * 170);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function swapWeight(v: number, at: number): number {
  let d = (v - at) % L;
  if (d < 0) d += L;
  const half = L * 0.5;
  return smoothstep(0, INTERCHANGE_RAMP_M, d) * (1 - smoothstep(half, half + INTERCHANGE_RAMP_M, d));
}

/** Stream k's centre (canyon x across, altitude y) at arc length v, analytically. */
export function streamCentreAnalytic(k: number, v: number, out: { x: number; y: number }): void {
  const st = IMPOSTOR_PATHS[k]!;
  let x = st[0]!;
  let y = st[1]!;
  for (const [a, b, at] of INTERCHANGES) {
    if (k !== a && k !== b) continue;
    const partner = IMPOSTOR_PATHS[k === a ? b : a]!;
    const w = swapWeight(v, at);
    x += (partner[0]! - x) * w;
    y += (partner[1]! - y) * w;
  }
  out.x = x + st[6]! * Math.sin((TAU * v) / streamMeanderPeriod(k) + k * 1.3);
  out.y = y + st[7]! * Math.sin((TAU * v) / streamWobblePeriod(k) + k * 2.1);
}

/**
 * The baked table, RGBA float32, (STREAM_PATH_SAMPLES + 1) x (IMPOSTOR_PATHS.length + 1) texels:
 * rows 0..13 hold each path's centre (r = x across, g = altitude; the CPU streams are rows 0..7),
 * the last row the canyon warp
 * (r, g = world centre x, z; b, a = cos, sin of the heading). One texture, two fetches per lookup.
 */
export interface StreamPathTable {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array<ArrayBuffer>;
}

let tableCache: StreamPathTable | null = null;

export function streamPathTable(): StreamPathTable {
  if (tableCache !== null) return tableCache;
  const width = STREAM_PATH_SAMPLES + 1;
  const height = IMPOSTOR_PATHS.length + 1;
  const data = new Float32Array(width * height * 4);
  const c = { x: 0, y: 0 };
  for (let k = 0; k < IMPOSTOR_PATHS.length; k += 1) {
    for (let i = 0; i < width; i += 1) {
      streamCentreAnalytic(k, i * STREAM_PATH_STEP_M, c);
      const o = (k * width + i) * 4;
      data[o] = c.x;
      data[o + 1] = c.y;
    }
  }
  const w: WarpOut = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < width; i += 1) {
    warpCanyon(0, i * STREAM_PATH_STEP_M, w);
    const o = (IMPOSTOR_PATHS.length * width + i) * 4;
    data[o] = w.x;
    data[o + 1] = w.z;
    data[o + 2] = Math.cos(w.heading);
    data[o + 3] = Math.sin(w.heading);
  }
  tableCache = { width, height, data };
  return tableCache;
}

/** Seeded integer hash to [0, 1) (the traffic.ts hash01, duplicated so this module stays standalone). */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ b, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 32-bit avalanche finaliser (murmur3 fmix32 family). */
function mix32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/**
 * Impostor channel hash to [0, 1). R18: hash01(i ^ salt, channel) is too weak for this — its channels
 * only differ in low bits before one multiply, so for many indices arc, phase, seed and row came out
 * nearly equal across different impostors and stacked dozens of them on one spot (a blooming block).
 */
export function impostorHash(i: number, channel: number): number {
  return mix32((mix32(i) + Math.imul(channel, 0x9e3779b9)) | 0) / 4294967296;
}

/**
 * Per-impostor attributes. `streamArcPhaseSeed` packs (stream index, arc offset 0..1 of the loop,
 * motion phase 0..1, appearance seed 0..1); `row` is the sub-row position 0..1.
 */
export interface ImpostorAttributes {
  readonly count: number;
  readonly streamArcPhaseSeed: Float32Array;
  readonly row: Float32Array;
}

/**
 * Impostor population for a seed: stream membership by the streams' shares, arc offsets squeezed
 * into the same density pulses (clumps and gaps) the CPU stream cars use. Pure.
 */
export function deriveImpostorAttributes(seed: number, count: number): ImpostorAttributes {
  if (!Number.isInteger(count) || count < 0) throw new Error('SKYRIVER_IMPOSTOR_COUNT_INVALID');
  const streamArcPhaseSeed = new Float32Array(count * 4);
  const row = new Float32Array(count);
  const shares: number[] = [];
  let total = 0;
  const laneTotal = IMPOSTOR_LANES.reduce((a, l) => a + l[9]!, 0);
  const ringTotal = IMPOSTOR_RINGS.reduce((a, r) => a + r[9]!, 0);
  for (const st of STREAMS) { total += st[9]! * IMPOSTOR_STREAM_SHARE; shares.push(total); }
  for (const lane of IMPOSTOR_LANES) { total += (lane[9]! / laneTotal) * IMPOSTOR_LANE_SHARE; shares.push(total); }
  for (const ring of IMPOSTOR_RINGS) { total += (ring[9]! / ringTotal) * IMPOSTOR_RING_SHARE; shares.push(total); }
  total += 1 - IMPOSTOR_STREAM_SHARE - IMPOSTOR_LANE_SHARE - IMPOSTOR_RING_SHARE;
  shares.push(total);
  const salt = mix32(Math.imul(seed | 0, 0x2545f491) ^ 0x1f2e3d4c);
  for (let i = 0; i < count; i += 1) {
    const h = (k: number): number => impostorHash((i + salt) | 0, k);
    const pick = h(0x101) * total;
    let k = 0;
    while (k < IMPOSTOR_PATH_COUNT - 1 && shares[k]! <= pick) k += 1;
    // Clumps: rings use 6-10 pulses (their [8] is the meander lobe count).
    const pulses = k < IMPOSTOR_PATHS.length ? IMPOSTOR_PATHS[k]![8]! : k === IMPOSTOR_FREE_INDEX ? 1 : 6 + (k % 5);
    const slot = h(0x102) * pulses;
    const pulse = Math.floor(slot);
    const fill = 0.22 + 0.4 * hash01(k * 97 + pulse, 0x9a11);
    const offset = hash01(k * 131 + pulse, 0x9a12) * (1 - fill);
    // Free floaters are spread evenly round the loop (no clumps: one "pulse" squeezed them all into
    // a third of it, and end-on that pile-up bloomed into blocks).
    const arc = k === IMPOSTOR_FREE_INDEX ? h(0x102) : (pulse + offset + Math.pow(slot - pulse, 0.8) * fill) / pulses;
    streamArcPhaseSeed[i * 4] = k;
    streamArcPhaseSeed[i * 4 + 1] = arc;
    streamArcPhaseSeed[i * 4 + 2] = h(0x103);
    streamArcPhaseSeed[i * 4 + 3] = h(0x104);
    row[i] = h(0x105);
  }
  return { count, streamArcPhaseSeed, row };
}

/**
 * CPU mirror of the impostor vertex shader (traffic.ts STREAK_VERTEX, impostor branch): world
 * position and travel direction of impostor i at time t (seconds). Keep the two in step.
 */
export function impostorPosition(attrs: ImpostorAttributes, i: number, t: number, out: { x: number; y: number; z: number; dx: number; dz: number }): void {
  const table = streamPathTable();
  const k = attrs.streamArcPhaseSeed[i * 4]!;
  const arc = attrs.streamArcPhaseSeed[i * 4 + 1]!;
  const phase = attrs.streamArcPhaseSeed[i * 4 + 2]!;
  const seed = attrs.streamArcPhaseSeed[i * 4 + 3]!;
  const row = attrs.row[i]!;
  if (k === IMPOSTOR_FREE_INDEX) {
    // Free floater: a home across the corridor and in height, drifting; either direction.
    const dir = phase < 0.5 ? -1 : 1;
    const speed = 60 + 150 * seed;
    const homeX = (seed * 2 - 1) * STREAM_CORRIDOR_HALF_M;
    const homeY = IMPOSTOR_FREE_MIN_Y_M + Math.pow(row, 0.9) * (IMPOSTOR_FREE_MAX_Y_M - IMPOSTOR_FREE_MIN_Y_M);
    let v = (arc * L + dir * speed * t) % L;
    if (v < 0) v += L;
    const xf = Math.min(STREAM_CORRIDOR_HALF_M, Math.max(-STREAM_CORRIDOR_HALF_M, homeX + (12 + 40 * row) * Math.sin(t * (0.05 + 0.13 * seed) + phase * 37.0)));
    const yf = homeY + (6 + 30 * seed) * Math.sin(t * (0.04 + 0.12 * row) + phase * 23.0);
    const f = v / STREAM_PATH_STEP_M;
    const i0 = Math.min(STREAM_PATH_SAMPLES - 1, Math.floor(f));
    const fr = f - i0;
    const r0 = (IMPOSTOR_PATHS.length * table.width + i0) * 4;
    const r1 = r0 + 4;
    const wx = table.data[r0]! + (table.data[r1]! - table.data[r0]!) * fr;
    const wz = table.data[r0 + 1]! + (table.data[r1 + 1]! - table.data[r0 + 1]!) * fr;
    let hc = table.data[r0 + 2]! + (table.data[r1 + 2]! - table.data[r0 + 2]!) * fr;
    let hs = table.data[r0 + 3]! + (table.data[r1 + 3]! - table.data[r0 + 3]!) * fr;
    const hl = Math.hypot(hc, hs) || 1;
    hc /= hl;
    hs /= hl;
    out.x = wx + xf * hc;
    out.y = yf;
    out.z = wz - xf * hs;
    out.dx = hs * dir;
    out.dz = hc * dir;
    return;
  }
  if (k >= IMPOSTOR_PATHS.length) {
    // Air-traffic ring (world space).
    const rg = IMPOSTOR_RINGS[k - IMPOSTOR_PATHS.length]!;
    const [R, alt, dir, rows, width, speed0, meander, wobble, lobes] = rg as unknown as number[];
    const c = loopCentroid();
    const speed = speed0! * (0.9 + 0.2 * row);
    const surge = STREAM_EXPRESS_SURGE_M * Math.sin(t * (0.3 + 0.25 * row) + phase * 97.0);
    const theta = (arc * TAU * R! + dir! * speed * t + surge) / R!;
    const rowIndex = Math.min(rows! - 1, Math.floor(row * rows!));
    const spacing = width! / Math.max(1, rows! - 1);
    const rowOffset = (rowIndex - (rows! - 1) / 2) * spacing + (seed - 0.5) * spacing * 0.6;
    const ringIndex = k - IMPOSTOR_PATHS.length;
    const r = R! + meander! * Math.sin(lobes! * theta + ringIndex * 1.7) + rowOffset;
    out.x = c.x + r * Math.cos(theta);
    out.z = c.z + r * Math.sin(theta);
    out.y = alt! + wobble! * Math.sin(3 * theta + ringIndex * 2.3) + (rowIndex % 2 === 0 ? -12 : 12) + (((seed * 7.3) % 1) - 0.5) * 30 + 6 * Math.sin(t * 0.33 + phase * 17.0);
    out.dx = -Math.sin(theta) * dir!;
    out.dz = Math.cos(theta) * dir!;
    return;
  }
  const st = IMPOSTOR_PATHS[k]!;
  const dir = st[2]!;
  const speed = st[5]! * (0.9 + 0.2 * row);
  const surgeAmp = st[5]! > 150 ? STREAM_EXPRESS_SURGE_M : STREAM_SURGE_M;
  const surge = surgeAmp * Math.sin(t * (0.3 + 0.25 * row) + phase * 97.0);
  let v = (arc * L + dir * speed * t + surge) % L;
  if (v < 0) v += L;
  const f = v / STREAM_PATH_STEP_M;
  const i0 = Math.min(STREAM_PATH_SAMPLES - 1, Math.floor(f));
  const fr = f - i0;
  const w = table.width;
  const s0 = (k * w + i0) * 4;
  const s1 = s0 + 4;
  const cx = table.data[s0]! + (table.data[s1]! - table.data[s0]!) * fr;
  const cy = table.data[s0 + 1]! + (table.data[s1 + 1]! - table.data[s0 + 1]!) * fr;
  const r0 = (IMPOSTOR_PATHS.length * w + i0) * 4;
  const r1 = r0 + 4;
  const wx = table.data[r0]! + (table.data[r1]! - table.data[r0]!) * fr;
  const wz = table.data[r0 + 1]! + (table.data[r1 + 1]! - table.data[r0 + 1]!) * fr;
  let hc = table.data[r0 + 2]! + (table.data[r1 + 2]! - table.data[r0 + 2]!) * fr;
  let hs = table.data[r0 + 3]! + (table.data[r1 + 3]! - table.data[r0 + 3]!) * fr;
  const hl = Math.hypot(hc, hs) || 1;
  hc /= hl;
  hs /= hl;
  const rows = st[3]!;
  const rowIndex = Math.min(rows - 1, Math.floor(row * rows));
  const spacing = st[4]! / Math.max(1, rows - 1);
  const rowOffset = (rowIndex - (rows - 1) / 2) * spacing;
  let x = cx + rowOffset + (seed - 0.5) * spacing * 0.6 + 3 * Math.sin(t * 0.4 + phase * 31.0);
  x = Math.min(STREAM_CORRIDOR_HALF_M, Math.max(-STREAM_CORRIDOR_HALF_M, x));
  const y = cy + (rowIndex % 2 === 0 ? -3 : 3) + (((seed * 7.3) % 1) - 0.5) * 6 + 2 * Math.sin(t * 0.33 + phase * 17.0);
  // Canyon (x across, v along) -> world: centre + x * (cos h, -sin h); along = (sin h, cos h).
  out.x = wx + x * hc;
  out.y = y;
  out.z = wz - x * hs;
  out.dx = hs * dir;
  out.dz = hc * dir;
}
