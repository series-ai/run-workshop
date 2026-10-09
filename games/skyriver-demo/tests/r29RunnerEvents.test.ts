import { describe, expect, it } from 'vitest';
import { createSkyriverRunnerSession } from '../src/sim/session';
import { createFlightPresenter, type PresentedFlight } from '../src/render/flightPresentation';

const TICK_MS = 1000 / 30;

describe('R29 actual runner mode event boundary', () => {
  it('dispatches each stepped mode edge before the next draw at 15 Hz', async () => {
    const session = createSkyriverRunnerSession(424242, 'autopilot');
    const records: { eventTick: number; previousTick: number; currentTick: number; previousMode: number; currentMode: number; alpha: number; update: number }[] = [];
    let update = 0;
    const unsubscribe = session.runner.subscribeEvents(record => {
      if (record.payload.kind !== 'mode') return;
      const state = session.runner.getRenderState();
      records.push({ eventTick: record.frame, previousTick: state.previous.tick, currentTick: state.current.tick, previousMode: state.previous.flight.mode, currentMode: state.current.flight.mode, alpha: state.alpha, update });
    });
    try {
      await session.start();
      while (session.runner.getRenderState().current.tick < 850) {
        const tick = session.runner.getRenderState().current.tick;
        if (tick === 598 || tick === 738) {
          update += 1;
          session.update(TICK_MS);
        } else {
          if (tick === 599 || tick === 739) session.queueModeToggle();
          update += 1;
          session.update(2 * TICK_MS);
        }
      }
      expect(records.map(record => record.eventTick)).toEqual([600, 740]);
      expect(records.map(record => [record.previousTick, record.currentTick, record.previousMode, record.currentMode])).toEqual([[599, 600, 0, 1], [739, 740, 1, 0]]);
      expect(records.every(record => record.currentTick === record.eventTick)).toBe(true);
    } finally {
      unsubscribe();
      await session.dispose();
    }
  });
});


async function actualRunnerPoses(stepsPerDraw: 1 | 2, omitDraws: readonly number[] = []) {
  const session = createSkyriverRunnerSession(424242, 'autopilot');
  const presenter = createFlightPresenter(424242);
  presenter.resetTimeline(1);
  const poses = new Map<number, PresentedFlight>();
  const edges: number[] = [];
  const unsubscribe = session.runner.subscribeEvents(record => {
    if (record.payload.kind !== 'mode') return;
    const state = session.runner.getRenderState();
    expect(state.current.tick).toBe(record.frame);
    expect(state.current.tick - state.previous.tick).toBe(1);
    presenter.observeModeEdge(state, 1);
    edges.push(record.frame);
  });
  try {
    await session.start();
    while (session.runner.getRenderState().current.tick < 850) {
      const tick = session.runner.getRenderState().current.tick;
      if (tick === 599 || tick === 739) session.queueModeToggle();
      const steps = stepsPerDraw === 2 && tick !== 598 && tick !== 738 && tick < 849 ? 2 : 1;
      session.update(steps * TICK_MS);
      const state = session.runner.getRenderState();
      if (!omitDraws.includes(state.current.tick)) poses.set(state.current.tick, { ...presenter.present(state, 1) });
    }
    expect(session.runner.getRenderState().current.tick).toBe(850);
    return { poses, edges };
  } finally {
    unsubscribe();
    await session.dispose();
  }
}

describe('R29 actual runner render cadence', () => {
  it('uses authoritative projections when the callback retains the previous render alpha', async () => {
    const reference = await actualRunnerPoses(1);
    const session = createSkyriverRunnerSession(424242, 'autopilot');
    const presenter = createFlightPresenter(424242);
    presenter.resetTimeline(1);
    const callbackAlphas: number[] = [];
    const unsubscribe = session.runner.subscribeEvents(record => {
      if (record.payload.kind !== 'mode') return;
      const state = session.runner.getRenderState();
      expect([state.previous.tick, state.current.tick]).toEqual([599, 600]);
      callbackAlphas.push(state.alpha);
      presenter.observeModeEdge(state, 1);
    });
    try {
      await session.start();
      for (let tick = 0; tick < 599; tick += 1) session.update(TICK_MS);
      session.update(TICK_MS / 2);
      expect(session.runner.getRenderState().alpha).toBeCloseTo(0.5, 12);
      session.queueModeToggle();
      session.update(1.5 * TICK_MS);
      expect(callbackAlphas).toHaveLength(1);
      expect(callbackAlphas[0]).toBeCloseTo(0.5, 12);
      const state = session.runner.getRenderState();
      expect(state.current.tick).toBe(601);
      expect({ ...presenter.present(state, 1) }).toEqual(reference.poses.get(601));
    } finally {
      unsubscribe();
      await session.dispose();
    }
  });

  it('keeps the same poses when the mode-change draw at tick740 is absent', async () => {
    const full = await actualRunnerPoses(1), sparse = await actualRunnerPoses(1, [740]);
    expect(full.edges).toEqual([600, 740]);
    expect(sparse.edges).toEqual(full.edges);
    expect(sparse.poses.has(740)).toBe(false);
    expect(sparse.poses.has(741)).toBe(true);
    for (const [tick, pose] of sparse.poses) expect(pose, `draw tick ${tick}`).toEqual(full.poses.get(tick));
    const a = sparse.poses.get(739)!, b = sparse.poses.get(741)!;
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(100);
  });

  it('ingests both mode edges and preserves all drawn poses at 15 Hz', async () => {
    const full = await actualRunnerPoses(1), sparse = await actualRunnerPoses(2);
    expect(sparse.edges).toEqual([600, 740]);
    expect(sparse.poses.size).toBeLessThan(full.poses.size * 0.51);
    expect(sparse.poses.has(600)).toBe(false);
    expect(sparse.poses.has(740)).toBe(false);
    expect(sparse.poses.has(741)).toBe(true);
    for (const [tick, pose] of sparse.poses) expect(pose, `15Hz draw tick ${tick}`).toEqual(full.poses.get(tick));
  });
});
