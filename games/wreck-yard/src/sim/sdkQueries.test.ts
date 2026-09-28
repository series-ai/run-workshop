import { describe, expect, it } from 'vitest';
import { createPhysicsWorld3D, createVoxelChunk, cookVoxelBody } from '@series-inc/rundot-syncplay/physics/3d';
import { movePlayer } from './movement';
import { createInitialPlayer } from './state';
import './physics';

describe('Syncplay voxel query boundary', () => {
  // Regression for https://github.com/series-ai/venus/issues/4821 (fixed in 6.0.0-rc.8).
  it('runs capsule queries in a world with a cooked voxel body', () => {
    const world = createPhysicsWorld3D({ capacity: { bodies: 2, joints: 0 } });
    try {
      const chunk = createVoxelChunk(2, 1, 1, 0.08);
      chunk.occupancy.fill(1);
      const cooked = cookVoxelBody(chunk, 1);
      if (cooked.status !== 0) throw new Error('test voxel cook failed');
      world.edit((edit) => edit.createBody({ ...cooked.body, kind: 'static', position: { x: 0, y: 0, z: 0 } }));
      const location = { x: 0, y: 10, z: 0 };
      expect(world.overlap({ ...location, shape: { type: 'capsule', radius: 0.4, halfHeight: 0.5 } })).toEqual([]);
      expect(movePlayer({ world, bodyIds: new Map() }, { ...createInitialPlayer(), ...location }, [0, -1, 0]).y).toBeLessThan(10);
    } finally {
      world.dispose();
    }
  });
});
