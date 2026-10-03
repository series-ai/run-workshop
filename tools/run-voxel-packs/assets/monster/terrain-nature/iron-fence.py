"""Graveyard iron fence segment, in the Pirate Nation haunted style.

After PN deco-1x1x1-fencehaunted: two PN tiles long (exactly 32, so
segments line up on the grid). Two thick stone pillars with light stone
caps and purple slate pyramid tops (true slopes), a tiny painted bone
skull on each pillar front, a low stone kerb, two riveted iron rails and
four chunky iron bars 2 thick with diamond spear tips (true-slope
prisms). One bar leans a little (rule F5). Moss at the foot. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
import pnshapes
from _kit import single
from _life import coords, quad, stamp
from pnkit import box
from voxgrid import C, Grid

L, H, D = 32, 26, 8
IRON = "teal"  # verdigris iron, like the PN haunted fence
BARS = [9, 13, 17, 21]  # bar x0 (2 wide), 2-voxel gaps between everything
SKULL = [
    ".###.",
    "#####",
    "#o#o#",
    "#####",
    ".#.#.",
]


def build():
    g = Grid(L, H, D)
    X, Y, Z = coords(g)
    # the kerb between the pillars
    kerb = box(g, 7, 0, 2, 25, 3, 6, "stone", 5)
    P.stone(g, kerb, "stone", 5, block=(6, 3), seed=1)
    P.flat(g, kerb & (Y == 2), "stone", 6)
    # the two pillars: stone shafts, light caps, slate pyramid tops
    for k, (x0, x1) in enumerate(((1, 7), (25, 31))):
        shaft = box(g, x0, 0, 1, x1, 17, 7, "stone", 6)
        P.stone(g, shaft, "stone", 6, block=(4, 3), seed=2 + k)
        P.flat(g, shaft & (Y < 2), "stone", 5)
        cap = box(g, x0 - 1, 17, 0, x1 + 1, 19, 8, "gray", 6)
        P.flat(g, cap & (Y == 18), "gray", 7)
        P.outline(g, cap, "gray", 5)
        pnshapes.pyramid(g, x0 - 0.5, 0.5, x1 + 0.5, 7.5, 19, 5, "purple", 5, tiles=True, seed=4 + k)
        legend = {"#": C("bone", 6), "o": C("toxic", 6)}
        stamp(g, "-z", 1, x0, 10, SKULL, legend, depth=2)
    # two riveted iron rails
    for y0 in (5, 12):
        rail = box(g, 7, y0, 2, 25, y0 + 2, 6, IRON, 3)
        P.flat(g, rail & (Y == y0 + 1), IRON, 4)
        P.flat(g, rail & (Z == 2) & ((X - 7) % 4 == 1) & (Y == y0), IRON, 6)
    # the bars and their diamond spear tips; the third bar leans a little
    for k, x0 in enumerate(BARS):
        bx = x0 + 1.0
        if k == 2:
            top = bx + 1.0
            g.prism("z", quad((bx, 3.0), (top, 16.0), 1.0), 3, 5, C(IRON, 3))
            bar = g.solids[-1].mask(g.shape)
        else:
            top = bx
            bar = box(g, x0, 3, 3, x0 + 2, 16, 5, IRON, 3)
        P.flat(g, bar & ((X + 0.5) < (bx - 0.2 + (Y - 3) * (top - bx) / 13)), IRON, 4)  # lit left edge
        g.prism("z", [(top - 2.2, 17.0), (top, 14.5), (top + 2.2, 17.0), (top, 22.0)], 3, 5, C(IRON, 4))
        tip = g.solids[-1]
        P.flat(g, tip.mask(g.shape) & (Y >= 19), IRON, 5)
    # moss at the foot of the kerb and pillars
    foot = (g.a > 0) & (Y < 2) & ((P._hash(X // 2, Z, seed=9) % np.uint64(3)) == 0)
    P.flat(g, foot, "moss", 5)
    pnpaint.blotch(g, (g.a > 0) & (Y == 2) & (X > 6) & (X < 25), "moss", 6, cell=2, chance=0.12, seed=10)
    return single("iron-fence", "terrain-nature", "Graveyard Iron Fence", g)
