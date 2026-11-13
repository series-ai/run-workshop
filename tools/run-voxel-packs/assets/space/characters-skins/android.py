"""Android skin: a white hull-plated service android with a copper-framed
cyan face, a crown beacon, a bright chest reactor and articulated steel joints."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, fill, gloves, head_box, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    head = region(HEAD)
    torso = shell(["Chest", "Body"], 1)
    arms = shell(["Arm.L", "Arm.R", "ForeArm.L", "ForeArm.R"], 1)
    legs = shell(["Leg.L", "Leg.R", "LowerLeg.L", "LowerLeg.R"], 1) & (y >= 6)

    # White hull plates form the main silhouette. Steel remains at the joints.
    base_body(g, C("bone", 6), C("bone", 5), sleeve=C("bone", 5),
              hand=C("iron", 3), legs=C("steel", 5))
    fill(g, torso, C("bone", 6))
    fill(g, arms, C("steel", 5))
    fill(g, arms & (y >= 31) & (y < 35), C("bone", 6))
    fill(g, legs, C("bone", 5))

    # Helmet plates use broad blocks, with seams only at the edge and rear.
    fill(g, head & (y <= hy0 + 2), C("steel", 3))
    fill(g, head & (y >= hy1 - 5), C("steel", 5))
    fill(g, head & ((z == hz0) | (z == hz1 - 1)) & (y >= hy0 + 4) & (y < hy1 - 5), C("steel", 4))
    fill(g, head & (x == hx0) & (y >= hy0 + 4) & (y < hy1 - 5) & (z >= hz0 + 3) & (z < hz1 - 3), C("steel", 5))
    # Rear service hatch and its copper latch make the back read as designed.
    fill(g, head & (x == hx0) & (y >= hy0 + 8) & (y < hy1 - 7) & (z >= hz0 + 7) & (z < hz1 - 7), C("steel", 5))
    fill(g, head & (x == hx0) & (y == hy0 + 8) & (z >= hz0 + 7) & (z < hz1 - 7), C("rust", 5))
    fill(g, head & (x == hx0) & (y == hy1 - 8) & (z >= hz0 + 7) & (z < hz1 - 7), C("rust", 5))
    for zz in (hz0 + 4, hz1 - 5):
        fill(g, head & (x == hx0) & (z == zz) & (y >= hy0 + 10) & (y < hy1 - 9), C("iron", 3))
    # Rear hatch status lights and cooling slots.
    for yy in (hy0 + 12, hy0 + 15, hy0 + 18):
        fill(g, head & (x == hx0) & (y == yy) & (z >= hz0 + 9) & (z < hz0 + 14), C("iron", 2))
    fill(g, head & (x == hx0) & (y >= hy0 + 11) & (y < hy0 + 14) & (z >= hz1 - 13) & (z < hz1 - 10), C("cyan", 6))
    fill(g, head & (x == hx0) & (y >= hy0 + 15) & (y < hy0 + 18) & (z >= hz1 - 13) & (z < hz1 - 10), C("orange", 5))

    # A raised, copper crown beacon breaks the cube silhouette.
    g.box(17, hy1, 34, 25, hy1 + 2, 42, C("rust", 4))
    g.box(18, hy1 + 2, 35, 24, hy1 + 4, 41, C("steel", 5))
    g.box(19, hy1 + 4, 36, 23, hy1 + 5, 40, C("cyan", 6))
    g.box(20, hy1 + 4, 37, 22, hy1 + 5, 39, C("cyan", 7))

    # Oversized side comm pods give the helmet a stronger silhouette.
    for z0, z1, sensor_z in ((hz0 - 3, hz0, hz0 - 2), (hz1, hz1 + 3, hz1 + 1)):
        g.box(15, 42, z0, 25, 52, z1, C("iron", 2))
        g.box(16, 43, z0, 25, 51, z1, C("rust", 4))
        g.box(17, 44, z0 + 1, 23, 50, z1 - 1, C("steel", 4))
        for side in (z0, z1 - 1):
            g.box(18, 44, side, 24, 50, side + 1, C("steel", 3))
            g.box(19, 45, side, 23, 49, side + 1, C("iron", 1))
            g.box(20, 46, side, 22, 49, side + 1, C("cyan", 5))
            g.box(20, 47, side, 21, 48, side + 1, C("cyan", 7))
            g.set(23, 45, side, C("orange", 6))
        g.box(24, 45, sensor_z, 25, 49, sensor_z + 1, C("cyan", 6))
        g.set(24, 47, sensor_z, C("cyan", 7))
        g.box(20, 51, sensor_z, 21, 57, sensor_z + 1, C("steel", 5))
        g.box(20, 56, sensor_z, 21, 58, sensor_z + 1, C("orange", 5))

    # The visor has a copper bezel, a dark glass field, and bright pixel eyes.
    g.box(28, 39, 28, 29, 53, 48, C("rust", 4))
    g.box(28, 40, 29, 29, 52, 47, C("iron", 1))
    for z0, z1 in ((32, 35), (41, 44)):
        g.box(28, 46, z0, 29, 48, z1, C("cyan", 6))
        g.set(28, 47, z0 + 1, C("cyan", 7))
    # Speaker grille: short, framed bars with one hazard-orange status pixel.
    g.box(28, 41, 36, 29, 44, 37, C("steel", 4))
    g.box(28, 41, 39, 29, 44, 40, C("steel", 4))
    g.box(28, 41, 42, 29, 44, 43, C("steel", 4))
    g.set(28, 42, 39, C("orange", 5))

    # Chest armor has a framed reactor instead of repeating tile seams.
    fill(g, torso & ((y == 17) | (y == 18)), C("iron", 2))
    fill(g, torso & (x >= 24) & (y >= 23) & (y < 34), C("steel", 3))
    fill(g, torso & (x >= 25) & (y >= 24) & (y < 33), C("bone", 6))
    fill(g, torso & (x >= 25) & (y == 24) & (z >= 34) & (z < 43), C("rust", 5))
    fill(g, torso & (x >= 25) & (y == 32) & (z >= 34) & (z < 43), C("rust", 5))
    g.box(24, 26, 34, 25, 31, 42, C("rust", 4))
    g.box(25, 27, 35, 26, 30, 41, C("iron", 1))
    g.box(26, 28, 36, 27, 30, 40, C("cyan", 5))
    g.box(27, 28, 37, 28, 30, 39, C("cyan", 7))
    g.set(27, 30, 40, C("orange", 6))

    # A compact service pack gives the android a clear rear silhouette.
    # It overlaps the torso shell so every outside voxel connects to the body.
    g.box(9, 20, 31, 16, 34, 45, C("steel", 4))
    g.box(9, 20, 31, 11, 34, 33, C("iron", 2))
    g.box(9, 20, 43, 11, 34, 45, C("iron", 2))
    g.box(10, 33, 32, 15, 35, 44, C("rust", 4))
    g.box(8, 25, 35, 9, 30, 41, C("rust", 4))
    g.box(7, 26, 36, 8, 29, 40, C("iron", 1))
    g.box(6, 27, 37, 7, 29, 39, C("cyan", 6))
    g.box(6, 28, 38, 7, 29, 39, C("cyan", 7))
    for zz in (34, 41):
        g.box(8, 21, zz, 9, 24, zz + 2, C("iron", 1))
        g.box(7, 21, zz, 8, 23, zz + 2, C("orange", 5))
    # Fine rear pack rails and a centered service stripe.
    g.box(8, 22, 32, 9, 33, 33, C("rust", 5))
    g.box(8, 22, 43, 9, 33, 44, C("rust", 5))
    g.box(8, 24, 37, 9, 25, 39, C("bone", 6))
    # Small copper shoulder caps and restrained hazard markers.
    for z0, z1 in ((23, 29), (47, 53)):
        g.box(17, 32, z0, 24, 35, z1, C("steel", 4))
        g.box(18, 34, z0 + 1, 23, 36, z1 - 1, C("bone", 6))
        g.box(18, 33, z0 + 1, 23, 34, z1 - 1, C("rust", 5))

    # Dense rings stay at elbows and wrists. The other limb surfaces stay calm.
    for zz in (22, 28, 47, 54):
        g.box(16, 29, zz, 24, 35, zz + 1, C("iron", 2))
    for zz in (28, 47):
        g.box(16, 30, zz, 24, 31, zz + 1, C("orange", 5))

    # Separate knee guards, tapered color blocks, and individual boots.
    fill(g, legs & (y >= 9) & (y < 13) & (x >= 23), C("steel", 4))
    fill(g, legs & (y >= 10) & (y < 12) & (x >= 24), C("bone", 6))
    fill(g, legs & (y == 8), C("rust", 4))
    fill(g, legs & (y >= 6) & (y < 8), C("iron", 2))
    boots(g, C("steel", 4), C("rust", 5), C("iron", 1), height=7, pad=0)
    feet = shell(["Foot.L", "Foot.R"], 1)
    fill(g, feet & (y >= 2) & (y < 5), C("steel", 5))
    fill(g, feet & (x >= 25) & (y >= 2) & (y < 5), C("bone", 6))
    fill(g, feet & (y == 1), C("orange", 4))

    gloves(g, C("iron", 3), cuff=C("rust", 4), grow=1)
    # Sparse hull glints add material variation without covering the plates.
    speck_rig(g, 202, 0.025, ramps=("steel", "bone"))
    return asset("characters-skins", "android", "Android", Part("skin space-android", g, pivot=PIVOT))
