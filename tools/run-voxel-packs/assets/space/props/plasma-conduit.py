"""Plasma conduit, in the Pirate Nation mecha style.

One chunky icon (rule K3): a heavy octagonal copper station pipe (true
facets, F2) with thick steel flanges, resting on two hazard-striped steel
cradles. In the middle a glowing cyan plasma coupling shows through a
caged window; near one end sits a junction box with a big red valve wheel
that is turned a little (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _props import glow, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets, gear
from voxgrid import C, Asset, Grid, Part

W, D = 36, 14
YC, CZ = 10.0, 7.0  # pipe axis
R = 4.5


def conduit() -> Grid:
    g = Grid(W, 22, D)
    X, Y, Z = coords(g)
    # cradles
    for x0 in (6, W - 11):
        g.prism("x", [(0, 0), (0, D), (3, D - 1), (YC, CZ + 5), (YC, CZ - 5), (3, 1)], x0, x0 + 5, C("steel", 4))
        cr = g.solids[-1].mask(g.shape)
        for m, fr in facets(g):
            pnpaint.hazard(g, m, period=4, a=("orange", 5), b=("iron", 5), frame=fr)
        P.flat(g, cr & (Y < 1), "steel", 3)
    # the pipe
    pipe = ngon_prism(g, "x", YC, CZ, R, 0, W, "rust", 4)
    ang = np.arctan2(Y - YC, Z - CZ)
    P.flat(g, pipe, "rust", 4)
    P.flat(g, pipe & (Y > YC + 2.5), "rust", 5)
    P.flat(g, pipe & (Y > YC + 3.8), "rust", 6)
    P.flat(g, pipe & (np.floor(X) % 9 == 4), "rust", 3)  # weld seams
    # flanges at both ends and round the coupling
    for x0 in (0, W - 3, 12, 21):
        f = ngon_prism(g, "x", YC, CZ, R + 1.2, x0, x0 + 3, "steel", 5)
        P.flat(g, f & (np.floor(X) == x0 + 1), "steel", 6)
        P.flat(g, f & (np.hypot(Y - YC, Z - CZ) > R + 0.3) & (np.floor((ang + 4) * 8 / 6.283) % 2 == 0) & ((np.floor(X) == x0) | (np.floor(X) == x0 + 2)), "steel", 3)
    # the glowing coupling between the middle flanges
    cp = ngon_prism(g, "x", YC, CZ, R + 0.5, 15, 21, "cyan", 5)
    P.flat(g, cp & (np.abs(Y - YC) < 1.5), "cyan", 7)
    P.flat(g, cp & (Y > YC + 3), "cyan", 6)
    P.flat(g, cp & (np.floor(X) == 17), "steel", 4)  # the cage bar
    # the junction box on top, near the -x end
    jb = box(g, 3, YC + R - 1, CZ - 3, 10, YC + R + 5, CZ + 3, "bone", 5)
    hull(g, jb, "bone", 5, size=(7, 6), seed=4)
    P.flat(g, jb & (Z < CZ - 2) & (Y > YC + R + 2) & (Y < YC + R + 4) & (X > 4) & (X < 9), "orange", 5)
    lamp = box(g, 8, YC + R + 5, CZ - 1, 10, YC + R + 7, CZ + 1, "gold", 7)
    return g


def valve() -> Grid:
    g = Grid(12, 12, 3)
    gear(g, "z", 6, 6, 3.8, 0, 2, teeth=6, depth=1.6, ramp="red", base=4)
    box(g, 5, 5, 2, 7, 7, 3, "steel", 6)
    return g


def build() -> Asset:
    root = Part("plasma-conduit", conduit())
    root.add(Part("valve", valve(), pivot=(6.0, 6.0, 3.0), at=(26.0, YC, CZ - R - 0.5), rot=(0.0, 0.0, 15.0)))
    return Asset(id="space-props-plasma-conduit", pack="space", category="props", name="Plasma Conduit", root=root)
