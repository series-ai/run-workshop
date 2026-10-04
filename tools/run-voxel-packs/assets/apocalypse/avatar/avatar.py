"""Post-apocalypse avatar parts and clips on the PN rig (rig space: faces
+X, right arm along +Z). 34 parts across the PN slots and seven clips
(56-62): shotgun pump, shotgun fire, zombie shamble, crouch walk,
scavenge, throw and bat swing."""
import math

import numpy as np

from _kit import RigBody, keys
from rigkit import PIVOT, dilate, part_rules, rig_grid
from voxgrid import C, Asset, Clip, Part

PACK = "apocalypse"


def part(slot, n, grid, display, **rules):
    return Part(f"{slot} {PACK}-{n}", grid, pivot=PIVOT, meta={"name": display, "rules": part_rules(**rules)})


def new():
    g = rig_grid()
    return g, RigBody(g)


# ---------------------------------------------------------------- headwear

def army_helmet():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    dome = dilate(b.region(["Head"]), 2) & ~b.body() & (Y >= b.hy0 + 14)
    g.where(dome, C("forest", 4))
    g.where(dome & (Y == b.hy0 + 14), C("forest", 2))
    g.where(dome & (Y == b.hy1 + 1), C("forest", 5))
    g.where(dome & (Y >= b.hy0 + 16) & (Y < b.hy0 + 18) & (Y > 0), C("iron", 2))  # strap band
    g.box(b.hx1 + 1, b.hy0 + 16, 30, b.hx1 + 2, b.hy0 + 18, 47, C("iron", 2))
    g.box(b.hx1 + 1, b.hy0 + 16, 32, b.hx1 + 2, b.hy0 + 18, 34, C("bone", 6))  # playing card in the band
    g.box(b.hx1 + 1, b.hy0 + 17, 32, b.hx1 + 2, b.hy0 + 18, 33, C("red", 4))
    g.box(b.hx1, b.hy0 + 19, 35, b.hx1 + 2, b.hy0 + 21, 42, C("gray", 7))
    for z in range(36, 41, 2):
        g.set(b.hx1 + 1, b.hy0 + 20, z, C("iron", 1))
    return part("headwear", 1, g, "Army Helmet", hides_hair=True)


def hard_hat():
    g, b = new()
    Y = b.Y
    dome = dilate(b.region(["Head"]), 2) & ~b.body() & (Y >= b.hy0 + 16)
    g.where(dome, C("gold", 5))
    g.where(dome & ((b.Z == 37) | (b.Z == 38)) & (Y > b.hy1), C("gold", 6))  # ridge
    g.box(b.hx1, b.hy0 + 16, 29, b.hx1 + 5, b.hy0 + 17, 48, C("gold", 4))  # front brim
    g.box(b.hx1 + 1, b.hy0 + 18, 35, b.hx1 + 3, b.hy0 + 22, 41, C("steel", 5))  # headlamp
    g.box(b.hx1 + 3, b.hy0 + 19, 36, b.hx1 + 4, b.hy0 + 21, 40, C("gold", 7))
    g.where(dome & (Y == b.hy0 + 18) & (b.X < 20), C("iron", 2))
    g.box(b.hx0 - 1, b.hy0 + 20, 33, b.hx0, b.hy0 + 22, 38, C("red", 4))  # sticker
    return part("headwear", 2, g, "Scavenger Hard Hat", hides_hair=True)


def spiked_helmet():
    g, b = new()
    Y, Z = b.Y, b.Z
    dome = dilate(b.region(["Head"]), 2) & ~b.body() & (Y >= b.hy0 + 13)
    g.where(dome, C("iron", 3))
    g.where(dome & (Y == b.hy1 + 1), C("iron", 4))
    g.where(dome & (Y == b.hy0 + 13), C("rust", 3))
    for k, z in enumerate(range(29, 49, 4)):  # spikes along the crest
        h = 8 - abs(z - 38) // 3
        g.box(19, b.hy1 + 2, z, 21, b.hy1 + 2 + h - 2, z + 2, C("steel", 5))
        g.box(19, b.hy1 + h, z, 20, b.hy1 + h + 1, z + 1, C("steel", 6))
    for zz in (b.hz0 - 3, b.hz1 + 2):  # side horns
        g.box(18, b.hy0 + 16, zz, 21, b.hy0 + 19, zz + 1, C("bone", 5))
    g.box(b.hx1 + 1, b.hy0 + 13, 30, b.hx1 + 2, b.hy0 + 15, 47, C("rust", 4))  # visor rim
    return part("headwear", 3, g, "Spiked Raider Helmet", hides_hair=True)


def trucker_cap():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    cap = b.head_shell(1, 16)
    g.where(cap, C("khaki", 3))
    g.where(cap & (Y == b.hy0 + 16), C("rust", 3))  # one continuous sweat band
    g.box(b.hx1, b.hy0 + 16, 30, b.hx1 + 5, b.hy0 + 17, 47, C("darkwood", 3))  # short worn bill
    g.box(b.hx1 + 1, b.hy0 + 18, 35, b.hx1 + 2, b.hy0 + 21, 41, C("steel", 3))  # salvage patch
    g.box(b.hx1 + 2, b.hy0 + 19, 36, b.hx1 + 3, b.hy0 + 20, 40, C("gold", 5))
    # Rear mesh is a dark inset with restrained steel ribs, not a second colour block.
    mesh = cap & (X < 20) & (Y >= b.hy0 + 17) & (Y < b.hy1)
    g.where(mesh, C("steel", 3))
    g.where(mesh & (Z % 4 == 0), C("steel", 5))
    # Sewn crown seams and a small repair stitch give the cap a clear shape.
    g.where(cap & (Z == 37) & (Y >= b.hy0 + 17), C("khaki", 1))
    g.where(cap & (X >= b.hx1 - 2) & (Y >= b.hy0 + 18) & (Y < b.hy0 + 20) & (Z >= 39) & (Z < 42), C("red", 3))
    g.where(cap & (X >= b.hx1 - 2) & (Y == b.hy0 + 18) & (Z >= 39) & (Z < 42), C("gold", 4))
    return part("headwear", 4, g, "Trucker Cap", hides_hair=True)


def beanie():
    g, b = new()
    Y = b.Y
    m = b.head_shell(1, 14)
    g.where(m, C("orange", 4))
    g.where(m & (Y < b.hy0 + 17), C("orange", 3))
    g.where(m & ((b.Z % 3) == 0) & (Y >= b.hy0 + 17), C("orange", 5))
    g.box(18, b.hy1 + 1, 35, 23, b.hy1 + 4, 41, C("gold", 6))  # pompom
    return part("headwear", 5, g, "Knit Beanie", hides_hair=True)


def wide_brim():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    crown = b.head_shell(1, 17)
    g.where(crown, C("darkwood", 4))
    ys = b.hy0 + 17
    brim = (Y == ys) & ((((X - 20.5) / 15) ** 2 + ((Z - 37.5) / 18) ** 2) <= 1) & ~b.body()
    g.where(brim, C("darkwood", 3))
    g.where(brim & ((((X - 20.5) / 14) ** 2 + ((Z - 37.5) / 17) ** 2) > 1), C("darkwood", 5))
    g.box(b.hx0 + 2, b.hy1 + 1, b.hz0 + 2, b.hx1 - 2, b.hy1 + 4, b.hz1 - 2, C("darkwood", 4))
    g.box(b.hx0 + 4, b.hy1 + 3, 37, b.hx1 - 4, b.hy1 + 4, 39, 0)
    g.where(crown & (Y >= ys + 1) & (Y < ys + 3), C("red", 3))  # band
    g.box(b.hx1, ys + 1, 42, b.hx1 + 1, ys + 5, 44, C("gray", 7))  # feather
    return part("headwear", 6, g, "Wide-Brim Hat", hides_hair=True)


def welding_mask():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = dilate(b.region(["Head"]), 2) & ~b.body() & (Y >= b.hy0 + 2)
    # Paint the shell with steel plates and a wide lens. Keep details on its
    # existing voxels so the head mesh has no overlapping geometry.
    g.where(m, C("iron", 3))
    g.where(m & (X >= b.fx) & (Y >= b.hy0 + 7), C("steel", 3))
    g.where(m & (X >= b.fx) & (Y >= b.hy0 + 18), C("steel", 4))
    g.where(m & (X >= b.fx) & (Y >= b.hy0 + 15) & (Y < b.hy0 + 19), C("steel", 4))
    g.where(m & (X < b.fx) & (Y >= b.hy0 + 17), C("iron", 4))
    g.where(m & (Y >= b.hy0 + 19), C("iron", 2))
    visor = m & (X >= b.fx) & (Y >= b.hy0 + 9) & (Y < b.hy0 + 17) & (Z >= 29) & (Z < 48)
    g.where(visor, C("iron", 1))
    g.where(visor & (Z >= 30) & (Z < 47) & (Y >= b.hy0 + 10) & (Y < b.hy0 + 16), C("steel", 5))
    g.where(visor & (Z >= 31) & (Z < 46) & (Y >= b.hy0 + 11) & (Y < b.hy0 + 15), C("forest", 2))
    g.where(visor & (Z >= 32) & (Z < 45) & (Y >= b.hy0 + 12) & (Y < b.hy0 + 14), C("toxic", 4))
    g.where(visor & (Z >= 33) & (Z < 38) & (Y == b.hy0 + 14), C("toxic", 6))

    # Painted cheek vents, welded seams, and a salvage mark break up broad faces.
    for z0 in (30, 44):
        g.where(m & (X >= b.fx) & (Y >= b.hy0 + 2) & (Y < b.hy0 + 7) & (Z >= z0) & (Z < z0 + 3), C("steel", 4))
        g.where(m & (X >= b.fx) & (Y >= b.hy0 + 3) & (Y < b.hy0 + 6) & (Z >= z0 + 1) & (Z < z0 + 2), C("iron", 1))
        for yy in (b.hy0 + 4, b.hy0 + 6):
            g.where(m & (X >= b.fx) & (Y == yy) & (Z == z0 + 1), C("rust", 5))
    g.where(m & (X >= b.fx) & (Y >= b.hy0 + 18) & (Y < b.hy0 + 21) & (Z >= 33) & (Z < 44), C("rust", 4))
    g.where(m & (X >= b.fx) & (Y == b.hy0 + 20) & (Z >= 36) & (Z < 41), C("gold", 5))

    # Rear and side faces have painted repair plates and rust marks.
    g.where(m & (X < b.hx0 + 2) & (Y < b.hy1), C("steel", 3))
    g.where(m & (X < b.hx0 + 2) & (Y >= b.hy0 + 5) & (Y < b.hy0 + 7), C("steel", 4))
    g.where(m & (X < b.hx0 + 2) & (Y >= b.hy0 + 14) & (Y < b.hy0 + 15), C("rust", 4))
    g.where(m & (X < b.hx0 + 2) & (Y >= b.hy0 + 8) & (Y < b.hy0 + 12) & (Z >= 34) & (Z < 43), C("iron", 2))
    g.where(m & (X < b.hx0 + 2) & (Y >= b.hy0 + 9) & (Y < b.hy0 + 11) & (Z >= 36) & (Z < 41), C("red", 4))
    g.where(m & (X < b.hx0 + 2) & (Y >= b.hy0 + 10) & (Y < b.hy0 + 11) & (Z >= 37) & (Z < 40), C("gold", 5))
    g.where(m & (X < b.hx0 + 2) & (Z % 7 == 0) & (Y >= b.hy0 + 2) & (Y < b.hy0 + 19), C("rust", 3))
    for z in (b.hz0 - 3, b.hz1 + 2):
        g.box(19, b.hy0 + 10, z, 22, b.hy0 + 14, z + 1, C("steel", 5))  # hinge plate
        g.set(22, b.hy0 + 12, z, C("gold", 5))

    # Signal stripe and filter retain the welding-mask read from a distance.
    g.box(b.hx1 - 2, b.hy1 + 2, 30, b.hx1 + 3, b.hy1 + 3, 47, C("red", 4))
    g.box(b.hx1 + 1, b.hy0 + 1, 36, b.hx1 + 4, b.hy0 + 5, 41, C("steel", 4))
    g.box(b.hx1 + 4, b.hy0 + 2, 37, b.hx1 + 6, b.hy0 + 5, 40, C("forest", 4))
    for z in range(37, 41):
        g.set(b.hx1 + 6, b.hy0 + 3, z, C("iron", 1))
    return part("headwear", 7, g, "Welding Mask", hides_hair=True, hides_eyebrows=True, hides_facial_hair=True)


# ---------------------------------------------------------------- hair / facial hair / brows / ears

def mohawk(n, name, c1, c2, spikes):
    g, b = new()
    g.where(b.head_shell(1, 18) & ((b.Z < 35) | (b.Z >= 42)) & (b.X >= b.hx0 + 2), C("skindark", 4))  # shaved sides
    for x in range(b.hx0, b.hx1 - 1):
        h = (7 if not spikes else (9 if x % 4 < 2 else 4)) - abs(x - 21) * 0.2
        g.box(x, b.hy1, 35, x + 1, b.hy1 + int(h), 42, c1)
        g.box(x, b.hy1 + int(h) - 1, 36, x + 1, b.hy1 + int(h), 41, c2)
    g.box(b.hx0 - 1, b.hy0 + 8, 35, b.hx0, b.hy1, 42, c1)  # down the back
    return part("hair", n, g, name)


def dreadlocks():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    top = b.head_shell(1, 17)
    g.where(top, C("darkwood", 3))
    for k, z in enumerate(range(b.hz0 - 1, b.hz1 + 1, 3)):
        for x0 in (b.hx0 - 1, b.hx0 + 3):
            ln = 12 + (k * 5) % 7
            g.box(x0, b.hy0 + 18 - ln, z, x0 + 2, b.hy0 + 19, z + 2, C("darkwood", 2 + k % 2))
            g.set(x0, b.hy0 + 18 - ln, z, C("gold", 5))  # beads
    g.where(b.shell(["Head"], 1) & ((Z == b.hz0 - 1) | (Z == b.hz1)) & (Y >= b.hy0 + 4) & (Y < b.hy0 + 18) & (X < b.hx0 + 7) & (Z % 2 == 0), C("darkwood", 2))
    return part("hair", 3, g, "Dreadlocks")


def beard():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = (X >= b.fx) & (X < b.fx + 2) & (Y >= b.hy0 - 2) & (Y < b.hy0 + 8) & (Z >= 29) & (Z < 48) & ~((Y >= b.hy0 + 4) & (Y < b.hy0 + 6) & (Z >= 35) & (Z < 42))
    m |= b.shell(["Head"], 1) & (Y < b.hy0 + 9) & (X >= b.hx0 + 8) & ((Z < 30) | (Z > 46))
    g.where(m, C("wood", 3))
    g.where(m & (Y < b.hy0 + 1), C("wood", 2))
    g.where(m & (Y == b.hy0 + 3) & (Z % 5 == 0), C("gray", 5))
    return part("facialhair", 1, g, "Scruffy Beard")


def handlebar():
    g, b = new()
    g.box(b.fx, b.hy0 + 6, 33, b.fx + 2, b.hy0 + 8, 44, C("gray", 6))
    for z0, s in ((33, -1), (43, 1)):
        g.box(b.fx, b.hy0 + 3, z0 + (0 if s < 0 else 0), b.fx + 2, b.hy0 + 7, z0 + 1, C("gray", 6))
        g.set(b.fx, b.hy0 + 2, z0 + s, C("gray", 5))
    g.box(b.fx, b.hy0 + 7, 37, b.fx + 1, b.hy0 + 8, 40, C("gray", 5))
    return part("facialhair", 2, g, "Handlebar Moustache")


def scarred_brows():
    g, b = new()
    y = b.hy0 + 14
    g.box(b.fx, y, 31, b.fx + 1, y + 2, 36, C("darkwood", 1))
    g.box(b.fx, y, 40, b.fx + 1, y + 2, 45, C("darkwood", 1))
    g.box(b.fx, y - 1, 42, b.fx + 1, y + 3, 43, C("skin", 5))  # scar through the right brow
    return part("eyebrow", 1, g, "Scarred Brows")


def headset():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    band = b.shell(["Head"], 1) & (X >= 19) & (X < 22) & (Y >= b.hy0 + 8)
    g.where(band, C("iron", 2))
    for z in (b.hz0 - 2, b.hz1 + 1):
        g.box(17, b.hy0 + 6, z, 24, b.hy0 + 13, z + 1, C("iron", 3))
        g.box(18, b.hy0 + 7, z, 23, b.hy0 + 12, z + 1, C("khaki", 4))
    g.line((22, b.hy0 + 8, b.hz1 + 1.5), (b.hx1 + 1, b.hy0 + 5, 44), 0.5, C("iron", 2))  # boom mic
    g.box(b.hx1, b.hy0 + 4, 42, b.hx1 + 2, b.hy0 + 6, 45, C("iron", 1))
    g.box(20, b.hy0 + 13, b.hz1 + 1, 21, b.hy0 + 22, b.hz1 + 2, C("steel", 6))  # antenna
    g.set(20, b.hy0 + 22, b.hz1 + 1, C("red", 5))
    return part("ears", 1, g, "Radio Headset")


# ---------------------------------------------------------------- eyewear / face

def goggles():
    g, b = new()
    X, Y = b.X, b.Y
    strap = b.head_shell(1, 10) & (Y < b.hy0 + 14)
    g.where(strap, C("darkwood", 2))
    for z0 in (31, 40):
        g.box(b.fx + 1, b.hy0 + 9, z0, b.fx + 3, b.hy0 + 15, z0 + 6, C("steel", 4))
        g.box(b.fx + 2, b.hy0 + 10, z0 + 1, b.fx + 3, b.hy0 + 14, z0 + 5, C("orange", 5))
        g.box(b.fx + 2, b.hy0 + 13, z0 + 1, b.fx + 3, b.hy0 + 14, z0 + 3, C("orange", 7))
    g.box(b.fx + 1, b.hy0 + 11, 37, b.fx + 2, b.hy0 + 13, 40, C("steel", 3))
    return part("eyewear", 1, g, "Dust Goggles")


def eyepatch():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    g.box(b.fx + 1, b.hy0 + 9, 31, b.fx + 2, b.hy0 + 15, 37, C("iron", 1))
    strap = b.shell(["Head"], 1) & (np.abs((Y - (b.hy0 + 12)) - (Z - 34) * 0.35) < 1) & ~((X > b.fx))
    g.where(strap, C("iron", 2))
    g.box(b.fx + 1, b.hy0 + 11, 33, b.fx + 2, b.hy0 + 13, 35, C("red", 4))  # painted X
    return part("eyewear", 2, g, "Eyepatch")


def cracked_glasses():
    g, b = new()
    for z0 in (30, 40):
        g.box(b.fx + 1, b.hy0 + 9, z0, b.fx + 2, b.hy0 + 15, z0 + 7, C("iron", 2))
        g.box(b.fx + 1, b.hy0 + 10, z0 + 1, b.fx + 2, b.hy0 + 14, z0 + 6, 0)
        g.box(b.fx + 2, b.hy0 + 10, z0 + 1, b.fx + 3, b.hy0 + 14, z0 + 6, C("sky", 6))
    for k in range(4):
        g.set(b.fx + 2, b.hy0 + 13 - k, 41 + k, C("gray", 7))
    g.box(b.fx + 1, b.hy0 + 12, 37, b.fx + 2, b.hy0 + 13, 40, C("iron", 2))
    g.box(b.fx + 1, b.hy0 + 12, 38, b.fx + 3, b.hy0 + 13, 39, C("bone", 6))  # tape on the bridge
    for z in (b.hz0 - 1, b.hz1):
        g.box(20, b.hy0 + 12, z, b.fx, b.hy0 + 13, z + 1, C("iron", 2))
    return part("eyewear", 3, g, "Taped Glasses")


def gas_mask():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    face = dilate(b.region(["Head"]), 1) & ~b.body() & (X >= b.fx - 1) & (Y >= b.hy0) & (Y < b.hy0 + 17)
    g.where(face, C("iron", 3))
    strap = b.shell(["Head"], 1) & ((Y == b.hy0 + 8) | (Y == b.hy0 + 15)) & (X < b.fx)
    g.where(strap, C("iron", 2))
    for z0 in (31, 40):  # round lenses
        g.box(b.fx + 1, b.hy0 + 9, z0, b.fx + 3, b.hy0 + 15, z0 + 6, C("iron", 2))
        g.box(b.fx + 2, b.hy0 + 10, z0 + 1, b.fx + 3, b.hy0 + 14, z0 + 5, C("teal", 3))
        g.set(b.fx + 2, b.hy0 + 13, z0 + 1, C("teal", 6))
    g.box(b.fx + 1, b.hy0 + 2, 35, b.fx + 5, b.hy0 + 8, 42, C("iron", 2))  # filter snout
    g.box(b.fx + 5, b.hy0 + 3, 36, b.fx + 7, b.hy0 + 7, 41, C("forest", 4))  # canister
    for z in range(36, 41, 2):
        g.set(b.fx + 7, b.hy0 + 5, z, C("iron", 1))
    return part("face", 1, g, "Gas Mask", hides_facial_hair=True)


def bandana_mask():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = dilate(b.region(["Head"]), 1) & ~b.body() & (Y >= b.hy0 - 1) & (Y < b.hy0 + 9)
    m &= ~((X < b.hx0 + 3) & (Y > b.hy0 + 6))
    g.where(m, C("red", 4))
    g.where(m & (Z % 6 == 0) & (Y % 4 == 0), C("gray", 7))  # polka dots
    g.box(b.hx0 - 3, b.hy0 + 3, 36, b.hx0, b.hy0 + 7, 39, C("red", 3))  # knot tails
    g.where(m & (X > b.fx) & (Y < b.hy0 + 1), C("red", 3))
    return part("face", 2, g, "Bandana Mask", hides_facial_hair=True)


def war_paint():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    fp = (X == b.fx)
    g.where(fp & (Y >= b.hy0 + 9) & (Y < b.hy0 + 16) & (((Z >= 29) & (Z < 31)) | ((Z >= 46) & (Z < 48))), C("gray", 7))
    g.where(fp & (Y == b.hy0 + 10) & (Z >= 29) & (Z < 48) & ~(((Z >= 32) & (Z < 36)) | ((Z >= 41) & (Z < 45))), C("iron", 1))
    g.where(fp & (Y >= b.hy0 + 2) & (Y < b.hy0 + 8) & ((Z == 33) | (Z == 44)), C("red", 4))
    g.where(fp & (Y >= b.hy0 + 16) & (Y < b.hy0 + 19) & (Z >= 36) & (Z < 41), C("red", 4))
    # a thin layer placed just in front of the face so it wins over the skin
    g.a = np.roll(g.a, 1, axis=0)
    return part("face", 3, g, "War Paint")


# ---------------------------------------------------------------- tops

def _sleeves(g, b, c, t=1, fore=True):
    bones = ["Arm.L", "Arm.R"] + (["ForeArm.L", "ForeArm.R"] if fore else [])
    m = b.shell(bones, t)
    g.where(m, c)
    return m


def patched_jacket():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    t = b.torso_shell(1, 16, 37)
    g.where(t, C("forest", 4))
    s = _sleeves(g, b, C("forest", 4))
    g.where(t & (X >= 24) & (Z >= 37) & (Z < 39), C("gray", 6))  # zip
    for (y0, z0, c) in ((27, 30, C("khaki", 5)), (20, 42, C("sand", 4)), (23, 33, C("blue", 3))):
        g.where(t & (X >= 24) & (Y >= y0) & (Y < y0 + 3) & (Z >= z0) & (Z < z0 + 3), c)
    g.where(s & (Z >= 24) & (Z < 27) & (Y >= 32), C("khaki", 5))
    g.where(s & ((Z == 15) | (Z == 16) | (Z == 60) | (Z == 61)), C("forest", 2))  # cuffs
    g.where(t & (Y >= 34), C("forest", 2))  # collar
    g.where(b.torso_shell(2, 33, 37) & (X < 20), C("forest", 3))  # hood
    return part("tops", 1, g, "Patched Field Jacket")


def spiked_vest():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    t = b.torso_shell(1, 17, 36) & ~((X >= 24) & (Z >= 35) & (Z < 42) & (Y > 20))
    g.where(t, C("iron", 2))

    for z0, z1 in ((21, 31), (46, 56)):  # tyre-rubber shoulder pads with spikes
        g.box(16, 35, z0, 25, 38, z1, C("gray", 2))
        g.box(16, 36, z0, 25, 37, z1, C("gray", 1))
        g.box(17, 38, z0 + 1, 24, 39, z1 - 1, C("gray", 3))
        for zz in range(z0 + 2, z1 - 1, 3):
            g.box(20, 39, zz, 21, 42, zz + 1, C("steel", 6))
    # Wrapped forearms balance the shoulder armour and cover bare skin.
    arms = b.arm_shell(1, ("ForeArm.L", "ForeArm.R"))
    g.where(arms, C("forest", 3))
    g.where(arms & (Y >= 17) & (Y < 20), C("darkwood", 3))
    g.where(arms & (Y >= 20) & (Y < 23), C("sand", 4))
    g.where(arms & (Y >= 23) & (Y < 25), C("forest", 5))
    g.where(arms & (((Z >= 16) & (Z < 18)) | ((Z >= 58) & (Z < 60))), C("iron", 2))
    g.where(arms & (Y >= 20) & (Y < 22) & (Z % 5 == 0), C("rust", 4))
    for z0 in (20, 46):
        g.box(17, 34, z0, 24, 37, z0 + 8, C("iron", 3))
        g.box(18, 35, z0 + 1, 23, 36, z0 + 7, C("steel", 4))
        g.set(24, 36, z0 + 2, C("rust", 5)).set(24, 36, z0 + 6, C("rust", 5))
    g.where(t & (X >= 24) & (Y >= 18) & (Y < 20), C("steel", 6))  # studded belt
    return part("tops", 2, g, "Spiked Leather Vest")


def tactical_vest():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    g.where(b.torso_shell(1, 16, 36), C("khaki", 2))
    _sleeves(g, b, C("khaki", 3), fore=False)
    v = b.torso_shell(2, 18, 34) & ~b.torso_shell(1, 0, 99)
    g.where(v, C("forest", 3))
    for z0 in (30, 35, 40):  # mag pouches
        g.where(v & (X >= 25) & (Y >= 20) & (Y < 25) & (Z >= z0) & (Z < z0 + 4), C("forest", 4))
    g.where(v & (X >= 25) & (Y >= 28) & (Y < 31) & (Z >= 41) & (Z < 45), C("red", 4))  # medic patch
    g.where(v & (X >= 25) & (Y >= 27) & (Y < 32) & (Z == 43), C("gray", 7))
    g.where(v & (X >= 25) & (Y == 29) & (Z >= 41) & (Z < 46), C("gray", 7))
    return part("tops", 3, g, "Tactical Vest")


def poncho():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    # A close shell keeps the garment on the torso and follows its outline.
    coat = b.torso_shell(1, 17, 36)
    g.where(coat, C("sand", 3))
    g.where(coat & (Y >= 17) & (Y < 20), C("darkwood", 3))  # fitted hem
    g.where(coat & (Y >= 20) & (Y < 21), C("rust", 4))  # narrow piping
    g.where(coat & (Y >= 21) & (Y < 23), C("sand", 2))  # shaded seam

    sleeves = b.arm_shell(1, ("Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"))
    g.where(sleeves, C("sand", 3))
    cuff = sleeves & (((Z >= 15) & (Z < 19)) | ((Z >= 57) & (Z < 61)))
    g.where(cuff, C("darkwood", 3))
    g.where(cuff & (Y >= 4), C("rust", 4))
    g.where(sleeves & (Y >= 33) & (Y < 36), C("sand", 4))

    # The red scarf sits on the upper chest, clear of the sleeve silhouette.
    scarf = b.torso_shell(2, 34, 37) & (X >= 24) & (Z >= 33) & (Z < 42)
    g.where(scarf, C("red", 3))
    g.where(scarf & (Y == 34), C("red", 4))
    # Keep the coat seam below the repair patch so it does not cut the mark.
    g.where(coat & (X >= 24) & (Y >= 21) & (Y < 33) & (Z == 37), C("darkwood", 4))
    # A cloth repair patch sits between the front straps.
    patch = coat & (X >= 24) & (Y >= 24) & (Y < 30) & (Z >= 35) & (Z < 41)
    g.where(patch, C("darkwood", 3))  # sewn border
    g.where(patch & (Y >= 25) & (Y < 29) & (Z >= 36) & (Z < 40), C("red", 3))
    g.where(patch & (Y >= 25) & (Y < 29) & (Z >= 36) & (Z < 40) & ((Y - 27) == (Z - 38)), C("gold", 5))  # hazard slash
    g.where(patch & ((Y == 24) | (Y == 29)) & ((Z == 35) | (Z == 40)), C("gold", 4))
    return part("tops", 4, g, "Desert Poncho")


def tire_armor():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    g.where(b.torso_shell(1, 16, 36), C("khaki", 3))
    _sleeves(g, b, C("khaki", 3), fore=False)
    plate = b.torso_shell(2, 20, 35) & ~b.torso_shell(1, 0, 99)
    g.where(plate, C("gray", 2))
    g.where(plate & ((Y % 3) == 0), C("gray", 1))  # tread
    g.where(plate & (X >= 25) & (Y >= 25) & (Y < 31) & (Z >= 34) & (Z < 42), C("steel", 4))  # road sign scrap
    g.where(plate & (X >= 25) & (Y >= 26) & (Y < 30) & (Z >= 35) & (Z < 41), C("red", 4))
    g.where(plate & (X >= 25) & (Y == 28) & (Z >= 36) & (Z < 40), C("gray", 7))
    for z0, z1 in ((20, 31), (46, 57)):
        g.box(16, 34, z0, 25, 38, z1, C("gray", 2))
        g.box(16, 37, z0, 25, 38, z1, C("gray", 3))
    return part("tops", 5, g, "Tyre Armour")


# ---------------------------------------------------------------- bottoms

def cargo_pants():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = b.leg_shell(1)
    g.where(m, C("khaki", 3))
    for z0 in (27, 47):  # side pockets
        g.box(17, 8, z0, 24, 12, z0 + 2, C("khaki", 2))
        g.box(17, 11, z0, 24, 12, z0 + 2, C("khaki", 4))
        g.box(23, 9, z0, 24, 10, z0 + 2, C("rust", 3))  # stitched pocket tab
    g.where(m & (Y >= 17) & (Y < 19), C("darkwood", 2))
    g.where(m & (Y == 18) & (X >= 24) & (Z >= 37) & (Z < 40), C("steel", 5))
    return part("bottoms", 1, g, "Cargo Pants")


def ripped_jeans():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = b.leg_shell(1)
    g.where(m, C("blue", 3))
    g.where(m & (X >= 24) & (Y >= 9) & (Y < 12), C("gray", 7))  # knee rips
    g.where(m & (Y >= 17) & (Y < 19), C("iron", 2))
    return part("bottoms", 2, g, "Ripped Jeans")


def armored_legs():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    m = b.leg_shell(1)
    g.where(m, C("iron", 3))
    plates = dilate(b.region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), 2) & ~b.body() & (X >= 22) & (Y < 16)
    g.where(plates & ~m, C("steel", 4))
    g.where(plates & (Y >= 9) & (Y < 12), C("orange", 4))  # knee pads
    g.where(m & (Y >= 17) & (Y < 19), C("darkwood", 3))
    return part("bottoms", 3, g, "Armoured Leg Plates")


# ---------------------------------------------------------------- shoes

def combat_boots():
    g, b = new()
    for z0, z1 in b.legs.values():
        g.box(14, 0, z0 - 1, 30, 2, z1 + 1, C("iron", 1))
        g.box(14, 2, z0 - 1, 29, 8, z1 + 1, C("darkwood", 3))
        g.box(14, 7, z0 - 1, 28, 8, z1 + 1, C("darkwood", 4))
        # Broad steel toe cap covers the PN foot tip under the wraps.
        g.box(25, 1, z0, 30, 4, z1 + 1, C("steel", 3))
        g.box(28, 2, z0 + 1, 30, 3, z1, C("steel", 5))
        boot = g.a > 0
        g.where(boot & (b.Z >= z0) & (b.Z <= z1) & (b.Y >= 4) & (b.Y < 6) & (b.X >= 18) & (b.X < 25), C("sand", 4))
        g.where(boot & (b.Z >= z0) & (b.Z <= z1) & (b.Y == 5) & (b.X >= 18) & (b.X < 25) & (b.X % 3 == 0), C("iron", 2))
        for y in (3, 6):
            g.box(14, y, z0 + 1, 15, y + 1, z1, C("rust", 4))
        g.box(27, 4, z0 + 2, 28, 6, z0 + 4, C("gold", 5))
        for y in range(3, 8, 2):
            g.box(28, y, z0 + 1, 29, y + 1, z1, C("bone", 5))
    return part("shoes", 1, g, "Combat Boots")


def sneakers():
    g, b = new()
    for z0, z1 in b.legs.values():
        g.box(15, 0, z0 - 1, 27, 1, z1 + 1, C("gray", 7))
        g.box(15, 1, z0 - 1, 26, 5, z1 + 1, C("red", 4))
        g.box(24, 1, z0 - 1, 27, 3, z1 + 1, C("gray", 6))
        g.box(15, 3, z0 - 1, 20, 4, z1 + 1, C("gray", 7))  # swoosh stripe
        g.box(26, 4, z0 + 1, 27, 5, z1 - 1, C("gray", 7))
        g.set(21, 2, z0 - 1, C("iron", 1)).set(22, 1, z1, C("iron", 1))  # holes
    return part("shoes", 2, g, "Worn Sneakers")


def spiked_boots():
    g, b = new()
    for z0, z1 in b.legs.values():
        g.box(15, 0, z0 - 1, 27, 2, z1 + 1, C("iron", 2))
        g.box(15, 2, z0 - 1, 26, 9, z1 + 1, C("iron", 3))
        g.box(15, 8, z0 - 1, 25, 9, z1 + 1, C("steel", 5))
        g.box(27, 1, (z0 + z1) // 2 - 1, 29, 2, (z0 + z1) // 2 + 1, C("steel", 6))  # toe spike
        for y in (4, 7):
            g.box(14, y, z0 + 1, 15, y + 1, z1 - 1, C("steel", 6))
    return part("shoes", 3, g, "Spiked Boots")


# ---------------------------------------------------------------- back

def _straps(g, b, c):
    """Shoulder straps over the front of the chest so back items read from the front."""
    X, Y, Z = b.X, b.Y, b.Z
    m = b.torso_shell(2, 22, 37) & ~b.torso_shell(1, 0, 99) & (((Z >= 31) & (Z < 33)) | ((Z >= 43) & (Z < 45)))
    g.where(m, c)
    g.where(m & (X >= 25) & (Y == 27), C("steel", 5))


def backpack():
    g, b = new()
    g.box(9, 17, 30, 16, 34, 46, C("teal", 2))
    g.box(9, 30, 30, 16, 34, 46, C("teal", 3))
    g.box(8, 19, 32, 9, 28, 44, C("teal", 1))  # reinforced front pocket
    g.box(8, 26, 32, 9, 27, 44, C("teal", 3))
    g.box(8, 19, 38, 9, 21, 40, C("steel", 3))  # stitched repair patch
    g.box(9, 22, 38, 9, 25, 39, C("rust", 4))
    g.box(10, 13, 31, 15, 17, 45, C("red", 3))  # rolled signal-red bedroll
    g.box(10, 13, 29, 15, 17, 31, C("rust", 4)).box(10, 13, 45, 15, 17, 47, C("rust", 4))
    g.box(11, 34, 34, 14, 38, 38, C("steel", 3))  # tin cup
    g.box(9, 22, 46, 13, 29, 49, C("sky", 3))  # water bottle
    g.box(10, 29, 46, 12, 30, 48, C("iron", 2))
    for y in (21, 26):
        g.box(8, y, 35, 9, y + 1, 36, C("gold", 4))  # pack buckles
        g.box(8, y, 40, 9, y + 1, 41, C("gold", 4))
    _straps(g, b, C("teal", 2))
    return part("back", 1, g, "Survival Backpack")


def jerrycan_pack():
    g, b = new()
    g.box(12, 20, 31, 16, 34, 45, C("iron", 3))  # frame
    for z0, c in ((31, C("red", 4)), (39, C("forest", 4))):
        g.box(8, 18, z0, 13, 32, z0 + 7, c)
        g.box(8, 31, z0, 13, 32, z0 + 7, C(("red", "forest")[z0 > 35], 5))
        for k in range(5):
            g.set(8, 21 + k * 2, z0 + 1 + k, C(("red", "forest")[z0 > 35], 5))
        g.box(9, 32, z0 + 1, 11, 35, z0 + 3, C("steel", 5))
    g.box(9, 22, 30, 13, 24, 47, C("orange", 3))  # strap
    _straps(g, b, C("orange", 3))
    return part("back", 2, g, "Jerry-Can Rack")


def shotgun_sling():
    g, b = new()
    X, Y, Z = b.X, b.Y, b.Z
    # shotgun slung upright across the back, barrel over the right shoulder
    g.box(12, 12, 40, 16, 24, 44, C("wood", 4))  # stock
    g.box(12, 12, 40, 16, 14, 44, C("iron", 1))  # butt pad
    g.box(13, 24, 41, 16, 30, 43, C("iron", 3))  # receiver
    g.box(13, 30, 41, 15, 50, 43, C("iron", 2))  # barrel
    g.box(12, 32, 40, 16, 38, 44, C("wood", 5))  # pump
    g.box(13, 49, 41, 15, 50, 42, C("gold", 6))  # bead
    g.where(b.torso_shell(1, 16, 37) & (np.abs((Y - 16) - (46 - Z) * 1.1) <= 1) & (X >= 20), C("darkwood", 3))  # strap across the chest
    return part("back", 3, g, "Slung Shotgun")


def build() -> Asset:
    root = Part(f"{PACK}-avatar", None)
    parts = [army_helmet(), hard_hat(), spiked_helmet(), trucker_cap(), beanie(), wide_brim(), welding_mask(),
             mohawk(1, "Red Mohawk", C("red", 4), C("red", 6), False), mohawk(2, "Toxic Spike Mohawk", C("toxic", 3), C("toxic", 5), True), dreadlocks(),
             beard(), handlebar(), scarred_brows(), headset(), goggles(), eyepatch(), cracked_glasses(), gas_mask(), bandana_mask(), war_paint(),
             patched_jacket(), spiked_vest(), tactical_vest(), poncho(), tire_armor(),
             cargo_pants(), ripped_jeans(), armored_legs(), combat_boots(), sneakers(), spiked_boots(), backpack(), jerrycan_pack(), shotgun_sling()]
    for p in parts:
        root.add(p)
    return Asset(id=f"{PACK}-avatar-parts", pack=PACK, category="avatar", name="Post-Apocalypse Avatar Parts", root=root, clips=clips())


def clips():
    # rig axes: +X forward, +Y up, +Z along the right arm. Arm.R forward = (0, 90, 0), Arm.L forward = (0, -90, 0).
    # Leg swing forward = +Z rotation; Chest lean forward = -Z rotation.
    pump = {
        "Arm.R": {"rot": keys((0, (0, 80, 8)), (0.8, (0, 80, 8)))},
        "ForeArm.R": {"rot": keys((0, (0, 10, 0)), (0.8, (0, 10, 0)))},
        "Arm.L": {"rot": keys((0, (0, -88, 4)), (0.2, (0, -70, 2)), (0.4, (0, -88, 4)), (0.8, (0, -88, 4)))},
        "ForeArm.L": {"rot": keys((0, (0, -10, 0)), (0.2, (0, -45, 0)), (0.4, (0, -10, 0)), (0.8, (0, -10, 0)))},
        "Chest": {"rot": keys((0, (0, -12, 0)), (0.2, (0, -12, 3)), (0.4, (0, -12, 0)), (0.8, (0, -12, 0)))},
        "Head": {"rot": keys((0, (0, 10, -4)), (0.8, (0, 10, -4)))},
    }
    fire = {
        "Arm.R": {"rot": keys((0, (0, 80, 8)), (0.08, (0, 80, 30)), (0.3, (0, 80, 14)), (0.6, (0, 80, 8)))},
        "ForeArm.R": {"rot": keys((0, (0, 10, 0)), (0.6, (0, 10, 0)))},
        "Arm.L": {"rot": keys((0, (0, -88, 4)), (0.08, (0, -88, 26)), (0.3, (0, -88, 10)), (0.6, (0, -88, 4)))},
        "ForeArm.L": {"rot": keys((0, (0, -10, 0)), (0.6, (0, -10, 0)))},
        "Chest": {"rot": keys((0, (0, -12, 0)), (0.08, (0, -12, 10)), (0.3, (0, -12, 2)), (0.6, (0, -12, 0)))},
        "Head": {"rot": keys((0, (0, 10, -4)), (0.08, (0, 10, 6)), (0.6, (0, 10, -4)))},
        "Root": {"loc": keys((0, (0, 0, 0)), (0.08, (-2, 0, 0)), (0.6, (0, 0, 0)))},
    }
    S = 1.6
    shamble = {
        "Arm.R": {"rot": [(t, (v[0], 85, -6 + v[0] * 0.5)) for t, v in _wob(S, 6)]},
        "Arm.L": {"rot": [(t, (v[0], -85, -6 - v[0] * 0.5)) for t, v in _wob(S, 6, math.pi)]},
        "Leg.R": {"rot": [(t, (0, 0, v[0])) for t, v in _wob(S, 18)]},
        "Leg.L": {"rot": [(t, (0, 0, v[0])) for t, v in _wob(S, 18, math.pi)]},
        "LowerLeg.R": {"rot": [(t, (0, 0, -abs(v[0]) * 0.6)) for t, v in _wob(S, 18)]},
        "LowerLeg.L": {"rot": [(t, (0, 0, -abs(v[0]) * 0.6)) for t, v in _wob(S, 18, math.pi)]},
        "Chest": {"rot": [(t, (v[0] * 0.5, 0, -8)) for t, v in _wob(S, 10)]},
        "Head": {"rot": [(t, (18 + v[0], 0, 6)) for t, v in _wob(S, 6, 1.0)]},
        "Root": {"loc": [(t, (0, -1 + abs(v[0]) * 0.08, 0)) for t, v in _wob(S, 12)]},
    }
    W = 1.0
    crouch = {
        "Root": {"loc": [(t, (0, -14 + abs(v[0]) * 0.05, 0)) for t, v in _wob(W, 20)]},
        "Body": {"rot": keys((0, (0, 0, -22)), (W, (0, 0, -22)))},
        "Leg.R": {"rot": [(t, (0, 0, 55 + v[0])) for t, v in _wob(W, 20)]},
        "Leg.L": {"rot": [(t, (0, 0, 55 + v[0])) for t, v in _wob(W, 20, math.pi)]},
        "LowerLeg.R": {"rot": [(t, (0, 0, -80 + v[0] * 0.5)) for t, v in _wob(W, 20)]},
        "LowerLeg.L": {"rot": [(t, (0, 0, -80 + v[0] * 0.5)) for t, v in _wob(W, 20, math.pi)]},
        "Arm.R": {"rot": keys((0, (40, 45, 0)), (W, (40, 45, 0)))},
        "Arm.L": {"rot": keys((0, (-40, -45, 0)), (W, (-40, -45, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 40, 0)), (W, (0, 40, 0)))},
        "ForeArm.L": {"rot": keys((0, (0, -40, 0)), (W, (0, -40, 0)))},
        "Head": {"rot": [(t, (v[0] * 0.3, v[0], 18)) for t, v in _wob(W * 2, 25)]},
    }
    D = 1.6
    scavenge = {
        "Root": {"loc": keys((0, (0, -8, 0)), (D, (0, -8, 0)))},
        "Body": {"rot": keys((0, (0, 0, -40)), (D, (0, 0, -40)))},
        "Leg.R": {"rot": keys((0, (0, 0, 40)), (D, (0, 0, 40)))},
        "Leg.L": {"rot": keys((0, (0, 0, 40)), (D, (0, 0, 40)))},
        "LowerLeg.R": {"rot": keys((0, (0, 0, -40)), (D, (0, 0, -40)))},
        "LowerLeg.L": {"rot": keys((0, (0, 0, -40)), (D, (0, 0, -40)))},
        "Arm.R": {"rot": [(t, (60 + v[0], 60, -10)) for t, v in _wob(D / 2, 20)]},
        "Arm.L": {"rot": [(t, (-60 + v[0], -60, -10)) for t, v in _wob(D / 2, 20, math.pi)]},
        "ForeArm.R": {"rot": [(t, (0, 20 + v[0], 0)) for t, v in _wob(D / 2, 25)]},
        "ForeArm.L": {"rot": [(t, (0, -20 + v[0], 0)) for t, v in _wob(D / 2, 25, math.pi)]},
        "Head": {"rot": keys((0, (0, 20, -15)), (0.4, (0, -20, -15)), (0.8, (0, 20, -15)), (1.2, (0, -20, -15)), (D, (0, 20, -15)))},
    }
    throw = {
        "Arm.R": {"rot": keys((0, (0, 0, 0)), (0.35, (-70, -40, 0)), (0.5, (-20, 60, 10)), (0.62, (10, 100, -20)), (1.0, (0, 0, 0)))},
        "ForeArm.R": {"rot": keys((0, (0, 0, 0)), (0.35, (-60, 0, 0)), (0.55, (0, 10, 0)), (1.0, (0, 0, 0)))},
        "Arm.L": {"rot": keys((0, (0, 0, 0)), (0.35, (0, -70, 10)), (0.62, (30, -20, 0)), (1.0, (0, 0, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.35, (0, -30, 6)), (0.6, (0, 25, -10)), (1.0, (0, 0, 0)))},
        "Body": {"rot": keys((0, (0, 0, 0)), (0.35, (0, -10, 0)), (0.6, (0, 12, -6)), (1.0, (0, 0, 0)))},
        "Leg.R": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 0, -15)), (0.6, (0, 0, 5)), (1.0, (0, 0, 0)))},
        "Leg.L": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 0, 15)), (0.6, (0, 0, -5)), (1.0, (0, 0, 0)))},
        "Head": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 20, 0)), (0.6, (0, -10, 0)), (1.0, (0, 0, 0)))},
    }
    swing = {
        "Arm.R": {"rot": keys((0, (0, 60, 20)), (0.35, (0, 10, 40)), (0.55, (0, 95, 5)), (0.75, (0, 130, -5)), (1.0, (0, 60, 20)))},
        "Arm.L": {"rot": keys((0, (0, -60, 20)), (0.35, (0, -110, 30)), (0.55, (0, -80, 5)), (0.75, (0, -40, -5)), (1.0, (0, -60, 20)))},
        "ForeArm.L": {"rot": keys((0, (0, -20, 0)), (0.35, (0, -40, 0)), (0.55, (0, -10, 0)), (1.0, (0, -20, 0)))},
        "Chest": {"rot": keys((0, (0, 0, 0)), (0.35, (0, -45, 4)), (0.55, (0, 15, -6)), (0.75, (0, 55, -4)), (1.0, (0, 0, 0)))},
        "Body": {"rot": keys((0, (0, 0, 0)), (0.35, (0, -15, 0)), (0.75, (0, 20, 0)), (1.0, (0, 0, 0)))},
        "Head": {"rot": keys((0, (0, 0, 0)), (0.35, (0, 30, 0)), (0.75, (0, -35, 0)), (1.0, (0, 0, 0)))},
        "Root": {"loc": keys((0, (0, 0, 0)), (0.35, (0, -2, 0)), (0.55, (0, -3, 0)), (1.0, (0, 0, 0)))},
    }
    return [Clip("56_Shotgun_Pump", pump), Clip("57_Shotgun_Fire", fire, loop=False), Clip("58_Zombie_Shamble", shamble),
            Clip("59_Crouch_Walk", crouch), Clip("60_Scavenge", scavenge), Clip("61_Throw", throw, loop=False), Clip("62_Bat_Swing", swing, loop=False)]


def _wob(seconds, amp, phase=0.0, steps=8):
    return [(seconds * i / steps, (amp * math.sin(2 * math.pi * i / steps + phase), 0, 0)) for i in range(steps + 1)]
