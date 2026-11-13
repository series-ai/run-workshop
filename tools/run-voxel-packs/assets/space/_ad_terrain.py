"""Ten new Space terrain models, each with its own ground pad (Art Director repair).

The earlier wave built every new terrain model on one shared pad with the
same three bumps, and four models shared one stone stack or one wedge ring.
Here each model has its own pad outline, size and ground detail, and its
own main form:

- comet: an ice head half sunk in a scorched skid groove, one tapered tail
  that slopes down to the ground.
- meteor-boulder: one round, pitted mass in a small impact ring.
- crystal-spires: tall violet crystals on a rock mound (a hero piece).
- ice-shards: flat, broken ice slabs and snow drifts.
- basalt-columns: hexagonal columns with slanted tops and glowing seams.
- lava-vent: a cone with a breached rim and a wide lava flow down one side.
- geyser-vent: a terraced sinter mound, a thick water column and a steam cap.
- alien-mushrooms, alien-coral, alien-cactus: the plant forms on new pads.

Most pieces are 25-45 high on 40-56 pads, near the original Space terrain.
The cactus, the coral and the crystal spires stay tall as hero pieces.
Faces -Z. Sizes are in voxels.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
from _life import Grid, box, coords, front, globe, light_top, loft, mask_of, ngon_y, plan, rock, side, spots
from _repair_terrain import crystal, polygon
from pnshapes import cone, disc


def pad(g: Grid, cx, cz, rx, rz, ramp: str, shade: int, seed: int, h: float = 3, n: int = 9, inset: float = 2.5) -> np.ndarray:
    """A low ground pad with an irregular outline of n corners (true slopes
    on its rim). Each model passes its own size, outline seed and height."""
    rng = np.random.default_rng(seed)
    a0 = rng.uniform(0, 2 * math.pi)
    jit = rng.uniform(0.82, 1.1, size=n)

    def ring(sx, sz):
        return [(cx + sx * jit[k] * math.cos(a0 + 2 * math.pi * k / n), cz + sz * jit[k] * math.sin(a0 + 2 * math.pi * k / n)) for k in range(n)]

    m = plan(g, ring(rx, rz), 0, h, ramp, shade, top=ring(rx - inset, rz - inset))
    P.flat(g, m, ramp, shade)
    light_top(g, m, ramp, min(7, shade + 1))
    spots(g, m, ramp, max(1, shade - 1), cell=6, r=1.3, chance=3, seed=seed)
    return m


def _rock_paint(g: Grid, m, ramp: str, shade: int, seed: int) -> None:
    """Flat rock paint with a few large spots. A lit-top pass is not used
    here: on sloped faces it gives a stair-step speckle (S3)."""
    P.flat(g, m, ramp, shade)
    spots(g, m, ramp, max(1, shade - 1), cell=8, r=1.7, chance=4, seed=seed)


# ---------------------------------------------------------------- comet
def comet() -> Grid:
    g = Grid(52, 34, 76)
    cx, hz = 26, 20
    X, Y, Z = coords(g)
    base = pad(g, cx, 38, 22, 34, "sand", 4, seed=41, h=3)
    # A scorched skid groove runs back from the head under the tail.
    groove = base & (np.abs(X - cx) < 7 + (Z - hz) * 0.04) & (Z > hz)
    P.flat(g, groove, "iron", 5)
    P.flat(g, groove & (np.abs(X - cx) < 3), "iron", 4)
    spots(g, groove, "ember", 6, cell=5, r=0.9, chance=2, seed=42)
    # The impact pushed up a low berm in front of the head.
    for k, a in enumerate(np.linspace(-0.9, 0.9, 5)):
        bx, bz = cx + 15 * math.sin(a), hz - 12 * math.cos(a) - 1
        b = mask_of(g, rock(g, bx, bz, 1, 4.5 - abs(a) * 1.5, 6 - abs(a) * 2, "sand", 4, n=6, seed=50 + k))
        _rock_paint(g, b, "sand", 4, 50 + k)
    # One tapered tail: it starts in the head and slopes down to the ground.
    tail = loft(g, cx, [(hz + 4, 10, 8, 10), (hz + 18, 8, 6, 8), (hz + 32, 6, 4.5, 5.5), (hz + 44, 4, 3, 3.5), (hz + 53, 2, 1.6, 1.8)], "cyan", 6, k=0.4)
    tm = mask_of(g, tail)
    P.flat(g, tm, "cyan", 6)
    P.flat(g, tm & (np.abs(X - cx) < 2.5), "bone", 7)
    P.flat(g, tm & (np.abs(X - cx) > 5.5), "teal", 5)
    P.flat(g, tm & (np.abs(X - cx) >= 2.5) & (np.abs(X - cx) < 4), "cyan", 7)
    spots(g, tm, "bone", 7, cell=4, r=0.7, chance=3, seed=43)
    # The rough ice head is half sunk in the pad.
    head = rock(g, cx, hz, 1, 13, 24, "bone", 6, n=8, seed=44, lean=(0, 3), squash=0.9)
    hm = mask_of(g, head)
    P.flat(g, hm, "bone", 6)
    light_top(g, hm, "bone", 7)
    cracks = hm & ((np.abs((X - cx) * 0.7 + (Y - 12) * 0.9 + np.sin(Z * 0.4) * 1.5) < 0.8) | (np.abs((X - cx) * -0.8 + (Y - 16) * 0.6) < 0.7))
    P.flat(g, cracks, "cyan", 7)
    spots(g, hm & (Y > 6), "bone", 4, cell=6, r=1.2, chance=3, seed=45)
    spots(g, hm & (Y > 6), "cyan", 6, cell=5, r=0.8, chance=3, seed=46)
    for k, (dx, dz, r) in enumerate(((-17, 30, 3), (16, 40, 2.5), (12, 6, 2))):
        chunk = mask_of(g, rock(g, cx + dx, dz, 2, r, r * 1.6, "cyan", 6, n=6, seed=60 + k))
        P.flat(g, chunk, "cyan", 6)
        light_top(g, chunk, "bone", 7)
    return g


# ---------------------------------------------------------------- meteor
def meteor() -> Grid:
    g = Grid(54, 38, 52)
    cx, cz = 27, 26
    X, Y, Z = coords(g)
    base = pad(g, cx, cz, 25, 23, "sand", 4, seed=71, h=2.5, n=10)
    d = np.hypot(X - cx, Z - cz)
    # A dark scorch skirt under the rock.
    P.flat(g, base & (d < 17), "rust", 3)
    P.flat(g, base & (d < 13), "iron", 4)
    # A low impact ring of thrown-up sand chunks.
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.3
        b = mask_of(g, rock(g, cx + 19 * math.cos(a), cz + 18 * math.sin(a), 1, 3.2 + (k % 3) * 0.6, 4 + (k % 2) * 2, "sand", 5, n=6, seed=72 + k))
        _rock_paint(g, b, "sand", 5, 72 + k)
    # One round, pitted mass, sunk to a third of its height.
    ball = _sunk_globe(g, cx, 14, cz, 16, 1, "iron", 5, n=11)
    m = mask_of(g, ball)
    P.flat(g, m, "iron", 5)
    P.flat(g, m & (Y > 22), "iron", 6)
    spots(g, m & (Y > 8), "iron", 4, cell=8, r=2.6, chance=3, seed=73)
    spots(g, m & (Y > 8), "iron", 3, cell=8, r=1.3, chance=3, seed=73)
    # Glowing heat cracks wrap the lower half.
    crack = m & (np.abs(np.sin((X - cx) * 0.35) * 3 + (Y - 9) - (Z - cz) * 0.15) < 0.8)
    P.flat(g, crack, "orange", 6)
    P.flat(g, crack & (Y < 9), "gold", 7)
    P.flat(g, m & (Y < 3), "rust", 4)
    return g


def _sunk_globe(g: Grid, cx, cy, cz, r, y0, ramp: str, shade: int, n: int = 10) -> list:
    """A faceted ball (the GLOBE profile) cut flat at y0: the part below y0
    is under the ground, so the ball sits sunk in its pad."""
    from _life import GLOBE, flat_ngon
    from voxgrid import C
    pts = [(cy + f * r, k * r) for f, k in GLOBE]
    start = len(g.solids)
    for (ya, ra), (yb, rb) in zip(pts, pts[1:]):
        if yb <= y0:
            continue
        if ya < y0:
            ra = ra + (rb - ra) * (y0 - ya) / (yb - ya)
            ya = y0
        ya, yb = round(ya), round(yb)
        if yb <= ya:
            continue
        g.prism("y", flat_ngon(cx, cz, ra, n), ya, yb, C(ramp, shade), top=flat_ngon(cx, cz, rb, n))
    return g.solids[start:]


# ---------------------------------------------------------------- crystals
def spires() -> Grid:
    g = Grid(56, 66, 54)
    cx, cz = 28, 27
    pad(g, cx, cz, 25, 23, "purple", 3, seed=81, h=3, n=8)
    mound = mask_of(g, rock(g, cx, cz, 2, 16, 12, "steel", 4, n=7, seed=82, squash=0.85))
    _rock_paint(g, mound, "steel", 4, 82)
    # Violet-dominant faceted spires: one tall hero spire and three smaller ones.
    for x, z, r, h, ramp, lean in ((24, 24, 9, 58, "purple", (-4, 2)), (37, 33, 7, 40, "magenta", (5, 3)),
                                   (17, 35, 5, 26, "purple", (-4, 3)), (36, 17, 4.5, 20, "cyan", (3, -3))):
        crystal(g, x, z, 6, r, h, ramp, lean)
    X, Y, Z = coords(g)
    glow = (g.a != 0) & (Y > 3) & (Y < 5) & (np.hypot(X - cx, Z - cz) < 18)
    P.flat(g, glow, "magenta", 6)
    return g


def ice_shards() -> Grid:
    g = Grid(56, 40, 54)
    cx, cz = 28, 27
    X, Y, Z = coords(g)
    pad(g, cx, cz, 25, 24, "cyan", 4, seed=91, h=2.5, n=7)
    # Snow drifts: low white mounds with soft tops.
    for k, (x, z, rx, rz, h) in enumerate(((20, 34, 11, 8, 6), (36, 20, 9, 7, 5), (38, 38, 7, 6, 4))):
        drift = plan(g, polygon(x, z, rx, rz, 8, k), 2, h, "bone", 6, top=polygon(x + 1, z, rx * 0.45, rz * 0.45, 8, k))
        P.flat(g, drift, "bone", 6)
        light_top(g, drift, "bone", 7)
    # Flat broken slabs of ice tilt out of the ground in different directions.
    slabs = np.zeros(g.shape, dtype=bool)
    for k, (x, z, w, h, t, tilt, axis) in enumerate(((22, 26, 9, 34, 4, 7, "z"), (34, 30, 7, 27, 4, -9, "z"),
                                                       (28, 16, 6, 19, 3, 6, "x"), (16, 18, 5, 14, 3, -5, "x"), (40, 40, 6, 16, 3, 5, "x"))):
        u = x if axis == "z" else z
        poly = [(u - w / 2, 1), (u + w / 2, 1), (u + w / 2 + tilt * 0.6, h * 0.75), (u + tilt * 0.4, h), (u - w / 2 + tilt * 0.2, h * 0.85)]
        if axis == "z":
            slabs |= front(g, poly, z - t / 2, z + t / 2, "cyan", 6)
        else:
            slabs |= side(g, [(v, uu) for uu, v in poly], x - t / 2, x + t / 2, "cyan", 6)
    P.flat(g, slabs, "cyan", 6)
    P.flat(g, slabs & (np.floor(X + Z * 0.5) % 7 < 2), "cyan", 5)
    light_top(g, slabs, "bone", 7)
    P.flat(g, slabs & (np.abs(X - Z * 0.3 - Y * 0.4 - 8) < 0.7), "teal", 5)
    return g


# ---------------------------------------------------------------- basalt
def basalt() -> Grid:
    g = Grid(52, 46, 50)
    cx, cz = 26, 25
    X, Y, Z = coords(g)
    base = pad(g, cx, cz, 23, 21, "iron", 4, seed=101, h=3, n=9)
    # Hexagonal columns with slanted tops (a true-slope cap on each one).
    cols = [(20, 22, 6.5, 40, 1.5), (31, 20, 6, 33, -1.2), (25, 32, 5.5, 26, 1.0), (36, 31, 5, 19, -1.5), (14, 31, 4.5, 14, 1.2), (30, 11, 4.5, 12, 0.8)]
    allm = np.zeros(g.shape, dtype=bool)
    for k, (x, z, r, h, tilt) in enumerate(cols):
        col = ngon_y(g, x, z, r, 2, h - 3, "steel", 4 + k % 2, n=6, r_top=r * 0.96)
        top = plan(g, [(px, pz) for px, pz in _hex(x, z, r * 0.96)], h - 3, h, "steel", 5,
                   top=[(px + tilt * 0.3, pz) for px, pz in _hex(x, z, r * 0.7)])
        P.flat(g, col, "steel", 4 + k % 2)
        P.flat(g, col & (np.floor(Y) % 7 == 0), "iron", 3)
        P.flat(g, top, "steel", 6)
        allm |= col
    # Glowing teal seams run up from the cracked base between the columns.
    seam = allm & (Y < 12) & (np.abs(np.sin(X * 0.9 + Z * 0.7)) < 0.15)
    P.flat(g, seam, "teal", 6)
    P.flat(g, base & (np.abs((X - cx) * 0.6 - (Z - cz) + np.sin(X * 0.5) * 2) < 0.8), "teal", 6)
    P.flat(g, base & (np.abs((X - cx) + (Z - cz) * 0.4 - 6) < 0.7), "cyan", 7)
    return g


def _hex(x, z, r):
    R = r / math.cos(math.pi / 6)
    return [(x + R * math.cos(math.pi / 6 + k * math.pi / 3), z + R * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]


# ---------------------------------------------------------------- lava vent
def lava_vent() -> Grid:
    g = Grid(56, 34, 56)
    cx, cz = 28, 29
    X, Y, Z = coords(g)
    base = pad(g, cx, cz, 26, 25, "iron", 4, seed=111, h=2.5, n=9)
    # A wide cone; its rim breaks open on the front (-z) side.
    body = plan(g, polygon(cx, cz, 20, 19, 9, 3), 2, 24, "iron", 5, top=polygon(cx, cz + 1, 10, 9, 9, 3))
    _rock_paint(g, body, "iron", 5, 112)
    # Ash bands and thin glowing cracks run down the slopes.
    P.flat(g, body & (np.floor(Y + 1.5 * np.sin(X * 0.4 + Z * 0.3)) % 6 == 0), "iron", 6)
    P.flat(g, body & (np.abs(np.sin(np.arctan2(Z - cz, X - cx) * 5 + Y * 0.08)) < 0.06) & (Y < 21), "orange", 5)
    P.flat(g, body & (Y > 20), "ember", 5)
    P.flat(g, body & (Y > 22.5), "orange", 5)
    for k, a in enumerate((1.0, 2.2, 3.6, 5.2)):
        sx, sz = cx + 9 * math.cos(a), cz + 1 + 8 * math.sin(a)
        spike = cone(g, "y", sx, sz, 3.5, 20, 28 + (k % 2) * 3, "iron", 5, n=6, r_top=0.8)
        P.flat(g, spike, "iron", 5)
        P.flat(g, spike & (Y < 23), "ember", 5)
    pool = disc(g, "y", cx, cz + 1, 8, 22, 24.5, "orange", 6, n=9)
    P.flat(g, pool, "orange", 6)
    P.flat(g, pool & (np.hypot(X - cx, Z - cz - 1) < 4.5), "gold", 7)
    # The wide lava flow runs from the breach down the front slope.
    flow = side(g, [(25, cz - 7), (22.5, cz - 7), (3, cz - 23), (5.5, cz - 23)], cx - 5, cx + 5, "orange", 6)
    flow |= side(g, [(6, cz - 21), (3.5, cz - 21), (2.5, cz - 27), (4.5, cz - 27)], cx - 7, cx + 7, "orange", 6)
    P.flat(g, flow, "orange", 6)
    P.flat(g, flow & (np.abs(X - cx) < 2), "gold", 7)
    P.flat(g, flow & (np.abs(X - cx) > 4.5), "rust", 4)
    P.flat(g, base & (Z < cz - 20) & (np.abs(X - cx) < 10), "rust", 4)
    return g


# ---------------------------------------------------------------- geyser
GEYSER_TOP = 40


def geyser() -> Grid:
    g = Grid(54, 46, 54)
    cx, cz = 27, 27
    X, Y, Z = coords(g)
    pad(g, cx, cz, 25, 24, "steel", 4, seed=121, h=2.5, n=8)
    # A terraced sinter mound: stacked frustums with teal pools on each step.
    for k, (r, y0, y1) in enumerate(((20, 2, 6), (15, 6, 10), (10, 10, 14))):
        step = plan(g, polygon(cx, cz, r, r * 0.92, 10, k + 5), y0, y1, "bone", 5, top=polygon(cx, cz, r - 1.5, (r - 1.5) * 0.92, 10, k + 5))
        P.flat(g, step, "bone", 5)
        P.flat(g, step & (Y > y1 - 1), "bone", 6)
        P.flat(g, step & (Y < y0 + 1.2), "sand", 4)
        pool = step & (Y > y1 - 1) & (np.hypot(X - cx, Z - cz) > r - 4.5) & (np.hypot(X - cx, Z - cz) < r - 2)
        P.flat(g, pool, "teal", 6)
    # A thick water column that tapers up, a splash crown and soft steam puffs.
    col = ngon_y(g, cx, cz, 5, 14, 31, "cyan", 6, n=8, r_top=3)
    P.flat(g, col, "cyan", 6)
    P.flat(g, col & (np.abs(np.sin((X - cx) * 1.3 + (Z - cz) * 0.9 + Y * 0.25)) < 0.3), "bone", 7)
    crown = cone(g, "y", cx, cz, 8, 28, 33, "cyan", 6, n=10, r_top=3, tip="lo")
    P.flat(g, crown, "cyan", 6)
    light_top(g, crown, "bone", 7)
    for k, (dx, dz, y0, r, h) in enumerate(((0, 0, 31, 6, 7), (-4, 2, 34, 4, 6), (4, -1, 33, 4.5, GEYSER_TOP - 33))):
        puff = mask_of(g, rock(g, cx + dx, cz + dz, y0, r, h, "bone", 7, n=7, seed=125 + k))
        P.flat(g, puff, "bone", 7)
        P.flat(g, puff & (Y < y0 + 1.5), "bone", 6)
    for k, (x, z, r) in enumerate(((10, 38, 3), (44, 18, 3.5), (40, 42, 2.5))):
        b = mask_of(g, rock(g, x, z, 1, r, r * 1.5, "steel", 5, n=6, seed=122 + k))
        _rock_paint(g, b, "steel", 5, 122 + k)
    return g


# ---------------------------------------------------------------- plants
def mushrooms() -> Grid:
    g = Grid(52, 44, 48)
    cx, cz = 26, 24
    X, Y, Z = coords(g)
    pad(g, cx, cz, 23, 20, "purple", 4, seed=131, h=3, n=11)
    for x, z, y, r, h in ((20, 22, 2, 13, 28), (35, 30, 2, 10, 19), (14, 34, 2, 7, 12), (33, 13, 2, 5, 8)):
        stem = cone(g, "y", x, z, r * 0.26, y, y + h, "bone", 5, n=6, r_top=r * 0.32)
        P.flat(g, stem, "bone", 5)
        P.flat(g, stem & (Y < y + 3), "bone", 4)
        cap = ngon_y(g, x, z, r, y + h - 4, y + h + 5, "magenta", 5, n=8, r_top=r * 0.42)
        P.flat(g, cap, "magenta", 5)
        P.flat(g, cap & (Y > y + h + 3), "magenta", 6)
        for dx, dz, rr in ((-r * .35, -r * .25, r * .2), (r * .3, r * .15, r * .25)):
            P.flat(g, cap & (np.hypot(X - x - dx, Z - z - dz) < rr) & (Y > y + h - 1), "bone", 6)
        # Glowing gills under the cap.
        P.flat(g, cap & (Y < y + h - 2), "lime", 5)
    return g


def coral() -> Grid:
    from _repair_terrain import layer
    g = Grid(56, 66, 52)
    X, Y, Z = coords(g)
    pad(g, 28, 26, 24, 22, "teal", 4, seed=141, h=3, n=9)
    for x, z, dx, dz, h, ramp in ((28, 26, -8, 2, 56, "teal"), (24, 29, -16, -4, 40, "magenta"), (31, 23, 15, -3, 46, "purple"), (31, 29, 10, 12, 30, "teal")):
        for k in range(4):
            a, b = k / 4, (k + 1) / 4
            xx, zz = x + dx * a, z + dz * a
            rr = 4.5 * (1 - a) + 1.5
            layer(g, xx, zz, rr, rr * .75, 3 + h * a, 3 + h * b, ramp, 5, seed=k + round(x), inset=.7, lean=(dx / 4, dz / 4))
            if k in (1, 2):
                s = -1 if k == 1 else 1
                yy = 3 + h * (a + .13)
                twig = front(g, [(xx - 2, yy - 3), (xx + 2, yy - 3), (xx + s * 8 + 2, yy + 9), (xx + s * 8 - 1, yy + 13)], zz - 2, zz + 2, ramp, 5)
                P.mottle(g, twig & (g.a != 0), ramp, 5, cell=3, seed=k)
                crystal(g, xx + s * 8, zz, yy + 10, 2, 5, "magenta", (s, 1))
        crystal(g, x + dx, z + dz, 3 + h - 2, 3, 7, "lime", (dx * .08, dz * .08))
    return g


def cactus() -> Grid:
    g = Grid(52, 72, 48)
    cx, cz = 26, 24
    X, Y, Z = coords(g)
    pad(g, cx, cz, 22, 20, "sand", 5, seed=151, h=3, n=7)
    body = ngon_y(g, cx, cz, 8, 3, 56, "teal", 5, n=8, r_top=7)
    cap = cone(g, "y", cx, cz, 7, 55, 66, "teal", 5, n=8, r_top=3)
    P.flat(g, body | cap, "teal", 5)
    P.flat(g, (body | cap) & ((np.abs(X - cx + 4) < 1) | (np.abs(X - cx - 3) < 1)), "leaf", 6)
    light_top(g, body | cap, "teal", 6)
    for k in range(5):
        a = k * 2 * math.pi / 5
        for yy, hh, rr in ((6, 15, 8), (23, 14, 8.5), (39, 12, 7.5)):
            rib = box(g, cx + rr * math.cos(a) - 1, yy, cz + rr * math.sin(a) - 1, cx + rr * math.cos(a) + 1, yy + hh, cz + rr * math.sin(a) + 1, "leaf", 5)
            P.flat(g, rib & (g.a != 0), "leaf", 5)
        for yy in (12, 29, 45):
            thorn = cone(g, "y", cx + 8.5 * math.cos(a), cz + 8.5 * math.sin(a), 1.4, yy, yy + 4, "bone", 6, n=4, r_top=0)
            P.flat(g, thorn & (g.a != 0), "bone", 6)
    for s, y in ((-1, 20), (1, 32)):
        m = front(g, [(cx + s * 5, y), (cx + s * 16, y), (cx + s * 20, y + 5), (cx + s * 20, y + 20), (cx + s * 15, y + 20), (cx + s * 15, y + 7), (cx + s * 5, y + 7)], cz - 4, cz + 4, "teal", 5)
        P.flat(g, m, "teal", 5)
        light_top(g, m, "teal", 6)
        P.flat(g, m & (Y > y + 17), "leaf", 6)
        crystal(g, cx + s * 17, cz, y + 19, 3, 6, "magenta", (s * 2, 0))
    for x, z in ((12, 30), (40, 16)):
        crystal(g, x, z, 3, 3, 7, "magenta", (0, 0))
    return g


BUILDERS = {
    "comet": comet, "meteor-boulder": meteor, "crystal-spires": spires, "ice-shards": ice_shards,
    "basalt-columns": basalt, "lava-vent": lava_vent, "geyser-vent": geyser,
    "alien-mushrooms": mushrooms, "alien-coral": coral, "alien-cactus": cactus,
}
