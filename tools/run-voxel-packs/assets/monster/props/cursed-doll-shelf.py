"""Cursed doll shelf, in the Pirate Nation haunted style.

A nursery cabinet that nobody should open: grey stone feet, a plank case
with steel corner straps, a violet-stained back of framed panels and two
thick boards with a steel and gold edge rail. Two tall compartments hold
one oversized porcelain doll each — a big bone head with black button
eyes, a toxic-green glint, a stitched mouth, a dark bob and a violet or
magenta bell dress — and they stand at the front of the boards, so they
read in the light. A skull and a lit toxic candle share the upper
compartment. A purple slate pediment with a painted skull crowns the
case and moss creeps up the stone. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import TOXIC, candle, idx, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 34, 44, 14
Z0, Z1 = 1, 13          # the inside of the case, front to back
BACK = 11               # the back boards start here
FLOOR = 7               # the bottom board top
MID = 22                # the middle board (3 thick: 22..25)
CEIL = 36               # the top board (36..38)


def doll(g, X, Y, Z, cx, y0, h, dress, shade, hair, lean, seed):
    """One porcelain doll, built at the front of its board: a bell skirt, a
    short bodice with two stub arms, and an oversized bone head with black
    button eyes, a stitched mouth and a dark bob."""
    sk = round(h * 0.34)
    bo = max(2, round(h * 0.13))
    hd = h - sk - bo
    zf, zb = 1.5, 8.5
    # ---- the bell skirt: a true frustum
    g.prism("y", [(cx - 4.0 + lean * 0.2, zf - 0.4), (cx + 4.0 + lean * 0.2, zf - 0.4),
                  (cx + 4.0 + lean * 0.2, zb + 0.4), (cx - 4.0 + lean * 0.2, zb + 0.4)], y0, y0 + sk, C(dress, shade),
            top=[(cx - 2.4 + lean, zf + 1.6), (cx + 2.4 + lean, zf + 1.6),
                 (cx + 2.4 + lean, zb - 1.6), (cx - 2.4 + lean, zb - 1.6)])
    skirt = S.last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.planks(gg, mm, dress, shade, width=4, across="x", nails=False, frame=fr, seed=seed))
    P.flat(g, skirt, dress, shade)
    P.flat(g, skirt & S.seams(g, g.solids[-1:], 0.9), dress, max(1, shade - 2))
    P.flat(g, skirt & (Y == y0), dress, max(1, shade - 3))
    P.flat(g, skirt & (Y == y0 + 1), "bone", 6)                     # a pale lace hem
    P.flat(g, skirt & (Y == y0 + sk - 1), dress, min(7, shade + 1))

    # ---- the bodice and two stub arms with bone hands
    body = box(g, cx - 2.6 + lean, y0 + sk, zf + 1.4, cx + 2.6 + lean, y0 + sk + bo, zb - 1.4, dress, min(7, shade + 1))
    P.flat(g, edges(body), dress, max(1, shade - 3))
    P.flat(g, body & (Z == int(zf) + 1) & (np.abs(X + 0.5 - (cx + lean)) < 1.2), "bone", 6)  # the pinafore bib
    for sx in (-1, 1):
        arm = box(g, cx + lean + sx * 4.0 - 1.2, y0 + sk - 1, zf + 1.8, cx + lean + sx * 4.0 + 1.2, y0 + sk + bo, zb - 1.8, dress, shade)
        P.flat(g, edges(arm), dress, max(1, shade - 3))
        hnd = box(g, cx + lean + sx * 4.0 - 1.2, y0 + sk - 2, zf + 1.8, cx + lean + sx * 4.0 + 1.2, y0 + sk - 1, zb - 1.8, "bone", 7)
        P.flat(g, edges(hnd), "bone", 4)

    # ---- the oversized bone head and a dark bob
    hy = y0 + sk + bo
    head = box(g, cx + lean - 4.2, hy, zf, cx + lean + 4.2, hy + hd - 1, zb, "bone", 7)
    P.flat(g, edges(head), "bone", 4)
    P.flat(g, head & (Y == hy), "bone", 5)
    cap = box(g, cx + lean - 4.8, hy + hd - 2, zf - 0.6, cx + lean + 4.8, hy + hd, zb + 0.6, hair, 5)
    P.flat(g, cap & (Y == hy + hd - 1), hair, 6)
    P.flat(g, cap & (Z == int(zf) - 1), hair, 4)
    P.flat(g, edges(cap), hair, 3)
    g.carve(cap & (Z < zf + 0.5) & (Y < hy + hd - 1) & (np.abs(X + 0.5 - (cx + lean)) < 3.0))  # the fringe parts
    bow = box(g, cx + lean - 1.8, hy + hd, zf + 1.6, cx + lean + 1.8, hy + hd + 1, zb - 1.6, "magenta", 5)
    P.flat(g, edges(bow), "magenta", 2)

    # ---- the face, painted on the front plate
    face = head & (Z == int(zf))
    ey = hy + hd * 0.58
    my = hy + hd * 0.22
    for sx in (-1, 1):
        eye = face & (np.abs(X + 0.5 - (cx + lean + sx * 2.1)) < 1.3) & (np.abs(Y + 0.5 - ey) < 1.3)
        P.flat(g, eye, "gray", 1)
        P.flat(g, eye & (np.abs(X + 0.5 - (cx + lean + sx * 2.1 - 0.5)) < 0.6) & (np.abs(Y + 0.5 - (ey + 0.5)) < 0.6), "toxic", 6)
    mouth = face & (np.abs(X + 0.5 - (cx + lean)) < 2.4) & (np.abs(Y + 0.5 - my) < 0.6)
    P.flat(g, mouth, "blood", 3)
    P.flat(g, mouth & ((X % 2) == 0), "bone", 5)  # the stitches
    P.flat(g, face & (np.abs(X + 0.5 - (cx + lean)) < 0.6) & (np.abs(Y + 0.5 - (ey - 1.8)) < 0.6), "bone", 5)
    P.flat(g, face & (np.abs((X + 0.5 - (cx + lean)) * 0.8 + (Y + 0.5 - ey) * 0.6 - 2.8) < 0.45) & (Y < ey), "bone", 4)
    return skirt | head


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- grey stone feet and a kerb between them
    for x0 in (0, 26):
        foot = box(g, x0, 0, 0, x0 + 8, 4, D, "gray", 5)
        P.stone(g, foot, "gray", 5, block=(5, 3), seed=x0 + 1)
        P.flat(g, foot & (Y == 3), "gray", 6)
        P.flat(g, edges(foot), "gray", 3)
    rail = box(g, 8, 1, 1, 26, 3, D - 1, "gray", 4)
    P.flat(g, edges(rail), "gray", 2)

    # ---- the case: two plank sides with steel straps, and a violet back
    for x0 in (0, 31):
        side = box(g, x0, 4, Z0, x0 + 3, CEIL, Z1, "wood", 5)
        planked(g, side, "wood", 5, width=4, across="y", nails=True, seed=x0 + 3)
        P.flat(g, edges(side), "darkwood", 4)
        for yb in (9, 20, 32):
            strap = side & (Y >= yb) & (Y < yb + 2)
            P.flat(g, strap, "steel", 5)
            P.flat(g, strap & (((X + Z) % 5) == 0), "steel", 2)
    back = box(g, 3, 4, BACK, 31, CEIL, Z1, "purple", 5)
    planked(g, back, "purple", 5, width=5, across="x", nails=False, seed=5)
    P.flat(g, back & (Z == BACK), "purple", 5)
    for py in (9, 27):  # framed panels painted on the back boards
        panel = back & (Z == BACK) & (Y > py) & (Y < py + 11) & (X > 6) & (X < 28)
        P.flat(g, panel, "purple", 6)
        P.outline(g, panel, "purple", 3, normal="z")
        P.flat(g, panel & (Y > py + 1) & (Y < py + 10) & (X > 8) & (X < 26), "purple", 5)

    # ---- the boards: thick, with a steel and gold edge rail
    for y0 in (FLOOR - 3, MID, CEIL):
        sh = box(g, 2, y0, Z0, 32, y0 + 3, Z1, "wood", 6)
        planked(g, sh, "wood", 6, width=5, across="x", nails=True, frame="top", seed=y0)
        P.flat(g, sh & (Y == y0 + 2), "wood", 7)
        P.flat(g, edges(sh), "darkwood", 4)
        band = sh & (Z < Z0 + 2)
        P.flat(g, band, "steel", 6)
        P.flat(g, band & ((X % 6) == 0), "steel", 3)
        P.flat(g, band & (Y == y0 + 1), "gold", 4)
        P.flat(g, band & (Y == y0), "steel", 2)

    # ---- the pediment: a purple slate slope with a painted skull
    g.prism("z", [(0, CEIL + 3), (34, CEIL + 3), (28, 44), (6, 44)], 0, D, C("purple", 5))
    ped = S.last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 5, row=3, width=5, frame=fr, seed=5))
    P.flat(g, ped & S.seams(g, g.solids[-1:], 0.9), "purple", 2)
    pnglyph.icon(g, "-z", 0, 13, CEIL + 3, "skull", "bone", 7, depth=2)

    # ---- one oversized doll per compartment, each leaning its own way
    doll(g, X, Y, Z, 11.5, FLOOR, 15, "purple", 6, "darkwood", lean=0.0, seed=11)
    doll(g, X, Y, Z, 12.5, MID + 3, 10, "magenta", 6, "darkwood", lean=1.0, seed=17)

    # ---- a skull and a lit toxic candle beside the second doll
    sk = S.skull(g, 25.0, MID + 3, 6.0, s=8, ramp="bone", base=7, eyes=("toxic", 6), socket=("purple", 1), seed=21)
    P.flat(g, sk & (Y < MID + 6), "bone", 5)
    candle(g, 24, FLOOR, 4, h=5, w=2, wax="bone", wax_base=6, flame=TOXIC)
    for bx, bw, col in ((20, 9, "purple"), (21, 7, "blood")):
        bk = box(g, bx, FLOOR, 8.0, bx + bw, FLOOR + 2, 12.0, col, 4)
        P.flat(g, edges(bk), col, 2)
        P.flat(g, bk & (Z == 8), "bone", 6)

    # ---- cobwebs painted into the two upper front corners
    for sx, x0 in ((1, 3), (-1, 31)):
        for k in range(1, 5):
            P.flat(g, (g.a != 0) & (Z == Z0) & (np.abs((X + 0.5 - x0) * sx + (CEIL - Y - 0.5) - k * 2.4) < 0.5)
                   & (Y > CEIL - 9) & (Y < CEIL) & (np.abs(X + 0.5 - x0) < 9), "bone", 6)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=3, chance=0.10, seed=9)

    return prop("cursed-doll-shelf", "Cursed Doll Shelf", g)
