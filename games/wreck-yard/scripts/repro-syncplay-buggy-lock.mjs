// Run against the published SDK. No game code or input hooks run here.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { initPhysics3D, createPhysicsWorld3D, createDeterministicVehicleState3D, stepDeterministicVehicleState3D } from '@series-inc/rundot-syncplay/physics/3d';
import { installDeterministicMath } from '@series-inc/rundot-syncplay/core/deterministic-math';

installDeterministicMath();
await initPhysics3D();
const fixture = JSON.parse(await readFile(new URL('./fixtures/syncplay-buggy-lock.json', import.meta.url), 'utf8'));
const output = new URL('../test-results/buggy-car/', import.meta.url);
await mkdir(output, { recursive: true });

function localPoint(point, motion) {
  const q = motion.orientation;
  const x = point.x - motion.position.x, y = point.y - motion.position.y, z = point.z - motion.position.z;
  const tx = 2 * (-q.y * z + q.z * y);
  const ty = 2 * (-q.z * x + q.x * z);
  const tz = 2 * (-q.x * y + q.y * x);
  return [x + q.w * tx - q.y * tz + q.z * ty, y + q.w * ty - q.z * tx + q.x * tz, z + q.w * tz - q.x * ty + q.y * tx];
}

const results = [];
for (const shape of ['voxel', 'box']) {
  const world = createPhysicsWorld3D({ tickRate: fixture.tickRate, initialGravity: fixture.gravity,
    capacity: { bodies: 4, joints: 1, fluids: 1, fluidInteractions: 1 } });
  try {
    const { chassis } = world.edit((edit) => ({
      floor: edit.createBody(fixture.floor),
      leg: edit.createBody(fixture.leg),
      chassis: edit.createBody({ ...fixture.chassis,
        shape: shape === 'voxel' ? fixture.chassis.shape : { type: 'box', halfX: 1.04, halfY: 0.72, halfZ: 1.52 } }),
    })).created;
    const definition = fixture.vehicleDefinition;
    let vehicle = createDeterministicVehicleState3D(definition, chassis.id);
    let before;
    const history = [];
    const { idleTicks, driveTicks, reverseTicks } = fixture.sequence;
    for (let tick = 0; tick < idleTicks + driveTicks + reverseTicks; tick++) {
      const reverse = tick >= idleTicks + driveTicks;
      if (tick === idleTicks + driveTicks) before = world.readMotion(chassis).position;
      const result = stepDeterministicVehicleState3D(definition, vehicle,
        { throttle: tick < idleTicks ? 0 : reverse ? 10 : -10, steer: 0, brake: tick < idleTicks ? 5 : 0 },
        world, { apply: true, checksumMode: 'disabled' });
      vehicle = result.state;
      world.step();
      const motion = world.readMotion(chassis);
      history.push({ tick, reverse, motion, vehicle, wheels: result.wheels, records: result.records,
        contacts: world.latest().contacts.filter((contact) => contact.bodyKeyA === 'leg' || contact.bodyKeyB === 'leg') });
    }
    const after = history.at(-1).motion.position;
    const reversing = history.filter((row) => row.reverse);
    const invalid = history.flatMap((row) => row.contacts.map((contact) => ({ tick: row.tick, point: contact.point, local: localPoint(contact.point, row.motion) })))
      .filter((contact) => contact.local.some((value, axis) => Math.abs(value) > [1.04, 0.72, 1.52][axis] + 0.02));
    const summary = { shape, reverseDistance: after.z - before.z, before, after,
      reverseTicksWithGroundContact: reversing.filter((row) => row.wheels.some((wheel) => wheel.grounded)).length,
      reverseTicksWithForce: reversing.filter((row) => row.records.forces.length > 0).length,
      invalidContactCount: invalid.length, invalidContact: invalid.at(-1) };
    results.push(summary);
    await writeFile(new URL(`sdk-${shape}-trace.json`, output), JSON.stringify(history, (_, value) => typeof value === 'bigint' ? String(value) : value));
  } finally { world.dispose(); }
}
const passed = results.every((row) => row.reverseDistance > 1 && row.invalidContactCount === 0);
const report = { passed, carPresent: false, expected: 'Both chassis shapes can reverse more than 1 m. Contact points stay inside the chassis bounds.', results };
await writeFile(new URL('sdk-repro.json', output), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
// Exit 1 until the SDK passes the release gate.
if (!passed) process.exitCode = 1;
