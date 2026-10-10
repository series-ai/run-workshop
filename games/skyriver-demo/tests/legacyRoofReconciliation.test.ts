import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
// Only canvas texture constructors are replaced. Geometry and packing stay real.
vi.mock('../src/render/signAtlas', async original => ({ ...await original<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async original => ({ ...await original<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async original => ({ ...await original<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import { buildingSeedOf, deriveCityMasses, deriveCityTrims, deriveHeroBlades, deriveLegacyTrimReconciliation, deriveRoofDetails, deriveTowerProfiles, SkyriverCity, skyriverTrimBlocksHero, SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT, type SkyriverCityTrims } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { SkyriverDistrictColourSwitch } from '../src/render/districts';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import before from './fixtures/r36-legacy-roof-source-before.json';
import { assertLegacyTrimOneToOne, type LegacyTrimInventoryEvidence, type LegacyTrimSource } from './support/legacyTrimInventory';
import { legacyRoofCandidateFailures, legacyRoofVoidBoxes, roofConflictQuery, type LegacyRoofCandidate, type LegacyRoofContext } from './support/legacyRoofGeometry';
import { massRoofBox, roofBoxTolerance, roofSupportFailures, trimRoofBox, uploadedRoofBox } from './support/rooftopDetailsGeometry';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const ownerKey = (owner: { x: number; z: number; width: number; depth: number; anchorV?: number; materialOwner?: number }) => JSON.stringify([owner.x, owner.z, owner.width, owner.depth, owner.anchorV ?? owner.z, owner.materialOwner]);
const DATA = new Map(SEEDS.map(seed => {
  const layout = presentCityLayout(deriveCityLayout(seed)), trims = deriveCityTrims(layout);
  const evidence: LegacyTrimInventoryEvidence & { readonly roofRowsDeferred: number } = deriveLegacyTrimReconciliation(layout);
  const original: SkyriverCityTrims = { ...trims, count: evidence.sourceCount,
    ...Object.fromEntries((['cx', 'cy', 'cz', 'sx', 'sy', 'sz', 'seedValue'] as const).map(key => [key, new Float32Array(evidence.sourceInventory.map(row => row[key]))])),
    kind: new Uint8Array(evidence.sourceInventory.map(row => row.kind)), owner: evidence.sourceInventory.map(row => row.owner), spanTo: evidence.sourceInventory.map(row => row.spanTo) };
  const masses = deriveCityMasses(layout), heroes = deriveHeroBlades(layout), ordinary = new Map(layout.towers.map(t => [buildingSeedOf(t.x, t.z), t.z]));
  const baseOwners = new Set(masses.filter(m => m.baseRecord).map(ownerKey));
  const inScope = (row: LegacyTrimSource) => [SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT].includes(row.kind) && row.spanTo === null && ordinary.get(row.canonicalOwner) === row.owner.anchorV && !baseOwners.has(ownerKey(row.owner)) && !skyriverTrimBlocksHero(original, row.sourceIndex, heroes);
  const indices = evidence.sourceInventory.filter(inScope).map(row => row.sourceIndex);
  const supported = (index: number, rows: SkyriverCityTrims) => masses.some(m => (m.materialOwner ?? m.building ?? buildingSeedOf(m.x, m.z)) === evidence.sourceInventory[index]!.canonicalOwner && (m.anchorV ?? m.z) === rows.owner[index]!.anchorV && roofSupportFailures(trimRoofBox(rows, index), massRoofBox(m), 0).length === 0);
  return [seed, { layout, trims, evidence, original, masses, heroes, indices, inScope, supported }];
}));

function actualContext(seed: typeof SEEDS[number]) {
  const data = DATA.get(seed)!, { layout, trims, masses, heroes, evidence } = data;
  const city = new SkyriverCity({ layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
  try {
    const sign = city.group.getObjectByName('skyriver.city.signs'), trim = city.group.getObjectByName('skyriver.city.trim');
    if (!(sign instanceof THREE.Mesh) || !(trim instanceof THREE.InstancedMesh)) throw new Error('R36_D2_ACTUAL_BATCH');
    const centres = sign.geometry.getAttribute('aCentre'), normals = sign.geometry.getAttribute('aNormal'), sizes = sign.geometry.getAttribute('aSize');
    if (!centres || !normals || !sizes) throw new Error('R36_D2_ACTUAL_HERO_ATTRIBUTES');
    const heroBoxes = Array.from({ length: city.sourceCounts().heroSigns }, (_, index) => {
      const nx = normals.getX(index), nz = normals.getY(index), length = Math.hypot(nx, nz);
      if (!(length > 0)) throw new Error('R36_D2_HERO_NORMAL');
      return { x: centres.getX(index), y: centres.getY(index), z: centres.getZ(index), hx: sizes.getX(index) / 2 + 14, hy: sizes.getY(index) / 2 + 18, hz: 14, c: nz / length, s: nx / length };
    });
    const prefixBoxes = evidence.sourceInventory.map((row, index) => skyriverTrimBlocksHero(trims, index, heroes) ? null : trimRoofBox(trims, index));
    const context: LegacyRoofContext = { masses, massHits: roofConflictQuery(masses.map(massRoofBox)), heroHits: roofConflictQuery(heroBoxes), voidHits: roofConflictQuery(legacyRoofVoidBoxes(masses, deriveTowerProfiles(layout))), prefixHits: roofConflictQuery(prefixBoxes) };
    const uploaded = new Map<number, ReturnType<typeof uploadedRoofBox>>(); let slot = 0;
    for (const [index, box] of prefixBoxes.entries()) {
      if (box === null) continue;
      const actual = uploadedRoofBox(trim.instanceMatrix.array, slot * 16);
      uploaded.set(index, actual);
      const size = trim.geometry.getAttribute('aSize');
      expect([size.getX(slot), size.getY(slot), size.getZ(slot)]).toEqual([box.hx * 2, box.hy * 2, box.hz * 2].map(Math.fround));
      slot++;
    }
    expect(city.getRoofDetailEvidence().legacyDrawnCount).toBe(slot);
    return { context, prefixBoxes, uploaded };
  } finally { city.dispose(); }
}

describe('R36 D2 exact legacy roofs and actual joint placement', () => {
  it.each(SEEDS)('classifies every original roof and preserves inherited rows at seed %i', seed => {
    const { layout, evidence, trims, original, masses, indices, inScope, supported } = DATA.get(seed)!;
    assertLegacyTrimOneToOne(evidence, trims, deriveRoofDetails(layout).oldTrimCount, masses);
    const oracle = before.rows.find(row => row.seed === seed)!;
    expect(indices.length).toBe(oracle.scopeCount); expect(hash(JSON.stringify(indices))).toBe(oracle.scopeIndexSha256);
    const inherited = new Set(oracle.inheritedUnsupportedIndices), failures: unknown[] = [];
    let moved = 0, retained = 0, newLostSupport = 0, inheritedClassificationErrors = 0;
    for (const row of evidence.sourceInventory) {
      const record = evidence.dispositions[row.sourceIndex]!;
      if (!inScope(row)) { expect(['roof-rehosted', 'inherited-roof-unsupported']).not.toContain(record.kind); continue; }
      if (inherited.has(row.sourceIndex)) {
        retained++;
        if (record.kind !== 'inherited-roof-unsupported') { inheritedClassificationErrors++; failures.push({ reason: 'inherited-kind', index: row.sourceIndex, kind: record.kind }); }
        for (const key of ['cx', 'cy', 'cz', 'sx', 'sy', 'sz'] as const) expect(trims[key][row.sourceIndex]).toBe(original[key][row.sourceIndex]);
      } else if (!supported(row.sourceIndex, trims)) { newLostSupport++; failures.push({ reason: 'new-roof-loss', index: row.sourceIndex }); }
      if (record.kind === 'roof-rehosted') moved++;
      if (!inherited.has(row.sourceIndex) && supported(row.sourceIndex, original)) expect(record.kind, `supported-source:${row.sourceIndex}`).toBe('unchanged');
    }
    const result = { seed, checked: indices.length, inherited: retained, inheritedExpected: inherited.size, inheritedClassificationErrors, newLostSupport, moved, failedAssertions: failures.length, examples: failures.slice(0, 8) };
    const out = process.env.R36_D2_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-roof-source.json`), JSON.stringify(result, null, 2) + '\n'); }
    expect(retained).toBe(inherited.size); expect(failures, JSON.stringify(result)).toEqual([]);
    expect(evidence.roofRowsDeferred).toBe(0); expect(moved).toBeGreaterThan(0);
  });

  it.each(SEEDS)('uses one real roof and has no new final collision at seed %i', seed => {
    const { evidence, trims } = DATA.get(seed)!, { context, uploaded } = actualContext(seed), failures: unknown[] = [];
    const moved = evidence.dispositions.filter(row => row.kind === 'roof-rehosted');
    for (const record of moved) {
      if (record.kind !== 'roof-rehosted') throw new Error('R36_D2_ROOF_RECORD');
      const source = evidence.sourceInventory[record.sourceIndex]!, box = trimRoofBox(trims, record.finalIndex);
      const errors = legacyRoofCandidateFailures({ source, newGeometry: record.newGeometry, box, hostMassIndex: record.hostMassIndex, horizontalScale: record.horizontalScale }, context);
      if (errors.length) failures.push({ index: record.sourceIndex, host: record.hostMassIndex, errors });
      const actual = uploaded.get(record.finalIndex); if (!actual) throw new Error('R36_D2_ROOF_NOT_DRAWN');
      const tolerance = Math.max(roofBoxTolerance(box), roofBoxTolerance(actual));
      for (const key of ['x', 'y', 'z', 'hx', 'hy', 'hz', 'c', 's'] as const) expect(Math.abs(actual[key] - box[key]), `uploaded:${record.sourceIndex}:${key}`).toBeLessThanOrEqual(tolerance);
    }
    const result = { seed, moved: moved.length, failedAssertions: failures.length, examples: failures.slice(0, 8) };
    const out = process.env.R36_D2_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-roof-collision.json`), JSON.stringify(result, null, 2) + '\n'); }
    expect(failures, JSON.stringify(result)).toEqual([]); expect(moved.length).toBeGreaterThan(0);
  });

  it.each(['host', 'height', 'joint-collision'] as const)('rejects an injected actual %s placement fault', fault => {
    const data = DATA.get(424242)!, { context, prefixBoxes } = actualContext(424242);
    const row = data.evidence.dispositions.find(record => record.kind === 'roof-rehosted');
    if (!row || row.kind !== 'roof-rehosted') throw new Error('R36_D2_NO_ACTUAL_REHOSTED_ROOF');
    const probe: LegacyRoofCandidate = { source: data.evidence.sourceInventory[row.sourceIndex]!, newGeometry: row.newGeometry, box: trimRoofBox(data.trims, row.finalIndex), hostMassIndex: row.hostMassIndex, horizontalScale: row.horizontalScale };
    expect(legacyRoofCandidateFailures(probe, context)).toEqual([]);
    if (fault === 'host') {
      const other = data.masses.findIndex(m => (m.materialOwner ?? m.building ?? buildingSeedOf(m.x, m.z)) !== probe.source.canonicalOwner);
      expect(other).toBeGreaterThanOrEqual(0);
      expect(legacyRoofCandidateFailures({ ...probe, hostMassIndex: other }, context)).toContain('host-identity');
    } else if (fault === 'height') {
      const height = probe.source.sy / 2, bottom = probe.box.y - probe.box.hy;
      const clipped = { ...probe, newGeometry: { ...probe.newGeometry, sy: height, cy: Math.fround(bottom + height / 2) }, box: { ...probe.box, hy: height / 2, y: bottom + height / 2 } };
      expect(legacyRoofCandidateFailures(clipped, context)).toContain('height-changed');
    } else {
      const other = prefixBoxes.findIndex((box, index) => box !== null && index !== row.sourceIndex);
      expect(other).toBeGreaterThanOrEqual(0);
      const changed = prefixBoxes.map((box, index) => index === other ? probe.box : box);
      expect(legacyRoofCandidateFailures(probe, { ...context, prefixHits: roofConflictQuery(changed) })).toContain('prefix-collision');
    }
  });
});
