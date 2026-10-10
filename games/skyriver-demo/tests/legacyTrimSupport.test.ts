import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { buildingSeedOf, deriveCityMasses, deriveCityTrims, deriveHeroBlades, deriveRoofDetails } from '../src/render/city';
import before from './fixtures/r36-legacy-trim-support-before.json';
import beforeSpans from './fixtures/r36-span-contact-before.json';
import { inspectLegacySpanContacts, type LegacySpanContactRecord } from './support/legacySpanContact';
import { inspectLegacyTrimSupport, legacyTrimSupportKey, type LegacyTrimSupportGroup } from './support/legacyTrimSupport';

interface SavedGroup {
  readonly valid: number;
  readonly invalid: number;
}

function savedGroups(owners: readonly number[], rows: readonly (readonly number[])[]): ReadonlyMap<string, SavedGroup> {
  return new Map(rows.map(row => {
    if (row.length !== 5 || row.some(value => !Number.isInteger(value) || value < 0)) throw new Error('R36_SUPPORT_FIXTURE_ROW');
    const owner = owners[row[0]!];
    if (owner === undefined) throw new Error('R36_SUPPORT_FIXTURE_OWNER');
    return [legacyTrimSupportKey(owner, row[1]!, row[2]!), { valid: row[3]!, invalid: row[4]! }];
  }));
}

/** Mixed seed collisions use exact retained physical identities as a multiset. */
function unmatchedInvalidMembers(group: LegacyTrimSupportGroup, inherited: readonly string[]): number {
  const remaining = new Map<string, number>();
  for (const identity of inherited) remaining.set(identity, (remaining.get(identity) ?? 0) + 1);
  let unmatched = 0;
  for (const identity of group.invalidIdentities) {
    const count = remaining.get(identity) ?? 0;
    if (count === 0) unmatched++;
    else remaining.set(identity, count - 1);
  }
  return unmatched;
}

const seeds = before.rows.map(row => row.seed);
const actual = new Map(seeds.map(seed => {
  const layout = presentCityLayout(deriveCityLayout(seed));
  const trims = deriveCityTrims(layout);
  const ordinary = new Set(layout.towers.map(tower => buildingSeedOf(tower.x, tower.z)));
  return [seed, inspectLegacyTrimSupport(deriveCityMasses(layout), trims,
    deriveRoofDetails(layout).oldTrimCount, deriveHeroBlades(layout), ordinary)];
}));

for (const saved of before.rows) {
  for (const category of ['roof', 'side'] as const) {
    it(`retains baseline-relative ${category} support at seed ${saved.seed}`, () => {
      const current = actual.get(saved.seed)![category];
      const baseline = savedGroups(saved.owners, saved[category]);
      const sourceMultiplicity = new Map(saved.additionalSourceMultiplicity.map(row =>
        [legacyTrimSupportKey(saved.owners[row[0]!]!, row[1]!, row[2]!), row[3]!]));
      const collisions = new Map(saved.mixedRoofGroups.map(group =>
        [legacyTrimSupportKey(group.owner, group.kind, group.seedBits), group.invalidIdentities]));
      const lost: { key: string; indices: readonly number[]; count: number }[] = [];
      const duplicated: string[] = [];
      let inheritedInvalid = 0;
      let matchedNewLoss = 0;
      let newlyVisibleInvalid = 0;
      let retired = 0;
      let newlyVisibleValid = 0;
      for (const [key, group] of current) {
        const prior = baseline.get(key);
        const sourceCount = sourceMultiplicity.get(key) ?? (prior ? prior.valid + prior.invalid : 0);
        if (sourceCount > 0 && group.valid.length + group.invalid.length > sourceCount) duplicated.push(key);
        if (!prior) newlyVisibleValid += group.valid.length;
        const newInvalid = !prior || prior.invalid === 0 ? group.invalid.length
          : prior.valid === 0 ? Math.max(0, group.invalid.length - prior.invalid)
          : unmatchedInvalidMembers(group, collisions.get(key) ?? []);
        inheritedInvalid += group.invalid.length - newInvalid;
        if (prior) matchedNewLoss += newInvalid;
        else newlyVisibleInvalid += newInvalid;
        if (newInvalid > 0) lost.push({ key, indices: group.invalid, count: newInvalid });
      }
      for (const [key, prior] of baseline) {
        const group = current.get(key);
        retired += Math.max(0, prior.valid + prior.invalid - (group ? group.valid.length + group.invalid.length : 0));
      }
      const result = {
        seed: saved.seed, category, baseline: saved.counts[category],
        retainedInheritedInvalid: inheritedInvalid, absentOrIdentityChangedOrHeroFiltered: retired,
        newlyVisibleValid, newlyVisibleInvalid, matchedNewLoss, newLostSupport: lost.reduce((n, row) => n + row.count, 0),
        ambiguousMultiplicityGrowth: duplicated, examples: lost.slice(0, 8),
      };
      const out = process.env.R36_SUPPORT_OUT;
      if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${saved.seed}-${category}.json`), JSON.stringify(result, null, 2) + '\n'); }
      expect(duplicated, 'Known baseline owner/kind/seed multiplicity must not grow without a real source mapping').toEqual([]);
      expect(result.newLostSupport, JSON.stringify(result)).toBe(0);
    });
  }
}


for (const saved of beforeSpans.rows) {
  it(`retains real span endpoint contact at seed ${saved.seed}`, () => {
    const layout = presentCityLayout(deriveCityLayout(saved.seed));
    const records = inspectLegacySpanContacts(deriveCityMasses(layout), deriveCityTrims(layout),
      deriveRoofDetails(layout).oldTrimCount, deriveHeroBlades(layout));
    const groups = new Map<string, LegacySpanContactRecord[]>();
    for (const record of records) {
      const group = groups.get(record.key) ?? []; group.push(record); groups.set(record.key, group);
    }
    const baseline = new Map(saved.groups.map(group => [group.key, group]));
    const losses: { readonly key: string; readonly count: number; readonly records: readonly LegacySpanContactRecord[] }[] = [];
    const duplicates: string[] = [];
    let retainedInheritedInvalid = 0;
    for (const [key, group] of groups) {
      const prior = baseline.get(key);
      const invalid = group.filter(record => !record.bothContacts);
      const count = Math.max(0, invalid.length - (prior?.invalid ?? 0));
      if (prior && group.length > prior.valid + prior.invalid) duplicates.push(key);
      retainedInheritedInvalid += invalid.length - count;
      if (count > 0) losses.push({ key, count, records: invalid });
    }
    const result = {
      seed: saved.seed, category: 'span', beforeChecked: saved.checked,
      baselineInheritedInvalid: saved.inheritedInvalid, retainedInheritedInvalid,
      afterChecked: records.length, newLostContact: losses.reduce((n, loss) => n + loss.count, 0),
      ambiguousMultiplicityGrowth: duplicates, examples: losses.slice(0, 8),
    };
    const out = process.env.R36_SUPPORT_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${saved.seed}-span.json`), JSON.stringify(result, null, 2) + '\n'); }
    expect(duplicates, 'A span identity includes both real canonical endpoints').toEqual([]);
    expect(result.newLostContact, JSON.stringify(result)).toBe(0);
  });
}

describe('legacy support scope', () => {
  it('keeps the actual inherited roof failures separate from new losses', () => {
    expect(before.sourceSha256).toBe('c21b0bab5f530a5441d1f5277fb1176c4ba4e8bb5233a070621b779becdfaf2b');
    expect(before.rows.map(row => row.counts.roof.invalid)).toEqual([492, 481, 451, 504, 465]);
    expect(before.rows.map(row => row.counts.side.invalid)).toEqual([0, 0, 0, 0, 0]);
    expect(beforeSpans.rows.map(row => row.inheritedInvalid)).toEqual([2, 1, 1, 1, 2]);
  });
});
