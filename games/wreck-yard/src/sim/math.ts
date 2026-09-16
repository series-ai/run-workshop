import { conjugateQuaternion, normalizeQuaternion, rotateVector } from 'voxel-kit';

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];

export const ZERO3: Vec3 = [0, 0, 0];
export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function length(a: Vec3): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l <= 1e-9 ? ZERO3 : [a[0] / l, a[1] / l, a[2] / l];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rotate(v: Vec3, q: Quat): Vec3 {
  return rotateVector([v[0], v[1], v[2]], [q[0], q[1], q[2], q[3]]);
}

export function rotateInverse(v: Vec3, q: Quat): Vec3 {
  return rotateVector([v[0], v[1], v[2]], conjugateQuaternion([q[0], q[1], q[2], q[3]]));
}

export function quatNormalize(q: Quat): Quat {
  return normalizeQuaternion([q[0], q[1], q[2], q[3]]);
}

/** Normalized linear interpolation. Enough for one tick of rotation. */
export function quatNlerp(a: Quat, b: Quat, t: number): Quat {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = dot < 0 ? -1 : 1;
  return quatNormalize([
    lerp(a[0], b[0] * sign, t),
    lerp(a[1], b[1] * sign, t),
    lerp(a[2], b[2] * sign, t),
    lerp(a[3], b[3] * sign, t),
  ]);
}
