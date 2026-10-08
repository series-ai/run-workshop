/**
 * R23 volume fog: the density field, the step integrator, the depth conversion, the history policy,
 * the blue-noise tile, the smog records, and the shader-source invariants.
 *
 * Everything here is pure and GL-free. The GPU shader is covered two ways: its constants are
 * generated from the same exported values the TS twin uses (so a drift breaks compilation of the
 * check below), and its source text is asserted for the invariants a driver would otherwise fail on
 * silently. Real pixel behaviour, GPU timing and draw counts are browser evidence and are not
 * claimed here.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
  SKYRIVER_BLUE_NOISE_BIN_COUNT,
  SKYRIVER_BLUE_NOISE_BYTES,
  SKYRIVER_BLUE_NOISE_HEIGHT,
  SKYRIVER_BLUE_NOISE_SHA256,
  SKYRIVER_BLUE_NOISE_WIDTH,
  skyriverBlueNoiseJitter,
  skyriverBlueNoiseJitterFromByte,
} from '../src/render/blueNoiseTile';
import { linearViewDepth } from '../src/render/depthFade';
import { canyonHeading, warpDirection } from '../src/render/canyonWarp';
import { skyriverHeldHazeTint, skyriverWriteHeldHazeTint } from '../src/render/districts';
import {
  SKYRIVER_SMOG_BANDS,
  SKYRIVER_SMOG_DRIFT_ACROSS_LEAN,
  SKYRIVER_SMOG_DRIFT_MPS,
  SKYRIVER_SMOG_DRIFT_PERIOD_S,
  SKYRIVER_SMOG_HIGH_MAX,
  SKYRIVER_SMOG_HIGH_MIN,
  SKYRIVER_SMOG_MIDDLE_DRIFT_MPS,
  SKYRIVER_SMOG_MIDDLE_DRIFT_PERIOD_S,
  SKYRIVER_SMOG_VERTEX_SOURCE,
  skyriverBuildSmogClouds,
  skyriverSmogCentreAt,
} from '../src/render/smog';
import {
  SKYRIVER_BLOOM_DRAWS,
  SKYRIVER_BLOOM_FACTORS,
  SKYRIVER_BLOOM_KERNELS,
  SKYRIVER_BLOOM_MIPS,
  SKYRIVER_LEGACY_BLOOM_DRAWS,
  SKYRIVER_LEGACY_BLOOM_MIPS,
} from '../src/render/threeMipBloom';
import {
  SKYRIVER_SCATTER_SPHERE_SR,
  skyriverScatterRadiusM,
  skyriverScatterResponse,
} from '../src/render/renderLightSet';
import {
  SKYRIVER_SCATTER_RESPONSE_GLSL,
  SKYRIVER_VOLUME_DENSITY_GLSL,
  SKYRIVER_VOLUME_FIELD,
  SKYRIVER_VOLUME_HIGH_STEPS_MAX,
  SKYRIVER_VOLUME_HIGH_STEPS_MIN,
  SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S,
  SKYRIVER_VOLUME_HISTORY_TAU_S,
  SKYRIVER_VOLUME_JITTER_PHASES,
  SKYRIVER_VOLUME_NORMAL_DRAWS,
  SKYRIVER_VOLUME_PROFILES,
  SKYRIVER_VOLUME_RANGE_M,
  SKYRIVER_VOLUME_REFERENCE_STEPS,
  SKYRIVER_VOLUME_SCATTER_GAIN,
  skyriverAnalyticTransmittance,
  skyriverDistrictFogProfileFrom,
  skyriverIntegrateVolume,
  skyriverShaderFingerprint,
  skyriverVolumeDeepFactor,
  skyriverVolumeDensity,
  skyriverVolumeDimension,
  skyriverVolumeHistoryWeight,
  skyriverBilateralResolve,
  skyriverVolumeRayLength,
  skyriverVolumeTexelUv,
  SKYRIVER_VOLUME_REFERENCE_BLEND,
  type SkyriverVolumeSample,
} from '../src/render/volumeFog';
import { SKYRIVER_MAX_FRAME_DT_S } from '../src/render/scene';

const ZERO: readonly [number, number, number] = [0, 0, 0];

describe('R23 density field', () => {
  it('is finite and non-negative everywhere, including far outside the drawn volume', () => {
    for (const height of [-1e6, -100000, -5000, -900, -450, 0, 40, 120, 600, 1900, 3500, 14000, 1e6]) {
      const density = skyriverVolumeDensity(height);
      expect(Number.isFinite(density)).toBe(true);
      expect(density).toBeGreaterThanOrEqual(0);
    }
    // A non-finite height must not produce NaN: one NaN pixel blacks out the frame once bloom
    // spreads it (the lesson already recorded in the R20 fog shader).
    expect(Number.isFinite(skyriverVolumeDensity(Number.NaN))).toBe(true);
    expect(Number.isFinite(skyriverVolumeDensity(Number.POSITIVE_INFINITY))).toBe(true);
  });

  it('reads the actual R22 constants, not a second field', () => {
    expect(SKYRIVER_VOLUME_FIELD.densityLow).toBe(0.00078);
    expect(SKYRIVER_VOLUME_FIELD.densityHigh).toBe(0.0001);
    expect(SKYRIVER_VOLUME_FIELD.floorY).toBe(40);
    expect(SKYRIVER_VOLUME_FIELD.rangeY).toBe(1900);
    // Deck peak 1.45 and deep-void floor 0.55 — the actual multipliers, not an assumed 5x ratio.
    expect(1 + SKYRIVER_VOLUME_FIELD.deckGain).toBeCloseTo(1.45, 10);
    expect(1 - SKYRIVER_VOLUME_FIELD.deepThinning).toBeCloseTo(0.55, 10);
  });

  it('makes deck air denser than high air, and reports the real ratio', () => {
    const deck = skyriverVolumeDensity(SKYRIVER_VOLUME_FIELD.floorY);
    const high = skyriverVolumeDensity(2400);
    expect(deck).toBeGreaterThan(high);
    // Measured: 0.00078 x 1.45 over 0.0001 = 11.31x. The obsolete "~5x" comment in the legacy fog
    // tunables describes neither this field nor the shader it documents.
    expect(deck / high).toBeCloseTo(11.31, 2);
    expect(deck).toBeCloseTo(0.001131, 9);
    expect(high).toBeCloseTo(0.0001, 9);
  });

  it('is monotone non-increasing from the deck up to clear air', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let h = SKYRIVER_VOLUME_FIELD.floorY; h <= 3000; h += 10) {
      const density = skyriverVolumeDensity(h);
      expect(density).toBeLessThanOrEqual(previous + 1e-12);
      previous = density;
    }
  });

  it('records the legacy deep-void thinning as a limit, not a monotone profile below the deck', () => {
    // A strictly monotone profile would keep getting denser all the way down. The R22 field does
    // not: below the floor band the deep-void guard thins it again, by design (T7-3: the depths
    // read as void rather than as a black wall). R23 preserves that behaviour rather than
    // redesigning the field, so the non-monotonicity is recorded here as a known limit.
    const atDeck = skyriverVolumeDensity(40);
    const midVoid = skyriverVolumeDensity(-450);
    const deepVoid = skyriverVolumeDensity(-900);
    expect(midVoid).toBeLessThan(atDeck);
    expect(deepVoid).toBeLessThan(midVoid);
    expect(deepVoid).toBeCloseTo(SKYRIVER_VOLUME_FIELD.densityLow * 0.55, 9);
  });

  it('encodes the reversed-edge deep smoothstep as a defined inverse', () => {
    // GLSL leaves smoothstep( edge0, edge1, x ) undefined for edge0 >= edge1, which is exactly what
    // the legacy shader writes: smoothstep( 0.0, -900.0, height ). The marcher spells the intended
    // ratio out instead, so it cannot depend on a driver's choice.
    expect(skyriverVolumeDeepFactor(0)).toBe(0);
    expect(skyriverVolumeDeepFactor(100)).toBe(0);
    expect(skyriverVolumeDeepFactor(-900)).toBe(1);
    expect(skyriverVolumeDeepFactor(-2000)).toBe(1);
    expect(skyriverVolumeDeepFactor(-450)).toBeCloseTo(0.5, 10);
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain('clamp( h / VOL_DEEP_EDGE_Y, 0.0, 1.0 )');
    // The deep factor must not call smoothstep at all: its edges would be the reversed pair.
    const body = /float volumeDeep\( float h \) \{([\s\S]*?)\n\}/.exec(SKYRIVER_VOLUME_DENSITY_GLSL);
    expect(body).not.toBeNull();
    expect(body![1]).not.toContain('smoothstep');
  });

  it('generates its GLSL constants from the same exported values', () => {
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain(SKYRIVER_VOLUME_FIELD.densityLow.toExponential(6));
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain(SKYRIVER_VOLUME_FIELD.densityHigh.toExponential(6));
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain('#define VOL_FLOOR_Y 40.0');
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain('#define VOL_RANGE_Y 1900.0');
    expect(SKYRIVER_VOLUME_DENSITY_GLSL).toContain('#define VOL_DECK_GAIN 0.4500');
  });
});

// --- the scatter unit proxy, CPU and GLSL (R23 scatter repair) ----------------------------------

describe('R23 scatter response GLSL twin', () => {
  /** The shader's own expression, run on the constant the generated GLSL actually defines. */
  function shaderResponse(litAreaM2: number, distanceM: number): number {
    const define = /#define VOL_SCATTER_SPHERE_SR ([0-9.e+-]+)/.exec(SKYRIVER_SCATTER_RESPONSE_GLSL);
    if (define === null) throw new Error('VOL_SCATTER_SPHERE_SR_MISSING');
    const sphere = Number(define[1]);
    const area = Math.max(litAreaM2, 0);
    const denominator = area + sphere * distanceM * distanceM;
    return denominator > 0 ? area / denominator : 0;
  }

  it('generates its sphere constant from the one exported value', () => {
    expect(SKYRIVER_SCATTER_RESPONSE_GLSL)
      .toContain(`#define VOL_SCATTER_SPHERE_SR ${SKYRIVER_SCATTER_SPHERE_SR}`);
    expect(SKYRIVER_SCATTER_SPHERE_SR).toBeCloseTo(4 * Math.PI, 12);
    // The area form, with both units named at the point of use.
    expect(SKYRIVER_SCATTER_RESPONSE_GLSL)
      .toContain('float scatterResponse( float litAreaM2, float distanceM )');
    expect(SKYRIVER_SCATTER_RESPONSE_GLSL)
      .toContain('area + VOL_SCATTER_SPHERE_SR * distanceM * distanceM');
  });

  it('agrees with the CPU proxy at every sampled area and distance', () => {
    // The rank runs on the CPU and the radiance runs on the GPU. If these two drift, selection and
    // scatter disagree and no measured frame can be attributed to either.
    for (const area of [1e-3, 48, 2928, 14400, 42120, 2.08e5, 1e7]) {
      for (const distance of [0, 0.5, 12, 57.9, 120, 375, 749, 1166, 2600, 9000]) {
        expect(shaderResponse(area, distance)).toBeCloseTo(skyriverScatterResponse(area, distance), 12);
      }
      // Both forms agree with the radius form the records report.
      const radius = skyriverScatterRadiusM(area);
      expect(shaderResponse(area, radius)).toBeCloseTo(0.5, 9);
    }
    expect(shaderResponse(0, 0)).toBe(0);
  });

  it('bounds the integrated scatter at the source emission, where the failing build did not', () => {
    // The measured source: the hero blade whose uploaded RGB reached 1585.3 and whose frame came
    // back 97.77% exact white. The ray passes straight through it, which is the worst case.
    const emission: readonly [number, number, number] = [0.0653, 2.0397, 2.2971];
    const litAreaM2 = 42120;
    const closestAtM = 1300;
    const distanceTo = (s: number): number => Math.abs(s - closestAtM);

    const march = (scale: number) => skyriverIntegrateVolume({
      steps: 128,
      rayLengthM: SKYRIVER_VOLUME_RANGE_M,
      jitter: 0.5,
      density: (s) => skyriverVolumeDensity(400 - s * 0.05),
      radiance: (s) => {
        const response = skyriverScatterResponse(litAreaM2, distanceTo(s));
        return [
          emission[0] * scale * response * SKYRIVER_VOLUME_SCATTER_GAIN,
          emission[1] * scale * response * SKYRIVER_VOLUME_SCATTER_GAIN,
          emission[2] * scale * response * SKYRIVER_VOLUME_SCATTER_GAIN,
        ];
      },
    });

    const repaired = march(1);
    for (let channel = 0; channel < 3; channel += 1) {
      // Scatter can never exceed the absorbed fraction times the peak local radiance, and the peak
      // local radiance is the source's own emission times the scatter gain.
      const peak = emission[channel]! * SKYRIVER_VOLUME_SCATTER_GAIN;
      expect(repaired.scatter[channel]!).toBeLessThanOrEqual((1 - repaired.transmittance) * peak + 1e-12);
      expect(repaired.scatter[channel]!).toBeLessThan(emission[channel]! + 1e-12);
    }
    expect(Math.max(...repaired.scatter)).toBeLessThan(1);

    // The same ray with the initial build's extra energy factor (Y x litArea / 100 = 690.1) is
    // tens of times over the display range before the renderer's 1.9 exposure: the white frame.
    expect(Math.max(...repaired.scatter)).toBeLessThan(0.1);
    const failing = march(690.1353564123896);
    expect(Math.max(...failing.scatter)).toBeGreaterThan(40);
    expect(Math.max(...failing.scatter) / Math.max(...repaired.scatter)).toBeCloseTo(690.1353564123896, 3);
  });
});

describe('R23 step integration', () => {
  it('gives S = 0 and T = 1 at zero density, so in-place composition is neutral', () => {
    const result = skyriverIntegrateVolume({
      steps: 8,
      rayLengthM: 2600,
      jitter: 0.5,
      density: () => 0,
      radiance: () => [3, 2, 1],
    });
    expect(result.scatter).toEqual([0, 0, 0]);
    expect(result.transmittance).toBe(1);
    // C_out = S + T * C_opaque = 0 + 1 * C_opaque.
    const opaque = 0.37;
    expect(result.scatter[0] + result.transmittance * opaque).toBe(opaque);
  });

  it('gives S = 0 at zero source energy while still attenuating opaque colour through T', () => {
    const result = skyriverIntegrateVolume({
      steps: 8,
      rayLengthM: 2600,
      jitter: 0.5,
      density: () => 0.001,
      radiance: () => ZERO,
    });
    expect(result.scatter).toEqual([0, 0, 0]);
    // Absorption is independent of emission: no lights does not mean no absorption.
    expect(result.transmittance).toBeLessThan(1);
    expect(result.transmittance).toBeCloseTo(Math.exp(-2.6), 10);
  });

  it('matches the analytic integral exactly for a constant density and constant radiance', () => {
    // The step recurrence telescopes when deltaTau is constant, so there is no step error at all in
    // this case — for any step count and any jitter. That is the reference identity.
    for (const steps of [6, 8, 12, 128]) {
      for (const jitter of [0, 0.25, 0.5, 0.99]) {
        const result = skyriverIntegrateVolume({
          steps,
          rayLengthM: 1000,
          jitter,
          density: () => 0.001,
          radiance: () => [1, 1, 1],
        });
        const analyticT = skyriverAnalyticTransmittance(0.001, 1000);
        expect(result.transmittance).toBeCloseTo(analyticT, 12);
        expect(result.scatter[0]).toBeCloseTo(1 - analyticT, 12);
      }
    }
  });

  it('integrates opaque absorption exactly once along a ray', () => {
    // Splitting one ray into two halves and composing them must give the same transmittance as
    // marching it whole. A second absorption term anywhere would break this identity.
    const density = (s: number): number => skyriverVolumeDensity(200 - s * 0.1);
    const whole = skyriverIntegrateVolume({
      steps: 128, rayLengthM: 2000, jitter: 0.5, density, radiance: () => ZERO,
    });
    const first = skyriverIntegrateVolume({
      steps: 64, rayLengthM: 1000, jitter: 0.5, density, radiance: () => ZERO,
    });
    const second = skyriverIntegrateVolume({
      steps: 64, rayLengthM: 1000, jitter: 0.5, density: (s) => density(s + 1000), radiance: () => ZERO,
    });
    expect(whole.transmittance).toBeCloseTo(first.transmittance * second.transmittance, 6);
  });

  it('stays within the declared step error of the 128-step 16-phase reference', () => {
    // Declared bounds, measured on the real height-varying field with a bounded local source at
    // 400 m. Single-phase error is the worst case a frame can show before any history; the
    // 16-phase average is what the accumulated history converges toward.
    const declared = {
      6: { singlePhaseRelScatter: 0.15, singlePhaseAbsT: 6e-3, averagedRelScatter: 4e-3 },
      8: { singlePhaseRelScatter: 0.11, singlePhaseAbsT: 4.5e-3, averagedRelScatter: 3e-3 },
      12: { singlePhaseRelScatter: 0.07, singlePhaseAbsT: 3e-3, averagedRelScatter: 2e-3 },
    } as const;

    const cases = [
      { y0: 180, dy: -0.22 },
      { y0: 1900, dy: 0.02 },
      { y0: -400, dy: 0.35 },
    ];

    for (const view of cases) {
      const density = (s: number): number => skyriverVolumeDensity(view.y0 + view.dy * s);
      const radiance = (s: number): readonly [number, number, number] => {
        const falloff = 1 / (1 + ((s - 400) / 500) ** 2);
        return [falloff, falloff * 0.8, falloff * 0.6];
      };
      const average = (steps: number): { scatter: number; transmittance: number } => {
        let scatter = 0;
        let transmittance = 0;
        for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
          const result = skyriverIntegrateVolume({
            steps,
            rayLengthM: SKYRIVER_VOLUME_RANGE_M,
            jitter: (phase + 0.5) / SKYRIVER_VOLUME_JITTER_PHASES,
            density,
            radiance,
          });
          scatter += result.scatter[0] / SKYRIVER_VOLUME_JITTER_PHASES;
          transmittance += result.transmittance / SKYRIVER_VOLUME_JITTER_PHASES;
        }
        return { scatter, transmittance };
      };

      const reference = average(SKYRIVER_VOLUME_REFERENCE_STEPS);
      for (const steps of [6, 8, 12] as const) {
        const bound = declared[steps];
        let worstScatter = 0;
        let worstTransmittance = 0;
        for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
          const result = skyriverIntegrateVolume({
            steps,
            rayLengthM: SKYRIVER_VOLUME_RANGE_M,
            jitter: (phase + 0.5) / SKYRIVER_VOLUME_JITTER_PHASES,
            density,
            radiance,
          });
          worstScatter = Math.max(
            worstScatter,
            Math.abs(result.scatter[0] - reference.scatter) / Math.max(reference.scatter, 1e-9),
          );
          worstTransmittance = Math.max(
            worstTransmittance, Math.abs(result.transmittance - reference.transmittance),
          );
        }
        expect(worstScatter).toBeLessThan(bound.singlePhaseRelScatter);
        expect(worstTransmittance).toBeLessThan(bound.singlePhaseAbsT);

        const averaged = average(steps);
        expect(
          Math.abs(averaged.scatter - reference.scatter) / Math.max(reference.scatter, 1e-9),
        ).toBeLessThan(bound.averagedRelScatter);
      }
    }
  });
});

describe('R23 depth conversion', () => {
  it('matches the R20 near/far conversion the depth snapshot already uses', () => {
    const near = 1;
    const far = 14000;
    // The marcher's GLSL reproduces this expression; the TS twin is the R20 export itself.
    for (const depth01 of [0, 0.25, 0.5, 0.9, 0.99, 1]) {
      const view = linearViewDepth(depth01, near, far);
      expect(Number.isFinite(view)).toBe(true);
      expect(view).toBeGreaterThanOrEqual(near - 1e-9);
      expect(view).toBeLessThanOrEqual(far + 1e-6);
    }
    expect(linearViewDepth(0, near, far)).toBeCloseTo(near, 6);
    expect(linearViewDepth(1, near, far)).toBeCloseTo(far, 3);
  });

  it('converts view depth to ray distance for oblique rays, never shortening them', () => {
    // The shader divides by max( -viewUnit.z, 1e-4 ): an oblique ray travels 1 / |cos| further per
    // metre of view depth, so the ray distance is never less than the view depth.
    const viewDepth = 500;
    for (const cosForward of [1, 0.9, 0.7, 0.42, 0.1]) {
      const rayDistance = viewDepth / cosForward;
      expect(rayDistance).toBeGreaterThanOrEqual(viewDepth - 1e-9);
    }
    expect(SKYRIVER_VOLUME_RANGE_M).toBe(2600);
  });

  it('caps a clear-depth pixel at the bounded volume range, not the far plane', () => {
    // Sky (depth01 >= 0.9999999) must stop at 2.6 km, not 14 km: a ray with no surface has no
    // physical end point, so the bound there is a declared cost limit.
    const far = 14000;
    expect(SKYRIVER_VOLUME_RANGE_M).toBeLessThan(far);
    expect(SKYRIVER_VOLUME_RANGE_M).toBeGreaterThanOrEqual(2000);
    expect(SKYRIVER_VOLUME_RANGE_M).toBeLessThanOrEqual(3000);
    expect(skyriverVolumeRayLength({
      depthValid: true, isSky: true, surfaceDistanceM: 9000, farDistanceM: far,
    })).toBe(SKYRIVER_VOLUME_RANGE_M);
    // An invalid depth is the same case: nothing is known about where the surface is.
    expect(skyriverVolumeRayLength({
      depthValid: false, isSky: false, surfaceDistanceM: 300, farDistanceM: far,
    })).toBe(SKYRIVER_VOLUME_RANGE_M);
    expect(skyriverVolumeRayLength({
      depthValid: true, isSky: false, surfaceDistanceM: Number.NaN, farDistanceM: far,
    })).toBe(SKYRIVER_VOLUME_RANGE_M);
  });

  it('marches a valid opaque depth to the real surface, past the bounded range', () => {
    const far = 14000;
    // Nearer than the range: the surface, as before.
    expect(skyriverVolumeRayLength({
      depthValid: true, isSky: false, surfaceDistanceM: 420, farDistanceM: far,
    })).toBe(420);
    // Farther than the range: still the surface. The canyon loop is 12.8 km long and the far plane
    // is 14 km, so distant towers and impostor cards genuinely sit beyond 2.6 km.
    for (const surface of [2601, 6000, 12800]) {
      expect(skyriverVolumeRayLength({
        depthValid: true, isSky: false, surfaceDistanceM: surface, farDistanceM: far,
      })).toBe(surface);
    }
    // Only the camera's own far plane bounds it, measured along the same oblique ray.
    expect(skyriverVolumeRayLength({
      depthValid: true, isSky: false, surfaceDistanceM: 99000, farDistanceM: far,
    })).toBe(far);
    expect(skyriverVolumeRayLength({
      depthValid: true, isSky: false, surfaceDistanceM: -5, farDistanceM: far,
    })).toBe(0);
  });

  it('attenuates a 6 km opaque surface over the whole ray, not over the first 2.6 km', () => {
    // The truncation defect, in numbers. The staged opaque stage bypasses the shared analytic haze
    // AND the far card's own layer haze, so this march is the only absorption those pixels get.
    // Stopping at 2.6 km left the air from there to the surface doing nothing, and the pixel came
    // out LESS attenuated than the R22 analytic path it replaced.
    const surfaceM = 6000;
    const declared = {
      6: { averagedRelT: 1e-2, singlePhaseRelT: 0.25 },
      8: { averagedRelT: 5e-3, singlePhaseRelT: 0.2 },
      12: { averagedRelT: 2.5e-3, singlePhaseRelT: 0.12 },
    } as const;

    // Three real view rays: along the deck, level through the mid band, and descending from high.
    for (const view of [{ y0: 180, dy: -0.02 }, { y0: 900, dy: 0 }, { y0: 1200, dy: -0.12 }]) {
      const density = (s: number): number => skyriverVolumeDensity(view.y0 + view.dy * s);
      const averaged = (steps: number, rayLengthM: number): number => {
        let transmittance = 0;
        for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
          transmittance += skyriverIntegrateVolume({
            steps,
            rayLengthM,
            jitter: (phase + 0.5) / SKYRIVER_VOLUME_JITTER_PHASES,
            density,
            radiance: () => ZERO,
          }).transmittance / SKYRIVER_VOLUME_JITTER_PHASES;
        }
        return transmittance;
      };

      // The full-ray integral, at enough steps to be the reference for this length.
      const reference = averaged(1024, surfaceM);
      // What the truncated march produced: the first 2.6 km only.
      const truncated = averaged(1024, SKYRIVER_VOLUME_RANGE_M);

      const length = skyriverVolumeRayLength({
        depthValid: true, isSky: false, surfaceDistanceM: surfaceM, farDistanceM: 14000,
      });
      expect(length).toBe(surfaceM);

      for (const steps of [6, 8, 12] as const) {
        const bound = declared[steps];
        const staged = averaged(steps, length);
        // Equal to the full-ray integral, inside the declared step error.
        expect(Math.abs(staged - reference) / reference).toBeLessThan(bound.averagedRelT);
        // And NOT equal to the 2.6 km integral: that answer is 5x too transparent here.
        expect(truncated / reference).toBeGreaterThan(5);
        expect(Math.abs(staged - truncated) / reference).toBeGreaterThan(1);

        let worst = 0;
        for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
          const single = skyriverIntegrateVolume({
            steps,
            rayLengthM: length,
            jitter: (phase + 0.5) / SKYRIVER_VOLUME_JITTER_PHASES,
            density,
            radiance: () => ZERO,
          }).transmittance;
          worst = Math.max(worst, Math.abs(single - reference) / reference);
        }
        // The declared cost of keeping the step count fixed over a longer ray: a single-phase
        // frame carries more error far away than near. More steps buy it back monotonically.
        expect(worst).toBeLessThan(bound.singlePhaseRelT);
      }
    }
  });
});

describe('R23 bilateral upsample', () => {
  const near = 1;
  const far = 14000;
  /** depth01 for a view depth, inverted from the R20 conversion the shaders use. */
  const depthOf = (viewDepthM: number): number =>
    (far - (near * far) / viewDepthM) / (far - near);
  const sky = 1;

  /**
   * A volume history target, sampled the way the hardware samples one.
   *
   * `nearest` returns the texel a uv falls in. `linear` is the bilinear filter the target used to
   * carry, modelled exactly: it is what mixed up to four MARCHED samples into one tap. The fix has
   * to hold under either filter, because the tap uv is what decides whether a mix is possible.
   */
  function historyTarget(
    width: number,
    height: number,
    value: (texelX: number, texelY: number) => SkyriverVolumeSample,
  ): {
    readonly nearest: (u: number, v: number) => SkyriverVolumeSample;
    readonly linear: (u: number, v: number) => SkyriverVolumeSample;
  } {
    const clampX = (x: number): number => Math.min(Math.max(x, 0), width - 1);
    const clampY = (y: number): number => Math.min(Math.max(y, 0), height - 1);
    const nearest = (u: number, v: number): SkyriverVolumeSample =>
      value(clampX(Math.floor(u * width)), clampY(Math.floor(v * height)));
    const linear = (u: number, v: number): SkyriverVolumeSample => {
      const x = u * width - 0.5;
      const y = v * height - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const corners: readonly { readonly weight: number; readonly sample: SkyriverVolumeSample }[] = [
        { weight: (1 - fx) * (1 - fy), sample: value(clampX(x0), clampY(y0)) },
        { weight: fx * (1 - fy), sample: value(clampX(x0 + 1), clampY(y0)) },
        { weight: (1 - fx) * fy, sample: value(clampX(x0), clampY(y0 + 1)) },
        { weight: fx * fy, sample: value(clampX(x0 + 1), clampY(y0 + 1)) },
      ];
      const out: [number, number, number] = [0, 0, 0];
      let transmittance = 0;
      for (const corner of corners) {
        out[0] += corner.sample.scatter[0] * corner.weight;
        out[1] += corner.sample.scatter[1] * corner.weight;
        out[2] += corner.sample.scatter[2] * corner.weight;
        transmittance += corner.sample.transmittance * corner.weight;
      }
      return { scatter: out, transmittance };
    };
    return { nearest, linear };
  }

  it('fetches one marched texel per tap, at that texel\u2019s own centre', () => {
    // Every tap uv is a texel centre, so a tap is one marched sample under EITHER filter. The
    // earlier version offset the full-resolution uv by one volume texel, which lands between
    // centres: the linear fetch then averaged up to four samples before any depth test ran.
    for (const [width, height] of [[8, 8], [4, 4], [1, 1]] as const) {
      for (const texel of [[0, 0], [1, 2], [width - 1, height - 1]] as const) {
        const [u, v] = skyriverVolumeTexelUv(texel[0], texel[1], width, height);
        expect(Math.floor(u * width)).toBe(Math.min(texel[0], width - 1));
        expect(Math.floor(v * height)).toBe(Math.min(texel[1], height - 1));
        expect(u * width - Math.floor(u * width)).toBeCloseTo(0.5, 12);
        // At a centre, bilinear and nearest agree exactly: the other three corners get weight 0.
        const target = historyTarget(width, height, (x, y) => ({
          scatter: [x, y, x * y], transmittance: (x + y) / 32,
        }));
        expect(target.linear(u, v)).toEqual(target.nearest(u, v));
      }
      // Out of range clamps to the edge texel rather than wrapping to the far side.
      expect(skyriverVolumeTexelUv(-3, -3, width, height))
        .toEqual(skyriverVolumeTexelUv(0, 0, width, height));
      expect(skyriverVolumeTexelUv(width + 5, height + 5, width, height))
        .toEqual(skyriverVolumeTexelUv(width - 1, height - 1, width, height));
    }
  });

  it('gives a wall pixel nothing from a sky texel, at both tier scales and either filter', () => {
    // The measured leak: a controlled GPU probe returned 0.25 sky scatter in the LAST wall pixel,
    // where the wall value was zero.
    for (const scale of [0.5, 0.25]) {
      const volumeWidth = skyriverVolumeDimension(16, scale);
      const volumeHeight = skyriverVolumeDimension(16, scale);
      // A vertical silhouette: everything left of the middle is a wall at 300 m, the rest is sky.
      const wallEdgeU = 0.5;
      const depth01 = (u: number): number => (u < wallEdgeU ? depthOf(300) : sky);
      const target = historyTarget(volumeWidth, volumeHeight, (texelX, texelY) => {
        void texelY;
        const u = (texelX + 0.5) / volumeWidth;
        return u < wallEdgeU
          ? { scatter: [0, 0, 0], transmittance: 1 }
          : { scatter: [4, 4, 4], transmittance: 0.25 };
      });

      for (const filter of ['nearest', 'linear'] as const) {
        // The last full-resolution wall pixel before the edge.
        const resolved = skyriverBilateralResolve({
          uv: [wallEdgeU - 0.5 / 16, 0.5],
          volumeWidth,
          volumeHeight,
          depthValid: true,
          depth01: (u) => depth01(u),
          sample: target[filter],
          near,
          far,
          depthRejectM: 60,
        });
        expect(resolved.resolved.scatter).toEqual([0, 0, 0]);
        expect(resolved.resolved.transmittance).toBe(1);
        // The sky taps really were in the footprint, and really were rejected.
        const rejected = resolved.taps.filter((tap) => !tap.accepted);
        expect(rejected.length).toBeGreaterThan(0);
        for (const tap of rejected) expect(tap.depth01).toBe(sky);

        // And the mirror case: a sky pixel takes nothing from the wall.
        const skyPixel = skyriverBilateralResolve({
          uv: [wallEdgeU + 0.5 / 16, 0.5],
          volumeWidth,
          volumeHeight,
          depthValid: true,
          depth01: (u) => depth01(u),
          sample: target[filter],
          near,
          far,
          depthRejectM: 60,
        });
        expect(skyPixel.resolved.scatter).toEqual([4, 4, 4]);
        expect(skyPixel.resolved.transmittance).toBe(0.25);
      }
    }
  });

  it('rejects a near or far surface tap beyond the reject distance', () => {
    const volumeWidth = 8;
    const volumeHeight = 8;
    // A step in depth: 200 m on the left, 900 m on the right. 700 m apart, so 60 m rejects it.
    const depth01 = (u: number): number => (u < 0.5 ? depthOf(200) : depthOf(900));
    const target = historyTarget(volumeWidth, volumeHeight, (texelX, texelY) => ({
      scatter: [texelX + texelY * 10, 0, 0], transmittance: 0.5,
    }));
    const resolved = skyriverBilateralResolve({
      uv: [0.5 - 0.5 / 32, 0.5],
      volumeWidth,
      volumeHeight,
      depthValid: true,
      depth01: (u) => depth01(u),
      sample: target.nearest,
      near,
      far,
      depthRejectM: 60,
    });
    for (const tap of resolved.taps) {
      const [u] = skyriverVolumeTexelUv(tap.texelX, tap.texelY, volumeWidth, volumeHeight);
      // Accepted exactly when the tap sits on the same surface as the output pixel.
      expect(tap.accepted).toBe(u < 0.5);
    }
    // A tolerance wide enough to span the step accepts both sides: the test is the distance, not a
    // hard-coded set of taps.
    const wide = skyriverBilateralResolve({
      uv: [0.5 - 0.5 / 32, 0.5],
      volumeWidth,
      volumeHeight,
      depthValid: true,
      depth01: (u) => depth01(u),
      sample: target.nearest,
      near,
      far,
      depthRejectM: 2000,
    });
    expect(wide.taps.every((tap) => tap.accepted)).toBe(true);
  });

  it('weights an accepted footprint as a 1-2-4 tent and never divides by zero', () => {
    const flat = historyTarget(8, 8, () => ({ scatter: [1, 2, 3], transmittance: 0.75 }));
    const resolved = skyriverBilateralResolve({
      uv: [0.5, 0.5],
      volumeWidth: 8,
      volumeHeight: 8,
      depthValid: true,
      depth01: () => depthOf(500),
      sample: flat.nearest,
      near,
      far,
      depthRejectM: 60,
    });
    // 4 + 2 * 4 + 1 * 4 = 16, the full tent.
    expect(resolved.acceptedWeight).toBe(16);
    expect(resolved.resolved.scatter).toEqual([1, 2, 3]);
    expect(resolved.resolved.transmittance).toBe(0.75);
    expect(resolved.usedIdentityFallback).toBe(false);

    // No volume sample reaches this surface. Reject its foreign scatter and absorption.
    const isolated = skyriverBilateralResolve({
      uv: [0.5, 0.5],
      volumeWidth: 8,
      volumeHeight: 8,
      depthValid: true,
      // The output pixel sits on a surface no volume texel centre sampled.
      depth01: (u, v) => (u === 0.5 && v === 0.5 ? depthOf(100) : sky),
      sample: () => { throw new Error('A rejected sample must not be read'); },
      near,
      far,
      depthRejectM: 60,
    });
    expect(isolated.acceptedWeight).toBe(0);
    expect(isolated.usedIdentityFallback).toBe(true);
    expect(isolated.resolved.scatter).toEqual([0, 0, 0]);
    expect(isolated.resolved.transmittance).toBe(1);
  });

  it.each([0.5, 0.25])('keeps fog on continuous far walls at scale %s', (scale) => {
    const width = 1216;
    const focalPx = 1011;
    const wallDistance = 150;
    const density = 0.00025;
    for (const distance of [3000, 4000, 6000]) {
      for (let phase = 0; phase < 16; phase += 1) {
        const px = 300 + phase;
        const origin = px - focalPx * wallDistance / distance;
        const surface = (u: number) => focalPx * wallDistance / (u * width - origin);
        const resolved = skyriverBilateralResolve({
          uv: [px / width, 0.5], volumeWidth: width * scale, volumeHeight: 720 * scale,
          depthValid: true, depth01: (u) => depthOf(surface(u)),
          sample: (u) => ({ scatter: [0, 0, 0], transmittance: Math.exp(-density * surface(u)) }),
          near, far, depthRejectM: 60,
        });
        expect(resolved.usedIdentityFallback).toBe(false);
        expect(resolved.resolved.transmittance).toBeLessThan(1);
        expect(Math.abs(resolved.resolved.transmittance - Math.exp(-density * distance))).toBeLessThan(0.03);
      }
    }
  });

  it('accepts every tap when there is no valid depth to reject with', () => {
    const flat = historyTarget(4, 4, () => ({ scatter: [1, 1, 1], transmittance: 0.5 }));
    const resolved = skyriverBilateralResolve({
      uv: [0.5, 0.5],
      volumeWidth: 4,
      volumeHeight: 4,
      depthValid: false,
      depth01: () => sky,
      sample: flat.nearest,
      near,
      far,
      depthRejectM: 60,
    });
    expect(resolved.taps.every((tap) => tap.accepted)).toBe(true);
    // The pass never reaches this case in a composed frame: with no valid opaque depth it draws
    // nothing at all and the plan runs the legacy analytic path. See postChain.
    expect(resolved.acceptedWeight).toBe(16);
  });
});

describe('R23 history policy', () => {
  it('uses a time-based weight, so 30 and 60 FPS converge the same way', () => {
    const at60 = skyriverVolumeHistoryWeight(1 / 60);
    const at30 = skyriverVolumeHistoryWeight(1 / 30);
    expect(at60).toBeGreaterThan(0);
    expect(at60).toBeLessThan(1);
    expect(at30).toBeGreaterThan(at60);
    // Two 60 Hz frames must accumulate to the same retained fraction as one 30 Hz frame.
    expect((1 - at60) * (1 - at60)).toBeCloseTo(1 - at30, 12);
    expect(at60).toBeCloseTo(1 - Math.exp(-(1 / 60) / SKYRIVER_VOLUME_HISTORY_TAU_S), 12);
  });

  it('drops the history outright after a long pause instead of smearing it', () => {
    expect(skyriverVolumeHistoryWeight(SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S)).toBe(1);
    expect(skyriverVolumeHistoryWeight(5)).toBe(1);
    expect(skyriverVolumeHistoryWeight(0)).toBe(1);
    expect(skyriverVolumeHistoryWeight(-1)).toBe(1);
  });

  it('cannot see a pause through the integration clamp, so it must be given the wall delta', () => {
    // Why the pass takes `wallDeltaS` and not the frame pump's dt. The pump clamps its integration
    // delta so a backgrounded WebView cannot produce one giant step; that clamp is SMALLER than
    // the pause threshold, so a history policy fed the clamped value can never reach the weight-1
    // branch or the 'frame-pause' reset. Those were listed as guarantees while being unreachable
    // in the app, and only the tests' deltaS = 2 ever got there.
    expect(SKYRIVER_MAX_FRAME_DT_S).toBeLessThan(SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S);
    expect(skyriverVolumeHistoryWeight(SKYRIVER_MAX_FRAME_DT_S)).toBeLessThan(1);
    // A four-second tab switch, as the wall clock reports it and as the clamp would have reported it.
    const realPauseS = 4;
    expect(skyriverVolumeHistoryWeight(realPauseS)).toBe(1);
    expect(skyriverVolumeHistoryWeight(Math.min(realPauseS, SKYRIVER_MAX_FRAME_DT_S)))
      .toBeCloseTo(1 - Math.exp(-SKYRIVER_MAX_FRAME_DT_S / SKYRIVER_VOLUME_HISTORY_TAU_S), 12);
  });
});

describe('R23 reference accumulation blend', () => {
  it('sums the sixteen phases with ONE / ONE ADD on RGB and on alpha', () => {
    // The accumulation is a plain SUM of 16 pre-scaled phases, so every factor must be one.
    // THREE.AdditiveBlending is SRC_ALPHA / ONE here, because premultipliedAlpha is false: each
    // phase's RGB was multiplied by that phase's own scaled transmittance, and alpha — the
    // transmittance itself — was multiplied by itself. A constant-density GPU probe read reference
    // transmittance 0.0371 where the marched and analytic answers were both 0.7711.
    const blend = SKYRIVER_VOLUME_REFERENCE_BLEND;
    expect(blend.blending).toBe(THREE.CustomBlending);
    expect(blend.blendEquation).toBe(THREE.AddEquation);
    expect(blend.blendEquationAlpha).toBe(THREE.AddEquation);
    expect(blend.blendSrc).toBe(THREE.OneFactor);
    expect(blend.blendDst).toBe(THREE.OneFactor);
    expect(blend.blendSrcAlpha).toBe(THREE.OneFactor);
    expect(blend.blendDstAlpha).toBe(THREE.OneFactor);
    // Named in terms of the actual factors, not a blending-mode label.
    expect(blend.blendSrc).not.toBe(THREE.SrcAlphaFactor);
    expect(blend.blendSrcAlpha).not.toBe(THREE.SrcAlphaFactor);
  });

  it('averages a constant-density case back to the analytic transmittance', () => {
    // What a correct ONE / ONE sum must produce, and what the GPU readback has to match: the mean
    // of the 16 phase transmittances, each pre-scaled by 1/16. At constant density the step
    // recurrence telescopes, so every phase is the analytic answer and so is their mean.
    const density = 0.001;
    const rayLengthM = 260;
    let sum = 0;
    for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
      const result = skyriverIntegrateVolume({
        steps: SKYRIVER_VOLUME_REFERENCE_STEPS,
        rayLengthM,
        jitter: (phase + 0.5) / SKYRIVER_VOLUME_JITTER_PHASES,
        density: () => density,
        radiance: () => ZERO,
      });
      sum += result.transmittance / SKYRIVER_VOLUME_JITTER_PHASES;
    }
    expect(sum).toBeCloseTo(skyriverAnalyticTransmittance(density, rayLengthM), 12);
    expect(sum).toBeCloseTo(0.7711, 4);
    // The measured corruption, for the record: SRC_ALPHA / ONE squared each phase's alpha.
    let corrupted = 0;
    for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
      const scaled = skyriverAnalyticTransmittance(density, rayLengthM) / SKYRIVER_VOLUME_JITTER_PHASES;
      corrupted += scaled * scaled;
    }
    expect(corrupted).toBeLessThan(sum / 10);
  });
});

describe('R23 volume target sizing', () => {
  it('keeps every dimension at least one pixel, including odd and tiny buffers', () => {
    expect(skyriverVolumeDimension(1, 0.5)).toBe(1);
    expect(skyriverVolumeDimension(1, 0.25)).toBe(1);
    expect(skyriverVolumeDimension(3, 0.25)).toBe(1);
    expect(skyriverVolumeDimension(0, 0.5)).toBe(1);
    expect(skyriverVolumeDimension(Number.NaN, 0.5)).toBe(1);
    expect(skyriverVolumeDimension(-10, 0.5)).toBe(1);
  });

  it('halves and quarters the physical buffer, odd sizes included', () => {
    expect(skyriverVolumeDimension(2161, 0.5)).toBe(1080);
    expect(skyriverVolumeDimension(1215, 0.5)).toBe(607);
    expect(skyriverVolumeDimension(2161, 0.25)).toBe(540);
    // Half resolution is a quarter of the pixel count; quarter resolution is a sixteenth.
    const w = 1440;
    const h = 900;
    expect((skyriverVolumeDimension(w, 0.5) * skyriverVolumeDimension(h, 0.5)) / (w * h))
      .toBeCloseTo(0.25, 6);
    expect((skyriverVolumeDimension(w, 0.25) * skyriverVolumeDimension(h, 0.25)) / (w * h))
      .toBeCloseTo(0.0625, 6);
  });

  it('holds the requested tier profiles', () => {
    expect(SKYRIVER_VOLUME_PROFILES.high.spatialScale).toBe(0.5);
    expect(SKYRIVER_VOLUME_PROFILES.high.steps).toBeGreaterThanOrEqual(SKYRIVER_VOLUME_HIGH_STEPS_MIN);
    expect(SKYRIVER_VOLUME_PROFILES.high.steps).toBeLessThanOrEqual(SKYRIVER_VOLUME_HIGH_STEPS_MAX);
    expect(SKYRIVER_VOLUME_PROFILES.high.clouds).toBeGreaterThanOrEqual(SKYRIVER_SMOG_HIGH_MIN);
    expect(SKYRIVER_VOLUME_PROFILES.high.clouds).toBeLessThanOrEqual(SKYRIVER_SMOG_HIGH_MAX);
    expect(SKYRIVER_VOLUME_PROFILES.medium.spatialScale).toBe(0.25);
    expect(SKYRIVER_VOLUME_PROFILES.medium.steps).toBe(6);
    // Medium draws half the high cloud count.
    expect(SKYRIVER_VOLUME_PROFILES.medium.clouds * 2).toBe(SKYRIVER_VOLUME_PROFILES.high.clouds);
    // Low: volume and clouds off.
    expect(SKYRIVER_VOLUME_PROFILES.off.steps).toBe(0);
    expect(SKYRIVER_VOLUME_PROFILES.off.clouds).toBe(0);
  });
});

describe('R23 blue-noise tile', () => {
  it('is the verified offline input, byte for byte', () => {
    expect(SKYRIVER_BLUE_NOISE_WIDTH).toBe(64);
    expect(SKYRIVER_BLUE_NOISE_HEIGHT).toBe(64);
    expect(SKYRIVER_BLUE_NOISE_BYTES.length).toBe(64 * 64);
    expect(SKYRIVER_BLUE_NOISE_SHA256)
      .toBe('eacd51e51588466d345792c3105c6bb89e0ec81b30bfc26d033ce99bd6b6c602');
  });

  it('is a rank map: every byte value appears the same number of times', () => {
    const histogram = new Int32Array(256);
    for (const byte of SKYRIVER_BLUE_NOISE_BYTES) histogram[byte] += 1;
    for (let value = 0; value < 256; value += 1) {
      expect(histogram[value]).toBe(SKYRIVER_BLUE_NOISE_BIN_COUNT);
    }
    expect(SKYRIVER_BLUE_NOISE_BIN_COUNT).toBe(16);
  });

  it('converts a sampled red channel to byte-centred jitter strictly inside its interval', () => {
    expect(skyriverBlueNoiseJitterFromByte(0)).toBeCloseTo(0.5 / 256, 12);
    expect(skyriverBlueNoiseJitterFromByte(255)).toBeCloseTo(255 / 256 + 0.5 / 256, 12);
    for (let byte = 0; byte <= 255; byte += 1) {
      const jitter = skyriverBlueNoiseJitterFromByte(byte);
      expect(jitter).toBeGreaterThan(0);
      expect(jitter).toBeLessThan(1);
    }
    expect(skyriverBlueNoiseJitter(0.5)).toBeCloseTo(0.5 * (255 / 256) + 0.5 / 256, 12);
  });

  it('stratifies into the sixteen fixed jitter phases the reference averages', () => {
    expect(SKYRIVER_VOLUME_JITTER_PHASES).toBe(16);
    expect(SKYRIVER_VOLUME_REFERENCE_STEPS).toBe(128);
    // Every phase offset lands the sample in its own stratum of the unit interval.
    const strata = new Set<number>();
    for (let phase = 0; phase < SKYRIVER_VOLUME_JITTER_PHASES; phase += 1) {
      const offset = phase / SKYRIVER_VOLUME_JITTER_PHASES;
      strata.add(Math.floor(offset * SKYRIVER_VOLUME_JITTER_PHASES));
    }
    expect(strata.size).toBe(SKYRIVER_VOLUME_JITTER_PHASES);
  });
});

describe('R23 smog records', () => {
  const clouds = skyriverBuildSmogClouds(11, SKYRIVER_VOLUME_PROFILES.high.clouds);

  it('is seeded and pure: the same seed and count rebuild the same records', () => {
    const again = skyriverBuildSmogClouds(11, SKYRIVER_VOLUME_PROFILES.high.clouds);
    expect(again).toEqual(clouds);
    const different = skyriverBuildSmogClouds(12, SKYRIVER_VOLUME_PROFILES.high.clouds);
    expect(different[0]!.centre).not.toEqual(clouds[0]!.centre);
  });

  it('keeps a count inside the requested 200-400 band on high, and half of it on medium', () => {
    expect(clouds.length).toBeGreaterThanOrEqual(SKYRIVER_SMOG_HIGH_MIN);
    expect(clouds.length).toBeLessThanOrEqual(SKYRIVER_SMOG_HIGH_MAX);
    expect(SKYRIVER_VOLUME_PROFILES.medium.clouds).toBe(Math.round(clouds.length / 2));
  });

  it('puts most clouds above the low deck and keeps a thinner middle band', () => {
    const counts = SKYRIVER_SMOG_BANDS.map(() => 0);
    for (const cloud of clouds) counts[cloud.band] += 1;
    // The deck layer is the largest share, and every band is actually populated.
    expect(counts[0]).toBeGreaterThan(counts[1]!);
    expect(counts[1]).toBeGreaterThan(counts[2]!);
    for (const count of counts) expect(count).toBeGreaterThan(0);
    for (const cloud of clouds) {
      const band = SKYRIVER_SMOG_BANDS[cloud.band]!;
      expect(cloud.centre[1]).toBeGreaterThanOrEqual(band.minY);
      expect(cloud.centre[1]).toBeLessThanOrEqual(band.maxY);
    }
  });

  it('varies ellipsoid sizes and never lays out an evenly spaced horizontal row', () => {
    // Equally spaced clouds at one altitude read as a road surface. Two guards: the gaps between
    // consecutive sorted positions within a band must vary, and the sizes must not be uniform.
    const sizes = clouds.map((cloud) => cloud.size[0]);
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeGreaterThan(2);

    const deck = clouds.filter((cloud) => cloud.band === 0).map((cloud) => cloud.centre[2]).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < deck.length; i += 1) gaps.push(deck[i]! - deck[i - 1]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const spread = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length);
    // A regular row would have near-zero spread relative to its mean gap.
    expect(spread / mean).toBeGreaterThan(0.5);

    // Altitudes inside a band must not collapse onto one plane either.
    const deckY = clouds.filter((cloud) => cloud.band === 0).map((cloud) => cloud.centre[1]);
    expect(Math.max(...deckY) - Math.min(...deckY)).toBeGreaterThan(300);
  });

  it('drifts on a pure, bounded, periodic world-space path', () => {
    const cloud = clouds[7]!;
    const out: [number, number, number] = [0, 0, 0];
    const at0 = [...skyriverSmogCentreAt(cloud, 0, out)] as [number, number, number];
    const atPeriod = [...skyriverSmogCentreAt(cloud, cloud.driftPeriodS, out)] as [number, number, number];
    // Periodic: one full period returns the cloud to where it started, with no accumulated error.
    for (let axis = 0; axis < 3; axis += 1) expect(atPeriod[axis]).toBeCloseTo(at0[axis], 6);

    // Pure: the same time always gives the same centre.
    const repeat = [...skyriverSmogCentreAt(cloud, 61.25, out)] as [number, number, number];
    expect([...skyriverSmogCentreAt(cloud, 61.25, out)]).toEqual(repeat);

    // Actually moves, and stays inside the bound this cloud's own rate and period allow.
    const travelBound = (cloud.driftMps * cloud.driftPeriodS) / (Math.PI * 2);
    let moved = 0;
    for (const t of [10, 30, 60, 120, 200]) {
      const centre = skyriverSmogCentreAt(cloud, t, out);
      const distance = Math.hypot(centre[0] - at0[0], centre[1] - at0[1], centre[2] - at0[2]);
      moved = Math.max(moved, distance);
      expect(distance).toBeLessThanOrEqual(2 * travelBound + 1e-6);
    }
    expect(moved).toBeGreaterThan(10);
  });

  it('keeps a frozen frame frozen: no drift at all without a time change', () => {
    const out: [number, number, number] = [0, 0, 0];
    for (const cloud of clouds.slice(0, 20)) {
      const a = [...skyriverSmogCentreAt(cloud, 42, out)];
      const b = [...skyriverSmogCentreAt(cloud, 42, out)];
      expect(a).toEqual(b);
    }
  });
});

describe('R23 post chain shape', () => {
  it('replaces thirteen bloom draws with nine, at three levels', () => {
    expect(SKYRIVER_BLOOM_MIPS).toBe(3);
    expect(SKYRIVER_BLOOM_DRAWS).toBe(1 + SKYRIVER_BLOOM_MIPS * 2 + 1 + 1);
    expect(SKYRIVER_BLOOM_DRAWS).toBe(9);
    expect(SKYRIVER_LEGACY_BLOOM_MIPS).toBe(5);
    expect(SKYRIVER_LEGACY_BLOOM_DRAWS).toBe(1 + SKYRIVER_LEGACY_BLOOM_MIPS * 2 + 1 + 1);
    expect(SKYRIVER_LEGACY_BLOOM_DRAWS).toBe(13);
    expect(SKYRIVER_BLOOM_KERNELS).toEqual([3, 5, 7]);
    // The first three of three's own weights, not renormalised to the five-level energy: that
    // would be a guess, and the halo proof is what calibrates them.
    expect(SKYRIVER_BLOOM_FACTORS).toEqual([1.0, 0.8, 0.6]);
  });

  it('adds exactly two volume draws per normal frame', () => {
    expect(SKYRIVER_VOLUME_NORMAL_DRAWS).toBe(2);
  });

  it('adds the staged high frame budget up to 31: an estimate the browser must confirm', () => {
    // This is ARITHMETIC over the declared budget constants: 18 existing scene draws at high + 1
    // smog + 2 volume + 9 bloom + 1 output = 31. It shows the budget is self-consistent and nothing
    // more. The acceptance evidence is `renderer.info.render.calls` from a real browser frame — a
    // sum of constants in node cannot count a draw a GPU made.
    const sceneDraws = 18;
    const smogDraws = 1;
    const total = sceneDraws + smogDraws + SKYRIVER_VOLUME_NORMAL_DRAWS + SKYRIVER_BLOOM_DRAWS + 1;
    expect(total).toBe(31);
    expect(total).toBeLessThanOrEqual(32);
    // The legacy chain is exactly at the ceiling, which is why the bloom had to shrink.
    expect(sceneDraws + SKYRIVER_LEGACY_BLOOM_DRAWS + 1).toBe(32);
  });

  it('fingerprints shader source so a reference run can be tied to the normal integrator', () => {
    const a = skyriverShaderFingerprint('void main() {}');
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(skyriverShaderFingerprint('void main() {}')).toBe(a);
    expect(skyriverShaderFingerprint('void main() { }')).not.toBe(a);
  });
});

// --- the held district tint the marcher scatters in (R23 repair) --------------------------------

describe('R23 district fog profile', () => {
  it('is built from the held R22 haze tint, not from a fresh district sample', () => {
    const held = skyriverHeldHazeTint();
    skyriverWriteHeldHazeTint(held, true, 3, 0.94, 1.0, 1.07, 90, 3);
    const profile = skyriverDistrictFogProfileFrom(held);
    expect(profile.id).toBe('district:3');
    expect(profile.tintLinear).toEqual([0.94, 1.0, 1.07]);
    expect(profile.scatterScale).toBe(1);
    // The deck term is the R22 field's own, not a new ambient floor.
    expect(profile.deckGlowLinear).toEqual([0.0083, 0.0079, 0.0086]);
    expect(profile.deckGlowHeightM).toBe(40);
  });

  it('copies the channels out, so a later refresh cannot mutate a profile already bound', () => {
    const held = skyriverHeldHazeTint();
    skyriverWriteHeldHazeTint(held, true, 1, 0.9, 1, 1.1, 30, 1);
    const profile = skyriverDistrictFogProfileFrom(held);
    skyriverWriteHeldHazeTint(held, true, 1, 0.5, 0.5, 0.5, 60, 2);
    expect(profile.tintLinear).toEqual([0.9, 1, 1.1]);
  });

  it('is neutral and single-identity while the district colour is off', () => {
    // With the colour off there is no district air: the tint is neutral, so the profile must not
    // change as the route crosses a boundary, and it must not reset the volume history either.
    const held = skyriverHeldHazeTint();
    const off = skyriverDistrictFogProfileFrom(held);
    expect(off.id).toBe('district:colour-off');
    expect(off.tintLinear).toEqual([1, 1, 1]);
    skyriverWriteHeldHazeTint(held, false, -1, 1, 1, 1, Number.NaN, Number.NaN);
    expect(skyriverDistrictFogProfileFrom(held).id).toBe('district:colour-off');
  });

  it('is pure: the same held record always builds the same profile', () => {
    const held = skyriverHeldHazeTint();
    skyriverWriteHeldHazeTint(held, true, 4, 1.02, 0.99, 0.97, 300, 10);
    expect(skyriverDistrictFogProfileFrom(held)).toEqual(skyriverDistrictFogProfileFrom(held));
  });
});

// --- canyon-aligned, per-band smog drift (R23 repair) -------------------------------------------

describe('R23 smog drift', () => {
  const clouds = skyriverBuildSmogClouds(11, SKYRIVER_VOLUME_PROFILES.high.clouds);

  it('gives the thinner middle band a modestly faster rate than the deck and high bands', () => {
    expect(SKYRIVER_SMOG_BANDS[1]!.driftMps).toBe(SKYRIVER_SMOG_MIDDLE_DRIFT_MPS);
    expect(SKYRIVER_SMOG_BANDS[1]!.driftPeriodS).toBe(SKYRIVER_SMOG_MIDDLE_DRIFT_PERIOD_S);
    expect(SKYRIVER_SMOG_BANDS[0]!.driftMps).toBe(SKYRIVER_SMOG_DRIFT_MPS);
    expect(SKYRIVER_SMOG_BANDS[2]!.driftMps).toBe(SKYRIVER_SMOG_DRIFT_MPS);
    // Modestly faster: enough to separate in parallax, not a different kind of motion.
    const ratio = SKYRIVER_SMOG_BANDS[1]!.driftMps / SKYRIVER_SMOG_BANDS[0]!.driftMps;
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(2);
    // Its own period, so the two bands do not slide in lockstep.
    expect(SKYRIVER_SMOG_BANDS[1]!.driftPeriodS).not.toBe(SKYRIVER_SMOG_BANDS[0]!.driftPeriodS);
    // Every band is still slow weather: a bounded excursion of a few hundred metres at most.
    for (const band of SKYRIVER_SMOG_BANDS) {
      expect((band.driftMps * band.driftPeriodS) / (Math.PI * 2)).toBeLessThan(200);
    }
  });

  it('carries the band rate on every cloud record', () => {
    for (const cloud of clouds) {
      const band = SKYRIVER_SMOG_BANDS[cloud.band]!;
      expect(cloud.driftMps).toBe(band.driftMps);
      expect(cloud.driftPeriodS).toBe(band.driftPeriodS);
    }
  });

  it('separates the middle band from the deck layer at the same moment', () => {
    // The point of the faster rate: at a shared time the two bands are not at the same phase of the
    // same path, so they cross instead of moving as one sheet.
    const out: [number, number, number] = [0, 0, 0];
    const speedAt = (cloud: typeof clouds[number], timeS: number): number => {
      const step = 0.05;
      const a = [...skyriverSmogCentreAt(cloud, timeS, out)] as [number, number, number];
      const b = [...skyriverSmogCentreAt(cloud, timeS + step, out)] as [number, number, number];
      return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step;
    };
    const peak = (band: number): number => {
      let worst = 0;
      for (const cloud of clouds.filter((entry) => entry.band === band)) {
        for (const t of [0, 10, 30, 60, 120, 240]) worst = Math.max(worst, speedAt(cloud, t));
      }
      return worst;
    };
    // The fastest the middle band ever moves is the band's own rate, above the deck band's.
    expect(peak(1)).toBeGreaterThan(peak(0) * 1.2);
    expect(peak(1)).toBeLessThanOrEqual(SKYRIVER_SMOG_MIDDLE_DRIFT_MPS + 1e-6);
    expect(peak(0)).toBeLessThanOrEqual(SKYRIVER_SMOG_DRIFT_MPS + 1e-6);
  });

  it('drifts along the canyon at each seeded centre, not along a world compass angle', () => {
    // The drift axis must sit near the corridor's own direction at the cloud's OWN v. Comparing
    // against the best-matching v anywhere on the loop would prove nothing: the loop's heading
    // turns a full lap, so every direction is parallel to the corridor somewhere.
    const along = { x: 0, z: 0 };
    const lean = Math.hypot(1, SKYRIVER_SMOG_DRIFT_ACROSS_LEAN);
    const cosines: number[] = [];
    for (const cloud of clouds) {
      warpDirection(0, 1, canyonHeading(cloud.routeV), along);
      const horizontal = Math.hypot(cloud.drift[0], cloud.drift[2]);
      const cosine = Math.abs((cloud.drift[0] * along.x + cloud.drift[2] * along.z) / horizontal);
      cosines.push(cosine);
    }
    // Every cloud, not just most: the worst alignment is still inside the declared lean.
    expect(Math.min(...cosines)).toBeGreaterThan(1 / lean - 1e-6);
    // Both directions along the corridor are used, so a band is not one conveyor belt.
    const signed = clouds.map((cloud) => {
      warpDirection(0, 1, canyonHeading(cloud.routeV), along);
      return Math.sign(cloud.drift[0] * along.x + cloud.drift[2] * along.z);
    });
    expect(signed.filter((sign) => sign > 0).length).toBeGreaterThan(0);
    expect(signed.filter((sign) => sign < 0).length).toBeGreaterThan(0);
    // And the lean is really present: a perfectly parallel axis every time would mean the across
    // term was dropped.
    expect(Math.min(...cosines)).toBeLessThan(1);
    // The vertical component is the small declared rise lean, never the main axis.
    for (const cloud of clouds) expect(Math.abs(cloud.drift[1])).toBeLessThan(0.17);
    // Unit axes.
    for (const cloud of clouds) {
      expect(Math.hypot(cloud.drift[0], cloud.drift[1], cloud.drift[2])).toBeCloseTo(1, 10);
    }
  });

  it('runs both halves of the drift off the same record, with no rate uniform left', () => {
    // The vertex shader reads the rate per instance, so the CPU twin and the GPU path cannot hold
    // two different speeds. A uniform would be a second place to set one.
    expect(SKYRIVER_SMOG_VERTEX_SOURCE).toContain('attribute vec2 aDriftRate;');
    expect(SKYRIVER_SMOG_VERTEX_SOURCE)
      .toContain('float angle = ( uTime / aDriftRate.y ) * 6.2831853 + aPhaseSeed.x;');
    expect(SKYRIVER_SMOG_VERTEX_SOURCE)
      .toContain('float travel = sin( angle ) * aDriftRate.x * aDriftRate.y / 6.2831853;');
    expect(SKYRIVER_SMOG_VERTEX_SOURCE).not.toContain('uDriftSpeed');
    expect(SKYRIVER_SMOG_VERTEX_SOURCE).not.toContain('uDriftPeriod');
  });

  it('stays pure, periodic and accumulator-free per band', () => {
    const out: [number, number, number] = [0, 0, 0];
    for (const band of [0, 1, 2]) {
      const cloud = clouds.find((entry) => entry.band === band)!;
      const at0 = [...skyriverSmogCentreAt(cloud, 0, out)] as [number, number, number];
      for (const laps of [1, 2, 7]) {
        const back = skyriverSmogCentreAt(cloud, cloud.driftPeriodS * laps, out);
        for (let axis = 0; axis < 3; axis += 1) expect(back[axis]).toBeCloseTo(at0[axis], 6);
      }
      // A frozen frame does not drift, whichever band it is.
      expect([...skyriverSmogCentreAt(cloud, 42, out)])
        .toEqual([...skyriverSmogCentreAt(cloud, 42, out)]);
    }
  });
});
