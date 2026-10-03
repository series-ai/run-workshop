"""Space avatar parts and clips on the PN rig (rig space: faces +X, right
arm +Z). 39 parts over the PN slots plus 8 space clips (40-47)."""
import math

import numpy as np

from _rig import (ARMS, HANDS, HEAD, C, Grid, Part, body, dilate, fill, head_box, leg_z_ranges, region, rig_grid, rpart,
                  rxyz, shell)
from _kit import asset, keys, speck, stripes
from voxgrid import Clip

x, y, z = rxyz()


def hb():
    return head_box()


def helmet_shell(t=2):
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    return dilate(region(HEAD), t) & ~region(HEAD) & (y >= hy0 - 1)


# ------------------------------------------------------------ headwear --
def bubble_helmet():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = helmet_shell(2)
    window = (x >= hx1 - 2) & (y >= hy0 + 2) & (y < hy1 - 3) & (z >= hz0 + 1) & (z < hz1 - 1)
    fill(g, helm & ~window, C("bone", 7))
    fill(g, helm & ~window & (x >= hx1) & dilate(np.broadcast_to(window, g.shape), 1), C("steel", 5))
    fill(g, helm & (y == hy0 - 1), C("steel", 4))
    fill(g, helm & ~window & (y >= hy1 + 1) & (x < hx1 - 2), C("bone", 6))
    for zz in (hz0 - 2, hz1 + 1):
        g.box(18, 44, zz, 24, 50, zz + 1, C("orange", 5))
        g.set(21, 47, zz, C("plasma", 7))
    g.box(17, hy1 + 2, 44, 18, hy1 + 8, 45, C("steel", 5))
    g.set(17, hy1 + 7, 44, C("red", 7))
    return rpart("headwear space-1", g, "Bubble Helmet", hides_hair=True)


def marine_helmet():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 - 1)
    fill(g, helm, C("khaki", 4))
    fill(g, helm & (y >= hy1 - 2), C("khaki", 5))
    g.box(29, 46, 31, 30, 49, 45, C("red", 5))
    g.box(29, 40, 37, 30, 49, 39, C("red", 5))
    g.box(29, 47, 32, 30, 48, 44, C("red", 7))
    g.box(29, 38, 33, 30, 42, 35, C("iron", 2)).box(29, 38, 41, 30, 42, 43, C("iron", 2))
    g.box(16, hy1 + 1, 37, 26, hy1 + 3, 39, C("iron", 2))
    return rpart("headwear space-2", g, "Marine Helmet", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def captain_cap():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    cap = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 5)
    fill(g, cap, C("navy", 3))
    g.box(13, hy1 + 1, 26, 30, hy1 + 3, 50, C("navy", 4))
    g.box(12, hy1 - 5, 26, 30, hy1 - 4, 50, C("iron", 1))
    g.box(28, hy1 - 6, 29, 33, hy1 - 5, 47, C("iron", 1))
    g.box(29, hy1 - 3, 36, 30, hy1 + 1, 40, C("gold", 6))
    g.box(29, hy1 - 4, 30, 30, hy1 - 3, 46, C("gold", 5))
    return rpart("headwear space-3", g, "Captain's Cap", hides_hair=True)


def antenna_band():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    band = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 4) & (y < hy1 - 2)
    fill(g, band, C("magenta", 4))
    for zz, sgn in ((31, -1), (44, 1)):
        g.line((21, hy1, zz), (21, hy1 + 9, zz + sgn * 4), 0.5, C("steel", 6))
        g.sphere(21, hy1 + 10, zz + sgn * 4.5, 1.5, C("toxic", 6))
        g.set(22, hy1 + 11, int(zz + sgn * 4.5), C("toxic", 7))
    return rpart("headwear space-4", g, "Antenna Headband")


def flight_cap():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    cap = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 7) & ~((x >= hx1) & (y < hy1 - 2))
    fill(g, cap, C("darkwood", 4))
    fill(g, cap & (y >= hy1), C("darkwood", 5))
    fill(g, dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 + 4) & (y < hy1 - 6) & (x < 20), C("darkwood", 3))  # ear flaps
    for z0 in (30, 40):  # goggles on the brow
        g.box(29, hy1 - 5, z0, 31, hy1 - 1, z0 + 6, C("gold", 4))
        g.box(31, hy1 - 4, z0 + 1, 32, hy1 - 2, z0 + 5, C("plasma", 6))
    g.box(29, hy1 - 4, 36, 30, hy1 - 2, 40, C("darkwood", 2))
    return rpart("headwear space-5", g, "Flight Cap", hides_hair=True)


def grey_alien_head():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    shellm = dilate(region(HEAD), 1) & (y >= hy0 - 1)
    fill(g, shellm, C("gray", 5))
    g.box(13, hy1, 28, 28, hy1 + 4, 48, C("gray", 5))  # tall stepped cranium
    g.box(14, hy1 + 4, 29, 26, hy1 + 7, 47, C("gray", 5))
    g.box(16, hy1 + 7, 31, 24, hy1 + 9, 45, C("gray", 6))
    g.box(12, hy1 - 2, 27, 13, hy1 + 3, 49, C("gray", 4))
    g.a[region(HEAD)] = 0
    rows = {44: (35, 36), 45: (33, 36), 46: (32, 36), 47: (31, 36), 48: (30, 36), 49: (29, 35), 50: (29, 33)}
    for yy, (z0, z1) in rows.items():
        g.box(29, yy, z0, 30, yy + 1, z1, C("iron", 0))
        g.box(29, yy, 76 - z1, 30, yy + 1, 76 - z0, C("iron", 0))
    g.set(29, 48, 32, C("gray", 7)).set(29, 48, 41, C("gray", 7))
    g.box(29, 41, 37, 30, 42, 39, C("gray", 3))
    return rpart("headwear space-6", g, "Grey Alien Head", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def hunter_helmet():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 - 1)
    fill(g, helm, C("teal", 4))
    fill(g, helm & (y >= hy1 - 2), C("teal", 5))
    fill(g, helm & (x < 20) & (y < hy0 + 8), C("rust", 3))
    g.box(29, 45, 30, 30, 48, 46, C("iron", 0))
    g.box(29, 39, 36, 30, 48, 40, C("iron", 0))
    g.box(20, 50, 49, 24, 52, 51, C("iron", 2))
    g.box(23, 44, 50, 26, 51, 51, C("iron", 2))
    g.set(26, 47, 50, C("red", 7))
    return rpart("headwear space-7", g, "Hunter Helmet", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def robot_head():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 - 1)
    fill(g, helm, C("steel", 6))
    fill(g, helm & ((y % 6) == 0), C("steel", 4))
    g.box(29, 40, 29, 30, 52, 47, C("iron", 1))
    for z0, z1 in ((32, 35), (41, 44)):
        g.box(29, 46, z0, 30, 48, z1, C("plasma", 6))
    for zz in range(35, 41, 2):
        g.box(29, 41, zz, 30, 44, zz + 1, C("steel", 4))
    for zz in (hz0 - 2, hz1 + 1):
        g.box(18, 44, zz, 23, 50, zz + 1, C("iron", 3))
        g.box(20, 50, zz, 21, 58, zz + 1, C("steel", 6))
        g.set(20, 58, zz, C("plasma", 7))
    return rpart("headwear space-8", g, "Robot Head", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


# ---------------------------------------------------------------- hair --
def hair_cap(depth_front: int, top: int):
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    return dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - top) & (x < hx1 - depth_front)


def neon_mohawk():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    fill(g, hair_cap(0, 3) & (z >= 35) & (z < 41), C("magenta", 4))
    for k, xx in enumerate(range(hx0 + 1, hx1 + 1, 2)):
        h = 5 + (3 if 4 < k < 8 else 1)
        g.box(xx, hy1, 36, xx + 2, hy1 + h, 40, C("magenta", 5 if k % 2 else 6))
        g.box(xx, hy1 + h - 1, 37, xx + 2, hy1 + h, 39, C("pink", 7))
    fill(g, hair_cap(4, 12) & ((z < 29) | (z > 46)) & (y < hy1 - 2), C("iron", 2))  # shaved sides
    return rpart("hair space-1", g, "Neon Mohawk")


def silver_bob():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    m = hair_cap(1, 18) | (dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 5))
    fill(g, m, C("steel", 6))
    fill(g, m & ((z % 3) == 0), C("steel", 5))
    g.box(hx1, hy1 - 5, hz0, hx1 + 1, hy1 - 1, hz1, C("steel", 6))  # fringe
    g.box(hx1, hy1 - 5, 38, hx1 + 1, hy1 - 2, 40, C("plasma", 6))  # dyed streak
    return rpart("hair space-2", g, "Silver Bob")


def circuit_buzz():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    m = hair_cap(2, 8)
    fill(g, m, C("iron", 2))
    fill(g, m & (y == hy1) & ((z == 32) | (z == 38) | (z == 44)), C("plasma", 6))
    fill(g, m & (x == hx1 - 3) & (y >= hy1 - 7) & ((z == hz0 - 1) | (z == hz1)), C("plasma", 6))
    return rpart("hair space-3", g, "Circuit Buzz Cut")


def twin_buns():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    m = hair_cap(1, 10)
    fill(g, m, C("arcane", 3))
    for zz in (29, 47):
        g.sphere(20, hy1 + 2, zz, 4, C("arcane", 4))
        g.box(19, hy1 + 1, zz - 5 if zz < 38 else zz + 4, 22, hy1 + 3, zz - 4 if zz < 38 else zz + 5, C("gold", 6))
    g.box(hx1, hy1 - 4, hz0 + 2, hx1 + 1, hy1 - 1, hz1 - 2, C("arcane", 3))
    return rpart("hair space-4", g, "Starlet Twin Buns")


# ---------------------------------------------------------- facial hair --
def cyber_goatee():
    g = rig_grid()
    g.box(29, 37, 35, 30, 41, 41, C("iron", 2))
    g.box(29, 38, 36, 30, 40, 40, C("plasma", 5))
    g.box(29, 41, 34, 30, 42, 36, C("iron", 2)).box(29, 41, 40, 30, 42, 42, C("iron", 2))
    return rpart("facialhair space-1", g, "Cyber Goatee")


def holo_moustache():
    g = rig_grid()
    for zz in range(32, 44):
        dy = 1 if zz in (32, 33, 42, 43) else 0
        g.set(29, 43 - dy, zz, C("cyan", 6 if zz % 2 else 7))
    g.box(29, 43, 34, 30, 44, 42, C("cyan", 5))
    return rpart("facialhair space-2", g, "Holo Moustache")


# ------------------------------------------------------------- eyewear --
def visor_band():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    band = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= 45) & (y < 50)
    fill(g, band & (x >= 20), C("steel", 4))
    g.box(29, 46, 29, 30, 49, 47, C("plasma", 5))
    g.box(29, 47, 30, 30, 48, 46, C("plasma", 7))
    return rpart("eyewear space-1", g, "Visor Band")


def cyber_monocle():
    g = rig_grid()
    g.box(29, 45, 40, 30, 50, 46, C("iron", 2))
    g.box(30, 46, 41, 31, 49, 45, C("red", 5))
    g.set(30, 47, 42, C("red", 7))
    g.box(22, 47, 48, 29, 49, 50, C("iron", 2))
    return rpart("eyewear space-2", g, "Cyber Eyepiece")


def aviator_goggles():
    g = rig_grid()
    band = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= 46) & (y < 48)
    fill(g, band, C("darkwood", 3))
    for z0 in (31, 40):
        g.box(29, 44, z0, 31, 50, z0 + 6, C("gold", 4))
        g.box(31, 45, z0 + 1, 32, 49, z0 + 5, C("sky", 5))
        g.set(31, 48, z0 + 1, C("sky", 7))
    return rpart("eyewear space-3", g, "Aviator Goggles")


def star_shades():
    g = rig_grid()
    for zc in (34, 42):
        for dz, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (-2, 1), (2, 1), (-1, -2), (1, -2), (0, 2)):
            g.set(29, 47 + dy, zc + dz, C("pink", 5))
        g.set(29, 47, zc, C("iron", 1))
    g.box(29, 47, 36, 30, 48, 40, C("pink", 4))
    return rpart("eyewear space-4", g, "Star Shades")


# ---------------------------------------------------------------- ears --
def antenna_ears():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz, sgn in ((hz0 - 1, -1), (hz1, 1)):
        g.box(18, 44, zz, 23, 49, zz + 1, C("lime", 4))
        g.line((20.5, 48, zz + 0.5), (19, 58, zz + 0.5 + sgn * 4), 0.5, C("lime", 5))
        g.sphere(19, 59, zz + 0.5 + sgn * 4, 1.5, C("toxic", 6))
    return rpart("ears space-1", g, "Antenna Ears")


def robot_earcaps():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz in (hz0 - 2, hz1):
        g.box(17, 42, zz, 25, 51, zz + 2, C("steel", 4))
        g.box(19, 44, zz, 23, 49, zz + 2, C("iron", 2))
        g.box(20, 45, zz, 22, 48, zz + 2, C("plasma", 6))
    return rpart("ears space-2", g, "Robot Ear Caps")


def fin_ears():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz, sgn in ((hz0 - 1, -1), (hz1, 1)):
        for k in range(6):
            g.box(16 + k, 42 + k, zz + sgn * (k // 2), 24 - k // 2, 50 + k, zz + sgn * (k // 2) + 1, C("teal", 4 + (k % 2)))
        g.box(16, 43, zz, 23, 44, zz + 1, C("teal", 2))
    return rpart("ears space-3", g, "Alien Fin Ears")


# ---------------------------------------------------------------- face --
def alien_face():
    g = rig_grid()
    rows = {44: (35, 36), 45: (33, 36), 46: (32, 36), 47: (31, 36), 48: (30, 36), 49: (30, 35)}
    for yy, (z0, z1) in rows.items():
        g.box(29, yy, z0, 30, yy + 1, z1, C("iron", 0))
        g.box(29, yy, 76 - z1, 30, yy + 1, 76 - z0, C("iron", 0))
    g.set(29, 48, 32, C("toxic", 7)).set(29, 48, 43, C("toxic", 7))
    g.box(29, 41, 37, 30, 42, 39, C("forest", 2))
    return rpart("face space-1", g, "Xeno Eyes")


def cyborg_plate():
    g = rig_grid()
    g.box(29, 38, 39, 30, 53, 48, C("steel", 5))
    g.box(29, 46, 41, 30, 49, 45, C("iron", 1))
    g.box(29, 47, 42, 30, 48, 44, C("red", 7))
    for yy in (40, 43, 51):
        g.set(29, yy, 46, C("steel", 3))
    g.box(29, 46, 32, 30, 48, 35, C("navy", 1))  # the human eye
    g.box(29, 42, 35, 30, 43, 39, C("skindark", 3))
    return rpart("face space-2", g, "Cyborg Face Plate")


def glow_warpaint():
    g = rig_grid()
    g.box(29, 46, 32, 30, 48, 35, C("navy", 1)).box(29, 46, 41, 30, 48, 44, C("navy", 1))
    for zz in (30, 31, 45, 46):
        g.box(29, 41, zz, 30, 46, zz + 1, C("plasma", 6))
    g.box(29, 50, 36, 30, 53, 40, C("plasma", 6))
    g.set(29, 51, 37, C("plasma", 7))
    g.box(29, 42, 36, 30, 43, 40, C("skindark", 3))
    return rpart("face space-3", g, "Glow War Paint")


# ------------------------------------------------------------- eyebrows --
def chrome_brows():
    g = rig_grid()
    for z0, z1 in ((31, 36), (41, 46)):
        g.box(29, 50, z0, 30, 52, z1, C("steel", 6))
        g.set(29, 51, z0, C("steel", 7))
    return rpart("eyebrow space-1", g, "Chrome Brows")


def glow_brows():
    g = rig_grid()
    for z0, z1, tilt in ((31, 36, 1), (41, 46, -1)):
        for zz in range(z0, z1):
            g.set(29, 50 + (1 if (zz - z0 if tilt > 0 else z1 - 1 - zz) < 2 else 0), zz, C("toxic", 6))
    return rpart("eyebrow space-2", g, "Glow Brows")


# ---------------------------------------------------------------- tops --
def spacesuit_top():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    suit = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 16)
    fill(g, suit, C("bone", 6))
    fill(g, suit & ((y == 16) | (y == 17)), C("orange", 5))
    fill(g, suit & (x >= 24) & (y >= 25) & (y < 31) & (z >= 34) & (z < 42), C("steel", 4))
    for zz, col in ((35, "red"), (37, "gold"), (39, "toxic")):
        g.set(24, 29, zz, C(col, 6))
    fill(g, suit & (y >= 29) & (y < 35) & (z >= 50) & (z < 53), C("navy", 4))
    fill(g, suit & ((z == 17) | (z == 58)), C("orange", 5))
    return rpart("tops space-1", g, "EVA Suit Top")


def marine_armor():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    armor = shell(["Chest", "Body"], 2) & (y < hy0) & (y >= 16)
    fill(g, armor, C("khaki", 4))
    fill(g, armor & (x >= 24) & (y >= 22), C("khaki", 5))
    fill(g, armor & (x >= 24) & (y >= 26) & (y < 28), C("iron", 2))
    fill(g, shell(ARMS, 1), C("khaki", 3))
    for z0, z1 in ((23, 31), (45, 53)):
        g.box(14, 33, z0, 26, 38, z1, C("khaki", 5))
        g.box(14, 33, z0, 26, 34, z1, C("gold", 5))
    g.box(8, 18, 30, 14, 34, 46, C("khaki", 3))
    g.box(8, 30, 36, 9, 32, 40, C("toxic", 7))
    return rpart("tops space-2", g, "Marine Power Armour")


def captain_jacket():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    coat = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 15)
    fill(g, coat, C("navy", 4))
    fill(g, coat & (x >= 24) & (z >= 37) & (z < 39), C("gold", 5))
    for k in range(16):
        g.box(24, 34 - k, 30 + k, 25, 36 - k, 32 + k, C("red", 4))
    for z0, z1 in ((24, 30), (46, 52)):
        g.box(15, 35, z0, 25, 37, z1, C("gold", 5))
        for zz in range(z0, z1, 2):
            g.box(15, 33, zz, 25, 35, zz + 1, C("gold", 4))
    fill(g, coat & ((z == 18) | (z == 57)), C("gold", 5))
    return rpart("tops space-3", g, "Captain's Jacket")


def flight_jacket():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    jk = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 16)
    fill(g, jk, C("darkwood", 5))
    fill(g, jk & (y >= 33), C("bone", 6))  # fleece collar
    fill(g, jk & (x >= 24) & (z == 38), C("steel", 6))  # zip
    fill(g, jk & ((y == 16) | (y == 17)), C("darkwood", 3))
    g.box(24, 27, 41, 25, 31, 45, C("red", 4))  # squadron patch
    g.set(24, 29, 43, C("gold", 6))
    fill(g, jk & ((z == 18) | (z == 57)), C("darkwood", 3))
    return rpart("tops space-4", g, "Flight Jacket")


# ------------------------------------------------------------- bottoms --
def leg_shell(t=1):
    return shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], t) | (shell(["Body"], t) & (y < 19))


def suit_pants():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("bone", 6))
    fill(g, m & (y >= 9) & (y < 11), C("orange", 4))
    fill(g, m & (y >= 17), C("orange", 5))
    return rpart("bottoms space-1", g, "EVA Suit Pants")


def armored_greaves():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("khaki", 3))
    fill(g, m & (x >= 23) & (y >= 6), C("khaki", 5))
    fill(g, m & (y >= 9) & (y < 11) & (x >= 23), C("steel", 5))
    return rpart("bottoms space-2", g, "Armoured Greaves")


def cargo_pants():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("sky", 3))
    for side, (z0, z1) in leg_z_ranges().items():
        zz = z0 - 1 if side == "L" else z1
        g.box(18, 9, zz, 23, 13, zz + 1, C("sky", 2))  # thigh pockets
        g.set(20, 12, zz, C("gold", 5))
    fill(g, m & (y >= 17), C("iron", 2))
    return rpart("bottoms space-3", g, "Cargo Pants")


# --------------------------------------------------------------- shoes --
def boots(c, cuff, sole, height, pad, extra=None):
    g = rig_grid()
    for z0, z1 in leg_z_ranges().values():
        g.box(15 - pad, 0, z0 - pad, 27 + pad, height, z1 + pad, c)
        g.box(15 - pad, height - 1, z0 - pad, 26 + pad, height, z1 + pad, cuff)
        g.box(15 - pad, 0, z0 - pad, 27 + pad, 1, z1 + pad, sole)
        g.box(25 + pad, 0, z0, 28 + pad, 2, z1, cuff)
        if extra:
            extra(g, z0, z1)
    return g


def moon_boots():
    return rpart("shoes space-1", boots(C("bone", 6), C("orange", 5), C("iron", 2), 8, 1), "Moon Boots")


def mag_boots():
    def extra(g, z0, z1):
        g.box(16, 1, z0 - 1, 26, 3, z1 + 1, C("plasma", 5))
        g.box(18, 2, z1 + 1, 24, 3, z1 + 1, C("plasma", 7))
    return rpart("shoes space-2", boots(C("iron", 3), C("steel", 5), C("iron", 1), 7, 1, extra), "Mag Boots")


def jet_boots():
    def extra(g, z0, z1):
        g.box(13, 1, z0 + 1, 15, 5, z1 - 1, C("steel", 4))
        g.box(13, 0, z0 + 2, 15, 1, z1 - 2, C("ember", 6))
        g.box(15, 4, z0, 26, 5, z1, C("red", 5))
    return rpart("shoes space-3", boots(C("red", 4), C("gold", 5), C("iron", 2), 7, 0, extra), "Jet Boots")


# ---------------------------------------------------------------- back --
def jetpack():
    g = rig_grid()
    g.box(10, 20, 31, 16, 34, 45, C("steel", 4))
    g.box(9, 22, 33, 10, 32, 43, C("steel", 3))
    for zc in (33.5, 42.5):
        g.cylinder("y", 10, zc, 3, 16, 34, C("red", 4))
        g.cylinder("y", 10, zc, 3.2, 30, 32, C("gold", 5))
        g.cylinder("y", 10, zc, 2.2, 14, 16, C("iron", 2))
        g.cylinder("y", 10, zc, 1.4, 13, 14, C("ember", 6))
    g.box(12, 34, 36, 14, 37, 40, C("iron", 2))
    return rpart("back space-1", g, "Jetpack")


def oxygen_tanks():
    g = rig_grid()
    for zc in (33.5, 42.5):
        g.cylinder("y", 12, zc, 3.4, 17, 33, C("bone", 6))
        g.ellipsoid(12, 33, zc, 3.4, 2, 3.4, C("bone", 6))
        g.cylinder("y", 12, zc, 3.6, 28, 30, C("sky", 4))
        g.cylinder("y", 12, zc, 1, 34, 37, C("steel", 5))
    g.box(14, 22, 30, 16, 24, 46, C("iron", 2))
    return rpart("back space-2", g, "Oxygen Tanks")


def star_cape():
    g = rig_grid()
    for yy in range(12, 36):
        spread = 9 + (36 - yy) // 5
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("navy", 3 if yy % 5 else 2))
    rng = np.random.default_rng(7)
    for k in range(18):
        yy = int(rng.integers(13, 34))
        spread = 9 + (36 - yy) // 5
        g.set(13, yy, int(rng.integers(38 - spread, 38 + spread)), C("bone", 7))
    g.box(13, 34, 28, 16, 36, 48, C("gold", 4))
    return rpart("back space-3", g, "Starfield Cape")


# --------------------------------------------------------------- clips --
def clips():
    # rig axes: +X forward, +Y up, +Z along the right arm. Arm.R forward (0, 90, 0);
    # Arm.R down (90, 0, 0); Arm.L down (-90, 0, 0); Arm.R up (-90, 0, 0).
    hold = lambda v, t0, t1: [(t0, v), (t1, v)]
    rifle_aim = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.3, (55, 0, 0)), (1.6, (55, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.3, (-15, 35, 0)), (1.6, (-15, 35, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.3, (-30, -55, 0)), (1.6, (-30, -55, 0)))},
        "ForeArm.L": {"rot": keys((0, (0, 0, 0)), (0.3, (0, -50, 0)), (1.6, (0, -50, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.3, (0, -12, 0)), (1.6, (0, -12, 0)))},
        "Head": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 10, -4)), (1.6, (0, 10, -4)))},
    }
    kick = lambda a, b: [(0, a), (0.05, b), (0.2, a), (0.4, a), (0.45, b), (0.6, a), (0.8, a), (0.85, b), (1.0, a)]
    rifle_shoot = {
        "Arm.R": {"rot": kick((55, 0, 0), (45, 0, 0))},
        "ForeArm.R": {"rot": kick((-15, 35, 0), (-25, 35, 0))},
        "Arm.L": {"rot": kick((-30, -55, 0), (-22, -55, 0))},
        "ForeArm.L": {"rot": hold((0, -50, 0), 0, 1.0)},
        "Chest": {"rot": kick((0, -12, 0), (0, -12, 4))},
        "Head": {"rot": hold((0, 10, -4), 0, 1.0)},
        "Root": {"loc": kick((0, 0, 0), (-0.8, 0, 0))},
    }
    hover = {
        "Root": {"loc": [(i * 0.25, (0, 6 + 1.5 * math.sin(i * math.pi / 4), 0)) for i in range(9)]},
        "Leg.L": {"rot": [(i * 0.25, (0, 0, -5 + 3 * math.sin(i * math.pi / 4))) for i in range(9)]},
        "Leg.R": {"rot": [(i * 0.25, (0, 0, 5 - 3 * math.sin(i * math.pi / 4))) for i in range(9)]},
        "LowerLeg.L": {"rot": hold((0, 0, -25), 0, 2.0)}, "LowerLeg.R": {"rot": hold((0, 0, -25), 0, 2.0)},
        "Arm.R": {"rot": [(i * 0.25, (30 + 5 * math.sin(i * math.pi / 4), 0, 0)) for i in range(9)]},
        "Arm.L": {"rot": [(i * 0.25, (-30 - 5 * math.sin(i * math.pi / 4), 0, 0)) for i in range(9)]},
    }
    salute = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.35, (-20, 75, 0)), (1.4, (-20, 75, 0)), (1.8, (0, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.35, (-20, 110, 30)), (1.4, (-20, 110, 30)), (1.8, (0, 0, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.35, (-80, 0, 0)), (1.4, (-80, 0, 0)), (1.8, (0, 0, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 0, 4)), (1.4, (0, 0, 4)), (1.8, (0, 0, 0)))},
        "Head": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 0, 6)), (1.4, (0, 0, 6)), (1.8, (0, 0, 0)))},
    }
    scan = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.3, (40, 70, 0)), (0.9, (40, 110, 0)), (1.5, (40, 40, 0)), (2.0, (40, 70, 0)), (2.3, (0, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.3, (0, 20, 0)), (2.0, (0, 20, 0)), (2.3, (0, 0, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.9, (0, 20, 0)), (1.5, (0, -20, 0)), (2.0, (0, 0, 0)), (2.3, (0, 0, 0)))},
        "Head": {"rot": keys((0, (0, 0, 0)), (0.9, (0, 25, -6)), (1.5, (0, -25, -6)), (2.0, (0, 0, -6)), (2.3, (0, 0, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.3, (-75, 0, 0)), (2.0, (-75, 0, 0)), (2.3, (0, 0, 0)))},
    }
    s = lambda i, ph=0.0: math.sin(i * math.pi / 4 + ph)
    float_ = {
        "Root": {"loc": [(i * 0.5, (0, 8 + 2 * s(i), 0)) for i in range(9)], "rot": [(i * 0.5, (6 * s(i, 1), 0, 10 * s(i))) for i in range(9)]},
        "Arm.R": {"rot": [(i * 0.5, (-20 + 15 * s(i), 0, 0)) for i in range(9)]},
        "Arm.L": {"rot": [(i * 0.5, (20 - 15 * s(i, 0.8), 0, 0)) for i in range(9)]},
        "ForeArm.R": {"rot": [(i * 0.5, (0, 10 * s(i, 1), 0)) for i in range(9)]},
        "ForeArm.L": {"rot": [(i * 0.5, (0, -10 * s(i, 1.4), 0)) for i in range(9)]},
        "Leg.L": {"rot": [(i * 0.5, (0, 0, -12 + 10 * s(i, 2))) for i in range(9)]},
        "Leg.R": {"rot": [(i * 0.5, (0, 0, 12 - 10 * s(i))) for i in range(9)]},
        "LowerLeg.L": {"rot": [(i * 0.5, (0, 0, -25 - 10 * s(i))) for i in range(9)]},
        "LowerLeg.R": {"rot": [(i * 0.5, (0, 0, -15 - 10 * s(i, 1))) for i in range(9)]},
        "Head": {"rot": [(i * 0.5, (0, 8 * s(i, 2), 5 * s(i))) for i in range(9)]},
    }
    pistol = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.2, (30, 0, 0)), (0.3, (22, 0, 0)), (0.45, (30, 0, 0)), (0.55, (22, 0, 0)), (0.8, (30, 0, 0)), (1.1, (0, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.2, (-30, 0, 0)), (0.8, (-30, 0, 0)), (1.1, (0, 0, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.2, (0, -15, 0)), (0.8, (0, -15, 0)), (1.1, (0, 0, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.2, (-70, 0, 0)), (0.8, (-70, 0, 0)), (1.1, (0, 0, 0)))},
    }
    slash = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.25, (-60, 30, 0)), (0.45, (70, 80, 0)), (0.6, (80, 60, 0)), (1.0, (0, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.25, (-20, 0, 0)), (0.45, (10, 30, 0)), (1.0, (0, 0, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.25, (0, 25, 0)), (0.45, (0, -30, 0)), (0.6, (0, -30, 0)), (1.0, (0, 0, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.25, (-40, 0, 0)), (0.45, (-70, -20, 0)), (1.0, (0, 0, 0)))},
        "Root": {"loc": keys((0, (0, 0, 0)), (0.45, (2, -1, 0)), (1.0, (0, 0, 0)))},
    }
    return [
        Clip("40_Rifle_Aim", rifle_aim, loop=False),
        Clip("41_Rifle_Shoot", rifle_shoot),
        Clip("42_Jetpack_Hover", hover),
        Clip("43_Salute", salute, loop=False),
        Clip("44_Scan", scan, loop=False),
        Clip("45_Zero_G_Float", float_),
        Clip("46_Pistol_Shoot", pistol, loop=False),
        Clip("47_Plasma_Slash", slash, loop=False),
    ]


def build():
    root = Part("space-avatar", None)
    makers = [bubble_helmet, marine_helmet, captain_cap, antenna_band, flight_cap, grey_alien_head, hunter_helmet, robot_head,
              neon_mohawk, silver_bob, circuit_buzz, twin_buns,
              cyber_goatee, holo_moustache,
              visor_band, cyber_monocle, aviator_goggles, star_shades,
              antenna_ears, robot_earcaps, fin_ears,
              alien_face, cyborg_plate, glow_warpaint,
              chrome_brows, glow_brows,
              spacesuit_top, marine_armor, captain_jacket, flight_jacket,
              suit_pants, armored_greaves, cargo_pants,
              moon_boots, mag_boots, jet_boots,
              jetpack, oxygen_tanks, star_cape]
    for make in makers:
        root.add(make())
    return asset("avatar", "parts", "Space Avatar Parts", root, clips=clips())
