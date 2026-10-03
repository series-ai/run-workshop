"""Mummy skin: every part wrapped in yellowed linen bandages with dark
gaps, loose trailing strips, one glowing green eye in the dark slit, a gold
scarab collar and a pharaoh's striped nemes headcloth."""
from _kit import C, FACE_X, Part, rig_canvas, speck, xyz
from rigkit import PIVOT, body, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    wrap = body()
    g.where(wrap, C("sand", 5))
    g.where(wrap & (((y + (x + z) // 4) % 3) == 0), C("sand", 4))
    g.where(wrap & (((y * 3 + x + z * 2) % 23) == 0), C("khaki", 3))  # grime
    g.where(wrap & (((y * 5 + x * 3 + z) % 37) == 0), C("iron", 2))  # gaps
    # face slit + eyes
    g.box(FACE_X, 46, 31, FACE_X + 1, 50, 46, C("iron", 1))
    g.box(FACE_X, 47, 41, FACE_X + 1, 49, 44, C("toxic", 6))
    g.box(FACE_X, 47, 32, FACE_X + 1, 49, 35, C("iron", 0))
    # nemes headcloth
    nemes = shell(["Head"], 1) & (y >= 50) & (x < FACE_X)
    nemes |= shell(["Head"], 1) & (x <= 20) & (y >= 36)
    g.where(nemes, C("blue", 3))
    g.where(nemes & ((y % 3) == 0), C("gold", 4))
    g.box(FACE_X - 2, 55, 26, FACE_X + 1, 57, 50, C("gold", 5))  # brow band
    g.box(FACE_X + 1, 55, 37, FACE_X + 2, 59, 39, C("gold", 6))  # uraeus
    for zc in (25, 50):  # lappets down the chest sides
        g.box(19, 30, zc - (1 if zc < 38 else 0), 26, 40, zc + (1 if zc > 38 else 0) + 0, C("blue", 3))
        g.box(19, 30, zc - (1 if zc < 38 else 0), 26, 31, zc + (1 if zc > 38 else 0), C("gold", 4))
    collar = shell(["Chest"], 1) & (y >= 31) & (y < 36)
    g.where(collar, C("gold", 4))
    g.where(collar & ((z % 2) == 0), C("teal", 4))
    g.box(24, 31, 37, 25, 33, 39, C("teal", 5))  # scarab
    for zz, top in ((20, 31), (57, 30)):  # trailing strips
        g.box(20, top - 8, zz, 21, top, zz + 1, C("sand", 6))
    g.box(22, 8, 30, 23, 15, 31, C("sand", 6))
    speck(g, 521, 0.05)
    return Asset(id="monster-characters-skins-mummy", pack="monster", category="characters-skins", name="Mummy Pharaoh",
                 root=Part("skin monster-mummy", g, pivot=PIVOT))
