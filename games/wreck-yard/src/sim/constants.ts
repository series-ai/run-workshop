import type { WaterTankSpec } from 'voxel-kit';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const DT2 = DT * DT;
export const VOXEL_SIZE = 0.08;
export const FLOOR_Y = -0.86;
export const GRAVITY = 13.5;
export const GRAVITY_PER_TICK2 = -GRAVITY * DT2;
/**
 * Syncplay damping is the fraction of velocity a body keeps each tick (measured
 * in 6.0.0-rc.8: v=10 becomes 9.8 after one step at 0.98; 0 stops the body; 1
 * keeps it all). In rc.8, rounded voxel bodies at rest sleep with these values, but
 * slatted shapes (the timber pallet) still never sleep and creep a few mm/s:
 * https://github.com/series-ai/venus/issues/4861.
 */
export const LINEAR_DAMPING = 0.98;
export const ANGULAR_DAMPING = 0.945;
export const MAX_RAY_DISTANCE = 40;
export const MAX_PLAYERS = 4;
export const SHELL_PREFIX = 'shell:';

export const GRAB_FLOOR_CLEARANCE = 0.25;
/** A held body this far (m) from its hold point is let go. */
export const GRAB_BREAK_DISTANCE = 10;
/**
 * The hold point moves toward the aim at most this fast (m/s). It stays below
 * IMPACT_MIN_SPEED so carrying a body cannot fracture it.
 */
export const GRAB_TARGET_MAX_SPEED = 5.5;
/** Hold point acceleration (m/s²). Must stay well below GRAB_MAX_ACCEL - gravity so the body can follow. */
export const GRAB_TARGET_ACCEL = 18;
/**
 * The held body closes its gap to the hold point over this time (s). The servo
 * sets velocity directly; a physics joint made every world step 5x slower
 * (see grab.ts).
 */
export const GRAB_SERVO_TIME = 0.1;
/** Spin kept per tick while held, so a carried body does not tumble. */
export const GRAB_SPIN_KEEP = 0.7;
/** Largest acceleration the servo applies to a held body (m/s²), the same for every mass. */
export const GRAB_MAX_ACCEL = 40;
/** Release multiplies the body's real velocity, so a still hold drops straight down. */
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
/** A punt only reaches dynamic bodies this close (m). */
export const GRAVITY_GUN_PUNT_RANGE = 12;

export const ARENA_EXTENT = 26;

/** A player mounts the buggy within this 3D distance of the chassis center (m). */
export const BUGGY_MOUNT_RANGE = 2.8;

/** One rule for the sim and the HUD prompt. */
export function withinBuggyMountRange(player: readonly [number, number, number], chassis: readonly [number, number, number]): boolean {
  return Math.hypot(player[0] - chassis[0], player[1] - chassis[1], player[2] - chassis[2]) < BUGGY_MOUNT_RANGE;
}

/** Pitch of the vehicle ramp about X, in radians. The collider and the drawn ramp share it. */
export const VEHICLE_RAMP_PITCH = -0.14;


export const TERRAIN_COLS = 17;
export const TERRAIN_ROWS = 17;
export const TERRAIN_SPACING = 3.2; // 16 * 3.2 = 51.2m arena extent
export const TERRAIN_ORIGIN_X = -25.6;
export const TERRAIN_ORIGIN_Z = -25.6;

export function getTerrainHeightAt(_x: number, _z: number): number {
  return 0;
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
