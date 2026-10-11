"""Big propane tank, in the Pirate Nation style.

One chunky icon (rule K3): a sun-faded yellow capsule (an octagonal barrel with
true-frustum end caps) on two sand concrete saddles, one of them cracked.
A brass valve dome sits in a steel collar on top; a red hazard diamond
with a flame and a gauge are on the front. Chalky wear, rust runs and the
crack are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, root, tuft
from pnkit import box
from pnshapes import coords, cone, disc, ngon_radius
from voxgrid import C, Grid

L, R = 26, 7.5  # barrel length (x) and flat radius
CY, CZ = 3 + R, 9.0  # axis height and depth
X0 = 6  # barrel start (the end caps reach 5 beyond)


def build():
    g = Grid(L + 2 * X0, 26, 18)
    X, Y, Z = coords(g)
    # the saddles: sand concrete blocks with a notch the tank sits in
    for k, sx in enumerate((X0 + 3, X0 + L - 8)):
        g.prism("x", [(0, CZ - 6), (0, CZ + 6), (6, CZ + 6), (6, CZ + 4), (4.5, CZ + 2.5), (4.5, CZ - 2.5), (6, CZ - 4), (6, CZ - 6)], sx, sx + 5, C("sand", 5))
        s = g.solids[-1].mask(g.shape)
        P.mottle(g, s, "sand", 5, cell=2, seed=k)
        P.flat(g, s & (Y < 1), "sand", 4)
        if k == 1:
            P.flat(g, s & (np.abs((X - sx - 2) - (Y - 1) * 0.5) < 0.5) & (Z < CZ - 5), "sand", 2)  # the crack
    # the barrel and its two frustum end caps
    body = disc(g, "x", CY, CZ, R, X0, X0 + L, "gold", 6)
    P.mottle(g, body, "gold", 6, cell=3, seed=3)
    P.flat(g, body & (Y < CY - 3), "gold", 5)
    P.flat(g, body & (Y > CY + R - 2.2), "gold", 7)
    for lo, hi, tip in ((X0 - 5, X0, "lo"), (X0 + L, X0 + L + 5, "hi")):
        c = cone(g, "x", CY, CZ, R, lo, hi, "gold", 5, r_top=R * 0.45, tip=tip)
        P.flat(g, c & (Y > CY + 2), "gold", 6)
    P.flat(g, body & ((np.abs(X - X0 - 0.5) < 0.6) | (np.abs(X - X0 - L + 0.5) < 0.6)), "gold", 4)  # weld seams
    # red safety bands near both ends of the barrel
    for bx in (X0 + 2, X0 + L - 4):
        P.flat(g, body & (X > bx) & (X < bx + 2), "red", 4)
    # rust runs from the saddles
    for rx in (X0 + 5, X0 + L - 6):
        P.flat(g, body & (np.abs(X - rx) < 0.8) & (Y < CY - 2) & (Z < CZ), "rust", 5)
    # the red hazard diamond with a flame, on the front
    d = np.abs(X - (X0 + L / 2)) + np.abs(Y - CY)
    front = body & (Z < CZ - R + 1.5)
    P.flat(g, front & (d < 7.5), "red", 4)
    P.flat(g, front & (d < 6.5), "bone", 7)
    iw, ih = pnglyph.icon_size("flame")
    pnglyph.icon(g, "-z", CZ - R, int(X0 + L / 2 - iw / 2 + 0.5), int(CY - ih / 2 + 0.5), "flame", "red", 4, inks={"+": ("gold", 6)})
    # a gauge on the front, left of the diamond
    gauge = disc(g, "z", X0 + 5, CY + 1, 2.2, CZ - R - 1, CZ - R + 1, "steel", 6)
    P.flat(g, gauge & (Z < CZ - R) & (ngon_radius(g, "z", X0 + 5, CY + 1) < 1.5), "bone", 7)
    P.flat(g, gauge & (Z < CZ - R) & (np.abs(X - X0 - 5) < 0.5) & (Y > CY + 1), "red", 4)
    # collar and brass valve dome on top
    top = CY + R
    col = disc(g, "y", X0 + L / 2, CZ, 4.0, top - 1, top + 3, "steel", 5)
    P.flat(g, col & (Y > top + 2), "steel", 6)
    dome = cone(g, "y", X0 + L / 2, CZ, 2.4, top + 3, top + 6, "gold", 5, r_top=1.2)
    P.flat(g, dome & (Y > top + 5), "gold", 7)
    box(g, X0 + L / 2 + 2, top + 3, CZ - 0.5, X0 + L / 2 + 5, top + 4, CZ + 0.5, "gold", 4)
    tuft(g, X0 + 1, 3, 0, seed=1)
    tuft(g, X0 + L - 2, 14, 0, seed=2)
    return asset("propane-tank", "Propane Tank", root("propane-tank", g))
