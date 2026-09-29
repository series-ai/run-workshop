"""Curved sandbag emplacement, in the Pirate Nation style.

Three courses of fat sandbags in running bond. Each bag is one bevelled
prism (chamfered long edges: true slopes) with painted tied ends and a
stitched seam. The wall is a straight centre run and two short wings
turned back (rule F5), so it curves round the defender. A gap in the top
course is the firing slit. A riveted scrap sheet with hazard stripes leans
on the front; spent shells litter the ground (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, bevel, child, root
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Grid

BL, BW, BH = 9, 6, 3.5  # bag length (x), width (z) and height
TONES = (("sand", 5), ("sand", 6), ("khaki", 6), ("sand", 5), ("wood", 6), ("sand", 6), ("sand", 4))


def bag(g: Grid, x0: float, x1: float, y0: float, z0: float, k: int) -> None:
    ramp, shade = TONES[k % len(TONES)]
    m = bevel(g, "x", y0, z0, y0 + BH, z0 + BW, x0, x1, ramp, shade, ch=1.2)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y > y0 + BH - 1.2), ramp, min(7, shade + 1))  # the lit top
    P.flat(g, m & (Y < y0 + 1), ramp, shade - 1)
    P.flat(g, m & ((X < x0 + 1.2) | (X > x1 - 1.2)), ramp, shade - 1)  # the tucked ends
    P.flat(g, m & ((np.abs(X - x0 - 1.8) < 0.5) | (np.abs(X - x1 + 1.8) < 0.5)), ramp, shade - 2)  # ties
    P.flat(g, m & (Y > y0 + BH - 1.2) & (np.abs(Z - z0 - BW / 2) < 0.5) & (np.floor(X) % 2 == 0) & (X > x0 + 2.5) & (X < x1 - 2.5), ramp, shade - 1)  # stitches


def run(courses: list[list[tuple[float, float]]], k0: int, length: int) -> Grid:
    """A straight run of bags: courses[c] lists the (x0, x1) of its bags."""
    g = Grid(length, 11, BW + 3)
    k = k0
    for c, bags in enumerate(courses):
        for x0, x1 in bags:
            bag(g, x0, x1, c * BH, 1.0 + c * 0.7, k)
            k += 1
    return g


def build():
    centre = run([[(0, 9), (9, 18)], [(0, 4.5), (4.5, 13.5), (13.5, 18)], [(0, 6.5), (11.5, 18)]], 0, 18)
    X, Y, Z = coords(centre)
    for sx, sz in ((3, 0), (12, 0)):  # spent shells in front
        s = box(centre, sx, 0, sz, sx + 2, 1, sz + 1, "gold", 6)
        P.flat(centre, s & (X < sx + 1), "gold", 4)
    r = root("sandbag-wall", centre)
    wing = [[(0, 9)], [(0, 4.5), (4.5, 9)], [(0, 9)]]
    child(r, "wing-left", run(wing, 3, 9), pivot=(9.0, 0.0, 1.0), at_grid=(0.0, 0.0, 1.0), rot=(0.0, 28.0, 0.0))
    child(r, "wing-right", run(wing, 5, 9), pivot=(0.0, 0.0, 1.0), at_grid=(18.0, 0.0, 1.0), rot=(0.0, -28.0, 0.0))
    sheet = Grid(12, 10, 1)
    m = box(sheet, 0, 0, 0, 12, 10, 1, "steel", 5)
    P.plates(sheet, m, "steel", 5, size=(6, 5), seed=3)
    P.flat(sheet, edges(m), "steel", 3)
    Xs, Ys, _ = coords(sheet)
    band = m & (Ys > 6.5)
    P.flat(sheet, band & (((Xs + Ys) // 2) % 2 == 0), "gold", 5)
    P.flat(sheet, band & (((Xs + Ys) // 2) % 2 == 1), "darkwood", 4)
    P.flat(sheet, m & (np.hypot(Xs - 4, Ys - 3.5) < 1.6), "rust", 4)
    child(r, "armour-sheet", sheet, pivot=(6.0, 0.0, 1.0), at_grid=(13.0, 0.0, -1.5), rot=(-16.0, -12.0, 4.0))
    return asset("sandbag-wall", "Sandbag Wall", r)
