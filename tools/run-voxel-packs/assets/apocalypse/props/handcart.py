"""Loaded hand truck, in the Pirate Nation style.

One clear hand-truck shape (rules K3, F6): an L-frame of two signal-red
rails on a steel toe plate, two cross ties, two handles that bend back at
the top, and two wheels on one axle behind the toe plate. It carries one
load: a zombie-teal drum with a bone band and a painted strap (rule C3).
The truck is 27 high, about 1.4 m beside the 36-voxel person. The toe
plate carries wide hazard stripes on its front face only. Rust sits in a
few blooms that bleed straight down (rules S1-S3). There is no ground pad.
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, root, rust_runs
from _rep_props import no_overlap
from pnkit import box, edges
from pnshapes import bar, coords, disc, drum, wheel
from voxgrid import Grid

GW, GH, GD = 24, 30, 22
RAILS = ((4, 7), (17, 20))  # the two frame rails (x)
RZ0, RZ1 = 10, 13  # the rails in z: the drum stands in front of them
TOP = 22  # the top of the rails
WZ, WR = 15.0, 4.5  # the wheel centre in z, and the wheel radius
DX, DZ, DR, DH = 12.0, 5.2, 4.4, 13  # the drum: centre, flat radius, height


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # the toe plate: the foot of the L, with hazard stripes on its front
    toe = box(g, 3, 0, 1, 21, 2, RZ1, "steel", 5)
    P.flat(g, toe & (Y > 1), "steel", 6)
    P.flat(g, edges(toe), "steel", 3)
    pnpaint.hazard(g, toe & (Z < 2), period=6, a=("gold", 5), b=("darkwood", 4), frame="z")
    # the frame: two rails, two cross ties and a top bar
    frame = np.zeros(g.shape, dtype=bool)
    for x0, x1 in RAILS:
        frame |= box(g, x0, 2, RZ0, x1, TOP, RZ1, "red", 5)
    for ty in (8, 15):
        frame |= box(g, RAILS[0][1], ty, RZ0 + 1, RAILS[1][0], ty + 2, RZ1, "red", 5)
    frame |= box(g, RAILS[0][0], TOP - 2, RZ0, RAILS[1][1], TOP, RZ1, "red", 5)
    P.flat(g, frame, "red", 5)
    P.flat(g, frame & (Z < RZ0 + 1), "red", 6)  # the lit front of the frame
    P.flat(g, edges(frame), "red", 3)
    rust_runs(g, frame, ((RAILS[0][0], 6, RZ0, 1.8), (RAILS[1][1], 18, RZ1, 1.8)), base=4, drip=4, seed=3)
    # the two handles: they bend back from the top of each rail (true slopes)
    grips = np.zeros(g.shape, dtype=bool)
    for x0, x1 in RAILS:
        grips |= bar(g, "x", (TOP - 1.0, RZ0 + 1.5), (TOP + 4.0, RZ1 + 3.5), 2.6, x0, x1, "red", 5)
    P.flat(g, grips, "red", 5)
    P.flat(g, grips & (Y > TOP + 1.8), "darkwood", 5)  # the worn rubber grips
    P.flat(g, grips & (Y > TOP + 3.2), "darkwood", 6)
    # the wheels and the axle behind the toe plate
    for wx in (0, GW - 3):
        wheel(g, "x", WZ, 0, WR, wx, wx + 3, n=10, spokes=5, gaps=False, tyre=("steel", 2), rim=("steel", 4), spoke=("steel", 6), hub=("gold", 4), rim_w=1.6)
    disc(g, "x", WR, WZ, 1.2, 3, GW - 3, "steel", 4)  # the axle
    for x0, x1 in RAILS:  # the axle brackets, bolted to the back of the rails
        br = box(g, x0, 2, RZ1, x1, 8, RZ1 + 4, "steel", 5)
        P.flat(g, br, "steel", 5)
        P.flat(g, edges(br), "steel", 3)
    # the one load: a teal drum standing on the toe plate, against the rails
    load = drum(g, DX, DZ, 2, DH, DR, ramp="teal", base=4, n=8, hoop="teal", band=("bone", 6), wear=False)
    P.flat(g, load & (np.abs(Y - 9.5) < 1.0), "darkwood", 5)  # the strap across the band
    rust_runs(g, load, ((DX - DR, 5.0, DZ, 1.6),), base=5, drip=3, seed=8)
    no_overlap([("drum", load), ("frame", frame | grips)])
    return asset("handcart", "Loaded Hand Truck", root("handcart", g))
