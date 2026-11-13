"""Scrapper's wheelbarrow, in the Pirate Nation style.

One chunky icon (rule K3): a flared teal tray with a hazard-striped
rolled lip (a true-slope frustum, rule F2) sits on two fat wooden rails
that run UNDER the tray, forward into a steel fork over one oversized
wheel at the nose (rule F4) and back to worn grips, propped on two chunky
stub legs. The tray is open: a dirt bed inside the rim carries a heap of
broken concrete, a red brick and a bent length of rebar that crest above
the lip, and a shovel leans across it (rule F5). Plates, rivets, the
hazard-yellow lip, rust blooms and the dirt are paint (rule S1). Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _props import asset, rock, root
from pnkit import box, edges
from voxgrid import Grid

GW, GH, GD = 22, 32, 42
CX = 11.0
WR, WZ = 6.0, 7.0  # the wheel flat radius and its centre along z (it stands on y = 0)
TZ0, TZ1 = 13, 33  # the tray along z
TY0, TY1 = 11, 23  # the tray floor and its lip
HX = 6.5  # the rails and handles, out from the centre
RAIL = 1.7  # half the rail thickness across x


def build():
    g = Grid(GW, GH, GD)
    X, Y, Z = S.coords(g)

    # ---- the wheel: one oversized spoked wheel, centred under the nose
    w = S.wheel(g, "x", WZ, 0.0, WR, CX - 2, CX + 2, n=8, spokes=5,
                tyre=("gray", 3), rim=("steel", 4), spoke=("steel", 6), hub=("gold", 5),
                rim_w=2.1, hub_r=2.3, hub_out=0.5)
    rad = S.ngon_radius(g, "x", WR, WZ, 8, S._DOWN["x"])
    P.flat(g, w["mask"] & (rad > WR - 1.1) & (rad < WR - 0.2), "gray", 2)  # the dark tyre shoulder
    P.flat(g, w["mask"] & (rad > WR - 2.4) & (rad < WR - 1.8), "steel", 2)  # the rim bead

    # ---- the fork over the wheel and the axle yoke that ties it to the rails
    for s in (-1, 1):
        fx = CX + s * 3.4
        S.bar(g, "x", (9.6, 15.0), (WR, WZ), 2.6, fx - 1.2, fx + 1.2, "steel", 4)
        P.flat(g, S.last(g), "steel", 4)
    yoke = box(g, CX - HX + 0.2, 7.6, 14, CX + HX - 0.2, 10.6, 18, "steel", 4)
    P.plates(g, yoke, "steel", 4, size=(7, 4), rivets=True, seed=1)
    P.flat(g, edges(yoke), "steel", 2)

    # ---- the rails: fat wooden members under the tray, rising aft to the grips
    rails = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        hx = CX + s * HX
        rails |= S.bar(g, "x", (8.6, 12.0), (9.0, 29.0), 3.4, hx - RAIL, hx + RAIL, "wood", 6)
        rails |= S.bar(g, "x", (9.0, 28.0), (15.5, 39.0), 3.2, hx - RAIL, hx + RAIL, "wood", 6)
    P.planks(g, rails, "wood", 6, width=3, across="z", nails=False, length=(26, 30), seed=2)
    P.flat(g, edges(rails), "darkwood", 4)
    grip = rails & (Z > 34)
    P.flat(g, grip, "darkwood", 6)
    P.flat(g, edges(grip), "darkwood", 4)
    P.flat(g, rails & (Z > 32.0) & (Z < 34.0), "steel", 5)  # the grip ferrule

    # ---- the stub legs: chunky outlined posts on broad feet (rule F3)
    legs = np.zeros(g.shape, dtype=bool)
    for s in (-1, 1):
        hx = CX + s * HX
        legs |= box(g, hx - 2.0, 2, 25, hx + 2.0, 9, 29, "steel", 5)
        legs |= box(g, hx - 2.8, 0, 24, hx + 2.8, 2, 30, "steel", 4)
    P.plates(g, legs, "steel", 5, size=(5, 6), rivets=True, seed=3)
    P.flat(g, edges(legs), "steel", 3)
    P.flat(g, legs & (Y < 2), "steel", 3)

    # ---- the tray: a flared frustum with a rolled hazard lip
    base = [(CX - 5, TZ0 + 2), (CX + 5, TZ0 + 2), (CX + 5, TZ1 - 3), (CX - 5, TZ1 - 3)]
    lip = [(CX - 8, TZ0), (CX + 8, TZ0), (CX + 8, TZ1), (CX - 8, TZ1)]
    g.prism("y", base, TY0, TY1, S.C("teal", 4), top=lip)
    tray = S.last(g)
    for m, fr in S.facets(g, [g.solids[-1]]):
        P.plates(g, m, "teal", 4, size=(9, 8), rivets=True, frame=fr, seed=4)
    P.flat(g, tray & (Y < TY0 + 2.5), "teal", 2)
    P.flat(g, tray & (Y > TY1 - 7) & (Y < TY1 - 2.5), "teal", 5)  # the lit upper band
    P.flat(g, tray & (np.abs(Y - (TY1 - 2)) < 0.6), "teal", 2)  # the dark line under the lip
    for rz, ry, rr in ((TZ0 + 5, 17.0, 3.8), (TZ1 - 6, 15.0, 3.0), (TZ0 + 13, 13.5, 2.6)):  # rust blooms
        d = np.hypot(Z - rz, (Y - ry) * 1.2)
        P.flat(g, tray & (d < rr), "rust", 5)
        P.flat(g, tray & (d < rr * 0.5), "rust", 4)
    P.flat(g, tray & (Z < TZ0 + 1) & (Y > TY1 - 8) & (Y < TY1 - 3) & (np.abs(X - CX) < 4), "bone", 6)  # a painted patch

    # ---- the rolled lip: a steel rim all round, hazard-striped at the nose
    rolled = tray & (Y > TY1 - 1.6)
    P.flat(g, rolled, "steel", 5)
    P.flat(g, rolled & (Y > TY1 - 1.0) & ((np.abs(X - CX) > 7.0) | (Z < TZ0 + 1) | (Z > TZ1 - 1)), "steel", 3)
    PP.hazard(g, rolled & (Z < TZ0 + 5), period=8, a=("gold", 5), b=("darkwood", 3), frame="top")

    # ---- the open bed inside the rim: dirt, not a lid
    bed = tray & (Y > TY1 - 1.0) & (np.abs(X - CX) < 6.6) & (Z > TZ0 + 2) & (Z < TZ1 - 2)
    PP.concrete(g, bed, "sand", 4, size=6, cracks=5, frame="top", seed=5)
    P.flat(g, bed & (np.abs(X - CX) > 5.6), "sand", 2)  # the shaded inner wall of the tray
    P.flat(g, bed & ((Z < TZ0 + 3.0) | (Z > TZ1 - 3.0)), "sand", 2)

    # ---- the load: broken concrete heaped above the lip, a brick and a rebar
    for k, (cx, cz, r, h, sh) in enumerate(((CX - 2.6, TZ0 + 7, 4.0, 6, 5), (CX + 2.8, TZ0 + 13, 3.6, 5, 6), (CX - 1.0, TZ1 - 6, 3.2, 4, 4))):
        rock(g, cx, cz, TY1 - 2, r, h, n=6, seed=10 + k, ramp="sand", base=sh)
    brick = box(g, CX + 1, TY1 + 1, TZ0 + 3, CX + 6, TY1 + 4, TZ0 + 10, "red", 4)
    P.stone(g, brick, "red", 4, block=(4, 2), mortar=-1, cracks=0.0, seed=6)
    P.flat(g, edges(brick), "red", 2)
    S.bar(g, "x", (TY1 + 1, TZ1 - 8), (TY1 + 6, TZ1 - 2), 1.3, CX - 4, CX - 2, "steel", 4)
    S.bar(g, "x", (TY1 + 5, TZ1 - 3), (TY1 + 4, TZ1 + 2), 1.3, CX - 4, CX - 2, "steel", 4)

    # ---- the shovel laid across the lip (rule F5)
    S.bar(g, "z", (CX - 7, TY1 + 0), (CX + 3, TY1 + 3), 1.8, TZ0 + 2, TZ0 + 4, "wood", 5)
    blade = S.bar(g, "z", (CX + 2, TY1 + 2), (CX + 7, TY1 + 6), 4.0, TZ0 + 1, TZ0 + 3, "steel", 6)
    P.flat(g, blade & (Y > TY1 + 4), "steel", 4)
    P.flat(g, edges(blade), "steel", 3)
    return asset("wheelbarrow", "Scrapper's Wheelbarrow", root("wheelbarrow", g))
