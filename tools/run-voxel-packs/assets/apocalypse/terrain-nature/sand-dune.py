"""Wasteland dune, in the Pirate Nation style.

A wind-shaped sand ridge: a gentle windward slope and a steep lee face
(true slopes) that taper to points at both ends, with painted wind
ripples. It half buries a leaning road sign and a teal car door, a cattle
skull with long horns rests on the crest, and dry scrub grows on the lee
side. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, limb, make, slab, tuft
from pnkit import box
from voxgrid import C, Grid

SZ = (70, 32, 48)
X0, X1 = 3.0, 67.0
ZW, ZC, ZL = 3.0, 30.0, 44.0  # windward toe, crest, lee toe (the lee faces +z)
H = 21.0


def dune() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # a curved crescent ridge: segments along x whose crest height and
    # position change, each a frustum between two profiles (true slopes)
    xs = [X0, 13.0, 25.0, 38.0, 52.0, X1]
    hs = [2.0, 12.0, 19.0, H, 13.0, 2.0]
    cs = [33.0, 29.0, 27.0, 28.0, 31.0, 35.0]
    toe_w = [24.0, 10.0, 4.0, 3.0, 8.0, 22.0]
    toe_l = [38.0, 42.0, 44.0, 44.0, 43.0, 40.0]

    def prof(i):  # (y, z) triangle: windward toe, lee toe, crest
        return [(0.0, toe_w[i]), (0.0, toe_l[i]), (hs[i], cs[i])]

    m = np.zeros(g.shape, dtype=bool)
    for i in range(len(xs) - 1):
        g.prism("x", prof(i), xs[i], xs[i + 1], C("sand", 5), top=prof(i + 1))
        m |= g.solids[-1].mask(g.shape)
    crest_z = np.interp(X, xs, cs)
    # wind ripples on the windward face, a darker lee face, a pale crest
    lee = m & (Z > crest_z + 0.5)
    P.flat(g, m, "sand", 5)
    ripple = m & ~lee & (((np.floor(Z - Y * 0.9 + np.sin(X / 7) * 2)) % 5) == 0)
    P.flat(g, ripple, "sand", 6)
    P.flat(g, lee, "sand", 4)
    P.flat(g, lee & (((np.floor(Y + np.sin(X / 5) * 1.5)) % 6) == 0), "sand", 3)
    P.flat(g, m & (np.abs(Z - crest_z) < 1.2) & (Y > 3), "sand", 7)
    # a car door half buried on the windward slope (teal, with a window)
    door = slab(g, "x", 7.0, 12.0, 13, 2.5, 44, 56, 52, "teal", 5)
    P.mottle(g, door, "teal", 5, cell=3, seed=1)
    P.flat(g, door & (Y > 7) & (Z > 9) & (Z < 16), "sky", 4)
    PP.blotch(g, door, "rust", 5, cell=2, chance=0.12, seed=2)
    # dry scrub on the lee side
    for k, (tx, tz) in enumerate(((26.5, 42.5), (40.5, 41.5), (55.5, 40.5))):
        tuft(g, tx, tz, 0, 6, blades=5, spread=3.0, ramp="sand", shade=6, seed=k)
    return g


def skull() -> Grid:
    """A cattle skull with long horns, resting on the crest."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sz = 33.5, ZC - 1.5
    y0 = H - 0.5
    head = limb(g, (sx, y0 + 2.5, sz + 2), (sx, y0 + 1.5, sz - 4), 2.2, 1.4, "bone", 7, n=4)
    for s in (-1, 1):
        limb(g, (sx, y0 + 3, sz + 1.5), (sx + s * 5, y0 + 5, sz + 1.5), 0.9, 0.7, "bone", 6, n=4)
        limb(g, (sx + s * 5, y0 + 5, sz + 1.5), (sx + s * 6.5, y0 + 8, sz + 0.5), 0.7, 0.3, "bone", 6, n=4)
    P.flat(g, head & (Z < sz - 1) & (np.abs(X - sx) > 0.6) & (Y > y0 + 2), "darkwood", 5)  # eye holes
    return g


def sign() -> Grid:
    g = Grid(*SZ)
    pole = limb(g, (52.5, 4, 16.5), (52.5, 23, 16.5), 0.9, None, "steel", 5, n=4)
    plate = box(g, 46, 16, 15, 60, 24, 16, "gold", 5)
    P.outline(g, plate, "darkwood", 4, normal="z")
    G.stamp(g, "-z", 15, 49, 17, ["....#....", "...###...", "..##.##..", ".##...##.", "#########"], {"#": C("darkwood", 4)})
    del pole
    return g


def build():
    rig = Rig("sand-dune", (35, 0, 24), dune())
    rig.add("skull", skull(), (33.5, H - 0.5, ZC - 1.5), rot=(0, 25, 0))
    rig.add("sign", sign(), (52.5, 4, 16.5), rot=(-12, 0, 16))
    return make("terrain-nature", "sand-dune", "Wasteland Dune", rig.root)
