"""Mummy pharaoh skin: clean linen wraps, a violet nemes, and toxic eyes."""
from _kit import C, FACE_X, Part, rig_canvas, xyz
from rigkit import PIVOT, body, region, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)

    # Quiet linen, with broad horizontal strips and a dark seam every few rows.
    wrap = body()
    g.where(wrap, C("sand", 6))
    band = (y + (z // 8) % 2) % 6
    g.where(wrap & (band <= 1), C("sand", 7))
    g.where(wrap & (band == 2), C("sand", 4))
    g.where(wrap & (band == 5), C("sand", 5))

    # Two small, grouped stains keep the cloth aged without filling it with noise.
    stain = wrap & (
        ((x >= 21) & (y >= 24) & (y < 26) & (z >= 32) & (z < 35))
        | ((x >= 17) & (y >= 9) & (y < 11) & (z >= 43) & (z < 46))
    )
    g.where(stain, C("khaki", 3))

    # A shadowed pair of eyes sits in the open face of the wraps.
    g.box(FACE_X, 46, 32, FACE_X + 1, 50, 36, C("iron", 1))
    g.box(FACE_X, 46, 41, FACE_X + 1, 50, 45, C("iron", 1))
    g.box(FACE_X, 47, 33, FACE_X + 1, 49, 35, C("toxic", 5))
    g.box(FACE_X, 47, 42, FACE_X + 1, 49, 44, C("toxic", 5))
    g.set(FACE_X, 48, 34, C("toxic", 7))
    g.set(FACE_X, 48, 43, C("toxic", 7))
    g.box(FACE_X, 51, 32, FACE_X + 1, 52, 36, C("iron", 2))
    g.box(FACE_X, 51, 41, FACE_X + 1, 52, 45, C("iron", 2))
    # A stitched mouth gap peeks through the lower face wraps.
    g.box(FACE_X, 40, 36, FACE_X + 1, 41, 40, C("iron", 2))
    for zz in (36, 39):
        g.set(FACE_X, 41, zz, C("bone", 6))

    # Aged violet nemes, banded in muted bronze instead of bright royal blue.
    nemes = (shell(["Head"], 1) & (y >= 50) & (x < FACE_X))
    nemes |= shell(["Head"], 1) & (x <= 20) & (y >= 36)
    g.where(nemes, C("purple", 3))
    g.where(nemes & ((y % 6) <= 1), C("gold", 3))
    g.where(nemes & ((y % 6) == 2), C("purple", 2))
    # A narrow dark edge frames the back of the cloth without hiding its bands.
    g.where(nemes & (x == 12) & ((y == 38) | (y == 54) | (z == 29) | (z == 48)), C("purple", 1))
    # Painted scarab cartouche gives the broad rear panel a clear focal mark.
    rear = nemes & (x == 12) & (y >= 38) & (y < 55) & (z >= 29) & (z < 49)
    g.where(rear & ((y == 38) | (y == 54) | (z == 29) | (z == 48)), C("gold", 4))
    g.box(12, 43, 35, 13, 49, 42, C("magenta", 5))
    g.box(12, 45, 33, 13, 48, 35, C("gold", 4))
    g.box(12, 45, 42, 13, 48, 44, C("gold", 4))
    g.box(12, 45, 37, 13, 48, 40, C("toxic", 5))
    g.set(12, 46, 38, C("toxic", 7))
    g.box(FACE_X - 2, 55, 26, FACE_X + 1, 57, 50, C("gold", 4))
    g.box(FACE_X + 1, 55, 37, FACE_X + 2, 59, 39, C("toxic", 4))
    g.set(FACE_X + 1, 58, 38, C("toxic", 7))

    # The matching lappets overlap the headcloth and hang onto the shoulders.
    for z0, z1 in ((24, 28), (48, 52)):
        g.box(18, 30, z0, 25, 40, z1, C("purple", 3))
        g.where((x >= 18) & (x < 25) & (y >= 30) & (y < 40) & (z >= z0) & (z < z1) & ((y % 6) <= 1), C("gold", 3))
        g.box(18, 30, z0, 25, 32, z1, C("gold", 4))

    # A violet collar and one magenta scarab give the torso a clear focal mark.
    collar = shell(["Chest"], 1) & (y >= 31) & (y < 36)
    g.where(collar, C("purple", 4))
    g.where(collar & ((z % 3) == 0), C("gold", 3))
    g.box(24, 31, 36, 25, 34, 40, C("magenta", 5))
    g.box(25, 32, 37, 26, 34, 39, C("toxic", 5))
    g.set(25, 33, 38, C("toxic", 7))

    # Equal wrist wraps mark both hands and keep the arm treatment balanced.
    forearms = region(["ForeArm.L", "ForeArm.R"])
    hands = region(["Hand.L", "Hand.R"])
    g.where(forearms & ((z <= 16) | (z >= 59)) & (y >= 28) & (y < 34), C("purple", 3))
    g.where(forearms & ((z <= 16) | (z >= 59)) & (y == 29), C("gold", 3))
    g.where(hands, C("sand", 7))
    g.where(hands & (((y + z // 8) % 5) == 0), C("sand", 4))

    return Asset(id="monster-characters-skins-mummy", pack="monster", category="characters-skins", name="Mummy Pharaoh",
                 root=Part("skin monster-mummy", g, pivot=PIVOT))
