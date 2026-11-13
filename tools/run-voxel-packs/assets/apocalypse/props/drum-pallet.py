"""Pallet of chemical drums, in the Pirate Nation style.

A warm plank pallet carries two fat octagonal drums (true facets): a teal
drum with a bone band and a leaking hazard-yellow drum with a drop icon,
lashed together by a red ratchet strap. A third, red drum lies on its
side in front of them (rule F5). The toxic leak, the strap, the bands and
the icons are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, pallet, root
from pnkit import box
from pnshapes import coords, drum
from voxgrid import C, Grid

R, H = 7.5, 18
PW, PD = 32, 30  # pallet


def lying_drum() -> Grid:
    g = Grid(14, 15, 14)
    drum(g, 7, 7, 0, 15, 6.0, ramp="red", base=4, band=None, seed=9)
    return g


def build():
    g = Grid(PW, 4 + H + 2, PD)
    X, Y, Z = coords(g)
    pallet(g, 0, 0, 0, PW, PD, ramp="sand", base=5, seed=1)
    c1, c2 = (8.5, 21.5), (23.5, 21.7)
    drum(g, c1[0], c1[1], 4, H, R, ramp="teal", base=5, band=("bone", 6), icon=None, seed=2)
    body = drum(g, c2[0], c2[1], 4, H, R, ramp="gold", base=5, band=("red", 4), icon="drop", ink=("toxic", 6), seed=3)
    # the leak: toxic slime runs down the yellow drum's front and pools on the deck
    run = body & (np.abs(X - c2[0] + 2.5) < 1.0) & (Z < c2[1] - R + 1.2) & (Y < 9)
    P.flat(g, run, "toxic", 5)
    g.prism("y", [(24, 12), (30, 12.5), (30.5, 15), (25, 15.5), (23, 14)], 4, 5, C("toxic", 5))
    pool = g.solids[-1].mask(g.shape)
    P.flat(g, pool & (np.hypot(X - 27, Z - 13.5) < 1.2), "toxic", 7)
    # the ratchet strap round both drums (a proud band) with a buckle
    strap = box(g, c1[0] - R - 0.5, 14, c1[1] - R - 0.8, c2[0] + R + 0.5, 16, c1[1] - R + 0.2, "red", 4)
    P.flat(g, strap & (np.floor(X) % 4 == 0), "red", 3)
    box(g, 15, 13, c1[1] - R - 1.6, 18, 17, c1[1] - R - 0.6, "steel", 6)
    r = root("drum-pallet", g)
    # the third drum lies on its side in front, rolled a little (rule F5)
    child(r, "fallen-drum", lying_drum(), pivot=(1.0, 7.5, 7.0), at_grid=(16.0, 4, 7.0), rot=(0.0, 12.0, 90.0))
    return asset("drum-pallet", "Chemical Drum Pallet", r)
