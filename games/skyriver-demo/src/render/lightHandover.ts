/**
 * Shared, GL-free light handover math for CPU traffic and GPU impostors.
 * Distances are metres from the camera. Presence is the active population share, 0..1.
 */
export const IMPOSTOR_LIGHT_HANDOVER_BAND_M = Object.freeze([1080, 1300] as const);
export const IMPOSTOR_FAR_FALLOFF_BAND_M = Object.freeze([2500, 6500] as const);
export const IMPOSTOR_SUPPORT_TAPER_BAND = Object.freeze([0.65, 1] as const);
export const CPU_LIGHT_HANDOVER_BLEND_PRESENCE = 0.5;
export const HULL_DRAW_FADE_START_M = IMPOSTOR_LIGHT_HANDOVER_BAND_M[0];
/** Start the hull dissolve before the light handover. Keep at least 85 percent distance scale. */
export const HULL_DISSOLVE_START_M = 750;
export const HULL_DISSOLVE_FLOOR_SCALE = 0.85;
export const HULL_DRAW_DISTANCE_M = IMPOSTOR_LIGHT_HANDOVER_BAND_M[1];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Share of impostor light at this distance and active population presence. */
export function impostorLightHandoverAlpha(distanceM: number, presence: number): number {
  const [startM, endM] = IMPOSTOR_LIGHT_HANDOVER_BAND_M;
  return clamp01(presence) * smoothstep(startM, endM, distanceM);
}

/** Complementary share retained by CPU traffic lights. */
export function cpuLightHandoverAlpha(distanceM: number, presence: number): number {
  return 1 - impostorLightHandoverAlpha(distanceM, presence);
}

/** Hull LOD uses the same 220 m distance band as the full-presence light handover. */
export function hullLodAlpha(distanceM: number): number {
  return 1 - smoothstep(HULL_DRAW_FADE_START_M, HULL_DRAW_DISTANCE_M, distanceM);
}

/** Keeps the low-tier far fade at zero presence, then adopts the hull LOD cap by threshold. */
export function cpuLightVisibilityAlpha(
  distanceM: number,
  presence: number,
  legacyFarAlpha: number,
): number {
  const activePresence = clamp01(presence);
  const legacy = clamp01(legacyFarAlpha);
  if (activePresence === 0) return legacy;

  const complementary = cpuLightHandoverAlpha(distanceM, activePresence);
  const capped = Math.min(complementary, hullLodAlpha(distanceM));
  const blend = smoothstep(0, CPU_LIGHT_HANDOVER_BLEND_PRESENCE, activePresence);
  const transitioning = legacy * (1 - blend) + capped * blend;
  return Math.min(complementary, transitioning);
}

/** Smooth far-light brightness multiplier. It reaches zero by the end of the falloff band. */
export function farImpostorBrightness(distanceM: number): number {
  const [startM, endM] = IMPOSTOR_FAR_FALLOFF_BAND_M;
  return 1 - smoothstep(startM, endM, distanceM);
}

/** Analytic fragment support. It reaches zero at the quad edge to avoid a raster coverage pop. */
export function impostorSupportTaperAlpha(normalizedDistance: number): number {
  const [start, end] = IMPOSTOR_SUPPORT_TAPER_BAND;
  return 1 - smoothstep(start, end, normalizedDistance);
}

export interface SameCarLightLod {
  nearAlpha: number;
  impostorAlpha: number;
  totalAlpha: number;
}

/**
 * Evaluates same-vehicle light LOD shares across the hull crossover boundary.
 *
 * The CPU streak batch carries the vehicle's lamps at all distances. Near share
 * fades with the hull (1080–1300 m) and drives the hull bars, instance color,
 * and light trails. Far (impostor) share covers the remaining target brightness
 * so the vehicle's lamps remain continuous without size, peak, or identity pops.
 *
 * Full presence stays 1 through 1080–1300 m, then fades smoothly over 2500–6500 m.
 * Low tier (presence 0) preserves legacy far response pixel-identically.
 *
 * Mutates and returns `out` to prevent per-car allocations during render updates.
 */
export function writeSameCarLightLod(
  distanceM: number,
  presence: number,
  legacyFarAlpha: number,
  out: SameCarLightLod = { nearAlpha: 0, impostorAlpha: 0, totalAlpha: 0 },
): SameCarLightLod {
  const activePresence = clamp01(presence);
  const legacy = clamp01(legacyFarAlpha);
  const blend = smoothstep(0, CPU_LIGHT_HANDOVER_BLEND_PRESENCE, activePresence);
  const farBrightness = farImpostorBrightness(distanceM);
  const target = legacy * (1 - blend) + farBrightness * blend;
  const cpuVis = cpuLightVisibilityAlpha(distanceM, activePresence, legacy);
  const near = Math.max(0, Math.min(target, cpuVis));
  const far = Math.max(0, target - near);
  out.nearAlpha = near;
  out.impostorAlpha = far;
  out.totalAlpha = target;
  return out;
}

/** Standard impostor tier crossfade duration in seconds. */
export const IMPOSTOR_TIER_FADE_S = 1.2;

/** Computes transition progress 0..1 from change time, duration, and whether settled. */
export function computeTierProgress(
  t: number,
  changeT: number,
  settled: boolean,
  durationS = IMPOSTOR_TIER_FADE_S,
): number {
  if (settled) return 1;
  if (durationS <= 0) return 1;
  return clamp01((t - changeT) / durationS);
}

/** Computes continuous CPU presence share across tier crossfades. */
export function computeTierPresence(
  fromPresence: number,
  targetPresence: number,
  k: number,
): number {
  return clamp01(fromPresence * (1 - k) + targetPresence * k);
}

/** Evaluates the effective alpha of a single impostor instance. */
export function computeInstanceAlpha(
  fromAlpha: number,
  instanceIndex: number,
  targetCount: number,
  k: number,
): number {
  const toAlpha = instanceIndex < targetCount ? 1 : 0;
  return clamp01(fromAlpha * (1 - k) + toAlpha * k);
}

/** Computes the drawn instance count during transition (retaining fading instances). */
export function computeDrawnInstanceCount(
  k: number,
  previousDrawn: number,
  targetCount: number,
): number {
  return k >= 1 ? targetCount : Math.max(previousDrawn, targetCount);
}

/** Captures current instance alpha into the preallocated fromAlpha buffer on retarget. */
export function captureImpostorFromAlpha(
  fromAlpha: Float32Array,
  k: number,
  previousTarget: number,
  activeCount: number,
): void {
  const boundedCount = Math.min(fromAlpha.length, Math.max(0, activeCount));
  for (let i = 0; i < boundedCount; i += 1) {
    const toAlpha = i < previousTarget ? 1 : 0;
    fromAlpha[i] = clamp01(fromAlpha[i]! * (1 - k) + toAlpha * k);
  }
  // Inactive entries must start at zero when the population grows again.
  fromAlpha.fill(0, boundedCount);
}

export interface ImpostorTierTransitionState {
  targetCount: number;
  fromPresence: number;
  targetPresence: number;
  changeT: number;
  settled: boolean;
  drawnCount: number;
  presence: number;
  k: number;
}

export interface ImpostorTierTransition extends ImpostorTierTransitionState {
  fromAlpha: Float32Array;
  retarget(t: number, newTargetCount: number): boolean;
  evaluate(t: number): ImpostorTierTransitionState;
  instanceAlpha(i: number): number;
}

/** Creates a continuous tier transition tracker for GPU impostors. */
export function createImpostorTierTransition(
  capacity: number,
  initialTarget = 0,
  fadeDurationS = IMPOSTOR_TIER_FADE_S,
  preallocatedFromAlpha?: Float32Array,
): ImpostorTierTransition {
  const fromAlpha = preallocatedFromAlpha ?? new Float32Array(capacity);
  let targetCount = Math.max(0, Math.min(capacity, Math.floor(initialTarget)));
  let fromPresence = targetCount > 0 ? 1 : 0;
  let targetPresence = fromPresence;
  let changeT = -1e9;
  let settled = true;
  let drawnCount = targetCount;
  let presence = fromPresence;
  let k = 1;

  function retarget(t: number, newTarget: number): boolean {
    const nextTarget = Math.max(0, Math.min(capacity, Math.floor(newTarget)));
    if (nextTarget === targetCount) return false;

    const prevK = settled ? 1 : clamp01((t - changeT) / fadeDurationS);
    const activeCount = Math.min(capacity, Math.max(drawnCount, targetCount));

    captureImpostorFromAlpha(fromAlpha, prevK, targetCount, activeCount);

    fromPresence = computeTierPresence(fromPresence, targetPresence, prevK);
    targetPresence = nextTarget > 0 ? 1 : 0;
    drawnCount = Math.max(drawnCount, nextTarget);
    targetCount = nextTarget;
    changeT = t;
    settled = false;
    k = 0;
    presence = fromPresence;
    return true;
  }

  function evaluate(t: number): ImpostorTierTransitionState {
    if (settled) {
      k = 1;
      presence = targetPresence;
      drawnCount = targetCount;
      return tracker;
    }
    k = clamp01((t - changeT) / fadeDurationS);
    if (k >= 1) {
      settled = true;
      k = 1;
      presence = targetPresence;
      drawnCount = targetCount;
    } else {
      presence = computeTierPresence(fromPresence, targetPresence, k);
      drawnCount = Math.max(drawnCount, targetCount);
    }
    return tracker;
  }

  function instanceAlpha(i: number): number {
    if (i < 0 || i >= capacity) return 0;
    return computeInstanceAlpha(fromAlpha[i]!, i, targetCount, k);
  }

  const tracker: ImpostorTierTransition = {
    fromAlpha,
    get targetCount() { return targetCount; },
    get fromPresence() { return fromPresence; },
    get targetPresence() { return targetPresence; },
    get changeT() { return changeT; },
    get settled() { return settled; },
    get drawnCount() { return drawnCount; },
    get presence() { return presence; },
    get k() { return k; },
    retarget,
    evaluate,
    instanceAlpha,
  };
  return tracker;
}
