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


# Edge classes of a face cell, seen from the face: the surface turns away
# (convex), goes on in the same plane (flat), or turns up in front (concave).
_CONVEX, _FLAT, _CONCAVE = 0, 1, 2
# Corner shift along an in-plane axis, per class, at the low and at the high edge.
_LOW_SHIFT = {_CONVEX: -1.0, _FLAT: 0.0, _CONCAVE: 1.0}
_HIGH_SHIFT = {_CONVEX: 1.0, _FLAT: 0.0, _CONCAVE: -1.0}


def _greedy_2d_edges(mask: np.ndarray, lo_u: np.ndarray, hi_u: np.ndarray, lo_v: np.ndarray, hi_v: np.ndarray):
    """Like _greedy_2d, but a rectangle's cells along each of its four sides
    share that side's edge class, so each side moves out as one straight edge.
    Yields (i, j, w, h, color, low-u, high-u, low-v, high-v classes)."""
    nu, nv = mask.shape
    done = np.zeros(mask.shape, dtype=bool)
    us, vs = np.nonzero(mask)
    for i, j in zip(us.tolist(), vs.tolist()):
        if done[i, j]:
            continue
        c = mask[i, j]
        lu, hu, lv = lo_u[i, j], hi_u[i, j], lo_v[i, j]
        h = 1
        while j + h < nv and mask[i, j + h] == c and not done[i, j + h] and lo_u[i, j + h] == lu and hi_u[i, j + h] == hu:
            h += 1
        hv = hi_v[i, j + h - 1]
        w = 1
        while i + w < nu:
            col = slice(j, j + h)
            k = i + w
            if not (np.all(mask[k, col] == c) and not done[k, col].any() and np.all(hi_u[k, col] == hi_u[k, j]) and lo_v[k, j] == lv and hi_v[k, j + h - 1] == hv):
                break
            hu = hi_u[k, j]
            w += 1
        done[i : i + w, j : j + h] = True
        yield i, j, w, h, int(c), int(lu), int(hu), int(lv), int(hv)


def layered_mesh(a: np.ndarray, pivot, solid: np.ndarray, layer: float):
    """Mesh a uint8 grid like greedy_mesh, with the surface of `solid` (the
    whole object; `a` may be one block of it) moved `layer` voxels out: every
    open face sits exactly `layer` out along its normal, and its corners move
    along the face plane as the surface turns there, so faces stay joined.
    Faces against the rest of the solid (between two blocks) are kept for
    when the blocks bend apart, but never merged with open faces."""
    if a.ndim != 3 or solid.shape != a.shape:
        raise ValueError("layered_mesh needs a 3D grid and a solid of the same shape")
    quads_pos, quads_nrm, quads_uv = [], [], []
    for d in range(3):
        u_axis, v_axis = _PLANE_AXES[d]
        A = np.transpose(a, (d, u_axis, v_axis))
        P = np.zeros((A.shape[0] + 2, A.shape[1], A.shape[2]), dtype=np.uint8)
        P[1:-1] = A
        # The solid padded by one on every axis: S[x + 1, u + 1, v + 1] is solid cell (x, u, v).
        S = np.pad(np.transpose(solid, (d, u_axis, v_axis)) != 0, 1)
        pos = np.where((P[1:] == 0) & (P[:-1] != 0), P[:-1], 0).astype(np.int32)  # normal +d, colour of cell s-1
        neg = np.where((P[:-1] == 0) & (P[1:] != 0), P[1:], 0).astype(np.int32)  # normal -d, colour of cell s
        for sign, M in ((1, pos), (-1, neg)):
            planes = np.nonzero(M.reshape(M.shape[0], -1).any(axis=1))[0]
            for s in planes.tolist():
                own = s - 1 if sign > 0 else s  # the voxel layer that owns the faces of plane s
                front = own + sign
                So, Sf = S[own + 1], S[front + 1]  # padded 2D slices (u + 1, v + 1)
                # Faces against the rest of the solid get their own key, so they never merge with open ones.
                cells = np.where((M[s] > 0) & Sf[1:-1, 1:-1], M[s] + PALETTE_SIZE, M[s])

                def edge(du: int, dv: int) -> np.ndarray:
                    side = So[1 + du : So.shape[0] - 1 + du, 1 + dv : So.shape[1] - 1 + dv]
                    ahead = Sf[1 + du : Sf.shape[0] - 1 + du, 1 + dv : Sf.shape[1] - 1 + dv]
                    return np.where(ahead, _CONCAVE, np.where(side, _FLAT, _CONVEX))

                rects = _greedy_2d_edges(cells, edge(-1, 0), edge(1, 0), edge(0, -1), edge(0, 1))
                for i, j, w, h, c, lu, hu, lv, hv in rects:
                    corners = [(i, j, lu, lv), (i + w, j, hu, lv), (i + w, j + h, hu, hv), (i, j + h, lu, hv)]
                    if (sign > 0) != _RIGHT_HANDED[d]:
                        corners.reverse()
                    for cu, cv, eu, ev in corners:
                        su = _LOW_SHIFT[eu] if cu == i else _HIGH_SHIFT[eu]
                        sv = _LOW_SHIFT[ev] if cv == j else _HIGH_SHIFT[ev]
                        p = [0.0, 0.0, 0.0]
                        p[d] = float(s) + layer * sign
                        p[u_axis] = float(cu) + layer * su
                        p[v_axis] = float(cv) + layer * sv
                        quads_pos.append(p)
                    n = [0.0, 0.0, 0.0]
                    n[d] = float(sign)
                    quads_nrm.extend([n] * 4)
                    uv = [(c % PALETTE_SIZE + 0.5) / PALETTE_SIZE, 0.5]
                    quads_uv.extend([uv] * 4)
    positions = np.array(quads_pos, dtype=np.float32).reshape(-1, 3) - np.array(pivot, dtype=np.float32)
    normals = np.array(quads_nrm, dtype=np.float32).reshape(-1, 3)
    uvs = np.array(quads_uv, dtype=np.float32).reshape(-1, 2)
    quads = np.arange(len(positions), dtype=np.int32).reshape(-1, 4)
    return positions, normals, uvs, quads
