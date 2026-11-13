"""Dead parking meter, in the Pirate Nation style.

One chunky icon (rule K3): a steel head on a hazard-banded post, standing on
a cracked concrete pad. The head carries the function on every side: a big
bone dial with painted ticks, a red needle and a bone EXP flag on the front,
a brass coin slot and an oversized lever on the side, and a stencilled plate
on the back, so the prop reads from all four angles (rule F6). The head
leans a few degrees off true (rule F5). Rubble and weeds dress the foot
(rule K1). Panel seams, rivets, rust and the dial are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, root, rubble, rust_runs, seam_rust, weeds
from pnkit import box, edges, on_face
from pnshapes import coords, disc
from voxgrid import C, Grid

# Real scale: the head sits at chest height of the 36-voxel person, so the
# meter is about 30 high (class appliance).
GW, GH, GD = 22, 32, 22
CX, CZ = 11.0, 11.0
HY0, HY1 = 18, 29  # the head
HX0, HX1, HZ0, HZ1 = 5, 17, 6, 16


def head() -> Grid:
    """The meter head: a plated case with a sloped cap."""
    g = Grid(GW, HY1 - HY0 + 4, GD)
    X, Y, Z = coords(g)
    h = HY1 - HY0
    m = box(g, HX0, 0, HZ0, HX1, h - 2, HZ1, "steel", 6)
    g.prism("y", [(HX0, HZ0), (HX1, HZ0), (HX1, HZ1), (HX0, HZ1)], h - 2, h + 2, C("steel", 6),
            top=[(HX0 + 3, HZ0 + 2), (HX1 - 3, HZ0 + 2), (HX1 - 3, HZ1 - 2), (HX0 + 3, HZ1 - 2)])
    cap = g.solids[-1].mask(g.shape)
    m |= cap
    P.plates(g, m, "steel", 6, size=(7, 6), seed=1)
    P.flat(g, cap & (Y > h - 1), "steel", 7)
    P.flat(g, edges(m), "steel", 3)
    rust_runs(g, m, ((HX0, 4, HZ1, 2.6), (HX1, h - 4, HZ0, 2.2)), base=5, drip=4, seed=3)
    # the front: one big bone dial above a zombie-teal credit window
    fy = 6.8
    face = disc(g, "z", CX, fy, 4.0, HZ0 - 2, HZ0, "bone", 7)
    rr = np.hypot(X - CX, Y - fy)
    P.flat(g, face, "bone", 7)  # one clean face
    P.flat(g, face & (rr > 3.2), "steel", 2)  # the dark bezel
    P.flat(g, face & (rr > 2.6) & (rr < 3.2), "steel", 5)  # its lit lip
    P.flat(g, face & (rr > 1.4) & (rr < 2.2) & (Y > fy + 0.6) & (X < CX - 0.6), "teal", 3)  # the paid arc
    P.flat(g, face & (rr < 2.1) & (np.abs((Y - fy) + (X - CX)) < 0.9) & (X > CX), "red", 4)  # one needle
    P.flat(g, face & (rr < 0.9), "darkwood", 2)  # its boss
    # the credit window under the dial: one lit teal bar, painted flat
    disp = m & (Z < HZ0 + 1) & (X > HX0 + 2) & (X < HX1 - 2) & (Y > 0.5) & (Y < 2.5)
    P.flat(g, disp, "teal", 2)
    P.flat(g, disp & (np.abs(Y - 1.5) < 0.6) & (np.floor(X) % 3 != 0), "toxic", 5)  # the segments still lit
    P.outline(g, disp, "darkwood", 1, normal="z")
    # the +x side: a brass coin slot in a plate, and a big lever
    plate = box(g, *on_face("+x", HX1, HZ0 + 3, HZ1 - 3, 4, h - 5, 0, 1), "steel", 5)
    P.outline(g, plate, "steel", 2, normal="x")
    coin = disc(g, "x", float(h - 6), CZ, 2.6, HX1 + 1, HX1 + 3, "gold", 4)
    P.flat(g, coin, "gold", 4)
    P.flat(g, coin & (np.hypot(Y - (h - 6), Z - CZ) < 1.5), "gold", 6)
    P.flat(g, coin & (np.abs(Z - CZ) < 0.7) & (np.abs(Y - (h - 6)) < 1.7), "darkwood", 1)  # its slot
    P.outline(g, coin, "darkwood", 2, normal="x")
    # the -x side: the lever on a bracket
    br = box(g, HX0 - 2, 3, int(CZ) - 2, HX0, 7, int(CZ) + 2, "steel", 4)
    P.flat(g, edges(br), "steel", 2)
    lev = box(g, HX0 - 5, 4, int(CZ) - 2, HX0, 6, int(CZ) + 2, "gold", 4)
    P.flat(g, lev, "gold", 4)
    P.flat(g, lev & (Y > 5), "gold", 5)
    P.flat(g, edges(lev), "darkwood", 2)
    # the back: a stencilled plate and a hazard strip
    bp = box(g, *on_face("+z", HZ1, HX0 + 1, HX1 - 1, 1, h - 3, 0, 1), "steel", 4)
    P.plates(g, bp, "steel", 4, size=(5, 5), seed=4, frame="z")
    P.outline(g, bp, "steel", 2, normal="z")
    pnpaint.hazard(g, bp & (Y > 0.5) & (Y < 2.5), period=6, a=("gold", 4), b=("darkwood", 2), frame="z")
    pnglyph.text(g, "+z", HZ1 + 1, HX0 + 1, 2, "NO", "gold", 6)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    pad = box(g, 1, 0, 1, 21, 3, 21, "stone", 5)
    pnpaint.concrete(g, pad, "stone", 5, size=9, cracks=7, seed=1)
    P.flat(g, edges(pad), "stone", 3)
    rubble(g, 4.0, 17.0, 3, 3.0, 2.6, seed=2, ramp="stone", base=4)
    weeds(g, 16, 16, seed=3)
    weeds(g, 4, 4, seed=4)
    base = box(g, 5, 3, 5, 17, 7, 17, "steel", 5)
    P.plates(g, base, "steel", 5, size=(6, 4), seed=5)
    P.flat(g, edges(base), "steel", 3)
    pole = box(g, 9, 7, 9, 13, HY0 + 1, 13, "steel", 6)
    P.plates(g, pole, "steel", 6, size=(6, 9), rivets=False, seed=6)
    P.flat(g, edges(pole), "steel", 3)
    pnpaint.hazard(g, pole & (Y > 9) & (Y < 14) & (Z < 10), period=8, a=("gold", 4), b=("darkwood", 2), frame="z")
    seam_rust(g, pole | base, (7, 8), shade=4)  # rust on the one joint, nowhere else
    rust_runs(g, pole | base, ((9, 15, 9, 2.0), (13, 8, 13, 2.0)), base=5, drip=4, seed=7)
    r = root("parking-meter", g)
    child(r, "head", head(), pivot=(CX, 0.0, CZ), at_grid=(CX, float(HY0), CZ), rot=(0.0, 0.0, -5.0))
    return asset("parking-meter", "Dead Parking Meter", r)
