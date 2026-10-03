"""Swamp witch skin: pale green skin with a hooked nose and a wart,
long black hair, a tall crooked hat with a purple band and buckle, a
purple ragged dress with a black corset belt, striped stockings and
pointed shoes."""
from _kit import C, FACE_X, Part, face, paint_body, rig_canvas, speck, xyz
from rigkit import PIVOT, leg_z_ranges, region, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    skin = C("lime", 3)
    paint_body(g, skin, C("purple", 3), C("purple", 3), skin, C("iron", 1), C("iron", 1))
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]) & ((y % 2) == 0), C("purple", 5))  # striped stockings
    g.where(region(["Body"]) & (y >= 17) & (y < 21), C("iron", 1))  # corset belt
    g.box(24, 18, 37, 25, 20, 39, C("gold", 4))
    # dress skirt flaring over the legs
    for yy in range(8, 18):
        r = 1 + (18 - yy) // 3
        g.where((y == yy) & (x >= 16 - r) & (x < 24 + r) & (z >= 29 - r) & (z < 47 + r), C("purple", 2))
    g.carve((y == 8) & (((x + z) % 3) == 0) & (g.a == C("purple", 2)))
    # hair: long black hair down the back
    hair = shell(["Head"], 1) & (x < FACE_X) & (y >= 38)
    g.where(hair, C("iron", 0))
    g.where(region(["Head"]) & (x <= 15), C("iron", 0))
    g.box(12, 24, 28, 15, 38, 48, C("iron", 0))
    face(g, C("bone", 7), C("forest", 2), pupil=C("purple", 4), brow=C("iron", 0), mouth_w=4)
    g.box(FACE_X + 1, 43, 37, FACE_X + 4, 46, 39, skin)  # hooked nose
    g.box(FACE_X + 3, 42, 37, FACE_X + 4, 43, 39, skin)
    g.set(FACE_X + 2, 45, 39, C("lime", 1))  # wart
    # tall crooked hat
    g.box(10, 59, 22, 32, 61, 54, C("iron", 1))  # brim
    for k in range(26):
        r = 9 - k * 0.33
        cx, cz = 21 - k * 0.12 + (k > 18) * (k - 18) * 0.6, 38 - (k > 20) * (k - 20) * 0.5
        g.box(cx - r, 61 + k, cz - r, cx + r, 62 + k, cz + r, C("iron", 2))
    g.box(12, 61, 29, 30, 64, 47, C("purple", 4))  # band
    g.box(28, 61, 36, 31, 64, 40, C("gold", 5))  # buckle
    g.box(29, 62, 37, 31, 63, 39, C("purple", 4))
    for z0, z1 in leg_z_ranges().values():  # pointed shoes
        g.box(15, 0, z0, 27, 4, z1, C("iron", 1))
        g.box(27, 1, z0 + 3, 30, 3, z1 - 3, C("iron", 1))
        g.box(29, 3, z0 + 3, 30, 4, z1 - 3, C("iron", 2))
    speck(g, 541, 0.05)
    return Asset(id="monster-characters-skins-witch", pack="monster", category="characters-skins", name="Swamp Witch",
                 root=Part("skin monster-witch", g, pivot=PIVOT))
