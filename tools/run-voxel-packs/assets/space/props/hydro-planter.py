"""Hydroponic planter, in the Pirate Nation mecha style.

A framed white hull trough carries alien seedlings under a teal grow light.
Painted panel seams, a cyan grow readout and hazard-orange service marks
make its hydroponic function clear. Faces -Z.
"""
import numpy as np

import paint as P
from _props import ngon_prism
from pnkit import box, edges
from pnshapes import coords, cone, facets
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
        P.plates(g, m, "bone", 5, size=(11, 8), rivets=True, frame=fr)
    P.flat(g, edges(t), "steel", 4)
    P.flat(g, t & (Y < 7), "steel", 4)
    P.flat(g, t & (np.abs(Y - 9.5) < 0.6), "teal", 4)
    P.flat(g, t & (np.abs(Y - 8) < 0.6), "bone", 6)
    front_skin = t & (Z < Z0 + 2) & (Y > 6) & (Y < 9.5)
    # Painted divisions stay in the front wall area.
    for seam_x in (9, 21):
        P.flat(g, front_skin & (np.abs(X - seam_x) < 0.55), "steel", 4)
    soil = t & (Y > YT - 1) & (X > X0 + 1) & (X < X1 - 1) & (Z > Z0) & (Z < Z1 - 1)
    P.flat(g, soil, "rust", 3)
    P.flat(g, soil & (P._hash(np.floor(X).astype(int), np.floor(Z).astype(int), seed=4) % np.uint64(5) == 0), "rust", 4)
    # A compact grow readout sits in the center of the front hull wall.
    panel = front_skin & (X > 11) & (X < 20) & (Y > 6.5) & (Y < 9)
    P.flat(g, panel, "steel", 3)
    P.flat(g, panel & (X > 12) & (X < 19) & (Y > 8), "cyan", 6)
    P.flat(g, panel & (X > 12) & (X < 19) & (Y > 7) & (Y < 8), "teal", 7)
    P.flat(g, panel & (X > 12) & (X < 19) & (Y > 6.5) & (Y < 7), "orange", 6)
    # grow-light posts and bar
    for xx in (X0 + 1, X1 - 3):
        post = box(g, xx, YT, Z1 - 3, xx + 2, 27, Z1 - 1, "rust", 4)
        P.flat(g, post & (np.floor(Y) % 4 == 0), "rust", 6)
    lb = box(g, X0, 25, Z1 - 5, X1, 28, Z1, "steel", 4)
    P.flat(g, edges(lb), "steel", 3)
    P.flat(g, lb & (Y < 26), "teal", 5)
    P.flat(g, lb & (Z < Z1 - 4) & (Y > 26) & (Y < 27), "cyan", 6)
    P.flat(g, lb & (Y < 26) & (np.floor(X) % 5 == 0), "cyan", 7)
    P.flat(g, lb & (Z < Z1 - 4) & (Y < 26) & (np.floor(X) % 9 == 0), "orange", 6)
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


def frond(length: float, lean: float) -> Grid:
    """One rooted, pointed frond with a painted central vein."""
    g = Grid(8, 15, 3)
    cx = 2.5
    tip = cx + lean
    g.prism("z", [(cx - 0.6, 0), (cx + 0.6, 0), (cx + 1.0, length * 0.38),
                   (tip + 0.55, length - 1.0), (tip, length), (tip - 0.55, length - 1.0),
                   (cx - 1.0, length * 0.38)], 0, 2, C("teal", 5))
    leaf = g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    P.flat(g, leaf & (np.abs(X - (cx + lean * Y / max(1, length))) < 0.55), "teal", 7)
    P.flat(g, leaf & (Y < 2), "teal", 3)
    return g


def build() -> Asset:
    root = Part("hydro-planter", trough())
    for k, (x, z, ry, rz, ln, lean) in enumerate(((5, 11, 18, 5, 8, -1.5), (9, 5, -32, -4, 8, 1.4), (22, 12, 48, 5, 8, -1.0), (25, 6, -55, -5, 7, 1.2))):
        root.add(Part(f"frond-{k}", frond(ln, lean), pivot=(2.5, 0.0, 1.0), at=(float(x), float(YT), float(z)), rot=(0.0, float(ry), float(rz))))
    return Asset(id="space-props-hydro-planter", pack="space", category="props", name="Hydroponic Planter", root=root,
                 # the fronds sway, each out of step with the next
                 clips=[Clip("idle", {f"frond-{k}": {"rot": sway(4.0, amp=(2.0, 0.0, 2.5), phase=(1.3 * k, 0.0, 1.3 * k + 1.0))} for k in range(4)})])
