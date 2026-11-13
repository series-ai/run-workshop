"""Frankenstein's monster skin: grey-green skin with a flat-topped black
fringe, a stitched forehead scar, neck bolts, heavy brows, a too-short
patched coat with bare wrists, and huge platform boots."""
from _kit import C, FACE_X, Part, face, paint_body, rig_canvas, speck, xyz
from rigkit import PIVOT, leg_z_ranges, region
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    skin = C("khaki", 5)
    paint_body(g, skin, C("iron", 3), C("iron", 3), skin, C("iron", 2), C("iron", 1))
    g.where(region(["ForeArm.L", "ForeArm.R"]) & ((z < 18) | (z > 57)), skin)  # sleeves too short
    g.where(region(["Chest"]) & (x >= 22) & ((z == 33) | (z == 42)), C("iron", 4))  # lapels
    g.box(23, 22, 31, 24, 27, 35, C("rust", 2))  # patch
    g.where(region(["Body"]) & (y == 17), C("darkwood", 2))
    # hair: flat top and ragged fringe
    g.where(region(["Head"]) & (y >= 56), C("iron", 0))
    g.box(13, 58, 27, 29, 61, 49, C("iron", 0))  # flat top
    for zz in range(27, 49, 2):
        g.box(FACE_X, 54 - (zz % 3), zz, FACE_X + 1, 56, zz + 1, C("iron", 0))  # fringe
    g.where(region(["Head"]) & (x <= 15) & (y >= 44), C("iron", 0))
    face(g, C("bone", 7), C("khaki", 2), pupil=C("iron", 0), brow=C("iron", 0), mouth_w=8)
    g.box(FACE_X, 51, 30, FACE_X + 1, 52, 46, C("khaki", 3))  # brow ridge
    for zz in range(31, 46, 2):  # forehead stitches
        g.set(FACE_X, 53, zz, C("iron", 1))
    g.box(FACE_X, 53, 31, FACE_X + 1, 54, 46, C("khaki", 3))
    for zz in range(31, 46, 3):
        g.set(FACE_X, 53, zz, C("iron", 1)).set(FACE_X, 54, zz, C("iron", 1))
    for zc in (25, 50):  # neck bolts
        g.box(18, 36, zc, 21, 39, zc + 1, C("steel", 5))
    g.box(FACE_X, 44, 43, FACE_X + 1, 45, 45, C("khaki", 3))
    for z0, z1 in leg_z_ranges().values():  # platform boots
        g.box(14, 0, z0 - 1, 28, 7, z1 + 1, C("iron", 1))
        g.box(14, 0, z0 - 1, 28, 2, z1 + 1, C("iron", 2))
        g.box(14, 7, z0 - 1, 26, 8, z1 + 1, C("steel", 4))
    speck(g, 531, 0.06)
    return Asset(id="monster-characters-skins-frankenstein", pack="monster", category="characters-skins", name="Frankenstein's Monster",
                 root=Part("skin monster-frankenstein", g, pivot=PIVOT))
