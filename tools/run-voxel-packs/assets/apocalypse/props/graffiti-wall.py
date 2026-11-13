"""Tagged concrete wall, in the Pirate Nation style.

A fence piece that still reads as one icon (rules K3, F6): a chunky
concrete slab on two footings, framed top and bottom in dark trim, with its
far panel knocked out of line (rule F5). The front carries one legible
signal-red RUN tag over a hazard band and a zombie-teal splash; the back
carries panel seams, rust bleeding from the tie bolts and chipped render.
Razor wire runs along the crown and sandbags and rubble dress the foot.
Blocks, cracks, rust and the tag are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, pillow, root, rubble, weeds
from pnkit import box, edges
from pnshapes import bar, coords
from voxgrid import Grid

GW, GH, GD = 34, 28, 20
WX0, WX1, WZ0, WZ1 = 1, 25, 8, 14  # the main slab
WY0, WY1 = 2, 22


def panel() -> Grid:
    """The end panel, knocked out of line."""
    g = Grid(9, WY1 - WY0, WZ1 - WZ0)
    X, Y, Z = coords(g)
    m = box(g, 0, 0, 0, 9, WY1 - WY0 - 3, WZ1 - WZ0, "stone", 5)
    pnpaint.concrete(g, m, "stone", 5, size=10, cracks=8, seed=4)
    P.flat(g, edges(m), "stone", 2)
    P.flat(g, m & (Y > WY1 - WY0 - 5), "stone", 3)
    P.flat(g, m & (np.floor(X + Y) % 11 == 2), "rust", 4)
    P.flat(g, m & (Z < 1) & (np.hypot(X - 4, Y - 9) < 3.0), "teal", 4)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, 28, WZ1 + 2, seed=1)
    weeds(g, 3, WZ0 - 4, seed=2)
    for fx in (WX0 + 1, 11, WX1 - 7):
        f = box(g, fx, 0, WZ0 - 2, fx + 6, WY0 + 2, WZ1 + 2, "stone", 4)
        pnpaint.concrete(g, f, "stone", 4, size=7, cracks=5, seed=fx)
        P.flat(g, edges(f), "stone", 2)
    slab = box(g, WX0, WY0, WZ0, WX1, WY1, WZ1, "stone", 6)
    pnpaint.concrete(g, slab, "stone", 6, size=12, cracks=9, seed=3)
    P.flat(g, edges(slab), "stone", 2)
    P.flat(g, slab & (Y > WY1 - 3), "stone", 4)  # the dark capping
    P.flat(g, slab & (Y < WY0 + 2), "stone", 4)
    chips(g, slab, ((WX0, 8, WZ0, 4.2), (WX1, 16, WZ1, 3.6), (14, WY1, WZ1, 3.4), (6, WY0, WZ1, 3.0)), "rust", 5, seed=5)
    P.grime(g, slab, height=5, seed=6)
    # the back: tie-bolt rows with rust bleeding below them
    back = slab & (Z > WZ1 - 1)
    for by in (WY0 + 5, WY0 + 12):
        for bx in range(WX0 + 3, WX1 - 2, 6):
            P.flat(g, back & (np.abs(X - bx) < 1.1) & (np.abs(Y - by) < 1.1), "steel", 4)
            P.flat(g, back & (np.abs(X - bx) < 0.8) & (Y < by) & (Y > by - 5), "rust", 4)
    P.flat(g, back & (np.floor(Y) % 9 == 3), "stone", 5)  # the pour seams
    # the front: a hazard band, one legible tag and a teal splash
    front = slab & (Z < WZ0 + 1)
    pnpaint.hazard(g, front & (Y > WY0 + 1) & (Y < WY0 + 4), period=5, a=("gold", 7), b=("darkwood", 3), frame="z")
    P.flat(g, front & (Y > 6) & (Y < 19) & (X > 1) & (X < 24), "stone", 7)  # a bleached panel for the tag
    P.flat(g, front & ((np.floor(X + Y) % 13) == 4) & (Y > 6) & (Y < 19), "stone", 6)
    tw, th = pnglyph.text_size("RUN", scale=2)
    pnglyph.text(g, "-z", WZ0, 2, 8, "RUN", "red", 4, scale=2)
    P.flat(g, front & (np.abs((Y - 7) - 0.12 * (X - 3)) < 0.6) & (X > 2) & (X < 23), "red", 3)  # the underline
    P.flat(g, front & (X > 20) & (X < 23) & (Y > 11) & (Y < 20), "teal", 4)  # a spray drip
    P.flat(g, front & (X > 21) & (X < 22) & (Y > 8) & (Y < 12), "teal", 5)
    # razor wire along the crown, on two short standards
    for sx in (WX0 + 3, WX1 - 5):
        box(g, sx, WY1, WZ0 + 1, sx + 2, WY1 + 5, WZ0 + 3, "steel", 5)
    for wy in (WY1 + 2, WY1 + 4):
        w = box(g, WX0 + 2, wy, WZ0 + 1, WX1 - 2, wy + 1, WZ0 + 3, "steel", 4)
        P.flat(g, w & (np.floor(X) % 4 == 0), "steel", 6)
    # sandbags and rubble at the foot
    for k, (sx, ang, ramp) in enumerate(((7, 7, "sand"), (17, -5, "khaki"))):
        bagm = pillow(g, sx, WZ0 - 3, 0, 11, 7, 6, angle=ang, ramp=ramp, base=5, puff=1.5)
        P.flat(g, bagm & (np.floor(X + Z) % 5 == 0), ramp, 3)
        P.outline(g, bagm, ramp, 3, normal="y")
        box(g, sx - 1, 5, WZ0 - 5, sx + 2, 7, WZ0 - 3, "darkwood", 3)
    rubble(g, 26.0, WZ0 - 3, 0, 3.2, 3.0, seed=7, ramp="stone", base=4)
    r = root("graffiti-wall", g)
    child(r, "panel", panel(), pivot=(0.0, 0.0, 0.0), at_grid=(float(WX1), float(WY0), float(WZ0)), rot=(0.0, -11.0, 3.0))
    return asset("graffiti-wall", "Tagged Wall", r)
