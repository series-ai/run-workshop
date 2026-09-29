"""Tournament pavilion in the Pirate Nation style.

A round tent a person walks into: an octagonal body (a frustum, true
slopes) in red and cream panels under a steep paneled cone roof, with a
scalloped valance at the eave. The door on the front is an open dark
doorway with a blue rug, framed by two tied-back flaps (true slopes) and
crowned by a blue heraldic shield. A centre pole rises through the roof
to a gold finial and a red pennant; four guy ropes run to stakes. Detail
is paint (rule S1). About 44 wide (58 with the ropes) and 68 tall; the
door is 27 tall, so a person walks in.
"""

import math

import numpy as np

import paint as P
from _props import coords, heater, idx
from pnkit import box, pennant
from pnshapes import bar, facets, flat_ngon, last
from voxgrid import C, Asset, Grid, Part

W, H, D = 64, 72, 64
CX = CZ = 32
R0, R1 = 18.0, 17.0  # body flat radius at the foot and at the eave
EAVE = 30
PEAK = 56
DOOR = 27  # door height (a person is 36; PN doors are 24-36)


def stripes(g: Grid, m: np.ndarray, n: int = 16, a=("red", 5), b=("bone", 6)) -> None:
    X, Y, Z = coords(g)
    ang = np.arctan2(Z - CZ, X - CX) + math.pi / n
    k = np.floor((ang + math.pi) / (2 * math.pi) * n).astype(int) % 2
    P.flat(g, m & (k == 0), *a)
    P.flat(g, m & (k == 1), *b)


def panels(g: Grid, solid, a=("red", 5), b=("bone", 6)) -> None:
    """Alternate whole facets of an octagon red and cream: panel edges are
    the facet seams, so they stay straight on the cone (no stairs)."""
    X, Y, Z = coords(g)
    for fm, fr in facets(g, [solid]):
        if fr == "top":
            continue
        cx, cz = X[fm].mean() - CX, Z[fm].mean() - CZ
        k = int(round((math.atan2(cz, cx) + math.pi) / (math.pi / 4))) % 2
        P.flat(g, fm, *(a if k == 0 else b))


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = idx(g)
    # the body: an octagon frustum with painted panels
    g.prism("y", flat_ngon(CX, CZ, R0, 8), 0, EAVE, C("red", 5), top=flat_ngon(CX, CZ, R1, 8))
    body = last(g)
    panels(g, g.solids[-1])
    P.flat(g, body & (Y < 1), "red", 3)
    # the cone roof
    g.prism("y", flat_ngon(CX, CZ, R1 + 4, 8), EAVE, PEAK, C("red", 5), top=[(CX, CZ)] * 8)
    roof = last(g)
    panels(g, g.solids[-1], a=("bone", 6), b=("red", 5))
    P.flat(g, roof & (Y < EAVE + 1), "gold", 5)
    # the valance: a ring under the eave with scalloped points
    g.prism("y", flat_ngon(CX, CZ, R1 + 3.5, 8), EAVE - 4, EAVE, C("bone", 6), top=flat_ngon(CX, CZ, R1 + 3.9, 8))
    val = last(g)
    stripes(g, val, n=32, a=("gold", 5), b=("red", 4))
    ang = np.arctan2(Z - CZ, X - CX)
    tip = (np.abs(((ang + math.pi) / (2 * math.pi) * 32) % 1 - 0.5) * 2) * 3  # 0 at a scallop centre, 3 at its edge
    g.carve(val & (Y - (EAVE - 4) < tip - 0.2))
    # the door: a dark opening painted on the front facet, a rug, two tied-back flaps
    front = body & (Z < CZ - R0 + 1.5)
    door = front & (np.abs(X - CX) < 6.0) & (Y < DOOR - np.abs(X - CX) * 0.6)
    P.flat(g, door, "red", 1)
    P.flat(g, door & (Y < 2), "blue", 3)
    rug = box(g, CX - 6, 0, CZ - R0 - 8, CX + 6, 1, CZ - R0 + 0.5, "blue", 4)
    P.outline(g, rug, "gold", 5, normal="y")
    for s in (-1, 1):
        x0 = CX + s * 6
        g.prism("z", [(x0, 0), (x0 + s * 5, 0), (x0 + s * 1.2, DOOR), (x0, DOOR)], CZ - R0 - 1.5, CZ - R0 + 0.5, C("bone", 6))
        flap = last(g)
        P.flat(g, flap & (np.abs(Y - 12) < 1.0), "gold", 5)  # the tie
        P.outline(g, flap, "red", 4, normal="z")
    # a heraldic shield over the door
    heater(g, CX, DOOR - 1, CZ - R0 - 3.5, 8, 10, t=2, field=("blue", 4), rim=("gold", 5), charge="crown", ink=("gold", 6))
    # the centre pole, finial and pennant
    box(g, CX - 1, PEAK - 2, CZ - 1, CX + 1, PEAK + 5, CZ + 1, "darkwood", 4)
    box(g, CX - 1.5, PEAK + 5, CZ - 1.5, CX + 1.5, PEAK + 7, CZ + 1.5, "gold", 6)
    pennant(g, CX - 1, PEAK + 7, CZ - 1, 5, 11, "red")
    # guy ropes to stakes (true diagonals) on the four diagonals
    for dx, dz in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        ex, ez = CX + dx * (R1 + 2) * 0.72, CZ + dz * (R1 + 2) * 0.72
        sx, sz = CX + dx * 29, CZ + dz * 29
        # a taut rope from the eave down to a stake (a true slope in the x-y plane)
        bar(g, "z", (ex, EAVE - 2), (sx, 2.5), 1.0, ez - 0.5 + (sz - ez) * 0.5, ez + 0.5 + (sz - ez) * 0.5, "bone", 5)
        box(g, sx - 1, 0, ez + (sz - ez) * 0.5 - 1, sx + 1, 4, ez + (sz - ez) * 0.5 + 1, "darkwood", 4)
    root = Part("knight-tent", g)
    return Asset(id="fantasy-props-knight-tent", pack="fantasy", category="props", name="Tournament Pavilion", root=root)
