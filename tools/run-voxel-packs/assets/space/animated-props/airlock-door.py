"""Airlock door, in the Pirate Nation mecha style.

A heavy bulkhead: two riveted steel posts that lean in (true slopes), a
tapered lintel with an oversized orange AIRLOCK sign, triangular gussets in
the top corners of the opening, hazard-striped jambs and sill, copper
pistons and a teal keypad. Two white hull leaves meet on a diagonal seam;
each has a teal porthole and a hazard foot. On `open` they slide sideways
into the posts, on `close` they slide back; the amber lamp on the lintel
turns on `idle`. The opening is 26 x 42, so a person walks through.
Faces -Z.
"""
import numpy as np

from _life import P, Clip, Grid, Rig, asset, band, box, coords, edges, front, hazard, keys, ngon_y, plated, spin
import pnglyph

W, H, D = 52, 62, 18
ZF, ZB = 2, 14  # frame front and back planes
ZD0, ZD1 = 6, 10  # door leaves
XO0, XO1, YO0, YO1 = 13, 39, 3, 45  # the opening
YL = 53  # lintel top
SLIDE = 14


def frame() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    sill = box(g, 1, 0, ZF - 1, W - 1, YO0, ZB + 1, "steel", 4)
    P.flat(g, sill, "steel", 4)
    hazard(g, sill & (Y > YO0 - 1), period=4, frame="top")
    posts = front(g, [(1, YO0), (XO0, YO0), (XO0, YO1), (4, YO1)], ZF, ZB, "steel", 5)
    posts |= front(g, [(XO1, YO0), (W - 1, YO0), (W - 4, YO1), (XO1, YO1)], ZF, ZB, "steel", 5)
    plated(g, posts, "steel", 5, size=(12, 8), seed=1)
    lintel = front(g, [(2, YO1), (W - 2, YO1), (W - 5, YL), (5, YL)], ZF, ZB, "steel", 4)
    plated(g, lintel, "steel", 4, size=(10, 10), seed=2)
    # the gussets in the top corners of the opening, front and back lips
    gus = np.zeros(g.shape, dtype=bool)
    for z0, z1 in ((ZF, ZD0 - 1), (ZD1 + 1, ZB)):
        gus |= front(g, [(XO0, YO1), (XO0, YO1 - 7), (XO0 + 7, YO1)], z0, z1, "orange", 5)
        gus |= front(g, [(XO1, YO1), (XO1 - 7, YO1), (XO1, YO1 - 7)], z0, z1, "orange", 5)
    P.flat(g, gus, "orange", 5)
    P.outline(g, gus, "orange", 3, normal="z")
    # hazard-striped jambs: the post faces that look into the opening
    jamb = (posts & ((np.abs(X - XO0) < 1.01) | (np.abs(X - XO1) < 1.01)) & (Y < YO1 - 1))
    hazard(g, jamb, period=6, frame="x")
    # the sign: an orange panel on the lintel front with pale letters
    sign = lintel & (Z < ZF + 1) & (Y > YO1 + 0.5) & (Y < YL - 0.5) & (X > 6) & (X < W - 6)
    P.flat(g, sign, "orange", 5)
    P.outline(g, sign, "orange", 3, normal="z")
    tw, th = pnglyph.text_size("AIRLOCK")
    pnglyph.text(g, "-z", ZF, W // 2 - tw // 2, YO1 + 1, "AIRLOCK", "bone", 7)
    # copper pistons on both posts, with steel collars
    for px in (6, W - 9):
        rod = box(g, px, 8, ZF - 2, px + 3, 38, ZF, "rust", 6)
        P.flat(g, rod & (X > px + 1.5), "rust", 5)
        for yy in (8, 20, 35):
            P.flat(g, box(g, px - 1, yy, ZF - 2, px + 4, yy + 3, ZF, "steel", 4), "steel", 4)
    # keypad on the right post (the viewer's right is low x)
    pad = box(g, 5, 22, ZF - 1, 11, 30, ZF, "steel", 3)
    P.flat(g, pad & (Y > 26), "cyan", 6)
    for k, (bx, by) in enumerate(((6, 23), (8, 23), (6, 25), (8, 25))):
        P.flat(g, pad & (np.floor(X) == bx) & (np.floor(Y) == by), "gold" if k == 0 else "cyan", 5)
    # lamp base on the lintel
    ngon_y(g, W / 2, (ZF + ZB) / 2, 5.5, YL, YL + 2, "steel", 3)
    return g


def leaf(s: int) -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    mid = W / 2
    if s < 0:  # left as drawn (low x): the viewer's right
        pts = [(XO0 - 2, YO0), (mid + 3, YO0), (mid - 3, YO1), (XO0 - 2, YO1)]
    else:
        pts = [(mid + 3, YO0), (XO1 + 2, YO0), (XO1 + 2, YO1), (mid - 3, YO1)]
    m = front(g, pts, ZD0, ZD1, "orange", 6)
    P.plates(g, m, "orange", 6, size=(14, 10), rivets=False, seed=3 + s)
    for yy in (17, 40):
        band(g, m, 1, yy, yy + 2, "steel", 5)
    hazard(g, m & (Y < YO0 + 5), period=4, a=("orange", 5), b=("steel", 4))
    # an orange stripe along the diagonal seam
    seam = m & (np.abs((X - mid) + (Y - (YO0 + YO1) / 2) * 6 / (YO1 - YO0)) < 3.2)
    P.flat(g, seam, "bone", 6)
    P.outline(g, m, "orange", 4, normal="z")
    # a teal porthole at eye height
    wx = mid - 8 if s < 0 else mid + 8
    win = m & (np.abs(X - wx) < 3.5) & (np.abs(Y - 33) < 4.5)
    P.flat(g, win, "cyan", 6)
    P.flat(g, win & (Y > 35), "cyan", 7)
    P.outline(g, win, "steel", 4, normal="z")
    return g


def lamp() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    cz = (ZF + ZB) / 2
    dome = ngon_y(g, W / 2, cz, 5, YL + 2, YL + 6, "orange", 5, r_top=3)
    P.flat(g, dome, "orange", 5)
    P.flat(g, dome & (X < W / 2), "gold", 7)  # the lit reflector side
    cap = ngon_y(g, W / 2, cz, 3, YL + 6, YL + 7, "steel", 4)
    del cap
    return g


def build():
    rig = Rig()
    rig.add("airlock", frame(), (W / 2, 0, (ZF + ZB) / 2))
    rig.add("door-l", leaf(-1), (XO0, YO0, ZD0), "airlock")
    rig.add("door-r", leaf(1), (XO1, YO0, ZD0), "airlock")
    rig.add("lamp", lamp(), (W / 2, YL + 2, (ZF + ZB) / 2), "airlock")
    z = (0.0, 0.0, 0.0)
    open_ = {"door-l": {"loc": keys((0, z), (0.25, (-1, 0, 0)), (1.0, (-SLIDE, 0, 0)))},
             "door-r": {"loc": keys((0, z), (0.25, (1, 0, 0)), (1.0, (SLIDE, 0, 0)))},
             "lamp": {"rot": spin(1.0, "y", 360)}}
    close = {"door-l": {"loc": keys((0, (-SLIDE, 0, 0)), (0.8, (-1, 0, 0)), (1.0, z))},
             "door-r": {"loc": keys((0, (SLIDE, 0, 0)), (0.8, (1, 0, 0)), (1.0, z))},
             "lamp": {"rot": spin(1.0, "y", 360)}}
    idle = {"lamp": {"rot": spin(2.0, "y", 360)}}
    return asset("animated-props", "airlock-door", "Airlock Door", rig.root,
                 clips=[Clip("idle", idle), Clip("open", open_, loop=False), Clip("close", close, loop=False)])
