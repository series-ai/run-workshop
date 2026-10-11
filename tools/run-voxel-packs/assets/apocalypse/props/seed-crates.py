"""Seed crates, in the Pirate Nation style.

One chunky icon (rule K3): two plank crates stacked with a clear dark frame
between them, so the stack never reads as one brown lump. The upper lid
stands open on a hinge (rule F5) and shows paper seed packets in rows; a
sprouting tray of dark soil and toxic-green shoots sits beside it as the
function prop (rule F4). A zombie-teal sprout stencil and a hazard-yellow
label name the cargo (rule C3), and a trowel is stuck in the soil. Planks,
nails, stencils and wear are paint (rule S1).
"""
import numpy as np

import paint as P
import pnglyph
import pnpaint
from _props import asset, child, chips, crate, root
from pnkit import box, edges
import pnshapes as S
from pnshapes import coords
from voxgrid import C, Grid

GW, GH, GD = 36, 24, 24
AX0, AX1, AZ0, AZ1 = 2, 24, 3, 19  # the lower crate
AY0, AY1 = 0, 11
BX0, BX1, BZ0, BZ1 = 4, 22, 6, 16  # the upper crate
BY0, BY1 = 11, 20  # the upper crate stands on the lower one: no gap
LID_OPEN = 34.0  # degrees: the stack stays near the 24-high original crate


def lid() -> Grid:
    """The open lid of the upper crate."""
    g = Grid(BX1 - BX0, 3, BZ1 - BZ0)
    m = box(g, 0, 0, 0, BX1 - BX0, 2, BZ1 - BZ0, "wood", 5)
    P.planks(g, m, "wood", 5, width=5, across="x", nails=False, seed=2, frame="top")
    P.flat(g, edges(m), "darkwood", 4)
    pnglyph.icon(g, "top", 2, (BX1 - BX0) // 2 - 4, (BZ1 - BZ0) // 2 - 4, "star", "teal", 4)
    return g


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    lo = crate(g, AX0, AY0, AZ0, AX1 - AX0, AY1 - AY0, AZ1 - AZ0, ramp="wood", base=6, frame=("darkwood", 4), seed=3)
    P.flat(g, lo & (Z < AZ0 + 1), "wood", 7)  # the lit front board of the lower crate
    P.flat(g, lo & (Y > AY1 - 1), "wood", 4)  # the dark shadow line under the upper crate
    chips(g, lo, ((AX0, 4, AZ0, 3.0), (AX1, 8, AZ1, 2.8)), "rust", 4, seed=4)
    P.grime(g, lo, height=2, seed=5)
    pnpaint.hazard(g, lo & (Y > 2) & (Y < 8) & (Z < AZ0 + 1), period=8, a=("gold", 4), b=("darkwood", 3), frame="z")
    for by in (2, 8):
        P.flat(g, lo & (np.abs(Y - by) < 0.6) & (Z < AZ0 + 1), "darkwood", 4)  # the band is framed
    # no stencilled word here: four letters at this size break up at 128 px.
    # The hazard band is the marking, and the sprout lives on the lid above.
    # chamfered corner battens: a true 45 degree facet on every corner (rule F2),
    # each cut exactly on the crate corner so no edge is left ragged
    for ix, iz, dx, dz in ((AX0, AZ0, 4, 4), (AX1, AZ0, -4, 4), (AX0, AZ1, 4, -4), (AX1, AZ1, -4, -4)):
        g.prism("y", [(ix, iz), (ix + dx, iz), (ix, iz + dz)], AY0, AY1, C("darkwood", 4))
        bt = S.last(g)
        P.flat(g, bt, "darkwood", 4)
        P.flat(g, bt & (coords(g)[1] > AY1 - 2), "darkwood", 5)
    up = crate(g, BX0, BY0, BZ0, BX1 - BX0, BY1 - BY0, BZ1 - BZ0, ramp="wood", base=7, frame=("darkwood", 4), seed=6)
    P.flat(g, up & (Z < BZ0 + 1), "wood", 7)  # the lit front board of the upper crate
    chips(g, up, ((BX1, BY1 - 2, BZ1, 2.6),), "rust", 4, seed=7)
    # the teal sprout stencil on the upper crate
    ucx = (BX0 + BX1) / 2
    st = up & (Z < BZ0 + 1) & (np.abs(X - ucx) < 5.5) & (Y > BY0 + 1) & (Y < BY0 + 8)
    dx = np.abs(X - ucx)
    P.flat(g, st & (dx < 1.1), "teal", 5)  # the stem
    P.flat(g, st & (np.abs(dx - (Y - (BY0 + 3.0))) < 0.9) & (dx > 1.0) & (dx < 5.0), "teal", 5)  # two leaves
    # the seed packets in rows inside the open crate
    inner = up & (Y > BY1 - 2)
    P.flat(g, inner, "darkwood", 4)
    cols = ((BX0 + 2, "bone"), (BX0 + 6, "red"), (BX0 + 10, "gold"), (BX0 + 14, "teal"))
    for px, ramp in cols:
        pk = inner & (X > px) & (X < px + 3) & (Z > BZ0 + 2) & (Z < BZ1 - 2)
        P.flat(g, pk, ramp, 6)
        P.flat(g, pk & (np.floor(Z) % 4 == 0), ramp, 4)
        P.outline(g, pk, "darkwood", 3, normal="y")
    # the sprouting tray beside the stack: dark soil and toxic-green shoots
    tray = box(g, 25, 0, AZ0, 35, 6, AZ1, "steel", 5)
    P.flat(g, tray, "steel", 5)
    P.flat(g, tray & (Y > 4), "steel", 6)
    P.flat(g, edges(tray), "steel", 2)
    soil = box(g, 26, 5, AZ0 + 1, 34, 7, AZ1 - 1, "darkwood", 4)
    P.flat(g, soil, "darkwood", 4)
    P.flat(g, soil & (Y > 6), "darkwood", 5)
    for k, (sx, sz) in enumerate(((28, AZ0 + 3), (31, AZ0 + 7), (29, AZ1 - 5), (33, AZ0 + 4))):
        sh = box(g, sx, 7, sz, sx + 2, 10 + k % 3, sz + 2, "teal", 4 + k % 2)
        P.flat(g, sh & (coords(g)[1] > 9), "teal", 6)  # the new growth at the tip
    # the trowel stuck in the soil
    box(g, 31, 7, AZ1 - 6, 33, 13, AZ1 - 4, "steel", 6)
    box(g, 31, 13, AZ1 - 6, 33, 17, AZ1 - 4, "gold", 4)
    r = root("seed-crates", g)
    child(r, "lid", lid(), pivot=(0.0, 0.0, float(BZ1 - BZ0)), at_grid=(float(BX0), float(BY1), float(BZ1)), rot=(LID_OPEN, 0.0, -3.0))
    return asset("seed-crates", "Seed Crates", r)
