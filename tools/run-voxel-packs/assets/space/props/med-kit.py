"""Field med kit, in the Pirate Nation mecha style.

One iconic shape (rule K3): an oversized white hull case with chamfered
edges (true slopes, F2), a huge red cross on the front, a thick copper carry
handle, two orange clasps and two glowing stim vials strapped to the +x
side. The lid seam, plates and rivets are paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
from _props import cham_prism, hull, ngon_prism
from pnkit import box, edges
from voxgrid import Asset, Grid, Part
from pnshapes import coords

W, H, D = 22, 14, 12
X0, X1, Z0, Z1 = 1, 19, 1, 11


def build() -> Asset:
    g = Grid(W + 1, H + 5, D)
    X, Y, Z = coords(g)
    # the case: chamfered on its front and back edges (a prism along z)
    case = cham_prism(g, "z", X0, 0, X1, H, 2.5, Z0, Z1, "bone", 5)
    hull(g, case, "bone", 5, size=(9, 7), edge=0, seed=1)
    P.flat(g, case & (np.abs(Y - 9.5) < 0.6), "bone", 2)  # the lid seam
    P.flat(g, case & (Y < 1), "bone", 3)
    P.flat(g, case & ((Z < Z0 + 1) | (Z > Z1 - 1)) & ((X < X0 + 1.2) | (X > X1 - 1.2)), "bone", 3)
    # the big red cross on the front, in a white disc
    front = case & (Z < Z0 + 1)
    cx, cy = (X0 + X1) / 2, 5.5
    P.flat(g, front & (np.abs(X - cx) < 4.6) & (np.abs(Y - cy) < 4.6), "red", 4)
    P.flat(g, front & (np.abs(X - cx) < 3.6) & (np.abs(Y - cy) < 3.6), "bone", 7)
    arm = ((np.abs(X - cx) < 1.1) & (np.abs(Y - cy) < 3.1)) | ((np.abs(X - cx) < 3.1) & (np.abs(Y - cy) < 1.1))
    P.flat(g, front & arm, "red", 5)
    # the same cross on the lid top
    top = case & (Y > H - 1)
    P.flat(g, top & (((np.abs(X - cx) < 1.1) & (np.abs(Z - 6) < 3.1)) | ((np.abs(X - cx) < 3.1) & (np.abs(Z - 6) < 1.1))), "red", 5)
    # clasps
    for xx in (X0 + 3, X1 - 5):
        c = box(g, xx, 7, Z0 - 1, xx + 2, 11, Z0, "orange", 5)
        P.flat(g, c & (Y > 10), "orange", 7)
    # the carry handle: two copper posts and a thick grip
    for xx in (6, 12):
        box(g, xx, H, 5, xx + 2, H + 3, 7, "rust", 3)
    grip = box(g, 6, H + 3, 4, 14, H + 5, 8, "rust", 4)
    P.flat(g, edges(grip), "rust", 3)
    P.flat(g, grip & (Y > H + 4), "rust", 6)
    # two glowing stim vials in a strap on the +x side
    for k, (zc, glass) in enumerate(((3.5, "toxic"), (7.5, "cyan"))):
        v = ngon_prism(g, "y", X1 + 1.5, zc, 1.5, 2, 11, glass, 5, n=6)
        P.flat(g, v & (Y > 8), glass, 7)
        cap = ngon_prism(g, "y", X1 + 1.5, zc, 1.5, 11, 13, "steel", 5, n=6)
        P.flat(g, cap & (Y > 12), "steel", 6)
    strap = box(g, X1, 5, 2, X1 + 3, 7, 10, "orange", 4)
    P.flat(g, strap & (X > X1 + 2), "orange", 5)
    root = Part("med-kit", g)
    return Asset(id="space-props-med-kit", pack="space", category="props", name="Field Med Kit", root=root)
