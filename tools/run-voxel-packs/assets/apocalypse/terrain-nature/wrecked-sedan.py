"""Wrecked sedan, in the Pirate Nation style (the pickup truck's family).

A chunky toy-like family car the size of the live pickup: a short sloped
hood and a tall bubble cabin (true slopes), flared fenders, sunk on four
flat tyres into a drifted sand bed. Its zombie-teal paint has faded and
chipped down to big rust-copper blooms, with sand dust caked low on the
body and a dusty cream roof. The bonnet has sprung open on two visible
hinges and rests on a prop rod over a stripped engine: a steel block
with a signal-red valve cover, an air filter, a radiator, a battery with
hazard-yellow caps and fat black hoses. The windows are smashed, the
front bumper hangs off one bracket into the sand, and the driver's door
is torn off and leans against the back wheel (the cab and its seat show
through the hole). Detail is paint on flat faces. Faces -Z.
"""
import numpy as np

import paint as P
import pnpaint as PP
import pnshapes as S
from _life import SEDAN, blob, ctr, flat_tyre, front, limb, make, plan, sedan_glass, sedan_profile, side, tuft
from pnkit import box
from voxgrid import Grid, Part

CAR = (58, 52, 92)  # the car is built in its own frame, then set into the bed
OX, OY, OZ = 4, 2, 4  # where the car frame sits in the bed frame (OY: sunk 1 into the bed)
SZ = (72, 52, 100)
BED = 3
X0, X1 = SEDAN["x0"], SEDAN["x1"]
PAINT = "teal"
SINK = 2.5  # how far the body sits lower on its flat tyres
HINGE = (28.0 - SINK, 31.0)  # (y, z) of the bonnet hinge line at the windscreen
OPEN = 38.0  # bonnet opening angle, degrees


def bloom(g: Grid, mask, pts, ramp="rust", shades=(5, 4)) -> None:
    """Soft round rust blooms (rule S3): a light rim and a darker core."""
    X, Y, Z = ctr(g)
    for cx, cy, cz, r in pts:
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2)
        P.flat(g, mask & (d < r), ramp, shades[0])
        P.flat(g, mask & (d < r * 0.6), ramp, shades[1])


def bonnet_poly(length: float = 21.0, thick: float = 1.6):
    """The open bonnet as a (y, z) slab rising forward from the hinge."""
    a = np.radians(OPEN)
    dy, dz = np.sin(a), -np.cos(a)
    ny, nz = np.cos(a), np.sin(a)
    hy, hz = HINGE
    ey, ez = hy + length * dy, hz + length * dz
    return [(hy, hz), (ey, ez), (ey + thick * ny, ez + thick * nz), (hy + thick * ny, hz + thick * nz)]


def car() -> Grid:
    g = Grid(*CAR)
    X, Y, Z = ctr(g)
    # ---- the engine (added before the shell so the bay floor stays the shell's)
    block = box(g, X0 + 9, 20 - SINK, 13, X1 - 9, 28 - SINK, 27, "steel", 4)
    P.outline(g, block, "steel", 2, normal="y")
    P.flat(g, block & (np.floor(Z) % 4 == 0) & (Y < 27 - SINK), "steel", 3)
    cover = box(g, X0 + 11, 28 - SINK, 14, X1 - 11, 30 - SINK, 26, "red", 4)  # the valve cover
    P.flat(g, cover & (np.floor(Z) % 3 == 0), "red", 3)
    P.outline(g, cover, "red", 2, normal="y")
    P.flat(g, cover & (np.abs(X - 33) < 1) & (np.abs(Z - 23) < 1), "gold", 6)  # oil cap
    filt = S.disc(g, "y", 23, 18, 3.6, 30 - SINK, 32 - SINK, "steel", 6)  # air filter
    P.outline(g, filt, "steel", 4, normal="y")
    P.flat(g, filt & (S.radial(g, "y", 23, 18) < 1.2), "steel", 3)
    rad = box(g, X0 + 6, 14 - SINK, 8, X1 - 6, 27 - SINK, 11, "steel", 2)  # radiator
    P.flat(g, rad & (np.floor(X) % 2 == 0), "steel", 4)
    P.outline(g, rad, "steel", 5, normal="z")
    batt = box(g, X1 - 8, 20 - SINK, 18, X1 - 3, 29 - SINK, 25, "steel", 1)  # battery
    P.flat(g, batt & (Y > 28 - SINK) & (np.abs(Z - 20) < 1), "gold", 5)
    P.flat(g, batt & (Y > 28 - SINK) & (np.abs(Z - 23) < 1), "red", 4)
    P.flat(g, batt & (np.abs(Y - (26 - SINK)) < 1) & (X > X1 - 3.6), "gold", 5)  # hazard label
    limb(g, (X0 + 10, 29 - SINK, 10), (X0 + 10, 29 - SINK, 17), 1.3, None, "darkwood", 2, n=6)  # top hose
    limb(g, (X1 - 12, 26 - SINK, 10), (X1 - 12, 26 - SINK, 15), 1.3, None, "darkwood", 2, n=6)  # bottom hose
    for k in range(3):  # copper exhaust manifold down the -x side
        limb(g, (X0 + 9.5, 26 - SINK, 15 + 4 * k), (X0 + 4.5, 26 - SINK, 15 + 4 * k), 0.9, None, "rust", 5, n=6)

    # ---- the shell
    prof = [(y - SINK, z) for z, y in sedan_profile(hood_drop=3.0)]
    shell = side(g, prof, X0, X1, PAINT, 3)
    sides = shell & ((X < X0 + 1) | (X >= X1 - 1))
    P.flat(g, shell & (Y < 14 - SINK), PAINT, 2)  # darker sills
    P.flat(g, shell & (Y >= 42 - SINK) & (Z >= 41) & (Z < 64), "bone", 5)  # the dusty cream roof
    roof = shell & (Y >= 42 - SINK) & (Z >= 41) & (Z < 64)
    bloom(g, roof, [(20, 44, 50, 5.0), (36, 44, 59, 4.0)], "sand", (5, 4))  # drifted dust
    glass = sedan_glass(g, shell, X0, X1, flip_y=lambda y: y + SINK)
    P.flat(g, glass, "navy", 2)
    I, J, K = np.floor(X), np.floor(Y), np.floor(Z)
    P.flat(g, glass & ((I + J + K) % 14 < 2), "navy", 4)  # a soft glint band
    star = [(28, 38 - SINK, 35), (X0, 36 - SINK, 47), (X1, 35 - SINK, 60), (28, 37 - SINK, 68)]
    for k, (sx, sy, sz) in enumerate(star[:2]):  # a smashed star in the windscreen and one side pane
        d = np.sqrt((X - sx) ** 2 + (Y - sy) ** 2 + (Z - sz) ** 2)
        ang = np.arctan2(Y - sy, (Z - sz) + (X - sx))
        ray = (np.abs(((ang * 6 / np.pi + k) % 2) - 1) > 0.82) & (d < 6)
        P.flat(g, glass & ray, "sky", 6)
        P.flat(g, glass & (d < 1.6), "darkwood", 1)  # the hole
    P.outline(g, glass & ((X < X0 + 1) | (X >= X1 - 1)), "steel", 5, normal="x")  # window trim
    # panel seams, trim, handle and fuel flap
    for sz in (38, 55, 70):
        P.flat(g, sides & (np.abs(Z - sz) < 0.6) & (Y > 9 - SINK) & (Y < 30 - SINK), PAINT, 1)
    P.flat(g, sides & (np.abs(Y - (17 - SINK)) < 0.6) & (Z > 8) & (Z < 82), "steel", 6)  # chrome waist trim
    P.flat(g, sides & (X < X0 + 1) & (np.abs(Y - (24 - SINK)) < 0.6) & (Z > 49) & (Z < 52), "steel", 6)
    P.flat(g, sides & (X < X0 + 1) & (np.abs(Y - (22 - SINK)) < 1.6) & (np.abs(Z - 75) < 1.6), PAINT, 1)
    # the engine bay floor and a dark lip round it
    bay = shell & (Z > 9) & (Z < 29) & (Y > 23 - SINK) & (X > X0 + 2) & (X < X1 - 2)
    P.flat(g, bay, "steel", 3)
    P.outline(g, bay, "steel", 1, normal="y")
    # the missing driver's door: a framed hole onto the cab and its torn seat
    hole = shell & (X >= X1 - 1) & (Y >= 10 - SINK) & (Y < 30 - SINK) & (Z >= 39) & (Z < 55)
    P.flat(g, hole, "darkwood", 2)
    P.outline(g, hole, "rust", 3, normal="x")
    seat = hole & (Z > 46) & (Z < 53) & (Y > 14 - SINK) & (Y < 27 - SINK)
    P.flat(g, seat, "red", 3)
    P.flat(g, seat & (np.floor(Y) % 3 == 0), "red", 2)  # pleats
    P.flat(g, hole & (Z > 41) & (Z <= 46) & (Y > 14 - SINK) & (Y < 17 - SINK), "red", 4)  # cushion
    P.flat(g, hole & (np.abs(Z - 42) < 0.6) & (Y > 19 - SINK) & (Y < 26 - SINK), "steel", 2)  # steering column
    # nose: grille and headlights (one smashed)
    grille = box(g, 18, 11 - SINK, 5, 38, 21 - SINK, 6, "steel", 5)
    P.flat(g, grille & ((X - 18) % 3 == 0), "steel", 2)
    P.outline(g, grille, "steel", 6, normal="z")
    for k, hx in enumerate((13, 43)):
        lamp = S.disc(g, "z", hx, 17 - SINK, 3.8, 3, 6, "steel", 6)
        lens = lamp & (S.radial(g, "z", hx, 17 - SINK) < 2.4)
        P.flat(g, lens, "gold", 6) if k == 0 else P.flat(g, lens, "navy", 2)
        P.flat(g, lamp & (S.radial(g, "z", hx, 17 - SINK) < 1.0), "gold", 7) if k == 0 else None
    # bumpers: the front one hangs off its +x bracket into the sand
    fb = front(g, [(X0 - 2, 7 - SINK), (X0 - 2, 11 - SINK), (X1 + 2, 4.0), (X1 + 2, 0.5)], 3, 6, "steel", 5)
    P.outline(g, fb, "steel", 3, normal="z")
    rb = box(g, X0 - 1, 6 - SINK, 84, X1 + 1, 10 - SINK, 86, "steel", 5)
    P.outline(g, rb, "steel", 3, normal="z")
    P.flat(g, rb & (np.abs(X - 28) < 4) & (Y > 7 - SINK) & (Y < 9 - SINK), "bone", 6)  # number plate
    for tx in (X0 + 3, X1 - 3):  # tail lights
        tl = shell & (Z > 83) & (np.abs(X - tx) < 3) & (Y > 14 - SINK) & (Y < 21 - SINK)
        P.flat(g, tl, "red", 5)
        P.outline(g, tl, "red", 2, normal="z")
    # flared fenders, the front -x one crumpled
    fenders = np.zeros(g.shape, dtype=bool)
    for wz in SEDAN["wheel_z"]:
        for x0, x1 in ((0, X0), (X1, 58)):
            f = side(g, [(22 - SINK, wz - 14), (27 - SINK, wz - 10), (27 - SINK, wz + 10), (22 - SINK, wz + 14)], x0 + 1, x1 - 1, PAINT, 3)
            P.flat(g, f & (Y >= 26 - SINK), PAINT, 3)
            P.outline(g, f, PAINT, 1)
            fenders |= f
    dent = fenders & (X < X0) & (Z < 34)
    P.flat(g, dent, "steel", 5)  # the crumpled front wing, patched in primer
    P.flat(g, dent & ((np.floor(Z + Y) % 5) == 0), "steel", 3)  # crease lines
    P.outline(g, dent, "steel", 3)
    # weathering: big rust blooms low and round the arches, sand dust on the sills
    paint_ = (shell | fenders) & ~glass & ~hole & ~bay
    edge = 11 - SINK + 2.5 * np.sin(Z * 0.31 + X * 0.2) + 1.5 * np.sin(Z * 0.11 + 1.3)  # a ragged tide line
    P.flat(g, paint_ & (Y < edge + 1.2), "rust", 5)  # rust creeping up from the sills
    P.flat(g, paint_ & (Y < edge), "rust", 4)
    bloom(g, paint_, [(X0, 10, 34, 7.0), (X0, 24, 60, 5.0), (X0, 9, 80, 6.5), (X1, 9, 30, 6.0), (X1, 12, 64, 7.0),
                      (28, 26, 6, 5.0), (16, 24, 84, 6.0), (40, 26, 82, 4.5), (X0, 25, 22, 4.5), (X1, 25, 76, 5.0),
                      (20, 25, 30, 3.5), (X0, 31, 72, 3.5), (X1, 30, 42, 3.0)])
    P.flat(g, paint_ & (Y < 8 - SINK), "sand", 4)  # caked dust
    P.flat(g, paint_ & (Y >= 9 - SINK) & (Y < 11 - SINK) & (P._hash(np.floor(X + Z) // 2, seed=3) % np.uint64(2) == 0), "sand", 4)
    P.outline(g, sides & ~hole, PAINT, 1, normal="x")  # dark framed edges (rule S4)
    # ---- the open bonnet on two hinges, held up by a prop rod
    lid = side(g, bonnet_poly(), X0 + 1, X1 - 1, "steel", 5)  # a grey primer bonnet off another car
    P.outline(g, lid, "steel", 3, normal="x")
    bloom(g, lid, [(20, HINGE[0] + 8, 20, 3.5), (37, HINGE[0] + 12, 15, 2.5)])
    for hx in (X0 + 3, X1 - 6):
        box(g, hx, HINGE[0] - 1, HINGE[1] - 1, hx + 3, HINGE[0] + 2, HINGE[1] + 2, "steel", 2)
    a = np.radians(OPEN)
    tip = (HINGE[0] + 17 * np.sin(a), HINGE[1] - 17 * np.cos(a))
    limb(g, (X0 + 4, 23 - SINK, tip[1] + 0.5), (X0 + 4, tip[0] + 0.5, tip[1] + 0.5), 0.6, None, "steel", 6, n=4)
    # ---- four flat tyres
    for wz in SEDAN["wheel_z"]:
        for x0, x1 in ((1, X0), (X1, 57)):
            flat_tyre(g, x0, x1, wz, SEDAN["r"], sink=SINK, ramp=("steel", 2), hub=("steel", 5))
    return g


def build():
    g = Grid(*SZ)
    g.paste(car(), OX, OY, OZ)
    X, Y, Z = ctr(g)
    cx, cz = OX + 28, OZ + 45
    # ---- one coherent two-tier sand bed the car has settled into
    lower = plan(g, blob(cx + 3, cz, 33.0, 47.5, n=16, jitter=0.03, seed=3, turn=0.2), 0, 1.5, "sand", 4)
    rim = [(cx - 28, cz - 44), (cx + 28, cz - 44), (cx + 33, cz - 34), (cx + 34, cz + 36), (cx + 29, cz + 45),
           (cx - 26, cz + 45), (cx - 31, cz + 36), (cx - 31, cz - 36)]
    upper = plan(g, rim, 1.5, BED, "sand", 5)
    P.mottle(g, lower | upper, "sand", 5, cell=6, seed=4)
    P.flat(g, lower & (Y < 1.5), "sand", 3)
    P.outline(g, upper & (Y > BED - 1), "sand", 4, normal="y")
    # drifts banked against the wheels and up the -x flank (true slopes)
    drift = np.zeros(g.shape, dtype=bool)
    for wz in SEDAN["wheel_z"]:
        drift |= side(g, [(BED - 0.5, OZ + wz - 17), (BED - 0.5, OZ + wz + 4), (8.5, OZ + wz - 5)], OX - 3, OX + 10, "sand", 6)
    drift |= front(g, [(OX - 3, BED - 0.5), (OX + X0 + 1, BED - 0.5), (OX + X0 + 1, 9.5)], OZ + 32, OZ + 58, "sand", 6)
    drift |= side(g, [(BED - 0.5, OZ + 62), (BED - 0.5, OZ + 84), (7.5, OZ + 70)], OX + X1 - 2, OX + 60, "sand", 6)
    P.mottle(g, drift, "sand", 6, cell=4, seed=5)
    P.flat(g, drift & (Y < BED + 1), "sand", 5)
    # the torn-off door leans on the back +x tyre: a slab with its window frame
    dz0, dz1 = OZ + 58, OZ + 76
    door = front(g, [(OX + 66.5, BED - 0.5), (OX + 64.0, BED - 0.5), (OX + 56.8, BED + 15.5), (OX + 59.3, BED + 15.5)], dz0, dz1, PAINT, 3)
    P.flat(g, door & (Y > BED + 10), "navy", 2)  # the empty window
    P.flat(g, door & (Y > BED + 10) & ((Z < dz0 + 1.5) | (Z > dz1 - 1.5) | (Y > BED + 14.5)), "steel", 5)
    P.flat(g, door & (np.abs(Y - (BED + 7)) < 0.6), "steel", 6)  # its chrome trim
    bloom(g, door, [(OX + 63, BED + 3, dz0 + 4, 4.0), (OX + 61, BED + 8, dz1 - 3, 3.0)])
    P.flat(g, door & (Y < BED + 1.5), "sand", 4)
    # odds and ends in the sand
    for k, (px, pz) in enumerate(((cx - 26, OZ + 2), (cx + 30, OZ + 30), (cx - 24, OZ + 88))):  # pebbles
        plan(g, S.flat_ngon(px, pz, 1.6 + 0.3 * k, 6), BED - 0.5, BED + 1.5, "stone", 5, top=S.flat_ngon(px, pz, 0.9, 6))
    for gx, gz in ((cx + 24, OZ + 44), (cx + 27, OZ + 50), (cx - 25, OZ + 20), (cx + 6, OZ - 1)):  # glass from the windows
        P.flat(g, upper & (Y > BED - 1) & (np.abs(X - gx) < 1) & (np.abs(Z - gz) < 1), "sky", 6)
    for k, (tx, tz) in enumerate(((cx + 30.5, OZ + 86.5), (cx - 28.5, OZ + 6.5), (cx - 27.5, OZ + 74.5))):
        tuft(g, tx, tz, BED, 6, blades=4, spread=2.0, ramp="khaki", shade=3 + (k % 2), seed=5 + k)
    return make("terrain-nature", "wrecked-sedan", "Wrecked Sedan", Part("wrecked-sedan", g))
