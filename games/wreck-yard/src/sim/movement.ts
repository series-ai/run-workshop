import { ELEVATOR } from './attractions';
import { physicsBodyById } from './physics';
import { returnsCrossing } from './returns';
import { stepDeterministicKcc3D } from '@series-inc/rundot-syncplay/browser';
import { frameGravity, meters } from '@series-inc/rundot-syncplay/physics/3d';
import { ARENA_EXTENT, DT, FLOOR_Y, PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import type { Vec3 } from './math';
import type { OpenYardPhysicsWorld } from './physics';
import type { PlayerState } from './state';

const HALF_HEIGHT = PLAYER_HEIGHT * 0.5 - PLAYER_RADIUS;
const CAPSULE = { type: 'capsule', radius: meters(PLAYER_RADIUS), halfHeight: meters(HALF_HEIGHT) } as const;

/** Highest edge the player can climb without the thruster (m). */
export const STEP_HEIGHT = 0.5;
const SKIN_WIDTH = 0.005;
const STEP_CAPSULE = { type: 'capsule', radius: meters(PLAYER_RADIUS + SKIN_WIDTH), halfHeight: meters(HALF_HEIGHT + SKIN_WIDTH) } as const;
const SOLID_QUERY = { hitTriggers: false, hitSensors: false, maxPortalDepth: 0 } as const;
const MAX_SLOPE_RISE = 0.8;
const WALKABLE_NORMAL_Y = 1 / Math.sqrt(1 + MAX_SLOPE_RISE * MAX_SLOPE_RISE);

const MOVEMENT_BOUNDS = {
  minX: -ARENA_EXTENT + 1, maxX: ARENA_EXTENT - 1,
  minY: FLOOR_Y - 2, maxY: 40,
  minZ: -ARENA_EXTENT + 1, maxZ: ARENA_EXTENT - 1,
};

type PlayerPose = Pick<PlayerState, 'x' | 'y' | 'z' | 'grounded'>;

/** Move with the KCC. A blocked grounded move can climb a low edge. */
export function movePlayer(physics: OpenYardPhysicsWorld, player: PlayerPose, velocity: Vec3) {
  const moved = moveOnSurfaces(physics, player, velocity);
  const crossing = returnsCrossing(physics.world, [player.x, player.y + HALF_HEIGHT, player.z], [moved.x, moved.y + HALF_HEIGHT, moved.z], moved.velocity);
  if (!crossing) return { ...moved, portalCrossed: false };
  return { x: crossing.position[0], y: crossing.position[1] - HALF_HEIGHT, z: crossing.position[2], grounded: false, velocity: crossing.velocity, portalCrossed: crossing.kind === 'crossed' };
}

function moveOnSurfaces(physics: OpenYardPhysicsWorld, player: PlayerPose, velocity: Vec3) {
  const direct = moveWithKcc(physics, player, velocity);
  const dx = velocity[0] * DT;
  const dz = velocity[2] * DT;
  const wanted = Math.hypot(dx, dz);
  const moved = Math.hypot(direct.x - player.x, direct.z - player.z);
  if (!player.grounded || velocity[1] > 0 || wanted < 1e-4 || moved >= wanted * 0.9) return direct;

  const x = player.x + dx;
  const z = player.z + dz;
  if (x < MOVEMENT_BOUNDS.minX || x > MOVEMENT_BOUNDS.maxX || z < MOVEMENT_BOUNDS.minZ || z > MOVEMENT_BOUNDS.maxZ) return direct;
  const world = physics.world;
  const centerY = player.y + HALF_HEIGHT;
  const up = world.shapeCast({
    ...SOLID_QUERY, shape: STEP_CAPSULE,
    x: meters(player.x), y: meters(centerY), z: meters(player.z),
    dx: 0, dy: 1, dz: 0, maxDistance: meters(STEP_HEIGHT),
  });
  if (up.some((hit) => hit.normal.y > 0.5 && hit.point.y > centerY)) return direct;

  const liftedY = centerY + STEP_HEIGHT;
  const forward = world.shapeCast({
    ...SOLID_QUERY, shape: STEP_CAPSULE,
    x: meters(player.x), y: meters(liftedY), z: meters(player.z),
    dx: dx / wanted, dy: 0, dz: dz / wanted, maxDistance: meters(wanted),
  });
  if (forward.length > 0) return direct;

  const landings = world.shapeCast({
    ...SOLID_QUERY, shape: STEP_CAPSULE,
    x: meters(x), y: meters(liftedY), z: meters(z),
    dx: 0, dy: -1, dz: 0, maxDistance: meters(STEP_HEIGHT + 0.02),
  });
  for (const hit of landings) {
    if (hit.normal.y >= 0 || hit.distance <= 0) continue;
    const y = liftedY - hit.distance + 0.001;
    const rise = y - centerY;
    if (rise > STEP_HEIGHT + 0.001) continue;
    if (hit.point.y - (centerY - HALF_HEIGHT - PLAYER_RADIUS - 2 * SKIN_WIDTH) > STEP_HEIGHT + 0.001) continue;
    // A capsule corner normal is not the surface slope. Check the top face.
    const surface = world.raycast({
      ...SOLID_QUERY,
      x: meters(hit.point.x + hit.normal.x * 0.01), y: meters(hit.point.y + 0.02), z: meters(hit.point.z + hit.normal.z * 0.01),
      dx: 0, dy: -1, dz: 0, maxDistance: meters(0.04),
    })[0];
    if (!surface || surface.bodyId !== hit.bodyId || surface.normal.y < WALKABLE_NORMAL_Y) continue;
    const inside = world.overlap({ ...SOLID_QUERY, shape: STEP_CAPSULE, x: meters(x), y: meters(y), z: meters(z) });
    if (inside.length > 0) continue;
    return { x, y: y - HALF_HEIGHT, z, grounded: true, velocity: [velocity[0], 0, velocity[2]] as Vec3 };
  }
  return direct;
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
      hitTriggers: false, hitSensors: false, maxPortalDepth: 0,
    }).find((hit) => hit.normal.y > 0.5);
    if (ceiling) vertical = Math.max(0, ceiling.distance - 0.01);
  }
  const elevator = physicsBodyById(physics, ELEVATOR.id);
  const top = elevator ? elevator.y + ELEVATOR.size[1] / 2 : Number.NEGATIVE_INFINITY;
  const platforms = elevator && player.y - PLAYER_RADIUS >= top - 0.08 ? [{
    id: ELEVATOR.id, minX: ELEVATOR.x - ELEVATOR.size[0] / 2, maxX: ELEVATOR.x + ELEVATOR.size[0] / 2,
    minZ: ELEVATOR.z - ELEVATOR.size[2] / 2, maxZ: ELEVATOR.z + ELEVATOR.size[2] / 2,
    y: top + PLAYER_RADIUS + HALF_HEIGHT, dxPerFrame: 0, dzPerFrame: 0,
  }] : [];
  const result = stepDeterministicKcc3D({
    x: player.x, y: centerY, z: player.z,
    vx: velocity[0] * DT, vy: vertical, vz: velocity[2] * DT,
    radius: PLAYER_RADIUS, halfHeight: HALF_HEIGHT, skinWidth: SKIN_WIDTH,
    grounded: player.grounded, coyoteFrames: 0, jumpBufferFrames: 0,
  }, { moveX: velocity[0] * DT, moveZ: velocity[2] * DT }, {
    ...MOVEMENT_BOUNDS,
    movingPlatforms: platforms,
    maxSlopeRisePerUnit: MAX_SLOPE_RISE, stepHeight: STEP_HEIGHT,
  }, {
    frame: Number(physics.world.info().frame),
    behaviorRevision: 3,
    physics: queries,
    groundOnStaticBodies: true,
    standOnDynamicBodies: true,
    // Gravity and jetpack acceleration already ran in the game step.
    gravityPerFrame: frameGravity(0),
  });
  return {
    x: result.body.x, y: result.body.y - HALF_HEIGHT, z: result.body.z,
    grounded: result.body.grounded,
    velocity: [result.body.vx / DT, result.body.vy / DT, result.body.vz / DT] as Vec3,
  };
}
