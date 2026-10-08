/**
 * @file trafficStreams.ts — the traffic streams (R11) as one shared, seed-owned render model, and
 * the R18 GPU impostor cars.
 *
 * R11 streams are flight corridors in canyon space: each holds one direction around the loop on its
 * own altitude shelf, meanders across the corridor, wobbles in height, carries its cars in loose
 * sub-rows, and swaps shelves with a partner at interchanges. traffic.ts evaluates its ~2,400 CPU
 * cars on them. R18 adds impostor cars: 8,000-20,000 light sprites per tier whose positions are
 * evaluated entirely in the vertex shader from a baked path texture (this module bakes it), so the
 * sky fills with traffic at no per-car CPU cost.
 *
 * R21 "living traffic" makes one model own every motion constant, so CPU cars and GPU cars fly the
 * same corridors:
 *   - Speed. Each car samples its own cruise speed inside its class band (freight 40-75, standard
 *     70-130, express 150-195 m/s). The R18 longitudinal surge is gone: its derivative moved a car
 *     by up to 60.5 m/s, which put most express cars outside their band at any instant.
 *   - Convoys. A seeded share of the density pulses move as a convoy at a shared 70-85% of the
 *     sampled cruise. This is an exception to the normal cruise band, not a second band.
 *   - Passing. A faster-than-median car slides to one side by up to 12 m and back, with no
 *     neighbour query: a continuous sin-squared lateral offset. Convoy members never pass.
 *   - Forks. Each stream carries one or two seeded fork nodes. A car picks each fork at spawn from
 *     its own avalanche hash bit, so four baked variants per stream cover every choice: main,
 *     fork 0, fork 1, both. Every branch leaves the main line over a 600 m ramp, runs 1200-1500 m
 *     off it, and merges back over a second 600 m ramp.
 *   - Course changes. A seeded share of cars make one smooth same-direction stream change per lap
 *     over a 600-900 m ramp, alternating A -> B then B -> A, so no car ever teleports at the seam.
 *
 * `impostorPosition` is the CPU mirror of the shader math, for tests (continuity, clearance) and
 * probes. `impostorFlow` is its read-only metadata twin. Keep both in step with traffic.ts.
 *
 * Pure, GL-free, node-testable. Everything is a function of the seed.
 */
import { CANYON_LOOP_LENGTH_M, warpCanyon, type WarpOut } from './canyonWarp';

const TAU = Math.PI * 2;
const L = CANYON_LOOP_LENGTH_M;

function fail(code: string): never {
  throw new Error(code);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * [x across, shelf y, direction, sub-rows, width m, nominal speed m/s, meander m, wobble m, pulses,
 * share]. See traffic.ts (R11) for the design notes. R21 reads the nominal speed only to classify
 * the stream; a car's own cruise speed comes from its class band.
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
 * R18 air-traffic rings: world-space closed lanes round the city, above the full tower skyline. From
 * inside the winding canyon the chase camera cannot see any canyon traffic beyond ~700 m (measured:
 * 0 of 19,000 canyon impostors in the frustum at 14 s and 26 s; the canyon turns behind its walls),
 * so the volume the operator asked for has to fly where the camera sees range: the sky over the
 * walls and the distant city. [radius m, altitude m, direction, rows, width m, speed m/s,
 * radial meander m, wobble m, meander lobes, share]. Centred on the loop's centroid.
 */
export const IMPOSTOR_RINGS: readonly (readonly number[])[] = Object.freeze([
  [3000, 10200, 1, 5, 420, 170, 600, 180, 5, 0.17],
  [3900, 10700, -1, 6, 520, 150, 750, 220, 4, 0.19],
  [4900, 10400, 1, 4, 380, 210, 900, 200, 7, 0.17],
  [5900, 11200, -1, 5, 480, 180, 800, 260, 6, 0.17],
  [7000, 10900, 1, 6, 600, 230, 900, 250, 5, 0.16],
  [8200, 11600, -1, 4, 500, 160, 1000, 300, 3, 0.14],
]);
/** Normalize the existing stream, lane, and ring shares to fill the GPU impostor set. */
const IMPOSTOR_EXISTING_SHARE = 0.25 + 0.1 + 0.2;
const IMPOSTOR_STREAM_SHARE = 0.25 / IMPOSTOR_EXISTING_SHARE;
const IMPOSTOR_LANE_SHARE = 0.1 / IMPOSTOR_EXISTING_SHARE;
const IMPOSTOR_RING_SHARE = 0.2 / IMPOSTOR_EXISTING_SHARE;
/** Path indices: streams and lanes use the baked table, then the world-space rings (14..19). */
export const IMPOSTOR_PATH_COUNT = IMPOSTOR_PATHS.length + IMPOSTOR_RINGS.length;

/** R18 ring surge amplitude, metres. The canyon paths carry no surge since R21. */
export const RING_SURGE_M = 110;

/** A path's traffic class. Rings and GPU-only lanes carry no R21 speed band. */
export type StreamClass = 'freight' | 'standard' | 'express' | 'lane' | 'ring';

/** A normal cruise band, metres per second. Convoys run below it by design. */
export interface SpeedBand {
  readonly minMps: number;
  readonly maxMps: number;
}

/**
 * R21 class bands. These are normal cruise bands: a convoy member runs at 70-85% of a cruise speed
 * sampled inside its band, which is a stated exception, because 0.7 x 195 = 136.5 m/s cannot sit
 * inside the express band.
 */
export const SPEED_BANDS: Readonly<Record<'freight' | 'standard' | 'express', SpeedBand>> = Object.freeze({
  freight: Object.freeze({ minMps: 40, maxMps: 75 }),
  standard: Object.freeze({ minMps: 70, maxMps: 130 }),
  express: Object.freeze({ minMps: 150, maxMps: 195 }),
});

/** The class of a logical path index. */
export function streamClass(path: number): StreamClass {
  if (path >= IMPOSTOR_PATH_COUNT || path < 0) fail('SKYRIVER_STREAM_PATH_OUT_OF_RANGE');
  if (path >= IMPOSTOR_PATHS.length) return 'ring';
  if (path >= STREAMS.length) return 'lane';
  const nominal = STREAMS[path]![5]!;
  return nominal <= 70 ? 'freight' : nominal >= 150 ? 'express' : 'standard';
}

/** The band of a logical path, or null when the path carries none (lanes and rings). */
export function streamBand(path: number): SpeedBand | null {
  const kind = streamClass(path);
  return kind === 'lane' || kind === 'ring' ? null : SPEED_BANDS[kind];
}

/** A canyon path, by name. The numeric rows above stay the single source of the values. */
export interface TrafficStream {
  readonly path: number;
  readonly kind: StreamClass;
  readonly direction: -1 | 1;
  readonly x: number;
  readonly y: number;
  readonly rows: number;
  readonly widthM: number;
  readonly nominalMps: number;
  readonly meanderM: number;
  readonly wobbleM: number;
  readonly pulses: number;
  readonly share: number;
}

export const STREAM_DESCRIPTORS: readonly TrafficStream[] = Object.freeze(
  IMPOSTOR_PATHS.map((st, path) => Object.freeze({
    path,
    kind: streamClass(path),
    direction: (st[2]! > 0 ? 1 : -1) as -1 | 1,
    x: st[0]!,
    y: st[1]!,
    rows: st[3]!,
    widthM: st[4]!,
    nominalMps: st[5]!,
    meanderM: st[6]!,
    wobbleM: st[7]!,
    pulses: st[8]!,
    share: st[9]!,
  })),
);

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
/** Cars stay inside the corridor, metres either side of the canyon centreline. */
export const STREAM_CORRIDOR_HALF_M = 340;

/* ------------------------------------------------------------------------------------------------
 * R21 model constants.
 * ---------------------------------------------------------------------------------------------- */

/** Baked variants per CPU stream: main, fork 0, fork 1, both. */
export const STREAM_VARIANTS = 4;
/** Streams that carry forks: the eight CPU streams. The GPU-only lanes keep one row each. */
export const FORK_STREAM_COUNT = STREAMS.length;
/** Table row layout: 8 streams x 4 variants, then the 6 lanes, then the canyon warp. 39 rows. */
export const LANE_ROW_0 = STREAM_VARIANTS * FORK_STREAM_COUNT;
export const WARP_ROW = LANE_ROW_0 + IMPOSTOR_LANES.length;
export const STREAM_PATH_ROWS = WARP_ROW + 1;

/** Fork geometry. 1200-1500 m of support holds two full 600 m S ramps. */
export const FORK_RAMP_M = 600;
export const FORK_LENGTH_MIN_M = 1200;
export const FORK_LENGTH_SPAN_M = 300;
export const FORK_LATERAL_MIN_M = 60;
export const FORK_LATERAL_SPAN_M = 60;
export const FORK_VERTICAL_MIN_M = 30;
export const FORK_VERTICAL_SPAN_M = 30;
/** Clear arc between any two supports, and between a support and an interchange ramp, metres. */
export const FORK_GAP_M = 200;
/** Clear arc a course-change ramp keeps from a reserved interval, metres. */
export const HOP_GAP_M = 120;
/** A car takes each of its stream's forks with this probability, from its own hash bit. */
export const FORK_TAKE_SHARE = 0.5;
/** Branch altitudes stay inside this window, metres (above the service deck, under the skybridges). */
export const FORK_Y_MIN_M = 150;
export const FORK_Y_MAX_M = 2600;
/** Seeded placement works on this cell grid (the path table's own step), metres. */
const PLACEMENT_CELL_M = STREAM_PATH_STEP_M;

/** Course change (hop) geometry. */
export const HOP_RAMP_MIN_M = 600;
export const HOP_RAMP_SPAN_M = 300;
/** Shelf gaps above this use the full 900 m ramp, so the climb slope stays flyable. */
export const HOP_STEEP_GAP_M = 420;
/** GPU impostors: share of stream cars that hop. */
export const IMPOSTOR_HOP_SHARE = 0.15;
/**
 * CPU hop cohorts, by permanent car index. The low tier draws cars 0..599 and never hops, so its
 * cars keep fixed trajectories; the medium and high tiers both land at ~15% of their stream cars.
 * Eligibility is a function of the index alone, so a tier change never moves a car.
 */
export const HOP_COHORT_BOUNDS: readonly number[] = Object.freeze([600, 1200]);
export const HOP_SHARE_BY_COHORT: readonly number[] = Object.freeze([0, 0.3, 0.15]);
export function cpuHopShare(car: number): number {
  if (car < HOP_COHORT_BOUNDS[0]!) return HOP_SHARE_BY_COHORT[0]!;
  if (car < HOP_COHORT_BOUNDS[1]!) return HOP_SHARE_BY_COHORT[1]!;
  return HOP_SHARE_BY_COHORT[2]!;
}

/** Convoys: share of density pulses that move as one, and the shared speed ratio range. */
export const CONVOY_PULSE_SHARE = 0.3;
export const CONVOY_RATIO_MIN = 0.7;
export const CONVOY_RATIO_SPAN = 0.15;
/**
 * A convoy member keeps this share of its own in-band cruise sample and takes the rest from the
 * pulse's sample, so the convoy holds together instead of dispersing within a lap. Both samples are
 * inside the band, so the result is too.
 */
export const CONVOY_CRUISE_SPREAD = 0.12;

/** Passing: lateral metres per m/s over the class median, the clamp, and the period range. */
export const STREAM_PASS_GAIN = 0.5;
export const STREAM_PASS_MAX_M = 12;
export const STREAM_PASS_PERIOD_MIN_S = 16;
export const STREAM_PASS_PERIOD_SPAN_S = 16;

/** Independent avalanche channels. Every R21 motion channel has its own. */
export const FLOW_CHANNELS = Object.freeze({
  path: 0x101,
  pulse: 0x102,
  phase: 0x103,
  appearance: 0x104,
  row: 0x105,
  fork0: 0x111,
  fork1: 0x112,
  speed: 0x113,
  passPeriod: 0x114,
  hop: 0x115,
});

/* ------------------------------------------------------------------------------------------------
 * Analytic stream centres and interchanges.
 * ---------------------------------------------------------------------------------------------- */

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

/** d(smoothstep)/dx. Zero outside the edges, so the ramp ends are slope-continuous. */
function smoothstepRate(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = (x - edge0) / span;
  if (t <= 0 || t >= 1) return 0;
  return (6 * t * (1 - t)) / span;
}

/** Wraps an arc offset into [0, L). */
export function wrapArc(v: number): number {
  const w = v % L;
  return w < 0 ? w + L : w;
}

function swapWeight(v: number, at: number): number {
  const d = wrapArc(v - at);
  const half = L * 0.5;
  return smoothstep(0, INTERCHANGE_RAMP_M, d) * (1 - smoothstep(half, half + INTERCHANGE_RAMP_M, d));
}

/** d(swapWeight)/dv. */
function swapWeightRate(v: number, at: number): number {
  const d = wrapArc(v - at);
  const half = L * 0.5;
  return smoothstepRate(0, INTERCHANGE_RAMP_M, d) * (1 - smoothstep(half, half + INTERCHANGE_RAMP_M, d))
    - smoothstep(0, INTERCHANGE_RAMP_M, d) * smoothstepRate(half, half + INTERCHANGE_RAMP_M, d);
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
 * d(streamCentreAnalytic)/dv. R21 bakes this into the path table so a car's heading follows its own
 * path, not the stream it started on. Each stream joins at most one interchange, so the swap term is
 * the single linear blend streamCentreAnalytic applies.
 */
export function streamCentreSlopeAnalytic(k: number, v: number, out: { x: number; y: number }): void {
  const st = IMPOSTOR_PATHS[k]!;
  let x = 0;
  let y = 0;
  for (const [a, b, at] of INTERCHANGES) {
    if (k !== a && k !== b) continue;
    const partner = IMPOSTOR_PATHS[k === a ? b : a]!;
    const rate = swapWeightRate(v, at);
    x += (partner[0]! - st[0]!) * rate;
    y += (partner[1]! - st[1]!) * rate;
  }
  const mp = streamMeanderPeriod(k);
  const wp = streamWobblePeriod(k);
  out.x = x + st[6]! * (TAU / mp) * Math.cos((TAU * v) / mp + k * 1.3);
  out.y = y + st[7]! * (TAU / wp) * Math.cos((TAU * v) / wp + k * 2.1);
}

/* ------------------------------------------------------------------------------------------------
 * Smooth ramps. The quintic has zero first and second derivative at both ends, so a branch or a
 * course change starts and ends without a visible kink.
 * ---------------------------------------------------------------------------------------------- */

/** S(u) = u^3 (10 - 15u + 6u^2), clamped to [0, 1]. */
export function quintic(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * u * (10 - 15 * u + 6 * u * u);
}

/** dS/du. Zero at u = 0 and u = 1. */
export function quinticRate(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  const k = 1 - u;
  return 30 * u * u * k * k;
}

/** Branch envelope at distance d into a support: up one ramp, along, and down the other. */
export function forkBump(d: number, lengthM: number, rampM: number): number {
  if (lengthM <= 0 || d <= 0 || d >= lengthM) return 0;
  return quintic(d / rampM) * (1 - quintic((d - lengthM + rampM) / rampM));
}

/** d(forkBump)/dd. */
export function forkBumpRate(d: number, lengthM: number, rampM: number): number {
  if (lengthM <= 0 || d <= 0 || d >= lengthM) return 0;
  const up = quintic(d / rampM);
  const down = quintic((d - lengthM + rampM) / rampM);
  return (quinticRate(d / rampM) / rampM) * (1 - down) - up * (quinticRate((d - lengthM + rampM) / rampM) / rampM);
}

/* ------------------------------------------------------------------------------------------------
 * The seed-owned model: forks, course changes, and the baked path table.
 * ---------------------------------------------------------------------------------------------- */

/** One branch off a stream. The branch leaves and rejoins the main line inside `lengthM`. */
export interface Fork {
  readonly startM: number;
  readonly lengthM: number;
  readonly rampM: number;
  /** Signed canyon offsets at the plateau, metres. */
  readonly lateralM: number;
  readonly verticalM: number;
}

/** One course change: stream `a` to stream `b`, same direction, one transition per lap. */
export interface HopLink {
  readonly a: number;
  readonly b: number;
  readonly startM: number;
  readonly rampM: number;
  /** Shelf altitude gap of the pair, metres. Reported so the climb slope can be checked. */
  readonly shelfGapM: number;
}

/**
 * The baked table, RGBA float32, (STREAM_PATH_SAMPLES + 1) x STREAM_PATH_ROWS texels: rows
 * 0..LANE_ROW_0-1 hold stream k variant b at row k * 4 + b, rows LANE_ROW_0..WARP_ROW-1 the GPU-only
 * lanes, and row WARP_ROW the canyon warp. A canyon texel is (centre x, centre y, dx/dv, dy/dv); the
 * warp texel is (world x, world z, cos heading, sin heading). One texture, two fetches per lookup.
 */
export interface StreamPathTable {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array<ArrayBuffer>;
}

/** Everything a seed decides about the shared traffic network. Built once, cached per seed. */
export interface RenderTrafficModel {
  readonly seed: number;
  readonly streams: readonly TrafficStream[];
  /** Forks by stream index, 1 or 2 each. Lanes and rings carry none. */
  readonly forks: readonly (readonly Fork[])[];
  /** One course change per stream, `a` = that stream. */
  readonly hops: readonly HopLink[];
  readonly table: StreamPathTable;
  /** Per-car hash salt for the GPU impostor population and for the CPU cars. */
  readonly impostorSalt: number;
  readonly carSalt: number;
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
 * R21 motion channels all use this hash, never the weaker local CPU one.
 */
export function impostorHash(i: number, channel: number): number {
  return mix32((mix32(i) + Math.imul(channel, 0x9e3779b9)) | 0) / 4294967296;
}

/** Seed-level channel, for everything the model decides once (fork placement, hop links). */
function modelHash(seed: number, channel: number): number {
  return impostorHash(mix32((seed ^ 0x5bf03635) | 0), channel);
}

function assertSeed(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) fail('SKYRIVER_RENDER_SEED_INVALID');
  return seed;
}

/** A wrapped arc interval. */
interface ArcInterval {
  readonly startM: number;
  readonly lengthM: number;
}

/** The interchange ramps stream `k` rides. R15 sticky cars hand over inside them: keep forks out. */
function interchangeIntervals(k: number): ArcInterval[] {
  const out: ArcInterval[] = [];
  for (const [a, b, at] of INTERCHANGES) {
    if (k !== a && k !== b) continue;
    out.push({ startM: wrapArc(at), lengthM: INTERCHANGE_RAMP_M });
    out.push({ startM: wrapArc(at + L * 0.5), lengthM: INTERCHANGE_RAMP_M });
  }
  return out;
}

/** Half the lateral room a stream's cars need either side of their centre, metres. */
function streamLateralReachM(k: number): number {
  const st = STREAM_DESCRIPTORS[k]!;
  const spacing = st.widthM / Math.max(1, st.rows - 1);
  // The widest sub-row, its jitter, the merge re-scatter (half the full width), and a pass offset.
  return Math.max(st.widthM * 0.5 + spacing * 0.3, st.widthM * 0.5) + STREAM_PASS_MAX_M;
}

/** Half the vertical room a stream's cars need either side of their centre, metres. */
function streamVerticalReachM(): number {
  // Sub-row parity (3 m) or the re-scatter (3 m), the seeded jitter (3 m), and the micro bob (2 m).
  return 3 + 3 + 2;
}

/** Worst corridor overshoot of a branch over its support, metres (0 = fully inside). */
function forkCorridorExcessM(k: number, startM: number, lengthM: number, lateralM: number): number {
  const centre = { x: 0, y: 0 };
  const reach = streamLateralReachM(k);
  let worst = 0;
  for (let d = 0; d <= lengthM; d += STREAM_PATH_STEP_M) {
    streamCentreAnalytic(k, startM + d, centre);
    const x = centre.x + lateralM * forkBump(d, lengthM, FORK_RAMP_M);
    worst = Math.max(worst, Math.abs(x) + reach - STREAM_CORRIDOR_HALF_M);
  }
  return Math.max(0, worst);
}

/** Worst altitude overshoot of a branch out of the flyable window, metres. */
function forkAltitudeExcessM(k: number, startM: number, lengthM: number, verticalM: number): number {
  const centre = { x: 0, y: 0 };
  const reach = streamVerticalReachM();
  let worst = 0;
  for (let d = 0; d <= lengthM; d += STREAM_PATH_STEP_M) {
    streamCentreAnalytic(k, startM + d, centre);
    const y = centre.y + verticalM * forkBump(d, lengthM, FORK_RAMP_M);
    worst = Math.max(worst, Math.max(FORK_Y_MIN_M - (y - reach), y + reach - FORK_Y_MAX_M));
  }
  return Math.max(0, worst);
}

/**
 * Picks the branch offsets. The lateral sign points inward (toward the canyon centreline) first, so
 * a branch never pushes its cars into a wall; the magnitude shrinks in 10 m steps only if both signs
 * would overshoot the corridor by more than the main line already does.
 */
function chooseForkOffsets(seed: number, k: number, startM: number, lengthM: number, channel: number): { lateralM: number; verticalM: number } {
  const centre = { x: 0, y: 0 };
  let meanX = 0;
  let samples = 0;
  for (let d = 0; d <= lengthM; d += STREAM_PATH_STEP_M) {
    streamCentreAnalytic(k, startM + d, centre);
    meanX += centre.x;
    samples += 1;
  }
  const inward = meanX / samples <= 0 ? 1 : -1;
  const mainExcess = forkCorridorExcessM(k, startM, lengthM, 0);
  const wanted = FORK_LATERAL_MIN_M + modelHash(seed, channel) * FORK_LATERAL_SPAN_M;
  let lateralM = 0;
  for (let magnitude = wanted; magnitude >= FORK_LATERAL_MIN_M - 1e-9 && lateralM === 0; magnitude -= 10) {
    for (const sign of [inward, -inward]) {
      if (forkCorridorExcessM(k, startM, lengthM, sign * magnitude) <= mainExcess + 1e-9) {
        lateralM = sign * magnitude;
        break;
      }
    }
  }
  if (lateralM === 0) fail('SKYRIVER_R21_FORK_LATERAL_UNPLACEABLE');

  const wantedUp = FORK_VERTICAL_MIN_M + modelHash(seed, channel + 1) * FORK_VERTICAL_SPAN_M;
  const up = modelHash(seed, channel + 2) < 0.5 ? 1 : -1;
  let verticalM = 0;
  for (let magnitude = wantedUp; magnitude >= FORK_VERTICAL_MIN_M - 1e-9 && verticalM === 0; magnitude -= 5) {
    for (const sign of [up, -up]) {
      if (forkAltitudeExcessM(k, startM, lengthM, sign * magnitude) <= 1e-9) {
        verticalM = sign * magnitude;
        break;
      }
    }
  }
  if (verticalM === 0) fail('SKYRIVER_R21_FORK_VERTICAL_UNPLACEABLE');
  return { lateralM, verticalM };
}

/** Same-direction neighbours of a stream, by adjacent altitude shelf inside its direction group. */
export function hopPartners(k: number): readonly number[] {
  const direction = STREAM_DESCRIPTORS[k]!.direction;
  const group = STREAM_DESCRIPTORS.slice(0, FORK_STREAM_COUNT)
    .filter((st) => st.direction === direction)
    .sort((a, b) => a.y - b.y);
  const at = group.findIndex((st) => st.path === k);
  if (at < 0) fail('SKYRIVER_R21_HOP_GROUP_MISSING');
  const out: number[] = [];
  if (at > 0) out.push(group[at - 1]!.path);
  if (at + 1 < group.length) out.push(group[at + 1]!.path);
  return out;
}

/**
 * Seeded placement of one support. The reserved intervals are grown by `gapM` and painted onto a
 * cell ring; the support then takes a seeded position among every cell whose following run is long
 * enough. This is bounded and exhaustive: it only fails when the loop has no gap that fits, which is
 * a model error, not a retry.
 */
function placeSupport(
  seed: number,
  channel: number,
  lengthM: number,
  blocked: readonly ArcInterval[],
  gapM: number,
  insideLap: boolean,
  code: string,
  /** Optional cost of a candidate start, lower is better. The best quarter is kept. */
  score?: (startM: number) => number,
): number {
  const cells = STREAM_PATH_SAMPLES;
  const free = new Uint8Array(cells).fill(1);
  for (const b of blocked) {
    const from = Math.floor((b.startM - gapM) / PLACEMENT_CELL_M);
    const to = Math.ceil((b.startM + b.lengthM + gapM) / PLACEMENT_CELL_M);
    for (let i = from; i <= to; i += 1) free[((i % cells) + cells) % cells] = 0;
  }
  // run[i] = free cells from i onward, over two laps so a run can wrap the seam.
  const run = new Int32Array(cells * 2 + 1);
  for (let i = cells * 2 - 1; i >= 0; i -= 1) {
    run[i] = free[i % cells] === 1 ? Math.min(cells, 1 + run[i + 1]!) : 0;
  }
  const need = Math.ceil(lengthM / PLACEMENT_CELL_M) + 1;
  const starts: number[] = [];
  for (let i = 0; i < cells; i += 1) {
    if (run[i]! < need) continue;
    // A course-change ramp must sit strictly inside one lap. Its lap weight relies on the ramp being
    // finished at the seam (s = 1 on one side, 0 on the other); a ramp across the seam would make
    // the lap-parity flip a step instead of a join.
    if (insideLap && (i * PLACEMENT_CELL_M < gapM || i * PLACEMENT_CELL_M + lengthM > L - gapM)) continue;
    starts.push(i);
  }
  if (starts.length === 0) return fail(code);
  let feasible = starts;
  if (score !== undefined) {
    const ranked = starts
      .map((cell) => ({ cell, cost: score(cell * PLACEMENT_CELL_M) }))
      .sort((a, b) => a.cost - b.cost);
    feasible = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 4))).map((entry) => entry.cell);
  }
  const pick = feasible[Math.min(feasible.length - 1, Math.floor(modelHash(seed, channel) * feasible.length))]!;
  return pick * PLACEMENT_CELL_M;
}

/** Bakes the 39-row path table for one seed. */
function bakeStreamPathTable(forks: readonly (readonly Fork[])[]): StreamPathTable {
  const width = STREAM_PATH_SAMPLES + 1;
  const height = STREAM_PATH_ROWS;
  const data = new Float32Array(width * height * 4);
  const centre = { x: 0, y: 0 };
  const slope = { x: 0, y: 0 };
  const writeRow = (row: number, k: number, bits: number): void => {
    const streamForks = k < FORK_STREAM_COUNT ? forks[k]! : [];
    for (let i = 0; i < width; i += 1) {
      const v = i * STREAM_PATH_STEP_M;
      streamCentreAnalytic(k, v, centre);
      streamCentreSlopeAnalytic(k, v, slope);
      let x = centre.x;
      let y = centre.y;
      let sx = slope.x;
      let sy = slope.y;
      for (let f = 0; f < streamForks.length; f += 1) {
        if (((bits >> f) & 1) === 0) continue;
        const fork = streamForks[f]!;
        const d = wrapArc(v - fork.startM);
        const bump = forkBump(d, fork.lengthM, fork.rampM);
        const rate = forkBumpRate(d, fork.lengthM, fork.rampM);
        x += fork.lateralM * bump;
        y += fork.verticalM * bump;
        sx += fork.lateralM * rate;
        sy += fork.verticalM * rate;
      }
      const o = (row * width + i) * 4;
      data[o] = x;
      data[o + 1] = y;
      data[o + 2] = sx;
      data[o + 3] = sy;
    }
  };
  for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
    for (let bits = 0; bits < STREAM_VARIANTS; bits += 1) writeRow(k * STREAM_VARIANTS + bits, k, bits);
  }
  for (let lane = 0; lane < IMPOSTOR_LANES.length; lane += 1) {
    writeRow(LANE_ROW_0 + lane, FORK_STREAM_COUNT + lane, 0);
  }
  const w: WarpOut = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < width; i += 1) {
    warpCanyon(0, i * STREAM_PATH_STEP_M, w);
    const o = (WARP_ROW * width + i) * 4;
    data[o] = w.x;
    data[o + 1] = w.z;
    data[o + 2] = Math.cos(w.heading);
    data[o + 3] = Math.sin(w.heading);
  }
  return { width, height, data };
}

function buildRenderTrafficModel(seed: number): RenderTrafficModel {
  const forks: Fork[][] = [];
  const supports: ArcInterval[][] = [];
  for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
    const reserved = interchangeIntervals(k);
    const own: Fork[] = [];
    const ownSpans: ArcInterval[] = [];
    const count = modelHash(seed, 0x1000 + k) < 0.5 ? 1 : 2;
    for (let f = 0; f < count; f += 1) {
      const channel = 0x2000 + k * 0x200 + f * 0x100;
      // Snapped to the table step, so both ends of a support land on a baked sample and the branch
      // rejoins the main line exactly there instead of within one cell of it.
      const lengthM = Math.round((FORK_LENGTH_MIN_M + modelHash(seed, channel) * FORK_LENGTH_SPAN_M) / PLACEMENT_CELL_M) * PLACEMENT_CELL_M;
      const startM = placeSupport(seed, channel + 1, lengthM, [...reserved, ...ownSpans], FORK_GAP_M, false, 'SKYRIVER_R21_FORK_PLACEMENT');
      const { lateralM, verticalM } = chooseForkOffsets(seed, k, startM, lengthM, channel + 0xc0);
      own.push({ startM, lengthM, rampM: FORK_RAMP_M, lateralM, verticalM });
      ownSpans.push({ startM, lengthM });
    }
    forks.push(own);
    supports.push(ownSpans);
  }

  const hops: HopLink[] = [];
  for (let k = 0; k < FORK_STREAM_COUNT; k += 1) {
    const partners = hopPartners(k);
    const b = partners[Math.min(partners.length - 1, Math.floor(modelHash(seed, 0x3000 + k) * partners.length))]!;
    const shelfGapM = Math.abs(STREAM_DESCRIPTORS[b]!.y - STREAM_DESCRIPTORS[k]!.y);
    const rampM = shelfGapM > HOP_STEEP_GAP_M
      ? HOP_RAMP_MIN_M + HOP_RAMP_SPAN_M
      : Math.round((HOP_RAMP_MIN_M + modelHash(seed, 0x3100 + k) * HOP_RAMP_SPAN_M) / PLACEMENT_CELL_M) * PLACEMENT_CELL_M;
    // Reserved for a course change: both streams' interchange ramps (the R15 sticky cars hand over
    // inside them) and the source stream's own fork supports, so a fork and a merge never sit on the
    // same stretch of one stream. The target's fork supports are not reserved: the ramp blends two
    // complete valid paths, and a convex blend of two in-corridor points is in the corridor.
    const blocked = [
      ...interchangeIntervals(k),
      ...interchangeIntervals(b),
      ...supports[k]!,
    ];
    // Prefer the stretch where the two shelves run closest: the ramp length is fixed by the
    // contract at 600-900 m, so the only way to keep the climb flyable is to cross where the gap is
    // smallest. Without this the ramp can land where a partner is mid-interchange and the climb
    // doubles.
    const centreA = { x: 0, y: 0 };
    const centreB = { x: 0, y: 0 };
    const separation = (startM: number): number => {
      let worst = 0;
      for (let d = 0; d <= rampM; d += PLACEMENT_CELL_M) {
        streamCentreAnalytic(k, startM + d, centreA);
        streamCentreAnalytic(b, startM + d, centreB);
        worst = Math.max(worst, Math.hypot(centreB.x - centreA.x, centreB.y - centreA.y));
      }
      return worst;
    };
    const startM = placeSupport(seed, 0x3200 + k * 0x100, rampM, blocked, HOP_GAP_M, true, 'SKYRIVER_R21_HOP_PLACEMENT', separation);
    hops.push({ a: k, b, startM, rampM, shelfGapM });
    supports[k]!.push({ startM, lengthM: rampM });
  }

  return Object.freeze({
    seed,
    streams: STREAM_DESCRIPTORS,
    forks: Object.freeze(forks.map((list) => Object.freeze(list))),
    hops: Object.freeze(hops),
    table: bakeStreamPathTable(forks),
    impostorSalt: mix32(Math.imul(seed | 0, 0x2545f491) ^ 0x1f2e3d4c),
    carSalt: mix32(mix32(Math.imul(seed | 0, 0x2545f491) ^ 0x1f2e3d4c) ^ 0x3c6ef372),
  });
}

/**
 * The model for a seed. Cached, because the table costs ~1 MB and a full bake; the cache is keyed by
 * seed and bounded, so a probe that walks several seeds can never read another seed's branches.
 */
const MODEL_CACHE_LIMIT = 4;
const modelCache = new Map<number, RenderTrafficModel>();
export function renderTrafficModel(seed: number): RenderTrafficModel {
  const key = assertSeed(seed);
  const cached = modelCache.get(key);
  if (cached !== undefined) return cached;
  const model = buildRenderTrafficModel(key);
  if (modelCache.size >= MODEL_CACHE_LIMIT) {
    const oldest = modelCache.keys().next();
    if (!oldest.done) modelCache.delete(oldest.value);
  }
  modelCache.set(key, model);
  return model;
}

/** The baked table row a car flies: stream variant, lane, or the warp row. */
export function bakedPathRow(path: number, forkBits: number): number {
  if (path < FORK_STREAM_COUNT) return path * STREAM_VARIANTS + (forkBits & (STREAM_VARIANTS - 1));
  if (path < IMPOSTOR_PATHS.length) return LANE_ROW_0 + (path - FORK_STREAM_COUNT);
  return fail('SKYRIVER_STREAM_PATH_OUT_OF_RANGE');
}

/** The logical path a baked row belongs to. */
export function pathOfBakedRow(row: number): number {
  if (row < LANE_ROW_0) return Math.floor(row / STREAM_VARIANTS);
  if (row < WARP_ROW) return FORK_STREAM_COUNT + (row - LANE_ROW_0);
  return fail('SKYRIVER_STREAM_ROW_OUT_OF_RANGE');
}

/* ------------------------------------------------------------------------------------------------
 * Per-car flow: speed band, convoy, passing, branch choice, course change.
 * ---------------------------------------------------------------------------------------------- */

/** The per-car inputs a flow sample needs. One scratch object per caller. */
export interface FlowInput {
  /** Logical path 0..19. */
  path: number;
  /** Permanent car index inside its population, and that population's salt. */
  index: number;
  salt: number;
  /** Density pulse the car sits in (shared by its convoy). */
  pulse: number;
  /** Sub-row 0..1, motion phase 0..1, appearance seed 0..1. */
  row: number;
  phase: number;
  appearanceSeed: number;
  /** Probability this car hops. 0 keeps its trajectory fixed for every tier. */
  hopShare: number;
  /** False keeps R15 chase cars on their assigned stream. */
  allowForks: boolean;
}

/** Everything the model decides about one car's motion. */
export interface FlowSample {
  path: number;
  kind: StreamClass;
  direction: -1 | 1;
  /** Cruise speed sampled inside the class band, metres per second. */
  sampledCruiseMps: number;
  convoy: boolean;
  /** 0.70-0.85 for a convoy member, exactly 1 otherwise. */
  convoyRatio: number;
  /** sampledCruiseMps * convoyRatio: the speed the car actually travels at. */
  effectiveMps: number;
  /** Signed lateral passing amplitude, metres, and its period in seconds. */
  passAmplitudeM: number;
  passPeriodS: number;
  /** Fork bits 0..3, the baked variant of the car's stream. */
  forkBits: number;
  hop: boolean;
  hopTarget: number;
  bakedRowA: number;
  bakedRowB: number;
  hopStartM: number;
  hopRampM: number;
  /** Decorrelated 0..1 used to re-scatter sub-rows across a branch. */
  scatterRow: number;
}

export function newFlowSample(): FlowSample {
  return {
    path: 0, kind: 'standard', direction: 1, sampledCruiseMps: 0, convoy: false, convoyRatio: 1,
    effectiveMps: 0, passAmplitudeM: 0, passPeriodS: STREAM_PASS_PERIOD_MIN_S, forkBits: 0,
    hop: false, hopTarget: 0, bakedRowA: 0, bakedRowB: 0, hopStartM: 0, hopRampM: HOP_RAMP_MIN_M,
    scatterRow: 0,
  };
}

/**
 * The merge re-scatter channel. It must be computable from the shipped attributes alone, because the
 * vertex shader has no spare attribute slot, so it folds the two independent avalanche channels the
 * car already carries. It only ever drives continuous offsets, never a sub-row index, so the float32
 * shader result and this float64 one stay within a fraction of a millimetre.
 */
export function scatterRowOf(phase: number, appearanceSeed: number): number {
  const x = phase * 41.7 + appearanceSeed * 17.3;
  return x - Math.floor(x);
}

/**
 * The single course-change decision. The per-car flow and the tier census both call it, so the
 * reported hop fraction is the one the renderer uses.
 */
export function carHops(index: number, salt: number, hopShare: number): boolean {
  return impostorHash((index + salt) | 0, FLOW_CHANNELS.hop) < hopShare;
}

/** Derives one car's motion from the model. Pure in (model, input). */
export function sampleStreamFlow(model: RenderTrafficModel, input: FlowInput, out: FlowSample): void {
  const path = input.path;
  const kind = streamClass(path);
  out.path = path;
  out.kind = kind;
  out.scatterRow = scatterRowOf(input.phase, input.appearanceSeed);
  if (kind === 'ring') {
    const ring = IMPOSTOR_RINGS[path - IMPOSTOR_PATHS.length]!;
    out.direction = ring[2]! > 0 ? 1 : -1;
    out.sampledCruiseMps = ring[5]! * (0.9 + 0.2 * input.row);
    out.convoy = false;
    out.convoyRatio = 1;
    out.effectiveMps = out.sampledCruiseMps;
    out.passAmplitudeM = 0;
    out.passPeriodS = STREAM_PASS_PERIOD_MIN_S;
    out.forkBits = 0;
    out.hop = false;
    out.hopTarget = path;
    out.bakedRowA = 0;
    out.bakedRowB = 0;
    out.hopStartM = 0;
    out.hopRampM = HOP_RAMP_MIN_M;
    return;
  }
  const st = model.streams[path]!;
  const h = (channel: number): number => impostorHash((input.index + input.salt) | 0, channel);
  out.direction = st.direction;

  const band = kind === 'lane' ? null : SPEED_BANDS[kind];
  let cruise = band === null
    ? st.nominalMps * (0.9 + 0.2 * input.row)
    : band.minMps + h(FLOW_CHANNELS.speed) * (band.maxMps - band.minMps);
  // Convoys are a property of the density pulse, so every member of a clump shares one ratio.
  const convoy = impostorHash((path * 101 + input.pulse) | 0, 0x121) < CONVOY_PULSE_SHARE;
  if (convoy) {
    const pulseCruise = band === null
      ? st.nominalMps * (0.9 + 0.2 * impostorHash((path * 101 + input.pulse) | 0, 0x123))
      : band.minMps + impostorHash((path * 101 + input.pulse) | 0, 0x123) * (band.maxMps - band.minMps);
    cruise = pulseCruise + (cruise - pulseCruise) * CONVOY_CRUISE_SPREAD;
  }
  const ratio = convoy
    ? CONVOY_RATIO_MIN + CONVOY_RATIO_SPAN * impostorHash((path * 101 + input.pulse) | 0, 0x122)
    : 1;
  out.sampledCruiseMps = cruise;
  out.convoy = convoy;
  out.convoyRatio = ratio;
  out.effectiveMps = cruise * ratio;

  // Passing: faster than the class median slides to one side, slower slides to the other. A convoy
  // member holds its place. No neighbour query, so the cost is one sine per car.
  const median = band === null ? st.nominalMps : (band.minMps + band.maxMps) * 0.5;
  out.passAmplitudeM = convoy
    ? 0
    : clamp((cruise - median) * STREAM_PASS_GAIN, -STREAM_PASS_MAX_M, STREAM_PASS_MAX_M);
  out.passPeriodS = STREAM_PASS_PERIOD_MIN_S + h(FLOW_CHANNELS.passPeriod) * STREAM_PASS_PERIOD_SPAN_S;

  // Branch choice: two independent avalanche bits, read once at spawn and never mid-flight.
  const forkable = input.allowForks && path < FORK_STREAM_COUNT;
  const bit0 = forkable && h(FLOW_CHANNELS.fork0) < FORK_TAKE_SHARE ? 1 : 0;
  const bit1 = forkable && h(FLOW_CHANNELS.fork1) < FORK_TAKE_SHARE ? 2 : 0;
  out.forkBits = bit0 | bit1;

  const link = forkable ? model.hops[path] : undefined;
  out.hop = link !== undefined && carHops(input.index, input.salt, input.hopShare);
  out.hopTarget = out.hop && link !== undefined ? link.b : path;
  out.bakedRowA = bakedPathRow(path, out.forkBits);
  out.bakedRowB = bakedPathRow(out.hopTarget, out.forkBits);
  out.hopStartM = out.hop && link !== undefined ? link.startM : 0;
  // A non-hopper keeps a positive ramp so the lap weight stays finite; both rows are equal, so the
  // blend is exact and the weight has no effect.
  out.hopRampM = out.hop && link !== undefined ? link.rampM : HOP_RAMP_MIN_M;
}

/* ------------------------------------------------------------------------------------------------
 * The shared evaluator. The vertex shader (traffic.ts IMPOSTOR_VERTEX) mirrors this exactly.
 * ---------------------------------------------------------------------------------------------- */

interface PathSample {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
}

/** Linear sample of one canyon row at table coordinate f = v / STREAM_PATH_STEP_M. */
export function sampleStreamPath(table: StreamPathTable, row: number, f: number, out: PathSample): void {
  const i0 = Math.min(STREAM_PATH_SAMPLES - 1, Math.max(0, Math.floor(f)));
  const fr = f - i0;
  const o0 = (row * table.width + i0) * 4;
  const o1 = o0 + 4;
  const d = table.data;
  out.cx = d[o0]! + (d[o1]! - d[o0]!) * fr;
  out.cy = d[o0 + 1]! + (d[o1 + 1]! - d[o0 + 1]!) * fr;
  out.sx = d[o0 + 2]! + (d[o1 + 2]! - d[o0 + 2]!) * fr;
  out.sy = d[o0 + 3]! + (d[o1 + 3]! - d[o0 + 3]!) * fr;
}

export interface WarpRowSample {
  x: number;
  z: number;
  cos: number;
  sin: number;
}

/** Linear sample of the baked warp row, heading renormalized. CPU stream cars read this row too. */
export function sampleWarpRow(table: StreamPathTable, f: number, out: WarpRowSample): void {
  const i0 = Math.min(STREAM_PATH_SAMPLES - 1, Math.max(0, Math.floor(f)));
  const fr = f - i0;
  const o0 = (WARP_ROW * table.width + i0) * 4;
  const o1 = o0 + 4;
  const d = table.data;
  out.x = d[o0]! + (d[o1]! - d[o0]!) * fr;
  out.z = d[o0 + 1]! + (d[o1 + 1]! - d[o0 + 1]!) * fr;
  let c = d[o0 + 2]! + (d[o1 + 2]! - d[o0 + 2]!) * fr;
  let s = d[o0 + 3]! + (d[o1 + 3]! - d[o0 + 3]!) * fr;
  const length = Math.hypot(c, s) || 1;
  c /= length;
  s /= length;
  out.cos = c;
  out.sin = s;
}

/** Canyon-space pose of one car, plus the derivatives its heading needs. */
export interface CanyonPose {
  /** Canyon across (before the corridor guard) and altitude, metres. */
  x: number;
  y: number;
  /** d/dv of x and y along the path, dimensionless. */
  dxdv: number;
  dydv: number;
  /** Lateral and vertical rates from the time-only terms, metres per second. */
  xRate: number;
  yRate: number;
  /** Unwrapped signed canyon arc, its lap index, and the wrapped arc in [0, L). */
  arcM: number;
  lap: number;
  wrappedM: number;
  /** Course-change weight 0..1 (0 = on stream A) and the branch envelope 0..1. */
  hopWeight: number;
  branchWeight: number;
}

export function newCanyonPose(): CanyonPose {
  return { x: 0, y: 0, dxdv: 0, dydv: 0, xRate: 0, yRate: 0, arcM: 0, lap: 0, wrappedM: 0, hopWeight: 0, branchWeight: 0 };
}

interface RowOffset {
  lat: number;
  vert: number;
  dlat: number;
  dvert: number;
  weight: number;
}

const offsetA: RowOffset = { lat: 0, vert: 0, dlat: 0, dvert: 0, weight: 0 };
const offsetB: RowOffset = { lat: 0, vert: 0, dlat: 0, dvert: 0, weight: 0 };
const pathScratch: PathSample = { cx: 0, cy: 0, sx: 0, sy: 0 };

/**
 * One path's canyon offset for one car: the baked centre, the car's sub-row, and the merge
 * re-scatter that dissolves the sub-row structure across a branch and restores it exactly at both
 * ends of the support, so a branch never reads as a copy of the main line's rows.
 */
function evaluatePathOffset(
  model: RenderTrafficModel,
  bakedRow: number,
  forkBits: number,
  row: number,
  appearanceSeed: number,
  scatterRow: number,
  wrappedM: number,
  f: number,
  out: RowOffset,
): void {
  sampleStreamPath(model.table, bakedRow, f, pathScratch);
  const path = pathOfBakedRow(bakedRow);
  const st = model.streams[path]!;
  const spacing = st.widthM / Math.max(1, st.rows - 1);
  const rowIndex = Math.min(st.rows - 1, Math.floor(row * st.rows));
  const rowLat = (rowIndex - (st.rows - 1) / 2) * spacing + (appearanceSeed - 0.5) * spacing * 0.6;
  const rowVert = rowIndex % 2 === 0 ? -3 : 3;
  const scatterLat = (scatterRow - 0.5) * st.widthM;
  const scatterVert = (scatterRow - 0.5) * 6;
  let bump = 0;
  let rate = 0;
  if (path < FORK_STREAM_COUNT && forkBits !== 0) {
    const forks = model.forks[path]!;
    for (let f0 = 0; f0 < forks.length; f0 += 1) {
      if (((forkBits >> f0) & 1) === 0) continue;
      const fork = forks[f0]!;
      const d = wrapArc(wrappedM - fork.startM);
      bump += forkBump(d, fork.lengthM, fork.rampM);
      rate += forkBumpRate(d, fork.lengthM, fork.rampM);
    }
  }
  out.lat = pathScratch.cx + rowLat + (scatterLat - rowLat) * bump;
  out.vert = pathScratch.cy + rowVert + (scatterVert - rowVert) * bump;
  out.dlat = pathScratch.sx + (scatterLat - rowLat) * rate;
  out.dvert = pathScratch.sy + (scatterVert - rowVert) * rate;
  out.weight = bump;
}

/**
 * The shared canyon evaluation. `arcM` is the unwrapped signed canyon arc: a car's nominal progress,
 * which advances at exactly its effective speed. The course change blends two complete paths, row
 * offsets included, with the lap parity deciding the direction, so the weight is continuous across
 * the lap seam and the car never snaps back to its source stream.
 */
export function evaluateCanyonPose(
  model: RenderTrafficModel,
  flow: FlowSample,
  arcM: number,
  timeS: number,
  phase: number,
  appearanceSeed: number,
  row: number,
  out: CanyonPose,
): void {
  const lap = Math.floor(arcM / L);
  const wrappedM = arcM - lap * L;
  const f = wrappedM / STREAM_PATH_STEP_M;
  const u = (wrappedM - flow.hopStartM) / flow.hopRampM;
  const s = quintic(u);
  const sRate = quinticRate(u) / flow.hopRampM;
  // Even laps run A -> B, odd laps B -> A. At the seam the ramp weight and the parity flip together,
  // so the blend is continuous: a weight that reset to zero each lap would teleport the car.
  const even = lap % 2 === 0;
  const w = even ? s : 1 - s;
  const dwdv = even ? sRate : -sRate;

  evaluatePathOffset(model, flow.bakedRowA, flow.forkBits, row, appearanceSeed, flow.scatterRow, wrappedM, f, offsetA);
  if (flow.bakedRowB === flow.bakedRowA) {
    offsetB.lat = offsetA.lat;
    offsetB.vert = offsetA.vert;
    offsetB.dlat = offsetA.dlat;
    offsetB.dvert = offsetA.dvert;
    offsetB.weight = offsetA.weight;
  } else {
    evaluatePathOffset(model, flow.bakedRowB, flow.forkBits, row, appearanceSeed, flow.scatterRow, wrappedM, f, offsetB);
  }

  const passArg = TAU * (timeS / flow.passPeriodS + phase);
  const passSin = Math.sin(passArg * 0.5);
  const pass = flow.passAmplitudeM * passSin * passSin;
  const passRate = flow.passAmplitudeM * (Math.PI / flow.passPeriodS) * Math.sin(passArg);
  const driftArg = timeS * 0.4 + phase * 31.0;
  const bobArg = timeS * 0.33 + phase * 17.0;
  const jitterY = ((appearanceSeed * 7.3) % 1) - 0.5;

  out.x = offsetA.lat + (offsetB.lat - offsetA.lat) * w + pass + 3 * Math.sin(driftArg);
  out.y = offsetA.vert + (offsetB.vert - offsetA.vert) * w + jitterY * 6 + 2 * Math.sin(bobArg);
  out.dxdv = offsetA.dlat + (offsetB.dlat - offsetA.dlat) * w + (offsetB.lat - offsetA.lat) * dwdv;
  out.dydv = offsetA.dvert + (offsetB.dvert - offsetA.dvert) * w + (offsetB.vert - offsetA.vert) * dwdv;
  out.xRate = passRate + 1.2 * Math.cos(driftArg);
  out.yRate = 0.66 * Math.cos(bobArg);
  out.arcM = arcM;
  out.lap = lap;
  out.wrappedM = wrappedM;
  out.hopWeight = w;
  out.branchWeight = offsetA.weight + (offsetB.weight - offsetA.weight) * w;
}

/* ------------------------------------------------------------------------------------------------
 * GPU impostor attributes and the CPU mirror.
 * ---------------------------------------------------------------------------------------------- */

/**
 * Per-impostor attributes.
 *   `streamArcPhaseSeed` (aImp)  — logical path, arc offset 0..1, motion phase 0..1, appearance seed.
 *   `row` (aImpRow)              — sub-row 0..1.
 *   `flow` (aFlow)               — sub-row, effective speed m/s, signed pass period s, pass amplitude m.
 *   `route` (aRoute)             — baked row A, baked row B, hop start m, hop ramp m.
 * R21 keeps aImp and row bit-identical to R18-R20 for every index, so the population, the path
 * shares and the density pulses are unchanged.
 */
export interface ImpostorAttributes {
  readonly seed: number;
  readonly count: number;
  readonly streamArcPhaseSeed: Float32Array;
  readonly row: Float32Array;
  readonly flow: Float32Array;
  readonly route: Float32Array;
}

/** One impostor's derived state. Pure in (model, index). */
export interface ImpostorCar {
  path: number;
  arc: number;
  phase: number;
  appearanceSeed: number;
  row: number;
  pulse: number;
  flow: FlowSample;
}

export function newImpostorCar(): ImpostorCar {
  return { path: 0, arc: 0, phase: 0, appearanceSeed: 0, row: 0, pulse: 0, flow: newFlowSample() };
}

let shareCache: { total: number; shares: number[] } | null = null;
function impostorShares(): { total: number; shares: number[] } {
  if (shareCache !== null) return shareCache;
  const shares: number[] = [];
  let total = 0;
  const laneTotal = IMPOSTOR_LANES.reduce((a, l) => a + l[9]!, 0);
  const ringTotal = IMPOSTOR_RINGS.reduce((a, r) => a + r[9]!, 0);
  for (const st of STREAMS) { total += st[9]! * IMPOSTOR_STREAM_SHARE; shares.push(total); }
  for (const lane of IMPOSTOR_LANES) { total += (lane[9]! / laneTotal) * IMPOSTOR_LANE_SHARE; shares.push(total); }
  for (const ring of IMPOSTOR_RINGS) { total += (ring[9]! / ringTotal) * IMPOSTOR_RING_SHARE; shares.push(total); }
  shareCache = { total, shares };
  return shareCache;
}

const flowInput: FlowInput = { path: 0, index: 0, salt: 0, pulse: 0, row: 0, phase: 0, appearanceSeed: 0, hopShare: 0, allowForks: true };

/**
 * One impostor, from the model and its index alone. Attributes for a count N are the first N of
 * these, so every tier draws a prefix and no car moves when the tier changes.
 */
export function deriveImpostorCar(model: RenderTrafficModel, index: number, out: ImpostorCar): void {
  if (!Number.isInteger(index) || index < 0) fail('SKYRIVER_IMPOSTOR_INDEX_INVALID');
  const { total, shares } = impostorShares();
  const h = (channel: number): number => impostorHash((index + model.impostorSalt) | 0, channel);
  const pick = h(FLOW_CHANNELS.path) * total;
  let k = 0;
  while (k < IMPOSTOR_PATH_COUNT - 1 && shares[k]! <= pick) k += 1;
  // Clumps: rings use 6-10 pulses (their [8] is the meander lobe count).
  const pulses = k < IMPOSTOR_PATHS.length ? IMPOSTOR_PATHS[k]![8]! : 6 + (k % 5);
  const slot = h(FLOW_CHANNELS.pulse) * pulses;
  const pulse = Math.floor(slot);
  const fill = 0.22 + 0.4 * hash01(k * 97 + pulse, 0x9a11);
  const offset = hash01(k * 131 + pulse, 0x9a12) * (1 - fill);
  out.path = k;
  out.arc = (pulse + offset + Math.pow(slot - pulse, 0.8) * fill) / pulses;
  out.phase = h(FLOW_CHANNELS.phase);
  out.appearanceSeed = h(FLOW_CHANNELS.appearance);
  out.row = h(FLOW_CHANNELS.row);
  out.pulse = pulse;
  flowInput.path = k;
  flowInput.index = index;
  flowInput.salt = model.impostorSalt;
  flowInput.pulse = pulse;
  flowInput.row = out.row;
  flowInput.phase = out.phase;
  flowInput.appearanceSeed = out.appearanceSeed;
  flowInput.hopShare = IMPOSTOR_HOP_SHARE;
  sampleStreamFlow(model, flowInput, out.flow);
}

/**
 * Impostor population for a seed: normalized path shares, arc offsets squeezed into density pulses
 * (clumps and gaps), and the R21 flow and route the vertex shader reads. Pure. The model is built
 * once per seed and cached, so this never rebakes the path table.
 */
export function deriveImpostorAttributes(seed: number, count: number, model?: RenderTrafficModel): ImpostorAttributes {
  if (!Number.isInteger(count) || count < 0) throw new Error('SKYRIVER_IMPOSTOR_COUNT_INVALID');
  const resolved = model ?? renderTrafficModel(seed);
  if (resolved.seed !== assertSeed(seed)) fail('SKYRIVER_IMPOSTOR_MODEL_SEED_MISMATCH');
  const streamArcPhaseSeed = new Float32Array(count * 4);
  const row = new Float32Array(count);
  const flow = new Float32Array(count * 4);
  const route = new Float32Array(count * 4);
  const car = newImpostorCar();
  for (let i = 0; i < count; i += 1) {
    deriveImpostorCar(resolved, i, car);
    streamArcPhaseSeed[i * 4] = car.path;
    streamArcPhaseSeed[i * 4 + 1] = car.arc;
    streamArcPhaseSeed[i * 4 + 2] = car.phase;
    streamArcPhaseSeed[i * 4 + 3] = car.appearanceSeed;
    row[i] = car.row;
    flow[i * 4] = car.row;
    flow[i * 4 + 1] = car.flow.effectiveMps;
    // The sign carries the pass direction, the magnitude the period, and aRoute.w the amplitude.
    flow[i * 4 + 2] = car.flow.passAmplitudeM < 0 ? -car.flow.passPeriodS : car.flow.passPeriodS;
    flow[i * 4 + 3] = Math.abs(car.flow.passAmplitudeM);
    route[i * 4] = car.flow.bakedRowA;
    route[i * 4 + 1] = car.flow.bakedRowB;
    route[i * 4 + 2] = car.flow.hopStartM;
    route[i * 4 + 3] = car.flow.hopRampM;
  }
  return { seed: resolved.seed, count, streamArcPhaseSeed, row, flow, route };
}

/** The pose `impostorPosition` writes. `dy` is the vertical travel component (R21 branch slopes). */
export interface ImpostorPose {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number
  dy?: number;
}

const mirrorFlow = newFlowSample();
const mirrorPose = newCanyonPose();
const mirrorWarp: WarpRowSample = { x: 0, z: 0, cos: 0, sin: 0 };

/** Reads one car's flow straight out of its shipped attributes, as the vertex shader does. */
function flowFromAttributes(attrs: ImpostorAttributes, i: number, path: number, out: FlowSample): void {
  const period = attrs.flow[i * 4 + 2]!;
  out.path = path;
  out.kind = streamClass(path);
  out.direction = IMPOSTOR_PATHS[Math.min(path, IMPOSTOR_PATHS.length - 1)]![2]! > 0 ? 1 : -1;
  out.effectiveMps = attrs.flow[i * 4 + 1]!;
  out.sampledCruiseMps = out.effectiveMps;
  out.convoy = false;
  out.convoyRatio = 1;
  out.passPeriodS = Math.abs(period);
  out.passAmplitudeM = period < 0 ? -attrs.flow[i * 4 + 3]! : attrs.flow[i * 4 + 3]!;
  out.bakedRowA = Math.round(attrs.route[i * 4]!);
  out.bakedRowB = Math.round(attrs.route[i * 4 + 1]!);
  out.hopStartM = attrs.route[i * 4 + 2]!;
  out.hopRampM = attrs.route[i * 4 + 3]!;
  out.hop = out.bakedRowB !== out.bakedRowA;
  out.hopTarget = out.hop ? pathOfBakedRow(out.bakedRowB) : path;
  out.forkBits = path < FORK_STREAM_COUNT ? out.bakedRowA % STREAM_VARIANTS : 0;
  out.scatterRow = scatterRowOf(attrs.streamArcPhaseSeed[i * 4 + 2]!, attrs.streamArcPhaseSeed[i * 4 + 3]!);
}

/**
 * CPU mirror of the impostor vertex shader (traffic.ts IMPOSTOR_VERTEX, impostor branch): world
 * position and travel direction of impostor i at time t (seconds). Keep the two in step.
 */
export function impostorPosition(attrs: ImpostorAttributes, i: number, t: number, out: ImpostorPose): void {
  const model = renderTrafficModel(attrs.seed);
  const k = attrs.streamArcPhaseSeed[i * 4]!;
  const arc = attrs.streamArcPhaseSeed[i * 4 + 1]!;
  const phase = attrs.streamArcPhaseSeed[i * 4 + 2]!;
  const seed = attrs.streamArcPhaseSeed[i * 4 + 3]!;
  const row = attrs.row[i]!;
  if (k >= IMPOSTOR_PATHS.length) {
    // Air-traffic ring (world space). Unchanged since R18, surge included.
    const rg = IMPOSTOR_RINGS[k - IMPOSTOR_PATHS.length]!;
    const [R, alt, dir, rows, width, speed0, meander, wobble, lobes] = rg as unknown as number[];
    const c = loopCentroid();
    const speed = speed0! * (0.9 + 0.2 * row);
    const surge = RING_SURGE_M * Math.sin(t * (0.3 + 0.25 * row) + phase * 97.0);
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
    out.dy = 0;
    return;
  }
  flowFromAttributes(attrs, i, k, mirrorFlow);
  const direction = mirrorFlow.direction;
  const arcM = arc * L + direction * mirrorFlow.effectiveMps * t;
  evaluateCanyonPose(model, mirrorFlow, arcM, t, phase, seed, row, mirrorPose);
  const x = clamp(mirrorPose.x, -STREAM_CORRIDOR_HALF_M, STREAM_CORRIDOR_HALF_M);
  sampleWarpRow(model.table, mirrorPose.wrappedM / STREAM_PATH_STEP_M, mirrorWarp);
  // Canyon (x across, v along) -> world: centre + x * (cos h, -sin h); along = (sin h, cos h).
  out.x = mirrorWarp.x + x * mirrorWarp.cos;
  out.y = mirrorPose.y;
  out.z = mirrorWarp.z - x * mirrorWarp.sin;
  const along = direction * mirrorFlow.effectiveMps;
  const across = mirrorPose.dxdv * along + mirrorPose.xRate;
  const up = mirrorPose.dydv * along + mirrorPose.yRate;
  const wx = along * mirrorWarp.sin + across * mirrorWarp.cos;
  const wz = along * mirrorWarp.cos - across * mirrorWarp.sin;
  const length = Math.hypot(wx, up, wz) || 1;
  out.dx = wx / length;
  out.dz = wz / length;
  out.dy = up / length;
}

/** Read-only flow metadata of impostor i at time t. No production draw depends on this. */
export interface ImpostorFlowReport {
  path: number;
  kind: StreamClass;
  direction: -1 | 1;
  sampledCruiseMps: number;
  effectiveCruiseMps: number;
  convoy: boolean;
  convoyRatio: number;
  normalBandMps: readonly [number, number] | null;
  /** Nominal canyon progress, unwrapped and signed, metres. Advances at the effective speed. */
  unwrappedCanyonArcM: number;
  wrappedCanyonArcM: number;
  lap: number;
  route: {
    bakedRowA: number;
    bakedRowB: number;
    forkBits: number;
    hop: boolean;
    hopTarget: number;
    hopStartM: number;
    hopRampM: number;
    hopWeight: number;
    branchWeight: number;
  };
  traits: {
    arc: number;
    phase: number;
    appearanceSeed: number;
    row: number;
    pulse: number;
    forkBits: number;
    hop: number;
    passAmplitudeM: number;
    passPeriodS: number;
    bakedRowA: number;
    bakedRowB: number;
  };
}

export function newImpostorFlowReport(): ImpostorFlowReport {
  return {
    path: 0, kind: 'standard', direction: 1, sampledCruiseMps: 0, effectiveCruiseMps: 0,
    convoy: false, convoyRatio: 1, normalBandMps: null, unwrappedCanyonArcM: 0,
    wrappedCanyonArcM: 0, lap: 0,
    route: { bakedRowA: 0, bakedRowB: 0, forkBits: 0, hop: false, hopTarget: 0,
      hopStartM: 0, hopRampM: HOP_RAMP_MIN_M, hopWeight: 0, branchWeight: 0 },
    traits: { arc: 0, phase: 0, appearanceSeed: 0, row: 0, pulse: 0, forkBits: 0,
      hop: 0, passAmplitudeM: 0, passPeriodS: STREAM_PASS_PERIOD_MIN_S,
      bakedRowA: 0, bakedRowB: 0 },
  };
}

const flowCar = newImpostorCar();
const flowPose = newCanyonPose();

/**
 * The speed and route proof's read-side hook. It reports the model's own metadata, so a probe can
 * separate nominal canyon progress from geometric world speed without a second position formula.
 */
export function impostorFlow(attrs: ImpostorAttributes, i: number, t: number, out: ImpostorFlowReport): ImpostorFlowReport {
  const model = renderTrafficModel(attrs.seed);
  deriveImpostorCar(model, i, flowCar);
  const flow = flowCar.flow;
  const report = out;
  report.path = flow.path;
  report.kind = flow.kind;
  report.direction = flow.direction;
  report.sampledCruiseMps = flow.sampledCruiseMps;
  report.effectiveCruiseMps = flow.effectiveMps;
  report.convoy = flow.convoy;
  report.convoyRatio = flow.convoyRatio;
  const band = streamBand(flow.path);
  report.normalBandMps = band === null ? null : [band.minMps, band.maxMps];
  if (flow.kind === 'ring') {
    const rg = IMPOSTOR_RINGS[flow.path - IMPOSTOR_PATHS.length]!;
    const surge = RING_SURGE_M * Math.sin(t * (0.3 + 0.25 * flowCar.row) + flowCar.phase * 97.0);
    report.unwrappedCanyonArcM = flowCar.arc * TAU * rg[0]! + flow.direction * flow.effectiveMps * t + surge;
    report.wrappedCanyonArcM = wrapArc(report.unwrappedCanyonArcM);
    report.lap = 0;
    report.route = { bakedRowA: -1, bakedRowB: -1, forkBits: 0, hop: false, hopTarget: flow.path, hopStartM: 0, hopRampM: 0, hopWeight: 0, branchWeight: 0 };
  } else {
    const arcM = flowCar.arc * L + flow.direction * flow.effectiveMps * t;
    evaluateCanyonPose(model, flow, arcM, t, flowCar.phase, flowCar.appearanceSeed, flowCar.row, flowPose);
    report.unwrappedCanyonArcM = arcM;
    report.wrappedCanyonArcM = flowPose.wrappedM;
    report.lap = flowPose.lap;
    report.route = {
      bakedRowA: flow.bakedRowA,
      bakedRowB: flow.bakedRowB,
      forkBits: flow.forkBits,
      hop: flow.hop,
      hopTarget: flow.hopTarget,
      hopStartM: flow.hopStartM,
      hopRampM: flow.hopRampM,
      hopWeight: flowPose.hopWeight,
      branchWeight: flowPose.branchWeight,
    };
  }
  report.traits = {
    arc: flowCar.arc,
    phase: flowCar.phase,
    appearanceSeed: flowCar.appearanceSeed,
    row: flowCar.row,
    pulse: flowCar.pulse,
    forkBits: flow.forkBits,
    hop: flow.hop ? 1 : 0,
    passAmplitudeM: flow.passAmplitudeM,
    passPeriodS: flow.passPeriodS,
    bakedRowA: flow.bakedRowA,
    bakedRowB: flow.bakedRowB,
  };
  return report;
}
