"""Hunter's lantern: a hooded iron lantern with amber glass and a
flickering candle, held forward on a short hooked rod.
Held-item frame: +X forward (lantern), origin = Hand.R joint."""
from _kit import C, Grid, candle, held, pfx, speck


def build():
    g = Grid(26, 16, 10)
    cy, cz = 7, 4
    g.box(0, cy, cz, 14, cy + 2, cz + 2, C("darkwood", 3))  # rod
    g.box(0, cy - 1, cz - 1, 2, cy + 3, cz + 3, C("iron", 3))
    g.box(14, cy, cz, 17, cy + 2, cz + 2, C("iron", 3))  # hook
    g.box(16, cy - 2, cz, 18, cy + 2, cz + 2, C("iron", 3))
    g.box(15, 1, 1, 25, 2, 9, C("iron", 3))  # base
    g.box(15, 12, 1, 25, 13, 9, C("iron", 3))  # top
    g.box(16, 13, 2, 24, 15, 8, C("iron", 2))  # hood
    g.box(19, 15, 4, 21, 16, 6, C("iron", 4))
    for px in (15, 24):
        for pz in (1, 8):
            g.box(px, 2, pz, px + 1, 12, pz + 1, C("iron", 2))
    g.box(16, 2, 2, 24, 12, 8, C("gold", 6))  # amber glass
    g.box(17, 3, 2, 23, 11, 3, C("gold", 7))
    candle(g, 20, 2, 5, 5)
    speck(g, 403, 0.1)
    # the lantern hangs below the rod: move rod to the lantern's top so it sits "held"
    return held("hunter-lantern", "Hunter's Lantern", g, (6, cy + 1, cz + 1), {"socket-flame": (20.5, 8, 5)},
                pfx=[pfx("rvx-monster-candle-flame", "socket-flame", "manual", size=0.12, aim=(1.0, 0.0, 0.0))])
