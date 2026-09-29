"""Hydroponic planter, in the Pirate Nation mecha style.

One chunky icon (rule K3): a white hull grow trough with a sloped front
(a true slope, F2) on steel legs, full of oversized alien seedlings: curly
teal fronds (tilted blades), glowing green bulb pods and a big magenta spore
cap. A violet grow-light bar glows over it on two copper posts, and a blue
water line with a gauge runs along the front. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _pn import pipe
from _props import dots, hull, ngon_prism
from pnkit import box, edges
from pnshapes import bar, coords, cone, facets
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, D = 30, 16
X0, X1, Z0, Z1 = 2, 28, 3, 14
YB, YT = 5, 12  # trough bottom and top


def trough() -> Grid:
    g = Grid(W, 30, D)
    X, Y, Z = coords(g)
    for x0 in (X0 + 1, X1 - 4):
        for z0 in (Z0 + 1, Z1 - 4):
            leg = box(g, x0, 0, z0, x0 + 3, YB, z0 + 3, "steel", 4)
            P.flat(g, edges(leg), "steel", 3)
    g.prism("x", [(YB, Z0 + 2), (YB, Z1), (YT, Z1), (YT, Z0 - 1)], X0, X1, C("bone", 5))
    t = g.solids[-1].mask(g.shape)
    for m, fr in facets(g):
        P.plates(g, m, "bone", 5, size=(9, 8), frame=fr)
    P.flat(g, edges(t), "bone", 3)
    P.flat(g, t & (np.abs(Y - 9.5) < 0.6), "teal", 4)  # a teal band round the trough
    soil = t & (Y > YT - 1) & (X > X0 + 1) & (X < X1 - 1) & (Z > Z0) & (Z < Z1 - 1)
    P.flat(g, soil, "rust", 2)
    P.flat(g, soil & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=4) % np.uint64(4) == 0), "rust", 3)
    # the water line and a gauge along the front
    pipe(g, [(X0 + 1, 3.5, Z0 - 0.5), (X1 - 1, 3.5, Z0 - 0.5)], s=2, ramp="sky", base=3)
    front = t & (Z < Z0 + 1.5) & (Y < 9)
    dots(g, front, "-z", [(7.5, 7), (22.5, 7)], 1.5, "gold", 6)
    # grow-light posts and bar
    for xx in (X0 + 1, X1 - 3):
        post = box(g, xx, YT, Z1 - 3, xx + 2, 27, Z1 - 1, "rust", 4)
        P.flat(g, post & (np.floor(Y) % 4 == 0), "rust", 6)
    lb = box(g, X0, 25, Z1 - 5, X1, 28, Z1, "steel", 4)
    P.flat(g, edges(lb), "steel", 3)
    P.flat(g, lb & (Y < 26), "purple", 6)
    P.flat(g, lb & (Z < Z1 - 4) & (Y > 26) & (Y < 27), "purple", 6)
    P.flat(g, lb & (Y < 26) & (np.floor(X) % 3 == 0), "magenta", 7)
    # plants: glowing bulb pods and a spore cap on a stalk
    for cx, cz, h in ((8, 8, 4), (20, 10, 3)):
        stalk = box(g, cx - 0.5, YT, cz - 0.5, cx + 0.5, YT + h, cz + 0.5, "leaf", 4)
        pod = ngon_prism(g, "y", cx, cz, 2.0, YT + h, YT + h + 3, "toxic", 4, r_top=1.0)
        P.flat(g, pod & (Y > YT + h + 2), "toxic", 6)
    box(g, 14, YT, 7, 16, YT + 6, 9, "leaf", 3)
    cap = cone(g, "y", 15, 8, 4.5, YT + 6, YT + 10, "magenta", 5, n=8, r_top=1.5)
    P.flat(g, cap & (Y < YT + 7), "magenta", 3)
    P.flat(g, cap & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), np.floor(Y).astype(int), seed=2) % np.uint64(5) == 0), "pink", 6)
    return g


def frond(length: float, curl: float) -> Grid:
    """A curly teal frond: two tilted blades (true slopes)."""
    g = Grid(12, 14, 3)
    bar(g, "z", (2, 0.5), (4, length * 0.6), 2.2, 0, 3, "teal", 5)
    bar(g, "z", (4, length * 0.6), (4 + curl, length), 1.6, 0.5, 2.5, "teal", 6)
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y < 2), "teal", 3)
    return g


def build() -> Asset:
    root = Part("hydro-planter", trough())
    for k, (x, z, ry, rz, ln, cu) in enumerate(((5, 11, 20, 10, 10, 3), (11, 6, -30, -8, 12, 4), (24, 7, 60, 12, 11, 3), (19, 12, 170, -5, 9, 4), (25, 12, -120, 6, 8, 3))):
        root.add(Part(f"frond-{k}", frond(ln, cu), pivot=(2.0, 0.0, 1.5), at=(float(x), float(YT), float(z)), rot=(0.0, float(ry), float(rz))))
    return Asset(id="space-props-hydro-planter", pack="space", category="props", name="Hydroponic Planter", root=root,
                 # the fronds sway, each out of step with the next
                 clips=[Clip("idle", {f"frond-{k}": {"rot": sway(4.0, amp=(3.0, 0.0, 4.0), phase=(1.3 * k, 0.0, 1.3 * k + 1.0))} for k in range(5)})])
