import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import materialBaseline from './fixtures/r29b-material-baseline.json';
import { withoutR32RoofPolicy } from './support/r32RoofPolicy';
import * as THREE from 'three';
// These external texture stubs permit real geometry construction. They do not supply an oracle.
vi.mock('../src/render/signAtlas', async importOriginal => {
  const original = await importOriginal<typeof import('../src/render/signAtlas')>();
  return { ...original, createSignAtlas: () => ({ texture: new THREE.Texture(),
    vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const),
    horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) };
});
vi.mock('../src/render/interiorAtlas', async importOriginal => {
  const original = await importOriginal<typeof import('../src/render/interiorAtlas')>();
  return { ...original, createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) };
});
vi.mock('../src/render/impostorAtlas', async importOriginal => {
  const original = await importOriginal<typeof import('../src/render/impostorAtlas')>();
  return { ...original, createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) };
});
import { SkyriverCity, buildingSeedOf, deriveCityMasses, deriveFarTowers, deriveCityTrims, deriveHeroBlades, skyriverTrimBlocksHero, SKYRIVER_CITY_SHADER_SOURCE } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { SkyriverDistrictColourSwitch, deriveSkyriverDistrictModel, skyriverDistrictIdAt } from '../src/render/districts';
import { windowPaletteCode, windowPaletteCodeFromQ, windowPaletteHash, windowPaletteMean, windowPaletteUnit, recolourWindow, decodeWindowPalette } from '../src/render/windowPalette';
import { normalizeFamilyMaterial, normalizeMaterial, STRUCTURE_MATERIAL_FAMILY_GAINS, STRUCTURE_MATERIAL_COMBINED_GAIN_RANGE, STRUCTURE_MATERIAL_BASE_GAIN } from '../src/render/structureMaterial';
import { SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE } from '../src/render/interiorResponse';

const y = (rgb: readonly number[]) => rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
const familyByDistrict = [0, 1, 0, 2, 0];
// This oracle uses the public contract integers. It does not call the implementation codec.
function expectedCode(seed: number, district: number): number {
  const q = Math.floor(Math.min(Math.max(Math.fround(seed), 0), 1 - 1 / 65536) * 65536);
  const pick = ((q * 73 + district * 139 + 19) % 65521) % 100;
  const choice = pick < 50 ? 0 : pick < 70 ? 1 : pick < 90 ? 2 : 3;
  const accent = ((q * 151 + district * 197 + 73) % 65521) % 2;
  return q * 32 + familyByDistrict[district]! * 4 + choice + accent * 12;
}
function actualMesh(city: SkyriverCity, name: string): THREE.InstancedMesh {
  const object = city.group.getObjectByName(name);
  expect(object).toBeInstanceOf(THREE.InstancedMesh);
  return object as THREE.InstancedMesh;
}

describe('R29 independent building palette and value controls', () => {
  it('keeps the material oracle outside the R31 and R32 roof policies with the approved R38 lighting', () => {
    for (const file of ['windowPalette.ts'] as const) {
      expect(createHash('sha256').update(readFileSync(new URL('../src/render/' + file, import.meta.url))).digest('hex')).toBe(materialBaseline.sourceHashes[file]);
    }
    const withoutBaseGain = (source: string) => source.replaceAll('(structureFamilyGain(family) * 0.65)', 'structureFamilyGain(family)');
    for (const [key, source] of Object.entries(SKYRIVER_CITY_SHADER_SOURCE)) {
      expect(createHash('sha256').update(withoutBaseGain(withoutR32RoofPolicy(source, key))).digest('hex'), key).toBe(materialBaseline.shaderHashes[key as keyof typeof materialBaseline.shaderHashes]);
    }
    const city = new SkyriverCity({ layout: presentCityLayout(deriveCityLayout(424242)), quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      for (const [name, prefix] of [['towers', 'tower'], ['trim', 'trim'], ['impostors', 'impostor']] as const) {
        const mesh = actualMesh(city, 'skyriver.city.' + name), material = mesh.material;
        expect(material).toBeInstanceOf(THREE.ShaderMaterial);
        const shader = material as THREE.ShaderMaterial;
        expect(shader.vertexShader).toBe(SKYRIVER_CITY_SHADER_SOURCE[`${prefix}Vertex`]);
        expect(shader.fragmentShader).toBe(SKYRIVER_CITY_SHADER_SOURCE[`${prefix}Fragment`]);
      }
    } finally { city.dispose(); }
  });

  it('dims non-emissive RGB by thirty-five percent and preserves every family separation ratio', () => {
    const nominal = [0.4, 0.9, 2.1, 0.6];
    for (const c0 of [[0.2, 0.4, 0.6], [0.03, 0.012, 0.007], [0.8, 0.02, 0.01]] as const) {
      for (const proposed of [[0.8, 0.05, 0.01], [0.01, 0.06, 0.9]] as const) for (const b of [-1, 0, 1]) for (const w of [-1, 0, 1]) for (const f of [-1, 0, 1]) {
        const residualGain = Math.max(0.82, Math.min(1.18, 1 + 0.12 * b + 0.04 * w + 0.02 * f));
        const values = nominal.map((gain, family) => {
          const result = normalizeFamilyMaterial(c0, proposed, b, w, f, family);
          result.forEach((channel, i) => expect(channel).toBeCloseTo(proposed[i]! * y(c0) * residualGain / y(proposed) * gain * 0.65, 12));
          return y(result);
        });
        for (let a = 0; a < 4; a += 1) for (let b = 0; b < 4; b += 1) expect(values[a]! / values[b]!).toBeCloseTo(nominal[a]! / nominal[b]!, 12);
      }
    }
  });

  it.each([424242, 0, 2147483647, 4294967295])('uses real uploaded owners for room, far-box and card identities, seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), model = deriveSkyriverDistrictModel(seed);
    const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      city.setFarMode('geometry');
      const mesh = actualMesh(city, 'skyriver.city.towers');
      const owner = mesh.geometry.getAttribute('aMaterial'), district = mesh.geometry.getAttribute('aDistrict');
      const occupancy = mesh.geometry.getAttribute('aBuilding');
      const masses = deriveCityMasses(layout);
      expect(mesh.count).toBe(masses.length);
      const variantsByDistrict = Array.from({ length: 5 }, () => new Map<number, number>());
      const ownerCodes = new Map<string, number>();
      for (let i = 0; i < mesh.count; i += 1) {
        const m = masses[i]!, expectedOwner = Math.fround(m.materialOwner ?? m.building ?? buildingSeedOf(m.x, m.z));
        expect(owner.getX(i)).toBe(expectedOwner);
        expect(district.getX(i)).toBe(skyriverDistrictIdAt(model, m.anchorV ?? m.z));
        expect(occupancy.getX(i)).toBe(Math.fround(m.building ?? buildingSeedOf(m.x, m.z)));
        const d = district.getX(i), code = expectedCode(expectedOwner, d);
        expect(windowPaletteCode(owner.getX(i), d)).toBe(code);
        expect(windowPaletteHash(code)).toBe(code);
        const identity = `${expectedOwner}:${d}`;
        if (!ownerCodes.has(identity)) {
          ownerCodes.set(identity, code);
          const variant = (code % 32) % 12;
          const counts = variantsByDistrict[d]!; counts.set(variant, (counts.get(variant) ?? 0) + 1);
        } else expect(code).toBe(ownerCodes.get(identity));
      }
      for (let d = 0; d < 5; d += 1) {
        const counts = variantsByDistrict[d]!;
        expect(counts.size).toBe(4);
        const total = [...counts.values()].reduce((a, b) => a + b, 0);
        const base = familyByDistrict[d]! * 4;
        const dominant = [base, base + 1, base + 2].reduce((sum, v) => sum + (counts.get(v) ?? 0), 0);
        expect(dominant / total).toBeGreaterThan(0.75);
      }
      const cardMesh = actualMesh(city, 'skyriver.city.impostors'), cards = cardMesh.geometry.getAttribute('aCard');
      const far = deriveFarTowers(layout).filter(f => f.layer >= 2);
      expect(cardMesh.count).toBe(far.length);
      for (let i = 0; i < far.length; i += 1) {
        const f = far[i]!, packed = cards.getX(i), q = Math.floor((packed - Math.floor(packed)) * 65536);
        const d = cards.getW(i), seed32 = Math.fround(buildingSeedOf(f.x, f.v));
        const code = expectedCode(seed32, d);
        expect(q).toBe(Math.floor(seed32 * 65536));
        expect(windowPaletteCodeFromQ(q, d)).toBe(code);
        const siblings = masses.map((m, slot) => ({ m, slot })).filter(({ m }) => m.x === f.x && m.z === f.v && m.layer === f.layer);
        expect(siblings.length).toBeGreaterThan(0);
        for (const { slot } of siblings) {
          expect(expectedCode(owner.getX(slot), district.getX(slot))).toBe(code);
          expect(windowPaletteHash(windowPaletteCode(owner.getX(slot), district.getX(slot)))).toBe(code);
        }
      }
      const trim = actualMesh(city, 'skyriver.city.trim'), trims = deriveCityTrims(layout);
      const trimOwner = trim.geometry.getAttribute('aMaterial');
      expect(trimOwner).toBeDefined();
      const heroes = deriveHeroBlades(layout);
      const detail = city.getRoofDetailEvidence();
      const prefixIds = Array.from({ length: detail.oldTrimCount }, (_, i) => i).filter(i => !skyriverTrimBlocksHero(trims, i, heroes));
      const suffixRows = detail.records.filter(r => r.drawState === 'drawn').sort((a, b) => a.drawIndex! - b.drawIndex!);
      const sourceIds = [...prefixIds, ...suffixRows.map(r => r.trimIndex)];
      for (const [i, row] of suffixRows.entries()) expect(row.drawIndex).toBe(prefixIds.length + i);
      expect(trim.count).toBe(sourceIds.length);
      for (let i = 0; i < trim.count; i += 1) {
        const sourceId = sourceIds[i]!, owner = trims.owner[sourceId]!;
        expect(trim.geometry.getAttribute('aSeed').getX(i)).toBe(trims.seedValue[sourceId]);
        expect(trimOwner.getX(i)).toBe(Math.fround(owner.materialOwner ?? buildingSeedOf(owner.x, owner.z)));
      }
    } finally { city.dispose(); }
  }, 20000);

  it('matches independent palette source fixtures and keeps visible building colour diversity', () => {
    const cases = [
      { q: 0, d: 0, rgb: [0.32, 0.84, 1] },
      { q: 1000, d: 1, rgb: [1, 0.24, 0.72] },
      { q: 0, d: 3, rgb: [1, 0.6, 0.24] },
    ];
    for (const { q, d, rgb } of cases) {
      const code = expectedCode((q + 0.5) / 65536, d);
      const saturation = 0.45 + 0.02 * (q % 7);
      const expected = rgb.map(value => 1 + (value / y(rgb) - 1) * saturation);
      windowPaletteUnit(code, 0.4).forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 12));
    }
    for (let d = 0; d < 5; d += 1) {
      const means = Array.from({ length: 20 }, (_, i) => windowPaletteMean(expectedCode((i * 3200 + 0.5) / 65536, d)));
      const colours = new Set(means.map(rgb => rgb.map(channel => channel.toFixed(3)).join(',')));
      expect(colours.size).toBeGreaterThanOrEqual(4);
      const spread = Math.max(...means.map(rgb => rgb[2] - rgb[0])) - Math.min(...means.map(rgb => rgb[2] - rgb[0]));
      expect(spread).toBeGreaterThan(0.15);
    }
  });

  it('uses the weighted mean of the actual room choices and keeps final Y through every stage', () => {
    for (let q = 0; q <= 65535; q += 257) for (let d = 0; d < 5; d += 1) {
      const code = expectedCode((q + 0.5) / 65536, d);
      expect(windowPaletteCode((q + 0.5) / 65536, d)).toBe(code);
      const identity = decodeWindowPalette(code);
      const weights = identity.accentCount === 2 ? [0.82, 0.12, 0.06] : [0.86, 0.14, 0];
      const samples = [windowPaletteUnit(code, 0.4), windowPaletteUnit(code, 0.9), windowPaletteUnit(code, 0.99)];
      const mean = [0, 1, 2].map(channel => samples.reduce((sum, rgb, i) => sum + rgb[channel]! * weights[i]!, 0));
      expect(windowPaletteMean(code)).toEqual(mean);
      for (const unit of [...samples, mean]) expect(y(unit)).toBeCloseTo(1, 12);
      const pane = [0.22, 0.05, 0.008] as const, silhouette = [0.017, 0.029, 0.1] as const, detail = [0.04, 0.012, 0.006] as const;
      for (const s of [0, 0.1, 0.5, 1]) for (const f of [0, s / 2, s]) {
        const emission = [0, 1, 2].map(i => pane[i]! * (1 - s) + silhouette[i]! * (s - f) + detail[i]! * f) as [number, number, number];
        const colour = recolourWindow(emission, samples[0]!);
        expect(y(colour)).toBeCloseTo(y(emission), 12);
        colour.forEach((channel, i) => expect(channel / y(colour)).toBeCloseTo(samples[0]![i]!, 12));
        expect(recolourWindow(emission, samples[0]!, 0)).toEqual(emission);
      }
    }
  });

  it('wires one owner code to all shader stages and keeps the screen darkening setting', () => {
    const { towerVertex: v, towerFragment: f, impostorVertex: cv, impostorFragment: cf } = SKYRIVER_CITY_SHADER_SOURCE;
    expect(v).toMatch(/vWindowPalette = windowPaletteCodeFromQ\([^;]*aMaterial[^;]*aDistrict\)/);
    expect(v).toContain('vBuilding = aBuilding;');
    expect(f).toContain('recolourWindow(resolved, windowPaletteUnit(vWindowPalette, roomHash), uDistrictColour)');
    expect(f).toContain('recolourWindow(averaged, windowPaletteMean(vWindowPalette), uDistrictColour)');
    expect(f).toContain('windowPaletteMean(vWindowPalette), windowPaletteUnit(vWindowPalette, farTemp)');
    expect(f.indexOf('resolved = recolourWindow')).toBeGreaterThan(f.indexOf('resolved = mix( resolved, resolvedInterior, S )'));
    expect(cv).toContain('vVariant = aCard.x;');
    expect(cf).toContain('windowPaletteCodeFromQ(cardQ, vCardDistrict)');
    expect(cf).toContain('windowPaletteMean(cardPalette)');
    expect(SKYRIVER_INTERIOR_SCREEN_NEAR_SCALE).toBe(1 / 3);
  });

  it('keeps the old residual value guard and bounds the declared family prototype separately', () => {
    expect(STRUCTURE_MATERIAL_FAMILY_GAINS).toEqual([0.4, 0.9, 2.1, 0.6]);
    expect(STRUCTURE_MATERIAL_BASE_GAIN).toBe(0.65);
    expect(STRUCTURE_MATERIAL_COMBINED_GAIN_RANGE[0]).toBeCloseTo(0.2132, 12);
    expect(STRUCTURE_MATERIAL_COMBINED_GAIN_RANGE[1]).toBeCloseTo(1.6107, 12);
    for (const b of [-1, 0, 1]) for (const w of [-1, 0, 1]) for (const f of [-1, 0, 1]) for (let family = 0; family < 4; family += 1) {
      const c0 = [0.2, 0.4, 0.6] as const, proposed = [0.8, 0.05, 0.01] as const;
      const residual = y(normalizeMaterial(c0, proposed, b, w, f)) / y(c0);
      expect(residual).toBeGreaterThanOrEqual(0.82 - 1e-12); expect(residual).toBeLessThanOrEqual(1.18 + 1e-12);
      const combined = y(normalizeFamilyMaterial(c0, proposed, b, w, f, family)) / y(c0);
      expect(combined).toBeCloseTo(residual * [0.4, 0.9, 2.1, 0.6][family]! * 0.65, 12);
      expect(combined).toBeGreaterThanOrEqual(0.2132 - 1e-12); expect(combined).toBeLessThanOrEqual(1.6107 + 1e-12);
    }
  });
});
