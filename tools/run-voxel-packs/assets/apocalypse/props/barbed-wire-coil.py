"""Razor-wire coil, in the Pirate Nation style.

One readable icon (rules F6, K3): five big twelve-sided wire hoops threaded
on three strands, so the whole prop is open rings of true diagonals and the
silhouette is unmistakable from any side (rule F2). Wire is wire, as on the
chain-link fence: thin members for the coil, thick ones for the structure
(rule F3) — two rusted angle-iron pickets with hazard-yellow heads are
driven through the coil at their own angles and hold it down (rule F5).
Ten oversized X barbs of crossed blades carry the bite in the silhouette;
the rest of the barbs are painted ticks on the hoops and the strands (rule
S1), spaced four units apart so no face ever carries speckle (rule S3).
The accents are the signal-red hazard plate wired to the front strand, a
red rag caught on the top wire and the yellow picket heads (rules C1, C3);
a loose wire end, weeds and broken concrete ground the run.
"""
import math

import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, root, rubble, rust_runs, weeds
from pnkit import box, edges
from pnshapes import bar, coords, flat_ngon, last, quad
from voxgrid import C, Grid

GW, GH, GD = 36, 24, 26
GROUND, CZ = 2.0, 12.5  # a shared concrete plinth and the coil axis
DOWN = math.pi  # "down" in the (y, z) plane of a prism along x
R, T, N = 8.5, 1.6, 12  # hoop flat radius, wire thickness, facets
CY = GROUND + R
HOOPS = ((2, 5, 0.2), (15, 18, -0.4), (30, 33, 0.5))
STRANDS = (-0.65, 0.65)  # two fine strands, spaced around each hoop
RM = R - T / 2  # the radius the strands run on


def _ring(g: Grid, x0: int, x1: int, cz: float) -> np.ndarray:
    """One hoop of wire: a twelve-sided ring standing on a flat side."""
    outer = flat_ngon(CY, cz, R, N, DOWN)
    inner = flat_ngon(CY, cz, R - T, N, DOWN)
    centre = [((outer[k][0] + inner[k][0]) / 2, (outer[k][1] + inner[k][1]) / 2) for k in range(N)]
    m = np.zeros(g.shape, dtype=bool)
    for k in range(N):
        j = (k + 1) % N
        m |= bar(g, "x", centre[k], centre[j], T, x0, x1, "steel", 6)
    _X, Y, Z = coords(g)
    P.flat(g, m & (Y > CY + R * 0.5), "steel", 7)  # the crown catches the light
    P.flat(g, m & (Y < CY - R * 0.4), "steel", 4)  # the wire darkens toward the ground
    ang = np.arctan2(Z - cz, Y - CY)
    P.flat(g, m & (np.abs(((ang / (2 * math.pi) * 12) % 1) - 0.5) < 0.13), "steel", 3)  # painted barbs
    rust_runs(g, m, ((x0, 2.5, cz - R + 2.0, 2.6),), base=5, drip=0, seed=x0)
    return m


def _barb(g: Grid, bx: float, sy: float, sz: float) -> None:
    """One oversized X barb on a strand: two crossed blades (rule F2)."""
    for s in (1, -1):
        g.prism("z", quad((bx - 1.7, sy - s * 1.7), (bx + 1.7, sy + s * 1.7), 0.65), sz - 0.65, sz + 0.65, C("steel", 3))
        m = last(g)
        P.flat(g, m & (coords(g)[1] > sy + 1.0), "steel", 6)


def plate() -> Grid:
    """The hazard plate wired to the front strand: red with a gold border."""
    g = Grid(12, 11, 2)
    m = box(g, 0, 0, 0, 12, 11, 2, "red", 5)
    P.flat(g, m & (coords(g)[1] > 8.5), "red", 4)
    P.outline(g, m, "gold", 6, normal="z")
    P.flat(g, edges(m), "darkwood", 2)
    pnglyph.icon(g, "-z", 0, 2, 2, "skull", "gold", 7)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    base = box(g, 0, 0, 0, GW, GROUND, GD, "sand", 4)
    pnpaint.concrete(g, base, "sand", 4, size=8, cracks=5, seed=2)
    P.outline(g, base, "sand", 2, normal="y")
    rings = np.zeros(g.shape, dtype=bool)
    for x0, x1, dz in HOOPS:
        rings |= _ring(g, x0, x1, CZ + dz)
    # the three strands that thread the hoops into one coil
    for s, a in enumerate(STRANDS):
        sy = CY + RM * math.cos(a)
        sz = CZ + RM * math.sin(a)
        st = bar(g, "x", (sy - 0.45, sz - 0.35), (sy + 0.45, sz + 0.35), 1.3, 1, 34, "steel", 5)
        P.flat(g, st & (Y > sy + 0.2), "steel", 7)
        rust_runs(g, st, ((17, sy, sz, 1.6),), ramp="rust", base=5, drip=0, seed=30 + s)
        for bx in ((3.8, 16.5, 31.2) if s == 0 else (4.8, 17.3, 32.0)):
            _barb(g, bx + s, sy, sz)
    # two rusted angle-iron pickets driven through the coil, each at its own lean
    for px, tipx in ((10.5, 8.8), (24.5, 26.0)):
        post = bar(g, "z", (px, GROUND + 0.5), (tipx, 20.6), 2.8, CZ - 1.4, CZ + 1.4, "rust", 5)
        P.flat(g, post & (X > max(px, tipx) - 0.7), "rust", 6)
        P.flat(g, post & (X < min(px, tipx) + 0.7), "rust", 3)
        P.flat(g, post & (Y > 17.0), "gold", 6)
        P.flat(g, post & (Y > 15.0) & (Y < 16.5), "darkwood", 3)
        if px < 20:
            P.flat(g, post & (Y > 8.5) & (Y < 10.5), "teal", 6)
        P.flat(g, post & (np.abs(Y - 11.5) < 0.8), "steel", 2)  # the tie wire round the picket
        P.flat(g, post & (np.abs(Y - 4.0) < 1.6) & (np.abs(Z - CZ) > 1.0), "rust", 4)  # the bolt plate
        rust_runs(g, post, ((px, 7.5, CZ - 1.7, 3.0),), base=4, drip=5, seed=int(px))
    # a signal-red rag caught on the top strand, torn and hanging
    ty = CY + RM
    g.prism("x", [(ty + 1.5, CZ - 1.0), (ty + 1.5, CZ - 3.5), (ty - 6.0, CZ - 7.5),
                  (ty - 9.5, CZ - 6.5), (ty - 7.5, CZ - 5.0), (ty - 3.0, CZ - 2.0)], 19.0, 22.0, C("red", 5))
    rag = last(g)
    P.flat(g, rag & (Y < ty - 4.0), "red", 4)
    P.flat(g, rag & (Y < ty - 7.5), "red", 3)
    P.flat(g, edges(rag), "red", 2)
    # the ground: broken concrete and two weed clumps, so the run is planted
    rubble(g, 12.0, CZ - 9.5, GROUND, r=3.4, h=3.0, seed=3, ramp="sand", base=4)
    rubble(g, 31.0, CZ - 8.0, GROUND, r=2.6, h=2.2, seed=4, ramp="sand", base=4)
    weeds(g, 20, int(CZ) - 11, seed=5)
    weeds(g, 5, int(CZ) + 8, seed=6)
    P.grime(g, rings, height=2, seed=7)
    r = root("barbed-wire-coil", g)
    # the hazard plate, wired to the front strand a little crooked
    fy = CY + RM * math.cos(STRANDS[1])
    fz = CZ + RM * math.sin(STRANDS[1])
    child(r, "plate", plate(), pivot=(6.0, 11.0, 2.0), at_grid=(13.5, fy - 1.0, fz - 1.2), rot=(0.0, 0.0, -8.0))
    return asset("barbed-wire-coil", "Razor Wire Coil", r)
