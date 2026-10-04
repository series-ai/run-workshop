"""Fantasy avatar parts and clips on the PN rig (rig space: faces +X, right
arm +Z). 37 parts across the PN slots, positioned like the PN parts
(face features on x 28-29, brows y 53-56, hair to y 65, hats from y 58),
and eight clips 32-39."""
import math

import numpy as np

from _kit import FACE_X, HX0, HX1, HY0, HY1, HZ0, HZ1, bdilate, bshell as shell, jitter, rig_idx, rig_part
from rigkit import bbox, body, leg_z_ranges, region, rig_grid
from _kit import bdilate as dilate
from voxgrid import C, Asset, Clip, Part

X, Y, Z = None, None, None


def _xyz():
    global X, Y, Z
    if X is None:
        X, Y, Z = rig_idx()
    return X, Y, Z


HEAD_CZ = 38  # head centre (z)


def head_ring(y0, y1, t=1):
    x, y, z = _xyz()
    return shell(["Head"], t) & (y >= y0) & (y < y1)


# ---------------------------------------------------------------- headwear
def circlet():
    g = rig_grid()
    x, y, z = _xyz()
    band = shell(["Head"], 2) & ~shell(["Head"], 1) & (y >= 53) & (y < 55)
    g.where(band, C("gold", 5))
    g.where(band & (y == 53), C("gold", 4))
    for zz in (31, 45):  # leaf motifs at the temples
        g.box(FACE_X - 2, 54, zz - 1, FACE_X, 57, zz + 1, C("gold", 6))
    g.box(FACE_X + 2, 53, 37, FACE_X + 3, 57, 39, C("gold", 5))
    g.box(FACE_X + 3, 54, 37, FACE_X + 4, 56, 39, C("plasma", 6))
    return rig_part("headwear fantasy-1", g, "Elven Circlet")


def winged_helm():
    g = rig_grid()
    x, y, z = _xyz()
    helm = shell(["Head"], 1) & (y >= HY0)
    g.where(helm, C("steel", 4))
    # A bright crown plane and dark bevel paint give the shell a shaped read.
    g.where(helm & (y >= 58), C("steel", 6))
    g.where(helm & (y >= 56) & ((z < HZ0 + 3) | (z >= HZ1 - 2) | (x >= HX1 - 3)), C("steel", 3))
    g.where(helm & (y >= 57) & ((z < HZ0 + 1) | (z >= HZ1 - 1) | (x >= HX1 - 1)), C("steel", 5))
    # The brow, visor frame, breathing grille, and lower rim are painted on the shell.
    front = helm & (x == FACE_X + 1)
    g.where(front & (y >= 50) & (y < 52), C("iron", 4))
    g.where(front & (y == 52) & (z >= 30) & (z <= 46), C("gold", 6))
    g.where(front & ((y == 46) | (y == 49)) & (z >= 31) & (z <= 45), C("gold", 6))
    g.where(front & (y >= 47) & (y <= 48) & ((z == 30) | (z == 46)), C("gold", 5))
    g.where(front & (y >= 47) & (y <= 48) & (z >= 32) & (z <= 44), C("iron", 0))
    g.where(front & (y >= 40) & (y <= 43) & (z >= 36) & (z <= 40), C("iron", 4))
    g.where(front & (y == 41) & (z >= 37) & (z <= 39), C("steel", 7))
    g.where(front & (y >= 44) & (y <= 45) & (z >= 35) & (z <= 41), C("iron", 3))
    g.where(front & (y == 50) & ((z == 31) | (z == 45)), C("gold", 7))
    g.where(front & (y >= 53) & (y <= 59) & (z >= 37) & (z <= 39), C("gold", 5))
    g.where(front & (y == 54) & ((z == 31) | (z == 44)), C("gold", 6))
    # Rear seams, cheek plate divisions, and rivets carry around the whole helm.
    g.where(helm & (x < FACE_X - 2) & ((y == 43) | (y == 52) | (y == 57)), C("steel", 3))
    g.where(helm & (x < FACE_X - 2) & ((z == HZ0 - 1) | (z == HZ1)) & (y >= 52), C("gold", 5))
    for yy in (43, 52, 57):
        for zz in (HZ0 + 3, HZ1 - 4):
            g.where(helm & (x < FACE_X - 2) & (y == yy) & (z == zz), C("gold", 7))
    g.where(helm & (x == FACE_X + 1) & (y >= 37) & (y <= 40), C("iron", 3))
    for sign, zb in ((-1, HZ0 - 3), (1, HZ1 + 2)):
        for k in range(9):
            zz = zb + sign * (k // 3)
            g.box(HX0 + 8 - k, 50 + k, zz, HX0 + 13 - k // 2, 51 + k, zz + 1, C("bone", 7 if k % 2 else 6))
    return rig_part("headwear fantasy-2", g, "Winged Great Helm", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def wizard_hat():
    g = rig_grid()
    x, y, z = _xyz()
    cx, cz = (HX0 + HX1) / 2 - 0.5, HEAD_CZ
    d = np.sqrt((x + 0.5 - cx) ** 2 + (z + 0.5 - cz) ** 2)
    sq = np.maximum(np.abs(x + 0.5 - cx), np.abs(z + 0.5 - cz))
    g.where((sq <= 15.5) & (y >= 58) & (y < 60), C("purple", 3))  # brim
    g.where((sq <= 15.5) & (sq > 14.5) & (y >= 58) & (y < 59), C("gold", 4))
    for k in range(0, 28, 2):
        t = k / 27
        r = 11.5 * (1 - t) ** 0.9 + 0.8
        ox = -1 - round(9 * t ** 2.3)
        m = (np.maximum(np.abs(x + 0.5 - cx - ox), np.abs(z + 0.5 - cz)) <= r) & (y >= 60 + k) & (y < 62 + k)
        g.where(m, C("purple", 3))
    band = (np.maximum(np.abs(x + 0.5 - cx + 1), np.abs(z + 0.5 - cz)) <= 12.3) & (y >= 60) & (y < 62)
    g.where(band, C("gold", 5))
    g.box(FACE_X - 1, 60, 36, FACE_X + 1, 64, 40, C("gold", 6))  # buckle
    g.box(FACE_X, 61, 37, FACE_X + 1, 63, 39, C("purple", 3))
    rng = np.random.default_rng(4)
    pts = np.argwhere((g.a // 8 == 18) & (y > 63))
    for p in pts[rng.choice(len(pts), 8, replace=False)]:
        g.set(*p, C("gold", 6))
    return rig_part("headwear fantasy-3", g, "Wizard Hat", hides_hair=True)


def ranger_hood():
    g = rig_grid()
    x, y, z = _xyz()
    hood = (shell(["Head"], 2) & ((x < FACE_X - 1) | (y >= HY1 - 2) | (z < HZ0) | (z > HZ1))) & (y >= HY0 + 2)
    g.where(hood, C("forest", 3))
    # A warm bound edge and stitched panel lines make the hood read as cloth.
    rim = shell(["Head"], 2) & (x >= FACE_X - 1) & ((y >= HY1 - 2) | (z < HZ0) | (z > HZ1)) & (y >= HY0 + 2)
    g.where(rim, C("wood", 5))
    g.where(hood & (x < FACE_X - 4) & (y >= 54) & (y <= 61) & ((z == HZ0 - 1) | (z == HZ1)), C("leaf", 4))
    g.where(hood & (x < FACE_X - 2) & (y == 56) & (((z - HZ0) % 7) == 1), C("gold", 5))
    # Broad folds and a stitched rear seam stay inside the hood shell.
    g.where(hood & (x < FACE_X - 2) & (z >= HZ0 + 2) & (z <= HZ1 - 2) & (y >= 43) & (y <= 55) & (((z - HZ0) % 6) == 2), C("forest", 2))
    g.where(hood & (x == HX0 - 1) & (y >= 39) & (y <= 55) & (z == 38), C("wood", 5))
    g.where(hood & (x == HX0 - 1) & (y >= 40) & (y <= 54) & (z == 37) & (y % 3 == 0), C("gold", 5))
    return rig_part("headwear fantasy-4", g, "Ranger Hood", hides_hair=True)


def royal_crown():
    g = rig_grid()
    x, y, z = _xyz()
    band = shell(["Head"], 1) & (y >= 56) & (y < 59) & ~((x > HX0) & (x < HX1) & (z > HZ0) & (z < HZ1))
    g.where(band, C("gold", 5))
    g.where(band & (y == 56), C("gold", 3))
    # Broad low mounts and gems replace the thin candle-like points.
    g.box(15, 58, 29, 28, 60, 48, C("red", 3))  # velvet cap
    points = ((16, 31), (16, 43), (24, 31), (24, 43))
    for i, (px, pz) in enumerate(points):
        g.box(px, 60, pz, px + 3, 61, pz + 3, C("gold", 5))
        g.box(px + 1, 61, pz + 1, px + 2, 62, pz + 2, C("gold", 6))
        gem = ("red", "sky", "orange", "red")[i]
        g.set(px + 1, 62, pz + 1, C(gem, 5))
    # A wide front crest carries one clear red jewel.
    g.box(FACE_X, 59, 36, FACE_X + 1, 62, 41, C("gold", 5))
    g.box(FACE_X + 1, 60, 37, FACE_X + 2, 62, 40, C("red", 4))
    return rig_part("headwear fantasy-5", g, "Royal Crown")


def horned_helm():
    g = rig_grid()
    x, y, z = _xyz()
    helm = shell(["Head"], 1) & (y >= 50)
    g.where(helm, C("iron", 4))
    g.where(helm & (y == 50), C("gold", 4))
    g.where(helm & (((z - 38) % 5) == 0) & (y > 50), C("iron", 5))
    g.box(FACE_X + 1, 43, 37, FACE_X + 2, 51, 39, C("iron", 5))  # nose guard
    for sign, zb in ((-1, HZ0 - 1), (1, HZ1)):
        for k in range(11):
            zz = zb + sign * (1 + k // 2)
            yy = 52 + k - (k * k) // 14
            g.box(HX0 + 7, yy, zz, HX0 + 10, yy + 2, zz + 1, C("bone", 5 if k < 6 else 7))
    return rig_part("headwear fantasy-6", g, "Horned Helm", hides_hair=True)


def flower_crown():
    g = rig_grid()
    x, y, z = _xyz()
    wreath = shell(["Head"], 2) & ~shell(["Head"], 1) & (y >= 55) & (y < 58)
    g.where(wreath, C("leaf", 4))
    g.where(wreath & (y == 55), C("forest", 3))
    g.where(wreath & (y == 57), C("leaf", 6))
    # Three paired blossoms make clear clusters with one warm centre each.
    for zz in (31, 38, 45):
        g.box(FACE_X + 1, 56, zz - 1, FACE_X + 2, 58, zz + 2, C("bone", 7))
        g.set(FACE_X + 2, 57, zz, C("orange", 6))
        g.set(FACE_X + 2, 57, zz - 1, C("gold", 6))
    for zz in (28, 48):
        g.set(FACE_X + 1, 57, zz, C("gold", 5))
    return rig_part("headwear fantasy-7", g, "Flower Crown")


# ---------------------------------------------------------------- hair
def silver_hair():
    g = rig_grid()
    x, y, z = _xyz()
    cap = (shell(["Head"], 2) & (y >= 54)) | (shell(["Head"], 1) & (x <= HX0 + 8) & (y >= 42))
    g.where(cap, C("bone", 7))
    # Long rear curtain has broad locks, a clean hem, and warm shadow seams.
    g.box(HX0 - 2, 30, HZ0 + 2, HX0, 56, HZ1 - 2, C("bone", 7))
    rear = (g.a != 0) & (x < HX0)
    g.where(rear & (((z - HZ0) % 6) == 0), C("bone", 5))
    g.where(rear & (y >= 34) & (y <= 53) & (((z - HZ0) % 6) == 1), C("bone", 6))
    g.where(rear & (y >= 31) & (y <= 35) & (((z - HZ0) % 4) == 0), C("bone", 4))
    g.where(rear & (y >= 31) & (y <= 33), C("gold", 4))
    for zz in (HZ0 + 5, HZ0 + 11, HZ0 + 17):
        g.where(rear & (z == zz) & (y >= 32) & (y <= 51), C("bone", 7))
    g.where(rear & (y == 54) & (z >= HZ0 + 2) & (z <= HZ1 - 2), C("bone", 6))
    for sz in (HZ0 - 1, HZ1):
        g.box(FACE_X - 6, 38, sz, FACE_X, HY1, sz + 1, C("bone", 7))
    g.box(FACE_X + 1, 55, HZ0, FACE_X + 2, 58, 37, C("bone", 6))  # swept fringe
    g.box(FACE_X + 1, 57, 37, FACE_X + 2, 58, HZ1, C("bone", 6))
    return rig_part("hair fantasy-1", g, "Long Silver Elf Hair")


def braided_hair():
    g = rig_grid()
    x, y, z = _xyz()
    cap = (shell(["Head"], 1) & (y >= 53)) | (shell(["Head"], 1) & (x <= HX0 + 6) & (y >= 44))
    g.where(cap, C("rust", 3))
    g.where(cap & (y >= 55) & ((z % 5) == 0), C("rust", 5))
    g.where(cap & (y >= 55) & ((z % 5) == 1), C("rust", 4))
    g.box(FACE_X + 1, 55, HZ0, FACE_X + 2, 58, HZ1, C("rust", 3))
    rear = (g.a != 0) & (x < HX0)
    g.where(rear & (((z - HZ0) % 5) == 0), C("darkwood", 3))
    g.where(rear & (y >= 45) & (y <= 54) & (((z - HZ0) % 5) == 1), C("rust", 5))
    g.where(rear & (y >= 32) & (y <= 34), C("gold", 4))
    for sz in (HZ0 - 2, HZ1 + 1):  # side braids with gold rings
        for yy in range(32, 50, 4):
            g.box(FACE_X - 5, yy, sz, FACE_X - 2, yy + 3, sz + 1, C("rust", 3 + (yy // 4) % 2))
            g.set(FACE_X - 5, yy + 1, sz, C("wood", 5))
        for yy in (35, 44):
            g.box(FACE_X - 5, yy, sz, FACE_X - 2, yy + 1, sz + 1, C("gold", 5))
        g.box(FACE_X - 4, 30, sz, FACE_X - 3, 32, sz + 1, C("gold", 5))
    return rig_part("hair fantasy-2", g, "Braided Warrior Hair")


def topknot():
    g = rig_grid()
    x, y, z = _xyz()
    cap = (shell(["Head"], 1) & (y >= 52)) | (shell(["Head"], 1) & (x <= HX0 + 5) & (y >= 44))
    g.where(cap, C("iron", 1))
    g.box(17, 59, 34, 24, 63, 42, C("iron", 1))  # bun
    g.box(18, 63, 35, 23, 66, 41, C("iron", 2))
    g.box(20, 64, 29, 21, 65, 49, C("gold", 5))  # hairpin
    g.set(20, 64, 28, C("red", 5)).set(20, 64, 49, C("red", 5))
    return rig_part("hair fantasy-3", g, "Elven Topknot")


# ---------------------------------------------------------------- facial hair
def dwarf_beard():
    g = rig_grid()
    x, y, z = _xyz()
    for k in range(9):
        w = 9 - k // 2
        g.box(FACE_X - 1, 43 - k * 2, 38 - w, FACE_X + 3, 45 - k * 2, 38 + w, C("wood", 3 if k % 2 else 4))
        g.where((g.a != 0) & (y == 43 - k * 2) & (z >= 38 - w + 1) & (z < 38 + w - 1), C("rust", 4))
    g.box(FACE_X + 1, 43, 33, FACE_X + 3, 46, 43, C("rust", 5))  # moustache
    for zb in (33, 42):
        g.box(FACE_X, 17, zb, FACE_X + 3, 27, zb + 3, C("wood", 3))
        for yy in (19, 24):
            g.box(FACE_X, yy, zb, FACE_X + 3, yy + 2, zb + 3, C("gold", 5))
    return rig_part("facialhair fantasy-1", g, "Braided Dwarf Beard")


def wizard_beard():
    g = rig_grid()
    x, y, z = _xyz()
    for k in range(12):
        w = 6 - k // 2.5
        g.box(FACE_X - 1, 43 - k * 2, 38 - w, FACE_X + 2, 45 - k * 2, 38 + w, C("bone", 6 if k % 2 else 7))
        if k < 9:
            g.where((g.a != 0) & (y == 43 - k * 2) & (z == 38 - w), C("bone", 5))
    g.box(FACE_X + 1, 43, 32, FACE_X + 3, 45, 44, C("bone", 7))
    g.box(FACE_X, 19, 37, FACE_X + 2, 21, 39, C("gold", 5))
    g.box(FACE_X + 1, 25, 37, FACE_X + 2, 27, 39, C("gold", 4))
    return rig_part("facialhair fantasy-2", g, "Wizard Beard")


# ---------------------------------------------------------------- eyewear
def monocle():
    g = rig_grid()
    for yy in range(46, 52):
        for zz in range(41, 47):
            if 6 <= (yy - 48.5) ** 2 + (zz - 43.5) ** 2 <= 10:
                    g.set(FACE_X + 1, yy, zz, C("gold", 5))
    g.box(FACE_X + 1, 48, 43, FACE_X + 2, 50, 45, C("sky", 6))
    g.set(FACE_X + 1, 49, 44, C("plasma", 7))
    for k in range(7):  # short chain to the cheek
        g.set(FACE_X + 1, 45 - k, 46 + (k % 2), C("gold", 4))
    return rig_part("eyewear fantasy-1", g, "Arcane Monocle")


def moon_spectacles():
    g = rig_grid()
    for zc in (32.5, 43.5):
        for yy in range(45, 53):
            for zz in range(28, 49):
                if 4 <= (yy - 48.5) ** 2 + (zz - zc) ** 2 <= 10:
                    g.set(FACE_X + 1, yy, zz, C("gold", 5))
    g.box(FACE_X + 1, 49, 35, FACE_X + 2, 50, 41, C("gold", 6))
    # The gold rings stay on the lens plane so the frames sit close to the face.
    for zz in (27, 48):
        g.box(24, 49, zz, FACE_X + 1, 50, zz + 1, C("wood", 4))
    g.box(FACE_X + 1, 50, 33, FACE_X + 2, 51, 34, C("sky", 6)).box(FACE_X + 1, 50, 43, FACE_X + 2, 51, 44, C("sky", 6))
    return rig_part("eyewear fantasy-2", g, "Moon Spectacles")


def eyepatch():
    g = rig_grid()
    x, y, z = _xyz()
    g.box(FACE_X + 1, 46, 30, FACE_X + 2, 52, 36, C("darkwood", 2))
    g.box(FACE_X + 1, 48, 32, FACE_X + 2, 50, 34, C("gold", 5))  # rune stud
    strap = shell(["Head"], 1) & (np.abs((y - 50) - (z - 38) * 0.35) < 0.8)
    g.where(strap, C("darkwood", 3))
    return rig_part("eyewear fantasy-3", g, "Rune Eyepatch")


# ---------------------------------------------------------------- ears
def elf_ears():
    g = rig_grid()
    x, y, z = _xyz()
    for sign, z0 in ((-1, HZ0 - 1), (1, HZ1 + 1)):
        for k in range(8):
            zz = z0 + sign * k
            y0 = 44 + k
            x0 = 20 - k // 2
            h = max(2, 7 - k // 2)
            g.box(x0, y0, zz, x0 + 3, y0 + h, zz + 1, C("skin", 5 if k < 6 else 4))
            if k % 2 == 0:
                g.box(x0, y0 + 1, zz, x0 + 1, y0 + h - 1, zz + 1, C("skindark", 3))
            if k < 5:
                g.box(x0 + 1, y0 + 1, zz, x0 + 2, y0 + h - 1, zz + 1, C("pink", 4))
        g.where((g.a != 0) & (x >= 19) & (x <= 22) & (y >= 45) & (y <= 46) & (z == z0 + sign), C("gold", 5))
    return rig_part("ears fantasy-1", g, "Elf Ears")


def high_elf_ears():
    g = rig_grid()
    for sign, z0 in ((-1, HZ0 - 1), (1, HZ1 + 1)):
        for k in range(11):
            zz = z0 + sign * (k * 2 // 3)
            y0 = 44 + k
            x0 = 20 - k // 2
            h = max(2, 7 - k // 2)
            g.box(x0, y0, zz, x0 + 3, y0 + h, zz + 1, C("skin", 5))
            if k < 6:
                g.box(x0 + 1, y0 + 1, zz, x0 + 2, y0 + h - 1, zz + 1, C("pink", 5))
        g.box(18, 47, z0 + sign * 2, 22, 49, z0 + sign * 2 + 1, C("gold", 5))  # gold cuffs
        g.set(19, 46, z0 + sign * 1, C("plasma", 6))
    return rig_part("ears fantasy-2", g, "High-Elf Ears")


# ---------------------------------------------------------------- face / eyebrows
def _eyes(g, iris, glint, mouth):
    for z0 in (31, 43):
        g.box(FACE_X + 1, 47, z0, FACE_X + 2, 51, z0 + 2, iris)
        g.set(FACE_X + 1, 50, z0 + (1 if z0 < 38 else 0), glint)
    g.box(FACE_X + 1, 41, 36, FACE_X + 2, 42, 41, mouth)


def elven_face():
    g = rig_grid()
    _eyes(g, C("forest", 3), C("gold", 7), C("skindark", 3))
    for zz in (31, 44):  # small paired rune marks
        g.box(FACE_X + 1, 44, zz, FACE_X + 2, 46, zz + 1, C("plasma", 5))
    g.box(FACE_X + 1, 52, 38, FACE_X + 2, 53, 39, C("gold", 6))
    return rig_part("face fantasy-1", g, "Elven Rune Face")


def druid_face():
    g = rig_grid()
    _eyes(g, C("wood", 2), C("sky", 7), C("skindark", 3))
    # One small forehead leaf keeps the face clear at thumbnail size.
    g.box(FACE_X + 1, 54, 37, FACE_X + 2, 56, 40, C("leaf", 5))
    g.set(FACE_X + 1, 55, 38, C("gold", 6))
    return rig_part("face fantasy-2", g, "Druid Leaf Paint")


def elven_brows():
    g = rig_grid()
    for sign, z0 in ((1, 30), (-1, 46)):
        for k in range(5):
            zz = z0 + sign * k
            g.box(FACE_X + 1, 53 + (k // 2 if k < 4 else 1), zz, FACE_X + 2, 54 + (k // 2 if k < 4 else 1), zz + 1, C("wood", 4))
    for zz in (30, 46):
        g.set(FACE_X + 1, 53, zz, C("gold", 5))
    return rig_part("eyebrow fantasy-1", g, "Arched Elven Brows")


# ---------------------------------------------------------------- tops
def cuirass():
    g = rig_grid()
    x, y, z = _xyz()
    torso = shell(["Chest", "Body"], 1) & (y >= 16)
    g.where(torso, C("steel", 5))
    g.where(torso & (x >= 24) & (np.abs(z - 37.5) < 1), C("steel", 7))  # ridge
    g.where(torso & ((y == 22) | (y == 28)) & (x >= 24), C("steel", 4))  # lames
    g.where(torso & (y >= 16) & (y < 18), C("darkwood", 3))
    g.box(24, 16, 36, 25, 18, 40, C("gold", 5))
    sleeves = shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1)
    g.where(sleeves, C("iron", 5))
    for (z0, z1) in ((24, 32), (44, 52)):
        pad = dilate(region(["Arm.L" if z0 < 30 else "Arm.R"]) | region(["Chest"]), 2) & ~body() & (z >= z0) & (z < z1) & (y >= 30)
        g.where(pad, C("steel", 6))
        g.where(pad & (y == 30), C("gold", 4))
    g.where(shell(["ForeArm.L", "ForeArm.R"], 1) & ((z <= 16) | (z >= 59)), C("steel", 5))  # vambraces
    return rig_part("tops fantasy-1", g, "Plate Cuirass")


def ranger_jerkin():
    g = rig_grid()
    x, y, z = _xyz()
    torso = shell(["Chest", "Body"], 1) & (y >= 15)
    g.where(torso, C("wood", 4))
    # A fitted leather front panel, dark seams, and one clear diagonal strap.
    panel = torso & (x >= 23) & (z >= 32) & (z <= 43) & (y >= 19)
    g.where(panel, C("wood", 5))
    g.where(panel & ((z == 32) | (z == 43) | (y == 19)), C("darkwood", 3))
    g.where(torso & (np.abs((y - 16) - (z - 29) * 0.85) < 1.0) & (x >= 23), C("darkwood", 3))
    g.where(torso & (np.abs((y - 17) - (z - 29) * 0.85) < 0.6) & (x >= 24), C("wood", 6))
    g.where(torso & (y >= 16) & (y < 18), C("darkwood", 3))
    g.box(24, 17, 36, 25, 19, 40, C("gold", 5))
    g.box(25, 17, 37, 26, 19, 39, C("wood", 3))
    g.box(24, 24, 37, 25, 32, 38, C("wood", 6))
    sleeves = shell(["Arm.L", "Arm.R"], 1)
    g.where(sleeves, C("forest", 3))
    g.where(sleeves & (y >= 31) & (y <= 34), C("leaf", 4))
    bracers = shell(["ForeArm.L", "ForeArm.R"], 1)
    g.where(bracers, C("wood", 4))
    g.where(bracers & ((y == 22) | (y == 29)), C("darkwood", 3))
    g.where(bracers & (y >= 24) & (y <= 27) & ((z == 15) | (z == 60)), C("gold", 5))
    mantle = shell(["Chest"], 2) & (y >= 31) & (y < 37) & ~region(["Head"])
    g.where(mantle & (g.a == 0), C("forest", 4))
    g.where(mantle & (y == 31), C("leaf", 5))
    return rig_part("tops fantasy-2", g, "Ranger Jerkin")


def mage_robe_top():
    g = rig_grid()
    x, y, z = _xyz()
    torso = shell(["Chest", "Body"], 1) & (y >= 15)
    g.where(torso, C("purple", 3))
    g.where(torso & (np.abs(z - 37.5) < 2.5) & (x >= 24), C("bone", 6))
    g.where(torso & (y >= 17) & (y < 20), C("arcane", 4))
    sleeves = shell(["Arm.L", "Arm.R"], 1)
    g.where(sleeves, C("purple", 4))
    bell = shell(["ForeArm.L", "ForeArm.R"], 2) & (y <= 35)
    g.where(bell, C("purple", 4))
    g.where(bell & ((z == 14) | (z == 13) | (z == 61) | (z == 62)), C("gold", 5))
    collar = shell(["Chest"], 2) & (y >= 33) & (y < 39) & (x < FACE_X - 3) & ~region(["Head"])
    g.where(collar & (g.a == 0), C("purple", 5))
    g.where(collar & (y >= 38), C("gold", 5))
    for zz in (32, 43):
        g.box(24, 26, zz, 25, 29, zz + 1, C("gold", 6))
        g.box(24, 27, zz - 1, 25, 28, zz + 2, C("gold", 6))
    return rig_part("tops fantasy-3", g, "Mage Robe")


def paladin_tabard():
    g = rig_grid()
    x, y, z = _xyz()
    torso = shell(["Chest", "Body"], 1) & (y >= 15)
    g.where(torso, C("steel", 5))
    tab = torso & (np.abs(z - 37.5) < 6) & (x >= 23)
    g.where(tab, C("bone", 7))
    g.where(tab & (np.abs(z - 37.5) < 1.2) & (y >= 19) & (y < 32), C("blue", 3))
    g.where(tab & (y >= 25) & (y < 27) & (np.abs(z - 37.5) < 4.5), C("blue", 3))
    g.where(tab & (y >= 25) & (y < 27) & (np.abs(z - 37.5) < 1.2), C("gold", 6))
    g.where(torso & (y >= 16) & (y < 18), C("wood", 3))
    g.box(24, 16, 36, 26, 18, 40, C("gold", 5))
    g.where(shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1), C("steel", 4))
    # Compact shoulder caps replace the thin, fanned plate strips.
    for z0, z1 in ((22, 31), (45, 54)):
        pad = dilate(region(["Arm.L" if z0 < 30 else "Arm.R"]), 1) & ~body() & (z >= z0) & (z < z1) & (y >= 30) & (y <= 36)
        g.where(pad, C("steel", 6))
        g.where(pad & (y == 30), C("darkwood", 3))
        g.where(pad & (y == 35), C("steel", 5))
        g.where(pad & (x >= 25) & (y >= 32), C("steel", 7))
        g.where(pad & (y == 31) & (x >= 25), C("steel", 3))
        for zz in (z0 + 2, z1 - 3):
            g.where(pad & (x == 25) & (y == 33) & (z == zz), C("gold", 6))
    return rig_part("tops fantasy-4", g, "Paladin Tabard")


def hauberk():
    g = rig_grid()
    x, y, z = _xyz()
    m = shell(["Chest", "Body", "Arm.L", "Arm.R"], 1) & (y >= 14)
    g.where(m, C("steel", 5))
    g.where(m & ((y % 3) == 0), C("steel", 4))
    g.where(m & (x >= 24) & (y >= 20) & (y <= 29) & ((z % 5) == 0), C("steel", 6))
    g.where(m & (y >= 14) & (y < 16), C("darkwood", 3))
    g.where(m & (x >= 24) & (y >= 20) & (y < 31) & (z == 38), C("gold", 4))
    coif = shell(["Chest"], 2) & (y >= 33) & (y < 37) & ~region(["Head"])
    g.where(coif & (g.a == 0), C("steel", 4))
    g.where(coif & (g.a != 0) & ((z == 31) | (z == 44)), C("gold", 4))
    g.where(shell(["Body"], 1) & (y >= 18) & (y < 20), C("wood", 3))
    g.box(24, 18, 37, 25, 20, 39, C("gold", 5))
    return rig_part("tops fantasy-5", g, "Chainmail Hauberk")


# ---------------------------------------------------------------- bottoms
LEGS = ["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]


def greaves():
    g = rig_grid()
    x, y, z = _xyz()
    legs = shell(LEGS, 1) | (shell(["Body"], 1) & (y < 19))
    g.where(legs, C("steel", 4))
    g.where(legs & (y >= 9) & (y < 11), C("gold", 4))
    g.where(legs & (x >= 24) & (y < 9), C("steel", 6))
    g.where(legs & (y >= 15) & (y < 17), C("wood", 3))
    return rig_part("bottoms fantasy-1", g, "Iron Greaves")


def breeches():
    g = rig_grid()
    x, y, z = _xyz()
    legs = shell(LEGS, 1) | (shell(["Body"], 1) & (y < 18))
    g.where(legs, C("wood", 4))
    g.where(legs & ((y % 5) == 0), C("wood", 3))
    g.where(legs & (x >= 24) & (y >= 9) & (y < 13), C("wood", 6))  # leather knee guards
    g.where(legs & (y >= 16), C("darkwood", 3))
    return rig_part("bottoms fantasy-2", g, "Leather Breeches")


def robe_skirt():
    g = rig_grid()
    x, y, z = _xyz()
    B = body()
    lower_body = B & (y >= 8) & (y < 17) & ~region(["Arm.L", "Arm.R", "Hand.L", "Hand.R", "ForeArm.L", "ForeArm.R"])
    for yy in range(8, 17):
        ring = dilate(lower_body, 1) & (y == yy) & ~B
        g.where(ring, C("rust", 4))
        g.where(ring & (x >= 27) & ((z % 7) == 0), C("wood", 5))
    # Open the front between the legs. Two short apron panels frame the split.
    front = (g.a != 0) & (x >= 27) & (y >= 9) & (y < 15)
    g.where(front & (z >= 36) & (z <= 39), 0)
    for z0, z1 in leg_z_ranges().values():
        panel = (g.a != 0) & (x >= 27) & (y >= 9) & (y < 15) & (z >= z0 + 1) & (z < z1 - 1)
        g.where(panel, C("blue", 4))
        g.where(panel & ((y == 9) | (z == z0 + 1) | (z == z1 - 2)), C("gold", 5))
    return rig_part("bottoms fantasy-3", g, "Mage Robe Skirt")


def chain_skirt():
    g = rig_grid()
    x, y, z = _xyz()
    skirt = shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 9) & (y < 18)
    g.where(skirt, C("steel", 5))
    g.where(skirt & ((y % 4) == 0), C("steel", 3))
    g.where(skirt & (y >= 10) & (y <= 15) & (x >= 24) & (z == 31), C("steel", 6))
    g.where(shell(LEGS, 1) & (y < 9), C("wood", 4))
    tassets = shell(["Body", "Leg.L", "Leg.R"], 2) & ~shell(["Body", "Leg.L", "Leg.R"], 1) & (y >= 12) & (y < 17) & (x >= 23)
    g.where(tassets, C("wood", 5))
    g.where(tassets & (y == 12), C("gold", 5))
    g.where(tassets & (z == 38), C("red", 6))
    g.where(tassets & (z == 37) & (y >= 13), C("darkwood", 3))
    return rig_part("bottoms fantasy-4", g, "Chain Skirt")


# ---------------------------------------------------------------- shoes
def sabatons():
    g = rig_grid()
    x, y, z = _xyz()
    for z0, z1 in leg_z_ranges().values():
        g.box(15, 0, z0, 28, 1, z1, C("darkwood", 3))
        g.box(15, 2, z0, 28, 7, z1, C("steel", 5))
        g.box(23, 1, z0 + 1, 29, 4, z1 - 1, C("steel", 6))
        g.where((g.a != 0) & (y == 3) & (x >= 24), C("steel", 7))
        g.where((g.a != 0) & (y == 5) & (x == 18) & ((z == z0) | (z == z1 - 1)), C("gold", 5))
    return rig_part("shoes fantasy-1", g, "Steel Sabatons")


def elven_boots():
    g = rig_grid()
    x, y, z = _xyz()
    for z0, z1 in leg_z_ranges().values():
        # One closed leather boot with a dark sole and a joined toe cap.
        g.box(15, 0, z0 - 1, 29, 1, z1 + 1, C("darkwood", 2))
        g.box(15, 1, z0, 28, 7, z1, C("wood", 4))
        g.box(23, 1, z0 + 1, 29, 4, z1 - 1, C("rust", 4))
        g.box(15, 6, z0, 28, 7, z1, C("darkwood", 4))
        # The gold clasps sit on the outer ankles above the sole.
        for zz in (z0, z1 - 1):
            g.box(19, 4, zz, 22, 6, zz + 1, C("gold", 5))
        g.where((g.a != 0) & (x >= 23) & (y >= 2) & (y <= 3), C("wood", 5))
    return rig_part("shoes fantasy-2", g, "Elven Boots")


def slippers():
    g = rig_grid()
    for z0, z1 in leg_z_ranges().values():
        g.box(15, 0, z0 - 1, 27, 3, z1 + 1, C("purple", 3))
        g.box(15, 3, z0 - 1, 22, 5, z1 + 1, C("purple", 3))
        g.box(27, 1, z0 + 2, 29, 3, z1 - 2, C("purple", 3))
        g.box(28, 3, z0 + 3, 30, 5, z1 - 3, C("gold", 5))  # curled toe
        g.box(15, 2, z0 - 1, 27, 3, z1 + 1, C("gold", 4))
    return rig_part("shoes fantasy-3", g, "Wizard Slippers")


# ---------------------------------------------------------------- back
def royal_cape():
    g = rig_grid()
    for yy in range(10, 36):
        spread = 9 + (36 - yy) // 5
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("red", 3 if yy % 5 else 2))
        g.set(13, yy, 38 - spread, C("gold", 5)).set(13, yy, 37 + spread, C("gold", 5))
    g.box(12, 10, 24, 15, 11, 52, C("bone", 7))  # ermine hem
    for zz in range(25, 52, 3):
        g.set(12, 10, zz, C("iron", 0))
    g.box(13, 33, 26, 16, 37, 50, C("bone", 7))  # ermine collar
    g.box(15, 34, 28, 17, 36, 48, C("gold", 4))
    return rig_part("back fantasy-1", g, "Royal Cape")


def quiver():
    g = rig_grid()
    x, y, z = _xyz()
    # A short wooden case rests against the rear hip, below the hair curtain.
    g.box(8, 12, 38, 13, 25, 44, C("wood", 4))
    g.where((g.a != 0) & (x == 8) & ((z % 3) == 0), C("darkwood", 3))
    g.where((g.a != 0) & (x == 12) & ((y % 4) == 0), C("wood", 6))
    g.box(8, 13, 38, 13, 15, 44, C("gold", 5))
    g.box(8, 21, 38, 13, 23, 44, C("darkwood", 3))
    # Three short arrow fletches rise from the case mouth.
    for i, zz in enumerate((39, 41, 43)):
        g.box(9, 24, zz, 11, 29, zz + 1, C(("red", "bone", "blue")[i], 6))
    # Painted strap and buckle hold the case at the belt line.
    strap = (g.a != 0) & (x == 12) & (y >= 14) & (y <= 21) & (np.abs((y - 14) + (z - 44) * 0.72) < 1.1)
    g.where(strap, C("darkwood", 3))
    buckle = strap & (y >= 17) & (y <= 18) & (z >= 40) & (z <= 42)
    g.where(buckle, C("gold", 6))
    return rig_part("back fantasy-2", g, "Ranger Quiver")


def fairy_wings():
    g = rig_grid()
    for sign in (-1, 1):
        for yy in range(14, 44):
            t = (yy - 14) / 30
            spread = int(4 + 22 * math.sin(t * math.pi) ** 0.8 * (1.0 if t > 0.35 else 0.75))
            for k in range(2, spread):
                zz = 38 + sign * k
                if 0 <= zz < 76:
                    edge = k >= spread - 1
                    vein = (k + yy) % 7 == 0
                    col = C("plasma", 7) if edge else C("sky", 6 if yy > 29 else 5)
                    g.set(11 - k // 8, yy, zz, col)
    g.box(12, 24, 36, 15, 34, 40, C("sky", 4))
    return rig_part("back fantasy-3", g, "Fairy Wings")


def round_shield():
    g = rig_grid()
    x, y, z = _xyz()
    for yy in range(12, 36):
        for zz in range(26, 50):
            d = math.hypot(yy - 23.5, zz - 37.5)
            if d > 11.5:
                continue
            if d > 10.3:
                c = C("wood", 4)
            elif d < 2:
                c = C("gold", 6)
            else:
                ang = math.atan2(yy - 23.5, zz - 37.5)
                c = C("red", 4) if int((ang + math.pi) / (math.pi / 4)) % 2 else C("bone", 6)
            g.set(13, yy, zz, c)
            g.set(14, yy, zz, C("darkwood", 3))
    # Outer painted rim, boss, and broad cross straps.
    for yy in range(13, 35):
        for zz in range(27, 49):
            d = math.hypot(yy - 23.5, zz - 37.5)
            if 9.5 <= d <= 10.5:
                g.set(13, yy, zz, C("gold", 5))
    g.box(12, 22, 36, 13, 26, 40, C("gold", 5))
    g.box(12, 23, 37, 13, 25, 39, C("red", 6))
    # The reverse face has a painted plank field and four brass rivets.
    for yy in range(14, 34, 4):
        g.where((g.a != 0) & (x == 14) & (y == yy), C("wood", 4))
    for yy, zz in ((13, 37), (23, 26), (23, 49), (34, 37)):
        g.set(14, yy, zz, C("gold", 6))
    g.set(14, 23, 38, C("red", 5))
    return rig_part("back fantasy-4", g, "Round Shield (Back)")


def starry_cape():
    g = rig_grid()
    for yy in range(4, 36):
        spread = 9 + (36 - yy) // 4
        g.box(13, yy, 38 - spread, 14, yy + 1, 38 + spread, C("blue", 3))
        # Restrained constellations: fixed motifs with clear spacing.
        for sy, sz in ((8, 31), (12, 43), (17, 36), (22, 46), (27, 32), (31, 40)):
            if yy == sy:
                g.set(14, yy, sz, C("gold", 7))
                if sz > 25:
                    g.set(14, yy, sz - 1, C("sky", 5))
                    g.set(14, yy, sz + 1, C("sky", 5))
    # Gold piping frames one continuous cloth face and a weighted hem.
    for yy in range(5, 35):
        spread = 9 + (36 - yy) // 4
        g.set(14, yy, 38 - spread, C("gold", 5))
        g.set(14, yy, 37 + spread, C("gold", 5))
    g.box(12, 4, 22, 14, 5, 54, C("gold", 5))
    g.box(13, 33, 26, 15, 36, 50, C("wood", 4))
    g.box(14, 34, 36, 15, 36, 40, C("plasma", 6))
    return rig_part("back fantasy-5", g, "Starry Mage Cape")


PARTS = [circlet, winged_helm, wizard_hat, ranger_hood, royal_crown, horned_helm, flower_crown,
         silver_hair, braided_hair, topknot, dwarf_beard, wizard_beard, monocle, moon_spectacles, eyepatch,
         elf_ears, high_elf_ears, elven_face, druid_face, elven_brows,
         cuirass, ranger_jerkin, mage_robe_top, paladin_tabard, hauberk,
         greaves, breeches, robe_skirt, chain_skirt, sabatons, elven_boots, slippers,
         royal_cape, quiver, fairy_wings, round_shield, starry_cape]


# ---------------------------------------------------------------- clips
def k(*pairs):
    return [(t, (a, b, c)) for t, a, b, c in pairs]


def clips():
    # Rotations are about rig axes: +X forward, +Y up, +Z along the right arm.
    # Arm.R forward (0, 90, 0), up (-90, 0, 0), down (75, 0, 0); Arm.L mirrors (0, -90, 0), (90, 0, 0), (-75, 0, 0).
    # Leg forward (0, 0, +a); torso/head lean forward (0, 0, -a); Head turn left (0, +a, 0).
    cast = {
        "Arm.R": {"rot": k((0.0, 0, 0, 0), (0.3, 0, 75, 20), (0.45, 0, 90, 10), (0.9, 0, 90, 10), (1.2, 0, 0, 0))},
        "Arm.L": {"rot": k((0.0, 0, 0, 0), (0.3, 0, -60, -30), (0.45, 0, -75, -15), (0.9, 0, -75, -15), (1.2, 0, 0, 0))},
        "Chest": {"rot": k((0.0, 0, 0, 0), (0.3, 0, 0, -6), (0.9, 0, 0, -6), (1.2, 0, 0, 0))},
        "Head": {"rot": k((0.0, 0, 0, 0), (0.3, 0, 0, 8), (0.9, 0, 0, 8), (1.2, 0, 0, 0))},
    }
    block = {
        "Arm.L": {"rot": k((0.0, 0, 0, 0), (0.15, 0, -80, 0), (0.6, 0, -80, 0), (0.8, 0, 0, 0))},
        "ForeArm.L": {"rot": k((0.0, 0, 0, 0), (0.15, 0, -70, 0), (0.6, 0, -70, 0), (0.8, 0, 0, 0))},
        "Root": {"loc": k((0.0, 0, 0, 0), (0.15, 0, -2, 0), (0.6, 0, -2, 0), (0.8, 0, 0, 0))},
        "Chest": {"rot": k((0.0, 0, 0, 0), (0.15, 0, -10, -4), (0.6, 0, -10, -4), (0.8, 0, 0, 0))},
    }
    bow = {
        "Arm.L": {"rot": k((0, 0, 0, 0), (0.3, 0, -90, 0), (1.4, 0, -90, 0), (1.7, 0, 0, 0))},
        "Arm.R": {"rot": k((0, 0, 0, 0), (0.3, 0, 60, 0), (0.8, 0, -15, 0), (1.3, 0, -15, 0), (1.4, 0, 60, 0), (1.7, 0, 0, 0))},
        "ForeArm.R": {"rot": k((0, 0, 0, 0), (0.3, 0, 30, 0), (0.8, 0, 150, 0), (1.3, 0, 150, 0), (1.4, 0, 20, 0), (1.7, 0, 0, 0))},
        "Chest": {"rot": k((0, 0, 0, 0), (0.3, 0, 30, 0), (1.4, 0, 30, 0), (1.7, 0, 0, 0))},
        "Head": {"rot": k((0, 0, 0, 0), (0.3, 0, 45, 0), (1.4, 0, 45, 0), (1.7, 0, 0, 0))},
    }
    slash = {
        "Arm.R": {"rot": k((0, 0, 0, 0), (0.25, -80, 20, 0), (0.4, 45, 70, 0), (0.55, 55, 60, 0), (0.9, 0, 0, 0))},
        "ForeArm.R": {"rot": k((0, 0, 0, 0), (0.25, 0, 40, 0), (0.4, 0, 0, 0), (0.9, 0, 0, 0))},
        "Chest": {"rot": k((0, 0, 0, 0), (0.25, 0, -25, 5), (0.4, 0, 30, -10), (0.55, 0, 35, -12), (0.9, 0, 0, 0))},
        "Arm.L": {"rot": k((0, 0, 0, 0), (0.25, 0, -30, 0), (0.4, -40, 0, 0), (0.9, 0, 0, 0))},
        "Leg.R": {"rot": k((0, 0, 0, 0), (0.4, 0, 0, -15), (0.9, 0, 0, 0))},
        "Leg.L": {"rot": k((0, 0, 0, 0), (0.4, 0, 0, 20), (0.9, 0, 0, 0))},
    }
    heal = {
        "Arm.R": {"rot": k((0, 0, 0, 0), (0.5, -55, 50, 0), (1.5, -55, 50, 0), (2.0, 0, 0, 0))},
        "Arm.L": {"rot": k((0, 0, 0, 0), (0.5, 55, -50, 0), (1.5, 55, -50, 0), (2.0, 0, 0, 0))},
        "Head": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, 20), (1.5, 0, 0, 20), (2.0, 0, 0, 0))},
        "Chest": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, 8), (1.5, 0, 0, 8), (2.0, 0, 0, 0))},
        "Root": {"loc": k((0, 0, 0, 0), (0.5, 0, 2, 0), (1.0, 0, 3, 0), (1.5, 0, 2, 0), (2.0, 0, 0, 0))},
    }
    kneel = {
        "Root": {"loc": k((0, 0, 0, 0), (0.5, 0, -6, 0), (2.0, 0, -6, 0), (2.5, 0, 0, 0))},
        "Leg.L": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, 80), (2.0, 0, 0, 80), (2.5, 0, 0, 0))},
        "LowerLeg.L": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, -85), (2.0, 0, 0, -85), (2.5, 0, 0, 0))},
        "Leg.R": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, -5), (2.0, 0, 0, -5), (2.5, 0, 0, 0))},
        "LowerLeg.R": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, -90), (2.0, 0, 0, -90), (2.5, 0, 0, 0))},
        "Chest": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, -6), (2.0, 0, 0, -6), (2.5, 0, 0, 0))},
        "Head": {"rot": k((0, 0, 0, 0), (0.5, 0, 0, -15), (2.0, 0, 0, -15), (2.5, 0, 0, 0))},
        "Arm.R": {"rot": k((0, 0, 0, 0), (0.5, 60, 50, 0), (2.0, 60, 50, 0), (2.5, 0, 0, 0))},
        "ForeArm.R": {"rot": k((0, 0, 0, 0), (0.5, 0, 60, 0), (2.0, 0, 60, 0), (2.5, 0, 0, 0))},
        "Arm.L": {"rot": k((0, 0, 0, 0), (0.5, -70, 0, 0), (2.0, -70, 0, 0), (2.5, 0, 0, 0))},
    }
    levitate = {
        "Root": {"loc": [(t, (0, 7 + 1.5 * math.sin(t / 3.0 * 2 * math.pi), 0)) for t in (0, 0.75, 1.5, 2.25, 3.0)]},
        "LowerLeg.L": {"rot": k((0, 0, 0, -35), (1.5, 0, 0, -45), (3.0, 0, 0, -35))},
        "LowerLeg.R": {"rot": k((0, 0, 0, -25), (1.5, 0, 0, -35), (3.0, 0, 0, -25))},
        "Leg.L": {"rot": k((0, 0, 0, 15), (1.5, 0, 0, 20), (3.0, 0, 0, 15))},
        "Arm.R": {"rot": k((0, 40, 20, 0), (1.5, 30, 20, 0), (3.0, 40, 20, 0))},
        "Arm.L": {"rot": k((0, -40, -20, 0), (1.5, -30, -20, 0), (3.0, -40, -20, 0))},
        "Head": {"rot": k((0, 0, 0, 10), (1.5, 0, 0, 14), (3.0, 0, 0, 10))},
    }
    victory = {
        "Arm.R": {"rot": k((0, 0, 0, 0), (0.25, -65, 35, 0), (0.45, -45, 35, 0), (0.65, -65, 35, 0), (0.85, -45, 35, 0), (1.3, 0, 0, 0))},
        "ForeArm.R": {"rot": k((0, 0, 0, 0), (0.25, 0, 0, 0), (0.45, -35, 0, 0), (0.65, 0, 0, 0), (1.3, 0, 0, 0))},
        "Arm.L": {"rot": k((0, 0, 0, 0), (0.25, -70, -20, 0), (1.0, -70, -20, 0), (1.3, 0, 0, 0))},
        "Root": {"loc": k((0, 0, 0, 0), (0.2, 0, -2, 0), (0.35, 0, 4, 0), (0.5, 0, 0, 0), (1.3, 0, 0, 0))},
        "Head": {"rot": k((0, 0, 0, 0), (0.35, 0, 0, 18), (1.0, 0, 0, 18), (1.3, 0, 0, 0))},
        "Chest": {"rot": k((0, 0, 0, 0), (0.35, 0, 0, 8), (1.0, 0, 0, 8), (1.3, 0, 0, 0))},
    }
    return [Clip("32_Cast_Spell", cast, loop=False), Clip("33_Shield_Block", block, loop=False), Clip("34_Bow_Draw", bow, loop=False),
            Clip("35_Sword_Slash", slash, loop=False), Clip("36_Heal", heal, loop=False), Clip("37_Kneel", kneel, loop=False),
            Clip("38_Levitate", levitate), Clip("39_Victory", victory, loop=False)]


def build() -> Asset:
    root = Part("fantasy-avatar", None)
    for fn in PARTS:
        root.add(fn())
    return Asset(id="fantasy-avatar-parts", pack="fantasy", category="avatar", name="Fantasy Avatar Parts", root=root, clips=clips())
