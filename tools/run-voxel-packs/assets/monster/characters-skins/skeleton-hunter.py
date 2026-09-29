"""Skeleton hunter skin: a grinning skull and bone body (ribs, pelvis and
limb bones over a dark void) dressed as a monster hunter: wide-brim hat,
long leather coat, a bandolier of stakes and silver buckles, tall boots."""

from _kit import C, FACE_X, Part, rig_canvas, speck, xyz
from rigkit import PIVOT, leg_z_ranges, region, shell
from voxgrid import Asset


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    bone, void = C("bone", 6), C("iron", 0)
    g.where(region(["Head"]), bone)
    g.where(region(["Head"]) & (((y + z) % 7) == 0) & (x < 20), C("bone", 5))
    # skull face
    for z0 in (31, 41):
        g.box(FACE_X, 45, z0, FACE_X + 1, 50, z0 + 5, void)  # sockets
        g.box(FACE_X, 47, z0 + 2, FACE_X + 1, 48, z0 + 3, C("ember", 6))  # pinprick glow
    g.box(FACE_X, 42, 37, FACE_X + 1, 45, 39, void)  # nose
    g.box(FACE_X, 38, 31, FACE_X + 1, 41, 46, C("bone", 7))  # teeth row
    for zz in range(31, 46, 2):
        g.box(FACE_X, 38, zz, FACE_X + 1, 41, zz + 1, C("bone", 4))
    g.box(FACE_X, 37, 31, FACE_X + 1, 38, 46, void)
    # body: dark void with bones
    g.where(region(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), void)
    g.where(region(["Hand.L", "Hand.R"]), bone)
    g.where(region(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"]) & (abs(y + 0.5 - 32) < 1.2) & (abs(x + 0.5 - 20) < 1.2), bone)
    for zc in (33, 43):
        g.where(region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]) & (abs(z + 0.5 - zc - 0.5) < 1.5) & (abs(x + 0.5 - 20) < 1.5), bone)
    # coat: long leather coat over the torso and upper legs, open at the front
    coat = shell(["Chest", "Body"], 1) | (shell(["Leg.L", "Leg.R"], 1) & (y >= 8))
    coat |= shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1)
    coat &= ~((x >= 24) & (abs(z + 0.5 - 38) < 3.5) & (y >= 16))
    g.where(coat, C("rust", 2))
    g.where(coat & ((y % 6) == 0), C("rust", 1))
    ribs = region(["Chest"]) & (x == 23) & (abs(z + 0.5 - 38) < 3.5) & ((y % 2) == 0) & (y >= 22)
    g.where(ribs, bone)
    g.box(23, 16, 36, 24, 36, 40, bone)  # sternum/spine
    g.box(23, 16, 34, 24, 19, 42, bone)  # pelvis
    g.carve((x >= 24) & (abs(z + 0.5 - 38) < 3.5) & (y >= 16) & (y < 36))
    g.box(23, 16, 36, 24, 36, 40, bone)
    # bandolier with stakes (diagonal)
    for k in range(18):
        yy, zz = 34 - k, 30 + k
        g.box(24, yy, zz, 26, yy + 2, zz + 1, C("darkwood", 2))
        if k % 4 == 1:
            g.box(26, yy - 1, zz, 27, yy + 4, zz + 1, C("wood", 5))
            g.set(26, yy + 4, zz, C("steel", 6))
    g.box(24, 17, 30, 25, 19, 46, C("darkwood", 2))  # belt
    g.box(25, 17, 37, 26, 19, 39, C("steel", 6))
    # wide-brim hat
    g.box(9, 57, 21, 33, 59, 55, C("darkwood", 2))
    g.box(13, 59, 27, 29, 66, 49, C("darkwood", 3))
    g.box(13, 59, 27, 29, 61, 49, C("blood", 2))
    g.box(13, 65, 35, 29, 66, 41, 0)  # crease
    g.box(26, 59, 44, 28, 64, 45, C("bone", 7))  # feather
    for z0, z1 in leg_z_ranges().values():  # tall boots
        g.box(15, 0, z0 - 1, 27, 9, z1 + 1, C("darkwood", 2))
        g.box(15, 9, z0 - 1, 25, 10, z1 + 1, C("darkwood", 3))
        g.box(24, 5, z0, 26, 6, z1, C("steel", 6))
    speck(g, 551, 0.05)
    return Asset(id="monster-characters-skins-skeleton-hunter", pack="monster", category="characters-skins", name="Skeleton Hunter",
                 root=Part("skin monster-skeleton-hunter", g, pivot=PIVOT))
