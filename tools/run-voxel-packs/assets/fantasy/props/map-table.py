"""War council map table in the Pirate Nation style.

A heavy oak table on four turned octagonal legs (true slopes) braced by an
H stretcher, with a planked top in a dark frame. The oversized function
prop is the map (rules F4, K3): a big parchment sheet covers the whole top
and carries a painted chart — a sky-blue sea with a wave hatch, three
green islands with sand coasts, a dashed red march route between two
towns, a compass rose and a red X over the treasure. Chunky carved pieces
stand on it: a gold crown over the capital, two bone tower tokens, three
pin flags and a blue siege block. A brass candlestick burns at the near
corner (PFX), a dagger pins the far corner through the parchment, a rolled
scroll and an inkwell lie beside it. Detail is paint (rule S1).
About 34 long and 25 tall. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _props import coords, flame_tongue, plank_box
from pnkit import box, edges
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 38, 36, 34
CX, CZ = 19.0, 17.0
TOP0, TOP1 = 15, 18  # table top (the parchment lies on y = TOP1)
X0, X1, Z0, Z1 = 3, 35, 4, 30  # table top footprint
MX0, MX1, MZ0, MZ1 = 6, 32, 7, 27  # the parchment sheet
LEG = ((X0 + 3, Z0 + 3), (X1 - 3, Z0 + 3), (X0 + 3, Z1 - 3), (X1 - 3, Z1 - 3))


def _mask(g: Grid, start: int) -> np.ndarray:
    return np.logical_or.reduce([s.mask(g.shape) for s in g.solids[start:]])


def table(g: Grid) -> None:
    X, Y, Z = coords(g)
    for lx, lz in LEG:  # turned legs: a wide foot, a waisted shaft, a capital
        start = len(g.solids)
        g.prism("y", S.flat_ngon(lx, lz, 2.8, 8), 0, 2, C("darkwood", 4), top=S.flat_ngon(lx, lz, 2.2, 8))
        g.prism("y", S.flat_ngon(lx, lz, 2.2, 8), 2, 9, C("darkwood", 4), top=S.flat_ngon(lx, lz, 1.6, 8))
        g.prism("y", S.flat_ngon(lx, lz, 1.6, 8), 9, 11, C("darkwood", 4), top=S.flat_ngon(lx, lz, 2.4, 8))
        g.prism("y", S.flat_ngon(lx, lz, 2.4, 8), 11, TOP0, C("darkwood", 4), top=S.flat_ngon(lx, lz, 2.6, 8))
        leg = _mask(g, start)
        S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.planks(gg, mm, "darkwood", 4, width=4, across="x", length=(18, 20), nails=False, frame=fr, seed=1))
        P.flat(g, leg & ((np.abs(Y - 2) < 0.6) | (np.abs(Y - 9) < 0.6) | (np.abs(Y - 11) < 0.6)), "darkwood", 2)  # turned collars
    for lz in (Z0 + 3, Z1 - 3):  # the H stretcher
        st = box(g, X0 + 3, 4, lz - 1.5, X1 - 3, 7, lz + 1.5, "darkwood", 3)
        P.planks(g, st, "darkwood", 3, width=3, across="y", nails=False, seed=2)
    sp = box(g, CX - 1.5, 4.5, Z0 + 3, CX + 1.5, 7, Z1 - 3, "darkwood", 3)
    P.planks(g, sp, "darkwood", 3, width=3, across="y", nails=False, seed=3)
    # the top: pale cross planks in a dark frame, with a skirt under it
    skirt = box(g, X0 + 2, TOP0 - 3, Z0 + 2, X1 - 2, TOP0, Z1 - 2, "darkwood", 4)
    P.planks(g, skirt, "darkwood", 4, width=3, across="y", nails=True, seed=4)
    P.flat(g, edges(skirt), "darkwood", 2)
    top = plank_box(g, X0, TOP0, Z0, X1, TOP1, Z1, "wood", 6, across="x", width=4, frame=("darkwood", 3), nails=True, seed=5)
    P.planks(g, top & (Y >= TOP1 - 1), "wood", 6, width=4, across="x", length=(28, 34), frame="top", nails=False, seed=6)
    P.flat(g, top & (Y >= TOP1 - 1) & ((X < X0 + 2) | (X >= X1 - 2) | (Z < Z0 + 2) | (Z >= Z1 - 2)), "darkwood", 3)


def chart(g: Grid) -> None:
    """The parchment sheet and the painted chart on it."""
    X, Y, Z = coords(g)
    Xi, Zi = np.floor(X).astype(np.int64), np.floor(Z).astype(np.int64)
    sheet = box(g, MX0, TOP1, MZ0, MX1, TOP1 + 1, MZ1, "sand", 7)
    u, v = X - MX0, Z - MZ0  # chart coordinates
    sea = sheet & (u > 2) & (u < MX1 - MX0 - 2) & (v > 2) & (v < MZ1 - MZ0 - 2)
    P.flat(g, sea, "sky", 4)
    P.flat(g, sea & (((Xi + 2 * (Zi // 2)) % 7) == 0) & (Zi % 3 == 0), "sky", 5)  # wave hatch
    P.flat(g, sea & (((Xi + 2 * (Zi // 2)) % 7) == 1) & (Zi % 3 == 0), "sky", 3)
    for ix, iz, rx, rz in ((7.5, 6.0, 6.0, 4.2), (18.5, 13.5, 5.4, 3.8), (5.0, 15.5, 3.8, 2.8)):
        d = ((u - ix) / rx) ** 2 + ((v - iz) / rz) ** 2
        P.flat(g, sea & (d < 1.0), "sand", 7)  # the surf line
        P.flat(g, sea & (d < 0.86), "sand", 5)  # the sand coast
        P.flat(g, sea & (d < 0.58), "leaf", 5)  # the green inland
        P.flat(g, sea & (d < 0.18), "forest", 4)  # the hills
    P.flat(g, sheet & ~sea, "sand", 6)  # the parchment border
    P.flat(g, sheet & ~sea & (((Xi + Zi) % 5) == 0), "sand", 5)  # a frayed edge
    # the dashed march route between the two towns
    for k in range(13):
        t = k / 12.0
        ru, rv = 7.0 + t * 11.5, 6.0 + 7.0 * t + 2.2 * np.sin(t * 5.4)
        if k % 2:
            continue
        P.flat(g, sheet & (np.abs(u - ru) < 1.1) & (np.abs(v - rv) < 1.1), "red", 4)
    for tu, tv in ((7.0, 6.0), (18.5, 13.0)):  # the two towns
        P.flat(g, sheet & (np.abs(u - tu) < 1.2) & (np.abs(v - tv) < 1.2), "darkwood", 2)
    # a red X over the treasure and a compass rose in the corner
    for s in (-1, 1):
        P.flat(g, sheet & (np.abs((u - 5.0) - s * (v - 15.5)) < 1.1) & (np.abs(u - 5.0) < 3.4), "red", 4)
    cu, cv = 20.5, 4.5
    P.flat(g, sheet & (np.abs(u - cu) < 0.6) & (np.abs(v - cv) < 3.2), "darkwood", 3)
    P.flat(g, sheet & (np.abs(v - cv) < 0.6) & (np.abs(u - cu) < 3.2), "darkwood", 3)
    P.flat(g, sheet & (np.abs(u - cu) + np.abs(v - cv) < 1.6), "gold", 5)
    P.flat(g, sheet & (np.abs(u - cu) < 0.6) & (v > cv - 3.4) & (v < cv - 2.2), "red", 4)  # the north point


def pieces(g: Grid) -> tuple[float, float, float]:
    """The oversized carved pieces on the chart, the candlestick, a dagger,
    a rolled scroll and an inkwell. Returns the flame centre for the socket."""
    X, Y, Z = coords(g)
    y0 = TOP1 + 1
    # the gold crown over the capital: a jewelled band with four points
    cx_, cz_ = MX0 + 18.5, MZ0 + 13.0
    start = len(g.solids)
    g.prism("y", S.flat_ngon(cx_, cz_, 3.6, 8), y0, y0 + 4, C("gold", 5), top=S.flat_ngon(cx_, cz_, 3.2, 8))
    crown = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.flat(gg, mm, "gold", 6 if fr == "top" else 5))
    P.flat(g, crown & (Y < y0 + 1), "gold", 3)
    P.flat(g, crown & (np.abs(Y - y0 - 2) < 0.9), "red", 4)  # the jewels
    for du, dv in ((0, -3.0), (0, 3.0), (-3.0, 0), (3.0, 0)):
        g.prism("y", [(cx_ + du - 1.4, cz_ + dv - 1.4), (cx_ + du + 1.4, cz_ + dv - 1.4), (cx_ + du + 1.4, cz_ + dv + 1.4), (cx_ + du - 1.4, cz_ + dv + 1.4)],
                y0 + 4, y0 + 8, C("gold", 6), top=[(cx_ + du, cz_ + dv)] * 4)
        P.flat(g, S.last(g), "gold", 7)
    # a bone tower piece, dark-footed so it reads on the chart
    tx, tz = MX0 + 5.0, MZ0 + 6.0
    start = len(g.solids)
    g.prism("y", S.flat_ngon(tx, tz, 3.0, 8), y0, y0 + 7, C("bone", 5), top=S.flat_ngon(tx, tz, 2.4, 8))
    tw = _mask(g, start)
    S.paint_facets(g, g.solids[start:], lambda gg, mm, fr: P.stone(gg, mm, "bone", 5, block=(4, 3), frame=fr, seed=7))
    for dx, dz in ((-2.5, -2.5), (0.5, -2.5), (-2.5, 0.5), (0.5, 0.5)):
        g.box(tx + dx, y0 + 7, tz + dz, tx + dx + 2, y0 + 9, tz + dz + 2, C("bone", 6))
    P.flat(g, tw & (Y < y0 + 1.2), "bone", 2)
    P.flat(g, tw & (Y > y0 + 1.2) & (Y < y0 + 2.6), "blue", 4)  # a painted banner ring
    # two pin flags: a steel pin and a stiff little flag
    for fu, fv, ramp in ((11.5, 16.5, "red"), (21.5, 5.5, "blue")):
        fx, fz = MX0 + fu, MZ0 + fv
        g.box(fx - 0.5, y0, fz - 0.5, fx + 0.5, y0 + 10, fz + 0.5, C("steel", 5))
        g.prism("z", [(fx + 0.5, y0 + 5), (fx + 6.5, y0 + 6), (fx + 6.5, y0 + 10), (fx + 0.5, y0 + 10)], fz - 0.5, fz + 0.5, C(ramp, 5))
        fl = S.last(g)
        P.flat(g, fl & (Y > y0 + 9), ramp, 6)
        P.flat(g, fl & (X > fx + 4.5), ramp, 3)
        P.flat(g, fl & (np.abs(Y - y0 - 7.5) < 0.6), "gold", 6)
        g.prism("y", S.flat_ngon(fx, fz, 1.4, 6), y0, y0 + 1, C("steel", 3))  # the pin foot
    # the brass candlestick at the near right corner
    px, pz = X1 - 5.0, Z0 + 3.5
    S.disc(g, "y", px, pz, 2.6, TOP1, TOP1 + 1, "gold", 4)
    g.prism("y", S.flat_ngon(px, pz, 1.8, 6), TOP1 + 1, TOP1 + 3, C("gold", 5), top=S.flat_ngon(px, pz, 0.9, 6))
    g.box(px - 0.5, TOP1 + 3, pz - 0.5, px + 0.5, TOP1 + 6, pz + 0.5, C("gold", 5))
    g.prism("y", S.flat_ngon(px, pz, 0.9, 6), TOP1 + 6, TOP1 + 7, C("gold", 6), top=S.flat_ngon(px, pz, 2.0, 6))
    wax = box(g, px - 1, TOP1 + 7, pz - 1, px + 1, TOP1 + 11, pz + 1, "bone", 7)
    P.flat(g, wax & (Y < TOP1 + 8), "bone", 5)
    flame_tongue(g, px, TOP1 + 11, pz, 1.2, 4)
    # a dagger driven through the far left corner: a short blade, a gold
    # crossguard, a dark grip and a round pommel; the parchment is slit
    dx, dz = MX0 + 2.0, MZ1 - 2.5
    P.flat(g, (g.a > 0) & (np.abs(Y - TOP1 - 0.5) < 0.6) & (np.abs(X - dx) < 1.6) & (np.abs(Z - dz) < 0.9), "darkwood", 2)
    g.prism("z", [(dx - 1.0, TOP1 + 1), (dx + 1.0, TOP1 + 1), (dx + 1.0, TOP1 + 4), (dx - 1.0, TOP1 + 4)], dz - 0.5, dz + 0.5, C("steel", 6))
    P.flat(g, S.last(g) & (X < dx - 0.2), "steel", 7)
    g.box(dx - 2.5, TOP1 + 4, dz - 1.5, dx + 2.5, TOP1 + 5, dz + 1.5, C("gold", 5))
    g.box(dx - 1, TOP1 + 5, dz - 1, dx + 1, TOP1 + 10, dz + 1, C("darkwood", 3))
    g.prism("y", S.flat_ngon(dx, dz, 1.6, 6), TOP1 + 10, TOP1 + 12, C("gold", 6))
    # a rolled scroll and an inkwell along the near edge
    sc = S.disc(g, "x", TOP1 + 2.4, Z0 + 3.0, 1.6, X0 + 4, X0 + 13, "bone", 7)
    P.flat(g, sc & ((np.floor(X).astype(np.int64) % 4) == 0), "bone", 5)
    P.flat(g, sc & (np.abs(X - (X0 + 8.5)) < 1.0), "red", 4)  # the ribbon
    ink = S.disc(g, "y", X1 - 4.0, Z1 - 4.5, 1.8, TOP1 + 1, TOP1 + 4, "blue", 2)
    P.flat(g, ink & (Y > TOP1 + 3), "navy", 1)
    P.flat(g, ink & (Y < TOP1 + 2), "gold", 4)
    return (px, TOP1 + 12.5, pz)


def build() -> Asset:
    g = Grid(W, H, D)
    table(g)
    chart(g)
    flame = pieces(g)
    return Asset(id="fantasy-props-map-table", pack="fantasy", category="props", name="Map Table", root=Part("map-table", g),
                 sockets=[Socket("socket-candle", at=flame)],
                 pfx=[{"effectId": "rvx-fantasy-torch-flame", "socket": "socket-candle", "trigger": "idle", "size": 5}])
