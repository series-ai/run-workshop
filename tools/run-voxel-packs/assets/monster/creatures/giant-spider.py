"""Giant tomb spider, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf: a huge bulbous
faceted abdomen of bristly violet fur with a big magenta skull marking, a
chamfered head-body with a cluster of glowing toxic eyes (two huge, four
small), two big curved bone fangs with blood tips, and eight long jointed
legs (true-slope prisms) splayed round it at rest angles, with pale joint
bands and bone tips. Fur, marking and eyes are paint. Clips: idle (breathe,
leg twitch), attack (rear and strike), death (flip over, legs curl).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes
from _kit import keys, pfx, world
from _life import chunk, claw, coords, fur, limb, octo, plan
from voxgrid import C, Clip, Grid, Part, Socket

S = (32, 28, 50)
CX = 16
FUR = "purple"
PIVOT = (CX, 12.0, 20.0)
HIP_Z = (8.5, 12.0, 15.5, 19.0)
ANGLES = (48.0, 18.0, -14.0, -44.0)  # rest turn about y of the right legs, front to back
LEG = (28, 27, 5)
LEG_HIP = (3.0, 13.0, 2.5)


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    thorax = chunk(g, CX, 13.5, 5, 18.5, 9.5, 8.5, 3.0, FUR, 4, taper=2.2)
    low = plan(g, octo(CX, 34, 8, 9, 3), 4, 13, FUR, 4, top=octo(CX, 34, 13, 14.5, 4.5))
    high = plan(g, octo(CX, 34, 13, 14.5, 4.5), 13, 25, FUR, 4, top=octo(CX, 35.5, 6, 7, 2.5))
    pnshapes.cone(g, "z", CX, 11, 2.5, 48, 50, FUR, 3, n=6, r_top=1.0)
    abdomen = low | high
    fur(g, thorax, FUR, 4, seed=1)
    fur(g, abdomen, FUR, 4, seed=2)
    P.flat(g, abdomen & (Y < 8), FUR, 3)
    # stripes round the abdomen and a big magenta skull on its back (C3)
    P.flat(g, abdomen & (np.abs(Z - 40) < 1) & (Y > 10), "magenta", 4)
    P.flat(g, abdomen & (np.abs(Z - 44) < 1) & (Y > 8), "magenta", 4)
    skull_rows = pnglyph.ICONS["skull"]
    pnglyph.stamp(g, "top", 25, CX - 9, 25, skull_rows, {"#": C("magenta", 6), "+": C("magenta", 7), "-": C(FUR, 2)}, scale=2, depth=2, reach=6)
    # the face: two huge toxic eyes, four small ones above, a dark brow
    face = {"k": C(FUR, 1), "g": C("toxic", 6), "G": C("toxic", 7), "s": C("toxic", 5)}
    rows = [
        "kkk.kkk....kkk.kkk",
        "kgk.kGk....kGk.kgk",
        "kkk.kkk....kkk.kkk",
        "..................",
        ".kkkkkk....kkkkkk.",
        ".kGGggk....kGGggk.",
        ".kGgggk....kGgggk.",
        ".kgggsk....kgggsk.",
        ".kggssk....kggssk.",
        ".kkkkkk....kkkkkk.",
    ]
    pnglyph.stamp(g, "-z", 5.0, CX - 9, 6, rows, face, depth=2, reach=5)
    # two big curved fangs, blood-tipped
    for s in (-1, 1):
        claw(g, "z", (CX + s * 2.8, 8.0), (CX + s * 1.6, 1.0), 1.7, 5.5, 8.5, "bone", 6)
    P.flat(g, (g.a > 0) & (Y < 3) & (Z < 9), "blood", 5)
    return g


def leg(i: int, s: int) -> Grid:
    """A leg in its own grid, pointing +x (s = 1) or -x (s = -1) from the
    hip, in the x-y plane: femur up and out, tibia down to a bone tip."""
    g = Grid(*LEG)
    X, Y, Z = coords(g)
    reach = (23.0, 24.5, 24.0, 22.0)[i]
    knee = (13.0, 23.0)
    hip = (3.0, 13.0)
    femur = limb(g, "z", hip, knee, 2.5, 2.1, 0.5, 4.5, FUR, 4, cap=0.5)
    tibia = limb(g, "z", knee, (reach, 1.5), 2.1, 1.3, 1.0, 4.0, FUR, 4, cap=0.6)
    fur(g, femur | tibia, FUR, 4, seed=10 + i)
    P.flat(g, (femur | tibia) & (np.hypot(X + 0.5 - knee[0], Y + 0.5 - knee[1]) < 2.4), "magenta", 4)  # joint band
    tip = (femur | tibia) & (Y < 6)
    P.flat(g, tip, "bone", 6)
    P.flat(g, tip & (Y < 3.5), "bone", 5)
    return g if s > 0 else g.flip("x")


def build():
    g = body()
    root = Part("body", g, pivot=PIVOT)
    for s, side in ((1, "r"), (-1, "l")):
        for i in range(4):
            lg = leg(i, s)
            hip = (LEG_HIP[0] if s > 0 else LEG[0] - LEG_HIP[0], LEG_HIP[1], LEG_HIP[2])
            hx = CX + s * 7.5
            root.add(Part(f"leg-{side}{i}", lg, pivot=hip, at=(hx - PIVOT[0], 12.0 - PIVOT[1], HIP_Z[i] - PIVOT[2]), rot=(0.0, s * ANGLES[i], 0.0)))
    idle = {"body": {"loc": keys((0, (0, 0, 0)), (0.8, (0, 1, 0)), (1.6, (0, 0, 0)))}}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            ph = 0.1 * i + (0.2 if side == "r" else 0.0)
            idle[f"leg-{side}{i}"] = {"rot": keys((0, (0, 0, 0)), (0.2 + ph, (0, 0, s * 8)), (0.4 + ph, (0, 0, 0)), (1.6, (0, 0, 0)))}
    attack = {"body": {"rot": keys((0, (0, 0, 0)), (0.3, (-28, 0, 0)), (0.5, (14, 0, 0)), (1.0, (0, 0, 0))), "loc": keys((0, (0, 0, 0)), (0.3, (0, 5, 3)), (0.5, (0, 0, -6)), (1.0, (0, 0, 0)))},
              "leg-l0": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, -45)), (0.5, (0, 0, 15)), (1.0, (0, 0, 0)))},
              "leg-r0": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, 45)), (0.5, (0, 0, -15)), (1.0, (0, 0, 0)))},
              "leg-l1": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, -25)), (0.5, (0, 0, 10)), (1.0, (0, 0, 0)))},
              "leg-r1": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 0, 25)), (0.5, (0, 0, -10)), (1.0, (0, 0, 0)))}}
    # hit: the body rears back and the front legs splay out
    hit = {"body": {"rot": keys((0, (0, 0, 0)), (0.1, (-14, 0, 6)), (0.3, (4, 0, 0)), (0.55, (0, 0, 0))), "loc": keys((0, (0, 0, 0)), (0.1, (0, 1, 3)), (0.55, (0, 0, 0)))}}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(2):
            hit[f"leg-{side}{i}"] = {"rot": keys((0, (0, 0, 0)), (0.1, (0, 0, s * (22 - 8 * i))), (0.55, (0, 0, 0)))}
    death = {"body": {"loc": keys((0, (0, 0, 0)), (0.4, (0, 8, 0)), (0.8, (0, 10, 0))), "rot": keys((0, (0, 0, 0)), (0.4, (0, 0, 90)), (0.8, (0, 0, 180)))}}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            death[f"leg-{side}{i}"] = {"rot": keys((0, (0, 0, 0)), (0.8, (0, 0, s * 70)))}
    fangs = (0.0, 2.0 - PIVOT[1], 6.0 - PIVOT[2])
    spinner = (0.0, 12.0 - PIVOT[1], 49.0 - PIVOT[2])
    return world("giant-spider", "creatures", "Giant Tomb Spider", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-fangs", at=fangs, parent="body"), Socket("socket-spinner", at=spinner, parent="body")],
                 pfx=[pfx("rvx-monster-venom-spit", "socket-fangs", "clip:attack", size=30, aim=(0.0, -0.243, -0.97), at=0.4), pfx("rvx-monster-rot-poof", "socket-fangs", "clip:death", size=40, at=0.16)])
