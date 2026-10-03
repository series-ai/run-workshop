"""Vampire hunter's stake: a whittled ash stake with a leather-wrapped
grip, a silver ferrule engraved with a cross and a fire-hardened point.
Held-item frame: +X forward (point), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(28, 5, 5)
    cy = cz = 2
    g.box(0, 1, 1, 18, 4, 4, C("wood", 4))
    g.box(0, 1, 1, 2, 4, 4, C("wood", 3))  # butt
    g.box(2, 1, 1, 9, 4, 4, C("rust", 2))  # leather wrap
    for x in range(2, 9, 2):
        g.box(x, 1, 1, x + 1, 4, 4, C("rust", 3))
    g.box(9, 0, 0, 11, 5, 5, C("steel", 6))  # silver ferrule
    g.set(10, 2, 0, C("steel", 7)).set(10, 3, 0, C("steel", 7)).set(10, 2, 4, C("steel", 7))
    for k in range(10):  # taper
        w = 1.5 - k * 0.14
        g.box(18 + k, cy - w + 0.5, cz - w + 0.5, 19 + k, cy + w + 0.5, cz + w + 0.5, C("wood", 5 if k < 6 else 2))
    g.set(27, 2, 2, C("darkwood", 1))
    speck(g, 401, 0.15)
    return held("wooden-stake", "Wooden Stake", g, (5, 2.5, 2.5), {"socket-tip": (27.5, 2.5, 2.5)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-tip", "manual", size=0.3)])
