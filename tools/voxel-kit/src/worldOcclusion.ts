import { rotateVector } from './deterministicMath';

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];
export type VoxelDims = { x: number; y: number; z: number };

export type WorldOcclusionSpec = {
  dims: VoxelDims;
  min: Vec3Tuple;
  max: Vec3Tuple;
};

export type WorldOcclusionStaticBox = {
  center: Vec3Tuple;
  size: Vec3Tuple;
};

export type WorldOcclusionBody = {
  dims: VoxelDims;
  voxels: Uint8Array;
  position: Vec3Tuple;
  rotation: QuatTuple;
};

export type WorldOcclusionPose = {
  id: string;
  position: Vec3Tuple;
  rotation: QuatTuple;
};

const indexOf = (dims: VoxelDims, x: number, y: number, z: number): number => {
  return x + y * dims.x + z * dims.x * dims.y;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rotationSimilarity(a: QuatTuple, b: QuatTuple): number {
  return Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
}

export function hasWorldOcclusionPoseChanges(
  previous: WorldOcclusionPose[],
  next: WorldOcclusionPose[],
  positionTolerance = 0.035,
  rotationSimilarityTolerance = 0.9994,
): boolean {
  if (previous.length !== next.length) {
    return true;
  }

  for (let index = 0; index < previous.length; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (!before || !after || before.id !== after.id) {
      return true;
    }

    const dx = before.position[0] - after.position[0];
    const dy = before.position[1] - after.position[1];
    const dz = before.position[2] - after.position[2];
    if ((dx * dx + dy * dy + dz * dz) > positionTolerance * positionTolerance) {
      return true;
    }

    if (rotationSimilarity(before.rotation, after.rotation) < rotationSimilarityTolerance) {
      return true;
    }
  }

  return false;
}

function worldToCell(point: Vec3Tuple, spec: WorldOcclusionSpec) {
  const nx = (point[0] - spec.min[0]) / (spec.max[0] - spec.min[0]);
  const ny = (point[1] - spec.min[1]) / (spec.max[1] - spec.min[1]);
  const nz = (point[2] - spec.min[2]) / (spec.max[2] - spec.min[2]);

  const x = Math.floor(nx * spec.dims.x);
  const y = Math.floor(ny * spec.dims.y);
  const z = Math.floor(nz * spec.dims.z);

  if (x < 0 || y < 0 || z < 0 || x >= spec.dims.x || y >= spec.dims.y || z >= spec.dims.z) {
    return null;
  }

  return { x, y, z };
}

/** Cell index per axis, clamped to the volume, for box corners that may lie outside it. */
function clampedCell(point: Vec3Tuple, spec: WorldOcclusionSpec): { x: number; y: number; z: number } {
  const axis = (value: number, index: 0 | 1 | 2, dim: number): number => {
    const normalized = (value - spec.min[index]) / (spec.max[index] - spec.min[index]);
    return clamp(Math.floor(normalized * dim), 0, dim - 1);
  };
  return { x: axis(point[0], 0, spec.dims.x), y: axis(point[1], 1, spec.dims.y), z: axis(point[2], 2, spec.dims.z) };
}

export function fillWorldOcclusionVolume(
  target: Uint8Array,
  spec: WorldOcclusionSpec,
  bodies: WorldOcclusionBody[],
  staticBoxes: WorldOcclusionStaticBox[],
  voxelSize: number,
): Uint8Array {
  target.fill(0);

  for (const box of staticBoxes) {
    const min: Vec3Tuple = [
      box.center[0] - box.size[0] * 0.5,
      box.center[1] - box.size[1] * 0.5,
      box.center[2] - box.size[2] * 0.5,
    ];
    const max: Vec3Tuple = [
      box.center[0] + box.size[0] * 0.5,
      box.center[1] + box.size[1] * 0.5,
      box.center[2] + box.size[2] * 0.5,
    ];

    if (max[0] < spec.min[0] || max[1] < spec.min[1] || max[2] < spec.min[2]
      || min[0] > spec.max[0] || min[1] > spec.max[1] || min[2] > spec.max[2]) {
      continue;
    }
    const minCell = clampedCell(min, spec);
    const maxCell = clampedCell([max[0] - 1e-5, max[1] - 1e-5, max[2] - 1e-5], spec);

    for (let z = clamp(minCell.z, 0, spec.dims.z - 1); z <= clamp(maxCell.z, 0, spec.dims.z - 1); z += 1) {
      for (let y = clamp(minCell.y, 0, spec.dims.y - 1); y <= clamp(maxCell.y, 0, spec.dims.y - 1); y += 1) {
        for (let x = clamp(minCell.x, 0, spec.dims.x - 1); x <= clamp(maxCell.x, 0, spec.dims.x - 1); x += 1) {
          target[indexOf(spec.dims, x, y, z)] = 255;
        }
      }
    }
  }

  for (const body of bodies) {
    for (let z = 0; z < body.dims.z; z += 1) {
      for (let y = 0; y < body.dims.y; y += 1) {
        for (let x = 0; x < body.dims.x; x += 1) {
          if (body.voxels[indexOf(body.dims, x, y, z)] === 0) {
            continue;
          }

          const rotated = rotateVector(
            [
              ((x + 0.5) - body.dims.x * 0.5) * voxelSize,
              ((y + 0.5) - body.dims.y * 0.5) * voxelSize,
              ((z + 0.5) - body.dims.z * 0.5) * voxelSize,
            ],
            body.rotation,
          );
          const cell = worldToCell(
            [rotated[0] + body.position[0], rotated[1] + body.position[1], rotated[2] + body.position[2]],
            spec,
          );
          if (!cell) {
            continue;
          }
          target[indexOf(spec.dims, cell.x, cell.y, cell.z)] = 255;
        }
      }
    }
  }

  return target;
}

export function buildWorldOcclusionVolume(
  spec: WorldOcclusionSpec,
  bodies: WorldOcclusionBody[],
  staticBoxes: WorldOcclusionStaticBox[],
  voxelSize: number,
): Uint8Array {
  return fillWorldOcclusionVolume(new Uint8Array(spec.dims.x * spec.dims.y * spec.dims.z), spec, bodies, staticBoxes, voxelSize);
}

export function sampleWorldOcclusion(volume: Uint8Array, spec: WorldOcclusionSpec, point: Vec3Tuple): 0 | 1 {
  const cell = worldToCell(point, spec);
  if (!cell) {
    return 0;
  }
  return volume[indexOf(spec.dims, cell.x, cell.y, cell.z)] === 0 ? 0 : 1;
}
