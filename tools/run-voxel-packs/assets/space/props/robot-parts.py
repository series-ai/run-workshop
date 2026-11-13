"""Robot scrap pile, in the Pirate Nation mecha style.

One chunky icon (rule K3): an oversized dented robot head (a chamfered
block, true slopes, F2) with one glowing red eye and one dead eye, lying
tilted on a heap of scrap plates. A severed claw arm and two copper gears
lie beside it, each at its own angle (F5). Dents, rust and scorch marks are
paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, hull, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, facets, gear
from voxgrid import C, Asset, Grid, Part


def heap() -> Grid:
    g = Grid(30, 6, 24)
    X, Y, Z = coords(g)
    g.prism("y", [(2, 5), (14, 1), (27, 4), (29, 15), (20, 23), (5, 21), (1, 13) ], 0, 4, C("steel", 4), top=[(6, 7), (14, 5), (23, 7), (24, 14), (18, 19), (8, 18), (5, 13)])
    m = g.a > 0
    for f, fr in facets(g):
        P.plates(g, f, "steel", 5, size=(6, 5), rivets=False, frame=fr)
    P.flat(g, m & (P._hash(np.floor(X).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=6) % np.uint64(9) == 0), "rust", 4)
    return g


def head() -> Grid:
    g = Grid(16, 14, 14)
    X, Y, Z = coords(g)
    h = cham_prism(g, "z", 0, 0, 16, 12, 3, 0, 14, "bone", 5)
    hull(g, h, "bone", 5, size=(8, 6), edge=0, seed=1)
    P.flat(g, h & ((Z < 1) | (Z > 13)) & ((X < 1.5) | (X > 14.5) | (Y < 1.5) | (Y > 10.5)), "bone", 3)
    face = h & (Z < 1)
    # the visor band with one live red eye and one dead eye
    P.flat(g, face & (Y > 5) & (Y < 10) & (X > 2) & (X < 14), "iron", 5)
    P.flat(g, face & (np.hypot(X - 10.5, Y - 7.5) < 2.2), "red", 5)
    P.flat(g, face & (np.hypot(X - 10.5, Y - 7.5) < 1.0), "red", 7)
    P.flat(g, face & (np.hypot(X - 5.5, Y - 7.5) < 2.0), "steel", 3)
    P.flat(g, face & (np.abs(X - 4.5 - (Y - 6)) < 0.6) & (Y > 6) & (Y < 9.5), "steel", 6)  # a crack over the dead eye
    # the mouth grille
    P.flat(g, face & (Y > 1.5) & (Y < 4) & (X > 4) & (X < 12) & (np.floor(X) % 2 == 0), "iron", 5)
    # an orange crest stripe over the top and back
    P.flat(g, h & (np.abs(X - 8) < 2.1) & ~face, "orange", 5)
    P.flat(g, h & (np.abs(X - 8) < 2.1) & ~face & (Y > 11), "orange", 6)
    # dents and scorch marks
    P.flat(g, h & (np.hypot(X - 12, Y - 12) < 2.5) & (Y > 11), "bone", 3)
    P.flat(g, h & (np.hypot(X - 1, Z - 9) < 3) & (X < 1), "iron", 5)
    return g


def ear() -> Grid:
    g = Grid(3, 6, 6)
    m = ngon_prism(g, "x", 3, 3, 2.5, 0, 2, "orange", 5)
    box(g, 2, 2, 2, 3, 4, 4, "steel", 6)
    return g


def claw() -> Grid:
    g = Grid(20, 5, 10)
    X, Y, Z = coords(g)
    arm = box(g, 0, 0, 3, 11, 4, 7, "steel", 5)
    P.flat(g, edges(arm), "steel", 3)
    P.flat(g, arm & (np.floor(X) == 5), "orange", 5)  # the elbow band
    P.flat(g, arm & (X < 1.5), "rust", 3)  # the torn end
    wrist = ngon_prism(g, "x", 2.5, 5, 2.2, 11, 13, "rust", 4)
    bar(g, "y", (13, 5), (18, 1), 2, 0, 4, "steel", 6)
    bar(g, "y", (13, 5), (18, 9), 2, 0, 4, "steel", 6)
    return g


def gear_part(r: float, teeth: int) -> Grid:
    s = int(2 * (r + 2)) + 2
    g = Grid(s, 2, s)
    gear(g, "y", s / 2, s / 2, r, 0, 2, teeth=teeth, depth=1.8, ramp="rust", base=4)
    return g


def build() -> Asset:
    root = Part("robot-parts", heap())
    hd = root.add(Part("head", head(), pivot=(8.0, 0.0, 7.0), at=(14.0, 3.0, 12.0), rot=(10.0, -28.0, 10.0)))
    hd.add(Part("ear", ear(), pivot=(0.0, 3.0, 3.0), at=(8.0, 7.0, 0.0)))
    root.add(Part("claw-arm", claw(), pivot=(0.0, 0.0, 5.0), at=(17.0, 0.0, 2.0), rot=(0.0, -12.0, 0.0)))
    root.add(Part("gear-big", gear_part(4.5, 8), pivot=(6.5, 0.0, 6.5), at=(5.0, 3.0, 6.0), rot=(-12.0, 10.0, 8.0)))
    root.add(Part("gear-small", gear_part(2.8, 6), pivot=(5.0, 0.0, 5.0), at=(6.0, 3.5, 17.0), rot=(10.0, 0.0, -14.0)))
    return Asset(id="space-props-robot-parts", pack="space", category="props", name="Robot Scrap Pile", root=root)
