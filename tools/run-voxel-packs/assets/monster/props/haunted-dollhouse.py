"""Haunted dollhouse, in the Pirate Nation haunted style.

A model manor on four turned legs (rule K3): a grey stone base, a plaster
body with dark timber framing, a steep violet shingled gable roof with a
leaning chimney, toxic-green glowing windows with gold frames, a tiny
gold-arched door, and a crooked weathervane. One wall panel has fallen
away and shows a lit room inside. Faces -Z.

Size: 30 high with the weathervane, so the toy house stands below the
shoulder of a 36-voxel person.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import pfx, single
from _props import idx, planked, plinth, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 28, 32, 24
X0, X1, Z0, Z1 = 4, 24, 5, 19
LEG, BASE, EAVE = 3, 6, 19
RIDGE = EAVE + 7  # the roof ridge; the weathervane stands on it


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- four turned legs and the stone base slab
    for lx, lz in ((X0 + 1, Z0 + 1), (X1 - 4, Z0 + 1), (X0 + 1, Z1 - 4), (X1 - 4, Z1 - 4)):
        leg = box(g, lx, 0, lz, lx + 3, LEG, lz + 3, "wood", 4)
        P.planks(g, leg, "wood", 4, width=3, across="y", nails=False, seed=lx + lz)
        P.flat(g, edges(leg), "wood", 2)
        P.flat(g, leg & (Y == 1), "gold", 4)
    plinth(g, X0, Z0, X1, Z1, LEG, 3, "gray", 5, bevel=1.2, seed=1)

    # ---- the plaster body with dark timber framing
    body = box(g, X0 + 1, BASE, Z0 + 1, X1 - 1, EAVE, Z1 - 1, "bone", 6)
    P.stone(g, body, "bone", 6, block=(9, 7), cracks=0.0, seed=2)
    frame = body & (((X - X0 - 1) % 6 < 2) | (Y == BASE + 6) | (Y < BASE + 1) | (Y > EAVE - 2))
    P.flat(g, frame, "darkwood", 7)
    P.flat(g, edges(body), "darkwood", 7)

    # ---- glowing windows and a tiny gold-arched door
    for wx, wy in ((X0 + 3, BASE + 7), (X1 - 9, BASE + 7), (X1 - 9, BASE + 1)):
        win = box(g, wx, wy, Z0 + 1, wx + 5, wy + 5, Z0 + 2, "toxic", 5)
        rim = win & ((X == wx) | (X == wx + 4) | (Y == wy) | (Y == wy + 4))
        P.flat(g, rim, "gold", 4)
        bar = win & ~rim & (np.abs(Y + 0.5 - (wy + 2.5)) < 0.6)
        P.flat(g, bar, "gold", 3)
        P.flat(g, win & ~rim & ~bar & (Y > wy + 2), "toxic", 7)
    # one lit window on the near side wall as well
    sidew = box(g, X0 + 1, BASE + 7, Z0 + 5, X0 + 2, BASE + 11, Z0 + 9, "toxic", 5)
    P.flat(g, sidew & ((Z == Z0 + 5) | (Z == Z0 + 8) | (Y == BASE + 7) | (Y == BASE + 10)), "gold", 4)
    door = box(g, X0 + 4, BASE, Z0 + 1, X0 + 8, BASE + 5, Z0 + 2, "purple", 4)
    g.prism("z", [(X0 + 4, BASE + 5), (X0 + 8, BASE + 5), (X0 + 6, BASE + 7)], Z0 + 1, Z0 + 2, C("purple", 4))
    door |= S.last(g)
    P.flat(g, door & ((X == X0 + 4) | (X == X0 + 7) | (Y == BASE)), "gold", 4)
    P.flat(g, door & (Y > BASE + 4), "gold", 4)
    P.flat(g, door & (np.abs(X + 0.5 - (X0 + 7)) < 0.8) & (np.abs(Y + 0.5 - (BASE + 2.5)) < 0.8), "gold", 6)

    # ---- a fallen wall panel showing a lit room inside
    room = box(g, X1 - 7, BASE + 1, Z1 - 2, X1 - 2, BASE + 6, Z1 - 1, "ember", 3)
    P.flat(g, room & (Y > BASE + 3), "ember", 5)
    P.flat(g, room & ((X == X1 - 7) | (X == X1 - 3) | (Y == BASE + 1) | (Y == BASE + 5)), "darkwood", 7)
    box(g, X1 - 6, BASE + 1, Z1 - 2, X1 - 5, BASE + 4, Z1 - 1, "wood", 5)

    # ---- the steep violet shingled roof, with a true slope
    start = len(g.solids)
    g.prism("z", [(X0 - 1, EAVE), (X1 + 1, EAVE), (int((X0 + X1) / 2) + 1, RIDGE), (int((X0 + X1) / 2) - 1, RIDGE)], Z0 - 1, Z1 + 1, C("purple", 4))
    roof = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=3))
    P.flat(g, roof & (Y > RIDGE - 2), "purple", 6)
    eave = box(g, X0 - 1, EAVE - 1, Z0 - 1, X1 + 1, EAVE + 1, Z1 + 1, "darkwood", 7)
    P.flat(g, edges(eave), "darkwood", 5)

    # ---- a leaning chimney and a crooked weathervane
    S.bar(g, "z", (X1 - 5, EAVE), (X1 - 3, RIDGE), 4.0, Z0 + 3, Z0 + 7, "gray", 5)
    chim = S.last(g)
    P.stone(g, chim, "gray", 5, block=(4, 3), seed=4)
    P.flat(g, chim & (Y > RIDGE - 2), "gray", 3)
    S.bar(g, "z", (int((X0 + X1) / 2), RIDGE), (int((X0 + X1) / 2) + 1, RIDGE + 3.7), 1.6, (Z0 + Z1) // 2 - 1, (Z0 + Z1) // 2 + 1, "iron", 6)
    g.prism("z", [(int((X0 + X1) / 2) - 3, RIDGE + 2), (int((X0 + X1) / 2) + 4, RIDGE + 3), (int((X0 + X1) / 2) - 2, RIDGE + 3.7)], (Z0 + Z1) // 2 - 1, (Z0 + Z1) // 2 + 1, C("gold", 5))
    P.flat(g, S.last(g), "gold", 5)

    return single("haunted-dollhouse", "props", "Haunted Dollhouse", g,
                  sockets=[Socket("socket-window", at=(float(X0 + 6 - W / 2), float(BASE + 9), float(Z0 - D / 2)))],
                  pfx=[pfx("rvx-monster-ghost-wisps", "socket-window", "idle", size=14)])
