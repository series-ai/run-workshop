"""Mob pitchfork: a rough-hewn pole with a rag tied below the head and
three rusty iron tines.
Held-item frame: +X forward (tines), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(52, 11, 5)
    cy, cz = 5, 2
    g.box(0, cy, cz - 1, 40, cy + 1, cz + 2, C("wood", 3))
    g.box(0, cy - 1, cz, 40, cy + 2, cz + 1, C("wood", 3))
    for x in range(0, 40, 6):
        g.box(x, cy - 1, cz, x + 1, cy + 2, cz + 1, C("wood", 2))
    g.box(34, cy - 2, cz - 1, 37, cy + 3, cz + 2, C("red", 3))  # rag
    g.box(35, cy - 4, cz, 36, cy - 2, cz + 1, C("red", 2))
    g.box(40, cy - 4, cz - 1, 42, cy + 5, cz + 2, C("rust", 3))  # crossbar
    for dy in (-4, 0, 4):
        g.box(42, cy + dy, cz, 50, cy + dy + 1, cz + 1, C("rust", 4))
        g.set(50, cy + dy, cz, C("iron", 5)).set(51, cy + dy, cz, C("iron", 5))
    speck(g, 415, 0.14)
    return held("pitchfork", "Mob Pitchfork", g, (12, cy + 0.5, cz + 0.5), {"socket-tines": (50, cy + 0.5, cz + 0.5)},
                pfx=[pfx("rvx-monster-blood-splat", "socket-tines", "manual", size=0.32)])
