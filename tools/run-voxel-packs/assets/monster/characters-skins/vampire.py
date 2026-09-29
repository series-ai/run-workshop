"""Vampire count skin: pale grey-violet face with red eyes and fangs,
slicked black hair with a widow's peak, pointed ears, a black tailcoat
over a crimson waistcoat with a gold medallion, and a high-collared cape
lined in red."""
from _kit import C, FACE_X, Part, face, paint_body, rig_canvas, speck, xyz
from rigkit import PIVOT, leg_z_ranges, region, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    skin = C("gray", 6)
    paint_body(g, skin, C("iron", 2), C("iron", 2), C("gray", 6), C("iron", 1), C("iron", 1))
    g.where(region(["Chest", "Body"]) & (x >= 22) & (abs(z + 0.5 - 38) < 4), C("blood", 3))  # waistcoat
    g.where(region(["Chest"]) & (x >= 22) & (abs(z + 0.5 - 38) < 1) & (y >= 26), C("bone", 7))  # shirt
    g.box(24, 27, 37, 25, 30, 39, C("gold", 5))  # medallion
    g.set(24, 28, 37, C("blood", 6))
    g.where(region(["Body"]) & (y == 17), C("iron", 3))
    g.where(region(["ForeArm.L", "ForeArm.R"]) & ((z < 17) | (z > 58)), C("bone", 7))  # shirt cuffs
    # hair: slick cap over the top and back, widow's peak
    hair = region(["Head"]) & ((y >= 55) | (x <= 16) | ((y >= 52) & ((x <= 22) | (abs(z + 0.5 - 38) > 9))))
    g.where(hair, C("navy", 0))
    g.where(region(["Head"]) & (x >= 26) & (y >= 52) & (abs(z + 0.5 - 38) <= 2 + (58 - y)) & (y < 55), skin)
    g.box(FACE_X, 52, 37, FACE_X + 1, 55, 39, C("navy", 0))  # peak
    face(g, C("red", 5), C("blood", 2), pupil=C("red", 7), brow=C("navy", 0), mouth_w=6)
    g.box(FACE_X, 41, 35, FACE_X + 1, 42, 36, C("bone", 7)).box(FACE_X, 41, 40, FACE_X + 1, 42, 41, C("bone", 7))  # fangs
    g.box(FACE_X, 40, 30, FACE_X + 1, 42, 32, C("gray", 5)).box(FACE_X, 40, 44, FACE_X + 1, 42, 46, C("gray", 5))  # cheekbones
    for zc in (26, 49):  # pointed ears
        g.box(19, 46, zc, 23, 50, zc + 1, skin)
        g.box(18, 50, zc, 20, 53, zc + 1, skin)
    # cape: high collar and cloak behind
    collar = shell(["Chest"], 2) & (y >= 33) & (y < 42) & (x <= 21) & ~region(["Head"])
    g.where(collar, C("blood", 2))
    g.where(collar & (x == 21), C("red", 3))
    for yy in range(4, 36):
        spread = 9 + (36 - yy) // 5
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("iron", 1))
        g.box(15, yy, 38 - spread + 1, 16, yy + 1, 38 + spread - 1, C("red", 3))
    g.carve((x < 16) & (y < 8) & (((z // 3) % 2) == 0))  # scalloped hem
    for z0, z1 in leg_z_ranges().values():  # pointed boots
        g.box(15, 0, z0, 27, 4, z1, C("iron", 1))
        g.box(27, 0, z0 + 2, 29, 2, z1 - 2, C("iron", 1))
        g.box(15, 4, z0, 25, 5, z1, C("gold", 3))
    speck(g, 511, 0.05)
    return Asset(id="monster-characters-skins-vampire", pack="monster", category="characters-skins", name="Vampire Count",
                 root=Part("skin monster-vampire", g, pivot=PIVOT))
