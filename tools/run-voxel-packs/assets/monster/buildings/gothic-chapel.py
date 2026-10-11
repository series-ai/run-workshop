"""Gothic graveyard chapel, in the Pirate Nation haunted style.

After the PN haunted town hall: a grey stone nave under a very steep
purple slate roof, a front gable with a giant magenta rose window over a
deep pointed portal (the oversized function prop, rules F4 and F6),
sloped buttresses with pinnacles (true slopes, F2), tall violet lancets,
an octagonal apse with a slate cone, and a slim belfry tower with an
octagonal spire and a horned cross off to one side (F5). A small
graveyard with tombstones, an iron railing and pumpkins sits beside it.
Masonry, slate and glass are painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import coords, course, iron_fence, opening, piers, plinth, pointed, roof_paint, slate, stone
from _pn import cross, lancet, pumpkin, rose, spire_cap, tombstone
from pnkit import box, face_prism, gable_roof
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, H, D = 112, 151, 140
X0, X1, Z0, Z1 = 30, 78, 34, 110  # nave walls
CX = (X0 + X1) / 2
WALL, RIDGE = 58, 104
TX0, TX1, TZ0, TZ1 = 80, 98, 94, 112  # belfry tower (back right)
TTOP = 100
AZ = 112  # apse centre z


def buttress(g: Grid, face: str, u: float, plane: float, h: int = 40, depth: int = 10, seed: int = 0) -> np.ndarray:
    """A sloped buttress (a true slope) with a small pinnacle on top."""
    s = -1 if face[0] == "-" else 1
    if face[1] == "x":
        g.prism("z", [(plane, 5), (plane + s * depth, 5), (plane + s * depth, 18), (plane + s * 3, h), (plane, h)], u - 2.5, u + 2.5, C("gray", 6))
    else:
        g.prism("x", [(5, plane), (5, plane + s * depth), (18, plane + s * depth), (h, plane + s * 3), (h, plane)], u - 2.5, u + 2.5, C("gray", 6))
    m = S.last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(5, 4), frame=fr, seed=seed))
    return m


def chapel() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    plinth(g, X0, Z0, X1, Z1 + 4, h=5, out=4, seed=1)
    stone(g, X0, 5, Z0, X1, WALL, Z1, "gray", 5, seed=2)
    piers(g, X0, X1, Z0, Z1, 5, WALL, size=6, seed=3)
    course(g, X0, Z0, X1, Z1, WALL - 3, WALL, seed=4)
    roof = gable_roof(g, X0 - 1, X1 + 1, Z0, Z1, WALL, RIDGE, ramp="purple", thick=5, overhang=6, trim="gray", gable="gray", ridge="z", trim_shade=6, seed=5)
    roof_paint(g, roof, "z", 6)
    # side buttresses and tall lancets between them
    for k, z in enumerate((Z0 + 18, Z0 + 38, Z0 + 58)):
        buttress(g, "-x", z, X0, seed=7)
        buttress(g, "+x", z, X1, seed=8)
    glass = [("purple", 3), ("magenta", 5), ("purple", 3), ("toxic", 5)]
    for k, z in enumerate((Z0 + 5, Z0 + 25, Z0 + 45, Z0 + 63)):
        lancet(g, "-x", X0, z, z + 9, 16, 48, glass=glass[k][0], shade=glass[k][1], seed=9 + k)
        lancet(g, "+x", X1, z, z + 9, 16, 48, glass=glass[3 - k][0], shade=glass[3 - k][1], seed=13 + k)
    # front: corner buttresses with pinnacles, the rose window, the portal
    for x in (X0 - 4, X1 - 2):
        buttress(g, "-z", x + 3, Z0, h=46, depth=12, seed=17)
        pm = stone(g, x, 5, Z0 - 4, x + 6, WALL + 16, Z0 + 2, "gray", 6, block=(3, 6), seed=18)
        spire_cap(g, x + 3, Z0 - 1, WALL + 16, 3, 12, ramp="purple", base=4, overhang=1)
    rose(g, "-z", Z0, CX, 79, 12, glass="magenta", shade=6)
    for k, (w0, top) in enumerate(((13, 50), (10, 44))):
        fr = face_prism(g, "-z", Z0, pointed(CX - w0 - 3, CX + w0 + 3, 5, top), 2 * k, 2 + k, C("gray", 6 - k))
        P.stone(g, fr, "gray", 6 - k, block=(4, 3), seed=19 + k)
    opening(g, "-z", Z0 - 3, pointed(CX - 10, CX + 10, 5, 40), glow=("magenta", 6), deep=("purple", 3))
    for a, b in ((CX - 9, CX - 0.5), (CX + 0.5, CX + 9)):
        leaf = box(g, a, 5, Z0 - 5, b, 30, Z0 - 4, "purple", 3)
        P.planks(g, leaf, "purple", 3, width=3, across="x", length=(40, 41), nails=True, seed=21)
        P.outline(g, leaf, "purple", 2, normal="z")
    box(g, CX - 3, 16, Z0 - 6, CX - 1, 19, Z0 - 5, "gold", 5)
    box(g, CX + 1, 16, Z0 - 6, CX + 3, 19, Z0 - 5, "gold", 5)
    stp = box(g, CX - 16, 0, Z0 - 14, CX + 16, 3, Z0 - 2, "stone", 5) | box(g, CX - 14, 3, Z0 - 8, CX + 14, 5, Z0 - 2, "stone", 5)
    P.stone(g, stp, "stone", 5, block=(6, 3), seed=22)
    cross(g, CX, RIDGE + 8, Z0 - 5, h=20, arm=7)
    # the octagonal apse with a slate cone
    start = len(g.solids)
    S.disc(g, "y", CX, AZ, 18, 5, WALL - 6, "gray", 5)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(8, 4), frame=fr, seed=23))
    am = S.last(g)
    P.stone(g, am & S.seams(g, g.solids[start:], 2.2), "gray", 7, block=(4, 5), seed=24)
    start = len(g.solids)
    S.cone(g, "y", CX, AZ, 21, WALL - 6, WALL + 22, "purple", 4)
    slate(g, g.solids[start:], seed=25, row=4, width=4)
    from _bld import facet_window
    for k, (m, fr) in enumerate(S.facets(g, [g.solids[start - 1]])):
        if fr != "top" and fr[0][2] > -0.9:
            facet_window(g, m, fr, 18, 40, 6, glass=("magenta", 5) if k % 2 else ("purple", 3))
    # the belfry tower: stone shaft, open belfry, octagonal spire, cross
    stone(g, TX0, 5, TZ0, TX1, TTOP - 22, TZ1, "gray", 5, seed=26)
    piers(g, TX0, TX1, TZ0, TZ1, 5, TTOP - 22, size=5, seed=27)
    course(g, TX0, TZ0, TX1, TZ1, TTOP - 24, TTOP - 20, seed=28)
    tcx, tcz = (TX0 + TX1) / 2, (TZ0 + TZ1) / 2
    for x in (TX0, TX1 - 5):
        for z in (TZ0, TZ1 - 5):
            stone(g, x, TTOP - 20, z, x + 5, TTOP, z + 5, "gray", 6, block=(3, 5), seed=29)
    P.flat(g, (g.a > 0) & (Y > TTOP - 21) & (Y < TTOP - 19) & (np.abs(X - tcx) < 5) & (np.abs(Z - tcz) < 5), "purple", 3)
    stone(g, TX0 - 2, TTOP, TZ0 - 2, TX1 + 2, TTOP + 4, TZ1 + 2, "gray", 6, block=(8, 4), seed=30)
    start = len(g.solids)
    S.cone(g, "y", tcx, tcz, 11, TTOP + 4, TTOP + 36, "purple", 4)
    slate(g, g.solids[start:], seed=31, row=4, width=3)
    cross(g, tcx, TTOP + 34, tcz, h=14, arm=4, horns=False)
    lancet(g, "-z", TZ0, tcx - 4, tcx + 4, 40, 64, glass="toxic", shade=5, seed=32)
    lancet(g, "+x", TX1, tcz - 4, tcz + 4, 40, 64, glass="purple", shade=3, seed=33)
    # a little graveyard on the left: railing, tombstones, pumpkins (K1)
    iron_fence(g, "z", Z0 - 10, Z0 + 40, 4, 0, h=12, gap=5)
    for k, (x, z, w, h, lean) in enumerate(((16, 20, 9, 14, -7), (16, 40, 8, 11, 5), (18, 60, 10, 16, -4), (17, 80, 8, 12, 9))):
        tombstone(g, x, z, w=w, h=h, lean=lean, glyph="cross" if k % 2 == 0 else "", seed=34 + k)
    pumpkin(g, 13, 0, 100, w=12, h=9, seed=38)
    pumpkin(g, CX + 26, 0, Z0 - 12, w=12, h=9, seed=39)
    pumpkin(g, CX + 36, 0, Z0 - 6, w=9, h=7, seed=40)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=41)
    return g


def bell_part() -> Grid:
    """The gold bell on an iron hanger rod; the pivot is the rod top, under the belfry roof."""
    g = Grid(12, 16, 12)
    _X, Y, _Z = coords(g)
    bell = S.cone(g, "y", 6, 6, 5, 0, 10, "gold", 4, r_top=3)
    P.flat(g, bell & (Y < 2), "gold", 3)
    box(g, 5, 10, 5, 7, 16, 7, "iron", 3)
    return g


def build() -> Asset:
    root = Part("gothic-chapel", chapel(), pivot=(0.0, 0.0, 0.0))
    root.add(Part("bell", bell_part(), pivot=(6.0, 16.0, 6.0), at=((TX0 + TX1) / 2, float(TTOP), (TZ0 + TZ1) / 2)))
    # the bell tolls: it swings side to side under the belfry roof
    return Asset(id="monster-buildings-gothic-chapel", pack="monster", category="buildings", name="Gothic Chapel", root=root,
                 clips=[Clip("idle", {"bell": {"rot": sway(3.6, amp=(0.0, 0.0, 7.0))}})])
