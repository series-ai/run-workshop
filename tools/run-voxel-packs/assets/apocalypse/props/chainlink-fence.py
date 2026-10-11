"""Chain-link fence section, in the Pirate Nation style.

Two tiles (32) long, so sections line up on the PN grid. Thick teal
vinyl-coated posts with dome caps stand in sand concrete footings at the
section ends; a top rail and a bottom wire run between them. The mesh is
a lattice of true 45° diagonal wires with a torn hole whose wire ends
stop short (rule F2). Outrigger arms carry three barbed strands with a
red rag caught on them; a hazard plate hangs on the mesh a little crooked
(rule F5). Barbs, stains and the plate's mark are paint (rule S1).
"""
import math

import numpy as np

import paint as P
import pnglyph
from _props import asset, child, root, tuft
from pnkit import box, edges
from pnshapes import bar, cone, coords
from voxgrid import C, Grid

L, H = 32, 24  # section length and post height
MZ = 3.0  # mesh plane (z)
X0, X1, Y0, Y1 = 4, 28, 2, 21  # mesh area between the posts and rails
HOLE = (19.0, 8.0, 4.2)  # torn hole centre (x, y) and radius


def clip(x0, y0, dx, dy):
    """The segment of the line (x0, y0) + t(dx, dy) inside the mesh area."""
    ts = []
    for a, lo, hi in ((0, X0, X1), (1, Y0, Y1)):
        p, d = (x0, y0)[a], (dx, dy)[a]
        if abs(d) < 1e-9:
            if not lo <= p <= hi:
                return None
            continue
        ts.append(sorted(((lo - p) / d, (hi - p) / d)))
    t0 = max(t[0] for t in ts)
    t1 = min(t[1] for t in ts)
    return None if t1 - t0 < 1.5 else (t0, t1)


def wires(g: Grid) -> None:
    hx, hy, hr = HOLE
    for s in (1, -1):
        for k in range(-8, 14):
            x0 = X0 + k * 4.0
            span = clip(x0, Y0, s * 1.0, 1.0)
            if span is None:
                continue
            t0, t1 = span
            # split the wire where it crosses the torn hole
            pieces = [(t0, t1)]
            fx, fy = x0 - hx, Y0 - hy
            b = 2 * (fx * s + fy)
            c = fx * fx + fy * fy - hr * hr
            disc = b * b - 8 * c
            if disc > 0:
                ta, tb = (-b - math.sqrt(disc)) / 4, (-b + math.sqrt(disc)) / 4
                pieces = [(p0, p1) for p0, p1 in ((t0, min(t1, ta)), (max(t0, tb), t1)) if p1 - p0 > 1.2]
            for p0, p1 in pieces:
                bar(g, "z", (x0 + s * p0, Y0 + p0), (x0 + s * p1, Y0 + p1), 1.0, MZ, MZ + 1, "teal", 6)


def build():
    g = Grid(L, H + 6, 8)
    X, Y, Z = coords(g)
    # footings, posts and dome caps at both ends
    for px in (1, L - 4):
        f = box(g, px - 1, 0, 1, px + 4, 2, 7, "sand", 5)
        P.flat(g, edges(f), "sand", 4)
        post = box(g, px, 2, 2, px + 3, H, 5, "teal", 5)
        P.flat(g, post & (np.floor(X) == px + 1), "teal", 6)
        cone(g, "y", px + 1.5, 3.5, 2.2, H, H + 2, "teal", 4, r_top=0.9)
    # the top rail and the bottom wire
    rail = box(g, 4, Y1, 2.5, L - 4, Y1 + 2, 4.5, "teal", 5)
    P.flat(g, rail & (Y > Y1 + 1), "teal", 6)
    box(g, 4, 1, 3, L - 4, 2, 4, "teal", 4)
    wires(g)
    # outrigger arms leaning back with three barbed strands
    for px in (1, L - 4):
        bar(g, "x", (H - 1, 3.5), (H + 4, 7.0), 1.6, px + 0.5, px + 2.5, "steel", 5)
    for k, (y, z) in enumerate(((H + 1.0, 4.6), (H + 2.4, 5.6), (H + 3.8, 6.6))):
        s = box(g, 2, y, z, L - 2, y + 1, z + 1, "steel", 6)
        P.flat(g, s & (np.floor(X) % 3 == k % 3), "steel", 3)  # barbs
    # a red rag caught on the barbed wire
    g.prism("z", [(9, H + 3.5), (13, H + 4.0), (12.5, H - 1.5), (11, H + 0.5), (9.5, H - 2)], 5.5, 6.5, C("red", 5))
    for k, tx in enumerate((6, 14, 25)):
        tuft(g, tx, 1 + k % 2, 0, ramp="gold", seed=k)
    r = root("chainlink-fence", g)
    # the hazard plate wired to the mesh
    pg = Grid(13, 12, 1)
    pm = box(pg, 0, 0, 0, 13, 12, 1, "gold", 5)
    P.outline(pg, pm, "red", 4, normal="z")
    pnglyph.icon(pg, "-z", 0, 2, 2, "skull", "darkwood", 4)
    child(r, "plate", pg, pivot=(6.5, 6.0, 1.0), at_grid=(10.0, 12.0, MZ), rot=(0.0, 0.0, 7.0))
    return asset("chainlink-fence", "Chain-Link Fence", r)
