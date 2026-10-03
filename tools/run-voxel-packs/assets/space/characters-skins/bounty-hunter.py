"""Bounty hunter skin: a scuffed teal-and-rust armoured mercenary with a
dark T-visor helmet and flip-down rangefinder, a tattered sand poncho over
one shoulder, a bandolier of power cells, gauntlets, knee plates and a
mini jetpack."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, fill, gloves, head_box, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    base_body(g, C("skin", 4), C("khaki", 2), sleeve=C("khaki", 2), legs=C("khaki", 3))
    plates = shell(["Chest"], 1) & (x >= 23) & (y >= 23)
    fill(g, plates, C("teal", 4))
    fill(g, plates & (y % 4 == 0), C("teal", 3))
    fill(g, shell(["Arm.L", "Arm.R"], 1) & (y >= 33), C("rust", 4))  # shoulder plates
    fill(g, shell(["ForeArm.L", "ForeArm.R"], 1), C("teal", 3))  # gauntlets
    fill(g, shell(["Leg.L", "Leg.R"], 1) & (y >= 9) & (y < 13) & (x >= 23), C("teal", 4))
    # bandolier from right shoulder to left hip
    for k in range(14):
        yy, zz = 34 - k, 46 - k
        g.box(24, yy, zz, 25, yy + 2, zz + 1, C("darkwood", 3))
        if k % 3 == 0:
            g.box(25, yy, zz, 26, yy + 2, zz + 1, C("plasma", 6))
    fill(g, shell(["Body"], 1) & (y == 17), C("darkwood", 2))
    # helmet
    helm = dilate(region(HEAD), 1) & (y >= hy0 - 1)
    fill(g, helm, C("teal", 4))
    fill(g, helm & (y >= hy1 - 2), C("teal", 5))
    fill(g, helm & (x < 20) & (y < hy0 + 8), C("rust", 3))  # dented back
    g.box(29, 45, 30, 30, 48, 46, C("iron", 0))  # visor
    g.box(29, 39, 36, 30, 48, 40, C("iron", 0))
    g.box(29, 38, 31, 30, 44, 34, C("teal", 3)).box(29, 38, 42, 30, 44, 45, C("teal", 3))
    g.box(20, 50, 49, 24, 52, 51, C("iron", 2))  # rangefinder stalk
    g.box(23, 44, 50, 26, 51, 51, C("iron", 2))
    g.set(26, 47, 50, C("red", 7))
    # poncho over the left shoulder
    for yy in range(22, 37):
        w = (37 - yy) // 3
        g.box(15, yy, 22 - w, 26, yy + 1, 38 - (yy - 22) // 2, C("sand", 4 if yy % 4 else 3))
    g.box(15, 36, 22, 26, 37, 38, C("sand", 5))
    # mini jetpack
    g.box(9, 22, 32, 15, 33, 44, C("steel", 3))
    for zz in (32, 40):
        g.cylinder("y", 11, zz + 2, 2, 18, 22, C("iron", 2))
        g.cylinder("y", 11, zz + 2, 1.2, 18, 19, C("ember", 6))
    gloves(g, C("darkwood", 3), grow=1)
    boots(g, C("darkwood", 3), C("rust", 4), C("iron", 1), height=8)
    speck_rig(g, 204, 0.12, ramps=("teal", "rust", "sand"))
    return asset("characters-skins", "bounty-hunter", "Bounty Hunter", Part("skin space-bounty-hunter", g, pivot=PIVOT))
