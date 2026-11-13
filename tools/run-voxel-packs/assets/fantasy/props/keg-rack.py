"""Ale keg rack in the Pirate Nation style.

Three oversized kegs lie end-on in a thick timber rack, so the prop reads
as a wall of hooped barrel heads (rules F4 and K3). Each head carries a
painted stave pattern, an iron hoop rim and a red brewer's mark; the front
keg has a gold tap over a cream-rimmed pail, and a chalked tally board
hangs on the end post. About 38 wide and 31 tall.
"""

import math

import numpy as np

import paint as P
from _props import coords
from pnkit import box
from pnshapes import disc, radial
from voxgrid import C, Asset, Grid, Part

W, H, D = 38, 32, 26
ZK0, ZK1 = 5, 21  # the kegs run along z
PX = (1, 33)  # end post x starts (4 thick)


def keg(g: Grid, cx: float, cy: float, r: float, seed: int, mark: str = "red") -> np.ndarray:
    """A keg lying along z: painted staves, iron hoops and painted heads."""
    m = disc(g, "z", cx, cy, r, ZK0, ZK1, "wood", 5, n=10)
    X, Y, Z = coords(g)
    Zi = np.floor(Z).astype(int)
    rr = radial(g, "z", cx, cy)
    ang = np.arctan2(Y - cy, X - cx)
    stave = np.floor((ang + math.pi) / (2 * math.pi) * 10).astype(int)
    side = m & (rr > r - 1.8)
    P.flat(g, side & (stave % 2 == 0), "wood", 6)
    P.flat(g, side & (stave % 4 == 1), "wood", 4)
    for zz in (ZK0 + 2, (ZK0 + ZK1) // 2, ZK1 - 3):  # iron hoops
        P.flat(g, m & (Zi == zz), "iron", 4)
        P.flat(g, m & (Zi == zz) & (stave % 3 == 0), "iron", 5)
    for zc, face in ((ZK0, Zi < ZK0 + 1), (ZK1 - 1, Zi > ZK1 - 2)):
        end = m & face
        P.flat(g, end, "wood", 6)
        P.flat(g, end & (stave % 2 == 0), "wood", 7)
        P.flat(g, end & (rr > r - 1.6), "iron", 4)
        P.flat(g, end & (rr > r - 2.8) & (rr < r - 1.6), "wood", 5)
        P.flat(g, end & (rr > 2.0) & (rr < 3.4), mark, 5)  # the painted brewer's ring
        P.flat(g, end & (rr > 2.4) & (rr < 3.0), mark, 6)
        P.flat(g, end & (rr < 1.3), "gold", 5)  # the bung
        P.flat(g, end & (rr < 0.7), "gold", 6)
    return m


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # four stout posts and two pairs of cradle rails
    for px in PX:
        for pz in (ZK0 - 1, ZK1 - 3):
            post = box(g, px, 0, pz, px + 4, 30, pz + 4, "darkwood", 4)
            P.planks(g, post, "darkwood", 4, width=4, across="x", nails=False, seed=px + pz)
            P.flat(g, post & (Yi > 28), "wood", 5)
    for ry in (2, 15):
        for pz in (ZK0 - 1, ZK1 - 3):
            rail = box(g, PX[0], ry, pz, PX[1] + 4, ry + 3, pz + 4, "wood", 5)
            P.planks(g, rail, "wood", 5, width=3, across="y", frame="z", nails=True, seed=ry + pz)
            P.outline(g, rail, "darkwood", 3, normal="z")

    # three kegs: two below, one above
    keg(g, 11, 11, 6.0, 1, mark="red")
    keg(g, 26, 11, 6.0, 2, mark="blue")
    keg(g, 19, 24, 5.6, 3, mark="red")

    # the gold tap on the lower-left keg and the pail that catches the drips
    tap = disc(g, "z", 11, 8, 2.0, ZK0 - 5, ZK0 + 1, "gold", 5, n=6)
    P.flat(g, tap & (Zi < ZK0 - 3), "gold", 6)
    P.flat(g, tap & (Zi > ZK0 - 2), "gold", 4)
    spout = box(g, 10, 5, ZK0 - 5, 12, 8, ZK0 - 3, "gold", 4)
    P.flat(g, spout & (Yi < 6), "gold", 6)
    lever = box(g, 10, 10, ZK0 - 5, 12, 15, ZK0 - 3, "gold", 6)
    P.flat(g, lever & (Yi > 13), "red", 5)  # the painted lever grip
    P.flat(g, (g.a > 0) & (Xi == 11) & (Yi > 5) & (Yi < 7) & (Zi == ZK0 - 6), "gold", 7)  # the trickle
    pail = disc(g, "y", 11, 4, 3.6, 0, 6, "wood", 6, n=8)
    P.planks(g, pail, "wood", 6, width=2, across="x", frame="wall", nails=False, seed=5)
    P.flat(g, pail & ((Yi == 1) | (Yi == 4)), "iron", 4)
    P.flat(g, pail & (Yi > 4) & (np.hypot(X - 11, Z - 4) < 2.6), "gold", 5)  # ale in the pail
    P.flat(g, pail & (Yi > 4) & (np.hypot(X - 11, Z - 4) < 1.4), "gold", 7)

    # a chalked tally board on the +x post
    board = box(g, PX[1] + 4, 16, ZK0 + 1, PX[1] + 5, 26, ZK0 + 9, "darkwood", 3)
    P.flat(g, board, "darkwood", 2)
    P.outline(g, board, "wood", 5, normal="x")
    for k in range(4):
        P.flat(g, board & (Yi > 18) & (Yi < 24) & (Zi == ZK0 + 2 + k * 2), "bone", 7)
    P.flat(g, board & (Yi == 21) & (Zi > ZK0 + 1) & (Zi < ZK0 + 8), "bone", 7)

    # two mugs on the top rail
    for mx in (6, 31):
        mug = disc(g, "y", mx, ZK0 - 2, 2.0, 18, 23, "steel", 6, n=6)
        P.flat(g, mug & (Yi > 21), "bone", 7)
        P.flat(g, mug & (Yi > 19) & (Yi < 22), "gold", 4)
        P.flat(g, mug & (Yi < 19), "steel", 4)

    root = Part("keg-rack", g)
    return Asset(id="fantasy-props-keg-rack", pack="fantasy", category="props", name="Keg Rack", root=root)
