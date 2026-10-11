import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createPhysicsWorld3D, initPhysics3D, createDeterministicVehicleState3D, stepDeterministicVehicleState3D } from '@series-inc/rundot-syncplay/physics/3d';
import { installDeterministicMath } from '@series-inc/rundot-syncplay/core/deterministic-math';
installDeterministicMath();
await initPhysics3D();
const fixture = JSON.parse(await readFile(new URL('./fixtures/syncplay-buggy-barrel.json', import.meta.url), 'utf8'));
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split('=')[1];
const variant = option('variant') ?? 'baseline';
const output = new URL(`../test-results/buggy-barrel/${variant === 'baseline' ? '' : `${variant}/`}`, import.meta.url);
await mkdir(output, { recursive: true });
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v);
function localPoint(point, motion) {
  const q = motion.orientation;
  const x = point.x - motion.position.x, y = point.y - motion.position.y, z = point.z - motion.position.z;
  const tx = 2 * (-q.y * z + q.z * y), ty = 2 * (-q.z * x + q.x * z), tz = 2 * (-q.x * y + q.y * x);
  return [x + q.w * tx - q.y * tz + q.z * ty, y + q.w * ty - q.z * tx + q.x * tz, z + q.w * tz - q.x * ty + q.y * tx];
}
const matrices = process.argv.includes('--controls') ? [
  { chassisShape: 'voxel', barrelShape: 'box' }, { chassisShape: 'box', barrelShape: 'box' },
] : [{ chassisShape: 'voxel', barrelShape: 'voxel' }, { chassisShape: 'box', barrelShape: 'voxel' }];
function clipUnderside(shape, minimumY) {
  const children = shape.type === 'box' ? [{ shape, offset: { x: 0, y: 0, z: 0 } }] : shape.children;
  return { type: 'compound', children: children.flatMap(child => {
    const top = child.offset.y + child.shape.halfY;
    if (top <= minimumY) return [];
    const bottom = Math.max(minimumY, child.offset.y - child.shape.halfY);
    return [{ ...child, offset: { ...child.offset, y: (top + bottom) / 2 }, shape: { ...child.shape, halfY: (top - bottom) / 2 } }];
  }) };
}
const summaries = [];
for (const shapes of matrices) for (const axis of ['x', 'z']) for (const x of process.argv.includes('--center') ? [0] : [0, 0.55, 1]) for (const z of process.argv.includes('--center') ? [0] : [-1.1, 0, 1.1]) {
  const name = `${shapes.chassisShape}-${shapes.barrelShape}-${axis}-${x}-${z}`;
  const world = createPhysicsWorld3D({ tickRate: fixture.tickRate, initialGravity: fixture.gravity,
    capacity: { bodies: 4, joints: 1, fluids: 1, fluidInteractions: 1, checkpoints: 4 } });
  let saved;
  try {
    const orientation = { x: axis === 'x' ? Math.SQRT1_2 : 0, y: 0, z: axis === 'z' ? Math.SQRT1_2 : 0, w: Math.SQRT1_2 };
    const originalChassisShape = shapes.chassisShape === 'voxel' ? fixture.chassis.shape : { type: 'box', halfX: 1.04, halfY: .72, halfZ: 1.52 };
    const chassisShape = option('underside') === undefined ? originalChassisShape : clipUnderside(originalChassisShape, Number(option('underside')));
    const { chassis, barrel } = world.edit(edit => ({
      floor: edit.createBody(fixture.floor),
      barrel: edit.createBody({ ...fixture.barrel, key: 'barrel', position: { x: process.argv.includes('--floor-only') ? 50 : x, y: -0.46, z }, orientation,
        shape: shapes.barrelShape === 'voxel' ? fixture.barrel.shape : { type: 'box', halfX: .4, halfY: .56, halfZ: .4 } }),
      chassis: edit.createBody({ ...fixture.chassis, key: 'chassis', position: { x: 0, y: 2, z: 0 },
        shape: chassisShape }),
    })).created;
    const definition = { ...fixture.vehicleDefinition, driveForce: fixture.vehicleDefinition.driveForce * Number(option('drive-scale') ?? 1), wheels: fixture.vehicleDefinition.wheels.map(wheel => ({ ...wheel,
      radius: option('radius') === undefined ? wheel.radius : Number(option('radius')),
      stiffness: wheel.stiffness * Number(option('stiffness-scale') ?? 1),
      damping: wheel.damping * Number(option('damping-scale') ?? 1),
      suspensionRestLength: option('rest') === undefined ? wheel.suspensionRestLength : Number(option('rest')),
      suspensionMaximumTravel: option('travel') === undefined ? wheel.suspensionMaximumTravel : Number(option('travel')),
      localAnchor: { ...wheel.localAnchor, y: option('anchor-y') === undefined ? wheel.localAnchor.y : Number(option('anchor-y')) },
    })) };
    let state = createDeterministicVehicleState3D(definition, chassis.id);
    const tick = (throttle, index) => {
      const before = world.readMotion(world.resolveBody(chassis.id));
      const barrelBefore = world.readMotion(world.resolveBody(barrel.id));
      const result = stepDeterministicVehicleState3D(definition, state, { throttle, steer: 0, brake: throttle === 0 ? 5 : 0 }, world, { apply: true, checksumMode: 'disabled' });
      state = result.state;
      world.step();
      const motion = world.readMotion(world.resolveBody(chassis.id));
      const barrelMotion = world.readMotion(world.resolveBody(barrel.id));
      const contacts = world.latest().contacts.filter(c => c.bodyKeyA === 'chassis' || c.bodyKeyB === 'chassis');
      const badContacts = contacts.filter(c => c.type !== 'exit').flatMap(c => {
        const localBefore = localPoint(c.point, before), localAfter = localPoint(c.point, motion);
        const excess = local => Math.max(...local.map((v, i) => Math.abs(v) - [1.04, .72, 1.52][i]));
        return excess(localBefore) > .1 && excess(localAfter) > .1 ? [{ ...c, localBefore, localAfter }] : [];
      });
      return { tick: index, throttle, before, motion, barrelBefore, barrelMotion, wheels: result.wheels, records: result.records, contacts, badContacts };
    };
    const settling = [];
    for (let t = 0; t < 90; t++) settling.push(tick(0, t));
    const settled = world.readMotion(world.resolveBody(chassis.id));
    const settledBarrel = world.readMotion(world.resolveBody(barrel.id));
    const savedState = structuredClone(state);
    saved = world.captureCheckpoint();
    const trials = [];
    let firstDigest;
    for (const throttle of [-10, 10, -10]) {
      world.restoreCheckpoint(saved); state = structuredClone(savedState);
      const rows = [];
      for (let t = 0; t < 120; t++) rows.push(tick(throttle, t));
      const after = world.readMotion(world.resolveBody(chassis.id));
      const distance = Math.hypot(after.position.x - settled.position.x, after.position.z - settled.position.z);
      const groundedTicks = rows.filter(r => r.wheels.some(w => w.grounded)).length;
      const forceTicks = rows.filter(r => r.records.forces.length > 0).length;
      const badContactCount = rows.reduce((n, r) => n + r.badContacts.length, 0);
      const digest = `${world.digest()}:${json(state)}`;
      if (firstDigest === undefined) firstDigest = digest;
      const trial = { throttle, distance, after, groundedTicks, forceTicks, badContactCount,
        airborneForceTicks: rows.filter(r => r.wheels.every(w => !w.grounded) && (r.records.forces.length > 0 || r.records.springRows.length > 0)).length,
        peakBarrelSpeed: Math.max(...rows.map(r => Math.hypot(...Object.values(r.barrelMotion.linearVelocity)))),
        peakBarrelAngularSpeed: Math.max(...rows.map(r => Math.hypot(...Object.values(r.barrelMotion.angularVelocity)))),
        barrelDistance: Math.hypot(...['x', 'y', 'z'].map(axis => rows.at(-1).barrelMotion.position[axis] - settledBarrel.position[axis])),
        minGroundedWheels: Math.min(...rows.map(r => r.wheels.filter(w => w.grounded).length)),
        maxGroundedWheels: Math.max(...rows.map(r => r.wheels.filter(w => w.grounded).length)),
        witness: rows.find(r => r.badContacts.length > 0),
        ...(trials.length === 2 ? { rollbackMatches: firstDigest === digest } : {}) };
      if (trials.length < 2) {
        if (distance < 2 || badContactCount > 0 || (x === 0 && z === 0)) await writeFile(new URL(`${name}-${throttle}.json`, output), json({ fixture: { ...shapes, axis, x, z }, settled, settledBarrel, settling, rows }));
        delete trial.witness;
      }
      trials.push(trial);
    }
    summaries.push({ name, ...shapes, axis, x, z, settled, settledBarrel,
      settledGroundedWheels: settling.at(-1).wheels.filter(w => w.grounded).length,
      settledForces: settling.at(-1).records.forces,
      trials: trials.slice(0, 2), rollbackMatches: trials[2].rollbackMatches });
  } finally { if (saved !== undefined) world.releaseCheckpoint(saved); world.dispose(); }
}
const report = { sdkVersion: JSON.parse(await readFile(new URL('../node_modules/@series-inc/rundot-syncplay/package.json', import.meta.url), 'utf8')).version,
  fixtureSource: fixture.source, variant, settings: { rest: option('rest'), travel: option('travel'), anchorY: option('anchor-y'), underside: option('underside'), stiffnessScale: option('stiffness-scale'), radius: option('radius'), driveScale: option('drive-scale'), dampingScale: option('damping-scale') }, caseCount: summaries.length,
  rollbackPassCount: summaries.filter(r => r.rollbackMatches).length,
  stuckWithGroundedWheels: summaries.filter(r => r.trials.every(t => t.distance < .2) && r.trials.some(t => t.groundedTicks > 60)).map(r => r.name),
  stuckAirborne: summaries.filter(r => r.trials.every(t => t.distance < .2) && r.trials.every(t => t.groundedTicks === 0)).map(r => r.name),
  summaries };
await writeFile(new URL(process.argv.includes('--controls') ? 'controls.json' : 'report.json', output), JSON.stringify(report, (_, v) => typeof v === 'bigint' ? String(v) : v, 2));
console.log(JSON.stringify({ ...report, summaries: undefined }, null, 2));

if (process.argv.includes('--assert-recovery') && summaries.some(r => !r.rollbackMatches || r.trials.some(t => t.distance < 1 || t.airborneForceTicks !== 0))) process.exitCode = 1;
