"""Supply drop pod, in the Pirate Nation mecha style.

One iconic shape (rule K3): an upright capsule of stacked octagonal
frustums (true slopes, F2) in white hull plates with orange heat-shield
bands, landed on three swept fins with steel foot pads. A framed hatch with a
glowing cyan porthole faces the front. A red nose beacon tops it. The pod
leans a little after the landing (F5). Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import lamp, ngon_prism
from pnshapes import coords, facets
from voxgrid import C, Asset, Grid, Part

S = 20
C0 = S / 2


def capsule() -> Grid:
    g = Grid(S, 30, S)
    X, Y, Z = coords(g)
    ngon_prism(g, "y", C0, C0, 6.0, 0, 4, "iron", 5, r_top=8.0)  # the heat shield
    ngon_prism(g, "y", C0, C0, 8.0, 4, 17, "bone", 5, r_top=7.0)
    ngon_prism(g, "y", C0, C0, 7.0, 17, 23, "bone", 5, r_top=4.0)
    ngon_prism(g, "y", C0, C0, 4.0, 23, 25, "orange", 5, r_top=3.0)
    m = g.a > 0
    # Keep the nose cone clean. Frame only the larger cylindrical hull plates.
    for f, fr in facets(g, g.solids[1:2]):
        U, V = P.uv(g, fr)
        P.flat(g, f, "bone", 5)
        seams = ((U % 12 == 0) | ((V == 10) | (V == 15))) & f
        P.flat(g, seams, "steel", 4)
        rivets = ((U % 12 == 1) & ((V == 11) | (V == 14))) & f
        P.flat(g, rivets, "steel", 5)
    for f, _fr in facets(g, g.solids[2:3]):
        P.flat(g, f, "bone", 5)
        # One clean service seam breaks the long white nose cone.
        P.flat(g, f & (Y == 20), "steel", 4)
    shield = m & (Y < 4)
    P.flat(g, shield, "iron", 5)
    P.flat(g, shield & (np.floor(np.arctan2(Z - C0, X - C0) * 16 / 6.283) % 2 == 0), "iron", 6)
    # Orange thermal collars sit between white hull sections.
    P.flat(g, m & (Y > 4) & (Y < 6), "orange", 5)
    P.flat(g, m & (Y > 16) & (Y < 18), "orange", 5)
    P.flat(g, m & (Y >= 4) & (Y < 5), "steel", 4)
    P.flat(g, m & (Y >= 17) & (Y < 18), "steel", 4)
    # The five-sided hull has two sloped front facets around its nose point.
    # Place the hatch on the left facet, above the landing fins.
    front = m & (Z < C0 - 6.5 + 0.72 * np.abs(X - C0)) & (Y > 8) & (Y < 18)
    hatch = front & (np.abs(X - 6.0) < 3.6) & (Y > 9) & (Y < 17)
    P.flat(g, hatch, "steel", 3)
    inset = front & (np.abs(X - 6.0) < 2.8) & (Y > 10) & (Y < 16)
    P.flat(g, inset, "bone", 6)
    # Oversized status porthole framed in steel.
    radius = np.hypot(X - 6.0, Y - 13.0)
    ring = front & (radius >= 2.2) & (radius < 3.0)
    glass = front & (radius < 2.2)
    P.flat(g, ring, "steel", 4)
    P.flat(g, glass, "teal", 5)
    P.flat(g, glass & (X < C0) & (Y > 11), "cyan", 7)
    # Small orange latch below the window.
    P.flat(g, front & (np.abs(X - 6.0) < 1.6) & (np.abs(Y - 10.0) < 0.6), "orange", 6)
    # A broad framed service window marks the side panel.
    side = m & (X > C0 + 4.0 - 0.32 * np.abs(Z - 7.5)) & (Y > 9) & (Y < 16)
    side_frame = side & (np.abs(Z - 11.5) < 3.6)
    P.flat(g, side_frame, "steel", 3)
    side_glass = side & (np.abs(Z - 11.5) < 2.7) & (Y > 10) & (Y < 15)
    P.flat(g, side_glass, "teal", 5)
    P.flat(g, side_glass & (Y > 12), "cyan", 7)
    lamp(g, C0, 25, C0, r=1.8, h=2, glass=("red", 5), cap=("steel", 4))
    return g


def fin() -> Grid:
    g = Grid(5, 12, 11)
    g.prism("x", [(0, 0), (0, 8), (7, 5), (10, 2), (11, 0)], 0, 5, C("orange", 5))
    m = g.a > 0
    P.flat(g, m & (coords(g)[1] < 2), "orange", 3)
    _, Y, Z = coords(g)
    # Paint a thin dark root edge. Keep the large fin faces orange.
    P.flat(g, m & (Y < 1), "iron", 3)
    # Broad steel foot pads give each fin a stable landing point.
    P.flat(g, m & (Y < 2) & (Z > 7), "steel", 5)
    P.flat(g, m & (Y < 1) & (Z > 8), "steel", 3)
    return g


def build() -> Asset:
    root = Part("supply-pod", None)
    pod = root.add(Part("capsule", capsule(), pivot=(C0, 0.0, C0), at=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 5.0)))
    for k, ry in enumerate((0.0, 120.0, 240.0)):
        pod.add(Part(f"fin-{k}", fin(), pivot=(1.0, 0.0, -5.0), at=(0.0, 0.0, 0.0), rot=(0.0, ry + 60.0, 0.0)))
    return Asset(id="space-props-supply-pod", pack="space", category="props", name="Supply Drop Pod", root=root)
