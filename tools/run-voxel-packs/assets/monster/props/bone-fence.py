"""Bone fence segment, in the Pirate Nation haunted style.

Two PN tiles long (exactly 32, so segments line up on the grid). Grey
stone footings with a violet slate course carry two thick femur posts
with knuckle ends; two rib rails run between them and four sharpened
bone pickets stand well apart on the rails, one leaning (rule F5). Every
bone mass is framed in a dark bone tone and the pickets alternate two
shades, so the parts read separately at 128 px (rules S3, S4). A big
skull with toxic-green eyes stands proud of the pickets, lashed on with
violet cord, and a small pumpkin sits at the foot. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _props import big_skull, bone, idx, masonry, plinth, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

L, H, D = 32, 26, 14
CZ = 7.0
PICKETS = (9.5, 14.0, 19.0, 23.5)


def build():
    g = Grid(L, H, D)
    X, Y, Z = idx(g)

    # ---- stone footings and a kerb with a violet slate course
    stone = np.zeros(g.shape, dtype=bool)
    for x0 in (0, 26):
        m = plinth(g, x0, CZ - 4, x0 + 6, CZ + 4, 0, 5, "gray", 5, bevel=1.2, seed=x0 + 1)
        stone |= m
        band = m & (Y >= 2) & (Y < 4)
        P.stone(g, band, "purple", 5, block=(4, 3), seed=x0 + 2)
        P.flat(g, band & (Y == 3), "purple", 6)
    kerb = box(g, 6, 0, CZ - 2.5, 26, 3, CZ + 2.5, "gray", 5)
    stone |= kerb
    masonry(g, kerb, "gray", 5, block=(6, 3), seed=3)
    P.flat(g, kerb & (Y == 2), "gray", 7)
    P.flat(g, edges(kerb), "gray", 2)

    # ---- two femur posts with knuckle ends and a dark frame
    for cx in (4.2, 27.8):
        m = bone(g, "z", (cx, 6.0), (cx, 20.0), CZ - 2.2, CZ + 2.2, r=1.7, ramp="bone", base=7)
        P.flat(g, m, "bone", 7)
        P.flat(g, m & S.seams(g, g.solids[-5:], 0.9), "bone", 5)

    # ---- two rib rails between the posts, darker than the pickets
    for ry, bow in ((8.0, 1.2), (16.0, -1.0)):
        a = S.bar(g, "z", (4.2, ry), (16.0, ry + bow), 2.0, CZ - 1.2, CZ + 1.2, "bone", 5)
        b = S.bar(g, "z", (16.0, ry + bow), (27.8, ry), 2.0, CZ - 1.2, CZ + 1.2, "bone", 5)
        P.flat(g, a | b, "bone", 5)
        P.flat(g, (a | b) & ((X % 5) == 0), "bone", 4)
        P.flat(g, (a | b) & (np.abs(Y + 0.5 - ry) > 0.9), "bone", 4)   # a dark under-edge

    # ---- four sharpened pickets, well apart, in two alternating shades
    for k, px in enumerate(PICKETS):
        lean = 1.6 if k == 2 else 0.0
        sh = 7 if k % 2 else 6
        g.prism("z", [(px - 1.6, 3), (px + 1.6, 3), (px + 1.6 + lean, 19), (px - 1.6 + lean, 19)], CZ - 1.4, CZ + 1.4, C("bone", sh))
        pk = S.last(g)
        g.prism("z", [(px - 1.6 + lean, 19), (px + 1.6 + lean, 19), (px + lean, 23)], CZ - 1.4, CZ + 1.4, C("bone", 7))
        tip = S.last(g)
        P.flat(g, pk, "bone", sh)
        P.flat(g, pk & S.seams(g, g.solids[-2:-1], 0.9), "bone", 4)    # a dark frame down every picket
        P.flat(g, pk & ((Y % 6) == 0), "bone", max(3, sh - 2))
        P.flat(g, pk & (Y < 5), "bone", 5)
        P.flat(g, tip, "bone", 7)
        P.flat(g, tip & S.seams(g, g.solids[-1:], 0.9), "bone", 4)

    # ---- a big skull standing proud of the pickets, lashed on with cord
    sk = big_skull(g, 16.5, 7, 4.4, s=8, base=7, eyes=("toxic", 6), seed=7)
    back = sk & (Z + 0.5 > 4.4 - 1.8)
    P.flat(g, back & (Y < 10), "bone", 5)
    P.flat(g, back & (Y == 10), "bone", 3)
    P.flat(g, back & (Y > 13) & (np.abs(X + 0.5 - 16.5) < 0.6), "bone", 5)
    P.flat(g, sk & (Z + 0.5 > 4.4 + 2.6) & (Y > 11) & (Y < 14), "bone", 5)
    for lx in (12.5, 20.5):   # violet cord lashing the skull to the rails
        cord = (g.a != 0) & (np.abs(X + 0.5 - lx) < 0.9) & (Y > 7) & (Y < 18) & (Z < CZ + 1)
        P.flat(g, cord, "purple", 4)
        P.flat(g, cord & ((Y % 3) == 0), "purple", 6)

    # ---- a small pumpkin at the foot of the right post
    S.pumpkin(g, 22.0, 0, CZ - 3.5, w=7, h=6, ramp="orange", base=4, seed=8)

    from pnpaint import blotch
    blotch(g, stone & (Y < 4), "moss", 5, cell=4, chance=0.18, seed=9)

    return prop("bone-fence", "Bone Fence", g)
