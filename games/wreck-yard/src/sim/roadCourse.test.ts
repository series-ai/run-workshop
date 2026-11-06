import { describe, expect, it } from 'vitest';
import { splitVoxelComponents, VoxelStatus } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y, PLAYER_RADIUS, TICK_RATE, VOXEL_SIZE } from './constants';
import { BUTTONS } from './contraptions';
import { FUEL_DRUM } from './fuelDrum';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import type { Vec3 } from './math';
import { addPhysicsBodies, makePhysicsBody, physicsBodyHandle, physicsStateBodyById, removePhysicsBodies, replacePhysicsPose, toChunk } from './physics';
import { ROAD, roadBarrelSpawn, roadCarCarryPoint, roadMagnetPosition } from './roadCourse';
import { isRoadBarrel } from './roadRuntime';
import { YardSim } from './sim';
import type { YardBody } from './state';
import { patchPlayer, patchState, testSim } from './testSim';

function advance(sim: YardSim, ticks: number, input: YardInput = NEUTRAL_INPUT): void {
  for (let tick = 0; tick < ticks; tick++) sim.step([input]);
}

function pressReset(sim: YardSim): number {
  const button = BUTTONS.find((entry) => entry.id === 'reset-car')!;
  patchPlayer(sim, { x: button.base[0] + 1, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0, wasUsePressed: false });
  sim.step([{ ...NEUTRAL_INPUT, use: true }]);
  expect(sim.state.players[0]!.feedback?.result).toBe('press');
  expect(sim.state.contraptions.roadCourse.resetFrame).toBe(sim.state.frame);
  return sim.state.frame;
}

function moveBarrelAway(sim: YardSim, slot = 0): string {
  const id = sim.state.contraptions.roadCourse.slots[slot]!;
  expect(id).toBeTruthy();
  sim.edit((physics) => replacePhysicsPose(physics, id, { x: 5 + slot, y: FLOOR_Y + 0.6, z: -7, vx: 0, vy: 0, vz: 0 }));
  return id;
}

function waitUntil(sim: YardSim, ticks: number, condition: () => boolean): void {
  for (let tick = 0; tick < ticks && !condition(); tick++) advance(sim, 1);
}

function addMagnetProbe(sim: YardSim, id: string, material: YardBody['material'], position: Vec3): void {
  const body: YardBody = { id, label: id, material, dims: { x: 6, y: 6, z: 6 }, voxels: new Uint8Array(216).fill(1), motion: 'dynamic', buoyancy: 0.1, anchorFaces: [], impactCooldownUntil: 0, heat: null };
  sim.edit((physics) => addPhysicsBodies(physics, [makePhysicsBody(body, { position, rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })]));
  const save = sim.save();
  try { sim.restore({ ...save, state: { ...save.state, bodies: [...save.state.bodies, body] } }); }
  finally { sim.release(save); }
}

function expectExactReplay(sim: YardSim, ticks: number): void {
  const start = sim.save();
  const decoded = YardSim.decode(sim.encode(start));
  try {
    advance(sim, ticks);
    const final = sim.save();
    try {
      const expected = sim.encode(final);
      const checksum = sim.checksumBytes(final);
      for (const restore of [start, decoded]) {
        sim.restore(restore);
        advance(sim, ticks);
        const replay = sim.save();
        try {
          expect(sim.encode(replay)).toEqual(expected);
          expect(sim.checksumBytes(replay)).toEqual(checksum);
        } finally { sim.release(replay); }
      }
    } finally { sim.release(final); }
  } finally { sim.release(start); sim.release(decoded); }
}

describe('Road Test with native physics', () => {
  it('keeps the small worker as one connected steel body that rests on its tracks', () => {
    const sim = testSim();
    const worker = sim.state.bodies.find((body) => body.id === ROAD.workerId)!;
    expect(worker.dims.y * VOXEL_SIZE).toBeLessThanOrEqual(1.2);
    const split = splitVoxelComponents(toChunk(worker.voxels, worker.dims));
    expect(split.status).toBe(VoxelStatus.Success);
    expect(split.subChunks).toHaveLength(1);
    expect(split.subChunks[0]!.occupiedCount).toBe(worker.voxels.filter(Boolean).length);
    const handle = physicsBodyHandle(sim.physics, worker.id);
    const native = sim.physics.world.readBody(handle);
    expect(native.kind).toBe('dynamic');
    expect(native.materialSource).toEqual({ kind: 'named', material: 'steel' });
    expect(native.mass).toBeGreaterThan(0);
    advance(sim, 120);
    const settled = sim.physics.world.readBody(handle);
    expect(Math.hypot(settled.position.x - native.position.x, settled.position.y - native.position.y,
      settled.position.z - native.position.z)).toBeLessThan(0.12);
    expect(Math.abs(settled.position.y - worker.dims.y * VOXEL_SIZE / 2 - FLOOR_Y)).toBeLessThan(0.05);
    expect(1 - 2 * (settled.orientation.x ** 2 + settled.orientation.z ** 2)).toBeGreaterThan(0.99);
    expect(settled.sleeping).toBe(true);
  });

  it('keeps four real fuel barrels in the road and leaves the worker idle', () => {
    const sim = testSim();
    const road = sim.state.contraptions.roadCourse;
    expect(road.slots).toHaveLength(4);
    for (const id of road.slots) {
      expect(sim.state.bodies.find((body) => body.id === id)?.label).toBe(FUEL_DRUM.label);
      expect(sim.state.contraptions.drums.find((drum) => drum.bodyId === id)).toEqual({ bodyId: id, damage: 0, detonateAt: null });
    }
    advance(sim, 120);
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('waiting');
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    expect(sim.state.contraptions.drums.filter((drum) => isRoadBarrel(drum.bodyId))).toHaveLength(4);
    expect(sim.state.contraptions.roadCourse.worker.agent.actionLog).toEqual([]);
  });

  it('lights a road barrel on a real car impact and destroys the nearby car', () => {
    const sim = testSim();
    advance(sim, 20);
    const id = sim.state.contraptions.roadCourse.slots[0]!;
    sim.edit((physics) => {
      replacePhysicsPose(physics, 'vehicle-chassis', { x: 6, y: FLOOR_Y + 1.45, z: 8, vx: 0, vy: 0, vz: 8 / TICK_RATE });
      replacePhysicsPose(physics, id, { x: 6, y: FLOOR_Y + 0.49, z: 10.5, vx: 0, vy: 0, vz: 0 });
    });
    patchPlayer(sim, { ridingVehicle: true, wasUsePressed: false });
    let litAt: number | null = null;
    for (let tick = 0; tick < 40; tick++) {
      sim.step([{ ...NEUTRAL_INPUT, moveZ: 1 }]);
      const barrel = sim.state.contraptions.drums.find((drum) => drum.bodyId === id);
      if (barrel?.detonateAt !== null && barrel?.detonateAt !== undefined) {
        litAt = barrel.detonateAt;
        expect(barrel.damage).toBe(FUEL_DRUM.maxDamage);
        expect(litAt - sim.state.frame).toBeLessThanOrEqual(ROAD.crashFuseTicks);
        break;
      }
    }
    expect(litAt, 'car contact did not light the road barrel').not.toBeNull();
    advance(sim, litAt! - sim.state.frame + 1);
    expect(sim.state.stats.explosions).toBeGreaterThan(0);
    expect(physicsStateBodyById(sim.state.world, 'vehicle-chassis')).toBeUndefined();
    expect(sim.state.buggyVehicle).toBeUndefined();
    expect(sim.state.buggyWheels).toEqual([]);
    expect(sim.state.players[0]!.ridingVehicle).toBe(false);
    expect(sim.state.bodies.filter((body) => body.id.startsWith('buggy-wreck-')).length).toBeGreaterThan(1);
    expect(sim.state.world.bodies.every((body) => [body.x, body.y, body.z, body.vx, body.vy, body.vz].every(Number.isFinite))).toBe(true);
    pressReset(sim);
    expect(sim.state.bodies.some((body) => body.id.startsWith('buggy-wreck-'))).toBe(false);
    expect(sim.state.bodies.filter((body) => body.label === 'Sandbox Buggy')).toHaveLength(1);
  });

  it('receives a real conveyor barrel and carries it to a vacant road slot', () => {
    const sim = testSim();
    const previous = moveBarrelAway(sim);
    advance(sim, 1);
    expect(sim.state.contraptions.roadCourse.slots[0]).toBeNull();
    const job = sim.state.contraptions.roadCourse.worker.job!;
    expect(job?.slot).toBe(0);
    const supply = physicsStateBodyById(sim.state.world, job.bodyId)!;
    expect(supply.x).toBeGreaterThan(ROAD.workerHome[0] + 2);
    expect(supply.z).toBeCloseTo(ROAD.supply[2], 1);
    waitUntil(sim, 120, () => sim.state.contraptions.roadCourse.worker.agent.state === 'deliver');
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('deliver');
    const received = physicsStateBodyById(sim.state.world, job.bodyId)!;
    expect(received.x).toBeLessThan(supply.x - 1);
    waitUntil(sim, 900, () => sim.state.contraptions.roadCourse.slots[0] !== null);
    const replacement = sim.state.contraptions.roadCourse.slots[0];
    expect(replacement, JSON.stringify({ road: sim.state.contraptions.roadCourse,
      worker: physicsStateBodyById(sim.state.world, ROAD.workerId),
      barrel: physicsStateBodyById(sim.state.world, job.bodyId) })).toBe(job.bodyId);
    expect(replacement).not.toBe(previous);
    const placed = physicsStateBodyById(sim.state.world, replacement!)!;
    expect(Math.hypot(placed.x - ROAD.slots[0][0], placed.z - ROAD.slots[0][1])).toBeLessThan(0.35);
    expect(sim.state.contraptions.drums.filter((drum) => isRoadBarrel(drum.bodyId)).length).toBeLessThanOrEqual(ROAD.barrelLimit);
    expect(sim.state.contraptions.roadCourse.worker.agent.actionLog).toEqual([]);
  });

  it('lets a player steal the worker load and releases the delivery', () => {
    const sim = testSim();
    moveBarrelAway(sim);
    advance(sim, 1);
    waitUntil(sim, 120, () => sim.state.contraptions.roadCourse.worker.agent.state === 'deliver');
    const job = sim.state.contraptions.roadCourse.worker.job!;
    expect(job).not.toBeNull();
    const barrel = physicsStateBodyById(sim.state.world, job.bodyId)!;
    const input = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
      ...quantizeRay([barrel.x, barrel.y + 3, barrel.z + 0.001], [0, -1, -0.0001]) };
    sim.step([input]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(job.bodyId);
    sim.step([input]);
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('return');
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    expect(sim.state.contraptions.roadCourse.slots[0]).toBeNull();
    expect(sim.state.players[0]!.grab?.bodyId).toBe(job.bodyId);
  });

  it('replaces all four displaced barrels through complete worker trips', () => {
    const sim = testSim();
    const original = ROAD.slots.map((_, slot) => moveBarrelAway(sim, slot));
    const phases = new Set<string>();
    let peakBarrels = 0;
    for (let tick = 0; tick < 4200; tick++) {
      advance(sim, 1);
      const road = sim.state.contraptions.roadCourse;
      phases.add(road.worker.agent.state);
      peakBarrels = Math.max(peakBarrels, sim.state.contraptions.drums.filter((drum) => isRoadBarrel(drum.bodyId)).length);
      if (road.slots.every((id, index) => id !== null && id !== original[index])
        && road.worker.agent.state === 'waiting') break;
    }
    const road = sim.state.contraptions.roadCourse;
    expect(road.slots.every((id, index) => id !== null && id !== original[index]), JSON.stringify({ road,
      worker: physicsStateBodyById(sim.state.world, ROAD.workerId),
      barrel: road.worker.job ? physicsStateBodyById(sim.state.world, road.worker.job.bodyId) : null })).toBe(true);
    expect(road.worker.agent.state).toBe('waiting');
    expect(road.worker.job).toBeNull();
    expect(phases).toEqual(new Set(['collect', 'deliver', 'return', 'waiting']));
    expect(peakBarrels).toBeLessThanOrEqual(ROAD.barrelLimit);
    expect(road.worker.agent.actionLog).toEqual([]);
    for (const [index, id] of road.slots.entries()) {
      const body = physicsStateBodyById(sim.state.world, id!)!;
      expect(Math.hypot(body.x - ROAD.slots[index]![0], body.z - ROAD.slots[index]![1])).toBeLessThan(1);
    }
  });

  it('recovers from a nearby explosion before it collects and replaces a road barrel', () => {
    const sim = testSim();
    advance(sim, 30);
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('waiting');
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    const worker = physicsStateBodyById(sim.state.world, ROAD.workerId)!;
    const explosive = roadBarrelSpawn('road-barrel-worker-blast', [worker.x + 0.95, FLOOR_Y + 0.49, worker.z]);
    sim.edit((physics) => addPhysicsBodies(physics, [makePhysicsBody(explosive.body,
      { position: explosive.position, rotation: explosive.rotation, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })]));
    patchState(sim, (state) => ({ ...state, bodies: [...state.bodies, explosive.body],
      contraptions: { ...state.contraptions, drums: [...state.contraptions.drums,
        { bodyId: explosive.body.id, damage: 0, detonateAt: null }] } }));
    let detonateAt: number | null = null;
    for (let tick = 0; tick < 80 && detonateAt === null; tick++) {
      const barrel = physicsStateBodyById(sim.state.world, explosive.body.id)!;
      sim.step([{ ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true,
        ...quantizeRay([barrel.x, barrel.y + 2, barrel.z], [0, -1, 0]) }]);
      detonateAt = sim.state.contraptions.drums.find((drum) => drum.bodyId === explosive.body.id)!.detonateAt;
    }
    expect(detonateAt).not.toBeNull();
    advance(sim, detonateAt! - sim.state.frame);
    expect(sim.state.stats.explosions).toBe(1);
    expect(physicsStateBodyById(sim.state.world, explosive.body.id)).toBeUndefined();
    expect(physicsStateBodyById(sim.state.world, ROAD.workerId)!.vx).toBeLessThan(0);
    const removed = sim.state.contraptions.roadCourse.slots[0]!;
    sim.edit((physics) => removePhysicsBodies(physics, [removed]));
    patchState(sim, (state) => ({ ...state, bodies: state.bodies.filter((body) => body.id !== removed),
      contraptions: { ...state.contraptions, drums: state.contraptions.drums.filter((drum) => drum.bodyId !== removed) } }));
    waitUntil(sim, 1200, () => {
      const road = sim.state.contraptions.roadCourse;
      return road.slots[0] !== null && road.slots[0] !== removed && road.worker.agent.state === 'waiting';
    });
    const road = sim.state.contraptions.roadCourse;
    expect(road.slots[0], JSON.stringify(road)).not.toBeNull();
    expect(road.slots[0]).not.toBe(removed);
    expect(road.worker.agent.state).toBe('waiting');
    expect(road.worker.job).toBeNull();
    const placed = physicsStateBodyById(sim.state.world, road.slots[0]!)!;
    expect(Math.hypot(placed.x - ROAD.slots[0][0], placed.z - ROAD.slots[0][1])).toBeLessThan(1);
  });

  it('releases a destroyed worker load and leaves its road slot vacant', () => {
    const sim = testSim();
    moveBarrelAway(sim);
    advance(sim, 1);
    waitUntil(sim, 120, () => sim.state.contraptions.roadCourse.worker.agent.state === 'deliver');
    const job = sim.state.contraptions.roadCourse.worker.job!;
    expect(job).not.toBeNull();
    patchState(sim, (state) => ({ ...state, contraptions: { ...state.contraptions,
      drums: state.contraptions.drums.map((drum) => drum.bodyId === job.bodyId
        ? { ...drum, damage: FUEL_DRUM.maxDamage, detonateAt: state.frame + 1 } : drum) } }));
    advance(sim, 2);
    expect(physicsStateBodyById(sim.state.world, job.bodyId)).toBeUndefined();
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    expect(sim.state.contraptions.roadCourse.slots[0]).toBeNull();
  });

  it('abandons supply moved away during collection and completes a new delivery', () => {
    const sim = testSim();
    moveBarrelAway(sim);
    advance(sim, 1);
    const abandoned = sim.state.contraptions.roadCourse.worker.job!;
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('collect');
    sim.edit((physics) => replacePhysicsPose(physics, abandoned.bodyId,
      { x: 0, y: FLOOR_Y + 0.6, z: 8, vx: 0, vy: 0, vz: 0 }));
    advance(sim, 1);
    expect(sim.state.contraptions.roadCourse.worker.agent.state).toBe('return');
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    expect(sim.state.contraptions.roadCourse.slots[0]).toBeNull();
    waitUntil(sim, 120, () => sim.state.contraptions.roadCourse.worker.job !== null);
    const replacement = sim.state.contraptions.roadCourse.worker.job!;
    expect(replacement).not.toBeNull();
    expect(replacement.bodyId).not.toBe(abandoned.bodyId);
    waitUntil(sim, 900, () => sim.state.contraptions.roadCourse.slots[0] !== null);
    expect(sim.state.contraptions.roadCourse.slots[0]).toBe(replacement.bodyId);
    const leftBehind = physicsStateBodyById(sim.state.world, abandoned.bodyId)!;
    expect(Math.hypot(leftBehind.x, leftBehind.z - 8)).toBeLessThan(1);
  });

  it('waits for barrel capacity instead of creating an unbounded supply', () => {
    const sim = testSim();
    const extras = Array.from({ length: ROAD.barrelLimit - ROAD.slots.length }, (_, index) =>
      roadBarrelSpawn(`road-barrel-extra-${index}`, [8 + index, FLOOR_Y + 0.49, -6]));
    sim.edit((physics) => addPhysicsBodies(physics, extras.map((spawn) => makePhysicsBody(spawn.body,
      { position: spawn.position, rotation: spawn.rotation, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] }))));
    patchState(sim, (state) => ({ ...state, bodies: [...state.bodies, ...extras.map((spawn) => spawn.body)],
      contraptions: { ...state.contraptions, drums: [...state.contraptions.drums,
        ...extras.map((spawn) => ({ bodyId: spawn.body.id, damage: 0, detonateAt: null }))] } }));
    moveBarrelAway(sim);
    advance(sim, 90);
    expect(sim.state.contraptions.roadCourse.slots[0]).toBeNull();
    expect(sim.state.contraptions.roadCourse.worker.job).toBeNull();
    expect(sim.state.contraptions.drums.filter((drum) => isRoadBarrel(drum.bodyId))).toHaveLength(ROAD.barrelLimit);
  });

  it('responds to reset in one tick, carries and releases a fresh car, and bounds repeated resets', () => {
    const sim = testSim();
    advance(sim, 20);
    const beforeId = sim.physics.bodyIds.get('vehicle-chassis');
    const initialCarCells = sim.state.bodies.find((body) => body.id === 'vehicle-chassis')!.voxels;
    const resetFrame = pressReset(sim);
    expect(sim.physics.bodyIds.get('vehicle-chassis')).not.toBe(beforeId);
    expect(sim.state.bodies.find((body) => body.id === 'vehicle-chassis')!.voxels).toEqual(initialCarCells);
    const fresh = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    expect(fresh.x).toBeGreaterThan(ROAD.carStart[0] + 5);
    expect(fresh.y).toBeGreaterThan(FLOOR_Y + 4);
    advance(sim, 40);
    const held = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    const target = roadCarCarryPoint(roadMagnetPosition(sim.state.frame, resetFrame));
    expect(Math.hypot(held.x - target[0], held.y - target[1], held.z - target[2])).toBeLessThan(0.5);
    advance(sim, ROAD.resetTicks + 90);
    const dropped = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    expect(Math.hypot(dropped.x - ROAD.carStart[0], dropped.z - ROAD.carStart[2])).toBeLessThan(0.7);
    expect(dropped.y).toBeLessThan(FLOOR_Y + 2);
    const count = sim.state.world.bodies.length;
    for (let reset = 0; reset < 2; reset++) {
      pressReset(sim);
      advance(sim, ROAD.resetTicks + 60);
      expect(sim.state.bodies.filter((body) => body.label === 'Sandbox Buggy')).toHaveLength(1);
      expect(sim.state.world.bodies.length).toBeLessThanOrEqual(count);
    }
  });

  it('clears the old car grab when reset replaces the native chassis', () => {
    const sim = testSim();
    advance(sim, 30);
    const car = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    const input = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
      ...quantizeRay([car.x, car.y + 2, car.z], [0, -1, 0]) };
    sim.step([input]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe('vehicle-chassis');
    const previousId = sim.physics.bodyIds.get('vehicle-chassis');
    const button = BUTTONS.find((entry) => entry.id === 'reset-car')!;
    patchPlayer(sim, { x: button.base[0] + 1, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: button.base[2], vx: 0, vy: 0, vz: 0 });
    sim.step([{ ...input, use: true }]);
    expect(sim.state.players[0]!.feedback?.result).toBe('press');
    expect(sim.physics.bodyIds.get('vehicle-chassis')).not.toBe(previousId);
    expect(sim.state.players[0]!.grab).toBeNull();
    advance(sim, 3, input);
    expect(sim.state.players[0]!.grab).toBeNull();
  });

  it('attracts and holds steel while a wood control falls', () => {
    const sim = testSim();
    const [x, y, z] = ROAD.magnetPark;
    addMagnetProbe(sim, 'magnet-steel-probe', 'steel', [x - 0.65, y - 2, z - 0.55]);
    addMagnetProbe(sim, 'magnet-wood-control', 'wood', [x + 1.5, y - 2, z - 0.55]);
    const beforeSteel = physicsStateBodyById(sim.state.world, 'magnet-steel-probe')!;
    advance(sim, 60);
    const steel = physicsStateBodyById(sim.state.world, 'magnet-steel-probe')!;
    const wood = physicsStateBodyById(sim.state.world, 'magnet-wood-control')!;
    expect(steel.y).toBeGreaterThan(beforeSteel.y + 1);
    expect(steel.y).toBeGreaterThan(y - 0.8);
    expect(wood.y).toBeLessThan(FLOOR_Y + 0.5);
    advance(sim, 60);
    const later = physicsStateBodyById(sim.state.world, 'magnet-steel-probe')!;
    expect(Math.hypot(later.x - steel.x, later.y - steel.y, later.z - steel.z)).toBeLessThan(0.2);
  });

  it('lets a gravity-gun grab remove a captured steel prop', () => {
    const sim = testSim();
    const [x, y, z] = ROAD.magnetPark;
    const id = 'magnet-grab-probe';
    addMagnetProbe(sim, id, 'steel', [x - 0.65, y - 1.5, z - 0.55]);
    advance(sim, 30);
    const steel = physicsStateBodyById(sim.state.world, id)!;
    const grab = { ...NEUTRAL_INPUT, tool: TOOL.hand, pressed: true,
      ...quantizeRay([steel.x, steel.y - 0.8, steel.z], [0, 1, 0]) };
    sim.step([grab]);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(id);
    const pull = { ...grab, ...quantizeRay([steel.x - 5, steel.y - 0.8, steel.z], [0, 1, 0]) };
    advance(sim, 30, pull);
    expect(sim.state.players[0]!.grab?.bodyId).toBe(id);
    const moved = physicsStateBodyById(sim.state.world, id)!;
    expect(moved.x).toBeLessThan(steel.x - 2);
  });

  it('replays an active claw delivery exactly from both checkpoint forms', () => {
    const sim = testSim();
    pressReset(sim);
    advance(sim, 20);
    expectExactReplay(sim, ROAD.resetTicks + 20);
  });

  it('replays active worker collection and delivery exactly from both checkpoint forms', () => {
    const sim = testSim();
    moveBarrelAway(sim);
    advance(sim, 12);
    expect(sim.state.contraptions.roadCourse.worker.job).not.toBeNull();
    expectExactReplay(sim, 220);
  });
});
