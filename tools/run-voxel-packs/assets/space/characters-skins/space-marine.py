"""Space marine skin: bulky olive power armour with thick plates, huge
pauldrons with hazard trim, a full helmet with a glowing red T-visor, a
power pack on the back, armoured gauntlets and heavy boots."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, fill, gloves, head_box, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset, stripes


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    base_body(g, C("skin", 4), C("khaki", 4), legs=C("khaki", 3))
    armor = shell(["Chest", "Body"], 2) & (y < hy0)
    fill(g, armor, C("khaki", 4))
    fill(g, armor & (x >= 24) & (y >= 22), C("khaki", 5))  # breastplate
    fill(g, armor & (x >= 24) & (y >= 26) & (y < 28), C("iron", 2))
    fill(g, armor & ((y == 17) | (y == 18)), C("iron", 3))
    g.box(25, 17, 36, 26, 19, 40, C("gold", 5))
    fill(g, shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1), C("khaki", 3))
    fill(g, shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y >= 6), C("khaki", 4))
    fill(g, shell(["Leg.L", "Leg.R"], 1) & (y >= 9) & (y < 11) & (x >= 23), C("steel", 5))
    # pauldrons
    for z0, z1 in ((23, 31), (45, 53)):
        g.box(14, 33, z0, 26, 38, z1, C("khaki", 5))
        g.box(15, 38, z0 + 1, 25, 39, z1 - 1, C("khaki", 5))
        stripes(g, (y == 33) & (z >= z0) & (z < z1) & (x >= 14) & (x < 26), C("gold", 5), C("iron", 1), 2, d=(1, 0, 1))
    # helmet: full, with T visor
    helm = dilate(region(HEAD), 1) & (y >= hy0 - 1)
    fill(g, helm, C("khaki", 4))
    fill(g, helm & (y >= hy1 - 3), C("khaki", 5))
    g.box(29, 46, 31, 30, 49, 45, C("red", 5))  # visor bar
    g.box(29, 40, 37, 30, 49, 39, C("red", 5))  # visor stem
    g.box(29, 47, 32, 30, 48, 44, C("red", 7))
    g.box(29, 38, 33, 30, 42, 35, C("iron", 2)).box(29, 38, 41, 30, 42, 43, C("iron", 2))  # breathers
    g.box(16, hy1 + 1, 37, 26, hy1 + 3, 39, C("iron", 2))  # crest
    # power pack
    g.box(8, 18, 30, 14, 34, 46, C("khaki", 3))
    g.box(7, 20, 33, 8, 32, 43, C("iron", 2))
    for zz in (32, 43):
        g.box(9, 34, zz, 12, 38, zz + 1, C("iron", 2))
    g.box(8, 30, 36, 9, 32, 40, C("toxic", 7))
    gloves(g, C("iron", 3), grow=1)
    boots(g, C("iron", 3), C("khaki", 5), C("iron", 1), height=8, pad=1)
    speck_rig(g, 203, 0.1, ramps=("khaki",))
    return asset("characters-skins", "space-marine", "Space Marine", Part("skin space-space-marine", g, pivot=PIVOT))
