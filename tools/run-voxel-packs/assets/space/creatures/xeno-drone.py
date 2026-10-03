"""Xeno drone, in the Pirate Nation creature style.

A hovering insect caricature: a faceted violet chitin thorax with magenta
plates, a big head with two huge red compound eyes and bone mandibles, a
fat faceted abdomen banded in toxic green that ends in a glowing stinger,
three pairs of dangling legs and four pale veined wings (flat true-slope
prisms). Clips: idle (hover, flap), attack (rear back and dive with the
stinger), hit (knock back), death (spiral down). Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, box, coords, front, gem, keys, light_top, mask_of, plan, quad, side, spots, wave
from pnshapes import cone

S = (28, 18, 28)
CX, CZ = 14, 13
YB = 8  # body axis height


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    g.prism("z", [(CX - 3, YB - 3), (CX + 3, YB - 3), (CX + 4, YB), (CX + 3, YB + 3), (CX - 3, YB + 3), (CX - 4, YB)], CZ - 3, CZ + 4, 0,
            top=[(CX - 2.5, YB - 2.5), (CX + 2.5, YB - 2.5), (CX + 3.5, YB), (CX + 2.5, YB + 3), (CX - 2.5, YB + 3), (CX - 3.5, YB)])
    thorax = g.solids[-1].mask(g.shape)
    P.flat(g, thorax, "purple", 4)
    P.flat(g, thorax & (Y > YB + 2), "magenta", 5)
    # the head: a wide wedge with huge compound eyes
    head = front(g, [(CX - 4.5, YB - 2), (CX + 4.5, YB - 2), (CX + 5, YB + 1), (CX + 3, YB + 3.5), (CX - 3, YB + 3.5), (CX - 5, YB + 1)], CZ - 8, CZ - 3, "purple", 4)
    P.flat(g, head, "purple", 4)
    light_top(g, head, "purple", 6)
    for s in (-1, 1):
        eye = head & (np.abs(X - (CX + s * 3.2)) < 2.0) & (Y > YB - 0.5) & (Y < YB + 3) & (Z < CZ - 4.5)
        P.flat(g, eye, "red", 5)
        P.flat(g, eye & ((np.floor(X) + np.floor(Y)) % 2 == 0), "red", 6)
        P.flat(g, eye & (Y > YB + 2) & (np.abs(X - (CX + s * 3.6)) < 0.9), "bone", 7)
        side(g, quad((YB - 1.5, CZ - 7.5), (YB - 3, CZ - 9.5), 0.8, 0.5, cap=0.8), CX + s * 1.6 - 0.7, CX + s * 1.6 + 0.7, "bone", 5)  # mandibles
    # the abdomen: a fat faceted drop, banded, ending in a glowing stinger
    g.prism("z", [(CX - 3, YB - 3), (CX + 3, YB - 3), (CX + 4.5, YB), (CX + 3, YB + 3), (CX - 3, YB + 3), (CX - 4.5, YB)], CZ + 4, CZ + 10, 0,
            top=[(CX - 1.5, YB - 3.5), (CX + 1.5, YB - 3.5), (CX + 2.5, YB - 1.5), (CX + 1.5, YB + 0.5), (CX - 1.5, YB + 0.5), (CX - 2.5, YB - 1.5)])
    ab = g.solids[-1].mask(g.shape)
    P.flat(g, ab, "purple", 5)
    for z0 in (CZ + 5, CZ + 8):
        P.flat(g, ab & (Z >= z0) & (Z < z0 + 1.5), "toxic", 5)
    spots(g, ab & (Y > YB), "toxic", 6, cell=3, r=0.8, chance=2, seed=4)
    sting = cone(g, "z", CX, YB - 1.5, 1.6, CZ + 10, CZ + 12.5, "toxic", 6, n=6)
    P.flat(g, sting, "toxic", 6)
    P.flat(g, sting & (Z > CZ + 11.5), "toxic", 7)
    # three pairs of dangling legs
    for s in (-1, 1):
        for k, dz in enumerate((-2, 0.5, 3)):
            side(g, quad((YB - 2, CZ + dz), (YB - 6, CZ + dz + 1.5 - k), 0.6), CX + s * (2.5 + k * 0.5) - 0.6, CX + s * (2.5 + k * 0.5) + 0.6, "purple", 3)
    return g


def wing(s: int, k: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    root = (CX + s * 2.5, CZ - 1 + k * 3)
    length = 9 if k == 0 else 7.5
    tip = (CX + s * (2.5 + length), CZ - 3 + k * 8)
    ux, uz = tip[0] - root[0], tip[1] - root[1]
    n = np.hypot(ux, uz)
    nx, nz = -uz / n, ux / n

    def at(t, o):
        return (root[0] + ux * t + nx * o, root[1] + uz * t + nz * o)

    w = plan(g, [root, at(0.35, -2.2), at(0.8, -2.6), tip, at(0.8, 2.0), at(0.35, 1.6)], YB + 2.5, YB + 3.5, "bone", 7)
    P.flat(g, w, "bone", 7)
    t = ((X - root[0]) * ux + (Z - root[1]) * uz) / n / n
    o = (X - root[0]) * nx + (Z - root[1]) * nz
    P.flat(g, w & (np.abs(o) < 0.55), "cyan", 5)  # the main vein
    P.flat(g, w & (t > 0.55) & (np.abs(o - (t - 0.55) * 4) < 0.5), "cyan", 6)
    P.flat(g, w & (t < 0.3), "cyan", 6)
    return g


def build():
    rig = Rig()
    rig.group("xeno-drone", (CX, 0, CZ))
    rig.add("body", body(), (CX, YB, CZ), "xeno-drone")
    names = {(1, 0): "wing-l0", (1, 1): "wing-l1", (-1, 0): "wing-r0", (-1, 1): "wing-r1"}
    for (s, k), name in names.items():
        rig.add(name, wing(s, k), (CX + s * 2.5, YB + 3, CZ - 1 + k * 3), "body", rot=(0.0, s * (10.0 - 25.0 * k), s * 12.0))
    z = (0.0, 0.0, 0.0)
    flap = 0.24

    def flaps(sgn, base):
        return keys((0, (0, base, sgn * 12)), (flap / 2, (0, base, sgn * -30)), (flap, (0, base, sgn * 12)))

    idle = {"body": {"loc": wave(1.2, "y", 1.0), "rot": wave(1.2, "x", 4, phase=1.0)},
            "wing-l0": {"rot": flaps(1, 0)}, "wing-l1": {"rot": flaps(1, 0)}, "wing-r0": {"rot": flaps(-1, 0)}, "wing-r1": {"rot": flaps(-1, 0)}}
    attack = {"body": {"rot": keys((0, z), (0.25, (-35, 0, 0)), (0.45, (40, 0, 0)), (0.8, z)),
                       "loc": keys((0, z), (0.25, (0, 2, 3)), (0.45, (0, -3, -6)), (0.8, z))},
              "wing-l0": {"rot": flaps(1, 0)}, "wing-r0": {"rot": flaps(-1, 0)}}
    hit = {"body": {"rot": keys((0, z), (0.1, (-20, 0, 15)), (0.4, z)), "loc": keys((0, z), (0.1, (0, 0, 3)), (0.4, z))}}
    death = {"body": {"rot": keys((0, z), (0.4, (20, 180, 30)), (0.8, (40, 400, 60)), (1.1, (30, 420, 90))),
                      "loc": keys((0, z), (0.4, (0, -2, 0)), (0.8, (0, -5, 0)), (1.1, (0, -6, 0)))},
             "wing-l0": {"rot": keys((0, z), (1.1, (0, 0, -40)))}, "wing-r0": {"rot": keys((0, z), (1.1, (0, 0, 40)))}}
    return asset("creatures", "xeno-drone", "Xeno Drone", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)])


_ = (box, gem, mask_of)
