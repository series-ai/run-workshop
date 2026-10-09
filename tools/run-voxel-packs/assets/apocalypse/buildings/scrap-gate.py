"""Fortified road gate made from a salvaged bridge frame."""
import numpy as np

import paint as P
import pnglyph
import pnpaint as PP
import pnshapes as S
from _life import ctr, make
from _rep_bld import patchwork
from pnkit import box, edges
from voxgrid import C, Grid, Part

SIZE = (128, 108, 52)


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    apron = box(g, 0, 0, 0, 128, 5, 52, "sand", 4)
    PP.concrete(g, apron, "sand", 4, size=12, cracks=12, frame="top", seed=1)
    P.flat(g, edges(apron), "stone", 2)
    # Two stone towers hold the full width gate beam.
    for x0 in (8, 92):
        pier = box(g, x0, 5, 13, x0 + 28, 78, 40, "stone", 5)
        # Scrap sheets clad the tower, so it reads as salvage, not a castle.
        patchwork(g, pier, ramps=(("rust", 4), ("steel", 5), ("teal", 3), ("steel", 3), ("red", 3)), cell=(17, 14), seed=x0)
        P.flat(g, edges(pier), "darkwood", 3)
        # A stack of tyres leans on the tower foot.
        for k in range(3):
            S.tyre(g, "y", x0 + 14, 7, 6.5, 5 + 4 * k, 9 + 4 * k, n=8)
        # Rebar spikes stick out of the tower top.
        for k, dx in enumerate((4, 12, 20)):
            S.bar(g, "z", (x0 + dx, 74), (x0 + dx + (k - 1) * 3, 90 + 3 * (k % 2)), 1.4, 24 + k, 26 + k, "rust", 3)
        for px in (x0 + 2, x0 + 22):
            post = box(g, px, 5, 10, px + 4, 80, 14, "rust", 5)
            P.plates(g, post, "rust", 5, size=(7, 8), seed=px)
        g.prism("z", [(x0 - 3, 75), (x0 + 31, 75), (x0 + 14, 102)], 10, 43, C("steel", 5))
        cap = S.last(g)
        PP.corrugate(g, cap, "steel", 5, period=4, sheet=12, seed=x0)
        P.flat(g, cap & (Y > 78) & (Y < 81), "gold", 6)
        for zz in (18, 30):
            win = box(g, x0 + 7, 45, zz, x0 + 20, 60, zz + 2, "teal", 4)
            P.outline(g, win, "iron", 3, normal="z")
            for barx in range(x0 + 9, x0 + 20, 4):
                box(g, barx, 46, zz - 1, barx + 1, 59, zz, "steel", 5)
    g.prism("z", [(30, 68), (98, 68), (64, 96)], 12, 40, C("steel", 5))
    beam = S.last(g)
    P.plates(g, beam, "steel", 5, size=(10, 7), seed=3)
    P.flat(g, edges(beam), "darkwood", 3)
    for x0 in range(34, 96, 14):
        brace = S.bar(g, "z", (x0, 68), (x0 + 8, 84), 2.4, 10, 13, "rust", 5)
        P.flat(g, brace, "gold", 6)
    # Two framed steel leaves block the road. Their angled ends show the hinges.
    for x0, swing in ((39, -4), (67, 4)):
        leaf = box(g, x0, 7, 10, x0 + 21, 58, 14, "wood", 5)
        P.planks(g, leaf, "wood", 5, width=4, across="y", seed=x0)
        P.flat(g, edges(leaf), "steel", 4)
        for px in (x0, x0 + 17):
            box(g, px, 7, 8, px + 4, 60, 10, "steel", 5)
        for yy in range(12, 57, 9):
            box(g, x0 + 3, yy, 7, x0 + 18, yy + 2, 9, "gold", 5)
        if swing:
            P.flat(g, leaf & (np.abs(X - (x0 + 19)) < 2), "red", 5)
    sign = box(g, 40, 84, 8, 88, 107, 12, "bone", 6)
    P.outline(g, sign, "darkwood", 4, normal="z")
    pnglyph.text(g, "-z", 7, 52, 97, "SAFE", "red", 4, scale=1, gap=1)
    pnglyph.text(g, "-z", 7, 52, 88, "ZONE", "darkwood", 4, scale=1, gap=1)
    # The skulls sit beside the words. They do not cover the text.
    for u0 in (42, 77):
        pnglyph.icon(g, "-z", 7, u0, 92, "skull", "darkwood", 3, scale=1)
    # A signal flag and three grounded road props finish the gate.
    box(g, 26, 80, 22, 29, 103, 25, "steel", 5)
    g.prism("z", [(27, 97), (40, 95), (40, 102), (27, 103)], 22, 25, C("red", 5))
    S.disc(g, "y", 28, 20, 8, 5, 18, "red", 5, n=8)
    S.tyre(g, "y", 102, 28, 8, 5, 10, rubber=("gray", 3), hub=("steel", 5))
    crate = box(g, 91, 5, 3, 106, 18, 13, "sand", 5)
    P.planks(g, crate, "sand", 5, width=4, across="y", nails=True, seed=8)
    P.flat(g, edges(crate), "darkwood", 3)
    return make("buildings", "scrap-gate", "Scrap Road Gate", Part("scrap-gate", g))
