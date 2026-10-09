"""Fletcher's barrel in the Pirate Nation style.

A squat bellied barrel (two octagon frustums, true slopes) packed with a
sheaf of chunky arrows that fan out at slight angles, their red and cream
fletchings reading from far away (rule K3). A longbow leans on the side
(true-slope limbs). Detail is paint (rule S1). About 20 wide, 25 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords
from pnkit import box
from pnshapes import bar, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 24, 27, 20
CX, CZ = 10.0, 10.0
R0, R1, BH = 6.0, 7.5, 13

ARROWS = [(-3, -2, -8), (0, -3, 3), (3, -1, 9), (-2, 2, -4), (2, 2, 6), (0, 0, 0), (-4, 1, -12), (4, -3, 12), (1, 4, 4)]  # dx, dz, lean (degrees)


def build() -> Asset:
    g = Grid(W, H, D)
    g.prism("y", flat_ngon(CX, CZ, R0, 8), 0, BH / 2, C("wood", 5), top=flat_ngon(CX, CZ, R1, 8))
    body = last(g)
    g.prism("y", flat_ngon(CX, CZ, R1, 8), BH / 2, BH, C("wood", 5), top=flat_ngon(CX, CZ, R0, 8))
    body |= last(g)
    X, Y, Z = coords(g)
    stave = np.floor((np.arctan2(Z - CZ, X - CX) + math.pi) / (2 * math.pi) * 24).astype(int)
    P._paint(g, body, "wood", 5 + np.array([0, 1, 0, -1])[stave % 4])
    for hy in (1.5, BH - 3.0):
        P.flat(g, body & (Y > hy) & (Y < hy + 1.8), "darkwood", 3)
    P.flat(g, body & (np.abs(Y - BH / 2) < 1.0), "red", 4)  # a painted band (accent)
    P.flat(g, body & (Y > BH - 1), "darkwood", 2)  # the dark inside of the open top
    # arrows: shafts leaning out from the centre, fletchings on top
    for k, (dx, dz, lean) in enumerate(ARROWS):
        ax, az = CX + dx, CZ + dz
        top = BH + 8 + (k % 3)
        t = math.radians(lean)
        tx = ax + math.sin(t) * (top - BH + 2)
        bar(g, "z", (ax, BH - 2), (tx, top), 1.4, az - 0.7, az + 0.7, "wood", 6)
        fx = int(round(tx - 1))
        ramp, shade = (("red", 5), ("bone", 6), ("gold", 6))[k % 3]
        fl = box(g, fx, top - 3, int(az) - 1, fx + 2, top, int(az) + 1, ramp, shade)
        P.flat(g, fl & (Y > top - 1), ramp, min(7, shade + 1))
    # a longbow leaning on the +x side: three true-slope limb segments and a string
    bx, bz = CX + R1 + 2.5, CZ + 1
    pts = [(bx - 1.0, 1.4), (bx + 1.4, 8), (bx + 2.2, 15), (bx + 1.6, 23)]
    for (p0, p1) in zip(pts, pts[1:]):
        bar(g, "z", p0, p1, 1.8, bz - 1, bz + 1, "darkwood", 4)
    box(g, int(bx + 1), 11, int(bz) - 1, int(bx + 3), 14, int(bz) + 1, "red", 4)
    bar(g, "z", (bx - 2.2, 1.6), (bx - 0.6, 23.2), 0.9, bz - 0.5, bz + 0.5, "bone", 7)
    root = Part("arrow-barrel", g)
    return Asset(id="fantasy-props-arrow-barrel", pack="fantasy", category="props", name="Arrow Barrel", root=root)
