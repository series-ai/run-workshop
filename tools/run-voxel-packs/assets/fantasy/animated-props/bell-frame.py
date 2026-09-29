"""Chapel bell in the Pirate Nation style.

An oversized gold bell (rule K3: stacked octagonal frustums, true slopes,
a flared lip, painted rings and a cross) hangs from a dark oak yoke between
two thick timber posts. Raking struts brace the posts to a coursed stone
plinth, knee braces carry the headstock beam and a steep red-tiled gable
roof with planked gable boards and a gold ridge cross covers it. An iron
clapper hangs inside; a striped bell rope drops from the yoke lever to hand
height. About 44 wide and 80 tall (a person is 36).
Clips: idle (the bell barely sways), active (it swings, the clapper lags).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S_
from _life import asset, coords, facet_paint, keys, pfx, plan, rig
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

S = (52, 90, 36)
CX, CZ = 26.0, 18.0
PX = (CX - 16, CX + 16)  # post centres
PLINTH = 5
BEAM = (56, 60)  # headstock beam y
AY = 51.0  # bell axle
EAVE, RIDGE, EZ = 60.0, 73.0, 11.5  # roof
RX = (CX - 20, CX + 20)
T = 3.0
# bell profile: (y, flat radius) from the lip up to the crown
BELL = [(28.0, 11.0), (30.0, 10.4), (36.0, 7.4), (43.0, 6.6), (46.0, 4.8), (47.5, 3.6)]


def frame() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # a coursed stone plinth in two steps
    p0 = box(g, CX - 22, 0, CZ - 11, CX + 22, 3, CZ + 11, "stone", 4)
    p1 = box(g, CX - 20, 3, CZ - 9, CX + 20, PLINTH, CZ + 9, "stone", 5)
    P.stone(g, p0, "stone", 4, block=(6, 3), seed=1)
    P.stone(g, p1, "stone", 5, block=(5, 2), seed=2)
    P.flat(g, edges(p0), "stone", 3)
    P.flat(g, edges(p1) & (Y > PLINTH - 1), "stone", 6)
    P.grime(g, p0, height=2, seed=3)
    for px in PX:
        post = box(g, px - 2, PLINTH, CZ - 2, px + 2, BEAM[0], CZ + 2, "wood", 4)
        P.planks(g, post, "wood", 4, width=2, across="x", nails=False, seed=4)
        P.flat(g, edges(post), "darkwood", 3)
        foot = box(g, px - 3, PLINTH, CZ - 3, px + 3, PLINTH + 3, CZ + 3, "darkwood", 3)
        P.flat(g, edges(foot), "darkwood", 2)
        # raking struts front and back (true slopes)
        for s in (-1, 1):
            st = S_.bar(g, "x", (PLINTH + 0.5, CZ + s * 9.0), (PLINTH + 20.0, CZ + s * 1.5), 2.4, int(px - 1), int(px + 1), "darkwood", 4)
            P.flat(g, st, "darkwood", 4)
            P.flat(g, st & (Y > PLINTH + 17), "darkwood", 3)
        # a knee brace under the beam, toward the middle
        s = 1 if px < CX else -1
        kb = S_.bar(g, "z", (px + s * 1.5, BEAM[0] - 9.0), (px + s * 8.5, BEAM[0] + 0.5), 2.2, int(CZ - 1), int(CZ + 1), "darkwood", 4)
        P.flat(g, kb, "darkwood", 4)
        # an iron bearing on the inner face
        brg = box(g, px - s * 2 - (1 if s > 0 else 0), AY - 2, CZ - 2, px - s * 2 + (1 if s < 0 else 0), AY + 2, CZ + 2, "iron", 4)
        P.flat(g, brg & (np.abs(Y - AY) < 1.1) & (np.abs(Z - CZ) < 1.1), "steel", 5)
    beam = box(g, CX - 21, BEAM[0], CZ - 2.5, CX + 21, BEAM[1], CZ + 2.5, "darkwood", 3)
    P.planks(g, beam, "darkwood", 3, width=4, across="y", seed=5)
    # the roof: two tiled slabs, dark barge ends, a dark lower lip
    for sgn in (-1, 1):
        ze = CZ + sgn * EZ
        g.prism("x", [(EAVE, ze), (EAVE + T, ze), (RIDGE + T, CZ), (RIDGE, CZ)], RX[0], RX[1], C("red", 4))
        slab = g.solids[-1].mask(g.shape)
        P.tiles(g, slab, "red", 4, row=4, width=5, frame=((1, 0, 0), (0.0, EAVE - RIDGE, ze - CZ)), seed=6 + sgn)
        P.flat(g, slab & ((X < RX[0] + 2) | (X > RX[1] - 2)), "darkwood", 3)
        P.flat(g, slab & (Y < EAVE + 1.0), "red", 2)
    cap = box(g, RX[0] - 1, RIDGE + T - 1, CZ - 1.5, RX[1] + 1, RIDGE + T + 1, CZ + 1.5, "darkwood", 4)
    P.planks(g, cap, "darkwood", 4, width=2, across="y", nails=False, seed=8)
    for gx0 in (RX[0] + 2, RX[1] - 4):
        g.prism("x", [(BEAM[1], CZ - EZ + 4.0), (BEAM[1], CZ + EZ - 4.0), (RIDGE + 0.5, CZ)], gx0, gx0 + 2, C("wood", 5))
        gb = g.solids[-1].mask(g.shape)
        P.planks(g, gb, "wood", 5, width=3, across="z", frame="x", length=(30, 31), nails=False, seed=9)
    # a gold cross on the ridge
    ry = int(RIDGE + T + 1)
    cr = box(g, CX - 1, ry - 1, CZ - 1, CX + 1, ry + 13, CZ + 1, "gold", 5)
    cr |= box(g, CX - 4, ry + 7, CZ - 1, CX + 4, ry + 9, CZ + 1, "gold", 5)
    P.flat(g, cr & (Y > ry + 12), "gold", 7)
    P.flat(g, edges(cr), "gold", 4)
    return g


def bell() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    start = len(g.solids)
    m = np.zeros(g.shape, dtype=bool)
    for (y0, r0), (y1, r1) in zip(BELL, BELL[1:]):
        m |= plan(g, S_.flat_ngon(CX, CZ, r0, 8), y0, y1, "gold", 5, top=S_.flat_ngon(CX, CZ, r1, 8))
    solids = g.solids[start:]
    facet_paint(g, solids, lambda gg, mm, fr: P.flat(gg, mm, "gold", 4))
    P.flat(g, m & S_.seams(g, solids, 0.7), "gold", 5)
    lip = m & (Y < BELL[1][0])
    P.flat(g, lip, "gold", 6)
    P.flat(g, m & (Y < BELL[0][0] + 0.8) & (S_.ngon_radius(g, "y", CX, CZ) < 9.0), "gold", 2)  # the dark mouth
    for yb in (32.0, 33.2, 42.0):
        P.flat(g, m & (np.abs(Y - yb) < 0.5), "gold", 6)
    P.flat(g, m & (Y > BELL[-2][0]), "gold", 5)
    pnglyph.icon(g, "-z", CZ - 7.9, int(CX - 3), 35, "cross", "gold", 2)
    # the oak yoke on the crown, the axle stubs and the rope lever
    yoke = box(g, CX - 7, 47, CZ - 3, CX + 7, 53, CZ + 3, "darkwood", 3)
    P.planks(g, yoke, "darkwood", 3, width=3, across="y", seed=10)
    P.flat(g, edges(yoke), "darkwood", 2)
    for x0, x1 in ((CX - 13, CX - 7), (CX + 7, CX + 13)):
        ax = box(g, x0, AY - 1, CZ - 1, x1, AY + 1, CZ + 1, "iron", 5)
        P.flat(g, ax & (Y > AY), "steel", 5)
    lever = box(g, CX + 9, AY - 1, CZ - 9, CX + 11, AY + 1, CZ + 1, "darkwood", 4)
    P.flat(g, lever & (Z < CZ - 8), "iron", 4)
    rope = box(g, CX + 9.5, 12, CZ - 8.5, CX + 10.5, AY - 1, CZ - 7.5, "sand", 5)
    P.flat(g, rope & (np.floor(Y).astype(int) % 2 == 0), "sand", 4)
    sally = box(g, CX + 9, 12, CZ - 9, CX + 11, 20, CZ - 7, "red", 4)
    P.flat(g, sally & (np.floor(Y).astype(int) % 4 < 2), "bone", 6)
    return g


def clapper() -> Grid:
    g = Grid(*S)
    _X, Y, _Z = coords(g)
    rod = box(g, CX - 0.5, 29, CZ - 0.5, CX + 0.5, 46, CZ + 0.5, "iron", 4)
    ball = plan(g, S_.flat_ngon(CX, CZ, 2.2, 8), 25, 30, "iron", 5, top=S_.flat_ngon(CX, CZ, 1.6, 8))
    P.flat(g, ball & (Y > 28), "steel", 5)
    P.flat(g, rod, "iron", 4)
    return g


def build():
    f, b, c = frame(), bell(), clapper()
    root, to_root = rig([("bell-frame", f, None, None), ("bell", b, (CX, AY, CZ), None), ("clapper", c, (CX, 46.0, CZ), "bell")])
    idle = {"bell": {"rot": keys((0, 0, 0, 0), (1.5, 4, 0, 0), (3.0, 0, 0, 0), (4.5, -4, 0, 0), (6.0, 0, 0, 0))},
            "clapper": {"rot": keys((0, 0, 0, 0), (1.5, -2, 0, 0), (3.0, 0, 0, 0), (4.5, 2, 0, 0), (6.0, 0, 0, 0))}}
    swing = keys((0, 0, 0, 0), (0.5, 40, 0, 0), (1.0, 0, 0, 0), (1.5, -40, 0, 0), (2.0, 0, 0, 0))
    lag = keys((0, 0, 0, 0), (0.5, -18, 0, 0), (0.7, 12, 0, 0), (1.0, 0, 0, 0), (1.5, 18, 0, 0), (1.7, -12, 0, 0), (2.0, 0, 0, 0))
    return asset("animated-props", "bell-frame", "Chapel Bell", root,
                 clips=[Clip("idle", idle), Clip("active", {"bell": {"rot": swing}, "clapper": {"rot": lag}})],
                 sockets=[Socket("socket-bell", at=to_root((CX, 38.0, CZ)), parent="bell")],
                 fx=[pfx("rvx-fantasy-bell-toll", "socket-bell", "clip:active", size=40, aim=(0.0, 0.0, 1.0))])
