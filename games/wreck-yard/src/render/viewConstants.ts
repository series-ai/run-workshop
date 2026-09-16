import type { WorldOcclusionSpec } from 'voxel-kit';

export const CAMERA_BASE = [7.6, 3.6, 8.6] as const;
export const CAMERA_LOOK_AT = [1.1, 0.55, 0.35] as const;
export const WORLD_SUN_DIRECTION: [number, number, number] = [0.5327, 0.7943, 0.2422];

export const WORLD_OCCLUSION_SPEC: WorldOcclusionSpec = {
  dims: { x: 80, y: 48, z: 80 },
  min: [-5.8, -1.6, -5.8],
  max: [6.8, 4.6, 5.8],
};
