"""Supply crate in the Pirate Nation style.

One chunky box (rule K3): planked faces inside a thick dark frame, a true
diagonal brace across the front and the side, a gold crown stencil on the
front, and straw poking out from under the lid. Detail is paint (rule S1).
About 16 on a side (PN chest: 18×15×15).
"""

import paint as P
from _props import brace, glyph, idx
from pnkit import box, edges
from voxgrid import Asset, Grid, Part

S = 16
O = 2  # grid margin


def build() -> Asset:
    g = Grid(S + 2 * O, S + 4, S + 2 * O)
    x0, x1 = O, O + S
    body = box(g, x0, 0, x0, x1, S, x1, "wood", 5)
    P.planks(g, body, "wood", 5, width=4, across="y", nails=True, seed=1)
    X, Y, Z = idx(g)
    top = body & (Y == S - 1)
    P.planks(g, top, "wood", 6, width=4, across="y", frame="top", seed=2)
    # a thick dark frame: 2-voxel boards around every face
    fr = body & (((X < x0 + 2) | (X >= x1 - 2)).astype(int) + ((Y < 2) | (Y >= S - 2)).astype(int) + ((Z < x0 + 2) | (Z >= x1 - 2)).astype(int) >= 2)
    P.planks(g, fr, "darkwood", 4, width=2, across="y", nails=False, seed=3)
    P.flat(g, edges(body), "darkwood", 3)
    # diagonal braces standing 1 proud of the two sides (-x and +x)
    brace(g, "x", (2.5, x0 + 2), (S - 2.5, x1 - 2), 2.4, x0 - 1, x0, "darkwood", 4)
    brace(g, "x", (2.5, x1 - 2), (S - 2.5, x0 + 2), 2.4, x1, x1 + 1, "darkwood", 4)
    # a gold crown stencil on the front (-z), big enough to read (rule K3)
    glyph(g, "-z", x0, int(x0 + S / 2 - 4), 6, "crown", "gold", 6)
    # straw poking out under the lid
    for sx, sz in ((x0 + 2, x0 + 2), (x0 + 9, x1 - 5), (x1 - 6, x0 + 5)):
        box(g, sx, S, sz, sx + 4, S + 1, sz + 3, "gold", 6)
        box(g, sx + 1, S + 1, sz + 1, sx + 3, S + 2, sz + 2, "gold", 7)
    root = Part("crate", g)
    return Asset(id="fantasy-props-crate", pack="fantasy", category="props", name="Supply Crate", root=root)
