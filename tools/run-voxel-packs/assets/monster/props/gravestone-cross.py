"""Celtic cross grave, in the Pirate Nation haunted style.

A thick stone cross with a stone ring round its crossing (eight true
diagonal bars), leaning a little from frost heave (rule F5). It stands on
a two-step plinth (purple slate under grey stone) with a painted name
plate. Engraved lines, moss patches and a glowing magenta gem at the
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
    X, Y, Z = idx(g)
    # Build one stepped octagonal ring. Each row joins at its corners, and the
    # cross covers the center of the opening.
    cy = 20
    ring = np.zeros(g.shape, dtype=bool)
    dx = np.abs(X + 0.5 - cx)
    dy = np.abs(Y + 0.5 - cy)
    oct_radius = np.maximum(np.maximum(dx, dy), (dx + dy) * 0.7071)
    annulus = (oct_radius <= 8.5) & (oct_radius >= 5.1)
    for y in range(g.shape[1]):
        row = np.flatnonzero(annulus[:, y, 0])
        if not len(row):
            continue
        cuts = np.flatnonzero(np.diff(row) > 1) + 1
        for span in np.split(row, cuts):
            ring |= box(g, int(span[0]), y, z0, int(span[-1]) + 1, y + 1, z1, "gray", 5)
    masonry(g, ring, "gray", 5, block=(5, 4), seed=11)
    shaft = box(g, cx - 3, 0, z0, cx + 3, 30, z1, "gray", 5)
    arms = box(g, cx - 11, 17, z0, cx + 11, 23, z1, "gray", 5)
    m = shaft | arms
    masonry(g, m, "gray", 5, block=(6, 5), seed=12)
    # an engraved line down the shaft and along the arms, front and back
    face = m & ~edges(m) & ((Z == int(z0)) | (Z == int(z1) - 1))
    P.flat(g, face & (((np.abs(X + 0.5 - cx) < 0.6) & (Y > 2) & (Y < 28)) | ((Y == 20) & (np.abs(X + 0.5 - cx) < 10))), "gray", 3)
    # a glowing magenta gem at the crossing, both sides
    gem = box(g, cx - 2, 18, z0 - 1, cx + 2, 22, z1 + 1, "magenta", 5)
    P.flat(g, gem & (np.abs(X + 0.5 - cx) < 1.1) & (np.abs(Y + 0.5 - 20) < 1.1), "magenta", 7)
    P.flat(g, edges(gem), "gold", 4)
    # Moss forms a few readable patches at the shaft joints and base.
    front = Z == int(z0)
    moss = m & front & (
        ((Y >= 3) & (Y <= 7) & (X >= cx + 1) & (X <= cx + 3))
        | ((Y >= 10) & (Y <= 13) & (X >= cx - 3) & (X <= cx - 1))
        | ((Y >= 15) & (Y <= 16) & (X >= cx + 2) & (X <= cx + 3))
    )
    P.flat(g, moss, "moss", 5)
    P.flat(g, moss & (((X + Y) % 3) != 0), "forest", 6)
    return g, (cx, 0.0, cz)


def build():
    g = Grid(26, 16, 22)
    cx, cz = 13, 12
    plinth(g, cx - 9, cz - 6, cx + 9, cz + 6, 0, 3, "purple", 4, bevel=1, seed=1)
    plinth(g, cx - 6, cz - 4, cx + 6, cz + 4, 3, 4, "gray", 4, bevel=1, seed=2)
    X, Y, Z = idx(g)
    plate = box(g, cx - 3, 4, cz - 5, cx + 3, 6, cz - 4, "gold", 4)
    P.flat(g, plate & (X % 2 == 0) & (Y == 5), "gold", 2)
    # Moss stays in small groups on the plinth edge.
    base_moss = (g.a > 0) & (Y == 1) & (
        ((X >= cx - 7) & (X <= cx - 4) & (Z >= cz - 5) & (Z <= cz - 3))
        | ((X >= cx + 6) & (X <= cx + 8) & (Z >= cz + 2) & (Z <= cz + 4))
    )
    P.flat(g, base_moss, "moss", 5)
    # A leafy wreath leans on the plinth, with a few clear berry accents.
    wreath = S.disc(g, "z", cx + 5, 5.5, 4.5, cz - 7, cz - 5, "forest", 6)
    radius = S.radial(g, "z", cx + 5, 5.5)
    foliage = wreath & (radius >= 2.1) & (Z == cz - 7)
    P.flat(g, foliage, "forest", 5)
    P.flat(g, wreath & (radius < 2.1) & (Z == cz - 7), "purple", 2)
    P.flat(g, foliage & (radius >= 3.7), "purple", 2)
    P.flat(g, foliage & (X >= cx + 6) & (X <= cx + 7) & (Y >= 4) & (Y <= 6), "moss", 6)
    P.flat(g, foliage & (X >= cx + 2) & (X <= cx + 3) & (Y >= 5) & (Y <= 7), "moss", 6)
    P.flat(g, foliage & (X >= cx + 5) & (X <= cx + 6) & (Y >= 8) & (Y <= 9), "moss", 6)
    berry = wreath & (Z == cz - 7) & (X == cx + 2) & (Y == 7)
    P.flat(g, berry, "magenta", 5)
    flower = wreath & (Z == cz - 7) & (X == cx + 3) & (Y == 7)
    P.flat(g, flower, "bone", 7)
    P.flat(g, wreath & (radius >= 2.1) & (Z == cz - 6) & ((X == cx + 2) | (X == cx + 8)), "moss", 6)
    candle(g, cx - 8, 3, cz - 5, h=5, w=2)
    candle(g, cx - 5, 3, cz - 7, h=3, w=2)
    tufts(g, [(8, 9), (17, 14)], y0=4)
    cg, pivot = cross_grid()
    root_pivot = (cx, 0.0, cz)
    lean = Part("cross", cg, pivot=pivot, at=(0.0, 7.0, 0.0), rot=(-4.0, 0.0, -6.0))
    from voxgrid import Asset

    root = Part("gravestone-cross", g, pivot=root_pivot)
    root.add(lean)
    return Asset(id="monster-props-gravestone-cross", pack="monster", category="props", name="Celtic Cross Grave", root=root)
