"""Archmage staff: a gnarled darkwood shaft with silver bands and a leaf
wrap, crowned by twisting gold tines that cradle a glowing arcane crystal
with orbiting chips. Crystal end along +X."""
import math

from _kit import held
from voxgrid import C, Grid


def build():
    L = 58
    g = Grid(L, 13, 13)
    cy = cz = 6
    for x in range(0, 46):
        wob = 0.6 * math.sin(x / 3.2)
        g.box(x, cy - 1 + wob, cz - 1, x + 1, cy + 1 + wob, cz + 1, C("darkwood", 4 if (x // 3) % 2 else 3))
    for x in (4, 22, 40):
        g.box(x, cy - 2, cz - 2, x + 2, cy + 2, cz + 2, C("steel", 6))
    g.box(12, cy - 2, cz - 2, 18, cy + 2, cz + 2, C("leaf", 3))
    g.box(13, cy - 2, cz - 3, 14, cy + 1, cz - 2, C("leaf", 5))  # dangling leaf
    g.box(0, cy - 1, cz - 1, 2, cy + 1, cz + 1, C("gold", 5))  # ferrule
    for a in range(4):  # twisting tines
        th = a * math.pi / 2
        for k in range(10):
            ang = th + k * 0.18
            r = 1.2 + k * 0.28 if k < 7 else 3.2 - (k - 7) * 0.7
            g.set(44 + k, cy + r * math.sin(ang), cz + r * math.cos(ang), C("gold", 4 + (k % 2)))
    g.sphere(50, cy + 0.5, cz + 0.5, 2.8, C("arcane", 5))
    g.sphere(50, cy + 0.5, cz + 0.5, 1.5, C("arcane", 7))
    g.box(49, cy + 2, cz + 2, 50, cy + 3, cz + 3, C("arcane", 6))
    for (x, y, z) in ((54, cy + 4, cz), (47, cy - 4, cz + 3), (56, cy - 2, cz - 3)):
        g.set(x, y, z, C("arcane", 6))
    g.box(54, cy, cz, 57, cy + 1, cz + 1, C("arcane", 6))
    return held("mage-staff", "Archmage Staff", g, (15.5, cy, cz), {"socket-tip": (50, cy + 0.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-arcane-bolt", "socket": "socket-tip", "trigger": "manual", "size": 0.4}])
