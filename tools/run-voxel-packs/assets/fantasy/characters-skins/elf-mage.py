"""Elf mage skin: long silver hair under a gold circlet with a sapphire,
violet robes with gold-trimmed hem and bell sleeves, a star-embroidered
sash, a high mantle collar, glowing arcane cuffs and slippers; violet
eyes and long ears."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, face, jitter, rig_idx
from rigkit import PIVOT, body, dilate, leg_z_ranges, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    g.where(region(["Head"]), C("skin", 6))
    g.where(region(["Chest", "Body"]), C("purple", 3))
    g.where(region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]), C("purple", 4))
    g.where(region(["Hand.L", "Hand.R"]), C("skin", 6))
    face(g, eye=C("purple", 2), eye_hi=C("arcane", 7), brow=C("bone", 7), mouth=C("pink", 4))
    # robe skirt: widening shell from the waist down to the ankles
    for yy in range(2, 18):
        grow = 1 + (18 - yy) // 5
        ring = dilate(region(["Body", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]) | (body() & (y < 18) & (y >= 5)), grow) & (y == yy)
        g.where(ring & (g.a == 0), C("purple", 3 if (yy // 2) % 3 else 2))
    g.where((g.a != 0) & (y < 4) & ~region(["Head"]) & (x < 30), C("gold", 5))  # gold hem
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), C("purple", 3))
    for zz in range(30, 47, 4):  # embroidered stars on the hem front
        g.box(28, 6, zz, 29, 9, zz + 1, C("gold", 6))
        g.box(28, 7, zz - 1, 29, 8, zz + 2, C("gold", 6))
    # front panel and sash
    g.where(region(["Chest", "Body"]) & (np.abs(z - 37.5) < 2.5) & (x >= 23), C("bone", 6))
    g.where(shell(["Body", "Chest"], 1) & (y >= 17) & (y < 20), C("arcane", 4))
    g.box(24, 12, 39, 26, 19, 42, C("arcane", 4))  # sash tail
    g.set(24, 18, 37, C("gold", 6))
    # bell sleeves widening at the forearm, glowing cuffs
    sleeve = shell(["ForeArm.L", "ForeArm.R"], 2) & (y <= 35)
    g.where(sleeve, C("purple", 4))
    g.where(sleeve & ((z == 14) | (z == 61) | (z == 13) | (z == 62)), C("arcane", 6))
    # mantle collar standing up
    collar = shell(["Chest"], 2) & (y >= 33) & (y < 40) & ~region(["Head"]) & (x < FACE_X - 3)
    g.where(collar & (g.a == 0), C("purple", 5))
    g.where(collar & (y >= 38), C("gold", 5))
    # silver hair: shell over the head top/back, long down the back
    hair = (shell(["Head"], 1) & (y >= HY1 - 1)) | (shell(["Head"], 1) & (x <= HX0 + 7) & (y >= HY0 + 2))
    g.where(hair, C("bone", 7))
    g.where(hair & ((z % 3) == 0), C("bone", 6))
    g.box(HX0 - 2, 22, HZ0 + 3, HX0, HY0 + 12, HZ1 - 3, C("bone", 7))  # long hair down the back
    g.where((g.a == C("bone", 7)) & (x < HX0) & ((z % 3) == 0), C("bone", 5))
    for sz in (HZ0 - 1, HZ1):  # side locks framing the face
        g.box(FACE_X - 6, 40, sz, FACE_X - 1, HY1, sz + 1, C("bone", 7))
    g.box(FACE_X, 54, HZ0, FACE_X + 1, 57, HZ1 + 1, C("bone", 6))  # fringe
    # circlet
    circ = shell(["Head"], 2) & (y >= 53) & (y < 55) & ~(shell(["Head"], 1) & (x < FACE_X - 1)) | (shell(["Head"], 1) & (y >= 53) & (y < 55))
    g.where(circ & (x > HX0), C("gold", 5))
    g.box(FACE_X + 1, 53, 37, FACE_X + 2, 56, 39, C("blue", 5))
    # ears
    for sign, z0 in ((-1, HZ0 - 2), (1, HZ1 + 1)):
        for k in range(6):
            g.box(HX0 + 9 - k, HY0 + 8 + k, z0 + sign * k, HX0 + 12 - k, HY0 + 11 + k // 2, z0 + sign * k + 1, C("skin", 6 if k < 4 else 5))
    # slippers
    for z0, z1 in leg_z_ranges().values():
        g.box(17, 0, z0, 29, 2, z1, C("purple", 2))
        g.box(28, 1, z0 + 2, 30, 3, z1 - 2, C("gold", 5))
    jitter(g, 41, 0.06)
    return Asset(id="fantasy-characters-skins-elf-mage", pack="fantasy", category="characters-skins", name="Elf Mage",
                 root=Part("skin fantasy-elf-mage", g, pivot=PIVOT))
