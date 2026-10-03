"""Plasma sword: a chrome-and-gold hilt with a ribbed grip, an emitter
guard with side vents and a long glowing magenta plasma blade with a white
core. Held-item frame: blade along +X."""
from _kit import C, Grid, held


def build():
    g = Grid(48, 7, 5)
    cy, cz = 3, 2
    g.box(0, cy - 1, cz - 1, 10, cy + 2, cz + 2, C("steel", 5))  # hilt
    for xx in range(1, 10, 2):
        g.box(xx, cy - 1, cz - 1, xx + 1, cy + 2, cz + 2, C("iron", 2))
    g.box(0, cy - 1, cz - 1, 1, cy + 2, cz + 2, C("gold", 5))  # pommel
    g.box(10, 0, 0, 13, 7, 5, C("gold", 4))  # guard / emitter
    g.box(10, 1, 0, 13, 6, 1, C("iron", 1))
    g.set(11, 3, 0, C("magenta", 7))
    g.box(13, cy - 1, cz - 1, 46, cy + 2, cz + 2, C("magenta", 5))  # blade glow
    g.box(13, cy, cz, 47, cy + 1, cz + 1, C("pink", 7))  # core
    g.box(46, cy, cz - 1, 48, cy + 1, cz + 2, C("magenta", 6))
    return held("plasma-sword", "Plasma Sword", g, grip=(5, cy + 0.5, cz + 0.5), sockets={"socket-tip": (47, cy + 0.5, cz + 0.5), "socket-trail": (30, cy + 0.5, cz + 0.5)},
                pfx=[{"effectId": "rvx-space-plasma-slash", "trigger": "manual", "size": 0.323, "aim": [-1.0, 0.0, 0.0], "offset": [-0.107, 0.03, 0.0]}])
