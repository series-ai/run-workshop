import { describe, expect, it } from 'vitest';
import { addPhysicsBodies, makeWorld, type OpenYardPhysicsWorld } from './physics';
import { createInitialPlayer } from './state';
import { movePlayer } from './movement';
import { DT } from './constants';

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
