import { describe, expect, it } from 'vitest';
import { addPhysicsBodies, makePhysicsBody, makeWorld, physicsBodyHandle, physicsStateBodyById, type OpenYardPhysicsWorld } from './physics';
import { blockPreset } from './props';
import { createInitialPlayer } from './state';
import { movePlayer } from './movement';
import { ARENA_EXTENT, DT, FLOOR_Y } from './constants';
import { NEUTRAL_INPUT } from './input';
import { patchPlayer, testSim } from './testSim';
import { kilograms, meters, metersPerSecond, vec3 } from '@series-inc/rundot-syncplay/physics/3d';

describe('scene collision', () => {
  it('stops the player at a wall and permits travel along it', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'wall', body: { kind: 'static', shape: { type: 'box', halfX: meters(.1), halfY: meters(3), halfZ: meters(4) }, position: vec3(meters, 0, 0, 0) } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: -1, y: .3, z: 0 }, [30, 0, 3]);
      expect(result.x).toBeLessThan(-.49);
      expect(result.z).toBeGreaterThan(0);
    } finally { physics.world.dispose(); }
  });

  it('lands on a raised platform instead of passing through it', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'platform', body: { kind: 'static', shape: { type: 'box', halfX: meters(3), halfY: meters(.5), halfZ: meters(3) }, position: vec3(meters, 0, 0, 0) } }]);
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
      addPhysicsBodies(physics, [{ id: 'ceiling', body: { kind: 'static', shape: { type: 'box', halfX: meters(3), halfY: meters(.1), halfZ: meters(3) }, position: vec3(meters, 0, 2, 0) } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: 0, y: .4, z: 0, grounded: false }, [0, 30, 0]);
      expect(result.y).toBeLessThanOrEqual(.51);
      expect(result.y).toBeGreaterThanOrEqual(.4);
    } finally { physics.world.dispose(); }
  });

  // Regression for https://github.com/series-ai/venus/issues/4823 (fixed in 6.0.0-rc.8).
  it('carries a standing player by one tick of platform motion', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'moving-platform', body: { kind: 'dynamic', mass: kilograms(10), shape: { type: 'box', halfX: meters(3), halfY: meters(.5), halfZ: meters(3) }, position: vec3(meters, 0, 0, 0), linearVelocity: vec3(metersPerSecond, 3, 0, 0) } }]);
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
    const sim = testSim(1);
    sim.edit((physics) => {
      const handle = physicsBodyHandle(physics, 'steel-case');
      const body = physics.world.readBody(handle);
      physics.world.edit((edit) => edit.replaceBody(handle, { ...body, position: vec3(meters, 2, FLOOR_Y + 2, 14), orientation, sleeping: false }));
    });
    for (let i = 0; i < 60; i += 1) sim.step([NEUTRAL_INPUT]);
    const crate = physicsStateBodyById(sim.state.world, 'steel-case')!;
    patchPlayer(sim, { x: crate.x, y: crate.y + 2.5, z: crate.z, vx: 0, vy: 0, vz: 0, grounded: false });
    let state = sim.state;
    for (let i = 0; i < 30; i += 1) state = sim.step([NEUTRAL_INPUT]);
    const landed = state.players[0]!;
    for (let i = 0; i < 20; i += 1) state = sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }]);
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
  function walkInto(kind: 'static' | 'dynamic', height: number, dir: readonly [number, number], thenBack = false, concrete = false): number {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      const obstacle = concrete ? makePhysicsBody({
        ...blockPreset(15, Math.round(height / 0.08), 15), id: 'box', label: 'Concrete Block',
        motion: kind === 'static' ? 'fixed' : 'dynamic', buoyancy: 0.05, anchorFaces: [], impactCooldownUntil: 0, heat: null,
      }, { position: [0, FLOOR_Y + height / 2, 0], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] }) : {
        id: 'box', body: { kind, shape: { type: 'box' as const, halfX: meters(0.6), halfY: meters(height / 2), halfZ: meters(0.6) },
        position: vec3(meters, 0, FLOOR_Y + height / 2, 0), ...(kind === 'dynamic' ? { mass: kilograms(0.5) } : {}) },
      };
      addPhysicsBodies(physics, [
        { id: 'floor', body: { kind: 'static', shape: { type: 'box', halfX: meters(20), halfY: meters(0.1), halfZ: meters(20) }, position: vec3(meters, 0, FLOOR_Y - 0.1, 0) } },
        obstacle,
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
      for (const height of [0.04, 0.08, 0.12, 0.2, 0.3, 0.48, 0.5]) {
        for (const dir of [[1, 0], [Math.SQRT1_2, Math.SQRT1_2]] as const) {
          expect(walkInto(kind, height, dir), `${kind} ${height} m ${dir}`).toBeGreaterThan(3);
        }
      }
    }
  });

  it('walks over a concrete voxel block from the prop builder', () => {
    for (const kind of ['static', 'dynamic'] as const) {
      for (const dir of [[1, 0], [Math.SQRT1_2, Math.SQRT1_2]] as const) {
        expect(walkInto(kind, 0.48, dir, false, true)).toBeGreaterThan(3);
      }
    }
  });

  it('does not climb a low edge when the ceiling blocks the lift', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [
        { id: 'floor', body: { kind: 'static', shape: { type: 'box', halfX: meters(20), halfY: meters(0.1), halfZ: meters(20) }, position: vec3(meters, 0, FLOOR_Y - 0.1, 0) } },
        { id: 'step', body: { kind: 'static', shape: { type: 'box', halfX: meters(0.6), halfY: meters(0.15), halfZ: meters(0.6) }, position: vec3(meters, 0, FLOOR_Y + 0.15, 0) } },
        { id: 'ceiling', body: { kind: 'static', shape: { type: 'box', halfX: meters(3), halfY: meters(0.1), halfZ: meters(3) }, position: vec3(meters, 0, FLOOR_Y + 2.0, 0) } },
      ]);
      let player = { ...createInitialPlayer(), x: -1.5, y: FLOOR_Y + 0.41, z: 0, grounded: true };
      for (let tick = 0; tick < 30; tick += 1) player = { ...player, ...movePlayer(physics, player, [6, -3, 0]) };
      expect(player.x).toBeLessThan(-0.9);
      expect(player.y).toBeLessThan(FLOOR_Y + 0.45);
    } finally { physics.world.dispose(); }
  });

  it('keeps a blocked move inside the arena bounds', () => {
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [{ id: 'floor', body: { kind: 'static', shape: { type: 'box', halfX: meters(30), halfY: meters(0.1), halfZ: meters(30) }, position: vec3(meters, 0, FLOOR_Y - 0.1, 0) } }]);
      const result = movePlayer(physics, { ...createInitialPlayer(), x: ARENA_EXTENT - 1.1, y: FLOOR_Y + 0.41, z: 0, grounded: true }, [6, -3, 0]);
      expect(result.x).toBeLessThanOrEqual(ARENA_EXTENT - 1);
    } finally { physics.world.dispose(); }
  });

  it('walks over a loose concrete slab in the full yard', () => {
    const sim = testSim(1);
    for (let tick = 0; tick < 60; tick += 1) sim.step([NEUTRAL_INPUT]);
    patchPlayer(sim, { x: -16.2, y: FLOOR_Y + 0.41, z: 8, vx: 0, vy: 0, vz: 0, yaw: 0, grounded: true });
    let highest = FLOOR_Y;
    for (let tick = 0; tick < 30; tick += 1) {
      const state = sim.step([{ ...NEUTRAL_INPUT, moveX: 1 }]);
      highest = Math.max(highest, state.players[0]!.y);
    }
    expect(sim.state.players[0]!.x).toBeGreaterThan(-12);
    expect(highest).toBeGreaterThan(FLOOR_Y + 0.65);
  });

  it('walks on when the capsule already overlaps a low edge', () => {
    // A plate pushed against the player leaves the capsule's side inside its edge.
    const physics: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
    try {
      addPhysicsBodies(physics, [
        { id: 'floor', body: { kind: 'static', shape: { type: 'box', halfX: meters(20), halfY: meters(0.1), halfZ: meters(20) }, position: vec3(meters, 0, FLOOR_Y - 0.1, 0) } },
        { id: 'plate', body: { kind: 'dynamic', mass: kilograms(0.5), shape: { type: 'box', halfX: meters(0.6), halfY: meters(0.04), halfZ: meters(0.44) }, position: vec3(meters, 0, FLOOR_Y + 0.04, 0) } },
      ]);
      // The pose from the yard: capsule center at the plate's edge, walking away from it.
      let player = { ...createInitialPlayer(), x: -0.15, y: FLOOR_Y + 0.41, z: -0.45, grounded: true };
      const start = { x: player.x, z: player.z };
      for (let tick = 0; tick < 30; tick += 1) player = { ...player, ...movePlayer(physics, player, [2.9, -3, -5.3]) };
      expect(Math.hypot(player.x - start.x, player.z - start.z)).toBeGreaterThan(2);
    } finally { physics.world.dispose(); }
  });

  it('is stopped by a taller edge without ending up inside it', () => {
    for (const height of [0.6, 0.8]) expect(walkInto('static', height, [1, 0]), `${height} m`).toBeLessThan(1.1);
    // A blocked player can still walk away.
    expect(walkInto('static', 0.6, [1, 0], true)).toBeGreaterThan(3);
  });
});
