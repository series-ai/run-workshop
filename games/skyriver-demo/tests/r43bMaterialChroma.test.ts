import { describe, expect, it } from 'vitest';
import { profile, rotateMaterialChroma, STRUCTURE_MATERIAL_BASE_GAIN,
  STRUCTURE_MATERIAL_FAMILY_GAINS, MATERIAL_CHROMA_FAMILIES } from '../src/render/structureMaterial';
import { SKYRIVER_CITY_SHADER_SOURCE } from '../src/render/city';
import { withoutR43bMaterialChroma } from './support/r43bTowerSeparation';

const luminance = (rgb: readonly number[]) => rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
const bits32 = (value: number): number => new Uint32Array(new Float32Array([value]).buffer)[0]!;
const fromBits32 = (bits: number): number => new Float32Array(new Uint32Array([bits]).buffer)[0]!;
const MIN_NORMAL32 = 2 ** -126;
const STEP_SUBNORMAL32 = 2 ** -149;

const BASES = [
  [0, 0, 0], [-0, -0, -0], [0.006, 0.006, 0.006], [0.004, 0.005, 0.007],
  [0.023, 0.014, 0.006], [0.0007, 0.0013, 0.0004], [0.05, 0.002, 0.009],
  [1.2, 0.4, 0.9], [16, 4, 2], [2 ** -120, 2 ** -119, 2 ** -118],
  [STEP_SUBNORMAL32, STEP_SUBNORMAL32 * 2, STEP_SUBNORMAL32 * 4],
].map(rgb => rgb.map(Math.fround) as [number, number, number]);

describe('R43b independent material chroma contracts', () => {
  it('keeps the approved hue directions separate from the old material profiles', () => {
    expect(MATERIAL_CHROMA_FAMILIES.map(row => row.hue)).toEqual([
      [0.08, 0.12, 1.5], [1.1, 0.8, 0.9], [0.84, 1.08, 0.83], [1.68, 0.94, 0.52],
    ]);
    expect(MATERIAL_CHROMA_FAMILIES.map(row => row.factor)).toEqual([4, 2, 0.75, 1.5]);
  });

  it('keeps rotated RGB inside the approved material gamut', () => {
    for (const base of BASES) for (let family = 0; family < 4; family += 1) {
      for (const protection of [0, 0.25, 0.5, 1]) {
        const result = rotateMaterialChroma(base, family, protection);
        const ceiling = Math.max(1, ...base);
        const upperError = 8 * (fromBits32(bits32(ceiling) + 1) - ceiling);
        const lowerError = result.retainedY >= MIN_NORMAL32
          ? 8 * (fromBits32(bits32(result.retainedY) + 1) - result.retainedY)
          : 8 * STEP_SUBNORMAL32;
        expect(Math.max(...result.rgb)).toBeLessThanOrEqual(ceiling + upperError);
        expect(Math.min(...result.rgb)).toBeGreaterThanOrEqual(-lowerError);
      }
    }
  });

  it('classifies the existing dark glass reflection as material with the same masks', () => {
    const source = SKYRIVER_CITY_SHADER_SOURCE.towerFragment;
    const expression = 'vec3( 0.003, 0.006, 0.012 ) * glassRaw * pristine * ( 0.25 + 0.75 * fresnel ) * vIsSide * paneStepMask';
    const original = `  color += ${expression};`;
    const captured = `  materialBase += ${expression};`;
    expect(source.split(original)).toHaveLength(2);
    expect(source.split(captured)).toHaveLength(2);
    expect(source).toContain(original + '\n' + captured);
    expect(source.indexOf(captured)).toBeLessThan(source.indexOf('float materialProtection = materialChromaProtection( materialBase, color );'));
    const changed = source.replace(captured, captured.replace(' * pristine', ''));
    expect(() => withoutR43bMaterialChroma(changed, 'towerFragment')).toThrow('R43B_MATERIAL_CHROMA_DELTA_CHANGED');
  });

  it('rejects a changed protection gate before the old shader hash checks', () => {
    const source = SKYRIVER_CITY_SHADER_SOURCE.towerFragment;
    const changed = source.replace('smoothstep( 0.02, 0.04, maximum )', 'smoothstep( 0.02, 0.05, maximum )');
    expect(changed).not.toBe(source);
    expect(() => withoutR43bMaterialChroma(changed, 'towerFragment')).toThrow('R43B_MATERIAL_CHROMA_DELTA_CHANGED');
  });

  it('keeps the original material families and gains', () => {
    const original = [[0.95, 1, 1.05], [0.9, 1, 1.15], [1.12, 0.98, 0.82], [0.92, 1, 1.2]];
    expect(STRUCTURE_MATERIAL_BASE_GAIN).toBe(0.65);
    expect(STRUCTURE_MATERIAL_FAMILY_GAINS).toEqual([0.4, 0.9, 2.1, 0.6]);
    for (let family = 0; family < 4; family += 1) for (const low14 of [0, 97, 8191, 16383]) {
      expect(profile(family * 16384 + low14).chroma).toEqual(original[family]);
    }
  });

  it('retains the original Y word separately from reconstructed RGB', () => {
    for (const base of BASES) for (let family = 0; family < 4; family += 1) {
      const expectedY = Math.fround(luminance(base));
      for (const protection of [0, 0.25, 0.5, 0.999, 1, 2]) {
        const result = rotateMaterialChroma(base, family, protection);
        expect(bits32(result.retainedY), `${base}:${family}:${protection}`).toBe(bits32(expectedY));
        expect(result.retainedY).toBe(expectedY);
      }
    }
  });

  it('preserves source RGB bits under full protection', () => {
    for (const base of BASES) for (let family = 0; family < 4; family += 1) {
      for (const protection of [1, 2]) {
        const result = rotateMaterialChroma(base, family, protection);
        result.rgb.forEach((channel, i) => expect(bits32(channel)).toBe(bits32(base[i]!)));
      }
    }
  });

  it('bounds reconstructed RGB Y error by eight Float32 steps', () => {
    for (const base of BASES) for (let family = 0; family < 4; family += 1) {
      for (const protection of [0, 0.25, 0.5, 0.999, 1]) {
        const result = rotateMaterialChroma(base, family, protection);
        const y = result.retainedY;
        const tolerance = y >= MIN_NORMAL32
          ? 8 * (fromBits32(bits32(y) + 1) - y)
          : 8 * STEP_SUBNORMAL32;
        expect(Math.abs(luminance(result.rgb) - y), `${base}:${family}:${protection}`).toBeLessThanOrEqual(tolerance);
        expect(result.rgb.every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('shows that equal Y and max RGB do not preserve the neon saturation mask', () => {
    const original = [0.6, 0.42, 0.38] as const;
    const y = luminance(original);
    const changed = [0.6, (y - 0.2126 * 0.6 - 0.0722 * 0.42) / 0.7152, 0.42];
    const neonMask = (rgb: readonly number[]) => {
      const hi = Math.max(...rgb), lo = Math.min(...rgb);
      return (hi - lo) / Math.max(hi, 1e-9) >= 0.35 && hi >= 0.45;
    };
    expect(luminance(changed)).toBeCloseTo(y, 15);
    expect(Math.max(...changed)).toBe(Math.max(...original));
    expect(neonMask(original)).toBe(true);
    expect(neonMask(changed)).toBe(false);
  });
});
