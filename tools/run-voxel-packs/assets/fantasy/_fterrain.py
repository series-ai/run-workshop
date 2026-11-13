"""Low-level helpers for the fantasy terrain models (import as `_fterrain`).

Each terrain model owns its massing and its ground shape. This file only
holds the shared low-level steps: an irregular outline, a natural ground
pad with soft grass tone ramps, smooth noise, and rock paint. Grids use
glTF axes: +Y up, the front is -Z.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnshapes as S
from _life import coords, facet_paint, plan, rockface
from pnkit import edges


def outline(cx: float, cz: float, rx: float, rz: float, n: int, seed: int, wobble: float = 0.12, turn: float = 0.0):
    """An irregular natural outline (x, z): an ellipse rx by rz with n
    corners, made uneven by two low waves and a small jitter per corner."""
    if n < 8:
        raise ValueError("outline needs 8 or more corners")
    rng = np.random.default_rng(seed)
    p2, p3 = rng.uniform(0, 2 * math.pi, 2)
    out = []
    for k in range(n):
        a = turn + 2 * math.pi * k / n
        f = 1.0 + wobble * (0.6 * math.sin(2 * a + p2) + 0.4 * math.sin(3 * a + p3)) + rng.uniform(-0.04, 0.04)
        out.append((cx + rx * f * math.cos(a), cz + rz * f * math.sin(a)))
    return out


def shrink(pts, cx: float, cz: float, by: float):
    """The outline moved `by` voxels toward (cx, cz)."""
    out = []
    for x, z in pts:
        d = math.hypot(x - cx, z - cz)
        f = max(0.0, d - by) / max(d, 1e-6)
        out.append((cx + (x - cx) * f, cz + (z - cz) * f))
    return out


def noise(X: np.ndarray, Z: np.ndarray, cell: float, seed: int) -> np.ndarray:
    """Smooth value noise in [0, 1] over x and z (bilinear between cell
    corners). It gives soft patches, not per-voxel speckle (rule S3)."""
    gx, gz = X / cell, Z / cell
    ix, iz = np.floor(gx).astype(np.int64), np.floor(gz).astype(np.int64)
    fx, fz = gx - ix, gz - iz
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)

    def v(a, b):
        return (P._hash(a + 4096, b + 4096, seed=seed) % np.uint64(1024)).astype(float) / 1023.0

    top = v(ix, iz) * (1 - fx) + v(ix + 1, iz) * fx
    bot = v(ix, iz + 1) * (1 - fx) + v(ix + 1, iz + 1) * fx
    return top * (1 - fz) + bot * fz


def ramp_paint(g, mask: np.ndarray, ramp: str, shades, cell: float, seed: int) -> None:
    """Paint `mask` with soft patches of the listed shades (darkest first)."""
    X, _Y, Z = coords(g)
    n = noise(X, Z, cell, seed)
    k = np.clip((n * len(shades)).astype(np.int64), 0, len(shades) - 1)
    P._paint(g, mask, ramp, np.asarray(shades)[k])


def ground(g, pts, cx: float, cz: float, seed: int, top_y: float = 2.0, grass=("leaf", (3, 4, 5)), earth=("wood", 3), cell: float = 7.0):
    """A natural ground pad on the outline `pts`: an earth lip (y 0 to 1)
    under a grass tier with a slope to `top_y`. The top gets soft grass
    tone ramps and a lit lip; the sides show earth with a grass fringe.
    Returns (pad mask, top mask)."""
    if top_y <= 1.2:
        raise ValueError("ground needs top_y above 1.2")
    lip = plan(g, pts, 0, 1, earth[0], earth[1], top=shrink(pts, cx, cz, 0.6))
    tier = plan(g, shrink(pts, cx, cz, 0.6), 1, top_y, grass[0], grass[1][0], top=shrink(pts, cx, cz, 0.6 + (top_y - 1) * 0.9))
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    pad = lip | tier
    # the earth side: soil courses, a few pebbles, a dark foot
    P.flat(g, lip, earth[0], earth[1])
    P.flat(g, lip & ((P._hash(Xi // 3, Zi // 3, seed=seed + 1) % np.uint64(4)) == 0), earth[0], earth[1] + 1)
    P.flat(g, lip & ((P._hash(Xi // 2, Zi // 2, seed=seed + 2) % np.uint64(11)) == 0), "stone", 5)
    top = tier & (Y > top_y - 1)
    side = tier & ~top
    ramp_paint(g, side, grass[0], [s - 1 for s in grass[1]], cell, seed + 3)
    ramp_paint(g, top, grass[0], grass[1], cell, seed + 4)
    # a second, larger moss patch layer so the turf has two hues
    P.flat(g, top & (noise(X, Z, cell * 1.7, seed + 5) > 0.72), "moss", 5)
    P.flat(g, top & (noise(X, Z, cell * 1.7, seed + 5) > 0.84), "moss", 6)
    # the lit grass lip along the outer rim
    rim = top & ~shrink_mask(g, top, 1)
    P.flat(g, rim, grass[0], min(7, grass[1][-1] + 1))
    return pad, top


def shrink_mask(g, mask: np.ndarray, steps: int) -> np.ndarray:
    """The mask eroded in x and z by `steps` voxels."""
    m = mask.copy()
    for _ in range(steps):
        n = m.copy()
        n[1:, :, :] &= m[:-1, :, :]
        n[:-1, :, :] &= m[1:, :, :]
        n[:, :, 1:] &= m[:, :, :-1]
        n[:, :, :-1] &= m[:, :, 1:]
        m = n
    return m


def rock_world(g, mask: np.ndarray, seed: int, ramp: str = "stone", base: int = 3, strata: int = 0) -> None:
    """Paint natural rock on a mask in world pattern space (walls use
    (x + z, y), tops use (x, z)). Use it on concave prisms, where face
    ownership and seams are not reliable."""
    rockface(g, mask, ramp, base, frame=None, seed=seed)
    U, V = P.uv(g, None)
    if strata:
        bed = ((V % strata) == 0) & ((P._hash(U // 7, V // strata, seed=seed + 2) % np.uint64(4)) != 0)
        P.flat(g, mask & bed, ramp, max(1, base - 2))
    h = P._hash(U // 3, V // 3, seed=seed + 5) % np.uint64(31)
    P.flat(g, mask & (h == 0), "moss", 4)
    P.flat(g, mask & (h == 1) & ((U + V) % 3 != 0), "khaki", 5)


def rock(g, solids, seed: int, ramp: str = "stone", base: int = 4, top_ramp=("stone", 5), strata: int = 0, dark=None) -> np.ndarray:
    """Paint natural rock on the prisms: big rock patches per facet, calm
    lichen spots, lit arrises and dark edges. `strata` > 0 adds bedding
    lines every `strata` voxels on the walls. `dark` (ramp, shade) frames
    the box edges. Returns the rock mask."""
    m = np.zeros(g.shape, dtype=bool)
    for s in solids:
        m |= s.mask(g.shape)

    def painter(gg, mm, fr):
        if fr == "top":
            P.flat(gg, mm, *top_ramp)
        else:
            rockface(gg, mm, ramp, base, frame=fr, seed=seed)
            if strata:
                U, V = P.uv(gg, fr)
                bed = ((V % strata) == 0) & ((P._hash(U // 7, V // strata, seed=seed + 2) % np.uint64(4)) != 0)
                P.flat(gg, mm & bed, ramp, max(1, base - 2))
            U, V = P.uv(gg, fr)
            h = P._hash(U // 3, V // 3, seed=seed + 5) % np.uint64(31)
            P.flat(gg, mm & (h == 0), "moss", 4)
            P.flat(gg, mm & (h == 1) & ((U + V) % 3 != 0), "khaki", 5)

    facet_paint(g, solids, painter)
    P.flat(g, m & S.seams(g, solids, 0.6), ramp, min(7, base + 2))
    if dark is not None:
        P.flat(g, edges(m) & ~S.seams(g, solids, 0.6), *dark)
    return m


def moss_drape(g, mask: np.ndarray, y_from: float, seed: int, cx: float, cz: float, tongue: float = 4.0, ramp: str = "moss") -> np.ndarray:
    """Moss over the top of `mask` down to about `y_from`, with a wavy hem
    and longer tongues in some sectors. Returns the moss mask."""
    X, Y, Z = coords(g)
    sector = np.floor((np.arctan2(Z - cz, X - cx) + math.pi) * 2.6).astype(np.int64)
    hs = P._hash(sector, seed=seed)
    drop = np.where(hs % np.uint64(4) == 0, tongue, (hs // np.uint64(4) % np.uint64(3)).astype(float) * 0.8)
    wave = (P._hash(np.floor(X + Z).astype(np.int64) // 2, seed=seed + 1) % np.uint64(2)).astype(float)
    hem = y_from - drop - wave
    m = mask & (Y > hem)
    P.flat(g, m, ramp, 4)
    P.flat(g, m & (Y > hem + 2), ramp, 5)
    P.flat(g, m & (noise(X, Z, 4.0, seed + 2) > 0.62) & (Y > hem + 2), ramp, 6)
    P.flat(g, mask & (Y > hem - 1) & (Y <= hem), ramp, 2)  # the dark hem
    return m


# radius factor per height fraction: a rounded, slightly squat mass
ROUND = ((0.0, 0.84), (0.2, 1.0), (0.48, 0.97), (0.72, 0.8), (0.9, 0.52), (1.0, 0.24))


def rounded_rock(g, cx: float, cz: float, y0: float, r: float, h: float, n: int = 11, seed: int = 0, profile=ROUND,
                 squash=(1.0, 1.0), lean=(0.0, 0.0), ramp: str = "stone", base: int = 4):
    """One rounded rock mass: a stack of frustums on one irregular n-gon
    that swells, then closes over the top (true slopes on every ring).
    `lean` shifts the crown by (dx, dz). Unpainted. Returns (mask, solids)."""
    rng = np.random.default_rng(seed)
    jit = 0.86 + 0.26 * rng.random(n)
    turn = float(rng.uniform(0, math.pi))
    sx, sz = squash

    def ring(t: float, f: float):
        dx, dz = lean[0] * t * t, lean[1] * t * t
        return [(cx + dx + r * f * jit[k] * sx * math.cos(turn + 2 * math.pi * k / n),
                 cz + dz + r * f * jit[k] * sz * math.sin(turn + 2 * math.pi * k / n)) for k in range(n)]

    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    # drop rings closer than 1.2 voxels to the next, so every frustum holds voxel centres
    prof = [profile[0]]
    for t, f in profile[1:]:
        if h * (t - prof[-1][0]) < 1.2 and len(prof) > 1:
            prof[-1] = (t, f)
        else:
            prof.append((t, f))
    if h * (prof[-1][0] - prof[-2][0]) < 1.0:
        raise ValueError(f"rounded_rock: h={h} is too low for its profile")
    for (t0, f0), (t1, f1) in zip(prof, prof[1:]):
        m |= plan(g, ring(t0, f0), y0 + h * t0, y0 + h * t1, ramp, base, top=ring(t1, f1))
    return m, g.solids[start:]


def fern(g, x: float, y: float, z: float, size: float = 6.0, ramp: str = "forest", base: int = 5, turn: int = 0) -> np.ndarray:
    """A small fern: four sloped fronds that fan out and up from (x, y, z)."""
    m = np.zeros(g.shape, dtype=bool)
    s = size
    # 'z' bars take (x, y) points; 'x' bars take (y, z) points
    arms = (("z", (x, y), (x - s, y + s * 0.7), z), ("z", (x, y), (x + s * 0.9, y + s * 0.8), z),
            ("x", (y, z), (y + s * 0.9, z - s * 0.8), x), ("x", (y, z), (y + s * 0.6, z + s), x))
    for k, (axis, p0, p1, c) in enumerate(arms[turn % 4:] + arms[:turn % 4]):
        fm = S.bar(g, axis, p0, p1, 1.6, c - 0.8, c + 0.8, ramp, base)
        m |= fm
        P.flat(g, fm, ramp, base + (k % 2))
    return m
