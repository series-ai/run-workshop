"""Grimoire: a thick leather spellbook with gold corner caps, a clasp
strap and a glowing arcane sigil, held by its spine. Along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(20, 16, 6)
    g.box(0, 0, 0, 20, 16, 6, C("purple", 3))
    g.box(1, 1, 1, 20, 15, 5, C("bone", 6))  # pages
    for y in range(2, 15, 2):
        g.box(19, y, 1, 20, y + 1, 5, C("bone", 4))
    g.box(0, 0, 0, 2, 16, 6, C("purple", 2))  # spine
    for y in (2, 7, 12):
        g.box(0, y, 0, 1, y + 2, 6, C("gold", 5))
    for x, y in ((17, 0), (17, 13)):
        g.box(x, y, 0, 20, y + 3, 6, C("gold", 5))
    g.box(15, 6, 0, 20, 10, 6, C("rust", 3))  # clasp
    g.box(19, 7, 0, 21, 9, 6, C("gold", 6))
    for dx, dy in ((0, 0), (1, 1), (-1, 1), (0, 2), (1, -1), (-1, -1), (0, -2), (2, 0), (-2, 0)):  # sigils front+back
        g.set(9 + dx, 8 + dy, 0, C("arcane", 6)).set(9 + dx, 8 + dy, 5, C("arcane", 6))
    g.set(9, 8, 0, C("arcane", 7)).set(9, 8, 5, C("arcane", 7))
    return held("spellbook", "Grimoire", g, (3, 8, 3), {"socket-sigil": (9, 8, 0)},
                [{"effectId": "rvx-fantasy-arcane-bolt", "socket": "socket-sigil", "trigger": "manual", "size": 0.32}])
