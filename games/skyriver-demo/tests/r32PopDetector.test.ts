import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import baseline from './fixtures/r32-pop-css.json';

const source = readFileSync(new URL('../tools/render-evidence/popdetect.cjs', import.meta.url), 'utf8');
const helper: unknown = createRequire(import.meta.url)('./support/popDetectorHarness.cjs');
if (typeof helper !== 'object' || helper === null || !('execute' in helper) || typeof helper.execute !== 'function') throw new Error('R32_DETECTOR_HARNESS_MISSING');
const execute = helper.execute;

describe('R32 independent production detector units', () => {
  it.each(baseline.rows)('matches frozen CSS events and attribution at $css DPR$dpr', row => {
    const result: unknown = execute(source, false, row.css[0], row.css[1], row.dpr);
    if (typeof result !== 'object' || result === null || !('counts' in result) || !('events' in result)) throw new Error('R32_DETECTOR_OUTPUT_MISSING');
    const counts = result.counts;
    if (typeof counts !== 'object' || counts === null) throw new Error('R32_DETECTOR_COUNTS_MISSING');
    const actual = Object.fromEntries(['lightPopIn', 'lightPopOut', 'lightFlicker', 'readbacks'].map(key => {
      if (!(key in counts)) throw new Error('R32_DETECTOR_COUNT_MISSING:' + key);
      return [key, Reflect.get(counts, key)];
    }));
    expect({ counts: actual, events: result.events }).toEqual(row.expected);
    expect(actual).toEqual({ lightPopIn: 3, lightPopOut: 3, lightFlicker: 1, readbacks: 6 });
    expect(row.expected.events.some(event => event.cls === 'same_car_impostor')).toBe(true);
    expect(row.expected.events.some(event => event.cls === 'stream')).toBe(true);
  });

  it('keeps the held-out thresholds, neighborhood rules, and real-time schedule', () => {
    expect(source).toContain('window.__POP_HI || 170'); expect(source).toContain('window.__POP_LO || 60');
    expect(source).toContain('const C = 4; const R = 3;');
    expect(source).toContain('let best = null; let bd = 100;');
    expect(source).toContain('return n <= 8;');
    expect(source).toContain('cellW = C * scaleX; cellH = C * scaleY;');
    expect(source).toContain('if (performance.now() < end) requestAnimationFrame(frame); else done();');
    expect(source).not.toContain('page.clock');
    expect(source).not.toContain('fixedFrames');
    expect(source).toContain("if (![1, 1.25].includes(proofDpr))");
  });
});
