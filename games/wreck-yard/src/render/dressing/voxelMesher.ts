import * as THREE from 'three';
import { ART_STYLE } from '../style/artStyle';
import { PALETTE_INDEX_TO_KEY, type VoxelGrid } from './voxelProps';

export type VoxelPlacement = {
  grid: VoxelGrid;
  position: readonly [number, number, number];
  rotationY: number;
  scale: number;
};

export type MeshedVoxels = {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
};

// Precompute palette linear RGB colors
const PALETTE_COLORS: readonly [number, number, number][] = PALETTE_INDEX_TO_KEY.map((key) => {
  const hex = ART_STYLE.palette[key];
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
});

type Quad = {
  v0: [number, number, number];
  v1: [number, number, number];
  v2: [number, number, number];
  v3: [number, number, number];
  normal: [number, number, number];
  colorIdx: number;
};

export function meshVoxelGrids(placements: readonly VoxelPlacement[]): MeshedVoxels {
  const quads: Quad[] = [];

  for (const placement of placements) {
    const { grid, position, rotationY, scale } = placement;
    const { dims, cells } = grid;
    const { x: sx, y: sy, z: sz } = dims;

    const cellAt = (x: number, y: number, z: number): number => {
      if (x < 0 || x >= sx || y < 0 || y >= sy || z < 0 || z >= sz) return 0;
      return cells[x + y * sx + z * sx * sy];
    };

    const cosR = Math.cos(rotationY);
    const sinR = Math.sin(rotationY);

    const transformVertex = (lx: number, ly: number, lz: number): [number, number, number] => {
      // Center on grid center horizontally, base at y=0
      const ox = (lx - sx * 0.5) * scale;
      const oy = ly * scale;
      const oz = (lz - sz * 0.5) * scale;

      const rx = ox * cosR - oz * sinR;
      const rz = ox * sinR + oz * cosR;

      return [rx + position[0], oy + position[1], rz + position[2]];
    };

    const transformNormal = (nx: number, ny: number, nz: number): [number, number, number] => {
      const rx = nx * cosR - nz * sinR;
      const rz = nx * sinR + nz * cosR;
      return [rx, ny, rz];
    };

    // 6 directions: +X, -X, +Y, -Y, +Z, -Z
    // 0: +X, 1: -X, 2: +Y, 3: -Y, 4: +Z, 5: -Z
    for (let axis = 0; axis < 3; axis++) {
      const uAxis = (axis + 1) % 3;
      const vAxis = (axis + 2) % 3;

      const dimAxis = axis === 0 ? sx : axis === 1 ? sy : sz;
      const dimU = uAxis === 0 ? sx : uAxis === 1 ? sy : sz;
      const dimV = vAxis === 0 ? sx : vAxis === 1 ? sy : sz;

      const pt = [0, 0, 0];

      for (let dir = 0; dir < 2; dir++) {
        const sign = dir === 0 ? 1 : -1;
        const normalVec: [number, number, number] = [
          axis === 0 ? sign : 0,
          axis === 1 ? sign : 0,
          axis === 2 ? sign : 0,
        ];
        const worldNormal = transformNormal(...normalVec);

        // Mask of face colors at each (u, v) on this slice
        const mask = new Int32Array(dimU * dimV);

        for (let d = 0; d < dimAxis; d++) {
          pt[axis] = d;

          // Fill slice mask
          for (let v = 0; v < dimV; v++) {
            pt[vAxis] = v;
            for (let u = 0; u < dimU; u++) {
              pt[uAxis] = u;

              const c = cellAt(pt[0], pt[1], pt[2]);
              let faceColor = 0;

              if (c > 0) {
                // Check neighbor in direction
                pt[axis] += sign;
                const neighbor = cellAt(pt[0], pt[1], pt[2]);
                pt[axis] -= sign;

                if (neighbor === 0) {
                  faceColor = c;
                }
              }

              mask[u + v * dimU] = faceColor;
            }
          }

          // Greedy merge on mask
          for (let v = 0; v < dimV; v++) {
            for (let u = 0; u < dimU; u++) {
              const col = mask[u + v * dimU];
              if (col <= 0) continue;

              // Find width w
              let w = 1;
              while (u + w < dimU && mask[u + w + v * dimU] === col) {
                w++;
              }

              // Find height h
              let h = 1;
              let canExpand = true;
              while (v + h < dimV && canExpand) {
                for (let k = 0; k < w; k++) {
                  if (mask[u + k + (v + h) * dimU] !== col) {
                    canExpand = false;
                    break;
                  }
                }
                if (canExpand) h++;
              }

              // Clear merged region
              for (let dv = 0; dv < h; dv++) {
                for (let du = 0; du < w; du++) {
                  mask[u + du + (v + dv) * dimU] = 0;
                }
              }

              // Build Quad vertices
              // Slice corner coordinates
              const cAxis = dir === 0 ? d + 1 : d;

              const p0 = [0, 0, 0];
              const p1 = [0, 0, 0];
              const p2 = [0, 0, 0];
              const p3 = [0, 0, 0];

              p0[axis] = cAxis; p0[uAxis] = u;     p0[vAxis] = v;
              p1[axis] = cAxis; p1[uAxis] = u + w; p1[vAxis] = v;
              p2[axis] = cAxis; p2[uAxis] = u + w; p2[vAxis] = v + h;
              p3[axis] = cAxis; p3[uAxis] = u;     p3[vAxis] = v + h;

              // Ensure counter-clockwise winding relative to outward normal
              let v0: [number, number, number];
              let v1: [number, number, number];
              let v2: [number, number, number];
              let v3: [number, number, number];

              if (dir === 0) {
                // Positive face
                v0 = transformVertex(p0[0], p0[1], p0[2]);
                v1 = transformVertex(p1[0], p1[1], p1[2]);
                v2 = transformVertex(p2[0], p2[1], p2[2]);
                v3 = transformVertex(p3[0], p3[1], p3[2]);
              } else {
                // Negative face
                v0 = transformVertex(p0[0], p0[1], p0[2]);
                v1 = transformVertex(p3[0], p3[1], p3[2]);
                v2 = transformVertex(p2[0], p2[1], p2[2]);
                v3 = transformVertex(p1[0], p1[1], p1[2]);
              }

              quads.push({
                v0,
                v1,
                v2,
                v3,
                normal: worldNormal,
                colorIdx: col,
              });
            }
          }
        }
      }
    }
  }

  const numQuads = quads.length;
  const numVertices = numQuads * 4;
  const numIndices = numQuads * 6;

  const positions = new Float32Array(numVertices * 3);
  const normals = new Float32Array(numVertices * 3);
  const colors = new Float32Array(numVertices * 3);
  const indices = new Uint32Array(numIndices);

  for (let i = 0; i < numQuads; i++) {
    const q = quads[i];
    const vOffset = i * 4;
    const iOffset = i * 6;

    const rgb = PALETTE_COLORS[q.colorIdx] || PALETTE_COLORS[8];

    // 4 vertices
    const verts = [q.v0, q.v1, q.v2, q.v3];
    for (let vi = 0; vi < 4; vi++) {
      const idx3 = (vOffset + vi) * 3;
      positions[idx3] = verts[vi][0];
      positions[idx3 + 1] = verts[vi][1];
      positions[idx3 + 2] = verts[vi][2];

      normals[idx3] = q.normal[0];
      normals[idx3 + 1] = q.normal[1];
      normals[idx3 + 2] = q.normal[2];

      colors[idx3] = rgb[0];
      colors[idx3 + 1] = rgb[1];
      colors[idx3 + 2] = rgb[2];
    }

    // 2 triangles: (0, 1, 2) and (0, 2, 3)
    indices[iOffset] = vOffset;
    indices[iOffset + 1] = vOffset + 1;
    indices[iOffset + 2] = vOffset + 2;
    indices[iOffset + 3] = vOffset;
    indices[iOffset + 4] = vOffset + 2;
    indices[iOffset + 5] = vOffset + 3;
  }

  return {
    positions,
    normals,
    colors,
    indices,
  };
}
