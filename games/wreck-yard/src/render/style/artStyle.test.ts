import { describe, expect, it } from 'vitest';
import {
  ART_STYLE,
  deriveLightRig,
  toonBand,
  toonTint,
  type PaletteKey,
} from './artStyle';
import { WORLD_SUN_DIRECTION } from '../viewConstants';

describe('ART_STYLE definitions & invariants (T1)', () => {
  it('enforces toon ramp invariants', () => {
    const { ramp } = ART_STYLE;
    expect(ramp.edges[0]).toBeGreaterThan(0);
    expect(ramp.edges[1]).toBeGreaterThan(ramp.edges[0]);
    expect(ramp.edges[1]).toBeLessThan(1);

    expect(ramp.halfLevel).toBeGreaterThan(0);
    expect(ramp.halfLevel).toBeLessThan(1);

    ramp.shadeTint.forEach((channel) => {
      expect(channel).toBeGreaterThan(0);
      expect(channel).toBeLessThan(1);
    });

    ramp.litTint.forEach((channel) => {
      expect(channel).toBeGreaterThan(0);
      expect(channel).toBeLessThanOrEqual(1.05);
    });
  });

  it('enforces silhouetteFade[1] is less than the nearest skyline distance', () => {
    const { ink } = ART_STYLE;
    const NEAREST_SKYLINE_DISTANCE = 45; // metres
    expect(ink.silhouetteFade[0]).toBeLessThan(ink.silhouetteFade[1]);
    expect(ink.silhouetteFade[1]).toBeLessThan(NEAREST_SKYLINE_DISTANCE);
  });

  it('imports keyDirection from WORLD_SUN_DIRECTION', () => {
    expect(ART_STYLE.keyDirection).toEqual(WORLD_SUN_DIRECTION);
  });

  it('contains all required palette swatch keys', () => {
    const requiredKeys: PaletteKey[] = [
      'skyZenith',
      'skyBand',
      'skyLow',
      'skyline',
      'signalOrange',
      'orangeShade',
      'concreteLit',
      'concreteShade',
      'floor',
      'teal',
      'mustard',
      'rust',
      'spark',
      'glow',
      'ink',
    ];

    requiredKeys.forEach((key) => {
      expect(ART_STYLE.palette[key]).toBeDefined();
      expect(ART_STYLE.palette[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('pure toonBand maps nDotL * shadow to discrete 3-band steps (0, 1, 2)', () => {
    const { ramp } = ART_STYLE;
    // Dark shade (below edge 0)
    expect(toonBand(0.0, 1.0, ramp)).toBe(0);
    expect(toonBand(ramp.edges[0] - 0.02, 1.0, ramp)).toBe(0);
    expect(toonBand(1.0, 0.0, ramp)).toBe(0); // in shadow

    // Half-tone band (between edge 0 and edge 1)
    const midPoint = (ramp.edges[0] + ramp.edges[1]) / 2;
    expect(toonBand(midPoint, 1.0, ramp)).toBe(1);

    // Full light band (above edge 1)
    expect(toonBand(ramp.edges[1] + 0.02, 1.0, ramp)).toBe(2);
    expect(toonBand(1.0, 1.0, ramp)).toBe(2);
  });

  it('pure toonTint interpolates between shade, half-tone, and lit', () => {
    const { ramp } = ART_STYLE;
    const shade = toonTint(0, ramp);
    expect(shade).toEqual(ramp.shadeTint);

    const lit = toonTint(2, ramp);
    expect(lit).toEqual(ramp.litTint);

    const half = toonTint(1, ramp);
    for (let i = 0; i < 3; i++) {
      const expected = ramp.shadeTint[i] + (ramp.litTint[i] - ramp.shadeTint[i]) * ramp.halfLevel;
      expect(half[i]).toBeCloseTo(expected, 4);
    }
  });

  it('deriveLightRig provides exact π-scaled irradiance for Three.js toon shading', () => {
    const rig = deriveLightRig(ART_STYLE);
    const { ramp } = ART_STYLE;

    // Ambient light matches shadeTint * PI
    for (let i = 0; i < 3; i++) {
      expect(rig.ambient.color[i]).toBeCloseTo(ramp.shadeTint[i] * Math.PI, 4);
    }

    // Directional light matches (litTint - shadeTint) * PI
    for (let i = 0; i < 3; i++) {
      expect(rig.key.color[i]).toBeCloseTo((ramp.litTint[i] - ramp.shadeTint[i]) * Math.PI, 4);
    }

    // Sum of ambient + key on normal pointing directly at key light equals litTint * PI
    for (let i = 0; i < 3; i++) {
      const totalIrradiance = rig.ambient.color[i] + rig.key.color[i];
      expect(totalIrradiance).toBeCloseTo(ramp.litTint[i] * Math.PI, 4);
    }

    // Key light position aligns with keyDirection
    expect(rig.key.position[0] / 40).toBeCloseTo(ART_STYLE.keyDirection[0], 4);
    expect(rig.key.position[1] / 40).toBeCloseTo(ART_STYLE.keyDirection[1], 4);
    expect(rig.key.position[2] / 40).toBeCloseTo(ART_STYLE.keyDirection[2], 4);
  });
});
