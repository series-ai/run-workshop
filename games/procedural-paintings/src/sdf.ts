// Signed-distance-field meshing (naive surface nets) and SDF light baking.
// The scenes sculpt rock, masonry, and figures as distance fields, then mesh
// them once at load time.

import * as THREE from 'three';

export type Field = (x: number, y: number, z: number) => number;

export interface SdfMeshOptions {
  min: [number, number, number];
  max: [number, number, number];
  cell: number;
  /**
   * Conservative distance bound. Returns a value that is never greater than
   * the true distance to the surface. Blocks farther than this are skipped.
   */
  bound: Field;
}

export interface SdfMesh {
  positions: Float32Array;
  indices: Uint32Array;
}

const BLOCK = 4;

export function meshSdf(field: Field, opts: SdfMeshOptions): SdfMesh {
  const { min, cell } = opts;
  const nx = Math.ceil((opts.max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((opts.max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((opts.max[2] - min[2]) / cell) + 1;
  const val = new Float32Array(nx * ny * nz);
  const reach = BLOCK * cell * 0.87;

  for (let bz = 0; bz < nz; bz += BLOCK) {
    for (let by = 0; by < ny; by += BLOCK) {
      for (let bx = 0; bx < nx; bx += BLOCK) {
        const cx = min[0] + (bx + BLOCK / 2 - 0.5) * cell;
        const cy = min[1] + (by + BLOCK / 2 - 0.5) * cell;
        const cz = min[2] + (bz + BLOCK / 2 - 0.5) * cell;
        const far = opts.bound(cx, cy, cz) > reach;
        const x1 = Math.min(bx + BLOCK, nx), y1 = Math.min(by + BLOCK, ny), z1 = Math.min(bz + BLOCK, nz);
        for (let k = bz; k < z1; k++) {
          for (let j = by; j < y1; j++) {
            for (let i = bx; i < x1; i++) {
              val[i + nx * (j + ny * k)] = far ? 1 : field(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
            }
          }
        }
      }
    }
  }

  const cxn = nx - 1, cyn = ny - 1, czn = nz - 1;
  const vertexOf = new Int32Array(cxn * cyn * czn).fill(-1);
  const positions: number[] = [];
  const corner = new Float32Array(8);
  // Edge list of a cube: pairs of corner indices (bit 0 = x, bit 1 = y, bit 2 = z).
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  for (let k = 0; k < czn; k++) {
    for (let j = 0; j < cyn; j++) {
      for (let i = 0; i < cxn; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = val[i + (c & 1) + nx * (j + ((c >> 1) & 1) + ny * (k + ((c >> 2) & 1)))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, count = 0;
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e], b = EDGES[e + 1];
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += (a & 1) + t * ((b & 1) - (a & 1));
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
          count++;
        }
        vertexOf[i + cxn * (j + cyn * k)] = positions.length / 3;
        positions.push(min[0] + (i + sx / count) * cell, min[1] + (j + sy / count) * cell, min[2] + (k + sz / count) * cell);
      }
    }
  }

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  const cellAt = (i: number, j: number, k: number): number => vertexOf[i + cxn * (j + cyn * k)];
  for (let k = 1; k < czn; k++) {
    for (let j = 1; j < cyn; j++) {
      for (let i = 1; i < cxn; i++) {
        const v0 = val[i + nx * (j + ny * k)];
        const inside = v0 < 0;
        if (inside !== val[i + 1 + nx * (j + ny * k)] < 0) {
          quad(cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k), !inside);
        }
        if (inside !== val[i + nx * (j + 1 + ny * k)] < 0) {
          quad(cellAt(i - 1, j, k - 1), cellAt(i - 1, j, k), cellAt(i, j, k), cellAt(i, j, k - 1), !inside);
        }
        if (inside !== val[i + nx * (j + ny * (k + 1))] < 0) {
          quad(cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k), !inside);
        }
      }
    }
  }
  if (positions.length === 0) throw new Error('meshSdf produced no surface: check the field and bounds');
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

/** Ambient occlusion per vertex: how much the field closes in along the normal. */
export function bakeOcclusion(field: Field, positions: ArrayLike<number>, normals: ArrayLike<number>, step: number): Float32Array {
  const n = positions.length / 3;
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
    const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    let occ = 0, w = 1;
    for (let s = 1; s <= 4; s++) {
      const h = step * s * s * 0.6;
      const d = field(px + nx * h, py + ny * h, pz + nz * h);
      occ += w * Math.max(h - d, 0) / h;
      w *= 0.6;
    }
    out[v] = Math.max(0, 1 - occ * 0.62);
  }
  return out;
}

/** Soft sun visibility per vertex, by sphere tracing the field toward the light. */
export function bakeSun(field: Field, positions: ArrayLike<number>, normals: ArrayLike<number>, light: THREE.Vector3, maxDist: number): Float32Array {
  const n = positions.length / 3;
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const nx = normals[v * 3], ny = normals[v * 3 + 1], nz = normals[v * 3 + 2];
    if (nx * light.x + ny * light.y + nz * light.z < -0.05) continue;
    const px = positions[v * 3] + nx * 0.25, py = positions[v * 3 + 1] + ny * 0.25, pz = positions[v * 3 + 2] + nz * 0.25;
    let t = 0.35, vis = 1;
    for (let s = 0; s < 22 && t < maxDist; s++) {
      const d = field(px + light.x * t, py + light.y * t, pz + light.z * t);
      if (d < 0.02) { vis = 0; break; }
      vis = Math.min(vis, (5 * d) / t);
      t += Math.min(Math.max(d, 0.3), 2.5);
    }
    out[v] = Math.max(vis, 0);
  }
  return out;
}
