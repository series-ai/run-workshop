import { createDeterministicBotBlackboard, tickDeterministicHfsm } from '@series-inc/rundot-syncplay/browser';
import { meters, metersPerSecond, newtonMeters, newtons, ORIENTATION_HOLD_DEFAULT_GAINS, orientationHoldTorque3D, perSecond, vec3 } from '@series-inc/rundot-syncplay/physics/3d';
import { DT } from './constants';
import { fragmentVoxelBody } from './fracture';
import { grabServo } from './grab';
import { add, clamp, length, rotate, sub, type Vec3 } from './math';
import { addPhysicsBodies, makePhysicsBody, physicsBodyById, physicsBodyHandle, poseOf, removePhysicsBodies, type OpenYardPhysicsWorld } from './physics';
import { buggySpawn } from './presets';
import { ROAD, ROAD_WORKER_FSM, roadBarrelSpawn, roadCarCarryPoint, roadMagnetPosition, roadResetActive } from './roadCourse';
import type { ContraptionState, PlayerState, YardBody, YardStats } from './state';

export interface RoadContext {
  readonly physics: OpenYardPhysicsWorld;
  readonly frame: number;
  bodies: YardBody[];
  players: PlayerState[];
  contraptions: ContraptionState;
  stats: YardStats;
  nextSerial: number;
}

const heldByPlayer = (w: RoadContext, id: string): boolean => w.players.some((player) => player.active && player.grab?.bodyId === id);
export const isRoadBarrel = (id: string): boolean => id.startsWith('road-barrel-');

function addSpawn(w: RoadContext, spawn: ReturnType<typeof buggySpawn>): void {
  w.bodies = [...w.bodies, spawn.body];
  addPhysicsBodies(w.physics, [makePhysicsBody(spawn.body, { position: spawn.position, rotation: spawn.rotation, linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })]);
}

/** Remove the previous car and its cut or blast pieces before a delivery. */
export function resetRoadCar(w: RoadContext): void {
  if (roadResetActive(w.frame, w.contraptions.roadCourse.resetFrame)) return;
  const owned = new Set(w.bodies.filter((body) => body.label === 'Sandbox Buggy').map((body) => body.id));
  const chassis = physicsBodyById(w.physics, 'vehicle-chassis');
  w.players = w.players.map((player) => ({
    ...player,
    ...(player.ridingVehicle && chassis ? { x: chassis.x + 2, y: chassis.y + 0.3, z: chassis.z, vx: 0, vy: 0, vz: 0, ridingVehicle: false } : {}),
    grab: player.grab && owned.has(player.grab.bodyId) ? null : player.grab,
    torch: player.torch && owned.has(player.torch.bodyId) ? null : player.torch,
  }));
  removePhysicsBodies(w.physics, [...owned]);
  w.bodies = w.bodies.filter((body) => !owned.has(body.id));
  const fresh = buggySpawn();
  addSpawn(w, { ...fresh, position: roadCarCarryPoint(ROAD.magnetPark) });
  w.contraptions = { ...w.contraptions, roadCourse: { ...w.contraptions.roadCourse, resetFrame: w.frame } };
}

/** Separate the car into ordinary voxel debris. No fragment remains a drivable chassis. */
export function wreckRoadCar(w: RoadContext, at: Vec3): void {
  const body = w.bodies.find((entry) => entry.id === 'vehicle-chassis');
  const view = physicsBodyById(w.physics, 'vehicle-chassis');
  if (!body || !view) return;
  const voxels = body.voxels.slice();
  const midX = Math.floor(body.dims.x / 2);
  const midZ = Math.floor(body.dims.z / 2);
  for (let z = 0; z < body.dims.z; z++) for (let y = 0; y < body.dims.y; y++) for (let x = 0; x < body.dims.x; x++) {
    if (Math.abs(x - midX) <= 1 || Math.abs(z - midZ) <= 1) voxels[x + y * body.dims.x + z * body.dims.x * body.dims.y] = 0;
  }
  const center: Vec3 = [midX, Math.floor(body.dims.y / 2), midZ];
  const source = { ...body, id: `buggy-wreck-${w.nextSerial++}` };
  const result = fragmentVoxelBody(source, poseOf(view), voxels, { start: center, end: center, worldPoint: at, impulseBoost: 4 }, w.nextSerial, w.frame);
  w.nextSerial = result.nextSerial;
  removePhysicsBodies(w.physics, [body.id]);
  addPhysicsBodies(w.physics, result.fragments.map((fragment) => fragment.physics));
  w.bodies = [...w.bodies.filter((entry) => entry.id !== body.id), ...result.fragments.map((fragment) => fragment.body)];
  w.players = w.players.map((player) => ({
    ...player, ridingVehicle: false,
    grab: player.grab?.bodyId === body.id ? null : player.grab,
    torch: player.torch?.bodyId === body.id ? null : player.torch,
    ...(player.ridingVehicle ? { x: view.x + 1.8, y: view.y + 0.8, z: view.z, vx: view.vx / DT, vy: view.vy / DT + 3, vz: view.vz / DT, grounded: false } : {}),
  }));
  w.stats = { ...w.stats, fractures: w.stats.fractures + 1 };
}

function driveWorker(w: RoadContext, target: Vec3, facingYaw?: number): void {
  const handle = physicsBodyHandle(w.physics, ROAD.workerId);
  const motion = w.physics.world.readMotion(handle);
  const dx = target[0] - motion.position.x;
  const dz = target[2] - motion.position.z;
  const distance = Math.hypot(dx, dz);
  const yaw = facingYaw ?? (distance > 0.15 ? Math.atan2(dx, dz) : Math.PI / 2);
  const q = motion.orientation;
  const currentYaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
  const yawError = Math.atan2(Math.sin(yaw - currentYaw), Math.cos(yaw - currentYaw));
  const aligned = Math.abs(yawError) < 0.14;
  const speed = aligned ? Math.min(ROAD.workerSpeed, distance * 5) : 0;
  const force = [dx, dz].map((value, axis) => {
    const desired = distance > 0.12 ? value / distance * speed : 0;
    const current = axis === 0 ? motion.linearVelocity.x : motion.linearVelocity.z;
    return Math.max(-14, Math.min(14, (desired - current) / 0.07)) * motion.mass;
  });
  const targetYaw = currentYaw + clamp(yawError, -0.35, 0.35);
  // Scale torque gains to the remaining native body after a cut or blast.
  const inertia = Math.min(motion.inertia.xx, motion.inertia.yy, motion.inertia.zz);
  const hold = orientationHoldTorque3D(motion.orientation, motion.angularVelocity,
    { x: 0, y: Math.sin(targetYaw / 2), z: 0, w: Math.cos(targetYaw / 2) },
    { stiffness: inertia * 1024, damping: perSecond(inertia * 48), maxTorque: newtonMeters(inertia * 320) });
  if (distance < 0.12 && Math.hypot(motion.linearVelocity.x, motion.linearVelocity.z) < 0.05 && hold.angle < 0.05 && Math.abs(yawError) < 0.05) return;
  w.physics.world.applyForce(handle, vec3(newtons, force[0]!, 0, force[1]!), hold.torque);
}

function stepWorker(w: RoadContext): void {
  const worker = physicsBodyById(w.physics, ROAD.workerId);
  if (!worker) return;
  let road = w.contraptions.roadCourse;
  const slots = road.slots.map((id, index) => {
    const body = id === null ? undefined : physicsBodyById(w.physics, id);
    const point = ROAD.slots[index]!;
    return body && Math.hypot(body.x - point[0], body.z - point[1]) < 2 ? id : null;
  });
  let job = road.worker.job;
  const mode = road.worker.agent.state;
  const workerHeld = heldByPlayer(w, ROAD.workerId);
  const missing = slots.indexOf(null);
  const work = mode === 'waiting' && missing >= 0 && !workerHeld
    && w.contraptions.drums.filter((drum) => isRoadBarrel(drum.bodyId)).length < ROAD.barrelLimit;
  if (work) {
    const id = `road-barrel-supply-${w.nextSerial++}`;
    const spawn = roadBarrelSpawn(id, ROAD.supply);
    addSpawn(w, { ...spawn, body: { ...spawn.body, impactCooldownUntil: w.frame + 90 } });
    w.contraptions = { ...w.contraptions, drums: [...w.contraptions.drums, { bodyId: id, damage: 0, detonateAt: null }] };
    job = { slot: missing, bodyId: id, leg: 'lane' };
  }
  const barrel = job ? physicsBodyById(w.physics, job.bodyId) : undefined;
  const escapedSupply = mode === 'collect' && barrel !== undefined
    && (Math.hypot(Math.max(ROAD.workerHome[0] - barrel.x, 0, barrel.x - ROAD.supply[0]), barrel.z - ROAD.supply[2]) > 1.4);
  const lit = job && w.contraptions.drums.some((drum) => drum.bodyId === job!.bodyId && drum.detonateAt !== null);
  const lost = job !== null && (!barrel || workerHeld || heldByPlayer(w, job.bodyId) || Boolean(lit) || escapedSupply
    || (mode === 'deliver' && Math.hypot(barrel.x - worker.x, barrel.y - worker.y, barrel.z - worker.z) > 3));
  const caught = !lost && mode === 'collect' && barrel !== undefined
    && Math.hypot(barrel.x - worker.x, barrel.y - worker.y, barrel.z - worker.z) < 1.25;
  const slot = job ? ROAD.slots[job.slot]! : null;
  const placed = !lost && mode === 'deliver' && slot !== null && barrel !== undefined
    && Math.hypot(barrel.x - slot[0], barrel.z - slot[1]) < 0.28
    && Math.hypot(worker.x - slot[0] - 0.95, worker.z - slot[1]) < 0.3;
  if (placed && job) slots[job.slot] = job.bodyId;
  const home = Math.hypot(worker.x - ROAD.workerHome[0], worker.z - ROAD.workerHome[2]) < 0.2;
  const agent = tickDeterministicHfsm(ROAD_WORKER_FSM, road.worker.agent,
    createDeterministicBotBlackboard(Object.entries({ work, lost, caught, placed, home }).map(([key, value]) => ({ key, value }))));
  if (agent.state === 'return' || agent.state === 'waiting') job = null;
  road = { ...road, slots, worker: { agent, job } };
  w.contraptions = { ...w.contraptions, roadCourse: road };
  if (workerHeld) return;
  let target = ROAD.workerHome;
  let facingYaw: number | undefined;
  if (agent.state === 'collect' && barrel) {
    target = [Math.min(ROAD.workerHome[0], barrel.x - 0.9), worker.y, barrel.z];
    facingYaw = Math.PI / 2;
  } else if (agent.state === 'deliver' && job) {
    const [x, z] = ROAD.slots[job.slot]!;
    if (job.leg === 'lane' && Math.hypot(worker.x - ROAD.laneX, worker.z - z) < 0.3) {
      job = { ...job, leg: 'slot' };
      w.contraptions = { ...w.contraptions, roadCourse: { ...road, worker: { agent, job } } };
    }
    target = job.leg === 'lane'
      ? [ROAD.laneX, worker.y, Math.abs(worker.x - ROAD.laneX) > 0.18 ? worker.z : z]
      : [x + 0.95, worker.y, z];
    facingYaw = job.leg === 'slot' ? -Math.PI / 2 : undefined;
    const carry = add([worker.x, worker.y, worker.z], rotate([0, 0.2, 1], [worker.orientation.x, worker.orientation.y, worker.orientation.z, worker.orientation.w]));
    grabServo(w.physics.world, physicsBodyHandle(w.physics, job.bodyId), { point: carry, velocity: [worker.vx, worker.vy, worker.vz] });
  } else if (agent.state === 'return' && worker.x < ROAD.laneX - 0.3) {
    target = [ROAD.laneX, worker.y, worker.z];
    facingYaw = -Math.PI / 2;
  }
  driveWorker(w, target, facingYaw);
}

/** Update physical equipment before the native step. */
export function stepRoadCourse(w: RoadContext): void {
  stepWorker(w);
  const resetFrame = w.contraptions.roadCourse.resetFrame;
  const magnet = roadMagnetPosition(w.frame, resetFrame);
  const previous = physicsBodyById(w.physics, ROAD.magnetId)!;
  const velocity = sub(magnet, [previous.x, previous.y, previous.z]);
  w.physics.world.setLinearVelocity(physicsBodyHandle(w.physics, ROAD.magnetId), vec3(metersPerSecond, velocity, 1 / DT));
  const age = w.frame - resetFrame;
  if (age >= 0 && age < ROAD.releaseTick && w.physics.bodyIds.has('vehicle-chassis') && !heldByPlayer(w, 'vehicle-chassis')) {
    const point = roadCarCarryPoint(magnet);
    grabServo(w.physics.world, physicsBodyHandle(w.physics, 'vehicle-chassis'), { point, velocity });
    const car = w.physics.world.readMotion(physicsBodyHandle(w.physics, 'vehicle-chassis'));
    const hold = orientationHoldTorque3D(car.orientation, car.angularVelocity, { x: 0, y: 1, z: 0, w: 0 }, ORIENTATION_HOLD_DEFAULT_GAINS);
    w.physics.world.applyForce(physicsBodyHandle(w.physics, 'vehicle-chassis'), vec3(newtons, 0, 0, 0), hold.torque);
  }
  const hits = w.physics.world.overlap({ x: meters(magnet[0]), y: meters(magnet[1] - 1), z: meters(magnet[2]),
    shape: { type: 'sphere', radius: meters(ROAD.magnetRadius) }, maxPortalDepth: 0, hitSensors: false, hitTriggers: false });
  const ids = new Set(hits.map((hit) => hit.bodyKey));
  const targets = w.bodies.filter((body) => ids.has(body.id) && body.motion === 'dynamic' && body.material === 'steel'
    && body.id !== ROAD.workerId && body.id !== 'vehicle-chassis' && !heldByPlayer(w, body.id))
    .map((body) => ({ body, view: physicsBodyById(w.physics, body.id)! }))
    .sort((a, b) => length(sub([a.view.x, a.view.y, a.view.z], magnet)) - length(sub([b.view.x, b.view.y, b.view.z], magnet)) || (a.body.id < b.body.id ? -1 : 1))
    .slice(0, ROAD.magnetTargets);
  for (const [index, { body }] of targets.entries()) {
    const point: Vec3 = [magnet[0] + (index % 2 ? 0.65 : -0.65), magnet[1] - ROAD.magnetSize[1] / 2 - body.dims.y * 0.04 - 0.03, magnet[2] + (index < 2 ? -0.55 : 0.55)];
    grabServo(w.physics.world, physicsBodyHandle(w.physics, body.id), { point, velocity });
  }
}
