import { describe, expect, it } from 'vitest';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import { deriveCityMasses, deriveTowerProfiles, deriveRetainedMassSupportRecords } from '../src/render/city';
import { verifiedR36DarkMassIds } from './support/r36DarkMassIds';

const layout = presentCityLayout(deriveCityLayout(424242));
const masses = deriveCityMasses(layout), profiles = deriveTowerProfiles(layout), records = deriveRetainedMassSupportRecords(layout);
const row = profiles.find(p => p.eligibility.kind === 'eligible' && 'stages' in p);
if (!row || !('stages' in row)) throw new Error('R36_MASK_REAL_PROFILE_CONTROL');
const crownIndex = row.crown.massIndices[0], stageIndex = row.stages[0]?.massIndices[0];
if (stageIndex === undefined) throw new Error('R36_MASK_REAL_STAGE_CONTROL');

describe('R36 actual mask domain negative controls', () => {
  it('accepts actual supported crown and bridge members', () => {
    const ids = verifiedR36DarkMassIds(layout, masses, profiles, records);
    expect(ids.has(crownIndex)).toBe(true);
    expect(records.every(record => ids.has(record.supportMassIndex))).toBe(true);
    expect(ids.has(stageIndex)).toBe(false);
  });
  it('rejects a false claimed crown roof even with the same owner', () => {
    const changed = profiles.map(profile => profile === row ? {
      ...row, stages: row.stages.map((stage, i) => i === row.stages.length - 1
        ? { ...stage, massIndices: [crownIndex] } : stage),
    } : profile);
    expect(() => verifiedR36DarkMassIds(layout, masses, changed, records)).toThrow('R36_DARK_CROWN_CONTACT');
  });
  it('rejects a role on an actual ordinary stage that is not a crown member', () => {
    const changed = masses.map((mass, i) => i === stageIndex ? { ...mass, crownRole: 'ordinary-dark-crown' as const } : mass);
    expect(() => verifiedR36DarkMassIds(layout, changed, profiles, records)).toThrow('R36_DARK_CROWN_UNPUBLISHED');
  });
  it('rejects an actual bridge when its published record is removed', () => {
    expect(() => verifiedR36DarkMassIds(layout, masses, profiles, records.slice(1))).toThrow('R36_DARK_BRIDGE_UNPUBLISHED');
  });
});
