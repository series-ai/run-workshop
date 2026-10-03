"""Survivor ham radio on a crate, in the Pirate Nation style.

A chunky khaki radio set (rule K3) on a warm plank crate: a big glowing
tuner window with a red needle, three fat dials, a speaker grille and a
telescopic antenna leaning up on a true diagonal (rule F5). A hand mic
hangs off the side on a coiled cord; a battery pack sits by the crate.
Dials, grille, needle and stencils are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, crate, root
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import Grid

RX0, RX1, RY0, RY1, RZ0, RZ1 = 3, 21, 12, 23, 4, 14  # radio set


def build():
    g = Grid(26, 40, 18)
    X, Y, Z = coords(g)
    crate(g, 2, 0, 3, 20, 12, 13, "sand", 5, seed=1)
    # the radio set
    rad = box(g, RX0, RY0, RZ0, RX1, RY1, RZ1, "khaki", 5)
    P.flat(g, edges(rad), "khaki", 3)
    P.flat(g, rad & (Y > RY1 - 1) & ~edges(rad), "khaki", 6)
    front = rad & (Z < RZ0 + 1)
    # tuner window: glowing gold with a scale and a red needle
    win = front & (X > RX0 + 1) & (X < RX0 + 11) & (Y > RY1 - 6) & (Y < RY1 - 1)
    P.flat(g, win, "gold", 6)
    P.flat(g, win & (np.floor(X) % 2 == 0) & (Y > RY1 - 3), "gold", 4)
    P.flat(g, win & (np.abs(X - RX0 - 7) < 0.6), "red", 4)
    P.outline(g, win, "khaki", 2, normal="z")
    # three fat dials
    for k, dx in enumerate((RX0 + 3, RX0 + 7.5, RX0 + 12)):
        d = disc(g, "z", dx, RY0 + 3, 1.8, RZ0 - 1, RZ0, "steel", 6)
        P.flat(g, d & (np.abs(X - dx) < 0.5) & (Y > RY0 + 3), "steel", 3)
    # speaker grille on the right of the front
    P.flat(g, front & (X > RX1 - 6) & (X < RX1 - 1) & (Y > RY0 + 1) & (Y < RY1 - 1) & (np.floor(Y) % 2 == 0), "khaki", 3)
    # a little red power lamp
    P.flat(g, front & (np.abs(X - RX1 + 3.5) < 0.6) & (np.abs(Y - RY1 + 1.5) < 0.6), "red", 5)
    # antenna: a leaning telescopic mast with a ball tip
    bar(g, "z", (RX1 - 3, RY1), (RX1 + 1.5, 38.0), 1.6, RZ1 - 3, RZ1 - 2, "steel", 6)
    box(g, RX1 - 4, RY1, RZ1 - 4, RX1 - 1, RY1 + 2, RZ1 - 1, "steel", 4)
    disc(g, "z", RX1 + 1.5, 38.0, 1.2, RZ1 - 3.5, RZ1 - 1.5, "red", 5)
    # the hand mic hanging off the -x side on a coiled cord
    for k in range(3):
        box(g, RX0 - 1, RY1 - 3 - k * 2, 8, RX0, RY1 - 2 - k * 2, 10, "darkwood", 5)
    mic = box(g, RX0 - 3, 11, 7, RX0, 15, 11, "steel", 4)
    P.flat(g, mic & (Y > 13) & (X < RX0 - 2), "steel", 6)
    # a battery pack by the crate
    bat = box(g, 22, 0, 2, 26, 6, 9, "red", 5)
    P.flat(g, bat & (Y > 5), "red", 6)
    box(g, 23, 6, 3, 24, 7, 4, "steel", 6)
    box(g, 23, 6, 7, 24, 7, 8, "gold", 6)
    pnglyph.text(g, "+x", 26, 3, 1, "+", "bone", 7)
    return asset("radio", "Ham Radio", root("radio", g))
