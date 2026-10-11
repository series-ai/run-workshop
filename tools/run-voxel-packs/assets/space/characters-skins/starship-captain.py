"""Starship captain skin: a white-hull command coat with steel framing,
copper rank marks, cyan comms hardware and a compact command helmet."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, face, fill, gloves, head_box, region, rig_grid, rxyz, shell
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (_, hy0, _), (_, hy1, _) = head_box()

    # The dark pressure layer frames the brighter armor and keeps each limb
    # segment readable at thumbnail size.
    base_body(g, C("skin", 5), C("steel", 4), sleeve=C("steel", 4),
              hand=C("steel", 3), legs=C("steel", 3))
    face(g, eye=C("iron", 1), mouth=C("skindark", 3), brow=C("iron", 2), eye_h=2)
    # A stepped, swept-back hairstyle leaves the rear of the head shaped rather
    # than covered by one square slab.
    hair_edge = ((z < 31) | (z > 44)).astype(int)
    crown_hair = (y >= 45 + hair_edge) & (y < (53 - hair_edge * 3))
    rear_locks = (((z >= 32) & (z <= 35)) | ((z >= 40) & (z <= 43))) & \
        (y >= 39) & (y < 47)
    hair = region(HEAD) & (x >= 13) & (x < 17) & (crown_hair | rear_locks)
    fill(g, hair, C("rust", 4))
    # Short side locks step down at the temples. Copper highlights follow the
    # swept shape and break up the side and back planes.
    side_locks = region(HEAD) & (x >= 13) & (x < 16) & (y >= 42) & (y < 45) & \
        ((z == 27) | (z == 48))
    fill(g, side_locks, C("rust", 4))
    for zz in (29, 33, 42, 46):
        g.set(13, 49 if zz in (33, 42) else 48, zz, C("rust", 6))
    for zz in (30, 34, 41, 45):
        g.set(13, 47, zz, C("steel", 3))
    g.box(28, 43, 35, 29, 44, 41, C("iron", 2))
    g.set(28, 43, 34, C("rust", 4)).set(28, 43, 41, C("rust", 4))

    # White pressure coat with a framed steel outer shell.
    coat = shell(["Chest", "Body"], 1) & (y < hy0)
    fill(g, coat, C("steel", 4))
    chest = coat & (x >= 23) & (y >= 21)
    fill(g, chest, C("bone", 6))
    fill(g, chest & ((y == 21) | (y == 34) | (z == 29) | (z == 46)), C("steel", 2))
    # A narrow copper command placket and segmented rank fasteners.
    fill(g, coat & (x >= 24) & (z >= 37) & (z < 39) & (y >= 19), C("rust", 5))
    for yy in (21, 25, 29, 33):
        g.box(25, yy, 36, 26, yy + 1, 40, C("rust", 5))
        g.set(26, yy, 38, C("bone", 6))
    # Steel shoulder boards have copper edging and cyan rank lights.
    for z0, z1 in ((23, 31), (45, 53)):
        g.box(15, 34, z0, 25, 38, z1, C("steel", 5))
        g.box(15, 37, z0 + 1, 24, 38, z1 - 1, C("bone", 6))
        g.box(15, 34, z0, 25, 35, z0 + 1, C("rust", 5))
        for zz in (z0 + 2, z1 - 3):
            g.set(25, 36, zz, C("cyan", 6))

    # Cross-body command harness continues around the back of the coat.
    for k in range(13):
        yy, zz = 33 - k, 46 - k
        g.box(25, yy, zz, 26, yy + 2, zz + 1, C("rust", 5))
        if k in (2, 6, 10):
            g.box(26, yy, zz, 27, yy + 2, zz + 1, C("steel", 2))
            g.set(27, yy + 1, zz, C("cyan", 6))
    # Rear belt, framed back plates and a small cyan life-support readout.
    fill(g, coat & ((y == 16) | (y == 17)), C("iron", 2))
    g.box(15, 16, 31, 17, 18, 45, C("rust", 5))
    g.box(14, 20, 33, 15, 31, 43, C("steel", 5))
    g.box(14, 22, 35, 15, 29, 41, C("steel", 3))
    g.box(13, 25, 37, 14, 28, 39, C("cyan", 6))
    for zz in (32, 44):
        g.box(14, 20, zz, 16, 31, zz + 1, C("rust", 4))
    for k in range(10):
        yy, zz = 32 - k, 30 + k
        g.box(14, yy, zz, 15, yy + 2, zz + 1, C("rust", 5))
        if k in (3, 7):
            g.set(13, yy + 1, zz, C("cyan", 6))

    # Articulated sleeves, copper cuff bands and cyan wrist indicators.
    arms = shell(["Arm.L", "Arm.R"], 1)
    fill(g, arms & (y >= 33), C("bone", 5))
    fill(g, shell(["ForeArm.L", "ForeArm.R"], 1), C("steel", 5))
    cuffs = shell(["ForeArm.L", "ForeArm.R"], 1) & ((z >= 18) & (z <= 20) | (z >= 55) & (z <= 57))
    fill(g, cuffs, C("rust", 5))
    fill(g, cuffs & (y >= 29) & (y <= 30), C("cyan", 6))
    gloves(g, C("bone", 6), cuff=C("steel", 5), grow=1)

    # Bright leg plates, dark joint breaks and framed boots lift the silhouette
    # from the dark sheet background.
    leg_shell = shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1)
    fill(g, leg_shell & (y >= 6), C("steel", 4))
    fill(g, leg_shell & (y >= 9) & (y <= 10), C("iron", 2))
    fill(g, leg_shell & (y >= 11) & (y <= 13) & (x >= 23), C("bone", 5))
    fill(g, leg_shell & (y >= 4) & (y <= 6) & (x >= 23), C("rust", 4))

    # A broad command helmet keeps the captain silhouette, with white crown
    # plates, a steel brim, copper rim and a bright cyan insignia.
    cap = dilate(region(HEAD), 1) & (y >= hy1 - 5)
    fill(g, cap, C("steel", 4))
    g.box(13, hy1 + 1, 26, 30, hy1 + 3, 50, C("bone", 6))
    g.box(14, hy1 + 2, 27, 29, hy1 + 3, 49, C("steel", 5))
    # Raised crown panels use painted seams and corner fasteners.
    for zz in (29, 36, 43, 48):
        g.set(14, hy1 + 2, zz, C("steel", 3))
        g.set(28, hy1 + 2, zz, C("steel", 3))
    for xx in (16, 27):
        for zz in (30, 46):
            g.set(xx, hy1 + 2, zz, C("rust", 5))
    g.box(12, hy1 - 5, 26, 30, hy1 - 4, 50, C("iron", 2))
    g.box(28, hy1 - 6, 29, 33, hy1 - 5, 47, C("steel", 5))
    g.box(29, hy1 - 5, 30, 30, hy1 - 4, 46, C("rust", 5))
    # Oversized command badge with a copper frame and cyan center.
    g.box(29, hy1 - 3, 35, 30, hy1 + 1, 41, C("rust", 5))
    g.box(30, hy1 - 2, 36, 31, hy1, 40, C("cyan", 6))
    g.set(31, hy1 - 1, 38, C("bone", 7))
    # Cyan-lit side communicator and orange emergency marker.
    g.box(17, hy1 - 2, 45, 21, hy1 + 1, 48, C("steel", 3))
    g.box(16, hy1 - 1, 46, 17, hy1, 47, C("cyan", 7))
    g.box(20, hy1 - 4, 47, 21, hy1 - 2, 48, C("orange", 5))

    boots(g, C("steel", 4), C("bone", 5), C("iron", 2), height=8, pad=1)
    # Bright sole rails and copper ankle plates keep both boot shapes distinct.
    for z0, z1 in ((28, 36), (40, 48)):
        g.box(24, 2, z0, 27, 4, z1, C("rust", 4))
        g.box(25, 1, z0 + 1, 28, 2, z1 - 1, C("steel", 5))

    return asset("characters-skins", "starship-captain", "Starship Captain", Part("skin space-starship-captain", g, pivot=PIVOT))
