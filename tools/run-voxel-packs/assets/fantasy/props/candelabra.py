"""A carved oak and brass candelabra with five bright candle flames."""

import numpy as np

import paint as P
from _props import brace, coords
from pnkit import box, edges
from pnshapes import disc, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 24, 40, 14
CX, CZ = 12, 6
ARM_Y = 24


def flame(g: Grid, cx: float, y: int, cz: float, lean: float = 0.0) -> np.ndarray:
    """Paint a short, leaning flame with a gold-hot root and red tip."""
    base = flat_ngon(cx, cz, 1.35, 4, -np.pi / 4)
    g.prism("y", base, y, y + 3, C("orange", 5), top=[(cx + lean, cz)] * 4)
    m = last(g)
    _X, Y, _Z = coords(g)
    t = Y - y
    P.flat(g, m & (t < 1), "gold", 6)
    P.flat(g, m & (t >= 1) & (t < 2), "orange", 5)
    P.flat(g, m & (t >= 2), "red", 5)
    return m


def cup(g: Grid, cx: int, y: int, cz: int) -> np.ndarray:
    """A dark socket and a flared brass candle tray."""
    socket = box(g, cx - 1, y, cz - 1, cx + 1, y + 1, cz + 1, "darkwood", 3)
    P.planks(g, socket, "darkwood", 3, width=2, across="x", nails=False, seed=cx)
    tray = box(g, cx - 2, y + 1, cz - 2, cx + 2, y + 2, cz + 2, "gold", 5)
    P.flat(g, edges(tray), "gold", 4)
    X, Y, Z = coords(g)
    P.flat(g, tray & (Y > y + 1) & (np.abs(X - cx) <= 1) & (np.abs(Z - cz) <= 1), "gold", 7)
    # Four shaded brass rivets mark the tray corners.
    rivets = tray & (Y > y + 1) & (np.abs(X - cx) > 1.2) & (np.abs(Z - cz) > 1.2)
    P.flat(g, rivets, "gold", 2)
    return socket | tray


def candle(g: Grid, cx: int, y: int, cz: int, h: int, lean: float) -> np.ndarray:
    """Build a wax pillar with a painted drip and a vivid flame."""
    x0, z0 = cx - 1, cz - 1
    m = box(g, x0, y, z0, x0 + 2, y + h, z0 + 2, "bone", 6)
    X, Y, Z = coords(g)
    IX, IY, IZ = np.floor(X), np.floor(Y), np.floor(Z)
    P.flat(g, m & (IY == y + h - 1), "bone", 7)
    P.flat(g, m & (IX == x0) & (IY > y + 1) & (IY < y + h - 1), "bone", 5)
    # Two short marks on the front face read as melted wax.
    drip = m & (IZ == z0) & (((IX == x0) & (IY == y + 1)) | ((IX == x0 + 1) & (IY == y + 2)))
    P.flat(g, drip, "bone", 4)
    wick = box(g, cx - 0.5, y + h, cz - 0.5, cx + 0.5, y + h + 1, cz + 0.5, "darkwood", 2)
    return m | wick | flame(g, cx, y + h + 1, cz, lean)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)

    # Three thick oak feet flare from the lower brass collar.
    legs = [
        brace(g, "z", (CX - 8, 1.2), (CX - 1, 6), 2.5, CZ - 1, CZ + 1, "darkwood", 4),
        brace(g, "z", (CX + 8, 1.2), (CX + 1, 6), 2.5, CZ - 1, CZ + 1, "darkwood", 4),
        brace(g, "x", (1.2, CZ + 5.5), (6, CZ + 0.5), 2.5, CX - 1, CX + 1, "darkwood", 4),
    ]
    for leg in legs:
        P.planks(g, leg, "darkwood", 4, width=3, across="y", nails=False, seed=2)
        P.flat(g, leg & (Y < 2), "wood", 6)
    # Broad end-grain pads keep the three feet grounded and readable.
    for x0, z0 in ((3, 4), (19, 4), (11, 10)):
        foot = box(g, x0, 0, z0, x0 + 3, 2, z0 + 3, "wood", 5)
        P.planks(g, foot, "wood", 5, width=2, across="x", seed=x0)
        P.flat(g, edges(foot), "darkwood", 3)

    # The octagonal oak post has two broad brass collars and a turned cap.
    stem = disc(g, "y", CX, CZ, 1.7, 2, ARM_Y, "darkwood", 5, n=8)
    P.planks(g, stem, "darkwood", 5, width=2, across="x", nails=False, seed=3)
    for by in (6, 13):
        band = disc(g, "y", CX, CZ, 2.7, by, by + 2, "gold", 5, n=8)
        P.flat(g, edges(band), "gold", 3)
        P.flat(g, band & (Y > by + 1), "gold", 7)
        P.flat(g, band & (np.abs(X - CX) < 0.6) & (Y > by), "darkwood", 3)
    cap = disc(g, "y", CX, CZ, 2.5, ARM_Y - 2, ARM_Y, "gold", 5, n=8)
    P.flat(g, edges(cap), "gold", 3)
    P.flat(g, cap & (Y > ARM_Y - 1), "gold", 7)

    # Dark oak arms form a clear frame. Brass bands mark each candle joint.
    bar = box(g, CX - 6, ARM_Y, CZ - 1, CX + 6, ARM_Y + 2, CZ + 1, "darkwood", 4)
    P.planks(g, bar, "darkwood", 4, width=3, across="x", nails=False, seed=5)
    P.flat(g, edges(bar), "wood", 5)
    branches = [
        brace(g, "z", (CX - 5, ARM_Y + 1), (CX - 9, ARM_Y + 6), 2.5, CZ - 1, CZ + 1, "darkwood", 4),
        brace(g, "z", (CX + 5, ARM_Y + 1), (CX + 9, ARM_Y + 6), 2.5, CZ - 1, CZ + 1, "darkwood", 4),
    ]
    for branch in branches:
        P.planks(g, branch, "darkwood", 4, width=2, across="y", nails=False, seed=6)
        P.flat(g, edges(branch), "wood", 5)

    candles = [(CX, ARM_Y + 2, 7, 0.2),
               (CX - 5, ARM_Y + 2, 4, -0.2),
               (CX + 5, ARM_Y + 2, 5, 0.25),
               (CX - 9, ARM_Y + 6, 3, -0.25),
               (CX + 9, ARM_Y + 6, 3, 0.2)]
    for cx, cy, h, lean in candles:
        cup(g, cx, cy, CZ)
        candle(g, cx, cy + 2, CZ, h, lean)

    # A small blue enamel mark breaks the long wood grain.
    mark = stem & (np.abs(X - CX) < 1.1) & (np.floor(Z) == CZ - 2) & (Y > 17) & (Y < 19)
    P.flat(g, mark, "sky", 6)
    root = Part("candelabra", g)
    return Asset(id="fantasy-props-candelabra", pack="fantasy", category="props", name="Candelabra", root=root)
