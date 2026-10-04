"""Flipped burnt car, in the Pirate Nation style (the pickup truck's family).

A long, low toy sedan lying on its crushed roof with its four wheels in
the air. It is built upright and turned over with Grid.flip, so its
prisms stay true. What makes it read as an upturned car:

- the silhouette: a wide, flat body over a narrow, squashed cabin, with
  the four wheels standing proud of the exposed underside;
- the underside: two steel chassis rails, cross members, beam axles that
  run into the wheel hubs, a differential, a drive shaft, a copper
  exhaust with a muffler and a fuel tank, all on a dark floor pan;
- the ends: an upside-down grille, headlights and chrome bumper at the
  front (-Z); tail lights and a boot lid at the back.

The paint is faded signal red, scorched to rust and soot at the burnt
front, with a hazard-yellow pin stripe, rust blooms round the wheel
arches and dark panel seams. It has settled into a two-tier sand bed:
drifts bank against the cabin and under the nose, a teal coolant puddle
and an oil stain spread from the engine, a lost hubcap and broken glass
lie in the sand, and dry weeds grow from the axles. Faces -Z.
"""
import numpy as np

import paint as P
import pnshapes as S
from _life import blob, ctr, front, limb, make, plan, side, tuft
from pnkit import box
from voxgrid import C, Grid, Part

SX, SZ = 66, 104
CX, CZ = 33.0, 52.0
LIFT = 6  # empty rows under the upright wheels: room for the weeds after the flip
ROOF = 35  # the crushed roof line (upright, before LIFT)
BED = 4  # the sand bed is BED tall; the roof sinks one row into it
SY = ROOF + LIFT + BED - 1
BX0, BX1 = CX - 21, CX + 21  # body sides
NOSE, TAIL = 12, 92
FLOOR = 11  # the floor pan (upright)
WR = 8.0  # wheel flat radius and width
WHEEL_Z = (28, 76)
PAINT = "red"


def u(y: float) -> float:
    """Upright height to grid y (before the flip)."""
    return y + LIFT


def bloom(g: Grid, mask, pts, ramp="rust", shades=(4, 3)) -> None:
    """Soft round rust blooms (rule S3): a light rim and a darker core."""
    X, Y, Z = ctr(g)
    for cx, cy, cz, r in pts:
        d = np.sqrt((X - cx) ** 2 + (Y - cy) ** 2 + (Z - cz) ** 2)
        P.flat(g, mask & (d < r), ramp, shades[0])
        P.flat(g, mask & (d < r * 0.55), ramp, shades[1])


def upright() -> Grid:
    g = Grid(SX, SY, SZ)
    X, Y, Z = ctr(g)

    # ---- the chassis under the floor (added first: the body paints over any overlap)
    rails = np.zeros(g.shape, dtype=bool)
    for rx in (CX - 13, CX + 10):
        rails |= box(g, rx, u(6), NOSE + 4, rx + 3, u(FLOOR) + 1, TAIL - 4, "steel", 5)
    for cz in (NOSE + 5, 50, TAIL - 7):  # cross members, tight under the floor
        rails |= box(g, CX - 13, u(9.5), cz, CX + 13, u(FLOOR) + 1, cz + 3, "steel", 4)
    P.flat(g, rails & (Y < u(7)), "steel", 6)  # the edge that catches the light
    P.outline(g, rails, "steel", 3, normal="y")
    for wz in WHEEL_Z:  # beam axles from hub to hub, with spring pads on the rails
        limb(g, (BX0 - 3, u(WR), wz), (BX1 + 3, u(WR), wz), 1.6, None, "steel", 3, n=6)
        for rx in (CX - 13, CX + 10):
            box(g, rx - 1, u(6), wz - 4, rx + 4, u(7), wz + 4, "steel", 3)
    diff = S.disc(g, "z", CX, u(WR), 4.0, WHEEL_Z[1] - 3, WHEEL_Z[1] + 3, "steel", 4)  # the differential
    P.flat(g, diff & (S.radial(g, "z", CX, u(WR)) < 1.8), "steel", 6)
    limb(g, (CX, u(7.5), 42), (CX, u(7.5), WHEEL_Z[1] - 3), 1.2, None, "steel", 5, n=6)  # drive shaft
    sump = box(g, CX - 7, u(5), 31, CX + 7, u(FLOOR) + 1, 42, "steel", 3)  # engine sump and gearbox
    P.outline(g, sump, "steel", 2, normal="y")
    P.flat(g, sump & (Y < u(6)) & ((np.floor(Z) % 3) == 0), "steel", 2)  # cooling fins
    tank = box(g, CX - 10, u(6.5), 56, CX - 2, u(FLOOR) + 1, 70, "steel", 5)  # fuel tank
    P.outline(g, tank, "steel", 3, normal="y")
    P.flat(g, tank & (Y < u(7.5)) & (np.abs(X - (CX - 6)) < 1.5) & (np.abs(Z - 59) < 1.5), "red", 4)  # filler cap
    # the exhaust: a copper pipe from the engine, a fat muffler, a tailpipe out the back
    # (the tailpipe turns out under the +x sill ahead of the rear axle, clear of it)
    ex = limb(g, (CX + 6, u(7), 36), (CX + 6, u(7), 58), 1.2, None, "rust", 5, n=6)
    muff = box(g, CX + 2, u(5), 57, CX + 10, u(FLOOR) + 1, 68, "rust", 4)
    P.outline(g, muff, "rust", 3)
    P.flat(g, muff & (np.floor(Z) % 4 == 0), "rust", 3)  # clamp bands
    ex |= limb(g, (CX + 9, u(7), 66), (CX + 18, u(7), 66), 1.2, None, "rust", 5, n=6)  # the tailpipe, tucked under the sill
    P.flat(g, ex & (Y < u(6.3)), "rust", 6)

    # ---- the body: a long, low tub with a short sloped bonnet and boot (true slopes)
    prof = [(u(FLOOR), NOSE + 3), (u(FLOOR + 2), NOSE), (u(21), NOSE), (u(24), NOSE + 3), (u(26), 34),
            (u(26), 70), (u(25), TAIL - 4), (u(22), TAIL), (u(FLOOR + 2), TAIL), (u(FLOOR), TAIL - 3)]
    shell = side(g, prof, BX0, BX1, PAINT, 4)
    sides = shell & ((X < BX0 + 1) | (X >= BX1 - 1))
    P.flat(g, shell & (Y > u(24)), PAINT, 5)  # sun-bleached bonnet and boot
    P.flat(g, sides & (Y < u(15)), PAINT, 3)  # the lower sills
    floor = shell & (Y < u(FLOOR + 1)) & (X > BX0 + 1) & (X < BX1 - 1)
    P.mottle(g, shell & (Y < u(FLOOR + 1)), "rust", 3, cell=5, seed=8)  # the rusty floor pan
    P.flat(g, floor & (np.floor(X) % 6 == 0), "rust", 2)  # stamped ribs
    bloom(g, floor, [(CX - 17, u(FLOOR), 44, 4.5), (CX + 17, u(FLOOR), 80, 4.0), (CX - 4, u(FLOOR), 86, 3.5), (CX + 4, u(FLOOR), 22, 4.0)], "steel", (3, 2))  # soot
    # panel seams and trim
    for sz in (34, 53, 71):  # door and wing seams
        P.flat(g, sides & (np.abs(Z - sz) < 0.6) & (Y > u(FLOOR + 1)) & (Y < u(25.5)), PAINT, 2)
    P.flat(g, sides & (np.abs(Y - u(18.5)) < 0.6) & (Z > NOSE + 1) & (Z < TAIL - 1), "gold", 5)  # pin stripe
    for hz in (49, 67):  # door handles
        P.flat(g, sides & (np.abs(Y - u(21)) < 0.6) & (Z > hz - 2) & (Z < hz + 1), "steel", 6)
    top = shell & (Y > u(24))
    P.flat(g, top & (np.abs(Z - 31) < 0.6), PAINT, 2)  # bonnet shut line
    P.flat(g, top & (np.abs(Z - 73) < 0.6), PAINT, 2)  # boot shut line
    # wheel arches: dark wells where the tyres tuck in, with a rust lip
    for wz in WHEEL_Z:
        d = np.hypot(Y - u(WR), Z - wz)
        P.flat(g, sides & (d < WR + 2.6), "rust", 3)
        P.flat(g, sides & (d < WR + 1.4), "steel", 1)
    # the burnt front: soot and rust spread back from the engine
    P.flat(g, shell & (Z < 26) & ~floor, "rust", 4)
    bloom(g, shell & ~floor, [(CX - 14, u(24), 22, 7.0), (CX + 10, u(25), 18, 6.0), (CX, u(17), NOSE, 6.0)], "steel", (3, 2))
    bloom(g, shell & ~floor, [(BX0, u(14), 41, 4.0), (BX1, u(13), 62, 4.5), (BX0, u(22), 84, 3.0), (BX1, u(21), 30, 3.5),
                              (CX + 8, u(26), 80, 4.0), (CX - 10, u(26), 64, 3.0)])
    P.outline(g, sides, PAINT, 2, normal="x")  # dark framed edges (rule S4)
    # nose: grille, headlights and indicators (all upside down once flipped)
    nose = shell & (Z < NOSE + 1)
    grille = nose & (np.abs(X - CX) < 12) & (Y > u(15)) & (Y < u(21))
    P.flat(g, grille, "steel", 2)
    P.flat(g, grille & (np.floor(Y) % 2 == 0) & (np.abs(X - CX) < 11), "steel", 5)
    P.outline(g, grille, "steel", 6, normal="z")
    for hx in (BX0 + 4.5, BX1 - 4.5):
        lamp = S.disc(g, "z", hx, u(18), 2.8, NOSE - 1, NOSE + 1, "steel", 6)
        P.flat(g, lamp & (S.radial(g, "z", hx, u(18)) < 1.8), "gold", 6)
    # tail: tail lights and a boot lock
    tail = shell & (Z > TAIL - 1)
    for tx in (BX0 + 4, BX1 - 4):
        tl = tail & (np.abs(X - tx) < 3) & (Y > u(16)) & (Y < u(21))
        P.flat(g, tl, "red", 6)
        P.outline(g, tl, "steel", 2, normal="z")
    P.flat(g, tail & (np.abs(X - CX) < 1) & (np.abs(Y - u(19)) < 1), "steel", 6)
    # chrome bumpers with dark ends
    # (the rear one is knocked loose and hangs askew from one bracket)
    rear = front(g, [(BX0 - 2, u(FLOOR)), (BX1 + 2, u(FLOOR) - 3), (BX1 + 2, u(FLOOR) + 1), (BX0 - 2, u(FLOOR + 4))], TAIL - 1, TAIL + 2, "steel", 6)
    for z0, z1 in ((NOSE - 3, NOSE + 1), (TAIL - 1, TAIL + 2)):
        bump = box(g, BX0 - 2, u(FLOOR), z0, BX1 + 2, u(FLOOR + 4), z1, "steel", 6) if z0 < CZ else rear
        P.outline(g, bump, "steel", 4)
        P.flat(g, bump & (np.abs(X - CX) < 5) & (Y > u(FLOOR + 1)) & (Y < u(FLOOR + 3)), "bone", 6)  # number plate
        P.flat(g, bump & (np.abs(X - CX) < 4) & (np.abs(Y - u(FLOOR + 2)) < 0.6), "steel", 2)

    # ---- the crushed cabin: a frustum sheared back and leaning (true slopes)
    base = [(BX0 + 2, 34), (BX1 - 2, 34), (BX1 - 2, 71), (BX0 + 2, 71)]
    crown = [(BX0 + 6, 45), (BX1 - 5, 45), (BX1 - 5, 67), (BX0 + 6, 67)]
    cab = plan(g, base, u(26), u(ROOF), PAINT, 4, top=crown)
    P.flat(g, cab & (Y > u(ROOF) - 1), PAINT, 3)  # the crushed roof
    glass = cab & (Y > u(27)) & (Y < u(ROOF) - 1.5)
    pillars = (np.abs(Z - 53) < 1.6) | (Z < 36.5 + (Y - u(26)) * 1.1) | (Z > 68.5 - (Y - u(26)) * 0.3)
    side_glass = glass & ~pillars
    screen = glass & (Z < 40 + (Y - u(26))) & (np.abs(X - CX) < 14)
    win = side_glass | screen
    P.flat(g, win, "navy", 2)
    P.flat(g, win & ((np.floor(X + Y + Z) % 9 == 0) | (np.floor(X - Y + Z) % 11 == 0)), "sky", 5)  # shattered
    P.flat(g, cab & ~win & (np.abs(Y - u(26.5)) < 0.6), "steel", 5)  # window trim
    bloom(g, cab & ~win, [(BX0 + 3, u(30), 60, 3.0), (BX1 - 3, u(31), 44, 2.5)])

    # ---- four tyres on the axle ends, tucked into the arches
    for wz in WHEEL_Z:
        for x0, x1 in ((BX0 - 4, BX0 + 3), (BX1 - 3, BX1 + 4)):
            S.tyre(g, "x", u(WR), wz, WR, x0, x1, rubber=("steel", 2), hub=("steel", 5))
            hub = (X >= x0) & (X < x1) & (S.radial(g, "x", u(WR), wz) < WR * 0.6)
            bloom(g, hub, [(x0 if x0 < CX else x1, u(WR) + 2, wz - 2, 2.4)])
    return g


def build():
    g = upright().flip("y")
    X, Y, Z = ctr(g)
    # the hubcap fell off the front-left wheel: paint that hub bare
    bare = (g.a > 0) & (X < BX0 - 3) & (np.hypot(Y - (SY - u(WR)), Z - WHEEL_Z[0]) < 2.4)
    P.flat(g, bare, "rust", 3)
    # ---- the two-tier sand bed under the whole wreck
    lower = plan(g, blob(CX, CZ, 31.0, 48.0, n=16, jitter=0.03, seed=3, turn=0.2), 0, 2, "sand", 4)
    rim = [(CX - 27, CZ - 45.5), (CX + 26, CZ - 45.5), (CX + 29, CZ - 37), (CX + 28.5, CZ + 38), (CX + 24, CZ + 45.5),
           (CX - 25, CZ + 45.5), (CX - 29, CZ + 37), (CX - 28.5, CZ - 38)]
    upper = plan(g, rim, 2, BED, "sand", 5)
    bed = lower | upper
    P.mottle(g, bed, "sand", 5, cell=6, seed=4)
    P.flat(g, lower & (Y < 2), "sand", 3)
    P.outline(g, upper & (Y > BED - 1), "sand", 4, normal="y")
    # drifts banked against the cabin sides and heaped under the bonnet (true slopes)
    drift = np.zeros(g.shape, dtype=bool)
    drift |= front(g, [(CX - 25, BED - 0.5), (BX0 + 5, BED - 0.5), (BX0 + 5, 7.5)], 46, 64, "sand", 6)
    drift |= front(g, [(BX1 - 5, BED - 0.5), (CX + 25, BED - 0.5), (BX1 - 5, 7.5)], 48, 60, "sand", 6)
    drift |= side(g, [(BED - 0.5, NOSE - 2), (BED - 0.5, 38), (12.5, 38), (12.5, 27)], CX - 14, CX + 14, "sand", 6)
    P.mottle(g, drift, "sand", 6, cell=4, seed=5)
    P.flat(g, drift & (Y < BED + 1), "sand", 5)
    # coolant and oil leaking from the engine onto the sand
    puddle = plan(g, blob(CX - 21, 16, 5, 4.5, n=9, jitter=0.15, seed=6), BED - 1, BED + 0.4, "teal", 5)
    P.flat(g, puddle & (np.hypot(X - (CX - 22), Z - 15) < 2.0), "teal", 7)
    P.outline(g, puddle, "teal", 3, normal="y")
    P.flat(g, upper & (Y > BED - 1) & (np.hypot((X - (CX + 20)) * 0.8, Z - 15) < 4.5), "stone", 2)  # oil stain
    # the lost hubcap and a few shards of glass in the sand
    cap = S.disc(g, "y", CX - 25, 34, 2.6, BED - 0.5, BED + 0.6, "steel", 6)
    P.flat(g, cap & (np.hypot(X - (CX - 25), Z - 34) < 1.2), "steel", 4)
    for gx, gz in ((CX + 24, 30), (CX + 25, 74), (CX - 24, 80), (CX + 10, 95), (CX - 6, 8)):
        P.flat(g, upper & (Y > BED - 1) & (np.abs(X - gx) < 1) & (np.abs(Z - gz) < 1), "sky", 6)
    for k, (px, pz) in enumerate(((CX - 22, 90), (CX + 23, 10), (CX + 19, 93))):  # pebbles
        plan(g, S.flat_ngon(px, pz, 1.6 + 0.3 * k, 6), BED - 0.5, BED + 1.5, "stone", 5, top=S.flat_ngon(px, pz, 0.9, 6))
    # dry weeds growing up from the chassis and round the bed
    for k, (tx, tz) in enumerate(((BX0 + 4.5, WHEEL_Z[1] + 4.5), (BX1 - 4.5, WHEEL_Z[0] - 4.5), (CX + 2.5, 47.5))):
        col = np.nonzero(g.a[int(tx), :, int(tz)])[0]
        tuft(g, tx, tz, float(col.max() + 1), 5, blades=4, spread=2.0, ramp="khaki", shade=4, seed=k)
    for k, (tx, tz) in enumerate(((CX - 26.5, 70.5), (CX + 25.5, 86.5), (CX + 24.5, 22.5))):
        tuft(g, tx, tz, BED, 5, blades=5, spread=2.5, ramp="khaki", shade=3, seed=10 + k)
    return make("terrain-nature", "flipped-car", "Flipped Burnt Car", Part("flipped-car", g))
