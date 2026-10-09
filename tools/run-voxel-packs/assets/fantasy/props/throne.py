"""Royal throne in the Pirate Nation style.

A caricature seat of power (rule F4): a gold-framed chair with a tall red
velvet back that ends in a pointed gold crest with a crown, chunky
armrests with gold lion-head knobs and a red cushion, on a two-step stone
dais with a blue runner. Detail is paint (rule S1). About 26 wide and 44
tall (person-sized).
"""

import numpy as np

import paint as P
from _props import coords, gem, glyph, stone_box
from pnkit import box, edges
from pnshapes import last
from voxgrid import C, Asset, Grid, Part

W, H, D = 30, 48, 28
CX = 15
Z0, Z1 = 6, 22  # throne seat depth; the front is Z0
DY = 4  # top of the dais


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    stone_box(g, 1, 0, 1, 29, 2, 27, "stone", 5, block=(6, 3), seed=1)
    stone_box(g, 3, 2, 3, 27, 4, 25, "stone", 6, block=(5, 2), seed=2)
    rug = box(g, CX - 4, 0, 0, CX + 4, 1, 3, "blue", 4)
    rug |= box(g, CX - 4, 2, 1, CX + 4, 3, 3, "blue", 4)
    rug |= box(g, CX - 4, 4, 3, CX + 4, 4.5, Z0, "blue", 4)
    P.flat(g, rug & ((X < CX - 3) | (X > CX + 3)), "gold", 5)
    # legs and the seat box, framed in gold
    seat = box(g, CX - 9, DY, Z0, CX + 9, DY + 10, Z1, "gold", 4)
    P.flat(g, seat & (Z < Z0 + 1) & (np.abs(X - CX) < 7) & (Y > DY + 2) & (Y < DY + 8), "red", 3)
    P.flat(g, edges(seat), "gold", 5)
    cush = box(g, CX - 8, DY + 10, Z0 - 1, CX + 8, DY + 13, Z1 - 4, "red", 4)
    P.mottle(g, cush, "red", 4, cell=2, seed=3)
    P.outline(g, cush, "gold", 6, normal="y")
    # the tall back: gold frame, red velvet panel, pointed crest
    back = box(g, CX - 10, DY + 10, Z1 - 4, CX + 10, DY + 32, Z1, "gold", 4)
    P.flat(g, edges(back), "gold", 5)
    panel = box(g, CX - 7, DY + 13, Z1 - 5, CX + 7, DY + 30, Z1 - 4, "red", 4)
    P.mottle(g, panel, "red", 4, cell=3, seed=4)
    P.outline(g, panel, "red", 3, normal="z")
    glyph(g, "-z", Z1 - 5, CX - 4, DY + 23, "crown", "gold", 6)
    glyph(g, "-z", Z1 - 5, CX - 2, DY + 15, "fleur", "gold", 5)
    g.prism("z", [(CX - 10, DY + 32), (CX + 10, DY + 32), (CX + 3, DY + 36), (CX, DY + 40), (CX - 3, DY + 36)], Z1 - 4, Z1, C("gold", 5))
    crest = last(g)
    P.flat(g, crest & (Y > DY + 36), "gold", 6)
    gem(g, CX, DY + 33, Z1 - 5.5, r=1.6, h=2.4, ramp="blue", shade=5)
    for sx in (-1, 1):  # finials on the back corners
        box(g, CX + sx * 9 - 1.5, DY + 32, Z1 - 3.5, CX + sx * 9 + 1.5, DY + 35, Z1 - 0.5, "gold", 6)
    # armrests with lion-head knobs
    for sx in (-1, 1):
        x0 = CX - 9 if sx < 0 else CX + 6
        arm = box(g, x0, DY + 13, Z0 + 1, x0 + 3, DY + 18, Z1 - 4, "gold", 4)
        P.flat(g, arm & (Y > DY + 17), "red", 4)
        head = box(g, x0 - 0.5, DY + 14, Z0 - 1, x0 + 3.5, DY + 19, Z0 + 2, "gold", 6)
        P.flat(g, head & (Z < Z0 - 0.5) & (np.abs(Y - (DY + 17.5)) < 0.6) & (np.abs(X - (x0 + 1.5)) > 0.6), "darkwood", 3)  # eyes
        P.flat(g, head & (Y < DY + 15), "gold", 4)
    root = Part("throne", g)
    return Asset(id="fantasy-props-throne", pack="fantasy", category="props", name="Royal Throne", root=root)
