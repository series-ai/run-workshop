import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as City from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import cohort from './fixtures/r36-ten-before.json';
import { roofBoxesConflict } from './support/rooftopDetailsGeometry';
import { roofConflictQuery } from './support/legacyRoofGeometry';
import { retainedMassContact } from './support/retainedMassContact';
import { physicalDeckSection, deckMemberContainmentFailures, physicalDeckRoofAir, physicalTowerStageSupport } from './support/towerDeckGeometry';
import { addedVolumeCells, addedVolumeConflicts, artVolumeBox, addedCellRoofBox, physicalFootprint } from './support/towerAddedVolume';
import { supportConflictQuery } from './support/retainedStructuralSupport';
import { independentMassRoofBox, physicalFacadeRectangles, canonicalPhysicalSectionUnion, physicalSectionUnionArea, massSection, sourceBoxSection, massIntersectsPrism, normalizedTowerGeometry, normalizedExposedTowerGeometry, canonicalSectionUnion, intersectSection, sectionUnionArea, sectionUnionBounds } from './support/towerProfileGeometry';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
function eligible(row: City.SkyriverTowerProfileRow): row is City.SkyriverEligibleTowerProfile {
  return row.eligibility.kind === 'eligible';
}
function memberIndices(result: readonly number[]): readonly number[] {
  expect(result.every(n => Number.isSafeInteger(n) && n >= 0)).toBe(true);
  expect(new Set(result).size).toBe(result.length);
  return result;
}

function writePhysicalWitness(seed: number, kind: string, evidence: unknown): void {
  const output = process.env.R36_PROFILE_OUT;
  if (output) { mkdirSync(output, { recursive: true }); writeFileSync(join(output, `${seed}-${kind}.json`), JSON.stringify(evidence, null, 2) + '\n'); }
}

/** Profile fields identify members. Positions and ratios come from the real mass array. */
describe('R36 independent ordinary tower geometry', () => {
  it.each(SEEDS)('uses real 2-4 stages and parent-axis offsets at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = City.deriveCityMasses(layout), rows = City.deriveTowerProfiles(layout);
    expect(rows).toHaveLength(layout.towers.length);
    expect(new Set(rows.map(r => r.towerIndex)).size).toBe(layout.towers.length);
    let checked = 0;
    for (const row of rows) {
      const towerIndex = row.towerIndex, tower = layout.towers[towerIndex];
      if (!tower) throw new Error('R36_TOWER_INDEX_OUT_OF_RANGE');
      expect(row.towerKey).toBe(`tower:${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`);
      if (!eligible(row)) { expect(typeof row.eligibility.reason).toBe('string'); continue; }
      checked++;
      const stages = row.stages; expect(stages.length).toBeGreaterThanOrEqual(2); expect(stages.length).toBeLessThanOrEqual(4);
      const footprints = stages.map(stage => {
        const ids = memberIndices(stage.massIndices); expect(ids.length).toBeGreaterThan(0);
        return sectionUnionBounds(ids.map(i => {
          const mass = masses[i]; if (!mass) throw new Error(`R36_MASS_INDEX_OUT_OF_RANGE:${i}`);
          expect(mass.anchorV).toBe(tower.z);
          expect(mass.materialOwner).toBe(City.buildingSeedOf(tower.x, tower.z));
          expect(mass.building).toBe(City.buildingSeedOf(tower.x, tower.z));
          expect([mass.x, mass.z, mass.y0, mass.width, mass.height, mass.depth].every(Number.isFinite)).toBe(true);
          expect(Math.min(mass.width, mass.height, mass.depth)).toBeGreaterThan(0);
          return massSection(mass);
        }));
      });
      const footprintKeys = footprints.map(b => [b.x0, b.x1, b.z0, b.z1].map(x => x.toFixed(5)).join(':'));
      expect(new Set(footprintKeys).size).toBeGreaterThan(1);
      for (let i = 1; i < stages.length; i++) {
        const offset = stages[i]!.offset; if (offset === null) throw new Error('R36_UPPER_OFFSET_MISSING'); const axis = offset.axis;
        expect(['x', 'z']).toContain(axis);
        const parent = offset.parentKind === 'original-footprint' ? massSection(tower) : footprints[offset.parentStageIndex];
        if (!parent) throw new Error('R36_PARENT_STAGE_MISSING');
        if (offset.parentKind !== 'original-footprint') expect(offset.parentStageIndex).toBeLessThan(i);
        const child = footprints[i]!;
        const span = axis === 'x' ? parent.x1 - parent.x0 : parent.z1 - parent.z0;
        const delta = axis === 'x' ? (child.x0 + child.x1 - parent.x0 - parent.x1) / 2 : (child.z0 + child.z1 - parent.z0 - parent.z1) / 2;
        const ratio = Math.abs(delta) / span;
        if (ratio < .08 - 1e-7 || ratio > .33 + 1e-7) writePhysicalWitness(seed, 'offset', { towerIndex, stageIndex: i, axis, parent, child, span, delta, ratio,
          members: stages.map(stage => stage.massIndices.map(index => ({ index, mass: masses[index], polygon: physicalFootprint(artVolumeBox(masses[index]!, 0)) }))) });
        expect(ratio, `tower${towerIndex}:stage${i}`).toBeGreaterThanOrEqual(.08 - 1e-7);
        expect(ratio, `tower${towerIndex}:stage${i}`).toBeLessThanOrEqual(.33 + 1e-7);
        expect(offset.parentSpanM).toBeCloseTo(span, 5);
        expect(offset.deltaM).toBeCloseTo(delta, 5);
        expect(offset.ratio).toBeCloseTo(ratio, 7);
      }
    }
    expect(checked).toBe(layout.towers.length);
    if (seed === 424242) expect(checked).toBe(211);
  });

  it.each(SEEDS)('replaces the exposed body below the old roof and measures true families at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = City.deriveCityMasses(layout), rows = City.deriveTowerProfiles(layout).filter(eligible);
    let leanCount = 0;
    const families = new Set<string>();
    for (const row of rows) {
      const tower = layout.towers[row.towerIndex]!;
      const owner = City.buildingSeedOf(tower.x, tower.z);
      expect(row.building).toBe(owner); expect(row.materialOwner).toBe(owner);
      const members = masses.filter(m => m.materialOwner === owner && (m.anchorV ?? m.z) === tower.z && (m.layer ?? 0) === 0);
      const original = massSection(tower);
      const sections: string[] = [];
      let exposedReplacement = false;
      for (const stage of row.stages) {
        const actual = memberIndices(stage.massIndices).map(i => { const m = masses[i]; if (!m) throw new Error('R36_STAGE_MEMBER_MISSING'); return m; });
        const bound = sectionUnionBounds(actual.map(massSection));
        const measured = { x: (bound.x0 + bound.x1) / 2, z: (bound.z0 + bound.z1) / 2, width: bound.x1 - bound.x0, depth: bound.z1 - bound.z0 };
        for (const key of ['x', 'z', 'width', 'depth'] as const) expect(stage.footprint[key]).toBeCloseTo(measured[key], 8);
        const y0 = Math.min(...actual.map(m => m.y0)), y1 = Math.max(...actual.map(m => m.y0 + m.height));
        expect(stage.verticalBounds.y0).toBeCloseTo(y0, 8); expect(stage.verticalBounds.y1).toBeCloseTo(y1, 8); expect(stage.verticalBounds.height).toBeCloseTo(y1 - y0, 8);
        expect(y0).toBeLessThan(tower.height); expect(y1).toBeLessThanOrEqual(tower.height + 1e-7);
        const y = (Math.max(0, y0) + y1) / 2;
        expect(y).toBeLessThan(tower.height);
        const whole = members.filter(m => m.y0 < y && m.y0 + m.height > y);
        sections.push(JSON.stringify(canonicalPhysicalSectionUnion(whole)));
        if (physicalSectionUnionArea(whole, original) < tower.width * tower.depth - 1e-6) exposedReplacement = true;
      }
      expect(exposedReplacement, `tower${row.towerIndex}:root-masks-stages`).toBe(true);
      expect(new Set(sections).size, `tower${row.towerIndex}:hidden-stage-changes`).toBeGreaterThan(1);
      families.add(row.family);
      if (row.family === 'thin-slab-companion') {
        expect(row.companionMassIndices.length).toBeGreaterThan(0);
        for (const i of row.companionMassIndices) {
          const m = masses[i]; if (!m) throw new Error('R36_COMPANION_MISSING');
          expect(m.building).toBe(owner);
          expect(Math.abs(m.x - tower.x) + Math.abs(m.z - tower.z)).toBeGreaterThan(0);
          expect(m.y0 + m.height).toBeLessThan(tower.height);
          expect(roofBoxesConflict(independentMassRoofBox(m), independentMassRoofBox(masses[row.stages[0]!.massIndices[0]!]!))).toBe(false);
        }
      }
      if (row.family === 'broad-shelf') {
        const upper = row.stages.at(-1)!;
        const lower = row.stages[0]!.footprint, middle = row.stages[1]!.footprint;
        if (!(middle.width > lower.width || middle.depth > lower.depth)) writePhysicalWitness(seed, 'shelf', { towerIndex: row.towerIndex, lower, middle,
          stages: row.stages.map(stage => ({ bounds: sectionUnionBounds(stage.massIndices.map(index => massSection(masses[index]!))), members: stage.massIndices.map(index => ({ index, mass: masses[index], polygon: physicalFootprint(artVolumeBox(masses[index]!, 0)) })) })) });
        expect(middle.width > lower.width || middle.depth > lower.depth, `tower${row.towerIndex}:no-broad-middle-shelf`).toBe(true);
        expect(middle.width * middle.depth).toBeGreaterThan(upper.footprint.width * upper.footprint.depth);
      }
      if (row.lean !== null) {
        leanCount++;
        const first = row.stages[0]!, last = row.stages.at(-1)!;
        const delta = Math.abs(last.footprint.z - first.footprint.z), rise = last.verticalBounds.y1 - row.stages[1]!.verticalBounds.y0;
        const angle = Math.atan2(delta, rise) * 180 / Math.PI;
        expect(angle).toBeGreaterThanOrEqual(4); expect(angle).toBeLessThanOrEqual(6);
        expect(row.lean.riseM).toBeCloseTo(rise, 6); expect(row.lean.totalOffsetM).toBeCloseTo(delta, 6);
        expect(row.lean.angleDeg).toBeCloseTo(angle, 1);
        expect(row.stages.slice(1).every(s => s.offset?.axis === row.lean?.axis)).toBe(true);
      }
    }
    expect(families.size).toBe(4); expect(leanCount).toBeGreaterThan(0); expect(leanCount / rows.length).toBeLessThanOrEqual(.15);
  });

  it.each(SEEDS)('has exposed grime wing air of at least 8 m beside a continuous narrow spine at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = City.deriveCityMasses(layout), rows = City.deriveTowerProfiles(layout).filter(eligible);
    let grimeWings = 0;
    const actualBoxes = masses.map(independentMassRoofBox), query = supportConflictQuery(actualBoxes);
    for (const row of rows.filter(r => r.family === 'supported-spine')) {
      if (row.supportSpineIndex === null) throw new Error('R36_SPINE_MISSING');
      const spine = masses[row.supportSpineIndex]; if (!spine) throw new Error('R36_SPINE_INDEX_INVALID');
      const wings = memberIndices(row.stages[0]!.massIndices).map(i => {
        const mass = masses[i]; if (!mass) throw new Error('R36_GRIME_WING_MEMBER_MISSING'); return mass;
      }).filter(m => m.y0 + m.height < 600 && (m.yawWingPart === undefined || m.yawWingPart.part === 'roof'));
      expect(row.stages[0]!.massIndices.length).toBeGreaterThanOrEqual(2);
      const support = physicalTowerStageSupport(row.stages.map(stage => stage.massIndices.map(index => masses[index]!)), spine);
      expect(support.errors, `tower${row.towerIndex}:stage-spine-paths`).toEqual([]);
      for (const wing of wings) {
        grimeWings++;
        const roof = wing.y0 + wing.height;
        if (!(spine.width * spine.depth < wing.width * wing.depth * .25)) writePhysicalWitness(seed, 'wing', { towerIndex: row.towerIndex, spine, wing,
          spinePolygon: physicalFootprint(artVolumeBox(spine, 0)), wingPolygon: physicalFootprint(artVolumeBox(wing, 0)), spineArea: spine.width * spine.depth, wingArea: wing.width * wing.depth });
        expect(spine.width * spine.depth).toBeLessThan(wing.width * wing.depth * .25);
        const owner = City.buildingSeedOf(wing.x, wing.z);
        const air = addedVolumeCells({ ...artVolumeBox(wing, owner), y0: roof, height: 8 }, [{ ...artVolumeBox(spine, owner), y0: roof, height: 8 }]);
        expect(air.reduce((sum, cell) => sum + cell.volumeM3, 0)).toBeGreaterThan(0);
        const hits = addedVolumeConflicts(air, query, new Set(), actualBoxes);
        expect(hits.map(hit => hit.blockerIndex), `tower${row.towerIndex}:grime-wing-air`).toEqual([]);
        expect(retainedMassContact(independentMassRoofBox(wing), independentMassRoofBox(spine)), `tower${row.towerIndex}:wing-spine-contact`).not.toBeNull();
        expect(spine.y0).toBeLessThanOrEqual(wing.y0); expect(spine.y0 + spine.height).toBeGreaterThanOrEqual(roof + 8);
      }
    }
    expect(grimeWings, 'No actual grime deck wing can be tested').toBeGreaterThan(0);
  });

  it.each(SEEDS)('backs every cached facade rectangle with actual emitted box surface at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = City.deriveCityMasses(layout), faces = City.deriveFacadeFaces(layout);
    const errors: string[] = [], hosts = masses.map(mass => ({ mass, box: independentMassRoofBox(mass) }));
    for (const face of faces) {
      const requested = { x0: face.u0, x1: face.u1, z0: face.y0, z1: face.y1 };
      const { rectangles } = physicalFacadeRectangles(face, hosts, requested);
      const area = (face.u1 - face.u0) * (face.y1 - face.y0), covered = sectionUnionArea(rectangles);
      if (!(area > 0) || Math.abs(covered - area) > Math.max(1e-7, area * 1e-10)) errors.push(`${face.id}:unbacked-area=${area - covered}`);
    }
    expect(errors).toEqual([]);
  });

  it.each(SEEDS)('has 20%±5 split crowns with real clear notches at seed %i', seed => {
    const layout = presentCityLayout(deriveCityLayout(seed)), masses = City.deriveCityMasses(layout), rows = City.deriveTowerProfiles(layout).filter(eligible);
    let split = 0;
    for (const row of rows) {
      const crown = row.crown; if (crown.kind !== 'split') continue; split++;
      const ids = memberIndices(crown.massIndices); expect(ids).toHaveLength(2);
      const a = masses[ids[0]!], b = masses[ids[1]!]; if (!a || !b) throw new Error('R36_CROWN_MEMBER_MISSING');
      const tower = layout.towers[row.towerIndex]!;
      const aa = sourceBoxSection(a), bb = sourceBoxSection(b), bound = sectionUnionBounds([aa, bb]);
      expect(['x', 'z']).toContain(crown.axis);
      const axisX = crown.axis === 'x';
      const low = axisX ? Math.min(aa.x1, bb.x1) : Math.min(aa.z1, bb.z1);
      const high = axisX ? Math.max(aa.x0, bb.x0) : Math.max(aa.z0, bb.z0);
      const gap = high - low, span = axisX ? bound.x1 - bound.x0 : bound.z1 - bound.z0;
      expect(gap / span).toBeGreaterThanOrEqual(.15 - 1e-7);
      expect(crown.gapM).toBeCloseTo(gap, 5); expect(crown.crownSpanM).toBeCloseTo(span, 5);
      const x0 = axisX ? low : Math.max(aa.x0, bb.x0), x1 = axisX ? high : Math.min(aa.x1, bb.x1);
      const z0 = axisX ? Math.max(aa.z0, bb.z0) : low, z1 = axisX ? Math.min(aa.z1, bb.z1) : high;
      const y0 = Math.max(a.y0, b.y0), y1 = Math.min(a.y0 + a.height, b.y0 + b.height);
      expect(Math.min(x1 - x0, z1 - z0, y1 - y0)).toBeGreaterThan(0);
      const prism = independentMassRoofBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y0, width: x1 - x0, depth: z1 - z0, height: y1 - y0, tint: tower.tint, anchorV: tower.z, yawRad: a.yawRad, yawAnchor: a.yawAnchor });
      const hits = masses.flatMap((m, index) => roofBoxesConflict(prism, independentMassRoofBox(m)) ? [index] : []);
      expect(hits, `tower${row.towerIndex}:notch`).toEqual([]);
    }
    expect(split / rows.length).toBeGreaterThanOrEqual(.15);
    expect(split / rows.length).toBeLessThanOrEqual(.25);
  });

  it('measures rotated canyon spans and excludes false prism corners', () => {
    const rectangle = { x: 0, z: 0, width: 12, depth: 4, y0: 0, height: 2, tint: 1 };
    expect(massSection(rectangle)).toEqual({ x0: -6, x1: 6, z0: -2, z1: 2 });
    const turned = { ...rectangle, yawRad: Math.PI / 4, yawAnchor: { x: 1, z: 2 } };
    const bounds = massSection(turned), centreX = 1 - 3 / Math.SQRT2, centreZ = 2 - 1 / Math.SQRT2;
    expect(bounds.x0).toBeCloseTo(centreX - 8 / Math.SQRT2, 10);
    expect(bounds.x1).toBeCloseTo(centreX + 8 / Math.SQRT2, 10);
    expect(bounds.z0).toBeCloseTo(centreZ - 8 / Math.SQRT2, 10);
    expect(bounds.z1).toBeCloseTo(centreZ + 8 / Math.SQRT2, 10);
    const square = { ...rectangle, width: 4, depth: 4, yawRad: Math.PI / 4 };
    expect(massIntersectsPrism(square, { x0: 2.5, x1: 2.7, z0: 2.5, z1: 2.7, y0: 0, y1: 1 })).toBe(false);
    expect(massIntersectsPrism(square, { x0: 2.5, x1: 2.7, z0: -.1, z1: .1, y0: 0, y1: 1 })).toBe(true);
    expect(massIntersectsPrism(square, { x0: -1, x1: 1, z0: -1, z1: 1, y0: 2, y1: 3 })).toBe(false);
  });

  it('uses true rotated wing-air cells after the broad query', () => {
    const air = { x: 0, z: 0, y0: 2, width: 4, depth: 4, height: 8, owner: 1, anchorV: 0, yawRad: Math.PI / 4 };
    const cells = addedVolumeCells(air, []), boxes = cells.map(cell => ({ ...addedCellRoofBox(cell), cell })), query = roofConflictQuery(boxes);
    const box = { x: 2.6, z: 2.6, y: 3, hx: .1, hy: .1, hz: .1, c: 1, s: 0 };
    expect(query(box)).toEqual([]);
    expect(query({ ...box, z: 0 })).toEqual([0]);
    expect(query({ ...box, z: 0, y: 10.1 })).toEqual([]);
  });

  it('keeps the official ten tower IDs and uses geometry-only fingerprints', () => {
    const layout = presentCityLayout(deriveCityLayout(cohort.seed)), masses = City.deriveCityMasses(layout), rows = City.deriveTowerProfiles(layout);
    const prints: string[] = [];
    for (const saved of cohort.towers) {
      expect(layout.towers[saved.towerIndex]).toEqual(saved.source);
      const row = rows.find(r => r.towerIndex === saved.towerIndex); if (!row) throw new Error('R36_OFFICIAL_TOWER_MISSING');
      expect(eligible(row)).toBe(true);
      if (!eligible(row)) throw new Error('R36_OFFICIAL_TOWER_EXCLUDED');
      const ownerMasses = masses.filter(m => m.materialOwner === row.materialOwner && (m.anchorV ?? m.z) === saved.source.z && (m.layer ?? 0) === 0);
      const geometry = normalizedExposedTowerGeometry(ownerMasses, saved.source);
      prints.push(createHash('sha256').update(JSON.stringify(geometry)).digest('hex'));
      const changedMetadata = ownerMasses.map(m => ({ ...m, tint: m.tint + 1, building: .2, materialOwner: .7 }));
      expect(normalizedExposedTowerGeometry(changedMetadata, saved.source)).toEqual(geometry);
    }
    expect(new Set(prints).size).toBe(10);
  });

  it('rejects union-area and fingerprint controls without identity fields', () => {
    const a = { x0: 0, x1: 10, z0: 0, z1: 10 };
    expect(sectionUnionArea([a, { x0: 5, x1: 15, z0: 0, z1: 10 }])).toBe(150);
    expect(sectionUnionArea([a, a])).toBe(100);
    const tower = { x: 0, z: 0, width: 100, depth: 80, height: 1000 };
    const m: City.SkyriverMass = { ...tower, y0: 0, tint: 1 };
    expect(normalizedTowerGeometry([m], tower)).toEqual(normalizedTowerGeometry([{ ...m, tint: 99, materialOwner: .99 }], tower));
    expect(normalizedExposedTowerGeometry([{ ...m, yawRad: Math.PI / 4 }], tower)).not.toEqual(normalizedExposedTowerGeometry([m], tower));
    expect(physicalSectionUnionArea([{ ...m, yawRad: Math.PI / 4 }])).toBeCloseTo(m.width * m.depth, 8);
    expect(normalizedTowerGeometry([m], tower)).not.toEqual(normalizedTowerGeometry([{ ...m, x: 8 }], tower));
    const hidden = { ...m, y0: 200, height: 200, width: 20, depth: 20 };
    expect(normalizedExposedTowerGeometry([m, hidden], tower)).toEqual(normalizedExposedTowerGeometry([m], tower));
  });

  it('measures a connected drawn roof deck and rejects missing or displaced connectors', () => {
    const source: City.SkyriverMass = { x: 0, z: -12, y0: 0, width: 40, depth: 16, height: 100, tint: 1, materialOwner: 1, anchorV: 0 };
    const body = { ...source, width: 10, depth: 4, yawRad: Math.PI / 6 };
    const spine = { ...source, z: 0, width: 4, depth: 8, height: 108 };
    const collar = { ...source, y0: 96, height: 4 };
    const facts = physicalDeckSection([body], [collar], spine, 100);
    expect(facts.errors).toEqual([]);
    expect(facts.bodyArea).toBeCloseTo(40, 10); expect(facts.deckArea).toBeCloseTo(640, 10);
    expect(facts.bodySpineShare).toBeCloseTo(.8, 10); expect(facts.deckSpineShare).toBeCloseTo(.05, 10);
    expect(deckMemberContainmentFailures(body, source)).toEqual([]);
    expect(deckMemberContainmentFailures(collar, source)).toEqual([]);
    for (const connectors of [[], [{ ...collar, z: -13 }], [{ ...collar, y0: 95 }], [{ ...collar, x: 22 }]]) {
      const failed = physicalDeckSection([body], connectors, spine, 100);
      expect(failed.errors).toContain('body0:spine-path');
      expect(failed.errors).toContain('spine-share');
      expect(failed.deckArea).toBeCloseTo(failed.bodyArea, 10);
    }
    expect(deckMemberContainmentFailures({ ...collar, x: 1 }, source)).toContain('source-footprint');
    const blocker = independentMassRoofBox({ ...source, x: 15, width: 1, depth: 1, y0: 100, height: 1 });
    const query = supportConflictQuery([blocker]);
    expect(addedVolumeConflicts(physicalDeckRoofAir([body], spine, 100), query, new Set(), [blocker])).toEqual([]);
    expect(addedVolumeConflicts(physicalDeckRoofAir(facts.members, spine, 100), query, new Set(), [blocker]).map(hit => hit.blockerIndex)).toContain(0);
    const upper = { ...source, z: 0, y0: 100, height: 20, width: 10, depth: 10 };
    const top = { ...upper, y0: 120, width: 8, depth: 8 };
    const support = physicalTowerStageSupport([[body], [upper], [top]], spine, [collar]);
    expect(support.errors).toEqual([]);
    expect(support.adjacentContacts[1]).toEqual([{ lowerIndex: 0, upperIndex: 0, contact: 'roof-face' }]);
    expect(physicalTowerStageSupport([[body], [upper], [{ ...top, x: 30 }]], spine, [collar]).errors).toContain('stage2:member0:spine-path');
  });
});
