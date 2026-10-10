import { describe, expect, it } from 'vitest';

import {
  decodeCard,
  encodeCard,
  linearLuminance,
  normalizeMaterial,
  profile,
  quantize,
  stageWeights,
  type CardCodecResult,
  type StructureMaterialProfile,
} from '../src/render/structureMaterial';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { buildingSeedOf, deriveFarTowers, deriveCityMasses } from '../src/render/city';
import { SKYRIVER_INTERIOR_FADE } from '../src/render/interiorResponse';

const SEEDS = [424242, 0, 2147483647, 4294967295] as const;

describe('structure material profile and codec', () => {
  it('correctly encodes and decodes card variants and quantized seeds in Float32', () => {
    for (let variant = 0; variant < 64; variant += 7) {
      for (let q = 0; q < 65536; q += 257) {
        const packed = encodeCard(variant, q);
        const decoded = decodeCard(packed);
        expect(decoded.variant).toBe(variant);
        expect(decoded.q).toBe(q);
      }
    }
    // Boundary checks
    for (const variant of [0, 63]) {
      for (const q of [0, 1, 65534, 65535]) {
        const packed = encodeCard(variant, q);
        const decoded = decodeCard(packed);
        expect(decoded.variant).toBe(variant);
        expect(decoded.q).toBe(q);
      }
    }
  });

  it('quantizes Float32 seeds deterministically into [0, 65535]', () => {
    expect(quantize(0)).toBe(0);
    expect(quantize(1)).toBe(65535);
    expect(quantize(0.5)).toBe(32768);
    for (let q = 0; q < 65536; q += 1024) {
      const seed32 = Math.fround((q + 0.5) / 65536);
      expect(quantize(seed32)).toBe(q);
    }
  });

  it('contains at least four material families in the fixed 20-owner fixture for each seed', () => {
    for (const seed of SEEDS) {
      const layout = deriveCityLayout(seed);
      const original = layout.towers
        .map((tower, index) => ({ id: `${seed}:${tower.x}:${tower.z}`, originalIndex: index, ...tower }))
        .sort((a, b) => a.z - b.z || a.x - b.x || a.originalIndex - b.originalIndex)
        .slice(0, 20);

      expect(original.length).toBe(20);
      const families = new Set<number>();
      for (const tower of original) {
        const seed32 = Math.fround(buildingSeedOf(tower.x, tower.z));
        const q = quantize(seed32);
        const p = profile(q);
        expect(p.family).toBeGreaterThanOrEqual(0);
        expect(p.family).toBeLessThan(4);
        families.add(p.family);
      }
      expect(families.size).toBe(4);
    }
  });

  it('bounds combined material luminance gain within [0.82, 1.18] and handles zero correctly', () => {
    const c0: [number, number, number] = [0.2, 0.4, 0.6];
    const y0 = linearLuminance(c0);

    for (const base of [-1, -0.5, 0, 0.5, 1]) {
      for (const weather of [-1, 0, 1]) {
        for (const face of [-1, 0, 1]) {
          const proposed: [number, number, number] = [0.3 * (1 + 0.1 * base), 0.5, 0.4];
          const result = normalizeMaterial(c0, proposed, base, weather, face);
          const y1 = linearLuminance(result);
          const ratio = y1 / y0;
          expect(ratio).toBeGreaterThanOrEqual(0.82 - 1e-6);
          expect(ratio).toBeLessThanOrEqual(1.18 + 1e-6);
          expect(result.every((c) => c >= 0 && Number.isFinite(c))).toBe(true);
        }
      }
    }

    // Zero input yields zero output
    expect(normalizeMaterial([0, 0, 0], [1, 1, 1], 0, 0, 0)).toEqual([0, 0, 0]);

    // Near-zero input handling
    const tinyC0: [number, number, number] = [1e-18, 1e-18, 1e-18];
    const tinyResult = normalizeMaterial(tinyC0, [0.5, 0.5, 0.5], 0, 0, 0);
    expect(tinyResult.every((c) => c >= 0 && Number.isFinite(c))).toBe(true);
  });

  it('maintains interior stage weight invariants: 0 <= F <= S <= 1 and monotone decay', () => {
    for (const mode of ['full', 'near'] as const) {
      const band = SKYRIVER_INTERIOR_FADE[mode];
      for (const strength of [0, 0.5, 1.0]) {
        for (const grazing of [0, 0.5, 1.0]) {
          for (const cellPixels of [2, 4, 7, 10, 20]) {
            let prevS = Infinity;
            let prevF = Infinity;
            for (let depth = band[0]; depth <= band[1]; depth += 20) {
              const weights = stageWeights({
                mode,
                strength,
                grazing,
                isSide: 1,
                cellPixels,
                viewDepth: depth,
              });
              expect(weights.s).toBeGreaterThanOrEqual(0);
              expect(weights.s).toBeLessThanOrEqual(1);
              expect(weights.f).toBeGreaterThanOrEqual(0);
              expect(weights.f).toBeLessThanOrEqual(weights.s + 1e-9);
              expect(weights.s).toBeLessThanOrEqual(prevS + 1e-9);
              expect(weights.f).toBeLessThanOrEqual(prevF + 1e-9);
              prevS = weights.s;
              prevF = weights.f;
            }
          }
        }
      }
    }

    // Off mode yields 0
    expect(stageWeights({ mode: 'off', strength: 1, grazing: 1, isSide: 1, cellPixels: 10, viewDepth: 200 })).toEqual({ s: 0, f: 0 });
  });

  it('guarantees identical far tower owner q across body, cap, spire and card', () => {
    for (const seed of SEEDS) {
      const layout = presentCityLayout(deriveCityLayout(seed));
      const far = deriveFarTowers(layout);
      for (const f of far) {
        const farSeed32 = Math.fround(buildingSeedOf(f.x, f.v));
        const farQ = quantize(farSeed32);
        const encoded = encodeCard(0, farQ);
        const decoded = decodeCard(encoded);
        expect(decoded.q).toBe(farQ);

        const profNear = profile(farQ);
        const profFar = profile(decoded.q);
        expect(profNear).toEqual(profFar);
      }
    }
  });
});
