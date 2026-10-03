"""Werewolf, in the Pirate Nation creature style.

PN has no werewolf, so it follows the PN world bosses (Kevin, the giant
turtle) and totems: a chunky caricature. A big boxy head with a long
sloped muzzle, a hinged jaw with fangs, tall pointed ears and cheek tufts;
huge glowing eyes under an angry brow; a hunched barrel chest with a
spiked mane; long gorilla arms ending in oversized clawed hands with
broken shackles; short digitigrade legs in torn purple trousers; a bushy
tail. Limbs, muzzle, ears, mane and claws are true-slope prisms; the fur,
chest, face and cloth are painted. Clips: idle (breathe, sniff),
attack (lunging double swipe), hit, death. Faces -Z.
"""
import numpy as np

import paint as P
from _kit import keys, pfx, world
from _pn import assemble, coords, fur, last, quad, stamp
from pnkit import box
from voxgrid import C, Clip, Grid, Socket

S = (52, 62, 48)
CX = 26
FUR, FUR_BASE = "skindark", 5
PALE, PANTS = "sand", "purple"
HIP = (CX, 20.0, 28.0)
WAIST = (CX, 25.0, 27.0)
NECK = (CX, 38.0, 18.0)
HINGE = (CX, 40.0, 10.0)
SHOULDER = {"arm-l": (CX - 15.0, 39.0, 24.0), "arm-r": (CX + 15.0, 39.0, 24.0)}


def side(g: Grid, pts_yz, x0, x1, ramp: str, shade: int) -> np.ndarray:
    """A prism across x from a side-view (y, z) polygon."""
    g.prism("x", pts_yz, x0, x1, C(ramp, shade))
    return last(g)


def front(g: Grid, pts_xy, z0, z1, ramp: str, shade: int) -> np.ndarray:
    """A prism along z from a front-view (x, y) polygon."""
    g.prism("z", pts_xy, z0, z1, C(ramp, shade))
    return last(g)


def hips() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pants = box(g, CX - 10, 16, 21, CX + 10, 26, 34, PANTS, 4)
    furm = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        x0, x1 = CX + s * 7 - 4, CX + s * 7 + 4
        pants |= side(g, quad((22, 28), (12, 22), 5.0, 4.2, cap=0.6), x0, x1, PANTS, 4)  # thigh
        furm |= side(g, quad((12, 22), (6, 29), 3.2, 2.6, cap=0.8), x0 + 1, x1 - 1, FUR, FUR_BASE)  # shin back to the hock
        furm |= side(g, quad((7, 29), (3, 24), 2.6, 2.4, cap=0.6), x0 + 1, x1 - 1, FUR, FUR_BASE)  # hock to paw
        paw = box(g, x0, 0, 17, x1, 5, 27, FUR, FUR_BASE - 1)
        furm |= paw
        for k in range(3):  # three big toe claws, hooked down (true slopes)
            cxk = x0 + 1.5 + k * 2.5
            side(g, [(4.5, 17.5), (1.5, 17.5), (0.2, 14.0)], cxk - 0.9, cxk + 0.9, "bone", 6)
    tail = side(g, quad((24, 34), (13, 44), 3.4, 2.4, cap=1.2), CX - 2.5, CX + 2.5, FUR, FUR_BASE)
    fur(g, furm | tail, FUR, FUR_BASE, seed=1)
    P.flat(g, tail & (Z > 40), PALE, 5)  # pale tail tip
    P.mottle(g, pants, PANTS, 4, cell=3, seed=2)
    # torn hem (fur shows through a zigzag), a dark waistband, a magenta patch
    P.flat(g, pants & (Y < 15), FUR, FUR_BASE)
    P.flat(g, pants & (Y >= 15) & (Y < 17) & (((X + Z) % 4) < 2), FUR, FUR_BASE - 1)
    P.flat(g, pants & (Y >= 24), PANTS, 2)
    P.flat(g, pants & (Y >= 18) & (Y < 22) & (X >= CX - 12) & (X < CX - 8) & (Z < 26), "magenta", 4)
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    body = side(g, [(24, 34), (24, 20), (29, 15), (36, 13), (41, 15), (43, 21), (42, 30), (36, 36), (28, 36)], CX - 11, CX + 11, FUR, FUR_BASE)
    body |= side(g, [(31, 14), (41, 15), (43, 21), (41, 30), (32, 31)], CX - 15, CX + 15, FUR, FUR_BASE)  # broad shoulders
    mane = side(g, [(39, 19), (50, 22), (45, 25), (49, 29), (43, 29), (45, 35), (39, 33), (37, 26)], CX - 8, CX + 8, FUR, FUR_BASE - 2)
    fur(g, body, FUR, FUR_BASE, seed=3)
    fur(g, mane, FUR, FUR_BASE - 2, seed=4)
    P.flat(g, body & (Y >= 40) & (Z > 22), FUR, FUR_BASE - 1)  # darker back
    # a pale chest and belly with painted pecs and ribs (rule S1)
    chest = body & (Z < 21) & (np.abs(X + 0.5 - CX) < 9) & (Y < 40)
    fur(g, chest, PALE, 5, seed=5)
    P.flat(g, chest & (np.abs(X + 0.5 - CX) < 0.8) & (Y > 28), PALE, 3)
    P.flat(g, chest & (Y == 34) & (np.abs(X + 0.5 - CX) > 1.5), PALE, 3)
    P.flat(g, chest & ((Y == 27) | (Y == 30)) & (np.abs(X + 0.5 - CX) > 1.5) & (np.abs(X + 0.5 - CX) < 6), PALE, 4)
    return g


def head() -> Grid:
    """A big caricature head (Kevin-sized, rule K3): boxy skull, jutting
    brow, long sloped muzzle, tall ears and cheek tufts."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    skull_m = box(g, CX - 9, 38, 10, CX + 9, 53, 23, FUR, FUR_BASE)
    brow = box(g, CX - 10, 50, 8, CX + 10, 54, 14, FUR, FUR_BASE - 1)
    muzzle = side(g, [(48, 11), (46, 1.2), (44, 0.3), (40, 1), (40, 11)], CX - 4, CX + 4, PALE, 5)
    ears = np.zeros(g.shape, dtype=bool)
    tufts = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        ears |= front(g, [(CX + s * 9.5, 52), (CX + s * 2.5, 52), (CX + s * 9, 59.5)], 15, 19, FUR, FUR_BASE - 1)
        tufts |= front(g, [(CX + s * 8, 48), (CX + s * 13, 45), (CX + s * 10, 43.5), (CX + s * 13, 40), (CX + s * 8, 38.5)], 12, 21, PALE, 5)
    fur(g, skull_m, FUR, FUR_BASE, seed=6)
    fur(g, ears | brow, FUR, FUR_BASE - 1, seed=7)
    fur(g, tufts, PALE, 5, seed=8)
    P.flat(g, ears & (Z < 16) & (np.abs(np.abs(X + 0.5 - CX) - 6.5) < 1.6) & (Y > 53) & (Y < 58), "pink", 3)  # pink inner ear
    P.flat(g, skull_m & (Y < 44) & (Z < 15), PALE, 5)  # pale cheeks and chin
    fur(g, muzzle, PALE, 5, seed=9)
    P.flat(g, muzzle & (Y >= 44) & (Z < 2) & (np.abs(X + 0.5 - CX) < 2.6), "gray", 2)  # nose tip
    P.flat(g, muzzle & (Y >= 46) & (np.abs(X + 0.5 - CX) < 1.5), FUR, FUR_BASE)  # muzzle ridge
    # big glowing eyes under the angry brow (painted, rule K3)
    eye = {"d": C(FUR, 2), "o": C("gold", 5), "p": C("gray", 1), "w": C("ember", 7)}
    rows = ["ddddd........ddddd", "dwood........doowd", "doopp........ppood", ".dddd........dddd."]
    stamp(g, "-z", 10, CX - 9, 45, rows, eye, depth=3)
    P.flat(g, brow & (Z < 10) & (Y < 51), FUR, FUR_BASE - 2)  # brow shadow line
    for fx in (CX - 3, CX + 2):  # upper fangs, on the head so the jaw can open
        box(g, fx, 38, 1, fx + 1, 40, 3, "bone", 7)
    return g


def jaw() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = side(g, [(40.5, 11), (40.5, 2), (38.5, 2.5), (36.5, 11)], CX - 3.5, CX + 3.5, PALE, 5)
    fur(g, m, PALE, 5, seed=10)
    P.flat(g, m & (Y >= 40) & (np.abs(X + 0.5 - CX) < 2.5), "red", 4)  # red mouth
    P.flat(g, m & (Y >= 40) & (np.abs(X + 0.5 - CX) >= 2.5) & (Z % 2 == 0), "bone", 7)  # lower teeth
    for fx in (CX - 3, CX + 2):
        box(g, fx, 40, 2, fx + 1, 42, 3, "bone", 7)
    return g


def arm(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + s * 15
    upper = front(g, quad((sx + s * 1, 40), (sx + s * 5, 28), 4.5, 3.8, cap=0.5), 19, 29, FUR, FUR_BASE)
    fore = front(g, quad((sx + s * 5, 28), (sx + s * 4, 17), 3.8, 3.4, cap=0.5), 14, 23, FUR, FUR_BASE)
    ruff = front(g, [(sx - s * 3, 43), (sx + s * 4, 46), (sx + s * 9, 41), (sx + s * 7, 38), (sx + s * 9, 34), (sx + s * 4, 36), (sx - s * 2, 36)], 17, 29, FUR, FUR_BASE - 1)
    hx = sx + s * 4
    hand = box(g, hx - 5, 8, 10, hx + 5, 18, 21, FUR, FUR_BASE - 1)
    fur(g, upper | fore, FUR, FUR_BASE, seed=11 + s)
    fur(g, hand, FUR, FUR_BASE - 1, seed=13 + s)
    fur(g, ruff, FUR, FUR_BASE - 2, seed=15 + s)
    P.flat(g, hand & (Y < 10), PALE, 4)  # pads
    for k in range(4):  # four oversized hooked claws, down and forward
        cxk = hx - 3.75 + k * 2.5
        side(g, [(9, 13.5), (9, 10.5), (4, 8.8), (1, 8.2), (4, 11)], cxk - 0.9, cxk + 0.9, "bone", 6)
    cuff = box(g, hx - 4, 18, 13, hx + 4, 21, 22, "gray", 5)  # broken shackle
    P.outline(g, cuff, "gray", 3)
    for k in range(3):  # a dangling chain
        box(g, hx - s * 5 - 1, 17 - k * 3, 17, hx - s * 5 + 1, 19 - k * 3, 19, "gray", 5 - k % 2)
    return g


def build():
    parts = {"hips": hips(), "torso": torso(), "head": head(), "jaw": jaw(), "arm-l": arm(-1), "arm-r": arm(1)}
    root = assemble(parts, [
        ("hips", None, HIP),
        ("torso", "hips", WAIST),
        ("head", "torso", NECK),
        ("jaw", "head", HINGE),
        ("arm-l", "torso", SHOULDER["arm-l"]),
        ("arm-r", "torso", SHOULDER["arm-r"]),
    ])
    idle = {"torso": {"rot": keys((0, (0, 0, 0)), (1.2, (4, 0, 0)), (2.4, (0, 0, 0)))},
            "head": {"rot": keys((0, (0, 0, 0)), (0.6, (-6, 10, 0)), (1.2, (0, 0, 0)), (1.8, (-4, -10, 0)), (2.4, (0, 0, 0)))},
            "jaw": {"rot": keys((0, (0, 0, 0)), (1.2, (8, 0, 0)), (2.4, (0, 0, 0)))},
            "arm-l": {"rot": keys((0, (0, 0, 0)), (1.2, (-6, 0, -4)), (2.4, (0, 0, 0)))},
            "arm-r": {"rot": keys((0, (0, 0, 0)), (1.2, (-6, 0, 4)), (2.4, (0, 0, 0)))}}
    attack = {"torso": {"rot": keys((0, (0, 0, 0)), (0.2, (-12, 0, 0)), (0.4, (22, 0, 0)), (0.9, (0, 0, 0)))},
              "jaw": {"rot": keys((0, (0, 0, 0)), (0.2, (30, 0, 0)), (0.5, (30, 0, 0)), (0.9, (0, 0, 0)))},
              "arm-r": {"rot": keys((0, (0, 0, 0)), (0.2, (-150, 0, 15)), (0.4, (55, 0, -10)), (0.9, (0, 0, 0)))},
              "arm-l": {"rot": keys((0, (0, 0, 0)), (0.3, (-150, 0, -15)), (0.55, (55, 0, 10)), (0.9, (0, 0, 0)))}}
    hit = {"torso": {"rot": keys((0, (0, 0, 0)), (0.12, (-18, 8, 0)), (0.5, (0, 0, 0)))},
           "head": {"rot": keys((0, (0, 0, 0)), (0.12, (-20, -10, 0)), (0.5, (0, 0, 0)))}}
    death = {"hips": {"rot": keys((0, (0, 0, 0)), (0.3, (-10, 0, 0)), (0.9, (-80, 0, 0)), (1.2, (-75, 0, 0))),
                      "loc": keys((0, (0, 0, 0)), (0.9, (0, -14, 7)), (1.2, (0, -14, 7)))},
             "head": {"rot": keys((0, (0, 0, 0)), (0.5, (-30, 0, 0)), (1.2, (-10, 20, 0)))},
             "arm-l": {"rot": keys((0, (0, 0, 0)), (1.0, (-60, 0, -40)))}, "arm-r": {"rot": keys((0, (0, 0, 0)), (1.0, (-60, 0, 40)))}}
    # sockets in root (hips joint) space: the mouth tip and the right claw tips
    mouth = (0.0, 40.0 - HIP[1], 1.0 - HIP[2])
    claw = (CX + 19.0 - HIP[0], 2.0 - HIP[1], 8.0 - HIP[2])
    return world("werewolf", "creatures", "Werewolf", root,
                 clips=[Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False), Clip("idle", idle)],
                 sockets=[Socket("socket-mouth", at=mouth, parent="head"), Socket("socket-claw-r", at=claw, parent="arm-r")],
                 pfx=[pfx("rvx-monster-howl", "socket-mouth", "clip:attack", size=40, at=0.36), pfx("rvx-monster-claw-slash", "socket-claw-r", "clip:attack", size=36.46, aim=(0.099, -0.913, -0.395), offset=(-2.2, 20.35, 8.8))])
