"""Elf ranger skin: PN body proportions. A forest-green hood and cloak
with a leaf-cut hem, a leather jerkin with a cross strap and brass
buckles, bracers, a belt pouch, fitted breeches, turned-down boots, a
quiver of fletched arrows on the back, pale blond fringe, long elf ears
poking out of the hood and a green-eyed face."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, band, boots, face, jitter, rig_idx
from rigkit import PIVOT, body, dilate, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    B = body()
    g.where(region(["Head"]), C("skin", 5))
    g.where(region(["Chest", "Body"]), C("wood", 4))  # leather jerkin
    g.where(region(["Arm.L", "Arm.R"]), C("leaf", 3))  # sleeves
    g.where(region(["ForeArm.L", "ForeArm.R"]), C("wood", 3))  # bracers
    g.where(region(["ForeArm.L", "ForeArm.R"]) & ((z % 4) == 0), C("wood", 2))
    g.where(region(["Hand.L", "Hand.R"]), C("skin", 5))
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), C("khaki", 3))
    # jerkin details: cross strap, belt, buckles, laces
    torso = region(["Chest", "Body"])
    g.where(torso & (np.abs((y - 16) - (z - 29) * 1.0) < 1.5) & (x >= 22), C("darkwood", 2))
    g.where(torso & (y >= 17) & (y < 19), C("darkwood", 2))
    g.box(24, 17, 36, 25, 19, 40, C("gold", 5))
    g.box(24, 24, 37, 25, 33, 38, C("wood", 5))  # laces
    g.box(24, 14, 30, 27, 18, 34, C("wood", 3))  # pouch
    g.set(26, 17, 31, C("gold", 5))
    # face and fringe
    face(g, eye=C("forest", 2), eye_hi=C("lime", 6), brow=C("gold", 5), mouth=C("skindark", 4))
    g.box(FACE_X, 44, 37, FACE_X + 1, 46, 39, C("skin", 4))  # nose shade
    g.box(FACE_X - 1, 52, HZ0, FACE_X + 1, 55, HZ1 + 1, C("gold", 5))  # fringe under the hood
    g.box(FACE_X, 51, HZ0 + 3, FACE_X + 1, 53, HZ0 + 8, C("gold", 6))
    # hood: 2-voxel shell over the head, open at the face, peaked at the back
    hood = shell(["Head"], 2) & ~(x > FACE_X - 2) | (shell(["Head"], 2) & (y >= HY1 - 3))
    hood &= y >= HY0 + 3
    g.where(hood, C("forest", 3))
    g.where(hood & shell(["Head"], 1) & ~shell(["Head"], 1, ) if False else hood & (y >= HY1), C("forest", 4))
    g.where(hood & ((y + z) % 5 == 0), C("forest", 2))
    g.box(HX0 - 4, HY1 - 4, 36, HX0 - 1, HY1 + 1, 40, C("forest", 3))  # hood peak drooping back
    g.box(HX0 - 6, HY1 - 8, 37, HX0 - 3, HY1 - 3, 39, C("forest", 3))
    # hood rim (face opening trim)
    rim = shell(["Head"], 2) & (x >= FACE_X - 1) & (x <= FACE_X + 2) & ((y >= HY1 - 2) | (z <= HZ0) | (z >= HZ1))
    g.where(rim & (y >= HY0 + 3), C("leaf", 5))
    # long ears poking out through the hood sides
    for sign, z0 in ((-1, HZ0 - 3), (1, HZ1 + 2)):
        for k in range(6):
            zz = z0 + sign * k
            g.box(HX0 + 9 - k, HY0 + 8 + k, zz, HX0 + 12 - k, HY0 + 11 + k // 2, zz + 1, C("skin", 5 if k < 4 else 4))
    # cloak: cape shell behind the torso to the knees with a leaf-cut hem, collar/mantle on the shoulders
    for yy in range(9, 36):
        spread = 10 + (36 - yy) // 5
        cut = (yy < 13) and ((np.arange(76) // 3) % 2 == 0)
        for zz in range(38 - spread, 38 + spread):
            if yy < 12 and (zz // 3) % 2 == 0:
                continue
            g.box(13, yy, zz, 15, yy + 1, zz + 1, C("forest", 3 if yy % 6 else 2))
    mantle = shell(["Chest"], 2) & (y >= 31) & (y < 37)
    g.where(mantle, C("forest", 4))
    g.where(mantle & (y == 31), C("leaf", 5))
    g.box(23, 33, 37, 26, 36, 40, C("gold", 5))  # leaf brooch
    g.set(25, 34, 38, C("leaf", 5))
    # quiver on the back (diagonal), arrows sticking up over the right shoulder
    for k in range(14):
        g.box(9, 18 + k, 41 - k // 3, 13, 19 + k, 45 - k // 3, C("wood", 3))
    g.box(9, 22, 40, 13, 24, 45, C("gold", 4))
    for i, zz in enumerate((38, 40, 42)):
        g.box(10 + i % 2, 32, zz, 11 + i % 2, 40, zz + 1, C("wood", 5))
        g.box(10 + i % 2, 38, zz - 1, 11 + i % 2, 41, zz + 2, C(("red", "bone", "red")[i], 5))
    # breeches knee patches + boots with cuffs
    g.where(region(["Leg.L", "Leg.R"]) & (y == 10), C("khaki", 2))
    boots(g, C("darkwood", 3), cuff=C("wood", 4), top=7, toe=C("darkwood", 2))
    jitter(g, 31, 0.08)
    return Asset(id="fantasy-characters-skins-elf-ranger", pack="fantasy", category="characters-skins", name="Elf Ranger",
                 root=Part("skin fantasy-elf-ranger", g, pivot=PIVOT))
