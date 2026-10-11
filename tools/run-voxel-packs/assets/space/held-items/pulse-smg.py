"""Pulse SMG: a compact steel sub-machine gun with a cyan pulse cell.
Held-item frame: barrel along +X."""
from _kit import C, Grid, cbox, held, light, ring


def build():
    g = Grid(32, 14, 7)
    cy, cz = 8, 3.5

    # A chamfered white hull sits inside a dark steel frame.
    cbox(g, 0, 5, 0, 20, 11, 7, C("steel", 4), r=1)
    g.box(1, 5, 0, 19, 6, 7, C("iron", 2))
    g.box(2, 10, 0, 18, 11, 7, C("steel", 4))
    g.box(3, 10, 1, 17, 11, 6, C("bone", 6))
    g.box(4, 10, 1, 16, 11, 2, C("steel", 5))
    g.box(4, 10, 5, 16, 11, 6, C("steel", 5))
    for xx in (4, 15):
        g.set(xx, 10, 3, C("rust", 5))
    for z0 in (0, 6):
        # Framed cheek plates break up the broad sides.
        g.box(2, 6, z0, 18, 10, z0 + 1, C("bone", 5))
        g.box(3, 7, z0, 17, 9, z0 + 1, C("steel", 5))
        g.box(4, 7, z0, 10, 9, z0 + 1, C("bone", 6))
        g.box(11, 7, z0, 16, 9, z0 + 1, C("iron", 3))
        # Cyan pulse bars and copper fasteners mark the weapon function.
        g.box(5, 8, z0, 9, 9, z0 + 1, C("cyan", 6))
        g.box(6, 8, z0, 8, 9, z0 + 1, C("cyan", 7))
        for xx in (3, 17):
            for yy in (6, 9):
                g.set(xx, yy, z0, C("rust", 5))
        for xx in (12, 14, 16):
            g.box(xx, 7, z0, xx + 1, 8, z0 + 1, C("steel", 2))

    # The raised sensor is a clear white focal point with a cyan lens.
    g.box(7, 11, 2, 16, 12, 5, C("iron", 2))
    g.box(8, 12, 2, 15, 13, 5, C("bone", 6))
    g.box(9, 12, 3, 14, 13, 4, C("steel", 5))
    g.box(10, 13, 3, 13, 14, 4, C("cyan", 6))
    g.set(11, 13, 3, C("cyan", 7))
    g.set(8, 12, 4, C("orange", 6))

    # A shaped steel grip and copper trigger guard form one readable assembly.
    g.box(4, 0, 2, 8, 2, 5, C("iron", 2))
    g.box(5, 2, 2, 9, 4, 5, C("iron", 3))
    g.box(7, 4, 2, 10, 6, 5, C("steel", 3))
    g.box(4, 0, 2, 8, 1, 5, C("rust", 4))
    for yy in (1, 3):
        g.box(5 + yy, yy, 2, 7 + yy, yy + 1, 3, C("steel", 4))
        g.box(5 + yy, yy, 4, 7 + yy, yy + 1, 5, C("steel", 4))
    for z0 in (1, 5):
        g.box(9, 3, z0, 12, 4, z0 + 1, C("rust", 5))
        g.box(11, 1, z0, 12, 4, z0 + 1, C("rust", 5))
        g.box(10, 1, z0, 12, 2, z0 + 1, C("rust", 5))
    g.box(10, 4, 3, 11, 5, 4, C("orange", 6))

    # The under-slung pulse magazine has a steel casing and a visible core.
    g.cylinder("z", 13, 3, 3.3, 1, 6, C("iron", 2))
    g.cylinder("z", 13, 3, 2.5, 0, 7, C("steel", 4))
    g.cylinder("z", 13, 3, 1.6, 0, 7, C("cyan", 5))
    g.cylinder("z", 13, 3, 0.8, 0, 7, C("cyan", 7))
    for z0 in (0, 6):
        g.set(13, 4, z0, C("bone", 6))
        g.set(12, 2, z0, C("rust", 5))

    # A light steel shroud, copper collars, and cyan emitter finish the barrel.
    g.cylinder("x", cy, cz, 2.0, 19, 29, C("steel", 5))
    for xx in (21, 24, 27):
        ring(g, "x", cy, cz, 2.5, 1.8, xx, xx + 1, C("rust", 5))
    g.cylinder("x", cy, cz, 2.3, 29, 32, C("iron", 3))
    g.cylinder("x", cy, cz, 1.2, 30, 32, C("cyan", 6))
    g.cylinder("x", cy, cz, 0.6, 31, 32, C("cyan", 7))

    light(g, ramps=("steel", "iron", "bone", "rust"))
    return held("pulse-smg", "Pulse SMG", g, grip=(6, 3, cz), sockets={"socket-muzzle": (32, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-laser-bolt", "socket": "socket-muzzle", "trigger": "manual", "size": 0.25, "aim": [1.0, 0.0, 0.0]}])
