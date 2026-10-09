"""Broken asphalt slabs fold into a deep, dry sinkhole."""
import math
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import blob, ctr, make, plan, rock
from pnkit import edges
from voxgrid import C, Grid, Part

SIZE = (88, 24, 84)
CX, CZ = 44.0, 42.0


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    bed = blob(CX, CZ, 41, 38, n=12, jitter=0.07, seed=1)
    slab = plan(g, bed, 0, 4, "stone", 4)
    PP.concrete(g, slab, "stone", 4, size=14, cracks=9, frame="top", seed=2)
    # The hole is a dark basin. Broken rim blocks lean toward it on sloped faces.
    d = np.hypot(X - CX, Z - CZ)
    P.flat(g, slab & (d < 21), "darkwood", 4)
    rim = np.zeros(g.shape, bool)
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12+0.01, 2 * math.pi * (k + 1) / 12-0.01
        pt = lambda r, a: (CX + r * math.cos(a), CZ + r * math.sin(a))
        base = [pt(23+(k%3), a0), pt(40-(k%4), a0), pt(40-((k+1)%4), a1), pt(23+((k+1)%3), a1)]
        top = [pt(22, a0), pt(35, a0), pt(35, a1), pt(22, a1)]
        rim |= plan(g, base, 3, 7 + (k % 4)*2, "stone", 5, top=top)
    P.stone(g, rim, "stone", 5, block=(7, 5), seed=3)
    P.flat(g, rim & (d < 27), "darkwood", 4)
    P.flat(g, rim & (d > 35) & (Y < 5), "sand", 4)
    # Four road slabs remain on the lip, each with a separate fractured edge.
    slabs = (
        [(5, 8), (28, 7), (31, 21), (10, 27)],
        [(53, 4), (81, 8), (76, 23), (57, 20)],
        [(4, 58), (25, 55), (31, 73), (9, 78)],
        [(59, 63), (81, 58), (83, 79), (59, 77)],
    )
    for k, points in enumerate(slabs):
        m = plan(g, points, 4, 7, "stone", 5, top=[(CX + (x - CX) * 0.92, CZ + (z - CZ) * 0.92) for x, z in points])
        PP.concrete(g, m, "stone", 5, size=8, cracks=3, frame="top", seed=10 + k)
        P.flat(g, edges(m), "darkwood", 5)
        for x0, z0 in (points[0], points[2]):
            P.flat(g, m & (np.abs(X - x0) < 2) & (np.abs(Z - z0) < 2), "gold", 5)
    # A broken sewer pipe drops into the pit with a rusted rim.
    pipe = S.disc(g, "z", CX + 3, 9, 8, 28, 51, "steel", 4, n=8)
    P.flat(g, pipe & (np.hypot(X - CX - 3, Y - 9) < 5.5), "darkwood", 4)
    P.flat(g, pipe & (np.abs(Z - 28) < 1), "rust", 5)
    for k, (cx, cz, r) in enumerate(((9, 42, 4), (79, 43, 5), (47, 9, 3.5))):
        rock(g, cx, cz, 3, r, r * 0.8, 5, "sand", 5, shrink=0.55, n=6, seed=20 + k)
    return make("terrain-nature", "sinkhole", "Road Sinkhole", Part("sinkhole", g))
