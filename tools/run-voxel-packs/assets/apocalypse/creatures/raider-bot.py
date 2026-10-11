"""Raider bot, in the Pirate Nation creature style (PN mecha reskin).

A scrap-built caricature robot: a fat red oil-drum torso with a hazard
band and a glowing teal core, an oversized cream CRT-TV head whose screen
shows an angry red face, rabbit-ear antennas, a smoking exhaust stack on
its back, piston legs with gold knee joints and big hazard-capped feet,
a pincer claw on the left arm and a huge buzzsaw on the right. Limbs,
claws, saw teeth and antennas are true-slope prisms; plates, rivets, the
face and stripes are paint. Clips: idle (scan and hum), move (stomp),
attack (buzzsaw swing, the saw spins), hit (spark jolt), death (collapse).
Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, ctr, fx, keys, limb, make, plan, seq, wave
from pnkit import box, edges
from voxgrid import C, Clip, Grid, turn

SZ = (50, 48, 40)
CX, CZ = 25.0, 20.0
HIP_Y = 11.0
NECK = (CX, 27.0, CZ)
HIPS = {"leg-l": (CX - 4.5, HIP_Y, CZ), "leg-r": (CX + 4.5, HIP_Y, CZ)}
SHOULDERS = {"arm-l": (CX - 10.0, 22.0, CZ), "arm-r": (CX + 10.0, 22.0, CZ)}
SAW = (CX + 14.5, 11.5, CZ - 9.0)


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    thigh = limb(g, (hx, hy, hz), (hx + s * 0.8, 7.0, hz - 1), 1.7, 1.5, "steel", 6, n=4)
    shin = S.disc(g, "y", hx + s * 0.8, hz - 1, 2.8, 3, 7.0, "rust", 5, n=8)
    P.flat(g, shin & (np.floor(Y) % 3 == 0), "rust", 4)
    knee = S.disc(g, "x", 7.0, hz - 1, 2.2, hx - 2.2, hx + 2.2, "gold", 5, n=8)
    foot = box(g, hx - 4, 0, hz - 8, hx + 4, 3.5, hz + 3, "steel", 5)
    P.plates(g, foot, "steel", 5, size=(6, 4), frame="top", seed=2 + s)
    PP.hazard(g, foot & (Z < hz - 5), period=4, a=("gold", 5), b=("darkwood", 4))
    del thigh, knee
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hips = box(g, CX - 7, HIP_Y - 2, CZ - 4, CX + 7, HIP_Y + 1, CZ + 4, "steel", 4)
    P.outline(g, hips, "steel", 3)
    drum = S.drum(g, CX, CZ, HIP_Y, 14, 9.0, ramp="red", base=4, hoop="steel", band=("gold", 5), wear=True, seed=3)
    # the glowing core on the front facet
    ring = S.disc(g, "z", CX, HIP_Y + 7, 3.8, CZ - 9.5, CZ - 8.5, "steel", 4, n=8)
    core = S.disc(g, "z", CX, HIP_Y + 7, 3.0, CZ - 10.0, CZ - 9.0, "teal", 6, n=8)
    P.flat(g, core & (np.hypot(X - CX, Y - (HIP_Y + 7)) < 1.5), "teal", 7)
    # shoulder bolts and an exhaust stack on the back
    for s in (-1, 1):
        S.disc(g, "x", 22.0, CZ, 2.6, CX + s * 9 - 1.5, CX + s * 9 + 1.5, "gold", 5, n=8)
    stack = S.disc(g, "y", CX + 4, CZ + 9.5, 1.8, HIP_Y + 7, 34, "steel", 5, n=8)
    P.flat(g, stack & (Y > 32), "darkwood", 5)
    S.bar(g, "z", (CX + 2.5, 34.8), (CX + 6.5, 36), 1.2, CZ + 8, CZ + 11, "steel", 6)
    neck = S.disc(g, "y", CX, CZ, 2.5, HIP_Y + 14, NECK[1] + 1, "steel", 4, n=8)
    del drum, ring, stack, neck
    return g


def head() -> Grid:
    """An oversized CRT TV with an angry red face on its teal screen."""
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    y0 = ny
    fz = nz - 6.0
    tv = box(g, CX - 7.5, y0, fz, CX + 7.5, y0 + 11, nz + 5, "bone", 6)
    back = plan(g, [(CX - 6, nz + 5), (CX + 6, nz + 5), (CX + 6, nz + 8), (CX - 6, nz + 8)], y0 + 1, y0 + 10, "bone", 5, top=[(CX - 4, nz + 5), (CX + 4, nz + 5), (CX + 4, nz + 7), (CX - 4, nz + 7)])
    P.mottle(g, tv, "bone", 6, cell=3, seed=4)
    P.flat(g, edges(tv), "bone", 4)
    screen = tv & (Z < fz + 1) & (X > CX - 6.5) & (X < CX + 3.5) & (Y > y0 + 1.5) & (Y < y0 + 9.5)
    P.flat(g, screen, "teal", 2)
    P.outline(g, screen, "steel", 3, normal="z")
    face = ["r......r", ".rr..rr.", "........", ".rrrrrr.", "r.r..r.r"]
    G.stamp(g, "-z", fz, int(CX - 6), int(y0 + 2), face, {"r": C("red", 6)}, depth=2)
    for k, dy in enumerate((7.0, 3.5)):  # two dials beside the screen
        d = S.disc(g, "z", CX + 5.5, y0 + dy, 1.4, fz - 1, fz, "steel", 6 - k, n=8)
        del d
    for s in (-1, 1):  # rabbit-ear antennas
        limb(g, (CX + s * 1.5, y0 + 11, nz), (CX + s * 5.5, y0 + 16, nz + 1), 0.7, 0.6, "steel", 6, n=4)
    del back
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    ex, ey, ez = sx + s * 3.0, sy - 7.0, sz - 2.0
    wx, wy, wz = sx + s * 4.0, sy - 10.0, sz - 8.0
    upper = limb(g, (sx, sy, sz), (ex, ey, ez), 1.8, 1.6, "rust", 6, n=4)
    elbow = S.disc(g, "x", ey, ez, 2.2, ex - 2.2, ex + 2.2, "gold", 5, n=8)
    fore = limb(g, (ex, ey, ez), (wx, wy, wz), 2.4, 2.2, "red", 4, n=4)
    PP.hazard(g, fore & (Z < wz + 2.5), period=4, a=("gold", 5), b=("darkwood", 4))
    if s < 0:  # a two-prong pincer claw
        for dy in (-1, 1):
            S.bar(g, "x", (wy + dy * 1.2, wz - 1), (wy + dy * 3.5, wz - 6), 1.8, wx - 1.5, wx + 1.5, "steel", 6)
            S.bar(g, "x", (wy + dy * 3.5, wz - 6), (wy + dy * 1.2, wz - 9), 1.6, wx - 1.5, wx + 1.5, "steel", 7)
    else:  # the saw arbor
        box(g, wx - 1.5, wy - 2, wz - 2, wx + 3.5, wy + 2, wz + 1, "steel", 4)
    del upper, elbow
    return g


def saw() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SAW
    m = S.gear(g, "x", sy, sz, 6.5, sx - 0.8, sx + 0.8, teeth=12, depth=2.2, ramp="steel", base=6)
    P.flat(g, m & (np.hypot(Y - sy, Z - sz) > 6.5), "steel", 7)
    hub = S.disc(g, "x", sy, sz, 1.8, sx - 1.5, sx + 1.5, "gold", 5, n=8)
    del hub
    return g


def build():
    rig = Rig("raider-bot", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body")
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    rig.add("saw", saw(), SAW, parent="arm-r")
    idle = {"head": {"rot": seq((0, 0, 0, 0), (0.6, 0, 25, 0), (1.2, 0, 25, 0), (1.8, 0, -25, 0), (2.4, 0, -25, 0), (3.0, 0, 0, 0))},
            "body": {"loc": wave(3.0, (0, 0.3, 0), steps=12, double=True)},
            "saw": {"rot": turn(3.0, "x", -240)},
            "arm-l": {"rot": wave(3.0, (5, 0, -3))}}
    move = {"leg-l": {"rot": wave(1.0, (22, 0, 0))}, "leg-r": {"rot": wave(1.0, (-22, 0, 0))},
            "body": {"rot": wave(1.0, (0, 0, 4)), "loc": wave(1.0, (0, 1.0, 0), phase=1.6, double=True)},
            "arm-l": {"rot": wave(1.0, (-14, 0, 0))}, "arm-r": {"rot": wave(1.0, (14, 0, 0))},
            "head": {"rot": wave(1.0, (0, 0, -3), phase=0.5)}, "saw": {"rot": turn(1.0, "x", -360)}}
    attack = {"arm-r": {"rot": seq((0, 0, 0, 0), (0.3, 80, 0, 20), (0.55, -40, 0, -10), (1.0, 0, 0, 0))},
              "body": {"rot": seq((0, 0, 0, 0), (0.3, 6, 18, 0), (0.55, -10, -20, 0), (1.0, 0, 0, 0))},
              "saw": {"rot": turn(1.0, "x", -1440)}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.08, 10, 0, 6), (0.16, -4, 0, -4), (0.24, 6, 0, 3), (0.5, 0, 0, 0))},
           "head": {"rot": seq((0, 0, 0, 0), (0.08, 0, 0, 14), (0.16, 0, 0, -12), (0.5, 0, 0, 0))}}
    death = {"body": {"rot": seq((0, 0, 0, 0), (0.3, 8, 0, 6), (0.8, -35, 0, 20), (1.2, -40, 0, 24)), "loc": seq((0, 0, 0, 0), (0.8, 0, -8, -3), (1.2, 0, -9, -3))},
             "head": {"rot": seq((0, 0, 0, 0), (0.5, 0, 0, 30), (1.0, -30, 0, 60), (1.2, -30, 0, 55)), "loc": seq((0, 0, 0, 0), (0.5, 0, 3, 0), (1.0, 6, -6, -4))},
             "arm-l": {"rot": seq((0, 0, 0, 0), (0.8, 30, 0, -50))}, "arm-r": {"rot": seq((0, 0, 0, 0), (0.8, 20, 0, 50))},
             "leg-l": {"rot": seq((0, 0, 0, 0), (0.8, 45, 0, 0))}, "leg-r": {"rot": seq((0, 0, 0, 0), (0.8, 30, 0, 0))}}
    return make("creatures", "raider-bot", "Raider Bot", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                sockets=[rig.socket("socket-saw", (SAW[0], SAW[1] + 6.5, SAW[2] - 3), parent="saw"),
                         rig.socket("socket-exhaust", (CX + 4, 36, CZ + 9.5), parent="body"),
                         rig.socket("socket-core", (CX, HIP_Y + 7, CZ - 10), parent="body")],
                pfx=[fx("rvx-apocalypse-saw-sparks", "socket-saw", "clip:attack", size=38, at=0.4), fx("rvx-apocalypse-exhaust-smoke", "socket-exhaust", "idle", size=16), fx("rvx-apocalypse-explosion", "socket-core", "clip:death", size=44, at=0.24)])
