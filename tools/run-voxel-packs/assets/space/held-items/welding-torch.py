"""Welding torch: a chunky plasma cutter with a plated steel fuel body,
copper fittings, a hazard-orange grip and a bright cyan ceramic emitter.
Held-item frame: nozzle along +X."""
from _kit import C, Grid, cbox, held, light, ring


def build():
    g = Grid(30, 12, 8)
    cy, cz = 6, 4

    # Broad fuel housing. The collars frame a steel core and white side plates.
    g.cylinder("x", 7, 4, 3.2, 0, 13, C("steel", 4))
    cbox(g, 0, 4, 0, 12, 10, 8, C("steel", 4), r=1)
    ring(g, "x", 7, 4, 3.5, 2.7, 2, 3, C("rust", 4))
    ring(g, "x", 7, 4, 3.5, 2.7, 11, 12, C("rust", 4))
    g.box(3, 5, 0, 10, 9, 1, C("bone", 5))
    g.box(3, 5, 7, 10, 9, 8, C("bone", 5))

    # Oversized grip and its copper-orange grip ribs.
    cbox(g, 4, 0, 1, 10, 5, 7, C("iron", 2), r=1)
    g.box(5, 1, 1, 9, 2, 7, C("orange", 2))
    g.box(5, 3, 1, 9, 4, 7, C("orange", 2))
    g.box(8, 3, 2, 11, 4, 6, C("rust", 4))  # trigger bridge
    g.box(9, 2, 2, 10, 4, 6, C("iron", 2))  # dark trigger inset

    # Thick, ribbed barrel. Copper and orange bands mark the hot end.
    g.cylinder("x", cy, cz, 1.8, 12, 23, C("steel", 5))
    ring(g, "x", cy, cz, 2.3, 1.4, 13, 14, C("orange", 2))
    ring(g, "x", cy, cz, 2.2, 1.4, 21, 22, C("rust", 5))
    ring(g, "x", cy, cz, 2.3, 1.3, 22, 23, C("orange", 2))
    for xx in (16, 18, 20):
        ring(g, "x", cy, cz, 2.0, 1.5, xx, xx + 1, C("iron", 2))

    # Ceramic nozzle collar and the cyan plasma bore.
    g.cylinder("x", cy, cz, 2.4, 23, 27, C("bone", 5))
    ring(g, "x", cy, cz, 2.5, 1.5, 23, 24, C("steel", 3))
    ring(g, "x", cy, cz, 2.5, 1.4, 26, 27, C("rust", 4))
    g.cylinder("x", cy, cz, 1.4, 27, 29, C("teal", 5))
    g.cylinder("x", cy, cz, 0.9, 29, 30, C("cyan", 7))

    # Raised sight, joined to the top of the housing.
    cbox(g, 6, 9, 2, 10, 12, 6, C("iron", 2), r=1)
    g.box(7, 11, 2, 9, 12, 3, C("steel", 5))
    g.box(7, 11, 5, 9, 12, 6, C("steel", 5))
    g.set(8, 11, 2, C("plasma", 7)).set(8, 11, 5, C("plasma", 7))

    light(g)

    # Painted plating seams and a paired charge window on both visible sides.
    for z in (0, 7):
        for xx in (3, 9):
            for yy in range(5, 9):
                g.set(xx, yy, z, C("steel", 2))
        for xx in range(4, 9):
            g.set(xx, 5, z, C("steel", 2)).set(xx, 8, z, C("steel", 2))
        for xx in range(5, 8):
            g.set(xx, 6, z, C("teal", 5 if xx != 6 else 7))
        g.set(4, 6, z, C("rust", 5)).set(8, 6, z, C("rust", 5))
        g.set(4, 7, z, C("steel", 3)).set(8, 7, z, C("steel", 3))

    # Small orange safety marks sit on the upper housing face.
    for xx in (4, 6, 8, 10):
        g.set(xx, 9, 0, C("orange", 2)).set(xx, 9, 7, C("orange", 2))

    return held("welding-torch", "Welding Torch", g, grip=(6, 3, cz), sockets={"socket-flame": (29, 7.5, 4.5)},
                pfx=[{"effectId": "rvx-space-weld-sparks", "socket": "socket-flame", "trigger": "manual", "size": 0.25, "aim": [1.0, 0.0, 0.0]}])
