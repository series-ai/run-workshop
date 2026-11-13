"""Solar panel array, in the Pirate Nation mecha style.

One iconic shape (rule K3): two big wings of blue cells with bright grid
lines and thick steel frames, tilted toward the sky and the front (true
slopes, F2), on a copper pivot over an octagonal steel post with two
diagonal braces. A white battery box with a glowing charge meter and an
orange lid sits at the foot. The wings dip a little to one side (F5).
Detail is paint (S1). Faces -Z and the sky.
"""
import numpy as np

import paint as P
from _props import glow, hull, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import Asset, Clip, Grid, Part, sway

W, D = 34, 16
CX, CZ = 17.0, 9.0
YP = 18  # post top


def stand() -> Grid:
    g = Grid(W, YP + 4, D)
    X, Y, Z = coords(g)
    foot = ngon_prism(g, "y", CX, CZ, 5, 0, 2, "steel", 4, r_top=4)
    post = ngon_prism(g, "y", CX, CZ, 2.0, 2, YP, "steel", 5)
    P.flat(g, post & (np.abs(Y - 6.5) < 1.1), "orange", 5)
    for s in (-1, 1):
        bar(g, "z", (CX + s * 7, 1), (CX + s * 1.5, 11), 1.8, CZ - 1, CZ + 1, "steel", 4)
    piv = box(g, CX - 5, YP, CZ - 2, CX + 5, YP + 3, CZ + 2, "rust", 4)
    P.flat(g, edges(piv), "rust", 3)
    # the battery box at the foot
    bb = box(g, 2, 0, 3, 11, 8, 12, "bone", 5)
    hull(g, bb, "bone", 5, size=(5, 5), seed=5)
    lid = box(g, 1, 8, 2, 12, 10, 13, "orange", 5)
    P.flat(g, edges(lid), "orange", 3)
    glow(g, "-z", 3, 4, 9, 2, 6, glass=("toxic", 5), rim=("steel", 3), bar=False, glint=False)
    P.flat(g, (g.a > 0) & (Z < 2.5) & (X > 7) & (X < 8) & (Y > 2) & (Y < 6), "steel", 4)
    return g


def wing() -> Grid:
    g = Grid(15, 2, 14)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 15, 2, 14, "steel", 5)
    top = m & (Y > 1)
    P.flat(g, top, "blue", 4)
    P.flat(g, top & ((np.floor(X) % 4 == 0) | (np.floor(Z) % 4 == 0)), "sky", 6)
    P.flat(g, top & (np.floor(X) % 4 == 2) & (np.floor(Z) % 4 == 2), "blue", 5)
    P.flat(g, m & ((X < 1) | (X > 14) | (Z < 1) | (Z > 13)), "steel", 5)
    P.flat(g, m & (Y < 1), "steel", 4)
    return g


def build() -> Asset:
    root = Part("solar-panel", stand())
    arr = root.add(Part("array", None, at=(CX, YP + 3.0, CZ), rot=(-35.0, 0.0, 3.0)))
    arr.add(Part("wing-l", wing(), pivot=(15.0, 0.0, 7.0), at=(-1.0, 0.0, 0.0)))
    arr.add(Part("wing-r", wing(), pivot=(0.0, 0.0, 7.0), at=(1.0, 0.0, 0.0)))
    return Asset(id="space-props-solar-panel", pack="space", category="props", name="Solar Panel Array", root=root,
                 # the array tracks the sun slowly
                 clips=[Clip("idle", {"array": {"rot": sway(12.0, amp=(5.0, 10.0, 0.0), phase=(1.5, 0.0, 0.0))}})])
