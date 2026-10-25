import { describe, expect, it } from 'vitest';
import { TANK } from './constants';
import { WATER_BOUNDS, waterEntry } from './water';

const center = [TANK.center[0], TANK.surfaceY, TANK.center[2]] as const;

describe('waterEntry', () => {
  it('matches the tank: from its floor up to the water surface', () => {
    expect(WATER_BOUNDS.min[1]).toBe(TANK.bottomY);
    expect(WATER_BOUNDS.max[1]).toBe(TANK.surfaceY);
    expect(WATER_BOUNDS.max[0] - WATER_BOUNDS.min[0]).toBeCloseTo(TANK.innerSize[0]);
  });

  it('finds the surface below a ray pointed down at the tank', () => {
    expect(waterEntry([center[0], center[1] + 2, center[2]], [0, -1, 0], 3.5)).toBeCloseTo(2);
  });

  it('is 0 for a ray that starts in the water', () => {
    expect(waterEntry([center[0], center[1] - 0.3, center[2]], [1, 0, 0], 3.5)).toBe(0);
  });

  it('is null when the water is out of reach or the ray points away', () => {
    expect(waterEntry([center[0], center[1] + 2, center[2]], [0, -1, 0], 1.5)).toBeNull();
    expect(waterEntry([center[0], center[1] + 2, center[2]], [0, 1, 0], 3.5)).toBeNull();
    expect(waterEntry([center[0] + 10, center[1] + 0.5, center[2]], [0, -1, 0], 3.5)).toBeNull();
  });
});
