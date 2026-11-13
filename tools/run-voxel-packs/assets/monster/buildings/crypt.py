"""Family crypt, in the Pirate Nation haunted style.

After the PN mausoleum and the haunted town hall: a grey stone tomb on a
stepped plinth, a deep portico of chunky light stone columns under a steep
purple slate gable, a giant skull crest in the pediment (the oversized
function prop, rules F4 and F6), a horned cross on the apex and an iron
gate over a magenta-lit crypt door. Two weeping angels on pedestals guard
the steps; candles, urns and moss finish it. Masonry, slate, bars and the
skull frieze are painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _bld import coords, course, idx, last, opening, piers, plinth, roof_paint, rounded, steps, stone, urn, candle
from _pn import cross, lancet, pumpkin, rose, tombstone
from pnkit import box, gable_roof
from voxgrid import C, Asset, Grid, Part

W, H, D = 112, 112, 108
X0, X1, Z0, Z1 = 28, 84, 42, 96  # tomb walls
PZ0 = 26  # front of the portico (columns)
WALL = 58  # wall and entablature top
RIDGE = 92
CX = (X0 + X1) / 2


def angel(g: Grid, cx, cz, y0, facing: int = 1, seed: int = 0) -> np.ndarray:
    """A chunky weeping angel on a pedestal: a robe frustum, a bowed head
    with hands to the face, and two tall swept wings (true slopes)."""
    m = box(g, cx - 6, y0, cz - 6, cx + 6, y0 + 8, cz + 6, "stone", 4)
    P.stone(g, m, "stone", 4, block=(6, 4), seed=seed)
    cap = box(g, cx - 7, y0 + 8, cz - 7, cx + 7, y0 + 10, cz + 7, "gray", 6)
    y = y0 + 10
    robe = S.cone(g, "y", cx, cz, 5, y, y + 16, "bone", 5, r_top=3)
    X, Y, Z = coords(g)
    P.flat(g, robe & (np.abs(X - cx + 1.5) % 3 < 0.8), "bone", 4)  # robe folds
    head = box(g, cx - 3, y + 16, cz - 3.5, cx + 3, y + 22, cz + 2.5, "bone", 6)
    hands = box(g, cx - 2.5, y + 13, cz - 5.5, cx + 2.5, y + 18, cz - 2.5, "bone", 6)
    P.flat(g, hands & (Y > y + 16), "bone", 5)
    wings = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        wx = cx + s * 4
        g.prism("x", [(y + 6, cz + 1), (y + 21, cz + 0), (y + 30, cz + 5), (y + 24, cz + 8), (y + 14, cz + 7), (y + 4, cz + 4)], min(wx, wx + s * 2), max(wx, wx + s * 2), C("bone", 6))
        wings |= last(g)
    P.flat(g, wings & ((Y.astype(int) + Z.astype(int)) % 4 == 0), "bone", 5)  # painted feathers
    P.outline(g, wings, "bone", 4, normal="x")
    return m | cap | robe | head | hands | wings


def crypt() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth(g, X0 - 2, PZ0 - 2, X1 + 2, Z1, h=8, out=3, seed=1)
    steps(g, CX, PZ0 - 5, 44, n=2, rise=4, run=5, seed=2)
    walls = stone(g, X0, 8, Z0, X1, WALL, Z1, "gray", 5, seed=3)
    piers(g, X0, X1, Z0, Z1, 8, WALL, size=6, seed=4)
    course(g, X0, Z0, X1, Z1, WALL - 4, WALL, seed=5)
    # portico: four chunky light stone columns with bases and caps (F3)
    cols = [X0 - 4, X0 + 8, X1 - 16, X1 - 4]
    colm = np.zeros(g.shape, dtype=bool)
    for x in cols:
        colm |= stone(g, x, 8, PZ0, x + 8, WALL - 6, PZ0 + 8, "gray", 6, block=(4, 6), seed=6 + x)
        colm |= stone(g, x - 1, 8, PZ0 - 1, x + 9, 12, PZ0 + 9, "gray", 5, block=(5, 4), seed=7)
        colm |= stone(g, x - 1, WALL - 8, PZ0 - 1, x + 9, WALL - 6, PZ0 + 9, "gray", 5, block=(5, 2), seed=8)
    ent = stone(g, X0 - 6, WALL - 6, PZ0 - 2, X1 + 6, WALL, Z0 + 2, "gray", 6, block=(10, 3), seed=9)
    # a painted skull frieze on a purple band along the entablature (S1)
    P.flat(g, ent & (Z < PZ0 - 1) & (Y > WALL - 6) & (Y < WALL - 1), "purple", 4)
    P.flat(g, ent & ((X < X0 - 5) | (X > X1 + 5)) & (Y > WALL - 6) & (Y < WALL - 1), "purple", 4)
    for k, u in enumerate(range(int(X0 - 3), int(X1 + 3) - 8, 12)):
        pnglyph.icon(g, "-z", PZ0 - 2, u, WALL - 5, "skull", "bone", 6)
    # the roof: a steep purple slate gable to the front over tomb and portico
    roof = gable_roof(g, X0 - 4, X1 + 4, PZ0 - 2, Z1, WALL, RIDGE, ramp="purple", thick=5, overhang=5, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=10)
    roof_paint(g, roof, "z", 11)
    # the giant skull crest in the pediment (the function prop)
    S.skull(g, CX, WALL + 2, PZ0 - 7, s=22, eyes=("toxic", 7), seed=12)
    # iron gate over the magenta-lit door, between the inner columns
    gu0, gu1 = X0 + 16, X1 - 16
    arch = rounded(gu0, gu1, 8, WALL - 10)
    opening(g, "-z", Z0, arch, glow=("magenta", 6), deep=("purple", 3), d=1)
    frame = S.bar(g, "z", (gu0 - 1.5, 8), (gu0 - 1.5, WALL - 20), 3, Z0 - 2, Z0, "gray", 6)
    frame |= S.bar(g, "z", (gu1 + 1.5, 8), (gu1 + 1.5, WALL - 20), 3, Z0 - 2, Z0, "gray", 6)
    bars = np.zeros(g.shape, dtype=bool)
    for u in range(int(gu0) + 2, int(gu1) - 1, 5):
        top = WALL - 12 - abs(u + 1 - CX) * 0.35
        bars |= box(g, u, 8, Z0 - 3, u + 2, top, Z0 - 1, "gray", 4)
        g.prism("y", [(u - 0.3, Z0 - 3.3), (u + 2.3, Z0 - 3.3), (u + 2.3, Z0 - 0.7), (u - 0.3, Z0 - 0.7)], top, top + 3, C("gray", 5), top=[(u + 1, Z0 - 2)] * 4)
    for ry in (14, 30):
        bars |= box(g, gu0, ry, Z0 - 4, gu1, ry + 2, Z0 - 2, "gray", 3)
    lock = box(g, CX - 2, 20, Z0 - 5, CX + 2, 25, Z0 - 3, "gold", 4)
    # side lancets glowing toxic green, a small rose at the back
    for zz in (Z0 + 14, Z0 + 32):
        lancet(g, "+x", X1, zz, zz + 8, 18, 44, glass="toxic", shade=5, seed=13)
        lancet(g, "-x", X0, zz, zz + 8, 18, 44, glass="magenta", shade=5, seed=14)
    # horned cross on the apex, small crosses on the back corners
    cross(g, CX, RIDGE + 7, PZ0 - 5, h=17, arm=6)
    # guardians and grave goods at the steps (K1)
    angel(g, X0 - 13, PZ0 - 4, 0, seed=15)
    angel(g, X1 + 13, PZ0 - 4, 0, seed=16)
    urn(g, X0 - 4, 8, Z1 - 4, s=9, glow=("toxic", 6))
    urn(g, X1 + 4, 8, Z1 - 4, s=9, glow=("toxic", 6))
    for x, z in ((CX - 18, PZ0 - 9), (CX - 14, PZ0 - 8), (CX + 15, PZ0 - 9), (CX + 12, PZ0 - 13)):
        candle(g, x, 4 if z > PZ0 - 10 else 0, z, h=4 if x < CX else 6)
    # a magenta rose window in the back gable, pumpkins on the steps (C3)
    rose(g, "+z", Z1, CX, WALL + 14, 7, glass="magenta", shade=6)
    pumpkin(g, CX - 26, 0, PZ0 - 12, w=12, h=9, seed=19)
    pumpkin(g, CX + 25, 0, PZ0 - 10, w=10, h=8, seed=20)
    pumpkin(g, X1 + 4, 8, Z0 + 8, w=10, h=8, seed=21)
    # a toppled column drum and a leaning tombstone at the side (F5)
    S.disc(g, "x", 4, Z1 - 12, 3.5, X1 + 6, X1 + 16, "gray", 6)
    tombstone(g, X0 - 12, Z1 - 16, w=10, h=16, lean=-10, seed=22)
    tombstone(g, X0 - 13, Z1 - 30, w=8, h=11, lean=7, glyph="", seed=23)
    # creeping moss on the plinth and the lower walls
    Xi, Yi, Zi = idx(g)
    lowmask = (g.a > 0) & (Y < 18) & ~g.solid_mask()
    hit = (P._hash(Xi // 3, Yi // 2, Zi // 3, seed=17) % np.uint64(9)) == 0
    P.flat(g, lowmask & hit & (Y < 12 + (Xi % 5)), "moss", 5)
    P.grime(g, lowmask, height=4, seed=18)
    # moss over the plinth, the steps and the roof edges (C1 accent)
    from _pn import blotch
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    blotch(g, (g.a > 0) & up & (Y < 9) & ~g.solid_mask(), "moss", 5, cell=3, chance=0.2, seed=24)
    blotch(g, roof["slabs"] & (Y < WALL + 6), "moss", 5, cell=3, chance=0.18, seed=25)
    # ivy climbing the left wall and the outer left column (F5: one side only)
    ivy = (g.a > 0) & ~g.solid_mask() & (X < X0 + 2) & (Y > 8) & (Y < 44 - np.abs(Z - Z0 - 20) * 0.5) & (((X + Z).astype(int) % 6) < 3)
    ivy |= colm & (X < X0 + 4) & (Y < 34) & (((Y + Z).astype(int) % 5) < 2)
    P.flat(g, ivy, "moss", 5)
    blotch(g, ivy, "toxic", 3, cell=2, chance=0.15, seed=26)
    return g


def build() -> Asset:
    g = crypt()
    root = Part("crypt", g, pivot=(0.0, 0.0, 0.0))
    return Asset(id="monster-buildings-crypt", pack="monster", category="buildings", name="Family Crypt", root=root)
