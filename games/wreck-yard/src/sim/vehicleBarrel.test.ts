import { describe, expect, it } from 'vitest';
import type { DeterministicVehicleState3D } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y } from './constants';
import { NEUTRAL_INPUT, type YardInput } from './input';
import { makePhysicsBody, makeWorld, physicsBodyHandle, shellBodies, type OpenYardPhysicsWorld } from './physics';
import { createSpawns } from './presets';
import { stepBuggy } from './vehicle';

function barrelFixture(axis: 'x' | 'z') {
  const spawns = createSpawns();
  const chassis = spawns.find(spawn => spawn.body.id === 'vehicle-chassis')!;
  const barrel = spawns.find(spawn => spawn.body.id === 'hazard-drum-1')!;
  const floor = shellBodies().find(body => body.id.endsWith('floor'))!;
  const pose = (position: readonly [number, number, number], rotation: readonly [number, number, number, number]) => ({
    position, rotation, linearVelocity: [0, 0, 0] as const, angularVelocity: [0, 0, 0] as const,
  });
  const rotation = axis === 'x'
    ? [Math.SQRT1_2, 0, 0, Math.SQRT1_2] as const
    : [0, 0, Math.SQRT1_2, Math.SQRT1_2] as const;
  const world = makeWorld();
  try {
    const created = world.edit(edit => ({
      floor: edit.createBody({ ...floor.body, key: 'floor' }),
      barrel: edit.createBody({
        ...makePhysicsBody(barrel.body, pose([0, FLOOR_Y + .4, 0], rotation)).body,
        key: barrel.body.id,
      }),
      chassis: edit.createBody({
        ...makePhysicsBody(chassis.body, pose([0, 2, 0], [0, 0, 0, 1])).body,
        key: chassis.body.id,
      }),
    })).created;
    const physics: OpenYardPhysicsWorld = {
      world, bodyIds: new Map([[chassis.body.id, created.chassis.id], [barrel.body.id, created.barrel.id]]),
    };
    return { physics, chassisId: chassis.body.id, barrelId: barrel.body.id };
  } catch (error) {
    world.dispose();
    throw error;
  }
}

describe('buggy on a fallen barrel', () => {
  it.each(['x', 'z'] as const)('drives both ways after dropping onto a barrel tipped about %s', axis => {
    const { physics, chassisId, barrelId } = barrelFixture(axis);
    const world = physics.world;
    let vehicle: DeterministicVehicleState3D | undefined;
    let airborneTicks = 0;
    const advance = (input: YardInput) => {
      const handle = physicsBodyHandle(physics, chassisId);
      const before = world.readMotion(handle);
      const result = stepBuggy(physics, input, vehicle)!;
      vehicle = result.vehicle;
      if (result.wheels.every(wheel => !wheel.grounded)) {
        airborneTicks++;
        const after = world.readMotion(handle);
        const pending = world.readPendingSupportImpulse(handle);
        expect(after.linearVelocity).toEqual(before.linearVelocity);
        expect(after.angularVelocity).toEqual(before.angularVelocity);
        expect(pending.linear).toEqual({ x: 0, y: 0, z: 0 });
        expect(pending.angular).toEqual({ x: 0, y: 0, z: 0 });
      }
      world.step();
      return result;
    };
    try {
      for (let tick = 0; tick < 90; tick++) advance(NEUTRAL_INPUT);
      expect(airborneTicks).toBeGreaterThan(0);
      expect(world.contactData().some(contact =>
        (contact.bodyKeyA === barrelId && contact.bodyKeyB === chassisId)
        || (contact.bodyKeyA === chassisId && contact.bodyKeyB === barrelId),
      )).toBe(true);
      const settled = world.readMotion(physicsBodyHandle(physics, chassisId));
      const savedVehicle = structuredClone(vehicle);
      const checkpoint = world.captureCheckpoint();
      try {
        for (const moveZ of [1, -1]) {
          let expected: { digest: bigint; vehicle: DeterministicVehicleState3D | undefined } | undefined;
          for (let repeat = 0; repeat < 2; repeat++) {
            world.restoreCheckpoint(checkpoint);
            vehicle = structuredClone(savedVehicle);
            let groundedTicks = 0;
            for (let tick = 0; tick < 120; tick++) {
              const result = advance({ ...NEUTRAL_INPUT, moveZ });
              if (result.wheels.some(wheel => wheel.grounded)) groundedTicks++;
            }
            const after = world.readMotion(physicsBodyHandle(physics, chassisId));
            expect(Math.hypot(after.position.x - settled.position.x, after.position.z - settled.position.z)).toBeGreaterThan(1);
            expect(groundedTicks).toBeGreaterThan(100);
            const actual = { digest: world.digest(), vehicle: structuredClone(vehicle) };
            if (expected === undefined) expected = actual;
            else expect(actual).toEqual(expected);
          }
        }
      } finally { world.releaseCheckpoint(checkpoint); }
    } finally { world.dispose(); }
  });
});
