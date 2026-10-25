import { describe, expect, it } from 'vitest';
import { BLAST } from '../sim/fuelDrum';
import { EXPLOSION_FX_SECONDS, explosionFrame, SHOCK_SECONDS } from './explosionFx';

const R = BLAST.radius;

describe('explosion effect timing', () => {
  it('grows the shock to exactly the blast radius, and never past it', () => {
    for (let t = 0; t <= EXPLOSION_FX_SECONDS; t += 0.01) {
      const frame = explosionFrame(t, R);
      expect(frame.shockRadius).toBeLessThanOrEqual(R + 1e-9);
      expect(frame.ringRadius).toBeLessThanOrEqual(R + 1e-9);
      expect(frame.fireballRadius).toBeLessThan(R);
    }
    expect(explosionFrame(SHOCK_SECONDS, R).ringRadius).toBeCloseTo(R, 9);
    expect(explosionFrame(SHOCK_SECONDS + 0.1, R).ringOpacity).toBeGreaterThan(0);
  });

  it('starts with a flash and a growing fireball, and ends with nothing left', () => {
    const start = explosionFrame(0, R);
    expect(start.flash).toBe(1);
    expect(explosionFrame(0.1, R).fireballRadius).toBeGreaterThan(start.fireballRadius);
    const end = explosionFrame(EXPLOSION_FX_SECONDS, R);
    expect(end.flash).toBe(0);
    expect(end.fireballOpacity).toBe(0);
    expect(end.shockOpacity).toBe(0);
    expect(end.ringOpacity).toBe(0);
    expect(end.smoke).toBeNull();
    expect(end.scorchOpacity).toBe(0);
  });

  it('scales with the radius', () => {
    expect(explosionFrame(0.2, 2 * R).shockRadius).toBeCloseTo(2 * explosionFrame(0.2, R).shockRadius, 9);
  });
});
