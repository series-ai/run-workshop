"""Mutant cow, in the Pirate Nation creature style.

A huge irradiated cow: a long, low, heavy barrel body on short thick legs,
a long head held low under the back line, wide horns that curve out, up
and forward, a dewlap, an udder and a rope tail. Cream hide with large
black cow patches, pink bald mange, bare ribs and hip bones. The mutation
is the accent: a third eye that glows teal and a cluster of teal boils on
the right flank. Body, head, horns and legs are true-slope frusta; spots,
ribs and face are paint. Clips: idle (graze nod, tail swish), move (walk),
attack (head-down horn butt), hit, death (falls on its side). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import ground, hide, patches, pustules, tube
from voxgrid import C, Clip, Grid

SIZE = (66, 50, 82)
CX = 33.0
ORIGIN = (CX, 0.0, 38.0)
HIDE = ("skin", 6)
SPOT = ("gray", 2)
PINK = ("pink", 6)
NECK = (CX, 25.0, 11.0)
TAIL = (CX, 36.0, 67.0)
# Leg joints (x, y, z) and whether the leg is a hind leg.
LEGS = {"leg-front-l": (CX - 11, 22.0, 24.0, False), "leg-front-r": (CX + 11, 22.0, 24.0, False),
        "leg-back-l": (CX - 11, 22.0, 55.0, True), "leg-back-r": (CX + 11, 22.0, 55.0, True)}


def cow_spots(g, m, seed: int) -> None:
    """Black cow patches, big and few, on both flanks and the back."""
    patches(g, m, [(CX - 16, 28, 30, 7), (CX - 15, 22, 47, 6), (CX + 16, 31, 40, 8), (CX + 14, 23, 60, 5),
                   (CX - 4, 39, 52, 6), (CX + 6, 39, 26, 5), (CX - 13, 32, 62, 4)], *SPOT, seed=seed)


def body() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # The barrel: four frusta from the chest to the rump (true slopes all round).
    m = tube(g, "z", (CX, 28, 11.5, 10), (CX, 27, 16.5, 13.5), 14, 24, *HIDE)
    m |= tube(g, "z", (CX, 27, 16.5, 13.5), (CX, 25.5, 18.5, 14.5), 24, 50, *HIDE)
    m |= tube(g, "z", (CX, 25.5, 18.5, 14.5), (CX, 27.5, 15.5, 12), 50, 64, *HIDE)
    m |= tube(g, "z", (CX, 27.5, 15.5, 12), (CX, 28.5, 10, 8), 64, 69, *HIDE)
    # A thick neck that drops forward to the low head.
    neck = tube(g, "z", (CX, 25, 7, 7.5), (CX, 30, 9.5, 9.5), 8, 21, *HIDE)
    dewlap = side(g, [(19, 9), (22, 20), (12, 15)], CX - 3, CX + 3, *HIDE)
    hide(g, m | neck | dewlap, *HIDE, seed=1, cell=6, light=False)
    P.flat(g, (m | neck | dewlap) & (Y < 15), "skin", 7)  # a pale belly
    cow_spots(g, m | neck, seed=2)
    P.flat(g, neck & (Y > 32), *SPOT)  # a dark mane line on the neck
    # Pink bald mange with a darker rim.
    mange = patches(g, m, [(CX - 18, 24, 38, 3.5), (CX + 3, 40, 36, 3)], *PINK, seed=3)
    P.outline(g, mange, "pink", 5)
    # Bony hip points stick up at the rump.
    for s in (-1, 1):
        hip = limb(g, (CX + s * 9, 36, 58), (CX + s * 10, 41.5, 59), 3.0, 0.8, "bone", 5, n=4)
        P.flat(g, hip & (Y > 40), "bone", 7)
    # The udder between the hind legs, with four teats.
    udder = tube(g, "y", (CX, 49, 4.5, 4), (CX, 49, 6, 5), 7, 13, *PINK)
    P.flat(g, udder & (Y < 9), "pink", 5)
    for dx, dz in ((-2.5, -2), (2.5, -2), (-2.5, 2), (2.5, 2)):
        limb(g, (CX + dx, 7.5, 49 + dz), (CX + dx, 4.5, 49 + dz), 0.9, 0.7, "pink", 5, n=4)
    # Mutation: teal boils on the right flank.
    pustules(g, [(CX + 18.4, 28, 45), (CX + 18.4, 23, 49), (CX + 18.2, 31, 51), (CX + 18.0, 25.5, 54)], normal=(1, 0, 0), r=1.7)
    return g


def head() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    skull = tube(g, "z", (CX, 23, 8.5, 8), (CX, 25, 9, 8.5), 3, 13, *SPOT)
    muzzle = tube(g, "z", (CX, 17, 7, 5), (CX, 18, 7.5, 6), 0, 5, *PINK)
    P.flat(g, skull, SPOT[0], SPOT[1] + 1)
    P.flat(g, skull & (Y > 29), *SPOT)
    P.outline(g, skull, SPOT[0], SPOT[1] - 1, normal="z")
    # A cream blaze down the face and cream cheeks.
    P.flat(g, skull & (np.abs(X - CX) < 2.2) & (Z < 6), "bone", 7)
    P.flat(g, skull & (np.abs(X - CX) > 6.5) & (Y < 21), *HIDE)
    # The wet pink nose pad, two nostrils and a dark mouth line.
    P.flat(g, muzzle & (Z < 1), "pink", 5)
    for s in (-1, 1):
        P.flat(g, muzzle & (np.hypot(X - CX - s * 2.6, Y - 19) < 1.2) & (Z < 1), "red", 2)
    P.flat(g, muzzle & (np.abs(Y - 14.5) < 0.6), "red", 3)
    # Two dull eyes with red rims and the third eye that glows teal.
    legend = {"o": C("red", 4), "e": C("iron", 2), "w": C("bone", 7), "t": C("teal", 4), "T": C("teal", 7), "p": C("iron", 1)}
    rows = [".....ttt.....",
            ".oo.tTTTt.oo.",
            "oewotTpTtoweo",
            "oeeo.tTt.oeeo",
            ".oo...t...oo."]
    G.stamp(g, "-z", 3, int(CX - 6.5), 23, rows, legend, depth=2)
    # Wide horns: out to the sides, then up and forward (true slopes).
    for s in (-1, 1):
        h = limb(g, (CX + s * 5.5, 29, 9), (CX + s * 15, 30.5, 8), 2.7, 2.1, "bone", 5, n=6)
        h |= limb(g, (CX + s * 14, 30.2, 8.2), (CX + s * 21, 34.5, 6), 2.2, 1.5, "bone", 5, n=6)
        h |= limb(g, (CX + s * 21, 33.5, 6.2), (CX + s * 23, 41, 2.5), 1.6, 0.2, "bone", 6, n=6)
        P.flat(g, h & (np.abs(X - CX) < 9), "bone", 4)  # a dark horn base
        P.flat(g, h & (Y > 38), "bone", 7)
        # Floppy ears under the horns, pink inside.
        ear = front(g, [(CX + s * 8, 24.5), (CX + s * 8, 28), (CX + s * 14.5, 25)], 9, 11, *SPOT)
        P.flat(g, ear & (Z < 9.8) & (np.abs(X - CX) > 8) & (Y > 25) & (Y < 27), "pink", 5)
    # A curly cream forelock between the horns.
    lock = side(g, [(29, 4), (32.5, 6), (31.5, 11), (29, 12)], CX - 3.5, CX + 3.5, *HIDE)
    P.flat(g, lock & (np.floor(Z) % 2 == 0), "bone", 5)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    x, y, z, hind = LEGS[name]
    if hind:  # a heavy thigh and a hock that angles back
        up = limb(g, (x, y, z), (x, 12, z + 3), 5.4, 3.5, *HIDE, n=6)
        low = limb(g, (x, 12.5, z + 3), (x, 4, z + 1), 3.3, 2.9, *HIDE, n=6)
        zf = z + 1
    else:
        up = limb(g, (x, y, z), (x, 9.5, z - 0.5), 4.8, 3.4, *HIDE, n=6)
        low = limb(g, (x, 10, z - 0.5), (x, 4, z), 3.3, 2.9, *HIDE, n=6)
        zf = z
    hide(g, up | low, *HIDE, seed=5, cell=5, light=False)
    dark = name in ("leg-front-r", "leg-back-l")
    P.flat(g, low, *(SPOT if dark else ("bone", 7)))  # black or white socks
    if dark:
        P.flat(g, up & (Y > 18), *SPOT)
    hoof = side(g, [(0, zf - 4.2), (0, zf + 2.8), (4.5, zf + 2.2), (4.5, zf - 3.2)], x - 3.4, x + 3.4, "iron", 3)
    P.flat(g, hoof & (np.abs(X - x) < 0.6), "iron", 2)  # the cloven split
    P.flat(g, hoof & (Y > 3.5), "iron", 4)
    return g


def tail() -> Grid:
    g = Grid(*SIZE)
    tx, ty, tz = TAIL
    limb(g, (tx, ty, tz), (tx, ty - 9, tz + 4), 1.4, 1.2, *HIDE, n=4)
    limb(g, (tx, ty - 8.5, tz + 4), (tx, ty - 22, tz + 5), 1.2, 1.1, *HIDE, n=4)
    tuft = limb(g, (tx, ty - 20.5, tz + 5), (tx, ty - 27.5, tz + 5.5), 2.3, 0.8, *SPOT, n=6)
    P.flat(g, tuft & (ctr(g)[1] < ty - 25), SPOT[0], SPOT[1] + 1)
    return g


def _build():
    rig = Rig("mutant-cow", ORIGIN, body())
    rig.add("head", head(), NECK)
    rig.add("tail", tail(), TAIL)
    for name in LEGS:
        rig.add(name, leg(name), LEGS[name][:3])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.8, -6, 0, 0), (1.2, -6, 3, 0), (1.6, 0, 0, 0), (2.4, 0, 0, 0))},
            "tail": {"rot": wave(2.4, (0, 0, 14))}}
    walk = 1.0
    move = {"leg-front-l": {"rot": wave(walk, (16, 0, 0))}, "leg-back-r": {"rot": wave(walk, (16, 0, 0))},
            "leg-front-r": {"rot": wave(walk, (-16, 0, 0))}, "leg-back-l": {"rot": wave(walk, (-16, 0, 0))},
            "head": {"rot": wave(walk, (4, 0, 0), double=True)}, "tail": {"rot": wave(walk, (0, 0, 10))}}
    attack = {"head": {"rot": seq((0, 0, 0, 0), (0.25, -16, 0, 0), (0.5, 18, 0, 0), (0.9, 0, 0, 0))},
              "mutant-cow": {"loc": seq((0, 0, 0, 0), (0.25, 0, 0, 2), (0.5, 0, 0, -6), (0.9, 0, 0, 0))},
              "leg-front-l": {"rot": seq((0, 0, 0, 0), (0.25, -10, 0, 0), (0.5, 12, 0, 0), (0.9, 0, 0, 0))},
              "leg-front-r": {"rot": seq((0, 0, 0, 0), (0.25, -10, 0, 0), (0.5, 12, 0, 0), (0.9, 0, 0, 0))}}
    hit = {"head": {"rot": seq((0, 0, 0, 0), (0.1, 12, -10, 0), (0.55, 0, 0, 0))},
           "mutant-cow": {"loc": seq((0, 0, 0, 0), (0.1, 0, 0, 2.5), (0.55, 0, 0, 0))},
           "tail": {"rot": seq((0, 0, 0, 0), (0.1, 25, 0, 0), (0.55, 0, 0, 0))}}
    death = {"mutant-cow": {"rot": seq((0, 0, 0, 0), (0.5, 0, 0, 24), (1.2, 0, 0, 84))},
             "head": {"rot": seq((0, 0, 0, 0), (0.6, 0, 0, -20), (1.2, 0, 0, -40))},
             "leg-front-l": {"rot": seq((0, 0, 0, 0), (1.2, 18, 0, 0))}, "leg-back-l": {"rot": seq((0, 0, 0, 0), (1.2, -18, 0, 0))}}
    return make("creatures", "mutant-cow", "Mutant Cow", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-horns", (CX, 31, 4), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-horns", "clip:attack", size=12)])


def build():
    return ground(_build())
