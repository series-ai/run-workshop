import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildingSeedOf, deriveCityMasses, SKYRIVER_CITY_VOID_BASE_Y } from '../src/render/city';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import before from './fixtures/r36-retained-child-support-before.json';
import { massRoofBox } from './support/rooftopDetailsGeometry';
import { matchRetainedMassOccurrences, readRetainedMassHosts, readRetainedMassRecords, retainedMassContact, retainedMassContactQuery } from './support/retainedMassContact';

const DATA = before.seeds.map(oracle => {
  const masses = deriveCityMasses(presentCityLayout(deriveCityLayout(oracle.seed))), records = readRetainedMassRecords(oracle.records, oracle.originalMassCount);
  const witnesses = readRetainedMassHosts(oracle.hosts, oracle.originalMassCount), matching = matchRetainedMassOccurrences(records, masses), boxes = masses.map(massRoofBox);
  return { oracle, masses, records, witnesses, matching, boxes, contact: retainedMassContactQuery(boxes) };
});
const owner = (mass: typeof DATA[number]['masses'][number]) => mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('R36 retained child mass support from actual c6 occurrences', () => {
  it.each(DATA)('keeps each exact source occurrence once at seed $oracle.seed', ({ oracle, matching }) => {
    expect(matching.missing).toEqual([]); expect(matching.matched).toHaveLength(oracle.retainedCount);
    expect(new Set(matching.matched.map(row => row.finalIndex)).size).toBe(oracle.retainedCount);
    expect(hash(matching.matched.map(row => [row.record.originalIndex, row.mass]))).toBe(oracle.indexedRetainedInventorySha256);
  });

  it.each(DATA)('passes every original support witness with the same oracle at seed $oracle.seed', ({ oracle, matching, witnesses }) => {
    expect(matching.missing).toEqual([]);
    let supported = 0, foundation = 0, inherited = 0, edgeOnly = 0;
    for (const row of matching.matched) {
      if (row.record.baselineClass === 'foundation') { foundation++; expect(row.mass.y0).toBeLessThanOrEqual(SKYRIVER_CITY_VOID_BASE_Y); continue; }
      if (row.record.baselineClass === 'inherited-unsupported') { inherited++; expect(row.record.witnessHostIndex).toBeNull(); continue; }
      if (row.record.baselineClass === 'edge-only') { edgeOnly++; expect(row.record.witnessHostIndex).toBeNull(); continue; }
      supported++;
      const index = row.record.witnessHostIndex;
      if (index === null) throw new Error('R36_CHILD_BASELINE_WITNESS');
      const witness = witnesses.get(index); if (!witness) throw new Error('R36_CHILD_BASELINE_HOST');
      expect(retainedMassContact(massRoofBox(row.mass), witness), `c6:${row.record.originalIndex}:${index}`).not.toBeNull();
    }
    expect({ supported, foundation, inherited, edgeOnly }).toEqual({ supported: oracle.counts.supported, foundation: oracle.counts.foundation, inherited: oracle.counts.inheritedUnsupported, edgeOnly: oracle.counts.edgeOnly });
  });

  it.each(DATA)('does not detach any previously supported retained child at seed $oracle.seed', ({ oracle, masses, matching, boxes, contact }) => {
    expect(matching.missing).toEqual([]);
    const lost: unknown[] = []; let checked = 0, sameOwnerLostWithForeignContact = 0;
    for (const row of matching.matched) {
      if (row.record.baselineClass !== 'supported') continue;
      checked++;
      const hits = contact(boxes[row.finalIndex]!, row.finalIndex);
      if (hits.length === 0) lost.push({ originalIndex: row.record.originalIndex, finalIndex: row.finalIndex, identitySha256: row.record.identitySha256, mass: row.mass, originalHostIndex: row.record.witnessHostIndex });
      else if (row.record.oldSameOwnerContact && !hits.some(index => owner(masses[index]!) === owner(row.mass) && (masses[index]!.anchorV ?? masses[index]!.z) === (row.mass.anchorV ?? row.mass.z))) sameOwnerLostWithForeignContact++;
    }
    const result = { seed: oracle.seed, checked, newLostContact: lost.length, sameOwnerLostWithForeignContact, sourceFoundation: oracle.counts.foundation, inheritedUnsupported: oracle.counts.inheritedUnsupported, inheritedEdgeOnly: oracle.counts.edgeOnly, lost };
    const out = process.env.R36_CHILD_SUPPORT_OUT;
    if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, `${oracle.seed}-support.json`), JSON.stringify(result, null, 2) + '\n'); }
    expect(checked).toBe(oracle.counts.supported);
    expect(lost, JSON.stringify({ ...result, lost: lost.slice(0, 3) })).toEqual([]);
  });

  it('rejects a missing original occurrence without owner-only matching', () => {
    const data = DATA[0]!;
    const supported = data.matching.matched.find(row => row.record.baselineClass === 'supported');
    if (!supported) throw new Error('R36_CHILD_CONTROL_SOURCE');
    const removed = data.masses.filter((_, index) => index !== supported.finalIndex);
    expect(matchRetainedMassOccurrences(data.records, removed).missing.length).toBeGreaterThan(0);
  });

  it('rejects physical detachment and corner-only contact', () => {
    const data = DATA[0]!, supported = data.matching.matched.find(row => row.record.baselineClass === 'supported');
    if (!supported || supported.record.witnessHostIndex === null) throw new Error('R36_CHILD_CONTROL_SOURCE');
    const child = massRoofBox(supported.mass), witness = data.witnesses.get(supported.record.witnessHostIndex);
    if (!witness) throw new Error('R36_CHILD_CONTROL_HOST');
    expect(retainedMassContact(child, witness)).not.toBeNull();
    expect(retainedMassContact(child, { ...witness, x: witness.x + 100000, z: witness.z + 100000 })).toBeNull();
    const corner = { ...child, x: child.x + 2 * child.hx * child.c + 2 * child.hz * child.s, z: child.z - 2 * child.hx * child.s + 2 * child.hz * child.c };
    expect(retainedMassContact(child, corner)).toBeNull();
  });
});
