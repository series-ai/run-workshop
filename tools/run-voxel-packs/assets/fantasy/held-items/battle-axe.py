"""Dwarven battle axe: an ash haft with iron bands and a leather grip,
a broad crescent bit with a bright bevelled edge, a back spike and runes
etched in the cheek. Head along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    L = 44
    g = Grid(L, 24, 3)
    cy, cz = 8, 1
    g.box(0, cy - 1, cz - 1, 40, cy + 1, cz + 2, C("wood", 4))  # haft
    for x in range(3, 11, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 2, C("rust", 2))
    for x in (0, 18, 30):
        g.box(x, cy - 1, cz - 1, x + 2, cy + 1, cz + 2, C("iron", 5))
    g.box(40, cy - 1, cz - 1, 44, cy + 1, cz + 2, C("iron", 4))  # top spike
    # crescent bit toward +y (the edge faces the knuckles)
    for x in range(30, 42):
        t = (x - 30) / 11
        top = cy + 5 + int(9 * (1 - (2 * t - 1) ** 2))
        g.box(x, cy + 1, cz, x + 1, top, cz + 1, C("steel", 4))
        g.box(x, top - 2, cz, x + 1, top, cz + 1, C("steel", 6))
        g.set(x, top - 1, cz, C("steel", 7))
    g.box(33, cy + 4, cz - 1, 39, cy + 5, cz + 2, C("iron", 3))  # collar
    for x, y in ((34, cy + 8), (36, cy + 9), (37, cy + 7), (35, cy + 11)):  # runes
        g.set(x, y, cz - 1, C("ember", 5)).set(x, y, cz + 1, C("ember", 5))
    for k in range(4):  # back spike toward -y
        g.box(33 + k, cy - 2 - k, cz, 38 - k, cy - 1 - k, cz + 1, C("steel", 5))
    return held("battle-axe", "Dwarven Battle Axe", g, (6.5, cy, cz + 0.5), {"socket-edge": (36, cy + 13, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.281, "aim": [-1.0, 0.0, 0.0], "offset": [-0.094, 0.03, 0.045]}])
