"""Rusted oil drum, in the Pirate Nation style.

One iconic shape (rule K3): a faceted octagonal drum in signal red with two
proud rolling hoops, and a hazard-yellow band between them with a skull
icon on the front facet. Dents, rust bloom, the oil run and the lid are
paint, not geometry (rule S1). The dents and the spill make it asymmetric (rule F5).
"""
import numpy as np

import paint as P
from _pn import coords, drum
from voxgrid import Asset, Grid, Part, bounds_pivot

R, H = 8.5, 19


def build() -> Asset:
    g = Grid(20, 21, 20)
    cx = cz = 10.0
    body = drum(g, cx, cz, 0, H, R, ramp="red", base=4, label="skull", seed=3)
    X, Y, Z = coords(g)
    # a run of oil down the +x side from the open bung (paint only)
    spill = body & (X + 0.5 > cx + 4.5) & (np.abs(Z + 0.5 - cz) < 1.2) & (Y >= 9)
    P.flat(g, spill, "darkwood", 5)
    root = Part("oil-drum", g, pivot=bounds_pivot(g))
    return Asset(id="apocalypse-props-oil-drum", pack="apocalypse", category="props", name="Rusted Oil Drum", root=root)
