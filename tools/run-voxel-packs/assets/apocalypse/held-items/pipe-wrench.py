"""Pipe wrench: a heavy red-enamel handle chipped to bare iron, a knurled
adjusting nut and toothed steel jaws. The jaws point +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(40, 14, 5)
    cz = 2
    g.box(0, 2, cz - 1, 30, 6, cz + 2, C("red", 4))  # I-beam handle
    g.box(0, 3, cz - 2, 30, 5, cz + 3, C("red", 3))
    g.box(0, 2, cz - 1, 3, 6, cz + 2, C("iron", 3))  # hang hole end
    g.set(1, 4, cz - 2, C("iron", 0))
    for x, y in ((8, 5), (9, 5), (17, 2), (22, 5), (23, 5)):
        g.set(x, y, cz - 1, C("iron", 4))  # chips
    g.box(28, 2, cz - 1, 36, 8, cz + 2, C("iron", 4))  # housing
    g.box(30, 8, cz - 2, 34, 10, cz + 3, C("steel", 5))  # knurled nut
    for x in range(30, 34, 2):
        g.box(x, 8, cz - 2, x + 1, 10, cz + 3, C("steel", 3))
    g.box(33, 6, cz - 1, 36, 14, cz + 2, C("steel", 4))  # hook jaw shank
    g.box(36, 11, cz - 1, 40, 14, cz + 2, C("steel", 4))  # upper jaw
    g.box(36, 2, cz - 1, 40, 6, cz + 2, C("steel", 4))  # lower jaw
    for x in range(36, 40):
        g.set(x, 10, cz if x % 2 else cz + 1, C("steel", 6)).set(x, 6, cz if x % 2 else cz + 1, C("steel", 6))
    return held_asset("pipe-wrench", "Pipe Wrench", g, grip=(9, 4, cz + 0.5), sockets=[("socket-tip", (40, 8, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-metal-clang", "socket": "socket-tip", "trigger": "manual", "size": 0.3}])
