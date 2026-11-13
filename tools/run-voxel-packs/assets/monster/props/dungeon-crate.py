"""A haunted stack of marked, iron-bound crates and a blood keg.

Chunky crates use calm, horizontal painted boards, heavy dark corners and
iron straps. Bone skulls mark every side. A large toxic flask crowns the
askew top crate; the keg stands clear of the stack.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _props import idx, prop
from pnkit import box, crate, edges
from voxgrid import C, Grid, Part


def paint_boards(g: Grid, mask: np.ndarray, x0: int, y0: int, z0: int, size: int) -> None:
    """Paint broad, quiet horizontal boards on the outer crate faces."""
    X, Y, Z = idx(g)
    edge = edges(mask)
    faces = (
        mask & (Z == z0), mask & (Z == z0 + size - 1),
        mask & (X == x0), mask & (X == x0 + size - 1),
    )
    for face in faces:
        inner = face & ~edge
        row = (Y - y0) // 4
        shade = np.choose(row % 4, [4, 5, 4, 6])
        P.flat(g, inner, "wood", 4)
        for tone in range(4, 7):
            P.flat(g, inner & (shade == tone), "wood", tone)
        seam = face & (((Y - y0) % 4) == 0)
        P.flat(g, seam, "wood", 3)

    # Keep exposed lids in the same calm board pattern as the sides.
    lid = mask & (Y == y0 + size - 1)
    inner_lid = lid & ~edge
    row = (Z - z0) // 4
    shade = np.choose(row % 4, [4, 5, 4, 6])
    P.flat(g, inner_lid, "wood", 4)
    for tone in range(4, 7):
        P.flat(g, inner_lid & (shade == tone), "wood", tone)
    P.flat(g, lid & (((Z - z0) % 4) == 0), "wood", 3)


def mark_crate(g: Grid, mask: np.ndarray, x0: int, y0: int, z0: int, size: int,
               faces=("-z", "+z", "-x", "+x")) -> None:
    """Paint a bone skull on each upright face of one crate."""
    P.flat(g, edges(mask), "wood", 3)
    X, Y, Z = idx(g)
    sides = mask & ((X == x0) | (X == x0 + size - 1) | (Z == z0) | (Z == z0 + size - 1))
    band_y = (Y == y0 + 3) | (Y == y0 + size - 4)
    P.flat(g, sides & band_y, "iron", 4)
    inset = max(1, (size - 9) // 2)
    low = y0 + max(2, (size - 8) // 2)
    for face, plane, u0 in (
        ("-z", z0, x0 + inset), ("+z", z0 + size, x0 + inset),
        ("-x", x0, z0 + inset), ("+x", x0 + size, z0 + inset),
    ):
        if face not in faces:
            continue
        pnglyph.icon(g, face, plane, u0, low, "skull", "bone", 6, depth=2,
                     inks={"o": ("darkwood", 2)})


def build():
    g = Grid(40, 30, 18)
    z0 = 2

    # Two low crates form a stepped base. Their dark frames stay visible.
    for x, z, base in ((1, z0, 5), (16, z0 + 1, 4)):
        m = crate(g, x, 0, z, 14, ramp="wood", frame="wood", base=base, seed=1)
        paint_boards(g, m, x, 0, z, 14)
        mark_crate(g, m, x, 0, z, 14)

    # The keg sits on the open ground in front of the stack.
    S.drum(g, 35, 6.5, 0, 11, 4.0, ramp="wood", base=5, hoop="iron",
           band=("red", 4), wear=False)
    pnglyph.icon(g, "top", 11, 32, 2, "cross", "bone", 6, depth=2)

    root = prop("dungeon-crate", "Dungeon Crates", g)
    piv = root.root.pivot

    # A turned top crate breaks the rigid stack and carries an oversized flask.
    t = Grid(14, 23, 14)
    tm = crate(t, 1, 0, 1, 12, ramp="wood", frame="wood", base=5, seed=3)
    paint_boards(t, tm, 1, 0, 1, 12)
    mark_crate(t, tm, 1, 0, 1, 12, faces=("-x", "+x"))

    # A vivid toxic drop repeats on both broad faces.
    dm = pnglyph.icon(t, "-z", 1, 3, 2, "drop", "toxic", 6, depth=2,
                 inks={"+": ("bone", 7)})
    pnglyph.icon(t, "+z", 13, 3, 2, "drop", "toxic", 6, depth=2,
                 inks={"+": ("bone", 7)})
    P.outline(t, dm, "purple", 4, normal="z")

    # The bottle is wide and tall enough to read at thumbnail size.
    S.disc(t, "y", 7, 7, 3.5, 12, 17, "toxic", 5)
    S.disc(t, "y", 7, 7, 1.8, 17, 20, "toxic", 6)
    S.disc(t, "y", 7, 7, 2.4, 17, 18, "magenta", 5)
    box(t, 6, 20, 6, 8, 22, 8, "wood", 6)
    TX, TY, TZ = idx(t)
    P.flat(t, (t.a > 0) & (TY == 21) & (TX == 6), "bone", 6)

    top = Part("top-crate", t, pivot=(7.0, 0.0, 7.0),
               at=(12 - piv[0], 14 - piv[1], z0 + 8 - piv[2]),
               rot=(0.0, 12.0, 0.0))
    root.root.add(top)
    return root
