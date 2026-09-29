"""Cast-iron frying pan: a heavy black skillet with a pour lip, a rim
highlight, a riveted handle wrapped in rag, and a dent from use as a
weapon. The pan sits at +X, its cooking face toward +Y."""
import math

from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(40, 5, 20)
    cz = 10
    g.box(0, 2, cz - 1, 20, 4, cz + 1, C("iron", 2))  # handle
    for x in range(1, 10):
        g.box(x, 2, cz - 1, x + 1, 4, cz + 1, C("khaki", 4 if x % 2 else 3))  # rag wrap
    g.box(0, 2, cz - 1, 2, 4, cz + 1, C("iron", 1))
    g.set(1, 3, cz, 0)  # hang hole
    pc = (29.5, cz)
    for x in range(18, 40):
        for z in range(0, 20):
            d = math.hypot(x + 0.5 - pc[0], z + 0.5 - pc[1])
            if d <= 9.8:
                g.set(x, 1, z, C("iron", 2))  # bottom
                if d > 8.6:
                    g.set(x, 2, z, C("iron", 3)).set(x, 3, z, C("iron", 4))  # rim
                    if d > 9.3:
                        g.set(x, 3, z, C("steel", 4))
                elif (x + z) % 5 == 0:
                    g.set(x, 1, z, C("iron", 1))
    g.box(24, 1, cz - 2, 28, 2, cz + 1, C("iron", 3))  # worn centre
    g.box(33, 1, 4, 36, 2, 6, 0)  # dent
    g.box(33, 0, 4, 36, 1, 6, C("iron", 1))
    g.set(21, 3, cz - 1, C("steel", 6)).set(21, 3, cz, C("steel", 6))  # rivets
    return held_asset("frying-pan", "Frying Pan", g, grip=(5, 3, cz), sockets=[("socket-tip", (39, 2, cz))],
                      pfx=[{"effectId": "rvx-apocalypse-metal-clang", "socket": "socket-tip", "trigger": "manual", "size": 0.3}])
