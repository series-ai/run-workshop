"""Bio blaster: a steel sidearm built around a toxic bio-cell. Held-item
frame: muzzle along +X."""
from _kit import C, Grid, cbox, held, light, ring


def build():
    g = Grid(32, 14, 10)
    cy, cz = 8, 5

    # A compact framed receiver gives the weapon a clean, readable body.
    cbox(g, 3, 5, 1, 21, 12, 9, C("steel", 4), r=1)
    cbox(g, 4, 10, 2, 19, 12, 8, C("bone", 5), r=1)  # shaped upper hull
    g.box(5, 9, 1, 19, 10, 2, C("iron", 2))
    g.box(5, 9, 8, 19, 10, 9, C("iron", 2))

    # Side plates and seams sit on both broad receiver faces.
    for z0 in (0, 9):
        g.box(6, 5, z0, 18, 9, z0 + 1, C("iron", 2))
        g.box(7, 6, z0, 17, 8, z0 + 1, C("steel", 4))
        g.box(8, 8, z0, 17, 9, z0 + 1, C("bone", 6))
        # A round, framed vial makes the bio-reactive core the focal feature.
        g.box(9, 5, z0, 16, 9, z0 + 1, C("iron", 2))
        ring(g, "z", 12.5, 7, 2.7, 2.0, z0, z0 + 1, C("rust", 5))
        g.cylinder("z", 12.5, 7, 2.0, z0, z0 + 1, C("toxic", 4))
        g.cylinder("z", 12.5, 7, 1.4, z0, z0 + 1, C("toxic", 6))
        g.cylinder("z", 12.5, 7, 0.6, z0, z0 + 1, C("toxic", 7))
        # Copper and steel ports connect the vial to the receiver.
        g.set(10, 5, z0, C("rust", 6))
        g.set(15, 8, z0, C("steel", 6))
        g.set(17, 6, z0, C("orange", 6))
        g.set(17, 8, z0, C("steel", 6))

    # White rear cheek plates and copper service collars frame the receiver.
    g.box(2, 5, 2, 5, 10, 8, C("bone", 6))
    g.box(3, 5, 1, 4, 10, 9, C("rust", 4))
    g.box(19, 5, 2, 21, 10, 8, C("bone", 6))
    g.box(20, 5, 1, 21, 10, 9, C("rust", 5))
    # The rear cap has a clean inset panel, a seam and four fasteners.
    for yy in (6, 9):
        for zz in range(3, 7):
            g.set(2, yy, zz, C("steel", 3))
    for zz in (3, 6):
        for yy in range(7, 9):
            g.set(2, yy, zz, C("bone", 5))
    for yy, zz in ((6, 3), (6, 6), (9, 3), (9, 6)):
        g.set(2, yy, zz, C("steel", 6))
    g.set(2, 7, 4, C("bone", 7)).set(2, 8, 5, C("bone", 5))

    # A raised toxic bio-cell sits on the receiver spine.
    g.box(9, 11, 3, 16, 13, 7, C("iron", 2))
    g.box(10, 12, 3, 15, 13, 7, C("steel", 5))
    g.box(11, 12, 3, 14, 13, 7, C("toxic", 5))
    g.box(12, 12, 4, 14, 13, 6, C("toxic", 7))
    g.box(10, 11, 3, 12, 12, 4, C("rust", 5))
    g.box(13, 11, 6, 15, 12, 7, C("rust", 4))

    # A compact sight sits at the rear of the receiver.
    g.box(4, 11, 3, 8, 13, 7, C("iron", 2))
    g.box(5, 13, 4, 7, 14, 6, C("steel", 5))
    g.box(6, 13, 4, 7, 14, 6, C("cyan", 7))
    g.set(5, 13, 5, C("orange", 6))

    # A longer, rear-raked grip stays visible below the receiver.
    g.box(2, 0, 3, 6, 2, 7, C("iron", 2))
    g.box(4, 2, 3, 8, 4, 7, C("iron", 3))
    g.box(6, 4, 3, 10, 7, 7, C("iron", 3))
    g.box(2, 0, 3, 6, 1, 7, C("rust", 5))
    for yy in (1, 3, 5):
        xx0 = 3 + yy
        # Recessed-looking grip ribs stay flush with each broad face.
        g.box(xx0, yy, 3, xx0 + 2, yy + 1, 4, C("iron", 4))
        g.box(xx0, yy, 6, xx0 + 2, yy + 1, 7, C("iron", 4))
    # Copper trigger guard follows the grip angle.
    for z0 in (2, 7):
        g.box(8, 4, z0, 12, 5, z0 + 1, C("rust", 5))
        g.box(11, 2, z0, 12, 5, z0 + 1, C("rust", 5))
        g.box(9, 1, z0, 12, 2, z0 + 1, C("rust", 5))
    g.box(10, 4, 4, 11, 5, 6, C("orange", 6))  # trigger

    # A single steel shroud and evenly spaced copper bands define the muzzle.
    g.cylinder("x", cy, cz, 2.3, 19, 29, C("steel", 4))
    for xx in (22, 25, 28):
        ring(g, "x", cy, cz, 2.8, 2.1, xx, xx + 1, C("rust", 5))
    g.cylinder("x", cy, cz, 2.7, 29, 32, C("iron", 3), r2=2.2)
    g.cylinder("x", cy, cz, 1.3, 30, 32, C("cyan", 6))
    g.cylinder("x", cy, cz, 0.7, 31, 32, C("cyan", 7))

    light(g, ramps=("steel", "iron", "bone", "rust"))
    return held("bio-blaster", "Bio Blaster", g, grip=(5.5, 2.5, cz), sockets={"socket-muzzle": (31, cy + 0.5, cz)},
                pfx=[{"effectId": "rvx-space-goo-shot", "socket": "socket-muzzle", "trigger": "manual", "size": 0.3, "aim": [1.0, 0.0, 0.0]}])
