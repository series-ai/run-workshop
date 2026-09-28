import { describe, expect, it } from 'vitest';
import { FLOOR_Y, LINEAR_DAMPING, PLAYER_RADIUS } from './constants';
import {
  BUTTONS,
  CATAPULT,
  CONVEYOR,
  crossedHoop,
  DROP_COOLDOWN_TICKS,
  HOOP,
  MAX_DROPPED_CRATES,
  type ButtonId,
} from './contraptions';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { fullPhysicsBodyById, openWorld, physicsStateBodyById, replacePhysicsPose } from './physics';
import { createInitialState } from './presets';
import type { YardState } from './state';
import { stepYard } from './step';

const [hx, hy, hz] = HOOP.center;
const run = (state: YardState, ticks: number, input: YardInput = NEUTRAL_INPUT) => {
  let next = state;
  for (let tick = 0; tick < ticks; tick += 1) next = stepYard(next, [input]);
  return next;
};
const standAt = (state: YardState, x: number, z: number): YardState => ({
  ...state,
  players: [{ ...state.players[0]!, x, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z, vx: 0, vy: 0, vz: 0 }],
});
/** Walks up to a button and taps E for one tick. */
const pressWithE = (state: YardState, id: ButtonId): YardState => {
  const button = BUTTONS.find((entry) => entry.id === id)!;
  const pressed = stepYard(standAt(state, button.base[0] + 1.2, button.base[2]), [{ ...NEUTRAL_INPUT, secondary: true }]);
  return stepYard(pressed, [NEUTRAL_INPUT]);
};
const crates = (state: YardState) => state.bodies.filter((body) => body.id.startsWith('supply-crate-'));

describe('hoop scoring', () => {
  it('counts a center that drops down through the ring', () => {
    expect(crossedHoop([hx + 0.5, hy + 0.3, hz], [hx + 0.6, hy - 0.3, hz + 0.1])).toBe(true);
  });

  it('ignores a pass outside the ring, a body going up, and a body that stays above', () => {
    expect(crossedHoop([hx + 1.5, hy + 0.3, hz], [hx + 1.5, hy - 0.3, hz])).toBe(false);
    expect(crossedHoop([hx, hy - 0.3, hz], [hx, hy + 0.3, hz])).toBe(false);
    expect(crossedHoop([hx, hy + 0.6, hz], [hx, hy + 0.1, hz])).toBe(false);
  });

  it('uses the crossing point, not the end point, for fast bodies', () => {
    // Crosses the plane at the ring center, but ends the tick outside the ring.
    expect(crossedHoop([hx, hy + 0.5, hz + 1.5], [hx, hy - 0.5, hz - 1.5])).toBe(true);
  });
});

describe('sky conveyor', () => {
  it('drops a supply crate when a player presses E at the button, and the crate lands whole', () => {
    let state = pressWithE(createInitialState(1), 'dropper');
    expect(crates(state)).toHaveLength(1);
    expect(state.players[0]!.feedback?.result).toBe('press');
    const id = crates(state)[0]!.id;
    state = run(state, 200);
    const crate = physicsStateBodyById(state.world, id);
    expect(crate, 'the crate broke or vanished').toBeDefined();
    expect(crate!.z).toBeGreaterThan(CONVEYOR.zEnd);
    expect(crate!.y).toBeLessThan(FLOOR_Y + 1.5);
    expect(state.stats.fractures).toBe(0);
  });

  it('drops at most one crate per cooldown and keeps at most MAX_DROPPED_CRATES', () => {
    let state = pressWithE(createInitialState(1), 'dropper');
    state = pressWithE(state, 'dropper');
    expect(crates(state)).toHaveLength(1);
    for (let drop = 1; drop <= MAX_DROPPED_CRATES; drop += 1) {
      state = run(state, DROP_COOLDOWN_TICKS);
      state = pressWithE(state, 'dropper');
    }
    expect(crates(state)).toHaveLength(MAX_DROPPED_CRATES);
    expect(state.contraptions.droppedCrates).toEqual(crates(state).map((body) => body.id));
  });

  it('presses the button when the gravity gun clicks it, from across the yard', () => {
    const button = BUTTONS.find((entry) => entry.id === 'dropper')!;
    const eye: [number, number, number] = [button.base[0], FLOOR_Y + 1.6, button.base[2] + 8];
    const target = [button.base[0], button.base[1] + 0.9, button.base[2]];
    const click = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay(eye, [target[0]! - eye[0], target[1]! - eye[1], target[2]! - eye[2]]) };
    const state = stepYard(createInitialState(1), [click]);
    expect(state.players[0]!.feedback?.result).toBe('press');
    expect(crates(state)).toHaveLength(1);
  });
});

describe('catapult', () => {
  const loadBucket = (state: YardState, id: string): YardState => {
    const [bx, by, bz] = CATAPULT.bucket;
    return { ...state, world: replacePhysicsPose(state.world, id, { x: bx, y: by + 0.6, z: bz, vx: 0, vy: 0, vz: 0 }) };
  };

  it('lobs whatever sits in the bucket through the hoop', () => {
    let state = run(loadBucket(createInitialState(1), 'hazard-drum-1'), 20);
    state = pressWithE(state, 'catapult');
    expect(state.contraptions.ballistic.map((entry) => entry.bodyId)).toEqual(['hazard-drum-1']);
    state = run(state, 110);
    expect(state.stats.dunks).toBe(1);
  });

  it('gives a launched body its normal damping back after the flight', () => {
    let state = run(loadBucket(createInitialState(1), 'hazard-drum-1'), 20);
    state = pressWithE(state, 'catapult');
    state = run(state, 150);
    expect(state.contraptions.ballistic).toEqual([]);
    const open = openWorld(state.world);
    try {
      expect(fullPhysicsBodyById(open, 'hazard-drum-1')?.linearDamping).toBeCloseTo(LINEAR_DAMPING);
    } finally {
      open.world.dispose();
    }
  });

  it('fires the arm with an empty bucket without moving any body, and ignores presses during the cooldown', () => {
    const before = run(createInitialState(1), 5);
    const fired = pressWithE(before, 'catapult');
    expect(fired.contraptions.lastLaunchFrame).toBeGreaterThan(0);
    expect(fired.contraptions.ballistic).toEqual([]);
    const again = pressWithE(fired, 'catapult');
    expect(again.contraptions.lastLaunchFrame).toBe(fired.contraptions.lastLaunchFrame);
  });
});
