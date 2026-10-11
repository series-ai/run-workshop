"""A storm-broken sandstone chapel: a tall bell tower with a slate spire at the
front, a buttressed nave, and a rear bay that lost its roof."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import make
from pnkit import box, door, edges, gable_roof, lancet, rose
from voxgrid import C, Grid, Part

SIZE = (104, 146, 112)
NX0, NX1, NZ0, NZ1, EAVE = 26, 82, 40, 104, 54   # nave walls
TX0, TX1, TZ0, TZ1, TOP = 40, 68, 22, 44, 96     # bell tower
CX, CZ = (TX0 + TX1) / 2, (TZ0 + TZ1) / 2


def build():
    g = Grid(*SIZE)
    X, Y, Z = S.coords(g)
    # The churchyard: packed earth with a flagstone path to the door.
    yard = box(g, 4, 0, 4, 100, 4, 108, "khaki", 3)
    PP.concrete(g, yard, "khaki", 3, size=20, cracks=6, frame="top", seed=1)
    P.flat(g, edges(yard), "khaki", 2)
    path = box(g, 44, 3, 4, 64, 5, 22, "stone", 5)
    P.stone(g, path, "stone", 5, block=(6, 5), frame="top", seed=2)
    P.flat(g, edges(path), "stone", 3)

    # The nave: grey stone blocks with a darker base course.
    # Warm sandstone walls, a red tile roof and a copper spire keep the
    # chapel inside the saturated pack palette (rule C2).
    nave = box(g, NX0, 4, NZ0, NX1, EAVE, NZ1, "sand", 6)
    P.stone(g, nave, "sand", 6, block=(8, 5), mortar=-2, seed=3)
    P.stone(g, nave & (Y < 12), "stone", 3, block=(10, 4), seed=4)
    P.grime(g, nave & (Y < 18), height=5, seed=5)
    # Stepped buttresses (true slopes) hold the long side walls.
    for zz in (50, 70, 90):
        for x_wall, x_out in ((NX0, NX0 - 7), (NX1, NX1 + 7)):
            g.prism("z", [(x_wall, 4), (x_out, 4), (x_out, 18), (x_wall, 46)], zz, zz + 5, C("sand", 5))
            m = g.solids[-1].mask(g.shape)
            P.stone(g, m, "sand", 5, block=(5, 4), mortar=-2, seed=zz)
    # Pointed lancet windows sit between the buttresses.
    for face, plane in (("-x", NX0), ("+x", NX1)):
        for z0 in (57, 77):
            lancet(g, face, plane, z0, z0 + 9, 20, 44, glass="teal", shade=3, frame="bone", fshade=5, seed=z0)
    lancet(g, "+z", NZ1, 48, 60, 18, 44, glass="gold", shade=4, frame="bone", fshade=5, seed=9)

    # The front bay keeps its slate roof. The rear bay lost it.
    roof = gable_roof(g, NX0, NX1, NZ0, 84, EAVE, 90, ramp="red", base=4, thick=4, overhang=4,
                      trim="darkwood", gable="sand", ridge="z", seed=6)
    P.stone(g, roof["attic"], "sand", 6, block=(8, 5), mortar=-2, seed=7)
    PP.blotch(g, roof["slabs"], "red", 2, cell=4, chance=0.05, seed=8)
    # Bare rafters and a broken rear gable show the storm damage.
    for zz in (88, 95):
        S.bar(g, "z", (NX0 - 2, EAVE - 2), (CX - 1, 88), 3.0, zz, zz + 3, "darkwood", 3)
        S.bar(g, "z", (NX1 + 2, EAVE - 2), (CX + 1, 88), 3.0, zz, zz + 3, "darkwood", 3)
    S.bar(g, "z", (NX1 + 2, EAVE - 2), (66, 76), 3.0, 101, 104, "darkwood", 3)
    g.prism("z", [(NX0, EAVE), (NX1, EAVE), (74, 64), (66, 62), (60, 74), (50, 70), (44, 78), (36, 66)], 100, NZ1, C("sand", 6))
    P.stone(g, g.solids[-1].mask(g.shape), "sand", 6, block=(8, 5), mortar=-2, seed=10)
    for x0, z0, s in ((84, 98, 7), (12, 92, 6), (90, 84, 5), (18, 104, 4)):
        chunk = box(g, x0, 4, z0, x0 + s, 4 + s - 2, min(z0 + s, 108), "sand", 5)
        P.stone(g, chunk, "sand", 5, block=(4, 3), mortar=-2, seed=x0)

    # The bell tower rises to 1.8 times the nave eave.
    tower = box(g, TX0, 4, TZ0, TX1, TOP, TZ1, "sand", 6)
    P.stone(g, tower, "sand", 6, block=(7, 5), mortar=-2, seed=11)
    P.stone(g, tower & (Y < 12), "stone", 3, block=(10, 4), seed=12)
    quoin = tower & ((X < TX0 + 3) | (X >= TX1 - 3)) & ((Z < TZ0 + 3) | (Z >= TZ1 - 3))
    P.stone(g, quoin, "bone", 5, block=(3, 5), seed=13)
    for y0 in (40, 74):
        band = box(g, TX0 - 1, y0, TZ0 - 1, TX1 + 1, y0 + 3, TZ1 + 1, "bone", 4)
        P.flat(g, edges(band), "bone", 2)
    # Open belfry arches on three faces, with the bell hung in the front one.
    g.a[TX0 + 8:TX1 - 8, 80:93, TZ0:TZ0 + 11] = 0
    g.a[TX0:TX0 + 4, 80:93, TZ0 + 7:TZ1 - 7] = 0
    g.a[TX1 - 4:TX1, 80:93, TZ0 + 7:TZ1 - 7] = 0
    back = box(g, TX0 + 8, 80, TZ0 + 11, TX1 - 8, 93, TZ0 + 12, "darkwood", 1)
    P.flat(g, back, "darkwood", 1)
    for x0, x1, z0, z1 in ((TX0, TX0 + 1, TZ0 + 7, TZ1 - 7), (TX1 - 1, TX1, TZ0 + 7, TZ1 - 7)):
        P.flat(g, box(g, x0 + (3 if x0 == TX0 else -3), 80, z0, x1 + (3 if x0 == TX0 else -3), 93, z1, "darkwood", 1), "darkwood", 1)
    yoke = box(g, TX0 + 8, 90, TZ0 + 4, TX1 - 8, 93, TZ0 + 7, "darkwood", 3)
    P.planks(g, yoke, "darkwood", 3, width=3, across="y", seed=14)
    bell = S.cone(g, "y", CX, TZ0 + 5.5, 5.5, 81, 90, "gold", 5, n=8, r_top=2.5)
    P.flat(g, bell & (Y < 83), "gold", 3)
    S.disc(g, "y", CX, TZ0 + 5.5, 1.5, 79, 81, "rust", 3, n=6)
    cornice = box(g, TX0 - 2, TOP - 4, TZ0 - 2, TX1 + 2, TOP, TZ1 + 2, "bone", 4)
    P.stone(g, cornice, "bone", 4, block=(6, 4), seed=15)
    P.flat(g, edges(cornice), "bone", 2)
    # A tall copper spire, green with age, carries a leaning iron cross.
    S.spire(g, CX, CZ, TOP, 14, 32, ramp="teal", base=4, n=4, overhang=1, seed=16)
    tip = TOP + 32
    S.bar(g, "z", (CX - 0.5, tip - 2), (CX + 2.0, tip + 14), 3.0, CZ - 1.5, CZ + 1.5, "iron", 3)
    S.bar(g, "z", (CX - 5.0, tip + 8), (CX + 6.0, tip + 9.6), 3.0, CZ - 1.5, CZ + 1.5, "iron", 3)

    # A wide arched door, a rose window and a stone step at the tower base.
    step = box(g, TX0 - 2, 4, TZ0 - 6, TX1 + 2, 6, TZ0, "stone", 4)
    P.stone(g, step, "stone", 4, block=(6, 3), frame="top", seed=17)
    P.flat(g, edges(step), "stone", 2)
    door(g, "-z", TZ0, 46, 62, 6, 36, leaf="wood", seed=18)
    rose(g, "-z", TZ0, CX, 58, 7, glass="red", shade=5, frame="bone", fshade=5)
    lancet(g, "-x", TX0, TZ0 + 7, TZ0 + 15, 50, 70, glass="teal", shade=3, frame="bone", fshade=5, seed=19)
    lancet(g, "+x", TX1, TZ0 + 7, TZ0 + 15, 50, 70, glass="teal", shade=3, frame="bone", fshade=5, seed=20)

    # Leaning headstones in the churchyard.
    for cx, cz, lean, glyph in ((12, 14, -8, "cross"), (24, 12, 6, "cross"), (86, 16, 9, "cross"), (96, 30, -5, None)):
        S.tombstone(g, cx, cz, w=9, h=15, t=4, y0=4, lean=lean, ramp="stone", base=5, glyph=glyph, seed=cx)
    return make("buildings", "church-ruin", "Storm-Broken Chapel", Part("church-ruin", g))
