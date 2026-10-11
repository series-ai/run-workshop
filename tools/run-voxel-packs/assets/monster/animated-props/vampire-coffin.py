"""Vampire coffin, in the Pirate Nation haunted style.

A tapered hexagonal coffin in purple lacquer with gold trims (after PN
decoration-1x2-coffin), lying on a low two-tier stone bier with a painted
bat on its front. A thick rim frames a blood-red velvet lining and a pillow.
The lid (a true-slope frustum) is hinged on its back long edge and carries
an oversized raised gold cross. Two chunky lit candles in gold dishes stand
at the head end. Clips: open, close (one-shot), idle (the lid lifts and
rattles, the coffin hops). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
from _kit import keys, pfx, world
from _props import pn_flame
from _pn import assemble, coords, last
from pnkit import box, edges
from pnshapes import facets
from voxgrid import C, Clip, Grid, Socket

S = (28, 26, 20)
CX, CZ = 14.0, 10.0
X0, X1, XS = 4.5, 24.5, 10.5  # coffin head, foot, shoulder
HW_HEAD, HW_SH, HW_FOOT = 3.5, 5.5, 3.8
YB = 10.0  # bier top
YR = 15.0  # rim bottom = lining height
YS = 17.0  # lid seam
YL = 20.0  # lid top


def offset(pts, d: float):
    """Offset a convex polygon's edges by d (outward for d > 0)."""
    n = len(pts)
    area = sum(pts[k][0] * pts[(k + 1) % n][1] - pts[(k + 1) % n][0] * pts[k][1] for k in range(n))
    sgn = 1.0 if area < 0 else -1.0
    lines = []
    for k in range(n):
        (ax, ay), (bx, by) = pts[k], pts[(k + 1) % n]
        ex, ey = bx - ax, by - ay
        L = math.hypot(ex, ey)
        nx, ny = sgn * ey / L, -sgn * ex / L
        lines.append(((ax + nx * d, ay + ny * d), (ex, ey)))
    out = []
    for k in range(n):
        (p, r), (q, s) = lines[k - 1], lines[k]
        den = r[0] * s[1] - r[1] * s[0]
        t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / den
        out.append((p[0] + r[0] * t, p[1] + r[1] * t))
    return out


def hexplan(d: float = 0.0):
    return offset([(X0, CZ - HW_HEAD), (XS, CZ - HW_SH), (X1, CZ - HW_FOOT), (X1, CZ + HW_FOOT), (XS, CZ + HW_SH), (X0, CZ + HW_HEAD)], d)


def half_ring(front: bool, d_in: float):
    """The front (or back) half of the rim ring in plan: outer outline from
    head to foot, back along the inner one (a simple polygon)."""
    o, i = hexplan(), hexplan(-d_in)
    if front:
        return [(X0, CZ), o[0], o[1], o[2], (X1, CZ), (i[2][0], CZ), i[2], i[1], i[0], (i[0][0], CZ)]
    return [(X0, CZ), o[5], o[4], o[3], (X1, CZ), (i[3][0], CZ), i[3], i[4], i[5], (i[5][0], CZ)]


def bier() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", [(1, 2), (27, 2), (27, 18), (1, 18)], 0, 2, C("gray", 5), top=[(1.5, 2.5), (26.5, 2.5), (26.5, 17.5), (1.5, 17.5)])
    foot = g.solids[-1]
    top = box(g, 2.5, 2, 3.5, 25.5, 9, 16.5, "gray", 5)
    cap = box(g, 2, 9, 3, 26, 10, 17, "gray", 6)
    for fm, fr in facets(g, [foot]):
        P.stone(g, fm, "gray", 5, block=(6, 2), frame=fr, seed=1)
    P.stone(g, top, "gray", 5, block=(7, 3), seed=2)
    P.outline(g, cap, "gray", 5, normal="y")

    # a painted bat on the bier front (the vampire's sign)
    iw, ih = pnglyph.icon_size("bat")
    pnglyph.icon(g, "-z", 3.5, int(round(CX - iw / 2)), 2, "bat", "purple", 3, inks={"+": ("magenta", 6)})
    P.flat(g, foot.mask(g.shape) & (Y == 0) & ((P._hash(X // 2, Z // 2, seed=3) % np.uint64(3)) == 0), "moss", 5)
    # two chunky lit candles in gold dishes at the head end
    for cx, cz, h in ((4.0, 4.5, 8), (4.0, 15.5, 6)):
        fat_candle(g, cx, cz, YB, h)
    return g


def fat_candle(g: Grid, cx: float, cz: float, y0: float, h: int) -> None:
    """A chunky church candle in a gold dish: a 3x3 wax stick with drips
    lit with a small shared PN flame (nested warm layers)."""
    X, Y, Z = coords(g)
    dish = box(g, cx - 2.5, y0, cz - 2.5, cx + 2.5, y0 + 1, cz + 2.5, "gold", 4)
    P.outline(g, dish, "gold", 3, normal="y")
    wax = box(g, cx - 1.5, y0 + 1, cz - 1.5, cx + 1.5, y0 + 1 + h, cz + 1.5, "bone", 7)
    top = y0 + 1 + h
    P.flat(g, wax & (Y < top - 2) & ((P._hash(X, Z, seed=int(cz)) % np.uint64(3)) == 0) & (Y > top - 5 - (X + Z) % 3), "bone", 6)
    P.flat(g, wax & (Y == int(y0) + 1), "bone", 5)
    pn_flame(g, cx, cz, top, 5, 7, kind="small")


def coffin() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", hexplan(), YB, YR, C("purple", 4))
    body = g.solids[-1]
    rims = []
    for front in (True, False):
        g.prism("y", half_ring(front, 1.6), YR, YS, C("purple", 4))
        rims.append(g.solids[-1])
    for fm, fr in facets(g, [body] + rims):
        P.planks(g, fm, "purple", 4, width=3, across="y", length=(9, 14), nails=False, frame=fr, seed=4)
    bm = body.mask(g.shape)
    rim = rims[0].mask(g.shape) | rims[1].mask(g.shape)
    # gold trims: a foot band and the rim's top edge
    P.flat(g, (bm | rim) & (Y == int(YB)), "gold", 4)
    P.flat(g, rim & (Y == int(YS) - 1), "gold", 5)
    # blood-red velvet lining and a pale pillow at the head end
    above_empty = np.zeros(g.shape, dtype=bool)
    above_empty[:, :-1, :] = g.a[:, 1:, :] == 0
    lining = bm & (Y == int(YR) - 1) & above_empty
    P.flat(g, lining, "blood", 6)
    P.flat(g, lining & (((X + Z) % 3 == 0) & ((X - Z) % 3 == 0)), "blood", 4)
    pillow = box(g, X0 + 2, YR, CZ - 2, X0 + 6, YR + 1, CZ + 2, "bone", 6)
    P.outline(g, pillow, "bone", 5, normal="y")
    # chunky gold handles on the long sides
    for hx in (XS + 1, XS + 8):
        for s in (-1, 1):
            if hx <= XS:
                hw = HW_HEAD + (HW_SH - HW_HEAD) * (hx + 2 - X0) / (XS - X0)
            else:
                hw = HW_SH + (HW_FOOT - HW_SH) * (hx + 2 - XS) / (X1 - XS)
            z = CZ + s * (hw + 0.3)
            z0 = math.floor(z) if s > 0 else math.floor(z) - 1
            hm = box(g, hx, YB + 2, z0, hx + 4, YB + 4, z0 + 1, "gold", 5)
            P.flat(g, hm & (Y == int(YB) + 2), "gold", 3)
    return g


def lid() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("y", hexplan(0.5), YS, YS + 1, C("gold", 4))
    lip = g.solids[-1]
    g.prism("y", hexplan(0.5), YS + 1, YL, C("purple", 3), top=hexplan(-1.3))
    cap = g.solids[-1]
    for fm, fr in facets(g, [cap]):
        P.planks(g, fm, "purple", 5 if fr == "top" else 4, width=3, across="z" if fr == "top" else "y", length=(9, 14), nails=False, frame=fr, seed=5)
    lm = lip.mask(g.shape)
    P.flat(g, lm, "gold", 4)
    P.flat(g, lm & (((X + Z) % 4) == 0), "gold", 5)
    # blood velvet inside the lid (seen when it opens), a gold rim around it
    inner = lm & (Y == int(YS))
    ring = np.zeros_like(inner)
    for ax in (0, 2):
        for st in (1, -1):
            ring |= inner & ~np.roll(inner, st, axis=ax)
    ring2 = np.zeros_like(inner)
    for ax in (0, 2):
        for st in (1, -1):
            ring2 |= inner & ~ring & np.roll(ring, st, axis=ax)
    P.flat(g, inner & ~ring & ~ring2, "blood", 5)
    P.flat(g, inner & ~ring & ~ring2 & (((X + Z) % 3 == 0) & ((X - Z) % 3 == 0)), "blood", 3)
    cm = cap.mask(g.shape)
    P.flat(g, cm & (Y == int(YS) + 1) & edges(cm | lm), "purple", 2)
    # the oversized raised gold cross, its long beam along the coffin
    t = int(YL)
    cr = box(g, X0 + 3, t, CZ - 1, X1 - 3, t + 1, CZ + 1, "gold", 5)
    cr |= box(g, X0 + 5, t, CZ - 4, X0 + 7, t + 1, CZ + 4, "gold", 5)
    P.outline(g, cr, "gold", 3, normal="y")
    P.flat(g, cr & (((X + Z) % 5) == 0), "gold", 7)
    # a blood-red jewel where the beams meet
    P.flat(g, cr & (X == int(X0 + 5)) & (Z == int(CZ)), "red", 5)
    P.flat(g, cr & (X == int(X0 + 6)) & (Z == int(CZ) - 1), "red", 4)
    return g


def build():
    parts = {"bier": bier(), "coffin": coffin(), "lid": lid()}
    root_j = (CX, 0.0, CZ)
    coffin_j = ((X0 + X1) / 2, YB, CZ)
    hinge = ((X0 + X1) / 2, YS, CZ + HW_SH + 0.5)
    root = assemble(parts, [("bier", None, root_j), ("coffin", "bier", coffin_j), ("lid", "coffin", hinge)])
    z3 = (0, 0, 0)
    open_k = {"lid": {"rot": keys((0, z3), (0.15, (14, 0, 0)), (0.5, (112, 0, 0)), (0.65, (98, 0, 0)), (0.8, (104, 0, 0)), (0.9, (102, 0, 0)))}}
    close_k = {"lid": {"rot": keys((0, (102, 0, 0)), (0.35, z3), (0.42, (5, 0, 0)), (0.5, z3))}}
    idle_k = {
        "lid": {"rot": keys((0, z3), (0.5, z3), (0.6, (9, 0, 0)), (0.7, (2, 0, 0)), (0.78, (6, 0, 0)), (0.88, z3), (1.6, z3), (1.7, (5, 0, 0)), (1.8, z3), (2.6, z3))},
        "coffin": {"loc": keys((0, z3), (0.5, z3), (0.6, (0, 1, 0)), (0.7, z3), (0.78, (0, 0.5, 0)), (0.88, z3), (2.6, z3))},
    }
    mist = ((X0 + X1) / 2 - CX, YS + 1.0, 0.0)
    return world("vampire-coffin", "animated-props", "Vampire Coffin", root,
                 clips=[Clip("open", open_k, loop=False), Clip("close", close_k, loop=False), Clip("idle", idle_k)],
                 sockets=[Socket("socket-mist", at=mist, parent="coffin")],
                 pfx=[pfx("rvx-monster-grave-mist", "socket-mist", "clip:open", size=22)])
