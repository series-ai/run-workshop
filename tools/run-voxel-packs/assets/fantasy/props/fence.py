"""Palisade fence segment in the Pirate Nation style (two tiles, 32 long).

Chunky pointed posts (true-slope tips) of uneven height stand on a coursed
stone footing, tied by two thick dark rails with painted iron bands and
nail dots. A blue heater shield with a gold crown hangs on the middle
post, and a post leans a little (rule F5). Detail is paint (rule S1).
"""

import paint as P
from _props import heater, idx, stone_box, tufts
from pnkit import box
from pnshapes import last, rotate
from voxgrid import C, Asset, Grid, Part

L, H, D = 32, 26, 10
Z0, Z1 = 4, 8  # post depth
POSTS = [(1, 20, 0.0), (8, 22, 0.0), (14, 21, -3.0), (21, 23, 0.0), (27, 20, 2.0)]  # x0, height, lean


def build() -> Asset:
    g = Grid(L, H, D)
    foot = stone_box(g, 0, 0, Z0 - 2, L, 3, Z1 + 1, "stone", 5, block=(6, 3), seed=1)
    P.grime(g, foot, height=1, seed=2)
    for k, (x0, h, lean) in enumerate(POSTS):
        w = 4
        cx = x0 + w / 2
        pts = [(x0, 3), (x0 + w, 3), (x0 + w, h - 3), (cx, h), (x0, h - 3)]
        pts = rotate(pts, cx, 3, lean)
        g.prism("z", pts, Z0, Z1, C("wood", 5))
        m = last(g)
        P.planks(g, m, "wood", 5 + (k % 2), width=2, across="x", nails=False, seed=10 + k)
        X, Y, Z = idx(g)
        P.flat(g, m & (Y >= h - 4), "wood", 6)  # sun on the sharpened tips
    X, Y, Z = idx(g)
    for ry in (7, 14):
        rail = box(g, 0, ry, Z0 - 2, L, ry + 3, Z0, "darkwood", 4)
        P.planks(g, rail, "darkwood", 4, width=3, across="y", nails=True, seed=ry)
        for x0, _h, _l in POSTS:
            P.flat(g, rail & (X >= x0 + 1) & (X < x0 + 3), "stone", 3)  # iron band over each post
            P.flat(g, rail & (X == x0 + 2) & (Y == ry + 1), "gold", 6)
    heater(g, 16, 4, Z0 - 4, 12, 13, t=2, field=("blue", 4), rim=("gold", 5), lean=-4.0, charge="crown", ink=("gold", 6))
    tufts(g, [(4, 0), (24, 0)])
    root = Part("fence", g)
    return Asset(id="fantasy-props-fence", pack="fantasy", category="props", name="Palisade Fence", root=root)
