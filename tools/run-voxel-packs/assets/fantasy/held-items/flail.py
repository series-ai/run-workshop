"""Morning-star flail: a banded handle, a short chain and a spiked iron
ball hanging from it. Along +X."""
import math

from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(40, 16, 15)
    cy, cz = 11, 7
    g.box(0, cy - 1, cz - 1, 16, cy + 1, cz + 1, C("wood", 3))
    for x in (0, 7, 14):
        g.box(x, cy - 1, cz - 1, x + 2, cy + 1, cz + 1, C("iron", 5))
    g.box(16, cy - 1, cz - 1, 18, cy + 1, cz + 1, C("iron", 4))
    for k in range(8):  # chain links drooping
        x = 18 + k * 1.6
        y = cy - k * 0.6
        g.box(x, y - (k % 2), cz - (1 - k % 2), x + 2, y + 1, cz + 1 - (1 - k % 2) + (1 - k % 2), C("steel", 5))
    bx, by = 33, cy - 7
    g.sphere(bx, by, cz, 3.8, C("iron", 3))
    for a in range(6):
        for b in range(3):
            th, ph = a * math.pi / 3 + b * 0.5, (b - 1) * 0.9
            dx, dy, dz = math.cos(th) * math.cos(ph), math.sin(ph), math.sin(th) * math.cos(ph)
            g.line((bx + dx * 3, by + dy * 3, cz + dz * 3), (bx + dx * 6, by + dy * 6, cz + dz * 6), 0.5, C("steel", 6))
    return held("flail", "Morning-Star Flail", g, (6.5, cy, cz), {"socket-ball": (bx, by, cz)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-ball", "trigger": "manual", "size": 0.3}])
