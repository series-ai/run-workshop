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
  readonly name: string;
  readonly front: TrafficLampProfile;
  readonly rear: TrafficLampProfile;
}

export const TRAFFIC_APPEARANCE_PROFILES: readonly TrafficAppearanceProfile[] = Object.freeze(([
  { name: 'cab', front: { kind: 'pair', centreXM: 0.56, yM: -0.04, zM: 2.61, widthM: 0.5, heightM: 0.3 }, rear: { kind: 'bar', centreXM: 0, yM: 0.1, zM: -2.21, widthM: 1.75, heightM: 0.2 } },
  { name: 'interceptor', front: { kind: 'bar', centreXM: 0, yM: 0.06, zM: 3.14, widthM: 0.9, heightM: 0.12 }, rear: { kind: 'bar', centreXM: 0, yM: -0.02, zM: -2.97, widthM: 1.4, heightM: 0.16 } },
  { name: 'commuter', front: { kind: 'pair', centreXM: 0.62, yM: -0.26, zM: 2.11, widthM: 0.5, heightM: 0.26 }, rear: { kind: 'bar', centreXM: 0, yM: -0.26, zM: -2.11, widthM: 1.5, heightM: 0.2 } },
  { name: 'van', front: { kind: 'pair', centreXM: 0.7, yM: -0.1, zM: 2.31, widthM: 0.45, heightM: 0.25 }, rear: { kind: 'bar', centreXM: 0, yM: 1.05, zM: -2.11, widthM: 1.9, heightM: 0.18 } },
  { name: 'saucer', front: { kind: 'bar', centreXM: 0, yM: -0.05, zM: 1.52, widthM: 1.6, heightM: 0.14 }, rear: { kind: 'bar', centreXM: 0, yM: -0.05, zM: -1.52, widthM: 1.8, heightM: 0.16 } },
  { name: 'bus', front: { kind: 'pair', centreXM: 0.75, yM: -0.3, zM: 4.12, widthM: 0.5, heightM: 0.3 }, rear: { kind: 'bar', centreXM: 0, yM: 0.3, zM: -4.12, widthM: 2, heightM: 0.22 } },
  { name: 'flatbed', front: { kind: 'bar', centreXM: 0, yM: 0.1, zM: 3.56, widthM: 1.7, heightM: 0.18 }, rear: { kind: 'bar', centreXM: 0, yM: -0.35, zM: -4.21, widthM: 2.1, heightM: 0.16 } },
] satisfies TrafficAppearanceProfile[]).map((profile) => Object.freeze({ ...profile, front: Object.freeze(profile.front), rear: Object.freeze(profile.rear) })));

export const TRAFFIC_LAMP_MIN_DIAMETER_PX = 1.3;
export const TRAFFIC_LAMP_FLOOR_BLEND_SHARE = 0.2;
export const TRAFFIC_LAMP_FLOOR_MIN_GAIN = 0.8;
export const TRAFFIC_LAMP_HEAD_FACING_BAND = Object.freeze([0.1, 0.7] as const);
export const TRAFFIC_LAMP_TAIL_FACING_BAND = Object.freeze([-0.85, 0.3] as const);

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Shared facing gain for CPU and GPU lamps. The tail band reads the opposite direction. */
export function trafficLampFacingGain(facing: number, head: boolean): number {
  return head
    ? smoothstep(TRAFFIC_LAMP_HEAD_FACING_BAND[0], TRAFFIC_LAMP_HEAD_FACING_BAND[1], facing)
    : smoothstep(TRAFFIC_LAMP_TAIL_FACING_BAND[0], TRAFFIC_LAMP_TAIL_FACING_BAND[1], -facing);
}

/** Store type + scale / 8. Scale must be in [1, 6]. Fractions stay clear of integers. */
export function packTrafficAppearance(type: number, scale: number): number {
  if (!Number.isInteger(type) || type < 0 || type >= TRAFFIC_APPEARANCE_PROFILES.length || !Number.isFinite(scale) || scale < 1 || scale > 6) {
    throw new Error('SKYRIVER_TRAFFIC_APPEARANCE_INVALID');
  }
  return Math.fround(type + scale / 8);
}

/** Decode the uploaded Float32 scalar. Valid storage is [0.125, 6.75]. */
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
  const bound = Math.ceil(Math.max(radius(profile.front), radius(profile.rear)) * 1e8) / 1e8;
  return `  if (type < ${glslNumber(i + 0.5)}) return ${glslNumber(bound)} * scale;`;
}).join('\n')}
  return 0.0;
}
bool trafficLampOutsidePlane(vec4 plane, vec4 point, float radius) {
  return dot(plane, point) < -radius * length(plane.xyz);
}
bool trafficLampInView(vec3 pos, float type, float scale, float pixelScale, float extraM) {
  vec4 point = viewMatrix * vec4(pos, 1.0);
  float physicalRadius = trafficLampPhysicalRadius(type, scale) + extraM;
  // Bound the physical patches, pixel filter and trail cap before perspective expansion.
  float radius = physicalRadius + 3.0 * pixelScale * max(-point.z + physicalRadius, 1.0);
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
  bool front, float lampSide, float pixelScale, out vec3 lamp, out vec4 centre,
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
  axis = rightLength > 1e-5 ? rightP / rightLength : vec2(1.0, 0.0);
  float pixelM = depth * pixelScale;
  // Each lamp needs pixel coverage. The gap between lamps cannot provide it.
  float floorSize = ${glslNumber(TRAFFIC_LAMP_MIN_DIAMETER_PX / 2)} * pixelM;
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
