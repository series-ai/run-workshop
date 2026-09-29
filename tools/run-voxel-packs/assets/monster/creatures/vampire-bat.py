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
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, fur, octo, plan
from voxgrid import C, Clip, Grid, Socket

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


def build():
    parts = {"body": body(), "wing-l": wing(-1), "wing-r": wing(1)}
    root = assemble(parts, [("body", None, BODY), ("wing-l", "body", SHOULDER["wing-l"]), ("wing-r", "body", SHOULDER["wing-r"])])
    flap = keys((0, (0, 0, 35)), (0.125, (0, 0, -30)), (0.25, (0, 0, 35)))
    flap_r = keys((0, (0, 0, -35)), (0.125, (0, 0, 30)), (0.25, (0, 0, -35)))
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.125, (0, 1, 0)), (0.25, (0, 0, 0)))}, "wing-l": {"rot": flap}, "wing-r": {"rot": flap_r}}
    attack = {"body": {"loc": keys((0, (0, 0, 0)), (0.2, (0, 3, 3)), (0.45, (0, -3, -8)), (0.8, (0, 0, 0))), "rot": keys((0, (0, 0, 0)), (0.2, (-20, 0, 0)), (0.45, (35, 0, 0)), (0.8, (0, 0, 0)))},
              "wing-l": {"rot": keys((0, (0, 0, 35)), (0.2, (0, 0, 60)), (0.45, (0, 0, -20)), (0.8, (0, 0, 35)))},
              "wing-r": {"rot": keys((0, (0, 0, -35)), (0.2, (0, 0, -60)), (0.45, (0, 0, 20)), (0.8, (0, 0, -35)))}}
    # hit: knocked back and tumbled; the wings jerk up, then find the flap again
    hit = {"body": {"loc": keys((0, (0, 0, 0)), (0.1, (0, 2, 4)), (0.5, (0, 0, 0))), "rot": keys((0, (0, 0, 0)), (0.1, (-25, 0, 18)), (0.3, (6, 0, -6)), (0.5, (0, 0, 0)))},
           "wing-l": {"rot": keys((0, (0, 0, 35)), (0.1, (0, 0, 65)), (0.3, (0, 0, -10)), (0.5, (0, 0, 35)))},
           "wing-r": {"rot": keys((0, (0, 0, -35)), (0.1, (0, 0, -65)), (0.3, (0, 0, 10)), (0.5, (0, 0, -35)))}}
    death = {"body": {"loc": keys((0, (0, 0, 0)), (0.5, (0, -3, 0)), (0.8, (0, -6, 0))), "rot": keys((0, (0, 0, 0)), (0.5, (0, 0, 120)), (0.8, (0, 0, 180)))},
             "wing-l": {"rot": keys((0, (0, 0, 0)), (0.8, (0, 0, 60)))}, "wing-r": {"rot": keys((0, (0, 0, 0)), (0.8, (0, 0, -60)))}}
    mouth = (0.0, 9.0 - BODY[1], 2.5 - BODY[2])
    return world("vampire-bat", "creatures", "Vampire Bat", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="body")],
                 pfx=[pfx("rvx-monster-screech", "socket-mouth", "clip:attack", size=18, at=0.32)])
