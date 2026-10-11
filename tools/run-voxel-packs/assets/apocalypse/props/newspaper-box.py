"""Street newspaper box, in the Pirate Nation style.

One chunky icon (rule K3): a signal-red vending box on one thick steel
pedestal and a grounded foot plate, so the whole prop reads as a single
object. The oversized function prop is the bright front page behind a
proud steel frame: a bone sheet with a dark masthead, a red rule, two
headline bars, a photo block and columns of type, all painted pixels
(rule S1), so the window reads white at 128 px instead of as a dark hole
(rule F6). The lid stands open on two hinge barrels at a deliberate angle
and one folded paper leans out of the opening (rule F5). A hazard-yellow
coin plate marks the slot, the pull handle sits beside it, the side carries
a painted price plate, and the wear is three rust blooms with run-off plus
mould at the foot, never speckle over a face (rules S3, S4).
"""
import numpy as np

import paint as P
import pnglyph
from _props import asset, child, chips, root, rust_runs, seam_rust
from pnkit import box, edges
from pnshapes import coords
from voxgrid import Grid

# Real scale: a street newspaper box is about 1.1 m high. The person is
# 36 voxels (1.8 m), so the box stands about 24 high (class appliance).
GW, GH, GD = 30, 28, 22
BX0, BX1 = 6, 24  # the body
BZ0, BZ1 = 3, 17
YF, YP, YB = 1, 4, 21  # foot plate top, pedestal top, body top
WX0, WX1, WY0, WY1 = 8, 22, 11, 19  # the display window


def lid() -> Grid:
    """The hinged lid: a framed red slab with a steel top plate."""
    g = Grid(BX1 - BX0, 3, BZ1 - BZ0)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, g.shape[0], 3, g.shape[2], "red", 5)
    P.plates(g, m, "red", 5, size=(8, 7), seed=11)
    P.flat(g, m & (Y > 2), "steel", 6)
    P.flat(g, m & (Y > 2) & ((X < 2) | (X > g.shape[0] - 2) | (Z < 2) | (Z > g.shape[2] - 2)), "steel", 4)
    P.flat(g, m & (Y < 1), "red", 4)
    P.flat(g, edges(m), "red", 3)
    chips(g, m, ((3.0, 1.5, 2.0, 2.6), (14.0, 3.0, 11.0, 2.2)), "rust", 5, seed=12)
    return g


def paper() -> Grid:
    """One folded newspaper leaning out of the open box."""
    g = Grid(8, 7, 3)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 8, 7, 3, "sand", 7)
    P.flat(g, m & (np.floor(Y) % 3 == 0), "sand", 6)  # the stacked sheet edges
    P.flat(g, m & (Y > 5) & (Z < 1), "darkwood", 4)  # the masthead
    P.flat(g, m & (np.abs(Y - 4.5) < 0.6) & (Z < 1), "red", 5)
    P.flat(g, m & (Y > 1) & (Y < 3.5) & (Z < 1) & (X > 4), "steel", 5)  # the photo
    P.flat(g, edges(m), "sand", 5)
    return g


def _window(g: Grid) -> None:
    """The display window: the last front page behind a proud steel frame."""
    X, Y, Z = coords(g)
    page = P.region(g, WX0, WY0, BZ0, WX1, WY1, BZ0 + 1)
    P.flat(g, page, "bone", 7)
    P.flat(g, page & (Y < WY0 + 1.5), "bone", 5)  # the sheet curls into shadow at the fold
    P.flat(g, page & (X > WX1 - 1.5), "bone", 6)
    # the masthead, a red rule and one headline: a few marks on a white sheet,
    # so the page stays bright and the window reads at 128 px (rules S3, F6)
    P.flat(g, page & (Y > WY1 - 1.5), "darkwood", 3)  # the masthead
    P.flat(g, page & (np.abs(Y - (WY1 - 2.0)) < 0.5), "red", 5)  # the rule under it
    for yy, x1 in ((WY1 - 4, WX1 - 2),):  # one headline bar
        P.flat(g, page & (np.abs(Y - yy) < 0.6) & (X > WX0 + 1) & (X < x1), "darkwood", 3)
    photo = page & (X > WX1 - 6) & (X < WX1 - 1) & (Y > WY0 + 0.5) & (Y < WY0 + 4.5)
    P.flat(g, photo, "steel", 7)
    P.flat(g, photo & (np.abs(X - (WX1 - 3.5)) < 1.1) & (Y > WY0 + 2), "steel", 3)  # the figure in the photo
    P.outline(g, photo, "darkwood", 3, normal="z")
    for yy in (WY0 + 1.5, WY0 + 3.5):  # two lines of type
        P.flat(g, page & (np.abs(Y - yy) < 0.5) & (X > WX0 + 1) & (X < WX1 - 7), "darkwood", 5)
    # the proud frame: four thick steel members round the page (rules F3, S4)
    for x0, y0, x1, y1 in ((BX0, WY1, BX1, WY1 + 2), (BX0, WY0 - 2, BX1, WY0),
                           (BX0, WY0, WX0, WY1), (WX1, WY0, BX1, WY1)):
        f = box(g, x0, y0, BZ0 - 2, x1, y1, BZ0, "steel", 5)
        P.flat(g, f & (Z < BZ0 - 1), "steel", 6)
        P.flat(g, edges(f), "steel", 3)


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the grounded foot plate and the one thick pedestal
    foot = box(g, BX0 + 1, 0, BZ0 + 1, BX1 - 1, YF, BZ1 - 1, "steel", 4)
    P.flat(g, foot & (Y > YF - 1), "steel", 6)
    P.flat(g, edges(foot), "steel", 3)
    col = box(g, 11, YF, 6, 19, YP + 1, 14, "steel", 5)
    P.plates(g, col, "steel", 5, size=(7, 7), seed=1)
    P.flat(g, edges(col), "steel", 3)
    # the body
    body = box(g, BX0, YP, BZ0, BX1, YB, BZ1, "red", 5)
    P.plates(g, body, "red", 5, size=(10, 9), seed=2)
    P.flat(g, edges(body), "red", 3)
    P.flat(g, body & (Y > YB - 2), "red", 6)
    seam_rust(g, body, (YP + 0.5, YB - 0.5), shade=5)
    rust_runs(g, body, ((BX1, YB - 5, BZ1 - 4, 3.2), (BX0, YP + 3, BZ0 + 8, 2.8), (BX0 + 8, YB, BZ1, 2.6)), base=5, drip=5, seed=3)
    chips(g, body | col, ((BX0, YP, BZ0 + 5, 3.4),), "teal", 4, seed=4)
    # the open top: the inside with the paper edges showing
    inside = P.region(g, BX0 + 2, YB - 1, BZ0 + 2, BX1 - 2, YB, BZ1 - 2)
    P.flat(g, inside, "steel", 4)
    P.flat(g, inside & (Z < BZ0 + 7), "sand", 6)
    _window(g)
    # the hazard-yellow coin plate with its slot, and the pull handle beside it
    plate = P.region(g, WX0, YP + 1, BZ0 - 1, WX0 + 7, WY0 - 2, BZ0 + 1)
    P.flat(g, plate, "gold", 6)
    P.flat(g, plate & (Y > WY0 - 4), "gold", 4)
    P.outline(g, plate, "darkwood", 4, normal="z")
    P.flat(g, P.region(g, WX0 + 2, YP + 3, BZ0 - 1, WX0 + 5, YP + 4, BZ0 + 1), "darkwood", 2)  # the slot
    for bx in (WX0 + 9, WX1 - 3):  # the pull handle on two brackets
        box(g, bx, YP + 2, BZ0 - 2, bx + 2, YP + 6, BZ0, "steel", 4)
    grip = box(g, WX0 + 9, YP + 3, BZ0 - 3, WX1 - 1, YP + 5, BZ0 - 1, "steel", 6)
    P.flat(g, grip & (Y > YP + 4), "steel", 7)
    P.flat(g, edges(grip), "steel", 4)
    # the price plate on the +x side
    side = P.region(g, BX1 - 1, YP + 7, BZ0, BX1, YB - 1, BZ1)
    P.flat(g, side, "gold", 6)
    P.flat(g, side & (Y > YB - 2), "gold", 4)
    P.outline(g, side, "darkwood", 4, normal="x")
    pnglyph.text(g, "+x", BX1, BZ0 + 2, YP + 8, "25", "darkwood", 2)
    # the two hinge barrels at the back of the opening
    for hx in (BX0 + 2, BX1 - 5):
        hb = box(g, hx, YB, BZ1 - 3, hx + 3, YB + 3, BZ1, "steel", 5)
        P.flat(g, edges(hb), "steel", 3)
    P.grime(g, foot | col, height=3, seed=6)
    r = root("newspaper-box", g)
    child(r, "lid", lid(), pivot=(9.0, 0.0, 13.0), at_grid=(15.0, float(YB), float(BZ1 - 1)), rot=(5.0, 0.0, 2.0))
    child(r, "paper", paper(), pivot=(4.0, 0.0, 1.5), at_grid=(15.0, float(YB - 3), float(BZ0 + 4)), rot=(-14.0, 0.0, -13.0))
    return asset("newspaper-box", "Street Newspaper Box", r)
