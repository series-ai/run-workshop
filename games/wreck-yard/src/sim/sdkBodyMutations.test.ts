import { carveVoxelChunk, createPhysicsWorld3D, createVoxelChunk, kilograms, meters, metersPerSecond, radiansPerSecond, vec3, type PhysicsBody3D } from '@series-inc/rundot-syncplay/physics/3d';
import { describe, expect, it } from 'vitest';
import { TICK_RATE } from './constants';
import { PHYSICS_MATERIALS } from './materials';
import { addPhysicsBodies, launchPhysicsBody, physicsBodyHandle, replacePhysicsPose, setPhysicsBodyLinearDamping, type OpenYardPhysicsWorld } from './physics';

function fixture(sleeping = false): OpenYardPhysicsWorld {
  const open: OpenYardPhysicsWorld = {
    world: createPhysicsWorld3D({
      tickRate: TICK_RATE,
      capacity: { bodies: 4, joints: 0, checkpoints: 2 },
      materials: PHYSICS_MATERIALS,
    }),
    bodyIds: new Map(),
  };
  addPhysicsBodies(open, [{
    id: 'probe',
    body: {
      kind: 'dynamic', material: 'steel', mass: kilograms(3),
      shape: { type: 'box', halfX: meters(0.4), halfY: meters(0.6), halfZ: meters(0.8) },
      position: vec3(meters, 2, 12, -3),
      orientation: { x: 0, y: 0.6, z: 0, w: 0.8 },
      linearVelocity: vec3(metersPerSecond, sleeping ? [0, 0, 0] : [1, 2, 3]),
      angularVelocity: vec3(radiansPerSecond, sleeping ? [0, 0, 0] : [0.1, 0.2, 0.3]),
      linearDamping: 0.94,
      sleeping,
    },
  }]);
  return open;
}

function read(open: OpenYardPhysicsWorld): PhysicsBody3D {
  return open.world.readBody(physicsBodyHandle(open, 'probe'));
}

function identity(body: PhysicsBody3D) {
  return {
    id: body.id, key: body.key, kind: body.kind,
    shape: body.shape, mass: body.mass, inertia: body.inertia,
    centerOfMass: body.centerOfMass, materialSource: body.materialSource,
    friction: body.friction, restitution: body.restitution,
    rollingResistance: body.rollingResistance,
  };
}

function checkRestores(open: OpenYardPhysicsWorld): void {
  const expected = read(open);
  const checkpoint = open.world.captureCheckpoint();
  try {
    const bytes = open.world.serializeCheckpoint(checkpoint);
    open.world.step();
    open.world.restoreCheckpoint(checkpoint);
    expect(read(open)).toEqual(expected);
    open.world.step();
    open.world.restore(bytes);
    expect(read(open)).toEqual(expected);
  } finally {
    open.world.releaseCheckpoint(checkpoint);
  }
}

describe('SDK body mutation boundaries', () => {
  it('keeps source material bytes and resolves a short capsule in cell units', () => {
    const chunk = createVoxelChunk(4, 4, 4, meters(0.08));
    chunk.occupancy.fill(37);
    chunk.occupancy[63] = 41;
    const before = chunk.occupancy.slice();
    const start = { x: 0, y: 0, z: 0 };
    const cut = carveVoxelChunk(chunk, {
      op: 'carve', shapeType: 'capsule', capsuleP0: start,
      capsuleP1: { x: 0.0005, y: 0, z: 0 }, capsuleRadius: 0.99975,
    }, { mutateInPlace: false });
    const point = carveVoxelChunk(chunk, {
      op: 'carve', shapeType: 'sphere', sphereCenter: start, sphereRadius: 0.99975,
    }, { mutateInPlace: false });
    expect(cut.status).toBe(0);
    expect(cut.changed).toBe(true);
    expect(chunk.occupancy).toEqual(before);
    expect(cut.occupancy[0]).toBe(0);
    expect(cut.occupancy[1]).toBe(0);
    expect(point.occupancy[1]).toBe(37);
    expect(cut.occupancy[63]).toBe(41);
  });

  it('launches a sleeping body without a change to its identity or material', () => {
    const open = fixture(true);
    try {
      const before = read(open);
      expect(before.sleeping).toBe(true);
      launchPhysicsBody(open, 'probe', [5, 15, 7], [4, 6, -2], [0.4, 0.8, -0.2], 1);
      const after = read(open);
      expect(identity(after)).toEqual(identity(before));
      expect(after.orientation).toEqual(before.orientation);
      expect(after.position).toEqual({ x: 5, y: 15, z: 7 });
      expect(after.linearVelocity).toEqual({ x: 4, y: 6, z: -2 });
      expect(after.angularVelocity).toEqual({ x: 0.4, y: 0.8, z: -0.2 });
      expect(after.linearDamping).toBe(1);
      expect(after.sleeping).toBe(false);
      checkRestores(open);
    } finally {
      open.world.dispose();
    }
  });

  it.each([false, true])('changes damping and preserves motion and sleep (%s)', (sleeping) => {
    const open = fixture(sleeping);
    try {
      const before = read(open);
      setPhysicsBodyLinearDamping(open, 'probe', 0.8);
      const after = read(open);
      expect(after).toEqual({ ...before, linearDamping: 0.8 });
      checkRestores(open);
    } finally {
      open.world.dispose();
    }
  });

  it('changes a partial pose and keeps unspecified motion through both restore paths', () => {
    const open = fixture();
    try {
      const before = read(open);
      replacePhysicsPose(open, 'probe', { x: 9, vy: 0.25 });
      const after = read(open);
      expect(after).toEqual({
        ...before,
        position: { ...before.position, x: 9 },
        linearVelocity: { ...before.linearVelocity, y: 0.25 * TICK_RATE },
        sleeping: false,
      });
      checkRestores(open);
    } finally {
      open.world.dispose();
    }
  });

  it('wakes a sleeping body when a partial pose has no changed values', () => {
    const open = fixture(true);
    try {
      const before = read(open);
      expect(before.sleeping).toBe(true);
      replacePhysicsPose(open, 'probe', { x: before.position.x });
      expect(read(open)).toEqual({ ...before, sleeping: false });
    } finally {
      open.world.dispose();
    }
  });
});
