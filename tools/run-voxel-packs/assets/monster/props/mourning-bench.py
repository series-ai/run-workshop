"""Mourning bench, in the Pirate Nation haunted style.

A graveyard bench: two carved grey stone end pieces with a pierced cross
and a scrolled armrest (true slopes), four thick wood slats for the seat
and three for the back, gold bolt heads at every joint, moss along the
feet and a wilted violet bouquet tied with a blood-red ribbon lying on
the seat. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _props import flowers, idx, masonry, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 38, 24, 16
SEAT = 9
ENDS = (2, 31)  # the x of each stone end piece


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    for ex in ENDS:
        # a chamfered foot, a pierced upright and a scrolled arm
        start = len(g.solids)
        g.prism("y", [(ex - 1, 1), (ex + 6, 1), (ex + 6, 15), (ex - 1, 15)], 0, 2, C("gray", 5),
                top=[(ex, 2), (ex + 5, 2), (ex + 5, 14), (ex, 14)])
        foot = union(g, start)
        S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(5, 3), frame=fr, seed=1))
        up = box(g, ex, 2, 2, ex + 5, SEAT + 12, 14, "gray", 5)
        masonry(g, up, "gray", 5, block=(6, 4), seed=2)
        P.flat(g, up & (Y > SEAT + 9), "gray", 6)
        # a cross carved into both faces of the upright
        cross = (((np.abs(Z + 0.5 - 8) < 1.6) & (np.abs(Y + 0.5 - (SEAT + 6)) < 4.6)) |
                 ((np.abs(Z + 0.5 - 8) < 3.8) & (np.abs(Y + 0.5 - (SEAT + 7)) < 1.6)))
        P.flat(g, up & cross & ((X == ex) | (X == ex + 4)), "gray", 2)
        P.flat(g, up & cross & ((X == ex) | (X == ex + 4)) & (np.abs(Z + 0.5 - 8) < 0.7), "purple", 4)
        P.flat(g, up & (Y > SEAT + 10) & ((X == ex) | (X == ex + 4)), "gray", 7)
        # the scrolled armrest: a true sloped cap
        g.prism("x", [(SEAT + 12, 2), (SEAT + 12, 14), (SEAT + 15, 12), (SEAT + 15, 4)], ex, ex + 5, C("gray", 6))
        scroll = S.last(g)
        P.stone(g, scroll, "gray", 6, block=(4, 3), seed=3)
        P.flat(g, scroll & (Y == SEAT + 14), "gray", 7)

    # ---- the seat slats and the back slats
    for k, z0 in enumerate((2, 6, 10)):
        sl = box(g, 1, SEAT, z0, 37, SEAT + 2, z0 + 3, "wood", 5)
        planked(g, sl, "wood", 5, width=4, across="x", nails=True, seed=4 + k)
        P.flat(g, sl & (Y == SEAT + 1), "wood", 6)
        for bx in (4, 33):
            P.flat(g, sl & (Y == SEAT + 1) & (np.abs(X + 0.5 - bx) < 1.0), "gold", 5)
    for k, y0 in enumerate((SEAT + 4, SEAT + 8)):
        bk = box(g, 1, y0, 11, 37, y0 + 3, 14, "wood", 5)
        planked(g, bk, "wood", 5, width=4, across="x", nails=True, seed=7 + k)
        P.flat(g, bk & (Z == 11), "wood", 6)
        P.flat(g, edges(bk), "wood", 3)
        for bx in (4, 33):
            P.flat(g, bk & (Z == 11) & (np.abs(X + 0.5 - bx) < 1.0), "gold", 5)

    # ---- a wilted bouquet tied with a blood-red ribbon on the seat
    stems = box(g, 16, SEAT + 2, 3, 28, SEAT + 4, 7, "moss", 4)
    P.flat(g, stems & (((X) % 3) == 0), "moss", 6)
    P.flat(g, stems & (Y == SEAT + 3), "moss", 5)
    tie = box(g, 23, SEAT + 2, 3, 26, SEAT + 5, 7, "blood", 5)
    P.flat(g, tie & (Y == SEAT + 4), "blood", 6)
    P.flat(g, edges(tie), "blood", 3)
    for fx, fz, ramp, sh in ((13, 3, "magenta", 5), (15, 6, "purple", 5), (12, 6, "bone", 7), (16, 2, "magenta", 6), (10, 4, "purple", 4)):
        head = box(g, fx - 2, SEAT + 2, fz - 1, fx + 2, SEAT + 6, fz + 3, ramp, sh)
        P.flat(g, head & (Y == SEAT + 5), ramp, min(7, sh + 1))
        P.flat(g, edges(head), ramp, max(1, sh - 2))

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=2, chance=0.2, seed=11)

    return prop("mourning-bench", "Mourning Bench", g)
