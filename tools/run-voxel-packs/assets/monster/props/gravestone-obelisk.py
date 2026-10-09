"""Family obelisk, in the Pirate Nation haunted style.

After PN decorations-decoration-1x1-headstone-c (the tall spire stone): a
stepped stone plinth, a die block with a painted skull plaque and a purple
drape on two sides, and a tall tapered needle (a true frustum) with a
purple slate pyramid cap and a gold finial. A low iron railing with gold
spear tips rings the plot, open at the front, where flowers and two
candles with toxic-green flames stand. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import TOXIC, candle, flowers, idx, last, masonry, plinth, prop, tufts
from pnkit import box
from voxgrid import C, Grid

H = 40


def build():
    g = Grid(26, H + 2, 26)
    cx = cz = 13
    X, Y, Z = idx(g)
    plinth(g, cx - 8, cz - 8, cx + 8, cz + 8, 0, 3, "stone", 4, bevel=1, seed=1)
    plinth(g, cx - 6, cz - 6, cx + 6, cz + 6, 3, 3, "gray", 4, bevel=1, seed=2)
    die = box(g, cx - 5, 6, cz - 5, cx + 5, 15, cz + 5, "gray", 5)
    masonry(g, die, "gray", 5, block=(5, 3), seed=3)
    cap = box(g, cx - 6, 15, cz - 6, cx + 6, 17, cz + 6, "gray", 6)
    masonry(g, cap, "gray", 6, block=(6, 2), seed=4)
    # the skull plaque on the front, a purple drape on the side
    plaque = box(g, cx - 4, 7, cz - 6, cx + 4, 14, cz - 5, "purple", 3)
    P.flat(g, plaque & ((X == cx - 4) | (X == cx + 3) | (Y == 7) | (Y == 13)), "gold", 4)
    sk = [".###.", "#####", "#o#o#", "##o##", ".#.#."]
    pnglyph.stamp(g, "-z", cz - 6, cx - 2, 8, sk, {"#": C("bone", 7), "o": C("toxic", 5)})
    drape = box(g, cx + 5, 9, cz - 3, cx + 6, 16, cz + 3, "purple", 5)
    drape |= box(g, cx - 1, 16, cz - 3, cx + 6, 17, cz + 3, "purple", 5)
    P.mottle(g, drape, "purple", 5, cell=2, seed=5)
    P.flat(g, drape & (Y == 9), "gold", 5)
    # the needle: a tapered frustum and a pyramid cap
    s0, s1 = 4.0, 2.6
    g.prism("y", [(cx - s0, cz - s0), (cx + s0, cz - s0), (cx + s0, cz + s0), (cx - s0, cz + s0)], 17, 35, C("gray", 5), top=[(cx - s1, cz - s1), (cx + s1, cz - s1), (cx + s1, cz + s1), (cx - s1, cz + s1)])
    needle = last(g)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(4, 5), frame=fr, seed=6))
    P.flat(g, needle & S.seams(g, [g.solids[-1]], 0.8), "gray", 6)
    g.prism("y", [(cx - s1 - 0.5, cz - s1 - 0.5), (cx + s1 + 0.5, cz - s1 - 0.5), (cx + s1 + 0.5, cz + s1 + 0.5), (cx - s1 - 0.5, cz + s1 + 0.5)], 35, 39, C("gray", 6), top=[(cx, cz)] * 4)
    S.paint_facets(g, [g.solids[-1]], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 5, row=2, width=3, frame=fr))
    box(g, cx - 0.5, 39, cz - 0.5, cx + 0.5, 40, cz + 0.5, "gold", 5)
    # painted names on the needle front (dark lines)
    P.flat(g, needle & (Z < cz - 2) & (np.abs(X + 0.5 - cx) < 1.6) & (Y > 20) & (Y < 30) & (Y % 2 == 0), "gray", 3)
    # the railing: iron posts with gold spear tips and two rails, open at the front
    rail = np.zeros(g.shape, dtype=bool)
    posts = [(1, 1), (23, 1), (1, 23), (23, 23), (1, 12), (23, 12), (12, 23)]
    for px, pz in posts:
        rail |= box(g, px, 0, pz, px + 2, 9, pz + 2, "iron", 5)
        g.prism("y", [(px, pz), (px + 2, pz), (px + 2, pz + 2), (px, pz + 2)], 9, 12, C("gold", 5), top=[(px + 1, pz + 1)] * 4)
    for y in (3, 7):
        rail |= box(g, 1, y, 1, 3, y + 1, 25, "iron", 6) | box(g, 23, y, 1, 25, y + 1, 25, "iron", 6) | box(g, 1, y, 23, 25, y + 1, 25, "iron", 6)
        rail |= box(g, 1, y, 1, 7, y + 1, 3, "iron", 6) | box(g, 19, y, 1, 25, y + 1, 3, "iron", 6)
    P.flat(g, rail & (Y == 0), "iron", 4)
    # a purple drape over the die cap on the other side too, and flowers at the front
    d2 = box(g, cx - 6, 9, cz - 3, cx - 5, 16, cz + 3, "purple", 5) | box(g, cx - 6, 16, cz - 3, cx, 17, cz + 3, "purple", 5)
    P.mottle(g, d2, "purple", 5, cell=2, seed=7)
    P.flat(g, d2 & (Y == 9), "gold", 5)
    flowers(g, [(cx - 3, cz - 8), (cx + 2, cz - 8), (cx - 1, cz - 9)], 3)
    candle(g, cx - 6, 6, cz - 6, h=4, w=2, flame=TOXIC)
    candle(g, cx + 4, 6, cz - 6, h=6, w=2, flame=TOXIC)
    P.flat(g, plaque & ((X == cx - 4) | (X == cx + 3) | (Y == 7) | (Y == 13)), "magenta", 5)
    from pnpaint import blotch

    blotch(g, (g.a > 0) & (Y < 6) & ~rail, "moss", 5, cell=2, chance=0.12, seed=8)
    tufts(g, [(4, 5), (20, 20), (5, 18)])
    return prop("gravestone-obelisk", "Family Obelisk", g)
