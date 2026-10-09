"""Skeleton hunter skin: a bold grinning skull (deep sockets with
toxic-green glowing eyes, a brow ridge, cheekbones, a nose hole, a
jaw line and teeth; suture lines and dark edges round the cranium) on a
bone body, dressed as a monster hunter: a wide-brim leather hat with a
toxic-green band and a raven feather, a long violet coat (lapels, cuffs,
buttons, pocket flaps, tails behind) open over the rib cage, a
pumpkin-orange neckerchief, a leather bandolier of silver bullets strapped
across the chest, a belt with a silver buckle, grey trousers on two
separate legs and tall brown boots with light turned-down cuffs."""

import numpy as np

from _kit import C, FACE_X, Part, rig_canvas, xyz
from rigkit import PIVOT, bbox, region, shell
from voxgrid import Asset

CZ = 38  # the body's centre line (z)


def build():
    g = rig_canvas()
    x, y, z = xyz(g)
    zc = z + 0.5 - CZ
    bone, bone_l, bone_d, bone_dd = C("bone", 6), C("bone", 7), C("bone", 4), C("bone", 2)
    void = C("iron", 1)
    head = region(["Head"])
    (hx0, hy0, hz0), (hx1, hy1, hz1) = bbox(head)

    # ---- the skull: bone with dark edges, cranium sutures and a bold face
    g.where(head, bone)
    edge = head & ((((x == hx0) | (x == hx1 - 1)).astype(int) + ((y == hy0) | (y == hy1 - 1)).astype(int) + ((z == hz0) | (z == hz1 - 1)).astype(int)) >= 2)
    g.where(edge, bone_d)
    g.where(head & (x <= hx0 + 2) & (y < 44), C("bone", 5))  # shade under the back of the skull
    # suture lines over the back and the sides of the cranium
    back = head & (x == hx0)
    lambdoid = 55 - np.abs(zc) * 0.7 + ((z // 2) % 2)  # an inverted V with a zigzag
    g.where(back & (np.abs(y - lambdoid) < 0.6) & (np.abs(zc) < 10), bone_d)
    g.where(back & (np.abs(zc) < 0.6) & (y >= 55), bone_d)  # sagittal line up under the hat
    for zs in (hz0, hz1 - 1):
        side = head & (z == zs)
        g.where(side & (np.abs((y - 52) - (x - 20) * 0.4 - ((x // 2) % 2)) < 0.6) & (x < 25), bone_d)  # temple suture
        g.where(side & (np.abs((y - 37) - (x - 19) * 0.8) < 0.7) & (y < 44) & (x > 19), bone_d)  # jaw line
        g.where(side & (y >= 40) & (y < 44) & (x >= 22) & (x < 26), C("bone", 5))  # cheekbone shade
    # the face plate (x = FACE_X)
    fp = (x == FACE_X)
    g.where(head & fp & (y >= 51) & (y < 53) & (np.abs(zc) < 8.5), bone_l)  # brow ridge
    for s in (-1, 1):
        ec = CZ + s * 4.5  # socket centre (z)
        dz = (z + 0.5 - ec) * s  # +: toward the outer side
        sock = head & fp & (np.abs(z + 0.5 - ec) < 3.2) & (y >= 44) & (y < 51)
        sock &= ~((dz < -1.5) & (y >= 50))  # the inner top corner drops: a scowl
        sock &= ~((np.abs(z + 0.5 - ec) > 2.4) & ((y == 44) | (y == 50)))  # rounded corners
        g.where(sock, void)
        glow = head & fp & (np.abs(z + 0.5 - ec) < 1.1) & (y >= 46) & (y < 48)
        g.where(glow & (y == 46), C("toxic", 3))  # a glowing eye deep in the socket
        g.where(glow & (y == 47), C("toxic", 5))
        g.where(glow & (y == 47) & (np.abs(z + 0.5 - ec) < 0.6), C("toxic", 7))
        g.where(head & fp & (dz > 1.4) & (dz < 4.5) & (y >= 41) & (y < 44), C("bone", 5))  # cheekbone
    g.where(head & fp & (y >= 37) & (y < 41) & (np.abs(zc) >= 7.5), C("bone", 5))  # hollow cheeks: a narrower jaw
    g.where(head & fp & (y >= 37) & (y < 41) & (np.abs(zc) >= 9.5), bone_d)
    nose = head & fp & (((y == 43) & (np.abs(zc) < 2)) | ((y == 42) & (np.abs(zc) < 1.2)) | ((y == 41) & (np.abs(zc) < 0.6)))
    g.where(nose, void)
    # the grin: a dark mouth line that curls up at the ends, teeth over it
    mouth = head & fp & (((y == 38) & (np.abs(zc) < 7)) | ((y == 39) & (np.abs(zc) >= 6) & (np.abs(zc) < 8)))
    g.where(mouth, void)
    teeth = head & fp & (y >= 39) & (y < 41) & (np.abs(zc) < 6)
    g.where(teeth, bone_l)
    g.where(teeth & ((z % 2) == 0), bone_d)
    g.where(head & fp & (y == 37) & (np.abs(zc) < 5) & ((z % 2) == 1), bone_l)  # lower teeth

    # ---- the body under the clothes: bone hands, dark void with ribs
    body_r = region(["Chest", "Body", "Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"])
    g.where(body_r, void)
    hands = region(["Hand.L", "Hand.R"])
    g.where(hands, bone)
    g.where(hands & ((z == 9) | (z == 66)), C("bone", 5))  # finger tips
    chest_front = region(["Chest"]) & (x == 23)
    g.where(chest_front & ((y % 2) == 0) & (y >= 22) & (np.abs(zc) < 4), bone)  # ribs
    g.where(chest_front & (np.abs(zc) < 0.6) & (y >= 20), bone_l)  # sternum

    # ---- trousers and two separate boots
    legs = region(["Leg.L", "Leg.R"])
    g.where(legs, C("gray", 3))
    g.where(legs & (np.abs(zc) < 1.1), C("gray", 1))  # the split between the legs
    g.where(legs & ((x == 16) | (x == 23)) & ((np.abs(zc) - 4.5) % 9 < 0.6), C("gray", 2))  # side seams
    for side in ("L", "R"):
        (lx0, _ly0, lz0), (_lx1, _ly1, lz1) = bbox(region([f"LowerLeg.{side}", f"Foot.{side}"]))
        g.box(15, 0, lz0 - 1, 29, 5, lz1 + 1, C("wood", 2))  # foot
        g.box(15, 5, lz0 - 1, 25, 9, lz1 + 1, C("wood", 3))  # shaft
        g.box(15, 0, lz0 - 1, 29, 1, lz1 + 1, C("darkwood", 3))  # sole
        g.box(15, 4, lz0 - 1, 29, 5, lz1 + 1, C("wood", 1))  # ankle strap
        g.box(28, 1, lz0, 29, 4, lz1, C("wood", 3))  # toe cap
        g.box(14, 9, lz0 - 1, 26, 11, lz1 + 1, C("sand", 4))  # turned-down cuff
        g.box(14, 10, lz0 - 1, 26, 11, lz1 + 1, C("sand", 5))
        g.box(25, 4, (lz0 + lz1) // 2 - 1, 26, 5, (lz0 + lz1) // 2 + 1, C("steel", 6))  # strap buckle

    # ---- the long violet coat: torso, sleeves and tails behind
    coat_c, coat_l, coat_d = C("purple", 2), C("purple", 3), C("purple", 1)
    torso_sh = shell(["Chest", "Body"], 1)
    sleeves = shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1) & ~hands
    tails = shell(["Leg.L", "Leg.R"], 1) & (y >= 11) & (x <= 20)
    coat = (torso_sh | sleeves | tails) & (g.a == 0)
    g.where(coat, coat_c)
    g.where(coat & (y >= 33), coat_l)  # lit shoulders
    g.where(coat & sleeves & (y >= 34), coat_l)
    g.where(tails & coat & (np.abs(zc) < 0.6), coat_d)  # back vent
    g.where(coat & torso_sh & (x == 15) & (np.abs(zc) < 0.6) & (y < 33), coat_d)  # back seam
    g.where(sleeves & coat & ((z < 17) | (z > 58)), C("purple", 4))  # cuffs
    g.where(sleeves & coat & ((z == 17) | (z == 58)), coat_d)
    g.where(tails & coat & (y == 11), coat_d)  # hem
    # open front: carve the coat to show the rib cage, then lapels and buttons
    opening = (x >= 24) & (np.abs(zc) < 3.5) & (y >= 16) & (y < 36)
    g.carve(opening)
    front = torso_sh & (x == 24) & (g.a != 0)
    lapel = front & (np.abs(zc) >= 3.5) & (np.abs(zc) < 5.5 + (y - 26) * 0.25) & (y >= 26)
    g.where(lapel, C("purple", 4))
    g.where(lapel & (np.abs(zc) < 4.5), C("purple", 5))  # lit lapel edge
    g.where(front & (np.abs(zc) >= 3.5) & (np.abs(zc) < 4.5) & (y < 26), coat_d)  # coat front edges
    for yy in (19, 23):
        g.box(24, yy, 33, 25, yy + 1, 34, C("steel", 6))  # buttons
    for zp in (30, 43):
        g.box(24, 18, zp, 25, 19, zp + 4, coat_d)  # pocket flaps
    # belt in the opening, with a silver buckle
    g.where(torso_sh & (y >= 16) & (y < 18), C("wood", 3))
    g.box(23, 16, 36, 25, 18, 40, C("wood", 3))
    g.box(24, 16, 37, 25, 18, 39, C("steel", 7))
    g.set(24, 16, 37, C("steel", 5))
    # the pumpkin-orange neckerchief, knotted at the front
    scarf = shell(["Chest"], 2) & (y >= 34) & (y < 37) & ~head
    g.where(scarf, C("orange", 4))
    g.where(scarf & (y == 34), C("orange", 2))
    g.box(24, 31, 36, 26, 34, 40, C("orange", 4))  # knot and tails
    g.box(24, 29, 37, 25, 31, 39, C("orange", 3))
    g.box(25, 32, 37, 26, 34, 39, C("orange", 5))

    # ---- the bandolier: a leather strap from the left shoulder to the
    # right hip, silver bullets seated in loops along it, and its back run
    strap = np.zeros(g.shape, dtype=bool)
    for k in range(17):
        yy, zz = 34 - k, 31 + k
        strap |= (x == 24) & (y >= yy - 1) & (y < yy + 2) & (z == zz)
        strap |= (x == 15) & (y >= yy - 1) & (y < yy + 2) & (z == 2 * CZ - 1 - zz)
    strap &= (g.a != 0) | opening
    g.where(strap, C("wood", 3))
    g.where(strap & (x == 24) & ((y + z) % 2 == 0), C("wood", 2))  # stitched edge texture
    for k in range(1, 16, 3):
        yy, zz = 34 - k, 31 + k
        g.set(25, yy, zz, C("gold", 4))  # brass casing, on the strap
        g.set(25, yy + 1, zz, C("steel", 7))  # silver tip

    # ---- the wide-brim leather hat, a toxic-green band and a raven feather
    g.box(9, 57, 21, 33, 59, 55, C("darkwood", 4))  # brim
    g.box(9, 57, 21, 33, 58, 55, C("darkwood", 3))  # brim underside
    g.box(10, 58, 22, 32, 59, 54, C("darkwood", 5))
    g.box(13, 59, 27, 29, 66, 49, C("darkwood", 5))  # crown
    g.box(13, 65, 27, 29, 66, 49, C("darkwood", 6))  # lit top
    g.box(13, 65, 35, 29, 66, 41, 0)  # crease
    g.box(13, 59, 27, 29, 61, 49, C("toxic", 4))  # band
    g.box(13, 60, 27, 29, 61, 49, C("toxic", 5))
    g.box(29, 59, 36, 30, 61, 40, C("steel", 6))  # band buckle
    g.box(29, 59, 37, 30, 60, 39, C("steel", 4))
    for k in range(7):  # a raven feather tucked in the band, leaning back
        w = 1 if k in (0, 6) else 2
        g.box(23 - k, 60 + k, 49, 25 - k + w, 61 + k, 50, C("purple", 3))
        g.set(24 - k, 60 + k, 49, C("purple", 5) if k else C("purple", 2))  # quill
    return Asset(id="monster-characters-skins-skeleton-hunter", pack="monster", category="characters-skins", name="Skeleton Hunter",
                 root=Part("skin monster-skeleton-hunter", g, pivot=PIVOT))
