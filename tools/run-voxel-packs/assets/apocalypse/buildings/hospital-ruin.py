"""A flat-roofed two-storey field hospital with an entrance canopy, a
curbside supply hatch and one collapsed corner."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import idx, make, rock
from _rep_bld import boards_x, cut, text_c
from pnkit import box, edges, window
from voxgrid import C, Grid, Part

SIZE = (126, 104, 104)
X0, X1, Z0, Z1, TOP = 12, 114, 32, 94, 70   # main block
FLOOR = 37                                   # second-storey floor line


def build():
    g = Grid(*SIZE)
    X, Y, Z = idx(g)
    # A cracked parking apron with painted bay lines.
    lot = box(g, 2, 0, 2, 124, 3, 102, "sand", 4)
    PP.concrete(g, lot, "sand", 4, size=16, cracks=12, frame="top", seed=1)
    for x0 in (66, 106):
        P.flat(g, lot & (Y == 2) & (X >= x0) & (X < x0 + 2) & (Z < 30), "bone", 6)

    # The block: concrete panels, a red stripe at the floor line, a plinth.
    walls = box(g, X0, 3, Z0, X1, TOP, Z1, "bone", 6)
    PP.concrete(g, walls, "bone", 6, size=12, cracks=14, seed=2)
    P.flat(g, walls & (Y >= FLOOR - 1) & (Y < FLOOR + 3), "red", 4)
    P.flat(g, walls & (Y == FLOOR + 3), "red", 2)
    P.flat(g, walls & (Y < 8), "steel", 4)
    P.grime(g, walls & (Y < 14), height=5, seed=3)
    parapet = box(g, X0 - 1, TOP, Z0 - 1, X1 + 1, TOP + 4, Z1 + 1, "bone", 5)
    P.flat(g, parapet, "bone", 5)
    P.flat(g, parapet & (Y == TOP + 3), "steel", 5)
    g.a[X0 + 2:X1 - 2, TOP:TOP + 4, Z0 + 2:Z1 - 2] = 0
    roof = walls & (Y == TOP - 1) & (X >= X0 + 2) & (X < X1 - 2) & (Z >= Z0 + 2) & (Z < Z1 - 2)
    PP.concrete(g, roof, "steel", 3, size=10, cracks=6, frame="top", seed=4)
    # A low hipped sheet-metal roof sits inside the parapet (true slopes, rule F2).
    # It covers the intact part only: the front right corner fell in.
    for x0, x1, z0, z1 in ((X0 + 2, 80, Z0 + 2, Z1 - 2), (80, X1 - 2, 66, Z1 - 2)):
        g.prism("y", [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], TOP, TOP + 7, C("rust", 4),
                top=[(x0 + 12, z0 + 12), (x1 - 12, z0 + 12), (x1 - 12, z1 - 12), (x0 + 12, z1 - 12)])
        hip = g.solids[-1].mask(g.shape)
        PP.corrugate(g, hip, "rust", 4, period=4, sheet=12, seed=x0)
        P.flat(g, hip & (Y == TOP + 6), "rust", 5)

    # Windows on every face, two rows. Some are boarded.
    rows = ((14, 28), (FLOOR + 7, FLOOR + 21))
    for v0, v1 in rows:
        for u0 in (78, 92) if v0 < FLOOR else (18, 34, 50, 66):
            window(g, "-z", Z0, u0, u0 + 11, v0, v1, glass="teal", glow=3)
        for u0 in (18, 34, 50, 66, 82, 98):
            window(g, "+z", Z1, u0, u0 + 11, v0, v1, glass="teal", glow=3)
        for face, plane in (("-x", X0), ("+x", X1)):
            for u0 in (42, 60, 78):
                window(g, face, plane, u0, u0 + 11, v0, v1, glass="teal", glow=3)
    boards_x(g, "-z", Z0, 18, 29, FLOOR + 7, FLOOR + 21, seed=5)
    boards_x(g, "+z", Z1, 50, 61, 14, 28, seed=6)
    boards_x(g, "-x", X0, 60, 71, FLOOR + 7, FLOOR + 21, seed=7)

    # The collapsed corner: the upper storey at the front right fell in.
    gone = (X >= 80) & (Z < 66) & (Y >= FLOOR + 4) & ((X - 80) + (66 - Z) + (Y - FLOOR) * 1.4 > 44 + 6 * np.sin(X * 0.7 + Z * 0.4))
    broken = cut(g, gone & (Y < TOP + 5))
    PP.concrete(g, broken, "steel", 4, size=6, cracks=4, seed=8)
    P.flat(g, broken & (Y >= FLOOR) & (Y < FLOOR + 3), "steel", 2)
    for (x, y, z), (x2, y2, z2) in (((97, FLOOR + 22, 50), (104, FLOOR + 30, 44)), ((90, FLOOR + 14, 40), (94, FLOOR + 23, 34)), ((110, FLOOR + 10, 52), (116, FLOOR + 17, 47))):
        S.bar(g, "z", (x, y), (x2, y2), 1.3, z - 1, z + 1, "rust", 3)
    for k, (cx, cz, r, h) in enumerate(((104, 20, 9, 9), (90, 16, 6, 6), (116, 34, 7, 8), (98, 8, 5, 4))):
        rock(g, cx, cz, 3, r, r * 0.8, h, ramp="bone", shade=5, seed=40 + k)
    # A heap of fallen slabs lies on the exposed upper floor.
    S.pyramid(g, 84, 36, 110, 62, FLOOR + 3, 11, "bone", 5, apex=(100, 52))
    heap = g.solids[-1].mask(g.shape)
    PP.concrete(g, heap, "bone", 5, size=5, cracks=4, seed=13)
    rubble = (X >= 80) & (Z < 44) & (Y >= 3) & (Y < 14) & (g.a > 0) & ~walls
    PP.concrete(g, rubble, "bone", 5, size=5, cracks=3, seed=9)

    # The entrance canopy on two steel posts, over boarded glass doors.
    # The canopy slopes down to the front fascia (a true slope).
    g.prism("x", [(36, Z0), (40, Z0), (37, 14), (33, 14)], 14, 70, C("bone", 6))
    canopy = g.solids[-1].mask(g.shape)
    P.planks(g, canopy, "bone", 6, width=4, across="x", nails=False, seed=12)
    P.flat(g, canopy & ((X < 16) | (X >= 68)), "red", 4)
    for x0 in (18, 64):
        post = box(g, x0, 3, 14, x0 + 3, 34, 17, "steel", 5)
        P.flat(g, edges(post), "steel", 3)
    glass = box(g, 32, 3, Z0 - 1, 52, 31, Z0, "sky", 3)
    P.mottle(g, glass, "sky", 3, cell=4, seed=10)
    P.outline(g, glass, "steel", 3, normal="z")
    P.flat(g, glass & (np.abs(X - 42) < 1), "steel", 3)
    boards_x(g, "-z", Z0 - 1, 32, 52, 4, 30, seed=11)
    fascia = box(g, 14, 31, 11, 70, 40, 14, "red", 4)
    P.flat(g, edges(fascia), "red", 2)
    text_c(g, "-z", 11, 42, 32, "EMERGENCY", "bone", 7)

    # Ambulances stop outside. Staff use this roller hatch for supplies.
    bay = box(g, 72, 3, Z0 - 1, 108, 33, Z0, "steel", 5)
    P.flat(g, bay & (np.floor(Y) % 3 == 0), "steel", 3)
    P.flat(g, bay & (Y >= 3) & (Y < 9) & (X >= 96), "darkwood", 1)
    surround = box(g, 70, 33, Z0 - 2, 110, 36, Z0, "gold", 5)
    surround |= box(g, 70, 3, Z0 - 2, 72, 33, Z0, "gold", 5) | box(g, 108, 3, Z0 - 2, 110, 33, Z0, "gold", 5)
    PP.hazard(g, surround, period=6)
    text_c(g, "-z", Z0 - 2, 90, 22, "MED", "red", 4)

    # The function sign: a big red cross on the roof and on the facade.
    for x0 in (44, 72):
        S.bar(g, "x", (TOP + 7, 56), (TOP + 22, 50), 2.0, x0, x0 + 2, "steel", 3)
    sign = box(g, 38, TOP + 7, 46, 82, TOP + 32, 50, "bone", 7)
    P.outline(g, sign, "steel", 3, normal="z")
    cross = sign & (((np.abs(X - 60) < 4) & (Y > TOP + 9) & (Y < TOP + 29)) | ((np.abs(X - 60) < 10) & (np.abs(Y - TOP - 19) < 4)))
    P.flat(g, cross, "red", 4)
    text_c(g, "-z", Z0, 42, TOP - 9, "HOSPITAL", "red", 3)
    # Oxygen bottles and a stretcher wait by the canopy.
    for cx in (8, 13):
        bottle = S.disc(g, "y", cx, 20, 2.4, 3, 18, "teal", 5, n=8)
        P.flat(g, bottle & (Y > 15), "bone", 6)
    stretcher = box(g, 2, 9, 4, 16, 11, 14, "bone", 6)
    P.flat(g, edges(stretcher), "steel", 3)
    for x0, z0 in ((3, 5), (13, 5), (3, 11), (13, 11)):
        box(g, x0, 3, z0, x0 + 1, 9, z0 + 1, "steel", 4)
    return make("buildings", "hospital-ruin", "Field Hospital Ruin", Part("hospital-ruin", g))
