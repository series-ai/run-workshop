"""Bandaged mummy, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf: a big bandaged
head with a dark eye slit and two toxic eyes with ember glints; a
stiff, broad torso under a gold scarab collar with a magenta gem; long arms
stretched out in a lurch; stumpy wrapped legs. The wraps are painted as
connected grey cloth bands with dark seams and bone highlights (S1).
Limbs and head are true-slope prisms. Clips: idle (lurch), attack (grab),
hit, death (unravel and collapse). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _fall import fall_back, hit_back
from _kit import keys, pfx, world
from _move_rigid import mummy_move, sole_points
from _life import assemble, chunk, coords, limb, octo, plan, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

Z3 = (0.0, 0.0, 0.0)


def fr(n: float) -> float:
    """Seconds of frame `n` at 30 fps (impact keys sit on whole frames)."""
    return n / 30.0

S = (40, 46, 40)
CX = 20
WRAP = "bone"
HIP = (CX, 15.0, 22.0)
WAIST = (CX, 17.0, 22.0)
NECK = (CX, 31.0, 21.0)
SHOULDER = {"arm-l": (CX - 9.5, 29.0, 21.0), "arm-r": (CX + 9.5, 29.0, 21.0)}
LEG = {"leg-l": (CX - 4.0, 15.0, 22.0), "leg-r": (CX + 4.0, 15.0, 22.0)}


def wraps(g: Grid, m: np.ndarray, seed: int, tilt: int = 1, base: int = 6) -> None:
    """Paint broad linen courses with clear grey overlap seams."""
    U, V = P.uv(g)
    phase = (V + tilt * (U // 7)) % 5
    course = (V + tilt * (U // 7)) // 5
    shade = base + (course % 2)
    P._paint(g, m, WRAP, shade)
    P.flat(g, m & (phase == 0), "gray", 3)
    P.flat(g, m & (phase == 1), WRAP, 5)
    P.flat(g, m & (phase == 2) & ((course + seed) % 3 == 0), WRAP, 7)


def leg(s: int) -> Grid:
    g = Grid(*S)
    x0, x1 = CX + s * 4 - 2.8, CX + s * 4 + 2.8
    foot_z = 18.5 if s < 0 else 22.5  # one foot forward, one back: a stiff stride
    m = limb(g, "x", (12, 22), (3, foot_z + 2.5), 3.2, 2.8, x0, x1, WRAP, 5, cap=0.3)
    foot = box(g, x0 - 0.5, 0, foot_z - 3, x1 + 0.5, 4, foot_z + 5, WRAP, 5)
    wraps(g, m | foot, seed=20 + s, tilt=s)
    P.flat(g, foot & (coords(g)[1] < 1), WRAP, 4)
    return g


def hips() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(12, 17), (12, 27), (18.5, 27.5), (18.5, 16.5)], CX - 7.5, CX + 7.5, WRAP, 5)
    wraps(g, m, seed=3, tilt=-1)
    belt = m & (Y >= 16)
    P.flat(g, belt, "gold", 4)
    P.flat(g, belt & (Y == 16), "gold", 3)
    P.flat(g, belt & (Z < 17.5) & (np.abs(X + 0.5 - CX) < 1.5), "teal", 6)  # buckle gem
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(18.5, 17), (18.5, 27), (27, 28), (31, 25.5), (31, 17.5), (27, 16.3)], CX - 7.5, CX + 7.5, WRAP, 5)
    yoke = side(g, [(25.5, 17), (25.5, 26.5), (31, 25), (31, 17.5)], CX - 10, CX + 10, WRAP, 5)
    wraps(g, body | yoke, seed=5)
    # the gold scarab collar: a broad plate with a magenta and toxic gem
    collar = plan(g, octo(CX, 21.5, 9.5, 5.8, 2.5), 29.5, 31.5, "gold", 5, top=octo(CX, 21.5, 8.5, 5.0, 2.0))
    P.flat(g, collar & ((X + Z) % 3 == 0), "gold", 4)
    P.outline(g, collar, "gold", 3, normal="y")
    P.flat(g, collar & (Z < 18) & (np.abs(X + 0.5 - CX) < 2.5), "magenta", 5)
    P.flat(g, collar & (Z < 17) & (np.abs(X + 0.5 - CX) < 1.2), "toxic", 7)
    # a painted ankh on the chest wraps (magic, C3)
    ankh = [".###.", "#...#", "#...#", ".###.", "#####", "..#..", "..#..", "..#.."]
    pnglyph.stamp(g, "-z", 16.3, CX - 3, 19, ankh, {"#": C("gold", 5)}, depth=2, reach=2)
    scarab = ["..mmm..", ".mm#mm.", "mmmtmmm", "mmtttmm", ".mm#mm.", "...m...", "..mmm.."]
    inks = {"m": C("magenta", 5), "t": C("toxic", 7), "#": C("gold", 6)}
    pnglyph.stamp(g, "-z", 16.3, CX - 3, 24, scarab, inks, depth=2, reach=2)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, 21, 31, 44, 7.5, 7, 2.2, WRAP, 5, taper=1.3, lean=(-1.0, 0.6))
    wraps(g, skull, seed=7, tilt=1)
    # a dark eye slit frames two toxic eyes with ember glints
    face_z = 14.0
    eye = {"k": C("purple", 1), "g": C("toxic", 6), "G": C("toxic", 7), "o": C("ember", 5)}
    rows = [
        "kkkkk...kkkkk",
        "kgggk...kgggk",
        "kGogk...kGogk",
        "kGGgk...kGGgk",
        "kgggk...kgggk",
        "kkkkk...kkkkk",
    ]
    pnglyph.stamp(g, "-z", face_z, CX - 6, 35, rows, eye, depth=2, reach=3)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 11.0
    x0, x1 = sx - 2.4, sx + 2.4
    m = limb(g, "x", (29, 22), (27.5, 8), 2.9, 2.5, x0, x1, WRAP, 5, cap=0.3)
    hand = box(g, sx - 3, 25, 2, sx + 3, 30, 8, WRAP, 5)
    wraps(g, m, seed=11 + s, tilt=s)
    wraps(g, hand, seed=12 + s, tilt=-s)
    P.outline(g, hand, "gray", 3, normal="z")
    # Three attached bone fingers extend below the palm. A stepped thumb
    # breaks the square outline at the outer side of each hand.
    for k in range(3):
        fx = sx - 2.5 + k * 2.0
        finger = box(g, fx, 22, 0.5, fx + 1.3, 26, 3.5, "bone", 5 + (k % 2))
        P.flat(g, finger & (Y <= 23), "bone", 7)
    thumb_x0, thumb_x1 = (sx + 2.3, sx + 4.0) if s > 0 else (sx - 4.0, sx - 2.3)
    thumb = box(g, thumb_x0, 25, 3, thumb_x1, 28, 7, "bone", 5)
    P.flat(g, thumb & (Y == 27), "bone", 7)
    return g


def build():
    parts = {"hips": hips(), "torso": torso(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "leg-l": leg(-1), "leg-r": leg(1)}
    root = assemble(parts, [
        ("hips", None, HIP),
        ("leg-l", "hips", LEG["leg-l"]),
        ("leg-r", "hips", LEG["leg-r"]),
        ("torso", "hips", WAIST),
        ("head", "torso", NECK),
        ("arm-l", "torso", SHOULDER["arm-l"]),
        ("arm-r", "torso", SHOULDER["arm-r"]),
    ])
    idle = {"torso": {"rot": keys((0, (0, -8, 4)), (1.3, (0, 8, -4)), (2.6, (0, -8, 4)))},
            "leg-l": {"rot": keys((0, (-12, 0, 0)), (1.3, (6, 0, 0)), (2.6, (-12, 0, 0)))},
            "leg-r": {"rot": keys((0, (6, 0, 0)), (1.3, (-12, 0, 0)), (2.6, (6, 0, 0)))},
            "arm-l": {"rot": keys((0, (-6, 0, 0)), (1.3, (4, 0, 0)), (2.6, (-6, 0, 0)))},
            "arm-r": {"rot": keys((0, (4, 0, 0)), (1.3, (-6, 0, 0)), (2.6, (4, 0, 0)))},
            "head": {"rot": keys((0, (0, 0, -10)), (1.3, (0, 0, 10)), (2.6, (0, 0, -10)))}}
    # Attack, a double-fisted hammer blow: it rocks back, leans away and
    # heaves both wrapped arms overhead (frames 0-15), steps in on the front
    # foot and clubs them down in 4 frames to the blow on frame 19, sags past
    # it, holds, and recovers by frame 44; the head settles last. The back
    # foot stays planted (the leg counter-swings under the moving hips).
    attack = {"hips": {"loc": keys((0, Z3), (fr(15), (0, 0.1, 1.5)), (fr(19), (0, 0.3, -3)), (fr(22), (0, 0.2, -4.5)),
                                   (fr(25), (0, 0.1, -5.8)), (fr(33), Z3))},
              "leg-r": {"rot": keys((0, Z3), (fr(15), (5.7, 0, 0)), (fr(19), (-11.5, 0, 0)), (fr(22), (-17.5, 0, 0)),
                                    (fr(25), (-22.7, 0, 0)), (fr(33), Z3))},
              "leg-l": {"rot": keys((0, Z3), (fr(15), (5.7, 0, 0)), (fr(17), (18, 0, 0)), (fr(19), (19.5, 0, 0)),
                                    (fr(22), (13.5, 0, 0)), (fr(25), (12.3, 0, 0)), (fr(28), (12.3, 0, 0)), (fr(33), Z3)),
                        "loc": keys((0, Z3), (fr(15), Z3), (fr(17), (0, 1.8, 0)), (fr(19), Z3), (fr(29), Z3), (fr(31), (0, 1.5, 0)), (fr(33), Z3))},
              "torso": {"rot": keys((0, Z3), (fr(15), (14, 6, 0)), (fr(19), (-24, -4, 0)), (fr(22), (-30, -6, 0)),
                                    (fr(25), (-33, -7, 0)), (fr(33), Z3))},
              "arm-l": {"rot": keys((0, Z3), (fr(8), (70, 0, 6)), (fr(15), (125, 0, 10)), (fr(19), (-30, 0, 4)),
                                    (fr(22), (-40, 0, 2)), (fr(24), (-30, 0, -8)), (fr(26), (-48, 0, 4)), (fr(33), Z3))},
              "arm-r": {"rot": keys((0, Z3), (fr(8), (70, 0, -6)), (fr(15), (125, 0, -10)), (fr(19), (-30, 0, -4)),
                                    (fr(22), (-40, 0, -2)), (fr(25), (-32, 0, 8)), (fr(27), (-48, 0, -4)), (fr(33), Z3))},
              "head": {"rot": keys((0, Z3), (fr(15), (16, 0, 0)), (fr(20), (-12, 0, 0)), (fr(22), (-22, 0, 4)), (fr(24), (-18, 12, 0)), (fr(26), (-20, -12, 2)),
                                   (fr(28), (-8, 4, 2)), (fr(30), (3, 0, 0)), (fr(33), Z3))}}
    # Hit: the blow snaps the torso back on frame 3 (the hips give a voxel,
    # the legs counter-swing so the feet stay put), it sways forward past
    # rest and settles; the head and the arms lag behind.
    # Hit: the blow on frame 3 shoves it back with a little pop up; it hangs
    # a beat, lands, sways forward past rest with its weight and settles; the
    # head snaps back and the loose parts trail. See _fall.hit_back.
    hit, hit_hit = hit_back("hips", foot=(-15, 4.5, -6.5), push=3.0, pop=1.2, tilt=12, head=("head", 22), arms={"arm-l": (24, -1), "arm-r": (28, 1)},
                            extra={"torso": lambda t: keys((0, Z3), (fr(4), (10, -6, 0)), (fr(9), (6, -3, 0)), (fr(t["O"]), (-5, 0, 0)), (fr(t["E"]), Z3))})
    # Death: it rocks forward over its toes, teeters back onto its heels with
    # the arms thrown up, catches itself for a beat, then topples over
    # backwards (away from the attacker), fastest at the floor on the impact
    # frame, thuds, bounces once and settles on its back; the arms, the legs
    # and the head land late. See _fall.py for the beats.
    death, death_hit = fall_back("hips", D=9.5, F=10.0, bounce=2.3, bspan=3, R=86.0, roll=-5.0, torso="torso",
                                 legs={"leg-l": (-14, 0, -6), "leg-r": (0, 0, 8)},
                                 arms={"arm-l": ((-97, 0, -40), -1, 10.0), "arm-r": ((-85, 0, 40), 1, 10.0)},
                                 head=("head", (5, 0, -15)), settle=-1.0)
    eye = (3.5, 37.5 - HIP[1], 14.0 - HIP[2])  # the glowing eye is on the viewer's left (+x)
    return world("mummy", "creatures", "Bandaged Mummy", root,
                 clips=[Clip("attack", attack, loop=False, impact=fr(19)), Clip("hit", hit, loop=False, impact=hit_hit), Clip("death", death, loop=False, impact=death_hit), Clip("idle", idle), Clip("move", mummy_move({n: sole_points(parts[n], LEG[n]) for n in LEG}), ease=0)],
                 sockets=[Socket("socket-eye", at=eye, parent="head")],
                 pfx=[pfx("rvx-monster-curse-cloud", "socket-eye", "clip:attack", size=26, at=0.4)])
