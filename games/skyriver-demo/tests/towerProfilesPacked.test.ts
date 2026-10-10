import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
// Only canvas atlas boundaries are replaced. Geometry and packing stay real.
vi.mock('../src/render/signAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { SkyriverCity, deriveCityMasses, deriveCityTrims, deriveTowerProfiles, deriveFacadeFaces, deriveHeroBlades, buildingSeedOf, SKYRIVER_CITY } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SkyriverDistrictColourSwitch } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import before from './fixtures/r36-packed-before.json';
import { assertR36UnchangedPackedTower } from './support/r36UnchangedPackedTower';
import { verifiedR36DarkMassIds } from './support/r36DarkMassIds';
import { deriveRetainedMassSupportRecords } from '../src/render/city';
import { fixedArtBackingFailures, verifiedYawRoofCapIds, yawSpanLedgeFailures, approvedYawHostEnvelope } from './support/towerCrownCarve';
import { independentMassRoofBox } from './support/towerProfileGeometry';
import { retainedMassContact } from './support/retainedMassContact';
import { uploadedRoofBox, roofBoxTolerance, roofRouteClearance } from './support/rooftopDetailsGeometry';

interface StaticMeshBefore {
  readonly index: { readonly hash: string } | null;
  readonly attributes: Readonly<Record<string, { readonly itemSize: number; readonly count: number; readonly array: { readonly hash: string } }>>;
}
const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
function sha(a: ArrayBufferView): string { return createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex'); }
function towerMesh(group: THREE.Group, name = 'skyriver.city.towers'): THREE.InstancedMesh {
  const mesh = group.getObjectByName(name);
  if (!(mesh instanceof THREE.InstancedMesh)) throw new Error('R36_REAL_TOWER_BATCH_MISSING');
  return mesh;
}

describe('R36 actual packed shape geometry', () => {
  it.each(SEEDS)('packs every stage and owner into the existing batches at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = deriveCityMasses(layout), trims = deriveCityTrims(layout), profiles = deriveTowerProfiles(layout);
    const verifiedDarkIds = verifiedR36DarkMassIds(layout, masses, profiles, deriveRetainedMassSupportRecords(layout));
    const backingIds = new Set(masses.flatMap((mass, index) => { if (!mass.artBacking) return []; expect(fixedArtBackingFailures(mass, masses, deriveFacadeFaces(layout), deriveHeroBlades(layout)), `backing${index}`).toEqual([]); return [index]; }));
    const capIds = verifiedYawRoofCapIds(profiles, masses, seed);
    const ledgeIds = new Set(masses.flatMap((mass, index) => {
      if (mass.supportRole !== 'yaw-span-ledge') return [];
      const host = masses[mass.supportHostMassIndex!]; if (!host) throw new Error('YAW_LEDGE_HOST');
      expect(yawSpanLedgeFailures(mass, host, approvedYawHostEnvelope(host, mass.supportHostMassIndex!, profiles, seed, masses)), `ledge${index}`).toEqual([]);
      return [index];
    }));
    const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      for (const mode of ['impostor', 'geometry'] as const) {
        city.setFarMode(mode);
        const tower = towerMesh(city.group), rows = masses.map((mass, index) => ({ mass, index })).filter(r => mode === 'geometry' || (r.mass.layer ?? 0) < 2);
        const slots = new Map(rows.map((r, i) => [r.index, i]));
        assertR36UnchangedPackedTower(layout, tower, mode);
        expect(tower.count).toBe(rows.length); expect(tower.instanceMatrix.count).toBeGreaterThanOrEqual(rows.length);
        const size = tower.geometry.getAttribute('aSize'), material = tower.geometry.getAttribute('aMaterial'), building = tower.geometry.getAttribute('aBuilding'), emission = tower.geometry.getAttribute('aEmissionAllowed'), edges = tower.geometry.getAttribute('aStepEdges');
        for (const [slot, r] of rows.entries()) {
          const expected = independentMassRoofBox(r.mass), actual = uploadedRoofBox(tower.instanceMatrix.array, slot * 16), tolerance = Math.max(roofBoxTolerance(expected), roofBoxTolerance(actual));
          for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(actual[key] - expected[key]), `matrix${slot}:${key}`).toBeLessThanOrEqual(tolerance);
          expect([size.getX(slot), size.getY(slot), size.getZ(slot)]).toEqual([r.mass.width, r.mass.height, r.mass.depth].map(Math.fround));
          expect(material.getX(slot)).toBe(Math.fround(r.mass.materialOwner ?? r.mass.building ?? buildingSeedOf(r.mass.x, r.mass.z)));
          expect(building.getX(slot)).toBe(Math.fround(r.mass.building ?? buildingSeedOf(r.mass.x, r.mass.z)));
          expect(emission.getX(slot)).toBe(r.mass.baseRecord?.kind === 'equipment' || verifiedDarkIds.has(r.index) || backingIds.has(r.index) || capIds.has(r.index) || ledgeIds.has(r.index) ? 0 : 1);
          expect([edges.getX(slot), edges.getY(slot)]).toEqual([r.mass.stepBottom ? 1 : 0, r.mass.stepTop ? 1 : 0]);
        }
        for (const index of backingIds) {
          const hostIndex = masses[index]!.artBacking!.hostMassIndex, backingSlot = slots.get(index), hostSlot = slots.get(hostIndex);
          if (backingSlot === undefined || hostSlot === undefined) throw new Error('YAW_UPLOADED_BACKING_HOST');
          expect(retainedMassContact(uploadedRoofBox(tower.instanceMatrix.array, backingSlot * 16), uploadedRoofBox(tower.instanceMatrix.array, hostSlot * 16)), `backing${index}:${mode}:actual-host`).toBe('volume');
        }
        for (const row of profiles) {
          if (row.eligibility.kind !== 'eligible' || !('stages' in row)) continue;
          for (const index of [...row.stages.flatMap(s => s.massIndices), ...row.crown.massIndices, ...row.companionMassIndices, ...(row.supportSpineIndex === null ? [] : [row.supportSpineIndex])]) expect(slots.has(index), `tower${row.towerIndex}:member${index}`).toBe(true);
        }
        const prior: Readonly<Record<string, StaticMeshBefore>> = before.modes[mode];
        const meshes: THREE.Mesh[] = []; city.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
        expect(meshes.map(m => m.name).sort()).toEqual(Object.keys(prior).sort());
        for (const mesh of meshes) {
          const saved = prior[mesh.name]; if (!saved) throw new Error('R36_NEW_DRAW_BATCH');
          expect(mesh.geometry.index ? sha(mesh.geometry.index.array) : null).toBe(saved.index?.hash ?? null);
          for (const [name, attribute] of Object.entries(saved.attributes)) {
            const value = mesh.geometry.getAttribute(name);
            expect(value.itemSize).toBe(attribute.itemSize); expect(value.count).toBe(attribute.count); expect(sha(value.array)).toBe(attribute.array.hash);
          }
        }
        expect(trims.count).toBeLessThanOrEqual(SKYRIVER_CITY.maxTrims);
        const detail = city.getRoofDetailEvidence();
        expect(detail.records.some(record => backingIds.has(record.supportMassIndex)), `seed${seed}:${mode}:art-roof-support`).toBe(false);
        expect(detail.uploadedTotalCount).toBeLessThanOrEqual(SKYRIVER_CITY.maxTrims);
        expect(detail.records.filter(r => r.drawState === 'drawn').length + detail.records.filter(r => r.drawState === 'hero-excluded').length).toBe(detail.records.length);
        const trim = towerMesh(city.group, 'skyriver.city.trim');
        const boxes = [...Array.from({ length: tower.count }, (_, i) => uploadedRoofBox(tower.instanceMatrix.array, i * 16)), ...Array.from({ length: trim.count }, (_, i) => uploadedRoofBox(trim.instanceMatrix.array, i * 16))];
        const clearance = roofRouteClearance(boxes);
        expect(clearance.samples).toBe(6400); expect(clearance.violations).toBe(0); expect(clearance.minHull).toBeGreaterThanOrEqual(0); expect(clearance.minCamera).toBeGreaterThanOrEqual(0);
      }

    } finally { city.dispose(); }
  });
});
