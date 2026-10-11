"""Xeno containment cage, in the Pirate Nation mecha style.

One iconic shape (rule K3): a steel cage on a hazard plinth with thick dark
corner posts and a chamfered lid (F2, F3). The oversized feature is the
specimen inside: a toxic-green xeno blob with two big cartoon eyes and a
grin, its claws hooked over the bars. A copper warning plate with a skull
hangs askew on the front (F5), a teal keypad locks the door, and a glowing
containment bar runs round the lid. Detail is paint (S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _life import cartoon_eye
from _props import cham_prism, dots, lamp, ngon_prism
from pnkit import box, edges
from pnshapes import coords, facets
from voxgrid import C, Asset, Grid, Part, Socket

W, D = 30, 26
X0, X1, Z0, Z1 = 2, 28, 2, 24
YP, YT = 5, 30  # plinth top and cage top
BARS_X = (7, 22)  # bar centres on the front and back
BARS_Z = (12,)  # bar centres on the sides


def cage() -> Grid:
    g = Grid(W, 38, D)
    X, Y, Z = coords(g)
    # hazard plinth on four stubby feet
    for fx, fz in ((X0 + 1, Z0 + 1), (X1 - 4, Z0 + 1), (X0 + 1, Z1 - 4), (X1 - 4, Z1 - 4)):
        ft = box(g, fx, 0, fz, fx + 3, 2, fz + 3, "iron", 3)
        P.flat(g, edges(ft), "iron", 2)
    pl = cham_prism(g, "y", X0, Z0, X1, Z1, 3, 2, YP, "iron", 4)
    pnpaint.hazard(g, pl, period=4, a=("orange", 5), b=("iron", 4))
    P.flat(g, pl & (Y > YP - 1), "iron", 5)
    # the cage floor pan and four thick corner posts
    pan = box(g, X0 + 2, YP, Z0 + 2, X1 - 2, YP + 2, Z1 - 2, "steel", 4)
    P.plates(g, pan, "steel", 4, size=(7, 7), seed=1)
    P.flat(g, edges(pan), "steel", 2)
    posts = np.zeros(g.shape, dtype=bool)
    for px, pz in ((X0 + 1, Z0 + 1), (X1 - 4, Z0 + 1), (X0 + 1, Z1 - 4), (X1 - 4, Z1 - 4)):
        posts |= box(g, px, YP, pz, px + 3, YT, pz + 3, "iron", 5)
    P.flat(g, posts, "iron", 5)
    P.flat(g, edges(posts), "iron", 3)
    P.flat(g, posts & (np.floor(Y) % 6 == 2), "gold", 6)
    # bars: 2 thick, framed dark (F3 keeps members thick)
    bars = np.zeros(g.shape, dtype=bool)
    for bx in BARS_X:
        bars |= box(g, bx, YP + 2, Z0 + 1, bx + 2, YT, Z0 + 3, "steel", 5)
        bars |= box(g, bx, YP + 2, Z1 - 3, bx + 2, YT, Z1 - 1, "steel", 5)
    for bz in BARS_Z:
        bars |= box(g, X0 + 1, YP + 2, bz, X0 + 3, YT, bz + 2, "steel", 5)
        bars |= box(g, X1 - 3, YP + 2, bz, X1 - 1, YT, bz + 2, "steel", 5)
    P.flat(g, bars, "steel", 5)
    P.flat(g, bars & (np.floor(Y) % 7 == 4), "steel", 3)
    P.flat(g, bars & (Y > YT - 4), "steel", 6)
    # the chamfered lid with a glowing containment bar and a lamp
    n0 = len(g.solids)
    lid = cham_prism(g, "y", X0, Z0, X1, Z1, 3, YT, YT + 4, "steel", 5, inset=1.5)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "steel", 5, size=(8, 4), frame=fr, seed=4)
    P.flat(g, edges(lid), "steel", 3)
    P.flat(g, lid & (np.abs(Y - (YT + 1)) < 0.7), "cyan", 6)
    P.flat(g, lid & (np.abs(Y - (YT + 1)) < 0.7) & (np.floor(X + Z) % 4 == 0), "cyan", 7)
    lamp(g, 24.0, YT + 4, 20.0, r=1.7, h=2, glass=("orange", 6), cap=("steel", 3))
    # the keypad lock on the front door frame
    kp = box(g, 14, 12, Z0, 18, 18, Z0 + 1, "steel", 4)
    P.flat(g, kp, "steel", 4)
    P.flat(g, edges(kp), "steel", 2)
    P.flat(g, kp & (Z < Z0 + 1) & (Y > 15), "teal", 5)
    dots(g, kp & (Z < Z0 + 1), "-z", [(15.5, 13.5), (17.0, 13.5)], 0.9, "cyan", 6)
    return g


def sign() -> Grid:
    """A copper hazard plate with a painted skull, hung askew."""
    g = Grid(14, 7, 2)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 14, 7, 2, "rust", 5)
    P.flat(g, m, "rust", 5)
    P.flat(g, m & (Y > 5.5), "rust", 6)
    P.flat(g, edges(m), "rust", 3)
    P.flat(g, m & (Z < 1) & ((Y < 1.5) | (Y > 5.5)), "orange", 5)
    pnglyph.icon(g, "-z", 0, 3, 0, "skull", "bone", 7, depth=1, reach=2)
    return g


def xeno() -> Grid:
    """The specimen: a toxic blob with a big face, a ridged back and claws."""
    g = Grid(20, 18, 18)
    X, Y, Z = coords(g)
    n0 = len(g.solids)
    body = ngon_prism(g, "y", 10, 9, 8.0, 0, 9, "toxic", 5, r_top=7.0)
    ngon_prism(g, "y", 10, 9, 7.0, 9, 14, "toxic", 5, r_top=3.2)
    for m, fr in facets(g, g.solids[n0:]):
        P.plates(g, m, "toxic", 5, size=(9, 9), rivets=False, frame=fr)
    whole = (g.a > 0)
    P.flat(g, whole, "toxic", 5)
    P.flat(g, whole & (Y > 10), "lime", 5)
    P.flat(g, whole & (Y < 2), "toxic", 3)
    # back ridge plates
    P.flat(g, whole & (Z > 13) & (np.floor(X) % 3 == 0), "toxic", 3)
    P.flat(g, whole & (Z > 13) & (np.floor(X) % 3 == 1) & (Y > 4), "lime", 6)
    # the face: two big cartoon eyes and a grin
    cartoon_eye(g, "-z", 1.0, 11, 7, 5, outline=("toxic", 2), white=("bone", 7), pupil=("toxic", 1), glint=("bone", 6))
    cartoon_eye(g, "-z", 1.0, 4, 7, 5, outline=("toxic", 2), white=("bone", 7), pupil=("toxic", 1), glint=("bone", 6), mirror=True)
    mouth = whole & (Z < 3) & (X > 5) & (X < 15) & (Y > 2) & (Y < 5)
    P.flat(g, mouth, "toxic", 2)
    P.flat(g, mouth & (np.floor(X) % 3 == 0) & (Y > 3), "bone", 7)  # teeth
    P.flat(g, mouth & (np.floor(X) % 3 == 0) & (Y < 3.5), "bone", 6)
    # two stubby claw arms reaching forward
    for s in (-1, 1):
        arm = box(g, 10 + s * 8 - 2, 5, 1, 10 + s * 8 + 2, 9, 7, "toxic", 4)
        P.flat(g, arm, "toxic", 4)
        P.flat(g, edges(arm), "toxic", 2)
        P.flat(g, arm & (Z < 3), "bone", 6)
        P.flat(g, arm & (Z < 3) & (np.floor(Y) % 2 == 0), "bone", 4)
    del body
    return g


def build() -> Asset:
    root = Part("xeno-cage", cage())
    root.add(Part("xeno", xeno(), pivot=(10.0, 0.0, 9.0), at=(15.0, float(YP) + 2.0, 13.0), rot=(0.0, 9.0, 0.0)))
    root.add(Part("sign", sign(), pivot=(7.0, 0.0, 1.0), at=(9.0, 5.0, float(Z0) - 0.5), rot=(0.0, 0.0, -11.0)))
    socket = Socket("socket-spores", at=(15.0, 22.0, 13.0))
    return Asset(
        id="space-props-xeno-cage", pack="space", category="props", name="Xeno Containment Cage", root=root,
        sockets=[socket], pfx=[{"effectId": "rvx-space-spore-drift", "socket": "socket-spores", "trigger": "idle", "size": 18}],
    )
