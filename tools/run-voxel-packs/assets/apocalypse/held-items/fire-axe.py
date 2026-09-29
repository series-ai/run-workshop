"""Fire axe: a long yellow fibreglass handle with a black rubber grip, a
red-painted head with a honed silver edge on one side and a pick spike on
the other. The head sits at +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(46, 22, 4)
    cz = 1
    cy = 10
    g.box(0, cy, cz, 42, cy + 2, cz + 2, C("gold", 5))  # handle
    g.box(0, cy, cz, 12, cy + 2, cz + 2, C("iron", 1))  # grip
    for x in range(1, 12, 2):
        g.box(x, cy, cz, x + 1, cy + 2, cz + 2, C("iron", 2))
    g.box(0, cy - 1, cz, 2, cy + 3, cz + 2, C("iron", 1))
    # head at x 36..44
    g.box(36, cy - 2, cz - 1, 44, cy + 4, cz + 3, C("red", 4))
    for k in range(8):  # blade widening toward the edge (+y)
        g.box(37 - k // 3, cy + 4 + k, cz, 43 + k // 3, cy + 5 + k, cz + 2, C("red", 4))
    g.box(34, cy + 10, cz, 46, cy + 12, cz + 2, C("steel", 7))  # edge
    g.box(35, cy + 9, cz, 45, cy + 10, cz + 2, C("steel", 5))
    for k in range(7):  # pick spike (-y)
        g.box(39 + k // 4, cy - 2 - k, cz, 42 - k // 3, cy - 1 - k, cz + 2, C("red", 3))
    g.box(40, cy - 9, cz, 41, cy - 8, cz + 2, C("steel", 6))
    g.box(38, cy + 1, cz - 1, 41, cy + 3, cz, C("gray", 7))  # stencil
    return held_asset("fire-axe", "Fire Axe", g, grip=(6, cy + 1, cz + 1), sockets=[("socket-tip", (40, cy + 11, cz + 1)), ("socket-trail", (40, cy + 6, cz + 1))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.36}])
