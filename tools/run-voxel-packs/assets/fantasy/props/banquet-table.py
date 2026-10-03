"""Banquet table in the Pirate Nation style.

A long planked table on two chunky trestles (true-diagonal legs) with a red
runner and gold trim down its length. The feast is oversized so it reads
from far away (rule F4): a roast fowl on a gold platter, bread loaves, a
fruit bowl, gold goblets and a candle stand. Two benches flank it. Detail
is paint (rule S1). About 36 long and 22 tall.
"""

import numpy as np

import paint as P
from _props import brace, candle, coords, plank_box
from pnkit import box
from pnshapes import disc, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 40, 26, 32
X0, X1 = 2, 38
Z0, Z1 = 9, 23  # table top depth
TY = 13  # table top


def goblet(g: Grid, x, y, z) -> None:
    disc(g, "y", x, z, 1.4, y, y + 1, "gold", 4, n=6)
    box(g, x - 0.5, y + 1, z - 0.5, x + 0.5, y + 3, z + 0.5, "gold", 5)
    g.prism("y", flat_ngon(x, z, 1.0, 6), y + 3, y + 6, C("gold", 6), top=flat_ngon(x, z, 1.8, 6))
    _X, Y, _Z = coords(g)
    P.flat(g, last(g) & (Y > y + 5) & (np.hypot(_X - x, _Z - z) < 1.1), "red", 3)  # wine


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # trestles: two A-frames at the ends and a stretcher
    for x in (X0 + 3, X1 - 6):
        brace(g, "x", (1.4, Z0 + 1), (TY - 2, (Z0 + Z1) / 2 - 1), 2.6, x, x + 3, "darkwood", 4)
        brace(g, "x", (1.4, Z1 - 1), (TY - 2, (Z0 + Z1) / 2 + 1), 2.6, x, x + 3, "darkwood", 4)
    plank_box(g, X0 + 3, 5, (Z0 + Z1) / 2 - 1, X1 - 3, 7, (Z0 + Z1) / 2 + 1, "darkwood", 4, across="y", width=2, seed=1)
    plank_box(g, X0, TY - 3, Z0, X1, TY, Z1, "wood", 5, across="y", width=3, seed=2)
    # a red runner over the top, hanging over both ends
    run = box(g, X0 - 1, TY - 1, Z0 + 4, X1 + 1, TY, Z1 - 4, "red", 4)
    run |= box(g, X0 - 1, TY - 6, Z0 + 4, X0, TY, Z1 - 4, "red", 4)
    run |= box(g, X1, TY - 6, Z0 + 4, X1 + 1, TY, Z1 - 4, "red", 4)
    P.flat(g, run & ((Z < Z0 + 5) | (Z > Z1 - 5)), "gold", 6)
    P.flat(g, run & (Y < TY - 5), "gold", 5)
    # benches along both sides
    for bz in (Z0 - 6, Z1 + 2):
        plank_box(g, X0 + 2, 6, bz, X1 - 2, 8, bz + 4, "wood", 6, across="y", width=2, seed=bz)
        for lx in (X0 + 4, X1 - 6):
            box(g, lx, 0, bz + 1, lx + 2, 6, bz + 3, "darkwood", 4)
    # the feast: a roast fowl on a gold platter in the middle
    cx, cz = 20, 16
    disc(g, "y", cx, cz, 5.0, TY, TY + 1, "gold", 5, n=8)
    g.prism("y", flat_ngon(cx, cz, 3.0, 8), TY + 1, TY + 3, C("orange", 3), top=flat_ngon(cx, cz, 3.8, 8))
    fowl = last(g)
    g.prism("y", flat_ngon(cx, cz, 3.8, 8), TY + 3, TY + 6, C("orange", 3), top=flat_ngon(cx, cz, 2.0, 8))
    fowl |= last(g)
    P.mottle(g, fowl, "orange", 3, cell=2, seed=3)
    P.flat(g, fowl & (Y > TY + 5), "orange", 4)
    for dx in (-4, 3):
        box(g, cx + dx, TY + 3, cz - 1, cx + dx + 2, TY + 5, cz + 1, "bone", 6)  # drumstick ends
    # bread loaves, a fruit bowl and goblets
    for bx, bz in ((9, 13), (11, 18)):
        loaf = box(g, bx - 2, TY, bz - 1.5, bx + 2, TY + 3, bz + 1.5, "gold", 5)
        P.flat(g, loaf & (Y > TY + 2) & (np.floor(X) % 2 == 0), "gold", 3)
    disc(g, "y", 30, 14, 3.0, TY, TY + 2, "wood", 6, n=8)
    for (fx, fz, col) in ((29, 13, "red"), (31, 15, "leaf"), (30, 15, "orange"), (31, 13, "red")):
        box(g, fx - 1, TY + 2, fz - 1, fx + 1, TY + 4, fz + 1, col, 5)
    goblet(g, 14, TY, 20)
    goblet(g, 26, TY, 12)
    goblet(g, 33, TY, 19)
    # a candle stand
    disc(g, "y", 6, 17, 1.8, TY, TY + 1, "gold", 5, n=6)
    box(g, 5.5, TY + 1, 16.5, 6.5, TY + 4, 17.5, "gold", 5)
    candle(g, 6, TY + 4, 17, h=4, w=2)
    root = Part("banquet-table", g)
    return Asset(id="fantasy-props-banquet-table", pack="fantasy", category="props", name="Banquet Table", root=root)
