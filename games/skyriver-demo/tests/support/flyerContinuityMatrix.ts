import {
  evaluateSameCarTrafficAppearance, evaluateIndependentImpostorAppearance, projectTrafficLampKernel,
  type SameCarTrafficAppearance, type SameCarTrafficAppearanceInput,
} from '../../src/render/trafficAppearanceModel';
import { TRAFFIC_QUALITY_SETTINGS } from '../../src/render/trafficAppearance';
import { SKYRIVER_EMISSIVE_GAIN } from '../../src/render/atmosphere';
import {
  continuityCamera, continuityLuminance, FLYER_MATRIX_DISTANCES,
  independentLampProjection,
} from './flyerContinuityProjection';

export type ContinuityTier = keyof typeof TRAFFIC_QUALITY_SETTINGS;
export interface ContinuityMetrics {
  readonly sizeCssPx: number;
  readonly sizeIntensity: number;
  readonly energyY: number;
  readonly peakY: number;
}
export function appearanceMetrics(output: SameCarTrafficAppearance, headWidth: number, headHeight: number,
  tailWidth: number, tailHeight: number): ContinuityMetrics {
  const components: { size: number; peak: number; energy: number }[] = [
    { size: Math.max(headWidth, headHeight), peak: continuityLuminance(output.streak.head.renderedPeakEstimateRgb), energy: continuityLuminance(output.streak.head.renderedContinuousEnergyRgb) },
    { size: Math.max(tailWidth, tailHeight), peak: continuityLuminance(output.streak.tail.renderedPeakEstimateRgb), energy: continuityLuminance(output.streak.tail.renderedContinuousEnergyRgb) },
    { size: Math.max(output.streak.trail.lengthInRadii * (output.streak.trail.startRadiusCssPx + output.streak.trail.endRadiusCssPx) * 0.5,
      output.streak.trail.startRadiusCssPx * 2), peak: continuityLuminance(output.streak.trail.renderedPeakEstimateRgb), energy: continuityLuminance(output.streak.trail.renderedContinuousEnergyRgb) },
  ];
  for (const patches of output.hull.patches) {
    for (const patch of patches) {
      const visible = patch.facesCameraOnOutwardSide && patch.hasHullRecord
        && output.hull.coverage > 0 && patch.projectedAreaCssPx2 > 0;
      const peak = visible ? continuityLuminance(patch.foggedRgb) * output.hull.coverage : 0;
      components.push({ size: Math.max(patch.widthCssPx, patch.heightCssPx), peak,
        energy: patch.projectedAreaCssPx2 * peak });
    }
  }
  const peakY = components.reduce((sum, c) => sum + c.peak, 0);
  const sizeIntensity = components.reduce((sum, c) => sum + c.size * c.peak, 0);
  const energyY = components.reduce((sum, c) => sum + c.energy, 0);
  const energySize = components.reduce((sum, c) => sum + c.size * c.energy, 0);
  return { sizeCssPx: energyY > 0 ? energySize / energyY : 0, sizeIntensity, energyY, peakY };
}

export function continuityInput(typeIndex: number, dpr: number, facingDegrees: number, tier: ContinuityTier,
  distanceM: number, thinFar = false): SameCarTrafficAppearanceInput {
  const quality = TRAFFIC_QUALITY_SETTINGS[tier];
  return { position: [0, 0, 0], carIndex: 100, sourceFade: 1,
    cpuTier: { fromCount: -1, targetCount: quality.carCount, progress: 1 },
    distanceM, thinFar, impostorPresence: quality.impostors > 0 ? 1 : 0,
    sizeScale: 2, typeIndex, bankRadians: 0, direction: [0, 0, 1], speedMps: 150,
    warmth: 0.5, tint: { r: 0.55, g: 0.6, b: 0.65 }, trailClass: 1,
    trailTransition: { fromMode: quality.trails, targetMode: quality.trails,
      changeTimeS: 0, timeS: 2, enabled: true },
    camera: continuityCamera(distanceM, facingDegrees, dpr), emissiveGain: SKYRIVER_EMISSIVE_GAIN,
    fogFactor: 0, fogColor: { r: 0, g: 0, b: 0 } };
}

export function continuityRow(input: SameCarTrafficAppearanceInput) {
  const output = evaluateSameCarTrafficAppearance(input);
  const kernel = (side: 'head' | 'tail') => projectTrafficLampKernel({ position: input.position,
    direction: input.direction, bankRadians: input.bankRadians, typeIndex: input.typeIndex,
    physicalScale: input.sizeScale, side, camera: input.camera });
  const head = kernel('head'), tail = kernel('tail');
  const metrics = appearanceMetrics(output,
    2 * (head.floorHalfSizeCssPx[0] + head.pairHalfSpanCssPx), 2 * head.floorHalfSizeCssPx[1],
    2 * (tail.floorHalfSizeCssPx[0] + tail.pairHalfSpanCssPx), 2 * tail.floorHalfSizeCssPx[1]);
  const gpu = (side: 'head' | 'tail') => evaluateIndependentImpostorAppearance({ instanceIndex: 100,
    fromAlpha: input.impostorPresence, targetCount: Object.values(TRAFFIC_QUALITY_SETTINGS)
      .find(quality => quality.carCount === input.cpuTier.targetCount)?.impostors ?? 0,
    transitionProgress: 1, distanceM: input.distanceM, position: input.position,
    direction: input.direction, seed: 0.314159, typeIndex: input.typeIndex,
    physicalScale: input.sizeScale, side, camera: input.camera,
    emissiveGain: input.emissiveGain, fogFactor: input.fogFactor });
  return { distanceM: input.distanceM, input, output, head, tail, metrics,
    referenceHead: independentLampProjection(input.typeIndex, true, input.sizeScale, input.camera),
    referenceTail: independentLampProjection(input.typeIndex, false, input.sizeScale, input.camera),
    independentGpu: { head: gpu('head'), tail: gpu('tail') } };
}
export type ContinuityRow = ReturnType<typeof continuityRow>;
export function continuityProfile(typeIndex: number, dpr: number, facingDegrees: number, tier: ContinuityTier, thinFar = false) {
  return FLYER_MATRIX_DISTANCES.map(distance => continuityRow(continuityInput(typeIndex, dpr, facingDegrees, tier, distance, thinFar)));
}

import {
  IMPOSTOR_LIGHT_HANDOVER_BAND_M, IMPOSTOR_FAR_FALLOFF_BAND_M,
} from '../../src/render/lightHandover';
import {
  TRAFFIC_CPU_LAMP_PICKUP_BAND_M, TRAFFIC_LAMP_FLOOR_BLEND_SHARE, TRAFFIC_LAMP_FLOOR_MIN_GAIN,
  TRAFFIC_LAMP_MIN_DIAMETER_PX, TRAFFIC_LAMP_HEAD_FACING_BAND, TRAFFIC_LAMP_TAIL_FACING_BAND,
  TRAFFIC_STREAK_HEAD_WHITE_RGB, TRAFFIC_STREAK_HEAD_WARM_RGB, TRAFFIC_STREAK_TAIL_RGB,
  IMPOSTOR_INTENSITY, TRAFFIC_FOG_PENETRATION, TRAFFIC_THIN_FAR_BAND_M,
  TRAFFIC_HULL_HEADLIGHT_RGB, TRAFFIC_HULL_TAILLIGHT_RGB, TRAFFIC_DISTANCE_DIM_FLOOR, TRAFFIC_DISTANCE_DIM_RANGE_M,
  TRAFFIC_TRAIL_NEAR_FADE_BAND_M, TRAFFIC_CPU_TRAIL_PICKUP_BAND_M, TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF,
  TRAFFIC_TRAIL_FAR_FADE_BAND_M, TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE,
  TRAFFIC_LAMP_KERNEL_CORE_SCALE, TRAFFIC_LAMP_KERNEL_CORE_SHARE, TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX,
  TRAFFIC_GPU_SEED_BRIGHTNESS_BASE, TRAFFIC_GPU_SEED_BRIGHTNESS_SPAN, TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER, TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF,
} from '../../src/render/trafficAppearance';
import { FLYER_HANDOVER_STEP_LIMIT, FLYER_RESIDUAL_STEP_LIMIT } from './flyerContinuityProjection';

export function independentSmoothstep(a: number, b: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return 3 * x * x - 2 * x * x * x;
}
/** Independent values from the shipped 04f8393a runtime contract. */
export function shippedHullResponse(distanceM: number, sourceFade = 1, tierFade = 1) {
  const fade = 1 - independentSmoothstep(750, 1300, distanceM);
  const distanceScale = 0.85 + 0.15 * fade;
  const lifecycleScale = independentSmoothstep(0, 0.45, sourceFade * tierFade);
  return { fade, distanceScale, lifecycleScale, scale: distanceScale * lifecycleScale };
}
function referenceTierFade(input: SameCarTrafficAppearanceInput): number {
  const tier = input.cpuTier;
  if (tier.fromCount < 0) return input.carIndex < tier.targetCount ? 1 : 0;
  const from = tier.fromAlphaSnapshot?.[input.carIndex]
    ?? (input.carIndex < tier.fromCount ? 1 : 0);
  const target = input.carIndex < tier.targetCount ? 1 : 0;
  return from * (1 - tier.progress) + target * tier.progress;
}
function referenceTarget(input: SameCarTrafficAppearanceInput): number {
  if (input.impostorPresence === 0) {
    return input.thinFar ? 1 - independentSmoothstep(TRAFFIC_THIN_FAR_BAND_M[0] ** 2,
      TRAFFIC_THIN_FAR_BAND_M[1] ** 2, input.distanceM ** 2) : 1;
  }
  return 1 - independentSmoothstep(IMPOSTOR_FAR_FALLOFF_BAND_M[0], IMPOSTOR_FAR_FALLOFF_BAND_M[1], input.distanceM);
}
export function referenceLampEnergy(input: SameCarTrafficAppearanceInput, head: boolean, independentGpu = false): number {
  const p = independentLampProjection(input.typeIndex, head, input.sizeScale, input.camera);
  const band = head ? TRAFFIC_LAMP_HEAD_FACING_BAND : TRAFFIC_LAMP_TAIL_FACING_BAND;
  const facing = independentSmoothstep(band[0], band[1], head ? p.facing : -p.facing);
  const pickup = independentSmoothstep(TRAFFIC_CPU_LAMP_PICKUP_BAND_M[0], TRAFFIC_CPU_LAMP_PICKUP_BAND_M[1], p.lampDistance);
  const extent = Math.max(p.sourceHalfX, p.sourceHalfY) / (TRAFFIC_LAMP_MIN_DIAMETER_PX * 0.5);
  const floorGain = TRAFFIC_LAMP_FLOOR_MIN_GAIN + (1 - TRAFFIC_LAMP_FLOOR_MIN_GAIN)
    * independentSmoothstep(1 - TRAFFIC_LAMP_FLOOR_BLEND_SHARE, 1 + TRAFFIC_LAMP_FLOOR_BLEND_SHARE, extent);
  const color = head ? TRAFFIC_STREAK_HEAD_WHITE_RGB.map((v, i) => v
    + (TRAFFIC_STREAK_HEAD_WARM_RGB[i]! - v) * (independentGpu ? 0 : input.warmth)) : TRAFFIC_STREAK_TAIL_RGB;
  const y = color[0]! * 0.2126 + color[1]! * 0.7152 + color[2]! * 0.0722;
  const kernelArea = p.floorHalfX * p.floorHalfY * (16 / 15) ** 2;
  const radiance = y + (y * (1 - TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX) + TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX)
    * TRAFFIC_LAMP_KERNEL_CORE_SHARE / TRAFFIC_LAMP_KERNEL_CORE_SCALE ** 2;
  const gpuSeedBrightness = TRAFFIC_GPU_SEED_BRIGHTNESS_BASE + TRAFFIC_GPU_SEED_BRIGHTNESS_SPAN
    * (0.314159 * TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER - Math.floor(0.314159 * TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER));
  const handover = independentSmoothstep(IMPOSTOR_LIGHT_HANDOVER_BAND_M[0], IMPOSTOR_LIGHT_HANDOVER_BAND_M[1], input.distanceM);
  const far = 1 - independentSmoothstep(IMPOSTOR_FAR_FALLOFF_BAND_M[0], IMPOSTOR_FAR_FALLOFF_BAND_M[1], input.distanceM);
  const share = independentGpu ? input.impostorPresence * handover * far * gpuSeedBrightness : referenceTarget(input) * input.sourceFade * pickup;
  return kernelArea * radiance * IMPOSTOR_INTENSITY * input.emissiveGain * share
    * facing * floorGain * (1 - input.fogFactor) ** TRAFFIC_FOG_PENETRATION;
}

export interface ContinuityViolation { readonly distanceM: number; readonly channel: string; readonly value: number; readonly limit: number; }
/** This is the common acceptance path for the real matrix and output mutations. */
export function continuityViolations(rows: readonly ContinuityRow[], probe: (input: SameCarTrafficAppearanceInput) => ContinuityMetrics = continuityMetrics): ContinuityViolation[] {
  const failures: ContinuityViolation[] = [];
  const check = (distanceM: number, channel: string, value: number, limit: number) => {
    if (!Number.isFinite(value) || value > limit) failures.push({ distanceM, channel, value, limit });
  };
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!, lod = row.output.lod;
    check(row.distanceM, 'same-car sum', Math.abs(lod.nearAlpha + lod.impostorProxyAlpha - lod.totalAlpha), 1e-12);
    check(row.distanceM, 'target brightness', Math.abs(lod.totalAlpha - referenceTarget(row.input)), 1e-12);
    const expectedHull = 1 - independentSmoothstep(IMPOSTOR_LIGHT_HANDOVER_BAND_M[0], IMPOSTOR_LIGHT_HANDOVER_BAND_M[1], row.distanceM);
    const expectedNear = row.input.impostorPresence === 0 ? referenceTarget(row.input) : expectedHull;
    check(row.distanceM, 'near handover assignment', Math.abs(lod.nearAlpha - expectedNear), 1e-12);
    const expectedResponse = shippedHullResponse(row.distanceM, row.input.sourceFade, referenceTierFade(row.input));
    check(row.distanceM, 'physical hull scale', Math.abs(row.output.hull.scale - row.input.sizeScale * expectedResponse.scale), 1e-12);
    check(row.distanceM, 'hull distance fade', Math.abs(row.output.hull.fade - expectedResponse.fade), 1e-12);
    check(row.distanceM, 'hull mean coverage estimate', Math.abs(row.output.hull.coverage - expectedResponse.fade), 1e-12);
    const expectedDim = 1 - (1 - TRAFFIC_DISTANCE_DIM_FLOOR) * Math.min(1, row.distanceM ** 2 / TRAFFIC_DISTANCE_DIM_RANGE_M ** 2);
    for (const [side, patches] of row.output.hull.patches.entries()) {
      const color = side === 0 ? TRAFFIC_HULL_HEADLIGHT_RGB : TRAFFIC_HULL_TAILLIGHT_RGB;
      for (const patch of patches) {
        const actual = [patch.preFogRgb.r, patch.preFogRgb.g, patch.preFogRgb.b];
        const tint = [row.input.tint.r, row.input.tint.g, row.input.tint.b];
        for (let channel = 0; channel < 3; channel += 1) check(row.distanceM, 'hull lamp radiance',
          Math.abs(actual[channel]! - color[channel]! * tint[channel]! * expectedDim * expectedNear * row.input.sourceFade), 1e-12);
      }
    }

    for (const head of [true, false]) {
      const source = head ? row.head : row.tail;
      const reference = head ? row.referenceHead : row.referenceTail;
      const channel = head ? 'head' : 'tail';
      const relative = (value: number, expected: number) => Math.abs(value - expected) / Math.max(expected, 1e-6);
      check(row.distanceM, channel + ' projected width', relative(source.floorHalfSizeCssPx[0], reference.floorHalfX), 1e-6);
      check(row.distanceM, channel + ' projected height', relative(source.floorHalfSizeCssPx[1], reference.floorHalfY), 1e-6);
      check(row.distanceM, channel + ' pair span', relative(source.pairHalfSpanCssPx, reference.pairSpan), 1e-5);
      const actualEnergy = continuityLuminance((head ? row.output.streak.head : row.output.streak.tail).renderedContinuousEnergyRgb);
      const expectedEnergy = referenceLampEnergy(row.input, head);
      check(row.distanceM, channel + ' pipeline energy', relative(actualEnergy, expectedEnergy), 1e-5);
      const gpu = head ? row.independentGpu.head : row.independentGpu.tail;
      check(row.distanceM, 'independent GPU projected width', relative(gpu.projection.floorHalfSizeCssPx[0], reference.floorHalfX), 1e-6);
      check(row.distanceM, 'independent GPU projected height', relative(gpu.projection.floorHalfSizeCssPx[1], reference.floorHalfY), 1e-6);
      check(row.distanceM, 'independent GPU pair span', relative(gpu.projection.pairHalfSpanCssPx, reference.pairSpan), 1e-5);
      check(row.distanceM, 'independent GPU tier alpha', Math.abs(gpu.tierAlpha - row.input.impostorPresence), 1e-12);
      const expectedGpu = referenceLampEnergy(row.input, head, true);
      const actualGpu = continuityLuminance(gpu.lamp.renderedContinuousEnergyRgb);
      const cutoffExpected = gpu.lamp.gain <= TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF;
      check(row.distanceM, 'independent GPU cutoff', gpu.clippedByIntensityCutoff === cutoffExpected ? 0 : 1, 0);
      check(row.distanceM, 'independent GPU pipeline energy', relative(actualGpu, cutoffExpected ? 0 : expectedGpu), 1e-5);

      if (i > 0) {
        const previous = rows[i - 1]!;
        const previousEnergy = continuityLuminance((head ? previous.output.streak.head : previous.output.streak.tail).renderedContinuousEnergyRgb);
        const previousExpected = referenceLampEnergy(previous.input, head);
        const physicalAndDeclaredStep = expectedEnergy - previousExpected;
        const residual = Math.abs((actualEnergy - previousEnergy) - physicalAndDeclaredStep)
          / Math.max(expectedEnergy, previousExpected, 1e-6);
        check(row.distanceM, channel + ' transport residual', residual, FLYER_RESIDUAL_STEP_LIMIT);
      }
    }
    const trailMode = row.input.trailTransition.targetMode;
    const trailProgress = independentSmoothstep(TRAFFIC_TRAIL_FAR_FADE_BAND_M[0], TRAFFIC_TRAIL_FAR_FADE_BAND_M[1], row.distanceM);
    const lengthFade = Math.exp(Math.log(TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE) * trailProgress);
    check(row.distanceM, 'trail distance response', Math.abs(row.output.streak.trail.distanceFade - lengthFade), 1e-12);
    const baseTrail = trailMode === 'all' ? 1 : trailMode === 'streams' ? (row.input.trailClass === 1 ? 1 : 0)
      : 1 - independentSmoothstep(TRAFFIC_TRAIL_NEAR_FADE_BAND_M[0] ** 2, TRAFFIC_TRAIL_NEAR_FADE_BAND_M[1] ** 2, row.distanceM ** 2);
    const extent = Math.max(row.referenceTail.sourceHalfX, row.referenceTail.sourceHalfY) / (TRAFFIC_LAMP_MIN_DIAMETER_PX * 0.5);
    const floorGain = TRAFFIC_LAMP_FLOOR_MIN_GAIN + (1 - TRAFFIC_LAMP_FLOOR_MIN_GAIN)
      * independentSmoothstep(1 - TRAFFIC_LAMP_FLOOR_BLEND_SHARE, 1 + TRAFFIC_LAMP_FLOOR_BLEND_SHARE, extent);
    const trailPickup = independentSmoothstep(TRAFFIC_CPU_TRAIL_PICKUP_BAND_M[0], TRAFFIC_CPU_TRAIL_PICKUP_BAND_M[1], row.referenceTail.lampDistance);
    const viewGain = 1 - independentSmoothstep(0.72, 0.90, -row.referenceTail.facing);
    const trailGain = row.input.sourceFade * expectedNear * baseTrail * trailPickup * floorGain * viewGain;
    check(row.distanceM, 'trail source gain', Math.abs(row.output.streak.trail.sourceGain - trailGain), 1e-9);
    const parent = referenceTarget(row.input) > 0 ? baseTrail * expectedNear / referenceTarget(row.input) : 0;
    check(row.distanceM, 'trail clip eligibility', row.output.streak.trail.clippedByAttributeCutoff === (parent <= TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF) ? 0 : 1, 0);
    const declaredFadeComplete = row.input.impostorPresence === 0 && row.input.thinFar
      && row.distanceM >= TRAFFIC_THIN_FAR_BAND_M[1];
    if (declaredFadeComplete) check(row.distanceM, 'emission after declared complete fade', row.metrics.energyY, 0);
    if (!declaredFadeComplete) check(row.distanceM, 'unassigned same-car light', lod.totalAlpha > 0 ? 0 : 1, 0);
    const previous = rows[i - 1];
    if (previous) {
      const predicted = integratedMetricStep(previous.input, row.input, probe);
      for (const channel of ['sizeCssPx', 'energyY', 'sizeIntensity'] as const) {
        if (channel === 'sizeCssPx' && declaredFadeComplete && lod.totalAlpha === 0
          && row.metrics.energyY === 0) continue;
        const actualStep = row.metrics[channel] - previous.metrics[channel];
        const scale = Math.max(Math.abs(row.metrics[channel]), Math.abs(previous.metrics[channel]), 1e-6);
        check(row.distanceM, 'combined smooth-transport residual ' + channel,
          Math.abs(actualStep - predicted[channel]) / scale, FLYER_RESIDUAL_STEP_LIMIT);
      }
    }
    const inRawFadeBand = [IMPOSTOR_LIGHT_HANDOVER_BAND_M, TRAFFIC_TRAIL_FAR_FADE_BAND_M]
      .some(([start, end]) => row.distanceM > start && previous && previous.distanceM < end);
    if (previous && inRawFadeBand && !row.input.thinFar) {
      const step = (a: number, b: number) => Math.abs(b - a) / Math.max(Math.abs(a), 1e-6);
      check(row.distanceM, 'combined size step in handover', step(previous.metrics.sizeCssPx, row.metrics.sizeCssPx), FLYER_HANDOVER_STEP_LIMIT);
      check(row.distanceM, 'combined energy step in handover', step(previous.metrics.energyY, row.metrics.energyY), FLYER_HANDOVER_STEP_LIMIT);
      check(row.distanceM, 'combined size-intensity step in handover', step(previous.metrics.sizeIntensity, row.metrics.sizeIntensity), FLYER_HANDOVER_STEP_LIMIT);
    }
  }
  return failures;
}


/** Continuous transport probe. It measures continuity, not independent photometry. */
export function continuityMetrics(input: SameCarTrafficAppearanceInput): ContinuityMetrics {
  const output = evaluateSameCarTrafficAppearance(input);
  const kernel = (side: 'head' | 'tail') => projectTrafficLampKernel({ position: input.position,
    direction: input.direction, bankRadians: input.bankRadians, typeIndex: input.typeIndex,
    physicalScale: input.sizeScale, side, camera: input.camera });
  const head = kernel('head'), tail = kernel('tail');
  return appearanceMetrics(output, 2 * (head.floorHalfSizeCssPx[0] + head.pairHalfSpanCssPx),
    2 * head.floorHalfSizeCssPx[1], 2 * (tail.floorHalfSizeCssPx[0] + tail.pairHalfSpanCssPx), 2 * tail.floorHalfSizeCssPx[1]);
}
function inputAtDistance(input: SameCarTrafficAppearanceInput, distanceM: number): SameCarTrafficAppearanceInput {
  const facing = Math.atan2(input.camera.position[0], input.camera.position[2]) * 180 / Math.PI;
  const dpr = input.camera.bufferHeightPx / input.camera.cssHeightPx;
  return { ...input, distanceM, camera: continuityCamera(distanceM, facing, dpr) };
}
export function integratedMetricStep(before: SameCarTrafficAppearanceInput, after: SameCarTrafficAppearanceInput,
  probe: (input: SameCarTrafficAppearanceInput) => ContinuityMetrics): ContinuityMetrics {
  const steps = 8, epsilonM = 1e-3;
  const width = (after.distanceM - before.distanceM) / steps;
  const result = { sizeCssPx: 0, sizeIntensity: 0, energyY: 0, peakY: 0 };
  for (let part = 0; part < steps; part += 1) {
    const distance = before.distanceM + (part + 0.5) * width;
    const a = probe(inputAtDistance(before, distance - epsilonM));
    const b = probe(inputAtDistance(before, distance + epsilonM));
    for (const key of ['sizeCssPx', 'sizeIntensity', 'energyY', 'peakY'] as const) {
      result[key] += (b[key] - a[key]) / (2 * epsilonM) * width;
    }
  }
  return result;
}

import { evaluateIndependentImpostorAppearance as evaluateGpu } from '../../src/render/trafficAppearanceModel';
export function gpuFacingCutoff(typeIndex: number, dpr: number, head: boolean) {
  const evaluate = (angle: number) => {
    const input = continuityInput(typeIndex, dpr, angle, 'high', 1500);
    return evaluateGpu({ instanceIndex: 100, fromAlpha: 1,
      targetCount: TRAFFIC_QUALITY_SETTINGS.high.impostors, transitionProgress: 1,
      distanceM: input.distanceM, position: input.position, direction: input.direction,
      seed: 0.314159, typeIndex, physicalScale: input.sizeScale, side: head ? 'head' : 'tail',
      camera: input.camera, emissiveGain: input.emissiveGain, fogFactor: input.fogFactor });
  };
  let lo = 0, hi = 180;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const above = evaluate(mid).lamp.gain > TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF;
    if (above === head) lo = mid; else hi = mid;
  }
  const angle = (lo + hi) / 2;
  const below = evaluate(angle + (head ? 1e-7 : -1e-7));
  const above = evaluate(angle + (head ? -1e-7 : 1e-7));
  const fullSourceY = continuityLuminance(above.lamp.continuousEnergyRgb) / above.lamp.gain;
  const jumpY = Math.abs(continuityLuminance(above.lamp.renderedContinuousEnergyRgb)
    - continuityLuminance(below.lamp.renderedContinuousEnergyRgb));
  return { typeIndex, dpr, head, angle, below, above, jumpY, fullSourceY,
    sourceNormalizedJump: jumpY / fullSourceY };
}
export function cpuTrailCutoff(typeIndex: number, dpr: number) {
  let lo: number = Math.min(IMPOSTOR_LIGHT_HANDOVER_BAND_M[0], TRAFFIC_TRAIL_FAR_FADE_BAND_M[0]);
  let hi: number = Math.max(IMPOSTOR_LIGHT_HANDOVER_BAND_M[1], TRAFFIC_TRAIL_FAR_FADE_BAND_M[1]);
  const evaluate = (distance: number) => evaluateSameCarTrafficAppearance(continuityInput(typeIndex, dpr, 90, 'high', distance));
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if ((evaluate(mid).uploaded.aCarFade?.[3] ?? 0) > TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF) lo = mid; else hi = mid;
  }
  const distanceM = (lo + hi) / 2;
  const belowOutput = evaluate(distanceM + 1e-5), aboveOutput = evaluate(distanceM - 1e-5);
  const below = belowOutput.streak.trail, above = aboveOutput.streak.trail;
  const jumpY = Math.abs(continuityLuminance(above.renderedContinuousEnergyRgb) - continuityLuminance(below.renderedContinuousEnergyRgb));
  const parent = aboveOutput.uploaded.aCarFade?.[3] ?? 0;
  const fullSourceY = continuityLuminance(above.continuousEnergyRgb) / parent;
  return { typeIndex, dpr, distanceM, below, above, jumpY, fullSourceY, sourceNormalizedJump: jumpY / fullSourceY };
}
