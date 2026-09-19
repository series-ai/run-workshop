import { describe, expect, it } from 'vitest';
import {
  buildCar,
  buildConcreteBlock,
  buildDebrisChips,
} from './voxelProps';
import { meshVoxelGrids, type VoxelPlacement } from './voxelMesher';
import { DRESSING_LAYOUT } from './layout';

describe('voxelProps and voxelMesher (T7, R6, A6)', () => {
  it('builders give deterministic output for the same seed', () => {
    const carA = buildCar(42, 'signalOrange', 0.2);
    const carB = buildCar(42, 'signalOrange', 0.2);
    expect(carA.cells).toEqual(carB.cells);

    const blockA = buildConcreteBlock(101, [4, 4, 4]);
    const blockB = buildConcreteBlock(101, [4, 4, 4]);
    expect(blockA.cells).toEqual(blockB.cells);

    const chipsA = buildDebrisChips(7, 30);
    const chipsB = buildDebrisChips(7, 30);
    expect(chipsA.cells).toEqual(chipsB.cells);
  });

  it('removes all interior faces of a solid 4x4x4 grid (12 triangles after greedy merge)', () => {
    // A solid 4x4x4 block has 6 outer faces.
    // When greedily merged, each of the 6 sides becomes 1 quad = 2 triangles.
    // 6 sides * 2 triangles = 12 triangles!
    const solidBlock = buildConcreteBlock(0, [4, 4, 4]);
    const placement: VoxelPlacement = {
      grid: solidBlock,
      position: [0, 0, 0],
      rotationY: 0,
      scale: 0.2,
    };

    const mesh = meshVoxelGrids([placement]);
    const triangleCount = mesh.indices.length / 3;
    expect(triangleCount).toBe(12);
  });

  it('full dressing layout meets the <= 250,000 triangles budget', () => {
    const mesh = meshVoxelGrids(DRESSING_LAYOUT);
    const triangleCount = mesh.indices.length / 3;
    expect(triangleCount).toBeGreaterThan(100);
    expect(triangleCount).toBeLessThanOrEqual(250_000);
  });
});
