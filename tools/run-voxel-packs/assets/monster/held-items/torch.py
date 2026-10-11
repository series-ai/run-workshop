"""Haunted pitch torch with a rising pumpkin flame in an iron cage.
Held-item frame: +X forward (flame), origin = Hand.R joint."""
import numpy as np

from _kit import C, Grid, held, pfx


def build():
    g = Grid(36, 17, 13)
    cy, cz = 5, 5

    # A dark ironwood haft with a clear, violet-and-moss wrapped handgrip.
    g.box(0, cy - 1, cz - 1, 23, cy + 1, cz + 1, C("darkwood", 4))
    g.box(0, cy, cz - 1, 20, cy + 1, cz, C("darkwood", 5))
    # A short moss leather grip covers the haft faces without making a box.
    g.box(4, cy + 1, cz - 1, 12, cy + 2, cz + 1, C("moss", 3))
    g.box(4, cy - 2, cz - 1, 12, cy - 1, cz + 1, C("moss", 1))
    g.box(4, cy - 1, cz - 2, 12, cy + 1, cz - 1, C("moss", 2))
    g.box(4, cy - 1, cz + 1, 12, cy + 1, cz + 2, C("moss", 2))
    for x in (5, 10):
        # Two narrow violet wraps bind the dark olive handgrip.
        g.box(x, cy + 1, cz - 1, x + 1, cy + 2, cz + 1, C("purple", 3))
        g.box(x, cy - 2, cz - 1, x + 1, cy - 1, cz + 1, C("purple", 2))
        g.box(x, cy - 1, cz - 2, x + 1, cy + 1, cz - 1, C("purple", 3))
        g.box(x, cy - 1, cz + 1, x + 1, cy + 1, cz + 2, C("purple", 2))
    # One magenta knot marks the grip without striping its full length.
    g.box(8, cy + 1, cz - 1, 9, cy + 2, cz + 1, C("magenta", 4))
    for x in (2, 14, 19):
        g.box(x, cy - 2, cz - 2, x + 1, cy + 2, cz + 2, C("iron", 3))
        g.set(x, cy + 1, cz - 1, C("iron", 6))

    # The cage and its broad burner collar form one compact torch head.
    g.box(20, cy - 2, cz - 2, 27, cy - 1, cz + 2, C("iron", 3))
    g.box(21, cy - 1, cz - 3, 26, cy + 1, cz - 2, C("gray", 4))
    g.box(21, cy - 1, cz + 2, 26, cy + 1, cz + 3, C("gray", 3))
    g.box(22, cy + 1, cz - 2, 25, cy + 2, cz + 2, C("iron", 5))
    # Violet cage rails frame the flame base. Bone rivets mark each side.
    g.box(21, cy - 1, cz - 3, 22, cy + 2, cz - 2, C("purple", 4))
    g.box(25, cy - 1, cz + 2, 26, cy + 2, cz + 3, C("purple", 3))
    g.set(23, cy, cz - 3, C("bone", 6)).set(24, cy, cz + 2, C("bone", 5))
    g.box(20, cy - 3, cz - 2, 24, cy - 2, cz + 2, C("iron", 4))
    g.box(20, cy - 3, cz - 1, 22, cy - 2, cz + 1, C("magenta", 4))

    # Make a rising flame mask with a broad foot and two unequal tongues.
    X, Y, Z = np.meshgrid(*(np.arange(n) for n in g.shape), indexing="ij")
    base_y = np.array((6, 7, 8, 9, 10))
    base_xw = np.interp(Y, base_y, (1.5, 2.7, 3.4, 3.2, 2.7))
    base_zw = np.interp(Y, base_y, (1.3, 2.3, 3.0, 2.8, 2.6))
    base_x = 25.5 + 0.12 * (Y - 8)
    base_dx = np.abs(X + 0.5 - base_x)
    base_dz = np.abs(Z + 0.5 - cz)
    base = ((Y >= 6) & (Y <= 10) & (base_dx <= base_xw) & (base_dz <= base_zw)
            & (base_dx / base_xw + base_dz / base_zw <= 1.65))

    tongue_y = np.array((8, 9, 10, 11, 12, 13, 14, 15))
    main_xw = np.interp(Y, tongue_y, (2.8, 2.6, 2.3, 2.0, 1.6, 1.2, 0.8, 0.3))
    main_zw = np.interp(Y, tongue_y, (2.6, 2.5, 2.2, 1.9, 1.5, 1.1, 0.7, 0.3))
    main_x = 26.0 + 0.25 * (Y - 8)
    main_dx = np.abs(X + 0.5 - main_x)
    main_dz = np.abs(Z + 0.5 - cz)
    main = ((Y >= 8) & (Y <= 15) & (main_dx <= main_xw) & (main_dz <= main_zw)
            & (main_dx / main_xw + main_dz / main_zw <= 1.65))

    side_y = np.array((8, 9, 10, 11, 12, 13))
    side_xw = np.interp(Y, side_y, (0.8, 1.0, 1.2, 1.0, 0.7, 0.2))
    side_zw = np.interp(Y, side_y, (0.8, 1.3, 1.4, 1.2, 0.8, 0.2))
    side_x = 23.5 + 0.1 * (Y - 8)
    side_dx = np.abs(X + 0.5 - side_x)
    side_dz = np.abs(Z + 0.5 - cz)
    side = ((Y >= 8) & (Y <= 13) & (side_dx <= side_xw) & (side_dz <= side_zw)
            & (side_dx / side_xw + side_dz / side_zw <= 1.65))
    flame = base | main | side
    dx, dz = np.minimum(main_dx, side_dx), np.minimum(main_dz, side_dz)
    g.a[flame] = C("ember", 3)
    # The outer edge stays dark orange. The upper tongue catches more light.
    edge = ((base & ((base_dx > base_xw - 1) | (base_dz > base_zw - 1)))
            | (main & ((main_dx > main_xw - 1) | (main_dz > main_zw - 1)))
            | (side & ((side_dx > side_xw - 1) | (side_dz > side_zw - 1))))
    g.a[edge] = C("ember", 2)
    g.a[flame & (Y >= 12) & ~edge] = C("ember", 4)

    # A visible toxic core gives the haunted flame a clear focal colour.
    core = flame & (Y >= 7) & (Y <= 12) & (dx <= 1.35) & (dz <= 1.2)
    g.a[core] = C("toxic", 4)
    g.a[core & (dx <= 0.65) & (dz <= 0.65)] = C("toxic", 6)
    # Thin green wisps sit on the front and side surfaces, so each view shows
    # the haunted fire instead of hiding the colour inside the flame.
    front_wisp = (
        (base & (Y >= 8) & (Y <= 10) & (base_dz >= base_zw - 1) & (base_dx <= 1)
         | main & (main_dz >= main_zw - 1) & (main_dx <= 1)
         | side & (side_dz >= side_zw - 1) & (side_dx <= 1))
    )
    side_wisp = (
        (base & (Y >= 8) & (Y <= 10) & (base_dx >= base_xw - 1) & (base_dz <= 1)
         | main & (main_dx >= main_xw - 1) & (main_dz <= 1)
         | side & (side_dx >= side_xw - 1) & (side_dz <= 1))
    )
    g.a[front_wisp | side_wisp] = C("toxic", 5)

    return held("torch", "Pitch Torch", g, (8, cy, cz),
                {"socket-flame": (27, 12, cz)},
                pfx=[pfx("rvx-monster-torch-flame", "socket-flame", "manual",
                         size=0.16, aim=(1.0, 0.0, 0.0))])
