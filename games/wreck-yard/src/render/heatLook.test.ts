import { describe, expect, it } from 'vitest';
import { HEAT, TICK_RATE } from '../sim/constants';
import type { YardBody } from '../sim/state';
import { COLD_AGE, heatAge, heatGlow, heatOfBody } from './heatLook';

describe('heat look', () => {
  it('measures the age from the last heat, and a body with no heat is cold', () => {
    expect(heatAge(130, { frame: 100, at: [0, 0, 0] })).toBeCloseTo(30 / TICK_RATE);
    expect(heatAge(90, { frame: 100, at: [0, 0, 0] })).toBe(0);
    expect(heatAge(100, null)).toBe(COLD_AGE);
  });

  it('reads the heat of a body from the given body list', () => {
    const body = (id: string, frame: number | null): YardBody => ({
      id, label: id, dims: { x: 1, y: 1, z: 1 }, voxels: new Uint8Array([5]), motion: 'dynamic', buoyancy: 0, anchorFaces: [],
      impactCooldownUntil: 0, heat: frame === null ? null : { frame, at: [0, 0, 0] },
    });
    const before = [body('a', 10), body('b', null)];
    const after = [body('a', 40), body('b', 41)];
    expect(heatOfBody(before, 'a')?.frame).toBe(10);
    expect(heatOfBody(before, 'b')).toBeNull();
    expect(heatOfBody(after, 'a')?.frame).toBe(40);
    expect(heatOfBody(after, 'b')?.frame).toBe(41);
    expect(heatOfBody(after, 'missing')).toBeNull();
  });

  it('glows fully when fresh, fades, and is dark from the glow time on', () => {
    expect(heatGlow(0)).toBe(1);
    expect(heatGlow(HEAT.glowSeconds * 0.5)).toBeCloseTo(0.25);
    expect(heatGlow(HEAT.glowSeconds)).toBe(0);
    expect(heatGlow(COLD_AGE)).toBe(0);
  });

  it('cools in order: glow ends before brown, brown before burnt', () => {
    expect(HEAT.glowSeconds).toBeLessThan(HEAT.brownSeconds);
    expect(HEAT.brownSeconds).toBeLessThan(HEAT.burntSeconds);
  });
});
