"""Alien grunt, in the Pirate Nation creature style.

A chunky caricature trooper (PN totem scale): a huge lime head with a
domed, faceted skull, three big goofy eyes (one on top), a wide toothy
grin and swept ear fins; a barrel chest in a dented purple armour vest
with orange shoulder pads and a gold star badge; stubby legs in steel
boots. The left arm ends in a big three-finger hand; the right forearm is
a fused plasma blaster with copper coils and a teal muzzle. Limbs, fins,
pads and skull are true-slope prisms; the face and armour are painted.
Clips: idle (breathe, glance), attack (raise and fire), hit, death.
Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, cartoon_eye, coords, edges, front, keys, light_top, octo, plan, quad, side, wave
from pnshapes import disc

S = (44, 44, 40)
CX, CZ = 22, 20
SKIN, ARMOR = "lime", "purple"
HIP = (CX, 11.0, CZ)
WAIST = (CX, 14.0, CZ)
NECK = (CX, 26.0, CZ)
SHOULDER = {"arm-l": (CX + 10.0, 24.0, CZ), "arm-r": (CX - 10.0, 24.0, CZ)}


def legs() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    pelvis = box(g, CX - 7, 9, CZ - 4, CX + 7, 15, CZ + 4, ARMOR, 3)
    P.flat(g, pelvis, ARMOR, 3)
    band(g, pelvis, 1, 13, 15, "steel", 4)  # belt
    P.flat(g, pelvis & (np.abs(X - CX) < 1.6) & (Y > 13) & (Z < CZ - 3), "gold", 6)  # buckle
    skin = np.zeros(g.shape, dtype=bool)
    boots = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        skin |= front(g, quad((CX + s * 4, 11), (CX + s * 5, 4), 2.8, 2.6), CZ - 2.5, CZ + 2.5, SKIN, 5)
        boots |= box(g, CX + s * 5 - 3.5, 0, CZ - 6, CX + s * 5 + 3.5, 5, CZ + 3, "steel", 5)
        boots |= side(g, [(0, CZ - 6), (5, CZ - 6), (3, CZ - 8), (0, CZ - 8)], CX + s * 5 - 3.5, CX + s * 5 + 3.5, "steel", 5)
    P.flat(g, skin, SKIN, 5)
    P.flat(g, boots, "steel", 5)
    band(g, boots, 1, 3, 5, "orange", 6)
    light_top(g, boots, "steel", 6)
    return g


def body() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    chest = side(g, [(14, CZ - 5), (14, CZ + 5), (27, CZ + 6), (27, CZ - 5), (22, CZ - 7)], CX - 9, CX + 9, ARMOR, 4)
    P.mottle(g, chest, ARMOR, 4, cell=3, seed=1)
    belly = chest & (Y < 17) & (Z < CZ - 3)
    P.flat(g, belly, SKIN, 5)
    P.flat(g, chest & (np.abs(Y - 17.5) < 0.6), ARMOR, 2)  # the vest hem
    # dents and scratches painted on the vest
    for dx, dy in ((-5, 22), (4, 19), (6, 24)):
        P.flat(g, chest & (Z < CZ - 3) & (np.abs(X - (CX + dx)) < 1.1) & (np.abs(Y - dy) < 0.6), ARMOR, 6)
    # a gold star badge
    P.flat(g, chest & (Z < CZ - 4) & (np.abs(X - (CX - 4)) + np.abs(Y - 22) < 2.2), "gold", 6)
    P.flat(g, chest & (Z < CZ - 4) & (np.abs(X - (CX - 4)) + np.abs(Y - 22) < 0.8), "gold", 7)
    pads = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        pads |= front(g, [(CX + s * 7, 27.5), (CX + s * 12.5, 26), (CX + s * 13, 22), (CX + s * 8, 23)], CZ - 5, CZ + 5, "orange", 6)
    P.flat(g, pads, "orange", 6)
    light_top(g, pads, "orange", 7)
    P.outline(g, pads, "orange", 4, normal="z")
    return g


def head() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    face = plan(g, octo(CX, CZ - 1, 8.5, 7, 1.5), 26, 35, SKIN, 5)
    dome = plan(g, octo(CX, CZ - 1, 8.5, 7, 1.5), 35, 42, SKIN, 5, top=octo(CX, CZ, 4.5, 3.5, 1.2))
    m = face | dome
    P.mottle(g, m, SKIN, 5, cell=3, seed=2)
    light_top(g, dome, SKIN, 6)
    fins = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        fins |= front(g, [(CX + s * 8, 36), (CX + s * 14, 41), (CX + s * 11, 33), (CX + s * 8, 30)], CZ - 1, CZ + 2, ARMOR, 5)
    P.flat(g, fins, ARMOR, 5)
    P.flat(g, fins & (np.abs(X - CX) > 10.5), "magenta", 5)
    zf = CZ - 8
    front_face = m & (Z < zf + 1.2)
    # three goofy eyes: two big ones and one on the forehead
    cartoon_eye(g, "-z", zf, CX - 7, 29, 6, outline=(SKIN, 2))
    cartoon_eye(g, "-z", zf, CX + 1, 29, 6, outline=(SKIN, 2), mirror=True)
    cartoon_eye(g, "-z", zf, CX - 2, 35, 4, outline=(SKIN, 2), white=("gold", 7), pupil=("red", 3))
    # a wide toothy grin
    grin = front_face & (np.abs(X - CX) < 5.5 - (28.5 - Y) * 0.8) & (Y > 26) & (Y < 29)
    P.flat(g, grin, "red", 3)
    P.flat(g, grin & (Y > 28), "bone", 7)
    P.flat(g, grin & (Y > 28) & (np.floor(X) % 2 == 0), "bone", 5)
    return g


def arm_l() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX + 10
    arm = front(g, quad((sx, 24), (sx + 3, 14), 2.6, 2.3), CZ - 2.5, CZ + 2.5, SKIN, 5)
    P.flat(g, arm, SKIN, 5)
    hand = box(g, sx - 1, 8, CZ - 4, sx + 6, 14, CZ + 3, SKIN, 5)
    P.flat(g, hand, SKIN, 5)
    fingers = np.zeros(g.shape, dtype=bool)
    for k, fz in enumerate((CZ - 4, CZ - 1, CZ + 2)):
        fingers |= box(g, sx - 1, 5, fz, sx + 6, 8, fz + 2, SKIN, 4)
    P.flat(g, fingers, SKIN, 4)
    light_top(g, hand, SKIN, 6)
    cuff = box(g, sx - 1, 14, CZ - 3, sx + 5, 16, CZ + 3, "orange", 6)
    P.flat(g, edges(cuff), "orange", 4)
    return g


def arm_r() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    sx = CX - 10
    upper = front(g, quad((sx, 24), (sx - 2, 17), 2.6, 2.4), CZ - 2.5, CZ + 2.5, SKIN, 5)
    P.flat(g, upper, SKIN, 5)
    # the fused blaster: a chunky gun along -z with copper coils and a teal muzzle
    gun = box(g, sx - 6, 14, CZ - 8, sx + 2, 20, CZ + 4, "steel", 5)
    P.flat(g, edges(gun), "steel", 3)
    light_top(g, gun, "steel", 6)
    P.flat(g, gun & (np.abs(X - (sx - 2)) < 2.5) & (Y > 19) & (Z > CZ - 6) & (Z < CZ + 2), "orange", 6)  # top stripe
    barrel = disc(g, "z", sx - 2, 17, 2.4, CZ - 16, CZ - 8, "steel", 6)
    for z0 in (CZ - 14, CZ - 11):
        P.flat(g, disc(g, "z", sx - 2, 17, 3.0, z0, z0 + 2, "rust", 6), "rust", 6)
    muzzle = disc(g, "z", sx - 2, 17, 2.8, CZ - 18, CZ - 16, "steel", 4)
    P.flat(g, muzzle & (Z < CZ - 17) & (np.hypot(X - (sx - 2), Y - 17) < 1.8), "cyan", 7)
    P.flat(g, gun & (X < sx - 5.5) & (Y > 15) & (Y < 19) & (Z < CZ + 2) & (Z > CZ - 6), "cyan", 6)  # charge window
    del barrel
    return g


def build():
    rig = Rig()
    rig.add("grunt", legs(), HIP)
    rig.add("body", body(), WAIST, "grunt")
    rig.add("head", head(), NECK, "body")
    rig.add("arm-l", arm_l(), SHOULDER["arm-l"], "body")
    rig.add("arm-r", arm_r(), SHOULDER["arm-r"], "body")
    muzzle = rig.sock("socket-muzzle", (CX - 12, 17, CZ - 18), "arm-r")
    z = (0.0, 0.0, 0.0)
    idle = {"body": {"rot": wave(2.4, "x", 3)},
            "head": {"rot": keys((0, z), (0.6, (0, 14, 0)), (1.2, z), (1.8, (0, -14, 0)), (2.4, z))},
            "arm-l": {"rot": wave(2.4, "x", 5, phase=1.0)}, "arm-r": {"rot": wave(2.4, "x", 3, phase=2.0)}}
    attack = {"arm-r": {"rot": keys((0, z), (0.2, (18, 0, 0)), (0.35, (18, 0, 0)), (0.42, (30, 0, 0)), (0.6, (18, 0, 0)), (1.0, z))},
              "body": {"rot": keys((0, z), (0.2, (0, 10, 0)), (0.42, (6, 10, 0)), (1.0, z))},
              "head": {"rot": keys((0, z), (0.2, (-6, 8, 0)), (1.0, z))}}
    hit = {"body": {"rot": keys((0, z), (0.1, (16, 0, 6)), (0.45, z))},
           "head": {"rot": keys((0, z), (0.1, (14, -12, 0)), (0.45, z))},
           "arm-l": {"rot": keys((0, z), (0.1, (0, 0, 30)), (0.45, z))}}
    death = {"grunt": {"rot": keys((0, z), (0.3, (10, 0, 0)), (0.8, (82, 0, 0)), (1.2, (78, 0, 0))),
                       "loc": keys((0, z), (0.8, (0, -7, 6)), (1.2, (0, -7, 6)))},
             "head": {"rot": keys((0, z), (0.5, (20, 0, 0)), (1.2, (10, 25, 0)))},
             "arm-l": {"rot": keys((0, z), (1.0, (-40, 0, 50)))}, "arm-r": {"rot": keys((0, z), (1.0, (-30, 0, -45)))}}
    return asset("creatures", "alien-grunt", "Alien Grunt", rig.root,
                 clips=[Clip("idle", idle), Clip("attack", attack, loop=False), Clip("hit", hit, loop=False), Clip("death", death, loop=False)],
                 sockets=[muzzle], pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "clip:attack", "size": 14, "aim": [0.0, 0.0, -1.0], "at": 0.4}])
