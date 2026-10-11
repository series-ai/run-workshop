"""Stasis tube, in the Pirate Nation mecha style.

One iconic shape (rule K3): a person-tall octagonal glass tube (true
facets, F2) full of glowing teal fluid, on a tapered steel machine base with
an orange ring, braced by four thick steel struts and capped with a copper
vent dome, a status lamp and coolant hoses. The little grey alien floating
inside, its big black eyes and the bubbles are painted on the glass (S1).
The cap sits a little skew (F5). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint
from _pn import pipe
from _props import dots, lamp, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import Asset, Grid, Part

S = 24
C0 = S / 2
R = 8.0
Y0, Y1 = 8, 38  # the glass


def tube() -> Grid:
    g = Grid(S, Y1 + 2, S)
    X, Y, Z = coords(g)
    base = ngon_prism(g, "y", C0, C0, 11, 0, 5, "steel", 4, r_top=10)
    for m, fr in facets(g):
        P.plates(g, m, "steel", 4, size=(7, 5), frame=fr)
    ringm = ngon_prism(g, "y", C0, C0, 10, 5, 8, "orange", 5)
    pnpaint.hazard(g, ringm, period=4, a=("orange", 5), b=("iron", 5))
    P.flat(g, ringm & (Y > 7), "steel", 5)
    glass = ngon_prism(g, "y", C0, C0, R, Y0, Y1, "teal", 5)
    P.flat(g, glass, "teal", 5)
    P.flat(g, glass & (Y > Y1 - 5), "teal", 6)
    P.flat(g, glass & (Y < Y0 + 3), "teal", 4)
    # bubbles
    bub = glass & (P._hash(np.floor(X).astype(int), np.floor(Y).astype(int) // 2, np.floor(Z).astype(int), seed=7) % np.uint64(23) == 0)
    P.flat(g, bub, "cyan", 7)
    # the alien, painted on the front and the +x facets
    for face, U in ((glass & (Z < C0 - R + 1), X), (glass & (X > C0 + R - 1), Z)):
        u = np.abs(U - C0)
        headm = face & (np.hypot((U - C0) / 3.2, (Y - 28) / 3.6) < 1)
        bodym = face & (u < 1.8) & (Y > 17) & (Y < 25)
        arms = face & (u < 4.5) & (Y > 21) & (Y < 23)
        legs = face & (u > 0.5) & (u < 1.8) & (Y > 12) & (Y < 18)
        P.flat(g, headm | bodym | arms | legs, "gray", 6)
        P.flat(g, face & (np.abs(U - C0) > 0.6) & (np.abs(U - C0) < 2.4) & (np.abs(Y - 28.5) < 1.1), "iron", 4)  # eyes
        P.flat(g, face & (np.abs(U - C0) > 0.6) & (np.abs(U - C0) < 1.2) & (np.abs(Y - 28.5) < 0.6), "cyan", 7)
    # the struts
    for dx in (-9, 7):
        for dz in (-9, 7):
            st = box(g, C0 + dx, Y0 - 1, C0 + dz, C0 + dx + 2, Y1 + 1, C0 + dz + 2, "steel", 5)
            P.flat(g, st & (np.floor(Y) % 6 == 0), "steel", 7)
            P.flat(g, edges(st), "steel", 3)
    # a control panel on the base front
    dots(g, base & (Z < 2.5), "-z", [(9.5, 2.5), (12, 2.5), (14.5, 2.5)], 1.0, "cyan", 6)
    return g


def cap() -> Grid:
    g = Grid(S, 12, S)
    X, Y, Z = coords(g)
    ring = ngon_prism(g, "y", C0, C0, 10.5, 0, 3, "steel", 5)
    P.flat(g, edges(ring), "steel", 3)
    dome = ngon_prism(g, "y", C0, C0, 9, 3, 7, "rust", 4, r_top=5)
    for m, fr in facets(g):
        P.plates(g, m, "rust", 4, size=(5, 3), rivets=False, frame=fr)
    vents = dome & (np.floor(Y) == 4) & (np.floor(np.arctan2(Z - C0, X - C0) * 16 / 6.283) % 2 == 0)
    P.flat(g, vents, "rust", 2)
    lamp(g, C0, 7, C0, r=2.2, h=3, glass=("toxic", 5), cap=("steel", 4))
    return g


def build() -> Asset:
    g = tube()
    pipe(g, [(C0 + 10.5, Y1 - 2, C0 + 3), (C0 + 10.5, 4, C0 + 3)], s=2, ramp="rust", base=4)
    pipe(g, [(C0 - 10.5, Y1 - 2, C0 + 3), (C0 - 10.5, 4, C0 + 3)], s=2, ramp="rust", base=4)
    root = Part("stasis-tube", g)
    root.add(Part("cap", cap(), pivot=(C0, 0.0, C0), at=(C0, float(Y1), C0), rot=(0.0, 6.0, 2.0)))
    return Asset(id="space-props-stasis-tube", pack="space", category="props", name="Stasis Tube", root=root)
