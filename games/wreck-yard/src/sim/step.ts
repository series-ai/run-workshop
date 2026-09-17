import {
  type PhysicsBody3D,
  type PhysicsContactEvent3D,
  type PhysicsJointHandle3D,
} from '@series-inc/rundot-syncplay/physics/3d';
import {
  DT,
  FLOOR_Y,
  GRAB_FLOOR_CLEARANCE,
  GRAB_LIFT,
  GRAB_PULL_GAIN,
  IMPACT_COOLDOWN_TICKS,
  IMPACT_MIN_SPEED,
  MAX_RAY_DISTANCE,
  THROW_BOOST,
  TORCH_INSET,
  TORCH_PULSE_TICKS,
  TORCH_RADIUS,
  TORCH_THROUGH_MARGIN,
  VOXEL_SIZE,
} from './constants';
import { fractureBody, type FractureContact } from './fracture';
import { decodeRay, TOOL, type YardInput } from './input';
import { add, clamp, rotateInverse, scale, sub, type Vec3 } from './math';
import type { VoxelDims } from 'voxel-kit';
import {
  addPhysicsBodies,
  closeWorld,
  halfExtents,
  isShell,
  openWorld,
  physicsBodyById,
  physicsBodyHandle,
  physicsBodyName,
  poseOf,
  removePhysicsBody,
  replacePhysicsBody,
  setPhysicsBodyVelocity,
  type OpenYardPhysicsWorld,
  type YardPhysicsBody3D,
} from './physics';
import { EMPTY_PLAYER, type PlayerState, type YardBody, type YardState, type YardStats } from './state';

interface Hit {
  readonly bodyId: string;
  readonly distance: number;
  readonly point: Vec3;
  readonly normal: Vec3;
}

interface PendingFracture {
  readonly bodyId: string;
  readonly contact: FractureContact;
  readonly countsAsCut: boolean;
}

interface Working {
  readonly physics: OpenYardPhysicsWorld;
  bodies: YardBody[];
  players: PlayerState[];
  stats: YardStats;
  nextSerial: number;
  fractures: PendingFracture[];
}

function firstYardHit(physics: OpenYardPhysicsWorld, origin: Vec3, direction: Vec3): Hit | null {
  const hits = physics.world.raycast({
    x: origin[0], y: origin[1], z: origin[2],
    dx: direction[0], dy: direction[1], dz: direction[2],
    maxDistance: MAX_RAY_DISTANCE,
  });
  for (const hit of hits) {
    const bodyId = physicsBodyName(physics, hit.bodyId);
    if (bodyId === undefined || isShell(bodyId)) continue;
    return {
      bodyId,
      distance: hit.distance,
      point: [hit.point.x, hit.point.y, hit.point.z],
      normal: [hit.normal.x, hit.normal.y, hit.normal.z],
    };
  }
  return null;
}

function worldToVoxel(body: YardBody, physics: YardPhysicsBody3D | PhysicsBody3D, worldPoint: Vec3): Vec3 {
  const pose = poseOf(physics);
  const local = rotateInverse(sub(worldPoint, pose.position), pose.rotation);
  return [
    local[0] / VOXEL_SIZE + body.dims.x * 0.5 - 0.5,
    local[1] / VOXEL_SIZE + body.dims.y * 0.5 - 0.5,
    local[2] / VOXEL_SIZE + body.dims.z * 0.5 - 0.5,
  ];
}

/**
 * Voxel-space distance from an interior point to the far side of the voxel box
 * along `direction`, so a torch carve can run out the other side of the body.
 * Cell centers span `[-0.5, dims - 0.5]` on each axis; a slab test returns the
 * distance to leave that box. Returns 0 for a degenerate direction.
 */
function voxelsToExitBox(from: Vec3, direction: Vec3, dims: VoxelDims): number {
  const min: Vec3 = [-0.5, -0.5, -0.5];
  const max: Vec3 = [dims.x - 0.5, dims.y - 0.5, dims.z - 0.5];
  let far = 0;
  for (let axis = 0; axis < 3; axis += 1) {
    const d = direction[axis];
    if (d === 0) continue;
    const boundary = d > 0 ? max[axis] : min[axis];
    const distance = (boundary - from[axis]) / d;
    if (distance > far) far = distance;
  }
  return far;
}

function findBody(bodies: readonly YardBody[], id: string): YardBody | undefined {
  return bodies.find((body) => body.id === id);
}

function stepHand(w: Working, input: YardInput, player: PlayerState): PlayerState {
  const ray = decodeRay(input);
  let grab = player.grab;
  if (grab && !findBody(w.bodies, grab.bodyId)) grab = null;

  if (input.pressed && !player.wasPressed && ray && !grab) {
    const hit = firstYardHit(w.physics, ray.origin, ray.direction);
    const body = hit ? findBody(w.bodies, hit.bodyId) : undefined;
    if (hit && body?.motion === 'dynamic') {
      grab = { bodyId: body.id, distance: hit.distance, velocity: [0, 0, 0] };
    }
  }

  if (grab && input.pressed && ray) {
    const body = findBody(w.bodies, grab.bodyId)!;
    const physics = physicsBodyById(w.physics, grab.bodyId)!;
    const target = add(ray.origin, scale(ray.direction, grab.distance));
    const floorY = FLOOR_Y + halfExtents(body.dims)[1] + GRAB_FLOOR_CLEARANCE;
    const clampedTarget: Vec3 = [target[0], Math.max(target[1], floorY), target[2]];
    const pull = scale(sub(clampedTarget, [physics.x, physics.y, physics.z]), GRAB_PULL_GAIN);
    const velocity: Vec3 = [pull[0], pull[1] + GRAB_LIFT, pull[2]];
    grab = { ...grab, velocity, target: clampedTarget };
  } else if (grab && !input.pressed) {
    const thrown = scale(grab.velocity, THROW_BOOST * DT);
    setPhysicsBodyVelocity(w.physics, grab.bodyId, thrown);
    w.stats = { ...w.stats, throws: w.stats.throws + 1 };
    grab = null;
  }

  return { ...player, grab, torch: null, torchTicks: 0, wasPressed: input.pressed };
}

function stepTorch(w: Working, input: YardInput, player: PlayerState): PlayerState {
  const ray = input.pressed ? decodeRay(input) : null;
  const hit = ray ? firstYardHit(w.physics, ray.origin, ray.direction) : null;
  const body = hit ? findBody(w.bodies, hit.bodyId) : undefined;
  if (!hit || !body) {
    return { ...player, grab: null, torch: null, torchTicks: 0, wasPressed: input.pressed };
  }

  const physics = physicsBodyById(w.physics, body.id)!;
  const pose = poseOf(physics);
  const localNormal = rotateInverse(hit.normal, pose.rotation);
  const surface = worldToVoxel(body, physics, hit.point);
  const point = sub(surface, scale(localNormal, TORCH_INSET));
  const sameBody = player.torch?.bodyId === body.id;
  const prev = sameBody ? player.torch!.prev : point;
  const torchTicks = sameBody ? player.torchTicks + 1 : 1;

  if (torchTicks % TORCH_PULSE_TICKS === 0) {
    // The through cut is the whole stroke translated out the far side, so both
    // ends of the stroke clear the body wall instead of only the far end.
    const depth = voxelsToExitBox(point, localNormal, body.dims) + TORCH_THROUGH_MARGIN;
    const shift = scale(localNormal, -depth);
    w.fractures.push({
      bodyId: body.id,
      countsAsCut: true,
      contact: {
        start: prev,
        end: point,
        through: add(prev, shift),
        throughEnd: add(point, shift),
        radius: TORCH_RADIUS,
        worldPoint: hit.point,
        impulseBoost: 0,
      },
    });
    return { ...player, grab: null, torch: { bodyId: body.id, prev: point }, torchTicks, wasPressed: true };
  }
  return { ...player, grab: null, torch: { bodyId: body.id, prev }, torchTicks, wasPressed: true };
}

function stepPlayer(w: Working, slot: number, input: YardInput): PlayerState {
  const player = w.players[slot] ?? EMPTY_PLAYER;
  switch (input.tool) {
    case TOOL.hand:
      return stepHand(w, input, player);
    case TOOL.torch:
      return stepTorch(w, input, player);
    case TOOL.none:
      return { ...EMPTY_PLAYER, wasPressed: input.pressed };
    default: {
      const unreachable: never = input.tool;
      throw new Error(`WRECK_YARD_TOOL_INVALID: ${String(unreachable)}`);
    }
  }
}

function queueImpacts(w: Working, contacts: readonly PhysicsContactEvent3D[], frame: number): void {
  for (const contact of contacts) {
    if (contact.type !== 'enter') continue;
    const speed = contact.closingSpeed;
    if (speed < IMPACT_MIN_SPEED) continue;
    for (const numericId of [contact.bodyA, contact.bodyB]) {
      const id = physicsBodyName(w.physics, numericId);
      if (id === undefined) continue;
      const body = findBody(w.bodies, id);
      if (!body || body.motion !== 'dynamic' || frame < body.impactCooldownUntil) continue;
      if (w.fractures.some((pending) => pending.bodyId === id)) continue;
      const physics = physicsBodyById(w.physics, id)!;
      const worldPoint: Vec3 = [contact.point.x, contact.point.y, contact.point.z];
      const local = worldToVoxel(body, physics, worldPoint);
      w.fractures.push({
        bodyId: id,
        countsAsCut: false,
        contact: {
          start: local,
          end: local,
          through: local,
          throughEnd: local,
          radius: clamp(1.1 + speed * 0.12, 1.1, 2.8),
          worldPoint,
          impulseBoost: 1.1 + speed * 0.18,
        },
      });
      w.bodies = w.bodies.map((entry) => entry.id === id
        ? { ...entry, impactCooldownUntil: frame + IMPACT_COOLDOWN_TICKS }
        : entry);
    }
  }
}

function applyFractures(w: Working, frame: number): void {
  for (const pending of w.fractures) {
    const body = findBody(w.bodies, pending.bodyId);
    const physics = physicsBodyById(w.physics, pending.bodyId);
    if (!body || !physics) continue;
    const source = pending.countsAsCut ? body : { ...body, impactCooldownUntil: frame + IMPACT_COOLDOWN_TICKS };
    const result = fractureBody(source, poseOf(physics), pending.contact, w.nextSerial);
    w.nextSerial = result.nextSerial;
    const index = w.bodies.findIndex((entry) => entry.id === pending.bodyId);
    w.bodies = [...w.bodies.slice(0, index), ...result.fragments.map((fragment) => fragment.body), ...w.bodies.slice(index + 1)];
    const replacing = result.fragments.find((fragment) => fragment.body.id === pending.bodyId);
    const added = result.fragments.filter((fragment) => fragment.body.id !== pending.bodyId);
    if (replacing) replacePhysicsBody(w.physics, replacing.physics);
    else removePhysicsBody(w.physics, pending.bodyId);
    addPhysicsBodies(w.physics, added.map((fragment) => fragment.physics));
    w.stats = pending.countsAsCut
      ? { ...w.stats, torchCuts: w.stats.torchCuts + 1 }
      : { ...w.stats, fractures: w.stats.fractures + 1 };
    w.players = w.players.map((player) => ({
      ...player,
      grab: player.grab?.bodyId === pending.bodyId ? null : player.grab,
      torch: player.torch?.bodyId === pending.bodyId ? null : player.torch,
    }));
  }
  w.fractures = [];
}

interface GrabJoint {
  readonly slot: number;
  readonly targetId: string;
  readonly joint: PhysicsJointHandle3D;
}

function createGrabJoints(w: Working): GrabJoint[] {
  const joints: GrabJoint[] = [];
  for (let slot = 0; slot < w.players.length; slot += 1) {
    const player = w.players[slot];
    const grab = player?.grab;
    if (!grab?.target) continue;
    const body = physicsBodyById(w.physics, grab.bodyId);
    if (!body) continue;
    const delta = sub(grab.target, [body.x, body.y, body.z]);
    if (delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2] > 100) {
      w.players[slot] = { ...player, grab: null };
      continue;
    }
    const targetId = `__grab_target:${slot}`;
    const created = w.physics.world.edit((edit) => {
      const target = edit.createBody({
        kind: 'kinematic',
        shape: { type: 'sphere', radius: 0.001 },
        position: { x: grab.target![0], y: grab.target![1], z: grab.target![2] },
        layer: 0,
        mask: 0,
      });
      const joint = edit.createJoint({
        type: 'six_dof',
        bodyA: target,
        bodyB: physicsBodyHandle(w.physics, grab.bodyId),
        linearAxes: [0, 1, 2].map(() => ({
          limit: { type: 'free' as const },
          spring: { target: 0, frequencyHz: 8, dampingRatio: 0.8, maxForce: 150 },
        })) as [
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
        ],
        angularAxes: [0, 1, 2].map(() => ({
          limit: { type: 'free' as const },
          spring: { target: 0, frequencyHz: 6, dampingRatio: 0.8, maxForce: 50 },
        })) as [
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
          { limit: { type: 'free' }; spring: { target: number; frequencyHz: number; dampingRatio: number; maxForce: number } },
        ],
        maxLinearForce: 150,
        maxAngularTorque: 50,
      });
      return { target, joint };
    }).created;
    w.physics.bodyIds.set(targetId, created.target.id);
    joints.push({ slot, targetId, joint: created.joint });
  }
  return joints;
}

function removeGrabJoints(w: Working, joints: readonly GrabJoint[]): void {
  for (const entry of joints) {
    w.physics.world.edit((edit) => edit.removeBody(physicsBodyHandle(w.physics, entry.targetId)));
    w.physics.bodyIds.delete(entry.targetId);
  }
}

export function stepYard(state: YardState, inputs: readonly YardInput[]): YardState {
  const physics = openWorld(state.world);
  let disposed = false;
  try {
    const w: Working = {
      physics,
      bodies: [...state.bodies],
      players: [...state.players],
      stats: state.stats,
      nextSerial: state.nextSerial,
      fractures: [],
    };

    for (let slot = 0; slot < w.players.length; slot += 1) {
      const input = inputs[slot];
      if (!input) throw new Error(`WRECK_YARD_INPUT_MISSING: slot ${slot}`);
      w.players[slot] = stepPlayer(w, slot, input);
    }

    const grabJoints = createGrabJoints(w);
    w.physics.world.step();
    const latest = w.physics.world.latest();
    for (const entry of grabJoints) {
      if (latest.breakEvents.some((event) => event.jointId === entry.joint.id)) {
        w.players[entry.slot] = { ...w.players[entry.slot]!, grab: null };
      }
    }
    queueImpacts(w, latest.contacts, state.frame);
    removeGrabJoints(w, grabJoints);
    applyFractures(w, state.frame);

    disposed = true;
    const nextWorld = closeWorld(w.physics, latest.fluidInteractions);
    return {
      frame: state.frame + 1,
      bodies: w.bodies,
      world: nextWorld,
      players: w.players,
      stats: w.stats,
      nextSerial: w.nextSerial,
    };
  } finally {
    if (!disposed) physics.world.dispose();
  }
}
