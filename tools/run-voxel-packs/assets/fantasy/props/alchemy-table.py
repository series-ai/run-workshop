"""Alchemy table in the Pirate Nation style.

A heavy oak bench (thick legs, planked top) carries the oversized function
prop (rule F4): a big round flask of glowing green brew (two octagon
frustums, true slopes) over a gold burner with a small flame, its neck
feeding a copper tube to a small receiver. A mortar, a book and two potions
fill the bench. The healing-sparkles PFX plays on socket-brew at the flask
mouth. About 32 wide and 30 tall.
"""

import numpy as np

import paint as P
from _props import book, coords, flame_tongue, plank_box, potion
from pnkit import box
from pnshapes import bar, disc, flat_ngon, last
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 34, 34, 18
X0, X1, Z0, Z1 = 2, 32, 3, 15  # bench top outline
TY = 13  # bench top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    for lx in (X0 + 1, X1 - 4):
        for lz in (Z0 + 1, Z1 - 4):
            leg = box(g, lx, 0, lz, lx + 3, TY - 2, lz + 3, "darkwood", 4)
            P.planks(g, leg, "darkwood", 4, width=3, across="x", nails=False)
    plank_box(g, X0 + 2, 3, Z0 + 2, X1 - 2, 5, Z1 - 2, "darkwood", 5, across="y", width=2, seed=1)  # low shelf
    plank_box(g, X0, TY - 2, Z0, X1, TY, Z1, "wood", 5, across="y", width=3, seed=2)
    # the burner: a gold ring on three stubby legs, with a flame under the flask
    fx, fz = 12, 9
    for dx, dz in ((-3, -2), (3, -2), (0, 3)):
        box(g, fx + dx - 0.5, TY, fz + dz - 0.5, fx + dx + 1, TY + 5, fz + dz + 1, "gold", 4)
    disc(g, "y", fx, fz, 4.2, TY + 4, TY + 5, "gold", 5, n=8)
    flame_tongue(g, fx, TY, fz, 1.6, 4)
    # the big flask: a bulb of glowing brew, a neck and a lip
    b0 = TY + 5
    g.prism("y", flat_ngon(fx, fz, 3.0, 8), b0, b0 + 3, C("leaf", 5), top=flat_ngon(fx, fz, 5.5, 8))
    bulb = last(g)
    g.prism("y", flat_ngon(fx, fz, 5.5, 8), b0 + 3, b0 + 7, C("leaf", 5), top=flat_ngon(fx, fz, 2.0, 8))
    bulb |= last(g)
    P.flat(g, bulb & (Y > b0 + 4), "leaf", 6)
    P.flat(g, bulb & (X < fx - 2.5) & (Y > b0 + 2) & (Y < b0 + 5), "leaf", 7)  # glint
    P.flat(g, bulb & (Y > b0 + 5.5), "sky", 7)  # glass above the brew
    for bx, by in ((fx + 1, b0 + 3), (fx - 2, b0 + 4)):
        P.flat(g, bulb & (np.abs(X - bx) < 0.6) & (np.abs(Y - by) < 0.6) & (Z < fz - 3), "leaf", 7)  # bubbles
    box(g, fx - 1, b0 + 7, fz - 1, fx + 1, b0 + 11, fz + 1, "sky", 7)
    box(g, fx - 1.5, b0 + 11, fz - 1.5, fx + 1.5, b0 + 12, fz + 1.5, "gold", 5)
    # the copper tube from the neck to a receiver bottle
    bar(g, "z", (fx + 1, b0 + 10), (fx + 10, b0 + 3), 1.4, fz - 0.7, fz + 0.7, "gold", 3)
    potion(g, fx + 11, TY, fz, r=2.4, h=5, liquid="cyan", shade=5, n=8, neck=2)
    # a mortar with a pestle, a book and a red potion
    mort = disc(g, "y", 27, 7, 2.6, TY, TY + 3, "stone", 5, n=8)
    P.flat(g, mort & (Y > TY + 2) & (np.hypot(X - 27, Z - 7) < 1.8), "stone", 3)
    bar(g, "x", (TY + 2, 7), (TY + 6, 9), 1.4, 26.3, 27.7, "stone", 6)
    book(g, 3, TY, 5, 9, TY + 2, 12, "blue", 4)
    potion(g, 5, TY + 2, 9, r=1.6, h=4, liquid="red", shade=5)
    potion(g, 29, TY, 12, r=1.6, h=4, liquid="magenta", shade=5)
    root = Part("alchemy-table", g)
    return Asset(id="fantasy-props-alchemy-table", pack="fantasy", category="props", name="Alchemy Table", root=root,
                 sockets=[Socket("socket-brew", at=(fx, b0 + 12, fz))],
                 pfx=[{"effectId": "rvx-fantasy-potion-fizz", "socket": "socket-brew", "trigger": "manual", "size": 18}])
