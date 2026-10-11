"""Chainsaw: an orange engine housing with a top handle, pull-cord, black
exhaust, and a long steel bar wrapped in a toothed chain, smeared with
blood. The bar points +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(52, 16, 9)
    cz = 4
    g.box(0, 2, cz - 2, 18, 11, cz + 3, C("orange", 4))  # engine housing
    g.box(0, 10, cz - 2, 18, 11, cz + 3, C("orange", 5))
    g.box(2, 3, cz - 3, 10, 9, cz - 2, C("iron", 2))  # air filter cover
    for y in range(4, 9, 2):
        g.box(3, y, cz - 4, 9, y + 1, cz - 3, C("iron", 1))
    g.box(0, 5, cz - 1, 1, 8, cz + 2, C("iron", 3))  # rear handle mount
    g.box(3, 11, cz, 15, 12, cz + 1, C("iron", 1))  # top handle
    g.box(3, 11, cz, 4, 15, cz + 1, C("iron", 1)).box(14, 11, cz, 15, 15, cz + 1, C("iron", 1)).box(3, 14, cz, 15, 15, cz + 1, C("iron", 1))
    g.box(12, 7, cz + 3, 16, 10, cz + 4, C("iron", 2))  # exhaust
    g.box(5, 6, cz + 3, 7, 8, cz + 5, C("gold", 6))  # pull cord grip
    g.box(18, 4, cz - 1, 20, 9, cz + 2, C("iron", 3))  # clutch cover
    # bar and chain
    g.box(20, 5, cz, 50, 9, cz + 1, C("steel", 5))
    g.box(49, 6, cz, 51, 8, cz + 1, C("steel", 5))
    for x in range(20, 51):
        g.set(x, 4, cz, C("iron", 3) if x % 2 else C("steel", 7))
        g.set(x, 9, cz, C("iron", 3) if x % 2 else C("steel", 7))
    g.box(51, 5, cz, 52, 9, cz + 1, C("iron", 3))
    for x, y in ((30, 9), (31, 8), (36, 4), (42, 9), (43, 8)):
        g.set(x, y, cz, C("blood", 4))
    return held_asset("chainsaw", "Chainsaw", g, grip=(9, 12, cz + 0.5), sockets=[("socket-tip", (51, 7, cz + 0.5)), ("socket-exhaust", (16, 8.5, cz + 4))],
                      pfx=[{"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-exhaust", "trigger": "idle", "size": 0.1}, {"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.4}])
