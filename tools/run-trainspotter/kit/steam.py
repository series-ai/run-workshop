"""Steam locomotives and tenders.

Drivers share one radius (the rods are phase-locked to it) and carry painted
spokes and counterweights. Coupling rods, main rods and crossheads are
separate parts driven by the `move` clip (stock.py) and by the runtime helper.
"""
from __future__ import annotations

import math

import numpy as np

from furniture import ends, underframe
from railkit import C, Grid, P, coords
from shapes import BW, BX, glass, round_lamp
from pnshapes import bar, cone, disc, dome, last
from catalog import stock
from stock import Axle, Bogie, Rods, Stock

DRIVER = dict(spokes=14, counterweight=True)


def express(name="steam-express-green", paint="forest", trim="arcane", accent="red") -> Stock:
    """A 4-6-2 express passenger engine: long boiler, three big drivers,
    lined green paint, a polished dome and a red buffer beam."""
    L = 160
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    by, br = 41, 13  # boiler axis height and radius
    boiler = disc(g, "z", BX, by, br, 18, 124, paint, 4, n=16)
    smokebox = disc(g, "z", BX, by, br + 0.5, 8, 30, "iron", 3, n=16)
    P.flat(g, smokebox & (Z == 8) & (np.hypot(X + 0.5 - BX, Y + 0.5 - by) < 9), "iron", 2)  # door
    P.flat(g, smokebox & (Z == 8) & (np.abs(Y + 0.5 - by) < 0.8), "steel", 5)  # hinge strap
    for zb in (40, 64, 88, 112):  # boiler bands
        P.flat(g, boiler & (Z >= zb) & (Z < zb + 2), trim, 3)
        P.flat(g, boiler & ((Z == zb - 1) | (Z == zb + 2)), accent, 5)
    cone(g, "y", BX, 17, 5.0, by + br - 2, by + br + 9, "iron", 2, n=10, r_top=4.0)  # chimney
    disc(g, "y", BX, 17, 5.8, by + br + 8, by + br + 10, "iron", 3, n=10)  # chimney cap
    dome(g, BX, 72, by + br - 2, 5.5, h=6, n=10, rings=2, ramp="ember", base=5, painter=lambda *a: None, ribs=None)
    cone(g, "y", BX, 96, 3.5, by + br - 2, by + br + 4, "ember", 5, n=8, r_top=2.2)  # safety valves
    # firebox and cab
    g.box(BX - 15, 26, 118, BX + 15, 50, 130, C(paint, 4))
    cab = g.prism("z", [(BX - 21, 26), (BX + 21, 26), (BX + 21, 62), (BX + 15, 68), (BX - 15, 68), (BX - 21, 62)], 126, 156, C(paint, 4))
    cabm = last(g)
    P.flat(g, cabm & (Y >= 62), "iron", 3)  # roof
    for x in (BX - 21, BX + 20):
        glass(g, cabm & (X == x) & (Z >= 132) & (Z < 146) & (Y >= 46) & (Y < 58))
        P.flat(g, cabm & (X == x) & (Y >= 28) & (Y < 31), accent, 5)
    glass(g, cabm & (Z == 126) & (Y >= 52) & (Y < 60) & (np.abs(X + 0.5 - BX) > 8) & (np.abs(X + 0.5 - BX) < 17))
    # running board along the whole engine, valances lined in the accent colour
    g.box(BX - 22, 25, 6, BX + 22, 28, 156, C(trim, 3))
    P.flat(g, (g.a > 0) & (Y == 25) & ((X == BX - 22) | (X == BX + 21)), accent, 5)
    # cylinders and slide bars
    for sx in (-1, 1):
        disc(g, "z", BX + sx * 20, 20, 4.0, 24, 42, paint, 3, n=10)
        g.box(BX + sx * 20 - 1, 19, 42, BX + sx * 20 + 1, 21, 54, C("steel", 6))
    underframe(g, 8, 156, y0=14, y1=25, half=12, ramp=("iron", 2))
    ends(g, L, beam=(accent, 4), rear=False)
    g.box(BX - 3, 8, L - 4, BX + 3, 12, L, C("iron", 2))  # drawbar to the tender
    round_lamp(g, BX - 12, 32, 6, r=2.2, lens=("sand", 7))
    round_lamp(g, BX + 12, 32, 6, r=2.2, lens=("sand", 7))
    rods = Rods(["wheel-d1", "wheel-d2", "wheel-d3"], "wheel-d2", crank=5, slide_y=20, main_len=42, x=20)
    face = dict(face=(paint, 3), **DRIVER)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28, r=6, wheelbase=18)],
                 axles=[Axle("wheel-d1", 62, 12, face), Axle("wheel-d2", 88, 12, face), Axle("wheel-d3", 114, 12, face), Axle("wheel-t1", 142, 6)],
                 guides=(28, 142), rods=rods, powered=True, idle="steam",
                 sockets=[("socket-smoke", (BX, 66, 17)), ("socket-steam-l", (BX - 20, 20, 24)), ("socket-steam-r", (BX + 20, 20, 24)),
                          ("socket-light-f", (BX, 32, 4)), ("socket-cab", (BX, 56, 126))],
                 data={"traction": "steam", "wheelArrangement": "4-6-2", "tender": "tender-express"})


def tender(name="tender-express", paint="forest", trim="arcane", accent="red") -> Stock:
    """A six-wheel tender: coal heaped in the bunker, water tank behind."""
    L = 96
    g = Grid(BW, 56, L + 1)
    X, Y, Z = coords(g)
    tank = g.prism("z", [(BX - 21, 20), (BX + 21, 20), (BX + 21, 46), (BX + 19, 50), (BX - 19, 50), (BX - 21, 46)], 6, 92, C(paint, 4))
    tm = last(g)
    P.flat(g, tm & ((Y == 22) | (Y == 44)), accent, 5)
    P.flat(g, tm & (Y >= 23) & (Y < 44) & ((Z == 9) | (Z == 88)), trim, 3)
    # coal: a lumpy heap in the front half
    rng = np.random.default_rng(3)
    heap = (np.abs(X + 0.5 - BX) < 18) & (Z >= 10) & (Z < 60) & (Y >= 50) & (Y < 50 + 6 - (np.abs(Z - 35) / 6) - (np.abs(X + 0.5 - BX) / 6))
    g.where(heap, C("iron", 1))
    g.a[heap & (rng.random(g.shape) < 0.3)] = C("iron", 3)
    disc(g, "y", BX, 76, 3, 50, 53, "iron", 3, n=8)  # water filler
    underframe(g, 6, 92, y0=13, y1=20, half=21, ramp=(trim, 3))
    ends(g, L, front=False)
    g.box(BX - 3, 8, 0, BX + 3, 12, 6, C("iron", 2))  # drawbar from the engine
    return Stock(name, "tender", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 22, 6), Axle("wheel-a2", 48, 6), Axle("wheel-a3", 74, 6)], guides=(22, 74),
                 sockets=[("socket-load", (BX, 50, 35))], data={"carries": "coal and water"})


# ---------------------------------------------------------------- shared steam parts (local helpers)
def _nodome(*_a) -> None:
    """dome() painter that leaves the dome its base colour."""


def _boiler(g, z0, z1, by, br, paint, trim, accent, bands=(), smokebox=None, n=16):
    """Boiler barrel from z0 to z1 on axis height `by`, with painted bands, and
    an optional smokebox (z0 - 2 .. smokebox) in fixed iron with a door."""
    X, Y, Z = coords(g)
    m = disc(g, "z", BX, by, br, z0, z1, paint, 4, n=n)
    for zb in bands:
        P.flat(g, m & (Z >= zb) & (Z < zb + 2), trim, 3)
        P.flat(g, m & ((Z == zb - 1) | (Z == zb + 2)), accent, 5)
    if smokebox:
        sb = disc(g, "z", BX, by, br + 0.5, z0 - 2, smokebox, "iron", 3, n=n)
        P.flat(g, sb & (Z == z0 - 2) & (np.hypot(X + 0.5 - BX, Y + 0.5 - by) < br * 0.7), "iron", 2)
        P.flat(g, sb & (Z == z0 - 2) & (np.abs(Y + 0.5 - by) < 0.8), "steel", 5)
    return m


def _cab(g, z0, z1, y0, eave, roof, paint, accent, wood=False):
    """A cab with side windows, front spectacle glasses and a dark roof."""
    X, Y, Z = coords(g)
    g.prism("z", [(BX - 21, y0), (BX + 21, y0), (BX + 21, eave), (BX + 15, roof), (BX - 15, roof), (BX - 21, eave)], z0, z1, C(paint, 4))
    m = last(g)
    if wood:
        P.flat(g, m & (Y < eave), "wood", 4)
        P.flat(g, m & (Y < eave) & ((Z - z0) % 4 == 0), "wood", 3)
    P.flat(g, m & (Y >= eave), "iron", 3)
    for x in (BX - 21, BX + 20):
        glass(g, m & (X == x) & (Z >= z0 + 4) & (Z < z1 - 6) & (Y >= eave - 14) & (Y < eave - 3))
        P.flat(g, m & (X == x) & (Y >= y0 + 2) & (Y < y0 + 4), accent, 5)
    glass(g, m & (Z == z0) & (Y >= eave - 10) & (Y < eave - 2) & (np.abs(X + 0.5 - BX) > 7) & (np.abs(X + 0.5 - BX) < 17))
    return m


def _cylinders(g, z0, z1, y, r, ramp, slide_to, x=20):
    """Outside cylinders on both sides, with slide bars back to `slide_to`."""
    for sx in (-1, 1):
        disc(g, "z", BX + sx * x, y, r, z0, z1, ramp, 3, n=10)
        g.box(BX + sx * x - 1, y - 1, z1, BX + sx * x + 1, y + 1, slide_to, C("steel", 6))


def _footplate(g, z0, z1, y, ramp, accent, half=22):
    X, Y, Z = coords(g)
    g.box(BX - half, y, z0, BX + half, y + 3, z1, C(ramp, 3))
    P.flat(g, (g.a > 0) & (Y == y) & ((X == BX - half) | (X == BX + half - 1)) & (Z >= z0) & (Z < z1), accent, 5)


def _coal(g, x_half, z0, z1, y0, h, seed=3):
    X, Y, Z = coords(g)
    zc = (z0 + z1) / 2
    heap = (np.abs(X + 0.5 - BX) < x_half) & (Z >= z0) & (Z < z1) & (Y >= y0) & (Y < y0 + h - np.abs(Z - zc) / 6 - np.abs(X + 0.5 - BX) / 6)
    g.where(heap, C("iron", 1))
    g.a[heap & (np.random.default_rng(seed).random(g.shape) < 0.3)] = C("iron", 3)


def _sockets(smoke, cyl_z, cyl_y, light, cab, x=20):
    return [("socket-smoke", smoke), ("socket-steam-l", (BX - x, cyl_y, cyl_z)), ("socket-steam-r", (BX + x, cyl_y, cyl_z)),
            ("socket-light-f", light), ("socket-cab", cab)]


# ---------------------------------------------------------------- early pioneer engine
def pioneer(name="steam-pioneer-0-2-2", paint="gold", trim="arcane", accent="skin") -> Stock:
    """An early 0-2-2 engine: one big driving wheel at the front, a small
    barrel boiler between the wheels, a very tall chimney, cylinders sloping
    down from the back of the boiler and an open footplate with a hand rail."""
    L = 96
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    by, br = 30, 9
    _boiler(g, 12, 70, by, br, paint, trim, accent, bands=(28, 46, 62), smokebox=18, n=14)
    disc(g, "y", BX, 14, 3.2, by + br - 2, 64, "iron", 2, n=10)  # tall chimney
    cone(g, "y", BX, 14, 3.4, 64, 70, "iron", 3, n=10, r_top=5.0)  # flared crown
    g.box(BX - 11, 20, 68, BX + 11, 44, 82, C(paint, 4))  # firebox
    dome(g, BX, 75, 44, 7, h=6, n=10, rings=2, ramp="ember", base=5, painter=_nodome, ribs=None)
    for sx in (-1, 1):  # cylinders on the back of the boiler, sloping down toward the big driver
        bar(g, "x", (40, 66), (30, 52), 5, BX + sx * 12 - 2, BX + sx * 12 + 2, paint, 3)
        bar(g, "x", (31, 53), (22, 38), 1.6, BX + sx * 19 - 1, BX + sx * 19 + 1, "steel", 6)  # connecting rod to the crank
    g.box(BX - 12, 14, 6, BX + 12, 20, 92, C("darkwood", 4))  # timber frame
    _footplate(g, 82, 92, 20, trim, accent, half=20)
    for sx in (-1, 1):  # hand rail
        g.box(BX + sx * 18 - 1, 23, 84, BX + sx * 18 + 1, 38, 86, C("steel", 5))
        g.box(BX + sx * 18 - 1, 36, 84, BX + sx * 18 + 1, 38, 92, C("steel", 5))
    ends(g, L, beam=("darkwood", 4), rear=False)
    g.box(BX - 3, 8, L - 4, BX + 3, 12, L, C("iron", 2))
    round_lamp(g, BX, 26, 10, r=2.0, lens=("sand", 7))
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-d1", 30, 18, dict(face=(paint, 3), spokes=16)), Axle("wheel-t1", 72, 9, dict(face=(paint, 3), spokes=10))],
                 guides=(30, 72), powered=True, idle="steam",
                 sockets=_sockets((BX, 70, 14), 60, 36, (BX, 26, 8), (BX, 38, 92), x=12),
                 data={"traction": "steam", "wheelArrangement": "0-2-2", "tender": "tender-pioneer"})


def tender_pioneer(name="tender-pioneer", paint="gold", trim="arcane", accent="skin") -> Stock:
    """A small four-wheel tender: a timber frame, a barrel water tank and a heap of coal."""
    L = 64
    g = Grid(BW, 48, L + 1)
    X, Y, Z = coords(g)
    g.box(BX - 20, 12, 5, BX + 20, 22, 59, C("darkwood", 4))
    P.flat(g, (g.a > 0) & (Y >= 12) & (Y < 22) & ((Z - 5) % 6 == 0), "darkwood", 3)
    g.box(BX - 21, 22, 5, BX + 21, 24, 59, C(trim, 3))
    tank = disc(g, "z", BX, 33, 10, 30, 57, paint, 4, n=12)
    P.flat(g, tank & ((Z == 33) | (Z == 44) | (Z == 54)), accent, 5)
    _coal(g, 16, 6, 30, 24, 10, seed=11)
    ends(g, L, front=False, beam=("darkwood", 4))
    g.box(BX - 3, 8, 0, BX + 3, 12, 5, C("iron", 2))
    return Stock(name, "tender", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 18, 9), Axle("wheel-a2", 46, 9)], guides=(18, 46),
                 sockets=[("socket-load", (BX, 24, 18))], data={"carries": "coal and water"})


# ---------------------------------------------------------------- western 4-4-0
def _cowcatcher(g, z_back, y_top, ramp):
    """A slatted pilot in a forward V, reaching down to the rails ahead of the wheels."""
    for xk in range(-20, 21, 4):
        reach = max(1.5, z_back - 1 - (16 - abs(xk) * 0.7))
        bar(g, "x", (y_top, z_back), (1.5, reach), 2.0, BX + xk - 1, BX + xk + 1, ramp, 4)
    g.box(BX - 21, y_top - 2, z_back - 2, BX + 21, y_top + 1, z_back, C("steel", 4))


def western(name="steam-western-4-4-0", paint="red", trim="forest", accent="gold") -> Stock:
    """A 4-4-0 frontier engine: a balloon smokestack, a big box headlamp, a
    slatted cowcatcher, a wooden cab, brass domes and red wheels."""
    L = 128
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    by, br = 40, 11
    _boiler(g, 16, 102, by, br, trim, paint, accent, bands=(40, 62, 84), smokebox=26, n=14)
    disc(g, "y", BX, 20, 3.0, by + br - 2, by + br + 6, "iron", 2, n=10)  # balloon stack: narrow neck ...
    cone(g, "y", BX, 20, 3.0, by + br + 6, by + br + 15, "iron", 3, n=12, r_top=7.5)  # ... flaring wide ...
    disc(g, "y", BX, 20, 7.5, by + br + 15, by + br + 17, "iron", 2, n=12)  # ... under a spark-arrester cap
    dome(g, BX, 56, by + br - 2, 5, h=7, n=10, rings=2, ramp="ember", base=5, painter=_nodome, ribs=None)
    dome(g, BX, 80, by + br - 2, 4, h=5, n=10, rings=2, ramp="ember", base=6, painter=_nodome, ribs=None)
    # big box headlamp on the smokebox front
    g.box(BX - 5, by + 6, 15, BX + 5, by + 16, 24, C(paint, 4))
    g.box(BX - 6, by + 15, 14, BX + 6, by + 17, 25, C("iron", 3))
    g.box(BX - 3, by + 8, 14, BX + 3, by + 14, 15, C("sand", 7))
    _cab(g, 100, 124, 26, 58, 66, paint, accent, wood=True)
    _footplate(g, 12, 124, 23, "iron", accent, half=21)
    _cylinders(g, 26, 40, 18, 4.0, paint, 46)
    _cowcatcher(g, 14, 16, paint)
    g.box(BX - 21, 8, 12, BX + 21, 17, 16, C(paint, 4))  # buffer beam above the pilot
    g.box(BX - 3, 8, 0, BX + 3, 12, 14, C("iron", 2))  # coupler through the pilot
    underframe(g, 14, 124, y0=12, y1=23, half=11, ramp=("iron", 2))
    g.box(BX - 3, 8, L - 4, BX + 3, 12, L, C("iron", 2))
    face = dict(face=(paint, 4), **DRIVER)
    rods = Rods(["wheel-d1", "wheel-d2"], "wheel-d1", crank=5, slide_y=18, main_len=24, x=20)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 30, r=6, wheelbase=18)],
                 axles=[Axle("wheel-d1", 70, 12, face), Axle("wheel-d2", 98, 12, face)], guides=(30, 98), rods=rods,
                 powered=True, idle="steam",
                 sockets=_sockets((BX, by + br + 17, 20), 28, 18, (BX, by + 11, 14), (BX, 52, 100)),
                 data={"traction": "steam", "wheelArrangement": "4-4-0", "tender": "tender-western"})


def tender_western(name="tender-western", paint="red", trim="forest", accent="gold") -> Stock:
    """An eight-wheel tender on two bogies: a flared coal rail over a straight-sided tank."""
    L = 96
    g = Grid(BW, 56, L + 1)
    X, Y, Z = coords(g)
    g.prism("z", [(BX - 21, 20), (BX + 21, 20), (BX + 21, 44), (BX + 22, 48), (BX - 22, 48), (BX - 21, 44)], 6, 92, C(trim, 4))
    tm = last(g)
    P.flat(g, tm & ((Y == 22) | (Y == 42)), accent, 5)
    P.flat(g, tm & (Y >= 44), paint, 4)
    _coal(g, 18, 10, 58, 48, 7, seed=5)
    underframe(g, 6, 92, y0=14, y1=20, half=21, ramp=("iron", 3))
    ends(g, L, front=False, beam=(paint, 4))
    g.box(BX - 3, 8, 0, BX + 3, 12, 6, C("iron", 2))
    return Stock(name, "tender", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 24, r=6, wheelbase=18), Bogie("r", 72, r=6, wheelbase=18)],
                 sockets=[("socket-load", (BX, 48, 34))], data={"carries": "coal and water"})


# ---------------------------------------------------------------- tank engine
def tank_engine(name="steam-tank-0-6-0", paint="magenta", trim="arcane", accent="gold") -> Stock:
    """A 0-6-0 tank engine: side tanks along the boiler, a coal bunker behind
    the cab instead of a tender, three small coupled drivers."""
    L = 96
    g = Grid(BW, 70, L + 1)
    X, Y, Z = coords(g)
    by, br = 34, 10
    _boiler(g, 12, 70, by, br, paint, trim, accent, smokebox=20, n=14)
    disc(g, "y", BX, 15, 3.5, by + br - 2, by + br + 10, "iron", 2, n=10)  # chimney
    disc(g, "y", BX, 15, 4.5, by + br + 9, by + br + 11, "iron", 3, n=10)
    dome(g, BX, 34, by + br - 2, 4, h=5, n=10, rings=2, ramp="ember", base=5, painter=_nodome, ribs=None)
    tanks = np.zeros(g.shape, bool)
    for sx in (-1, 1):  # side tanks, lined
        x0, x1 = sorted((BX + sx * 11, BX + sx * 22))
        g.box(x0, 22, 24, x1, 44, 68, C(paint, 4))
        tanks |= (X >= x0) & (X < x1) & (Y >= 22) & (Y < 44) & (Z >= 24) & (Z < 68)
    side = tanks & ((X == BX - 22) | (X == BX + 21))
    P.flat(g, side & ((Y == 24) | (Y == 41) | (Z == 26) | (Z == 65)), accent, 5)
    P.flat(g, tanks & (Y == 43), trim, 3)
    _cab(g, 68, 86, 22, 54, 62, paint, accent)
    g.box(BX - 21, 22, 86, BX + 21, 40, 92, C(paint, 4))  # bunker
    _coal(g, 18, 86, 92, 40, 5, seed=9)
    _footplate(g, 6, 92, 19, trim, accent, half=22)
    _cylinders(g, 8, 20, 15, 4.0, paint, 24)
    underframe(g, 6, 92, y0=11, y1=19, half=11, ramp=("iron", 2))
    ends(g, L, beam=(accent, 4))
    round_lamp(g, BX, 24, 6, r=2.0, lens=("sand", 7))
    face = dict(face=(paint, 3), spokes=12, counterweight=True)
    rods = Rods(["wheel-d1", "wheel-d2", "wheel-d3"], "wheel-d2", crank=4, slide_y=15, main_len=26, x=20)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-d1", 26, 9, face), Axle("wheel-d2", 48, 9, face), Axle("wheel-d3", 70, 9, face)],
                 guides=(26, 70), rods=rods, powered=True, idle="steam",
                 sockets=_sockets((BX, by + br + 11, 15), 10, 15, (BX, 24, 4), (BX, 48, 68)),
                 data={"traction": "steam", "wheelArrangement": "0-6-0T", "carries": "coal and water"})


# ---------------------------------------------------------------- streamlined express
def streamlined(name="steam-streamlined-blue", paint="blue", trim="khaki", accent="red") -> Stock:
    """A streamlined 4-6-2: a wedge-nosed casing over the boiler that sweeps
    back into the cab, valances skirting the wheels, a silver band and red wheels."""
    from shapes import loft

    L = 160
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    casing = loft(g, [(4, 9, 20, 40), (12, 16, 18, 52), (26, 20, 18, 60), (44, 21, 18, 62), (125, 21, 18, 62)], paint, 4, p=2.6, n=20)
    P.flat(g, casing & (Z < 14) & (Y < 34), "iron", 3)  # dark nose
    P.flat(g, casing & (Y >= 33) & (Y < 36), trim, 5)  # silver band
    P.flat(g, casing & (Y >= 36) & (Y < 37), accent, 5)
    cab = _cab(g, 124, 156, 18, 60, 66, paint, accent)
    P.flat(g, cab & (Y >= 33) & (Y < 36), trim, 5)
    for sx in (-1, 1):  # valances over the wheel tops
        x0, x1 = sorted((BX + sx * 20, BX + sx * 22))
        g.box(x0, 18, 22, x1, 30, 124, C(paint, 3))
    P.flat(g, (g.a > 0) & (Y == 18) & ((X == BX - 22) | (X == BX + 21)), trim, 5)
    for sx in (-1, 1):  # cylinders tucked under the valance, slide bars behind
        disc(g, "z", BX + sx * 17, 14, 3.5, 26, 42, "iron", 3, n=10)
        g.box(BX + sx * 17 - 1, 13, 42, BX + sx * 17 + 1, 15, 52, C("steel", 6))
    underframe(g, 8, 156, y0=13, y1=18, half=12, ramp=("iron", 2))
    ends(g, L, beam=("iron", 3), rear=False, buffers=False)
    g.box(BX - 3, 8, L - 4, BX + 3, 12, L, C("iron", 2))
    round_lamp(g, BX, 30, 6, r=2.4, lens=("sand", 7))
    face = dict(face=(accent, 4), **DRIVER)
    rods = Rods(["wheel-d1", "wheel-d2", "wheel-d3"], "wheel-d2", crank=5, slide_y=14, main_len=42, x=20)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28, r=6, wheelbase=18)],
                 axles=[Axle("wheel-d1", 62, 12, face), Axle("wheel-d2", 88, 12, face), Axle("wheel-d3", 114, 12, face), Axle("wheel-t1", 142, 6)],
                 guides=(28, 142), rods=rods, powered=True, idle="steam",
                 sockets=_sockets((BX, 62, 30), 26, 14, (BX, 30, 4), (BX, 52, 124), x=17),
                 data={"traction": "steam", "wheelArrangement": "4-6-2", "tender": "tender-streamlined-blue"})


def tender_streamlined(name="tender-streamlined-blue", paint="blue", trim="khaki", accent="red") -> Stock:
    """The streamliner's tender: smooth tall sides and a band matching the engine."""
    L = 96
    g = Grid(BW, 64, L + 1)
    X, Y, Z = coords(g)
    g.prism("z", [(BX - 21, 14), (BX + 21, 14), (BX + 21, 54), (BX + 17, 60), (BX - 17, 60), (BX - 21, 54)], 6, 92, C(paint, 4))
    tm = last(g)
    P.flat(g, tm & (Y >= 33) & (Y < 36), trim, 5)
    P.flat(g, tm & (Y >= 36) & (Y < 37), accent, 5)
    P.flat(g, tm & (Y < 15), "iron", 3)
    _coal(g, 14, 10, 40, 60, 4, seed=7)
    underframe(g, 6, 92, y0=10, y1=14, half=20, ramp=("iron", 3))
    ends(g, L, front=False, beam=("iron", 3), buffers=False)
    g.box(BX - 3, 8, 0, BX + 3, 12, 6, C("iron", 2))
    return Stock(name, "tender", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 22, 6), Axle("wheel-a2", 48, 6), Axle("wheel-a3", 74, 6)], guides=(22, 74),
                 sockets=[("socket-load", (BX, 60, 25))], data={"carries": "coal and water"})


# ---------------------------------------------------------------- giant articulated
def articulated(name="steam-articulated-giant", paint="arcane", trim="khaki", accent="gold") -> Stock:
    """A giant articulated freight engine (2-4-4-2 in toy proportions): two
    sets of drivers, each with its own cylinders, under one huge boiler."""
    L = 160
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    by, br = 40, 14
    _boiler(g, 12, 122, by, br, paint, trim, accent, bands=(44, 76, 104), smokebox=26, n=16)
    P.flat(g, (g.a > 0) & (Z == 10) & (np.hypot(X + 0.5 - BX, Y + 0.5 - by) < 14.5), trim, 5)  # silver smokebox front
    P.flat(g, (g.a > 0) & (Z == 10) & (np.hypot(X + 0.5 - BX, Y + 0.5 - by) < 9), "iron", 2)
    disc(g, "y", BX, 18, 4.5, by + br - 2, 64, "iron", 2, n=10)  # short stack
    for zd in (56, 88):
        dome(g, BX, zd, by + br - 2, 5, h=5, n=10, rings=2, ramp="ember", base=5, painter=_nodome, ribs=None)
    _cab(g, 120, 156, 22, 60, 68, paint, accent)
    _footplate(g, 8, 156, 20, paint, accent, half=22)
    _cylinders(g, 14, 28, 16, 4.0, paint, 34)  # front engine unit
    _cylinders(g, 74, 86, 16, 4.0, paint, 90)  # rear engine unit
    underframe(g, 8, 156, y0=11, y1=20, half=11, ramp=("iron", 2))
    ends(g, L, beam=(accent, 4), rear=False)
    g.box(BX - 3, 8, L - 4, BX + 3, 12, L, C("iron", 2))
    round_lamp(g, BX, by + 4, 10, r=3.0, lens=("sand", 7))
    face = dict(face=(paint, 5), spokes=10, counterweight=True)
    rods = [Rods(["wheel-d1", "wheel-d2"], "wheel-d2", crank=4, slide_y=16, main_len=28, x=20, tag=""),
            Rods(["wheel-d3", "wheel-d4"], "wheel-d4", crank=4, slide_y=16, main_len=28, x=20, tag="b")]
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-l1", 18, 6), Axle("wheel-d1", 40, 9, face), Axle("wheel-d2", 62, 9, face),
                        Axle("wheel-d3", 92, 9, face), Axle("wheel-d4", 114, 9, face), Axle("wheel-t1", 140, 6)],
                 guides=(18, 140), rods=rods, powered=True, idle="steam",
                 sockets=_sockets((BX, 64, 18), 16, 16, (BX, by + 4, 8), (BX, 52, 120)),
                 data={"traction": "steam", "wheelArrangement": "2-4-4-2", "articulated": True, "tender": "tender-articulated-giant"})


def tender_articulated(name="tender-articulated-giant", paint="arcane", trim="khaki", accent="gold") -> Stock:
    """A long tender on two bogies for the giant engine: a big coal space and a deep tank."""
    L = 128
    g = Grid(BW, 64, L + 1)
    X, Y, Z = coords(g)
    g.prism("z", [(BX - 21, 18), (BX + 21, 18), (BX + 21, 52), (BX + 19, 56), (BX - 19, 56), (BX - 21, 52)], 6, 124, C(paint, 4))
    tm = last(g)
    P.flat(g, tm & ((Y == 20) | (Y == 50)), accent, 5)
    _coal(g, 17, 10, 70, 56, 7, seed=13)
    disc(g, "y", BX, 104, 3.5, 56, 59, "iron", 3, n=8)
    underframe(g, 6, 124, y0=13, y1=18, half=21, ramp=("iron", 3))
    ends(g, L, front=False, beam=(accent, 4))
    g.box(BX - 3, 8, 0, BX + 3, 12, 6, C("iron", 2))
    return Stock(name, "tender", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28, r=6, wheelbase=20), Bogie("r", 100, r=6, wheelbase=20)],
                 sockets=[("socket-load", (BX, 56, 40))], data={"carries": "coal and water"})


CATALOG = [
    stock("steam-locomotives", express, tier="slice"),
    stock("steam-locomotives", tender, tier="slice"),
    stock("steam-locomotives", pioneer),
    stock("steam-locomotives", tender_pioneer),
    stock("steam-locomotives", western),
    stock("steam-locomotives", tender_western),
    stock("steam-locomotives", tank_engine),
    stock("steam-locomotives", streamlined),
    stock("steam-locomotives", tender_streamlined),
    stock("steam-locomotives", articulated),
    stock("steam-locomotives", tender_articulated),
]
