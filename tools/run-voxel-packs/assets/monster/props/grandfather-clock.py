"""Haunted grandfather clock, in the Pirate Nation haunted style.

A tall longcase of dark boards standing on four chamfered bracket feet
(true slopes) under a flared plinth. Every side is finished: the trunk
carries a gold-framed glass door with a brass pendulum on a magenta pane,
each flank a gold-framed bone cross on violet, and the back a gold-framed
board panel with three toxic vent slots. A flared moulding on two scrolled
corbels runs right round the case and carries a wider hood, whose
oversized gold-bezelled dial glows toxic green like the clock on the bell
tower (rule C3); the hood back is a second framed panel with a painted
bone bat. An overhanging gold cornice carries a purple slate pediment on a
grey stone barge board, and the one roof accent is a bone orb finial on a
gold socle. Moss creeps up the case and the plinth. Faces -Z.

Size: 42 high, a little taller than a 36-voxel person.
"""
import numpy as np

import paint as P
import pnglyph
import pnshapes as S
from _kit import pfx, single
from _props import idx, masonry, planked, union
from pnkit import box, edges
from voxgrid import C, Grid, Socket

W, H, D = 20, 43, 17
CX = 10.0
TRUNK = (4, 5, 4, 16, 19, 16)  # x0 y0 z0 x1 y1 z1
HOOD = (1, 21, 2, 19, 33, 16)
DIAL = (CX, 27.0, 5.8)  # centre x, centre y, outer radius
RIDGE = 39.0  # the top of the pediment; the finial stands on it


def ray(g: Grid, cx: float, cy: float, dx: float, dy: float, r0: float, r1: float, step: float = 0.45) -> np.ndarray:
    """A one-voxel painted ray from radius r0 to r1 along (dx, dy): a clock
    hand or an hour tick."""
    X, Y, _Z = idx(g)
    m = np.zeros(g.shape, dtype=bool)
    n = np.hypot(dx, dy)
    for t in np.arange(r0, r1 + 1e-6, step):
        m |= (np.abs(X + 0.5 - (cx + t * dx / n)) < 0.55) & (np.abs(Y + 0.5 - (cy + t * dy / n)) < 0.55)
    return m


def base(g: Grid) -> None:
    """Four chamfered bracket feet under a flared plinth, mossy at the floor."""
    from pnpaint import blotch

    X, Y, Z = idx(g)
    feet = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for fx in (0.5, 14.5):
        for fz in (2.0, 11.0):
            g.prism("y", [(fx, fz), (fx + 5, fz), (fx + 5, fz + 4), (fx, fz + 4)], 0, 3, C("wood", 4),
                    top=[(fx + 1.2, fz + 1), (fx + 3.8, fz + 1), (fx + 3.8, fz + 3), (fx + 1.2, fz + 3)])
    feet = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 4, width=3, across="x", nails=False, frame=fr, seed=1))
    start = len(g.solids)
    g.prism("y", [(0.5, 1.0), (19.5, 1.0), (19.5, 17.0), (0.5, 17.0)], 3, 5, C("wood", 5),
            top=[(2.5, 3.5), (17.5, 3.5), (17.5, 15.5), (2.5, 15.5)])
    flare = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=4, across="x", nails=False, frame=fr, seed=2))
    P.flat(g, (feet | flare) & (Y < 1), "wood", 3)
    P.flat(g, flare & (Y == 4), "gray", 4)  # a thin stone slip on top of the plinth
    blotch(g, (feet | flare) & (Y < 4), "moss", 5, cell=2, chance=0.16, seed=3)


def trunk(g: Grid) -> None:
    """The case: boards with dark corner stiles, a gold-framed glass door one
    voxel proud with a brass pendulum on a magenta pane, a bone moon on each
    flank and a framed board panel with toxic vents on the back. Every side
    carries the same planks, framing and gold trim (rules S1, S4)."""
    from pnpaint import blotch

    X, Y, Z = idx(g)
    x0, y0, z0, x1, y1, z1 = TRUNK
    case = box(g, *TRUNK, "wood", 5)
    planked(g, case, "wood", 5, width=3, across="y", nails=False, seed=4)
    P.flat(g, case & ((X < x0 + 2) | (X >= x1 - 2)), "wood", 4)  # corner stiles
    P.flat(g, case & ((X == x0) | (X == x1 - 1)) & ((Z == z0) | (Z == z1 - 1)), "wood", 2)
    blotch(g, case & (Y < y0 + 5), "moss", 5, cell=2, chance=0.14, seed=15)  # damp at the foot
    # the glazed door: a gold frame one voxel proud, a magenta pane and one
    # big brass pendulum, so the panel reads in a 128 px thumbnail (rule F6)
    frame = box(g, x0 + 2, y0 + 2, z0 - 1, x1 - 2, y1 - 2, z0, "gold", 4)
    P.flat(g, frame & (((X + Y) % 4) == 0), "gold", 5)
    P.outline(g, frame, "gold", 3, normal="z")
    glass = box(g, x0 + 3, y0 + 3, z0 - 1, x1 - 3, y1 - 3, z0, "magenta", 5)
    P.flat(g, glass & (Y < y0 + 8), "magenta", 4)
    cxb = CX + 0.6
    P.flat(g, glass & (np.abs(X + 0.5 - cxb) < 1.1) & (Y > y0 + 8), "purple", 1)  # the rod
    P.flat(g, glass & (np.abs(X + 0.5 - cxb) < 0.4) & (Y > y0 + 8), "gold", 6)
    rad = np.hypot(X + 0.5 - cxb, Y + 0.5 - (y0 + 6.0))
    P.flat(g, glass & (rad < 2.8), "purple", 1)  # the bob: a dark rim, a bright face
    P.flat(g, glass & (rad < 2.1), "gold", 5)
    P.flat(g, glass & (rad < 1.0), "gold", 7)
    P.outline(g, glass, "purple", 1, normal="z")
    g.box(x1 - 4, y0 + 8, z0 - 2, x1 - 3, y0 + 10, z0 - 1, C("gold", 6))  # the door knob
    # a gold-framed panel on each flank with one big bone moon on violet
    for fx, face, plane in ((x0, "-x", x0), (x1 - 1, "+x", x1)):
        side = case & (X == fx) & (Y > y0 + 2) & (Y < y1 - 2) & (Z > z0 + 2) & (Z < z1 - 2)
        P.flat(g, side, "purple", 3)
        P.flat(g, side & (Y > (y0 + y1) / 2), "purple", 4)
        P.outline(g, side, "gold", 4, normal="x")
        # one big bone cross fills the tall panel: a clear icon, not a cramped
        # strip, and it reads at 128 px (rules K2, K3, F6)
        pnglyph.icon(g, face, plane, z0 + 3, y0 + 3, "cross", "bone", 6)
    # the back: a gold-framed board panel with three toxic vent slots
    bf = box(g, x0 + 2, y0 + 2, z1, x1 - 2, y1 - 2, z1 + 1, "gold", 3)
    P.outline(g, bf, "gold", 2, normal="z")
    bp = box(g, x0 + 3, y0 + 3, z1, x1 - 3, y1 - 3, z1 + 1, "wood", 5)
    P.planks(g, bp, "wood", 5, width=3, across="x", nails=True, frame="z", seed=14)
    P.flat(g, edges(bp), "wood", 2)
    for vy in (y0 + 4, y0 + 7, y0 + 10):
        P.flat(g, bp & (np.abs(X + 0.5 - CX) < 4.0) & (Y >= vy) & (Y < vy + 2), "wood", 2)
        P.flat(g, bp & (np.abs(X + 0.5 - CX) < 4.0) & (Y == vy), "toxic", 3)
    blotch(g, bp & (Y < y0 + 5), "moss", 5, cell=2, chance=0.12, seed=16)


def waist(g: Grid) -> None:
    """A moulding that flares out on all four sides under the hood, on two
    scrolled corbels (true slopes)."""
    X, Y, _Z = idx(g)
    start = len(g.solids)
    g.prism("y", [(4, 4), (16, 4), (16, 16), (4, 16)], TRUNK[4], HOOD[1], C("wood", 6),
            top=[(1, 1), (19, 1), (19, 17), (1, 17)])
    m = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 6, width=3, across="x", nails=False, frame=fr, seed=6))
    P.flat(g, m & edges(m), "wood", 4)
    P.flat(g, m & (Y == HOOD[1] - 1), "gold", 3)  # a gold bead right round the moulding
    for s, cx in ((-1, 4.0), (1, 16.0)):
        g.prism("z", [(cx, TRUNK[4]), (cx - s * 5, TRUNK[4]), (cx, TRUNK[4] - 6)], 4.5, 9.5, C("wood", 5))
        sc = S.last(g)
        P.flat(g, sc, "wood", 5)
        P.outline(g, sc, "wood", 3, normal="z")


def hood(g: Grid) -> None:
    """The bonnet: dark fluted columns either side of the dial, glazed side
    lights, a framed back panel with a painted bat and a gold cornice."""
    X, Y, Z = idx(g)
    x0, y0, z0, x1, y1, z1 = HOOD
    case = box(g, *HOOD, "wood", 6)
    planked(g, case, "wood", 6, width=3, across="y", nails=False, seed=7)
    for cx in (x0, x1 - 3):
        col = case & (X >= cx) & (X < cx + 3)
        P.flat(g, col, "wood", 3)
        P.flat(g, col & ((X - cx) == 1) & (Z < z0 + 1), "wood", 5)
        P.flat(g, col & (Y < y0 + 2), "gold", 4)
    for plane in (x0, x1 - 1):
        side = case & (X == plane) & (Z > z0 + 3) & (Z < z1 - 3) & (Y > y0 + 4) & (Y < y1 - 3)
        P.flat(g, side, "purple", 3)
        P.flat(g, side & (Y > y1 - 8), "purple", 4)
        P.outline(g, side, "gold", 4, normal="x")
    # the back of the hood: a second framed panel, a violet pane and a bat
    bf = box(g, x0 + 2, y0 + 2, z1, x1 - 2, y1 - 2, z1 + 1, "gold", 3)
    P.outline(g, bf, "gold", 2, normal="z")
    bp = box(g, x0 + 3, y0 + 3, z1, x1 - 3, y1 - 3, z1 + 1, "purple", 2)
    P.flat(g, bp & (Y > y1 - 7), "purple", 3)
    P.outline(g, bp, "purple", 1, normal="z")
    pnglyph.icon(g, "+z", z1 + 1, int(CX) - 6, y0 + 3, "bat", "bone", 6, depth=2)
    P.flat(g, case & (Z >= z1 - 1) & (Y < y0 + 2), "wood", 3)  # the dark sill under the panel
    # the cornice: a slab that overhangs the hood on all four sides, gold faced
    cor = box(g, 0, y1, 1, 20, y1 + 2, 17, "gold", 4)
    P.flat(g, cor & (((X + Z) % 4) == 0), "gold", 6)
    P.flat(g, cor & (Y >= y1 + 1), "gold", 5)
    P.outline(g, cor, "gold", 3, normal="y")


def dial(g: Grid) -> None:
    """The oversized dial in two stepped gold bezels (rule F4): a glowing
    toxic-green face like the bell tower clock, bold purple ticks and hands,
    a gold boss and two winding holes."""
    X, Y, Z = idx(g)
    cx, cy, r = DIAL
    outer = S.disc(g, "z", cx, cy, r, 1, 2, "gold", 4)
    inner = S.disc(g, "z", cx, cy, r - 0.8, 0, 1, "gold", 5)
    rad = np.hypot(X + 0.5 - cx, Y + 0.5 - cy)
    P.flat(g, outer, "gold", 4)
    P.outline(g, outer, "gold", 2, normal="z")
    P.flat(g, inner & (rad > r - 1.6), "gold", 6)
    face = inner & (rad <= r - 1.6)
    P.flat(g, face, "toxic", 5)  # the glowing face, brightest in the middle
    P.flat(g, face & (rad < r - 2.4), "toxic", 6)
    P.flat(g, face & (rad < r - 3.6), "toxic", 7)
    # the hands: a long minute hand on nine, a short hour hand just past ten
    for dx, dy, rr in ((-1.0, 0.0, r - 2.8), (-0.75, 0.66, r - 4.0)):
        P.flat(g, face & ray(g, cx, cy, dx, dy, 0.0, rr, step=0.3), "purple", 1)
    P.flat(g, face & (rad < 1.4), "gold", 7)
    P.flat(g, face & (rad < 0.7), "purple", 1)
    for wx in (cx - 2.2, cx + 2.2):  # winding holes
        P.flat(g, face & (np.abs(X + 0.5 - wx) < 0.6) & (np.abs(Y + 0.5 - (cy - 2.0)) < 0.6), "purple", 2)


def crest(g: Grid) -> None:
    """A purple slate pediment on a grey stone barge board, a gold tympanum
    plate with a bone skull, and one bone cross finial leaning off true."""
    X, Y, Z = idx(g)
    from pnpaint import blotch

    EAVE = HOOD[4] + 2  # the top of the cornice
    g.prism("z", [(1.5, EAVE), (18.5, EAVE), (13, RIDGE), (7, RIDGE)], 2, 14, C("purple", 4))
    roof = S.last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.tiles(gg, mm, "purple", 4, row=3, width=4, frame=fr, seed=8))
    # the barge board: real stone blocks, not a plain bevel (rules S2, S4)
    band = roof & (Y < EAVE + 2)
    masonry(g, band, "gray", 5, block=(4, 3), seed=18)
    P.flat(g, band & (Y == EAVE), "gray", 2)
    blotch(g, roof & (Y < EAVE + 2), "moss", 5, cell=2, chance=0.10, seed=19)
    # the gable face stays plain slate: the camera rakes it, so anything
    # painted there reads as a stray mark, not as an accent
    P.flat(g, roof & (Z == 2) & (Y > EAVE + 1), "purple", 3)
    P.outline(g, roof & (Z == 2), "purple", 2, normal="z")
    # one finial, the single accent on the roof: a gold socle on the ridge and
    # a chunky bone orb above it, clear of the slate (rules F6, K3)
    S.cone(g, "y", CX, 8.0, 3.4, RIDGE - 2.0, RIDGE, "gold", 5, n=8, r_top=2.6)
    socle = S.last(g)
    P.flat(g, socle, "gold", 4)
    P.flat(g, socle & (Y >= RIDGE - 1), "gold", 6)
    fin = S.dome(g, CX, 8.0, RIDGE, 2.6, h=3, n=8, rings=2, ramp="bone", base=6,
                 painter=lambda gg, mm, fr: P.flat(gg, mm, "bone", 6), ribs=("bone", 3))
    P.flat(g, fin & (Y >= RIDGE + 2), "bone", 7)


def build():
    g = Grid(W, H, D)
    base(g)
    trunk(g)
    waist(g)
    hood(g)
    crest(g)
    dial(g)
    # the case glows and leaks spirits through the pendulum pane (rule C3)
    sx, sy, sz = CX + 0.6, TRUNK[1] + 6.0, TRUNK[2] - 1.5
    return single("grandfather-clock", "props", "Grandfather Clock", g,
                  sockets=[Socket("socket-case", at=(sx - W / 2, sy, sz - D / 2))],
                  pfx=[pfx("rvx-monster-ghost-wisps", "socket-case", "idle", size=14)])
