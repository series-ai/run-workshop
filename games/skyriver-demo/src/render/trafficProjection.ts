/** Symmetric matrices use [xx, xy, yy]. No direction is selected at a rank loss. */
export type TrafficSymmetric2 = readonly [number, number, number];
export type TrafficProjectionVec2 = readonly [number, number];
export type TrafficProjectionVec4 = readonly [number, number, number, number];
export interface TrafficClipVertex {
  readonly view: TrafficProjectionVec4;
  readonly kernel: TrafficProjectionVec2;
}

/** This value is the actual perspective near plane. */
export function trafficProjectionNear(projection: ArrayLike<number>): number {
  const near = projection[14]! / (projection[10]! - 1);
  if (!(near > 0) || !Number.isFinite(near)) throw new Error('SKYRIVER_TRAFFIC_PROJECTION_INVALID');
  return near;
}

function clipDistance(vertex: TrafficClipVertex, plane: TrafficProjectionVec4): number {
  return vertex.view.reduce((sum, value, i) => sum + value * plane[i]!, 0);
}

function clipIntersection(a: TrafficClipVertex, b: TrafficClipVertex, da: number, db: number): TrafficClipVertex {
  const t = da / (da - db);
  return {
    view: [a.view[0] + t * (b.view[0] - a.view[0]), a.view[1] + t * (b.view[1] - a.view[1]),
      a.view[2] + t * (b.view[2] - a.view[2]), a.view[3] + t * (b.view[3] - a.view[3])],
    kernel: [a.kernel[0] + t * (b.kernel[0] - a.kernel[0]), a.kernel[1] + t * (b.kernel[1] - a.kernel[1])],
  };
}

/** The cut keeps the original kernel domain. It does not stretch the retained interval. */
export function trafficClipSegment(a: TrafficClipVertex, b: TrafficClipVertex, plane: TrafficProjectionVec4): readonly [TrafficClipVertex, TrafficClipVertex] | null {
  const da = clipDistance(a, plane);
  const db = clipDistance(b, plane);
  if (da < 0 && db < 0) return null;
  if (da < 0) return [clipIntersection(a, b, da, db), b];
  if (db < 0) return [a, clipIntersection(a, b, da, db)];
  return [a, b];
}

/** Clip in homogeneous view space before any perspective division. */
export function trafficClipPolygon(vertices: readonly TrafficClipVertex[], planes: readonly TrafficProjectionVec4[]): readonly TrafficClipVertex[] {
  let result = [...vertices];
  for (const plane of planes) {
    const next: TrafficClipVertex[] = [];
    for (let i = 0; i < result.length; i += 1) {
      const a = result[i]!;
      const b = result[(i + 1) % result.length]!;
      const da = clipDistance(a, plane);
      const db = clipDistance(b, plane);
      if (da >= 0) next.push(a);
      if ((da < 0) !== (db < 0)) next.push(clipIntersection(a, b, da, db));
    }
    result = next;
    if (result.length === 0) break;
  }
  return result;
}

/** Fraction of the original [-1,1] square. A cut does not get a new full kernel domain. */
export function trafficClipKernelFraction(vertices: readonly TrafficClipVertex[]): number {
  if (vertices.length < 3) return 0;
  let twiceArea = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i]!.kernel;
    const b = vertices[(i + 1) % vertices.length]!.kernel;
    twiceArea += a[0] * b[1] - a[1] * b[0];
  }
  return Math.min(1, Math.max(0, Math.abs(twiceArea) * 0.125));
}

export function trafficProjectClippedVertex(vertex: TrafficClipVertex, projection: ArrayLike<number>): {
  readonly clip: TrafficProjectionVec4;
  readonly ndc: readonly [number, number, number];
  readonly kernel: TrafficProjectionVec2;
} | null {
  const v = vertex.view;
  const clip: TrafficProjectionVec4 = [
    projection[0]! * v[0] + projection[4]! * v[1] + projection[8]! * v[2] + projection[12]! * v[3],
    projection[1]! * v[0] + projection[5]! * v[1] + projection[9]! * v[2] + projection[13]! * v[3],
    projection[2]! * v[0] + projection[6]! * v[1] + projection[10]! * v[2] + projection[14]! * v[3],
    projection[3]! * v[0] + projection[7]! * v[1] + projection[11]! * v[2] + projection[15]! * v[3],
  ];
  if (!(clip[3] > 0) || !clip.every(Number.isFinite)) return null;
  return { clip, ndc: [clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]], kernel: vertex.kernel };
}

export function trafficFootprintCovariance(right: TrafficProjectionVec2, up: TrafficProjectionVec2): TrafficSymmetric2 {
  return [right[0] ** 2 + up[0] ** 2,
    right[0] * right[1] + up[0] * up[1], right[1] ** 2 + up[1] ** 2];
}

/** Principal PSD root. The zero and rank-one limits do not use eigenvectors. */
export function trafficPsdRoot(c: TrafficSymmetric2): TrafficSymmetric2 {
  const scale = Math.max(c[0], Math.abs(c[1]), c[2]);
  if (scale === 0) return [0, 0, 0];
  const x = c[0] / scale;
  const y = c[1] / scale;
  const z = c[2] / scale;
  const d = Math.sqrt(Math.max(x * z - y * y, 0));
  const denominator = Math.sqrt(Math.max(x + z + 2 * d, 0));
  const gain = Math.sqrt(scale) / denominator;
  return [(x + d) * gain, y * gain, (z + d) * gain];
}

export function trafficProjectionFloor(size: number, floorSize: number, blendShare: number): number {
  const width = floorSize * blendShare;
  const overlap = Math.max(width - Math.abs(size - floorSize), 0);
  return Math.max(size, floorSize) + overlap * overlap / (4 * width);
}

/** Apply the scalar floor to both eigenvalues. Equal eigenvalues use the derivative limit. */
export function trafficSpectralFloor(s: TrafficSymmetric2, floorSize: number, blendShare: number): TrafficSymmetric2 {
  const mean = (s[0] + s[2]) * 0.5;
  const radius = Math.hypot((s[0] - s[2]) * 0.5, s[1]);
  const high = mean + radius;
  const low = Math.max(mean - radius, 0);
  const fh = trafficProjectionFloor(high, floorSize, blendShare);
  const fl = trafficProjectionFloor(low, floorSize, blendShare);
  const width = floorSize * blendShare;
  const slope = radius > Number.EPSILON * Math.max(mean, floorSize)
    ? (fh - fl) / (high - low)
    : Math.min(1, Math.max(0, (mean - floorSize + width) / (2 * width)));
  const intercept = (fh + fl) * 0.5 - slope * mean;
  return [intercept + slope * s[0], slope * s[1], intercept + slope * s[2]];
}

export function trafficInverseFootprint(s: TrafficSymmetric2): TrafficSymmetric2 {
  const det = s[0] * s[2] - s[1] * s[1];
  return [s[2] / det, -s[1] / det, s[0] / det];
}

export function trafficApplyFootprint(s: TrafficSymmetric2, p: TrafficProjectionVec2): TrafficProjectionVec2 {
  return [s[0] * p[0] + s[1] * p[1], s[1] * p[0] + s[2] * p[1]];
}

export const TRAFFIC_PROJECTION_GLSL = /* glsl */ `
float trafficProjectionNear() {
  return projectionMatrix[3][2] / (projectionMatrix[2][2] - 1.0);
}
float trafficSourceNearFraction(vec4 centre, vec3 rightHalf, vec3 upHalf) {
  vec2 uv[4];
  uv[0] = vec2(-1.0, -1.0);
  uv[1] = vec2(1.0, -1.0);
  uv[2] = vec2(1.0, 1.0);
  uv[3] = vec2(-1.0, 1.0);
  float distance[4];
  bool allInside = true;
  bool allOutside = true;
  float nearPlane = trafficProjectionNear();
  for (int i = 0; i < 4; i++) {
    distance[i] = -(centre.z + rightHalf.z * uv[i].x + upHalf.z * uv[i].y) - nearPlane;
    allInside = allInside && distance[i] >= 0.0;
    allOutside = allOutside && distance[i] <= 0.0;
  }
  if (allInside) return 1.0;
  if (allOutside) return 0.0;
  vec2 retained[6];
  int count = 0;
  for (int i = 0; i < 4; i++) {
    int j = (i + 1) % 4;
    if (distance[i] >= 0.0) { retained[count] = uv[i]; count++; }
    if ((distance[i] < 0.0) != (distance[j] < 0.0)) {
      float t = distance[i] / (distance[i] - distance[j]);
      retained[count] = mix(uv[i], uv[j], t);
      count++;
    }
  }
  if (count < 3) return 0.0;
  float twiceArea = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i < count) {
      int j = i + 1 < count ? i + 1 : 0;
      twiceArea += retained[i].x * retained[j].y - retained[i].y * retained[j].x;
    }
  }
  return clamp(abs(twiceArea) * 0.125, 0.0, 1.0);
}
bool trafficClipSegment(inout vec4 a, inout vec4 b, inout vec2 ua, inout vec2 ub, vec4 plane) {
  float da = dot(plane, a);
  float db = dot(plane, b);
  if (da < 0.0 && db < 0.0) return false;
  if (da < 0.0 || db < 0.0) {
    float t = da / (da - db);
    vec4 cut = mix(a, b, t);
    vec2 uv = mix(ua, ub, t);
    if (da < 0.0) { a = cut; ua = uv; }
    else { b = cut; ub = uv; }
  }
  return true;
}
vec2 trafficFiniteAnchor(vec4 centre, vec3 tangent, vec2 kernelAxis, out bool visible) {
  vec4 a = centre - vec4(tangent, 0.0);
  vec4 b = centre + vec4(tangent, 0.0);
  vec2 ua = -kernelAxis;
  vec2 ub = kernelAxis;
  visible = trafficClipSegment(a, b, ua, ub, vec4(0.0, 0.0, -1.0, -trafficProjectionNear()));
  if (!visible) return vec2(0.0);
  return 0.5 * (b.xy / -b.z - a.xy / -a.z);
}
mat2 trafficPsdRoot(mat2 c) {
  float scale = max(max(c[0][0], abs(c[0][1])), c[1][1]);
  if (scale == 0.0) return mat2(0.0);
  mat2 n = c / scale;
  float d = sqrt(max(determinant(n), 0.0));
  return (n + mat2(d)) * (sqrt(scale) / sqrt(max(n[0][0] + n[1][1] + 2.0 * d, 0.0)));
}
mat2 trafficSpectralFloor(mat2 s, float floorSize, float blendShare) {
  float mean = 0.5 * (s[0][0] + s[1][1]);
  float radius = length(vec2(0.5 * (s[0][0] - s[1][1]), s[0][1]));
  float high = mean + radius;
  float low = max(mean - radius, 0.0);
  float width = floorSize * blendShare;
  float oh = max(width - abs(high - floorSize), 0.0);
  float ol = max(width - abs(low - floorSize), 0.0);
  float fh = max(high, floorSize) + oh * oh / (4.0 * width);
  float fl = max(low, floorSize) + ol * ol / (4.0 * width);
  float slope = radius > 1e-6 * max(mean, floorSize)
    ? (fh - fl) / (high - low) : clamp((mean - floorSize + width) / (2.0 * width), 0.0, 1.0);
  return mat2(0.5 * (fh + fl) - slope * mean) + slope * s;
}
`;
