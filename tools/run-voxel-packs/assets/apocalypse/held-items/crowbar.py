"""Crowbar: a hexagonal steel bar in chipped red paint with a curled claw
hook at the working end and a flat chisel at the grip end, taped handle.
The hook points +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(44, 12, 4)
    cz = 1
    g.box(0, 2, cz, 3, 3, cz + 2, C("steel", 6))  # chisel end
    g.box(2, 2, cz, 38, 4, cz + 2, C("red", 4))
    g.box(2, 3, cz, 38, 4, cz + 2, C("red", 5))
    for x in range(4, 13):
        g.box(x, 2, cz, x + 1, 4, cz + 2, C("iron", 1) if x % 2 else C("iron", 2))  # tape
    for x in (18, 19, 26, 31):
        g.set(x, 3, cz, C("steel", 4))
    # claw hook curling up and back
    pts = [(38, 3), (40, 4), (41, 6), (41, 8), (40, 10), (38, 11), (36, 10)]
    for (a, b), (c, d) in zip(pts, pts[1:]):
        g.line((a, b, cz + 1), (c, d, cz + 1), 1.0, C("red", 4))
    g.box(35, 9, cz, 37, 11, cz + 2, C("steel", 6))  # split claw tips
    g.set(36, 10, cz, 0)
    return held_asset("crowbar", "Crowbar", g, grip=(8, 3, cz + 0.5), sockets=[("socket-tip", (41, 7, cz + 1))],
                      pfx=[{"effectId": "rvx-apocalypse-metal-clang", "socket": "socket-tip", "trigger": "manual", "size": 0.3}])
