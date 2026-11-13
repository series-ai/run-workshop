"""Shackle post, in the Pirate Nation haunted style.

A thick iron-banded timber post on a stone foot with a crossbeam and true
diagonal braces (a gibbet). Chains hang from both beam ends with open
manacles at raised-arm height; a key ring hangs on a nail and ankle irons
lie on a straw pile with a skull at the foot. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import big_skull, chain, idx, mound, planked, plinth, prop, shackle
from pnkit import box
from voxgrid import C, Grid


def build():
    g = Grid(34, 42, 18)
    X, Y, Z = idx(g)
    cx, cz = 17, 9
    # a straw pile round the foot
    mound(g, cx + 3, cz, 8, 3, top=0.5, ramp="sand", base=4, moss=0.0, seed=1)
    P.flat(g, (g.a == C("sand", 4)) & ((X + Y * 2) % 3 == 0), "sand", 5)
    plinth(g, cx - 5, cz - 5, cx + 5, cz + 5, 0, 4, "gray", 4, bevel=1, seed=2)
    post = box(g, cx - 3, 4, cz - 3, cx + 3, 38, cz + 3, "wood", 4)
    planked(g, post, "wood", 4, width=3, across="x", nails=False, seed=3)
    for by in (10, 22):
        box(g, cx - 3.5, by, cz - 3.5, cx + 3.5, by + 2, cz + 3.5, "iron", 6)
    beam = box(g, 2, 34, cz - 2.5, 32, 39, cz + 2.5, "wood", 5)
    planked(g, beam, "wood", 5, width=5, across="y", seed=4)
    for s in (-1, 1):
        S.bar(g, "z", (cx + s * 3, 26), (cx + s * 10, 34), 2.6, cz - 1.5, cz + 1.5, "wood", 4)
        ex = cx + s * 13
        box(g, ex - 1.5, 32, cz - 1.5, ex + 1.5, 34, cz + 1.5, "iron", 6)  # the ring bolt
        chain(g, ex, cz, 32, 3, "iron", 6)
        shackle(g, ex, 24.5, cz, "iron", 6, face="z")
    # the key ring on a nail
    box(g, cx - 1, 28, cz - 4, cx, 29, cz - 3, "iron", 5)
    S.disc(g, "z", cx - 0.5, 25.5, 2, cz - 4.5, cz - 3.5, "gold", 4)
    P.flat(g, (Y == 25) & (X == cx - 1) & (Z == cz - 5), "gold", 4)
    box(g, cx - 1, 21, cz - 5, cx, 24, cz - 4, "gold", 5)
    # ankle irons and a skull on the straw
    shackle(g, cx + 8, 4, cz - 4, "iron", 6, face="y")
    shackle(g, cx + 11, 4, cz - 1, "iron", 6, face="y")
    big_skull(g, cx - 9, 0, cz - 2, s=7, base=6, eyes=("toxic", 6))
    return prop("shackle-post", "Shackle Post", g)
