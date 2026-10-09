"""Skull pile, in the Pirate Nation haunted style.

After the PN skull lamp and big skull: big chunky 3D skulls (chamfered
crowns, large dark sockets with glowing toxic pupils, teeth) heaped in two
rows on a low mound, the top one wearing a rusted gold crown and glowing
magenta eyes. Two melted candles and two big cartoon bones finish the
heap. Faces -Z.
"""
import numpy as np

import paint as P
from _props import big_skull, bone, candle, idx, mound, prop, union
from pnkit import box
from voxgrid import C, Grid


def build():
    g = Grid(36, 40, 30)
    cx, cz = 18, 15
    mound(g, cx, cz, 14, 3, top=0.7, ramp="wood", base=3, moss=0.05, seed=1)
    X, Y, Z = idx(g)
    y = 3
    # back row first, then the front row, then the crowned skull on top
    for k, (sx, sz, s, base) in enumerate(((-6, 6, 9, 5), (6, 6, 9, 5), (-11, -2, 10, 6), (0, -4, 11, 6), (11, -2, 10, 6))):
        big_skull(g, cx + sx, y, cz + sz, s=s, base=base, seed=k)
    ty = y + 11
    big_skull(g, cx + 1, ty, cz + 1, s=11, base=6, eyes=("magenta", 6), seed=9)
    # the rusted crown: a band with four points (true slopes)
    cy = ty + 13
    crown = box(g, cx - 4, cy - 1, cz - 4, cx + 6, cy + 2, cz + 5, "gold", 4)
    start = len(g.solids)
    for px, pz in ((cx - 4, cz - 4), (cx + 3, cz - 4), (cx - 4, cz + 3), (cx + 3, cz + 3)):
        g.prism("y", [(px, pz), (px + 3, pz), (px + 3, pz + 2), (px, pz + 2)], cy + 2, cy + 5, C("gold", 5), top=[(px + 1.5, pz + 1)] * 4)
    crown |= union(g, start)
    P.flat(g, crown & (Y == cy) & (X % 3 == 0), "red", 4)
    P.flat(g, crown & (Y == cy) & (X % 3 == 1), "toxic", 5)
    # melted candles and big bones on the mound
    candle(g, cx - 16, 2, cz - 7, h=7, w=3)
    candle(g, cx + 14, 2, cz + 5, h=5, w=3)
    bone(g, "y", (cx + 3, cz - 12), (cx + 13, cz - 8), 3, 5, r=1.3)
    bone(g, "y", (cx - 13, cz + 7), (cx - 5, cz + 11), 3, 5, r=1.3)
    return prop("skull-pile", "Skull Pile", g)
