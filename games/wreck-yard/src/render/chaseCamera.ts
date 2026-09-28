import { ARENA_EXTENT, FLOOR_Y } from '../sim/constants';
import type { UiTool } from './keyBindings';

type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3;
  readonly lookAt: Vec3;
}

const CHASE_DISTANCE = 6.2;
const CHASE_FOCUS_HEIGHT = 1.0;
const CHASE_LOOK_AHEAD = 1.6;
/** Default camera elevation above the chassis, in radians. Mouse pitch tilts it. */
const CHASE_BASE_ELEVATION = 0.3;
const CHASE_ELEVATION_RANGE = [0.06, 1.1] as const;
/** Keeps the camera inside the arena walls and above the floor. */
const CHASE_WALL_MARGIN = 0.8;
const CHASE_FLOOR_MARGIN = 0.35;
/** Exponential follow rate (1/s). Higher follows the chassis more tightly. */
export const CHASE_FOLLOW_RATE = 9;

/**
 * Third-person camera behind the buggy. `yaw` is the view heading (sim forward
 * is -Z rotated by yaw). Looking up with the mouse lowers the camera.
 */
export function chaseCameraPose(chassis: Vec3, yaw: number, pitch: number): CameraPose {
  const elevation = Math.min(Math.max(CHASE_BASE_ELEVATION - pitch, CHASE_ELEVATION_RANGE[0]), CHASE_ELEVATION_RANGE[1]);
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const focus: Vec3 = [chassis[0], chassis[1] + CHASE_FOCUS_HEIGHT, chassis[2]];
  const back = CHASE_DISTANCE * Math.cos(elevation);
  const limit = ARENA_EXTENT - CHASE_WALL_MARGIN;
  const clampXZ = (value: number) => Math.min(Math.max(value, -limit), limit);
  return {
    position: [
      clampXZ(focus[0] - forwardX * back),
      Math.max(focus[1] + CHASE_DISTANCE * Math.sin(elevation), FLOOR_Y + CHASE_FLOOR_MARGIN),
      clampXZ(focus[2] - forwardZ * back),
    ],
    lookAt: [focus[0] + forwardX * CHASE_LOOK_AHEAD, focus[1], focus[2] + forwardZ * CHASE_LOOK_AHEAD],
  };
}

/** Seconds after the last mouse look before the view starts to turn back to the buggy's heading. */
export const CHASE_RECENTER_DELAY = 1.0;
/** Recenter rate (1/s) at full speed: about 1.5 s to close most of the gap. */
const CHASE_RECENTER_RATE = 1.4;
/** Forward speed (m/s) where recentering starts, and where it reaches the full rate. */
const CHASE_RECENTER_SPEED = [1.0, 6.0] as const;

export interface ChaseView {
  readonly yaw: number;
  readonly pitch: number;
}

/**
 * While the buggy drives forward, turn the view slowly back to look along its
 * heading, faster at higher speed. Reversing, standing still, or a recent mouse
 * look leaves the view as the player set it.
 */
export function recenterChaseView(
  view: ChaseView,
  chassisYaw: number,
  forwardSpeed: number,
  secondsSinceLook: number,
  deltaSeconds: number,
): ChaseView {
  if (secondsSinceLook < CHASE_RECENTER_DELAY || forwardSpeed <= CHASE_RECENTER_SPEED[0]) return view;
  const speedFactor = Math.min(1, (forwardSpeed - CHASE_RECENTER_SPEED[0]) / (CHASE_RECENTER_SPEED[1] - CHASE_RECENTER_SPEED[0]));
  const blend = 1 - Math.exp(-CHASE_RECENTER_RATE * speedFactor * deltaSeconds);
  const yawGap = Math.atan2(Math.sin(chassisYaw - view.yaw), Math.cos(chassisYaw - view.yaw));
  return { yaw: view.yaw + yawGap * blend, pitch: view.pitch * (1 - blend) };
}

/** First person hides the local body. Orbit and the chase camera show it. */
export function showsLocalAvatar(tool: UiTool, riding: boolean): boolean {
  return tool === 'orbit' || riding;
}
