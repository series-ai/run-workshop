"""Haunted rocking chair, in the Pirate Nation haunted style.

A high-backed chair of dark boards on two curved runners (a true-slope arc,
rule F2): turned front legs, a dished plank seat with a worn magenta
cushion, flat arm rests, five spindles under a tall crest rail carved with
a bone skull (rule K3), a knitted purple shawl thrown over the back and a
ball of yarn with two bone needles on the seat. The seat is at person
scale: the plank seat is 9 high and the cushion top is 11 high; the crest
rail is 26 high and the shawl is 27 high (class seat). It rocks on its own with
nobody in it; socket-seat carries the ghost wisps. One part (chair), whose
pivot is the centre of the runner arc, so the runners stay on the floor.
Clips: active (a long slow rock), idle (it barely stirs). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import keys, pfx, world
from _pn import assemble, coords, last
from _props import union
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SZ = (22, 30, 26)
CX = 11.0
R, ARC_Z, ARC_Y = 20.0, 12.0, 20.0  # the runner arc
Z0, Z1 = 2.0, 22.0
SEAT = 9.0
BACK = 26.0
LEG_X = (2.0, 17.0)  # the left x of each side frame (3 wide)


def arc_y(z: float) -> float:
    return ARC_Y - math.sqrt(max(R * R - (z - ARC_Z) ** 2, 0.0))


def runner(g: Grid, x0: float, x1: float) -> np.ndarray:
    """One curved runner: a prism whose base follows the arc (true slopes)."""
    zs = [Z0 + (Z1 - Z0) * k / 10 for k in range(11)]
    bottom = [(arc_y(z), z) for z in zs]
    top = [(arc_y(z) + 2.2, z) for z in reversed(zs)]
    g.prism("x", bottom + top, x0, x1, C("wood", 5))
    return last(g)


def chair() -> Grid:
    from pnpaint import blotch

    g = Grid(*SZ)
    X, Y, Z = coords(g)
    runs = np.zeros(g.shape, dtype=bool)
    for x0 in LEG_X:
        runs |= runner(g, x0, x0 + 3)
    S.paint_facets(g, g.solids[-2:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=3, across="x", nails=False, frame=fr, seed=1))
    P.flat(g, runs & (Y < 1.5), "wood", 3)
    blotch(g, runs, "moss", 5, cell=2, chance=0.08, seed=2)
    # four legs: the front pair turned, the back pair running on up as stiles
    legs = np.zeros(g.shape, dtype=bool)
    for lx in LEG_X:
        legs |= box(g, lx, 2.0, 5.5, lx + 3, SEAT, 8.0, "wood", 6)
        legs |= box(g, lx, 2.0, 16.5, lx + 3, BACK, 19.0, "wood", 6)
    P.planks(g, legs, "wood", 6, width=3, across="y", nails=False, seed=3)
    P.flat(g, legs & (((Y.astype(int) + 1) % 4) == 0) & (Y < SEAT), "wood", 4)  # turned rings
    P.flat(g, legs & (Y > SEAT + 2) & (((Y.astype(int)) % 5) == 0), "wood", 7)
    for lx in (LEG_X[0] + 0.5, LEG_X[1] + 0.5):  # a stretcher between front and back legs
        S.bar(g, "x", (4.0, 7.0), (4.0, 17.0), 1.6, lx, lx + 2, "wood", 5)
    S.bar(g, "z", (LEG_X[0] + 1, 4.0), (LEG_X[1] + 2, 4.0), 1.6, 6.0, 7.6, "wood", 5)
    # the seat: a dished plank slab with a sagged front edge (a true slope)
    g.prism("x", [(SEAT - 2.0, 5.0), (SEAT, 8.0), (SEAT, 17.0), (SEAT - 1.5, 19.5), (SEAT - 3.0, 17.0), (SEAT - 3.0, 8.0)], 1.5, 20.5, C("wood", 6))
    seat = last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=3, across="z", nails=True, frame=fr, seed=4))
    P.flat(g, seat & edges(seat), "wood", 4)
    # the cushion: a worn magenta pad with a sunken middle
    cush = box(g, 4, SEAT, 8.0, 18, SEAT + 2, 17.0, "magenta", 4)
    P.mottle(g, cush, "magenta", 4, cell=3, seed=5)
    P.flat(g, cush & (Y >= SEAT + 1) & (np.abs(X + 0.5 - CX) < 4) & (Z > 10) & (Z < 15), "magenta", 3)
    P.flat(g, cush & (Y < SEAT + 1), "magenta", 2)
    P.flat(g, cush & (Y >= SEAT + 1) & (((X + Z) % 5) == 0), "magenta", 5)
    # arm rests from the front legs back to the stiles (a true slope up)
    for ax in LEG_X:
        g.prism("x", [(SEAT + 5.5, 5.0), (SEAT + 7.0, 16.5), (SEAT + 5.0, 16.5), (SEAT + 3.5, 5.0)], ax, ax + 3, C("wood", 6))
        arm = last(g)
        P.flat(g, arm, "wood", 6)
        P.flat(g, arm & (Y < SEAT + 4.5), "wood", 4)
        box(g, ax, SEAT, 5.5, ax + 3, SEAT + 4, 7.5, "wood", 5)  # the arm post
    # four spindles and a tall crest rail with a painted bone skull (rule K3)
    for k in range(4):
        sx = 5.0 + k * 3.4
        box(g, sx, SEAT + 2, 16.0, sx + 2, BACK - 8, 18.0, "wood", 5)
        P.flat(g, (g.a > 0) & (np.abs(X - (sx + 1)) < 1.1) & (Y > SEAT + 2) & (Y < BACK - 8) & (Z > 15.5) & (((Y.astype(int) + k) % 4) == 0), "wood", 3)
    g.prism("z", [(2.0, BACK - 8), (20.0, BACK - 8), (20.0, BACK - 2), (16.5, BACK), (5.5, BACK), (2.0, BACK - 2)], 15.5, 19.0, C("wood", 6))
    rail = last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=4, across="x", nails=False, frame=fr, seed=6))
    P.flat(g, rail & edges(rail), "wood", 4)
    sw, sh = pnglyph.icon_size("skull")
    pnglyph.icon(g, "-z", 15.5, int(CX - sw / 2) + 1, int(BACK) - 8, "skull", "bone", 7, depth=2)
    # the knitted shawl thrown over the crest rail and hanging down the back
    g.prism("z", [(4.0, BACK + 1), (18.0, BACK + 1), (18.0, BACK - 10), (15.5, BACK - 7), (12.0, BACK - 12), (8.5, BACK - 8), (4.0, BACK - 9.5)], 19.0, 20.5, C("purple", 5))
    shawl = last(g)
    P.mottle(g, shawl, "purple", 5, cell=2, seed=8)
    P.flat(g, shawl & (((X.astype(int) + Y.astype(int)) % 4) == 0), "purple", 6)
    P.outline(g, shawl, "purple", 3, normal="z")
    box(g, 4, BACK, 15.5, 18, BACK + 1, 20.5, "purple", 6)
    # a ball of yarn with two bone needles on the seat
    ball = S.disc(g, "x", SEAT + 3.8, 11.0, 1.9, 5.0, 8.5, "toxic", 5)
    P.flat(g, ball & (((Y.astype(int) * 2 + Z.astype(int)) % 5) < 2), "toxic", 4)
    for nz in (10.0, 12.5):
        S.bar(g, "x", (SEAT + 3.0, nz), (SEAT + 6.0, nz + 1.5), 1.0, 6.0, 7.0, "bone", 7)
    return g


def build():
    root = assemble({"chair": chair()}, [("chair", None, (CX, ARC_Y, ARC_Z))])
    # the cycle starts at one end of the swing, so half way through it is at
    # the other: the review sheet's mid-clip frame shows the rock
    active = Clip("active", {"chair": {"rot": keys(
        (0.0, (-15, 0, 0)), (0.6, (0, 0, 0)), (1.2, (15, 0, 0)), (1.8, (0, 0, 0)), (2.4, (-15, 0, 0)))}})
    idle = Clip("idle", {"chair": {"rot": keys(
        (0.0, (-4.0, 0, 0)), (1.0, (0, 0, 0)), (2.0, (4.0, 0, 0)), (3.0, (0, 0, 0)), (4.0, (-4.0, 0, 0)))}})
    seat = (0.0, SEAT + 4 - ARC_Y, 12.0 - ARC_Z)
    return world("rocking-chair", "animated-props", "Rocking Chair", root,
                 clips=[active, idle],
                 sockets=[Socket("socket-seat", at=seat, parent="chair")],
                 pfx=[pfx("rvx-monster-ghost-wisps", "socket-seat", "idle", size=20)])
