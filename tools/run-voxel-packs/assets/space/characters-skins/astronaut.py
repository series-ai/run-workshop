"""Astronaut skin: a white EVA suit with orange trim, a chest control
panel, a mission patch, a steel-rimmed helmet with an open face window, a
life-support backpack with hoses, padded gloves and moon boots."""
from _rig import C, HEAD, PIVOT, Part, base_body, dilate, face, fill, gloves, head_box, leg_z_ranges, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    base_body(g, C("skin", 5), C("bone", 6), legs=C("bone", 6))
    face(g, eye=C("iron", 1), mouth=C("iron", 2), brow=C("iron", 1), eye_h=3)
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    # suit bulk: 1-voxel shell on torso, arms, legs
    suit = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y < hy0)
    fill(g, suit, C("bone", 6))
    # Dark pressure joints separate the bright suit into readable parts.
    joints = shell(["Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R", "Leg.L", "Leg.R"], 1)
    fill(g, joints & (((y >= 31) & (y <= 32)) | ((y >= 15) & (y <= 16))), C("steel", 3))
    fill(g, shell(["ForeArm.L", "ForeArm.R"], 1), C("bone", 5))
    wrists = shell(["ForeArm.L", "ForeArm.R"], 1) & (((z >= 17) & (z <= 20)) | ((z >= 55) & (z <= 58)))
    fill(g, wrists, C("steel", 3))
    fill(g, wrists & (y >= 29) & (y <= 30), C("orange", 5))
    fill(g, suit & ((y == 17) | (y == 18)), C("orange", 5))  # belt
    fill(g, suit & (y >= 9) & (y < 11), C("orange", 4))  # knee pads
    fill(g, suit & (x >= 24) & (y >= 24) & (y < 32) & (z >= 33) & (z < 43), C("iron", 2))  # control housing
    fill(g, suit & (x >= 25) & (y >= 25) & (y < 31) & (z >= 34) & (z < 42), C("steel", 4))
    g.box(24, 29, 35, 25, 30, 41, C("cyan", 5))
    g.box(24, 29, 36, 25, 30, 40, C("cyan", 7))
    for zz, col in ((35, "orange"), (40, "gold")):
        g.set(24, 26, zz, C(col, 6))
    for yy in (25, 30):
        for zz in (34, 41):
            g.set(24, yy, zz, C("steel", 7))
    fill(g, suit & (y >= 29) & (y < 35) & (z >= 50) & (z < 53), C("navy", 4))  # patch on right arm
    g.set(22, 31, 51, C("gold", 6))
    # helmet: 2-voxel shell with an open face window, steel rim
    helm = dilate(region(HEAD), 2) & ~region(HEAD) & (y >= hy0 - 1)
    window = (x >= hx1 - 2) & (y >= hy0 + 2) & (y < hy1 - 3) & (z >= hz0 + 1) & (z < hz1 - 1)
    fill(g, helm & ~window, C("bone", 7))
    # One clean top seam and a framed rear access panel break up the hull.
    fill(g, helm & (y == hy1 + 1) & (x >= hx0 + 3) & (x < hx1 - 3) & ((z == 34) | (z == 41)), C("steel", 5))
    rear_panel = helm & (x == hx0 - 2) & (y >= 43) & (y < 52) & (z >= 33) & (z < 43)
    fill(g, rear_panel, C("steel", 4))
    rear_edge = rear_panel & ((y == 43) | (y == 51) | (z == 33) | (z == 42))
    fill(g, rear_edge, C("iron", 2))
    rear_core = helm & (x == hx0 - 2) & (y >= 45) & (y < 50) & (z >= 35) & (z < 41)
    fill(g, rear_core, C("steel", 3))
    rear_glow = helm & (x == hx0 - 2) & (y >= 47) & (y < 49) & (z >= 36) & (z < 40)
    fill(g, rear_glow, C("cyan", 6))
    rim = helm & ~window & (x >= hx1 - 1) & (dilate(full_window(window), 1))
    fill(g, rim, C("steel", 5))
    fill(g, helm & (y >= hy0 - 2) & (y <= hy0), C("iron", 2))  # deep neck ring
    # Gold and steel rails frame the open visor window without hiding the face.
    for yy in (hy0 + 1, hy1 - 3):
        g.box(hx1 - 1, yy, hz0 + 1, hx1, yy + 1, hz1 - 1, C("gold", 5))
    for zz in (hz0, hz1 - 1):
        g.box(hx1 - 1, hy0 + 2, zz, hx1, hy1 - 3, zz + 1, C("gold", 5))
    # Expressive eyes and a glass glint make the face read at small size.
    g.box(hx1 - 1, 49, 32, hx1, 51, 36, C("iron", 1))
    g.box(hx1 - 1, 46, 42, hx1, 49, 46, C("iron", 1))
    g.set(hx1 - 1, 50, 33, C("cyan", 7)).set(hx1 - 1, 47, 43, C("cyan", 7))
    g.box(hx1 - 1, 53, 31, hx1, 54, 36, C("iron", 2))
    g.box(hx1 - 1, 51, 42, hx1, 52, 47, C("iron", 2))
    g.box(hx1 - 1, 41, 36, hx1, 42, 40, C("skindark", 3))
    g.box(hx1 - 1, 53, 38, hx1, 54, 40, C("cyan", 5))
    g.set(hx1 - 1, 52, 40, C("cyan", 7))  # visor reflection
    for side_z in (hz0 - 2, hz1 + 1):
        g.box(17, 43, side_z, 25, 51, side_z + 1, C("steel", 3))
        g.box(18, 44, side_z, 24, 50, side_z + 1, C("orange", 5))  # ear discs
        g.box(19, 45, side_z, 23, 49, side_z + 1, C("rust", 4))
        g.box(20, 46, side_z, 22, 48, side_z + 1, C("cyan", 6))
        g.set(21, 47, side_z, C("plasma", 7))
    g.box(17, hy1 + 2, 44, 18, hy1 + 8, 45, C("steel", 5))  # antenna
    g.set(17, hy1 + 7, 44, C("red", 7))
    # life-support backpack (behind the torso, -x)
    g.box(9, 17, 30, 16, 35, 46, C("bone", 5))
    g.box(9, 17, 30, 10, 35, 46, C("steel", 4))
    g.box(8, 18, 31, 9, 34, 32, C("rust", 4))
    g.box(8, 18, 44, 9, 34, 45, C("rust", 4))
    for yy in range(20, 33, 3):
        g.box(8, yy, 32, 9, yy + 1, 44, C("steel", 3))
    g.box(10, 33, 32, 12, 38, 34, C("iron", 2))  # hoses to the helmet
    g.box(10, 33, 42, 12, 38, 44, C("iron", 2))
    g.box(8, 24, 36, 9, 28, 40, C("rust", 5))
    g.box(8, 25, 37, 9, 27, 39, C("cyan", 6))
    # Glove cuffs and dark palms keep the sleeve ends distinct.
    gloves(g, C("steel", 5), cuff=C("iron", 2), grow=1)
    # Keep each boot inside its own leg span. No shared sole bridge.
    # The rig leg ranges meet at z=38. Leave a two-voxel channel there.
    g.a[15:28, 0:8, 37:39] = 0
    for z0, z1 in leg_z_ranges().values():
        if z0 < 38:
            z1 = min(z1, 37)
        else:
            z0 = max(z0, 39)
        g.box(15, 0, z0, 27, 8, z1, C("bone", 5))
        g.box(15, 0, z0, 27, 1, z1, C("iron", 2))
        g.box(15, 6, z0, 27, 8, z1, C("orange", 5))
        g.box(25, 1, z0, 28, 4, z1, C("steel", 4))
        g.box(24, 4, z0, 27, 6, z1, C("steel", 5))
        g.box(24, 1, z0, 25, 2, z1, C("cyan", 6))
    speck_rig(g, 200, 0.03, ramps=("bone",))
    return asset("characters-skins", "astronaut", "Astronaut", Part("skin space-astronaut", g, pivot=PIVOT))


def full_window(w):
    import numpy as np

    return np.broadcast_to(w, (40, 92, 76))
