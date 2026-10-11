"""Dark knight skin: blued gunmetal plate with gold trim over a crimson
tabard with a bone skull, a horned great helm with a sculpted visor, a
gold crest and a glowing ember eye slit, layered spiked pauldrons, clawed
gauntlets, plate tassets, knee cops, steel greaves and sabatons, and a
crimson cape with folds, a gold collar and a clean dagged hem."""
import numpy as np

from _kit import HY1, FACE_X, boots, rig_idx
from rigkit import PIVOT, body, dilate, region, rig_grid, shell
from voxgrid import C, Asset, Part

SKULL = [  # rows top to bottom, 7 wide ('o' = eye socket glow)
    ".#####.",
    "#######",
    "#oo#oo#",
    "#######",
    ".##.##.",
    ".#.#.#.",
]


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    GOLD, GOLD_D = C("gold", 5), C("gold", 3)
    # base: mid-value blued steel so the figure reads against dark backgrounds
    g.where(region(["Chest", "Body"]), C("steel", 2))
    g.where(region(["Arm.L", "Arm.R"]), C("steel", 3))
    g.where(region(["ForeArm.L", "ForeArm.R"]), C("steel", 2))
    g.where(region(["Hand.L", "Hand.R"]), C("iron", 5))
    g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), C("steel", 2))
    g.where(region(["Head"]), C("iron", 3))
    # ---------------------------------------------------------------- helm
    helm = shell(["Head"], 1)
    g.where(helm, C("steel", 3))
    g.where(helm & (y >= HY1), C("steel", 4))  # lit crown
    g.where(helm & (y <= 37), C("steel", 1))  # dark lower rim
    g.where(helm & (y == 38), GOLD)  # gold rim band
    g.where(helm & (x < 29) & ((x == 20) | (x == 21)) & (y > 38), C("steel", 2))  # plate seam down the sides
    g.where(helm & (x < 29) & (y == 49), C("steel", 2))  # brow seam round the helm
    for zz in (26, 49):  # rivets on the sides
        for xx in (15, 18, 24, 27):
            g.set(xx, 41, zz, GOLD).set(xx, 52, zz, GOLD)
    for zz in (29, 33, 42, 46):  # rivets on the back
        g.set(12, 41, zz, GOLD).set(12, 52, zz, GOLD)
    # crest: a gold ridge from the brow over the crown to the nape
    g.box(14, 60, 37, 29, 61, 39, GOLD)
    g.box(14, 60, 37, 29, 61, 38, C("gold", 6))
    g.box(12, 44, 37, 13, 60, 39, GOLD)  # down the back
    g.box(FACE_X + 1, 50, 37, FACE_X + 2, 60, 39, GOLD)  # down the brow
    # visor: a raised brow guard, a glowing eye slit, a nasal ridge and a vented breath plate
    F = FACE_X + 1  # the helm's front plate
    g.box(F, 39, 28, F + 1, 49, 48, C("steel", 4))  # visor plate
    g.box(F, 46, 29, F + 1, 48, 47, C("iron", 0))  # eye slit
    g.box(F, 46, 31, F + 1, 48, 35, C("ember", 4)).box(F, 46, 41, F + 1, 48, 45, C("ember", 4))
    g.box(F, 47, 32, F + 1, 48, 34, C("ember", 6)).box(F, 47, 42, F + 1, 48, 44, C("ember", 6))
    g.box(F + 1, 48, 28, F + 2, 50, 48, C("steel", 6))  # brow guard
    g.box(F + 1, 48, 28, F + 2, 49, 48, C("steel", 3))
    g.box(F + 1, 39, 37, F + 2, 48, 39, C("steel", 6))  # nasal ridge
    g.box(F + 1, 39, 37, F + 2, 40, 39, GOLD)
    for zz in (30, 32, 34, 41, 43, 45):  # breath vents
        g.box(F, 40, zz, F + 1, 45, zz + 1, C("iron", 1))
    # horns: thick curved horns rooted in gold mounts, ridged, pale at the tips
    for side in (-1, 1):
        zr = 26 if side < 0 else 49
        pts = [(21.5, 51.5, zr + 0.5), (21.5, 53.5, zr + 0.5 + side * 4.0), (22.0, 56.5, zr + 0.5 + side * 7.5),
               (23.5, 60.5, zr + 0.5 + side * 9.0), (25.5, 64.0, zr + 0.5 + side * 8.5)]
        rads = (2.4, 2.0, 1.6, 1.1)
        for k in range(4):
            g.line(pts[k], pts[k + 1], rads[k], C("bone", 4 + k))
        g.box(19, 49, zr - (1 if side < 0 else -1), 24, 54, zr + (0 if side < 0 else 2), GOLD_D)  # gold mount
        g.box(20, 50, zr - (1 if side < 0 else -1), 23, 53, zr + (0 if side < 0 else 2), GOLD)
    # ---------------------------------------------------------------- torso
    cuirass = shell(["Chest", "Body"], 1)
    g.where(cuirass & (y >= 17), C("steel", 3))
    g.where(cuirass & (y >= 17) & (np.abs(z - 37.5) < 1), C("steel", 5))  # lit centre ridge
    g.where(cuirass & (y >= 17) & (x <= 16), C("steel", 2))  # back plate
    g.where(cuirass & (y == 35), GOLD)  # gold neck rim
    g.where(dilate(region(["Chest"]), 2) & ~body() & ~cuirass & (y >= 34) & (y < 37) & (x > 14) & (z > 30) & (z < 46), C("steel", 5))  # gorget
    tab = cuirass & (np.abs(z - 37.5) < 6) & (x >= 23) & (y >= 17)
    g.where(tab, C("red", 3))
    g.where(tab & ((z == 32) | (z == 43)), GOLD)  # gold edging
    g.where(tab & (y == 34), GOLD)
    for r, row in enumerate(SKULL):  # bone skull emblem with ember eyes
        for k, ch in enumerate(row):
            if ch != ".":
                g.set(24, 30 - r, 34 + k, C("bone", 6) if ch == "#" else C("ember", 5))
    # belt with a gold buckle
    g.where(shell(["Body"], 1) & (y >= 16) & (y < 18), C("darkwood", 3))
    g.box(24, 16, 36, 26, 18, 40, GOLD)
    g.box(25, 16, 37, 26, 18, 39, C("gold", 6))
    # tassets: two rows of plates with a gold hem, and the tabard hanging in front
    tas = shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 11) & (y < 16)
    g.where(tas, C("steel", 4))
    g.where(tas & (y == 13), C("steel", 2))
    g.where(tas & (y == 11), GOLD_D)
    g.box(24, 8, 33, 26, 16, 43, C("red", 3))
    g.box(25, 8, 33, 26, 16, 34, GOLD).box(25, 8, 42, 26, 16, 43, GOLD)
    g.box(24, 8, 33, 26, 9, 43, GOLD)
    g.box(25, 10, 37, 26, 15, 39, C("red", 4))  # a lit fold down the middle
    # ---------------------------------------------------------------- arms
    for z0, z1, zc in ((21, 32, 23), (44, 55, 52)):  # layered spiked pauldrons
        pad = dilate(region(["Arm.L" if z0 < 30 else "Arm.R"]) | region(["Chest"]), 3) & ~body() & (z >= z0) & (z < z1) & (y >= 30)
        g.where(pad, C("steel", 4))
        g.where(pad & (y >= 36), C("steel", 5))
        g.where(pad & (y == 30), GOLD)
        g.where(pad & (y == 33), C("steel", 2))  # lame seam
        side = -1 if z0 < 30 else 1
        for xs, lift in ((18.5, 0.0), (22.0, -1.0)):
            g.line((xs, 36.5, zc + 0.5), (xs, 41.5 + lift, zc + 0.5 + side * 3.0), 1.0, C("bone", 5))
            g.line((xs, 40.0 + lift, zc + 0.5 + side * 2.2), (xs, 41.6 + lift, zc + 0.5 + side * 3.1), 0.7, C("bone", 7))
    arms = region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"])
    g.where(arms & ((z == 21) | (z == 54)), C("steel", 6))  # elbow cops
    g.where(arms & ((z == 20) | (z == 55)), C("steel", 2))
    gaunt = shell(["Hand.L", "Hand.R", "ForeArm.L", "ForeArm.R"], 1) & ((z <= 16) | (z >= 59))
    g.where(gaunt, C("iron", 5))
    g.where(gaunt & ((z == 16) | (z == 59)), GOLD)  # gold cuff
    g.where(gaunt & (y == 35) & ((z <= 13) | (z >= 62)), C("steel", 5))  # knuckle plates
    for zz in (8, 67):  # claws
        for yy in (29, 31, 33):
            g.set(22, yy, zz, C("bone", 6))
    # ---------------------------------------------------------------- legs
    legs = shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1)
    g.where(legs & (y >= 6) & (y < 11), C("steel", 3))  # greaves
    g.where(legs & (y >= 9) & (y < 11), C("steel", 5))  # knee cops
    g.where(legs & (y == 10) & (x >= 24) & ((z == 33) | (z == 42)), GOLD)
    boots(g, C("iron", 5), cuff=C("steel", 5), top=6, toe=C("steel", 3))
    # ---------------------------------------------------------------- cape
    for yy in range(8, 35):
        spread = 9 + (34 - yy) // 6
        for zz in range(38 - spread, 38 + spread):
            tooth = (zz // 3) % 2  # dagged hem: alternate 3-wide teeth, each joined to the cloth above
            if yy < 8 + 2 * tooth:
                continue
            fold = zz % 4
            col = C("red", 2) if fold == 0 else C("red", 4) if fold == 2 else C("red", 3)
            g.set(14, yy, zz, col)
            g.set(15, yy, zz, C("red", 2))
    g.box(14, 33, 28, 16, 35, 48, GOLD)  # gold collar bar
    g.box(14, 33, 30, 15, 35, 32, C("red", 5)).box(14, 33, 44, 15, 35, 46, C("red", 5))  # garnet clasps
    return Asset(id="fantasy-characters-skins-dark-knight", pack="fantasy", category="characters-skins", name="Dark Knight",
                 root=Part("skin fantasy-dark-knight", g, pivot=PIVOT))
