"""Scavenger spear: a broom-handle shaft with tape bands, a kitchen knife
lashed to the tip with wire, a trophy feather and a rag streamer. The
point is at +X."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(60, 11, 5)
    cy, cz = 5, 2
    g.box(0, cy, cz, 50, cy + 2, cz + 2, C("wood", 5))
    for x in (6, 7, 20, 21, 34, 35):
        g.box(x, cy, cz, x + 1, cy + 2, cz + 2, C("blue", 4))  # tape bands
    g.box(0, cy, cz, 2, cy + 2, cz + 2, C("red", 4))
    g.box(44, cy - 1, cz - 1, 50, cy + 3, cz + 3, C("steel", 3))  # wire lashing
    for x in range(44, 50, 2):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 3, cz + 3, C("steel", 5))
    g.box(50, cy - 1, cz, 51, cy + 3, cz + 2, C("iron", 2))  # knife bolster
    for x in range(51, 60):  # knife blade
        w = 3 if x < 56 else 3 - (x - 55)
        g.box(x, cy + 2 - w, cz, x + 1, cy + 2, cz + 1, C("steel", 6))
        g.set(x, cy + 1, cz, C("steel", 7))
    g.line((42, cy + 2, cz + 1), (39, cy + 8, cz + 1), 0.5, C("gray", 7))  # feather
    g.set(39, cy + 8, cz + 1, C("iron", 1))
    for k in range(6):  # rag streamer
        g.set(44 - k, cy - 1 - k // 2, cz + 1, C("red", 4 if k % 2 else 3))
    return held_asset("spear", "Scavenger Spear", g, grip=(22, cy + 1, cz + 1), sockets=[("socket-tip", (59, cy + 1, cz + 0.5)), ("socket-trail", (52, cy + 1, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.32}])
