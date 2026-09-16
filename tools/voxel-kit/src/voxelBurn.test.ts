import { describe, expect, it } from 'vitest';
import {
  carveCapsule,
  carveParallelogram,
  carveSphere,
  makeEmptyVoxelField,
  scorchCapsuleShell,
  scorchParallelogramShell,
  scorchSphereShell,
  stampBox,
} from './voxelToolkit';

describe('voxel burn shell', () => {
  it('marks occupied voxels around the carve radius with a burn material', () => {
    const dims = { x: 12, y: 12, z: 12 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 10, y: 10, z: 10 }, 3);

    const scorched = scorchSphereShell(voxels, dims, { x: 6, y: 6, z: 6 }, 2.8, 4.2, 5);

    expect(scorched.some((value) => value === 5)).toBe(true);
    expect(scorched.some((value) => value === 3)).toBe(true);
  });

  it('keeps the interior carve removable after scorching', () => {
    const dims = { x: 12, y: 12, z: 12 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 10, y: 10, z: 10 }, 3);

    const scorched = scorchSphereShell(voxels, dims, { x: 6, y: 6, z: 6 }, 2.8, 4.2, 5);
    const carved = carveSphere(scorched, dims, { x: 6, y: 6, z: 6 }, 2.8);

    const centerIndex = 6 + 6 * dims.x + 6 * dims.x * dims.y;
    expect(carved[centerIndex]).toBe(0);
    expect(carved.some((value) => value === 5)).toBe(true);
  });

  it('supports a swept torch path so narrow cuts follow drag motion', () => {
    const dims = { x: 18, y: 8, z: 8 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 1, y: 1, z: 1 }, { x: 16, y: 6, z: 6 }, 3);

    const scorched = scorchCapsuleShell(
      voxels,
      dims,
      { x: 4, y: 4, z: 4 },
      { x: 13, y: 4, z: 4 },
      1.2,
      2.1,
      5,
    );
    const carved = carveCapsule(
      scorched,
      dims,
      { x: 4, y: 4, z: 4 },
      { x: 13, y: 4, z: 4 },
      1.2,
    );

    const trenchCenter = 9 + 4 * dims.x + 4 * dims.x * dims.y;
    const untouchedCorner = 2 + 2 * dims.x + 2 * dims.x * dims.y;

    expect(carved[trenchCenter]).toBe(0);
    expect(carved[untouchedCorner]).toBe(3);
    expect(carved.some((value) => value === 5)).toBe(true);
  });

  it('carves and scorches a thin through-cut planar ribbon without vaporizing the object', () => {
    const dims = { x: 20, y: 10, z: 10 };
    const voxels = makeEmptyVoxelField(dims);
    stampBox(voxels, dims, { x: 0, y: 0, z: 0 }, { x: 19, y: 9, z: 9 }, 3);

    const scorched = scorchParallelogramShell(
      voxels,
      dims,
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 9, z: 0 },
      { x: 10, y: 0, z: 9 },
      { x: 10, y: 9, z: 9 },
      1.0,
      2.0,
      5,
    );
    const carved = carveParallelogram(
      scorched,
      dims,
      { x: 10, y: 0, z: 0 },
      { x: 10, y: 9, z: 0 },
      { x: 10, y: 0, z: 9 },
      { x: 10, y: 9, z: 9 },
      1.0,
    );

    // The center plane (x=10) should be completely carved out
    for (let y = 0; y < 10; y += 1) {
      for (let z = 0; z < 10; z += 1) {
        expect(carved[10 + y * dims.x + z * dims.x * dims.y]).toBe(0);
      }
    }
    // Far sides should be completely intact and still material 3
    expect(carved[2 + 5 * dims.x + 5 * dims.x * dims.y]).toBe(3);
    expect(carved[18 + 5 * dims.x + 5 * dims.x * dims.y]).toBe(3);
    // Over 80% of voxels should still be preserved (nice thin cut!)
    let occupied = 0;
    for (let i = 0; i < carved.length; i += 1) if (carved[i] !== 0) occupied += 1;
    expect(occupied).toBeGreaterThan(1600); // 2000 total, only ~300 removed
  });
});
