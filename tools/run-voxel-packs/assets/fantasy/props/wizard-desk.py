"""Wizard's desk in the Pirate Nation style.

A heavy carved desk with a planked top and a drawer bound in gold. The
oversized function prop is the scrying globe on its gold claw stand,
lit from inside in arcane magenta (rules F4 and C3). An open spell book
with glowing cyan runes, candles, potions, a quill and a stack of books
fill the top; the arcane-orbit effect plays at socket-orb. About 36 wide
and 32 tall.
"""

import numpy as np

import paint as P
from _props import book, candle, coords, plank_box, potion
from pnkit import box
from pnshapes import cone, disc, dome, last
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 38, 34, 24
X0, X1 = 2, 36
ZF, ZB = 2, 20
TOP = 15  # the desk top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # carved legs, a low shelf and the planked top
    for lx in (X0 + 1, X1 - 5):
        for lz in (ZF + 2, ZB - 6):
            leg = box(g, lx, 0, lz, lx + 4, TOP - 3, lz + 4, "darkwood", 4)
            P.planks(g, leg, "darkwood", 4, width=4, across="x", nails=False, seed=lx + lz)
            P.flat(g, leg & ((Yi == 4) | (Yi == 10)), "gold", 5)  # carved rings
            P.flat(g, leg & (Yi < 2), "darkwood", 2)
    shelf = plank_box(g, X0 + 2, 4, ZF + 3, X1 - 2, 6, ZB - 3, "wood", 5, across="y", width=3, seed=1)
    top = plank_box(g, X0, TOP - 3, ZF, X1, TOP, ZB, "wood", 6, across="y", width=4, seed=2)
    P.flat(g, top & (Yi == TOP - 3), "darkwood", 3)
    drawer = box(g, 9, TOP - 8, ZF - 1, 29, TOP - 3, ZF + 1, "wood", 5)
    P.planks(g, drawer, "wood", 5, width=4, across="y", frame="z", nails=False, seed=3)
    P.outline(g, drawer, "darkwood", 3, normal="z")
    P.flat(g, drawer & (np.abs(X - 19) < 3.0) & (np.abs(Y - (TOP - 5.5)) < 1.1), "gold", 6)

    # the scrying globe on a gold claw stand
    gx, gz = 13, 10
    stand = cone(g, "y", gx, gz, 4.0, TOP, TOP + 3, "gold", 5, n=6, r_top=2.6)
    P.flat(g, stand & (Yi > TOP + 1), "gold", 6)
    P.flat(g, stand & (Yi == TOP), "gold", 4)
    globe = cone(g, "y", gx, gz, 5.6, TOP + 3, TOP + 7, "magenta", 5, n=8, r_top=2.8, tip="lo")
    globe |= disc(g, "y", gx, gz, 5.6, TOP + 7, TOP + 9, "magenta", 5, n=8)
    globe |= dome(g, gx, gz, TOP + 9, 5.6, 5.0, n=8, rings=2, ramp="magenta", base=5, cap_r=1.6,
                  painter=lambda gg, mm, fr: P.flat(gg, mm, "magenta", 5), ribs=None)
    P.flat(g, globe, "magenta", 5)
    P.flat(g, globe & (Yi > TOP + 10), "magenta", 6)
    P.flat(g, globe & (Yi > TOP + 12), "magenta", 7)
    P.flat(g, globe & (Zi < gz - 3) & (np.abs(X - gx + 2) < 2.2) & (Yi > TOP + 7) & (Yi < TOP + 11), "bone", 7)
    P.flat(g, globe & (Yi < TOP + 5), "magenta", 3)
    for ax, az in ((gx - 4, gz - 2), (gx + 4, gz - 2), (gx - 2, gz + 4), (gx + 2, gz + 4)):  # claws
        cl = box(g, ax - 1, TOP + 2, az - 1, ax + 1, TOP + 7, az + 1, "gold", 6)
        P.flat(g, cl, "gold", 6)
        P.flat(g, cl & (Yi > TOP + 5), "gold", 7)

    # an open spell book with cyan runes, candles, potions and a quill
    pages = box(g, 22, TOP, ZF + 2, 35, TOP + 3, ZF + 13, "bone", 7)
    P.flat(g, pages, "bone", 7)
    P.flat(g, pages & (np.abs(X - 28.5) < 1.0), "red", 5)  # the spine
    P.flat(g, pages & (Yi == TOP), "red", 4)
    for rx in (24, 26, 31, 33):
        P.flat(g, pages & (Yi > TOP + 1) & (np.abs(X - rx) < 1.0) & (Zi > ZF + 3) & (Zi < ZF + 11), "cyan", 6)
    P.flat(g, pages & (Yi > TOP + 1) & (np.hypot(X - 31, Z - (ZF + 7)) < 2.6)
           & (np.hypot(X - 31, Z - (ZF + 7)) > 1.4), "cyan", 7)
    candle(g, 34, TOP, ZB - 4, h=7, w=2, wax=("bone", 7))
    candle(g, 5, TOP, ZB - 4, h=5, w=2, wax=("bone", 6))
    potion(g, 21, TOP, ZB - 5, r=1.8, h=5, liquid="leaf", shade=5)
    potion(g, 6, TOP, ZF + 4, r=1.6, h=4, liquid="cyan", shade=5)
    ink = disc(g, "y", 18, ZB - 4, 2.0, TOP, TOP + 3, "navy", 3, n=6)
    P.flat(g, ink & (Yi > TOP + 1), "navy", 5)
    quill = box(g, 17, TOP + 3, ZB - 5, 19, TOP + 9, ZB - 3, "bone", 7)
    P.flat(g, quill & (Yi > TOP + 6), "bone", 6)
    book(g, X0 + 3, 6, ZF + 5, X0 + 13, 8, ZF + 13, "blue", 4)
    book(g, X0 + 4, 8, ZF + 6, X0 + 14, 10, ZF + 14, "leaf", 4)

    root = Part("wizard-desk", g)
    return Asset(id="fantasy-props-wizard-desk", pack="fantasy", category="props", name="Wizard's Desk", root=root,
                 sockets=[Socket("socket-orb", at=(float(gx), float(TOP + 11), float(gz)))],
                 pfx=[{"effectId": "rvx-fantasy-arcane-orbit", "socket": "socket-orb", "trigger": "idle", "size": 14}])
