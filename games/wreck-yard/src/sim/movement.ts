import type { PhysicsOverlapQuery3D, PhysicsWorld3D } from '@series-inc/rundot-syncplay/physics/3d';
import { stepDeterministicKcc3D } from '@series-inc/rundot-syncplay/browser';
import { ARENA_EXTENT, DT, FLOOR_Y, PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import type { Vec3 } from './math';
import type { OpenYardPhysicsWorld } from './physics';
import type { PlayerState } from './state';

/**
 * The KCC queries with the capsule's bounding box. In Syncplay 6.0.0-rc.8,
 * capsule queries work with voxel bodies but cost ~150x a box query (9.5 ms
 * each with 30 voxel bodies), which doubled the tick. Box queries stop the
 * player a few cm early at the corners of turned boxes.
 */
function boxQueryShape(shape: PhysicsOverlapQuery3D['shape']): PhysicsOverlapQuery3D['shape'] {
  return shape.type === 'capsule'
    ? { type: 'box', halfX: shape.radius, halfY: shape.halfHeight + shape.radius, halfZ: shape.radius }
    : shape;
}

function characterQueries(world: PhysicsWorld3D): PhysicsWorld3D {
  return {
    ...world,
    overlap: (query) => world.overlap({ ...query, shape: boxQueryShape(query.shape) }),
    shapeCast: (query) => world.shapeCast({ ...query, shape: boxQueryShape(query.shape) }),
  };
}

const HALF_HEIGHT = PLAYER_HEIGHT * 0.5 - PLAYER_RADIUS;

/** Convert game velocities to the KCC's meters per frame at this boundary. */
export function movePlayer(physics: OpenYardPhysicsWorld, player: PlayerState, velocity: Vec3) {
  const queries = characterQueries(physics.world);
  const centerY = player.y + HALF_HEIGHT;
  let vertical = velocity[1] * DT;
  if (vertical > 0) {
    const ceiling = queries.shapeCast({
      x: player.x, y: centerY, z: player.z,
      shape: { type: 'capsule', radius: PLAYER_RADIUS, halfHeight: HALF_HEIGHT },
      dx: 0, dy: 1, dz: 0, maxDistance: vertical,
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
    maxSlopeRisePerUnit: 0.8, stepHeight: 0.3,
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
