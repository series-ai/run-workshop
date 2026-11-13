"""Vampire throne, in the Pirate Nation haunted style.

A tall throne on a two-step purple slate dais with a red rug. A thick
dark frame with a crimson velvet back (painted gold studs and a gold bat)
rises to a pointed gothic top (true slopes), crowned by spread bat wings.
Chunky armrests end in skulls with glowing eyes. The seat is 11 above the
dais, sized for a person. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import big_skull, idx, masonry, planked, prop
from pnkit import box, edges
from voxgrid import C, Grid

FR = ("purple", 3)  # the frame: dark violet lacquer


def build():
    g = Grid(34, 50, 28)
    X, Y, Z = idx(g)
    cx = 17
    # the dais and the rug
    d1 = box(g, 1, 0, 1, 33, 2, 27, "purple", 4)
    d2 = box(g, 4, 2, 5, 30, 4, 27, "purple", 5)
    masonry(g, d1 | d2, "purple", 4, block=(6, 3), seed=1)
    rug = box(g, cx - 5, 2, 1, cx + 5, 2.5, 5, "red", 3) | box(g, cx - 5, 4, 5, cx + 5, 4.5, 12, "red", 3)
    rug = (g.a == C("red", 3))
    P.flat(g, rug & ((X == cx - 5) | (X == cx + 4)), "gold", 5)
    # the seat block and the velvet cushion
    y0 = 4
    base = box(g, cx - 9, y0, 10, cx + 9, y0 + 8, 24, *FR)
    P.flat(g, edges(base), "purple", 5)
    cush = box(g, cx - 8, y0 + 8, 10, cx + 8, y0 + 11, 22, "red", 3)
    P.flat(g, edges(cush), "red", 2)
    P.flat(g, cush & (Y == y0 + 10) & ((X + Z) % 4 == 0), "red", 5)
    # the back: a frame with a velvet panel and a pointed top
    back = box(g, cx - 9, y0 + 8, 21, cx + 9, y0 + 34, 25, *FR)
    g.prism("z", [(cx - 9, y0 + 34), (cx + 9, y0 + 34), (cx, y0 + 43)], 21, 25, C(*FR))
    apex = S.last(g)
    P.flat(g, apex & (Z == 21), "purple", 4)
    velvet = back & (Z == 21) & (np.abs(X + 0.5 - cx) < 6.5) & (Y >= y0 + 12) & (Y < y0 + 32)
    P.flat(g, velvet, "red", 4)
    P.flat(g, velvet & ((np.abs(X + 0.5 - cx) > 5.5) | (Y == y0 + 12) | (Y == y0 + 31)), "gold", 5)
    P.flat(g, velvet & ((X + Y) % 4 == 0) & ((X - Y) % 4 == 0), "red", 6)
    pnglyph.icon(g, "-z", 21, int(cx - 6.5), y0 + 24, "bat", "gold", 5)
    # the back of the throne: dark boards, a gold frame and a red bat
    rear = (back | apex) & (Z == 24)
    P.planks(g, rear, *FR, width=3, across="x", nails=False, frame="z")
    P.outline(g, rear, "gold", 4, normal="z")
    pnglyph.icon(g, "+z", 25, int(cx - 6.5), y0 + 24, "bat", "red", 4)
    # bat wings on top (true slopes), with painted ribs
    for s in (-1, 1):
        pts = [(cx + s * 3, y0 + 38), (cx + s * 16, y0 + 44), (cx + s * 13, y0 + 40), (cx + s * 15, y0 + 37), (cx + s * 11, y0 + 36), (cx + s * 12, y0 + 33), (cx + s * 8, y0 + 34)]
        g.prism("z", pts, 22, 24, C("purple", 4))
        wm = S.last(g)
        P.flat(g, wm & S.seams(g, [g.solids[-1]], 0.8), "purple", 2)
    # armrests with skulls at their ends
    for s in (-1, 1):
        ax0 = cx + s * 9 - (3 if s > 0 else 0)
        arm = box(g, cx + (9 if s > 0 else -12), y0 + 8, 11, cx + (12 if s > 0 else -9), y0 + 16, 24, *FR)
        P.flat(g, edges(arm), "purple", 5)
        big_skull(g, cx + s * 10.5, y0 + 13, 10, s=5, base=6, eyes=("magenta", 6))
    return prop("vampire-throne", "Vampire Throne", g)
