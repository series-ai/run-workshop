"""Zombie ghoul, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf and PN Kevin (the
zombie world boss): a huge lolling head (a third of the height) with one
bulging pale eye and one glowing toxic socket, a hanging jaw full of crooked
teeth, a stitched scar and a cracked skull cap that shows the brain; a hunched torso in a torn rust shirt
with bone ribs showing; long reaching arms with oversized clawed hands;
short legs in patched purple trousers and bare clawed feet. Limbs, head and
body are true-slope prisms; skin, cloth and wounds are painted. Clips:
idle (shamble sway), attack (grab), hit, death (collapse). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes
import pnpaint
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, limb, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

S = (40, 46, 36)
CX = 20
SKIN, SHIRT, PANTS = "teal", "rust", "purple"
HIP = (CX, 15.0, 24.0)
WAIST = (CX, 17.0, 24.0)
NECK = (CX, 29.0, 18.0)
SHOULDER = {"arm-l": (CX - 10.0, 28.0, 22.0), "arm-r": (CX + 10.0, 28.0, 22.0)}
KNEE = {"leg-l": (CX - 4.5, 15.0, 24.0), "leg-r": (CX + 4.5, 15.0, 24.0)}


def skin(g: Grid, m: np.ndarray, seed: int) -> None:
    """Zombie hide: soft teal mottling with darker rot blotches (S3)."""
    P.mottle(g, m, SKIN, 5, cell=3, seed=seed)
    pnpaint.blotch(g, m, SKIN, 3, cell=2, chance=0.05, seed=seed + 1)


def leg(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = CX + s * 4.5 - 2.5, CX + s * 4.5 + 2.5
    thigh = limb(g, "x", (15, 24), (8, 22.5), 3.0, 2.7, x0, x1, PANTS, 4, cap=0.4)
    shin = limb(g, "x", (8.5, 22.5), (2.5, 24), 2.5, 2.3, x0 + 0.5, x1 - 0.5, SKIN, 5, cap=0.4)
    foot = box(g, x0 - 0.5, 0, 19, x1 + 0.5, 3, 27, SKIN, 5)
    skin(g, shin | foot, seed=20 + s)
    P.mottle(g, thigh, PANTS, 4, cell=3, seed=22 + s)
    # a ragged hem: skin shows through a zigzag, and a magenta patch on one knee
    P.flat(g, thigh & (Y < 10) & (((X + Z) % 3) == 0), SKIN, 4)
    if s < 0:
        P.flat(g, thigh & (Y >= 10) & (Y < 13) & (Z < 22), "magenta", 4)
    for k in range(3):  # toe claws
        cxk = x0 + 0.5 + k * 2
        claw(g, "x", (1.5, 19.5), (0.3, 16.8), 1.2, cxk, cxk + 1.2, "bone", 6)
    return g


def hips() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(12, 19), (12, 29), (18, 29), (18, 19)], CX - 8, CX + 8, PANTS, 4)
    P.mottle(g, m, PANTS, 4, cell=3, seed=3)
    rope = m & (Y >= 16)
    P.flat(g, rope, "sand", 5)
    P.flat(g, rope & ((X + Y) % 3 == 0), "sand", 3)  # twisted rope
    P.flat(g, m & (Y < 15) & (np.abs(X + 0.5 - CX) < 0.8) & (Z < 21), PANTS, 2)  # fly seam
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(16, 18), (16, 30), (23, 31.5), (29, 29.5), (31, 23), (29, 16), (23, 16.5)], CX - 8, CX + 8, SHIRT, 5)
    yoke = side(g, [(24, 17), (24, 29), (31, 27), (31.5, 18)], CX - 10.5, CX + 10.5, SHIRT, 5)
    hump = side(g, [(25, 26), (30.5, 29.5), (31, 24)], CX - 5, CX + 5, SKIN, 5)
    m = body | yoke
    P.mottle(g, m, SHIRT, 5, cell=3, seed=5)
    P.flat(g, m & (Y < 17.5), SHIRT, 3)  # tattered hem shadow
    P.flat(g, m & (Y < 18.5) & ((X % 4) == 1), SKIN, 4)
    skin(g, hump, seed=6)
    # a torn hole across the chest shows dark hide and bone ribs (S1: paint)
    hole = m & (Z < 20) & (np.abs(X + 0.5 - (CX - 2)) < 5) & (Y >= 19) & (Y < 27)
    P.flat(g, hole, SKIN, 2)
    P.flat(g, hole & (Y % 2 == 0) & (np.abs(X + 0.5 - (CX - 2)) < 4) & (np.abs(X + 0.5 - CX) > 0.6), "bone", 6)
    P.flat(g, hole & (np.abs(X + 0.5 - CX) < 0.8), "bone", 5)  # breastbone
    P.flat(g, m & (Z < 20) & (Y >= 21) & (Y < 25) & (X >= CX + 3) & (X < CX + 7), "blood", 4)  # wound
    P.flat(g, m & (Z < 20) & (Y >= 22) & (Y < 24) & (X >= CX + 4) & (X < CX + 6), "red", 5)
    # buttons and a patch
    for by in (18, 20):
        P.flat(g, m & (Z < 19) & (X == CX + 1) & (Y == by), "bone", 6)
    P.flat(g, m & (Z > 29) & (Y >= 20) & (Y < 24) & (X >= CX - 5) & (X < CX), "purple", 5)
    return g


def head() -> Grid:
    """Kevin-sized caricature head: a big chamfered block lolling forward,
    a hanging jaw, mismatched eyes and a cracked cap showing the brain."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, 17, 30, 42, 8, 7.5, 2.5, SKIN, 5, taper=1.2, lean=(0.6, 0.4))
    jaw = side(g, [(27.5, 11), (27.5, 20), (31, 21), (31, 11.5)], CX - 6, CX + 6, SKIN, 4)
    ear = box(g, CX + 7, 34, 16, CX + 9.5, 38, 19, SKIN, 5)
    skin(g, skull | ear, seed=7)
    P.mottle(g, jaw, SKIN, 4, cell=2, seed=8)
    face_z = 9.5
    # mouth: a dark red gape with crooked bone teeth (paint on the jaw front)
    mouth = jaw & (Z < 12.5) & (Y >= 28) & (Y < 31) & (np.abs(X + 0.5 - CX) < 5)
    P.flat(g, mouth, "blood", 2)
    P.flat(g, mouth & (Y >= 30) & (X % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < 29) & (X % 3 == 1), "bone", 5)
    P.flat(g, skull & (Z < 11) & (Y >= 31) & (Y < 32) & (np.abs(X + 0.5 - CX) < 5.5) & (X % 2 == 1), "bone", 7)  # upper teeth
    # eyes: a bulging pale left eye with a tiny pupil, a glowing toxic right socket
    eye = {"k": C(SKIN, 2), "w": C("bone", 7), "e": C("bone", 5), "p": C("gray", 1), "g": C("toxic", 6), "G": C("toxic", 7)}
    rows = [
        ".kkkkk...kkkkk.",
        "kwwwwwk.kgggggk",
        "kwwwwwk.kgGGggk",
        "kwwppwk.kgGGggk",
        "kwwppwk.kgggggk",
        "kewwwek..kkkkk.",
        ".kkkkk.........",
    ]
    pnglyph.stamp(g, "-z", face_z, CX - 7, 33, rows, eye, depth=2, reach=3)
    # a stitched scar over the right brow and a nose hole
    scar = skull & (Z < 12) & (Y == 40) & (X >= CX + 1) & (X < CX + 7)
    P.flat(g, scar, SKIN, 2)
    P.flat(g, skull & (Z < 12) & (Y == 41) & (X >= CX + 2) & (X < CX + 7) & (X % 2 == 0), SKIN, 2)
    P.flat(g, skull & (Z < 12) & (Y >= 32) & (Y < 33) & (np.abs(X + 0.5 - CX) < 1.2), SKIN, 2)
    # sunlit crown
    P.flat(g, skull & (Y >= 41), SKIN, 6)
    # the PN zombie mark: a cracked skull cap with the brain showing (C3)
    brain = skull & (Y >= 41) & (np.abs(X + 0.5 - (CX - 2)) < 3.6) & (np.abs(Z + 0.5 - 16) < 3.2 + (X % 2))
    P.flat(g, brain, "magenta", 6)
    P.flat(g, brain & (((X + 2 * Z) % 5) == 0), "magenta", 4)
    P.outline(g, brain, SKIN, 3, normal="y")
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 10
    x0, x1 = sx - 2.5, sx + 2.5
    sleeve = limb(g, "x", (29, 22), (22, 15), 3.2, 2.8, x0 - 0.5, x1 + 0.5, SHIRT, 5, cap=0.4)
    fore = limb(g, "x", (22.5, 15.5), (21, 6), 2.4, 2.2, x0, x1, SKIN, 5, cap=0.4)
    hand = box(g, sx - 3, 16, 1, sx + 3, 22, 7, SKIN, 5)
    skin(g, fore | hand, seed=11 + s)
    P.mottle(g, sleeve, SHIRT, 5, cell=3, seed=13 + s)
    P.flat(g, sleeve & (Y < 21) & ((Y + Z) % 3 == 0), SKIN, 4)  # torn cuff
    P.flat(g, hand & (Y < 17), SKIN, 4)
    for k in range(4):  # four long hooked claws, down and forward
        cxk = sx - 3 + k * 1.5
        claw(g, "x", (17, 2.5), (12.2, 0.4), 1.3, cxk, cxk + 1.2, "bone", 6)
    return g


def build():
    parts = {"hips": hips(), "torso": torso(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "leg-l": leg(-1), "leg-r": leg(1)}
    root = assemble(parts, [
        ("hips", None, HIP),
        ("leg-l", "hips", KNEE["leg-l"]),
        ("leg-r", "hips", KNEE["leg-r"]),
        ("torso", "hips", WAIST),
        ("head", "torso", NECK),
        ("arm-l", "torso", SHOULDER["arm-l"]),
        ("arm-r", "torso", SHOULDER["arm-r"]),
    ])
    idle = {"torso": {"rot": keys((0, (6, 0, -5)), (1.1, (6, 0, 5)), (2.2, (6, 0, -5)))},
            "head": {"rot": keys((0, (0, 0, 14)), (1.1, (8, 0, -10)), (2.2, (0, 0, 14)))},
            "arm-l": {"rot": keys((0, (-10, 0, 0)), (1.1, (6, 0, 0)), (2.2, (-10, 0, 0)))},
            "arm-r": {"rot": keys((0, (6, 0, 0)), (1.1, (-10, 0, 0)), (2.2, (6, 0, 0)))},
            "leg-l": {"rot": keys((0, (-10, 0, 0)), (1.1, (10, 0, 0)), (2.2, (-10, 0, 0)))},
            "leg-r": {"rot": keys((0, (10, 0, 0)), (1.1, (-10, 0, 0)), (2.2, (10, 0, 0)))}}
    attack = {"hips": {"loc": keys((0, (0, 0, 0)), (0.26, (0, 0, 2)), (0.5, (0, 1, -5)), (0.72, (0, 1, -4)), (1.1, (0, 0, 0)))},
              "torso": {"rot": keys((0, (0, 0, 0)), (0.26, (-8, -18, -4)), (0.5, (18, 24, 8)), (0.72, (10, 12, 4)), (1.1, (0, 0, 0)))},
              "arm-l": {"rot": keys((0, (0, 0, 0)), (0.26, (12, 0, -15)), (0.5, (5, 0, -18)), (0.72, (40, 0, -8)), (1.1, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.26, (95, 0, 18)), (0.5, (20, 0, 12)), (0.72, (8, 0, 6)), (1.1, (0, 0, 0)))},
              "head": {"rot": keys((0, (0, 0, 0)), (0.26, (-12, 16, 0)), (0.5, (20, -20, 0)), (1.1, (0, 0, 0)))}}
    hit = {"torso": {"rot": keys((0, (0, 0, 0)), (0.1, (-20, 10, 0)), (0.5, (0, 0, 0)))},
           "head": {"rot": keys((0, (0, 0, 0)), (0.1, (-30, 0, 20)), (0.5, (0, 0, 0)))}}
    death = {"hips": {"loc": keys((0, (0, 0, 0)), (0.6, (0, -6, 0)), (1.0, (0, -11, -4))), "rot": keys((0, (0, 0, 0)), (0.6, (10, 0, 0)), (1.0, (80, 0, 0)))},
             "head": {"rot": keys((0, (0, 0, 0)), (1.0, (20, 0, 35)))},
             "arm-l": {"rot": keys((0, (0, 0, 0)), (1.0, (-40, 0, -30)))}, "arm-r": {"rot": keys((0, (0, 0, 0)), (1.0, (-40, 0, 30)))},
             "leg-l": {"rot": keys((0, (0, 0, 0)), (0.6, (-40, 0, 0)), (1.0, (-70, 0, 0)))}, "leg-r": {"rot": keys((0, (0, 0, 0)), (0.6, (-30, 0, 0)), (1.0, (-75, 0, 0)))}}
    mouth = (0.0, 29.0 - HIP[1], 10.0 - HIP[2])
    return world("zombie-ghoul", "creatures", "Zombie Ghoul", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="head")],
                 pfx=[pfx("rvx-monster-rot-poof", "socket-mouth", "clip:death", size=32, at=0.2)])
