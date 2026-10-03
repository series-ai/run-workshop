import { onTestFinished } from 'vitest';
import { YardSim } from './sim';
import type { PlayerState, YardState } from './state';

/** A live sim that is disposed when the current test ends. */
export function testSim(playerCount = 1): YardSim {
  const sim = YardSim.create(playerCount);
  onTestFinished(() => sim.dispose());
  return sim;
}

/** The state at frame 0, for tests that only read spawn data. */
export function initialState(playerCount = 1): YardState {
  const sim = YardSim.create(playerCount);
  try {
    return sim.state;
  } finally {
    sim.dispose();
  }
}

/**
 * Changes the state outside a tick (player poses, drum damage). That state is
 * not in the physics world, so this restores a save of the live world with
 * the changed state.
 */
export function patchState(sim: YardSim, change: (state: YardState) => YardState): void {
  const save = sim.save();
  try {
    sim.restore({ ...save, state: change(save.state) });
  } finally {
    sim.release(save);
  }
}

/** Moves or changes a player outside a tick. */
export function patchPlayer(sim: YardSim, patch: Partial<PlayerState>, slot = 0): void {
  patchState(sim, (state) => ({ ...state, players: state.players.map((player, index) => (index === slot ? { ...player, ...patch } : player)) }));
}
