"""Crossroads signpost in the Pirate Nation style.

A chunky planked post with iron bands on footing stones carries three
oversized arrow boards (true-slope points) that tilt a little (rule F5),
each painted with a pixel icon: a castle, a forest and a tavern mug. A
small tiled cap tops the post and a PN-sized lantern hangs under the
forest board. Grass and flowers at the foot. About 38 wide and 40 tall.
"""

import paint as P
from _props import coords, glyph, lamp_lantern, stone_box, tufts
from pnkit import box
from pnshapes import facets, last, rotate
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, H, D = 44, 42, 20
PX, PZ = 20, 9  # post corner (4x4)
TOP = 30


def board(g: Grid, y: float, x_from: float, length: float, direction: int, tilt: float, ramp: str, icon: str, ink=("darkwood", 3)) -> None:
    """An arrow board in the x-y plane, 7 tall and 2 thick, pointing +x
    (direction 1) or -x (-1) from the post."""
    x0 = x_from
    x1 = x_from + direction * length
    tip = x1 + direction * 4
    pts = [(x0, y), (x1, y), (tip, y + 3.5), (x1, y + 7), (x0, y + 7)]
    pts = rotate(pts, x0, y + 3.5, tilt)
    g.prism("z", pts, PZ - 1, PZ + 1, C(ramp, 6))
    m = last(g)
    P.planks(g, m, ramp, 6, width=3, across="y", nails=True, seed=int(y))
    P.outline(g, m, "darkwood", 4, normal="z")
    iw, ih = (7, 6)
    cu = (x0 + x1) / 2 - iw / 2
    glyph(g, "-z", PZ - 1, int(round(cu)), int(round(y + 0.5)), icon, *ink, reach=3)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    stone_box(g, PX - 3, 0, PZ - 3, PX + 7, 2, PZ + 7, "stone", 5, block=(4, 2), seed=1)
    box(g, PX + 5, 0, PZ - 5, PX + 8, 2, PZ - 3, "stone", 4)
    post = box(g, PX, 2, PZ - 2, PX + 4, TOP, PZ + 2, "wood", 5)
    P.planks(g, post, "wood", 5, width=2, across="x", nails=False, seed=2)
    for by in (6, 26):
        P.flat(g, post & (Y > by) & (Y < by + 2), "darkwood", 3)
    # a small tiled cap on the post
    g.prism("z", [(PX - 2, TOP), (PX + 6, TOP), (PX + 2, TOP + 4)], PZ - 3, PZ + 3, C("red", 5))
    for m, fr in facets(g):
        if fr != "top":
            P.tiles(g, m, "red", 5, row=2, width=3, frame=fr, seed=3)
    box(g, PX + 1, TOP + 3, PZ - 1, PX + 3, TOP + 6, PZ + 1, "gold", 5)
    # three boards: castle (up right), forest (left), tavern (low right)
    board(g, 22, PX + 4, 13, 1, 6.0, "wood", "tower", ("sky", 6))
    board(g, 15, PX, 13, -1, -5.0, "wood", "tree", ("leaf", 6))
    board(g, 8, PX + 4, 11, 1, -4.0, "wood", "mug", ("gold", 6))
    tufts(g, [(PX - 6, PZ - 4), (PX + 9, PZ + 5), (PX - 4, PZ + 6)], flowers=[("gold", 6), ("red", 5), ("sky", 6)])
    root = Part("signpost", g)
    # a small lantern hanging under the forest board
    lg = Grid(12, 18, 12)
    info = lamp_lantern(lg, 6, 0, 6, s=4, body=5, seed=7)
    hx = PX - 9
    box(g, hx - 1, 13, PZ - 1, hx + 1, 16, PZ + 1, "stone", 3)
    root.add(Part("lantern", lg, pivot=(6.0, float(info["top"]), 6.0), at=(float(hx), 13.0, float(PZ)), rot=(0.0, 0.0, 4.0)))
    return Asset(id="fantasy-props-signpost", pack="fantasy", category="props", name="Crossroads Signpost", root=root,
                 clips=[Clip("idle", {"lantern": {"rot": sway(2.6, amp=(2.0, 0.0, 5.0), phase=(1.2, 0.0, 0.0))}})])
