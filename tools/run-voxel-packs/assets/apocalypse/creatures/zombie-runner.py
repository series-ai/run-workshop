"""Zombie runner, in the Pirate Nation creature style.

A lean, hunched sprinter and a chunky caricature (PN zombie boss and
totems): a big teal head deep inside a red hood with a pointed peak,
two small glowing gold eyes, a bare bone jaw full of teeth, a torn red
hoodie with a pocket and drawstrings, ripped blue jeans, sneakers, one
bandaged forearm and long arms thrust forward with big clawed hands. The
chest leans forward (true slopes); cloth, bandage, rips and face are
paint. Clips: idle (twitchy crouch), move (sprint), attack (rears back with both claws
overhead, leaps into a double claw rake), hit, death (shot, staggers back, topples onto its back). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _zombie_falls as zf
from _zombie_falls import F
from _life import Rig, ctr, fx, limb, make, seq, side, skin, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (44, 46, 46)
CX, CZ = 22.0, 27.0
HIP_Y, SH_Y = 14.0, 25.0
NECK = (CX, 25.0, 21.0)
HIPS = {"leg-l": (CX - 4.0, HIP_Y, CZ + 0.5), "leg-r": (CX + 4.0, HIP_Y, CZ + 0.5)}
SHOULDERS = {"arm-l": (CX - 8.5, SH_Y, CZ - 5.0), "arm-r": (CX + 8.5, SH_Y, CZ - 5.0)}
SKIN = ("teal", 5)
HOOD, JEANS = ("red", 4), ("blue", 5)


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    m = limb(g, (hx, hy + 1, hz), (hx + s * 0.8, 3.5, hz - 1), 2.6, 2.3, *JEANS, n=4)
    P.flat(g, m, *JEANS)
    PP.blotch(g, m, JEANS[0], JEANS[1] + 1, cell=3, chance=0.08, seed=3 + s)  # faded denim
    if s < 0:  # a ripped knee
        P.flat(g, m & (np.abs(Y - 8.5) < 1.6) & (Z < hz - 1.5), *SKIN)
    shoe = box(g, hx - 3.3, 0, hz - 8, hx + 3.3, 3.5, hz + 2.5, "bone", 6)
    P.flat(g, shoe & (Y < 1), "red", 4)
    P.flat(g, shoe & (np.abs(Y - 2) < 0.6) & (Z > hz - 6), "red", 5)
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pelvis = box(g, CX - 6.5, HIP_Y - 2, CZ - 3, CX + 6.5, HIP_Y + 2.5, CZ + 4, *JEANS)
    P.flat(g, pelvis & (Y > HIP_Y + 1), "darkwood", 6)
    # a chest that leans hard forward (true slopes)
    chest = side(g, [(HIP_Y + 1, CZ - 3.5), (HIP_Y + 1, CZ + 4.5), (SH_Y + 1, CZ - 1), (SH_Y + 2.5, CZ - 6), (SH_Y, CZ - 10)], CX - 7.5, CX + 7.5, *HOOD)
    P.mottle(g, chest, *HOOD, cell=3, seed=2)
    P.outline(g, chest, HOOD[0], HOOD[1] - 2, normal="x")
    front = chest & (Z < CZ - 3)
    P.flat(g, front & (np.abs(X - CX) < 5) & (Y > HIP_Y + 2) & (Y < HIP_Y + 6), HOOD[0], HOOD[1] - 1)  # the pocket
    for dx in (-2.0, 2.0):  # drawstrings
        P.flat(g, front & (np.abs(X - CX - dx) < 0.6) & (Y > SH_Y - 5), "bone", 6)
    rip = chest & (np.hypot(X - (CX - 4), Y - (HIP_Y + 8)) < 2.4) & (Z < CZ - 3)
    P.flat(g, rip, *SKIN)
    P.flat(g, rip & (np.floor(Y) % 2 == 0), "bone", 6)
    neck = box(g, CX - 3, SH_Y - 1, NECK[2] - 3, CX + 3, SH_Y + 3, NECK[2] + 3, *SKIN)
    del neck
    return g


def head() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    y0 = ny - 1
    fz = nz - 9.0
    face = box(g, CX - 6, y0, fz, CX + 6, y0 + 12, nz + 2, *SKIN)
    skin(g, face, *SKIN, seed=6)
    # the hood: top, sides and back round the head, with a pointed peak
    hood = box(g, CX - 7.5, y0 + 11, fz - 1, CX + 7.5, y0 + 14, nz + 3.5, *HOOD)
    for x0 in (CX - 7.5, CX + 6):
        hood |= box(g, x0, y0 + 1, fz - 1, x0 + 1.5, y0 + 11, nz + 3.5, *HOOD)
    hood |= box(g, CX - 7.5, y0 + 1, nz + 2, CX + 7.5, y0 + 11, nz + 3.5, *HOOD)
    peak = side(g, [(y0 + 14, fz + 1), (y0 + 14, nz + 3.5), (y0 + 17.5, nz + 5.5)], CX - 3, CX + 3, *HOOD)
    P.mottle(g, hood | peak, *HOOD, cell=3, seed=7)
    P.flat(g, hood & (Z < fz), HOOD[0], HOOD[1] - 2)  # the dark rim of the hood
    # small glowing eyes under a scowl, a bare bone jaw with teeth
    legend = {"s": C("teal", 3), "e": C("gold", 7), "k": C("ember", 3)}
    rows = ["sss....sss", "eek....kee", ".ee....ee."]
    G.stamp(g, "-z", fz, int(CX - 5), int(y0 + 6), rows, legend, depth=2)
    jaw = face & (Y < y0 + 4.5) & (Z < fz + 3)
    P.flat(g, jaw, "bone", 6)
    P.flat(g, jaw & (Z < fz + 1) & (Y > y0 + 1.5) & (Y < y0 + 3.5) & (np.abs(X - CX) < 4.5), "red", 2)
    P.flat(g, jaw & (Z < fz + 1) & (Y > y0 + 2.5) & (Y < y0 + 3.5) & (np.floor(X) % 2 == 0) & (np.abs(X - CX) < 4.5), "bone", 7)
    P.flat(g, face & (Z < fz + 1) & (np.abs(Y - (y0 + 5)) < 0.6) & (np.abs(X - CX) < 1.2), "teal", 3)  # nose holes
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    ex, ey, ez = sx + s * 2.0, sy - 5.0, sz - 6.0
    wx, wy, wz = sx + s * 1.5, sy - 7.0, sz - 13.0
    upper = limb(g, (sx, sy, sz), (ex, ey, ez), 2.3, 2.1, *HOOD, n=4)
    P.mottle(g, upper, *HOOD, cell=2, seed=10 + s)
    fore = limb(g, (ex, ey, ez + 1), (wx, wy, wz), 1.9, 1.8, *SKIN, n=4)
    hand = box(g, wx - 3.3, wy - 3.5, wz - 5.5, wx + 3.3, wy + 2.5, wz + 1, *SKIN)
    skin(g, fore | hand, *SKIN, seed=12 + s)
    if s > 0:  # a dirty bandage wrapped round the forearm
        P.flat(g, fore & ((np.floor(Z) % 3) != 0), "bone", 6)
        P.flat(g, fore & ((np.floor(Z) % 3) == 0), "bone", 4)
    for k in range(3):
        fxk = wx - 2.2 + k * 2.2
        fg = limb(g, (fxk, wy - 0.5, wz - 5), (fxk, wy - 3.5, wz - 9), 1.0, 0.8, *SKIN, n=4)
        P.flat(g, fg & (Z < wz - 8), "gold", 6)
    return g


def _build():
    rig = Rig("zombie-runner", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body")
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    twitch = seq((0, 0, 0, 0), (0.5, 0, 0, 0), (0.55, 6, 12, 8), (0.62, 0, 0, 0), (1.3, 0, 0, 0), (1.35, -4, -10, -6), (1.42, 0, 0, 0), (1.8, 0, 0, 0))
    idle = {"body": {"rot": wave(1.8, (4, 0, 2)), "loc": wave(1.8, (0, 0.5, 0), phase=1.5)},
            "head": {"rot": twitch},
            "arm-l": {"rot": wave(1.8, (8, 0, -3), phase=0.4)},
            "arm-r": {"rot": wave(1.8, (8, 0, 3), phase=2.0)},
            "leg-l": {"rot": wave(1.8, (3, 0, 0))}, "leg-r": {"rot": wave(1.8, (-3, 0, 0))}}
    move = {"leg-l": {"rot": wave(0.7, (40, 0, 0))},
            "leg-r": {"rot": wave(0.7, (-40, 0, 0))},
            "body": {"rot": wave(0.7, (0, 8, 0), phase=0.3, base=(-8, 0, 0)), "loc": wave(0.7, (0, 1.4, 0), phase=1.6, double=True)},
            "head": {"rot": wave(0.7, (5, -6, 0), phase=0.9)},
            "arm-l": {"rot": wave(0.7, (-28, 0, 0))},
            "arm-r": {"rot": wave(0.7, (28, 0, 0))}}
    # attack: a pounce. It rears back on its heels with both claws thrown
    # up behind its head (f0-8, still coiling through f9), then springs: it
    # leaves the ground (f10) and lands on the front foot 2 frames later as
    # both claws rake down into the victim's chest (impact f12). The torso
    # drives on and the claws rake through past the knees (f14), the back
    # foot lands behind (f15) and it worries the wound in a moving hold,
    # head jerking and claws twitching, then skitters back to its spot in
    # a quick hop, rocks back past upright and settles.
    f = 1 / 30
    imp = 12 * f
    R = rig.root.name
    T = zf.fr
    attack = {R: {"loc": T((0, 0, 0, 0), (4, 0, 0, 1.2), (8, 0, 0, 2.1), (9, 0, 1.8, 0.6), (10, 0, 2.8, -1.8), (11, 0, 2.4, -4.0), (12, 0, 0.05, -8.0),
                           (14, 0, 1.0, -9.2), (17, 0, 1.2, -9.0), (21, 0, 1.0, -8.7), (25, 0, 1.2, -8.9), (28, 0, 2.2, -4.5), (31, 0, 0, 0.6), (35, 0, 0, -0.15), (38, 0, 0, 0))},
              "body": {"rot": T((0, 0, 0, 0), (4, 9, 0, 0), (8, 20, 0, 2), (9, 13, 0, 1), (10, -1, 0, 0), (11, -12, 0, -2), (12, -18, 0, -3), (14, -25, 0, -4),
                                (17, -19, 0, -2), (21, -22, 0, -3), (25, -19, 0, -2), (29, -6, 0, 0), (33, 5, 0, 0), (36, -1, 0, 0), (38, 0, 0, 0))},
              "head": {"rot": T((0, 0, 0, 0), (5, 9, 0, 0), (8, 22, 0, -3), (9, 21, 0, -3), (11, 6, 0, 0), (13, -4, 0, 3), (15, -13, 4, 5), (18, -2, -4, 0),
                                (21, -10, 5, 2), (25, -5, 0, 0), (30, 3, 0, 0), (34, 7, 0, 0), (37, -1, 0, 0), (38, 0, 0, 0))},
              "leg-l": {"rot": T((0, 0, 0, 0), (4, 5, 0, 0), (8, 8.5, 0, 0), (9, 2, 0, 0), (10, 18, 0, 0), (11, 26, 0, 0), (12, 20, 0, 0), (14, 15, 0, 0), (17, 15.5, 0, 0),
                                 (21, 17, 0, 0), (25, 16, 0, 0), (28, 4, 0, 0), (31, -2, 0, 0), (35, 0, 0, 0)),
                        "loc": T((0, 0, 0, 0), (8, 0, 0, 0), (9, 0, 0.8, 0), (10, 0, 2.0, 0), (11, 0, 1.4, 0), (12, 0, -0.32, 0), (14, 0, -1.4, 0), (17, 0, -1.7, 0), (21, 0, -1.6, 0),
                                 (25, 0, -1.7, 0), (28, 0, 1.0, 0), (31, 0, 0, 0))},
              "leg-r": {"rot": T((0, 0, 0, 0), (4, 5, 0, 0), (8, 8.5, 0, 0), (9, -6, 0, 0), (10, -22, 0, 0), (11, -27, 0, 0), (12, -28, 0, 0), (15, -17, 0, 0), (17, -16, 0, 0),
                                 (21, -15, 0, 0), (25, -16, 0, 0), (28, -6, 0, 0), (31, 2, 0, 0), (35, 0, 0, 0)),
                        "loc": T((0, 0, 0, 0), (8, 0, 0, 0), (9, 0, 0.6, 0), (10, 0, 2.2, 0), (12, 0, 2.6, 0), (15, 0, 0, 0), (25, 0, 0, 0), (28, 0, 1.4, 0), (31, 0, 0, 0))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):
        attack[name] = {"rot": T((0, 0, 0, 0), (4, 40, 0, s * 8), (8, 94, 0, s * 15), (9, 93, 0, s * 15), (10, 80, 0, s * 9), (11, 66, 0, s * 2), (12, 30, 0, -s * 14),
                                 (14, 6, 0, -s * 24), (17, 20, 0, -s * 16), (20, 10, 0, -s * 21), (24, 17, 0, -s * 15),
                                 (29, 4, 0, -s * 4), (33, -6, 0, s * 2), (36, 1, 0, 0), (38, 0, 0, 0))}
        if s > 0:  # the right claw trails a frame behind the left through the hold
            attack[name]["rot"] = [(t + (F if 13 / 30 < t < 37 / 30 else 0), v) for t, v in attack[name]["rot"]]
    hit = {R: zf.hit_body(push=3.2, pop=1.2, lean=12, side=-0.6, front=True),
           "body": {"rot": zf.fr((0, 0, 0, 0), (1, 8, 0, 0), (2, 11, 0, 0), (6, 9, 0, 0), (12, 2, 0, 0), (17, -4, 0, 0), (22, 1, 0, 0), (26, 0, 0, 0))},
           "head": {"rot": zf.fr((0, 0, 0, 0), (1, 8.4, -3.0, -1.8), (2, 19.2, -7.0, -4.2), (4, 24, -10, -6), (7, 16.8, -8.0, -4.8), (11, 3.6, -3.0, -1.8), (15, -7.2, 2.0, 1.2), (20, 1.9, -0.5, -0.3), (25, 0, 0, 0))},
           "arm-l": {"rot": zf.fr((0, 0, 0, 0), (1, 3, 0, -5), (3, 8, 0, -14), (6, 7, 0, -19), (10, 1, 0, -8), (15, -3, 0, 4), (20, 1, 0, -1), (25, 0, 0, 0))},
           "arm-r": {"rot": zf.fr((0, 0, 0, 0), (2, 3, 0, 5), (4, 8, 0, 14), (7, 7, 0, 19), (11, 1, 0, 8), (16, -3, 0, -4), (21, 1, 0, 1), (25, 0, 0, 0))}}
    # death: it lurches forward on its last stride, doubling over (f0-7),
    # and the shot in the chest (the gore burst at f8) stops it dead: from
    # that one turning point it goes over backwards, away from the shooter,
    # like a felled post: slow off the heels, then faster and faster
    # (gravity, keyed frame by frame) into a heavy squashed thud flat on its
    # back (impact f22, the fastest frame). The arms are flung up and slap
    # down over the head on the thud, the head whips back and lands with
    # it, the legs flop; one small bounce and a dead stop. 1.13 s.
    dimp = 22 * f
    T = zf.fr
    fall = [(8 + k, -8 + 98 * (0.04 * k / 14 + 0.96 * (k / 14) ** 2.5), 0, 0) for k in range(1, 14)]
    fz = [(8 + k, 0, 0, -1.0 + 6.0 * (k / 14) ** 2) for k in range(1, 14)]
    death = {R: {"rot": T((0, 0, 0, 0), (3, -4, 0, 0), (8, -8, 0, 0), *fall, (22, 90, 0, 0), (23, 88.6, 0, 0), (24, 90, 0, 0), (34, 90, 0, 0)),
                 "loc": T((0, 0, 0, 0), (3, 0, 0, -0.5), (8, 0, 0, -1.0), *fz, (22, 0, 0, 5), (23, 0, 0.5, 5.1), (24, 0, 0, 5.2), (34, 0, 0, 5.2))},
             "body": {"rot": T((0, 0, 0, 0), (4, -8, 0, 0), (8, -14, 0, 0), (13, -4, 0, 0), (18, 4, 0, 0), (22, 0, 0, 0), (23, 3, 0, 0), (25, 0, 0, 0)),
                      # the chest squashes flat on the thud and springs back
                      "scale": T((0, 1, 1, 1), (21, 1, 1, 1), (22, 1.08, 1.05, 0.82), (24, 0.98, 0.99, 1.04), (26, 1, 1, 1))},
             "head": {"rot": T((0, 0, 0, 0), (4, -10, 0, 0), (8, -18, 0, 0), (13, -6, 0, 0), (18, 14, -6, 0), (22, 13, -16, 0), (23, 8, -20, 0), (25, 11, -23, 0), (34, 11, -24, 0))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):  # flung up by the shot, slapped down over the head on the thud
        death[name] = {"rot": T((0, 0, 0, 0), (4, -10, 0, s * 4), (8, -16, 0, s * 6), (12, 30, 0, s * 12), (17, 70, 0, s * 16), (20, 100, 0, -s * 16),
                                (22, 122, 0, -s * 40), (23, 124, 0, -s * 42), (25, 122, 0, -s * 42), (34, 122, 0, -s * 42))}
    for name, s in (("leg-l", -1), ("leg-r", 1)):  # the knees give, the legs flop on the thud
        death[name] = {"rot": T((0, 0, 0, 0), (8, 5, 0, 0), (14, -3, 0, 0), (18, 4, 0, s * 2), (22, 8, 0, s * 6), (23, 14, 0, s * 8), (26, 8, 0, s * 8), (34, 8, 0, s * 8))}
    return make("creatures", "zombie-runner", "Zombie Runner", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=dimp, ease=0)],
                sockets=[rig.socket("socket-chest", (CX, HIP_Y + 8, CZ - 6), parent="body")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-chest", "clip:death", size=30, at=0.26)])


def build():
    # Key the death's resting pose on the floor so its bounce leaves it.
    return zf.pin_rest(_build(), trim=0.06)
