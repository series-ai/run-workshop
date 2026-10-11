"""Ray gun: a 1950s-style atomic ray gun with a bulbous red body, three
stacked gold emitter rings, a glass power bulb on top and a finned
handle. Held-item frame: emitter along +X."""
from _kit import C, Grid, held, light, ring


def build():
    g = Grid(26, 16, 9)
    cy, cz = 8, 4.5
    g.ellipsoid(9, cy, cz, 7, 4, 4, C("red", 4))  # body
    g.cylinder("x", cy, cz, 2.2, 15, 21, C("steel", 5))
    for xx, r in ((16, 3.6), (18.5, 3.0), (21, 2.4)):
        ring(g, "x", cy, cz, r, r - 1.2, xx, xx + 1, C("gold", 5))
    g.cylinder("x", cy, cz, 1.4, 21, 26, C("steel", 6))
    g.cylinder("x", cy, cz, 1.2, 25, 26, C("toxic", 7))
    g.sphere(8, cy + 5, cz, 2.3, C("toxic", 6))  # bulb
    g.set(7, cy + 6, int(cz) - 1, C("toxic", 7))
    g.box(4, 0, 3, 8, cy - 2, 6, C("steel", 4))  # handle (palm side)
    for yy in range(1, 6, 2):
        g.box(3, yy, 3, 4, yy + 1, 6, C("steel", 6))
    g.box(1, cy - 1, 3, 3, cy + 1, 6, C("gold", 5))
    light(g)
    return held("ray-gun", "Atomic Ray Gun", g, grip=(6, cy - 3, cz), sockets={"socket-muzzle": (26, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-ray-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.25, "aim": [1.0, 0.0, 0.0]}])
