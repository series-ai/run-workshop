"""Survivor ridge tent, in the Pirate Nation style.

A person-size icon (rule K3): a khaki canvas A-frame (one true-slope
prism) long enough for a 36-voxel sleeper, with sewn panel seams, a mud
line and two stitched patches, wooden poles, guy lines on true diagonals
to stakes, the door flaps rolled back and a red bedroll poking out. A
lantern hangs on the front pole; a backpack and a cooking pot on a ring
of stones sit by the door (rule F5). The dark doorway is paint, not a hole
(rule S1).
"""
import numpy as np

import paint as P
from _props import asset, root, rock
from pnkit import box, edges
import pnpaint
from pnshapes import bar, coords, disc, lantern
from voxgrid import C, Grid

TX0, TX1 = 7, 33  # tent base width (x)
TZ0, TZ1 = 8, 46  # tent front and back (z)
TH = 19  # ridge height
XC = (TX0 + TX1) / 2


def build():
    g = Grid(42, 30, 50)
    X, Y, Z = coords(g)
    g.prism("z", [(TX0, 0), (TX1, 0), (XC, TH)], TZ0, TZ1, C("khaki", 5))
    tent = g.solids[-1]
    m = tent.mask(g.shape)
    P.flat(g, m, "khaki", 5)
    P.flat(g, m & (Y > TH * 0.55), "khaki", 6)  # the sunlit upper canvas
    pnpaint.blotch(g, m & (Y < TH * 0.55), "khaki", 4, cell=3, chance=0.05, seed=1)
    # sewn panel seams, the ridge seam, the mud line and two patches
    P.flat(g, m & (np.floor(Z) % 9 == 3), "khaki", 4)
    P.flat(g, m & (Y > TH - 1.5), "khaki", 6)
    P.flat(g, m & (Y < 2), "sand", 4)
    P.flat(g, m & (np.abs(X - 12) < 2.5) & (np.abs(Y - 7) < 2) & (np.abs(Z - 28) < 3), "sand", 6)
    P.flat(g, m & (np.abs(X - 28) < 2) & (np.abs(Y - 9) < 2) & (np.abs(Z - 20) < 2.5), "teal", 5)
    # the doorway on the front triangle (paint), with a lit rim
    front = m & (Z < TZ0 + 1)
    door = front & (Y < TH - 3) & (np.abs(X - XC) < (TH - 3 - Y) * 0.55)
    P.flat(g, door, "khaki", 2)
    # rolled-back door flaps: two fat bars up the door edges
    for s in (-1, 1):
        bar(g, "z", (XC + s * 8.5, 1.0), (XC + s * 1.5, TH - 3.5), 2.2, TZ0 - 2, TZ0, "khaki", 6)
    # poles through the ridge, front and back
    for pz in (TZ0 - 2, TZ1):
        box(g, XC - 1, 0, pz, XC + 1, TH + 4, pz + 2, "wood", 6)
    # guy lines to stakes, and the stakes
    for pz in (TZ0 - 1, TZ1 + 1):
        for s in (-1, 1):
            sx = XC + s * 18
            bar(g, "z", (XC, TH + 3), (sx, 1.0), 0.9, pz, pz + 1, "sand", 6)
            box(g, sx - 1, 0, pz - 0.5, sx + 1, 3, pz + 1.5, "wood", 4)
    # the red bedroll poking out of the door
    roll = disc(g, "z", XC, 3.0, 3.0, TZ0 - 5, TZ0 + 3, "red", 5)
    P.flat(g, roll & (np.abs(Z - TZ0 + 3) < 0.6), "red", 3)
    P.flat(g, roll & (Z < TZ0 - 4.5), "red", 6)
    # the lantern hanging on the front pole
    lantern(g, int(XC) + 4, TH - 6, TZ0 - 2, s=4, body=5, glass="gold", roof="rust", frame="darkwood")
    box(g, XC + 1, TH + 1, TZ0 - 2, XC + 4, TH + 2, TZ0 - 1, "darkwood", 4)
    # a backpack by the door
    bp = box(g, TX1 - 3, 0, 1, TX1 + 4, 9, 6, "teal", 5)
    P.flat(g, edges(bp), "teal", 3)
    box(g, TX1 - 2, 2, 0, TX1 + 3, 6, 1, "teal", 4)
    P.flat(g, bp & (np.abs(X - TX1) < 0.6), "sand", 6)  # a strap
    # a cooking pot on a ring of stones
    for k in range(6):
        a = k * np.pi / 3
        rock(g, 5.5 + 3.2 * np.cos(a), 5.5 + 3.2 * np.sin(a), 0, 1.6, 1.5, n=5, seed=k, ramp="stone", base=5)
    pot = disc(g, "y", 5.5, 5.5, 2.4, 1, 5, "steel", 5)
    P.flat(g, pot & (Y > 4), "steel", 3)
    return asset("survivor-tent", "Survivor Tent", root("survivor-tent", g))
