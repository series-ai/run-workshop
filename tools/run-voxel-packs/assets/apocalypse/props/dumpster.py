"""Overflowing dumpster, in the Pirate Nation style.

One chunky icon (rule K3): a teal steel bin with the classic slanted front
(a true-slope prism), steel lifting pockets, a gold graffiti tag and
castors. One lid is flung open against the back (rule F5); fat trash
bags (faceted sacks with a knot) and a chewed box spill out over the rim and onto the
ground. Plates, rust, seams and the tag are paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, child, root
from pnkit import box, edges
from pnshapes import coords, disc, dome
from voxgrid import C, Grid

L, H = 30, 17  # bin length (x) and height
ZF0, ZF1, ZB = 3, 1, 19  # front foot z, front top z, back z
PROFILE = [(2, ZF0), (2, ZB), (H + 2, ZB), (H + 2, ZF1)]  # (y, z): bottom at y = 2 (castors)


def lid(open_: bool) -> Grid:
    g = Grid(L // 2, 2, ZB - ZF1 + 1)
    m = box(g, 0, 0, 0, L // 2, 2, ZB - ZF1 + 1, "teal", 4)
    P.flat(g, m & (np.floor(coords(g)[2]) % 4 == 0), "teal", 3)  # ribs
    P.flat(g, edges(m), "teal", 3)
    return g


def build():
    g = Grid(L + 10, H + 14, ZB + 12)
    X, Y, Z = coords(g)
    ox = 4
    # castors
    for cx in (ox + 3, ox + L - 3):
        for cz in (ZF0 + 3, ZB - 3):
            disc(g, "z", cx, 1.2, 1.2, cz - 1, cz + 1, "steel", 4)
    g.prism("x", PROFILE, ox, ox + L, C("teal", 5))
    bin_ = g.solids[-1].mask(g.shape)
    P.plates(g, bin_, "teal", 5, size=(10, 6), rivets=False, seed=1)
    P.flat(g, bin_ & ((X < ox + 1) | (X > ox + L - 1) | (Y > H + 1)), "teal", 3)
    P.flat(g, bin_ & (Y < 3), "teal", 3)
    for rx, ry, rr in ((ox + 6, 6, 2.5), (ox + 24, 12, 2.0)):  # rust blooms
        P.flat(g, bin_ & (np.hypot(X - rx, Y - ry) < rr) & (Z < 8), "rust", 5)
    # a gold graffiti tag on the slanted front
    tag = bin_ & (Z < ZF0 + 2 - (Y - 2) * 0.12) & (np.abs((Y - 10) - 2.2 * np.sin((X - ox) * 0.55)) < 1.0) & (X > ox + 9) & (X < ox + 22)
    P.flat(g, tag, "gold", 6)
    # lifting pockets on both ends
    for px in (ox - 2, ox + L):
        pk = box(g, px, 9, ZF0 + 2, px + 2, 12, ZB - 2, "steel", 5)
        P.flat(g, edges(pk), "steel", 3)
    # trash bags heaped in the open half and spilled on the ground
    top = H + 2
    for (cx, cz, y0, ln, wd, ht, ang, ramp, sh) in (
        (ox + 20, 8, top - 1, 10, 10, 7, 20, "steel", 5),
        (ox + 26, 14, top - 1, 9, 9, 6, -30, "khaki", 5),
        (ox + 18, 15, top - 1, 9, 9, 6, 70, "gold", 5),
        (ox + 23, 11, top + 4, 8, 8, 6, 10, "red", 4),
        (ox + 30, 6, 0, 9, 9, 6, 35, "steel", 5),
        (ox + 4, 24.5, 0, 10, 10, 7, -15, "khaki", 5),
    ):
        r_ = min(ln, wd) / 2 + 0.5
        b = dome(g, cx, cz, y0, r_, h=ht, n=8, rings=2, ramp=ramp, base=sh, painter=lambda gg, mm, fr, rp=ramp, s=sh: P.mottle(gg, mm, rp, s, cell=3, seed=5), ribs=None)
        P.flat(g, b & (Y > y0 + ht - 1.5), ramp, sh + 1)
        knot = box(g, cx - 1, y0 + ht - 0.5, cz - 1, cx + 1, y0 + ht + 1.5, cz + 1, ramp, sh - 1)
    # the rat-chewed box on the closed lid
    bx = box(g, ox + 5, top + 2, 7, ox + 12, top + 7, 13, "sand", 6)
    P.flat(g, edges(bx), "sand", 4)
    P.flat(g, bx & (Y > top + 6) & (X > ox + 10), "sand", 3)
    r = root("dumpster", g)
    # the closed lid on the left half, and the right lid flung back on its hinge
    child(r, "lid-closed", lid(False), pivot=(0.0, 0.0, 0.0), at_grid=(ox, top, ZF1 - 0.5))
    child(r, "lid-open", lid(True), pivot=(0.0, 0.0, ZB - ZF1 + 1.0), at_grid=(ox + L / 2, top, ZB + 0.5), rot=(118.0, 0.0, 0.0))
    return asset("dumpster", "Overflowing Dumpster", r)
