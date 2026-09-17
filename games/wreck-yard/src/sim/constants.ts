import type { WaterTankSpec, WorldOcclusionStaticBox } from 'voxel-kit';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const DT2 = DT * DT;
export const VOXEL_SIZE = 0.08;
export const FLOOR_Y = -0.86;
export const GRAVITY = 13.5;
export const GRAVITY_PER_TICK2 = -GRAVITY * DT2;
export const LINEAR_DAMPING = 0.98;
export const ANGULAR_DAMPING = 0.945;
export const MAX_RAY_DISTANCE = 40;
export const MAX_PLAYERS = 4;
export const SHELL_PREFIX = 'shell:';

export const GRAB_PULL_GAIN = 10.6;
export const GRAB_LIFT = 0.9;
export const GRAB_FLOOR_CLEARANCE = 0.25;
export const THROW_BOOST = 1.16;

export const TORCH_PULSE_TICKS = 3;
export const TORCH_RADIUS = 2.15;
export const TORCH_INSET = 1.35;
/**
 * Extra voxels the torch cuts past the far side of the body. The carve runs
 * from the surface point, through the body along the surface normal, and out
 * the other side, so a stroke separates material on any axis instead of
 * gouging a fixed depth and only splitting when the body happens to be thin.
 */
export const TORCH_THROUGH_MARGIN = 2;
export const SCORCH_MATERIAL = 5;

export const IMPACT_MIN_SPEED = 6.4;
export const IMPACT_COOLDOWN_TICKS = 11;

export const MIN_FRAGMENT_VOXELS = 28;
export const MAX_TORCH_FRAGMENTS = 5;
export const CUT_SEPARATION_BIAS = 0.01;
export const IMPACT_SEPARATION_BIAS = 0.045;

export const YARD_MATERIAL = { friction: 0.82, restitution: 0.08 } as const;

export const TANK = {
  center: [2.95, 0, 0.55] as const,
  innerSize: [4.3, 1.82, 3.15] as const,
  bottomY: FLOOR_Y + 0.08,
  surfaceY: 0.46,
  wallThickness: 0.12,
};

export const TANK_SPEC: WaterTankSpec = {
  center: [TANK.center[0], TANK.center[1], TANK.center[2]],
  innerSize: [TANK.innerSize[0], TANK.innerSize[1], TANK.innerSize[2]],
  bottomY: TANK.bottomY,
  surfaceY: TANK.surfaceY,
};

const TANK_WALL_HEIGHT = TANK.surfaceY - TANK.bottomY;
const TANK_WALL_CENTER_Y = TANK.bottomY + TANK_WALL_HEIGHT * 0.5;

export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_OFFSET = 1.55;
export const PLAYER_MOVE_SPEED = 7.5;
export const PLAYER_GRAVITY = 22.0;
export const JETPACK_THRUST_Y = 19.5;
export const JETPACK_THRUST_XZ = 7.0;
export const JETPACK_FUEL_DRAIN = 0.6;
export const JETPACK_FUEL_RECHARGE = 1.2;
export const GRAVITY_GUN_RANGE = 30.0;
export const GRAVITY_GUN_HOLD_DIST = 3.5;
export const GRAVITY_GUN_PUNT_SPEED = 30.0;

export const ARENA_EXTENT = 26;

/** Static boxes: center and full size. Used for physics shell bodies and occlusion. */
export const SHELL_BOXES: readonly (WorldOcclusionStaticBox & { id: string })[] = [
  { id: 'floor', center: [0, FLOOR_Y - 0.1, 0], size: [52, 0.2, 52] },
  { id: 'wall-west', center: [-ARENA_EXTENT, 3, 0], size: [0.8, 8, 52] },
  { id: 'wall-east', center: [ARENA_EXTENT, 3, 0], size: [0.8, 8, 52] },
  { id: 'wall-north', center: [0, 3, -ARENA_EXTENT], size: [52, 8, 0.8] },
  { id: 'wall-south', center: [0, 3, ARENA_EXTENT], size: [52, 8, 0.8] },
  { id: 'plinth-a', center: [1.0, FLOOR_Y + 0.24, 0.9], size: [3.1, 0.48, 3.8] },
  { id: 'plinth-b', center: [-2.35, FLOOR_Y + 0.2, -1.4], size: [2.3, 0.4, 2.3] },
  { id: 'tank-floor', center: [TANK.center[0], TANK.bottomY - 0.12, TANK.center[2]], size: [TANK.innerSize[0], 0.24, TANK.innerSize[2]] },
  { id: 'tank-west', center: [TANK.center[0] - TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
  { id: 'tank-east', center: [TANK.center[0] + TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
  { id: 'tank-north', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] - TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
  { id: 'tank-south', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] + TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
  { id: 'seesaw-pivot', center: [-8, FLOOR_Y + 0.45, -6], size: [1.2, 0.9, 1.2] },
  { id: 'ball-drop-platform', center: [-12, FLOOR_Y + 2.5, 12], size: [4, 5.0, 4] },
  { id: 'vehicle-ramp', center: [12, FLOOR_Y + 0.4, 12], size: [4, 0.8, 6] },
];

export const TERRAIN_COLS = 17;
export const TERRAIN_ROWS = 17;
export const TERRAIN_SPACING = 3.2; // 16 * 3.2 = 51.2m arena extent
export const TERRAIN_ORIGIN_X = -25.6;
export const TERRAIN_ORIGIN_Z = -25.6;

export function getTerrainHeightAt(x: number, z: number): number {
  let h = 0;
  // 1. Water Basin (North-East: around x = 11, z = -11) - sunken excavated fluid quarry
  const waterDist = Math.hypot(x - 11.0, z - (-11.0));
  if (waterDist < 7.2) {
    h -= Math.cos((waterDist / 7.2) * (Math.PI * 0.5)) * 1.85;
  }

  // 2. Vehicle Dirt Ridge / Hill (South-East: around x = 15, z = 14)
  const hillDist = Math.hypot(x - 15.0, z - 14.0);
  if (hillDist < 8.0) {
    h += Math.cos((hillDist / 8.0) * (Math.PI * 0.5)) * 2.2;
  }

  // 3. Ball Drop Knoll (South-West: around x = -14, z = 14)
  const knollDist = Math.hypot(x - (-14.0), z - 14.0);
  if (knollDist < 7.5) {
    h += Math.cos((knollDist / 7.5) * (Math.PI * 0.5)) * 1.5;
  }

  // 4. Central Salvage Flat: keep central apron (where gantry, ballast box, spawn points are) flat
  const centerDist = Math.hypot(x, z);
  if (centerDist < 6.5) {
    h = 0;
  } else if (centerDist < 9.0) {
    h *= (centerDist - 6.5) / 2.5;
  }

  return Math.round(h * 100) / 100;
}

export function buildTerrainHeights(): readonly number[] {
  const list: number[] = [];
  for (let r = 0; r < TERRAIN_ROWS; r++) {
    for (let c = 0; c < TERRAIN_COLS; c++) {
      const x = TERRAIN_ORIGIN_X + c * TERRAIN_SPACING;
      const z = TERRAIN_ORIGIN_Z + r * TERRAIN_SPACING;
      list.push(getTerrainHeightAt(x, z));
    }
  }
  return Object.freeze(list);
}

export const TERRAIN_HEIGHTS: readonly number[] = buildTerrainHeights();
