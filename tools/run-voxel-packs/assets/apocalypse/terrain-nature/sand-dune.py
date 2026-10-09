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
from _life import Rig, ctr, limb, make, slab, tuft, rock
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
        w,c,h=toe_w[i],cs[i],hs[i]
        return [(0.0,w),(0.0,toe_l[i]),(h,c),
                (h*.78,w+(c-w)*.78),(h*.72,w+(c-w)*.65),
                (h*.50,w+(c-w)*.58),(h*.44,w+(c-w)*.40),
                (h*.23,w+(c-w)*.34),(h*.18,w+(c-w)*.18)]

    m = np.zeros(g.shape, dtype=bool)
    for i in range(len(xs) - 1):
        g.prism("x", prof(i), xs[i], xs[i + 1], C("sand", 5), top=prof(i + 1))
        m |= g.solids[-1].mask(g.shape)
    crest_z = np.interp(X, xs, cs)
    # Broad, wind-cut color fields keep the large slopes quiet.
    lee = m & (Z > crest_z + 0.5)
    P.flat(g, m, "sand", 5)
    windcut = m & ~lee & (Y > 3) & (Y < crest_z * 0.58) & (
        np.abs(Z - (10 + X * 0.34 + np.sin(X / 11) * 3)) < 2.2
    )
    P.flat(g, windcut, "sand", 6)
    P.flat(g, lee & (Y > 3) & (Y < 11), "sand", 4)
    P.flat(g, m & (np.abs(Z - crest_z) < 1.4) & (Y > 3), "sand", 7)
    # A vehicle door is buried in the lower windward slope. Its framed
    # steel plates and rust remain readable without the old blue patchwork.
    door = slab(g, "x", 5.0, 13.0, 8, 3.5, 40, 50, 42, "steel", 5)
    P.plates(g, door, "steel", 5, size=(4, 4), frame="x", seed=3)
    P.outline(g, door, "darkwood", 3, normal="x")
    P.flat(g, door & (Y > 5) & (Y < 8) & (Z > 12) & (Z < 14), "teal", 5)
    PP.blotch(g, door, "rust", 5, cell=4, chance=0.08, seed=2)
    for k,(xx,zz,hh,rr) in enumerate(((10,30,5,7),(21,35,7,8),(47,32,8,7),(60,32,5,6))):
        ridge=rock(g,xx,zz,2,rr,rr*0.8,hh,"sand",5,shrink=0.55,n=6,seed=35+k)
        P.flat(g,ridge & (Y > hh*0.65),"sand",6)
    # dry scrub on the lee side
    for k, (tx, tz) in enumerate(((26.5, 42.5), (40.5, 41.5), (55.5, 40.5))):
        tuft(g, tx, tz, 0, 8, blades=7, spread=4.2, ramp="sand", shade=6, seed=k)
    return g


def skull() -> Grid:
    """A cattle skull with long horns, resting on the crest."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sz = 33.5, ZC - 1.5
    y0 = H - 0.5
    head = limb(g, (sx, y0 + 3, sz + 2), (sx, y0 + 2, sz - 5), 3.0, 2.1, "bone", 7, n=4)
    for s in (-1, 1):
        limb(g, (sx + s * 2, y0 + 4, sz + 1.5), (sx + s * 8, y0 + 6, sz + 1.5), 1.5, 1.1, "bone", 6, n=4)
        limb(g, (sx + s * 8, y0 + 6, sz + 1.5), (sx + s * 9, y0 + 9, sz + 0.5), 1.1, 0.5, "bone", 6, n=4)
    eyes = head & (Z < sz - 1) & (Y > y0 + 2) & (Y < y0 + 5) & (np.abs(X - sx) > 1) & (np.abs(X - sx) < 3.2)
    P.flat(g, eyes, "darkwood", 2)
    return g


def sign() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    # The post and buried anchor share one base point on the slope.
    pole = limb(g, (58, 5, 29), (58, 23, 31.5), 1.5, None, "steel", 5, n=4)
    anchor = box(g, 55, 4, 27, 61, 10, 31, "rust", 5)
    P.outline(g, anchor, "darkwood", 3, normal="z")
    P.flat(g, anchor & (Y > 2) & (Y < 4), "gold", 5)
    plate = box(g, 51, 17, 28, 65, 26, 30, "steel", 5)
    P.plates(g, plate, "steel", 5, size=(5, 4), frame="z", seed=9)
    P.outline(g, plate, "darkwood", 3, normal="z")
    G.icon(g, "-z", 28, 54, 19, "skull", "gold", 6, depth=2)
    G.stamp(g, "-z", 28, 62, 19, ["###", "#..", "##.", "#..", "###"], {"#": C("red", 5)}, depth=2)
    del pole
    return g


def build():
    rig = Rig("sand-dune", (35, 0, 24), dune())
    rig.add("skull", skull(), (33.5, H - 0.5, ZC - 1.5), rot=(0, 18, 0))
    rig.add("sign", sign(), (58, 5, 29), rot=(0, 0, -5))
    return make("terrain-nature", "sand-dune", "Wasteland Dune", rig.root)
