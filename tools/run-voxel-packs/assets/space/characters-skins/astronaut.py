"""Astronaut skin: a white EVA suit with orange trim, a chest control
panel, a mission patch, a steel-rimmed helmet with an open face window, a
life-support backpack with hoses, padded gloves and moon boots."""
from _rig import C, EYE_Z, FACE_X, HANDS, HEAD, PIVOT, Part, base_body, boots, body, dilate, face, fill, gloves, head_box, paint, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    base_body(g, C("skin", 5), C("bone", 6), legs=C("bone", 6))
    face(g, eye=C("navy", 1), mouth=C("skindark", 3), brow=C("darkwood", 2))
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    # suit bulk: 1-voxel shell on torso, arms, legs
    suit = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y < hy0)
    fill(g, suit, C("bone", 6))
    fill(g, suit & ((y == 17) | (y == 18)), C("orange", 5))  # belt
    fill(g, suit & (y >= 9) & (y < 11), C("orange", 4))  # knee pads
    fill(g, suit & (x >= 24) & (y >= 25) & (y < 31) & (z >= 34) & (z < 42), C("steel", 4))  # chest panel
    for zz, col in ((35, "red"), (37, "gold"), (39, "toxic")):
        g.set(24, 29, zz, C(col, 6)).set(24, 27, zz + 1, C(col, 5))
    fill(g, suit & (y >= 29) & (y < 35) & (z >= 50) & (z < 53), C("navy", 4))  # patch on right arm
    g.set(22, 31, 51, C("gold", 6))
    # helmet: 2-voxel shell with an open face window, steel rim
    helm = dilate(region(HEAD), 2) & ~region(HEAD) & (y >= hy0 - 1)
    window = (x >= hx1 - 2) & (y >= hy0 + 2) & (y < hy1 - 3) & (z >= hz0 + 1) & (z < hz1 - 1)
    fill(g, helm & ~window, C("bone", 7))
    rim = helm & ~window & (x >= hx1 - 1) & (dilate(full_window(window), 1))
    fill(g, rim, C("steel", 5))
    fill(g, helm & (y == hy0 - 1), C("steel", 4))  # neck ring
    for zz in (hz0 - 2, hz1 + 1):
        g.box(18, 44, zz, 24, 50, zz + 1, C("orange", 5))  # ear discs
        g.set(21, 47, zz, C("plasma", 7))
    g.box(17, hy1 + 2, 44, 18, hy1 + 8, 45, C("steel", 5))  # antenna
    g.set(17, hy1 + 7, 44, C("red", 7))
    # life-support backpack (behind the torso, -x)
    g.box(9, 17, 30, 16, 35, 46, C("bone", 5))
    g.box(9, 17, 30, 10, 35, 46, C("steel", 4))
    for yy in range(20, 33, 3):
        g.box(8, yy, 32, 9, yy + 1, 44, C("steel", 3))
    g.box(10, 33, 32, 12, 38, 34, C("iron", 2))  # hoses to the helmet
    g.box(10, 33, 42, 12, 38, 44, C("iron", 2))
    g.box(8, 24, 36, 9, 28, 40, C("orange", 5))
    gloves(g, C("gray", 6), grow=1)
    boots(g, C("bone", 5), C("orange", 5), C("iron", 2), height=8, pad=1)
    speck_rig(g, 200, 0.06, ramps=("bone",))
    return asset("characters-skins", "astronaut", "Astronaut", Part("skin space-astronaut", g, pivot=PIVOT))


def full_window(w):
    import numpy as np

    return np.broadcast_to(w, (40, 92, 76))
