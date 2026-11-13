"""Skeleton chair, in the Pirate Nation haunted style.

A throne built out of bones (rule K3): four thick femur legs with knuckle
ends, a pelvis seat plate under a violet velvet cushion, and a back made
of one spine column with three pairs of ribs that curve forward with a
clear dark gap between every rib, so the cage reads at 128 px. Two arm
bones stand clear of the cage on their own knuckle posts, and a big
skull with a heavy brow, cheekbones, a jaw and toxic-green eyes crowns
it. Magenta cord lashes the cage to the spine and moss grows on the
feet. Every mass is framed in a dark bone tone (rule S4). Faces -Z.

Size (class seat): the cushion top is at 10 and the skull top at about 27,
so a 36-voxel person can sit on it.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _props import big_skull, bone, idx, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 24, 32, 24
CX = CZ = 12.0
SEAT = 6        # the seat plate starts here; the cushion top is at SEAT + 4
BACK_Z = 17.0   # the plane of the spine
SK_Y = SEAT + 11  # the skull stands on the top of the spine


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- four femur legs with knuckle ends
    for lx, lz, tilt in ((6, 6, -0.8), (18, 6, 0.8), (6, 18, -0.8), (18, 18, 0.8)):
        m = bone(g, "z", (lx + tilt, 2.04), (lx, SEAT), lz - 1.6, lz + 1.6, r=1.6, ramp="bone", base=6)
        P.flat(g, m & (Y < 4), "bone", 4)

    # ---- the pelvis seat plate and the violet cushion (seat top at 10)
    seat = box(g, 3, SEAT, 3, 21, SEAT + 2, 21, "bone", 6)
    P.stone(g, seat, "bone", 6, block=(6, 4), cracks=0.0, seed=1)
    P.flat(g, edges(seat), "bone", 3)
    P.flat(g, seat & (Y == SEAT), "bone", 3)
    pad = box(g, 4, SEAT + 2, 4, 20, SEAT + 4, 20, "purple", 5)
    P.flat(g, pad & (Y == SEAT + 3), "purple", 6)
    P.flat(g, edges(pad), "purple", 2)
    P.flat(g, pad & (Y == SEAT + 2), "purple", 2)
    for tx in (7.5, 12.0, 16.5):  # gold buttons sunk in the velvet
        for tz in (8.0, 14.0):
            P.flat(g, pad & (Y == SEAT + 3) & (np.abs(X + 0.5 - tx) < 1.0) & (np.abs(Z + 0.5 - tz) < 1.0), "gold", 5)

    # ---- the spine column up the back
    spine = box(g, CX - 1.8, SEAT + 4, BACK_Z, CX + 1.8, SK_Y, BACK_Z + 3.5, "bone", 6)
    for vy in range(SEAT + 5, SK_Y, 2):  # vertebrae, with a dark gap between each
        P.flat(g, spine & (Y == vy), "bone", 3)
    P.flat(g, edges(spine), "bone", 3)

    # ---- three pairs of ribs curving forward, each with its own dark gap
    for ry, span, drop in ((SEAT + 6, 6.6, 2.0), (SEAT + 8.5, 7.2, 2.2), (SEAT + 11, 6.4, 2.0)):
        for s in (-1, 1):
            p0 = (CX + s * 1.6, ry + 1.2)
            p1 = (CX + s * span, ry + 0.3)
            p2 = (CX + s * (span - 1.0), ry - drop)
            rb = S.bar(g, "z", p0, p1, 1.7, BACK_Z - 4.0, BACK_Z + 1.0, "bone", 7)
            rb |= S.bar(g, "z", p1, p2, 1.6, BACK_Z - 4.0, BACK_Z + 1.0, "bone", 7)
            P.flat(g, rb, "bone", 7)
            P.flat(g, rb & (Y <= ry - drop + 1.0), "bone", 3)          # a deep shadow under every rib
            P.flat(g, rb & S.seams(g, g.solids[-2:], 0.9), "bone", 4)
            P.flat(g, rb & (Z + 0.5 < BACK_Z - 3.3), "bone", 6)
    # a sternum plate closing the front of the cage
    stern = box(g, CX - 1.6, SEAT + 5, BACK_Z - 4.5, CX + 1.6, SEAT + 11, BACK_Z - 3.3, "bone", 7)
    P.flat(g, edges(stern), "bone", 3)
    P.flat(g, stern & ((Y % 3) == 0), "bone", 4)
    for cx in (CX - 3.0, CX + 3.0):  # two magenta cords lashing the ribs to the spine
        cord = (g.a != 0) & (np.abs(X + 0.5 - cx) < 0.6) & (Z + 0.5 > BACK_Z - 5.0) \
            & (Y > SEAT + 4) & (Y < SK_Y)
        P.flat(g, cord, "magenta", 4)
        P.flat(g, cord & (Z + 0.5 < BACK_Z - 2.5), "magenta", 6)

    # ---- two arm bones on their own knuckle posts, clear of the cage
    for s in (-1, 1):
        px = CX + s * 7.4
        post = box(g, px - 1.5, SEAT + 4, 5.5, px + 1.5, SEAT + 7, 8.5, "bone", 6)
        P.flat(g, edges(post), "bone", 3)
        P.flat(g, post & (Y == SEAT + 6), "bone", 7)
        m = bone(g, "x", (SEAT + 7, 6.0), (SEAT + 8, 15.5), px - 1.4, px + 1.4, r=1.4, ramp="bone", base=7)
        P.flat(g, m & (Y == SEAT + 7), "bone", 4)

    # ---- the skull crest, with a brow, cheekbones and a jaw
    skz = BACK_Z - 1.5
    sk = big_skull(g, CX, SK_Y, skz, s=8, base=7, eyes=("toxic", 6), seed=3)
    back = sk & (Z + 0.5 > skz - 2.0)
    P.flat(g, back & (Y < SK_Y + 2), "bone", 5)
    P.flat(g, back & (Y == SK_Y + 2), "bone", 3)
    P.flat(g, back & (Y > SK_Y + 5) & (np.abs(X + 0.5 - CX) < 0.6), "bone", 5)
    P.flat(g, sk & (np.abs(Z + 0.5 - (skz - 3.4)) < 0.7) & (Y > SK_Y + 6) & (Y < SK_Y + 8), "bone", 5)
    P.flat(g, sk & (Z + 0.5 > skz + 2.2) & (Y > SK_Y + 3) & (Y < SK_Y + 6), "bone", 5)
    for pl in (CX - 4.5, CX + 3.5):  # sockets painted on both side faces as well
        side = sk & (np.abs(X - pl) < 0.6) & (np.abs(Y + 0.5 - (SK_Y + 5)) < 1.3) & (np.abs(Z + 0.5 - (skz - 1.8)) < 1.3)
        P.flat(g, side, "purple", 1)
        P.flat(g, side & (np.abs(Y + 0.5 - (SK_Y + 5)) < 0.7) & (np.abs(Z + 0.5 - (skz - 1.8)) < 0.7), "toxic", 6)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=3, chance=0.12, seed=5)

    return prop("skeleton-chair", "Skeleton Chair", g)
