import { meters, type PhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d';
import type { PortalRenderEnd3D, PortalRenderPair3D } from '@series-inc/rundot-syncplay/physics/3d';
import { FLOOR_Y } from './constants';
import type { Vec3 } from './math';
import type { ShellBox } from './setPieces';

export const RETURNS_PAIR_ID = 1;
export const RETURNS_OPENING = { width: 5, height: 4.4 } as const;

const DOOR_Y = FLOOR_Y + 2.2;
export const RETURNS_FRAME = {
  parts: [
    { id: 'left-jamb', center: [-2.65, 0, 0] as const, size: [0.3, 4.9, 0.45] as const },
    { id: 'right-jamb', center: [2.65, 0, 0] as const, size: [0.3, 4.9, 0.45] as const },
    { id: 'header', center: [0, 2.35, 0] as const, size: [5.6, 0.3, 0.45] as const },
  ],
} as const;

/** One source for physics, visible views, and the player crossing transform. */
export const RETURNS_PAIR = {
  id: RETURNS_PAIR_ID,
  open: true,
  portalA: {
    position: { x: -2, y: DOOR_Y, z: 20 },
    rotation: { x: 0, y: 1, z: 0, w: 0 },
    opening: RETURNS_OPENING,
  },
  portalB: {
    position: { x: 7, y: DOOR_Y, z: -21 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    opening: RETURNS_OPENING,
  },
} as const satisfies PortalRenderPair3D;

function yawOf(end: PortalRenderEnd3D): number {
  return 2 * Math.atan2(end.rotation.y, end.rotation.w);
}

function worldCenter(end: PortalRenderEnd3D, local: readonly [number, number, number]): [number, number, number] {
  const yaw = yawOf(end);
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [
    end.position.x + cosine * local[0] + sine * local[2],
    end.position.y + local[1],
    end.position.z - sine * local[0] + cosine * local[2],
  ];
}

function frameSolids(end: PortalRenderEnd3D, label: string): ShellBox[] {
  const yaw = yawOf(end);
  return RETURNS_FRAME.parts.map((part) => ({
    id: `returns-${label}-${part.id}`,
    center: worldCenter(end, part.center),
    size: [...part.size] as [number, number, number],
    rotation: [0, yaw, 0],
  } as ShellBox));
}

export const RETURNS_SOLIDS: readonly ShellBox[] = Object.freeze([
  ...frameSolids(RETURNS_PAIR.portalA, 'delivery'),
  ...frameSolids(RETURNS_PAIR.portalB, 'returns'),
]);

function sameEnd(
  actual: { readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly rotation: { readonly x: number; readonly y: number; readonly z: number; readonly w: number }; readonly opening: { readonly width: number; readonly height: number } },
  expected: PortalRenderEnd3D,
): boolean {
  return actual.position.x === expected.position.x
    && actual.position.y === expected.position.y
    && actual.position.z === expected.position.z
    && actual.rotation.x === expected.rotation.x
    && actual.rotation.y === expected.rotation.y
    && actual.rotation.z === expected.rotation.z
    && actual.rotation.w === expected.rotation.w
    && actual.opening.width === expected.opening.width
    && actual.opening.height === expected.opening.height;
}

/** Adds the fixed pair once. Returns throw if another pair took id 1. */
export function createReturnsPair(world: PhysicsWorld3D): void {
  const pairs = world.portalPairs ?? [];
  const existing = pairs.find((pair) => pair.id === RETURNS_PAIR_ID);
  if (existing) {
    if (!sameEnd(existing.portalA, RETURNS_PAIR.portalA) || !sameEnd(existing.portalB, RETURNS_PAIR.portalB)) {
      throw new Error('WRECK_YARD_RETURNS_PAIR_ID_CONFLICT');
    }
    return;
  }
  if (pairs.length > 0) throw new Error('WRECK_YARD_RETURNS_PAIR_MUST_BE_FIRST');
  world.edit((ops) => ops.createPortalPair({
    portalA: RETURNS_PAIR.portalA,
    portalB: RETURNS_PAIR.portalB,
    open: RETURNS_PAIR.open,
  }));
}

const PLAYER_RADIUS = 0.4;
const PLAYER_HALF_HEIGHT = 0.5;
const PLAYER_CAPSULE = {
  type: 'capsule',
  radius: meters(PLAYER_RADIUS),
  halfHeight: meters(PLAYER_HALF_HEIGHT),
} as const;
const EXIT_CHECK = { hitTriggers: false, hitSensors: false, maxPortalDepth: 0 } as const;
const PLANE_EPSILON = 1e-5;
const OPENING_CLEARANCE = 0.02;
const EXIT_CAST_DISTANCE = 0.45;
const FLOOR_CONTACT_TOLERANCE = 0.02;

function signedDistance(end: PortalRenderEnd3D, point: Vec3): number {
  const yaw = yawOf(end);
  const normalX = Math.sin(yaw);
  const normalZ = Math.cos(yaw);
  return normalX * (point[0] - end.position.x)
    + normalZ * (point[2] - end.position.z);
}

function pointAtPlane(before: Vec3, after: Vec3, startDistance: number, endDistance: number): Vec3 | null {
  if (startDistance < -PLANE_EPSILON || endDistance >= -PLANE_EPSILON) return null;
  const fraction = startDistance / (startDistance - endDistance);
  return [
    before[0] + (after[0] - before[0]) * fraction,
    before[1] + (after[1] - before[1]) * fraction,
    before[2] + (after[2] - before[2]) * fraction,
  ];
}

function fitsOpening(end: PortalRenderEnd3D, point: Vec3): boolean {
  const yaw = yawOf(end);
  const dx = point[0] - end.position.x;
  const dz = point[2] - end.position.z;
  const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  const halfHeight = PLAYER_RADIUS + PLAYER_HALF_HEIGHT;
  return Math.abs(localX) <= RETURNS_OPENING.width * 0.5 - PLAYER_RADIUS + OPENING_CLEARANCE
    && Math.abs(point[1] - end.position.y) <= RETURNS_OPENING.height * 0.5 - halfHeight + OPENING_CLEARANCE;
}

function blockedAtEntry(end: PortalRenderEnd3D, point: Vec3, velocity: Vec3): { readonly position: Vec3; readonly velocity: Vec3; readonly grounded: false } {
  const yaw = yawOf(end);
  const normal: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  const normalSpeed = velocity[0] * normal[0] + velocity[2] * normal[2];
  const enteringSpeed = Math.min(normalSpeed, 0);
  return {
    position: [
      point[0] + normal[0] * (PLAYER_RADIUS + 0.005),
      point[1],
      point[2] + normal[2] * (PLAYER_RADIUS + 0.005),
    ],
    velocity: [
      velocity[0] - normal[0] * enteringSpeed,
      velocity[1],
      velocity[2] - normal[2] * enteringSpeed,
    ],
    grounded: false,
  };
}

function isFloorContact(
  hit: { readonly normal: { readonly y: number }; readonly point: { readonly y: number } },
  position: Vec3,
): boolean {
  const capsuleBottom = position[1] - PLAYER_RADIUS - PLAYER_HALF_HEIGHT;
  return hit.normal.y > 0.5
    && Math.abs(hit.point.y - FLOOR_Y) <= FLOOR_CONTACT_TOLERANCE
    && capsuleBottom >= FLOOR_Y - FLOOR_CONTACT_TOLERANCE;
}

function hasExitBlock(world: PhysicsWorld3D, position: Vec3, travel: Vec3): boolean {
  const overlapping = world.overlap({
    ...EXIT_CHECK,
    shape: PLAYER_CAPSULE,
    x: meters(position[0]),
    y: meters(position[1]),
    z: meters(position[2]),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  });
  if (overlapping.some((hit) => !isFloorContact(hit, position))) return true;

  const distance = Math.hypot(travel[0], travel[1], travel[2]);
  if (distance <= PLANE_EPSILON) return false;
  const cast = world.shapeCast({
    ...EXIT_CHECK,
    shape: PLAYER_CAPSULE,
    x: meters(position[0]),
    y: meters(position[1]),
    z: meters(position[2]),
    dx: travel[0] / distance,
    dy: travel[1] / distance,
    dz: travel[2] / distance,
    maxDistance: meters(EXIT_CAST_DISTANCE),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  });
  return cast.some((hit) => !isFloorContact(hit, position));
}

function applyPortalTransform(point: Vec3, entry: PortalRenderEnd3D, exit: PortalRenderEnd3D): Vec3 {
  // These two ends use inverse 180-degree Y rotations. Their linked transform
  // has no rotation, so player heading and velocity stay fixed.
  return [
    point[0] + exit.position.x - entry.position.x,
    point[1],
    point[2] + exit.position.z - entry.position.z,
  ];
}

/** Crosses a game-owned open frame and rejects an occupied native exit pose. */
export function returnsCrossing(
  world: PhysicsWorld3D,
  beforeCenter: Vec3,
  afterCenter: Vec3,
  velocity: Vec3,
): { readonly kind: 'crossed'; readonly position: Vec3; readonly velocity: Vec3 }
  | { readonly kind: 'blocked'; readonly position: Vec3; readonly velocity: Vec3; readonly grounded: false }
  | null {
  if (!(world.portalPairs ?? []).some((pair) => pair.id === RETURNS_PAIR_ID && pair.open)) return null;

  const candidates = [
    { entry: RETURNS_PAIR.portalA, exit: RETURNS_PAIR.portalB },
    { entry: RETURNS_PAIR.portalB, exit: RETURNS_PAIR.portalA },
  ] as const;

  for (const { entry, exit } of candidates) {
    const startDistance = signedDistance(entry, beforeCenter);
    const endDistance = signedDistance(entry, afterCenter);
    const crossing = pointAtPlane(beforeCenter, afterCenter, startDistance, endDistance);
    if (!crossing) continue;
    const localX = Math.cos(yawOf(entry)) * (crossing[0] - entry.position.x) - Math.sin(yawOf(entry)) * (crossing[2] - entry.position.z);
    if (Math.abs(localX) > RETURNS_OPENING.width / 2 + PLAYER_RADIUS
      || Math.abs(crossing[1] - entry.position.y) > RETURNS_OPENING.height / 2 + PLAYER_RADIUS + PLAYER_HALF_HEIGHT) continue;
    if (!fitsOpening(entry, crossing)) {
      return { kind: 'blocked', ...blockedAtEntry(entry, crossing, velocity) };
    }

    const position = applyPortalTransform(afterCenter, entry, exit);
    const travel: Vec3 = [afterCenter[0] - beforeCenter[0], afterCenter[1] - beforeCenter[1], afterCenter[2] - beforeCenter[2]];
    if (hasExitBlock(world, position, travel)) {
      return { kind: 'blocked', ...blockedAtEntry(entry, crossing, velocity) };
    }

    return { kind: 'crossed', position, velocity };
  }
  return null;
}
