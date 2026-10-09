"""Survivor skin: a scruffy scavenger in a patched olive field jacket over
a red hoodie, backpack straps, a knit beanie, stubble, a plaster on the
cheek, worn jeans and scuffed sneakers."""
import numpy as np

from _kit import PACK, RigBody
from rigkit import PIVOT, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    b.paint(C("skin", 4), C("forest", 4), C("forest", 4), C("skin", 4), C("blue", 4), C("gray", 6), cuff=C("red", 4))
    g.where(b.region(["Chest"]) & (X >= 23) & (Z >= 35) & (Z < 41), C("red", 4))  # hoodie front
    g.where(b.torso_shell(1, 33, 38) & (X < 26), C("red", 3))  # hood bunched at the neck
    g.where(b.region(["Chest", "Body"]) & (Y == 17), C("darkwood", 2))
    g.where(b.torso_shell(1, 18, 36) & ((Z == 31) | (Z == 44)), C("iron", 2))  # backpack straps
    g.where(b.region(["Chest"]) & (X >= 23) & (Y >= 25) & (Y < 28) & (Z >= 30) & (Z < 34), C("khaki", 5))  # patch
    g.where(b.region(["Arm.L"]) & (X >= 22) & (Y >= 31) & (Z >= 24) & (Z < 27), C("khaki", 4))
    g.where(b.region(["ForeArm.L", "ForeArm.R"]) & ((Z < 17) | (Z > 58)), C("red", 4))  # hoodie cuffs
    for zz in (29, 30, 45, 46):
        g.where(b.region(["Chest", "Body"]) & (Z == zz) & (Y % 3 == 0) & (X >= 23), C("forest", 3))
    g.where(b.region(["Leg.L", "Leg.R"]) & (X >= 23) & (Y == 12), C("blue", 6))  # faded knees
    b.boots(C("gray", 6), 4, toe=C("gray", 7))
    for z0, z1 in b.legs.values():
        g.box(15, 0, z0, 27, 1, z1, C("red", 3))  # soles
    # face
    b.eyes(C("navy", 1), y=b.hy0 + 11)
    b.brows(C("darkwood", 2))
    b.mouth(C("skin", 1), z0=36, z1=41, y=b.hy0 + 5)
    stub = (X == b.fx) & (Y >= b.hy0 + 1) & (Y < b.hy0 + 7) & (Z >= 31) & (Z < 46) & ~((Y == b.hy0 + 5) & (Z >= 36) & (Z < 41))
    g.where(stub & ((Y + Z) % 2 == 0), C("skin", 2))
    g.box(b.fx, b.hy0 + 8, 42, b.fx + 1, b.hy0 + 10, 45, C("bone", 6))  # plaster
    # beanie with a rolled band and hair tufts
    g.where(b.head_shell(1, 15), C("navy", 3))
    g.where(b.head_shell(1, 15) & (Y < b.hy0 + 17), C("navy", 4))
    g.where(b.head_shell(1, 15) & ((X + Z) % 4 == 0) & (Y >= b.hy0 + 17), C("navy", 2))
    g.where(b.shell(["Head"], 1) & (X < b.hx0 + 4) & (Y >= b.hy0 + 8) & (Y < b.hy0 + 15), C("wood", 3))
    g.where(b.shell(["Head"], 1) & (Y >= b.hy0 + 12) & (Y < b.hy0 + 15) & ((Z == b.hz0 - 1) | (Z == b.hz1)) & (X < b.hx0 + 9), C("wood", 3))
    g.speckle(seed=7, amount=0.1)
    return Asset(id=f"{PACK}-characters-skins-survivor", pack=PACK, category="characters-skins", name="Survivor", root=Part("skin apocalypse-survivor", g, pivot=PIVOT))
