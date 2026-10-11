"""Crossbow bolt crate in the Pirate Nation style.

An armoury crate of quarrels: one chunky planked box in a thick dark frame
with steel corner brackets and an oversized gold bolt stencil (rule K3).
Five bolts stand head up inside, spaced so each true-slope steel head reads.
An open lid hinges from the rear rim. A loaded crossbow with swept limbs and
a visible string leans against one side. Detail is paint (rule S1). About
27 long and 25 tall (PN chest: 18x15x15).
"""

import numpy as np

import paint as P
import pnglyph
from _props import coords, plank_box
from pnkit import box, edges
from pnshapes import bar, cone, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 27, 26, 20
X0, X1 = 4, 21               # the crate in x
Z0, Z1 = 3, 17               # the crate in z
TOP = 12                     # the crate rim
BOLTS = (                    # x, z, rise above the rim, lean in x
    (7.5, 6.0, 7, 0.6), (15.0, 6.5, 8, -0.4),
    (10.0, 10.0, 6, -0.5), (16.0, 11.0, 6, 0.5), (11.0, 14.0, 8, -0.3),
)
BANDS = ("red", "blue", "bone")
QUARREL = (                  # the stencil: a bolt with its head up and fletching below
    "...#...",
    "..###..",
    ".#####.",
    "#######",
    "...#...",
    "...#...",
    "...#...",
    "...#...",
    "..#.#..",
    ".#...#.",
    "##...##",
)


def quarrel(g: Grid, bx: float, bz: float, rise: int, lean: float, k: int) -> None:
    """One crossbow bolt: a tapered shaft with painted bindings and a
    four-sided steel head (true slopes)."""
    _, Y, _ = coords(g)
    top = TOP + rise
    tx = bx + lean
    shaft = bar(g, "z", (bx, TOP - 3), (tx, top), 1.2, bz - 0.6, bz + 0.6, "wood", 6)
    P.flat(g, shaft, "wood", 6)
    P.flat(g, shaft & (np.floor(Y).astype(int) % 4 == 0), "wood", 5)
    P.flat(g, shaft & (Y > top - 1.6) & (Y < top - 0.3), "darkwood", 4)      # the binding
    # Keep the colored tail bands narrow so each wooden shaft stays visible.
    P.flat(g, shaft & (Y > TOP + 0.8) & (Y < TOP + 2.8), BANDS[k % 3], 5)
    head = cone(g, "y", tx, bz, 0.9, top - 0.1, top + 2.6, "gray", 4, n=4)
    P.flat(g, head, "gray", 4)
    P.flat(g, head & (Y > top + 1.2), "gray", 6)
    P.flat(g, head & (Y < top + 0.5), "gray", 2)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # the crate: planked walls in a thick dark frame
    crate = plank_box(g, X0, 0, Z0, X1, TOP, Z1, "wood", 5, across="y", width=4, seed=1)
    P.planks(g, crate & (Yi == TOP - 1), "wood", 6, width=4, across="y", frame="top", seed=2)
    frame = crate & (((Xi < X0 + 2) | (Xi >= X1 - 2)).astype(int)
                     + ((Yi < 2) | (Yi >= TOP - 2)).astype(int)
                     + ((Zi < Z0 + 2) | (Zi >= Z1 - 2)).astype(int) >= 2)
    P.planks(g, frame, "darkwood", 4, width=2, across="y", nails=False, seed=3)
    P.flat(g, edges(crate), "darkwood", 4)
    # a steel strap up each corner, with rivet rows (rule S2; no speckle, rule S3)
    for cx in (X0, X1 - 2):
        for cz in (Z0, Z1 - 2):
            br = crate & (Xi >= cx) & (Xi < cx + 2) & (Zi >= cz) & (Zi < cz + 2)
            P.flat(g, br, "gray", 2)
            P.flat(g, br & (Yi % 5 == 2), "gray", 4)
    # the dark inside of the open rim, and straw packing round the bolts
    P.flat(g, crate & (Yi == TOP - 1) & (Xi > X0 + 2) & (Xi < X1 - 3) & (Zi > Z0 + 2) & (Zi < Z1 - 3), "darkwood", 2)
    for sx, sz in ((X0 + 3, Z0 + 2), (X1 - 6, Z1 - 5), (X0 + 7, Z1 - 4)):
        straw = box(g, sx, TOP, sz, sx + 4, TOP + 1, sz + 3, "gold", 6)
        P.flat(g, straw & (Xi % 2 == 0), "gold", 7)
    # the oversized gold bolt stencil on the front (rule K3)
    pnglyph.stamp(g, "-z", Z0, 9, 1, list(QUARREL), {"#": C("gold", 6)}, 1, 2, 2)

    for k, (bx, bz, rise, lean) in enumerate(BOLTS):
        quarrel(g, bx, bz, rise, lean, k)

    # An open lid stands at the rear rim and remains joined at its hinge.
    g.prism("z", [(4, 12), (21, 12), (21, 21), (4, 21)], 17, 20, C("wood", 5))
    lid = last(g)
    P.planks(g, lid, "wood", 6, width=3, across="x", nails=False, seed=4)
    P.outline(g, lid, "darkwood", 3, normal="z")
    for hx in (6, 18):
        box(g, hx, 11, 16, hx + 2, 13, 18, "gray", 4)

    # a crossbow standing against the +x side: stock, prod limbs and string
    stock = bar(g, "z", (24.4, 0.6), (20.8, 19.5), 2.8, 8.0, 10.8, "darkwood", 5)
    P.planks(g, stock, "darkwood", 5, width=3, across="x", nails=False, seed=5)
    P.flat(g, stock & (Zi == 8), "darkwood", 6)
    P.flat(g, stock & (Yi > 13) & (Yi < 16), "gray", 3)                      # the lock plate
    P.flat(g, stock & (Yi > 3) & (Yi < 6), "gray", 2)                        # the stirrup band
    P.outline(g, stock, "darkwood", 3, normal="z")
    prod = np.zeros(g.shape, dtype=bool)
    for side, zt in ((-1, 3.0), (1, 17.0)):
        mid_z = 10.0 + side * 3.8
        prod |= bar(g, "x", (18.2, 10.0), (19.7, mid_z), 1.5, 19.9, 22.3, "wood", 5)
        prod |= bar(g, "x", (19.7, mid_z), (16.6, zt), 1.2, 19.9, 22.3, "wood", 5)
    P.flat(g, prod, "wood", 5)
    P.flat(g, prod & (Yi >= 18), "wood", 6)
    P.flat(g, prod & (Xi < 21), "wood", 4)
    P.outline(g, prod, "darkwood", 3, normal="x")
    bar(g, "x", (16.4, 3.0), (16.4, 17.0), 0.7, 20.6, 21.6, "bone", 7)        # the string
    groove = bar(g, "z", (21.9, 16.0), (21.0, 20.4), 1.5, 9.0, 10.0, "wood", 6)
    P.flat(g, groove, "wood", 6)                                              # a bolt on the rail
    P.flat(g, groove & (Yi > 19), "gray", 6)

    # two spare bolts strapped together on the ground in front
    spare = np.zeros(g.shape, dtype=bool)
    for dz, x_to in ((1.1, 18.0), (2.6, 17.0)):
        spare |= bar(g, "y", (6.0, dz), (x_to, dz + 0.4), 1.5, 0, 2, "wood", 6)
    P.flat(g, spare, "wood", 6)
    P.flat(g, spare & (Yi == 1), "wood", 7)
    P.flat(g, spare & (Xi > 15), "gray", 4)
    P.flat(g, spare & (Xi > 16), "gray", 6)
    P.flat(g, spare & (Xi > 9) & (Xi < 12), "darkwood", 4)                    # the leather strap

    root = Part("bolt-crate", g)
    return Asset(id="fantasy-props-bolt-crate", pack="fantasy", category="props",
                 name="Bolt Crate", root=root)
