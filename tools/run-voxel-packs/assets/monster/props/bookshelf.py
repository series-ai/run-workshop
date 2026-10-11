"""Haunted bookshelf, in the Pirate Nation haunted style.

A tall planked case with thick sides and a steep pointed crest (true
slopes) carrying a bat. Four shelves of chunky books in bright spines
(runs of books, a few leaning at an angle, rule F5), a skull, glowing
potion bottles and a stack of books, and painted cobwebs in the corners. A person
reaches the fourth shelf. Faces -Z.
"""
import random

import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import big_skull, candle, idx, planked, prop
from pnkit import box, edges
from voxgrid import C, Grid

W, H, D = 32, 42, 12
SHELVES = (3, 13, 23, 33)  # shelf tops (books stand on them)
SPINES = (("purple", 5), ("blood", 5), ("teal", 5), ("gold", 4), ("navy", 6), ("forest", 6), ("rust", 5), ("magenta", 5))


def books(g: Grid, x0: int, x1: int, y: int, rng: random.Random, zf: int = 3, zb: int = 10, skip=()) -> None:
    """Runs of upright books from x0 to x1 standing on y, spines to the front."""
    x = x0
    while x < x1 - 1:
        if any(a <= x < b for a, b in skip):
            x += 1
            continue
        w = rng.choice((2, 2, 3))
        h = rng.choice((6, 7, 7, 8))
        ramp, sh = rng.choice(SPINES)
        if x + w > x1:
            break
        b = box(g, x, y, zf, x + w, y + h, zb, ramp, sh)
        X, Y, Z = idx(g)
        P.flat(g, b & (Z == zf) & ((Y == y + 1) | (Y == y + h - 2)), "gold", 5)
        P.flat(g, b & (X == x + w - 1) & (Z == zf), ramp, max(1, sh - 2))
        x += w


def build():
    g = Grid(W, 52, D + 2)
    X, Y, Z = idx(g)
    rng = random.Random(7)
    # the case: sides, back, shelves, a plinth
    case = box(g, 0, 0, 1, 3, H, D + 1, "wood", 5) | box(g, W - 3, 0, 1, W, H, D + 1, "wood", 5)
    case |= box(g, 3, 0, D - 1, W - 3, H, D + 1, "wood", 4)
    for sy in SHELVES:
        case |= box(g, 3, sy - 2, 1, W - 3, sy, D - 1, "wood", 5)
    case |= box(g, 0, H - 2, 0, W, H, D + 2, "wood", 5)
    planked(g, case, "wood", 5, width=3, across="x", nails=False, seed=1)
    P.flat(g, case & (Z == 1) & ((X < 3) | (X >= W - 3)), "wood", 6)
    P.flat(g, case & (Z == D - 1) & (X >= 3) & (X < W - 3), "wood", 3)
    # the pointed crest (true slopes) with a bat
    g.prism("z", [(0, H), (W, H), (W / 2, H + 7.5)], 2, 6, C("wood", 5))
    crest = S.last(g)
    P.planks(g, crest, "wood", 5, width=3, across="y", nails=False, frame="z")
    P.outline(g, crest, "wood", 3, normal="z")
    pnglyph.icon(g, "-z", 2, int(W / 2 - 6.5), H, "bat", "purple", 5, inks={"+": ("toxic", 7)})
    # books on the shelves; a skull, potions and a candle make gaps
    books(g, 3, W - 3, SHELVES[0], rng, skip=((18, 26),))
    books(g, 3, W - 3, SHELVES[1], rng, skip=((4, 11),))
    books(g, 3, W - 3, SHELVES[2], rng, skip=((20, 29),))
    books(g, 3, W - 3, SHELVES[3], rng, skip=((10, 15),))
    big_skull(g, 22, SHELVES[0], 6, s=7, base=6, eyes=("toxic", 6))
    for px, ramp in ((5.5, "toxic"), (9, "magenta")):
        S.disc(g, "y", px, 6, 1.8, SHELVES[1], SHELVES[1] + 4, ramp, 6)
        S.disc(g, "y", px, 6, 0.9, SHELVES[1] + 4, SHELVES[1] + 6, ramp, 5)
    # two leaning books (true slopes) and a lying stack
    for lx, lean, ramp in ((21, -18, ("blood", 5)), (24.5, -12, ("teal", 5))):
        pts = S.rotate([(lx, SHELVES[2]), (lx + 2.5, SHELVES[2]), (lx + 2.5, SHELVES[2] + 7.5), (lx, SHELVES[2] + 7.5)], lx + 2.5, SHELVES[2], lean)
        pts = [(u, max(float(SHELVES[2]), v)) for u, v in pts]
        g.prism("z", pts, 3, 10, C(*ramp))
    box(g, 11, SHELVES[3], 3, 15, SHELVES[3] + 2, 10, "purple", 5)
    box(g, 11.5, SHELVES[3] + 2, 3.5, 14.5, SHELVES[3] + 4, 9.5, "gold", 4)
    # painted cobwebs in the top corners of the case front
    for cxw, sgn in ((3, 1), (W - 3, -1)):
        web = (Z == 1) & (g.a > 0) & (Y >= H - 8) & (Y < H - 2) & (np.abs(X - cxw) < 7)
        d = np.abs(X + 0.5 - cxw) + np.abs(Y + 0.5 - (H - 2))
        P.flat(g, web & ((np.abs(X + 0.5 - cxw) - np.abs(Y + 0.5 - (H - 2)) == 0) | (np.abs(d - 5) < 0.6)), "bone", 7)
    return prop("bookshelf", "Haunted Bookshelf", g)
