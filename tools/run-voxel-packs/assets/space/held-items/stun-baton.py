"""Stun baton: a security baton with a rubber grip, a wrist guard, a
striped shaft and a crackling electric tip of plasma prongs.
Held-item frame: tip along +X."""
from _kit import C, Grid, held


def build():
    g = Grid(34, 7, 7)
    cy = cz = 3
    g.box(0, cy - 1, cz - 1, 10, cy + 2, cz + 2, C("iron", 2))
    for xx in range(1, 10, 2):
        g.box(xx, cy - 1, cz - 1, xx + 1, cy + 2, cz + 2, C("iron", 3))
    g.box(10, 1, 1, 12, 6, 6, C("gold", 4))  # guard
    g.box(12, cy - 1, cz - 1, 28, cy + 2, cz + 2, C("steel", 5))
    for xx in range(14, 28, 4):
        g.box(xx, cy - 1, cz - 1, xx + 2, cy + 2, cz + 2, C("gold", 5))
    g.box(28, cy - 1, cz - 1, 30, cy + 2, cz + 2, C("steel", 3))
    for dy, dz in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        g.line((29, cy + 0.5, cz + 0.5), (33, cy + 0.5 + dy, cz + 0.5 + dz), 0.5, C("plasma", 6))
    g.set(33, cy, cz, C("plasma", 7))
    return held("stun-baton", "Stun Baton", g, grip=(5, cy + 0.5, cz + 0.5), sockets={"socket-tip": (33, cy + 0.5, cz + 0.5)},
                pfx=[{"effectId": "rvx-space-stun-arc", "socket": "socket-tip", "trigger": "manual", "size": 0.3}])
