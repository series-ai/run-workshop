import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerfRecorder } from './recorder';

describe('performance timeline', () => {
  let now: number;
  let recorder: PerfRecorder;
  let clock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    now = 100;
    clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    recorder = new PerfRecorder();
  });

  afterEach(() => {
    recorder.dispose();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([1, 2])('keeps all timeline bins when the raw capacity is %i', (capacity) => {
    recorder.start({ capacity, maxDurationMs: 60_000 });
    now = 200;
    recorder.frame(10, 5);
    const first = recorder.beginPhase('sim.total');
    now = 300;
    recorder.endPhase('sim.total', first);
    recorder.count('sim.bodyCount', 5);
    now = 1_000;
    recorder.count('sim.bodyCount', 7);
    now = 1_200;
    recorder.frame(11, 6);
    const second = recorder.beginPhase('sim.total');
    now = 1_300;
    recorder.endPhase('sim.total', second);
    recorder.count('sim.bodyCount', 3);
    now = 2_600;
    const report = recorder.export();
    expect(report.recordCount).toBe(capacity);
    expect(report.overwrittenRecords).toBeGreaterThan(0);
    expect(report.timeline.binDurationMs).toBe(1_000);
    expect(report.timeline.bins).toEqual([
      {
        startOffsetMs: 0, endOffsetMs: 1_000,
        firstRenderFrame: 10, lastRenderFrame: 10, firstSimFrame: 5, lastSimFrame: 5,
        phases: { 'sim.total': { count: 1, totalMs: 100, meanMs: 100, maxMs: 100 } },
        counters: { 'sim.bodyCount': { count: 2, min: 5, max: 7, mean: 6, last: 7 } },
      },
      {
        startOffsetMs: 1_000, endOffsetMs: 2_000,
        firstRenderFrame: 11, lastRenderFrame: 11, firstSimFrame: 6, lastSimFrame: 6,
        phases: { 'sim.total': { count: 1, totalMs: 100, meanMs: 100, maxMs: 100 } },
        counters: { 'sim.bodyCount': { count: 1, min: 3, max: 3, mean: 3, last: 3 } },
      },
      {
        startOffsetMs: 2_000, endOffsetMs: 2_500,
        firstRenderFrame: null, lastRenderFrame: null, firstSimFrame: null, lastSimFrame: null,
        phases: {}, counters: {},
      },
    ]);
  });

  it('covers all sixty seconds with a one-record raw ring', () => {
    recorder.start({ capacity: 1, maxDurationMs: 60_000 });
    for (let second = 0; second < 60; second += 1) {
      now = 110 + second * 1_000;
      recorder.frame(second + 1, second + 20);
      recorder.count('sim.bodyCount', second);
    }
    now = 60_100;
    const report = recorder.export();
    expect(report.recordCount).toBe(1);
    expect(report.timeline.bins).toHaveLength(60);
    for (let second = 0; second < 60; second += 1) {
      expect(report.timeline.bins[second]).toMatchObject({
        startOffsetMs: second * 1_000, endOffsetMs: (second + 1) * 1_000,
        firstRenderFrame: second + 1, lastRenderFrame: second + 1,
        firstSimFrame: second + 20, lastSimFrame: second + 20,
        counters: { 'sim.bodyCount': { count: 1, min: second, max: second, mean: second, last: second } },
      });
    }
  });

  it('assigns the full phase to its start bin when it crosses a bin boundary', () => {
    recorder.start({ capacity: 2, maxDurationMs: 3_000 });
    now = 1_000;
    recorder.frame(4, 2);
    const start = recorder.beginPhase('sim.total');
    now = 1_500;
    recorder.endPhase('sim.total', start);
    const report = recorder.export();
    expect(report.timeline.bins[0]!.phases['sim.total']).toEqual({ count: 1, totalMs: 500, meanMs: 500, maxMs: 500 });
    expect(report.timeline.bins[1]!.phases).toEqual({});
  });

  it('resets all bins and frame bounds on a new capture', () => {
    recorder.start({ capacity: 1 });
    now = 200;
    recorder.frame(4, 2);
    recorder.count('sim.bodyCount', 70);
    recorder.stop();
    now = 5_000;
    recorder.start({ capacity: 1 });
    now = 5_100;
    recorder.frame(9, 8);
    recorder.count('sim.steps', 1);
    const report = recorder.export();
    expect(report.timeline.bins).toEqual([{
      startOffsetMs: 0, endOffsetMs: 100,
      firstRenderFrame: 9, lastRenderFrame: 9, firstSimFrame: 8, lastSimFrame: 8,
      phases: {}, counters: { 'sim.steps': { count: 1, min: 1, max: 1, mean: 1, last: 1 } },
    }]);
  });

  it('does no clock work while off and keeps stopped exports stable', () => {
    recorder.beginPhase('sim.total');
    recorder.endPhase('sim.total', 1);
    recorder.count('sim.steps', 1);
    recorder.frame(1, 1);
    recorder.input('sample', 1, 1);
    expect(recorder.inputEvent(1)).toBe(0);
    recorder.stop();
    expect(clock).not.toHaveBeenCalled();
    recorder.start({ capacity: 1 });
    now = 500;
    recorder.frame(1, 1);
    recorder.stop();
    const stopped = recorder.export();
    const calls = clock.mock.calls.length;
    now = 50_000;
    recorder.beginPhase('sim.total');
    recorder.endPhase('sim.total', 101);
    recorder.count('sim.steps', 2);
    recorder.frame(2, 2);
    recorder.input('sample', 2, 2);
    expect(recorder.inputEvent(2)).toBe(0);
    recorder.stop();
    expect(recorder.export()).toEqual(stopped);
    expect(clock.mock.calls).toHaveLength(calls);
  });

  it('retains an in-flight phase past the deadline and then stops recording', () => {
    recorder.start({ capacity: 2, maxDurationMs: 1_000 });
    now = 950;
    recorder.frame(7, 4);
    now = 1_000;
    const start = recorder.beginPhase('sim.total');
    now = 1_400;
    recorder.endPhase('sim.total', start);
    expect(recorder.isActive).toBe(false);
    const calls = clock.mock.calls.length;
    recorder.count('sim.steps', 3);
    recorder.frame(8, 5);
    const report = recorder.export();
    expect(clock.mock.calls).toHaveLength(calls);
    expect(report.elapsedMs).toBe(1_300);
    expect(report.records.find((record) => record.kind === 'phase')).toMatchObject({
      label: 'sim.total', timestampMs: 1_000, durationMs: 400,
    });
    expect(report.timeline.bins).toEqual([{
      startOffsetMs: 0, endOffsetMs: 1_000,
      firstRenderFrame: 7, lastRenderFrame: 7, firstSimFrame: 4, lastSimFrame: 4,
      phases: { 'sim.total': { count: 1, totalMs: 400, meanMs: 400, maxMs: 400 } }, counters: {},
    }]);
  });
});
