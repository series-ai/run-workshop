"""Heraldic banner stand in the Pirate Nation style.

A thick pole on three splayed legs (true diagonals) carries a crossbar with
gold finials and a big royal-blue banner with a swallow-tail foot (true
slopes), a gold trim and a gold crown over a lion (rule C3: the accent
marks the realm). Gold tassels hang at the corners; the banner hangs a
little crooked (rule F5). About 22 wide and 40 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, glyph, idx
from pnkit import box
from pnshapes import last, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 24, 40, 16
CX, CZ = 12, 7  # pole centre
TOP = 35  # crossbar top


def build() -> Asset:
    g = Grid(W, H, D)
    # legs: three splayed braces meeting the pole at y = 9
    brace(g, "z", (CX - 9, 1.5), (CX - 1, 9), 2.4, CZ - 1, CZ + 1, "darkwood", 4)
    brace(g, "z", (CX + 9, 1.5), (CX + 1, 9), 2.4, CZ - 1, CZ + 1, "darkwood", 4)
    brace(g, "x", (1.5, CZ + 6.5), (9, CZ + 1), 2.4, CX - 1, CX + 1, "darkwood", 4)
    pole = box(g, CX - 1.5, 0, CZ - 1.5, CX + 1.5, TOP + 1, CZ + 1.5, "wood", 5)
    P.planks(g, pole, "wood", 5, width=3, across="x", nails=False, seed=1)
    X, Y, Z = idx(g)
    P.flat(g, pole & ((Y == 10) | (Y == 11) | (Y == 24) | (Y == 25)), "gold", 4)
    # finial: a gold spear tip on a knob
    box(g, CX - 1.5, TOP + 1, CZ - 1.5, CX + 1.5, TOP + 2, CZ + 1.5, "gold", 5)
    g.prism("z", [(CX - 1.5, TOP + 2), (CX + 1.5, TOP + 2), (CX, TOP + 5)], CZ - 1, CZ + 1, C("gold", 6))
    # crossbar with gold ball ends
    bar_m = box(g, CX - 9, TOP - 2, CZ - 3, CX + 9, TOP, CZ - 1, "darkwood", 4)
    P.planks(g, bar_m, "darkwood", 4, width=2, across="y", nails=True, seed=2)
    for ex in (CX - 11, CX + 9):
        box(g, ex, TOP - 3, CZ - 3.5, ex + 2, TOP + 1, CZ - 0.5, "gold", 5)
    # the banner: a 2-deep prism with a swallow-tail foot, hung in front of the pole
    x0, x1, yt, yb = CX - 7, CX + 7, TOP - 2, 11
    pts = [(x0, yt), (x1, yt), (x1, yb), (CX + 0.0, yb + 5), (x0, yb)]
    pts = rotate(pts, CX, yt, -2.0)
    g.prism("z", pts, CZ - 5, CZ - 3, C("blue", 4))
    ban = last(g)
    P.mottle(g, ban, "blue", 4, cell=3, seed=3)
    P.outline(g, ban, "gold", 5, normal="z")
    Xc, Yc, Zc = coords(g)
    P.flat(g, ban & (Yc > yt - 3), "blue", 3)  # the fold over the bar
    P.flat(g, ban & (np.abs(Yc - (yt - 3)) < 0.5), "gold", 6)
    glyph(g, "-z", CZ - 5, CX - 4, 26, "crown", "gold", 6)
    glyph(g, "-z", CZ - 5, CX - 3, 17, "lion", "gold", 5)
    glyph(g, "+z", CZ - 3, CX - 4, 26, "crown", "gold", 6)
    # tassels at the two points of the tail
    for tx in (x0, x1 - 2):
        t = box(g, tx, yb - 3, CZ - 5, tx + 2, yb, CZ - 3, "gold", 6)
        P.flat(g, t & (Y == yb - 3), "gold", 4)
    root = Part("banner-stand", g)
    return Asset(id="fantasy-props-banner-stand", pack="fantasy", category="props", name="Banner Stand", root=root)
