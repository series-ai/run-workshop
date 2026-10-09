"""Grindstone in the Pirate Nation style.

One iconic shape (rule K3): a big round whetstone (an octagon, true
facets) standing in an oak frame on thick legs, turned by a gold crank on
the front, over a planked water trough, with a bench seat behind it. Detail is paint (rule S1). About 28 wide and 24 tall.
"""

import numpy as np

import paint as P
from _props import brace, coords, plank_box
from pnkit import box
from pnshapes import disc, radial
from voxgrid import Asset, Grid, Part

W, H, D = 34, 28, 20
CX, CY, CZ = 14, 14, 10  # wheel centre
R = 8.5


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the trough under the wheel
    tr = plank_box(g, CX - 8, 0, CZ - 5, CX + 8, 6, CZ + 5, "wood", 5, across="y", width=2, seed=1)
    water = tr & (Y > 5)
    P.flat(g, water, "sky", 5)
    P.flat(g, water & ((np.floor(X) + np.floor(Z)) % 5 == 0), "sky", 6)
    P.flat(g, tr & (Y > 5) & ((X < CX - 7) | (X > CX + 7) | (Z < CZ - 4) | (Z > CZ + 4)), "darkwood", 3)
    # the frame: two A-shaped side posts (true diagonals) and an axle beam
    for zc in (CZ - 4.5, CZ + 4.5):
        brace(g, "z", (CX - 9, 1.2), (CX - 1, CY + 1), 2.6, zc - 1, zc + 1, "darkwood", 4)
        brace(g, "z", (CX + 9, 1.2), (CX + 1, CY + 1), 2.6, zc - 1, zc + 1, "darkwood", 4)
    # the whetstone: an octagon along z, grey-blue stone with a worn rim
    wheel = disc(g, "z", CX, CY, R, CZ - 2, CZ + 2, "stone", 5, n=8)
    rr = radial(g, "z", CX, CY)
    P.stone(g, wheel, "stone", 5, block=(4, 3), cracks=0.0, seed=2)
    P.flat(g, wheel & (Z < CZ - 1) & (rr < R - 2) & (rr > R - 3.2), "stone", 4)
    P.flat(g, wheel & (rr > R - 1.2), "stone", 6)
    # the axle through the frame, a gold hub and the crank on the front
    box(g, CX - 1, CY - 1, CZ - 7, CX + 1, CY + 1, CZ + 7, "darkwood", 3)
    hub = disc(g, "z", CX, CY, 2.2, CZ - 3, CZ + 3, "gold", 5, n=8)
    P.flat(g, hub & (rr < 1.2), "gold", 7)
    box(g, CX - 1, CY - 6, CZ - 9, CX + 1, CY + 1, CZ - 7, "gold", 5)
    grip = box(g, CX - 1, CY - 7, CZ - 13, CX + 1, CY - 5, CZ - 7, "wood", 6)
    P.flat(g, grip & (Z < CZ - 12), "red", 4)
    # a bench seat for the smith behind the wheel
    plank_box(g, CX - 5, 7, CZ + 7, CX + 5, 9, CZ + 11, "wood", 6, across="y", width=2, seed=5)
    for lx in (CX - 5, CX + 3):
        box(g, lx, 0, CZ + 8, lx + 2, 7, CZ + 10, "darkwood", 4)
    root = Part("grindstone", g)
    return Asset(id="fantasy-props-grindstone", pack="fantasy", category="props", name="Grindstone", root=root)
