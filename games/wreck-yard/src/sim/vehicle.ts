import { stepDeterministicVehicle3D, type DeterministicVehicleWheel3D } from '@series-inc/rundot-syncplay/physics/3d';
import type { BuggyWheelState } from './state';
import { type YardInput } from './input';
import { fullPhysicsBodyById, physicsBodyHandle, type OpenYardPhysicsWorld } from './physics';

/** Tuned at chassis mass 3.614: stiffness 220, damping 12. */
const SUSPENSION_STIFFNESS_PER_MASS = 220 / 3.614;
const SUSPENSION_DAMPING_PER_MASS = 12 / 3.614;

export const BUGGY_WHEELS: readonly DeterministicVehicleWheel3D[] = [-0.84, 0.84].flatMap((x) =>
  [-0.68, 0.84].map((z) => ({
    localAnchor: { x, y: -0.30, z },
    suspensionDirection: { x: 0, y: -1, z: 0 },
    suspensionRestLength: 0.5,
    suspensionMaximumTravel: 0.2,
    radius: 0.35,
    // Per unit of chassis mass; stepBuggy scales them, so ride height and
    // damping do not change when the chassis design changes its mass.
    stiffness: SUSPENSION_STIFFNESS_PER_MASS,
    damping: SUSPENSION_DAMPING_PER_MASS,
    grip: 1.8,
    maximumSteerAngleTurns: 0.08,
    steered: z < 0,
    driven: true,
  })),
);

/** Apply tire forces only at ground contacts. Keep airborne momentum intact. */
export function stepBuggy(physics: OpenYardPhysicsWorld, input?: YardInput, previous: readonly BuggyWheelState[] = []): readonly BuggyWheelState[] {
  const body = fullPhysicsBodyById(physics, 'vehicle-chassis');
  if (!body || body.kind !== 'dynamic') return [];
  const result = stepDeterministicVehicle3D({
    chassis: physicsBodyHandle(physics, 'vehicle-chassis'),
    wheels: BUGGY_WHEELS.map((wheel) => ({ ...wheel, stiffness: wheel.stiffness * body.mass, damping: wheel.damping * body.mass })),
    driveForce: body.mass * 18,
    brakeForce: body.mass * 28,
  }, {
    throttle: Math.round(-(input?.moveZ ?? 0) * 10),
    steer: Math.round(-(input?.moveX ?? 0) * 10),
    brake: input?.moveZ ? 0 : 5,
  }, physics.world, { applyImpulses: true });
  return result.wheels.map((wheel, index) => ({
    compression: wheel.compression, steerAngleTurns: wheel.steerAngleTurns,
    grounded: wheel.grounded, spinTurns: (previous[index]?.spinTurns ?? 0) + wheel.spinDeltaTurns,
  }));
}
