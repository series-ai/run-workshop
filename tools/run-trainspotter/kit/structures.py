"""Platforms, in the trackside frame.

Trackside frame: the origin is on the centre line of the track the piece
stands beside, at ground level and level with that track piece's connector
`a`; the piece runs toward -Z like the track and builds out toward +X. Place
a platform with the same transform as the straight track it serves.

The platform top is PLATFORM_TOP above the ground, level with every
carriage floor, and its edge is PLATFORM_EDGE from the track centre line.
"""
from __future__ import annotations

import numpy as np

import pnpaint
from catalog import plain
from railkit import PLATFORM_EDGE, PLATFORM_TOP, UNIT, C, Grid, P, Part, coords

DEPTH = 64 - PLATFORM_EDGE  # out to the next track lane (x = 64)


def _platform(name: str, length: int, ramp_from: int | None = None) -> tuple[Part, list, list, dict]:
    g = Grid(DEPTH, PLATFORM_TOP, length)
    top = PLATFORM_TOP
    if ramp_from is None:
        g.box(0, 0, 0, DEPTH, top, length, C("stone", 3))
    else:
        # level from the near end (grid z = length) back to ramp_from, then a ramp down
        # to the ground at the far end (grid z = 0): one true slope
        g.prism("x", [(0, 0), (0, length), (top, length), (top, length - ramp_from), (1, 0)], 0, DEPTH, C("stone", 3))
    X, Y, Z = coords(g)
    solid = g.a > 0
    face = solid & (X == 0)  # the face toward the track
    P.stone(g, face, "rust", 4, block=(6, 3))  # brick
    P.flat(g, solid & (Y >= top - 3) & (X < 4), "stone", 6)  # coping
    surface = solid & (Y >= top - 2) & (X >= 4)
    pnpaint.concrete(g, surface, "gray", 5, size=16, cracks=0)
    P.flat(g, surface & (X >= 5) & (X < 7), "gold", 6)  # safety line
    root = Part(name, g, pivot=(-PLATFORM_EDGE, 0, length))
    data = {"kind": "platform", "frame": "trackside", "length": length, "top": PLATFORM_TOP, "edge": PLATFORM_EDGE, "depth": DEPTH}
    return root, [], [], data


def platform_side(name="platform-side"):
    """A straight 64-long platform section beside the track."""
    return _platform(name, UNIT)


def platform_ramp_end(name="platform-ramp-end"):
    """A 64-long platform end: level for 32, then a ramp down to the ground."""
    root, s, c, data = _platform(name, UNIT, ramp_from=UNIT // 2)
    data["ramp"] = True
    return root, s, c, data


ISLAND_SPACING = 2 * 64  # the island stands between tracks two lanes apart


def platform_island(name="platform-island"):
    """A 64-long island platform between two tracks 128 apart: the origin is on
    the first track's centre line, the second track runs at x = 128, and each
    edge is PLATFORM_EDGE from its track."""
    width = ISLAND_SPACING - 2 * PLATFORM_EDGE
    length, top = UNIT, PLATFORM_TOP
    g = Grid(width, top, length)
    g.box(0, 0, 0, width, top, length, C("stone", 3))
    X, Y, Z = coords(g)
    solid = g.a > 0
    for xf in (0, width - 1):  # both faces toward a track
        P.stone(g, solid & (X == xf), "rust", 4, block=(6, 3))
    P.flat(g, solid & (Y >= top - 3) & ((X < 4) | (X >= width - 4)), "stone", 6)  # coping
    surface = solid & (Y >= top - 2) & (X >= 4) & (X < width - 4)
    pnpaint.concrete(g, surface, "gray", 5, size=16, cracks=0)
    P.flat(g, surface & (((X >= 5) & (X < 7)) | ((X >= width - 7) & (X < width - 5))), "gold", 6)  # safety lines
    root = Part(name, g, pivot=(-PLATFORM_EDGE, 0, length))
    data = {"kind": "platform", "frame": "trackside", "length": length, "top": top, "edge": PLATFORM_EDGE,
            "island": True, "trackSpacing": ISLAND_SPACING, "width": width}
    return root, [], [], data


def platform_canopy(name="platform-canopy"):
    """A 64-long platform canopy: a row of slender columns down the middle of a
    side platform carrying a ridged roof with valances. It stands on the
    platform top (its base is PLATFORM_TOP above the ground)."""
    length, top = UNIT, PLATFORM_TOP
    x0, x1 = 26, 64  # roof spans the platform (trackside x)
    cx = 45  # column line
    H = 44
    g = Grid(x1 - x0 + 2, top + H, length)
    X, Y, Z = coords(g)
    gx = lambda x: x - x0 + 1  # noqa: E731  trackside x -> grid x
    for zc in (8, 40):  # columns every 32, so sections repeat evenly
        g.box(gx(cx) - 1, top, zc - 1, gx(cx) + 1, top + 36, zc + 1, C("blood", 3))
        g.box(gx(cx) - 2, top, zc - 2, gx(cx) + 2, top + 2, zc + 2, C("iron", 3))  # base
        g.box(gx(cx) - 2, top + 33, zc - 2, gx(cx) + 2, top + 36, zc + 2, C("blood", 4))  # capital
    # beam along the column heads, then the roof: two slopes meeting over the columns
    g.box(gx(cx) - 2, top + 36, 0, gx(cx) + 2, top + 38, length, C("blood", 4))
    g.prism("z", [(gx(x0), top + 37), (gx(cx), top + 43), (gx(x1) - 1, top + 37), (gx(x1) - 1, top + 39),
                  (gx(cx), top + 44 - 0.01), (gx(x0), top + 39)], 0, length, C("bone", 5))
    roof = (g.a > 0) & (Y >= top + 37)
    P.flat(g, roof & (Y >= top + 42), "stone", 3)  # ridge strip
    # valances: a dagger-board fringe hanging along both roof edges
    for xe in (gx(x0), gx(x1) - 2):
        g.box(xe, top + 33, 0, xe + 1, top + 38, length, C("bone", 6))
        P.flat(g, (X == xe) & (Y == top + 33) & (Z % 4 < 2), "bone", 6)
        g.a[(X == xe) & (Y == top + 33) & (Z % 4 >= 2)] = 0
    root = Part(name, g, pivot=(-x0 + 1, 0, length))
    data = {"kind": "canopy", "frame": "trackside", "length": length, "standsOn": "platform", "base": top}
    return root, [], [], data


CATALOG = [
    plain("stations-platforms", platform_side, "terrain-nature", "kit", "structures", tier="slice"),
    plain("stations-platforms", platform_ramp_end, "terrain-nature", "kit", "structures", tier="slice"),
    plain("stations-platforms", platform_island, "terrain-nature", "kit", "structures"),
    plain("stations-platforms", platform_canopy, "props", "kit", "structures"),
]
