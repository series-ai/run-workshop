import { describe, expect, it } from 'vitest';
import { CAGE_TOP } from './cage';
import { ARENA_EXTENT, FLOOR_Y } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL } from './input';
import { physicsStateBodyById, replacePhysicsPose } from './physics';
import { testSim } from './testSim';

/** Launches a body from `at` with `velocity` (m/s) and tracks its highest point and farthest reach for 4 s. */
function launch(id: string, at: [number, number, number], velocity: [number, number, number]) {
  const sim = testSim(1);
  sim.edit((physics) => replacePhysicsPose(physics, id, { x: at[0], y: at[1], z: at[2], vx: velocity[0] / 30, vy: velocity[1] / 30, vz: velocity[2] / 30 }));
  let state = sim.state;
  let top = -Infinity;
  let reach = 0;
  for (let tick = 0; tick < 120; tick += 1) {
    state = sim.step([NEUTRAL_INPUT]);
    const body = physicsStateBodyById(state.world, id);
    if (!body) break; // fractured (a blast or the torch): its pieces are new bodies
    top = Math.max(top, body.y);
    reach = Math.max(reach, Math.abs(body.x), Math.abs(body.z));
  }
  return { top, reach, state };
}

describe('arena cage', () => {
  it('keeps a body launched straight up under the ceiling', () => {
    const { top } = launch('hazard-drum-1', [0, 2, 8], [0, 45, 0]);
    expect(top).toBeLessThan(CAGE_TOP);
    expect(top).toBeGreaterThan(CAGE_TOP - 3);
  });

  it('keeps a body thrown hard over each wall inside the yard', () => {
    for (const [velocity, at] of [
      [[40, 12, 0], [15, 4, 0]],
      [[-40, 12, 0], [-12, 4, 5]],
      [[0, 12, 40], [0, 4, 15]],
      [[5, 12, -40], [8, 4, -15]],
    ] as const) {
      const { reach } = launch('hazard-drum-1', [...at], [...velocity]);
      expect(reach, `${velocity}`).toBeLessThan(ARENA_EXTENT - 0.3);
    }
  });

  it('lets aim rays through: a gravity gun shot at the sky above a wall is a miss', () => {
    // Over the south wall's top and through the cage panel above it.
    const eye: [number, number, number] = [-3, FLOOR_Y + 2, 20];
    const state = testSim(1).step([{ ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true, ...quantizeRay(eye, [0, 0.6, 1]) }]);
    expect(state.players[0]!.feedback?.result).toBe('miss');
  });
});
