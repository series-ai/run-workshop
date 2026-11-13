"""Snack vending machine, in the Pirate Nation mecha style.

One chunky iconic shape (rule K3): a hazard-orange cabinet with chamfered
corners (true diagonals) on steel feet, a big glowing teal window full of
painted snacks, a keypad column, and an oversized marquee that leans
back with SNAX in the pixel font. A copper pipe climbs the
side into the marquee (PN mecha pipework). Detail is painted. Faces -Z.
"""
import numpy as np

import paint as P
import pnglyph
from _pn import coords, hazard, last, pipe, text
from pnkit import box, edges, on_face
from voxgrid import C, Asset, Grid, Part

W, H, D = 33, 40, 24
X0, X1, Z0, Z1 = 2, 29, 4, 21  # cabinet; the front is z = Z0
Y0, Y1 = 5, 31  # cabinet bottom and top
CH = 3  # corner chamfer
MH = 11  # marquee height


def cabinet() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    for x, z in ((X0 + 1, Z0 + 1), (X1 - 4, Z0 + 1), (X0 + 1, Z1 - 4), (X1 - 4, Z1 - 4)):
        box(g, x, 0, z, x + 3, 2, z + 3, "steel", 3)  # stubby feet
    plinth = box(g, X0, 2, Z0, X1, Y0, Z1, "steel", 4)
    hazard(g, plinth & (Z < Z0 + 1), period=4, a=("orange", 6), b=("steel", 3))
    P.flat(g, plinth & ~(Z < Z0 + 1), "steel", 4)
    # the cabinet: chamfered in plan, so its corners are true diagonals
    g.prism("y", [(X0 + CH, Z0), (X1 - CH, Z0), (X1, Z0 + CH), (X1, Z1 - CH), (X1 - CH, Z1), (X0 + CH, Z1), (X0, Z1 - CH), (X0, Z0 + CH)], Y0, Y1, C("orange", 5))
    body = last(g)
    P.flat(g, body, "orange", 5)
    P.flat(g, body & (Y > Y1 - 5), "orange", 6)  # lit top band
    P.flat(g, body & (np.abs(Y - (Y1 - 5.5)) < 0.5), "orange", 3)
    P.flat(g, body & ((Y < Y0 + 1) | (Y > Y1 - 1)), "orange", 3)
    # side: a painted white planet logo and a vent on the visible +X side
    side = body & (X > X1 - 1)
    zc, yc = (Z0 + Z1) / 2, 20
    rr = np.hypot(Z - zc, Y - yc)
    P.flat(g, side & (rr < 5.5), "bone", 6)
    P.flat(g, side & (rr < 5.5) & (Y - yc > 1.5), "bone", 7)
    P.flat(g, side & (np.abs((Y - yc) - 0.35 * (Z - zc)) < 0.9) & (np.abs(Z - zc) < 8.5), "cyan", 5)  # the ring
    for yy in (9, 11, 13):
        P.flat(g, side & (np.abs(Y - yy) < 0.5) & (np.abs(Z - zc) < 5), "orange", 3)
    # the big glowing window, 1 voxel proud, in a thick steel frame
    frame = box(g, *on_face("-z", Z0, 11, X1 - 1, 11, 30, 0, 1), "steel", 4)
    P.flat(g, edges(frame), "steel", 3)
    glass = box(g, *on_face("-z", Z0 - 1, 13, X1 - 3, 13, 28, 0, 1), "cyan", 5)
    P.flat(g, glass & (Y > 26), "cyan", 6)
    snacks = [("red", 5), ("gold", 6), ("bone", 7), ("magenta", 5), ("orange", 6), ("toxic", 4), ("gold", 6), ("red", 5)]
    for r, yy in enumerate((13, 18, 23)):
        P.flat(g, glass & (np.abs(Y - (yy + 0.5)) < 0.6), "steel", 5)  # shelf
        for i, xx in enumerate(range(14, X1 - 4, 4)):
            ramp, shade = snacks[(r * 3 + i) % len(snacks)]
            pack = glass & (X > xx) & (X < xx + 3) & (Y > yy + 1) & (Y < yy + 4.5)
            P.flat(g, pack, ramp, shade)
            P.flat(g, pack & (Y > yy + 3.5), ramp, min(7, shade + 1))
    P.flat(g, glass & (np.abs((X - 16) + (Y - 27)) < 0.6) & (Y > 24), "cyan", 7)  # glint
    P.flat(g, glass & (np.abs((X - 19) + (Y - 27)) < 0.6) & (Y > 25), "cyan", 7)
    # keypad column: a small screen, chunky buttons, a coin slot
    pad = box(g, *on_face("-z", Z0, X0 + 2, 10, 11, 30, 0, 1), "steel", 5)
    P.flat(g, edges(pad), "steel", 3)
    P.flat(g, pad & (Y > 24) & (Y < 28) & (X > X0 + 3) & (X < 9), "cyan", 6)
    for yy in (16, 19, 22):
        for xx, col in ((X0 + 3, "gold"), (X0 + 6, "cyan")):
            P.flat(g, pad & (Y > yy) & (Y < yy + 2) & (X > xx) & (X < xx + 2), col, 6)
    P.flat(g, pad & (Y > 12.5) & (Y < 14.5) & (X > X0 + 3.5) & (X < 8.5), "steel", 2)  # coin slot
    # delivery hatch
    hatch = box(g, *on_face("-z", Z0, X0 + 3, X1 - 3, Y0 + 1, 10, 0, 1), "steel", 3)
    P.flat(g, hatch & (Y > 8.5), "steel", 5)
    return g


def marquee() -> Grid:
    """The oversized marquee: an 11-voxel-tall glowing sign whose front
    leans back (a true slope), with SNAX and two bulbs."""
    g = Grid(32, MH, 16)
    X, Y, Z = coords(g)
    g.prism("x", [(0, 1), (0, 15), (MH, 15), (MH, 5)], 0, 32, C("orange", 5))
    m = last(g)
    P.flat(g, m, "orange", 5)
    P.flat(g, m & (np.floor(X) % 8 == 0), "orange", 4)  # panel seams
    P.flat(g, edges(m) & ~(Z < 3), "steel", 4)
    front = m & (Z < 1 + (Y / MH) * 4 + 2.2)
    P.flat(g, front, "cyan", 6)
    P.flat(g, front & ((Y < 2.5) | (Y > MH - 2.5) | (X < 2.5) | (X > 29.5)), "cyan", 4)
    P.flat(g, front & ((Y < 1.5) | (Y > MH - 1.5) | (X < 1.5) | (X > 30.5)), "orange", 5)  # orange frame
    # SNAX in the pixel font, centred (pnglyph reads correctly on the slope)
    tw, _th = pnglyph.text_size("SNAX")
    pnglyph.text(g, "-z", 3, (32 - tw) // 2, 2, "SNAX", "orange", 3, depth=2, reach=3)
    for xx in (2.5, 29.5):  # two marquee bulbs
        P.flat(g, front & (np.abs(X - xx) < 0.6) & (np.abs(Y - 5.5) < 1.1), "gold", 7)
    return g


def build() -> Asset:
    g = cabinet()
    # copper pipe up the back corner of the visible side, into the marquee
    pipe(g, [(X1 + 1, Y0 + 2, Z1 - 3), (X1 + 1, Y1 + 6, Z1 - 3), (X1 + 1, Y1 + 6, 12)], s=3, ramp="rust", base=4)
    vent = box(g, 7, Y1, 17, 24, Y1 + 3, 21, "steel", 4)
    P.flat(g, vent & (np.floor(coords(g)[0]) % 3 == 0), "steel", 2)
    P.flat(g, edges(vent), "steel", 3)
    pivot = (16.0, 0.0, 11.5)  # the centre of the whole model, marquee included
    root = Part("vending-machine", g, pivot=pivot)
    root.add(Part("marquee", marquee(), pivot=(16.0, 0.0, 15.0), at=(15.5 - pivot[0], Y1, 17 - pivot[2]), rot=(0.0, 0.0, -5.0)))
    return Asset(id="space-props-vending-machine", pack="space", category="props", name="Snack Vending Machine", root=root)
