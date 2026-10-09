"""Ritual altar, in the Pirate Nation haunted style.

A dark stone slab on two skull-carved plinths, draped with a blood-red
runner with a gold hem, on a round flagstone dais painted with a glowing
magenta pentagram and toxic runes. A dagger, a gold goblet and a grimoire
lie on the slab; five tall candles with magenta flames stand on the star
points. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import MAGENTA, candle, idx, masonry, prop
from pnkit import box, edges
from voxgrid import C, Grid

R = 19


def segdist(px, pz, a, b):
    ax, az = a
    bx, bz = b
    dx, dz = bx - ax, bz - az
    t = np.clip(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1)
    return np.hypot(px - (ax + t * dx), pz - (az + t * dz))


def build():
    g = Grid(40, 40, 40)
    X, Y, Z = idx(g)
    cx = cz = 20
    dais = S.disc(g, "y", cx, cz, R, 0, 2, "stone", 5, n=8)
    P.stone(g, dais, "stone", 5, block=(6, 4), frame="top", seed=1)
    P.flat(g, dais & (Y == 0), "stone", 3)
    # the pentagram and a ring of runes, glowing magenta on the top
    top = dais & (Y == 1)
    pts = [(cx + math.cos(math.radians(-90 + 72 * k)) * 15, cz - math.sin(math.radians(-90 + 72 * k)) * 15) for k in range(5)]
    star = np.zeros(g.shape, dtype=bool)
    Xc, Zc = X + 0.5, Z + 0.5
    for k in range(5):
        star |= segdist(Xc, Zc, pts[k], pts[(k + 2) % 5]) < 0.7
    ring = np.abs(np.hypot(Xc - cx, Zc - cz) - 16.5) < 0.7
    P.flat(g, top & (star | ring), "magenta", 6)
    runes = top & (np.abs(np.hypot(Xc - cx, Zc - cz) - 17.8) < 0.6) & (((np.arctan2(Zc - cz, Xc - cx) * 24 / math.pi).astype(int)) % 3 == 0)
    P.flat(g, runes, "toxic", 6)
    # the plinths with carved skulls, and the slab
    for px in (cx - 9, cx + 5):
        pl = box(g, px, 2, cz - 4, px + 4, 11, cz + 4, "stone", 4)
        masonry(g, pl, "stone", 4, block=(4, 3), seed=2)
        pnglyph.stamp(g, "-z", cz - 4, px, 5, [".##.", "#o#o", "####", ".#.#"][::1], {"#": C("bone", 6), "o": C("purple", 1)})
    slab = box(g, cx - 13, 11, cz - 6, cx + 13, 15, cz + 6, "stone", 4)
    masonry(g, slab, "stone", 4, block=(7, 4), seed=3)
    P.flat(g, slab & (Y == 14) & ~edges(slab), "stone", 5)
    # the runner: over the top and down the front and the back
    run = box(g, cx - 4, 15, cz - 7, cx + 4, 16, cz + 7, "blood", 5)
    run |= box(g, cx - 4, 8, cz - 7, cx + 4, 15, cz - 6, "blood", 5) | box(g, cx - 4, 8, cz + 6, cx + 4, 15, cz + 7, "blood", 5)
    P.flat(g, run & ((X == cx - 4) | (X == cx + 3) | (Y == 8)), "gold", 5)
    # a dagger, a goblet and a grimoire on the slab
    box(g, cx - 11, 15, cz - 2, cx - 5, 16, cz - 1, "steel", 6)
    box(g, cx - 5, 15, cz - 3, cx - 4, 16, cz, "gold", 4)
    box(g, cx - 4, 15, cz - 2, cx - 2, 16, cz - 1, "blood", 4)
    S.disc(g, "y", cx + 8, cz - 2, 1.0, 15, 17, "gold", 4)
    cup = S.disc(g, "y", cx + 8, cz - 2, 2.0, 17, 20, "gold", 5)
    P.flat(g, cup & (Y == 19) & (S.radial(g, "y", cx + 8, cz - 2) < 1.2), "blood", 4)
    book = box(g, cx + 5, 15, cz + 1, cx + 12, 17, cz + 5, "purple", 4)
    P.flat(g, edges(book), "gold", 4)
    P.flat(g, book & (Y == 16) & ~edges(book) & (X == cx + 8), "gold", 5)
    # five candles on the star points
    for k, (px, pz) in enumerate(pts):
        candle(g, int(px) - 1, 2, int(pz) - 1, h=5 + (k * 3) % 4, w=2, wax="bone", flame=MAGENTA)
    return prop("ritual-altar", "Ritual Altar", g)
