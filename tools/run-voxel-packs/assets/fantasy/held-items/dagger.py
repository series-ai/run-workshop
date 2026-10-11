"""Assassin's dagger: a tapered steel blade with a cyan rune, a gold
socket and guard, and a wrapped warm-wood grip. Blade along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(24, 9, 3)
    cy, cz = 4, 1

    # Wheel pommel, with a small red jewel on both broad faces.
    g.box(0, cy - 2, cz - 1, 2, cy + 3, cz + 2, C("gold", 4))
    g.box(0, cy - 1, cz - 1, 1, cy + 2, cz + 2, C("gold", 6))
    for z in (cz - 1, cz + 1):
        g.set(0, cy, z, C("red", 5))

    # Solid wood core. Full-width leather bands sit on the core without gaps.
    g.box(2, cy - 1, cz - 1, 7, cy + 2, cz + 2, C("wood", 4))
    for x in (2, 4, 6):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 2, cz + 2, C("navy", 3))
    # A fine gold end ring joins the grip to the guard.
    g.box(7, cy - 2, cz - 1, 8, cy + 3, cz + 2, C("gold", 5))

    # Shaped quillons and a compact socket keep the guard joined to the blade.
    g.box(8, cy - 3, cz - 1, 9, cy + 4, cz + 2, C("iron", 5))
    g.box(7, cy - 3, cz - 1, 9, cy - 2, cz + 2, C("steel", 6))
    g.box(7, cy + 3, cz - 1, 9, cy + 4, cz + 2, C("steel", 6))
    g.box(8, cy - 1, cz - 1, 10, cy + 2, cz + 2, C("gold", 5))
    g.box(9, cy, cz - 1, 10, cy + 1, cz + 2, C("cyan", 4))

    # A broad leaf profile narrows into a long, unmistakable point.
    g.prism("z", [(10, cy - 2), (14, cy - 3), (18, cy - 3), (24, cy),
                   (18, cy + 3), (14, cy + 3), (10, cy + 2)],
            cz - 1, cz + 2, C("steel", 5))

    # Bright bevels follow the cutting profile on both broad faces.
    for z in (cz - 1, cz + 1):
        for x in range(10, 24):
            if x < 14:
                edge_rows = (cy - 2, cy + 1)
            elif x < 18:
                edge_rows = (cy - 3, cy + 2)
            elif x < 22:
                edge_rows = (cy - 2, cy + 1)
            elif x < 23:
                edge_rows = (cy - 1, cy)
            else:
                edge_rows = (cy,)
            for y in edge_rows:
                g.set(x, y, z, C("steel", 7))
    # A short cyan fuller and gold rune mark the broad blade face.
    for z in (cz - 1, cz + 1):
        for x in range(11, 21):
            g.set(x, cy, z, C("sky", 5))
        for x, y in ((15, cy), (16, cy + 1), (17, cy), (16, cy - 1)):
            g.set(x, y, z, C("gold", 6))

    return held("dagger", "Assassin's Dagger", g, (3.5, cy, cz + 0.5),
                {"socket-tip": (23, cy, cz + 0.5)},
                [{"effectId": "rvx-fantasy-slash-arc", "trigger": "manual", "size": 0.146,
                  "aim": [-1.0, 0.0, 0.0], "offset": [-0.049, 0.03, 0.0]}])
