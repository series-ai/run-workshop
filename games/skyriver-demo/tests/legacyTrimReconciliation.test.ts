import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
// Only canvas atlas constructors are replaced. Geometry and packing stay real.
vi.mock('../src/render/signAtlas', async original => ({ ...await original<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async original => ({ ...await original<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async original => ({ ...await original<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { buildingSeedOf, deriveCityMasses, deriveCityTrims, deriveHeroBlades, deriveRetainedMassSupportRecords, deriveLegacyTrimReconciliation, deriveRoofDetails, SkyriverCity, skyriverTrimBlocksHero, SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT, SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE, type SkyriverCityTrims } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { deriveSkyriverDistrictModel, skyriverDistrictIdAt, SkyriverDistrictColourSwitch } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import before from './fixtures/r36-legacy-prefix-before.json';
import { assertLegacyTrimOneToOne, type LegacyTrimInventoryEvidence } from './support/legacyTrimInventory';
import { readRetainedBridgeRecords } from './support/retainedStructuralSupport';
import { legacyTrimExposedContact, verifiedSupportNonHostIds } from './support/legacyTrimFaceGeometry';
import { roofBoxTolerance, trimRoofBox, uploadedRoofBox } from './support/rooftopDetailsGeometry';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const hash = (value: string | ArrayBufferView) => createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength)).digest('hex');
const DATA = new Map(SEEDS.map(seed => {
  const layout = presentCityLayout(deriveCityLayout(seed)), trims = deriveCityTrims(layout), evidence: LegacyTrimInventoryEvidence & { readonly roofRowsDeferred: number; readonly spanRowsDeferred: number } = deriveLegacyTrimReconciliation(layout);
  const original: SkyriverCityTrims = { ...trims, count: evidence.sourceCount,
    ...Object.fromEntries((['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'seedValue'] as const).map(key => [key, new Float32Array(evidence.sourceInventory.map(row => row[key]))])),
    kind: new Uint8Array(evidence.sourceInventory.map(row => row.kind)), owner: evidence.sourceInventory.map(row => row.owner), spanTo: evidence.sourceInventory.map(row => row.spanTo) };
  const masses = deriveCityMasses(layout), supportRecords = readRetainedBridgeRecords(deriveRetainedMassSupportRecords(layout)), nonHosts = verifiedSupportNonHostIds(supportRecords, masses);
  return [seed, { layout, trims, evidence, original, masses, supportRecords, nonHosts, heroes: deriveHeroBlades(layout) }];
}));

describe('R36 D1 original trim inventory and real side hosts', () => {
  it.each(SEEDS)('retains every original index and full source identity at seed %i', seed => {
    const { layout, evidence, trims, masses } = DATA.get(seed)!;
    assertLegacyTrimOneToOne(evidence, trims, deriveRoofDetails(layout).oldTrimCount, masses);
    expect(evidence.roofRowsDeferred).toBe(0);
    expect(evidence.spanRowsDeferred).toBe(0);
  });

  it.each(SEEDS)('uses real exposed faces and keeps exposed source rows exact at seed %i', seed => {
    const { layout, evidence, trims, original, masses, nonHosts, heroes } = DATA.get(seed)!;
    const ordinary = new Map(layout.towers.map(tower => [buildingSeedOf(tower.x, tower.z), tower.z]));
    const baseOwners = new Set(masses.filter(mass => mass.baseRecord).map(mass => JSON.stringify([mass.x, mass.z, mass.width, mass.depth, mass.anchorV ?? mass.z, mass.materialOwner])));
    let moved = 0, exposedUnchanged = 0, buriedSourceMoved = 0, exposedSourceMoved = 0, hostExposureFailures = 0;
    const failures: unknown[] = [];
    for (const [index, source] of evidence.sourceInventory.entries()) {
      const disposition = evidence.dispositions[index]!;
      const originalBlocked = skyriverTrimBlocksHero(original, index, heroes), finalBlocked = skyriverTrimBlocksHero(trims, index, heroes);
      expect(finalBlocked, `filter:${index}`).toBe(originalBlocked);
      expect(disposition.heroFiltered, `declared-filter:${index}`).toBe(finalBlocked);
      const blockers = heroes.filter(hero => skyriverTrimBlocksHero(trims, index, [hero])).map(hero => `${hero.kind}:${hero.cell}:${hero.buildingId}:${hero.faceId}:${hero.compositionId}`);
      expect(disposition.blockingHeroIds, `actual-hero-cause:${index}`).toEqual(blockers);
      const baseOwned = baseOwners.has(JSON.stringify([source.owner.x, source.owner.z, source.owner.width, source.owner.depth, source.owner.anchorV, source.owner.materialOwner]));
      const inScope = [3, 4, 5].includes(source.kind) && source.spanTo === null && !baseOwned && ordinary.get(source.canonicalOwner) === source.owner.anchorV && !originalBlocked;
      if (!inScope) {
        const ordinaryRoof = [SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT].includes(source.kind) && source.spanTo === null && !baseOwned && ordinary.get(source.canonicalOwner) === source.owner.anchorV && !originalBlocked;
        if (ordinaryRoof) expect(['unchanged', 'roof-rehosted', 'inherited-roof-unsupported'], `roof-scope:${index}`).toContain(disposition.kind);
        else {
          const other = source.spanTo;
          const ordinarySpan = other !== null && [SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE].includes(source.kind) && !baseOwned && !originalBlocked &&
            (ordinary.get(source.canonicalOwner) === source.owner.anchorV || ordinary.get(other.materialOwner ?? buildingSeedOf(other.x, other.z)) === other.anchorV);
          if (ordinarySpan) expect(['unchanged', 'span-rehosted', 'inherited-span-unsupported'], `span-scope:${index}`).toContain(disposition.kind);
          else expect(disposition.kind, `protected:${index}`).toBe('unchanged');
        }
        continue;
      }
      const oldContact = legacyTrimExposedContact(source, source.owner, masses, undefined, nonHosts);
      const newContact = legacyTrimExposedContact(disposition.newGeometry, trims.owner[disposition.finalIndex]!, masses, undefined, nonHosts);
      if (!(newContact.area > Math.max(1e-7, source.sy * source.sz * 1e-10))) failures.push({ reason: 'no-exposed-contact', index, kind: source.kind, disposition, oldContact, newContact });
      if (oldContact.area > Math.max(1e-7, source.sy * source.sz * 1e-10)) {
        if (disposition.kind !== 'unchanged') { exposedSourceMoved++; failures.push({ reason: 'exposed-source-moved', index, source, disposition, oldContact, oldHostMasses: oldContact.hostMassIndices.map(hostIndex => ({ hostIndex, mass: masses[hostIndex] })), newHost: disposition.kind === 'side-rehosted' ? masses[disposition.hostMassIndex] : null }); }
        else exposedUnchanged++;
      }
      if (disposition.kind === 'side-rehosted') {
        moved++; if (oldContact.area === 0) buriedSourceMoved++;
        const host = masses[disposition.hostMassIndex]; expect(host, `host:${index}`).toBeDefined();
        expect(host!.materialOwner ?? host!.building ?? buildingSeedOf(host!.x, host!.z)).toBe(source.canonicalOwner);
        expect(host!.anchorV ?? host!.z).toBe(source.owner.anchorV);
        const actualHost = legacyTrimExposedContact(disposition.newGeometry, trims.owner[disposition.finalIndex]!, masses, disposition.hostMassIndex, nonHosts);
        if (!(actualHost.area > Math.max(1e-7, source.sy * source.sz * 1e-10))) { hostExposureFailures++; failures.push({ reason: 'claimed-host-not-exposed', index, source, disposition, host, actualHost }); }
        expect(disposition.newGeometry.sx, `thickness:${index}`).toBe(source.sx);
        expect(disposition.newGeometry.sy).toBeLessThanOrEqual(source.sy);
        expect(disposition.newGeometry.sz).toBeLessThanOrEqual(source.sz);
      }
    }
    const result = { seed, sourceCount: evidence.sourceCount, moved, exposedUnchanged, buriedSourceMoved, exposedSourceMoved, hostExposureFailures, failedAssertions: failures.length, examples: failures.slice(0, 8) };
    const out = process.env.R36_D1_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-d1.json`), JSON.stringify(result, null, 2) + '\n'); }
    expect(failures, JSON.stringify(result)).toEqual([]);
    expect(moved).toBe(evidence.dispositions.filter(row => row.kind === 'side-rehosted').length);
  });

  it.each(SEEDS)('packs actual repaired dimensions and preserves fixed groups at seed %i', seed => {
    const { layout, evidence, trims, masses, heroes } = DATA.get(seed)!;
    const oracle = before.rows.find(row => row.seed === seed)!;
    const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try {
      const mesh = city.group.getObjectByName('skyriver.city.trim');
      if (!(mesh instanceof THREE.InstancedMesh)) throw new Error('R36_D1_ACTUAL_TRIM_BATCH');
      const districtModel = deriveSkyriverDistrictModel(seed), ordinary = new Set(layout.towers.map(t => buildingSeedOf(t.x, t.z)));
      const ownerKey = (owner: { x: number; z: number; width: number; depth: number; anchorV?: number; materialOwner?: number }) => JSON.stringify([owner.x, owner.z, owner.width, owner.depth, owner.anchorV ?? owner.z, owner.materialOwner]);
      const baseOwners = new Set(masses.filter(m => m.baseRecord).map(ownerKey));
      const groupSource = { protected: [] as number[], R27: [] as number[] }, groupVisible = { protected: [] as number[], R27: [] as number[] }, groupDraw = { protected: [] as number[], R27: [] as number[] };
      let drawn = 0;
      for (let index = 0; index < evidence.sourceCount; index++) {
        const row = evidence.sourceInventory[index]!, other = row.spanTo;
        const protectedRow = !ordinary.has(row.canonicalOwner) && (!other || !ordinary.has(other.materialOwner ?? buildingSeedOf(other.x, other.z)));
        const R27 = baseOwners.has(ownerKey(row.owner));
        const groups = [...(protectedRow ? ['protected' as const] : []), ...(R27 ? ['R27' as const] : [])];
        for (const key of groups) groupSource[key].push(index);
        if (skyriverTrimBlocksHero(trims, index, heroes)) continue;
        for (const key of groups) { groupVisible[key].push(index); groupDraw[key].push(drawn); }
        const expected = trimRoofBox(trims, index), actual = uploadedRoofBox(mesh.instanceMatrix.array, drawn * 16), tolerance = Math.max(roofBoxTolerance(expected), roofBoxTolerance(actual));
        for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(actual[key] - expected[key]), `matrix:${index}:${key}`).toBeLessThanOrEqual(tolerance);
        const size = mesh.geometry.getAttribute('aSize');
        expect([size.getX(drawn), size.getY(drawn), size.getZ(drawn)]).toEqual([expected.hx * 2, expected.hy * 2, expected.hz * 2].map(Math.fround));
        expect(mesh.geometry.getAttribute('aSeed').getX(drawn)).toBe(row.seedValue);
        expect(mesh.geometry.getAttribute('aKind').getX(drawn)).toBe(row.kind);
        expect(mesh.geometry.getAttribute('aMaterial').getX(drawn)).toBe(Math.fround(row.canonicalOwner));
        expect(mesh.geometry.getAttribute('aDistrict').getX(drawn)).toBe(skyriverDistrictIdAt(districtModel, row.owner.anchorV));
        drawn++;
      }
      expect(city.getRoofDetailEvidence().legacyDrawnCount).toBe(drawn);
      for (const key of ['protected', 'R27'] as const) {
        const saved = oracle.packedPrefixGroups[key], indices = groupSource[key], slots = groupDraw[key];
        expect(indices.length).toBe(saved.sourceCount); expect(slots.length).toBe(saved.drawnCount);
        expect(hash(JSON.stringify(indices))).toBe(saved.sourceIndexSha256);
        expect(hash(JSON.stringify(groupVisible[key]))).toBe(saved.drawnSourceIndexSha256);
        const selected = (array: ArrayLike<number>, size: number) => new Float32Array(slots.flatMap(slot => Array.from({ length: size }, (_, component) => array[slot * size + component]!)));
        expect(hash(selected(mesh.instanceMatrix.array, 16))).toBe(saved.matrixSha256);
        for (const [name, original] of Object.entries(saved.attributes)) {
          const attribute = mesh.geometry.getAttribute(name);
          if (!(attribute instanceof THREE.InstancedBufferAttribute)) throw new Error('R36_D1_ACTUAL_INSTANCE_ATTRIBUTE');
          expect(attribute.itemSize).toBe(original.itemSize); expect(hash(selected(attribute.array, attribute.itemSize))).toBe(original.sha256);
        }
      }
    } finally { city.dispose(); }
  });


  it('rejects an altered final yaw host frame while preserving source provenance', () => {
    const d = DATA.get(424242)!;
    const repaired = d.evidence.dispositions.find(row => (row.kind === 'side-rehosted' || row.kind === 'roof-rehosted') && (d.masses[row.hostMassIndex]!.yawRad ?? 0) !== 0);
    if (!repaired) throw new Error('YAW_LEGACY_FRAME_CONTROL_HOST');
    const owner = d.trims.owner[repaired.finalIndex]!;
    const owners = [...d.trims.owner]; owners[repaired.finalIndex] = { ...owner, yawRad: (owner.yawRad ?? 0) + .001 };
    expect(() => assertLegacyTrimOneToOne(d.evidence, { ...d.trims, owner: owners }, deriveRoofDetails(d.layout).oldTrimCount, d.masses)).toThrow(`final-owner:${repaired.finalIndex}`);
    expect(d.evidence.sourceInventory[repaired.sourceIndex]!.owner.yawRad).toBeUndefined();
  });

  it('rejects a real auxiliary-only facade host while retaining ordinary source contact', () => {
    const d = DATA.get(424242)!, record = d.supportRecords[0];
    if (!record) throw new Error('R36_CONTROL_ACTUAL_SUPPORT');
    const bridge = d.masses[record.supportMassIndex]!;
    const side = Math.sign(bridge.x), plane = bridge.x - side * bridge.width / 2;
    const owner = { x: bridge.x, z: bridge.z, width: bridge.width, depth: bridge.depth, anchorV: record.anchorV, materialOwner: record.owner, yawRad: bridge.yawRad, yawAnchor: bridge.yawAnchor };
    const trim = { cx: plane, cy: bridge.y0 + bridge.height / 2, cz: bridge.z, sx: 4, sy: bridge.height, sz: bridge.depth };
    // Isolate the actual bridge for this host-domain control. Test occlusion below.
    const excluded = new Set([0]);
    expect(legacyTrimExposedContact(trim, owner, [bridge], 0).area).toBeGreaterThan(0);
    expect(legacyTrimExposedContact(trim, owner, [bridge], 0, excluded).area).toBe(0);
    const ordinary = new Map(d.layout.towers.map(tower => [buildingSeedOf(tower.x, tower.z), tower.z]));
    const valid = d.evidence.sourceInventory.find((source, index) => [3, 4, 5].includes(source.kind) && source.spanTo === null && ordinary.get(source.canonicalOwner) === source.owner.anchorV && d.evidence.dispositions[index]!.kind === 'unchanged' && legacyTrimExposedContact(source, source.owner, d.masses, undefined, d.nonHosts).area > 0);
    if (!valid) throw new Error('R36_CONTROL_ORDINARY_SOURCE');
    expect(d.evidence.dispositions[valid.sourceIndex]!.newGeometry).toEqual({ cx: valid.cx, cy: valid.cy, cz: valid.cz, sx: valid.sx, sy: valid.sy, sz: valid.sz });
    expect(legacyTrimExposedContact(valid, valid.owner, d.masses, undefined, d.nonHosts).area).toBeGreaterThan(0);
  });

  it('keeps an excluded actual bridge in the physical facade occlusion set', () => {
    const d = DATA.get(424242)!, record = d.supportRecords[0];
    if (!record) throw new Error('R36_CONTROL_ACTUAL_SUPPORT');
    const bridge = d.masses[record.supportMassIndex]!, side = Math.sign(bridge.x), plane = bridge.x - side * bridge.width / 2;
    // Shift an ordinary host behind the actual bridge. Preserve the actual bridge box.
    const host = { ...d.masses[record.hostMassIndex]!, x: bridge.x + side, z: bridge.z, width: bridge.width, depth: bridge.depth, y0: bridge.y0, height: bridge.height, yawRad: bridge.yawRad, yawAnchor: bridge.yawAnchor ?? { x: bridge.x, z: bridge.z }, anchorV: bridge.anchorV };
    const owner = { x: bridge.x, z: bridge.z, width: bridge.width, depth: bridge.depth, anchorV: record.anchorV, materialOwner: record.owner, yawRad: bridge.yawRad, yawAnchor: bridge.yawAnchor };
    const trim = { cx: plane + side, cy: bridge.y0 + bridge.height / 2, cz: bridge.z, sx: 4, sy: bridge.height, sz: bridge.depth };
    const hostOnly = legacyTrimExposedContact(trim, owner, [host], 0);
    expect(hostOnly.area).toBeGreaterThan(0);
    const covered = legacyTrimExposedContact(trim, owner, [host, bridge], 0, new Set([1]));
    expect(covered.area).toBe(0);
  });

  it.each(['missing', 'duplicate', 'owner', 'geometry'] as const)('rejects an injected %s record regression', mutation => {
    const { evidence, trims, layout } = DATA.get(424242)!;
    const bad: LegacyTrimInventoryEvidence = structuredClone(evidence);
    let candidate = bad;
    if (mutation === 'missing') candidate = { ...bad, dispositions: bad.dispositions.slice(1) };
    if (mutation === 'duplicate') candidate = { ...bad, sourceInventory: [bad.sourceInventory[1]!, ...bad.sourceInventory.slice(1)] };
    if (mutation === 'owner') candidate = { ...bad, sourceInventory: bad.sourceInventory.map((row, index) => index === 0 ? { ...row, owner: { ...row.owner, width: row.owner.width + 1 } } : row) };
    if (mutation === 'geometry') candidate = { ...bad, dispositions: bad.dispositions.map((row, index) => index === 0 ? { ...row, newGeometry: { ...row.newGeometry, cy: row.newGeometry.cy + 1 } } : row) };
    expect(() => assertLegacyTrimOneToOne(candidate, trims, deriveRoofDetails(layout).oldTrimCount, DATA.get(424242)!.masses)).toThrow('R36_LEGACY_INVENTORY');
  });
});
