import {
  cookVoxelBody,
  createPhysicsWorld3D,
  createVoxelChunk,
  initPhysics3D,
  setVoxelCell,
  type PhysicsBody3D,
  type PhysicsBodyHandle3D,
  type PhysicsBodyId3D,
  type PhysicsBodyInput3D,
  type PhysicsFluidHandle3D,
  type PhysicsFluidInput3D,
  type PhysicsFluidInteraction3D,
  type PhysicsShape3D,
  type PhysicsWorld3D,
  type VoxelCompoundShape,
} from '@series-inc/rundot-syncplay/physics/3d';
import type { VoxelDims } from 'voxel-kit';
import { ANGULAR_DAMPING, GRAVITY, LINEAR_DAMPING, SHELL_BOXES, SHELL_PREFIX, TANK, TICK_RATE, VOXEL_SIZE, YARD_MATERIAL } from './constants';
import { clamp, lerp, type Quat, type Vec3 } from './math';
import type { YardBody } from './state';

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

export interface YardPhysicsBodyInput3D {
  readonly id: string;
  readonly body: PhysicsBodyInput3D;
}

export interface YardPhysicsBody3D {
  readonly id: string;
  readonly kind: PhysicsBody3D['kind'];
  readonly shape: PhysicsShape3D;
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

export interface YardPhysicsWorldState {
  readonly frame: number;
  readonly bodies: readonly YardPhysicsBody3D[];
  readonly checkpoint: Uint8Array;
  readonly bodyIds: readonly (readonly [string, string])[];
  readonly fluidInteractions?: readonly YardFluidInteraction[];
}

export interface OpenYardPhysicsWorld {
  readonly world: PhysicsWorld3D;
  readonly bodyIds: Map<string, PhysicsBodyId3D>;
}

export const PHYSICS_CAPACITY = {
  bodies: 2048,
  joints: 256,
  fluids: 8,
  fluidInteractions: 4096,
} as const;

export const WATER_FLUID_CONFIG: PhysicsFluidInput3D = {
  bounds: {
    minX: TANK.center[0] - TANK.innerSize[0] * 0.5,
    minY: TANK.bottomY,
    minZ: TANK.center[2] - TANK.innerSize[2] * 0.5,
    maxX: TANK.center[0] + TANK.innerSize[0] * 0.5,
    maxY: TANK.surfaceY,
    maxZ: TANK.center[2] + TANK.innerSize[2] * 0.5,
  },
  surfacePlane: {
    normal: { x: 0, y: 1, z: 0 },
    offset: TANK.surfaceY,
  },
  density: 1,
  linearDragPerSecond: 2,
  angularDragPerSecond: 1,
  flowVelocity: { x: 0, y: 0, z: 0 },
  layer: 1,
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
  const chunk = createVoxelChunk(dims.x, dims.y, dims.z, VOXEL_SIZE);
  chunk.occupancy.set(voxels);
  return chunk;
}

function originOffset(dims: VoxelDims) {
  return {
    x: -(dims.x - 1) * 0.5 * VOXEL_SIZE,
    y: -(dims.y - 1) * 0.5 * VOXEL_SIZE,
    z: -(dims.z - 1) * 0.5 * VOXEL_SIZE,
  };
}

export function cookCenteredCollider(voxels: Uint8Array, dims: VoxelDims): VoxelCompoundShape {
  const cooked = cookVoxelBody(toChunk(voxels, dims), 1, { originOffset: originOffset(dims) });
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

export function makePhysicsBody(body: YardBody, pose: BodyPose): YardPhysicsBodyInput3D {
  const mass = bodyMass(body);
  const cooked = cookVoxelBody(toChunk(body.voxels, body.dims), mass, { originOffset: originOffset(body.dims) });
  if (cooked.status !== 0) throw new Error(`WRECK_YARD_VOXEL_BODY_EMPTY: ${body.id}`);
  return {
    id: body.id,
    body: {
      kind: body.motion === 'fixed' ? 'static' : 'dynamic',
      shape: cooked.body.shape,
      position: { x: pose.position[0], y: pose.position[1], z: pose.position[2] },
      linearVelocity: body.motion === 'fixed'
        ? { x: 0, y: 0, z: 0 }
        : { x: pose.linearVelocity[0] * TICK_RATE, y: pose.linearVelocity[1] * TICK_RATE, z: pose.linearVelocity[2] * TICK_RATE },
      orientation: { x: pose.rotation[0], y: pose.rotation[1], z: pose.rotation[2], w: pose.rotation[3] },
      angularVelocity: body.motion === 'fixed'
        ? { x: 0, y: 0, z: 0 }
        : { x: pose.angularVelocity[0] * TICK_RATE, y: pose.angularVelocity[1] * TICK_RATE, z: pose.angularVelocity[2] * TICK_RATE },
      mass: cooked.body.mass,
      inertia: cooked.body.inertia,
      centerOfMass: cooked.body.centerOfMass,
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
      friction: YARD_MATERIAL.friction,
      restitution: YARD_MATERIAL.restitution,
      layer: 1,
      mask: 0xffffffff,
    },
  };
}

export function shellBodies(): YardPhysicsBodyInput3D[] {
  return SHELL_BOXES.map((box) => ({
    id: `${SHELL_PREFIX}${box.id}`,
    body: {
      kind: 'static',
      position: { x: box.center[0], y: box.center[1], z: box.center[2] },
      shape: { type: 'box', halfX: box.size[0] * 0.5, halfY: box.size[1] * 0.5, halfZ: box.size[2] * 0.5 },
      friction: YARD_MATERIAL.friction,
      restitution: YARD_MATERIAL.restitution,
      layer: 1,
      mask: 0xffffffff,
    },
  }));
}

export function makeWorld(): PhysicsWorld3D {
  return createPhysicsWorld3D({
    tickRate: TICK_RATE,
    initialGravity: { x: 0, y: -GRAVITY, z: 0 },
    capacity: PHYSICS_CAPACITY,
  });
}

function bodyView(id: string, physics: PhysicsBody3D): YardPhysicsBody3D {
  return {
    id,
    kind: physics.kind,
    shape: physics.shape,
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

export function createWorld(bodies: readonly YardPhysicsBodyInput3D[]): YardPhysicsWorldState {
  const open: OpenYardPhysicsWorld = { world: makeWorld(), bodyIds: new Map() };
  let disposed = false;
  try {
    addPhysicsBodies(open, [...shellBodies(), ...bodies]);
    open.world.edit((edit) => {
      edit.createFluid(WATER_FLUID_CONFIG);

      // Seesaw revolute joint
      const pivotId = open.bodyIds.get('shell:seesaw-pivot');
      const plankId = open.bodyIds.get('seesaw-plank');
      if (pivotId && plankId) {
        edit.createJoint({
          type: 'revolute',
          bodyA: open.world.resolveBody(pivotId),
          bodyB: open.world.resolveBody(plankId),
          anchorA: { x: 0, y: 0.45, z: 0 },
          anchorB: { x: 0, y: 0, z: 0 },
          axis: { x: 0, y: 0, z: 1 },
          minAngle: -0.42,
          maxAngle: 0.42,
        });
      }

      // Buggy chassis wheel joints
      const chassisId = open.bodyIds.get('vehicle-chassis');
      if (chassisId) {
        const wheels = [
          { id: 'vehicle-wheel-fl', anchor: { x: -0.9, y: -0.2, z: -0.9 } },
          { id: 'vehicle-wheel-fr', anchor: { x: 0.9, y: -0.2, z: -0.9 } },
          { id: 'vehicle-wheel-rl', anchor: { x: -0.9, y: -0.2, z: 0.9 } },
          { id: 'vehicle-wheel-rr', anchor: { x: 0.9, y: -0.2, z: 0.9 } },
        ];
        for (const w of wheels) {
          const wId = open.bodyIds.get(w.id);
          if (wId) {
            edit.createJoint({
              type: 'wheel',
              bodyA: open.world.resolveBody(chassisId),
              bodyB: open.world.resolveBody(wId),
              anchorA: w.anchor,
              anchorB: { x: 0, y: 0, z: 0 },
              axis: { x: 1, y: 0, z: 0 },
              suspension: { restLength: 0.35, frequencyHz: 4.5, dampingRatio: 0.65 },
            });
          }
        }
      }
    });
    disposed = true;
    return closeWorld(open);
  } finally {
    if (!disposed) open.world.dispose();
  }
}

export function openWorld(state: YardPhysicsWorldState): OpenYardPhysicsWorld {
  const world = makeWorld();
  try {
    world.restore(state.checkpoint);
    return {
      world,
      bodyIds: new Map(state.bodyIds.map(([name, id]) => [name, BigInt(id) as PhysicsBodyId3D])),
    };
  } catch (error) {
    world.dispose();
    throw new Error(`WRECK_YARD_PHYSICS_RESTORE_FAILED: frame ${state.frame}`, { cause: error });
  }
}

export function closeWorld(
  open: OpenYardPhysicsWorld,
  fluidInteractions?: readonly PhysicsFluidInteraction3D[],
): YardPhysicsWorldState {
  try {
    const checkpoint = open.world.captureCheckpoint();
    try {
      const bytes = open.world.serializeCheckpoint(checkpoint);
      const names = [...open.bodyIds.keys()].sort();
      const bodies = names.map((name) => bodyView(name, open.world.readBody(open.world.resolveBody(open.bodyIds.get(name)!))));
      const interactions: YardFluidInteraction[] = [];
      if (fluidInteractions) {
        for (const item of fluidInteractions) {
          const name = physicsBodyName(open, item.bodyId);
          if (name && !isShell(name)) {
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
        bodies,
        checkpoint: new Uint8Array(bytes),
        bodyIds: names.map((name) => [name, open.bodyIds.get(name)!.toString()] as const),
        fluidInteractions: interactions.length > 0 ? interactions : undefined,
      };
    } finally {
      open.world.releaseCheckpoint(checkpoint);
    }
  } finally {
    open.world.dispose();
  }
}

export function physicsBodyById(open: OpenYardPhysicsWorld, id: string): YardPhysicsBody3D | undefined {
  const numericId = open.bodyIds.get(id);
  if (numericId === undefined) return undefined;
  return bodyView(id, open.world.readBody(open.world.resolveBody(numericId)));
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

export function physicsBodyName(open: OpenYardPhysicsWorld, id: PhysicsBodyId3D): string | undefined {
  for (const [name, numericId] of open.bodyIds) if (numericId === id) return name;
  return undefined;
}

export function addPhysicsBodies(open: OpenYardPhysicsWorld, bodies: readonly YardPhysicsBodyInput3D[]): void {
  const created = open.world.edit((edit) => bodies.map((entry) => ({ id: entry.id, body: edit.createBody(entry.body) }))).created;
  for (const entry of created) open.bodyIds.set(entry.id, entry.body.id);
}

export function removePhysicsBody(open: OpenYardPhysicsWorld, id: string): void {
  open.world.edit((edit) => edit.removeBody(physicsBodyHandle(open, id)));
  open.bodyIds.delete(id);
}

export function replacePhysicsBody(open: OpenYardPhysicsWorld, body: YardPhysicsBodyInput3D): void {
  open.world.edit((edit) => edit.replaceBody(physicsBodyHandle(open, body.id), body.body));
}

export function setPhysicsBodyVelocity(open: OpenYardPhysicsWorld, id: string, velocity: Vec3): void {
  const handle = physicsBodyHandle(open, id);
  const body = open.world.readBody(handle);
  open.world.edit((edit) => edit.replaceBody(handle, {
    ...body,
    linearVelocity: { x: velocity[0] * TICK_RATE, y: velocity[1] * TICK_RATE, z: velocity[2] * TICK_RATE },
    sleeping: false,
  }));
}

export function replacePhysicsPose(
  state: YardPhysicsWorldState,
  id: string,
  pose: Partial<Pick<YardPhysicsBody3D, 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'>>,
): YardPhysicsWorldState {
  const open = openWorld(state);
  let disposed = false;
  try {
    const handle = physicsBodyHandle(open, id);
    const body = open.world.readBody(handle);
    open.world.edit((edit) => edit.replaceBody(handle, {
      ...body,
      position: {
        x: pose.x ?? body.position.x,
        y: pose.y ?? body.position.y,
        z: pose.z ?? body.position.z,
      },
      linearVelocity: {
        x: (pose.vx ?? body.linearVelocity.x / TICK_RATE) * TICK_RATE,
        y: (pose.vy ?? body.linearVelocity.y / TICK_RATE) * TICK_RATE,
        z: (pose.vz ?? body.linearVelocity.z / TICK_RATE) * TICK_RATE,
      },
      sleeping: false,
    }));
    disposed = true;
    return closeWorld(open);
  } finally {
    if (!disposed) open.world.dispose();
  }
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
    { x: force[0], y: force[1], z: force[2] },
    { x: torque[0], y: torque[1], z: torque[2] },
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
    { x: force[0], y: force[1], z: force[2] },
    { x: point[0], y: point[1], z: point[2] },
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
