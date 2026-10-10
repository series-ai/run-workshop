import { createHash } from 'node:crypto';
import { expect } from 'vitest';
import { buildingSeedOf, deriveCityMasses, deriveCityTrims, deriveRoofDetails, type SkyriverMass } from '../../src/render/city';
import type { SkyriverCityLayout } from '../../src/sim/derive';
import before from '../fixtures/r36-unaffected-before.json';
import r27Before from '../fixtures/r36-r27-fixed-before.json';

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonicalOwner = (mass: SkyriverMass) => mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);

/** Canonical identity decides scope. Missing building or anchor fields do not make a body unrelated. */
export function assertR36UnchangedGroups(layout: SkyriverCityLayout): void {
  const saved = before.rows.find(row => row.seed === layout.seed);
  if (!saved) throw new Error('R36_UNCHANGED_SEED_MISSING');
  const ordinary = new Set(layout.towers.map(t => buildingSeedOf(t.x, t.z)));
  expect([...ordinary].sort((a, b) => a - b)).toEqual(saved.ordinaryOwners);
  const landmarkOwners = new Set(saved.landmarkOwners);
  const r27Saved = r27Before.rows.find(row => row.seed === layout.seed);
  if (!r27Saved) throw new Error('R36_R27_BASELINE_MISSING');
  const allMasses = deriveCityMasses(layout);
  const baseRecords = allMasses.filter(m => m.baseRecord);
  expect(baseRecords.length, `${layout.seed}:fixed-R27-count`).toBe(r27Saved.count);
  expect(sha(baseRecords), `${layout.seed}:fixed-R27-fields`).toBe(r27Saved.sha256);
  const masses = allMasses.filter(m => !m.baseRecord && !ordinary.has(canonicalOwner(m)));
  const groups = {
    far: masses.filter(m => (m.layer ?? 0) > 0),
    landmarks: masses.filter(m => (m.layer ?? 0) === 0 && landmarkOwners.has(canonicalOwner(m))),
    service: masses.filter(m => (m.layer ?? 0) === 0 && !landmarkOwners.has(canonicalOwner(m))),
  };
  for (const name of ['far', 'landmarks', 'service'] as const) {
    expect(groups[name].length, `${layout.seed}:${name}:count`).toBe(saved.masses[name].count);
    expect(sha(groups[name]), `${layout.seed}:${name}:unchanged-fields`).toBe(saved.masses[name].sha256);
  }
  const trims = deriveCityTrims(layout), prefix = deriveRoofDetails(layout).oldTrimCount;
  const rows = [];
  for (let i = 0; i < prefix; i++) {
    const on = trims.owner[i], to = trims.spanTo[i];
    if (!on) throw new Error('R36_PREFIX_OWNER_MISSING');
    if (ordinary.has(on.materialOwner ?? buildingSeedOf(on.x, on.z))
      || (to && ordinary.has(to.materialOwner ?? buildingSeedOf(to.x, to.z)))) continue;
    rows.push({ owner: on, spanTo: to, cx: trims.cx[i], cy: trims.cy[i], cz: trims.cz[i],
      sx: trims.sx[i], sy: trims.sy[i], sz: trims.sz[i], kind: trims.kind[i], seedValue: trims.seedValue[i] });
  }
  const footprintKey = (on: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly anchorV?: number; readonly materialOwner?: number }) =>
    JSON.stringify([on.x, on.z, on.width, on.depth, on.anchorV ?? on.z, on.materialOwner]);
  const baseOwners = new Set(baseRecords.map(footprintKey));
  const baseRows = [];
  for (let i = 0; i < prefix; i++) {
    const on = trims.owner[i];
    if (!on) throw new Error('R36_BASE_PREFIX_OWNER_MISSING');
    if (!baseOwners.has(footprintKey(on))) continue;
    baseRows.push({ owner: on, spanTo: trims.spanTo[i], cx: trims.cx[i], cy: trims.cy[i], cz: trims.cz[i],
      sx: trims.sx[i], sy: trims.sy[i], sz: trims.sz[i], kind: trims.kind[i], seedValue: trims.seedValue[i] });
  }
  expect(baseRows.length, `${layout.seed}:fixed-R27-prefix-count`).toBe(r27Saved.baseOwnedPrefixTrims.count);
  expect(sha(baseRows), `${layout.seed}:fixed-R27-prefix-fields`).toBe(r27Saved.baseOwnedPrefixTrims.sha256);
  expect(rows.length, `${layout.seed}:unaffected-prefix-count`).toBe(saved.unaffectedPrefixTrims.count);
  expect(sha(rows), `${layout.seed}:unaffected-prefix-fields`).toBe(saved.unaffectedPrefixTrims.sha256);
}
