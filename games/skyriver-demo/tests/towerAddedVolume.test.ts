import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as C from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import before from './fixtures/r36-resolved-art-before.json';
import { independentMassRoofBox } from './support/towerProfileGeometry';
import { readRetainedBridgeRecords, supportConflictQuery } from './support/retainedStructuralSupport';
import { verifiedSupportNonHostIds } from './support/legacyTrimFaceGeometry';
import { readArtVolumeBox, artVolumeBox, addedCellRoofBox, addedVolumeCells, addedVolumeConflicts } from './support/towerAddedVolume';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
function eligible(row: C.SkyriverTowerProfileRow): row is C.SkyriverEligibleTowerProfile { return row.eligibility.kind === 'eligible'; }
const owner = (mass: C.SkyriverMass) => mass.materialOwner ?? mass.building ?? C.buildingSeedOf(mass.x, mass.z);
function massAt(masses: readonly C.SkyriverMass[], index: number): C.SkyriverMass { const mass = masses[index]; if (!mass) throw new Error('R36_ART_OTHER_MASS_INDEX'); return mass; }
function recordApi(layout: ReturnType<typeof presentCityLayout>) {
  const api: unknown = Reflect.get(C, 'deriveRetainedMassSupportRecords'); if (typeof api !== 'function') throw new Error('R36_ART_SUPPORT_API');
  return readRetainedBridgeRecords(api(layout));
}
function originalUnion(saved: typeof before.rows[number]['towers'][number]) { return [...saved.stages.flatMap(stage => stage.boxes), ...saved.crown.boxes, ...saved.companions, ...(saved.spine === null ? [] : [saved.spine])].map(readArtVolumeBox); }

describe('R36 independent added profile volume', () => {
  it.each(SEEDS)('checks every new stage and crown cell against actual other solids at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = C.deriveCityMasses(layout), profiles = C.deriveTowerProfiles(layout), bridges = recordApi(layout);
    const verified = verifiedSupportNonHostIds(bridges, masses), actualBoxes = masses.map(independentMassRoofBox), query = supportConflictQuery(actualBoxes);
    const seedBefore = before.rows.find(row => row.seed === seed); if (!seedBefore) throw new Error('R36_ART_VOLUME_REFERENCE');
    const violations: { towerIndex: number; candidateMassIndex: number; blockerIndex: number; blockerLayer: number; cell: ReturnType<typeof addedVolumeCells>[number] }[] = [];
    const audit: { towerIndex: number; cells: number; volumeM3: number; intentionalJoinIds: readonly number[] }[] = [];
    expect(profiles.filter(eligible)).toHaveLength(seedBefore.towers.length);
    for (const row of profiles.filter(eligible)) {
      const saved = seedBefore.towers.find(tower => tower.towerIndex === row.towerIndex); if (!saved) throw new Error('R36_ART_VOLUME_PROFILE_REFERENCE');
      expect([row.towerKey, row.materialOwner, layout.towers[row.towerIndex]!.z]).toEqual([saved.towerKey, saved.owner, saved.anchorV]);
      const own = new Set([...row.stages.flatMap(stage => stage.massIndices), ...row.crown.massIndices, ...row.companionMassIndices, ...(row.supportSpineIndex === null ? [] : [row.supportSpineIndex])]);
      const ledgeIds = masses.flatMap((mass, index) => mass.supportRole === 'yaw-span-ledge' && mass.supportHostMassIndex !== undefined && own.has(mass.supportHostMassIndex) ? [index] : []);
      const backingIds = masses.flatMap((mass, index) => mass.artBacking && own.has(mass.artBacking.hostMassIndex) ? [index] : []);
      for (const index of [...backingIds, ...ledgeIds]) own.add(index);
      const joins = bridges.filter(record => verified.has(record.supportMassIndex) && own.has(record.hostMassIndex)).map(record => record.supportMassIndex);
      const excluded = new Set([...own, ...joins]), oldUnion = originalUnion(saved);
      let cells = 0, volumeM3 = 0;
      for (const index of [...row.stages.flatMap(stage => stage.massIndices), ...row.crown.massIndices, ...backingIds, ...ledgeIds]) {
        const mass = massAt(masses, index), added = addedVolumeCells(artVolumeBox(mass, owner(mass)), oldUnion);
        cells += added.length; volumeM3 += added.reduce((sum, cell) => sum + cell.volumeM3, 0);
        for (const hit of addedVolumeConflicts(added, query, excluded, actualBoxes)) violations.push({ towerIndex: row.towerIndex, candidateMassIndex: index, blockerIndex: hit.blockerIndex, blockerLayer: massAt(masses, hit.blockerIndex).layer ?? 0, cell: hit.cell });
      }
      audit.push({ towerIndex: row.towerIndex, cells, volumeM3, intentionalJoinIds: joins });
    }
    const out = process.env.R36_ADDED_VOLUME_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${seed}-added-volume.json`), JSON.stringify({ seed, sourceAuthority: before.sourceSha256, scope: 'Actual rotated footprint and cropped fixed-art backing minus old axis union. Old profile union only. Exclude own final members and physically verified late bridges hosted by those members. Every other mass and layer remains a blocker.', audit, violations }, null, 2) + '\n'); }
    expect(violations).toEqual([]);
  });

  it('keeps old occupancy but rejects new occupied cells independently of layer or owner', () => {
    const saved = before.rows[0]!.towers[0]!, old = originalUnion(saved), candidate = old[0]!;
    expect(addedVolumeCells(candidate, old)).toEqual([]);
    const grown = { ...candidate, width: candidate.width + 20 }, cells = addedVolumeCells(grown, old);
    expect(cells.length).toBeGreaterThan(0);
    const first = cells[0]!, blocker = addedCellRoofBox(first), query = supportConflictQuery([blocker]);
    const hits = addedVolumeConflicts(cells, query, new Set());
    expect(hits.some(hit => hit.blockerIndex === 0)).toBe(true);
    expect(addedVolumeConflicts(cells, query, new Set([0]))).toEqual([]);
    // Query boxes have no layer or owner filter.
    expect(query(addedCellRoofBox(first))).toEqual([0]);
  });

  it('partitions a two-box old union without removing its open gap', () => {
    const saved = before.rows[0]!.towers[0]!, actual = originalUnion(saved)[0]!;
    const candidate = { ...actual, x: 0, z: 0, y0: 0, width: 10, depth: 10, height: 10 };
    const old = [{ ...candidate, x: -3, width: 4 }, { ...candidate, x: 3, width: 4 }];
    const cells = addedVolumeCells(candidate, old);
    expect(cells.reduce((sum, cell) => sum + cell.volumeM3, 0)).toBe(200);
    expect(cells.every(cell => cell.x - cell.width / 2 >= -1 && cell.x + cell.width / 2 <= 1)).toBe(true);
    expect(addedVolumeCells(candidate, [...old, { ...candidate, width: 2 }])).toEqual([]);
  });
});


describe('yaw added-volume controls', () => {
  const source = { x: 0, z: 0, y0: 0, width: 10, depth: 10, height: 10, owner: 1, anchorV: 0 };
  it('detects a rotated wedge with unchanged source dimensions', () => {
    expect(addedVolumeCells(source, [source])).toEqual([]);
    const rotated = { ...source, yawRad: Math.PI / 4 };
    const cells = addedVolumeCells(rotated, [source]);
    expect(cells.reduce((sum, cell) => sum + cell.volumeM3, 0)).toBeCloseTo(40 * (5 * Math.SQRT2 - 5) ** 2, 8);
    const blocker = addedCellRoofBox({ ...source, x: 6, z: 0, width: 0.2, depth: 0.2 });
    const query = supportConflictQuery([blocker]);
    expect(addedVolumeConflicts(cells, query, new Set(), [blocker]).map(hit => hit.blockerIndex)).toContain(0);
    expect(addedVolumeConflicts(cells, query, new Set([0]), [blocker])).toEqual([]);
  });
  it('preserves a corner pivot when the box turns by positive ninety degrees', () => {
    const cells = addedVolumeCells({ ...source, yawRad: Math.PI / 2, yawAnchor: { x: -5, z: -5 } }, [source]);
    expect(cells.reduce((sum, cell) => sum + cell.volumeM3, 0)).toBeCloseTo(1000, 8);
    expect(cells.every(cell => cell.z + cell.depth / 2 <= -5 + 1e-12)).toBe(true);
  });
  it('rejects AABB corner hits when the clipped footprint has no positive overlap', () => {
    const cells = addedVolumeCells({ ...source, width: 10, depth: 2, yawRad: Math.PI / 4 }, []);
    const cell = cells[0]!;
    expect(cell.volumeM3).toBeCloseTo(200, 8);
    const blocker = addedCellRoofBox({ ...source, x: 4, z: 4, width: 0.2, depth: 0.2 });
    const query = supportConflictQuery([blocker]);
    expect(query(addedCellRoofBox(cell))).toEqual([0]);
    expect(addedVolumeConflicts(cells, query, new Set(), [blocker])).toEqual([]);
    const inside = addedCellRoofBox({ ...source, x: 2, z: -2, width: 0.2, depth: 0.2 });
    expect(addedVolumeConflicts(cells, supportConflictQuery([inside]), new Set(), [inside])).toHaveLength(1);
  });
  it('excludes edge contact at the existing physical tolerance', () => {
    const cells = addedVolumeCells({ ...source, yawRad: Math.PI / 2 }, []);
    const touching = addedCellRoofBox({ ...source, x: 6, width: 2 });
    expect(addedVolumeConflicts(cells, () => [0], new Set(), [touching])).toEqual([]);
  });
});
