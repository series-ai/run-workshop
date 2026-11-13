"""Zombie walker, in the Pirate Nation creature style.

A chunky caricature after the PN zombie boss (Kevin) and the zombie
totems: a huge boxy teal head that juts forward, an exposed pink brain,
one big bulging eye and one small red glowing eye, a wide mouth of
crooked teeth, and long arms held out in front ending in oversized
clawed hands. A hunched office worker: a torn sky-blue shirt with a red
tie and bare ribs, brown trousers, one shoe lost. Head, chest, jaw and
limbs are true-slope prisms; cloth, ribs, stitches and face are paint.
Clips: idle (sway, head loll), move (shamble), attack (double-arm
swipe), hit, death (falls back). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, limb, make, plan, seq, side, skin, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (44, 46, 44)
CX, CZ = 22.0, 26.0
HIP_Y, SH_Y, NECK = 12.0, 24.0, (22.0, 25.0, 24.0)
HIPS = {"leg-l": (CX - 4.5, HIP_Y, CZ + 0.5), "leg-r": (CX + 4.5, HIP_Y, CZ + 0.5)}
SHOULDERS = {"arm-l": (CX - 10.0, SH_Y, CZ - 1.5), "arm-r": (CX + 10.0, SH_Y, CZ - 1.5)}
SKIN = ("teal", 5)
SHIRT, PANTS = ("sky", 5), ("wood", 4)


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    m = limb(g, (hx, hy + 1, hz), (hx + s * 0.5, 3.5, hz - 1), 2.9, 2.5, *PANTS, n=4)
    P.mottle(g, m, *PANTS, cell=2, seed=3 + s)
    P.flat(g, m & (Y < 6) & ((np.floor(X) + np.floor(Z)) % 3 == 0), PANTS[0], PANTS[1] - 1)  # frayed hem
    if s > 0:  # a scuffed shoe
        foot = box(g, hx - 3.5, 0, hz - 9, hx + 3.5, 4, hz + 2, "darkwood", 6)
        P.flat(g, foot & (Y < 1), "darkwood", 4)
        P.outline(g, foot, "darkwood", 5, normal="y")
    else:  # a bare foot with yellow nails
        foot = box(g, hx - 3.5, 0, hz - 8, hx + 3.5, 3.5, hz + 2, *SKIN)
        skin(g, foot, *SKIN, seed=9)
        for k in range(3):
            box(g, hx - 3 + k * 2.4, 0, hz - 10, hx - 1.8 + k * 2.4, 2, hz - 8, "gold", 6)
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pelvis = box(g, CX - 7.5, HIP_Y - 2, CZ - 4, CX + 7.5, HIP_Y + 3, CZ + 5, *PANTS)
    P.mottle(g, pelvis, *PANTS, cell=2, seed=1)
    belt = pelvis & (Y > HIP_Y + 1.5)
    P.flat(g, belt, "darkwood", 5)
    P.flat(g, belt & (np.abs(X - CX) < 1.2) & (Z < CZ - 3), "gold", 6)
    # a hunched chest: a side prism leaning forward (true slopes front and back)
    chest = side(g, [(HIP_Y + 2, CZ - 4.5), (HIP_Y + 2, CZ + 5.5), (SH_Y + 2, CZ + 3.5), (SH_Y + 3, CZ - 3), (SH_Y + 1, CZ - 7.5)], CX - 8.5, CX + 8.5, *SHIRT)
    P.mottle(g, chest, *SHIRT, cell=3, seed=2)
    P.outline(g, chest, SHIRT[0], SHIRT[1] - 2, normal="x")
    front = chest & (Z < CZ - 1)
    # the red tie, a torn hole with bare ribs, a pocket
    P.flat(g, front & (np.abs(X - CX) < 1.3 + (Y < HIP_Y + 8) * 0.8) & (Y > HIP_Y + 4), "red", 4)
    P.flat(g, front & (np.abs(X - CX) < 1.6) & (Y > SH_Y - 1), "red", 3)
    hole = chest & (np.hypot(X - (CX + 4.5), (Y - (HIP_Y + 8)) * 0.9) < 3.4) & (Z < CZ - 1)
    P.flat(g, hole, *SKIN)
    P.flat(g, hole & (np.floor(Y) % 2 == 0), "bone", 6)
    P.flat(g, front & (X > CX - 7) & (X < CX - 3.5) & (Y > SH_Y - 5) & (Y < SH_Y - 2), SHIRT[0], SHIRT[1] - 1)
    PP.blotch(g, chest, "khaki", 5, cell=2, chance=0.03, seed=4)  # grime
    neck = box(g, CX - 3, SH_Y, CZ - 5, CX + 3, SH_Y + 4, CZ + 1, *SKIN)
    skin(g, neck, *SKIN, seed=5)
    return g


def head() -> Grid:
    """A huge boxy head (PN caricature): a slanted crown and an underbite jaw."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    y0 = ny - 1
    fz = nz - 10.0  # the face plane (a whole voxel plane, so paint lands on it)
    poly = [(y0, nz + 1.5), (y0, fz - 1), (y0 + 5.5, fz - 1), (y0 + 5.5, fz), (y0 + 12, fz), (y0 + 14, fz + 2.5), (y0 + 14, nz - 1), (y0 + 11, nz + 2)]
    m = side(g, poly, CX - 7.5, CX + 7.5, *SKIN)
    skin(g, m, *SKIN, seed=6)
    # ears: little wedges
    for s in (-1, 1):
        ear = S.bar(g, "z", (CX + s * 7.5, y0 + 6), (CX + s * 9.8, y0 + 9.5), 2.4, nz - 5, nz - 2, *SKIN)
        skin(g, ear, *SKIN, seed=7)
    # the brain bulging out of a split in the skull: two lumps with painted folds
    brain = np.zeros(g.shape, dtype=bool)
    for bx, bz, r in ((CX + 2.5, nz - 5.5, 3.6), (CX - 2.0, nz - 3.5, 2.8)):
        brain |= S.dome(g, bx, bz, y0 + 13.5, r, h=r * 0.9, n=8, rings=2, ramp="pink", base=5, ribs=None, painter=lambda gg, mm, fr: P.flat(gg, mm, "pink", 5))
    P.flat(g, brain & ((np.floor(X) + np.floor(Z) * 2) % 5 == 0), "pink", 3)
    P.flat(g, brain & ((np.floor(X) * 2 - np.floor(Z)) % 7 == 0), "pink", 3)
    # the face: one huge bulging eye, one small red eye, a heavy brow
    legend = {"o": C("teal", 3), "w": C("bone", 7), "p": C("navy", 4), "r": C("red", 6), "b": C("teal", 2)}
    rows = ["bbbbbbb...bbbb", "owwwwwo.......", "owwwwwo...oooo", "owwwppo...orro", "owwwppo...orro", "owwwwwo...oooo", "ooooooo......."]
    G.stamp(g, "-z", fz, int(CX - 7), int(y0 + 5), rows, legend, depth=2)
    # a wide mouth of crooked chunky teeth on the jutting jaw
    mouth = m & (Z < fz - 0.2) & (Y > y0 + 0.8) & (Y < y0 + 5) & (np.abs(X - CX) < 6.2)
    P.flat(g, mouth, "red", 2)
    P.flat(g, mouth & (Y > y0 + 3.5) & ((np.floor(X) // 2) % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < y0 + 2) & ((np.floor(X) // 2) % 3 == 1), "bone", 5)
    P.flat(g, m & (np.abs(X - (CX + 6)) < 0.6) & (Y > y0 + 6) & (Y < y0 + 11) & (Z < fz + 3), "khaki", 4)  # stitches
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    ex, ey, ez = sx + s * 2.5, sy - 3.5, sz - 7.0
    wx, wy, wz = sx + s * 2.0, sy - 4.0, sz - 14.0
    upper = limb(g, (sx, sy, sz), (ex, ey, ez), 2.5, 2.3, *SHIRT, n=4)
    P.mottle(g, upper, *SHIRT, cell=2, seed=10 + s)
    P.flat(g, upper & (Z < ez + 2), SHIRT[0], SHIRT[1] - 1)  # torn cuff
    fore = limb(g, (ex, ey, ez + 1), (wx, wy, wz), 2.0, 1.9, *SKIN, n=4)
    hand = box(g, wx - 3.5, wy - 3.5, wz - 6, wx + 3.5, wy + 3, wz + 1, *SKIN)
    skin(g, fore | hand, *SKIN, seed=12 + s)
    for k in range(3):  # three big clawed fingers, hooked down
        fxk = wx - 2.4 + k * 2.4
        fg = limb(g, (fxk, wy - 0.5, wz - 5.5), (fxk, wy - 3.5, wz - 9.5), 1.1, 0.9, *SKIN, n=4)
        P.flat(g, fg & (Z < wz - 8.5), "gold", 6)
    return g


def build():
    rig = Rig("zombie-walker", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body")
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    idle = {"body": {"rot": wave(2.4, (3, 0, 3))},
            "head": {"rot": wave(2.4, (-5, 6, 9), phase=0.8)},
            "arm-l": {"rot": wave(2.4, (6, 0, -2), phase=0.3)},
            "arm-r": {"rot": wave(2.4, (6, 0, 2), phase=1.9)}}
    move = {"leg-l": {"rot": wave(1.2, (24, 0, 0))},
            "leg-r": {"rot": wave(1.2, (-24, 0, 0))},
            "body": {"rot": wave(1.2, (0, 6, 5), phase=0.2), "loc": wave(1.2, (0, 0.8, 0), phase=1.6, double=True)},
            "head": {"rot": wave(1.2, (6, -5, -8), phase=0.9)},
            "arm-l": {"rot": wave(1.2, (-8, 0, 0), phase=0.4)},
            "arm-r": {"rot": wave(1.2, (8, 0, 0), phase=0.4)}}
    attack = {"body": {"rot": seq((0, 0, 0, 0), (0.25, 8, 0, 0), (0.45, -16, 0, 0), (0.9, 0, 0, 0))},
              "arm-l": {"rot": seq((0, 0, 0, 0), (0.25, 50, 0, -8), (0.45, -40, 0, 6), (0.9, 0, 0, 0))},
              "arm-r": {"rot": seq((0, 0, 0, 0), (0.25, 50, 0, 8), (0.45, -40, 0, -6), (0.9, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.25, 12, 0, 0), (0.45, -10, 0, 0), (0.9, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.1, 16, -6, 0), (0.5, 0, 0, 0))},
           "head": {"rot": seq((0, 0, 0, 0), (0.1, 22, 8, 10), (0.5, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.3, -8, 0, 0), (0.9, 84, 0, 0), (1.05, 78, 0, 0), (1.4, 82, 0, 0))},
             "head": {"rot": seq((0, 0, 0, 0), (0.9, 25, 0, 20), (1.4, 20, 0, 25))},
             "arm-l": {"rot": seq((0, 0, 0, 0), (0.9, 50, 0, -30))}, "arm-r": {"rot": seq((0, 0, 0, 0), (0.9, 40, 0, 35))}}
    return make("creatures", "zombie-walker", "Zombie Walker", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-chest", (CX, HIP_Y + 8, CZ - 7), parent="body"), rig.socket("socket-head", (CX, NECK[1] + 16, NECK[2] - 6), parent="head")],
                pfx=[fx("rvx-apocalypse-gore-burst", "socket-chest", "clip:hit", size=28)])
