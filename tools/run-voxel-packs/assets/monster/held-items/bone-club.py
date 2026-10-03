"""Ogre bone club: a massive femur with a knobbed end studded with iron
nails and a strip of hide bound around the grip.
Held-item frame: +X forward (knob), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(32, 12, 12)
    c = 6
    g.line((1, c, c), (26, c, c), 1.6, C("bone", 5))
    g.ellipsoid(2, c, c - 1.5, 2.4, 2.2, 2.4, C("bone", 4)).ellipsoid(2, c, c + 1.5, 2.2, 2, 2.2, C("bone", 4))
    g.ellipsoid(27, c + 1, c - 1.5, 4.5, 4, 3.5, C("bone", 6)).ellipsoid(27, c - 1, c + 1.5, 4, 3.5, 3.5, C("bone", 6))
    for x, y, z in ((29, c + 4, c), (26, c - 4, c - 1), (30, c, c + 4), (25, c + 1, c - 5), (31, c - 3, c + 2)):
        g.box(x, y, z, x + 1, y + 1, z + 1, C("iron", 4))  # nails
    g.box(4, c - 2, c - 2, 12, c + 2, c + 2, C("skindark", 3))  # hide wrap
    for x in range(4, 12, 3):
        g.box(x, c - 2, c - 2, x + 1, c + 2, c + 2, C("skindark", 2))
    speck(g, 409, 0.12)
    return held("bone-club", "Bone Club", g, (8, c, c), {"socket-head": (28, c, c)},
                pfx=[pfx("rvx-monster-blood-splat", "socket-head", "manual", size=0.3)])
