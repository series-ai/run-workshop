import { describe, expect, it } from 'vitest';
import { ARENA_EXTENT, clutterCollider, SHELL_BOXES, YARD_CLUTTER } from './constants';
import { createInitialState } from './presets';
import { PLAYER_SPAWN_POINTS } from './state';

type Box = { center: readonly number[]; size: readonly number[] };
const overlaps = (a: Box, b: Box, margin = 0) => [0, 2].every((axis) =>
  Math.abs(a.center[axis]! - b.center[axis]!) < (a.size[axis]! + b.size[axis]!) / 2 + margin);

/** Wall inner faces sit at ARENA_EXTENT minus half the 0.6 m wall. */
const INNER = ARENA_EXTENT - 0.3;
/** Floodlight piers are drawn at the corners; keep clutter clear of them. */
const FLOODLIGHT_PIERS: Box[] = [[-21.5, -21], [21.5, -21], [-21.5, 21], [21.5, 21]].map(([x, z]) => ({ center: [x!, 0, z!], size: [2, 0, 2] }));

describe('yard clutter', () => {
  it('stays inside the walls', () => {
    for (const item of YARD_CLUTTER) {
      const box = clutterCollider(item);
      for (const axis of [0, 2]) expect(Math.abs(box.center[axis]!) + box.size[axis]! / 2, item.id).toBeLessThanOrEqual(INNER);
    }
  });

  it('keeps clear of other colliders, floodlights, and each other', () => {
    const solids = SHELL_BOXES.filter((box) => box.id !== 'floor' && !box.id.startsWith('wall-'));
    for (const item of YARD_CLUTTER) {
      const box = clutterCollider(item);
      for (const other of solids) {
        if (other.id === `clutter-${item.id}`) continue;
        expect(overlaps(box, other), `${item.id} vs ${other.id}`).toBe(false);
      }
      for (const pier of FLOODLIGHT_PIERS) expect(overlaps(box, pier), `${item.id} vs floodlight`).toBe(false);
    }
  });

  it('leaves at least 3 m to every player spawn point', () => {
    for (const item of YARD_CLUTTER) {
      const box = clutterCollider(item);
      for (const spawn of PLAYER_SPAWN_POINTS) {
        expect(overlaps(box, { center: spawn, size: [0, 0, 0] }, 3), `${item.id} vs spawn ${spawn}`).toBe(false);
      }
    }
  });

  it('leaves at least 2.5 m to every dynamic body spawn', () => {
    const bodies = createInitialState(1).world.bodies.filter((body) => body.kind === 'dynamic');
    for (const item of YARD_CLUTTER) {
      const box = clutterCollider(item);
      for (const body of bodies) {
        const spawn: Box = { center: [body.x, body.y, body.z], size: [0, 0, 0] };
        expect(overlaps(box, spawn, 2.5), `${item.id} vs ${body.id}`).toBe(false);
      }
    }
  });
});
