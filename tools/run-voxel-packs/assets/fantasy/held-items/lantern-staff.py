"""Pilgrim's lantern staff: a carved darkwood crook with a bright iron cage.
The staff points along +X."""
from _kit import held
from voxgrid import C, Grid


def build():
    g = Grid(34, 12, 9)
    cy, cz = 7, 4

    # A broad, capped shaft with painted grip wraps and a shaped ferrule.
    g.box(0, cy - 1, cz - 1, 24, cy + 1, cz + 2, C("darkwood", 4))
    g.box(1, cy, cz - 1, 22, cy + 1, cz + 2, C("darkwood", 5))
    g.box(2, cy - 1, cz - 1, 22, cy, cz + 2, C("wood", 4))
    for x in (4, 12, 20):
        # Flush leather wraps break the shaft into clear grip sections.
        g.box(x, cy - 1, cz - 1, x + 1, cy + 1, cz + 2, C("sand", 4))
    # Fine grain stays painted on the near-facing shaft surface.
    for x in (7, 14, 17):
        g.set(x, cy - 1, cz - 1, C("wood", 5))
        g.set(x + 1, cy - 1, cz - 1, C("darkwood", 3))
    g.box(0, cy - 2, cz - 2, 2, cy + 1, cz + 3, C("iron", 4))
    g.box(0, cy - 1, cz - 2, 1, cy, cz - 1, C("gold", 5))

    # The crook bends down into a stout, riveted hanging ring.
    g.box(23, cy - 1, cz - 1, 26, cy + 1, cz + 2, C("darkwood", 4))
    g.box(25, cy - 2, cz - 1, 28, cy + 1, cz + 2, C("darkwood", 4))
    g.box(27, cy - 3, cz - 1, 30, cy, cz + 2, C("darkwood", 4))
    g.box(28, 4, cz - 1, 31, 7, cz + 2, C("iron", 4))
    g.box(29, 4, cz, 30, 7, cz + 1, C("gold", 5))
    g.box(28, 3, cz - 1, 31, 5, cz + 2, C("iron", 5))

    # Lantern: a stepped roof, reinforced cage, warm glass and a weighted base.
    lx, lz = 27, 2
    g.box(lx + 1, 6, lz + 1, lx + 5, 7, lz + 5, C("iron", 4))

    # Frame corners leave a readable glowing window on each side.
    for x in (lx, lx + 5):
        for z in (lz, lz + 4):
            g.box(x, 2, z, x + 1, 6, z + 1, C("iron", 4))
    g.box(lx, 2, lz + 1, lx + 6, 3, lz + 5, C("iron", 3))
    g.box(lx, 5, lz + 1, lx + 6, 6, lz + 5, C("iron", 5))
    g.box(lx + 1, 3, lz, lx + 5, 5, lz + 1, C("ember", 4))
    g.box(lx + 1, 3, lz + 4, lx + 5, 5, lz + 5, C("ember", 4))
    g.box(lx, 3, lz + 1, lx + 1, 5, lz + 5, C("ember", 5))
    g.box(lx + 5, 3, lz + 1, lx + 6, 5, lz + 5, C("ember", 5))

    # Paint a pointed flame on both window faces. The dark red field frames it.
    for face_z in (lz, lz + 4):
        g.box(lx + 1, 3, face_z, lx + 5, 5, face_z + 1, C("red", 3))
        g.set(lx + 2, 3, face_z, C("red", 5))
        g.set(lx + 3, 3, face_z, C("orange", 5))
        g.set(lx + 4, 3, face_z, C("red", 5))
        g.set(lx + 3, 4, face_z, C("orange", 7))
        g.set(lx + 3, 5, face_z, C("gold", 7))
    # Match the same flame on the two narrow windows.
    for face_x in (lx, lx + 5):
        g.box(face_x, 3, lz + 1, face_x + 1, 5, lz + 4, C("red", 3))
        g.set(face_x, 3, lz + 2, C("red", 5))
        g.set(face_x, 3, lz + 3, C("orange", 5))
        g.set(face_x, 3, lz + 4, C("red", 5))
        g.set(face_x, 4, lz + 3, C("orange", 7))
        g.set(face_x, 5, lz + 3, C("gold", 7))

    # Faceted lower rim, dark foot and small corner rivets finish the box.
    g.box(lx, 1, lz, lx + 6, 2, lz + 6, C("iron", 4))
    g.box(lx + 1, 0, lz + 1, lx + 5, 1, lz + 5, C("darkwood", 3))
    g.box(lx + 2, 0, lz + 2, lx + 4, 1, lz + 4, C("iron", 5))
    for x in (lx, lx + 5):
        for z in (lz, lz + 4):
            g.set(x, 5, z, C("gold", 6))
    # A metal bail wraps the crook end and lands on the lantern cap.
    for face_z in (lz, lz + 4):
        g.box(28, 6, face_z, 31, 7, face_z + 1, C("iron", 5))
        g.box(30, 4, face_z, 31, 6, face_z + 1, C("gold", 5))
        g.set(29, 6, face_z, C("gold", 6))

    return held("lantern-staff", "Lantern Staff", g, (6.5, cy, cz),
                {"socket-light": (31.5, 3, cz)},
                [{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-light",
                  "trigger": "manual", "size": 0.12, "aim": [1.0, 0.0, 0.0]}])
