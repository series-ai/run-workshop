"""Vampire hunter's stake: a whittled ash stake with a violet-wrapped
grip, a framed silver ferrule and a fire-hardened point.
Held-item frame: +X forward (point), origin = Hand.R joint."""
import numpy as np

from _kit import C, Grid, held, pfx


def build():
    g = Grid(28, 5, 5)

    # A solid ash haft runs from the pommel to the point.
    g.box(0, 1, 1, 9, 4, 4, C("wood", 4))
    g.box(0, 1, 1, 2, 4, 4, C("wood", 2))  # dark butt

    # Violet leather bands wrap the narrow grip. Dark seams frame each band.
    g.box(2, 1, 1, 9, 4, 4, C("purple", 4))
    for x in (2, 5, 8):
        g.box(x, 1, 1, x + 1, 4, 4, C("purple", 2))
    for x in (3, 6):
        g.box(x, 1, 1, x + 1, 4, 4, C("magenta", 5))

    # A dark steel rim frames the lighter ferrule. Rivets and a toxic rune
    # are painted on the visible sides of the collar.
    g.box(9, 0, 0, 11, 5, 5, C("gray", 2))
    g.box(10, 1, 1, 11, 4, 4, C("steel", 5))
    g.set(10, 0, 2, C("bone", 6)).set(10, 4, 2, C("bone", 6))
    for z in (0, 4):
        g.set(10, 1, z, C("toxic", 5))
        g.set(10, 2, z, C("toxic", 7))
        g.set(10, 3, z, C("toxic", 5))

    # One true, even taper runs from a broad base to the centered point.
    # It keeps a broad stake base and has no separate terminal voxel.
    g.prism("x", [(0, 0), (5, 0), (5, 5), (0, 5)], 11, 28, C("wood", 4),
            top=[(2.5, 2.5)] * 4)

    # Paint each exposed face. Grain runs along the upper face of the blade.
    X, Y, Z = np.meshgrid(np.arange(28), np.arange(5), np.arange(5), indexing="ij")
    blade = (X >= 11) & (g.a != 0)
    upper = np.zeros_like(blade)
    lower = np.zeros_like(blade)
    upper[:, :-1, :] = blade[:, :-1, :] & ~blade[:, 1:, :]
    upper[:, -1, :] = blade[:, -1, :]
    lower[:, 1:, :] = blade[:, 1:, :] & ~blade[:, :-1, :]
    lower[:, 0, :] = blade[:, 0, :]
    g.a[upper] = C("wood", 5)
    g.a[lower] = C("wood", 3)
    grain = upper & (Z == 2) & ((X % 6 == 2) | (X % 6 == 3))
    g.a[grain] = C("wood", 3)

    return held("wooden-stake", "Wooden Stake", g, (5, 2.5, 2.5), {"socket-tip": (27.5, 2.5, 2.5)},
                pfx=[pfx("rvx-monster-holy-burst", "socket-tip", "manual", size=0.3)])
