// Run with: node scripts/repro-syncplay-kcc-standing.mjs
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stepDeterministicKcc3D } from '@series-inc/rundot-syncplay/browser';
import {
  cookVoxelBody, createPhysicsWorld3D, createVoxelChunk, initPhysics3D,
  kilograms, meters, metersPerSecondSquared, vec3,
} from '@series-inc/rundot-syncplay/physics/3d';

await initPhysics3D();

// Load an isolated repair for verification. Keep the installed SDK unchanged.
const repairFlag = process.argv.find((value) => value.startsWith('--repair-module='));
let stepCharacter = stepDeterministicKcc3D;
if (repairFlag) {
  const repairPath = repairFlag.slice('--repair-module='.length);
  if (!isAbsolute(repairPath)) throw new Error('The repair module path must be absolute.');
  const repair = await import(pathToFileURL(repairPath).href);
  if (typeof repair.stepDeterministicKccRevision1_3D !== 'function') throw new Error('The repair must export the revision 1 controller.');
  stepCharacter = (body, input, bounds, options) => {
    if (options.behaviorRevision !== 1) throw new Error('Use --revision=1 with a revision 1 repair.');
    return repair.stepDeterministicKccRevision1_3D(body, input, bounds, options, options.gravityPerFrame, options.checksumMode);
  };
}

const GEOMETRY = { radius: 0.4, halfHeight: 0.5, skinWidth: 0.005 };
const PROBE = { type: 'capsule', radius: meters(0.405), halfHeight: meters(0.505) };
const BOUNDS = {
  minX: -20, maxX: 20, minY: -10, maxY: 40, minZ: -20, maxZ: 20,
  maxSlopeRisePerUnit: 0.8, stepHeight: 0.5,
};
const MOVE_FRAMES = 14;
const MOVE_DISTANCE = 0.04;
const EXPECTED_TRAVEL = MOVE_FRAMES * MOVE_DISTANCE;
const chunk = createVoxelChunk(32, 16, 32, meters(0.08));
chunk.occupancy.fill(1);
const voxel = cookVoxelBody(chunk, kilograms(10), {
  originOffset: vec3(meters, -31 * 0.04, -15 * 0.04, -31 * 0.04),
}).body;
const box = { type: 'box', halfX: meters(1.28), halfY: meters(0.64), halfZ: meters(1.28) };
const roof = {
  type: 'compound', children: [
    { shape: { ...box, halfY: meters(0.08) }, offset: vec3(meters, 0, 0.56, 0) },
    { shape: { ...box, halfX: meters(0.08) }, offset: vec3(meters, -1.2, 0, 0) },
    { shape: { ...box, halfX: meters(0.08) }, offset: vec3(meters, 1.2, 0, 0) },
  ],
};
const cases = [
  { id: 'static-flat-box', kind: 'static', shape: box, tilt: 0 },
  { id: 'static-tilted-voxel', kind: 'static', shape: voxel.shape, tilt: 0.1 },
  { id: 'dynamic-flat-voxel', kind: 'dynamic', shape: voxel.shape, tilt: 0 },
  { id: 'dynamic-tilted-voxel', kind: 'dynamic', shape: voxel.shape, tilt: 0.1 },
  { id: 'dynamic-small-tilt-voxel', kind: 'dynamic', shape: voxel.shape, tilt: 0.03 },
  { id: 'dynamic-flat-hollow-roof', kind: 'dynamic', shape: roof, tilt: 0 },
  { id: 'dynamic-tilted-hollow-roof', kind: 'dynamic', shape: roof, tilt: 0.1 },
  { id: 'static-roof-edge-drop', kind: 'static', shape: box, tilt: 0, startX: 1.4 },
  { id: 'dynamic-roof-edge-drop', kind: 'dynamic', shape: voxel.shape, tilt: 0, startX: 1.4 },
  { id: 'static-roof-corner-drop', kind: 'static', shape: box, tilt: 0, startX: 1.4, startZ: 1.4 },
  { id: 'dynamic-roof-corner-drop', kind: 'dynamic', shape: voxel.shape, tilt: 0, startX: 1.4, startZ: 1.4 },
];

function runCase(fixture, behaviorRevision, moveX, moveZ) {
  const physics = createPhysicsWorld3D({
    tickRate: 30, initialGravity: vec3(metersPerSecondSquared, 0, 0, 0),
    capacity: { bodies: 4, joints: 0 },
  });
  try {
    physics.edit((edit) => {
      edit.createBody({
        kind: 'static', key: 'floor', position: vec3(meters, 0, -0.96, 0),
        shape: { type: 'box', halfX: meters(10), halfY: meters(0.1), halfZ: meters(10) },
      });
      edit.createBody({
        kind: fixture.kind, key: 'prop', shape: fixture.shape,
        position: vec3(meters, 0, 0, 0), mass: kilograms(10), inertia: voxel.inertia,
        orientation: { x: 0, y: 0, z: Math.sin(fixture.tilt / 2), w: Math.cos(fixture.tilt / 2) },
        gravityScale: 0,
      });
    });
    let body = {
      ...GEOMETRY, x: fixture.startX ?? 0, y: 3, z: fixture.startZ ?? 0, vx: 0, vy: 0, vz: 0,
      grounded: false, coyoteFrames: 0, jumpBufferFrames: 0,
    };
    let start;
    let groundedFrames = 0;
    let overlapFrames = 0;
    let lastEvents = [];
    for (let frame = 0; frame < 60 + MOVE_FRAMES; frame += 1) {
      physics.step();
      if (frame === 60) start = { x: body.x, y: body.y, z: body.z };
      const result = stepCharacter(body, {
        moveX: frame >= 60 ? moveX : 0, moveZ: frame >= 60 ? moveZ : 0,
      }, BOUNDS, {
        frame, physics, behaviorRevision, gravityPerFrame: -0.015,
        groundOnStaticBodies: true, standOnDynamicBodies: true, checksumMode: 'disabled',
      });
      body = result.body;
      lastEvents = result.events;
      if (frame >= 60) {
        groundedFrames += Number(body.grounded);
        overlapFrames += Number(physics.overlap({
          shape: PROBE, x: meters(body.x), y: meters(body.y), z: meters(body.z),
          hitTriggers: false, hitSensors: false, maxPortalDepth: 0,
        }).length > 0);
      }
    }
    const travel = ((body.x - start.x) * moveX + (body.z - start.z) * moveZ) / MOVE_DISTANCE;
    const overlaps = physics.overlap({
      shape: PROBE, x: meters(body.x), y: meters(body.y), z: meters(body.z),
      hitTriggers: false, hitSensors: false, maxPortalDepth: 0,
    });
    return {
      case: fixture.id, behaviorRevision, direction: [moveX / MOVE_DISTANCE, moveZ / MOVE_DISTANCE],
      expectedTravel: fixture.startX !== undefined && moveX < 0 ? 0 : EXPECTED_TRAVEL,
      travel, groundedFrames,
      expectedGroundedFrames: MOVE_FRAMES, overlapFrames, expectedOverlapFrames: 0,
      start, end: { x: body.x, y: body.y, z: body.z },
      support: body.support ?? body.platformId ?? null, lastEvents,
      overlaps: overlaps.map((hit) => ({ key: hit.bodyKey, point: hit.point, normal: hit.normal })),
    };
  } finally {
    physics.dispose();
  }
}

const results = [];
const revisionFlag = process.argv.find((value) => value.startsWith('--revision='));
const revisions = revisionFlag ? [Number(revisionFlag.slice('--revision='.length))] : [1, 2];
if (revisions.some((revision) => revision !== 1 && revision !== 2 && revision !== 3)) throw new Error('Use --revision=1, --revision=2, or --revision=3');
for (const behaviorRevision of revisions) {
  for (const fixture of cases) {
    for (const [moveX, moveZ] of [[MOVE_DISTANCE, 0], [-MOVE_DISTANCE, 0], [0, MOVE_DISTANCE]]) {
      if (fixture.startZ !== undefined && moveX < 0) continue;
      results.push(runCase(fixture, behaviorRevision, moveX, moveZ));
    }
  }
}
const failures = results.filter((result) => Math.abs(result.travel - result.expectedTravel) > 0.03 || result.overlapFrames > 0 || result.groundedFrames !== result.expectedGroundedFrames).length;
const version = JSON.parse(readFileSync(new URL('../node_modules/@series-inc/rundot-syncplay/package.json', import.meta.url), 'utf8')).version;
console.log(JSON.stringify({
  package: '@series-inc/rundot-syncplay', version, artifact: repairFlag ? 'isolated controller repair with installed WASM' : 'installed WASM',
  sequence: { settleFrames: 60, moveFrames: MOVE_FRAMES, moveDistance: MOVE_DISTANCE },
  failures,
  results,
}, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

if (process.argv.includes('--assert') && failures > 0) process.exitCode = 1;
