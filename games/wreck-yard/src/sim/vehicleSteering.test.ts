import { describe, expect, it, onTestFinished } from 'vitest';
import { meters, metersPerSecond, vec3, type DeterministicVehicleState3D, type PhysicsBodyMotion3D } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y } from './constants';
import { NEUTRAL_INPUT, type YardInput } from './input';
import { addPhysicsBodies, makePhysicsBody, makeWorld, physicsBodyHandle, physicsStateBodyById, type OpenYardPhysicsWorld } from './physics';
import { buggySpawn } from './presets';
import { YardSim } from './sim';
import { patchPlayer, testSim } from './testSim';
import { BUGGY_WHEELS, stepBuggy, type BuggyStep } from './vehicle';

/** A real car on a large native floor, clear of road obstacles. */
function steeringFixture(speed = 5) {
  const world = makeWorld();
  onTestFinished(() => world.dispose());
  const physics: OpenYardPhysicsWorld = { world, bodyIds: new Map() };
  const car = buggySpawn();
  addPhysicsBodies(physics, [
    { id: 'steering-floor', body: { kind: 'static', material: 'concrete',
      position: vec3(meters, 0, FLOOR_Y - 0.25, 0),
      shape: { type: 'box', halfX: meters(200), halfY: meters(0.25), halfZ: meters(200) } } },
    makePhysicsBody(car.body, { position: [0, FLOOR_Y + 1.45, 0], rotation: [0, 1, 0, 0],
      linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] }),
  ]);
  const handle = physicsBodyHandle(physics, car.body.id);
  let vehicle: DeterministicVehicleState3D | undefined;
  const step = (input: YardInput = NEUTRAL_INPUT) => {
    const result = stepBuggy(physics, input, vehicle)!;
    vehicle = result.vehicle;
    world.step();
    return result;
  };
  for (let tick = 0; tick < 45; tick++) step();
  const startingHeading = heading(world.readMotion(handle));
  world.setLinearVelocity(handle, vec3(metersPerSecond, 0, 0, speed));
  return { step, read: () => world.readMotion(handle), startingHeading };
}

function heading(body: PhysicsBodyMotion3D): number {
  const q = body.orientation;
  return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
}

const front = (wheels: BuggyStep['wheels']) =>
  wheels.filter((_, index) => BUGGY_WHEELS[index]!.steered);

describe('native buggy steering', () => {
  it.each([-1, 1])('turns the physical chassis ten degrees within ten ticks at 5 m/s with input %s', (moveX) => {
    const car = steeringFixture(5);
    let responseTick: number | null = null;
    let change = 0;
    for (let tick = 1; tick <= 10; tick++) {
      car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX });
      const angle = heading(car.read()) - car.startingHeading;
      change = Math.atan2(Math.sin(angle), Math.cos(angle));
      if (Math.abs(change) >= 10 * Math.PI / 180 && responseTick === null) responseTick = tick;
    }
    expect(responseTick).not.toBeNull();
    expect(change * moveX).toBeLessThan(0);
  });

  it.each([{ amount: 0.05, units: 1 }, { amount: 0.25, units: 3 }])(
    'gives both directions equal native input and wheel response at $amount input', ({ amount, units }) => {
      const left = steeringFixture();
      const right = steeringFixture();
      const a = left.step({ ...NEUTRAL_INPUT, moveX: -amount, moveZ: -amount });
      const b = right.step({ ...NEUTRAL_INPUT, moveX: amount, moveZ: amount });
      expect(a.vehicle.lastInput.steer).toBe(units);
      expect(b.vehicle.lastInput.steer).toBe(-units);
      expect(a.vehicle.lastInput.throttle).toBe(units);
      expect(b.vehicle.lastInput.throttle).toBe(-units);
      const leftWheels = front(a.wheels);
      const rightWheels = front(b.wheels);
      for (let index = 0; index < leftWheels.length; index++) {
        expect(leftWheels[index]!.steerAngleTurns).toBeGreaterThan(0);
        expect(rightWheels[index]!.steerAngleTurns).toBeLessThan(0);
        expect(leftWheels[index]!.steerAngleTurns).toBeCloseTo(-rightWheels[index]!.steerAngleTurns, 8);
      }
    },
  );

  it('changes and reverses the front wheels on the first native tick', () => {
    const car = steeringFixture();
    const first = car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX: 1 });
    expect(front(first.wheels).every((wheel) => wheel.steerAngleTurns < 0)).toBe(true);
    expect(first.wheels.filter((_, index) => !BUGGY_WHEELS[index]!.steered)
      .every((wheel) => wheel.steerAngleTurns === 0)).toBe(true);
    const reversed = car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX: -1 });
    expect(front(reversed.wheels).every((wheel) => wheel.steerAngleTurns > 0)).toBe(true);
    const centered = car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX: 0 });
    expect(front(centered.wheels).every((wheel) => wheel.steerAngleTurns === 0)).toBe(true);
  });

  it.each([2, 5, 10, 15].flatMap((speed) => [-1, -0.25, 0.25, 1].map((moveX) => ({ speed, moveX }))))(
    'stays upright for a five-second turn from $speed m/s with input $moveX', ({ speed, moveX }) => {
      const car = steeringFixture(speed);
      let lowestUp = 1;
      let groundedTicks = 0;
      for (let tick = 0; tick < 150; tick++) {
        const result = car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX });
        const body = car.read();
        const q = body.orientation;
        lowestUp = Math.min(lowestUp, 1 - 2 * (q.x * q.x + q.z * q.z));
        if (result.wheels.some((wheel) => wheel.grounded)) groundedTicks++;
        expect([body.position.x, body.position.y, body.position.z, body.linearVelocity.x,
          body.linearVelocity.y, body.linearVelocity.z, q.x, q.y, q.z, q.w].every(Number.isFinite)).toBe(true);
      }
      expect(lowestUp).toBeGreaterThan(0.95);
      expect(groundedTicks).toBeGreaterThan(140);
      const end = car.read().position;
      expect(Math.hypot(end.x, end.z)).toBeGreaterThan(5);
    },
  );

  it('replays active steering exactly from native and serialized YardSim checkpoints', () => {
    const sim = testSim();
    for (let tick = 0; tick < 30; tick++) sim.step([NEUTRAL_INPUT]);
    const car = physicsStateBodyById(sim.state.world, 'vehicle-chassis')!;
    patchPlayer(sim, { x: car.x + 1.2, y: car.y + 0.5, z: car.z });
    sim.step([{ ...NEUTRAL_INPUT, use: true }]);
    expect(sim.state.players[0]!.ridingVehicle).toBe(true);
    for (let tick = 0; tick < 10; tick++) sim.step([{ ...NEUTRAL_INPUT, moveZ: 1, moveX: -0.25 }]);
    const saved = sim.save();
    const decoded = YardSim.decode(sim.encode(saved));
    const drive = () => {
      for (let tick = 0; tick < 45; tick++) sim.step([{ ...NEUTRAL_INPUT, moveZ: 1, moveX: tick < 20 ? -1 : 0.25 }]);
    };
    try {
      drive();
      expect(sim.state.players[0]!.ridingVehicle).toBe(true);
      expect(sim.state.buggyVehicle).toBeDefined();
      const expected = sim.save();
      try {
        const bytes = sim.encode(expected);
        const checksum = sim.checksumBytes(expected);
        for (const start of [saved, decoded]) {
          sim.restore(start);
          drive();
          const replay = sim.save();
          try {
            expect(sim.encode(replay)).toEqual(bytes);
            expect(sim.checksumBytes(replay)).toEqual(checksum);
          } finally { sim.release(replay); }
        }
      } finally { sim.release(expected); }
    } finally { sim.release(saved); sim.release(decoded); }
  });

  it.each([5, 15])('stays upright when steering centers and reverses from %s m/s', (speed) => {
    const car = steeringFixture(speed);
    let lowestUp = 1;
    for (const [moveX, ticks] of [[1, 30], [0, 20], [-1, 45], [0, 30]] as const) {
      for (let tick = 0; tick < ticks; tick++) {
        const result = car.step({ ...NEUTRAL_INPUT, moveZ: 1, moveX });
        for (const wheel of front(result.wheels)) {
          if (moveX === 0) expect(wheel.steerAngleTurns).toBe(0);
          else expect(wheel.steerAngleTurns * moveX).toBeLessThan(0);
        }
        const q = car.read().orientation;
        lowestUp = Math.min(lowestUp, 1 - 2 * (q.x * q.x + q.z * q.z));
      }
    }
    expect(lowestUp).toBeGreaterThan(0.95);
    const body = car.read();
    expect([body.position.x, body.position.y, body.position.z,
      body.linearVelocity.x, body.linearVelocity.y, body.linearVelocity.z].every(Number.isFinite)).toBe(true);
  });
});
