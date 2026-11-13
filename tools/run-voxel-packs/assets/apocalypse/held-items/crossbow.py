"""Scrap crossbow: a plank stock with a pistol grip, leaf-spring limbs cut
from a car suspension, a bicycle-cable string, a scope made from a pipe and
a loaded rebar bolt. The bolt points +X; the limbs span Z."""
from _kit import FWD, held_asset
from voxgrid import C, Grid


def build():
    g = Grid(42, 12, 25)
    cz = 12
    g.box(0, 3, cz - 1, 30, 7, cz + 2, C("wood", 4))  # stock
    g.box(0, 3, cz - 1, 3, 8, cz + 2, C("wood", 3))
    for x in range(4, 30, 5):
        g.set(x, 6, cz - 1, C("wood", 2))
    for k in range(6):  # pistol grip
        g.box(10 + k // 3, 3 - k, cz - 1, 14 + k // 3, 4 - k, cz + 2, C("darkwood", 4))
    g.box(15, 1, cz, 18, 3, cz + 1, C("iron", 2))  # trigger
    g.box(30, 3, cz - 2, 34, 8, cz + 3, C("iron", 3))  # riser
    # limbs (leaf springs) sweeping back along +/-z
    for side in (-1, 1):
        for k in range(12):
            z = cz + 0.5 + side * (2 + k)
            x = 33 - k * 0.35
            g.box(x, 5, z - 0.5, x + 1.5, 7, z + 0.5, C("steel", 4 if k % 3 else 5))
        g.line((33 - 11 * 0.35, 6, cz + 0.5 + side * 13), (22, 6, cz + 0.5), 0.35, C("gray", 6))  # string
    g.box(31, 7, cz - 1, 33, 9, cz + 2, C("iron", 2))
    # scope pipe
    g.box(16, 9, cz - 1, 28, 11, cz + 1, C("iron", 2))
    g.box(18, 7, cz, 19, 9, cz + 1, C("iron", 3)).box(25, 7, cz, 26, 9, cz + 1, C("iron", 3))
    g.box(28, 9, cz - 1, 29, 11, cz + 1, C("sky", 5))
    # rebar bolt
    g.box(22, 7, cz, 42, 8, cz + 1, C("rust", 3))
    g.box(40, 7, cz, 42, 8, cz + 1, C("steel", 6))
    g.box(22, 7, cz - 1, 25, 8, cz + 2, C("red", 4))  # fletching
    return held_asset("crossbow", "Scrap Crossbow", g, grip=(12, 2, cz + 0.5), sockets=[("socket-bolt", (42, 7.5, cz + 0.5), FWD)])
