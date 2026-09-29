"""Stacked hay bales in the Pirate Nation style.

Three chunky straw blocks (two side by side, one across the top, turned a
little: rule F5), painted with straw streaks and bound with dark twine;
loose straw at the foot and a pitchfork leaning on the stack (true-slope
handle). Detail is paint (rule S1). About 32 wide and 22 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords
from pnkit import box, edges
from pnshapes import last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 34, 26, 22


def bale_paint(g: Grid, m: np.ndarray, along: str, seed: int) -> None:
    X, Y, Z = coords(g)
    P.thatch(g, m, "gold", 6, band=4, frame="z" if along == "x" else "x", seed=seed)
    up = np.zeros(g.shape, dtype=bool)
    up[:, :-1, :] = g.a[:, 1:, :] == 0
    P.thatch(g, m & up, "gold", 6, band=5, frame="top", seed=seed + 7)
    P.flat(g, edges(m), "gold", 5)
    U = X if along == "x" else Z
    lo, hi = (U[m].min(), U[m].max())
    for f in (0.28, 0.72):
        u = lo + (hi - lo) * f
        P.flat(g, m & (np.abs(U - u) < 0.6), "darkwood", 5)  # twine


def build() -> Asset:
    g = Grid(W, H, D)
    b1 = box(g, 1, 0, 3, 16, 9, 13, "gold", 6)
    bale_paint(g, b1, "x", 1)
    b2 = box(g, 17, 0, 4, 32, 9, 14, "gold", 6)
    bale_paint(g, b2, "x", 2)
    # the top bale turned 8° about y: a prism in plan (a true diagonal)
    pts = rotate([(10, 2), (20, 2), (20, 17), (10, 17)], 15, 9.5, 8)
    g.prism("y", pts, 9, 18, C("gold", 6))
    b3 = last(g)
    bale_paint(g, b3, "z", 3)
    X, Y, Z = coords(g)
    # loose straw on the ground
    for sx, sz, w in ((2, 0, 4), (20, 1, 3), (28, 16, 4), (6, 15, 3)):
        box(g, sx, 0, sz, sx + w, 1, sz + 2, "gold", 6)
    # a pitchfork leaning on the +x bale: a long handle and three tines
    brace(g, "z", (31.5, 1.5), (25, 23), 1.8, 15, 17, "wood", 6)
    box(g, 23, 21, 15, 28, 22, 17, "steel", 5)
    for tx in (23, 25, 27):
        box(g, tx, 22, 15, tx + 1, 25, 17, "steel", 6)
    root = Part("hay-bales", g)
    return Asset(id="fantasy-props-hay-bales", pack="fantasy", category="props", name="Hay Bales", root=root)
