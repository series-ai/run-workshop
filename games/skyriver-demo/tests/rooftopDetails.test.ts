import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import baseline from './fixtures/r35-roof-baseline.json';
// Canvas textures are boundary stubs. All derived and uploaded geometry is real.
vi.mock('../src/render/signAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async importOriginal => ({ ...await importOriginal<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { SkyriverCity, deriveRoofDetails, deriveCityMasses, deriveCityTrims, deriveFacadeFaces, deriveFarTowers, deriveHeroBlades, deriveNeonSigns, trimMaterialOwnerSeed, buildingSeedOf, skyriverTrimSourceTermId, SKYRIVER_CITY, SKYRIVER_CITY_SHADER_SOURCE, SKYRIVER_TRIM_ROOF_PLANT } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SkyriverDistrictColourSwitch } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { massRoofBox, trimRoofBox, roofBoxTolerance, roofBoxesConflict, roofSupportFailures, roofRouteClearance, uploadedRoofBox, type RoofBox } from './support/rooftopDetailsGeometry';

const SEEDS = baseline.seeds.map(record => record.seed);
const sha = (value: string | ArrayBufferView) => createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)).digest('hex');
function serial(value: unknown): unknown {
  if (ArrayBuffer.isView(value) && 'BYTES_PER_ELEMENT' in value && typeof value.BYTES_PER_ELEMENT === 'number') return { typedArray: value.constructor.name, length: value.byteLength / value.BYTES_PER_ELEMENT, sha256: sha(value), base64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') };
  if (Array.isArray(value)) return value.map(serial);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serial(item)]));
  return value;
}
const jsonHash = (value: unknown) => sha(JSON.stringify(value));
function instanced(group: THREE.Group, name: string): THREE.InstancedMesh {
  const mesh = group.getObjectByName(name);
  if (!(mesh instanceof THREE.InstancedMesh)) throw new Error(`R35_REAL_INSTANCED_MESH_MISSING:${name}`);
  return mesh;
}
function mesh(group: THREE.Group, name: string): THREE.Mesh {
  const found = group.getObjectByName(name); if (!(found instanceof THREE.Mesh)) throw new Error(`R35_REAL_MESH_MISSING:${name}`); return found;
}

function heroBoxes(signs: THREE.Mesh, count: number): readonly RoofBox[] {
  const centres = signs.geometry.getAttribute('aCentre'), normals = signs.geometry.getAttribute('aNormal'), sizes = signs.geometry.getAttribute('aSize');
  if (!centres || !normals || !sizes) throw new Error('R35_REAL_HERO_ATTRIBUTES_MISSING');
  return Array.from({ length: count }, (_, i) => {
    const nx = normals.getX(i), nz = normals.getY(i), length = Math.hypot(nx, nz);
    return { x: centres.getX(i), y: centres.getY(i), z: centres.getZ(i), hx: sizes.getX(i) / 2 + 14, hy: sizes.getY(i) / 2 + 18, hz: 14, c: nz / length, s: nx / length };
  });
}

interface MeshBaseline { count: number; index: string | null; matrix: string | null; activeMatrix?: string; attributes: Record<string, { itemSize: number; count: number; isInstanced: boolean; sha256: string; activeSha256: string }>; }

describe('R35 independent dark roof details', () => {
  it.each(SEEDS)('preserves the full old model and appends bounded real supported primitives for seed %i', seed => {
    const old = baseline.seeds.find(r => r.seed === seed)!;
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = deriveCityMasses(layout), trims = deriveCityTrims(layout), detail = deriveRoofDetails(layout);
    expect(detail.oldTrimCount).toBe(old.trimCount); expect(detail.totalTrimCount).toBe(trims.count);
    expect(jsonHash(masses)).toBe(old.hashes.masses);
    expect(jsonHash(deriveFacadeFaces(layout))).toBe(old.hashes.faces);
    expect(jsonHash(deriveFarTowers(layout))).toBe(old.hashes.far);
    expect(jsonHash(deriveHeroBlades(layout))).toBe(old.hashes.heroes);
    expect(jsonHash(serial(deriveNeonSigns(layout)))).toBe(old.hashes.signs);
    expect(jsonHash(trims.owner.slice(0, old.trimCount))).toBe(old.hashes.trimOwner);
    expect(jsonHash(trims.spanTo.slice(0, old.trimCount))).toBe(old.hashes.trimSpanTo);
    for (const key of ['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'kind', 'seedValue'] as const) expect(sha(trims[key].subarray(0, old.trimCount)), key).toBe(old.activeTrimArrayHashes[key]);
    expect(detail.records.length).toBeGreaterThan(0);
    expect(detail.records.length).toBe(trims.count - old.trimCount);
    expect(detail.records.length).toBeLessThanOrEqual(Math.min(1800, SKYRIVER_CITY.maxTrims - old.trimCount));
    expect(trims.count).toBeLessThanOrEqual(SKYRIVER_CITY.maxTrims);
    expect(new Set(detail.records.map(r => r.trimIndex)).size).toBe(detail.records.length);
    expect([...detail.records].map(r => r.trimIndex).sort((a, b) => a - b)).toEqual(Array.from({ length: detail.records.length }, (_, i) => old.trimCount + i));
    const accepted = [0, 0, 0], boxes = masses.map(massRoofBox), oldTrims = Array.from({ length: old.trimCount }, (_, i) => trimRoofBox(trims, i)), suffix: RoofBox[] = [];
    const conflicts: string[] = [];
    for (const r of detail.records) {
      const i = r.trimIndex, mass = masses[r.supportMassIndex]; if (!mass) throw new Error(`R35_SUPPORT_INDEX:${r.supportMassIndex}`);
      const prop = trimRoofBox(trims, i), support = boxes[r.supportMassIndex]!, owner = trims.owner[i]!;
      expect(mass.layer ?? 0).toBe(0);
      expect(trims.kind[i]).toBe(SKYRIVER_TRIM_ROOF_PLANT); expect(trims.spanTo[i]).toBeNull();
      expect(owner).toEqual({ x: mass.x, z: mass.z, width: mass.width, depth: mass.depth, anchorV: mass.anchorV ?? mass.z, materialOwner: mass.materialOwner ?? buildingSeedOf(mass.x, mass.z) });
      expect(Object.values(prop).every(Number.isFinite)).toBe(true); expect(Math.min(prop.hx, prop.hy, prop.hz)).toBeGreaterThan(0);
      expect(roofSupportFailures(prop, support), `support:${i}`).toEqual([]);
      const roof = mass.y0 + mass.height, stratum = roof < 600 ? 'grime' : roof < 1800 ? 'mid' : 'pristine';
      expect(r.stratum).toBe(stratum); accepted[['grime', 'mid', 'pristine'].indexOf(stratum)]!++;
      expect(Number.isSafeInteger(r.clusterId)).toBe(true);
      expect(skyriverTrimSourceTermId(trims.kind[i]!, trims.seedValue[i]!)).toBeNull();
      for (let j = 0; j < boxes.length; j++) if (roofBoxesConflict(prop, boxes[j]!)) conflicts.push(`${i}:mass${j}`);
      for (let j = 0; j < oldTrims.length; j++) if (roofBoxesConflict(prop, oldTrims[j]!)) conflicts.push(`${i}:oldTrim${j}`);
      for (let j = 0; j < suffix.length; j++) if (roofBoxesConflict(prop, suffix[j]!)) conflicts.push(`${i}:newTrim${j}`);
      suffix.push(prop);
    }
    expect(conflicts).toEqual([]); expect(accepted).toEqual(detail.acceptedByStratum);
    for (let i = 0; i < 3; i++) {
      expect(accepted[i]).toBeLessThanOrEqual([1200, 480, 120][i]!); expect(detail.requestedByStratum[i]).toBe([1200, 480, 120][i]);
      for (const count of [detail.rejectedSupportByStratum[i], detail.rejectedCollisionByStratum[i], detail.rejectedBudgetByStratum[i]]) { expect(Number.isSafeInteger(count)).toBe(true); expect(count).toBeGreaterThanOrEqual(0); }
      expect(detail.rejectedBudgetByStratum[i]).toBe(0);
    }
    if (process.env.SKYRIVER_ROOF_DETAIL_OUT) writeFileSync(`${process.env.SKYRIVER_ROOF_DETAIL_OUT}-derive-${seed}.json`, JSON.stringify({ seed, oldTrimCount: old.trimCount, detail, accepted, conflicts }, null, 2));
  });

  it.each(SEEDS)('uploads the real dark suffix with exact legacy buffers, hero exclusion, and route clearance for seed %i', seed => {
    const old = baseline.seeds.find(r => r.seed === seed)!;
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = deriveCityMasses(layout), trims = deriveCityTrims(layout), derivation = deriveRoofDetails(layout);
    const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    const evidence = [];
    try {
      for (const mode of ['impostor', 'geometry'] as const) {
        city.setFarMode(mode);
        const prior = baseline.factory.find(r => r.seed === seed && r.mode === mode)!, packed = city.getRoofDetailEvidence(), trim = instanced(city.group, 'skyriver.city.trim'), tower = instanced(city.group, 'skyriver.city.towers');
        expect(packed.oldTrimCount).toBe(old.trimCount); expect(packed.legacyDrawnCount).toBe(old.drawnTrimCount); expect(packed.totalTrimCount).toBe(trims.count); expect(packed.uploadedTotalCount).toBe(trim.count);
        expect(packed.records.length).toBe(derivation.records.length); expect(packed.acceptedByStratum).toEqual(derivation.acceptedByStratum);
        const heroes = heroBoxes(mesh(city.group, 'skyriver.city.signs'), prior.sourceCounts.heroSigns), uploaded = [0, 0, 0], excluded = [0, 0, 0], drawnBoxes: RoofBox[] = [];
        const towerRows = masses.map((m, i) => ({ mass: m, index: i })).filter(r => mode === 'geometry' || (r.mass.layer ?? 0) < 2);
        const supportRows = new Map(towerRows.map((r, i) => [r.index, i]));
        for (const r of packed.records) {
          const si = ['grime', 'mid', 'pristine'].indexOf(r.stratum);
          if (r.drawState === 'hero-excluded') { expect(r.drawIndex).toBeNull(); excluded[si]!++; expect(heroes.some(h => roofBoxesConflict(trimRoofBox(trims, r.trimIndex), h))).toBe(true); continue; }
          const slot = r.drawIndex; if (slot === null) throw new Error('R35_DRAW_SLOT_MISSING');
          expect(slot).toBe(old.drawnTrimCount + drawnBoxes.length); uploaded[si]!++;
          const box = uploadedRoofBox(trim.instanceMatrix.array, slot * 16), supportSlot = supportRows.get(r.supportMassIndex); if (supportSlot === undefined) throw new Error('R35_SUPPORT_NOT_DRAWN');
          const support = uploadedRoofBox(tower.instanceMatrix.array, supportSlot * 16);
          expect(roofSupportFailures(box, support), `uploaded:${slot}`).toEqual([]);
          expect(heroes.filter(h => roofBoxesConflict(box, h))).toEqual([]);
          const owner = trims.owner[r.trimIndex]!;
          expect(trim.geometry.getAttribute('aKind').getX(slot)).toBe(2);
          expect(trim.geometry.getAttribute('aMaterial').getX(slot)).toBe(Math.fround(trimMaterialOwnerSeed(owner)));
          const size = trim.geometry.getAttribute('aSize'); expect([size.getX(slot), size.getY(slot), size.getZ(slot)]).toEqual([trims.sx[r.trimIndex], trims.sy[r.trimIndex], trims.sz[r.trimIndex]]);
          const expected = trimRoofBox(trims, r.trimIndex), tolerance = roofBoxTolerance(box);
          for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(box[key] - expected[key])).toBeLessThanOrEqual(tolerance);
          drawnBoxes.push(box);
        }
        expect(uploaded).toEqual(packed.uploadedByStratum); expect(excluded).toEqual(packed.heroExcludedByStratum); expect(trim.count).toBe(old.drawnTrimCount + drawnBoxes.length);
        for (const i of [0, 1, 2]) expect(uploaded[i]! + excluded[i]!).toBe(packed.acceptedByStratum[i]);
        expect(jsonHash(city.lightSources())).toBe(prior.lightSourcesHash);
        const counts = city.sourceCounts(); for (const key of ['masses', 'massesByDistrict', 'ordinarySigns', 'heroSigns', 'signsByDistrict', 'heroesByDistrict', 'heroSpillSlots', 'farCards', 'farCardsByDistrict', 'paneCells', 'roomCells'] as const) expect(counts[key], key).toEqual(prior.sourceCounts[key]);
        for (let kind = 0; kind < counts.trimsByKind.length; kind++) expect(counts.trimsByKind[kind]).toBe(prior.sourceCounts.trimsByKind[kind]! + (kind === 2 ? drawnBoxes.length : 0));
        const meshes: Record<string, MeshBaseline> = prior.meshes;
        city.group.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const before = meshes[object.name]; if (!before) throw new Error(`R35_ADDED_DRAW:${object.name}`);
          const geometry = object.geometry, isTrim = object.name === 'skyriver.city.trim';
          expect(geometry.index ? sha(geometry.index.array) : null).toBe(before.index);
          expect(Object.keys(geometry.attributes).sort()).toEqual(Object.keys(before.attributes).sort());
          for (const [name, value] of Object.entries(before.attributes)) {
            const attribute = geometry.getAttribute(name); expect(attribute.itemSize).toBe(value.itemSize);
            if (isTrim && value.isInstanced) expect(sha(attribute.array.subarray(0, old.drawnTrimCount * value.itemSize)), name).toBe(value.activeSha256);
            else { expect(attribute.count).toBe(value.count); expect(sha(attribute.array), name).toBe(value.sha256); }
          }
          if (object instanceof THREE.InstancedMesh) expect(isTrim ? sha(object.instanceMatrix.array.subarray(0, old.drawnTrimCount * 16)) : sha(object.instanceMatrix.array)).toBe(isTrim ? before.activeMatrix : before.matrix);
          else { if (!(geometry instanceof THREE.InstancedBufferGeometry)) throw new Error('R35_REAL_BATCH_GEOMETRY_MISSING'); expect(geometry.instanceCount).toBe(before.count); }
        });
        expect(city.group.children.filter(o => o instanceof THREE.Mesh).length).toBe(Object.keys(meshes).length);
        const clearance = roofRouteClearance(drawnBoxes); expect(clearance.samples).toBe(6400); expect(clearance.violations).toBe(0);
        evidence.push({ seed, mode, packed, clearance, sourceCounts: counts });
      }
    } finally { city.dispose(); }
    if (process.env.SKYRIVER_ROOF_DETAIL_OUT) writeFileSync(`${process.env.SKYRIVER_ROOF_DETAIL_OUT}-uploaded-${seed}.json`, JSON.stringify(evidence, null, 2));
  });

  it('keeps every real shader byte and dark kind2 source rule unchanged', () => {
    for (const [key, source] of Object.entries(SKYRIVER_CITY_SHADER_SOURCE)) expect(sha(source), key).toBe(baseline.shaderHashes[key as keyof typeof baseline.shaderHashes]);
    expect(skyriverTrimSourceTermId(2, 0)).toBeNull(); expect(skyriverTrimSourceTermId(2, 1)).toBeNull();
  });

  it('rejects unsupported corners, partial upper covers, wrong anchors, and hero-volume intrusion', () => {
    const support: RoofBox = { x: 10, y: 0, z: 20, hx: 10, hy: 5, hz: 10, c: 1, s: 0 };
    const prop: RoofBox = { x: 10, y: 6, z: 20, hx: 2, hy: 1, hz: 2, c: 1, s: 0 };
    expect(roofSupportFailures(prop, support)).toEqual([]);
    expect(roofSupportFailures({ ...prop, x: 17 }, support).length).toBeGreaterThan(0);
    expect(roofSupportFailures({ ...prop, y: 6.01 }, support)).toContain('corner0:contact');
    expect(roofSupportFailures({ ...prop, c: 0, s: 1, x: 30 }, support).length).toBeGreaterThan(0);
    expect(roofBoxesConflict(prop, support)).toBe(false);
    expect(roofBoxesConflict(prop, { ...prop, x: 13.9, hx: 2 })).toBe(true);
    expect(roofBoxesConflict(prop, { ...prop, x: 14, hx: 2 })).toBe(false);
  });

  it.each(SEEDS)('repeats derivation in a fresh module with stable real suffix records for seed %i', async seed => {
    const original = deriveRoofDetails(presentCityLayout(deriveCityLayout(seed)));
    vi.resetModules();
    const [freshCity, freshSim, freshPresentation] = await Promise.all([import('../src/render/city'), import('../src/sim/derive'), import('../src/render/presentationLayout')]);
    const layout = freshPresentation.presentCityLayout(freshSim.deriveCityLayout(seed));
    expect(freshCity.deriveRoofDetails(layout)).toEqual(original);
  });
});
