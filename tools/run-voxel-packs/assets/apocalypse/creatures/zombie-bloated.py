"""Bloated zombie, in the Pirate Nation creature style.

A hulking caricature: a colossal faceted belly (stacked octagon frustums,
true slopes all round) bursting out of split denim overalls, covered in
glowing toxic boils, with stubby legs in big boots, short arms with huge
clawed hands, and a tiny lolling head with mismatched eyes and a drooling
open mouth. Denim, straps, boils and face are paint. Clips: idle (wheeze,
the belly swells), move (lumber and sway), attack (a one-two swipe, left claw
then right, gas venting from the mouth), hit, death (topples backwards with weight, a heavy
thud and one rebound of the belly). Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _big_falls as B
import _zombie_falls as zf
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


def _build():
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
    f = 1 / 30
    R = rig.root.name
    # attack: a one-two swipe with the big clawed hands. The bulk twists
    # back to the right, hauling the left claw up and out (f0-5, a held
    # coil to f7), then the left swipe slashes down and across the front
    # (impact f10) as the body twists through; that twist winds the right
    # claw up behind (f13-15), and the right swipe slashes back across
    # (impact f18), the belly lurching into it. A short follow-through,
    # then it sags back to rest. The feet stay planted. Baked (ease 0) so
    # both blows arrive at full speed and stop dead.
    imp = 10 * f
    T = B.track
    k = {"body": {"rot": T((0, (0, 0, 0)), (5, (6, 18, 2)), (7, (7, 20, 2)), (10, (-8, -18, -2), ">"), (12, (-10, -22, -3)), (15, (-6, -26, -2)), (18, (-12, 22, 3), ">"),
                           (20, (-14, 26, 3)), (25, (-2, 4, 0)), (29, (0, 0, 0))),
                  "scale": T((0, (1, 1, 1)), (6, (1.03, 1.02, 1.03)), (10, (1.06, 0.95, 0.94), ">"), (13, (1, 1, 1)), (18, (1.07, 0.94, 0.93), ">"), (21, (0.99, 1.01, 1.01)), (25, (1, 1, 1)))},
         "head": {"rot": T((0, (0, 0, 0)), (6, (10, -10, 4)), (8, (12, -12, 4)), (11, (-6, 12, -6)), (13, (-10, 16, -6)), (16, (-4, 18, 0)), (19, (-10, -14, 6)), (21, (-12, -18, 6)),
                           (26, (2, -2, 0)), (29, (0, 0, 0)))}}
    for name, s, hit in (("arm-l", -1, 10), ("arm-r", 1, 18)):
        # up and out behind the shoulder, held, slashed down across the front
        up, held, cross, past = (100, 0, s * 50), (106, 0, s * 54), (55, 0, -s * 35), (40, 0, -s * 45)
        if s < 0:
            keys = [(0, (0, 0, 0)), (5, up), (7, held), (hit, cross, ">"), (hit + 2, past), (16, (14, 0, -s * 8)), (23, (-3, 0, 0)), (29, (0, 0, 0))]
        else:
            keys = [(0, (0, 0, 0)), (5, (-10, 0, s * 6)), (9, (24, 0, s * 18)), (13, up), (15, held), (hit, cross, ">"), (hit + 2, past), (24, (8, 0, -s * 6)), (29, (0, 0, 0))]
        k[name] = {"rot": T(*keys)}
    k[R] = {"loc": T((0, (0, 0, 0)), (29, (0, 0, 0)))}
    attack = B.bake(k, 29)
    # hit: the blow squashes the belly in on f1 and shoves the bulk back with
    # a low pop; the belly bulges back out past round at f8, and the weight
    # sways the gut forward past rest (f17-19) before it settles
    hit = {R: zf.hit_body(push=2.9, pop=1.0, lean=12, side=-0.15, heel=4.5, toe=-7.0, front=True, past=0.7),
           "body": {"scale": zf.fr((0, 1, 1, 1), (1, 0.93, 1.04, 0.86), (4, 1.0, 1.0, 0.98), (8, 1.06, 0.97, 1.08), (12, 0.98, 1.01, 0.98), (16, 1.01, 1, 1.01), (20, 1, 1, 1)),
                    "rot": zf.fr((0, 0, 0, 0), (2, 4, 0, 0), (8, 3, 0, 0), (13, 0, 0, 0), (18, -3, 0, 0), (23, 0.5, 0, 0), (27, 0, 0, 0))},
           "head": {"rot": zf.fr((0, 0, 0, 0), (1, 8, -3, -4), (2, 17, -6, -8), (4, 22, -8, -10), (7, 15, -6, -8), (11, 3, -2, -3), (15, -7, 2, 2), (20, 2, 0, 0), (25, 0, 0, 0))},
           "arm-l": {"rot": zf.fr((0, 0, 0, 0), (1, 3, 0, -5), (3, 8, 0, -14), (6, 7, 0, -19), (10, 1, 0, -8), (15, -4, 0, 4), (20, 1, 0, -1), (25, 0, 0, 0))},
           "arm-r": {"rot": zf.fr((0, 0, 0, 0), (2, 3, 0, 5), (4, 8, 0, 14), (7, 7, 0, 19), (11, 1, 0, 8), (16, -4, 0, -4), (21, 1, 0, 1), (25, 0, 0, 0))}}
    # death: the belly sways it forward (f4), the knees sag and it rocks
    # back onto its heels (f8), then the whole bulk topples backwards like a
    # sack of wet cement: slow off the heels, faster and faster (gravity),
    # into a heavy thud flat on its back (impact f22, the fastest frame).
    # The belly squashes flat for two frames and rebounds once, one short
    # bounce, then a dead stop; the arms slap down out to the sides, the
    # stubby legs kick up and drop, the little head lands last and lolls.
    dimp = 22 * f
    T = zf.fr
    # the topple is keyed frame by frame (accelerating) and stops flat on
    # the back: it doesn't roll on over the belly
    fall = [(8 + k, 4 + 82 * (0.06 * k / 14 + 0.94 * (k / 14) ** 2.6), 0, -2 * k / 14) for k in range(1, 14)]
    death = {R: {"rot": T((0, 0, 0, 0), (4, -5, 0, 1), (8, 4, 0, 0), *fall, (22, 86, 0, -2), (23, 84.8, 0, -2), (24, 86, 0, -2), (33, 86, 0, -2)),
                 "loc": T((0, 0, 0, 0), (4, 0, 0, 0), (8, 0, -0.6, 0.3), (15, 0, -0.6, 1.2), (21, 0, -0.2, 2.8), (22, 0, 0, 3), (23, 0, 0.35, 3.05), (24, 0, 0, 3.1), (33, 0, 0, 3.1))},
             # the belly squashes flat on the thud and rebounds once in its own
             # scale; the body shift keeps its back on the floor meanwhile
             "body": {"rot": T((0, 0, 0, 0), (4, 4, 0, 0), (10, 0, 0, 0), (33, 0, 0, 0)),
                      "loc": T((0, 0, 0, 0), (17, 0, 0, 0), (20, 0, 0, 0.1), (22, 0, 0, 3.0), (23, 0, 0, 2.6), (25, 0, 0, -0.6), (27, 0, 0, 0)),
                      "scale": T((0, 1, 1, 1), (4, 1.03, 0.98, 1.05), (8, 1.02, 0.97, 1.02), (12, 1, 1, 1), (20, 1.005, 1.003, 0.99), (22, 1.12, 1.07, 0.8),
                                 (23, 1.1, 1.06, 0.83), (25, 0.97, 0.98, 1.05), (27, 1, 1, 1))},
             "head": {"rot": T((0, 0, 0, 0), (4, 12, 0, 0), (8, -6, 0, 0), (16, -14, 0, -4), (22, 14, 0, -10), (23, 40, 0, -16), (25, 78, 0, -21), (33, 78, 0, -21))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):  # flung up as it goes, slapped down flat out to the sides on the thud
        death[name] = {"rot": T((0, 0, 0, 0), (8, 30, 0, s * 25), (16, 44, 0, s * 38), (22, -20, 0, s * 56), (23, -30, 0, s * 59), (33, -30, 0, s * 59))}
    for name, s in (("leg-l", -1), ("leg-r", 1)):  # the stubby legs kick up as it lands and flop
        death[name] = {"rot": T((0, 0, 0, 0), (8, 6, 0, 0), (12, 14, 0, 0), (18, 14, 0, s * 2), (22, 20, 0, s * 4), (24, 24, 0, s * 6), (27, 10, 0, s * 6), (33, 10, 0, s * 6))}
    return make("creatures", "zombie-bloated", "Bloated Zombie", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp, ease=0), Clip("hit", hit, loop=False), Clip("death", death, loop=False, impact=dimp)],
                sockets=[rig.socket("socket-belly", (CX, 19, CZ - 13.5), parent="body"), rig.socket("socket-mouth", (CX, NECK[1] + 2, NECK[2] - 6), parent="head")],
                pfx=[fx("rvx-apocalypse-toxic-bubbles", "socket-belly", "idle", size=28), fx("rvx-apocalypse-vomit-spray", "socket-mouth", "clip:attack", size=26, aim=(-0.042, -0.239, -0.97), at=0.36)])


def build():
    # Key the death's resting pose on the floor so its bounce leaves it.
    return zf.pin_rest(_build())
