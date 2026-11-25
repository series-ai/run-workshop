"""Scenery for model-railway layouts: trees, bushes, rocks and flowerbeds,
and terrain pieces (a tunnel hill with a bore, a mountain peak, a grassy
mound, a cliff face and a retaining wall).

Origins sit at the centre of the base on the ground; +Y is up and the front
faces -Z. Colours use the fixed natural ramps; scenery has no swappable roles.
"""
from __future__ import annotations

import math

import numpy as np

from catalog import plain
from pnshapes import cone, last
from railkit import C, Grid, P, Part, coords

NATURE = "scenery-nature"
TERRAIN = "scenery-terrain"


# ---------------------------------------------------------------- helpers
def blob(cx: float, cz: float, r: float, n: int, jitter: float, seed: int, turn: float = 0.0) -> list[tuple[float, float]]:
    """An irregular n-gon footprint (x, z) around a centre: radius r, each corner
    pushed in or out by up to `jitter` (a fraction of r)."""
    rng = np.random.default_rng(seed)
    out = []
    for k in range(n):
        a = turn + 2 * math.pi * k / n
        rr = r * (1 + jitter * (rng.random() * 2 - 1))
        out.append((cx + rr * math.cos(a), cz + rr * math.sin(a)))
    return out


def scaled(poly, cx, cz, f):
    return [(cx + (x - cx) * f, cz + (z - cz) * f) for x, z in poly]


def speckle(g: Grid, mask, ramp: str, shades: tuple[int, ...], seed: int) -> None:
    """Paint a mask with random shades of one ramp (hand-painted variation)."""
    rng = np.random.default_rng(seed)
    pick = rng.integers(0, len(shades), g.shape)
    for i, sh in enumerate(shades):
        g.a[mask & (pick == i)] = C(ramp, sh)


def done(name: str, g: Grid, pivot, data: dict):
    return Part(name, g, pivot=pivot), [], [], data


# ---------------------------------------------------------------- trees and bushes
def _trunk(g, cx, cz, h, w=4, ramp="darkwood"):
    g.box(cx - w // 2, 0, cz - w // 2, cx - w // 2 + w, h, cz - w // 2 + w, C(ramp, 3))
    X, Y, Z = coords(g)
    m = (g.a == C(ramp, 3)) & (Y < h)
    P.flat(g, m & ((Y % 5) == 0), ramp, 2)


def _conifer(name: str, height: int, radius: float, tiers: int, seed: int):
    R = int(math.ceil(radius)) + 2
    g = Grid(2 * R, height + 1, 2 * R)
    cx = cz = R
    trunk = int(height * 0.16)
    _trunk(g, cx, cz, trunk + 4)
    foliage = np.zeros(g.shape, bool)
    span = height - trunk
    for k in range(tiers):
        f = k / tiers
        lo = trunk + span * f * 0.82
        hi = lo + span * (0.42 if k < tiers - 1 else 1 - f * 0.82)
        hi = min(hi, height)
        r = radius * (1 - 0.62 * f)
        top = 0.0 if k == tiers - 1 else r * 0.32
        cone(g, "y", cx, cz, r, int(lo), int(round(hi)), "forest", 4, n=8, r_top=top)
        foliage |= last(g)
    X, Y, Z = coords(g)
    speckle(g, foliage, "forest", (4, 4, 4, 3, 5), seed)
    # lighter tips on the upper half of each tier, darker skirts
    rr = np.hypot(X + 0.5 - cx, Z + 0.5 - cz)
    P.flat(g, foliage & (rr > radius * 0.55) & ((Y % 9) < 2), "forest", 2)
    P.flat(g, foliage & (Y > height - 6), "leaf", 4)
    return done(name, g, (cx, 0, cz), {"kind": "tree", "height": height, "footprint": 2 * radius})


def tree_conifer(name="tree-conifer"):
    """A fir: three stacked eight-sided cones on a short trunk, about 70 tall."""
    return _conifer(name, 70, 17, 3, 1)


def tree_conifer_tall(name="tree-conifer-tall"):
    """A tall spruce: four slim stacked cones, about 110 tall."""
    return _conifer(name, 110, 19, 4, 2)


def _crown(g, cx, cz, layers, ramp, seed, n=8):
    """Layered faceted crown: [(y0, y1, r0, r1), ...] frustums sharing one irregular
    outline, scaled per layer, so the facets run on smoothly from layer to layer."""
    shape = blob(0, 0, 1.0, n, 0.16, seed)
    ring = lambda r: [(cx + x * r, cz + z * r) for x, z in shape]  # noqa: E731
    m = np.zeros(g.shape, bool)
    for y0, y1, r0, r1 in layers:
        g.prism("y", ring(r0), y0, y1, C(ramp, 4), top=ring(r1) if r1 > 0 else [(cx, cz)] * n)
        m |= last(g)
    return m


def tree_deciduous(name="tree-deciduous"):
    """A broadleaf tree: a stout trunk with two limbs and a crown of three
    faceted layers, about 80 tall."""
    R = 34  # the jittered crown reaches 27 * 1.16
    g = Grid(2 * R, 82, 2 * R)
    cx = cz = R
    _trunk(g, cx, cz, 34, w=6, ramp="wood")
    g.box(cx - 9, 26, cz - 2, cx - 3, 30, cz + 2, C("wood", 3))  # limbs
    g.box(cx + 3, 30, cz - 2, cx + 9, 34, cz + 2, C("wood", 3))
    crown = _crown(g, cx, cz, [(28, 40, 18, 26), (40, 58, 26, 24), (58, 72, 24, 13), (72, 80, 13, 0.0)], "leaf", 11)
    X, Y, Z = coords(g)
    speckle(g, crown, "leaf", (4, 4, 4, 3, 5), 12)
    P.flat(g, crown & (Y < 32), "leaf", 2)  # shade under the crown
    P.flat(g, crown & (Y > 66), "lime", 4)  # sunlit top
    return done(name, g, (cx, 0, cz), {"kind": "tree", "height": 80, "footprint": 54})


def tree_deciduous_round(name="tree-deciduous-round"):
    """A small round-headed tree, about 60 tall."""
    R = 26
    g = Grid(2 * R, 62, 2 * R)
    cx = cz = R
    _trunk(g, cx, cz, 24, w=4, ramp="wood")
    crown = _crown(g, cx, cz, [(20, 30, 13, 19), (30, 44, 19, 18), (44, 54, 18, 9), (54, 60, 9, 0.0)], "forest", 21)
    X, Y, Z = coords(g)
    speckle(g, crown, "forest", (5, 5, 5, 4, 6), 22)
    P.flat(g, crown & (Y > 50), "leaf", 5)
    return done(name, g, (cx, 0, cz), {"kind": "tree", "height": 60, "footprint": 40})


def tree_birch(name="tree-birch"):
    """A slender birch: a tall white trunk with dark marks and a narrow
    light-green crown, about 90 tall."""
    R = 20
    g = Grid(2 * R, 92, 2 * R)
    cx = cz = R
    g.box(cx - 2, 0, cz - 2, cx + 2, 60, cz + 2, C("skin", 6))
    X, Y, Z = coords(g)
    bark = (g.a == C("skin", 6))
    rng = np.random.default_rng(31)
    P.flat(g, bark & (rng.random(g.shape) < 0.18), "iron", 3)
    crown = _crown(g, cx, cz, [(40, 52, 9, 14), (52, 72, 14, 11), (72, 90, 11, 0.0)], "lime", 32)
    speckle(g, crown, "lime", (4, 4, 4, 3, 5), 33)
    P.flat(g, crown & (Y < 44), "leaf", 3)
    return done(name, g, (cx, 0, cz), {"kind": "tree", "height": 90, "footprint": 30})


def _bush(name: str, r: float, h: int, ramp: str, seed: int, flowers: bool):
    R = int(math.ceil(r * 1.16)) + 2
    g = Grid(2 * R, h + 1, 2 * R)
    cx = cz = R
    m = _crown(g, cx, cz, [(0, int(h * 0.35), r * 0.78, r), (int(h * 0.35), int(h * 0.7), r, r * 0.8), (int(h * 0.7), h, r * 0.8, r * 0.3)], ramp, seed)
    X, Y, Z = coords(g)
    speckle(g, m, ramp, (4, 4, 4, 3, 5), seed + 1)
    if flowers:
        rng = np.random.default_rng(seed + 2)
        dots = m & (rng.random(g.shape) < 0.12) & (Y > 2)
        pick = rng.integers(0, 3, g.shape)
        for i, (ramp_, sh) in enumerate((("red", 5), ("pink", 5), ("gold", 6))):
            g.a[dots & (pick == i)] = C(ramp_, sh)
    return done(name, g, (cx, 0, cz), {"kind": "bush", "height": h, "footprint": 2 * r})


def bush_round(name="bush-round"):
    """A round shrub, about 18 tall."""
    return _bush(name, 12, 18, "leaf", 41, False)


def bush_flowering(name="bush-flowering"):
    """A low flowering shrub dotted red, pink and gold, about 16 tall."""
    return _bush(name, 11, 16, "forest", 51, True)


# ---------------------------------------------------------------- rocks and beds
def _rock(name, pieces, seed):
    """pieces: [(cx, cz, r, h, top_frac)], irregular faceted frustums."""
    size = int(max(max(abs(cx), abs(cz)) + r * 1.22 for cx, cz, r, h, t in pieces) * 2 + 4)
    H = int(max(h for *_, h, t in pieces)) + 1
    g = Grid(size, H, size)
    c = size / 2
    m = np.zeros(g.shape, bool)
    for i, (cx, cz, r, h, t) in enumerate(pieces):
        base = blob(c + cx, c + cz, r, 6, 0.22, seed + i, turn=i)
        g.prism("y", base, 0, h, C("stone", 4), top=scaled(blob(c + cx, c + cz, r, 6, 0.22, seed + i + 9, turn=i + 0.4), c + cx, c + cz, t))
        m |= last(g)
    X, Y, Z = coords(g)
    speckle(g, m, "stone", (3, 4, 5), seed)
    P.flat(g, m & (Y >= H - 3), "stone", 6)
    P.flat(g, m & (Y < 2), "moss", 4)
    return done(name, g, (c, 0, c), {"kind": "rock", "height": H - 1, "footprint": size - 4})


def rock_small(name="rock-small"):
    """A small faceted boulder, about 16 across."""
    return _rock(name, [(0, 0, 8, 12, 0.45)], 61)


def rock_large(name="rock-large"):
    """A cluster of three faceted boulders, about 40 across."""
    return _rock(name, [(0, 0, 14, 30, 0.35), (12, 7, 9, 18, 0.4), (-11, 8, 8, 13, 0.45)], 71)


def flowerbed(name="flowerbed"):
    """A station-garden flowerbed 64 by 24: stone edging, dark soil and rows
    of flowers in red, gold, pink, purple and white."""
    L, W = 64, 24
    g = Grid(L, 7, W)
    g.box(0, 0, 0, L, 3, W, C("stone", 5))  # edging
    g.box(2, 0, 2, L - 2, 4, W - 2, C("darkwood", 2))  # soil
    X, Y, Z = coords(g)
    top = (Y == 3) & (X >= 2) & (X < L - 2) & (Z >= 2) & (Z < W - 2)
    colours = (("red", 5), ("gold", 6), ("pink", 5), ("purple", 5), ("skin", 7))
    row = (Z - 2) // 4
    for i, (ramp, sh) in enumerate(colours):
        P.flat(g, top & (row == i) & ((X + Z) % 2 == 0), ramp, sh)
    P.flat(g, top & ((Z - 2) % 4 == 3), "leaf", 3)
    # a few raised clumps along the middle row
    for x in range(6, L - 6, 10):
        g.box(x, 4, 10, x + 3, 6, 14, C("leaf", 4))
        g.set(x + 1, 6, 12, C("red", 5))
    return done(name, g, (L / 2, 0, W / 2), {"kind": "flowerbed", "footprint": [L, W]})


# ---------------------------------------------------------------- terrain
def _paint_ground(g, m, height_of, seed, snow: float | None = None):
    """Grass on gentle slopes and terrace tops, rock on steep faces and inside,
    strata on the rock, optional snow above a height."""
    X, Y, Z = coords(g)
    rng = np.random.default_rng(seed)
    noise = rng.random(g.shape)
    # rock everywhere, banded
    g.a[m] = C("stone", 4)
    g.a[m & ((Y // 9) % 2 == 0)] = C("stone", 3)
    g.a[m & (noise < 0.15)] = C("stone", 5)
    h, steep = height_of  # per x column
    xs = np.arange(g.shape[0])
    depth = h[xs][:, None, None] - Y  # voxels below the silhouette top
    grass = m & (depth >= 0) & (depth < 4) & (~steep[xs])[:, None, None]
    g.a[grass] = C("leaf", 4)
    g.a[grass & (noise < 0.25)] = C("leaf", 3)
    g.a[grass & (noise > 0.85)] = C("moss", 5)
    g.a[grass & (noise > 0.97)] = C("gold", 6)  # a few wild flowers
    if snow is not None:
        cap = m & (Y >= snow - (noise * 6).astype(int))
        g.a[cap] = C("skin", 7)
        g.a[cap & (noise < 0.2)] = C("skin", 6)


def _profile(points, width):
    """Top height per x column of a silhouette [(x, y), ...] (x from -width/2), and which columns are steep."""
    xs = np.arange(width) + 0.5 - width / 2
    px = np.array([p[0] for p in points])
    py = np.array([p[1] for p in points])
    h = np.interp(xs, px, py)
    slope = np.abs(np.gradient(h))
    return h, slope > 0.95


def hill_tunnel(name="hill-tunnel"):
    """A 128-long mountain section with a tunnel bore straight through along z:
    terraced grassy ledges over rocky risers, rising to about 190, with vertical
    rock end faces that tunnel portals fit against. The bore matches the tunnel
    portal opening, one voxel larger, with a dark lining."""
    W, H, L = 324, 192, 128
    cx = W / 2
    half, spring = 33, 68  # the portal's opening is 32 / 68; the bore sits just outside it
    sil = [(-160, 0), (-154, 28), (-136, 34), (-126, 66), (-100, 74), (-90, 112), (-70, 132), (-58, 140), (-44, 168),
           (-20, 186), (12, 190), (34, 176), (52, 148), (64, 142), (84, 132), (96, 96), (118, 88), (128, 52), (146, 44), (154, 22), (160, 0)]
    arch = [(half * math.cos(math.pi * k / 16), spring + half * math.sin(math.pi * k / 16)) for k in range(17)]
    poly = sil + [(half, 0)] + arch + [(-half, 0)]
    g = Grid(W, H, L)
    g.prism("z", [(cx + x, y) for x, y in poly], 0, L, C("stone", 4))
    m = last(g)
    _paint_ground(g, m, _profile(sil, W), 81)
    X, Y, Z = coords(g)
    rr = np.hypot(X + 0.5 - cx, Y + 0.5 - spring)
    near_bore = m & (((Y + 0.5 >= spring) & (rr < half + 4)) | ((Y + 0.5 < spring) & (np.abs(X + 0.5 - cx) < half + 4)))
    g.a[near_bore] = C("iron", 2)  # lining
    P.flat(g, near_bore & ((Z % 16) == 0), "iron", 3)  # lining rings
    # end faces: rock, with turf only on the top edge
    ends = m & ((Z == 0) | (Z == L - 1)) & (~near_bore)
    g.a[ends & (g.a == C("leaf", 4))] = C("leaf", 3)
    data = {"kind": "tunnel-hill", "length": L, "bore": {"halfWidth": half, "height": spring + half}, "height": 190, "width": 320,
            "fits": "tunnel-portal at both ends, over straight track"}
    return done(name, g, (cx, 0, L / 2), data)


def mountain_peak(name="mountain-peak"):
    """A decorative rocky peak on a 256 by 256 footprint, about 260 tall,
    with grassy lower slopes and a snow cap."""
    S, H = 260, 262
    c = S / 2
    g = Grid(S, H, S)
    tiers = [(0, 70, 112, 88), (70, 130, 88, 62), (130, 185, 62, 38), (185, 230, 38, 14), (230, 260, 14, 0)]  # base reaches 112 * 1.12
    m = np.zeros(g.shape, bool)
    for i, (y0, y1, r0, r1) in enumerate(tiers):
        base = blob(c, c, r0, 9, 0.12, 90 + i, turn=i * 0.33)
        top = scaled(base, c, c, r1 / r0) if r1 > 0 else [(c + 3, c - 2)] * 9
        g.prism("y", base, y0, y1, C("stone", 4), top=top)
        m |= last(g)
    X, Y, Z = coords(g)
    rng = np.random.default_rng(92)
    noise = rng.random(g.shape)
    g.a[m] = C("stone", 4)
    g.a[m & ((Y // 11) % 2 == 0)] = C("stone", 3)
    g.a[m & (noise < 0.15)] = C("stone", 5)
    lower = m & (Y < 70 + (noise * 14).astype(int))
    g.a[lower] = C("leaf", 4)
    g.a[lower & (noise < 0.3)] = C("forest", 4)
    g.a[m & (Y >= 66) & (Y < 72)] = C("moss", 4)
    cap = m & (Y >= 196 - (noise * 10).astype(int))
    g.a[cap] = C("skin", 7)
    g.a[cap & (noise < 0.2)] = C("skin", 6)
    return done(name, g, (c, 0, c), {"kind": "mountain", "height": 260, "footprint": [256, 256]})


def hill_mound(name="hill-mound"):
    """A rolling grassy mound on a 192 by 192 footprint, about 60 tall."""
    S, H = 196, 62
    c = S / 2
    g = Grid(S, H, S)
    tiers = [(0, 22, 90, 76), (22, 42, 76, 52), (42, 56, 52, 24), (56, 60, 24, 0.0)]  # base reaches 90 * 1.06
    m = np.zeros(g.shape, bool)
    for i, (y0, y1, r0, r1) in enumerate(tiers):
        base = blob(c, c, r0, 12, 0.06, 100 + i, turn=i * 0.2)
        top = scaled(base, c, c, r1 / r0) if r1 > 0 else [(c, c)] * 12
        g.prism("y", base, y0, y1, C("leaf", 4), top=top)
        m |= last(g)
    X, Y, Z = coords(g)
    speckle(g, m, "leaf", (3, 4, 4, 5), 103)
    rng = np.random.default_rng(104)
    g.a[m & (rng.random(g.shape) < 0.03)] = C("moss", 5)
    g.a[m & (rng.random(g.shape) < 0.01)] = C("gold", 6)
    return done(name, g, (c, 0, c), {"kind": "mound", "height": 60, "footprint": [192, 192]})


def cliff_face(name="cliff-face"):
    """A modular rock cliff 64 long, 48 tall and 24 deep, for the edge between
    two levels; its profile is the same at both ends so lengths join."""
    L, H, D = 64, 48, 24
    g = Grid(L, H, D)
    prof = [(0, 0), (0, 24), (48, 24), (48, 3), (44, 2), (38, 5), (31, 3), (24, 6), (16, 4), (8, 7)]  # (y, z): back at z = 24, front ragged
    g.prism("x", prof, 0, L, C("stone", 4))
    m = last(g)
    X, Y, Z = coords(g)
    rng = np.random.default_rng(111)
    noise = rng.random(g.shape)
    g.a[m] = C("stone", 4)
    g.a[m & ((Y // 6) % 2 == 0)] = C("stone", 3)
    g.a[m & (noise < 0.18)] = C("stone", 5)
    g.a[m & (((X * 7) % 23) < 1)] = C("stone", 2)  # vertical cracks
    g.a[m & (Y >= H - 3)] = C("leaf", 4)  # turf on top
    g.a[m & (Y >= H - 3) & (noise < 0.3)] = C("moss", 5)
    g.a[m & (Y < 3)] = C("moss", 4)
    return done(name, g, (L / 2, 0, D / 2), {"kind": "cliff", "length": L, "height": H, "depth": D, "tiles": "along x"})


def retaining_wall(name="retaining-wall"):
    """A pale concrete retaining wall 64 long, 40 tall and 8 thick, with a
    coping, panel joints and weep holes; lengths join along x."""
    L, H, T = 64, 40, 8
    g = Grid(L, H, T + 2)
    g.box(0, 0, 1, L, H - 3, T + 1, C("gray", 6))
    g.box(0, H - 3, 0, L, H, T + 2, C("stone", 6))  # coping
    X, Y, Z = coords(g)
    wall = g.a == C("gray", 6)
    P.flat(g, wall & ((X % 16) == 0), "gray", 4)  # panel joints
    P.flat(g, wall & ((Y % 12) == 11), "gray", 5)
    for x in range(8, L, 16):
        P.flat(g, wall & (X >= x) & (X < x + 2) & (Y >= 6) & (Y < 8), "iron", 2)  # weep holes
    P.flat(g, wall & (Y < 2), "gray", 4)
    return done(name, g, (L / 2, 0, (T + 2) / 2), {"kind": "retaining-wall", "length": L, "height": H, "thickness": T, "tiles": "along x"})


CATALOG = [
    plain(NATURE, tree_conifer, "terrain-nature", "tree", "props"),
    plain(NATURE, tree_conifer_tall, "terrain-nature", "tree", "props"),
    plain(NATURE, tree_deciduous, "terrain-nature", "tree", "props"),
    plain(NATURE, tree_deciduous_round, "terrain-nature", "tree", "props"),
    plain(NATURE, tree_birch, "terrain-nature", "tree", "props"),
    plain(NATURE, bush_round, "terrain-nature", "tree", "props"),
    plain(NATURE, bush_flowering, "terrain-nature", "tree", "props"),
    plain(NATURE, rock_small, "terrain-nature", "terrain", "props"),
    plain(NATURE, rock_large, "terrain-nature", "terrain", "props"),
    plain(NATURE, flowerbed, "terrain-nature", "tile", "props"),
    plain(TERRAIN, hill_tunnel, "terrain-nature", "terrain", "structures"),
    plain(TERRAIN, mountain_peak, "terrain-nature", "terrain", "structures"),
    plain(TERRAIN, hill_mound, "terrain-nature", "terrain", "structures"),
    plain(TERRAIN, cliff_face, "terrain-nature", "terrain", "structures"),
    plain(TERRAIN, retaining_wall, "terrain-nature", "terrain", "structures"),
]
