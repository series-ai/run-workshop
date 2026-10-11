"""Weapon locker, in the Pirate Nation style.

A person-size icon (rules K3, F6): an olive steel locker framed in dark
trim, with painted panel seams, rivets and rust that gathers on the edges
and the door seams. Both doors hang open at matched angles on visible
hinge barrels (rule F5) and carry a hazard band and an ARMS stencil. Inside
stands the hero prop: one oversized rifle on a rack, with ammo tins and a
zombie-teal helmet beside it (rules F4, C3). The back is plated and
vented, and weeds come up on a dust pad at the foot. Every mark is paint
(rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, root, rust_wear, weeds
from pnkit import box, edges, on_face
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 42, 42, 24
X0, X1, Z0, Z1 = 8, 34, 4, 18
Y0, Y1 = 3, 38
T = 3


def door(side: int) -> Grid:
    """One leaf: a plated door with a hazard band and a bar handle."""
    w, h = (X1 - X0) // 2 - 1, Y1 - Y0 - 2
    g = Grid(w, h, 4)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, w, h, 2, "khaki", 5)
    P.plates(g, m, "khaki", 5, size=(7, 10), seed=2 + side, frame="z")
    P.outline(g, m, "darkwood", 2, normal="z")
    P.flat(g, m & ((X < 1) | (X > w - 1) | (Y < 1) | (Y > h - 1)), "khaki", 3)
    pnpaint.hazard(g, P.region(g, 1, h - 7, 0, w - 1, h - 4, 1), period=4, a=("gold", 7), b=("darkwood", 3), frame="z")
    if side == 0:
        tw, _ = pnglyph.text_size("ARMS")
        if tw < w - 2:
            pnglyph.text(g, "-z", 0, (w - tw) // 2, h // 2, "ARMS", "bone", 7)
    else:
        pnglyph.icon(g, "-z", 0, w // 2 - 4, h // 2 - 4, "skull", "bone", 7)
    hx = w - 4 if side == 0 else 2
    for hy in (h // 2 - 5, h // 2 + 3):
        box(g, hx, hy, 2, hx + 2, hy + 2, 3, "steel", 4)
    hb = box(g, hx, h // 2 - 4, 3, hx + 2, h // 2 + 4, 4, "steel", 6)
    P.flat(g, hb & (np.floor(Y) % 3 == 0), "steel", 4)
    chips(g, m, ((1, 5, 0, 3.0), (w - 2, h - 6, 0, 2.6)), "rust", 5, seed=5 + side)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, X1 + 2, Z0 + 3, seed=1)
    weeds(g, X0 - 5, Z1 - 5, seed=2)
    for fx in (X0 + 1, X1 - 4):
        for fz in (Z0 + 1, Z1 - 4):
            f = box(g, fx, 0, fz, fx + 3, Y0, fz + 3, "darkwood", 3)
            P.flat(g, edges(f), "darkwood", 1)
    shell = box(g, X0, Y0, Z1 - T, X1, Y1, Z1, "khaki", 5)
    shell |= box(g, X0, Y0, Z0, X0 + T, Y1, Z1, "khaki", 5)
    shell |= box(g, X1 - T, Y0, Z0, X1, Y1, Z1, "khaki", 5)
    shell |= box(g, X0, Y1 - T, Z0, X1, Y1, Z1, "khaki", 5)
    shell |= box(g, X0, Y0, Z0, X1, Y0 + T, Z1, "khaki", 5)
    P.plates(g, shell, "khaki", 5, size=(10, 9), seed=3)
    P.flat(g, edges(shell), "darkwood", 2)
    rust_wear(g, shell, seed=4, shade=5, run=6, grime=4)
    chips(g, shell, ((X0, 10, Z1, 4.2), (X1, 28, Z0 + 4, 3.6), (X0 + 10, Y1, Z1, 3.4), (X1, Y0, Z1 - 2, 3.0)), "rust", 5, seed=5)
    # the back: a vent grille and a stencilled number
    back = shell & (Z > Z1 - 1)
    vent = back & (X > X0 + 6) & (X < X1 - 6) & (Y > Y1 - 12) & (Y < Y1 - 5)
    P.flat(g, vent, "khaki", 3)
    P.flat(g, vent & (np.floor(Y) % 2 == 0), "khaki", 6)
    P.outline(g, vent, "darkwood", 2, normal="z")
    pnglyph.text(g, "+z", Z1, X0 + 8, Y0 + 6, "07", "bone", 7)
    # the inside: a dark back panel, a rack rail and a shelf
    P.flat(g, back & (Z < Z1 - T + 0.5) & (X > X0 + T) & (X < X1 - T) & (Y > Y0 + T) & (Y < Y1 - T), "steel", 4)
    rail = box(g, X0 + T, Y1 - 8, Z0 + 2, X1 - T, Y1 - 6, Z1 - T, "steel", 6)
    P.flat(g, edges(rail), "steel", 3)
    sh = box(g, X0 + T, Y0 + 12, Z0 + 2, X1 - T, Y0 + 14, Z1 - T, "steel", 6)
    P.flat(g, sh & (Z < Z0 + 3), "steel", 3)
    P.flat(g, edges(sh), "steel", 3)
    # the oversized rifle, standing in the rack
    cx = 17
    stock = box(g, cx, Y0 + 14, Z0 + 4, cx + 5, Y0 + 24, Z1 - 5, "darkwood", 5)
    P.planks(g, stock, "darkwood", 5, width=3, across="y", nails=False, seed=6)
    P.flat(g, edges(stock), "darkwood", 2)
    body_ = box(g, cx + 1, Y0 + 22, Z0 + 5, cx + 4, Y1 - 8, Z1 - 6, "steel", 5)
    P.flat(g, body_ & (np.floor(Y) % 4 == 0), "steel", 3)
    P.flat(g, edges(body_), "steel", 2)
    mag = box(g, cx - 2, Y0 + 19, Z0 + 5, cx + 1, Y0 + 26, Z1 - 6, "steel", 4)
    P.flat(g, edges(mag), "steel", 2)
    bl = box(g, cx + 2, Y0 + 24, Z0 + 6, cx + 4, Y1 - 7, Z0 + 8, "steel", 6)
    P.flat(g, bl & (np.floor(Y) % 3 == 0), "steel", 4)
    # two ammo tins and a teal helmet on the shelf
    for k, tx in enumerate((X0 + 4, X0 + 10)):
        t = box(g, tx, Y0 + 14, Z0 + 3, tx + 5, Y0 + 20, Z1 - 5, "moss", 5)
        P.plates(g, t, "moss", 5, size=(4, 3), seed=7 + k)
        P.flat(g, edges(t), "darkwood", 2)
        P.flat(g, t & (Z < Z0 + 4) & (Y > Y0 + 16) & (Y < Y0 + 18), "red", 4)
    hel = disc(g, "y", float(X1 - 8), float((Z0 + Z1) / 2), 4.2, Y0 + 14, Y0 + 21, "teal", 4, n=8)
    P.flat(g, hel & (Y > Y0 + 19), "teal", 6)
    P.flat(g, hel & (Y < Y0 + 16), "teal", 2)
    P.outline(g, hel, "teal", 2, normal="y")
    # a fallen ammo tin in the dust
    fall = box(g, X1 + 1, 0, Z0 + 6, X1 + 8, 5, Z1 - 2, "moss", 5)
    P.plates(g, fall, "moss", 5, size=(4, 3), seed=9)
    P.flat(g, edges(fall), "darkwood", 2)
    P.grime(g, fall, height=2, seed=10)
    r = root("weapon-locker", g)
    for hy in (Y0 + 7, Y1 - 10):  # the hinge barrels, on the body
        for hx, dz in ((X0 - 1, 0), (X1 - 2, 0)):
            hb = box(g, hx, hy, Z0 - 1, hx + 3, hy + 4, Z0 + 2, "steel", 6)
            P.flat(g, edges(hb), "steel", 3)
    child(r, "door-l", door(0), pivot=(0.0, 0.0, 2.0), at_grid=(float(X0), float(Y0 + 1), float(Z0)), rot=(0.0, 104.0, 0.0))
    child(r, "door-r", door(1), pivot=(float((X1 - X0) // 2 - 1), 0.0, 2.0), at_grid=(float(X1), float(Y0 + 1), float(Z0)), rot=(0.0, -96.0, 0.0))
    return asset("weapon-locker", "Weapon Locker", r)
