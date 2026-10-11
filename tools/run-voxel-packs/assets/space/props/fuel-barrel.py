"""Toxic fuel barrel, in the Pirate Nation mecha style.

One iconic shape (rule K3): a faceted octagonal drum (true facets, F2) in
warm white hull paint with two proud hazard-orange rolling hoops and a
toxic-green band that carries a big flame icon on the front facet. A glowing
green sight glass runs up the +x facet, a copper pump cap with a crank sits
on the lid, and a puddle of spilled green fuel spreads out on one side
(F5). Dents, rust and the drips are paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import ngon_prism
from pnkit import box, edges
from pnshapes import coords, drum, quad
from voxgrid import C, Asset, Grid, Part

R, H = 10.0, 21
CX, CZ = 12.0, 11.0


def build() -> Asset:
    g = Grid(28, H + 7, 24)
    X, Y, Z = coords(g)
    # the spill first, so the drum sits on it
    g.prism("y", [(CX + 3, CZ - 9), (CX + 9, CZ - 8.5), (CX + 12.5, CZ - 5), (CX + 12, CZ + 1), (CX + 8, CZ + 4), (CX + 3, CZ + 3)], 0, 1, C("toxic", 3))
    spill = g.solids[-1].mask(g.shape)
    P.flat(g, spill & (np.hypot(X - CX - 8, Z - CZ + 4) < 2.2), "toxic", 5)
    body = drum(g, CX, CZ, 1, H, R, ramp="bone", base=5, hoop="orange", band=("toxic", 3), icon="flame", ink=("orange", 5), seed=5)
    # the sight glass on the +x facet: a glowing slot with level ticks
    glass = body & (X > CX + R - 1) & (np.abs(Z - CZ) < 1.6) & (Y > 3) & (Y < H - 3)
    P.flat(g, glass, "toxic", 6)
    P.flat(g, glass & (np.floor(Y) % 3 == 0), "steel", 4)
    # green drips from the lid down the front-right facets
    for dx, length in ((3.5, 5), (5.5, 3)):
        P.flat(g, body & (np.abs(X - CX - dx) < 0.8) & (Z < CZ - 3) & (Y > H + 1 - length), "toxic", 4)
    # the pump cap on the lid: a copper collar, a steel column and a crank
    collar = ngon_prism(g, "y", CX - 2.5, CZ + 1.5, 3, H + 1, H + 2, "rust", 4)
    P.flat(g, collar, "rust", 3)
    col = box(g, CX - 4, H + 2, CZ, CX - 1, H + 5, CZ + 3, "rust", 5)
    P.flat(g, edges(col), "rust", 3)
    g.prism("z", quad((CX - 1, H + 3.5), (CX + 4, H + 4.5), 0.8), CZ + 1, CZ + 2, C("steel", 5))
    box(g, CX + 3, H + 3, CZ + 1, CX + 5, H + 5, CZ + 3, "orange", 5)
    root = Part("fuel-barrel", g)
    return Asset(id="space-props-fuel-barrel", pack="space", category="props", name="Toxic Fuel Barrel", root=root)
