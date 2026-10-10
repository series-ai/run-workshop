import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import { deriveTowerProfiles, deriveCityMasses, deriveFarTowers, deriveHeroBlades, deriveFacadeFaces, buildingSeedOf } from '../../src/render/city';
import type { SkyriverCityLayout } from '../../src/sim/derive';
import before from '../fixtures/r36-preserved-before.json';
import { assertR36UnchangedGroups } from './r36UnchangedGroups';
import packedBefore from '../fixtures/r36-protected-packed-before.json';

function sha(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

/** Preserve identity outside the approved tower/host geometry change. */
export function assertR36PreservedIdentity(layout: SkyriverCityLayout): void {
  const saved = before.rows.find(r => r.seed === layout.seed); if (!saved) throw new Error('R36_BEFORE_SEED_MISSING');
  expect(sha(layout)).toBe(saved.layoutSha256);
  assertR36UnchangedGroups(layout);
  const cachedBefore = packedBefore.rows.find(row => row.seed === layout.seed && row.mode === 'geometry');
  if (!cachedBefore) throw new Error('R36_FACADE_OWNER_BASELINE_MISSING');
  expect([...new Set(deriveFacadeFaces(layout).map(face => face.buildingId))].sort()).toEqual(cachedBefore.faceOwners);
  expect(sha(deriveFarTowers(layout))).toBe(saved.farSha256);
  const heroes = deriveHeroBlades(layout);
  expect(heroes.map(({ x, y, z, faceId, owner, ...identity }) => { void x; void y; void z; void faceId; void owner; return identity; })).toEqual(saved.heroSignatures);
  expect(heroes.filter(h => h.kind === 'brand')).toEqual(saved.brand);
  const profiles = deriveTowerProfiles(layout), masses = deriveCityMasses(layout);
  expect(profiles).toHaveLength(layout.towers.length);
  for (const row of profiles) {
    const tower = layout.towers[row.towerIndex]; if (!tower) throw new Error('R36_ORIGINAL_TOWER_MISSING');
    expect(row.materialOwner).toBe(buildingSeedOf(tower.x, tower.z)); expect(row.building).toBe(row.materialOwner);
    if (!('stages' in row)) throw new Error('R36_ORDINARY_TOWER_EXCLUDED');
    expect(row.stages.length).toBeGreaterThanOrEqual(2); expect(row.stages.length).toBeLessThanOrEqual(4);
    for (const stage of row.stages) for (const i of stage.massIndices) {
      const mass = masses[i]; if (!mass) throw new Error('R36_ACTUAL_STAGE_MISSING');
      expect(mass.building).toBe(row.building); expect(mass.materialOwner).toBe(row.materialOwner);
      expect(mass.anchorV).toBe(tower.z); expect(Math.min(mass.width, mass.height, mass.depth)).toBeGreaterThan(0);
    }
  }
}
