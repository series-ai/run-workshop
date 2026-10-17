// Drive the original cooked bodies on a flat floor. Then reverse the buggy.
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  createPhysicsWorld3D,
  createDeterministicVehicleState3D,
  stepDeterministicVehicleState3D,
  meters,
  metersPerSecond,
  metersPerSecondSquared,
  newtons,
  newtonsPerMeter,
  newtonSecondsPerMeter,
  radiansPerSecond,
  vec3,
  type DeterministicVehicleState3D,
  type PhysicsBody3D,
} from '@series-inc/rundot-syncplay/physics/3d';
import { YardSim } from '../src/sim/sim';
import { NEUTRAL_INPUT } from '../src/sim/input';
import { FLOOR_Y, GRAVITY, TICK_RATE } from '../src/sim/constants';
import { MATERIAL_COEFFICIENTS } from '../src/sim/materials';
import { fullPhysicsBodyById, type OpenYardPhysicsWorld } from '../src/sim/physics';
import { BUGGY_WHEELS, stepBuggy } from '../src/sim/vehicle';
import '../src/deterministicMath';

const source = YardSim.create(1);
const sourceCar = fullPhysicsBodyById(source.physics, 'yard-ne-cars-b-0')!;
const sourceChassis = fullPhysicsBodyById(source.physics, 'vehicle-chassis')!;
const sourceLeg = fullPhysicsBodyById(source.physics, 'shell:set-conveyor-leg--16.5-1')!;
if (!sourceLeg) throw new Error('The conveyor leg is missing.');
source.dispose();

function copyBody(body: PhysicsBody3D, key: string, position: readonly [number, number, number], orientation = body.orientation) {
  const { id: _id, ...input } = body;
  return {
    ...input,
    key,
    position: vec3(meters, position),
    orientation,
    linearVelocity: vec3(metersPerSecond, 0, 0, 0),
    angularVelocity: vec3(radiansPerSecond, 0, 0, 0),
  };
}

function inspectVehicle(physics: OpenYardPhysicsWorld, moveZ: number, previous?: DeterministicVehicleState3D) {
  const chassisId = physics.bodyIds.get('vehicle-chassis')!;
  const body = physics.world.readMotion(physics.world.resolveBody(chassisId));
  const definition = {
    wheels: BUGGY_WHEELS.map((wheel) => ({
      ...wheel,
      stiffness: newtonsPerMeter(wheel.stiffness * body.mass),
      damping: newtonSecondsPerMeter(wheel.damping * body.mass),
    })),
    driveForce: newtons(body.mass * 18),
    brakeForce: newtons(body.mass * 28),
  };
  const vehicle = previous ?? createDeterministicVehicleState3D(definition, chassisId);
  return stepDeterministicVehicleState3D(definition, vehicle, {
    throttle: -moveZ * 10,
    steer: 0,
    brake: moveZ ? 0 : 5,
  }, physics.world, { apply: false, checksumMode: 'disabled' });
}

const fixtureMass = sourceChassis.mass;
const fixture = {
  tickRate: TICK_RATE,
  gravity: vec3(metersPerSecondSquared, 0, -GRAVITY, 0),
  floor: {
    kind: 'static', key: 'floor',
    shape: { type: 'box', halfX: 100, halfY: 0.1, halfZ: 100 },
    position: { x: 0, y: FLOOR_Y - 0.1, z: 0 },
    ...MATERIAL_COEFFICIENTS.concrete,
    layer: sourceCar.layer, mask: sourceCar.mask,
  },
  car: copyBody(sourceCar, 'car', [0, sourceCar.position.y, 0], { x: 0, y: 0, z: 0, w: 1 }),
  leg: copyBody(sourceLeg, 'leg', [sourceLeg.position.x - sourceCar.position.x, sourceLeg.position.y, sourceLeg.position.z - sourceCar.position.z]),
  chassis: copyBody(sourceChassis, 'vehicle-chassis', [0, FLOOR_Y + 1.05, 6], { x: 0, y: 0, z: 0, w: 1 }),
  vehicleDefinition: {
    wheels: BUGGY_WHEELS.map((wheel) => ({ ...wheel, stiffness: wheel.stiffness * fixtureMass, damping: wheel.damping * fixtureMass })),
    driveForce: fixtureMass * 18, brakeForce: fixtureMass * 28,
  },
  sequence: { idleTicks: 60, driveTicks: 90, reverseTicks: 120 },
};
mkdirSync('test-results/buggy-car', { recursive: true });
writeFileSync('test-results/buggy-car/repro-fixture.json', JSON.stringify(fixture, (_key, value) => typeof value === 'bigint' ? value.toString() : value));

const results = [];
for (const includeCar of [true, false]) {
for (const chassisShape of ['voxel', 'box'] as const) {
for (const yaw of [0, Math.PI / 2]) {
  for (const offset of [0, -0.7, 0.7, 1.3, 1.8]) {
    for (const driveTicks of [60, 90, 120]) {
      if (!includeCar && (chassisShape !== 'voxel' || yaw !== 0 || offset !== 0 || driveTicks !== 90)) continue;
      const world = createPhysicsWorld3D({
        tickRate: TICK_RATE,
        initialGravity: vec3(metersPerSecondSquared, 0, -GRAVITY, 0),
        capacity: { bodies: 8, joints: 1, fluids: 1, fluidInteractions: 1, checkpoints: 2 },
      });
      const created = world.edit((edit) => ({
        floor: edit.createBody({
          kind: 'static', key: 'floor',
          shape: { type: 'box', halfX: meters(100), halfY: meters(0.1), halfZ: meters(100) },
          position: vec3(meters, 0, FLOOR_Y - 0.1, 0),
          ...MATERIAL_COEFFICIENTS.concrete,
          layer: sourceCar.layer, mask: sourceCar.mask,
        }),
        car: includeCar ? edit.createBody(copyBody(sourceCar, 'car', [0, sourceCar.position.y, 0], { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })) : undefined,
        leg: edit.createBody(copyBody(sourceLeg, 'leg', [sourceLeg.position.x - sourceCar.position.x, sourceLeg.position.y, sourceLeg.position.z - sourceCar.position.z])),
        chassis: edit.createBody({
          ...copyBody(sourceChassis, 'vehicle-chassis', [offset, FLOOR_Y + 1.05, 6], { x: 0, y: 0, z: 0, w: 1 }),
          shape: chassisShape === 'voxel' ? sourceChassis.shape : { type: 'box', halfX: meters(1.04), halfY: meters(0.72), halfZ: meters(1.52) },
        }),
      })).created;
      const physics: OpenYardPhysicsWorld = {
        world,
        bodyIds: new Map([['floor', created.floor.id], ['leg', created.leg.id], ['vehicle-chassis', created.chassis.id]]),
      };
      if (created.car) physics.bodyIds.set('car', created.car.id);
      try {
        let vehicle: DeterministicVehicleState3D | undefined;
        for (let tick = 0; tick < 60; tick += 1) {
          vehicle = stepBuggy(physics, NEUTRAL_INPUT, vehicle)!.vehicle;
          world.step();
        }
        const history = [];
        for (let tick = 0; tick < driveTicks + 120; tick += 1) {
          const moveZ = tick < driveTicks ? 1 : -1;
          const diagnostic = inspectVehicle(physics, moveZ, vehicle);
          const step = stepBuggy(physics, { ...NEUTRAL_INPUT, moveZ }, vehicle)!;
          vehicle = step.vehicle;
          world.step();
          const chassis = world.readMotion(created.chassis);
          const car = created.car ? world.readMotion(created.car) : undefined;
          history.push({ tick, moveZ, chassis, car, vehicle, wheels: diagnostic.wheels, records: diagnostic.records, events: diagnostic.events, wakeReason: diagnostic.wakeReason, contacts: world.latest().contacts });
        }
        const before = history[driveTicks - 1]!;
        const after = history.at(-1)!;
        const reverseDistance = after.chassis.position.z - before.chassis.position.z;
        const reverseHistory = history.slice(driveTicks);
        const airborneReverseTicks = reverseHistory.filter((row) => row.wheels.every((wheel) => !wheel.grounded)).length;
        const zeroForceReverseTicks = reverseHistory.filter((row) => row.records.forces.length === 0).length;
        const unsupportedReverseTicks = reverseHistory.filter((row) => row.wheels.every((wheel) => wheel.supportClass === 'unsupported-normal')).length;
        const groundedZeroForceReverseTicks = reverseHistory.filter((row) => row.wheels.every((wheel) => wheel.grounded) && row.records.forces.length === 0).length;
        const summary = { includeCar, chassisShape, yaw, offset, driveTicks, reverseDistance, airborneReverseTicks, unsupportedReverseTicks, groundedZeroForceReverseTicks, zeroForceReverseTicks, before: before.chassis.position, after: after.chassis.position, grounded: after.wheels.map((wheel) => wheel.grounded) };
        results.push({ ...summary, history });
        console.log(JSON.stringify(summary));
      } finally {
        world.dispose();
      }
    }
  }
}
}
}
mkdirSync('test-results/buggy-car', { recursive: true });
writeFileSync('test-results/buggy-car/isolated-conveyor-probe.json', JSON.stringify(results, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
