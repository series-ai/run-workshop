"""Plasma fuel cell, in the Pirate Nation mecha style.

One iconic shape (rule K3): a tall octagonal plasma canister that glows
bright blue through a big window with level ticks, held in a thick steel
cage (four corner posts and two collars), on a tapered hazard-striped foot
ring (true slopes, F2). A domed copper cap carries a big valve wheel,
tilted a little (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _props import cham_prism, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets, gear
from voxgrid import Asset, Grid, Part

S = 16
C0 = S / 2


def body() -> Grid:
    g = Grid(S, 24, S)
    X, Y, Z = coords(g)
    # the foot: a chamfered frustum with hazard stripes on its slopes
    foot = cham_prism(g, "y", 0, 0, S, S, 4, 0, 4, "orange", 5, inset=1.5)
    for m, fr in facets(g):
        pnpaint.hazard(g, m, period=4, a=("orange", 5), b=("iron", 5), frame=fr)
    P.flat(g, foot & (Y > 3), "steel", 4)
    # the glowing canister
    can = ngon_prism(g, "y", C0, C0, 5, 4, 19, "plasma", 3)
    P.flat(g, can, "plasma", 3)
    P.flat(g, can & (Y > 7) & (Y < 16), "plasma", 5)
    P.flat(g, can & (Y > 13) & (Y < 16), "plasma", 7)  # the charge level
    P.flat(g, can & (np.abs(X - C0) < 1.6) & (Y > 5) & (Y < 18) & (np.floor(Y) % 3 == 0), "steel", 6)  # ticks
    # the cage: four thick corner posts and two collars
    for x0 in (1.5, S - 4.5):
        for z0 in (1.5, S - 4.5):
            post = box(g, x0, 4, z0, x0 + 3, 20, z0 + 3, "steel", 4)
            P.flat(g, edges(post), "steel", 3)
            P.flat(g, post & (np.floor(Y) % 5 == 1), "steel", 6)  # rivets
    for y0 in (4, 18):
        collar = cham_prism(g, "y", 1, 1, S - 1, S - 1, 3.5, y0, y0 + 2, "steel", 5)
        P.flat(g, edges(collar), "steel", 3)
    # the cap: a copper frustum
    cap = cham_prism(g, "y", 3, 3, S - 3, S - 3, 2.5, 20, 23, "rust", 4, inset=2)
    for m, fr in facets(g):
        P.plates(g, m, "rust", 4, size=(6, 4), frame=fr)
    P.flat(g, cap & (Y > 22), "rust", 6)
    return g


def valve() -> Grid:
    g = Grid(10, 3, 10)
    gear(g, "y", 5, 5, 3.2, 0, 2, teeth=6, depth=1.5, ramp="orange", base=5)
    box(g, 4, 2, 4, 6, 3, 6, "gold", 6)
    return g


def build() -> Asset:
    root = Part("fuel-cell", body())
    root.add(Part("valve", valve(), pivot=(5.0, 0.0, 5.0), at=(C0, 23.0, C0), rot=(6.0, 20.0, -5.0)))
    return Asset(id="space-props-fuel-cell", pack="space", category="props", name="Plasma Fuel Cell", root=root)
