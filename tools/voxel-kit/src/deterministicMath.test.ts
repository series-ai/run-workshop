import { describe, expect, it } from 'vitest';
import { conjugateQuaternion, deterministicSin, normalizeQuaternion, rotateVector } from './deterministicMath';

describe('deterministicSin', () => {
  it('matches Math.sin within 1e-5 across ten periods', () => {
    for (let i = -2000; i <= 2000; i += 1) {
      const x = i * 0.0314159;
      expect(Math.abs(deterministicSin(x) - Math.sin(x))).toBeLessThan(1e-5);
    }
  });

  it('is exact at zero and pi', () => {
    expect(deterministicSin(0)).toBe(0);
    expect(Math.abs(deterministicSin(3.141592653589793))).toBeLessThan(1e-12);
  });
});

describe('quaternion helpers', () => {
  it('rotates a vector by the conjugate back to itself', () => {
    const q = normalizeQuaternion([0.1, 0.7, -0.2, 0.6]);
    const v: [number, number, number] = [1, 2, 3];
    const back = rotateVector(rotateVector(v, q), conjugateQuaternion(q));
    expect(back[0]).toBeCloseTo(1, 10);
    expect(back[1]).toBeCloseTo(2, 10);
    expect(back[2]).toBeCloseTo(3, 10);
  });
});
