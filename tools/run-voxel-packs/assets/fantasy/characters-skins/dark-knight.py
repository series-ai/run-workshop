"""Dark knight skin: black iron plate with blood-red trim and spikes, a
horned great helm with a glowing red visor slit, spiked pauldrons, a
chain skirt, clawed gauntlets and a tattered crimson cape."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, boots, jitter, rig_idx
from rigkit import PIVOT, body, dilate, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    IR, IRD, RED = C("iron", 5), C("iron", 4), C("blood", 4)
    g.where(region(["Chest", "Body", "Head"]), IR)
    g.where(region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R", "Hand.L", "Hand.R"]), IRD)
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), IRD)
    helm = shell(["Head"], 1)
    g.where(helm, C("iron", 6))
    g.where(helm & (y >= HY1), C("iron", 7))
    g.box(FACE_X, 46, 30, FACE_X + 2, 48, 46, C("red", 5))  # glowing visor
    g.box(FACE_X + 1, 46, 32, FACE_X + 2, 48, 44, C("ember", 5))
    g.box(FACE_X + 1, 45, 32, FACE_X + 2, 48, 34, C("red", 5)).box(FACE_X + 1, 45, 42, FACE_X + 2, 48, 44, C("red", 5))
    for zz in range(31, 46, 3):  # breath grille
        g.box(FACE_X + 1, 38, zz, FACE_X + 2, 44, zz + 1, IRD)
    g.box(FACE_X + 1, 48, 37, FACE_X + 2, 58, 39, RED)  # crest line
    for sign, zb in ((-1, HZ0 - 1), (1, HZ1)):  # curved horns
        for k in range(16):
            zz = zb + sign * (k // 2)
            yy = 50 + k - (k * k) // 22
            xx = HX0 + 8 - k // 3
            w = 3 if k < 8 else 2
            g.box(xx, yy, zz - (1 if sign < 0 else 0), xx + w, yy + w, zz + 1 + (1 if sign > 0 else 0) - (0 if k < 8 else 1), C("bone", 4 if k < 6 else 6))
    # chest: red trim, skull-ish emblem, spikes
    g.where(shell(["Chest"], 1) & (y >= 22), C("iron", 4))
    g.where(shell(["Chest"], 1) & ((y == 22) | (y == 23)), RED)
    g.box(25, 26, 35, 26, 31, 41, C("bone", 5))
    g.box(25, 28, 36, 26, 29, 37, C("red", 6)).box(25, 28, 39, 26, 29, 40, C("red", 6))
    # spiked pauldrons
    for (z0, z1, zs) in ((21, 32, 25), (44, 55, 50)):
        pad = dilate(region(["Arm.L" if z0 < 30 else "Arm.R"]) | region(["Chest"]), 3) & ~body() & (z >= z0) & (z < z1) & (y >= 30)
        g.where(pad, C("iron", 4))
        g.where(pad & (y == 30), RED)
        for k in range(3):
            g.box(19 + k, 38 + k * 2, zs, 21 + k, 40 + k * 2, zs + 1, C("bone", 6))
    # clawed gauntlets
    g.where(shell(["Hand.L", "Hand.R", "ForeArm.L", "ForeArm.R"], 1) & ((z <= 16) | (z >= 59)), C("iron", 4))
    for zz in (8, 67):
        for yy in (29, 31, 33):
            g.set(22, yy, zz, C("bone", 6))
    # chain skirt
    skirt = shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 9) & (y < 17)
    g.where(skirt, C("iron", 3))
    g.where(skirt & (((x + y + z) % 2) == 0), C("iron", 5))
    g.where(skirt & (y == 16), RED)
    # tattered cape
    for yy in range(4, 34):
        spread = 10 + (34 - yy) // 5
        for zz in range(38 - spread, 38 + spread):
            if yy < 10 and ((zz * 7) % 5 < 2 or (yy < 7 and zz % 3 == 0)):
                continue
            g.set(13, yy, zz, C("blood", 2 if yy % 6 else 1))
            g.set(14, yy, zz, C("blood", 2))
    boots(g, C("iron", 2), cuff=RED, top=6, toe=C("iron", 4))
    jitter(g, 61, 0.06)
    return Asset(id="fantasy-characters-skins-dark-knight", pack="fantasy", category="characters-skins", name="Dark Knight",
                 root=Part("skin fantasy-dark-knight", g, pivot=PIVOT))
