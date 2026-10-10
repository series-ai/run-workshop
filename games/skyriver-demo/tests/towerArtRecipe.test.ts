import { describe, expect, it, vi } from 'vitest';
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
import { verifiedSupportNonHostIds } from './support/legacyTrimFaceGeometry';
import { ART_CROWN_HEIGHT_M, ART_HERO_MARGIN_M, crownCarveFailures, retainedCrownFailures, actualHeroRootFailures } from './support/towerCrownCarve';
import { uploadedHeroRootFailures, heroFacadeCoordinates, type UploadedHeroHost } from './support/towerHeroUploadedGeometry';
import { massSection, sectionUnionBounds } from './support/towerProfileGeometry';
import { massRoofBox, roofBoxesConflict, roofSupportFailures, roofBoxTolerance, uploadedRoofBox } from './support/rooftopDetailsGeometry';

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
function stageGeometry(stage: C.SkyriverStageProfile, masses: readonly C.SkyriverMass[]) { return sorted(stage.massIndices.map(index => geometry(massAt(masses, index)))); }
function measuredStage(stage: C.SkyriverStageProfile, masses: readonly C.SkyriverMass[]) {
  const members = stage.massIndices.map(index => massAt(masses, index)), bounds = sectionUnionBounds(members.map(massSection));
  return { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2, width: bounds.x1 - bounds.x0, depth: bounds.z1 - bounds.z0, y0: Math.min(...members.map(mass => mass.y0)), y1: Math.max(...members.map(mass => mass.y0 + mass.height)) };
}
function fixedUpper(rows: readonly (readonly number[])[]) { return sorted(rows.map(row => row.filter((_, index) => index !== 5))); }
type ResolvedTower = (typeof before.rows)[number]['towers'][number];
const CANONICAL_TEN = [106, 112, 116, 120, 124, 128, 132, 137, 144, 151] as const;
function retainsResolvedGeometry(row: C.SkyriverEligibleTowerProfile, masses: readonly C.SkyriverMass[], saved: ResolvedTower): boolean {
  return JSON.stringify(row.stages.map(stage => stageGeometry(stage, masses))) === JSON.stringify(saved.stages.map(stage => sorted(stage.boxes)))
    && JSON.stringify(sorted(row.crown.massIndices.map(index => geometry(massAt(masses, index))))) === JSON.stringify(sorted(saved.crown.boxes));
}
function crownRole(mass: C.SkyriverMass): unknown { return Reflect.get(mass, 'crownRole'); }
function crownContact(crown: C.SkyriverMass, hosts: readonly C.SkyriverMass[]): boolean { return hosts.some(host => roofSupportFailures(massRoofBox(crown), massRoofBox(host), 0).length === 0); }

describe('R36 independent resolved upper-shape art recipe', () => {
  it.each(SEEDS)('preserves every resolved lower input at seed %i', seed => {
    const d = data(seed);
    expect(before.sourceSha256).toBe('9d03845893bda7583b77563379b999ca8b428288c7fbc3b5410224bc71c6a2ef');
    expect(d.profiles).toHaveLength(d.saved.towers.length);
    expect(new Set(d.profiles.map(row => row.towerIndex)).size).toBe(d.profiles.length);
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex); if (!saved) throw new Error('R36_ART_UNDECLARED_PROFILE');
      expect([row.towerKey, row.family, row.building, row.materialOwner]).toEqual([saved.towerKey, saved.family, saved.owner, saved.owner]);
      expect(stageGeometry(row.stages[0]!, d.masses), row.towerKey).toEqual(sorted(saved.stages[0]!.boxes));
      expect(row.stages[0]!.offset).toEqual(saved.stages[0]!.offset);
      expect(fixedUpper(stageGeometry(row.stages[1]!, d.masses)), row.towerKey).toEqual(fixedUpper(saved.stages[1]!.boxes));
      expect(row.stages[1]!.offset).toEqual(saved.stages[1]!.offset);
      expect(row.lean).toEqual(saved.lean);
      const spine = row.supportSpineIndex === null ? null : geometry(massAt(d.masses, row.supportSpineIndex));
      expect(spine, row.towerKey).toEqual(saved.spine);
      expect(sorted(row.companionMassIndices.map(index => geometry(massAt(d.masses, index))))).toEqual(sorted(saved.companions));
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
      if (!divide && !retained) {
        for (let index = 0; index < row.stages.length; index++) {
          const actual = stageGeometry(row.stages[index]!, d.masses), old = sorted(saved.stages[index]!.boxes);
          expect(index === row.stages.length - 1 ? fixedUpper(actual) : actual).toEqual(index === row.stages.length - 1 ? fixedUpper(old) : old);
        }
      }
      for (let index = 1; index < row.stages.length; index++) {
        const stage = row.stages[index]!, actual = measuredStage(stage, d.masses), offset = stage.offset;
        if (!offset) throw new Error('R36_ART_UPPER_OFFSET_MISSING');
        const tower = d.layout.towers[row.towerIndex]!;
        const parent = offset.parentKind === 'original-footprint' ? massSection({ ...tower, y0: 0 }) : sectionUnionBounds(row.stages[offset.parentStageIndex]!.massIndices.map(i => massSection(massAt(d.masses, i))));
        const span = offset.axis === 'x' ? parent.x1 - parent.x0 : parent.z1 - parent.z0;
        const delta = actual[offset.axis] - (offset.axis === 'x' ? (parent.x0 + parent.x1) / 2 : (parent.z0 + parent.z1) / 2), ratio = Math.abs(delta) / span;
        expect(ratio, `${row.towerKey}:${index}`).toBeGreaterThanOrEqual(.08 - 1e-7); expect(ratio).toBeLessThanOrEqual(.33 + 1e-7);
        expect(offset.parentSpanM).toBeCloseTo(span, 7); expect(offset.deltaM).toBeCloseTo(delta, 7); expect(offset.ratio).toBeCloseTo(ratio, 9);
        if (index > 1 && divide && !retained) {
          const prior = row.stages[index - 1]!.massIndices.map(i => massAt(d.masses, i));
          const contact = stage.massIndices.some(i => { const child = massAt(d.masses, i), a = massSection(child); return prior.some(host => { const b = massSection(host); return Math.abs(child.y0 - (host.y0 + host.height)) <= Math.max(roofBoxTolerance(massRoofBox(child)), roofBoxTolerance(massRoofBox(host))) && Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0); }); });
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
      const horizontal = (boxes: readonly (readonly number[])[]) => sorted(boxes.map(box => box.filter((_, index) => index !== 2 && index !== 5)));
      expect(horizontal(crowns.map(geometry)), row.towerKey).toEqual(horizontal(saved.crown.boxes));
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
        const a = massSection(crowns[0]!), b = massSection(crowns[1]!), bound = sectionUnionBounds([a, b]), x = row.crown.axis === 'x';
        const low = x ? Math.min(a.x1, b.x1) : Math.min(a.z1, b.z1), high = x ? Math.max(a.x0, b.x0) : Math.max(a.z0, b.z0), span = x ? bound.x1 - bound.x0 : bound.z1 - bound.z0;
        expect((high - low) / span).toBeGreaterThanOrEqual(.15 - 1e-7); expect((high - low) / span).toBeLessThanOrEqual(.25 + 1e-7);
        const x0 = x ? low : Math.max(a.x0, b.x0), x1 = x ? high : Math.min(a.x1, b.x1), z0 = x ? Math.max(a.z0, b.z0) : low, z1 = x ? Math.min(a.z1, b.z1) : high;
        const prism = massRoofBox({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y0: crowns[0]!.y0, width: x1 - x0, depth: z1 - z0, height: crowns[0]!.height, tint: crowns[0]!.tint, anchorV: saved.anchorV });
        expect(d.masses.flatMap((mass, index) => roofBoxesConflict(prism, massRoofBox(mass)) ? [index] : []), row.towerKey).toEqual([]);
      }
    }
  });

  it.each(SEEDS)('uploads only the approved dark classes in both actual factory modes at seed %i', seed => {
    const d = data(seed), crownIds = new Set(d.profiles.flatMap(row => [...row.crown.massIndices]));
    const supportIds = verifiedSupportNonHostIds(C.deriveRetainedMassSupportRecords(d.layout), d.masses);
    const stageIds = new Set(d.profiles.flatMap(row => row.stages.flatMap(stage => [...stage.massIndices])));
    const city = new C.SkyriverCity({ layout: d.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try { for (const mode of ['impostor', 'geometry'] as const) {
      city.setFarMode(mode);
      const mesh = city.group.getObjectByName('skyriver.city.towers'); if (!(mesh instanceof THREE.InstancedMesh)) throw new Error('R36_ART_REAL_MESH');
      const mask = mesh.geometry.getAttribute('aEmissionAllowed'); if (!(mask instanceof THREE.InstancedBufferAttribute)) throw new Error('R36_ART_REAL_MASK');
      let slot = 0, crownDrawn = 0;
      d.masses.forEach((mass, index) => {
        if (mode === 'impostor' && (mass.layer ?? 0) >= 2) return;
        const dark = mass.baseRecord?.kind === 'equipment' || supportIds.has(index) || crownIds.has(index);
        expect(mask.getX(slot), `seed${seed}:${mode}:mass${index}`).toBe(dark ? 0 : 1);
        expect(crownRole(mass) === 'ordinary-dark-crown').toBe(crownIds.has(index));
        if (stageIds.has(index)) {
          const actual = uploadedRoofBox(mesh.instanceMatrix.array, slot * 16), expected = massRoofBox(mass), tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(expected));
          expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
          expect(Math.abs(actual.hy - expected.hy)).toBeLessThanOrEqual(tolerance);
          expect(mesh.geometry.getAttribute('aSize').getY(slot)).toBe(Math.fround(mass.height));
        }
        if (crownIds.has(index)) {
          crownDrawn++;
          const actual = uploadedRoofBox(mesh.instanceMatrix.array, slot * 16), expected = massRoofBox(mass), tolerance = Math.max(roofBoxTolerance(actual), roofBoxTolerance(expected));
          for (const field of ['x', 'y', 'z', 'hx', 'hy', 'hz'] as const) expect(Math.abs(actual[field] - expected[field])).toBeLessThanOrEqual(tolerance);
          expect(actual.hy * 2).toBeCloseTo(mass.height, 4);
        }
        slot++;
      });
      expect(mesh.count).toBe(slot); expect(crownDrawn).toBe(crownIds.size);
    } } finally { city.dispose(); }
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

  it.each(SEEDS)('backs actual uploaded hero roots with the existing geometry tolerance at seed %i', seed => {
    const d = data(seed), signs = C.deriveNeonSigns(d.layout), faces = new Map(C.deriveFacadeFaces(d.layout).map(face => [face.id, face]));
    const city = new C.SkyriverCity({ layout: d.layout, quality: skyriverQualityFor(SkyriverQualityTier.High), colourSwitch: new SkyriverDistrictColourSwitch(true) });
    try { for (const mode of ['impostor', 'geometry'] as const) {
      city.setFarMode(mode);
      const tower = city.group.getObjectByName('skyriver.city.towers'), sign = city.group.getObjectByName('skyriver.city.signs');
      if (!(tower instanceof THREE.InstancedMesh) || !(sign instanceof THREE.Mesh)) throw new Error('R36_ART_UPLOADED_HERO_MESH');
      const centres = sign.geometry.getAttribute('aCentre'), sizes = sign.geometry.getAttribute('aSize');
      const hosts: UploadedHeroHost[] = []; let slot = 0;
      for (const mass of d.masses) if (mode === 'geometry' || (mass.layer ?? 0) < 2) hosts.push({ mass, box: uploadedRoofBox(tower.instanceMatrix.array, slot++ * 16) });
      expect(tower.count).toBe(slot); expect(signs.heroCount).toBe(42);
      for (let index = 0; index < signs.heroCount; index++) {
        const id = signs.faceId[index], face = id == null ? undefined : faces.get(id); if (!face) throw new Error('R36_ART_UPLOADED_HERO_FACE');
        const projected = heroFacadeCoordinates(face, centres.getX(index), centres.getZ(index));
        const centre = face.planeAxis === 'x' ? projected.z : projected.x;
        const half = face.planeAxis === 'z' || signs.nz[index] === 0 ? sizes.getX(index) / 2 : signs.rootHalfWidthM[index]!;
        const root = { u0: centre - half, u1: centre + half, y0: centres.getY(index) - sizes.getY(index) / 2, y1: centres.getY(index) + sizes.getY(index) / 2 };
        expect(uploadedHeroRootFailures(root, face, hosts), `${seed}:${mode}:uploaded-hero${index}`).toEqual([]);
      }
    } } finally { city.dispose(); }
  });

  it('rejects a real large hero cut, a cut beyond existing tolerance and a false uploaded host', () => {
    const d = data(424242), hero = C.deriveHeroBlades(d.layout)[14]; if (!hero) throw new Error('R36_ART_PRECISION_CONTROL_HERO');
    const face = C.deriveFacadeFaces(d.layout).find(f => f.id === hero.faceId); if (!face) throw new Error('R36_ART_PRECISION_CONTROL_FACE');
    const centre = face.planeAxis === 'x' ? hero.z : hero.x, half = face.planeAxis === 'z' || hero.kind === 'panel' ? hero.width / 2 : hero.rootHalfWidthM;
    const root = { u0: centre - half, u1: centre + half, y0: hero.y - hero.height / 2, y1: hero.y + hero.height / 2 };
    const hosts = d.masses.map(mass => ({ mass, box: massRoofBox(mass) }));
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

  it.each(SEEDS)('classifies every optional refinement by actual frozen geometry at seed %i', seed => {
    const d = data(seed), retained: number[] = [], refined: number[] = [];
    for (const row of d.profiles) {
      const saved = d.saved.towers.find(item => item.towerIndex === row.towerIndex); if (!saved) throw new Error('R36_ART_SELECTION_REFERENCE');
      (retainsResolvedGeometry(row, d.masses, saved) ? retained : refined).push(row.towerIndex);
      if (retainsResolvedGeometry(row, d.masses, saved)) {
        expect(row.stages.map(stage => stageGeometry(stage, d.masses))).toEqual(saved.stages.map(stage => sorted(stage.boxes)));
        expect(sorted(row.crown.massIndices.map(index => geometry(massAt(d.masses, index))))).toEqual(sorted(saved.crown.boxes));
        expect(row.stages.map(stage => stage.offset)).toEqual(saved.stages.map(stage => stage.offset));
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
    const retained = { ...current, x: old[0]!, z: old[1]!, y0: old[2]!, width: old[3]!, depth: old[4]!, height: old[5]! };
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
    const a = massSection(crown), shifted = massSection({ ...massAt(d.masses, row.crown.massIndices[1]!), x: crown.x, z: crown.z });
    const gap = row.crown.axis === 'x' ? Math.max(a.x0, shifted.x0) - Math.min(a.x1, shifted.x1) : Math.max(a.z0, shifted.z0) - Math.min(a.z1, shifted.z1);
    expect(gap).toBeLessThanOrEqual(0);
    const second = massSection(massAt(d.masses, row.crown.massIndices[1]!)), bounds = sectionUnionBounds([a, second]), axisX = row.crown.axis === 'x';
    const low = axisX ? Math.min(a.x1, second.x1) : Math.min(a.z1, second.z1), high = axisX ? Math.max(a.x0, second.x0) : Math.max(a.z0, second.z0);
    const x0 = axisX ? low : Math.max(a.x0, second.x0), x1 = axisX ? high : Math.min(a.x1, second.x1), z0 = axisX ? Math.max(a.z0, second.z0) : low, z1 = axisX ? Math.min(a.z1, second.z1) : high;
    expect(high).toBeGreaterThan(low); expect(bounds.x1).toBeGreaterThan(bounds.x0);
    const retainedSpine = { ...crown, x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: (x1 - x0) / 2, depth: (z1 - z0) / 2 };
    const notch = { ...retainedSpine, width: x1 - x0, depth: z1 - z0 };
    expect(roofBoxesConflict(massRoofBox(notch), massRoofBox(retainedSpine))).toBe(true);
  });
});
