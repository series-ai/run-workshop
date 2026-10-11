import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { initPhysics3D, createPhysicsWorld3D, createDeterministicVehicleState3D, stepDeterministicVehicleState3D } from '@series-inc/rundot-syncplay/physics/3d';
import { installDeterministicMath } from '@series-inc/rundot-syncplay/core/deterministic-math';
installDeterministicMath();
await initPhysics3D();
const fixture = JSON.parse(await readFile(new URL('./fixtures/syncplay-buggy-barrel.json', import.meta.url), 'utf8'));
const output = new URL('../test-results/buggy-barrel/', import.meta.url);
await mkdir(output, { recursive: true });
const results = [];
for (const config of [
  { rest: .5, driveScale: 1, dampingScale: 1 },
  { rest: .9, driveScale: 1, dampingScale: 1 },
  { rest: .9, driveScale: .5, dampingScale: 1 },
  { rest: .9, driveScale: .6, dampingScale: 1 },
  { rest: .9, driveScale: .75, dampingScale: 2 },
  { rest: .9, driveScale: .5, dampingScale: 2 },
]) {
  const { rest, driveScale, dampingScale } = config;
  const world = createPhysicsWorld3D({ tickRate: fixture.tickRate, initialGravity: fixture.gravity,
    capacity: { bodies: 4, joints: 1, fluids: 1, fluidInteractions: 1, checkpoints: 2 } });
  let saved;
  try {
    const { chassis } = world.edit(edit => ({
      floor: edit.createBody(fixture.floor),
      ramp: edit.createBody({ ...fixture.ramp, key: 'ramp', position: { ...fixture.ramp.position, x: 0 } }),
      chassis: edit.createBody({ ...fixture.chassis, key: 'chassis', position: { x: 0, y: 2, z: -12 }, orientation: { x: 0, y: 1, z: 0, w: 0 } }),
    })).created;
    const definition = { ...fixture.vehicleDefinition, driveForce: fixture.vehicleDefinition.driveForce * driveScale, wheels: fixture.vehicleDefinition.wheels.map(w => ({ ...w, suspensionRestLength: rest, damping: w.damping * dampingScale })) };
    let state = createDeterministicVehicleState3D(definition, chassis.id);
    const advance = throttle => {
      const result = stepDeterministicVehicleState3D(definition, state, { throttle, steer: 0, brake: throttle === 0 ? 5 : 0 }, world, { apply: true, checksumMode: 'disabled' });
      state = result.state; world.step();
      return { motion: world.readMotion(world.resolveBody(chassis.id)), wheels: result.wheels, records: result.records };
    };
    for (let t = 0; t < 90; t++) advance(0);
    const settled = world.readMotion(world.resolveBody(chassis.id));
    const savedState = structuredClone(state); saved = world.captureCheckpoint();
    let expected;
    for (let repeat = 0; repeat < 2; repeat++) {
      world.restoreCheckpoint(saved); state = structuredClone(savedState);
      const rows = []; let airborne = false, landed = false, airborneForceTicks = 0;
      for (let t = 0; t < 150; t++) {
        const row = advance(-10); rows.push(row);
        const supported = row.wheels.some(w => w.grounded);
        if (row.motion.position.z > 2 && row.motion.position.y > .7 && !supported) airborne = true;
        if (airborne && supported) landed = true;
        if (!supported && (row.records.forces.length > 0 || row.records.springRows.length > 0)) airborneForceTicks++;
      }
      const driven = world.readMotion(world.resolveBody(chassis.id));
      for (let t = 0; t < 90; t++) rows.push(advance(0));
      const stopped = world.readMotion(world.resolveBody(chassis.id));
      const signature = `${world.digest()}:${JSON.stringify(state, (_, v) => typeof v === 'bigint' ? String(v) : v)}`;
      if (repeat === 0) {
        expected = signature;
        results.push({ ...config, settled, driven, stopped, airborne, landed, airborneForceTicks,
          horizontalDistance: Math.hypot(driven.position.x - settled.position.x, driven.position.z - settled.position.z),
          stopSpeed: Math.hypot(stopped.linearVelocity.x, stopped.linearVelocity.z),
          minGroundedWheels: Math.min(...rows.map(r => r.wheels.filter(w => w.grounded).length)),
          maxY: Math.max(...rows.map(r => r.motion.position.y)) });
        await writeFile(new URL(`ramp-${rest}-${driveScale}-${dampingScale}.json`, output), JSON.stringify(rows, (_, v) => typeof v === 'bigint' ? String(v) : v));
      } else results.at(-1).rollbackMatches = expected === signature;
    }
  } finally { if (saved !== undefined) world.releaseCheckpoint(saved); world.dispose(); }
}
await writeFile(new URL('ramp-report.json', output), JSON.stringify(results, (_, v) => typeof v === 'bigint' ? String(v) : v, 2));
console.log(JSON.stringify(results.map(({rest, driveScale, dampingScale, airborne, landed, airborneForceTicks, horizontalDistance, stopSpeed, maxY, rollbackMatches, settled}) => ({rest, driveScale, dampingScale, floorRideY: settled.position.y, airborne, landed, airborneForceTicks, horizontalDistance, stopSpeed, maxY, rollbackMatches})), null, 2));
