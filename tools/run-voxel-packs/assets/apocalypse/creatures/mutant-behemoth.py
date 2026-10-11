"""Mutant behemoth (world boss), in the Pirate Nation creature style.

A colossal caricature after the PN zombie boss (Kevin), 3.4 persons tall
and 4.3 persons wide: a hunched teal brute whose massive faceted torso
(stacked octagon frustums, true slopes) bursts out of denim overalls, a
small head sunk between huge shoulders with one giant eye, one small red
eye, tusks and a bolted skull plate, a chained collar, bone spikes down
the spine and three toxic vents smoking on the back. The left arm ends in
a huge fist; the right arm is a club fused with rebar and a car door.
Stubby legs stand in laced boots. Veins glow toxic green. Clips: idle
(breathe and roar), move (stomp), attack (double-fist ground slam), hit,
death (topples back). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
from _life import Rig, bump, ctr, fx, limb, make, plan, seq, side, skin, wave
from pnkit import box, edges
from voxgrid import C, Clip, Grid

SZ = (172, 132, 96)
CX, CZ = 86.0, 50.0
HIP_Y = 34.0
SKIN = ("teal", 5)
DENIM = ("blue", 5)
NECK = (CX, 94.0, CZ - 18.0)
HIPS = {"leg-l": (CX - 17.0, HIP_Y, CZ + 2), "leg-r": (CX + 17.0, HIP_Y, CZ + 2)}
SHOULDERS = {"arm-l": (CX - 38.0, 88.0, CZ - 4), "arm-r": (CX + 38.0, 88.0, CZ - 4)}


def oval(cx, cz, rx, rz, n=8):
    return [(cx + rx * math.cos(math.pi / n + 2 * math.pi * k / n), cz + rz * math.sin(math.pi / n + 2 * math.pi * k / n)) for k in range(n)]


def veins(g, m, seed=0, n=5):
    """Glowing toxic veins: short branching painted lines."""
    X, Y, Z = ctr(g)
    rng = np.random.default_rng(seed)
    idx = np.argwhere(m)
    if len(idx) == 0:
        return
    for _ in range(n):
        x, y, z = idx[rng.integers(len(idx))] + 0.5
        dx, dy, dz = rng.uniform(-1, 1), rng.uniform(-1.5, -0.5), rng.uniform(-1, 1)
        for _step in range(8):
            P.flat(g, m & (np.abs(X - x) < 1.0) & (np.abs(Y - y) < 1.0) & (np.abs(Z - z) < 1.0), "toxic", 6)
            x, y, z = x + dx * 1.4, y + dy * 1.4, z + dz * 1.4
            dx += rng.uniform(-0.5, 0.5)


def leg(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    hx, hy, hz = HIPS["leg-l" if s < 0 else "leg-r"]
    m = limb(g, (hx, hy + 4, hz), (hx + s * 2, 12, hz - 2), 10.5, 9.0, *DENIM, n=6)
    P.flat(g, m, *DENIM)
    PP.blotch(g, m, DENIM[0], DENIM[1] + 1, cell=5, chance=0.05, seed=1 + s)
    knee = m & (np.abs(Y - 22) < 4) & (Z < hz - 6)
    P.flat(g, knee, "khaki", 5)  # a patched knee
    P.outline(g, knee, "darkwood", 5)
    P.flat(g, m & (Y < 16), DENIM[0], DENIM[1] - 1)  # rolled cuffs
    bx = hx + s * 2
    boot = box(g, bx - 11, 0, hz - 18, bx + 11, 13, hz + 9, "darkwood", 6)
    P.plates(g, boot, "darkwood", 6, size=(8, 5), rivets=False, seed=2 + s)
    P.flat(g, boot & (Y < 3), "darkwood", 4)  # the sole
    cap = boot & (Z < hz - 12) & (Y >= 3)
    P.flat(g, cap, "steel", 6)  # steel toe caps
    for k in range(4):  # laces
        P.flat(g, boot & (np.abs(Y - (6 + k * 2)) < 0.6) & (np.abs(X - bx) < 5) & (Z < hz - 11) & (Z > hz - 13), "bone", 6)
    return g


def body() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    pelvis = plan(g, oval(CX, CZ + 2, 30, 20), HIP_Y - 6, HIP_Y + 8, *DENIM, top=oval(CX, CZ, 33, 22))
    belly = plan(g, oval(CX, CZ, 33, 22), HIP_Y + 8, 62, *SKIN, top=oval(CX, CZ - 6, 38, 26))
    chest = plan(g, oval(CX, CZ - 6, 38, 26), 62, 90, *SKIN, top=oval(CX, CZ - 12, 30, 20))
    torso = belly | chest
    skin(g, torso, *SKIN, seed=3, cell=8)
    # the overalls: denim below the waist and a bib with straps and gold buttons
    denim = pelvis | (belly & (Y < 48)) | (torso & (Z < CZ - 14) & (np.abs(X - CX) < 16) & (Y < 76))
    straps = torso & (np.abs(np.abs(X - CX) - 13) < 3) & (Y > 70)
    P.flat(g, denim | straps, *DENIM)
    PP.blotch(g, denim, DENIM[0], DENIM[1] + 1, cell=5, chance=0.05, seed=4)
    P.outline(g, denim & (Y > 48), DENIM[0], DENIM[1] - 2)
    for bx in (CX - 13, CX + 13):
        P.flat(g, torso & (np.hypot(X - bx, Y - 73) < 2.5) & (Z < CZ - 12), "gold", 6)
    pocket = torso & (Z < CZ - 20) & (np.abs(X - CX) < 7) & (Y > 58) & (Y < 68)
    P.outline(g, pocket, DENIM[0], DENIM[1] - 2)
    P.flat(g, torso & (np.abs(Y - 48) < 1.2), "darkwood", 5)  # the belt line
    veins(g, torso & ~denim & ~straps, seed=5, n=7)
    # stapled scar across the chest
    scar = torso & (np.abs((X - CX - 22) + (Y - 80) * 0.8) < 1.0) & (Z < CZ - 8) & (Y > 70)
    P.flat(g, scar, "red", 4)
    # bone spikes down the spine
    for k in range(5):
        y0 = 58 + k * 7
        zb = CZ + 25 - k * 2.2
        side(g, [(y0, zb - 3), (y0 + 5, zb - 3), (y0 + 3, zb + 7)], CX - 2, CX + 2, "bone", 6)
    # three toxic vents smoking on the upper back
    for k, (vx, vz) in enumerate(((CX - 16, CZ + 14), (CX, CZ + 17), (CX + 16, CZ + 14))):
        v = S.disc(g, "y", vx, vz, 4.0, 80, 100 - (k == 1) * -4, "steel", 5, n=8)
        rim = S.disc(g, "y", vx, vz, 5.0, 96 - (k == 1) * -4, 99 - (k == 1) * -4, "rust", 4, n=8)
        P.flat(g, v & (Y > 94), "toxic", 6)
        del rim
    # the chained collar round the neck
    for k in range(10):
        a = 2 * math.pi * k / 10
        lx, lz = CX + 20 * math.cos(a), CZ - 10 + 14 * math.sin(a)
        link = box(g, lx - 2.5, 86 + (k % 2), lz - 2.5, lx + 2.5, 91 + (k % 2), lz + 2.5, "steel", 6 - k % 2)
        P.outline(g, link, "steel", 4)
    return g


def head() -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    nx, ny, nz = NECK
    y0 = ny - 6
    fz = nz - 16.0
    poly = [(y0, nz + 8), (y0, fz - 3), (y0 + 9, fz - 3), (y0 + 9, fz), (y0 + 22, fz), (y0 + 26, fz + 5), (y0 + 26, nz + 4), (y0 + 20, nz + 9)]
    m = side(g, poly, CX - 15, CX + 15, *SKIN)
    skin(g, m, *SKIN, seed=6, cell=7)
    # a bolted steel skull plate on the crown
    plate = box(g, CX - 2, y0 + 25, nz - 8, CX + 12, y0 + 27.5, nz + 2, "steel", 5)
    P.outline(g, plate, "steel", 3)
    for bx in (CX, CX + 10):
        P.flat(g, plate & (np.abs(X - bx) < 1) & (Y > y0 + 26.5), "steel", 7)
    # one giant eye and one small red eye under a heavy brow (painted, 2 px per cell)
    legend = {"o": C("teal", 2), "w": C("bone", 7), "p": C("navy", 4), "r": C("red", 6), "b": C("teal", 3)}
    rows = ["bbbbbbb..bbbbb", "owwwwwo.......", "owwwwwo..oooo.", "owwppwo..orro.", "owwppwo..orro.", "owwwwwo..oooo.", "ooooooo......."]
    G.stamp(g, "-z", fz, int(CX - 14), int(y0 + 9), rows, legend, scale=2, depth=2)
    # a wide mouth with chunky teeth on the underbite jaw, two tusks
    mouth = m & (Z < fz - 0.5) & (Y > y0 + 1.5) & (Y < y0 + 8) & (np.abs(X - CX) < 12)
    P.flat(g, mouth, "red", 2)
    P.flat(g, mouth & (Y > y0 + 5.5) & ((np.floor(X) // 3) % 2 == 0), "bone", 6)
    P.flat(g, mouth & (Y < y0 + 3.5) & ((np.floor(X) // 3) % 3 == 1), "bone", 5)
    for s in (-1, 1):
        tusk = limb(g, (CX + s * 9, y0 + 7, fz - 1.5), (CX + s * 11, y0 + 16, fz - 4), 1.8, 0.4, "bone", 6, n=4)
        del tusk
    # little ears and a stitched cheek
    for s in (-1, 1):
        S.bar(g, "z", (CX + s * 15, y0 + 14), (CX + s * 19, y0 + 19), 4.0, nz - 6, nz, *SKIN)
    P.flat(g, m & (np.abs(X - (CX - 12)) < 0.7) & (Y > y0 + 4) & (Y < y0 + 12) & (Z < fz + 3), "khaki", 4)
    return g


def arm(s: int) -> Grid:
    g = Grid(*SZ)
    X, Y, Z = ctr(g)
    sx, sy, sz = SHOULDERS["arm-l" if s < 0 else "arm-r"]
    ex, ey, ez = sx + s * 18, 62.0, sz - 6
    wx, wy, wz = sx + s * 27, 34.0, sz - 14
    delt = plan(g, oval(sx + s * 2, sz, 13, 13, 8), sy - 10, sy + 4, *SKIN, top=oval(sx, sz, 8, 9, 8))
    upper = limb(g, (sx, sy - 2, sz), (ex, ey, ez), 9.5, 8.0, *SKIN, n=6)
    fore = limb(g, (ex, ey, ez), (wx, wy, wz), 8.5 if s < 0 else 10.5, 8.0 if s < 0 else 12.0, *SKIN, n=6)
    fist = box(g, wx - 11, wy - 22, wz - 12, wx + 11, wy + 1, wz + 11, *SKIN)
    skin(g, delt | upper | fore | fist, *SKIN, seed=7 + s, cell=8)
    veins(g, upper | fore, seed=8 + s, n=4)
    # knuckles and yellow nails on the fist
    P.flat(g, fist & (Z < wz - 11) & ((np.floor(X) - int(wx - 11)) % 6 == 0), "teal", 3)
    P.flat(g, fist & (Z < wz - 11) & (Y < wy - 18), "gold", 6)
    if s > 0:  # the club arm: rebar spikes and a car door strapped on as a shield
        for (a, b) in (((wx + 2, wy + 8, wz - 6), (wx + 10, wy + 20, wz - 16)), ((wx - 4, wy - 4, wz - 8), (wx - 10, wy + 2, wz - 22)),
                       ((wx + 6, wy - 10, wz + 4), (wx + 18, wy - 6, wz + 10)), ((wx, wy + 14, wz + 6), (wx - 2, wy + 26, wz + 16))):
            limb(g, a, b, 1.1, 0.9, "rust", 5, n=4)
        door = side(g, [(wy - 12, wz - 18), (wy + 22, wz - 12), (wy + 24, wz + 12), (wy - 10, wz + 10)], wx + 11, wx + 14, "teal", 6)
        P.mottle(g, door, "teal", 6, cell=4, seed=9)
        win = door & (Y > wy + 8) & (Y < wy + 20) & (Z > wz - 8) & (Z < wz + 8)
        P.flat(g, win, "sky", 5)
        P.outline(g, win, "teal", 3, normal="x")
        P.flat(g, door & (np.abs(Y - (wy + 4)) < 2) & (Z > wz + 2) & (Z < wz + 7), "steel", 6)  # the handle
        PP.blotch(g, door, "rust", 5, cell=3, chance=0.06, seed=10)
        for sy2 in (wy - 4, wy + 14):  # steel straps
            strap = box(g, wx + 10, sy2, wz - 13, wx + 15, sy2 + 3, wz + 12, "steel", 5)
            del strap
    return g


def build():
    rig = Rig("mutant-behemoth", (CX, 0, CZ))
    rig.add("leg-l", leg(-1), HIPS["leg-l"])
    rig.add("leg-r", leg(1), HIPS["leg-r"])
    rig.add("body", body(), (CX, HIP_Y, CZ))
    rig.add("head", head(), NECK, parent="body")
    rig.add("arm-l", arm(-1), SHOULDERS["arm-l"], parent="body")
    rig.add("arm-r", arm(1), SHOULDERS["arm-r"], parent="body")
    idle = {"body": {"scale": wave(3.0, (0.015, 0.01, 0.015), base=(1, 1, 1)), "rot": wave(3.0, (2, 0, 1.5))},
            "head": {"rot": seq((0, 0, 0, 0), (1.2, 0, 8, 3), (1.6, 18, 0, 0), (2.1, 18, 0, 0), (2.5, 0, -6, -3), (3.0, 0, 0, 0))},
            "arm-l": {"rot": wave(3.0, (4, 0, -3), phase=0.4)}, "arm-r": {"rot": wave(3.0, (4, 0, 3), phase=2.0)}}
    move = {"leg-l": {"rot": wave(2.0, (18, 0, 0))}, "leg-r": {"rot": wave(2.0, (-18, 0, 0))},
            "body": {"rot": wave(2.0, (0, 5, 5), phase=0.3), "loc": wave(2.0, (0, 1.8, 0), phase=1.6, double=True)},
            "head": {"rot": wave(2.0, (4, -4, -4), phase=0.8)},
            "arm-l": {"rot": wave(2.0, (-12, 0, 0))}, "arm-r": {"rot": wave(2.0, (12, 0, 0))}}
    # attack: both arms swing out to the sides and up together to stand
    # straight over the head (tilted in, so the rest splay does not throw
    # them wide; the car door stays outside and above, the face stays
    # clear), hold, then slam down in front. The keys are mirror pairs
    # (x, y, z) / (x, -y, -z), each step 105 degrees or less, so the
    # quaternion path stays on the intended side.
    up, tuck = 186, 20
    attack = {"arm-l": {"rot": seq((0, 0, 0, 0), (0.25, 20, 0, -70), (0.42, 110, 50, -20), (0.6, up, 0, -tuck), (0.85, up, 0, -tuck), (0.95, 92, 0, -tuck * 0.5), (1.05, -12, 0, 0), (1.6, 0, 0, 0))},
              "arm-r": {"rot": seq((0, 0, 0, 0), (0.25, 20, 0, 70), (0.42, 110, -50, 20), (0.6, up, 0, tuck), (0.85, up, 0, tuck), (0.95, 92, 0, tuck * 0.5), (1.05, -12, 0, 0), (1.6, 0, 0, 0))},
              "body": {"rot": seq((0, 0, 0, 0), (0.6, 8, 0, 0), (0.85, 10, 0, 0), (1.05, -22, 0, 0), (1.6, 0, 0, 0)), "loc": seq((0, 0, 0, 0), (0.6, 0, 2, 0), (1.05, 0, -4, -4), (1.6, 0, 0, 0))},
              "head": {"rot": seq((0, 0, 0, 0), (0.6, 10, 0, 0), (0.85, 12, 0, 0), (1.05, -10, 0, 0), (1.6, 0, 0, 0))}}
    hit = {"body": {"rot": seq((0, 0, 0, 0), (0.12, 10, -6, 0), (0.6, 0, 0, 0))},
           "head": {"rot": seq((0, 0, 0, 0), (0.12, 20, 10, 8), (0.6, 0, 0, 0))}}
    death = {rig.root.name: {"rot": seq((0, 0, 0, 0), (0.6, -8, 0, 4), (1.6, 82, 0, 6), (1.8, 76, 0, 6), (2.2, 80, 0, 6))},
             "head": {"rot": seq((0, 0, 0, 0), (1.6, 30, 0, 20))},
             "arm-l": {"rot": seq((0, 0, 0, 0), (1.0, 30, 0, -45), (1.6, 20, 0, -75))}, "arm-r": {"rot": seq((0, 0, 0, 0), (1.0, 30, 0, 45), (1.6, 20, 0, 75))}}  # arms fling out, the face stays clear
    fist_x = SHOULDERS["arm-r"][0] + 27
    return make("creatures", "mutant-behemoth", "Mutant Behemoth", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                # both fists slam: each gets its own socket and dust
                sockets=[rig.socket("socket-fist", (fist_x, 12.0, SHOULDERS["arm-r"][2] - 14), parent="arm-r"),
                         rig.socket("socket-fist-l", (SHOULDERS["arm-l"][0] - 27, 12.0, SHOULDERS["arm-l"][2] - 14), parent="arm-l"),
                         rig.socket("socket-vents", (CX, 106.0, CZ + 17), parent="body"),
                         rig.socket("socket-mouth", (CX, NECK[1] - 1, NECK[2] - 19), parent="head")],
                pfx=[fx("rvx-apocalypse-ground-slam", "socket-fist", "clip:attack", size=90, at=1.0), fx("rvx-apocalypse-ground-slam", "socket-fist-l", "clip:attack", size=90, at=1.0), fx("rvx-apocalypse-toxic-vent", "socket-vents", "idle", size=36), fx("rvx-apocalypse-gore-burst", "socket-mouth", "clip:hit", size=44)])
