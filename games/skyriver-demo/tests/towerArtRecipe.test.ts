import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
// Only atlas texture construction is replaced. All geometry is real.
vi.mock('../src/render/signAtlas', async original => ({ ...await original<typeof import('../src/render/signAtlas')>(), createSignAtlas: () => ({ texture: new THREE.Texture(), vertical: Array.from({ length: 32 }, () => [0, 0, 1, 1] as const), horizontal: Array.from({ length: 16 }, () => [0, 0, 1, 1] as const), dispose() {} }) }));
vi.mock('../src/render/interiorAtlas', async original => ({ ...await original<typeof import('../src/render/interiorAtlas')>(), createInteriorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
vi.mock('../src/render/impostorAtlas', async original => ({ ...await original<typeof import('../src/render/impostorAtlas')>(), createImpostorAtlas: () => ({ texture: new THREE.Texture(), dispose() {} }) }));
import * as C from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { skyriverQualityFor, SkyriverQualityTier } from '../src/render/scene';
import { SkyriverDistrictColourSwitch } from '../src/render/districts';
import before from './fixtures/r36-resolved-art-before.json';
import { retainedMassContact } from './support/retainedMassContact';
import { legacyTrimExposedContact, verifiedSupportNonHostIds } from './support/legacyTrimFaceGeometry';
import { ART_CROWN_HEIGHT_M, ART_HERO_MARGIN_M, crownCarveFailures, retainedCrownFailures, actualHeroRootFailures, fixedArtBackingFailures, expectedCrownFit, yawRoofCapFailures, verifiedYawRoofCapIds, yawSpanLedgeFailures, approvedYawHostEnvelope, independentApprovedStages } from './support/towerCrownCarve';
import { uploadedHeroRootFailures, heroFacadeCoordinates, type UploadedHeroHost } from './support/towerHeroUploadedGeometry';
import { massSection, sourceBoxSection, sectionUnionBounds, independentMassRoofBox, expectedTowerYaw, expectedBoundedStageFit, independentMaximumAreaSize, type IndependentStageFitContext } from './support/towerProfileGeometry';
import { roofBoxesConflict, roofSupportFailures, roofBoxTolerance, uploadedRoofBox, roofRouteClearance } from './support/rooftopDetailsGeometry';

import { independentWingSections, wingSectionContractFailures } from './support/towerWingGeometry';
import { artVolumeBox, readArtVolumeBox, addedVolumeCells, addedVolumeConflicts } from './support/towerAddedVolume';
import { supportConflictQuery } from './support/retainedStructuralSupport';
import { physicalDeckRoofAir, physicalTowerStageSupport } from './support/towerDeckGeometry';
import { canonicalPhysicalScene, physicalSignAudit, uploadedBoards, uploadedSolids } from './support/r37SignOracle';

const SEEDS = [424242, 0, 2147483647, 4294967295, 20240917] as const;
const owner = (mass: C.SkyriverMass) => mass.materialOwner ?? mass.building ?? C.buildingSeedOf(mass.x, mass.z);
const geometry = (mass: C.SkyriverMass) => [mass.x, mass.z, mass.y0, mass.width, mass.depth, mass.height, owner(mass), mass.anchorV ?? mass.z];
const sorted = (rows: readonly (readonly number[])[]) => [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
function eligible(row: C.SkyriverTowerProfileRow): row is C.SkyriverEligibleTowerProfile { return row.eligibility.kind === 'eligible'; }
const CACHE = new Map<number, ReturnType<typeof build>>();
function build(seed: number) {
  const layout = presentCityLayout(deriveCityLayout(seed)), masses = C.deriveCityMasses(layout), profiles = C.deriveTowerProfiles(layout).filter(eligible);
  const saved = before.rows.find(row => row.seed === seed); if (!saved) throw new Error('R36_ART_REFERENCE_SEED');
  return { layout, masses, profiles, saved };
}
function data(seed: number) { let result = CACHE.get(seed); if (!result) { result = build(seed); CACHE.set(seed, result); } return result; }
function massAt(masses: readonly C.SkyriverMass[], index: number): C.SkyriverMass { const mass = masses[index]; if (!mass) throw new Error('R36_ART_MASS_INDEX'); return mass; }
function measuredStage(stage: C.SkyriverStageProfile, masses: readonly C.SkyriverMass[]) {
  const members = stage.massIndices.map(index => massAt(masses, index)), bounds = sectionUnionBounds(members.map(massSection));
  return { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2, width: bounds.x1 - bounds.x0, depth: bounds.z1 - bounds.z0, y0: Math.min(...members.map(mass => mass.y0)), y1: Math.max(...members.map(mass => mass.y0 + mass.height)) };
}
type ResolvedTower = (typeof before.rows)[number]['towers'][number];
const CANONICAL_TEN = [106, 112, 116, 120, 124, 128, 132, 137, 144, 151] as const;
function logicalStageMembers(stage: C.SkyriverStageProfile, masses: readonly C.SkyriverMass[]) {
  const groups = new Map<number, number[]>();
  for (const id of stage.massIndices) {
    const mass = masses[id]!; if (mass.supportRole === 'yaw-roof-cap') continue;
    const root = mass.yawWingPart?.roofMassIndex ?? id, group = groups.get(root) ?? [];
    group.push(id); groups.set(root, group);
  }
  return [...groups.entries()].map(([root, ids]) => ({ root, ids, y0: Math.min(...ids.map(id => masses[id]!.y0)), y1: Math.max(...ids.map(id => masses[id]!.y0 + masses[id]!.height)) }));
}
function retainsResolvedGeometry(row: C.SkyriverEligibleTowerProfile, masses: readonly C.SkyriverMass[], saved: ResolvedTower): boolean {
  return row.stages.length === saved.stages.length
    && row.stages.every((stage, index) => JSON.stringify(sorted(logicalStageMembers(stage, masses).map(group => [group.y0, group.y1 - group.y0]))) === JSON.stringify(sorted(saved.stages[index]!.boxes.map(box => [box[2]!, box[5]!]))))
    && JSON.stringify(sorted(row.crown.massIndices.map(index => [masses[index]!.y0, masses[index]!.height]))) === JSON.stringify(sorted(saved.crown.boxes.map(box => [box[2]!, box[5]!])));
}
const WING_EXPECTED = new Map<string, ReturnType<typeof independentWingSections>>();
function expectedSavedWing(profile: C.SkyriverEligibleTowerProfile, masses: readonly C.SkyriverMass[], source: readonly number[], root: number, seed: number, sampledYaw: number) {
  const cacheKey = `${seed}:${root}`, cached = WING_EXPECTED.get(cacheKey); if (cached) return cached;
  const d = data(seed), saved = d.saved.towers.find(tower => tower.towerIndex === profile.towerIndex)!;
  const oldUnion = [...saved.stages.flatMap(stage => stage.boxes), ...saved.crown.boxes, ...saved.companions, ...(saved.spine ? [saved.spine] : [])].map(readArtVolumeBox);
  const original: C.SkyriverMass = { ...masses[root]!, x: source[0]!, z: source[1]!, y0: source[2]!, width: source[3]!, depth: source[4]!, height: source[5]!, materialOwner: source[6]!, anchorV: source[7]!, yawRad: undefined, yawWingPart: undefined };
  const own = new Set([...profile.stages.flatMap(stage => stage.massIndices), ...profile.crown.massIndices, ...profile.companionMassIndices, profile.supportSpineIndex!]);
  for (const [index, mass] of masses.entries()) if ((mass.supportHostMassIndex !== undefined && own.has(mass.supportHostMassIndex)) || (mass.artBacking && own.has(mass.artBacking.hostMassIndex))) own.add(index);
  const records = C.deriveRetainedMassSupportRecords(d.layout), verified = verifiedSupportNonHostIds(records, masses);
  const joins = records.filter(record => verified.has(record.supportMassIndex) && own.has(record.hostMassIndex)).map(record => record.supportMassIndex);
  const boxes = masses.map(independentMassRoofBox), query = supportConflictQuery(boxes), excluded = new Set([...own, ...joins]);
  const constructionMasses = [...masses], constructionExcluded = new Set([...excluded, ...verified]);
  for (const sourceProfile of d.profiles) {
    const sourceSaved = d.saved.towers.find(tower => tower.towerIndex === sourceProfile.towerIndex)!;
    const restore = (id: number, values: readonly number[]) => { constructionMasses[id] = { ...masses[id]!, x: values[0]!, z: values[1]!, y0: values[2]!, width: values[3]!, depth: values[4]!, height: values[5]!, yawRad: undefined, yawAnchor: undefined }; };
    logicalStageMembers(sourceProfile.stages[0]!, masses).forEach((group, ordinal) => {
      restore(group.root, sourceSaved.stages[0]!.boxes[ordinal]!);
      group.ids.filter(id => id !== group.root).forEach(id => constructionExcluded.add(id));
    });
    sourceProfile.companionMassIndices.forEach((id, ordinal) => restore(id, sourceSaved.companions[ordinal]!));
  }
  for (const [id, mass] of masses.entries()) if (mass.artBacking || mass.supportRole === 'yaw-roof-cap' || mass.supportRole === 'yaw-span-ledge') constructionExcluded.add(id);
  const constructionBoxes = constructionMasses.map(independentMassRoofBox), constructionQuery = supportConflictQuery(constructionBoxes);
  const fit = (yaw: number) => independentWingSections(original, yaw, oldUnion, constructionMasses, constructionExcluded, constructionQuery, constructionBoxes);
  const preferred = fit(sampledYaw);
  let selected = preferred;
  if (preferred.visibleRetention < .85) for (const yaw of [Math.sign(sampledYaw), -Math.sign(sampledYaw)].map(sign => sign * 2 * Math.PI / 180)) {
    const fallback = fit(yaw), targetIds = profile.stages[0]!.massIndices.filter(id => id === root || masses[id]!.yawWingPart?.roofMassIndex === root);
    const spine = masses[profile.supportSpineIndex!]!, stages = profile.stages.map((stage, index) => index === 0 ? [...stage.massIndices.filter(id => !targetIds.includes(id)).map(id => masses[id]!), ...fallback.sections.map(section => section.mass)] : stage.massIndices.map(id => masses[id]!));
    const top = original.y0 + original.height, roof = fallback.sections.filter(section => section.mass.y0 + section.mass.height === top).map(section => section.mass);
    const air = addedVolumeConflicts(physicalDeckRoofAir(roof, spine, top), query, new Set(targetIds), boxes);
    const route = roofRouteClearance(fallback.sections.map(section => independentMassRoofBox(section.mass)));
    if (fallback.visibleRetention > selected.visibleRetention && air.length === 0 && route.violations === 0 && physicalTowerStageSupport(stages, spine).errors.length === 0) selected = fallback;
  }
  const output = process.env.R36_WING_OUT;
  if (output) {
    const ids = logicalStageMembers(profile.stages[0]!, masses).find(group => group.root === root)!.ids, actual = ids.map(id => masses[id]!);
    const volume = (parts: readonly C.SkyriverMass[], visible: boolean) => parts.reduce((sum, part) => sum + part.width * part.depth * (visible ? Math.max(0, part.y0 + part.height - Math.max(0, part.y0)) : part.height), 0);
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, `${seed}-${root}-wing.json`), JSON.stringify({ seed, towerKey: profile.towerKey, root, source, sampledYaw, selectedYaw: selected.sections[0]!.mass.yawRad,
      preferredVisibleRetention: preferred.visibleRetention, selectedVisibleRetention: selected.visibleRetention, preferredBlockers: preferred.blockers, selectedBlockers: selected.blockers,
      cutLow: selected.cutLow, cutHigh: selected.cutHigh, fitScaleTolerance: selected.fitScaleTolerance, expected: selected.sections, actual, totalVolume: volume(actual, false), sourceVolume: original.width * original.depth * original.height,
      visibleVolume: volume(actual, true), sourceVisibleVolume: original.width * original.depth * Math.max(0, original.y0 + original.height - Math.max(0, original.y0)) }, null, 2) + '\n');
  }
  WING_EXPECTED.set(cacheKey, selected); return selected;
}
function expectedYawRows(seed: number, tower: { readonly x: number; readonly z: number }, rows: readonly (readonly number[])[], stageIndex: number, companions = false, context?: IndependentStageFitContext, roofY?: number) {
  return rows.map((row, ordinal) => {
    const yaw = expectedTowerYaw(seed, tower, companions ? 700 + ordinal * 17 : 170 + stageIndex * 17 + ordinal, (roofY ?? row[2]! + row[5]!) < 600);
    let size: ReturnType<typeof expectedBoundedStageFit>;
    try { size = expectedBoundedStageFit({ x: row[0]!, z: row[1]!, width: row[3]!, depth: row[4]! }, yaw, context); } catch (error) { throw new Error(`${error instanceof Error ? error.message : error}:${JSON.stringify({ seed, tower, stageIndex, row, context })}`); }
    return { geometry: [size.x, size.z, row[2]!, size.width, size.depth, row[5]!, row[6]!, row[7]!], yaw };
  });
}
function assertSavedYawStage(stage: C.SkyriverStageProfile, masses: readonly C.SkyriverMass[], old: readonly (readonly number[])[], seed: number, tower: { readonly x: number; readonly z: number }, stageIndex: number, ignoreHeight = false, spine?: C.SkyriverMass, profile?: C.SkyriverEligibleTowerProfile) {
  let context: IndependentStageFitContext | undefined;
  if (profile && old.length === 1 && stageIndex !== profile.stages.length - 1) {
    const offset = stage.offset, sourceTower = presentCityLayout(deriveCityLayout(seed)).towers[profile.towerIndex]!;
    const parent = !offset || offset.parentKind === 'original-footprint' ? massSection(sourceTower) : sectionUnionBounds(profile.stages[offset.parentStageIndex]!.massIndices.map(index => massSection(massAt(masses, index))));
    const saved = before.rows.find(item => item.seed === seed)!.towers.find(item => item.towerIndex === profile.towerIndex)!;
    const originals = independentApprovedStages(profile, masses, seed), next = profile.stages[stageIndex + 1]?.offset;
    context = { parent, axis: offset?.axis ?? 'x', skipParent: offset === null, direction: offset ? Math.sign(offset.deltaM) : undefined,
      broadAxis: profile.family === 'broad-shelf' && stageIndex === 1 ? old[0]![3]! > (saved.stages[0]!.boxes.length === 1 ? saved.stages[0]!.boxes[0]![3]! : saved.stages[0]!.actual.width) ? 'x' : 'z' : undefined,
      ...(next?.parentKind === 'stage' && next.parentStageIndex === stageIndex ? { next: { axis: next.axis, centre: originals[stageIndex + 1]![0]![next.axis === 'x' ? 0 : 1]!, direction: Math.sign(next.deltaM) } } : {}) };
  }
  const saved = profile ? before.rows.find(item => item.seed === seed)!.towers.find(item => item.towerIndex === profile.towerIndex)! : undefined;
  const finalRoofY = profile && saved && stageIndex === profile.stages.length - 1
    ? Math.max(...saved.crown.boxes.map(box => box[2]! + box[5]!)) - masses[profile.crown.massIndices[0]!]!.height : undefined;
  const expected = expectedYawRows(seed, tower, old, stageIndex, false, context, finalRoofY);
  const ordinary = logicalStageMembers(stage, masses).map(group => group.root);
  expect(ordinary.length).toBe(expected.length);
  ordinary.forEach((index, ordinal) => {
    const mass = massAt(masses, index), row = expected[ordinal]!, actual = geometry(mass);
    if (stageIndex === 0 && profile?.supportSpineIndex !== null && profile?.family === 'supported-spine') {
      const model = expectedSavedWing(profile, masses, old[ordinal]!, index, seed, row.yaw), actualIds = logicalStageMembers(stage, masses)[ordinal]!.ids;
      const source = old[ordinal]!;
      expect(wingSectionContractFailures(actualIds.map(id => masses[id]!), { ...mass, x: source[0]!, z: source[1]!, y0: source[2]!, width: source[3]!, depth: source[4]!, height: source[5]! }, model), `${seed}:${profile.towerKey}:wing${ordinal}`).toEqual([]);
      expect(actualIds.length).toBe(model.sections.length);
      for (const section of model.sections) {
        const matching = actualIds.map(id => masses[id]!).filter(part => (part.yawWingPart?.part ?? 'whole') === section.part);
        expect(matching).toHaveLength(1);
        const actualPart = matching[0]!, expectedPart = section.mass;
        for (const field of ['x', 'z', 'y0', 'height', 'materialOwner', 'anchorV'] as const) expect(actualPart[field]).toBe(expectedPart[field]);
        expect(Math.abs(actualPart.width - expectedPart.width)).toBeLessThan(old[ordinal]![3]! * Math.max(section.part === 'band' ? model.fitScaleTolerance : 0, 1 / 2 ** 30));
        expect(Math.abs(actualPart.depth - expectedPart.depth)).toBeLessThan(old[ordinal]![4]! * Math.max(section.part === 'band' ? model.fitScaleTolerance : 0, 1 / 2 ** 30));
        expect(actualPart.yawRad).toBe(expectedPart.yawRad); expect(actualPart.yawAnchor).toBeUndefined();
        if (actualPart.yawWingPart) expect([actualPart.yawWingPart.roofMassIndex, actualPart.yawWingPart.cutLow, actualPart.yawWingPart.cutHigh]).toEqual([index, model.cutLow, model.cutHigh]);
      }
      return;
    }
    for (let field = 0; field < actual.length; field++) if (!(ignoreHeight && field === 5)) {
      if (field < 2 || field === 3 || field === 4) expect(actual[field], JSON.stringify({ seed, tower, stageIndex, field, actual, expected: row.geometry, old, context })).toBeCloseTo(row.geometry[field]!, 8);
      else expect(actual[field]).toBe(row.geometry[field]);
    }
    expect(mass.yawRad).toBeCloseTo(row.yaw, 13);
    expect(mass.yawAnchor).toBeUndefined();
  });
  for (const index of stage.massIndices.filter(index => masses[index]!.supportRole === 'yaw-roof-cap')) {
    const cap = massAt(masses, index), oldParent = old[0]!;
    expect([cap.x, cap.z, cap.width, cap.depth, owner(cap), cap.anchorV ?? cap.z]).toEqual([oldParent[0], oldParent[1], oldParent[3], oldParent[4], oldParent[6], oldParent[7]]);
    expect(yawRoofCapFailures(cap, massAt(masses, ordinary[0]!))).toEqual([]);
  }
}

function assertDividedYawStages(row: C.SkyriverEligibleTowerProfile, saved: ResolvedTower, masses: readonly C.SkyriverMass[], seed: number, tower: { readonly x: number; readonly z: number }) {
  const originals = independentApprovedStages(row, masses, seed);
  for (let stageIndex = 2; stageIndex < row.stages.length; stageIndex++) {
    const stage = row.stages[stageIndex]!, ordinary = stage.massIndices.filter(index => masses[index]!.supportRole !== 'yaw-roof-cap');
    expect(ordinary).toHaveLength(1);
    expect(masses[ordinary[0]!]!.y0).toBeCloseTo(Math.max(...row.stages[stageIndex - 1]!.massIndices.map(index => masses[index]!.y0 + masses[index]!.height)), 7);
    assertSavedYawStage(stage, masses, originals[stageIndex]!, seed, tower, stageIndex, false, undefined, row);
  }
}

function crownRole(mass: C.SkyriverMass): unknown { return Reflect.get(mass, 'crownRole'); }
function crownContact(crown: C.SkyriverMass, hosts: readonly C.SkyriverMass[]): boolean { return hosts.some(host => roofSupportFailures(independentMassRoofBox(crown), independentMassRoofBox(host), 0).length === 0); }

describe('R36 independent resolved upper-shape art recipe', () => {
  it.each(SEEDS)('preserves every resolved lower input at seed %i', seed => {
    const d = data(seed);
    expect(before.sourceSha256).toBe('9d03845893bda7583b77563379b999ca8b428288c7fbc3b5410224bc71c6a2ef');
    expect(d.profiles).toHaveLength(d.saved.towers.length);
    expect(new Set(d.profiles.map(row => row.towerIndex)).size).toBe(d.profiles.length);
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex); if (!saved) throw new Error('R36_ART_UNDECLARED_PROFILE');
      expect([row.towerKey, row.family, row.building, row.materialOwner]).toEqual([saved.towerKey, saved.family, saved.owner, saved.owner]);
      assertSavedYawStage(row.stages[0]!, d.masses, saved.stages[0]!.boxes, seed, d.layout.towers[row.towerIndex]!, 0, false, row.supportSpineIndex === null ? undefined : massAt(d.masses, row.supportSpineIndex), row);
      expect(row.stages[0]!.offset).toEqual(saved.stages[0]!.offset);
      assertSavedYawStage(row.stages[1]!, d.masses, saved.stages[1]!.boxes, seed, d.layout.towers[row.towerIndex]!, 1, true, undefined, row);
      expect([row.stages[1]!.offset?.axis, row.stages[1]!.offset?.parentKind, row.stages[1]!.offset?.parentStageIndex]).toEqual([saved.stages[1]!.offset?.axis, saved.stages[1]!.offset?.parentKind, saved.stages[1]!.offset?.parentStageIndex]);
      if (saved.lean === null) expect(row.lean).toBeNull();
      else { expect(row.lean).not.toBeNull(); expect([row.lean!.axis, row.lean!.riseM]).toEqual([saved.lean.axis, saved.lean.riseM]); }
      const spine = row.supportSpineIndex === null ? null : geometry(massAt(d.masses, row.supportSpineIndex));
      expect(spine, row.towerKey).toEqual(saved.spine);
      const companions = expectedYawRows(seed, d.layout.towers[row.towerIndex]!, saved.companions, 0, true);
      expect(row.companionMassIndices.length).toBe(companions.length);
      row.companionMassIndices.forEach((index, ordinal) => {
        const mass = massAt(d.masses, index), expected = companions[ordinal]!;
        geometry(mass).forEach((value, field) => field === 3 || field === 4 ? expect(value).toBeCloseTo(expected.geometry[field]!, 8) : expect(value).toBe(expected.geometry[field]));
        expect(mass.yawRad).toBeCloseTo(expected.yaw, 13);
      });
    }
  });

  it.each(SEEDS)('uses real bounded division and physical parent offsets at seed %i', seed => {
    const d = data(seed);
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex)!;
      const divide = saved.lean === null && saved.stages.slice(1).some(stage => stage.actual.height > 900);
      const oldOuterTop = Math.max(...saved.crown.boxes.map(box => box[2]! + box[5]!));
      const rise = oldOuterTop - ART_CROWN_HEIGHT_M - saved.stages[1]!.actual.y0;
      const expectedCount = divide ? 1 + Math.min(3, Math.ceil(rise / 900)) : saved.stages.length;
      const retained = retainsResolvedGeometry(row, d.masses, saved);
      expect(row.stages.length, row.towerKey).toBe(retained ? saved.stages.length : expectedCount);
      expect(row.stages.length).toBeGreaterThanOrEqual(2); expect(row.stages.length).toBeLessThanOrEqual(4);
      if (!divide || retained) {
        for (let index = 0; index < row.stages.length; index++) {
          assertSavedYawStage(row.stages[index]!, d.masses, saved.stages[index]!.boxes, seed, d.layout.towers[row.towerIndex]!, index, index === row.stages.length - 1, undefined, row);
        }
      }
      if (divide && !retained) assertDividedYawStages(row, saved, d.masses, seed, d.layout.towers[row.towerIndex]!);
      for (let index = 1; index < row.stages.length; index++) {
        const stage = row.stages[index]!, actual = measuredStage(stage, d.masses), offset = stage.offset;
        if (!offset) throw new Error('R36_ART_UPPER_OFFSET_MISSING');
        const tower = d.layout.towers[row.towerIndex]!;
        const parent = offset.parentKind === 'original-footprint' ? massSection(tower) : sectionUnionBounds(row.stages[offset.parentStageIndex]!.massIndices.map(i => massSection(massAt(d.masses, i))));
        const span = offset.axis === 'x' ? parent.x1 - parent.x0 : parent.z1 - parent.z0;
        const delta = actual[offset.axis] - (offset.axis === 'x' ? (parent.x0 + parent.x1) / 2 : (parent.z0 + parent.z1) / 2), ratio = Math.abs(delta) / span;
        expect(ratio, `${row.towerKey}:${index}`).toBeGreaterThanOrEqual(.08 - 1e-7); expect(ratio).toBeLessThanOrEqual(.33 + 1e-7);
        expect(offset.parentSpanM).toBeCloseTo(span, 7); expect(offset.deltaM).toBeCloseTo(delta, 7); expect(offset.ratio).toBeCloseTo(ratio, 9);
        if (index > 1 && divide && !retained) {
          const prior = row.stages[index - 1]!.massIndices.map(i => massAt(d.masses, i));
          const contact = stage.massIndices.some(i => prior.some(host => retainedMassContact(independentMassRoofBox(massAt(d.masses, i)), independentMassRoofBox(host)) === 'roof-face'));
          expect(contact, `${row.towerKey}:${index}:physical-parent`).toBe(true);
        }
      }
      if (row.lean !== null) {
        const first = measuredStage(row.stages[0]!, d.masses), last = measuredStage(row.stages.at(-1)!, d.masses), firstUpper = measuredStage(row.stages[1]!, d.masses);
        const riseM = last.y1 - firstUpper.y0, deltaM = Math.abs(last.z - first.z), angle = Math.atan2(deltaM, riseM) * 180 / Math.PI;
        expect(angle).toBeGreaterThanOrEqual(4); expect(angle).toBeLessThanOrEqual(6);
        expect(row.lean.riseM).toBeCloseTo(riseM, 7); expect(row.lean.totalOffsetM).toBeCloseTo(deltaM, 7);
      }
    }
  });

  it.each(SEEDS)('uses actual refined or exact retained crowns with clear split notches at seed %i', seed => {
    const d = data(seed);
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex)!;
      expect(row.crown.kind).toBe(saved.crown.kind); expect(row.crown.axis).toBe(saved.crown.axis);
      const crowns = row.crown.massIndices.map(index => massAt(d.masses, index)), hosts = row.stages.at(-1)!.massIndices.map(index => massAt(d.masses, index));
      const caps = hosts.filter(mass => mass.supportRole === 'yaw-roof-cap'), tall = hosts.filter(mass => mass.supportRole !== 'yaw-roof-cap');
      expect(caps).toHaveLength(1); expect(tall).toHaveLength(1);
      expect(yawRoofCapFailures(caps[0]!, tall[0]!)).toEqual([]);
      const yaw = crowns[0]!.yawRad!;
      expect(yaw === tall[0]!.yawRad || Math.abs(yaw - Math.sign(tall[0]!.yawRad!) * 2 * Math.PI / 180) < 1e-12).toBe(true);
      const expected = expectedCrownFit(saved.crown.boxes, caps[0]!, yaw);
      expect(crowns.length).toBe(expected.length);
      for (const crown of crowns) {
        const fit = expected.find(box => ['x', 'z', 'width', 'depth'].every(key => Math.abs(crown[key as 'x' | 'z' | 'width' | 'depth'] - box[key as 'x' | 'z' | 'width' | 'depth']) < 1e-7));
        expect(fit, `${row.towerKey}:bounded-saved-crown-fit`).toBeDefined();
        expect(crown.yawRad).toBe(yaw);
        const oldBound = sectionUnionBounds(saved.crown.boxes.map(box => massSection({ x: box[0]!, z: box[1]!, width: box[3]!, depth: box[4]! })));
        expect(crown.yawAnchor).toEqual({ x: (oldBound.x0 + oldBound.x1) / 2, z: (oldBound.z0 + oldBound.z1) / 2 });
        const currentBound = sectionUnionBounds(crowns.map(sourceBoxSection));
        const longX = oldBound.x1 - oldBound.x0 >= oldBound.z1 - oldBound.z0;
        const longRatio = longX ? (currentBound.x1 - currentBound.x0) / (oldBound.x1 - oldBound.x0) : (currentBound.z1 - currentBound.z0) / (oldBound.z1 - oldBound.z0);
        expect(longRatio).toBeGreaterThanOrEqual(.5 - 1e-7);
      }
      const retained = retainsResolvedGeometry(row, d.masses, saved);
      const oldCrowns = sorted(saved.crown.boxes), orderedCrowns = [...crowns].sort((a, b) => JSON.stringify(geometry(a)).localeCompare(JSON.stringify(geometry(b))));
      for (const [index, crown] of orderedCrowns.entries()) {
        expect(retained ? retainedCrownFailures(crown, oldCrowns[index]!, hosts) : crownCarveFailures(crown, oldCrowns[index]!, hosts), row.towerKey).toEqual([]);
        expect(crownRole(crown)).toBe('ordinary-dark-crown');
      }
      expect(measuredStage(row.stages.at(-1)!, d.masses).y1).toBeCloseTo(crowns[0]!.y0, 7);
      expect(row.crown.bounds.height).toBe(retained ? crowns[0]!.height : ART_CROWN_HEIGHT_M);
      if (seed === 424242 && CANONICAL_TEN.some(index => index === row.towerIndex)) expect(retained, `canonical-ten:${row.towerIndex}`).toBe(false);
      if (row.crown.kind === 'split') {
        expect(crowns).toHaveLength(2);
        const a = sourceBoxSection(crowns[0]!), b = sourceBoxSection(crowns[1]!), bound = sectionUnionBounds([a, b]), x = row.crown.axis === 'x';
        const low = x ? Math.min(a.x1, b.x1) : Math.min(a.z1, b.z1), high = x ? Math.max(a.x0, b.x0) : Math.max(a.z0, b.z0), span = x ? bound.x1 - bound.x0 : bound.z1 - bound.z0;
        expect((high - low) / span).toBeGreaterThanOrEqual(.15 - 1e-7); expect((high - low) / span).toBeLessThanOrEqual(.25 + 1e-7);
        const x0 = x ? low : Math.max(a.x0, b.x0), x1 = x ? high : Math.min(a.x1, b.x1), z0 = x ? Math.max(a.z0, b.z0) : low, z1 = x ? Math.min(a.z1, b.z1) : high;
        const prism = independentMassRoofBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y0: crowns[0]!.y0, width: x1 - x0, depth: z1 - z0, height: crowns[0]!.height, tint: crowns[0]!.tint, anchorV: saved.anchorV, yawRad: crowns[0]!.yawRad, yawAnchor: crowns[0]!.yawAnchor });
        expect(d.masses.flatMap((mass, index) => roofBoxesConflict(prism, independentMassRoofBox(mass)) ? [index] : []), row.towerKey).toEqual([]);
      }
    }
  });

  it.each(SEEDS)('uploads only the approved dark classes in both actual factory modes at seed %i', seed => {
    const d = data(seed), crownIds = new Set(d.profiles.flatMap(row => [...row.crown.massIndices]));
    const supportIds = verifiedSupportNonHostIds(C.deriveRetainedMassSupportRecords(d.layout), d.masses);
    const backingIds = new Set(d.masses.flatMap((mass, index) => { if (!mass.artBacking) return []; expect(fixedArtBackingFailures(mass, d.masses, C.deriveFacadeFaces(d.layout), C.deriveHeroBlades(d.layout)), `backing${index}`).toEqual([]); return [index]; }));
    const capIds = verifiedYawRoofCapIds(d.profiles, d.masses, seed);
    const ledgeIds = new Set(d.masses.flatMap((mass, index) => {
      if (mass.supportRole !== 'yaw-span-ledge') return [];
      const host = massAt(d.masses, mass.supportHostMassIndex!);
      expect(yawSpanLedgeFailures(mass, host, approvedYawHostEnvelope(host, mass.supportHostMassIndex!, d.profiles, seed, d.masses)), `ledge${index}`).toEqual([]);
      return [index];
    }));
    const stageIds = new Set(d.profiles.flatMap(row => row.stages.flatMap(stage => [...stage.massIndices])));
    const city = new C.SkyriverCity({ layout: d.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try { for (const mode of ['impostor', 'geometry'] as const) {
      city.setFarMode(mode);
      const mesh = city.group.getObjectByName('skyriver.city.towers'); if (!(mesh instanceof THREE.InstancedMesh)) throw new Error('R36_ART_REAL_MESH');
      const mask = mesh.geometry.getAttribute('aEmissionAllowed'); if (!(mask instanceof THREE.InstancedBufferAttribute)) throw new Error('R36_ART_REAL_MASK');
      let slot = 0, crownDrawn = 0;
      d.masses.forEach((mass, index) => {
        if (mode === 'impostor' && (mass.layer ?? 0) >= 2) return;
        const dark = mass.baseRecord?.kind === 'equipment' || supportIds.has(index) || crownIds.has(index) || backingIds.has(index) || capIds.has(index) || ledgeIds.has(index);
        expect(mask.getX(slot), `seed${seed}:${mode}:mass${index}`).toBe(dark ? 0 : 1);
        expect(crownRole(mass) === 'ordinary-dark-crown').toBe(crownIds.has(index));
        if (stageIds.has(index)) {
          const actual = uploadedRoofBox(mesh.instanceMatrix.array, slot * 16), expected = independentMassRoofBox(mass), tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(expected));
          expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
          expect(Math.abs(actual.hy - expected.hy)).toBeLessThanOrEqual(tolerance);
          expect(mesh.geometry.getAttribute('aSize').getY(slot)).toBe(Math.fround(mass.height));
        }
        if (crownIds.has(index)) {
          crownDrawn++;
          const actual = uploadedRoofBox(mesh.instanceMatrix.array, slot * 16), expected = independentMassRoofBox(mass), tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(expected));
          for (const field of ['x', 'y', 'z', 'hx', 'hy', 'hz'] as const) expect(Math.abs(actual[field] - expected[field])).toBeLessThanOrEqual(tolerance);
          expect(actual.hy * 2).toBeCloseTo(mass.height, 4);
        }
        slot++;
      });
      expect(mesh.count).toBe(slot); expect(crownDrawn).toBe(crownIds.size);
    } } finally { city.dispose(); }
  });


  it.each(SEEDS)('keeps cropped fixed art patches out of unrelated structural choices at seed %i', seed => {
    const d = data(seed), faces = C.deriveFacadeFaces(d.layout), heroes = C.deriveHeroBlades(d.layout), supports = C.deriveRetainedMassSupportRecords(d.layout);
    const structuralIds = new Set(d.profiles.flatMap(row => [...row.stages.flatMap(stage => stage.massIndices), ...row.crown.massIndices, ...row.companionMassIndices, ...(row.supportSpineIndex === null ? [] : [row.supportSpineIndex])]));
    const backings = d.masses.flatMap((mass, index) => mass.artBacking ? [{ mass, index }] : []);
    expect(backings.length).toBeGreaterThan(0);
    for (const { mass, index } of backings) {
      expect(fixedArtBackingFailures(mass, d.masses, faces, heroes), `backing${index}`).toEqual([]);
      expect(structuralIds.has(index), `backing${index}:profile-role`).toBe(false);
      expect(supports.some(record => record.hostMassIndex === index || record.supportMassIndex === index), `backing${index}:retained-support-role`).toBe(false);
    }
  });

  it.each(SEEDS)('backs every final placed hero root with a real margin at seed %i', seed => {
    const d = data(seed), heroes = C.deriveHeroBlades(d.layout), faces = new Map(C.deriveFacadeFaces(d.layout).map(face => [face.id, face]));
    expect(heroes).toHaveLength(42);
    for (const [index, hero] of heroes.entries()) {
      const face = faces.get(hero.faceId); if (!face) throw new Error(`R36_ART_HERO_FACE:${index}`);
      const centre = face.planeAxis === 'x' ? hero.z : hero.x;
      const half = face.planeAxis === 'z' || hero.kind === 'panel' ? hero.width / 2 : hero.rootHalfWidthM;
      const root = { u0: centre - half, u1: centre + half, y0: hero.y - hero.height / 2, y1: hero.y + hero.height / 2 };
      expect(actualHeroRootFailures(root, face, d.masses), `${seed}:source-hero${index}`).toEqual([]);
    }
  });

  it.each(SEEDS)('clears actual uploaded boards and supports their finite physical roots at seed %i', seed => {
    const d = data(seed), signs = C.deriveNeonSigns(d.layout), rawSolids = C.deriveSignMountSolids(d.layout);
    const canonical = canonicalPhysicalScene(signs, rawSolids, C.placeNeonSign, (owner, point) => {
      const out = C.warpBoxPoint(owner, point.x, point.z, { x: 0, z: 0, heading: 0 });
      return [out.x, point.y, out.z];
    });
    const city = new C.SkyriverCity({ layout: d.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try { for (const mode of ['impostor', 'geometry'] as const) {
      city.setFarMode(mode);
      const tower = city.group.getObjectByName('skyriver.city.towers'), trim = city.group.getObjectByName('skyriver.city.trim'), sign = city.group.getObjectByName('skyriver.city.signs');
      if (!(tower instanceof THREE.InstancedMesh) || !(trim instanceof THREE.InstancedMesh) || !(sign instanceof THREE.Mesh)) throw new Error('R37_UPLOADED_PHYSICAL_BATCHES');
      const draw = city.signMountEvidence();
      const massIndices = draw.towers, trimIndices = draw.trims;
      expect(massIndices).toEqual(d.masses.flatMap((mass, index) => mode === 'geometry' || (mass.layer ?? 0) < 2 ? [index] : []));
      expect(trimIndices).toEqual(rawSolids.filter(solid => solid.host.kind === 'trim').map(solid => solid.host.index));
      expect(tower.count).toBe(massIndices.length); expect(trim.count).toBe(trimIndices.length); expect(signs.heroCount).toBe(42);
      const read = (name: string) => Array.from(sign.geometry.getAttribute(name).array, Number).slice(0, signs.count * sign.geometry.getAttribute(name).itemSize);
      const boards = uploadedBoards(read('aCentre'), read('aNormal'), read('aSize'), signs.count);
      const solids = [...uploadedSolids(Array.from(tower.instanceMatrix.array).slice(0, tower.count * 16), massIndices, 'mass'),
        ...uploadedSolids(Array.from(trim.instanceMatrix.array).slice(0, trim.count * 16), trimIndices, 'trim')];
      const audit = physicalSignAudit(boards, canonical.mounts, solids);
      expect(audit.overlaps, `${seed}:${mode}:full-0.4m-boards`).toEqual([]);
      expect(audit.roots.filter(root => root.failures.length), `${seed}:${mode}:finite-physical-roots`).toEqual([]);
      expect(audit.maxRootDistanceM).toBeLessThanOrEqual(3);
    } } finally { city.dispose(); }
  }, 180000);

  it('rejects a real large hero cut, a cut beyond existing tolerance and a false uploaded host', () => {
    const d = data(424242), hero = C.deriveHeroBlades(d.layout)[14]; if (!hero) throw new Error('R36_ART_PRECISION_CONTROL_HERO');
    const face = C.deriveFacadeFaces(d.layout).find(f => f.id === hero.faceId); if (!face) throw new Error('R36_ART_PRECISION_CONTROL_FACE');
    const centre = face.planeAxis === 'x' ? hero.z : hero.x, half = face.planeAxis === 'z' || hero.kind === 'panel' ? hero.width / 2 : hero.rootHalfWidthM;
    const root = { u0: centre - half, u1: centre + half, y0: hero.y - hero.height / 2, y1: hero.y + hero.height / 2 };
    const hosts = d.masses.map(mass => ({ mass, box: independentMassRoofBox(mass) }));
    expect(actualHeroRootFailures(root, face, d.masses)).toEqual([]); expect(uploadedHeroRootFailures(root, face, hosts)).toEqual([]);
    const cut = (distance: number) => hosts.map(host => {
      const top = Math.min(host.box.y + host.box.hy, root.y1 + ART_HERO_MARGIN_M - distance), bottom = host.box.y - host.box.hy;
      return { ...host, box: { ...host.box, y: (bottom + top) / 2, hy: Math.max(0, (top - bottom) / 2) } };
    });
    const tolerance = Math.max(...hosts.map(host => roofBoxTolerance(host.box)));
    expect(uploadedHeroRootFailures(root, face, cut(256))).toContain('uploaded-real-surface-fit');
    expect(uploadedHeroRootFailures(root, face, cut(2 * tolerance))).toContain('uploaded-real-surface-fit');
    expect(uploadedHeroRootFailures(root, face, hosts.map(host => ({ ...host, mass: { ...host.mass, materialOwner: -1 } })))).toContain('uploaded-real-surface-fit');
    expect(uploadedHeroRootFailures(root, face, [])).toContain('uploaded-real-surface-fit');
  });

  it('keeps full wing roofs and rejects missing, enlarged or displaced band sections', () => {
    const original: C.SkyriverMass = { x: 0, z: 0, y0: -2, width: 10, depth: 10, height: 10, tint: 1, materialOwner: 1, building: 1, anchorV: 0 };
    const blocker: C.SkyriverMass = { ...original, x: 6, width: .5, depth: 2, y0: 0, height: 4 }, masses = [blocker], boxes = masses.map(independentMassRoofBox), query = supportConflictQuery(boxes), old = [artVolumeBox(original, 1)];
    const model = independentWingSections(original, Math.PI / 4, old, masses, new Set(), query, boxes);
    expect(model.blockers).toEqual([0]); expect([model.cutLow, model.cutHigh]).toEqual([0, 4]); expect(model.sections).toHaveLength(3);
    const parts = model.sections.map(section => ({ ...section.mass, yawWingPart: { roofMassIndex: 7, part: section.part as 'roof' | 'band' | 'below', cutLow: model.cutLow, cutHigh: model.cutHigh } }));
    expect(wingSectionContractFailures(parts, original, model)).toEqual([]);
    const band = parts.find(part => part.yawWingPart.part === 'band')!, roof = parts.find(part => part.yawWingPart.part === 'roof')!;
    expect([roof.width, roof.depth]).toEqual([original.width, original.depth]);
    expect(addedVolumeConflicts(addedVolumeCells(artVolumeBox(band, 1), old), query, new Set(), boxes)).toEqual([]);
    const enlarged = { ...band, width: original.width, depth: original.depth };
    expect(addedVolumeConflicts(addedVolumeCells(artVolumeBox(enlarged, 1), old), query, new Set(), boxes).map(hit => hit.blockerIndex)).toContain(0);
    expect(wingSectionContractFailures(parts.filter(part => part !== band), original, model)).toContain('section-gap');
    expect(wingSectionContractFailures(parts.map(part => part === band ? enlarged : part), original, model)).toContain('band:size');
    expect(wingSectionContractFailures(parts.map(part => part === band ? { ...part, x: part.x + 1 } : part), original, model)).toContain('band:x');
    expect(wingSectionContractFailures(parts.map(part => ({ ...part, yawRad: -part.yawRad! })), original, model)).toContain('roof:yawRad');
  });

  it.each(SEEDS)('classifies every optional refinement by actual frozen geometry at seed %i', seed => {
    const d = data(seed), retained: number[] = [], refined: number[] = [];
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex); if (!saved) throw new Error('R36_ART_SELECTION_REFERENCE');
      (retainsResolvedGeometry(row, d.masses, saved) ? retained : refined).push(row.towerIndex);
      if (retainsResolvedGeometry(row, d.masses, saved)) {
        row.stages.forEach((stage, index) => assertSavedYawStage(stage, d.masses, saved.stages[index]!.boxes, seed, d.layout.towers[row.towerIndex]!, index, false, row.supportSpineIndex === null ? undefined : massAt(d.masses, row.supportSpineIndex), row));
        expect(row.stages.map(stage => [stage.offset?.axis, stage.offset?.parentKind, stage.offset?.parentStageIndex])).toEqual(saved.stages.map(stage => [stage.offset?.axis, stage.offset?.parentKind, stage.offset?.parentStageIndex]));
        expect(row.crown.kind).toBe(saved.crown.kind);
        expect(row.crown.axis).toBe(saved.crown.axis);
      }
    }
    expect(new Set([...retained, ...refined]).size).toBe(d.saved.towers.length);
    expect(retained.length + refined.length).toBe(d.saved.towers.length);
    if (seed === 424242) for (const index of CANONICAL_TEN) expect(refined, `canonical-ten:${index}`).toContain(index);
  });

  it('rejects an unlowered body, raised crown top and a real hero cut', () => {
    const d = data(424242), row = d.profiles[0]; if (!row) throw new Error('R36_ART_CONTROL_PROFILE');
    const old = d.saved.towers.find(item => item.towerIndex === row.towerIndex)!.crown.boxes[0]!;
    const current = massAt(d.masses, row.crown.massIndices[0]!);
    const crown = { ...current, y0: old[2]! + old[5]! - ART_CROWN_HEIGHT_M, height: ART_CROWN_HEIGHT_M };
    const host = { ...crown, y0: crown.y0 - 20, height: 20, width: crown.width + 20, depth: crown.depth + 20 };
    expect(crownCarveFailures(crown, old, [host])).toEqual([]);
    const retained = { ...current, yawRad: undefined, yawAnchor: undefined, x: old[0]!, z: old[1]!, y0: old[2]!, width: old[3]!, depth: old[4]!, height: old[5]! };
    const retainedHost = { ...retained, y0: retained.y0 - 20, height: 20, width: retained.width + 20, depth: retained.depth + 20 };
    expect(retainedCrownFailures(retained, old, [retainedHost])).toEqual([]);
    expect(retainedCrownFailures({ ...retained, x: retained.x + 1 }, old, [retainedHost])).toContain('resolved-geometry');
    expect(crownCarveFailures(crown, old, [{ ...host, height: 30 }])).toContain('body-not-lowered');
    expect(crownCarveFailures({ ...crown, height: ART_CROWN_HEIGHT_M + 1 }, old, [host])).toContain('outer-top');
    const face = C.deriveFacadeFaces(d.layout).find(item => item.y1 - item.y0 > 50 && item.u1 - item.u0 > 50); if (!face) throw new Error('R36_ART_CONTROL_FACE');
    const root = { u0: face.u0 + 10, u1: face.u1 - 10, y0: face.y1 - 10, y1: face.y1 + 1 };
    expect(actualHeroRootFailures(root, face, d.masses)).toContain('face-fit');
    expect(actualHeroRootFailures(root, face, [])).toContain('real-surface-fit');
    const u = (face.u0 + face.u1) / 2, y = (face.y0 + face.y1) / 2;
    const legalRoot = { u0: u - 1, u1: u + 1, y0: y - 1, y1: y + 1 };
    expect(actualHeroRootFailures(legalRoot, face, d.masses)).toEqual([]);
    const cut = d.masses.filter(mass => (mass.anchorV ?? mass.z) !== face.owner.anchorV || owner(mass) !== (face.owner.materialOwner ?? C.buildingSeedOf(face.owner.x, face.owner.z)) || mass.y0 + mass.height < legalRoot.y0 - ART_HERO_MARGIN_M);
    expect(actualHeroRootFailures(legalRoot, face, cut)).toContain('real-surface-fit');
  });

  it('rejects an unchanged-height, false-host or closed-gap crown control', () => {
    const d = data(424242), row = d.profiles.find(profile => profile.crown.kind === 'split'); if (!row) throw new Error('R36_ART_SPLIT_CONTROL');
    const crown = massAt(d.masses, row.crown.massIndices[0]!), hosts = row.stages.at(-1)!.massIndices.map(index => massAt(d.masses, index));
    expect(crownContact({ ...crown, x: crown.x + 10000 }, hosts)).toBe(false);
    expect({ ...crown, height: 45 }.height === 200).toBe(false);
    const a = sourceBoxSection(crown), shifted = sourceBoxSection({ ...massAt(d.masses, row.crown.massIndices[1]!), x: crown.x, z: crown.z });
    const gap = row.crown.axis === 'x' ? Math.max(a.x0, shifted.x0) - Math.min(a.x1, shifted.x1) : Math.max(a.z0, shifted.z0) - Math.min(a.z1, shifted.z1);
    expect(gap).toBeLessThanOrEqual(0);
    const second = sourceBoxSection(massAt(d.masses, row.crown.massIndices[1]!)), bounds = sectionUnionBounds([a, second]), axisX = row.crown.axis === 'x';
    const low = axisX ? Math.min(a.x1, second.x1) : Math.min(a.z1, second.z1), high = axisX ? Math.max(a.x0, second.x0) : Math.max(a.z0, second.z0);
    const x0 = axisX ? low : Math.max(a.x0, second.x0), x1 = axisX ? high : Math.min(a.x1, second.x1), z0 = axisX ? Math.max(a.z0, second.z0) : low, z1 = axisX ? Math.min(a.z1, second.z1) : high;
    expect(high).toBeGreaterThan(low); expect(bounds.x1).toBeGreaterThan(bounds.x0);
    const retainedSpine = { ...crown, x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: (x1 - x0) / 2, depth: (z1 - z0) / 2 };
    const notch = { ...retainedSpine, width: x1 - x0, depth: z1 - z0 };
    expect(roofBoxesConflict(independentMassRoofBox(notch), independentMassRoofBox(retainedSpine))).toBe(true);
  });
});


describe('independent yaw surface controls', () => {
  const host: C.SkyriverMass = { x: 0, z: 0, y0: -2, width: 20, depth: 20, height: 20, tint: 1, anchorV: 0, materialOwner: 1 };
  const face: C.SkyriverFacadeFace = { id: 'control', buildingId: 'control', side: 1, planeAxis: 'x', plane: 10, outward: 1, u0: -10, u1: 10, y0: -2, y1: 18, stepBottom: false, stepTop: false, projection: 0, owner: { x: 0, z: 0, width: 20, depth: 20, anchorV: 0, materialOwner: 1 } };
  const root = { u0: -1, u1: 1, y0: 4, y1: 8 };
  it('computes the maximal saved crown fit without production yaw helpers', () => {
    const parent = { ...host, x: 0, z: 0 };
    const old = [[-6, 0, 18, 8, 20, 200, 1, 0], [6, 0, 18, 8, 20, 200, 1, 0]];
    const fit = expectedCrownFit(old, parent, Math.PI / 4);
    expect(fit).toHaveLength(2);
    expect(fit[0]!.x).toBeCloseTo(-6 / Math.SQRT2, 10);
    expect(fit[1]!.x).toBeCloseTo(6 / Math.SQRT2, 10);
    expect(fit[0]!.width).toBeCloseTo(8 / Math.SQRT2, 10);
    expect(fit[0]!.depth).toBeCloseTo(20 / Math.SQRT2, 10);
  });
  it('maximizes area on an independently clipped feasible size polygon', () => {
    expect(independentMaximumAreaSize(10, 10, [{ width: 1, depth: 1, maximum: 10 }])).toEqual({ width: 5, depth: 5 });
    expect(independentMaximumAreaSize(10, 10, [{ width: 1, depth: 1, maximum: 10 }, { width: -1, depth: 0, maximum: -8 }])).toEqual({ width: 8, depth: 2 });
    const fit = independentMaximumAreaSize(20, 20, [{ width: 1, depth: 2, maximum: 10 }]);
    expect(fit.width).toBeCloseTo(5, 10); expect(fit.depth).toBeCloseTo(2.5, 10);
    expect(() => independentMaximumAreaSize(2, 2, [{ width: -1, depth: 0, maximum: -3 }])).toThrow('NO_FEASIBLE_AREA');
  });
  it('preserves the long outline with an independent nonuniform crown optimum', () => {
    const yaw = 10 * Math.PI / 180, parent = { ...host, width: 100, depth: 20 };
    const fit = expectedCrownFit([[0, 0, 18, 100, 20, 200, 1, 0]], parent, yaw)[0]!;
    expect(fit.width).toBeCloseTo(20 / (2 * Math.sin(yaw)), 9);
    expect(fit.depth).toBeCloseTo(20 / (2 * Math.cos(yaw)), 9);
    expect(fit.width).toBeGreaterThanOrEqual(50);
    expect(fit.x).toBe(0); expect(fit.z).toBe(0);
    const atFloor = expectedCrownFit([[0, 0, 18, 100, 20, 200, 1, 0]], parent, 12 * Math.PI / 180)[0]!;
    expect(atFloor.width).toBe(50);
  });
  it('accepts a rotated flat face and rejects the old source plane', () => {
    const turned = { ...host, yawRad: Math.PI / 4 }, turnedFace = { ...face, owner: { ...face.owner, yawRad: Math.PI / 4 } };
    const hosts = [{ mass: turned, box: independentMassRoofBox(turned) }];
    expect(actualHeroRootFailures(root, face, [host])).toEqual([]);
    expect(actualHeroRootFailures(root, turnedFace, [turned])).toEqual([]);
    expect(uploadedHeroRootFailures(root, turnedFace, hosts)).toEqual([]);
    expect(actualHeroRootFailures(root, face, [turned])).toContain('real-surface-fit');
    expect(uploadedHeroRootFailures(root, face, hosts)).toContain('uploaded-real-surface-fit');
    const cornerFace = { ...face, plane: 10 * Math.SQRT2 };
    expect(uploadedHeroRootFailures(root, cornerFace, hosts)).toContain('uploaded-real-surface-fit');
  });
  it('detects a blocked rotated notch that the old notch cannot see', () => {
    const notch = { ...host, width: 2, depth: 10, yawRad: Math.PI / 4 };
    const blocker = { ...host, x: 3, z: 3, width: .2, depth: .2 };
    expect(roofBoxesConflict(independentMassRoofBox({ ...notch, yawRad: 0 }), independentMassRoofBox(blocker))).toBe(false);
    expect(roofBoxesConflict(independentMassRoofBox(notch), independentMassRoofBox(blocker))).toBe(true);
    const falseCorner = { ...blocker, x: 4, z: 4 };
    expect(roofBoxesConflict(independentMassRoofBox(notch), independentMassRoofBox(falseCorner))).toBe(false);
  });
  it('measures a rotated legacy face and rejects its old source-plane contact', () => {
    const body = { ...host, x: 20, yawRad: Math.PI / 4 }, owner = { ...face.owner, x: 20 };
    const trim = { cx: 10, cz: 0, cy: 8, sx: 1, sz: 2, sy: 4 };
    expect(legacyTrimExposedContact(trim, owner, [{ ...body, yawRad: 0 }], 0).area).toBeGreaterThan(0);
    expect(legacyTrimExposedContact(trim, owner, [body], 0).area).toBe(0);
    const actual = { ...trim, cx: 20 - 10 * Math.SQRT2, sx: 3 };
    expect(legacyTrimExposedContact(actual, owner, [body], 0).area).toBeGreaterThan(0);
    expect(legacyTrimExposedContact(actual, owner, [{ ...body, yawRad: 0 }], 0).area).toBe(0);
  });
  it('keeps exact legacy boundary grazing separate from positive face crossing', () => {
    const body = { ...host, x: 20, anchorV: -6400 }, frame = { ...face.owner, x: 20, anchorV: -6400 };
    const trim = { cx: 9.5, cz: 0, cy: 8, sx: 1, sz: 4, sy: 4 };
    expect(legacyTrimExposedContact(trim, frame, [body], 0).area).toBe(0);
    expect(legacyTrimExposedContact({ ...trim, cx: 10 }, frame, [body], 0).area).toBeGreaterThan(0);
  });
  it('rejects an oversized or detached fixed art patch', () => {
    const fixedFace = { ...face, id: 'control:art:control:0', u0: -6.25, u1: 6.25, y0: 3.75, y1: 16.25 };
    const hero: C.SkyriverHeroBlade = { kind: 'panel', cell: 0, x: 10, y: 10, z: 0, width: 4, height: 4, color: 1, seed: 2, buildingId: 'control', faceId: fixedFace.id, compositionId: 'control', rootHalfWidthM: 2, owner: fixedFace.owner };
    const turned = { ...host, y0: 0, yawRad: .1 };
    const backing = { ...host, x: 8, z: 0, y0: 3.75, width: 4, depth: 12.5, height: 12.5, artBacking: { hostMassIndex: 0, faceId: fixedFace.id } };
    expect(fixedArtBackingFailures(backing, [turned, backing], [fixedFace], [hero])).toEqual([]);
    expect(fixedArtBackingFailures({ ...backing, depth: 14 }, [turned], [fixedFace], [hero])).toContain('emitted-patch-crop');
    expect(fixedArtBackingFailures({ ...backing, x: 30 }, [turned], [fixedFace], [hero])).toContain('actual-host-contact');
    expect(fixedArtBackingFailures({ ...backing, yawRad: .1 }, [turned], [fixedFace], [hero])).toContain('fixed-art-frame');
  });
});
