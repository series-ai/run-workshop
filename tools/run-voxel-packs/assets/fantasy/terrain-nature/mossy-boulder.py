"""Mossy boulder in the Pirate Nation style.

One big rounded boulder: a stack of frustums on one irregular 11-gon
that swells and closes over the top (true slopes, rule F2), so it reads as
one mass and not as stacked drums. A thick moss blanket drapes over its
crown with long tongues down the weather side (rule C3: the moss is the
one accent). A smaller half-buried stone leans on its right foot. Ferns,
grass tufts and pebbles sit on an oval turf patch with soft grass tones.
Detail is paint (rule S1). About 42 wide and 25 tall. Faces -Z.
"""
import numpy as np

import paint as P
from _fterrain import fern, ground, moss_drape, outline, rock, rounded_rock
from _kit import prop
from _life import coords, grass
from voxgrid import C, Grid

SZ = (54, 32, 50)
CX, CZ = 26.0, 25.0
G = 2  # the turf top


def build():
    g = Grid(*SZ)
    _X, Y, _Z = coords(g)
    ground(g, outline(CX, CZ, 22.0, 18.5, 14, seed=71, wobble=0.14, turn=0.3), CX, CZ, seed=71, top_y=G, cell=6.0)
    # the boulder: one rounded mass that leans back to the right
    m, solids = rounded_rock(g, CX - 2, CZ + 1, G - 1, 14.5, 24.0, n=11, seed=73, squash=(1.12, 0.92), lean=(2.0, 1.5))
    rock(g, solids, seed=73, base=4, top_ramp=("stone", 5), strata=0)
    moss_drape(g, m, G - 1 + 24.0 * 0.74, seed=74, cx=CX - 2, cz=CZ + 1, tongue=7.0)
    P.flat(g, m & (Y < G + 1.5), "stone", 2)  # the damp foot in the turf
    # a half-buried second stone at the right foot
    m2, s2 = rounded_rock(g, CX + 14, CZ - 3, G - 2, 6.5, 9.0, n=9, seed=75, squash=(1.0, 0.85), lean=(1.0, 0.0))
    rock(g, s2, seed=75, base=4, top_ramp=("stone", 5))
    moss_drape(g, m2, G - 2 + 9.0 * 0.7, seed=76, cx=CX + 14, cz=CZ - 3, tongue=2.0)
    # pebbles: small rounded stones in the turf
    for k, (px, pz, r) in enumerate(((CX - 15, CZ - 9, 2.8), (CX + 6, CZ - 14, 2.2), (CX - 9, CZ + 13, 2.4))):
        _pm, ps = rounded_rock(g, px, pz, G - 1, r, r * 1.5, n=7, seed=80 + k, profile=((0.0, 1.0), (0.5, 0.9), (1.0, 0.45)))
        rock(g, ps, seed=80 + k, base=3, top_ramp=("stone", 4))
    # ferns and grass round the foot
    fern(g, CX - 15.5, G, CZ - 2.5, 5.5, "forest", 5, turn=0)
    fern(g, CX + 9.5, G, CZ - 11.5, 4.5, "leaf", 4, turn=1)
    fern(g, CX + 17.5, G, CZ + 7.5, 5.0, "forest", 5, turn=2)
    grass(g, [(int(CX) - 18, G, int(CZ) + 5), (int(CX) - 4, G, int(CZ) - 15), (int(CX) + 18, G, int(CZ) - 10),
              (int(CX) + 4, G, int(CZ) + 15)], "leaf", 5)
    # two small white flowers in the moss on the crown side
    for fx, fz in ((CX - 12, CZ - 13), (CX + 13, CZ + 12)):
        x, z = int(fx), int(fz)
        g.box(x, G, z, x + 1, G + 2, z + 1, C("leaf", 3))
        g.box(x, G + 2, z, x + 1, G + 3, z + 1, C("bone", 7))
    return prop("fantasy-terrain-nature-mossy-boulder", "Mossy Boulder", g)
