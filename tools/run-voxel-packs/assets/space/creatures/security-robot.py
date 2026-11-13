"""Security robot, in the Pirate Nation mecha style.

A station patrol android with caricature proportions (F4): a wide white
hull chest with an orange breastplate and a hazard belt, a narrow waist,
stubby piston legs with big steel boots and a low wedge head whose single
cyan eye bar reads at a glance (F6). It carries an oversized riot shield
on the left arm and a copper stun prod on the right. Clips: idle, move,
attack, hit, death. Sparks bind at the prod tip. Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, box, coords, edges, front, hazard, keys, light_top, ngon_y, plated, quad, side, wave
from pnshapes import facets
from voxgrid import C

S = (46, 46, 34)
CX, CZ = 23, 22
YH = 17  # hip
YS = 31  # shoulder
HIP = 5  # hip offset in x


def pelvis() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    m = box(g, CX - 7, YH - 2, CZ - 4, CX + 7, YH + 4, CZ + 4, "steel", 5)
    plated(g, m, "steel", 5, size=(6, 4), seed=1)
    P.flat(g, edges(m), "steel", 3)
    hazard(g, m & (Y > YH + 2), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    P.flat(g, m & (Z < CZ - 3.0) & (np.abs(X - CX) < 2.2) & (np.abs(Y - YH) < 1.6), "cyan", 6)
    for s in (-1, 1):  # hip balls
        h = ngon_y(g, CX + s * HIP, CZ, 3.0, YH - 3, YH + 1, "iron", 5, n=8)
        P.flat(g, h, "iron", 5)
        P.flat(g, h & (np.abs(X - (CX + s * HIP)) > 2.2), "gold", 6)
    return g


def leg(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * HIP
    thigh = side(g, quad((YH - 1, CZ), (10, CZ + 1), 3.4, 2.8), x - 3.4, x + 3.4, "bone", 6)
    for m, fr in facets(g, g.solids[-1:]):
        P.plates(g, m, "bone", 6, size=(6, 6), rivets=False, frame=fr)
    P.flat(g, edges(thigh), "bone", 4)
    knee = ngon_y(g, x, CZ + 1, 2.8, 8, 11, "iron", 5, n=8)
    P.flat(g, knee, "iron", 5)
    P.flat(g, knee & (np.abs(X - x) > 2.0), "gold", 6)
    shin = side(g, quad((10, CZ + 1), (4, CZ - 1), 2.6, 2.2), x - 2.6, x + 2.6, "steel", 5)
    P.flat(g, shin, "steel", 5)
    P.flat(g, shin & (np.abs(X - x) > 1.8), "steel", 3)
    P.flat(g, shin & (np.abs(Y - 7) < 0.8), "rust", 5)  # piston collar
    boot = box(g, x - 4, 0, CZ - 6, x + 4, 4, CZ + 4, "steel", 4)
    plated(g, boot, "steel", 4, size=(4, 3), seed=2 + s)
    P.flat(g, edges(boot), "steel", 2)
    light_top(g, boot, "steel", 6)
    P.flat(g, boot & (Z < CZ - 5.0) & (np.abs(X - x) < 2.5) & (Y > 1.5), "orange", 5)
    return g


def torso() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    chest = front(g, [(CX - 7, YH + 2), (CX + 7, YH + 2), (CX + 11, YS - 3), (CX + 10, YS + 1),
                      (CX - 10, YS + 1), (CX - 11, YS - 3)], CZ - 6, CZ + 6, "bone", 6)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "bone", 6, size=(8, 7), rivets=False, frame=fr)
    P.flat(g, edges(chest), "bone", 4)
    light_top(g, chest, "bone", 7)
    # the orange breastplate with a painted badge and a hazard belt
    bp = chest & (Z < CZ - 4.5) & (Y > YH + 5) & (Y < YS - 1) & (np.abs(X - CX) < 8)
    P.flat(g, bp, "orange", 6)
    P.flat(g, bp & (Y > YS - 4), "orange", 7)
    P.outline(g, bp, "orange", 3, normal="z")
    badge = bp & (np.hypot(X - CX, (Y - (YH + 9)) * 1.15) < 3.2)
    P.flat(g, badge, "cyan", 6)
    P.flat(g, badge & (np.hypot(X - CX, (Y - (YH + 9)) * 1.15) < 2.0), "bone", 7)
    P.flat(g, badge & (np.abs(X - CX) < 0.8), "cyan", 7)
    hazard(g, chest & (Z < CZ - 4.5) & (Y > YH + 2) & (Y < YH + 4.5), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    # steel shoulder pads and a backpack
    for s in (-1, 1):
        pad = ngon_y(g, CX + s * 9, CZ, 4.6, YS - 3, YS + 2, "steel", 5, n=8, r_top=3.6)
        P.flat(g, pad, "steel", 5)
        P.flat(g, pad & (Y > YS), "steel", 6)
        P.flat(g, pad & (Z < CZ - 3.6), "orange", 5)
    pack = box(g, CX - 7, YH + 6, CZ + 4, CX + 7, YS - 1, CZ + 8, "steel", 4)
    plated(g, pack, "steel", 4, size=(5, 4), seed=4)
    P.flat(g, edges(pack), "steel", 2)
    P.flat(g, pack & (Z > CZ + 7) & (np.abs(X - CX) < 4) & (Y > YS - 5), "cyan", 6)
    P.flat(g, pack & (Z > CZ + 7) & (np.abs(X - CX) < 4) & (Y > YS - 4), "cyan", 7)
    return g


def head() -> Grid:
    """A low wedge head (a true slope) with one wide cyan eye bar."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    neck = ngon_y(g, CX, CZ, 2.6, YS, YS + 2, "iron", 5, n=8)
    P.flat(g, neck, "iron", 5)
    h = side(g, [(YS + 2, CZ - 5), (YS + 2, CZ + 5), (YS + 8, CZ + 4), (YS + 9, CZ - 1), (YS + 6, CZ - 5)], CX - 7, CX + 7, "bone", 6)
    for m, fr in facets(g, g.solids[n0 + 1:]):
        P.plates(g, m, "bone", 6, size=(7, 5), rivets=False, frame=fr)
    P.flat(g, edges(h), "bone", 4)
    light_top(g, h, "bone", 7)
    P.flat(g, h & (np.abs(X - CX) > 6), "steel", 4)  # ear housings
    P.flat(g, h & (np.abs(X - CX) > 6) & (Y > YS + 5), "cyan", 6)
    # the eye bar in a dark bezel, with a bright pupil block
    face = h & (Z < CZ - 3.5) & (Y > YS + 3) & (Y < YS + 7)
    P.flat(g, face, "iron", 2)
    eye = face & (np.abs(X - CX) < 5) & (Y > YS + 4) & (Y < YS + 6.5)
    P.flat(g, eye, "cyan", 5)
    P.flat(g, eye & (Y > YS + 5.2), "cyan", 6)  # the eye bar is two layers tall
    P.flat(g, eye & (np.abs(X - (CX - 2.5)) < 1.6), "cyan", 7)
    P.flat(g, h & (Z < CZ - 2) & (Y > YS + 6.4) & (Y < YS + 9), "orange", 6)  # brow stripe
    P.flat(g, face & ((np.abs(X - (CX - 5.5)) < 0.9) | (np.abs(X - (CX + 5.5)) < 0.9)), "orange", 5)  # eye-bar end caps
    lamp = box(g, CX + 4, YS + 8, CZ - 4, CX + 7, YS + 11, CZ - 1, "iron", 4)
    P.flat(g, lamp, "iron", 4)
    P.flat(g, lamp & (Z < CZ - 3), "gold", 7)
    return g


def arm_shield() -> Grid:
    """The left arm with an oversized riot shield."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX - 11
    upper = side(g, quad((YS - 1, CZ), (YS - 9, CZ + 1), 2.8, 2.4), x - 2.8, x + 2.8, "steel", 5)
    P.flat(g, upper, "steel", 5)
    P.flat(g, upper & (np.abs(X - x) > 2.0), "steel", 3)
    fore = side(g, quad((YS - 9, CZ + 1), (YS - 16, CZ - 2), 2.6, 2.2), x - 2.6, x + 2.6, "bone", 6)
    P.flat(g, fore, "bone", 6)
    P.flat(g, fore & (np.abs(X - x) > 1.9), "bone", 4)
    P.flat(g, fore & (np.abs(Y - (YS - 12)) < 0.6), "rust", 5)
    n0 = len(g.solids)
    sh = front(g, [(x - 8, YS - 19), (x + 5, YS - 19), (x + 8, YS - 15), (x + 8, YS - 2),
                   (x + 5, YS + 2), (x - 8, YS + 2), (x - 11, YS - 2), (x - 11, YS - 15)], CZ - 8, CZ - 4, "bone", 6)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "bone", 6, size=(7, 7), rivets=False, frame=fr, seed=5)
    P.flat(g, edges(sh), "bone", 4)
    face = sh & (Z < CZ - 7.0)
    hazard(g, face & (np.abs(Y - (YS - 16)) < 2.2), period=4, a=("orange", 5), b=("iron", 3), frame="wall")
    bar = face & (Y > YS - 10) & (Y < YS - 4)
    P.flat(g, bar, "cyan", 5)
    P.flat(g, bar & (Y > YS - 6), "cyan", 6)
    P.flat(g, bar & (np.abs(X - (x - 4)) < 1.4), "cyan", 7)
    P.flat(g, face & (np.abs(X - (x - 1.5)) < 0.8), "iron", 4)  # centre rib
    P.flat(g, face & (np.abs(Y - (YS + 0.5)) < 1.2), "orange", 5)  # top band
    return g


def arm_prod() -> Grid:
    """The right arm with a copper stun prod."""
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + 11
    upper = side(g, quad((YS - 1, CZ), (YS - 9, CZ + 1), 2.8, 2.4), x - 2.8, x + 2.8, "steel", 5)
    P.flat(g, upper, "steel", 5)
    P.flat(g, upper & (np.abs(X - x) > 2.0), "steel", 3)
    fore = side(g, quad((YS - 9, CZ + 1), (YS - 16, CZ - 2), 2.6, 2.2), x - 2.6, x + 2.6, "bone", 6)
    P.flat(g, fore, "bone", 6)
    P.flat(g, fore & (np.abs(X - x) > 1.9), "bone", 4)
    P.flat(g, fore & (np.abs(Y - (YS - 12)) < 0.6), "rust", 5)
    fist = ngon_y(g, x, CZ - 2, 3.2, YS - 19, YS - 15, "steel", 5, n=8)
    P.flat(g, fist, "steel", 5)
    P.flat(g, fist & (np.abs(X - x) > 2.4), "steel", 3)
    grip = side(g, quad((YS - 17, CZ - 2), (YS - 17, CZ - 14), 1.8), x - 1.8, x + 1.8, "rust", 5)
    P.flat(g, grip, "rust", 5)
    P.flat(g, grip & (np.floor(Z) % 3 == 0), "rust", 3)
    P.flat(g, grip & (Y > YS - 16.4), "rust", 6)
    tip = box(g, x - 2.5, YS - 19.5, CZ - 18, x + 2.5, YS - 14.5, CZ - 14, "iron", 5)
    P.flat(g, tip, "iron", 5)
    P.flat(g, edges(tip), "iron", 3)
    P.flat(g, tip & (Z < CZ - 17), "cyan", 7)
    for s in (-1, 1):  # two prongs
        pr = box(g, x + s * 1.6 - 0.8, YS - 17.8, CZ - 21, x + s * 1.6 + 0.8, YS - 16.2, CZ - 17, "cyan", 6)
        P.flat(g, pr, "cyan", 6)
        P.flat(g, pr & (Z < CZ - 20), "cyan", 7)
    return g


def build():
    rig = Rig()
    rig.group("security-robot", (CX, 0, CZ))
    hips = rig.add("pelvis", pelvis(), (CX, YH, CZ), "security-robot")
    rig.add("leg-l", leg(-1), (CX - HIP, YH, CZ), "pelvis")
    rig.add("leg-r", leg(1), (CX + HIP, YH, CZ), "pelvis")
    rig.add("torso", torso(), (CX, YH + 2, CZ), "pelvis")
    rig.add("head", head(), (CX, YS, CZ), "torso")
    rig.add("arm-l", arm_shield(), (CX - 11, YS - 1, CZ), "torso")
    rig.add("arm-r", arm_prod(), (CX + 11, YS - 1, CZ), "torso")
    del hips
    z = (0.0, 0.0, 0.0)
    idle = {
        "torso": {"loc": wave(2.4, "y", 0.3), "rot": wave(2.4, "y", 2.5)},
        "head": {"rot": keys((0, z), (0.8, (0, 22, 0)), (1.6, (0, -22, 0)), (2.4, z))},
        "arm-l": {"rot": wave(2.4, "x", 3, phase=0.6)},
        "arm-r": {"rot": wave(2.4, "x", 4, phase=2.0)},
    }
    t = 0.8
    fwd, back = (26.0, 0.0, 0.0), (-26.0, 0.0, 0.0)
    move = {
        "leg-l": {"rot": keys((0, fwd), (t / 2, back), (t, fwd))},
        "leg-r": {"rot": keys((0, back), (t / 2, fwd), (t, back))},
        "arm-l": {"rot": keys((0, (-16, 0, 0)), (t / 2, (16, 0, 0)), (t, (-16, 0, 0)))},
        "arm-r": {"rot": keys((0, (16, 0, 0)), (t / 2, (-16, 0, 0)), (t, (16, 0, 0)))},
        "pelvis": {"loc": keys((0, z), (t / 4, (0, 1.2, 0)), (t / 2, z), (t * 0.75, (0, 1.2, 0)), (t, z)),
                   "rot": keys((0, (0, 5, 0)), (t / 2, (0, -5, 0)), (t, (0, 5, 0)))},
        "torso": {"rot": keys((0, (0, -6, 0)), (t / 2, (0, 6, 0)), (t, (0, -6, 0)))},
    }
    attack = {
        "arm-r": {"rot": keys((0, z), (0.2, (85, 0, 0)), (0.45, (36, 0, 0)), (0.7, (42, 0, 0)), (1.0, z))},
        "torso": {"rot": keys((0, z), (0.2, (0, 14, 0)), (0.45, (0, -18, 0)), (1.0, z))},
        "arm-l": {"rot": keys((0, z), (0.45, (18, 0, 0)), (1.0, z))},
        "head": {"rot": keys((0, z), (0.45, (-8, 0, 0)), (1.0, z))},
    }
    hit = {
        "torso": {"rot": keys((0, z), (0.1, (-14, 0, 8)), (0.45, z))},
        "head": {"rot": keys((0, z), (0.1, (-16, 0, -10)), (0.45, z))},
        "arm-l": {"rot": keys((0, z), (0.1, (14, 0, 0)), (0.45, z))},
    }
    death = {
        "security-robot": {"rot": keys((0, z), (0.5, (0, 0, 24)), (1.0, (0, 0, 84))), "loc": keys((0, z), (1.0, (0, -3, 0)))},
        "torso": {"rot": keys((0, z), (0.5, (14, 0, 0)), (1.0, (22, 0, 0)))},
        "head": {"rot": keys((0, z), (1.0, (26, 0, 0)))},
        "arm-r": {"rot": keys((0, z), (0.5, (-30, 0, 0)), (1.0, (-52, 0, 0)))},
        "arm-l": {"rot": keys((0, z), (1.0, (34, 0, 0)))},
    }
    prod = rig.sock("socket-prod", (CX + 11, YS - 17, CZ - 22), parent="arm-r")
    return asset(
        "creatures", "security-robot", "Security Robot", rig.root,
        clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False),
               Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
        sockets=[prod],
        pfx=[{"effectId": "rvx-space-stun-arc", "socket": "socket-prod", "trigger": "clip:attack", "size": 11, "at": 0.45}],
    )
