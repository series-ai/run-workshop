"""Field telescope, in the Pirate Nation mecha style.

One iconic shape (rule K3): a fat white optical tube on a copper equatorial
head over three splayed steel legs (true diagonals, F2; thick members, F3).
The tube is oversized (F4): an octagonal barrel with an orange trim ring, a
glowing cyan objective lens at the low end, painted plate seams, a chunky
finder scope on its back and a copper focuser with a gold knob. It points up
and a little off axis (F5); a counterweight bar balances it. Detail is paint
(S1). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _props import dots, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, facets, last
from voxgrid import C, Asset, Grid, Part

W, D = 30, 30
CX, CZ = 15, 15
YH = 20  # the head: where the tube pivots
LEG = 10.5  # leg foot radius


def tripod() -> Grid:
    g = Grid(W, YH + 7, D)
    X, Y, Z = coords(g)
    # three splayed legs, each a true diagonal bar with a wide foot pad
    legs = np.zeros(g.shape, dtype=bool)
    for k in range(3):
        a = -math.pi / 2 + 2 * math.pi * k / 3
        fx, fz = CX + LEG * math.cos(a), CZ + LEG * math.sin(a)
        if abs(math.cos(a)) > abs(math.sin(a)):
            legs |= bar(g, "z", (CX + 1.2 * math.cos(a), YH - 2), (fx, 1.5), 2.6, min(CZ, fz) - 1.3, max(CZ, fz) + 1.3, "steel", 5)
        else:
            legs |= bar(g, "x", (YH - 2, CZ + 1.2 * math.sin(a)), (1.5, fz), 2.6, min(CX, fx) - 1.3, max(CX, fx) + 1.3, "steel", 5)
        pad = box(g, fx - 2.5, 0, fz - 2.5, fx + 2.5, 2, fz + 2.5, "steel", 4)
        P.flat(g, pad, "steel", 4)
        P.flat(g, pad & (Y > 1), "steel", 6)
        P.flat(g, edges(pad), "steel", 2)
        P.flat(g, pad & (Y > 1) & (np.abs(X - fx) < 1.2) & (np.abs(Z - fz) < 1.2), "orange", 5)
    P.flat(g, legs, "steel", 5)
    P.flat(g, legs & (Y < 8), "steel", 4)
    P.flat(g, legs & (np.floor(Y) % 6 == 3), "steel", 3)  # clamp collars
    P.flat(g, legs & (np.floor(Y) % 6 == 3) & (np.floor(X + Z) % 3 == 0), "gold", 6)
    # the copper equatorial head and its collar
    n0 = len(g.solids)
    head = ngon_prism(g, "y", CX, CZ, 4.4, YH - 4, YH + 2, "rust", 5)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "rust", 5, size=(5, 4), frame=fr, seed=2)
    P.flat(g, head & (Y > YH + 1), "rust", 6)
    P.flat(g, edges(head), "rust", 3)
    collar = ngon_prism(g, "y", CX, CZ, 5.2, YH - 5, YH - 4, "steel", 4)
    P.flat(g, collar, "steel", 4)
    P.flat(g, collar & (np.floor(X + Z) % 3 == 0), "teal", 5)
    dots(g, head & (Z < CZ - 3.5), "-z", [(CX + 2.5, YH - 1.5)], 1.2, "cyan", 6)
    # the counterweight bar, leaning off axis
    cw = bar(g, "x", (YH + 1, CZ + 3), (YH - 7, CZ + 9), 1.8, CX - 1.0, CX + 1.0, "steel", 5)
    P.flat(g, cw, "steel", 5)
    wt = ngon_prism(g, "y", CX, CZ + 9.0, 2.8, YH - 10, YH - 6, "steel", 4)
    P.flat(g, wt, "steel", 4)
    P.flat(g, wt & (Y > YH - 7), "steel", 6)
    P.flat(g, wt & (np.abs(Y - (YH - 8)) < 0.7), "gold", 6)
    return g


def tube() -> Grid:
    """The oversized optical tube: a faceted white barrel with an orange
    trim ring, a glowing cyan objective, a finder scope and a focuser."""
    g = Grid(14, 32, 14)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    barrel = ngon_prism(g, "y", 7, 7, 5.2, 2, 28, "bone", 6)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "bone", 6, size=(4, 6), frame=fr, seed=3)
    P.flat(g, edges(barrel), "bone", 4)
    # a painted serial band and a dark optical stripe down the tube
    P.flat(g, barrel & (np.abs(Z - 2.0) < 0.8) & (Y > 6) & (Y < 24), "steel", 4)
    pnglyph.text(g, "-z", 1.9, 4, 10, "RVX", "steel", 2, depth=2, reach=3)
    # trim rings and a painted cradle band
    for yy, ramp, sh in ((4, "orange", 5), (16, "teal", 5), (25, "orange", 5)):
        P.flat(g, barrel & (np.abs(Y - yy) < 1.6), ramp, sh)
        P.flat(g, barrel & (np.abs(Y - yy) < 1.6) & (np.floor(X + Z) % 3 == 0), ramp, sh + 1)
        P.flat(g, barrel & (np.abs(Y - (yy - 1.6)) < 0.6), ramp, max(1, sh - 2))
    # the glowing objective lens at the low end
    cell = ngon_prism(g, "y", 7, 7, 5.8, 0, 3, "steel", 4)
    P.flat(g, cell, "steel", 4)
    P.flat(g, edges(cell), "steel", 2)
    P.flat(g, cell & (np.abs(Y - 2.0) < 0.6), "orange", 5)
    lens = ngon_prism(g, "y", 7, 7, 4.4, 0, 1, "cyan", 5)
    P.flat(g, lens, "cyan", 5)
    P.flat(g, lens & (np.hypot(X - 7, Z - 7) < 2.6), "cyan", 6)
    P.flat(g, lens & (np.hypot(X - 5.6, Z - 5.6) < 1.4), "cyan", 7)
    # the eyepiece at the high end
    ngon_prism(g, "y", 7, 7, 3.2, 28, 30, "rust", 5)
    ep = ngon_prism(g, "y", 7, 7, 1.8, 30, 32, "steel", 5)
    P.flat(g, ep, "steel", 5)
    P.flat(g, ep & (Y > 31), "cyan", 7)
    # a chunky finder scope along the back of the barrel
    fs = box(g, 5.5, 18, 11, 8.5, 27, 14, "steel", 5)
    P.flat(g, fs, "steel", 5)
    P.flat(g, edges(fs), "steel", 3)
    P.flat(g, fs & (Y > 26), "cyan", 6)
    P.flat(g, fs & (np.abs(Y - 20) < 0.7), "rust", 5)
    # the copper focuser with a gold knob on the front
    foc = box(g, 5, 20, 0, 9, 25, 3, "rust", 5)
    P.flat(g, foc, "rust", 5)
    P.flat(g, edges(foc), "rust", 3)
    P.flat(g, foc & (Z < 1) & (np.abs(X - 7) < 1.6) & (np.abs(Y - 22.5) < 1.6), "gold", 6)
    return g


def build() -> Asset:
    root = Part("telescope", tripod())
    root.add(Part("tube", tube(), pivot=(7.0, 14.0, 7.0), at=(float(CX), float(YH), float(CZ)), rot=(-38.0, 14.0, 0.0)))
    return Asset(id="space-props-telescope", pack="space", category="props", name="Field Telescope", root=root)
