import type { PhysicsContactEvent3D } from '@series-inc/rundot-syncplay/physics/3d';
import {
  DT,
  FLOOR_Y,
  GRAB_BREAK_DISTANCE,
  GRAB_FLOOR_CLEARANCE,
  GRAVITY_GUN_PUNT_RANGE,
  GRAVITY_GUN_PUNT_SPEED,
  IMPACT_COOLDOWN_TICKS,
  IMPACT_MIN_SPEED,
  JETPACK_FUEL_DRAIN,
  LINEAR_DAMPING,
  JETPACK_FUEL_RECHARGE,
  JETPACK_THRUST_XZ,
  JETPACK_THRUST_Y,
  MAX_RAY_DISTANCE,
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
  CRATE_SPAWN,
  crossedHoop,
  DROP_COOLDOWN_TICKS,
  inCatapultBucket,
  MAX_DROPPED_CRATES,
  nearHoop,
  onConveyor,
  type ButtonId,
} from './contraptions';
import { supplyCratePreset } from './props';
import { stepBuggy } from './vehicle';
import { movePlayer } from './movement';
import { ANGLE_SCALE, decodeRay, TOOL, type YardInput } from './input';
import { advanceHoldPoint, grabServo } from './grab';
import { add, clamp, lerp, rotateInverse, scale, sub, type Vec3 } from './math';
import type { VoxelDims } from 'voxel-kit';
import {
  addPhysicsBodies,
  closeWorld,
  halfExtents,
  voxelStats,
  isShell,
  launchPhysicsBody,
  makePhysicsBody,
  openWorld,
  physicsBodyById,
  physicsBodyName,
  poseOf,
  removePhysicsBody,
  replacePhysicsBody,
  setPhysicsBodyMotion,
  setPhysicsBodyLinearDamping,
  setPhysicsBodyVelocity,
  type OpenYardPhysicsWorld,
  type YardPhysicsWorldState,
  type YardPhysicsBody3D,
} from './physics';
import {
  createInitialPlayer,
  type ContraptionState,
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

function aimRay(w: Working, origin: Vec3, direction: Vec3): AimHit {
  const hits = w.physics.world.raycast({
    x: origin[0], y: origin[1], z: origin[2],
    dx: direction[0], dy: direction[1], dz: direction[2],
    maxDistance: MAX_RAY_DISTANCE,
  });
  const first = hits[0];
  if (!first) return { kind: 'none', point: add(origin, scale(direction, MAX_RAY_DISTANCE)) };
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
    if (!ridingVehicle && !occupied && inRange && input.secondary && !player.wasSecondaryPressed) {
      ridingVehicle = true;
    } else if (ridingVehicle && (input.jetpack || (input.secondary && !player.wasSecondaryPressed))) {
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

  const aim = aimRay(w, ray.origin, ray.direction);
  if (aim.kind !== 'body') {
    // A wall or other static solid throws sparks without cutting; open air shows only the flame.
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
  const initial = w.players[slot] ?? createInitialPlayer(slot);
  // E at a button presses it. It then neither mounts the buggy nor punts.
  const secondaryEdge = input.secondary && !initial.wasSecondaryPressed;
  const button = secondaryEdge && !initial.ridingVehicle ? buttonWithinReach([initial.x, initial.y, initial.z]) : null;
  if (button) {
    const moved = stepPlayerMovement(initial, { ...input, secondary: false }, w);
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
      let worldPoint: Vec3 = [contact.point.x, contact.point.y, contact.point.z];
      let local = worldToVoxel(body, physics, worldPoint);
      // The contact point is shared by both bodies and can sit a few cm off
      // this body's surface. Project it onto this body along the contact
      // normal so the carve lands on its surface.
      if (local.some((v, axis) => v < -1 || v > [body.dims.x, body.dims.y, body.dims.z][axis]!)) {
        const sign = numericId === contact.bodyA ? 1 : -1;
        const outward: Vec3 = [contact.normal.x * sign, contact.normal.y * sign, contact.normal.z * sign];
        const distance = Math.hypot(...halfExtents(body.dims)) + VOXEL_SIZE;
        const hit = w.physics.world.raycast({
          x: physics.x + outward[0] * distance,
          y: physics.y + outward[1] * distance,
          z: physics.z + outward[2] * distance,
          dx: -outward[0], dy: -outward[1], dz: -outward[2],
          maxDistance: distance * 2,
        }).find((entry) => entry.bodyId === numericId);
        if (!hit) continue;
        worldPoint = [hit.point.x, hit.point.y, hit.point.z];
        local = worldToVoxel(body, physics, worldPoint);
      }
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
    const remaining = result.fragments.reduce((sum, fragment) => sum + voxelStats(fragment.body.voxels).occupiedCount, 0);
    if (remaining >= voxelStats(source.voxels).occupiedCount) continue;
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

/** Ticks from a crate's spawn until it has left the belt and landed. */
const CRATE_DROP_TICKS = Math.ceil(((CONVEYOR.zEnd - CRATE_SPAWN[2]) / CONVEYOR.speed + 1.5) / DT);

function dropCrate(w: Working): void {
  const c = w.contraptions;
  if (w.frame - c.lastDropFrame < DROP_COOLDOWN_TICKS) return;
  let crates = c.droppedCrates.filter((id) => findBody(w.bodies, id));
  while (crates.length >= MAX_DROPPED_CRATES) {
    removeYardBody(w, crates[0]!);
    crates = crates.slice(1);
  }
  const preset = supplyCratePreset();
  const id = `supply-crate-${w.nextSerial}`;
  w.nextSerial += 1;
  // The fall from the belt is faster than IMPACT_MIN_SPEED: the crate may not break on landing.
  const body: YardBody = {
    id, label: 'Supply Crate', dims: preset.dims, voxels: preset.voxels, motion: 'dynamic', buoyancy: 0.3, anchorFaces: [],
    impactCooldownUntil: w.frame + CRATE_DROP_TICKS,
  };
  w.bodies = [...w.bodies, body];
  addPhysicsBodies(w.physics, [makePhysicsBody(body, { position: CRATE_SPAWN, rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] })]);
  w.contraptions = { ...c, lastDropFrame: w.frame, droppedCrates: [...crates, id] };
}

/** Launches every dynamic body in the catapult bucket at the hoop. */
function fireCatapult(w: Working): void {
  const c = w.contraptions;
  if (w.frame - c.lastLaunchFrame < CATAPULT.cooldownTicks) return;
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
    case 'dropper': dropCrate(w); break;
    case 'catapult': fireCatapult(w); break;
    default: {
      const unreachable: never = button;
      throw new Error(`WRECK_YARD_BUTTON_INVALID: ${String(unreachable)}`);
    }
  }
  return toolFeedback(w, 'press', buttonTop(button));
}

/** Before the physics step: bodies resting on the belt move at the belt speed. */
function stepConveyor(w: Working, before: YardPhysicsWorldState): void {
  for (const previous of before.bodies) {
    if (previous.kind !== 'dynamic' || !onConveyor([previous.x, previous.y, previous.z])) continue;
    const now = physicsBodyById(w.physics, previous.id);
    if (now) setPhysicsBodyVelocity(w.physics, previous.id, [now.vx * 0.5, now.vy, CONVEYOR.speed * DT]);
  }
}

/** After the physics step: count dunks, and give landed catapult bodies their damping back. */
function stepContraptions(w: Working, before: YardPhysicsWorldState): void {
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

export function stepYard(state: YardState, inputs: readonly YardInput[]): YardState {
  const physics = openWorld(state.world);
  let disposed = false;
  try {
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
    const buggyWheels = stepBuggy(w.physics, driver ? inputs[driver.slot]! : undefined, state.buggyWheels);
    stepConveyor(w, state.world);
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

    queueImpacts(w, latest.contacts, state.frame);
    applyFractures(w, state.frame);

    disposed = true;
    const nextWorld = closeWorld(w.physics, latest.fluidInteractions);
    return {
      frame: state.frame + 1,
      buggyWheels,
      bodies: w.bodies,
      world: nextWorld,
      players: w.players,
      stats: w.stats,
      contraptions: w.contraptions,
      nextSerial: w.nextSerial,
    };
  } finally {
    if (!disposed) physics.world.dispose();
  }
}
