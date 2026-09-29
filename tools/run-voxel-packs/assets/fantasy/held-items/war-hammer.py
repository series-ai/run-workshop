"""Paladin's war hammer: a steel-bound shaft with a gold-wrapped grip and
a massive square head with a sunburst face and a holy glow; a spike
crowns the top. Head along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    L = 42
    g = Grid(L, 16, 11)
    cy, cz = 8, 5
    g.box(0, cy - 1, cz - 1, 32, cy + 1, cz + 1, C("darkwood", 3))
    g.box(2, cy - 1, cz - 1, 12, cy + 1, cz + 1, C("gold", 4))
    for x in range(2, 12, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 1, C("gold", 3))
    g.box(0, cy - 2, cz - 2, 2, cy + 2, cz + 2, C("steel", 6))
    for x in (14, 22):
        g.box(x, cy - 1, cz - 2, x + 1, cy + 1, cz + 2, C("steel", 6))
    g.box(30, cy - 8, cz - 5, 40, cy + 8, cz + 5, C("steel", 4))  # head (long across y)
    g.box(30, cy - 8, cz - 5, 40, cy - 7, cz + 5, C("steel", 6))
    g.box(30, cy + 7, cz - 5, 40, cy + 8, cz + 5, C("steel", 6))
    g.box(31, cy - 3, cz - 5, 39, cy + 3, cz - 4, C("gold", 5))  # band
    g.box(31, cy - 3, cz + 4, 39, cy + 3, cz + 5, C("gold", 5))
    for dx, dy in ((0, 0), (1, 1), (-1, 1), (1, -1), (-1, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):  # sunburst on both striking faces
        g.set(35 + dx, cy + 8, cz + dy, C("gold", 7))
        g.set(35 + dx, cy - 9, cz + dy, C("gold", 7))
    g.box(40, cy - 1, cz - 1, 42, cy + 1, cz + 1, C("steel", 6))  # top spike
    return held("war-hammer", "Paladin's War Hammer", g, (6.5, cy, cz), {"socket-head": (35, cy + 9, cz)},
                [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-head", "trigger": "manual", "size": 0.36}])
