"""Nail bat: an ash baseball bat with a taped grip, a brand stamp, rusty
nails hammered through the barrel and a barbed-wire wrap, bloodied at the
tip. The barrel points +X."""
import math

from _kit import held_asset
from voxgrid import C, Grid


def build():
    g = Grid(46, 13, 13)
    cy = cz = 6
    for x in range(0, 44):
        r = 1.3 + max(0, x - 12) * 0.075
        g.cylinder("x", cy + 0.5, cz + 0.5, r, x, x + 1, C("wood", 6 if x % 7 else 5))
    g.cylinder("x", cy + 0.5, cz + 0.5, 2.4, 0, 2, C("wood", 5))  # knob
    for x in range(2, 13):
        g.cylinder("x", cy + 0.5, cz + 0.5, 1.6, x, x + 1, C("iron", 1) if x % 3 else C("iron", 2))  # grip tape
    g.box(20, cy + 2, cz, 25, cy + 3, cz + 1, C("darkwood", 3))  # brand
    for k in range(10):  # nails
        a = k * 2.4
        x = 29 + (k * 13) % 14
        dy, dz = math.sin(a), math.cos(a)
        g.line((x, cy + 0.5 + dy * 2, cz + 0.5 + dz * 2), (x + 0.5, cy + 0.5 + dy * 5.2, cz + 0.5 + dz * 5.2), 0.45, C("steel", 5))
        g.set(x + 0.5, cy + 0.5 + dy * 5.4, cz + 0.5 + dz * 5.4, C("rust", 4))
    for k in range(30):  # barbed wire spiral
        x = 24 + k * 0.4
        a = k * 0.7
        g.set(x, cy + 0.5 + math.sin(a) * 3.2, cz + 0.5 + math.cos(a) * 3.2, C("iron", 4))
    for x in range(38, 44):
        for k in range(3):
            g.set(x, cy + 3 - k, cz + 3 + (x % 2), C("blood", 3 + (k % 2)))
    g.set(44, cy, cz, C("blood", 2)).set(44, cy + 1, cz + 1, C("blood", 3))
    return held_asset("nail-bat", "Nail Bat", g, grip=(7, cy + 0.5, cz + 0.5),
                      sockets=[("socket-tip", (44, cy + 0.5, cz + 0.5)), ("socket-trail", (34, cy + 0.5, cz + 0.5))],
                      pfx=[{"effectId": "rvx-apocalypse-gore-burst", "socket": "socket-tip", "trigger": "manual", "size": 0.36}])
