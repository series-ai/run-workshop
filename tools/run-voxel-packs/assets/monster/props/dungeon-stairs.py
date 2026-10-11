"""Dungeon stairs, in the Pirate Nation haunted style (kit piece).

Two PN tiles wide and four long, one kit storey high: eight chunky stone
steps (6 high, 8 deep) rise toward +Z between two parapets whose tops are
true slopes with purple slate coping, on a purple slate plinth course.
A red runner carpet climbs the middle, two torches burn on
the parapets, and a skull and a candle sit on the steps and
moss grows at the foot. Players walk up from the -Z edge; the top step is
level with the kit wall height's next floor (48).
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import KIT_H, big_skull, candle, damp, idx, prop, torch
from pnkit import box
from voxgrid import C, Grid

W, L = 32, 64
STEP_H, STEP_D = 6, 8
PT = 4  # parapet thickness


def build():
    g = Grid(W, KIT_H + 12, L)
    X, Y, Z = idx(g)
    steps = np.zeros(g.shape, dtype=bool)
    for k in range(8):
        y1 = (k + 1) * STEP_H
        z0 = k * STEP_D
        steps |= box(g, PT, 0, z0, W - PT, y1, L, "stone", 5)
    P.stone(g, steps, "stone", 5, block=(8, 3), seed=1)
    nose = steps & np.zeros(g.shape, dtype=bool)
    for k in range(8):
        y1 = (k + 1) * STEP_H
        z0 = k * STEP_D
        nose |= steps & (Y == y1 - 1) & (Z >= z0) & (Z < z0 + 2)
    P.flat(g, nose, "stone", 7)
    # the parapets: a slab whose top is a true slope, and a coping on it
    for x0 in (0, W - PT):
        par = box(g, x0, 0, 0, x0 + PT, 6, L, "gray", 4)
        g.prism("x", [(6, 0), (6 + KIT_H - 4, L - 8), (6 + KIT_H - 4, L), (6, L)], x0, x0 + PT, C("gray", 4))
        pm = S.last(g)
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "gray", 4, block=(8, 4), frame=fr, seed=2))
        g.prism("x", [(6, 0), (8.5, 0), (8.5 + KIT_H - 4, L - 8), (6 + KIT_H - 4, L - 8)], max(0.0, x0 - 0.5), min(float(W), x0 + PT + 0.5), C("purple", 5))
        S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "purple", 5, block=(6, 3), frame=fr, seed=3))
        plin = box(g, x0 - 1 if x0 == 0 else x0, 0, 0, x0 + PT + (1 if x0 else 0), 4, L, "purple", 3)
        P.stone(g, plin, "purple", 3, block=(8, 4), seed=4)
        P.stone(g, par, "gray", 4, block=(8, 4), seed=2)
    # a skull and a candle on the steps
    big_skull(g, 9, 2 * STEP_H, 2 * STEP_D + 4, s=7, base=6, eyes=("toxic", 6))
    candle(g, 22, 4 * STEP_H, 4 * STEP_D + 3, h=5, w=3)
    # a red runner carpet down the middle of the steps, with a gold edge
    rug = steps & (np.abs(X + 0.5 - W / 2) < 6) & ((Y == np.minimum(Z // STEP_D + 1, 8) * STEP_H - 1) | (Z == (Z // STEP_D) * STEP_D))
    P.flat(g, rug, "red", 3)
    P.flat(g, rug & (np.abs(X + 0.5 - W / 2) > 5), "gold", 4)
    damp(g, (g.a > 0) & ((Z < 16) | (X < PT + 1) | (X >= W - PT - 1)), seed=5)
    torch(g, "+x", PT, 40, 30)
    torch(g, "-x", W - PT, 18, 16)
    return prop("dungeon-stairs", "Dungeon Stairs", g)
