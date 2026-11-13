"""Landing beacon, in the Pirate Nation mecha style.

One iconic shape (rule K3): a thick orange-and-white striped post on three
splayed steel tripod legs (true slopes, F2) over an octagonal pad marker
plate with a painted "H". On top sits an oversized caged beacon lamp with a
glowing orange lens, and a small solar fin leans off one side (F5). Detail
is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import lamp, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import Asset, Clip, Grid, Part, sway

S = 24
C0 = S / 2
YP = 22  # post top


def body() -> Grid:
    g = Grid(S, YP + 12, S)
    X, Y, Z = coords(g)
    pad = ngon_prism(g, "y", C0, C0, 11, 0, 1, "steel", 6)
    rr = np.hypot(X - C0, Z - C0)
    P.flat(g, pad & (rr > 9.5), "orange", 5)
    P.flat(g, pad & (rr > 9.5) & (np.floor((np.arctan2(Z - C0, X - C0) + 4) * 3) % 2 == 0), "bone", 6)
    P.flat(g, pad & (Y < 1) & (Y > 0) & (rr < 9.5) & (((np.abs(X - C0 - 3.5) < 1.1) | (np.abs(X - C0 + 3.5) < 1.1)) & (np.abs(Z - C0 + 4) < 5)), "orange", 6)
    P.flat(g, pad & (np.abs(Z - C0 + 4) < 1.1) & (np.abs(X - C0) < 3.5), "orange", 6)
    post = ngon_prism(g, "y", C0, C0, 2.5, 1, YP, "bone", 6)
    P.flat(g, post & (np.floor(Y / 3) % 2 == 0), "orange", 5)
    collar = ngon_prism(g, "y", C0, C0, 3.5, 7, 9, "steel", 4)
    head = ngon_prism(g, "y", C0, C0, 4, YP, YP + 2, "steel", 4)
    P.flat(g, edges(head), "steel", 3)
    lamp(g, C0, YP + 2, C0, r=3.4, h=6, glass=("gold", 6), cap=("orange", 5))
    # the cage: four bars round the lens
    for dx, dz in ((-4, -4), (3, -4), (-4, 3), (3, 3)):
        box(g, C0 + dx, YP + 2, C0 + dz, C0 + dx + 1, YP + 10, C0 + dz + 1, "steel", 5)
    top = box(g, C0 - 4, YP + 9, C0 - 4, C0 + 4, YP + 10, C0 + 4, "steel", 4)
    return g


def leg() -> Grid:
    g = Grid(3, 12, 14)
    bar(g, "x", (10.0, 1.5), (1.4, 12.0), 2.4, 0, 3, "steel", 4)
    P.flat(g, (g.a > 0) & (coords(g)[1] < 2), "iron", 5)
    return g


def fin() -> Grid:
    g = Grid(9, 1, 7)
    m = box(g, 0, 0, 0, 9, 1, 7, "blue", 4)
    X, Y, Z = coords(g)
    P.flat(g, m & ((np.floor(X) % 3 == 0) | (np.floor(Z) % 3 == 0)), "steel", 6)
    P.flat(g, m & ((X < 1) | (X > 8) | (Z < 1) | (Z > 6)), "steel", 4)
    return g


def build() -> Asset:
    root = Part("landing-beacon", body())
    for k, ry in enumerate((30.0, 150.0, 270.0)):
        root.add(Part(f"leg-{k}", leg(), pivot=(1.5, 0.0, 0.0), at=(C0, 1.0, C0), rot=(0.0, ry, 0.0)))
    root.add(Part("solar-fin", fin(), pivot=(0.0, 0.5, 3.5), at=(C0 + 2.5, 16.0, C0), rot=(0.0, 0.0, 35.0)))
    return Asset(id="space-props-landing-beacon", pack="space", category="props", name="Landing Beacon", root=root,
                 # the solar fin tilts to follow the light
                 clips=[Clip("idle", {"solar-fin": {"rot": sway(6.0, amp=(0.0, 0.0, 8.0))}})])
