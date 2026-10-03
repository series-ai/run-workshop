"""Grey alien skin: a classic grey visitor with a tall bulbous cranium,
huge glossy black almond eyes, a tiny mouth, long thin fingers, and a
silver jumpsuit with a purple collar, glowing belt buckle and chest
insignia."""
from _rig import C, HEAD, PIVOT, Part, base_body, boots, dilate, face, fill, head_box, region, rig_grid, rxyz, shell, speck_rig
from _kit import asset


def build():
    g = rig_grid()
    x, y, z = rxyz()
    (hx0, hy0, hz0), (hx1, hy1, hz1) = head_box()
    base_body(g, C("gray", 5), C("steel", 6), sleeve=C("steel", 5), legs=C("steel", 5))
    # cranium dome above and behind the PN head
    g.ellipsoid(19.5, hy1 - 2, 38, 8.5, 7.5, 11.5, C("gray", 5))
    g.ellipsoid(17, hy1 - 4, 38, 7, 6, 10, C("gray", 5))
    fill(g, region(HEAD), C("gray", 5))
    fill(g, (g.a == C("gray", 5)) & (y > hy1 + 3) & (((x + z) % 9 == 0) | ((x - z) % 11 == 0)), C("gray", 4))  # veins
    # huge slanted almond eyes (outer corners high)
    rows = {44: (35, 36), 45: (33, 36), 46: (32, 36), 47: (31, 36), 48: (30, 36), 49: (29, 35), 50: (29, 33)}
    for yy, (z0, z1) in rows.items():
        g.box(28, yy, z0, 29, yy + 1, z1, C("iron", 0))
        g.box(28, yy, 76 - z1, 29, yy + 1, 76 - z0, C("iron", 0))
    g.set(28, 48, 32, C("gray", 7)).set(28, 48, 41, C("gray", 7))
    g.set(28, 47, 33, C("purple", 3)).set(28, 47, 42, C("purple", 3))
    g.box(28, 41, 37, 29, 42, 39, C("gray", 3))  # tiny mouth
    g.box(28, 44, 38, 29, 45, 39, C("gray", 4))  # nostril hint
    # collar + chest insignia + belt
    col = shell(["Chest"], 1) & (y >= 33) & (y < 36)
    fill(g, col, C("purple", 4))
    g.box(24, 27, 36, 25, 31, 40, C("purple", 5))
    g.box(24, 28, 37, 25, 30, 39, C("toxic", 7))
    fill(g, shell(["Body"], 1) & (y == 17), C("iron", 2))
    g.box(24, 16, 37, 25, 19, 39, C("toxic", 6))
    # long fingers
    for zz, sgn in ((9, -1), (66, 1)):
        for yy in (29, 31, 33):
            g.box(17, yy, zz + sgn * 1, 23, yy + 1, zz + sgn * 1 + 1, C("gray", 4))
    boots(g, C("steel", 3), C("purple", 4), C("iron", 2), height=6)
    speck_rig(g, 201, 0.05, ramps=("gray",))
    return asset("characters-skins", "grey-alien", "Grey Alien", Part("skin space-grey-alien", g, pivot=PIVOT))
