"""More material painters (rules S1–S4), built on paint.uv().

Colour only, never shape: like paint.py, every painter takes a bool `mask`,
a palette ramp and a `base` shade, and paints soft ramps with darker seams.
Every painter takes `frame=None` (see paint.uv): walls get (x + z, y), so the
pattern wraps corners; voxels only seen from above get (x, z), so tops get
straight rows, never diagonal streaks; pass a (u_vec, v_vec) pair (see
pnshapes.facets) to follow a slope. Deterministic (seeded hashes).

    hazard       45° warning stripes in two inks
    corrugate    sheet-metal ribs with dark overlap seams
    concrete     poured slabs with seams and a few cracks
    fur          short painted hair strokes
    blotch       worn patches in 3D cells (roofs, hide, rust)
    plated       riveted plates with a dark frame on the mask edges
    glow_window  a glowing pane in a frame, with a bar and a glint
"""
from __future__ import annotations

import numpy as np

import paint as P
from voxgrid import Grid

_hash, _jitter, _paint = P._hash, P._jitter, P._paint


def _edges(mask: np.ndarray) -> np.ndarray:
    """Voxels of a box-like mask on two or more of its outer planes."""
    count = np.zeros(mask.shape, dtype=np.int8)
    for axis in range(3):
        for step in (1, -1):
            nb = np.roll(mask, step, axis=axis)
            edge = [slice(None)] * 3
            edge[axis] = 0 if step == 1 else -1
            nb[tuple(edge)] = False
            count += (mask & ~nb).astype(np.int8)
    return mask & (count >= 2)


def hazard(g: Grid, mask: np.ndarray, period: int = 6, a=("gold", 5), b=("darkwood", 3), frame=None) -> Grid:
    """45° hazard stripes, `period` voxels per stripe pair, in inks `a` and
    `b` ((ramp, shade) pairs). On a top the stripes are 45° in the top plane."""
    U, V = P.uv(g, frame)
    half = max(1, period // 2)
    band = ((U + V) // half) % 2 == 0
    P.flat(g, mask & band, *a)
    P.flat(g, mask & ~band, *b)
    return g


def corrugate(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, period: int = 3, sheet: int = 14, length: int = 24, frame=None, seed: int = 0) -> Grid:
    """Corrugated sheet: ribs across U (light, mid, dark), sheets `sheet`
    voxels wide with a dark overlap seam and a light lip beside it, rows of
    sheets `length` long with a dark lap line, ±1 shade per sheet. Ribs run
    up the walls, along z on tops and down the slope on roofs."""
    U, V = P.uv(g, frame)
    row = V // length
    u = U + (row % 2) * (sheet // 2)  # sheets in the next row are offset
    ribs = np.array([1, 0, -1] if period == 3 else [0] * (period - 1) + [-1])
    shade = base + ribs[u % period]
    tone = _hash(u // sheet, row, seed=seed)
    shade = shade + _jitter(tone) * (_hash(u // sheet, row, seed=seed + 1) % np.uint64(2)).astype(np.int64)
    shade = np.where(u % sheet == 0, base - 2, shade)
    shade = np.where(u % sheet == 1, base + 1, shade)
    shade = np.where(V % length == length - 1, base - 2, shade)
    return _paint(g, mask, ramp, shade)


def concrete(g: Grid, mask: np.ndarray, ramp: str, base: int = 5, size: int = 16, cracks: int = 6, frame=None, seed: int = 0) -> Grid:
    """Poured slabs `size` voxels square with a 1-voxel dark seam, ±1 shade
    per slab and `cracks` short painted cracks (random walks)."""
    U, V = P.uv(g, frame)
    shade = base + _jitter(_hash(U // size, V // size, seed=seed))
    shade = np.where((U % size == 0) | (V % size == 0), base - 2, shade)
    us, vs = U[mask], V[mask]
    if len(us) and cracks:
        rng = np.random.default_rng(seed)
        crack = set()
        for _ in range(cracks):
            k = int(rng.integers(len(us)))
            u, v = int(us[k]), int(vs[k])
            du, dv = (1, 0) if rng.random() < 0.5 else (0, 1)
            for _step in range(int(rng.integers(5, 12))):
                crack.add((u, v))
                if rng.random() < 0.35:  # a kink
                    u, v = u + dv * int(rng.choice([-1, 1])), v + du * int(rng.choice([-1, 1]))
                else:
                    u, v = u + du, v + dv
        keys = U.astype(np.int64) * 100003 + V.astype(np.int64)
        hit = np.isin(keys, np.array([cu * 100003 + cv for cu, cv in crack], dtype=np.int64))
        shade = np.where(hit, base - 2, shade)
    return _paint(g, mask, ramp, shade)


def fur(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, stroke: int = 3, frame=None, seed: int = 0) -> Grid:
    """Painted fur: short strokes (1 wide, `stroke` long, along V) one shade
    darker or lighter on a flat base, like PN painted hide. Most texels stay
    on the base shade (rule S3)."""
    U, V = P.uv(g, frame)
    h = _hash(U, (V + U % stroke) // stroke, seed=seed) % np.uint64(10)
    shade = base + np.where(h < 2, -1, np.where(h == 9, 1, 0))
    return _paint(g, mask, ramp, shade)


def blotch(g: Grid, mask: np.ndarray, ramp: str, shade: int, cell: int = 3, chance: float = 0.1, frame=None, seed: int = 0) -> Grid:
    """Irregular patches (worn or missing tiles, dirt, rust): three offset
    grids of 3D cells `cell` voxels wide, each hit with `chance`, painted in
    ramp/shade. 3D cells look the same on walls, tops and slopes, so `frame`
    is accepted for a uniform API and not used."""
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    hit = np.zeros(g.shape, dtype=bool)
    for k, (ox, oy) in enumerate(((0, 0), (1, 2), (2, 1))):
        h = _hash((X + ox) // cell, (Y + oy) // cell, (Z + ox + oy) // cell, seed=seed + k)
        hit |= (h % np.uint64(1000)) < np.uint64(int(chance * 1000))
    return P.flat(g, mask & hit, ramp, shade)


def plated(g: Grid, mask: np.ndarray, ramp: str = "steel", base: int = 4, size=(10, 6), rivets: bool = True, edge: bool = True, frame=None, seed: int = 0) -> Grid:
    """PN mecha plates: riveted panels with a darker border (paint.plates)
    and, with `edge`, a 1-voxel darker frame on the edges of a box-like mask
    (rule S4)."""
    P.plates(g, mask, ramp, base, size=size, rivets=rivets, frame=frame, seed=seed)
    if edge:
        P.flat(g, _edges(mask), ramp, base - 2)
    return g


def _plane_uv(g: Grid, mask: np.ndarray, frame):
    """(U, V) for a flat panel: with no frame, the axes of the panel's two
    longest extents (so a skylight and a wall pane both work)."""
    if frame is not None:
        return P.uv(g, frame)
    idx = np.nonzero(mask)
    ext = [int(i.max() - i.min()) for i in idx]
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    thin = int(np.argmin(ext))
    return {0: (Z, Y), 1: (X, Z), 2: (X, Y)}[thin]


def glow_window(g: Grid, mask: np.ndarray, rim=("rust", 3), glass=("cyan", 6), bar: bool = True, glint: bool = True, frame=None) -> Grid:
    """A glowing window painted into a flat panel mask (PN mecha windows):
    glass, a 1-voxel rim, a lighter band along the top, a bar across the
    long side's middle and a diagonal glint. Works on walls and tops."""
    if not mask.any():
        raise ValueError("glow_window got an empty mask")
    U, V = _plane_uv(g, mask, frame)
    u, v = U[mask], V[mask]
    u0, u1, v0, v1 = int(u.min()), int(u.max()), int(v.min()), int(v.max())
    P.flat(g, mask, *glass)
    edge = mask & ((U == u0) | (U == u1) | (V == v0) | (V == v1))
    inner = mask & ~edge
    P.flat(g, inner & (V >= v1 - 2), glass[0], min(7, glass[1] + 1))
    if glint and u1 - u0 >= 6 and v1 - v0 >= 6:
        du = U - u0
        dv = v1 - V
        P.flat(g, inner & ((du + dv == 4) | (du + dv == 6)) & (du < (u1 - u0) // 2), glass[0], 7)
    if bar:
        if u1 - u0 >= v1 - v0:
            mid = (u0 + u1) // 2
            P.flat(g, mask & (U == mid), *rim)
        else:
            mid = (v0 + v1) // 2
            P.flat(g, mask & (V == mid), *rim)
    P.flat(g, edge, *rim)
    return g
