"""Spore tree, in the Pirate Nation tree style.

A tall alien tree, about two and a half people high: a twisting bone-white
trunk of leaning frustums (true slopes) with painted spiral bark ridges,
four sloped roots with glowing tips and a few luminous mushrooms at its
foot; three tiers of drooping purple umbrella caps (faceted frustums)
with magenta rims, pink spots, painted gills underneath, a bud on top and
glowing spore sacs that hang from the rims. The caps sway on `idle`.
Faces -Z.
"""
import math

import numpy as np

from _life import P, Clip, Grid, Rig, asset, box, coords, flat_ngon, gem, light_top, mask_of, ngon_y, quad, side, front, spots, wave
from pnshapes import cone
from voxgrid import C

S = (60, 96, 60)
CX, CZ = 30, 30
# trunk segments: (y0, y1, r0, r1, shift of the top in x, z) — each leans a little
TRUNK = [(0, 8, 8.5, 5.5, 0, 0), (8, 28, 5.5, 4.8, 3, -1), (28, 50, 4.8, 4.0, -4, 2), (50, 70, 4.0, 3.0, 2, -2)]
# caps: (y, radius, height) with the centre on the trunk axis at that height
CAPS = [(30, 21, 7), (50, 18, 7), (70, 14, 8)]


def axis_at(y: float):
    """The trunk centre (x, z) at height y."""
    x, z = CX, CZ
    for y0, y1, _r0, _r1, dx, dz in TRUNK:
        if y >= y1:
            x, z = x + dx, z + dz
        elif y > y0:
            t = (y - y0) / (y1 - y0)
            return x + dx * t, z + dz * t
    return x, z


def trunk() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    x, z = CX, CZ
    start = len(g.solids)
    for y0, y1, r0, r1, dx, dz in TRUNK:
        g.prism("y", flat_ngon(x, z, r0, 8), y0, y1, C("bone", 6), top=flat_ngon(x + dx, z + dz, r1, 8))
        x, z = x + dx, z + dz
    m = mask_of(g, g.solids[start:])
    P.flat(g, m, "bone", 6)
    ang = np.arctan2(Z - CZ, X - CX)
    spiral = m & ((np.floor(ang / (2 * math.pi) * 8 + Y / 9) % 2) == 0)
    P.flat(g, spiral, "bone", 5)
    P.flat(g, m & (np.abs(((ang / (2 * math.pi) * 8 + Y / 9) % 1) - 0.5) < 0.06), "bone", 4)  # ridge lines
    for ky in (18, 41):  # knots
        kx, kz = axis_at(ky)
        P.flat(g, m & (np.hypot(X - kx, Y - ky) < 1.6) & (Z < kz), "bone", 3)
    # four sloped roots with glowing tips
    roots = np.zeros(g.shape, dtype=bool)
    tips = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        roots |= front(g, quad((CX + s * 5, 6), (CX + s * 15, 1.4), 2.2, 1.2), CZ - 1.5, CZ + 1.5, "bone", 5)
        roots |= side(g, quad((6, CZ + s * 5), (1.4, CZ + s * 15), 2.2, 1.2), CX - 1.5, CX + 1.5, "bone", 5)
        tips |= box(g, CX + s * 15 - 1, 0, CZ - 1, CX + s * 15 + 1, 2, CZ + 1, "toxic", 6)
        tips |= box(g, CX - 1, 0, CZ + s * 15 - 1, CX + 1, 2, CZ + s * 15 + 1, "toxic", 6)
    P.flat(g, roots, "bone", 5)
    P.flat(g, tips, "toxic", 7)
    # little luminous mushrooms at the foot
    for k, (mx, mz, ramp) in enumerate(((CX - 10, CZ - 8, "magenta"), (CX + 9, CZ - 10, "cyan"), (CX + 11, CZ + 8, "magenta"), (CX - 7, CZ + 11, "cyan"))):
        box(g, mx - 0.5, 0, mz - 0.5, mx + 1, 3, mz + 1, "bone", 6)
        capm = cone(g, "y", mx + 0.25, mz + 0.25, 2.2, 3, 5, ramp, 6, n=6, r_top=0.8)
        P.flat(g, capm, ramp, 6)
        light_top(g, capm, ramp, 7)
    return g


def caps() -> Grid:
    g = Grid(*S)
    X, Y, Z = coords(g)
    for k, (y, R, h) in enumerate(CAPS):
        cx, cz = axis_at(y)
        rim = ngon_y(g, cx, cz, R, y - 3, y - 1, "magenta", 5, n=10, r_top=R - 0.5)
        roof = ngon_y(g, cx, cz, R - 0.5, y - 1, y - 1 + h, "purple", 5, n=10, r_top=R * 0.28)
        P.flat(g, rim, "magenta", 5)
        P.flat(g, roof, "purple", 5)
        P.flat(g, roof & (Y > y - 1 + h * 0.6), "purple", 6)
        spots(g, roof, "pink", 6, cell=5, r=1.3, chance=2, seed=10 + k)
        # gills under the rim: radial dark lines on the underside
        under = rim & (Y < y - 2)
        ang = np.arctan2(Z - cz, X - cx)
        P.flat(g, under, "purple", 4)
        P.flat(g, under & (np.abs(((ang / (2 * math.pi) * 20) % 1) - 0.5) < 0.15), "purple", 3)
        # a bud on top
        bud = mask_of(g, gem(g, cx, cz, y - 1 + h - 0.5, 2.2, 4.5, "magenta", 6, n=6))
        P.flat(g, bud, "magenta", 6)
        # glowing spore sacs hanging from the rim
        for j in range(4):
            a = 2 * math.pi * (j + 0.3 * k) / 4 + 0.4
            sx, sz = cx + (R - 2.5) * math.cos(a), cz + (R - 2.5) * math.sin(a)
            box(g, sx - 0.5, y - 6, sz - 0.5, sx + 0.5, y - 3, sz + 0.5, "purple", 4)
            sac = mask_of(g, gem(g, sx, sz, y - 9.5, 2.0, 4, "toxic", 6, n=5))
            P.flat(g, sac, "toxic", 6)
            P.flat(g, sac & (Y > y - 7.5), "toxic", 7)
    return g


def build():
    rig = Rig()
    rig.add("spore-tree", trunk(), (CX, 0, CZ))
    rig.add("caps", caps(), (CX, 20, CZ), "spore-tree")
    idle = {"caps": {"rot": wave(4.0, "z", 2.0)}}
    return asset("terrain-nature", "spore-tree", "Spore Tree", rig.root, clips=[Clip("idle", idle)])
