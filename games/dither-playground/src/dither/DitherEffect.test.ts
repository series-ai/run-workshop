import { describe, it, expect } from 'vitest';
import {
  getDitherUniforms,
  updateDitherUniforms,
  DITHER_FRAGMENT_SHADER,
  GPU_DITHER_ALGORITHMS,
  type DitherEffectConfig,
} from './DitherEffect';

describe('getDitherUniforms', () => {
  const baseConfig: DitherEffectConfig = {
    algorithm: 'bayer',
    strength: 1,
  };

  it('returns all required uniforms', () => {
    const uniforms = getDitherUniforms(baseConfig);
    expect(uniforms).toHaveProperty('uAlgorithm');
    expect(uniforms).toHaveProperty('uStrength');
    expect(uniforms).toHaveProperty('uScale');
    expect(uniforms).toHaveProperty('uTime');
    expect(uniforms).toHaveProperty('uAnimated');
    expect(uniforms).toHaveProperty('uAnimationSpeed');
    expect(uniforms).toHaveProperty('uPalette');
    expect(uniforms).toHaveProperty('uPaletteSize');
    expect(uniforms).toHaveProperty('uHalftoneAngle');
    expect(uniforms).toHaveProperty('uBayerSize');
    expect(uniforms).toHaveProperty('uBrightness');
    expect(uniforms).toHaveProperty('uContrast');
    expect(uniforms).toHaveProperty('uGamma');
    expect(uniforms).toHaveProperty('uThreshold');
    expect(uniforms).toHaveProperty('uNoiseMode');
    expect(uniforms).toHaveProperty('uChromatic');
    expect(uniforms).toHaveProperty('uGlow');
    expect(uniforms).toHaveProperty('uDepthAware');
    expect(uniforms).toHaveProperty('uDepthScale');
  });

  it('maps algorithm to correct ID', () => {
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'bayer' }).uAlgorithm.value).toBe(0);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'blue-noise' }).uAlgorithm.value).toBe(1);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'halftone-dot' }).uAlgorithm.value).toBe(2);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'halftone-line' }).uAlgorithm.value).toBe(3);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'halftone-diamond' }).uAlgorithm.value).toBe(4);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'crosshatch' }).uAlgorithm.value).toBe(5);
    expect(getDitherUniforms({ ...baseConfig, algorithm: 'stipple' }).uAlgorithm.value).toBe(6);
  });

  it('defaults to 1-bit palette', () => {
    const uniforms = getDitherUniforms(baseConfig);
    expect(uniforms.uPaletteSize.value).toBe(2);
    const palette = uniforms.uPalette.value as Float32Array;
    // Black
    expect(palette[0]).toBeCloseTo(0);
    expect(palette[1]).toBeCloseTo(0);
    expect(palette[2]).toBeCloseTo(0);
    // White
    expect(palette[3]).toBeCloseTo(1);
    expect(palette[4]).toBeCloseTo(1);
    expect(palette[5]).toBeCloseTo(1);
  });

  it('encodes custom palette correctly', () => {
    const config: DitherEffectConfig = {
      ...baseConfig,
      paletteColors: [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
    };
    const uniforms = getDitherUniforms(config);
    expect(uniforms.uPaletteSize.value).toBe(3);
    const p = uniforms.uPalette.value as Float32Array;
    expect(p[0]).toBeCloseTo(1); // red R
    expect(p[1]).toBeCloseTo(0);
    expect(p[3]).toBeCloseTo(0); // green R
    expect(p[4]).toBeCloseTo(1); // green G
  });

  it('clamps palette to max size', () => {
    const colors = Array.from({ length: 50 }, () => [128, 128, 128]);
    const uniforms = getDitherUniforms({ ...baseConfig, paletteColors: colors });
    expect(uniforms.uPaletteSize.value).toBe(32);
  });

  it('sets strength correctly', () => {
    expect(getDitherUniforms({ ...baseConfig, strength: 0.5 }).uStrength.value).toBe(0.5);
    expect(getDitherUniforms({ ...baseConfig, strength: 0 }).uStrength.value).toBe(0);
  });

  it('uTime starts at 0', () => {
    expect(getDitherUniforms(baseConfig).uTime.value).toBe(0);
  });

  it('animated flag maps correctly', () => {
    expect(getDitherUniforms({ ...baseConfig, animated: true }).uAnimated.value).toBe(1);
    expect(getDitherUniforms({ ...baseConfig, animated: false }).uAnimated.value).toBe(0);
    expect(getDitherUniforms(baseConfig).uAnimated.value).toBe(0);
  });

  it('halftone angle converts to radians', () => {
    const uniforms = getDitherUniforms({ ...baseConfig, halftoneAngle: 45 });
    expect(uniforms.uHalftoneAngle.value).toBeCloseTo(Math.PI / 4);
  });

  it('defaults scale to 1', () => {
    expect(getDitherUniforms(baseConfig).uScale.value).toBe(1);
  });

  it('respects custom scale', () => {
    expect(getDitherUniforms({ ...baseConfig, scale: 4 }).uScale.value).toBe(4);
  });

  it('defaults brightness to 0', () => {
    expect(getDitherUniforms(baseConfig).uBrightness.value).toBe(0);
  });

  it('respects custom brightness', () => {
    expect(getDitherUniforms({ ...baseConfig, brightness: 0.3 }).uBrightness.value).toBe(0.3);
  });

  it('defaults contrast to 1', () => {
    expect(getDitherUniforms(baseConfig).uContrast.value).toBe(1);
  });

  it('respects custom contrast', () => {
    expect(getDitherUniforms({ ...baseConfig, contrast: 2 }).uContrast.value).toBe(2);
  });

  it('defaults gamma to 1', () => {
    expect(getDitherUniforms(baseConfig).uGamma.value).toBe(1);
  });

  it('respects custom gamma', () => {
    expect(getDitherUniforms({ ...baseConfig, gamma: 1.5 }).uGamma.value).toBe(1.5);
  });

  it('defaults threshold to 0.5', () => {
    expect(getDitherUniforms(baseConfig).uThreshold.value).toBe(0.5);
  });

  it('defaults noiseMode to 0', () => {
    expect(getDitherUniforms(baseConfig).uNoiseMode.value).toBe(0);
  });

  it('respects custom noiseMode', () => {
    expect(getDitherUniforms({ ...baseConfig, noiseMode: 2 }).uNoiseMode.value).toBe(2);
  });

  it('defaults chromatic to 0', () => {
    expect(getDitherUniforms(baseConfig).uChromatic.value).toBe(0);
  });

  it('respects custom chromatic', () => {
    expect(getDitherUniforms({ ...baseConfig, chromatic: 0.005 }).uChromatic.value).toBe(0.005);
  });

  it('defaults glow to 0', () => {
    expect(getDitherUniforms(baseConfig).uGlow.value).toBe(0);
  });

  it('respects custom glow', () => {
    expect(getDitherUniforms({ ...baseConfig, glow: 0.15 }).uGlow.value).toBe(0.15);
  });

  it('defaults depthAware to 0', () => {
    expect(getDitherUniforms(baseConfig).uDepthAware.value).toBe(0);
  });

  it('respects depthAware flag', () => {
    expect(getDitherUniforms({ ...baseConfig, depthAware: true }).uDepthAware.value).toBe(1);
  });

  it('defaults depthScale to 3', () => {
    expect(getDitherUniforms(baseConfig).uDepthScale.value).toBe(3);
  });

  it('respects custom depthScale', () => {
    expect(getDitherUniforms({ ...baseConfig, depthScale: 5 }).uDepthScale.value).toBe(5);
  });
});

describe('updateDitherUniforms', () => {
  it('advances uTime by delta', () => {
    const uniforms = getDitherUniforms({ algorithm: 'bayer', strength: 1 });
    expect(uniforms.uTime.value).toBe(0);
    updateDitherUniforms(uniforms, 0.016);
    expect(uniforms.uTime.value).toBeCloseTo(0.016);
    updateDitherUniforms(uniforms, 0.016);
    expect(uniforms.uTime.value).toBeCloseTo(0.032);
  });
});

describe('DITHER_FRAGMENT_SHADER', () => {
  it('is a non-empty string', () => {
    expect(typeof DITHER_FRAGMENT_SHADER).toBe('string');
    expect(DITHER_FRAGMENT_SHADER.length).toBeGreaterThan(100);
  });

  it('contains mainImage function', () => {
    expect(DITHER_FRAGMENT_SHADER).toContain('void mainImage');
  });

  it('declares all uniforms', () => {
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uAlgorithm');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uStrength');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uScale');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uTime');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform int uPaletteSize');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform vec3 uPalette');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uBrightness');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uContrast');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uGamma');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uThreshold');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uNoiseMode');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uChromatic');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uGlow');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uDepthAware');
    expect(DITHER_FRAGMENT_SHADER).toContain('uniform float uDepthScale');
  });

  it('contains all algorithm branches', () => {
    // Bayer
    expect(DITHER_FRAGMENT_SHADER).toContain('bayerValue');
    // Blue noise
    expect(DITHER_FRAGMENT_SHADER).toContain('fract(52.9829189');
    // Halftone
    expect(DITHER_FRAGMENT_SHADER).toContain('uHalftoneAngle');
    // Crosshatch
    expect(DITHER_FRAGMENT_SHADER).toContain('Crosshatch');
    // Stipple
    expect(DITHER_FRAGMENT_SHADER).toContain('hash21');
  });
});

describe('GPU_DITHER_ALGORITHMS', () => {
  it('has 7 algorithms', () => {
    expect(GPU_DITHER_ALGORITHMS.length).toBe(7);
  });

  it('does not include error-diffusion algorithms', () => {
    expect(GPU_DITHER_ALGORITHMS).not.toContain('floyd-steinberg');
    expect(GPU_DITHER_ALGORITHMS).not.toContain('atkinson');
  });
});

describe('compare grid', () => {
  const eightCells = {
    cols: 4,
    rows: 2,
    algorithms: ['bayer', 'blue-noise', 'halftone-dot', 'halftone-line',
                 'halftone-diamond', 'crosshatch', 'stipple', 'original'] as const,
  };

  it('enables compare uniforms and maps per-cell algorithm IDs', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1, compare: { ...eightCells, algorithms: [...eightCells.algorithms] } });
    expect(u.uCompareEnabled.value).toBe(1);
    expect(u.uCompareCols.value).toBe(4);
    expect(u.uCompareRows.value).toBe(2);
    const cells = u.uCellAlgorithms.value as Float32Array;
    expect(Array.from(cells.slice(0, 8))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('defaults to compare-disabled', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1 });
    expect(u.uCompareEnabled.value).toBe(0);
    expect(u.uCompareCols.value).toBe(1);
    expect(u.uCompareRows.value).toBe(1);
  });

  it('applies per-cell noise modes, falling back to config.noiseMode', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1, noiseMode: 3,
      compare: { cols: 2, rows: 1, algorithms: ['bayer', 'bayer'], noiseModes: [0, 1] } });
    const nm = u.uCellNoiseModes.value as Float32Array;
    expect(nm[0]).toBe(0);
    expect(nm[1]).toBe(1);
  });

  it('uses config.noiseMode for every cell when noiseModes is omitted', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1, noiseMode: 3,
      compare: { cols: 2, rows: 1, algorithms: ['bayer', 'bayer'] } });
    expect((u.uCellNoiseModes.value as Float32Array)[0]).toBe(3);
  });

  it('applies per-cell animated flags, falling back to config.animated', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1,
      compare: { cols: 2, rows: 1, algorithms: ['bayer', 'bayer'], noiseModes: [0, 1], animated: [false, true] } });
    const ca = u.uCellAnimated.value as Float32Array;
    expect(Array.from(ca.slice(0, 2))).toEqual([0, 1]);
  });

  it('uses config.animated for every cell when compare.animated is omitted', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1, animated: true,
      compare: { cols: 2, rows: 1, algorithms: ['bayer', 'bayer'] } });
    expect((u.uCellAnimated.value as Float32Array)[0]).toBe(1);
  });
});

describe('resolve mask', () => {
  it('emits resolve uniforms from config', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1, resolve: { center: [0.25, 0.75], radius: 0.2 } });
    expect(Array.from(u.uResolveCenter.value as Float32Array)).toEqual([0.25, 0.75]);
    expect(u.uResolveRadius.value).toBe(0.2);
  });

  it('defaults to resolve-disabled', () => {
    const u = getDitherUniforms({ algorithm: 'bayer', strength: 1 });
    expect(u.uResolveRadius.value).toBe(0);
  });
});

describe('shader extensions', () => {
  it('shader contains compare-grid and resolve-mask symbols', () => {
    expect(DITHER_FRAGMENT_SHADER).toContain('uCellAlgorithms');
    expect(DITHER_FRAGMENT_SHADER).toContain('uCellNoiseModes');
    expect(DITHER_FRAGMENT_SHADER).toContain('uCellAnimated');
    expect(DITHER_FRAGMENT_SHADER).toContain('uResolveCenter');
    expect(DITHER_FRAGMENT_SHADER).toContain('uResolveRadius');
  });
});
