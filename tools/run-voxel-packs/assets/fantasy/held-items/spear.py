"""Elven glaive-spear: a long ash shaft with a leaf-shaped steel head,
a gold collar with a streaming green pennon, and a butt cap. Head along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    L = 60
    g = Grid(L, 9, 5)
    cy, cz = 4, 2
    g.box(0, cy, cz, 47, cy + 1, cz + 1, C("wood", 4))
    g.box(0, cy - 1, cz - 1, 2, cy + 2, cz + 2, C("gold", 4))
    g.box(14, cy - 1, cz - 1, 22, cy + 2, cz + 2, C("forest", 3))  # grip wrap
    g.box(45, cy - 1, cz - 1, 48, cy + 2, cz + 2, C("gold", 5))
    for x in range(48, L):  # leaf blade
        t = (x - 48) / (L - 48)
        w = int(3.2 * (1 - abs(2 * t - 0.8) ** 1.4)) if t < 1 else 0
        g.box(x, cy - w, cz, x + 1, cy + w + 1, cz + 1, C("steel", 5))
        g.set(x, cy, cz, C("steel", 7))
    for k in range(9):  # pennon trailing back
        g.box(44 - k, cy + 1 + (k % 3 == 0), cz, 45 - k, cy + 4 - k // 4, cz + 1, C("leaf", 4 + (k % 2)))
    return held("spear", "Elven Spear", g, (18.5, cy + 0.5, cz + 0.5), {"socket-tip": (L - 1, cy + 0.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.311, "aim": [-1.0, 0.0, 0.0], "offset": [-0.104, 0.03, 0.0]}])
