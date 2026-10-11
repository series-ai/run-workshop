"""Crow statue, in the Pirate Nation haunted style.

A pale grey stone pedestal with a true chamfer, a gold plaque with a
painted skull, and one oversized violet-black crow perched on top (rule
K3): a fat body, folded wings with bone wing bars, a fanned tail, a big
pumpkin-orange beak and a glowing toxic eye, so the bird reads against
the stone at 128 px. Moss climbs the foot. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, masonry, plinth, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 24, 36, 24
CX, CZ = 12.0, 12.0
CAP = 16  # the top of the pedestal
FEA = ("purple", 3)


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the pedestal: a chamfered base, a tapered shaft and a cap
    plinth(g, 2, 2, 22, 22, 0, 4, "gray", 5, bevel=1.6, seed=1)
    start = len(g.solids)
    g.prism("y", [(4, 4), (20, 4), (20, 20), (4, 20)], 4, CAP - 2, C("gray", 6),
            top=[(6, 6), (18, 6), (18, 18), (6, 18)])
    shaft = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 6, block=(6, 4), cracks=0.05, frame=fr, seed=2))
    plinth(g, 4, 4, 20, 20, CAP - 2, 3, "gray", 6, bevel=1.2, seed=3)

    # ---- the gold plaque with a painted skull
    plaque = box(g, 7, 7, 3, 17, 13, 5, "gold", 4)
    P.flat(g, edges(plaque), "gold", 2)
    P.flat(g, plaque & (Z == 3) & (X > 7) & (X < 16) & (Y > 7) & (Y < 12), "purple", 2)
    pnglyph.icon(g, "-z", 3, 8, 8, "skull", "gold", 6, depth=2)

    # ---- the crow: body, head, beak, wings and tail
    body_y = CAP + 7
    g.ellipsoid(CX, body_y, CZ + 1.0, 4.4, 5.0, 6.2, C(*FEA))
    g.ellipsoid(CX, body_y + 6.0, CZ - 2.0, 3.4, 3.4, 3.6, C(*FEA))  # the head
    crow = g.a == C(*FEA)
    neck = crow & (np.abs((Y + 0.5 - (body_y + 3.6)) + (Z + 0.5 - (CZ - 0.6)) * 0.5) < 0.9)
    # the chest and crown catch the light, the belly stays dark
    P.flat(g, crow & (Y > body_y + 3), "purple", 4)
    P.flat(g, crow & (Y < body_y - 2), "purple", 2)
    P.flat(g, crow & (Z + 0.5 < CZ - 3.0) & (Y < body_y + 3), "purple", 4)
    P.flat(g, neck, "purple", 1)  # a dark collar splits the head from the body
    # the beak: a true wedge pointing -Z
    g.prism("y", [(CX - 2.2, CZ - 5.2), (CX + 2.2, CZ - 5.2), (CX + 0.6, CZ - 9.4), (CX - 0.6, CZ - 9.4)], body_y + 4, body_y + 7, C("orange", 4),
            top=[(CX - 1.6, CZ - 5.2), (CX + 1.6, CZ - 5.2), (CX + 0.4, CZ - 9.0), (CX - 0.4, CZ - 9.0)])
    beak = S.last(g)
    P.flat(g, beak & (Y == body_y + 6), "orange", 6)
    P.flat(g, beak & (Y == body_y + 4), "orange", 2)
    # the eyes
    for sx in (-1, 1):
        eye = crow & (np.abs(X + 0.5 - (CX + sx * 2.6)) < 1.3) & (np.abs(Y + 0.5 - (body_y + 6.6)) < 1.3) & (Z + 0.5 < CZ - 3.6)
        P.flat(g, eye, "toxic", 6)
        P.flat(g, eye & (np.abs(Y + 0.5 - (body_y + 6.6)) < 0.6), "gray", 1)
    # folded wings: true triangular slabs down each flank, with bone wing bars
    for sx in (-1, 1):
        g.prism("x", [(body_y + 4, CZ - 3.5), (body_y + 5, CZ + 6.5), (body_y - 4, CZ + 7.5), (body_y - 3, CZ - 2.5)],
                CX + sx * 4.0 - 1.4, CX + sx * 4.0 + 1.4, C("purple", 4))
        wing = S.last(g)
        P.flat(g, wing & S.seams(g, g.solids[-1:], 0.3), "purple", 1)
        # two clean bone wing bars that follow the slope of the wing
        for k in (-2.0, 1.5):
            P.flat(g, wing & (np.abs((Y + 0.5 - body_y) - (Z + 0.5 - CZ) * 0.11 - k) < 0.55), "bone", 6)
    # the tail: a fan of true slopes behind
    g.prism("x", [(body_y + 1, CZ + 4.0), (body_y + 3, CZ + 5.5), (body_y - 5, CZ + 11.4), (body_y - 7, CZ + 9.0)], CX - 4.0, CX + 4.0, C(*FEA))
    tail = S.last(g)
    for k in (-2, 0, 2):
        P.flat(g, tail & (np.abs(X + 0.5 - (CX + k)) < 0.5), "purple", 1)
    P.flat(g, tail & (Z + 0.5 > CZ + 9.0), "purple", 5)
    # the feet gripping the cap
    for sx in (-1, 1):
        box(g, CX + sx * 3 - 1, CAP + 1, CZ - 1, CX + sx * 3 + 1, CAP + 3, CZ + 2, "gold", 3)
        for k in (-1, 0, 1):
            box(g, CX + sx * 3 + k, CAP + 1, CZ - 3, CX + sx * 3 + k + 1, CAP + 2, CZ - 1, "gold", 4)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 4), "moss", 5, cell=2, chance=0.12, seed=7)

    return prop("crow-statue", "Crow Statue", g)
