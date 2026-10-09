"""Silver bullet crate, in the Pirate Nation haunted style.

An open plank crate of hunter's ammunition: every face carries painted
boards with nail dots, dark corner posts, top and bottom rails and two
iron straps, and a violet stencil panel on the front holds a bone skull
and a toxic-green chalk tally. Straw packs six oversized silver rounds —
a gold case with a rim and a cannelure, a steel shoulder and a stepped
steel nose — standing well apart, muzzle up. The lid leans against the
side with both ends in contact, a loose round lies on the ground and moss
grows at the foot. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 34, 24, 28
X0, X1, Z0, Z1 = 3, 27, 5, 21
TOP = 14


def bullet(g, X, Y, Z, cx, cz, y0, h, r):
    """One fat round, built from chunky stepped drums: a gold case with a
    rim and a cannelure, a steel shoulder and a two-step steel nose."""
    case = S.disc(g, "y", cx, cz, r, y0, y0 + h, "gold", 4, n=8)
    P.flat(g, case, "gold", 4)
    P.flat(g, case & (Y == y0), "gold", 2)
    P.flat(g, case & (Y == y0 + 1), "gold", 6)                  # the rim
    P.flat(g, case & (Y == y0 + h - 2), "gold", 2)              # the cannelure
    P.flat(g, case & S.seams(g, g.solids[-1:], 0.9), "gold", 3)
    sh = S.disc(g, "y", cx, cz, r * 0.92, y0 + h, y0 + h + 2, "steel", 4, n=8)
    P.flat(g, sh, "steel", 4)
    P.flat(g, sh & (Y == y0 + h), "steel", 2)
    n1 = S.disc(g, "y", cx, cz, r * 0.70, y0 + h + 2, y0 + h + 4, "steel", 6, n=8)
    n2 = S.disc(g, "y", cx, cz, r * 0.38, y0 + h + 4, y0 + h + 5, "steel", 7, n=8)
    P.flat(g, n1, "steel", 6)
    P.flat(g, n2, "steel", 7)
    P.flat(g, n1 & (Y == y0 + h + 2), "steel", 3)
    return case | sh | n1 | n2


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the crate: painted boards on every face, with a dark frame
    body = box(g, X0, 0, Z0, X1, TOP, Z1, "wood", 6)
    planked(g, body, "wood", 6, width=4, across="y", nails=True, seed=1)
    corner = ((X < X0 + 2) | (X >= X1 - 2)) & ((Z < Z0 + 2) | (Z >= Z1 - 2))
    P.flat(g, body & corner, "darkwood", 6)                 # four dark corner posts, nothing else
    P.flat(g, body & corner & (((Y) % 4) == 0), "darkwood", 4)
    for yb in (0, TOP - 2):                                  # top and bottom rails
        rail = body & (Y >= yb) & (Y < yb + 2)
        P.flat(g, rail, "darkwood", 6)
        P.flat(g, rail & (Y == yb + 1), "darkwood", 7)
    for yb in (5,):                                          # an iron strap round the middle
        strap = body & (Y >= yb) & (Y < yb + 2)
        P.flat(g, strap, "iron", 7)
        P.flat(g, strap & (((X + Z) % 5) == 0), "iron", 4)
        P.flat(g, strap & (Y == yb), "iron", 4)
    g.carve(body & (X > X0 + 1) & (X < X1 - 2) & (Z > Z0 + 1) & (Z < Z1 - 2) & (Y > 5))

    # ---- the stencil panel on the front: a violet plate, a skull and a tally
    panel = body & (Z == Z0) & (X > 7) & (X < 23) & (Y > 6) & (Y < TOP - 2)
    P.flat(g, panel, "purple", 4)
    P.outline(g, panel, "purple", 2, normal="z")
    pnglyph.icon(g, "-z", Z0, 12, 7, "skull", "bone", 7, depth=2, inks={".": ("purple", 4)})
    for k in range(4):
        P.flat(g, body & (Z == Z0) & (np.abs(X + 0.5 - (9 + k)) < 0.5) & (Y > 8) & (Y < 12), "toxic", 6)

    # ---- straw packing inside
    straw = box(g, X0 + 2, 6, Z0 + 2, X1 - 2, 8, Z1 - 2, "khaki", 5)
    P.flat(g, straw & (((X * 3 + Z) % 4) == 0), "khaki", 7)
    P.flat(g, straw & (((X + Z * 3) % 5) == 0), "khaki", 3)

    # ---- six fat rounds standing well apart in the straw
    for k, cx in enumerate((8.5, 15.0, 21.5)):
        for j, cz in enumerate((10.0, 16.0)):
            bullet(g, X, Y, Z, cx, cz, 8, 5 + ((k + j) % 2), 2.2)

    # ---- the lid leaning on the side, in contact at both ends
    g.prism("z", [(27, 0), (31, 0), (33, 15), (29, 16)], Z0 + 2, Z1 - 2, C("wood", 6))
    lid = S.last(g)
    P.planks(g, lid, "wood", 6, width=4, across="y", nails=True, frame="x", seed=3)
    P.flat(g, lid & S.seams(g, g.solids[-1:], 0.9), "darkwood", 6)
    P.flat(g, lid & (Y < 2), "darkwood", 6)
    P.flat(g, lid & (Y > 13), "darkwood", 6)

    # ---- a loose round on the ground, lying on its side
    lm = S.disc(g, "z", 5.0, 2.0, 1.8, 22, 27, "gold", 4)
    P.flat(g, lm, "gold", 4)
    P.flat(g, lm & (Z == 22), "steel", 6)
    P.flat(g, lm & (Z > 25), "gold", 2)
    P.flat(g, lm & S.seams(g, g.solids[-1:], 0.9), "gold", 3)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 3), "moss", 5, cell=3, chance=0.12, seed=5)

    return prop("silver-bullet-crate", "Silver Bullet Crate", g)
