"""Potter's shelf in the Pirate Nation style.

An open three-tier timber rack in warm grained wood with dark framed
posts, holding glazed ware in cyan, magenta, leaf-green and royal blue
banded in cream and gold (rule C3). Every pot sits inside its bay with a
clear gap, so the silhouette stays readable at thumbnail size (rule F6).
The back is a royal-blue shop panel inside a planked wood frame, carrying
one bold cream amphora sign built from true diagonals. The oversized
function prop is the tall amphora standing clear of the rack on a straw
ring (rule F4). About 36 wide and 36 tall.
"""

import numpy as np

import paint as P
from _props import coords, plank_box, tufts
from pnkit import box, edges
from pnshapes import cone, disc, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 36, 38, 20
PX = (2, 21)  # the rack side posts (3 thick)
ZF, ZB = 2, 13
S1, S2, TOP = 14, 24, 34
BAYS = (3, S1, S2)  # the three shelf floors


def pot(g: Grid, cx, cz, y0, r, h, ramp, shade, band="bone", neck=True):
    """A glazed pot: a round belly, a banded shoulder and a flared lip."""
    X, Y, Z = coords(g)
    Yi = np.floor(Y).astype(int)
    m = cone(g, "y", cx, cz, r, y0, y0 + h * 0.45, ramp, shade, n=8, r_top=r * 0.6, tip="lo")
    m |= cone(g, "y", cx, cz, r, y0 + h * 0.45, y0 + h * 0.8, ramp, shade, n=8, r_top=r * 0.6)
    if neck:
        m |= cone(g, "y", cx, cz, r * 0.6, y0 + h * 0.8, y0 + h, ramp, shade, n=8, r_top=r * 0.75)
    P.flat(g, m, ramp, shade)
    P.flat(g, m & (Z < cz - r * 0.45), ramp, min(7, shade + 1))  # the lit front
    P.flat(g, m & (Y > y0 + h * 0.75), ramp, min(7, shade + 1))
    P.flat(g, m & (Y < y0 + h * 0.18), ramp, max(1, shade - 1))
    P.flat(g, m & (np.abs(Y - (y0 + h * 0.70)) < 0.6), band, 7)  # one banded shoulder, high up
    P.flat(g, m & (np.abs(Y - (y0 + h * 0.78)) < 0.6), "gold", 6)
    if neck:
        P.flat(g, m & (Y > y0 + h - 1.1), band, 7)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the rack: two grained posts, three shelves, a plank cap and a plinth
    for px in PX:
        post = box(g, px, 0, ZF, px + 3, TOP, ZB, "wood", 5)
        P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=px)
        P.flat(g, post & (Zi == ZF), "wood", 6)  # the lit front face
        P.flat(g, edges(post), "darkwood", 3)
        P.flat(g, post & (Yi < 2), "darkwood", 3)
    for sy in (S1, S2):
        sh = plank_box(g, PX[0], sy - 2, ZF - 1, PX[1] + 3, sy, ZB, "wood", 6, across="y", width=4, seed=sy)
        P.flat(g, sh & (Yi == sy - 2), "darkwood", 3)
    cap = plank_box(g, PX[0] - 1, TOP, ZF - 2, PX[1] + 4, TOP + 2, ZB + 1, "wood", 6, across="y", width=4, seed=3)
    P.flat(g, cap & (Yi == TOP), "darkwood", 3)
    base = plank_box(g, PX[0] - 1, 0, ZF - 1, PX[1] + 4, 3, ZB, "wood", 5, across="y", width=3, seed=4)
    P.flat(g, base & (Yi < 1), "darkwood", 3)

    # the back: a royal-blue shop panel inside a planked wood frame
    frame = box(g, PX[0], 3, ZB - 2, PX[1] + 3, TOP, ZB, "wood", 5)
    P.planks(g, frame, "wood", 5, width=3, across="y", frame="z", nails=True, seed=6)
    inner = frame & (Zi == ZB - 2)  # a lime-washed inner face, so the ware reads in the bays
    P.planks(g, inner, "bone", 7, width=4, across="x", frame="z", nails=False, grain=False, seed=8)
    P.flat(g, inner & (((Xi + Yi) % 7) == 0), "bone", 6)
    panel = frame & (Zi == ZB - 1) & (Xi > PX[0] + 1) & (Xi < PX[1] + 1) & (Yi > 5) & (Yi < TOP - 2)
    P.flat(g, panel, "blue", 3)
    P.mottle(g, panel, "blue", 3, cell=4, seed=7)
    P.outline(g, panel, "blue", 2, normal="z")
    sign = panel
    cx, cy = 12.0, 19.0
    belly = sign & ((np.abs(X - cx) + np.abs(Y - cy) * 0.85) < 6.4)  # a true-diagonal diamond belly
    neck = sign & (np.abs(X - cx) < 2.6) & (Y > cy + 4.4) & (Y < cy + 9.0)
    lip = sign & (np.abs(X - cx) < 4.6) & (Y >= cy + 9.0) & (Y < cy + 11.0)
    foot = sign & (np.abs(X - cx) < 3.4) & (Y > cy - 9.0) & (Y <= cy - 7.0)
    mark = belly | neck | lip | foot
    P.flat(g, mark, "bone", 7)
    P.flat(g, mark & ((np.abs(X - cx) + np.abs(Y - cy) * 0.85) > 5.2) & belly, "bone", 5)
    P.flat(g, mark & (Y > cy + 8.8), "bone", 6)  # the lip reads a shade down

    # the shelves of glazed ware, each pot inside its bay with a clear gap
    ware = (("cyan", 5), ("magenta", 5), ("leaf", 5), ("red", 5), ("gold", 5), ("cyan", 4))
    for b, y0 in enumerate(BAYS):
        for k, px in enumerate((9, 16)):
            ramp, shade = ware[(b * 2 + k) % len(ware)]
            if b == 1 and k == 1:  # one stack of bowls instead of a pot (rule F5)
                for t in range(3):
                    bowl = disc(g, "y", px, 5.8, 3.2 - t * 0.5, y0 + t * 2, y0 + t * 2 + 2, "bone", 7, n=8)
                    P.flat(g, bowl, "bone", 7)
                    P.flat(g, bowl & (Yi == y0 + t * 2), "blue", 4)
                continue
            pot(g, px, 5.8, y0 + 1, 3.2, 9, ramp, shade, band="bone", neck=(k != 1))

    # the tall amphora standing clear of the rack, on a straw ring
    ring = disc(g, "y", 30, 8, 4.6, 0, 2, "gold", 5, n=8)
    P.thatch(g, ring, "gold", 5, band=3, frame="top", seed=5)
    P.flat(g, ring & (np.hypot(X - 30, Z - 8) > 3.8), "gold", 3)
    big = pot(g, 30, 8, 2, 4.8, 22, "blue", 4, band="bone")
    for sgn in (-1, 1):  # two handles
        hd = box(g, 30 + sgn * 4, 15, 6, 30 + sgn * 6, 21, 10, "blue", 4)
        P.flat(g, hd, "blue", 4)
        P.flat(g, hd & ((Yi > 19) | (Yi < 17)), "blue", 5)
        P.flat(g, edges(hd), "blue", 2)
    P.flat(g, big & (np.abs(Y - 13) < 2.4) & (Zi < 6), "bone", 7)
    P.flat(g, big & (np.abs(Y - 13) < 1.0) & (Zi < 6), "gold", 6)

    # a broken pot and a clear grass tuft at the foot
    brk = cone(g, "y", 29, 16, 3.0, 0, 4, "leaf", 5, n=8, r_top=2.2, tip="lo")
    P.flat(g, brk, "leaf", 5)
    P.flat(g, brk & (Yi > 2) & (Xi > 29), "leaf", 3)
    P.flat(g, brk & (Yi == 3), "leaf", 6)
    tufts(g, [(25, 15), (33, 12)], ramp="leaf", flowers=[("gold", 6), ("red", 5)])

    root = Part("pottery-shelf", g)
    return Asset(id="fantasy-props-pottery-shelf", pack="fantasy", category="props", name="Pottery Shelf", root=root)
