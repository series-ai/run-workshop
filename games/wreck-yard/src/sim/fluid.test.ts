import { describe, expect, it } from 'vitest';
import {
  cookVoxelBody,
  createPhysicsWorld3D,
  createVoxelChunk,
  initPhysics3D,
  setVoxelCell,
  type PhysicsBodyInput3D,
} from '@series-inc/rundot-syncplay/physics/3d';
import { stampBox } from 'voxel-kit';

await initPhysics3D();

const FLUID_BOUNDS = {
  minX: -10,
  minY: -10,
  minZ: -10,
  maxX: 10,
  maxY: 0,
  maxZ: 10,
};

function createTestWorld(capacity?: { bodies?: number; joints?: number; fluids?: number; fluidInteractions?: number }) {
  return createPhysicsWorld3D({
    tickRate: 60,
    initialGravity: { x: 0, y: -10, z: 0 },
    capacity: {
      bodies: capacity?.bodies ?? 64,
      joints: capacity?.joints ?? 16,
      fluids: capacity?.fluids ?? 4,
      fluidInteractions: capacity?.fluidInteractions ?? 64,
    },
  });
}

function makeBoxBody(options: {
  halfX?: number;
  halfY?: number;
  halfZ?: number;
  position?: { x: number; y: number; z: number };
  mass?: number;
  layer?: number;
  mask?: number;
}): PhysicsBodyInput3D {
  return {
    kind: 'dynamic',
    shape: {
      type: 'box',
      halfX: options.halfX ?? 0.5,
      halfY: options.halfY ?? 0.5,
      halfZ: options.halfZ ?? 0.5,
    },
    position: options.position ?? { x: 0, y: 2, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    mass: options.mass ?? 1,
    linearDamping: 0.1,
    angularDamping: 0.1,
    friction: 0.5,
    restitution: 0,
    layer: options.layer ?? 1,
    mask: options.mask ?? 0xffffffff,
  };
}

describe('Syncplay 6.0.0-rc.4 Native 3D Fluid Regression', () => {
  it('1. Entry into and exit from water', () => {
    const world = createTestWorld();
    const {
      created: { body },
    } = world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
      // Start just above surface (surface at y = 0, box bottom at y = 0.05)
      body: edit.createBody(makeBoxBody({ position: { x: 0, y: 0.55, z: 0 }, halfY: 0.5, mass: 1 })),
    }));

    // Step until body falls into water
    for (let i = 0; i < 30; i += 1) {
      world.step();
    }
    let latest = world.latest();
    expect(latest.fluidInteractions.length).toBeGreaterThan(0);
    const inWater = latest.fluidInteractions.find((fi) => fi.bodyId === body.id);
    expect(inWater).toBeDefined();
    expect(inWater!.submergedVolume).toBeGreaterThan(0);
    expect(inWater!.totalForce.y).toBeGreaterThan(0);

    // Teleport/lift body out of water into air
    world.edit((edit) => {
      const current = world.readBody(body);
      edit.replaceBody(body, {
        ...current,
        position: { x: 0, y: 5, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });
    });

    world.step();
    latest = world.latest();
    const outOfWater = latest.fluidInteractions.find((fi) => fi.bodyId === body.id);
    expect(outOfWater).toBeUndefined();
    world.dispose();
  });

  it('2. No retained upward force after a body exits water', () => {
    const world = createTestWorld();
    const {
      created: { body },
    } = world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
      body: edit.createBody(makeBoxBody({ position: { x: 0, y: -2, z: 0 }, mass: 1 })),
    }));

    // Step in water so buoyancy acts
    world.step();
    expect(world.latest().fluidInteractions.length).toBeGreaterThan(0);

    // Move body out of water into air with zero velocity
    world.edit((edit) => {
      const current = world.readBody(body);
      edit.replaceBody(body, {
        ...current,
        position: { x: 0, y: 5, z: 0 },
        linearVelocity: { x: 0, y: 0, z: 0 },
      });
    });

    // Step once in the air: gravity is negative
    world.step();
    const read = world.readBody(body);
    expect(read.linearVelocity.y).toBeLessThan(0);
    // Total fluid interactions must be 0
    expect(world.latest().fluidInteractions).toHaveLength(0);
    world.dispose();
  });

  it('3. Hollow voxel bodies displace only occupied child boxes, not outer bounds', () => {
    const world = createTestWorld();
    world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
    }));

    const dims = { x: 6, y: 6, z: 6 };
    const cellSize = 0.1;

    // 1. Solid chunk: fully occupied
    const solidChunk = createVoxelChunk(dims.x, dims.y, dims.z, cellSize);
    stampBox(solidChunk.occupancy, dims, { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 }, 1);
    const cookedSolid = cookVoxelBody(solidChunk, 10);
    expect(cookedSolid.status).toBe(0);
    if (cookedSolid.status !== 0) throw new Error('Solid cook failed');

    // 2. Hollow chunk: only walls (interior 1..4 hollowed out)
    const hollowChunk = createVoxelChunk(dims.x, dims.y, dims.z, cellSize);
    stampBox(hollowChunk.occupancy, dims, { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 5 }, 1);
    stampBox(hollowChunk.occupancy, dims, { x: 1, y: 1, z: 1 }, { x: 4, y: 4, z: 4 }, 0);
    // Test setVoxelCell directly
    setVoxelCell(hollowChunk, 0, 0, 0, true);
    const cookedHollow = cookVoxelBody(hollowChunk, 5);
    expect(cookedHollow.status).toBe(0);
    if (cookedHollow.status !== 0) throw new Error('Hollow cook failed');

    const {
      created: { solidBody, hollowBody },
    } = world.edit((edit) => ({
      solidBody: edit.createBody({
        kind: 'dynamic',
        shape: cookedSolid.body.shape,
        position: { x: -2, y: -3, z: 0 }, // fully submerged below surface (y=0)
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        mass: cookedSolid.body.mass,
        inertia: cookedSolid.body.inertia,
        centerOfMass: cookedSolid.body.centerOfMass,
        linearDamping: 0.1,
        angularDamping: 0.1,
        friction: 0.5,
        restitution: 0,
        layer: 1,
        mask: 0xffffffff,
      }),
      hollowBody: edit.createBody({
        kind: 'dynamic',
        shape: cookedHollow.body.shape,
        position: { x: 2, y: -3, z: 0 }, // fully submerged below surface (y=0)
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        mass: cookedHollow.body.mass,
        inertia: cookedHollow.body.inertia,
        centerOfMass: cookedHollow.body.centerOfMass,
        linearDamping: 0.1,
        angularDamping: 0.1,
        friction: 0.5,
        restitution: 0,
        layer: 1,
        mask: 0xffffffff,
      }),
    }));

    world.step();
    const interactions = world.latest().fluidInteractions;
    const solidInter = interactions.find((fi) => fi.bodyId === solidBody.id);
    const hollowInter = interactions.find((fi) => fi.bodyId === hollowBody.id);

    expect(solidInter).toBeDefined();
    expect(hollowInter).toBeDefined();

    // Solid volume = 6 * 6 * 6 * (0.1)^3 = 216 * 0.001 = 0.216 m^3
    // Hollow volume = (216 - 4*4*4) * 0.001 = (216 - 64) * 0.001 = 0.152 m^3
    expect(solidInter!.submergedVolume).toBeCloseTo(0.216, 3);
    expect(hollowInter!.submergedVolume).toBeCloseTo(0.152, 3);
    expect(hollowInter!.submergedVolume).toBeLessThan(solidInter!.submergedVolume);

    world.dispose();
  });

  it('4. Cut and fractured voxel bodies', () => {
    const world = createTestWorld();
    world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
    }));

    const dims = { x: 4, y: 8, z: 4 };
    const cellSize = 0.1;
    const fullChunk = createVoxelChunk(dims.x, dims.y, dims.z, cellSize);
    stampBox(fullChunk.occupancy, dims, { x: 0, y: 0, z: 0 }, { x: 3, y: 7, z: 3 }, 1);
    const cookedFull = cookVoxelBody(fullChunk, 10);
    expect(cookedFull.status).toBe(0);
    if (cookedFull.status !== 0) throw new Error('Full cook failed');

    const {
      created: { fullBody },
    } = world.edit((edit) => ({
      fullBody: edit.createBody({
        kind: 'dynamic',
        shape: cookedFull.body.shape,
        position: { x: 0, y: -4, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
        mass: cookedFull.body.mass,
        inertia: cookedFull.body.inertia,
        centerOfMass: cookedFull.body.centerOfMass,
        linearDamping: 0.1,
        angularDamping: 0.1,
        friction: 0.5,
        restitution: 0,
        layer: 1,
        mask: 0xffffffff,
      }),
    }));

    world.step();
    const fullSubmerged = world.latest().fluidInteractions.find((fi) => fi.bodyId === fullBody.id)!.submergedVolume;
    expect(fullSubmerged).toBeCloseTo(4 * 8 * 4 * 0.001, 3);

    // Simulate cut: replace full body with two halves
    const halfADims = { x: 4, y: 4, z: 4 };
    const halfAChunk = createVoxelChunk(halfADims.x, halfADims.y, halfADims.z, cellSize);
    stampBox(halfAChunk.occupancy, halfADims, { x: 0, y: 0, z: 0 }, { x: 3, y: 3, z: 3 }, 1);
    const cookedHalfA = cookVoxelBody(halfAChunk, 5);
    expect(cookedHalfA.status).toBe(0);
    if (cookedHalfA.status !== 0) throw new Error('HalfA cook failed');

    const halfBDims = { x: 4, y: 4, z: 4 };
    const halfBChunk = createVoxelChunk(halfBDims.x, halfBDims.y, halfBDims.z, cellSize);
    stampBox(halfBChunk.occupancy, halfBDims, { x: 0, y: 0, z: 0 }, { x: 3, y: 3, z: 3 }, 1);
    const cookedHalfB = cookVoxelBody(halfBChunk, 5);
    expect(cookedHalfB.status).toBe(0);
    if (cookedHalfB.status !== 0) throw new Error('HalfB cook failed');

    const {
      created: { pieceA, pieceB },
    } = world.edit((edit) => {
      edit.removeBody(fullBody);
      return {
        pieceA: edit.createBody({
          kind: 'dynamic',
          shape: cookedHalfA.body.shape,
          position: { x: 0, y: -3.8, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          mass: cookedHalfA.body.mass,
          inertia: cookedHalfA.body.inertia,
          centerOfMass: cookedHalfA.body.centerOfMass,
          linearDamping: 0.1,
          angularDamping: 0.1,
          friction: 0.5,
          restitution: 0,
          layer: 1,
          mask: 0xffffffff,
        }),
        pieceB: edit.createBody({
          kind: 'dynamic',
          shape: cookedHalfB.body.shape,
          position: { x: 0, y: -4.2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          linearVelocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
          mass: cookedHalfB.body.mass,
          inertia: cookedHalfB.body.inertia,
          centerOfMass: cookedHalfB.body.centerOfMass,
          linearDamping: 0.1,
          angularDamping: 0.1,
          friction: 0.5,
          restitution: 0,
          layer: 1,
          mask: 0xffffffff,
        }),
      };
    });

    world.step();
    const interactions = world.latest().fluidInteractions;
    const interA = interactions.find((fi) => fi.bodyId === pieceA.id);
    const interB = interactions.find((fi) => fi.bodyId === pieceB.id);

    expect(interA).toBeDefined();
    expect(interB).toBeDefined();
    expect(interA!.submergedVolume + interB!.submergedVolume).toBeCloseTo(fullSubmerged, 3);

    world.dispose();
  });

  it('5. Fluid and body symmetric filters', () => {
    const world = createTestWorld();
    const {
      created: { bodyMatches, bodyMismatchLayer, bodyMismatchMask },
    } = world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 0b01, // Fluid layer 1
        mask: 0b01,  // Fluid mask 1
      }),
      // Body A: layer 1, mask 1 -> (fluid.mask & body.layer) && (body.mask & fluid.layer) => passes
      bodyMatches: edit.createBody(makeBoxBody({ position: { x: -2, y: -2, z: 0 }, layer: 0b01, mask: 0b01 })),
      // Body B: layer 2, mask 1 -> fluid.mask(1) & body.layer(2) == 0 => fails
      bodyMismatchLayer: edit.createBody(makeBoxBody({ position: { x: 0, y: -2, z: 0 }, layer: 0b10, mask: 0b01 })),
      // Body C: layer 1, mask 2 -> body.mask(2) & fluid.layer(1) == 0 => fails
      bodyMismatchMask: edit.createBody(makeBoxBody({ position: { x: 2, y: -2, z: 0 }, layer: 0b01, mask: 0b10 })),
    }));

    world.step();
    const interactions = world.latest().fluidInteractions;
    expect(interactions.map((fi) => fi.bodyId)).toContain(bodyMatches.id);
    expect(interactions.map((fi) => fi.bodyId)).not.toContain(bodyMismatchLayer.id);
    expect(interactions.map((fi) => fi.bodyId)).not.toContain(bodyMismatchMask.id);

    world.dispose();
  });

  it('6. Fluid interaction capacity overflow rejects step atomically', () => {
    // Capacity allows at most 1 fluid interaction
    const world = createTestWorld({ bodies: 10, joints: 10, fluids: 1, fluidInteractions: 1 });
    world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
      b1: edit.createBody(makeBoxBody({ position: { x: -2, y: -2, z: 0 } })),
      b2: edit.createBody(makeBoxBody({ position: { x: 0, y: -2, z: 0 } })),
      b3: edit.createBody(makeBoxBody({ position: { x: 2, y: -2, z: 0 } })),
    }));

    // Stepping should reject because 3 bodies are submerged but fluidInteractions capacity is 1
    expect(() => world.step()).toThrow();

    world.dispose();
  });

  it('7. Checkpoint capture, restore, and digest', () => {
    const world = createTestWorld();
    world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
      b1: edit.createBody(makeBoxBody({ position: { x: 0, y: -1, z: 0 } })),
    }));

    for (let i = 0; i < 10; i += 1) {
      world.step();
    }

    const checkpoint = world.captureCheckpoint();
    const digestBefore = world.digest();
    const serialized = world.serializeCheckpoint(checkpoint);
    expect(serialized.byteLength).toBeGreaterThan(0);

    // Step further
    for (let i = 0; i < 5; i += 1) {
      world.step();
    }
    expect(world.digest()).not.toEqual(digestBefore);

    // Restore checkpoint
    world.restoreCheckpoint(checkpoint);
    const digestAfter = world.digest();
    expect(digestAfter).toEqual(digestBefore);

    world.dispose();
  });

  it('8. Two-peer deterministic replay', () => {
    const peerA = createTestWorld();
    const peerB = createTestWorld();

    const setup = (w: typeof peerA) => {
      return w.edit((edit) => ({
        water: edit.createFluid({
          bounds: FLUID_BOUNDS,
          surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
          density: 1,
          linearDragPerSecond: 2,
          angularDragPerSecond: 1,
          flowVelocity: { x: 0, y: 0, z: 0 },
          layer: 1,
          mask: 0xffffffff,
        }),
        box1: edit.createBody(makeBoxBody({ position: { x: -1, y: 1, z: 0 } })),
        box2: edit.createBody(makeBoxBody({ position: { x: 1, y: 0.5, z: 0 } })),
      }));
    };

    setup(peerA);
    setup(peerB);

    for (let step = 0; step < 60; step += 1) {
      peerA.step();
      peerB.step();

      expect(peerA.digest()).toEqual(peerB.digest());
      const interA = peerA.latest().fluidInteractions;
      const interB = peerB.latest().fluidInteractions;
      expect(interA.length).toBe(interB.length);
      for (let i = 0; i < interA.length; i += 1) {
        expect(interA[i]!.submergedVolume).toBe(interB[i]!.submergedVolume);
        expect(interA[i]!.totalForce).toEqual(interB[i]!.totalForce);
      }
    }

    peerA.dispose();
    peerB.dispose();
  });

  it('9. Fluid removal and recreation', () => {
    const world = createTestWorld();
    const {
      created: { water },
    } = world.edit((edit) => ({
      water: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
      body: edit.createBody(makeBoxBody({ position: { x: 0, y: -2, z: 0 } })),
    }));

    world.step();
    expect(world.latest().fluidInteractions).toHaveLength(1);

    // Remove fluid
    world.edit((edit) => {
      edit.removeFluid(water);
    });

    world.step();
    expect(world.latest().fluidInteractions).toHaveLength(0);

    // Re-create fluid
    world.edit((edit) => ({
      newWater: edit.createFluid({
        bounds: FLUID_BOUNDS,
        surfacePlane: { normal: { x: 0, y: 1, z: 0 }, offset: 0 },
        density: 1,
        linearDragPerSecond: 2,
        angularDragPerSecond: 1,
        flowVelocity: { x: 0, y: 0, z: 0 },
        layer: 1,
        mask: 0xffffffff,
      }),
    }));

    world.step();
    expect(world.latest().fluidInteractions).toHaveLength(1);

    world.dispose();
  });
});
