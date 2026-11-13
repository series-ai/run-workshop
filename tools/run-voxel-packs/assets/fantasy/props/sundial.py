"""Garden sundial in the Pirate Nation style.

A fluted column in the theme's grey-blue stone stands on two octagonal
steps, each with painted block joints and a dark rim. It carries the
oversized function prop (rules F4 and K3): a pale dial plate ringed with
gold hour marks under a tall gold gnomon that sits on its own framed base
plate, with no block driven through it. Carved cyan runes band the column
and moss is painted into the stone in two shades, with grass sprigs on the
ground rather than cubes stuck to the rim. About 26 across and 24 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords, tufts
from pnkit import box, edges
from pnshapes import cone, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 28, 32, 28
CX, CZ = 14, 14
S0, S1, COL, DIAL = 3, 6, 18, 21  # step tops, column top, dial top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    ang = np.arctan2(Z - CZ, X - CX)
    d = np.hypot(X - CX, Z - CZ)

    # two octagonal steps in theme stone, with painted joints and dark rims
    s0 = disc(g, "y", CX, CZ, 12.0, 0, S0, "stone", 3, n=8)
    P.stone(g, s0, "stone", 3, block=(5, 3), mortar=-2, seed=1)
    P.flat(g, s0 & (Yi == S0 - 1), "stone", 4)
    P.stone(g, s0 & (Yi == S0 - 1), "stone", 4, block=(5, 5), mortar=-2, frame="top", seed=2)
    P.flat(g, s0 & (Yi == 0), "stone", 1)
    P.flat(g, s0 & (Yi == S0 - 1) & (d > 11.0), "stone", 2)
    s1 = disc(g, "y", CX, CZ, 9.0, S0, S1, "stone", 4, n=8)
    P.stone(g, s1, "stone", 4, block=(4, 2), mortar=-2, seed=3)
    P.flat(g, s1 & (Yi == S1 - 1), "stone", 5)
    P.stone(g, s1 & (Yi == S1 - 1), "stone", 5, block=(4, 4), mortar=-2, frame="top", seed=4)
    P.flat(g, s1 & (Yi == S0), "stone", 2)

    # the fluted column, with painted courses and a carved rune band
    col = cone(g, "y", CX, CZ, 5.6, S1, COL, "stone", 5, n=8, r_top=4.4)
    flute = np.floor((ang + math.pi) / (2 * math.pi) * 16).astype(int)
    P.flat(g, col, "stone", 5)
    P.flat(g, col & (flute % 2 == 0), "stone", 4)
    P.flat(g, col & (flute % 4 == 1), "stone", 6)  # the lit arris of every flute
    P.flat(g, col & (((Yi - S1) % 5) == 0), "stone", 2)  # course joints
    P.flat(g, col & (Yi == S1), "stone", 2)
    band = col & (Yi > S1 + 3) & (Yi < S1 + 7)
    P.flat(g, band, "stone", 3)
    P.flat(g, band & (flute % 2 == 0) & (Yi == S1 + 5), "cyan", 6)
    P.flat(g, band & (flute % 4 == 1) & (Yi == S1 + 4), "cyan", 5)
    P.flat(g, col & (Yi == S1 + 3), "stone", 2)
    P.flat(g, col & (Yi == S1 + 7), "stone", 2)
    neck = disc(g, "y", CX, CZ, 5.2, COL, COL + 2, "stone", 4, n=8)
    P.flat(g, neck, "stone", 4)
    P.flat(g, neck & (Yi == COL + 1), "stone", 5)
    P.flat(g, neck & (Yi == COL), "stone", 2)

    # the dial plate: pale stone with a gold rim and engraved hour marks
    plate = disc(g, "y", CX, CZ, 8.0, COL + 2, DIAL, "stone", 6, n=8)
    P.flat(g, plate, "stone", 6)
    P.flat(g, plate & (Yi == COL + 2), "stone", 2)
    face = plate & (Yi == DIAL - 1)
    P.flat(g, face, "stone", 7)
    P.flat(g, face & (d > 6.8), "gold", 6)
    P.flat(g, face & (d > 7.6), "gold", 4)
    for k in range(12):  # engraved radial hour lines, longer at the quarters
        a = 2 * math.pi * k / 12
        off = np.abs(((ang - a + math.pi) % (2 * math.pi)) - math.pi) * d
        r0 = 4.4 if k % 3 == 0 else 5.6
        P.flat(g, face & (off < 0.7) & (d > r0) & (d < 6.7), "stone", 3)
    P.flat(g, face & (d < 1.6), "gold", 7)

    # the gnomon: a framed gold triangle standing on its own base plate
    plinth = box(g, CX - 2, DIAL, CZ - 6, CX + 2, DIAL + 1, CZ + 5, "gold", 4)
    P.flat(g, plinth, "gold", 4)
    P.flat(g, plinth & ((Zi == CZ - 6) | (Zi == CZ + 4)), "gold", 3)
    g.prism("x", [(DIAL + 1, CZ - 5.5), (DIAL + 9, CZ + 4.5), (DIAL + 1, CZ + 4.5)], CX - 1, CX + 1, C("gold", 6))
    gn = last(g)
    P.flat(g, gn, "gold", 6)
    P.flat(g, gn & (Zi < CZ), "gold", 5)
    P.flat(g, gn & (Yi == DIAL + 1), "gold", 3)
    P.outline(g, gn, "gold", 3, normal="x")
    P.flat(g, gn & (np.abs((Y - (DIAL + 1)) - (Z - (CZ - 5.5)) * 0.8) < 0.8) & (Zi > CZ - 3), "gold", 7)

    # moss painted into the stone, and grass sprigs on the ground
    for mx, mz in ((CX - 8, CZ + 4), (CX + 5, CZ - 6), (CX + 2, CZ + 8)):
        md = np.hypot(X - mx, Z - mz)
        core = (g.a > 0) & (md < 2.0) & (Yi < S1)
        fringe = (g.a > 0) & (md >= 2.0) & (md < 3.4) & (Yi < S1) & ((((Xi * 3) + (Zi * 5)) % 3) != 0)
        patch = core | fringe
        P.flat(g, patch, "moss", 4)
        P.flat(g, patch & (((Xi + Zi) % 2) == 0), "moss", 5)
        P.flat(g, fringe, "moss", 3)
    ivy = (g.a > 0) & (Yi < S1 + 6) & (Yi > S1) & (np.abs((X - CX) + 4 - (Yi % 3)) < 1.2) & (Z < CZ)
    P.flat(g, ivy, "moss", 4)
    P.flat(g, ivy & ((Yi % 2) == 0), "moss", 5)
    tufts(g, [(CX - 13, CZ - 2), (CX + 11, CZ + 3), (CX - 3, CZ + 12)], ramp="leaf",
          flowers=[("gold", 6), ("red", 5), ("cyan", 6)])

    root = Part("sundial", g)
    return Asset(id="fantasy-props-sundial", pack="fantasy", category="props", name="Sundial", root=root)
