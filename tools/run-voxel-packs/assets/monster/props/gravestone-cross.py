"""Celtic cross grave, in the Pirate Nation haunted style.

A thick stone cross with a stone ring round its crossing (eight true
diagonal bars), leaning a little from frost heave (rule F5). It stands on
a two-step plinth (purple slate under grey stone) with a painted name
plate. Engraved lines, moss and climbing ivy; a glowing magenta gem at the
crossing; two candles and a flower wreath at its foot. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import candle, idx, masonry, plinth, prop, tufts
from pnkit import box, edges
from voxgrid import C, Grid, Part

T = 4  # cross thickness (z)


def cross_grid() -> tuple[Grid, tuple[float, float, float]]:
    g = Grid(24, 32, 8)
    cx, cz = 12, 4
    z0, z1 = cz - T / 2, cz + T / 2
    shaft = box(g, cx - 3, 0, z0, cx + 3, 30, z1, "gray", 5)
    arms = box(g, cx - 11, 17, z0, cx + 11, 23, z1, "gray", 5)
    m = shaft | arms
    masonry(g, m, "gray", 5, block=(6, 5), seed=11)
    X, Y, Z = idx(g)
    # an engraved line down the shaft and along the arms, front and back
    face = m & ~edges(m) & ((Z == int(z0)) | (Z == int(z1) - 1))
    P.flat(g, face & (((np.abs(X + 0.5 - cx) < 0.6) & (Y > 2) & (Y < 28)) | ((Y == 20) & (np.abs(X + 0.5 - cx) < 10))), "gray", 3)
    # a glowing magenta gem at the crossing, both sides
    gem = box(g, cx - 2, 18, z0 - 1, cx + 2, 22, z1 + 1, "magenta", 5)
    P.flat(g, gem & (np.abs(X + 0.5 - cx) < 1.1) & (np.abs(Y + 0.5 - 20) < 1.1), "magenta", 7)
    P.flat(g, edges(gem), "gold", 4)
    # the ring: eight bars round the crossing, 2 thick, a little thinner in z
    r = 7.5
    cy = 20
    pts = S.flat_ngon(cx, cy, r, 8)
    ring = np.zeros(g.shape, dtype=bool)
    for k in range(8):
        ring |= S.bar(g, "z", pts[k], pts[(k + 1) % 8], 2.4, z0 + 0.5, z1 - 0.5, "gray", 6)
    P.flat(g, ring & ((X + Y) % 4 == 0), "gray", 7)
    # climbing ivy up the shaft
    ivy = m & (Y < 14) & ((P._hash(X, Y // 2, Z, seed=12) % np.uint64(4)) == 0) & (np.abs(X + 0.5 - (cx + 2 * np.sin(Y / 3))) < 2.2)
    P.flat(g, ivy, "moss", 5)
    P.flat(g, ivy & (Y % 3 == 0), "forest", 6)
    return g, (cx, 0.0, cz)


def build():
    g = Grid(26, 16, 22)
    cx, cz = 13, 12
    plinth(g, cx - 9, cz - 6, cx + 9, cz + 6, 0, 3, "purple", 4, bevel=1, seed=1)
    plinth(g, cx - 6, cz - 4, cx + 6, cz + 4, 3, 4, "gray", 4, bevel=1, seed=2)
    X, Y, Z = idx(g)
    plate = box(g, cx - 3, 4, cz - 5, cx + 3, 6, cz - 4, "gold", 4)
    P.flat(g, plate & (X % 2 == 0) & (Y == 5), "gold", 2)
    P.flat(g, (g.a > 0) & (Y < 2) & ((P._hash(X, Z, seed=3) % np.uint64(3)) == 0), "moss", 5)
    # a purple wreath leaning on the plinth, and two candles
    wreath = S.disc(g, "z", cx + 5, 5.5, 4.5, cz - 7, cz - 5, "forest", 6)
    P.flat(g, wreath & (S.radial(g, "z", cx + 5, 5.5) < 2.2), "moss", 2)
    P.flat(g, wreath & (S.radial(g, "z", cx + 5, 5.5) >= 2.2) & (((X + Y) % 4) == 0), "magenta", 6)
    P.flat(g, wreath & (S.radial(g, "z", cx + 5, 5.5) >= 2.2) & (((X + Y) % 4) == 2), "purple", 6)
    box(g, cx + 3, 1, cz - 8, cx + 7, 3, cz - 7, "magenta", 5)  # the bow
    candle(g, cx - 8, 3, cz - 5, h=5, w=2)
    candle(g, cx - 5, 3, cz - 7, h=3, w=2)
    tufts(g, [(2, 3), (23, 18)])
    cg, pivot = cross_grid()
    root_pivot = (cx, 0.0, cz)
    lean = Part("cross", cg, pivot=pivot, at=(0.0, 7.0, 0.0), rot=(-4.0, 0.0, -6.0))
    from voxgrid import Asset

    root = Part("gravestone-cross", g, pivot=root_pivot)
    root.add(lean)
    return Asset(id="monster-props-gravestone-cross", pack="monster", category="props", name="Celtic Cross Grave", root=root)
