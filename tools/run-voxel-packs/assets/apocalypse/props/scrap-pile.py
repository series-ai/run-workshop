"""Scrap heap, in the Pirate Nation style.

One iconic junk pile of four big pieces anyone can name at a glance (rules
F1, F4): a low dusty mound, a red oil drum with a hazard band leaning in
at the back, a fat black tyre standing on its tread at the front left, a
teal car door with its window propped at the front right, and a yellow
diamond warning sign on a bent post sticking out of the top (the tall
silhouette). Every piece leans a little (rule F5). Tread, glass, rust and
dust are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
from _pn import drum
from _props import asset, child, rock, root
from pnkit import box, edges
from pnshapes import bar, coords, flat_ngon, ngon_radius
from voxgrid import C, Grid


def car_door() -> Grid:
    """A teal car door facing -z, 16 wide, 15 tall, 2 thick."""
    g = Grid(16, 15, 2)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 16, 9, 2, "teal", 5)
    P.flat(g, edges(m), "teal", 3)
    P.flat(g, m & (np.abs(Y - 6) < 0.5), "teal", 6)  # the crease line
    P.flat(g, m & (np.abs(X - 12.5) < 1.6) & (np.abs(Y - 7) < 0.6), "steel", 7)  # the handle
    P.flat(g, m & (np.hypot(X - 4.5, Y - 3) < 1.8), "rust", 5)  # a rust bloom
    frame = box(g, 0, 9, 0.5, 16, 15, 1.5, "steel", 5)
    P.flat(g, frame & (Y > 14), "steel", 6)
    glass = box(g, 1.5, 9, 0, 14, 14, 1, "sky", 5)
    P.flat(g, glass & ((X + Y) % 8 < 1.5), "sky", 7)  # a glint across the glass
    return g


def tyre() -> Grid:
    """A fat tyre on its tread, axle along z: a bulging ring (two frustums
    meet at the tread) with the hole painted deep, 18 across, 6 thick."""
    r, th, bulge = 9.0, 6.0, 1.4
    g = Grid(18, 18, 6)
    c = 9.0
    g.prism("z", flat_ngon(c, c, r - bulge, 8), 0, th / 2, C("iron", 4), top=flat_ngon(c, c, r, 8))
    m = g.solids[-1].mask(g.shape)
    g.prism("z", flat_ngon(c, c, r, 8), th / 2, th, C("iron", 4), top=flat_ngon(c, c, r - bulge, 8))
    m |= g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    d = ngon_radius(g, "z", c, c)
    ang = np.arctan2(Y - c, X - c)
    side = m & ((Z < 1) | (Z > th - 1))
    P.flat(g, side & (d > r - bulge - 1.5), "iron", 5)  # the sidewall catches light
    P.flat(g, side & (d > 4.4) & (d < 5.6), "gray", 5)  # the bead
    P.flat(g, side & (d <= 4.4), "iron", 1)  # the deep hole
    blocks = np.floor((ang + np.pi) / (2 * np.pi) * 24).astype(int) % 2 == 0
    P.flat(g, m & ~side & blocks, "iron", 3)  # tread blocks
    return g


def sign() -> Grid:
    """A yellow diamond warning sign facing -z with a big '!' and a dark
    rim, 18 across, 2 thick, and a grey back."""
    g = Grid(18, 18, 2)
    c, r = 9.0, 9.0
    g.prism("z", [(c, c - r), (c + r, c), (c, c + r), (c - r, c)], 0, 2, C("gold", 5))
    m = g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    d = np.abs(X - c) + np.abs(Y - c)
    P.flat(g, m & (d > r - 2.2), "darkwood", 3)
    P.flat(g, m & (d > r - 1.2), "gold", 4)
    P.flat(g, m & (Z > 1), "steel", 5)
    bang = ["##", "##", "##", "##", "##", "##", "..", "##", "##"]  # a bold '!'
    pnglyph.stamp(g, "-z", 0, 8, 4, bang, {"#": C("darkwood", 2)})
    for bx, by in ((5.5, 9.5), (11.5, 5.5)):  # bullet holes
        P.flat(g, m & (np.hypot(X - bx, Y - by) < 0.8), "steel", 2)
    return g


def build():
    g = Grid(38, 24, 32)
    X, Y, Z = coords(g)
    mound = rock(g, 19, 17, 0, 14, 6, n=7, seed=3, ramp="sand", base=5, top_frac=0.5)
    lump = rock(g, 27, 22, 0, 7, 4, n=6, seed=8, ramp="sand", base=6, top_frac=0.55)
    P.flat(g, (mound | lump) & (Y < 1), "sand", 4)
    # the bent sign post, stuck in the top of the mound (true diagonals)
    post = bar(g, "z", (15, 4), (13, 14), 2.2, 20, 22.2, "steel", 5)
    post |= bar(g, "z", (13, 14), (12, 22), 2.2, 20, 22.2, "steel", 5)
    P.flat(g, post & (Y < 6), "rust", 4)
    # a short length of bent pipe on the mound (one diagonal accent)
    bar(g, "x", (5, 12), (3.5, 16), 2.2, 29, 31.2, "rust", 5)
    r = root("scrap-pile", g)
    dg = Grid(14, 16, 14)
    drum(dg, 7.0, 7.0, 0, 15, 6.5, ramp="red", base=4, label=None, seed=5)
    child(r, "drum", dg, pivot=(7.0, 0.0, 7.0), at_grid=(27.0, 2.5, 21.0), rot=(8.0, 25.0, 12.0))
    child(r, "tyre", tyre(), pivot=(9.0, 0.0, 3.0), at_grid=(8.0, 0.0, 9.0), rot=(-10.0, 28.0, 4.0))
    child(r, "car-door", car_door(), pivot=(8.0, 0.0, 1.0), at_grid=(25.0, 0.0, 6.0), rot=(18.0, -22.0, -6.0))
    child(r, "sign", sign(), pivot=(9.0, 3.0, 2.0), at_grid=(12.0, 21.0, 20.0), rot=(-6.0, -12.0, 10.0))
    return asset("scrap-pile", "Scrap Pile", r)
