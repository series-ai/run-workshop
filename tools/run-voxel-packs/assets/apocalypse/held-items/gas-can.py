"""Gas can: a dented red plastic jerry can carried by its top handle, a
yellow spout pointing forward, a sloshing fuel window and a hazard sticker.
The spout points +X; the can hangs below the hand."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(26, 22, 11)
    cz = 5
    g.box(0, 0, cz - 4, 18, 15, cz + 5, C("red", 4))  # body hangs below the handle
    g.box(0, 14, cz - 4, 18, 15, cz + 5, C("red", 5))
    for x in range(2, 17, 5):
        g.box(x, 1, cz - 5, x + 3, 13, cz - 4, C("red", 3))  # ribs
    g.box(2, 3, cz + 5, 8, 11, cz + 6, C("gold", 5))  # sticker
    g.box(4, 5, cz + 5, 6, 9, cz + 6, C("iron", 1))
    g.box(10, 2, cz + 5, 15, 12, cz + 6, C("orange", 2))  # fuel window
    g.box(10, 2, cz + 5, 15, 7, cz + 6, C("orange", 5))
    g.box(5, 12, cz - 5, 8, 15, cz - 4, 0)  # dent
    g.box(3, 15, cz - 1, 14, 16, cz + 2, C("red", 3))  # handle
    g.box(3, 16, cz - 1, 4, 20, cz + 2, C("red", 3)).box(13, 16, cz - 1, 14, 20, cz + 2, C("red", 3))
    g.box(3, 19, cz - 1, 14, 21, cz + 2, C("red", 3))
    g.box(18, 11, cz - 1, 20, 15, cz + 2, C("iron", 2))  # spout base
    g.line((20, 13, cz + 0.5), (25, 17, cz + 0.5), 1.0, C("gold", 5))
    g.box(24, 16, cz, 26, 18, cz + 1, C("gold", 3))
    return held_asset("gas-can", "Gas Can", g, grip=(8.5, 20, cz + 0.5), sockets=[("socket-spout", (25.5, 17, cz + 0.5), FWD)],
                      pfx=[{"effectId": "rvx-apocalypse-fuel-splash", "socket": "socket-spout", "trigger": "manual", "size": 0.28}])
