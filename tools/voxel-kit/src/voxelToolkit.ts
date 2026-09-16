export type VoxelDims = { x: number; y: number; z: number };

export type VoxelObjectState = {
  id: string;
  dims: VoxelDims;
  voxels: Uint8Array;
  paletteRow: number;
};

export type VoxelBounds = {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  occupiedCount: number;
};

export type CroppedVoxelVolume = {
  dims: VoxelDims;
  voxels: Uint8Array;
  offset: { x: number; y: number; z: number };
};

const indexOf = (dims: VoxelDims, x: number, y: number, z: number): number => {
  return x + y * dims.x + z * dims.x * dims.y;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

function squaredDistanceToSegment(
  point: { x: number; y: number; z: number },
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
): number {
  const abx = end.x - start.x;
  const aby = end.y - start.y;
  const abz = end.z - start.z;
  const apx = point.x - start.x;
  const apy = point.y - start.y;
  const apz = point.z - start.z;
  const abLengthSq = abx * abx + aby * aby + abz * abz;
  const t = abLengthSq <= 1e-6
    ? 0
    : clamp((apx * abx + apy * aby + apz * abz) / abLengthSq, 0, 1);
  const closestX = start.x + abx * t;
  const closestY = start.y + aby * t;
  const closestZ = start.z + abz * t;
  const dx = point.x - closestX;
  const dy = point.y - closestY;
  const dz = point.z - closestZ;

  return dx * dx + dy * dy + dz * dz;
}

export const cloneVoxels = (voxels: Uint8Array): Uint8Array => new Uint8Array(voxels);

export function makeEmptyVoxelField(dims: VoxelDims): Uint8Array {
  return new Uint8Array(dims.x * dims.y * dims.z);
}

export function stampSphere(
  target: Uint8Array,
  dims: VoxelDims,
  center: { x: number; y: number; z: number },
  radius: number,
  material = 1,
): void {
  const rr = radius * radius;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const dx = x - center.x;
        const dy = y - center.y;
        const dz = z - center.z;
        if (dx * dx + dy * dy + dz * dz <= rr) {
          target[indexOf(dims, x, y, z)] = material;
        }
      }
    }
  }
}

export function stampBox(
  target: Uint8Array,
  dims: VoxelDims,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  material = 1,
): void {
  const minX = Math.max(0, min.x);
  const minY = Math.max(0, min.y);
  const minZ = Math.max(0, min.z);
  const maxX = Math.min(dims.x - 1, max.x);
  const maxY = Math.min(dims.y - 1, max.y);
  const maxZ = Math.min(dims.z - 1, max.z);

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        target[indexOf(dims, x, y, z)] = material;
      }
    }
  }
}

export function makeVoxelSphere(dims: VoxelDims, radius: number, material = 1): Uint8Array {
  const data = makeEmptyVoxelField(dims);
  stampSphere(data, dims, {
    x: (dims.x - 1) * 0.5,
    y: (dims.y - 1) * 0.5,
    z: (dims.z - 1) * 0.5,
  }, radius, material);
  return data;
}

export function makeVoxelBox(
  dims: VoxelDims,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
  material = 1,
): Uint8Array {
  const data = makeEmptyVoxelField(dims);
  stampBox(data, dims, min, max, material);
  return data;
}

export function makeVoxelBridgeAssembly(dims: VoxelDims, material = 1): Uint8Array {
  const data = makeEmptyVoxelField(dims);
  stampBox(data, dims, { x: 7, y: 12, z: 12 }, { x: 18, y: 34, z: 34 }, material);
  stampBox(data, dims, { x: 29, y: 12, z: 12 }, { x: 40, y: 34, z: 34 }, material);
  stampBox(data, dims, { x: 18, y: 20, z: 20 }, { x: 29, y: 26, z: 26 }, material);
  return data;
}

export function carveSphere(
  voxels: Uint8Array,
  dims: VoxelDims,
  center: { x: number; y: number; z: number },
  radius: number,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const rr = radius * radius;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const dx = x - center.x;
        const dy = y - center.y;
        const dz = z - center.z;
        if (dx * dx + dy * dy + dz * dz <= rr) {
          next[indexOf(dims, x, y, z)] = 0;
        }
      }
    }
  }

  return next;
}

export function carveCapsule(
  voxels: Uint8Array,
  dims: VoxelDims,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  radius: number,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const rr = radius * radius;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        if (squaredDistanceToSegment({ x, y, z }, start, end) <= rr) {
          next[indexOf(dims, x, y, z)] = 0;
        }
      }
    }
  }

  return next;
}

export function scorchSphereShell(
  voxels: Uint8Array,
  dims: VoxelDims,
  center: { x: number; y: number; z: number },
  innerRadius: number,
  outerRadius: number,
  material = 5,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const inner = innerRadius * innerRadius;
  const outer = outerRadius * outerRadius;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const index = indexOf(dims, x, y, z);
        if (voxels[index] === 0) {
          continue;
        }

        const dx = x - center.x;
        const dy = y - center.y;
        const dz = z - center.z;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance >= inner && distance <= outer) {
          next[index] = material;
        }
      }
    }
  }

  return next;
}

export function scorchCapsuleShell(
  voxels: Uint8Array,
  dims: VoxelDims,
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  innerRadius: number,
  outerRadius: number,
  material = 5,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const inner = innerRadius * innerRadius;
  const outer = outerRadius * outerRadius;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const index = indexOf(dims, x, y, z);
        if (voxels[index] === 0) {
          continue;
        }

        const distance = squaredDistanceToSegment({ x, y, z }, start, end);
        if (distance >= inner && distance <= outer) {
          next[index] = material;
        }
      }
    }
  }

  return next;
}

export function squaredDistanceToParallelogram(
  point: { x: number; y: number; z: number },
  p00: { x: number; y: number; z: number },
  p10: { x: number; y: number; z: number },
  p01: { x: number; y: number; z: number },
  p11: { x: number; y: number; z: number },
): number {
  const ux = p10.x - p00.x;
  const uy = p10.y - p00.y;
  const uz = p10.z - p00.z;
  const vx = p01.x - p00.x;
  const vy = p01.y - p00.y;
  const vz = p01.z - p00.z;
  const wx = point.x - p00.x;
  const wy = point.y - p00.y;
  const wz = point.z - p00.z;

  const a = ux * ux + uy * uy + uz * uz;
  const b = ux * vx + uy * vy + uz * vz;
  const c = vx * vx + vy * vy + vz * vz;
  const d = wx * ux + wy * uy + wz * uz;
  const e = wx * vx + wy * vy + wz * vz;

  const det = a * c - b * b;
  if (det <= 1e-6) {
    const d0 = squaredDistanceToSegment(point, p00, p10);
    const d1 = squaredDistanceToSegment(point, p01, p11);
    return Math.min(d0, d1);
  }

  const s = (c * d - b * e) / det;
  const t = (a * e - b * d) / det;

  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    const projX = p00.x + s * ux + t * vx;
    const projY = p00.y + s * uy + t * vy;
    const projZ = p00.z + s * uz + t * vz;
    const dx = point.x - projX;
    const dy = point.y - projY;
    const dz = point.z - projZ;
    return dx * dx + dy * dy + dz * dz;
  }

  const dBottom = squaredDistanceToSegment(point, p00, p10);
  const dTop = squaredDistanceToSegment(point, p01, p11);
  const dLeft = squaredDistanceToSegment(point, p00, p01);
  const dRight = squaredDistanceToSegment(point, p10, p11);
  return Math.min(dBottom, dTop, dLeft, dRight);
}

export function carveParallelogram(
  voxels: Uint8Array,
  dims: VoxelDims,
  p00: { x: number; y: number; z: number },
  p10: { x: number; y: number; z: number },
  p01: { x: number; y: number; z: number },
  p11: { x: number; y: number; z: number },
  radius: number,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const rr = radius * radius;

  const minX = Math.max(0, Math.floor(Math.min(p00.x, p10.x, p01.x, p11.x) - radius));
  const maxX = Math.min(dims.x - 1, Math.ceil(Math.max(p00.x, p10.x, p01.x, p11.x) + radius));
  const minY = Math.max(0, Math.floor(Math.min(p00.y, p10.y, p01.y, p11.y) - radius));
  const maxY = Math.min(dims.y - 1, Math.ceil(Math.max(p00.y, p10.y, p01.y, p11.y) + radius));
  const minZ = Math.max(0, Math.floor(Math.min(p00.z, p10.z, p01.z, p11.z) - radius));
  const maxZ = Math.min(dims.z - 1, Math.ceil(Math.max(p00.z, p10.z, p01.z, p11.z) + radius));

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (squaredDistanceToParallelogram({ x, y, z }, p00, p10, p01, p11) <= rr) {
          next[indexOf(dims, x, y, z)] = 0;
        }
      }
    }
  }

  return next;
}

export function scorchParallelogramShell(
  voxels: Uint8Array,
  dims: VoxelDims,
  p00: { x: number; y: number; z: number },
  p10: { x: number; y: number; z: number },
  p01: { x: number; y: number; z: number },
  p11: { x: number; y: number; z: number },
  innerRadius: number,
  outerRadius: number,
  material = 5,
): Uint8Array {
  const next = cloneVoxels(voxels);
  const inner = innerRadius * innerRadius;
  const outer = outerRadius * outerRadius;

  const minX = Math.max(0, Math.floor(Math.min(p00.x, p10.x, p01.x, p11.x) - outerRadius));
  const maxX = Math.min(dims.x - 1, Math.ceil(Math.max(p00.x, p10.x, p01.x, p11.x) + outerRadius));
  const minY = Math.max(0, Math.floor(Math.min(p00.y, p10.y, p01.y, p11.y) - outerRadius));
  const maxY = Math.min(dims.y - 1, Math.ceil(Math.max(p00.y, p10.y, p01.y, p11.y) + outerRadius));
  const minZ = Math.max(0, Math.floor(Math.min(p00.z, p10.z, p01.z, p11.z) - outerRadius));
  const maxZ = Math.min(dims.z - 1, Math.ceil(Math.max(p00.z, p10.z, p01.z, p11.z) + outerRadius));

  for (let z = minZ; z <= maxZ; z += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = indexOf(dims, x, y, z);
        if (voxels[index] === 0) continue;

        const distSq = squaredDistanceToParallelogram({ x, y, z }, p00, p10, p01, p11);
        if (distSq >= inner && distSq <= outer) {
          next[index] = material;
        }
      }
    }
  }

  return next;
}

export function splitConnectedComponents(voxels: Uint8Array, dims: VoxelDims): Uint8Array[] {
  const visited = new Uint8Array(voxels.length);
  const out: Uint8Array[] = [];
  const neighbors = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ] as const;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const root = indexOf(dims, x, y, z);
        if (voxels[root] === 0 || visited[root] === 1) continue;

        const component = new Uint8Array(voxels.length);
        const queue: Array<[number, number, number]> = [[x, y, z]];
        let cursor = 0;
        visited[root] = 1;

        while (cursor < queue.length) {
          const [qx, qy, qz] = queue[cursor]!;
          cursor += 1;
          const qi = indexOf(dims, qx, qy, qz);
          component[qi] = voxels[qi]!;

          for (const [dx, dy, dz] of neighbors) {
            const nx = qx + dx;
            const ny = qy + dy;
            const nz = qz + dz;
            if (nx < 0 || ny < 0 || nz < 0 || nx >= dims.x || ny >= dims.y || nz >= dims.z) {
              continue;
            }
            const ni = indexOf(dims, nx, ny, nz);
            if (visited[ni] === 1 || voxels[ni] === 0) continue;
            visited[ni] = 1;
            queue.push([nx, ny, nz]);
          }
        }

        out.push(component);
      }
    }
  }

  return out;
}

export function getOccupiedBounds(voxels: Uint8Array, dims: VoxelDims): VoxelBounds | null {
  let minX = dims.x;
  let minY = dims.y;
  let minZ = dims.z;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;
  let occupiedCount = 0;

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        if (voxels[indexOf(dims, x, y, z)] === 0) continue;
        occupiedCount += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
  }

  if (occupiedCount === 0) {
    return null;
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 },
    occupiedCount,
  };
}

export function cropVoxelsToBounds(
  voxels: Uint8Array,
  dims: VoxelDims,
  bounds: VoxelBounds,
  padding = 1,
): CroppedVoxelVolume {
  const min = {
    x: Math.max(0, bounds.min.x - padding),
    y: Math.max(0, bounds.min.y - padding),
    z: Math.max(0, bounds.min.z - padding),
  };
  const max = {
    x: Math.min(dims.x - 1, bounds.max.x + padding),
    y: Math.min(dims.y - 1, bounds.max.y + padding),
    z: Math.min(dims.z - 1, bounds.max.z + padding),
  };
  const croppedDims = {
    x: max.x - min.x + 1,
    y: max.y - min.y + 1,
    z: max.z - min.z + 1,
  };
  const cropped = makeEmptyVoxelField(croppedDims);

  for (let z = min.z; z <= max.z; z += 1) {
    for (let y = min.y; y <= max.y; y += 1) {
      for (let x = min.x; x <= max.x; x += 1) {
        const value = voxels[indexOf(dims, x, y, z)];
        if (value === 0) continue;
        const cx = x - min.x;
        const cy = y - min.y;
        const cz = z - min.z;
        cropped[indexOf(croppedDims, cx, cy, cz)] = value!;
      }
    }
  }

  return {
    dims: croppedDims,
    voxels: cropped,
    offset: min,
  };
}

export function makeDemoPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 4);
  palette.set([0, 0, 0, 0], 0);
  palette.set([105, 137, 111, 255], 4);
  palette.set([147, 111, 88, 255], 8);
  palette.set([171, 172, 176, 255], 12);
  palette.set([203, 154, 93, 255], 16);
  palette.set([255, 169, 88, 255], 20);

  for (let i = 4; i < 256; i += 1) {
    const p = i * 4;
    if (palette[p + 3] === 0) {
      palette.set([100 + (i % 50), 100 + ((i * 3) % 40), 90 + ((i * 7) % 30), 255], p);
    }
  }

  return palette;
}

export function makeDemoMaterialParams(): Uint8Array {
  const params = new Uint8Array(256 * 4);

  const setParams = (
    materialId: number,
    roughness: number,
    metalness: number,
    emissive: number,
    physicalType: number,
  ) => {
    const offset = materialId * 4;
    params[offset + 0] = Math.round(clamp(roughness, 0, 1) * 255);
    params[offset + 1] = Math.round(clamp(metalness, 0, 1) * 255);
    params[offset + 2] = Math.round(clamp(emissive, 0, 1) * 255);
    params[offset + 3] = Math.round(clamp(physicalType, 0, 1) * 255);
  };

  setParams(1, 0.78, 0.04, 0.0, 0.82);
  setParams(2, 0.9, 0.02, 0.0, 0.35);
  setParams(3, 0.32, 0.92, 0.0, 0.16);
  setParams(4, 0.58, 0.18, 0.06, 0.45);
  setParams(5, 0.28, 0.12, 0.42, 0.52);

  for (let materialId = 5; materialId < 256; materialId += 1) {
    setParams(
      materialId,
      0.4 + (materialId % 7) * 0.07,
      (materialId % 3) * 0.08,
      materialId % 11 === 0 ? 0.18 : 0,
      (materialId % 5) * 0.17,
    );
  }

  return params;
}
