"""Knight's longsword: a fullered steel blade with a bevelled edge, a
gold crossguard with down-swept quillons and a ruby, a leather-wrapped
grip and a wheel pommel. Blade along +X (held-item frame)."""
from _kit import held
from voxgrid import C, Grid

L = 48


def build():
    g = Grid(L, 11, 3)
    cy, cz = 5, 1
    g.box(2, cy - 1, cz, 11, cy + 1, cz + 1, C("wood", 2))  # grip core
    for x in range(2, 11, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 2, C("rust", 3))  # leather wrap
    g.box(0, cy - 2, cz - 1, 2, cy + 2, cz + 2, C("gold", 4))  # pommel
    g.set(0, cy, cz - 1, C("red", 5)).set(0, cy - 1, cz - 1, C("red", 5))
    g.box(11, cy - 5, cz - 1, 13, cy + 5, cz + 2, C("gold", 5))  # crossguard
    g.box(10, cy - 5, cz - 1, 11, cy - 3, cz + 2, C("gold", 4)).box(10, cy + 3, cz - 1, 11, cy + 5, cz + 2, C("gold", 4))  # down-swept tips
    g.box(11, cy - 1, cz - 1, 13, cy + 1, cz + 2, C("red", 5))  # ruby
    g.box(13, cy - 2, cz, L - 3, cy + 2, cz + 1, C("steel", 5))  # blade
    g.box(13, cy - 2, cz, L - 3, cy - 1, cz + 1, C("steel", 6))  # edge (bevel)
    g.box(13, cy + 1, cz, L - 3, cy + 2, cz + 1, C("steel", 7))
    g.box(13, cy, cz, L - 12, cy + 1, cz + 1, C("steel", 3))  # fuller
    g.box(L - 3, cy - 1, cz, L - 1, cy + 1, cz + 1, C("steel", 6))
    g.set(L - 1, cy, cz, C("steel", 7))
    return held("longsword", "Knight's Longsword", g, (6.5, cy, cz + 0.5), {"socket-tip": (L - 1, cy, cz + 0.5), "socket-trail": (30, cy, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.311, "aim": [-1.0, 0.0, 0.0], "offset": [-0.104, 0.03, 0.0]}])
