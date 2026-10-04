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
    fill(g, helm & ~window, C("bone", 6))
    # Layered hull seams wrap the rear, sides, and crown of the helmet.
    fill(g, helm & ~window & ((y - hy0) % 8 == 0), C("steel", 4))
    fill(g, helm & ~window & (x == hx0 - 2) & (y >= 43) & (y < 52) & (z >= 32) & (z < 44), C("steel", 5))
    fill(g, helm & ~window & (x == hx0 - 2) & ((y == 43) | (y == 51) | (z == 32) | (z == 43)), C("steel", 3))
    fill(g, helm & ~window & (x == hx0 - 2) & (y >= 46) & (y < 49) & (z >= 35) & (z < 41), C("teal", 3))
    fill(g, helm & ~window & (y == hy0 - 1), C("steel", 4))
    fill(g, helm & ~window & (y >= hy1 + 1) & (x < hx1 - 2), C("bone", 6))
    fill(g, helm & ~window & (y == hy1 + 1) & ((z == hz0 + 3) | (z == hz1 - 4)), C("iron", 2))
    # Crown vents are broad painted marks, not a dark crosshatch.
    fill(g, helm & ~window & (y == hy1 + 1) & (x >= hx0 - 1) & (x < hx1 - 3) & ((z >= 32) & (z <= 33) | (z >= 42) & (z <= 43)), C("steel", 4))
    fill(g, helm & ~window & (y == hy1 + 1) & (x >= hx0 + 1) & (x < hx1 - 4) & ((z == 32) | (z == 42)), C("teal", 3))
    for yy, zz in ((44, 33), (44, 42), (50, 33), (50, 42)):
        fill(g, helm & ~window & (x == hx0 - 2) & (y == yy) & (z == zz), C("orange", 6))
    # Thin cyan edge lights suggest tinted glass without hiding the face.
    g.box(hx1 - 1, hy0 + 2, hz0 + 1, hx1, hy0 + 3, hz1 - 1, C("steel", 4))
    g.box(hx1 - 1, hy0 + 2, hz0 + 2, hx1, hy0 + 3, hz1 - 2, C("teal", 3))
    g.box(hx1 - 1, hy1 - 4, hz0 + 1, hx1, hy1 - 3, hz1 - 1, C("steel", 4))
    g.box(hx1 - 1, hy1 - 4, 35, hx1, hy1 - 3, 42, C("plasma", 5))
    for zz in (hz0 - 2, hz1 + 1):
        g.box(18, 44, zz, 24, 50, zz + 1, C("orange", 5))
        g.set(21, 47, zz, C("plasma", 7))
    g.box(17, hy1 + 2, 44, 18, hy1 + 8, 45, C("steel", 5))
    g.set(17, hy1 + 7, 44, C("plasma", 7))
    return rpart("headwear space-1", g, "Bubble Helmet", hides_hair=True)


def marine_helmet():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 - 1)
    fill(g, helm, C("bone", 6))
    fill(g, helm & (y >= hy1 - 2), C("bone", 7))
    # Framed cyan faceplate replaces the competing T-mark and eye slots.
    g.box(29, 40, 30, 30, 51, 46, C("iron", 1))
    g.box(29, 41, 31, 30, 50, 45, C("steel", 5))
    g.box(30, 43, 33, 31, 48, 43, C("teal", 3))
    g.box(31, 44, 34, 32, 47, 42, C("plasma", 6))
    g.box(31, 46, 35, 32, 47, 39, C("plasma", 7))
    # Copper brow badge and steel neck ring give the shell deliberate breaks.
    g.box(29, 52, 35, 30, 54, 41, C("rust", 5))
    g.box(30, 53, 37, 31, 54, 39, C("orange", 6))
    g.box(16, hy1 + 1, 37, 26, hy1 + 3, 39, C("steel", 4))
    # Small cheek vents sit below the visor frame.
    for zz in (33, 36, 40, 43):
        g.set(29, 38, zz, C("steel", 3))
    # The rear service hatch and top edge carry the same hull language.
    g.box(12, 42, 31, 13, 51, 45, C("iron", 1))
    g.box(12, 43, 32, 13, 50, 44, C("steel", 4))
    g.box(12, 45, 34, 13, 48, 42, C("teal", 3))
    for zz in (35, 38, 41):
        g.set(12, 46, zz, C("plasma", 6))
    for yy in (43, 49):
        for zz in (33, 43):
            g.set(12, yy, zz, C("orange", 5))
    fill(g, helm & (y == hy1) & ((z <= hz0) | (z >= hz1 - 1)), C("steel", 4))
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
    cap = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 8) & ~((x >= hx1) & (y < hy1 - 3))
    fill(g, cap, C("steel", 5))
    fill(g, cap & (y >= hy1 - 3), C("steel", 6))
    fill(g, cap & ((y == hy1 - 8) | (y == hy1 - 4)), C("steel", 4))
    fill(g, cap & (x == hx1) & (y >= hy1 - 7) & (y < hy1 - 4), C("iron", 2))
    fill(g, cap & (x == hx1) & (y >= hy1 - 6) & (y < hy1 - 5), C("teal", 3))
    fill(g, cap & (y == hy1) & (x >= hx0 + 2) & (x <= hx1 - 2) & ((z == 32) | (z == 43)), C("steel", 3))
    fill(g, cap & (y == hy1) & (x >= hx0 + 4) & (x <= hx1 - 4) & (z == 33), C("teal", 3))
    # Fitted crown lights join the helmet shell without detached geometry.
    for zz in (31, 44):
        g.box(19, hy1 - 4, zz, 22, hy1 - 2, zz + 2, C("steel", 4))
        g.box(19, hy1 - 3, zz, 22, hy1 - 2, zz + 2, C("teal", 3))
        g.set(20, hy1 - 2, zz + 1, C("plasma", 7))
    g.box(hx1 - 1, hy1 - 4, 34, hx1, hy1 - 3, 41, C("orange", 5))
    return rpart("headwear space-4", g, "Antenna Headband")


def flight_cap():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    cap = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy1 - 7) & ~((x >= hx1) & (y < hy1 - 2))
    fill(g, cap, C("steel", 5))
    fill(g, cap & (y >= hy1), C("steel", 6))
    fill(g, cap & (y == hy1 - 7), C("steel", 4))
    fill(g, cap & (y == hy1) & (x >= hx0 + 2) & (x <= hx1 - 2) & ((z == 32) | (z == 43)), C("steel", 4))
    fill(g, cap & (y == hy1) & (x >= hx0 + 4) & (x <= hx1 - 4) & (z == 33), C("rust", 5))
    fill(g, cap & (x == hx1) & (y >= hy1 - 5) & (y < hy1 - 3), C("teal", 3))
    fill(g, dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 + 4) & (y < hy1 - 6) & (x < 20), C("steel", 4))
    # The cap has no built-in goggles; the eyewear slot owns the visor.
    g.box(hx1 - 1, hy1 - 3, 34, hx1, hy1 - 2, 40, C("orange", 5))
    # Rear nape panel adds a fitted service hatch to the broad head surface.
    g.box(hx0 - 1, 43, 32, hx0, 52, 44, C("steel", 3))
    g.box(hx0 - 1, 44, 33, hx0, 51, 43, C("steel", 4))
    g.box(hx0 - 1, 46, 35, hx0, 49, 41, C("teal", 3))
    g.box(hx0 - 1, 47, 36, hx0, 48, 40, C("plasma", 5))
    for yy in (44, 50):
        for zz in (34, 42):
            g.set(hx0 - 1, yy, zz, C("orange", 5))
    return rpart("headwear space-5", g, "Flight Cap", hides_hair=True)


def grey_alien_head():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    shellm = dilate(region(HEAD), 1) & (y >= hy0 - 1)
    fill(g, shellm, C("steel", 5))
    # Keep the stepped silhouette, with each ledge reading as separate hull.
    g.box(13, hy1, 28, 28, hy1 + 4, 48, C("steel", 5))
    g.box(14, hy1 + 4, 29, 26, hy1 + 7, 47, C("bone", 6))
    g.box(16, hy1 + 7, 31, 24, hy1 + 9, 45, C("steel", 6))
    g.box(12, hy1 - 2, 27, 13, hy1 + 3, 49, C("steel", 5))
    # Recessed dark visor and teal lenses replace the loose eye decals.
    g.box(29, 44, 31, 30, 50, 46, C("iron", 1))
    g.box(30, 45, 32, 31, 49, 45, C("steel", 4))
    for z0 in (33, 41):
        g.box(31, 46, z0, 32, 49, z0 + 3, C("teal", 3))
        g.box(32, 47, z0 + 1, 33, 48, z0 + 2, C("plasma", 7))
    g.set(31, 47, 38, C("orange", 6)).set(31, 48, 38, C("orange", 5))
    # Side ear module and visible top panel breaks.
    g.box(18, 43, 49, 24, 50, 51, C("iron", 1))
    g.box(19, 44, 51, 23, 49, 52, C("teal", 3))
    g.set(21, 47, 52, C("plasma", 7))
    for zz in (31, 38, 45):
        g.box(15, hy1 + 5, zz, 25, hy1 + 6, zz + 1, C("steel", 3))
    g.a[region(HEAD)] = 0
    # Rear service panel adds a clear function mark to the broad hull face.
    g.box(11, 42, 31, 12, 51, 45, C("iron", 1))
    g.box(11, 43, 32, 12, 50, 44, C("steel", 4))
    g.box(11, 45, 34, 12, 48, 42, C("teal", 3))
    for zz in (35, 38, 41):
        g.set(11, 46, zz, C("plasma", 6))
    for yy in (43, 49):
        for zz in (33, 43):
            g.set(11, yy, zz, C("orange", 5))
    rows = {44: (35, 36), 45: (33, 36), 46: (32, 36), 47: (31, 36), 48: (30, 36), 49: (29, 35), 50: (29, 33)}
    for yy, (z0, z1) in rows.items():
        g.box(29, yy, z0, 30, yy + 1, z1, C("iron", 1))
        g.box(29, yy, 76 - z1, 30, yy + 1, 76 - z0, C("iron", 1))
    g.box(29, 45, 32, 30, 50, 36, C("teal", 3))
    g.box(29, 45, 40, 30, 50, 44, C("teal", 3))
    g.set(29, 48, 33, C("plasma", 7)).set(29, 48, 42, C("plasma", 7))
    g.box(29, 41, 37, 30, 43, 39, C("steel", 3))
    return rpart("headwear space-6", g, "Grey Alien Head", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def hunter_helmet():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    # Fill the head volume and outer shell so no underlying pixels show
    # through the large hull panels.
    # Use a continuous cuboid so the head shell has no voxel gaps.
    helm = ((x >= hx0 - 1) & (x < hx1 + 1) &
            (y >= hy0 - 1) & (y < hy1 + 1) &
            (z >= hz0 - 1) & (z < hz1 + 1))
    fill(g, helm, C("teal", 4))
    fill(g, helm & (y >= hy1 - 2), C("teal", 5))
    # Short steel neck seal replaces the muddy brown lower-head band.
    fill(g, helm & (x < 20) & (y < hy0 + 3), C("iron", 2))
    fill(g, helm & (x < 20) & (y == hy0 + 3), C("steel", 5))
    # A fitted rear panel breaks up the broad hull without a full-width stripe.
    g.box(12, 43, 32, 13, 52, 44, C("steel", 3))
    g.box(12, 44, 33, 13, 51, 43, C("teal", 4))
    g.box(12, 46, 35, 13, 49, 41, C("iron", 1))
    g.box(12, 47, 36, 13, 48, 40, C("plasma", 5))
    for yy in (45, 50):
        for zz in (34, 42):
            g.set(12, yy, zz, C("orange", 6))
            g.set(12, yy + 1, zz, C("steel", 7))
    # A broad dark visor with teal glass reads at thumbnail size.
    g.box(29, 43, 30, 30, 50, 46, C("iron", 1))
    g.box(30, 44, 32, 31, 49, 44, C("plasma", 4))
    g.box(31, 45, 34, 32, 48, 42, C("plasma", 6))
    g.box(31, 47, 35, 32, 48, 39, C("plasma", 7))
    # Side comm unit: base, inset, and one status lamp.
    g.box(20, 45, 49, 25, 51, 51, C("steel", 4))
    g.box(21, 46, 50, 25, 50, 52, C("iron", 2))
    g.set(25, 48, 52, C("orange", 6))
    # Short aerial grows from a visible steel mount.
    g.box(20, 52, 49, 23, 54, 51, C("steel", 4))
    g.box(21, 54, 50, 22, 58, 51, C("rust", 5))
    g.set(21, 58, 50, C("plasma", 7))
    return rpart("headwear space-7", g, "Hunter Helmet", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


def robot_head():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    helm = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= hy0 - 1)
    fill(g, helm, C("steel", 6))
    fill(g, helm & (((y - hy0) % 8 == 0) | ((z - hz0) % 10 == 0)), C("steel", 4))
    fill(g, helm & (y >= hy1 - 1) & ((z == hz0 - 1) | (z == hz1)), C("steel", 3))
    # Rear access hatch and paired top vents break up the large shell faces.
    fill(g, helm & (x == hx0 - 1) & (y >= 43) & (y < 52) & (z >= 32) & (z < 44), C("steel", 4))
    fill(g, helm & (x == hx0 - 1) & (y >= 44) & (y < 51) & (z >= 33) & (z < 43), C("steel", 5))
    fill(g, helm & (x == hx0 - 1) & (y >= 46) & (y < 49) & (z >= 35) & (z < 41), C("teal", 3))
    fill(g, helm & (x == hx0 - 1) & (y == 47) & (z >= 36) & (z < 40), C("plasma", 6))
    for z0 in (33, 40):
        fill(g, helm & (y == hy1) & (x >= hx0 + 3) & (x <= hx1 - 3) & (z >= z0) & (z <= z0 + 1), C("iron", 2))
        fill(g, helm & (y == hy1) & (x >= hx0 + 4) & (x <= hx1 - 4) & (z == z0), C("steel", 3))
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
    fill(g, hair_cap(0, 3) & (z >= 35) & (z < 41), C("steel", 4))
    for k, xx in enumerate(range(hx0 + 1, hx1 + 1, 2)):
        h = 5 + (3 if 4 < k < 8 else 1)
        g.box(xx, hy1, 36, xx + 2, hy1 + h, 40, C("steel", 5 if k % 2 else 6))
        g.box(xx, hy1 + h - 1, 37, xx + 2, hy1 + h, 39, C("teal", 4))
    fill(g, hair_cap(4, 12) & ((z < 29) | (z > 46)) & (y < hy1 - 2), C("iron", 2))
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
    fill(g, m, C("steel", 4))
    fill(g, m & ((z == 28) | (z == 47)), C("iron", 2))
    # Paired raised hair rolls stay seated on the skull and read as hull fairings.
    for zz in (30, 45):
        g.box(16, hy1, zz, 25, hy1 + 3, zz + 4, C("steel", 5))
        g.box(17, hy1 + 1, zz + 1, 24, hy1 + 3, zz + 3, C("steel", 6))
        g.box(18, hy1 + 1, zz + 2, 23, hy1 + 2, zz + 3, C("teal", 3))
        g.set(20, hy1 + 2, zz + 2, C("plasma", 6))
    g.box(hx1, hy1 - 4, hz0 + 2, hx1 + 1, hy1 - 1, hz1 - 2, C("steel", 4))
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
    # Compact respirator pixels leave the eyes as the face focus.
    g.box(29, 42, 36, 30, 44, 40, C("steel", 3))
    g.box(29, 43, 37, 30, 44, 39, C("teal", 4))
    g.set(29, 43, 38, C("plasma", 7))
    return rpart("facialhair space-2", g, "Holo Moustache")


# ------------------------------------------------------------- eyewear --
def visor_band():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    # Keep the strap on the front. A full head-wrap hides rear hull details.
    g.box(29, 45, 28, 30, 50, 48, C("iron", 2))
    g.box(29, 46, 29, 30, 49, 47, C("teal", 3))
    g.box(29, 47, 30, 30, 48, 46, C("plasma", 5))
    g.box(30, 48, 34, 31, 49, 42, C("plasma", 6))
    return rpart("eyewear space-1", g, "Visor Band")


def cyber_monocle():
    g = rig_grid()
    g.box(29, 44, 39, 30, 51, 47, C("iron", 1))
    g.box(30, 45, 40, 31, 50, 46, C("steel", 5))
    g.box(31, 46, 41, 32, 49, 45, C("teal", 3))
    g.set(32, 47, 42, C("plasma", 7)).set(32, 48, 44, C("plasma", 6))
    g.box(22, 47, 48, 29, 49, 50, C("steel", 3))
    return rpart("eyewear space-2", g, "Cyber Eyepiece")


def aviator_goggles():
    g = rig_grid()
    band = dilate(region(HEAD), 1) & ~region(HEAD) & (y >= 46) & (y < 48)
    fill(g, band, C("iron", 1))
    for z0 in (31, 40):
        g.box(29, 44, z0, 31, 50, z0 + 6, C("rust", 5))
        g.box(30, 45, z0 + 1, 31, 49, z0 + 5, C("iron", 1))
        g.box(31, 46, z0 + 2, 32, 49, z0 + 4, C("plasma", 5))
        g.set(32, 48, z0 + 2, C("plasma", 7))
    return rpart("eyewear space-3", g, "Aviator Goggles")


def star_shades():
    g = rig_grid()
    # Flat framed lenses avoid a stack of protruding highlights.
    g.box(29, 45, 30, 30, 50, 47, C("steel", 4))
    for z0 in (31, 41):
        g.box(29, 46, z0, 30, 49, z0 + 5, C("iron", 1))
        g.box(29, 47, z0 + 1, 30, 49, z0 + 4, C("teal", 3))
        g.set(29, 48, z0 + 1, C("plasma", 7))
    g.box(29, 47, 36, 30, 48, 40, C("steel", 5))
    g.box(29, 49, 31, 30, 50, 46, C("steel", 4))
    return rpart("eyewear space-4", g, "Star Shades")


# ---------------------------------------------------------------- ears --
def antenna_ears():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz, sgn in ((hz0 - 1, -1), (hz1, 1)):
        g.box(18, 44, zz, 23, 49, zz + 1, C("steel", 4))
        g.box(19, 45, zz, 22, 48, zz + 1, C("teal", 3))
        g.line((20.5, 48, zz + 0.5), (19, 57, zz + 0.5 + sgn * 3), 0.75, C("steel", 6))
        g.sphere(19, 58, zz + 0.5 + sgn * 3, 1.5, C("plasma", 6))
    return rpart("ears space-1", g, "Antenna Ears")


def robot_earcaps():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz in (hz0 - 2, hz1):
        g.box(17, 42, zz, 25, 51, zz + 2, C("steel", 4))
        g.box(18, 43, zz, 24, 50, zz + 2, C("iron", 2))
        g.box(19, 44, zz, 23, 49, zz + 2, C("teal", 3))
        g.box(20, 45, zz + 1, 22, 48, zz + 2, C("plasma", 6))
        g.set(21, 47, zz + 2, C("plasma", 7))
    return rpart("ears space-2", g, "Robot Ear Caps")


def fin_ears():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    for zz, sgn in ((hz0 - 1, -1), (hz1, 1)):
        for k in range(6):
            g.box(16 + k, 42 + k, zz + sgn * (k // 2), 24 - k // 2, 50 + k, zz + sgn * (k // 2) + 1, C("steel", 4 + (k % 2)))
        g.box(16, 43, zz, 23, 44, zz + 1, C("teal", 3))
        g.box(18, 45, zz + sgn, 22, 47, zz + sgn, C("plasma", 5))
    return rpart("ears space-3", g, "Alien Fin Ears")


# ---------------------------------------------------------------- face --
def alien_face():
    g = rig_grid()
    # Keep the alien expression simple under either visor or tinted glasses.
    for z0 in (31, 42):
        g.set(29, 48, z0 + 1, C("iron", 1))
        g.set(29, 48, z0 + 2, C("teal", 6))
    return rpart("face space-1", g, "Xeno Eyes")


def cyborg_plate():
    g = rig_grid()
    # The upper visor belongs to eyewear. This lower respirator stays clear of it.
    g.box(29, 40, 35, 30, 44, 41, C("iron", 2))
    g.box(30, 41, 36, 31, 43, 40, C("steel", 4))
    g.box(31, 42, 37, 32, 43, 39, C("teal", 3))
    for zz in (36, 40):
        g.set(31, 41, zz, C("orange", 5))
    g.set(32, 42, 38, C("plasma", 7))
    return rpart("face space-2", g, "Cyborg Face Plate")


def glow_warpaint():
    g = rig_grid()
    # Teal tracers align with the alien helmet's dual-lens face.
    g.box(29, 45, 32, 30, 50, 36, C("teal", 3))
    g.box(29, 45, 41, 30, 50, 45, C("teal", 3))
    for zz in (31, 32, 45, 46):
        g.set(29, 46, zz, C("plasma", 6))
        g.set(29, 49, zz, C("plasma", 7))
    g.box(29, 41, 36, 30, 44, 40, C("steel", 3))
    g.set(29, 42, 38, C("orange", 6))
    return rpart("face space-3", g, "Glow War Paint")


# ------------------------------------------------------------- eyebrows --
def chrome_brows():
    g = rig_grid()
    for z0, z1 in ((31, 36), (41, 46)):
        g.box(29, 51, z0, 30, 52, z1, C("steel", 6))
        g.set(29, 51, z0, C("orange", 6))
    return rpart("eyebrow space-1", g, "Chrome Brows")


def glow_brows():
    g = rig_grid()
    for z0 in (32, 42):
        g.set(29, 51, z0, C("plasma", 6))
        g.set(29, 51, z0 + 1, C("plasma", 7))
    return rpart("eyebrow space-2", g, "Glow Brows")


# ---------------------------------------------------------------- tops --
def spacesuit_top():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    suit = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 16)
    fill(g, suit, C("bone", 6))
    fill(g, suit & ((y == 16) | (y == 17)), C("orange", 5))
    fill(g, suit & (x >= 24) & (y >= 25) & (y < 31) & (z >= 34) & (z < 42), C("steel", 4))
    for zz, col in ((35, "plasma"), (37, "orange"), (39, "teal")):
        g.set(24, 29, zz, C(col, 6))
    fill(g, suit & (y >= 29) & (y < 35) & (z >= 50) & (z < 53), C("steel", 4))
    fill(g, suit & ((z == 17) | (z == 58)), C("steel", 4))
    fill(g, suit & (y >= 30) & (y < 32) & ((z >= 22) & (z <= 30) | (z >= 46) & (z <= 54)), C("orange", 5))
    fill(g, suit & (y >= 32) & (y < 35) & (x >= 22) & (z >= 34) & (z < 42), C("steel", 5))
    return rpart("tops space-1", g, "EVA Suit Top")


def marine_armor():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    armor = shell(["Chest", "Body"], 2) & (y < hy0) & (y >= 16)
    fill(g, armor, C("steel", 5))
    fill(g, armor & (x >= 24) & (y >= 22), C("bone", 6))
    fill(g, armor & (x >= 24) & (y >= 26) & (y < 28), C("iron", 1))
    fill(g, shell(ARMS, 1), C("steel", 4))
    # One solid shoulder cap per arm. Keep the cap inside the arm silhouette.
    for z0, z1 in ((23, 31), (45, 53)):
        g.box(15, 33, z0 + 1, 25, 37, z1 - 1, C("bone", 6))
        g.box(15, 33, z0 + 1, 25, 34, z1 - 1, C("orange", 5))
        for zz in (z0 + 2, z1 - 3):
            g.set(24, 36, zz, C("steel", 2))
    # Chest module and back module use the same framed steel housing.
    g.box(24, 22, 34, 25, 31, 42, C("iron", 1))
    g.box(25, 23, 35, 26, 30, 41, C("steel", 5))
    g.box(26, 25, 36, 27, 28, 40, C("teal", 3))
    for zz, col in ((36, "plasma"), (38, "orange"), (40, "plasma")):
        g.set(27, 26, zz, C(col, 6))
    g.box(9, 19, 31, 15, 33, 45, C("steel", 4))
    # Compact rear battery ribs leave room for the back-slot part to read.
    g.box(8, 21, 34, 9, 31, 42, C("steel", 4))
    for yy in (24, 27, 30):
        g.box(8, yy, 36, 9, yy + 1, 40, C("teal", 3))
    g.box(9, 32, 34, 14, 34, 42, C("orange", 5))
    return rpart("tops space-2", g, "Marine Power Armour")


def captain_jacket():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    coat = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 15)
    fill(g, coat, C("steel", 4))
    fill(g, coat & (x >= 24) & (z >= 37) & (z < 39), C("bone", 6))
    for k in range(16):
        g.box(24, 34 - k, 30 + k, 25, 36 - k, 32 + k, C("rust", 5))
    for z0, z1 in ((24, 30), (46, 52)):
        g.box(15, 34, z0 + 1, 25, 37, z1 - 1, C("bone", 6))
        g.box(15, 34, z0 + 1, 25, 35, z1 - 1, C("orange", 5))
        for zz in (z0 + 2, z1 - 3):
            g.set(24, 36, zz, C("steel", 2))
    fill(g, coat & ((z == 18) | (z == 57)), C("orange", 5))
    # Mission patch on the chest, placed as a compact framed badge.
    g.box(24, 26, 43, 25, 31, 48, C("iron", 1))
    g.box(25, 27, 44, 26, 30, 47, C("teal", 4))
    g.set(26, 29, 45, C("plasma", 7)).set(26, 28, 46, C("orange", 6))
    return rpart("tops space-3", g, "Captain's Jacket")


def flight_jacket():
    g = rig_grid()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = hb()
    jk = shell(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & (y < hy0) & (y >= 16)
    fill(g, jk, C("steel", 5))
    fill(g, jk & (y >= 33), C("bone", 6))  # padded collar
    fill(g, jk & (x >= 24) & (z == 38), C("rust", 5))  # sealed front zip
    fill(g, jk & ((y == 16) | (y == 17)), C("iron", 2))
    # Framed mission patch, with a cyan beacon and hazard-orange mark.
    g.box(24, 27, 41, 25, 32, 46, C("iron", 1))
    g.box(25, 28, 42, 26, 31, 45, C("steel", 5))
    g.box(26, 29, 43, 27, 30, 45, C("teal", 3))
    g.set(27, 29, 44, C("plasma", 7)).set(26, 31, 44, C("orange", 6))
    fill(g, jk & ((z == 18) | (z == 57)), C("steel", 3))
    fill(g, jk & (y >= 29) & (y < 31) & ((z >= 23) & (z <= 29) | (z >= 47) & (z <= 53)), C("orange", 5))
    fill(g, jk & (y >= 18) & (y < 20), C("rust", 5))
    return rpart("tops space-4", g, "Flight Jacket")


# ------------------------------------------------------------- bottoms --
def leg_shell(t=1):
    return shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], t) | (shell(["Body"], t) & (y < 19))


def suit_pants():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("bone", 6))
    fill(g, m & (y >= 9) & (y < 11), C("orange", 5))
    fill(g, m & (y >= 17), C("steel", 4))
    fill(g, m & (y >= 12) & (y < 15) & (x >= 22), C("steel", 5))
    fill(g, m & (y >= 9) & (y < 11) & (x >= 22), C("orange", 5))
    for side, (z0, z1) in leg_z_ranges().items():
        zz = z1 if side == "L" else z0 - 1
        g.box(18, 12, zz, 23, 16, zz + 1, C("steel", 4))
        g.box(19, 13, zz, 22, 15, zz + 1, C("teal", 3))
        g.set(21, 14, zz, C("plasma", 7))
    return rpart("bottoms space-1", g, "EVA Suit Pants")


def armored_greaves():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("steel", 5))
    fill(g, m & (x >= 23) & (y >= 6), C("bone", 6))
    fill(g, m & (x >= 23) & (y >= 6) & ((y % 5) == 0), C("steel", 4))
    fill(g, m & (y >= 9) & (y < 11) & (x >= 23), C("orange", 5))
    fill(g, m & (y >= 17), C("iron", 2))
    fill(g, m & (x >= 23) & (y >= 12) & (y < 14), C("steel", 4))
    for z0, z1 in leg_z_ranges().values():
        g.set(23, 13, (z0 + z1) // 2, C("teal", 5))
    return rpart("bottoms space-2", g, "Armoured Greaves")


def cargo_pants():
    g = rig_grid()
    m = leg_shell()
    fill(g, m, C("steel", 5))
    fill(g, m & (y >= 17), C("iron", 2))
    for side, (z0, z1) in leg_z_ranges().items():
        zz = z0 - 1 if side == "L" else z1
        g.box(18, 9, zz, 23, 14, zz + 1, C("iron", 1))  # framed thigh pockets
        g.box(19, 10, zz, 22, 13, zz + 1, C("steel", 5))
        g.set(20, 12, zz, C("orange", 6))
        g.set(21, 10, zz, C("teal", 6))
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
    def extra(g, z0, z1):
        # Front toe shield with a small luminous locator.
        g.box(25, 2, z0 + 2, 27, 5, z1 - 2, C("steel", 5))
        g.set(27, 4, (z0 + z1) // 2, C("plasma", 7))
    return rpart("shoes space-1", boots(C("bone", 6), C("steel", 5), C("iron", 1), 8, 1, extra), "Moon Boots")


def mag_boots():
    def extra(g, z0, z1):
        g.box(16, 1, z0 - 1, 26, 3, z1 + 1, C("teal", 3))
        g.box(18, 2, z1, 24, 3, z1 + 1, C("plasma", 7))
        g.box(24, 4, z0, 27, 6, z1, C("orange", 5))
    g = boots(C("iron", 3), C("steel", 5), C("iron", 1), 7, 1, extra)
    # Cut the center channel so both toe caps and pale sole rails read apart.
    g.a[:, :, 37:39] = 0
    for z0, z1 in leg_z_ranges().values():
        g.box(24, 3, z0, 27, 5, z1, C("steel", 5))
        g.box(27, 3, (z0 + z1) // 2, 28, 4, (z0 + z1) // 2 + 1, C("plasma", 7))
    return rpart("shoes space-2", g, "Mag Boots")


def jet_boots():
    def extra(g, z0, z1):
        g.box(13, 1, z0 + 1, 15, 5, z1 - 1, C("steel", 4))
        g.box(13, 0, z0 + 2, 15, 1, z1 - 2, C("ember", 6))
        g.box(15, 4, z0, 26, 5, z1, C("orange", 5))
    return rpart("shoes space-3", boots(C("steel", 4), C("bone", 6), C("iron", 1), 7, 0, extra), "Jet Boots")


# ---------------------------------------------------------------- back --
def jetpack():
    g = rig_grid()
    g.box(10, 20, 31, 16, 34, 45, C("steel", 5))
    g.box(9, 22, 33, 10, 32, 43, C("iron", 1))
    for zc in (33.5, 42.5):
        g.cylinder("y", 10, zc, 3, 16, 34, C("steel", 5))
        g.cylinder("y", 10, zc, 3.2, 30, 32, C("steel", 6))
        g.cylinder("y", 10, zc, 2.2, 14, 16, C("iron", 1))
        g.cylinder("y", 10, zc, 1.4, 13, 14, C("plasma", 6))
        g.box(10, 20, int(zc - 1), 11, 30, int(zc + 1), C("rust", 5))
        g.box(7, 23, int(zc - 2), 8, 25, int(zc + 2), C("orange", 5))
        g.box(7, 17, int(zc - 1), 8, 18, int(zc + 1), C("teal", 3))
        g.set(7, 16, int(zc), C("plasma", 7))
    g.box(12, 34, 36, 14, 37, 40, C("iron", 1))
    g.box(14, 35, 37, 15, 36, 39, C("plasma", 6))
    return rpart("back space-1", g, "Jetpack")


def oxygen_tanks():
    g = rig_grid()
    for zc in (33.5, 42.5):
        g.cylinder("y", 12, zc, 3.4, 17, 33, C("steel", 5))
        g.ellipsoid(12, 33, zc, 3.4, 2, 3.4, C("steel", 5))
        g.cylinder("y", 12, zc, 3.6, 28, 30, C("orange", 5))
        g.cylinder("y", 12, zc, 1, 34, 37, C("steel", 6))
        g.box(8, 20, int(zc - 2), 9, 29, int(zc + 2), C("iron", 1))
        g.box(8, 21, int(zc - 1), 9, 27, int(zc + 1), C("teal", 3))
        g.set(8, 25, int(zc), C("plasma", 7))
        g.box(8, 14, int(zc - 1), 9, 16, int(zc + 1), C("iron", 1))
        g.box(8, 13, int(zc - 1), 9, 14, int(zc + 1), C("plasma", 6))
        g.box(8, 18, int(zc - 2), 9, 19, int(zc + 2), C("rust", 5))
    g.box(14, 22, 30, 16, 24, 46, C("iron", 1))
    g.box(15, 24, 35, 16, 31, 41, C("steel", 4))
    g.box(16, 26, 37, 17, 29, 39, C("teal", 3))
    g.set(17, 28, 38, C("plasma", 7))
    return rpart("back space-2", g, "Oxygen Tanks")


def star_cape():
    g = rig_grid()
    # Short, tapered mantle stays above the belt and cannot read as a stray
    # column between a pack and the trousers.
    for yy in range(20, 36):
        spread = 7 + (36 - yy) // 6
        shade = 4 if yy % 4 else 5
        g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("steel", shade))
        if yy in (20, 21):
            g.box(13, yy, 38 - spread, 15, yy + 1, 38 + spread, C("iron", 2))
    # Four bright constellations read as a fabric pattern, not a panel.
    for yy, zz in ((31, 33), (28, 40), (24, 44), (22, 35)):
        g.set(13, yy, zz, C("plasma", 7))
        g.set(13, yy, zz - 1, C("bone", 7))
        g.set(13, yy, zz + 1, C("bone", 7))
        g.set(13, yy - 1, zz, C("bone", 6))
        g.set(13, yy + 1, zz, C("bone", 6))
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
