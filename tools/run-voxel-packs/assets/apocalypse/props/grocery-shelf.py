"""Looted grocery shelf, in the Pirate Nation style.

A person-size icon (rules K3, F6): a steel gondola whose three shelves stop
against the back panel, so nothing pierces it and nothing hangs in the air.
The back panel is plated and streaked with rust on both faces; a stencilled
valance crowns the frame. What is left of the stock is oversized: a
signal-red can tower, a hazard-yellow box and a zombie-teal bottle (rule
C3). One box has fallen in the dust at the foot. Plates, rivets, labels and
rust are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, chips, root, rust_wear, weeds
from pnkit import box, edges
from pnshapes import coords, disc
from voxgrid import Grid

GW, GH, GD = 38, 40, 22
X0, X1, Z0, Z1 = 2, 34, 4, 18  # the frame
BZ = Z1 - 3  # the inner face of the back panel
SHELVES = (9, 19, 29)


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, X1 + 1, Z0 + 2, seed=1)
    # the back panel and the two end posts
    back = box(g, X0, 0, BZ, X1, 36, Z1, "steel", 5)
    P.plates(g, back, "steel", 5, size=(8, 7), seed=2)
    P.flat(g, edges(back), "steel", 2)
    posts = np.zeros(g.shape, dtype=bool)
    for px in (X0, X1 - 4):
        posts |= box(g, px, 0, Z0, px + 4, 36, Z1, "steel", 4)
    P.plates(g, posts, "steel", 4, size=(5, 8), seed=3)
    P.flat(g, edges(posts), "steel", 2)
    rust_wear(g, back | posts, seed=4, shade=5, run=6, grime=4)
    chips(g, back, ((X0 + 6, 12, Z1, 4.0), (X1 - 8, 26, Z1, 3.4), (18, 4, BZ, 3.0), (X0 + 10, 30, BZ, 2.8)), "rust", 5, seed=5)
    # the three shelves: they stop at the back panel and sit between the posts
    shelves = np.zeros(g.shape, dtype=bool)
    for sy in SHELVES:
        s = box(g, X0 + 4, sy, Z0, X1 - 4, sy + 2, BZ, "steel", 6)
        P.plates(g, s, "steel", 6, size=(6, 4), seed=sy, frame="top")
        P.flat(g, s & (Z < Z0 + 1), "steel", 3)  # the dark front lip
        shelves |= s
    P.flat(g, edges(shelves), "steel", 3)
    # the valance over the top, with a stencil
    val = box(g, X0, 36, Z0, X1, 40, Z1, "steel", 4)
    P.plates(g, val, "steel", 4, size=(7, 4), seed=6)
    P.flat(g, edges(val), "steel", 2)
    pnpaint.hazard(g, val & (Y < 37) & ((Z < Z0 + 1) | (Z > Z1 - 1)), period=4, a=("gold", 7), b=("darkwood", 3), frame="wall")
    P.flat(g, val & (Y > 39), "steel", 6)
    tw, _ = pnglyph.text_size("FOOD")
    pnglyph.text(g, "-z", Z0, X0 + (X1 - X0 - tw) // 2, 37, "FOOD", "gold", 7)
    pnglyph.text(g, "+z", Z1, X0 + (X1 - X0 - tw) // 2, 37, "FOOD", "gold", 7)
    # the stock, oversized and resting on the shelves
    for k, cx in enumerate((X0 + 7, X0 + 11, X0 + 15)):  # a row of red cans
        for cy in (SHELVES[0] + 2,):  # one row: a second row would cut the shelf above
            c = disc(g, "y", float(cx), float(Z0 + 6), 2.0, cy, cy + 6, "red", 5, n=8)
            P.flat(g, c & (Y > cy + 4), "steel", 6)
            P.flat(g, c & (Y < cy + 1), "steel", 4)
            P.flat(g, c & (Y > cy + 2) & (Y < cy + 4), "bone", 7)
    bx1 = box(g, X0 + 20, SHELVES[0] + 2, Z0 + 2, X1 - 6, SHELVES[0] + 9, Z0 + 10, "gold", 6)
    P.flat(g, bx1 & (np.floor(Y) % 3 == 0), "gold", 5)
    P.flat(g, edges(bx1), "darkwood", 3)
    P.flat(g, bx1 & (Z < Z0 + 3) & (Y > SHELVES[0] + 4) & (Y < SHELVES[0] + 7), "darkwood", 2)
    bot = box(g, X0 + 6, SHELVES[1] + 2, Z0 + 3, X0 + 12, SHELVES[1] + 12, Z0 + 9, "teal", 4)
    P.flat(g, bot & (np.floor(Y) % 3 == 0), "teal", 5)
    P.flat(g, bot & (Y > SHELVES[1] + 9), "teal", 6)
    P.flat(g, edges(bot), "teal", 2)
    box(g, X0 + 8, SHELVES[1] + 12, Z0 + 5, X0 + 11, SHELVES[1] + 14, Z0 + 8, "gold", 5)
    sack = box(g, X0 + 16, SHELVES[1] + 2, Z0 + 2, X0 + 26, SHELVES[1] + 8, Z0 + 10, "sand", 5)
    P.flat(g, sack & (np.floor(X + Z) % 5 == 0), "sand", 4)
    P.flat(g, edges(sack), "darkwood", 3)
    for k, cx in enumerate((X0 + 8, X0 + 13, X0 + 24)):  # a few survivors on the top shelf
        c = disc(g, "y", float(cx), float(Z0 + 5), 2.0, SHELVES[2] + 2, SHELVES[2] + 8, ("teal", "gold", "red")[k], 5, n=8)
        P.flat(g, c & (Y > SHELVES[2] + 6), "steel", 6)
        P.flat(g, c & (Y > SHELVES[2] + 4) & (Y < SHELVES[2] + 6), "bone", 7)
    # one box fallen into the dust at the foot
    fall = box(g, X0 + 6, 0, Z0 - 4, X0 + 15, 6, Z0 + 3, "gold", 5)
    P.flat(g, fall & (np.floor(X) % 3 == 0), "gold", 4)
    P.flat(g, edges(fall), "darkwood", 3)
    P.grime(g, fall, height=3, seed=7)
    return asset("grocery-shelf", "Looted Grocery Shelf", root("grocery-shelf", g))
