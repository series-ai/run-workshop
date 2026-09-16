import { describe, expect, it } from 'vitest';
import { makeVoxelBox } from './voxelToolkit';
import {
  buildWorldOcclusionVolume,
  fillWorldOcclusionVolume,
  hasWorldOcclusionPoseChanges,
  sampleWorldOcclusion,
  type WorldOcclusionPose,
  type WorldOcclusionSpec,
} from './worldOcclusion';

const spec: WorldOcclusionSpec = {
  dims: { x: 16, y: 12, z: 16 },
  min: [-4, -2, -4],
  max: [4, 4, 4],
};

describe('world occlusion volume', () => {
  it('rasterizes static box occluders into the world volume', () => {
    const volume = buildWorldOcclusionVolume(spec, [], [
      { center: [0, 0, 0], size: [2, 2, 2] },
    ], 0.5);

    expect(sampleWorldOcclusion(volume, spec, [0, 0, 0])).toBe(1);
    expect(sampleWorldOcclusion(volume, spec, [3.5, 0, 0])).toBe(0);
  });

  it('rasterizes rotated voxel bodies into the shared volume', () => {
    const voxels = makeVoxelBox({ x: 4, y: 4, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 3, y: 3, z: 7 }, 1);
    const sin = Math.sin(Math.PI * 0.25);
    const cos = Math.cos(Math.PI * 0.25);
    const volume = buildWorldOcclusionVolume(spec, [
      {
        dims: { x: 4, y: 4, z: 8 },
        voxels,
        position: [1, 0, 1],
        rotation: [0, sin, 0, cos],
      },
    ], [], 0.5);

    expect(sampleWorldOcclusion(volume, spec, [1, 0, 1])).toBe(1);
    expect(sampleWorldOcclusion(volume, spec, [-3.5, 0, -3.5])).toBe(0);
  });

  it('ignores tiny pose jitter when deciding whether to refresh the shared volume', () => {
    const previous: WorldOcclusionPose[] = [
      { id: 'crate', position: [1, 0, 1], rotation: [0, 0, 0, 1] },
    ];
    const next: WorldOcclusionPose[] = [
      { id: 'crate', position: [1.01, 0.01, 1.01], rotation: [0, 0.001, 0, 0.9999995] },
    ];

    expect(hasWorldOcclusionPoseChanges(previous, next)).toBe(false);
  });

  it('detects meaningful body movement for occlusion refresh', () => {
    const previous: WorldOcclusionPose[] = [
      { id: 'crate', position: [1, 0, 1], rotation: [0, 0, 0, 1] },
    ];
    const next: WorldOcclusionPose[] = [
      { id: 'crate', position: [1.12, 0, 1], rotation: [0, 0, 0, 1] },
    ];

    expect(hasWorldOcclusionPoseChanges(previous, next)).toBe(true);
  });

  it('clips a static box that extends past the volume to its overlap only', () => {
    const spec = { dims: { x: 8, y: 8, z: 8 }, min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
    const target = new Uint8Array(8 * 8 * 8);
    fillWorldOcclusionVolume(target, spec, [], [{ center: [0, -0.875, 0], size: [10, 0.25, 10] }], 0.08);
    const filled = target.reduce((sum, v) => sum + (v ? 1 : 0), 0);
    expect(filled).toBe(8 * 8);
  });
});

