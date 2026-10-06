/**
 * @file derive.ts — seeded city and traffic derivations, as plain data.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   Design "Sim ↔ render split" — city layout is cached once at boot and never evaluated inside
 *     step(); traffic transforms are presentation-derived and never feed simulation.
 *   Design "Identity & session config" — the seed drives all derive* functions, so a peer or replay
 *     reproduces the same city and traffic.
 *   R3 — seeded brutalist canyon, instanced modules.
 *   R4 — >= 2,000 flying vehicles in Fifth Element altitude layers, 3 instanced archetypes.
 *   File Roster — "Seeded city/traffic derivations on root-entry math/noise (float, cached outside step)".
 *
 * These results are presentation inputs, not simulation state: nothing here is checksummed. They are
 * still pure functions of the seed, because every peer must see the same city. No renderer types
 * appear in this file — T3/T4 turn this data into instanced geometry.
 *
 * API anchors (games/skyriver-demo/node_modules/@series-inc/rundot-syncplay):
 *   dist/index.d.ts    — root entry exports DeterministicRandom, fbm2D and createDeterministicMath.
 *   dist/noise.d.ts    — fbm2D(math, xFixed, yFixed, seed, octaves) → fixed value in [-scale, scale].
 *   dist/random.d.ts   — DeterministicRandom.fork(label) gives an independent labelled sub-stream.
 */
import { DeterministicRandom, createDeterministicMath, fbm2D } from '@series-inc/rundot-syncplay';

import { CHASM_BOUNDS } from './systems';

const FIXED_SCALE = 1_000_000;
const math = createDeterministicMath(FIXED_SCALE);

/** Hard ceiling on the tower list. The canyon is a fixed grid, so this is a guard, not a budget. */
export const MAX_CITY_TOWERS = 256;

/** Grid spacing between tower centres, metres. */
const CITY_CELL_M = 320;
/** Distance from the chasm centreline to the first column of towers. */
const CITY_WALL_OFFSET_M = 560;
const CITY_COLUMNS_PER_SIDE = 4;
const CITY_ROWS = 11;

const TOWER_MIN_FOOTPRINT_M = 120;
const TOWER_FOOTPRINT_SPAN_M = 120;
const TOWER_MIN_HEIGHT_M = 240;
const TOWER_MAX_HEIGHT_M = 1900;
/** Share of the height taken from the large-scale skyline noise; the rest is per-tower variation. */
const TOWER_SKYLINE_WEIGHT = 0.7;
const CITY_NOISE_OCTAVES = 4;
/** Grid-to-noise scale: one cell is this far across the noise field. */
const CITY_NOISE_STEP = 0.6;

/** Brutalist concretes, with two sparse neon-lit accents (plan R3: "sparse neon"). */
const TOWER_TINTS: readonly number[] = Object.freeze([
  0x8d8f91,
  0x7a7d80,
  0x696d71,
  0x9aa0a4,
  0x585c60,
  0x2e6f8e,
  0x8e3a63,
]);
const TOWER_TINT_WEIGHTS: readonly number[] = Object.freeze([22, 22, 20, 16, 14, 3, 3]);

export const TRAFFIC_BAND_COUNT = 8;
export const TRAFFIC_ARCHETYPE_COUNT = 3;
export const TRAFFIC_MIN_ALTITUDE_M = 200;
export const TRAFFIC_MAX_ALTITUDE_M = 1600;
/** Headroom above the plan's top quality tier of 2,400 cars. */
export const TRAFFIC_MAX_CARS = 4096;

const TRAFFIC_BAND_SPACING_M = (TRAFFIC_MAX_ALTITUDE_M - TRAFFIC_MIN_ALTITUDE_M) / (TRAFFIC_BAND_COUNT - 1);
const TRAFFIC_ALTITUDE_JITTER_M = 60;
const TRAFFIC_MIN_SPEED_MPS = 30;
const TRAFFIC_SPEED_SPAN_MPS = 60;
/** Phase denominator. A power of two keeps every phase exactly representable and strictly below 1. */
const TRAFFIC_PHASE_STEPS = 65_536;

export interface SkyriverTower {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Packed 0xRRGGBB. Plain data: the renderer owns colour objects. */
  readonly tint: number;
}

export interface SkyriverCityLayout {
  readonly seed: number;
  readonly cell: number;
  readonly maxHeight: number;
  readonly towers: readonly SkyriverTower[];
}

export interface SkyriverTrafficParams {
  readonly seed: number;
  readonly count: number;
  /** Altitude band index, 0 .. TRAFFIC_BAND_COUNT - 1. */
  readonly band: Uint8Array;
  /** Lateral offset within the band, -1 .. 1. */
  readonly lane: Float32Array;
  /** Metres per second; the sign is the direction of travel along the band. */
  readonly speed: Float32Array;
  /** Position along the band at t = 0, in [0, 1). */
  readonly phase: Float32Array;
  /** Instanced mesh archetype, 0 .. TRAFFIC_ARCHETYPE_COUNT - 1. */
  readonly archetype: Uint8Array;
  /** Metres, banded across TRAFFIC_MIN_ALTITUDE_M .. TRAFFIC_MAX_ALTITUDE_M. */
  readonly altitude: Float32Array;
}

function fail(code: string): never {
  throw new Error(code);
}

function assertSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) fail('SKYRIVER_SEED_INVALID');
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Derives the canyon: a grid of brutalist slabs on both sides of the chasm, graded by a large-scale
 * noise skyline so the wall reads as a city rather than a fence.
 *
 * The corridor is left clear by construction — the nearest face of every tower sits at or beyond the
 * chasm bound, so the flight volume is always flyable.
 */
export function deriveCityLayout(seed: number): SkyriverCityLayout {
  assertSeed(seed);
  const random = new DeterministicRandom(seed).fork('skyriver.city');
  const towers: SkyriverTower[] = [];

  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? -1 : 1;
    for (let column = 0; column < CITY_COLUMNS_PER_SIDE; column += 1) {
      for (let row = 0; row < CITY_ROWS; row += 1) {
        const centreX = sign * (CITY_WALL_OFFSET_M + column * CITY_CELL_M);
        const centreZ = (row - (CITY_ROWS - 1) / 2) * CITY_CELL_M;

        const width = TOWER_MIN_FOOTPRINT_M + random.nextInt(0, TOWER_FOOTPRINT_SPAN_M);
        const depth = TOWER_MIN_FOOTPRINT_M + random.nextInt(0, TOWER_FOOTPRINT_SPAN_M);

        // Large-scale skyline: fbm over the grid, remapped from [-1, 1] to [0, 1].
        const noiseX = Math.round((side * CITY_COLUMNS_PER_SIDE + column) * CITY_NOISE_STEP * FIXED_SCALE);
        const noiseZ = Math.round(row * CITY_NOISE_STEP * FIXED_SCALE);
        const skyline = clamp((fbm2D(math, noiseX, noiseZ, seed, CITY_NOISE_OCTAVES) / FIXED_SCALE + 1) / 2, 0, 1);
        const variation = random.nextInt(0, 1000) / 1000;
        const grade = skyline * TOWER_SKYLINE_WEIGHT + variation * (1 - TOWER_SKYLINE_WEIGHT);
        const height = clamp(
          TOWER_MIN_HEIGHT_M + grade * (TOWER_MAX_HEIGHT_M - TOWER_MIN_HEIGHT_M),
          TOWER_MIN_HEIGHT_M,
          TOWER_MAX_HEIGHT_M,
        );

        // The corridor must stay clear: push the slab out if its half-width would intrude.
        const minimumCentre = CHASM_BOUNDS.maxX + width / 2;
        const x = Math.abs(centreX) < minimumCentre ? sign * minimumCentre : centreX;

        towers.push({ x, z: centreZ, width, depth, height, tint: pickTint(random) });
      }
    }
  }

  if (towers.length > MAX_CITY_TOWERS) fail('SKYRIVER_CITY_TOWER_OVERFLOW');

  return { seed, cell: CITY_CELL_M, maxHeight: TOWER_MAX_HEIGHT_M, towers };
}

function pickTint(random: DeterministicRandom): number {
  const tint = random.weighted(TOWER_TINTS, TOWER_TINT_WEIGHTS);
  if (!Number.isInteger(tint) || tint < 0 || tint > 0xffffff) fail('SKYRIVER_CITY_TINT_INVALID');
  return tint;
}

/**
 * Derives per-car traffic parameters into typed arrays, one entry per car.
 *
 * Bands are assigned round-robin so every altitude layer is populated at any car count, which is what
 * makes the stacked free-flight layers read as layers. Traffic never feeds simulation, so T4 can
 * evaluate these at interpolated time (tick + renderAlpha) for smooth 60 Hz motion over a 30 Hz sim.
 */
export function deriveTrafficParams(seed: number, count: number): SkyriverTrafficParams {
  assertSeed(seed);
  if (!Number.isInteger(count) || count < 1 || count > TRAFFIC_MAX_CARS) {
    fail('SKYRIVER_TRAFFIC_COUNT_INVALID');
  }

  const random = new DeterministicRandom(seed).fork('skyriver.traffic');
  const band = new Uint8Array(count);
  const lane = new Float32Array(count);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const archetype = new Uint8Array(count);
  const altitude = new Float32Array(count);

  for (let car = 0; car < count; car += 1) {
    const carBand = car % TRAFFIC_BAND_COUNT;
    band[car] = carBand;
    // Even bands run one way, odd bands the other: counter-flowing streams, no road surfaces.
    const direction = carBand % 2 === 0 ? 1 : -1;
    lane[car] = random.nextInt(-1000, 1000) / 1000;
    speed[car] = direction * (TRAFFIC_MIN_SPEED_MPS + random.nextInt(0, TRAFFIC_SPEED_SPAN_MPS));
    phase[car] = random.nextInt(0, TRAFFIC_PHASE_STEPS - 1) / TRAFFIC_PHASE_STEPS;
    archetype[car] = random.nextInt(0, TRAFFIC_ARCHETYPE_COUNT - 1);
    const jitter = random.nextInt(-TRAFFIC_ALTITUDE_JITTER_M, TRAFFIC_ALTITUDE_JITTER_M);
    altitude[car] = clamp(
      TRAFFIC_MIN_ALTITUDE_M + carBand * TRAFFIC_BAND_SPACING_M + jitter,
      TRAFFIC_MIN_ALTITUDE_M,
      TRAFFIC_MAX_ALTITUDE_M,
    );
  }

  return { seed, count, band, lane, speed, phase, archetype, altitude };
}
