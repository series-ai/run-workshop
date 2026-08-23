import { describe, it, expect } from 'vitest';
import {
  ALL_PRESETS,
  PALETTE_PRESETS,
  PRESET_CATEGORIES,
  PALETTE_1BIT_RAW,
  PALETTE_GAMEBOY_RAW,
  PALETTE_CGA_RAW,
  PALETTE_PICO8_RAW,
  PALETTE_GRAYSCALE_4_RAW,
  PALETTE_GRAYSCALE_8_RAW,
  PALETTE_NOKIA_RAW,
  PALETTE_AMBER_RAW,
  PALETTE_C64_RAW,
  PALETTE_SWEETIE_16_RAW,
  DEFAULT_STRENGTH,
  DEFAULT_SCALE,
  DEFAULT_BRIGHTNESS,
  DEFAULT_CONTRAST,
  DEFAULT_GAMMA,
  DEFAULT_THRESHOLD,
} from './presets';

describe('ALL_PRESETS', () => {
  it('has 18 presets', () => {
    expect(ALL_PRESETS.length).toBe(18);
  });

  it('all have unique labels', () => {
    const labels = ALL_PRESETS.map(p => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('all have valid algorithm', () => {
    const validAlgorithms = ['bayer', 'blue-noise', 'halftone-dot', 'halftone-line', 'halftone-diamond', 'crosshatch', 'stipple'];
    for (const preset of ALL_PRESETS) {
      expect(validAlgorithms).toContain(preset.config.algorithm);
    }
  });

  it('all have strength in [0,1]', () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.config.strength).toBeGreaterThanOrEqual(0);
      expect(preset.config.strength).toBeLessThanOrEqual(1);
    }
  });

  it('all have palette colors', () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.config.paletteColors).toBeDefined();
      expect(preset.config.paletteColors!.length).toBeGreaterThan(0);
    }
  });

  it('covers all families', () => {
    const families = new Set(ALL_PRESETS.map(p => p.family));
    expect(families).toContain('ordered');
    expect(families).toContain('halftone');
    expect(families).toContain('pattern');
    expect(families).toContain('blue-noise');
  });

  it('covers all categories', () => {
    const categories = new Set(ALL_PRESETS.map(p => p.category));
    expect(categories).toContain('retro');
    expect(categories).toContain('print');
    expect(categories).toContain('atmospheric');
    expect(categories).toContain('artistic');
  });

  it('includes animated presets', () => {
    const animated = ALL_PRESETS.filter(p => p.config.animated);
    expect(animated.length).toBeGreaterThan(0);
  });

  it('includes presets with new effect parameters', () => {
    const withChromatic = ALL_PRESETS.filter(p => (p.config.chromatic ?? 0) > 0);
    const withGlow = ALL_PRESETS.filter(p => (p.config.glow ?? 0) > 0);
    const withContrast = ALL_PRESETS.filter(p => (p.config.contrast ?? 1) !== 1);
    const withDepthAware = ALL_PRESETS.filter(p => p.config.depthAware);
    expect(withChromatic.length).toBeGreaterThan(0);
    expect(withGlow.length).toBeGreaterThan(0);
    expect(withContrast.length).toBeGreaterThan(0);
    expect(withDepthAware.length).toBeGreaterThan(0);
  });
});

describe('PRESET_CATEGORIES', () => {
  it('has 4 categories', () => {
    expect(PRESET_CATEGORIES.length).toBe(4);
  });

  it('covers retro, print, atmospheric, artistic', () => {
    const cats = PRESET_CATEGORIES.map(c => c.category);
    expect(cats).toContain('retro');
    expect(cats).toContain('print');
    expect(cats).toContain('atmospheric');
    expect(cats).toContain('artistic');
  });
});

describe('PALETTE_PRESETS', () => {
  it('has 10 palette presets', () => {
    expect(PALETTE_PRESETS.length).toBe(10);
  });

  it('all have unique labels', () => {
    const labels = PALETTE_PRESETS.map(p => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('all have at least 2 colors', () => {
    for (const palette of PALETTE_PRESETS) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all colors are valid RGB (0-255)', () => {
    for (const palette of PALETTE_PRESETS) {
      for (const color of palette.colors) {
        expect(color.length).toBe(3);
        for (const channel of color) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});

describe('raw palettes', () => {
  it('1-bit has 2 colors', () => { expect(PALETTE_1BIT_RAW.length).toBe(2); });
  it('Game Boy has 4 colors', () => { expect(PALETTE_GAMEBOY_RAW.length).toBe(4); });
  it('CGA has 16 colors', () => { expect(PALETTE_CGA_RAW.length).toBe(16); });
  it('PICO-8 has 16 colors', () => { expect(PALETTE_PICO8_RAW.length).toBe(16); });
  it('Grayscale 4 has 4 colors', () => { expect(PALETTE_GRAYSCALE_4_RAW.length).toBe(4); });
  it('Grayscale 8 has 8 colors', () => { expect(PALETTE_GRAYSCALE_8_RAW.length).toBe(8); });
  it('Nokia has 2 colors', () => { expect(PALETTE_NOKIA_RAW.length).toBe(2); });
  it('Amber has 2 colors', () => { expect(PALETTE_AMBER_RAW.length).toBe(2); });
  it('C64 has 16 colors', () => { expect(PALETTE_C64_RAW.length).toBe(16); });
  it('Sweetie 16 has 16 colors', () => { expect(PALETTE_SWEETIE_16_RAW.length).toBe(16); });
});

describe('defaults', () => {
  it('DEFAULT_STRENGTH is 1', () => { expect(DEFAULT_STRENGTH).toBe(1); });
  it('DEFAULT_SCALE is 1', () => { expect(DEFAULT_SCALE).toBe(1); });
  it('DEFAULT_BRIGHTNESS is 0', () => { expect(DEFAULT_BRIGHTNESS).toBe(0); });
  it('DEFAULT_CONTRAST is 1', () => { expect(DEFAULT_CONTRAST).toBe(1); });
  it('DEFAULT_GAMMA is 1', () => { expect(DEFAULT_GAMMA).toBe(1); });
  it('DEFAULT_THRESHOLD is 0.5', () => { expect(DEFAULT_THRESHOLD).toBe(0.5); });
});
