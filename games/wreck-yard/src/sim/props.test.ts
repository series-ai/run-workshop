import { describe, expect, it } from 'vitest';
import { ARENA_EXTENT, VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT } from './input';
import type { Quat } from './math';
import { fullPhysicsBodyById, physicsStateBodyById } from './physics';
import { yardProps } from './props';
import { PLAYER_SPAWN_POINTS } from './state';
import { initialState, testSim } from './testSim';

/** Bodies that move at the start on purpose: floats bob in the tank. */
const MOVES_BY_DESIGN = new Set(['float-crate', 'float-drum']);

/** Bodies that never sleep at rest: the floats bob. The buggy parks (Syncplay's revision 2 vehicle). */
const NEVER_SLEEPS = new Set(['float-crate', 'float-drum']);

/** Wall inner faces sit at ARENA_EXTENT minus half the 0.6 m wall. */
const INNER = ARENA_EXTENT - 0.3;

/** Half size of the world box that encloses a voxel body at this rotation. */
function worldHalfSize(dims: { x: number; y: number; z: number }, [qx, qy, qz, qw]: Quat): [number, number, number] {
  const m = [
    [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
    [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
    [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
  ];
  const half = [dims.x, dims.y, dims.z].map((cells) => cells * VOXEL_SIZE * 0.5);
  return m.map((row) => row.reduce((sum, value, axis) => sum + Math.abs(value) * half[axis]!, 0)) as [number, number, number];
}

describe('yard props', () => {
  it('uses unique ids that do not clash with the core bodies', () => {
    const ids = initialState(1).bodies.map((body) => body.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays inside the walls', () => {
    for (const prop of yardProps()) {
      for (const axis of [0, 2]) {
        expect(Math.abs(prop.position[axis]!) + worldHalfSize(prop.preset.dims, prop.rotation)[axis]!, prop.id).toBeLessThanOrEqual(INNER);
      }
    }
  });

  it('leaves at least 2 m to every player spawn point', () => {
    for (const prop of yardProps()) {
      for (const spawn of PLAYER_SPAWN_POINTS) {
        const distance = Math.hypot(prop.position[0] - spawn[0], prop.position[2] - spawn[2]);
        const reach = Math.hypot(prop.preset.dims.x, prop.preset.dims.z) * VOXEL_SIZE * 0.5;
        expect(distance - reach, `${prop.id} vs spawn ${spawn}`).toBeGreaterThan(2);
      }
    }
  });

  it('settles in place: no body starts in an overlap, falls over, or breaks', () => {
    // Overlap at spawn makes the solver push bodies out, so any overlap shows as drift.
    const sim = testSim(1);
    const initial = sim.state;
    const start = initial.world.bodies.filter((body) => body.kind === 'dynamic' && !MOVES_BY_DESIGN.has(body.id));
    expect(start.length).toBeGreaterThan(yardProps().length);
    let state = initial;
    for (let tick = 0; tick < 60; tick += 1) state = sim.step([NEUTRAL_INPUT]);
    expect(state.stats.fractures).toBe(0);
    const moved = start.flatMap((before) => {
      const after = physicsStateBodyById(state.world, before.id);
      if (!after) return [`${before.id} is gone`];
      const drift = Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z);
      return drift > 0.12 ? [`${before.id} moved ${drift.toFixed(2)} m`] : [];
    });
    expect(moved).toEqual([]);
  });

  it('lets every other body sleep once settled', () => {
    // Awake bodies cost solver time every tick. With ~120 props, a prop shape that
    // never sleeps (and whatever rests on it) is a steady cost.
    const sim = testSim(1);
    for (let tick = 0; tick < 90; tick += 1) sim.step([NEUTRAL_INPUT]);
    const awake = sim.state.bodies
      .filter((body) => body.motion === 'dynamic' && !NEVER_SLEEPS.has(body.id))
      .filter((body) => !fullPhysicsBodyById(sim.physics, body.id)!.sleeping)
      .map((body) => body.id);
    expect(awake).toEqual([]);
  });
});
