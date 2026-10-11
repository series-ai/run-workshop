"""Druid skin: a stag-antler hood of bark-brown hide over a moss-and-leaf
mantle, a patched earth robe with a rope belt and wooden beads, a long
white beard, green face paint, bark bracers and bare feet with toe
rings."""
import numpy as np

from _kit import HX0, HX1, HY0, HY1, HZ0, HZ1, FACE_X, face, jitter, rig_idx
from rigkit import PIVOT, body, dilate, leg_z_ranges, region, rig_grid, shell
from voxgrid import C, Asset, Part


def build():
    g = rig_grid()
    x, y, z = rig_idx()
    g.where(region(["Head"]), C("skin", 4))
    g.where(region(["Chest", "Body", "Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"]), C("rust", 3))
    g.where(region(["Arm.L", "Arm.R"]), C("rust", 4))
    g.where(region(["ForeArm.L", "ForeArm.R"]), C("darkwood", 4))
    g.where(region(["ForeArm.L", "ForeArm.R"]) & ((y + z) % 3 == 0), C("darkwood", 3))
    g.where(region(["Hand.L", "Hand.R"]), C("skin", 4))
    face(g, eye=C("forest", 1), eye_hi=C("lime", 6), brow=C("darkwood", 5), mouth=C("skindark", 4))
    g.box(FACE_X, 45, 30, FACE_X + 1, 46, 35, C("leaf", 4)).box(FACE_X, 45, 41, FACE_X + 1, 46, 46, C("leaf", 4))  # face paint
    g.box(FACE_X, 43, 37, FACE_X + 2, 46, 39, C("skin", 5))  # nose bridge
    # A tapered beard leaves the eyes and nose clear.
    for k in range(9):
        w = 7 - k // 2
        y0 = 41 - k * 2
        shade = 7 if k % 3 else 6
        g.box(FACE_X - 1, y0, 38 - w, FACE_X + 2 - (k > 4), y0 + 2, 38 + w, C("bone", shade))
        if k < 6:
            g.box(FACE_X - 1, y0, 37, FACE_X + 1, y0 + 2, 38, C("bone", 5))  # beard groove
    g.box(FACE_X, 42, 34, FACE_X + 2, 44, 42, C("bone", 7))  # moustache
    # Bark-brown hair hood with strand shading across every visible face.
    rear_lock_zone = (x > HX0 + 1) & (x <= HX0 + 4)
    hood = shell(["Head"], 2) & (rear_lock_zone | (y >= HY1 - 2)) & (y >= HY0 + 4)
    g.where(hood, C("wood", 4))
    # Soft grooves follow the hair from the crown into the rear locks.
    g.where(hood & (x <= HX0 - 1) & ((z // 5) % 3 == 0), C("wood", 3))
    g.where(hood & (z <= HZ0 + 1) & ((x // 5) % 3 == 0), C("wood", 3))
    g.where(hood & (z >= HZ1 - 1) & ((x // 5) % 3 == 0), C("wood", 3))
    g.where(hood & (y >= HY1) & ((z % 6) == 0), C("wood", 3))  # crown strands
    # Separate fringe locks step over the forehead and leave the brows clear.
    for z0, y0, y1 in ((29, 52, 56), (33, 50, 56), (37, 53, 57), (41, 51, 56), (45, 53, 57)):
        g.box(FACE_X - 1, y0, z0, FACE_X + 1, y1, z0 + 3, C("wood", 4))
        g.box(FACE_X, y0 + 1, z0 + 1, FACE_X + 1, y1, z0 + 2, C("wood", 5))
    # Side locks frame the face and join the rear hood.
    for z0, y0, y1 in ((25, 39, 51), (47, 41, 53)):
        g.box(HX0 + 8, y0, z0, HX0 + 12, y1, z0 + 3, C("wood", 4))
        g.box(HX0 + 9, y0 + 2, z0, HX0 + 11, y1 - 2, z0 + 1, C("wood", 3))
    # Raised rear locks cover the back of the skull and end at varied heights.
    for z0, y0, x0 in ((27, 37, 9), (31, 34, 10), (35, 39, 9), (39, 35, 10), (43, 38, 9), (47, 36, 10)):
        g.box(x0 + 3, y0 + 2, z0 + 1, x0 + 7, HY1 + 2, z0 + 4, C("wood", 4))  # joined root
        g.box(x0, y0, z0, x0 + 4, HY1 + 1, z0 + 4, C("wood", 4))  # raised lock
        g.box(x0, y0 + 2, z0 + 1, x0 + 1, HY1 - 2, z0 + 3, C("wood", 5))  # strand highlight
        g.box(x0 + 1, y0 - 2, z0 + 1, x0 + 3, y0, z0 + 3, C("wood", 4))  # tapered tip
    for sign, zb in ((-1, HZ0 - 2), (1, HZ1 + 1)):
        g.box(HX0 + 8, HY1 - 2, zb, HX0 + 11, HY1 + 3, zb + 1, C("wood", 4))  # hide ears
        base_z = 38 + sign * 7
        g.line((HX0 + 6, HY1 + 2, base_z), (HX0 + 4, HY1 + 16, base_z + sign * 8), 1.0, C("bone", 5))
        g.line((HX0 + 5, HY1 + 8, base_z + sign * 3), (HX0 + 9, HY1 + 14, base_z + sign * 2), 0.8, C("bone", 6))
        g.line((HX0 + 4, HY1 + 12, base_z + sign * 6), (HX0 + 2, HY1 + 18, base_z + sign * 4), 0.8, C("bone", 6))
        g.line((HX0 + 4, HY1 + 15, base_z + sign * 8), (HX0 + 3, HY1 + 20, base_z + sign * 11), 0.7, C("bone", 6))
    # moss & leaf mantle on the shoulders
    mantle = shell(["Chest", "Arm.L", "Arm.R"], 2) & (y >= 31) & (y < 38) & (z > 20) & (z < 56) & ~region(["Head"])
    g.where(mantle & (g.a == 0), C("moss", 4))
    rng = np.random.default_rng(3)
    g.where(mantle & (rng.random(mantle.shape) < 0.35), C("leaf", 5))
    g.where(mantle & (rng.random(mantle.shape) < 0.08), C("pink", 6))
    # Robe skirt, stitched seams, a buckle, leaf trim and belt pouch.
    for yy in range(3, 17):
        ring = dilate(body() & (y >= 5) & (y < 17) & ~region(["Arm.L", "Arm.R"]), 1 + (17 - yy) // 6) & (y == yy)
        g.where(ring & (g.a == 0), C("rust", 3 if (yy // 3) % 2 else 2))
    g.where(shell(["Body"], 1) & (y >= 17) & (y < 19), C("sand", 5))
    g.where(shell(["Body"], 1) & (y >= 17) & (y < 19) & (x >= FACE_X - 1), C("darkwood", 3))
    g.box(25, 16, 36, 27, 20, 40, C("gold", 5))  # belt buckle frame
    g.box(27, 17, 37, 28, 19, 39, C("leaf", 5))  # carved leaf center
    g.box(25, 12, 31, 28, 17, 35, C("wood", 3))  # front pouch
    g.box(28, 14, 32, 29, 16, 34, C("gold", 4))  # pouch clasp
    g.box(24, 12, 34, 25, 18, 35, C("sand", 5))
    for k, zz in enumerate(range(31, 46, 2)):
        g.set(24, 30 - abs(zz - 38) // 2, zz, C("wood", 5 if k % 2 else 2))
    g.box(24, 25, 37, 25, 28, 39, C("leaf", 5))  # pendant
    # Dark piping and green leaf marks define the robe legs.
    legs = region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"])
    g.where(legs & (y >= 8) & (y < 12) & (x >= FACE_X - 2), C("rust", 4))
    g.where(legs & (x >= FACE_X - 1) & (y < 14) & ((z <= 33) | (z >= 42)), C("darkwood", 3))
    for z0 in (30, 42):
        g.box(25, 10, z0, 27, 14, z0 + 3, C("leaf", 4))
        g.box(27, 11, z0 + 1, 28, 13, z0 + 2, C("lime", 5))
    # patches
    g.box(24, 10, 30, 25, 13, 33, C("khaki", 4)).box(24, 22, 42, 25, 25, 45, C("sand", 4))
    # bare feet with toe rings
    for z0, z1 in leg_z_ranges().values():
        g.box(16, 0, z0, 28, 2, z1, C("skin", 4))
        g.box(16, 2, z0, 22, 4, z1, C("skin", 4))
        g.box(26, 0, z0 + 2, 28, 1, z0 + 3, C("gold", 5))
    jitter(g, 71, 0.08)
    return Asset(id="fantasy-characters-skins-druid", pack="fantasy", category="characters-skins", name="Druid",
                 root=Part("skin fantasy-druid", g, pivot=PIVOT))
