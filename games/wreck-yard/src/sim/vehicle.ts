import {
  createDeterministicVehicleState3D,
  meters,
  newtons,
  newtonsPerMeter,
  newtonSecondsPerMeter,
  stepDeterministicVehicleState3D,
  turns,
  type DeterministicVehicleState3D,
  type DeterministicVehicleWheelDefinition3D,
} from '@series-inc/rundot-syncplay/physics/3d';
import type { BuggyWheelState } from './state';
import { type YardInput } from './input';
import { physicsBodyHandle, type OpenYardPhysicsWorld } from './physics';
import { clamp } from './math';

/** Tuned at chassis mass 3.614: stiffness 220, damping 24. */
const SUSPENSION_STIFFNESS_PER_MASS = 220 / 3.614;
const SUSPENSION_DAMPING_PER_MASS = 24 / 3.614;
const STEERING = {
  maximumAngleTurns: turns(0.12),
  lowSpeedGrip: 2.4,
  highSpeedGrip: 1.4,
  lowSpeed: 5,
  highSpeed: 9,
} as const;

export const BUGGY_WHEELS: readonly DeterministicVehicleWheelDefinition3D[] = [-0.84, 0.84].flatMap((x) =>
  [-0.68, 0.84].map((z) => ({
    id: `wheel ${x} ${z}`,
    localAnchor: { x: meters(x), y: meters(-0.30), z: meters(z) },
    suspensionDirection: { x: 0, y: -1, z: 0 },
    suspensionRestLength: meters(0.9),
    suspensionMaximumTravel: meters(0.2),
    radius: meters(0.35),
    // Per unit of chassis mass; stepBuggy scales them, so ride height and
    // damping do not change when the chassis design changes its mass.
    stiffness: newtonsPerMeter(SUSPENSION_STIFFNESS_PER_MASS),
    damping: newtonSecondsPerMeter(SUSPENSION_DAMPING_PER_MASS),
    grip: STEERING.highSpeedGrip,
    maximumSteerAngleTurns: STEERING.maximumAngleTurns,
    steered: z < 0,
    driven: true,
  })),
);

export interface BuggyStep {
  readonly vehicle: DeterministicVehicleState3D;
  readonly wheels: readonly BuggyWheelState[];
}

/**
 * Steps the buggy with Syncplay's revision 2 vehicle (6.0.0-rc.20). Its tire
 * solve includes the body under each wheel, so a light prop there is not
 * flung, and an idle buggy parks (sleeps) until input or its support changes.
 * Tire forces apply only at ground contacts; airborne momentum stays intact.
 */
export function stepBuggy(physics: OpenYardPhysicsWorld, input?: YardInput, previous?: DeterministicVehicleState3D): BuggyStep | undefined {
  const chassisId = physics.bodyIds.get('vehicle-chassis');
  if (chassisId === undefined) return undefined;
  // Motion has mass and kind; a full read would decode the voxel shape every tick.
  const body = physics.world.readMotion(physicsBodyHandle(physics, 'vehicle-chassis'));
  if (body.kind !== 'dynamic') return undefined;
  const steer = vehicleAxis(input?.moveX ?? 0);
  const speed = Math.hypot(body.linearVelocity.x, body.linearVelocity.z);
  const yawFade = clamp(1 - Math.abs(body.angularVelocity.y) / 1.5, 0, 1);
  const gripBlend = steer === 0 ? 0 : clamp((STEERING.highSpeed - speed) / (STEERING.highSpeed - STEERING.lowSpeed), 0, 1) * yawFade;
  // Add front grip while initiating a turn. Reduce the aid at high speed or once turning fast to keep sharp turns stable.
  const frontGrip = STEERING.highSpeedGrip + (STEERING.lowSpeedGrip - STEERING.highSpeedGrip) * gripBlend;
  const definition = {
    wheels: BUGGY_WHEELS.map((wheel) => ({
      ...wheel,
      grip: wheel.steered ? frontGrip : wheel.grip,
      stiffness: newtonsPerMeter(wheel.stiffness * body.mass),
      damping: newtonSecondsPerMeter(wheel.damping * body.mass),
    })),
    driveForce: newtons(body.mass * 13.5),
    brakeForce: newtons(body.mass * 28),
  };
  // A replaced chassis has a new id: its vehicle starts fresh.
  const state = previous?.chassisId === chassisId ? previous : createDeterministicVehicleState3D(definition, chassisId);
  const result = stepDeterministicVehicleState3D(definition, state, {
    throttle: vehicleAxis(input?.moveZ ?? 0),
    steer,
    brake: input?.moveZ ? 0 : 5,
  }, physics.world, { checksumMode: 'disabled', apply: true });
  return {
    vehicle: result.state,
    wheels: result.wheels.map((wheel) => ({
      compression: wheel.compression, steerAngleTurns: wheel.steerAngleTurns,
      grounded: wheel.grounded, spinTurns: wheel.accumulatedTurns,
    })),
  };
}

/** A stick axis as Syncplay's integer vehicle input in [-10, 10]. Never -0, which canonical JSON must tag. */
function vehicleAxis(value: number): number {
  const axis = -Math.sign(value) * Math.round(Math.abs(value) * 10);
  return axis === 0 ? 0 : axis;
}
