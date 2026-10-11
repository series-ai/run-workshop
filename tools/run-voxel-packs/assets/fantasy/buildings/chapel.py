"""Village chapel in the Pirate Nation style.

A cream plaster nave on a sandstone base under a steep red tile roof
(true slopes), sloped buttresses between tall blue lancet windows, a round
apse with a cone roof at the back, and a square sandstone bell tower at
the front. The oversized function prop is the big gold bell that hangs in
the open timber belfry, under a steep red spire with gold hips and a gold
cross. A royal-blue rose window over the arched door, two leaning
headstones and a round bush in the yard. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _bld import arch_door, bell, cone_roof, drum, idx, pyramid_roof, sandstone, sandstone_painter
from pnkit import box, gable_roof, lancet, rose
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, H, D = 100, 150, 128
NX0, NX1, NZ0, NZ1 = 24, 76, 42, 104  # nave walls
WALL, RIDGE = 48, 92
CX = 50
TX0, TX1, TZ0, TZ1 = 36, 64, 20, 46  # bell tower
TT, BELFRY = 70, 98
SPIRE = 40


def chapel() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    # nave: plinth, sandstone base course, cream plaster, stone quoins
    plinth = box(g, NX0 - 3, 0, NZ0 - 3, NX1 + 3, 4, NZ1 + 3, "sand", 3)
    sandstone(g, plinth, 3, block=(9, 4), honey=0.0, seed=1)
    walls = box(g, NX0, 4, NZ0, NX1, WALL, NZ1, "sand", 6)
    P.mottle(g, walls, "sand", 6, seed=2)
    low = walls & (Y < 14)
    sandstone(g, low, 4, block=(8, 5), seed=3)
    quoin = walls & (((X < NX0 + 3) | (X >= NX1 - 3)) & ((Z < NZ0 + 3) | (Z >= NZ1 - 3)))
    sandstone(g, quoin, 5, block=(3, 5), honey=0.3, seed=4)
    band = box(g, NX0 - 1, WALL - 3, NZ0 - 1, NX1 + 1, WALL, NZ1 + 1, "darkwood", 3)
    P.planks(g, band, "darkwood", 3, width=3, across="y", seed=5)
    roof = gable_roof(g, NX0, NX1, NZ0, NZ1, WALL, RIDGE, ramp="red", thick=5, overhang=5, ridge="z", seed=6)
    P.mottle(g, roof["attic"], "sand", 6, seed=7)
    # apse at the back: a half octagon drum with a cone roof
    drum(g, CX, NZ1, 4, WALL - 8, 18, "sand", 6, painter=lambda gg, mm, fr: P.mottle(gg, mm, "sand", 6, seed=8))
    drum(g, CX, NZ1, 0, 4, 21, "sand", 3, painter=sandstone_painter(3, (9, 4), 0.0, seed=9))
    drum(g, CX, NZ1, WALL - 11, WALL - 8, 19, "darkwood", 3, painter=lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 3, width=3, across="y", frame=fr))
    cone_roof(g, CX, NZ1, WALL - 8, 22, 26, "red", 4, trim=("darkwood", 3), eave=("red", 2), seed=10)
    lancet(g, "+z", NZ1 + 18, CX - 3, CX + 3, 14, 32, glass="blue", shade=5, frame="stone", fshade=6, seed=11)
    # sloped buttresses between tall blue lancets on both long sides
    for z in (NZ0 + 14, NZ0 + 36, NZ0 + 58):
        for x0, x1, s in ((NX0 - 8, NX0, -1), (NX1, NX1 + 8, 1)):
            xa, xb = (NX0, NX0 - 8) if s < 0 else (NX1, NX1 + 8)
            g.prism("z", [(xa, 0), (xb, 0), (xb, 10), (xa, WALL - 6)], z, z + 5, C("sand", 4))
            for m, fr in S.facets(g):
                sandstone(g, m, 4, block=(5, 4), honey=0.1, frame=fr, seed=z + s)
    for z in (NZ0 + 22, NZ0 + 44):
        lancet(g, "-x", NX0, z, z + 9, 14, 40, glass="blue", shade=5, frame="stone", fshade=6, seed=z)
        lancet(g, "+x", NX1, z, z + 9, 14, 40, glass="blue", shade=5, frame="stone", fshade=6, seed=z + 1)
    # the bell tower
    tp = box(g, TX0 - 3, 0, TZ0 - 3, TX1 + 3, 4, TZ1 + 3, "sand", 3)
    sandstone(g, tp, 3, block=(9, 4), honey=0.0, seed=12)
    body = box(g, TX0, 4, TZ0, TX1, TT, TZ1, "sand", 4)
    sandstone(g, body, 4, block=(8, 5), seed=13)
    tq = body & (((X < TX0 + 3) | (X >= TX1 - 3)) & ((Z < TZ0 + 3) | (Z >= TZ1 - 3)))
    sandstone(g, tq, 5, block=(3, 5), honey=0.3, seed=14)
    ledge = box(g, TX0 - 2, TT, TZ0 - 2, TX1 + 2, TT + 3, TZ1 + 2, "stone", 6)
    P.stone(g, ledge, "stone", 6, block=(8, 3), seed=15)
    arch_door(g, "-z", TZ0, CX - 9, CX + 9, 4, 34, seed=16)
    steps = box(g, CX - 13, 0, TZ0 - 12, CX + 13, 2, TZ0 - 3, "sand", 3) | box(g, CX - 11, 2, TZ0 - 8, CX + 11, 4, TZ0 - 3, "sand", 3)
    P.stone(g, steps, "sand", 3, block=(7, 3), frame="top", seed=17)
    rose(g, "-z", TZ0, CX, 50, 7, glass="blue", shade=5, frame="stone", fshade=6)
    for face, plane in (("-x", TX0), ("+x", TX1)):
        lancet(g, face, plane, (TZ0 + TZ1) / 2 - 3, (TZ0 + TZ1) / 2 + 3, 42, 60, glass="blue", shade=5, frame="stone", fshade=6, seed=18)
    # open timber belfry with the giant gold bell (the function prop)
    posts = np.zeros(g.shape, dtype=bool)
    for px, pz in ((TX0, TZ0), (TX1 - 5, TZ0), (TX0, TZ1 - 5), (TX1 - 5, TZ1 - 5)):
        posts |= box(g, px, TT + 3, pz, px + 5, BELFRY, pz + 5, "darkwood", 4)
    P.planks(g, posts, "darkwood", 4, width=5, across="x", nails=False, seed=19)
    for pz in (TZ0, TZ1 - 3):
        rail = box(g, TX0, TT + 3, pz, TX1, TT + 5, pz + 3, "wood", 5)
        P.planks(g, rail, "wood", 5, width=2, across="y", seed=20)
    beam = box(g, TX0 - 1, BELFRY - 4, TZ0 - 1, TX1 + 1, BELFRY, TZ1 + 1, "darkwood", 3)
    P.planks(g, beam, "darkwood", 3, width=4, across="y", seed=21)
    tcz = (TZ0 + TZ1) // 2
    # the headstock runs front to back, so the bell (a part, see bell_part) swings clear of the rails
    box(g, CX - 1, BELFRY - 6, TZ0 + 5, CX + 1, BELFRY - 4, TZ1 - 5, "darkwood", 2)
    pyramid_roof(g, TX0 - 3, TZ0 - 3, TX1 + 3, TZ1 + 3, BELFRY, SPIRE, "red", 4, lean=(1.5, -0.5), trim=("gold", 4), eave=("red", 2), seed=22)
    cross = box(g, CX + 1, BELFRY + SPIRE - 3, tcz - 1, CX + 2, BELFRY + SPIRE + 10, tcz + 1, "gold", 5)
    cross |= box(g, CX - 2, BELFRY + SPIRE + 4, tcz - 1, CX + 6, BELFRY + SPIRE + 6, tcz + 1, "gold", 5)
    P.outline(g, cross, "gold", 3, normal="z")
    # the yard: two leaning headstones and a round bush
    S.tombstone(g, NX1 + 12, NZ0 + 8, w=10, h=15, lean=-7, ramp="stone", base=5, seed=23)
    S.tombstone(g, NX1 + 14, NZ0 + 26, w=9, h=12, lean=5, ramp="stone", base=5, glyph=None, seed=24)
    S.dome(g, NX0 - 12, TZ0 + 4, 0, 8, h=10, n=8, rings=2, ramp="leaf", base=4, ribs=None,
           painter=lambda gg, mm, fr: P.mottle(gg, mm, "leaf", 4, cell=2, seed=25))
    P.grime(g, (g.a > 0) & (Y < 12) & ~g.solid_mask(), height=4, seed=26)
    return g


BELL = 12  # the bell grid's centre on x and z


def bell_part() -> Grid:
    """The giant gold bell, hung from the top centre of its own grid."""
    g = Grid(2 * BELL, 20, 2 * BELL)
    bell(g, BELL, BELL, 19, h=19, r=9.5)
    return g


def build() -> Asset:
    root = Part("chapel", chapel())
    tcz = (TZ0 + TZ1) // 2
    root.add(Part("bell", bell_part(), pivot=(float(BELL), 19.0, float(BELL)), at=(float(CX), float(BELFRY - 6), float(tcz))))
    # the bell swings side to side on its headstock
    return Asset(id="fantasy-buildings-chapel", pack="fantasy", category="buildings", name="Chapel", root=root,
                 clips=[Clip("idle", {"bell": {"rot": sway(3.0, amp=(0.0, 0.0, 6.0))}})])
