"""Moon rocks, in the Pirate Nation terrain style.

Three pale faceted lunar boulders (irregular stacked frustums, true
slopes) on a flat dusty regolith patch with a trail of painted
bootprints, a split geode full of blue crystals, and a planted survey
flag in hazard orange with a painted ringed planet. No clips. Faces -Z.
"""
import numpy as np

import pnglyph
from _life import P, Grid, Rig, asset, box, coords, front, light_top, mask_of, plan, rock, spots
from pnshapes import cone

S = (48, 30, 40)
CX, CZ = 24, 20


def rocks() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    patch = plan(g, [(CX - 22, CZ - 8), (CX - 8, CZ - 17), (CX + 12, CZ - 16), (CX + 23, CZ - 4), (CX + 18, CZ + 13), (CX - 2, CZ + 17), (CX - 20, CZ + 10)], 0, 1, "sand", 4)
    P.flat(g, patch, "sand", 4)
    spots(g, patch, "sand", 5, cell=6, r=1.6, chance=3, seed=1)
    for k in range(5):  # bootprints
        bx, bz = CX - 18 + k * 5, CZ - 12 + (k % 2) * 3
        P.flat(g, patch & (np.abs(X - bx) < 1.2) & (np.abs(Z - bz) < 2.0), "sand", 2)
    for (bx, bz, r, h, seed, shade) in ((CX + 4, CZ + 2, 9, 14, 3, 6), (CX + 14, CZ - 6, 5, 8, 4, 5), (CX - 8, CZ + 7, 4, 6, 5, 6)):
        m = mask_of(g, rock(g, bx, bz, 1, r, h, "bone", shade, n=7, seed=seed))
        P.flat(g, m, "bone", shade)
        light_top(g, m, "bone", 7)
        spots(g, m, "bone", shade - 2, cell=6, r=1.4, chance=3, seed=seed)  # small craters
    # the geode: a split rock showing blue crystals
    geo = mask_of(g, rock(g, CX - 12, CZ - 5, 1, 4.5, 5, "gray", 4, n=6, seed=7))
    P.flat(g, geo, "gray", 4)
    top = light_top(g, geo, "sky", 3)
    del top
    for dx, dz, h in ((0, 0, 4), (-1.5, 1, 3), (1.5, -1, 3)):
        c = cone(g, "y", CX - 12 + dx, CZ - 5 + dz, 1.3, 5, 5 + h, "sky", 6, n=6)
        P.flat(g, c, "sky", 6)
        light_top(g, c, "sky", 7)
    # the survey flag
    px, pz = CX - 17, CZ + 6
    box(g, px, 1, pz, px + 2, 26, pz + 2, "steel", 6)
    flag = front(g, [(px + 2, 25), (px + 15, 24), (px + 12, 19.5), (px + 15, 14), (px + 2, 15)], pz, pz + 1.5, "orange", 6)
    P.flat(g, flag, "orange", 6)
    P.outline(g, flag, "orange", 4, normal="z")
    pnglyph.icon(g, "-z", pz, px + 3, 15, "star", "gold", 7)
    pnglyph.icon(g, "+z", pz + 1.5, px + 3, 15, "star", "gold", 7)
    return g


def build():
    rig = Rig()
    rig.add("moon-rocks", rocks(), (CX, 0, CZ))
    return asset("terrain-nature", "moon-rocks", "Moon Rocks", rig.root)
