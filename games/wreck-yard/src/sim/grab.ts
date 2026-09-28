import { DT, GRAB_MAX_ACCEL, GRAB_SERVO_TIME, GRAB_SPIN_KEEP, GRAB_TARGET_ACCEL, GRAB_TARGET_MAX_SPEED, GRAVITY } from './constants';
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

export interface BodyMotion {
  /** Meters per tick. */
  readonly linear: Vec3;
  /** Radians per tick. */
  readonly angular: Vec3;
}

/**
 * Velocity servo that carries a held body to the hold point. It replaces a
 * six-DOF joint: any joint makes the whole world step slower (about 5x in
 * 6.0.0-rc.5, still about 2x in rc.8; https://github.com/series-ai/venus/issues/4862).
 * The servo moves the body toward the hold point over
 * GRAB_SERVO_TIME, limits the change to GRAB_MAX_ACCEL, cancels the gravity
 * the next step applies, and damps spin. Units are per tick.
 */
export function grabServo(position: Vec3, motion: BodyMotion, hold: HoldPoint): BodyMotion {
  // hold.point is where the hold point ends this tick. Close the gap from its
  // start-of-tick position, then move with it, so the body does not lead it.
  const holdStart = sub(hold.point, hold.velocity);
  const desired = add(hold.velocity, scale(sub(holdStart, position), DT / GRAB_SERVO_TIME));
  const change = sub(desired, motion.linear);
  const changeLength = length(change);
  const maxChange = GRAB_MAX_ACCEL * DT * DT;
  const limited = changeLength <= maxChange ? change : scale(change, maxChange / changeLength);
  const linear = add(add(motion.linear, limited), [0, GRAVITY * DT * DT, 0]);
  return { linear, angular: scale(motion.angular, GRAB_SPIN_KEEP) };
}
