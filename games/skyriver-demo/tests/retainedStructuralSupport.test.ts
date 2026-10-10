import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
// Only canvas atlas boundaries are replaced. Actual geometry remains real.
vi.mock('../src/render/signAtlas', async original => ({ ...await original<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async original => ({ ...await original<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async original => ({ ...await original<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import * as C from '../src/render/city';
import { verifiedR36DarkMassIds } from './support/r36DarkMassIds';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SkyriverDistrictColourSwitch, deriveSkyriverDistrictModel, skyriverDistrictIdAt } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import occurrenceBefore from './fixtures/r36-retained-child-support-before.json';
import physicalBefore from './fixtures/r36-retained-support-c6-physical.json';
import { matchRetainedMassOccurrences, readRetainedMassRecords, retainedMassContact, retainedMassContactQuery } from './support/retainedMassContact';
import { massRoofBox, roofBoxTolerance, roofRouteClearance, trimRoofBox, uploadedRoofBox } from './support/rooftopDetailsGeometry';
import { expectedTowerYaw } from './support/towerProfileGeometry';
import { legacyRoofVoidBoxes } from './support/legacyRoofGeometry';
import { readRetainedBridgeRecords, sourceSolid, supportConflictQuery, supportCrossesRoofPlane, uncoveredSupportVolume } from './support/retainedStructuralSupport';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const massOwner = (m: C.SkyriverMass) => m.materialOwner ?? m.building ?? C.buildingSeedOf(m.x, m.z);
const frame = (m: C.SkyriverMass) => JSON.stringify([massOwner(m), m.anchorV ?? m.z]);
const role = (mass: C.SkyriverMass): unknown => Reflect.get(mass, 'supportRole');
function records(layout: ReturnType<typeof presentCityLayout>) {
  const api: unknown = Reflect.get(C, 'deriveRetainedMassSupportRecords');
  if (typeof api !== 'function') throw new Error('R36_SUPPORT_API_MISSING');
  const value: unknown = api(layout);
  return readRetainedBridgeRecords(value);
}
const CACHE = new Map<number, ReturnType<typeof build>>();
function build(seed: typeof SEEDS[number]) {
  const layout = presentCityLayout(deriveCityLayout(seed)), bridges = records(layout), trims = C.deriveCityTrims(layout), masses = C.deriveCityMasses(layout);
  const old = occurrenceBefore.seeds.find(row => row.seed === seed), physical = physicalBefore.rows.find(row => row.seed === seed);
  if (!old || !physical) throw new Error('R36_SUPPORT_SEED_AUTHORITY');
  const original = readRetainedMassRecords(old.records, old.originalMassCount), matching = matchRetainedMassOccurrences(original, masses), boxes = masses.map(massRoofBox);
  return { seed, layout, bridges, trims, masses, old, physical, original, matching, boxes, contacts: retainedMassContactQuery(boxes), conflicts: supportConflictQuery(boxes), details: C.deriveRoofDetails(layout), heroes: C.deriveHeroBlades(layout) };
}
function data(seed: typeof SEEDS[number]) { let result = CACHE.get(seed); if (!result) { result = build(seed); CACHE.set(seed, result); } return result; }
function oldSeedValues(row: typeof physicalBefore.rows[number]): Float32Array {
  const bytes = Buffer.from(row.seedValues.data, 'base64');
  if (hash(bytes) !== row.seedValues.sha256 || bytes.length !== row.retainedCount * 4) throw new Error('R36_SUPPORT_C6_SEED_BYTES');
  return Float32Array.from({ length: row.retainedCount }, (_, index) => bytes.readFloatLE(index * 4));
}
function output(seed: number, value: unknown): void { const out = process.env.R36_STRUCTURAL_SUPPORT_OUT; if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-structural.json`), JSON.stringify(value, null, 2) + '\n'); } }

// A real contact path must remain in the complete original owner and anchor frame.
function rooted(d: ReturnType<typeof build>, start: number, key: string): boolean {
  const queue = [start], seen = new Set<number>();
  while (queue.length) {
    const index = queue.pop(); if (index === undefined || seen.has(index)) continue; seen.add(index);
    const mass = d.masses[index]; if (!mass || frame(mass) !== key) continue;
    if (mass.y0 <= C.SKYRIVER_CITY_VOID_BASE_Y) return true;
    for (const next of d.contacts(d.boxes[index]!, index)) if (!seen.has(next) && frame(d.masses[next]!) === key) queue.push(next);
  }
  return false;
}

describe('R36 independent short structural support geometry', () => {
  it.each(SEEDS)('keeps true c6 packed seed and source-union authority at seed %i', seed => {
    const old = occurrenceBefore.seeds.find(row => row.seed === seed), physical = physicalBefore.rows.find(row => row.seed === seed);
    if (!old || !physical) throw new Error('R36_SUPPORT_BASELINE');
    expect(physicalBefore.sourceSha256).toBe('c21b0bab5f530a5441d1f5277fb1176c4ba4e8bb5233a070621b779becdfaf2b');
    expect(physical.retainedCount).toBe(old.retainedCount); expect(oldSeedValues(physical)).toHaveLength(old.retainedCount);
    for (const union of physical.ownerUnions) { expect(Number.isFinite(union.owner)).toBe(true); expect(Number.isFinite(union.anchorV)).toBe(true); expect(new Set(union.boxes.map(row => sourceSolid(row).index)).size).toBe(union.boxes.length); }
  });

  it('provides the complete frozen support provenance API', () => {
    const result = records(presentCityLayout(deriveCityLayout(424242)));
    expect(result.length).toBeGreaterThan(0);
  });

  it.each(SEEDS)('restores real short contacts and passes final guard geometry at seed %i', seed => {
    const d = data(seed), bridgeIds = new Set(d.bridges.map(row => row.supportMassIndex));
    expect(d.matching.missing).toEqual([]);
    expect(d.bridges.length).toBeGreaterThan(0);
    expect(d.masses.flatMap((mass, index) => role(mass) === 'retained-child-bridge' ? [index] : [])).toEqual([...bridgeIds].sort((a, b) => a - b));
    const byOriginal = new Map(d.matching.matched.map(row => [row.record.originalIndex, row]));
    const bridgeBoxes = d.bridges.map(row => d.boxes[row.supportMassIndex]!);
    const pairConflict = supportConflictQuery(bridgeBoxes), voidConflict = supportConflictQuery(legacyRoofVoidBoxes(d.masses, C.deriveTowerProfiles(d.layout)));
    const prefix = Array.from({ length: d.details.oldTrimCount }, (_, index) => C.skyriverTrimBlocksHero(d.trims, index, d.heroes) ? null : trimRoofBox(d.trims, index));
    const prefixConflict = supportConflictQuery(prefix);
    const r27Roofs = d.masses.flatMap((mass, massIndex) => mass.baseRecord ? [{ massIndex, box: d.boxes[massIndex]! }] : []);
    const reconciliation = C.deriveLegacyTrimReconciliation(d.layout);
    const prefixCollisions = d.bridges.flatMap(record => prefixConflict(d.boxes[record.supportMassIndex]!).map(trimIndex => ({ record, support: d.masses[record.supportMassIndex], supportBox: d.boxes[record.supportMassIndex], prefixIndex: trimIndex, prefixKind: d.trims.kind[trimIndex], prefixBox: prefix[trimIndex], disposition: reconciliation.dispositions[trimIndex], sourceInventory: reconciliation.sourceInventory[trimIndex], current: { cx: d.trims.cx[trimIndex], cy: d.trims.cy[trimIndex], cz: d.trims.cz[trimIndex], sx: d.trims.sx[trimIndex], sy: d.trims.sy[trimIndex], sz: d.trims.sz[trimIndex], owner: d.trims.owner[trimIndex], spanTo: d.trims.spanTo[trimIndex] } })));
    const roofCrossings = d.bridges.flatMap(record => r27Roofs.filter(roof => supportCrossesRoofPlane(d.boxes[record.supportMassIndex]!, roof.box)).map(roof => ({ record, roofMassIndex: roof.massIndex, roofMass: d.masses[roof.massIndex], supportBox: d.boxes[record.supportMassIndex], roofBox: roof.box })));
    output(seed, { seed, status: 'physical-audit-before-assertions', supportCount: d.bridges.length, prefixCollisions, roofCrossings });
    let contained = 0;
    const connection = new Map<string, boolean>();
    for (const [n, record] of d.bridges.entries()) {
      const child = byOriginal.get(record.childSourceIndex), support = d.masses[record.supportMassIndex], host = d.masses[record.hostMassIndex];
      if (!child || !support || !host) throw new Error('R36_SUPPORT_ACTUAL_RECORD_INDEX');
      expect(child.finalIndex).toBe(record.childFinalIndex); expect(child.record.baselineClass).toBe('supported');
      expect(record.supportMassIndex).not.toBe(record.childFinalIndex); expect(record.supportMassIndex).not.toBe(record.hostMassIndex);
      expect(support.baseRecord).toBeUndefined(); expect(role(support)).toBe('retained-child-bridge');
      expect(support.height).toBeGreaterThan(0); expect(support.height).toBeLessThanOrEqual(4); expect(support.width).toBeGreaterThan(0); expect(support.depth).toBeGreaterThan(0);
      const key = JSON.stringify([record.owner, record.anchorV]);
      expect(frame(support)).toBe(key); expect(frame(host)).toBe(key);
      const box = d.boxes[record.supportMassIndex]!;
      expect(retainedMassContact(box, d.boxes[record.childFinalIndex]!)).not.toBeNull(); expect(retainedMassContact(box, d.boxes[record.hostMassIndex]!)).not.toBeNull();
      const pathKey = `${record.hostMassIndex}/${key}`;
      if (!connection.has(pathKey)) connection.set(pathKey, rooted(d, record.hostMassIndex, key));
      expect(connection.get(pathKey), `rooted:${record.childSourceIndex}`).toBe(true);
      expect(pairConflict(box).filter(index => index !== n), `support-pair:${record.childSourceIndex}`).toEqual([]);
      expect(voidConflict(box), `air:${record.childSourceIndex}`).toEqual([]);
      expect(r27Roofs.filter(roof => supportCrossesRoofPlane(box, roof.box)).map(roof => roof.massIndex), `R27-roof:${record.childSourceIndex}`).toEqual([]);
      expect(prefixConflict(box), `prefix:${record.childSourceIndex}`).toEqual([]);
      if (record.geometry.kind === 'strict-clear') expect(d.conflicts(box).filter(index => ![record.supportMassIndex, record.childFinalIndex, record.hostMassIndex].includes(index)), `solid:${record.childSourceIndex}`).toEqual([]);
      else {
        contained++;
        const union = d.physical.ownerUnions.find(row => row.owner === record.owner && row.anchorV === record.anchorV);
        if (!union) throw new Error('R36_SUPPORT_ORIGINAL_OWNER_UNION');
        const actual = new Map(union.boxes.map(row => { const b = sourceSolid(row); return [b.index, b]; }));
        const claimed = record.geometry.sourceMassIndices.map(index => { const box = actual.get(index); if (!box) throw new Error('R36_SUPPORT_FALSE_SOURCE_UNION'); return box; });
        expect(uncoveredSupportVolume(support, claimed), `contained:${record.childSourceIndex}`).toBe(0);
      }
    }
    for (const row of d.matching.matched) if (row.record.baselineClass === 'supported') expect(d.contacts(d.boxes[row.finalIndex]!, row.finalIndex).length, `retained:${row.record.originalIndex}`).toBeGreaterThan(0);
    expect(d.details.records.filter(row => bridgeIds.has(row.supportMassIndex))).toEqual([]);
    const route = roofRouteClearance(bridgeBoxes); expect(route.violations).toBe(0);
    output(seed, { seed, supportCount: d.bridges.length, contained, checkedRetained: d.matching.matched.filter(row => row.record.baselineClass === 'supported').length, rootedHosts: connection.size, route });
  });

  it.each(SEEDS)('packs dark supports and preserves every old shader seed in both far modes at seed %i', seed => {
    const d = data(seed), verifiedDarkIds = verifiedR36DarkMassIds(d.layout, d.masses, C.deriveTowerProfiles(d.layout), d.bridges), originalSeeds = oldSeedValues(d.physical), oldSeedByIndex = new Map(d.original.map((row, index) => [row.originalIndex, originalSeeds[index]!])), city = new C.SkyriverCity({ layout: d.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      const names = city.group.children.map(child => child.name).sort(), districts = deriveSkyriverDistrictModel(seed);
      for (const mode of ['impostor', 'geometry'] as const) {
        city.setFarMode(mode); expect(city.group.children.map(child => child.name).sort()).toEqual(names);
        const mesh = city.group.getObjectByName('skyriver.city.towers'); if (!(mesh instanceof THREE.InstancedMesh)) throw new Error('R36_SUPPORT_REAL_TOWER_BATCH');
        const draw = new Map<number, number>(); let next = 0; d.masses.forEach((mass, index) => { if (mode === 'geometry' || (mass.layer ?? 0) < 2) draw.set(index, next++); }); expect(mesh.count).toBe(next);
        const seedAttr = mesh.geometry.getAttribute('aSeed'), emission = mesh.geometry.getAttribute('aEmissionAllowed'), sizes = mesh.geometry.getAttribute('aSize'), material = mesh.geometry.getAttribute('aMaterial'), district = mesh.geometry.getAttribute('aDistrict');
        if (!(emission instanceof THREE.InstancedBufferAttribute) || emission.itemSize !== 1 || !(emission.array instanceof Float32Array)) throw new Error('R36_SUPPORT_REAL_EMISSION_ATTRIBUTE');
        for (const row of d.matching.matched) { const slot = draw.get(row.finalIndex); if (slot !== undefined) expect(seedAttr.getX(slot), `seed:${mode}:${row.record.originalIndex}`).toBe(oldSeedByIndex.get(row.record.originalIndex)); }
        for (const record of d.bridges) {
          const slot = draw.get(record.supportMassIndex), mass = d.masses[record.supportMassIndex]; if (slot === undefined || !mass) throw new Error('R36_SUPPORT_DRAW_MAP');
          expect(emission.getX(slot)).toBe(0);
          const actual = uploadedRoofBox(mesh.instanceMatrix.array, slot * 16), expected = d.boxes[record.supportMassIndex]!, tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(expected));
          for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(tolerance);
          expect([sizes.getX(slot), sizes.getY(slot), sizes.getZ(slot)]).toEqual([mass.width, mass.height, mass.depth].map(Math.fround));
          expect(material.getX(slot)).toBe(Math.fround(record.owner)); expect(district.getX(slot)).toBe(skyriverDistrictIdAt(districts, record.anchorV));
        }
        for (const [index, slot] of draw) { const mass = d.masses[index]!; expect(emission.getX(slot)).toBe(verifiedDarkIds.has(index) || mass.baseRecord?.kind === 'equipment' ? 0 : 1); }
        const signs = city.group.getObjectByName('skyriver.city.signs'); if (!(signs instanceof THREE.Mesh)) throw new Error('R36_SUPPORT_REAL_SIGN_BATCH');
        const centres = signs.geometry.getAttribute('aCentre'), normals = signs.geometry.getAttribute('aNormal'), signSizes = signs.geometry.getAttribute('aSize');
        const heroBoxes = Array.from({ length: city.sourceCounts().heroSigns }, (_, i) => { const x = normals.getX(i), z = normals.getY(i), length = Math.hypot(x, z); if (!(length > 0)) throw new Error('R36_SUPPORT_HERO_NORMAL'); return { x: centres.getX(i), y: centres.getY(i), z: centres.getZ(i), hx: signSizes.getX(i) / 2 + 14, hy: signSizes.getY(i) / 2 + 18, hz: 14, c: z / length, s: x / length }; });
        const heroConflict = supportConflictQuery(heroBoxes); for (const record of d.bridges) expect(heroConflict(d.boxes[record.supportMassIndex]!)).toEqual([]);
      }
    } finally { city.dispose(); }
  });

  it('keeps seed123456 source1161 supported through the protected hero gaps', () => {
    const seed = 123456, layout = presentCityLayout(deriveCityLayout(seed));
    const masses = C.deriveCityMasses(layout), trims = C.deriveCityTrims(layout), profiles = C.deriveTowerProfiles(layout);
    const record = records(layout).find(row => row.childSourceIndex === 1161);
    if (!record) throw new Error('R36_SEED123456_CHILD1161_RECORD');
    const source = { x: -548.5167912226741, y0: 441, z: -3510.0215289812354, width: 24, height: 55, depth: 43,
      tint: 6968384, anchorV: -3520, building: 0.8625438079029664, materialOwner: 0.8625438079029664 };
    const oldHost = { x: -630, y0: 151.0804464557457, z: -3520, width: 146.9664175546518,
      height: 700, depth: 136.69456355647444, tint: 8027520, anchorV: -3520,
      building: source.building, materialOwner: source.materialOwner };
    expect(retainedMassContact(massRoofBox(source), massRoofBox(oldHost))).not.toBeNull();
    const child = masses[record.childFinalIndex]!, host = masses[record.hostMassIndex]!, support = masses[record.supportMassIndex]!;
    expect(child).toEqual(source);
    expect([record.owner, record.anchorV]).toEqual([source.materialOwner, source.anchorV]);
    expect([host.x, host.z, host.materialOwner, host.anchorV]).toEqual([-630, -3520, source.materialOwner, -3520]);
    expect(host.yawRad).toBe(expectedTowerYaw(seed, oldHost, 170, false));
    expect(record.geometry.kind).toBe('strict-clear');
    expect(support.supportRole).toBe('retained-child-bridge');
    expect(support.height).toBeGreaterThan(0); expect(support.height).toBeLessThanOrEqual(4);
    const boxes = masses.map(massRoofBox), box = boxes[record.supportMassIndex]!;
    expect(retainedMassContact(box, boxes[record.childFinalIndex]!)).not.toBeNull();
    expect(retainedMassContact(box, boxes[record.hostMassIndex]!)).not.toBeNull();
    expect(host.y0).toBeLessThanOrEqual(C.SKYRIVER_CITY_VOID_BASE_Y);
    expect(supportConflictQuery(boxes)(box).filter(index => ![record.supportMassIndex, record.childFinalIndex, record.hostMassIndex].includes(index))).toEqual([]);
    expect(supportConflictQuery(legacyRoofVoidBoxes(masses, profiles))(box)).toEqual([]);
    const heroes = C.deriveHeroBlades(layout), prefix = Array.from({ length: C.deriveRoofDetails(layout).oldTrimCount }, (_, index) => C.skyriverTrimBlocksHero(trims, index, heroes) ? null : trimRoofBox(trims, index));
    expect(supportConflictQuery(prefix)(box)).toEqual([]);
    expect(roofRouteClearance([box]).violations).toBe(0);
    const city = new C.SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      city.setFarMode('geometry');
      const signs = city.group.getObjectByName('skyriver.city.signs'), towers = city.group.getObjectByName('skyriver.city.towers');
      if (!(signs instanceof THREE.Mesh) || !(towers instanceof THREE.InstancedMesh)) throw new Error('R36_SEED123456_REAL_BATCH');
      const centres = signs.geometry.getAttribute('aCentre'), normals = signs.geometry.getAttribute('aNormal'), sizes = signs.geometry.getAttribute('aSize');
      const protectedBoxes = Array.from({ length: city.sourceCounts().heroSigns }, (_, index) => {
        const x = normals.getX(index), z = normals.getY(index), length = Math.hypot(x, z);
        return { x: centres.getX(index), y: centres.getY(index), z: centres.getZ(index), hx: sizes.getX(index) / 2 + 14,
          hy: sizes.getY(index) / 2 + 18, hz: 14, c: -z / length, s: -x / length };
      });
      expect(supportConflictQuery(protectedBoxes)(box)).toEqual([]);
      expect(towers.geometry.getAttribute('aEmissionAllowed').getX(record.supportMassIndex)).toBe(0);
      const actual = uploadedRoofBox(towers.instanceMatrix.array, record.supportMassIndex * 16), tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(box));
      for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(actual[key] - box[key])).toBeLessThanOrEqual(tolerance);
    } finally { city.dispose(); }
  });

  it('measures turned support volume in the immutable source union', () => {
    const original = { index: 0, x: 0, z: 0, y0: 0, width: 4, depth: 10, height: 4 };
    const turned = { ...original, width: 8, depth: 2, yawRad: Math.PI / 2 };
    expect(uncoveredSupportVolume(turned, [original])).toBe(0);
    expect(uncoveredSupportVolume({ ...turned, x: 4 }, [original])).toBeGreaterThan(0);
    expect(uncoveredSupportVolume({ ...turned, yawRad: 0 }, [original])).toBeGreaterThan(0);
  });

  it('rejects volume outside the true original solid union', () => {
    const row = physicalBefore.rows[0], union = row?.ownerUnions[0], raw = union?.boxes[0]; if (!raw) throw new Error('R36_SUPPORT_REAL_UNION_CONTROL');
    const original = sourceSolid(raw), piece = { ...original, width: original.width / 2, depth: original.depth / 2, y0: original.y0 + original.height / 4, height: original.height / 2 };
    expect(uncoveredSupportVolume(piece, [original])).toBe(0);
    expect(uncoveredSupportVolume({ ...piece, x: piece.x + 100000 }, [original])).toBeGreaterThan(0);
  });
});
