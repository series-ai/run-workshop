import { STORAGE_ELEVATOR_CAR_FIXTURE } from './storageFixtures';
import { ELEVATOR } from './attractions';
import { createReturnsPair } from './returns';
import {
  cookVoxelBody,
  createPhysicsWorld3D,
  createVoxelChunk,
  initPhysics3D,
  kilograms,
  kilogramMetersSquared,
  kilogramsPerCubicMeter,
  meters,
  metersPerSecond,
  metersPerSecondSquared,
  newtons,
  newtonMeters,
  perSecond,
  radiansPerSecond,
  setVoxelCell,
  vec3,
  type PhysicsBody3D,
  type PhysicsBodyHandle3D,
  type PhysicsBodyId3D,
  type PhysicsNamedBodyInput3D,
  type PhysicsFluidHandle3D,
  type PhysicsFluidInput3D,
  type PhysicsFluidInteraction3D,
  type PhysicsBodyMotion3D,
  type PhysicsWorld3D,
  type PhysicsLatestOutputs3D,
  type VoxelCompoundShape,
} from '@series-inc/rundot-syncplay/physics/3d';
import type { VoxelDims } from 'voxel-kit';
import {
  ANGULAR_DAMPING,
  GRAVITY,
  LINEAR_DAMPING,
  PHYSICS_SUBSTEPS,
  SHELL_PREFIX,
  TANK,
  TICK_RATE,
  VOXEL_SIZE,
} from './constants';
import { CAGE_CATEGORY, CAGE_PANELS, WORLD_CATEGORY, WORLD_LAYER } from './cage';
import { LIFT_DECK_MATERIAL, PHYSICS_MATERIALS, STACK_CRATE_MATERIAL, type PhysicsMaterialName } from './materials';
import { SHELL_BOXES, shellBoxQuaternion } from './shell';
import type { ShellBox } from './setPieces';
import { clamp, lerp, type Quat, type Vec3 } from './math';
import type { YardBody } from './state';
import { WATER_BOUNDS } from './water';
import { perfActive, perfCount } from '../perf/recorder';

void setVoxelCell;
await initPhysics3D();

export interface BodyPose {
  readonly position: Vec3;
  readonly rotation: Quat;
  /** Meters per tick. */
  readonly linearVelocity: Vec3;
  /** Radians per tick. */
  readonly angularVelocity: Vec3;
}

export interface VoxelStats {
  readonly occupiedCount: number;
}

/**
 * A body for the yard world. It always names a world material (sim/materials.ts),
 * so each contact reports the material of both sides. The type rejects inline
 * friction and restitution.
 */
export interface YardPhysicsBodyInput3D {
  readonly id: string;
  readonly body: PhysicsNamedBodyInput3D & { readonly material: PhysicsMaterialName };
}

export interface YardPhysicsBody3D {
  readonly teleportCounter?: number;
  readonly id: string;
  readonly kind: PhysicsBody3D['kind'];
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly orientation: Readonly<{ x: number; y: number; z: number; w: number }>;
  readonly angularVel: Readonly<{ x: number; y: number; z: number }>;
}

export interface YardFluidInteraction {
  readonly bodyId: string;
  readonly submergedVolume: number;
  readonly totalForce: Readonly<{ x: number; y: number; z: number }>;
  readonly totalTorque: Readonly<{ x: number; y: number; z: number }>;
}

/**
 * The sim's view of the physics world after a tick: body motion, and the
 * name of each body id. The world itself is live (see sim.ts); a save holds
 * it as a native checkpoint, and the codec adds the checkpoint bytes.
 */
export interface YardPhysicsWorldState {
  readonly portalStraddlers?: readonly { readonly bodyId: string; readonly pairId: number; readonly end: 'A' | 'B' }[];
  readonly frame: number;
  readonly bodies: readonly YardPhysicsBody3D[];
  readonly bodyIds: readonly (readonly [string, string])[];
  readonly fluidInteractions?: readonly YardFluidInteraction[];
}

export interface OpenYardPhysicsWorld {
  readonly world: PhysicsWorld3D;
  readonly bodyIds: Map<string, PhysicsBodyId3D>;
}

interface BodyTopology {
  readonly names: readonly string[];
  readonly ids: YardPhysicsWorldState['bodyIds'];
  readonly nativeNames: ReadonlyMap<PhysicsBodyId3D, string>;
}
const bodyTopologies = new WeakMap<OpenYardPhysicsWorld, BodyTopology>();

function bodyTopology(open: OpenYardPhysicsWorld): BodyTopology {
  const cached = bodyTopologies.get(open);
  if (cached) return cached;
  const names = [...open.bodyIds.keys()].sort();
  const topology = {
    names,
    ids: names.map((name) => [name, open.bodyIds.get(name)!.toString()] as const),
    nativeNames: new Map([...open.bodyIds].map(([name, id]) => [id, name])),
  };
  bodyTopologies.set(open, topology);
  return topology;
}

/**
 * Logical checkpoint capacity for the runner. Keep its 256 saves and a
 * catch-up batch of up to 240 ticks, plus two import scratch slots.
 * YardSim keeps 32 recent saves in native storage. Older saves use bytes.
 */
export const CHECKPOINT_BUDGET = {
  maxLiveCheckpoints: 256 + 240 + 2,
  maxAdvanceBatch: 240,
  importScratch: 2,
} as const;

export const PHYSICS_CAPACITY = {
  bodies: 2048,
  joints: 256,
  fluids: 8,
  fluidInteractions: 4096,
  checkpoints: CHECKPOINT_BUDGET.maxLiveCheckpoints,
} as const;

export const WATER_FLUID_CONFIG: PhysicsFluidInput3D = {
  bounds: {
    minX: meters(WATER_BOUNDS.min[0]),
    minY: meters(WATER_BOUNDS.min[1]),
    minZ: meters(WATER_BOUNDS.min[2]),
    maxX: meters(WATER_BOUNDS.max[0]),
    maxY: meters(WATER_BOUNDS.max[1]),
    maxZ: meters(WATER_BOUNDS.max[2]),
  },
  surfacePlane: {
    normal: { x: 0, y: 1, z: 0 },
    offset: meters(TANK.surfaceY),
  },
  density: kilogramsPerCubicMeter(1),
  linearDragPerSecond: perSecond(2),
  angularDragPerSecond: perSecond(1),
  flowVelocity: vec3(metersPerSecond, 0, 0, 0),
  layer: WORLD_LAYER,
  mask: 0xffffffff,
};

const STATS_CACHE = new WeakMap<Uint8Array, VoxelStats>();

export function voxelStats(voxels: Uint8Array, _dims?: VoxelDims): VoxelStats {
  const cached = STATS_CACHE.get(voxels);
  if (cached) return cached;
  let occupiedCount = 0;
  for (let i = 0; i < voxels.length; i += 1) if (voxels[i] !== 0) occupiedCount += 1;
  const stats: VoxelStats = { occupiedCount };
  STATS_CACHE.set(voxels, stats);
  return stats;
}

export function toChunk(voxels: Uint8Array, dims: VoxelDims) {
  const chunk = createVoxelChunk(dims.x, dims.y, dims.z, meters(VOXEL_SIZE));
  chunk.occupancy.set(voxels);
  return chunk;
}

function originOffset(dims: VoxelDims) {
  return vec3(meters, -(dims.x - 1) * 0.5 * VOXEL_SIZE, -(dims.y - 1) * 0.5 * VOXEL_SIZE, -(dims.z - 1) * 0.5 * VOXEL_SIZE);
}

export function cookCenteredCollider(voxels: Uint8Array, dims: VoxelDims): VoxelCompoundShape {
  const cooked = cookVoxelBody(toChunk(voxels, dims), kilograms(1), { originOffset: originOffset(dims) });
  if (cooked.status !== 0) throw new Error('WRECK_YARD_VOXEL_BODY_EMPTY');
  return cooked.body.shape;
}

export function halfExtents(dims: VoxelDims): Vec3 {
  return [dims.x * VOXEL_SIZE * 0.5, dims.y * VOXEL_SIZE * 0.5, dims.z * VOXEL_SIZE * 0.5];
}

export function bodyMass(body: YardBody): number {
  const { occupiedCount } = voxelStats(body.voxels, body.dims);
  const densityScale = lerp(1.5, 0.45, Math.sqrt(clamp(body.buoyancy, 0, 1)));
  return Math.max(0.001, occupiedCount * VOXEL_SIZE * VOXEL_SIZE * VOXEL_SIZE * densityScale);
}

/**
 * Damping rates (1/s) of a whole loose tire. It keeps 0.995 of its speed and 0.99 of its
 * spin each tick (constants.ts gives the rule). Other bodies keep less (LINEAR_DAMPING and
 * ANGULAR_DAMPING), so a tire rolls farther.
 */
export const TIRE_DAMPING = { linear: 0.150471, angular: 0.301889 } as const;

/** The linear damping rate (1/s) that a body has when nothing (a catapult launch) changes it. */
export function bodyLinearDamping(body: YardBody): number {
  return body.collider === 'cylinder' ? TIRE_DAMPING.linear : LINEAR_DAMPING;
}

/** The angular damping rate (1/s) of a body. */
export function bodyAngularDamping(body: YardBody): number {
  return body.collider === 'cylinder' ? TIRE_DAMPING.angular : ANGULAR_DAMPING;
}

/** The collision filter of a yard body: it collides with every body. Aim rays see its category. */
export const WORLD_FILTER = { categoryBits: WORLD_CATEGORY } as const;

/** Hole radius (m) of a loose tire (props.ts looseTirePreset). Its inertia is a thick ring, not a solid disc. */
const TIRE_HOLE_RADIUS = 0.2;

/** A cylinder around local y that rolls on its tread: the collider of a whole loose tire. */
function tireCollider(mass: number, radius: number, width: number) {
  const across = mass * (3 * (radius * radius + TIRE_HOLE_RADIUS * TIRE_HOLE_RADIUS) + width * width) / 12;
  return { status: 0, body: {
    shape: { type: 'cylinder' as const, radius: meters(radius), halfHeight: meters(width / 2) },
    mass: kilograms(mass),
    inertia: { xx: kilogramMetersSquared(across), yy: kilogramMetersSquared(mass * (radius * radius + TIRE_HOLE_RADIUS * TIRE_HOLE_RADIUS) / 2), zz: kilogramMetersSquared(across) },
    centerOfMass: vec3(meters, 0, 0, 0),
  } };
}

export function makePhysicsBody(body: YardBody, pose: BodyPose): YardPhysicsBodyInput3D {
  const mass = bodyMass(body);
  const fullCrate = body.renderModel === 'shipping-crate' && voxelStats(body.voxels).occupiedCount === body.voxels.length;
  const [sx, sy, sz] = [body.dims.x * VOXEL_SIZE, body.dims.y * VOXEL_SIZE, body.dims.z * VOXEL_SIZE];
  // An intact solid crate has the same surface as a primitive box. Cuts use voxel colliders.
  const cooked = fullCrate ? { status: 0, body: {
    shape: { type: 'box' as const, halfX: meters(sx / 2), halfY: meters(sy / 2), halfZ: meters(sz / 2) },
    mass: kilograms(mass), inertia: { xx: kilogramMetersSquared(mass * (sy * sy + sz * sz) / 12), yy: kilogramMetersSquared(mass * (sx * sx + sz * sz) / 12), zz: kilogramMetersSquared(mass * (sx * sx + sy * sy) / 12) },
    centerOfMass: vec3(meters, 0, 0, 0),
  } } : body.collider === 'cylinder' ? tireCollider(mass, sx / 2, sy) : cookVoxelBody(toChunk(body.voxels, body.dims), kilograms(mass), { originOffset: originOffset(body.dims) });
  if (cooked.status !== 0) throw new Error(`WRECK_YARD_VOXEL_BODY_EMPTY: ${body.id}`);
  return {
    id: body.id,
    body: {
      kind: body.motion === 'fixed' ? 'static' : 'dynamic',
      shape: cooked.body.shape,
      position: vec3(meters, pose.position),
      linearVelocity: body.motion === 'fixed' ? vec3(metersPerSecond, 0, 0, 0) : vec3(metersPerSecond, pose.linearVelocity, TICK_RATE),
      orientation: { x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2], w: pose.rotation[3] },
      angularVelocity: body.motion === 'fixed' ? vec3(radiansPerSecond, 0, 0, 0) : vec3(radiansPerSecond, pose.angularVelocity, TICK_RATE),
      mass: cooked.body.mass,
      inertia: cooked.body.inertia,
      centerOfMass: cooked.body.centerOfMass,
      sleeping: fullCrate && pose.linearVelocity.every((v) => v === 0) && pose.angularVelocity.every((v) => v === 0),
      // A whole loose tire keeps rolling: it has less damping than other bodies.
      linearDamping: perSecond(bodyLinearDamping(body)),
      angularDamping: perSecond(bodyAngularDamping(body)),
      // Storage and returns crates and their fragments grip each other harder than wood (sim/materials.ts).
      material: body.storageBay ? STACK_CRATE_MATERIAL : body.material,
      filter: WORLD_FILTER,
      // Syncplay rc.78 publishes contact events only for bodies that enable them. Impacts, drum
      // dents, lamp hits and crate breaks read them (step.ts).
      enableContactEvents: true,
      enableHitEvents: true,
    },
  };
}

/** The static physics body of one shell box. A repaired floodlight lens comes back through it. */
export function shellBody(box: ShellBox): YardPhysicsBodyInput3D {
  return {
    id: `${SHELL_PREFIX}${box.id}`,
    body: {
      kind: 'static' as const,
      position: vec3(meters, box.center),
      shape: { type: 'box' as const, halfX: meters(box.size[0] * 0.5), halfY: meters(box.size[1] * 0.5), halfZ: meters(box.size[2] * 0.5) },
      orientation: (([x, y, z, w]) => ({ x, y, z, w }))(shellBoxQuaternion(box)),
      material: box.material,
      filter: WORLD_FILTER,
    },
  };
}

export function shellBodies(): YardPhysicsBodyInput3D[] {
  const boxes = SHELL_BOXES.map(shellBody);
  // The cage is a steel mesh. It has its own category, so aim rays (query mask WORLD_CATEGORY) pass through it.
  const cage = CAGE_PANELS.map((panel): YardPhysicsBodyInput3D => ({
    id: `${SHELL_PREFIX}${panel.id}`,
    body: {
      kind: 'static' as const,
      position: vec3(meters, panel.center),
      shape: { type: 'box' as const, halfX: meters(panel.size[0] * 0.5), halfY: meters(panel.size[1] * 0.5), halfZ: meters(panel.size[2] * 0.5) },
      material: 'steel',
      filter: { categoryBits: CAGE_CATEGORY },
    },
  }));
  return [...boxes, ...cage];
}

export function makeWorld(): PhysicsWorld3D {
  return createPhysicsWorld3D({
    tickRate: TICK_RATE,
    // The yard sets its own gravity (13.5 m/s^2), so the Box3D default (-10) does not apply.
    initialGravity: vec3(metersPerSecondSquared, 0, -GRAVITY, 0),
    substeps: PHYSICS_SUBSTEPS,
    capacity: PHYSICS_CAPACITY,
    portalProxyCapacity: 256,
    // Named contact materials (Syncplay rc.49). Every body names one (sim/materials.ts).
    materials: PHYSICS_MATERIALS,
  });
}

/**
 * Pose and motion only. The shape is not part of the view: the checkpoint
 * holds it, and the state header (encoded for every tick's checksum) stays small.
 */
function bodyView(id: string, physics: PhysicsBodyMotion3D): YardPhysicsBody3D {
  return {
    id,
    kind: physics.kind,
    x: physics.position.x,
    y: physics.position.y,
    z: physics.position.z,
    vx: physics.linearVelocity.x / TICK_RATE,
    vy: physics.linearVelocity.y / TICK_RATE,
    vz: physics.linearVelocity.z / TICK_RATE,
    orientation: physics.orientation,
    angularVel: {
      x: physics.angularVelocity.x / TICK_RATE,
      y: physics.angularVelocity.y / TICK_RATE,
      z: physics.angularVelocity.z / TICK_RATE,
    },
  };
}

/**
 * Scratch rows for one batch motion read (6.0.0-rc.20): one native call
 * instead of a resolve and a read per body.
 */
const MOTION_BATCH = {
  poses: new Float64Array(PHYSICS_CAPACITY.bodies * 7),
  velocities: new Float64Array(PHYSICS_CAPACITY.bodies * 6),
  ids: new BigUint64Array(PHYSICS_CAPACITY.bodies),
  status: new Uint8Array(PHYSICS_CAPACITY.bodies),
  teleports: new Uint32Array(PHYSICS_CAPACITY.bodies),
};

/** Bits 0-1 of the batch status byte are the body kind; higher bits are flags (6.0.0-rc.21 docs). */
const BATCH_KINDS: readonly PhysicsBody3D['kind'][] = ['static', 'dynamic', 'kinematic'];

/** The batch row of a body id. The batch lists ids in ascending order. */
function batchRow(id: PhysicsBodyId3D, count: number): number {
  const { ids } = MOTION_BATCH;
  let low = 0;
  let high = count - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const value = ids[mid]!;
    if (value === id) return mid;
    if (value < id) low = mid + 1;
    else high = mid - 1;
  }
  throw new Error(`WRECK_YARD_PHYSICS_BODY_MISSING: id ${id}`);
}

function batchBodyView(name: string, row: number): YardPhysicsBody3D {
  const { poses, velocities, status } = MOTION_BATCH;
  const kind = BATCH_KINDS[status[row]! & 0b11];
  if (kind === undefined) throw new Error(`WRECK_YARD_MOTION_STATUS_UNKNOWN: ${status[row]} for ${name}`);
  const p = row * 7;
  const v = row * 6;
  return {
    id: name,
    teleportCounter: MOTION_BATCH.teleports[row]!,
    kind,
    x: poses[p]!,
    y: poses[p + 1]!,
    z: poses[p + 2]!,
    vx: velocities[v]! / TICK_RATE,
    vy: velocities[v + 1]! / TICK_RATE,
    vz: velocities[v + 2]! / TICK_RATE,
    orientation: { x: poses[p + 3]!, y: poses[p + 4]!, z: poses[p + 5]!, w: poses[p + 6]! },
    angularVel: {
      x: velocities[v + 3]! / TICK_RATE,
      y: velocities[v + 4]! / TICK_RATE,
      z: velocities[v + 5]! / TICK_RATE,
    },
  };
}

/** Builds the live world: the shell, the cage, the water, and `bodies`. */
export function createWorld(bodies: readonly YardPhysicsBodyInput3D[]): OpenYardPhysicsWorld {
  const open: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
  let built = false;
  try {
    // The lift car is the one surface outside the yard materials: high friction and no bounce, so crates ride it.
    addPhysicsBodies(open, [...shellBodies(), ...bodies, { id: ELEVATOR.id, body: { kind: 'kinematic', position: vec3(meters, ELEVATOR.x, ELEVATOR.floors[0] - ELEVATOR.size[1] / 2, ELEVATOR.z), shape: { type: 'compound', children: [{ shape: { type: 'box', halfX: meters(ELEVATOR.size[0] / 2), halfY: meters(ELEVATOR.size[1] / 2), halfZ: meters(ELEVATOR.size[2] / 2) }, offset: vec3(meters, 0, 0, 0) }, { shape: { type: 'box', halfX: meters(STORAGE_ELEVATOR_CAR_FIXTURE.size[0] / 2), halfY: meters(STORAGE_ELEVATOR_CAR_FIXTURE.size[1] / 2), halfZ: meters(STORAGE_ELEVATOR_CAR_FIXTURE.size[2] / 2) }, offset: vec3(meters, STORAGE_ELEVATOR_CAR_FIXTURE.center) }] }, material: LIFT_DECK_MATERIAL, filter: WORLD_FILTER } }]);
    createReturnsPair(open.world);
    // Conveyor belts. The surface velocity is part of the checkpoint (6.0.0-rc.13), so once is enough.
    for (const box of SHELL_BOXES) {
      if (!box.surfaceVelocity) continue;
      open.world.setBodySurfaceVelocity(physicsBodyHandle(open, `${SHELL_PREFIX}${box.id}`), vec3(metersPerSecond, box.surfaceVelocity));
    }
    open.world.edit((edit) => {
      edit.createFluid(WATER_FLUID_CONFIG);
    });
    built = true;
    return open;
  } finally {
    if (!built) open.world.dispose();
  }
}

/** After a restore: the body names must match the restored world. */
export function setBodyNames(open: OpenYardPhysicsWorld, bodyIds: YardPhysicsWorldState['bodyIds']): void {
  bodyTopologies.delete(open);
  open.bodyIds.clear();
  for (const [name, id] of bodyIds) open.bodyIds.set(name, BigInt(id) as PhysicsBodyId3D);
}

/**
 * Reads current motion after a step or edit. Reuse step outputs only when no
 * portal pair was changed after that step. Removed bodies lose their rows.
 */
export function readWorldState(
  open: OpenYardPhysicsWorld,
  fluidInteractions?: readonly PhysicsFluidInteraction3D[],
  stepOutputs?: Pick<PhysicsLatestOutputs3D, 'portalStraddlers'>,
): YardPhysicsWorldState {
  const { count } = open.world.writeBodyMotionInto(MOTION_BATCH.poses, MOTION_BATCH.velocities, MOTION_BATCH.ids, MOTION_BATCH.status, MOTION_BATCH.teleports);
  const topology = bodyTopology(open);
  const { names } = topology;
  const portalStraddlers: NonNullable<YardPhysicsWorldState['portalStraddlers']>[number][] = [];
  for (const entry of (stepOutputs ?? open.world.latest()).portalStraddlers ?? []) {
    const bodyId = topology.nativeNames.get(entry.bodyId);
    if (bodyId) portalStraddlers.push({ bodyId, pairId: entry.pairId, end: entry.end });
    else if (!stepOutputs) throw new Error('WRECK_YARD_PORTAL_BODY_MISSING');
  }
  if (perfActive()) {
    const { active, sleeping } = open.world.readBodyActivityCounts();
    perfCount('sim.activeBodies', active);
    perfCount('sim.sleepingBodies', sleeping);
  }
  const bodies = names.map((name) => batchBodyView(name, batchRow(open.bodyIds.get(name)!, count)));
  const interactions: YardFluidInteraction[] = [];
  if (fluidInteractions) {
    for (const item of fluidInteractions) {
      const name = bodyNameOf(item.bodyKey);
      if (!isShell(name)) {
        interactions.push({
          bodyId: name,
          submergedVolume: item.submergedVolume,
          totalForce: { x: item.totalForce.x, y: item.totalForce.y, z: item.totalForce.z },
          totalTorque: { x: item.totalTorque.x, y: item.totalTorque.y, z: item.totalTorque.z },
        });
      }
    }
  }
  return {
    frame: Number(open.world.info().frame),
    portalStraddlers,
    bodies,
    bodyIds: topology.ids,
    fluidInteractions: interactions.length > 0 ? interactions : undefined,
  };
}

export function physicsBodyById(open: OpenYardPhysicsWorld, id: string): YardPhysicsBody3D | undefined {
  const numericId = open.bodyIds.get(id);
  if (numericId === undefined) return undefined;
  return bodyView(id, open.world.readMotion(open.world.resolveBody(numericId)));
}

export function fullPhysicsBodyById(open: OpenYardPhysicsWorld, id: string): PhysicsBody3D | undefined {
  const numericId = open.bodyIds.get(id);
  return numericId === undefined ? undefined : open.world.readBody(open.world.resolveBody(numericId));
}

export function physicsStateBodyById(state: YardPhysicsWorldState, id: string): YardPhysicsBody3D | undefined {
  return state.bodies.find((body) => body.id === id);
}

export function physicsBodyHandle(open: OpenYardPhysicsWorld, id: string): PhysicsBodyHandle3D {
  const numericId = open.bodyIds.get(id);
  if (numericId === undefined) throw new Error(`WRECK_YARD_PHYSICS_BODY_MISSING: ${id}`);
  return open.world.resolveBody(numericId);
}

/** Name of a body by id: a scan. Hits carry the name as bodyKey; contacts (untyped) and fluid interactions do not. */
/** The yard name on a hit, a contact, or a fluid interaction: every body's Syncplay key is its name (addPhysicsBodies). */
export function bodyNameOf(key: string | undefined): string {
  if (key === undefined) throw new Error('WRECK_YARD_BODY_KEY_MISSING');
  return key;
}

export function addPhysicsBodies(open: OpenYardPhysicsWorld, bodies: readonly YardPhysicsBodyInput3D[]): void {
  const created = open.world.edit((edit) => bodies.map((entry) => ({ id: entry.id, body: edit.createBody({ ...entry.body, key: entry.id }) }))).created;
  bodyTopologies.delete(open);
  for (const entry of created) open.bodyIds.set(entry.id, entry.body.id);
}

export function removePhysicsBodies(open: OpenYardPhysicsWorld, ids: readonly string[]): void {
  open.world.edit((edit) => { for (const id of ids) edit.removeBody(physicsBodyHandle(open, id)); });
  bodyTopologies.delete(open);
  for (const id of ids) open.bodyIds.delete(id);
}

export function removePhysicsBody(open: OpenYardPhysicsWorld, id: string): void {
  removePhysicsBodies(open, [id]);
}

/**
 * Gives a body a new shape (a torch cut or a dent) at the same id. Syncplay rc.51
 * can fail replaceBody with a new shape in the full yard: "topology edit peak
 * bound was below the allocation" (rc.46 to rc.48 pass the same cuts). Until a fix
 * ships, the yard removes the body and adds it again with the same id and key.
 */
export function replacePhysicsBody(open: OpenYardPhysicsWorld, body: YardPhysicsBodyInput3D): void {
  open.world.edit((edit) => edit.replaceBody(physicsBodyHandle(open, body.id), body.body));
}

/** Sets linear velocity (m/tick) and wakes the body. The SDK setter is ~8x cheaper than a replaceBody edit. */
export function setPhysicsBodyVelocity(open: OpenYardPhysicsWorld, id: string, velocity: Vec3): void {
  open.world.setLinearVelocity(physicsBodyHandle(open, id), vec3(metersPerSecond, velocity, TICK_RATE));
}

/** Sets linear (m/tick) and angular (rad/tick) velocity and wakes the body. */
export function setPhysicsBodyMotion(open: OpenYardPhysicsWorld, id: string, linear: Vec3, angular: Vec3): void {
  const handle = physicsBodyHandle(open, id);
  open.world.setLinearVelocity(handle, vec3(metersPerSecond, linear, TICK_RATE));
  open.world.setAngularVelocity(handle, vec3(radiansPerSecond, angular, TICK_RATE));
}

/**
 * Moves a body and sets its velocity (m/s), spin (rad/s), and linear damping rate (1/s).
 * The catapult uses it to launch a body without damping.
 */
export function launchPhysicsBody(open: OpenYardPhysicsWorld, id: string, position: Vec3, velocity: Vec3, spin: Vec3, linearDamping: number): void {
  const handle = physicsBodyHandle(open, id);
  const body = open.world.readMotion(handle);
  open.world.setBodyTransform(handle, {
    position: vec3(meters, position),
    orientation: body.orientation,
  });
  open.world.setLinearVelocity(handle, vec3(metersPerSecond, velocity));
  open.world.setAngularVelocity(handle, vec3(radiansPerSecond, spin));
  open.world.setBodyLinearDamping(handle, perSecond(linearDamping));
  open.world.wakeBody(handle);
}

export function setPhysicsBodyLinearDamping(open: OpenYardPhysicsWorld, id: string, linearDamping: number): void {
  const handle = physicsBodyHandle(open, id);
  open.world.setBodyLinearDamping(handle, perSecond(linearDamping));
}

export function setPhysicsBodyAngularVelocity(open: OpenYardPhysicsWorld, id: string, angularVelocity: Vec3): void {
  open.world.setAngularVelocity(physicsBodyHandle(open, id), vec3(radiansPerSecond, angularVelocity, TICK_RATE));
}

export function replacePhysicsPose(
  open: OpenYardPhysicsWorld,
  id: string,
  pose: Partial<Pick<YardPhysicsBody3D, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'>>,
): void {
  const handle = physicsBodyHandle(open, id);
  const body = open.world.readMotion(handle);
  open.world.setBodyTransform(handle, {
    position: vec3(meters, pose.x ?? body.position.x, pose.y ?? body.position.y, pose.z ?? body.position.z),
    orientation: body.orientation,
  });
  open.world.setLinearVelocity(handle, {
    x: pose.vx === undefined ? body.linearVelocity.x : metersPerSecond(pose.vx * TICK_RATE),
    y: pose.vy === undefined ? body.linearVelocity.y : metersPerSecond(pose.vy * TICK_RATE),
    z: pose.vz === undefined ? body.linearVelocity.z : metersPerSecond(pose.vz * TICK_RATE),
  });
  open.world.wakeBody(handle);
}

/**
 * A live body as a replace input that keeps its named material. A read body also
 * carries the resolved coefficients; passed back as they are, they would turn
 * the body into an inline-material body, and its contacts would lose the name.
 */
export function readBodyInput(open: OpenYardPhysicsWorld, handle: PhysicsBodyHandle3D) {
  const { friction: _friction, restitution: _restitution, rollingResistance: _rolling, materialSource, ...rest } = open.world.readBody(handle);
  if (materialSource.kind !== 'named') throw new Error(`WRECK_YARD_BODY_MATERIAL_NOT_NAMED: ${rest.key ?? String(rest.id)}`);
  return { ...rest, material: materialSource.material };
}

export function isShell(bodyId: string): boolean {
  return bodyId.startsWith(SHELL_PREFIX);
}

export function applyPhysicsForce(
  open: OpenYardPhysicsWorld,
  id: string,
  force: Vec3,
  torque: Vec3 = [0, 0, 0],
): void {
  const handle = physicsBodyHandle(open, id);
  open.world.applyForce(
    handle,
    vec3(newtons, force),
    vec3(newtonMeters, torque),
  );
}

export function applyPhysicsForceAtPoint(
  open: OpenYardPhysicsWorld,
  id: string,
  force: Vec3,
  point: Vec3,
): void {
  const handle = physicsBodyHandle(open, id);
  open.world.applyForceAtPoint(
    handle,
    vec3(newtons, force),
    vec3(meters, point),
  );
}

export function clearPhysicsBodyForce(open: OpenYardPhysicsWorld, id: string): void {
  const handle = physicsBodyHandle(open, id);
  open.world.clearBodyForce(handle);
}

export function createFluidVolume(
  open: OpenYardPhysicsWorld,
  fluid: PhysicsFluidInput3D,
): PhysicsFluidHandle3D {
  const {
    created: { fluid: handle },
  } = open.world.edit((edit) => ({
    fluid: edit.createFluid(fluid),
  }));
  return handle;
}

export function removeFluidVolume(open: OpenYardPhysicsWorld, handle: PhysicsFluidHandle3D): void {
  open.world.edit((edit) => {
    edit.removeFluid(handle);
  });
}

export function poseOf(physics: YardPhysicsBody3D | PhysicsBody3D): BodyPose {
  if ('x' in physics) {
    return {
      position: [physics.x, physics.y, physics.z],
      rotation: [physics.orientation.x, physics.orientation.y, physics.orientation.z, physics.orientation.w],
      linearVelocity: [physics.vx, physics.vy, physics.vz],
      angularVelocity: [physics.angularVel.x, physics.angularVel.y, physics.angularVel.z],
    };
  }
  return {
    position: [physics.position.x, physics.position.y, physics.position.z],
    rotation: [physics.orientation.x, physics.orientation.y, physics.orientation.z, physics.orientation.w],
    linearVelocity: [
      physics.linearVelocity.x / TICK_RATE,
      physics.linearVelocity.y / TICK_RATE,
      physics.linearVelocity.z / TICK_RATE,
    ],
    angularVelocity: [
      physics.angularVelocity.x / TICK_RATE,
      physics.angularVelocity.y / TICK_RATE,
      physics.angularVelocity.z / TICK_RATE,
    ],
  };
}
