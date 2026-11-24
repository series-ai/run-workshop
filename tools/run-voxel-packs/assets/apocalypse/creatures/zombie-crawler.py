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
(arm-over-arm crawl), attack (rears up with a claw raised,
lunges into a bite as the claw slams down), hit, death (the arms give
way and the chest slams flat). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _zombie_falls as zf
from _life import Rig, ctr, front, fx, limb, make, seq, side, skin, wave
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
    # attack: it drags itself back and rears up on the left arm, the right
    # claw cocked high and the head thrown back, mouth gaping (f0-10, still
    # coiling), then hurls itself forward 3 frames into the bite (impact
    # f13): the chest drives down and ahead, the claw slams down on the
    # victim and the left hand slaps down beside it. It drives on past the
    # bite (f15), then worries it in a moving hold: the head wrenches side
    # to side, the body tugs back and forth and the claw rakes, before it
    # drags back to its spot, sliding a little past it, and settles. The
    # torso pitches about its hips and the legs counter it, so the dragging
    # legs stay on the floor.
    f = 1 / 30
    imp = 13 * f
    T = zf.fr
    R = "zombie-crawler"
    pitch = T((0, 0, 0, 0), (4, 4, 0, -1), (8, 8, 0, -2), (10, 9, 0, -2), (13, -4, 0, 1), (15, -5.5, 0, 2), (17, -3.5, 0, -2), (19, -5, 0, 2),
              (21, -3.5, 0, -1.5), (23, -4.5, 0, 0.5), (27, -1.5, 0, 0), (31, 1.5, 0, 0), (35, 0, 0, 0))
    slide = T((0, 0, 0, 0), (4, 0, -0.03, 1.8), (8, 0, -0.04, 3.2), (10, 0, -0.04, 3.5), (13, 0, 0, -8.5), (15, 0, 0, -10.0), (17, 0, -0.15, -8.8), (19, 0, 0, -9.9),
              (21, 0, -0.09, -8.9), (23, 0, 0, -9.5), (27, 0, 0, -5.0), (31, 0, 0, 0.7), (35, 0, 0, 0))
    attack = {R: {"rot": pitch, "loc": zf.pivot_x(pitch, slide, 7.0, 7.0, y0=3.0)},
              "head": {"rot": T((0, 0, 0, 0), (5, 14, 0, 0), (9, 28, 0, -4), (11, 31, 0, -5), (13, -20, 0, 0), (15, -28, 6, 6), (17, -18, -14, -8),
                                (19, -26, 12, 7), (21, -18, -10, -5), (23, -22, 5, 3), (27, -8, 0, 0), (31, 4, 0, 0), (35, 0, 0, 0))},
              "arm-r": {"rot": T((0, 0, 0, 0), (4, 40, 0, 6), (8, 84, 0, 10), (10, 90, 0, 12), (13, 22, 0, 0), (15, 15, 0, -4), (17, 23, 0, 2),
                                 (19, 16, 0, -5), (21, 22, 0, 1), (23, 17, 0, -2), (27, 10, 0, 0), (31, -3, 0, 0), (35, 0, 0, 0))},
              "arm-l": {"rot": T((0, 0, 0, 0), (4, -6, 0, -3), (8, -11, 0, -6), (10, -12, 0, -6), (12, 18, 0, 0), (13, 11.5, 0, 0), (15, 14.5, 0, 2),
                                 (17, 10, 0, 0), (19, 14, 0, 2), (21, 10, 0, 0), (23, 12, 0, 1), (27, 4, 0, 0), (31, -2, 0, 0), (35, 0, 0, 0))},
              "leg-l": {"rot": T((0, 0, 0, 0), (4, -4, 4, 0), (8, -8, 8, 0), (10, -9, 10, 0), (13, 4, -6, 0), (15, 5.5, -7.5, 0), (17, 3.5, -3, 0),
                                 (19, 5, 3, 0), (21, 3.5, -1, 0), (23, 4.5, 1, 0), (27, 1.5, 0, 0), (31, -1.5, 0, 0), (35, 0, 0, 0))},
              "leg-r": {"rot": T((0, 0, 0, 0), (4, -4, -3, 0), (8, -8, -7, 0), (10, -9, -8, 0), (13, 4, 5, 0), (15, 5.5, 6.5, 0), (17, 3.5, 2, 0),
                                 (19, 5, -3, 0), (21, 3.5, 1, 0), (23, 4.5, -1, 0), (27, 1.5, 0, 0), (31, -1.5, 0, 0), (35, 0, 0, 0))}}
    # hit: the blow rears the chest up about the hips (20-25 degrees by f2-4)
    # and shoves the whole body back along the floor; the hands are thrown
    # clear, then slap back down at f7-8 as the chest drops, dipping below
    # rest (f15-17) before it settles. The legs counter the pitch so they
    # stay on the floor.
    T = zf.fr
    pitch = T((0, 0, 0, 0), (1, 13, 0, 3), (2, 21, 0, 5), (4, 24, 0, 6), (6, 17, 0, 4), (8, 4, 0, 1), (12, -2, 0, -1), (16, -5, 0, 0), (21, 1, 0, 0), (26, 0, 0, 0))
    shove = T((0, 0, 0, 0), (1, 0.3, 0.8, 4.2), (2, 0.5, 1.3, 6.2), (4, 0.6, 1.6, 7.3), (6, 0.6, 1.0, 7.6), (8, 0.5, 0, 7.4), (12, 0.3, 0, 5.8),
               (17, 0.1, 0, 1.8), (22, 0, 0, -0.3), (26, 0, 0, 0))
    hit = {"zombie-crawler": {"rot": pitch, "loc": zf.pivot_x(pitch, shove, 7.0, 7.0, y0=3.0)},
           "head": {"rot": T((0, 0, 0, 0), (1, -8, 4, 3), (3, -12, 9, 6), (6, 10, 12, 8), (9, 16, 6, 4), (13, 4, -3, -2), (17, -6, 1, 0), (22, 1, 0, 0), (26, 0, 0, 0))},
           "leg-l": {"rot": T((0, 0, 0, 0), (1, -13, 3, 0), (2, -21, 6, 0), (4, -24, 9, 0), (6, -17, 8, 0), (8, -4, 3, 0), (12, 2, -3, 0), (16, 5, -1, 0), (21, -1, 0, 0), (26, 0, 0, 0))},
           "leg-r": {"rot": T((0, 0, 0, 0), (1, -13, -2, 0), (2, -21, -5, 0), (4, -24, -8, 0), (6, -17, -8, 0), (8, -4, -3, 0), (12, 2, 3, 0), (16, 5, 1, 0), (21, -1, 0, 0), (26, 0, 0, 0))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):  # thrown clear, slapped back down on f7-8
        d = 0 if s < 0 else 1
        hit[name] = {"rot": T((0, 0, 0, 0), (1, 8, 0, s * 6), (3 + d, 22, 0, s * 18), (5 + d, 16, 0, s * 20), (7 + d, -4, 0, s * 6), (9 + d, 2, 0, s * 2),
                              (12, 4, 0, 0), (16, 11, 0, 0), (21, -1, 0, 0), (26, 0, 0, 0))}
    # death: shot, it rears up high on straightened arms with the head
    # thrown back and struggles there, wobbling side to side as it tries to
    # hold itself up (f0-11, a moving hold). Then the arms buckle out and
    # the chest drops, gathering speed, and slams flat onto the floor at
    # full speed (impact f16, the flattest frame, squashed). One small
    # bounce and a hard settle; the heavy head smacks down a frame later and
    # lolls aside, the arms flop out flat to the sides, the legs kick once.
    dimp = 16 * f
    R = "zombie-crawler"
    T = zf.fr
    # the torso pitches about its hips (they stay on the floor): hip_lock
    # adds the root shift that keeps the hip point fixed
    rot = T((0, 0, 0, 0), (3, 8, 0, 0), (6, 14, 0, 2), (8, 15, 0, -4), (10, 11, 0, 5), (12, 13, 0, 1), (13, 9, 0, -4), (14, 1, 0, -7),
            (15, -10, 0, -5), (16, -28, 0, -2), (18, -27, 0, -2), (21, -28, 0, -2), (40, -28, 0, -2))
    loc = T((0, 0, 0, 0), (3, 0, 0, 2.0), (6, 0, 0, 3.6), (8, -0.6, 0, 4.0), (10, 0.6, 0, 3.6), (12, 0, 0, 3.4), (13, -0.4, 0, 3.0), (14, -0.8, 0, 2.2),
            (15, -0.6, 0, 1.2), (16, -0.3, 0, 0.4), (18, -0.3, 0.35, 0.4), (21, -0.3, 0, 0.4), (40, -0.3, 0, 0.4))
    death = {R: {"rot": rot, "loc": zf.pivot_x(rot, loc, 7.0, 7.0, y0=3.0),
                 "scale": T((0, 1, 1, 1), (12, 1, 1, 1), (15, 1.01, 0.98, 1.0), (16, 1.07, 0.86, 1.03), (19, 0.98, 1.04, 0.99), (22, 1.01, 0.99, 1), (25, 1, 1, 1))},
             "head": {"rot": T((0, 0, 0, 0), (3, 12, 0, 0), (6, 24, 0, 0), (8, 22, -6, -3), (10, 17, 6, 4), (12, 20, 2, 0), (14, 12, -4, 0), (15, 4, 2, 1), (16, 0, 8, 2),
                               (17, -6, 16, 4), (19, -2, 20, 3), (22, -4, 20, 3), (40, -4, 20, 3))}}
    # the arms lock and push the chest up (the hands stay planted while the
    # torso rears back over them), teeter, then the left arm buckles out
    # (f12-13) and the right a frame later, and both splay out flat as the
    # chest slams down
    for name, s, b in (("arm-l", -1, 0), ("arm-r", 1, 1)):
        buckle = [(13, -14, 0, s * 10), (14, 6, 0, s * 26), (15, 30, 0, s * 44)] if b == 0 else [(13, -12, 0, s * 6), (14, 10, 0, s * 20), (15, 32, 0, s * 40)]
        death[name] = {"rot": T((0, 0, 0, 0), (3, -18, 0, 0), (6, -30, 0, s * 2), (8, -33, 0, -s * 3), (10, -26, 0, s * 4), (12, -28, 0, s * 4),
                                *buckle, (16, 50, 0, s * 58), (18, 46, 0, s * 61), (21, 50, 0, s * 60), (40, 50, 0, s * 60))}
    for name, lag in (("leg-l", 0), ("leg-r", 1)):  # they counter the torso's pitch so they stay on the floor, kick once on the slam
        death[name] = {"rot": T((0, 0, 0, 0), (3, -8, 0, 0), (6, -14, 0, 0), (8, -15, 0, 0), (10, -11, 0, 0), (12, -13, 0, 0), (13, -9, 0, 0), (14, -1, 0, 0),
                                (15, 10, 0, 0), (16, 28, 0, 0), (18 + lag, 16, 0, 0), (21 + lag, 28.5, 0, 0), (24 + lag, 27, 0, 0), (40, 27, 0, 0))}
    return make("creatures", "zombie-crawler", "Zombie Crawler", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp), Clip("hit", hit, loop=False, floor=True), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-jaw", (CX, 20, 2.5), parent="head")],
                pfx=[fx("rvx-apocalypse-vomit-spray", "socket-jaw", "clip:attack", at=imp, size=10, aim=(0, 0, -1))])


def build():
    # Key the death's resting pose on the floor so its bounce leaves it.
    return zf.pin_rest(_build())
