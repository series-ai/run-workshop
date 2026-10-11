"""Witch hat stand, in the Pirate Nation haunted style.

A wooden hat tree: a chamfered cross foot, a turned post with gold rings
and three long pegs at three well-separated heights. Each oversized
pointed hat rests on its peg by the brim, clear of the post, and its
crown tapers to a flopped tip that ends in a small knob (rules F2, F4):
violet, moss olive with a toxic band, and magenta. A fourth hat lies
upturned on the cross foot with a broom-straw spilling out. Faces -Z.
"""
from __future__ import annotations

import math

import numpy as np

import paint as P
import pnshapes as S
from _props import idx, planked, plinth, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 44, 42, 44
CX, CZ = 22.0, 22.0
# (peg angle, peg length, brim y, brim radius, crown rise, ramp, shade, band)
HATS = ((-90.0, 12.0, 21, 6.4, 11, "purple", 6, ("gold", 5)),
        (30.0, 12.5, 14, 6.0, 10, "moss", 6, ("toxic", 4)),
        (150.0, 11.5, 5, 5.6, 9, "magenta", 6, ("gold", 5)))


def hat(g, X, Y, Z, cx, cz, y0, r, rise, ramp, base, band, seed):
    """One witch hat resting on its peg: a wide stepped brim, a true cone
    crown with a buckle band, and a tapered tip that flops to one side."""
    start = len(g.solids)
    S.disc(g, "y", cx, cz, r, y0, y0 + 2, ramp, base, n=8)
    brim = union(g, start)
    ring = S.radial(g, "y", cx, cz)
    P.flat(g, brim & (Y == y0 + 1), ramp, min(7, base + 1))
    P.flat(g, brim & (Y == y0), ramp, max(1, base - 3))
    P.flat(g, brim & (Y == y0 + 1) & (ring > r - 1.3), ramp, max(1, base - 2))
    P.flat(g, brim & S.seams(g, g.solids[start:], 0.9), ramp, max(1, base - 2))

    cstart = len(g.solids)
    S.cone(g, "y", cx, cz, r * 0.58, y0 + 2, y0 + 2 + rise, ramp, base, n=8, r_top=r * 0.12)
    crown = union(g, cstart)
    S.paint_facets(g, g.solids[cstart:], lambda gg, mm, fr: P.planks(gg, mm, ramp, base, width=5, across="x", nails=False, frame=fr, seed=seed))
    P.flat(g, crown, ramp, base)
    P.flat(g, crown & S.seams(g, g.solids[cstart:], 0.9), ramp, max(1, base - 2))
    buck = crown & (Y >= y0 + 2) & (Y < y0 + 4)      # the buckle band round the foot of the crown
    P.flat(g, buck, *band)
    P.flat(g, buck & (Y == y0 + 3), band[0], min(7, band[1] + 1))
    P.flat(g, buck & (Y == y0 + 2), band[0], max(1, band[1] - 2))
    P.flat(g, crown & (Y == y0 + 3) & (np.abs(X + 0.5 - cx) < 2.0) & (Z + 0.5 < cz - r * 0.3), band[0], min(7, band[1] + 2))

    # the tip flops to one side in three tapering segments and ends in a knob
    ty = y0 + 2 + rise
    tip = S.bar(g, "z", (cx, ty - 2), (cx + r * 0.80, ty + 1.5), 2.6, cz - 1.3, cz + 1.3, ramp, base)
    tip |= S.bar(g, "z", (cx + r * 0.80, ty + 1.5), (cx + r * 1.25, ty + 0.5), 1.8, cz - 0.9, cz + 0.9, ramp, base)
    tip |= S.bar(g, "z", (cx + r * 1.25, ty + 0.5), (cx + r * 1.45, ty - 1.0), 1.2, cz - 0.6, cz + 0.6, ramp, base)
    P.flat(g, tip & S.seams(g, g.solids[-3:], 0.6), ramp, max(1, base - 2))
    P.flat(g, tip & (Y > ty + 0.5), ramp, min(7, base + 1))
    return brim | crown | tip


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the cross foot and the post
    for deg in (0.0, 90.0, 180.0, 270.0):
        a = math.radians(deg)
        S.bar(g, "y", (CX, CZ), (CX + math.cos(a) * 9, CZ + math.sin(a) * 9), 4.0, 0, 3, "wood", 5)
        foot = S.last(g)
        P.flat(g, foot & (Y == 2), "wood", 6)
        P.flat(g, foot & (Y == 0), "wood", 2)
        P.flat(g, foot & S.seams(g, g.solids[-1:], 0.9), "wood", 2)
    plinth(g, CX - 3.5, CZ - 3.5, CX + 3.5, CZ + 3.5, 2, 3, "wood", 5, bevel=1.0, seed=1)
    post = S.disc(g, "y", CX, CZ, 2.6, 4, 33, "wood", 6, n=8)
    P.planks(g, post, "wood", 6, width=4, across="y", nails=False, seed=2)
    P.flat(g, post & S.seams(g, g.solids[-1:], 0.9), "wood", 3)
    for yb in (9, 18, 27):
        P.flat(g, post & (Y == yb), "gold", 4)
        P.flat(g, post & (Y == yb + 1), "gold", 6)
    knob = S.disc(g, "y", CX, CZ, 3.4, 33, 36, "wood", 6, n=8)
    P.flat(g, knob & (Y == 35), "gold", 5)
    P.flat(g, knob & (Y == 33), "wood", 3)

    # ---- three long pegs and three hats, each clear of the post
    for hk, (deg, plen, hy, hr, hrise, ramp, base, band) in enumerate(HATS):
        a = math.radians(deg)
        px, pz = CX + math.cos(a) * plen, CZ + math.sin(a) * plen
        S.bar(g, "y", (CX, CZ), (px, pz), 2.6, hy, hy + 2, "wood", 6)
        peg = S.last(g)
        P.flat(g, peg & (Y == hy + 1), "wood", 7)
        P.flat(g, peg & (Y == hy), "wood", 3)
        hat(g, X, Y, Z, px, pz, hy + 2, hr, hrise, ramp, base, band, seed=3 + hk * 4)

    # ---- a fourth hat lying upturned on the cross foot
    start = len(g.solids)
    S.disc(g, "y", CX + 7.0, CZ + 7.0, 5.0, 3, 5, "purple", 4, n=8)
    S.cone(g, "y", CX + 7.0, CZ + 7.0, 3.0, 5, 9, "purple", 4, n=8, r_top=1.2)
    down = union(g, start)
    P.flat(g, down, "purple", 4)
    P.flat(g, down & S.seams(g, g.solids[start:], 0.9), "purple", 2)
    P.flat(g, down & (Y == 4), "purple", 5)
    P.flat(g, down & (Y == 8), "bone", 6)
    for k in range(5):
        box(g, CX + 5 + k, 8, CZ + 6, CX + 6 + k, 10 + (k % 3), CZ + 7, "khaki", 5 + k % 2)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 3), "moss", 5, cell=3, chance=0.10, seed=9)

    return prop("witch-hat-stand", "Witch Hat Stand", g)
