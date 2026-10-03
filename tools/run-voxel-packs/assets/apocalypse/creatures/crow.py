"""Carrion crow, in the Pirate Nation creature style (after the PN pigeon
and gull): a chunky faceted body in slate blue-black with a violet sheen,
a big square head with a heavy pale beak and angry red eyes, broad wings
with notched feather tips (one of them torn), a fanned tail and gold
feet. The body, beak, wings and tail are true-slope prisms; feathers and
sheen are paint. Clips: idle (peck and hop), move (flight, the wings
flap), attack (dive and peck), hit, death (falls on its back). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (26, 18, 24)
CX = 13.0
INK = ("navy", 6)
NECK = (CX, 9.0, 10.0)
SHOULDER = {"wing-l": (CX - 4.0, 9.0, 12.0), "wing-r": (CX + 4.0, 9.0, 12.0)}


def feathers(g, m, base=INK[1], seed=0):
    P.flat(g, m, INK[0], base)
    PP.fur(g, m, INK[0], base, stroke=3, seed=seed)


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = side(g, [(3, 9), (3, 16), (5, 19.5), (9.5, 18), (11, 13), (10, 9), (6.5, 7.5)], CX - 4, CX + 4, *INK)
    feathers(g, m, seed=1)
    P.flat(g, m & (Y < 5), INK[0], INK[1] + 1)  # a lighter belly
    PP.blotch(g, m & (Y > 7), "purple", 5, cell=2, chance=0.08, seed=2)  # an oily sheen
    tail = side(g, [(5, 18.5), (8, 17.5), (8.5, 23.5), (4, 23.5)], CX - 3, CX + 3, *INK)
    P.flat(g, tail, INK[0], INK[1] - 1)
    P.flat(g, tail & (np.floor(X) % 2 == 0), INK[0], INK[1])
    for s in (-1, 1):  # gold feet
        limb(g, (CX + s * 1.8, 3.5, 13), (CX + s * 1.8, 0.8, 12.5), 0.7, 0.6, "gold", 5, n=4)
        box(g, CX + s * 1.8 - 1.2, 0, 10.5, CX + s * 1.8 + 1.2, 1, 13.5, "gold", 5)
    return g


def head() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    m = box(g, CX - 3.5, ny, nz - 5, CX + 3.5, ny + 7, nz + 1, *INK)
    feathers(g, m, seed=3)
    P.flat(g, m & (Y > ny + 6), INK[0], INK[1] + 1)
    beak = side(g, [(ny + 1, nz - 5), (ny + 4.5, nz - 5), (ny + 2.5, nz - 9), (ny + 1.5, nz - 8.5)], CX - 1.5, CX + 1.5, "bone", 5)
    P.flat(g, beak & (Y < ny + 2.2), "bone", 4)
    G.stamp(g, "-z", nz - 5, int(CX - 3), int(ny + 3), ["oo...oo", "rr...rr"], {"r": C("red", 6), "o": C("navy", 4)}, depth=2)
    return g


def wing(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    wx, wy, wz = SHOULDER["wing-l" if s < 0 else "wing-r"]
    x0, x1 = (wx - 1.5, wx) if s < 0 else (wx, wx + 1.5)
    pts = [(wy + 0.5, wz - 4), (wy + 1.5, wz + 1), (wy, wz + 8), (wy - 2, wz + 7.5), (wy - 1.5, wz + 5.5), (wy - 3.5, wz + 5), (wy - 3, wz + 3), (wy - 5, wz + 2), (wy - 4, wz - 2)]
    if s > 0:  # the torn wing: a bitten notch in the trailing edge
        pts = [(wy + 0.5, wz - 4), (wy + 1.5, wz + 1), (wy, wz + 8), (wy - 2, wz + 7.5), (wy - 1.5, wz + 5.5), (wy - 0.5, wz + 4), (wy - 3, wz + 3), (wy - 5, wz + 2), (wy - 4, wz - 2)]
    m = side(g, pts, x0, x1, *INK)
    feathers(g, m, INK[1] - 1, seed=4 + s)
    P.flat(g, m & (Y < wy - 2.5), "purple", 4)  # violet sheen on the flight feathers
    return g


def build():
    rig = Rig("crow", (CX, 0, 13.0))
    rig.add("body", body(), (CX, 3.0, 13.0))
    rig.add("head", head(), NECK, parent="body")
    for name, s in (("wing-l", -1), ("wing-r", 1)):
        rig.add(name, wing(s), SHOULDER[name], parent="body")
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.4, 0, 0, 0), (0.5, -35, 0, 0), (0.6, 0, 0, 0), (0.7, -35, 0, 0), (0.8, 0, 0, 0), (1.4, 0, 20, 0), (1.8, 0, 0, 0))},
            "body": {"loc": seq((0, 0, 0, 0), (1.0, 0, 0, 0), (1.1, 0, 2.5, 0), (1.2, 0, 0, 0), (1.8, 0, 0, 0))},
            "wing-l": {"rot": seq((0, 0, 0, 0), (1.0, 0, 0, 0), (1.1, 0, 0, -25), (1.2, 0, 0, 0), (1.8, 0, 0, 0))},
            "wing-r": {"rot": seq((0, 0, 0, 0), (1.0, 0, 0, 0), (1.1, 0, 0, 25), (1.2, 0, 0, 0), (1.8, 0, 0, 0))}}
    move = {"wing-l": {"rot": wave(0.4, (0, 0, -55))}, "wing-r": {"rot": wave(0.4, (0, 0, 55))},
            "body": {"loc": wave(0.4, (0, 1.2, 0), phase=1.2, base=(0, 5, 0)), "rot": wave(0.4, (4, 0, 0), base=(-10, 0, 0))},
            "head": {"rot": wave(0.4, (4, 0, 0), phase=0.5, base=(8, 0, 0))}}
    attack = {"body": {"rot": seq((0, 0, 0, 0), (0.2, 12, 0, 0), (0.4, -30, 0, 0), (0.7, 0, 0, 0)), "loc": seq((0, 0, 0, 0), (0.2, 0, 3, 1), (0.4, 0, 0, -4), (0.7, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.3, 10, 0, 0), (0.42, -40, 0, 0), (0.7, 0, 0, 0))},
              "wing-l": {"rot": seq((0, 0, 0, 0), (0.2, 0, 0, -70), (0.4, 0, 0, -20), (0.7, 0, 0, 0))},
              "wing-r": {"rot": seq((0, 0, 0, 0), (0.2, 0, 0, 70), (0.4, 0, 0, 20), (0.7, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.1, 20, 0, 10), (0.45, 0, 0, 0)), "loc": seq((0, 0, 0, 0), (0.1, 0, 1, 2), (0.45, 0, 0, 0))},
           "wing-l": {"rot": seq((0, 0, 0, 0), (0.1, 0, 0, -45), (0.45, 0, 0, 0))}, "wing-r": {"rot": seq((0, 0, 0, 0), (0.1, 0, 0, 45), (0.45, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.2, 0, 0, 20), (0.6, 0, 0, 170), (0.8, 0, 0, 180)), "loc": seq((0, 0, 0, 0), (0.3, 0, 6, 0), (0.6, 0, 11, 0), (0.8, 0, 11, 0))},
             "wing-l": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, -60))}, "wing-r": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, 60))}}
    return make("creatures", "crow", "Carrion Crow", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-body", (CX, 7.0, 13.0), parent="body")])
