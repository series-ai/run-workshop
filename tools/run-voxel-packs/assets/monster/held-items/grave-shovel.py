"""Gravedigger's shovel: a worn ash handle with a D-grip, iron straps and
a dented spade blade caked with grave dirt.
Held-item frame: +X forward (blade), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(46, 12, 5)
    cy, cz = 5, 2
    g.box(0, cy - 3, cz - 1, 1, cy + 4, cz + 2, C("wood", 3))  # D-grip
    g.box(0, cy - 3, cz - 1, 4, cy - 2, cz + 2, C("wood", 3))
    g.box(0, cy + 3, cz - 1, 4, cy + 4, cz + 2, C("wood", 3))
    g.box(3, cy, cz - 1, 34, cy + 1, cz + 2, C("wood", 4))  # handle
    g.box(3, cy - 1, cz, 34, cy + 2, cz + 1, C("wood", 4))
    g.box(30, cy - 1, cz - 1, 36, cy + 2, cz + 2, C("iron", 3))  # straps
    g.box(35, 0, 1, 45, 11, 4, C("iron", 4))  # blade
    g.box(43, 1, 1, 46, 10, 4, C("iron", 5))
    g.box(36, 1, 1, 42, 10, 2, C("skindark", 3))  # dirt
    g.set(44, 3, 1, 0).set(45, 7, 1, 0)  # dents
    speck(g, 411, 0.14)
    return held("grave-shovel", "Grave Shovel", g, (14, cy + 0.5, cz + 0.5), {"socket-blade": (44, cy + 0.5, cz + 0.5)},
                pfx=[pfx("rvx-monster-dirt-toss", "socket-blade", "manual", size=0.4)])
