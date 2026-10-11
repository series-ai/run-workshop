"""V8 engine block on an engine stand, in the Pirate Nation style.

One chunky icon (rule K3): a steel block whose two cylinder banks rise in
a V (true slopes), each capped with a signal-red valve cover, a big round
air cleaner on top, pulleys and a belt on the front and an oil pan
leaking a puddle. It hangs from a hazard-yellow engine stand on castors.
Plates, bolts, the belt and the oil are paint (rule S1).
"""

import numpy as np

import paint as P
import pnglyph
from _props import asset, root
from pnkit import box, edges
from pnshapes import coords, disc, ngon_radius, rotate
from voxgrid import C, Grid

BX, BZ0, BZ1 = 12, 4, 20  # block centre x, front and back z
BY0, BY1 = 6, 15  # block bottom and deck


def bank(g: Grid, side: int) -> None:
    """One cylinder bank: a slab leaning out 30° from the deck, with a red valve cover."""
    cx = BX + side * 3.2
    rect = [(cx - 3.2, BY1 - 1), (cx + 3.2, BY1 - 1), (cx + 3.2, BY1 + 6), (cx - 3.2, BY1 + 6)]
    pts = rotate(rect, cx, BY1, -side * 30)
    g.prism("z", pts, BZ0 + 1, BZ1 - 1, C("steel", 5))
    m = g.solids[-1].mask(g.shape)
    P.plates(g, m, "steel", 5, size=(6, 4), seed=side + 3)
    cover = [(cx - 3.0, BY1 + 6), (cx + 3.0, BY1 + 6), (cx + 2.4, BY1 + 8.5), (cx - 2.4, BY1 + 8.5)]
    g.prism("z", rotate(cover, cx, BY1, -side * 30), BZ0 + 1.5, BZ1 - 1.5, C("red", 5))
    vc = g.solids[-1].mask(g.shape)
    X, Y, Z = coords(g)
    P.flat(g, vc & (np.floor(Z) % 4 == 0), "red", 4)  # ribs


def build():
    g = Grid(28, 30, 26)
    X, Y, Z = coords(g)
    # the oil puddle under the pan
    g.prism("y", [(8, 8), (17, 7), (20, 12), (16, 17), (9, 15)], 0, 1, C("darkwood", 5))
    pud = g.solids[-1].mask(g.shape)
    P.flat(g, pud & (np.hypot(X - 12, Z - 10) < 1.2), "teal", 5)  # an oily sheen
    # the stand: yellow base rails on castors, a post and an arm into the block
    for zz in (BZ0, BZ1 - 3):
        rail = box(g, 3, 1.5, zz, 27, 4, zz + 3, "gold", 5)
        P.flat(g, edges(rail), "gold", 3)
        for xx in (4, 24):
            disc(g, "z", xx, 1.5, 1.5, zz, zz + 3, "steel", 4)
    post = box(g, 23, 4, 10, 27, 22, 14, "gold", 5)
    P.flat(g, edges(post), "gold", 3)
    arm = box(g, 18, 12, 10, 23, 15, 14, "gold", 4)
    # the oil pan and the block
    pan = box(g, BX - 5, BY0 - 2, BZ0 + 2, BX + 5, BY0, BZ1 - 2, "steel", 4)
    P.flat(g, pan & (np.abs(X - BX + 2) < 0.8) & (Z < BZ0 + 3), "darkwood", 5)  # the leak
    blk = box(g, BX - 6, BY0, BZ0, BX + 6, BY1, BZ1, "steel", 5)
    P.plates(g, blk, "steel", 5, size=(8, 5), seed=1)
    P.flat(g, edges(blk), "steel", 3)
    bank(g, -1)
    bank(g, 1)
    # air cleaner between the banks
    ac = disc(g, "y", BX, (BZ0 + BZ1) / 2, 4.5, BY1 + 5, BY1 + 8, "red", 5, n=10)
    P.flat(g, ac & (Y > BY1 + 7), "steel", 6)
    P.flat(g, ac & (Y > BY1 + 7) & (ngon_radius(g, "y", BX, (BZ0 + BZ1) / 2, n=10) < 1.3), "steel", 4)
    box(g, BX - 1.5, BY1, BZ0 + 6, BX + 1.5, BY1 + 5, BZ1 - 6, "steel", 4)
    tw, _ = pnglyph.text_size("V8")
    pnglyph.text(g, "-z", (BZ0 + BZ1) / 2 - 4.5, int(BX - tw / 2), int(BY1 + 5.5), "V8", "bone", 7)
    # pulleys and a belt on the front
    for (px, py, pr) in ((BX, BY0 + 3, 2.8), (BX - 3.5, BY1 - 1, 2.0), (BX + 3.8, BY1, 1.8)):
        p = disc(g, "z", px, py, pr, BZ0 - 2, BZ0, "steel", 6)
        P.flat(g, p & (ngon_radius(g, "z", px, py) > pr - 0.9), "darkwood", 5)  # the belt round it
        P.flat(g, p & (ngon_radius(g, "z", px, py) < 0.8), "gold", 5)
    return asset("engine-block", "Engine Block", root("engine-block", g))
