"""Haunted silver blunderbuss with a flared iron bore and skull-inlaid stock.
Held-item frame: +X forward (muzzle), origin = Hand.R joint."""
from _kit import C, Grid, held, pfx


def build():
    g = Grid(40, 14, 9)
    cy, cz = 7, 4
    barrel_y = cy + 1

    # A stepped, sloped butt gives the stock a broad, readable silhouette.
    g.box(0, 3, 1, 3, 10, 8, C("darkwood", 2))
    g.box(2, 2, 1, 5, 11, 8, C("darkwood", 3))
    g.box(4, 3, 1, 10, 10, 8, C("darkwood", 4))
    g.box(4, 4, 1, 8, 5, 2, C("darkwood", 5))
    g.box(5, 8, 1, 9, 9, 2, C("darkwood", 3))
    g.box(4, 4, 7, 8, 5, 8, C("darkwood", 5))
    g.box(5, 8, 7, 9, 9, 8, C("darkwood", 3))
    g.box(0, 4, 0, 2, 9, 1, C("iron", 3))
    g.box(0, 4, 8, 2, 9, 9, C("iron", 3))

    # One compact foregrip joins the stock to the barrel.
    g.box(10, 4, 2, 25, 7, 7, C("darkwood", 3))
    g.box(9, 6, 2, 13, 9, 7, C("iron", 3))
    g.box(10, 6, 1, 12, 8, 8, C("steel", 4))

    # Raised iron barrel. The tapered bore is cut through to the bell mouth.
    g.cylinder("x", barrel_y, cz + 0.5, 1.8, 11, 34, C("steel", 4), r2=2.5)
    g.cylinder("x", barrel_y, cz + 0.5, 2.5, 34, 38, C("steel", 4), r2=4.0)
    g.cylinder("x", barrel_y, cz + 0.5, 4.0, 38, 40, C("steel", 4))
    g.cylinder("x", barrel_y, cz + 0.5, 4.0, 39, 40, C("iron", 4))
    g.cylinder("x", barrel_y, cz + 0.5, 1.05, 11, 33, 0, r2=1.2)
    g.cylinder("x", barrel_y, cz + 0.5, 1.2, 33, 40, 0, r2=2.2)

    # Heavy iron cuffs frame the brighter barrel.
    for bx in (14, 21, 28):
        g.cylinder("x", barrel_y, cz + 0.5, 2.8, bx, bx + 2, C("iron", 3))
        g.cylinder("x", barrel_y, cz + 0.5, 1.25, bx, bx + 2, 0)
        g.cylinder("x", barrel_y, cz + 0.5, 2.9, bx, bx + 1, C("steel", 5))

    # A deep dark bore and its toxic shot give the muzzle a clear focal point.
    g.cylinder("x", barrel_y, cz + 0.5, 1.5, 12, 14, C("iron", 1))
    g.box(12, 8, 4, 13, 9, 5, C("toxic", 5))

    # Raised sights and a trigger guard mark the weapon's working parts.
    g.box(12, 10, 3, 15, 12, 6, C("iron", 3))
    g.box(13, 12, 4, 14, 13, 5, C("toxic", 5))
    g.box(10, 3, 3, 13, 5, 6, C("iron", 3))
    g.box(10, 2, 3, 12, 3, 4, C("steel", 4))
    g.box(11, 1, 3, 12, 3, 4, C("iron", 2))

    # Framed skull plates and small toxic eyes add a haunted identity.
    for z in (0, 8):
        g.box(2, 4, z, 9, 9, z + 1, C("iron", 2))
        g.box(3, 5, z, 8, 8, z + 1, C("steel", 4))
        g.box(4, 6, z, 7, 8, z + 1, C("bone", 6))
        g.box(4, 6, z, 5, 8, z + 1, C("iron", 2))
        g.box(6, 6, z, 7, 8, z + 1, C("iron", 2))
        g.set(4, 7, z, C("toxic", 6))
        g.set(6, 7, z, C("toxic", 6))
        g.set(5, 6, z, C("bone", 4))
        g.box(4, 4, z, 7, 5, z + 1, C("bone", 5))
        g.set(5, 8, z, C("purple", 4))

    # Pumpkin-orange powder charm hangs below the receiver.
    g.box(7, 1, 3, 9, 3, 6, C("moss", 3))
    g.box(7, 0, 4, 9, 2, 5, C("orange", 5))
    g.set(8, 2, 4, C("toxic", 6))

    return held(
        "silver-blunderbuss",
        "Silver Blunderbuss",
        g,
        (6, cy - 2, cz + 0.5),
        {"socket-muzzle": (40, cy + 1, cz + 0.5)},
        pfx=[pfx("rvx-monster-blunderbuss-blast", "socket-muzzle", "manual", size=0.3, aim=(1.0, 0.0, 0.0))],
    )
