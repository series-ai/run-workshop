"""Bio blaster: a living alien gun of purple flesh and bone ribs with two
glowing green acid sacs, a toothy muzzle and an eye on top. Held-item
frame: muzzle along +X."""
import math

from _kit import C, Grid, held, light, speck


def build():
    g = Grid(32, 14, 10)
    cy, cz = 8, 5
    g.ellipsoid(14, cy, cz, 12, 4, 4, C("purple", 3))
    for xx in range(6, 24, 3):
        g.ellipsoid(xx, cy, cz, 0.8, 4.4, 4.4, C("bone", 5))  # ribs
    g.sphere(10, cy + 3.5, cz - 3, 2.2, C("toxic", 6))
    g.sphere(15, cy + 3.5, cz + 3, 2.0, C("toxic", 5))
    g.set(10, cy + 5, int(cz) - 4, C("toxic", 7))
    g.sphere(18, cy + 4, cz, 1.6, C("bone", 7))  # eye
    g.set(18, cy + 5, int(cz), C("red", 7))
    g.cylinder("x", cy, cz, 3.0, 25, 30, C("purple", 4), r2=2.2)
    for k in range(6):
        a = k * math.pi / 3
        g.set(30, int(cy + 2 * math.sin(a)), int(cz + 2 * math.cos(a)), C("bone", 7))
    g.cylinder("x", cy, cz, 1.2, 29, 32, C("toxic", 7))
    g.line((6, 5, cz), (5, 0.5, cz), 1.4, C("purple", 2))  # fleshy grip
    light(g)
    speck(g, 162, 0.15, ramps=("purple",))
    return held("bio-blaster", "Bio Blaster", g, grip=(5.5, 2.5, cz), sockets={"socket-muzzle": (31, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-goo-shot", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [1.0, 0.0, 0.0]}])
