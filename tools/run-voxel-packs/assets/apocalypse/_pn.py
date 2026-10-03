"""Apocalypse pack helpers for the Pirate Nation style.

Shapes are chunky prisms (true slopes and facets); detail is paint. These
helpers add the shapes and painters that the shared kit (blender/pnkit.py,
blender/paint.py) does not have yet: slanted bars, octagonal tyres and
drums, concrete slabs, corrugated sheet, hazard stripes and pixel icons.
Candidates for the shared kit are marked "(kit candidate)".
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from pnkit import ngon
from voxgrid import C, Grid

# 7x7 pixel icons ('#' = ink, '+' = second ink), painted, never modelled.
ICONS = {
    "skull": [
        ".#####.",
        "#######",
        "#..#..#",
        "#######",
        ".##.##.",
        "..+.+..",
        ".+.+.+.",
    ],
    "flame": [
        "...#...",
        "..##...",
        "..###..",
        ".##+##.",
        ".#+++#.",
        "##+++##",
        ".#####.",
    ],
}


def last(g: Grid) -> np.ndarray:
    """Mask of the prism added last."""
    return g.solids[-1].mask(g.shape)


def coords(g: Grid):
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


def bar(g: Grid, axis: str, p0, p1, thick: float, lo, hi, ramp: str, base: int = 4) -> np.ndarray:
    """A straight bar of `thick` from p0 to p1 in the plane across `axis`
    (PRISM_PLANE order), extruded over [lo, hi): braces, hoses, boards
    nailed across a window, leaning poles (a true slope). (kit candidate)"""
    (u0, v0), (u1, v1) = p0, p1
    length = math.hypot(u1 - u0, v1 - v0)
    nu, nv = -(v1 - v0) / length * thick / 2, (u1 - u0) / length * thick / 2
    g.prism(axis, [(u0 + nu, v0 + nv), (u1 + nu, v1 + nv), (u1 - nu, v1 - nv), (u0 - nu, v0 - nv)], lo, hi, C(ramp, base))
    return last(g)


def disc(g: Grid, axis: str, cu, cv, r, lo, hi, ramp: str, base: int = 4, n: int = 8) -> np.ndarray:
    """An n-gon prism: wheels, dials, sign globes, drum bodies."""
    g.prism(axis, ngon(cu, cv, r, n), lo, hi, C(ramp, base))
    return last(g)


def radial(g: Grid, axis: str, cu, cv) -> np.ndarray:
    """Distance of every voxel centre from the axis line (for painting rims and hubs)."""
    X, Y, Z = coords(g)
    P3 = {"x": X, "y": Y, "z": Z}
    a, b = {"x": ("y", "z"), "y": ("x", "z"), "z": ("x", "y")}[axis]
    return np.hypot(P3[a] + 0.5 - cu, P3[b] + 0.5 - cv)


def tyre(g: Grid, axis: str, cu, cv, r, lo, hi, hub: str = "steel", hub_base: int = 5, seed: int = 0) -> np.ndarray:
    """Octagonal tyre (true facets) with painted tread blocks, a painted rim
    and hub cap: one prism, no holes. (kit candidate)"""
    m = disc(g, axis, cu, cv, r, lo, hi, "gray", 3)
    d = radial(g, axis, cu, cv)
    X, Y, Z = coords(g)
    ang = np.arctan2(*{"x": (Z + 0.5 - cv, Y + 0.5 - cu), "y": (Z + 0.5 - cv, X + 0.5 - cu), "z": (Y + 0.5 - cv, X + 0.5 - cu)}[axis])
    tread = (np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int) % 2 == 0) & (d > r - 2.2)
    P.flat(g, m & tread, "gray", 2)
    P.flat(g, m & (d <= r * 0.62), hub, hub_base)
    P.flat(g, m & (d <= r * 0.62) & (d > r * 0.62 - 1.1), hub, hub_base - 2)
    P.flat(g, m & (d <= max(1.2, r * 0.2)), hub, hub_base + 2)
    return m


def concrete(g: Grid, mask: np.ndarray, ramp: str, base: int = 5, size: int = 16, cracks: int = 6, seed: int = 0) -> Grid:
    """Poured slabs seen from above: `size` squares on x/z with a 1-voxel
    seam, ±1 shade per slab and a few painted cracks. (kit candidate)"""
    X, Y, Z = coords(g)
    shade = base + P._jitter(P._hash(X // size, Z // size, seed=seed))
    shade = np.where((X % size == 0) | (Z % size == 0), base - 2, shade)
    rng = np.random.default_rng(seed)
    xs, zs = np.nonzero(mask.any(axis=1))
    for _ in range(cracks if len(xs) else 0):
        k = rng.integers(len(xs))
        x, z = float(xs[k]), float(zs[k])
        for _step in range(int(rng.integers(6, 14))):
            shade = np.where((X == int(x)) & (Z == int(z)), base - 2, shade)
            x += rng.choice([-1, 0, 1, 1])
            z += rng.choice([-1, 0, 1])
    return P._paint(g, mask, ramp, shade)


def corrugate(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, along: str = "z", period: int = 3, sheet: int = 14, seed: int = 0) -> Grid:
    """Corrugated sheet: 1-voxel light/dark ribs across `along`, sheets
    `sheet` voxels wide with a dark overlap seam, ±1 shade per sheet. (kit candidate)"""
    X, Y, Z = coords(g)
    u = {"x": X, "z": Z, "y": Y}[along]
    rib = np.array([1, 0, -1])[(u % period) % 3] if period == 3 else np.where(u % period == 0, -1, 0)
    shade = base + rib + P._jitter(P._hash(u // sheet, seed=seed)) * (P._hash(u // sheet, seed=seed + 1) % np.uint64(2)).astype(np.int64)
    shade = np.where(u % sheet == 0, base - 2, shade)
    return P._paint(g, mask, ramp, shade)


def hazard(g: Grid, mask: np.ndarray, period: int = 6, a=("gold", 5), b=("darkwood", 4), along: str = "xz") -> Grid:
    """45° hazard stripes (painted). `along` 'xz' runs them round walls, 'x'
    or 'z' uses one axis (for top faces). (kit candidate)"""
    X, Y, Z = coords(g)
    u = {"xz": X + Z, "x": X, "z": Z}[along]
    v = Y if along == "xz" else {"x": Z, "z": X}[along]
    band = ((u + v) // (period // 2)) % 2 == 0
    P.flat(g, mask & band, *a)
    P.flat(g, mask & ~band, *b)
    return g


def icon(g: Grid, face: str, name: str, u0: int, v0: int, ink, ink2=None, scale: int = 1) -> Grid:
    """Paint a 7x7 ICONS glyph on the first surface seen from `face`
    (bottom-left at u0, v0 in the viewer's reading order)."""
    from _kit import paint_at, _FACES

    _ua, us, _m, _ms = _FACES[face]
    rows = ICONS[name]
    for r, row in enumerate(rows):
        for c, px in enumerate(row):
            if px == ".":
                continue
            col = ink if px == "#" else (ink2 or ink)
            for a in range(scale):
                for b in range(scale):
                    u = u0 + us * (c * scale + a) + (0 if us > 0 else -1)
                    paint_at(g, face, u, v0 + (len(rows) - 1 - r) * scale + b, col)
    return g


def drum(g: Grid, cx, cz, y0, h, r, ramp: str = "red", base: int = 4, hoop: str | None = None, band=("gold", 5), label: str | None = "skull", seed: int = 0) -> np.ndarray:
    """Octagonal oil drum: a faceted body, two proud rolling hoops, a
    hazard band between them with a pixel icon on the front facet, a lid
    with a darker chime ring and bung caps, painted dents and rust. The
    front facet is 2·r·tan(22.5°) wide: r ≥ 8.5 fits a 7-wide icon. (kit candidate)"""
    hoop = hoop or ramp
    body = disc(g, "y", cx, cz, r, y0, y0 + h, ramp, base)
    X, Y, Z = coords(g)
    d = radial(g, "y", cx, cz)
    ang = np.arctan2(Z + 0.5 - cz, X + 0.5 - cx)
    lo_hoop, hi_hoop = y0 + max(2, round(h * 0.22)), y0 + h - max(3, round(h * 0.24))
    hoops = np.zeros(g.shape, dtype=bool)
    for hy in (lo_hoop, hi_hoop):
        hoops |= disc(g, "y", cx, cz, r + 0.7, hy, hy + 1.4, hoop, base + 1)
    P.flat(g, hoops & (Y >= 0), hoop, base + 1)
    if band:
        P.flat(g, body & ~hoops & (Y > lo_hoop) & (Y < hi_hoop), *band)
    top = body & (Y == y0 + h - 1)
    P.flat(g, top, ramp, base - 1)
    P.flat(g, top & (d > r - 1.6), ramp, base - 2)
    for bx, bz in ((cx - r * 0.4, cz + r * 0.35), (cx + r * 0.35, cz - r * 0.3)):
        P.flat(g, top & (np.hypot(X + 0.5 - bx, Z + 0.5 - bz) < 1.3), "steel", 6)
    P.flat(g, body & (Y == y0), ramp, base - 2)
    # painted dents (a dark pit under a light rim) and rust bloom on the paint
    rng = np.random.default_rng(seed)
    red = body & ~hoops & ~top & ((Y <= lo_hoop) | (Y >= hi_hoop + 1))
    for _ in range(3):
        a0, dy = rng.uniform(-math.pi, math.pi), rng.choice([rng.uniform(0.5, lo_hoop - y0 - 0.5), rng.uniform(hi_hoop - y0 + 1.5, h - 1.5)])
        near = red & (np.abs(np.angle(np.exp(1j * (ang - a0)))) < 0.4) & (np.abs(Y + 0.5 - y0 - dy) < 1.2)
        P.flat(g, near, ramp, base - 1)
        P.flat(g, near & (Y + 0.5 > y0 + dy), ramp, base + 2)
    rust = (red | (body & (Y > lo_hoop) & (Y < hi_hoop))) & (P._hash(X // 2, Y // 2, Z // 2, seed=seed + 7) % np.uint64(11) == 0) & (np.cos(ang) > 0.2)
    P.flat(g, rust, "rust", 5)
    if label:
        lv = (lo_hoop + 1.4 + hi_hoop) / 2
        icon(g, "-z", label, int(round(cx + 3.5)), int(round(lv - 3.5)), C("darkwood", 4), C("darkwood", 4))
    return body | hoops
