"""Assassin's dagger: a wavy kris blade of dark steel with a poison
groove, a bone grip and a curled guard. Blade along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(24, 9, 3)
    cy, cz = 4, 1
    g.box(0, cy - 1, cz, 7, cy + 1, cz + 1, C("bone", 5))
    for x in (1, 3, 5):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 2, C("bone", 3))
    g.box(7, cy - 3, cz - 1, 8, cy + 3, cz + 2, C("iron", 5))
    g.set(8, cy - 3, cz, C("iron", 5)).set(8, cy + 2, cz, C("iron", 5))
    for x in range(8, 22):
        off = [0, 1, 1, 0, -1, -1][(x - 8) % 6] if x < 19 else 0
        w = 1 if x < 20 else 0
        g.box(x, cy - w + off, cz, x + 1, cy + w + 1 + off, cz + 1, C("steel", 3))
        g.set(x, cy + off, cz, C("toxic", 4) if x < 18 else C("steel", 5))
    g.set(22, cy, cz, C("steel", 5))
    return held("dagger", "Assassin's Dagger", g, (3.5, cy, cz + 0.5), {"socket-tip": (22, cy, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.146, "aim": [-1.0, 0.0, 0.0], "offset": [-0.049, 0.03, 0.0]}])
