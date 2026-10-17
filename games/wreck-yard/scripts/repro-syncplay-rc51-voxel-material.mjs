// Run with: node scripts/repro-syncplay-rc51-voxel-material.mjs
import assert from 'node:assert/strict';
import {
  carveVoxelBody3D, createPhysicsWorld3D, createVoxelBody3D,
  createVoxelChunk, initPhysics3D, kilograms, meters, vec3,
} from '@series-inc/rundot-syncplay/physics/3d';

await initPhysics3D();
const world = createPhysicsWorld3D({
  tickRate: 30,
  capacity: { bodies: 4, joints: 0, checkpoints: 2 },
  materials: [{ key: 'steel', friction: 0.62, restitution: 0.1 }],
});

try {
  const chunk = createVoxelChunk(4, 4, 4, meters(0.1));
  chunk.occupancy.fill(1);
  const state = createVoxelBody3D(world, {
    key: 'material-probe', kind: 'dynamic', material: 'steel',
    position: vec3(meters, 0, 2, 0),
  }, chunk, kilograms(1));
  const read = () => world.readBody(world.resolveBody(state.bodyId));
  const before = read().materialSource;
  assert.deepEqual(before, { kind: 'named', material: 'steel' }, 'The probe must start with a named material.');
  const result = carveVoxelBody3D(world, state, {
    op: 'carve', shapeType: 'box',
    box: { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 3, maxZ: 3 },
  });
  assert.equal(result.changed, true, 'The cut must change the voxel body.');
  assert.equal(result.state.status, 'live', 'The cut must leave a body.');
  const after = read().materialSource;
  console.log(JSON.stringify({ before, after }));
  assert.deepEqual(after, { kind: 'inline' }, 'The recorded rc.51 fault changed. Check the new result before removing the workaround.');
  console.log('SYNCPLAY_VOXEL_MATERIAL_LOSS_REPRODUCED');
} finally {
  world.dispose();
}
