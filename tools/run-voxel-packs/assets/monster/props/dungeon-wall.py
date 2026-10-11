"""Dungeon wall, in the Pirate Nation haunted style (kit piece).

Two PN tiles long, one tall storey: big grey stone blocks between a purple
slate plinth course and cap course (1 proud on both faces, flush at the
ends, so pieces line up: the shared profile of the monster dungeon kit).
The front has a pointed barred window glowing magenta in a light stone
frame, a burning wall torch, a hanging chain with a manacle, moss at the
foot and damp streaks. The back is plain masonry with a second torch.
Faces -Z.
"""
import numpy as np

import paint as P
from _props import KIT_H, KIT_T, chain, damp, dungeon_run, idx, prop, shackle, torch
from pnkit import box, lancet
from voxgrid import C, Grid

L = 32
Z0 = 6  # wall core front


def build():
    g = Grid(L, KIT_H + 2, KIT_T + 12)
    X, Y, Z = idx(g)
    w = dungeon_run(g, "x", 0, L, Z0, seed=1)
    pane = lancet(g, "-z", Z0, 11, 21, 18, 38, glass="magenta", shade=4, frame="gray", fshade=6, seed=2)
    P.flat(g, pane & ((X == 13) | (X == 18)), "iron", 6)
    P.flat(g, pane & (Y == 30), "iron", 6)
    torch(g, "-z", Z0, 5, 26)
    torch(g, "+z", Z0 + KIT_T, 26, 26)
    box(g, 26, 34, Z0 - 1, 28, 36, Z0, "iron", 6)
    chain(g, 27, Z0 - 1, 34, 4, "iron", 6)
    shackle(g, 27, 24, Z0 - 1, "iron", 6, face="z")
    damp(g, w["core"] | w["plinth"], seed=3)
    return prop("dungeon-wall", "Dungeon Wall", g)
