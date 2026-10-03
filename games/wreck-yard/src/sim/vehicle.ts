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

/** Tuned at chassis mass 3.614: stiffness 220, damping 12. */
const SUSPENSION_STIFFNESS_PER_MASS = 220 / 3.614;
const SUSPENSION_DAMPING_PER_MASS = 12 / 3.614;

export const BUGGY_WHEELS: readonly DeterministicVehicleWheelDefinition3D[] = [-0.84, 0.84].flatMap((x) =>
  [-0.68, 0.84].map((z) => ({
    id: `wheel ${x} ${z}`,
    localAnchor: { x: meters(x), y: meters(-0.30), z: meters(z) },
    suspensionDirection: { x: 0, y: -1, z: 0 },
    suspensionRestLength: meters(0.5),
    suspensionMaximumTravel: meters(0.2),
    radius: meters(0.35),
    // Per unit of chassis mass; stepBuggy scales them, so ride height and
    // damping do not change when the chassis design changes its mass.
    stiffness: newtonsPerMeter(SUSPENSION_STIFFNESS_PER_MASS),
    damping: newtonSecondsPerMeter(SUSPENSION_DAMPING_PER_MASS),
    grip: 1.8,
    maximumSteerAngleTurns: turns(0.08),
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
  const definition = {
    wheels: BUGGY_WHEELS.map((wheel) => ({
      ...wheel,
      stiffness: newtonsPerMeter(wheel.stiffness * body.mass),
      damping: newtonSecondsPerMeter(wheel.damping * body.mass),
    })),
    driveForce: newtons(body.mass * 18),
    brakeForce: newtons(body.mass * 28),
  };
  // A replaced chassis has a new id: its vehicle starts fresh.
  const state = previous?.chassisId === chassisId ? previous : createDeterministicVehicleState3D(definition, chassisId);
  const result = stepDeterministicVehicleState3D(definition, state, {
    throttle: vehicleAxis(input?.moveZ ?? 0),
    steer: vehicleAxis(input?.moveX ?? 0),
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
  const axis = Math.round(-value * 10);
  return axis === 0 ? 0 : axis;
}
