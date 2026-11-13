"""Scrap shield wall, in the Pirate Nation style.

One chunky icon (rule K3): three salvaged panels bolted side by side on two
steel ribs, so the front reads as one built barricade and nothing overlaps.
A hazard-striped sheet, a zombie-teal car door with its window and handle,
and a rusted corrugated sheet each carry their own framed edge. One crisp
red stop disc is bolted flat on the middle panel (rule C3). Behind, two
braces reach back to concrete feet through bolted gussets; sandbags with
painted seams and ties weigh the foot down. Every mark is paint (rule S1).
"""
import numpy as np

import paint as P
import pnpaint
from _props import asset, chips, pillow, root, rust_wear, weeds
from pnkit import box, edges, on_face
from pnshapes import bar, coords, disc
from voxgrid import Grid

GW, GH, GD = 36, 26, 22
RX = (4, 26)  # the two ribs
RZ = 6  # the rib plane


def panel(g: Grid, x0, x1, y0, y1, ramp: str, base: int) -> np.ndarray:
    """One salvaged sheet bolted on the front of the ribs."""
    m = box(g, x0, y0, RZ - 2, x1, y1, RZ, ramp, base)
    P.outline(g, m, ramp, max(1, base - 3), normal="z")
    return m


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, RX[0] - 2, RZ + 10, seed=1)
    weeds(g, RX[1] + 6, RZ - 4, seed=2)
    # the two ribs and their back braces
    ribs = np.zeros(g.shape, dtype=bool)
    for rx in RX:
        ribs |= box(g, rx, 0, RZ, rx + 5, 22, RZ + 4, "steel", 5)
        ribs |= bar(g, "x", (20.0, float(RZ + 3)), (3.0, float(RZ + 13)), 1.8, rx + 1, rx + 4, "steel", 4)
        gus = box(g, rx, 16, RZ + 2, rx + 5, 21, RZ + 6, "steel", 6)
        P.flat(g, edges(gus), "steel", 3)
        P.flat(g, gus & (np.floor(X + Y) % 3 == 0), "steel", 4)
        pad = box(g, rx - 1, 0, RZ + 10, rx + 6, 4, RZ + 16, "stone", 5)
        pnpaint.concrete(g, pad, "stone", 5, size=8, cracks=4, seed=rx)
        P.flat(g, edges(pad), "stone", 3)
    P.plates(g, ribs, "steel", 5, size=(6, 7), seed=3)
    P.flat(g, edges(ribs), "steel", 2)
    rust_wear(g, ribs, seed=4, shade=5, run=5, grime=4)
    # panel A: hazard-striped steel
    a = panel(g, 1, 12, 4, 20, "gold", 6)
    pnpaint.hazard(g, a, period=5, a=("gold", 7), b=("darkwood", 3), frame="z")
    P.outline(g, a, "darkwood", 2, normal="z")
    chips(g, a, ((3, 6, RZ - 2, 3.0), (10, 18, RZ - 2, 2.6)), "rust", 5, seed=5)
    # panel B: a teal car door, with its window, handle and crease
    b = panel(g, 12, 24, 2, 23, "teal", 4)
    P.flat(g, b & (Y > 15) & (X > 14) & (X < 22), "steel", 2)  # the window hole
    P.flat(g, b & (np.abs(Y - 15.5) < 0.6), "teal", 2)
    P.flat(g, b & (np.abs(Y - 10.5) < 0.6), "teal", 6)  # the body crease
    P.flat(g, b & (Y > 11) & (Y < 14) & (X > 19) & (X < 23), "steel", 6)  # the handle
    P.outline(g, b, "teal", 2, normal="z")
    chips(g, b, ((13, 5, RZ - 2, 3.2), (23, 20, RZ - 2, 2.8)), "rust", 5, seed=6)
    # panel C: rusted corrugated sheet
    c = panel(g, 24, 35, 5, 18, "rust", 6)
    pnpaint.corrugate(g, c, "rust", 6, period=3, sheet=14, length=16, frame="z")
    P.outline(g, c, "darkwood", 2, normal="z")
    chips(g, c, ((26, 7, RZ - 2, 3.0), (33, 16, RZ - 2, 2.6)), "rust", 3, seed=7)
    # the bolt heads where every panel meets a rib
    for rx in RX:
        for by in (6, 12, 18):
            P.flat(g, (a | b | c) & (np.abs(X - rx - 2.5) < 1.2) & (np.abs(Y - by) < 1.2), "steel", 6)
    # the stop disc, bolted flat on the middle panel
    face = disc(g, "z", 18.0, 12.0, 4.6, RZ - 3, RZ - 2, "red", 4)
    P.flat(g, face & (np.hypot(X - 18, Y - 12) > 3.4), "bone", 7)
    P.flat(g, face & (np.abs(Y - 12) < 1.2) & (np.hypot(X - 18, Y - 12) < 3.4), "bone", 7)
    P.outline(g, face, "darkwood", 2, normal="z")
    # sandbags along the foot, with painted seams and a tied neck
    for k, (sx, ang, ramp) in enumerate(((7, 8, "sand"), (17, -6, "khaki"), (27, 10, "sand"))):
        bagm = pillow(g, sx, RZ - 1, 0, 12, 8, 6, angle=ang, ramp=ramp, base=5, puff=1.6)
        P.flat(g, bagm & (np.floor(X + Z) % 5 == 0), ramp, 3)  # the seams
        P.flat(g, bagm & (Y > 4), ramp, 6)
        P.outline(g, bagm, ramp, 3, normal="y")
        box(g, sx - 1, 5, RZ - 5, sx + 2, 7, RZ - 3, "darkwood", 3)  # the tie
    return asset("scrap-shield-wall", "Scrap Shield Wall", root("scrap-shield-wall", g))
