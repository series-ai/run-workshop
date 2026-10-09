/** Pure traffic continuity checks. Runtime wiring is in trafficTierContinuity.test.ts. */
import { describe, expect, it } from 'vitest';
import {
  IMPOSTOR_LIGHT_HANDOVER_BAND_M, IMPOSTOR_FAR_FALLOFF_BAND_M,
  writeSameCarLightLod, hullLodAlpha, farImpostorBrightness,
} from '../src/render/lightHandover';
import {
  FLYER_HANDOVER_STEP_LIMIT, FLYER_MATRIX_DISTANCES, FLYER_MATRIX_STEP_M,
  FLYER_RESIDUAL_STEP_LIMIT, inverseDepthResidual, normalizedStep,
} from './support/flyerContinuityProjection';

function sampleDistanceShares(distanceM: number, presence: number) {
  const lod = writeSameCarLightLod(distanceM, presence, 1);
  return { ...lod, hull: hullLodAlpha(distanceM) };
}
function sumError(near: number, far: number, target: number): number {
  return Math.abs(near + far - target);
}
function boundaryError(fn: (x: number) => number, edge: number, epsilon = 1e-3): number {
  return Math.abs(fn(edge + epsilon) - fn(edge - epsilon));
}
function slopeError(fn: (x: number) => number, edge: number, h = 0.02): number {
  return Math.abs((fn(edge) - fn(edge - h)) / h - (fn(edge + h) - fn(edge)) / h);
}

describe('flyer continuity: pure share and boundary controls', () => {
  it('keeps the same-car sum and 25m handover rate at every sampled distance', () => {
    const [start, end] = IMPOSTOR_LIGHT_HANDOVER_BAND_M;
    const mathematicalShareBound = 1.5 * FLYER_MATRIX_STEP_M / (end - start);
    expect(mathematicalShareBound).toBeLessThan(FLYER_HANDOVER_STEP_LIMIT);
    for (const presence of [0, 0.5, 1]) {
      let previous = sampleDistanceShares(FLYER_MATRIX_DISTANCES[0]!, presence);
      for (const distance of FLYER_MATRIX_DISTANCES) {
        const current = sampleDistanceShares(distance, presence);
        expect(sumError(current.nearAlpha, current.impostorAlpha, current.totalAlpha)).toBeLessThan(1e-12);
        if (distance >= start && distance <= end + FLYER_MATRIX_STEP_M) {
          expect(Math.abs(current.nearAlpha - previous.nearAlpha)).toBeLessThanOrEqual(mathematicalShareBound + 1e-12);
          expect(current.totalAlpha).toBe(1);
        }
        expect(current.totalAlpha).toBeGreaterThan(0);
        previous = current;
      }
    }
  });

  it('has continuous values and slopes at both handover and far-fade edges', () => {
    const functions = [hullLodAlpha, farImpostorBrightness,
      (d: number) => sampleDistanceShares(d, 1).nearAlpha,
      (d: number) => sampleDistanceShares(d, 1).impostorAlpha];
    for (const edge of [...IMPOSTOR_LIGHT_HANDOVER_BAND_M, ...IMPOSTOR_FAR_FALLOFF_BAND_M]) {
      for (const fn of functions) {
        expect(boundaryError(fn, edge)).toBeLessThan(1e-6);
        expect(slopeError(fn, edge)).toBeLessThan(5e-6);
      }
    }
  });

  it('rejects injected mismatched bands, size jumps, and brightness steps', () => {
    const [start, end] = IMPOSTOR_LIGHT_HANDOVER_BAND_M;
    const midpoint = (start + end) / 2;
    const actual = sampleDistanceShares(midpoint, 1);
    const delayedNear = hullLodAlpha(midpoint - 100);
    expect(sumError(delayedNear, actual.impostorAlpha, 1)).toBeGreaterThan(0.25);
    expect(inverseDepthResidual(4, 4 * 1080 / 1105 * 1.5, 1080, 1105)).toBeGreaterThan(FLYER_RESIDUAL_STEP_LIMIT);
    expect(normalizedStep(1, 0.6, 1)).toBeGreaterThan(FLYER_HANDOVER_STEP_LIMIT);
    expect(boundaryError(d => d < midpoint ? 1 : 0.8, midpoint)).toBeGreaterThan(1e-6);
    expect(inverseDepthResidual(6, 4, 50, 75)).toBeLessThan(1e-12);
    expect(normalizedStep(0, 0.1, 1)).toBe(0.1);
  });
});

import { TRAFFIC_APPEARANCE_PROFILES, TRAFFIC_LAMP_HEAD_FACING_BAND, TRAFFIC_LAMP_TAIL_FACING_BAND,
  TRAFFIC_TRAIL_FAR_FADE_BAND_M } from '../src/render/trafficAppearance';
import { projectTrafficLampKernel } from '../src/render/trafficAppearanceModel';
import {
  continuityProfile, continuityRow, continuityInput, continuityViolations, appearanceMetrics,
} from './support/flyerContinuityMatrix';
import {
  FLYER_MATRIX_DPRS, FLYER_MATRIX_FACINGS, FLYER_MATRIX_TIERS,
} from './support/flyerContinuityProjection';

const cases = TRAFFIC_APPEARANCE_PROFILES.flatMap((profile, type) => FLYER_MATRIX_DPRS.flatMap(dpr =>
  FLYER_MATRIX_FACINGS.flatMap(facing => FLYER_MATRIX_TIERS.map(tier => ({ name: profile.name, type, dpr, facing, tier })))));

describe('flyer continuity: full pure distance matrix', () => {
  it.each(cases)('$name DPR$dpr facing$facing $tier: all 159 distance cells', ({ type, dpr, facing, tier }) => {
    const rows = continuityProfile(type, dpr, facing, tier);
    expect(rows).toHaveLength(FLYER_MATRIX_DISTANCES.length);
    expect(continuityViolations(rows)).toEqual([]);
  });

  it('covers the low-tier thin-car fade without treating its zero target as a gap', () => {
    for (const dpr of FLYER_MATRIX_DPRS) {
      for (let type = 0; type < TRAFFIC_APPEARANCE_PROFILES.length; type += 1) {
        expect(continuityViolations(continuityProfile(type, dpr, 180, 'low', true))).toEqual([]);
      }
    }
  });

  it('rejects real evaluator output mutations through the same matrix acceptance path', () => {
    const rows = continuityProfile(0, 1, 0, 'high');
    const at = rows.findIndex(row => row.distanceM === 1200);
    const row = rows[at]!;
    expect(continuityViolations(rows)).toEqual([]);
    const wrongSize = { ...row, head: { ...row.head,
      floorHalfSizeCssPx: [row.head.floorHalfSizeCssPx[0] * 1.5, row.head.floorHalfSizeCssPx[1]] as const } };
    const sizeRows = rows.map((value, i) => i === at ? wrongSize : value);
    expect(continuityViolations(sizeRows).some(v => v.channel === 'head projected width')).toBe(true);
    const light = row.output.streak.head.renderedContinuousEnergyRgb;
    const badOutput = { ...row.output, streak: { ...row.output.streak, head: { ...row.output.streak.head,
      renderedContinuousEnergyRgb: { r: light.r * 0.5, g: light.g * 0.5, b: light.b * 0.5 } } } };
    const wrongLight = { ...row, output: badOutput, metrics: appearanceMetrics(badOutput,
      2 * (row.head.floorHalfSizeCssPx[0] + row.head.pairHalfSpanCssPx), 2 * row.head.floorHalfSizeCssPx[1],
      2 * (row.tail.floorHalfSizeCssPx[0] + row.tail.pairHalfSpanCssPx), 2 * row.tail.floorHalfSizeCssPx[1]) };
    expect(continuityViolations(rows.map((value, i) => i === at ? wrongLight : value))
      .some(v => v.channel === 'head pipeline energy')).toBe(true);
    const wrongBand = continuityRow({ ...row.input, distanceM: row.distanceM - 100 });
    const wrongAssignment = { ...row, output: wrongBand.output };
    expect(continuityViolations(rows.map((value, i) => i === at ? wrongAssignment : value))
      .some(v => v.channel === 'near handover assignment')).toBe(true);
  });

  it('keeps physical front and rear source centres fixed across each facing-curve endpoint', () => {
    for (let type = 0; type < TRAFFIC_APPEARANCE_PROFILES.length; type += 1) {
      for (const head of [true, false]) {
        const targets = head ? TRAFFIC_LAMP_HEAD_FACING_BAND : TRAFFIC_LAMP_TAIL_FACING_BAND.map(v => -v);
        for (const target of targets) {
          let lo = 0, hi = 180;
          const kernel = (angle: number) => {
            const input = continuityInput(type, 1.25, angle, 'high', 500);
            return projectTrafficLampKernel({ position: input.position, direction: input.direction,
              bankRadians: input.bankRadians, typeIndex: type, physicalScale: input.sizeScale,
              side: head ? 'head' : 'tail', camera: input.camera });
          };
          for (let iteration = 0; iteration < 60; iteration += 1) {
            const mid = (lo + hi) / 2;
            if (kernel(mid).facing > target) lo = mid; else hi = mid;
          }
          const before = kernel((lo + hi) / 2 - 1e-5), after = kernel((lo + hi) / 2 + 1e-5);
          expect(after.lampWorld).toEqual(before.lampWorld);
          expect(Math.abs(after.facingGain - before.facingGain)).toBeLessThan(1e-8);
          expect(Math.abs(after.facing - target)).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe('flyer continuity: full pipeline boundary values', () => {
  it('has C0 and C1 combined-energy limits at smooth handover and far-fade edges', () => {
    const h = 0.02;
    for (const { type, dpr, facing, tier } of cases) {
      for (const edge of [...IMPOSTOR_LIGHT_HANDOVER_BAND_M, ...IMPOSTOR_FAR_FALLOFF_BAND_M, ...TRAFFIC_TRAIL_FAR_FADE_BAND_M]) {
        const before = continuityRow(continuityInput(type, dpr, facing, tier, edge - h));
        const center = continuityRow(continuityInput(type, dpr, facing, tier, edge));
        const after = continuityRow(continuityInput(type, dpr, facing, tier, edge + h));
        const scale = Math.max(before.metrics.energyY, center.metrics.energyY, after.metrics.energyY, 1);
        const valueDelta = Math.abs(after.metrics.energyY - before.metrics.energyY) / scale;
        const slopeDelta = Math.abs((center.metrics.energyY - before.metrics.energyY) / h
          - (after.metrics.energyY - center.metrics.energyY) / h) / scale;
        expect(valueDelta).toBeLessThan(1e-3);
        expect(slopeDelta).toBeLessThan(1e-4);
      }
    }
  });
});

import { gpuFacingCutoff, cpuTrailCutoff, continuityMetrics } from './support/flyerContinuityMatrix';
import { TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF, TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF } from '../src/render/trafficAppearance';

describe('flyer continuity: positive source cutoffs and whole evaluator faults', () => {
  it('bounds each positive GPU facing cutoff in absolute and full-source units', () => {
    for (let type = 0; type < TRAFFIC_APPEARANCE_PROFILES.length; type += 1) {
      for (const dpr of FLYER_MATRIX_DPRS) for (const head of [true, false]) {
        const result = gpuFacingCutoff(type, dpr, head);
        expect(result.below.clippedByIntensityCutoff).toBe(true);
        expect(result.above.clippedByIntensityCutoff).toBe(false);
        expect(result.jumpY).toBeGreaterThan(0);
        expect(result.sourceNormalizedJump).toBeLessThan(TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF + 1e-8);
        expect(result.sourceNormalizedJump).toBeLessThan(FLYER_RESIDUAL_STEP_LIMIT);
      }
    }
  });
  it('bounds the positive CPU trail cutoff without naming its jump zero', () => {
    for (let type = 0; type < TRAFFIC_APPEARANCE_PROFILES.length; type += 1) for (const dpr of FLYER_MATRIX_DPRS) {
      const result = cpuTrailCutoff(type, dpr);
      expect(result.below.clippedByAttributeCutoff).toBe(true);
      expect(result.above.clippedByAttributeCutoff).toBe(false);
      expect(result.jumpY).toBeGreaterThan(0);
      expect(result.sourceNormalizedJump).toBeLessThan(TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF + 1e-8);
      expect(result.sourceNormalizedJump).toBeLessThan(FLYER_RESIDUAL_STEP_LIMIT);
    }
  });
  it('rejects a discontinuity inside an actual evaluator, using the same transport oracle', () => {
    const rows = continuityProfile(0, 1, 0, 'high');
    const faulty = (input: Parameters<typeof continuityMetrics>[0]) => {
      const result = continuityMetrics(input);
      return input.distanceM >= 1200 ? { ...result, energyY: result.energyY * 0.6,
        sizeIntensity: result.sizeIntensity * 0.6, sizeCssPx: result.sizeCssPx * 1.5 } : result;
    };
    const mutated = rows.map(row => ({ ...row, metrics: faulty(row.input) }));
    const failures = continuityViolations(mutated, faulty);
    expect(failures.some(v => v.channel.startsWith('combined smooth-transport residual'))).toBe(true);
  });
});

import { cpuTemporalFailures, trailTemporalFailures, appearanceRetargetFailures } from './support/flyerContinuityTemporal';

describe('flyer continuity: captured temporal state', () => {
  it('keeps every tier retarget continuous through the full 1.2s count progression', () => {
    expect(cpuTemporalFailures()).toEqual([]);
  });
  it('keeps captured trail coefficients on the live class and distance response', () => {
    expect(trailTemporalFailures()).toEqual([]);
  });
  it('keeps full same-car appearance at the retarget instant, including low thin-far cars', () => {
    expect(appearanceRetargetFailures()).toEqual([]);
  });
  it('rejects positive emission at the declared zero-alpha low-tier endpoint', () => {
    const rows = continuityProfile(0, 1.25, 180, 'low', true);
    const at = rows.findIndex(row => row.distanceM === 1150), row = rows[at]!;
    expect(row.output.lod.totalAlpha).toBe(0);
    const faulty = { ...row, metrics: { ...row.metrics, energyY: 1 } };
    expect(continuityViolations(rows.map((value, i) => i === at ? faulty : value))
      .some(failure => failure.channel === 'emission after declared complete fade')).toBe(true);
  });
});
