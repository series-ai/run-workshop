"""Reaper's scythe: a forged crescent blade on a wrapped ironwood snath.
Held-item frame: +X forward, origin = Hand.R joint."""
import math

import numpy as np

from _kit import C, Grid, held, pfx
from _kit import xyz


def build():
    g = Grid(56, 30, 5)
    cy, cz = 4, 2

    # A readable charcoal haft, built from broad planes rather than speckle.
    for x in range(0, 43):
        bend = round(math.sin(x / 43 * math.pi) * 1.0)
        g.box(x, cy + bend, cz - 1, x + 1, cy + bend + 2, cz + 2, C("iron", 4))
        g.box(x, cy + bend + 2, cz - 1, x + 1, cy + bend + 3, cz + 2, C("iron", 5))
        g.box(x, cy + bend, cz - 1, x + 1, cy + bend + 3, cz, C("iron", 3))

    # Violet leather grip with raised magenta lacing and dark end wraps.
    g.box(6, cy - 1, cz - 1, 17, cy + 4, cz + 2, C("purple", 3))
    for x in (5, 7, 10, 13, 16, 18):
        g.box(x, cy - 1, cz - 1, x + 1, cy + 4, cz + 2, C("iron", 5))
    for x in (8, 11, 14):
        g.box(x, cy - 1, cz - 1, x + 1, cy, cz + 2, C("magenta", 4))
        g.box(x, cy + 3, cz - 1, x + 1, cy + 4, cz + 2, C("magenta", 5))

    # Short cross peg at the hand and iron ferrules at both ends of the haft.
    g.box(18, cy - 2, cz - 1, 20, cy + 4, cz + 2, C("darkwood", 3))
    g.box(18, cy - 2, cz - 1, 20, cy - 1, cz + 2, C("iron", 5))
    g.box(3, cy - 1, cz - 1, 5, cy + 4, cz + 2, C("iron", 6))
    g.box(39, cy - 1, cz - 1, 42, cy + 4, cz + 2, C("iron", 6))
    g.box(40, cy, cz, 41, cy + 3, cz + 1, C("orange", 4))

    # The bone socket surrounds the blade root. Nothing extends through the haft.
    g.box(42, cy - 1, cz - 1, 47, cy + 4, cz + 2, C("bone", 5))
    g.box(43, cy - 1, cz - 1, 46, cy + 4, cz + 2, C("bone", 6))
    g.box(44, cy - 2, cz, 45, cy + 5, cz + 1, C("bone", 4))
    # Fill a swept crescent in the XY plane. Its broad middle reads at thumbnail
    # size; both ends taper, and the cutting edge follows the outer curve.
    x, y, z = xyz(g)
    t = (y + 0.5 - 7.0) / 20.0
    tc = np.clip(t, 0.0, 1.0)
    hook = np.clip((tc - 0.55) / 0.45, 0.0, 1.0)
    spine_x = 45.0 - 22.0 * np.sin(tc * math.pi / 2) + 10.0 * hook**2
    width = 0.8 + 7.0 * (np.sin(math.pi * tc) ** 0.85)
    inner_x = spine_x + width
    blade = (t >= 0.0) & (t <= 1.0) & (x + 0.5 >= spine_x) & (x + 0.5 <= inner_x) & (z >= 0) & (z < 5)
    g.where(blade, C("steel", 5))
    spine = blade & (x + 0.5 < spine_x + 1.25)
    g.where(spine, C("iron", 5))
    bright_face = blade & (x + 0.5 > spine_x + width * 0.38) & (x + 0.5 < inner_x - 1.0) & (z >= 3)
    g.where(bright_face, C("steel", 6))
    cutting_edge = blade & (x + 0.5 >= inner_x - 1.0)
    g.where(cutting_edge & (z >= 3), C("toxic", 2))
    # Blood-rust marks a short run of the outer spine near the tip.
    blood_edge = blade & (x + 0.5 <= spine_x + 0.75) & (t > 0.55) & (t < 0.9)
    g.where(blood_edge, C("blood", 4))
    g.where(blood_edge & (z == 0), C("blood", 3))

    # A small orange maker's mark sits on the raised socket face.
    g.set(44, cy + 2, cz + 1, C("orange", 6)).set(45, cy + 2, cz + 1, C("orange", 4))

    return held("reaper-scythe", "Reaper's Scythe", g, (8, cy + 1, cz + 0.5),
                {"socket-blade": (38, 22, 2.5)},
                pfx=[pfx("rvx-monster-reaper-slash", None, "manual", size=0.352,
                         aim=(-1.0, 0.0, 0.0), offset=(-0.117, 0.03, 0.11))])
