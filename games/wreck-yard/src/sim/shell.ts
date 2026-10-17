import { RETURNS_SOLIDS } from './returns';
import type { WorldOcclusionStaticBox } from 'voxel-kit';
import { ARENA_EXTENT, FLOOR_Y, TANK } from './constants';
import type { Quat } from './math';
import { STORAGE_SOLIDS } from './attractions';
import { STORAGE_FIXTURE_SOLIDS } from './storageFixtures';
import { CONTRAPTION_COLLIDERS } from './contraptions';
import { LOST_PROPERTY_SOLIDS } from './lostProperty';
import { ofMaterial, SET_PIECE_COLLIDERS, VEHICLE_RAMP, type ShellBox } from './setPieces';

const TANK_WALL_HEIGHT = TANK.surfaceY - TANK.bottomY;
const TANK_WALL_CENTER_Y = TANK.bottomY + TANK_WALL_HEIGHT * 0.5;

/**
 * Static boxes: center, full size, and optional rotation. Used for physics shell
 * bodies and occlusion. Every solid-looking static mesh needs an entry; see
 * scripts/audit-collision.mjs.
 */
export const SHELL_BOXES: readonly ShellBox[] = [
  ...ofMaterial('concrete', [
    { id: 'floor', center: [0, FLOOR_Y - 0.1, 0], size: [52, 0.2, 52] },
    { id: 'wall-west', center: [-ARENA_EXTENT, FLOOR_Y + 2, 0], size: [0.6, 4, 52] },
    { id: 'wall-east', center: [ARENA_EXTENT, FLOOR_Y + 2, 0], size: [0.6, 4, 52] },
    { id: 'wall-north', center: [0, FLOOR_Y + 1, -ARENA_EXTENT], size: [52, 2, 0.6] },
    { id: 'wall-south', center: [0, FLOOR_Y + 2, ARENA_EXTENT], size: [52, 4, 0.6] },
    { id: 'plinth-a', center: [1.0, FLOOR_Y + 0.24, 0.9], size: [3.1, 0.48, 3.8] },
    { id: 'plinth-b', center: [-2.35, FLOOR_Y + 0.2, -1.4], size: [2.3, 0.4, 2.3] },
  ]),
  // The tank has a concrete base and clear glass side panels (render/YardShell.tsx).
  ...ofMaterial('concrete', [{ id: 'tank-floor', center: [TANK.center[0], TANK.bottomY - 0.12, TANK.center[2]], size: [TANK.innerSize[0], 0.24, TANK.innerSize[2]] }]),
  ...ofMaterial('glass', [
    { id: 'tank-west', center: [TANK.center[0] - TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
    { id: 'tank-east', center: [TANK.center[0] + TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
    { id: 'tank-north', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] - TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
    { id: 'tank-south', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] + TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
  ]),
  ...ofMaterial('steel', [
    { id: 'seesaw-pivot', center: [-14, FLOOR_Y + 0.45, -6], size: [1.2, 0.9, 1.2] },
    { id: 'ball-drop-platform', center: [-12, FLOOR_Y + 2.5, 12], size: [4, 5.0, 4] },
    { id: 'vehicle-ramp', center: VEHICLE_RAMP.center, size: VEHICLE_RAMP.size, rotation: [VEHICLE_RAMP.pitch, 0, 0] },
  ]),
  ...RETURNS_SOLIDS,
  ...STORAGE_SOLIDS,
  ...STORAGE_FIXTURE_SOLIDS,
  ...SET_PIECE_COLLIDERS,
  ...CONTRAPTION_COLLIDERS,
  ...LOST_PROPERTY_SOLIDS,
];

/** Quaternion for a shell box's XYZ Euler rotation (three.js order). */
export function shellBoxQuaternion(box: ShellBox): Quat {
  const [x, y, z] = box.rotation ?? [0, 0, 0];
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

/** Axis-aligned bounds that enclose a shell box, for the occlusion volume. */
export function shellBoxBounds(box: ShellBox): WorldOcclusionStaticBox {
  if (!box.rotation) return { center: box.center, size: box.size };
  const [qx, qy, qz, qw] = shellBoxQuaternion(box);
  // Rows of the rotation matrix; the enclosing half size is |R| * half.
  const m = [
    [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
    [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
    [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
  ];
  const half = box.size.map((s) => s / 2);
  const size = m.map((row) => 2 * row.reduce((sum, value, axis) => sum + Math.abs(value) * half[axis]!, 0)) as [number, number, number];
  return { center: box.center, size };
}
