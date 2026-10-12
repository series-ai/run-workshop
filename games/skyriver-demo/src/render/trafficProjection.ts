/** Symmetric matrices use [xx, xy, yy]. No direction is selected at a rank loss. */
export type TrafficSymmetric2 = readonly [number, number, number];
export type TrafficProjectionVec2 = readonly [number, number];

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
