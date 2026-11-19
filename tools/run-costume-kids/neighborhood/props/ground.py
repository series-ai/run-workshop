"""Ground tiles: a 4 x 4 sidewalk slab with a kerb along its front (-y) edge
(top at 0.38, kerb face drops to the road at z = 0), and an 8 x 16 road tile
(a full two-lane street, a dash on the centre line) that tiles along x.
Budget <= 100 tris each.

    Blender -b -t 1 --factory-startup --python neighborhood/props/ground.py -- neighborhood/renders [slug ...]
"""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403

JOINT = (0.52, 0.50, 0.54)
SLAB = (0.74, 0.71, 0.70)
KERB = (0.84, 0.81, 0.78)
ASPHALT = (0.23, 0.22, 0.27)
LINE = (0.93, 0.80, 0.38)


def sidewalk():
    box(0, 0.2, 0.15, 4.0, 3.6, 0.3, JOINT)                          # the joint (seen in the gaps)
    frustum(0, 0.2, 0.3, 3.94, 3.54, 0.06, 3.86, 3.46, SLAB)          # the slab, chamfered top
    hull([(x, y, z) for x in (-2, 2) for y, z in ((-2, 0), (-2, 0.3), (-1.92, 0.38), (-1.6, 0.38), (-1.6, 0))], KERB)


def road():
    box(0, 0, 0.025, 8.0, 16.0, 0.05, ASPHALT)
    box(0, 0, 0.052, 3.0, 0.22, 0.01, LINE)


GROUND = {"sidewalk": sidewalk, "road": road}

main_for(GROUND, "ground")
