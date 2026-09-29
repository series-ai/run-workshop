"""Bandaged mummy, in the Pirate Nation creature style.

A chunky caricature in the family of the werewolf: a big bandaged
head with a dark eye slit, one huge glowing toxic eye and one dim ember; a
stiff, broad torso under a gold scarab collar with a teal gem; long arms
stretched straight out in the classic lurch, loose bandage strips trailing
from the wrists and hips; stumpy wrapped legs. The wraps are paint: bands
that spiral round every limb in yellowed sand tones with dark seams (S1).
Limbs and head are true-slope prisms. Clips: idle (lurch), attack (grab),
hit, death (unravel and collapse). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _kit import keys, pfx, world
from _life import assemble, chunk, coords, limb, octo, plan, side
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

S = (40, 46, 40)
CX = 20
WRAP = "sand"
HIP = (CX, 15.0, 22.0)
WAIST = (CX, 17.0, 22.0)
NECK = (CX, 31.0, 21.0)
SHOULDER = {"arm-l": (CX - 9.5, 29.0, 21.0), "arm-r": (CX + 9.5, 29.0, 21.0)}
LEG = {"leg-l": (CX - 4.0, 15.0, 22.0), "leg-r": (CX + 4.0, 15.0, 22.0)}


def wraps(g: Grid, m: np.ndarray, seed: int, tilt: int = 1, base: int = 5) -> None:
    """Bandage bands 3 voxels tall wrapped round the mask: every 4 voxels
    along the surface a band steps up or down one voxel (overlapping wraps),
    alternate bands one shade lighter, a dark seam under each band."""
    U, V = P.uv(g)
    off = ((U // 4) * tilt) % 3
    row = (V + off) // 3
    lift = (P._hash(row, U // 8, seed=seed) % np.uint64(4)) == 0
    shade = base + (row % 2) - lift.astype(np.int64)
    shade = np.where((V + off) % 3 == 0, base - 2, shade)
    P._paint(g, m, WRAP, shade)


def strip(g: Grid, x, y0, z, length: float, sway: float, s: int = 1) -> np.ndarray:
    """A loose bandage strip hanging from (x, y0, z), a thin slanted slab."""
    m = limb(g, "z", (x, y0), (x + s * sway, y0 - length), 2.0, 1.6, z, z + 1.2, WRAP, 6, cap=0.3)
    P.flat(g, m & (coords(g)[1] < y0 - length * 0.6), WRAP, 5)
    return m


def leg(s: int) -> Grid:
    g = Grid(*S)
    x0, x1 = CX + s * 4 - 2.8, CX + s * 4 + 2.8
    foot_z = 18.5 if s < 0 else 22.5  # one foot forward, one back: a stiff stride
    m = limb(g, "x", (15, 22), (3, foot_z + 2.5), 3.2, 2.8, x0, x1, WRAP, 5, cap=0.3)
    foot = box(g, x0 - 0.5, 0, foot_z - 3, x1 + 0.5, 4, foot_z + 5, WRAP, 5)
    wraps(g, m | foot, seed=20 + s, tilt=s)
    P.flat(g, foot & (coords(g)[1] < 1), WRAP, 3)
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
    strip(g, CX - 5, 13, 16, 6, 1.0, -1)  # a loose loincloth strip
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(17, 17), (17, 27), (27, 28), (31, 25.5), (31, 17.5), (27, 16.3)], CX - 7.5, CX + 7.5, WRAP, 5)
    yoke = side(g, [(25.5, 17), (25.5, 26.5), (31, 25), (31, 17.5)], CX - 10, CX + 10, WRAP, 5)
    wraps(g, body | yoke, seed=5)
    # the gold scarab collar: a broad flat plate round the neck with a teal gem
    collar = plan(g, octo(CX, 21.5, 9.5, 5.8, 2.5), 29.5, 31.5, "gold", 5, top=octo(CX, 21.5, 8.5, 5.0, 2.0))
    P.flat(g, collar & ((X + Z) % 3 == 0), "gold", 4)
    P.outline(g, collar, "gold", 3, normal="y")
    P.flat(g, collar & (Z < 18) & (np.abs(X + 0.5 - CX) < 2.5), "teal", 5)
    P.flat(g, collar & (Z < 17) & (np.abs(X + 0.5 - CX) < 1.2), "teal", 7)
    # a painted ankh on the chest wraps (magic, C3)
    ankh = [".###.", "#...#", "#...#", ".###.", "#####", "..#..", "..#..", "..#.."]
    pnglyph.stamp(g, "-z", 16.3, CX - 3, 19, ankh, {"#": C("gold", 5)}, depth=2, reach=2)
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, 21, 31, 44, 7.5, 7, 2.2, WRAP, 5, taper=1.3, lean=(-0.4, 0.3))
    wraps(g, skull, seed=7, tilt=1)
    # the eye slit: a dark band, one huge glowing toxic eye, one dim ember
    face_z = 14.0
    eye = {"k": C("purple", 1), "g": C("toxic", 6), "G": C("toxic", 7), "e": C("ember", 3), "s": C(WRAP, 3)}
    rows = [
        "sssssssssssss",
        "kkggggkkkkkkk",
        "kgGGggkkkeekk",
        "kgGGggkkkeekk",
        "kkggggkkkkkkk",
        "sssssssssssss",
    ]
    pnglyph.stamp(g, "-z", face_z, CX - 6, 35, rows, eye, depth=2, reach=3)
    # a loose flap over the brow, hanging off one side
    flap = limb(g, "z", (CX + 6.5, 41), (CX + 9, 36), 1.2, 1.0, 17, 19, WRAP, 6, cap=0.3)
    P.flat(g, flap & (Y < 38), WRAP, 5)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 9.5
    x0, x1 = sx - 2.4, sx + 2.4
    m = limb(g, "x", (29, 22), (27.5, 8), 2.9, 2.5, x0, x1, WRAP, 5, cap=0.3)
    hand = box(g, sx - 3, 25, 2, sx + 3, 30, 8, WRAP, 5)
    wraps(g, m, seed=11 + s, tilt=s)
    wraps(g, hand, seed=12 + s, tilt=-s)
    # fingers: dark gaps painted across the front of the hand
    P.flat(g, hand & (Z < 3) & ((X - int(sx)) % 2 == 0) & (Y < 29), WRAP, 3)
    strip(g, sx + s * 1.5, 26, 11, 9, 1.5, s)  # a long strip trailing from the wrist
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
    attack = {"arm-l": {"rot": keys((0, (0, 0, 0)), (0.3, (-35, -20, 0)), (0.55, (18, 25, 0)), (1.0, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.3, (-35, 20, 0)), (0.55, (18, -25, 0)), (1.0, (0, 0, 0)))},
              "torso": {"rot": keys((0, (0, 0, 0)), (0.3, (-8, 0, 0)), (0.55, (18, 0, 0)), (1.0, (0, 0, 0)))},
              "head": {"rot": keys((0, (0, 0, 0)), (0.3, (-12, 0, 0)), (0.55, (10, 0, 0)), (1.0, (0, 0, 0)))}}
    hit = {"torso": {"rot": keys((0, (0, 0, 0)), (0.1, (-18, -10, 0)), (0.5, (0, 0, 0)))},
           "head": {"rot": keys((0, (0, 0, 0)), (0.1, (-20, 12, 0)), (0.5, (0, 0, 0)))}}
    death = {"hips": {"loc": keys((0, (0, 0, 0)), (1.2, (0, -9, 0))), "scale": keys((0, (1, 1, 1)), (1.2, (1.3, 0.45, 1.3)))},
             "torso": {"rot": keys((0, (0, 0, 0)), (1.2, (30, 40, 0)))}, "head": {"rot": keys((0, (0, 0, 0)), (1.2, (40, 0, 30)))},
             "arm-l": {"rot": keys((0, (0, 0, 0)), (1.2, (60, 0, -30)))}, "arm-r": {"rot": keys((0, (0, 0, 0)), (1.2, (60, 0, 30)))}}
    eye = (3.5, 37.5 - HIP[1], 14.0 - HIP[2])  # the glowing eye is on the viewer's left (+x)
    return world("mummy", "creatures", "Bandaged Mummy", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-eye", at=eye, parent="head")],
                 pfx=[pfx("rvx-monster-curse-cloud", "socket-eye", "clip:attack", size=26, at=0.4)])
