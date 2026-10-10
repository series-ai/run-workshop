/**
 * @file volumeFog.ts — R23's bounded opaque-ray absorption and local light scatter.
 *
 * One composer pass, two full-screen draws, no scene copy and no second depth blit:
 *   1. Integrate scatter RGB and transmittance alpha along depth-bounded world rays, fusing the
 *      previous static-camera history in the same draw. Reads one owned RGBA16F target, writes the
 *      other, then the owned pointers swap.
 *   2. Bilaterally upsample S and T from that history and write premultiplied (S, 1 - T) into the
 *      SAME composer readBuffer with ONE / ONE_MINUS_SRC_ALPHA. Fixed-function destination blending
 *      gives `C_out = S + T * C_opaque` without ever sampling scene colour, so there is no texture
 *      feedback and `needsSwap` stays false.
 *
 * The density field is the R22 field, not a new one. `skyriverVolumeDensity` is the TS twin of
 * `VOLUME_DENSITY_GLSL` and both are built from the same exported constants, so they cannot drift.
 * The legacy fog shader writes that profile as `smoothstep( 0.0, -900.0, height )`, whose edges are
 * reversed; GLSL leaves `edge0 >= edge1` undefined, so the marcher encodes the intended inverse
 * explicitly instead of relying on a driver computing `(x - e0) / (e1 - e0)`.
 *
 * Limits, stated here because they are easy to overclaim:
 *   - The R20 opaque depth is not a light shadow map. Local scatter is UNSHADOWED: a wall between a
 *     light and a sample does not block it.
 *   - Opaque absorption is marched, over the WHOLE ray to the surface, so the bounded range caps
 *     only sky and invalid-depth rays. The step count does not grow with the length, so a far ray
 *     carries a larger declared step error. Transparent draws keep their own-depth analytic
 *     attenuation, which is an approximation, not marched absorption.
 *   - A valid opaque depth snapshot is a PRECONDITION, not an optimisation. Without one the pass
 *     composes nothing and records the skip; the plan is what keeps a frame on the legacy analytic
 *     path instead.
 *   - The local light term is a bounded geometric proxy: a source's own emission times the share of
 *     the sphere its lit area subtends at the sample's world distance. It is not a photometric
 *     measurement and it has no orientation term.
 *   - History convergence is only established by measured static-camera evidence. The weight
 *     formula on its own proves nothing, and this module makes no moving-camera reprojection claim.
 *     There is no reprojection at all: the history resets on any camera matrix change, so in
 *     flight every frame is a fresh single-phase result at a new jitter stratum. Frozen-camera
 *     convergence therefore says NOTHING about temporal stability in motion — that needs its own
 *     moving-camera capture in the runtime gate, and this module must not be read as evidence for it.
 */
import * as THREE from 'three';
import { SKYRIVER_STRUCTURED_LIGHT_GLSL } from './structuredLight';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';

import {
  SKYRIVER_BLUE_NOISE_BYTES,
  SKYRIVER_BLUE_NOISE_HEIGHT,
  SKYRIVER_BLUE_NOISE_SHA256,
  SKYRIVER_BLUE_NOISE_WIDTH,
} from './blueNoiseTile';
import {
  SKYRIVER_LIGHT_ROLE_IMPORTANCE,
  SKYRIVER_RENDER_LIGHT_LIMIT,
  SKYRIVER_SCATTER_SPHERE_SR,
  type SkyriverMutableBeamRecord,
  type SkyriverSelectedLight,
} from './renderLightSet';
import type { SkyriverBeamView } from './atmosphere';
import type { SkyriverHeldHazeTint } from './districts';

// --- the R22 density field, as one definition --------------------------------------------------

/**
 * The actual R22 fog field constants (atmosphere.ts:67-83 and the `skyriverFogFactor` body). R23
 * reuses them; it does not introduce a second density.
 */
export const SKYRIVER_VOLUME_FIELD = Object.freeze({
  densityLow: 0.00078,
  densityHigh: 0.0001,
  floorY: 40,
  rangeY: 1900,
  /** `density *= 1.0 - 0.45 * deep`: the deep-void guard, so its floor multiplier is 0.55. */
  deepThinning: 0.45,
  /** The inverse smoothstep's far edge: `smoothstep( 0.0, -900.0, height )`. */
  deepEdgeY: -900,
  /** `density *= 1.0 + 0.45 * (1 - smoothstep(120, 600, h)) * (1 - deep)`: deck peak 1.45. */
  deckGain: 0.45,
  deckStartY: 120,
  deckEndY: 600,
});

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0 above the canyon floor band, 1 deep in the void below it. The defined inverse. */
export function skyriverVolumeDeepFactor(heightM: number): number {
  // The legacy shader spells this `smoothstep( 0.0, -900.0, h )`. Reversed edges are undefined in
  // GLSL, so the ratio is written out: `clamp( h / -900, 0, 1 )`, then the same cubic.
  const t = Math.min(1, Math.max(0, heightM / SKYRIVER_VOLUME_FIELD.deepEdgeY));
  return t * t * (3 - 2 * t);
}

/** The haze grading window: 0 at the floor, 1 at the clear end. */
export function skyriverVolumeGrade(heightM: number): number {
  const field = SKYRIVER_VOLUME_FIELD;
  const h = Math.min(1, Math.max(0, (heightM - field.floorY) / field.rangeY));
  return h * h * (3 - 2 * h);
}

/**
 * Density at a world height, m^-1. Finite and non-negative everywhere, including far below the void
 * edge and far above the towers.
 */
export function skyriverVolumeDensity(heightM: number): number {
  const field = SKYRIVER_VOLUME_FIELD;
  if (!Number.isFinite(heightM)) return field.densityLow;
  const grade = skyriverVolumeGrade(heightM);
  const deep = skyriverVolumeDeepFactor(heightM);
  let density = field.densityLow + (field.densityHigh - field.densityLow) * grade;
  density *= 1 - field.deepThinning * deep;
  density *= 1 + field.deckGain
    * (1 - smoothstep(field.deckStartY, field.deckEndY, heightM))
    * (1 - deep);
  return Math.max(0, density);
}

/**
 * The GLSL twin of `skyriverScatterResponse`, generated from the one exported sphere constant so
 * the marcher and the CPU rank cannot drift apart.
 *
 * `litAreaM2` arrives in the light's shape uniform in square metres and `distanceM` is world
 * metres, so the quotient is the same dimensionless proxy the rank uses. It is 1 at zero distance:
 * the local term can never exceed the source's own emission, whatever the source's luminance or
 * size. That bound is the whole correction — the first R23 build multiplied a flux scalar that
 * already contained the source luminance back into the source RGB, uploaded values up to 1585, and
 * rendered 97.77% exact white.
 *
 * The constant is written at full double precision so the define round-trips to the exported value
 * exactly and a test can compare the two forms without a tolerance. The GPU then rounds it to its
 * own float precision, which is a precision property of the hardware, not a drift between twins.
 */
export const SKYRIVER_SCATTER_RESPONSE_GLSL = /* glsl */ `
#define VOL_SCATTER_SPHERE_SR ${SKYRIVER_SCATTER_SPHERE_SR}

float scatterResponse( float litAreaM2, float distanceM ) {
  float area = max( litAreaM2, 0.0 );
  float denominator = area + VOL_SCATTER_SPHERE_SR * distanceM * distanceM;
  return denominator > 0.0 ? area / denominator : 0.0;
}
`;

/** The GLSL twin. Built from the same constants, so the two implementations cannot drift apart. */
export const SKYRIVER_VOLUME_DENSITY_GLSL = /* glsl */ `
#define VOL_DENSITY_LOW ${SKYRIVER_VOLUME_FIELD.densityLow.toExponential(6)}
#define VOL_DENSITY_HIGH ${SKYRIVER_VOLUME_FIELD.densityHigh.toExponential(6)}
#define VOL_FLOOR_Y ${SKYRIVER_VOLUME_FIELD.floorY.toFixed(1)}
#define VOL_RANGE_Y ${SKYRIVER_VOLUME_FIELD.rangeY.toFixed(1)}
#define VOL_DEEP_THINNING ${SKYRIVER_VOLUME_FIELD.deepThinning.toFixed(4)}
#define VOL_DEEP_EDGE_Y ${SKYRIVER_VOLUME_FIELD.deepEdgeY.toFixed(1)}
#define VOL_DECK_GAIN ${SKYRIVER_VOLUME_FIELD.deckGain.toFixed(4)}
#define VOL_DECK_START_Y ${SKYRIVER_VOLUME_FIELD.deckStartY.toFixed(1)}
#define VOL_DECK_END_Y ${SKYRIVER_VOLUME_FIELD.deckEndY.toFixed(1)}

float volumeGrade( float h ) {
  float t = clamp( ( h - VOL_FLOOR_Y ) / VOL_RANGE_Y, 0.0, 1.0 );
  return t * t * ( 3.0 - 2.0 * t );
}

// The legacy field writes this as smoothstep( 0.0, -900.0, h ). GLSL leaves edge0 >= edge1
// undefined, so the intended inverse ratio is written out and then smoothed by hand.
float volumeDeep( float h ) {
  float t = clamp( h / VOL_DEEP_EDGE_Y, 0.0, 1.0 );
  return t * t * ( 3.0 - 2.0 * t );
}

float volumeDensity( float h ) {
  float grade = volumeGrade( h );
  float deep = volumeDeep( h );
  float density = mix( VOL_DENSITY_LOW, VOL_DENSITY_HIGH, grade );
  density *= 1.0 - VOL_DEEP_THINNING * deep;
  density *= 1.0 + VOL_DECK_GAIN * ( 1.0 - smoothstep( VOL_DECK_START_Y, VOL_DECK_END_Y, h ) ) * ( 1.0 - deep );
  return max( density, 0.0 );
}
`;

// --- step integration, as one definition -------------------------------------------------------

export interface SkyriverVolumeIntegral {
  /** Scatter, linear. Zero whenever every source radiance along the ray is zero. */
  readonly scatter: readonly [number, number, number];
  /** Transmittance. 1 when the integrated density is zero, so composition is neutral. */
  readonly transmittance: number;
}

/**
 * The marcher's TS twin: the same recurrence the raymarch fragment shader runs.
 *
 * `deltaTau = density * stepLength; T *= exp(-deltaTau); S += T_before * (1 - exp(-deltaTau)) * L`.
 * Radiance is sampled at the jittered point inside each interval, exactly as the shader does.
 */
export function skyriverIntegrateVolume(options: {
  readonly steps: number;
  readonly rayLengthM: number;
  readonly jitter: number;
  readonly density: (distanceM: number) => number;
  readonly radiance: (distanceM: number) => readonly [number, number, number];
}): SkyriverVolumeIntegral {
  const { steps, rayLengthM, jitter, density, radiance } = options;
  const stepLength = rayLengthM / Math.max(1, steps);
  let transmittance = 1;
  const scatter: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < steps; i += 1) {
    const distance = (i + jitter) * stepLength;
    const deltaTau = Math.max(0, density(distance) * stepLength);
    const absorbed = 1 - Math.exp(-deltaTau);
    const emitted = radiance(distance);
    scatter[0] += transmittance * absorbed * emitted[0];
    scatter[1] += transmittance * absorbed * emitted[1];
    scatter[2] += transmittance * absorbed * emitted[2];
    transmittance *= Math.exp(-deltaTau);
  }
  return { scatter, transmittance };
}

/** The analytic answer for a constant density over a finite ray. The step error is measured against it. */
export function skyriverAnalyticTransmittance(density: number, rayLengthM: number): number {
  return Math.exp(-Math.max(0, density) * Math.max(0, rayLengthM));
}

// --- tier profiles ------------------------------------------------------------------------------

export type SkyriverVolumeProfileId = 'high' | 'medium' | 'off';

export interface SkyriverVolumeProfile {
  readonly id: SkyriverVolumeProfileId;
  /** Share of the physical drawing-buffer width and height. Half = a quarter of the pixel count. */
  readonly spatialScale: number;
  readonly steps: number;
  readonly clouds: number;
}

/**
 * The requested R23 profiles. High is half physical resolution at 8 steps with 200-400 clouds;
 * medium is quarter resolution at 6 steps with half the clouds; low has no volume and no clouds.
 * 12 steps are permitted at high only if the measured full-frame cost still fits the gate.
 */
export const SKYRIVER_VOLUME_PROFILES: Readonly<Record<SkyriverVolumeProfileId, SkyriverVolumeProfile>> =
  Object.freeze({
    high: Object.freeze({ id: 'high', spatialScale: 0.5, steps: 8, clouds: 260 }),
    medium: Object.freeze({ id: 'medium', spatialScale: 0.25, steps: 6, clouds: 130 }),
    off: Object.freeze({ id: 'off', spatialScale: 0.5, steps: 0, clouds: 0 }),
  });

export const SKYRIVER_VOLUME_HIGH_STEPS_MIN = 8;
export const SKYRIVER_VOLUME_HIGH_STEPS_MAX = 12;

/**
 * Integration stops here when the ray has NO surface to stop at: a clear-sky depth pixel, or a
 * frame with no valid opaque depth. It is not a cap on an opaque ray.
 *
 * An opaque pixel marches to its actual surface distance, however far that is (`skyriverVolumeRayLength`).
 * Capping an opaque ray here would leave the segment from 2.6 km to the surface attenuated by
 * nothing at all: the staged opaque stage bypasses the shared analytic haze AND the far card's
 * independent layer haze, so this march is the only absorption those pixels get. The canyon loop is
 * 12.8 km long and the far plane is 14 km, so distant towers and impostor cards really do sit past
 * this range — truncating there made them LESS attenuated than the R22 analytic path, which is the
 * opposite of "attenuated exactly once".
 */
export const SKYRIVER_VOLUME_RANGE_M = 2600;

/**
 * How far one ray marches, in metres. The TS twin of the marcher's own decision.
 *
 *  - A valid, non-sky depth marches to the real surface: `viewDepth / cosForward`, bounded only by
 *    the camera's own far plane along the same ray, because nothing beyond the surface is visible.
 *  - Clear sky and an invalid depth stop at `SKYRIVER_VOLUME_RANGE_M`. Those rays have no surface,
 *    so the bound is a declared cost limit rather than a physical end point.
 *
 * The step COUNT does not change with the length, so a far opaque ray carries a larger step error
 * than a near one. That is a measured, declared error (see the 6 km step-error test), and it is
 * strictly better than applying no absorption at all over the truncated segment.
 */
export function skyriverVolumeRayLength(options: {
  readonly depthValid: boolean;
  readonly isSky: boolean;
  readonly surfaceDistanceM: number;
  readonly farDistanceM: number;
}): number {
  const { depthValid, isSky, surfaceDistanceM, farDistanceM } = options;
  if (!depthValid || isSky) return SKYRIVER_VOLUME_RANGE_M;
  if (!Number.isFinite(surfaceDistanceM)) return SKYRIVER_VOLUME_RANGE_M;
  return Math.max(0, Math.min(surfaceDistanceM, farDistanceM));
}

/** History blend time constant, seconds: `newWeight = 1 - exp(-deltaS / 0.10)`. */
export const SKYRIVER_VOLUME_HISTORY_TAU_S = 0.1;
/** A frame longer than this is a pause, not motion: the history is dropped instead of smeared. */
export const SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S = 0.25;
/** Jitter strata. The reference averages all of them; a normal frame advances one per draw. */
export const SKYRIVER_VOLUME_JITTER_PHASES = 16;
/** The predeclared reference integrator: 128 steps x 16 fixed phases, history off. */
export const SKYRIVER_VOLUME_REFERENCE_STEPS = 128;

/**
 * The blend state the reference accumulation needs: ADD with ONE / ONE, for RGB **and** alpha.
 *
 * It is a SUM of 16 pre-scaled phases, so every factor must be one. `THREE.AdditiveBlending` is
 * not that: it is `SRC_ALPHA / ONE`, because `premultipliedAlpha` is false, and its alpha equation
 * is the same pair. Each phase's RGB was therefore multiplied by that phase's own scaled
 * transmittance, and the alpha channel — the transmittance itself — was multiplied by itself. A
 * constant-density GPU probe read reference transmittance 0.0371 where the marched and the
 * analytic answers were both 0.7711, so the reference could not support any convergence decision.
 *
 * Declared here as data, and applied from here, so a check can assert the factors the draws
 * actually ran with rather than a blending label.
 */
export const SKYRIVER_VOLUME_REFERENCE_BLEND = Object.freeze({
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendEquationAlpha: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
});

/** Why the history was dropped. A closed set so a check can match the exact cause. */
export type SkyriverVolumeHistoryReset =
  | 'first-frame'
  | 'camera'
  | 'projection'
  | 'resize'
  | 'profile'
  | 'steps'
  | 'composition-mode'
  | 'reference-mode'
  | 'frame-pause'
  | 'replay-seek'
  | 'resume'
  | 'district'
  | 'explicit';

export function skyriverVolumeHistoryWeight(deltaS: number): number {
  if (!(deltaS > 0)) return 1;
  if (deltaS >= SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S) return 1;
  return 1 - Math.exp(-deltaS / SKYRIVER_VOLUME_HISTORY_TAU_S);
}

/** Target dimension for a scale. Never zero, and an odd input stays valid. */
export function skyriverVolumeDimension(physical: number, scale: number): number {
  if (!Number.isFinite(physical) || !Number.isFinite(scale)) return 1;
  return Math.max(1, Math.floor(Math.max(0, physical) * Math.max(0, scale)));
}

// --- the district scatter profile ---------------------------------------------------------------

/**
 * What the marcher needs about the district air. `tintLinear` is the HELD R22 haze tint — the value
 * already bound in the shared fog uniform, refreshed at most once per second of simulated time —
 * read from `atmosphere.heldHazeTint()` and never re-sampled per frame. No second region map and no
 * world-to-canyon inverse is introduced.
 */
export interface SkyriverDistrictFogProfile {
  readonly id: string;
  readonly tintLinear: readonly [number, number, number];
  readonly scatterScale: number;
  readonly deckGlowLinear: readonly [number, number, number];
  readonly deckGlowHeightM: number;
}

/**
 * The deck's own scattered light, as the R22 fog colour already carries it:
 * `vec3( 0.0083, 0.0079, 0.0086 ) * exp( -max( h - 40, 0 ) / 220 ) * ( 1 - deep * 0.6 )`.
 *
 * This is the existing field's deck term, district-tinted — not the whole fog colour re-used as
 * scatter, and not a constant ambient floor.
 */
export const SKYRIVER_VOLUME_DECK_GLOW: readonly [number, number, number] = Object.freeze([0.0083, 0.0079, 0.0086]);
export const SKYRIVER_VOLUME_DECK_FALLOFF_M = 220;
export const SKYRIVER_VOLUME_DECK_BASE_Y = 40;

/** Neutral air: what the tests use where no R22 district profile is bound. */
export const SKYRIVER_NEUTRAL_FOG_PROFILE: SkyriverDistrictFogProfile = Object.freeze({
  id: 'neutral',
  tintLinear: Object.freeze([1, 1, 1]) as readonly [number, number, number],
  scatterScale: 1,
  deckGlowLinear: SKYRIVER_VOLUME_DECK_GLOW,
  deckGlowHeightM: SKYRIVER_VOLUME_DECK_BASE_Y,
});

/**
 * The profile for a held haze-tint record. Pure: data in, data out.
 *
 * Built only when the held record's `version` moves, so a normal frame reuses the previous object
 * and allocates nothing. The colour-off state is one id, not one id per district: with the district
 * colour off the tint is neutral, so the air is the same whatever district the route is crossing.
 */
export function skyriverDistrictFogProfileFrom(held: SkyriverHeldHazeTint): SkyriverDistrictFogProfile {
  return {
    id: held.districtAllowed ? `district:${held.districtId}` : 'district:colour-off',
    tintLinear: [held.tintLinear[0], held.tintLinear[1], held.tintLinear[2]],
    scatterScale: 1,
    // The deck's own scattered-light term, district-tinted by the line above.
    deckGlowLinear: SKYRIVER_VOLUME_DECK_GLOW,
    deckGlowHeightM: SKYRIVER_VOLUME_DECK_BASE_Y,
  };
}

/**
 * Converts local source radiance into scatter. One knob, so the look is tuned without touching the
 * field, the district colours or any source emission.
 */
export const SKYRIVER_VOLUME_SCATTER_GAIN = 0.55;

// --- the bilateral upsample policy, as one definition -------------------------------------------

/** Relative depth allowance for continuous far surfaces. The near floor stays 60 metres. */
export const SKYRIVER_VOLUME_DEPTH_RELATIVE_REJECTION = 0.12;

/** One marched volume sample: what a history texel holds. */
export interface SkyriverVolumeSample {
  readonly scatter: readonly [number, number, number];
  readonly transmittance: number;
}

/** The uv the marcher used for one volume texel: the texel's own centre, clamped to the target. */
export function skyriverVolumeTexelUv(
  texelX: number,
  texelY: number,
  width: number,
  height: number,
): readonly [number, number] {
  const x = Math.min(Math.max(texelX, 0), Math.max(0, width - 1));
  const y = Math.min(Math.max(texelY, 0), Math.max(0, height - 1));
  return [(x + 0.5) / Math.max(1, width), (y + 0.5) / Math.max(1, height)];
}

/** The R20 depth conversion, as the bilateral fragment and the marcher both spell it. */
function viewDepthFrom(depth01: number, near: number, far: number): number {
  return (near * far) / Math.max(far - depth01 * (far - near), 1e-6);
}

/** A tap's fate, for the evidence: which volume texel, and whether it was accepted. */
export interface SkyriverBilateralTap {
  readonly texelX: number;
  readonly texelY: number;
  readonly weight: number;
  readonly accepted: boolean;
  readonly depth01: number;
}

/**
 * The TS twin of `BILATERAL_FRAGMENT`: the 3x3 tap loop, its per-texel depth test, and the tent
 * weights.
 *
 * Two properties this encodes, and the reason both are here rather than only in GLSL:
 *
 *  - Every tap is ONE volume texel, fetched at that texel's centre. The history targets are
 *    nearest filtered, so nothing is mixed before the depth test. The earlier version offset the
 *    full-resolution uv by one volume texel, which lands between texel centres: a linear fetch
 *    then averaged up to four marched samples, and a single accepted tap could carry sky scatter
 *    across a wall edge. A GPU probe read 0.25 sky scatter in the last wall pixel, where the wall
 *    value was zero.
 *  - The depth each tap is tested against is the depth AT THAT TEXEL'S CENTRE — the same sample
 *    that ended that texel's ray — compared with this output pixel's own full-resolution depth.
 *    Sky against surface is rejected either way round, and a surface nearer or farther than
 *    `depthRejectM` is a different column of air.
 */
export function skyriverBilateralResolve(options: {
  /** The output pixel's uv, at full resolution. */
  readonly uv: readonly [number, number];
  readonly volumeWidth: number;
  readonly volumeHeight: number;
  readonly depthValid: boolean;
  /** The full-resolution opaque depth snapshot, sampled at an arbitrary uv. */
  readonly depth01: (u: number, v: number) => number;
  /**
   * The history fetch, as the fragment makes it: `texture2D( uHistory, tapUv )`.
   *
   * It takes a uv, not a texel index, because the FETCH is where the defect was. The tap uv is
   * what decides whether the hardware returns one marched sample or a mix of up to four.
   */
  readonly sample: (u: number, v: number) => SkyriverVolumeSample;
  readonly near: number;
  readonly far: number;
  readonly depthRejectM: number;
}): {
  readonly resolved: SkyriverVolumeSample;
  readonly taps: readonly SkyriverBilateralTap[];
  readonly acceptedWeight: number;
  readonly usedIdentityFallback: boolean;
} {
  const { uv, volumeWidth, volumeHeight, depthValid, depth01, sample, near, far, depthRejectM } = options;
  const centreDepth01 = depth01(uv[0], uv[1]);
  const centreSky = centreDepth01 >= 0.9999999;
  const centreDepth = viewDepthFrom(centreDepth01, near, far);
  const rejectDistance = Math.max(depthRejectM, centreDepth * SKYRIVER_VOLUME_DEPTH_RELATIVE_REJECTION);
  const centreTexelX = Math.floor(uv[0] * volumeWidth);
  const centreTexelY = Math.floor(uv[1] * volumeHeight);

  const taps: SkyriverBilateralTap[] = [];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumA = 0;
  let weightSum = 0;
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      const texelX = Math.min(Math.max(centreTexelX + x, 0), Math.max(0, volumeWidth - 1));
      const texelY = Math.min(Math.max(centreTexelY + y, 0), Math.max(0, volumeHeight - 1));
      const [u, v] = skyriverVolumeTexelUv(texelX, texelY, volumeWidth, volumeHeight);
      const weight = x === 0 && y === 0 ? 4 : x === 0 || y === 0 ? 2 : 1;
      const tapDepth01 = depth01(u, v);
      let accepted = true;
      if (depthValid) {
        const tapSky = tapDepth01 >= 0.9999999;
        if (tapSky !== centreSky) accepted = false;
        else if (!centreSky
          && Math.abs(viewDepthFrom(tapDepth01, near, far) - centreDepth) > rejectDistance) accepted = false;
      }
      taps.push({ texelX, texelY, weight, accepted, depth01: tapDepth01 });
      if (!accepted) continue;
      const tap = sample(u, v);
      sumR += tap.scatter[0] * weight;
      sumG += tap.scatter[1] * weight;
      sumB += tap.scatter[2] * weight;
      sumA += tap.transmittance * weight;
      weightSum += weight;
    }
  }

  if (weightSum > 0) {
    return {
      resolved: {
        scatter: [sumR / weightSum, sumG / weightSum, sumB / weightSum],
        transmittance: sumA / weightSum,
      },
      taps,
      acceptedWeight: weightSum,
      usedIdentityFallback: false,
    };
  }
  // No sample ends on this surface. Preserve the opaque pixel without foreign fog.
  return {
    resolved: { scatter: [0, 0, 0], transmittance: 1 },
    taps,
    acceptedWeight: 0,
    usedIdentityFallback: true,
  };
}

// --- the per-invocation composition record ------------------------------------------------------

/** A composition target's identity, exactly as the pass bound it. `null` is the canvas. */
export interface SkyriverVolumeTargetRecord {
  readonly colourUuid: string | null;
  readonly depthUuid: string | null;
  readonly width: number;
  readonly height: number;
}

/**
 * What ONE volume invocation did, recorded inside that invocation.
 *
 * `before` and `after` are the composition target — the composer readBuffer, or the canvas — read
 * at the start of the invocation and again after its last draw, so the pair comes from the same
 * render call. Nothing here is inferred from the composer's buffers after the chain has finished
 * swapping them: by then `readBuffer` is whatever the passes downstream left behind.
 *
 * `marchedDepthUuid` is the depth texture the marcher SAMPLED: the opaque depth COPY the snapshot
 * owns, not the attachment. `before.depthUuid`/`after.depthUuid` are that original attachment.
 * Identity equality is reported; it is not on its own proof that the depth content survived, which
 * is what the packed-readback hash pair is for.
 */
export interface SkyriverVolumeInvocationRecord {
  readonly invocation: number;
  readonly renderToScreen: boolean;
  readonly faulted: boolean;
  readonly before: SkyriverVolumeTargetRecord;
  readonly after: SkyriverVolumeTargetRecord;
  readonly marchedDepthUuid: string | null;
  readonly marchedDepthIsCopy: boolean;
  readonly depthValid: boolean;
  /**
   * False when the invocation drew NOTHING because no valid opaque depth existed, with the reason
   * named. A skipped invocation composes nothing at all: it never marches through walls.
   */
  readonly composed: boolean;
  readonly skipReason: 'no-valid-opaque-depth' | null;
  readonly autoClearBefore: boolean;
  readonly autoClearAfter: boolean;
}

type MutableTargetRecord = {
  colourUuid: string | null;
  depthUuid: string | null;
  width: number;
  height: number;
};

function mutableTargetRecord(): MutableTargetRecord {
  return { colourUuid: null, depthUuid: null, width: 0, height: 0 };
}

/** Writes a target's identity into `out`. Allocation-free: this runs on the frame path. */
function writeTargetRecord(out: MutableTargetRecord, target: THREE.WebGLRenderTarget | null): void {
  out.colourUuid = target === null ? null : target.texture.uuid;
  out.depthUuid = target?.depthTexture?.uuid ?? null;
  out.width = target === null ? 0 : target.width;
  out.height = target === null ? 0 : target.height;
}

function frozenTargetRecord(record: MutableTargetRecord): SkyriverVolumeTargetRecord {
  return Object.freeze({
    colourUuid: record.colourUuid,
    depthUuid: record.depthUuid,
    width: record.width,
    height: record.height,
  });
}

// --- shaders ------------------------------------------------------------------------------------

const VOLUME_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const RAYMARCH_FRAGMENT = /* glsl */ `
precision highp float;

#define LIGHT_LIMIT ${SKYRIVER_RENDER_LIGHT_LIMIT}
#define JITTER_PHASES ${SKYRIVER_VOLUME_JITTER_PHASES.toFixed(1)}
#define DECK_FALLOFF_M ${SKYRIVER_VOLUME_DECK_FALLOFF_M.toFixed(1)}
#define DECK_BASE_Y ${SKYRIVER_VOLUME_DECK_BASE_Y.toFixed(1)}
// VOL_MAX_STEPS is a define, not a constant here: the normal shader is bounded by the highest
// step count a normal frame can take (12), and reference mode recompiles with 128. A driver may
// fully unroll a constant-bounded loop, so a normal frame must not carry the reference's bound.
#ifndef VOL_MAX_STEPS
  #define VOL_MAX_STEPS ${SKYRIVER_VOLUME_HIGH_STEPS_MAX}
#endif

varying vec2 vUv;

uniform sampler2D uDepth;
uniform sampler2D uHistory;
uniform sampler2D uNoise;
uniform vec2 uNoiseSize;
uniform float uDepthValid;
uniform vec2 uCameraRange;        // near, far
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorld;
uniform vec3 uCameraPosition;
uniform vec2 uResolution;
uniform float uSteps;
uniform float uVolumeRangeM;
uniform float uHistoryWeight;
uniform float uHistoryValid;
uniform float uJitterPhase;
uniform float uReferenceScale;
uniform vec3 uDistrictTint;
uniform float uScatterScale;
uniform vec3 uDeckGlow;
uniform float uDeckGlowHeightM;
uniform float uScatterGain;
uniform int uLightCount;
uniform vec4 uLightPosition[ LIGHT_LIMIT ];   // xyz world, w kind: 0 sign/area, 1 cone, 2 station
uniform vec4 uLightAxis[ LIGHT_LIMIT ];       // xyz axis, w half length (area) or length (cone)
uniform vec4 uLightColor[ LIGHT_LIMIT ];      // rgb the source's own linear emission, a selection weight
uniform vec4 uLightShape[ LIGHT_LIMIT ];      // area: x lit area m^2, y scatter radius m. cone: x widthStart, y widthEnd, z softness, w fadeStart

${SKYRIVER_VOLUME_DENSITY_GLSL}
${SKYRIVER_SCATTER_RESPONSE_GLSL}
${SKYRIVER_STRUCTURED_LIGHT_GLSL}

float linearViewDepth( float depth01 ) {
  float nearPlane = uCameraRange.x;
  float farPlane = uCameraRange.y;
  return nearPlane * farPlane / max( farPlane - depth01 * ( farPlane - nearPlane ), 1e-6 );
}

vec3 localRadiance( vec3 world ) {
  vec3 sum = vec3( 0.0 );
  for ( int i = 0; i < LIGHT_LIMIT; i ++ ) {
    if ( i >= uLightCount ) break;
    vec4 positionKind = uLightPosition[ i ];
    vec4 axisLength = uLightAxis[ i ];
    vec4 colorWeight = uLightColor[ i ];
    vec4 shape = uLightShape[ i ];
    vec3 toPoint = world - positionKind.xyz;
    float kind = positionKind.w;

    if ( kind > 0.5 && kind < 1.5 ) {
      // Cone: the drawn beam's own response, from BEAM_FRAGMENT. radial = exp( -s*s*softness )
      // with s = 2r/width, and along = smoothstep(0,0.14,t) * (1 - smoothstep(fadeStart,1,t)).
      float lengthM = max( axisLength.w, 1.0 );
      float along = dot( toPoint, axisLength.xyz );
      float t = along / lengthM;
      if ( t < 0.0 || t > 1.0 ) continue;
      vec3 radialVec = toPoint - axisLength.xyz * along;
      float r = length( radialVec );
      float width = mix( shape.x, shape.y, t );
      float s = 2.0 * r / max( width, 1e-3 );
      float radial = exp( - s * s * shape.z );
      float alongFade = smoothstep( 0.0, 0.14, t ) * ( 1.0 - smoothstep( shape.w, 1.0, t ) );
      sum += colorWeight.rgb * ( radial * alongFade * colorWeight.a );
      continue;
    }

    float litAreaM2 = shape.x;
    float distanceM;
    if ( kind > 1.5 ) {
      distanceM = length( toPoint );
    } else {
      // A sign or a large trim is a short line light: clamp to its own drawn half length.
      // 'half' is a reserved word in GLSL ES 1.00, so the extent is named in full.
      float halfExtent = max( axisLength.w, 0.0 );
      float along = clamp( dot( toPoint, axisLength.xyz ), - halfExtent, halfExtent );
      distanceM = length( toPoint - axisLength.xyz * along );
    }
    // The source's own emission, once, times the bounded area/solid-angle proxy and the cutoff
    // weight. No source luminance and no source area multiplies the colour here.
    sum += colorWeight.rgb * ( scatterResponse( litAreaM2, distanceM ) * localLightRange( distanceM )
      * lightBreakup( world, dot( positionKind.xyz, vec3( 0.011, 0.017, 0.023 ) ) ) * colorWeight.a );
  }

  // The deck's own scattered light, as the R22 fog colour already carries it, district-tinted.
  float deck = exp( - max( world.y - uDeckGlowHeightM, 0.0 ) / DECK_FALLOFF_M )
    * ( 1.0 - volumeDeep( world.y ) * 0.6 );
  sum += uDeckGlow * deck;

  return sum * uDistrictTint * ( uScatterGain * uScatterScale );
}

void main() {
  // One world ray per volume pixel, from the inverse projection and the camera's world matrix.
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 viewPoint = uProjectionInverse * vec4( ndc, -1.0, 1.0 );
  vec3 viewDir = viewPoint.xyz / max( viewPoint.w, 1e-6 );
  // Normalised view-space direction, and the z component that converts view depth to ray distance.
  float viewLength = max( length( viewDir ), 1e-6 );
  vec3 viewUnit = viewDir / viewLength;
  // -z is forward in view space; an oblique ray travels 1/|cos| further per metre of view depth.
  float cosForward = max( - viewUnit.z, 1e-4 );
  vec3 worldDir = normalize( ( uCameraWorld * vec4( viewUnit, 0.0 ) ).xyz );

  // uDepthValid is 0 only on a path that composes nothing: the pass returns before any draw when
  // no valid opaque depth exists, and the plan runs the legacy analytic frame instead. The branch
  // below stays as this shader's own defence, not as a frame the chain can silently present.
  float depth01 = texture2D( uDepth, vUv ).r;
  bool sky = depth01 >= 0.9999999;
  bool opaqueHit = uDepthValid > 0.5 && ! sky;
  // A valid opaque depth marches to the ACTUAL surface. The bounded range is a SKY and
  // invalid-depth limit, not a cap on an opaque ray: the staged opaque stage bypasses the shared
  // analytic haze and the far card's layer haze, so this ray is the only absorption the pixel
  // gets, and stopping it short of the surface would leave the rest of the air doing nothing.
  // Only the camera's own far plane bounds it, measured along the same oblique ray.
  float rayLength = opaqueHit
    ? min( linearViewDepth( depth01 ) / cosForward, uCameraRange.y / cosForward )
    : uVolumeRangeM;
  rayLength = max( rayLength, 0.0 );

  float steps = clamp( uSteps, 1.0, float( VOL_MAX_STEPS ) );
  float stepLength = rayLength / steps;

  // Blue-noise spatial jitter, byte-centred, offset by this frame's stratum.
  vec2 noiseUv = ( floor( vUv * uResolution ) + 0.5 ) / uNoiseSize;
  float tile = texture2D( uNoise, noiseUv ).r;
  float jitter = fract( tile * ( 255.0 / 256.0 ) + ( 0.5 / 256.0 ) + uJitterPhase / JITTER_PHASES );

  vec3 scatter = vec3( 0.0 );
  float transmittance = 1.0;
  for ( int i = 0; i < VOL_MAX_STEPS; i ++ ) {
    if ( float( i ) >= steps ) break;
    float distanceM = ( float( i ) + jitter ) * stepLength;
    vec3 world = uCameraPosition + worldDir * distanceM;
    float deltaTau = max( volumeDensity( world.y ) * stepLength, 0.0 );
    float absorbed = 1.0 - exp( - deltaTau );
    scatter += transmittance * absorbed * localRadiance( world );
    transmittance *= exp( - deltaTau );
  }
  scatter = max( scatter, vec3( 0.0 ) );
  transmittance = clamp( transmittance, 0.0, 1.0 );

  // Fuse the static-camera history in this same draw: no extra pass, no extra copy.
  vec4 previous = texture2D( uHistory, vUv );
  float weight = uHistoryValid > 0.5 ? clamp( uHistoryWeight, 0.0, 1.0 ) : 1.0;
  vec3 blendedScatter = mix( previous.rgb, scatter, weight );
  float blendedTransmittance = mix( previous.a, transmittance, weight );

  gl_FragColor = vec4( blendedScatter, blendedTransmittance ) * uReferenceScale;
}
`;

const BILATERAL_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uHistory;
uniform sampler2D uDepth;
uniform float uDepthValid;
uniform vec2 uCameraRange;
/** The volume target's size in texels. The tap grid is built from it, not from a texel offset. */
uniform vec2 uVolumeSize;
/** Metres of view-depth difference at which a tap is rejected as a different surface. */
uniform float uDepthRejectM;

float linearViewDepth( float depth01 ) {
  float nearPlane = uCameraRange.x;
  float farPlane = uCameraRange.y;
  return nearPlane * farPlane / max( farPlane - depth01 * ( farPlane - nearPlane ), 1e-6 );
}

/**
 * The uv the RAYMARCH used for one volume texel: that texel's own centre.
 *
 * The marcher draws at volume resolution, so its vUv at that texel is exactly this value, and the
 * depth sample that ended that texel's ray is exactly texture2D( uDepth, thisUv ). Fetching the
 * tap and its depth at the same uv is what makes the rejection test apply to the sample it rejects.
 */
vec2 volumeTexelUv( vec2 texel ) {
  return ( clamp( texel, vec2( 0.0 ), uVolumeSize - 1.0 ) + 0.5 ) / uVolumeSize;
}

void main() {
  // Endpoint depth comes from the separate R20 snapshot, never from the transmittance channel.
  // The centre reference is this OUTPUT pixel's own depth, at full resolution: the silhouette being
  // preserved is the one in the frame, not the one in the quarter-size volume.
  float centreDepth01 = texture2D( uDepth, vUv ).r;
  bool centreSky = centreDepth01 >= 0.9999999;
  float centreDepth = linearViewDepth( centreDepth01 );
  float rejectDistance = max( uDepthRejectM, centreDepth * ${SKYRIVER_VOLUME_DEPTH_RELATIVE_REJECTION} );

  // The volume texel this output pixel falls in, and its eight neighbours. Every tap is fetched AT
  // A TEXEL CENTRE, so no tap is a mix of several volume texels: the history targets are nearest
  // filtered and the uv is the texel's own centre, so one tap is one marched sample. Mixing
  // neighbours BEFORE the depth test is what let sky scatter cross a wall edge through an accepted
  // tap — a probe read 0.25 sky scatter in the last wall pixel, where the wall value was zero.
  vec2 centreTexel = floor( vUv * uVolumeSize );

  vec4 sum = vec4( 0.0 );
  float weightSum = 0.0;
  for ( int y = -1; y <= 1; y ++ ) {
    for ( int x = -1; x <= 1; x ++ ) {
      vec2 tapUv = volumeTexelUv( centreTexel + vec2( float( x ), float( y ) ) );
      float weight = ( x == 0 && y == 0 ) ? 4.0 : ( ( x == 0 || y == 0 ) ? 2.0 : 1.0 );
      if ( uDepthValid > 0.5 ) {
        // That texel's OWN endpoint depth, from the same footprint its ray used.
        float tapDepth01 = texture2D( uDepth, tapUv ).r;
        bool tapSky = tapDepth01 >= 0.9999999;
        // Sky against surface is always a different volume of air, whichever side is which.
        if ( tapSky != centreSky ) continue;
        // Near and far surfaces: a tap nearer or farther than the reject distance stopped at
        // another surface, so its scatter and transmittance belong to another column of air.
        if ( ! centreSky && abs( linearViewDepth( tapDepth01 ) - centreDepth ) > rejectDistance ) continue;
      }
      sum += texture2D( uHistory, tapUv ) * weight;
      weightSum += weight;
    }
  }
  // Reject all samples when none ends on this surface. Identity leaves the opaque pixel intact.
  vec4 resolved = weightSum > 0.0 ? sum / weightSum : vec4( 0.0, 0.0, 0.0, 1.0 );

  vec3 scatter = max( resolved.rgb, vec3( 0.0 ) );
  float transmittance = clamp( resolved.a, 0.0, 1.0 );
  // Premultiplied over: ONE / ONE_MINUS_SRC_ALPHA gives C_out = S + T * C_opaque.
  gl_FragColor = vec4( scatter, 1.0 - transmittance );
}
`;

// --- the pass -----------------------------------------------------------------------------------

export interface SkyriverVolumeFogOptions {
  readonly camera: THREE.PerspectiveCamera;
  /** Supplies the completed opaque depth snapshot. R23 captures it explicitly after the opaque stage. */
  readonly depthTexture: () => THREE.Texture | null;
  readonly depthValid: () => boolean;
  readonly beamView: () => SkyriverBeamView;
  /**
   * Diagnostic hook, called INSIDE this invocation right after the last composing draw.
   *
   * It exists so the "did the volume blend leave the depth attachment alone?" procedure can
   * actually be run: the before/after hash pair has to be packed at two points inside one frame,
   * and no between-frames API can reach the moment between the opaque stage and this one. Null by
   * default, so a normal frame costs one null check and draws nothing extra.
   */
  readonly onComposed?: () => void;
}

export interface SkyriverVolumeFogStats {
  readonly enabled: boolean;
  readonly profile: SkyriverVolumeProfileId;
  readonly steps: number;
  readonly spatialScale: number;
  readonly volumeSize: { readonly width: number; readonly height: number };
  readonly physicalSize: { readonly width: number; readonly height: number };
  readonly rangeM: number;
  readonly depthValid: boolean;
  readonly selectedCount: number;
  readonly historyValid: boolean;
  readonly historyWeight: number;
  readonly historyResets: number;
  readonly lastHistoryReset: SkyriverVolumeHistoryReset | null;
  readonly lastWallDeltaS: number;
  readonly jitterPhase: number;
  readonly referenceMode: boolean;
  readonly referencePhasesCompleted: number;
  readonly referenceSteps: number;
  readonly noiseSha256: string;
  readonly noiseUploaded: boolean;
  readonly densityLow: number;
  readonly densityHigh: number;
  readonly deckPeakMultiplier: number;
  readonly deepFloorMultiplier: number;
  readonly scatterGain: number;
  readonly districtId: string;
  readonly districtTint: readonly [number, number, number];
  readonly normalDraws: number;
  readonly probeDraws: number;
  /** Invocations that composed nothing because no valid opaque depth existed. */
  readonly depthSkips: number;
}

export class SkyriverVolumeFogPass extends Pass {
  /** Two owned RGBA16F history targets. Only these pointers ever swap. */
  private historyRead: THREE.WebGLRenderTarget;
  private historyWrite: THREE.WebGLRenderTarget;
  /** Diagnostic only: the 128 x 16 reference accumulation. Never part of a normal frame. */
  private referenceTarget: THREE.WebGLRenderTarget | null = null;

  private readonly raymarchMaterial: THREE.ShaderMaterial;
  private readonly bilateralMaterial: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly noiseTexture: THREE.DataTexture;

  private readonly lightPosition: THREE.Vector4[] = [];
  private readonly lightAxis: THREE.Vector4[] = [];
  private readonly lightColor: THREE.Vector4[] = [];
  private readonly lightShape: THREE.Vector4[] = [];
  private readonly beamScratch: SkyriverMutableBeamRecord = {
    slot: 0,
    start: [0, 0, 0],
    axis: [0, 1, 0],
    lengthM: 1,
    widthStartM: 1,
    widthEndM: 1,
    colorLinear: [0, 0, 0],
    seed: 0,
    intensity: 0,
    softness: 1,
    fadeStart: 0.5,
  };

  private profile: SkyriverVolumeProfile = SKYRIVER_VOLUME_PROFILES.high;
  private steps = SKYRIVER_VOLUME_HIGH_STEPS_MIN;
  private physicalWidth = 1;
  private physicalHeight = 1;
  private volumeWidth = 1;
  private volumeHeight = 1;
  private historyValid = false;
  private historyResets = 0;
  private lastHistoryReset: SkyriverVolumeHistoryReset | null = null;
  private lastWallDeltaS = 0;
  private jitterPhase = 0;
  private referenceMode = false;
  private referencePhasesCompleted = 0;
  private noiseUploaded = false;
  private selectedCount = 0;
  private districtId = SKYRIVER_NEUTRAL_FOG_PROFILE.id;
  private probeDraws = 0;
  /** The composition record for the last invocation. Mutated in place, so a frame allocates nothing. */
  private readonly targetBefore = mutableTargetRecord();
  private readonly targetAfter = mutableTargetRecord();
  private invocationCount = 0;
  private invocationFaulted = false;
  private invocationRenderToScreen = false;
  private autoClearBefore = true;
  private autoClearAfter = true;
  private marchedDepthUuid: string | null = null;
  private marchedDepthValid = false;
  /** Invocations that drew nothing because no valid opaque depth existed. See `render`. */
  private depthSkips = 0;
  private skippedForDepth = false;
  private readonly cameraMatrix = new THREE.Matrix4();
  private readonly projectionMatrix = new THREE.Matrix4();
  private cameraTracked = false;

  constructor(private readonly options: SkyriverVolumeFogOptions) {
    super();
    // Two draws only, and both write where they are told: the composer must not swap for this pass.
    this.needsSwap = false;

    this.noiseTexture = new THREE.DataTexture(
      SKYRIVER_BLUE_NOISE_BYTES,
      SKYRIVER_BLUE_NOISE_WIDTH,
      SKYRIVER_BLUE_NOISE_HEIGHT,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    this.noiseTexture.name = 'skyriver.volume.blueNoise';
    this.noiseTexture.colorSpace = THREE.NoColorSpace;
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    this.noiseTexture.minFilter = THREE.NearestFilter;
    this.noiseTexture.magFilter = THREE.NearestFilter;
    this.noiseTexture.generateMipmaps = false;
    this.noiseTexture.flipY = false;
    this.noiseTexture.unpackAlignment = 1;
    this.noiseTexture.needsUpdate = true;

    for (let i = 0; i < SKYRIVER_RENDER_LIGHT_LIMIT; i += 1) {
      this.lightPosition.push(new THREE.Vector4(0, 0, 0, 0));
      this.lightAxis.push(new THREE.Vector4(0, 1, 0, 0));
      this.lightColor.push(new THREE.Vector4(0, 0, 0, 0));
      this.lightShape.push(new THREE.Vector4(1, 1, 1, 0.5));
    }

    this.historyRead = this.createHistoryTarget('a');
    this.historyWrite = this.createHistoryTarget('b');

    this.raymarchMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.volume.raymarch',
      vertexShader: VOLUME_VERTEX,
      fragmentShader: RAYMARCH_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      defines: { VOL_MAX_STEPS: SKYRIVER_VOLUME_HIGH_STEPS_MAX },
      uniforms: {
        uDepth: { value: null },
        uHistory: { value: null },
        uNoise: { value: this.noiseTexture },
        uNoiseSize: { value: new THREE.Vector2(SKYRIVER_BLUE_NOISE_WIDTH, SKYRIVER_BLUE_NOISE_HEIGHT) },
        uDepthValid: { value: 0 },
        uCameraRange: { value: new THREE.Vector2(1, 14000) },
        uProjectionInverse: { value: new THREE.Matrix4() },
        uCameraWorld: { value: new THREE.Matrix4() },
        uCameraPosition: { value: new THREE.Vector3() },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uSteps: { value: this.steps },
        uVolumeRangeM: { value: SKYRIVER_VOLUME_RANGE_M },
        uHistoryWeight: { value: 1 },
        uHistoryValid: { value: 0 },
        uJitterPhase: { value: 0 },
        uReferenceScale: { value: 1 },
        uDistrictTint: { value: new THREE.Vector3(1, 1, 1) },
        uScatterScale: { value: 1 },
        uDeckGlow: { value: new THREE.Vector3(...SKYRIVER_VOLUME_DECK_GLOW) },
        uDeckGlowHeightM: { value: SKYRIVER_VOLUME_DECK_BASE_Y },
        uScatterGain: { value: SKYRIVER_VOLUME_SCATTER_GAIN },
        uLightCount: { value: 0 },
        uLightPosition: { value: this.lightPosition },
        uLightAxis: { value: this.lightAxis },
        uLightColor: { value: this.lightColor },
        uLightShape: { value: this.lightShape },
      },
    });

    this.bilateralMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.volume.bilateral',
      vertexShader: VOLUME_VERTEX,
      fragmentShader: BILATERAL_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      // Premultiplied over, into the same composer readBuffer: C_out = S + T * C_opaque.
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
      uniforms: {
        uHistory: { value: null },
        uDepth: { value: null },
        uDepthValid: { value: 0 },
        uCameraRange: { value: new THREE.Vector2(1, 14000) },
        uVolumeSize: { value: new THREE.Vector2(1, 1) },
        uDepthRejectM: { value: 60 },
      },
    });

    this.quad = new FullScreenQuad(this.raymarchMaterial);
  }

  private createHistoryTarget(
    label: string, type: THREE.TextureDataType = THREE.HalfFloatType,
  ): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      // NEAREST, on purpose. Both readers sample this target at exact texel centres — the
      // marcher at its own vUv, the bilateral upsampler at the centre of each tap — so a linear
      // filter would only add a chance of mixing neighbouring marched samples. Mixing them before
      // the bilateral depth test is what let scatter cross a wall silhouette.
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
    });
    target.texture.name = `skyriver.volume.history.${label}`;
    target.texture.colorSpace = THREE.NoColorSpace;
    return target;
  }

  /**
   * Binds the tier profile and the step count to run.
   *
   * `steps` is REQUIRED, with no default. The caller is the composition plan, which has already
   * resolved the tuning override, and a default here would let `setProfile(profile)` quietly put
   * the profile's own count back — which is exactly how a bloom A/B came to reset a requested 12
   * steps to 8 while a measurement recorded 12.
   */
  setProfile(profile: SkyriverVolumeProfile, steps: number): void {
    const clamped = profile.id === 'high'
      ? Math.min(SKYRIVER_VOLUME_HIGH_STEPS_MAX, Math.max(SKYRIVER_VOLUME_HIGH_STEPS_MIN, Math.round(steps)))
      : Math.max(1, Math.round(steps));
    const profileChanged = profile.id !== this.profile.id || profile.spatialScale !== this.profile.spatialScale;
    const stepsChanged = clamped !== this.steps;
    this.profile = profile;
    this.steps = clamped;
    if (profileChanged) {
      this.resizeVolume();
      this.resetHistory('profile');
    } else if (stepsChanged) {
      this.resetHistory('steps');
    }
  }

  currentProfile(): SkyriverVolumeProfile {
    return this.profile;
  }

  currentSteps(): number {
    return this.steps;
  }

  /** Physical drawing-buffer size. The volume target is a share of it, clamped to one pixel. */
  setSize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (nextWidth === this.physicalWidth && nextHeight === this.physicalHeight) return;
    this.physicalWidth = nextWidth;
    this.physicalHeight = nextHeight;
    this.resizeVolume();
    this.resetHistory('resize');
  }

  private resizeVolume(): void {
    this.volumeWidth = skyriverVolumeDimension(this.physicalWidth, this.profile.spatialScale);
    this.volumeHeight = skyriverVolumeDimension(this.physicalHeight, this.profile.spatialScale);
    this.historyRead.setSize(this.volumeWidth, this.volumeHeight);
    this.historyWrite.setSize(this.volumeWidth, this.volumeHeight);
    this.referenceTarget?.setSize(this.volumeWidth, this.volumeHeight);
    (this.raymarchMaterial.uniforms.uResolution!.value as THREE.Vector2).set(this.volumeWidth, this.volumeHeight);
    (this.bilateralMaterial.uniforms.uVolumeSize!.value as THREE.Vector2)
      .set(this.volumeWidth, this.volumeHeight);
  }

  resetHistory(reason: SkyriverVolumeHistoryReset): void {
    this.historyValid = false;
    this.historyResets += 1;
    this.lastHistoryReset = reason;
  }

  /** Diagnostic reference integrator. Its draws are probes: untimed and outside the normal count. */
  setReferenceMode(enabled: boolean): void {
    if (enabled === this.referenceMode) return;
    this.referenceMode = enabled;
    this.referencePhasesCompleted = 0;
    // One recompile, on a diagnostic control. The normal shader keeps the 12-step bound.
    this.raymarchMaterial.defines.VOL_MAX_STEPS = enabled
      ? SKYRIVER_VOLUME_REFERENCE_STEPS
      : SKYRIVER_VOLUME_HIGH_STEPS_MAX;
    this.raymarchMaterial.needsUpdate = true;
    if (enabled && this.referenceTarget === null) {
      this.referenceTarget = this.createHistoryTarget('reference', THREE.FloatType);
      this.referenceTarget.setSize(this.volumeWidth, this.volumeHeight);
    }
    this.resetHistory('reference-mode');
  }

  isReferenceMode(): boolean {
    return this.referenceMode;
  }

  /**
   * Writes this frame's source state. Call once, before the composer stages.
   *
   * `wallDeltaS` is the UNCLAMPED wall-clock delta between presented frames, not source time and
   * not the frame pump's integration delta. The history weight and the pause reset are both
   * wall-clock filters, and the pump clamps its own dt to 1/15 s so a backgrounded WebView cannot
   * produce one giant integration step. Handing the pass that clamped value made both the
   * `frame-pause` reset and the weight-1 branch unreachable in the app: a 4-second tab switch
   * arrived as 0.067 s and the stale history was smeared in instead of dropped.
   *
   * The camera and projection matrices are compared against the tracked pair, so any movement
   * resets history without the caller having to notice it.
   */
  update(options: {
    readonly wallDeltaS: number;
    readonly selected: readonly SkyriverSelectedLight[];
    readonly district: SkyriverDistrictFogProfile;
    readonly districtColourAllowed: boolean;
  }): void {
    const { wallDeltaS: deltaS, selected, district, districtColourAllowed } = options;
    const camera = this.options.camera;
    const uniforms = this.raymarchMaterial.uniforms;

    camera.updateMatrixWorld();
    if (!this.cameraTracked) {
      this.cameraTracked = true;
      this.cameraMatrix.copy(camera.matrixWorld);
      this.projectionMatrix.copy(camera.projectionMatrix);
      this.resetHistory('first-frame');
    } else {
      if (!matricesEqual(this.cameraMatrix, camera.matrixWorld)) {
        this.cameraMatrix.copy(camera.matrixWorld);
        this.resetHistory('camera');
      }
      if (!matricesEqual(this.projectionMatrix, camera.projectionMatrix)) {
        this.projectionMatrix.copy(camera.projectionMatrix);
        this.resetHistory('projection');
      }
    }
    if (deltaS >= SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S) this.resetHistory('frame-pause');

    this.lastWallDeltaS = deltaS;
    (uniforms.uCameraRange!.value as THREE.Vector2).set(camera.near, camera.far);
    (uniforms.uProjectionInverse!.value as THREE.Matrix4).copy(camera.projectionMatrixInverse);
    (uniforms.uCameraWorld!.value as THREE.Matrix4).copy(camera.matrixWorld);
    (uniforms.uCameraPosition!.value as THREE.Vector3).setFromMatrixPosition(camera.matrixWorld);
    (this.bilateralMaterial.uniforms.uCameraRange!.value as THREE.Vector2).set(camera.near, camera.far);

    uniforms.uSteps!.value = this.referenceMode ? SKYRIVER_VOLUME_REFERENCE_STEPS : this.steps;
    uniforms.uVolumeRangeM!.value = SKYRIVER_VOLUME_RANGE_M;
    uniforms.uHistoryWeight!.value = skyriverVolumeHistoryWeight(deltaS);
    (uniforms.uDistrictTint!.value as THREE.Vector3).set(
      district.tintLinear[0], district.tintLinear[1], district.tintLinear[2],
    );
    uniforms.uScatterScale!.value = district.scatterScale;
    (uniforms.uDeckGlow!.value as THREE.Vector3).set(
      district.deckGlowLinear[0], district.deckGlowLinear[1], district.deckGlowLinear[2],
    );
    uniforms.uDeckGlowHeightM!.value = district.deckGlowHeightM;
    this.districtId = district.id;

    this.uploadLights(selected, districtColourAllowed);
  }

  /**
   * Uploads the selected sources.
   *
   * Radiance discipline: the source's own linear emission reaches the marcher ONCE, scaled only by
   * the explicit role importance (1.0 for every kind today). Everything spatial is the lit area and
   * the scatter radius in the shape uniform, which the shader turns into the bounded proxy. No
   * source luminance, area or flux scalar is ever multiplied into the colour.
   *
   * A cone's geometry is re-read from the live beam view every frame, so a membership held for up to
   * a second never freezes a sweeping searchlight. The colour comes from the shared district flag at
   * this moment, never from a value cached when the pool was built.
   */
  private uploadLights(selected: readonly SkyriverSelectedLight[], districtColourAllowed: boolean): void {
    const view = this.options.beamView();
    const count = Math.min(SKYRIVER_RENDER_LIGHT_LIMIT, selected.length);
    for (let i = 0; i < count; i += 1) {
      const entry = selected[i]!;
      const source = entry.source;
      const colour = districtColourAllowed ? source.emission : source.legacyEmission;
      const importance = SKYRIVER_LIGHT_ROLE_IMPORTANCE[source.kind];

      if (source.kind === 'cone') {
        const beam = view.read(source.beamSlot, this.beamScratch);
        this.lightPosition[i]!.set(beam.start[0], beam.start[1], beam.start[2], 1);
        this.lightAxis[i]!.set(beam.axis[0], beam.axis[1], beam.axis[2], beam.lengthM);
        // The cone keeps the drawn beam formula: its radiance is the drawn colour times the drawn
        // intensity, and the shader's radial Gaussian and along fade are the beam's own.
        this.lightColor[i]!.set(
          beam.colorLinear[0] * beam.intensity * importance,
          beam.colorLinear[1] * beam.intensity * importance,
          beam.colorLinear[2] * beam.intensity * importance,
          entry.weight,
        );
        this.lightShape[i]!.set(beam.widthStartM, beam.widthEndM, beam.softness, beam.fadeStart);
        continue;
      }

      const kind = source.kind === 'station' ? 2 : 0;
      this.lightPosition[i]!.set(source.position[0], source.position[1], source.position[2], kind);
      if (source.kind === 'sign') {
        this.lightAxis[i]!.set(source.axis[0], source.axis[1], source.axis[2], source.halfLengthM);
      } else {
        this.lightAxis[i]!.set(0, 1, 0, 0);
      }
      this.lightColor[i]!.set(
        colour[0] * importance, colour[1] * importance, colour[2] * importance, entry.weight,
      );
      this.lightShape[i]!.set(source.litAreaM2, source.scatterRadiusM, 1, 0.5);
    }
    for (let i = count; i < SKYRIVER_RENDER_LIGHT_LIMIT; i += 1) {
      this.lightColor[i]!.set(0, 0, 0, 0);
    }
    this.selectedCount = count;
    this.raymarchMaterial.uniforms.uLightCount!.value = count;
  }

  /**
   * Unbinds every source: no selected count, no bound radiance, no bound geometry.
   *
   * The chains that march nothing — `legacy-five`, `three-only`, Low — must call this. Without it
   * the pass keeps the last staged values, and the evidence reports sources for a frame that
   * marched none: a captured `legacy-five` record really did show `volumeEnabled: false` beside
   * `volumeSelectedLights: 10`, with `lightUniforms()` returning those ten stale bindings.
   *
   * Idempotent, and cheap enough for the frame path: ten vector writes and one uniform.
   */
  clearLights(): void {
    for (let i = 0; i < SKYRIVER_RENDER_LIGHT_LIMIT; i += 1) {
      this.lightPosition[i]!.set(0, 0, 0, 0);
      this.lightAxis[i]!.set(0, 1, 0, 0);
      this.lightColor[i]!.set(0, 0, 0, 0);
      this.lightShape[i]!.set(1, 1, 1, 0.5);
    }
    this.selectedCount = 0;
    this.raymarchMaterial.uniforms.uLightCount!.value = 0;
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const depth = this.options.depthTexture();
    const valid = this.options.depthValid() && depth !== null;
    const raymarch = this.raymarchMaterial.uniforms;
    raymarch.uDepth!.value = depth;
    raymarch.uDepthValid!.value = valid ? 1 : 0;
    this.bilateralMaterial.uniforms.uDepth!.value = depth;
    this.bilateralMaterial.uniforms.uDepthValid!.value = valid ? 1 : 0;

    // The composition target for this invocation, and its state before any draw. Recorded here, in
    // the invocation that uses it, never read back off the composer after the chain has swapped.
    const target = this.renderToScreen ? null : readBuffer;
    const oldAutoClear = renderer.autoClear;
    this.invocationCount += 1;
    this.invocationFaulted = true;
    this.invocationRenderToScreen = this.renderToScreen;
    this.autoClearBefore = oldAutoClear;
    this.marchedDepthUuid = depth?.uuid ?? null;
    this.marchedDepthValid = valid;
    this.skippedForDepth = !valid;
    writeTargetRecord(this.targetBefore, target);

    if (!valid) {
      // No valid opaque depth THIS invocation. The marcher cannot know where the surfaces are, so
      // every ray would run the full bounded range straight through the walls and lay a scatter
      // sheet over near geometry. There is no correct volume to draw, so nothing is drawn and the
      // skip is recorded. The plan is what keeps a frame off this path: it derives `volumePass`
      // and the opaque-stage analytic bypass from depth availability, and a failure detected
      // during this frame's capture turns the next frame's plan legacy. See
      // `skyriverCompositionPlan` and `SkyriverDepthSnapshot.opaqueSnapshotValid`.
      //
      // The window this leaves is one frame wide, and it is stated rather than hidden: THIS
      // frame's opaque stage has already dropped the shared analytic haze, so a capture that
      // failed after that draw gives one frame with no absorption at all. That is a frame of
      // missing haze, not a sheet of fog in front of the walls, and the next frame is the full
      // legacy analytic scene. `stats().depthSkips` counts them.
      this.depthSkips += 1;
      this.invocationFaulted = false;
      writeTargetRecord(this.targetAfter, target);
      this.autoClearAfter = renderer.autoClear;
      return;
    }

    try {
      renderer.autoClear = false;

      // Draw one: integrate and fuse history. Reads the previous target, writes the other.
      if (this.referenceMode) this.renderReference(renderer);
      else this.renderIntegration(renderer);

      // Draw two: bilateral premultiplied over, into the SAME composer readBuffer. The existing
      // opaque depth attachment is untouched: this quad neither tests nor writes depth, and nothing
      // here clears.
      this.bilateralMaterial.uniforms.uHistory!.value = this.referenceMode && this.referenceTarget !== null
        ? this.referenceTarget.texture
        : this.historyRead.texture;
      this.quad.material = this.bilateralMaterial;
      renderer.setRenderTarget(target);
      this.quad.render(renderer);
      this.noiseUploaded = true;
      // Diagnostic only, and inside the invocation: see `onComposed`.
      this.options.onComposed?.();
      this.invocationFaulted = false;
    } finally {
      // Exact restoration on every path including a throw: a composer pass that left autoClear
      // false would stop every later frame from clearing, so one failed draw would corrupt the
      // whole chain rather than one frame.
      renderer.autoClear = oldAutoClear;
      this.autoClearAfter = renderer.autoClear;
      writeTargetRecord(this.targetAfter, target);
    }
  }

  /**
   * What the last invocation actually composed into. See `SkyriverVolumeInvocationRecord`.
   *
   * Null before the first invocation. The record is copied out here, so a diagnostic caller holds a
   * snapshot rather than a view of the live mutable record.
   */
  invocationEvidence(): SkyriverVolumeInvocationRecord | null {
    if (this.invocationCount === 0) return null;
    return Object.freeze({
      invocation: this.invocationCount,
      renderToScreen: this.invocationRenderToScreen,
      faulted: this.invocationFaulted,
      before: frozenTargetRecord(this.targetBefore),
      after: frozenTargetRecord(this.targetAfter),
      marchedDepthUuid: this.marchedDepthUuid,
      marchedDepthIsCopy: true,
      depthValid: this.marchedDepthValid,
      composed: !this.skippedForDepth,
      skipReason: this.skippedForDepth ? 'no-valid-opaque-depth' : null,
      autoClearBefore: this.autoClearBefore,
      autoClearAfter: this.autoClearAfter,
    });
  }

  private renderIntegration(renderer: THREE.WebGLRenderer): void {
    const raymarch = this.raymarchMaterial.uniforms;
    raymarch.uHistory!.value = this.historyRead.texture;
    raymarch.uHistoryValid!.value = this.historyValid ? 1 : 0;
    raymarch.uJitterPhase!.value = this.jitterPhase;
    raymarch.uReferenceScale!.value = 1;
    raymarch.uSteps!.value = this.steps;
    this.quad.material = this.raymarchMaterial;
    renderer.setRenderTarget(this.historyWrite);
    this.quad.render(renderer);

    // Swap the owned pointers only. The composer's own buffers are untouched.
    const written = this.historyWrite;
    this.historyWrite = this.historyRead;
    this.historyRead = written;
    this.historyValid = true;
    this.jitterPhase = (this.jitterPhase + 1) % SKYRIVER_VOLUME_JITTER_PHASES;
  }

  /**
   * The predeclared reference: 128 steps at 16 fixed jitter phases, history off, averaged as linear
   * S and T before any composition. Diagnostic: these draws are probes, excluded from the normal
   * call count and from every timing result.
   */
  private renderReference(renderer: THREE.WebGLRenderer): void {
    const target = this.referenceTarget;
    if (target === null) throw new Error('SKYRIVER_VOLUME_REFERENCE_TARGET_MISSING');
    const raymarch = this.raymarchMaterial.uniforms;
    raymarch.uHistory!.value = this.historyRead.texture;
    raymarch.uHistoryValid!.value = 0;
    raymarch.uSteps!.value = SKYRIVER_VOLUME_REFERENCE_STEPS;
    raymarch.uReferenceScale!.value = 1 / SKYRIVER_VOLUME_JITTER_PHASES;
    this.quad.material = this.raymarchMaterial;

    const material = this.raymarchMaterial;
    // EVERY piece of state this probe changes, captured before the first write. The normal frame
    // shares this material, so one unrestored field would change every later frame, not this one.
    const previous = {
      blending: material.blending,
      blendEquation: material.blendEquation,
      blendEquationAlpha: material.blendEquationAlpha,
      blendSrc: material.blendSrc,
      blendDst: material.blendDst,
      blendSrcAlpha: material.blendSrcAlpha,
      blendDstAlpha: material.blendDstAlpha,
      transparent: material.transparent,
    };
    // The scene's own clear colour must survive the probe: the opaque stage clears with it.
    const previousClearColour = new THREE.Color();
    renderer.getClearColor(previousClearColour);
    const previousClearAlpha = renderer.getClearAlpha();
    try {
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      // Explicit ONE / ONE ADD on both RGB and alpha: the accumulation is a plain sum of the 16
      // pre-scaled phases. See SKYRIVER_VOLUME_REFERENCE_BLEND for what AdditiveBlending did here.
      const blend = SKYRIVER_VOLUME_REFERENCE_BLEND;
      material.blending = blend.blending;
      material.blendEquation = blend.blendEquation;
      material.blendEquationAlpha = blend.blendEquationAlpha;
      material.blendSrc = blend.blendSrc;
      material.blendDst = blend.blendDst;
      material.blendSrcAlpha = blend.blendSrcAlpha;
      material.blendDstAlpha = blend.blendDstAlpha;
      material.transparent = true;
      for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
        raymarch.uJitterPhase!.value = phase;
        this.quad.render(renderer);
        this.probeDraws += 1;
      }
    } finally {
      material.blending = previous.blending;
      material.blendEquation = previous.blendEquation;
      material.blendEquationAlpha = previous.blendEquationAlpha;
      material.blendSrc = previous.blendSrc;
      material.blendDst = previous.blendDst;
      material.blendSrcAlpha = previous.blendSrcAlpha;
      material.blendDstAlpha = previous.blendDstAlpha;
      material.transparent = previous.transparent;
      material.uniforms.uReferenceScale!.value = 1;
      renderer.setClearColor(previousClearColour, previousClearAlpha);
    }
    this.referencePhasesCompleted = SKYRIVER_VOLUME_JITTER_PHASES;
  }

  /** The source records actually bound, for the evidence. No history counters, every source field. */
  lightUniforms(): readonly {
    readonly position: readonly [number, number, number];
    readonly kind: number;
    readonly axis: readonly [number, number, number];
    readonly axisScalar: number;
    readonly colour: readonly [number, number, number];
    readonly weight: number;
    readonly shape: readonly [number, number, number, number];
  }[] {
    const bound = [];
    for (let i = 0; i < this.selectedCount; i += 1) {
      const p = this.lightPosition[i]!;
      const a = this.lightAxis[i]!;
      const c = this.lightColor[i]!;
      const s = this.lightShape[i]!;
      bound.push({
        position: [p.x, p.y, p.z] as readonly [number, number, number],
        kind: p.w,
        axis: [a.x, a.y, a.z] as readonly [number, number, number],
        axisScalar: a.w,
        colour: [c.x, c.y, c.z] as readonly [number, number, number],
        weight: c.w,
        shape: [s.x, s.y, s.z, s.w] as readonly [number, number, number, number],
      });
    }
    return bound;
  }

  /** The live material references the component GPU timers bind to. Names alone prove nothing. */
  componentBindings(): {
    readonly raymarch: THREE.ShaderMaterial;
    readonly bilateral: THREE.ShaderMaterial;
    readonly historyRead: THREE.WebGLRenderTarget;
    readonly historyWrite: THREE.WebGLRenderTarget;
  } {
    return {
      raymarch: this.raymarchMaterial,
      bilateral: this.bilateralMaterial,
      historyRead: this.historyRead,
      historyWrite: this.historyWrite,
    };
  }

  /**
   * The reference integrator's recorded state.
   *
   * The reference is a NOISE-FREE PROXY, not ground truth: it is the same integrator at 128 steps
   * over 16 fixed jitter phases, averaged as linear scatter and transmittance before any
   * composition, bloom or output transform. It runs at the same half/quarter spatial size as the
   * normal frame and with history off.
   */
  referenceEvidence(): {
    readonly enabled: boolean;
    readonly steps: number;
    readonly jitterPhaseIndices: readonly number[];
    readonly phasesCompleted: number;
    readonly resolve: string;
    readonly historyEnabled: boolean;
    readonly shaderFingerprint: string;
    readonly volumeSize: { readonly width: number; readonly height: number };
    readonly sameSpatialResolutionAsNormal: boolean;
    readonly accumulationTextureType: number;
    /** The accumulation blend the 16 draws run with. Factors, not a blending-mode label. */
    readonly blend: {
      readonly equationRgb: number;
      readonly equationAlpha: number;
      readonly srcRgb: number;
      readonly dstRgb: number;
      readonly srcAlpha: number;
      readonly dstAlpha: number;
      readonly description: string;
    };
    readonly limits: readonly string[];
  } {
    const phases = [];
    for (let i = 0; i < SKYRIVER_VOLUME_JITTER_PHASES; i += 1) phases.push(i);
    return {
      enabled: this.referenceMode,
      steps: SKYRIVER_VOLUME_REFERENCE_STEPS,
      jitterPhaseIndices: phases,
      phasesCompleted: this.referencePhasesCompleted,
      resolve: 'linear scatter and transmittance averaged before composition, bloom and output',
      historyEnabled: false,
      shaderFingerprint: skyriverShaderFingerprint(this.raymarchMaterial.fragmentShader),
      volumeSize: { width: this.volumeWidth, height: this.volumeHeight },
      sameSpatialResolutionAsNormal: true,
      accumulationTextureType: this.referenceTarget?.texture.type ?? THREE.FloatType,
      blend: {
        equationRgb: SKYRIVER_VOLUME_REFERENCE_BLEND.blendEquation,
        equationAlpha: SKYRIVER_VOLUME_REFERENCE_BLEND.blendEquationAlpha,
        srcRgb: SKYRIVER_VOLUME_REFERENCE_BLEND.blendSrc,
        dstRgb: SKYRIVER_VOLUME_REFERENCE_BLEND.blendDst,
        srcAlpha: SKYRIVER_VOLUME_REFERENCE_BLEND.blendSrcAlpha,
        dstAlpha: SKYRIVER_VOLUME_REFERENCE_BLEND.blendDstAlpha,
        description: 'ADD with ONE / ONE on RGB and on alpha: a plain sum of 16 pre-scaled phases',
      },
      limits: Object.freeze([
        'A noise-free proxy at the same integrator and spatial size, not exact ground truth.',
        'Its 16 accumulation draws are probes: outside the normal draw count and every timing result.',
        'NOT YET GPU-VERIFIED in this session: a constant-density readback must match the analytic'
          + ' transmittance before this reference is used for any visual acceptance decision.',
        'Static-camera convergence only. The history resets on any camera matrix change and the'
          + ' jitter phase advances every integration, so in flight every frame is a single-phase'
          + ' result. Frozen-frame convergence is NOT flight evidence: temporal stability in motion'
          + ' needs its own moving-camera capture, which this module does not claim to provide.',
      ]),
    };
  }

  /** Every presentation source input bound right now, for the frozen-input record. */
  presentationInputs(): Readonly<Record<string, unknown>> {
    const uniforms = this.raymarchMaterial.uniforms;
    const tint = uniforms.uDistrictTint!.value as THREE.Vector3;
    const deck = uniforms.uDeckGlow!.value as THREE.Vector3;
    const range = uniforms.uCameraRange!.value as THREE.Vector2;
    return Object.freeze({
      steps: uniforms.uSteps!.value,
      volumeRangeM: uniforms.uVolumeRangeM!.value,
      cameraRange: [range.x, range.y],
      cameraWorld: [...(uniforms.uCameraWorld!.value as THREE.Matrix4).elements],
      projectionInverse: [...(uniforms.uProjectionInverse!.value as THREE.Matrix4).elements],
      cameraPosition: (uniforms.uCameraPosition!.value as THREE.Vector3).toArray(),
      districtTint: [tint.x, tint.y, tint.z],
      scatterScale: uniforms.uScatterScale!.value,
      deckGlow: [deck.x, deck.y, deck.z],
      deckGlowHeightM: uniforms.uDeckGlowHeightM!.value,
      scatterGain: uniforms.uScatterGain!.value,
      densityField: { ...SKYRIVER_VOLUME_FIELD },
      lightCount: uniforms.uLightCount!.value,
      lights: this.lightUniforms(),
      depthValid: uniforms.uDepthValid!.value,
      shaderFingerprint: skyriverShaderFingerprint(this.raymarchMaterial.fragmentShader),
      // Excluded on purpose: these are the only inputs allowed to advance during a freeze.
      excluded: ['history render delta', 'history frame/jitter phase', 'reference quality controls'],
    });
  }

  /** The bilateral upsampler's bound samplers, for the composition evidence. */
  bilateralSamplers(): readonly { readonly name: string; readonly uuid: string | null }[] {
    const uniforms = this.bilateralMaterial.uniforms;
    return ['uHistory', 'uDepth'].map((name) => {
      const value = uniforms[name]?.value as THREE.Texture | null | undefined;
      return { name, uuid: value?.uuid ?? null };
    });
  }

  stats(): SkyriverVolumeFogStats {
    const field = SKYRIVER_VOLUME_FIELD;
    const tint = this.raymarchMaterial.uniforms.uDistrictTint!.value as THREE.Vector3;
    return {
      enabled: this.enabled,
      profile: this.profile.id,
      steps: this.referenceMode ? SKYRIVER_VOLUME_REFERENCE_STEPS : this.steps,
      spatialScale: this.profile.spatialScale,
      volumeSize: { width: this.volumeWidth, height: this.volumeHeight },
      physicalSize: { width: this.physicalWidth, height: this.physicalHeight },
      rangeM: SKYRIVER_VOLUME_RANGE_M,
      depthValid: (this.raymarchMaterial.uniforms.uDepthValid!.value as number) > 0.5,
      selectedCount: this.selectedCount,
      historyValid: this.historyValid,
      historyWeight: this.raymarchMaterial.uniforms.uHistoryWeight!.value as number,
      historyResets: this.historyResets,
      lastHistoryReset: this.lastHistoryReset,
      lastWallDeltaS: this.lastWallDeltaS,
      jitterPhase: this.jitterPhase,
      referenceMode: this.referenceMode,
      referencePhasesCompleted: this.referencePhasesCompleted,
      referenceSteps: SKYRIVER_VOLUME_REFERENCE_STEPS,
      noiseSha256: SKYRIVER_BLUE_NOISE_SHA256,
      noiseUploaded: this.noiseUploaded,
      densityLow: field.densityLow,
      densityHigh: field.densityHigh,
      deckPeakMultiplier: 1 + field.deckGain,
      deepFloorMultiplier: 1 - field.deepThinning,
      scatterGain: SKYRIVER_VOLUME_SCATTER_GAIN,
      districtId: this.districtId,
      districtTint: [tint.x, tint.y, tint.z],
      normalDraws: SKYRIVER_VOLUME_NORMAL_DRAWS,
      probeDraws: this.probeDraws,
      depthSkips: this.depthSkips,
    };
  }

  dispose(): void {
    this.historyRead.dispose();
    this.historyWrite.dispose();
    this.referenceTarget?.dispose();
    this.referenceTarget = null;
    this.raymarchMaterial.dispose();
    this.bilateralMaterial.dispose();
    this.noiseTexture.dispose();
    // `FullScreenQuad.dispose()` deliberately NOT called: in three r170 it disposes the module's
    // single shared fullscreen triangle, which every other FullScreenQuad in the process still
    // references. Everything this pass actually owns is released above.
  }
}

/** Two draws, every normal frame. Never one, never three. */
export const SKYRIVER_VOLUME_NORMAL_DRAWS = 2;

/**
 * FNV-1a over the shader source, as hex. Identifies the bound program in the evidence so a
 * reference run and a normal run can be shown to have used the same integrator.
 */
export function skyriverShaderFingerprint(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function matricesEqual(a: THREE.Matrix4, b: THREE.Matrix4): boolean {
  const left = a.elements;
  const right = b.elements;
  for (let i = 0; i < 16; i += 1) if (left[i] !== right[i]) return false;
  return true;
}
