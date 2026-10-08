/** View-depth fade bands for room tracing, in metres. */
export const SKYRIVER_INTERIOR_FADE = Object.freeze({
  full: Object.freeze([300, 900] as const),
  near: Object.freeze([120, 600] as const),
});

/** Fraction of dark mid, grime, and pristine rooms that contain a dim light. */
export const SKYRIVER_INTERIOR_DIM_SHARE = Object.freeze({
  mid: 0.3,
  grime: 0.36,
  pristine: 0.18,
});

export const SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR = 0.002;
export const SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE = 1 / 3;
export const SKYRIVER_INTERIOR_SCREEN_RGB = Object.freeze([0.25, 0.45, 0.9] as const);
export const SKYRIVER_INTERIOR_SCREEN_LEVEL = 0.5;
export const SKYRIVER_INTERIOR_SCREEN_VARIATION = 0.15;
export const SKYRIVER_INTERIOR_DEPTH_POWER = 1.5;
export const SKYRIVER_INTERIOR_AVERAGE_GAIN = 0.3;
export const SKYRIVER_INTERIOR_SHEEN_GAIN = 0.12;
export const SKYRIVER_INTERIOR_DARKROOM_SPILL = Object.freeze([0.1, 0.11, 0.14] as const);

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Smooth room-detail weight from one at the near edge to zero at the far edge. */
export function interiorDepthWeight(depthM: number, startM: number, endM: number): number {
  const t = clamp01((depthM - startM) / Math.max(endM - startM, 1e-4));
  const smoother = t * t * t * (t * (t * 6 - 15) + 10);
  return clamp01(1 - smoother) ** SKYRIVER_INTERIOR_DEPTH_POWER;
}

/** Blue screen strength falls to one third as room detail reaches full weight. */
export function interiorScreenScale(depthWeight: number): number {
  return 1 + (SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE - 1) * clamp01(depthWeight);
}

/** Matched screen energy used by pane, average, and traced-room paths. */
export function interiorScreenBlueEnergy(
  depthWeight: number,
  screenSelected: number,
  dimRoomSelected: number,
  interiorStrength: number,
): number {
  return SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR
    * clamp01(screenSelected)
    * clamp01(dimRoomSelected)
    * clamp01(interiorStrength)
    * interiorScreenScale(depthWeight);
}

/** Original dim-room screen source, scaled to one third near the room-trace start. */
export function interiorScreenSource(depthWeight: number, oscillation: number): readonly [number, number, number] {
  const intensity = (SKYRIVER_INTERIOR_SCREEN_LEVEL + SKYRIVER_INTERIOR_SCREEN_VARIATION * oscillation)
    * interiorScreenScale(depthWeight);
  return SKYRIVER_INTERIOR_SCREEN_RGB.map((channel) => channel * intensity) as [number, number, number];
}

/** Blend the matched pane mean into the traced screen detail as room detail resolves. */
export function interiorScreenTraceBlend(
  depthWeight: number,
  paneMean: readonly [number, number, number],
  atlasDetail: readonly [number, number, number],
): readonly [number, number, number] {
  const weight = clamp01(depthWeight);
  return [
    paneMean[0] + (atlasDetail[0] - paneMean[0]) * weight,
    paneMean[1] + (atlasDetail[1] - paneMean[1]) * weight,
    paneMean[2] + (atlasDetail[2] - paneMean[2]) * weight,
  ];
}

/** Input scale that gives the same final energy through the resolved-pane path. */
export function interiorPaneScreenInput(finalEnergy: number, emissiveGain: number): number {
  return finalEnergy / emissiveGain;
}

/** Input scale that gives the same final energy through the far-average path. */
export function interiorAverageScreenInput(finalEnergy: number): number {
  return finalEnergy / SKYRIVER_INTERIOR_AVERAGE_GAIN;
}

/** Shared hue for the low screen mean. */
export function interiorScreenMean(input: number): readonly [number, number, number] {
  return [SKYRIVER_INTERIOR_SCREEN_RGB[0] * input, SKYRIVER_INTERIOR_SCREEN_RGB[1] * input, SKYRIVER_INTERIOR_SCREEN_RGB[2] * input];
}

/** GLSL mirror for the pure functions and constants above. */
export const SKYRIVER_INTERIOR_RESPONSE_GLSL = /* glsl */ `
float interiorDepthWeight( float depthM, vec2 fadeBand ) {
  float t = clamp( ( depthM - fadeBand.x ) / max( fadeBand.y - fadeBand.x, 1e-4 ), 0.0, 1.0 );
  float smoother = t * t * t * ( t * ( t * 6.0 - 15.0 ) + 10.0 );
  return pow( clamp( 1.0 - smoother, 0.0, 1.0 ), ${SKYRIVER_INTERIOR_DEPTH_POWER.toFixed(1)} );
}
float interiorScreenScale( float depthWeight ) {
  return mix( 1.0, ${SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE.toFixed(6)}, clamp( depthWeight, 0.0, 1.0 ) );
}
float interiorScreenBlueEnergy( float depthWeight, float screenSelected, float dimRoomSelected, float interiorStrength ) {
  return ${SKYRIVER_INTERIOR_SCREEN_BLUE_FLOOR.toFixed(3)} * clamp( screenSelected, 0.0, 1.0 ) * clamp( dimRoomSelected, 0.0, 1.0 ) * clamp( interiorStrength, 0.0, 1.0 ) * interiorScreenScale( depthWeight );
}
vec3 interiorScreenSource( float depthWeight, float oscillation ) {
  return vec3( ${SKYRIVER_INTERIOR_SCREEN_RGB.map((channel) => channel.toFixed(2)).join(', ')} )
    * ( ${SKYRIVER_INTERIOR_SCREEN_LEVEL.toFixed(2)} + ${SKYRIVER_INTERIOR_SCREEN_VARIATION.toFixed(2)} * oscillation )
    * interiorScreenScale( depthWeight );
}
vec3 interiorScreenTraceBlend( float depthWeight, vec3 paneMean, vec3 atlasDetail ) {
  return mix( paneMean, atlasDetail, clamp( depthWeight, 0.0, 1.0 ) );
}
vec3 interiorScreenMean( float inputEnergy ) {
  return vec3( ${SKYRIVER_INTERIOR_SCREEN_RGB.map((channel) => channel.toFixed(2)).join(', ')} ) * inputEnergy;
}
float interiorPaneScreenInput( float finalEnergy ) {
  return finalEnergy / EMISSIVE_GAIN;
}
float interiorAverageScreenInput( float finalEnergy ) {
  return finalEnergy / ${SKYRIVER_INTERIOR_AVERAGE_GAIN.toFixed(2)};
}
`;
