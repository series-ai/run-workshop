"""Busted soda vending machine, in the Pirate Nation style.

A person-size icon (rules F4, K3): a signal-red cabinet with chamfered
corners (true diagonals) on steel feet, crowned by an oversized glowing
COLA header that hangs a little crooked (rule F5). A big display window
full of bright cans is smashed (painted cracks and a hole); a control
strip with a teal price display, keys and a coin slot, a delivery flap,
a gold tag and cans spilled on the ground. Detail is paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, root
from pnkit import box, edges, on_face
from pnshapes import coords, disc
from voxgrid import C, Grid

X0, X1, Z0, Z1 = 2, 28, 5, 20  # cabinet (front z = Z0)
Y0, Y1 = 3, 38
CH = 3


def cabinet() -> Grid:
    g = Grid(31, Y1 + 1, 24)
    X, Y, Z = coords(g)
    for x, z in ((X0 + 1, Z0 + 1), (X1 - 4, Z0 + 1), (X0 + 1, Z1 - 4), (X1 - 4, Z1 - 4)):
        box(g, x, 0, z, x + 3, Y0, z + 3, "steel", 4)
    g.prism("y", [(X0 + CH, Z0), (X1 - CH, Z0), (X1, Z0 + CH), (X1, Z1 - CH), (X1 - CH, Z1), (X0 + CH, Z1), (X0, Z1 - CH), (X0, Z0 + CH)], Y0, Y1, C("red", 5))
    body = g.solids[-1].mask(g.shape)
    P.flat(g, body & (np.floor(Y) % 12 == 0), "red", 4)  # panel seams
    P.flat(g, body & (X < X0 + 1.5), "red", 4)  # the shaded -x corner
    P.flat(g, body & ((Y < Y0 + 1) | (Y > Y1 - 1)), "red", 3)
    P.flat(g, body & (Y > Y1 - 4) & (Y < Y1 - 1), "red", 6)
    # dents and a gold tag on the +x side
    side = body & (X > X1 - 1)
    P.flat(g, side & (np.hypot(Z - 12, Y - 14) < 2.2), "red", 4)
    tag = side & (np.abs((Y - 24) - 2.0 * np.sin((Z - Z0) * 0.8)) < 1.0) & (Z > Z0 + 3) & (Z < Z1 - 3)
    P.flat(g, tag, "gold", 6)
    # the display window: 1 voxel proud, cans on shelves, smashed
    frame = box(g, *on_face("-z", Z0, X0 + 3, X1 - 8, Y0 + 9, Y1 - 5, 0, 1), "steel", 5)
    P.flat(g, edges(frame), "steel", 3)
    glass = box(g, *on_face("-z", Z0 - 1, X0 + 5, X1 - 10, Y0 + 11, Y1 - 7, 0, 1), "sky", 6)
    cans = [("red", 6), ("gold", 6), ("teal", 6), ("orange", 5), ("bone", 7)]
    for r_, yy in enumerate(range(Y0 + 12, Y1 - 8, 5)):
        P.flat(g, glass & (np.abs(Y - yy + 0.5) < 0.6), "steel", 5)
        for i, xx in enumerate(range(X0 + 6, X1 - 11, 3)):
            ramp, sh = cans[(r_ + i) % len(cans)]
            c = glass & (X > xx) & (X < xx + 2) & (Y > yy) & (Y < yy + 3.5)
            P.flat(g, c, ramp, sh)
            P.flat(g, c & (Y > yy + 3), "steel", 6)
    # the smash: a dark hole with white crack lines round it
    hx, hy = X0 + 10.5, Y0 + 20
    rr = np.hypot(X - hx, Y - hy)
    ang = np.arctan2(Y - hy, X - hx)
    P.flat(g, glass & (rr < 2.3), "sky", 2)
    P.flat(g, glass & (rr > 2.3) & (rr < 7) & (np.abs(((ang / (2 * np.pi) * 6) % 1) - 0.5) * rr < 0.35), "bone", 7)
    # the control strip: price display, keys, coin slot
    pad = box(g, *on_face("-z", Z0, X1 - 7, X1 - 2, Y0 + 9, Y1 - 5, 0, 1), "steel", 5)
    P.flat(g, edges(pad), "steel", 3)
    P.flat(g, pad & (Y > Y1 - 10) & (Y < Y1 - 7) & (X > X1 - 6) & (X < X1 - 3), "teal", 6)
    for ky in (Y0 + 20, Y0 + 17, Y0 + 14):
        for kx in (X1 - 6, X1 - 4):
            P.flat(g, pad & (np.floor(X) == kx) & (np.floor(Y) == ky), "gold", 6)
    P.flat(g, pad & (X > X1 - 5.5) & (X < X1 - 3.5) & (Y > Y0 + 10.5) & (Y < Y0 + 12.5), "steel", 2)
    # the delivery flap
    flap = box(g, *on_face("-z", Z0, X0 + 4, X1 - 9, Y0 + 2, Y0 + 7, 0, 1), "steel", 4)
    P.flat(g, flap & (Y > Y0 + 6), "steel", 6)
    return g


def header() -> Grid:
    """The oversized glowing COLA header (faces -z)."""
    g = Grid(30, 10, 6)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 30, 10, 6, "bone", 7)
    P.flat(g, edges(m), "red", 3)
    P.flat(g, m & ((Y < 1) | (Y > 9)), "red", 4)
    tw, th = pnglyph.text_size("COLA", scale=1)
    pnglyph.text(g, "-z", 0, 15 - tw // 2, 2, "COLA", "red", 4)
    P.flat(g, m & (Z < 1) & (np.abs(Y - 1.5) < 0.6) & (X > 3) & (X < 27), "red", 5)  # the swoosh
    return g


def build():
    g = cabinet()
    # spilled cans on the ground in front
    for k, (cx, cz) in enumerate(((6, 1.6), (11, 2.5), (22, 1.6))):
        c = disc(g, "x", 1.2, cz, 1.2, cx, cx + 3, ("red", "gold", "teal")[k], 6, n=6)
        P.flat(g, c & (coords(g)[0] < cx + 0.6), "steel", 6)
    r = root("vending-machine", g)
    child(r, "header", header(), pivot=(15.0, 0.0, 3.0), at_grid=(15.0, Y1, 12.0), rot=(0.0, 0.0, -4.0))
    return asset("vending-machine", "Busted Vending Machine", r)
