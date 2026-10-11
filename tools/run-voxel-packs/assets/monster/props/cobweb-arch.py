"""Cobweb arch, in the Pirate Nation haunted style.

A crumbling garden ruin: two thick stone piers under a pointed arch of
true diagonal voussoirs, the right pier broken lower (rule F5). A big
cobweb fills the opening (thin radial threads and rings), a chunky purple
spider with glowing toxic eyes sits in it, a glowing toxic egg sack hangs from the arch
and moss drapes from the stones. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _props import idx, masonry, prop, tufts, union
from pnkit import box
from voxgrid import C, Grid

T0, T1 = 2, 8  # arch depth (z)


def build():
    g = Grid(40, 42, 10)
    X, Y, Z = idx(g)
    lp = box(g, 1, 0, T0 - 1, 8, 25, T1 + 1, "gray", 4)
    rp = box(g, 32, 0, T0 - 1, 39, 20, T1 + 1, "gray", 4)
    masonry(g, lp | rp, "gray", 4, block=(5, 4), seed=1)
    for x0, top in ((0, 3), (31, 3)):
        masonry(g, box(g, x0, 0, T0 - 2, x0 + 9, top, T1 + 2, "stone", 4), "stone", 4, block=(6, 3), seed=2)
    # capitals, the pointed arch (voussoir bars with true slopes), the keystone
    masonry(g, box(g, 0, 25, T0 - 1.5, 9, 27, T1 + 1.5, "purple", 5), "purple", 5, block=(4, 2), seed=3)
    masonry(g, box(g, 31, 20, T0 - 1.5, 40, 22, T1 + 1.5, "purple", 5), "purple", 5, block=(4, 2), seed=8)
    start = len(g.solids)
    S.bar(g, "z", (4.5, 26), (13, 34.5), 5.2, T0, T1, "gray", 5)
    S.bar(g, "z", (12, 33.5), (20, 37), 5.2, T0, T1, "gray", 5)
    S.bar(g, "z", (20, 37), (27, 34), 5.2, T0, T1, "gray", 5)
    S.bar(g, "z", (27, 34), (33, 25), 5.2, T0, T1, "gray", 5)
    arch = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "gray", 5, block=(4, 5), frame=fr, seed=4))
    # the broken right side: the last voussoir hangs short of the lower pier
    kst = box(g, 18, 35, T0 - 0.5, 23, 40, T1 + 0.5, "gray", 6)
    P.flat(g, kst & (Y == 39), "gray", 7)
    import pnglyph

    pnglyph.stamp(g, "-z", T0 - 0.5, 19, 35, [".###.", "#o#o#", ".###."], {"#": C("toxic", 6), "o": C("purple", 1)})
    rubble = box(g, 33, 20, T0, 36, 22, T0 + 3, "gray", 5) | box(g, 35, 0, 0, 38, 2, 2, "gray", 4)
    # the web: radial threads and rings in the opening, 1 voxel thick
    wc = (20.5, 20.5)
    web_z = (4.5, 5.5)
    for k in range(8):
        a = math.radians(90 + 45 * k)
        L = 17 if math.sin(a) < 0.5 else 13
        p1 = (wc[0] + math.cos(a) * L, wc[1] + math.sin(a) * L)
        S.bar(g, "z", wc, p1, 1.1, *web_z, "bone", 7)
    for rr in (4.5, 8.5, 12.5):
        pts = [(wc[0] + math.cos(math.radians(90 + 45 * k)) * rr, wc[1] + math.sin(math.radians(90 + 45 * k)) * rr) for k in range(8)]
        for k in range(8):
            S.bar(g, "z", pts[k], pts[(k + 1) % 8], 1.1, *web_z, "bone", 6)
    # the spider: a round abdomen, a head, eight bent legs (true diagonals)
    sx, sy = 21.0, 23.0
    S.disc(g, "z", sx, sy + 3, 3.5, 3, 7, "purple", 5)
    S.disc(g, "z", sx, sy - 1.5, 2.2, 2.5, 7.5, "purple", 4)
    P.flat(g, (Z == 2) & (Y == int(sy - 1)) & ((X == int(sx) - 1) | (X == int(sx) + 1)) & (g.a > 0), "toxic", 7)
    hour = (g.a == C("purple", 5)) & (Z == 3) & (np.abs(X + 0.5 - sx) < 1.6) & (np.abs(Y + 0.5 - sy - 3) < 2.1)
    P.flat(g, hour, "magenta", 6)
    for s in (-1, 1):
        for k, (ya, yb) in enumerate(((1.5, 4), (0, 1), (-1.5, -2), (-3, -5))):
            knee = (sx + s * 5, sy + ya + 1.5)
            foot = (sx + s * 7.5, sy + yb - 1)
            S.bar(g, "z", (sx + s * 1.5, sy + ya * 0.5), knee, 1.2, 4, 6, "purple", 4)
            S.bar(g, "z", knee, foot, 1.1, 4, 6, "purple", 5)
    # the egg sack on a thread, and moss drapes
    box(g, 28.5, 25, 5, 29.5, 33, 6, "bone", 7)
    egg = S.disc(g, "z", 29, 23, 2.2, 3.5, 7.5, "toxic", 6)
    P.flat(g, egg & (Y == 23), "toxic", 7)
    for dx, h in ((10, 5), (13, 3), (26, 4), (30, 6), (2, 4)):
        top = 33 if 8 < dx < 32 else 25
        box(g, dx, top - h, T0 - 1.5, dx + 2, top, T0 - 0.5, "moss", 5 + dx % 2)
    from pnpaint import blotch

    blotch(g, (g.a == C("gray", 4)) | (g.a == C("gray", 5)) | (g.a == C("stone", 4)), "moss", 5, cell=2, chance=0.035, seed=5)
    # glowing toxic toadstools at the pier feet
    for mx, mz, mh, mr in ((10.5, 3.5, 4, 2.4), (13, 7, 3, 1.8), (29.5, 4, 5, 2.8)):
        box(g, mx - 0.5, 0, mz - 0.5, mx + 0.5, mh, mz + 0.5, "bone", 6)
        cap = S.cone(g, "y", mx, mz, mr, mh, mh + 2, "toxic", 5, n=8, r_top=mr * 0.4)
        P.flat(g, cap & (Y == mh) , "toxic", 3)
    tufts(g, [(10, 1), (28, 8), (37, 4)])
    return prop("cobweb-arch", "Cobweb Arch", g)
