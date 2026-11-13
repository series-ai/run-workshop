"""Garlic mace: an iron flanged mace head crowned with bulbs of garlic
tied on with twine, on a studded oak haft.
Held-item frame: +X forward (head), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(34, 14, 14)
    c = 7
    g.box(0, c - 1, c - 1, 22, c + 1, c + 1, C("darkwood", 3))
    g.box(0, c - 2, c - 2, 2, c + 2, c + 2, C("iron", 4))
    for x in range(4, 12, 2):
        g.box(x, c - 1, c - 1, x + 1, c + 1, c + 1, C("sand", 3))  # twine grip
    g.sphere(26, c, c, 4.5, C("iron", 3))  # head
    for dy, dz in ((5, 0), (-5, 0), (0, 5), (0, -5)):
        g.box(22, c + dy - (1 if dy < 0 else 0), c + dz - (1 if dz < 0 else 0), 31, c + dy + (1 if dy > 0 else 0), c + dz + (1 if dz > 0 else 0), C("iron", 4))  # flanges
    for bx, by, bz in ((27, c + 4, c + 3), (25, c - 4, c + 3), (29, c + 2, c - 4), (24, c + 3, c - 4), (31, c, c)):
        g.ellipsoid(bx, by, bz, 2, 2, 2, C("bone", 7))  # garlic bulbs
        g.set(bx, by + 2, bz, C("khaki", 5))
    g.box(21, c - 2, c - 2, 23, c + 2, c + 2, C("sand", 4))  # twine
    speck(g, 406, 0.1)
    return held("garlic-mace", "Garlic Mace", g, (7, c, c), {"socket-head": (27, c, c)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-head", "manual", size=0.36)])
