/**
 * @file anchors.test.ts — R16 global anchor pass: every trim holds its place on its owner through
 * the full loop's warp (operator report: masts and vents floating off their buildings at bends).
 */
import { describe, expect, it } from 'vitest';

import { deriveCityLayout } from '../src/sim/derive';
import {
  auditCityAnchors,
  deriveFacadeFaces,
  deriveCityMasses,
  deriveTowerProfiles,
  deriveHeroBlades,
  deriveHeroRowPlans,
  deriveNeonSigns,
  SKYRIVER_CITY_SIGN_CANDIDATE_BUDGET,
} from '../src/render/city';
import { intersectSection, sectionUnionArea } from './support/towerProfileGeometry';
import { presentCityLayout } from '../src/render/presentationLayout';
import { CANYON_LOOP_LENGTH_M } from '../src/render/canyonWarp';
import { routeAltitude, STRATA_PRISTINE_BASE_M } from '../src/render/routeProfile';
import { HERO_HORIZONTAL_CELLS, HERO_VERTICAL_CELLS } from '../src/render/signAtlas';

/** main.ts SKYRIVER_DEMO_SEED (not imported: main.ts boots the app). */
const DEMO_SEED = 424242;

describe('city trim anchors', () => {
  it('keeps every trim and facade sign on its owner all around the loop', () => {
    const audit = auditCityAnchors(presentCityLayout(deriveCityLayout(DEMO_SEED)));
    expect(audit.checked).toBeGreaterThan(5000);
    expect(audit.floating).toBe(0);
    expect(audit.maxDriftM).toBeLessThan(0.05);
    expect(audit.signsChecked).toBeGreaterThan(0);
    expect(audit.signsOffFace).toBe(0);
    expect(audit.signMaxDriftM).toBeLessThan(0.05);
    expect(audit.fullFaceFailures).toBe(0);
    expect(audit.wrongPlaneFailures).toBe(0);
    expect(audit.spacingConflicts).toBe(0);
    expect(audit.heroExclusionConflicts).toBe(0);
    expect(audit.heroCompositionConflicts).toBe(0);
    expect(audit.ordinaryCount).toBeGreaterThan(0);
    expect(audit.heroCount).toBeGreaterThan(0);
    expect(audit.acceptedByLoopSection.filter((count) => count > 0).length).toBeGreaterThanOrEqual(6);
    expect(audit.acceptedByLoopSection.reduce((sum, count) => sum + count, 0)).toBe(audit.ordinaryCount);
    expect(audit.ordinaryCount).toBeLessThan(SKYRIVER_CITY_SIGN_CANDIDATE_BUDGET);
  });

  it('keeps distinct hero compositions spaced across held-out full-loop seeds', () => {
    for (const seed of [0, 2147483647, 4294967295]) {
      const layout = presentCityLayout(deriveCityLayout(seed));
      const audit = auditCityAnchors(layout);
      const heroes = deriveHeroBlades(layout);
      expect(audit.heroCompositionConflicts).toBe(0);
      expect(heroes.filter((hero) => hero.kind === 'brand')).toHaveLength(1);
      const rows = new Map<string, number>();
      for (const hero of heroes) {
        if (!hero.compositionId.startsWith('hero-row-')) continue;
        rows.set(hero.compositionId, (rows.get(hero.compositionId) ?? 0) + 1);
      }
      expect(rows.size).toBe(deriveHeroRowPlans(layout).length);
      expect([...rows.values()].every((count) => count === 4)).toBe(true);
    }
  });
});

describe('exposed facade levels and hero rows', () => {
  it('keeps stepped faces on the existing lots and reserves four-blade hosts', () => {
    const base = deriveCityLayout(DEMO_SEED);
    const layout = presentCityLayout(base);
    const plannedRows = deriveHeroRowPlans(layout);
    const faces = deriveFacadeFaces(layout).filter((face) => face.planeAxis === 'x');
    const freshLots = presentCityLayout(deriveCityLayout(DEMO_SEED)).towers;
    expect(layout.towers).toHaveLength(freshLots.length);
    expect(layout.towers.map((tower) => `${tower.x}:${tower.z}:${tower.height}`))
      .toEqual(freshLots.map((tower) => `${tower.x}:${tower.z}:${tower.height}`));

    const towersById = new Map(layout.towers.map((tower) => [`tower:${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`, tower]));
    const levels = new Map<string, typeof faces>();
    for (const face of faces) levels.set(face.buildingId, [...(levels.get(face.buildingId) ?? []), face]);
    const tall = [...levels].filter(([id]) => (towersById.get(id)?.height ?? 0) >= 1800);
    expect(tall.length).toBeGreaterThan(0);
    const profiles = deriveTowerProfiles(layout), masses = deriveCityMasses(layout);
    for (const [id, buildingFaces] of levels) {
      const profile = profiles.find(row => row.towerKey === id);
      if (!profile || !('stages' in profile)) throw new Error('R36_FACE_PROFILE_MISSING');
      for (const stage of profile.stages) for (const index of stage.massIndices) {
        const mass = masses[index]; if (!mass) throw new Error('R36_FACE_STAGE_MASS_MISSING');
        const plane = mass.x - Math.sign(towersById.get(id)!.x) * mass.width / 2;
        if (mass.y0 + mass.height <= 0) continue;
        const requested = { x0: mass.z - mass.depth / 2, x1: mass.z + mass.depth / 2,
          z0: Math.max(0, mass.y0), z1: mass.y0 + mass.height };
        expect(requested.z1).toBeGreaterThan(requested.z0);
        const stageFaces = buildingFaces.filter(f => Math.abs(f.plane - plane) < 1e-7
          && f.owner.x === mass.x && f.owner.z === mass.z
          && f.owner.width === mass.width && f.owner.depth === mass.depth
          && (f.owner.yawRad ?? 0) === (mass.yawRad ?? 0)
          && JSON.stringify(f.owner.yawAnchor) === JSON.stringify(mass.yawAnchor));
        const rectangles = stageFaces.flatMap(f => {
          const clipped = intersectSection(requested, { x0: f.u0, x1: f.u1, z0: f.y0, z1: f.y1 });
          if (!clipped) return [];
          expect(f.stepBottom).toBe(stage.stageIndex > 0);
          return [clipped];
        });
        const area = (requested.x1 - requested.x0) * (requested.z1 - requested.z0);
        expect(Math.abs(sectionUnionArea(rectangles) - area), `${id}:stage${stage.stageIndex}:exposed-face-area`)
          .toBeLessThanOrEqual(Math.max(1e-7, area * 1e-10));
      }

    }
    const lowMid = [...levels].filter(([id]) => { const height = towersById.get(id)?.height ?? 0; return height >= 700 && height < 1800; });
    expect(lowMid.length).toBeGreaterThan(0);

    const rows = new Map<string, number>();
    const heroes = deriveHeroBlades(layout);
    const stations = heroes.filter((hero) => hero.compositionId.startsWith('hero-') && !hero.compositionId.startsWith('hero-row-'));
    expect(stations).toHaveLength(25);
    expect(heroes).toHaveLength(42);
    let bladeSlot = 0;
    let panelSlot = 0;
    for (let k = 0; k * 530 < CANYON_LOOP_LENGTH_M; k += 1) {
      const z = -CANYON_LOOP_LENGTH_M / 2 + (k + 0.5) * 530;
      const kind = routeAltitude(z) > STRATA_PRISTINE_BASE_M - 50 || k % 3 === 2 ? 'panel' : 'blade';
      const hero = stations.find((candidate) => candidate.compositionId === `hero-${k}`);
      expect(hero).toBeDefined();
      expect(hero?.cell).toBe(kind === 'blade' ? bladeSlot++ : panelSlot++);
    }
    for (const hero of heroes) {
      if (hero.compositionId.startsWith('hero-row-')) rows.set(hero.compositionId, (rows.get(hero.compositionId) ?? 0) + 1);
    }
    expect(rows.size).toBe(plannedRows.length);
    expect(plannedRows.length).toBeGreaterThan(0);
    expect([...rows.values()].every((count) => count === 4)).toBe(true);
    const verticalCells = heroes.filter((hero) => hero.kind !== 'panel')
      .map((hero) => hero.cell % HERO_VERTICAL_CELLS);
    const horizontalCells = heroes.filter((hero) => hero.kind === 'panel').map((hero) => hero.cell);
    const rowCells = heroes.filter((hero) => hero.compositionId.startsWith('hero-row-')).map((hero) => hero.cell % HERO_VERTICAL_CELLS);
    expect(new Set(rowCells).size).toBe(16);
    expect(verticalCells.every((cell) => cell >= 0 && cell < HERO_VERTICAL_CELLS)).toBe(true);
    expect(horizontalCells.every((cell) => Number.isInteger(cell) && cell >= 0)).toBe(true);
    expect(heroes.find((hero) => hero.kind === 'brand')?.cell).toBe(0);
  });
});

describe('signs under their roofs', () => {
  it('keeps every facade and hero sign below the roof of the slab it stands on (R17 podium lots)', () => {
    const layout = presentCityLayout(deriveCityLayout(DEMO_SEED));
    const signs = deriveNeonSigns(layout);
    let above = 0;
    for (let i = 0; i < signs.count; i += 1) {
      const owner = signs.owner[i];
      if (!owner) continue;
      const buildingId = signs.buildingId[i];
      const tower = layout.towers.find((t) => `tower:${t.x.toFixed(2)}:${t.z.toFixed(2)}` === buildingId);
      if (tower !== undefined && signs.cy[i]! + signs.sh[i]! / 2 > tower.height + 1) above += 1;
    }
    for (const hero of deriveHeroBlades(layout)) {
      if (hero.kind === 'brand') continue;
      const slabs = layout.towers.filter((t) => `tower:${t.x.toFixed(2)}:${t.z.toFixed(2)}` === hero.buildingId);
      if (slabs.length === 0) continue;
      const slab = slabs.reduce((best, t) => (Math.abs(t.x) < Math.abs(best.x) ? t : best));
      if (hero.y + hero.height / 2 > slab.height + 1) above += 1;
    }
    expect(above).toBe(0);
  });
});
