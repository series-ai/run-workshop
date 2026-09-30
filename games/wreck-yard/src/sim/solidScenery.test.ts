import { describe, expect, it } from 'vitest';
import { ANGLE_SCALE, NEUTRAL_INPUT, TOOL, type YardInput } from './input';
import { FLOOR_Y, PLAYER_RADIUS } from './constants';
import { createInitialState } from './presets';
import { SET_PIECE_COLLIDERS, type ShellBox } from './setPieces';
import { SHELL_BOXES, shellBoxBounds } from './shell';
import type { YardState } from './state';
import { stepYard } from './step';

/** Only colliders a walking player can reach: bottom near the floor. */
const GROUND_LEVEL = SET_PIECE_COLLIDERS.filter((box) => box.center[1] - box.size[1] / 2 < FLOOR_Y + 0.5 && box.size[1] > 0.35);

/**
 * Player center depth inside the box footprint grown by the capsule radius
 * (<= 0 is outside). Ground pieces turn about Y only; three.js yaw maps
 * world to local as lx = x cos - z sin, lz = x sin + z cos.
 */
function penetration(box: ShellBox, x: number, z: number): number {
  const yaw = box.rotation?.[1] ?? 0;
  const dx = x - box.center[0];
  const dz = z - box.center[2];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return Math.min(box.size[0] / 2 + PLAYER_RADIUS - Math.abs(lx), box.size[2] / 2 + PLAYER_RADIUS - Math.abs(lz));
}

/** Dynamic bodies at spawn: start spots keep clear of them. */
const DYNAMIC_SPAWNS = createInitialState(1).world.bodies.filter((b) => b.kind === 'dynamic').map((b) => [b.x, b.z] as const);

/** Solid boxes a standing player can touch. */
const TOUCHABLE = SHELL_BOXES.filter((box) => box.id !== 'floor' && box.center[1] - box.size[1] / 2 < FLOOR_Y + 1.5);

/** A start spot 1.4 m outside one face, clear of every other shell box. */
function startSpot(box: ShellBox): [number, number] | null {
  const bounds = shellBoxBounds(box);
  const clear = (x: number, z: number) => DYNAMIC_SPAWNS.every(([bx, bz]) => Math.hypot(x - bx, z - bz) > 1.6) && SHELL_BOXES.every((other) => {
    if (other.id === 'floor') return true;
    const b = shellBoxBounds(other);
    const top = b.center[1] + b.size[1] / 2;
    if (top < FLOOR_Y + 0.3) return true;
    return Math.abs(x - b.center[0]) > b.size[0] / 2 + PLAYER_RADIUS + 0.2 || Math.abs(z - b.center[2]) > b.size[2] / 2 + PLAYER_RADIUS + 0.2;
  });
  const reach = 1.4 + PLAYER_RADIUS;
  const candidates: [number, number][] = [
    [bounds.center[0] + bounds.size[0] / 2 + reach, bounds.center[2]],
    [bounds.center[0] - bounds.size[0] / 2 - reach, bounds.center[2]],
    [bounds.center[0], bounds.center[2] + bounds.size[2] / 2 + reach],
    [bounds.center[0], bounds.center[2] - bounds.size[2] / 2 - reach],
  ];
  return candidates.find(([x, z]) => Math.abs(x) < 24.8 && Math.abs(z) < 24.8 && clear(x, z)) ?? null;
}

/** Player y is the lower capsule sphere center: a standing player rests one radius above the floor. */
function walkInto(box: ShellBox, start: [number, number]): { deepest: number; stoppedAtSolid: boolean } {
  let state: YardState = createInitialState(1);
  state = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, x: start[0], y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: start[1], vx: 0, vy: 0, vz: 0 } : p)) };
  for (let i = 0; i < 8; i += 1) state = stepYard(state, [NEUTRAL_INPUT]);
  let deepest = -Infinity;
  for (let i = 0; i < 75; i += 1) {
    const p = state.players[0]!;
    const yaw = Math.atan2(-(box.center[0] - p.x), -(box.center[2] - p.z));
    const walk: YardInput = { ...NEUTRAL_INPUT, tool: TOOL.none, moveZ: 1, yaw: Math.round(yaw * ANGLE_SCALE) };
    state = stepYard(state, [walk]);
    deepest = Math.max(deepest, penetration(box, state.players[0]!.x, state.players[0]!.z));
  }
  const end = state.players[0]!;
  // Stopped by this piece or a neighbor, not in open space. The 0.6 m margin
  // covers the capsule radius and the KCC skin.
  return { deepest, stoppedAtSolid: TOUCHABLE.some((other) => penetration(other, end.x, end.z) > -0.6) };
}

describe('solid scenery', () => {
  it('has start spots for most ground-level set pieces', () => {
    const reachable = GROUND_LEVEL.filter((box) => startSpot(box) !== null);
    expect(reachable.length).toBeGreaterThan(GROUND_LEVEL.length * 0.6);
  });

  it.each(GROUND_LEVEL.filter((box) => startSpot(box) !== null).map((box) => [box.id, box] as const))(
    'stops a walking player at %s',
    (_id, box) => {
      const { deepest, stoppedAtSolid } = walkInto(box, startSpot(box)!);
      // 0.12 m covers the controller skin and one tick of motion.
      expect(deepest).toBeLessThan(0.12);
      expect(stoppedAtSolid).toBe(true);
    },
    30000,
  );
});
