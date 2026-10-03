import { stepDeterministicKcc3D } from '@series-inc/rundot-syncplay/browser';
import { meters } from '@series-inc/rundot-syncplay/physics/3d';
import { ARENA_EXTENT, DT, FLOOR_Y, PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import type { Vec3 } from './math';
import type { OpenYardPhysicsWorld } from './physics';
import type { PlayerState } from './state';

const HALF_HEIGHT = PLAYER_HEIGHT * 0.5 - PLAYER_RADIUS;
const CAPSULE = { type: 'capsule', radius: meters(PLAYER_RADIUS), halfHeight: meters(HALF_HEIGHT) } as const;

/** Tallest edge the player walks up onto (m). */
const STEP_HEIGHT = 0.3;
/** Upward speed (m/s) of the lifted slide: just above zero, so the KCC does not ground it. */
const LIFT_SPEED = 0.001;
/**
 * The landing check sits this far above the landed pose. A lower edge beside the
 * feet is fine (the next step climbs it); anything taller means the capsule's
 * side is inside the step.
 */
const LANDING_CLEARANCE = 0.13;

type PlayerPose = Pick<PlayerState, 'x' | 'y' | 'z' | 'grounded'>;

/**
 * Moves the player with the Syncplay KCC. The KCC slides horizontally only: a
 * low edge it meets head-on (a plate on the floor, a crate's lip) is a wall to
 * it, and its step height only snaps down onto ground already underfoot. So a
 * grounded player that is blocked tries the move again from STEP_HEIGHT up,
 * then drops onto the step. The retry is kept only when it gets further and
 * lands clear of everything, so a wall, or an edge too tall for the capsule's
 * round bottom to clear (~0.12 m head-on), still blocks.
 */
export function movePlayer(physics: OpenYardPhysicsWorld, player: PlayerPose, velocity: Vec3) {
  const direct = moveWithKcc(physics, player, velocity);
  const wanted = Math.hypot(velocity[0], velocity[2]) * DT;
  const moved = Math.hypot(direct.x - player.x, direct.z - player.z);
  if (!player.grounded || wanted < 1e-4 || moved >= wanted * 0.5) return direct;
  // Room at the lifted height itself: an edge the capsule already touches below
  // (a plate pushed against the player) must not count as a ceiling.
  const blockedAbove = physics.world.overlap({
    x: meters(player.x), y: meters(player.y + STEP_HEIGHT + HALF_HEIGHT), z: meters(player.z),
    shape: CAPSULE,
    hitTriggers: false, hitSensors: false,
  });
  if (blockedAbove.length > 0) return direct;
  // Two passes: slide at the lifted height (moving up by a hair, so the KCC skips its
  // ground pass, which would put the player straight back down), then drop onto the step.
  const lifted = moveWithKcc(physics, { ...player, y: player.y + STEP_HEIGHT, grounded: false }, [velocity[0], LIFT_SPEED, velocity[2]]);
  const liftedMoved = Math.hypot(lifted.x - player.x, lifted.z - player.z);
  if (liftedMoved <= moved + 1e-3) return direct;
  const landed = moveWithKcc(physics, { x: lifted.x, y: lifted.y, z: lifted.z, grounded: false }, [0, -(STEP_HEIGHT + 0.05) / DT, 0]);
  if (!landed.grounded) return direct;
  // The KCC grounds on what is under the capsule's center. Next to a tall edge that
  // is the floor while the capsule's side is inside the step; refuse that landing.
  const inside = physics.world.overlap({
    x: meters(landed.x), y: meters(landed.y + HALF_HEIGHT + LANDING_CLEARANCE), z: meters(landed.z),
    shape: CAPSULE,
    hitTriggers: false, hitSensors: false,
  });
  if (inside.length > 0) return direct;
  return { ...landed, velocity: [lifted.velocity[0], landed.velocity[1], lifted.velocity[2]] as Vec3 };
}

/** Convert game velocities to the KCC's meters per frame at this boundary. */
function moveWithKcc(physics: OpenYardPhysicsWorld, player: PlayerPose, velocity: Vec3) {
  const queries = physics.world;
  const centerY = player.y + HALF_HEIGHT;
  let vertical = velocity[1] * DT;
  if (vertical > 0) {
    const ceiling = queries.shapeCast({
      x: meters(player.x), y: meters(centerY), z: meters(player.z),
      shape: CAPSULE,
      dx: 0, dy: 1, dz: 0, maxDistance: meters(vertical),
      hitTriggers: false, hitSensors: false,
    }).find((hit) => hit.normal.y > 0.5);
    if (ceiling) vertical = Math.max(0, ceiling.distance - 0.01);
  }
  const result = stepDeterministicKcc3D({
    x: player.x, y: centerY, z: player.z,
    vx: velocity[0] * DT, vy: vertical, vz: velocity[2] * DT,
    radius: PLAYER_RADIUS, halfHeight: HALF_HEIGHT, skinWidth: 0.005,
    grounded: player.grounded, coyoteFrames: 0, jumpBufferFrames: 0,
  }, { moveX: velocity[0] * DT, moveZ: velocity[2] * DT }, {
    minX: -ARENA_EXTENT + 1, maxX: ARENA_EXTENT - 1,
    minY: FLOOR_Y - 2, maxY: 40,
    minZ: -ARENA_EXTENT + 1, maxZ: ARENA_EXTENT - 1,
    maxSlopeRisePerUnit: 0.8, stepHeight: STEP_HEIGHT,
  }, {
    frame: Number(physics.world.info().frame),
    physics: queries,
    groundOnStaticBodies: true,
    standOnDynamicBodies: true,
    // Gravity and jetpack acceleration already ran in the game step.
    processors: [{ id: 'yard-gravity', order: 0, process: (body) => ({ ...body, vy: body.vy + 1 }) }],
  });
  return {
    x: result.body.x, y: result.body.y - HALF_HEIGHT, z: result.body.z,
    grounded: result.body.grounded,
    velocity: [result.body.vx / DT, result.body.vy / DT, result.body.vz / DT] as Vec3,
  };
}
