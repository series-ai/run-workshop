"""Dwarf warrior skin: a horned iron helm with a nose guard, a huge
braided ginger beard with gold rings, a chainmail shirt under a leather
harness with a rune buckle, bracers, a fur-trimmed kilt and heavy iron
boots."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, boots, face, jitter, rig_idx
from rigkit import PIVOT, body, dilate, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    g.where(region(["Head"]), C("skin", 5))
    mail = region(["Chest", "Body", "Arm.L", "Arm.R"])
    g.where(mail, C("steel", 3))
    g.where(mail & (((x + y + z) % 2) == 0), C("steel", 5))
    g.where(region(["ForeArm.L", "ForeArm.R"]), C("wood", 3))
    g.where(region(["ForeArm.L", "ForeArm.R"]) & ((z % 3) == 0), C("iron", 4))
    g.where(region(["Hand.L", "Hand.R"]), C("skin", 5))
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), C("wood", 2))
    face(g, eye=C("navy", 1), brow=C("orange", 3), eye_y=45)
    g.box(FACE_X, 42, 36, FACE_X + 2, 45, 40, C("skin", 4))  # big nose
    # helm with nose guard and horns
    helm = shell(["Head"], 1) & (y >= 49)
    g.where(helm, C("iron", 4))
    g.where(helm & (y == 49), C("gold", 4))
    g.where(helm & (((z - 38) % 5) == 0) & (y > 50), C("iron", 5))
    g.box(FACE_X, 44, 37, FACE_X + 2, 50, 39, C("iron", 5))
    for sign, zb in ((-1, HZ0 - 1), (1, HZ1)):
        for k in range(10):
            zz = zb + sign * (1 + k // 2)
            yy = 52 + k - (k * k) // 14
            g.box(HX0 + 7, yy, zz, HX0 + 10, yy + 2, zz + 1, C("bone", 5 if k < 6 else 7))
    # beard: wide mass covering the lower face and chest, two braids with rings
    for k in range(8):
        w = 10 - k // 2
        g.box(FACE_X - 3, 44 - k * 2, 38 - w, FACE_X + 2, 46 - k * 2, 38 + w, C("orange", 3 if k % 2 else 4))
    g.box(FACE_X, 44, 33, FACE_X + 2, 46, 43, C("orange", 5))  # moustache
    for zb in (33, 42):
        g.box(FACE_X - 1, 18, zb, FACE_X + 2, 30, zb + 3, C("orange", 3))
        for yy in (20, 26):
            g.box(FACE_X - 1, yy, zb, FACE_X + 2, yy + 2, zb + 3, C("gold", 5))
    g.where(shell(["Head"], 1) & (y < 49) & (x < FACE_X - 4) & (y > 38), C("orange", 3))  # hair at the back/sides
    # leather harness + rune buckle
    torso = shell(["Chest", "Body"], 1)
    g.where(torso & (np.abs((y - 16) - np.abs(z - 38) * 1.4) < 1.5) & (x >= 23), C("wood", 3))
    g.where(torso & (y >= 16) & (y < 19), C("wood", 3))
    g.box(24, 15, 35, 26, 20, 41, C("gold", 4))
    g.box(25, 16, 37, 26, 19, 39, C("plasma", 5))
    # fur-trimmed kilt
    kilt = shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 9) & (y < 16)
    g.where(kilt, C("forest", 3))
    g.where(kilt & (((z // 3) + (y // 2)) % 2 == 0), C("forest", 2))
    g.where(kilt & (y == 9), C("bone", 6))
    # pauldrons (leather + fur)
    for z0, z1 in ((24, 31), (45, 52)):
        pad = dilate(region(["Arm.L" if z0 < 30 else "Arm.R"]) | region(["Chest"]), 2) & ~body() & (z >= z0) & (z < z1) & (y >= 30)
        g.where(pad, C("wood", 4))
        g.where(pad & (y >= 35), C("bone", 6))
    boots(g, C("iron", 3), cuff=C("bone", 6), top=6, toe=C("iron", 5))
    jitter(g, 81, 0.07)
    return Asset(id="fantasy-characters-skins-dwarf", pack="fantasy", category="characters-skins", name="Dwarf Warrior",
                 root=Part("skin fantasy-dwarf", g, pivot=PIVOT))
