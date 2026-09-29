"""Flanged mace: an iron haft with a knotted grip and a spherical head of
eight flanges around a gold boss. Head along +X."""
import math

from _kit import held
from voxgrid import C, Grid


def build():
    L = 36
    g = Grid(L, 15, 15)
    cy = cz = 7
    g.box(0, cy - 1, cz - 1, 26, cy + 1, cz + 1, C("iron", 5))
    g.box(2, cy - 1, cz - 1, 11, cy + 1, cz + 1, C("rust", 3))
    for x in range(2, 11, 3):
        g.box(x, cy - 1, cz - 2, x + 1, cy + 2, cz + 2, C("rust", 2))
    g.box(0, cy - 2, cz - 2, 2, cy + 2, cz + 2, C("iron", 4))
    g.box(24, cy - 2, cz - 2, 26, cy + 2, cz + 2, C("gold", 4))
    g.sphere(30, cy + 0.5, cz + 0.5, 3.5, C("iron", 4))
    for a in range(8):
        th = a * math.pi / 4
        for k in range(3, 7):
            g.box(26, cy + 0.5 + k * math.sin(th) - 0.5, cz + 0.5 + k * math.cos(th) - 0.5, 35 - (k == 6) * 2,
                  cy + 0.5 + k * math.sin(th) + 0.5, cz + 0.5 + k * math.cos(th) + 0.5, C("steel", 5 if k < 6 else 6))
    g.box(34, cy - 1, cz - 1, 36, cy + 2, cz + 2, C("gold", 5))
    return held("flanged-mace", "Flanged Mace", g, (6.5, cy, cz), {"socket-head": (31, cy + 0.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-head", "trigger": "manual", "size": 0.3}])
