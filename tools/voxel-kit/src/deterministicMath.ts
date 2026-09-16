export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];

const PI = 3.141592653589793;
const TWO_PI = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

/**
 * Sine built from IEEE add, multiply, divide, and floor only, so every
 * JavaScript engine returns the same bits. Max error about 4e-6.
 */
export function deterministicSin(x: number): number {
  let t = x - Math.floor((x + PI) / TWO_PI) * TWO_PI;
  if (t > HALF_PI) t = PI - t;
  else if (t < -HALF_PI) t = -PI - t;
  const t2 = t * t;
  return t * (1 - (t2 / 6) * (1 - (t2 / 20) * (1 - (t2 / 42) * (1 - (t2 / 72) * (1 - t2 / 110)))));
}

export function deterministicCos(x: number): number {
  return deterministicSin(x + HALF_PI);
}

export function rotateVector([x, y, z]: Vec3Tuple, [qx, qy, qz, qw]: QuatTuple): Vec3Tuple {
  const uvx = qy * z - qz * y;
  const uvy = qz * x - qx * z;
  const uvz = qx * y - qy * x;
  const uuvx = qy * uvz - qz * uvy;
  const uuvy = qz * uvx - qx * uvz;
  const uuvz = qx * uvy - qy * uvx;
  return [x + (uvx * qw + uuvx) * 2, y + (uvy * qw + uuvy) * 2, z + (uvz * qw + uuvz) * 2];
}

export function conjugateQuaternion([x, y, z, w]: QuatTuple): QuatTuple {
  return [-x, -y, -z, w];
}

export function normalizeQuaternion([x, y, z, w]: QuatTuple): QuatTuple {
  const length = Math.sqrt(x * x + y * y + z * z + w * w);
  if (length <= 1e-12) return [0, 0, 0, 1];
  return [x / length, y / length, z / length, w / length];
}
