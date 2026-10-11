"""Gibbet cage, in the Pirate Nation haunted style.

After PN deco-hangingcage: a thick wooden gallows (a 4-thick post on a
crossed foot, a long arm and true-slope diagonal braces) on a low plank
deck, a chunky chain and hook, and an iron bird-cage with 2-thick bars,
bands and a faceted dome top (a frustum under a pyramid, true slopes).
Inside sits a caricature skeleton with an oversized skull that grips the
bars; bones and a second skull lie on the deck by the post. The cage door
(two front bars) swings open on its left edge. Clips: open, close
(one-shot), idle (the chain and the cage sway). Faces -Z.
"""
import numpy as np

import paint as P
from _kit import keys, sway, world
from _life import chain
from _pn import assemble, coords, last, quad
from pnkit import box
from pnshapes import facets, skull
from voxgrid import C, Clip, Grid

S = (42, 50, 24)
PX0, PX1 = 5, 9  # the post (x); its z is PZ0..PZ1
PZ0, PZ1 = 10, 14
CZ = 11.5
ARM_Y0, ARM_Y1, ARM_X1 = 44, 48, 40
CX = 29.5  # cage centre (x)
C0, C1 = 21, 38  # cage x span
Z0, Z1 = 3, 20  # cage z span
FLOOR0, FLOOR1 = 10, 12
BAND = (20, 22)
RING0, RING1 = 30, 32
DOME0, DOME1, APEX = 32, 35, 38
EYE1 = 40
DOOR0, DOOR1 = 26, 33  # the door's x span (two front bars)


def wood(g: Grid, m: np.ndarray, seed: int, across: str = "y") -> None:
    P.planks(g, m, "skindark", 4, width=4, across=across, length=(10, 16), seed=seed)


def gallows() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # a low plank deck under it all
    deck = box(g, 1, 0, 2, 41, 2, 22, "skindark", 3)
    P.planks(g, deck, "skindark", 3, width=3, across="y", length=(12, 20), seed=1)
    P.flat(g, deck & (Y == 0), "skindark", 2)
    # crossed foot beams and the post
    foot = box(g, 1, 2, PZ0, 14, 5, PZ1, "wood", 5) | box(g, PX0, 2, 4, PX1, 5, 20, "wood", 5)
    wood(g, foot, 2, across="y")
    post = box(g, PX0, 5, PZ0, PX1, ARM_Y1, PZ1, "wood", 5)
    wood(g, post, 3, across="x")
    arm = box(g, PX0 - 1, ARM_Y0, PZ0, ARM_X1, ARM_Y1, PZ1, "wood", 5)
    wood(g, arm, 4, across="y")
    P.flat(g, arm & (X >= ARM_X1 - 1), "skindark", 3)
    # diagonal braces (true slopes): arm brace and two foot braces
    braces = []
    g.prism("z", quad((PX1 - 0.5, 33.0), (PX1 + 10.0, ARM_Y0 + 0.5), 1.6), PZ0 + 0.5, PZ1 - 0.5, C("wood", 5))
    braces.append(g.solids[-1])
    g.prism("z", quad((1.5, 5.0), (PX0 + 0.5, 12.0), 1.3), PZ0 + 0.5, PZ1 - 0.5, C("wood", 5))
    braces.append(g.solids[-1])
    g.prism("z", quad((PX1 - 0.5, 12.0), (13.0, 5.0), 1.3), PZ0 + 0.5, PZ1 - 0.5, C("wood", 5))
    braces.append(g.solids[-1])
    for fm, fr in facets(g, braces):
        P.planks(g, fm, "skindark", 5, width=3, across="y", length=(30, 31), nails=False, frame=fr, seed=5)
    # iron brackets at the joints (painted plates)
    for bm in (post & (Y >= ARM_Y0 - 3) & (Y < ARM_Y0), arm & (X >= CX - 3) & (X < CX + 3)):
        P.flat(g, bm, "gray", 5)
        P.flat(g, bm & ((X + Y + Z) % 3 == 0), "gray", 6)
    # a skull and a few bones on the deck by the post
    skull(g, 17.0, 2, 8.0, s=6, eyes=("toxic", 6), seed=6)
    for p0, p1 in (((13.0, 14.0), (20.0, 17.0)), ((16.0, 12.5), (18.5, 18.0))):
        g.prism("y", quad(p0, p1, 0.7), 2, 3, C("bone", 6))
        for end in (p0, p1):
            box(g, end[0] - 1, 2, end[1] - 1, end[0] + 1, 4, end[1] + 1, "bone", 7)
    P.grime(g, post, height=5, seed=7)
    return g


def hanger() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = chain(g, (CX - 0.5, ARM_Y0 - 1, CZ - 0.5), (CX - 0.5, EYE1 + 1, CZ - 0.5), link=3, ramp="gray", shade=5)
    hook = box(g, CX - 2, ARM_Y0 - 1, CZ - 2, CX + 2, ARM_Y0, CZ + 2, "gray", 4)
    P.flat(g, m & (X == int(CX) - 1), "gray", 6)
    return g


def bars_side(g: Grid, axis: str, fixed0: int, fixed1: int, lo: int, hi: int, skip=None) -> np.ndarray:
    """Vertical 2x2 bars along one side of the cage: every 4 voxels from lo
    to hi (bars at lo, lo+4, ...), leaving out [skip) along the side."""
    m = np.zeros(g.shape, dtype=bool)
    for u in range(lo, hi - 1, 5):
        if skip and skip[0] <= u < skip[1]:
            continue
        if axis == "x":
            m |= box(g, u, FLOOR1, fixed0, u + 2, RING0, fixed1, "gray", 4)
        else:
            m |= box(g, fixed0, FLOOR1, u, fixed1, RING0, u + 2, "gray", 4)
    return m


def cage() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    fl = box(g, C0, FLOOR0, Z0, C1, FLOOR1, Z1, "gray", 4)
    P.plates(g, fl, "gray", 4, size=(7, 7), seed=8)
    # a glowing toxic puddle on the cage floor lights the skeleton (C3)
    rad = np.hypot((X + 0.5 - CX) / 6.5, (Z + 0.5 - (Z0 + Z1) / 2) / 6.0)
    goo = fl & (Y == FLOOR1 - 1) & (rad < 1.0) & ~((rad > 0.8) & ((P._hash(X, Z, seed=11) % np.uint64(2)) == 0))
    P.flat(g, goo, "toxic", 5)
    P.flat(g, goo & ((P._hash(X // 2, Z // 2, seed=12) % np.uint64(4)) == 0), "toxic", 7)
    drip = fl & (Y == FLOOR0) & (np.abs(X + 0.5 - CX) < 1.1) & (np.abs(Z + 0.5 - (Z0 + Z1) / 2) < 1.1)
    P.flat(g, drip, "toxic", 6)
    bars = bars_side(g, "x", Z0, Z0 + 2, C0, C1, skip=(DOOR0, DOOR1))
    bars |= bars_side(g, "x", Z1 - 2, Z1, C0, C1)
    bars |= bars_side(g, "z", C0, C0 + 2, Z0, Z1)
    bars |= bars_side(g, "z", C1 - 2, C1, Z0, Z1)
    # the middle band and the top ring (the front band stops at the door)
    band = np.zeros(g.shape, dtype=bool)
    for y0, y1 in (BAND, (RING0, RING1)):
        band |= box(g, C0, y0, Z1 - 2, C1, y1, Z1, "gray", 5)
        band |= box(g, C0, y0, Z0, C0 + 2, y1, Z1, "gray", 5)
        band |= box(g, C1 - 2, y0, Z0, C1, y1, Z1, "gray", 5)
        band |= box(g, C0, y0, Z0, DOOR0, y1, Z0 + 2, "gray", 5)
        band |= box(g, DOOR1, y0, Z0, C1, y1, Z0 + 2, "gray", 5)
    P.flat(g, bars & ((X + Z) % 2 == 0), "gray", 5)
    P.flat(g, band & (Y == BAND[1] - 1), "gray", 6)
    P.flat(g, band & ((X + Z) % 4 == 0) & (Y == BAND[0]), "gray", 6)
    # the faceted dome: a frustum under a pyramid, plated, with an eye on top
    sq = [(C0 - 0.5, Z0 - 0.5), (C1 + 0.5, Z0 - 0.5), (C1 + 0.5, Z1 + 0.5), (C0 - 0.5, Z1 + 0.5)]
    mid = [(C0 + 2.5, Z0 + 2.5), (C1 - 2.5, Z0 + 2.5), (C1 - 2.5, Z1 - 2.5), (C0 + 2.5, Z1 - 2.5)]
    g.prism("y", sq, DOME0, DOME1, C("gray", 4), top=mid)
    d1 = g.solids[-1]
    g.prism("y", mid, DOME1, APEX, C("gray", 4), top=[(CX, CZ)] * 4)
    d2 = g.solids[-1]
    for fm, fr in facets(g, [d1, d2]):
        P.plates(g, fm, "gray", 5, size=(6, 4), frame=fr, seed=9)
    eye = box(g, CX - 1, APEX - 1, CZ - 1, CX + 1, EYE1, CZ + 1, "gray", 5)
    # the skeleton: a big skull on a ribcage, legs drawn up, hands on the bars
    sk_x, sk_z = CX, CZ - 1.5
    pelvis = box(g, sk_x - 3, FLOOR1, sk_z - 1, sk_x + 3, FLOOR1 + 2, sk_z + 2, "bone", 6)
    ribs = box(g, sk_x - 3, FLOOR1 + 3, sk_z - 1, sk_x + 3, FLOOR1 + 9, sk_z + 2, "bone", 6)
    spine = box(g, sk_x - 1, FLOOR1 + 2, sk_z + 1, sk_x + 1, FLOOR1 + 9, sk_z + 2, "bone", 5)
    P.flat(g, ribs & (Y % 2 == 0) & (Z < sk_z) & (np.abs(X + 0.5 - sk_x) > 0.6), "purple", 2)
    P.flat(g, ribs & (np.abs(X + 0.5 - sk_x) < 0.6), "bone", 7)
    skull(g, sk_x, FLOOR1 + 9, sk_z, s=10, base=7, eyes=("toxic", 7), seed=10)
    for s in (-1, 1):
        lx = sk_x + s * 2.0
        g.prism("x", quad((FLOOR1 + 1.0, sk_z), (FLOOR1 + 7.0, sk_z - 4.0), 1.0), lx - 1, lx + 1, C("bone", 6))  # thigh up
        g.prism("x", quad((FLOOR1 + 7.0, sk_z - 4.0), (FLOOR1 + 0.6, sk_z - 3.0), 1.0), lx - 1, lx + 1, C("bone", 6))  # shin down
        box(g, lx - 1.5, FLOOR1 + 6, sk_z - 5.5, lx + 1.5, FLOOR1 + 8.5, sk_z - 2.5, "bone", 7)  # knee knob
        ax = sk_x + s * 4.0
        g.prism("x", quad((FLOOR1 + 8.5, sk_z), (FLOOR1 + 7.5, sk_z - 3.5), 0.8), ax - 1, ax + 1, C("bone", 6))  # arm to the knee
        box(g, ax - 1.5, FLOOR1 + 6.5, sk_z - 5.0, ax + 1.5, FLOOR1 + 8.5, sk_z - 2.5, "bone", 7)  # bony hand
    return g


def door() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, DOOR0, FLOOR1, Z0, DOOR0 + 2, RING0, Z0 + 2, "gray", 4)
    m |= box(g, DOOR1 - 2, FLOOR1, Z0, DOOR1, RING0, Z0 + 2, "gray", 4)
    for y0, y1 in (BAND, (RING0, RING1)):
        m |= box(g, DOOR0, y0, Z0, DOOR1, y1, Z0 + 2, "gray", 5)
    P.flat(g, m & ((X + Z) % 2 == 0) & (Y < BAND[0]), "gray", 5)
    # a chunky padlock plate on the door's free edge
    lock = box(g, DOOR1 - 1, BAND[0] - 3, Z0 - 1, DOOR1 + 2, BAND[0] + 1, Z0, "gold", 5)
    P.outline(g, lock, "gold", 3, normal="z")
    P.flat(g, lock & (X == DOOR1) & (Y == BAND[0] - 2), "purple", 1)
    return g


def build():
    parts = {"gallows": gallows(), "hanger": hanger(), "cage": cage(), "door": door()}
    root = assemble(parts, [
        ("gallows", None, ((PX0 + PX1) / 2, 0.0, CZ)),
        ("hanger", "gallows", (CX, float(ARM_Y0), CZ)),
        ("cage", "hanger", (CX, float(EYE1), CZ)),
        ("door", "cage", (float(DOOR0), float(FLOOR1), float(Z0) + 1.0)),
    ])
    z3 = (0, 0, 0)
    return world("hanging-cage", "animated-props", "Gibbet Cage", root, clips=[
        Clip("open", {"door": {"rot": keys((0, z3), (0.12, (0, 8, 0)), (0.45, (0, 108, 0)), (0.6, (0, 92, 0)), (0.72, (0, 100, 0)), (0.8, (0, 98, 0)))}}, loop=False),
        Clip("close", {"door": {"rot": keys((0, (0, 98, 0)), (0.3, z3), (0.37, (0, 8, 0)), (0.45, z3))}}, loop=False),
        Clip("idle", {"hanger": {"rot": sway(3.2, "z", 5)}, "cage": {"rot": sway(3.2, "x", 4, 1.3)}}),
    ])
