"""Alien bulb plant, in the Pirate Nation plant style.

A caricature alien plant: a fat faceted magenta pod (stacked frustums)
spotted with lime, a star of eight spiky pink frond leaves that lean out
(true slopes), and a crown of three curling teal stalks that end in big
glowing lime bulbs with bright cores. The crown sways on `idle`.
Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, coords, front, gem, light_top, mask_of, quad, side, spots, wave

S = (40, 44, 40)
CX, CZ = 20, 20
YP = 11  # pod top (the crown's root)


def pod() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    solids = gem(g, CX, CZ, 0, 7, 13, "magenta", 5, n=8, waist=0.45, cap=0.6)
    m = mask_of(g, solids)
    P.flat(g, m, "magenta", 5)
    light_top(g, m, "magenta", 6)
    spots(g, m, "lime", 6, cell=4, r=1.1, chance=2, seed=2)
    leaves = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        leaves |= front(g, [(CX + s * 3, 1), (CX + s * 10, 1.5), (CX + s * 19, 12), (CX + s * 9, 8), (CX + s * 3, 6)], CZ - 1, CZ + 1, "pink", 4)
        leaves |= side(g, [(1, CZ + s * 3), (1.5, CZ + s * 10), (11, CZ + s * 18), (7.5, CZ + s * 9), (5, CZ + s * 3)], CX - 1, CX + 1, "pink", 4)
    for dx, dz in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        leaves |= front(g, [(CX + dx * 3, 1), (CX + dx * 8, 1.5), (CX + dx * 14, 9), (CX + dx * 6, 6)], CZ + dz * 5 - 1, CZ + dz * 5 + 1, "magenta", 4)
    P.flat(g, leaves, "pink", 4)
    P.flat(g, leaves & (Y > 6), "pink", 5)
    P.flat(g, leaves & (np.maximum(np.abs(X - CX), np.abs(Z - CZ)) > 12), "magenta", 6)
    P.flat(g, leaves & ((np.abs(X - CX) < 1.2) | (np.abs(Z - CZ) < 1.2)) & (Y > 2), "pink", 6)  # leaf midribs
    return g


def crown() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    stalks = np.zeros(g.shape, dtype=bool)
    bulbs = np.zeros(g.shape, dtype=bool)
    specs = [  # (plane, segments (u, y) with u across the plane, bulb centre (x, y, z), bulb radius)
        ("x", [((CX, YP - 1), (CX - 3, YP + 12)), ((CX - 3, YP + 12), (CX + 1, YP + 24))], (CX + 1, YP + 24, CZ), 4.2),
        ("z", [((CZ, YP - 1), (CZ + 5, YP + 9)), ((CZ + 5, YP + 9), (CZ + 9, YP + 16))], (CX, YP + 16, CZ + 9), 3.4),
        ("x2", [((CX, YP - 1), (CX + 6, YP + 7)), ((CX + 6, YP + 7), (CX + 10, YP + 12))], (CX + 10, YP + 12, CZ - 2), 3.0),
    ]
    for plane, segs, (bx, by, bz), br in specs:
        for (u0, y0), (u1, y1) in segs:
            if plane == "z":
                stalks |= side(g, quad((y0, u0), (y1, u1), 1.5, 1.2), CX - 1.3, CX + 1.3, "teal", 5)
            else:
                zc = CZ if plane == "x" else CZ - 2
                stalks |= front(g, quad((u0, y0), (u1, y1), 1.5, 1.2), zc - 1.3, zc + 1.3, "teal", 5)
        bulbs |= mask_of(g, gem(g, bx, bz, by - br * 0.9, br, br * 1.9, "toxic", 6, n=8))
    P.flat(g, stalks, "teal", 5)
    P.flat(g, stalks & (np.floor(Y) % 4 == 0), "teal", 4)  # growth rings
    P.flat(g, bulbs, "toxic", 6)
    light_top(g, bulbs, "toxic", 7)
    for (bx, by, bz), br in ((sp[2], sp[3]) for sp in specs):
        P.flat(g, bulbs & (np.hypot(X - bx, Y - (by + 0.5)) < br * 0.55), "toxic", 7)
        P.flat(g, bulbs & (Y < by - br * 0.4), "toxic", 5)
    return g


def build():
    rig = Rig()
    rig.add("alien-plant", pod(), (CX, 0, CZ))
    rig.add("crown", crown(), (CX, YP, CZ), "alien-plant")
    idle = {"crown": {"rot": wave(3.0, "z", 6)}}
    return asset("terrain-nature", "alien-plant", "Alien Bulb Plant", rig.root, clips=[Clip("idle", idle)])
