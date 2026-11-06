import { describe, expect, it } from 'vitest';
import { FLOOR_Y, LINEAR_DAMPING, PLAYER_RADIUS } from './constants';
import {
  BUTTONS,
  CATAPULT,
  CONVEYOR,
  crossedHoop,
  HOOP,
  MAX_DROPPED_DRUMS,
  type ButtonId,
} from './contraptions';
import { FUEL_DRUM } from './fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { fullPhysicsBodyById, physicsStateBodyById, replacePhysicsPose } from './physics';
import type { YardSim } from './sim';
import type { YardState } from './state';
import { patchPlayer, testSim } from './testSim';

const [hx, hy, hz] = HOOP.center;
const run = (sim: YardSim, ticks: number, input: YardInput = NEUTRAL_INPUT): YardState => {
  for (let tick = 0; tick < ticks; tick += 1) sim.step([input]);
  return sim.state;
};
const standAt = (sim: YardSim, x: number, z: number): void => {
  patchPlayer(sim, { x, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z, vx: 0, vy: 0, vz: 0 });
};
/** Walks up to a button and taps E for one tick. */
const pressWithE = (sim: YardSim, id: ButtonId): YardState => {
  const button = BUTTONS.find((entry) => entry.id === id)!;
  standAt(sim, button.base[0] + 1.2, button.base[2]);
  sim.step([{ ...NEUTRAL_INPUT, use: true }]);
  return sim.step([NEUTRAL_INPUT]);
};
const drums = (state: YardState) => state.bodies.filter((body) => body.id.startsWith(FUEL_DRUM.idPrefix));

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
  it('drops a fuel drum when a player presses E at the button, and the drum lands whole', () => {
    const sim = testSim(1);
    const initialDrums = sim.state.contraptions.drums;
    let state = pressWithE(sim, 'dropper');
    expect(drums(state)).toHaveLength(1);
    expect(state.players[0]!.feedback?.result).toBe('press');
    const id = drums(state)[0]!.id;
    state = run(sim, 200);
    const drum = physicsStateBodyById(state.world, id);
    expect(drum, 'the drum broke or vanished').toBeDefined();
    expect(drum!.z).toBeGreaterThan(CONVEYOR.zEnd);
    expect(drum!.y).toBeLessThan(FLOOR_Y + 1.5);
    expect(state.stats.fractures).toBe(0);
    expect(state.contraptions.drums).toEqual([...initialDrums, { bodyId: id, damage: 0, detonateAt: null }]);
  });

  it('drops at most one drum per cooldown and keeps at most MAX_DROPPED_DRUMS', () => {
    const sim = testSim(1);
    pressWithE(sim, 'dropper');
    let state = pressWithE(sim, 'dropper');
    expect(drums(state)).toHaveLength(1);
    // Each drum lands, then moves to its own spot: drums that fall on drums damage them.
    const spread = (index: number) => sim.edit((physics) => replacePhysicsPose(physics, state.contraptions.drums.at(-1)!.bodyId, {
      x: 4 + (index % 3) * 1.5, y: FLOOR_Y + 0.6, z: 9 + Math.floor(index / 3) * 1.5, vx: 0, vy: 0, vz: 0,
    }));
    for (let drop = 1; drop <= MAX_DROPPED_DRUMS; drop += 1) {
      state = run(sim, 200);
      spread(drop - 1);
      state = pressWithE(sim, 'dropper');
    }
    expect(drums(state)).toHaveLength(MAX_DROPPED_DRUMS);
    expect(state.contraptions.drums.filter((drum) => drum.bodyId.startsWith(FUEL_DRUM.idPrefix)).map((drum) => drum.bodyId)).toEqual(drums(state).map((body) => body.id));
  });

  it('presses the button when the gravity gun clicks it, from across the yard', () => {
    const button = BUTTONS.find((entry) => entry.id === 'dropper')!;
    const eye: [number, number, number] = [button.base[0], FLOOR_Y + 1.6, button.base[2] + 8];
    const target = [button.base[0], button.base[1] + 0.9, button.base[2]];
    const click = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay(eye, [target[0]! - eye[0], target[1]! - eye[1], target[2]! - eye[2]]) };
    const state = testSim(1).step([click]);
    expect(state.players[0]!.feedback?.result).toBe('press');
    expect(drums(state)).toHaveLength(1);
  });
});

describe('catapult', () => {
  const loadBucket = (sim: YardSim, id: string): YardSim => {
    const [bx, by, bz] = CATAPULT.bucket;
    sim.edit((physics) => replacePhysicsPose(physics, id, { x: bx, y: by + 0.6, z: bz, vx: 0, vy: 0, vz: 0 }));
    return sim;
  };

  it('lobs whatever sits in the bucket through the hoop', () => {
    const sim = testSim(1);
    run(loadBucket(sim, 'hazard-drum-1'), 20);
    let state = pressWithE(sim, 'catapult');
    expect(state.contraptions.ballistic.map((entry) => entry.bodyId)).toEqual(['hazard-drum-1']);
    state = run(sim, 110);
    expect(state.stats.dunks).toBe(1);
  });

  it('gives a launched body its normal damping back after the flight', () => {
    const sim = testSim(1);
    run(loadBucket(sim, 'hazard-drum-1'), 20);
    pressWithE(sim, 'catapult');
    const state = run(sim, 150);
    expect(state.contraptions.ballistic).toEqual([]);
    expect(fullPhysicsBodyById(sim.physics, 'hazard-drum-1')?.linearDamping).toBeCloseTo(LINEAR_DAMPING);
  });

  it('fires the arm with an empty bucket without moving any body, and ignores presses during the cooldown', () => {
    const sim = testSim(1);
    run(sim, 5);
    const fired = pressWithE(sim, 'catapult');
    expect(fired.contraptions.lastLaunchFrame).toBeGreaterThan(0);
    expect(fired.contraptions.ballistic).toEqual([]);
    const again = pressWithE(sim, 'catapult');
    expect(again.contraptions.lastLaunchFrame).toBe(fired.contraptions.lastLaunchFrame);
  });
});
