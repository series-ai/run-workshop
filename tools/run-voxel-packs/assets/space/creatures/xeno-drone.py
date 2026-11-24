"""Xeno drone, in the Pirate Nation creature style.

A hovering insect caricature: a faceted violet chitin thorax with magenta
plates, a big head with two huge red compound eyes and bone mandibles, a
fat faceted abdomen banded in toxic green that ends in a glowing stinger,
three pairs of dangling legs and four pale veined wings (flat true-slope
prisms). Clips: idle (hover, flap), move (fly forward nose-down), attack (rear back and dive with the
stinger), hit (knock back), death (knocked out of the air,
drops onto its side). Faces -Z.
"""
import math

import numpy as np

from _motion import DEATH_FLOOR, curve
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


LAND, WING = -0.6, 66.0  # death: the landing height and the splayed wings


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
    def buzz(sgn, t0, t1, amp=36, step=2):
        """Fast flaps from frame t0 to t1 (a frenzy)."""
        out, f, up = [], t0, True
        while f <= t1:
            out.append((f * F, (0, 0, sgn * (12 if up else -amp))))
            f += step
            up = not up
        return out

    # Stinger dive: the drone pulls back and up, cocking its abdomen high
    # with its wings in a frenzy (0-0.37 s), hangs, then in 2 frames dives
    # forward and swings the stinger under into the target (impact
    # 0.433 s), overshoots, holds and backs off.
    F = 1 / 30
    hit_t = 13 * F
    attack = {"body": {"rot": keys((0, z), (5 * F, (-18, 0, 0)), (10 * F, (-42, 0, 0)), (11 * F, (-44, 0, 0)), (hit_t, (44, 0, 0)), (15 * F, (52, 0, 0)),
                                   (20 * F, (38, 0, 0)), (30 * F, z)),
                       "loc": keys((0, z), (5 * F, (0, 3, 2)), (10 * F, (0, 6, 4)), (11 * F, (0, 6.2, 4.2)), (hit_t, (0, 1.5, -7)), (15 * F, (0, 1, -8)),
                                   (20 * F, (0, 1.5, -6.5)), (30 * F, z))},
              **{w: {"rot": [(0, z)] + buzz(1 if w[5] == "l" else -1, 1, 29) + [(30 * F, z)]} for w in ("wing-l0", "wing-l1", "wing-r0", "wing-r1")}}
    # Knockback: the blow pops the drone up and back and tips it, the wings
    # beat in a panic; it sinks a beat and buzzes back to its spot.
    # (0.6 s: the recovery is one swing back past rest, no drift)
    hit = {"body": {"rot": keys((0, z), (2 * F, (-20, 0, 15)), (5 * F, (-24, 0, 18)), (9 * F, (10, 0, -6)), (13 * F, (-3, 0, 2)), (18 * F, z)),
                    "loc": keys((0, z), (2 * F, (0, 1.5, 2.5)), (5 * F, (0, 2.5, 4)), (9 * F, (0, 0.5, 3.0)), (14 * F, (0, 0.3, 0.6)), (18 * F, z))},
           **{w: {"rot": [(0, z)] + buzz(1 if w[5] == "l" else -1, 1, 17) + [(18 * F, z)]} for w in ("wing-l0", "wing-l1", "wing-r0", "wing-r1")}}
    # Swatted: the blow knocks the drone back, it struggles up high with
    # stuttering wings (a moving hang), then the wings quit and it drops out
    # of the air with gravity, tumbling, and belly-flops onto the floor
    # (impact 0.9 s) with a squash, one small 2-frame bounce and still; the
    # wings slap down flat on the floor a frame later. Still by 1.2 s.
    die_t = 27 * F
    end = 37
    one = (1.0, 1.0, 1.0)
    death = {"body": {"rot": keys((0, z), (3 * F, (-20, 0, 15)), (6 * F, (6, 10, -6)), (10 * F, (10, 14, -8)), (14 * F, (-6, 10, 6)), (17 * F, (4, 6, -4)),
                                  (21 * F, (-8, 4, 10)), (die_t, (6, 0, 4)), (29 * F, (3, 0, 2)), (31 * F, (5, 0, 4)), (33 * F, (4, 0, 3)), (end * F, (4, 0, 3))),
                      "loc": keys((0, z), (3 * F, (0, 2, 2)), (6 * F, (0, 1.2, 1.5)), (10 * F, (0, 4.5, 1)), (14 * F, (0, 6.5, 0.5)), (17 * F, (0, 7, 0.5)),
                                  (21 * F, (0, 7.6, 0.4)), (die_t, (0, LAND, 0)), (29 * F, (0, LAND + 1.0, 0)), (31 * F, (0, LAND, 0)), (end * F, (0, LAND, 0))),
                      "scale": keys((0, one), (die_t - F, one), (die_t, (1.16, 0.78, 1.1)), (29 * F, (0.96, 1.05, 0.97)), (31 * F, (1.04, 0.96, 1.02)),
                                    (34 * F, one), (end * F, one))}}
    for name in ("wing-l0", "wing-l1", "wing-r0", "wing-r1"):
        sg = 1 if name[5] == "l" else -1
        lag = 0 if name[-1] == "0" else 1
        death[name] = {"rot": [(0, z)] + buzz(sg, 2, 16, amp=30, step=2) + curve((20, (0, 0, sg * 24)), (24, (0, 0, sg * 30)), (27 + lag, (0, 0, -sg * 10)),
                                                                              (30 + lag, (0, 0, -sg * (WING + 5))), (33 + lag, (0, 0, -sg * WING)),
                                                                              (end, (0, 0, -sg * WING)))}
    # Move: flying forward, nose down, the wings beating fast (6 beats a
    # loop, a beat every 0.2 s). Each downstroke kicks the body up a touch
    # and the body drifts up and down once a loop, the abdomen swinging a
    # beat behind. Loops seamlessly.
    beat = 0.2
    fly = {"body": {"loc": [], "rot": []}}
    for f in range(37):
        t = f / 30
        ph = 2 * math.pi * t / 1.2
        kick = math.cos(2 * math.pi * t / beat)
        fly["body"]["loc"].append((t, (0.0, 2.6 + 0.7 * math.cos(ph) + 0.25 * kick, 0.0)))
        fly["body"]["rot"].append((t, (-14.0 - 3.0 * math.cos(ph), 0.0, 2.5 * math.sin(ph))))
    for w in ("wing-l0", "wing-l1", "wing-r0", "wing-r1"):
        sg = 1 if w[5] == "l" else -1
        lag = 0.0 if w[-1] == "0" else 1 / 30  # the hind pair a frame behind
        fly[w] = {"rot": [((k * beat / 2 + lag) % 1.2, (0, 0, sg * (14 if k % 2 == 0 else -34))) for k in range(12)]}
        fly[w]["rot"].sort()
        if lag:
            fly[w]["rot"] = [(0.0, (0, 0, sg * (14 - 48 * lag / (beat / 2))))] + fly[w]["rot"] + [(1.2, (0, 0, sg * (14 - 48 * lag / (beat / 2))))]
        else:
            fly[w]["rot"].append((1.2, (0, 0, sg * 14)))
    return asset("creatures", "xeno-drone", "Xeno Drone", rig.root,
                 clips=[Clip("idle", idle), Clip("move", fly), Clip("attack", attack, loop=False, impact=hit_t, floor=True), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=die_t, floor=DEATH_FLOOR)])


_ = (box, gem, mask_of)
