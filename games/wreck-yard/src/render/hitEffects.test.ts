import { describe, expect, it } from 'vitest';
import { FLICKER_TICKS } from '../sim/floodlights';
import { flickerLit, yardLightLevel } from './Floodlights';
import { hitEffect } from './ImpactEffects';

describe('hit effects', () => {
  it('throws sparks only from a fast steel hit on steel or concrete, with dust on concrete', () => {
    expect(hitEffect({ materials: ['steel', 'concrete'], speed: 6 })).toEqual({ chips: 'spark', chipCount: 8, dust: true });
    expect(hitEffect({ materials: ['steel', 'steel'], speed: 6 })).toEqual({ chips: 'spark', chipCount: 8, dust: false });
    expect(hitEffect({ materials: ['steel', 'concrete'], speed: 2 }).chips).toBeNull();
    expect(hitEffect({ materials: ['steel', 'rubber'], speed: 9 }).chips).toBeNull();
  });

  it('throws splinters from wood, chips from glass, and nothing from rubber on concrete', () => {
    expect(hitEffect({ materials: ['wood', 'concrete'], speed: 6 })).toEqual({ chips: 'splinter', chipCount: 5, dust: true });
    expect(hitEffect({ materials: ['glass', 'steel'], speed: 6 }).chips).toBe('glass');
    expect(hitEffect({ materials: ['rubber', 'concrete'], speed: 8 })).toEqual({ chips: null, chipCount: 0, dust: false });
  });

  it('throws more chips from a harder hit, up to twice as many', () => {
    expect(hitEffect({ materials: ['wood', 'wood'], speed: 3 }).chipCount).toBeLessThan(hitEffect({ materials: ['wood', 'wood'], speed: 6 }).chipCount);
    expect(hitEffect({ materials: ['wood', 'wood'], speed: 30 }).chipCount).toBe(10);
  });
});

describe('floodlight look', () => {
  it('dims the yard a little for each lamp out, and much more with all four out', () => {
    const levels = [4, 3, 2, 1, 0].map(yardLightLevel);
    expect(levels[0]).toEqual({ key: 1, sky: 1 });
    for (let index = 1; index < levels.length; index++) {
      expect(levels[index]!.key).toBeLessThan(levels[index - 1]!.key);
      expect(levels[index]!.sky).toBeLessThan(levels[index - 1]!.sky);
    }
    expect(levels[4]!.key).toBeLessThan(0.5);
  });

  it('flickers dark for some ticks and always ends lit', () => {
    const pattern = Array.from({ length: FLICKER_TICKS }, (_, age) => flickerLit(age, 0));
    expect(pattern.some((lit) => !lit)).toBe(true);
    expect(flickerLit(FLICKER_TICKS, 0)).toBe(true);
    expect(flickerLit(FLICKER_TICKS * 10, 3)).toBe(true);
  });
});
