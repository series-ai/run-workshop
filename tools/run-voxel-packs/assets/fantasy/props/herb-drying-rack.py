"""Herb drying rack in the Pirate Nation style.

One clean A-frame at each end, in the theme's warm honey wood with calm
vertical grain and dark framed feet, carries two round rails. Fat bundles
of herbs hang from them as chunky leaf clusters with a cord, a cloth tie
and cut stems showing above it (rule K3), spaced so nothing crosses a rail
below. An oversized stone mortar with its pestle and a basket of cut stems
stand at the foot as the function props (rule F4). About 38 wide and 36
tall.
"""

import numpy as np

import paint as P
from _props import coords
from pnkit import box, edges
from pnshapes import disc, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 38, 20
FX = (2, 32)  # the A-frame x starts (4 wide)
ZC = 10  # the rail plane
APEX = 33
RAILS = (29, 19)
# (x, rail y, cluster half-size, length, ramp, shade)
BUNDLES = (
    (9, 29, 3, 7, "leaf", 5), (16, 29, 3, 6, "gold", 5), (23, 29, 3, 7, "moss", 5),
    (30, 29, 3, 6, "leaf", 4), (16, 19, 3, 6, "magenta", 5), (22, 19, 3, 5, "leaf", 6),
)


def bundle(g: Grid, bx: int, ry: int, hs: int, length: int, ramp: str, shade: int, seed: int) -> None:
    """One hanging bunch: a cord, a cloth tie, cut stems above it and a
    chunky cluster of leaves below (never a smooth banded cone)."""
    X, Y, Z = coords(g)
    Yi = np.floor(Y).astype(int)
    cord = box(g, bx, ry - 3, ZC - 1, bx + 1, ry, ZC + 1, "sand", 5)
    P.flat(g, cord, "sand", 5)
    for k, (sx, sz, sh) in enumerate(((-2, 0, 3), (1, 1, 2), (0, -2, 3))):  # cut stems above the tie
        st = box(g, bx + sx, ry - 4, ZC + sz, bx + sx + 1, ry - 4 + sh, ZC + sz + 1, "sand", 6)
        P.flat(g, st, "sand", 6 if k % 2 else 5)
    tie = box(g, bx - 1, ry - 6, ZC - 1, bx + 2, ry - 4, ZC + 2, "sand", 6)
    P.flat(g, tie, "sand", 6)
    P.flat(g, tie & (Yi == ry - 6), "sand", 4)
    P.flat(g, tie & (Yi == ry - 5), "darkwood", 4)  # the cord round the stems
    top = ry - 6
    rng = np.random.default_rng(seed)
    for k in range(9):  # chunky leaf blocks with gaps between them (rule F1)
        t = rng.random()
        w = 2 if rng.random() < 0.55 else 3
        cy = top - 1 - int(round(t * (length - 2)))
        spread = hs * (1.0 - 0.45 * t)
        dx = int(round(rng.uniform(-spread, spread)))
        dz = int(round(rng.uniform(-spread, spread)))
        blk = box(g, bx + dx, cy, ZC + dz, bx + dx + w, cy + w, ZC + dz + w, ramp, shade)
        P.flat(g, blk, ramp, shade)
        P.flat(g, blk & (Yi == cy + w - 1), ramp, min(7, shade + 1))
        P.flat(g, blk & (Yi == cy), ramp, max(1, shade - 2))
    tipy = top - length
    for dx, dz in ((0, 0), (-1, 1), (1, -1)):  # a few leaf tips at the point
        P.flat(g, box(g, bx + dx, tipy, ZC + dz, bx + dx + 1, tipy + 2, ZC + dz + 1, ramp, max(1, shade - 1)),
               ramp, max(1, shade - 1))


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # one clean A-frame at each end: two splayed legs, a cross-tie, dark feet
    for fx in FX:
        for z0, z1 in ((2.0, ZC - 1.0), (18.0, ZC + 1.0)):
            g.prism("x", quad((1.0, z0), (APEX, z1), 1.9), fx, fx + 3, C("wood", 5))
            leg = last(g)
            P.planks(g, leg, "wood", 5, width=3, across="x", frame="x", nails=False, seed=fx)
            P.flat(g, leg & (Zi < ZC), "wood", 6)  # the lit front face
            P.flat(g, leg & (Zi > ZC), "wood", 4)  # the shaded back face
            P.flat(g, leg & (Yi < 3), "darkwood", 3)  # the dark foot
        tie = box(g, fx, 13, 4, fx + 3, 16, 16, "wood", 4)
        P.planks(g, tie, "wood", 4, width=2, across="y", frame="x", nails=True, seed=fx + 1)
        P.flat(g, edges(tie), "darkwood", 3)
        apx = box(g, fx - 1, APEX - 1, ZC - 3, fx + 4, APEX + 1, ZC + 3, "darkwood", 4)
        P.flat(g, apx, "darkwood", 4)
        P.flat(g, apx & (Yi == APEX), "darkwood", 5)

    # two round rails between the frames
    for ry in RAILS:
        rail = disc(g, "x", ry + 1, ZC, 1.9, 2, 35, "darkwood", 5, n=6)
        P.flat(g, rail, "darkwood", 5)
        P.flat(g, rail & (Yi > ry + 1), "darkwood", 6)
        P.flat(g, rail & ((Xi % 7) == 0), "darkwood", 4)

    for k, (bx, ry, hs, ln, ramp, shade) in enumerate(BUNDLES):
        bundle(g, bx, ry, hs, ln, ramp, shade, 11 + k)

    # the function props at the foot: an oversized mortar and a stem basket
    mort = disc(g, "y", 9, 6, 5.2, 0, 7, "stone", 4, n=8)
    P.stone(g, mort, "stone", 4, block=(4, 3), seed=6)
    md = np.hypot(X - 9, Z - 6)
    P.flat(g, mort & (Yi > 5) & (md < 3.8), "stone", 2)  # the bowl
    P.flat(g, mort & (Yi == 6) & (md >= 3.8), "stone", 5)
    P.flat(g, mort & (Yi < 1), "stone", 2)
    P.flat(g, mort & (Yi > 5) & (md < 2.4), "moss", 4)  # crushed herb in the bowl
    g.prism("z", quad((7.0, 6.5), (12.0, 15.0), 1.6, 1.2), 5, 8, C("stone", 5))
    pest = last(g)
    P.flat(g, pest, "stone", 5)
    P.flat(g, pest & (Yi > 11), "stone", 6)
    P.outline(g, pest, "stone", 3, normal="z")
    bask = disc(g, "y", 29, 6, 4.6, 0, 7, "sand", 5, n=8)
    P.planks(g, bask, "sand", 5, width=2, across="x", frame="wall", nails=False, seed=5)
    P.flat(g, bask & ((Yi == 1) | (Yi == 5)), "sand", 4)
    P.flat(g, bask & (Yi == 6), "sand", 3)
    fill = disc(g, "y", 29, 6, 3.8, 7, 11, "leaf", 5, n=6)
    P.flat(g, fill, "leaf", 5)
    P.flat(g, fill & (Yi > 9), "leaf", 6)
    P.flat(g, fill & (((Xi + Zi) % 3) == 0), "leaf", 4)
    for sx, sh in ((26, 4), (31, 5), (29, 6)):  # a few stems standing out of the basket
        st = box(g, sx, 11, 5, sx + 1, 11 + sh, 7, "leaf", 6)
        P.flat(g, st, "leaf", 6)

    root = Part("herb-drying-rack", g)
    return Asset(id="fantasy-props-herb-drying-rack", pack="fantasy", category="props", name="Herb Drying Rack", root=root)
