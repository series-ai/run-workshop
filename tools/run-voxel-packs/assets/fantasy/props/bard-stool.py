"""Bard's stool in the Pirate Nation style.

A round planked stool on three splayed legs stands on a rush mat, with the
oversized function prop leaning against it (rule F4): a warm-wood lute
whose bowl, neck, fingerboard and pegbox are one piece. The lute is built
upright in its own part and leaned with `Part.rot`, so its painted detail
stays crisp (README): a pale soundboard, one clean gold rosette, a chunky
bridge, four gold frets and three straight cream strings. A royal-blue
cushion with a gold hem sits on the seat, and a rolled song sheet and a
tankard share the mat, so the group reads on one footprint. About 36 wide
and 34 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords
from pnkit import box, edges
from pnshapes import disc, flat_ngon, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 36, 32, 26
SX, SZ, SEAT = 11, 13, 16  # stool centre and seat top
LW, LH, LD = 22, 38, 6  # the lute's own grid
LCX, LCY = 11, 9  # the lute bowl centre inside that grid
TILT = 20.0  # the lean, applied to the whole lute part
BRIDGE, NUT = 5, 31  # the string run, along the lute's own y
FRETS = (22, 24, 27, 29)


def lute_grid() -> Grid:
    """The lute, built upright so every painted line is axis-aligned."""
    g = Grid(LW, LH, LD)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the bowl: two octagon lobes, planked like a stave-built back
    g.prism("z", flat_ngon(LCX, LCY, 7.4, 10), 0, LD, C("wood", 5))
    bowl = last(g)
    g.prism("z", flat_ngon(LCX, 17, 5.2, 8), 1, LD - 1, C("wood", 5))
    bowl |= last(g)
    P.planks(g, bowl, "wood", 5, width=3, across="x", frame="z", nails=False, seed=1)
    P.outline(g, bowl, "darkwood", 3, normal="z")

    # the neck and the pegbox, flush with the soundboard
    g.prism("z", quad((LCX, 20), (LCX, NUT + 1), 3.0), 0, 3, C("wood", 5))
    neck = last(g)
    P.flat(g, neck, "wood", 5)
    P.flat(g, neck & (Zi >= 2), "wood", 4)
    g.prism("z", quad((LCX, NUT + 1), (LCX - 3.0, NUT + 5), 2.6, 2.1), 0, 3, C("darkwood", 4))
    head = last(g)
    P.flat(g, head, "darkwood", 4)
    P.outline(g, head, "darkwood", 2, normal="z")

    front = (g.a > 0) & (Zi == 0)
    # the soundboard: warm pale wood and one clean gold rosette
    face = bowl & front
    P.flat(g, face, "sand", 5)
    P.flat(g, face & (Yi > 13), "sand", 6)
    P.flat(g, face & (Yi < 4), "sand", 4)
    rr = np.hypot(X - LCX, Y - 13.0)
    P.flat(g, face & (rr < 4.2), "gold", 6)
    P.flat(g, face & (rr < 3.4), "gold", 4)
    P.flat(g, face & (rr < 2.6), "darkwood", 1)
    # a chunky bridge with a lit top edge
    P.flat(g, face & (Yi >= BRIDGE - 1) & (Yi <= BRIDGE) & (np.abs(X - LCX) < 4.6), "darkwood", 3)
    P.flat(g, face & (Yi == BRIDGE) & (np.abs(X - LCX) < 4.6), "darkwood", 5)
    # the fingerboard: one dark strip over neck and head, with ordered frets
    board = (neck | head) & front & (np.abs(X - LCX) < 2.6)
    P.flat(g, board, "darkwood", 2)
    for fy in FRETS:
        P.flat(g, board & (Yi == fy), "gold", 6)
    P.flat(g, board & (Yi == NUT), "bone", 7)  # the nut
    # three straight cream strings, bridge to nut
    for sx in (LCX - 2, LCX, LCX + 2):
        P.flat(g, front & (Xi == sx) & (Yi > BRIDGE) & (Yi <= NUT), "bone", 7)
    for py in (NUT + 2, NUT + 4):  # tuning pegs on the head
        P.flat(g, head & front & (Yi == py), "gold", 5)
    return g


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # one rush mat ties the group to a single footprint
    mat = disc(g, "y", 14, 13, 12.0, 0, 1, "gold", 5, n=10)
    P.thatch(g, mat, "gold", 5, band=3, frame="top", seed=9)
    P.flat(g, mat & (np.hypot(X - 14, Z - 13) > 11.0), "gold", 3)

    # three splayed legs with vertical grain, and a ring stretcher
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        fx, fz = SX + 6.0 * math.cos(a), SZ + 6.0 * math.sin(a)
        tx, tz = SX + 2.6 * math.cos(a), SZ + 2.6 * math.sin(a)
        g.prism("y", quad((fx, fz), (tx, tz), 1.7, 1.4), 1, SEAT - 2, C("darkwood", 5))
        leg = last(g)
        P.planks(g, leg, "darkwood", 5, width=3, across="x", nails=False, seed=k)
        P.flat(g, leg & (Yi < 3), "darkwood", 3)
        b = a + math.pi / 3
        g.prism("y", quad((fx * 0.75 + SX * 0.25, fz * 0.75 + SZ * 0.25),
                          (SX + 4.5 * math.cos(b), SZ + 4.5 * math.sin(b)), 1.0), 6, 8, C("darkwood", 4))
        P.flat(g, last(g), "darkwood", 4)

    # the planked seat with a dark rim
    seat = disc(g, "y", SX, SZ, 7.0, SEAT - 2, SEAT, "wood", 6, n=8)
    P.planks(g, seat, "wood", 6, width=3, across="y", frame="top", nails=True, seed=5)
    sd = np.hypot(X - SX, Z - SZ)
    P.flat(g, seat & (sd > 6.0), "darkwood", 3)
    # a royal-blue cushion with a gold hem, slightly off centre (rule F5)
    cush = disc(g, "y", SX - 1, SZ + 1, 5.4, SEAT, SEAT + 3, "blue", 4, n=8)
    P.mottle(g, cush, "blue", 4, cell=3, seed=6)
    P.flat(g, cush & (Yi == SEAT), "blue", 2)
    P.outline(g, cush, "gold", 6, normal="y")
    P.flat(g, cush & (Yi > SEAT + 1) & (np.hypot(X - SX + 1, Z - SZ - 1) < 1.6), "gold", 6)  # a button

    # a rolled song sheet and a tankard, both standing on the mat
    roll = disc(g, "x", 3.0, 21, 2.0, 5, 15, "bone", 7, n=6)
    P.flat(g, roll, "bone", 7)
    P.flat(g, roll & ((Xi % 4) == 0), "bone", 6)
    P.flat(g, roll & (Xi < 6), "bone", 5)
    P.flat(g, roll & (np.abs(Xi - 9) < 1), "red", 5)  # the tie ribbon
    P.flat(g, roll & (np.abs(Xi - 9) < 1) & ((Zi % 3) == 0), "red", 4)
    mug = disc(g, "y", 17, 21, 2.8, 1, 7, "steel", 5, n=8)
    P.flat(g, mug, "steel", 5)
    P.flat(g, mug & (Yi > 5), "bone", 7)
    P.flat(g, mug & (Yi > 3) & (Yi < 6), "gold", 4)
    P.flat(g, mug & (Yi < 2), "steel", 3)
    hdl = box(g, 19, 3, 20, 21, 6, 22, "steel", 4)
    P.flat(g, hdl, "steel", 4)
    P.flat(g, edges(hdl), "steel", 2)

    root = Part("bard-stool", g)
    root.add(Part("lute", lute_grid(), pivot=(float(LCX), float(LCY), LD / 2),
                  at=(25.0, 8.6, 11.0), rot=(0.0, 0.0, TILT)))
    return Asset(id="fantasy-props-bard-stool", pack="fantasy", category="props", name="Bard's Stool", root=root)
