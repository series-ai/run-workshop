"""Frost wand: a slender white-birch wand with a silver spiral and an
ice-crystal tip that trails frost. Tip along +X."""
import math

from _kit import held
from voxgrid import C, Grid


def build():
    L = 30
    g = Grid(L, 7, 7)
    cy = cz = 3
    g.box(0, cy, cz, 22, cy + 1, cz + 1, C("bone", 6))
    g.box(0, cy - 1, cz - 1, 9, cy + 2, cz + 2, C("bone", 5))  # handle
    g.box(0, cy - 1, cz - 1, 1, cy + 2, cz + 2, C("steel", 6))
    for x in range(9, 22):
        a = x * 0.9
        g.set(x, cy + round(math.sin(a)), cz + round(math.cos(a)), C("steel", 6))
    for k in range(7):  # crystal
        w = [1, 2, 2, 2, 1, 1, 0][k]
        g.box(22 + k, cy - w // 2 - (1 if w == 2 else 0) + 0, cz - (w > 0), 23 + k, cy + 1 + (w > 1), cz + 1 + (w > 1), C("sky", 5 + (k > 3)))
    g.set(28, cy, cz, C("bone", 7)).set(29, cy, cz, C("sky", 7))
    return held("frost-wand", "Frost Wand", g, (4.5, cy + 0.5, cz + 0.5), {"socket-tip": (28, cy + 0.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-frost-nova", "socket": "socket-tip", "trigger": "manual", "size": 0.4}])
