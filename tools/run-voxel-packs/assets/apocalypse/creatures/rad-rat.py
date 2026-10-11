"""Rad rat, in the Pirate Nation creature style.

An oversized irradiated sewer rat, a chunky caricature: a fat pear body
(true slopes) in patchy grey fur, a big head with a pointed snout, round
pink ears, two glowing green eyes and two huge buck teeth, glowing lime
tumour lumps on its back, pink paws and a long pink tail that curls up.
Fur, mange and whiskers are paint. Clips: idle (sniff), move (scurry),
attack (snapping lunge), hit, death (rolls over). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, bump, ctr, front, fx, limb, make, seq, side, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (16, 18, 28)
CX = 8.0
FUR = ("sand", 4)
NECK = (CX, 7.0, 8.0)
TAIL = (CX, 5.0, 19.0)
LEGS = {"leg-fl": (CX - 3.0, 4.0, 9.5), "leg-fr": (CX + 3.0, 4.0, 9.5), "leg-bl": (CX - 3.5, 4.0, 16.0), "leg-br": (CX + 3.5, 4.0, 16.0)}


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    m = side(g, [(2.5, 8), (2, 13), (2.5, 19), (6, 20), (10.5, 17), (10, 12), (8, 8.5), (5, 7)], CX - 5, CX + 5, *FUR)
    PP.fur(g, m, *FUR, stroke=3, seed=1)
    P.flat(g, m & (Y < 4), "sand", 6)  # a pale belly
    PP.blotch(g, m & (Y > 5), "pink", 4, cell=3, chance=0.025, seed=2)  # mange
    for bx, by, bz, r in ((CX - 2.5, 10.0, 13.5, 1.8), (CX + 2.0, 10.3, 16.0, 1.5)):  # glowing tumours
        bump(g, bx, bz, by - 0.5, r + 0.3, r + 0.5, "toxic", 6)
    return g


def head() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    skull = side(g, [(ny - 3.5, nz + 1), (ny + 3.5, nz + 1), (ny + 3.5, nz - 3), (ny + 1, nz - 7.5), (ny - 1.5, nz - 7.5), (ny - 3.5, nz - 4)], CX - 4, CX + 4, *FUR)
    PP.fur(g, skull, *FUR, stroke=2, seed=3)
    P.flat(g, skull & (Z < nz - 6.5), "pink", 4)  # the nose tip
    for s in (-1, 1):  # round pink ears
        ear = S.disc(g, "z", CX + s * 3.8, ny + 4.5, 2.4, nz - 0.5, nz + 0.5, "pink", 4, n=8)
        P.flat(g, ear & (np.hypot(X - CX - s * 3.8, Y - ny - 4.5) < 1.3), "pink", 3)
    for s in (-1, 1):  # bulging glowing eyes (little faceted domes)
        eye = S.disc(g, "z", CX + s * 2.5, ny + 2.5, 1.6, nz - 5.5, nz - 3.0, "toxic", 6, n=6)
        P.flat(g, eye & (np.hypot(X - CX - s * 2.5, Y - ny - 2.5) < 0.9), "navy", 4)
    # two huge buck teeth under the snout
    for dx in (-2.0, 0.2):
        t = box(g, CX + dx, ny - 5, nz - 7.5, CX + dx + 1.8, ny - 1.5, nz - 6, "bone", 7)
        P.flat(g, t & (ctr(g)[1] < ny - 4), "bone", 5)
    for s in (-1, 1):  # whiskers
        P.flat(g, skull & (np.abs(Y - (ny - 0.5)) < 0.5) & (np.abs(np.abs(X - CX) - 3.5) < 0.6) & (Z < nz - 4), "bone", 7)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SZ)
    hx, hy, hz = LEGS[name]
    limb(g, (hx, hy, hz), (hx, 1.2, hz - 0.5), 1.1, 1.0, *FUR, n=4)
    paw = box(g, hx - 1.5, 0, hz - 2.5, hx + 1.5, 1.5, hz + 0.5, "pink", 4)
    del paw
    return g


def tail() -> Grid:
    g = Grid(*SZ)
    tx, ty, tz = TAIL
    m = limb(g, (tx, ty, tz), (tx, ty + 2, tz + 3), 1.1, 0.9, "pink", 4, n=4)
    m |= limb(g, (tx, ty + 2, tz + 3), (tx, ty + 7, tz + 3.8), 0.9, 0.7, "pink", 4, n=4)
    m |= limb(g, (tx, ty + 7, tz + 3.8), (tx, ty + 10, tz + 1.5), 0.7, 0.5, "pink", 4, n=4)
    P.flat(g, m & ((np.floor(ctr(g)[1]) % 3) == 0), "pink", 3)
    return g


def build():
    rig = Rig("rad-rat", (CX, 0, 13.0))
    rig.add("body", body(), (CX, 5.0, 13.0))
    rig.add("head", head(), NECK, parent="body")
    rig.add("tail", tail(), TAIL, parent="body")
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.15, -6, 4, 0), (0.3, 0, 0, 0), (0.45, -6, -4, 0), (0.6, 0, 0, 0), (1.6, 0, 0, 0))},
            "tail": {"rot": wave(1.6, (0, 12, 6))}, "body": {"scale": wave(0.8, (0.03, 0.04, 0), base=(1, 1, 1))}}
    sc = 0.36
    move = {"leg-fl": {"rot": wave(sc, (40, 0, 0))}, "leg-fr": {"rot": wave(sc, (-40, 0, 0))},
            "leg-bl": {"rot": wave(sc, (-40, 0, 0))}, "leg-br": {"rot": wave(sc, (40, 0, 0))},
            "body": {"loc": wave(sc, (0, 0.5, 0), double=True), "rot": wave(sc, (0, 5, 0))},
            "tail": {"rot": wave(sc, (0, 18, 0), phase=1.0)}, "head": {"rot": wave(sc, (5, 0, 0), phase=0.6)}}
    attack = {"body": {"loc": seq((0, 0, 0, 0), (0.15, 0, 0, 1.5), (0.3, 0, 1, -4), (0.6, 0, 0, 0)), "rot": seq((0, 0, 0, 0), (0.15, 8, 0, 0), (0.3, -12, 0, 0), (0.6, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.18, 22, 0, 0), (0.3, -14, 0, 0), (0.4, 8, 0, 0), (0.6, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.1, 10, 0, 10), (0.4, 0, 0, 0)), "loc": seq((0, 0, 0, 0), (0.1, 0, 0, 1.5), (0.4, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.25, 0, 0, -15), (0.6, 0, 0, 175), (0.8, 0, 0, 168), (1.0, 0, 0, 172)), "loc": seq((0, 0, 0, 0), (0.6, 0, 11, 0), (1.0, 0, 10, 0))},
             "leg-fl": {"rot": seq((0, 0, 0, 0), (0.6, 30, 0, 0))}, "leg-br": {"rot": seq((0, 0, 0, 0), (0.6, -30, 0, 0))}}
    return make("creatures", "rad-rat", "Rad Rat", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-body", (CX, 8.0, 13.0), parent="body")])
