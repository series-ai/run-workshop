"""Mech walker, in the Pirate Nation mecha style.

A two-person-tall combat walker, chunky and toy-like: a boxy white hull
with a sloped nose (true slopes), orange stripes, hazard chevrons, a big
teal canopy with the pilot's orange helmet behind it and a whip antenna;
two orange rocket pods on the shoulders with painted warheads; two long
arm cannons with copper coils. It stands on reverse-jointed legs: white
thighs that angle forward, steel shins with copper pistons that angle
back, and big clawed feet (all true-slope prisms). Clips: idle (hum),
move (stomp), attack (both cannons fire, muzzle flash and explosion
PFX), hit (rock), death (slump). Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, light_top, quad, side, wave
from pnshapes import disc

S = (60, 76, 56)
CX, CZ = 30, 28
HIP = (39.0, CZ)  # (y, z)
KNEE = (22.0, CZ - 8)
ANKLE = (7.0, CZ + 3)
YH = 42  # hull bottom (the hull joint)
LEG_X = 14  # leg centre offset from CX
GUN = (16, 48)  # cannon x offset and axis height


def pelvis() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    p = box(g, CX - 9, 35, CZ - 6, CX + 9, YH, CZ + 6, "steel", 5)
    P.plates(g, p, "steel", 5, size=(6, 4), seed=1)
    P.flat(g, edges(p), "steel", 3)
    for s in (-1, 1):
        hub = disc(g, "x", HIP[0], HIP[1], 4.5, CX + (9 if s > 0 else -11), CX + (11 if s > 0 else -9), "steel", 4)
        P.flat(g, hub & (np.hypot(Y - HIP[0], Z - HIP[1]) < 2), "gold", 6)
    return g


def thigh(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = CX + s * LEG_X - 3.5, CX + s * LEG_X + 3.5
    t = side(g, quad(HIP, KNEE, 5.0, 4.0, cap=0.4), x0, x1, "bone", 6)
    P.flat(g, t, "bone", 6)
    P.flat(g, t & (np.abs(X - (CX + s * LEG_X)) > 2.6), "bone", 5)
    P.flat(g, t & (np.abs(Y - 31) < 1.5), "orange", 6)
    knee = disc(g, "x", KNEE[0], KNEE[1], 4.0, x0 - 1, x1 + 1, "steel", 4)
    P.flat(g, knee & (np.hypot(Y - KNEE[0], Z - KNEE[1]) < 1.6), "gold", 6)
    return g


def shin(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    xc = CX + s * LEG_X
    sh = side(g, quad(KNEE, ANKLE, 3.6, 3.0, cap=0.3), xc - 3, xc + 3, "steel", 5)
    P.flat(g, sh, "steel", 5)
    P.flat(g, sh & (np.abs(X - xc) > 2.1), "steel", 4)
    P.flat(g, sh & (np.abs(Y - 14) < 1), "orange", 6)
    # a copper piston behind the shin
    pis = side(g, quad((KNEE[0] - 1, KNEE[1] + 4), (ANKLE[0] + 3, ANKLE[1] + 5), 1.1), xc - 1, xc + 1, "rust", 6)
    P.flat(g, pis, "rust", 6)
    P.flat(g, pis & (Y > 15), "steel", 6)
    # the big clawed foot
    foot = box(g, xc - 4.5, 2, CZ - 7, xc + 4.5, 7, CZ + 8, "steel", 4)
    P.flat(g, foot, "steel", 4)
    light_top(g, foot, "steel", 6)
    hazard(g, foot & (Y < 4.5) & (Y > 2), period=4, frame="wall")
    for k in (-1, 0, 1):  # three front toes, hooked down (true slopes)
        side(g, [(2, CZ - 7), (6, CZ - 7), (3, CZ - 12), (0, CZ - 12.5)], xc + k * 3 - 1.2, xc + k * 3 + 1.2, "steel", 5)
    side(g, [(2, CZ + 8), (5, CZ + 8), (0, CZ + 12)], xc - 1.2, xc + 1.2, "steel", 5)  # back spur
    toes = (Z < CZ - 7) | (Z > CZ + 8)
    P.flat(g, g.a.astype(bool) & toes & (Y < 7), "steel", 5)
    P.flat(g, g.a.astype(bool) & (Z < CZ - 11), "bone", 6)  # pale claw tips
    return g


def hull() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    prof = [(YH, CZ - 9), (YH, CZ + 10), (61, CZ + 10), (64, CZ + 5), (64, CZ - 3), (57, CZ - 13), (48, CZ - 13)]
    h = side(g, prof, CX - 12, CX + 12, "bone", 6)
    P.plates(g, h, "bone", 6, size=(8, 7), rivets=False, seed=4)
    P.flat(g, h & ((X < CX - 11) | (X > CX + 11)) & (Y > 50) & (Y < 53), "orange", 6)  # side stripes
    P.flat(g, h & (Y < YH + 1.5), "bone", 4)
    light_top(g, h & (Y > 63), "bone", 7)
    # hazard chevrons on the chin
    chin = h & (Z < CZ - 9) & (Y < 48)
    hazard(g, chin, period=6, a=("orange", 6), b=("steel", 4), frame="z")
    # the big canopy on the sloped nose, with the pilot behind it
    slope_z = CZ - 13 + (Y - 57) * (10 / 7)
    canopy = h & (Y > 56.5) & (Y < 63) & (np.abs(X - CX) < 8) & (Z < slope_z + 2.2)
    P.flat(g, canopy, "cyan", 6)
    P.flat(g, canopy & (Y > 61), "cyan", 7)
    P.flat(g, canopy & (np.abs(X - CX + 3) < 2.4) & (Y > 57) & (Y < 61), "orange", 6)  # the pilot's helmet
    P.flat(g, canopy & (np.abs(X - CX + 3) < 1.6) & (Y > 58) & (Y < 59.5), "navy", 5)  # visor
    P.flat(g, canopy & ((np.abs(X - CX) > 7) | (Y < 57.5)), "steel", 4)  # canopy frame
    face = h & (Z < CZ - 12) & (Y > 48) & (Y < 56)
    P.flat(g, face & (np.abs(X - CX) < 7) & (np.floor(Y) % 2 == 0), "steel", 4)  # grille
    # antenna
    box(g, CX + 8, 64, CZ + 6, CX + 9, 72, CZ + 7, "steel", 5)
    box(g, CX + 7.5, 72, CZ + 5.5, CX + 9.5, 74, CZ + 7.5, "red", 6)
    # shoulder mounts for the cannons
    for s in (-1, 1):
        m = box(g, CX + s * 12 - (0 if s > 0 else 3), GUN[1] - 4, CZ - 4, CX + s * 12 + (3 if s > 0 else 0), GUN[1] + 4, CZ + 5, "steel", 4)
        P.flat(g, edges(m), "steel", 3)
    return g


def pod(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x0, x1 = (CX + 8, CX + 19) if s > 0 else (CX - 19, CX - 8)
    p = box(g, x0, 60, CZ - 7, x1, 69, CZ + 7, "orange", 6)
    P.flat(g, p, "orange", 6)
    P.flat(g, edges(p), "orange", 4)
    light_top(g, p, "orange", 7)
    face = p & (Z < CZ - 6.5)
    P.flat(g, face, "steel", 4)
    for cx in (x0 + 2.5, x0 + 5.5, x0 + 8.5):
        for cy in (62.5, 66.5):
            P.flat(g, face & (np.hypot(X - cx, Y - cy) < 1.3), "red", 6)
            P.flat(g, face & (np.hypot(X - cx + 0.4, Y - cy - 0.4) < 0.6), "bone", 7)
    P.flat(g, p & (Z > CZ + 3) & (Y > 61) & (Y < 63), "steel", 4)
    return g


def cannon(s: int) -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x = CX + s * (GUN[0] + 2)
    body = disc(g, "z", x, GUN[1], 3.4, CZ - 10, CZ + 6, "steel", 5)
    P.flat(g, body, "steel", 5)
    light_top(g, body, "steel", 6)
    barrel = disc(g, "z", x, GUN[1], 2.2, CZ - 24, CZ - 10, "steel", 6)
    for z0 in (CZ - 20, CZ - 16, CZ - 12):
        P.flat(g, disc(g, "z", x, GUN[1], 2.8, z0, z0 + 2, "rust", 6), "rust", 6)
    tip = disc(g, "z", x, GUN[1], 2.8, CZ - 26, CZ - 24, "steel", 4)
    P.flat(g, tip & (Z < CZ - 25) & (np.hypot(X - x, Y - GUN[1]) < 1.6), "orange", 7)
    P.flat(g, body & (Y > GUN[1] + 2) & (Z > CZ - 8) & (Z < CZ + 2), "orange", 6)
    del barrel
    return g


def build():
    rig = Rig()
    rig.add("mech-walker", pelvis(), (CX, HIP[0], HIP[1]))
    for s, name in ((1, "l"), (-1, "r")):
        rig.add(f"thigh-{name}", thigh(s), (CX + s * LEG_X, HIP[0], HIP[1]), "mech-walker")
        rig.add(f"shin-{name}", shin(s), (CX + s * LEG_X, KNEE[0], KNEE[1]), f"thigh-{name}")
    rig.add("hull", hull(), (CX, YH, CZ), "mech-walker")
    rig.add("pod-l", pod(1), (CX + 13, 60, CZ), "hull")
    rig.add("pod-r", pod(-1), (CX - 13, 60, CZ), "hull")
    rig.add("cannon-l", cannon(1), (CX + GUN[0] + 2, GUN[1], CZ), "hull")
    rig.add("cannon-r", cannon(-1), (CX - GUN[0] - 2, GUN[1], CZ), "hull")
    socks = [rig.sock("socket-cannon-l", (CX + GUN[0] + 2, GUN[1], CZ - 26), "cannon-l"),
             rig.sock("socket-cannon-r", (CX - GUN[0] - 2, GUN[1], CZ - 26), "cannon-r")]
    z = (0.0, 0.0, 0.0)
    idle = {"hull": {"rot": wave(3.0, "y", 6), "loc": wave(1.5, "y", 0.6, steps=6)},
            "pod-l": {"rot": wave(3.0, "x", 3)}, "pod-r": {"rot": wave(3.0, "x", 3, phase=1.5)}}
    step = 1.2
    move = {"thigh-l": {"rot": keys((0, (18, 0, 0)), (step / 2, (-16, 0, 0)), (step, (18, 0, 0)))},
            "shin-l": {"rot": keys((0, (-8, 0, 0)), (step / 4, (14, 0, 0)), (step / 2, (4, 0, 0)), (step, (-8, 0, 0)))},
            "thigh-r": {"rot": keys((0, (-16, 0, 0)), (step / 2, (18, 0, 0)), (step, (-16, 0, 0)))},
            "shin-r": {"rot": keys((0, (4, 0, 0)), (step / 2, (-8, 0, 0)), (step * 0.75, (14, 0, 0)), (step, (4, 0, 0)))},
            "mech-walker": {"loc": keys((0, z), (step / 4, (0, 1.5, 0)), (step / 2, z), (step * 0.75, (0, 1.5, 0)), (step, z))},
            "hull": {"rot": keys((0, (0, 0, -3)), (step / 2, (0, 0, 3)), (step, (0, 0, -3)))}}
    attack = {"cannon-l": {"loc": keys((0, z), (0.1, (0, 0, 4)), (0.35, z), (0.5, (0, 0, 4)), (0.75, z), (1.0, z))},
              "cannon-r": {"loc": keys((0, z), (0.25, z), (0.35, (0, 0, 4)), (0.6, z), (0.7, (0, 0, 4)), (0.95, z))},
              "hull": {"rot": keys((0, z), (0.1, (5, 0, 0)), (0.5, (4, 0, 0)), (1.0, z))}}
    hit = {"hull": {"rot": keys((0, z), (0.1, (8, 0, 6)), (0.3, (-3, 0, -3)), (0.5, z))},
           "mech-walker": {"loc": keys((0, z), (0.1, (0, 0, 2)), (0.5, z))}}
    death = {"mech-walker": {"loc": keys((0, z), (0.6, (0, -8, 0)), (1.2, (0, -14, 0)))},
             "thigh-l": {"rot": keys((0, z), (1.2, (40, 0, 20)))}, "thigh-r": {"rot": keys((0, z), (1.2, (40, 0, -20)))},
             "shin-l": {"rot": keys((0, z), (1.2, (-50, 0, 0)))}, "shin-r": {"rot": keys((0, z), (1.2, (-50, 0, 0)))},
             "hull": {"rot": keys((0, z), (0.6, (-10, 0, 8)), (1.2, (-24, 0, 12)))},
             "cannon-l": {"rot": keys((0, z), (1.2, (-30, 0, 0)))}, "cannon-r": {"rot": keys((0, z), (1.2, (-35, 0, 0)))}}
    return asset("creatures", "mech-walker", "Mech Walker", rig.root,
                 clips=[Clip("idle", idle), Clip("move", move), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=socks,
                 pfx=[{"effectId": "rvx-space-cannon-blast", "socket": "socket-cannon-l", "trigger": "clip:attack", "size": 24, "aim": [0.0, 0.0, -1.0], "at": 0.4},
                      {"effectId": "rvx-space-cannon-blast", "socket": "socket-cannon-r", "trigger": "clip:attack", "size": 24, "aim": [0.0, 0.0, -1.0], "at": 0.4}])
