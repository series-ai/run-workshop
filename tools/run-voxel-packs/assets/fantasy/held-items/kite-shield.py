"""Kite shield with a royal-blue enamel face, gold sun crest and wood grip.

The long axis stays on +X in the PN held-item frame. The face points +Y.
"""
from _kit import held
from voxgrid import C, Grid


L, W = 34, 22
CZ = W / 2


def _half_width(x):
    """A broad shoulder that tapers to one clean, centered point."""
    if x < 3:
        return (7.5, 9.5, 10.5)[x]
    if x <= 15:
        return 10.5
    return max(0.5, 10.5 * (L - 1 - x) / (L - 1 - 15))


def _inside(x, z):
    if x < 0 or x >= L or z < 0 or z >= W:
        return False
    return abs(z + 0.5 - CZ) <= _half_width(x)


def build():
    g = Grid(L, 6, W)
    outline = set()
    second_rim = set()

    # The shield is a solid wood core with a dark iron edge and a steel band.
    # Face and reverse are painted separately, so every visible surface reads.
    for x in range(L):
        for z in range(W):
            if not _inside(x, z):
                continue
            edge = any(not _inside(x + dx, z + dz)
                       for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            near_edge = not edge and any(
                not _inside(x + dx, z + dz)
                for dx, dz in ((2, 0), (-2, 0), (0, 2), (0, -2),
                               (1, 1), (1, -1), (-1, 1), (-1, -1)))
            if edge:
                outline.add((x, z))
            elif near_edge:
                second_rim.add((x, z))

            # Timber core and steel sidewall between the painted faces.
            g.set(x, 2, z, C("darkwood", 3))
            side = C("iron", 5) if edge else C("steel", 4) if near_edge else C("wood", 3)
            g.set(x, 3, z, side)
            g.set(x, 4, z, C("blue", 4))

            # The reverse is stained wood, with a dark perimeter.
            back = C("iron", 5) if edge else C("darkwood", 4)
            g.set(x, 2, z, back)

    # A one-pixel dark outline and an even silver band frame the blue enamel.
    for x, z in outline:
        g.set(x, 4, z, C("iron", 4))
    for x, z in second_rim:
        g.set(x, 4, z, C("steel", 5))
    for x, z in outline | second_rim:
        g.set(x, 2, z, C("iron", 5))

    # A narrow gold pinstripe separates the enamel from its steel frame.
    for x in range(L):
        for z in range(W):
            if not _inside(x, z) or (x, z) in outline or (x, z) in second_rim:
                continue
            if any((x + dx, z + dz) in second_rim
                   for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g.set(x, 4, z, C("gold", 3))

    # Small gold rivets follow both shoulders at regular intervals.
    for x in range(2, 29, 4):
        for z in range(W):
            near_side = abs(z + 0.5 - CZ) >= _half_width(x) - 2.5
            if (x, z) in second_rim and near_side:
                g.set(x, 4, z, C("gold", 5))
                g.set(x, 2, z, C("gold", 4))

    # A bold sun mark uses a dark outline, a gold face and one red jewel.
    sun_rows = (
        "....#....",
        "...###...",
        "..#####..",
        "##.###.##",
        "#########",
        "##.###.##",
        "..#####..",
        "...###...",
        "....#....",
    )
    sun_cells = set()
    cx = 14
    z0 = 7
    for row, line in enumerate(sun_rows):
        for col, char in enumerate(line):
            if char == "#":
                sun_cells.add((cx + row - 4, z0 + col))
    dark_cells = set()
    for x, z in sun_cells:
        for dx, dz in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            if (x + dx, z + dz) not in sun_cells and _inside(x + dx, z + dz):
                dark_cells.add((x + dx, z + dz))
    for x, z in dark_cells:
        g.set(x, 4, z, C("navy", 3))
    for x, z in sun_cells:
        g.set(x, 4, z, C("gold", 5))
    for x, z in sun_cells:
        if x == cx:
            g.set(x, 4, z, C("gold", 6))
    g.set(cx, 4, 11, C("red", 5))

    # Back grip and two broad leather straps attach directly to the shield.
    g.box(10, 0, 9, 20, 2, 13, C("darkwood", 3))
    g.box(11, 0, 9, 19, 1, 13, C("wood", 4))
    for x in (9, 20):
        g.box(x, 1, 6, x + 2, 2, 16, C("rust", 3))
        g.box(x, 1, 8, x + 2, 2, 14, C("rust", 4))
        g.set(x, 1, 7, C("gold", 5))
        g.set(x, 1, 15, C("gold", 5))
    # Grip wraps and their dark seams remain visible from the back.
    for x in (12, 14, 16, 18):
        for z in range(9, 13):
            g.set(x, 1, z, C("rust", 2))

    return held(
        "kite-shield",
        "Heraldic Kite Shield",
        g,
        (15, 0.5, CZ),
        {"socket-face": (18, 5, CZ)},
        [{"effectId": "rvx-fantasy-metal-clang", "socket": "socket-face",
          "trigger": "manual", "size": 0.32}],
    )
