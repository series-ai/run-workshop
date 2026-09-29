"""Vampire Lord (boss), in the Pirate Nation world-boss style.

A towering chunky caricature in the family of the werewolf and PN
Kevin (the zombie world boss): a huge square head (a third of his height)
with slicked violet hair and a widow's peak, pointed ears, angry brow slabs
over glowing red eyes, a wide grin with two long fangs; a tall stand-up
collar that fans out behind the head, purple outside and crimson inside; a
broad V-shaped coat with gold trims, spiked gold pauldrons, a red vest,
a white cravat and a big gold medallion with a blood-red gem; a heavy
cape falling to the ground behind him; long arms
ending in oversized clawed hands; short legs in pointed boots under a
flared coat skirt; and two vast bat wings spreading from his back, lined
in crimson toward the front. Every volume is a true-slope prism; the
cloth, trims, skin and membranes are paint. Wingspan about 170, height
about 118 (PN world bosses: 180–270 long, 80–130 tall).
Clips: idle (wings breathe, head turns), attack (wings flare, claw sweep),
hit, death (wings fold, he falls). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _kit import keys, pfx, world
from _life import assemble, chunk, claw, coords, front, limb, octo, plan, side
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

S = (184, 124, 70)
CX, CZ = 92, 32
COAT, LINING, TRIM, SKIN = "purple", "blood", "gold", "bone"
HIP = (CX, 30.0, CZ)
NECK = (CX, 74.0, CZ - 1.0)
SHOULDER = {"arm-l": (CX - 24.0, 68.0, CZ), "arm-r": (CX + 24.0, 68.0, CZ)}
WINGROOT = {"wing-l": (CX - 12.0, 70.0, CZ + 17.0), "wing-r": (CX + 12.0, 70.0, CZ + 17.0)}


def cloth(g: Grid, m: np.ndarray, ramp: str, base: int, seed: int) -> None:
    """Heavy coat cloth: soft 3D mottling and a dark 1-voxel hem on the
    lowest row (rule S3)."""
    P.mottle(g, m, ramp, base, cell=4, seed=seed)


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    legs = np.zeros(g.shape, dtype=bool)
    boots = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        lx = CX + s * 9
        legs |= plan(g, octo(lx, CZ, 7, 7, 2), 9, 34, COAT, 2, top=octo(lx, CZ, 8, 8, 2.5))
        boots |= plan(g, octo(lx, CZ - 1, 8.5, 9, 2.5), 0, 11, COAT, 3, top=octo(lx, CZ, 7.5, 7.5, 2.5))
        boots |= side(g, [(0, CZ - 9), (0, CZ - 19), (3, CZ - 19.5), (7, CZ - 9)], lx - 6, lx + 6, COAT, 3)  # pointed toe
    cloth(g, legs, COAT, 2, seed=1)
    P.mottle(g, boots, COAT, 3, cell=2, seed=2)
    P.flat(g, boots & (Y >= 9) & (Y < 11), TRIM, 4)  # gold boot cuffs
    # a flared coat skirt and the broad V-shaped coat (true slopes)
    skirt = plan(g, octo(CX, CZ + 1, 23, 18.5, 6), 18, 42, COAT, 5, top=octo(CX, CZ, 18, 14.5, 5))
    coat = plan(g, octo(CX, CZ, 18, 14.5, 5), 42, 72, COAT, 5, top=octo(CX, CZ, 26, 16, 6))
    cloth(g, skirt | coat, COAT, 5, seed=3)
    P.flat(g, skirt & (Y < 19), COAT, 2)
    P.flat(g, skirt & (Y >= 19) & (Y < 21), TRIM, 5)  # gold hem band
    # front: an open coat over a red vest and a white cravat, with gold trims
    front_z = Z < CZ - 11
    vest = (skirt | coat) & front_z & (np.abs(X + 0.5 - CX) < 7 + (Y - 30) * 0.06) & (Y >= 30)
    P.flat(g, vest, "red", 4)
    P.flat(g, vest & ((Y % 6) == 0), "red", 3)
    P.flat(g, vest & (np.abs(X + 0.5 - CX) < 0.8) & ((Y % 5) == 2) & (Y < 56), TRIM, 6)  # buttons
    P.flat(g, (skirt | coat) & front_z & (np.abs(np.abs(X + 0.5 - CX) - (7.5 + (Y - 30) * 0.06)) < 1.1) & (Y >= 21), TRIM, 5)  # lapel trims
    cravat = coat & front_z & (np.abs(X + 0.5 - CX) < 5) & (Y >= 62)
    P.flat(g, cravat, "bone", 7)
    P.flat(g, cravat & (Y == 62), "bone", 5)
    P.flat(g, coat & (Y >= 44) & (Y < 47), TRIM, 4)  # belt
    P.flat(g, coat & (Y >= 44) & (Y < 47) & front_z & (np.abs(X + 0.5 - CX) < 3), TRIM, 6)
    # the big gold medallion with a blood-red gem (the socket-chest aura)
    med = front(g, octo(CX, 55, 6.5, 6.5, 2), CZ - 17.5, CZ - 13, TRIM, 5)
    P.outline(g, med, TRIM, 3, normal="z")
    P.flat(g, med & (np.abs(X + 0.5 - CX) < 3) & (np.abs(Y + 0.5 - 55) < 3), "red", 5)
    P.flat(g, med & (np.abs(X + 0.5 - CX) < 1.2) & (np.abs(Y + 0.5 - 56) < 1.2), "ember", 7)
    # spiked gold-rimmed pauldrons
    pads = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        px = CX + s * 24
        pads |= chunk(g, px, CZ, 63, 75, 9.5, 12, 3.5, COAT, 4, taper=3)
        claw(g, "z", (px + s * 1, 73), (px + s * 4, 84), 2.4, CZ - 2, CZ + 2, TRIM, 5)  # a gold spike
    cloth(g, pads, COAT, 4, seed=4)
    P.flat(g, pads & (Y < 66), TRIM, 5)
    # a heavy cape falling from the shoulders to the ground behind him
    cape = plan(g, octo(CX, CZ + 21, 27, 7.5, 3), 1, 72, COAT, 4, top=octo(CX, CZ + 13.5, 20, 3.5, 1.5))
    P.planks(g, cape, COAT, 4, width=5, across="x", length=(80, 81), nails=False, seed=14)  # long folds
    P.flat(g, cape & (Y < 4), "red", 4)  # the crimson lining shows at the hem
    P.flat(g, cape & (Y >= 4) & (Y < 6), TRIM, 5)
    # the tall stand-up collar fanning out behind the head: crimson inside
    collar = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pts = [(CX + s * 4, 68), (CX + s * 20, 70), (CX + s * 30, 104), (CX + s * 20, 100), (CX + s * 10, 92)]
        collar |= front(g, pts, CZ + 10, CZ + 14, COAT, 4)
    P.flat(g, collar, COAT, 4)
    P.flat(g, collar & (Z < CZ + 11.5), LINING, 4)
    P.outline(g, collar, TRIM, 5, normal="z")
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull = chunk(g, CX, CZ - 1, 73, 102, 16, 15, 4.5, SKIN, 6, taper=2.5)
    jaw = chunk(g, CX, CZ - 3, 70, 75, 12, 12, 3, SKIN, 6, taper=-1.0)
    P.mottle(g, skull | jaw, SKIN, 6, cell=4, seed=5)
    # slicked-back hair: a side profile that rises over the brow and sweeps back and down
    hair = side(g, [(95, CZ - 15.5), (103, CZ - 13), (106.5, CZ - 2), (104, CZ + 10), (96, CZ + 17), (82, CZ + 17.5), (82, CZ + 9), (95, CZ + 6)], CX - 15.5, CX + 15.5, COAT, 3)
    P.planks(g, hair, COAT, 3, width=3, across="x", length=(40, 41), nails=False, seed=6)  # combed strands
    P.flat(g, hair & (Y >= 105), COAT, 5)
    # widow's peak: the hair dips to a point on the forehead
    peak = skull & (Z < CZ - 12) & (Y >= 96 - np.maximum(0, 6 - np.abs(X + 0.5 - CX))) & (Y < 100)
    P.flat(g, peak, COAT, 3)
    P.flat(g, skull & (Y >= 96), COAT, 3)
    ears = np.zeros(g.shape, dtype=bool)
    brow = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 15.5, 82), (CX + s * 15.5, 92), (CX + s * 25, 98)], CZ - 3, CZ + 3, SKIN, 6)
        brow |= front(g, [(CX + s * 1, 87.5), (CX + s * 14, 91.5), (CX + s * 14, 97), (CX + s * 1, 92.5)], CZ - 19, CZ - 13, COAT, 4)
    P.flat(g, ears & (np.abs(X + 0.5 - CX) > 17.5) & (np.abs(X + 0.5 - CX) < 21.5) & (Y < 92), "pink", 3)
    P.mottle(g, brow, COAT, 4, cell=2, seed=13)
    P.outline(g, brow, COAT, 2, normal="z")
    nose = side(g, [(80, CZ - 16), (88, CZ - 16), (80, CZ - 21)], CX - 2.5, CX + 2.5, SKIN, 6)
    P.flat(g, nose & (Y < 81), SKIN, 5)
    # glowing red eyes, shadowed cheeks and a wide fanged grin (paint)
    face = {"k": C(COAT, 2), "r": C("red", 5), "w": C("ember", 7), "o": C("red", 6), "s": C("purple", 6), "m": C(LINING, 2), "t": C("bone", 7)}
    rows = [
        ".kkkkkkkk.....kkkkkkkk.",
        "kwwoorrrk.....kwwoorrrk",
        "kworrrrrk.....kworrrrrk",
        "korrrrrrk.....korrrrrrk",
        ".kkkkkkk.......kkkkkkk.",
        ".......................",
        "sss.................sss",
        ".sss...............sss.",
        ".......................",
        "..mmmmmmmmmmmmmmmmmmm..",
        "..mmtmmmmmmmmmmmmmtmm..",
        "...mmmmmmmmmmmmmmmmm...",
    ]
    pnglyph.stamp(g, "-z", CZ - 16, CX - 11, 74, rows, face, depth=2, reach=4)
    for s in (-1, 1):
        claw(g, "z", (CX + s * 7, 77.5), (CX + s * 6.5, 70.5), 1.7, CZ - 18.0, CZ - 15.0, "bone", 7)  # long fangs
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 24
    upper = limb(g, "z", (sx, 70), (sx + s * 10, 50), 6.5, 5.8, CZ - 6.5, CZ + 6.5, COAT, 5, cap=0.4)
    fore = limb(g, "z", (sx + s * 10, 51), (sx + s * 16, 34), 5.8, 5.0, CZ - 6, CZ + 6, COAT, 5, cap=0.4)
    cloth(g, upper | fore, COAT, 5, seed=7 + s)
    hx = sx + s * 17
    cuff = plan(g, octo(hx, CZ, 7.5, 7.5, 2), 31, 37, "red", 4, top=octo(hx, CZ, 8.5, 8.5, 2.5))
    P.flat(g, cuff & (Y >= 36), TRIM, 5)
    hand = chunk(g, hx, CZ - 1, 20, 31, 7.5, 7, 2.2, SKIN, 6, taper=-0.8)
    P.mottle(g, hand, SKIN, 6, cell=3, seed=9 + s)
    P.flat(g, hand & (Y >= 28) & (Y < 30) & (np.abs(X + 0.5 - (hx - s * 3)) < 1.2), TRIM, 6)  # a gold ring
    for k in range(4):  # four long claws, down and forward, blood-tipped
        cxk = hx - 6 + k * 3.6
        claw(g, "x", (21.5, CZ - 6), (7.5, CZ - 11), 1.8, cxk, cxk + 2.0, "bone", 6)
    P.flat(g, (g.a > 0) & (Y < 10.5) & (np.abs(X + 0.5 - hx) < 8), "red", 4)
    return g


def wing(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    u = lambda v: CX + s * v  # noqa: E731
    z0, z1 = CZ + 15, CZ + 19
    pts = [(u(12), 66), (u(30), 98), (u(55), 116), (u(87), 106), (u(80), 78), (u(70), 88), (u(61), 58), (u(48), 72), (u(37), 44), (u(25), 56), (u(14), 48)]
    m = front(g, pts, z0, z1, COAT, 4)
    P.mottle(g, m, COAT, 4, cell=5, seed=11 + s)
    P.flat(g, m & (Z < z0 + 2), "red", 4)  # crimson lining toward the front
    pnpaint.blotch(g, m & (Z < z0 + 2), "red", 3, cell=4, chance=0.05, seed=12)
    bones = limb(g, "z", (u(12), 68), (u(55), 116), 3.0, 2.3, z0 - 0.5, z1 + 0.5, COAT, 2, cap=0.3)
    bones |= limb(g, "z", (u(55), 116), (u(87), 106), 2.3, 1.6, z0 - 0.5, z1 + 0.5, COAT, 2, cap=0.3)
    U = np.abs(X + 0.5 - CX)
    for (u1, v1) in ((80, 78), (61, 58), (37, 44)):
        u0, v0 = 55.0, 115.0
        d = np.abs((v1 - v0) * (U - u0) - (u1 - u0) * (Y + 0.5 - v0)) / np.hypot(v1 - v0, u1 - u0)
        seg = (U >= min(u0, u1) - 1) & (U <= max(u0, u1) + 1)
        P.flat(g, m & (d < 1.3) & seg, COAT, 2)
    P.flat(g, bones, COAT, 2)
    P.flat(g, bones & ((X + Y) % 7 == 0), COAT, 3)
    claw(g, "z", (u(55), 117), (u(53), 123), 1.6, z0, z1, TRIM, 5)  # a gold thumb claw
    return g


def build():
    parts = {"body": body(), "head": head(), "arm-l": arm(-1), "arm-r": arm(1), "wing-l": wing(-1), "wing-r": wing(1)}
    root = assemble(parts, [
        ("body", None, HIP),
        ("head", "body", NECK),
        ("arm-l", "body", SHOULDER["arm-l"]),
        ("arm-r", "body", SHOULDER["arm-r"]),
        ("wing-l", "body", WINGROOT["wing-l"]),
        ("wing-r", "body", WINGROOT["wing-r"]),
    ])
    idle = {"wing-l": {"rot": keys((0, (0, -8, 0)), (2.0, (0, -22, -6)), (4.0, (0, -8, 0)))},
            "wing-r": {"rot": keys((0, (0, 8, 0)), (2.0, (0, 22, 6)), (4.0, (0, 8, 0)))},
            "head": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 12, 0)), (2.0, (0, 0, 0)), (3.0, (0, -12, 0)), (4.0, (0, 0, 0)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (2.0, (-6, 0, -4)), (4.0, (0, 0, 0)))},
            "arm-r": {"rot": keys((0, (0, 0, 0)), (2.0, (-6, 0, 4)), (4.0, (0, 0, 0)))},
            "body": {"loc": keys((0, (0, 0, 0)), (2.0, (0, 1.5, 0)), (4.0, (0, 0, 0)))}}
    attack = {"wing-l": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 25, 18)), (0.6, (0, -35, -10)), (1.2, (0, 0, 0)))},
              "wing-r": {"rot": keys((0, (0, 0, 0)), (0.3, (0, -25, -18)), (0.6, (0, 35, 10)), (1.2, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.3, (-130, 0, 25)), (0.6, (40, 0, -20)), (1.2, (0, 0, 0)))},
              "arm-l": {"rot": keys((0, (0, 0, 0)), (0.4, (-50, 0, -35)), (1.2, (0, 0, 0)))},
              "head": {"rot": keys((0, (0, 0, 0)), (0.3, (-10, 0, 0)), (0.6, (12, 0, 0)), (1.2, (0, 0, 0)))},
              "body": {"rot": keys((0, (0, 0, 0)), (0.3, (-8, 0, 0)), (0.6, (12, 0, 0)), (1.2, (0, 0, 0)))}}
    hit = {"body": {"rot": keys((0, (0, 0, 0)), (0.12, (-10, 6, 0)), (0.6, (0, 0, 0)))},
           "head": {"rot": keys((0, (0, 0, 0)), (0.12, (-20, -15, 0)), (0.6, (0, 0, 0)))}}
    death = {"wing-l": {"rot": keys((0, (0, 0, 0)), (1.0, (0, -75, -35)))}, "wing-r": {"rot": keys((0, (0, 0, 0)), (1.0, (0, 75, 35)))},
             "body": {"rot": keys((0, (0, 0, 0)), (0.5, (-10, 0, 0)), (1.4, (-85, 0, 0))), "loc": keys((0, (0, 0, 0)), (1.4, (0, -24, 20)))},
             "head": {"rot": keys((0, (0, 0, 0)), (1.4, (-20, 25, 0)))},
             "arm-l": {"rot": keys((0, (0, 0, 0)), (1.4, (-40, 0, -50)))}, "arm-r": {"rot": keys((0, (0, 0, 0)), (1.4, (-40, 0, 50)))}}
    chest = (0.0, 55.0 - HIP[1], CZ - 18.0 - HIP[2])
    claw_r = (CX + 41.0 - HIP[0], 8.0 - HIP[1], CZ - 11.0 - HIP[2])
    mouth = (0.0, 75.0 - HIP[1], CZ - 17.0 - HIP[2])
    return world("vampire-lord", "creatures", "Vampire Lord", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-chest", at=chest, parent="body"), Socket("socket-claw-r", at=claw_r, parent="arm-r"), Socket("socket-mouth", at=mouth, parent="head")],
                 pfx=[pfx("rvx-monster-blood-moon-aura", "socket-chest", "idle", size=110), pfx("rvx-monster-bat-burst", "socket-claw-r", "clip:attack", size=60, at=0.48), pfx("rvx-monster-blood-splat", "socket-mouth", "clip:hit", size=36)])
