"""Fantasy prop helpers in the Pirate Nation style (import as `_props`).

Shared by the fantasy props so they read as one family: planked boxes with
dark framed edges, stone blocks, PN-sized lanterns, candles, potions,
books, shields, swords, sacks and flame tongues. Every helper fills the
grid, paints what it adds and returns the mask it added (rule S1: detail is
paint). Round things are n-gon prisms with true facets (rule F2).
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
from pnkit import box, edges
from pnshapes import bar, disc, facets, flat_ngon, last, quad, rotate
from voxgrid import C, Grid

__all__ = [
    "coords", "idx", "plank_box", "stone_box", "post", "brace", "lamp_lantern", "candle", "flame_tongue",
    "potion", "book", "heater", "sword", "sack", "burlap", "slope_glyph", "tufts", "glyph", "glyph_size", "GLYPHS", "gem",
]


def coords(g: Grid):
    """Voxel-centre coordinates (x, y, z)."""
    return np.meshgrid(*(np.arange(n) + 0.5 for n in g.shape), indexing="ij")


def idx(g: Grid):
    """Integer voxel indices (x, y, z)."""
    return np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")


# ------------------------------------------------------------------ blocks
def plank_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "wood", base: int = 5, across: str = "y", width: int = 3, frame=("darkwood", 3), nails: bool = True, seed: int = 0) -> np.ndarray:
    """A planked box with a dark 1-voxel frame on every edge (rule S4)."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.planks(g, m, ramp, base, width=width, across=across, nails=nails, seed=seed)
    if frame:
        P.flat(g, edges(m), *frame)
    return m


def stone_box(g: Grid, x0, y0, z0, x1, y1, z1, ramp: str = "stone", base: int = 5, block=(6, 3), rim: int | None = -1, seed: int = 0) -> np.ndarray:
    """A block of coursed stone; `rim` darkens its edges by that many shades."""
    m = box(g, x0, y0, z0, x1, y1, z1, ramp, base)
    P.stone(g, m, ramp, base, block=block, seed=seed)
    if rim:
        P.flat(g, edges(m), ramp, base + rim)
    return m


def post(g: Grid, x0, z0, y0, y1, s: int = 3, ramp: str = "darkwood", base: int = 4, seed: int = 0) -> np.ndarray:
    """A square post `s` thick with vertical grain."""
    m = box(g, x0, y0, z0, x0 + s, y1, z0 + s, ramp, base)
    P.planks(g, m, ramp, base, width=s, across="x", nails=False, seed=seed)
    return m


def brace(g: Grid, axis: str, p0, p1, thick: float, lo, hi, ramp: str = "darkwood", base: int = 4) -> np.ndarray:
    """A straight diagonal board (a true slope) painted with a lit top edge."""
    m = bar(g, axis, p0, p1, thick, lo, hi, ramp, base)
    P.flat(g, m, ramp, base)
    return m


# ------------------------------------------------------------------ lights
def flame_tongue(g: Grid, cx, y0, cz, r: float, h: float, lean: float = 0.0, seed: int = 0) -> np.ndarray:
    """A chunky flame: a four-sided pyramid turned 45° (true slopes), gold
    at the root, orange in the middle and a red tip. `lean` shifts the tip
    along x (flames lick sideways, rule F5)."""
    base = flat_ngon(cx, cz, r, 4, -math.pi / 4)
    g.prism("y", base, y0, y0 + h, C("orange", 5), top=[(cx + lean, cz)] * 4)
    m = last(g)
    _X, Y, _Z = coords(g)
    t = (Y - y0) / h
    P.flat(g, m & (t < 0.3), "gold", 6)
    P.flat(g, m & (t >= 0.3) & (t < 0.65), "orange", 5)
    P.flat(g, m & (t >= 0.65) & (t < 0.85), "orange", 4)
    P.flat(g, m & (t >= 0.85), "red", 5)
    return m


def lamp_lantern(g: Grid, cx: int, y0: int, cz: int, s: int = 6, body: int = 7, roof: str = "red", seed: int = 0) -> dict:
    """A lantern sized to the PN lamp family (PN lamp lanterns are about 6
    wide and 10 tall): a tapered dark foot (true slopes), glowing panes with
    a painted flame inside a dark frame, an eave and a steep tiled pyramid
    cap with a gold ring. (cx, cz) is the centre, y0 the bottom. Returns
    {'mask', 'glow', 'top' (ring top y), 'reach' (cap half-width)}."""
    h = s // 2
    start = len(g.solids)
    g.prism("z", [(cx - 1.5, y0), (cx + 1.5, y0), (cx + h + 1, y0 + 2), (cx - h - 1, y0 + 2)], cz - h - 1, cz + h + 1, C("darkwood", 3))
    foot = last(g)
    yb0, yb1 = y0 + 2, y0 + 2 + body
    panes = box(g, cx - h, yb0, cz - h, cx + h, yb1, cz + h, "gold", 6)
    X, Y, Z = coords(g)
    zface = panes & ((np.abs(Z - (cz - h + 0.5)) < 0.1) | (np.abs(Z - (cz + h - 0.5)) < 0.1))
    du = np.where(zface, np.abs(X - cx), np.abs(Z - cz))
    v = (Y - yb0) / body
    P.flat(g, panes & (du < 1.6) & (v > 0.15) & (v < 0.8), "orange", 5)
    P.flat(g, panes & (du < 0.9) & (v > 0.2) & (v < 0.5), "gold", 7)
    P.flat(g, edges(panes) | (panes & ((Y < yb0 + 1) | (Y > yb1 - 1))), "darkwood", 3)
    eave = box(g, cx - h - 1, yb1, cz - h - 1, cx + h + 1, yb1 + 1, cz + h + 1, "darkwood", 4)
    a = h + 1.5
    rise = s * 0.75
    g.prism("y", [(cx - a, cz - a), (cx + a, cz - a), (cx + a, cz + a), (cx - a, cz + a)], yb1 + 1, yb1 + 1 + rise, C(roof, 4), top=[(cx, cz)] * 4)
    cap = last(g)
    for m, fr in facets(g):
        P.tiles(g, m, roof, 4, row=2, width=3, frame=fr, seed=seed)
    ring_y = int(yb1 + 1 + rise - 1)
    ring = box(g, cx - 1, ring_y, cz - 1, cx + 1, ring_y + 3, cz + 1, "gold", 5)
    P.flat(g, ring & (Y > ring_y + 2), "gold", 3)
    m = foot | panes | eave | cap | ring | np.logical_or.reduce([sd.mask(g.shape) for sd in g.solids[start:]])
    return {"mask": m, "glow": (cx, yb0 + body / 2, cz), "top": ring_y + 3, "reach": a}


def candle(g: Grid, cx, y0, cz, h: int = 5, w: int = 2, wax=("bone", 6), seed: int = 0) -> np.ndarray:
    """A chunky candle `w` wide with a drip and a small flame on top."""
    x0, z0 = int(cx - w / 2), int(cz - w / 2)
    m = box(g, x0, y0, z0, x0 + w, y0 + h, z0 + w, *wax)
    _X, Y, _Z = idx(g)
    P.flat(g, m & (Y == y0 + h - 1), wax[0], min(7, wax[1] + 1))
    P.flat(g, m & (Y < y0 + 1), wax[0], wax[1] - 1)
    f = flame_tongue(g, x0 + w / 2, y0 + h, z0 + w / 2, 1.0, 3)
    return m | f


# ------------------------------------------------------------------ small objects
def potion(g: Grid, cx, y0, cz, r: float = 2.0, h: int = 5, liquid: str = "red", shade: int = 5, n: int = 6, neck: int = 2, cork=("wood", 5)) -> np.ndarray:
    """A faceted bottle: an n-gon body of coloured liquid with a lit band,
    a pale glass neck and a cork."""
    m = disc(g, "y", cx, cz, r, y0, y0 + h, liquid, shade, n=n)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > y0 + h - 1.5), liquid, min(7, shade + 1))
    P.flat(g, m & (X < cx - r + 1.2) & (Y > y0 + 1) & (Y < y0 + h - 1), liquid, min(7, shade + 2))  # glint
    P.flat(g, m & (Y < y0 + 1), liquid, max(1, shade - 2))
    nx, nz = int(round(cx - 0.5)), int(round(cz - 0.5))
    nk = box(g, nx, y0 + h, nz, nx + 1 + (1 if r >= 2 else 0), y0 + h + neck, nz + 1 + (1 if r >= 2 else 0), "sky", 7)
    ck = box(g, nx, y0 + h + neck, nz, nx + 1 + (1 if r >= 2 else 0), y0 + h + neck + 1, nz + 1 + (1 if r >= 2 else 0), *cork)
    return m | nk | ck


def book(g: Grid, x0, y0, z0, x1, y1, z1, cover: str = "red", shade: int = 4, spine: str = "x") -> np.ndarray:
    """A closed book lying flat: coloured covers top and bottom, cream page
    edges on three sides, a gold band on the spine (spine on the -`spine` side)."""
    m = box(g, x0, y0, z0, x1, y1, z1, "bone", 6)
    X, Y, Z = idx(g)
    covers = m & ((Y == y0) | (Y == y1 - 1))
    P.flat(g, covers, cover, shade)
    sp = m & ((X == x0) if spine == "x" else (Z == z0))
    P.flat(g, sp, cover, shade)
    P.flat(g, sp & (Y > y0) & (Y < y1 - 1), "gold", 6)
    return m


def gem(g: Grid, cx, y0, cz, r: float = 1.5, h: float = 3.0, ramp: str = "cyan", shade: int = 5) -> np.ndarray:
    """A cut gem: an octagonal crown frustum on a pointed pavilion (true facets)."""
    g.prism("y", flat_ngon(cx, cz, max(0.55, r * 0.4), 8), y0, y0 + h * 0.45, C(ramp, shade), top=flat_ngon(cx, cz, r, 8))
    m = last(g)
    g.prism("y", flat_ngon(cx, cz, r, 8), y0 + h * 0.45, y0 + h, C(ramp, shade + 1), top=flat_ngon(cx, cz, r * 0.55, 8))
    m |= last(g)
    _X, Y, _Z = coords(g)
    P.flat(g, m & (Y > y0 + h - 1), ramp, min(7, shade + 2))
    return m


def heater(g: Grid, cx, y0, z0, w: int, h: int, t: int = 2, field=("blue", 4), rim=("gold", 5), lean: float = 0.0, quarter=None, charge: str | None = None, ink=("gold", 6)) -> np.ndarray:
    """A heater (kite) shield facing -z: a flat top, straight sides and a
    pointed foot (a true-slope prism `t` thick from z0), a rim painted in
    `rim`, an optional quartered field (`quarter` = second (ramp, shade))
    and an optional GLYPHS/ICONS `charge` painted on the front."""
    hw = w / 2
    shoulder = y0 + h * 0.45
    pts = [(cx, y0), (cx + hw * 0.55, y0 + h * 0.12), (cx + hw, shoulder), (cx + hw, y0 + h), (cx - hw, y0 + h), (cx - hw, shoulder), (cx - hw * 0.55, y0 + h * 0.12)]
    pts = rotate(pts, cx, y0 + h / 2, lean)
    g.prism("z", pts, z0, z0 + t, C(*field))
    m = last(g)
    X, Y, _Z = coords(g)
    if quarter:
        q = m & (((X < cx) & (Y > y0 + h * 0.55)) | ((X >= cx) & (Y <= y0 + h * 0.55)))
        P.flat(g, q, *quarter)
    P.outline(g, m, *rim, normal="z")
    if charge:
        cw, ch = glyph_size(charge)
        glyph(g, "-z", z0, int(round(cx - cw / 2)), int(round(y0 + h * 0.55 - ch / 2)), charge, *ink)
    return m


def sword(g: Grid, x, y0, z0, length: int, t: int = 1, blade=("steel", 6), guard=("gold", 5), grip=("darkwood", 3), tilt: float = 0.0, up: bool = True) -> np.ndarray:
    """A chunky sword in the x-y plane (`t` thick from z0): a pointed
    blade 3 wide (true slopes at the tip), a wide gold crossguard, a dark
    grip and a round pommel. up=True: point up from y0; False: point down
    (thrust into the ground at y0)."""
    s = 1 if up else -1
    gy = y0 + s * 6 if up else y0 + length  # crossguard centre
    tip = (x, y0 + length) if up else (x, y0)
    root = (x, gy + s * 1)
    pts = quad(root, (tip[0], tip[1] - s * 3), 1.5, 1.5)
    pts = [pts[0], pts[1], tip, pts[2], pts[3]]
    pts = rotate(pts, x, gy, tilt)
    g.prism("z", pts, z0, z0 + t, C(*blade))
    m = last(g)
    X, Y, _Z = coords(g)
    ca, sa = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    across = (X - x) * ca + (Y - gy) * sa  # distance across the blade
    P.flat(g, m & (np.abs(across) < 0.5), blade[0], blade[1] + 1)  # fuller
    gpts = rotate([(x - 4, gy - 1), (x + 4, gy - 1), (x + 4, gy + 1), (x - 4, gy + 1)], x, gy, tilt)
    g.prism("z", gpts, z0 - 1, z0 + t + 1, C(*guard))
    m |= last(g)
    hy = gy - s * 1
    hpts = rotate([(x - 1, hy - s * 4), (x + 1, hy - s * 4), (x + 1, hy), (x - 1, hy)], x, gy, tilt)
    g.prism("z", hpts, z0, z0 + t, C(*grip))
    m |= last(g)
    py = hy - s * 5.5
    ppts = rotate(flat_ngon(x, py, 1.4, 6), x, gy, tilt)
    g.prism("z", ppts, z0 - 0.5 if t == 1 else z0, z0 + t + (0.5 if t == 1 else 0), C(guard[0], guard[1] + 1))
    m |= last(g)
    return m


def sack(g: Grid, cx, y0, cz, r: float, h: int, ramp: str = "wood", base: int = 6, tie=("darkwood", 4), mark: str | None = "wheat", seed: int = 0) -> np.ndarray:
    """A tied burlap sack: a bellied octagon (two frustums, true slopes), a
    pinched neck with a dark tie and a flared tuft, and a stencilled mark."""
    belly, shoulder, top = y0 + h * 0.3, y0 + h * 0.55, y0 + h * 0.8
    g.prism("y", flat_ngon(cx, cz, r * 0.85, 8), y0, belly, C(ramp, base), top=flat_ngon(cx, cz, r, 8))
    m = last(g)
    g.prism("y", flat_ngon(cx, cz, r, 8), belly, shoulder, C(ramp, base))
    m |= last(g)
    g.prism("y", flat_ngon(cx, cz, r, 8), shoulder, top, C(ramp, base), top=flat_ngon(cx, cz, r * 0.5, 8))
    m |= last(g)
    burlap(g, m, ramp, base, seed=seed)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y < y0 + 1), ramp, base - 1)
    P.flat(g, m & (Y > shoulder) & (Y < shoulder + 1), ramp, base - 1)  # the gathered fold
    g.prism("y", flat_ngon(cx, cz, r * 0.5, 8), top, top + 1.5, C(*tie))
    tie_m = last(g)
    g.prism("y", flat_ngon(cx, cz, r * 0.42, 8), top + 1.5, top + 4, C(ramp, base), top=flat_ngon(cx + (seed % 3 - 1) * 0.6, cz, r * 0.6, 8))
    tuft = last(g)
    P.flat(g, tuft, ramp, min(7, base + 1))
    P.flat(g, tuft & (Y < top + 2.5), ramp, base - 1)
    if mark:
        mw, mh = glyph_size(mark)
        glyph(g, "-z", cz - r, int(round(cx - mw / 2)), int(round(y0 + h * 0.32)), mark, "darkwood", 4, reach=3)
    return m | tie_m | tuft


def burlap(g: Grid, mask: np.ndarray, ramp: str = "wood", base: int = 6, frame="wall", seed: int = 0) -> None:
    """Coarse cloth: a flat base with broken weave rows one shade darker
    every third row (soft, rule S3; no speckle over the whole face)."""
    U, V = P.uv(g, frame)
    shade = np.full(g.shape, base)
    row = (V % 3 == 0) & (P._hash(U // 3, V, seed=seed) % np.uint64(3) != 0)
    shade = np.where(row, base - 1, shade)
    P._paint(g, mask, ramp, shade)


def tufts(g: Grid, pts, ramp: str = "leaf", flowers=None) -> np.ndarray:
    """Little grass tufts (1-voxel blades 2–4 tall) at ground points (x, z);
    `flowers` ((ramp, shade)) tops the tallest blade of each tuft."""
    m = np.zeros(g.shape, dtype=bool)
    for k, (tx, tz) in enumerate(pts):
        for dx, dz, th in ((0, 0, 4), (1, 1, 2), (-1, 1, 3)):
            m |= box(g, tx + dx, 0, tz + dz, tx + dx + 1, th, tz + dz + 1, ramp, 4 + th % 2)
        if flowers:
            f = flowers[k % len(flowers)]
            box(g, tx, 4, tz, tx + 1, 5, tz + 1, *f)
    return m


# ------------------------------------------------------------------ glyphs
GLYPHS: dict[str, list[str]] = {
    "crown": [
        "#...#...#",
        "##.###.##",
        "#########",
        "#-#-#-#-#",
        "#########",
    ],
    "lion": [
        "..###..",
        ".#####.",
        "##+#+##",
        "#######",
        ".##-##.",
        "..###..",
        ".#.#.#.",
    ],
    "wheat": [
        "#.#.#",
        ".###.",
        "#.#.#",
        ".###.",
        "..#..",
        "..#..",
    ],
    "tower": [
        "#.#.#",
        "#####",
        ".###.",
        ".#-#.",
        ".#-#.",
        "#####",
    ],
    "tree": [
        "..#..",
        ".###.",
        "#####",
        ".###.",
        "#####",
        "..#..",
    ],
    "mug": [
        "####.",
        "#++##",
        "####.#",
        "####.#",
        "#####.",
        "####.",
    ],
    "rune-a": ["#..#", "#.#.", "##..", "#.#.", "#..#"],
    "rune-b": ["###", "#.#", "###", "..#", "..#"],
    "rune-c": ["#.#", "###", ".#.", ".#.", ".#."],
    "rune-d": ["#..", "##.", "#.#", "##.", "#.."],
    "rune-e": [".#.", "#.#", ".#.", "#.#", ".#."],
    "fleur": [
        "..#..",
        ".###.",
        "#.#.#",
        "#####",
        "..#..",
        ".###.",
    ],
    "arrow": [
        "..#..",
        ".###.",
        "#####",
        "..#..",
        "..#..",
    ],
}


def glyph_size(name: str, scale: int = 1) -> tuple[int, int]:
    if name in GLYPHS:
        rows = GLYPHS[name]
        return (max(len(r) for r in rows) * scale, len(rows) * scale)
    return pnglyph.icon_size(name, scale)


def slope_glyph(g: Grid, mask: np.ndarray, frame, u0: int, v0: int, name: str, ramp: str, shade: int, scale: int = 1) -> np.ndarray:
    """Paint a GLYPHS/ICONS entry on a sloped facet mask using the facet's
    paint frame (pnshapes.facets): (u0, v0) is the top-left pixel in the
    frame's (U, V) (V grows down the slope). The kit's pnglyph only paints
    axis-aligned faces; this covers tilted faces (menhirs, lecterns)."""
    rows = GLYPHS[name] if name in GLYPHS else pnglyph.ICONS[name]
    U, V = P.uv(g, frame)
    out = np.zeros(g.shape, dtype=bool)
    lut = {"#": shade, "+": min(7, shade + 2), "-": max(1, shade - 2)}
    for r, row in enumerate(rows):
        for k, ch in enumerate(row):
            if ch not in lut:
                continue
            hit = mask & (U // scale == u0 // scale + k) & (V // scale == v0 // scale + r)
            P.flat(g, hit, ramp, lut[ch])
            out |= hit
    if not out.any():
        raise ValueError(f"slope_glyph {name!r} at ({u0}, {v0}) painted nothing")
    return out


def glyph(g: Grid, face: str, plane: float, u0: int, v0: int, name: str, ramp: str, shade: int, scale: int = 1, depth: int = 1, reach: int = 2) -> np.ndarray:
    """Paint a GLYPHS entry (or a pnglyph ICONS entry) on a face: '#' in
    ramp/shade, '+' two shades lighter, '-' two shades darker."""
    if name not in GLYPHS:
        return pnglyph.icon(g, face, plane, u0, v0, name, ramp, shade, scale=scale, depth=depth, reach=reach)
    legend = {"#": C(ramp, shade), "+": C(ramp, min(7, shade + 2)), "-": C(ramp, max(1, shade - 2))}
    return pnglyph.stamp(g, face, plane, u0, v0, GLYPHS[name], legend, scale, depth, reach)

