"""Rad rat, in the Pirate Nation creature style.

An oversized irradiated sewer rat, a chunky caricature: a fat pear body
(true slopes) in patchy grey fur, a big head with a pointed snout, round
pink ears, two glowing green eyes and two huge buck teeth, glowing lime
tumour lumps on its back, pink paws and a long pink tail that curls up.
Fur, mange and whiskers are paint. Clips: idle (sniff), move (scurry),
attack (crouches back, darts in
and holds a double snap), hit, death (kicked back off its feet, rolls onto its side). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _beast_falls as react
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


def _build():
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
    # attack: crouch back with the head reared and the mouth up (f0-9),
    # then dart into the bite (impact f11, fastest on the last frame): the
    # body lunges 5 voxels while the head thrusts out of the shoulders
    # (as far as it can without parting from the body) and snaps down level
    # at bite height. The front paws reach and plant on the bite and the
    # hind paws push off with a lift and land
    # behind. It worries the bite with a second snap (f14), then scuttles
    # back one paw at a time, past the spot (f24), and settles. Leg angles
    # are solved in build() so planted paws never slide.
    f = 1 / 30
    imp = 11 * f
    R = rig.root.name
    attack = {R: {"loc": seq((0, 0, 0, 0), (6 * f, 0, 0, 1.4), (8 * f, 0, 0, 1.6), (10 * f, 0, 0, -1.2), (imp, 0, 0, -5.0), (13 * f, 0, 0, -5.8), (17 * f, 0, 0, -5.3), (24 * f, 0, 0, 0.4), (29 * f, 0, 0, 0))},
              "body": {"rot": seq((0, 0, 0, 0), (6 * f, 10, 0, 0), (8 * f, 12, 0, 0), (imp, -3, 0, 0), (13 * f, -4, 0, 0), (17 * f, -3, 0, 0), (24 * f, 2, 0, 0), (29 * f, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (7 * f, 16, 0, 0), (9 * f, 20, 0, 0), (imp, -5, 0, 0), (12 * f, -2, 0, 0), (13 * f, 8, 0, 0), (14 * f, 16, 0, 0), (15 * f, -6, 0, 0), (17 * f, -1, 0, 0), (25 * f, 5, 0, 0), (29 * f, 0, 0, 0)),
                       "loc": seq((0, 0, 0, 0), (9 * f, 0, 0, 0.5), (imp, 0, 0.2, -1.3), (13 * f, 0, 0.2, -1.5), (17 * f, 0, 0.1, -1.2), (22 * f, 0, 0, -0.3), (27 * f, 0, 0, 0))},
              "tail": {"rot": seq((0, 0, 0, 0), (7 * f, -25, 15, 0), (imp, 10, -10, 0), (14 * f, 25, -20, 0), (18 * f, -5, 12, 0), (22 * f, 4, -5, 0), (26 * f, 8, 4, 0), (29 * f, 0, 0, 0))}}
    hit = {R: react.body2(push=2.0, pop=1.0, lean=8, side=0.6, over=0.6, past=7),
           "head": {"rot": react.lag((24, 10, 0))},
           "tail": {"rot": react.lag((-25, 18, 0), delay=2)}}
    for name in LEGS:
        hit[name] = {"rot": react.lag((-14 if name[-2] == "f" else 10, 0, 0), delay=0)}
    # death: a blow to the face kicks it back off its feet on frames 0-2,
    # nose thrown up, head whipped back, the paws flung forward; it flies
    # back on a short gravity arc, rolling over onto its side in the air,
    # and slams down flat on its side (impact f7, the fastest frame, a
    # 1-frame squash). Head and tail slap down a frame later and everything
    # stops dead: no bounce, no jiggle. 0.53 s.
    dimp = 7 * f
    death = {R: {"loc": seq((0, 0, 0, 0), (2 * f, 0, 0, 2.6), (4 * f, -0.2, 0, 4.2), (dimp, -0.5, 0, 5.8), (16 * f, -0.5, 0, 5.8)),
                 "rot": seq((0, 0, 0, 0), (2 * f, 30, 0, 12), (4 * f, 26, 0, 34), (dimp, 0, 0, 92), (9 * f, 0, 0, 90), (16 * f, 0, 0, 90))},
             "body": {"scale": seq((0, 1, 1, 1), (6 * f, 1, 1, 1), (dimp, 0.88, 1.04, 1.04), (9 * f, 1, 1, 1), (16 * f, 1, 1, 1))},
             "head": {"rot": seq((0, 0, 0, 0), (2 * f, 30, 0, 0), (4 * f, 34, 0, 0), (dimp, 16, 0, 0), (9 * f, -6, 0, 10), (16 * f, -6, 0, 10))},
             "tail": {"rot": seq((0, 0, 0, 0), (2 * f, -30, 0, 0), (5 * f, -20, 14, 0), (dimp, 10, 0, 0), (9 * f, 22, -10, 0), (16 * f, 22, -10, 0))}}
    for name in LEGS:
        s = -1 if name[-1] == "l" else 1
        fr = name[-2] == "f"
        late = 1 if s > 0 else 0
        out = 40 if fr else -30  # stiff on landing: front paws forward, hind paws back
        death[name] = {"rot": seq((0, 0, 0, 0), (2 * f, 30 if fr else 22, 0, 0), (5 * f, 36 if fr else 10, 0, s * 10), (dimp, out * 0.8, 0, s * 14), ((9 + late) * f, out, 0, s * 18), (16 * f, out, 0, s * 18))}
    return make("creatures", "rad-rat", "Rad Rat", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-body", (CX, 8.0, 13.0), parent="body")])


def build():
    # Every frame of the one-shots sits on the floor (nothing sinks or
    # floats); the hit's pop and the death's bounce are keyed lifts.
    a = _build()
    atk = {"leg-fl": [(8, 11, -6.5, 1.5), (16, 20, 0, 1.2)], "leg-fr": [(8, 11, -6.5, 1.5), (20, 24, 0, 1.2)],
           "leg-bl": [(9, 13, -5, 2.4), (22, 26, 0, 1.2)], "leg-br": [(9, 13, -5, 2.4), (18, 22, 0, 1.2)]}
    react.step_legs(a, "attack", atk)
    # All four paws leave the floor for a frame as it darts in.
    react.track_floor(a, "attack", air=react.arc(0.9, 1, 1, start=9))
    react.pin_feet(a, "attack", atk)
    # The hit's feet fly back with the body, land with it and stay planted,
    # then step home with a lift as it sways forward past the spot.
    hits = react.hit_steps(2.0, ["leg-fl", "leg-fr"], ["leg-br", "leg-bl"], slow=1.0, lift=1.6)
    react.step_legs(a, "hit", hits, kick=True)
    react.track_floor(a, "hit", air=react.arc(1.0, 4, 4), kick=True)
    react.pin_feet(a, "hit", hits)
    # kicked off the floor on a gravity arc that lands on the impact (f7);
    # every other frame of the death sits on the floor, on its side
    react.track_floor(a, "death", air=react.arc(1.6, 3, 4), kick=True)
    return a
