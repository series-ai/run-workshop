"""Stake crossbow: a dark walnut stock with brass fittings, steel limbs
and a loaded wooden stake bolt with a silver tip.
Held-item frame: +X forward (muzzle), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx, speck


def build():
    g = Grid(36, 28, 7)
    cy, cz = 13, 3
    g.box(0, cy - 3, cz - 1, 8, cy + 2, cz + 2, C("darkwood", 3))  # butt
    g.box(0, cy - 4, cz - 1, 3, cy + 2, cz + 2, C("darkwood", 2))
    g.box(8, cy - 1, cz - 1, 30, cy + 2, cz + 2, C("darkwood", 4))  # stock
    g.box(8, cy - 2, cz - 1, 10, cy + 2, cz + 2, C("gold", 4))
    g.box(28, cy - 1, cz - 1, 31, cy + 2, cz + 2, C("gold", 4))
    g.box(12, cy - 4, cz, 14, cy - 1, cz + 1, C("iron", 3))  # trigger
    for s in (-1, 1):  # recurved limbs spanning ±y
        g.line((29, cy + 0.5, cz + 0.5), (26, cy + 0.5 + s * 9, cz + 0.5), 0.8, C("steel", 4))
        g.line((26, cy + 0.5 + s * 9, cz + 0.5), (27, cy + 0.5 + s * 13, cz + 0.5), 0.6, C("steel", 5))
        g.line((27, cy + 0.5 + s * 13, cz + 0.5), (16, cy + 0.5, cz + 0.5), 0.3, C("bone", 6))  # string
    g.box(16, cy + 2, cz, 34, cy + 3, cz + 1, C("wood", 5))  # stake bolt
    g.box(34, cy + 2, cz, 36, cy + 3, cz + 1, C("steel", 7))
    g.box(16, cy + 2, cz - 1, 18, cy + 3, cz + 2, C("blood", 3))  # fletching
    speck(g, 404, 0.1)
    return held("stake-crossbow", "Stake Crossbow", g, (5, cy, cz + 0.5), {"socket-muzzle": (36, cy + 2.5, cz + 0.5)},
                pfx=[pfx("rvx-monster-bolt-twang", "socket-muzzle", "manual", size=0.34, aim=(1.0, 0.0, 0.0))])
