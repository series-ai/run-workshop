"""Crew locker, in the Pirate Nation mecha style.

One iconic shape (rule K3): a tall steel two-door crew locker on a hazard
plinth, with a sloped top (a true slope, F2). The hazard-orange doors carry
painted vent slots, white name plates and copper handles; a glowing teal
keypad and a status lamp sit between them. A spare space helmet with a
cyan visor sits on top, tipped over (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _props import dots, hull, lamp, ngon_prism, panel
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import C, Asset, Grid, Part

W, D = 26, 14
X0, X1, Z0, Z1 = 1, 25, 2, 14
Y0, Y1 = 3, 38  # body


def locker() -> Grid:
    g = Grid(W, Y1 + 5, D)
    X, Y, Z = coords(g)
    pl = box(g, X0, 0, Z0, X1, Y0, Z1, "steel", 4)
    pnpaint.hazard(g, pl, period=4, a=("orange", 5), b=("iron", 5))
    body = box(g, X0, Y0, Z0, X1, Y1, Z1, "steel", 5)
    hull(g, body, "steel", 5, size=(12, 9), seed=4)
    # the sloped top: rises toward the back
    g.prism("x", [(Y1, Z0 - 1), (Y1, Z1), (Y1 + 4, Z1), (Y1 + 1, Z0 - 1)], X0 - 1, X1 + 1, C("steel", 4))
    top = g.solids[-1].mask(g.shape)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 4, size=(9, 5), rivets=False, frame=fr)
    P.flat(g, top & (Y < Y1 + 1), "steel", 3)
    # two orange doors standing proud
    for u0, u1 in ((X0 + 2, 12.5), (13.5, X1 - 2)):
        dr = panel(g, "-z", Z0, u0, u1, Y0 + 2, Y1 - 2, "orange", 5, outline=2)
        face = dr & (Z < Z0)
        P.flat(g, face & (Y > Y1 - 9) & (Y < Y1 - 4) & (X > u0 + 1.5) & (X < u1 - 1.5) & (np.floor(Y) % 2 == 0), "orange", 3)  # vents
        P.flat(g, face & (Y > Y0 + 4) & (Y < Y0 + 9) & (X > u0 + 1.5) & (X < u1 - 1.5) & (np.floor(Y) % 2 == 0), "orange", 3)
        P.flat(g, face & (Y > Y1 - 14) & (Y < Y1 - 10) & (X > u0 + 1.5) & (X < u1 - 1.5), "bone", 6)  # name plate
        P.flat(g, face & (np.abs(Y - (Y1 - 11.5)) < 0.6) & (X > u0 + 3) & (X < u1 - 3), "iron", 5)
    for hx in (11, 14):
        h = box(g, hx, 17, Z0 - 2, hx + 1, 24, Z0 - 1, "rust", 5)
    # the keypad and the status lamp between the doors, on the frame
    kp = box(g, 12, 26, Z0 - 1, 14, 30, Z0, "cyan", 5)
    P.flat(g, kp & (np.floor(Y) % 2 == 0), "cyan", 7)
    lamp(g, 5.0, Y1 + 1, Z0 + 3.0, r=1.6, h=2, glass=("toxic", 5), cap=("steel", 4))
    return g


def helmet() -> Grid:
    g = Grid(12, 11, 12)
    X, Y, Z = coords(g)
    ngon_prism(g, "y", 6, 6, 4.2, 0, 2, "orange", 5)
    ngon_prism(g, "y", 6, 6, 5.5, 2, 7, "bone", 6)
    ngon_prism(g, "y", 6, 6, 5.5, 7, 10, "bone", 6, r_top=3)
    m = (g.a > 0) & (Y > 2)
    for f, fr in facets(g, g.solids[-2:]):
        P.flat(g, f, "bone", 6)
    P.flat(g, m & (Y > 9), "bone", 7)
    visor = m & (Z < 3) & (Y > 3) & (Y < 8)
    P.flat(g, visor, "cyan", 5)
    P.flat(g, visor & (Y > 6.5), "cyan", 7)
    return g


def build() -> Asset:
    root = Part("storage-locker", locker())
    root.add(Part("helmet", helmet(), pivot=(6.0, 0.0, 6.0), at=(17.0, float(Y1) + 2.0, 8.0), rot=(-8.0, -25.0, -24.0)))
    return Asset(id="space-props-storage-locker", pack="space", category="props", name="Crew Locker", root=root)
