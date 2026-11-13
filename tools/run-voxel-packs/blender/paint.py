"""Material painters (art direction rules S1–S4): colour only, never shape.

World assets are meshed by shape and their voxel colours become a painted
atlas (atlas.py), so these patterns cost no triangles. Every painter takes a
bool `mask` (usually `region(...)`), a palette ramp and a `base` shade, and
keeps to soft ramps: tiles and boards vary by ±1 shade; seams, mortar and
outlines are darker. Patterns use grid coordinates, so they stay continuous
across parts of one grid and around corners. Deterministic (seeded hashes).
"""
from __future__ import annotations

import numpy as np

from voxgrid import PALETTE, RAMP_SHADES, C, Grid


def region(g: Grid, x0, y0, z0, x1, y1, z1) -> np.ndarray:
    """Filled voxels inside the box [x0, x1) × [y0, y1) × [z0, z1)."""
    m = np.zeros(g.shape, dtype=bool)
    sx, sy, sz = g.shape
    # Clamp both ends: a negative upper bound would wrap a numpy slice and select the wrong voxels.
    cx = lambda lo, hi, n: slice(min(n, max(0, int(lo))), min(n, max(0, int(hi))))  # noqa: E731
    m[cx(x0, x1, sx), cx(y0, y1, sy), cx(z0, z1, sz)] = True
    return m & (g.a > 0)


def _hash(*arrays, seed: int = 0) -> np.ndarray:
    """Deterministic integer hash of integer arrays (broadcast)."""
    h = np.uint64(seed * 0x9E3779B1 + 0x85EBCA6B)
    out = np.full(np.broadcast(*arrays).shape, h, dtype=np.uint64)
    for a in arrays:
        out ^= np.asarray(a, dtype=np.int64).astype(np.uint64) + np.uint64(0x9E3779B97F4A7C15) + (out << np.uint64(6)) + (out >> np.uint64(2))
        out *= np.uint64(0xBF58476D1CE4E5B9)
        out ^= out >> np.uint64(31)
    return out


def _jitter(h: np.ndarray) -> np.ndarray:
    """Shade offset in {-1, 0, 0, +1}: most tiles sit on the base shade."""
    return np.array([-1, 0, 0, 1], dtype=np.int64)[(h % np.uint64(4)).astype(np.int64)]


def _paint(g: Grid, mask: np.ndarray, ramp: str, shades: np.ndarray) -> Grid:
    shades = np.clip(np.broadcast_to(shades, g.shape), 0, RAMP_SHADES - 1)
    # Index 0 is "empty", so shade 0 of the first ramp falls back to shade 1.
    lut = np.array([C(ramp, s) if PALETTE["ramps"][ramp] * RAMP_SHADES + s else C(ramp, 1) for s in range(RAMP_SHADES)], dtype=np.uint8)
    g.a[mask] = lut[shades[mask]]
    return g


def _coords(g: Grid):
    sx, sy, sz = g.shape
    return np.meshgrid(np.arange(sx), np.arange(sy), np.arange(sz), indexing="ij")


_AXES = {"x": 0, "y": 1, "z": 2}


def _exposed(g: Grid) -> tuple[np.ndarray, np.ndarray]:
    """(side, cap): filled voxels with an empty x/z neighbour, and with an empty y neighbour."""
    occ = g.a > 0

    def open_along(axis):
        out = np.zeros_like(occ)
        for step in (1, -1):
            nb = np.roll(occ, step, axis=axis)
            edge = [slice(None)] * 3
            edge[axis] = 0 if step == 1 else -1
            nb[tuple(edge)] = False
            out |= occ & ~nb
        return out

    return open_along(0) | open_along(2), open_along(1)


def uv(g: Grid, frame=None) -> tuple[np.ndarray, np.ndarray]:
    """Pattern coordinates (U runs along the surface, V stacks across it).

    frame=None: walls use (x + z, y) so a pattern wraps corners; voxels only
    seen from above or below (floors, decks, flat roofs) use (x, z), so tops
    never get diagonal streaks. 'wall', 'top', 'x' (faces looking along x),
    'z': force one. (u_vec, v_vec): any frame, for slopes: u along the
    ridge, v down the slope (whole voxels along those directions)."""
    X, Y, Z = _coords(g)
    if frame is None:
        side, cap = _exposed(g)
        top_only = cap & ~side
        return np.where(top_only, X, X + Z), np.where(top_only, Z, Y)
    if frame == "wall":
        return X + Z, Y
    if frame == "top":
        return X, Z
    if frame == "x":
        return Z, Y
    if frame == "z":
        return X, Y
    uvec, vvec = (np.asarray(f, dtype=float) for f in frame)
    uvec, vvec = uvec / np.linalg.norm(uvec), vvec / np.linalg.norm(vvec)
    P = np.stack([X + 0.5, Y + 0.5, Z + 0.5], axis=-1)
    return np.floor(P @ uvec).astype(np.int64), np.floor(P @ vvec).astype(np.int64)


def flat(g: Grid, mask: np.ndarray, ramp: str, shade: int) -> Grid:
    return _paint(g, mask, ramp, np.full(g.shape, shade))


def planks(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, width: int = 3, across: str = "y", length=(10, 18), nails: bool = True, grain: bool = True, frame=None, seed: int = 0) -> Grid:
    """Boards `width` voxels wide with a dark seam between them, broken ends
    every `length` voxels, nail dots near the ends and faint grain streaks.
    across='y': horizontal boards (on tops: deck boards along x); 'x' or 'z':
    vertical boards. `frame`: see uv()."""
    U, V = uv(g, frame)
    a, run = (V, U) if across == "y" else (U, V)
    board = a // width
    offset = (_hash(board, seed=seed) % np.uint64(length[1])).astype(np.int64)
    span = length[0] + (_hash(board, seed=seed + 1) % np.uint64(max(1, length[1] - length[0] + 1))).astype(np.int64)
    seg = (run + offset) // span
    pos = (run + offset) % span
    shade = base + _jitter(_hash(board, seg, seed=seed + 2))
    if grain:
        streak = (_hash(board, seg, a % width, (run + offset) // 4, seed=seed + 3) % np.uint64(7)) == 0
        shade = shade - streak.astype(np.int64)
    if nails:
        nail = ((pos == 1) | (pos == span - 2)) & (a % width == width // 2)
        shade = np.where(nail, base - 2, shade)
    seam = (a % width == 0) | (pos == 0)
    shade = np.where(seam, base - 2, shade)
    return _paint(g, mask, ramp, shade)


def stone(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, block=(6, 4), mortar: int = -1, cracks: float = 0.06, frame=None, seed: int = 0) -> Grid:
    """Running-bond blocks (width, height) with 1-voxel mortar lines; on tops
    they become paving. `frame`: see uv()."""
    U, V = uv(g, frame)
    bw, bh = block
    course = V // bh
    u = U + (course % 2) * (bw // 2)
    cell = u // bw
    shade = base + _jitter(_hash(course, cell, seed=seed))
    crack = (_hash(course, cell, seed=seed + 1) % np.uint64(1000)) < np.uint64(int(cracks * 1000))
    diag = ((u % bw) - (V % bh)) == 1
    shade = np.where(crack & diag, base - 2, shade)
    joint = (V % bh == 0) | (u % bw == 0)
    shade = np.where(joint, base + mortar, shade)
    return _paint(g, mask, ramp, shade)


def tiles(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, row: int = 3, width: int = 4, along: str = "z", frame=None, seed: int = 0) -> Grid:
    """Roof tiles or shingles: rows stacked down the roof, split every
    `width` along the ridge, offset every other row, with a dark lower lip
    on each row. Default frame: ridge axis `along`, rows by height; pass
    `frame=(ridge_vec, downslope_vec)` for exact slope rows."""
    X, Y, Z = _coords(g)
    if frame is None:
        U, V = ({"x": X, "z": Z}[along], -Y)
    else:
        U, V = uv(g, frame)
    r = V // row
    u = U + (r % 2) * (width // 2)
    shade = base + _jitter(_hash(r, u // width, seed=seed))
    shade = np.where(V % row == row - 1, base - 2, shade)
    shade = np.where((u % width == 0) & (V % row != row - 1), base - 1, shade)
    return _paint(g, mask, ramp, shade)


def thatch(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, band: int = 5, frame=None, seed: int = 0) -> Grid:
    """Straw: streaks of ±1 shade down the surface, a darker tie band every `band` rows."""
    U, V = uv(g, frame)
    shade = base + _jitter(_hash(U, V // 2, seed=seed))
    shade = np.where(V % band == 0, base - 1, shade)
    return _paint(g, mask, ramp, shade)


def plates(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, size=(8, 6), rivets: bool = True, frame=None, seed: int = 0) -> Grid:
    """Metal plates with a darker 1-voxel border and rivet dots in the corners."""
    U, V = uv(g, frame)
    pw, ph = size
    shade = base + _jitter(_hash(U // pw, V // ph, seed=seed))
    border = (U % pw == 0) | (V % ph == 0)
    shade = np.where(border, base - 2, shade)
    if rivets:
        rivet = ((U % pw == 1) | (U % pw == pw - 1)) & ((V % ph == 1) | (V % ph == ph - 1))
        shade = np.where(rivet, base + 2, shade)
    return _paint(g, mask, ramp, shade)


def outline(g: Grid, mask: np.ndarray, ramp: str, shade: int, normal: str | None = None) -> Grid:
    """Paint the rim of a masked area: the dark frame around panels (rule
    S4). With `normal` ('x'|'y'|'z'), only rims in the face plane count, so
    a 1-voxel-thick panel keeps its middle."""
    m = mask
    rim = np.zeros_like(m)
    for axis in [a for a in range(3) if normal is None or a != _AXES[normal]]:
        for step in (1, -1):
            nb = np.roll(m, step, axis=axis)
            edge = [slice(None)] * 3
            edge[axis] = 0 if step == 1 else -1
            nb[tuple(edge)] = False
            rim |= m & ~nb
    return _paint(g, rim, ramp, np.full(g.shape, shade))


def darken(g: Grid, mask: np.ndarray, steps: int = 1) -> Grid:
    """Move every masked voxel `steps` shades darker inside its own ramp."""
    idx = g.a[mask].astype(np.int64)
    shade = idx % RAMP_SHADES
    new = idx - np.minimum(shade, steps)
    new = np.where(new == 0, idx, new)  # never become "empty"
    g.a[mask] = new.astype(np.uint8)
    return g


def grime(g: Grid, mask: np.ndarray, height: int = 4, seed: int = 0) -> Grid:
    """Soft dirt near the ground: one shade darker in the lowest `height`
    rows of the mask, broken up so it reads as dirt, not a band."""
    X, Y, Z = _coords(g)
    ys = np.nonzero(mask.any(axis=(0, 2)))[0]
    if len(ys) == 0:
        return g
    low = (Y - ys.min()) < height
    speck = (_hash(X + Z, Y, seed=seed) % np.uint64(3)) != 0
    return darken(g, mask & low & speck)


def mottle(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, cell: int = 3, seed: int = 0) -> Grid:
    """Plaster, painted wood or hull: soft ±1 shade patches in 3D cells
    `cell` voxels wide, the same on every face (no stripes on tops or slopes)."""
    X, Y, Z = _coords(g)
    shade = base + _jitter(_hash(X // cell, Y // cell, Z // cell, seed=seed))
    return _paint(g, mask, ramp, shade)
