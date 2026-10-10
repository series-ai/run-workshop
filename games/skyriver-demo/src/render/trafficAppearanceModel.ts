/**
 * @file trafficAppearanceModel.ts
 * Pure appearance math shared by diagnostics and traffic source. This file needs no WebGL or Three.js.
 */
import {
  farImpostorBrightness,
  HULL_DRAW_DISTANCE_M,
  HULL_DRAW_FADE_START_M,
  hullLodAlpha,
  impostorLightHandoverAlpha,
  impostorSupportTaperAlpha,
  writeSameCarLightLod,
  computeInstanceAlpha,
  IMPOSTOR_TIER_FADE_S,
  type SameCarLightLod,
} from './lightHandover';
import {
  IMPOSTOR_INTENSITY,
  TRAFFIC_QUALITY_SETTINGS,
  TRAFFIC_APPEARANCE_PROFILES,
  TRAFFIC_CPU_LAMP_PICKUP_BAND_M,
  TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF,
  TRAFFIC_CPU_TRAIL_PICKUP_BAND_M,
  TRAFFIC_FOG_PENETRATION,
  TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF,
  TRAFFIC_GPU_SEED_BRIGHTNESS_BASE,
  TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER,
  TRAFFIC_GPU_SEED_BRIGHTNESS_SPAN,
  TRAFFIC_HULL_FADE_RAMP_END,
  TRAFFIC_HULL_HEADLIGHT_RGB,
  TRAFFIC_HULL_TAILLIGHT_RGB,
  TRAFFIC_LAMP_FLOOR_BLEND_SHARE,
  TRAFFIC_LAMP_FLOOR_MIN_GAIN,
  TRAFFIC_LAMP_FRUSTUM_MARGIN_CSS_PX,
  TRAFFIC_LAMP_HEAD_FACING_BAND,
  TRAFFIC_LAMP_KERNEL_CORE_SCALE,
  TRAFFIC_LAMP_KERNEL_CORE_SHARE,
  TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX,
  TRAFFIC_LAMP_KERNEL_CENTER_EPSILON,
  TRAFFIC_LAMP_KERNEL_LIMIT,
  TRAFFIC_LAMP_KERNEL_MIN_PIXEL_SIZE,
  TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE,
  TRAFFIC_LAMP_KERNEL_QUADRATIC_DENOMINATOR,
  TRAFFIC_LAMP_KERNEL_QUADRATIC_NUMERATOR,
  TRAFFIC_LAMP_KERNEL_QUARTIC_COEFFICIENT,
  TRAFFIC_LAMP_MIN_DIAMETER_PX,
  TRAFFIC_LAMP_TAIL_FACING_BAND,
  TRAFFIC_LAMP_STREAK_BODY_EXPONENT,
  TRAFFIC_STREAK_HEAD_WARM_RGB,
  TRAFFIC_STREAK_HEAD_WHITE_RGB,
  TRAFFIC_STREAK_TAIL_RGB,
  TRAFFIC_STREAK_TRAIL_WARM_RGB,
  TRAFFIC_DIRECTION_PITCH_CLAMP,
  TRAFFIC_TRAIL_ALPHA,
  TRAFFIC_TRAIL_END_FADE_EXPONENT,
  TRAFFIC_TRAIL_END_WIDTH_SHARE,
  TRAFFIC_TRAIL_HEAD_FADE_EXPONENT,
  TRAFFIC_TRAIL_MAX_M,
  TRAFFIC_TRAIL_SECONDS,
  TRAFFIC_TRAIL_START_CSS_PIXEL_SCALE,
  TRAFFIC_TRAIL_START_RADIUS_M,
  TRAFFIC_TRAIL_SCREEN_CAP_REFINEMENTS,
  TRAFFIC_TRAIL_TAIL_FADE_EXPONENT,
  TRAFFIC_TRAIL_WARM_FACING_BAND,
  TRAIL_MAX_CAR_LENGTHS,
  trafficCpuTierFade,
  trafficCpuTierProgress,
  trafficDistanceDim,
  trafficThinFarAlpha,
  trafficTrailModeBaseWeight,
  trafficTrailModeFade,
  trafficTrailModeProgress,
  trafficTrailModeWeights,
  trafficTrailWeightFromModeWeights,
  trafficTrailFarFade,
  trafficTrailViewGain,
  trafficAppearanceSmoothstep,
  trafficLampFacingGain,
  type TrafficAppearanceProfile,
} from './trafficAppearance';
import type { TrafficTrailMode } from './trafficTypes';

export type TrafficVec2 = readonly [number, number];
export type TrafficVec3 = readonly [number, number, number];
export type TrafficVec4 = readonly [number, number, number, number];
/** Three.js matrix elements use this column-major order. */
export type TrafficMatrix4 = ArrayLike<number>;
export type TrafficLampSide = 'head' | 'tail';
export type TrafficQualityName = keyof typeof TRAFFIC_QUALITY_SETTINGS;

export interface TrafficRgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface TrafficCameraProjection {
  readonly position: TrafficVec3;
  readonly viewMatrix: TrafficMatrix4;
  readonly projectionMatrix: TrafficMatrix4;
  readonly bufferWidthPx: number;
  readonly bufferHeightPx: number;
  readonly cssWidthPx: number;
  readonly cssHeightPx: number;
  /** Exact `uPixelAngle` value bound to the traffic materials. */
  readonly pixelAngleBuffer: number;
  /** Exact `uCssPixelAngle` value bound to the traffic materials. */
  readonly pixelAngleCss: number;
}

export interface TrafficLampKernelInput {
  readonly position: TrafficVec3;
  /** Direction after the source shader's normalize and pitch clamp. */
  readonly direction: TrafficVec3;
  readonly bankRadians: number;
  readonly typeIndex: number;
  readonly physicalScale: number;
  readonly side: TrafficLampSide;
  /** The current CPU and GPU callers pass 0. Keep this explicit for shader parity probes. */
  readonly lampSide?: number;
  /** CPU trails add the actual uTrailMax cull extension. GPU lamps pass 0. */
  readonly extraCullM?: number;
  /** CPU uses a normalized direction. GPU source uses max(length(toLamp), 1 m). */
  readonly facingLengthFloorM?: number;
  /** GPU impostors use the full path-derived pitch; the CPU streak clamps pitch to +/-0.35. */
  readonly clampPitch?: boolean;
  readonly camera: TrafficCameraProjection;
}

export interface TrafficLampKernelProjection {
  readonly lampWorld: TrafficVec3;
  readonly centerView: TrafficVec4;
  readonly centerClip: TrafficVec4;
  readonly centerNdc: TrafficVec2;
  readonly centerBufferPx: TrafficVec2;
  readonly centerCssPx: TrafficVec2;
  readonly axis: TrafficVec2;
  readonly sourceHalfSizeView: TrafficVec2;
  readonly sourceHalfSizeBufferPx: TrafficVec2;
  readonly sourceHalfSizeCssPx: TrafficVec2;
  readonly floorHalfSizeView: TrafficVec2;
  readonly floorHalfSizeBufferPx: TrafficVec2;
  readonly floorHalfSizeCssPx: TrafficVec2;
  readonly filterHalfSizeView: TrafficVec2;
  readonly filterHalfSizeBufferPx: TrafficVec2;
  readonly filterHalfSizeCssPx: TrafficVec2;
  readonly pairHalfSpanView: number;
  readonly pairHalfSpanBufferPx: number;
  readonly pairHalfSpanCssPx: number;
  readonly pairOffset: number;
  /** First-order pixel derivative at the lamp centre, matching trafficFilteredLamp's inputs. */
  readonly halfPixelUvBuffer: TrafficVec2;
  readonly halfPixelUvCss: TrafficVec2;
  readonly facing: number;
  readonly facingGain: number;
  readonly lampGain: number;
  readonly facingLengthFloorM: number;
  readonly inView: boolean;
  readonly cameraDepthM: number;
}

export interface TrafficLampKernelSample {
  readonly body: number;
  readonly core: number;
}

export interface TrafficLampEnergy {
  /** Continuous source-kernel integral in CSS-pixel units. It does not sample a raster grid. */
  readonly bodyKernelCssPx2: number;
  readonly coreKernelCssPx2: number;
}

export interface TrafficLampRadiance {
  readonly sample: TrafficLampKernelSample;
  readonly color: TrafficRgb;
  readonly gain: number;
  readonly sourceRgbLinear: TrafficRgb;
  readonly foggedRgbLinear: TrafficRgb;
  readonly continuousEnergyRgb: TrafficRgb;
  readonly peakEstimateRgb: TrafficRgb;
  readonly renderedSourceRgbLinear: TrafficRgb;
  readonly renderedFoggedRgbLinear: TrafficRgb;
  readonly renderedContinuousEnergyRgb: TrafficRgb;
  readonly renderedPeakEstimateRgb: TrafficRgb;
  readonly rendered: boolean;
  readonly clippedByFrustum: boolean;
  readonly clippedByShaderCutoff: boolean;
  readonly fogAttenuation: number;
}

export interface TrafficHullLampPatch {
  readonly centerWorld: TrafficVec3;
  readonly centerBufferPx: TrafficVec2;
  readonly centerCssPx: TrafficVec2;
  readonly widthBufferPx: number;
  readonly heightBufferPx: number;
  readonly widthCssPx: number;
  readonly heightCssPx: number;
  readonly sourceRgb: TrafficRgb;
  readonly preFogRgb: TrafficRgb;
  readonly foggedRgb: TrafficRgb;
  /** Coverage-averaged pixel energy before and after fog. Individual dither pixels differ. */
  readonly projectedPreFogEnergyRgb: TrafficRgb;
  readonly projectedFoggedEnergyRgb: TrafficRgb;
  /** Diagnostic estimate weighted by the outward normal. It does not resolve hull self-occlusion. */
  readonly outwardProjectedFoggedEnergyRgb: TrafficRgb;
  readonly projectedAreaCssPx2: number;
  /** Signed outward-facing cosine. A negative value marks the opaque patch's back side. */
  readonly frontFaceCosine: number;
  readonly frontFaceFactor: number;
  readonly facesCameraOnOutwardSide: boolean;
  readonly hasHullRecord: boolean;
  readonly rendered: boolean;
}

export interface TrafficCpuTierState {
  /** -1 means that the CPU count transition is settled. */
  readonly fromCount: number;
  readonly targetCount: number;
  /** Current linear progress, before the renderer's per-car branch. */
  readonly progress: number;
  /** Per-car alpha captured from the last drawn frame when a tier change is retargeted. */
  readonly fromAlphaSnapshot?: ArrayLike<number>;
}

export interface TrafficTrailTransitionState {
  readonly fromMode: TrafficTrailMode;
  readonly targetMode: TrafficTrailMode;
  /** Current change time after the renderer applies a pending mode change. */
  readonly changeTimeS: number;
  readonly timeS: number;
  readonly enabled: boolean;
  /** Captured [all, streams, near] coefficients. Distance remains live during the blend. */
  readonly fromModeWeights?: readonly [number, number, number];
}

export interface SameCarTrafficAppearanceInput {
  readonly position: TrafficVec3;
  readonly carIndex: number;
  /** Motion/rank fade before CPU count-tier fade. */
  readonly sourceFade: number;
  readonly cpuTier: TrafficCpuTierState;
  readonly distanceM: number;
  readonly thinFar: boolean;
  /** Current shared GPU impostor population presence, not an independent GPU car alpha. */
  readonly impostorPresence: number;
  readonly sizeScale: number;
  readonly typeIndex: number;
  readonly bankRadians: number;
  readonly direction: TrafficVec3;
  readonly speedMps: number;
  readonly warmth: number;
  readonly tint: TrafficRgb;
  readonly trailClass: 0 | 1 | 2;
  readonly trailTransition: TrafficTrailTransitionState;
  readonly camera: TrafficCameraProjection;
  readonly emissiveGain: number;
  /** Bound shared analytic factor for the fragment's current world position and depth. */
  readonly fogFactor: number;
  /** Current linear fog colour for the opaque hull patch path. */
  readonly fogColor: TrafficRgb;
  /** `false` when the streak batch has no record for this car in the current tier. */
  readonly hasStreakRecord?: boolean;
  /** False when the archetype's active instance count excludes this car. */
  readonly hasHullRecord?: boolean;
}

export interface SameCarTrafficAppearance {
  readonly identity: { readonly kind: 'same-car'; readonly carIndex: number };
  readonly lod: {
    readonly legacyFarAlpha: number;
    readonly nearAlpha: number;
    readonly impostorProxyAlpha: number;
    readonly totalAlpha: number;
    readonly cpuTierFade: number;
    readonly finalFade: number;
  };
  readonly hull: {
    readonly hasInstance: boolean;
    readonly hullLodAlpha: number;
    readonly scale: number;
    readonly coverage: number;
    readonly distanceDim: number;
    readonly tintGain: number;
    readonly patches: readonly [readonly TrafficHullLampPatch[], readonly TrafficHullLampPatch[]];
  };
  readonly streak: {
    readonly hasRecord: boolean;
    readonly head: TrafficLampRadiance;
    readonly tail: TrafficLampRadiance;
    readonly headPickup: number;
    readonly tailPickup: number;
    readonly trail: TrafficTrailAppearance;
  };
  /** Exact values uploaded into aCarFade and aCarLod. */
  readonly uploaded: {
    readonly hasRecord: boolean;
    readonly aCarFade: TrafficVec4 | null;
    readonly aCarLod: TrafficVec3 | null;
  };
}

export interface IndependentImpostorAppearanceInput {
  readonly instanceIndex: number;
  readonly fromAlpha: number;
  readonly targetCount: number;
  readonly transitionProgress: number;
  readonly distanceM: number;
  readonly position: TrafficVec3;
  readonly direction: TrafficVec3;
  readonly seed: number;
  readonly typeIndex: number;
  readonly physicalScale: number;
  readonly side: TrafficLampSide;
  readonly camera: TrafficCameraProjection;
  readonly emissiveGain: number;
  readonly fogFactor: number;
}

export interface IndependentImpostorAppearance {
  readonly identity: { readonly kind: 'independent-impostor'; readonly instanceIndex: number };
  readonly tierAlpha: number;
  readonly handover: number;
  readonly farBrightness: number;
  readonly seedBuzz: number;
  readonly projection: TrafficLampKernelProjection;
  readonly lamp: TrafficLampRadiance;
  /** The shader clips the whole instance when this exact expression is true. */
  readonly clippedByIntensityCutoff: boolean;
}

export interface TrafficTrailAppearance {
  readonly modeWeight: number;
  readonly distanceFade: number;
  readonly pickup: number;
  readonly nearLodShare: number;
  readonly sourceGain: number;
  readonly alphaScale: number;
  readonly startRadiusViewM: number;
  readonly endRadiusViewM: number;
  readonly startRadiusCssPx: number;
  readonly endRadiusCssPx: number;
  readonly lengthM: number;
  readonly projectedLengthViewM: number;
  readonly lengthInRadii: number;
  readonly projectedQuadAreaCssPx2: number;
  readonly integratedKernelCssPx2: number;
  readonly refinementDeltaCssPx2: number;
  readonly clippedByAttributeCutoff: boolean;
  readonly clippedByFrustum: boolean;
  readonly clippedByClipVolume: boolean;
  readonly rendered: boolean;
  readonly sourceRgbLinear: TrafficRgb;
  readonly foggedRgbLinear: TrafficRgb;
  readonly continuousEnergyRgb: TrafficRgb;
  readonly continuousEnergyRefinementDeltaRgb: TrafficRgb;
  readonly peakEstimateRgb: TrafficRgb;
  readonly renderedSourceRgbLinear: TrafficRgb;
  readonly renderedFoggedRgbLinear: TrafficRgb;
  readonly renderedContinuousEnergyRgb: TrafficRgb;
  readonly renderedPeakEstimateRgb: TrafficRgb;
  readonly sampleKernel: (alongRadius: number, side: number) => number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function dot3(a: TrafficVec3, b: TrafficVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add3(a: TrafficVec3, b: TrafficVec3): TrafficVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a: TrafficVec3, scale: number): TrafficVec3 {
  return [a[0] * scale, a[1] * scale, a[2] * scale];
}

function cross3(a: TrafficVec3, b: TrafficVec3): TrafficVec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize3(a: TrafficVec3): TrafficVec3 {
  const length = Math.hypot(a[0], a[1], a[2]);
  if (!(length > 0) || !Number.isFinite(length)) throw new Error('SKYRIVER_TRAFFIC_MODEL_DIRECTION_INVALID');
  return [a[0] / length, a[1] / length, a[2] / length];
}

function trafficForward(direction: TrafficVec3, clampPitch = true): TrafficVec3 {
  return normalize3([
    direction[0],
    clampPitch ? clamp(direction[1], -TRAFFIC_DIRECTION_PITCH_CLAMP, TRAFFIC_DIRECTION_PITCH_CLAMP) : direction[1],
    direction[2],
  ]);
}

function matrixPoint(matrix: TrafficMatrix4, point: TrafficVec4): TrafficVec4 {
  if (matrix.length !== 16) throw new Error('SKYRIVER_TRAFFIC_MODEL_MATRIX_INVALID');
  return [
    matrix[0]! * point[0] + matrix[4]! * point[1] + matrix[8]! * point[2] + matrix[12]! * point[3],
    matrix[1]! * point[0] + matrix[5]! * point[1] + matrix[9]! * point[2] + matrix[13]! * point[3],
    matrix[2]! * point[0] + matrix[6]! * point[1] + matrix[10]! * point[2] + matrix[14]! * point[3],
    matrix[3]! * point[0] + matrix[7]! * point[1] + matrix[11]! * point[2] + matrix[15]! * point[3],
  ];
}

function matrixVector(matrix: TrafficMatrix4, vector: TrafficVec3): TrafficVec3 {
  if (matrix.length !== 16) throw new Error('SKYRIVER_TRAFFIC_MODEL_MATRIX_INVALID');
  return [
    matrix[0]! * vector[0] + matrix[4]! * vector[1] + matrix[8]! * vector[2],
    matrix[1]! * vector[0] + matrix[5]! * vector[1] + matrix[9]! * vector[2],
    matrix[2]! * vector[0] + matrix[6]! * vector[1] + matrix[10]! * vector[2],
  ];
}

function profileAt(typeIndex: number): TrafficAppearanceProfile {
  const profile = TRAFFIC_APPEARANCE_PROFILES[typeIndex];
  if (!profile) throw new Error('SKYRIVER_TRAFFIC_MODEL_TYPE_INVALID');
  return profile;
}

function sourceProfile(profile: TrafficAppearanceProfile, side: TrafficLampSide) {
  return side === 'head' ? profile.front : profile.rear;
}

function kernelShape(profile: TrafficAppearanceProfile, side: TrafficLampSide) {
  const lamp = sourceProfile(profile, side);
  return {
    lamp,
    x: lamp.kind === 'pair' ? lamp.centreXM : lamp.widthM / 4,
    width: lamp.kind === 'pair' ? lamp.widthM : lamp.widthM / 2,
    height: lamp.heightM,
    z: lamp.zM,
  };
}

function lampPhysicalRadius(profile: TrafficAppearanceProfile): number {
  const radius = (side: TrafficLampSide): number => {
    const lamp = sourceProfile(profile, side);
    return Math.hypot(
      (lamp.kind === 'pair' ? lamp.centreXM : 0) + lamp.widthM / 2,
      Math.abs(lamp.yM) + lamp.heightM / 2,
      Math.abs(lamp.zM),
    );
  };
  return Math.ceil(Math.max(radius('head'), radius('tail')) * TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE)
    / TRAFFIC_LAMP_PHYSICAL_RADIUS_CEILING_SCALE;
}

function projectedFrustumContains(
  position: TrafficVec3,
  profile: TrafficAppearanceProfile,
  scale: number,
  camera: TrafficCameraProjection,
  extraM: number,
): boolean {
  const point = matrixPoint(camera.viewMatrix, [position[0], position[1], position[2], 1]);
  const physicalRadius = lampPhysicalRadius(profile) * scale + extraM;
  const radius = physicalRadius + TRAFFIC_LAMP_FRUSTUM_MARGIN_CSS_PX
    * camera.pixelAngleCss * Math.max(-point[2] + physicalRadius, 1);
  const p = camera.projectionMatrix;
  if (p.length !== 16) throw new Error('SKYRIVER_TRAFFIC_MODEL_MATRIX_INVALID');
  const row = (r: number): TrafficVec4 => [p[r]!, p[4 + r]!, p[8 + r]!, p[12 + r]!];
  const r0 = row(0); const r1 = row(1); const r2 = row(2); const r3 = row(3);
  const planes: TrafficVec4[] = [
    [r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]],
    [r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]],
    [r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]],
    [r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]],
    [r3[0] + r2[0], r3[1] + r2[1], r3[2] + r2[2], r3[3] + r2[3]],
    [r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]],
  ];
  return !planes.some((plane) => {
    const side = plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3] * point[3];
    const normalLength = Math.hypot(plane[0], plane[1], plane[2]);
    return side < -radius * normalLength;
  });
}

function floorLampSize(physical: number, floorSize: number): number {
  const width = floorSize * TRAFFIC_LAMP_FLOOR_BLEND_SHARE;
  const overlap = Math.max(width - Math.abs(physical - floorSize), 0);
  return Math.max(physical, floorSize) + overlap * overlap / (4 * width);
}

function viewAxis(input: TrafficLampKernelInput): {
  readonly position: TrafficVec3;
  readonly right: TrafficVec3;
  readonly up: TrafficVec3;
  readonly profile: TrafficAppearanceProfile;
  readonly forward: TrafficVec3;
  readonly shape: ReturnType<typeof kernelShape>;
  readonly group: TrafficVec3;
  readonly lamp: TrafficVec3;
  readonly groupView: TrafficVec4;
  readonly lampView: TrafficVec4;
  readonly rightView: TrafficVec3;
  readonly upView: TrafficVec3;
} {
  const profile = profileAt(input.typeIndex);
  const shape = kernelShape(profile, input.side);
  const forward = trafficForward(input.direction, input.clampPitch !== false);
  const right0 = normalize3([forward[2], 0, -forward[0]]);
  const up0 = cross3(forward, right0);
  const cb = Math.cos(input.bankRadians);
  const sb = Math.sin(input.bankRadians);
  const right: TrafficVec3 = [
    right0[0] * cb + up0[0] * sb,
    right0[1] * cb + up0[1] * sb,
    right0[2] * cb + up0[2] * sb,
  ];
  const up: TrafficVec3 = [
    up0[0] * cb - right0[0] * sb,
    up0[1] * cb - right0[1] * sb,
    up0[2] * cb - right0[2] * sb,
  ];
  const group = add3(input.position, scale3(add3(scale3(forward, shape.z), scale3(up, shape.lamp.yM)), input.physicalScale));
  const lamp = add3(group, scale3(right, (input.lampSide ?? 0) * shape.x * input.physicalScale));
  const groupView = matrixPoint(input.camera.viewMatrix, [group[0], group[1], group[2], 1]);
  const lampView = matrixPoint(input.camera.viewMatrix, [lamp[0], lamp[1], lamp[2], 1]);
  return {
    position: input.position,
    right,
    up,
    profile,
    forward,
    shape,
    group,
    lamp,
    groupView,
    lampView,
    rightView: matrixVector(input.camera.viewMatrix, right),
    upView: matrixVector(input.camera.viewMatrix, up),
  };
}

/** Mirrors the current shared GLSL kernel geometry, CSS floor, buffer filter margin, and cull test. */
export function projectTrafficLampKernel(input: TrafficLampKernelInput): TrafficLampKernelProjection {
  if (!Number.isInteger(input.typeIndex) || !Number.isFinite(input.physicalScale) || input.physicalScale < 1 || input.physicalScale > 6) {
    throw new Error('SKYRIVER_TRAFFIC_MODEL_APPEARANCE_INVALID');
  }
  const frame = viewAxis(input);
  const view = frame.lampView;
  const depth = Math.max(-frame.groupView[2], 1);
  const rightP: TrafficVec2 = [
    frame.rightView[0] + frame.groupView[0] * frame.rightView[2] / depth,
    frame.rightView[1] + frame.groupView[1] * frame.rightView[2] / depth,
  ];
  const upP: TrafficVec2 = [
    frame.upView[0] + frame.groupView[0] * frame.upView[2] / depth,
    frame.upView[1] + frame.groupView[1] * frame.upView[2] / depth,
  ];
  const rightLength = Math.hypot(rightP[0], rightP[1]);
  const axis: TrafficVec2 = rightLength > TRAFFIC_LAMP_KERNEL_CENTER_EPSILON
    ? [rightP[0] / rightLength, rightP[1] / rightLength]
    : [1, 0];
  const perpendicular: TrafficVec2 = [-axis[1], axis[0]];
  const sourceX = frame.shape.width * input.physicalScale * rightLength * 0.5;
  const sourceY = frame.shape.height * input.physicalScale
    * Math.abs(upP[0] * perpendicular[0] + upP[1] * perpendicular[1]) * 0.5;
  const floorSize = TRAFFIC_LAMP_MIN_DIAMETER_PX * 0.5 * depth * input.camera.pixelAngleCss;
  const floorX = floorLampSize(sourceX, floorSize);
  const floorY = floorLampSize(sourceY, floorSize);
  const pairHalfSpan = frame.shape.x * input.physicalScale * rightLength;
  const halfBufferX = floorX / (depth * input.camera.pixelAngleBuffer);
  const halfBufferY = floorY / (depth * input.camera.pixelAngleBuffer);
  const halfCssX = floorX / (depth * input.camera.pixelAngleCss);
  const halfCssY = floorY / (depth * input.camera.pixelAngleCss);
  const pairBuffer = pairHalfSpan / (depth * input.camera.pixelAngleBuffer);
  const pairCss = pairHalfSpan / (depth * input.camera.pixelAngleCss);
  const pixelFilterView = depth * input.camera.pixelAngleBuffer * 0.5;
  const filterX = floorX + pairHalfSpan + pixelFilterView;
  const filterY = floorY + pixelFilterView;
  const filterBuffer: TrafficVec2 = [
    filterX / (depth * input.camera.pixelAngleBuffer),
    filterY / (depth * input.camera.pixelAngleBuffer),
  ];
  const filterCss: TrafficVec2 = [
    filterX / (depth * input.camera.pixelAngleCss),
    filterY / (depth * input.camera.pixelAngleCss),
  ];
  const dUdx = axis[0] / halfBufferX;
  const dUdy = axis[1] / halfBufferX;
  const dVdx = perpendicular[0] / halfBufferY;
  const dVdy = perpendicular[1] / halfBufferY;
  const halfPixelUvBuffer: TrafficVec2 = [
    0.5 * Math.hypot(dUdx, dUdy),
    0.5 * Math.hypot(dVdx, dVdy),
  ];
  const scaleDpr = input.camera.pixelAngleCss / input.camera.pixelAngleBuffer;
  const halfPixelUvCss: TrafficVec2 = [halfPixelUvBuffer[0] * scaleDpr, halfPixelUvBuffer[1] * scaleDpr];
  const extent = Math.max(sourceX, sourceY) / floorSize;
  const lampGain = TRAFFIC_LAMP_FLOOR_MIN_GAIN
    + (1 - TRAFFIC_LAMP_FLOOR_MIN_GAIN)
      * trafficAppearanceSmoothstep(1 - TRAFFIC_LAMP_FLOOR_BLEND_SHARE, 1 + TRAFFIC_LAMP_FLOOR_BLEND_SHARE, extent);
  const centerClip = matrixPoint(input.camera.projectionMatrix, view);
  const reciprocalW = centerClip[3] !== 0 ? 1 / centerClip[3] : 0;
  const centerNdc: TrafficVec2 = [centerClip[0] * reciprocalW, centerClip[1] * reciprocalW];
  const centerBufferPx: TrafficVec2 = [
    (centerNdc[0] * 0.5 + 0.5) * input.camera.bufferWidthPx,
    (1 - (centerNdc[1] * 0.5 + 0.5)) * input.camera.bufferHeightPx,
  ];
  const centerCssPx: TrafficVec2 = [
    (centerNdc[0] * 0.5 + 0.5) * input.camera.cssWidthPx,
    (1 - (centerNdc[1] * 0.5 + 0.5)) * input.camera.cssHeightPx,
  ];
  const cameraDelta: TrafficVec3 = [
    input.camera.position[0] - frame.lamp[0],
    input.camera.position[1] - frame.lamp[1],
    input.camera.position[2] - frame.lamp[2],
  ];
  const cameraDistance = Math.hypot(cameraDelta[0], cameraDelta[1], cameraDelta[2]);
  const facingLengthFloorM = input.facingLengthFloorM ?? 0;
  const toCamera = cameraDistance > 0
    ? scale3(cameraDelta, 1 / Math.max(cameraDistance, facingLengthFloorM))
    : [0, 0, 0] as const;
  const facing = dot3(frame.forward, toCamera);
  return {
    lampWorld: frame.lamp,
    centerView: view,
    centerClip,
    centerNdc,
    centerBufferPx,
    centerCssPx,
    axis,
    sourceHalfSizeView: [sourceX, sourceY],
    sourceHalfSizeBufferPx: [sourceX / (depth * input.camera.pixelAngleBuffer), sourceY / (depth * input.camera.pixelAngleBuffer)],
    sourceHalfSizeCssPx: [sourceX / (depth * input.camera.pixelAngleCss), sourceY / (depth * input.camera.pixelAngleCss)],
    floorHalfSizeView: [floorX, floorY],
    floorHalfSizeBufferPx: [halfBufferX, halfBufferY],
    floorHalfSizeCssPx: [halfCssX, halfCssY],
    filterHalfSizeView: [filterX, filterY],
    filterHalfSizeBufferPx: filterBuffer,
    filterHalfSizeCssPx: filterCss,
    pairHalfSpanView: pairHalfSpan,
    pairHalfSpanBufferPx: pairBuffer,
    pairHalfSpanCssPx: pairCss,
    pairOffset: pairHalfSpan / floorX,
    halfPixelUvBuffer,
    halfPixelUvCss,
    facing,
    facingGain: trafficLampFacingGain(facing, input.side === 'head'),
    lampGain,
    facingLengthFloorM,
    inView: projectedFrustumContains(input.position, frame.profile, input.physicalScale, input.camera, input.extraCullM ?? 0),
    cameraDepthM: -view[2],
  };
}

function lampPrimitive(value: number): number {
  const c = clamp(value, -TRAFFIC_LAMP_KERNEL_LIMIT, TRAFFIC_LAMP_KERNEL_LIMIT);
  const c2 = c * c;
  return c * (1 - c2 * (TRAFFIC_LAMP_KERNEL_QUADRATIC_NUMERATOR / TRAFFIC_LAMP_KERNEL_QUADRATIC_DENOMINATOR)
    + c2 * c2 * TRAFFIC_LAMP_KERNEL_QUARTIC_COEFFICIENT);
}

function boxLamp(uv: TrafficVec2, halfPixel: TrafficVec2): number {
  const dx = Math.max(2 * halfPixel[0], TRAFFIC_LAMP_KERNEL_MIN_PIXEL_SIZE);
  const dy = Math.max(2 * halfPixel[1], TRAFFIC_LAMP_KERNEL_MIN_PIXEL_SIZE);
  const ix = (lampPrimitive(uv[0] + halfPixel[0]) - lampPrimitive(uv[0] - halfPixel[0])) / dx;
  const iy = (lampPrimitive(uv[1] + halfPixel[1]) - lampPrimitive(uv[1] - halfPixel[1])) / dy;
  return Math.max(ix * iy, 0);
}

function filteredLamp(uv: TrafficVec2, halfPixel: TrafficVec2): TrafficLampKernelSample {
  return {
    body: boxLamp(uv, halfPixel),
    core: boxLamp(
      [uv[0] * TRAFFIC_LAMP_KERNEL_CORE_SCALE, uv[1] * TRAFFIC_LAMP_KERNEL_CORE_SCALE],
      [halfPixel[0] * TRAFFIC_LAMP_KERNEL_CORE_SCALE, halfPixel[1] * TRAFFIC_LAMP_KERNEL_CORE_SCALE],
    ),
  };
}

/** Mirrors `trafficLampPair` for one fragment coordinate and shader derivative. */
export function sampleTrafficLampKernel(
  uv: TrafficVec2,
  halfPixel: TrafficVec2,
  pairOffset: number,
): TrafficLampKernelSample {
  const left = filteredLamp([uv[0] - pairOffset, uv[1]], halfPixel);
  const right = filteredLamp([uv[0] + pairOffset, uv[1]], halfPixel);
  return { body: 0.5 * (left.body + right.body), core: 0.5 * (left.core + right.core) };
}

/** Continuous integral of the analytic lamp source kernel before pixel-grid sampling. */
export function integrateTrafficLampKernel(projection: TrafficLampKernelProjection): TrafficLampEnergy {
  const hx = projection.floorHalfSizeCssPx[0];
  const hy = projection.floorHalfSizeCssPx[1];
  const base = hx * hy * (16 / 15) ** 2;
  const core = TRAFFIC_LAMP_KERNEL_CORE_SHARE * hx * hy
    * (16 / (15 * TRAFFIC_LAMP_KERNEL_CORE_SCALE)) ** 2;
  return { bodyKernelCssPx2: base, coreKernelCssPx2: core };
}

function rgb(r: number, g: number, b: number): TrafficRgb {
  return { r, g, b };
}

function mixRgb(a: TrafficRgb, b: TrafficRgb, amount: number): TrafficRgb {
  return rgb(a.r + (b.r - a.r) * amount, a.g + (b.g - a.g) * amount, a.b + (b.b - a.b) * amount);
}

function multiplyRgb(a: TrafficRgb, amount: number): TrafficRgb {
  return rgb(a.r * amount, a.g * amount, a.b * amount);
}

function addRgb(a: TrafficRgb, b: TrafficRgb): TrafficRgb {
  return rgb(a.r + b.r, a.g + b.g, a.b + b.b);
}

function lightColor(side: TrafficLampSide, warmth: number): TrafficRgb {
  return side === 'head'
    ? mixRgb(rgb(...TRAFFIC_STREAK_HEAD_WHITE_RGB), rgb(...TRAFFIC_STREAK_HEAD_WARM_RGB), warmth)
    : rgb(...TRAFFIC_STREAK_TAIL_RGB);
}

function lampKernelColor(sample: TrafficLampKernelSample, color: TrafficRgb): TrafficRgb {
  const white = rgb(1, 1, 1);
  return addRgb(multiplyRgb(color, sample.body), multiplyRgb(mixRgb(color, white, TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX), sample.core * TRAFFIC_LAMP_KERNEL_CORE_SHARE));
}

function fogLightFactor(fogFactor: number): number {
  return Math.pow(Math.max(1 - clamp(fogFactor, 0, 1), 0), TRAFFIC_FOG_PENETRATION);
}

function lampPeakEstimate(
  projection: TrafficLampKernelProjection,
  color: TrafficRgb,
  gain: number,
  emissiveGain: number,
  fogFactor: number,
): Omit<TrafficLampRadiance, 'renderedSourceRgbLinear' | 'renderedFoggedRgbLinear'
  | 'renderedContinuousEnergyRgb' | 'renderedPeakEstimateRgb' | 'rendered'
  | 'clippedByFrustum' | 'clippedByShaderCutoff'> {
  const offset = projection.pairOffset;
  const samples = [
    sampleTrafficLampKernel([0, 0], projection.halfPixelUvBuffer, offset),
    sampleTrafficLampKernel([-offset, 0], projection.halfPixelUvBuffer, offset),
    sampleTrafficLampKernel([offset, 0], projection.halfPixelUvBuffer, offset),
  ];
  let peak: TrafficRgb = rgb(0, 0, 0);
  let peakValue = -Infinity;
  for (const sample of samples) {
    const candidate = multiplyRgb(lampKernelColor(sample, color), gain * emissiveGain);
    const luminance = candidate.r * 0.2126 + candidate.g * 0.7152 + candidate.b * 0.0722;
    if (luminance > peakValue) { peakValue = luminance; peak = candidate; }
  }
  const center = samples[0]!;
  const sourceRgbLinear = multiplyRgb(lampKernelColor(center, color), gain * emissiveGain);
  const fogAttenuation = fogLightFactor(fogFactor);
  const energy = integrateTrafficLampKernel(projection);
  const bodyEnergy = multiplyRgb(color, gain * emissiveGain * energy.bodyKernelCssPx2);
  const coreEnergy = multiplyRgb(mixRgb(color, rgb(1, 1, 1), TRAFFIC_LAMP_KERNEL_CORE_WHITE_MIX), gain * emissiveGain * energy.coreKernelCssPx2);
  return {
    sample: center,
    color,
    gain,
    sourceRgbLinear,
    foggedRgbLinear: multiplyRgb(sourceRgbLinear, fogAttenuation),
    continuousEnergyRgb: multiplyRgb(addRgb(bodyEnergy, coreEnergy), fogAttenuation),
    peakEstimateRgb: multiplyRgb(peak, fogAttenuation),
    fogAttenuation,
  };
}

function withLampVisibility(
  source: ReturnType<typeof lampPeakEstimate>,
  rendered: boolean,
  clippedByFrustum: boolean,
  clippedByShaderCutoff: boolean,
): TrafficLampRadiance {
  return {
    ...source,
    renderedSourceRgbLinear: rendered ? source.sourceRgbLinear : rgb(0, 0, 0),
    renderedFoggedRgbLinear: rendered ? source.foggedRgbLinear : rgb(0, 0, 0),
    renderedContinuousEnergyRgb: rendered ? source.continuousEnergyRgb : rgb(0, 0, 0),
    renderedPeakEstimateRgb: rendered ? source.peakEstimateRgb : rgb(0, 0, 0),
    rendered,
    clippedByFrustum,
    clippedByShaderCutoff,
  };
}

function patchWorldPosition(
  origin: TrafficVec3,
  direction: TrafficVec3,
  bankRadians: number,
  scale: number,
  x: number,
  y: number,
  z: number,
): TrafficVec3 {
  const forward = trafficForward(direction);
  const right0 = normalize3([forward[2], 0, -forward[0]]);
  const up0 = cross3(forward, right0);
  const cb = Math.cos(bankRadians);
  const sb = Math.sin(bankRadians);
  const right: TrafficVec3 = [right0[0] * cb + up0[0] * sb, right0[1] * cb + up0[1] * sb, right0[2] * cb + up0[2] * sb];
  const up: TrafficVec3 = [up0[0] * cb - right0[0] * sb, up0[1] * cb - right0[1] * sb, up0[2] * cb - right0[2] * sb];
  const local: TrafficVec3 = [forward[0] * z + right[0] * x + up[0] * y,
    forward[1] * z + right[1] * x + up[1] * y,
    forward[2] * z + right[2] * x + up[2] * y];
  return add3(origin, scale3(local, scale));
}

function projectPatchBounds(corners: readonly TrafficVec3[], camera: TrafficCameraProjection): {
  centerBufferPx: TrafficVec2; centerCssPx: TrafficVec2; widthBufferPx: number; heightBufferPx: number;
  widthCssPx: number; heightCssPx: number; projectedAreaCssPx2: number;
} {
  const projected = corners.map((corner) => {
    const view = matrixPoint(camera.viewMatrix, [corner[0], corner[1], corner[2], 1]);
    const clip = matrixPoint(camera.projectionMatrix, view);
    const invW = clip[3] !== 0 ? 1 / clip[3] : 0;
    const x = clip[0] * invW;
    const y = clip[1] * invW;
    return {
      xBuffer: (x * 0.5 + 0.5) * camera.bufferWidthPx,
      yBuffer: (1 - (y * 0.5 + 0.5)) * camera.bufferHeightPx,
      xCss: (x * 0.5 + 0.5) * camera.cssWidthPx,
      yCss: (1 - (y * 0.5 + 0.5)) * camera.cssHeightPx,
    };
  });
  const min = (key: 'xBuffer' | 'yBuffer' | 'xCss' | 'yCss'): number => Math.min(...projected.map((p) => p[key]));
  const max = (key: 'xBuffer' | 'yBuffer' | 'xCss' | 'yCss'): number => Math.max(...projected.map((p) => p[key]));
  const triangleArea = (a: typeof projected[number], b: typeof projected[number], c: typeof projected[number]): number =>
    Math.abs((b.xCss - a.xCss) * (c.yCss - a.yCss) - (b.yCss - a.yCss) * (c.xCss - a.xCss)) * 0.5;
  return {
    centerBufferPx: [(min('xBuffer') + max('xBuffer')) / 2, (min('yBuffer') + max('yBuffer')) / 2],
    centerCssPx: [(min('xCss') + max('xCss')) / 2, (min('yCss') + max('yCss')) / 2],
    widthBufferPx: max('xBuffer') - min('xBuffer'),
    heightBufferPx: max('yBuffer') - min('yBuffer'),
    widthCssPx: max('xCss') - min('xCss'),
    heightCssPx: max('yCss') - min('yCss'),
    projectedAreaCssPx2: triangleArea(projected[0]!, projected[1]!, projected[2]!)
      + triangleArea(projected[0]!, projected[2]!, projected[3]!),
  };
}

function hullPatchAppearance(
  input: SameCarTrafficAppearanceInput,
  side: TrafficLampSide,
  hullScale: number,
  tintGain: number,
  hasHullRecord: boolean,
  coverage: number,
): TrafficHullLampPatch[] {
  const profile = sourceProfile(profileAt(input.typeIndex), side);
  const centers = profile.kind === 'pair' ? [profile.centreXM, -profile.centreXM] : [0];
  const baseSource = side === 'head' ? rgb(...TRAFFIC_HULL_HEADLIGHT_RGB) : rgb(...TRAFFIC_HULL_TAILLIGHT_RGB);
  const source = rgb(baseSource.r * input.tint.r, baseSource.g * input.tint.g, baseSource.b * input.tint.b);
  return centers.map((centerX) => {
    const x0 = centerX - profile.widthM / 2;
    const x1 = centerX + profile.widthM / 2;
    const y0 = profile.yM - profile.heightM / 2;
    const y1 = profile.yM + profile.heightM / 2;
    const corners: TrafficVec3[] = [
      patchWorldPosition(input.position, input.direction, input.bankRadians, hullScale, x0, y0, profile.zM),
      patchWorldPosition(input.position, input.direction, input.bankRadians, hullScale, x1, y0, profile.zM),
      patchWorldPosition(input.position, input.direction, input.bankRadians, hullScale, x1, y1, profile.zM),
      patchWorldPosition(input.position, input.direction, input.bankRadians, hullScale, x0, y1, profile.zM),
    ];
    const bounds = projectPatchBounds(corners, input.camera);
    const preFogRgb = multiplyRgb(source, tintGain);
    const foggedRgb = rgb(
      preFogRgb.r * (1 - clamp(input.fogFactor, 0, 1)) + input.fogColor.r * clamp(input.fogFactor, 0, 1),
      preFogRgb.g * (1 - clamp(input.fogFactor, 0, 1)) + input.fogColor.g * clamp(input.fogFactor, 0, 1),
      preFogRgb.b * (1 - clamp(input.fogFactor, 0, 1)) + input.fogColor.b * clamp(input.fogFactor, 0, 1),
    );
    const centerWorld = patchWorldPosition(input.position, input.direction, input.bankRadians, hullScale, centerX, profile.yM, profile.zM);
    const forward = trafficForward(input.direction);
    const outwardNormal = side === 'head' ? forward : scale3(forward, -1);
    const toCameraDelta: TrafficVec3 = [
      input.camera.position[0] - centerWorld[0],
      input.camera.position[1] - centerWorld[1],
      input.camera.position[2] - centerWorld[2],
    ];
    const toCameraLength = Math.hypot(toCameraDelta[0], toCameraDelta[1], toCameraDelta[2]);
    const toCamera = toCameraLength > 0 ? scale3(toCameraDelta, 1 / toCameraLength) : [0, 0, 0] as const;
    const frontFaceCosine = dot3(outwardNormal, toCamera);
    return {
      centerWorld,
      ...bounds,
      sourceRgb: source,
      preFogRgb,
      foggedRgb,
      projectedPreFogEnergyRgb: multiplyRgb(preFogRgb, bounds.projectedAreaCssPx2 * coverage),
      projectedFoggedEnergyRgb: multiplyRgb(foggedRgb, bounds.projectedAreaCssPx2 * coverage),
      frontFaceCosine,
      frontFaceFactor: Math.max(frontFaceCosine, 0),
      facesCameraOnOutwardSide: frontFaceCosine > 0,
      outwardProjectedFoggedEnergyRgb: multiplyRgb(
        foggedRgb,
        frontFaceCosine > 0 ? bounds.projectedAreaCssPx2 * coverage : 0,
      ),
      hasHullRecord,
      rendered: hasHullRecord && coverage > 0,
    };
  });
}

/** Retarget each CPU car from its captured fade value. */
export function evaluateCpuTierFade(
  carIndex: number,
  fromCount: number,
  targetCount: number,
  progress: number,
  fromAlphaSnapshot?: ArrayLike<number>,
): number {
  return trafficCpuTierFade(carIndex, fromCount, targetCount, progress, fromAlphaSnapshot);
}

/** Current linear CPU count-transition progress from the render clock. */
export function evaluateCpuTierProgress(timeS: number, changeTimeS: number): number {
  return trafficCpuTierProgress(timeS, changeTimeS, IMPOSTOR_TIER_FADE_S);
}

/** Current trail-mode target weight for an escort, stream, or free CPU car. */
export function evaluateTrailModeBaseWeight(mode: TrafficTrailMode, trailClass: 0 | 1 | 2, distanceSq: number): number {
  return trafficTrailModeBaseWeight(mode, trailClass, distanceSq);
}

/** Captured trail-mode coefficients in [all, streams, near] order. */
export function evaluateTrailModeWeights(mode: TrafficTrailMode): readonly [number, number, number] {
  return trafficTrailModeWeights(mode);
}

/** Current additional far-trail response shared with the CPU attributes and shader geometry. */
export function evaluateTrailFarFade(distanceM: number): number {
  return trafficTrailFarFade(distanceM);
}

/** Applies captured coefficients to the current class and distance response. */
export function evaluateTrailWeightFromModeWeights(
  weights: ArrayLike<number>,
  trailClass: 0 | 1 | 2,
  distanceSq: number,
): number {
  return trafficTrailWeightFromModeWeights(weights, trailClass, distanceSq);
}

/** The renderer's smoothstep progress for a trail-mode transition. */
export function evaluateTrailModeProgress(elapsedS: number): number {
  return trafficTrailModeProgress(elapsedS, IMPOSTOR_TIER_FADE_S);
}

/** Current trail-mode blend. It matches traffic.ts, including its current retarget behavior. */
export function evaluateTrailModeFade(
  fromMode: TrafficTrailMode,
  targetMode: TrafficTrailMode,
  trailClass: 0 | 1 | 2,
  distanceSq: number,
  progress: number,
  enabled = true,
  fromModeWeights?: ArrayLike<number>,
): number {
  return trafficTrailModeFade(fromMode, targetMode, trailClass, distanceSq, progress, enabled, fromModeWeights);
}

/** Current express thin-far gate. The renderer smooths squared distances. */
export function evaluateThinFarAlpha(distanceSq: number, thinFar: boolean): number {
  return trafficThinFarAlpha(distanceSq, thinFar);
}

/** Distance dim for the per-instance hull tint. */
export function evaluateTrafficDistanceDim(distanceSq: number): number {
  return trafficDistanceDim(distanceSq);
}

function evaluateLampRadiance(
  projection: TrafficLampKernelProjection,
  color: TrafficRgb,
  gain: number,
  emissiveGain: number,
  fogFactor: number,
  hasRecord: boolean,
  clippedByShaderCutoff = false,
): TrafficLampRadiance {
  const unculled = lampPeakEstimate(projection, color, gain, emissiveGain, fogFactor);
  const clippedByFrustum = !projection.inView;
  const rendered = hasRecord && !clippedByFrustum && !clippedByShaderCutoff;
  return withLampVisibility(unculled, rendered, clippedByFrustum, clippedByShaderCutoff);
}

function carProfileLength(typeIndex: number): number {
  const profile = profileAt(typeIndex);
  return profile.front.zM - profile.rear.zM;
}

function cameraSampleDistance(point: TrafficVec3, camera: TrafficVec3): number {
  return Math.hypot(point[0] - camera[0], point[1] - camera[1], point[2] - camera[2]);
}

function viewPoint(world: TrafficVec3, camera: TrafficCameraProjection): TrafficVec4 {
  return matrixPoint(camera.viewMatrix, [world[0], world[1], world[2], 1]);
}

function projectWorldNdc(world: TrafficVec3, camera: TrafficCameraProjection): TrafficVec2 {
  const clip = matrixPoint(camera.projectionMatrix, viewPoint(world, camera));
  const invW = clip[3] !== 0 ? 1 / clip[3] : 0;
  return [clip[0] * invW, clip[1] * invW];
}

function projectedDistanceView(a: TrafficVec3, b: TrafficVec3, camera: TrafficCameraProjection): number {
  const av = viewPoint(a, camera);
  const bv = viewPoint(b, camera);
  const ax = av[0] / Math.max(-av[2], 1);
  const ay = av[1] / Math.max(-av[2], 1);
  const bx = bv[0] / Math.max(-bv[2], 1);
  const by = bv[1] / Math.max(-bv[2], 1);
  return Math.hypot(ax - bx, ay - by);
}

function trailKernelValue(alongRadius: number, side: number, lengthInRadii: number): number {
  const along = clamp(alongRadius, 0, lengthInRadii);
  const distance = Math.hypot(alongRadius - along, side);
  const support = impostorSupportTaperAlpha(distance);
  const body = Math.exp(-distance * distance * TRAFFIC_LAMP_STREAK_BODY_EXPONENT) * support;
  const t = lengthInRadii > 0 ? along / lengthInRadii : 0;
  return body * Math.pow(Math.max(1 - t, 0), TRAFFIC_TRAIL_END_FADE_EXPONENT);
}

interface ProjectedTrailCorner {
  readonly clip: TrafficVec4;
  readonly clipW: number;
  readonly xCss: number;
  readonly yCss: number;
  readonly capsule: TrafficVec2;
}

function projectTrailClipCorner(clip: TrafficVec4, capsule: TrafficVec2, camera: TrafficCameraProjection): ProjectedTrailCorner {
  const reciprocalW = clip[3] !== 0 ? 1 / clip[3] : 0;
  const xNdc = clip[0] * reciprocalW;
  const yNdc = clip[1] * reciprocalW;
  return {
    clip,
    clipW: clip[3],
    xCss: (xNdc * 0.5 + 0.5) * camera.cssWidthPx,
    yCss: (1 - (yNdc * 0.5 + 0.5)) * camera.cssHeightPx,
    capsule,
  };
}

function projectTrailCorner(view: TrafficVec3, capsule: TrafficVec2, camera: TrafficCameraProjection): ProjectedTrailCorner {
  return projectTrailClipCorner(matrixPoint(camera.projectionMatrix, [view[0], view[1], view[2], 1]), capsule, camera);
}

function clipTrailTriangle(
  corners: readonly [ProjectedTrailCorner, ProjectedTrailCorner, ProjectedTrailCorner],
  camera: TrafficCameraProjection,
): ProjectedTrailCorner[] {
  const planeDistance = (point: TrafficVec4, plane: number): number => {
    switch (plane) {
      case 0: return point[3] + point[0];
      case 1: return point[3] - point[0];
      case 2: return point[3] + point[1];
      case 3: return point[3] - point[1];
      case 4: return point[3] + point[2];
      default: return point[3] - point[2];
    }
  };
  let polygon = [...corners];
  for (let plane = 0; plane < 6 && polygon.length > 0; plane += 1) {
    const clipped: ProjectedTrailCorner[] = [];
    let previous = polygon[polygon.length - 1]!;
    let previousDistance = planeDistance(previous.clip, plane);
    for (const current of polygon) {
      const currentDistance = planeDistance(current.clip, plane);
      const previousInside = previousDistance >= 0;
      const currentInside = currentDistance >= 0;
      if (previousInside !== currentInside) {
        const denominator = previousDistance - currentDistance;
        const t = denominator !== 0 ? previousDistance / denominator : 0;
        const clip: TrafficVec4 = [
          previous.clip[0] + (current.clip[0] - previous.clip[0]) * t,
          previous.clip[1] + (current.clip[1] - previous.clip[1]) * t,
          previous.clip[2] + (current.clip[2] - previous.clip[2]) * t,
          previous.clip[3] + (current.clip[3] - previous.clip[3]) * t,
        ];
        const capsule: TrafficVec2 = [
          previous.capsule[0] + (current.capsule[0] - previous.capsule[0]) * t,
          previous.capsule[1] + (current.capsule[1] - previous.capsule[1]) * t,
        ];
        clipped.push(projectTrailClipCorner(clip, capsule, camera));
      }
      if (currentInside) clipped.push(current);
      previous = current;
      previousDistance = currentDistance;
    }
    polygon = clipped;
  }
  return polygon;
}

function triangleAreaCssPx2(a: ProjectedTrailCorner, b: ProjectedTrailCorner, c: ProjectedTrailCorner): number {
  return Math.abs((b.xCss - a.xCss) * (c.yCss - a.yCss) - (b.yCss - a.yCss) * (c.xCss - a.xCss)) * 0.5;
}

/**
 * Integrate the actual two indexed trail triangles in screen space. This keeps each triangle's
 * perspective-correct varying interpolation and screen-space Jacobian. It remains a continuous
 * pre-raster estimate; it does not include pixel-center sampling or blend state.
 */
function integrateProjectedTrailTriangle(
  a: ProjectedTrailCorner,
  b: ProjectedTrailCorner,
  c: ProjectedTrailCorner,
  lengthInRadii: number,
  subdivisions: number,
): { readonly areaCssPx2: number; readonly kernelCssPx2: number } {
  const areaCssPx2 = triangleAreaCssPx2(a, b, c);
  const invWa = a.clipW !== 0 ? 1 / a.clipW : 0;
  const invWb = b.clipW !== 0 ? 1 / b.clipW : 0;
  const invWc = c.clipW !== 0 ? 1 / c.clipW : 0;
  const at = (u: number, v: number): number => {
    const wa = (1 - u - v) * invWa;
    const wb = u * invWb;
    const wc = v * invWc;
    const denominator = wa + wb + wc;
    if (denominator === 0) return 0;
    const x = (wa * a.capsule[0] + wb * b.capsule[0] + wc * c.capsule[0]) / denominator;
    const y = (wa * a.capsule[1] + wb * b.capsule[1] + wc * c.capsule[1]) / denominator;
    return trailKernelValue(x, y, lengthInRadii);
  };
  let sum = 0;
  const n = subdivisions;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n - i; j += 1) {
      sum += at((i + 1 / 3) / n, (j + 1 / 3) / n);
      if (i + j < n - 1) sum += at((i + 2 / 3) / n, (j + 2 / 3) / n);
    }
  }
  return { areaCssPx2, kernelCssPx2: areaCssPx2 * sum / (n * n) };
}

function integrateProjectedTrail(
  corners: readonly [ProjectedTrailCorner, ProjectedTrailCorner, ProjectedTrailCorner, ProjectedTrailCorner],
  camera: TrafficCameraProjection,
  lengthInRadii: number,
): { readonly areaCssPx2: number; readonly kernelCssPx2: number; readonly refinementDeltaCssPx2: number } {
  const triangles = [[0, 1, 2], [0, 2, 3]] as const;
  let areaCssPx2 = 0;
  let coarseCssPx2 = 0;
  let fineCssPx2 = 0;
  for (const triangle of triangles) {
    const clipped = clipTrailTriangle([
      corners[triangle[0]], corners[triangle[1]], corners[triangle[2]],
    ], camera);
    if (clipped.length < 3) continue;
    const a = clipped[0]!;
    for (let i = 1; i < clipped.length - 1; i += 1) {
      const b = clipped[i]!;
      const c = clipped[i + 1]!;
      const coarse = integrateProjectedTrailTriangle(a, b, c, lengthInRadii, 8);
      const fine = integrateProjectedTrailTriangle(a, b, c, lengthInRadii, 16);
      areaCssPx2 += fine.areaCssPx2;
      coarseCssPx2 += coarse.kernelCssPx2;
      fineCssPx2 += fine.kernelCssPx2;
    }
  }
  return { areaCssPx2, kernelCssPx2: fineCssPx2, refinementDeltaCssPx2: Math.abs(fineCssPx2 - coarseCssPx2) };
}

function cpuTrailAppearance(input: SameCarTrafficAppearanceInput, lod: SameCarLightLod, finalFade: number, distanceSq: number): TrafficTrailAppearance {
  const elapsedS = input.trailTransition.timeS - input.trailTransition.changeTimeS;
  const progress = evaluateTrailModeProgress(elapsedS);
  const modeWeight = evaluateTrailModeFade(
    input.trailTransition.fromMode,
    input.trailTransition.targetMode,
    input.trailClass,
    distanceSq,
    progress,
    input.trailTransition.enabled,
    input.trailTransition.fromModeWeights,
  );
  const distanceFade = trafficTrailFarFade(input.distanceM);
  const nearLodShare = lod.totalAlpha > 0 ? lod.nearAlpha / lod.totalAlpha : 0;
  const parentAttribute = modeWeight * nearLodShare;
  const clippedByAttributeCutoff = parentAttribute <= TRAFFIC_CPU_TRAIL_ATTRIBUTE_CUTOFF;
  const trailKernel = projectTrafficLampKernel({
    position: input.position,
    direction: input.direction,
    bankRadians: input.bankRadians,
    typeIndex: input.typeIndex,
    physicalScale: input.sizeScale,
    side: 'tail',
    extraCullM: TRAFFIC_TRAIL_MAX_M,
    camera: input.camera,
  });
  const pickupDistanceM = cameraSampleDistance(trailKernel.lampWorld, input.camera.position);
  const pickup = trafficAppearanceSmoothstep(TRAFFIC_CPU_TRAIL_PICKUP_BAND_M[0], TRAFFIC_CPU_TRAIL_PICKUP_BAND_M[1], pickupDistanceM);
  const forward = trafficForward(input.direction);
  const toCameraAtLamp = [input.camera.position[0] - trailKernel.lampWorld[0], input.camera.position[1] - trailKernel.lampWorld[1], input.camera.position[2] - trailKernel.lampWorld[2]] as TrafficVec3;
  const viewGain = trafficTrailViewGain(dot3(forward, scale3(toCameraAtLamp, 1 / Math.max(Math.hypot(...toCameraAtLamp), 1e-8))));
  let lengthM = Math.min(input.speedMps * TRAFFIC_TRAIL_SECONDS,
    Math.min(TRAFFIC_TRAIL_MAX_M, TRAIL_MAX_CAR_LENGTHS * carProfileLength(input.typeIndex) * input.sizeScale)) * distanceFade * viewGain;
  const lamp = trailKernel.lampWorld;
  let end = add3(lamp, scale3(forward, -lengthM));
  let toEndView = viewPoint(end, input.camera);
  const front = add3(input.position, scale3(forward, sourceProfile(profileAt(input.typeIndex), 'head').zM * input.sizeScale));
  const rear = add3(input.position, scale3(forward, sourceProfile(profileAt(input.typeIndex), 'tail').zM * input.sizeScale));
  const carScreen = projectedDistanceView(front, rear, input.camera);
  for (let step = 0; step < TRAFFIC_TRAIL_SCREEN_CAP_REFINEMENTS; step += 1) {
    const startView = trailKernel.centerView;
    const trailScreen = Math.hypot(
      startView[0] / Math.max(-startView[2], 1) - toEndView[0] / Math.max(-toEndView[2], 1),
      startView[1] / Math.max(-startView[2], 1) - toEndView[1] / Math.max(-toEndView[2], 1),
    );
    const limit = TRAIL_MAX_CAR_LENGTHS * carScreen;
    if (trailScreen > limit && trailScreen > 0) {
      lengthM *= limit / trailScreen;
      end = add3(lamp, scale3(forward, -lengthM));
      toEndView = viewPoint(end, input.camera);
    }
  }
  const projectedLengthViewM = Math.hypot(toEndView[0] - trailKernel.centerView[0], toEndView[1] - trailKernel.centerView[1]);
  const startRadiusViewM = Math.max(TRAFFIC_TRAIL_START_RADIUS_M,
    -trailKernel.centerView[2] * input.camera.pixelAngleCss * TRAFFIC_TRAIL_START_CSS_PIXEL_SCALE);
  const endRadiusViewM = startRadiusViewM * TRAFFIC_TRAIL_END_WIDTH_SHARE;
  const lengthInRadii = projectedLengthViewM / (0.5 * (startRadiusViewM + endRadiusViewM));
  const toCameraDelta: TrafficVec3 = [input.camera.position[0] - lamp[0], input.camera.position[1] - lamp[1], input.camera.position[2] - lamp[2]];
  const toCameraLength = Math.hypot(toCameraDelta[0], toCameraDelta[1], toCameraDelta[2]);
  const toCamera = toCameraLength > 0 ? scale3(toCameraDelta, 1 / toCameraLength) : [0, 0, 0] as const;
  const trailColorWarm = trafficAppearanceSmoothstep(TRAFFIC_TRAIL_WARM_FACING_BAND[0], TRAFFIC_TRAIL_WARM_FACING_BAND[1], dot3(forward, toCamera));
  const trailColor = mixRgb(rgb(...TRAFFIC_STREAK_TAIL_RGB), rgb(...TRAFFIC_STREAK_TRAIL_WARM_RGB), trailColorWarm);
  const gain = finalFade * lod.nearAlpha * modeWeight * pickup * trailKernel.lampGain * viewGain;
  const fogAttenuation = fogLightFactor(input.fogFactor);
  const sourceRgbLinear = multiplyRgb(trailColor, gain * IMPOSTOR_INTENSITY * input.emissiveGain * TRAFFIC_TRAIL_ALPHA);
  const deltaX = toEndView[0] - trailKernel.centerView[0];
  const deltaY = toEndView[1] - trailKernel.centerView[1];
  const deltaLength = Math.hypot(deltaX, deltaY);
  const axis: TrafficVec2 = deltaLength > 1e-4 ? [deltaX / deltaLength, deltaY / deltaLength] : [0, -1];
  const side: TrafficVec2 = [-axis[1], axis[0]];
  const projectCorner = (endFraction: 0 | 1, sideSign: -1 | 1): ProjectedTrailCorner => {
    const radius = startRadiusViewM + (endRadiusViewM - startRadiusViewM) * endFraction;
    const center: TrafficVec3 = [
      trailKernel.centerView[0] + deltaX * endFraction,
      trailKernel.centerView[1] + deltaY * endFraction,
      trailKernel.centerView[2] + (toEndView[2] - trailKernel.centerView[2]) * endFraction,
    ];
    const along = (endFraction * 2 - 1) * radius;
    const across = sideSign * radius;
    const view: TrafficVec3 = [
      center[0] + axis[0] * along + side[0] * across,
      center[1] + axis[1] * along + side[1] * across,
      center[2],
    ];
    const capsuleX = endFraction === 0 ? -1 : lengthInRadii + 1;
    return projectTrailCorner(view, [capsuleX, sideSign], input.camera);
  };
  const trailCorners: readonly [
    ProjectedTrailCorner,
    ProjectedTrailCorner,
    ProjectedTrailCorner,
    ProjectedTrailCorner,
  ] = [
    projectCorner(0, -1),
    projectCorner(0, 1),
    projectCorner(1, 1),
    projectCorner(1, -1),
  ];
  const integratedTrail = integrateProjectedTrail(trailCorners, input.camera, lengthInRadii);
  const continuousEnergyRgb = multiplyRgb(sourceRgbLinear, integratedTrail.kernelCssPx2 * fogAttenuation);
  const continuousEnergyRefinementDeltaRgb = multiplyRgb(sourceRgbLinear, integratedTrail.refinementDeltaCssPx2 * fogAttenuation);
  const clippedByFrustum = !trailKernel.inView;
  const clippedByClipVolume = integratedTrail.areaCssPx2 <= 0;
  const rendered = (input.hasStreakRecord ?? true) && !clippedByAttributeCutoff && !clippedByFrustum && !clippedByClipVolume;
  const zeroRgb = rgb(0, 0, 0);
  const sampleKernel = (alongRadius: number, side: number): number => trailKernelValue(alongRadius, side, lengthInRadii);
  return {
    modeWeight,
    distanceFade,
    pickup,
    nearLodShare,
    sourceGain: gain,
    alphaScale: TRAFFIC_TRAIL_ALPHA,
    startRadiusViewM,
    endRadiusViewM,
    startRadiusCssPx: startRadiusViewM / Math.max(-trailKernel.centerView[2] * input.camera.pixelAngleCss, 1e-8),
    endRadiusCssPx: endRadiusViewM / Math.max(-trailKernel.centerView[2] * input.camera.pixelAngleCss, 1e-8),
    lengthM,
    projectedLengthViewM,
    lengthInRadii,
    projectedQuadAreaCssPx2: integratedTrail.areaCssPx2,
    integratedKernelCssPx2: integratedTrail.kernelCssPx2,
    refinementDeltaCssPx2: integratedTrail.refinementDeltaCssPx2,
    clippedByAttributeCutoff,
    clippedByFrustum,
    clippedByClipVolume,
    rendered,
    sourceRgbLinear,
    foggedRgbLinear: multiplyRgb(sourceRgbLinear, fogAttenuation),
    continuousEnergyRgb,
    continuousEnergyRefinementDeltaRgb,
    peakEstimateRgb: multiplyRgb(sourceRgbLinear, fogAttenuation),
    renderedSourceRgbLinear: rendered ? sourceRgbLinear : zeroRgb,
    renderedFoggedRgbLinear: rendered ? multiplyRgb(sourceRgbLinear, fogAttenuation) : zeroRgb,
    renderedContinuousEnergyRgb: rendered ? continuousEnergyRgb : zeroRgb,
    renderedPeakEstimateRgb: rendered ? multiplyRgb(sourceRgbLinear, fogAttenuation) : zeroRgb,
    sampleKernel,
  };
}

/** Full CPU same-car evaluator: hull, streak lamps, the existing proxy share, and near trail. */
export function evaluateSameCarTrafficAppearance(input: SameCarTrafficAppearanceInput): SameCarTrafficAppearance {
  const distanceSq = input.distanceM * input.distanceM;
  const cpuTierFade = evaluateCpuTierFade(
    input.carIndex,
    input.cpuTier.fromCount,
    input.cpuTier.targetCount,
    input.cpuTier.progress,
    input.cpuTier.fromAlphaSnapshot,
  );
  const finalFade = input.sourceFade * cpuTierFade;
  const legacyFarAlpha = evaluateThinFarAlpha(distanceSq, input.thinFar);
  const lod = writeSameCarLightLod(input.distanceM, input.impostorPresence, legacyFarAlpha);
  const hullLod = hullLodAlpha(input.distanceM);
  const hullScale = input.sizeScale;
  const hullCoverage = hullLod * trafficAppearanceSmoothstep(0, TRAFFIC_HULL_FADE_RAMP_END, finalFade) * lod.totalAlpha;
  const nearFade = finalFade * lod.nearAlpha;
  const distanceDim = evaluateTrafficDistanceDim(distanceSq);
  const tintGain = distanceDim * nearFade;
  const hasHullRecord = input.hasHullRecord ?? true;
  const hullHead = hullPatchAppearance(input, 'head', hullScale, tintGain, hasHullRecord, hullCoverage);
  const hullTail = hullPatchAppearance(input, 'tail', hullScale, tintGain, hasHullRecord, hullCoverage);
  const hasStreakRecord = input.hasStreakRecord ?? true;
  const headProjection = projectTrafficLampKernel({
    position: input.position, direction: input.direction, bankRadians: input.bankRadians,
    typeIndex: input.typeIndex, physicalScale: input.sizeScale, side: 'head', camera: input.camera,
  });
  const tailProjection = projectTrafficLampKernel({
    position: input.position, direction: input.direction, bankRadians: input.bankRadians,
    typeIndex: input.typeIndex, physicalScale: input.sizeScale, side: 'tail', camera: input.camera,
  });
  const headPickupDistanceM = cameraSampleDistance(headProjection.lampWorld, input.camera.position);
  const tailPickupDistanceM = cameraSampleDistance(tailProjection.lampWorld, input.camera.position);
  const headPickup = trafficAppearanceSmoothstep(TRAFFIC_CPU_LAMP_PICKUP_BAND_M[0], TRAFFIC_CPU_LAMP_PICKUP_BAND_M[1], headPickupDistanceM);
  const tailPickup = trafficAppearanceSmoothstep(TRAFFIC_CPU_LAMP_PICKUP_BAND_M[0], TRAFFIC_CPU_LAMP_PICKUP_BAND_M[1], tailPickupDistanceM);
  const headGain = finalFade * lod.totalAlpha * headPickup * headProjection.facingGain * headProjection.lampGain;
  const tailGain = finalFade * lod.totalAlpha * tailPickup * tailProjection.facingGain * tailProjection.lampGain;
  const head = evaluateLampRadiance(headProjection, lightColor('head', input.warmth), headGain,
    IMPOSTOR_INTENSITY * input.emissiveGain, input.fogFactor, hasStreakRecord);
  const tail = evaluateLampRadiance(tailProjection, lightColor('tail', input.warmth), tailGain,
    IMPOSTOR_INTENSITY * input.emissiveGain, input.fogFactor, hasStreakRecord);
  const trail = cpuTrailAppearance(input, lod, finalFade, distanceSq);
  const aCarFade: TrafficVec4 = [finalFade * lod.totalAlpha, input.sizeScale, input.warmth,
    trail.modeWeight * (lod.totalAlpha > 0 ? lod.nearAlpha / lod.totalAlpha : 0)];
  return {
    identity: { kind: 'same-car', carIndex: input.carIndex },
    lod: {
      legacyFarAlpha,
      nearAlpha: lod.nearAlpha,
      impostorProxyAlpha: lod.impostorAlpha,
      totalAlpha: lod.totalAlpha,
      cpuTierFade,
      finalFade,
    },
    hull: {
      hasInstance: hasHullRecord,
      hullLodAlpha: hullLod,
      scale: hullScale,
      coverage: hullCoverage,
      distanceDim,
      tintGain,
      patches: [hullHead, hullTail],
    },
    streak: { hasRecord: hasStreakRecord, head, tail, headPickup, tailPickup, trail },
    uploaded: {
      hasRecord: hasStreakRecord,
      aCarFade: hasStreakRecord ? aCarFade : null,
      aCarLod: hasStreakRecord ? [lod.nearAlpha, lod.impostorAlpha, input.carIndex] : null,
    },
  };
}

/** One independent GPU fleet item. It does not represent the CPU same-car proxy share. */
export function evaluateIndependentImpostorAppearance(input: IndependentImpostorAppearanceInput): IndependentImpostorAppearance {
  const projection = projectTrafficLampKernel({
    position: input.position,
    direction: input.direction,
    bankRadians: 0,
    typeIndex: input.typeIndex,
    physicalScale: input.physicalScale,
    side: input.side,
    facingLengthFloorM: 1,
    clampPitch: false,
    camera: input.camera,
  });
  const tierAlpha = computeInstanceAlpha(input.fromAlpha, input.instanceIndex, input.targetCount, input.transitionProgress);
  const handover = impostorLightHandoverAlpha(input.distanceM, 1);
  const farBrightness = farImpostorBrightness(input.distanceM);
  const seedBuzz = TRAFFIC_GPU_SEED_BRIGHTNESS_BASE
    + TRAFFIC_GPU_SEED_BRIGHTNESS_SPAN * ((input.seed * TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER)
      - Math.floor(input.seed * TRAFFIC_GPU_SEED_BRIGHTNESS_MULTIPLIER));
  const color = input.side === 'head' ? rgb(...TRAFFIC_STREAK_HEAD_WHITE_RGB) : rgb(...TRAFFIC_STREAK_TAIL_RGB);
  const gain = seedBuzz * projection.lampGain * projection.facingGain * handover * tierAlpha * farBrightness;
  const intensity = seedBuzz * projection.lampGain * projection.facingGain * handover * tierAlpha * farBrightness;
  const clippedByIntensityCutoff = intensity <= TRAFFIC_GPU_IMPOSTOR_INTENSITY_CUTOFF;
  const lamp = evaluateLampRadiance(
    projection,
    color,
    gain,
    IMPOSTOR_INTENSITY * input.emissiveGain,
    input.fogFactor,
    true,
    clippedByIntensityCutoff,
  );
  return {
    identity: { kind: 'independent-impostor', instanceIndex: input.instanceIndex },
    tierAlpha,
    handover,
    farBrightness,
    seedBuzz,
    projection,
    lamp,
    clippedByIntensityCutoff,
  };
}
