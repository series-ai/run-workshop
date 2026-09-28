import { describe, expect, it } from 'vitest';
import { toonGlsl } from './toonGlsl';

describe('toonGlsl dither & metallic rim (T2, T4, R4, R5)', () => {
  it('contains bayer4x4 matrix implementation', () => {
    expect(toonGlsl).toContain('float bayer4x4(vec2 screenPos)');
    expect(toonGlsl).toContain('mat4 bayer = mat4');
    expect(toonGlsl).toContain('15.0/16.0');
  });

  it('contains toonTint and toonTintDither functions', () => {
    expect(toonGlsl).toContain('vec3 toonTint(');
    expect(toonGlsl).toContain('vec3 toonTintDither(');
    expect(toonGlsl).toContain('uRampEdges.x + dither');
  });

  it('contains metallicRim function with stepped fresnel', () => {
    expect(toonGlsl).toContain('vec3 metallicRim(');
    expect(toonGlsl).toContain('step(0.68, fresnel) * metalness');
    expect(toonGlsl).toContain('warmTungsten');
  });
});
