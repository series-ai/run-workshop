"""Small shared helpers for the repaired apocalypse buildings and props.

Only the repaired new models import this file. No original model uses it,
so a change here cannot change an original GLB.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
from pnkit import box, edges, on_face


def text_c(g, face: str, plane: float, uc: float, v0: float, s: str, ramp: str, shade: int, scale: int = 1, gap: int = 1) -> np.ndarray:
    """Paint text centred on uc. The text box starts at height v0."""
    w, _h = pnglyph.text_size(s, scale, gap)
    return pnglyph.text(g, face, plane, int(round(uc - w / 2)), int(v0), s, ramp, shade, scale=scale, gap=gap)


def board(g, face: str, plane: float, u0, u1, v0, v1, ramp: str = "wood", base: int = 4, seed: int = 0) -> np.ndarray:
    """A planked board 1 voxel proud of a face, with a dark frame (S4)."""
    m = box(g, *on_face(face, plane, u0, u1, v0, v1, 0, 1), ramp, base)
    P.planks(g, m, ramp, base, width=3, across="y", seed=seed)
    P.outline(g, m, "darkwood", 2, normal="z" if face in ("-z", "+z") else "x")
    return m


def boards_x(g, face: str, plane: float, u0, u1, v0, v1, ramp: str = "wood", seed: int = 0) -> np.ndarray:
    """Two crossed planks nailed over an opening (a boarded window)."""
    import pnshapes as S
    axis = "z" if face in ("-z", "+z") else "x"
    d0, d1 = (plane - 2, plane) if face[0] == "-" else (plane, plane + 2)
    m = np.zeros(g.shape, dtype=bool)
    for a, b in (((u0, v0 + 1), (u1, v1 - 1)), ((u0, v1 - 1), (u1, v0 + 1))):
        if axis == "z":
            m |= S.bar(g, "z", a, b, 2.4, d0, d1, ramp, 4)
        else:
            m |= S.bar(g, "x", (a[1], a[0]), (b[1], b[0]), 2.4, d0, d1, ramp, 4)
    P.planks(g, m, ramp, 4, width=3, across="y", seed=seed)
    return m


def cut(g, mask: np.ndarray) -> np.ndarray:
    """Remove voxels (never prisms) and return the voxels that the cut
    exposed, so the caller can paint the broken faces."""
    occ_before = g.a > 0
    g.a[mask] = 0
    occ = g.a > 0
    exposed = np.zeros_like(occ)
    for axis in range(3):
        for step in (1, -1):
            nb = np.roll(mask & occ_before, step, axis=axis)
            exposed |= occ & nb
    return exposed


def frame_box(g, x0, y0, z0, x1, y1, z1, ramp: str, base: int, edge=("darkwood", 2)) -> np.ndarray:
    """A box with a dark 1-voxel frame on its edges (S4)."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.flat(g, edges(m), *edge)
    return m


def patchwork(g, mask: np.ndarray, ramps=(("rust", 4), ("steel", 5), ("teal", 3), ("red", 3), ("rust", 3)), cell=(13, 11), seed: int = 0) -> None:
    """Scrap cladding: a quilt of corrugated sheets in mixed metals. Each
    sheet has wide ribs, a dark 1-voxel border and rivets at the corners."""
    U, V = P.uv(g)
    cu, cv = cell
    row = V // cv
    col = (U + (row % 2) * (cu // 2)) // cu
    pick = P._hash(col, row, seed=seed) % np.uint64(len(ramps))
    for k, (ramp, base) in enumerate(ramps):
        sheet = mask & (pick == np.uint64(k))
        if not sheet.any():
            continue
        uu = U + (row % 2) * (cu // 2)
        shade = np.where(uu % 4 == 3, base - 1, base)
        shade = np.where((uu % cu == 0) | (V % cv == 0), base - 2, shade)
        rivet = ((uu % cu == 2) | (uu % cu == cu - 2)) & ((V % cv == 2) | (V % cv == cv - 2))
        shade = np.where(rivet, base + 2, shade)
        P._paint(g, sheet, ramp, shade)
