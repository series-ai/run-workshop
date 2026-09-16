import { describe, expect, it } from 'vitest';
import { buildMacroOccupancyVolume, sampleMacroOccupancy } from './voxelAcceleration';
import { makeEmptyVoxelField } from './voxelToolkit';

describe('voxel acceleration volume', () => {
  it('marks coarse cells occupied when any fine voxel exists inside them', () => {
    const dims = { x: 8, y: 8, z: 8 };
    const voxels = makeEmptyVoxelField(dims);
    voxels[1 + 1 * dims.x + 1 * dims.x * dims.y] = 3;
    voxels[6 + 4 * dims.x + 7 * dims.x * dims.y] = 4;

    const macro = buildMacroOccupancyVolume(voxels, dims, 4);

    expect(macro.dims).toEqual({ x: 2, y: 2, z: 2 });
    expect(sampleMacroOccupancy(macro, 0, 0, 0)).toBe(1);
    expect(sampleMacroOccupancy(macro, 1, 1, 1)).toBe(1);
    expect(sampleMacroOccupancy(macro, 1, 0, 0)).toBe(0);
  });
});
