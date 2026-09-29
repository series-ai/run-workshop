"""Supply drop pod, in the Pirate Nation mecha style.

One iconic shape (rule K3): an upright capsule of stacked octagonal
frustums (true slopes, F2) in white hull plates with orange heat-shield
bands, landed on three swept fins and scorched dark at the foot. A big
painted hatch with a glowing teal status strip faces the front and a red
nose beacon tops it. The pod leans a little after the landing (F5). Detail
is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import lamp, ngon_prism
from pnkit import box
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
    for f, fr in facets(g, g.solids[1:3]):
        P.plates(g, f, "bone", 5, size=(6, 5), rivets=True, frame=fr)
    shield = m & (Y < 4)
    P.flat(g, shield, "iron", 5)
    P.flat(g, shield & (np.floor(np.arctan2(Z - C0, X - C0) * 16 / 6.283) % 2 == 0), "iron", 6)
    # orange heat-shield bands
    P.flat(g, m & (Y > 4) & (Y < 6), "orange", 5)
    P.flat(g, m & (Y > 16) & (Y < 18), "orange", 5)
    # scorch marks near the foot
    sc = m & (Y < 9) & (Y > 4) & (P._hash(np.floor(X).astype(int) // 2, np.floor(Y).astype(int) // 2, np.floor(Z).astype(int) // 2, seed=3) % np.uint64(3) == 0)
    P.flat(g, sc, "rust", 2)
    # the hatch on the front facet
    front = m & (Z < C0 - 6.5) & (Y > 6) & (Y < 16)
    hatch = front & (np.abs(X - C0) < 3.3)
    P.flat(g, hatch, "bone", 6)
    P.flat(g, hatch & ((np.abs(X - C0) > 2.4) | (Y < 7) | (Y > 15)), "steel", 3)
    P.flat(g, hatch & (np.abs(Y - 11.5) < 0.6) & (np.abs(X - C0) < 1.6), "orange", 6)  # the handle
    # glowing status strip down the +x facet
    P.flat(g, m & (X > C0 + 6.5) & (np.abs(Z - C0) < 1.2) & (Y > 6) & (Y < 16), "cyan", 6)
    lamp(g, C0, 25, C0, r=1.8, h=2, glass=("red", 5), cap=("steel", 4))
    return g


def fin() -> Grid:
    g = Grid(2, 12, 9)
    g.prism("x", [(0, 0), (0, 8), (9, 1), (11, 0)], 0, 2, C("orange", 5))
    m = g.a > 0
    P.flat(g, m & (coords(g)[1] < 1), "orange", 3)
    P.flat(g, m & (coords(g)[2] > 6), "iron", 5)  # a scorched tip
    return g


def build() -> Asset:
    root = Part("supply-pod", None)
    pod = root.add(Part("capsule", capsule(), pivot=(C0, 0.0, C0), at=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 5.0)))
    for k, ry in enumerate((0.0, 120.0, 240.0)):
        pod.add(Part(f"fin-{k}", fin(), pivot=(1.0, 0.0, -5.0), at=(0.0, 0.0, 0.0), rot=(0.0, ry + 60.0, 0.0)))
    return Asset(id="space-props-supply-pod", pack="space", category="props", name="Supply Drop Pod", root=root)
