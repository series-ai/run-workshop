type VoxelDims = { x: number; y: number; z: number };

export type MacroOccupancyVolume = {
  dims: VoxelDims;
  data: Uint8Array;
  cellSize: number;
};

const indexOf = (dims: VoxelDims, x: number, y: number, z: number): number => {
  return x + y * dims.x + z * dims.x * dims.y;
};

export function buildMacroOccupancyVolume(
  voxels: Uint8Array,
  dims: VoxelDims,
  cellSize = 4,
): MacroOccupancyVolume {
  const size = Math.max(1, Math.floor(cellSize));
  const macroDims = {
    x: Math.max(1, Math.ceil(dims.x / size)),
    y: Math.max(1, Math.ceil(dims.y / size)),
    z: Math.max(1, Math.ceil(dims.z / size)),
  };
  const data = new Uint8Array(macroDims.x * macroDims.y * macroDims.z);

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const index = indexOf(dims, x, y, z);
        if (voxels[index] === 0) {
          continue;
        }

        const macroX = Math.floor(x / size);
        const macroY = Math.floor(y / size);
        const macroZ = Math.floor(z / size);
        data[indexOf(macroDims, macroX, macroY, macroZ)] = 255;
      }
    }
  }

  return {
    dims: macroDims,
    data,
    cellSize: size,
  };
}

export function sampleMacroOccupancy(
  volume: MacroOccupancyVolume,
  x: number,
  y: number,
  z: number,
): 0 | 1 {
  if (x < 0 || y < 0 || z < 0 || x >= volume.dims.x || y >= volume.dims.y || z >= volume.dims.z) {
    return 0;
  }
  return volume.data[indexOf(volume.dims, x, y, z)] === 0 ? 0 : 1;
}
