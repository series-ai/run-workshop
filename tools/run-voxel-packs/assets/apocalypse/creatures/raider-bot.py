"""Raider bot, in the Pirate Nation creature style (PN mecha reskin).

A scrap-built caricature robot: a fat red oil-drum torso with a hazard
band and a glowing teal core, an oversized cream CRT-TV head whose screen
shows an angry red face, rabbit-ear antennas, a smoking exhaust stack on
its back, piston legs with gold knee joints and big hazard-capped feet,
a pincer claw on the left arm and a huge buzzsaw on the right. Limbs,
claws, saw teeth and antennas are true-slope prisms; plates, rivets, the
face and stripes are paint. Clips: idle (scan and hum), move (stomp),
attack (overhead buzzsaw chop, the saw spins), hit (a blow to the chest
snaps it back on its heels), death (core blows, clanks back in stepped
robotic jerks and crashes onto its back).
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnglyph as G
import pnpaint as PP
import pnshapes as S
import _big_falls as B
from _big_falls import F, track as T
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


HEEL = (0.0, -HIP_Y, 3.0)  # the back of the foot, from the hip
BLAST = 5  # the core blows (death)


def _one_shots(root):
    """Baked attack, hit and death (see _big_falls)."""
    R = root.name
    # attack: twist away and haul the buzzsaw up overhead with a lean back,
    # weight on the back foot (f0-9, the front foot lifts); a held beat
    # that keeps coiling (f9-10), then it steps in and chops the saw down
    # in front in 3 frames, fastest at the cut (impact f13, the sparks). The
    # blade drives on past the cut, the body follows through over the
    # planted front foot, the claw arm swings the other way for balance and
    # the TV head jerks; it grinds in the cut (moving), then winds back to
    # guard, past rest and settles.
    I = 13
    k = {R: {"loc": T((0, (0, 0, 0)), (8, (0, 0, 1)), (10, (0, 0, 1.3)), (I, (0, 0, -3), ">"), (I + 2, (0, 0, -3.6)), (I + 8, (0, 0, -3.1)), (I + 14, (0, 0, -0.8)), (I + 18, (0, 0, 0.3)), (I + 22, (0, 0, 0))),
             "rot": T((0, (0, 0, 0)), (I + 22, (0, 0, 0)))},
         "body": {"rot": T((0, (0, 0, 0)), (8, (8, 24, 0)), (10, (9, 28, 0)), (I, (-12, -24, 0), ">"), (I + 2, (-16, -31, 0)), (I + 5, (-12, -24, 1)), (I + 8, (-14, -26, -1)),
                           (I + 15, (2, 4, 0)), (I + 19, (-1, -1, 0)), (I + 23, (0, 0, 0)))},
         "arm-r": {"rot": T((0, (0, 0, 0)), (5, (70, 0, 14)), (8, (140, 0, 20)), (10, (152, 0, 22)), (I, (76, 0, -8), ">"), (I + 2, (62, 0, -13)), (I + 5, (69, 0, -9)),
                            (I + 8, (64, 0, -11)), (I + 14, (-6, 0, 2)), (I + 18, (3, 0, 0)), (I + 22, (0, 0, 0)))},
         "arm-l": {"rot": T((0, (0, 0, 0)), (8, (-22, 0, -12)), (10, (-25, 0, -14)), (I + 1, (30, 0, -22)), (I + 4, (38, 0, -27)), (I + 8, (26, 0, -18)), (I + 12, (32, 0, -20)),
                            (I + 18, (-5, 0, 2)), (I + 23, (0, 0, 0)))},
         "head": {"rot": T((0, (0, 0, 0)), (8, (6, 18, 0)), (11, (8, 21, 0)), (I + 1, (-8, -12, 5)), (I + 4, (-15, -19, 7)), (I + 7, (-6, -10, 2)), (I + 10, (-11, -15, 4)),
                           (I + 17, (3, 3, -1)), (I + 23, (0, 0, 0)))},
         "leg-l": {"rot": T((0, (0, 0, 0)), (6, (-6, 0, 0)), (10, (22, 0, 0)), (I, (8, 0, 0), ">"), (I + 8, (8, 0, 0)), (I + 12, (18, 0, 0)), (I + 16, (2, 0, 0)), (I + 19, (0, 0, 0))),
                   "loc": T((0, (0, 0, 0)), (6, (0, 0.6, 0)), (10, (0, 2.0, -1)), (I, (0, 0, -1.5), ">"), (I + 9, (0, 0, -1.5)), (I + 12, (0, 1.4, -0.6)), (I + 16, (0, 0, 0), ">"), (I + 19, (0, 0, 0)))},
         "leg-r": {"rot": T((0, (0, 0, 0)), (8, (5, 0, 0)), (10, (6, 0, 0)), (I, (-16, 0, 0)), (I + 2, (-19, 0, 0)), (I + 8, (-16, 0, 0)), (I + 15, (-3, 0, 0)), (I + 19, (0, 0, 0)))}}
    attack = B.bake(k, I + 24)
    attack["saw"] = {"rot": B.spin(I + 24, "x", -1600)}
    B.ground(root, attack, R, height=lambda f: 0.0)
    B.reach(root, attack, "leg-l", "y", range(I, I + 10), fade_in=2, fade_out=3, channel="loc")  # the front foot plants flat
    AI = I
    # hit: a blow to the chest. Frames 0-2 snap the drum straight back
    # (shoved 2.2 voxels, tipped 14 degrees onto its heels) and stop dead;
    # the TV head whips back a frame late, the arms are left flung forward.
    # It holds the jolt (moving, f2-6), then clanks back upright in two
    # stepped moves with hard stops (f9, f13: one past rest, forward), and
    # stands. Robotic: every move stops dead, no sway. 0.57 s.
    hk = {R: {"loc": T((0, (0, 0, 0), "<"), (2, (0.2, 0, 2.2)), (6, (0.2, 0, 2.3)), (9, (0.1, 0, 0.9), ">"), (11, (0.1, 0, 0.9)), (13, (0, 0, -0.2), ">"), (17, (0, 0, 0))),
              "rot": T((0, (0, 0, 0), "<"), (2, (14, 2, -4)), (6, (14.5, 2, -4)), (9, (5, 0, -1), ">"), (11, (5, 0, -1)), (13, (-3, 0, 0), ">"), (17, (0, 0, 0)))},
          "body": {"rot": T((0, (0, 0, 0)), (1, (3, 0, 5)), (3, (1, 0, -3)), (5, (0, 0, 0)), (17, (0, 0, 0)))},
          "head": {"rot": T((0, (0, 0, 0)), (1, (-5, 0, 0)), (3, (18, 6, 10), ">"), (6, (17, 6, 9.5)), (9, (4, 0, 2), ">"), (13, (-4, 0, 0), ">"), (17, (0, 0, 0)))},
          "arm-l": {"rot": T((0, (0, 0, 0), "<"), (2, (34, 0, -14)), (6, (32, 0, -13)), (9, (8, 0, -3), ">"), (13, (-4, 0, 0), ">"), (17, (0, 0, 0)))},
          "arm-r": {"rot": T((0, (0, 0, 0), "<"), (3, (28, 0, 12)), (6, (27, 0, 11)), (10, (6, 0, 3), ">"), (13, (-4, 0, 0), ">"), (17, (0, 0, 0)))}}
    for name in ("leg-l", "leg-r"):
        hk[name] = {"rot": T((0, (0, 0, 0)), (17, (0, 0, 0)))}
    hit = B.bake(hk, 17)
    hit["saw"] = {"rot": B.spin(17, "x", -80)}  # idle speed: a steady spin would blur the jolt
    B.ground(root, hit, R, height=lambda f: 0.0)  # it tips on its heels: the feet never leave the floor
    # death: robotic and clunky, every move a stepped pose that stops dead.
    # The core sputters (f0-4, jerks), blows (f5): the blast knocks the TV
    # head clean off and clanks the drum back 10 degrees (stop, f7); it
    # stutters back another 10 (f13, stop), then past the tipping point it
    # falls backwards about its heels, faster and faster, into a crash on
    # its back (impact f24: the lowest frame, squashed). One frame up, one
    # down, dead stop. The arms slam down flat out to the sides two frames
    # after the drum, the legs kick once and drop; the saw grinds to a halt
    # on the impact, the head lands off to its left and rolls to a stop.
    I = 24
    END = 40
    tip = T((0, (0, 0, 0)), (1, (-2, 0, 2), ">"), (3, (-1, 0, -2), ">"), (BLAST, (0, 0, 0), ">"), (BLAST + 2, (10, 0, -2), ">"), (11, (10, 0, -2)), (13, (20, 0, 1), ">"), (15, (20, 0, 1)), (16, (20.4, 0, 1)))
    d = {R: {"rot": B.Fall(tip, 15, I, (65, 0, 0), T((I, (65, 0, 0)), (I + 1, (63.5, 0, 0)), (I + 2, (65.5, 0, 0), "0"), (END, (65.5, 0, 0))), power=2.4)},
         "body": {"rot": T((0, (0, 0, 0)), (1, (2, 0, 4), ">"), (3, (-2, 0, -4), ">"), (BLAST, (0, 0, 0), ">"), (BLAST + 2, (8, 0, -2), ">"), (11, (8, 0, -2)), (13, (-4, 0, 1), ">"), (I - 2, (-6, 0, 0)),
                           (I, (4, 0, 0), ">"), (I + 2, (0, 0, 0), ">"), (END, (0, 0, 0))),
                  "scale": T((0, (1, 1, 1)), (I - 1, (1, 1.02, 1)), (I, (1.08, 0.97, 0.86), ">"), (I + 1, (0.99, 1.01, 1.02)), (I + 2, (1, 1, 1)), (END, (1, 1, 1)))},
         "head": {"rot": T((0, (0, 0, 0)), (1, (0, 0, 7), ">"), (3, (0, 0, -7), ">"), (BLAST, (0, 0, 0))), "loc": T((0, (0, 0, 0)), (BLAST, (0, 0, 0)))}}
    for name, s in (("arm-l", -1), ("arm-r", 1)):
        # jerked up by the blast, clanked to a second pose as it tips, then
        # slammed down to the floor after the body lands: stepped, no flop
        lie = (-60, 0, 70) if s > 0 else (-72, 0, -84)
        land = I + 1 if s > 0 else I + 2
        d[name] = {"rot": T((0, (0, 0, 0)), (BLAST, (0, 0, 0)), (BLAST + 2, (40, 0, s * 38), ">"), (11, (40, 0, s * 38)), (13 + (s < 0), (26, 0, s * 50), ">"), (I - 3, (26, 0, s * 50)),
                            (I, (22, 0, s * 54)), (land, lie, ">"), (END, lie))}
    for name, s in (("leg-l", -1), ("leg-r", 1)):
        o = s > 0
        d[name] = {"rot": T((0, (0, 0, 0)), (BLAST, (0, 0, 0)), (BLAST + 2, (-6, 0, 0), ">"), (13, (0, 0, 0), ">"), (I, (6, 0, s * 3)), (I + 2 + o, (18, 0, s * 5), ">"), (I + 5 + o, (-3, 0, s * 4), ">"),
                            (END, (-3, 0, s * 4)))}
    death = B.bake(d, END)
    # the saw idles on, then jams dead on the blast
    death["saw"] = {"rot": B.spin(END, "x", 0, frames=lambda f: -80 / 30 * min(f, BLAST))}
    lift = B.arc(I, I + 2, 0.5)
    B.ground(root, death, R, height=lift, pin=("leg-l", HEEL, (BLAST, I), "z"), skip=("head",))
    for name in ("leg-l", "leg-r"):  # the legs come to rest on the floor
        B.reach(root, death, name, "x", range(I + 6, END + 1), height=0.1, fade_in=2, fade_out=0, span=20)
    # each arm lies on the floor (the saw by its rim, the claw arm by its claw)
    for name, land in (("arm-r", I + 1), ("arm-l", I + 2)):
        B.reach(root, death, name, "x", range(land, END + 1), height=0.1, fade_in=0, fade_out=0, span=30, by="saw" if name == "arm-r" else None)
        r = death[name]["rot"]
        # it swings down to that contact faster and faster (no one-frame drop)
        a0, a1 = np.asarray(r[I][1]), np.asarray(r[land][1])
        for f in range(I + 1, land):
            u = (f - I) / (land - I)
            r[f] = (r[f][0], tuple(float(x) for x in a0 + (a1 - a0) * u ** 1.8))
    B.knock_off(root, death, "head", BLAST, END, up=1.7, side=(-1, 0, 0), axis=(0, 0, 1), total=180, g=0.45, bounce=0.6, roll_to=END - 6, radius=5.5,
                 centre=(1.7, 7.5, -1.6))  # the TV's visual middle (its mesh centroid: the dials and antennas weigh it up and right)
    return B.fill(root, attack), AI, B.fill(root, hit), B.fill(root, death), I


def _build():
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
    attack, imp, hit, death, dimp = _one_shots(rig.root)
    return make("creatures", "raider-bot", "Raider Bot", rig.root,
                clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False, impact=imp * F, ease=0), Clip("hit", hit, loop=False, ease=0), Clip("death", death, loop=False, impact=dimp * F, ease=0)],
                sockets=[rig.socket("socket-saw", (SAW[0], SAW[1] + 6.5, SAW[2] - 3), parent="saw"),
                         rig.socket("socket-exhaust", (CX + 4, 36, CZ + 9.5), parent="body"),
                         rig.socket("socket-core", (CX, HIP_Y + 7, CZ - 10), parent="body")],
                pfx=[fx("rvx-apocalypse-saw-sparks", "socket-saw", "clip:attack", size=38, at=imp * F), fx("rvx-apocalypse-exhaust-smoke", "socket-exhaust", "idle", size=16), fx("rvx-apocalypse-explosion", "socket-core", "clip:death", size=44, at=BLAST * F)])


def build():
    return _build()
