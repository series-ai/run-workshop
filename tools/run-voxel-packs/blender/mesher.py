"""Greedy voxel mesher.

Merges coplanar faces of the same palette index into rectangles, drops faces
between filled voxels, and emits one quad (4 unshared vertices, flat normal)
per rectangle. UVs sample the centre of the palette texel, like VoxEdit
exports. Coordinates are glTF axes, in voxels, relative to `pivot`.
"""
from __future__ import annotations

import numpy as np

PALETTE_SIZE = 256
# For face axis d, the two in-plane axes (u, v). (d, u, v) is right-handed for
# d = 0 and d = 2 and left-handed for d = 1, which flips the quad winding.
_PLANE_AXES = {0: (1, 2), 1: (0, 2), 2: (0, 1)}
_RIGHT_HANDED = {0: True, 1: False, 2: True}


def _greedy_2d(mask: np.ndarray):
    """Yield (i, j, w, h, color) rectangles covering the non-zero cells of a
    2D mask, merging equal colours. i/w run along mask axis 0, j/h along 1."""
    nu, nv = mask.shape
    done = np.zeros(mask.shape, dtype=bool)
    us, vs = np.nonzero(mask)
    for i, j in zip(us.tolist(), vs.tolist()):
        if done[i, j]:
            continue
        c = mask[i, j]
        h = 1
        while j + h < nv and mask[i, j + h] == c and not done[i, j + h]:
            h += 1
        w = 1
        while i + w < nu and np.all(mask[i + w, j : j + h] == c) and not done[i + w, j : j + h].any():
            w += 1
        done[i : i + w, j : j + h] = True
        yield i, j, w, h, int(c)


def greedy_mesh(a: np.ndarray, pivot=(0.0, 0.0, 0.0)):
    """Mesh a uint8 grid [x, y, z]. Returns (positions Nx3 float32,
    normals Nx3 float32, uvs Nx2 float32, quads Mx4 int32)."""
    if a.ndim != 3:
        raise ValueError("grid must be 3D")
    quads_pos, quads_nrm, quads_uv = [], [], []
    for d in range(3):
        u_axis, v_axis = _PLANE_AXES[d]
        A = np.transpose(a, (d, u_axis, v_axis))
        P = np.zeros((A.shape[0] + 2, A.shape[1], A.shape[2]), dtype=np.uint8)
        P[1:-1] = A
        # Plane s lies between cell s-1 and cell s along d.
        pos = np.where((P[1:] == 0) & (P[:-1] != 0), P[:-1], 0)  # normal +d, colour of cell s-1
        neg = np.where((P[:-1] == 0) & (P[1:] != 0), P[1:], 0)  # normal -d, colour of cell s
        for sign, M in ((1, pos), (-1, neg)):
            planes = np.nonzero(M.reshape(M.shape[0], -1).any(axis=1))[0]
            for s in planes.tolist():
                for i, j, w, h, c in _greedy_2d(M[s]):
                    corners = [(i, j), (i + w, j), (i + w, j + h), (i, j + h)]
                    if (sign > 0) != _RIGHT_HANDED[d]:
                        corners.reverse()
                    for cu, cv in corners:
                        p = [0.0, 0.0, 0.0]
                        p[d], p[u_axis], p[v_axis] = float(s), float(cu), float(cv)
                        quads_pos.append(p)
                    n = [0.0, 0.0, 0.0]
                    n[d] = float(sign)
                    quads_nrm.extend([n] * 4)
                    uv = [(c + 0.5) / PALETTE_SIZE, 0.5]
                    quads_uv.extend([uv] * 4)
    positions = np.array(quads_pos, dtype=np.float32).reshape(-1, 3) - np.array(pivot, dtype=np.float32)
    normals = np.array(quads_nrm, dtype=np.float32).reshape(-1, 3)
    uvs = np.array(quads_uv, dtype=np.float32).reshape(-1, 2)
    quads = np.arange(len(positions), dtype=np.int32).reshape(-1, 4)
    return positions, normals, uvs, quads
