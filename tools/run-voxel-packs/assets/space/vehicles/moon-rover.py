"""Moon rover, in the Pirate Nation mecha style.

Caricature proportions: four huge octagonal wheels (true facets) under
hazard-orange arched fenders, a chunky white hull with chamfered sides, a
tall cabin with a sloped glowing teal windshield, a light bar and a leaning
whip antenna. Its function prop is oversized: a big tilted comm dish on the
cargo bed that turns on `idle`; the wheels spin on `move`. Detail (plates,
tread, stripes, lights) is painted. Faces -Z. About 50 x 68 x 80.
"""
import math

import numpy as np

import paint as P
from _pn import coords, hazard, last, pipe, plated, prism_y
from pnkit import box, edges, ngon
from voxgrid import C, Asset, Clip, Grid, Part, turn

W, H, L = 50, 50, 80
R = 12 / math.cos(math.pi / 8)  # wheel corner radius: the flats sit 12 from the axle, 24 across
WHEEL_Z = (18, 62)
AXLE = 12
HULL0, HULL1 = 16, 28  # hull bottom and top


def chassis() -> Grid:
    g = Grid(W, H, L)
    X, Y, Z = coords(g)
    frame = box(g, 9, 6, 6, 41, HULL0, 74, "steel", 4)
    plated(g, frame, "steel", 4, size=(10, 5), seed=1)
    # hull: chamfered sides (true diagonals) in white hull plates
    g.prism("z", [(6, HULL0), (44, HULL0), (44, 23), (40, HULL1), (10, HULL1), (6, 23)], 3, 77, C("bone", 5))
    hull = last(g)
    P.plates(g, hull, "bone", 5, size=(12, 7), rivets=True, seed=2)
    P.flat(g, hull & (Y > 18) & (Y < 21), "orange", 5)  # side stripe
    P.flat(g, hull & (Y < HULL0 + 1), "bone", 3)
    # arched fenders over the wheels (true facets)
    for zc in WHEEL_Z:
        outer = [(AXLE + 16.5 * math.sin(a), zc + 16.5 * math.cos(a)) for a in np.linspace(0, math.pi, 7)]
        inner = [(AXLE + 13.5 * math.sin(a), zc + 13.5 * math.cos(a)) for a in np.linspace(math.pi, 0, 7)]
        for x0, x1 in ((0, 11), (39, 50)):
            g.prism("x", outer + inner, x0, x1, C("orange", 5))
            f = last(g)
            P.flat(g, f & ((X < 1) | (X > 49)), "orange", 4)
            P.flat(g, f & (np.hypot(Y - AXLE, Z - zc) > 15.5), "orange", 6)
    # front bumper with oversized headlights and hazard stripes
    bumper = box(g, 7, 6, 0, 43, 15, 4, "steel", 4)
    hazard(g, bumper & (Y < 9), period=4)
    for hx in (10, 32):
        lamp = box(g, hx, 9, 0, hx + 8, 16, 2, "gold", 7)
        P.flat(g, edges(lamp), "steel", 3)
    # rear bumper with tail lights
    rear = box(g, 7, 6, 76, 43, 15, 80, "steel", 4)
    hazard(g, rear & (Y < 9), period=4)
    for hx in (10, 34):
        P.flat(g, box(g, hx, 10, 78, hx + 6, 14, 80, "red", 5), "red", 5)
    cabin(g)
    bed(g)
    return g


def cabin(g: Grid) -> None:
    X, Y, Z = coords(g)
    y0, y1, zf0, zf1, zb = HULL1, 46, 12, 26, 50  # windshield slopes from zf0 (bottom) to zf1 (top)
    g.prism("x", [(y0, zf0), (y0, zb), (y1, zb), (y1, zf1)], 10, 40, C("bone", 6))
    cab = last(g)
    P.plates(g, cab, "bone", 6, size=(10, 9), rivets=False, seed=3)
    zfront = zf0 + (Y - y0) * (zf1 - zf0) / (y1 - y0)
    shield = cab & (Z < zfront + 2) & (Y > y0 + 3) & (Y < y1 - 2) & (X > 12) & (X < 38)
    P.flat(g, shield, "cyan", 6)
    P.flat(g, shield & (Y > y1 - 6), "cyan", 7)
    P.flat(g, shield & (np.abs(X - 25) < 1), "bone", 4)  # centre pillar
    P.flat(g, cab & (Z < zfront + 2) & ~shield, "bone", 4)  # windshield frame
    # side windows on both caps
    side = cab & ((X < 11) | (X > 39)) & (Y > y0 + 5) & (Y < y1 - 3) & (Z > 30) & (Z < 46)
    P.flat(g, side, "cyan", 6)
    P.flat(g, side & (np.abs(Z - 38) < 0.6), "bone", 4)
    P.flat(g, cab & ((X < 11) | (X > 39)) & (Y > y0 + 1) & (Y < y0 + 3.5), "orange", 5)
    P.flat(g, cab & (Y > y1 - 1), "bone", 7)  # lit roof
    # roof light bar and beacon
    bar = box(g, 12, y1, 30, 38, y1 + 3, 34, "steel", 4)
    for lx in (14, 20, 27, 33):
        P.flat(g, bar & (X > lx) & (X < lx + 4) & (Z < 31), "gold", 7)
    box(g, 30, y1, 42, 35, y1 + 4, 47, "orange", 6)  # beacon


def bed(g: Grid) -> None:
    X, Y, Z = coords(g)
    for x0, x1 in ((8, 11), (39, 42)):
        wall = box(g, x0, HULL1, 52, x1, HULL1 + 6, 76, "orange", 5)
        P.flat(g, edges(wall), "orange", 3)
    tail = box(g, 8, HULL1, 74, 42, HULL1 + 6, 77, "orange", 5)
    P.flat(g, edges(tail), "orange", 3)
    # sample crates
    for x0, z0, s in ((13, 54, 9), (13, 64, 8)):
        c = box(g, x0, HULL1, z0, x0 + s, HULL1 + s, z0 + s, "steel", 5)
        P.flat(g, edges(c), "cyan", 5)
    # dish mast
    mast = box(g, 29, HULL1, 63, 35, HULL1 + 16, 69, "steel", 4)
    P.flat(g, mast & (np.floor(Y) % 4 == 0), "orange", 5)
    # copper exhaust pipe up the back corner
    pipe(g, [(40, HULL1 - 4, 75), (40, HULL1 + 14, 75)], s=3, ramp="rust", base=4)


def wheel() -> Grid:
    """A huge octagonal wheel: faceted tyre with painted tread, a steel rim
    and a gold hub cap standing proud on both sides."""
    g = Grid(10, 26, 26)
    X, Y, Z = coords(g)
    g.prism("x", ngon(13, 13, R, 8), 1, 9, C("iron", 5))
    tyre = last(g)
    ang = np.degrees(np.arctan2(Y - 13, Z - 13)) % 360
    rr = np.hypot(Y - 13, Z - 13)
    P.flat(g, tyre & (np.floor(ang / 11.25) % 2 == 0), "iron", 6)  # tread blocks
    P.flat(g, tyre & (rr < 8.5), "steel", 5)
    P.flat(g, tyre & (rr < 8.5) & (rr > 7.3), "steel", 3)
    g.prism("x", ngon(13, 13, 4.5, 8), 0, 10, C("gold", 5))
    hub = last(g)
    P.flat(g, hub & (np.hypot(Y - 13, Z - 13) < 2), "gold", 7)
    return g


def dish() -> Grid:
    g = Grid(34, 15, 34)
    X, Y, Z = coords(g)
    back = prism_y(g, 17, 17, 8, 0, 2, "steel", 4)
    bowl = prism_y(g, 17, 17, 16.5, 2, 4, "bone", 6)
    rr = np.hypot(X - 17, Z - 17)
    P.flat(g, bowl & (np.floor(rr) % 5 == 0), "bone", 4)
    P.flat(g, bowl & (rr > 14.5), "orange", 5)
    box(g, 16, 4, 16, 18, 12, 18, "steel", 5)
    head = box(g, 14, 11, 14, 20, 15, 20, "rust", 4)
    P.flat(g, edges(head), "rust", 3)
    P.flat(g, head & (Y > 14), "cyan", 7)
    return g


def antenna() -> Grid:
    g = Grid(3, 22, 3)
    box(g, 1, 0, 1, 2, 20, 2, "steel", 5)
    box(g, 0, 19, 0, 3, 22, 3, "red", 5)
    return g


def build() -> Asset:
    g = chassis()
    pivot = (W / 2, 0.0, L / 2)
    root = Part("rover", g, pivot=pivot)
    spin = turn(1.0, "x", -360)
    move = {}
    for side, x0 in (("l", 0), ("r", W - 10)):
        for k, zc in enumerate(WHEEL_Z):
            name = f"wheel-{side}{k}"
            root.add(Part(name, wheel(), pivot=(5.0, 13.0, 13.0), at=(x0 + 5 - pivot[0], AXLE, zc - pivot[2])))
            move[name] = {"rot": spin}
    root.add(Part("antenna", antenna(), pivot=(1.5, 0.0, 1.5), at=(14 - pivot[0], 46, 46 - pivot[2]), rot=(12.0, 0.0, 10.0)))
    mount = root.add(Part("dish", None, at=(32 - pivot[0], HULL1 + 16, 66 - pivot[2])))
    mount.add(Part("dish-bowl", dish(), pivot=(17.0, 0.0, 17.0), at=(0.0, 0.0, 0.0), rot=(-40.0, 0.0, 10.0)))
    move["dish"] = {"rot": turn(1.0, "y", 360)}  # a whole turn per loop
    return Asset(
        id="space-vehicles-moon-rover", pack="space", category="vehicles", name="Moon Rover", root=root,
        clips=[Clip("move", move), Clip("idle", {"dish": {"rot": turn(4.0, "y", 90)}})],
    )
