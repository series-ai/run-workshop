"""Royal coffer in the Pirate Nation style.

An open treasure chest on gold claw feet: a planked body bound with gold
straps, and a slim barrel lid thrown back on its hinges. The lid is built
flat in its own part and leaned with `Part.rot` (README), so its outside
carries clean plank seams, three gold straps and a dark frame instead of
tilted blotches, and its inside shows royal-blue velvet. The hoard is
sorted by shape and value so it reads at thumbnail size (rule F6): a low
coin heap, two cream coin bags, three cut gems and one oversized crown,
all clear of the gold lock plate. The treasure-glint effect plays at
socket-glint. About 28 wide and 33 tall.
"""

import numpy as np

import paint as P
from _props import coords, gem, plank_box
from pnkit import box, edges
from pnshapes import disc, last
from voxgrid import C, Asset, Grid, Part, Socket

W, H, D = 28, 36, 28
X0, X1 = 2, 26
ZF, ZB = 4, 20
BODY, RIM = 3, 15  # the body's bottom and its rim
LW, LD, LT = 26, 18, 4  # the lid's own grid: width, depth, thickness
LID_ANGLE = 105.0


def lid_grid() -> Grid:
    """The lid, built flat so its planks, straps and frame stay crisp."""
    g = Grid(LW, LT + 2, LD)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))
    # a slim barrel profile: flat inside, chamfered outside (true slopes)
    g.prism("x", [(0, 0), (0, LD), (LT - 1, LD), (LT + 1, LD - 3), (LT + 1, 3), (LT - 1, 0)],
            0, LW, C("wood", 5))
    lid = last(g)
    P.planks(g, lid, "wood", 5, width=4, across="y", frame="x", nails=True, seed=3)
    P.flat(g, lid & (Yi >= LT), "wood", 6)  # the lit crown of the barrel
    P.flat(g, lid & ((Zi < 1) | (Zi >= LD - 1)), "darkwood", 3)  # front and back framing
    P.flat(g, lid & ((Xi < 1) | (Xi >= LW - 1)), "darkwood", 3)  # the framed end caps
    for sx in (3, 12, 21):  # three gold straps over the lid
        P.flat(g, lid & (Xi >= sx) & (Xi < sx + 3), "gold", 5)
        P.flat(g, lid & (Xi == sx + 1), "gold", 6)
        P.flat(g, lid & (Xi >= sx) & (Xi < sx + 3) & ((Zi == 2) | (Zi == LD - 3)), "gold", 3)
    # the royal-blue velvet lining on the inside face
    inner = lid & (Yi == 0)
    P.flat(g, inner, "blue", 3)
    P.mottle(g, inner, "blue", 3, cell=3, seed=4)
    P.flat(g, inner & ((Zi < 2) | (Zi >= LD - 2) | (Xi < 2) | (Xi >= LW - 2)), "gold", 6)
    P.flat(g, inner & (Zi >= LD // 2 - 1) & (Zi <= LD // 2) & (Xi > 3) & (Xi < LW - 4), "blue", 5)
    return g


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # gold claw feet
    for fx in (X0 + 1, X1 - 4):
        for fz in (ZF + 1, ZB - 4):
            foot = box(g, fx, 0, fz, fx + 3, BODY + 1, fz + 3, "gold", 4)
            P.flat(g, foot & (Yi < 1), "gold", 6)
            P.flat(g, foot & (Yi > 1), "gold", 5)

    # the planked body with gold straps and a dark frame
    body = plank_box(g, X0, BODY, ZF, X1, RIM, ZB, "wood", 4, across="y", width=4, seed=1)
    for sx in (X0 + 3, 13, X1 - 6):
        P.flat(g, body & (Xi >= sx) & (Xi < sx + 2), "gold", 5)
        P.flat(g, body & (Xi == sx), "gold", 7)
    P.flat(g, body & ((Yi == BODY) | (Yi == RIM - 1)), "gold", 5)
    P.flat(g, body & (Yi > BODY + 1) & (Yi < RIM - 2) & ((Xi < X0 + 3) | (Xi >= X1 - 3))
           & ((Zi < ZF + 1) | (Zi >= ZB - 1)), "darkwood", 3)

    # the blue velvet lining of the chest itself
    hold = box(g, X0 + 2, BODY + 2, ZF + 2, X1 - 2, RIM, ZB - 2, "blue", 3)
    P.mottle(g, hold, "blue", 3, cell=3, seed=2)
    P.flat(g, hold & (Yi > RIM - 3), "gold", 6)

    # the hoard, sorted by shape: a low coin heap, two cream bags, gems, a crown
    heap = disc(g, "y", 14, 13, 8.2, RIM - 3, RIM + 1, "gold", 5, n=8)
    hdist = np.hypot(X - 14, Z - 13)
    P.flat(g, heap, "gold", 5)
    P.flat(g, heap & (Yi == RIM), "gold", 6)
    P.flat(g, heap & (hdist > 7.0), "gold", 3)  # a dark outline round the heap
    P.flat(g, heap & (Yi == RIM) & (((Xi + Zi) % 3) == 0), "gold", 7)  # coin glints
    for bx, bz, br in ((7, 9, 3.4), (21, 15, 3.0)):  # two tied coin bags, cream not gold
        bag = disc(g, "y", bx, bz, br, RIM + 1, RIM + 5, "sand", 6, n=8)
        bag |= disc(g, "y", bx, bz, br * 0.55, RIM + 5, RIM + 7, "sand", 6, n=6)
        P.flat(g, bag, "sand", 6)
        P.flat(g, bag & (Yi > RIM + 3) & (Yi < RIM + 5), "sand", 7)
        P.flat(g, bag & (Yi == RIM + 5), "darkwood", 4)  # the cord tie
        P.flat(g, bag & (Yi == RIM + 1), "sand", 4)
        P.flat(g, bag & (np.hypot(X - bx, Z - bz) > br - 0.9) & (Yi < RIM + 5), "sand", 5)
    # the crown: a gold band with four points and a royal-blue cap
    crown = disc(g, "y", 15, 11, 4.4, RIM + 1, RIM + 5, "gold", 6, n=8)
    cd = np.hypot(X - 15, Z - 11)
    P.flat(g, crown, "gold", 6)
    P.flat(g, crown & (cd < 3.0) & (Yi > RIM + 2), "blue", 3)
    P.flat(g, crown & (cd > 3.0) & (Yi == RIM + 3), "red", 5)  # the jewelled band
    P.flat(g, crown & (cd > 3.0) & (Yi == RIM + 1), "gold", 3)
    for px, pz in ((15, 6.8), (15, 15.2), (10.8, 11), (19.2, 11)):
        pk = box(g, px - 1, RIM + 5, pz - 1, px + 1, RIM + 9, pz + 1, "gold", 7)
        P.flat(g, pk, "gold", 6)
        P.flat(g, pk & (Yi > RIM + 7), "gold", 7)
        P.flat(g, pk & (Yi == RIM + 5), "gold", 3)
    gem(g, 8, RIM + 1, 16, r=1.8, h=3.0, ramp="red", shade=5)
    gem(g, 22, RIM + 1, 8, r=1.6, h=2.6, ramp="cyan", shade=5)
    gem(g, 18, RIM + 1, 17, r=1.5, h=2.4, ramp="magenta", shade=5)

    # the oversized lock plate on the front, kept clear of the hoard
    plate = box(g, 11, BODY + 3, ZF - 2, 17, RIM - 1, ZF + 1, "gold", 6)
    P.flat(g, plate, "gold", 6)
    P.flat(g, edges(plate), "gold", 3)
    P.flat(g, plate & (np.hypot(X - 14, Y - 9) < 1.4), "darkwood", 2)
    P.flat(g, plate & (np.abs(X - 14) < 0.7) & (Y > 9) & (Y < 11.5), "darkwood", 2)
    hasp = box(g, 12, RIM - 2, ZF - 3, 16, RIM + 1, ZF, "gold", 5)
    P.flat(g, hasp, "gold", 5)
    P.flat(g, edges(hasp), "gold", 3)

    root = Part("royal-coffer", g)
    root.add(Part("lid", lid_grid(), pivot=(0.0, 0.0, float(LD)),
                  at=(float(X0 - 1), float(RIM), float(ZB + 1)), rot=(LID_ANGLE, 0.0, 0.0)))
    return Asset(id="fantasy-props-royal-coffer", pack="fantasy", category="props", name="Royal Coffer", root=root,
                 sockets=[Socket("socket-glint", at=(15.0, RIM + 8.0, 12.0))],
                 pfx=[{"effectId": "rvx-fantasy-treasure-glint", "socket": "socket-glint", "trigger": "idle", "size": 14}])
