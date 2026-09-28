import { describe, expect, it } from 'vitest';
import { ARENA_EXTENT, VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT } from './input';
import type { Quat } from './math';
import { fullPhysicsBodyById, openWorld, physicsStateBodyById } from './physics';
import { createInitialState } from './presets';
import { yardProps } from './props';
import { PLAYER_SPAWN_POINTS } from './state';
import { stepYard } from './step';

/** Bodies that move at the start on purpose: floats bob in the tank. */
const MOVES_BY_DESIGN = new Set(['float-crate', 'float-drum']);

/**
 * Bodies that never sleep at rest, each in a small island of its own: the buggy
 * rides on wheel rays, the floats bob, and the timber pallet creeps on the steel case.
 */
const NEVER_SLEEPS = new Set(['vehicle-chassis', 'float-crate', 'float-drum', 'steel-case', 'timber-pallet']);

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
    const ids = createInitialState(1).bodies.map((body) => body.id);
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
    const initial = createInitialState(1);
    const start = initial.world.bodies.filter((body) => body.kind === 'dynamic' && !MOVES_BY_DESIGN.has(body.id));
    expect(start.length).toBeGreaterThan(yardProps().length);
    let state = initial;
    for (let tick = 0; tick < 60; tick += 1) state = stepYard(state, [NEUTRAL_INPUT]);
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
    // The SDK joins all bodies on the floor into one island, so one body that
    // never sleeps keeps the whole yard awake and roughly doubles the tick cost.
    let state = createInitialState(1);
    for (let tick = 0; tick < 90; tick += 1) state = stepYard(state, [NEUTRAL_INPUT]);
    const open = openWorld(state.world);
    try {
      const awake = state.bodies
        .filter((body) => body.motion === 'dynamic' && !NEVER_SLEEPS.has(body.id))
        .filter((body) => !fullPhysicsBodyById(open, body.id)!.sleeping)
        .map((body) => body.id);
      expect(awake).toEqual([]);
    } finally {
      open.world.dispose();
    }
  });
});
