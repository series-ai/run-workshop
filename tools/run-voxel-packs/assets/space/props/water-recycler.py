"""Water recycler, in the Pirate Nation mecha style.

One chunky icon (rule K3): a squat octagonal white hull tank (true facets,
F2) with a domed copper lid and a big sight window of blue water with
bubbles, on a steel drip tray with a puddle. An orange pump motor with
cooling fins sits beside it, joined by a looping copper pipe with a red
valve wheel that is turned a little (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _pn import pipe
from _props import glow, hull, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets, gear
from voxgrid import C, Asset, Grid, Part

W, D = 30, 20
CX, CZ = 11.0, 10.0
R = 8.0


def recycler() -> Grid:
    g = Grid(W, 26, D)
    X, Y, Z = coords(g)
    tray = box(g, 1, 0, 1, W - 1, 2, D - 1, "steel", 4)
    P.flat(g, edges(tray), "steel", 3)
    P.flat(g, tray & (Y > 1) & (np.hypot((X - 22) / 5, (Z - 5) / 3) < 1), "sky", 4)  # a puddle
    tank = ngon_prism(g, "y", CX, CZ, R, 2, 17, "bone", 5)
    for m, fr in facets(g):
        P.plates(g, m, "bone", 5, size=(7, 5), frame=fr)
    P.flat(g, tank & (Y < 3), "bone", 3)
    P.flat(g, tank & (np.abs(Y - 15.5) < 0.6), "teal", 4)
    lid = ngon_prism(g, "y", CX, CZ, R, 17, 21, "rust", 4, r_top=4)
    for m, fr in facets(g):
        P.plates(g, m, "rust", 4, size=(5, 3), rivets=False, frame=fr)
    cap = ngon_prism(g, "y", CX, CZ, 2.2, 21, 23, "steel", 5)
    # the sight window on the front facet: water to a level, bubbles
    front = tank & (Z < CZ - R + 1)
    win = front & (np.abs(X - CX) < 3.2) & (Y > 5) & (Y < 14)
    P.flat(g, win, "sky", 6)
    P.flat(g, win & (Y < 11), "blue", 5)
    P.flat(g, win & (Y < 11) & (P._hash(np.floor(X).astype(int), np.floor(Y).astype(int), seed=3) % np.uint64(5) == 0), "sky", 7)
    P.flat(g, front & (np.abs(X - CX) < 4.2) & (Y > 4) & (Y < 15) & ~win, "rust", 3)
    # the pump motor on the +x side
    mo = box(g, 21, 2, 4, 28, 10, 15, "orange", 5)
    P.flat(g, edges(mo), "orange", 3)
    P.flat(g, mo & (Y > 9), "orange", 6)
    P.flat(g, mo & (Z < 4.5) & (Y > 3) & (Y < 9) & (np.floor(X) % 2 == 0), "orange", 3)  # fins
    P.flat(g, mo & (X > 27.5) & (Y > 3) & (Y < 9) & (np.floor(Z) % 2 == 0), "orange", 3)
    # the looping pipe from the motor to the lid
    pipe(g, [(24.5, 10, 12), (24.5, 19, 12), (CX + 4, 19, 12)], s=3, ramp="rust", base=4)
    pipe(g, [(21, 5, 7), (CX + R - 0.5, 5, 7)], s=2, ramp="rust", base=4, flange=False)
    return g


def valve() -> Grid:
    g = Grid(10, 3, 10)
    gear(g, "y", 5, 5, 3.2, 0, 2, teeth=6, depth=1.5, ramp="red", base=4)
    box(g, 4, 2, 4, 6, 3, 6, "steel", 6)
    return g


def build() -> Asset:
    root = Part("water-recycler", recycler())
    root.add(Part("valve", valve(), pivot=(5.0, 0.0, 5.0), at=(24.5, 20.5, 12.0), rot=(0.0, 20.0, 0.0)))
    return Asset(id="space-props-water-recycler", pack="space", category="props", name="Water Recycler", root=root)
