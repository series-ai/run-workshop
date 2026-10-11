"""Village notice board in the Pirate Nation style.

Two stout posts in warm grained wood stand on grey-blue stone footings
with grass sprigs, and carry a planked board under a steep rust-tiled
gable (true slopes, rule F2). The oversized function prop is the sheaf of
cream notices pinned to it (rules F4 and C3): each one carries its own
content — lines of text with a red wax seal, a painted quest symbol, or a
small torn bill — so they never read as shutters. A flame-red header bar
with a gold crown tops the board. About 36 wide and 40 tall.
"""

import numpy as np

import paint as P
from _props import coords, glyph, plank_box, stone_box, tufts
from pnkit import box, edges
from pnshapes import facets, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 36, 41, 18
PX = (2, 29)  # post x starts (5 thick)
ZB = 11  # the board plane (front face at ZB - 3)
FOOT = 4  # the stone footing top
BY0, BY1 = 12, 31  # the board
# (x, y, w, h, kind): 0 = lines and a seal, 1 = a quest symbol, 2 = a small torn bill
NOTICES = ((8, 14, 7, 10, 0), (16, 13, 6, 9, 1), (23, 15, 5, 7, 2))


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # grey-blue stone footings with grass sprigs, so nothing stands on bare ends
    for px in PX:
        pad = stone_box(g, px - 2, 0, ZB - 6, px + 7, FOOT, ZB + 6, "stone", 3, block=(5, 3), rim=-2, seed=px)
        P.flat(g, pad & (Yi == FOOT - 1), "stone", 4)
        P.stone(g, pad & (Yi == FOOT - 1), "stone", 4, block=(4, 3), frame="top", seed=px + 1)
    tufts(g, [(0, ZB - 7), (34, ZB + 5), (13, ZB - 7)], ramp="leaf", flowers=[("gold", 6), ("red", 5)])

    # two posts with vertical grain, dark framed corners and a lit front edge
    for px in PX:
        post = box(g, px, FOOT - 1, ZB - 3, px + 5, 33, ZB + 3, "wood", 5)
        P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=px)
        P.flat(g, post & (Zi == ZB - 3), "wood", 6)  # the lit front face
        P.flat(g, edges(post), "darkwood", 3)
        P.flat(g, post & (Yi < FOOT + 1), "darkwood", 4)
        P.flat(g, post & (Yi >= FOOT + 2) & (Yi < FOOT + 4), "iron", 4)  # an iron band at the foot

    # the planked board with a dark frame
    board = plank_box(g, PX[0] + 2, BY0, ZB - 3, PX[1] + 3, BY1, ZB + 1, "wood", 6, across="y", width=4, seed=1)
    P.flat(g, board & ((Yi < BY0 + 1) | (Yi >= BY1 - 1)), "darkwood", 3)
    header = box(g, PX[0] + 2, BY1 - 6, ZB - 5, PX[1] + 3, BY1 - 1, ZB - 3, "red", 4)
    P.flat(g, header, "red", 4)
    P.mottle(g, header, "red", 4, cell=3, seed=5)
    P.flat(g, header & ((Yi == BY1 - 6) | (Yi == BY1 - 2)), "gold", 6)
    glyph(g, "-z", ZB - 5, 13, BY1 - 5, "crown", "gold", 7, depth=2)

    # the notices, each with its own content
    for nx, ny, nw, nh, kind in NOTICES:
        note = box(g, nx, ny, ZB - 5, nx + nw, ny + nh, ZB - 3, "bone", 7)
        P.flat(g, note, "bone", 7)
        P.flat(g, note & (Yi == ny), "bone", 5)  # a thin shaded bottom edge, not a bulky frame
        P.flat(g, note & (Yi == ny + nh - 1), "bone", 6)
        if kind == 0:  # lines of text and a red wax seal
            for r in range(3, nh - 2, 2):
                P.flat(g, note & (Zi == ZB - 5) & (Yi == ny + r) & (Xi > nx) & (Xi < nx + nw - 1), "darkwood", 4)
            P.flat(g, note & (Zi == ZB - 5) & (Yi == ny + nh - 3) & (Xi > nx + 1) & (Xi < nx + nw - 3), "darkwood", 2)
            P.flat(g, note & (Zi == ZB - 5) & (np.hypot(X - (nx + nw - 2.5), Y - (ny + 2.0)) < 1.9), "red", 6)
            P.flat(g, note & (Zi == ZB - 5) & (np.hypot(X - (nx + nw - 2.5), Y - (ny + 2.0)) < 1.0), "red", 4)
        elif kind == 1:  # a painted quest symbol over two lines
            glyph(g, "-z", ZB - 5, nx + 1, ny + 3, "tower", "darkwood", 3, depth=2)
            for r in (2,):
                P.flat(g, note & (Zi == ZB - 5) & (Yi == ny + r) & (Xi > nx) & (Xi < nx + nw - 1), "darkwood", 4)
            P.flat(g, note & (Zi == ZB - 5) & (Yi == ny + nh - 2) & (Xi > nx) & (Xi < nx + nw - 1), "red", 5)
        else:  # a small torn bill with one line
            P.flat(g, note & (Zi == ZB - 5) & (Yi == ny + 3) & (Xi > nx) & (Xi < nx + nw - 1), "darkwood", 4)
            P.flat(g, note & (Yi == ny + 1) & (Xi > nx + 1), "bone", 5)
            P.flat(g, note & (Yi == ny) & (Xi < nx + nw - 2), "bone", 5)
        P.flat(g, note & (Zi == ZB - 5) & (np.hypot(X - (nx + 1.5), Y - (ny + nh - 1.5)) < 0.9), "iron", 5)  # the pin

    # the roof: a steep tiled gable with dark barge boards and a ridge beam
    g.prism("z", [(PX[0] - 2, 32), (PX[1] + 7, 32), (18, 39)], ZB - 5, ZB + 4, C("red", 5))
    roof = last(g)
    for m, fr in facets(g, g.solids[-1:]):
        P.tiles(g, m, "red", 5, row=3, width=4, frame=fr, seed=2)
    P.flat(g, roof & (Yi < 33), "darkwood", 3)
    ridge = box(g, 16, 38, ZB - 5, 20, 40, ZB + 4, "darkwood", 4)
    P.flat(g, ridge, "darkwood", 4)
    P.flat(g, ridge & (Yi == 39), "darkwood", 5)

    root = Part("notice-board", g)
    return Asset(id="fantasy-props-notice-board", pack="fantasy", category="props", name="Notice Board", root=root)
