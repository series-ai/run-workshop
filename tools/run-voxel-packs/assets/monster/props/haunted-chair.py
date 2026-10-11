"""Haunted chair, in the Pirate Nation haunted style.

A tall gothic dining chair: four chunky carved legs with clawed feet, a
deep crimson velvet seat with gold piping, two rear posts that lean back
(rule F5), a velvet back panel framed in gold with gold-buttoned tufting and
a crest rail carrying a carved skull. A cobweb hangs in
one corner. Faces -Z.

Size (class seat): the cushion top is at 10, the crest top at 26 and the
footprint is 20 x 19, so a 36-voxel person can sit on it.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, planked, prop
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 20, 27, 20
FR = ("wood", 4)  # the lacquered frame
VEL = ("blood", 5)
SEAT = 5        # the seat frame starts here; the cushion top is at SEAT + 5
PANEL = (SEAT + 5, 18)  # the back panel, bottom and top
CREST = (18, 24)        # the crest rail, bottom and top


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- four legs with clawed feet
    for lx, lz, h in ((2, 2, SEAT), (15, 2, SEAT), (2, 15, SEAT), (15, 15, SEAT)):
        leg = box(g, lx, 2, lz, lx + 3, h, lz + 3, *FR)
        P.planks(g, leg, FR[0], FR[1], width=3, across="y", nails=False, seed=lx + lz)
        P.flat(g, edges(leg), "wood", 3)
        P.flat(g, leg & (Y == SEAT - 1), "gold", 4)
        claw = box(g, lx - 1, 0, lz - 1, lx + 4, 2, lz + 4, "wood", 2)
        P.flat(g, claw & (Y == 1), "gold", 3)
        for cx, cz in ((lx - 1, lz - 1), (lx + 3, lz - 1), (lx - 1, lz + 3), (lx + 3, lz + 3)):
            P.flat(g, claw & (X == cx) & (Z == cz), "bone", 6)

    # ---- the seat frame and the velvet cushion
    frame = box(g, 1, SEAT, 1, 19, SEAT + 2, 19, *FR)
    planked(g, frame, FR[0], FR[1], width=3, across="x", nails=True, seed=3)
    P.flat(g, edges(frame), "wood", 2)
    cush = box(g, 2, SEAT + 2, 2, 18, SEAT + 5, 18, *VEL)
    P.flat(g, cush & (Y == SEAT + 4), "blood", 6)
    P.flat(g, edges(cush), "gold", 4)
    P.flat(g, cush & (Y == SEAT + 4) & (((X + Z) % 5) == 0) & (((X - Z) % 5) == 0), "blood", 7)

    # ---- two rear posts leaning back, and the back panel between them
    for s, x0 in ((0, 1), (1, 16)):
        S.bar(g, "x", (SEAT, 15.6), (CREST[1] - 1, 17.4), 3.0, x0, x0 + 3, *FR)
        post = S.last(g)
        P.flat(g, post & S.seams(g, g.solids[-1:], 0.9), "wood", 2)
        P.flat(g, post & ((Y == SEAT + 6) | (Y == CREST[0] - 1)), "gold", 4)
    g.prism("x", [(PANEL[0], 15.4), (PANEL[0], 17.4), (PANEL[1] + 1, 18.3), (PANEL[1] + 1, 16.3)], 4, 16, C(*VEL))
    panel = S.last(g)
    P.flat(g, panel & (Y >= PANEL[1] - 1), "blood", 4)
    P.flat(g, panel & (Y < PANEL[0] + 1), "blood", 4)
    P.flat(g, panel & ((X < 5) | (X > 14)), "gold", 4)
    # Diamond tufting: gold buttons sunk in the velvet, joined by dark folds.
    tuft = panel & (X >= 5) & (X <= 14) & (Y > PANEL[0]) & (Y < PANEL[1] - 1)
    P.flat(g, tuft & ((((X + Y) % 6) == 0) | (((X - Y) % 6) == 0)), "blood", 3)
    P.flat(g, tuft & (((X + Y) % 6) == 0) & (((X - Y) % 6) == 0), "gold", 6)

    # ---- the crest rail with a skull carved into it
    crest = box(g, 1, CREST[0], 15, 19, CREST[1], 19, *FR)
    P.planks(g, crest, FR[0], FR[1], width=3, across="x", nails=False, seed=5)
    P.flat(g, edges(crest), "wood", 2)
    g.prism("z", [(1, CREST[1]), (19, CREST[1]), (15, CREST[1] + 2), (5, CREST[1] + 2)], 15, 19, C("wood", 4))
    P.flat(g, S.last(g), "gold", 4)
    pnglyph.icon(g, "-z", 15, 5, CREST[0], "skull", "bone", 6, scale=1, depth=2,
                 inks={".": ("wood", 1)})
    P.flat(g, crest & (Z == 15) & ((X < 5) | (X > 13)) & (Y > CREST[0]) & (Y < CREST[1] - 1), "gold", 4)

    # ---- armrests
    for x0 in (0, 16):
        arm = box(g, x0, SEAT + 5, 3, x0 + 4, SEAT + 8, 17, *FR)
        P.flat(g, edges(arm), "wood", 2)
        P.flat(g, arm & (Y == SEAT + 7), "wood", 5)
        g.prism("x", [(SEAT + 5, 3.0), (SEAT + 8, 3.0), (SEAT + 8, 0.5)], x0 + 1, x0 + 3, C("wood", 4))
        P.flat(g, S.last(g), "gold", 4)

    return prop("haunted-chair", "Haunted Chair", g)
