"""Low-level painters for four fantasy beasts (basilisk, centaur, owlbear, phoenix).

Paint only: these functions colour voxels that a model already filled. They
never add a shape, so each model keeps its own massing and silhouette.

Every painter takes a bool mask, a palette ramp, a base shade and an
optional face frame (from facet_paint), so the pattern follows a slope.
The patterns are big deliberate cells with dark seams (rules S2-S4). They
do not use random per-voxel speckle (rule S3).
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from voxgrid import Grid


def _clip(shade):
    return np.clip(shade, 1, 7)


def hide(g: Grid, m: np.ndarray, ramp: str, base: int, frame=None, seed: int = 0, cell=(6, 5)) -> None:
    """Two close tones in big patches (`cell` voxels), the darker tone on the
    lower edge of some patches. Use it for smooth hide and skin."""
    U, V = P.uv(g, frame)
    cu, cv = cell
    h = P._hash(U // cu, V // cv, seed=seed) % np.uint64(5)
    shade = np.where(h == 0, base - 1, np.where(h == 4, base + 1, base))
    shade = np.where((h < np.uint64(2)) & ((V % cv) == 0), base - 1, shade)
    P._paint(g, m, ramp, _clip(shade))


def _scallop_shade(U, V, base: int, width: int, row: int, seed: int, pointed: bool, streak: bool, vary: bool):
    r = V // row
    u = U + (r % 2) * (width // 2)
    pu, pv = u % width, V % row
    cell = P._hash(r, u // width, seed=seed) % np.uint64(5)
    shade = base + ((cell == 0) & vary).astype(np.int64)
    mid = width // 2
    if streak:
        shade = np.where((pu == mid) & (pv > 0) & (pv < row - 1), base + 1, shade)
    if pointed:
        tip = pv == (row - 1) - (np.abs(pu - mid) * (row - 1)) // (2 * max(mid, 1))
    else:
        tip = ((pv == row - 1) & (pu >= 1) & (pu <= width - 2)) | ((pv == row - 2) & ((pu == 0) | (pu == width - 1)))
    return np.where(tip, base - 1, shade)


def scallops(g: Grid, m: np.ndarray, ramp: str, base: int, frame=None, width: int = 5, row: int = 4, seed: int = 0, pointed: bool = False, streak: bool = True, vary: bool = True) -> None:
    """Offset rows of overlapping scales, feathers or fur tufts.

    Each cell is `width` wide and `row` tall. It has a dark lower rim (round,
    or a V when `pointed`), a light streak in the middle (`streak`) and, when
    `vary`, one cell in five is one shade lighter. The rows follow the frame."""
    U, V = P.uv(g, frame)
    P._paint(g, m, ramp, _clip(_scallop_shade(U, V, base, width, row, seed, pointed, streak, vary)))


def ring_scales(g: Grid, m: np.ndarray, ramp: str, base: int, axis_x, axis_y, along: np.ndarray, radius: float = 8.0, width: int = 5, row: int = 4, seed: int = 0, vary: bool = False) -> None:
    """Scale rows round a long body. `axis_x` and `axis_y` are arrays (per
    voxel) of the body centre line; `along` is the distance along the body
    (it grows toward the tail, so each scale has its dark rim at the back).
    The pattern does not depend on the face frames, so it stays regular
    across the chamfers."""
    X, Y, _Z = np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")
    arc = np.arctan2(Y - axis_y, X - axis_x) * radius
    U = np.floor(arc).astype(np.int64)
    V = np.floor(along).astype(np.int64)
    P._paint(g, m, ramp, _clip(_scallop_shade(U, V, base, width, row, seed, False, False, vary)))


def bands(g: Grid, m: np.ndarray, ramp: str, base: int, frame=None, row: int = 4) -> None:
    """Belly plates: wide bands across the face, a dark seam under each band
    and a lit row on top of it."""
    _U, V = P.uv(g, frame)
    shade = np.where(V % row == row - 1, base - 2, np.where(V % row == 0, base + 1, base))
    P._paint(g, m, ramp, _clip(shade))


def strands(g: Grid, m: np.ndarray, ramp: str, base: int, frame=None, period: int = 4) -> None:
    """Hair: long strands down the face, a dark parting line in each period
    and a lit strand next to it."""
    U, _V = P.uv(g, frame)
    k = U % period
    shade = np.where(k == 0, base - 2, np.where(k == 1, base + 1, base))
    P._paint(g, m, ramp, _clip(shade))


def paint_solids(g: Grid, start: int, painter) -> np.ndarray:
    """Call painter(g, mask, frame) on every face of the prisms added since
    `start`. Return the union mask of those prisms."""
    solids = g.solids[start:]
    if not solids:
        raise ValueError("paint_solids: no prism was added since start")
    for mm, fr in S.facets(g, solids):
        painter(g, mm, fr)
    return np.logical_or.reduce([s.mask(g.shape) for s in solids])


def frame_seams(g: Grid, start: int, m: np.ndarray | None = None, steps: int = 2, width: float = 0.8) -> np.ndarray:
    """Darken the arrises of the prisms added since `start` by `steps` shades
    in their own ramps (rule S4). Return the darkened mask."""
    seam = S.seams(g, g.solids[start:], width) & (g.a > 0)
    if m is not None:
        seam &= m
    P.darken(g, seam, steps)
    return seam


def gradient(g: Grid, m: np.ndarray, t: np.ndarray, stops) -> None:
    """Paint a mask in steps along a scalar field `t` (0..1): `stops` is a
    list of (t_from, ramp, shade); each voxel takes the last stop at or
    below its t. Use it for flame tongues (red root, gold glowing tip)."""
    for t0, ramp, shade in stops:
        P.flat(g, m & (t >= t0), ramp, shade)
