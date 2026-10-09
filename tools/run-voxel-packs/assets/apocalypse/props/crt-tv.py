"""Old CRT television on a milk crate, in the Pirate Nation style.

One chunky icon (rule K3): a wood-grain cabinet whose tube housing tapers
back as a true frustum, with a big glowing teal screen full of painted
static and a crack, two brass knobs and a speaker grille. Rabbit-ear
antennas splay from the top on true diagonals (rule F5). It stands on a
red milk crate; a cable drops to the ground. Grain, static, slots and the
crack are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, root
from pnkit import box, edges
from pnshapes import bar, coords, disc
from voxgrid import C, Grid

CX0, CX1, CZ0, CZ1, CH = 2, 18, 3, 17, 11  # crate
TX0, TX1, TY0, TY1, TZ0, TZ1 = 1, 19, CH, CH + 15, 2, 12  # cabinet front block


def build():
    g = Grid(21, 40, 24)
    X, Y, Z = coords(g)
    # the red milk crate with painted slots
    crate = box(g, CX0, 0, CZ0, CX1, CH, CZ1, "red", 5)
    P.flat(g, edges(crate), "red", 3)
    slots = crate & (((np.floor(X) - CX0) % 4 == 2) | ((np.floor(Z) - CZ0) % 4 == 2)) & (Y > 2) & (Y < CH - 2)
    P.flat(g, slots & ~edges(crate), "red", 2)
    # the cabinet (wood grain) and the tapered tube housing behind it
    cab = box(g, TX0, TY0, TZ0, TX1, TY1, TZ1, "rust", 5)
    P.planks(g, cab, "rust", 5, width=3, across="y", length=(40, 41), nails=False, seed=1)
    P.flat(g, edges(cab), "rust", 3)
    g.prism("z", [(TX0 + 1, TY0 + 1), (TX1 - 1, TY0 + 1), (TX1 - 1, TY1 - 1), (TX0 + 1, TY1 - 1)], TZ1, TZ1 + 7, C("rust", 4),
            top=[(TX0 + 5, TY0 + 3), (TX1 - 5, TY0 + 3), (TX1 - 5, TY1 - 5), (TX0 + 5, TY1 - 5)])
    back = g.solids[-1].mask(g.shape)
    P.flat(g, back & (np.floor(Y) % 3 == 0) & (Z > TZ1 + 4), "rust", 3)  # vents
    # the screen: 1 voxel proud, painted static in soft bands, a crack and a glint
    scr = box(g, TX0 + 2, TY0 + 3, TZ0 - 1, TX1 - 5, TY1 - 2, TZ0, "teal", 5)
    band = (np.floor(Y) % 3 == 0)
    noise = (P._hash(np.floor(X) // 2, np.floor(Y), seed=4) % np.uint64(5)) == 0
    P.flat(g, scr & band, "teal", 6)
    P.flat(g, scr & noise, "teal", 7)
    P.flat(g, scr & noise & ~band & ((np.floor(X) + np.floor(Y)) % 2 == 0), "teal", 4)
    crack = scr & ((np.abs((X - 6) - 0.9 * (Y - (TY0 + 9))) < 0.6) | (np.abs((X - 6) + 1.2 * (Y - (TY0 + 9))) < 0.6) & (X > 6))
    P.flat(g, crack & (np.hypot(X - 6, Y - TY0 - 9) < 4.5), "bone", 7)
    P.outline(g, scr, "rust", 2, normal="z")
    # the control panel: two brass knobs and a speaker grille
    for ky in (TY1 - 5, TY1 - 9):
        k = disc(g, "z", TX1 - 2.5, ky, 1.5, TZ0 - 2, TZ0, "gold", 5)
        P.flat(g, k & (Z < TZ0 - 1.5) & (np.abs(X - TX1 + 2.5) < 0.5), "gold", 7)
    P.flat(g, cab & (Z < TZ0 + 1) & (X > TX1 - 4) & (X < TX1 - 1) & (Y > TY0 + 2) & (Y < TY0 + 6) & (np.floor(Y) % 2 == 0), "rust", 3)
    # rabbit ears on a little base (true diagonals with brass tips)
    base = box(g, 8, TY1, 6, 13, TY1 + 2, 10, "steel", 5)
    for p1 in ((3.0, TY1 + 10.5), (17.5, TY1 + 9.0)):
        bar(g, "z", (10.5, TY1 + 1.5), p1, 1.2, 7.5, 8.5, "steel", 6)
        disc(g, "z", p1[0], p1[1], 1.1, 7, 9, "gold", 6)
    # a cable from the back down to the ground
    bar(g, "x", (TY0 + 4, TZ1 + 5), (1.0, 21.0), 1.4, 15, 16.5, "darkwood", 5)
    return asset("crt-tv", "Broken CRT TV", root("crt-tv", g))
