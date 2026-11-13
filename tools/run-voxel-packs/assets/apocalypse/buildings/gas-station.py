"""Abandoned gas station, in the Pirate Nation style.

A caricature roadside stop. A teal plank kiosk on a steel skirt, framed by
thick dark posts, under a tall, steep corrugated-rust gable with a giant GAS
board and a leaning stovepipe. A sagging canopy (a true slope) runs off the
kiosk; its broken corner rests on a stack of oil drums. The function prop is
oversized (rules F4, K1): a giant red fuel pump with a glowing GAS globe
leans in front. A price sign hangs from one chain and swings on `idle`.
Detail (planks, plates, ribs, hazard stripes, concrete) is paint.
"""
import numpy as np

import paint as P
from _kit import text
from _pn import bar, concrete, coords, corrugate, disc, drum, hazard, last, radial, tyre
from pnkit import awning, beam, box, crate, door, gable_roof, pennant, posts, window
from voxgrid import C, Asset, Clip, Grid, Part, bounds_pivot

W, H, D = 132, 112, 104
X0, X1, Z0, Z1 = 72, 116, 34, 92  # kiosk walls; the front is z = Z0
GROUND, WALL_TOP, RIDGE = 3, 46, 84
# canopy deck: a slab that sags from the kiosk wall (x = X0) to its broken end (x = CX0)
CX0, CZ0, CZ1 = 4, 22, 88
DECK_HI, DECK_LO, DECK_T = 58, 44, 6


def deck_under(x: float) -> float:
    return DECK_LO + (x - CX0) / (X0 - CX0) * (DECK_HI - DECK_LO)


def station() -> Grid:
    g = Grid(W, H, D)
    X, Y, Z = coords(g)
    # ---- forecourt: a dusty concrete slab with painted bays and oil stains
    slab = box(g, 0, 0, 0, W, GROUND, D, "sand", 5)
    concrete(g, slab, "sand", 5, size=16, cracks=10, seed=1)
    P.outline(g, slab, "sand", 3, normal="y")
    lane = slab & (Y == GROUND - 1) & (Z >= CZ0) & (Z < CZ1) & (X < X0) & (((X - 28) % 22) < 2) & (Z > CZ0 + 6) & (Z < CZ1 - 6)
    P.flat(g, lane, "gold", 6)
    for sx, sz, r in ((44, 60, 6), (30, 12, 4), (60, 74, 5)):
        P.flat(g, slab & (Y == GROUND - 1) & (np.hypot(X - sx, (Z - sz) * 1.3) < r), "sand", 3)

    # ---- kiosk: steel skirt, teal planks, dark frame, eave beam
    walls = box(g, X0, GROUND, Z0, X1, WALL_TOP - 2, Z1, "teal", 6)
    skirt = walls & (Y < GROUND + 11)
    P.planks(g, walls & ~skirt, "teal", 6, width=4, across="y", seed=2)
    P.plates(g, skirt, "steel", 5, size=(10, 6), seed=3)
    P.grime(g, skirt, height=3, seed=4)
    posts(g, X0, X1, Z0, Z1, GROUND, WALL_TOP - 2, size=4, ramp="darkwood", base=4, seed=5)
    beam(g, X0 - 2, WALL_TOP - 3, Z0 - 2, X1 + 2, WALL_TOP + 1, Z1 + 2, base=4, seed=6)
    roof = gable_roof(g, X0 - 2, X1 + 2, Z0 - 2, Z1 + 2, WALL_TOP + 1, RIDGE, ramp="rust", thick=4, overhang=5, trim="darkwood", gable="wood", ridge="z", seed=7)
    ribs = roof["slabs"] & (g.a != C("darkwood", 3))
    corrugate(g, ribs, "rust", 4, along="z", seed=8)
    for px, pz in ((80, 60), (103, 44)):  # two patch sheets of bare steel
        P.plates(g, ribs & (np.abs(X - px) < 6) & (np.abs(Z - pz) < 7), "steel", 5, size=(12, 14), seed=px)
    P.planks(g, roof["attic"], "wood", 5, width=3, across="y", seed=9)
    # a giant SHOP board on the front gable (rule F4)
    xm = (X0 + X1) // 2
    board = box(g, xm - 18, 52, Z0 - 5, xm + 18, 68, Z0 - 2, "bone", 6)
    P.mottle(g, board, "bone", 6, seed=10)
    P.outline(g, board, "red", 3, normal="z")
    text(g, "-z", "SHOP", xm, 55, C("red", 4), scale=2, gap=2)
    # front: a wide short door, a boarded window; the side: a lit window
    door(g, "-z", Z0, 96, 112, GROUND, GROUND + 27, leaf="wood", seed=11)
    box(g, 92, 0, Z0 - 6, 116, GROUND + 1, Z0, "steel", 4)  # step plate
    window(g, "-z", Z0, 77, 91, 18, 34, glass="teal", glow=6)
    for (u0, v0), (u1, v1) in (((75, 20), (93, 33)), ((75, 31), (93, 21))):
        b = bar(g, "z", (u0, v0), (u1, v1), 3, Z0 - 3, Z0 - 1, "wood", 5)
        P.planks(g, b, "wood", 5, width=3, across="y", nails=True, seed=u0 + v0)
    awning(g, "-z", Z0 - 1, 74, 115, 40, depth=9, drop=6, ramps=("red", "bone"))
    window(g, "+x", X1, 46, 60, 18, 34, glass="gold", glow=6)
    window(g, "+x", X1, 70, 84, 18, 34, glass="teal", glow=5)
    b = bar(g, "x", (21, 68), (32, 86), 3, X1 + 1, X1 + 3, "wood", 5)  # (y, z) plane
    P.planks(g, b, "wood", 5, width=3, across="z", seed=12)
    # a pennant on the front of the ridge
    pennant(g, xm - 1, RIDGE - 2, Z0 - 10, 26, 20, "toxic")

    # ---- canopy: a sagging slab (true slope) on a post and a drum stack
    g.prism("z", [(CX0, DECK_LO), (X0, DECK_HI), (X0, DECK_HI + DECK_T), (CX0, DECK_LO + DECK_T)], CZ0, CZ1, C("steel", 5))
    deck = last(g)
    corrugate(g, deck, "steel", 5, along="z", seed=13)
    rim = deck & ((Z < CZ0 + 2) | (Z >= CZ1 - 2) | (X < CX0 + 2))
    hazard(g, rim, period=8, a=("gold", 5), b=("darkwood", 4))
    # rust blooms eating the canopy sheet (paint)
    for rx, rz, rr in ((20, 60, 7), (44, 40, 5), (58, 74, 4)):
        P.flat(g, deck & ~rim & (np.hypot(X - rx, Z - rz) < rr), "rust", 4)
        P.flat(g, deck & ~rim & (np.hypot(X - rx, Z - rz) < rr * 0.5), "rust", 3)
    for (px, pz) in ((6, CZ0 + 1), (36, CZ0 + 3)):
        top = int(deck_under(px)) + 1
        p = box(g, px, GROUND, pz, px + 5, top, pz + 5, "steel", 5)
        P.plates(g, p, "steel", 5, size=(5, 8), seed=px)
        hazard(g, p & (Y < GROUND + 9), period=6)
    # the broken back corner is propped up on two drums and a crate
    drum(g, 14, CZ1 - 12, GROUND, 19, 8.5, ramp="red", seed=21)
    drum(g, 15, CZ1 - 13, GROUND + 19, 19, 8.5, ramp="teal", base=5, band=("bone", 6), label=None, seed=22)
    crate(g, 9, GROUND + 38, CZ1 - 18, int(deck_under(9)) - GROUND - 37, seed=23)

    # ---- small props at the base: tyre stack, a crate, a loose drum
    for k, (tx, tz) in enumerate(((122, 22), (121, 23), (123, 21))):
        tyre(g, "y", tx, tz, 8, GROUND + 4 * k, GROUND + 4 * k + 4, hub="gray", hub_base=5, seed=k)
    crate(g, 60, GROUND, 6, 12, seed=24)
    crate(g, 62, GROUND + 12, 8, 9, seed=26)
    for k, jx in enumerate((104, 111)):  # jerry cans by the door
        can = box(g, jx, GROUND, 12 + 2 * k, jx + 6, GROUND + 11, 12 + 2 * k + 9, ("red", "khaki")[k], 4)
        P.outline(g, can, ("red", "khaki")[k], 3, normal="x")
        box(g, jx + 1, GROUND + 11, 14 + 2 * k, jx + 5, GROUND + 13, 16 + 2 * k, "steel", 5)
    drum(g, 122, 52, GROUND, 19, 8.5, ramp="gold", base=4, band=("red", 4), label=None, seed=25)
    return g


def stovepipe() -> Grid:
    g = Grid(14, 34, 14)
    pipe = disc(g, "y", 7, 7, 4, 0, 28, "steel", 5)
    Y = coords(g)[1]
    P.flat(g, pipe & ((Y % 8) < 1), "steel", 3)
    P.flat(g, pipe & ((Y % 8) >= 5) & ((Y % 8) < 7) & (radial(g, "y", 7, 7) > 2), "rust", 5)
    cap = disc(g, "y", 7, 7, 6.5, 28, 31, "rust", 4)
    P.flat(g, cap & (Y == 28), "rust", 3)
    disc(g, "y", 7, 7, 3, 31, 34, "rust", 5)
    return g


def pump() -> Grid:
    """The giant fuel pump: the gas station's function prop, oversized so
    it reads in a thumbnail (rules F4, F6). Faces -z."""
    g = Grid(46, 92, 24)
    X, Y, Z = coords(g)
    base = box(g, 0, 0, 0, 36, 4, 24, "stone", 5)
    P.stone(g, base, "stone", 5, block=(8, 4), seed=30)
    hazard(g, base & (Y >= 2), period=6)
    g.prism("z", [(4, 4), (32, 4), (32, 54), (27, 61), (9, 61), (4, 54)], 4, 20, C("red", 4))
    body = last(g)
    P.mottle(g, body, "red", 4, seed=31)
    P.outline(g, body, "red", 2, normal="z")
    P.flat(g, body & (Y >= 50) & (Y < 53), "bone", 6)  # the white waist band of an old pump
    front = body & (Z == 4)
    P.flat(g, front & (Y >= 6) & (Y < 18) & (X >= 8) & (X < 28), "red", 3)  # service door
    P.outline(g, front & (Y >= 6) & (Y < 18) & (X >= 8) & (X < 28), "red", 2, normal="z")
    # display window (glowing teal digits) and a big dial with the needle on E
    disp = box(g, 9, 21, 3, 27, 30, 4, "teal", 6)
    P.outline(g, disp, "darkwood", 4, normal="z")
    text(g, "-z", "000", 18, 23, C("gold", 7), scale=1, gap=1)
    dial = disc(g, "z", 18, 42, 9.5, 1, 4, "bone", 6, n=12)
    d = radial(g, "z", 18, 42)
    P.flat(g, dial & (d > 7.5), "red", 3)
    ang = np.arctan2(Y + 0.5 - 42, X + 0.5 - 18)
    ticks = dial & (d > 5.5) & (d <= 7.5) & ((np.floor((ang + np.pi) / (2 * np.pi) * 12).astype(int) % 2) == 0) & (Y + 0.5 > 40)
    P.flat(g, ticks, "darkwood", 4)
    needle = dial & (np.abs((X + 0.5 - 18) * 0.6 + (Y + 0.5 - 42) * 0.8) < 0.8) & (X + 0.5 > 18)
    P.flat(g, needle, "red", 4)
    P.flat(g, dial & (d < 1.6), "darkwood", 4)
    # neck and glowing globe
    neck = box(g, 13, 61, 8, 23, 66, 16, "steel", 5)
    P.plates(g, neck, "steel", 5, size=(10, 5), seed=32)
    globe = disc(g, "z", 18, 78, 13, 7, 17, "gold", 6, n=10)
    d = radial(g, "z", 18, 78)
    P.flat(g, globe & (d > 10.5), "red", 4)
    P.flat(g, globe & (d > 10.5) & (Y + 0.5 > 78 + 9), "red", 5)
    text(g, "-z", "GAS", 18, 74, C("red", 4), scale=2, gap=1)
    # holster, nozzle and a thick hose curling to the ground on the +x side
    holster = box(g, 32, 34, 9, 36, 44, 15, "steel", 4)
    nozzle = box(g, 33, 38, 10, 40, 42, 14, "gold", 5)
    bar(g, "z", (38.5, 41), (42, 45), 2.5, 10.5, 13.5, "steel", 6)  # spout
    for p0, p1 in (((34, 34), (40, 20)), ((40, 20), (37, 8)), ((37, 8), (30, 5))):
        bar(g, "z", p0, p1, 3.5, 10, 14, "darkwood", 5)
    return g


def price_sign() -> Grid:
    g = Grid(22, 26, 4)
    board = box(g, 0, 0, 0, 22, 14, 3, "gold", 5)
    P.outline(g, board, "darkwood", 4, normal="z")
    text(g, "-z", "4 99", 11, 5, C("darkwood", 4), scale=1, gap=1)
    for cx in (4, 17):  # the chains: the right one has snapped
        box(g, cx, 14, 1, cx + 1, 26 if cx == 4 else 18, 2, "steel", 4)
    return g


def build() -> Asset:
    g = station()
    pivot = bounds_pivot(g)
    root = Part("gas-station", g, pivot=pivot)
    xm = (X0 + X1) // 2
    # stovepipe foot on the +x roof slope, leaning out
    sx, sz = X1 - 8, Z1 - 16
    sy = RIDGE - (sx - xm) * (RIDGE - WALL_TOP) / ((X1 - X0) / 2 + 7) - 2
    root.add(Part("stovepipe", stovepipe(), pivot=(7.0, 0.0, 7.0), at=(sx - pivot[0], sy, sz - pivot[2]), rot=(4.0, 0.0, -9.0)))
    root.add(Part("pump", pump(), pivot=(18.0, 0.0, 12.0), at=(22 - pivot[0], GROUND, 12 - pivot[2]), rot=(0.0, 0.0, 5.0)))
    hx = 58  # the sign hangs from the canopy's front edge by one chain
    sign = root.add(Part("price-sign", price_sign(), pivot=(4.5, 26.0, 1.5), at=(hx - pivot[0], deck_under(hx), CZ0 + 2 - pivot[2]), rot=(0.0, 0.0, -14.0)))
    swing = {sign.name: {"rot": [(t, (0.0, 0.0, 6 * float(np.sin(t / 2.0 * 2 * np.pi)))) for t in (0, 0.5, 1.0, 1.5, 2.0)]}}
    return Asset(
        id="apocalypse-buildings-gas-station", pack="apocalypse", category="buildings", name="Abandoned Gas Station", root=root,
        clips=[Clip("idle", swing)],
    )
