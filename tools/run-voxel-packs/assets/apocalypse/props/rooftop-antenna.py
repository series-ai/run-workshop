"""Scrap radio mast, in the Pirate Nation style.

One function, built from four big volumes (rules F1, F6): a steel relay
cabinet on a concrete pad, a tapered mast growing straight out of it, an
oversized dish on a braced arm, and a signal-red beacon at the tip. The
cabinet carries the identity up close: a zombie-teal screen in a dark
frame, a red breaker switch and a hazard-yellow band at its foot (rule C3).
Three aerial elements sit in visible clamp collars, and both guy wires end
on anchor plates bolted to the pad, so nothing passes through anything.
Plate seams, rungs, the dish grid and three rust blooms are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, root, rust_runs, tuft
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import C, Grid

GW, GH, GD = 24, 40, 24
CX, CZ = 12.0, 12.0
BX0, BX1, BZ0, BZ1 = 4, 18, 6, 18  # the relay cabinet
BY0, BY1 = 3, 17
MY0, MY1 = 17, 34  # the mast


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the concrete pad, with its grass growing out of the plate itself
    pad = box(g, 1, 0, 1, 23, 3, 23, "stone", 5)
    pnpaint.concrete(g, pad, "stone", 5, size=10, cracks=6, seed=1)
    P.flat(g, edges(pad), "stone", 3)
    tuft(g, 20, 4, y0=3, ramp="khaki", seed=3)
    tuft(g, 3, 20, y0=3, ramp="khaki", seed=4)
    # the relay cabinet: the main volume, calm steel with a dark frame
    cab = box(g, BX0, BY0, BZ0, BX1, BY1, BZ1, "steel", 6)
    P.plates(g, cab, "steel", 6, size=(9, 8), seed=2)
    P.flat(g, cab & (Y > BY1 - 2), "steel", 7)  # the lit roof
    P.flat(g, edges(cab), "steel", 2)
    # one clean hazard band across the front foot, in hazard yellow
    pnpaint.hazard(g, cab & (Y < BY0 + 5) & (Z < BZ0 + 1), period=8, a=("gold", 4), b=("darkwood", 2), frame="z")
    P.flat(g, cab & (np.abs(Y - (BY0 + 5)) < 0.6) & (Z < BZ0 + 1), "steel", 2)
    rust_runs(g, cab, ((BX0, BY1 - 3, BZ0 + 4, 3.2), (BX1, BY0 + 2, BZ1 - 4, 2.4)), base=5, drip=4, seed=6)
    # the zombie-teal screen in a dark frame, the one glowing accent
    scr = cab & (Z < BZ0 + 1) & (X > BX0 + 1) & (X < BX1 - 4) & (Y > BY0 + 6) & (Y < BY1 - 1)
    P.flat(g, scr, "teal", 4)
    P.flat(g, scr & (np.floor(Y) % 3 == 0), "teal", 5)
    P.flat(g, scr & (Y > BY1 - 3), "teal", 6)
    P.outline(g, scr, "darkwood", 2, normal="z")
    sw = cab & (Z < BZ0 + 1) & (X > BX1 - 4) & (X < BX1 - 1) & (Y > BY0 + 8) & (Y < BY1 - 3)
    P.flat(g, sw, "red", 5)
    P.outline(g, sw, "darkwood", 2, normal="z")
    # the hazard-yellow warning plate on the +x side, sized to its bolt icon
    iw, ih = pnglyph.icon_size("bolt")
    pz, py = BZ0 + 1, BY0 + 3
    wp = cab & (X > BX1 - 1) & (Z >= pz) & (Z < pz + iw + 2) & (Y >= py) & (Y < py + ih + 2)
    P.flat(g, wp, "gold", 4)
    P.outline(g, wp, "darkwood", 2, normal="x")
    pnglyph.icon(g, "+x", BX1, pz + 1, py + 1, "bolt", "darkwood", 1, depth=2)

    # the tapered mast, one solid volume out of the cabinet roof
    g.prism("y", [(9, 9), (15, 9), (15, 15), (9, 15)], MY0, MY1, C("steel", 5), top=[(10, 10), (14, 10), (14, 14), (10, 14)])
    mast = g.solids[-1].mask(g.shape)
    P.flat(g, mast, "steel", 5)
    P.flat(g, edges(mast), "steel", 2)
    for ry in range(MY0 + 3, MY1 - 1, 4):  # painted rungs up the mast
        P.flat(g, mast & (np.abs(Y - ry) < 0.6), "steel", 7)
    rust_runs(g, mast, ((9, MY0 + 5, 11, 2.6), (15, MY0 + 12, 13, 2.2)), base=5, drip=5, seed=7)
    # the dish on a braced arm, looking out over the -z side
    for by, th in ((26.0, 1.6), (21.0, 1.4)):  # the arm and its brace
        bar(g, "x", (by, CZ - 2.0), (24.0, CZ - 7.0), th, int(CX) - 1, int(CX) + 2, "steel", 5)
    for gx, gy, gz in ((int(CX) - 2, 24, int(CZ) - 4), (int(CX) - 2, 20, int(CZ) - 3)):  # the gussets that join it
        gus = box(g, gx, gy, gz, gx + 4, gy + 3, gz + 3, "steel", 6)
        P.flat(g, edges(gus), "steel", 3)
    dish = disc(g, "z", CX, 25.0, 6.5, int(CZ) - 10, int(CZ) - 8, "steel", 6, n=10)
    dd = np.hypot(X - CX, Y - 25)
    P.flat(g, dish & (dd > 5.2), "steel", 2)  # the rim
    P.flat(g, dish & (dd < 5.2), "steel", 7)
    P.flat(g, dish & (dd < 5.2) & (np.floor(X + Y) % 4 == 0), "steel", 5)  # the grid
    P.flat(g, dish & (dd < 2.0), "teal", 4)  # the feed horn, on palette
    horn = box(g, int(CX) - 1, 24, int(CZ) - 13, int(CX) + 2, 27, int(CZ) - 10, "steel", 4)
    P.flat(g, edges(horn), "steel", 2)
    # two aerial elements, each in a clamp collar no wider than the mast
    for ay, half in ((29, 10.0), (33, 7.0)):
        collar = box(g, 10, ay - 1, 10, 14, ay + 2, 14, "steel", 7)
        P.flat(g, edges(collar), "steel", 3)
        el = box(g, int(CX - half), ay, int(CZ) - 1, int(CX + half), ay + 2, int(CZ) + 2, "steel", 6)
        P.flat(g, el & (Y > ay + 1), "steel", 7)
        P.flat(g, edges(el), "steel", 2)
    # the guy wires, each ending on an anchor plate bolted to the pad
    for gz, gx in ((CZ + 9, CX), (CZ - 8, CX - 8)):
        bar(g, "x", (30.0, CZ), (4.0, float(gz)), 0.9, int(gx), int(gx) + 1, "steel", 3)
        anc = box(g, int(gx) - 2, 3, int(gz) - 2, int(gx) + 2, 5, int(gz) + 2, "steel", 6)
        P.flat(g, edges(anc), "steel", 3)
    # a weathered-wood cable drum at the pad corner (wood and sand, rule C1)
    sp = disc(g, "x", 6.0, 18.0, 3.4, 3, 9, "wood", 5, n=8)
    P.flat(g, sp & (np.hypot(Y - 6, Z - 18) < 2.2), "rust", 5)  # the cable on it
    P.flat(g, sp & (X > 6), "wood", 4)
    P.outline(g, sp, "darkwood", 2, normal="x")
    # the signal-red beacon at the tip, in a dark cage
    beac = disc(g, "y", CX, CZ, 3.2, MY1, MY1 + 4, "red", 4, n=8)
    P.flat(g, beac & (Y > MY1 + 1), "red", 5)
    P.flat(g, beac & (Y < MY1 + 1), "steel", 3)
    for cy in (MY1 + 2,):
        P.flat(g, beac & (np.abs(Y - cy) < 0.6), "darkwood", 2)  # the cage band
    P.flat(g, beac & (Y > MY1 + 3) & (np.hypot(X - CX, Z - CZ) < 1.6), "gold", 6)  # the lit bulb
    P.outline(g, beac, "darkwood", 2, normal="y")
    return asset("rooftop-antenna", "Scrap Radio Mast", root("rooftop-antenna", g))
