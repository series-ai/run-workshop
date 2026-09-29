"""Android skin: a chrome service android with panel-seamed plating, a
black visor face with glowing cyan eyes and a speaker grille, a glowing
chest reactor, dark articulated joints, ear antennas and heavy feet."""
import numpy as np

from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, face, fill, head_box, paint, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    base_body(g, C("steel", 6), C("steel", 5), sleeve=C("steel", 6), hand=C("iron", 3), legs=C("steel", 5))
    # panel seams everywhere
    paint(g, ((y % 6) == 0) | ((z % 7) == 0), C("steel", 3))
    # joints
    paint(g, region(["Arm.L", "Arm.R"]) & ((z == 29) | (z == 47)), C("iron", 2)) if False else None
    for zz in (22, 28, 47, 54):
        g.box(16, 29, zz, 24, 35, zz + 1, C("iron", 2))
    g.box(15, 9, 29, 25, 10, 47, C("iron", 2))  # knees
    g.box(15, 15, 29, 25, 16, 47, C("iron", 2))  # hips
    # visor face
    g.box(28, 40, 29, 29, 52, 47, C("iron", 1))
    for z0, z1 in ((32, 35), (41, 44)):
        g.box(28, 46, z0, 29, 48, z1, C("plasma", 6))
        g.set(28, 47, z0 + 1, C("plasma", 7))
    for zz in range(35, 41, 2):
        g.box(28, 41, zz, 29, 44, zz + 1, C("steel", 4))
    fill(g, (x >= 13) & (x < 29) & (y == hy1 - 1) & (z >= hz0) & (z < hz1), C("steel", 7))  # lit crown
    # ear antennas
    for zz in (hz0 - 1, hz1):
        g.box(18, 44, zz, 23, 50, zz + 1, C("iron", 3))
        g.box(20, 50, zz, 21, 58, zz + 1, C("steel", 6))
        g.set(20, 58, zz, C("plasma", 7))
    # chest reactor
    g.box(24, 25, 34, 25, 32, 42, C("steel", 3))
    g.box(24, 26, 35, 25, 31, 41, C("plasma", 5))
    g.box(24, 27, 36, 25, 30, 40, C("plasma", 7))
    fill(g, shell(["Body"], 1) & (y == 18), C("iron", 3))
    boots(g, C("steel", 4), C("iron", 2), C("iron", 1), height=6, pad=1)
    speck_rig(g, 202, 0.04, ramps=("steel",))
    return asset("characters-skins", "android", "Android", Part("skin space-android", g, pivot=PIVOT))
