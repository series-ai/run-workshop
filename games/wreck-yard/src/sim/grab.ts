import { DT, GRAB_TARGET_ACCEL, GRAB_TARGET_MAX_SPEED } from './constants';
import { add, length, scale, sub, type Vec3 } from './math';

export interface HoldPoint {
  readonly point: Vec3;
  /** Meters per tick. */
  readonly velocity: Vec3;
}

/**
 * Moves the grab hold point toward the aim with bounded speed and acceleration.
 * It slows down on approach, so the spring can stop the body at the aim
 * without overshoot. Pure: the same input gives the same output on every peer.
 */
export function advanceHoldPoint(hold: HoldPoint, aim: Vec3): HoldPoint {
  const toAim = sub(aim, hold.point);
  const distance = length(toAim);
  if (distance < 1e-6) return { point: aim, velocity: [0, 0, 0] };

  const maxSpeedPerTick = GRAB_TARGET_MAX_SPEED * DT;
  const accelPerTick = GRAB_TARGET_ACCEL * DT * DT;
  // Fastest speed that can still brake to a stop at the aim.
  const arriveSpeed = Math.sqrt(2 * accelPerTick * distance);
  const desired = scale(toAim, Math.min(maxSpeedPerTick, arriveSpeed) / distance);
  const change = sub(desired, hold.velocity);
  const changeLength = length(change);
  const velocity = changeLength <= accelPerTick ? desired : add(hold.velocity, scale(change, accelPerTick / changeLength));

  if (length(velocity) >= distance) return { point: aim, velocity: toAim };
  return { point: add(hold.point, velocity), velocity };
}
