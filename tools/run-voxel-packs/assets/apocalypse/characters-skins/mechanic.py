"""Mechanic skin: a grease-smeared navy boilermaker with a name patch and
rolled-up sleeves, a backwards red cap, a bushy moustache, a rag in the
pocket, tool belt, work gloves and steel-toe boots."""
import numpy as np

from _kit import PACK, RigBody
from rigkit import PIVOT, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    over = C("navy", 5)
    b.paint(C("skin", 3), over, over, C("khaki", 4), over, C("darkwood", 3), cuff=C("darkwood", 5))
    g.where(b.region(["ForeArm.L", "ForeArm.R"]), C("skin", 3))  # rolled-up sleeves
    g.where(b.region(["Arm.L", "Arm.R"]) & ((Z == 21) | (Z == 22) | (Z == 54) | (Z == 55)), C("navy", 6))
    g.where(b.region(["Chest"]) & (X >= 23) & (Y >= 27) & (Y < 30) & (Z >= 41) & (Z < 46), C("gray", 7))  # name patch
    g.where(b.region(["Chest"]) & (X >= 23) & (Y == 28) & (Z >= 42) & (Z < 45), C("red", 4))
    g.where(b.region(["Chest"]) & (X >= 23) & (Z == 38) & (Y >= 18), C("steel", 5))  # zip
    g.where(b.region(["Chest"]) & (X >= 23) & (Y >= 26) & (Y < 30) & (Z >= 31) & (Z < 35), C("navy", 3))  # pocket
    g.where(b.region(["Chest"]) & (X >= 23) & (Y >= 29) & (Y < 32) & (Z >= 32) & (Z < 34), C("red", 5))  # rag
    rnd = np.random.default_rng(5).random(g.shape)
    grease = (b.region(["Chest", "Body", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"])) & (rnd < 0.08)
    g.where(grease, C("iron", 2))
    belt = b.torso_shell(1, 16, 19)
    g.where(belt, C("darkwood", 3))
    g.box(24, 12, 44, 26, 18, 47, C("darkwood", 4))  # tool pouch
    g.box(25, 16, 44, 26, 21, 45, C("steel", 5))  # wrench handle poking out
    g.box(24, 20, 43, 26, 22, 46, C("steel", 5))
    b.boots(C("darkwood", 3), 6, cuff=C("darkwood", 5), toe=C("steel", 4))
    # face: moustache, grease smear
    b.eyes(C("navy", 1), y=b.hy0 + 11)
    b.brows(C("darkwood", 1))
    g.box(b.fx, b.hy0 + 6, 33, b.fx + 2, b.hy0 + 8, 44, C("darkwood", 2))
    g.box(b.fx, b.hy0 + 5, 33, b.fx + 2, b.hy0 + 6, 35, C("darkwood", 2)).box(b.fx, b.hy0 + 5, 42, b.fx + 2, b.hy0 + 6, 44, C("darkwood", 2))
    b.mouth(C("skin", 0), z0=36, z1=41, y=b.hy0 + 4)
    g.box(b.fx, b.hy0 + 9, 30, b.fx + 1, b.hy0 + 10, 33, C("iron", 2))
    # backwards cap: crown over the top, brim sticking out the back
    cap = b.head_shell(1, 16)
    g.where(cap, C("red", 4))
    g.where(cap & (Y == b.hy0 + 16), C("red", 3))
    g.box(b.hx0 - 5, b.hy0 + 15, 32, b.hx0, b.hy0 + 16, 45, C("red", 3))
    g.box(b.hx0 - 1, b.hy0 + 17, 36, b.hx0, b.hy0 + 19, 41, C("gray", 7))  # strap gap
    g.where(b.shell(["Head"], 1) & (Y >= b.hy0 + 10) & (Y < b.hy0 + 16) & (X < b.hx0 + 8), C("darkwood", 2))  # hair under the cap
    g.speckle(seed=13, amount=0.1)
    return Asset(id=f"{PACK}-characters-skins-mechanic", pack=PACK, category="characters-skins", name="Mechanic", root=Part("skin apocalypse-mechanic", g, pivot=PIVOT))
