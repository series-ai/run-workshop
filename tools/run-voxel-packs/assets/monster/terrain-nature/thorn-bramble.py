"""Thorn bramble thicket, in the Pirate Nation haunted style.

A tangle of thick briar canes that arch over a low root mound: each cane
is a chain of faceted segments (true slopes) in a front or side plane, in
dark blood red and plum (never near-black), with a lit upper edge. Big
bone-white thorns stick out of the canes (true-slope triangles), clusters
of blood-red berries hang under them, and dead leaves in rust, khaki and
sand litter the mound. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
from _life import claw, coords, plan, quad
from _kit import single
from voxgrid import C, Grid

S = (52, 34, 48)
CX, CZ = 26.0, 22.0
# (plane axis, plane coordinate, start, end, height, ramp, shade, skew, reach)
# reach 1 is a full arch rooted at both ends; less is a whip that curls over
# and ends in the air with a pointed tip
CANES = [
    ("z", 13, 6.0, 30.0, 16.0, "blood", 5, 0.15, 1.0),
    ("z", 22, 16.0, 44.0, 21.0, "rust", 4, -0.1, 1.0),
    ("x", 17, 6.0, 30.0, 19.0, "purple", 4, 0.1, 1.0),
    ("x", 31, 12.0, 40.0, 17.0, "blood", 5, 0.15, 1.0),
    ("z", 30, 10.0, 36.0, 14.0, "purple", 4, -0.2, 1.0),
    ("x", 24, 32.0, 2.0, 24.0, "blood", 6, 0.1, 0.72),
    ("z", 8, 42.0, 12.0, 18.0, "rust", 4, 0.0, 0.72),
    ("x", 38, 8.0, 38.0, 16.0, "purple", 4, 0.0, 0.7),
    ("z", 35, 46.0, 18.0, 21.0, "blood", 5, 0.1, 0.68),
    ("x", 10, 36.0, 12.0, 13.0, "rust", 4, 0.0, 0.75),
]


def arch_points(a, b, h, skew, reach=1.0, n=6):
    """Points along a skewed arch from a to b (in the cane's plane), rising
    h above the mound; `reach` < 1 stops it part way (a whip)."""
    pts = []
    for k in range(n + 1):
        t = reach * k / n
        u = a + (b - a) * (t + skew * math.sin(math.pi * t) * 0.5)
        pts.append((u, 2.0 + h * math.sin(math.pi * t) ** 0.8))
    return pts


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    # the root mound, littered with dead leaves
    ring = [(CX + 21 * math.cos(a) * (1 + 0.1 * math.sin(3 * a + 1)), CZ + 17 * math.sin(a) * (1 + 0.1 * math.cos(2 * a))) for a in np.linspace(0, 2 * math.pi, 11)[:-1]]
    mound = plan(g, ring, 0, 3, "skindark", 3, top=[(CX + (x - CX) * 0.8, CZ + (z - CZ) * 0.8) for x, z in ring])
    P.mottle(g, mound, "skindark", 3, cell=2, seed=1)
    for ramp, shade, seed in (("rust", 5, 2), ("khaki", 4, 3), ("sand", 5, 4), ("rust", 4, 5)):
        pnpaint.blotch(g, mound & (Y == 2), ramp, shade, cell=2, chance=0.07, seed=seed)
    # the canes: faceted arches in front and side planes
    thorns, berries = [], []
    for i, (axis, c, a, b, h, ramp, shade, skew, reach) in enumerate(CANES):
        pts = arch_points(a, b, h, skew, reach)
        radii = [1.8, 1.6, 1.4, 1.3, 1.4, 1.6, 1.8] if reach >= 1 else [1.9, 1.7, 1.5, 1.3, 1.1, 0.9, 0.7]
        cane = np.zeros(g.shape, dtype=bool)
        for k, (p0, p1) in enumerate(zip(pts, pts[1:])):
            if axis == "z":
                g.prism("z", quad(p0, p1, radii[k], radii[k + 1], cap=0.6), c - 1, c + 2, C(ramp, shade))
            else:
                g.prism("x", [(v, u) for u, v in quad(p0, p1, radii[k], radii[k + 1], cap=0.6)], c - 1, c + 2, C(ramp, shade))
            cane |= g.solids[-1].mask(g.shape)
        # a lit upper edge and a darker belly (soft ramp), a few bark nicks
        up = np.zeros_like(cane)
        up[:, :-1, :] = g.a[:, 1:, :] == 0
        P.flat(g, cane & up, ramp, shade + 1)
        P.flat(g, cane & ~up & ((P._hash(X + Z, Y, seed=10 + i) % np.uint64(9)) == 0), ramp, shade - 1)
        # thorns: big pale triangles out of the cane, alternating sides
        for k in range(1, len(pts) - 1):
            p0, p1 = pts[k - 1], pts[k + 1]
            du, dv = p1[0] - p0[0], p1[1] - p0[1]
            n = math.hypot(du, dv)
            nu, nv = -dv / n, du / n
            side = 1 if (k + i) % 2 == 0 else -1
            base = pts[k]
            tip = (base[0] + side * nu * 5.0 + du / n * 1.5, base[1] + side * nv * 5.0 + dv / n * 1.5)
            thorns.append((axis, c, base, tip))
            if side < 0 and (k + i) % 4 == 1:
                berries.append((axis, c, (base[0] + side * nu * 2.0, base[1] - 2.5)))
    for axis, c, base, tip in thorns:
        if axis == "z":
            claw(g, "z", base, tip, 1.4, c, c + 1, "bone", 6)
        else:
            claw(g, "x", (base[1], base[0]), (tip[1], tip[0]), 1.4, c, c + 1, "bone", 6)
        m = g.solids[-1].mask(g.shape)
        P.flat(g, m & (Y >= min(base[1], tip[1]) + 2), "bone", 7)
    # berry clusters: three chunky beads each, a highlight on top
    for axis, c, (u, v) in berries:
        for du, dv, dz in ((0, 0, 0), (1.6, -0.8, 1), (-1.2, -1.2, -1)):
            if v + dv < 3:
                continue
            x0 = (u + du) if axis == "z" else (c + dz)
            z0 = (c + dz) if axis == "z" else (u + du)
            y0 = v + dv
            bm = plan(g, [(x0 - 1.2, z0 - 1.2), (x0 + 1.2, z0 - 1.2), (x0 + 1.2, z0 + 1.2), (x0 - 1.2, z0 + 1.2)], y0 - 1.2, y0 + 1.2, "red", 5)
            P.flat(g, bm & (Y >= y0), "red", 6)
            P.flat(g, bm & (Y >= y0) & ((X + Z) % 2 == 0), "red", 7)
    return single("thorn-bramble", "terrain-nature", "Thorn Bramble", g)
