"""Mossy boulders, in the Pirate Nation haunted style.

After PN rock-a / rock-b and coastalrock03: three faceted blue-grey
boulders (irregular heptagonal frustums stacked into a belly and a
leaning crown, true slopes) painted as big stone blocks with cracks, each
under a thick overhanging moss cap. Around them: a toppled grave marker
lying in the grass with a carved cross, two ferns of arching fronds and a
small fairy ring of pale toadstools. Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
import pnshapes
from _kit import single
from _life import coords, plan
from voxgrid import C, Grid

S = (52, 30, 44)
ROCK = "steel"
# (cx, cz, radius, height, lean x, lean z, turn, seed)
BOULDERS = [
    (20.0, 23.0, 11.0, 20.0, 1.5, 0.8, 0.2, 1),
    (35.0, 15.0, 8.0, 13.0, -1.2, 0.6, 0.9, 2),
    (36.0, 31.0, 6.0, 8.5, 0.8, -0.5, 1.7, 3),
]


def poly(cx, cz, r, turn, seed, f=1.0):
    n = 6
    jag = [1.0 + 0.2 * math.sin(3.1 * k + seed * 1.7) for k in range(n)]
    return [(cx + r * f * jag[k] * math.cos(turn + 2 * math.pi * k / n), cz + r * f * jag[k] * math.sin(turn + 2 * math.pi * k / n)) for k in range(n)]


def rock_paint(ramp, base, seed):
    def paint(g, m, fr):
        P.stone(g, m, ramp, base, block=(7, 5), cracks=0.3, frame=fr, seed=seed)
    return paint


def boulder(g, cx, cz, r, h, lx, lz, turn, seed):
    """A belly frustum and a leaning crown frustum, then an overhanging moss
    cap on the crown. Returns (stone solids, moss solid)."""
    ym = h * 0.4
    plan(g, poly(cx, cz, r * 0.9, turn, seed), 0, ym, ROCK, 4, top=poly(cx + lx * 0.4, cz + lz * 0.4, r * 1.08, turn, seed))
    belly = g.solids[-1]
    top_c = (cx + lx, cz + lz)
    plan(g, poly(cx + lx * 0.4, cz + lz * 0.4, r * 1.08, turn, seed), ym, h - 2.5, ROCK, 4, top=poly(*top_c, r * 0.72, turn, seed))
    crown = g.solids[-1]
    # the moss cap: a thick lid that carries the crown's slope up to a flat top
    plan(g, poly(*top_c, r * 0.72, turn, seed), h - 2.5, h, "moss", 5, top=poly(*top_c, r * 0.5, turn, seed))
    cap = g.solids[-1]
    return [belly, crown], cap


def fern(g, fx, fz, seed):
    """Five arching fronds (thin slanted slabs, true slopes) from a tuft."""
    m = np.zeros(g.shape, dtype=bool)
    for j in range(5):
        a = 2 * math.pi * j / 5 + seed
        ln = 6.5 + (j % 2) * 1.5
        ux, uz = math.cos(a), math.sin(a)
        if abs(ux) >= abs(uz):
            s = 1 if ux > 0 else -1
            prof = [(fx, 0.0), (fx + s * ln * 0.5, 5.5), (fx + s * ln, 3.0), (fx + s * ln * 0.55, 4.2)]
            g.prism("z", prof, fz + uz * 3 - 1, fz + uz * 3 + 1, C("moss", 6))
        else:
            s = 1 if uz > 0 else -1
            prof = [(0.0, fz), (5.5, fz + s * ln * 0.5), (3.0, fz + s * ln), (4.2, fz + s * ln * 0.55)]
            g.prism("x", prof, fx + ux * 3 - 1, fx + ux * 3 + 1, C("moss", 6))
        m |= g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y >= 4), "moss", 7)
    return m


def build():
    g = Grid(*S)
    X, Y, Z = coords(g)
    stones, caps = [], []
    for cx, cz, r, h, lx, lz, turn, seed in BOULDERS:
        st, cap = boulder(g, cx, cz, r, h, lx, lz, turn, seed)
        stones += st
        caps.append(cap)
    for k, (m, fr) in enumerate(pnshapes.facets(g, stones)):
        P.stone(g, m, ROCK, 4, block=(7, 5), cracks=0.3, frame=fr, seed=10 + k)
    rock = np.logical_or.reduce([s.mask(g.shape) for s in stones])
    P.flat(g, rock & (Y < 2), ROCK, 3)  # a darker, damp foot
    moss = np.logical_or.reduce([s.mask(g.shape) for s in caps])
    P.flat(g, moss, "moss", 5)
    pnpaint.blotch(g, moss, "moss", 6, cell=2, chance=0.25, seed=20)
    P.flat(g, moss & (Y < Y.max()) & ((P._hash(X, Z, seed=21) % np.uint64(4)) == 0) & ~np.roll(moss, -1, axis=1), "moss", 6)
    # moss drips down the stone below each cap
    below = (np.roll(moss, 2, axis=1) | np.roll(moss, 1, axis=1)) & rock & ~moss & ((P._hash(X + Z, seed=22) % np.uint64(3)) != 0)
    P.flat(g, below, "moss", 4)

    # the toppled grave marker: a round-topped slab lying in the grass
    mx, mz, ang = 10.0, 8.0, 90.0
    outline = [(mx - 4, mz - 7), (mx + 4, mz - 7), (mx + 4, mz + 3)] + [(mx + 4 * math.cos(math.pi * k / 6), mz + 3 + 4 * math.sin(math.pi * k / 6)) for k in range(1, 6)] + [(mx - 4, mz + 3)]
    outline = pnshapes.rotate(outline, mx, mz, ang)
    marker = plan(g, outline, 0, 3, "gray", 6)
    P.stone(g, marker, "gray", 6, block=(5, 4), cracks=0.3, seed=30)
    P.outline(g, marker, "gray", 5, normal="y")
    # a carved cross on its upper face (rotated with the slab)
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    u = (X + 0.5 - mx) * ca + (Z + 0.5 - mz) * sa
    v = -(X + 0.5 - mx) * sa + (Z + 0.5 - mz) * ca
    cross = marker & (Y == 2) & (((np.abs(u) < 1.0) & (v > -5) & (v < 4)) | ((np.abs(v - 1.2) < 1.0) & (np.abs(u) < 3.0)))
    P.flat(g, cross, "purple", 3)
    P.flat(g, marker & (Y == 0), "moss", 5)

    # two ferns and a fairy ring of pale toadstools
    fern(g, 9.0, 31.0, 0.4)
    fern(g, 43.0, 22.0, 1.1)
    rx, rz = 44.0, 7.0
    for k in range(7):
        a = 2 * math.pi * k / 7
        px, pz = float(round(rx + 4.5 * math.cos(a))), float(round(rz + 3.6 * math.sin(a)))
        hgt = 2 + (k % 3)
        plan(g, [(px - 1, pz - 1), (px + 1, pz - 1), (px + 1, pz + 1), (px - 1, pz + 1)], 0, hgt, "bone", 6)
        cap = plan(g, [(px - 2, pz - 2), (px + 2, pz - 2), (px + 2, pz + 2), (px - 2, pz + 2)], hgt, hgt + 2, "bone", 7, top=[(px, pz)] * 4)
        if k % 3 == 0:
            P.flat(g, cap & (Y >= hgt + 1), "magenta", 6)
    return single("mossy-rocks", "terrain-nature", "Mossy Boulders", g)
