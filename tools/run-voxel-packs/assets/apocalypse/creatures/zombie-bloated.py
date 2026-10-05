"""Bloated zombie, in the Pirate Nation creature style.

A hulking caricature: a colossal faceted belly (stacked octagon frustums,
true slopes all round) bursting out of split denim overalls, covered in
glowing toxic boils, with stubby legs in big boots, short arms with huge
clawed hands, and a tiny lolling head with mismatched eyes and a drooling
open mouth. Denim, straps, boils and face are paint. Clips: idle (wheeze,
the belly swells), move (lumber and sway), attack (belly slam that vents
gas from the mouth), hit, death (topples back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, bump, ctr, fx, limb, make, plan, seq, skin, wave
from pnkit import box
from voxgrid import C, Clip, Grid

SZ = (46, 48, 42)
CX, CZ = 23.0, 22.0
HIP_Y = 9.0
NECK = (CX, 31.0, 20.0)
HIPS = {"leg-l": (CX - 6.0, HIP_Y + 2, CZ + 1), "leg-r": (CX + 6.0, HIP_Y + 2, CZ + 1)}
SHOULDERS = {"arm-l": (CX - 12.5, 25.0, CZ), "arm-r": (CX + 12.5, 25.0, CZ)}
SKIN = ("teal", 5)
DENIM = ("blue", 5)


def oval(cx, cz, rx, rz, n=8):
    return [(cx + rx * math.cos(math.pi / n + 2 * math.pi * k / n), cz + rz * math.sin(math.pi / n + 2 * math.pi * k / n)) for k in range(n)]


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    m = limb(g, (hx, hy, hz), (hx + s * 0.5, 3.5, hz - 0.5), 3.6, 3.2, *DENIM, n=4)
    P.flat(g, m, *DENIM)
    P.flat(g, m & (Y < 5.5), DENIM[0], DENIM[1] - 1)  # rolled cuffs
    boot = box(g, hx - 4.2, 0, hz - 8, hx + 4.2, 4, hz + 3.5, "darkwood", 6)
    P.flat(g, boot & (Y < 1), "darkwood", 4)
    P.flat(g, boot & (Z < hz - 7) & (Y > 1), "darkwood", 7)  # scuffed toe caps
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    ymid, ytop = 20.0, 31.0
    lo = plan(g, oval(CX, CZ, 8.5, 7.0), HIP_Y, ymid, *SKIN, top=oval(CX, CZ - 1.5, 15.5, 13.0))
    hi = plan(g, oval(CX, CZ - 1.5, 15.5, 13.0), ymid, ytop, *SKIN, top=oval(CX, CZ, 9.0, 7.5))
    belly = lo | hi
    skin(g, belly, *SKIN, seed=1, cell=5)
    # split overalls: denim below the waist, a bib on the front, two straps
    over = belly & (Y < 18)
    bib = belly & (Z < CZ - 3) & (np.abs(X - CX) < 8.0) & (Y < 29)
    straps = belly & (np.abs(np.abs(X - CX) - 6.5) < 1.5) & (Y > 24)
    denim = over | bib | straps
    P.flat(g, denim, *DENIM)
    PP.blotch(g, denim, DENIM[0], DENIM[1] + 1, cell=4, chance=0.05, seed=2)
    P.flat(g, belly & (np.abs(Y - 18) < 0.6), "darkwood", 6)  # the stitched waist seam
    P.outline(g, bib & (Y > 18), DENIM[0], DENIM[1] - 2)
    tear = belly & (Z < CZ - 8) & (np.hypot(X - (CX + 2.5), (Y - 21) * 1.2) < 2.0)
    P.flat(g, tear, *SKIN)  # the belly bursting through a split in the bib
    patch = belly & (Z < CZ - 6) & (np.abs(X - (CX - 3.5)) < 1.6) & (np.abs(Y - 13) < 1.6)
    P.flat(g, patch, "red", 4)
    for bx in (CX - 6.5, CX + 6.5):
        P.flat(g, belly & (np.hypot(X - bx, Y - 27.5) < 1.2) & (Z < CZ - 3), "gold", 6)
    # glowing toxic boils on the bare hide: a few raised faceted lumps
    for bx, by, bz, r in ((CX - 11.5, 22, CZ - 7.5, 2.4), (CX + 12.0, 20, CZ - 6.0, 2.2), (CX - 8.5, 27, CZ - 8.5, 1.6), (CX + 13.5, 25, CZ + 1.5, 1.8), (CX - 14.0, 19, CZ + 2.0, 1.8)):
        boil = bump(g, bx, bz, by - 1.0, r, r + 0.6, "toxic", 6)
        P.flat(g, boil & (Y > by + r - 0.5), "toxic", 7)
    neck = box(g, CX - 3.5, ytop - 1, NECK[2] - 3, CX + 3.5, ytop + 1.5, NECK[2] + 3, *SKIN)
    del neck
    return g


def head() -> Grid:
    """A tiny lolling head on the huge body (the caricature contrast)."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    fz = nz - 5.0
    m = box(g, CX - 5, ny, fz, CX + 5, ny + 9, nz + 4, *SKIN)
    skin(g, m, *SKIN, seed=5)
    cap = plan(g, [(CX - 5.5, fz - 0.5), (CX + 5.5, fz - 0.5), (CX + 5.5, nz + 4.5), (CX - 5.5, nz + 4.5)], ny + 9, ny + 11, "khaki", 5, top=[(CX - 4, fz + 1), (CX + 4, fz + 1), (CX + 4, nz + 3), (CX - 4, nz + 3)])
    brim = box(g, CX - 5, ny + 8, fz - 3, CX + 5, ny + 9, fz, "khaki", 4)
    del cap, brim
    legend = {"w": C("bone", 7), "p": C("navy", 4), "y": C("gold", 6), "o": C("teal", 3)}
    rows = ["ooo..oo", "wwp..yy", "www..yy"]
    G.stamp(g, "-z", fz, int(CX - 3.5), int(ny + 4), rows, legend, depth=2)
    mouth = m & (Z < fz + 1) & (Y > ny + 0.8) & (Y < ny + 3.2) & (np.abs(X - CX - 0.5) < 2.6)
    P.flat(g, mouth, "red", 2)
    P.flat(g, mouth & (Y > ny + 2.4) & (np.floor(X) % 2 == 0), "bone", 6)
    drool = limb(g, (CX + 1.5, ny + 1.2, fz - 0.5), (CX + 1.8, ny - 3.5, fz - 1.0), 0.6, 0.5, "toxic", 6, n=4)
    del drool
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    wx, wy, wz = sx + s * 4.0, sy - 9.0, sz - 3.0
    arm_m = limb(g, (sx, sy, sz), (wx, wy, wz), 3.0, 2.5, *SKIN, n=4)
    hand = box(g, wx - 4, wy - 7, wz - 4, wx + 4, wy, wz + 4, *SKIN)
    skin(g, arm_m | hand, *SKIN, seed=7 + s)
    for k in range(3):
        fxk = wx - 2.6 + k * 2.6
        fg = limb(g, (fxk, wy - 6.5, wz - 3), (fxk, wy - 9.5, wz - 6), 1.1, 0.9, *SKIN, n=4)
        P.flat(g, fg & (Z < wz - 5), "gold", 6)
    return g


def build():
    rig = Rig("zombie-bloated", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body", rot=(0, 0, 10))
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    idle = {"body": {"scale": wave(2.6, (0.035, -0.02, 0.035), base=(1, 1, 1)), "rot": wave(2.6, (0, 0, 2), phase=0.5)},
            "head": {"rot": wave(2.6, (6, 0, 7), phase=1.2)},
            "arm-l": {"rot": wave(2.6, (4, 0, -3), phase=0.2)}, "arm-r": {"rot": wave(2.6, (4, 0, 3), phase=1.8)}}
    move = {"leg-l": {"rot": wave(1.6, (16, 0, 0))}, "leg-r": {"rot": wave(1.6, (-16, 0, 0))},
            "body": {"rot": wave(1.6, (0, 5, 7), phase=0.1), "loc": wave(1.6, (0, 0.7, 0), phase=1.6, double=True)},
            "head": {"rot": wave(1.6, (0, 0, -10), phase=0.8)},
            "arm-l": {"rot": wave(1.6, (-12, 0, -4))}, "arm-r": {"rot": wave(1.6, (12, 0, 4))}}
    attack = {"body": {"rot": seq((0, 0, 0, 0), (0.35, 14, 0, 0), (0.55, -24, 0, 0), (0.7, -20, 0, 0), (1.1, 0, 0, 0)),
                       "loc": seq((0, 0, 0, 0), (0.35, 0, 1.5, 0), (0.55, 0, -1.5, -3), (1.1, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.35, 20, 0, 0), (0.55, -10, 0, 0), (1.1, 0, 0, 0))},
              "arm-l": {"rot": seq((0, 0, 0, 0), (0.35, 30, 0, -30), (0.55, -20, 0, 0), (1.1, 0, 0, 0))},
              "arm-r": {"rot": seq((0, 0, 0, 0), (0.35, 30, 0, 30), (0.55, -20, 0, 0), (1.1, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.12, 10, 0, -6), (0.5, 0, 0, 0)), "scale": seq((0, 1, 1, 1), (0.12, 1.06, 0.95, 1.06), (0.5, 1, 1, 1))},
           "head": {"rot": seq((0, 0, 0, 0), (0.12, 16, 0, -14), (0.5, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.4, -6, 0, 0), (1.1, 80, 0, 0), (1.25, 74, 0, 0), (1.6, 78, 0, 0))},
             "head": {"rot": seq((0, 0, 0, 0), (1.1, 30, 0, 25))},
             "arm-l": {"rot": seq((0, 0, 0, 0), (1.1, 20, 0, -60))}, "arm-r": {"rot": seq((0, 0, 0, 0), (1.1, 20, 0, 60))}}
    return make("creatures", "zombie-bloated", "Bloated Zombie", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-belly", (CX, 19, CZ - 13.5), parent="body"), rig.socket("socket-mouth", (CX, NECK[1] + 2, NECK[2] - 6), parent="head")],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-belly", "idle", size=28), fx("rvx-apocalypse-vomit-spray", "socket-mouth", "clip:attack", size=26, aim=(-0.042, -0.239, -0.97), at=0.44)])
