"""Machete: a long single-edged blade with a clipped point, a rust-bloomed
spine, a bright honed edge, a paracord-wrapped handle and brass rivets.
The blade points +X, the edge faces -Y."""
from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(50, 11, 3)
    cz = 1
    g.box(0, 2, cz - 1, 12, 6, cz + 2, C("darkwood", 4))  # handle
    for x in range(1, 12, 2):
        g.box(x, 2, cz - 1, x + 1, 6, cz + 2, C("forest", 3))  # paracord wraps
    g.box(0, 2, cz - 1, 1, 7, cz + 2, C("darkwood", 2))  # pommel hook
    for x in (4, 8):
        g.set(x, 4, cz - 1, C("gold", 5)).set(x, 4, cz + 1, C("gold", 5))
    g.box(12, 1, cz - 1, 13, 8, cz + 2, C("iron", 3))  # bolster
    for x in range(13, 49):
        width = 6 if x < 40 else 6 - (x - 40) * 0.7
        top = 7 if x < 42 else 7 - (x - 42) // 2
        bot = max(1, int(top - width))
        g.box(x, bot, cz, x + 1, top, cz + 1, C("steel", 5))
        g.set(x, top - 1, cz, C("rust", 4 if x % 3 else 3))  # spine rust
        g.set(x, bot, cz, C("steel", 7))  # edge
    g.box(22, 3, cz, 26, 4, cz + 1, C("steel", 4))
    g.set(30, 4, cz, C("blood", 3)).set(31, 3, cz, C("blood", 4)).set(33, 5, cz, C("blood", 3))
    return held_asset("machete", "Machete", g, grip=(6, 4, cz + 0.5), sockets=[("socket-tip", (48, 4, cz + 0.5)), ("socket-trail", (32, 4, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.36}])
