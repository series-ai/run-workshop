"""Knight sarcophagus, in the Pirate Nation haunted style.

Coffin scale (PN coffin 19×7×11, sarcophagus about 25 long). A grey stone
chest on a plinth, with light stone corner piers, a gold band and a
chamfered lid (true slopes). On the lid lies a chunky knight effigy: a big
helmeted head on a purple cushion, a faceted body with folded hands and a
long gold sword, a purple pall over the legs, and two upturned feet. The arcades, shields, the crack
and the purple glow leaking from it are paint. Faces -Z (the feet end).
"""
import numpy as np

import paint as P
import pnglyph
from _props import idx, last, masonry, plinth, prop
from pnkit import box, edges
from voxgrid import C, Grid

W, L = 14, 24  # chest width (x) and length (z)


def build():
    g = Grid(18, 22, 28)
    x0, z0 = 2, 2
    x1, z1 = x0 + W, z0 + L
    cx = (x0 + x1) / 2
    plinth(g, x0 - 1, z0 - 1, x1 + 1, z1 + 1, 0, 3, "stone", 4, bevel=1, seed=1)
    chest = box(g, x0, 3, z0, x1, 11, z1, "gray", 4)
    masonry(g, chest, "gray", 4, block=(8, 4), seed=2)
    X, Y, Z = idx(g)
    # painted arcades (pointed niches) on the long sides and the feet end
    Xc, Zc = X + 0.5, Z + 0.5
    for u0 in range(z0 + 2, z1 - 4, 7):
        um = u0 + 2.5
        niche = chest & ((X == x0) | (X == x1 - 1)) & (np.abs(Zc - um) < 2.6) & (Y >= 4) & (Y < 9 + (2.6 - np.abs(Zc - um)) * 0.8)
        P.flat(g, niche, "purple", 3)
        P.flat(g, niche & (np.abs(Zc - um) < 1.6) & (Y >= 5) & (Y < 8), "magenta", 5)
        P.flat(g, niche & (np.abs(Zc - um) < 0.6) & (Y >= 5) & (Y < 8), "magenta", 6)
    # corner piers in light stone, a gold band under the lid
    piers = np.zeros(g.shape, dtype=bool)
    for px, pz in ((x0 - 1, z0 - 1), (x1 - 2, z0 - 1), (x0 - 1, z1 - 2), (x1 - 2, z1 - 2)):
        piers |= box(g, px, 3, pz, px + 3, 11, pz + 3, "gray", 6)
    masonry(g, piers, "gray", 6, block=(3, 3), seed=3)
    band = box(g, x0 - 1, 10, z0 - 1, x1 + 1, 11, z1 + 1, "gold", 4)
    P.flat(g, band & ((X + Z) % 4 == 0), "gold", 5)
    # a shield on the feet end
    pnglyph.icon(g, "-z", z0 - 0, int(cx - 3.5), 4, "cross", "gold", 4, inks=None)
    # chamfered lid (a frustum band on a slab)
    lid = box(g, x0 - 1, 11, z0 - 1, x1 + 1, 12, z1 + 1, "gray", 5)
    g.prism("y", [(x0 - 1, z0 - 1), (x1 + 1, z0 - 1), (x1 + 1, z1 + 1), (x0 - 1, z1 + 1)], 12, 14, C("gray", 6), top=[(x0 + 0.5, z0 + 0.5), (x1 - 0.5, z0 + 0.5), (x1 - 0.5, z1 - 0.5), (x0 + 0.5, z1 - 0.5)])
    lid |= last(g)
    P.stone(g, lid, "gray", 6, block=(7, 4), frame="top", seed=4)
    P.flat(g, lid & (Y == 11), "gray", 4)
    # the effigy: cushion and head at the back, body, folded hands, feet at the front
    cush = box(g, cx - 4, 14, z1 - 7, cx + 4, 15, z1 - 1, "purple", 5)
    P.flat(g, edges(cush), "gold", 4)
    head = box(g, cx - 3, 15, z1 - 7, cx + 3, 20, z1 - 2, "gray", 6)
    P.mottle(g, head, "gray", 6, cell=2, seed=5)
    P.flat(g, head & (Y >= 17) & (Y < 18) & (Z < z1 - 5), "gray", 2)  # visor slit
    P.flat(g, head & (Y == 19), "gray", 7)
    g.prism("z", [(cx - 4, 14), (cx + 4, 14), (cx + 3, 17), (cx - 3, 17)], z0 + 4, z1 - 7, C("gray", 5))
    body = last(g)
    P.stone(g, body, "gray", 5, block=(4, 3), frame="top", seed=6)
    hands = box(g, cx - 2, 17, z1 - 13, cx + 2, 19, z1 - 10, "bone", 5)
    P.flat(g, hands & (X == int(cx)), "bone", 3)
    sword = box(g, cx - 0.5, 17, z0 + 3, cx + 0.5, 18, z1 - 13, "gold", 5)
    sword |= box(g, cx - 2.5, 17, z1 - 15, cx + 2.5, 18, z1 - 14, "gold", 4)
    P.flat(g, sword & (Z < z0 + 5), "steel", 6)
    feet = box(g, cx - 3, 14, z0 + 1, cx - 1, 19, z0 + 4, "gray", 6) | box(g, cx + 1, 14, z0 + 1, cx + 3, 19, z0 + 4, "gray", 6)
    P.flat(g, feet & (Y == 18), "gray", 7)
    # a purple pall with a gold hem draped across the middle of the chest
    pall = box(g, x0 - 2, 5, z0 + 5, x1 + 2, 15, z0 + 10, "purple", 5)
    P.mottle(g, pall, "purple", 5, cell=2, seed=8)
    P.flat(g, pall & ((Y == 5) | (Z == z0 + 5) | (Z == z0 + 9)), "gold", 5)
    P.flat(g, pall & (Y == 5) & ((Z % 2) == 0), "gold", 3)
    # moss creeping up the plinth
    P.flat(g, (g.a > 0) & (Y < 3) & ((P._hash(X, Z, seed=9) % np.uint64(4)) == 0), "moss", 5)
    # the cracked front corner leaks purple ghost light
    crack = chest & (((X - x0) + (Y - 3) - (Z - z0) * 0) == 7) & (Z == z0) & (X < x0 + 7)
    P.flat(g, crack, "magenta", 6)
    pool = (g.a > 0) & (Y == 2) & (X < x0 + 4) & (Z < z0 + 1)
    P.flat(g, pool, "magenta", 5)
    return prop("sarcophagus", "Knight Sarcophagus", g)
