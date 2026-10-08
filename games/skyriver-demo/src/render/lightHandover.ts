/**
 * Shared, GL-free light handover math for CPU traffic and GPU impostors.
 * Distances are metres from the camera. Presence is the active population share, 0..1.
 */
export const IMPOSTOR_LIGHT_HANDOVER_BAND_M = Object.freeze([450, 750] as const);
export const IMPOSTOR_FAR_FALLOFF_BAND_M = Object.freeze([2500, 9000] as const);
export const IMPOSTOR_SUPPORT_TAPER_BAND = Object.freeze([0.65, 1] as const);

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

/** Smooth far-light brightness multiplier. It reaches 25% by the end of the falloff band. */
export function farImpostorBrightness(distanceM: number): number {
  const [startM, endM] = IMPOSTOR_FAR_FALLOFF_BAND_M;
  return 1 - 0.75 * smoothstep(startM, endM, distanceM);
}

/** Analytic fragment support. It reaches zero at the quad edge to avoid a raster coverage pop. */
export function impostorSupportTaperAlpha(normalizedDistance: number): number {
  const [start, end] = IMPOSTOR_SUPPORT_TAPER_BAND;
  return 1 - smoothstep(start, end, normalizedDistance);
}
