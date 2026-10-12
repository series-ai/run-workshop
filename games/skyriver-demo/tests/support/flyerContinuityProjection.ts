import type { TrafficCameraProjection, TrafficRgb } from '../../src/render/trafficAppearanceModel';
import { Vector3 } from 'three';

export const FLYER_MATRIX_DPRS = [1, 1.25, 1.5] as const;
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

/** Measure the physical endpoint spans. This does not call the model kernel. */
export function independentLampProjection(typeIndex: number, head: boolean, scale: number, camera: TrafficCameraProjection,
  physical: { readonly position: readonly [number, number, number]; readonly direction: readonly [number, number, number];
    readonly bankRadians: number; readonly clampPitch?: boolean } = { position: [0, 0, 0], direction: [0, 0, 1], bankRadians: 0 }) {
  const profile = TRAFFIC_APPEARANCE_PROFILES[typeIndex];
  if (!profile) throw new Error('R33_PROFILE_MISSING');
  const p = head ? profile.front : profile.rear;
  const forward = new Vector3(...physical.direction);
  if (physical.clampPitch !== false) forward.y = Math.max(-0.35, Math.min(0.35, forward.y));
  forward.normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize();
  const up = new Vector3().crossVectors(forward, right);
  right.applyAxisAngle(forward, physical.bankRadians);
  up.applyAxisAngle(forward, physical.bankRadians);
  const centerWorld = new Vector3(...physical.position).addScaledVector(forward, p.zM * scale).addScaledVector(up, p.yM * scale);
  const center = [centerWorld.x, centerWorld.y, centerWorld.z] as const;
  const project = (point: readonly number[]) => {
    const m = camera.viewMatrix, q = camera.projectionMatrix;
    const view = [0, 1, 2, 3].map(r => m[r]! * point[0]! + m[r + 4]! * point[1]!
      + m[r + 8]! * point[2]! + m[r + 12]!);
    const clip = [0, 1, 2, 3].map(r => q[r]! * view[0]! + q[r + 4]! * view[1]!
      + q[r + 8]! * view[2]! + q[r + 12]! * view[3]!);
    return { x: clip[0]! / clip[3]! * camera.cssWidthPx * 0.5,
      y: clip[1]! / clip[3]! * camera.cssHeightPx * 0.5, depth: -view[2]! };
  };
  const along = (axis: Vector3, amount: number) => project([center[0] + axis.x * amount,
    center[1] + axis.y * amount, center[2] + axis.z * amount]);
  const width = (p.kind === 'pair' ? p.widthM : p.widthM / 2) * scale * 0.5;
  const height = p.heightM * scale * 0.5;
  const x0 = along(right, -width), x1 = along(right, width);
  const y0 = along(up, -height), y1 = along(up, height);
  const dx = [(x1.x - x0.x) / 2, (x1.y - x0.y) / 2];
  const dy = [(y1.x - y0.x) / 2, (y1.y - y0.y) / 2];
  const a = dx[0]! ** 2 + dy[0]! ** 2;
  const b = dx[0]! * dx[1]! + dy[0]! * dy[1]!;
  const c = dx[1]! ** 2 + dy[1]! ** 2;
  const radius = Math.hypot((a - c) / 2, b);
  const high = Math.sqrt(Math.max((a + c) / 2 + radius, 0));
  const low = Math.sqrt(Math.max((a + c) / 2 - radius, 0));
  const angle = Math.atan2(2 * b, a - c) / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const sourceHalfX = high * cos ** 2 + low * sin ** 2;
  const sourceHalfY = high * sin ** 2 + low * cos ** 2;
  const floorSize = TRAFFIC_LAMP_MIN_DIAMETER_PX * 0.5;
  const smoothFloor = (physical: number) => {
    const start = floorSize * (1 - TRAFFIC_LAMP_FLOOR_BLEND_SHARE);
    const end = floorSize * (1 + TRAFFIC_LAMP_FLOOR_BLEND_SHARE);
    if (physical <= start) return floorSize;
    if (physical >= end) return physical;
    return floorSize + (physical - start) ** 2 / (2 * (end - start));
  };
  const flooredHigh = smoothFloor(high), flooredLow = smoothFloor(low);
  const pairScale = (p.kind === 'pair' ? p.centreXM : p.widthM / 4) * scale;
  const pair0 = along(right, -pairScale), pair1 = along(right, pairScale);
  const pairX = (pair1.x - pair0.x) / 2, pairY = (pair1.y - pair0.y) / 2;
  const pairSpan = Math.hypot(pairX, pairY);
  const floorHalfX = flooredHigh * cos ** 2 + flooredLow * sin ** 2;
  const floorHalfY = flooredHigh * sin ** 2 + flooredLow * cos ** 2;
  const floorOffDiagonal = (flooredHigh - flooredLow) * cos * sin;
  const delta = camera.position.map((v, i) => v - center[i]!);
  const lampDistance = Math.hypot(...delta);
  return { sourceHalfX, sourceHalfY, sourceRadius: high,
    floorHalfX, floorHalfY,
    supportHalfX: Math.abs(floorHalfX) + Math.abs(floorOffDiagonal) + Math.abs(pairX),
    supportHalfY: Math.abs(floorHalfY) + Math.abs(floorOffDiagonal) + Math.abs(pairY),
    floorArea: flooredHigh * flooredLow,
    pairSpan, depth: project(center).depth, lampDistance,
    facing: (delta[0]! * forward.x + delta[1]! * forward.y + delta[2]! * forward.z) / lampDistance };
}
