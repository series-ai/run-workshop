"""Star flag: a planting flag for claiming new worlds: a chrome telescopic
pole with a gold star finial and a navy banner with a white star, a red
stripe and a fringe. Held-item frame: pole along +X, banner up (+Y)."""
from _kit import C, Grid, held


def build():
    g = Grid(52, 20, 3)
    cy, cz = 2, 1
    g.box(0, cy - 1, 0, 50, cy + 1, 2, C("steel", 5))  # pole
    for xx in (12, 26, 40):
        g.box(xx, cy - 1, 0, xx + 1, cy + 1, 2, C("steel", 3))
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        g.set(50 + dx, cy + dy, 1, C("gold", 6))
    g.box(24, cy + 1, 1, 48, 20, 2, C("navy", 4))  # banner
    g.box(24, cy + 1, 1, 48, cy + 4, 2, C("red", 4))
    g.box(24, 17, 1, 48, 18, 2, C("red", 4))
    for xx in range(24, 48, 2):
        g.set(xx, 19, 1, C("gold", 5))
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (1, -2), (-1, -2)):
        g.set(36 + dx, 11 + dy, 1, C("bone", 7))
    g.box(24, cy + 1, 1, 25, 20, 2, C("steel", 6))
    return held("star-flag", "Star Flag", g, grip=(6, cy, cz + 0.5), sockets={"socket-tip": (51, cy + 0.5, 1.5)})
