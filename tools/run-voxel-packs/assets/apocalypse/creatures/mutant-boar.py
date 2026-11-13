"""Mutant boar, in the Pirate Nation creature style.

A compact, front-heavy wasteland boar: a tall humped shoulder that slopes
down to a small rump, a ridge of black bristles along the spine, a big
wedge head with a flat pink snout, up-curved bone tusks and short stout
legs. Bristle-brown fur is paint. Scrap armour is two riveted rust plates
strapped over the shoulders. The mutation is the accent: small teal eyes
that glow and teal boils on the left haunch. Clips: idle (snuffle), move
(trot), attack (head-down tusk rip), hit, death (falls on its side).
Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import face_spot, ground, pustules, rust_plate, tube
from voxgrid import Clip, Grid

SIZE = (52, 42, 52)
CX = 26.0
ORIGIN = (CX, 0.0, 23.0)
FUR = ("skindark", 4)
NECK = (CX, 20.0, 12.0)
LEGS = {"front-l": (CX - 6.5, 14.0, 15.0, False), "front-r": (CX + 6.5, 14.0, 15.0, False),
        "rear-l": (CX - 6.5, 14.0, 33.0, True), "rear-r": (CX + 6.5, 14.0, 33.0, True)}


def fur(g, m, base=FUR[1], seed=0) -> None:
    PP.fur(g, m, FUR[0], base, stroke=4, seed=seed)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # A humped wedge: tall at the shoulder, low at the rump (true slopes).
    m = tube(g, "z", (CX, 19.5, 8, 9), (CX, 20.5, 10.5, 10.5), 10, 18, *FUR)
    m |= tube(g, "z", (CX, 20.5, 10.5, 10.5), (CX, 18.5, 9, 8), 18, 36, *FUR)
    m |= tube(g, "z", (CX, 18.5, 9, 8), (CX, 18.5, 5.5, 5.5), 36, 41, *FUR)
    fur(g, m, seed=1)
    P.flat(g, m & (Y > 27), FUR[0], FUR[1] - 1)  # a darker back
    fur(g, m & (Y < 13), 5, seed=2)  # a paler belly
    # The bristle ridge: a saw-tooth crest down the spine.
    crest = side(g, [(26.5, 10), (29, 10), (34, 11.5), (30.5, 14), (35, 16), (31.5, 18), (34.5, 20.5), (31, 23), (33.5, 25.5),
                     (29.5, 28), (31, 30.5), (28, 33), (26.5, 33)], CX - 1.8, CX + 1.8, "darkwood", 4)
    P.flat(g, crest & (Y > 32), "darkwood", 6)
    # Scrap armour: two riveted rust plates strapped over the shoulders.
    for s in (-1, 1):
        rust_plate(g, "z", CX + s * 7, 28.5, 9, 2.2, 14, 24, s * -32, seed=3 + s)
    strap = m & (Z >= 21) & (Z < 23)
    P.flat(g, strap, "darkwood", 3)
    P.flat(g, strap & (np.abs(Y - 12.5) < 1.1), "steel", 6)  # the buckle
    # A pale old scar across the right flank.
    P.flat(g, m & (X > CX + 7) & (np.abs((Y - 19) - (Z - 28) * 0.6) < 0.7) & (Z > 24) & (Z < 33), "skindark", 7)
    # Mutation: teal boils on the left haunch.
    pustules(g, [(CX - 9.4, 20, 30), (CX - 9.2, 17, 33), (CX - 8.8, 22, 34)], normal=(-1, 0, 0), r=1.3)
    # A short curly tail.
    t = limb(g, (CX, 20, 40), (CX, 23, 43), 1.1, 0.9, *FUR, n=4)
    t |= limb(g, (CX, 22.6, 42.6), (CX + 1.6, 20.5, 45), 0.9, 0.4, *FUR, n=4)
    P.flat(g, t, FUR[0], FUR[1] - 1)
    return g


def head() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    skull = tube(g, "z", (CX, 16, 5, 4.5), (CX, 20, 8, 8), 2.5, 13, *FUR)
    fur(g, skull, seed=4)
    P.flat(g, skull & (Y > 25), FUR[0], FUR[1] - 1)
    snout = tube(g, "z", (CX, 15.5, 4, 3.5), (CX, 15.5, 4.3, 3.7), 0.5, 3, "pink", 3)
    P.flat(g, snout & (Z < 1.5), "pink", 2)
    for s in (-1, 1):
        face_spot(g, snout, CX + s * 1.6, 15.5, 1.0, "red", 2, square=True)
    jaw = tube(g, "z", (CX, 11.5, 3.6, 1.8), (CX, 12, 5.6, 2.4), 2, 10.5, *FUR)
    P.flat(g, jaw, FUR[0], FUR[1] + 1)
    P.flat(g, jaw & (Y > 13.2), "red", 2)  # the dark mouth line
    # Up-curved bone tusks out of the jaw.
    for s in (-1, 1):
        tusk = limb(g, (CX + s * 4, 12.5, 4), (CX + s * 7, 16.5, 1.8), 1.5, 1.1, "bone", 6, n=6)
        tusk |= limb(g, (CX + s * 6.8, 16.1, 2), (CX + s * 6.2, 21, 1), 1.1, 0.2, "bone", 7, n=6)
        P.flat(g, tusk & (Y < 14), "bone", 4)
    # Small eyes that glow teal under a heavy dark brow.
    for s in (-1, 1):
        face_spot(g, skull, CX + s * 3.4, 22.0, 1.6, "darkwood", 3, square=True)
        face_spot(g, skull, CX + s * 3.4, 21.0, 1.0, "teal", 7, square=True)
    # Torn pointed ears that lean back.
    for s in (-1, 1):
        ear = front(g, [(CX + s * 3.2, 25.5), (CX + s * 7.6, 24.8), (CX + s * 7.2, 31.5)], 9.5, 11.5, "skindark", 3)
        P.flat(g, ear & (Z < 10.3) & (np.abs(X - CX) > 5) & (Y < 29), "pink", 4)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    x, y, z, hind = LEGS[name]
    if hind:  # a thick ham and a hock that angles back
        m = limb(g, (x, y + 1.5, z), (x, 8, z + 1.6), 3.7, 2.4, *FUR, n=6)
        m |= limb(g, (x, 8.4, z + 1.6), (x, 3, z), 2.3, 2.0, *FUR, n=6)
    else:
        m = limb(g, (x, y, z), (x, 3, z - 0.5), 3.2, 2.1, *FUR, n=6)
    fur(g, m, seed=6)
    P.flat(g, m & (Y < 6.5), FUR[0], FUR[1] - 1)
    hoof = side(g, [(0, z - 2.6), (0, z + 1.8), (3.2, z + 1.5), (3.2, z - 2)], x - 2.3, x + 2.3, "iron", 3)
    P.flat(g, hoof & (np.abs(X - x) < 0.6), "iron", 2)
    P.flat(g, hoof & (Y > 2.5), "iron", 4)
    return g


def _build():
    rig = Rig("mutant-boar", ORIGIN, body())
    rig.add("head", head(), NECK)
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name][:3])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.3, -4, 0, 0), (0.45, -2, 0, 0), (0.6, -4, 0, 0), (1.2, 0, 0, 0))}}
    trot = 0.6
    move = {"front-l": {"rot": wave(trot, (20, 0, 0))}, "rear-r": {"rot": wave(trot, (20, 0, 0))},
            "front-r": {"rot": wave(trot, (-20, 0, 0))}, "rear-l": {"rot": wave(trot, (-20, 0, 0))},
            "head": {"rot": wave(trot, (3, 0, 0), double=True)}}
    attack = {"head": {"rot": seq((0, 0, 0, 0), (0.25, -14, 0, 0), (0.5, 22, 0, -6), (0.9, 0, 0, 0))},
              "mutant-boar": {"loc": seq((0, 0, 0, 0), (0.25, 0, 0, 1.5), (0.5, 0, 0, -5), (0.9, 0, 0, 0))},
              "front-l": {"rot": seq((0, 0, 0, 0), (0.25, 14, 0, 0), (0.5, -7, 0, 0), (0.9, 0, 0, 0))}}
    hit = {"head": {"rot": seq((0, 0, 0, 0), (0.12, 14, 8, 0), (0.55, 0, 0, 0))},
           "mutant-boar": {"loc": seq((0, 0, 0, 0), (0.12, 0, 0, 2), (0.55, 0, 0, 0))}}
    death = {"mutant-boar": {"rot": seq((0, 0, 0, 0), (0.45, 0, 0, 46), (1.0, 0, 0, 80))},
             "front-l": {"rot": seq((0, 0, 0, 0), (1.0, 20, 0, 0))}, "rear-l": {"rot": seq((0, 0, 0, 0), (1.0, -20, 0, 0))}}
    return make("creatures", "mutant-boar", "Mutant Boar", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-snout", (CX, 15.5, 0.5), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-snout", "clip:attack", size=14)])


def build():
    return ground(_build())
