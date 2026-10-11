"""Mutant vulture, in the Pirate Nation creature style.

A big wasteland vulture that mantles over its prey: a hunched black-brown
body, half-spread wings on thick wing bones with ragged finger feathers,
a pale ruff, a long bald red neck and head, a hooked ivory beak with a
dark tip, feathered thighs and grey legs with dark talons. Feather rows,
wrinkles and scars are paint. The mutation is the accent: eyes that glow
teal and teal boils on the bare neck. Clips: idle (peer and shift), move
(flap and hop), attack (neck lunge and peck), hit, death (falls on its
side). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import face_spot, ground, pustules, tube
from voxgrid import Clip, Grid

SIZE = (98, 56, 62)
CX = 48.0
ORIGIN = (CX, 0.0, 34.0)
PLUME = ("darkwood", 5)
BARE = ("red", 6)
NECK = (CX, 35.0, 23.0)
SHOULDER = {"wing-l": (CX - 8, 39.0, 31.5), "wing-r": (CX + 8, 39.0, 31.5)}
HIPS = {"leg-l": (CX - 5, 22.0, 35.0), "leg-r": (CX + 5, 22.0, 35.0)}
# The wing outline (span u from the body centre, height y): the top edge
# rises to the wrist and falls to the tip; ragged primaries hang below.
WING = [(6, 38), (24, 47.5), (44, 36.5), (45.5, 30), (43, 25.5), (40.5, 30), (39, 22.5), (36.5, 28), (34.5, 20.5), (32, 26.5),
        (30, 19.5), (27.5, 25.5), (24, 21.5), (21, 25), (18, 21), (15, 24.5), (11, 23.5), (6, 27)]
WING_TOP = [(6, 38), (24, 47.5), (44, 36.5)]


def feathers(g, m, base=PLUME[1], seed=0) -> None:
    PP.fur(g, m, PLUME[0], base, stroke=4, seed=seed)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    m = tube(g, "z", (CX, 27, 8, 9), (CX, 30, 11, 11.5), 20, 30, *PLUME)
    m |= tube(g, "z", (CX, 30, 11, 11.5), (CX, 28, 9.5, 9), 30, 42, *PLUME)
    m |= tube(g, "z", (CX, 28, 9.5, 9), (CX, 25, 5, 5), 42, 50, *PLUME)
    feathers(g, m, seed=1)
    # Rows of feather scallops on the back, a paler edge on each row.
    P.flat(g, m & (Y > 33) & (np.floor(Y) % 4 == 0) & ((np.floor(X) + np.floor(Z)) % 4 != 0), "darkwood", 6)
    P.flat(g, m & (Y < 21), "darkwood", 4)
    # Ragged tail feathers that droop down at the back.
    tail = side(g, [(27, 44), (31, 47), (24.5, 55), (21, 58), (19.5, 56), (22, 52), (20, 49)], CX - 5, CX + 5, *PLUME)
    feathers(g, tail, 5, seed=2)
    P.flat(g, tail & (Z > 54), "wood", 4)
    # The pale ruff: a ring of shaggy feathers round the neck base.
    star = []
    for k in range(14):
        a = 2 * math.pi * k / 14
        r = 8.2 if k % 2 == 0 else 5.8
        star.append((CX + r * math.cos(a), 35 + r * 0.85 * math.sin(a)))
    ruff = front(g, star, 19.5, 25, "bone", 6)
    PP.fur(g, ruff, "bone", 6, stroke=3, seed=3)
    P.flat(g, ruff & (Y < 31), "bone", 5)
    return g


def head() -> Grid:
    """The bare neck, the bald head and the hooked beak, on one joint."""
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    neck = limb(g, (CX, 35, 23), (CX, 42.5, 15), 3.0, 2.6, *BARE, n=6)
    skull = tube(g, "z", (CX, 44.5, 4.4, 4.2), (CX, 44.5, 5.4, 5.2), 7.5, 17, *BARE)
    bare = neck | skull
    P.flat(g, bare & (np.floor(Y) % 3 == 0), "red", 5)  # wrinkles
    P.flat(g, skull & (Y > 48), "red", 7)
    P.flat(g, neck & (Z > 20.5), "red", 5)
    # A hooked ivory beak with a dark hook and a grey cere.
    beak = side(g, [(47.6, 8.0), (47.2, 4.0), (45.8, 1.6), (43.4, 0.5), (41.4, 1.4), (42.0, 3.0), (43.4, 2.8), (42.4, 8.0)], CX - 2, CX + 2, "bone", 6)
    P.flat(g, beak & (Z < 3.4), "iron", 3)
    P.flat(g, beak & (Z > 6.4), "gray", 4)
    P.flat(g, beak & (Y < 43.8) & (Z > 3.4), "bone", 4)  # the lower bill
    # Eyes that glow teal, under a dark brow, on both sides of the head.
    sides = skull & (np.abs(X - CX) > 2.5)
    P.flat(g, sides & (np.hypot(Y - 45.8, Z - 11) < 1.6), "teal", 7)
    P.flat(g, sides & (np.abs(Y - 47.9) < 0.6) & (np.abs(Z - 11) < 2.4), "red", 3)
    for s in (-1, 1):
        face_spot(g, skull, CX + s * 2.6, 46.2, 1.0, "teal", 6)
    # Mutation: teal boils on the bare neck.
    pustules(g, [(CX + 1.2, 42.0, 20.4), (CX - 1.3, 39.2, 22.4), (CX + 1.0, 38.0, 23.6)], normal=(0, 1, 0.9), r=1.1)
    return g


def top_edge(u):
    """The height of the wing's top edge at span u (piecewise linear)."""
    (u0, y0), (u1, y1), (u2, y2) = WING_TOP
    return np.where(u < u1, y0 + (y1 - y0) * (u - u0) / (u1 - u0), y1 + (y2 - y1) * (u - u1) / (u2 - u1))


def wing(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    s = -1 if name == "wing-l" else 1
    sx, sy, sz = SHOULDER[name]
    plate = front(g, [(CX + s * u, y) for u, y in WING], sz - 1.5, sz + 1.5, *PLUME)
    U = np.abs(X - CX)
    top = top_edge(U)
    # Flight feathers: long strips with dark seams; pale worn tips.
    P.flat(g, plate, *PLUME)
    P.flat(g, plate & (np.floor(U) % 3 == 0), "darkwood", 4)
    P.flat(g, plate & (Y < 26) & (np.floor(U) % 3 != 0), "wood", 3)
    # Coverts: a band of scallops under the top edge.
    cov = plate & (Y > top - 6.5)
    P.flat(g, cov, "darkwood", 6)
    P.flat(g, cov & ((np.floor(U) + 2 * np.floor(Y)) % 4 == 0), "darkwood", 5)
    P.flat(g, plate & (np.abs(Y - (top - 6.5)) < 0.6), "darkwood", 4)
    # Thick wing bones (4 to 5 units) along the top edge.
    bone = limb(g, (sx, sy, sz), (CX + s * 24, 46.4, sz), 2.5, 2.1, "darkwood", 6, n=6)
    bone |= limb(g, (CX + s * 23.5, 46.4, sz), (CX + s * 43.5, 36.2, sz), 2.1, 1.2, "darkwood", 6, n=6)
    feathers(g, bone, 6, seed=5 + s)
    # A pale scar across the right wing.
    if s > 0:
        P.flat(g, plate & (np.abs((Y - 33) + (U - 30) * 0.5) < 0.6) & (U > 26) & (U < 36), "bone", 5)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    x, y, z = HIPS[name]
    thigh = limb(g, (x, y + 2, z), (x, 14, z - 0.5), 3.6, 2.6, *PLUME, n=6)
    feathers(g, thigh, 5, seed=7)
    shank = limb(g, (x, 15, z - 0.5), (x, 2.5, z - 1), 1.7, 1.5, "gray", 5, n=4)
    P.flat(g, shank & (np.floor(Y) % 2 == 0), "gray", 4)  # scaly rings
    tube(g, "y", (x, z - 1.5, 2.0, 2.2), (x, z - 1.5, 1.6, 1.8), 0, 2.6, "gray", 5)  # the foot pad
    for k in (-1, 0, 1):  # three front talons and one at the back
        limb(g, (x + k * 1.4, 1.2, z - 3), (x + k * 2.6, 0.5, z - 6.5), 0.9, 0.3, "iron", 3, n=4)
    limb(g, (x, 1.2, z), (x, 0.5, z + 2.8), 0.8, 0.3, "iron", 3, n=4)
    return g


def _build():
    rig = Rig("mutant-vulture", ORIGIN, body())
    rig.add("head", head(), NECK)
    for name in SHOULDER:
        rig.add(name, wing(name), SHOULDER[name])
    for name in HIPS:
        rig.add(name, leg(name), HIPS[name])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.5, -4, 10, 0), (0.9, -4, 10, 0), (1.3, 2, -8, 0), (1.8, 2, -8, 0), (2.4, 0, 0, 0))},
            "wing-l": {"rot": wave(2.4, (0, 0, -3))}, "wing-r": {"rot": wave(2.4, (0, 0, 3))}}
    flap = 0.8
    move = {"wing-l": {"rot": wave(flap, (0, 0, -28))}, "wing-r": {"rot": wave(flap, (0, 0, 28))},
            "mutant-vulture": {"loc": seq((0, 0, 0, 0), (0.4, 0, 2.0, 0), (0.8, 0, 0, 0))},
            "head": {"rot": wave(flap, (5, 0, 0), phase=1.0)}}
    attack = {"head": {"rot": seq((0, 0, 0, 0), (0.2, 14, 0, 0), (0.42, -26, 0, 0), (0.8, 0, 0, 0))},
              "wing-l": {"rot": seq((0, 0, 0, 0), (0.2, 0, 0, 18), (0.5, 0, 0, -6), (0.8, 0, 0, 0))},
              "wing-r": {"rot": seq((0, 0, 0, 0), (0.2, 0, 0, -18), (0.5, 0, 0, 6), (0.8, 0, 0, 0))}}
    hit = {"head": {"rot": seq((0, 0, 0, 0), (0.12, 16, 12, 0), (0.5, 0, 0, 0))},
           "wing-l": {"rot": seq((0, 0, 0, 0), (0.12, 0, 0, 22), (0.5, 0, 0, 0))},
           "wing-r": {"rot": seq((0, 0, 0, 0), (0.12, 0, 0, -22), (0.5, 0, 0, 0))}}
    death = {"mutant-vulture": {"rot": seq((0, 0, 0, 0), (0.5, 0, 0, -22), (1.2, 0, 0, -75))},
             "wing-l": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, 30))},
             "wing-r": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, -30))},
             "head": {"rot": seq((0, 0, 0, 0), (1.2, -30, 0, 20))}}
    return make("creatures", "mutant-vulture", "Mutant Vulture", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-beak", (CX, 42.5, 1), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-beak", "clip:attack", size=10)])


def build():
    return ground(_build())
