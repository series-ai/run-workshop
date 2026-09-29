"""Side-by-side double-barrel shotgun: dark stock with a leather cheek wrap,
engraved brass receiver, twin barrels with a rib, two hammers and a shell
belt strapped to the stock. Muzzles point +X."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(54, 12, 7)
    cz = 3
    for x in range(0, 17):
        bot = 1 + x // 4
        top = 7 + (1 if x > 12 else 0)
        g.box(x, bot, cz - 1, x + 1, top, cz + 2, C("darkwood", 5 if x % 4 else 4))
    g.box(4, 3, cz - 2, 10, 7, cz + 3, C("wood", 2))  # leather wrap
    for x in range(5, 10, 2):
        g.box(x, 4, cz - 2, x + 1, 6, cz - 1, C("red", 4))  # shells in loops
        g.set(x, 4, cz - 2, C("gold", 5))
    g.box(17, 4, cz - 1, 24, 9, cz + 2, C("gold", 4))  # receiver
    for x, y in ((18, 5), (20, 7), (22, 5), (19, 8)):
        g.set(x, y, cz - 1, C("gold", 6))
    g.box(20, 9, cz - 2, 22, 11, cz - 1, C("iron", 2)).box(20, 9, cz + 2, 22, 11, cz + 3, C("iron", 2))  # hammers
    g.box(18, 2, cz, 22, 4, cz + 1, C("iron", 2))
    # twin barrels side by side (along z)
    g.box(24, 6, cz - 2, 54, 9, cz + 3, C("iron", 2))
    g.box(24, 9, cz, 54, 10, cz + 1, C("iron", 4))  # rib
    g.box(53, 6, cz - 2, 54, 9, cz, C("iron", 0)).box(53, 6, cz + 1, 54, 9, cz + 3, C("iron", 0))
    g.box(24, 4, cz - 1, 36, 6, cz + 2, C("darkwood", 5))  # forend
    g.box(52, 10, cz, 53, 11, cz + 1, C("steel", 7))
    return held_asset("double-barrel", "Double-Barrel Shotgun", g, grip=(15, 5, cz + 0.5),
                      sockets=[("socket-muzzle", (54, 7.5, cz + 0.5), FWD)],
                      pfx=[{"effectId": "rvx-apocalypse-shotgun-blast", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [0.0, 0.0, 1.0]}])
