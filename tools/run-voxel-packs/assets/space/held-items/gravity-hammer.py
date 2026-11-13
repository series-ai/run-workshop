"""Gravity hammer: a long-hafted war hammer with a massive steel head, a
glowing violet graviton core in each face, a spike and a banded grip.
Held-item frame: head along +X."""
from _kit import C, Grid, cbox, held, light


def build():
    g = Grid(46, 16, 12)
    cy, cz = 8, 6
    g.box(0, cy - 1, cz - 1, 34, cy + 1, cz + 1, C("iron", 3))  # haft
    for xx in range(2, 14, 3):
        g.box(xx, cy - 1, cz - 1, xx + 1, cy + 1, cz + 1, C("red", 4))
    g.box(0, cy - 2, cz - 2, 2, cy + 2, cz + 2, C("steel", 5))
    cbox(g, 32, 1, 1, 44, 15, 11, C("steel", 4), r=2)  # head
    g.box(32, 6, 0, 44, 10, 12, C("steel", 3))
    for zz in (0, 11):
        g.box(35, 5, zz, 41, 11, zz + 1, C("arcane", 5))
        g.box(37, 7, zz, 39, 9, zz + 1, C("arcane", 7))
    g.box(44, cy - 1, cz - 1, 46, cy + 1, cz + 1, C("steel", 6))  # spike
    g.box(34, 0, 4, 42, 1, 8, C("gold", 5))
    g.box(34, 15, 4, 42, 16, 8, C("gold", 5))
    light(g)
    return held("gravity-hammer", "Gravity Hammer", g, grip=(6, cy, cz), sockets={"socket-head": (44, cy, cz)},
                pfx=[{"effectId": "rvx-space-gravity-slam", "socket": "socket-head", "trigger": "manual", "size": 0.6}])
