"""Market stall in the Pirate Nation style.

A planked counter at table height with a red-and-cream striped cloth front
stands under a steep striped awning (a true slope) on four thick posts,
high enough for a merchant to stand beneath (a person is 36). A scalloped
valance and a PN-sized lantern hang from the front beam and a gold coin
sign stands on the awning edge.
Oversized goods fill the counter (rule F4): an apple basket, bread, a
cheese wheel, potions and cloth bolts; a barrel and a crate stand beside.
About 44 wide and 50 tall.
"""

import numpy as np

import paint as P
from _props import coords, glyph, lamp_lantern, plank_box, potion, idx
from pnkit import barrel, box, crate
from pnshapes import disc, last
from voxgrid import C, Asset, Clip, Grid, Part, sway

W, H, D = 50, 52, 30
X0, X1 = 5, 43  # posts outline (outer)
ZF, ZB = 6, 24  # front and back posts (front face z)
CT = 14  # counter top


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # posts: front posts 40 tall, back posts 47 tall
    for x in (X0, X1 - 3):
        for z, h in ((ZF, 40), (ZB, 47)):
            p = box(g, x, 0, z, x + 3, h, z + 3, "darkwood", 4)
            P.planks(g, p, "darkwood", 4, width=3, across="x", nails=False, seed=x + z)
    # the counter: planked top, striped cloth front
    plank_box(g, X0 + 1, CT - 2, ZF - 2, X1 - 1, CT, ZF + 8, "wood", 6, across="y", width=3, seed=1)
    front = box(g, X0 + 3, 1, ZF - 1, X1 - 3, CT - 2, ZF + 7, "red", 4)
    Xi, Yi, Zi = idx(g)
    P.flat(g, front & ((Xi // 3) % 2 == 1), "bone", 6)
    P.flat(g, front & (Yi < 2), "darkwood", 4)
    P.flat(g, front & (Yi == CT - 3), "gold", 5)
    # the back table with cloth bolts
    plank_box(g, X0 + 3, 10, ZB - 4, X1 - 3, 12, ZB, "wood", 5, across="y", width=2, seed=2)
    for bx, col in ((10, "blue"), (17, "magenta"), (24, "leaf"), (31, "gold")):
        bolt = disc(g, "z", bx, 14.5, 2.5, ZB - 4, ZB, col, 4, n=6)
        P.flat(g, bolt & (Z < ZB - 3.5), col, 6)
    # the awning: a thick striped slab from the back beam down to the front beam
    g.prism("x", [(47, ZB + 4), (49, ZB + 4), (42, ZF - 5), (40, ZF - 5)], X0 - 3, X1 + 3, C("red", 5))
    aw = last(g)
    P.flat(g, aw & ((Xi // 4) % 2 == 1), "bone", 6)
    P.flat(g, aw & ((Xi < X0 - 2) | (Xi >= X1 + 2)), "darkwood", 4)
    # front beam and a scalloped valance under the awning edge
    beam = box(g, X0 - 2, 37, ZF - 1, X1 + 2, 40, ZF + 3, "darkwood", 4)
    P.planks(g, beam, "darkwood", 4, width=3, across="y", nails=True, seed=3)
    val = box(g, X0 - 3, 36, ZF - 5, X1 + 3, 40, ZF - 4, "red", 5)
    P.flat(g, val & ((Xi // 4) % 2 == 1), "bone", 6)
    P.flat(g, val & (Yi == 36) & ((Xi % 4 == 0) | (Xi % 4 == 3)), "red", 5)
    g.carve(val & (Yi == 36) & ((Xi % 4 == 0) | (Xi % 4 == 3)))
    # a gold coin sign standing on the front edge of the awning
    sign = box(g, 19, 41, ZF - 5, 30, 51, ZF - 3, "darkwood", 4)
    P.outline(g, sign, "gold", 5, normal="z")
    glyph(g, "-z", ZF - 5, 21, 43, "coin", "gold", 6)
    # goods on the counter: apples, bread, cheese, potions
    bas = disc(g, "y", 11, ZF + 3, 3.5, CT, CT + 3, "wood", 5, n=8)
    P.planks(g, bas, "wood", 5, width=2, across="x", nails=False)
    for ax, az, col in ((10, ZF + 2, "red"), (12, ZF + 4, "red"), (12, ZF + 2, "leaf"), (10, ZF + 4, "red")):
        box(g, ax - 1, CT + 3, az - 1, ax + 1, CT + 5, az + 1, col, 5)
    for bx in (17, 21):
        loaf = box(g, bx - 1.5, CT, ZF + 1, bx + 1.5, CT + 3, ZF + 6, "gold", 5)
        P.flat(g, loaf & (Y > CT + 2) & (np.floor(Z) % 2 == 0), "gold", 3)
    ch = disc(g, "y", 27, ZF + 3, 3.0, CT, CT + 3, "gold", 6, n=8)
    P.flat(g, ch & (Y < CT + 1), "gold", 4)
    box(g, 27, CT, ZF, 30, CT + 3, ZF + 3, "gold", 7)  # the cut wedge
    potion(g, 33, CT, ZF + 3, r=1.6, h=4, liquid="cyan")
    potion(g, 37, CT, ZF + 3, r=2.0, h=5, liquid="red")
    # barrel and crate beside the stall
    barrel(g, 4.5, 18, 0, 12, 4.5, ramp="wood", hoop="darkwood", base=5)
    crate(g, X1 + 0, 0, ZF + 10, 7, seed=4)
    root = Part("market-stall", g)
    # the lantern hanging from the beam end
    lg = Grid(12, 18, 12)
    info = lamp_lantern(lg, 6, 0, 6, s=5, body=6, seed=9)
    box(g, X1 - 1, 35, ZF, X1 + 1, 37, ZF + 2, "stone", 3)
    root.add(Part("lantern", lg, pivot=(6.0, float(info["top"]), 6.0), at=(float(X1), 35.0, float(ZF + 1)), rot=(0.0, 0.0, -5.0)))
    return Asset(id="fantasy-props-market-stall", pack="fantasy", category="props", name="Market Stall", root=root,
                 clips=[Clip("idle", {"lantern": {"rot": sway(2.8, amp=(2.0, 0.0, 4.5), phase=(1.6, 0.0, 0.0))}})])
