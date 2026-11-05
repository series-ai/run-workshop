import type { AttractionState } from './attractions';
import type { KinetixSeatState } from '@series-inc/rundot-syncplay/core/runtime';
import { applyPlayerSeats } from './playerSeats';
import { applyAttractionRequests, startElevatorStep, finishElevatorStep } from './storageRuntime';
import { meters, type PhysicsContactData3D } from '@series-inc/rundot-syncplay/physics/3d';
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
  JETPACK_FUEL_RECHARGE,
  JETPACK_THRUST_XZ,
  JETPACK_THRUST_Y,
  MAX_RAY_DISTANCE,
  TORCH_RANGE,
  PLAYER_EYE_OFFSET,
  PLAYER_GRAVITY,
  PLAYER_MOVE_SPEED,
  SHELL_PREFIX,
  THROW_BOOST,
  withinBuggyMountRange,
  TORCH_INSET,
  TORCH_PULSE_TICKS,
  TORCH_RADIUS,
  TORCH_MAX_STROKE,
  VOXEL_SIZE,
} from './constants';
import { WORLD_CATEGORY } from './cage';
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
import { waterEntry } from './water';
import { BLAST, blastDirection, blastFalloff, damageDrum, dentVoxels, EXPLOSION_SHOW_TICKS, FUEL_DRUM, hitDamage, scorchVoxels } from './fuelDrum';
import { fuelDrumPreset } from './props';
import { damageLamp, FLOODLIGHT, FLOODLIGHT_LENSES, floodlightLensByKey, lampHitDamage, lampsToRelight, LAMP_SHOW_TICKS, LIGHTS_OUT_TICKS, REPAIR_TICKS, wholeLamp } from './floodlights';
import { breakCrate, CRATE_BREAK, CRATE_BREAK_SHOW_TICKS, isBreakableCrate } from './crateBreak';
import { collectImpacts, keepImpacts, stepContacts } from './impacts';
import { SHELL_BOXES, shellBoxQuaternion } from './shell';
import type { ShellBox } from './setPieces';
import { stepBuggy } from './vehicle';
import { movePlayer } from './movement';
import { toolPortalBlock } from './returns';
import { ANGLE_SCALE, decodeRay, TOOL, type YardInput } from './input';
import { advanceHoldPoint, grabServo } from './grab';
import { add, clamp, lerp, rotateInverse, scale, sub, type Vec3 } from './math';
import {
  addPhysicsBodies,
  halfExtents,
  voxelStats,
  isShell,
  launchPhysicsBody,
  makePhysicsBody,
  physicsBodyById,
  physicsBodyHandle,
  bodyNameOf,
  poseOf,
  removePhysicsBody,
  replacePhysicsBody,
  setPhysicsBodyMotion,
  shellBody,
  setPhysicsBodyLinearDamping,
  bodyLinearDamping,
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
  type GrabState,
  type PlayerState,
  type PlayerTool,
  type YardBody,
  type YardState,
  type YardStats,
  type ToolFeedback,
  type ToolResult,
} from './state';
import { beginPhase, endPhase, perfActive, perfCount } from '../perf/recorder';

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
  attractions: AttractionState;
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

/** The first body, solid, or open aperture along the tool ray. */
type AimHit =
  | { readonly kind: 'body'; readonly body: YardBody; readonly hit: Hit }
  | { readonly kind: 'solid'; readonly point: Vec3 }
  | { readonly kind: 'portal'; readonly point: Vec3 }
  | { readonly kind: 'none'; readonly point: Vec3 };

function aimRay(w: Working, origin: Vec3, direction: Vec3, maxDistance = MAX_RAY_DISTANCE): AimHit {
  const end = add(origin, scale(direction, maxDistance));
  const portal = toolPortalBlock(w.physics.world, origin, end);
  if (portal && portal.distance <= 1e-5) return { kind: 'portal', point: portal.point };
  const hits = w.physics.world.raycast({
    x: meters(origin[0]), y: meters(origin[1]), z: meters(origin[2]),
    dx: direction[0], dy: direction[1], dz: direction[2],
    maxDistance: meters(portal?.distance ?? maxDistance),
    maxPortalDepth: 0,
    filter: { maskBits: WORLD_CATEGORY },
  });
  const first = hits[0];
  if (portal && (!first || first.distance >= portal.distance)) return { kind: 'portal', point: portal.point };
  if (!first) return { kind: 'none', point: end };
  const point: Vec3 = [first.point.x, first.point.y, first.point.z];
  const bodyId = bodyNameOf(first.bodyKey);
  const body = isShell(bodyId) ? undefined : findBody(w.bodies, bodyId);
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
    const occupied = w.players.some((other) => other.active && other.slot !== player.slot && other.ridingVehicle);
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
    portalTeleports: (player.portalTeleports + (moved.portalCrossed ? 1 : 0)) >>> 0,
    grab: moved.portalCrossed ? null : player.grab,
    torch: moved.portalCrossed ? null : player.torch,
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


function grabAim(body: YardBody, ray: { origin: Vec3; direction: Vec3 }, distance: number): Vec3 {
  const aim = add(ray.origin, scale(ray.direction, distance));
  const floorY = FLOOR_Y + halfExtents(body.dims)[1] + GRAB_FLOOR_CLEARANCE;
  return [aim[0], Math.max(aim[1], floorY), aim[2]];
}

function grabPortalBlock(w: Working, ray: { origin: Vec3; direction: Vec3 }, grab: GrabState, includeAim: boolean) {
  const held = physicsBodyById(w.physics, grab.bodyId)!;
  return toolPortalBlock(w.physics.world, ray.origin, [held.x, held.y, held.z])
    ?? (includeAim ? toolPortalBlock(w.physics.world, ray.origin, grabAim(findBody(w.bodies, grab.bodyId)!, ray, grab.distance)) : null);
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

  if (input.drop) {
    return { ...player, grab: null, torch: null, torchTicks: 0,
      wasPressed: input.pressed, wasSecondaryPressed: input.secondary };
  }

  if (grab) {
    const portal = grabPortalBlock(w, ray, grab, input.pressed);
    if (portal) {
      return { ...player, grab: null, torch: null, torchTicks: 0,
        wasPressed: input.pressed, wasSecondaryPressed: input.secondary,
        feedback: toolFeedback(w, 'blocked', portal.point) };
    }
  }

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
      const distance = clamp(aim.hit.distance, 2.5, 6.0);
      const portal = toolPortalBlock(w.physics.world, ray.origin, add(ray.origin, scale(ray.direction, distance)));
      grab = {
        bodyId: aim.body.id,
        distance: portal ? Math.max(0, portal.distance - 0.01) : distance,
        target: [physics.x, physics.y, physics.z],
        targetVelocity: [0, 0, 0],
      };
      const blocked = grabPortalBlock(w, ray, grab, true);
      if (blocked) {
        grab = null;
        feedback = toolFeedback(w, 'blocked', blocked.point);
      } else {
        feedback = toolFeedback(w, 'grab', aim.hit.point);
      }
    } else {
      const button = aim.kind === 'solid' ? buttonAt(aim.point) : null;
      feedback = button ? pressButton(w, button) : refusal(w, aim);
    }
  }

  if (grab && input.pressed) {
    const body = findBody(w.bodies, grab.bodyId)!;
    const hold = advanceHoldPoint({ point: grab.target, velocity: grab.targetVelocity }, grabAim(body, ray, grab.distance));
    const portal = toolPortalBlock(w.physics.world, ray.origin, hold.point);
    if (portal) {
      grab = null;
      feedback = toolFeedback(w, 'blocked', portal.point);
    } else {
      const physics = physicsBodyById(w.physics, grab.bodyId)!;
      const position: Vec3 = [physics.x, physics.y, physics.z];
      const gap = sub(hold.point, position);
      if (gap[0] * gap[0] + gap[1] * gap[1] + gap[2] * gap[2] > GRAB_BREAK_DISTANCE * GRAB_BREAK_DISTANCE) {
        // Release a body that stays too far from the hold point.
        grab = null;
      } else {
        const applied = grabServo(w.physics.world, physicsBodyHandle(w.physics, grab.bodyId), hold);
        grab = applied ? { ...grab, target: hold.point, targetVelocity: hold.velocity } : null;
      }
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

  // Water puts the flame out: it reaches only to the water surface, and not at all under water.
  const water = waterEntry(ray.origin, ray.direction, TORCH_RANGE);
  const aim: AimHit = water === 0
    ? { kind: 'none', point: ray.origin }
    : aimRay(w, ray.origin, ray.direction, water ?? TORCH_RANGE);
  if (aim.kind === 'none' && water !== null) {
    return {
      ...player,
      grab: null,
      torch: null,
      torchTicks: 0,
      wasPressed: true,
      wasSecondaryPressed: input.secondary,
      feedback: toolFeedback(w, 'quench', aim.point),
    };
  }
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
      feedback: toolFeedback(w, aim.kind === 'none' ? 'miss' : 'scorch', aim.point),
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
  const previous = sameBody ? player.torch!.prev : point;
  const delta = sub(point, previous);
  const prev = Math.hypot(...delta) <= TORCH_MAX_STROKE ? previous : point;
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
    w.fractures.push({
      bodyId: body.id,
      countsAsCut: true,
      contact: {
        start: prev,
        end: point,
        through: prev,
        throughEnd: point,
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
function contactOnBody(w: Working, body: YardBody, numericId: PhysicsContactData3D['bodyA'], contact: PhysicsContactData3D): { local: Vec3; worldPoint: Vec3 } | null {
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
function queueDrumHits(w: Working, contacts: readonly PhysicsContactData3D[], frame: number): void {
  for (const contact of contacts) {
    const speed = contact.approachSpeed;
    if (speed < FUEL_DRUM.minHitSpeed) continue;
    for (const [numericId, key] of [[contact.bodyA, contact.bodyKeyA], [contact.bodyB, contact.bodyKeyB]] as const) {
      const id = bodyNameOf(key);
      if (!drumOf(w, id)) continue;
      const body = findBody(w.bodies, id);
      if (!body || frame < body.impactCooldownUntil) continue;
      const damage = hitDamage(speed);
      if (damage <= 0) continue;
      hurtDrum(w, id, damage, contactOnBody(w, body, numericId, contact)?.local ?? null);
      setImpactCooldown(w, id, frame);
    }
  }
}

/**
 * Hits from yard bodies damage the floodlight lenses. A lamp that takes damage
 * flickers. A lens at full damage breaks: it leaves the physics world, and the
 * state records the smash for the render and the sound.
 */
function hitFloodlights(w: Working, contacts: readonly PhysicsContactData3D[], frame: number): void {
  for (const contact of contacts) {
    if (contact.approachSpeed < FLOODLIGHT.minHitSpeed) continue;
    const keys = [contact.bodyKeyA, contact.bodyKeyB];
    const lensKey = keys.find((key) => floodlightLensByKey(key) !== undefined);
    const lens = floodlightLensByKey(lensKey);
    if (!lens) continue;
    const hitter = keys.some((key) => key !== undefined && key !== lensKey && findBody(w.bodies, bodyNameOf(key)) !== undefined);
    if (hitter) hurtLamp(w, lens.lampId, lampHitDamage(contact.approachSpeed), frame);
  }
}

/** Adds damage to one lamp. A lamp that breaks leaves the world; the fourth one starts lights out. */
function hurtLamp(w: Working, lampId: string, damage: number, frame: number): void {
  const lamp = w.contraptions.lamps.find((entry) => entry.lampId === lampId);
  if (!lamp) throw new Error(`WRECK_YARD_LAMP_UNKNOWN: ${lampId}`);
  const next = damageLamp(lamp, damage, frame);
  if (next === lamp) return;
  const lamps = w.contraptions.lamps.map((entry) => (entry.lampId === lampId ? next : entry));
  if (next.brokenAt === null) {
    w.contraptions = { ...w.contraptions, lamps };
    return;
  }
  const lens = FLOODLIGHT_LENSES.find((entry) => entry.lampId === lampId)!;
  removePhysicsBody(w.physics, `${SHELL_PREFIX}${lampId}`);
  const allOut = lamps.every((entry) => entry.brokenAt !== null);
  w.contraptions = {
    ...w.contraptions,
    lamps,
    lampSmashes: [...w.contraptions.lampSmashes, { lampId, at: lens.at, frame }],
    lightsOutUntil: allOut && w.contraptions.lightsOutUntil === null ? frame + LIGHTS_OUT_TICKS : w.contraptions.lightsOutUntil,
  };
  w.stats = { ...w.stats, lampsSmashed: w.stats.lampsSmashed + 1 };
}

/** True while a yard body is inside the space of a lens: the lens must not come back on top of it. */
function lensSpaceTaken(w: Working, box: ShellBox): boolean {
  const [qx, qy, qz, qw] = shellBoxQuaternion(box);
  const hits = w.physics.world.overlap({
    x: meters(box.center[0]), y: meters(box.center[1]), z: meters(box.center[2]),
    shape: { type: 'box', halfX: meters(box.size[0] / 2), halfY: meters(box.size[1] / 2), halfZ: meters(box.size[2] / 2) },
    orientation: { x: qx, y: qy, z: qz, w: qw },
    hitTriggers: false, hitSensors: false,
  });
  return hits.some((hit) => hit.bodyKey !== undefined && findBody(w.bodies, hit.bodyKey) !== undefined);
}

/**
 * Broken lamps come back: one at a time after REPAIR_TICKS, or all four when
 * lights out ends. A lamp with a body in its lens space waits for a later tick.
 * Lights out ends when the last lamp is back.
 */
function relightFloodlights(w: Working, frame: number): void {
  const boxes = lampsToRelight(w.contraptions, frame).map((lampId) => {
    const box = SHELL_BOXES.find((entry) => entry.id === lampId);
    if (!box) throw new Error(`WRECK_YARD_LAMP_SHELL_MISSING: ${lampId}`);
    return box;
  }).filter((box) => !lensSpaceTaken(w, box));
  if (boxes.length === 0 && !(w.contraptions.lightsOutUntil !== null && frame >= w.contraptions.lightsOutUntil)) return;
  addPhysicsBodies(w.physics, boxes.map(shellBody));
  const ids = boxes.map((box) => box.id);
  const lightsOutEnds = w.contraptions.lightsOutUntil !== null && frame >= w.contraptions.lightsOutUntil;
  const lamps = w.contraptions.lamps.map((lamp) => {
    // A lamp that comes back flickers on, as after a hit.
    if (ids.includes(lamp.lampId)) return { ...wholeLamp(lamp.lampId), flickerFrame: frame };
    // Lights out always ends on time. A lamp that a body still blocks is due for repair now,
    // so it tries again on each tick until its space is free.
    if (lightsOutEnds && lamp.brokenAt !== null) return { ...lamp, brokenAt: Math.min(lamp.brokenAt, frame - REPAIR_TICKS) };
    return lamp;
  });
  // relitFrame moves only when a lamp comes back: it starts the relamp sound.
  w.contraptions = { ...w.contraptions, lamps, lightsOutUntil: null, relitFrame: ids.length > 0 ? frame : w.contraptions.relitFrame };
}

/**
 * FRAGILE crates: a hard hit splits a whole storage crate into four pieces
 * (sim/crateBreak.ts). At most CRATE_BREAK.maxPerTick crates break in one tick,
 * and none break while the world is near its body budget.
 */
function breakCrates(w: Working, contacts: readonly PhysicsContactData3D[], frame: number): void {
  let broken = 0;
  for (const contact of contacts) {
    if (broken >= CRATE_BREAK.maxPerTick) return;
    if (contact.approachSpeed < CRATE_BREAK.speed) continue;
    for (const key of [contact.bodyKeyA, contact.bodyKeyB]) {
      if (broken >= CRATE_BREAK.maxPerTick || w.physics.bodyIds.size >= CRATE_BREAK.bodyBudget) return;
      const body = key === undefined ? undefined : findBody(w.bodies, bodyNameOf(key));
      const view = body ? physicsBodyById(w.physics, body.id) : undefined;
      if (!body || !view || !isBreakableCrate(body) || w.fractures.some((pending) => pending.bodyId === body.id)) continue;
      const at: Vec3 = [contact.point.x, contact.point.y, contact.point.z];
      const result = breakCrate(body, poseOf(view), worldToVoxel(body, view, at), w.nextSerial, frame);
      w.contraptions = { ...w.contraptions, crateBreaks: [...w.contraptions.crateBreaks, { crateId: body.id, at, frame }] };
      w.nextSerial = result.nextSerial;
      const index = w.bodies.findIndex((entry) => entry.id === body.id);
      w.bodies = [...w.bodies.slice(0, index), ...result.fragments.map((fragment) => fragment.body), ...w.bodies.slice(index + 1)];
      removePhysicsBody(w.physics, body.id);
      addPhysicsBodies(w.physics, result.fragments.map((fragment) => fragment.physics));
      w.stats = { ...w.stats, fractures: w.stats.fractures + 1 };
      w.players = w.players.map((player) => ({
        ...player,
        grab: player.grab?.bodyId === body.id ? null : player.grab,
        torch: player.torch?.bodyId === body.id ? null : player.torch,
      }));
      broken += 1;
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
  const ids = new Set(near.map((hit) => bodyNameOf(hit.bodyKey)));
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
    const sourceCount = voxelStats(source.voxels).occupiedCount;
    if (remaining >= sourceCount) {
      // Nothing left to carve here, but a held torch keeps the spot hot.
      const at = scale(add(pending.contact.start, pending.contact.end), 0.5);
      w.bodies = w.bodies.map((entry) => (entry.id === pending.bodyId ? { ...entry, heat: { frame, at } } : entry));
      continue;
    }
    perfCount('fracture.removedVoxels', sourceCount - remaining);
    perfCount('fracture.fragments', result.fragments.length);
    const editStart = beginPhase('fracture.edit');
    w.nextSerial = result.nextSerial;
    const index = w.bodies.findIndex((entry) => entry.id === pending.bodyId);
    w.bodies = [...w.bodies.slice(0, index), ...result.fragments.map((fragment) => fragment.body), ...w.bodies.slice(index + 1)];
    const replacing = result.fragments.find((fragment) => fragment.body.id === pending.bodyId);
    const added = result.fragments.filter((fragment) => fragment.body.id !== pending.bodyId);
    if (replacing) replacePhysicsBody(w.physics, replacing.physics);
    else removePhysicsBody(w.physics, pending.bodyId);
    addPhysicsBodies(w.physics, added.map((fragment) => fragment.physics));
    endPhase('fracture.edit', editStart);
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
    id, label: FUEL_DRUM.label, material: 'steel', dims: preset.dims, voxels: preset.voxels, motion: 'dynamic', buoyancy: 0.3, anchorFaces: [],
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
    lampSmashes: w.contraptions.lampSmashes.filter((entry) => w.frame - entry.frame <= LAMP_SHOW_TICKS),
    crateBreaks: w.contraptions.crateBreaks.filter((entry) => w.frame - entry.frame <= CRATE_BREAK_SHOW_TICKS),
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

  // The blast reaches the lamps too: a close one breaks a lens, and a far one makes it flicker.
  // Lamp frames use the frame that the step starts from, as hits do (w.frame is the next frame).
  for (const lens of FLOODLIGHT_LENSES) {
    const falloff = blastFalloff(Math.hypot(lens.at[0] - at[0], lens.at[1] - at[1], lens.at[2] - at[2]));
    if (falloff > 0) hurtLamp(w, lens.lampId, FLOODLIGHT.blastDamage * falloff, w.frame - 1);
  }

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
    if (!player.active || player.ridingVehicle) return player;
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
      // The body gets its own damping back: a loose tire keeps its lower damping (physics.ts bodyLinearDamping).
      const landed = entry.until <= w.frame ? findBody(w.bodies, entry.bodyId) : undefined;
      if (landed) setPhysicsBodyLinearDamping(w.physics, entry.bodyId, bodyLinearDamping(landed));
    }
    w.contraptions = { ...c, ballistic: c.ballistic.filter((entry) => entry.until > w.frame && findBody(w.bodies, entry.bodyId)) };
  }
}

/**
 * Advances one tick. `physics` is the live world at `state` (see sim.ts); this
 * steps it in place and returns the next state.
 */
export function stepYard(physics: OpenYardPhysicsWorld, state: YardState, inputs: readonly YardInput[], seats: readonly KinetixSeatState[] = []): YardState {
  let phaseStart = beginPhase('sim.gameBefore');
  const worldFrame = Number(physics.world.info().frame);
  if (worldFrame !== state.world.frame) {
    throw new Error(`WRECK_YARD_WORLD_FRAME_MISMATCH: world ${worldFrame}, state ${state.world.frame}`);
  }
  const w: Working = {
    physics,
    bodies: [...state.bodies],
    players: [...applyPlayerSeats(state.players, seats)],
    stats: state.stats,
    contraptions: state.contraptions,
    attractions: state.attractions,
    nextSerial: state.nextSerial,
    fractures: [],
    frame: state.frame + 1,
  };

  for (let slot = 0; slot < w.players.length; slot++) {
    if (!inputs[slot]) throw new Error(`WRECK_YARD_INPUT_MISSING: slot ${slot}`);
  }
  const requested = applyAttractionRequests(w.physics, w.attractions, w.bodies, w.players, inputs, w.frame);
  w.bodies = requested.bodies;
  w.attractions = requested.attractions;

  const playersStart = beginPhase('sim.players');
  for (let slot = 0; slot < w.players.length; slot += 1) {
    if (!w.players[slot]!.active) continue;
    const input = inputs[slot];
    if (!input) throw new Error(`WRECK_YARD_INPUT_MISSING: slot ${slot}`);
    w.players[slot] = stepPlayer(w, slot, input);
  }

  endPhase('sim.players', playersStart);
  const driver = w.players.find((player) => player.active && player.ridingVehicle);
  const buggy = stepBuggy(w.physics, driver ? inputs[driver.slot]! : undefined, state.buggyVehicle);
  w.attractions = startElevatorStep(w.physics, w.attractions, w.players);
  endPhase('sim.gameBefore', phaseStart);
  phaseStart = beginPhase('sim.nativeStep');
  const stepStart = beginPhase('sim.physicsStep');
  w.physics.world.step();
  endPhase('sim.physicsStep', stepStart);
  const latestStart = beginPhase('sim.physicsLatest');
  const latest = w.physics.world.latest();
  endPhase('sim.physicsLatest', latestStart);
  const contacts = stepContacts(latest.contactEvents);
  perfCount('sim.contacts', contacts.touching.length);
  endPhase('sim.nativeStep', phaseStart);
  phaseStart = beginPhase('sim.gameAfter');
  w.attractions = finishElevatorStep(w.physics, w.attractions, w.players);
  stepContraptions(w, state.world);

  // Release teleported holds and move riders to the post-step chassis position.
  for (let slot = 0; slot < w.players.length; slot += 1) {
    const p = w.players[slot];
    if (!p?.active) continue;
    if (p?.grab) {
      const heldId = w.physics.bodyIds.get(p.grab.bodyId);
      const crossing = latest.portalCrossings?.find((entry) => entry.bodyId === heldId);
      if (crossing) {
        const pair = w.physics.world.portalPairs?.find((entry) => entry.id === crossing.portalId);
        const end = crossing.enteredEnd === 'A' ? pair?.portalA : pair?.portalB;
        w.players[slot] = { ...p, grab: null,
          feedback: end ? toolFeedback(w, 'blocked', [end.position.x, end.position.y, end.position.z]) : p.feedback };
      }
    }
    if (p?.ridingVehicle) {
      const chassis = physicsBodyById(w.physics, 'vehicle-chassis');
      if (chassis) {
        w.players[slot] = {
          ...p,
          portalTeleports: (p.portalTeleports + (latest.portalCrossings?.some((crossing) => crossing.bodyId === w.physics.bodyIds.get('vehicle-chassis')) ? 1 : 0)) >>> 0,
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

  // Impacts name the bodies as the contacts saw them, before any of them breaks this tick.
  const impactsStart = beginPhase('sim.impacts');
  const impacts = collectImpacts(contacts.began, (key) => (key === undefined ? undefined : findBody(w.bodies, key)), state.frame);
  queueDrumHits(w, contacts.began, state.frame);
  hitFloodlights(w, contacts.began, state.frame);
  relightFloodlights(w, state.frame);
  endPhase('sim.impacts', impactsStart);
  perfCount('sim.impacts', impacts.length);
  let workStart = beginPhase('sim.crateBreak');
  breakCrates(w, contacts.touching, state.frame);
  endPhase('sim.crateBreak', workStart);
  if (perfActive()) perfCount('torch.pendingCuts', w.fractures.reduce((sum, entry) => sum + Number(entry.countsAsCut), 0));
  const cutsBefore = w.stats.torchCuts;
  workStart = beginPhase('sim.fractures');
  applyFractures(w, state.frame);
  endPhase('sim.fractures', workStart);
  perfCount('torch.cuts', w.stats.torchCuts - cutsBefore);
  workStart = beginPhase('sim.cooling');
  coolBodies(w);
  endPhase('sim.cooling', workStart);
  if (perfActive()) perfCount('sim.hotBodies', w.bodies.reduce((sum, body) => sum + Number(body.heat !== null), 0));
  const readStart = beginPhase('sim.worldRead');
  const world = readWorldState(w.physics, latest.fluidInteractions, latest);
  endPhase('sim.worldRead', readStart);

  const nextState: YardState = {
    frame: state.frame + 1,
    buggyWheels: buggy?.wheels ?? [],
    buggyVehicle: buggy?.vehicle,
    bodies: w.bodies,
    world,
    players: w.players,
    stats: w.stats,
    contraptions: w.contraptions,
    impacts: keepImpacts(state.impacts, impacts, state.frame),
    attractions: w.attractions,
    nextSerial: w.nextSerial,
  };
  endPhase('sim.gameAfter', phaseStart);
  return nextState;
}
