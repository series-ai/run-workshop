"""Victorian street lamps (concepts/street-props.png): a stepped octagonal
base, a slim fluted pole with a collar and a ladder bar, and a four-sided
lantern whose panes glow (GLOW material: emission, no light). Single and
double (two lanterns on scrolled arms). Budget <= 800 tris.

    Blender -b -t 1 --factory-startup --python neighborhood/props/lamp.py -- neighborhood/renders [slug ...]
"""
import math
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from streetkit import *  # noqa: E402,F403

IRON = (0.17, 0.16, 0.19)
IRON_LT = (0.26, 0.24, 0.28)


def base():
    can(0, 0, 0.2, 0.8, 0.4, IRON, n=8)
    frustum(0, 0, 0.4, 1.1, 1.1, 0.35, 0.7, 0.7, IRON_LT, bevel=0.05)
    can(0, 0, 1.35, 0.42, 1.3, IRON, n=8, r2=0.3)
    can(0, 0, 2.08, 0.4, 0.16, IRON_LT, n=8)


def pole(z0, z1, r=0.24):
    can(0, 0, (z0 + z1) / 2, r, z1 - z0, IRON, n=8)
    can(0, 0, z0 + (z1 - z0) * 0.55, r * 1.7, 0.22, IRON_LT, n=8)


def lantern(x, y, z, s=1.0):
    """A lantern standing on z: neck, glowing tapered panes, corner posts, peaked cap and finial."""
    can(x, y, z + 0.15 * s, 0.26 * s, 0.3 * s, IRON, n=8, r2=0.42 * s)
    frustum(x, y, z + 0.3 * s, 0.95 * s, 0.95 * s, 0.12 * s, 0.95 * s, 0.95 * s, IRON)
    zb, zt = z + 0.42 * s, z + 1.62 * s
    with glow():
        frustum(x, y, zb, 0.78 * s, 0.78 * s, zt - zb, 1.02 * s, 1.02 * s, GLOW)
    for sx in (-1, 1):
        for sy in (-1, 1):
            limb((x + sx * 0.42 * s, y + sy * 0.42 * s, zb), (x + sx * 0.54 * s, y + sy * 0.54 * s, zt),
                 0.07 * s, IRON, n=4)
    frustum(x, y, zt, 1.32 * s, 1.32 * s, 0.14 * s, 1.32 * s, 1.32 * s, IRON, bevel=0.03)
    frustum(x, y, zt + 0.14 * s, 1.32 * s, 1.32 * s, 0.55 * s, 0.3 * s, 0.3 * s, IRON)
    ball(x, y, zt + 0.78 * s, 0.32 * s, 0.32 * s, 0.32 * s, IRON, seg=6, ring=4)
    can(x, y, zt + 1.05 * s, 0.09 * s, 0.35 * s, IRON, n=4, r2=0.0)


def single():
    base()
    pole(2.1, 8.0)
    box(0, 0, 7.1, 1.9, 0.2, 0.2, IRON)                      # ladder bar
    for sx in (-1, 1):
        ball(sx * 0.85, 0, 7.1, 0.26, 0.26, 0.26, IRON, seg=6, ring=4)
    can(0, 0, 7.75, 0.3, 0.5, IRON_LT, n=8, r2=0.2)
    lantern(0, 0, 8.0, s=1.2)


def double():
    base()
    pole(2.1, 8.6)
    for sx in (-1, 1):                                           # scrolled arms out to each lantern
        tube([(0, 0, 7.2), (sx * 0.7, 0, 7.5), (sx * 1.35, 0, 7.75), (sx * 1.75, 0, 7.6)],
             [0.13, 0.12, 0.11, 0.1], IRON, n=5, tip=False)
        tube([(sx * 0.15, 0, 6.6), (sx * 0.65, 0, 6.75), (sx * 0.95, 0, 7.15), (sx * 0.8, 0, 7.4)],
             [0.09, 0.08, 0.07, 0.06], IRON, n=4, tip=False)
        can(sx * 1.75, 0, 7.55, 0.14, 0.3, IRON, n=6)
        lantern(sx * 1.75, 0, 7.65, s=1.0)
    ball(0, 0, 8.75, 0.42, 0.42, 0.42, IRON, seg=6, ring=4)
    can(0, 0, 9.15, 0.12, 0.6, IRON, n=4, r2=0.0)


LAMPS = {"lamp-single": single, "lamp-double": double}

main_for(LAMPS, "lamp")
