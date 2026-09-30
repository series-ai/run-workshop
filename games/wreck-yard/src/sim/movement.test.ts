import { describe, expect, it } from 'vitest';
import { addPhysicsBodies, closeWorld, makeWorld, openWorld, physicsBodyHandle, physicsStateBodyById, type OpenYardPhysicsWorld } from './physics';
import { createInitialPlayer } from './state';
import { movePlayer } from './movement';
import { DT, FLOOR_Y } from './constants';
import { NEUTRAL_INPUT } from './input';
import { createInitialState } from './presets';
import { stepYard } from './step';

describe('scene collision', () => {
  it('stops the player at a wall and permits travel along it', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'wall', body: { kind: 'static', shape: { type: 'box', halfX: .1, halfY: 3, halfZ: 4 }, position: { x: 0, y: 0, z: 0 } } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: -1, y: .3, z: 0 }, [30, 0, 3]);
      expect(result.x).toBeLessThan(-.49);
      expect(result.z).toBeGreaterThan(0);
    } finally { physics.world.dispose(); }
  });

  it('lands on a raised platform instead of passing through it', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'platform', body: { kind: 'static', shape: { type: 'box', halfX: 3, halfY: .5, halfZ: 3 }, position: { x: 0, y: 0, z: 0 } } }]);
      let player = { ...createInitialPlayer(), x: 0, y: 1, z: 0, grounded: false };
      for (let i = 0; i < 10; i++) {
        const result = movePlayer(physics, player, [0, -3, 0]);
        player = { ...player, ...result };
      }
      expect(player.grounded).toBe(true);
      expect(player.y).toBeGreaterThan(.89);
      expect(player.y).toBeLessThan(.95);
      const walking = movePlayer(physics, player, [3, 0, 0]);
      expect(walking.x).toBeCloseTo(3 * DT, 3);
    } finally { physics.world.dispose(); }
  });
  it('stops upward jetpack movement at a ceiling', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'ceiling', body: { kind: 'static', shape: { type: 'box', halfX: 3, halfY: .1, halfZ: 3 }, position: { x: 0, y: 2, z: 0 } } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: 0, y: .4, z: 0, grounded: false }, [0, 30, 0]);
      expect(result.y).toBeLessThanOrEqual(.51);
      expect(result.y).toBeGreaterThanOrEqual(.4);
    } finally { physics.world.dispose(); }
  });

  // Regression for https://github.com/series-ai/venus/issues/4823 (fixed in 6.0.0-rc.8).
  it('carries a standing player by one tick of platform motion', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'moving-platform', body: { kind: 'dynamic', mass: 10, shape: { type: 'box', halfX: 3, halfY: .5, halfZ: 3 }, position: { x: 0, y: 0, z: 0 }, linearVelocity: { x: 3, y: 0, z: 0 } } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: 0, y: .9, z: 0, grounded: true }, [0, 0, 0]);
      expect(result.grounded).toBe(true);
      expect(result.x).toBeCloseTo(3 * DT, 3);
    } finally { physics.world.dispose(); }
  });

});

describe('standing on voxel bodies', () => {
  const s2 = Math.SQRT1_2;
  /** Drops the body (upright or tipped over), lands the player on it, then walks forward. */
  function walkOffBody(orientation: { x: number; y: number; z: number; w: number }): { moved: number; grounded: boolean } {
    let state = createInitialState(1);
    const open = openWorld(state.world);
    const handle = physicsBodyHandle(open, 'steel-case');
    const body = open.world.readBody(handle);
    open.world.edit((edit) => edit.replaceBody(handle, { ...body, position: { x: 2, y: FLOOR_Y + 2, z: 14 }, orientation, sleeping: false }));
    state = { ...state, world: closeWorld(open) };
    for (let i = 0; i < 60; i += 1) state = stepYard(state, [NEUTRAL_INPUT]);
    const crate = physicsStateBodyById(state.world, 'steel-case')!;
    state = { ...state, players: [{ ...state.players[0]!, x: crate.x, y: crate.y + 2.5, z: crate.z, vx: 0, vy: 0, vz: 0, grounded: false }] };
    for (let i = 0; i < 30; i += 1) state = stepYard(state, [NEUTRAL_INPUT]);
    const landed = state.players[0]!;
    for (let i = 0; i < 20; i += 1) state = stepYard(state, [{ ...NEUTRAL_INPUT, moveZ: 1 }]);
    const walked = state.players[0]!;
    return { moved: Math.hypot(walked.x - landed.x, walked.z - landed.z), grounded: landed.grounded };
  }

  it('walks off a body the player landed on, upright or tipped over', () => {
    // Box-shaped queries sat flush on the body's top face and blocked every step.
    for (const orientation of [{ x: 0, y: 0, z: 0, w: 1 }, { x: s2, y: 0, z: 0, w: s2 }]) {
      const result = walkOffBody(orientation);
      expect(result.grounded).toBe(true);
      expect(result.moved).toBeGreaterThan(1);
    }
  });
});

describe('stepping over low edges', () => {
  /** Walks the player head-on (or diagonally) at a box on the floor for one second. */
  function walkInto(kind: 'static' | 'dynamic', height: number, dir: readonly [number, number], thenBack = false): number {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [
        { id: 'floor', body: { kind: 'static', shape: { type: 'box', halfX: 20, halfY: 0.1, halfZ: 20 }, position: { x: 0, y: FLOOR_Y - 0.1, z: 0 } } },
        { id: 'box', body: { kind, shape: { type: 'box', halfX: 0.6, halfY: height / 2, halfZ: 0.6 }, position: { x: 0, y: FLOOR_Y + height / 2, z: 0 }, ...(kind === 'dynamic' ? { mass: 0.5 } : {}) } },
      ]);
      let player = { ...createInitialPlayer(), x: -1.5 * dir[0], y: FLOOR_Y + 0.41, z: -1.5 * dir[1], grounded: true };
      const start = { x: player.x, z: player.z };
      for (let tick = 0; tick < 30; tick += 1) {
        const result = movePlayer(physics, player, [dir[0] * 6, -3, dir[1] * 6]);
        player = { ...player, ...result };
      }
      if (!thenBack) return Math.hypot(player.x - start.x, player.z - start.z);
      const blocked = { x: player.x, z: player.z };
      for (let tick = 0; tick < 30; tick += 1) {
        const result = movePlayer(physics, player, [-dir[0] * 6, -3, -dir[1] * 6]);
        player = { ...player, ...result };
      }
      return Math.hypot(player.x - blocked.x, player.z - blocked.z);
    } finally { physics.world.dispose(); }
  }

  it('steps over low boxes and plates, head-on or at an angle, static or dynamic', () => {
    for (const kind of ['static', 'dynamic'] as const) {
      for (const height of [0.04, 0.08, 0.12]) {
        for (const dir of [[1, 0], [Math.SQRT1_2, Math.SQRT1_2]] as const) {
          expect(walkInto(kind, height, dir), `${kind} ${height} m ${dir}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('is stopped by a taller edge without ending up inside it', () => {
    for (const height of [0.2, 0.6]) expect(walkInto('static', height, [1, 0]), `${height} m`).toBeLessThan(1.1);
    // A blocked player can still walk away.
    expect(walkInto('static', 0.2, [1, 0], true)).toBeGreaterThan(3);
  });
});
