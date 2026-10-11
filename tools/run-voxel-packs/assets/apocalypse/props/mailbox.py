"""Roadside mailbox, in the Pirate Nation style.

A chunky teal mailbox with a round top (a half-octagon prism: true
slopes) on a thick crooked post (rule F5). The front door hangs open on
its hinge and letters spill onto the ground; the red flag is up. Dents,
rust and the painted house number are paint (rule S1).
"""
import math

import numpy as np

import paint as P
from _props import asset, child, root, tuft
from pnkit import box
from pnshapes import coords
from voxgrid import C, Grid

BW, BL, BH = 11, 17, 6  # box width (x), length (z) and wall height below the round top


def profile(x0: float, y0: float, w: float, h: float) -> list[tuple[float, float]]:
    """(x, y) outline: a rectangle with a half-octagon top."""
    r = w / 2
    xc = x0 + r
    pts = [(x0, y0), (x0 + w, y0)]
    for k in range(5):
        a = math.pi * k / 4
        pts.append((xc + r * math.cos(a), y0 + h + r * math.sin(a) * 0.9))
    return pts


def mailbox() -> Grid:
    """Post and box. The post foot is at (7, 0, 10); the box front at z = 2."""
    g = Grid(16, 34, 22)
    X, Y, Z = coords(g)
    post = box(g, 5, 0, 8, 9, 18, 12, "wood", 5)
    P.planks(g, post, "wood", 5, width=4, across="x", nails=False, seed=1)
    arm = box(g, 3, 18, 4, 11, 20, 18, "wood", 4)
    P.planks(g, arm, "wood", 4, width=2, across="y", seed=2)
    g.prism("z", profile(1.5, 20, BW, BH), 2, 2 + BL, C("teal", 5))
    body = g.solids[-1].mask(g.shape)
    P.mottle(g, body, "teal", 5, cell=3, seed=3)
    P.flat(g, body & (Y > 20 + BH + 3), "teal", 6)
    P.flat(g, body & ((Z < 3) | (Z > 1 + BL)), "teal", 4)  # the rolled front and back rims
    P.flat(g, body & (np.hypot(X - 3, Y - 23) < 1.6) & (Z > 9) & (Z < 14), "teal", 3)  # a dent
    P.flat(g, body & (np.abs(Y - 21) < 0.6), "rust", 4)  # rust line at the base
    # the flag: a red paddle on the +x side, raised
    box(g, 12.5, 21, 12, 14, 34 - 4, 13, "red", 3)
    flag = box(g, 12.5, 26, 13, 14, 30, 18, "red", 5)
    P.flat(g, flag & (Y > 29), "red", 6)
    return g


def door() -> Grid:
    """The front door, hinged at its bottom edge (pivot at the hinge)."""
    g = Grid(BW + 2, BH + 8, 1)
    g.prism("z", profile(1, 0, BW, BH), 0, 1, C("teal", 4))
    m = g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    P.flat(g, m & (np.hypot(X - 6.5, Y - 8) < 1.3), "steel", 6)  # the latch
    P.flat(g, m & (Y > 10), "teal", 5)
    return g


def letter(w: int, d: int, shade: int) -> Grid:
    g = Grid(w, 1, d)
    m = box(g, 0, 0, 0, w, 1, d, "bone", shade)
    P.flat(g, m & (coords(g)[0] < 1.5), "red", 5)  # a stamp stripe
    return g


def build():
    g = Grid(24, 3, 30)
    # a dirt mound at the post foot and weeds
    mound = box(g, 6, 0, 10, 14, 1, 18, "sand", 5)
    P.mottle(g, mound, "sand", 5, cell=2, seed=4)
    tuft(g, 4, 15, 0, seed=1)
    tuft(g, 15, 18, 0, seed=2)
    r = root("mailbox", g)
    mb = child(r, "box", mailbox(), pivot=(7.0, 0.0, 10.0), at_grid=(10, 1, 14), rot=(0.0, -8.0, 6.0))
    # the door hangs open, 110° down from its hinge at the box front bottom
    child(mb, "door", door(), pivot=(1.5, 0.0, 0.0), at_grid=(1.5, 20, 2), rot=(-105.0, 0.0, 0.0))
    for k, (x, z, rot) in enumerate(((8, 3, 20.0), (13, 6, -35.0), (4, 8, 60.0))):
        child(r, f"letter-{k}", letter(6, 4, 7 - k % 2), pivot=(3.0, 0.0, 2.0), at_grid=(x, 0, z), rot=(0.0, rot, 0.0))
    return asset("mailbox", "Roadside Mailbox", r)
