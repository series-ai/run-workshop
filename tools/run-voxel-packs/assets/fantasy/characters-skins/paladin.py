"""Paladin skin: a winged great helm with a cross visor, polished
silver plate with gold trim over a white-and-blue sun tabard, layered
pauldrons, gauntlets, a red cape and armoured sabatons."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, boots, jitter, rig_idx
from rigkit import PIVOT, body, dilate, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    ST, STD, GD = C("steel", 5), C("steel", 4), C("gold", 5)
    g.where(region(["Chest", "Body"]), ST)
    g.where(region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]), STD)
    g.where(region(["Hand.L", "Hand.R"]), C("steel", 3))
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), STD)
    g.where(region(["Head"]), ST)
    # helm: plate shell + gold brow band + cross visor + wings
    helm = shell(["Head"], 1)
    g.where(helm, C("steel", 6))
    g.where(helm & (y >= HY1), C("steel", 7))
    g.where((helm | region(["Head"])) & (y >= 49) & (y < 51), GD)
    g.box(FACE_X, 46, 30, FACE_X + 2, 48, 46, C("iron", 0))  # eye slit
    g.box(FACE_X, 38, 37, FACE_X + 2, 48, 39, C("iron", 0))  # vertical slit (cross)
    g.box(FACE_X + 1, 49, 37, FACE_X + 2, 57, 39, GD)  # nasal/crest line
    for sign, z0 in ((-1, HZ0 - 2), (1, HZ1 + 1)):  # wings on the helm sides
        for k in range(7):
            zz = z0 + sign * (k // 3)
            g.box(HX0 + 6 - k, 50 + k, zz, HX0 + 11 - k // 2, 51 + k, zz + 1, C("bone", 7 if k % 2 else 6))
    # tabard over the chest and hanging below the belt
    tab = (np.abs(z - 37.5) < 6) & (x >= 23) & (x < 26)
    g.where(shell(["Chest", "Body"], 1) & tab & (y >= 12), C("bone", 7))
    g.box(24, 8, 33, 26, 16, 43, C("bone", 7))
    g.box(24, 8, 33, 26, 9, 43, GD)
    g.box(25, 20, 36, 26, 31, 40, C("blue", 3))  # sun on the chest
    g.box(25, 24, 33, 26, 27, 43, C("blue", 3))
    g.box(25, 24, 37, 26, 27, 39, GD)
    # belt + plate edges
    g.where(shell(["Body"], 1) & (y >= 16) & (y < 18), C("wood", 3))
    g.box(25, 16, 36, 27, 18, 40, GD)
    # pauldrons (two layers) and elbow cops
    for zc, (z0, z1) in ((0, (22, 32)), (1, (44, 54))):
        pad = dilate(region(["Arm.L" if zc == 0 else "Arm.R"]) | region(["Chest"]), 3) & ~body()
        pad &= (z >= z0) & (z < z1) & (y >= 30)
        g.where(pad, C("steel", 6))
        g.where(pad & (y == 30), GD)
    g.where(shell(["ForeArm.L", "ForeArm.R"], 1) & ((z == 21) | (z == 54) | (z == 55) | (z == 20)), C("steel", 6))
    g.where(shell(["Hand.L", "Hand.R"], 1) & (y >= 29), C("steel", 5))
    # red cape
    for yy in range(8, 34):
        spread = 9 + (34 - yy) // 6
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("red", 3 if yy % 5 else 2))
    g.box(14, 32, 28, 16, 35, 48, GD)
    # tassets + knee cops
    g.where(shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 12) & (y < 16), C("steel", 5))
    g.where(shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y >= 9) & (y < 11), C("steel", 7))
    boots(g, C("steel", 4), cuff=C("steel", 6), top=6, toe=C("steel", 6))
    jitter(g, 51, 0.05)
    return Asset(id="fantasy-characters-skins-paladin", pack="fantasy", category="characters-skins", name="Paladin",
                 root=Part("skin fantasy-paladin", g, pivot=PIVOT))
