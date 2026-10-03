"""Impact crater, in the Pirate Nation terrain style.

A wide regolith crater: a raised rim of ten sloped segments of uneven
height (true slopes inside and out) on a flat dusty apron with pale
ejecta rays, a darker bowl, a few boulders on the rim, and a cracked
meteorite in the middle that still glows ember orange through its
cracks, with a scorched glow ring around it. No clips. Faces -Z.
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
    apron = ngon_y(g, CX, CZ, 28, 0, 1, "sand", 5, n=N)
    ang = np.arctan2(Z - CZ, X - CX)
    rr = np.hypot(X - CX, Z - CZ)
    P.flat(g, apron, "sand", 5)
    rays = apron & (rr > R_OUT - 1) & (np.abs(((ang / (2 * math.pi) * 7 + 0.3) % 1) - 0.5) < 0.12)
    P.flat(g, rays, "sand", 7)
    P.flat(g, apron & (rr < R_IN + 1), "sand", 4)  # the darker bowl
    P.flat(g, apron & (rr < R_IN + 1) & (np.abs(((ang / (2 * math.pi) * 10) % 1) - 0.5) < 0.1), "sand", 3)
    # the rim: ten sloped segments of uneven height
    heights = [8, 9, 8, 8, 9, 8, 7, 8, 9, 8]
    outer = flat_ngon(CX, CZ, R_OUT, N)
    inner = flat_ngon(CX, CZ, R_IN, N)
    ridge_o = flat_ngon(CX, CZ, R_RIDGE + 1.2, N)
    ridge_i = flat_ngon(CX, CZ, R_RIDGE - 1.2, N)
    start = len(g.solids)
    for k in range(N):
        j = (k + 1) % N
        g.prism("y", [outer[k], outer[j], inner[j], inner[k]], 1, heights[k], C("sand", 5), top=[ridge_o[k], ridge_o[j], ridge_i[j], ridge_i[k]])
    rim = mask_of(g, g.solids[start:])
    P.flat(g, rim, "sand", 5)
    P.flat(g, rim & (rr < R_RIDGE - 0.5), "sand", 4)  # the shaded inner wall
    light_top(g, rim & (Y > 5), "sand", 6)
    P.flat(g, rim & (Y < 2.5) & (rr > R_RIDGE), "sand", 4)
    # boulders on the rim
    for k, a in enumerate((0.3, 2.2, 4.1, 5.3)):
        bx, bz = CX + (R_OUT - 1) * math.cos(a), CZ + (R_OUT - 1) * math.sin(a)
        b = mask_of(g, rock(g, bx, bz, 1, 2.8, 4 + k % 2, "gray", 5, n=6, seed=20 + k))
        P.flat(g, b, "gray", 5)
        light_top(g, b, "gray", 6)
    # the glowing meteorite core
    glow = apron & (rr < 7.5)
    P.flat(g, glow, "ember", 3)
    P.flat(g, glow & (rr < 5.5), "ember", 4)
    core = mask_of(g, rock(g, CX, CZ, 0, 5.5, 8, "iron", 5, n=7, seed=9))
    P.flat(g, core, "iron", 5)
    crack = core & ((np.abs(Y - 4 - np.sin((X + Z) * 0.7) * 1.2) < 0.7) | ((np.abs(X - CX - np.sin(Y * 1.1) * 0.9) < 0.7) & (Y > 4)))
    P.flat(g, crack, "ember", 3)
    light_top(g, core & ~crack, "iron", 6)
    return g


def build():
    rig = Rig()
    rig.add("impact-crater", crater(), (CX, 0, CZ))
    return asset("terrain-nature", "impact-crater", "Impact Crater", rig.root)
