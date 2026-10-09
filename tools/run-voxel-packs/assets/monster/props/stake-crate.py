"""Stake crate, in the Pirate Nation haunted style.

A vampire hunter's supply box: every face of the crate carries painted
boards with nail dots, dark corner posts, top and bottom rails and an
iron strap, and a violet stencil panel on the front holds a bone cross.
A bundle of oversized sharpened hawthorn stakes stands point up in the
straw, each in its own wood tone with a dark seam and a khaki twine
wrap, and one carries a toxic-green rune. A heavy iron-banded mallet
leans on the side, two loose stakes lie in front with wood chips, and a
bundle of garlic bulbs tied with magenta cord sits on the lid board.
Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnshapes as S
from _props import idx, planked, prop, union
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 32, 36, 28
X0, X1, Z0, Z1 = 3, 23, 5, 21
TOP = 18
# (x, z, height, lean, wood shade, twine)
STAKES = ((8.0, 9.0, 18, 0.0, 6, True), (12.0, 11.0, 15, 0.6, 7, False), (16.0, 9.5, 19, -0.8, 5, True),
          (10.0, 15.0, 14, 0.9, 7, False), (14.5, 16.0, 17, -0.5, 6, True), (18.5, 14.0, 13, 0.4, 5, False))


def stake(g, X, Y, Z, cx, cz, y0, h, lean, shade, twine, r=1.6):
    """A sharpened stake: a square shaft with a dark grain seam, an optional
    twine wrap and a true conical point."""
    g.prism("y", [(cx - r, cz - r), (cx + r, cz - r), (cx + r, cz + r), (cx - r, cz + r)], y0, y0 + h, C("wood", shade),
            top=[(cx - r + lean, cz - r), (cx + r + lean, cz - r), (cx + r + lean, cz + r), (cx - r + lean, cz + r)])
    shaft = S.last(g)
    P.flat(g, shaft, "wood", shade)
    P.flat(g, shaft & S.seams(g, g.solids[-1:], 0.9), "wood", max(1, shade - 3))
    P.flat(g, shaft & (((X + Z) % 4) == 0), "wood", max(1, shade - 1))
    if twine:
        wrap = shaft & (Y > y0 + h * 0.45) & (Y < y0 + h * 0.45 + 3)
        P.flat(g, wrap, "khaki", 4)
        P.flat(g, wrap & ((Y % 2) == 0), "khaki", 6)
    g.prism("y", [(cx - r + lean, cz - r), (cx + r + lean, cz - r), (cx + r + lean, cz + r), (cx - r + lean, cz + r)],
            y0 + h, y0 + h + r * 2.4, C("wood", min(7, shade + 1)), top=[(cx + lean * 1.4, cz)] * 4)
    tip = S.last(g)
    P.flat(g, tip, "wood", min(7, shade + 1))
    P.flat(g, tip & (Y > y0 + h + r), "bone", 6)
    P.flat(g, tip & (Y == y0 + h), "wood", max(1, shade - 3))
    return shaft | tip


def build():
    g = Grid(W, H, D)
    X, Y, Z = idx(g)

    # ---- the crate: painted boards on every face, with a dark frame
    body = box(g, X0, 0, Z0, X1, TOP, Z1, "wood", 7)
    planked(g, body, "wood", 7, width=4, across="y", nails=True, seed=1)
    corner = ((X < X0 + 2) | (X >= X1 - 2)) & ((Z < Z0 + 2) | (Z >= Z1 - 2))
    P.flat(g, body & corner, "darkwood", 6)
    P.flat(g, body & corner & ((Y % 4) == 0), "darkwood", 4)
    for yb in (0, TOP - 2):
        rail = body & (Y >= yb) & (Y < yb + 2)
        P.flat(g, rail, "darkwood", 6)
        P.flat(g, rail & (Y == yb + 1), "darkwood", 7)
    for yb in (4, 14):
        strap = body & (Y >= yb) & (Y < yb + 2)
        P.flat(g, strap, "iron", 7)
        P.flat(g, strap & (((X + Z) % 5) == 0), "iron", 4)
        P.flat(g, strap & (Y == yb), "iron", 4)
    g.carve(body & (X > X0 + 1) & (X < X1 - 2) & (Z > Z0 + 1) & (Z < Z1 - 2) & (Y > 8))

    # ---- the stencil panel on the front: a violet plate with a bone cross
    panel = body & (Z == Z0) & (X > 6) & (X < 20) & (Y > 6) & (Y < 14)
    P.flat(g, panel, "purple", 4)
    P.outline(g, panel, "purple", 2, normal="z")
    cross = panel & (((np.abs(X + 0.5 - 13.0) < 1.6) & (Y > 7) & (Y < 13))
                     | ((np.abs(Y + 0.5 - 11.0) < 1.0) & (np.abs(X + 0.5 - 13.0) < 3.6)))
    P.flat(g, cross, "bone", 7)

    # ---- straw and the bundle of stakes
    straw = box(g, X0 + 2, 9, Z0 + 2, X1 - 2, 11, Z1 - 2, "khaki", 5)
    P.flat(g, straw & (((X * 3 + Z) % 4) == 0), "khaki", 7)
    P.flat(g, straw & (((X + Z * 3) % 5) == 0), "khaki", 3)
    for cx, cz, h, lean, shade, twine in STAKES:
        stake(g, X, Y, Z, cx, cz, 11, h, lean, shade, twine)
    rune = (g.a != 0) & (np.abs(X + 0.5 - 16.0) < 2.0) & (np.abs(Z + 0.5 - 9.5) < 2.0) & (Y > 22) & (Y < 25)
    P.flat(g, rune, "toxic", 6)
    P.flat(g, rune & ((Y % 2) == 0), "toxic", 3)

    # ---- an iron-banded mallet leaning on the crate
    S.bar(g, "z", (24.5, 2), (26.0, 20), 2.6, 9, 13, "wood", 6)
    haft = S.last(g)
    P.flat(g, haft & ((Y % 5) == 0), "wood", 4)
    P.flat(g, haft & S.seams(g, g.solids[-1:], 0.9), "wood", 3)
    head = box(g, 23, 20, 8, 29, 27, 14, "wood", 5)
    P.planks(g, head, "wood", 5, width=3, across="y", nails=False, seed=4)
    P.flat(g, edges(head), "darkwood", 5)
    P.flat(g, head & (Y == 26), "wood", 7)
    for yb in (21, 25):
        band = head & (Y >= yb) & (Y < yb + 1)
        P.flat(g, band, "iron", 7)
        P.flat(g, band & (((X + Z) % 4) == 0), "iron", 4)

    # ---- a bundle of garlic bulbs tied with magenta cord, on the crate rail
    for k, (bx, bz) in enumerate(((26.5, 3.0), (29.6, 2.4), (28.0, 6.0))):
        r = 2.2 if k != 1 else 2.6
        m = box(g, bx - r, 0, bz - r * 0.8, bx + r, r * 1.3, bz + r * 0.8, "bone", 7)
        m |= box(g, bx - r * 0.6, r * 1.3, bz - r * 0.5, bx + r * 0.6, r * 1.9, bz + r * 0.5, "bone", 6)
        P.flat(g, m, "bone", 7)
        P.flat(g, m & (Y < 2), "bone", 5)
        for dx in (-r * 0.45, r * 0.45):
            P.flat(g, m & (np.abs(X + 0.5 - (bx + dx)) < 0.5), "bone", 5)
        nk = box(g, bx - 0.8, r * 1.9, bz - 0.8, bx + 0.8, r * 2.6, bz + 0.8, "moss", 5)
        P.flat(g, nk & (Y > r * 2.2), "moss", 3)
    cord = (g.a != 0) & (Y > 4) & (Y < 6) & (X > 24) & (Z < 8)
    P.flat(g, cord, "magenta", 4)

    # ---- two loose stakes and wood chips in front
    S.bar(g, "y", (5.0, 2.0), (16.0, 3.5), 3.0, 0, 3, "wood", 6)
    lo = S.last(g)
    P.flat(g, lo & (Y == 2), "wood", 7)
    P.flat(g, lo & S.seams(g, g.solids[-1:], 0.9), "wood", 3)
    g.prism("y", [(16.0, 2.0), (16.0, 5.0), (20.0, 3.5)], 0, 3, C("wood", 7))
    P.flat(g, S.last(g), "wood", 7)
    for cx, cz in ((7, 25), (12, 26), (19, 2), (22, 25)):
        chip = box(g, cx, 0, cz, cx + 2, 1, cz + 2, "wood", 6)
        P.flat(g, edges(chip), "wood", 3)

    from pnpaint import blotch
    blotch(g, (g.a != 0) & (Y < 3), "moss", 5, cell=3, chance=0.12, seed=7)

    return prop("stake-crate", "Stake Crate", g)
