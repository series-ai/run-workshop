import { describe, expect, it } from 'vitest';
import { createPhysicsWorld3D, createVoxelChunk, cookVoxelBody } from '@series-inc/rundot-syncplay/physics/3d';
import { movePlayer } from './movement';
import { createInitialPlayer } from './state';
import './physics';

describe('Syncplay RC.5 voxel query boundary', () => {
  it('reproduces the native capsule query failure with one cooked body', () => {
    const world = createPhysicsWorld3D({ capacity: { bodies: 2, joints: 0 } });
    try {
      const chunk = createVoxelChunk(2, 1, 1, 0.08);
      chunk.occupancy.fill(1);
      const cooked = cookVoxelBody(chunk, 1);
      if (cooked.status !== 0) throw new Error('test voxel cook failed');
      world.edit((edit) => edit.createBody({ ...cooked.body, kind: 'static', position: { x: 0, y: 0, z: 0 } }));
      const location = { x: 0, y: 10, z: 0 };
      expect(() => world.overlap({ ...location, shape: { type: 'capsule', radius: 0.4, halfHeight: 0.5 } }))
        .toThrow('WORLD_NATIVE_INVALID_BODY');
      expect(world.overlap({ ...location, shape: { type: 'box', halfX: 0.4, halfY: 0.9, halfZ: 0.4 } })).toEqual([]);
      expect(movePlayer({ world, bodyIds: new Map() }, { ...createInitialPlayer(), ...location }, [0, -1, 0]).y).toBeLessThan(10);
    } finally {
      world.dispose();
    }
  });
});
