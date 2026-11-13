"""Runic greatsword: a two-handed claymore with a long grip, a wide
ringed crossguard, and a broad blade inlaid with glowing blue runes.
Blade along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    L = 60
    g = Grid(L, 17, 3)
    cy, cz = 8, 1
    g.box(0, cy - 1, cz - 1, 3, cy + 2, cz + 2, C("steel", 4))  # pommel
    g.box(3, cy, cz, 16, cy + 1, cz + 1, C("darkwood", 2))
    for x in range(3, 16, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 2, cz + 2, C("navy", 3))
    g.box(16, cy - 8, cz - 1, 18, cy + 9, cz + 2, C("steel", 5))  # crossguard
    for y in (cy - 8, cy + 7):
        g.box(15, y, cz - 1, 19, y + 2, cz + 2, C("steel", 6))
    g.box(15, cy - 1, cz - 1, 19, cy + 2, cz + 2, C("plasma", 5))
    g.box(18, cy - 3, cz, L - 4, cy + 4, cz + 1, C("steel", 5))
    g.box(18, cy - 3, cz, L - 4, cy - 2, cz + 1, C("steel", 7))
    g.box(18, cy + 3, cz, L - 4, cy + 4, cz + 1, C("steel", 7))
    for k in range(4):
        g.box(L - 4 + k, cy - 2 + k // 2 + (k > 1), cz, L - 3 + k, cy + 3 - k // 2 - (k > 1), cz + 1, C("steel", 6))
    for x in range(21, L - 8, 4):  # runes
        g.set(x, cy, cz, C("plasma", 6)).set(x + 1, cy + 1, cz, C("plasma", 6)).set(x + 1, cy - 1, cz, C("plasma", 5))
    return held("greatsword", "Runic Greatsword", g, (6.5, cy + 0.5, cz + 0.5), {"socket-tip": (L - 1, cy + 0.5, cz + 0.5), "socket-trail": (40, cy + 0.5, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.401, "aim": [-1.0, 0.0, 0.0], "offset": [-0.134, 0.03, 0.0]}])
