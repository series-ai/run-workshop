"""Crew bunk module, in the Pirate Nation mecha style.

One iconic shape (rule K3): a two-tier sleep module in a thick dark steel
frame (F3). The outer shell is white hull plate with painted seams, a copper
trim band, a hazard-orange stencil block and a cyan light strip, so the back
and the sides are as finished as the front (S1, S4). Each berth is a bright
niche with a teal mattress, a hazard-orange pillow and its own cyan reading
light. A copper ladder with full stiles climbs the open side. Faces -Z.
"""
from __future__ import annotations

import numpy as np

import paint as P
import pnpaint
from _props import dots, hull
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Asset, Grid, Part

# Each mattress is 36 long, so a 36-voxel person fits (Art Director repair).
W, H, D = 42, 40, 20
X0, X1, Z0, Z1 = 0, 42, 0, 20
POST = 3  # corner post thickness
BUNKS = ((6, 16), (22, 32))  # (floor, ceiling) of each berth


def module() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Outer shell: white hull plate on a dark steel frame.
    shell = box(g, X0, 0, Z0, X1, H, Z1, "bone", 6)
    hull(g, shell, "bone", 6, size=(8, 6), edge=3, seed=11)

    # The berths: shallow bright niches open to -Z.
    for y0, y1 in BUNKS:
        niche = P.region(g, X0 + POST, y0, Z0, X1 - POST, y1, Z1 - 9)
        g.carve(niche)
    for y0, y1 in BUNKS:
        back = (g.a != 0) & (Z > Z1 - 10) & (Z < Z1 - 8) & (Y > y0 - 0.5) & (Y < y1)
        P.flat(g, back, "bone", 7)
        hull(g, back, "bone", 7, size=(7, 5), edge=2, seed=3)
        # mattress, pillow and a reading light at the head of the berth
        mat = box(g, X0 + POST, y0, Z0, X1 - POST, y0 + 2, Z1 - 9, "bone", 6)
        P.flat(g, mat & (Y > y0 + 1), "bone", 7)
        blanket = mat & (Z < Z1 - 14)
        P.flat(g, blanket, "teal", 5)
        P.flat(g, blanket & (Y > y0 + 1), "teal", 6)
        P.flat(g, blanket & (Z > Z1 - 16) & (Z < Z1 - 15), "cyan", 6)
        P.flat(g, edges(mat), "steel", 2)
        pil = box(g, X1 - POST - 9, y0 + 2, Z1 - 14, X1 - POST - 1, y0 + 4, Z1 - 9, "orange", 5)
        P.flat(g, pil & (Y > y0 + 3), "orange", 6)
        P.flat(g, edges(pil), "orange", 3)
        lamp = back & (Y > y1 - 3) & (Y < y1 - 1) & (X > X0 + POST + 2) & (X < X1 - POST - 2)
        P.flat(g, lamp, "cyan", 6)
        P.flat(g, lamp & (np.floor(X) % 4 == 0), "cyan", 7)
        # a dark steel deck plate under the mattress ties the berth to the frame
        P.flat(g, (g.a != 0) & (np.abs(Y - (y0 - 0.5)) < 0.6) & (Z < Z1 - 8), "steel", 3)

    # Thick dark corner posts and rails frame every volume (F3, S4).
    posts = np.zeros(g.shape, dtype=bool)
    for x0 in (X0, X1 - POST):
        posts |= box(g, x0, 0, Z0, x0 + POST, H, Z1, "steel", 4)
    posts |= box(g, X0, H - 3, Z0, X1, H, Z1, "steel", 4)
    posts |= box(g, X0, 0, Z0, X1, 4, Z1, "steel", 3)
    for y0, y1 in BUNKS:  # a rail over and under each berth
        posts |= box(g, X0, y0 - 2, Z0, X1, y0, Z1 - 8, "steel", 4)
        posts |= box(g, X0, y1, Z0, X1, y1 + 2, Z1 - 8, "steel", 4)
    P.plates(g, posts, "steel", 4, size=(7, 9))
    P.flat(g, edges(posts), "steel", 2)
    pnpaint.hazard(g, (g.a != 0) & (Y > 0.5) & (Y < 3), period=6, a=("orange", 5), b=("iron", 4), frame="wall")

    # Two storage drawers under the lower berth, with copper pulls.
    for k, (x0, x1) in enumerate(((X0 + POST, 20), (22, X1 - POST))):
        dr = box(g, x0, 4, Z0 - 1, x1, 6, Z1 - 9, "bone", 5)
        P.flat(g, dr & (Z < Z0 + 0.5), "bone", 6)
        P.flat(g, edges(dr), "steel", 2)
        pull = box(g, (x0 + x1) / 2 - 3, 4.5, Z0 - 2, (x0 + x1) / 2 + 3, 5.5, Z0 - 1, "rust", 5)
        P.flat(g, pull, "rust", 5)

    # Back and sides: a copper band, a stencil block and a cyan strip.
    outer = (g.a != 0) & ((Z > Z1 - 1) | (X < X0 + 1) | (X > X1 - 1))
    P.flat(g, outer & (Y > 17) & (Y < 20), "rust", 5)
    P.flat(g, outer & (np.abs(Y - 18.5) < 0.6), "rust", 6)
    strip = outer & (Y > H - 6) & (Y < H - 4)
    P.flat(g, strip, "cyan", 6)
    P.flat(g, strip & (np.floor(X + Z) % 5 == 0), "cyan", 7)
    for xm, face in (((g.a != 0) & (X < X0 + 1), "-x"), ((g.a != 0) & (X > X1 - 1), "+x")):
        P.flat(g, xm & (Y > 26) & (Y < 32) & (Z > 4) & (Z < 14), "orange", 3)
        P.flat(g, xm & (Y > 27) & (Y < 31) & (Z > 5) & (Z < 13), "orange", 5)
        P.flat(g, xm & (Y > 28) & (Y < 30) & (Z > 6) & (Z < 12), "orange", 6)
    dots(g, (g.a != 0) & (Z > Z1 - 1), "+z", [(6.5, 10.5), (9.5, 10.5)], 1.0, "cyan", 6, hi=("cyan", 7))
    dots(g, (g.a != 0) & (Z > Z1 - 1), "+z", [(35.5, 10.5)], 1.0, "orange", 6)
    return g


def ladder() -> Grid:
    """A copper ladder with two full stiles, so every rung is carried."""
    g = Grid(4, 34, 9)
    X, Y, Z = coords(g)
    for z0 in (0, 7):
        st = box(g, 0, 0, z0, 3, 34, z0 + 2, "steel", 4)
        P.flat(g, st & (np.floor(Y) % 6 == 0), "steel", 2)
        P.flat(g, edges(st), "steel", 2)
    for y0 in range(3, 32, 5):
        r = box(g, 0, y0, 2, 3, y0 + 2, 7, "rust", 5)
        P.flat(g, r & (Y > y0 + 1), "rust", 6)
    P.flat(g, (g.a != 0) & (Y > 31), "orange", 5)
    return g


def build() -> Asset:
    root = Part("bunk-bed", module())
    root.add(Part("ladder", ladder(), pivot=(0.0, 0.0, 4.5), at=(float(X1), 3.0, 10.0)))
    return Asset(id="space-props-bunk-bed", pack="space", category="props", name="Crew Bunk Module", root=root)
