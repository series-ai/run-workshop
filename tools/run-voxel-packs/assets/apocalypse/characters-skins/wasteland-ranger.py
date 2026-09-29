"""Wasteland ranger skin: a long sand-coloured duster coat flaring past the
knees, a wide-brim hat with a band of shotgun shells, a patterned scarf over
the mouth, dust goggles, a gun belt with holster and tall riding boots."""
import numpy as np

from _kit import PACK, RigBody
from rigkit import PIVOT, dilate, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    coat = C("sand", 3)
    b.paint(C("skin", 4), C("khaki", 3), coat, C("darkwood", 4), C("darkwood", 3), C("darkwood", 2), boot_hi=9, cuff=C("darkwood", 4))
    # duster: torso shell open at the front, flaring skirt down to the shins
    shellm = b.torso_shell(1, 16, 36) & ~((X >= 24) & (Z >= 34) & (Z < 43))
    g.where(shellm, coat)
    for y in range(6, 18):
        flare = 1 + (18 - y) // 4
        m = dilate(b.region(["Body", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), flare) & ~b.body() & (Y == y)
        m &= ~((X >= 22) & (Z >= 33 - (18 - y) // 3) & (Z < 44 + (18 - y) // 3))  # open front
        g.where(m, coat if y > 6 else C("sand", 2))
    g.where(b.arm_shell(1, ("Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R")), coat)
    g.where(b.arm_shell(1, ("ForeArm.L", "ForeArm.R")) & ((Z == 17) | (Z == 59)), C("sand", 5))
    g.where(b.torso_shell(2, 33, 37) & (Y >= 33), C("sand", 5))  # collar/cape
    # gun belt and holster
    g.where(b.torso_shell(2, 17, 19), C("darkwood", 3))
    g.where(b.torso_shell(2, 17, 19) & (X >= 25) & (Z % 2 == 0), C("gold", 5))
    g.box(22, 10, 48, 26, 17, 50, C("darkwood", 2))
    g.box(23, 15, 48, 25, 19, 50, C("iron", 2))  # revolver grip
    # face: scarf over the mouth, goggles
    scarf = dilate(b.region(["Head"]), 1) & ~b.body() & (Y >= b.hy0 - 1) & (Y < b.hy0 + 8) & (X >= b.hx0 + 4)
    g.where(scarf, C("red", 3))
    g.where(scarf & ((Y + Z) % 3 == 0), C("gold", 4))
    g.where(scarf & ((Y - Z) % 5 == 0), C("bone", 6))
    b.eyes(C("navy", 1), y=b.hy0 + 11)
    gog = b.head_shell(1, 10) & (Y < b.hy0 + 14)
    g.where(gog, C("darkwood", 2))
    g.box(b.fx + 1, b.hy0 + 10, 31, b.fx + 2, b.hy0 + 14, 36, C("sky", 4))
    g.box(b.fx + 1, b.hy0 + 10, 41, b.fx + 2, b.hy0 + 14, 46, C("sky", 4))
    g.box(b.fx + 1, b.hy0 + 13, 32, b.fx + 2, b.hy0 + 14, 34, C("sky", 6))
    # wide-brim hat
    crown = b.head_shell(1, 17)
    g.where(crown, C("darkwood", 4))
    g.where(crown & (Y >= b.hy0 + 17) & (Y < b.hy0 + 19), C("darkwood", 2))
    for k in range(6):
        g.set(b.hx1, b.hy0 + 18, 32 + k * 2, C("red", 4)).set(b.hx1, b.hy0 + 18, 33 + k * 2, C("gold", 5))  # shell band
    ys = b.hy0 + 17
    brim = (Y == ys) & ((((X - 20.5) / 14) ** 2 + ((Z - 37.5) / 17) ** 2) <= 1) & ~b.body()
    g.where(brim, C("darkwood", 3))
    g.where(brim & ((((X - 20.5) / 13) ** 2 + ((Z - 37.5) / 16) ** 2) > 1), C("darkwood", 5))
    g.box(b.hx0 + 2, b.hy1 + 1, b.hz0 + 2, b.hx1 - 2, b.hy1 + 3, b.hz1 - 2, C("darkwood", 4))  # crown top
    g.box(b.hx0 + 4, b.hy1 + 2, 37, b.hx1 - 4, b.hy1 + 3, 39, 0)  # pinch
    g.speckle(seed=15, amount=0.1)
    return Asset(id=f"{PACK}-characters-skins-wasteland-ranger", pack=PACK, category="characters-skins", name="Wasteland Ranger", root=Part("skin apocalypse-wasteland-ranger", g, pivot=PIVOT))
