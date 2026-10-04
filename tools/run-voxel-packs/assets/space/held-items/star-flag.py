"""Star flag: a white space standard on a long steel staff."""
from _kit import C, Grid, held


def build():
    g = Grid(56, 30, 7)

    # The long staff follows +X. The grip stays low and close to the hand.
    g.box(0, 2, 2, 56, 5, 5, C("steel", 3))
    g.box(0, 3, 2, 56, 4, 5, C("iron", 3))
    g.box(0, 4, 3, 56, 5, 4, C("steel", 6))
    g.box(0, 2, 2, 3, 5, 5, C("iron", 3))
    g.box(1, 4, 3, 2, 5, 4, C("cyan", 6))
    g.box(53, 2, 2, 56, 5, 5, C("iron", 4))
    g.box(54, 4, 3, 55, 5, 4, C("steel", 7))

    # Copper bands sit inside the staff profile. Dark seams make a clear grip.
    g.box(4, 2, 2, 15, 5, 5, C("rust", 4))
    g.box(4, 4, 3, 15, 5, 4, C("rust", 6))
    for x in (5, 8, 11, 14):
        g.box(x, 2, 2, x + 1, 5, 5, C("iron", 2))
        g.box(x, 4, 3, x + 1, 5, 4, C("rust", 5))
    for x in (18, 27, 36):
        g.box(x, 2, 2, x + 1, 5, 5, C("iron", 3))
        g.box(x, 4, 3, x + 1, 5, 4, C("steel", 6))

    # A thin swallowtail plate rises from the staff at its far end.
    # Its dark steel rim stays visible around the white hull inlay.
    outline = [(31, 7), (48, 7), (50, 9), (50, 22), (48, 24),
               (31, 24), (36, 16)]
    field = [(33, 9), (47, 9), (48, 10), (48, 21), (47, 22),
             (33, 22), (37, 16)]
    g.prism("z", outline, 2, 5, C("steel", 2))
    g.prism("z", field, 2, 5, C("bone", 5))

    # The mast and two clamps make the attachment to the staff easy to read.
    g.box(49, 5, 2, 51, 27, 5, C("steel", 4))
    g.box(49, 5, 2, 50, 27, 3, C("iron", 3))
    g.box(48, 6, 1, 53, 8, 6, C("orange", 4))
    g.box(48, 6, 2, 52, 7, 5, C("rust", 6))
    g.box(48, 23, 1, 53, 25, 6, C("orange", 4))
    g.box(48, 24, 2, 52, 25, 5, C("rust", 6))
    g.box(50, 10, 2, 51, 22, 3, C("steel", 6))
    g.box(50, 10, 4, 51, 22, 5, C("steel", 6))

    # Dark teal medallions give the cyan star a strong edge on both faces.
    for z in (2, 4):
        g.prism("z", [(39, 10), (43, 10), (46, 14), (43, 18),
                       (39, 18), (36, 14)], z, z + 1, C("teal", 2))
        # A small white glint and cyan outer star form the focal mark.
        star = ((0, 4), (-1, 3), (0, 3), (1, 3), (-2, 2), (-1, 2),
                (0, 2), (1, 2), (2, 2), (-3, 1), (-2, 1), (-1, 1),
                (0, 1), (1, 1), (2, 1), (3, 1), (-4, 0), (-3, 0),
                (-2, 0), (-1, 0), (0, 0), (1, 0), (2, 0), (3, 0),
                (4, 0), (-3, -1), (-2, -1), (-1, -1), (0, -1),
                (1, -1), (2, -1), (3, -1), (-2, -2), (-1, -2),
                (0, -2), (1, -2), (2, -2), (-1, -3), (0, -3), (1, -3),
                (0, -4))
        for dx, dy in star:
            g.set(41 + dx, 14 + dy, z, C("cyan", 7))
        for dx, dy in ((0, 2), (0, 1), (-1, 0), (0, 0), (1, 0),
                        (0, -1), (0, -2)):
            g.set(41 + dx, 14 + dy, z, C("bone", 7))

        # Copper edge marks and corner bolts finish each painted face.
        for x in range(38, 47, 2):
            g.set(x, 22, z, C("orange", 5))
        for x, y in ((35, 9), (46, 9), (35, 22), (46, 22)):
            g.set(x, y, z, C("rust", 7))

    # Raised mast cap and cyan hinge lights complete the standard hardware.
    g.box(49, 26, 2, 52, 29, 5, C("iron", 2))
    g.box(50, 27, 2, 51, 28, 5, C("orange", 6))
    for z in (1, 5):
        g.set(50, 7, z, C("cyan", 7))
        g.set(50, 24, z, C("cyan", 7))

    return held("star-flag", "Star Flag", g, grip=(8, 3, 3.5),
                sockets={"socket-tip": (55.5, 3.5, 3.5)})
