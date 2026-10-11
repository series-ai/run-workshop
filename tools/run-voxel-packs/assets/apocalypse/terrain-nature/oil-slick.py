"""An oil slick on broken asphalt, in the Pirate Nation style.

A pool of oil spreads over a patch of cracked asphalt. The pool stands
about 1.5 above the road with a bevelled lip (a true slope, rule F2), so it
reads as liquid on the road and not as a hole. Its surface is a ramp from
dark iron at the lip to a near-black centre, with one thin violet
band and a gold glint (rule S1). A leaking jerry can stands on the dry
asphalt next to the pool, fully inside the pad. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
from _life import blob, ctr, limb, make, plan
from pnkit import box, edges
from voxgrid import Grid, Part

SIZE = (68, 18, 56)
ROAD = 4.0  # the asphalt top
SLICK = [(14, 18), (21, 17), (25, 20), (29, 18), (31, 10), (36, 8), (40, 11), (39, 19), (48, 18), (56, 23), (54, 30),
         (48, 33), (49, 39), (43, 43), (36, 40), (31, 34), (24, 35), (18, 32), (15, 27), (9, 24), (10, 21)]


def edge_distance(X: np.ndarray, Z: np.ndarray, poly) -> np.ndarray:
    """Distance (in x, z) from each voxel centre to the nearest polygon edge."""
    d = np.full(X.shape, np.inf)
    for (ax, az), (bx, bz) in zip(poly, poly[1:] + poly[:1]):
        ex, ez = bx - ax, bz - az
        t = np.clip(((X - ax) * ex + (Z - az) * ez) / (ex * ex + ez * ez), 0, 1)
        d = np.minimum(d, np.hypot(X - ax - t * ex, Z - az - t * ez))
    return d


def build():
    g = Grid(*SIZE)
    X, Y, Z = ctr(g)
    asphalt = blob(34, 28, 31, 24, n=12, jitter=0.08, seed=1)
    slab = plan(g, asphalt, 0, ROAD, "stone", 4, top=[(34 + (x - 34) * 0.97, 28 + (z - 28) * 0.97) for x, z in asphalt])
    PP.concrete(g, slab, "stone", 4, size=12, cracks=8, frame="top", seed=2)
    P.flat(g, slab & (Y < 2), "stone", 3)
    # A faded lane line runs across the road and under the pool.
    lane = slab & (Y > ROAD - 1) & (np.abs(Z - 46 + (X - 34) * 0.05) < 1.0) & (np.floor(X) % 12 < 7)
    P.flat(g, lane, "gold", 4)
    # Painted cracks run out from the pool into the asphalt.
    top = slab & (Y > ROAD - 1)
    for x0, z0, x1, z1 in ((10, 13, 21, 22), (51, 11, 42, 22), (15, 45, 27, 33), (57, 42, 48, 34)):
        n = max(abs(x1 - x0), abs(z1 - z0)) * 2
        for k in range(n + 1):
            t = k / n
            cx, cz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t + 0.8 * np.sin(t * 9)
            P.flat(g, top & (np.abs(X - cx) < 0.6) & (np.abs(Z - cz) < 0.6), "stone", 2)

    # ---- the pool: raised 1.5 with a bevelled lip, then a sheen ramp inward
    cx = sum(p[0] for p in SLICK) / len(SLICK)
    cz = sum(p[1] for p in SLICK) / len(SLICK)
    inset = [(x + (cx - x) * 0.06, z + (cz - z) * 0.06) for x, z in SLICK]
    oil = plan(g, SLICK, ROAD - 0.5, ROAD + 1.5, "iron", 4, top=inset)
    d = edge_distance(X, Z, SLICK)
    P.flat(g, oil, "iron", 4)
    P.flat(g, oil & (d < 1.3), "iron", 6)  # the lip catches the light
    P.flat(g, oil & (d >= 3.0), "iron", 3)
    P.flat(g, oil & (np.abs(d - 4.4) < 0.5), "purple", 2)  # one thin violet band
    P.flat(g, oil & (d >= 6.0), "navy", 3)
    glint = oil & (np.abs((X - 26) * 0.5 - (Z - 26)) < 0.8) & (np.abs(X - 26) < 3.5) & (d > 3)
    P.flat(g, glint, "gold", 6)
    P.flat(g, oil & (np.abs((X - 44) * 0.6 - (Z - 25)) < 0.6) & (np.abs(X - 44) < 2.5) & (d > 3), "teal", 4)

    # ---- a jerry can on the dry asphalt, its spout over the pool
    can = box(g, 53, ROAD, 31, 60, ROAD + 11, 36, "red", 4)
    P.flat(g, can, "red", 4)
    P.flat(g, edges(can), "red", 2)
    for zf in (31, 35):  # a pressed panel on both broad faces
        face = can & (np.floor(Z) == zf) & (Y > ROAD + 1) & (Y < ROAD + 10) & (X > 54) & (X < 59)
        P.flat(g, face, "red", 5)
        P.outline(g, face, "red", 3, normal="z")
    P.flat(g, can & (Y < ROAD + 1.2), "red", 2)
    P.flat(g, can & (Y > ROAD + 10), "red", 5)
    handle = box(g, 55, ROAD + 11, 32, 59, ROAD + 13, 35, "red", 3)
    P.flat(g, handle & (Y > ROAD + 12), "red", 5)
    spout = limb(g, (54.0, ROAD + 10.0, 33.5), (50.5, ROAD + 13.0, 33.5), 1.2, 0.9, "steel", 5, n=6)
    P.flat(g, spout & (X < 51.5), "steel", 3)
    P.flat(g, can & (X < 55) & (Y > ROAD + 6) & (Y < ROAD + 10) & (np.abs(Z - 33.5) < 1), "iron", 4)  # an oil run down the side
    return make("terrain-nature", "oil-slick", "Oil Slick", Part("oil-slick", g))
