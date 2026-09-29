"""Silver-shot blunderbuss: a flared brass bell barrel on a walnut stock
with a flintlock, engraved silver side plate and a powder horn charm.
Held-item frame: +X forward (muzzle), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(40, 14, 9)
    cy, cz = 7, 4
    g.box(0, cy - 4, cz - 1, 10, cy + 1, cz + 2, C("darkwood", 3))  # stock
    g.box(0, cy - 5, cz - 1, 3, cy + 1, cz + 2, C("darkwood", 2))
    g.box(10, cy - 1, cz - 1, 22, cy + 1, cz + 2, C("darkwood", 4))
    g.cylinder("x", cy + 1, cz + 0.5, 1.6, 12, 32, C("gold", 3))  # barrel
    for k in range(8):  # bell
        g.cylinder("x", cy + 1, cz + 0.5, 1.8 + k * 0.4, 32 + k, 33 + k, C("gold", 4))
    g.cylinder("x", cy + 1, cz + 0.5, 1.5 + 7 * 0.35, 38, 40, 0)
    g.cylinder("x", cy + 1, cz + 0.5, 1.4, 12, 40, 0)
    g.cylinder("x", cy + 1, cz + 0.5, 1.6, 12, 13, C("gold", 3))
    for bx in (16, 24, 30):
        g.cylinder("x", cy + 1, cz + 0.5, 2.0, bx, bx + 1, C("gold", 5))
    g.box(9, cy + 1, cz - 1, 12, cy + 4, cz, C("iron", 4))  # flintlock
    g.box(8, cy + 3, cz - 1, 9, cy + 5, cz, C("iron", 3))
    g.box(4, cy - 3, cz - 1, 9, cy, cz - 0, C("steel", 6))  # silver side plate
    g.box(6, cy - 7, cz, 8, cy - 5, cz + 1, C("bone", 5))  # powder horn charm
    g.set(7, cy - 5, cz, C("sand", 4))
    speck(g, 416, 0.08)
    return held("silver-blunderbuss", "Silver Blunderbuss", g, (6, cy - 2, cz + 0.5), {"socket-muzzle": (40, cy + 1, cz + 0.5)},
                pfx=[pfx("rvx-monster-blunderbuss-blast", "socket-muzzle", "manual", size=0.3, aim=(1.0, 0.0, 0.0))])
