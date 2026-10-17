import { DT, GRAB_MAX_ACCEL, GRAB_SERVO_TIME, GRAB_SPIN_KEEP, GRAB_TARGET_ACCEL, GRAB_TARGET_MAX_SPEED, GRAVITY } from './constants';
import { add, length, scale, sub, type Vec3 } from './math';
import {
  createGrabServoState3D,
  meters,
  metersPerSecond,
  metersPerSecondSquared,
  newtons,
  newtonsPerMeter,
  newtonSecondsPerMeter,
  perSecond,
  stepGrabServo3D,
  vec3,
  type PhysicsBodyHandle3D,
  type PhysicsWorld3D,
} from '@series-inc/rundot-syncplay/physics/3d';

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

/**
 * Apply the SDK servo before the physics step. The saved hold point and the
 * restored body supply all state. No servo instance survives a rollback.
 */
export function grabServo(world: PhysicsWorld3D, body: PhysicsBodyHandle3D, hold: HoldPoint): boolean {
  const { mass } = world.readMotion(body);
  // Close the gap to the start position, then move with the hold point.
  const holdStart = sub(hold.point, hold.velocity);
  const totalAcceleration = GRAB_MAX_ACCEL + GRAVITY;
  const state = createGrabServoState3D({
    behaviorRevision: 2,
    body,
    targetWorldPosition: vec3(meters, holdStart),
    targetVelocity: vec3(metersPerSecond, hold.velocity, 1 / DT),
    localAnchor: vec3(meters, 0, 0, 0),
    stiffness: newtonsPerMeter(mass / (GRAB_SERVO_TIME * DT)),
    damping: newtonSecondsPerMeter(mass / DT),
    angularDamping: perSecond((1 - GRAB_SPIN_KEEP) / DT),
    gravityCompensation: true,
    maxLinearAcceleration: metersPerSecondSquared(totalAcceleration),
    maxLinearForce: newtons(mass * totalAcceleration),
  });
  return stepGrabServo3D(world, state).output.kind === 'applied';
}
