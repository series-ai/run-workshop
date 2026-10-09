"""Split woodpile in the Pirate Nation style.

A stack of chunky logs between driven stakes, every log end painted with
tan ring grain inside a dark bark rim (rule S1), so the front of the pile
reads as a wall of rounds. Beside it the oversized function prop: a
chopping block with a steel axe buried in it at an angle (rules F4 and
F5), with split wedges, chips and moss at the foot. About 38 long and 22
tall.
"""

import numpy as np

import paint as P
from _props import coords
from pnkit import box
from pnshapes import bar, cone, disc, last, radial, rotate
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 24, 18
ZL0, ZL1 = 3, 15  # the logs run along z, flush with the stake faces
ROWS = ((3.0, (5.0, 10.2, 15.4, 20.6)), (8.2, (7.6, 12.8, 18.0)), (13.4, (5.0, 10.2, 15.4, 20.6)), (18.6, (7.6, 12.8)))


def log(g: Grid, cx: float, cy: float, seed: int) -> np.ndarray:
    """One log lying along z: bark on the sides, and on both ends a flat
    tan face with ring grain inside a dark bark rim (rule S4). The end paint
    stays on the end face; the side voxels next to it keep the bark."""
    m = disc(g, "z", cx, cy, 2.6, ZL0, ZL1, "darkwood", 4, n=8)
    X, Y, Z = coords(g)
    P.planks(g, m, "darkwood", 4, width=3, across="y", frame="z", nails=False, seed=seed)
    P.flat(g, m & (Y > cy + 1.8), "darkwood", 5)
    r = radial(g, "z", cx, cy)
    for face in (Z < ZL0 + 1, Z > ZL1 - 1):
        end = m & face
        P.flat(g, end, "darkwood", 3)  # the bark rim
        P.flat(g, end & (r < 2.2), "wood", 6)  # the tan heartwood
        P.flat(g, end & (r > 1.9) & (r < 2.2), "wood", 5)  # the outer growth ring
        P.flat(g, end & (r < 1.0), "wood", 4)  # the pith
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the stack, between two pairs of driven stakes
    seed = 0
    for cy, xs in ROWS:
        for cx in xs:
            log(g, cx, cy, seed)
            seed += 1
    for sx in (1, 23):
        for sz in (ZL0 + 1, ZL1 - 4):
            st = box(g, sx, 0, sz, sx + 3, 21, sz + 3, "darkwood", 3)
            P.planks(g, st, "darkwood", 3, width=3, across="x", nails=False, seed=sx + sz)
            P.flat(g, st & (Yi > 19), "wood", 4)  # the split, weathered tops

    # moss and a lichen patch on the pile
    P.flat(g, (g.a > 0) & (Xi > 6) & (Xi < 13) & (Yi > 14) & (Yi < 18) & (Zi < ZL0 + 1), "moss", 4)
    P.flat(g, (g.a > 0) & (Xi > 16) & (Xi < 21) & (Yi > 3) & (Yi < 7) & (Zi < ZL0 + 1), "moss", 3)

    # the chopping block: a fat upright round with a chipped top
    block = disc(g, "y", 32, 9, 5.2, 0, 11, "wood", 5, n=8)
    P.planks(g, block, "wood", 5, width=3, across="x", frame="wall", nails=False, seed=40)
    br = np.hypot(X - 32, Z - 9)
    top = block & (Y > 10)
    P.flat(g, top, "sand", 6)
    P.flat(g, top & (((br * 2).astype(int) % 3) == 0), "sand", 5)
    P.flat(g, top & (br > 4.4), "darkwood", 3)
    P.flat(g, block & (Y < 2), "darkwood", 3)

    # the axe, buried in the block: a steel head, a shaft and a red grip
    pts = [(27, 10), (36, 10), (37.5, 14), (36, 19), (27, 18), (28.5, 14)]
    g.prism("z", pts, 6, 9, C("steel", 6))
    head = last(g)
    P.plates(g, head, "steel", 6, size=(6, 5), rivets=False, frame="z", seed=42)
    P.flat(g, head & (X > 35.0), "steel", 7)  # the honed edge
    P.flat(g, head & (X < 30.5), "iron", 4)  # the eye band
    P.outline(g, head, "steel", 3, normal="z")
    shaft = bar(g, "z", (30, 13), (34, 23), 2.4, 6, 9, "wood", 6)
    P.planks(g, shaft, "wood", 6, width=2, across="y", frame="z", nails=False, seed=41)
    P.outline(g, shaft, "darkwood", 3, normal="z")
    P.flat(g, shaft & (Yi > 19), "red", 5)  # a red grip wrap at the top
    P.flat(g, shaft & (Yi > 19) & (Yi % 2 == 0), "red", 4)

    # split wedges, chips and grass at the foot
    for wx, wz, wa in ((25, 2, 0), (28, 11, 30), (23, 13, -25)):
        pts = rotate([(wx, wz), (wx + 6, wz + 1), (wx + 3, wz + 4)], wx + 3, wz + 2, wa)
        g.prism("y", pts, 0, 4, C("sand", 6))
        wedge = last(g)
        P.flat(g, wedge & (Y < 1), "darkwood", 3)
        P.flat(g, wedge & (Y > 3), "sand", 7)
        P.outline(g, wedge, "darkwood", 4, normal="y")
    for cxp, czp in ((34, 3), (26, 15), (36, 12)):
        chip = box(g, cxp, 0, czp, cxp + 3, 2, czp + 3, "sand", 7)
        P.outline(g, chip, "darkwood", 4)
    for mx, mz in ((1, 0), (22, 15)):
        clump = box(g, mx, 0, mz, mx + 4, 2, mz + 4, "moss", 3)
        P.flat(g, clump & (Yi > 0), "moss", 4)
        P.flat(g, clump & (Yi > 0) & ((Xi + Zi) % 3 == 0), "leaf", 3)

    root = Part("woodpile", g)
    return Asset(id="fantasy-props-woodpile", pack="fantasy", category="props", name="Woodpile", root=root)
