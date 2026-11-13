"""Mining drill rig, in the Pirate Nation mecha style.

One chunky icon (rule K3) whose hero is the drill: a huge golden spiral
bit (a faceted cone with painted dark flutes and a steel tip) juts out of
a gearbox on the diagonal (true slope, F2) and bores down into a mound of
grey rubble with glowing cyan ore chips at the front. Behind it, a
hazard-striped skid carries an orange motor housing with a copper gear on
its side, a grille and an exhaust stack; two steel braces (true slopes)
hold the gearbox up. The rig leans a little (F5). Detail is paint (S1).
Faces -Z.
"""
import math

import numpy as np

import paint as P
import pnpaint
from _props import cham_prism
from pnkit import box, edges
from pnshapes import bar, coords, cone, facets, gear
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, D = 30, 34, 34
CX = 15.0
PIVOT = (15.0, 26.0, 21.0)  # where the bit leaves the gearbox
TILT = 34.0  # the bit leans forward by this much


def rig() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # the rubble mound at the front, where the bit bores in
    g.prism("y", [(CX - 10, 0), (CX + 8, 0.5), (CX + 11, 12), (CX - 9, 13)], 0, 6, C("gray", 4),
            top=[(CX - 3, 4), (CX + 3, 4), (CX + 4, 8), (CX - 3, 9)])
    mound = g.solids[-1].mask(g.shape)
    for m, fr in facets(g):
        P.stone(g, m, "gray", 4, block=(4, 3), frame=fr, seed=3)
    chips = mound & (P._hash(np.floor(X).astype(int) // 2, np.floor(Y).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=5) % np.uint64(5) == 0)
    P.flat(g, chips, "cyan", 6)
    P.flat(g, chips & (Y > 3), "cyan", 7)
    # the skid: a steel sled with hazard stripes
    sk = box(g, 3, 0, 14, W - 3, 3, D - 1, "steel", 4)
    pnpaint.hazard(g, sk, period=4, a=("orange", 5), b=("iron", 5))
    # the motor housing
    motor = cham_prism(g, "z", CX - 8, 3, CX + 8, 16, 3, 20, D - 3, "orange", 5)
    P.flat(g, motor, "orange", 5)
    P.flat(g, motor & (Y > 14.5), "orange", 6)
    P.flat(g, motor & (np.abs(Z - 26.5) < 0.6), "orange", 3)  # a panel seam
    P.flat(g, motor & (Y < 4), "orange", 3)
    grill = motor & (Z > D - 3.5) & (np.abs(X - CX) < 5) & (Y > 5) & (Y < 13)
    P.flat(g, grill, "iron", 5)
    P.flat(g, grill & (np.floor(Y) % 2 == 0), "steel", 5)
    # an exhaust stack
    ex = box(g, CX + 3, 16, D - 9, CX + 6, 22, D - 6, "rust", 4)
    P.flat(g, ex & (Y > 21), "iron", 5)
    # the mast and the gearbox on top
    mast = box(g, CX - 3, 16, 21, CX + 3, 23, 27, "steel", 5)
    P.flat(g, edges(mast), "steel", 3)
    gb = cham_prism(g, "z", CX - 6, 22, CX + 6, 31, 2, 17, 27, "steel", 5)
    P.plates(g, gb, "steel", 5, size=(6, 5))
    P.flat(g, gb & (Y > 30), "steel", 6)
    P.flat(g, gb & (Z < 17.6) & (np.abs(X - CX) < 4) & (Y > 29), "red", 6)  # a warning lamp strip
    # two diagonal braces from the skid front up to the gearbox (true slopes)
    for x0 in (CX - 7, CX + 4):
        bar(g, "x", (1.5, 15.5), (23.5, 19.5), 2.4, x0, x0 + 3, "steel", 4)
    P.flat(g, (g.a > 0) & (Z > 15) & (Z < 20) & (Y > 3) & (Y < 23) & ((np.abs(X - (CX - 5.5)) < 1.6) | (np.abs(X - (CX + 5.5)) < 1.6)) & (np.floor(Y) % 5 == 0), "orange", 5)
    return g


def bit() -> Grid:
    """The drill bit, pointing down (-y) from its collar; the pivot is the collar top."""
    g = Grid(18, 34, 18)
    X, Y, Z = coords(g)
    c = 9.0
    collar = cone(g, "y", c, c, 6.2, 27, 34, "rust", 4, n=8, r_top=6.2)
    P.flat(g, collar, "rust", 4)
    P.flat(g, collar & (np.abs(Y - 30.5) < 1), "gold", 6)
    body = cone(g, "y", c, c, 8.0, 2, 27, "gold", 5, n=8, tip="lo", r_top=1.6)
    ang = np.arctan2(Z - c, X - c)
    ph = (ang / (2 * math.pi) * 2 + Y / 8.0) % 1  # a two-start helix
    P.flat(g, body, "gold", 6)
    P.flat(g, body & (ph < 0.32), "gold", 2)
    P.flat(g, body & (ph >= 0.32) & (ph < 0.44), "gold", 7)  # the lit edge of each flute
    tip = cone(g, "y", c, c, 1.6, 0, 2, "steel", 7, n=8, tip="lo")
    P.flat(g, tip, "steel", 7)
    return g


def side_gear() -> Grid:
    g = Grid(3, 14, 14)
    gear(g, "x", 7, 7, 4.8, 0, 2, teeth=8, depth=2.0, ramp="rust", base=4)
    P.flat(g, (g.a > 0) & (np.hypot(coords(g)[1] - 7, coords(g)[2] - 7) < 1.8), "gold", 6)
    return g


def build() -> Asset:
    root = Part("mining-drill", rig())
    root.add(Part("gear", side_gear(), pivot=(0.0, 7.0, 7.0), at=(CX + 8.0, 9.5, 27.0), rot=(12.0, 0.0, 0.0)))
    root.add(Part("bit", bit(), pivot=(9.0, 34.0, 9.0), at=(PIVOT[0], PIVOT[1] + 3.0, PIVOT[2]), rot=(TILT, 0.0, 6.0)))
    return Asset(id="space-props-mining-drill", pack="space", category="props", name="Mining Drill Rig", root=root,
                 # the bit bores (two turns a loop) and the side gear drives it
                 clips=[Clip("idle", {"bit": {"rot": turn(3.0, "y", 240.0)}, "gear": {"rot": turn(3.0, "x", 120.0)}})])
