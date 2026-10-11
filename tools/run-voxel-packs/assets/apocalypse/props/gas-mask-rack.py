"""Gas mask rack, in the Pirate Nation style.

One chunky icon (rule K3): a timber trestle with painted plank grain, dark
frames and rusted steel bracing plates. A big respirator hangs from a
visible steel hook in the open left bay as the oversized function prop
(rule F4): a bone mask with dark lenses and a steel-rimmed filter with
painted vent slots. A signal-red jerry can and a zombie-teal ammo box stand
on the shelf. Nothing stands on the top rail, so the rack keeps one clear
outline at 28 high (a person is 36). The grain on the sloped legs follows
each facet, so the legs show no stepped stripes. Grain, slots and rust are
paint (rule S1).
"""
import numpy as np

import paint as P
from _props import asset, jerry_can, root, rust_wear, weeds
from pnkit import box, edges
from pnshapes import bar, coords, disc, paint_facets
from voxgrid import Grid

GW, GH, GD = 40, 30, 18
LX = (2, 32)  # the two A-frame legs
Z0, Z1 = 3, 15
RAIL = 25  # the top rail
SHELF = 10


def leg(g: Grid, x: int) -> np.ndarray:
    """One A-frame: two splayed timbers with a steel foot plate."""
    m = np.zeros(g.shape, dtype=bool)
    m |= bar(g, "x", (float(RAIL + 1), float(Z0 + 5)), (2.2, float(Z0 - 1)), 2.0, x, x + 6, "wood", 6)
    m |= bar(g, "x", (float(RAIL + 1), float(Z0 + 5)), (2.2, float(Z1 + 1)), 2.0, x, x + 6, "wood", 6)
    return m


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    weeds(g, LX[1] + 5, Z0 + 1, seed=1)
    n0 = len(g.solids)
    legs = leg(g, LX[0]) | leg(g, LX[1])
    # the grain runs down each sloped leg: paint every facet in its own frame
    paint_facets(g, g.solids[n0:], lambda gg, m, fr: P.planks(gg, m, "wood", 6, width=3, across="x", nails=False, length=(14, 22), frame=fr, seed=2))
    timber = box(g, LX[0], SHELF - 2, Z0 + 1, LX[1] + 6, SHELF, Z1 - 1, "wood", 6)  # the shelf
    timber |= box(g, LX[0], RAIL, Z0 + 3, LX[1] + 6, RAIL + 3, Z0 + 9, "wood", 6)  # the top rail
    P.planks(g, timber, "wood", 6, width=3, across="y", length=(14, 22), seed=2)
    P.flat(g, edges(timber), "darkwood", 4)
    # rusted steel bracing plates where the legs meet the rail, shelf and ground
    plates_m = np.zeros(g.shape, dtype=bool)
    for x in LX:
        plates_m |= box(g, x - 1, RAIL - 4, Z0 + 2, x + 7, RAIL + 1, Z0 + 4, "steel", 5)
        plates_m |= box(g, x - 1, SHELF - 3, Z0, x + 7, SHELF + 1, Z0 + 2, "steel", 5)
        plates_m |= box(g, x - 1, 0, Z0 - 2, x + 7, 2, Z1 + 2, "steel", 4)
    P.plates(g, plates_m, "steel", 5, size=(5, 4), seed=3)
    P.flat(g, edges(plates_m), "steel", 2)
    rust_wear(g, plates_m, seed=4, shade=5, run=4, grime=2)
    # the respirator, hung on a visible hook in the open left bay
    cx, top = 15, RAIL - 1
    hook = box(g, cx - 1, top, Z0 + 4, cx + 1, RAIL, Z0 + 6, "steel", 6)
    P.flat(g, edges(hook), "steel", 4)
    strap = bar(g, "x", (float(top), float(Z0 + 5)), (float(top - 4), float(Z0 + 3)), 1.3, cx - 2, cx + 2, "darkwood", 5)
    P.flat(g, strap & (np.floor(Y) % 3 == 0), "darkwood", 4)
    my0, my1 = top - 14, top - 4
    mask = box(g, cx - 7, my0, Z0, cx + 7, my1, Z0 + 7, "bone", 5)
    P.flat(g, mask, "bone", 5)
    P.mottle(g, mask, "bone", 5, cell=3, seed=5)
    P.flat(g, mask & (Y > my1 - 3), "bone", 6)
    P.flat(g, edges(mask), "darkwood", 4)
    for ex in (cx - 4, cx + 2):  # the dark lenses, each with a bright glint
        lens = mask & (X >= ex) & (X < ex + 4) & (Y > my1 - 5) & (Y < my1 - 1) & (Z < Z0 + 1)
        P.flat(g, lens, "steel", 2)
        P.flat(g, lens & (X < ex + 2) & (Y > my1 - 3), "steel", 5)
        P.outline(g, lens, "darkwood", 4, normal="z")
    P.flat(g, mask & (np.abs(X - cx) < 4.5) & (Y < my0 + 3) & (Z < Z0 + 1), "steel", 3)  # the chin cup
    for sx in (cx - 7, cx + 6):  # the head straps, buckled at both temples
        P.flat(g, mask & (np.abs(X - sx) < 1.2), "darkwood", 4)
    # the filter canister, screwed under the chin and ribbed
    f = disc(g, "z", float(cx), float(my0 + 1), 4.0, Z0 - 3, Z0 + 1, "steel", 5)
    P.flat(g, f & (np.floor(Z) % 2 == 0), "steel", 4)
    P.flat(g, f & (Z < Z0 - 2), "steel", 6)
    P.flat(g, f & (np.hypot(X - cx, Y - (my0 + 1)) < 1.6) & (Z < Z0 - 2), "teal", 5)
    P.outline(g, f, "darkwood", 4, normal="z")
    # the red jerry can and a teal ammo box on the shelf
    jerry_can(g, 22, SHELF, Z0 + 4, w=8, h=13, d=7, ramp="red", base=5, seed=6)  # clear of the right legs
    amm = box(g, 9, SHELF, Z0 + 7, 19, SHELF + 7, Z1 - 1, "teal", 4)  # behind the mask, clear of the left legs
    P.plates(g, amm, "teal", 4, size=(5, 4), rivets=False, seed=7)
    P.flat(g, edges(amm), "teal", 2)
    P.flat(g, amm & (Y > SHELF + 5), "teal", 5)
    box(g, 12, SHELF + 7, Z0 + 9, 15, SHELF + 8, Z1 - 3, "steel", 5)
    return asset("gas-mask-rack", "Gas Mask Rack", root("gas-mask-rack", g))
