"""Hazmat skin: a sealed yellow biohazard suit with black taped seams, a
hood with a big dark visor, a twin-canister respirator, black gloves and
boots, a radiation badge and a dosimeter clipped on."""
import numpy as np

from _kit import PACK, RigBody
from rigkit import PIVOT, dilate, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    suit = C("gold", 5)
    b.paint(suit, suit, suit, C("iron", 1), suit, C("iron", 1), boot_hi=7)
    g.where(b.torso_shell(1, 16, 36), suit)  # baggy suit
    g.where(b.leg_shell(1) & (Y >= 7), suit)
    g.where(b.arm_shell(1, ("Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R")), suit)
    seams = (b.torso_shell(1, 16, 36) | b.leg_shell(1)) & ((Z == 38) | (Y == 17) | (Y == 26))
    g.where(seams, C("iron", 2))
    g.where(b.arm_shell(1, ("ForeArm.L", "ForeArm.R")) & ((Z == 17) | (Z == 59)), C("iron", 1))  # glove tape
    g.where(b.leg_shell(1) & (Y == 7), C("iron", 1))
    g.where(b.torso_shell(1, 16, 36) & (X >= 24) & (Y >= 27) & (Y < 31) & (Z >= 41) & (Z < 45), C("iron", 1))  # badge
    g.where(b.torso_shell(1, 16, 36) & (X >= 24) & (Y == 29) & (Z == 43), C("gold", 6))
    g.where(b.torso_shell(1, 16, 36) & (X >= 24) & (Y >= 20) & (Y < 24) & (Z >= 31) & (Z < 33), C("toxic", 4))  # dosimeter
    # hood: 2-voxel shell over the whole head
    hood = dilate(b.region(["Head"]), 2) & ~b.body() & (Y >= b.hy0 - 1)
    g.where(hood, suit)
    g.where(hood & (Y >= b.hy1 + 1) & ((X + Z) % 5 == 0), C("gold", 4))
    # visor on the face
    vis = hood & (X >= b.hx1) & (Y >= b.hy0 + 9) & (Y < b.hy0 + 19) & (Z >= 30) & (Z < 47)
    g.where(vis, C("navy", 1))
    g.where(vis & (Y >= b.hy0 + 16) & (Z >= 32) & (Z < 36), C("sky", 5))  # reflection
    g.where(vis & (Y == b.hy0 + 17) & (Z >= 36) & (Z < 38), C("sky", 6))
    frame = hood & (X >= b.hx1) & (((Y == b.hy0 + 8) | (Y == b.hy0 + 19)) & (Z >= 29) & (Z < 48))
    g.where(frame, C("iron", 2))
    # respirator snout and canisters
    g.box(b.hx1 + 1, b.hy0 + 3, 34, b.hx1 + 4, b.hy0 + 8, 43, C("iron", 2))
    g.box(b.hx1 + 3, b.hy0 + 4, 36, b.hx1 + 4, b.hy0 + 7, 41, C("iron", 1))
    for z0 in (29, 44):
        g.box(b.hx1, b.hy0 + 2, z0, b.hx1 + 4, b.hy0 + 7, z0 + 4, C("steel", 4))
        g.box(b.hx1 + 3, b.hy0 + 3, z0 + 1, b.hx1 + 4, b.hy0 + 6, z0 + 3, C("steel", 6))
    g.speckle(seed=11, amount=0.08)
    return Asset(id=f"{PACK}-characters-skins-hazmat", pack=PACK, category="characters-skins", name="Hazmat Suit", root=Part("skin apocalypse-hazmat", g, pivot=PIVOT))
