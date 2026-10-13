"""Ned Kelly: the kid in a giant steel bucket helmet (8 sides, an eye slit
with two eyes peering out), a ginger beard tucked under the rim, a brown
duster with a flared skirt, a steel breastplate and apron plate, shoulder
plates and a stubby carbine in the right mitten. Ported from ned_bobble.py."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403

STEEL, STEEL_D, COAT, COAT_D = (0.62, 0.65, 0.68), (0.42, 0.45, 0.49), (0.55, 0.32, 0.18), (0.36, 0.20, 0.11)
BEARD, WOOD, IRON = (0.85, 0.40, 0.12), (0.55, 0.33, 0.16), (0.2, 0.2, 0.22)


def build():
    body(shirt=COAT, sleeve=COAT, leg_colour=(0.30, 0.28, 0.22), torso=False)
    # the duster: a short skirt that flares out, then the body
    can(0, 0.02, HIP + 0.12, TW * 0.72, 0.42, COAT, n=8, r2=TW * 0.52)
    box(0, 0, HIP + TH * 0.62, TW, TD, TH * 0.72, COAT, bevel=0.08)
    # the breastplate and the apron plate
    box(0, -TD * 0.5 - 0.03, HIP + TH * 0.66, TW * 0.86, 0.1, TH * 0.62, STEEL, bevel=0.03)
    box(0, -TD * 0.5 - 0.12, HIP + 0.06, TW * 0.62, 0.08, 0.42, STEEL_D, bevel=0.02, rot=(math.radians(-14), 0, 0))
    # shoulder plates
    for s in (-1, 1):
        box(s * (TW * 0.5 + 0.08), 0, TOP - 0.12, 0.34, 0.34, 0.22, STEEL_D, bevel=0.06)
    # a stubby carbine in the right mitten, pointing forward
    rx = TW * 0.5 + 0.26
    box(rx, -0.55, TOP - 0.62, 0.12, 1.1, 0.16, WOOD, bevel=0.03)
    can(rx, -1.15, TOP - 0.56, 0.06, 0.7, IRON, n=6, rot=(math.radians(90), 0, 0))
    box(rx, 0.15, TOP - 0.7, 0.14, 0.4, 0.26, WOOD, bevel=0.04)
    # the beard spilling out under the helmet
    hs = HEAD
    can(0, -0.32, TOP + 0.12, 0.62, 0.42, BEARD, n=6, r2=0.32, rot=(math.radians(180), 0, 0))
    # the helmet: a giant flat-topped steel bucket (8 sides), a top plate and a lower rim
    hz = HEAD_Z
    # (octa: a flat face to the front, so the eye slit sits on a flat plate)
    octa(0, 0, hz, hs * 0.5, hs, STEEL, flat_front=False)
    octa(0, 0, TOP + 0.36, hs * 0.53, 0.14, STEEL_D, flat_front=False)
    octa(0, 0, hz + hs * 0.52, hs * 0.44, 0.1, STEEL_D, flat_front=False)
    # the eye slit with two eyes looking out of it
    front = -hs * 0.5 * math.cos(math.pi / 8)
    ey = hz + 0.12
    box(0, front - 0.02, ey, hs * 0.62, 0.08, 0.34, DARK)
    for s in (-1, 1):
        box(s * 0.32, front - 0.06, ey, 0.2, 0.06, 0.2, WHITE)
    # rivets and a dent of rust
    for s in (-1, 1):
        for z in (hz - 0.7, hz + 0.6):
            ball(s * 0.75, front - 0.02, z, 0.09, 0.09, 0.09, STEEL_D, seg=6, ring=4)
    ball(-0.45, front + 0.01, hz - 0.45, 0.24, 0.05, 0.2, (0.62, 0.32, 0.16), seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"ned-kelly": build})
