import { makeEmptyVoxelField, stampBox } from 'voxel-kit';
import { VOXEL_SIZE } from './constants';
import { LAVA } from './liquidAssets';
import { IDENTITY_QUAT } from './math';
import { PROP_COLOR } from './props';
import type { Spawn } from './presets';

/** A steel fist with a raised thumb. It uses the same voxels as other props. */
export function lavaHandSpawn(): Spawn {
  const dims = { x: 14, y: 24, z: 8 };
  const voxels = makeEmptyVoxelField(dims);
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number = PROP_COLOR.metal) =>
    stampBox(voxels, dims, { x: x0, y: y0, z: z0 }, { x: x1, y: y1, z: z1 }, color);
  box(3, 0, 1, 9, 11, 6);
  box(2, 10, 1, 9, 17, 6);
  for (const x of [2, 4, 6, 8]) {
    box(x, 15, 4, x + 1, 19, 7);
    box(x, 18, 6, x + 1, 19, 7, PROP_COLOR.grey);
  }
  for (const x of [3, 5, 7]) {
    box(x, 18, 4, x, 19, 7, 0);
    box(x, 15, 7, x, 17, 7, PROP_COLOR.ink);
  }
  box(8, 12, 2, 11, 17, 5);
  box(10, 15, 2, 12, 23, 5);
  box(10, 20, 5, 12, 20, 5, PROP_COLOR.ink);
  box(4, 10, 6, 4, 10, 6, PROP_COLOR.white);
  box(8, 10, 6, 8, 10, 6, PROP_COLOR.white);
  box(3, 6, 6, 9, 7, 6, PROP_COLOR.ink);
  return {
    body: { id: 'lava-hand', label: 'Steel Hand', material: 'steel', dims, voxels, motion: 'dynamic', buoyancy: 0, anchorFaces: [], impactCooldownUntil: 0, heat: null },
    position: [LAVA.center[0], LAVA.bottomY + dims.y * VOXEL_SIZE / 2 + 0.01, LAVA.center[2]],
    rotation: IDENTITY_QUAT,
  };
}
