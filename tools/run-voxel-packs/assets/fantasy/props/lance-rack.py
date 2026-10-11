"""Tourney lance rack in the Pirate Nation style.

Three slim jousting lances (shafts 2-3 thick) stand in a heavy timber
rack in warm mid wood, painted in bold flame-red, royal-blue and cream bands (rules F4 and
C1). Each shaft tapers from a leather grip through a wide steel vamplate cone to a
steel coronel modelled on the shaft centre line, so tip and shaft are one
piece. The lances fan out at the top (rule F5); a royal-blue pennant flies
from the middle one. A great helm and a quartered shield stand on the deck
in their own plane, clear of the lances and the frame. About 32 wide and
45 tall.
"""

import numpy as np

import paint as P
from _props import coords, heater, plank_box, stone_box
from pnkit import box, edges
from pnshapes import cone, disc, last, quad
from voxgrid import C, Asset, Grid, Part

W, H, D = 32, 48, 18
BASE = 6  # the deck the lances stand on
TOPY = 41  # where the shafts end and the coronels begin
ZL0, ZL1 = 8, 11  # the lance plane (3 thick), against the frame
ZF0, ZF1 = 11, 17  # the frame plane
LANCES = ((11, 7, "red"), (16, 16, "blue"), (21, 25, "red"))


def lance(g: Grid, xb: float, xt: float, band: str, seed: int) -> None:
    """One lance: a tapered shaft in bold bands, a leather grip, a steel
    vamplate and a coronel built on the shaft's own centre line."""
    X, Y, Z = coords(g)
    Yi = np.floor(Y).astype(int)
    cz = (ZL0 + ZL1) / 2

    def cx(y):  # the shaft centre at height y
        return xb + (xt - xb) * (y - BASE) / (TOPY - BASE)

    g.prism("z", quad((xb, BASE), (xt, TOPY), 1.5, 1.0), ZL0, ZL1, C("bone", 7))
    shaft = last(g)
    P.flat(g, shaft, "bone", 7)
    P.flat(g, shaft & ((((Yi - BASE) // 5) % 2) == 1), band, 5)
    P.flat(g, shaft & (Z < ZL0 + 1) & ((((Yi - BASE) // 5) % 2) == 1), band, 6)
    P.flat(g, shaft & (Z > ZL1 - 1) & ((((Yi - BASE) // 5) % 2) == 0), "bone", 6)  # the shaded far side
    P.flat(g, shaft & (Yi == BASE), "darkwood", 3)  # only the butt is framed
    # a leather grip and an iron ferrule just above the butt
    P.flat(g, shaft & (Yi > BASE) & (Yi < BASE + 7), "darkwood", 4)
    P.flat(g, shaft & (Yi > BASE + 1) & (Yi < BASE + 6) & ((Yi % 2) == 0), "darkwood", 5)
    P.flat(g, shaft & (Yi >= BASE + 7) & (Yi < BASE + 9), "steel", 4)
    # the steel vamplate: a flared guard the hand sits behind
    vy = BASE + 9
    vam = cone(g, "y", cx(vy + 2), cz, 3.4, vy, vy + 6, "steel", 4, n=8, r_top=1.1)
    P.flat(g, vam, "steel", 4)
    P.flat(g, vam & (Yi > vy + 3), "steel", 6)
    P.flat(g, vam & (Yi < vy + 1), "steel", 2)
    P.flat(g, vam & (Z < cz - 1.5), "steel", 5)
    # the coronel, seated on the shaft top
    tip = cone(g, "y", float(xt), cz, 1.6, TOPY - 1, TOPY + 4, "steel", 5, n=6, r_top=0.6)
    P.flat(g, tip, "steel", 5)
    P.flat(g, tip & (Y > TOPY + 2), "steel", 7)
    P.flat(g, tip & (Y < TOPY + 1), "steel", 3)


def build() -> Asset:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    Xi, Yi, Zi = (np.floor(a).astype(int) for a in (X, Y, Z))

    # a grey-blue stone plinth with a planked deck
    plinth = stone_box(g, 0, 0, 0, W, 4, D, "stone", 3, block=(6, 3), rim=-2, seed=1)
    P.flat(g, plinth & (Yi == 3), "stone", 4)
    plank_box(g, 1, 4, 1, W - 1, BASE, D - 1, "wood", 5, across="y", width=4, seed=2)

    # two uprights with chamfered caps and one cross rail behind the lances
    for px in (0, 27):
        post = box(g, px, BASE, ZF0, px + 5, 34, ZF1, "wood", 5)
        P.planks(g, post, "wood", 5, width=3, across="x", nails=False, seed=px)
        P.flat(g, edges(post), "darkwood", 3)
        P.flat(g, post & (Zi == ZF0) & ((Xi == px) | (Xi == px + 4)), "darkwood", 3)
        g.prism("z", [(px, 34), (px + 5, 34), (px + 2.5, 38)], ZF0, ZF1, C("wood", 4))
        cap = last(g)
        P.flat(g, cap, "wood", 4)
        P.outline(g, cap, "darkwood", 3, normal="z")
    rail = box(g, 0, 26, ZF0, W, 29, ZF1, "wood", 6)
    P.planks(g, rail, "wood", 6, width=2, across="y", frame="wall", nails=True, seed=5)
    P.flat(g, edges(rail), "darkwood", 3)
    for px in (1, 28):  # iron straps where the rail crosses an upright
        P.flat(g, (g.a > 0) & (Xi >= px) & (Xi < px + 3) & (Yi >= 25) & (Yi < 30)
               & (Zi >= ZF0 - 1) & (Zi < ZF1 + 1), "iron", 4)

    for k, (xb, xt, band) in enumerate(LANCES):
        lance(g, xb, xt, band, k)

    # a royal-blue pennant knotted on the middle lance
    g.prism("z", [(16.5, 31), (26, 32), (22, 35), (26, 38), (16.5, 37)], ZL0, ZL0 + 1, C("blue", 4))
    flag = last(g)
    P.flat(g, flag & ((Xi // 3) % 2 == 1), "blue", 3)
    P.flat(g, flag & (Yi > 35), "blue", 5)
    P.outline(g, flag, "gold", 6, normal="z")

    # a great helm and a quartered shield on the deck, in front of the lances
    helm = box(g, 1, BASE, 1, 8, BASE + 7, 7, "steel", 4)
    P.plates(g, helm, "steel", 4, size=(5, 4), rivets=True, frame="wall", seed=7)
    P.flat(g, helm & (Yi > BASE + 5), "steel", 6)
    P.flat(g, helm & (Yi == BASE + 4) & (Zi < 3), "steel", 1)  # the eye slit
    P.flat(g, helm & (Yi == BASE + 2) & (Zi < 3) & ((Xi % 2) == 0), "steel", 2)  # breaths
    P.flat(g, edges(helm), "steel", 2)
    g.prism("z", [(2, BASE + 7), (7, BASE + 7), (6, BASE + 12), (3, BASE + 12)], 2, 6, C("red", 5))
    crest = last(g)
    P.flat(g, crest, "red", 5)
    P.flat(g, crest & (((Xi + Yi) % 3) == 0), "red", 6)
    P.outline(g, crest, "gold", 6, normal="z")
    heater(g, 25, BASE, 1, w=11, h=17, t=2, field=("blue", 4), rim=("gold", 5), lean=9.0,
           quarter=("bone", 7), charge="lion", ink=("gold", 6))

    root = Part("lance-rack", g)
    return Asset(id="fantasy-props-lance-rack", pack="fantasy", category="props", name="Lance Rack", root=root)
