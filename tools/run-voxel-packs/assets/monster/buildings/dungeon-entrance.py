"""Dungeon entrance, in the Pirate Nation haunted style.

A mossy rocky hill of big faceted boulders (true slopes, rule F2) with a
massive light stone gate set into it: two chunky piers and a round arch
(true facets), a giant skull keystone with glowing eyes (the oversized
function prop, F4 and F6), a raised iron portcullis with spiked teeth,
and painted stairs that go down into a pumpkin-orange glow. Two
skull-topped pillars carry toxic-green fire bowls; chains hang on the
piers; steps, bones and pumpkins lie at the foot. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import coords, mushroom, rounded, stone
from _pn import blotch, pumpkin
from _props import TOXIC, pn_flame
from pnkit import box
from voxgrid import C, Asset, Grid, Part

W, H, D = 124, 98, 126
CX = 62.0
GZ0, GZ1 = 38, 52  # gate front and back
GX0, GX1 = 32, 92  # gate outer width
AX0, AX1 = 44, 80  # arch opening
SPRING = 38  # the arch springs here; the crown is at SPRING + half the opening
GTOP = 66
FLOOR = 8  # landing height


# boulders: (x, z, foot y, radius, height, ramp); back and crest ones first
HILL = [
    (CX, 90, 0, 35, 44, "gray"),  # tier 0: the wide back mound and flanks
    (22, 68, 0, 21, 22, "purple"),
    (102, 66, 0, 21, 24, "gray"),
    (38, 104, 0, 20, 20, "gray"),
    (88, 106, 0, 19, 18, "purple"),
    (CX - 22, 80, 30, 25, 26, "gray"),  # tier 1
    (CX + 23, 82, 28, 25, 26, "gray"),
    (28, 66, 18, 14, 14, "gray"),
    (97, 66, 20, 13, 13, "purple"),
    (CX - 25, 64, 50, 20, 24, "gray"),  # tier 2: the crest behind the gate
    (CX + 25, 66, 50, 20, 24, "gray"),
    (CX + 1, 68, 58, 17, 22, "gray"),
    (CX - 21, 46, 64, 16, 15, "gray"),  # boulders sitting on the gate top, so it never shows from behind
    (CX + 22, 47, 64, 16, 16, "purple"),
    (CX + 2, 58, 66, 13, 16, "gray"),
    (CX - 7, 72, 74, 13, 14, "gray"),  # tier 3: the top stones
    (CX + 15, 76, 70, 10, 11, "purple"),
    (13, 44, 0, 11, 11, "gray"),  # stones at the feet
    (112, 42, 0, 10, 9, "purple"),
    (104, 90, 0, 12, 12, "gray"),
]


def boulder(g: Grid, cx, cz, y0, r: float, h: float, ramp: str = "stone", seed: int = 0) -> np.ndarray:
    """A chunky faceted boulder in the PN coastal-rock way: wider than tall,
    an irregular 7-gon that bulges out a little above its foot and closes
    to a broad, turned and shifted top (true slopes on every side). Stone
    blocks follow each facet; the upward faces are lighter (lit tops) and
    carry moss."""
    rng = np.random.default_rng(seed)
    n = 7
    radii = [r * rng.uniform(0.78, 1.0) for _ in range(n)]
    a0 = rng.uniform(0, 2 * math.pi)
    sx, sz = rng.uniform(-0.12, 0.12) * r, rng.uniform(-0.12, 0.12) * r

    def ring(scale, twist, dx=0.0, dz=0.0):
        return [(cx + dx + scale * radii[k] * math.cos(a0 + twist + 2 * math.pi * k / n),
                 cz + dz + scale * radii[k] * math.sin(a0 + twist + 2 * math.pi * k / n)) for k in range(n)]

    base, belly, top = ring(0.86, 0.0), ring(1.0, math.radians(6)), ring(0.56, math.radians(16), sx, sz)
    yb = y0 + h * 0.3
    start = len(g.solids)
    g.prism("y", base, y0, yb, C(ramp, 4), top=belly)
    g.prism("y", belly, yb, y0 + h, C(ramp, 5), top=top)
    solids = g.solids[start:]
    m = np.logical_or.reduce([sd.mask(g.shape) for sd in solids])
    S.paint_facets(g, solids, lambda gg, mm, fr: P.stone(gg, mm, ramp, 4, block=(8, 6), cracks=0.12, frame=fr, seed=seed))
    _X, Y, _Z = coords(g)
    P.flat(g, m & S.seams(g, solids, 0.8), ramp, 3)
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    lit = m & up
    P.stone(g, lit, ramp, 6, block=(7, 5), cracks=0.0, frame="top", seed=seed + 1)
    blotch(g, lit & (Y > y0 + h * 0.8), "moss", 6, cell=3, chance=0.55, seed=seed + 2)
    blotch(g, lit & (Y > y0 + h * 0.8), "moss", 7, cell=2, chance=0.15, seed=seed + 3)
    return m


def fire_bowl(g: Grid, cx, y0, cz, r: float = 6) -> np.ndarray:
    """An iron fire bowl (an upturned octagon frustum on a short stem) with
    glowing coals and a cursed toxic fire (the shared PN flame)."""
    m = S.cone(g, "y", cx, cz, r * 0.45, y0, y0 + 3, "gray", 3, r_top=r * 0.3)
    bowl = S.cone(g, "y", cx, cz, r * 0.55, y0 + 3, y0 + 7, "gray", 3, r_top=r)
    _X, Y, _Z = coords(g)
    P.flat(g, bowl & (Y > y0 + 6), "gray", 5)
    m |= bowl
    m |= box(g, cx - r + 1.5, y0 + 6, cz - r + 1.5, cx + r - 1.5, y0 + 7.5, cz + r - 1.5, "toxic", 5)
    m |= pn_flame(g, cx, cz, y0 + 7, r * 1.6, r * 2.2, colors=TOXIC, cross=0.8)
    return m


def arch_frame(x0, x1, xi0, xi1, top, spring, y0, n: int = 8):
    """A gate outline in (x, y) with a round arch opening, as one simple polygon."""
    r = (xi1 - xi0) / 2
    cu = (xi0 + xi1) / 2
    pts = [(x0, y0), (x0, top), (x1, top), (x1, y0), (xi1, y0), (xi1, spring)]
    pts += [(cu + r * math.cos(math.pi * k / n), spring + r * math.sin(math.pi * k / n)) for k in range(1, n)]
    pts += [(xi0, spring), (xi0, y0)]
    return pts


def entrance() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the hill: a pile of chunky faceted boulders (PN coastal rocks), big
    # low ones at the foot, smaller ones stacked on them; the back ones
    # rise over the gate top, so it never shows from behind
    for k, (x, z, y0, r, h, ramp) in enumerate(HILL):
        boulder(g, x, z, y0, r, h, ramp=ramp, seed=1 + k)
    # the landing and front steps
    land = stone(g, GX0 - 6, 0, GZ0 - 16, GX1 + 6, FLOOR, GZ1, "stone", 5, block=(9, 4), seed=10)
    stp = stone(g, AX0 - 2, 0, GZ0 - 26, AX1 + 2, 4, GZ0 - 16, "stone", 5, block=(6, 4), seed=11)
    # the gate: chunky piers and a faceted round arch, light stone
    g.prism("z", arch_frame(GX0, GX1, AX0, AX1, GTOP, SPRING, FLOOR), GZ0, GZ1, C("gray", 6))
    frame = [g.solids[-1]]
    S.paint_facets(g, frame, lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(6, 5), cracks=0.1, frame=fr, seed=12))
    fm = S.last(g)
    # voussoirs: painted radial joints round the arch (S1)
    cu, r = (AX0 + AX1) / 2, (AX1 - AX0) / 2
    ang = np.arctan2(Y - SPRING, X - cu)
    rad = np.hypot(X - cu, Y - SPRING)
    ring = fm & (Z < GZ0 + 1) & (Y > SPRING) & (rad < r + 7)
    P.flat(g, ring, "gray", 7)
    P.flat(g, ring & ((np.abs(((ang / math.pi * 9) % 1) - 0.5) > 0.42) | (np.abs(rad - r - 7) < 0.6)), "gray", 4)
    cap = stone(g, GX0 - 3, GTOP, GZ0 - 2, GX1 + 3, GTOP + 5, GZ1 + 2, "gray", 6, block=(10, 5), seed=13)
    # the dark stair well: a painted opening going down into orange light
    g.prism("z", rounded(AX0, AX1, FLOOR, SPRING + r, n=8), GZ0 + 3, GZ1, C("purple", 2))
    well = S.last(g)
    t = (Y - FLOOR) / (SPRING + r - FLOOR)
    P.flat(g, well & (t < 0.62), "purple", 3)
    for k in range(6):
        yk = FLOOR + k * 3.2
        band = well & (Y >= yk) & (Y < yk + 2.2) & (np.abs(X - cu) < r - k * 1.2)
        P.flat(g, band, "orange", max(2, 6 - k))
        P.flat(g, well & (Y >= yk + 2.2) & (Y < yk + 3.2) & (np.abs(X - cu) < r - k * 1.2), "orange", max(1, 4 - k))
    P.flat(g, well & (Y < FLOOR + 3), "ember", 6)
    P.stone(g, well & (Z > GZ1 - 1), "gray", 5, block=(6, 5), seed=23)
    # the raised portcullis: iron bars with spiked teeth in the arch top
    bars = np.zeros(g.shape, dtype=bool)
    for u in range(int(AX0) + 2, int(AX1) - 1, 5):
        top = SPRING + math.sqrt(max(0.0, r * r - (u + 1 - cu) ** 2)) - 1
        bot = SPRING + 4
        if top - bot < 3:
            continue
        bars |= _box(g, u, bot, GZ0 + 1, u + 2, top, GZ0 + 3, "gray", 3)
        g.prism("y", [(u, GZ0 + 1), (u + 2, GZ0 + 1), (u + 2, GZ0 + 3), (u, GZ0 + 3)], bot - 4, bot, C("gray", 5), top=[(u + 1, GZ0 + 2)] * 4)
    for yy in (SPRING + 6, SPRING + 13):
        half = math.sqrt(max(0.0, r * r - (yy + 1 - SPRING) ** 2))
        _box(g, cu - half, yy, GZ0, cu + half, yy + 2, GZ0 + 1, "gray", 3)
    # the giant skull keystone with glowing eyes
    S.skull(g, cu, SPRING + r - 8, GZ0 - 6, s=22, eyes=("toxic", 7), socket=("purple", 1), seed=14)
    # hanging chains on the piers (painted links on proud straps)
    for x in (GX0 + 5, GX1 - 7):
        strap = _box(g, x, 24, GZ0 - 1, x + 2, GTOP - 4, GZ0, "gray", 3)
        P.flat(g, strap & ((Y.astype(int) // 2) % 2 == 0), "gray", 5)
        _box(g, x - 1, GTOP - 6, GZ0 - 2, x + 3, GTOP - 3, GZ0, "gray", 4)
    # skull-topped pillars with toxic fire bowls
    for px in (GX0 - 16, GX1 + 8):
        pm = stone(g, px, 0, GZ0 - 18, px + 8, 34, GZ0 - 10, "gray", 6, block=(4, 5), seed=15)
        stone(g, px - 1, 0, GZ0 - 19, px + 9, 4, GZ0 - 9, "gray", 5, block=(5, 4), seed=16)
        w, h = pnglyph.icon_size("skull")
        pnglyph.icon(g, "-z", GZ0 - 18, int(px + 4 - w / 2), 20, "skull", "bone", 6, inks={".": ("gray", 6)})
        fire_bowl(g, px + 4, 34, GZ0 - 14, r=6)
    # bones, a skull and pumpkins at the foot (K1)
    S.skull(g, CX - 26, 0, GZ0 - 20, s=8, eyes=("toxic", 6), seed=17)
    for x0, z0, x1, z1 in ((CX - 32, GZ0 - 26, CX - 20, GZ0 - 24), (CX - 30, GZ0 - 22, CX - 27, GZ0 - 14)):
        _box(g, x0, 0, z0, x1, 2, z1, "bone", 6)
    pumpkin(g, CX + 30, 0, GZ0 - 28, w=12, h=9, seed=18)
    pumpkin(g, CX + 40, 0, GZ0 - 22, w=9, h=7, seed=19)
    pumpkin(g, GX0 - 12, FLOOR, GZ0 + 4, w=10, h=8, seed=20)
    # glowing toadstools at the rock feet (C3 accents)
    for k, (x, z, h) in enumerate(((16, 30, 7), (20, 26, 5), (12, 25, 4), (108, 30, 6), (104, 26, 4), (40, 20, 5))):
        mushroom(g, x, 0, z, h=h, r=2.5 + h * 0.3, cap=("toxic", 6) if k % 3 else ("magenta", 6))
    # moss drapes over the gate top and the landing edges
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    blotch(g, (cap | land | fm) & up, "moss", 5, cell=3, chance=0.2, seed=21)
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=22)
    return g


def _box(g, x0, y0, z0, x1, y1, z1, ramp, shade):
    from pnkit import box

    return box(g, x0, y0, z0, x1, y1, z1, ramp, shade)


def build() -> Asset:
    root = Part("dungeon-entrance", entrance(), pivot=(0.0, 0.0, 0.0))
    return Asset(id="monster-buildings-dungeon-entrance", pack="monster", category="buildings", name="Dungeon Entrance", root=root)
