"""Upright coffin, in the Pirate Nation haunted style.

A standing tapered hexagonal wooden coffin (after PN decoration-1x2-coffin,
stood on end) leaning back a little in a low stone stand. A thick wooden rim
frames a purple velvet lining with a painted mummy that has glowing toxic
eyes. The door is hinged on the left long edge; it carries an oversized
raised bone cross, painted iron hinge straps and a gold ring pull.
Clips: open, close (one-shot), idle (knocks from inside jolt the door a few
degrees). Faces -Z.
"""
import math

import numpy as np

import paint as P
from _kit import keys, pfx, world
from _pn import assemble, coords, last
from pnkit import box, edges
from pnshapes import facets
from voxgrid import C, Clip, Grid, Socket

S = (18, 28, 12)
CX = 9.0
YB, YT = 3.0, 24.0  # coffin foot and head
YS = 18.0  # shoulder height (widest point)
HW_FOOT, HW_SH, HW_HEAD = 3.5, 5.5, 3.0
ZL, ZR, ZD = 6.0, 4.0, 2.0  # lining face, rim front, door front
ZBACK = 10.0
LEAN = 5.0  # the coffin leans back in its stand (rule F5)


def hexf(d: float = 0.0):
    """The coffin's front outline (x, y), grown by d."""
    return [(CX - HW_FOOT - d, YB - d * 0.4), (CX + HW_FOOT + d, YB - d * 0.4), (CX + HW_SH + d, YS), (CX + HW_HEAD + d, YT + d * 0.4),
            (CX - HW_HEAD - d, YT + d * 0.4), (CX - HW_SH - d, YS)]


def half_ring(sign: int, d_out: float, d_in: float):
    """One C-shaped half of the rim (viewer's left for sign -1): the outer
    outline down one side, back up the inner one (a simple polygon)."""
    o, i = hexf(d_out), hexf(-d_in)
    if sign < 0:
        outer = [(CX, o[4][1]), o[4], o[5], o[0], (CX, o[0][1])]
        inner = [(CX, i[0][1]), i[0], i[5], i[4], (CX, i[4][1])]
    else:
        outer = [(CX, o[3][1]), o[3], o[2], o[1], (CX, o[1][1])]
        inner = [(CX, i[1][1]), i[1], i[2], i[3], (CX, i[3][1])]
    return outer + inner


def stand() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", [(1, 0), (17, 0), (17, 12), (1, 12)], 0, 3, C("gray", 5), top=[(2.5, 1.5), (15.5, 1.5), (15.5, 11), (2.5, 11)])
    plinth = g.solids[-1]
    for fm, fr in facets(g, [plinth]):
        P.stone(g, fm, "gray", 5, block=(5, 3), frame=fr, seed=1)
    m = last(g)
    P.flat(g, m & (Y == 2), "gray", 6)
    P.flat(g, m & (Y == 0), "gray", 4)
    # a shallow socket of light stone the coffin foot stands in
    sock = box(g, CX - 5, 3, 4, CX + 5, 4, 11, "gray", 6)
    P.outline(g, sock, "gray", 5, normal="y")
    # moss creeping on the plinth foot
    P.flat(g, m & (Y == 0) & ((P._hash(X // 2, Z // 2, seed=2) % np.uint64(3)) == 0), "moss", 5)
    return g


def coffin() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("z", hexf(), ZL, ZBACK, C("wood", 5))
    body = g.solids[-1]
    rims = []
    for s in (-1, 1):
        g.prism("z", half_ring(s, 0.0, 2.0), ZR, ZL, C("wood", 6))
        rims.append(g.solids[-1])
    for fm, fr in facets(g, [body] + rims):
        P.planks(g, fm, "wood", 5, width=3, across="y", length=(7, 12), frame=fr, seed=3)
    rim = rims[0].mask(g.shape) | rims[1].mask(g.shape)
    P.flat(g, rim & (Z == int(ZR)), "wood", 6)
    P.flat(g, rim & (Z == int(ZR)) & ((P._hash(X, Y // 3, seed=4) % np.uint64(4)) == 0), "wood", 7)
    # eerie magenta light leaks through the door seam (the rim's sides, C3)
    occ = g.a > 0
    rim_side = np.zeros_like(rim)
    for ax in (0, 1):
        for st in (1, -1):
            rim_side |= rim & ~np.roll(occ, st, axis=ax)
    P.flat(g, rim_side & (Z == int(ZR)), "magenta", 5)
    P.flat(g, rim_side & (Z == int(ZR)) & ((P._hash(X, Y // 2, seed=6) % np.uint64(3)) == 0), "magenta", 7)
    # the lining face: tufted purple velvet with a painted mummy
    open_front = np.zeros(g.shape, dtype=bool)
    open_front[:, :, 1:] = g.a[:, :, :-1] == 0
    lining = body.mask(g.shape) & (Z == int(ZL)) & open_front & (X > 0) & (X < S[0] - 1)
    side_px = lining & ~(np.roll(lining, 1, 0) & np.roll(lining, -1, 0))
    lining &= ~side_px
    P.flat(g, lining, "purple", 5)
    tuft = lining & ((X + Y) % 4 == 0) & ((X - Y) % 4 == 0)
    P.flat(g, tuft, "purple", 4)
    u = X + 0.5 - CX
    hy = 19.5
    head = lining & ((u / 2.6) ** 2 + ((Y + 0.5 - hy) / 2.4) ** 2 < 1.0)
    half_w = np.clip(1.6 + (Y - 5) * 0.16, 1.6, 3.6)
    torso = lining & (Y >= 5) & (Y < 17) & (np.abs(u) < half_w)
    mummy = head | torso
    P.flat(g, mummy, "bone", 7)
    wrap = mummy & (((Y + np.floor(u).astype(int) // 2) % 3) == 0)
    P.flat(g, wrap, "bone", 5)
    P.flat(g, torso & (Y >= 11) & (Y < 13) & (np.abs(u) < 3.2), "bone", 7)  # crossed arms
    P.flat(g, mummy & ~(head | torso), "bone", 4)
    eye = head & (Y == 19) & (np.abs(np.abs(u) - 1.0) < 0.6)
    P.flat(g, eye, "toxic", 7)
    P.flat(g, head & (Y == 20) & (np.abs(np.abs(u) - 1.0) < 0.6), "purple", 2)
    # a dark rim line around the lining (rule S4)
    inner = np.zeros_like(lining)
    for ax in (0, 1):
        for st in (1, -1):
            inner |= lining & ~np.roll(lining, st, axis=ax)
    P.flat(g, inner & ~mummy, "purple", 3)
    return g


def door() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("z", hexf(0.4), ZD, ZR, C("wood", 5))
    leaf = g.solids[-1]
    for fm, fr in facets(g, [leaf]):
        P.planks(g, fm, "wood", 5, width=3, across="x" if fr in ("z",) else "y", length=(30, 31), nails=False, frame=fr, seed=5)
    m = last(g)
    front = m & (Z == int(ZD))
    P.planks(g, front, "wood", 6, width=3, across="x", length=(30, 31), nails=False, frame="z", seed=5)
    P.flat(g, front & edges(m), "wood", 3)
    P.flat(g, m & (Z == int(ZR) - 1) & ~edges(m), "purple", 4)  # velvet inside the door
    # painted iron hinge straps on the hinge side, with rivets
    for hy in (7, 20):
        strap = front & (Y >= hy) & (Y < hy + 2) & (X < CX + 1)
        P.flat(g, strap, "gray", 5)
        P.flat(g, strap & (Y == hy) & (X % 2 == 0), "gray", 6)
    # an oversized raised bone cross (1 voxel proud)
    cx, arm_y = CX, 15.0
    cr = box(g, cx - 1.5, 6, ZD - 1, cx + 1.5, 21, ZD, "bone", 6)
    cr |= box(g, cx - 5, arm_y, ZD - 1, cx + 5, arm_y + 3, ZD, "bone", 6)
    P.outline(g, cr, "bone", 4, normal="z")
    P.flat(g, cr & (Y == 20), "bone", 7)
    P.flat(g, cr & (Y == int(arm_y) + 2) & (np.abs(X + 0.5 - cx) > 1.5), "bone", 7)
    # a small painted skull where the cross arms meet, with magenta eyes
    P.flat(g, cr & (Z == int(ZD) - 1) & (Y == int(arm_y) + 1) & (np.abs(X + 0.5 - cx) < 0.6), "purple", 2)
    # a gold ring pull on the opening side
    ring = box(g, CX + 3, 11, ZD - 1, CX + 5, 14, ZD, "gold", 5)
    P.flat(g, ring & (Y == 12) & (X == int(CX + 3)), "gold", 3)
    P.flat(g, ring & (Y == 13), "gold", 7)
    return g


def build():
    parts = {"stand": stand(), "coffin": coffin(), "door": door()}
    root_j = (CX, 0.0, 6.0)
    coffin_j = (CX, YB, 8.0)
    hinge = (CX - HW_SH - 0.4, YS, ZR)
    root = assemble(parts, [("stand", None, root_j), ("coffin", "stand", coffin_j), ("door", "coffin", hinge)])
    root.children[0].rot = (LEAN, 0.0, 0.0)
    z3 = (0, 0, 0)
    open_k = {"door": {"rot": keys((0, z3), (0.12, (0, 12, 0)), (0.4, (0, 118, 0)), (0.55, (0, 100, 0)), (0.7, (0, 108, 0)), (0.8, (0, 106, 0)))}}
    close_k = {"door": {"rot": keys((0, (0, 106, 0)), (0.3, z3), (0.36, (0, 5, 0)), (0.44, z3))}}
    idle_k = {"door": {"rot": keys((0, z3), (0.6, z3), (0.66, (0, 4, 0)), (0.74, z3), (0.9, z3), (0.96, (0, 5, 0)), (1.04, z3), (1.2, z3), (1.26, (0, 3, 0)), (1.34, z3), (2.4, z3))}}
    inside = (0.0, 13.0, ZR - root_j[2])
    return world("upright-coffin", "animated-props", "Upright Coffin", root,
                 clips=[Clip("open", open_k, loop=False), Clip("close", close_k, loop=False), Clip("idle", idle_k)],
                 sockets=[Socket("socket-inside", at=inside, parent="coffin")],
                 pfx=[pfx("rvx-monster-grave-mist", "socket-inside", "clip:open", size=18)])
