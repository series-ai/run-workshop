"""Starship captain skin: a navy dress uniform with gold piping, fringed
epaulettes, a red command sash with medals, white gloves and polished
boots, plus a peaked captain's cap with a gold star badge and a neat
moustache."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, face, fill, gloves, head_box, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    base_body(g, C("skin", 5), C("navy", 4), legs=C("navy", 3))
    face(g, eye=C("navy", 1), mouth=C("skindark", 3), brow=C("iron", 2))
    g.box(28, 43, 35, 29, 44, 41, C("iron", 2))  # moustache
    fill(g, (x >= 13) & (x < 16) & (y >= 40) & (y < 56) & region(HEAD), C("iron", 2))  # hair at the back
    fill(g, region(HEAD) & ((z == 27) | (z == 48)) & (y >= 44) & (y < 54), C("iron", 2))  # sideburns
    coat = shell(["Chest", "Body"], 1) & (y < hy0)
    fill(g, coat, C("navy", 4))
    fill(g, coat & (x >= 24) & (z >= 37) & (z < 39), C("gold", 5))  # button placket
    for yy in range(19, 34, 3):
        g.set(24, yy, 36, C("gold", 6)).set(24, yy, 39, C("gold", 6))
    fill(g, coat & ((y == 16) | (y == 17)), C("iron", 2))
    g.box(24, 16, 36, 25, 18, 40, C("gold", 6))
    # sash + medals
    for k in range(16):
        g.box(24, 34 - k, 30 + k, 25, 36 - k, 32 + k, C("red", 4))
    for zz, col in ((40, "gold"), (42, "sky"), (44, "red")):
        g.box(25, 29, zz, 26, 31, zz + 1, C(col, 6))
    # epaulettes with fringe
    for z0, z1 in ((24, 30), (46, 52)):
        g.box(15, 35, z0, 25, 37, z1, C("gold", 5))
        for zz in range(z0, z1, 2):
            g.box(15, 33, zz, 25, 35, zz + 1, C("gold", 4))
    fill(g, shell(["ForeArm.L", "ForeArm.R"], 1) & ((z == 18) | (z == 57)), C("gold", 5))  # cuff rings
    # peaked cap
    cap = dilate(region(HEAD), 1) & (y >= hy1 - 5)
    fill(g, cap, C("navy", 3))
    g.box(13, hy1 + 1, 26, 30, hy1 + 3, 50, C("navy", 4))  # crown
    g.box(12, hy1 - 5, 26, 30, hy1 - 4, 50, C("iron", 1))  # band
    g.box(28, hy1 - 6, 29, 33, hy1 - 5, 47, C("iron", 1))  # visor peak
    g.box(29, hy1 - 3, 36, 30, hy1 + 1, 40, C("gold", 6))  # star badge
    g.set(29, hy1 - 1, 35, C("gold", 6)).set(29, hy1 - 1, 40, C("gold", 6))
    g.box(29, hy1 - 4, 30, 30, hy1 - 3, 46, C("gold", 5))  # gold cord
    gloves(g, C("bone", 7), grow=1)
    boots(g, C("iron", 2), C("iron", 3), C("iron", 0), height=8)
    speck_rig(g, 205, 0.05, ramps=("navy",))
    return asset("characters-skins", "starship-captain", "Starship Captain", Part("skin space-starship-captain", g, pivot=PIVOT))
