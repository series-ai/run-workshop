"""Apothecary potion shelf in the Pirate Nation style.

A chunky darkwood case with a steep gabled crest (true slopes) and three
planked shelves full of faceted bottles in vivid accents (rule C3: the
colours say magic): red, cyan, green, magenta, gold and blue. A skull, a
rolled scroll and a hanging herb bundle make it an apothecary's. Detail is
paint (rule S1). About 30 wide and 36 tall.
"""

import numpy as np

import paint as P
from _props import coords, plank_box, potion
from pnkit import box
from pnshapes import disc, facets, last, skull
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 38, 14
X0, X1, Z0, Z1 = 2, 30, 2, 12  # case outline; the front is Z0
SHELVES = (3, 13, 23)  # shelf tops
TOP = 32


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    back = box(g, X0, 0, Z1 - 2, X1, TOP, Z1, "darkwood", 6)
    P.planks(g, back, "darkwood", 6, width=4, across="x", nails=False, seed=1)
    for sx in (X0, X1 - 3):
        plank_box(g, sx, 0, Z0, sx + 3, TOP, Z1, "darkwood", 5, across="x", width=3, seed=sx)
    for k, sy in enumerate(SHELVES):
        plank_box(g, X0 + 3, sy - 2, Z0, X1 - 3, sy, Z1 - 2, "wood", 5, across="y", width=2, seed=10 + k)
    # crest: a tiled gable across the top with a gold finial
    g.prism("z", [(X0 - 1, TOP), (X1 + 1, TOP), ((X0 + X1) / 2, TOP + 6)], Z0 - 1, Z1, C("red", 5))
    crest = last(g)
    for m, fr in facets(g):
        if fr == "top":
            continue
        P.tiles(g, m, "red", 5, row=2, width=3, frame=fr, seed=3)
    P.outline(g, crest & (Z < Z0), "darkwood", 4, normal="z")
    box(g, (X0 + X1) / 2 - 1, TOP + 5, Z0 + 3, (X0 + X1) / 2 + 1, TOP + 7, Z0 + 5, "gold", 6)
    # potions: (x, shelf, r, h, colour)
    rows = [
        [(8, 2.2, 6, "red"), (13, 1.6, 4, "cyan"), (17, 2.0, 5, "leaf"), (22, 2.4, 7, "magenta"), (26, 1.5, 3, "gold")],
        [(8, 1.8, 5, "blue"), (12, 2.4, 7, "leaf"), (20, 1.6, 4, "red"), (25, 2.0, 5, "cyan")],
        [(9, 2.0, 5, "gold"), (13, 1.6, 4, "magenta"), (24, 2.2, 5, "blue")],
    ]
    for sy, row in zip(SHELVES, rows):
        for x, r, h, col in row:
            potion(g, x, sy, Z0 + 4, r=r, h=h, liquid=col, shade=5, n=6)
    # a skull on the top shelf and a rolled scroll on the middle one
    skull(g, 18, SHELVES[2], Z0 + 5, s=6, ramp="bone", base=6, eyes=("leaf", 6), socket=("darkwood", 2))
    scroll = disc(g, "x", SHELVES[1] + 1.5, Z0 + 4, 1.5, 14.5, 19.5, "bone", 6, n=6)
    P.flat(g, scroll & (np.abs(X - 17) < 0.6), "red", 4)
    # a herb bundle hanging from the +x side
    box(g, X1, TOP - 4, Z0 + 3, X1 + 1, TOP - 1, Z0 + 5, "darkwood", 3)
    herb = box(g, X1, TOP - 11, Z0 + 2, X1 + 2, TOP - 4, Z0 + 6, "leaf", 4)
    P.flat(g, herb & ((np.floor(Y) + np.floor(Z)) % 3 == 0), "leaf", 5)
    P.flat(g, herb & (Y > TOP - 6), "red", 4)
    root = Part("potion-shelf", g)
    return Asset(id="fantasy-props-potion-shelf", pack="fantasy", category="props", name="Potion Shelf", root=root)
