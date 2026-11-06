import { makeEmptyVoxelField, stampBox } from 'voxel-kit';

export const ROAD_WORKER_DIMS = { x: 10, y: 14, z: 12 };
export const ROAD_WORKER_LABEL = 'Road Worker';

/** Separate color codes keep damaged parts identifiable after native fracture. */
export const ROAD_WORKER_PARTS = [
  { name: 'left-track', code: 32, from: [0, 0, 2], to: [1, 3, 9], finish: 'ink' },
  { name: 'right-track', code: 33, from: [8, 0, 2], to: [9, 3, 9], finish: 'ink' },
  { name: 'chassis', code: 34, from: [2, 2, 2], to: [7, 4, 8], finish: 'trim' },
  { name: 'torso', code: 35, from: [2, 5, 3], to: [7, 8, 7], finish: 'paint' },
  { name: 'neck', code: 36, from: [4, 9, 4], to: [5, 9, 6], finish: 'steel' },
  { name: 'head', code: 37, from: [2, 10, 3], to: [7, 12, 7], finish: 'paint' },
  { name: 'cap', code: 38, from: [1, 13, 2], to: [8, 13, 8], finish: 'paint' },
  { name: 'left-fork', code: 39, from: [1, 4, 8], to: [2, 5, 11], finish: 'steel' },
  { name: 'right-fork', code: 40, from: [7, 4, 8], to: [8, 5, 11], finish: 'steel' },
] as const;

export type RoadWorkerPart = typeof ROAD_WORKER_PARTS[number];

export function roadWorkerPreset() {
  const dims = ROAD_WORKER_DIMS;
  const voxels = makeEmptyVoxelField(dims);
  for (const part of ROAD_WORKER_PARTS) {
    const [x, y, z] = part.from;
    const [bx, by, bz] = part.to;
    stampBox(voxels, dims, { x, y, z }, { x: bx, y: by, z: bz }, part.code);
  }
  return { dims, voxels };
}

