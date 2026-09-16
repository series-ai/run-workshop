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

/** Static boxes: center and full size. Used for physics shell bodies and occlusion. */
export const SHELL_BOXES: readonly (WorldOcclusionStaticBox & { id: string })[] = [
  { id: 'floor', center: [0, FLOOR_Y - 0.1, 0], size: [18, 0.2, 18] },
  { id: 'wall-west', center: [-4.55, 1.25, 0], size: [0.7, 4.4, 18] },
  { id: 'wall-north', center: [0, 1.25, -4.55], size: [18, 4.4, 0.7] },
  { id: 'plinth-a', center: [1.0, FLOOR_Y + 0.24, 0.9], size: [3.1, 0.48, 3.8] },
  { id: 'plinth-b', center: [-2.35, FLOOR_Y + 0.2, -1.4], size: [2.3, 0.4, 2.3] },
  { id: 'tank-floor', center: [TANK.center[0], TANK.bottomY - 0.12, TANK.center[2]], size: [TANK.innerSize[0], 0.24, TANK.innerSize[2]] },
  { id: 'tank-west', center: [TANK.center[0] - TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
  { id: 'tank-east', center: [TANK.center[0] + TANK.innerSize[0] * 0.5, TANK_WALL_CENTER_Y, TANK.center[2]], size: [TANK.wallThickness, TANK_WALL_HEIGHT, TANK.innerSize[2]] },
  { id: 'tank-north', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] - TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
  { id: 'tank-south', center: [TANK.center[0], TANK_WALL_CENTER_Y, TANK.center[2] + TANK.innerSize[2] * 0.5], size: [TANK.innerSize[0], TANK_WALL_HEIGHT, TANK.wallThickness] },
];
