"""Zombie crawler, in the Pirate Nation creature style.

A legless-on-one-side zombie that drags itself along the ground: the
chest is up on two straight arms, the big boxy head looks forward, and
the hips drag behind. Like the walker, runner and bloated zombies it has
teal skin, one big bulging eye and one small red eye, a wide mouth of
crooked teeth on a jutting jaw, and patchy dark hair with a stitched bald
spot. It wears a torn, stained white vest with bare ribs in a rip, and
torn jeans: the left leg drags a lost-shoe foot, the right leg ends in a
torn stump with bone. Torso, head, jaw and limbs are true-slope prisms;
cloth, ribs, stains and face are paint. Clips: idle (look round), move
(arm-over-arm crawl), attack (lunging bite), hit, death (rolls on its
side). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, front, fx, limb, make, seq, side, skin, wave
from _rep_creatures import ground
from pnkit import box
from voxgrid import C, Clip, Grid

SIZE = (44, 36, 54)
CX = 22.0
ORIGIN = (CX, 0.0, 28.0)
SKIN = ("teal", 5)
SHIRT, JEANS = ("bone", 5), ("blue", 4)
NECK = (CX, 19.0, 15.0)
SHOULDERS = {"arm-l": (CX - 7.0, 19.0, 19.5), "arm-r": (CX + 7.0, 19.0, 19.5)}
HIPS = {"leg-l": (CX - 4.0, 5.5, 35.0), "leg-r": (CX + 4.0, 5.5, 35.0)}


def torso() -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    # The body slopes from the raised chest down to the dragging hips.
    m = side(g, [(13, 14), (21, 14), (23, 19), (19.5, 27), (10.5, 36), (1.5, 37.5), (1.5, 33), (6, 26), (11, 18)], CX - 7.5, CX + 7.5, *SHIRT)
    shirt = m & (Z < 31.5)
    pants = m & (Z >= 31.5)
    P.mottle(g, shirt, *SHIRT, cell=3, seed=1)
    P.outline(g, shirt, SHIRT[0], SHIRT[1] - 2, normal="x")
    # Blood and grime stains on the vest, and a torn, ragged hem.
    PP.blotch(g, shirt, "blood", 4, cell=3, chance=0.025, seed=2)
    PP.blotch(g, shirt, "khaki", 6, cell=4, chance=0.02, seed=3)
    P.flat(g, shirt & (Z > 29.5) & ((np.floor(X) + np.floor(Y)) % 3 == 0), *SKIN)
    # A rip in the left flank shows teal skin and bare ribs.
    rip = m & (X < CX - 6) & (np.hypot(Y - 14, Z - 24) < 3.6)
    P.flat(g, rip, *SKIN)
    P.flat(g, rip & (np.floor(Z) % 2 == 0), "bone", 6)
    # Torn jeans on the hips, a belt and a brass buckle.
    P.flat(g, pants, *JEANS)
    PP.blotch(g, pants, JEANS[0], JEANS[1] + 1, cell=3, chance=0.08, seed=4)
    belt = m & (Z >= 31.5) & (Z < 33)
    P.flat(g, belt, "darkwood", 4)
    P.flat(g, belt & (np.abs(X - CX) < 1.2) & (Y > 7) & (Y < 9.5), "gold", 6)
    neck = box(g, CX - 3, 18, 11, CX + 3, 22.5, 16.5, *SKIN)
    skin(g, neck, *SKIN, seed=5)
    return g


def head() -> Grid:
    """A huge boxy zombie head with a jutting jaw, after the walker."""
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    y0, fz, nz = 17.0, 4.0, 14.0
    poly = [(y0, nz + 1.5), (y0, fz - 1), (y0 + 5, fz - 1), (y0 + 5, fz), (y0 + 12, fz), (y0 + 13.5, fz + 2.5), (y0 + 13.5, nz - 1), (y0 + 11, nz + 1.5)]
    m = side(g, poly, CX - 7, CX + 7, *SKIN)
    skin(g, m, *SKIN, seed=6)
    for s in (-1, 1):  # ears
        ear = S.bar(g, "z", (CX + s * 7, y0 + 6), (CX + s * 9, y0 + 9), 2.2, nz - 5, nz - 2, *SKIN)
        skin(g, ear, *SKIN, seed=7)
    # Patchy dark hair: a cap over the top and back, with a stitched bald spot.
    hair = side(g, [(y0 + 12.8, fz + 1.2), (y0 + 14.6, fz + 2.6), (y0 + 15.2, nz - 2.5), (y0 + 13.2, nz + 2.2), (y0 + 9.5, nz + 2.4), (y0 + 9.5, nz + 1.4)], CX - 7.4, CX + 7.4, "darkwood", 4)
    P.flat(g, hair & (np.floor(X) % 3 == 0), "darkwood", 3)
    P.flat(g, hair & (np.floor(X) % 3 == 1) & (Y > y0 + 14), "darkwood", 5)
    bald = hair & (np.hypot(X - (CX + 3), Z - 9) < 2.6) & (Y > y0 + 14)
    P.flat(g, bald, *SKIN)
    P.flat(g, bald & (np.abs(X - (CX + 3)) < 0.6), "khaki", 4)  # stitches
    for k, dx in enumerate((-4.5, -1.5, 2.5)):  # locks that hang over the brow
        front(g, [(CX + dx - 1.4, y0 + 13), (CX + dx + 1.4, y0 + 13), (CX + dx + 0.3 * (k - 1), y0 + 10.5)], fz + 0.6, fz + 2.2, "darkwood", 4)
    # The face: one huge bulging eye, one small red eye, a heavy brow.
    legend = {"o": C("teal", 3), "w": C("bone", 7), "p": C("navy", 4), "r": C("red", 6), "b": C("teal", 2)}
    rows = ["bbbbbbb...bbbb", "owwwwwo.......", "owwwwwo...oooo", "owwwppo...orro", "owwwppo...orro", "owwwwwo...oooo", "ooooooo......."]
    G.stamp(g, "-z", fz, int(CX - 7), int(y0 + 5), rows, legend, depth=2)
    P.flat(g, m & (Z < fz + 1) & (np.abs(Y - (y0 + 5.4)) < 0.6) & (np.abs(X - CX) < 1.2), "teal", 2)  # nose holes
    # A wide mouth of crooked chunky teeth on the jutting jaw.
    mouth = m & (Z < fz - 0.2) & (Y > y0 + 0.8) & (Y < y0 + 4.6) & (np.abs(X - CX) < 5.8)
    P.flat(g, mouth, "red", 2)
    P.flat(g, mouth & (Y > y0 + 3.2) & ((np.floor(X) // 2) % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < y0 + 2) & ((np.floor(X) // 2) % 3 == 1), "bone", 5)
    P.flat(g, m & (np.abs(X - (CX - 5.5)) < 0.6) & (Y > y0 + 2) & (Y < y0 + 5) & (Z < fz + 3), "khaki", 4)  # a stitched cheek
    return g


def arm(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    s = -1 if name == "arm-l" else 1
    sx, sy, sz = SHOULDERS[name]
    ex, ey, ez = sx + s * 4.0, 11.0, sz - 4.0
    wx, wy, wz = sx + s * 4.5, 3.5, sz - 10.5
    upper = limb(g, (sx, sy, sz), (ex, ey, ez), 2.7, 2.3, *SKIN, n=4)
    fore = limb(g, (ex, ey + 0.5, ez + 0.5), (wx, wy, wz), 2.2, 2.0, *SKIN, n=4)
    hand = box(g, wx - 3, 0, wz - 4, wx + 3, 3, wz + 1.5, *SKIN)
    skin(g, upper | fore | hand, *SKIN, seed=8 + s)
    # A torn short sleeve at the shoulder.
    P.flat(g, upper & (Y > sy - 3.5), *SHIRT)
    P.flat(g, upper & (np.abs(Y - (sy - 3.5)) < 0.6) & (np.floor(Z) % 2 == 0), SHIRT[0], SHIRT[1] - 2)
    for k in (-1, 0, 1):  # three fingers dig in, with yellow nails
        f = limb(g, (wx + k * 2, 1.4, wz - 3.5), (wx + k * 2.3, 0.8, wz - 6.5), 0.95, 0.7, *SKIN, n=4)
        P.flat(g, f & (Z < wz - 5.5), "gold", 6)
    return g


def leg(name: str) -> Grid:
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS[name]
    if name == "leg-l":  # the whole leg drags, its shoe lost
        thigh = limb(g, (hx, hy, hz), (hx - 1, 3.0, hz + 8), 3.0, 2.7, *JEANS, n=4)
        shin = limb(g, (hx - 1, 3.0, hz + 7.5), (hx - 1.5, 2.8, hz + 13), 2.6, 2.4, *JEANS, n=4)
        P.flat(g, thigh | shin, *JEANS)
        PP.blotch(g, thigh | shin, JEANS[0], JEANS[1] + 1, cell=3, chance=0.08, seed=9)
        P.flat(g, shin & (Z > hz + 11.5) & ((np.floor(X) + np.floor(Y)) % 2 == 0), JEANS[0], JEANS[1] - 1)  # frayed hem
        P.flat(g, thigh & (np.abs(Z - (hz + 5)) < 1.2) & (Y > 3), *SKIN)  # a ripped knee
        foot = box(g, hx - 4.5, 0, hz + 12.5, hx + 1.5, 3.5, hz + 16, *SKIN)
        skin(g, foot, *SKIN, seed=10)
        P.flat(g, foot & (Z > hz + 15) & (np.floor(X) % 2 == 0), "gold", 6)  # toenails
    else:  # a torn stump with the bone showing
        thigh = limb(g, (hx, hy, hz), (hx + 0.5, 3.4, hz + 7), 3.0, 2.7, *JEANS, n=4)
        P.flat(g, thigh, *JEANS)
        PP.blotch(g, thigh, JEANS[0], JEANS[1] + 1, cell=3, chance=0.08, seed=11)
        P.flat(g, thigh & (Z > hz + 5.6) & ((np.floor(X) + np.floor(Y)) % 2 == 0), JEANS[0], JEANS[1] - 1)
        P.flat(g, thigh & (Z > hz + 6.3), "red", 3)  # the torn flesh
        stump = limb(g, (hx + 0.5, 3.4, hz + 6.5), (hx + 0.7, 3.4, hz + 9), 1.3, 1.0, "bone", 6, n=6)
        P.flat(g, stump & (Z > hz + 8.3), "bone", 7)
    return g


def _build():
    rig = Rig("zombie-crawler", ORIGIN, torso())
    rig.add("head", head(), NECK)
    for name in SHOULDERS:
        rig.add(name, arm(name), SHOULDERS[name])
    for name in HIPS:
        rig.add(name, leg(name), HIPS[name])
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.6, 4, 12, 0), (1.0, 4, 12, 0), (1.6, 0, -10, 4), (2.0, 0, -10, 4), (2.4, 0, 0, 0))},
            "arm-l": {"rot": wave(2.4, (3, 0, 0), base=(3, 0, 0))}}
    crawl = 1.2
    move = {"arm-l": {"rot": wave(crawl, (11, 0, 0), base=(11, 0, 0))},
            "arm-r": {"rot": wave(crawl, (11, 0, 0), phase=np.pi, base=(11, 0, 0))},
            "head": {"rot": wave(crawl, (0, 6, 4))},
            "leg-l": {"rot": wave(crawl, (0, 6, 0))}, "leg-r": {"rot": wave(crawl, (0, -5, 0), phase=0.6)},
            "zombie-crawler": {"rot": wave(crawl, (0, 4, 0))}}
    attack = {"head": {"rot": seq((0, 0, 0, 0), (0.2, 16, 0, 0), (0.45, -10, 0, 0), (0.8, 0, 0, 0))},
              "zombie-crawler": {"loc": seq((0, 0, 0, 0), (0.2, 0, 0, 2), (0.45, 0, 0, -4), (0.8, 0, 0, 0))},
              "arm-l": {"rot": seq((0, 0, 0, 0), (0.25, 30, 0, -10), (0.5, 4, 0, 0), (0.8, 0, 0, 0))}}
    hit = {"head": {"rot": seq((0, 0, 0, 0), (0.1, 18, 10, 8), (0.55, 0, 0, 0))},
           "zombie-crawler": {"loc": seq((0, 0, 0, 0), (0.1, 0, 0, 2.5), (0.55, 0, 0, 0))}}
    death = {"zombie-crawler": {"rot": seq((0, 0, 0, 0), (0.5, 0, 0, 18), (1.2, 0, 0, 72))},
             "head": {"rot": seq((0, 0, 0, 0), (1.2, -20, 0, -25))},
             "arm-r": {"rot": seq((0, 0, 0, 0), (1.2, 30, 0, 0))}}
    return make("creatures", "zombie-crawler", "Zombie Crawler", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-jaw", (CX, 20, 2.5), parent="head")],
                pfx=[fx("rvx-apocalypse-vomit-spray", "socket-jaw", "clip:attack", at=0.28, size=10, aim=(0, 0, -1))])


def build():
    return ground(_build())
