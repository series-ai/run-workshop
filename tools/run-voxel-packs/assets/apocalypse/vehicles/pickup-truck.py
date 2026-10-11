"""Pickup trucks, in the Pirate Nation style.

Chunky toy-like caricatures (rule F4): a tall bubble cab, a short sloped
hood and windscreen (true slopes), big octagonal wheels under flared
fenders, and a bed full of junk. The farm pickup is mint teal with a cream
roof; the war-rig reskin (rule K2) is khaki with plate armour, a hazard ram,
a gun in the bed and a skull flag. Glass, seams, stripes, rust and rivets
are paint (rule S1). Wheels roll on `move`; the engine idles on `idle`.
Faces -Z.
"""
import math

import numpy as np

import paint as P
from _kit import text
from _pn import bar, coords, disc, drum, hazard, icon, last, radial, tyre
from pnkit import box, crate, pennant
from voxgrid import C, Asset, Clip, Grid, Part, Socket, turn

GW, GH, GD = 56, 72, 106
BX0, BX1 = 8, 48  # body sides
NOSE, CAB_BACK, TAIL = 6, 57, 84
R, TW = 11, 8  # wheel radius and tread width
WY = R * math.cos(math.pi / 8) + 1e-6  # an octagon with a flat side down sits on y = 0
WHEELS = [(wx, WY, wz) for wz in (22, 68) for wx in (BX0 - TW / 2, BX1 + TW / 2)]
# side profile of hood + cab as (z, y), front to back
PROFILE = [(NOSE, 9), (NOSE, 22), (NOSE + 3, 27), (30, 29), (34, 30), (41, 45), (45, 48.5), (53, 48.5), (CAB_BACK, 44), (CAB_BACK, 9)]


def windscreen_z(y: float) -> float:
    return 34 + (y - 30) * 8 / 17


def body(paint, war: bool, seed: int):
    ramp, sh = paint
    g = Grid(GW, GH, GD)
    X, Y, Z = coords(g)
    # ---- cab and hood: one prism along x (poly is (y, z))
    g.prism("x", [(y, z) for z, y in PROFILE], BX0, BX1, C(ramp, sh))
    cab = last(g)
    side = cab & ((X == BX0) | (X == BX1 - 1))
    # roof in a second tone, a cream waist stripe, door seams and handles
    if not war:
        P.flat(g, cab & (Y >= 45) & (Z >= 41), "bone", 6)
    # ---- bed: floor, thick walls and a tailgate (boxes)
    bed = box(g, BX0, 9, CAB_BACK, BX1, 14, TAIL, ramp, sh)
    bed |= box(g, BX0, 14, CAB_BACK, BX0 + 3, 30, TAIL, ramp, sh)
    bed |= box(g, BX1 - 3, 14, CAB_BACK, BX1, 30, TAIL, ramp, sh)
    bed |= box(g, BX0 + 3, 14, TAIL - 3, BX1 - 3, 29, TAIL, ramp, sh - 1)
    bed |= box(g, BX0 + 3, 14, CAB_BACK, BX1 - 3, 30, CAB_BACK + 1, ramp, sh)
    P.flat(g, bed & (Y == 29) & ((X < BX0 + 3) | (X >= BX1 - 3)), ramp, sh + 1)  # rail caps
    shell = cab | bed
    P.flat(g, shell & (Y >= 16) & (Y < 19), "bone" if not war else "gold", 6 if not war else 5)
    for sz in (35, 55):
        P.flat(g, side & (Z == sz) & (Y >= 12) & (Y < 45), ramp, sh - 2)
    P.flat(g, side & (Z >= 49) & (Z < 53) & (Y >= 25) & (Y < 27), "steel", 6)
    # glass: side windows and the windscreen (on the slope)
    glass = cab & (Y >= 31) & (Y < 44) & (Z >= 38) & (Z < 53) & ((X == BX0) | (X == BX1 - 1))
    glass |= cab & (Y >= 31) & (Y < 45) & (Z < windscreen_z(Y) + 2) & (Z >= 32) & (X >= BX0 + 3) & (X < BX1 - 3)
    glass |= cab & (Y >= 31) & (Y < 44) & (Z == CAB_BACK - 1) & (X >= BX0 + 5) & (X < BX1 - 5)
    P.flat(g, glass, "sky", 5)
    streak = ((X - Y) % 23 < 3) & ((X - Y) % 23 >= 0)
    P.flat(g, glass & streak & (Z < CAB_BACK - 1), "sky", 7)  # two glare streaks
    P.outline(g, glass & ((X == BX0) | (X == BX1 - 1)), ramp, sh - 2, normal="x")
    # ---- nose: grille, headlights, bumper
    grille = box(g, 18, 11, NOSE - 1, 38, 23, NOSE, "steel", 6)
    P.flat(g, grille & ((X - 18) % 3 == 0), "steel", 4)
    P.outline(g, grille, "steel", 3, normal="z")
    for hx in (13, 43):
        lamp = disc(g, "z", hx, 18, 4.2, NOSE - 3, NOSE, "gold", 7)
        P.flat(g, lamp & (radial(g, "z", hx, 18) > 2.8), "bone", 6)
    bumper = box(g, BX0 - 2, 6, NOSE - 3, BX1 + 2, 11, NOSE, "steel", 5)
    P.outline(g, bumper, "steel", 3, normal="z")
    box(g, BX0 - 1, 7, TAIL, BX1 + 1, 11, TAIL + 2, "steel", 5)
    for tx in (BX0, BX1 - 3):  # tail lights
        P.flat(g, bed & (Z == TAIL - 1) & (X >= tx) & (X < tx + 3) & (Y >= 21) & (Y < 27), "red", 5)
    # ---- flared fenders over the wheels (true slopes) and running boards
    for wz in (22, 68):
        for x0, x1 in ((0, BX0), (BX1, GW)):
            g.prism("x", [(22, wz - 14), (27, wz - 10), (27, wz + 10), (22, wz + 14)], x0, x1, C(ramp, sh - 1))
            f = last(g)
            P.flat(g, f & (Y >= 26), ramp, sh)
    for x0, x1 in ((BX0 - 5, BX0), (BX1, BX1 + 5)):
        step = box(g, x0, 12, 37, x1, 14, 59, "steel", 4)
        P.flat(g, step & ((Z % 3) == 0), "steel", 3)
    # ---- exhaust stack behind the cab on the +x side
    pipe = disc(g, "y", BX1 + 2.5, CAB_BACK + 2, 1.8, 14, 52, "steel", 5)
    P.flat(g, pipe & (Y >= 48), "iron", 5)
    exhaust = (BX1 + 2.5, 52, CAB_BACK + 2)
    # ---- weathering: rust blooms and painted dents on the paint
    rng = np.random.default_rng(seed)
    for _ in range(6):  # a few soft rust blooms, not speckle (rule S3)
        cx, cy, cz, r = rng.uniform(BX0, BX1), rng.uniform(10, 30), rng.uniform(NOSE, TAIL), rng.uniform(2.0, 3.5)
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2)
        P.flat(g, shell & ~glass & (d < r), "rust", 5)
        P.flat(g, shell & ~glass & (d < r * 0.5), "rust", 4)
    P.grime(g, shell & (Y < 14), height=3, seed=seed + 7)
    return g, exhaust


def farm_junk(g: Grid, seed: int) -> None:
    """The farm pickup: a roof light bar, a bed of junk and a flag."""
    X, Y, Z = coords(g)
    lb = box(g, 14, 48, 45, 42, 51, 49, "darkwood", 4)
    for lx in range(16, 40, 6):
        P.flat(g, lb & (X >= lx) & (X < lx + 4) & (Z == 45) & (Y >= 49), "gold", 7)
    # hood racing stripes and a door logo (paint)
    shell = g.a > 0
    P.flat(g, shell & (Y >= 27) & (Y < 31) & (Z < 33) & (((X >= 22) & (X < 25)) | ((X >= 31) & (X < 34))), "bone", 6)
    text(g, "+x", "FARM", 45, 33 - 12, C("bone", 7), scale=1, gap=1)
    # wooden stake rails on the bed sides (weathered pirate wood)
    for x0 in (BX0, BX1 - 2):
        rail = box(g, x0, 30, CAB_BACK + 1, x0 + 2, 38, TAIL, "wood", 5)
        P.planks(g, rail, "wood", 5, width=4, across="y", seed=seed + x0)
        for pz in (CAB_BACK + 1, (CAB_BACK + TAIL) // 2, TAIL - 3):
            stake = box(g, x0, 30, pz, x0 + 2, 40, pz + 3, "darkwood", 5)
    # junk piled high in the bed
    crate(g, 12, 14, 64, 14, seed=seed + 1)
    drum(g, 19, 71, 28, 16, 7.5, ramp="red", label=None, band=("gold", 5), seed=seed)
    tyre(g, "z", 34, 32, 9, CAB_BACK + 1, CAB_BACK + 6, hub="steel", hub_base=5)  # a spare stood against the cab
    crate(g, 30, 14, 70, 10, seed=seed + 2)
    tarp = disc(g, "x", 19, 79, 4.5, BX0 + 3, BX1 - 3, "orange", 5)
    P.flat(g, tarp & ((X % 9) < 2), "sand", 4)
    bar(g, "z", (40, 14), (44, 40), 2, 60, 62, "wood", 5)  # a shovel handle leaning on the rail
    box(g, 38, 14, 58, 43, 20, 64, "steel", 5)
    pennant(g, BX0 + 3, 29, CAB_BACK + 3, 30, 14, "toxic")


def war_kit(g: Grid, seed: int) -> None:
    """The war rig: plate armour, a hazard ram, a gun in the bed, a skull flag."""
    X, Y, Z = coords(g)
    for x0, x1 in ((BX0 - 1, BX0), (BX1, BX1 + 1)):
        plate = box(g, x0, 14, 36, x1, 30, 55, "rust", 5)
        plate |= box(g, x0, 14, CAB_BACK + 4, x1, 28, TAIL - 4, "rust", 5)
        P.plates(g, plate, "rust", 5, size=(9, 8), seed=seed)
    # windscreen armour: a plate on the slope with a painted vision slit
    g.prism("x", [(31, 33), (44, 39.5), (44, 37.5), (31, 31)], BX0 + 2, BX1 - 2, C("steel", 5))
    shield = last(g)
    P.plates(g, shield, "steel", 5, size=(10, 6), seed=seed + 1)
    P.flat(g, shield & (Y >= 38) & (Y < 40), "iron", 5)
    # dozer ram: a hazard-striped wedge in front of the nose
    g.prism("x", [(4, 1), (26, 3), (26, 5), (4, 5)], BX0 - 4, BX1 + 4, C("gold", 5))
    ram = last(g)
    hazard(g, ram, period=8, a=("gold", 5), b=("darkwood", 4))
    for sz in range(CAB_BACK + 4, TAIL - 2, 8):
        for x0, x1 in ((BX0, BX0 + 3), (BX1 - 3, BX1)):
            g.prism("x", [(30, sz), (30, sz + 4), (35, sz + 2)], x0, x1, C("steel", 6))
    # a mounted gun in the bed
    ped = box(g, 24, 14, 68, 32, 36, 76, "steel", 4)
    P.plates(g, ped, "steel", 4, size=(8, 7), seed=seed + 2)
    gun = box(g, 24, 36, 64, 32, 42, 80, "iron", 6)
    bar(g, "x", (39, 64), (39, 42), 3, 26.5, 29.5, "iron", 6)
    sh = box(g, 20, 36, 62, 36, 46, 64, "khaki", 5)
    P.plates(g, sh, "khaki", 5, size=(8, 5), seed=seed + 3)
    icon(g, "+y", "skull", 21, 12, C("bone", 6), C("bone", 5), scale=2)
    pennant(g, BX0 + 3, 29, CAB_BACK + 3, 32, 16, "red")


def wheel(wx, wy, wz, war: bool) -> Grid:
    g = Grid(GW, GH, GD)
    tyre(g, "x", wy, wz, R, wx - TW / 2, wx + TW / 2, hub="steel" if not war else "khaki", hub_base=6 if not war else 5)
    return g


def truck(paint, war: bool, seed: int, name: str):
    g, exhaust = body(paint, war, seed)
    (war_kit if war else farm_junk)(g, seed + 10)
    xs, _ys, zs = np.nonzero(g.a)
    root_pivot = ((xs.min() + xs.max() + 1) / 2, 0.0, (zs.min() + zs.max() + 1) / 2)
    root = Part(name, None, pivot=root_pivot)
    for i, (wx, wy, wz) in enumerate(WHEELS):
        root.add(Part(f"wheel-{i}", wheel(wx, wy, wz, war), pivot=(wx, wy, wz), at=(wx - root_pivot[0], wy, wz - root_pivot[2])))
    joint = (root_pivot[0], WY, root_pivot[2])
    root.add(Part("body", g, pivot=joint, at=(0.0, WY, 0.0)))
    spin_s, bounce = 0.8, 0.4
    move = {f"wheel-{i}": {"rot": turn(spin_s, "x", -360 / spin_s)} for i in range(len(WHEELS))}
    move["body"] = {"loc": [(spin_s * k / 4, (0, bounce if k % 2 else 0, 0)) for k in range(5)],
                    "rot": [(0.0, (0, 0, 0)), (spin_s / 2, (1.2, 0, 0.6)), (spin_s, (0, 0, 0))]}
    idle = {"body": {"loc": [(k * 0.08, (0, 0.18 if k % 2 else 0, 0)) for k in range(11)]}}
    sock = Socket("socket-exhaust", at=tuple(float(exhaust[i] - root_pivot[i]) for i in range(3)), parent="body")
    return root, [Clip("move", move), Clip("idle", idle)], sock


def build():
    out = []
    for war, paint, slug, name, seed in ((False, ("teal", 5), "pickup-truck", "Rusty Pickup Truck", 10), (True, ("khaki", 5), "war-pickup", "War-Rig Pickup", 20)):
        root, clips, sock = truck(paint, war, seed, slug if not war else "war-pickup")
        out.append(Asset(
            id=f"apocalypse-vehicles-{slug}", pack="apocalypse", category="vehicles", name=name, root=root, clips=clips,
            sockets=[sock],
            pfx=[{"effectId": "rvx-apocalypse-engine-smoke", "socket": "socket-exhaust", "trigger": "clip:move", "size": 24, "aim": [1.0, 0.0, 0.0]}],
        ))
    return out
