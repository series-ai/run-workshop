"""Bounty hunter skin: a white and steel armored tracker with copper trim,
a cyan rangefinder visor, a one-sided shoulder plate and a compact jetpack."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, fill, gloves, head_box, region, rig_grid, rxyz, shell
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()

    # White hull suit with steel joints and clear panel borders.
    base_body(g, C("steel", 3), C("iron", 3), sleeve=C("steel", 4),
              hand=C("steel", 3), legs=C("steel", 4))
    torso = shell(["Chest", "Body"], 1) & (y < hy0)
    fill(g, torso, C("bone", 5))
    fill(g, torso & ((y == 17) | (y == 18)), C("steel", 2))
    fill(g, torso & (x >= 24) & (y >= 22) & (y < 33), C("steel", 4))
    fill(g, torso & (x >= 25) & (y >= 23) & (y < 32), C("bone", 6))
    # Breastplate seams and the hunter's cyan target display.
    fill(g, torso & (x >= 25) & (y == 22), C("rust", 4))
    fill(g, torso & (x >= 25) & (y == 32), C("steel", 2))
    g.box(24, 26, 34, 25, 30, 42, C("iron", 2))
    g.box(24, 27, 35, 25, 29, 41, C("cyan", 5))
    g.box(24, 28, 36, 25, 29, 40, C("cyan", 7))
    g.set(24, 25, 38, C("rust", 6))

    # Steel arm shells, white forearm plates and copper cuff details.
    arm_shell = shell(["Arm.L", "Arm.R"], 1)
    fore_shell = shell(["ForeArm.L", "ForeArm.R"], 1)
    fill(g, arm_shell, C("steel", 5))
    fill(g, arm_shell & (y >= 32) & (x >= 23), C("bone", 5))
    fill(g, fore_shell, C("bone", 5))
    fill(g, fore_shell & ((y == 29) | (y == 34)), C("steel", 3))
    fill(g, fore_shell & (y >= 30) & (y <= 32) & (x >= 24), C("steel", 5))
    fill(g, fore_shell & (y == 30) & (x >= 24) & ((z < 30) | (z > 47)), C("rust", 5))

    # Asymmetric shoulder pauldron replaces the bulky drape.
    g.box(14, 32, 46, 25, 36, 54, C("steel", 3))
    g.box(15, 34, 47, 24, 37, 53, C("bone", 6))
    g.box(15, 33, 47, 24, 34, 53, C("rust", 5))
    g.box(25, 34, 49, 26, 35, 51, C("iron", 2))
    g.set(26, 35, 50, C("cyan", 6))

    # Cross-body ammunition harness with bright, individually framed cells.
    for k in range(11):
        yy, zz = 32 - k, 30 + k
        g.set(24, yy, zz, C("rust", 4))
        g.set(24, yy, zz + 1, C("rust", 4))
        if k in (3, 8):
            g.set(24, yy, zz + 2, C("cyan", 6))

    # Articulated leg plates and clean white knee guards.
    legs = shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y >= 6)
    fill(g, legs, C("steel", 4))
    fill(g, legs & (y >= 9) & (y < 13) & (x >= 23), C("bone", 6))
    fill(g, legs & (y == 8), C("rust", 4))
    fill(g, legs & (y >= 5) & (y < 7), C("iron", 2))
    boots(g, C("steel", 4), C("bone", 5), C("iron", 1), height=8, pad=1)
    fill(g, shell(["Foot.L", "Foot.R"], 1) & (y >= 3) & (y < 6), C("rust", 4))
    gloves(g, C("steel", 3), cuff=C("rust", 4), grow=1)

    # Compact helmet: preserve a visible neck and shoulder line.
    helm = dilate(region(HEAD), 1) & (y >= hy0 + 2)
    fill(g, helm, C("bone", 5))
    fill(g, helm & (y >= hy1 - 4), C("steel", 6))
    fill(g, helm & (y == hy0 + 2), C("steel", 2))
    # Dark faceplate, a clean T visor and framed side sensors.
    g.box(28, 42, 30, 30, 51, 46, C("iron", 1))
    g.box(29, 47, 31, 30, 49, 45, C("cyan", 5))
    g.box(29, 40, 37, 30, 48, 39, C("cyan", 5))
    g.box(29, 48, 32, 30, 49, 44, C("cyan", 7))
    g.box(28, 40, 30, 29, 42, 34, C("steel", 5))
    g.box(28, 40, 42, 29, 42, 46, C("steel", 5))
    for zz in (28, 48):
        g.box(17, 44, zz, 24, 50, zz + 1, C("iron", 2))
        g.box(18, 45, zz, 23, 49, zz + 1, C("rust", 5))
        g.set(21, 47, zz, C("cyan", 6))
    # Low-profile copper rangefinder above the brow.
    g.box(20, 57, 47, 24, 58, 51, C("rust", 5))
    g.box(21, 57, 51, 23, 58, 53, C("steel", 4))
    g.set(22, 57, 53, C("cyan", 7))

    # Framed life-support pack, with mounted thruster collars and exhausts.
    g.box(9, 22, 31, 15, 34, 45, C("steel", 3))
    g.box(8, 23, 32, 10, 33, 44, C("iron", 2))
    g.box(8, 25, 34, 9, 31, 42, C("bone", 5))
    g.box(8, 27, 36, 9, 30, 40, C("cyan", 5))
    g.box(8, 28, 37, 9, 29, 39, C("cyan", 7))
    g.box(10, 33, 32, 14, 34, 44, C("rust", 5))
    for zz in (32, 42):
        g.box(10, 20, zz, 14, 23, zz + 4, C("rust", 4))
        g.cylinder("y", 12, zz + 2, 2.2, 16, 21, C("steel", 4))
        g.cylinder("y", 12, zz + 2, 1.1, 16, 18, C("cyan", 5))
        g.box(10, 22, zz + 1, 14, 23, zz + 3, C("steel", 6))
    # Painted seams define the side and rear panels without random speckle.
    fill(g, helm & ((z == hz0 - 1) | (z == hz1)) & (y >= hy0 + 5), C("steel", 4))
    fill(g, helm & (x == hx0 - 1) & ((y == hy0 + 5) | (y == hy1 - 5)), C("steel", 3))
    fill(g, helm & (x == hx0 - 1) & (y >= hy0 + 8) & (y < hy1 - 7) & (z >= hz0 + 3) & (z < hz1 - 3), C("steel", 5))
    fill(g, helm & (x == hx0 - 1) & (y == hy0 + 10) & (z >= hz0 + 7) & (z < hz1 - 7), C("cyan", 5))
    side = helm & ((z == hz0 - 1) | (z == hz1)) & (x >= hx0 + 3) & (x < hx1 - 2) & (y >= hy0 + 7) & (y < hy1 - 5)
    fill(g, side, C("steel", 3))
    fill(g, side & (x >= hx0 + 4) & (x < hx1 - 3) & (y >= hy0 + 8) & (y < hy1 - 6), C("steel", 5))
    fill(g, side & (y == hy0 + 12) & (x >= hx0 + 5) & (x < hx1 - 4), C("cyan", 6))
    fill(g, side & (y == hy0 + 10) & (x == hx0 + 5), C("rust", 6))
    for yy in (24, 32):
        g.set(8, yy, 33, C("bone", 7)).set(8, yy, 43, C("bone", 7))

    return asset("characters-skins", "bounty-hunter", "Bounty Hunter", Part("skin space-bounty-hunter", g, pivot=PIVOT))
