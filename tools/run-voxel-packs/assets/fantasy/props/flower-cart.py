"""Flower cart in the Pirate Nation style.

A two-wheeled market handcart: a planked tray in warm wood with painted
orange panels, cream trim bands and a gold emblem, carried on two clean
spoked wheels with iron tyres and gold hubs. The oversized function prop
is the bank of blooms heaped in the tray (rules F4 and C3): red, orange,
gold and cream heads with true petals over leaf foliage, with a crate of
bulbs and a wrapped bouquet among them. Continuous handle shafts run to a
grip, and a braced prop leg holds the nose up. About 38 long and 32 tall.
"""

import numpy as np

import paint as P
from _props import coords, glyph, plank_box
from pnkit import box, edges
from pnshapes import bar, cone, disc, wheel
from voxgrid import C, Asset, Grid, Part

W, H, D = 40, 40, 26
BX0, BX1 = 7, 35  # the cart tray
ZF, ZB = 5, 20  # the tray's front and back walls
BED = 15  # the tray floor top
RIM = 23  # the tray side rim
WR = 7.0  # wheel radius
WC = 21  # wheel centre along x
# (x, z, head height, petal colour, kind): kind 0 = four-petal daisy, 1 = tulip bell
BLOOMS = (
    (11, 9, 28, "red", 0), (19, 8, 32, "gold", 1), (27, 9, 29, "orange", 0),
    (31, 16, 27, "magenta", 1), (16, 16, 31, "bone", 0), (24, 17, 27, "red", 1),
)


def daisy(g: Grid, fx: int, fz: int, hy: int, ramp: str, shade: int) -> None:
    """A four-petal head on a cross plan: four broad petals with tapered tips
    round a gold eye, so the silhouette reads as a flower (rule F6)."""
    Yi = np.floor(coords(g)[1]).astype(int)
    for dx, dz, tx, tz in ((-4, -1, -5, 0), (1, -1, 4, 0), (-1, -4, 0, -5), (-1, 1, 0, 4)):
        pt = box(g, fx + dx, hy, fz + dz, fx + dx + 3, hy + 2, fz + dz + 3, ramp, shade)
        pt |= box(g, fx + tx, hy, fz + tz, fx + tx + 2, hy + 2, fz + tz + 2, ramp, shade)
        P.flat(g, pt, ramp, shade)
        P.flat(g, pt & (Yi == hy + 1), ramp, min(7, shade + 1))
        P.flat(g, pt & (Yi == hy), ramp, max(1, shade - 2))
    eye = box(g, fx - 1, hy, fz - 1, fx + 2, hy + 3, fz + 2, "gold", 6)
    P.flat(g, eye, "gold", 6)
    P.flat(g, eye & (Yi > hy + 1), "gold", 7)


def tulip(g: Grid, fx: int, fz: int, hy: int, ramp: str, shade: int) -> None:
    """A bell head: a narrow foot opening into a cup, with three petal tips
    standing proud of the rim."""
    X, Y, Z = coords(g)
    Yi = np.floor(Y).astype(int)
    cup = cone(g, "y", fx + 0.5, fz + 0.5, 1.2, hy, hy + 5, ramp, shade, n=6, r_top=3.2)
    P.flat(g, cup, ramp, shade)
    P.flat(g, cup & (Yi >= hy + 3), ramp, min(7, shade + 1))
    P.flat(g, cup & (Yi <= hy + 1), ramp, max(1, shade - 2))
    for ax, az in ((2.8, 0.0), (-1.4, 2.4), (-1.4, -2.4)):  # three petal tips
        tip = box(g, fx + ax - 0.5, hy + 5, fz + az - 0.5, fx + ax + 1.5, hy + 7, fz + az + 1.5, ramp, shade)
        P.flat(g, tip, ramp, min(7, shade + 1))
        P.flat(g, tip & (Yi == hy + 6), ramp, shade)
    P.flat(g, cup & (Yi == hy + 4), ramp, max(1, shade - 1))  # the shaded throat


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # two matching spoked wheels, clear of the tray, on a through axle
    for cz in (1, 21):
        wheel(g, "z", WC, 0, WR, cz, cz + 4, n=12, spokes=8, gaps=False,
              tyre=("iron", 4), rim=("wood", 6), spoke=("wood", 7), hub=("gold", 5),
              rim_w=2.2, hub_r=2.0, hub_out=1.0)
    axle = disc(g, "z", WC, WR, 1.6, 4, 22, "darkwood", 3, n=6)
    P.flat(g, axle, "darkwood", 3)
    P.flat(g, axle & (Yi > WR), "darkwood", 4)

    # the bolster and two axle cheeks that carry the tray on the axle
    bolster = box(g, 13, 12, ZF + 1, 30, BED, ZB - 1, "darkwood", 4)
    P.planks(g, bolster, "darkwood", 4, width=3, across="y", frame="wall", nails=True, seed=7)
    P.flat(g, edges(bolster), "darkwood", 2)
    for cz0 in (3, 19):
        cheek = box(g, WC - 4, 5, cz0, WC + 4, 13, cz0 + 3, "darkwood", 4)
        P.planks(g, cheek, "darkwood", 4, width=3, across="y", frame="z", nails=True, seed=cz0)
        P.flat(g, edges(cheek), "darkwood", 2)

    # the tray: a planked floor, painted side panels and a cream trim band
    floor = plank_box(g, BX0, BED - 3, ZF, BX1, BED, ZB, "wood", 5, across="y", width=4, seed=1)
    P.flat(g, floor & (Yi == BED - 3), "darkwood", 3)
    for z0, z1, fr in ((ZF, ZF + 2, "z"), (ZB - 2, ZB, "z")):
        side = box(g, BX0, BED - 3, z0, BX1, RIM, z1, "wood", 5)
        P.planks(g, side, "wood", 5, width=4, across="y", frame=fr, nails=True, seed=z0)
        panel = side & (Yi > BED - 1) & (Yi < RIM - 3)
        P.planks(g, panel, "orange", 4, width=4, across="y", frame=fr, nails=True, seed=z0 + 3)
        P.flat(g, side & (Yi == RIM - 3), "bone", 7)
        P.flat(g, side & (Yi == RIM - 4), "gold", 6)
        P.flat(g, side & (Yi == BED - 1), "gold", 6)
        P.flat(g, side & ((Yi >= RIM - 2) | (Yi < BED - 2)), "darkwood", 3)
        P.outline(g, side, "darkwood", 3, normal="z")
    for x0, x1 in ((BX0, BX0 + 3), (BX1 - 3, BX1)):
        endb = box(g, x0, BED - 3, ZF, x1, RIM, ZB, "wood", 5)
        P.planks(g, endb, "wood", 5, width=4, across="y", frame="x", nails=True, seed=x0)
        epanel = endb & (Yi > BED - 1) & (Yi < RIM - 3)
        P.planks(g, epanel, "orange", 4, width=4, across="y", frame="x", nails=True, seed=x0 + 3)
        P.flat(g, endb & (Yi == RIM - 3), "bone", 7)
        P.flat(g, endb & (Yi == RIM - 4), "gold", 6)
        P.flat(g, endb & ((Yi >= RIM - 2) | (Yi < BED - 2)), "darkwood", 3)
        P.outline(g, endb, "darkwood", 3, normal="x")
    for cx0 in (BX0, BX1 - 2):  # dark corner posts frame the painted panels (rule F3)
        for cz0 in (ZF, ZB - 2):
            P.flat(g, (g.a > 0) & (Xi >= cx0) & (Xi < cx0 + 2) & (Zi >= cz0) & (Zi < cz0 + 2)
                   & (Yi >= BED - 3) & (Yi < RIM), "darkwood", 3)
    glyph(g, "-z", ZF, 19, BED + 2, "fleur", "gold", 7, scale=1, depth=2)

    # two continuous handle shafts down to a cross grip, and a braced prop leg
    for hz in (ZF + 2, ZB - 5):
        shaft = bar(g, "z", (BX0 + 2, BED + 1), (2, 7), 2.4, hz, hz + 3, "wood", 5)
        P.planks(g, shaft, "wood", 5, width=3, across="y", frame="z", nails=False, seed=hz)
        P.outline(g, shaft, "darkwood", 3, normal="z")
    grip = box(g, 1, 5, ZF + 1, 4, 8, ZB - 2, "darkwood", 4)
    P.planks(g, grip, "darkwood", 4, width=2, across="x", frame="x", nails=False, seed=2)
    P.flat(g, edges(grip), "darkwood", 2)
    leg = bar(g, "z", (BX0 + 3, BED - 1), (BX0 + 1, 2), 2.4, 11, 14, "wood", 4)
    P.planks(g, leg, "wood", 4, width=3, across="y", frame="z", nails=False, seed=4)
    P.outline(g, leg, "darkwood", 3, normal="z")
    foot = box(g, BX0 - 1, 0, 10, BX0 + 4, 2, 15, "darkwood", 4)  # the shod foot
    P.flat(g, foot, "darkwood", 4)
    P.flat(g, edges(foot), "darkwood", 2)
    strut = bar(g, "z", (BX0 + 2, 6), (13, BED - 2), 1.8, 11, 14, "darkwood", 4)
    P.flat(g, strut, "darkwood", 4)

    # a bed of foliage, then the blooms
    bed = box(g, BX0 + 3, BED, ZF + 2, BX1 - 3, BED + 4, ZB - 2, "leaf", 4)
    P.flat(g, bed, "leaf", 4)
    P.flat(g, bed & (((Xi // 3 + Zi // 3) % 2) == 0), "leaf", 5)
    P.flat(g, bed & (Yi > BED + 2), "leaf", 5)
    for bx, bz, hy, ramp, kind in BLOOMS:
        stem = box(g, bx, BED + 3, bz, bx + 1, hy + 1, bz + 1, "leaf", 4)
        P.flat(g, stem, "leaf", 4)
        P.flat(g, stem & ((Yi % 3) == 0), "leaf", 5)
        lf = box(g, bx - 3, hy - 6, bz, bx, hy - 4, bz + 1, "leaf", 5)  # one leaf per stem
        P.flat(g, lf, "leaf", 5)
        P.flat(g, lf & (Yi == hy - 6), "leaf", 3)
        shade = 6 if ramp in ("gold", "bone") else 4
        if kind == 0:
            daisy(g, bx, bz, hy, ramp, shade)
        else:
            tulip(g, bx, bz, hy, ramp, shade)

    # a wrapped bouquet of cut stems standing in the tray (a recognisable good)
    wrap = cone(g, "y", BX0 + 5.5, ZB - 4.5, 1.4, BED + 3, BED + 13, "bone", 7, n=6, r_top=3.4)
    P.flat(g, wrap, "bone", 7)
    P.flat(g, wrap & (Yi < BED + 8), "bone", 5)
    P.flat(g, wrap & (Yi == BED + 9), "red", 5)  # the ribbon
    P.flat(g, wrap & (Yi == BED + 10), "red", 4)
    stems = box(g, BX0 + 3, BED + 13, ZB - 7, BX0 + 8, BED + 17, ZB - 2, "leaf", 5)
    P.flat(g, stems, "leaf", 5)
    P.flat(g, stems & (((Xi + Zi) % 2) == 0), "leaf", 4)
    P.flat(g, stems & (Yi > BED + 15), "leaf", 6)

    root = Part("flower-cart", g)
    return Asset(id="fantasy-props-flower-cart", pack="fantasy", category="props", name="Flower Cart", root=root)
