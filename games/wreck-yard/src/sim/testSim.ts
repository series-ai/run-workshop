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
 * Moves or changes a player outside a tick. Players are not in the physics
 * world, so this restores a save of the live world with the changed player.
 */
export function patchPlayer(sim: YardSim, patch: Partial<PlayerState>, slot = 0): void {
  const save = sim.save();
  try {
    sim.restore({ ...save, state: { ...save.state, players: save.state.players.map((player, index) => (index === slot ? { ...player, ...patch } : player)) } });
  } finally {
    sim.release(save);
  }
}
