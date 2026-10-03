"""Blast crater, in the Pirate Nation style.

A raised lip of thrown dirt around a scorched floor: twelve faceted rim
segments with true slopes inside and out, broken slabs of asphalt tossed
onto the lip, a half-buried unexploded shell with a red band and fins,
and a glowing green fallout puddle in the middle. Soot, cracks and the
glow are paint. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import ctr, limb, make, plan, rock, slab
from voxgrid import Grid, Part

N = 58
C0 = N / 2


def build():
    g = Grid(N, 14, N)
    X, Y, Z = ctr(g)
    floor = plan(g, S.flat_ngon(C0, C0, 18.5, 12), 0, 1, "sand", 3)
    # the rim: twelve segments, each a frustum with a sloped outside and inside
    rim = np.zeros(g.shape, dtype=bool)
    ro0, ri0, ro1, ri1 = 27.5, 14.0, 22.5, 19.0
    for k in range(12):
        a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        h = 8 + 2 * math.sin(k * 1.7)
        pt = lambda r, a: (C0 + r * math.cos(a), C0 + r * math.sin(a))  # noqa: E731
        base = [pt(ro0, a0), pt(ro0, a1), pt(ri0, a1), pt(ri0, a0)]
        top = [pt(ro1, a0), pt(ro1, a1), pt(ri1, a1), pt(ri1, a0)]
        rim |= plan(g, base, 0, h, "sand", 5, top=top)
    d = np.hypot(X - C0, Z - C0)
    P.mottle(g, rim, "sand", 5, cell=5, seed=1)
    P.flat(g, rim & (d < 20.5), "sand", 3)  # scorched inner slope
    PP.blotch(g, rim & (d < 21), "sand", 2, cell=4, chance=0.05, seed=2)
    P.flat(g, rim & (d > 24.5) & (Y < 2), "sand", 4)
    # the scorched floor with radial soot and a glowing fallout puddle
    ang = np.arctan2(Z - C0, X - C0)
    P.flat(g, floor & ((np.floor((ang + math.pi) / (math.pi / 10)) % 2) == 0), "sand", 2)
    puddle = plan(g, [(C0 - 7, C0 - 3), (C0 - 2, C0 - 7), (C0 + 6, C0 - 5), (C0 + 7, C0 + 2), (C0 + 2, C0 + 6), (C0 - 5, C0 + 5)], 1, 1.8, "toxic", 6)
    P.flat(g, puddle & (np.hypot(X - C0, Z - C0) < 3), "toxic", 7)
    P.outline(g, puddle, "toxic", 4, normal="y")
    # broken asphalt slabs thrown onto the lip
    for k, (cx, cz, w, ang_deg, ax) in enumerate(((C0 - 21, C0 - 14, 9, 18, "z"), (C0 + 18, C0 + 17, 8, -22, "x"), (C0 + 22, C0 - 12, 7, 14, "z"))):
        s = slab(g, ax, cx if ax == "z" else 7.5, 7.5 if ax == "z" else cz, w if ax == "z" else 2.4, 2.4 if ax == "z" else w, (cz - 4) if ax == "z" else (cx - 4), (cz + 4) if ax == "z" else (cx + 4), ang_deg, "stone", 4)
        PP.concrete(g, s, "stone", 4, size=32, cracks=1, seed=k)
        P.flat(g, s & (np.floor(X + Z) % 9 == 0), "gold", 5)  # a scrap of lane paint
    # a half-buried shell: a leaning finned bomb with a red band
    body = limb(g, (C0 + 7, 1.0, C0 + 9), (C0 + 11, 9.5, C0 + 13), 3.0, 3.0, "khaki", 6, n=8)
    nose = limb(g, (C0 + 11, 9.5, C0 + 13), (C0 + 12.5, 12.5, C0 + 14.5), 3.0, 0.8, "khaki", 5, n=8)
    P.flat(g, body & (Y > 5.5) & (Y < 7.5), "gold", 5)
    P.flat(g, nose, "steel", 6)
    for s in (-1, 1):
        rock(g, C0 + 7 + s * 3, C0 + 9, 0, 2.2, 1.6, 2.5, ramp="sand", shade=4, shrink=0.5, n=5, seed=20 + s)
    return make("terrain-nature", "crater", "Blast Crater", Part("crater", g))
