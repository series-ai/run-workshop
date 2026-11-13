"""Operating table, in the Pirate Nation haunted style.

A surgeon's slab for a monster laboratory: a riveted iron top tilted head
up (a true slope) on four braced legs, with a blood-stained channel and
drain, a bone pillow and three purple leather straps with gold buckles. A
lower shelf carries a toxic-green specimen jar, a saw and a bowl of
instruments; a bucket catches the drip under the drain. An oversized iron
lamp on a jointed arm leans over the slab (rules F4 and F6) and throws a
toxic glow down the table. socket-lamp sits under its reflector. The slab
runs along x; faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _kit import pfx, world
from _props import idx, union
from pnkit import box, edges
from voxgrid import C, Grid, Part, Socket, bounds_pivot

W, H, D = 40, 38, 22
CX = 20.0
TOP = (3.0, 15.0, 35.0, 18.5)  # x0, y at x0, x1, y at x1 (the tilted slab)
SHELF = 6.0
LAMP = (31.0, 30.0, 10.0)  # reflector centre


def slab(g: Grid) -> None:
    """The tilted iron top: riveted plates, a blood channel and drain, a
    bone pillow at the head and three strapped-down leather bands."""
    X, Y, Z = idx(g)
    x0, y0, x1, y1 = TOP
    g.prism("z", [(x0, y0), (x1, y1), (x1, y1 + 3), (x0, y0 + 3)], 3, 19, C("gray", 4))
    top = S.last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.plates(gg, mm, "gray", 4, size=(7, 6), frame=fr, seed=1))
    P.flat(g, top & edges(top), "gray", 2)
    # the upper surface: plate seams, the blood channel down the middle and
    # old stains that have soaked into the iron
    surf = top & (Y + 0.5 > y0 + 1.6 + (X + 0.5 - x0) * (y1 - y0) / (x1 - x0))
    P.flat(g, surf, "gray", 5)
    P.flat(g, surf & (((X.astype(int) + 2) % 8) == 0), "gray", 4)
    P.flat(g, surf & ((Z < 4) | (Z > 17)), "gray", 4)
    chan = surf & (np.abs(Z + 0.5 - 11.0) < 1.6)
    P.flat(g, chan, "gray", 3)
    for sx, sz, rx, rz in ((15.0, 8.5, 4.0, 2.5), (23.0, 13.5, 3.0, 2.0), (8.0, 12.5, 2.5, 1.8)):
        P.flat(g, surf & (((X + 0.5 - sx) / rx) ** 2 + ((Z + 0.5 - sz) / rz) ** 2 < 1), "blood", 4)
        P.flat(g, surf & (((X + 0.5 - sx) / (rx * 0.5)) ** 2 + ((Z + 0.5 - sz) / (rz * 0.5)) ** 2 < 1), "blood", 3)
    P.flat(g, chan & (X + 0.5 < 11), "blood", 4)
    P.flat(g, surf & (np.hypot(X + 0.5 - 5.0, Z + 0.5 - 11.0) < 2.2), "gray", 2)  # the drain
    P.flat(g, surf & (np.hypot(X + 0.5 - 5.0, Z + 0.5 - 11.0) < 1.1), "blood", 3)
    # a bone pillow at the head end
    pil = box(g, 29, 18, 6, 35, 20, 16, "bone", 7)
    P.mottle(g, pil, "bone", 7, cell=2, seed=2)
    P.flat(g, pil & (Y < 19), "bone", 4)
    P.flat(g, pil & edges(pil), "bone", 3)
    P.flat(g, pil & (Y >= 19) & (np.hypot(X + 0.5 - 32.0, Z + 0.5 - 11.0) < 2.6), "blood", 4)
    # three purple leather straps across the slab, with gold buckles
    for sx in (9.0, 18.0, 27.0):
        sy = y0 + (sx - x0) * (y1 - y0) / (x1 - x0)
        band = box(g, sx, sy - 1, 2, sx + 3, sy + 4, 20, "purple", 4)
        P.flat(g, band & (((Z.astype(int)) % 4) == 0), "purple", 3)
        P.flat(g, band & (Z < 3.5), "purple", 2)
        P.flat(g, band & (Y > sy + 2.4) & (Z > 12) & (Z < 16), "gold", 5)


def legs(g: Grid) -> None:
    """Four riveted iron legs with diagonal braces and a lower plank shelf."""
    X, Y, Z = idx(g)
    posts = np.zeros(g.shape, dtype=bool)
    for lx in (4.0, 31.0):
        for lz in (4.0, 15.0):
            posts |= box(g, lx, 0, lz, lx + 4, 16, lz + 3, "gray", 4)
    P.plates(g, posts, "gray", 3, size=(5, 6), seed=3)
    P.flat(g, posts & (Y < 1.5), "gray", 2)
    P.flat(g, posts & (Y > 14), "gray", 5)
    for lz in (4.5, 15.5):  # a diagonal brace each side (a true slope)
        S.bar(g, "z", (6.0, 2.5), (33.0, 10.0), 2.0, lz, lz + 2, "gray", 5)
    shelf = box(g, 3, SHELF, 3, 36, SHELF + 2, 19, "wood", 4)
    P.planks(g, shelf, "wood", 4, width=4, across="x", nails=True, seed=4)
    P.flat(g, shelf & (Y < SHELF + 1), "wood", 2)


def kit(g: Grid) -> None:
    """The shelf load: a glowing specimen jar, a bone saw, a bowl of
    instruments and a bucket under the drain."""
    X, Y, Z = idx(g)
    # the specimen jar: a glass drum with a toxic brew and a floating eye
    jar = S.disc(g, "y", 28.0, 11.0, 3.4, SHELF + 2, SHELF + 11, "toxic", 5)
    P.flat(g, jar & (Y > SHELF + 9), "bone", 6)  # the lid
    P.flat(g, jar & (Y > SHELF + 3) & (Y < SHELF + 9) & (S.ngon_radius(g, "y", 28.0, 11.0) > 2.6), "toxic", 4)
    P.flat(g, jar & (np.hypot(X + 0.5 - 27.0, Y + 0.5 - (SHELF + 6)) < 1.6) & (Z < 9.5), "bone", 7)
    P.flat(g, jar & (np.hypot(X + 0.5 - 27.0, Y + 0.5 - (SHELF + 6)) < 0.8) & (Z < 9.5), "purple", 2)
    S.disc(g, "y", 28.0, 11.0, 3.8, SHELF + 11, SHELF + 12, "gray", 5)
    # a bone saw leaning on the shelf, and a shallow bowl of blades
    g.prism("y", [(10.0, 6.0), (20.0, 6.0), (20.0, 8.5), (10.0, 8.5)], SHELF + 2, SHELF + 3, C("gray", 6))
    saw = S.last(g)
    P.flat(g, saw & ((X.astype(int) % 2) == 0) & (Z < 7), "gray", 3)
    box(g, 9, SHELF + 2, 5.5, 12, SHELF + 4, 9, "wood", 3)  # the saw handle
    bowl = S.cone(g, "y", 15.0, 15.0, 2.2, SHELF + 2, SHELF + 5, "gray", 6, r_top=3.6)
    P.flat(g, bowl & (Y > SHELF + 3.5), "blood", 4)
    for bx in (13.5, 15.5, 17.0):
        box(g, bx, SHELF + 4, 13.5, bx + 1, SHELF + 5, 17.0, "steel", 6)
    # a bucket under the drain, catching the drip
    start = len(g.solids)
    g.prism("y", S.flat_ngon(5.5, 11.0, 2.6, 8), 0, 5, C("wood", 4), top=S.flat_ngon(5.5, 11.0, 3.4, 8))
    buck = union(g, start)
    P.flat(g, buck & ((Y == 1) | (Y == 3)), "gray", 5)
    P.flat(g, buck & (Y == 4) & (S.radial(g, "y", 5.5, 11.0) < 2.6), "blood", 4)


def lamp(g: Grid) -> None:
    """The oversized theatre lamp: a jointed iron arm off the head leg and a
    faceted reflector with a toxic-green bulb, leaning over the slab."""
    X, Y, Z = idx(g)
    lx, ly, lz = LAMP
    S.bar(g, "z", (33.0, 16.0), (35.0, 32.0), 2.4, 15.0, 17.5, "gray", 4)  # the mast
    S.bar(g, "x", (31.5, 16.0), (31.5, 10.5), 2.2, 33.5, 36.0, "gray", 4)  # the elbow out over the slab
    S.bar(g, "z", (34.0, 31.5), (lx, ly + 3.0), 2.0, 10.0, 12.0, "gray", 5)  # the arm
    box(g, 33, 15, 14, 37, 18, 18, "gray", 6)
    cup = S.cone(g, "y", lx, lz, 2.2, ly, ly + 6, "gray", 4, n=8, r_top=8.0)
    rr = S.ngon_radius(g, "y", lx, lz)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.plates(gg, mm, "gray", 4, size=(6, 4), frame=fr, seed=5))
    P.flat(g, cup & (Y > ly + 4.5), "gray", 6)
    P.flat(g, cup & (Y < ly + 1.5), "bone", 7)  # the white reflector throat, seen from below
    P.flat(g, cup & (Y >= ly + 5) & (rr > 7.0), "gray", 2)  # a dark rim round the shade
    bulb = S.disc(g, "y", lx, lz, 3.4, ly - 3, ly + 1, "toxic", 6)
    P.flat(g, bulb & (Y < ly - 0.5), "toxic", 7)
    P.flat(g, bulb & (Y < ly - 2), "bone", 7)
    box(g, lx - 1.5, ly + 6, lz - 1.5, lx + 1.5, ly + 8, lz + 1.5, "gray", 5)


def build():
    g = Grid(W, H, D)
    legs(g)
    slab(g)
    kit(g)
    lamp(g)
    root = Part("operating-table", g, pivot=bounds_pivot(g))
    px, py, pz = bounds_pivot(g)
    at = (LAMP[0] - px, LAMP[1] - 2.5 - py, LAMP[2] - pz)
    return world("operating-table", "props", "Operating Table", root,
                 sockets=[Socket("socket-lamp", at=at)],
                 pfx=[pfx("rvx-monster-ghost-lantern", "socket-lamp", "idle", size=22)])
