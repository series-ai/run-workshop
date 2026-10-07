/**
 * @file routeProfile.ts — the autopilot route through the winding canyon, in canyon space (T7-3).
 *
 * Pure functions of v (along-canyon arc length, wrapping every CANYON_LOOP_LENGTH_M). The city
 * (hero sign heights, clearances), the traffic (chase band) and the flight presentation all read the
 * same profile, so they can never disagree about where the route runs.
 *
 *   lateral(v)  — the route snakes across the corridor on top of the canyon's own S-curves, so the
 *                 sightline keeps rotating (two overlapping sines, max ~28 degrees off the axis).
 *   altitude(v) — one deep dive and one big climb per lap, through all three strata:
 *                 LOW GRIME (< ~600 m), MID CITY, HIGH PRISTINE (> ~1800 m).
 */
import { CANYON_LOOP_LENGTH_M } from './canyonWarp';

const L = CANYON_LOOP_LENGTH_M;
const TAU = Math.PI * 2;

/** Strata boundaries, metres. Shared with the facade and fog shaders (as literals there). */
export const STRATA_GRIME_TOP_M = 600;
export const STRATA_PRISTINE_BASE_M = 1800;

const LATERAL_A_M = 150;
const LATERAL_A_CYCLES = 5;
const LATERAL_B_M = 30;
const LATERAL_B_CYCLES = 11;

const ALTITUDE_MEAN_M = 1250;
const ALTITUDE_A_M = 900;
const ALTITUDE_B_M = 120;
const ALTITUDE_B_CYCLES = 4;
/** Phase so the lap starts mid-climb at ~1250 m through the free-flight stretch. */
const ALTITUDE_PHASE = 0;

/**
 * T7-5 grime pass: through the lap's low point the route swings out to hug the grime wall on the
 * outside of the canyon, ~150 m off its facade, so the parallax interiors show in actual play.
 */
export const GRIME_PASS_V_M = -0.25 * L;
const GRIME_PASS_SIDE = -1;
const GRIME_PASS_OFFSET_M = 255;
const GRIME_PASS_WIDTH_M = 1100;

function grimePass(v: number): number {
  let d = v - GRIME_PASS_V_M;
  d -= L * Math.round(d / L);
  return GRIME_PASS_SIDE * GRIME_PASS_OFFSET_M * Math.exp(-(d * d) / (GRIME_PASS_WIDTH_M * GRIME_PASS_WIDTH_M));
}


export function routeLateral(v: number): number {
  const p = (TAU * v) / L;
  const snake = LATERAL_A_M * Math.sin(p * LATERAL_A_CYCLES + 0.4) + LATERAL_B_M * Math.sin(p * LATERAL_B_CYCLES + 1.7);
  // The snake fades out through the grime pass so the hug is steady.
  let d = v - GRIME_PASS_V_M;
  d -= L * Math.round(d / L);
  const keep = 1 - 0.85 * Math.exp(-(d * d) / (GRIME_PASS_WIDTH_M * GRIME_PASS_WIDTH_M));
  return snake * keep + grimePass(v);
}

export function routeLateralSlope(v: number): number {
  const step = 2;
  return (routeLateral(v + step) - routeLateral(v - step)) / (2 * step);
}


export function routeAltitude(v: number): number {
  const p = (TAU * v) / L;
  return ALTITUDE_MEAN_M + ALTITUDE_A_M * Math.sin(p + ALTITUDE_PHASE) + ALTITUDE_B_M * Math.sin(p * ALTITUDE_B_CYCLES + 2.2);
}

export function routeAltitudeSlope(v: number): number {
  const p = (TAU * v) / L;
  const k = TAU / L;
  return ALTITUDE_A_M * k * Math.cos(p + ALTITUDE_PHASE) + ALTITUDE_B_M * ALTITUDE_B_CYCLES * k * Math.cos(p * ALTITUDE_B_CYCLES + 2.2);
}

/** Highest point the route reaches, metres (for clearances). */
export const ROUTE_MAX_ALTITUDE_M = ALTITUDE_MEAN_M + ALTITUDE_A_M + ALTITUDE_B_M;
export const ROUTE_MIN_ALTITUDE_M = ALTITUDE_MEAN_M - ALTITUDE_A_M - ALTITUDE_B_M;
