"""Pillory stocks, in the Pirate Nation haunted style.

A planked stage with two thick posts under a little steep purple roof
(true slopes). Between the posts a split timber board with a head hole and
two hand holes (neck hole at 22, where a person bends into it): each
hole is cut 1 voxel into both faces over a dark shadow disc, with a
darker wood rim, so the three holes read from the front, iron
straps and a gold padlock. A notice with a skull is nailed to a post and a
rotten pumpkin lies at the foot. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid


def build():
    g = Grid(38, 42, 18)
    X, Y, Z = idx(g)
    cz = 9
    stage = box(g, 0, 0, 1, 38, 3, 17, "wood", 5)
    planked(g, stage, "wood", 5, width=3, across="x", frame="top", seed=1)
    posts = box(g, 3, 3, cz - 2, 7, 31, cz + 2, "wood", 4) | box(g, 31, 3, cz - 2, 35, 31, cz + 2, "wood", 4)
    planked(g, posts, "wood", 4, width=4, across="x", nails=False, seed=2)
    # the split board with three holes (boxes can be carved; prisms cannot)
    board = box(g, 7, 16, cz - 2, 31, 27, cz + 2, "wood", 7)
    planked(g, board, "wood", 7, width=3, across="y", seed=3)
    # three round holes, 2 voxels deep from each face; the middle of the
    # board stays as a dark shadow disc, so the holes read from every side
    HOLES = ((19, 3.9), (11.5, 2.5), (26.5, 2.5))
    rr = [np.hypot(X + 0.5 - hx, Y + 0.5 - 22) for hx, _r in HOLES]
    holes = np.logical_or.reduce([d < r for d, (_hx, r) in zip(rr, HOLES)])
    rimh = board & ~holes & np.logical_or.reduce([d < r + 1.1 for d, (_hx, r) in zip(rr, HOLES)])
    face = (Z == cz - 2) | (Z == cz + 1)
    g.carve(board & holes & face)
    board &= ~(holes & face)
    P.flat(g, board & holes, "darkwood", 5)
    P.flat(g, board & holes & (Y + 0.5 > 22 + 1.2), "darkwood", 3)
    P.flat(g, rimh, "wood", 5)
    P.flat(g, board & (Y == 22) & ~holes, "wood", 4)
    straps = board & ((X == 8) | (X == 9) | (X == 29) | (X == 30))
    P.flat(g, straps, "iron", 6)
    lock = box(g, 17.5, 16.5, cz - 3, 20.5, 19.5, cz - 2, "gold", 5)
    P.flat(g, lock & (Y == 17) & (X == 19), "gold", 2)
    # the little roof (true slopes) with gable boards
    ey, ry, th = 31, 37, 2.0
    for s in (-1, 1):
        g.prism("x", [(ey, cz + s * 6), (ey + th, cz + s * 6), (ry + th, cz), (ry, cz)], 1, 37, C("purple", 4))
    roof = union(g, len(g.solids) - 2)
    S.paint_facets(g, g.solids[-2:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=4))
    P.flat(g, roof & ((X < 3) | (X >= 35)), "wood", 6)
    box(g, 0.5, ry + 1, cz - 1, 37.5, ry + 2, cz + 1, "wood", 6)
    # the notice on the left post: a skull
    note = box(g, 3.5, 10, cz - 3, 6.5, 16, cz - 2, "bone", 7)
    P.flat(g, note & (Y == 15), "blood", 4)
    P.flat(g, note & (Y == 12) & (X == 5), "gray", 2)
    P.flat(g, note & (Y == 13) & ((X == 4) | (X == 6)), "gray", 2)
    # a rotten pumpkin and a tomato at the foot
    S.pumpkin(g, 25, 3, 4, w=8, h=6, ramp="orange", base=3, stem="moss", seed=5)
    P.flat(g, (g.a == C("orange", 3)) & ((P._hash(X, Y, Z, seed=6) % np.uint64(5)) == 0), "moss", 5)
    box(g, 12, 3, 3, 15, 5, 6, "red", 4)
    return prop("stocks", "Pillory Stocks", g)
