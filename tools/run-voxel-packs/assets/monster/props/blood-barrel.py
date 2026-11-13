"""Blood barrel, in the Pirate Nation haunted style.

A fat octagonal barrel (true facets) lies on a planked cradle with its
bat-branded end toward the front view. Two proud iron hoops, painted
staves and a brass tap that dribbles blood into a glossy pool; blood also
runs from the bung down its flank. A small upright keg stands behind it.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, planked, prop
from pnkit import box
from voxgrid import C, Grid

R = 7.5  # barrel flat radius
X0, X1 = 5, 25  # barrel ends (along x)
CY = 4 + R  # axle height: the flat underside sits on the cradle at y = 4
CZ = 11


def build():
    g = Grid(32, 26, 30)
    X, Y, Z = idx(g)
    # the cradle: two planked saddles with wedges that cup the barrel
    for sx in (X0 + 3, X1 - 6):
        planked(g, box(g, sx, 0, CZ - 8, sx + 3, 4, CZ + 8, "wood", 5), "wood", 5, width=2, across="y", nails=False, seed=sx)
        for s in (-1, 1):
            g.prism("x", [(4, CZ + s * 5), (4, CZ + s * 8), (9, CZ + s * 8)], sx, sx + 3, C("wood", 4))
    # the barrel along x: staves, hoops, a darker lid rim
    body = S.disc(g, "x", CY, CZ, R, X0, X1, "wood", 5)
    ang = np.arctan2(Z + 0.5 - CZ, Y + 0.5 - CY)
    stave = np.floor((ang + np.pi) / (2 * np.pi) * 16).astype(int)
    P._paint(g, body, "wood", 5 + np.array([-1, 0, 0, 1])[stave % 4])
    P.flat(g, body & ((X == X0) | (X == X1 - 1)) & (S.ngon_radius(g, "x", CY, CZ) > R - 1.6), "wood", 3)
    for hx in (X0 + 3, X1 - 5):
        S.disc(g, "x", CY, CZ, R + 0.8, hx, hx + 2, "iron", 6)
    S.disc(g, "x", CY, CZ, R + 0.8, (X0 + X1) // 2 - 1, (X0 + X1) // 2 + 1, "iron", 6)
    # the bat brand on the +x end (toward the front view)
    pnglyph.icon(g, "+x", X1, int(CZ - 6.5), int(CY - 3.5), "bat", "red", 3, inks={"+": ("red", 5)})
    # the bung on top with blood running down the -z flank
    box(g, 13, int(CY + R), CZ - 1, 16, int(CY + R) + 1, CZ + 1, "iron", 5)
    run = body & (np.abs(X + 0.5 - 14.5) < 1.1 + (Y < CY) * 0.0) & (Z + 0.5 < CZ) & (Y > CY - 3)
    P.flat(g, run, "red", 3)
    P.flat(g, run & (X == 14) & (Y % 3 == 0), "red", 5)
    # a brass tap on the front facet, a dribble and a pool
    tap = box(g, 19, CY - 4, CZ - R - 2, 22, CY - 2, CZ - R, "gold", 4)
    box(g, 20, CY - 6, CZ - R - 2, 21, CY - 4, CZ - R - 1, "gold", 3)
    drip = box(g, 20, 1, CZ - R - 2, 21, CY - 6, CZ - R - 1, "red", 4)
    P.flat(g, drip & (Y % 2 == 0), "red", 5)
    pool = np.zeros(g.shape, dtype=bool)
    for px, pz, pr in ((20.5, CZ - R - 1.5, 3.2), (17, CZ - R - 3, 2.4), (23.5, CZ - R - 4, 2.0)):
        pool |= (np.hypot(X + 0.5 - px, Z + 0.5 - pz) < pr) & (Y == 0) & (g.a == 0)
    g.where(pool, C("red", 3))
    P.flat(g, pool & ((X + Z) % 5 == 0), "red", 6)
    # a small upright keg behind
    S.drum(g, 24, 24, 0, 11, 4.5, ramp="wood", base=5, hoop="iron", wear=False)
    return prop("blood-barrel", "Blood Barrel", g)
