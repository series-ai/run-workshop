"""Castle wall in the Pirate Nation style.

A curtain wall section of chunky volumes: a battered stone foot (true
slopes), a warm sandstone wall with a projecting walk ledge and big
merlons, two sloped buttresses, a round corner turret with a royal-blue
cone roof and a postern door, a royal banner with a gold crown between the
buttresses, two torches, and a sloped stair (a true slope with painted
treads) up the back to the planked wall walk. Crates and a barrel sit at
the foot. Faces -Z.
"""
import numpy as np

import paint as P
from _bld import arch_door, arch_window, cone_roof, drum, idx, merlons, round_window, sandstone, sandstone_painter, shield, slit
import pnshapes as S
from pnkit import barrel, box, crate, face_prism
from pnshapes import flame
from voxgrid import C, Asset, Grid, Part

W, H, D = 132, 118, 58
X0, X1 = 4, 104  # wall run
Z0, Z1 = 20, 36  # wall front and back
WALK = 58  # wall-walk level
TX, TZ, TR = 106, 28, 15  # turret
TTOP = 74


def wall() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = idx(g)
    # battered foot: a true slope on both sides
    g.prism("x", [(0, Z0 - 7), (0, Z1 + 5), (10, Z1), (10, Z0)], X0 - 2, X1, C("sand", 3))
    foot = g.solids[-1].mask(g.shape)
    for m, fr in S.facets(g):
        sandstone(g, m, 3, block=(9, 4), honey=0.0, frame=fr, seed=1)
    body = box(g, X0, 10, Z0, X1, WALK - 4, Z1, "sand", 4)
    sandstone(g, body, 4, block=(10, 5), seed=2)
    ledge = box(g, X0 - 1, WALK - 4, Z0 - 3, X1, WALK, Z1 + 1, "stone", 5)
    sandstone(g, ledge, 5, block=(12, 4), honey=0.0, seed=3)
    corb = np.zeros(g.shape, dtype=bool)
    for x in range(X0 + 2, X1 - 2, 8):  # corbels under the ledge
        g.prism("x", [(WALK - 4, Z0 - 3), (WALK - 4, Z0), (WALK - 10, Z0)], x, x + 4, C("stone", 4))
        corb |= g.solids[-1].mask(g.shape)
    P.flat(g, corb, "sand", 3)
    walk = box(g, X0, WALK, Z0, X1, WALK + 3, Z1 - 3, "wood", 5)
    P.planks(g, walk, "wood", 5, width=3, across="x", length=(20, 30), seed=4)
    parapet = box(g, X0 - 1, WALK, Z0 - 3, X1, WALK + 5, Z0, "sand", 5) | box(g, X0, WALK, Z1 - 3, X1, WALK + 5, Z1 + 1, "sand", 5)
    sandstone(g, parapet, 4, block=(8, 5), seed=5)
    mer = merlons(g, "x", X0 - 1, X1 - 2, Z0 - 3, Z0 + 1, WALK + 5, 10, w=9, gap=6, ramp="sand", base=5, seed=6)
    sandstone(g, mer & (Y < WALK + 14), 4, block=(5, 4), seed=6)
    # sloped buttresses on the front (true slopes)
    for bx in (26, 70):
        g.prism("x", [(0, Z0 - 12), (0, Z0), (44, Z0), (10, Z0 - 12)], bx, bx + 9, C("sand", 3))
        bm = g.solids[-1].mask(g.shape)
        for m, fr in S.facets(g):
            sandstone(g, m, 3, block=(5, 4), honey=0.1, frame=fr, seed=bx)
    # a royal banner between the buttresses, torches beside it
    cu = 48 + 1
    pts = [(cu - 9, 50), (cu + 9, 50), (cu + 9, 20), (cu, 25), (cu - 9, 20)]
    ban = face_prism(g, "-z", Z0, pts, 0, 1, C("blue", 4))
    P.mottle(g, ban, "blue", 4, cell=3, seed=7)
    P.outline(g, ban, "gold", 5, normal="z")
    box(g, cu - 11, 49, Z0 - 3, cu + 11, 51, Z0, "darkwood", 3)
    shield(g, "-z", Z0 - 1, cu, 29, w=12, h=15, field=("red", 4), charge="crown", depth=1)
    for cu2 in (15, 91):  # red pennons on the outer spans
        pts = [(cu2 - 6, 53), (cu2 + 6, 53), (cu2 + 6, 30), (cu2, 34), (cu2 - 6, 30)]
        rb = face_prism(g, "-z", Z0, pts, 0, 1, C("red", 4))
        P.mottle(g, rb, "red", 4, cell=3, seed=cu2)
        P.outline(g, rb, "gold", 5, normal="z")
        P.flat(g, rb & (np.abs(X + 0.5 - cu2) < 1.1) & (Y > 36) & (Y < 50), "gold", 6)
        P.flat(g, rb & (np.abs(Y - 44) < 1.1) & (np.abs(X + 0.5 - cu2) < 4), "gold", 6)
    for tx in (28, 76):
        box(g, tx - 1, 30, Z0 - 4, tx + 1, 33, Z0, "darkwood", 3)
        cup = box(g, tx - 2, 33, Z0 - 6, tx + 2, 36, Z0 - 2, "iron", 4)
        fl = box(g, tx - 2, 36, Z0 - 6, tx + 2, 43, Z0 - 2, "orange", 5)
        flame(g, fl, tx, Z0 - 4, 36, 7, 4.5)
    for sx in (18, 60, 84):
        slit(g, "-z", Z0, sx, 36, 46)
    # stair up the back: one true slope with painted treads and a side wall
    g.prism("z", [(10, 0), (54, 0), (54, WALK)], Z1, Z1 + 11, C("wood", 5))
    st = g.solids[-1].mask(g.shape)
    P.flat(g, st, "wood", 5)
    P.flat(g, st & (X % 4 == 0), "darkwood", 4)
    P.flat(g, st & (X % 4 == 1), "wood", 6)
    side = st & (Z == Z1 + 10)
    P.planks(g, side, "darkwood", 5, width=3, across="y", length=(14, 20), seed=9)
    # corner turret with a cone roof and a postern door
    drum(g, TX, TZ, 0, 10, TR + 4, "sand", 3, r_top=TR + 1, painter=sandstone_painter(3, (9, 4), 0.0, seed=10))
    drum(g, TX, TZ, 10, TTOP - 8, TR, "sand", 4, painter=sandstone_painter(seed=11))
    # a timber hoarding on dark brackets under the roof, like the castle tower
    boards = lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="x", length=(40, 41), nails=True, frame=fr, seed=12)  # noqa: E731
    brackets = lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=3, across="x", length=(40, 41), nails=False, frame=fr, seed=12)  # noqa: E731
    drum(g, TX, TZ, TTOP - 8, TTOP - 4, TR, "darkwood", 4, r_top=TR + 3, painter=brackets)
    hoard = drum(g, TX, TZ, TTOP - 4, TTOP + 6, TR + 3, "wood", 5, painter=boards)
    P.flat(g, hoard & (S.seams(g, [g.solids[-1]], 1.6) | (Y < TTOP - 2) | (Y >= TTOP + 4)), "darkwood", 3)
    cone_roof(g, TX, TZ, TTOP + 6, TR + 7, 32, "blue", 4, lean=(1.0, 0.5), seed=14)
    for face, plane, cu3 in (("-z", TZ - TR - 3, TX), ("+x", TX + TR + 3, TZ)):
        round_window(g, face, plane, cu3, TTOP + 1, 3, glass=("gold", 6), frame=("darkwood", 3))
    arch_door(g, "-z", TZ - TR, TX - 7, TX + 7, 10, 34, seed=15)
    arch_window(g, "-z", TZ - TR, TX - 3, TX + 3, 44, 56)
    arch_window(g, "+x", TX + TR, TZ - 3, TZ + 3, 36, 48)
    step = box(g, TX - 9, 0, TZ - TR - 8, TX + 9, 4, TZ - TR - 2, "stone", 5) | box(g, TX - 8, 4, TZ - TR - 5, TX + 8, 10, TZ - TR - 2, "stone", 5)
    P.stone(g, step, "stone", 5, block=(6, 3), seed=16)
    # supplies at the foot (K1)
    crate(g, 4, 0, Z0 - 16, 11, seed=17)
    crate(g, 6, 11, Z0 - 14, 8, seed=18)
    barrel(g, 60, Z0 - 8, 0, 14, 5.5)
    P.grime(g, (g.a > 0) & (Y < 14) & ~g.solid_mask(), height=4, seed=19)
    return g


def build() -> Asset:
    return Asset(id="fantasy-buildings-castle-wall", pack="fantasy", category="buildings", name="Castle Wall", root=Part("castle-wall", wall()))
