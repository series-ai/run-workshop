import type { TrafficQuality, TrafficTrailMode } from './trafficTypes';

/** Lamp dimensions in hull-local metres. Forward is +Z. This module needs no GL. */
export interface TrafficLampProfile {
  readonly kind: 'pair' | 'bar';
  /** Pair patch centres are +/- centreXM. A bar has one patch at x = 0. */
  readonly centreXM: number;
  readonly yM: number;
  readonly zM: number;
  /** Width of each source patch. */
  readonly widthM: number;
  readonly heightM: number;
}

export interface TrafficAppearanceProfile {
  readonly name: 'cab' | 'interceptor' | 'commuter' | 'van' | 'bus' | 'flatbed';
  readonly front: TrafficLampProfile;
  readonly rear: TrafficLampProfile;
}

export const TRAFFIC_APPEARANCE_PROFILES: readonly TrafficAppearanceProfile[] = Object.freeze(([
  { name: 'cab', front: { kind: 'pair', centreXM: 0.56, yM: -0.04, zM: 2.61, widthM: 0.5, heightM: 0.3 }, rear: { kind: 'bar', centreXM: 0, yM: 0.1, zM: -2.21, widthM: 1.75, heightM: 0.2 } },
  { name: 'interceptor', front: { kind: 'bar', centreXM: 0, yM: 0.06, zM: 3.14, widthM: 0.9, heightM: 0.12 }, rear: { kind: 'bar', centreXM: 0, yM: -0.02, zM: -2.97, widthM: 1.4, heightM: 0.16 } },
  { name: 'commuter', front: { kind: 'pair', centreXM: 0.35, yM: -0.18, zM: 3.01, widthM: 0.32, heightM: 0.2 }, rear: { kind: 'bar', centreXM: 0, yM: -0.26, zM: -2.11, widthM: 1.5, heightM: 0.2 } },
  { name: 'van', front: { kind: 'pair', centreXM: 0.7, yM: -0.1, zM: 2.31, widthM: 0.45, heightM: 0.25 }, rear: { kind: 'bar', centreXM: 0, yM: 1.05, zM: -2.11, widthM: 1.9, heightM: 0.18 } },
  { name: 'bus', front: { kind: 'pair', centreXM: 0.75, yM: -0.3, zM: 4.12, widthM: 0.5, heightM: 0.3 }, rear: { kind: 'bar', centreXM: 0, yM: 0.3, zM: -4.12, widthM: 2, heightM: 0.22 } },
  { name: 'flatbed', front: { kind: 'bar', centreXM: 0, yM: 0.1, zM: 3.56, widthM: 1.7, heightM: 0.18 }, rear: { kind: 'bar', centreXM: 0, yM: -0.35, zM: -4.21, widthM: 2.1, heightM: 0.16 } },
] satisfies TrafficAppearanceProfile[]).map((profile) => Object.freeze({ ...profile, front: Object.freeze(profile.front), rear: Object.freeze(profile.rear) })));


/** Stable render routes. The simulation keeps its three archetypes. */
const PRIMARY_TRAFFIC_PROFILES = [0, 1, 2] as const;
const VARIANT_TRAFFIC_PROFILES = [3, 2, 4] as const;

export function trafficRenderProfile(archetype: number, variant: boolean, freight: boolean): number {
  if (!Number.isInteger(archetype) || archetype < 0 || archetype >= PRIMARY_TRAFFIC_PROFILES.length) {
    throw new Error('SKYRIVER_TRAFFIC_ARCHETYPE_OUT_OF_RANGE');
  }
  return freight ? 5 : (variant ? VARIANT_TRAFFIC_PROFILES : PRIMARY_TRAFFIC_PROFILES)[archetype]!;
}

export const IMPOSTORS_HIGH = 20000;
export const IMPOSTORS_MEDIUM = 10000;
export const TRAFFIC_QUALITY_SETTINGS: {
  readonly high: TrafficQuality;
  readonly medium: TrafficQuality;
  readonly low: TrafficQuality;
} = Object.freeze({
  high: Object.freeze({ carCount: 2400, thrusterBudget: 2400, trails: 'all' as const, impostors: IMPOSTORS_HIGH }),
  medium: Object.freeze({ carCount: 1200, thrusterBudget: 1200, trails: 'streams' as const, impostors: IMPOSTORS_MEDIUM }),
  low: Object.freeze({ carCount: 600, thrusterBudget: 600, trails: 'near' as const, impostors: 0 }),
});

/** Renderer values for traffic appearance. Keep GL-free models and shaders on this source. */
export const TRAFFIC_DISTANCE_DIM_RANGE_M = 900;
export const TRAFFIC_DISTANCE_DIM_FLOOR = 0.42;
export const TRAFFIC_DISTANCE_DIM_INV_RANGE_SQ = 1 / (TRAFFIC_DISTANCE_DIM_RANGE_M * TRAFFIC_DISTANCE_DIM_RANGE_M);
export const TRAFFIC_THIN_FAR_BAND_M = Object.freeze([900, 1150] as const);
export const TRAFFIC_CPU_LAMP_PICKUP_BAND_M = Object.freeze([140, 300] as const);
export const TRAFFIC_CPU_TRAIL_PICKUP_BAND_M = Object.freeze([30, 90] as const);
export const TRAFFIC_TRAIL_NEAR_FADE_BAND_M = Object.freeze([500, 700] as const);
/** Far trails taper before the hull handover band. The end matches the rendered cutoff. */
export const TRAFFIC_TRAIL_FAR_FADE_BAND_M = Object.freeze([700, 1300] as const);
export const TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE = 0.02;
export const TRAFFIC_TRAIL_SECONDS = 0.45;
export const TRAFFIC_TRAIL_MAX_M = 60;
export const TRAFFIC_TRAIL_ALPHA = 0.25;
export const TRAIL_MAX_CAR_LENGTHS = 2;
export const TRAFFIC_TRAIL_END_WIDTH_SHARE = 0.3;
export const TRAFFIC_TRAIL_START_RADIUS_M = 0.6;
export const TRAFFIC_TRAIL_START_CSS_PIXEL_SCALE = 1.6;
export const TRAFFIC_TRAIL_SCREEN_CAP_REFINEMENTS = 2;
export const TRAFFIC_DIRECTION_PITCH_CLAMP = 0.35;
export const TRAFFIC_HULL_FADE_RAMP_END = 0.45;
export const TRAFFIC_TRAIL_END_ON_BAND = Object.freeze([0.72, 0.90] as const);
export const TRAFFIC_TRAIL_END_FADE_EXPONENT = 1.4;
export const TRAFFIC_TRAIL_HEAD_FADE_EXPONENT = 0.7;
export const TRAFFIC_TRAIL_TAIL_FADE_EXPONENT = 1.2;
export const TRAFFIC_TRAIL_WARM_FACING_BAND = Object.freeze([-0.2, 0.4] as const);
export const TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF = 0.001;
export const TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF = 0.001;
export const IMPOSTOR_INTENSITY = 1.7;
export const TRAFFIC_GPU_SEED_BRIGHTNESS_BASE = 0.55;
export const TRAFFIC_GPU_SEED_BRIGHTNESS_SPAN = 0.6;
export const TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER = 29.7;
export const TRAFFIC_FOG_PENETRATION = 0.2;

export const TRAFFIC_HULL_HEADLIGHT_RGB = Object.freeze([2.0, 2.15, 2.3] as const);
export const TRAFFIC_HULL_TAILLIGHT_RGB = Object.freeze([4.0, 0.3, 0.2] as const);
export const TRAFFIC_HULL_SIGN_RGB = Object.freeze([1.0, 0.72, 0.2] as const);
export const TRAFFIC_STREAK_HEAD_WHITE_RGB = Object.freeze([1.0, 0.97, 0.93] as const);
export const TRAFFIC_STREAK_HEAD_WARM_RGB = Object.freeze([1.0, 0.62, 0.22] as const);
export const TRAFFIC_STREAK_TAIL_RGB = Object.freeze([1.0, 0.07, 0.045] as const);
export const TRAFFIC_STREAK_TRAIL_WARM_RGB = Object.freeze([1.0, 0.86, 0.66] as const);

export const TRAFFIC_LAMP_KERNEL_LIMIT = 1;
export const TRAFFIC_LAMP_KERNEL_QUADRATIC_NUMERATOR = 2;
export const TRAFFIC_LAMP_KERNEL_QUADRATIC_DENOMINATOR = 3;
export const TRAFFIC_LAMP_KERNEL_QUARTIC_COEFFICIENT = 0.2;
export const TRAFFIC_LAMP_KERNEL_CORE_SCALE = 2.5;
export const TRAFFIC_LAMP_KERNEL_CORE_SHARE = 0.4;
export const TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX = 0.5;
export const TRAFFIC_LAMP_KERNEL_MIN_PIXEL_SIZE = 1e-5;
export const TRAFFIC_LAMP_FRUSTUM_MARGIN_CSS_PX = 3;
export const TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE = 1e8;
export const TRAFFIC_LAMP_STREAK_BODY_EXPONENT = 1.6;
export const TRAFFIC_LAMP_KERNEL_CENTER_EPSILON = 1e-5;

export const TRAFFIC_LAMP_MIN_DIAMETER_PX = 1.3;
export const TRAFFIC_LAMP_FLOOR_BLEND_SHARE = 0.2;
export const TRAFFIC_LAMP_FLOOR_MIN_GAIN = 0.8;
export const TRAFFIC_LAMP_HEAD_FACING_BAND = Object.freeze([0.1, 0.7] as const);
export const TRAFFIC_LAMP_TAIL_FACING_BAND = Object.freeze([-0.85, 0.3] as const);

export function trafficAppearanceSmoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function trafficDistanceDim(distanceSq: number): number {
  return 1 - (1 - TRAFFIC_DISTANCE_DIM_FLOOR) * Math.min(1, distanceSq * TRAFFIC_DISTANCE_DIM_INV_RANGE_SQ);
}

export function trafficThinFarAlpha(distanceSq: number, thinFar: boolean): number {
  if (!thinFar) return 1;
  const startSq = TRAFFIC_THIN_FAR_BAND_M[0] * TRAFFIC_THIN_FAR_BAND_M[0];
  const endSq = TRAFFIC_THIN_FAR_BAND_M[1] * TRAFFIC_THIN_FAR_BAND_M[1];
  return 1 - trafficAppearanceSmoothstep(startSq, endSq, distanceSq);
}

export function trafficCpuTierProgress(timeS: number, changeTimeS: number, durationS: number): number {
  return Math.min(1, Math.max(0, (timeS - changeTimeS) / durationS));
}

/** Exponential trail-length taper. It reaches a small tail length at the end of the hull band. */
export function trafficTrailFarFade(distanceM: number): number {
  const [startM, endM] = TRAFFIC_TRAIL_FAR_FADE_BAND_M;
  if (distanceM <= startM) return 1;
  if (distanceM >= endM) return TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE;
  const linear = (distanceM - startM) / (endM - startM);
  const progress = linear * linear * (3 - 2 * linear);
  return Math.exp(Math.log(TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE) * progress);
}

/** Reduce trail intensity when the camera sees the car from behind. */
export function trafficTrailViewGain(facing: number): number {
  return 1 - trafficAppearanceSmoothstep(TRAFFIC_TRAIL_END_ON_BAND[0], TRAFFIC_TRAIL_END_ON_BAND[1], -facing);
}

export function trafficCpuTierFade(
  carIndex: number,
  fromCount: number,
  targetCount: number,
  progress: number,
  fromAlphaSnapshot?: ArrayLike<number>,
): number {
  const k = Math.min(1, Math.max(0, progress));
  if (fromAlphaSnapshot) {
    const from = Math.min(1, Math.max(0, fromAlphaSnapshot[carIndex] ?? 0));
    const target = carIndex < targetCount ? 1 : 0;
    return from * (1 - k) + target * k;
  }
  if (fromCount < 0 || carIndex < Math.min(fromCount, targetCount)) return 1;
  return targetCount > fromCount ? k : 1 - k;
}

export type TrafficTrailModeWeights = readonly [all: number, streams: number, near: number];

/** One-hot coefficients for the three trail modes. */
export function trafficTrailModeWeights(mode: TrafficTrailMode): TrafficTrailModeWeights {
  if (mode === 'all') return [1, 0, 0];
  if (mode === 'streams') return [0, 1, 0];
  return [0, 0, 1];
}

/** Applies captured mode coefficients to the current class and distance response. */
export function trafficTrailWeightFromModeWeights(
  weights: ArrayLike<number>,
  trailClass: number,
  distanceSq: number,
): number {
  const startM = TRAFFIC_TRAIL_NEAR_FADE_BAND_M[0];
  const endM = TRAFFIC_TRAIL_NEAR_FADE_BAND_M[1];
  const nearWeight = 1 - trafficAppearanceSmoothstep(startM * startM, endM * endM, distanceSq);
  return (weights[0] ?? 0) + (trailClass === 1 ? (weights[1] ?? 0) : 0) + (weights[2] ?? 0) * nearWeight;
}

export function trafficTrailModeBaseWeight(mode: TrafficTrailMode, trailClass: number, distanceSq: number): number {
  if (mode === 'all') return 1;
  if (mode === 'streams') return trailClass === 1 ? 1 : 0;
  const startM = TRAFFIC_TRAIL_NEAR_FADE_BAND_M[0];
  const endM = TRAFFIC_TRAIL_NEAR_FADE_BAND_M[1];
  return 1 - trafficAppearanceSmoothstep(startM * startM, endM * endM, distanceSq);
}

export function trafficTrailModeProgress(elapsedS: number, durationS: number): number {
  return trafficAppearanceSmoothstep(0, durationS, elapsedS);
}

export function trafficTrailModeFade(
  fromMode: TrafficTrailMode,
  targetMode: TrafficTrailMode,
  trailClass: number,
  distanceSq: number,
  progress: number,
  enabled: boolean,
  fromModeWeights?: ArrayLike<number>,
): number {
  if (!enabled) return 0;
  const target = trafficTrailModeBaseWeight(targetMode, trailClass, distanceSq);
  if (fromMode === targetMode && !fromModeWeights) return target;
  const source = fromModeWeights
    ? trafficTrailWeightFromModeWeights(fromModeWeights, trailClass, distanceSq)
    : trafficTrailModeBaseWeight(fromMode, trailClass, distanceSq);
  const boundedProgress = Math.min(1, Math.max(0, progress));
  return source * (1 - boundedProgress) + target * boundedProgress;
}

/** Shared facing gain for CPU and GPU lamps. The tail band reads the opposite direction. */
export function trafficLampFacingGain(facing: number, head: boolean): number {
  return head
    ? trafficAppearanceSmoothstep(TRAFFIC_LAMP_HEAD_FACING_BAND[0], TRAFFIC_LAMP_HEAD_FACING_BAND[1], facing)
    : trafficAppearanceSmoothstep(TRAFFIC_LAMP_TAIL_FACING_BAND[0], TRAFFIC_LAMP_TAIL_FACING_BAND[1], -facing);
}

/** Store type + scale / 8. Scale must be in [1, 6]. Fractions stay clear of integers. */
export function packTrafficAppearance(type: number, scale: number): number {
  if (!Number.isInteger(type) || type < 0 || type >= TRAFFIC_APPEARANCE_PROFILES.length || !Number.isFinite(scale) || scale < 1 || scale > 6) {
    throw new Error('SKYRIVER_TRAFFIC_APPEARANCE_INVALID');
  }
  return Math.fround(type + scale / 8);
}

/** Decode the uploaded Float32 scalar. Valid storage is [0.125, 5.75]. */
export function unpackTrafficAppearance(packed: number): { type: number; scale: number } {
  const type = Math.floor(packed);
  const scale = (packed - type) * 8;
  packTrafficAppearance(type, scale);
  return { type, scale };
}

function glslNumber(value: number): string {
  return value.toFixed(8);
}

/** Two kernels cover a bar. Their outer span equals the source bar width. */
export const TRAFFIC_APPEARANCE_GLSL = /* glsl */ `
float trafficTrailFarFade(float distanceM) {
  float progress = clamp((distanceM - ${TRAFFIC_TRAIL_FAR_FADE_BAND_M[0].toFixed(1)})
    / ${(TRAFFIC_TRAIL_FAR_FADE_BAND_M[1] - TRAFFIC_TRAIL_FAR_FADE_BAND_M[0]).toFixed(1)}, 0.0, 1.0);
  progress = progress * progress * (3.0 - 2.0 * progress);
  return exp(${Math.log(TRAFFIC_TRAIL_FAR_FADE_END_LENGTH_SCALE).toFixed(8)} * progress);
}
struct TrafficLampShape {
  vec4 dimensions;
  float y;
};
TrafficLampShape trafficLampProfile(float type, bool front) {
${TRAFFIC_APPEARANCE_PROFILES.map((profile, i) => {
  const shape = (lamp: TrafficLampProfile): string => `TrafficLampShape(vec4(${[lamp.kind === 'pair' ? lamp.centreXM : lamp.widthM / 4, lamp.kind === 'pair' ? lamp.widthM : lamp.widthM / 2, lamp.heightM, lamp.zM].map(glslNumber).join(', ')}), ${glslNumber(lamp.yM)})`;
  return `  if (type < ${glslNumber(i + 0.5)}) { if (front) return ${shape(profile.front)}; return ${shape(profile.rear)}; }`;
}).join('\n')}
  return TrafficLampShape(vec4(0.0), 0.0);
}
vec4 trafficLampShape(float type, bool front) {
  return trafficLampProfile(type, front).dimensions;
}
float trafficCarLength(float type) {
  return trafficLampShape(type, true).w - trafficLampShape(type, false).w;
}
float trafficLampFacingGain(float facing, bool head) {
  if (head) return smoothstep(${glslNumber(TRAFFIC_LAMP_HEAD_FACING_BAND[0])}, ${glslNumber(TRAFFIC_LAMP_HEAD_FACING_BAND[1])}, facing);
  return smoothstep(${glslNumber(TRAFFIC_LAMP_TAIL_FACING_BAND[0])}, ${glslNumber(TRAFFIC_LAMP_TAIL_FACING_BAND[1])}, -facing);
}
float trafficLampPhysicalRadius(float type, float scale) {
${TRAFFIC_APPEARANCE_PROFILES.map((profile, i) => {
  const radius = (lamp: TrafficLampProfile): number => Math.hypot(
    (lamp.kind === 'pair' ? lamp.centreXM : 0) + lamp.widthM / 2,
    Math.abs(lamp.yM) + lamp.heightM / 2, Math.abs(lamp.zM));
  const bound = Math.ceil(Math.max(radius(profile.front), radius(profile.rear)) * TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE)
    / TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE;
  return `  if (type < ${glslNumber(i + 0.5)}) return ${glslNumber(bound)} * scale;`;
}).join('\n')}
  return 0.0;
}
bool trafficLampOutsidePlane(vec4 plane, vec4 point, float radius) {
  return dot(plane, point) < -radius * length(plane.xyz);
}
bool trafficLampInView(vec3 pos, float type, float scale, float cssPixelScale, float extraM) {
  vec4 point = viewMatrix * vec4(pos, 1.0);
  float physicalRadius = trafficLampPhysicalRadius(type, scale) + extraM;
  // Bound the physical patches, pixel filter and trail cap before perspective expansion.
  float radius = physicalRadius + ${TRAFFIC_LAMP_FRUSTUM_MARGIN_CSS_PX.toFixed(1)} * cssPixelScale * max(-point.z + physicalRadius, 1.0);
  vec4 row0 = vec4(projectionMatrix[0][0], projectionMatrix[1][0], projectionMatrix[2][0], projectionMatrix[3][0]);
  vec4 row1 = vec4(projectionMatrix[0][1], projectionMatrix[1][1], projectionMatrix[2][1], projectionMatrix[3][1]);
  vec4 row2 = vec4(projectionMatrix[0][2], projectionMatrix[1][2], projectionMatrix[2][2], projectionMatrix[3][2]);
  vec4 row3 = vec4(projectionMatrix[0][3], projectionMatrix[1][3], projectionMatrix[2][3], projectionMatrix[3][3]);
  return !(trafficLampOutsidePlane(row3 + row0, point, radius)
    || trafficLampOutsidePlane(row3 - row0, point, radius)
    || trafficLampOutsidePlane(row3 + row1, point, radius)
    || trafficLampOutsidePlane(row3 - row1, point, radius)
    || trafficLampOutsidePlane(row3 + row2, point, radius)
    || trafficLampOutsidePlane(row3 - row2, point, radius));
}
float trafficLampFloor(float physical, float floorSize) {
  float width = floorSize * ${glslNumber(TRAFFIC_LAMP_FLOOR_BLEND_SHARE)};
  float overlap = max(width - abs(physical - floorSize), 0.0);
  return max(physical, floorSize) + overlap * overlap / (4.0 * width);
}
void trafficLampKernel(vec3 pos, vec3 forward, float bank, float type, float scale,
  bool front, float lampSide, float cssPixelScale, out vec3 lamp, out vec4 centre,
  out vec2 axis, out vec2 halfSize, out float pairHalfSpan, out float lampGain) {
  vec3 right0 = normalize(vec3(forward.z, 0.0, -forward.x));
  vec3 up0 = cross(forward, right0);
  vec3 rightW = right0 * cos(bank) + up0 * sin(bank);
  vec3 upW = up0 * cos(bank) - right0 * sin(bank);
  TrafficLampShape profile = trafficLampProfile(type, front);
  vec4 shape = profile.dimensions;
  vec3 group = pos + scale * (forward * shape.w + upW * profile.y);
  lamp = group + rightW * lampSide * shape.x * scale;
  centre = viewMatrix * vec4(lamp, 1.0);
  vec4 groupV = viewMatrix * vec4(group, 1.0);
  vec3 rightV = mat3(viewMatrix) * rightW;
  vec3 upV = mat3(viewMatrix) * upW;
  float depth = max(-groupV.z, 1.0);
  vec2 rightP = rightV.xy + groupV.xy * rightV.z / depth;
  vec2 upP = upV.xy + groupV.xy * upV.z / depth;
  float rightLength = length(rightP);
  axis = rightLength > ${TRAFFIC_LAMP_KERNEL_CENTER_EPSILON.toExponential(0)} ? rightP / rightLength : vec2(1.0, 0.0);
  float cssPixelM = depth * cssPixelScale;
  // Keep the lamp coverage floor stable when the drawing buffer uses a different DPR.
  float floorSize = ${glslNumber(TRAFFIC_LAMP_MIN_DIAMETER_PX / 2)} * cssPixelM;
  vec2 physicalHalfSize = vec2(shape.y * scale * rightLength * 0.5,
    shape.z * scale * abs(dot(upP, vec2(-axis.y, axis.x))) * 0.5);
  halfSize = vec2(trafficLampFloor(physicalHalfSize.x, floorSize),
    trafficLampFloor(physicalHalfSize.y, floorSize));
  // Bound the extra light from the pixel floor. Resolved patches keep full gain.
  float extent = max(physicalHalfSize.x, physicalHalfSize.y) / floorSize;
  lampGain = mix(${glslNumber(TRAFFIC_LAMP_FLOOR_MIN_GAIN)}, 1.0,
    smoothstep(${glslNumber(1 - TRAFFIC_LAMP_FLOOR_BLEND_SHARE)},
      ${glslNumber(1 + TRAFFIC_LAMP_FLOOR_BLEND_SHARE)}, extent));
  pairHalfSpan = shape.x * scale * rightLength;
}
`;
