"""Rusted graveyard gate, in the Pirate Nation haunted style.

A walk-through gate (class door): two chunky mid-grey stone piers with
gold rings and oversized bone skull finials, a faceted iron arch between
them carrying a gold medallion with a painted bat, and two gate leaves of
few, bold rusted bars with spear tops inside a dark iron frame. The right
leaf sags off its broken hinge, so the gate is not a symmetric box (rule
F5). A clean rust band runs along the foot of each leaf and moss gathers
in deliberate patches at the base of the piers. Faces -Z.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import big_skull, idx, masonry, plinth, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 64, 60, 22
CZ = 11.0
PIER = (7.0, 57.0)
MID = 32.0
RUST = ("rust", 3)


def pier(g, X, Y, Z, cx, seed):
    plinth(g, cx - 7, CZ - 7, cx + 7, CZ + 7, 0, 5, "gray", 5, bevel=2.0, seed=seed)
    start = len(g.solids)
    g.prism("y", [(cx - 6, CZ - 6), (cx + 6, CZ - 6), (cx + 6, CZ + 6), (cx - 6, CZ + 6)], 5, 40, C("gray", 5),
            top=[(cx - 5, CZ - 5), (cx + 5, CZ - 5), (cx + 5, CZ + 5), (cx - 5, CZ + 5)])
    shaft = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(7, 5), cracks=0.07, frame=fr, seed=seed + 1))
    P.flat(g, shaft & S.seams(g, g.solids[start:], 0.9), "gray", 3)
    plinth(g, cx - 6, CZ - 6, cx + 6, CZ + 6, 40, 4, "gray", 6, bevel=1.6, seed=seed + 2)
    for yb in (13, 27):
        ring = box(g, cx - 7, yb, CZ - 7, cx + 7, yb + 3, CZ + 7, "gold", 4)
        P.flat(g, edges(ring), "gold", 2)
        P.flat(g, ring & (Y == yb + 2), "gold", 6)
        P.flat(g, ring & (Y == yb), "gold", 2)
    # an oversized bone skull finial with deep sockets, a nose and teeth
    sk = big_skull(g, cx, 44, CZ, s=11, base=7, eyes=("toxic", 6), seed=seed + 3)
    back = sk & (Z + 0.5 > CZ - 2.4)
    P.flat(g, back & (Y < 47), "bone", 5)
    P.flat(g, back & (Y == 47), "bone", 3)
    P.flat(g, back & (Y > 50) & (np.abs(X + 0.5 - cx) < 0.6), "bone", 5)
    P.flat(g, sk & (Z + 0.5 > CZ + 3.4) & (Y > 48) & (Y < 52), "bone", 5)
    return sk


def leaf(g, X, Y, Z, x0, x1, sag, seed):
    """One gate leaf: a dark iron frame round few, bold rust bars with spear
    tops. `sag` drops the free edge, so the leaf hangs crooked."""
    z0, z1 = CZ - 2.5, CZ + 2.5
    start = len(g.solids)
    for lo, hi in ((5, 9), (24, 28)):   # two bold rails
        g.prism("z", [(x0, lo), (x1, lo - sag), (x1, hi - sag), (x0, hi)], z0, z1, C(*RUST))
    g.prism("z", [(x0, 5), (x0 + 4, 5), (x0 + 4, 35), (x0, 35)], z0, z1, C(*RUST))
    g.prism("z", [(x1 - 4, 5 - sag), (x1, 5 - sag), (x1, 35 - sag), (x1 - 4, 35 - sag)], z0, z1, C(*RUST))
    frame = union(g, start)
    P.plates(g, frame, RUST[0], RUST[1], size=(7, 8), rivets=True, seed=seed)
    P.flat(g, frame & (Y > 9), "rust", 3)
    P.flat(g, frame & S.seams(g, g.solids[start:], 0.9), "iron", 4)   # a dark iron edge round the frame
    P.outline(g, frame & (Z == int(z0)), "iron", 4, normal="z")
    P.outline(g, frame & (Z == int(z1) - 1), "iron", 4, normal="z")

    bstart = len(g.solids)
    span = x1 - x0 - 10
    n = 3
    for k in range(n):
        bx = x0 + 6.0 + k * (span / max(1, n - 1))
        d = sag * (bx - x0) / max(1.0, x1 - x0)
        g.prism("z", [(bx - 1.5, 6 - d), (bx + 1.5, 6 - d), (bx + 1.5, 37 - d), (bx - 1.5, 37 - d)], CZ - 1.8, CZ + 1.8, C("rust", 6))
        g.prism("z", [(bx - 2.5, 37 - d), (bx + 2.5, 37 - d), (bx, 43 - d)], CZ - 1.8, CZ + 1.8, C("rust", 6))
    bars = union(g, bstart)
    P.flat(g, bars, "rust", 6)
    P.flat(g, bars & S.seams(g, g.solids[bstart:], 0.9), "rust", 3)
    P.flat(g, bars & (Y > 37), "gold", 4)
    P.flat(g, bars & (Y > 40), "gold", 6)
    m = frame | bars
    P.flat(g, m & (Y < 8), "rust", 3)            # a clean rust band along the foot
    P.flat(g, m & (Y >= 8) & (Y < 10), "rust", 4)
    return m


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    for k, cx in enumerate(PIER):
        pier(g, X, Y, Z, cx, seed=1 + k * 4)

    leaf(g, X, Y, Z, 14, 32, 0, seed=11)
    leaf(g, X, Y, Z, 33, 50, 3, seed=13)

    # ---- a faceted iron arch between the piers
    start = len(g.solids)
    r, cy = 19.0, 35.0
    pts = [(MID + math.cos(math.radians(a)) * r, cy + math.sin(math.radians(a)) * r) for a in range(0, 181, 22)]
    for p0, p1 in zip(pts, pts[1:]):
        S.bar(g, "z", p0, p1, 3.4, CZ - 2.5, CZ + 2.5, "iron", 7)
    archm = union(g, start)
    P.plates(g, archm, "iron", 7, size=(5, 4), rivets=True, seed=17)
    P.flat(g, archm & S.seams(g, g.solids[start:], 0.9), "iron", 4)
    P.flat(g, archm & (Y > cy + r - 4), "iron", 7)

    # ---- the gold medallion hanging under the crown of the arch
    med = S.disc(g, "z", MID, cy + r - 9, 6.0, CZ - 2.5, CZ + 2.5, "gold", 4, n=8)
    P.flat(g, med & (S.radial(g, "z", MID, cy + r - 9) < 4.4), "purple", 2)
    P.flat(g, med & (Z == int(CZ) + 2), "gold", 6)
    P.flat(g, med & (Z == int(CZ) - 3), "gold", 5)
    pnglyph.icon(g, "-z", CZ - 3, int(MID) - 6, int(cy + r) - 13, "bat", "gold", 6, depth=2)
    box(g, MID - 1.5, cy + r - 4, CZ - 2, MID + 1.5, cy + r - 2, CZ + 2, "gold", 3)

    # ---- the broken hinge the right leaf hangs from
    hinge = box(g, 49, 14, CZ - 5, 54, 19, CZ + 5, "iron", 7)
    P.flat(g, edges(hinge), "iron", 4)
    P.flat(g, hinge & (Y == 18), "iron", 7)
    P.flat(g, hinge & (Y == 15), "rust", 4)

    # ---- moss gathered along the foot of the stone, in a few deliberate patches
    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 6), "moss", 5, cell=4, chance=0.12, seed=20)

    return prop("rusted-gate", "Rusted Gate", g)
