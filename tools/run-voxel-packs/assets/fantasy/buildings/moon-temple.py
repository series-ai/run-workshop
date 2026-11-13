"""Moon Temple in the RUN fantasy pack.

A high stone sanctuary: a framed stone plinth, four banded round pillars at
the corners, tall blue-glass windows in gold frames, wide front steps to a
blue door, a blue ring roof with a cone and a cyan crystal finial, and a
red pennant. The body is the same as the first build; only the crest
changed.

The crest is a bright crescent moon set flush on the front wall between
the door and the roof band, with a soft sky-blue glow painted on the
stone round it. It stays inside the wall line, clear of the corner
pillars. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _life import asset, coords, crystal, pfx
from pnkit import box, edges, pennant
from voxgrid import C, Grid, Part, Socket

W, H, D = 96, 112, 96
WALL_Z = 24  # the front face of the sanctuary wall
MOON = (48.0, 55.5)  # the crescent centre (x, y) on the front wall
MOON_R = 9.5


def _base(g: Grid, x0: int, x1: int, z0: int, z1: int, top: int = 4) -> np.ndarray:
    """Build a low, framed stone pad with clear courses."""
    g.prism("y", [(x0 + 3, z0), (x1 - 3, z0), (x1, z0 + 3), (x1, z1 - 3),
                   (x1 - 3, z1), (x0 + 3, z1), (x0, z1 - 3), (x0, z0 + 3)],
            0, top, C("stone", 5),
            top=[(x0 + 4, z0 + 1), (x1 - 4, z0 + 1), (x1 - 1, z0 + 4), (x1 - 1, z1 - 4),
                 (x1 - 4, z1 - 1), (x0 + 4, z1 - 1), (x0 + 1, z1 - 4), (x0 + 1, z0 + 4)])
    m = S.last(g)
    P.stone(g, m, "stone", 5, block=(6, 3), cracks=0.02, seed=x0 + z0)
    P.flat(g, edges(m), "stone", 2)
    P.flat(g, m & (np.indices(g.shape)[1] == top - 1), "stone", 6)
    return m


def crescent_poly(cx: float, cy: float, r: float, n: int = 10) -> list[tuple[float, float]]:
    """A crescent outline (x, y) with its horns to +x: the outer arc of a
    circle of radius r, closed by the arc of a second circle that is moved
    right. One concave polygon (the mesher accepts concave caps)."""
    cx2, r2 = cx + 0.55 * r, 0.8 * r
    # The horns are where the two circles cross.
    d = cx2 - cx
    hx = (d * d + r * r - r2 * r2) / (2 * d)
    hy = math.sqrt(max(0.0, r * r - hx * hx))
    a_out = math.atan2(hy, hx)
    a_in = math.atan2(hy, hx - d)
    outer = [(cx + r * math.cos(a), cy + r * math.sin(a))
             for a in np.linspace(a_out, 2 * math.pi - a_out, n + 1)]
    inner = [(cx2 + r2 * math.cos(a), cy + r2 * math.sin(a))
             for a in np.linspace(2 * math.pi - a_in, a_in, n + 1)[1:-1]]
    return outer + inner


def crest(g: Grid) -> None:
    """The bright crescent and its soft glow on the front wall."""
    X, Y, Z = coords(g)
    cx, cy = MOON
    # The glow follows the crescent: a signed distance to the outer disc
    # minus the bite, so the bite stays plain stone and the moon never
    # reads as a full disc.
    d_out = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) - MOON_R
    d_bite = 0.8 * MOON_R - np.sqrt((X - (cx + 0.55 * MOON_R)) ** 2 + (Y - cy) ** 2)
    sd = np.maximum(d_out, d_bite)
    skin = (g.a > 0) & (np.abs(Z - WALL_Z) < 1.5) & (Y > 46) & (Y < 65)  # the wall face between the string courses
    # The wide glow stays on the round (-x) side of the moon, so the halo
    # is a soft C that follows the crescent and does not close into a disc.
    rim_side = (d_bite < 1.5) & (X < cx + 0.25 * MOON_R)
    P.flat(g, skin & rim_side & (d_out < 5.0), "sky", 5)  # the outer glow ring
    P.flat(g, skin & rim_side & (d_out < 2.5), "sky", 6)
    P.flat(g, skin & (sd < 1.0), "sky", 7)
    g.prism("z", crescent_poly(cx, cy, MOON_R), WALL_Z - 3, WALL_Z, C("bone", 7))
    moon = S.last(g)
    P.flat(g, moon & (Z > WALL_Z - 2), "gold", 6)  # the side faces
    inner = ((X - (cx + 0.55 * MOON_R)) ** 2 + (Y - cy) ** 2) < (0.8 * MOON_R + 1.0) ** 2
    P.flat(g, moon & inner & (Z < WALL_Z - 2), "gold", 7)  # the lit inner edge
    # Two small gold stars sit in the glow beside the horns.
    for sx, sy in ((cx + 9, cy + 7), (cx + 11, cy - 3)):
        box(g, sx - 1, sy - 1, WALL_Z - 1, sx + 1, sy + 1, WALL_Z, "gold", 7)


def build():
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    _base(g, 18, 78, 18, 78, 6)
    # A high stone sanctuary with a ring roof and a clear entrance.
    walls = box(g, 24, 6, 24, 72, 70, 72, "stone", 5)
    P.mottle(g, walls, "stone", 5, cell=5, seed=44)
    P.flat(g, edges(walls), "darkwood", 3)
    for x in (22, 70):
        for z in (22, 70):
            S.disc(g, "y", x, z, 5, 6, 75, "stone", 5, n=8)
            P.flat(g, (g.a > 0) & (np.abs(X - x) < 5) & (np.abs(Z - z) < 5) & (Y % 12 < 2), "blue", 5)
    # Wide steps and a dark doorway make the temple function legible.
    for y, z0, z1 in ((1, 10, 22), (3, 14, 24), (5, 18, 26)):
        box(g, 35, y, z0, 61, y + 2, z1, "stone", 5)
    box(g, 40, 6, 20, 56, 42, 25, "darkwood", 4)
    box(g, 42, 8, 19, 54, 40, 22, "blue", 2)
    P.flat(g, (g.a > 0) & (X >= 42) & (X < 54) & (Y % 8 < 1) & (Z < 23), "gold", 5)
    for x in (28, 66):
        S.disc(g, "y", x, 17, 4, 6, 22, "gold", 5, n=8)
        S.disc(g, "y", x, 17, 2.4, 20, 24, "cyan", 6, n=8)
    S.disc(g, "y", 48, 48, 29, 69, 76, "blue", 5, n=12)
    S.disc(g, "y", 48, 48, 24, 76, 82, "blue", 4, n=12)
    S.disc(g, "y", 48, 48, 8, 81, 87, "gold", 6, n=10)
    for y in (12, 43, 65):
        box(g, 23, y, 23, 73, y + 3, 73, "stone", 6)
    for z in (35, 53):
        for x in (22, 72):
            box(g, x, 25, z, x + 2, 57, z + 11, "gold", 5)
            pane = box(g, x - 1 if x == 22 else x + 1, 28, z + 2, x + 1 if x == 22 else x + 3, 54, z + 9, "blue", 5)
            P.flat(g, pane & ((Y.astype(int) % 8 == 0) | ((Z - z).astype(int) == 5)), "cyan", 6)
    for x in (32, 54):
        box(g, x, 25, 72, x + 10, 57, 74, "gold", 5)
        box(g, x + 2, 28, 73, x + 8, 54, 75, "blue", 5)
    S.cone(g, "y", 48, 48, 22, 77, 99, "blue", 5, n=8)
    S.paint_facets(g, [g.solids[-1]],
                   lambda grid, face, frame: P.tiles(
                       grid, face, "blue", 5, row=4, width=5,
                       frame=frame, seed=17))
    crystal(g, 48, 48, 96, 3, 6, 5, "cyan", 6, n=6)
    pennant(g, 22, 70, 40, 18, 12, "red", 5)
    # The crescent is the oversized function emblem above the door.
    crest(g)
    return asset("buildings", "moon-temple", "Moon Temple", Part("moon-temple", g),
                 sockets=[Socket("socket-function", at=(48, 86, 48))],
                 fx=[pfx("rvx-fantasy-arcane-orbit", "socket-function", "idle", size=22)])
