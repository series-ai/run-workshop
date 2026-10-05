"""Elven longbow: a recurved pale-wood bow with gold leaf tips and a
green grip; the limbs run through the fist along ±X, the string sits on
the arm side (-Z) with a nocked arrow pointing along +Z (down the arm)."""
import math

from _kit import held
from voxgrid import C, Grid


def build():
    H = 56
    g = Grid(H, 5, 20)
    cy, cz = 2, 10
    mid = H / 2
    for x in range(H):
        t = (x - mid) / mid
        bend = 7 * (1 - t * t) - 2.0 * max(0, abs(t) - 0.8) * 10  # recurve at the tips
        z = cz + bend
        col = C("bone", 5) if abs(t) < 0.9 else C("gold", 5)
        g.box(x, cy - 1, z - 1, x + 1, cy + 1, z + 1, col)
        if abs(t) < 0.08:
            g.box(x, cy - 1, z - 2, x + 1, cy + 2, z + 2, C("leaf", 3))
        if 0.3 < abs(t) < 0.35:
            g.box(x, cy - 1, z - 1, x + 1, cy + 1, z + 1, C("gold", 4))
    tip_z = cz + 7 * (1 - 0.95 ** 2) - 2.0 * (0.95 - 0.8) * 10
    for x in range(1, H - 1):  # string
        g.set(x, cy, int(tip_z) - 1, C("bone", 7))
    # arrow nocked: shaft along +z from the string past the grip
    g.box(int(mid), cy, int(tip_z) - 1, int(mid) + 1, cy + 1, cz + 9, C("wood", 5))
    g.box(int(mid) - 1, cy, int(tip_z) - 1, int(mid) + 2, cy + 1, int(tip_z) + 2, C("red", 4))
    g.box(int(mid), cy - 1, cz + 9, int(mid) + 1, cy + 2, cz + 10, C("steel", 6))
    return held("elven-bow", "Elven Longbow", g, (mid, cy, cz + 7), {"socket-arrow": (mid, cy, cz + 10)},
                [{"effectId": "rvx-fantasy-bow-release", "socket": "socket-arrow", "trigger": "manual", "size": 0.36, "aim": [1.0, 0.0, 0.0]}])
