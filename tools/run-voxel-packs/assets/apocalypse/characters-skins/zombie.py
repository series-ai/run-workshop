"""Zombie skin: teal rot, a torn sand shirt, patched trousers, a mismatched
stare, a toothy mouth, a lobed brain wound, and grouped dark hair."""

from _kit import PACK, RigBody
from rigkit import PIVOT, rig_grid
from voxgrid import C, Asset, Part


def build() -> Asset:
    g = rig_grid()
    b = RigBody(g)
    X, Y, Z = b.X, b.Y, b.Z
    skin = C("forest", 5)
    shirt = C("sand", 4)
    trouser = C("khaki", 2)
    b.paint(skin, shirt, shirt, C("forest", 4), trouser, C("darkwood", 4), boot_hi=5, cuff=C("rust", 3))

    # Painted rot breaks up the broad green head while keeping the face clear.
    head = b.region(["Head"])
    face = head & (X == b.fx)
    g.where(face & (Y >= b.hy0 + 7) & (Y < b.hy0 + 10) & (Z >= 29) & (Z < 33), C("moss", 3))
    g.where(face & (Y >= b.hy0 + 8) & (Y < b.hy0 + 10) & (Z >= 29) & (Z < 32), C("teal", 2))
    # A torn cheek wound, with a dark cut and two visible stitch marks.
    g.where(face & (Y >= b.hy0 + 7) & (Y < b.hy0 + 10) & (Z >= 45) & (Z < 49), C("blood", 2))
    g.where(face & (Y == b.hy0 + 8) & (Z >= 46) & (Z < 48), C("rust", 3))
    for zz in (45, 48):
        g.where(face & (Y == b.hy0 + 8) & (Z == zz), C("iron", 4))
    # A larger rot bruise breaks up the bare side of the head.
    side_skin = head & (Z == b.hz1 - 1) & (Y >= b.hy0 + 4) & (Y < b.hy0 + 11) & (X >= b.hx0 + 4) & (X < b.hx1 - 3)
    side_bruise = side_skin & (((X - (b.hx0 + 8)) ** 2 / 12) + ((Y - (b.hy0 + 7)) ** 2 / 10) <= 1)
    g.where(side_bruise, C("moss", 3))
    g.where(side_bruise & (((X - (b.hx0 + 8)) ** 2 / 12) + ((Y - (b.hy0 + 7)) ** 2 / 10) <= 0.42), C("teal", 3))
    # A stitched cut breaks up the broad green rear of the head.
    rear_cut = head & (X == b.hx0) & (Y >= b.hy0 + 2) & (Y < b.hy0 + 5) & (Z >= 34) & (Z < 41)
    g.where(rear_cut & (Y == b.hy0 + 3) & (Z >= 35) & (Z < 40), C("blood", 2))
    for zz in (35, 37, 39):
        g.where(rear_cut & (Y == b.hy0 + 4) & (Z == zz), C("iron", 4))
    # Short claw tips and knuckle ridges give both hands a readable end shape.
    hands = b.region(["Hand.L", "Hand.R"])
    for end_z, inner_z in ((9, 10), (66, 65)):
        for claw_x, claw_y in ((20, 31), (22, 33)):
            g.where(hands & (Z == end_z) & (X == claw_x) & (Y == claw_y), C("darkwood", 2))
            g.where(hands & (Z == inner_z) & (X == claw_x) & (Y == claw_y), C("bone", 5))

    # Dusty shirt panels, dark edging, and a salvage patch on the chest.
    torso = b.region(["Chest", "Body"])
    # Collar, placket, and a stitched salvage patch on the chest.
    g.where(torso & (X >= 23) & (Y >= 33) & (Y < 35) & (Z >= 34) & (Z < 43), C("iron", 2))
    g.where(torso & (X >= 23) & (Y >= 20) & (Y < 31) & (Z >= 38) & (Z < 39), C("iron", 3))
    g.where(torso & (X >= 23) & (Y >= 27) & (Y < 31) & (Z >= 43) & (Z < 48), C("rust", 3))
    g.where(torso & (X >= 23) & (Y == 27) & (Z >= 44) & (Z < 47), C("gold", 5))
    g.where(torso & (X >= 23) & (Y == 26) & (Z >= 44) & (Z < 48), C("darkwood", 2))
    # A large repair patch and a seam make the back readable too.
    g.where(torso & (X <= 22) & (Y >= 24) & (Y < 33) & (Z >= 30) & (Z < 38), C("rust", 3))
    g.where(torso & (X <= 22) & (Y >= 25) & (Y < 32) & (Z >= 31) & (Z < 37), C("sand", 3))
    g.where(torso & (X <= 22) & ((Y == 24) | (Y == 32)) & (Z >= 31) & (Z < 37) & (Z % 2 == 0), C("gold", 5))
    g.where(torso & (X <= 22) & (Y >= 27) & (Y < 31) & (Z >= 31) & (Z < 33), C("rust", 2))
    g.where(torso & (X <= 22) & (Y == 25) & (Z >= 35) & (Z < 37), C("blood", 2))
    g.where(torso & (X <= 22) & (Z >= 38) & (Z < 39) & (Y >= 20) & (Y < 33), C("iron", 3))
    # Frayed hems and a rust-stained tear make the shirt look scavenged.
    g.where(torso & (Y >= 16) & (Y < 19) & (Z >= 30) & (Z < 35) & (X >= 23), C("rust", 3))
    g.where(torso & (Y == 16) & (Z >= 31) & (Z < 34) & (X >= 23), C("blood", 2))
    g.where(torso & (Y >= 30) & (Y < 33) & (Z >= 30) & (Z < 33) & (X >= 23), C("iron", 3))
    # A narrow hazard stitch gives the front patch a strong salvage accent.
    g.where(torso & (X >= 23) & (Y == 30) & (Z >= 44) & (Z < 48), C("gold", 5))
    # Expose a small rib tear through a jagged shirt opening.
    g.where(torso & (X >= 23) & (Y >= 22) & (Y < 28) & (Z >= 31) & (Z < 37), C("blood", 2))
    for yy in (23, 25, 27):
        g.where(torso & (X >= 23) & (Y == yy) & (Z >= 32) & (Z < 36), C("bone", 6))
    g.where(torso & (X >= 23) & (Y == 22) & (Z >= 31) & (Z < 34), C("rust", 3))
    g.where(b.region(["ForeArm.L", "ForeArm.R"]) & ((Z < 20) | (Z > 56)), skin)
    g.where(b.region(["ForeArm.L", "ForeArm.R"]) & ((Z == 20) | (Z == 56)) & (Y % 2 == 0), C("rust", 4))
    # A torn sleeve has a dark split and a rust-red underlayer.
    sleeve_tear = b.region(["Arm.R"]) & (X >= 22) & (Y >= 37) & (Y < 41) & (Z >= 56) & (Z < 60)
    g.where(sleeve_tear, C("blood", 2))
    g.where(sleeve_tear & (Y == 39) & (Z >= 57) & (Z < 59), C("bone", 5))
    # One forearm and hand have turned grey-green. A dark cuff marks the rot.
    rot_arm = b.region(["ForeArm.R", "Hand.R"]) & (Z > 55)
    g.where(rot_arm, C("moss", 4))
    g.where(b.region(["ForeArm.R"]) & (Z >= 56) & (Z < 59), C("iron", 2))
    g.where(b.torso_shell(1, 16, 19), C("darkwood", 3))
    g.where(b.torso_shell(1, 16, 19) & (Z % 3 == 0), C("iron", 4))

    # Keep both legs inside the rig silhouette. Paint a torn knee and boot seams.
    legs = b.region(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"])
    g.where(legs & (Y >= 13) & (Y < 14) & (Z % 4 == 0), C("sand", 4))
    b.boots(C("darkwood", 4), 5, cuff=C("rust", 3), toe=C("iron", 2))
    g.where(b.region(["Foot.L", "Foot.R"]), C("darkwood", 4))
    for z0, z1 in b.legs.values():
        g.where((Y == 5) & (Z >= z0) & (Z < z1) & (X >= 15) & (X < 25), C("rust", 3))
        g.where((Y <= 2) & (Z >= z0 + 2) & (Z < z1 - 2) & (X >= 15) & (X < 27), C("iron", 3))
        # Framed sand patches repair both trouser knees.
        knee = b.region(["Leg.L", "Leg.R"]) & (Z >= z0 + 2) & (Z < z1 - 2) & (Y >= 10) & (Y < 14) & (X >= 23)
        g.where(knee & ((Y == 10) | (Y == 13) | (Z == z0 + 2) | (Z == z1 - 3)), C("darkwood", 2))
        g.where(knee & (Y >= 11) & (Y < 13) & (Z > z0 + 2) & (Z < z1 - 3), C("sand", 5))

    # Mismatched eyes, a dark open mouth, and large readable teeth.
    b.eyes(C("iron", 0), white=None, left=(32, 36), right=(40, 44), h=3)
    g.box(b.fx, b.hy0 + 12, 33, b.fx + 1, b.hy0 + 13, 35, C("red", 6))
    g.box(b.fx, b.hy0 + 11, 41, b.fx + 1, b.hy0 + 14, 43, C("bone", 7))
    b.mouth(C("blood", 1), z0=34, z1=43, y=b.hy0 + 3, h=4)
    for z in range(34, 43, 2):
        g.set(b.fx, b.hy0 + 6, z, C("bone", 6)).set(b.fx, b.hy0 + 3, z + 1, C("bone", 5))
    g.box(b.fx, b.hy0 + 15, 32, b.fx + 1, b.hy0 + 16, 37, C("teal", 2))

    # Solid hair cap with broad, stepped locks over the crown and rear.
    scalp = b.head_shell(1, 16)
    back_locks = b.shell(["Head"], 1) & (Y >= b.hy0 + 8) & (X < b.hx0 + 8)
    hair = scalp | back_locks
    g.where(hair, C("darkwood", 2))
    g.where(hair & (Y >= b.hy0 + 19), C("darkwood", 3))
    g.where(hair & (X < b.hx0 + 6) & (Y < b.hy0 + 16) & ((Z // 5) % 2 == 0), C("darkwood", 4))
    g.where(hair & (X < b.hx0 + 6) & (Y < b.hy0 + 13) & (Z % 10 < 4), C("darkwood", 1))
    # Bare gaps break the straight hairline above the forehead.
    hairline = hair & (X == b.hx1) & (Y >= b.hy0 + 14) & (Y < b.hy0 + 17)
    g.where(hairline & (((Z >= 31) & (Z < 34)) | ((Z >= 39) & (Z < 41)) | ((Z >= 45) & (Z < 47))), C("forest", 4))
    g.where(hairline & (Y == b.hy0 + 15) & ((Z == 34) | (Z == 44)), C("blood", 2))
    g.where(back_locks & (Y >= b.hy0 + 9) & (Y < b.hy0 + 14) & (Z >= 31) & (Z < 36), C("darkwood", 4))
    g.where(back_locks & (Y >= b.hy0 + 11) & (Y < b.hy0 + 16) & (Z >= 36) & (Z < 41), C("darkwood", 3))
    g.where(back_locks & (Y >= b.hy0 + 9) & (Y < b.hy0 + 14) & (Z >= 41) & (Z < 46), C("darkwood", 4))
    crown = hair & (Y >= b.hy0 + 19)
    g.where(crown & (X >= b.hx0 + 6) & (X < b.hx0 + 10) & (Z >= 29) & (Z < 36), C("darkwood", 4))
    g.where(crown & (X >= b.hx0 + 13) & (X < b.hx0 + 17) & (Z >= 41) & (Z < 47), C("darkwood", 4))

    # Torn scalp edge, painted in a broken blood-dark rim.
    wound_area = b.head_shell(1, 21) & (Z >= 32) & (Z < 47) & (X >= 14) & (X < 28)
    g.where(wound_area, C("blood", 2))
    ragged_edge = wound_area & (
        ((X == 14) & (Z % 3 != 1)) | ((X == 27) & (Z % 3 == 0)) |
        ((Z == 32) & (X % 3 != 0)) | ((Z == 46) & (X % 4 != 1))
    )
    g.where(ragged_edge, C("darkwood", 1))
    broken_hair = wound_area & (
        ((X == 15) & (Z >= 33) & (Z <= 35)) | ((X == 26) & (Z >= 43) & (Z <= 45)) |
        ((Z == 33) & (X >= 16) & (X <= 18)) | ((Z == 45) & (X >= 23) & (X <= 25))
    )
    g.where(broken_hair, C("darkwood", 2))
    # Four overlapping lobes create brain folds with dark creases between.
    brain_top = b.head_shell(1, 21) & (Y >= b.hy0 + 21)
    lobes = (
        ((X - 18) ** 2 / 13 + (Z - 37) ** 2 / 12 <= 1) |
        ((X - 22) ** 2 / 13 + (Z - 37) ** 2 / 12 <= 1) |
        ((X - 18) ** 2 / 13 + (Z - 41) ** 2 / 12 <= 1) |
        ((X - 22) ** 2 / 13 + (Z - 41) ** 2 / 12 <= 1)
    )
    brain = brain_top & lobes & (X >= 16) & (X < 25) & (Z >= 34) & (Z < 45)
    g.where(brain, C("pink", 4))
    # Offset highlights on the upper edges make each lobe look rounded.
    g.where(brain & (((X <= 18) & (Z <= 39)) | ((X >= 22) & (Z >= 40))), C("pink", 6))
    g.where(brain & (((X - 18) ** 2 + (Z - 37) ** 2 >= 10) & ((X - 18) ** 2 + (Z - 37) ** 2 <= 14)), C("pink", 3))
    # Dark seams separate the raised lobes without making a stripe pattern.
    creases = brain & (((X == 20) & ((Z >= 35) & (Z <= 39))) | ((X == 21) & ((Z >= 40) & (Z <= 43))))
    g.where(creases, C("blood", 3))
    # Small dried blood marks continue down the temple from the torn edge.
    g.where(head & (X >= b.hx1 - 2) & (Y >= b.hy0 + 18) & (Y < b.hy0 + 21) & (Z >= 43) & (Z < 46), C("blood", 2))

    return Asset(id=f"{PACK}-characters-skins-zombie", pack=PACK, category="characters-skins", name="Zombie", root=Part("skin apocalypse-zombie", g, pivot=PIVOT))
