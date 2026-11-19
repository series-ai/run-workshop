"""Mutant vulture, in the Pirate Nation creature style.

A big wasteland vulture that mantles over its prey: a hunched black-brown
body, half-spread wings on thick wing bones with ragged finger feathers,
a pale ruff, a long bald red neck and head, a hooked ivory beak with a
dark tip, feathered thighs and grey legs with dark talons. Feather rows,
wrinkles and scars are paint. The mutation is the accent: eyes that glow
teal and teal boils on the bare neck. Clips: idle (peer and shift), move
(flap and hop), attack (rocks back with the wings
mantled, pitches forward into a hard double peck), hit, death (struggles up, drops out of
the air and sprawls on its belly, wings spread). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import _big_falls as B
from _big_falls import F, track as T
from _life import Rig, ctr, front, fx, limb, make, seq, side, wave
from _rep_creatures import face_spot, pustules, tube
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


FOOT = (0.0, -21.0, -1.5)  # the foot pad, from the hip


def _one_shots(root):
    """Baked attack, hit and death (see _big_falls)."""
    R = root.name
    # attack: it rocks back on its feet, cocks the long neck back and
    # mantles the wings up (f0-11, still creeping at the top); then it
    # pitches forward and the neck shoots out, 2 frames into the peck
    # (impact f13, fastest at the hit). The beak drives on past it, jabs a
    # second time, the wings beat down a frame behind the strike and lift
    # again; then it rocks back upright, past rest, and settles. The feet
    # stay planted: the legs swing under the lunge.
    I = 13
    # (a 3-frame strike, f10-13, and a second jab that drives in 5 deeper)
    k = {R: {"rot": T((0, (0, 0, 0)), (8, (12, 0, 0)), (10, (14, 0, 0)), (11, (6, 0, 0)), (12, (-11, 0, 0)), (I, (-22, 0, 0), ">"), (I + 2, (-26, 0, 0)), (I + 3, (-19, 0, 0)), (I + 6, (-28, 0, 0), ">"), (I + 9, (-20, 0, 0)),
                      (I + 15, (3, 0, 0)), (I + 19, (-1, 0, 0)), (I + 23, (0, 0, 0))),
             "loc": T((0, (0, 0, 0)), (8, (0, 0, 2.5)), (10, (0, 0, 3)), (11, (0, 0, 2)), (12, (0, 0, -1.5)), (I, (0, 0, -6), ">"), (I + 2, (0, 0, -7)), (I + 3, (0, 0, -5.6)), (I + 6, (0, 0, -7.5), ">"), (I + 9, (0, 0, -6)),
                      (I + 15, (0, 0, 0.4)), (I + 19, (0, 0, 0)))},
         "head": {"rot": T((0, (0, 0, 0)), (8, (30, 0, 0)), (10, (35, 0, 0)), (11, (14, 0, 0)), (12, (-20, 0, 0)), (I, (-36, 0, 0), ">"), (I + 2, (-46, 0, 0)), (I + 3, (-34, 0, 0)), (I + 6, (-49, 0, 0), ">"), (I + 9, (-34, 0, 0)),
                           (I + 15, (6, 0, 0)), (I + 20, (-2, 0, 0)), (I + 24, (0, 0, 0)))}}
    for name, s in (("wing-l", -1), ("wing-r", 1)):
        k[name] = {"rot": T((0, (0, 0, 0)), (9, (0, 0, s * 40)), (12, (0, 0, s * 47)), (I + 1, (0, 0, -s * 24), ">"), (I + 4, (0, 0, -s * 30)), (I + 8, (0, 0, s * 14)), (I + 13, (0, 0, -s * 6)),
                            (I + 18, (0, 0, s * 2)), (I + 22, (0, 0, 0)))}
    for name in ("leg-l", "leg-r"):
        k[name] = {"rot": T((0, (0, 0, 0)), (I + 24, (0, 0, 0)))}
    attack = B.bake(k, I + 24)
    for name in ("leg-l", "leg-r"):
        B.plant(root, attack, name, FOOT, range(0, I + 25))
    B.ground(root, attack, R, height=lambda f: 0.0)
    AI = I
    # hit: shoved back and up off its feet on frame 0-1 (lands f8), the
    # neck whips back and the wings fling up, then beat back down; it
    # drifts through the beat, rocks forward past rest and settles.
    hk = {R: B.react_body(push=3.0, pop=0.0, lean=12, side=0.6), "head": {"rot": B.react_lag((30, 16, 0))}}
    for name, s in (("wing-l", -1), ("wing-r", 1)):
        hk[name] = {"rot": B.react_lag((0, 0, s * 34), delay=0)}
    for name in ("leg-l", "leg-r"):
        hk[name] = {"rot": T((0, (0, 0, 0)), (34, (0, 0, 0)))}
    hit = B.bake(hk, 34)
    for name in ("leg-l", "leg-r"):
        B.plant(root, hit, name, FOOT, range(8, 35))
    B.ground(root, hit, R, height=B.arc(0, 8, 1.4))
    # death: a last struggle: it crouches and hurls itself up with three
    # desperate wing beats, lurching side to side and sagging between
    # them, the neck thrashing (f0-23, about 12 voxels up); the wings give
    # out and it drops with gravity, faster and faster, crashing onto its
    # belly with the legs folding under (impact f32, squashed). One small
    # bounce and a hard stop; the wings slap down flat to the floor a beat
    # late and flop, the long neck lands last.
    I = 32
    top = 23
    # each down-stroke heaves it up, each up-stroke it sags back 3 (6-9 up, 9-12 down, ...)
    climb = T((0, (0, 0, 0)), (6, (0, 0, 0)), (9, (0, 5.5, 0)), (12, (0, 2.5, 0)), (15, (0, 9.5, 0)), (18, (0, 6.5, 0)), (21, (0, 14.0, 0)), (top, (0, 16, 0)), (top + 1, (0, 16, 0)))
    g = 2 * 16.0 / (I - top) ** 2

    def height(f):
        if f < top:
            return float(climb(f)[1])
        if f < I:
            return 16.0 - 0.5 * g * (f - top) ** 2
        return B.arc(I, I + 4, 1.0)(f)

    d = {R: {"rot": T((0, (0, 0, 0)), (6, (10, 0, 0)), (10, (2, 0, -7)), (13, (5, 0, 6)), (16, (-4, 0, -8)), (19, (2, 0, 7)), (22, (-6, 0, -4)), (top + 2, (-8, 0, 0)),
                      (I, (-21, 0, 0), ">"), (I + 2, (-19, 0, 0)), (I + 4, (-20, 0, 0), "0"), (60, (-20, 0, 0))),
             "scale": T((0, (1, 1, 1)), (6, (1.04, 0.94, 1.04)), (9, (0.97, 1.05, 0.97)), (12, (1, 1, 1)), (I - 1, (0.98, 1.03, 0.98)), (I, (1.08, 0.86, 1.06), ">"), (I + 3, (0.98, 1.04, 0.99)),
                        (I + 7, (1.01, 0.99, 1)), (I + 11, (1, 1, 1)),
                        (I + 18, (1.01, 1.03, 1.01)), (I + 26, (1, 0.98, 1)), (60, (1, 0.985, 1)))},  # a last heaving breath
         "head": {"rot": T((0, (0, 0, 0)), (6, (20, 0, 0)), (10, (-10, 8, 0)), (13, (-15, -6, 0)), (16, (24, 4, 0)), (19, (-20, 12, 0)), (22, (20, -8, 0)), (top + 3, (30, 0, 0)),
                           (I, (12, 0, 0)), (I + 3, (-36, 14, 0), ">"), (I + 6, (-28, 16, 0)), (I + 9, (-36, 18, 0)), (60, (-36, 18, 0)))}}
    for name, s in (("wing-l", -1), ("wing-r", 1)):  # three desperate beats (the down-strokes lift it), then they give out
        o = s > 0
        lie = (60, 0, -s * 21)  # spread out and down, trailing back onto the floor
        d[name] = {"rot": T((0, (0, 0, 0)), (6, (0, 0, s * 50)), (9, (0, 0, -s * 34)), (12, (0, 0, s * 52)), (15, (0, 0, -s * 36)), (18, (0, 0, s * 54)), (21, (0, 0, -s * 30)),
                            (top + 2, (14, 0, s * 26)), (I - 2, (30, 0, s * 40)), (I + 2 + o, lie, ">"), (I + 5 + o, (52, 0, -s * 10)), (I + 8 + o, lie), (I + 16 + 3 * o, lie),
                            (I + 19 + 3 * o, (lie[0] - 4, 0, lie[2] + s * (8 - 5 * o))), (I + 24 + 3 * o, lie), (60, lie))}  # a last feeble twitch
    for name, lag in (("leg-l", 0), ("leg-r", 1)):  # the legs dangle as it struggles, then fold under it
        d[name] = {"rot": T((0, (0, 0, 0)), (7, (6, 0, 0)), (10, (22, 0, 0)), (16, (8, 0, 0)), (21, (26, 0, 0)), (top + 3, (-20, 0, 0)), (I, (-70, 0, 0), ">"),
                            (I + 3 + lag, (-76, 0, 0)), (I + 6 + lag, (-70, 0, 0)), (60, (-70, 0, 0)))}
    death = B.bake(d, 60)
    B.ground(root, death, R, height=height)
    for name in ("leg-l", "leg-r", "head"):  # tucked down onto the floor at rest
        B.reach(root, death, name, "x", range(I + 9, 61), height=0.3, fade_in=3, fade_out=0, span=30)
    return B.fill(root, attack), AI, B.fill(root, hit), B.fill(root, death), I


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
    attack, imp, hit, death, dimp = _one_shots(rig.root)
    return make("creatures", "mutant-vulture", "Mutant Vulture", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp * F, ease=0), Clip("hit", hit, loop=False, ease=0), Clip("death", death, loop=False, impact=dimp * F, ease=0)],
                sockets=[rig.socket("socket-beak", (CX, 42.5, 1), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-beak", "clip:attack", size=10, at=imp * F)])


def build():
    return _build()
