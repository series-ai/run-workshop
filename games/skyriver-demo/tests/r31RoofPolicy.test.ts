import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import baseline from './fixtures/r31-city-policy-baseline.json';
import roofBaseline from './fixtures/r35-roof-baseline.json';
import { withoutR32RoofPolicy } from './support/r32RoofPolicy';
// External texture stubs permit the real factory. They do not provide the oracle.
vi.mock('../src/render/signAtlas', async importOriginal => {
  const original = await importOriginal<typeof import('../src/render/signAtlas')>();
  return { ...original, createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) };
});
vi.mock('../src/render/interiorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { SkyriverCity, deriveCityMasses, SKYRIVER_CITY_SHADER_SOURCE, SKYRIVER_CITY } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { SkyriverDistrictColourSwitch, SKYRIVER_DISTRICT_SOURCE_TERMS } from '../src/render/districts';

const sha = (a: ArrayBufferView) => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
interface BeforeMesh { count: number; index: string | null; instanceMatrix: string | null; attributes: Record<string, { itemSize: number; count: number; sha256: string }>; }

describe('R31 independent roof emission policy', () => {
  it.each([424242, 0, 2147483647, 4294967295])('maps only real equipment rows and preserves all old geometry for seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = deriveCityMasses(layout);
    const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    const evidence = [];
    try {
      for (const mode of ['impostor', 'geometry'] as const) {
        city.setFarMode(mode);
        const before = baseline.rows.find(row => row.seed === seed && row.mode === mode)!;
        const tower = city.group.getObjectByName('skyriver.city.towers');
        if (!(tower instanceof THREE.InstancedMesh)) throw new Error('R31_REAL_TOWER_MESH_MISSING');
        const mask = tower.geometry.getAttribute('aEmissionAllowed');
        expect(mask).toBeInstanceOf(THREE.InstancedBufferAttribute); expect(mask.itemSize).toBe(1); expect(mask.array).toBeInstanceOf(Float32Array);
        const rows = masses.filter(m => mode === 'geometry' || (m.layer ?? 0) < 2);
        expect(tower.count).toBe(rows.length);
        let equipment = 0, cells = 0; const kept = new Set<string>();
        for (let i = 0; i < rows.length; i += 1) {
          const mass = rows[i]!, allowed = mass.baseRecord?.kind === 'equipment' ? 0 : 1;
          expect(mask.getX(i), `actual row${i}`).toBe(allowed);
          if (!allowed) equipment += 1; else kept.add(mass.baseRecord?.kind ?? 'legacy');
          if ((mass.layer ?? 0) === 0 && allowed) cells += Math.floor(2 * (mass.width + mass.depth) * mass.height / (SKYRIVER_CITY.windowCellWidthM * SKYRIVER_CITY.windowCellHeightM));
        }
        expect(equipment).toBeGreaterThan(50);
        expect(kept).toEqual(new Set(['legacy', 'skirt', 'infill', 'link']));
        expect(city.sourceCounts().paneCells).toBe(cells); expect(city.sourceCounts().roomCells).toBe(cells);
        const identity = city.geometryIdentity(), { emissionPolicy, ...oldIdentity } = identity;
        const { trims: currentTrims, trimAttributes: currentTrimAttributes, counts: currentCounts, ...currentOther } = oldIdentity;
        const { trims: oldTrims, trimAttributes: oldTrimAttributes, counts: oldCounts, ...oldOther } = before.identity;
        void currentTrims; void currentTrimAttributes; void oldTrims; void oldTrimAttributes;
        expect(currentOther).toEqual(oldOther);
        expect({ ...currentCounts, trims: oldCounts.trims }).toEqual(oldCounts);
        const roofBefore = roofBaseline.factory.find(row => row.seed === seed && row.mode === mode)!;
        const prefixCount = roofBaseline.seeds.find(row => row.seed === seed)!.drawnTrimCount;
        expect(currentCounts.trims).toBeGreaterThanOrEqual(prefixCount);
        const meshes = before.meshes as Record<string, BeforeMesh>;
        city.group.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const original = meshes[object.name]!; expect(original).toBeDefined();
          let count: number;
          if (object instanceof THREE.InstancedMesh) count = object.count;
          else {
            const geometry = object.geometry;
            if (!(geometry instanceof THREE.InstancedBufferGeometry)) throw new Error('R31_REAL_BATCH_GEOMETRY_MISSING');
            count = geometry.instanceCount;
          }
          expect(count).toBeGreaterThanOrEqual(original.count);
          if (object.name !== 'skyriver.city.trim') expect(count).toBe(original.count);
          expect(object.geometry.index ? sha(object.geometry.index.array) : null).toBe(original.index);
          if (object instanceof THREE.InstancedMesh && object.name === 'skyriver.city.trim') expect(sha(object.instanceMatrix.array.subarray(0, prefixCount * 16))).toBe(roofBefore.meshes['skyriver.city.trim'].activeMatrix);
          else expect(object instanceof THREE.InstancedMesh ? sha(object.instanceMatrix.array) : null).toBe(original.instanceMatrix);
          expect(Object.keys(object.geometry.attributes).filter(n => n !== 'aEmissionAllowed').sort()).toEqual(Object.keys(original.attributes).sort());
          for (const [name, value] of Object.entries(original.attributes)) {
            const attribute = object.geometry.getAttribute(name);
            expect(attribute.itemSize).toBe(value.itemSize);
            if (object.name === 'skyriver.city.trim' && attribute instanceof THREE.InstancedBufferAttribute) {
              const prefix = roofBefore.meshes['skyriver.city.trim'].attributes;
              const field = Object.entries(prefix).find(([key]) => key === name)?.[1];
              if (!field) throw new Error(`R35_LEGACY_TRIM_ATTRIBUTE_MISSING:${name}`);
              expect(sha(attribute.array.subarray(0, prefixCount * value.itemSize)), name).toBe(field.activeSha256);
              expect(attribute.count).toBeGreaterThanOrEqual(value.count);
            } else { expect(attribute.count).toBe(value.count); expect(sha(attribute.array), object.name + ':' + name).toBe(value.sha256); }
          }
        });
        const at = rows.findIndex(m => m.baseRecord?.kind === 'equipment');
        mask.setX(at, 1);
        const changed = city.geometryIdentity(); expect(changed.emissionPolicy).not.toBe(emissionPolicy);
        const { emissionPolicy: changedPolicy, ...changedOld } = changed; expect(changedOld).toEqual(oldIdentity);
        mask.setX(at, 0); expect(city.geometryIdentity()).toEqual(identity);
        expect(city.sourceEvidence().roles.map(role => role.id)).not.toContain('tower-parapet');
        expect(city.sourceEvidence().roles.map(role => role.id)).not.toContain('deck-skylight');
        evidence.push({ seed, mode, drawnMasses: rows.length, equipment, emittingRows: rows.length - equipment, paneCells: cells, emissionPolicy, mutationPolicy: changedPolicy, identity: oldIdentity });
      }
    } finally { city.dispose(); }
    if (process.env.SKYRIVER_ROOF_POLICY_OUT) writeFileSync(`${process.env.SKYRIVER_ROOF_POLICY_OUT}-${seed}.json`, JSON.stringify(evidence, null, 2));
  });

  it('changes only the approved roof shader terms and retains all other lighting', () => {
    for (const [key, source] of Object.entries(SKYRIVER_CITY_SHADER_SOURCE)) expect(createHash('sha256').update(withoutR32RoofPolicy(source, key)).digest('hex'), key).toBe(baseline.shaderHashes[key as keyof typeof baseline.shaderHashes]);
    const source = SKYRIVER_CITY_SHADER_SOURCE;
    expect(source.towerVertex).toContain('vEmissionAllowed = aEmissionAllowed;');
    expect(source.towerFragment).toContain('flat varying float vEmissionAllowed;');
    expect(source.towerFragment).not.toContain('parapetLive');
    for (const removed of ['float deckRoof', 'vec2 skyCell', 'float skylight', 'skylight * deckRoof']) expect(source.towerFragment).not.toContain(removed);
    expect(source.towerFragment).toContain('float deckZone = 1.0 - smoothstep( 70.0, 160.0, vWorldPos.y );');
    expect(source.towerFragment).toContain('float F = clamp( S * furnitureDepthMix * furniturePixelMix, 0.0, 1.0 );');
    expect(SKYRIVER_DISTRICT_SOURCE_TERMS.map(term => term.id)).not.toContain('tower-parapet');
    expect(SKYRIVER_DISTRICT_SOURCE_TERMS.map(term => term.id)).not.toContain('deck-skylight');
    for (const kept of ['trim-flood', 'trim-band-warm', 'trim-band-cold', 'landmark-wash-face', 'landmark-wash-roof', 'trim-balcony-underlight']) expect(SKYRIVER_DISTRICT_SOURCE_TERMS.map(term => term.id)).toContain(kept);
    const instanceFields = [...source.towerVertex.matchAll(/^attribute\s+\w+\s+(\w+);/gm)].map(m => m[1]);
    expect(instanceFields).toHaveLength(9); expect(new Set(instanceFields).size + 2 + 4).toBe(15);
    expect(source.towerFragment).toContain('float F = clamp( S * furnitureDepthMix * furniturePixelMix, 0.0, 1.0 );');
  });

  it('caps only sampled card RGB at the upper eight percent with a two-percent ramp', () => {
    const source = SKYRIVER_CITY_SHADER_SOURCE.impostorFragment;
    const match = source.match(/card\.rgb\s*\*=\s*([^;]+);/); expect(match).not.toBeNull();
    const run = new Function('y', 'smoothstep', 'return ' + match![1]!.replace('vCardUv.y', 'y')) as (y: number, step: (a: number, b: number, x: number) => number) => number;
    const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (const y of [0, 0.5, 0.9]) expect(run(y, smooth)).toBe(1);
    for (const y of [0.92, 0.96, 1]) expect(run(y, smooth)).toBe(0);
    expect(run(0.91, smooth)).toBeCloseTo(0.5, 12);
    let previous = 1;
    for (let i = 0; i <= 200; i += 1) { const v = run(0.9 + i / 10000, smooth); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(previous + 1e-12); previous = v; }
    expect(source.indexOf('if ( card.a < 0.5 ) discard;')).toBeLessThan(source.indexOf('card.rgb *='));
    expect(createHash('sha256').update(withoutR32RoofPolicy(source, 'impostorFragment')).digest('hex')).toBe(baseline.shaderHashes.impostorFragment);
  });
});
