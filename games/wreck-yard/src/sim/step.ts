import { meters, type PhysicsContactEvent3D } from '@series-inc/rundot-syncplay/physics/3d';
import {
  DT,
  FLOOR_Y,
  GRAB_BREAK_DISTANCE,
  GRAB_FLOOR_CLEARANCE,
  GRAVITY_GUN_PUNT_RANGE,
  GRAVITY_GUN_PUNT_SPEED,
  HEAT,
  IMPACT_COOLDOWN_TICKS,
  TICK_RATE,
  JETPACK_FUEL_DRAIN,
  LINEAR_DAMPING,
  JETPACK_FUEL_RECHARGE,
  JETPACK_THRUST_XZ,
  JETPACK_THRUST_Y,
  MAX_RAY_DISTANCE,
  TORCH_RANGE,
  PLAYER_EYE_OFFSET,
  PLAYER_GRAVITY,
  PLAYER_MOVE_SPEED,
  THROW_BOOST,
  withinBuggyMountRange,
  TORCH_INSET,
  TORCH_PULSE_TICKS,
  TORCH_RADIUS,
  TORCH_THROUGH_MARGIN,
  VOXEL_SIZE,
} from './constants';
import { WORLD_LAYER } from './cage';
import { fractureBody, type FractureContact } from './fracture';
import {
  BALLISTIC_DAMPING,
  BALLISTIC_TICKS,
  buttonAt,
  buttonTop,
  buttonWithinReach,
  CATAPULT,
  catapultLaunchVelocity,
  CONVEYOR,
  DRUM_SPAWN,
  crossedHoop,
  buttonResetLeft,
  inCatapultBucket,
  MAX_DROPPED_DRUMS,
  nearHoop,
  type ButtonId,
} from './contraptions';
import { coolVoxels } from './heat';
import { BLAST, blastDirection, blastFalloff, damageDrum, dentVoxels, EXPLOSION_SHOW_TICKS, FUEL_DRUM, hitDamage, scorchVoxels } from './fuelDrum';
import { fuelDrumPreset } from './props';
import { stepBuggy } from './vehicle';
import { movePlayer } from './movement';
import { ANGLE_SCALE, decodeRay, TOOL, type YardInput } from './input';
import { advanceHoldPoint, grabServo } from './grab';
import { add, clamp, lerp, rotateInverse, scale, sub, type Vec3 } from './math';
import type { VoxelDims } from 'voxel-kit';
import {
  addPhysicsBodies,
  halfExtents,
  voxelStats,
  isShell,
  launchPhysicsBody,
  makePhysicsBody,
  physicsBodyById,
  physicsBodyHandle,
  physicsBodyName,
  poseOf,
  removePhysicsBody,
  replacePhysicsBody,
  setPhysicsBodyMotion,
  setPhysicsBodyLinearDamping,
  setPhysicsBodyVelocity,
  readWorldState,
  type OpenYardPhysicsWorld,
  type YardPhysicsWorldState,
  type YardPhysicsBody3D,
} from './physics';
import {
  createInitialPlayer,
  type ContraptionState,
  type FuelDrumState,
  type PlayerState,
  type PlayerTool,
  type YardBody,
  type YardState,
  type YardStats,
  type ToolFeedback,
  type ToolResult,
} from './state';

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
  contraptions: ContraptionState;
  nextSerial: number;
  fractures: PendingFracture[];
  /** The frame this step produces; stamps tool feedback. */
  readonly frame: number;
}

/** The first solid along the aim ray. Static shell boxes block the ray. */
type AimHit =
  | { readonly kind: 'body'; readonly body: YardBody; readonly hit: Hit }
  | { readonly kind: 'solid'; readonly point: Vec3 }
  | { readonly kind: 'none'; readonly point: Vec3 };

function aimRay(w: Working, origin: Vec3, direction: Vec3, maxDistance = MAX_RAY_DISTANCE): AimHit {
  const hits = w.physics.world.raycast({
    x: meters(origin[0]), y: meters(origin[1]), z: meters(origin[2]),
    dx: direction[0], dy: direction[1], dz: direction[2],
    maxDistance: meters(maxDistance),
    layerMask: WORLD_LAYER,
  });
  const first = hits[0];
  if (!first) return { kind: 'none', point: add(origin, scale(direction, maxDistance)) };
  const point: Vec3 = [first.point.x, first.point.y, first.point.z];
  const bodyId = physicsBodyName(w.physics, first.bodyId);
  const body = bodyId === undefined || isShell(bodyId) ? undefined : findBody(w.bodies, bodyId);
  if (!body) return { kind: 'solid', point };
  return {
    kind: 'body',
    body,
    hit: { bodyId: body.id, distance: first.distance, point, normal: [first.normal.x, first.normal.y, first.normal.z] },
  };
}

function toolFeedback(w: Working, result: ToolResult, point: Vec3): ToolFeedback {
  return { result, point, frame: w.frame };
}

/** Feedback for a gravity gun ray that found nothing it can act on. */
function refusal(w: Working, aim: AimHit): ToolFeedback {
  return aim.kind === 'none' ? toolFeedback(w, 'miss', aim.point) : toolFeedback(w, 'blocked', aim.kind === 'body' ? aim.hit.point : aim.point);
}

function worldToVoxel(body: YardBody, physics: YardPhysicsBody3D, worldPoint: Vec3): Vec3 {
  const pose = poseOf(physics);
  const local = rotateInverse(sub(worldPoint, pose.position), pose.rotation);
  return [
    local[0] / VOXEL_SIZE + (body.dims.x - 1) * 0.5,
    local[1] / VOXEL_SIZE + (body.dims.y - 1) * 0.5,
    local[2] / VOXEL_SIZE + (body.dims.z - 1) * 0.5,
  ];
}

/**
 * Steps along `direction` through a voxel-space box `[0, dims]` and returns
 * the distance in voxels from `from` to the exit face.
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

function getPlayerRay(player: PlayerState, input: YardInput): { origin: Vec3; direction: Vec3 } {
  const legacyRay = decodeRay(input);
  if (legacyRay) return legacyRay;

  const eye: Vec3 = [player.x, player.y + PLAYER_EYE_OFFSET, player.z];
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const sinP = Math.sin(player.pitch);
  const cosP = Math.cos(player.pitch);

  const dir: Vec3 = [-sinY * cosP, sinP, -cosY * cosP];
  return { origin: eye, direction: dir };
}

function stepPlayerMovement(player: PlayerState, input: YardInput, w: Working): PlayerState {
  const yaw = (input.yaw ?? 0) / ANGLE_SCALE;
  const pitch = clamp((input.pitch ?? 0) / ANGLE_SCALE, -1.45, 1.45);

  const sinY = Math.sin(yaw);
  const cosY = Math.cos(yaw);
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  const inputLength = Math.max(1, Math.hypot(input.moveX, input.moveZ));
  const moveX = clamp(input.moveX ?? 0, -1, 1) / inputLength;
  const moveZ = clamp(input.moveZ ?? 0, -1, 1) / inputLength;

  // Check buggy vehicle interaction
  const buggy = physicsBodyById(w.physics, 'vehicle-chassis');
  let ridingVehicle = Boolean(player.ridingVehicle);

  if (buggy) {
    const inRange = withinBuggyMountRange([player.x, player.y, player.z], [buggy.x, buggy.y, buggy.z]);
    const occupied = w.players.some((other) => other.slot !== player.slot && other.ridingVehicle);
    const useEdge = input.use && !player.wasUsePressed;
    if (!ridingVehicle && !occupied && inRange && useEdge) {
      ridingVehicle = true;
    } else if (ridingVehicle && (input.jetpack || useEdge)) {
      ridingVehicle = false;
      const chassisYaw = Math.atan2(
        2 * (buggy.orientation.w * buggy.orientation.y + buggy.orientation.x * buggy.orientation.z),
        1 - 2 * (buggy.orientation.y * buggy.orientation.y + buggy.orientation.z * buggy.orientation.z),
      );
      // Cleanly dismount to driver's side of the buggy
      return {
        ...player,
        x: buggy.x + Math.cos(chassisYaw) * 1.8,
        y: buggy.y + 0.2,
        z: buggy.z - Math.sin(chassisYaw) * 1.8,
        vx: 0,
        vy: 0,
        vz: 0,
        grounded: true,
        ridingVehicle: false,
        wasSecondaryPressed: input.secondary,
      };
    }
  } else {
    ridingVehicle = false;
  }

  if (ridingVehicle && buggy) {
    return {
      ...player,
      x: buggy.x,
      y: buggy.y + 0.28,
      z: buggy.z + 0.12,
      vx: buggy.vx,
      vy: buggy.vy,
      vz: buggy.vz,
      yaw,
      pitch,
      grounded: true,
      fuel: 100,
      jetpackActive: false,
      activeTool: 'none' as PlayerTool,
      ridingVehicle: true,
      wasSecondaryPressed: input.secondary,
    };
  }

  const targetVx = (fwdX * moveZ + rightX * moveX) * PLAYER_MOVE_SPEED;
  const targetVz = (fwdZ * moveZ + rightZ * moveX) * PLAYER_MOVE_SPEED;

  let vx = player.vx;
  let vy = player.vy;
  let vz = player.vz;
  let fuel = player.fuel;
  let jetpackActive = false;

  if (input.jetpack && fuel > 0) {
    jetpackActive = true;
    vy = Math.min(vy + JETPACK_THRUST_Y * DT, 12.0);
    vx += (fwdX * moveZ + rightX * moveX) * JETPACK_THRUST_XZ * DT;
    vz += (fwdZ * moveZ + rightZ * moveX) * JETPACK_THRUST_XZ * DT;
    fuel = Math.max(0, fuel - JETPACK_FUEL_DRAIN);
  } else {
    vy = Math.max(vy - PLAYER_GRAVITY * DT, -24.0);
  }

  if (player.grounded) {
    if (moveX === 0 && moveZ === 0) {
      // Ground static friction: instantaneous stop, eliminates ice-skating slide
      vx *= 0.15;
      vz *= 0.15;
      if (Math.abs(vx) < 0.05) vx = 0;
      if (Math.abs(vz) < 0.05) vz = 0;
    } else {
      // Responsive ground traction
      vx = lerp(vx, targetVx, 0.6);
      vz = lerp(vz, targetVz, 0.6);
    }
  } else {
    // Air inertia
    vx = lerp(vx, targetVx, 0.08);
    vz = lerp(vz, targetVz, 0.08);
  }

  const moved = movePlayer(w.physics, player, [vx, vy, vz]);
  const { x, y, z, grounded } = moved;
  [vx, vy, vz] = moved.velocity;
  if (grounded) fuel = Math.min(100, fuel + JETPACK_FUEL_RECHARGE);

  const activeTool: PlayerTool = input.tool === TOOL.torch ? 'torch' : 'gravity';

  return {
    ...player,
    x,
    y,
    z,
    vx,
    vy,
    vz,
    yaw,
    pitch,
    grounded,
    fuel,
    jetpackActive,
    activeTool,
    ridingVehicle: false,
  };
}


function stepHand(
  w: Working,
  input: YardInput,
  player: PlayerState,
  ray: { origin: Vec3; direction: Vec3 },
): PlayerState {
  let grab = player.grab;
  if (grab && !findBody(w.bodies, grab.bodyId)) grab = null;
  let feedback = player.feedback;

  // Secondary action: Gravity Gun PUNT
  if (input.secondary && !player.wasSecondaryPressed) {
    let punt: { bodyId: string; point: Vec3 } | null = null;
    if (grab) {
      const held = physicsBodyById(w.physics, grab.bodyId)!;
      punt = { bodyId: grab.bodyId, point: [held.x, held.y, held.z] };
    } else {
      const aim = aimRay(w, ray.origin, ray.direction);
      if (aim.kind === 'body' && aim.body.motion === 'dynamic' && aim.hit.distance <= GRAVITY_GUN_PUNT_RANGE) {
        punt = { bodyId: aim.body.id, point: aim.hit.point };
      } else {
        feedback = refusal(w, aim);
      }
    }
    if (punt) {
      const puntVel: Vec3 = [
        ray.direction[0] * GRAVITY_GUN_PUNT_SPEED * DT,
        (ray.direction[1] * GRAVITY_GUN_PUNT_SPEED + 2.0) * DT,
        ray.direction[2] * GRAVITY_GUN_PUNT_SPEED * DT,
      ];
      setPhysicsBodyVelocity(w.physics, punt.bodyId, puntVel);
      w.stats = { ...w.stats, throws: w.stats.throws + 1 };
      const punted = findBody(w.bodies, punt.bodyId);
      if (punted && drumOf(w, punt.bodyId)) {
        // A punt from range dents the drum where it hits; a punt of a held drum only adds damage.
        const dentAt = grab ? null : worldToVoxel(punted, physicsBodyById(w.physics, punt.bodyId)!, punt.point);
        hurtDrum(w, punt.bodyId, FUEL_DRUM.puntDamage, dentAt);
      }
      return {
        ...player,
        grab: null,
        torch: null,
        torchTicks: 0,
        wasPressed: input.pressed,
        wasSecondaryPressed: true,
        feedback: toolFeedback(w, 'punt', punt.point),
      };
    }
  }

  // Primary action: Gravity Gun LEVITATE / HOLD
  if (input.pressed && !player.wasPressed && !grab) {
    const aim = aimRay(w, ray.origin, ray.direction);
    const physics = aim.kind === 'body' ? physicsBodyById(w.physics, aim.body.id) : undefined;
    if (aim.kind === 'body' && aim.body.motion === 'dynamic' && physics) {
      grab = {
        bodyId: aim.body.id,
        distance: clamp(aim.hit.distance, 2.5, 6.0),
        target: [physics.x, physics.y, physics.z],
        targetVelocity: [0, 0, 0],
      };
      feedback = toolFeedback(w, 'grab', aim.hit.point);
    } else {
      const button = aim.kind === 'solid' ? buttonAt(aim.point) : null;
      feedback = button ? pressButton(w, button) : refusal(w, aim);
    }
  }

  if (grab && input.pressed) {
    const body = findBody(w.bodies, grab.bodyId)!;
    const aim = add(ray.origin, scale(ray.direction, grab.distance));
    const floorY = FLOOR_Y + halfExtents(body.dims)[1] + GRAB_FLOOR_CLEARANCE;
    const hold = advanceHoldPoint({ point: grab.target, velocity: grab.targetVelocity }, [aim[0], Math.max(aim[1], floorY), aim[2]]);
    const physics = physicsBodyById(w.physics, grab.bodyId)!;
    const position: Vec3 = [physics.x, physics.y, physics.z];
    const gap = sub(hold.point, position);
    if (gap[0] * gap[0] + gap[1] * gap[1] + gap[2] * gap[2] > GRAB_BREAK_DISTANCE * GRAB_BREAK_DISTANCE) {
      // The body is stuck far behind the hold point (wedged or knocked away): let go.
      grab = null;
    } else {
      const motion = grabServo(position, {
        linear: [physics.vx, physics.vy, physics.vz],
        angular: [physics.angularVel.x, physics.angularVel.y, physics.angularVel.z],
      }, hold);
      setPhysicsBodyMotion(w.physics, grab.bodyId, motion.linear, motion.angular);
      grab = { ...grab, target: hold.point, targetVelocity: hold.velocity };
    }
  } else if (grab && !input.pressed) {
    const physics = physicsBodyById(w.physics, grab.bodyId)!;
    setPhysicsBodyVelocity(w.physics, grab.bodyId, scale([physics.vx, physics.vy, physics.vz], THROW_BOOST));
    w.stats = { ...w.stats, throws: w.stats.throws + 1 };
    feedback = toolFeedback(w, 'throw', [physics.x, physics.y, physics.z]);
    grab = null;
  }

  return {
    ...player,
    grab,
    torch: null,
    torchTicks: 0,
    wasPressed: input.pressed,
    wasSecondaryPressed: input.secondary,
    feedback,
  };
}

function stepTorch(
  w: Working,
  input: YardInput,
  player: PlayerState,
  ray: { origin: Vec3; direction: Vec3 },
): PlayerState {
  if (!input.pressed) {
    return {
      ...player,
      grab: null,
      torch: null,
      torchTicks: 0,
      wasPressed: false,
      wasSecondaryPressed: input.secondary,
    };
  }

  const aim = aimRay(w, ray.origin, ray.direction, TORCH_RANGE);
  if (aim.kind !== 'body') {
    // A wall or other static solid throws sparks without cutting; open air or anything
    // past TORCH_RANGE shows only the flame.
    if (aim.kind === 'solid') keepFlameHeat(w, aim.point);
    return {
      ...player,
      grab: null,
      torch: null,
      torchTicks: 0,
      wasPressed: true,
      wasSecondaryPressed: input.secondary,
      feedback: toolFeedback(w, aim.kind === 'solid' ? 'scorch' : 'miss', aim.point),
    };
  }
  const { body, hit } = aim;
  const feedback = toolFeedback(w, 'cut', hit.point);

  const physics = physicsBodyById(w.physics, body.id)!;
  const pose = poseOf(physics);
  const localNormal = rotateInverse(hit.normal, pose.rotation);
  const surface = worldToVoxel(body, physics, hit.point);
  const point = sub(surface, scale(localNormal, TORCH_INSET));
  const sameBody = player.torch?.bodyId === body.id;
  const prev = sameBody ? player.torch!.prev : point;
  const torchTicks = sameBody ? player.torchTicks + 1 : 1;

  if (drumOf(w, body.id)) {
    // The torch does not cut a drum: it heats it until it is lit.
    hurtDrum(w, body.id, FUEL_DRUM.torchDamagePerTick, null);
    if (torchTicks % TORCH_PULSE_TICKS === 0) {
      const heated = findBody(w.bodies, body.id)!;
      w.bodies = w.bodies.map((entry) => (entry.id === body.id
        ? { ...heated, voxels: scorchVoxels(heated.dims, heated.voxels, surface), heat: { frame: w.frame, at: surface } }
        : entry));
    }
    return {
      ...player,
      grab: null,
      torch: { bodyId: body.id, prev: point },
      torchTicks,
      wasPressed: true,
      wasSecondaryPressed: input.secondary,
      feedback,
    };
  }

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
    return {
      ...player,
      grab: null,
      torch: { bodyId: body.id, prev: point },
      torchTicks,
      wasPressed: true,
      wasSecondaryPressed: input.secondary,
      feedback,
    };
  }
  return {
    ...player,
    grab: null,
    torch: { bodyId: body.id, prev },
    torchTicks,
    wasPressed: true,
    wasSecondaryPressed: input.secondary,
    feedback,
  };
}

function stepPlayer(w: Working, slot: number, input: YardInput): PlayerState {
  return { ...stepPlayerActions(w, slot, input), wasUsePressed: input.use };
}

/** Use (E) works buttons and the buggy; the right mouse button punts. They never share a press. */
function stepPlayerActions(w: Working, slot: number, input: YardInput): PlayerState {
  const initial = w.players[slot] ?? createInitialPlayer(slot);
  // Use at a button presses it; it then does not also get in the buggy.
  const useEdge = input.use && !initial.wasUsePressed;
  const button = useEdge && !initial.ridingVehicle ? buttonWithinReach([initial.x, initial.y, initial.z]) : null;
  if (button) {
    const moved = stepPlayerMovement(initial, { ...input, use: false }, w);
    return { ...moved, wasPressed: input.pressed, wasSecondaryPressed: input.secondary, feedback: pressButton(w, button) };
  }
  const moved = stepPlayerMovement(initial, input, w);
  if (moved.ridingVehicle) {
    return {
      ...moved,
      grab: null,
      torch: null,
      torchTicks: 0,
      wasPressed: input.pressed,
      wasSecondaryPressed: input.secondary,
    };
  }
  const ray = getPlayerRay(moved, input);

  switch (input.tool) {
    case TOOL.hand:
      return stepHand(w, input, moved, ray);
    case TOOL.torch:
      return stepTorch(w, input, moved, ray);
    case TOOL.none:
      return {
        ...moved,
        grab: null,
        torch: null,
        torchTicks: 0,
        wasPressed: input.pressed,
        wasSecondaryPressed: input.secondary,
      };
    default: {
      const unreachable: never = input.tool;
      throw new Error(`WRECK_YARD_TOOL_INVALID: ${String(unreachable)}`);
    }
  }
}

/**
 * Where a contact touches `body`, in voxel space and world space. The contact
 * point is shared by both bodies and can sit a few cm off this body's surface;
 * then it is projected onto this body along the contact normal.
 */
function contactOnBody(w: Working, body: YardBody, numericId: PhysicsContactEvent3D['bodyA'], contact: PhysicsContactEvent3D): { local: Vec3; worldPoint: Vec3 } | null {
  const physics = physicsBodyById(w.physics, body.id)!;
  let worldPoint: Vec3 = [contact.point.x, contact.point.y, contact.point.z];
  let local = worldToVoxel(body, physics, worldPoint);
  if (local.some((v, axis) => v < -1 || v > [body.dims.x, body.dims.y, body.dims.z][axis]!)) {
    const sign = numericId === contact.bodyA ? 1 : -1;
    const outward: Vec3 = [contact.normal.x * sign, contact.normal.y * sign, contact.normal.z * sign];
    const distance = Math.hypot(...halfExtents(body.dims)) + VOXEL_SIZE;
    const hit = w.physics.world.raycast({
      x: meters(physics.x + outward[0] * distance),
      y: meters(physics.y + outward[1] * distance),
      z: meters(physics.z + outward[2] * distance),
      dx: -outward[0], dy: -outward[1], dz: -outward[2],
      maxDistance: meters(distance * 2),
    }).find((entry) => entry.bodyId === numericId);
    if (!hit) return null;
    worldPoint = [hit.point.x, hit.point.y, hit.point.z];
    local = worldToVoxel(body, physics, worldPoint);
  }
  return { local, worldPoint };
}

/**
 * Hits damage fuel drums (a dent and damage) and nothing else: only the torch
 * and blasts change a voxel shape.
 */
function queueDrumHits(w: Working, contacts: readonly PhysicsContactEvent3D[], frame: number): void {
  for (const contact of contacts) {
    if (contact.type !== 'enter') continue;
    const speed = contact.closingSpeed;
    if (speed < FUEL_DRUM.minHitSpeed) continue;
    for (const numericId of [contact.bodyA, contact.bodyB]) {
      const id = physicsBodyName(w.physics, numericId);
      if (id === undefined || !drumOf(w, id)) continue;
      const body = findBody(w.bodies, id);
      if (!body || frame < body.impactCooldownUntil) continue;
      const damage = hitDamage(speed);
      if (damage <= 0) continue;
      hurtDrum(w, id, damage, contactOnBody(w, body, numericId, contact)?.local ?? null);
      setImpactCooldown(w, id, frame);
    }
  }
}

/** Meters around the flame point that stay hot: the torch carve radius plus one voxel. */
const FLAME_HEAT_REACH = (TORCH_RADIUS + 1) * VOXEL_SIZE;

/**
 * A torch through a hole hits what is behind it, but its flame still touches
 * the rim: a hot body within FLAME_HEAT_REACH of the flame point stays hot.
 */
function keepFlameHeat(w: Working, point: Vec3): void {
  const near = w.physics.world.overlap({
    x: meters(point[0]), y: meters(point[1]), z: meters(point[2]),
    shape: { type: 'sphere', radius: meters(FLAME_HEAT_REACH) },
    hitTriggers: false, hitSensors: false,
  });
  const ids = new Set(near.map((hit) => physicsBodyName(w.physics, hit.bodyId)));
  w.bodies = w.bodies.map((body) => (body.heat && ids.has(body.id) ? { ...body, heat: { ...body.heat, frame: w.frame } } : body));
}

/** A scorch that has cooled for HEAT.burntSeconds turns burnt. Colors only: the collider stays. */
function coolBodies(w: Working): void {
  const coolTicks = Math.round(HEAT.burntSeconds * TICK_RATE);
  w.bodies = w.bodies.map((body) => (body.heat && w.frame - body.heat.frame >= coolTicks
    ? { ...body, voxels: coolVoxels(body.voxels), heat: null }
    : body));
}

function setImpactCooldown(w: Working, id: string, frame: number): void {
  w.bodies = w.bodies.map((entry) => entry.id === id
    ? { ...entry, impactCooldownUntil: frame + IMPACT_COOLDOWN_TICKS }
    : entry);
}

function applyFractures(w: Working, frame: number): void {
  for (const pending of w.fractures) {
    const body = findBody(w.bodies, pending.bodyId);
    const physics = physicsBodyById(w.physics, pending.bodyId);
    if (!body || !physics) continue;
    const source = pending.countsAsCut ? body : { ...body, impactCooldownUntil: frame + IMPACT_COOLDOWN_TICKS };
    const result = fractureBody(source, poseOf(physics), pending.contact, w.nextSerial, frame);
    const remaining = result.fragments.reduce((sum, fragment) => sum + voxelStats(fragment.body.voxels).occupiedCount, 0);
    if (remaining >= voxelStats(source.voxels).occupiedCount) {
      // Nothing left to carve here, but a held torch keeps the spot hot.
      const at = scale(add(pending.contact.start, pending.contact.end), 0.5);
      w.bodies = w.bodies.map((entry) => (entry.id === pending.bodyId ? { ...entry, heat: { frame, at } } : entry));
      continue;
    }
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

/** Removes a body from the yard and lets go of it in every player's tools. */
function removeYardBody(w: Working, id: string): void {
  w.bodies = w.bodies.filter((body) => body.id !== id);
  removePhysicsBody(w.physics, id);
  w.players = w.players.map((player) => ({
    ...player,
    grab: player.grab?.bodyId === id ? null : player.grab,
    torch: player.torch?.bodyId === id ? null : player.torch,
  }));
}

function drumOf(w: Working, id: string): FuelDrumState | undefined {
  return w.contraptions.drums.find((drum) => drum.bodyId === id);
}

/** New voxels for a body; the collider is cooked again from them, at the same pose and velocity. */
function reshapeBody(w: Working, id: string, voxels: Uint8Array): void {
  const body = findBody(w.bodies, id);
  const physics = physicsBodyById(w.physics, id);
  if (!body || !physics) return;
  const next: YardBody = { ...body, voxels };
  w.bodies = w.bodies.map((entry) => (entry.id === id ? next : entry));
  replacePhysicsBody(w.physics, makePhysicsBody(next, poseOf(physics)));
}

/** Adds damage to a drum, and dents it at `dentAt` (voxel space) if given. */
function hurtDrum(w: Working, id: string, amount: number, dentAt: Vec3 | null, fuseTicks: number = FUEL_DRUM.fuseTicks): void {
  if (!drumOf(w, id)) return;
  w.contraptions = {
    ...w.contraptions,
    drums: w.contraptions.drums.map((drum) => (drum.bodyId === id ? damageDrum(drum, amount, w.frame, fuseTicks) : drum)),
  };
  const body = findBody(w.bodies, id);
  if (dentAt && body) reshapeBody(w, id, dentVoxels(body.dims, body.voxels, dentAt));
}

/** Ticks from a drum's spawn until it has left the belt and landed. */
const DRUM_DROP_TICKS = Math.ceil(((CONVEYOR.zEnd - DRUM_SPAWN[2]) / CONVEYOR.speed + 2.5) / DT);

function dropDrum(w: Working): void {
  const c = w.contraptions;
  if (buttonResetLeft('dropper', c, w.frame) > 0) return;
  let drums = c.drums.filter((drum) => findBody(w.bodies, drum.bodyId));
  while (drums.length >= MAX_DROPPED_DRUMS) {
    // The oldest drum that is not lit goes. A yard full of lit drums gets no more.
    const oldest = drums.find((drum) => drum.detonateAt === null);
    if (!oldest) return;
    removeYardBody(w, oldest.bodyId);
    drums = drums.filter((drum) => drum !== oldest);
  }
  const preset = fuelDrumPreset();
  const id = `${FUEL_DRUM.idPrefix}${w.nextSerial}`;
  w.nextSerial += 1;
  // The fall from the belt would damage the drum: it is safe until it has landed.
  const body: YardBody = {
    id, label: FUEL_DRUM.label, dims: preset.dims, voxels: preset.voxels, motion: 'dynamic', buoyancy: 0.3, anchorFaces: [],
    impactCooldownUntil: w.frame + DRUM_DROP_TICKS,
    heat: null,
  };
  w.bodies = [...w.bodies, body];
  addPhysicsBodies(w.physics, [makePhysicsBody(body, { position: DRUM_SPAWN, rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })]);
  w.contraptions = { ...w.contraptions, lastDropFrame: w.frame, drums: [...drums, { bodyId: id, damage: 0, detonateAt: null }] };
}

/** Lit drums whose fuse has run out explode; old explosions leave the state. */
function stepDrums(w: Working): void {
  const due = w.contraptions.drums.filter((drum) => drum.detonateAt !== null && drum.detonateAt <= w.frame);
  for (const drum of due) explodeDrum(w, drum.bodyId);
  w.contraptions = {
    ...w.contraptions,
    drums: w.contraptions.drums.filter((drum) => findBody(w.bodies, drum.bodyId)),
    explosions: w.contraptions.explosions.filter((entry) => w.frame - entry.frame <= EXPLOSION_SHOW_TICKS),
  };
}

/**
 * The drum goes, and the blast reaches BLAST.radius: bodies get a push away
 * from it (impulse × falloff / mass, so light bodies fly further), bodies
 * close to it also break, other drums take damage, and players are thrown.
 */
function explodeDrum(w: Working, id: string): void {
  const physics = physicsBodyById(w.physics, id);
  if (!physics) return;
  const at: Vec3 = [physics.x, physics.y, physics.z];
  removeYardBody(w, id);
  w.contraptions = {
    ...w.contraptions,
    drums: w.contraptions.drums.filter((drum) => drum.bodyId !== id),
    explosions: [...w.contraptions.explosions, { at, radius: BLAST.radius, frame: w.frame }],
  };
  w.stats = { ...w.stats, explosions: w.stats.explosions + 1 };

  for (const body of w.bodies) {
    if (body.motion !== 'dynamic') continue;
    const view = physicsBodyById(w.physics, body.id);
    if (!view) continue;
    const to: Vec3 = [view.x, view.y, view.z];
    // Big bodies feel the blast from their near side, not their center.
    const reach = Math.max(0, Math.hypot(to[0] - at[0], to[1] - at[1], to[2] - at[2]) - Math.hypot(...halfExtents(body.dims)) * 0.5);
    const falloff = blastFalloff(reach);
    if (falloff <= 0) continue;
    if (drumOf(w, body.id)) hurtDrum(w, body.id, BLAST.drumDamage * falloff, null, FUEL_DRUM.chainFuseTicks);
    const mass = w.physics.world.readMotion(physicsBodyHandle(w.physics, body.id)).mass;
    const speed = Math.min(BLAST.maxSpeed, (BLAST.impulse * falloff) / mass);
    const direction = blastDirection(at, to);
    const push = scale(direction, speed * DT);
    // Tumble about the horizontal axis across the push.
    const spin = scale([direction[2], 0, -direction[0]], speed * BLAST.spinPerSpeed * DT);
    setPhysicsBodyMotion(w.physics, body.id, add([view.vx, view.vy, view.vz], push), add([view.angularVel.x, view.angularVel.y, view.angularVel.z], spin));
    if (reach < BLAST.radius * BLAST.shatterShare && !drumOf(w, body.id) && body.id !== 'vehicle-chassis') queueBlastBreak(w, body, at);
  }

  w.players = w.players.map((player) => {
    if (player.ridingVehicle) return player;
    const center: Vec3 = [player.x, player.y + 0.5, player.z];
    const falloff = blastFalloff(Math.hypot(center[0] - at[0], center[1] - at[1], center[2] - at[2]));
    if (falloff <= 0) return player;
    // Player velocity is in m/s (stepPlayerMovement), unlike body views (m/tick).
    const push = scale(blastDirection(at, center), BLAST.playerSpeed * falloff);
    return { ...player, vx: player.vx + push[0], vy: player.vy + push[1], vz: player.vz + push[2], grounded: false };
  });
}

/** Breaks a body near the blast on the side that faces it. */
function queueBlastBreak(w: Working, body: YardBody, at: Vec3): void {
  if (w.fractures.some((pending) => pending.bodyId === body.id)) return;
  const view = physicsBodyById(w.physics, body.id)!;
  const toward = sub([view.x, view.y, view.z], at);
  const distance = Math.hypot(...toward);
  if (distance < 1e-6) return;
  const hit = w.physics.world.raycast({
    x: meters(at[0]), y: meters(at[1]), z: meters(at[2]),
    dx: toward[0] / distance, dy: toward[1] / distance, dz: toward[2] / distance,
    maxDistance: meters(distance + Math.hypot(...halfExtents(body.dims))),
    onlyBody: physicsBodyHandle(w.physics, body.id),
  })[0];
  if (!hit) return;
  const worldPoint: Vec3 = [hit.point.x, hit.point.y, hit.point.z];
  const local = worldToVoxel(body, view, worldPoint);
  w.fractures.push({
    bodyId: body.id,
    countsAsCut: false,
    contact: { start: local, end: local, through: local, throughEnd: local, radius: 2.4, worldPoint, impulseBoost: 2.5 },
  });
}

/** Launches every dynamic body in the catapult bucket at the hoop. */
function fireCatapult(w: Working): void {
  const c = w.contraptions;
  if (buttonResetLeft('catapult', c, w.frame) > 0) return;
  const launched: string[] = [];
  for (const body of w.bodies) {
    if (body.motion !== 'dynamic' || body.id === 'vehicle-chassis') continue;
    const physics = physicsBodyById(w.physics, body.id)!;
    if (!inCatapultBucket([physics.x, physics.y, physics.z])) continue;
    const from: Vec3 = [physics.x, physics.y + CATAPULT.launchLift, physics.z];
    launchPhysicsBody(w.physics, body.id, from, catapultLaunchVelocity(from), [3, 0, 1.5], BALLISTIC_DAMPING);
    launched.push(body.id);
  }
  // A held body leaves the gravity gun when it is launched.
  w.players = w.players.map((player) => (player.grab && launched.includes(player.grab.bodyId) ? { ...player, grab: null } : player));
  w.contraptions = {
    ...c,
    lastLaunchFrame: w.frame,
    ballistic: [
      ...c.ballistic.filter((entry) => !launched.includes(entry.bodyId)),
      ...launched.map((bodyId) => ({ bodyId, until: w.frame + BALLISTIC_TICKS })),
    ],
  };
}

function pressButton(w: Working, button: ButtonId): ToolFeedback {
  switch (button) {
    case 'dropper': dropDrum(w); break;
    case 'catapult': fireCatapult(w); break;
    default: {
      const unreachable: never = button;
      throw new Error(`WRECK_YARD_BUTTON_INVALID: ${String(unreachable)}`);
    }
  }
  return toolFeedback(w, 'press', buttonTop(button));
}

/** After the physics step: count dunks, give landed catapult bodies their damping back, and set off lit drums. */
function stepContraptions(w: Working, before: YardPhysicsWorldState): void {
  stepDrums(w);
  for (const previous of before.bodies) {
    if (previous.kind !== 'dynamic' || !nearHoop([previous.x, previous.y, previous.z])) continue;
    const now = physicsBodyById(w.physics, previous.id);
    if (now && crossedHoop([previous.x, previous.y, previous.z], [now.x, now.y, now.z])) {
      w.stats = { ...w.stats, dunks: w.stats.dunks + 1 };
    }
  }
  const c = w.contraptions;
  if (c.ballistic.some((entry) => entry.until <= w.frame || !findBody(w.bodies, entry.bodyId))) {
    for (const entry of c.ballistic) {
      if (entry.until <= w.frame && findBody(w.bodies, entry.bodyId)) setPhysicsBodyLinearDamping(w.physics, entry.bodyId, LINEAR_DAMPING);
    }
    w.contraptions = { ...c, ballistic: c.ballistic.filter((entry) => entry.until > w.frame && findBody(w.bodies, entry.bodyId)) };
  }
}

/**
 * Advances one tick. `physics` is the live world at `state` (see sim.ts); this
 * steps it in place and returns the next state.
 */
export function stepYard(physics: OpenYardPhysicsWorld, state: YardState, inputs: readonly YardInput[]): YardState {
  const worldFrame = Number(physics.world.info().frame);
  if (worldFrame !== state.world.frame) {
    throw new Error(`WRECK_YARD_WORLD_FRAME_MISMATCH: world ${worldFrame}, state ${state.world.frame}`);
  }
  const w: Working = {
    physics,
    bodies: [...state.bodies],
    players: [...state.players],
    stats: state.stats,
    contraptions: state.contraptions,
    nextSerial: state.nextSerial,
    fractures: [],
    frame: state.frame + 1,
  };

  for (let slot = 0; slot < w.players.length; slot += 1) {
    const input = inputs[slot];
    if (!input) throw new Error(`WRECK_YARD_INPUT_MISSING: slot ${slot}`);
    w.players[slot] = stepPlayer(w, slot, input);
  }

  const driver = w.players.find((player) => player.ridingVehicle);
  const buggy = stepBuggy(w.physics, driver ? inputs[driver.slot]! : undefined, state.buggyVehicle);
  w.physics.world.step();
  const latest = w.physics.world.latest();
  stepContraptions(w, state.world);

  // Sync vehicle riders with the post-step vehicle position
  for (let slot = 0; slot < w.players.length; slot += 1) {
    const p = w.players[slot];
    if (p?.ridingVehicle) {
      const chassis = physicsBodyById(w.physics, 'vehicle-chassis');
      if (chassis) {
        w.players[slot] = {
          ...p,
          x: chassis.x,
          y: chassis.y + 0.28,
          z: chassis.z + 0.12,
          vx: chassis.vx,
          vy: chassis.vy,
          vz: chassis.vz,
        };
      }
    }
  }

  queueDrumHits(w, latest.contacts, state.frame);
  applyFractures(w, state.frame);
  coolBodies(w);

  return {
    frame: state.frame + 1,
    buggyWheels: buggy?.wheels ?? [],
    buggyVehicle: buggy?.vehicle,
    bodies: w.bodies,
    world: readWorldState(w.physics, latest.fluidInteractions),
    players: w.players,
    stats: w.stats,
    contraptions: w.contraptions,
    nextSerial: w.nextSerial,
  };
}
