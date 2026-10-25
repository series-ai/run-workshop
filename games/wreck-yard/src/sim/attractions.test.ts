import { describe, expect, it } from 'vitest';
import { ELEVATOR, STORAGE, STORAGE_BOUNDS, type AttractionCommand, type ElevatorFloor } from './attractions';
import { DT, FLOOR_Y, PLAYER_HEIGHT, PLAYER_MOVE_SPEED, PLAYER_RADIUS, TICK_RATE } from './constants';
import { NEUTRAL_INPUT, quantizeRay, TOOL, type YardInput } from './input';
import { makePhysicsBody, physicsStateBodyById, removePhysicsBody, replacePhysicsBody, replacePhysicsPose, setPhysicsBodyLinearDamping, setPhysicsBodyVelocity } from './physics';
import { YardSim } from './sim';
import { RETURNS_PAIR } from './returns';
import { createCrateSpawns } from './storage';
import { patchPlayer, patchState, testSim } from './testSim';

function step(sim: YardSim, ticks = 1, input: YardInput = NEUTRAL_INPUT): void {
  for (let i = 0; i < ticks; i++) sim.step(sim.state.players.map((_, slot) => slot === 0 ? input : NEUTRAL_INPUT));
}
function command(sim: YardSim, attraction: AttractionCommand, sequence = sim.state.players[0]!.lastAttractionRequest + 1): void {
  step(sim, 1, { ...NEUTRAL_INPUT, attraction, attractionRequest: sequence });
}
function standOnLift(sim: YardSim): void {
  patchPlayer(sim, { x: ELEVATOR.x - 0.8, y: sim.state.attractions.elevator.y + PLAYER_RADIUS + 0.01, z: ELEVATOR.z, vx: 0, vy: 0, vz: 0, grounded: true });
  step(sim, 5);
}
function reachFloor(sim: YardSim, floor: ElevatorFloor): void {
  command(sim, (floor + 1) as AttractionCommand);
  for (let i = 0; i < 260 && (sim.state.attractions.elevator.status !== 'ready' || sim.state.attractions.elevator.target !== floor); i++) step(sim);
  expect(sim.state.attractions.elevator.target).toBe(floor);
  expect(sim.state.attractions.elevator.status).toBe('ready');
  expect(sim.state.attractions.elevator.y).toBeCloseTo(ELEVATOR.floors[floor], 4);
}
function liveBytes(sim: YardSim): Uint8Array {
  const save = sim.save();
  try { return sim.encode(save); } finally { sim.release(save); }
}
function liveChecksum(sim: YardSim): Uint8Array {
  const save = sim.save();
  try { return sim.checksumBytes(save); } finally { sim.release(save); }
}
function standAtReset(sim: YardSim): void {
  patchPlayer(sim, { x: ELEVATOR.resetButton[0], y: FLOOR_Y + PLAYER_RADIUS, z: ELEVATOR.resetButton[2] + 0.8, vx: 0, vy: 0, vz: 0 });
}

describe('native storage attraction', () => {
  it('keeps 400 separate boxes stable and transfers native bottom-layer motion upward', () => {
    const sim = testSim(4);
    const spawns = createCrateSpawns('storage');
    expect(sim.state.bodies.filter((b) => b.storageBay === 'storage')).toHaveLength(400);
    expect(sim.state.bodies.filter((b) => b.storageBay === 'returns')).toHaveLength(36);
    step(sim, 180);
    for (const spawn of spawns) {
      const body = physicsStateBodyById(sim.state.world, spawn.body.id)!;
      expect(body, spawn.body.id).toBeDefined();
      expect(Math.hypot(body.x - spawn.position[0], body.z - spawn.position[2]), spawn.body.id).toBeLessThan(0.15);
      expect(Math.abs(body.y - spawn.position[1]), spawn.body.id).toBeLessThan(0.15);
    }
    const layerSize = STORAGE.columns * STORAGE.rows;
    const bottom = spawns.slice(0, layerSize).map((spawn) => physicsStateBodyById(sim.state.world, spawn.body.id)!);
    const top = spawns.slice(-layerSize).map((spawn) => physicsStateBodyById(sim.state.world, spawn.body.id)!);
    const settled = sim.save();
    try {
      step(sim, 180);
      const neutral = new Map(spawns.map(({ body }) => [body.id, physicsStateBodyById(sim.state.world, body.id)!]));
      expect(top.filter((body) => Math.hypot(neutral.get(body.id)!.x - body.x, neutral.get(body.id)!.z - body.z) > STORAGE.size / 96)).toHaveLength(0);
      sim.restore(settled);
      sim.edit((physics) => {
        // Keep the shove below the crate break speed of 8 m/s.
        for (const spawn of spawns.slice(0, layerSize)) setPhysicsBodyVelocity(physics, spawn.body.id, [0, 0, 6 / TICK_RATE]);
      });
      step(sim, 180);
      const movedHorizontally = (before: typeof bottom[number], distance: number) => {
        const after = physicsStateBodyById(sim.state.world, before.id)!;
        const control = neutral.get(before.id)!;
        return Math.hypot(after.x - before.x, after.z - before.z) > distance
          && Math.hypot(after.x - control.x, after.z - control.z) > distance;
      };
      // Check horizontal response against the same settled state with no shove.
      expect(bottom.filter((body) => movedHorizontally(body, STORAGE.size / 16)).length).toBeGreaterThan(20);
      expect(top.filter((body) => movedHorizontally(body, STORAGE.size / 96)).length).toBeGreaterThan(20);
      expect(sim.state.bodies.filter((b) => b.storageBay === 'storage')).toHaveLength(400);
    } finally {
      sim.release(settled);
    }
  });

  it('carries a rider and a loose crate to every floor in both directions', () => {
    const sim = testSim();
    standOnLift(sim);
    sim.edit((physics) => replacePhysicsPose(physics, 'shipping-returns-35', { x: ELEVATOR.x + 0.7, y: FLOOR_Y + STORAGE.size / 2 + 0.02, z: ELEVATOR.z, vx: 0, vy: 0, vz: 0 }));
    step(sim, 12);
    for (const floor of [1, 2, 3, 2, 1, 0] as const) {
      reachFloor(sim, floor);
      step(sim, 5);
      expect(sim.state.players[0]!.y - PLAYER_RADIUS).toBeCloseTo(ELEVATOR.floors[floor], 1);
      expect(sim.state.players[0]!.grounded).toBe(true);
      const crate = physicsStateBodyById(sim.state.world, 'shipping-returns-35')!;
      expect(crate.y - STORAGE.size / 2).toBeCloseTo(ELEVATOR.floors[floor], 1);
      expect(Math.abs(crate.x - ELEVATOR.x)).toBeLessThan(1.3);
    }
  });

  it('drops the upper stack after all native bottom supports are removed', () => {
    const sim = testSim(4);
    step(sim, 30);
    const spawns = createCrateSpawns('storage');
    const removed = new Set(spawns.slice(0, STORAGE.columns * STORAGE.rows).map((spawn) => spawn.body.id));
    const top = spawns.slice(-STORAGE.columns * STORAGE.rows).map((spawn) => ({ id: spawn.body.id, y: physicsStateBodyById(sim.state.world, spawn.body.id)!.y }));
    sim.edit((physics) => { for (const id of removed) removePhysicsBody(physics, id); });
    patchState(sim, (state) => ({ ...state, bodies: state.bodies.filter((body) => !removed.has(body.id)) }));
    step(sim, 120);
    expect(top.filter(({ id, y }) => physicsStateBodyById(sim.state.world, id)!.y < y - 0.5).length).toBeGreaterThan(20);
    expect(sim.state.bodies.filter((body) => body.storageBay === 'storage')).toHaveLength(360);
  });

  it('releases the rider when the jetpack starts', () => {
    const sim = testSim();
    standOnLift(sim);
    command(sim, 4);
    step(sim, 30);
    step(sim, 15, { ...NEUTRAL_INPUT, jetpack: true });
    expect(sim.state.players[0]!.jetpackActive).toBe(true);
    expect(sim.state.players[0]!.grounded).toBe(false);
    expect(sim.state.players[0]!.y - PLAYER_RADIUS - sim.state.attractions.elevator.y).toBeGreaterThan(0.25);
  });

  it('limits lift acceleration when a moving rider selects the opposite floor', () => {
    const sim = testSim();
    standOnLift(sim);
    command(sim, 4);
    step(sim, 30);
    let previous = sim.state.attractions.elevator.velocity;
    expect(previous).toBeCloseTo(ELEVATOR.speed, 5);
    const startY = sim.state.attractions.elevator.y;
    command(sim, 1);
    for (let tick = 0; tick < 35; tick++) {
      const current = sim.state.attractions.elevator.velocity;
      expect(Math.abs(current - previous)).toBeLessThanOrEqual(ELEVATOR.acceleration * DT + 1e-8);
      previous = current;
      if (tick < 34) step(sim);
    }
    expect(sim.state.attractions.elevator.velocity).toBeLessThan(0);
    expect(sim.state.attractions.elevator.y).toBeGreaterThan(startY);
    expect(sim.state.players[0]!.y - PLAYER_RADIUS).toBeCloseTo(sim.state.attractions.elevator.y, 1);
  });

  it('stops a descending car when a player enters below it during that tick', () => {
    const sim = testSim();
    const top = FLOOR_Y + PLAYER_HEIGHT + ELEVATOR.size[1] + 0.04;
    sim.edit((physics) => replacePhysicsPose(physics, ELEVATOR.id, { y: top - ELEVATOR.size[1] / 2, vx: 0, vy: -ELEVATOR.speed / TICK_RATE, vz: 0 }));
    patchState(sim, (state) => ({ ...state, attractions: { ...state.attractions, elevator: { y: top, velocity: -ELEVATOR.speed, target: 0, status: 'moving' } } }));
    patchPlayer(sim, { x: ELEVATOR.x + ELEVATOR.size[0] / 2 + PLAYER_RADIUS + 0.03, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: ELEVATOR.z, vx: -PLAYER_MOVE_SPEED, vy: 0, vz: 0, grounded: true });
    step(sim, 1, { ...NEUTRAL_INPUT, moveX: -1 });
    const player = sim.state.players[0]!;
    expect(player.x - ELEVATOR.x).toBeLessThan(ELEVATOR.size[0] / 2 + PLAYER_RADIUS);
    expect(sim.state.attractions.elevator.status).toBe('blocked');
    expect(sim.state.attractions.elevator.y).toBeCloseTo(top, 5);
    expect(sim.state.attractions.elevator.y - ELEVATOR.size[1]).toBeGreaterThanOrEqual(player.y + PLAYER_HEIGHT - PLAYER_RADIUS);
  });

  it('rejects remote commands and consumes each request once', () => {
    const sim = testSim();
    command(sim, 4, 17);
    expect(sim.state.attractions.elevator.target).toBe(0);
    command(sim, 5, 18);
    expect(sim.state.attractions.resetFrame).toBeLessThan(0);
    standOnLift(sim);
    command(sim, 4, 19);
    expect(sim.state.attractions.elevator.target).toBe(3);
    command(sim, 2, 19);
    expect(sim.state.attractions.elevator.target).toBe(3);
  });

  it('blocks restack for a player and for an unrelated loose body', () => {
    const sim = testSim(2);
    standAtReset(sim);
    patchPlayer(sim, { x: STORAGE.center[0], y: FLOOR_Y + PLAYER_RADIUS, z: STORAGE.center[2] }, 1);
    command(sim, 5);
    expect(sim.state.attractions.resetStatus).toBe('blocked');
    expect(sim.state.attractions.resetFrame).toBeLessThan(0);
    patchPlayer(sim, { x: 3, y: FLOOR_Y + PLAYER_RADIUS, z: 10 }, 1);
    sim.edit((physics) => replacePhysicsPose(physics, 'ballast-box', { x: STORAGE.center[0], y: FLOOR_Y + 0.5, z: STORAGE_BOUNDS.max[2] + 0.2, vx: 0, vy: 0, vz: 0 }));
    command(sim, 5);
    expect(sim.state.attractions.resetStatus).toBe('blocked');
    expect(sim.state.attractions.resetFrame).toBeLessThan(0);
  });

  it('restacks owned crates outside the bay and preserves returns crates', () => {
    const sim = testSim();
    sim.edit((physics) => replacePhysicsPose(physics, 'shipping-storage-399', { x: 5, y: 0, z: 11, vx: 0, vy: 0, vz: 0 }));
    const returns = sim.state.bodies.filter((body) => body.storageBay === 'returns').map((body) => body.id);
    standAtReset(sim);
    command(sim, 5);
    expect(sim.state.attractions.resetStatus).toBe('ready');
    expect(sim.state.attractions.resetFrame).toBe(sim.state.frame);
    expect(physicsStateBodyById(sim.state.world, 'shipping-storage-399')!.x).toBeLessThan(-9);
    expect(sim.state.bodies.filter((body) => body.storageBay === 'storage')).toHaveLength(400);
    expect(sim.state.bodies.filter((body) => body.storageBay === 'returns').map((body) => body.id)).toEqual(returns);
  });

  it('removes cut storage fragments outside the bay on restack', () => {
    const sim = testSim();
    const source = sim.state.bodies.find((body) => body.id === 'shipping-storage-399')!;
    // Fix a thin crate in place to test fragment ownership with a local stroke.
    const plate = { ...source, motion: 'fixed' as const, anchorFaces: ['-x'] as const, dims: { ...source.dims, z: 2 }, voxels: source.voxels.slice(0, source.dims.x * source.dims.y * 2) };
    sim.edit((physics) => replacePhysicsBody(physics, makePhysicsBody(plate, {
      position: [5, FLOOR_Y + STORAGE.size / 2, 11], rotation: [0, 0, 0, 1],
      linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0],
    })));
    patchState(sim, (state) => ({ ...state, bodies: state.bodies.map((body) => body.id === source.id ? plate : body) }));
    step(sim, 10);
    for (let i = 0; i <= 32; i++) {
      const y = FLOOR_Y + STORAGE.size + 0.02 - i * (STORAGE.size + 0.04) / 32;
      step(sim, 4, { ...NEUTRAL_INPUT, tool: TOOL.torch, pressed: true, ...quantizeRay([5, y, 13], [0, 0, -1]) });
    }
    const fragments = sim.state.bodies.filter((body) => body.id.startsWith('shipping-storage-399-p'));
    expect(fragments.length).toBeGreaterThan(0);
    expect(fragments.every((body) => body.storageBay === 'storage')).toBe(true);
    standAtReset(sim);
    command(sim, 5);
    expect(sim.state.attractions.resetStatus).toBe('ready');
    for (const fragment of fragments) {
      expect(sim.state.bodies.some((body) => body.id === fragment.id)).toBe(false);
      expect(physicsStateBodyById(sim.state.world, fragment.id)).toBeUndefined();
    }
    expect(sim.state.bodies.filter((body) => body.storageBay === 'storage')).toHaveLength(400);
  });

  it('replays moving lift state through native and serialized checkpoints', () => {
    const sim = testSim();
    standOnLift(sim);
    command(sim, 4);
    step(sim, 40);
    expect(sim.state.attractions.elevator.status).toBe('moving');
    const saved = sim.save();
    try {
      const bytes = sim.encode(saved);
      step(sim, 90);
      const expected = liveBytes(sim);
      sim.restore(saved);
      step(sim, 90);
      expect(liveBytes(sim)).toEqual(expected);
      const restored = testSim();
      restored.restore(YardSim.decode(bytes));
      step(restored, 90);
      expect(liveBytes(restored)).toEqual(expected);
    } finally { sim.release(saved); }
  });
});

describe('native returns doors', () => {
  for (const side of ['A', 'B'] as const) {
    it(`walks across the plane outside door ${side}`, () => {
      const sim = testSim();
      if (side === 'B') {
        const ids = sim.state.bodies.filter((body) => body.storageBay === 'storage').map((body) => body.id);
        sim.edit((physics) => { for (const id of ids) removePhysicsBody(physics, id); });
        patchState(sim, (state) => ({ ...state, bodies: state.bodies.filter((body) => body.storageBay !== 'storage') }));
      }
      const direction = side === 'A' ? 1 : -1;
      const planeZ = side === 'A' ? 20 : -21;
      patchPlayer(sim, { x: side === 'A' ? 15 : -15, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: planeZ - direction * 0.5, vx: 0, vy: 0, vz: 0, grounded: true });
      step(sim, 15, { ...NEUTRAL_INPUT, moveZ: -direction });
      expect(sim.state.players[0]!.portalTeleports).toBe(0);
      expect((sim.state.players[0]!.z - planeZ) * direction).toBeGreaterThan(0.5);
    });

    it(`flies above door ${side} without hitting its plane`, () => {
      const sim = testSim();
      const entry = side === 'A' ? RETURNS_PAIR.portalA : RETURNS_PAIR.portalB;
      const direction = side === 'A' ? 1 : -1;
      patchPlayer(sim, { x: entry.position.x, y: FLOOR_Y + 6.4, z: entry.position.z - direction * 0.5, vx: 0, vy: 0, vz: 0, grounded: false });
      step(sim, 15, { ...NEUTRAL_INPUT, moveZ: -direction, jetpack: true });
      expect(sim.state.players[0]!.portalTeleports).toBe(0);
      expect((sim.state.players[0]!.z - entry.position.z) * direction).toBeGreaterThan(0.5);
    });
  }

  for (const side of ['A', 'B'] as const) {
    it(`walks through door ${side} and changes the player snap counter`, () => {
      const sim = testSim();
      const entry = side === 'A' ? RETURNS_PAIR.portalA : RETURNS_PAIR.portalB;
      const exit = side === 'A' ? RETURNS_PAIR.portalB : RETURNS_PAIR.portalA;
      const direction = side === 'A' ? 1 : -1;
      patchPlayer(sim, { x: entry.position.x, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: entry.position.z - direction * 0.5, vx: 0, vy: 0, vz: 0, grounded: true });
      step(sim, 15, { ...NEUTRAL_INPUT, moveZ: -direction });
      const player = sim.state.players[0]!;
      expect(player.portalTeleports).toBe(1);
      expect(player.x).toBeCloseTo(exit.position.x, 2);
      expect(Math.abs(player.z - exit.position.z)).toBeLessThan(4);
      expect(player.vz * direction).toBeGreaterThan(0);
    });
  }

  it('blocks a capsule at the door edge and an occupied exit', () => {
    const sim = testSim();
    patchPlayer(sim, { x: RETURNS_PAIR.portalA.position.x + 2.35, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 19.5, vx: 0, vy: 0, vz: 0, grounded: true });
    step(sim, 15, { ...NEUTRAL_INPUT, moveZ: -1 });
    expect(sim.state.players[0]!.portalTeleports).toBe(0);
    sim.edit((physics) => replacePhysicsPose(physics, 'ballast-box', { x: 7, y: FLOOR_Y + 0.5, z: -20.9, vx: 0, vy: 0, vz: 0 }));
    patchPlayer(sim, { x: -2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 19.7, vx: 0, vy: 0, vz: 0, grounded: true });
    step(sim, 6, { ...NEUTRAL_INPUT, moveZ: -1 });
    expect(sim.state.players[0]!.portalTeleports).toBe(0);
    expect(sim.state.players[0]!.x).toBeLessThan(0);
    expect(sim.state.players[0]!.z).toBeLessThan(20);
  });

  it('throws a native crate through a door with a body snap counter', () => {
    const sim = testSim();
    const id = 'shipping-returns-35';
    sim.edit((physics) => replacePhysicsPose(physics, id, { x: -2, y: FLOOR_Y + 1.6, z: 19, vx: 0, vy: 0, vz: 8 / TICK_RATE }));
    const setupTeleports = physicsStateBodyById(sim.state.world, id)!.teleportCounter!;
    step(sim, 12);
    const body = physicsStateBodyById(sim.state.world, id)!;
    expect(body.teleportCounter).toBe(setupTeleports + 1);
    expect(body.x).toBeCloseTo(7, 1);
    expect(body.z).toBeLessThan(-15);
    expect(body.vz).toBeGreaterThan(0);
  });

  it('replays a portal crossing through native and serialized checkpoints', () => {
    const sim = testSim();
    patchPlayer(sim, { x: -2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: 19.5, vx: 0, vy: 0, vz: 0, grounded: true });
    sim.edit((physics) => replacePhysicsPose(physics, 'shipping-returns-35', { x: -3.2, y: FLOOR_Y + 1.6, z: 19.5, vx: 0, vy: 0, vz: 8 / TICK_RATE }));
    const setupTeleports = physicsStateBodyById(sim.state.world, 'shipping-returns-35')!.teleportCounter!;
    step(sim);
    expect(sim.state.world.portalStraddlers?.some((entry) => entry.bodyId === 'shipping-returns-35')).toBe(true);
    const input = { ...NEUTRAL_INPUT, moveZ: -1 };
    const saved = sim.save();
    try {
      const bytes = sim.encode(saved);
      step(sim, 15, input);
      expect(sim.state.players[0]!.portalTeleports).toBe(1);
      expect(physicsStateBodyById(sim.state.world, 'shipping-returns-35')!.teleportCounter).toBe(setupTeleports + 1);
      const expected = liveBytes(sim);
      sim.restore(saved);
      step(sim, 15, input);
      expect(liveBytes(sim)).toEqual(expected);
      const restored = testSim();
      restored.restore(YardSim.decode(bytes));
      expect(restored.state.world.portalStraddlers).toEqual(saved.state.world.portalStraddlers);
      step(restored, 15, input);
      expect(liveBytes(restored)).toEqual(expected);
    } finally { sim.release(saved); }
  });

  it('moves a buggy rider with the native chassis across a door', () => {
    const sim = testSim();
    sim.edit((physics) => replacePhysicsPose(physics, 'vehicle-chassis', { x: 7, y: FLOOR_Y + 0.8, z: -19, vx: 0, vy: 0, vz: 0 }));
    patchPlayer(sim, { x: 8.2, y: FLOOR_Y + PLAYER_RADIUS + 0.01, z: -19, vx: 0, vy: 0, vz: 0 });
    step(sim, 1, { ...NEUTRAL_INPUT, use: true });
    expect(sim.state.players[0]!.ridingVehicle).toBe(true);
    sim.edit((physics) => setPhysicsBodyVelocity(physics, 'vehicle-chassis', [0, 0, -8 / TICK_RATE]));
    const setupTeleports = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!.teleportCounter!;
    step(sim, 25, { ...NEUTRAL_INPUT, moveZ: 1 });
    const chassis = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    const rider = sim.state.players[0]!;
    expect(chassis.teleportCounter).toBe(setupTeleports + 1);
    expect(rider.portalTeleports).toBe(1);
    expect(rider.ridingVehicle).toBe(true);
    expect(rider.x).toBe(chassis.x);
    expect(rider.z).toBeCloseTo(chassis.z + 0.12, 5);
  });
});

describe('native checkpoint checksum', () => {
  it('gives native and decoded saves the same checksum without changing the live world', () => {
    const sim = testSim();
    sim.edit((physics) => replacePhysicsPose(physics, 'shipping-returns-35', { x: -3.2, y: FLOOR_Y + 1.6, z: 19.5, vx: 0, vy: 0, vz: 8 / TICK_RATE }));
    step(sim);
    expect(sim.state.world.portalStraddlers?.length).toBeGreaterThan(0);
    const saved = sim.save();
    try {
      const expected = sim.checksumBytes(saved);
      const decoded = YardSim.decode(sim.encode(saved));
      step(sim, 15);
      const current = liveBytes(sim);
      expect(sim.checksumBytes(saved)).toEqual(expected);
      expect(sim.checksumBytes(decoded)).toEqual(expected);
      expect(liveBytes(sim)).toEqual(current);
    } finally { sim.release(saved); }
  });

  it('detects a native damping change when game fields and body poses stay equal', () => {
    const sim = testSim();
    const saved = sim.save();
    try {
      const before = sim.checksumBytes(saved);
      sim.edit((physics) => setPhysicsBodyLinearDamping(physics, 'ballast-box', 0.123));
      expect(sim.state).toEqual(saved.state);
      expect(liveChecksum(sim)).not.toEqual(before);
    } finally { sim.release(saved); }
  });

  it('detects changed game fields with the same native checkpoint', () => {
    const sim = testSim();
    const saved = sim.save();
    try {
      const before = sim.checksumBytes(saved);
      expect(sim.checksumBytes({ ...saved, state: { ...saved.state, attractions: { ...saved.state.attractions, elevator: { ...saved.state.attractions.elevator, target: 3 } } } })).not.toEqual(before);
      expect(sim.checksumBytes({ ...saved, state: { ...saved.state, players: saved.state.players.map((player) => ({ ...player, portalTeleports: player.portalTeleports + 1 })) } })).not.toEqual(before);
    } finally { sim.release(saved); }
  });

  it('detects changed voxel contents with the same native checkpoint', () => {
    const sim = testSim();
    const saved = sim.save();
    try {
      const before = sim.checksumBytes(saved);
      const bodies = saved.state.bodies.map((body) => {
        if (body.id !== 'shipping-storage-399') return body;
        const voxels = body.voxels.slice();
        voxels[0] = 0;
        return { ...body, voxels };
      });
      expect(sim.checksumBytes({ ...saved, state: { ...saved.state, bodies } })).not.toEqual(before);
      expect(sim.checksumBytes(saved)).toEqual(before);
    } finally { sim.release(saved); }
  });

  it('replays the moving lift checksum after native and serialized restore', () => {
    const sim = testSim();
    standOnLift(sim);
    command(sim, 4);
    step(sim, 30);
    const saved = sim.save();
    try {
      const bytes = sim.encode(saved);
      step(sim, 30);
      const expected = liveChecksum(sim);
      sim.restore(saved);
      step(sim, 30);
      expect(liveChecksum(sim)).toEqual(expected);
      const restored = testSim();
      restored.restore(YardSim.decode(bytes));
      step(restored, 30);
      expect(liveChecksum(restored)).toEqual(expected);
    } finally { sim.release(saved); }
  });
});
