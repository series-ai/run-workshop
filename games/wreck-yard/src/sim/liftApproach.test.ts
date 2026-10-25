import { describe, expect, it } from 'vitest';
import { ELEVATOR, STORAGE, elevatorPanelWithinReach } from './attractions';
import { ARENA_EXTENT, FLOOR_Y, PLAYER_HEIGHT, PLAYER_RADIUS, VOXEL_SIZE } from './constants';
import { NEUTRAL_INPUT } from './input';
import { STEP_HEIGHT } from './movement';
import type { Quat } from './math';
import { yardProps } from './props';
import { PLAYER_SPAWN_POINTS } from './state';
import { createCrateSpawns } from './storage';
import { SHELL_BOXES, shellBoxBounds } from './shell';
import { patchPlayer, testSim } from './testSim';

const CELL = 0.2;
/** The front of the ground landing. The panel reach check passes here. */
const LIFT_FRONT: [number, number] = [-7.2, -18.75];

interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
interface Footprint { minX: number; maxX: number; minZ: number; maxZ: number }

/** Half size of the world box that encloses a voxel prop at this rotation. */
function worldHalfSize(dims: { x: number; y: number; z: number }, [qx, qy, qz, qw]: Quat): [number, number, number] {
  const m = [
    [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
    [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
    [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
  ];
  const half = [dims.x, dims.y, dims.z].map((cells) => cells * VOXEL_SIZE * 0.5);
  return m.map((row) => row.reduce((sum, value, axis) => sum + Math.abs(value) * half[axis]!, 0)) as [number, number, number];
}

/** Every solid that a walking player meets, as a box. Overhead beams and low steps are left out. */
function solids(): Box[] {
  const boxes: Box[] = [];
  for (const solid of SHELL_BOXES) {
    const { center, size } = shellBoxBounds(solid);
    boxes.push({ minX: center[0] - size[0] / 2, maxX: center[0] + size[0] / 2, minY: center[1] - size[1] / 2, maxY: center[1] + size[1] / 2, minZ: center[2] - size[2] / 2, maxZ: center[2] + size[2] / 2 });
  }
  for (const prop of yardProps()) {
    const [hx, hy, hz] = worldHalfSize(prop.preset.dims, prop.rotation);
    boxes.push({ minX: prop.position[0] - hx, maxX: prop.position[0] + hx, minY: prop.position[1] - hy, maxY: prop.position[1] + hy, minZ: prop.position[2] - hz, maxZ: prop.position[2] + hz });
  }
  // The storage crates start in the stack beside the lift. Their footprints count as solids.
  const half = STORAGE.size / 2;
  for (const spawn of createCrateSpawns('storage')) {
    const [x, y, z] = spawn.position;
    boxes.push({ minX: x - half, maxX: x + half, minY: y - half, maxY: y + half, minZ: z - half, maxZ: z + half });
  }
  return boxes.filter((box) => box.maxY > FLOOR_Y + STEP_HEIGHT && box.minY < FLOOR_Y + PLAYER_HEIGHT);
}

/** Footprints grown by the player radius, so a walker's center can test against them. */
function footprints(): Footprint[] {
  return solids().map((box) => ({ minX: box.minX - PLAYER_RADIUS, maxX: box.maxX + PLAYER_RADIUS, minZ: box.minZ - PLAYER_RADIUS, maxZ: box.maxZ + PLAYER_RADIUS }));
}

/** Breadth-first walk over cell centers. True when `goal` is reachable from `start`. */
function reachable(start: readonly [number, number], goal: readonly [number, number], blocks: Footprint[]): boolean {
  const limit = ARENA_EXTENT - PLAYER_RADIUS;
  const cols = Math.round((2 * limit) / CELL) + 1;
  const cellOf = ([x, z]: readonly [number, number]) => Math.round((z + limit) / CELL) * cols + Math.round((x + limit) / CELL);
  const pointOf = (index: number) => [-limit + (index % cols) * CELL, -limit + Math.floor(index / cols) * CELL] as const;
  const blocked = (x: number, z: number) => blocks.some((box) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ);
  const seen = new Uint8Array(cols * cols);
  const queue = [cellOf(start)];
  seen[queue[0]!] = 1;
  const goalIndex = cellOf(goal);
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    if (index === goalIndex) return true;
    const col = index % cols;
    const row = Math.floor(index / cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= cols) continue;
      const next = nr * cols + nc;
      if (seen[next]) continue;
      const [x, z] = pointOf(next);
      if (blocked(x, z)) continue;
      seen[next] = 1;
      queue.push(next);
    }
  }
  return false;
}

describe('storage lift approach', () => {
  it('reaches the lift call panel from every yard spawn on foot', () => {
    expect(elevatorPanelWithinReach([LIFT_FRONT[0], FLOOR_Y + 0.4, LIFT_FRONT[1]], ELEVATOR.floors[0])).toBe(true);
    const blocks = footprints();
    for (const spawn of PLAYER_SPAWN_POINTS) {
      expect(reachable([spawn[0], spawn[2]], LIFT_FRONT, blocks), `spawn ${spawn}`).toBe(true);
    }
  });

  it('keeps a lane clear from the south to the lift front', () => {
    // A player walks north in this lane to reach the front. Nothing solid may stand in it.
    const lane = { minX: -8.0, maxX: -6.2, minZ: -18.5, maxZ: -13.5 };
    const hits = footprints().filter((box) => box.maxX > lane.minX && box.minX < lane.maxX && box.maxZ > lane.minZ && box.minZ < lane.maxZ);
    expect(hits).toEqual([]);
  });
});

describe('straight walk to the lift front', () => {
  /** Steers the real sim straight at the front, one tick at a time. Returns the closest approach. */
  function closestApproach(from: readonly [number, number]): number {
    const sim = testSim(1);
    patchPlayer(sim, { x: from[0], y: FLOOR_Y + 1, z: from[1], vx: 0, vy: 0, vz: 0, grounded: false });
    let state = sim.state;
    for (let tick = 0; tick < 90; tick += 1) state = sim.step([NEUTRAL_INPUT]);
    let closest = Infinity;
    for (let tick = 0; tick < 1200; tick += 1) {
      const player = state.players[0]!;
      const dx = LIFT_FRONT[0] - player.x;
      const dz = LIFT_FRONT[1] - player.z;
      const distance = Math.hypot(dx, dz);
      closest = Math.min(closest, distance);
      if (distance < 0.3) break;
      // With yaw 0 the sim's forward is -z and its right is +x, so the z input is negated.
      state = sim.step([{ ...NEUTRAL_INPUT, moveX: dx / distance, moveZ: -dz / distance }]);
    }
    return closest;
  }

  it('walks from the yard centre to the lift front without a detour', () => {
    expect(closestApproach([0, 0])).toBeLessThan(0.3);
  }, 30_000);

  it('walks from each west spawn to the lift front without a detour', () => {
    for (const spawn of PLAYER_SPAWN_POINTS.filter((point) => point[0] < 0)) {
      expect(closestApproach([spawn[0], spawn[2]]), `spawn ${spawn}`).toBeLessThan(0.3);
    }
  }, 60_000);
});
