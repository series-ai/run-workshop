import {
  TRAFFIC_QUALITY_SETTINGS, TRAFFIC_TRAIL_NEAR_FADE_BAND_M,
  trafficTrailModeWeights, trafficTrailWeightFromModeWeights,
} from '../../src/render/trafficAppearance';
import {
  evaluateCpuTierFade, evaluateSameCarTrafficAppearance, evaluateTrailModeFade,
} from '../../src/render/trafficAppearanceModel';
import { IMPOSTOR_TIER_FADE_S } from '../../src/render/lightHandover';
import { continuityInput, appearanceMetrics, independentSmoothstep, shippedHullResponse } from './flyerContinuityMatrix';
import { projectTrafficLampKernel } from '../../src/render/trafficAppearanceModel';
import type { TrafficTrailMode } from '../../src/render/trafficTypes';

const tiers = ['high', 'medium', 'low'] as const;
const modes = ['all', 'streams', 'near'] as const;
const progressSamples = [0, 0.25, 0.5, 0.75, 1];
const frames = Math.round(IMPOSTOR_TIER_FADE_S * 30);
export interface TemporalFailure { readonly channel: string; readonly error: number; readonly limit: number; }

export function cpuTemporalFailures(): TemporalFailure[] {
  const errors: TemporalFailure[] = [];
  const counts = tiers.map(tier => TRAFFIC_QUALITY_SETTINGS[tier].carCount);
  const ids = [counts[2]! - 1, counts[2]!, counts[1]! - 1, counts[1]!, counts[0]! - 1];
  for (const from of tiers) for (const to of tiers) if (from !== to) {
    for (const retarget of tiers) for (const p of progressSamples) {
      const f = TRAFFIC_QUALITY_SETTINGS[from], t = TRAFFIC_QUALITY_SETTINGS[to], r = TRAFFIC_QUALITY_SETTINGS[retarget];
      const snapshot = new Float32Array(Math.max(...counts));
      for (const id of ids) snapshot[id] = (id < f.carCount ? 1 : 0) * (1 - p) + (id < t.carCount ? 1 : 0) * p;
      for (const id of ids) for (let frame = 0; frame <= frames; frame += 1) {
        const q = frame / frames;
        const expected = snapshot[id]! * (1 - q) + (id < r.carCount ? 1 : 0) * q;
        const actual = evaluateCpuTierFade(id, t.carCount, r.carCount, q, snapshot);
        const error = Math.abs(actual - expected);
        if (!Number.isFinite(actual) || error > 1e-6) errors.push({ channel: 'captured CPU progression', error, limit: 1e-6 });
      }
    }
  }
  return errors;
}
function modeIndex(mode: TrafficTrailMode): number { return modes.indexOf(mode); }
function referenceBase(mode: TrafficTrailMode, cls: number, distance: number): number {
  if (mode === 'all') return 1;
  if (mode === 'streams') return cls === 1 ? 1 : 0;
  return 1 - independentSmoothstep(TRAFFIC_TRAIL_NEAR_FADE_BAND_M[0] ** 2,
    TRAFFIC_TRAIL_NEAR_FADE_BAND_M[1] ** 2, distance ** 2);
}
export function trailTemporalFailures(): TemporalFailure[] {
  const errors: TemporalFailure[] = [];
  for (const from of modes) for (const to of modes) for (const target of modes) for (const p of progressSamples) {
    const eased = independentSmoothstep(0, 1, p);
    const weights: [number, number, number] = [0, 0, 0];
    weights[modeIndex(from)] += 1 - eased; weights[modeIndex(to)] += eased;
    const encoded = trafficTrailModeWeights(target);
    for (let i = 0; i < 3; i += 1) if (encoded[i] !== (i === modeIndex(target) ? 1 : 0))
      errors.push({ channel: 'mode coefficients', error: 1, limit: 0 });
    for (const cls of [0, 1, 2]) for (let frame = 0; frame <= frames; frame += 1) {
      const q = frame / frames, k = independentSmoothstep(0, 1, q);
      const distance = 400 + 400 * q;
      const bases = modes.map(mode => referenceBase(mode, cls, distance));
      const start = weights.reduce((sum, w, i) => sum + w * bases[i]!, 0);
      const expected = start * (1 - k) + bases[modeIndex(target)]! * k;
      const actual = evaluateTrailModeFade(to, target, cls as 0 | 1 | 2, distance ** 2, k, true, weights);
      const error = Math.abs(actual - expected);
      if (!Number.isFinite(actual) || error > 1e-6) errors.push({ channel: 'live trail response', error, limit: 1e-6 });
      const sourceError = Math.abs(trafficTrailWeightFromModeWeights(weights, cls, distance ** 2) - start);
      if (sourceError > 1e-6) errors.push({ channel: 'captured mode response', error: sourceError, limit: 1e-6 });
    }
  }
  return errors;
}

export function appearanceRetargetFailures(): TemporalFailure[] {
  const errors: TemporalFailure[] = [];
  const counts = tiers.map(tier => TRAFFIC_QUALITY_SETTINGS[tier].carCount);
  for (const from of tiers) for (const to of tiers) if (from !== to) for (const target of tiers) {
    for (const p of progressSamples) for (const thinFar of [false, true]) for (const distance of [900, 1190, 1500, 3000]) {
      const f = TRAFFIC_QUALITY_SETTINGS[from], t = TRAFFIC_QUALITY_SETTINGS[to], r = TRAFFIC_QUALITY_SETTINGS[target];
      for (const id of [counts[2]! - 1, counts[1]! - 1]) {
        const alpha = Math.fround((id < f.carCount ? 1 : 0) * (1 - p) + (id < t.carCount ? 1 : 0) * p);
        const snapshot = new Float32Array(Math.max(...counts)); snapshot[id] = alpha;
        const k = independentSmoothstep(0, 1, p), weights: [number, number, number] = [0, 0, 0];
        weights[modeIndex(f.trails)] += 1 - k; weights[modeIndex(t.trails)] += k;
        const common = { ...continuityInput(0, 1.25, 45, from, distance, thinFar), carIndex: id,
          impostorPresence: Number(f.impostors > 0) * (1 - p) + Number(t.impostors > 0) * p,
          hasHullRecord: id < Math.max(f.carCount, t.carCount), hasStreakRecord: id < Math.max(f.carCount, t.carCount) };
        const before = evaluateSameCarTrafficAppearance({ ...common,
          cpuTier: { fromCount: f.carCount, targetCount: t.carCount, progress: p },
          trailTransition: { fromMode: f.trails, targetMode: t.trails, changeTimeS: 0, timeS: p * IMPOSTOR_TIER_FADE_S, enabled: true } });
        const after = evaluateSameCarTrafficAppearance({ ...common,
          cpuTier: { fromCount: t.carCount, targetCount: r.carCount, progress: 0, fromAlphaSnapshot: snapshot },
          trailTransition: { fromMode: t.trails, targetMode: r.trails, changeTimeS: 0, timeS: 0, enabled: true, fromModeWeights: weights } });
        const kernel = (side: 'head' | 'tail') => projectTrafficLampKernel({ position: common.position, direction: common.direction,
          bankRadians: common.bankRadians, typeIndex: common.typeIndex, physicalScale: common.sizeScale, side, camera: common.camera });
        const h = kernel('head'), tail = kernel('tail');
        const metrics = (output: typeof before) => appearanceMetrics(output, 2 * (h.floorHalfSizeCssPx[0] + h.pairHalfSpanCssPx),
          2 * h.floorHalfSizeCssPx[1], 2 * (tail.floorHalfSizeCssPx[0] + tail.pairHalfSpanCssPx), 2 * tail.floorHalfSizeCssPx[1]);
        const expected = shippedHullResponse(distance, common.sourceFade, alpha);
        for (const output of [before, after]) {
          const scaleError = Math.abs(output.hull.scale - common.sizeScale * expected.scale);
          if (scaleError > 1e-6) errors.push({ channel: 'shipped lifecycle scale', error: scaleError, limit: 1e-6 });
          const fadeError = Math.abs(output.hull.fade - expected.fade);
          if (fadeError > 1e-6) errors.push({ channel: 'shipped distance fade', error: fadeError, limit: 1e-6 });
        }
        const a = metrics(before), b = metrics(after);
        for (const channel of ['sizeCssPx', 'energyY', 'sizeIntensity'] as const) {
          const error = Math.abs(a[channel] - b[channel]) / Math.max(Math.abs(a[channel]), Math.abs(b[channel]), 1);
          if (error > 1e-6) errors.push({ channel: 'same-time appearance ' + channel, error, limit: 1e-6 });
        }
      }
    }
  }
  return errors;
}

/** Rear closure samples use seconds and metres per second. */
export function closureSamples(closingVelocity = 250, fps = 60) {
  if (!Number.isFinite(closingVelocity) || closingVelocity <= 0 || !Number.isFinite(fps) || fps <= 0)
    throw new Error('R33_INVALID_CLOSURE_RATE');
  const durationS = (1300 - 600) / closingVelocity;
  return Array.from({ length: Math.ceil(durationS * fps) + 1 }, (_, frame) => {
    const timeS = Math.min(frame / fps, durationS);
    return { frame, timeS, distanceM: 1300 - closingVelocity * timeS };
  });
}
