"""A patched farm tractor with a lifting scrap bucket."""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _bld import bloom, rig, wheel_grid
from pnkit import box, edges
from voxgrid import C, Asset, Clip, Grid, Socket

GW, GH, GD = 66, 78, 96
CX = 33


def build() -> Asset:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    # A low hood and a high rear fender give the tractor its farm silhouette.
    g.prism("x", [(15, 7), (37, 7), (42, 16), (41, 42), (34, 49), (16, 49), (13, 40), (13, 16)], 18, 48, C("teal", 5))
    shell = S.last(g)
    P.plates(g, shell, "teal", 5, size=(11, 9), rivets=True, seed=3)
    hood = box(g, 22, 29, 8, 44, 44, 36, "teal", 5)
    P.flat(g, hood & (Y > 40), "bone", 6)
    P.flat(g, hood & (Y < 33), "teal", 4)
    P.flat(g, shell & (Y > 45), "teal", 7)
    # Front grille and the large, square lamps.
    grille = box(g, 25, 24, 6, 41, 35, 8, "steel", 5)
    P.flat(g, grille & (X % 3 == 0), "iron", 3)
    P.outline(g, grille, "steel", 3, normal="z")
    for x in (19, 45):
        lamp = box(g, x, 36, 8, x + 3, 41, 10, "bone", 7)
        P.outline(g, lamp, "gold", 5, normal="z")
    # Engine detail and a tall sooted exhaust.
    for y in (20, 24, 28):
        box(g, 18, y, 19, 21, y + 2, 31, "steel", 5)
    pipe = S.disc(g, "y", 23, 22, 2, 38, 69, "iron", 5, n=8)
    P.flat(g, pipe & (Y > 63), "darkwood", 4)
    cap = S.disc(g, "y", 23, 22, 3, 66, 70, "steel", 5, n=8)
    P.flat(g, cap & (Y == 69), "iron", 3)
    chassis=box(g,18,14,36,48,23,86,"steel",5)
    P.plates(g,chassis,"steel",5,size=(8,5),seed=31)
    S.disc(g,"x",16,72,3,5,61,"steel",5,n=8)
    box(g,25,23,47,41,43,64,"teal",5)
    box(g,26,47,58,40,60,62,"darkwood",5)
    # Seat, steering column and a high roll bar.
    box(g, 27, 43, 49, 39, 47, 58, "darkwood", 5)
    S.bar(g, "x", (47, 47), (55, 39), 1.4, 31, 35, "steel", 6)
    for x in (19, 45):
        S.bar(g, "z", (x, 47), (x + (1 if x < CX else -1), 69), 2, 55, 58, "steel", 5)
    S.bar(g, "x", (69, 56), (69, 58), 2, 19, 47, "steel", 5)
    # Rear fenders and broad steps.
    for x0, x1 in ((5, 17), (49, 61)):
        fender = box(g, x0, 30, 59, x1, 34, 87, "teal", 5)
        P.flat(g, fender & (Y == 33), "bone", 5)
        P.flat(g, edges(fender), "darkwood", 4)
        box(g, x0 + 1, 24, 64, x1 - 1, 28, 76, "steel", 4)
    # Loader arms and the wide toothed bucket. The sloped cutting edge reads as a bucket.
    for x0 in (13, 50):
        S.bar(g, "x", (40, 13), (29, 1), 2.4, x0, x0 + 4, "steel", 5)
        S.bar(g, "x", (39, 34), (40, 13), 2.4, x0, x0 + 4, "steel", 5)
    bloom(g, shell, 6, ((18, 14, 10), (48, 45, 49)), r=(2, 3.5), ramp="rust", shades=(5, 4), seed=8)
    wheels = [wheel_grid(g.shape, x0, x0 + 9, z, r, rim=("steel", 5), hub=("gold", 5), spokes=6, tyre=("gray", 3))
              for x0, z, r in ((7, 23, 9), (50, 23, 9), (5, 72, 15), (52, 72, 15))]
    hinge = (33.0, 23.0, 11.0)
    root, clips, sockets = rig("tractor", g, wheels, (23, 69, 22), spin_s=1.0, bounce=0.35,
                               body_parts=[("bucket", loader_bucket(), hinge, (0.0, 0.0, 0.0), None, None)])
    point = (33.0, 16.0, 2.0)
    sockets.append(Socket("socket-bucket", at=tuple(point[i] - root.pivot[i] for i in range(3)), parent="bucket"))
    raise_bucket = [(0.0, (0.0, 0.0, 0.0)), (0.6, (18.0, 0.0, 0.0)), (1.2, (18.0, 0.0, 0.0)), (1.8, (0.0, 0.0, 0.0))]
    clips.append(Clip("active", {"bucket": {"rot": raise_bucket}}))
    return Asset(id="apocalypse-vehicles-tractor", pack="apocalypse", category="vehicles", name="Farm Tractor",
                 root=root, clips=clips, sockets=sockets,
                 pfx=[{"effectId": "rvx-apocalypse-exhaust-smoke", "socket": "socket-exhaust", "trigger": "idle", "size": 20},
                      {"effectId": "rvx-apocalypse-dust-kick", "socket": "socket-bucket", "trigger": "clip:active", "size": 24}])


def loader_bucket() -> Grid:
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)
    bucket = box(g, 8, 12, 0, 58, 23, 11, "steel", 5)
    P.plates(g, bucket, "steel", 5, size=(9, 7), seed=4)
    PP.hazard(g, bucket & (Y < 16), period=7)
    for x in range(12, 56, 8):
        g.prism("x", [(10, 1), (15, 1), (15, 5)], x, x + 4, C("iron", 5))
    P.flat(g, bucket & (Z < 2) & (X % 4 == 0), "bone", 6)
    return g
