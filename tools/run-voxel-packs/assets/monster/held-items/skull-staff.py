"""Necromancer's skull staff: a twisted dark staff bound with iron rings,
topped by a horned skull whose jaws clamp a glowing violet soul crystal.
Held-item frame: +X forward (skull), origin = Hand.R joint."""
import math

from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(58, 14, 12)
    cy, cz = 6, 5
    for x in range(0, 46):
        o = math.sin(x * 0.4) * 0.6
        g.box(x, cy + o, cz, x + 2, cy + o + 2, cz + 2, C("darkwood", 2 if (x // 3) % 2 else 3))
    for x in (4, 20, 40):
        g.box(x, cy - 1, cz - 1, x + 2, cy + 3, cz + 3, C("iron", 3))
    g.box(46, cy - 2, cz - 2, 55, cy + 4, cz + 4, C("bone", 6))  # skull (facing +x)
    g.box(55, cy - 1, cz - 1, 56, cy + 3, cz + 3, C("bone", 5))
    g.box(53, cy + 1, cz - 2, 56, cy + 3, cz - 1, C("arcane", 6)).box(53, cy + 1, cz + 3, 56, cy + 3, cz + 4, C("arcane", 6))  # eyes
    g.box(50, cy - 2, cz - 2, 56, cy - 1, cz + 4, C("bone", 4))  # jaw line
    for s in (-1, 1):  # horns
        g.line((49, cy + 4, cz + 1 + s * 2), (46, cy + 8, cz + 1 + s * 5), 0.8, C("bone", 3))
        g.line((46, cy + 8, cz + 1 + s * 5), (48, cy + 11, cz + 1 + s * 6), 0.5, C("iron", 2))
    g.sphere(57, cy + 0.5, cz + 1, 1.8, C("arcane", 5))
    g.set(57, cy + 1, cz + 1, C("arcane", 7))
    speck(g, 413, 0.1)
    return held("skull-staff", "Skull Staff", g, (14, cy + 1, cz + 1), {"socket-tip": (57, cy + 0.5, cz + 1)},
                pfx=[pfx("rvx-monster-soul-burst", "socket-tip", "manual", size=0.4)])
