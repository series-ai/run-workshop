"""Concrete jersey barrier, in the Pirate Nation style.

One chunky icon (rule K3), two tiles (32) long: the safety-shape profile
as one true-slope prism (a wide foot, a sloped face, a narrow top), in
dusty sand concrete with slab seams and cracks. A hazard band of yellow
and dark stripes runs along the top; the chipped corner, the drain
scupper, the teal spray tag and the stencilled Z are paint (rule S1).
Two steel lifting loops stand on top; pin connectors stand at the ends.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, hazard_band, root
from pnkit import box
from pnshapes import coords, facets
from voxgrid import C, Grid

L, D, H = 32, 13, 16
PROFILE = [(0, 0), (0, D), (2.5, D), (6, D - 3), (H, D - 4.5), (H, 4.5), (6, 3), (2.5, 0)]  # (y, z)


def build():
    g = Grid(L + 2, H + 3, D)
    g.prism("x", PROFILE, 1, L + 1, C("sand", 5))
    body = g.solids[-1]
    m = body.mask(g.shape)
    for fm, fr in facets(g, [body]):
        pnpaint.concrete(g, fm, "sand", 5, size=10, cracks=2, frame=fr, seed=int(fm.sum()) % 97)
    X, Y, Z = coords(g)
    # the top band of hazard stripes, on both sloped faces and the top
    hazard_band(g, m & (Y > H - 4.5), period=6)
    P.flat(g, m & (Y > H - 1) & (Y < H), "sand", 6)
    # a chipped corner, a drain scupper at the foot, grime
    P.flat(g, m & (X < 5) & (Y > H - 5) & (Y < H - 2) & (Z < D / 2), "sand", 3)
    P.flat(g, m & (np.abs(X - L / 2 - 1) < 3) & (Y < 2.5), "sand", 2)
    P.grime(g, m, height=3, seed=2)
    # a teal spray tag and a stencilled Z on the front face
    tag = m & (Z < 4.2) & (np.abs((Y - 8.5) - 0.8 * np.sin((X - 6) * 0.9)) < 0.9) & (X > 20) & (X < 29)
    P.flat(g, tag, "teal", 6)
    pnglyph.text(g, "-z", 3.2, 8, 5, "Z", "red", 4)
    # lifting loops on top and pin connectors at both ends
    for lx in (8, L - 7):
        box(g, lx, H, D // 2 - 1, lx + 1, H + 3, D // 2 + 1, "steel", 5)
        box(g, lx + 3, H, D // 2 - 1, lx + 4, H + 3, D // 2 + 1, "steel", 5)
        box(g, lx, H + 2, D // 2 - 1, lx + 4, H + 3, D // 2 + 1, "steel", 6)
    for ex in (0, L + 1):
        box(g, ex, 4, D // 2 - 2, ex + 1, 12, D // 2 + 2, "steel", 4)
    return asset("jersey-barrier", "Jersey Barrier", root("jersey-barrier", g))
