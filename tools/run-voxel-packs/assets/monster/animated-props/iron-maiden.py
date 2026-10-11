"""Iron maiden, in the Pirate Nation haunted style.

A riveted steel sarcophagus on a stone plinth: narrow feet, a broad body
and sloped shoulders (true slopes) under an oversized head block with a
stern painted face (glowing magenta eyes, a furrowed brow, a grim mouth)
and a pointed purple slate hood (a pyramid). Two riveted doors, hinged on
their outer edges, carry gold bands and a big gold clasp; inside them and
on the back wall stand big bone-white spikes (true-slope pyramids).
Clips: open, close (one-shot), idle (the doors creak a few degrees).
Faces -Z.
"""
import numpy as np

import paint as P
from _kit import keys, world
from _pn import assemble, coords, last, stamp
from pnkit import box, edges
from pnshapes import facets
from voxgrid import C, Clip, Grid

S = (26, 48, 20)
CX = 13.0
YB, YW, YSH, YN = 3.0, 12.0, 27.0, 31.0  # body foot, widest, shoulder, neck
HW_FOOT, HW_BODY, HW_NECK = 6.5, 9.0, 5.0
ZD, ZR, ZI, ZBACK = 1.0, 4.0, 8.0, 15.0  # door front, rim front, inside wall, back
HEAD = (6.0, 20.0, YN, 45.0, 2.0, 13.0)  # x0, x1, y0, y1, z0, z1


def profile(x_lo: float, x_hi: float, d: float = 0.0):
    """The front outline (x, y) clipped to [x_lo, x_hi]: narrow feet, a
    broad body and sloped shoulders up to the neck."""
    full = [(CX - HW_FOOT - d, YB), (CX + HW_FOOT + d, YB), (CX + HW_BODY + d, YW), (CX + HW_BODY + d, YSH), (CX + HW_NECK + d, YN + d),
            (CX - HW_NECK - d, YN + d), (CX - HW_BODY - d, YSH), (CX - HW_BODY - d, YW)]
    return clip_x(full, x_lo, x_hi)


def clip_x(poly, lo: float, hi: float):
    """Clip a polygon to lo <= x <= hi (Sutherland-Hodgman, two planes)."""
    def cut(pts, keep, edge):
        out = []
        for k in range(len(pts)):
            a, b = pts[k - 1], pts[k]
            ia, ib = keep(a), keep(b)
            if ib:
                if not ia:
                    out.append(edge(a, b))
                out.append(b)
            elif ia:
                out.append(edge(a, b))
        return out

    def at(xc):
        return lambda a, b: (xc, a[1] + (b[1] - a[1]) * (xc - a[0]) / (b[0] - a[0]))

    pts = cut(poly, lambda p: p[0] >= lo - 1e-9, at(lo))
    return cut(pts, lambda p: p[0] <= hi + 1e-9, at(hi))


def spike(g: Grid, cx: float, cy: float, z_base: float, z_tip: float, r: float = 1.4) -> np.ndarray:
    """A square bone spike (a pyramid, true slopes) from a base on a wall
    at z_base to a point at z_tip."""
    sq = [(cx - r, cy - r), (cx + r, cy - r), (cx + r, cy + r), (cx - r, cy + r)]
    tip = [(cx, cy)] * 4
    lo, hi = min(z_base, z_tip), max(z_base, z_tip)
    if z_tip < z_base:
        g.prism("z", tip, lo, hi, C("bone", 6), top=sq)
    else:
        g.prism("z", sq, lo, hi, C("bone", 6), top=tip)
    m = last(g)
    X, Y, Z = coords(g)
    P.flat(g, m & (np.abs(Z + 0.5 - z_tip) < 1.0), "bone", 7)
    return m


def base() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", [(2, 0), (24, 0), (24, 19), (2, 19)], 0, 3, C("gray", 5), top=[(3.5, 1.5), (22.5, 1.5), (22.5, 17.5), (3.5, 17.5)])
    pl = g.solids[-1]
    for fm, fr in facets(g, [pl]):
        P.stone(g, fm, "gray", 5, block=(6, 3), frame=fr, seed=1)
    m = last(g)
    P.flat(g, m & (Y == 2) & ~edges(m), "gray", 6)
    P.flat(g, m & (Y == 0) & ((P._hash(X // 2, Z // 2, seed=2) % np.uint64(3)) == 0), "moss", 5)
    return g


def maiden() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the back shell and a thick rim around the spiked cavity
    g.prism("z", profile(0, S[0]), ZI, ZBACK, C("steel", 4))
    shell = g.solids[-1]
    rims = []
    for lo, hi in ((0, CX), (CX, S[0])):
        outer = profile(lo, hi)
        g.prism("z", outer, ZR, ZI, C("steel", 4))
        rims.append(g.solids[-1])
    for fm, fr in facets(g, [shell] + rims):
        P.plates(g, fm, "steel", 4, size=(8, 8), frame=fr, seed=3)
    # the cavity: the rim is solid here, so paint its front as the dark
    # iron inside wall (rust stains) and set the spikes on it
    rim = rims[0].mask(g.shape) | rims[1].mask(g.shape)
    face = rim & (Z == int(ZR))
    inner = face & (np.abs(X + 0.5 - CX) < HW_BODY - 2) & (Y >= YB + 2) & (Y < YSH)
    P.flat(g, face & ~inner, "steel", 5)
    P.flat(g, inner, "gray", 3)
    P.flat(g, inner & ((P._hash(X, Y // 3, seed=4) % np.uint64(5)) == 0), "rust", 3)
    for sx in (-4.5, 0.0, 4.5):
        for sy in (9.0, 16.0, 23.0):
            spike(g, CX + sx + (1.5 if sy == 16.0 else 0.0), sy, ZR, ZR - 3.5, r=1.8)
    # the head: a pointed purple cowl (true slopes) framing an oversized
    # pale iron face mask with a stern painted face
    x0, x1, y0, y1, z0, z1 = HEAD
    cx = (x0 + x1) / 2
    cowl = [(x0, y0), (x1, y0), (x1, y0 + 9), (cx + 2.5, y1), (cx - 2.5, y1), (x0, y0 + 9)]
    g.prism("z", cowl, z0, z1, C("purple", 4))
    hood = g.solids[-1]
    for fm, fr in facets(g, [hood]):
        P.mottle(g, fm, "purple", 4, cell=2, seed=5)
    hm = hood.mask(g.shape)
    P.flat(g, hm & (Z == int(z0)) & ((X == int(x0)) | (X == int(x1) - 1)), "purple", 3)
    mask_m = box(g, x0 + 2, y0, z0 - 1, x1 - 2, y0 + 10, z0, "steel", 7)
    P.outline(g, mask_m, "steel", 5, normal="z")
    face_rows = [
        "bb......bb",
        ".bbb..bbb.",
        "..bb..bb..",
        "owwo..owwo",
        "oggo..oggo",
        ".oo....oo.",
        "....nn....",
        "....nn....",
        ".mmmmmmmm.",
        "m.t.tt.t.m",
    ]
    legend = {"b": C("steel", 2), "o": C("purple", 1), "w": C("magenta", 7), "g": C("magenta", 6), "n": C("steel", 5), "m": C("steel", 2), "t": C("bone", 7)}
    stamp(g, "-z", int(z0) - 1, int(x0) + 2, int(y0), face_rows, legend, depth=2)
    # a gold collar trim at the neck
    collar = box(g, CX - HW_NECK - 1, y0 - 1, z0, CX + HW_NECK + 1, y0, z1, "gold", 5)
    P.outline(g, collar, "gold", 4, normal="y")
    return g


def door(side: int) -> Grid:
    """side -1: the viewer's left door (hinged on the left edge); +1 right."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    lo, hi = (0, CX) if side < 0 else (CX, S[0])
    g.prism("z", profile(lo, hi, 0.4), ZD, ZR, C("steel", 4))
    leaf = g.solids[-1]
    for fm, fr in facets(g, [leaf]):
        P.plates(g, fm, "steel", 4, size=(8, 8), frame=fr, seed=7 + side)
    m = last(g)
    front = m & (Z == int(ZD))
    P.plates(g, front, "steel", 5, size=(9, 9), frame="z", seed=7 + side)
    # a purple robe painted below the waist, with soft folds
    robe = front & (Y < 18)
    P.flat(g, robe, "purple", 4)
    P.flat(g, robe & ((X % 3) == 1), "purple", 5)
    P.flat(g, robe & ((X % 3) == 0) & (Y < 16), "purple", 3)
    P.flat(g, front & edges(m), "steel", 2)
    # gold bands at the knee and the waist, and hinge knuckles on the edge
    for by in (8, 18):
        P.flat(g, front & (Y >= by) & (Y < by + 2), "gold", 5)
        P.flat(g, front & (Y == by) & (X % 3 == 0), "gold", 7)
    ex = CX + side * (HW_BODY + 0.4)
    for ky in (6, 15, 23):
        kx0 = ex - 1 if side < 0 else ex - 1
        kn = box(g, kx0, ky, ZD, kx0 + 2, ky + 3, ZR, "gray", 5)
        P.flat(g, kn & (Y == ky), "gray", 3)
    # the inside: dark iron with a row of big bone spikes
    inside = m & (Z == int(ZR) - 1)
    P.flat(g, inside & ~edges(m), "gray", 3)
    for sy in (12.5, 19.5):
        spike(g, CX + side * 4.5, sy, ZR, ZR + 3.0, r=1.7)
    if side > 0:
        # the big gold clasp over the seam, a painted keyhole
        clasp = box(g, CX - 2, 14, ZD - 1, CX + 2, 19, ZD, "gold", 5)
        P.outline(g, clasp, "gold", 3, normal="z")
        P.flat(g, clasp & (np.abs(X + 0.5 - CX) < 0.6) & (Y >= 15) & (Y < 18), "purple", 1)
    return g


def build():
    parts = {"base": base(), "maiden": maiden(), "door-l": door(-1), "door-r": door(1)}
    root_j = (CX, 0.0, 10.0)
    hinge_l = (CX - HW_BODY - 0.4, YW, (ZD + ZR) / 2)
    hinge_r = (CX + HW_BODY + 0.4, YW, (ZD + ZR) / 2)
    root = assemble(parts, [("base", None, root_j), ("maiden", "base", (CX, YB, 10.0)), ("door-l", "maiden", hinge_l), ("door-r", "maiden", hinge_r)])
    z3 = (0, 0, 0)

    def op(s):
        return keys((0, z3), (0.15, (0, s * 10, 0)), (0.5, (0, s * 112, 0)), (0.65, (0, s * 98, 0)), (0.8, (0, s * 105, 0)), (0.9, (0, s * 103, 0)))

    def cl(s):
        return keys((0, (0, s * 103, 0)), (0.35, z3), (0.42, (0, s * 6, 0)), (0.5, z3))

    def idle(s, t):
        return keys((0, z3), (t, (0, s * 4, 0)), (t + 0.5, (0, s * 1, 0)), (t + 0.8, (0, s * 3, 0)), (t + 1.3, z3), (3.2, z3))

    return world("iron-maiden", "animated-props", "Iron Maiden", root, clips=[
        Clip("open", {"door-l": {"rot": op(1)}, "door-r": {"rot": op(-1)}}, loop=False),
        Clip("close", {"door-l": {"rot": cl(1)}, "door-r": {"rot": cl(-1)}}, loop=False),
        Clip("idle", {"door-l": {"rot": idle(1, 0.6)}, "door-r": {"rot": idle(-1, 1.4)}}),
    ])
