"""Mutant cow, in the Pirate Nation creature style.

A huge irradiated cow: a long, low, heavy barrel body on short thick legs,
a long head held low under the back line, wide horns that curve out, up
and forward, a dewlap, an udder and a rope tail. Cream hide with large
black cow patches, pink bald mange, bare ribs and hip bones. The mutation
is the accent: a third eye that glows teal and a cluster of teal boils on
the right flank. Body, head, horns and legs are true-slope frusta; spots,
ribs and face are paint. Clips: idle (graze nod, tail swish), move (walk),
attack (rears the head and rocks
back, then charges into a head-down horn butt), hit, death (a bellow, staggers on failing legs, then keels over and slams onto its side, staged like the mutant dog's). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import _beast_falls as react
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import hide, patches, pustules, tube
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
    # attack: rear the head up and rock back onto the hind legs (f0-11),
    # charge 3 frames into a head-down horn butt (impact f14, fastest on the
    # last frame): the front legs stride out and plant on the impact, the
    # body drives on past contact (f16) as the hind legs push off and step up behind it
    # while the head keeps grinding. Then it backs off one leg at a time,
    # past the spot (f31), and settles; the tail lashes a beat behind. The
    # leg angles are solved in build() so planted hooves never slide.
    f = 1 / 30
    imp = 14 * f
    attack = {"head": {"rot": seq((0, 0, 0, 0), (9 * f, 22, 0, 0), (12 * f, 26, 0, 0), (imp, -26, 0, 0), (16 * f, -34, 0, 4), (18 * f, -28, 0, -4), (21 * f, -32, 0, 3), (28 * f, 0, 0, 0), (32 * f, 3, 0, 0), (36 * f, 0, 0, 0))},
              "mutant-cow": {"loc": seq((0, 0, 0, 0), (9 * f, 0, 2.0, 5), (12 * f, 0, 2.2, 6), (13 * f, 0, 1.6, -2), (imp, 0, 1.0, -10), (16 * f, 0, 1.6, -11.5), (21 * f, 0, 1.2, -10.5), (26 * f, 0, 0.8, -5), (31 * f, 0, 0, 0.9), (36 * f, 0, 0, 0)),
                             "rot": seq((0, 0, 0, 0), (9 * f, 5, 0, 0), (12 * f, 6, 0, 0), (imp, -1, 0, 0), (16 * f, -1.5, 0, 0), (21 * f, -0.8, 0, 0), (27 * f, 0, 0, 0), (31 * f, 0.4, 0, 0), (36 * f, 0, 0, 0))},
              "tail": {"rot": seq((0, 0, 0, 0), (10 * f, -30, 0, 0), (15 * f, 35, 0, 10), (18 * f, 25, 0, -10), (24 * f, -10, 0, 4), (30 * f, 12, 0, -6), (36 * f, 0, 0, 0))}}
    R = "mutant-cow"
    hit = {R: react.body2(push=2.4, pop=1.6, lean=1.5, side=0.6, slow=1.3, over=0.6, past=3),
           "head": {"rot": react.lag((18, -12, 0), slow=1.3)},
           "tail": {"rot": react.lag((-30, 0, 14), slow=1.3, delay=2)}}
    for name in LEGS:
        hit[name] = {"rot": react.lag((-8 if "front" in name else 6, 0, 0), slow=1.3, delay=0)}
    # death, staged like mutant-dog's and scaled up for the bigger, heavier
    # body: a bellow throws the head up and back (f6) and the blow shoves it
    # back, it staggers and wobbles on failing legs (f10-15), then the legs
    # go and the whole barrel keels over onto its left side, gathering speed
    # into the thud (impact f23, fastest at contact; the udder would hold a
    # belly flop up, so it goes over). The body squashes hard, bounces once
    # and settles; the stiff legs stick out sideways and flop a beat late (the
    # under-side pair kicked up off the floor so the barrel lies on it),
    # the tail flops and the big horned head slams down last.
    dimp = 23 * f
    END = 46
    fall = [((16 + k) * f, (-3, 0, 6 + 76 * ((k + 1) / 8) ** 2)) for k in range(7)]  # gravity: fastest into the floor
    death = {R: {"loc": seq((0, 0, 0, 0), (6 * f, 0, 0, 3.6), (10 * f, -1.8, 0, 3.6), (15 * f, 1.2, 0, 3.6), (dimp, 0, 0, 3.6), (END * f, 0, 0, 3.6)),
                 "rot": seq((0, 0, 0, 0), (6 * f, 0, 0, 0), (10 * f, 0, 5, -8), (15 * f, -3, -4, 6), *[(t, *v) for t, v in fall], (dimp, -3, 0, 82),
                            (25 * f, -3, 0, 78.5), (27 * f, -3, 0, 80.5), (29 * f, -3, 0, 80), (END * f, -3, 0, 80)),
                 # on its side the root's x is world up: the thud squashes along it
                 "scale": seq((0, 1, 1, 1), (6 * f, 1.03, 0.97, 1), (15 * f, 1, 1, 1), (22 * f, 1, 1, 1), (dimp, 0.84, 1.06, 1.05), (26 * f, 1.04, 0.98, 0.99), (29 * f, 0.99, 1.0, 1.0), (32 * f, 1, 1, 1), (END * f, 1, 1, 1))},
             "head": {"rot": seq((0, 0, 0, 0), (6 * f, 26, -8, 0), (10 * f, 10, 6, 0), (15 * f, 2, -6, 0), (dimp, 6, 4, -24), (26 * f, -8, 2, -34), (29 * f, -4, 2, -30), (32 * f, -6, 2, -32), (END * f, -6, 2, -32))},
             "tail": {"rot": seq((0, 0, 0, 0), (6 * f, -20, 0, 15), (10 * f, -15, 0, -15), (dimp, -32, 0, 0), (27 * f, -6, 0, 12), (31 * f, -16, 0, 8), (35 * f, -12, 0, 10), (END * f, -12, 0, 10))}}
    for name in LEGS:
        s = -1 if name[-1] == "l" else 1
        fx_ = 24 if "front" in name else -24  # front legs splay forward, back legs back
        late = 1 if s > 0 else 0
        death[name] = {"rot": seq((0, 0, 0, 0), (6 * f, -fx_ * 0.3, 0, 0), (10 * f, 0, 0, s * 8), (15 * f, fx_ * 0.3, 0, -s * 6), (dimp, fx_ * 0.8, 0, 4 + 6 * (s < 0)),
                                  ((25 + late) * f, fx_ * 1.15, 0, -10 + 22 * (s < 0)), ((28 + late) * f, fx_, 0, -5 + 17 * (s < 0)), ((31 + late) * f, fx_, 0, -7 + 19 * (s < 0)), (END * f, fx_, 0, -7 + 19 * (s < 0)))}
    return make("creatures", "mutant-cow", "Mutant Cow", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-horns", (CX, 31, 4), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-horns", "clip:attack", size=12, at=imp)])


def build():
    # Every frame of the one-shots sits on the floor (nothing sinks or
    # floats); the hit's pop and the death's bounce are keyed lifts.
    a = _build()
    atk = {"leg-front-l": [(11, 14, -14, 3), (21, 26, 0, 2.5)], "leg-front-r": [(11, 14, -13, 3), (26, 31, 0, 2.5)],
                                  "leg-back-l": [(13, 17, -9, 2), (29, 34, 0, 2)], "leg-back-r": [(14, 18, -9, 2), (24, 29, 0, 2)]}
    react.step_legs(a, "attack", atk)
    react.track_floor(a, "attack")
    react.pin_feet(a, "attack", atk)
    # The hit's feet fly back with the body, land with it and stay planted,
    # then step home with a lift as it sways forward past the spot.
    hits = react.hit_steps(2.4, ['leg-front-l', 'leg-front-r'], ['leg-back-r', 'leg-back-l'], slow=1.3, lift=1.5, hind_lift=0.4)
    react.step_legs(a, "hit", hits, kick=True)
    react.track_floor(a, "hit", air=react.arc(0.9, 4, 4), kick=True)
    react.pin_feet(a, "hit", hits)
    react.track_floor(a, "death", air=react.arc(1.4, 2, 2, start=23))
    return a
