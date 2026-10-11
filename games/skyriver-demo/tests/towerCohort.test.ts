import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveCityLayout } from '../src/sim/derive';
import { presentCityLayout } from '../src/render/presentationLayout';
import cohort from '../tools/render-evidence/tower-cohort.json';

describe('R41 permanent tower census', () => {
  it('binds every saved tower to the current seeded layout', () => {
    const towers = presentCityLayout(deriveCityLayout(cohort.seed)).towers;
    expect(towers).toHaveLength(211);
    expect(cohort.rows).toHaveLength(towers.length);
    for (const [index, tower] of towers.entries()) {
      const row = cohort.rows[index]!;
      expect(row.id).toBe(`tower-${index}-r41`);
      expect(row.towerIndex).toBe(index);
      expect(row.key).toBe(`${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`);
      expect(row.sourceTowerNode).toEqual(tower);
      expect([row.sourceTower.x, row.sourceTower.z]).toEqual([tower.x, tower.z]);
    }
  });

  it('keeps the fixed sample and all baseline fingerprints', () => {
    expect(cohort.rule.version).toBe('r41-coverage-v1');
    expect(cohort.selected137.indices).toEqual(Array.from({ length: 137 }, (_, k) => Math.floor(k * 211 / 137)));
    expect(cohort.selected137.ids).toEqual(cohort.selected137.indices.map(i => cohort.rows[i]!.id));
    expect(new Set(cohort.rows.map(row => row.baselineFingerprint)).size).toBe(211);
    expect(cohort.baselineFailedIds).toEqual([]);
    for (const row of cohort.rows) expect(row.baselineFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the complete capture archive with its recorded hash', () => {
    const bytes = readFileSync(new URL('../tools/render-evidence/tower-cohort-baseline.zip', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(cohort.archive.sha256);
    expect(bytes.byteLength).toBe(cohort.archive.bytes);
  });
});
