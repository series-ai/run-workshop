"""Wine press in the Pirate Nation style.

A slatted basket tub on a heavy timber bed, with the oversized function
prop above it (rule F4): a gold-banded screw under a crossbeam with two
turned handles. Purple must runs from a carved spout into a catch pail,
grapes heap in the tub and a crate of bunches stands at the foot. About
34 wide and 38 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords, plank_box
from pnkit import box
from pnshapes import cone, disc, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 36, 40, 30
CX, CZ = 16, 18
BED = 6  # the top of the bed
TUB = 19  # the tub rim
STAVES = 12


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    ang = np.arctan2(Z - CZ, X - CX)

    # the timber bed on four short feet, with a lipped draining deck
    for fx in (3, 24):
        for fz in (8, 23):
            foot = box(g, fx, 0, fz, fx + 5, 3, fz + 5, "darkwood", 4)
            P.planks(g, foot, "darkwood", 4, width=4, across="x", nails=False, seed=fx + fz)
    bed = plank_box(g, 1, 3, 6, 31, BED, 30, "wood", 6, across="y", width=4, seed=1)
    P.flat(g, bed & (Yi == BED - 1), "wood", 7)
    P.flat(g, bed & (Yi == 3), "darkwood", 3)
    deck = (g.a > 0) & (Yi == BED - 1) & (np.hypot(X - CX, Z - CZ) < 12.5)
    P.flat(g, deck, "magenta", 4)  # must-stained boards
    P.flat(g, deck & (np.hypot(X - CX, Z - CZ) < 9.0), "magenta", 5)

    # the slatted basket tub
    tub = cone(g, "y", CX, CZ, 11.0, BED, TUB, "wood", 6, n=STAVES, r_top=10.0)
    P.flat(g, tub, "wood", 6)
    stave = np.floor((ang + math.pi) / (2 * math.pi) * STAVES).astype(int)
    P.flat(g, tub & (stave % 2 == 0), "wood", 7)
    P.flat(g, tub & (((Yi - BED) % 4) == 0), "darkwood", 3)  # the slat gaps
    for hy in (BED + 2, TUB - 4):  # iron hoops
        P.flat(g, tub & (Yi >= hy) & (Yi < hy + 2), "iron", 4)
        P.flat(g, tub & (Yi == hy + 1), "iron", 5)
    P.flat(g, tub & (Yi == TUB - 1), "wood", 7)

    # the grape heap inside the tub
    for hx, hz, hr, hy in ((CX - 3, CZ - 2, 6.0, TUB - 1), (CX + 4, CZ + 3, 5.0, TUB), (CX, CZ + 5, 4.0, TUB - 1)):
        heap = disc(g, "y", hx, hz, hr, hy, hy + 3, "purple", 4, n=8)
        P.flat(g, heap & (Yi > hy + 1), "purple", 5)
        P.flat(g, heap & (((Xi + Zi) % 4) == 0) & (Yi > hy + 1), "purple", 6)
        P.flat(g, heap & (Yi == hy), "purple", 3)

    for sx, sz in ((CX - 7, CZ - 7), (CX + 6, CZ - 6)):
        spill = disc(g, "y", sx, sz, 3.0, TUB - 2, TUB + 2, "purple", 4, n=6)
        P.flat(g, spill & (Yi > TUB), "purple", 5)
        P.flat(g, spill & (((Xi + Zi) % 3) == 0) & (Yi > TUB - 1), "purple", 6)

    # the pressing plate, the gold-banded screw and the crossbeam
    plate = disc(g, "y", CX, CZ, 9.0, TUB + 2, TUB + 4, "wood", 7, n=STAVES)
    P.planks(g, plate, "wood", 7, width=3, across="y", frame="top", nails=True, seed=2)
    P.flat(g, plate & (Yi == TUB + 2), "darkwood", 3)
    screw = box(g, CX - 2, TUB + 4, CZ - 2, CX + 2, 33, CZ + 2, "wood", 7)
    P.flat(g, screw, "wood", 7)
    P.flat(g, screw & ((Yi % 3) == 0), "gold", 5)  # the screw thread
    P.flat(g, screw & ((Yi % 3) == 1), "wood", 6)
    beam = box(g, 2, 33, CZ - 3, 30, 36, CZ + 3, "darkwood", 5)
    P.planks(g, beam, "darkwood", 5, width=3, across="y", frame="wall", nails=True, seed=3)
    P.flat(g, beam & (Yi > 34), "wood", 5)
    for hx in (1, 29):  # turned handles
        h = disc(g, "x", 34.5, CZ, 2.4, hx, hx + 4, "wood", 7, n=6)
        P.flat(g, h, "wood", 7)
        P.flat(g, h & ((Xi % 2) == 0), "wood", 6)
        P.flat(g, h & ((Xi == hx) | (Xi == hx + 3)), "gold", 5)

    # the spout and the catch pail
    spout = box(g, CX - 2, BED - 2, 3, CX + 2, BED, 8, "wood", 7)
    P.flat(g, spout, "wood", 7)
    P.flat(g, spout & (Zi < 6), "magenta", 5)
    P.flat(g, (g.a > 0) & (np.abs(X - CX) < 1.1) & (Yi > 6) & (Yi < 10) & (Zi == 3), "magenta", 6)
    pail = disc(g, "y", CX, 4, 4.0, 0, 7, "wood", 6, n=8)
    P.planks(g, pail, "wood", 6, width=2, across="x", frame="wall", nails=False, seed=4)
    P.flat(g, pail & ((Yi == 1) | (Yi == 5)), "iron", 4)
    P.flat(g, pail & (Yi > 5) & (np.hypot(X - CX, Z - 4) < 2.8), "magenta", 5)
    P.flat(g, pail & (Yi > 5) & (np.hypot(X - CX, Z - 4) < 1.4), "magenta", 6)

    # a crate of bunches at the foot
    crate = box(g, 26, 3, 21, 35, 11, 28, "wood", 6)
    P.planks(g, crate, "wood", 6, width=3, across="y", frame="wall", nails=True, seed=5)
    P.outline(g, crate, "darkwood", 3)
    for bx, bz in ((28, 23), (32, 25), (29, 26)):
        b = disc(g, "y", bx, bz, 2.4, 11, 14, "purple", 4, n=6)
        P.flat(g, b & (Yi > 12), "purple", 5)
        P.flat(g, b & (((Xi + Zi) % 3) == 0) & (Yi > 12), "purple", 6)
        P.flat(g, (g.a > 0) & (np.abs(X - bx) < 0.7) & (Yi > 13) & (Yi < 16) & (np.abs(Z - bz) < 0.7), "leaf", 4)

    root = Part("wine-press", g)
    return Asset(id="fantasy-props-wine-press", pack="fantasy", category="props", name="Wine Press", root=root)
