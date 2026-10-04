"""Monster avatar parts (39 parts across the PN slots) and eight monster
clips (48–55) on the PN rig. Rig space: faces +X, +Y up, right arm +Z;
the PN head is the box x13–28, y37–58, z27–48 with the face plate at x 28."""
import math

import numpy as np

from _kit import C, FACE_X, rig_canvas, rig_part, xyz
from rigkit import leg_z_ranges, region, shell
from voxgrid import Asset, Clip, Part

F = FACE_X + 1  # the plane just in front of the face plate


def canvas():
    g = rig_canvas()
    return g, xyz(g)


# ------------------------------------------------------------------ headwear
def witch_hat():
    g, (x, y, z) = canvas()
    g.box(9, 59, 21, 33, 60, 56, C("iron", 1))
    g.box(10, 60, 22, 32, 61, 55, C("iron", 2))
    for k in range(24):
        r = 9 - k * 0.35
        cx = 21 - k * 0.1 - max(0, k - 16) * 0.7
        cz = 38 + max(0, k - 18) * 0.4
        g.box(cx - r, 61 + k, cz - r, cx + r, 62 + k, cz + r, C("iron", 2 if k % 4 else 1))
    g.box(12, 61, 29, 30, 64, 47, C("purple", 4))
    g.box(29, 61, 36, 31, 64, 40, C("gold", 5))
    g.set(30, 62, 37, C("purple", 4)).set(30, 62, 38, C("purple", 4))
    g.box(24, 64, 44, 26, 67, 46, C("toxic", 5))  # tucked vial
    return rig_part("headwear monster-1", g, "Crooked Witch Hat", hides_hair=True)


def hunter_hat():
    g, (x, y, z) = canvas()
    # Short brim and taller crown give the hat a clear, compact profile.
    g.box(14, 58, 25, 30, 60, 51, C("iron", 0))
    g.box(15, 59, 26, 29, 61, 50, C("purple", 3))
    brim_edge = (x >= 14) & (x < 30) & (z >= 25) & (z < 51) & ((x == 14) | (x == 29) | (z == 25) | (z == 50))
    g.where((y == 60) & brim_edge, C("iron", 2))
    g.where((y == 58) & brim_edge, C("iron", 0))
    g.box(28, 57, 30, 29, 59, 46, C("iron", 0))
    # Taper each crown course. The upper edge steps inward and shifts one
    # voxel, so the crown reads as shaped cloth instead of a tall box.
    for k in range(10):
        inset = k // 4
        lean = k // 7
        g.box(17 + inset + lean, 61 + k, 29 + inset, 28 - inset + lean, 62 + k, 47 - inset,
              C("stone", 4 if k % 3 else 3))
    g.where((y >= 65) & (y <= 69) & (x == 26) & (z >= 34) & (z <= 42), C("purple", 5))
    # A single framed band and a small bone charm hold the focal detail.
    g.box(17, 62, 29, 28, 65, 47, C("magenta", 3))
    g.box(18, 63, 30, 27, 64, 46, C("purple", 4))
    g.box(26, 62, 37, 28, 65, 41, C("bone", 6))
    g.box(28, 63, 38, 29, 64, 40, C("toxic", 6))
    g.set(29, 63, 39, C("toxic", 7))
    return rig_part("headwear monster-2", g, "Hunter's Wide Brim", hides_hair=True)


def top_hat():
    g, (x, y, z) = canvas()
    g.box(10, 59, 24, 32, 60, 53, C("iron", 1))
    g.box(14, 60, 28, 28, 74, 49, C("iron", 2))
    g.box(13, 73, 27, 29, 74, 50, C("iron", 3))
    g.box(14, 60, 28, 28, 63, 49, C("purple", 3))
    g.box(28, 60, 36, 29, 63, 40, C("gold", 5))  # bat pin
    g.set(28, 62, 35, C("gold", 5)).set(28, 62, 40, C("gold", 5))
    g.box(20, 63, 48, 22, 70, 49, C("bone", 6))  # tucked card
    return rig_part("headwear monster-3", g, "Undertaker's Top Hat", hides_hair=True)


def horned_helm():
    g, (x, y, z) = canvas()
    cap = shell(["Head"], 1) & (y >= 50)
    g.where(cap, C("iron", 2))
    g.where(cap & (y == 50), C("iron", 0))
    g.where(cap & (y >= 55) & ((z % 5) == 0), C("purple", 3))
    g.where(cap & (x >= 24) & (y >= 54) & (z >= 31) & (z < 45), C("bone", 5))
    g.box(F - 1, 50, 36, F + 1, 58, 40, C("bone", 6))
    g.box(F, 54, 37, F + 2, 56, 39, C("toxic", 5))
    for s_, zc in ((-1, 26), (1, 49)):
        for k in range(10):  # ram-like horns curving out, up and forward
            a = k / 9
            zz = zc + s_ * (2 + 7 * math.sin(a * 2.2))
            yy = 52 + 12 * math.sin(a * 1.6)
            xx = 18 + 10 * a
            r = 2.2 - a * 1.4
            g.box(xx - r, yy - r, zz - r, xx + r, yy + r, zz + r, C("bone", 6 - int(a * 3)))
            if k in (3, 6):
                g.set(round(xx), round(yy), round(zz), C("magenta", 4))
    return rig_part("headwear monster-4", g, "Horned Bone Helm", hides_hair=True)


def pumpkin_head():
    g, (x, y, z) = canvas()
    sh = shell(["Head"], 2)
    g.where(sh, C("orange", 4))
    # Broad vertical ribs wrap the whole pumpkin, with darker valleys and a
    # lighter crown. This keeps the back and side faces designed as well.
    center_z = 38.0
    rib_z = np.cos((z + 0.5 - center_z) / 11.0 * math.pi * 2)
    rib_x = np.cos((x + 0.5 - 21.0) / 8.0 * math.pi * 2)
    rib = np.maximum(rib_z, rib_x)
    g.where(sh & (rib < -0.72), C("ember", 3))
    g.where(sh & (rib > 0.72), C("orange", 6))
    g.where(sh & (y >= 58), C("orange", 5))
    g.where(sh & (y == 38), C("ember", 2))
    front = sh & (x >= F)
    # Deep, dark carved sockets with a toxic inner glow.
    eyes = front & (y >= 47) & (y < 52) & (((z >= 31) & (z < 36)) | ((z >= 41) & (z < 46)))
    g.where(eyes, C("iron", 0))
    g.where(front & (y >= 48) & (y < 50) & (((z >= 32) & (z < 35)) | ((z >= 42) & (z < 45))), C("toxic", 6))
    mouth = front & (y >= 40) & (y < 44) & (z >= 31) & (z < 46) & ((z % 3) != 0)
    g.where(mouth, C("iron", 0))
    g.where(front & (y == 44) & (z >= 33) & (z < 44) & ((z % 2) == 0), C("ember", 5))
    g.box(18, 61, 35, 23, 66, 40, C("forest", 2))
    g.box(21, 64, 39, 26, 65, 43, C("leaf", 4))
    g.box(22, 63, 39, 24, 67, 41, C("forest", 3))
    return rig_part("headwear monster-5", g, "Jack-o'-Lantern Head", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def wolf_hood():
    g, (x, y, z) = canvas()
    hood = shell(["Head"], 1) & ((y >= 53) | (x <= 18)) & (y >= 37)
    g.where(hood, C("stone", 4))
    g.where(hood & (y == 53), C("stone", 3))
    g.box(24, 57, 33, 33, 62, 43, C("stone", 5))  # snout over the forehead
    g.box(31, 59, 36, 34, 62, 40, C("iron", 1))
    g.box(26, 58, 33, 31, 59, 43, C("bone", 6))  # teeth
    for zc in (30, 45):
        g.box(26, 61, zc - 1, 28, 62, zc + 1, C("ember", 6))
        for k in range(6):
            g.box(17, 60 + k, zc - 2 + k // 3, 22, 61 + k, zc + 2 - k // 3, C("stone", 3))
    return rig_part("headwear monster-6", g, "Wolf Pelt Hood", hides_hair=True)


# ------------------------------------------------------------------ hair
def slick_hair():
    g, (x, y, z) = canvas()
    h = shell(["Head"], 1) & (((y >= 52) & (x <= 26)) | (x <= 15)) & (y >= 40)
    h |= shell(["Head"], 1) & (y >= 58)
    g.where(h, C("iron", 0))
    g.where(h & ((z % 5) == 0), C("purple", 2))
    g.box(F - 1, 52, 37, F, 58, 39, C("iron", 0))
    g.box(F - 2, 55, 34, F - 1, 58, 42, C("purple", 2))
    return rig_part("hair monster-1", g, "Slicked Count Hair")


def flat_top():
    g, (x, y, z) = canvas()
    # Keep the hair tucked under headwear. Paint the side and rear hair only.
    h = shell(["Head"], 1) & (y >= 49) & ((x <= 18) | (z <= 27) | (z >= 48))
    g.where(h, C("iron", 0))
    g.where(h & ((z % 5) == 0), C("purple", 3))
    g.box(17, 53, 27, 19, 57, 29, C("iron", 1))
    g.box(17, 53, 47, 19, 57, 49, C("iron", 1))
    return rig_part("hair monster-2", g, "Flat Top Fringe")


def mad_hair():
    g, (x, y, z) = canvas()
    tuft = shell(["Head"], 2) & (y >= 46) & (x <= 24) & ((abs(z + 0.5 - 38) > 7) | (x <= 16))
    g.where(tuft & ((((y // 3) + (z // 4)) % 3) != 0), C("gray", 7))  # blocky wild tufts
    for zc in (24, 51):
        g.box(16, 52, zc, 22, 58, zc + 2, C("gray", 7))
    return rig_part("hair monster-3", g, "Mad Scientist Hair")


# ------------------------------------------------------------------ facial hair
def fangs():
    g, _ = canvas()
    for zz in (35, 40):
        g.box(F, 40, zz, F + 1, 43, zz + 2, C("bone", 7))
        g.set(F, 40, zz + (1 if zz > 38 else 0), 0)
    g.box(F, 42, 34, F + 1, 43, 43, C("magenta", 3))
    g.set(F, 43, 34, C("iron", 0)).set(F, 43, 42, C("iron", 0))
    return rig_part("facialhair monster-1", g, "Vampire Fangs")


def stitched_grin():
    g, _ = canvas()
    g.box(F, 41, 33, F + 1, 43, 44, C("iron", 0))
    g.box(F, 41, 34, F + 1, 42, 43, C("magenta", 3))
    for zz in (35, 38, 41):
        g.set(F, 40, zz, C("bone", 6)).set(F, 43, zz, C("bone", 6))
    g.set(F, 42, 33, C("magenta", 4)).set(F, 42, 44, C("magenta", 4))
    return rig_part("facialhair monster-2", g, "Stitched Grin")


def mutton_chops():
    g, (x, y, z) = canvas()
    ch = shell(["Head"], 1) & (y >= 38) & (y < 50) & (x >= 20) & ((z <= 27) | (z >= 48))
    ch |= (x == F) & (y >= 38) & (y < 46) & (((z >= 27) & (z < 31)) | ((z > 45) & (z < 49)))
    g.where(ch, C("gray", 5))
    g.where(ch & ((y % 2) == 0), C("gray", 4))
    return rig_part("facialhair monster-3", g, "Grey Mutton Chops")


# ------------------------------------------------------------------ eyewear
def red_monocle():
    g, (x, y, z) = canvas()
    ring = (x == F) & (((y + 0.5 - 48) ** 2 + (z + 0.5 - 43) ** 2) <= 9) & (((y + 0.5 - 48) ** 2 + (z + 0.5 - 43) ** 2) >= 4)
    g.where(ring, C("iron", 0))
    g.where((x == F) & (((y + 0.5 - 48) ** 2 + (z + 0.5 - 43) ** 2) <= 6) & (((y + 0.5 - 48) ** 2 + (z + 0.5 - 43) ** 2) >= 4), C("gold", 6))
    g.where((x == F) & (((y + 0.5 - 48) ** 2 + (z + 0.5 - 43) ** 2) < 4), C("magenta", 4))
    g.set(F, 48, 43, C("toxic", 6))
    for k in range(8):
        g.set(F, 45 - k, 46 + k // 3, C("gold", 4 if k % 2 else 3))
    return rig_part("eyewear monster-1", g, "Blood Monocle")


def brass_goggles():
    g, (x, y, z) = canvas()
    strap = shell(["Head"], 1) & (y >= 48) & (y < 50)
    g.where(strap, C("iron", 1))
    for zc in (34, 43):
        g.cylinder("x", 48.5, zc, 3.0, F, F + 2, C("iron", 0))
        g.cylinder("x", 48.5, zc, 2.2, F + 1, F + 2, C("bone", 5))
        g.cylinder("x", 48.5, zc, 1.3, F + 1, F + 2, C("toxic", 5))
        g.set(F + 1, 49, zc, C("toxic", 6))
    g.box(F, 48, 37, F + 1, 49, 40, C("magenta", 3))
    return rig_part("eyewear monster-2", g, "Brass Goggles")


def skull_patch():
    g, (x, y, z) = canvas()
    strap = shell(["Head"], 1) & (abs((y + 0.5) - (44 + (z + 0.5 - 27) * 0.45)) < 0.8)
    g.where(strap, C("iron", 1))
    g.box(F, 45, 31, F + 1, 51, 37, C("iron", 1))
    g.box(F + 1, 47, 33, F + 2, 50, 36, C("bone", 6))
    g.set(F + 1, 48, 33, C("iron", 1)).set(F + 1, 48, 35, C("iron", 1))
    return rig_part("eyewear monster-3", g, "Skull Eyepatch")


# ------------------------------------------------------------------ ears
def wolf_ears():
    g, (x, y, z) = canvas()
    for zc in (30, 45):
        for k in range(9):
            w = max(1, 3 - k // 3)
            g.box(17, 59 + k, zc - w, 23, 60 + k, zc + w, C("stone", 4 if k > 5 else 5))
            g.where((x >= 21) & (x < 23) & (y == 59 + k) & (abs(z + 0.5 - zc) <= w - 1), C("magenta", 3))
        g.box(22, 60, zc - 1, 24, 64, zc + 1, C("bone", 6))
    return rig_part("ears monster-1", g, "Wolf Ears")


def bat_ears():
    g, _ = canvas()
    for s_, zc in ((-1, 26), (1, 49)):
        # Small folded ears sit below the brim and keep the hat dominant.
        for k in range(5):
            zz = zc + s_ * (1 + k * 0.65)
            width = 2 - k // 3
            g.box(18, 54 + k, zz - width, 21, 55 + k, zz + width, C("iron", 0))
            g.box(19, 54 + k, zz - width + 1, 21, 55 + k, zz + width - 1, C("purple", 3))
            g.set(21, 54 + k, zz, C("magenta", 4))
    return rig_part("ears monster-2", g, "Bat Ears")


def pointed_ears():
    g, _ = canvas()
    for s_, zc in ((-1, 26), (1, 49)):
        for k in range(8):  # long elfin points sweeping back and up
            zz = zc + s_ * (1 + k * 0.7)
            g.box(19 - k * 0.6, 45 + k, zz - 0.5, 24 - k * 0.6, 47 + k, zz + 0.5, C("gray", 6 if k < 6 else 5))
    return rig_part("ears monster-3", g, "Pointed Vampire Ears")


# ------------------------------------------------------------------ face
def skull_paint():
    g, (x, y, z) = canvas()
    plate = (x == F) & (y >= 38) & (y < 57) & (z >= 28) & (z < 48)
    g.where(plate, C("bone", 6))
    g.where(plate & ((y == 38) | (y == 56) | (z == 28) | (z == 47)), C("bone", 4))
    for z0 in (31, 41):
        g.box(F, 46, z0, F + 1, 51, z0 + 5, C("iron", 0))
        g.box(F, 47, z0 + 1, F + 1, 49, z0 + 4, C("toxic", 5))
        g.set(F, 48, z0 + 2, C("toxic", 7))
    g.box(F, 42, 37, F + 1, 44, 39, C("iron", 0))
    g.box(F, 39, 31, F + 1, 41, 46, C("iron", 0))
    for zz in range(32, 46, 2):
        g.box(F, 39, zz, F + 1, 41, zz + 1, C("bone", 7))
    return rig_part("face monster-1", g, "Skull Face Paint")


def mummy_face():
    g, (x, y, z) = canvas()
    plate = (x == F) & (y >= 37) & (y < 58) & (z >= 27) & (z < 49)
    g.where(plate, C("stone", 5))
    g.where(plate & ((y == 37) | (y == 57) | (z == 27) | (z == 48)), C("iron", 2))
    # Keep the eye shapes dark and simple under the green lenses.
    for z0 in (31, 41):
        g.box(F, 46, z0, F + 1, 51, z0 + 5, C("iron", 0))
        g.box(F, 47, z0 + 1, F + 1, 49, z0 + 4, C("magenta", 3))
    g.box(F, 40, 34, F + 1, 43, 44, C("iron", 0))
    g.box(F, 41, 35, F + 1, 42, 43, C("bone", 5))
    return rig_part("face monster-2", g, "Mummy Wraps")


def scar_face():
    g, _ = canvas()
    for k in range(10):
        g.set(F, 53 - k, 41 + k * 0.5, C("blood", 3))
        if k % 2 == 0:
            g.set(F, 53 - k, 40 + k * 0.5, C("iron", 1)).set(F, 53 - k, 42 + k * 0.5, C("iron", 1))
    g.box(F, 47, 42, F + 1, 49, 44, C("bone", 7))  # milky eye
    return rig_part("face monster-3", g, "Stitched Scar")


def wolf_muzzle():
    g, _ = canvas()
    # Center the short muzzle on the face. The dark eye sockets and nose are
    # painted on its forward plane, so it reads as one deliberate wolf mask.
    g.box(F, 39, 32, F + 6, 46, 45, C("stone", 4))
    g.box(F + 1, 39, 33, F + 5, 44, 44, C("bone", 5))
    g.box(F + 5, 43, 36, F + 7, 47, 41, C("iron", 0))
    g.box(F + 6, 44, 37, F + 7, 46, 40, C("magenta", 4))
    for z0 in (33, 42):
        g.box(F + 5, 47, z0, F + 6, 51, z0 + 3, C("iron", 0))
        g.set(F + 5, 48, z0 + 1, C("toxic", 6)).set(F + 5, 49, z0 + 1, C("toxic", 6))
    g.box(F + 5, 40, 37, F + 6, 42, 40, C("bone", 7))
    return rig_part("face monster-4", g, "Wolf Muzzle")


# ------------------------------------------------------------------ eyebrows
def arched_brows():
    g, _ = canvas()
    for z0, s in ((31, 1), (41, -1)):
        for k in range(5):
            g.set(F, 51 + (k if s > 0 else 4 - k) // 2, z0 + k, C("iron", 0))
        g.set(F, 51, z0 + 2, C("magenta", 4))
    return rig_part("eyebrow monster-1", g, "Sinister Arched Brows")


def unibrow():
    g, _ = canvas()
    # Two short angled brows leave a clear gap between the eyes.
    g.line((F, 53, 31), (F, 52, 35), 1.3, C("iron", 0))
    g.line((F, 52, 42), (F, 53, 46), 1.3, C("iron", 0))
    g.set(F, 53, 32, C("magenta", 4)).set(F, 53, 45, C("magenta", 4))
    return rig_part("eyebrow monster-2", g, "Heavy Unibrow")


# ------------------------------------------------------------------ tops
def torso_shell(t=1):
    g, (x, y, z) = canvas()
    m = shell(["Chest", "Body"], t) & (y >= 16)
    arms = shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], t)
    return g, (x, y, z), m, arms


def vampire_coat():
    g, (x, y, z), m, arms = torso_shell()
    g.where(m | arms, C("iron", 2))
    g.where(m & (x >= 24) & (abs(z + 0.5 - 38) < 4), C("blood", 3))
    g.where(m & (x >= 24) & (abs(z + 0.5 - 38) < 1) & (y >= 26), C("bone", 7))
    g.where(m & (x >= 24) & (abs(abs(z + 0.5 - 38) - 4) < 0.6), C("gold", 4))
    g.where(arms & ((z < 16) | (z > 59)), C("blood", 2))  # cuffs
    collar = shell(["Chest"], 2) & (y >= 33) & (y < 41) & (x <= 21) & ~region(["Head"]) & ~shell(["Head"], 1)
    g.where(collar, C("blood", 2))
    for yy in range(12, 20):  # coat tails
        g.box(14, yy, 31, 16, yy + 1, 45, C("iron", 2))
    g.box(25, 26, 37, 26, 29, 39, C("gold", 5))
    return rig_part("tops monster-1", g, "Count's Tailcoat")


def tattered_shirt():
    g, (x, y, z), m, arms = torso_shell()
    g.where(m | (arms & (abs(z + 0.5 - 38) < 16)), C("stone", 5))
    g.where(m & (x >= 24) & (y >= 30) & (z >= 30) & (z <= 46) & ((z == 30) | (z == 46)), C("iron", 1))
    # A framed violet vest, bone placket and one toxic seal make a clear front.
    g.where(m & (x >= 24) & (y >= 19) & (y <= 34) & (z >= 33) & (z <= 43), C("iron", 0))
    g.where(m & (x >= 24) & (y >= 20) & (y <= 33) & (z >= 34) & (z <= 42), C("purple", 3))
    g.where(m & (x >= 24) & (y >= 20) & (y <= 34) & (z >= 37) & (z <= 39), C("bone", 6))
    for yy in (22, 27, 32):
        g.where(m & (x == 26) & (y == yy) & (z == 38), C("toxic", 6))
    g.where(m & (x >= 24) & (y >= 34) & (y < 37) & (z >= 34) & (z <= 42), C("iron", 1))
    g.where(arms & ((z < 16) | (z > 59)), C("purple", 3))
    g.where(arms & ((z < 15) | (z > 60)), C("iron", 0))
    g.where(m & (y == 16), C("iron", 1))
    return rig_part("tops monster-2", g, "Tattered Shirt")


def bone_armor():
    g, (x, y, z), m, arms = torso_shell()
    g.where(m, C("iron", 1))
    g.where(m & ((y % 3) == 0) & (y >= 22), C("bone", 6))  # ribs
    g.where(m & (abs(z + 0.5 - 38) < 1.2), C("bone", 5))  # sternum
    g.where(arms & (abs(z + 0.5 - 38) < 13), C("iron", 1))
    for zc in (24, 49):  # shoulder skulls
        g.box(17, 35, zc - 2, 23, 39, zc + 2, C("bone", 6))
        g.box(22, 36, zc - 1, 23, 37, zc, C("iron", 0))
        g.box(22, 36, zc + 1, 23, 37, zc + 2, C("iron", 0))
    return rig_part("tops monster-3", g, "Bone Armour")


def mummy_top():
    g, (x, y, z), m, arms = torso_shell()
    w = m | arms
    g.where(w, C("iron", 2))
    g.where(m & ((y % 4) == 0), C("bone", 6))
    g.where(m & (x >= 24) & ((y % 4) == 1), C("bone", 4))
    g.where(m & (x >= 24) & (y >= 19) & (y <= 35) & (abs(z + 0.5 - 38) < 1), C("magenta", 4))
    g.where(arms & ((z < 16) | (z > 59)), C("purple", 3))
    g.box(22, 20, 47, 23, 30, 50, C("purple", 3))
    g.box(23, 22, 48, 24, 28, 49, C("toxic", 5))
    for yy in (22, 27, 32):
        g.where(m & (x >= 24) & (y == yy) & (z >= 34) & (z <= 42), C("gold", 4))
    return rig_part("tops monster-4", g, "Mummy Wraps Top")


def hunter_coat():
    g, (x, y, z), m, arms = torso_shell()
    g.where(m | arms, C("iron", 2))
    g.where(m & (x >= 24) & (abs(z + 0.5 - 38) < 5), C("purple", 3))
    g.where(m & (x >= 24) & (abs(z + 0.5 - 38) < 2), C("bone", 6))
    # Framed lapels, cross-body ward sash, and a bright seal replace the loose
    # stake-hunter read with a haunted field coat.
    g.where(m & (x >= 24) & (y >= 30) & (z >= 31) & (z <= 45) & ((z == 31) | (z == 45)), C("iron", 0))
    g.box(24, 17, 42, 26, 35, 44, C("magenta", 3))
    g.box(26, 20, 42, 27, 34, 43, C("bone", 5))
    for yy in (22, 27, 32):
        g.set(27, yy, 42, C("toxic", 6))
    g.where(arms & ((z < 16) | (z > 59)), C("purple", 3))
    g.where(m & (y == 17), C("iron", 0))
    g.box(25, 17, 37, 26, 20, 40, C("toxic", 5))
    g.box(26, 18, 38, 27, 19, 39, C("bone", 7))
    return rig_part("tops monster-5", g, "Hunter's Coat")


# ------------------------------------------------------------------ bottoms
def legs_shell():
    g, (x, y, z) = canvas()
    m = shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) | (shell(["Body"], 1) & (y < 19))
    return g, (x, y, z), m


def tattered_trousers():
    g, (x, y, z), m = legs_shell()
    g.where(m, C("iron", 1))
    g.where(m & (y < 8) & (((z // 2) % 2) == 0), 0)
    g.where(m & (x >= 23) & (y >= 10) & (y < 13) & (z > 40) & (z < 45), C("moss", 3))
    g.where(m & (y == 17), C("purple", 3))
    g.where(m & (x >= 23) & (y >= 14) & (y <= 17) & ((z % 4) == 0), C("bone", 5))
    return rig_part("bottoms monster-1", g, "Tattered Trousers")


def bone_greaves():
    g, (x, y, z), m = legs_shell()
    g.where(m, C("iron", 3))
    # Tall framed shin panels stop well above the single boot.
    g.where(m & (y >= 13) & (x >= 23), C("bone", 5))
    g.where(m & (y >= 13) & (y < 15), C("iron", 0))
    g.where(m & (x >= 23) & (y >= 10) & (y < 12), C("purple", 3))
    g.where(m & (x >= 23) & (y >= 15) & (y <= 17) & ((z == 33) | (z == 42)), C("purple", 3))
    g.where(m & (x >= 23) & (y == 16) & (z >= 34) & (z <= 41), C("magenta", 4))
    for zz in (35, 40):
        g.where(m & (x == 24) & (y == 14) & (z == zz), C("iron", 0))
    return rig_part("bottoms monster-2", g, "Bone Greaves")


def mummy_legs():
    g, (x, y, z), m = legs_shell()
    g.where(m, C("sand", 5))
    g.where(m & ((y % 3) == 0), C("sand", 4))
    g.box(22, 4, 33, 23, 10, 34, C("sand", 6))
    return rig_part("bottoms monster-3", g, "Mummy Wrapped Legs")


# ------------------------------------------------------------------ shoes
def wolf_paws():
    g, (x, y, z) = canvas()
    for z0, z1 in leg_z_ranges().values():
        g.box(15, 0, z0 - 1, 27, 2, z1 + 1, C("iron", 0))
        g.box(16, 2, z0, 26, 7, z1, C("stone", 4))
        g.box(16, 6, z0, 25, 8, z1, C("purple", 3))
        g.where((x >= 24) & (x < 27) & (y >= 2) & (y <= 5) & (z >= z0) & (z < z1), C("stone", 5))
        g.box(25, 3, z0 + 2, 27, 5, z1 - 2, C("bone", 6))
    return rig_part("shoes monster-1", g, "Wolf Paws")


def hunter_boots():
    g, (x, y, z) = canvas()
    for z0, z1 in leg_z_ranges().values():
        # One complete boot shell covers the PN shoe. Details stay painted.
        g.box(14, 0, z0 - 2, 29, 2, z1 + 2, C("iron", 0))
        g.box(15, 2, z0 - 1, 29, 7, z1 + 1, C("purple", 3))
        g.box(15, 6, z0 - 1, 29, 8, z1 + 1, C("iron", 1))
        # A small toe charm replaces the broad pale strip that read as a shoe.
        center = (z0 + z1 - 1) // 2
        g.box(27, 3, center - 1, 29, 5, center + 1, C("bone", 6))
        g.set(28, 4, center, C("toxic", 6))
        g.where((x >= 17) & (x < 26) & (y == 5) & (z == z0 - 1), C("magenta", 4))
    return rig_part("shoes monster-2", g, "Hunter's Boots")


def buckle_shoes():
    g, _ = canvas()
    for z0, z1 in leg_z_ranges().values():
        g.box(15, 0, z0, 27, 4, z1, C("iron", 1))
        g.box(27, 1, z0 + 2, 30, 3, z1 - 2, C("iron", 1))
        g.box(24, 3, z0 + 2, 26, 5, z1 - 2, C("gold", 5))
    return rig_part("shoes monster-3", g, "Pointed Buckle Shoes")


# ------------------------------------------------------------------ back
def vampire_cape():
    g, (x, y, z) = canvas()
    for yy in range(4, 36):
        spread = 9 + (36 - yy) // 5
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("iron", 2))
        g.box(15, yy, 38 - spread + 1, 16, yy + 1, 38 + spread - 1, C("purple", 3))
        if yy % 5 == 0:
            g.box(15, yy, 33, 16, yy + 2, 34, C("magenta", 4))
            g.box(15, yy, 42, 16, yy + 2, 43, C("magenta", 4))
    g.where((x == 15) & (y >= 5) & (y < 34) & (abs(z + 0.5 - 38) < 2), C("iron", 3))
    g.carve((x < 16) & (y < 8) & (((z // 3) % 2) == 0))
    g.box(13, 34, 26, 16, 40, 50, C("purple", 2))
    g.box(16, 37, 35, 17, 39, 41, C("toxic", 5))
    return rig_part("back monster-1", g, "Vampire Cape")


def bat_wings():
    g, (x, y, z) = canvas()
    # Two compact bat silhouettes. A single membrane field sits inside a dark
    # scalloped frame, with three ribs that meet at the shoulder root.
    outline = [(4, 35), (8, 45), (15, 50), (22, 46), (26, 40),
               (24, 34), (20, 37), (17, 29), (14, 35), (11, 31),
               (8, 36), (5, 33)]
    for s in (-1, 1):
        u = (z + 0.5 - 38) * s
        v = y + 0.5
        inside = np.zeros(g.shape, dtype=bool)
        for i, (u1, v1) in enumerate(outline):
            u2, v2 = outline[(i + 1) % len(outline)]
            inside ^= ((v1 > v) != (v2 > v)) & (u < (u2 - u1) * (v - v1) / (v2 - v1 + 1e-8) + u1)
        mem = (x >= 13) & (x < 16) & inside
        g.where(mem, C("purple", 3))
        g.where(mem & (v >= 40), C("purple", 4))
        # Frame each outer edge and add fine ribs along the membrane folds.
        for i, (u1, v1) in enumerate(outline):
            u2, v2 = outline[(i + 1) % len(outline)]
            g.line((13, v1, 38 + s * u1), (13, v2, 38 + s * u2), 0.9, C("iron", 0))
        for u_tip, y_tip in ((17, 29), (14, 35), (8, 36)):
            g.line((13, 35, 38 + s * 4), (13, y_tip, 38 + s * u_tip), 0.7, C("iron", 1))
    return rig_part("back monster-2", g, "Bat Wings")


def coffin_pack():
    g, (x, y, z) = canvas()
    from _kit import coffin_mask

    m = coffin_mask(14, 28, 20)  # width along z, length along y (head up)
    for xx in range(9, 15):
        g.a[xx, 10:38, 31:45][m.T] = C("darkwood", 3 if xx < 14 else 2)
    g.a[8, 10:38, 31:45][m.T] = C("darkwood", 4)
    g.box(8, 20, 37, 9, 32, 39, C("gold", 4))
    g.box(8, 27, 34, 9, 29, 42, C("gold", 4))
    g.box(14, 30, 30, 16, 32, 46, C("rust", 2))  # straps
    g.box(14, 18, 30, 16, 20, 46, C("rust", 2))
    return rig_part("back monster-3", g, "Coffin Backpack")


def stake_quiver():
    g, (x, y, z) = canvas()
    # A compact grave-ward pack: one framed iron reliquary with a luminous
    # violet panel. It keeps the back slot's volume and drops the archer cues.
    g.box(9, 17, 29, 14, 35, 47, C("iron", 0))
    g.box(8, 19, 31, 10, 33, 45, C("bone", 5))
    g.box(8, 20, 32, 9, 32, 44, C("purple", 3))
    g.box(8, 24, 36, 9, 29, 40, C("toxic", 5))
    g.box(8, 25, 37, 9, 28, 39, C("toxic", 7))
    g.box(10, 16, 35, 13, 19, 41, C("magenta", 3))
    g.box(10, 33, 35, 13, 36, 41, C("magenta", 3))
    return rig_part("back monster-4", g, "Stake Quiver")


PARTS = [witch_hat, hunter_hat, top_hat, horned_helm, pumpkin_head, wolf_hood,
         slick_hair, flat_top, mad_hair, fangs, stitched_grin, mutton_chops,
         red_monocle, brass_goggles, skull_patch, wolf_ears, bat_ears, pointed_ears,
         skull_paint, mummy_face, scar_face, wolf_muzzle, arched_brows, unibrow,
         vampire_coat, tattered_shirt, bone_armor, mummy_top, hunter_coat,
         tattered_trousers, bone_greaves, mummy_legs, wolf_paws, hunter_boots, buckle_shoes,
         vampire_cape, bat_wings, coffin_pack, stake_quiver]


# ------------------------------------------------------------------ clips
def k(*pairs):
    return [(float(t), tuple(float(c) for c in v)) for t, v in pairs]


def clips():
    # Rig axes: +X forward, +Y up, +Z along the right arm. Arm.R forward (0,90,0),
    # Arm.L forward (0,-90,0); Arm.R up (-90,0,0), Arm.L up (90,0,0); lean
    # forward = negative Z rotation; head back (look up) = positive Z.
    howl = {
        "Chest": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, 14)), (1.4, (0, 0, 16)), (1.8, (0, 0, 0)))},
        "Head": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, 38)), (0.8, (4, 0, 42)), (1.1, (-4, 0, 42)), (1.4, (0, 0, 40)), (1.8, (0, 0, 0)))},
        "Arm.R": {"rot": k((0, (0, 0, 0)), (0.4, (55, -30, 0)), (1.4, (55, -30, 0)), (1.8, (0, 0, 0)))},
        "Arm.L": {"rot": k((0, (0, 0, 0)), (0.4, (-55, 30, 0)), (1.4, (-55, 30, 0)), (1.8, (0, 0, 0)))},
        "Hand.R": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, -30)), (1.4, (0, 0, -30)), (1.8, (0, 0, 0)))},
        "Hand.L": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, -30)), (1.4, (0, 0, -30)), (1.8, (0, 0, 0)))},
        "Root": {"loc": k((0, (0, 0, 0)), (0.4, (0, -3, 0)), (1.4, (0, -3, 0)), (1.8, (0, 0, 0)))},
    }
    rise = {
        "Root": {"rot": k((0, (0, 0, 88)), (0.3, (0, 0, 88)), (1.0, (0, 0, 10)), (1.2, (0, 0, -4)), (1.5, (0, 0, 0))),
                 "loc": k((0, (0, 3, 0)), (0.3, (0, 3, 0)), (1.0, (0, 1, 0)), (1.5, (0, 0, 0)))},
        "Arm.R": {"rot": k((0, (0, 80, 0)), (0.9, (0, 80, 0)), (1.2, (-40, 20, 0)), (1.5, (0, 0, 0)))},
        "Arm.L": {"rot": k((0, (0, -80, 0)), (0.9, (0, -80, 0)), (1.2, (40, -20, 0)), (1.5, (0, 0, 0)))},
        "ForeArm.R": {"rot": k((0, (0, 90, 0)), (0.9, (0, 90, 0)), (1.5, (0, 0, 0)))},
        "ForeArm.L": {"rot": k((0, (0, -90, 0)), (0.9, (0, -90, 0)), (1.5, (0, 0, 0)))},
        "Head": {"rot": k((0, (0, 0, -10)), (1.0, (0, 0, -10)), (1.3, (0, 0, 8)), (1.5, (0, 0, 0)))},
    }
    flap = {
        "Arm.R": {"rot": k((0, (-45, 0, 0)), (0.3, (35, 10, 0)), (0.6, (-45, 0, 0)))},
        "Arm.L": {"rot": k((0, (45, 0, 0)), (0.3, (-35, -10, 0)), (0.6, (45, 0, 0)))},
        "ForeArm.R": {"rot": k((0, (-20, 0, 0)), (0.3, (15, 0, 0)), (0.6, (-20, 0, 0)))},
        "ForeArm.L": {"rot": k((0, (20, 0, 0)), (0.3, (-15, 0, 0)), (0.6, (20, 0, 0)))},
        "Root": {"loc": k((0, (0, 6, 0)), (0.3, (0, 2, 0)), (0.6, (0, 6, 0)))},
        "Chest": {"rot": k((0, (0, 0, -8)), (0.3, (0, 0, -2)), (0.6, (0, 0, -8)))},
        "Leg.R": {"rot": k((0, (0, 0, -15)), (0.3, (0, 0, -10)), (0.6, (0, 0, -15)))},
        "Leg.L": {"rot": k((0, (0, 0, -15)), (0.3, (0, 0, -10)), (0.6, (0, 0, -15)))},
    }
    lunge = {
        "Root": {"loc": k((0, (0, 0, 0)), (0.2, (-3, -2, 0)), (0.45, (10, -4, 0)), (0.9, (0, 0, 0)))},
        "Chest": {"rot": k((0, (0, 0, 0)), (0.2, (0, 0, 8)), (0.45, (0, 0, -28)), (0.9, (0, 0, 0)))},
        "Head": {"rot": k((0, (0, 0, 0)), (0.45, (0, 0, 18)), (0.9, (0, 0, 0)))},
        "Arm.R": {"rot": k((0, (0, 0, 0)), (0.2, (-30, -40, 0)), (0.45, (0, 85, 10)), (0.9, (0, 0, 0)))},
        "Arm.L": {"rot": k((0, (0, 0, 0)), (0.2, (30, 40, 0)), (0.45, (0, -85, -10)), (0.9, (0, 0, 0)))},
        "Leg.R": {"rot": k((0, (0, 0, 0)), (0.45, (0, 0, 45)), (0.9, (0, 0, 0)))},
        "LowerLeg.R": {"rot": k((0, (0, 0, 0)), (0.45, (0, 0, -35)), (0.9, (0, 0, 0)))},
        "Leg.L": {"rot": k((0, (0, 0, 0)), (0.45, (0, 0, -35)), (0.9, (0, 0, 0)))},
    }
    creep = {
        "Chest": {"rot": k((0, (0, 0, -24)), (0.8, (0, 0, -20)), (1.6, (0, 0, -24)))},
        "Head": {"rot": k((0, (0, -12, 18)), (0.8, (0, 12, 18)), (1.6, (0, -12, 18)))},
        "Arm.R": {"rot": k((0, (40, 60, 0)), (0.8, (30, 75, 0)), (1.6, (40, 60, 0)))},
        "Arm.L": {"rot": k((0, (-30, -75, 0)), (0.8, (-40, -60, 0)), (1.6, (-30, -75, 0)))},
        "Hand.R": {"rot": k((0, (0, 0, -40)), (1.6, (0, 0, -40)))},
        "Hand.L": {"rot": k((0, (0, 0, -40)), (1.6, (0, 0, -40)))},
        "Leg.R": {"rot": k((0, (0, 0, 25)), (0.8, (0, 0, -15)), (1.6, (0, 0, 25)))},
        "Leg.L": {"rot": k((0, (0, 0, -15)), (0.8, (0, 0, 25)), (1.6, (0, 0, -15)))},
        "LowerLeg.R": {"rot": k((0, (0, 0, -30)), (0.8, (0, 0, -5)), (1.6, (0, 0, -30)))},
        "LowerLeg.L": {"rot": k((0, (0, 0, -5)), (0.8, (0, 0, -30)), (1.6, (0, 0, -5)))},
        "Root": {"loc": k((0, (0, -3, 0)), (0.4, (0, -2, 0)), (0.8, (0, -3, 0)), (1.2, (0, -2, 0)), (1.6, (0, -3, 0)))},
    }
    curse = {
        "Arm.R": {"rot": k((0, (0, 0, 0)), (0.4, (-120, 0, 0)), (0.7, (-120, 30, 0)), (0.9, (0, 95, 0)), (1.2, (0, 95, 0)), (1.5, (0, 0, 0)))},
        "Arm.L": {"rot": k((0, (0, 0, 0)), (0.4, (120, 0, 0)), (0.7, (120, -30, 0)), (0.9, (0, -95, 0)), (1.2, (0, -95, 0)), (1.5, (0, 0, 0)))},
        "Hand.R": {"rot": k((0, (0, 0, 0)), (0.9, (0, 0, 40)), (1.2, (0, 0, 40)), (1.5, (0, 0, 0)))},
        "Hand.L": {"rot": k((0, (0, 0, 0)), (0.9, (0, 0, 40)), (1.2, (0, 0, 40)), (1.5, (0, 0, 0)))},
        "Chest": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, 10)), (0.9, (0, 0, -14)), (1.2, (0, 0, -14)), (1.5, (0, 0, 0)))},
        "Head": {"rot": k((0, (0, 0, 0)), (0.4, (0, 0, 20)), (0.9, (0, 0, -12)), (1.5, (0, 0, 0)))},
        "Root": {"loc": k((0, (0, 0, 0)), (0.4, (0, 3, 0)), (0.9, (0, -2, 0)), (1.5, (0, 0, 0)))},
    }
    shamble = {
        "Arm.R": {"rot": k((0, (0, 88, 0)), (0.8, (8, 84, 0)), (1.6, (0, 88, 0)))},
        "Arm.L": {"rot": k((0, (8, -84, 0)), (0.8, (0, -88, 0)), (1.6, (8, -84, 0)))},
        "Chest": {"rot": k((0, (8, 0, -6)), (0.8, (-8, 0, -6)), (1.6, (8, 0, -6)))},
        "Head": {"rot": k((0, (-18, 0, -8)), (0.8, (14, 0, -4)), (1.6, (-18, 0, -8)))},
        "Leg.R": {"rot": k((0, (0, 0, 18)), (0.8, (0, 0, -10)), (1.6, (0, 0, 18)))},
        "Leg.L": {"rot": k((0, (0, 0, -10)), (0.8, (0, 0, 18)), (1.6, (0, 0, -10)))},
        "Root": {"loc": k((0, (0, 0, 0)), (0.4, (0, -1.5, 1)), (0.8, (0, 0, 0)), (1.2, (0, -1.5, -1)), (1.6, (0, 0, 0))),
                 "rot": k((0, (5, 0, 0)), (0.8, (-5, 0, 0)), (1.6, (5, 0, 0)))},
    }
    swipe = {
        "Arm.R": {"rot": k((0, (0, 0, 0)), (0.25, (-110, -30, 0)), (0.45, (0, 120, 20)), (0.8, (0, 0, 0)))},
        "ForeArm.R": {"rot": k((0, (0, 0, 0)), (0.25, (0, 40, 0)), (0.45, (0, 0, 0)), (0.8, (0, 0, 0)))},
        "Hand.R": {"rot": k((0, (0, 0, 0)), (0.25, (0, 0, 30)), (0.45, (0, 0, -30)), (0.8, (0, 0, 0)))},
        "Chest": {"rot": k((0, (0, 0, 0)), (0.25, (0, -25, 0)), (0.45, (0, 30, -10)), (0.8, (0, 0, 0)))},
        "Arm.L": {"rot": k((0, (0, 0, 0)), (0.25, (30, 0, 0)), (0.45, (-20, -30, 0)), (0.8, (0, 0, 0)))},
        "Head": {"rot": k((0, (0, 0, 0)), (0.25, (0, 15, 0)), (0.45, (0, -15, 0)), (0.8, (0, 0, 0)))},
    }
    return [Clip("48_Howl", howl, loop=False), Clip("49_Coffin_Rise", rise, loop=False), Clip("50_Bat_Flap", flap),
            Clip("51_Lunge", lunge, loop=False), Clip("52_Creep_Walk", creep), Clip("53_Cast_Curse", curse, loop=False),
            Clip("54_Zombie_Shamble", shamble), Clip("55_Claw_Swipe", swipe, loop=False)]


def build() -> Asset:
    root = Part("monster-avatar", None)
    for make in PARTS:
        root.add(make())
    return Asset(id="monster-avatar-parts", pack="monster", category="avatar", name="Monster Avatar Parts", root=root, clips=clips())
