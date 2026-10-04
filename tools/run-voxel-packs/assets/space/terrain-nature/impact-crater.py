"""Impact crater, in the Pirate Nation space style.

A broken, layered impact basin surrounds a raised molten meteorite. Steel
under-ribs, white hull-like rim plates, cyan fissures and hazard marks make
the crater read as a surveyed impact site. No clips. Faces -Z.
"""
import math

import numpy as np

from _life import P, Grid, Rig, asset, coords, flat_ngon, light_top, mask_of, ngon_y, rock
from voxgrid import C

S = (60, 16, 60)
CX, CZ = 30, 30
R_IN, R_OUT, R_RIDGE = 12.0, 22.0, 16.0
N = 10


def crater() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    apron = ngon_y(g, CX, CZ, 28, 0, 2, "sand", 5, n=N, r_top=26.5)
    ang = np.arctan2(Z - CZ, X - CX)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, apron, "sand", 5)
    P.flat(g, apron & (Y < 1), "sand", 3)  # dark, stepped ejecta edge
    P.flat(g, apron & (Y >= 1) & (rr > 25.2), "steel", 3)
    P.flat(g, apron & (Y >= 1) & (rr > 23.2) & (rr <= 25.2), "sand", 5)
    ray_bands = np.zeros_like(apron)
    for ray_angle in (-2.5, -0.9, 0.7, 2.3):
        ray_delta = (ang - ray_angle + math.pi) % (2 * math.pi) - math.pi
        ray_bands |= (np.abs(ray_delta) < 0.09) & (rr > R_OUT + 1) & (rr < 26)
    P.flat(g, apron & (Y >= 1) & ray_bands, "bone", 6)
    P.flat(g, apron & (Y >= 1) & (rr < R_IN + 1), "sand", 3)  # scorched bowl
    P.flat(g, apron & (Y >= 1) & (rr < R_IN + 1) & (np.abs(((ang / (2 * math.pi) * 10) % 1) - 0.5) < 0.1), "rust", 4)
    # Lower wall panels leave four broad impact breaks in the silhouette.
    outer = flat_ngon(CX, CZ, R_OUT, N)
    inner = flat_ngon(CX, CZ, R_IN, N)
    ridge_o = flat_ngon(CX, CZ, R_RIDGE + 1.2, N)
    ridge_i = flat_ngon(CX, CZ, R_RIDGE - 1.2, N)
    start = len(g.solids)
    wall_tops = (7, 7, 5, 7, 7, 5, 7, 5, 7, 5)
    for k in range(N):
        j = (k + 1) % N
        g.prism("y", [outer[k], outer[j], inner[j], inner[k]], 2, wall_tops[k], C("steel", 4), top=[ridge_o[k], ridge_o[j], ridge_i[j], ridge_i[k]])
    rim = mask_of(g, g.solids[start:])
    P.flat(g, rim, "steel", 4)
    P.plates(g, rim, "steel", 4, size=(9, 5), rivets=True, seed=12)
    P.flat(g, rim & (rr < R_RIDGE - 0.5), "steel", 3)  # shaded inner wall
    P.flat(g, rim & (Y < 4), "steel", 2)
    # Cyan monitor slits break up the long dark wall.
    monitor = rim & (Y >= 4) & (Y <= 5) & (rr < R_RIDGE - 0.5) & (np.abs(np.sin(ang * 5 + 0.4)) < 0.12)
    P.flat(g, monitor, "cyan", 5)
    P.flat(g, monitor & (np.floor(X + Z) % 3 == 0), "plasma", 7)
    # White armor caps sit on six sections. Open gaps show the broken rim.
    for k in (0, 1, 3, 4, 6, 8):
        j = (k + 1) % N
        g.prism("y", [ridge_o[k], ridge_o[j], ridge_i[j], ridge_i[k]], 7, 8, C("bone", 6))
        cap = g.solids[-1].mask(g.shape)
        P.flat(g, cap & (rr > R_RIDGE), "bone", 5)
        P.flat(g, cap & (rr < R_RIDGE), "bone", 7)
    # Copper hazard plates mark the most exposed crest sections.
    for k in (1, 6):
        j = (k + 1) % N
        g.prism("y", [ridge_o[k], ridge_o[j], ridge_i[j], ridge_i[k]], 8, 9, C("orange", 5))
        P.flat(g, g.solids[-1].mask(g.shape), "orange", 5)
    # Larger debris groups make the broken silhouette read at a glance.
    for k, (a, rad, size, h) in enumerate(((0.15, 22, 4.2, 5), (0.48, 24, 3.2, 4), (2.15, 21, 4.8, 6), (2.48, 24, 3.0, 4), (4.15, 22, 4.2, 5), (5.35, 21, 3.5, 5))):
        bx, bz = CX + rad * math.cos(a), CZ + rad * math.sin(a)
        b = mask_of(g, rock(g, bx, bz, 2, size, h, "gray", 5, n=6, seed=20 + k))
        P.flat(g, b, "steel", 4)
        light_top(g, b, "gray", 6)
        # A few broad strata marks follow the visible rock faces.
        Xb, Yb, Zb = coords(g)
        P.flat(g, b & (np.abs(Yb - (4 + k % 2)) < 0.6), "gray", 3)
    # Raised molten core: its faceted crown clears the high rim.
    glow = apron & (rr < 8.5)
    P.flat(g, glow & (Y >= 1), "ember", 3)
    P.flat(g, glow & (Y >= 1) & (rr < 6), "orange", 4)
    core = mask_of(g, rock(g, CX, CZ, 3, 6.2, 12, "iron", 5, n=7, seed=9))
    P.flat(g, core, "iron", 5)
    crack = core & ((np.abs(Y - 8 - np.sin((X + Z) * 0.7) * 1.7) < 0.8) | ((np.abs(X - CX - np.sin(Y * 0.7) * 1.2) < 0.8) & (Y > 6)))
    P.flat(g, crack, "orange", 6)
    P.flat(g, crack & (Y > 9), "gold", 7)
    light_top(g, core & ~crack, "iron", 6)
    # Cyan survey fissures cross the inner bowl and meet the core glow.
    fissures = apron & (Y >= 1) & (rr > 7) & (rr < 12) & ((np.abs(Z - CZ - 0.28 * (X - CX)) < 0.8) | (np.abs(Z - CZ + 0.52 * (X - CX) + 3) < 0.8))
    P.flat(g, fissures, "cyan", 5)
    P.flat(g, fissures & (np.floor(X + Z) % 3 == 0), "plasma", 7)
    return g


def build():
    rig = Rig()
    rig.add("impact-crater", crater(), (CX, 0, CZ))
    return asset("terrain-nature", "impact-crater", "Impact Crater", rig.root)
