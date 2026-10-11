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
from pnshapes import facets, flat_ngon, last, seams
from voxgrid import C, Asset, Grid, Part

W, H, D = 64, 72, 64
CX = CZ = 32
R0, R1 = 18.0, 17.0  # body flat radius at the foot and at the eave
EAVE = 30
PEAK = 56
DOOR = 27  # door height (a person is 36; PN doors are 24-36)


def panels(g: Grid, solid, a=("red", 5), b=("bone", 6), sector=math.pi / 4) -> None:
    """Alternate whole facets of an octagon red and cream: panel edges are
    the facet seams, so they stay straight on the cone (no stairs)."""
    X, Y, Z = coords(g)
    for fm, fr in facets(g, [solid]):
        if fr == "top":
            continue
        cx, cz = X[fm].mean() - CX, Z[fm].mean() - CZ
        k = int(round((math.atan2(cz, cx) + math.pi) / sector)) % 2
        P.flat(g, fm, *(a if k == 0 else b))


def guy_rope(g: Grid, x0, y0, z0, x1, y1, z1, thick=2.4) -> None:
    """Add one true sloped, square rope prism from an eave tie to a stake."""
    half = thick / 2
    low = [(x1 - half, z1 - half), (x1 + half, z1 - half),
           (x1 + half, z1 + half), (x1 - half, z1 + half)]
    high = [(x0 - half, z0 - half), (x0 + half, z0 - half),
            (x0 + half, z0 + half), (x0 - half, z0 + half)]
    g.prism("y", low, y1, y0, C("bone", 4), top=high)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = idx(g)
    # the body: an octagon frustum with painted panels
    g.prism("y", flat_ngon(CX, CZ, R0, 8), 0, EAVE, C("red", 5), top=flat_ngon(CX, CZ, R1, 8))
    body = last(g)
    panels(g, g.solids[-1])
    # Dark hems and corner seams frame each canvas panel.
    P.flat(g, body & (Y < 2), "red", 2)
    P.flat(g, seams(g, [g.solids[-1]], width=1.2), "red", 2)
    P.flat(g, body & (Y > EAVE - 2), "gold", 4)
    # the cone roof
    g.prism("y", flat_ngon(CX, CZ, R1 + 4, 8), EAVE, PEAK, C("red", 5), top=[(CX, CZ)] * 8)
    roof = last(g)
    panels(g, g.solids[-1], a=("bone", 6), b=("red", 5))
    # Keep the roof panel edges clean. The facet colours define the seams;
    # a second dark line here makes each low-resolution edge look ragged.
    P.flat(g, roof & (Y < EAVE + 1), "red", 3)
    # the valance: a ring under the eave with scalloped points
    g.prism("y", flat_ngon(CX, CZ, R1 + 3.5, 8), EAVE - 4, EAVE, C("bone", 6), top=flat_ngon(CX, CZ, R1 + 3.9, 8))
    val = last(g)
    for i, (fm, _fr) in enumerate(facets(g, [g.solids[-1]])):
        P.flat(g, fm, *(('gold', 5) if i % 2 == 0 else ('red', 4)))
    P.flat(g, val & (Y >= EAVE - 1), "gold", 6)
    P.flat(g, val & (Y <= EAVE - 3), "red", 3)
    # Repeat a large scallop rhythm around the eave without fine speckles.
    ang = np.arctan2(Z - CZ, X - CX)
    scallop = (np.abs(((ang + math.pi) / (2 * math.pi) * 16) % 1 - 0.5) < 0.18)
    g.carve(val & (Y == EAVE - 4) & scallop)
    # the door: a dark opening painted on the front facet, a rug, two tied-back flaps
    front = body & (Z < CZ - R0 + 1.5)
    door = front & (np.abs(X - CX) < 6.0) & (Y < DOOR - np.abs(X - CX) * 0.6)
    P.flat(g, door, "red", 1)
    P.flat(g, door & (Y < 2), "blue", 3)
    # Thick, framed timber jambs make the entrance read as an opening.
    for x in (CX - 7, CX + 5):
        jamb = box(g, x, 0, CZ - R0 - 2, x + 2, DOOR, CZ - R0 + 1, "darkwood", 4)
        P.planks(g, jamb, "darkwood", 4, width=2, across="x", nails=False)
        P.flat(g, jamb & (Y > DOOR - 2), "gold", 5)
    # A raised blue runner sits on a broad, visible stone step.
    step = box(g, CX - 9, 0, CZ - R0 - 10, CX + 9, 3, CZ - R0 + 2, "stone", 4)
    P.flat(g, step & (Y < 1), "stone", 3)
    P.outline(g, step, "gold", 5)
    rug = box(g, CX - 7, 3, CZ - R0 - 8, CX + 7, 4, CZ - R0 + 0.5, "blue", 4)
    P.outline(g, rug, "gold", 6, normal="y")
    P.flat(g, rug & (np.abs(X - CX) < 1) & (Z < CZ - R0 - 1), "cyan", 5)
    for s in (-1, 1):
        x0 = CX + s * 6
        g.prism("z", [(x0, 0), (x0 + s * 5, 0), (x0 + s * 1.2, DOOR), (x0, DOOR)], CZ - R0 - 1.5, CZ - R0 + 0.5, C("bone", 6))
        flap = last(g)
        P.flat(g, flap & (np.abs(Y - 12) < 1.0), "gold", 5)  # the tie
        P.outline(g, flap, "red", 4, normal="z")
    # a heraldic shield over the door
    heater(g, CX, DOOR - 3, CZ - R0 - 4, 12, 14, t=3, field=("blue", 4), rim=("gold", 5), charge="crown", ink=("gold", 7))
    # the centre pole, finial and pennant
    box(g, CX - 1, PEAK - 2, CZ - 1, CX + 1, PEAK + 5, CZ + 1, "darkwood", 4)
    box(g, CX - 1.5, PEAK + 5, CZ - 1.5, CX + 1.5, PEAK + 7, CZ + 1.5, "gold", 6)
    pennant(g, CX - 1, PEAK + 7, CZ - 1, 5, 11, "red")
    # Four broad guy ropes start at visible corner ties. Their radial slope
    # keeps each rope outside the walls and clear of the entrance.
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        x_anchor, z_anchor = CX + sx * 16, CZ + sz * 16
        x_stake, z_stake = CX + sx * 29, CZ + sz * 29
        tie = box(g, x_anchor - 1.5, EAVE - 2, z_anchor - 1.5,
                  x_anchor + 1.5, EAVE + 1, z_anchor + 1.5, "darkwood", 4)
        P.flat(g, tie & (Y == EAVE), "gold", 5)
        guy_rope(g, x_anchor, EAVE - 1, z_anchor, x_stake, 2.5, z_stake)
        box(g, x_stake - 1.5, 0, z_stake - 1.5,
            x_stake + 1.5, 4, z_stake + 1.5, "darkwood", 4)
    root = Part("knight-tent", g)
    return Asset(id="fantasy-props-knight-tent", pack="fantasy", category="props", name="Tournament Pavilion", root=root)
