"""Coffin lid pile, in the Pirate Nation haunted style.

Three PN coffin lids stacked and leaning against a short stone wall: the
top one lies flat with its gold cross up, the second leans back at an
angle, the third is split in two with a dark gap and a broken board. A
grave shovel leans on the pile, dirt and moss gather at the foot and a
skull peers out of the gap. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _props import coffin_poly, idx, masonry, offset_poly, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 36, 28, 28
WOOD = ("wood", 4)


def lid(g, X, Y, Z, cx, cz, L, Wd, y0, thick, turn, seed, cross=True):
    """One coffin lid: a long hexagon of dark boards with a gold cross."""
    poly = S.rotate(coffin_poly(cx, cz, L, Wd, "x"), cx, cz, turn)
    g.prism("y", poly, y0, y0 + thick, C(*WOOD))
    m = S.last(g)
    P.planks(g, m, WOOD[0], WOOD[1], width=4, across="y", nails=True, frame="top", seed=seed)
    P.flat(g, m & (Y == y0), "wood", 2)
    P.flat(g, m & (Y == y0 + thick - 1), "wood", 6)
    P.flat(g, m & S.seams(g, g.solids[-1:], 0.3), "wood", 2)
    if cross:
        top = m & (Y == y0 + thick - 1)
        ux = (X + 0.5 - cx) * np.cos(np.radians(-turn)) - (Z + 0.5 - cz) * np.sin(np.radians(-turn))
        uz = (X + 0.5 - cx) * np.sin(np.radians(-turn)) + (Z + 0.5 - cz) * np.cos(np.radians(-turn))
        P.flat(g, top & (np.abs(uz) < 1.2) & (np.abs(ux + L * 0.06) < L * 0.3), "gold", 5)
        P.flat(g, top & (np.abs(ux + L * 0.22) < 1.2) & (np.abs(uz) < Wd * 0.28), "gold", 5)
        P.flat(g, top & (np.abs(uz) < 0.6) & (np.abs(ux + L * 0.06) < L * 0.3), "gold", 7)
    return m


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- a low stone wall for the pile to lean on
    wall = box(g, 1, 0, 23, 35, 10, 27, "gray", 5)
    masonry(g, wall, "gray", 5, block=(8, 4), seed=1)
    cap = box(g, 0, 10, 22, 36, 12, 28, "gray", 6)
    P.stone(g, cap, "gray", 6, block=(6, 3), frame="top", seed=2)
    P.flat(g, cap & (Y == 11), "gray", 7)

    # ---- the ground pile: dirt under the lids
    dirt = S.disc(g, "y", 17, 12, 11.0, 0, 2, "wood", 3, n=8)
    P.mottle(g, dirt, "wood", 3, cell=2, seed=3)
    P.flat(g, dirt & (Y == 1), "wood", 4)

    # ---- three lids: one flat, one leaning, one split
    lid(g, X, Y, Z, 16.0, 9.0, 26.0, 13.0, 2, 3, -6.0, 4)
    lid(g, X, Y, Z, 17.5, 11.5, 25.0, 12.0, 5, 3, 7.0, 5)
    # two whole lids stand upright against the wall, leaning apart
    for cx, turn, zlo in ((11.0, -7.0, 19.0), (25.0, 6.0, 20.0)):
        poly = S.rotate(coffin_poly(cx, 14.0, 22.0, 12.0, "z"), cx, 14.0, turn)
        g.prism("z", poly, zlo, zlo + 3, C(*WOOD))
        up = S.last(g)
        P.planks(g, up, WOOD[0], WOOD[1], width=4, across="y", nails=True, frame="z", seed=6 + int(cx))
        P.flat(g, up & S.seams(g, g.solids[-1:], 0.3), "wood", 2)
        face = up & (Z == int(zlo))
        P.flat(g, face, "wood", 5)
        ux = (X + 0.5 - cx) * np.cos(np.radians(-turn)) - (Y + 0.5 - 14.0) * np.sin(np.radians(-turn))
        uy = (X + 0.5 - cx) * np.sin(np.radians(-turn)) + (Y + 0.5 - 14.0) * np.cos(np.radians(-turn))
        P.flat(g, face & (np.abs(ux) < 1.2) & (np.abs(uy + 1.0) < 7.0), "gold", 5)
        P.flat(g, face & (np.abs(uy - 3.0) < 1.2) & (np.abs(ux) < 3.4), "gold", 5)
        P.flat(g, face & (np.abs(ux) < 0.6) & (np.abs(uy + 1.0) < 7.0), "gold", 7)
    # a skull peering out of the gap between the two upright lids
    S.skull(g, 18.0, 7, 17.5, s=6, ramp="bone", base=6, eyes=("toxic", 6), socket=("purple", 1), seed=8)

    # ---- a grave shovel leaning on the pile
    S.bar(g, "x", (6, 6.0), (22, 2.0), 2.2, 30, 32, "wood", 6)
    shaft = S.last(g)
    P.flat(g, shaft & ((Y % 5) == 0), "wood", 3)
    blade = box(g, 29, 2, 4, 34, 4, 10, "steel", 5)
    P.plates(g, blade, "steel", 5, size=(4, 4), rivets=False, seed=9)
    P.flat(g, blade & (Y == 3), "steel", 7)
    P.flat(g, edges(blade), "steel", 2)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=2, chance=0.2, seed=10)

    return prop("coffin-lid-pile", "Coffin Lid Pile", g)
