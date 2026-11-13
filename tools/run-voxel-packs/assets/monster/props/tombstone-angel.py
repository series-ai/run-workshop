"""Tombstone angel, in the Pirate Nation haunted style.

A mourning angel in front of a headstone (rule F4): a stepped grey
plinth of painted stone tiles with moss gathered along its edges, an
arched headstone joined to the plinth and carrying a violet inscription
panel with a gold cross, two oversized grey wings with bone feather tips
that sweep above the figure, and a chunky mid-grey robed body. A veiled
head with a bone face, deep eye hollows and a closed mouth sits clear of
the wings, and two arms come forward from the shoulders to clasped hands
that hold an oversized gold cross in front of the chest. Violet is kept
to the panel, the sash and the shadow of the veil. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, masonry, plinth, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 34, 50, 26
CX = 17.0
FZ = 8.0   # the centre of the figure
WZ = 14    # the wings sit behind the figure
TZ = 18    # the face of the headstone
ST = "gray"


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the plinth: painted stone tiles, moss only along the edges
    p1 = plinth(g, 2, 2, 32, 24, 0, 4, ST, 5, bevel=1.6, seed=1)
    p2 = plinth(g, 5, 4, 29, 22, 4, 3, ST, 6, bevel=1.0, seed=2)
    P.stone(g, p1 | p2, ST, 5, block=(6, 4), cracks=0.05, seed=3)
    P.flat(g, (p1 | p2) & (Y == 6), ST, 7)

    # ---- the arched headstone, joined to the plinth
    stone = box(g, 10, 6, TZ, 24, 30, TZ + 5, ST, 6)
    g.prism("z", [(10, 30), (24, 30), (22, 36), (12, 36)], TZ, TZ + 5, C(ST, 6))
    arch = S.last(g)
    masonry(g, stone | arch, ST, 6, block=(7, 4), seed=4)
    P.flat(g, (stone | arch) & (Y == 6), ST, 4)
    back = (stone | arch) & (Z == TZ + 4)
    P.stone(g, back, ST, 6, block=(7, 4), frame="z", seed=5)
    P.outline(g, back, ST, 3, normal="z")
    P.flat(g, back & (X > 12) & (X < 22) & (Y > 10) & (Y < 32), ST, 7)
    P.outline(g, back & (X > 12) & (X < 22) & (Y > 10) & (Y < 32), ST, 3, normal="z")
    face = (stone | arch) & (Z == TZ)
    P.flat(g, face, ST, 7)
    P.outline(g, face, ST, 3, normal="z")
    panel = face & (X > 12) & (X < 22) & (Y > 10) & (Y < 28)
    P.flat(g, panel, "purple", 4)
    P.outline(g, panel, ST, 7, normal="z")
    for row in (13, 16, 19):   # a painted inscription
        P.flat(g, panel & (np.abs(Y + 0.5 - row) < 0.5) & ((X % 3) != 0) & (X > 13) & (X < 21), ST, 7)
    pnglyph.icon(g, "-z", TZ, 14, 21, "cross", "gold", 5, depth=2)

    # ---- two oversized wings sweeping up behind the figure
    for sx in (-1, 1):
        g.prism("z", [(CX + sx * 2.0, 12), (CX + sx * 3.0, 33), (CX + sx * 9, 45), (CX + sx * 15, 41),
                      (CX + sx * 15, 31), (CX + sx * 11, 27), (CX + sx * 13, 21), (CX + sx * 9, 14), (CX + sx * 5, 12)],
                WZ, WZ + 4, C(ST, 6))
        wing = S.last(g)
        P.flat(g, wing, ST, 6)
        P.flat(g, wing & S.seams(g, g.solids[-1:], 0.9), ST, 3)
        for k in range(4):  # feather rows that follow the sweep of the wing
            row = np.abs((Y + 0.5) - 21 - k * 6 - np.abs(X + 0.5 - CX) * 0.9)
            P.flat(g, wing & (row < 0.8), ST, 4)
            P.flat(g, wing & (row >= 0.8) & (row < 1.6), "bone", 6)   # a bone highlight on every feather
        P.flat(g, wing & (Y > 38), "bone", 6)

    # ---- the robe: a true frustum with long folds and a violet sash
    start = len(g.solids)
    g.prism("y", [(CX - 6.0, FZ - 6), (CX + 6.0, FZ - 6), (CX + 6.0, FZ + 6), (CX - 6.0, FZ + 6)], 7, 26, C(ST, 6),
            top=[(CX - 4.0, FZ - 3), (CX + 4.0, FZ - 3), (CX + 4.0, FZ + 5), (CX - 4.0, FZ + 5)])
    robe = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, ST, 6, block=(9, 6), cracks=0.0, frame=fr, seed=5))
    for k in range(5):  # long vertical folds
        P.flat(g, robe & (np.abs(X + 0.5 - (CX + (k - 2) * 2.5)) < 0.6), ST, 4)
    P.flat(g, robe & (Y < 10), ST, 4)
    P.flat(g, robe & S.seams(g, g.solids[start:], 0.9), ST, 3)
    sash = robe & (Y >= 23) & (Y < 26)
    P.flat(g, sash, "purple", 4)
    P.flat(g, sash & (Y == 25), "purple", 6)

    # ---- shoulders, the veiled head and the bone face
    shoulders = box(g, CX - 5, 26, FZ - 4.5, CX + 5, 30, FZ + 5, ST, 6)
    P.flat(g, edges(shoulders), ST, 3)
    P.flat(g, shoulders & (Y == 29), ST, 7)
    head = box(g, CX - 3.5, 30, FZ - 4.5, CX + 3.5, 37, FZ + 3, "bone", 7)
    P.flat(g, edges(head), "bone", 4)
    hstart = len(g.solids)
    g.prism("y", [(CX - 5.5, FZ - 5.5), (CX + 5.5, FZ - 5.5), (CX + 5.5, FZ + 5), (CX - 5.5, FZ + 5)], 32, 41, C(ST, 6),
            top=[(CX - 2.0, FZ - 1), (CX + 2.0, FZ - 1), (CX + 2.0, FZ + 3), (CX - 2.0, FZ + 3)])
    veil = union(g, hstart)
    S.paint_facets(g, g.solids[hstart:], lambda gg, mm, fr: P.stone(gg, mm, ST, 6, block=(6, 4), cracks=0.0, frame=fr, seed=6))
    P.flat(g, veil & S.seams(g, g.solids[hstart:], 0.9), ST, 3)
    g.carve(veil & (Z + 0.5 < FZ - 2.5) & (Y > 31) & (Y < 38) & (np.abs(X + 0.5 - CX) < 3.8))
    P.flat(g, veil & (Z + 0.5 < FZ - 2.0) & (Y > 37), "purple", 2)   # the shadow under the veil's lip
    fp = head & (Z == int(FZ) - 5)
    P.flat(g, fp, "bone", 7)
    for sx in (-1, 1):   # deep eye hollows
        eye = fp & (np.abs(X + 0.5 - (CX + sx * 1.8)) < 1.1) & (np.abs(Y + 0.5 - 34.5) < 1.1)
        P.flat(g, eye, "purple", 1)
        P.flat(g, eye & (np.abs(Y + 0.5 - 34.8) < 0.6) & (np.abs(X + 0.5 - (CX + sx * 1.8)) < 0.6), "bone", 4)
    P.flat(g, fp & (np.abs(X + 0.5 - CX) < 0.6) & (np.abs(Y + 0.5 - 33.0) < 0.6), "bone", 5)   # the nose
    P.flat(g, fp & (np.abs(X + 0.5 - CX) < 1.6) & (np.abs(Y + 0.5 - 31.6) < 0.5), "bone", 4)   # a closed mouth
    P.flat(g, fp & (Y > 35), "bone", 5)

    # ---- two arms come forward to clasped hands holding a gold cross
    for sx in (-1, 1):
        S.bar(g, "z", (CX + sx * 5, 27), (CX + sx * 2.5, 19), 3.4, FZ - 7, FZ - 2, ST, 7)
        arm = S.last(g)
        P.flat(g, arm, ST, 7)
        P.flat(g, arm & S.seams(g, g.solids[-1:], 0.9), ST, 4)
    hands = box(g, CX - 3.5, 16, FZ - 8, CX + 3.5, 20, FZ - 2, ST, 7)
    P.flat(g, edges(hands), ST, 3)
    for fy in (17, 19):
        P.flat(g, hands & (Y == fy) & (Z + 0.5 < FZ - 6.5), ST, 4)
    cross = box(g, CX - 1.5, 12, FZ - 9.5, CX + 1.5, 27, FZ - 7.0, "gold", 4)
    cross |= box(g, CX - 5, 22, FZ - 9.5, CX + 5, 25, FZ - 7.0, "gold", 4)
    P.flat(g, cross & (Z == int(FZ) - 10), "gold", 6)
    P.flat(g, cross & ((Y % 4) == 0), "gold", 5)
    P.flat(g, edges(cross), "gold", 2)

    # ---- a laid bunch of flowers and two chunks of fallen stone
    stems = box(g, 6.0, 7, 6.0, 12.0, 8, 12.0, "moss", 4)
    P.flat(g, stems & (((X + Z) % 3) == 0), "moss", 6)
    P.flat(g, edges(stems), "moss", 2)
    for fx, fz in ((6.5, 7.0), (8.5, 10.0), (10.5, 7.5)):
        bud = box(g, fx, 8, fz, fx + 2, 10, fz + 2, "magenta", 5)
        P.flat(g, bud & (Y == 9), "magenta", 6)
        P.flat(g, edges(bud), "magenta", 2)
    for rx, rz, rs in ((27.0, 9.0, 2), (24.5, 19.0, 2)):
        rub = box(g, rx - rs, 7, rz - rs, rx + rs, 7 + rs + 1, rz + rs, ST, 5)
        P.stone(g, rub, ST, 5, block=(4, 3), seed=int(rx + rz))
        P.flat(g, edges(rub), ST, 3)
        P.flat(g, rub & (Y == 7 + rs), ST, 7)

    # ---- moss gathered along the edges of the plinth only
    from pnpaint import blotch
    blotch(g, (p1 | p2) & (Y < 7), "moss", 5, cell=4, chance=0.16, seed=9)

    return prop("tombstone-angel", "Tombstone Angel", g)
