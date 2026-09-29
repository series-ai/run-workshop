"""Silver hunter's axe: a long iron-shod haft with a crescent silver bit
etched with a cross, a back spike and a wolf-fur tassel.
Held-item frame: +X forward (head), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck, xyz


def build():
    g = Grid(40, 22, 5)
    cy, cz = 8, 2
    g.box(0, cy, 1, 36, cy + 2, 4, C("darkwood", 3))  # haft
    g.box(0, cy - 1, 0, 3, cy + 3, 5, C("iron", 3))  # pommel
    for x in range(4, 14, 2):
        g.box(x, cy, 1, x + 1, cy + 2, 4, C("rust", 3))  # grip wrap
    g.box(26, cy - 1, 1, 36, cy + 3, 4, C("iron", 3))  # head socket
    x, y, z = xyz(g)
    blade = (((x + 0.5 - 22) ** 2) / 100 + ((y + 0.5 - (cy + 1)) ** 2) / 110 <= 1) & (x >= 26) & (y >= cy + 2) & (z >= 1) & (z < 4)
    g.where(blade, C("steel", 6))
    g.where(blade & (((x + 0.5 - 22) ** 2) / 100 + ((y + 0.5 - (cy + 1)) ** 2) / 110 > 0.75), C("steel", 7))  # honed edge
    g.box(30, cy + 5, 1, 32, cy + 9, 2, C("steel", 4)).box(29, cy + 6, 1, 33, cy + 7, 2, C("steel", 4))  # etched cross
    g.line((31, cy, 2.5), (35, cy - 6, 2.5), 0.8, C("steel", 5))  # back spike
    g.box(36, cy, 1, 38, cy + 2, 4, C("steel", 6))
    g.line((25, cy, 2.5), (22, cy - 5, 2.5), 0.6, C("sand", 3))  # tassel cord
    g.box(20, cy - 8, 1, 23, cy - 4, 4, C("stone", 4))  # wolf fur
    speck(g, 402, 0.12)
    return held("silver-axe", "Silver Axe", g, (9, cy + 1, 2.5), {"socket-blade": (34, cy + 10, 2.5)},
                pfx=[pfx("rvx-monster-silver-slash", None, "manual", size=0.217, aim=(-1.0, 0.0, 0.0), offset=(-0.072, 0.03, 0.0))])
