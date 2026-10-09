import type { TrafficCameraProjection, TrafficRgb } from '../../src/render/trafficAppearanceModel';

export const FLYER_MATRIX_DPRS = [1, 1.25] as const;
export const FLYER_MATRIX_FACINGS = [0, 180, 45, 90] as const;
export const FLYER_MATRIX_TIERS = ['high', 'medium', 'low'] as const;
export const FLYER_MATRIX_STEP_M = 25;
export const FLYER_MATRIX_DISTANCES = Array.from({ length: 159 }, (_, index) => 50 + index * FLYER_MATRIX_STEP_M);
export const FLYER_HANDOVER_STEP_LIMIT = 0.25;
export const FLYER_RESIDUAL_STEP_LIMIT = 0.05;

/** Numeric camera input. This helper creates no renderer objects. */
export function continuityCamera(distanceM: number, facingDegrees: number, dpr: number): TrafficCameraProjection {
  const theta = facingDegrees * Math.PI / 180;
  const c = Math.cos(theta), s = Math.sin(theta);
  const width = 1280, height = 720;
  const f = 1 / Math.tan(62 * Math.PI / 360);
  const near = 1, far = 10000;
  return {
    position: [distanceM * s, 0, distanceM * c],
    viewMatrix: [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, -distanceM, 1],
    projectionMatrix: [f / (width / height), 0, 0, 0, 0, f, 0, 0, 0, 0,
      (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0],
    bufferWidthPx: Math.floor(width * dpr), bufferHeightPx: Math.floor(height * dpr),
    cssWidthPx: width, cssHeightPx: height,
    pixelAngleBuffer: 2 / (f * Math.floor(height * dpr)),
    pixelAngleCss: 2 / (f * height),
  };
}

export function continuityLuminance(rgb: TrafficRgb): number {
  return rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
}

/** A zero pickup uses the full source as its denominator. */
export function normalizedStep(before: number, after: number, fullSource: number): number {
  return Math.abs(after - before) / Math.max(Math.abs(before), fullSource, Number.EPSILON);
}

/** Remove only physical perspective from a resolved source size. */
export function inverseDepthResidual(beforeSize: number, afterSize: number, beforeDepth: number, afterDepth: number): number {
  const expected = beforeSize * beforeDepth / afterDepth;
  return Math.abs(afterSize - expected) / Math.max(Math.abs(expected), Number.EPSILON);
}

import {
  TRAFFIC_APPEARANCE_PROFILES, TRAFFIC_LAMP_FLOOR_BLEND_SHARE,
  TRAFFIC_LAMP_MIN_DIAMETER_PX,
} from '../../src/render/trafficAppearance';

/** Measure the projected source by finite differences. This does not call the model kernel. */
export function independentLampProjection(typeIndex: number, head: boolean, scale: number, camera: TrafficCameraProjection) {
  const profile = TRAFFIC_APPEARANCE_PROFILES[typeIndex];
  if (!profile) throw new Error('R33_PROFILE_MISSING');
  const p = head ? profile.front : profile.rear;
  const center = [0, p.yM * scale, p.zM * scale] as const;
  const project = (point: readonly number[]) => {
    const m = camera.viewMatrix, q = camera.projectionMatrix;
    const view = [0, 1, 2, 3].map(r => m[r]! * point[0]! + m[r + 4]! * point[1]!
      + m[r + 8]! * point[2]! + m[r + 12]!);
    const clip = [0, 1, 2, 3].map(r => q[r]! * view[0]! + q[r + 4]! * view[1]!
      + q[r + 8]! * view[2]! + q[r + 12]! * view[3]!);
    return { x: clip[0]! / clip[3]! * camera.cssWidthPx * 0.5,
      y: clip[1]! / clip[3]! * camera.cssHeightPx * 0.5, depth: -view[2]! };
  };
  const epsilon = 1e-3;
  const x0 = project([center[0] - epsilon, center[1], center[2]]);
  const x1 = project([center[0] + epsilon, center[1], center[2]]);
  const y0 = project([center[0], center[1] - epsilon, center[2]]);
  const y1 = project([center[0], center[1] + epsilon, center[2]]);
  const dx = [(x1.x - x0.x) / (2 * epsilon), (x1.y - x0.y) / (2 * epsilon)];
  const dy = [(y1.x - y0.x) / (2 * epsilon), (y1.y - y0.y) / (2 * epsilon)];
  const xLength = Math.hypot(dx[0]!, dx[1]!);
  const axis = xLength > 1e-8 ? [dx[0]! / xLength, dx[1]! / xLength] : [1, 0];
  const sourceHalfX = xLength * (p.kind === 'pair' ? p.widthM : p.widthM / 2) * scale * 0.5;
  const sourceHalfY = Math.abs(dy[0]! * -axis[1]! + dy[1]! * axis[0]!) * p.heightM * scale * 0.5;
  const floorSize = TRAFFIC_LAMP_MIN_DIAMETER_PX * 0.5;
  const smoothFloor = (physical: number) => {
    const width = floorSize * TRAFFIC_LAMP_FLOOR_BLEND_SHARE;
    const overlap = Math.max(width - Math.abs(physical - floorSize), 0);
    return Math.max(physical, floorSize) + overlap * overlap / (4 * width);
  };
  const pairSpan = xLength * (p.kind === 'pair' ? p.centreXM : p.widthM / 4) * scale;
  const delta = camera.position.map((v, i) => v - center[i]!);
  const lampDistance = Math.hypot(...delta);
  return { sourceHalfX, sourceHalfY, floorHalfX: smoothFloor(sourceHalfX), floorHalfY: smoothFloor(sourceHalfY),
    pairSpan, depth: project(center).depth, lampDistance, facing: delta[2]! / lampDistance };
}
