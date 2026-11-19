"""Vampire bat, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf and the PN haunted
bat vane: a fat purple fur ball with an oversized head, huge pointed ears
with pink insides, big glowing red eyes, a pink snout and two long fangs,
a pale chest tuft and tiny hooked feet. The wings are true-slope membranes
with a scalloped trailing edge; the finger bones are painted. Wingspan 23
(a crow; a person is 36). Clips: idle (hovering flap), attack (dive bite),
death (tumble). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _fall import hit_back
from _gait_loops import cyc, per_frame, shift
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, fur, octo, plan
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (26, 24, 12)
CX = 13
FUR, WING = "purple", "magenta"
BODY = (CX, 10.0, 6.0)
SHOULDER = {"wing-l": (CX - 3.0, 11.0, 6.0), "wing-r": (CX + 3.0, 11.0, 6.0)}


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    torso = plan(g, octo(CX, 6.5, 2.2, 1.8, 0.8), 2.5, 6.5, FUR, 5, top=octo(CX, 6.5, 3.8, 3.2, 1.3))  # round belly
    torso |= chunk(g, CX, 6.5, 6.5, 11, 3.8, 3.2, 1.3, FUR, 5, taper=0.6)
    head = chunk(g, CX, 6.0, 9, 16.5, 4.6, 3.6, 1.6, FUR, 5, taper=0.9)
    ears = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 1.2, 15.5), (CX + s * 4.4, 15), (CX + s * 5.0, 21.5)], 5, 7.5, FUR, 5)
    ruff = front(g, [(CX - 5, 10.5), (CX - 3, 8.5), (CX, 9.8), (CX + 3, 8.5), (CX + 5, 10.5), (CX + 3.5, 11.5), (CX - 3.5, 11.5)], 3.5, 9.5, FUR, 3)
    fur(g, torso | head, FUR, 5, seed=1)
    fur(g, ruff, FUR, 4, seed=2)
    P.mottle(g, ears, FUR, 5, cell=2, seed=3)
    P.flat(g, ears & (Z < 6) & (np.abs(np.abs(X + 0.5 - CX) - 3.3) < 1.0) & (Y > 16) & (Y < 20), "pink", 3)  # pink inner ears
    P.flat(g, torso & (Z < 5) & (np.abs(X + 0.5 - CX) < 2.2) & (Y < 9), FUR, 6)  # pale chest tuft
    P.flat(g, torso & (Z < 5) & (np.abs(X + 0.5 - CX) < 1.0) & (Y < 7), FUR, 7)
    # face: big glowing red eyes, a pink snout, a smile and two long fangs
    face = {"k": C(FUR, 1), "r": C("red", 5), "w": C("ember", 7), "n": C("pink", 3), "m": C(FUR, 2)}
    rows = [
        "kkk...kkk",
        "kwrk.kwrk",
        "krrk.krrk",
        ".kk...kk.",
        "...nnn...",
        ".m.....m.",
        "..mmmmm..",
    ]
    pnglyph.stamp(g, "-z", 2.4, CX - 4, 9, rows, face, depth=2, reach=2)
    for s in (-1, 1):
        claw(g, "z", (CX + s * 1.3, 9.6), (CX + s * 1.1, 6.8), 0.8, 2.0, 3.2, "bone", 7)  # fangs
        claw(g, "z", (CX + s * 1.6, 3.4), (CX + s * 1.9, 1.0), 0.9, 5.5, 7.0, "bone", 5)  # hooked feet
    return g


def wing(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pts = [(3.0, 12.5), (6.5, 15.0), (9.5, 16.0), (11.5, 15.2), (10.8, 10.0), (9.0, 11.6), (7.4, 7.8), (5.6, 10.0), (3.0, 8.2)]
    m = front(g, [(CX + s * u, v) for u, v in pts], 5.2, 6.8, WING, 3)
    P.mottle(g, m, WING, 3, cell=3, seed=5 + s)
    # finger bones from the wrist to every scallop point, and a lit leading edge
    U = np.abs(X + 0.5 - CX)
    for (u1, v1) in ((11.5, 15.2), (10.8, 10.0), (7.4, 7.8), (3.0, 8.2)):
        u0, v0 = 5.0, 13.5
        d = np.abs((v1 - v0) * (U - u0) - (u1 - u0) * (Y + 0.5 - v0)) / np.hypot(v1 - v0, u1 - u0)
        seg = (U >= min(u0, u1) - 0.5) & (U <= max(u0, u1) + 0.5)
        P.flat(g, m & (d < 0.6) & seg, FUR, 3)
    P.flat(g, m & (Y + 0.5 > 13.2 + (U - 3.0) * 0.45) & (U < 10.5), FUR, 4)
    P.flat(g, m & (np.abs(U - 5.0) < 0.8) & (np.abs(Y + 0.5 - 13.5) < 0.8), "bone", 6)  # wrist thumb claw
    return g


def _move() -> dict:
    """Move: flying forward, 27 frames (0.9 s), three wingbeats of 9 frames.
    The body is lifted clear of the floor and tilted nose-down 20 degrees.
    Each beat: a 4-frame power downstroke (wings swept forward) that heaves
    the body up and rocks it nose-up a little, then a 5-frame upstroke
    (wings swept back) while the body falls with gravity, accelerating, until
    the next downstroke catches it."""
    import math
    T, W = 27, 9

    def bob(f):
        d = (f - 1) % W  # lowest one frame into the downstroke
        if d <= 4:
            return -1.0 + 2.0 * (1 - math.cos(math.pi * d / 4)) / 2
        return 1.0 - 2.0 * ((d - 4) / 5) ** 2

    flap = lambda f: cyc(f % W, W, [(0, -45.0), (4, 50.0)])  # noqa: E731  (+ is down for the left wing)
    sweep = lambda f: cyc(f % W, W, [(2, -8.0), (6, 12.0)])  # noqa: E731  (+ is back for the left wing)
    return {"body": {"loc": per_frame(T, lambda f: (0.0, 4.0 + 1.4 * bob(f), 0.0)),
                     "rot": per_frame(T, lambda f: (-20.0 + cyc(f % W, W, [(3, 4.0), (7, -3.0)]), 0.0, 0.0)),
                     "scale": per_frame(T, lambda f: {1: (1.02, 0.97, 1.02), 2: (1.03, 0.96, 1.03), 3: (1.01, 0.99, 1.01), 6: (0.99, 1.02, 0.99)}.get(f % W, (1.0, 1.0, 1.0)))},
            "wing-l": {"rot": per_frame(T, lambda f: (0.0, sweep(f), flap(f)))},
            "wing-r": {"rot": per_frame(T, lambda f: (0.0, -sweep(f), -flap(f)))}}


def build():
    parts = {"body": body(), "wing-l": wing(-1), "wing-r": wing(1)}
    root = assemble(parts, [("body", None, BODY), ("wing-l", "body", SHOULDER["wing-l"]), ("wing-r", "body", SHOULDER["wing-r"])])
    flap = keys((0, (0, 0, 35)), (0.125, (0, 0, -30)), (0.25, (0, 0, 35)))
    flap_r = keys((0, (0, 0, -35)), (0.125, (0, 0, 30)), (0.25, (0, 0, -35)))
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.125, (0, 1, 0)), (0.25, (0, 0, 0)))}, "wing-l": {"rot": flap}, "wing-r": {"rot": flap_r}}
    # Attack, a snapping bite: a 3-frame pull back and up with the wings
    # cocked high, then it darts 10 voxels forward and down in 3 frames, nose
    # first, wings slamming down, and bites on frame 6 (squash); holds the
    # bite 3 frames, then flaps back to its hover by 17 (ends 20).
    attack = {"body": {"loc": keys((0, Z3), (fr(3), (0, 1.5, 2.5)), (fr(6), (0, -1.5, -10)), (fr(8), (0, -1.3, -10.6)), (fr(10), (0, -1.0, -10.2)),
                                   (fr(14), (0, 0.8, -2.5)), (fr(17), Z3), (fr(20), Z3)),
                       "rot": keys((0, Z3), (fr(3), (16, 0, 0)), (fr(6), (-28, 0, 0)), (fr(8), (-31, 0, 2)), (fr(10), (-26, 0, 0)),
                                   (fr(14), (6, 0, 0)), (fr(17), Z3), (fr(20), Z3)),
                       "scale": keys((0, (1, 1, 1)), (fr(3), (0.94, 1.08, 0.94)), (fr(5), (0.9, 0.95, 1.2)), (fr(6), (1.14, 0.86, 1.06)),
                                     (fr(8), (0.98, 1.02, 0.98)), (fr(10), (1, 1, 1)), (fr(20), (1, 1, 1)))},
              "wing-l": {"rot": keys((0, (0, 0, 35)), (fr(3), (0, 0, 80)), (fr(6), (0, 0, -45)), (fr(8), (0, 0, -38)), (fr(10), (0, 0, -40)),
                                     (fr(13), (0, 0, 60)), (fr(16), (0, 0, -20)), (fr(20), (0, 0, 35)))},
              "wing-r": {"rot": keys((0, (0, 0, -35)), (fr(3), (0, 0, -80)), (fr(6), (0, 0, 45)), (fr(8), (0, 0, 38)), (fr(10), (0, 0, 40)),
                                     (fr(13), (0, 0, -60)), (fr(16), (0, 0, 20)), (fr(20), (0, 0, -35)))}}
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    hit, hit_hit = hit_back("body", foot=(-8, 0, 0), push=4.0, pop=2.0, tilt=22, twist=14,
                            extra={"wing-l": lambda t: keys((0, (0, 0, 35)), (fr(3), (0, 0, 70)), (fr(7), (0, 0, -20)), (fr(11), (0, 0, 50)), (fr(16), (0, 0, -30)), (fr(t["E"]), (0, 0, 35))),
                                   "wing-r": lambda t: keys((0, (0, 0, -35)), (fr(3), (0, 0, -70)), (fr(7), (0, 0, 20)), (fr(11), (0, 0, -50)), (fr(16), (0, 0, 30)), (fr(t["E"]), (0, 0, -35)))})
    # Death: the blow on the face throws it back and tips it over (frames
    # 0-2, wings flung up), it drops out of the air with gravity, still
    # flying backwards and tipping onto its back, hits the floor on frame 8
    # (squash, wings slap down) and slides on backwards along the ground,
    # slowing to a stop by frame 16 (ends 21). Fall and slide are keyed a
    # frame at a time (ease=0) so the slide keeps the speed of the fall.
    LAND, SPIN = -4.8, 90.0  # loc y on the floor, lying on its back
    T0, TL, TS = 2, 8, 16  # end of the jolt, floor contact, end of the slide
    VZ = 1.2  # backward speed (voxels a frame) through the fall
    Y0 = 2.6  # the pop up off the blow
    loc = [(0, Z3), (fr(1), (0, 2.0, 3.6)), (fr(T0), (0, Y0, 4.8))]
    for f in range(T0 + 1, TL + 1):  # ballistic drop: gravity from rest at T0
        u = (f - T0) / (TL - T0)
        loc.append((fr(f), (0, Y0 + (LAND - 0.7 * (f == TL) - Y0) * u * u, 4.8 + VZ * (f - T0))))
    z0 = 4.8 + VZ * (TL - T0)
    for f in range(TL + 1, TS + 1):  # sliding: constant friction, speed falls to 0 at TS
        u = (f - TL) / (TS - TL)
        loc.append((fr(f), (0, LAND, z0 + VZ * (TS - TL) * (u - u * u / 2))))
    loc.append((fr(21), loc[-1][1]))
    death = {"body": {"loc": loc,
                      "rot": keys((0, Z3), (fr(1), (18, 0, 6)), (fr(T0), (24, 0, 8)), (fr(5), (40, 0, 6)), (fr(TL), (SPIN, 0, 4)), (fr(TL + 2), (SPIN + 5, 0, 4)),
                                  (fr(TL + 5), (SPIN, 0, 4)), (fr(21), (SPIN, 0, 4))),
                      "scale": keys((0, (1, 1, 1)), (fr(T0), (0.95, 1.06, 0.95)), (fr(8), (1, 1, 1)), (fr(TL), (1.14, 1.06, 0.82)), (fr(TL + 2), (0.97, 1.0, 1.04)),
                                    (fr(TL + 4), (1, 1, 1)), (fr(21), (1, 1, 1)))},
             "wing-l": {"rot": keys((0, (0, 0, 35)), (fr(T0), (0, 0, 85)), (fr(5), (0, 0, 70)), (fr(TL), (0, 0, -10)), (fr(TL + 2), (0, 0, -18)),
                                    (fr(TL + 5), (0, 0, -8)), (fr(21), (0, 0, -8)))},
             "wing-r": {"rot": keys((0, (0, 0, -35)), (fr(T0), (0, 0, -85)), (fr(5), (0, 0, -66)), (fr(TL + 1), (0, 0, 10)), (fr(TL + 3), (0, 0, 18)),
                                    (fr(TL + 6), (0, 0, 8)), (fr(21), (0, 0, 8)))}}
    mouth = (0.0, 9.0 - BODY[1], 2.5 - BODY[2])
    return world("vampire-bat", "creatures", "Vampire Bat", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(6)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=fr(TL), ease=0), Clip("idle", idle),
                        Clip("move", shift(_move(), 27, 10), ease=0)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="body")],
                 pfx=[pfx("rvx-monster-screech", "socket-mouth", "clip:attack", size=18, at=fr(5))])
