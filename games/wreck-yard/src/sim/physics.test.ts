import { describe, expect, it } from 'vitest';
import { makeEmptyVoxelField, stampBox } from 'voxel-kit';
import { VOXEL_SIZE } from './constants';
import { bodyMass, cookCenteredCollider, makePhysicsBody, voxelStats } from './physics';
import { createInitialState } from './presets';
import type { YardBody } from './state';

describe('cookCenteredCollider', () => {
  it('centers a solid 2x1x1 volume on the body origin', () => {
    const dims = { x: 2, y: 1, z: 1 };
    const voxels = new Uint8Array([1, 1]);
    const shape = cookCenteredCollider(voxels, dims);
    expect(shape.children).toHaveLength(1);
    expect(shape.children[0]!.offset).toEqual({ x: 0, y: 0, z: 0 });
    expect(shape.children[0]!.shape).toEqual({ type: 'box', halfX: VOXEL_SIZE, halfY: VOXEL_SIZE * 0.5, halfZ: VOXEL_SIZE * 0.5 });
  });
});

describe('voxelStats and bodyMass', () => {
  it('counts occupied voxels once and caches by array identity', () => {
    const dims = { x: 4, y: 4, z: 4 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 3);
    const a = voxelStats(voxels, dims);
    expect(a.occupiedCount).toBe(8);
    expect(voxelStats(voxels, dims)).toBe(a);
    const body: YardBody = { id: 'b', label: 'b', dims, voxels, motion: 'dynamic', buoyancy: 0, anchorFaces: [], impactCooldownUntil: 0 };
    expect(bodyMass(body)).toBeCloseTo(8 * VOXEL_SIZE ** 3 * 1.5, 9);
  });
});

describe('createInitialState', () => {
  it('spawns five bodies, a physics body per yard body, and the shell', () => {
    const state = createInitialState(2);
    expect(state.bodies.map((b) => b.id)).toEqual(['steel-case', 'timber-pallet', 'steel-gantry', 'float-crate', 'ballast-box']);
    expect(state.players).toHaveLength(2);
    for (const body of state.bodies) {
      const physics = state.world.bodies.find((p) => p.id === body.id);
      expect(physics?.kind).toBe(body.motion === 'fixed' ? 'static' : 'dynamic');
    }
    expect(state.world.bodies.filter((b) => b.id.startsWith('shell:'))).toHaveLength(10);
  });

  it('makes a static physics body without orientation', () => {
    const body: YardBody = { id: 'g', label: 'g', dims: { x: 1, y: 1, z: 1 }, voxels: new Uint8Array([2]), motion: 'fixed', buoyancy: 0, anchorFaces: ['-x'], impactCooldownUntil: 0 };
    const physics = makePhysicsBody(body, { position: [1, 2, 3], rotation: [0, 0, 0, 1], linearVelocity: [0, 0, 0], angularVelocity: [0, 0, 0] });
    expect(physics.body.kind).toBe('static');
    expect(physics.body.orientation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });
});
