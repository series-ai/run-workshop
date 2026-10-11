"""Guillotine, in the Pirate Nation haunted style.

A scaffold of heavy planks: a stepped deck, two leaning uprights strapped
with iron and a thick cross beam carrying a pulley and a slack rope. The
oversized blade is a steel wedge with a true-slope edge under a riveted
lead weight, running in the grooves of the posts. A tilted bench leads to
the lunette; its lower board is bolted to the frame and its yoke hinges up
at the back. A wicker basket of skulls stands under the drop, the deck is
stained, and a purple pennant hangs from the beam (rule F5).

Parts: frame (root), blade (slides down the posts), yoke (hinges at the
back of the lunette), lever (pivots on the right post). Clips: attack (the
lever trips, the blade falls and bounces), open (the yoke lifts and the
blade is winched back up), close (the yoke clamps), idle (the blade
creaks in its grooves and the lever bobs). Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _kit import keys, pfx, world
from _pn import assemble, coords, last
from _props import union
from pnkit import box, edges
from voxgrid import C, Clip, Grid, Socket

SZ = (34, 64, 44)
CX = 17.0
PX = ((3.0, 10.0), (24.0, 31.0))  # upright x spans
PZ = (20.0, 27.0)  # upright z span
DECK = 4.0
BEAM = (54.0, 60.0)
BLADE_Y = 34.0  # the blade slab foot at rest
DROP = -14.0
LUNETTE = (22.0, 24.5)  # the stock board y0, hinge y
NECK = (CX, 25.0, 23.0)


def frame() -> Grid:
    """The deck, the two strapped uprights, the cross beam with its pulley
    and pennant, the bench and lunette board, and the basket of skulls."""
    from pnpaint import blotch

    g = Grid(*SZ)
    X, Y, Z = coords(g)
    # the plank deck with a step at the front
    deck = box(g, 0, 0, 6, 34, DECK, 38, "wood", 4)
    P.planks(g, deck, "wood", 4, width=4, across="x", nails=True, seed=1)
    P.flat(g, deck & (Y < 1.5), "wood", 2)
    step = box(g, 6, 0, 1, 28, 2, 6, "wood", 5)
    P.planks(g, step, "wood", 5, width=4, across="x", nails=True, seed=2)
    blotch(g, deck | step, "moss", 5, cell=3, chance=0.08, seed=3)
    P.flat(g, deck & (Y >= DECK - 1) & (np.abs(X - CX) < 7) & (Z > 8) & (Z < 22), "blood", 4)
    P.flat(g, deck & (Y >= DECK - 1) & (np.abs(X - CX) < 4) & (Z > 10) & (Z < 20), "blood", 3)
    # the uprights: thick planked posts that lean in a little at the top
    posts = np.zeros(g.shape, dtype=bool)
    start = len(g.solids)
    for k, (x0, x1) in enumerate(PX):
        lean = 0.8 if k == 0 else -0.8
        g.prism("y", [(x0, PZ[0]), (x1, PZ[0]), (x1, PZ[1]), (x0, PZ[1])], DECK, BEAM[0], C("wood", 5),
                top=[(x0 + lean, PZ[0] + 0.5), (x1 + lean, PZ[0] + 0.5), (x1 + lean, PZ[1] - 0.5), (x0 + lean, PZ[1] - 0.5)])
    posts = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=4, across="y", nails=False, frame=fr, seed=4))
    for sy in (12, 28, 44):  # iron straps
        band = posts & (Y >= sy) & (Y < sy + 3)
        P.flat(g, band, "gray", 4)
        P.flat(g, band & (((X + Z) % 4) == 0) & (Y == sy + 1), "gray", 6)
    # the blade grooves, painted dark on the inner faces of the posts
    P.flat(g, posts & (((X > PX[0][1] - 1.5) & (X < PX[0][1])) | ((X > PX[1][0]) & (X < PX[1][0] + 1.5))) & (Z > PZ[0] + 1) & (Z < PZ[1] - 1), "wood", 3)
    # the cross beam, a pulley and a torn purple pennant
    beam = box(g, 1, BEAM[0], PZ[0] - 1, 33, BEAM[1], PZ[1] + 1, "wood", 6)
    P.planks(g, beam, "wood", 6, width=4, across="x", nails=True, seed=5)
    P.flat(g, beam & edges(beam), "wood", 4)
    for bx in (1.5, 29.5):  # iron brackets on the beam ends
        P.flat(g, beam & (X > bx) & (X < bx + 3), "gray", 4)
    wheel = S.disc(g, "x", BEAM[0] - 2.0, 23.5, 2.6, CX - 1, CX + 1, "gray", 5)
    P.flat(g, wheel & (np.hypot(Y + 0.5 - (BEAM[0] - 2.0), Z + 0.5 - 23.5) < 1.2), "gray", 3)
    g.prism("z", [(2.0, BEAM[0]), (2.0, BEAM[0] - 17.0), (6.5, BEAM[0] - 11.0), (11.0, BEAM[0] - 19.0), (13.0, BEAM[0] - 10.0), (13.0, BEAM[0])], PZ[0] - 1.5, PZ[0] + 0.5, C("purple", 5))
    pen = last(g)
    P.mottle(g, pen, "purple", 5, cell=2, seed=6)
    P.flat(g, pen & (Y < BEAM[0] - 9), "magenta", 5)
    P.outline(g, pen, "purple", 3, normal="z")
    P.flat(g, pen & (np.abs(X - 7.5) < 1.0) & (Y > BEAM[0] - 9) & (Y < BEAM[0] - 2), "bone", 6)
    P.flat(g, pen & (np.abs(Y - (BEAM[0] - 5.5)) < 1.0) & (X > 4.5) & (X < 10.5), "bone", 6)
    S.bar(g, "x", (BEAM[0] - 3.0, 18.0), (BEAM[0] - 14.0, 15.5), 1.4, 27.0, 28.4, "sand", 5)  # the slack rope
    # the tilted bench and the lower lunette board
    g.prism("x", [(DECK, 27.0), (DECK + 2, 38.0), (18.0, 38.0), (19.5, 27.0)], CX - 8, CX + 8, C("wood", 5))
    bench = last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.planks(gg, mm, "wood", 5, width=4, across="x", nails=True, frame=fr, seed=7))
    P.flat(g, bench & (Y > 18) & (Z < 30), "blood", 4)
    board = box(g, 6, LUNETTE[0], 25.0, 28, LUNETTE[1], 28.5, "wood", 6)
    P.planks(g, board, "wood", 6, width=4, across="x", nails=True, seed=8)
    P.flat(g, board & (np.hypot(X + 0.5 - CX, Y + 0.5 - LUNETTE[1]) < 4.2), "wood", 2)  # the neck notch
    g.box(int(CX) - 4, int(LUNETTE[0]) + 2, 25, int(CX) + 4, int(LUNETTE[1]), 29, 0)
    P.flat(g, board & (np.abs(X - CX) > 9), "gray", 4)
    # the basket of skulls under the drop
    start = len(g.solids)
    g.prism("y", S.flat_ngon(CX, 14.0, 5.0, 8), DECK, DECK + 9, C("sand", 4), top=S.flat_ngon(CX, 14.0, 6.6, 8))
    bask = union(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.thatch(gg, mm, "sand", 4, band=3, frame=fr, seed=9))
    P.flat(g, bask & ((Y.astype(int) % 3) == 0), "sand", 3)
    P.flat(g, bask & (Y > DECK + 7), "sand", 5)
    S.skull(g, CX - 2.0, DECK + 7, 13.0, s=7, ramp="bone", base=6, eyes=("toxic", 6), socket=("purple", 1), seed=10)
    S.skull(g, CX + 3.0, DECK + 6, 16.0, s=5, ramp="bone", base=5, eyes=("purple", 1), socket=("purple", 1), seed=11)
    P.flat(g, bask & (Y > DECK + 6) & (np.hypot(X - CX, Z - 14.0) > 5.0), "blood", 4)
    return g


def blade() -> Grid:
    """The steel wedge with a true-slope edge under a riveted lead weight."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    g.prism("z", [(8.6, BLADE_Y), (25.4, BLADE_Y + 7.0), (25.4, BLADE_Y + 12), (8.6, BLADE_Y + 12)], 20.6, 24.4, C("steel", 5))
    slab = last(g)
    S.paint_facets(g, g.solids[-1:], lambda gg, mm, fr: P.plates(gg, mm, "steel", 6, size=(8, 6), frame=fr, seed=12))
    # the bright honed edge along the diagonal, with a blood smear
    edge = slab & (Y + 0.5 < BLADE_Y + 3.0 + (X + 0.5 - 8.6) * 7.0 / 16.8)
    P.flat(g, edge, "steel", 7)
    P.flat(g, slab & ~edge & (Y + 0.5 < BLADE_Y + 4.6 + (X + 0.5 - 8.6) * 7.0 / 16.8), "steel", 7)
    P.flat(g, edge & (((X.astype(int)) % 7) < 3), "blood", 4)
    P.flat(g, slab & (Y > BLADE_Y + 10), "steel", 4)
    weight = box(g, 8.6, BLADE_Y + 12, 20.0, 25.4, BLADE_Y + 19, 25.0, "gray", 3)
    P.plates(g, weight, "gray", 3, size=(7, 5), seed=13)
    P.flat(g, weight & (Y > BLADE_Y + 17), "gray", 4)
    P.flat(g, weight & (Y >= BLADE_Y + 14) & (Y < BLADE_Y + 16), "purple", 4)
    P.flat(g, weight & (Y == BLADE_Y + 14) & (((X + Z) % 3) == 0), "purple", 6)
    for gx in (8.8, 25.2):  # the shoes that run in the grooves
        box(g, gx - 1.5, BLADE_Y + 12, 21.5, gx + 1.5, BLADE_Y + 19, 23.5, "gray", 6)
    box(g, CX - 1, BLADE_Y + 19, 22.0, CX + 1, BLADE_Y + 21, 24.0, "gray", 5)  # the eye the rope hooks to
    return g


def yoke() -> Grid:
    """The upper lunette board, hinged at the back."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    m = box(g, 6, LUNETTE[1], 25.0, 28, LUNETTE[1] + 5, 28.5, "wood", 6)
    P.planks(g, m, "wood", 6, width=4, across="x", nails=True, seed=14)
    P.flat(g, m & (np.hypot(X + 0.5 - CX, Y + 0.5 - LUNETTE[1]) < 4.2), "wood", 2)
    g.box(int(CX) - 4, int(LUNETTE[1]), 25, int(CX) + 4, int(LUNETTE[1]) + 4, 29, 0)
    P.flat(g, m & (np.abs(X - CX) > 9), "gray", 4)
    P.flat(g, m & (np.abs(X - CX) > 10) & (((X + Y) % 3) == 0), "gray", 6)
    P.flat(g, m & (Y > LUNETTE[1] + 3.5), "wood", 4)
    return g


def lever() -> Grid:
    """A wooden release lever on the right post, with an iron collar."""
    g = Grid(*SZ)
    X, Y, Z = coords(g)
    col = box(g, PX[1][1] - 1, 29.0, 21.5, PX[1][1] + 2, 33.0, 25.5, "gray", 4)
    P.flat(g, col & (((Y + Z) % 3) == 0), "gray", 6)
    S.bar(g, "x", (31.0, 23.5), (37.0, 14.0), 2.6, PX[1][1], PX[1][1] + 2.6, "wood", 5)
    arm = last(g)
    P.flat(g, arm, "wood", 5)
    P.outline(g, arm, "wood", 3, normal="x")
    knob = S.disc(g, "x", 37.5, 13.0, 2.4, PX[1][1] - 0.6, PX[1][1] + 2.6, "purple", 4)
    P.flat(g, knob & (Y > 38), "purple", 5)
    return g


def build():
    parts = {"frame": frame(), "blade": blade(), "yoke": yoke(), "lever": lever()}
    root = assemble(parts, [
        ("frame", None, (CX, 0.0, 22.0)),
        ("blade", "frame", (CX, BLADE_Y + 12.0, 22.5)),
        ("yoke", "frame", (CX, LUNETTE[1], 28.0)),
        ("lever", "frame", (PX[1][1] + 0.5, 31.0, 23.5)),
    ])
    z3 = (0.0, 0.0, 0.0)
    down = (0.0, DROP, 0.0)
    attack = Clip("attack", {
        "lever": {"rot": keys((0, z3), (0.18, (-58, 0, 0)), (0.5, (-50, 0, 0)), (1.0, (-50, 0, 0)))},
        "blade": {"loc": keys((0, z3), (0.14, (0.0, 0.6, 0.0)), (0.2, z3), (0.46, down), (0.54, (0.0, DROP + 1.6, 0.0)), (0.62, down), (0.7, (0.0, DROP + 0.5, 0.0)), (0.8, down), (1.0, down))},
        "yoke": {"rot": keys((0, z3), (0.46, z3), (0.54, (-4, 0, 0)), (0.7, z3), (1.0, z3))},
    }, loop=False)
    open_ = Clip("open", {
        "blade": {"loc": keys((0, down), (0.2, down), (0.6, (0.0, DROP * 0.55, 0.0)), (0.75, (0.0, DROP * 0.6, 0.0)), (1.2, (0.0, DROP * 0.12, 0.0)), (1.4, z3), (1.6, z3))},
        "lever": {"rot": keys((0, (-50, 0, 0)), (0.3, (-50, 0, 0)), (0.7, z3), (1.6, z3))},
        "yoke": {"rot": keys((0, z3), (0.3, (-78, 0, 0)), (0.45, (-70, 0, 0)), (0.6, (-74, 0, 0)), (1.6, (-74, 0, 0)))},
    }, loop=False)
    close = Clip("close", {
        "yoke": {"rot": keys((0, (-74, 0, 0)), (0.35, z3), (0.44, (-7, 0, 0)), (0.55, z3))},
    }, loop=False)
    idle = Clip("idle", {
        "blade": {"loc": keys((0, z3), (1.4, z3), (1.6, (0.0, -0.6, 0.0)), (1.8, z3), (2.0, (0.0, -0.3, 0.0)), (2.2, z3), (3.6, z3))},
        "lever": {"rot": keys((0, z3), (1.5, z3), (1.7, (-6, 0, 0)), (1.95, z3), (3.6, z3))},
        "yoke": {"rot": keys((0, z3), (0.9, (-2, 0, 0)), (1.8, z3), (2.7, (-1.5, 0, 0)), (3.6, z3))},
    })
    neck = (NECK[0] - CX, NECK[1] - 0.0, NECK[2] - 22.0)
    return world("guillotine", "animated-props", "Guillotine", root,
                 clips=[attack, open_, close, idle],
                 sockets=[Socket("socket-neck", at=neck, parent="frame")],
                 pfx=[pfx("rvx-monster-blood-splat", "socket-neck", "clip:attack", size=34, at=0.47)])
