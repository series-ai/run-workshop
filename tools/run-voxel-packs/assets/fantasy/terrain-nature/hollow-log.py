"""Hollow log in the Pirate Nation style.

A fallen trunk, 21 thick and 40 long, that lies along z so its hollow end
looks at the viewer. The section is a rough 11-sided ring (round, not a
crate): eleven bark staves between an outer and an inner 11-gon, each a
true-slope prism with a slightly different end, so the cut ends break
like old wood. Bark is painted as long furrowed plates (rule S1); the cut
ends carry growth rings; the hollow inside is dark and gets darker toward
the middle. A broken branch stub, a moss blanket on the top, a shelf
fungus, toadstools and ferns finish it on an oval patch of turf. About
40 wide and 25 tall. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnshapes as S
from _fterrain import fern, ground, moss_drape, noise, outline
from _kit import prop
from _life import coords, facet_paint, front, grass, limb, plan
from voxgrid import Grid

SZ = (42, 30, 56)
CX = 20.0  # the log axis (x)
N = 11
R_OUT, R_IN = 10.0, 6.4  # flat radii of the bark ring
CY = 0.8 + R_OUT  # the axis height: the flat bottom stave sinks into the turf
Z0, Z1 = 7.0, 47.0  # the log ends
G = 2  # the turf top


def rings():
    """The outer and inner 11-gons (x, y), flat side down; the outer one is
    a little uneven, like real bark."""
    rng = np.random.default_rng(5)
    outer = S.flat_ngon(CX, CY, R_OUT, N, -math.pi / 2)
    inner = S.flat_ngon(CX, CY, R_IN, N, -math.pi / 2)
    jit = 0.94 + 0.12 * rng.random(N)
    jit[0] = jit[N - 1] = 1.0  # keep the bottom stave flat on the turf
    outer = [(CX + (x - CX) * j, CY + (y - CY) * j) for (x, y), j in zip(outer, jit)]
    return outer, inner


def build():
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    ground(g, outline(CX, 27.0, 17.0, 23.0, 14, seed=41, wobble=0.10, turn=0.5), CX, 27.0, seed=41, top_y=G, cell=6.0)

    # the bark staves, each with its own broken ends
    outer, inner = rings()
    rng = np.random.default_rng(7)
    log = np.zeros(g.shape, dtype=bool)
    ends = []
    for k in range(N):
        z0 = Z0 + float(rng.uniform(0, 2.2))
        z1 = Z1 - float(rng.uniform(0, 2.2))
        quad = [outer[k], outer[(k + 1) % N], inner[(k + 1) % N], inner[k]]
        m = front(g, quad, z0, z1, "wood", 3)
        ends.append((m, z0, z1))
        log |= m

        def bark(gg, mm, fr, k=k):
            # long plates along the log with dark furrows between them
            P.planks(gg, mm, "wood", 4, width=3, across="y", length=(5, 11), nails=False, frame=fr, seed=40 + k)

        facet_paint(g, [g.solids[-1]], bark)
    dr = np.hypot(X - CX, Y - CY)
    # the cut ends: growth rings, a pale sapwood band and the dark bark rim
    for m, z0, z1 in ends:
        cut = m & ((Z < z0 + 1.0) | (Z > z1 - 1.0))
        P.flat(g, cut, "wood", 6)
        P.flat(g, cut & (np.floor(dr * 1.0).astype(int) % 2 == 0), "wood", 5)
        P.flat(g, cut & (dr > R_OUT - 1.4), "wood", 2)
        P.flat(g, cut & (dr < R_IN + 0.9), "wood", 4)
    # the hollow: dark inside, darker toward the middle
    hollow = log & (dr < R_IN + 1.0)
    mid = np.abs(Z - (Z0 + Z1) / 2) / ((Z1 - Z0) / 2)
    P.flat(g, hollow & (mid > 0.85), "wood", 2)
    P.flat(g, hollow & (mid <= 0.85) & (mid > 0.6), "wood", 1)
    P.flat(g, hollow & (mid <= 0.6), "wood", 0)
    P.flat(g, hollow & (mid <= 0.6) & (noise(Z, X, 3.0, 43) > 0.6), "wood", 1)
    P.flat(g, hollow & (Y < CY - R_IN + 1.2) & (mid > 0.6), "wood", 2)  # leaf litter on the floor of the hollow

    # moss blanket on the top staves, with tongues down the sides
    moss_drape(g, log & ~hollow & (Z > Z0 + 1.0) & (Z < Z1 - 1.0), CY + R_OUT * 0.72, seed=44, cx=CX, cz=27.0, tongue=3.0)
    # a broken branch stub on the top, leaning back
    limb(g, "x", (CY + R_OUT - 2.0, 33.0), (CY + R_OUT + 6.0, 37.0), 2.2, 1.6, CX + 1.0, CX + 5.0, "wood", 3, seed=45)
    stub = (g.a > 0) & (Y > CY + R_OUT + 4.5) & (np.abs(X - CX - 3.0) < 2.5) & (np.abs(Z - 36.5) < 2.5)
    P.flat(g, stub, "wood", 6)
    # a shelf fungus on the right flank: two stacked half-discs
    for k, (fy, fz, r) in enumerate(((CY + 2.0, 20.0, 4.0), (CY - 2.0, 23.5, 3.0))):
        fx = CX + R_OUT - 0.5
        sm = plan(g, [(fx, fz - r), (fx + r * 0.8, fz - r * 0.6), (fx + r, fz), (fx + r * 0.8, fz + r * 0.6), (fx, fz + r)], fy, fy + 1.6, "orange", 5,
                  top=[(fx, fz - r * 0.8), (fx + r * 0.6, fz - r * 0.5), (fx + r * 0.8, fz), (fx + r * 0.6, fz + r * 0.5), (fx, fz + r * 0.8)])
        P.flat(g, sm & (Y > fy + 1.0), "orange", 6)
        P.flat(g, sm & (np.hypot(X - fx, Z - fz) > r * 0.75), "bone", 6)  # the pale rim
        P.flat(g, sm & (Y < fy + 0.6), "sand", 4)
    # toadstools by the front end, ferns and grass round the foot
    for k, (tx, tz, h, r) in enumerate(((CX - 13.0, 9.0, 6.0, 2.6), (CX - 10.5, 6.5, 4.0, 1.9), (CX + 13.5, 44.0, 5.0, 2.2))):
        plan(g, [(tx - 0.9, tz - 0.9), (tx + 0.9, tz - 0.9), (tx + 0.9, tz + 0.9), (tx - 0.9, tz + 0.9)], G - 0.5, G + h - 1.5, "bone", 6)
        cap = plan(g, [(tx + r * math.cos(a), tz + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)], G + h - 2.0, G + h,
                   "red", 4, top=[(tx + r * 0.4 * math.cos(a), tz + r * 0.4 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)])
        P.flat(g, cap & ((P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=46 + k) % np.uint64(5)) == 0), "bone", 7)
    fern(g, CX + 13.5, G, 14.5, 5.0, "forest", 5, turn=1)
    fern(g, CX - 13.5, G, 38.5, 5.5, "leaf", 4, turn=2)
    grass(g, [(int(CX) - 15, G, 24), (int(CX) + 14, G, 32), (int(CX) - 4, G, 3), (int(CX) + 6, G, 51)], "leaf", 5)
    return prop("fantasy-terrain-nature-hollow-log", "Hollow Log", g)
