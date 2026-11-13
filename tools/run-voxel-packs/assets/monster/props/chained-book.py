"""Chained grimoire, in the Pirate Nation haunted style.

A gothic lectern (rule K3): a stepped grey stone foot with a violet slate
course, a fluted column banded in dark iron with a painted skull boss, a
small iron capital with gold corner bosses, and a dark plank desk inside
an iron edge rail. An oversized grimoire lies open on it, turned a few
degrees for life (rule F5): a violet leather cover framed in bone with
gold bosses, and bone pages whose outer faces carry painted page-edge
lines while the glowing magenta runes stay on the reading surfaces. A
toxic-green light rises out of the gutter, a heavy iron chain runs from
a clasp on the spine to a ring on the column, and a skull and a lit
candle share the desk. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, single
from _props import TOXIC, candle, chain, idx, plinth, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 32, 36, 30
CX, CZ = 16.0, 15.0
DESK = 24  # the desk top


def rect(cx, cz, hw, hd, deg):
    return S.rotate([(cx - hw, cz - hd), (cx + hw, cz - hd), (cx + hw, cz + hd), (cx - hw, cz + hd)], cx, cz, deg)


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the stepped foot with a violet slate course
    plinth(g, 2, 2, 30, 28, 0, 3, "gray", 5, bevel=1.6, seed=1)
    pm = plinth(g, 5, 5, 27, 25, 3, 3, "gray", 6, bevel=1.2, seed=2)
    band = pm & (Y >= 3) & (Y < 5)
    P.stone(g, band, "purple", 5, block=(5, 3), seed=3)
    P.flat(g, band & (Y == 4), "purple", 6)

    # ---- the fluted column, banded in iron, with a painted skull boss
    col = S.disc(g, "y", CX, CZ, 4.4, 6, 19, "gray", 6, n=8)
    P.stone(g, col, "gray", 6, block=(5, 4), cracks=0.04, seed=4)
    P.flat(g, col & S.seams(g, g.solids[-1:], 0.9), "gray", 3)   # flutes down every corner
    for yb in (6, 17):
        ring = col & (Y >= yb) & (Y < yb + 2)
        P.flat(g, ring, "iron", 7)
        P.flat(g, ring & (((X + Z) % 5) == 0), "iron", 4)
    sk = [".###.", "#####", "#o#o#", "##o##", ".#.#."]
    import pnglyph
    pnglyph.stamp(g, "-z", CZ - 4.4, int(CX) - 2, 10, sk, {"#": C("bone", 7), "o": C("purple", 1)}, reach=2)

    # ---- a small iron capital with gold corner bosses
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, CZ, 4.4, 8), 19, 22, C("iron", 7), top=S.flat_ngon(CX, CZ, 7.0, 8))
    cap = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.plates(gg, mm, "iron", 7, size=(5, 3), frame=fr))
    P.flat(g, cap & (Y == 21), "iron", 7)
    P.flat(g, cap & (Y == 19), "iron", 4)

    # ---- the desk: dark boards inside an iron edge rail, gold at the corners
    desk = box(g, CX - 10, 22, CZ - 8, CX + 10, DESK, CZ + 8, "darkwood", 7)
    P.planks(g, desk, "darkwood", 7, width=4, across="x", nails=True, seed=5)
    P.flat(g, desk & (Y == DESK - 1), "darkwood", 7)
    rail = desk & (Y == 22)
    P.flat(g, rail, "iron", 7)
    P.flat(g, rail & (((X + Z) % 5) == 0), "iron", 4)
    P.outline(g, desk & (Y == DESK - 1), "iron", 5, normal="y")
    for bx, bz in ((CX - 9, CZ - 7), (CX + 9, CZ - 7), (CX - 9, CZ + 7), (CX + 9, CZ + 7)):
        P.flat(g, desk & (np.abs(X + 0.5 - bx) < 1.6) & (np.abs(Z + 0.5 - bz) < 1.6), "gold", 5)
    lip = box(g, CX - 10, DESK, CZ + 6, CX + 10, DESK + 2, CZ + 8, "darkwood", 7)
    P.flat(g, lip & (Y == DESK + 1), "darkwood", 7)
    P.flat(g, edges(lip), "iron", 5)

    # ---- the grimoire, turned 8 degrees on the desk
    turn = 8.0
    g.prism("y", rect(CX - 1, CZ - 1, 8.4, 5.6, turn), DESK, DESK + 2, C("purple", 5))
    cover = S.last(g)
    P.flat(g, cover & (Y == DESK), "purple", 2)
    P.flat(g, cover & (Y == DESK + 1), "purple", 6)
    P.flat(g, cover & S.seams(g, g.solids[-1:], 0.9) & (Y == DESK + 1), "bone", 6)   # a bone frame round the cover
    P.flat(g, cover & S.seams(g, g.solids[-1:], 0.5) & (Y == DESK + 1), "purple", 2)
    for sx, sz in ((-6.8, -4.2), (6.8, -4.2), (-6.8, 4.2), (6.8, 4.2)):
        P.flat(g, cover & (Y == DESK + 1) & (np.abs(X + 0.5 - (CX - 1 + sx)) < 1.4) & (np.abs(Z + 0.5 - (CZ - 1 + sz)) < 1.4), "gold", 5)

    for s in (-1, 1):
        top_y = DESK + 4 + (1 if s < 0 else 0)
        g.prism("y", rect(CX - 1 + s * 3.8, CZ - 1, 3.6, 4.8, turn), DESK + 2, top_y, C("bone", 7))
        page = S.last(g)
        P.flat(g, page, "bone", 7)
        for py in range(DESK + 2, top_y):          # painted page-edge lines on the outer faces
            P.flat(g, page & (Y == py) & ((py % 2) == 0), "bone", 4)
        P.flat(g, page & S.seams(g, g.solids[-1:], 0.9), "bone", 4)
        tp = page & (Y == top_y - 1)
        P.flat(g, tp, "bone", 7)
        for row in (-3.0, -0.6, 1.8):              # runes only on the reading surface
            P.flat(g, tp & (np.abs(Z + 0.5 - (CZ - 1 + row)) < 0.5) & ((X % 3) != 0), "magenta", 6)
        P.flat(g, tp & (np.abs(Z + 0.5 - (CZ - 1 + 3.6)) < 0.5) & ((X % 4) != 0), "magenta", 4)
    gutter = box(g, CX - 1.8, DESK + 2, CZ - 6, CX - 0.2, DESK + 4, CZ + 4, "purple", 1)
    P.flat(g, gutter & (Y == DESK + 3), "toxic", 5)

    # ---- the clasp on the spine and the chain to a ring on the column
    clasp = box(g, CX + 6.5, DESK + 1, CZ - 2.5, CX + 9.5, DESK + 3, CZ + 0.5, "iron", 7)
    P.flat(g, clasp & (Y == DESK + 2), "gold", 5)
    P.flat(g, edges(clasp), "iron", 4)
    S.bar(g, "z", (CX + 8, DESK + 2), (CX + 11, DESK), 1.8, CZ - 2, CZ, "iron", 7)
    chain(g, CX + 11, CZ - 1, DESK, 6, ramp="iron", base=7)
    ring = S.disc(g, "z", CX + 11, 13, 2.6, CZ - 2, CZ, "iron", 7, n=8)
    P.flat(g, ring & (S.radial(g, "z", CX + 11, 13) < 1.4), "gray", 5)

    # ---- a skull and a lit candle share the desk
    sm = S.skull(g, CX + 7.5, DESK, CZ - 4.5, s=6, ramp="bone", base=7, eyes=("toxic", 6), socket=("purple", 1), seed=6)
    P.flat(g, sm & (Y < DESK + 3), "bone", 5)
    candle(g, int(CX - 8), DESK, int(CZ + 4), h=4, w=2, wax="bone", wax_base=6, flame=TOXIC)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=3, chance=0.12, seed=7)

    return single("chained-book", "props", "Chained Grimoire", g,
                  sockets=[Socket("socket-runes", at=(float(-1.0), float(DESK + 6), float(CZ - 1 - D / 2)))],
                  pfx=[pfx("rvx-monster-ghost-wisps", "socket-runes", "idle", size=16)])
