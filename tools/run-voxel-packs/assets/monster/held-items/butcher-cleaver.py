"""Butcher's cleaver: a heavy rectangular blade with a hanging hole, a
bloody edge and a riveted bone handle.
Held-item frame: +X forward (blade), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(26, 14, 3)
    cy = 3
    g.box(0, cy - 1, 0, 10, cy + 2, 3, C("bone", 5))
    for x in (2, 6):
        g.set(x, cy, 0, C("steel", 6)).set(x, cy, 2, C("steel", 6))
    g.box(10, cy - 1, 1, 26, 14, 2, C("steel", 5))  # blade
    g.box(10, cy - 1, 1, 26, cy, 2, C("steel", 3))  # spine
    g.box(10, 12, 1, 26, 14, 2, C("steel", 7))  # edge
    g.box(12, 12, 1, 22, 14, 2, C("blood", 4))
    g.set(15, 13, 1, C("blood", 5)).set(18, 11, 1, C("blood", 3))
    g.box(22, cy + 1, 1, 24, cy + 3, 2, 0)  # hanging hole
    speck(g, 412, 0.1)
    return held("butcher-cleaver", "Butcher's Cleaver", g, (5, cy + 0.5, 1.5), {"socket-edge": (18, 13, 1.5)},
                pfx=[pfx("rvx-monster-blood-splat", "socket-edge", "manual", size=0.3)])
