"""Freight wagons. Most are class M (128 between coupler faces) on two
bogies; the caboose and the brake van are class S (96).

Wagons that carry a load expose `socket-load` on the deck with data
`loadClass` (what they accept); the loads are separate models (loads.py), and
a load's own `loadClass` names the wagons that carry it.
"""
from __future__ import annotations

import numpy as np

import pnpaint
from catalog import stock
from furniture import ends, underframe
from pnshapes import bar, cone, disc
from railkit import C, Grid, P, Part, coords
from shapes import BW, BX, car_profile, extrude, glass
from stock import Axle, Bogie, Stock

L = 128
BOGIES = [Bogie("f", 24), Bogie("r", 104)]


def _ramp_keys(t1: float, v0, v1, steps: int = 8):
    out = []
    for k in range(steps + 1):
        f = k / steps
        f = f * f * (3 - 2 * f)
        out.append((t1 * k / steps, tuple(a + (b - a) * f for a, b in zip(v0, v1))))
    return out


def _door_leaf(name: str, side: str, plane_x: float, z0: int, z1: int, y0: int, y1: int, slide: float, paint, trim, accent):
    """A sliding door leaf 1 voxel proud of a side face, framed in the trim
    colour with a handle bar; returns (Part, open keys, close keys)."""
    g = Grid(1, y1 - y0, z1 - z0)
    g.box(0, 0, 0, 1, y1 - y0, z1 - z0, C(paint, 4))
    X, Y, Z = coords(g)
    P.flat(g, (Z == 0) | (Z == z1 - z0 - 1) | (Y == 0) | (Y == y1 - y0 - 1), trim, 6)
    P.flat(g, (Y >= 14) & (Y < 17) & (Z > 0) & (Z < z1 - z0 - 1), accent, 5)
    P.flat(g, ((Z - (Y * (z1 - z0) // (y1 - y0))) == 0) & (Y > 0) & (Y < y1 - y0 - 1), paint, 3)  # diagonal brace
    x = plane_x - 1 if side == "-x" else plane_x
    part = Part(name, g, pivot=(0, 0, 0), at=(x, y0, z0))
    return part, {"loc": _ramp_keys(0.9, (0, 0, 0), (0, 0, slide))}, {"loc": _ramp_keys(0.9, (0, 0, slide), (0, 0, 0))}


def boxcar(name="wagon-boxcar", paint="blood", trim="bone", accent="gold") -> Stock:
    """A tall covered goods wagon with ribbed sides and a sliding door on
    each side (`open` slides them back, `close` shuts them)."""
    g = Grid(BW, 64, L + 1)
    shell = extrude(g, car_profile(22, 15, 54, 58, round_=0.4), 6, 122, paint, 3)
    X, Y, Z = coords(g)
    sides = shell & ((X == BX - 22) | (X == BX + 21))
    P.flat(g, sides & ((Z - 6) % 10 == 0), paint, 2)  # ribs
    P.flat(g, shell & (Y >= 54), "gray", 4)  # roof
    door = sides & (Z >= 52) & (Z < 76) & (Y >= 16) & (Y < 52)
    P.flat(g, door, "iron", 1)  # the dark doorway the leaf slides away from
    P.flat(g, sides & (Z >= 28) & (Z < 76) & ((Y == 15) | (Y == 52)), "steel", 5)  # door rails
    P.flat(g, shell & (Y < 15), "iron", 3)
    underframe(g, 6, 122, y0=11, y1=15)
    ends(g, L)
    parts, opening, closing = [], {}, {}
    for nm, side, px in (("door-l", "-x", BX - 22), ("door-r", "+x", BX + 22)):
        part, o, c = _door_leaf(nm, side, px, 52, 76, 16, 52, -24, paint, trim, accent)
        parts.append(part)
        opening[nm], closing[nm] = o, c
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 extra_parts=parts, extra_clips={"open": opening, "close": closing}, data={"doors": 2})


def flatcar(name="wagon-flatcar", paint="arcane", trim="gold", accent="red") -> Stock:
    """An open flat wagon with stake pockets; carries any load on `socket-load`."""
    g = Grid(BW, 24, L + 1)
    deck = extrude(g, [(BX - 22, 13), (BX + 22, 13), (BX + 22, 18), (BX - 22, 18)], 6, 122, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, deck & (Y == 17), "wood", 4)  # timber deck
    P.flat(g, deck & (Y == 17) & ((Z - 6) % 6 == 0), "wood", 2)
    P.flat(g, deck & ((X == BX - 22) | (X == BX + 21)) & (Y >= 14) & (Y < 16), trim, 5)
    for z in range(14, 118, 16):  # stake pockets
        for x in (BX - 23, BX + 22):
            g.box(x, 12, z, x + 1, 17, z + 2, C(accent, 3))
    underframe(g, 6, 122, y0=9, y1=13)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-load", (BX, 18, L / 2))], data={"loadClass": "flat", "deck": 18})


def _end_ladders(g, body, z_front, z_rear, ramp, shade=5) -> None:
    """Ladder rungs and stiles painted on both end faces."""
    X, Y, Z = coords(g)
    for zf in (z_front, z_rear):
        face = body & (Z == zf)
        for xs in (BX - 18, BX + 15):
            P.flat(g, face & (X >= xs) & (X < xs + 4) & (((Y % 4) == 0) | (X == xs) | (X == xs + 3)), ramp, shade)


def covered_hopper(name="wagon-covered-hopper", paint="bone", trim="red", accent="arcane") -> Stock:
    """A covered hopper for grain or cement: a round-roofed body with side
    posts, a roof walkway with loading hatches, and two hopper bays that
    discharge between the bogies."""
    g = Grid(BW, 64, L + 1)
    body = extrude(g, car_profile(21, 18, 46, 54, round_=1.0), 8, 120, paint, 4)
    X, Y, Z = coords(g)
    sides = body & ((X == BX - 21) | (X == BX + 20))
    P.flat(g, sides & ((Z - 8) % 14 == 0), paint, 2)  # side posts
    P.flat(g, sides & (Y == 18), paint, 2)
    P.flat(g, body & (Y >= 52) & (np.abs(X + 0.5 - BX) < 3), "steel", 5)  # roof walkway
    for zc in range(18, 114, 16):  # loading hatches either side of the walkway
        P.flat(g, body & (Y >= 50) & (np.abs(X + 0.5 - BX) >= 4) & (np.abs(X + 0.5 - BX) < 10) & (np.abs(Z + 0.5 - zc) < 4), accent, 3)
    for zc in (55, 73):  # hopper bays: frustums narrowing to an outlet gate
        g.prism("y", [(BX - 6, zc - 4), (BX + 6, zc - 4), (BX + 6, zc + 4), (BX - 6, zc + 4)], 6, 18, C(paint, 3),
                top=[(BX - 20, zc - 9), (BX + 20, zc - 9), (BX + 20, zc + 9), (BX - 20, zc + 9)])
        g.box(BX - 5, 3, zc - 3, BX + 5, 6, zc + 3, C("iron", 3))
    underframe(g, 6, 122, y0=13, y1=18, half=5)
    _end_ladders(g, body, 8, 119, trim)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 data={"carries": "bulk"})


def tank_wagon(name="wagon-tank", paint="arcane", trim="skin", accent="red") -> Stock:
    """A tank wagon: a long round tank on saddles with dished ends, a dome
    and valve on top, a handrail band and a placard on each side."""
    g = Grid(BW, 64, L + 1)
    ty, tr = 31, 14
    tank = disc(g, "z", BX, ty, tr, 12, 116, paint, 3, n=16)
    cone(g, "z", BX, ty, tr, 116, 120, paint, 2, n=16, r_top=10, tip="hi")
    cone(g, "z", BX, ty, tr, 8, 12, paint, 2, n=16, r_top=10, tip="lo")
    X, Y, Z = coords(g)
    P.flat(g, tank & (Y == ty - 1), trim, 6)  # handrail band
    P.flat(g, tank & (Z >= 60) & (Z < 68) & (np.abs(Y + 0.5 - ty) < 4) & ((X == BX - 15) | (X == BX + 14)), trim, 6)  # placard
    P.flat(g, tank & ((Z == 12) | (Z == 115)), paint, 2)
    disc(g, "y", BX, 64, 6, ty + tr - 1, ty + tr + 5, paint, 3, n=10)  # dome
    disc(g, "y", BX, 64, 7, ty + tr + 5, ty + tr + 6, paint, 2, n=10)
    disc(g, "y", BX, 64, 2.2, ty + tr + 6, ty + tr + 8, accent, 4, n=8)  # valve wheel
    for z0 in (20, 100):  # saddles over the bolsters
        g.box(BX - 12, 14, z0, BX + 12, 20, z0 + 8, C("iron", 3))
    underframe(g, 6, 122, y0=11, y1=15, half=16)
    g.box(BX - 22, 14, 56, BX + 22, 16, 72, C("steel", 4))  # walkway platforms at the dome
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 data={"carries": "liquid"})


def gondola(name="wagon-gondola", paint="blood", trim="gold", accent="arcane") -> Stock:
    """An open gondola for coal, scrap or ballast: low steel sides with
    outside ribs; a load (load-coal) sits on the floor at `socket-load`."""
    g = Grid(BW, 40, L + 1)
    g.box(BX - 22, 13, 6, BX + 22, 17, 122, C(paint, 3))  # floor
    for x0, x1 in ((BX - 22, BX - 20), (BX + 20, BX + 22)):
        g.box(x0, 17, 6, x1, 34, 122, C(paint, 4))
    g.box(BX - 20, 17, 6, BX + 20, 34, 8, C(paint, 4))
    g.box(BX - 20, 17, 120, BX + 20, 34, 122, C(paint, 4))
    for z in range(10, 120, 12):  # outside ribs
        for x in (BX - 23, BX + 22):
            g.box(x, 15, z, x + 1, 34, z + 2, C(paint, 2))
    X, Y, Z = coords(g)
    solid = g.a > 0
    P.flat(g, solid & (Y == 33), accent, 3)  # top chord
    P.flat(g, solid & (Y == 16) & (X > BX - 20) & (X < BX + 20) & (Z > 7) & (Z < 120), paint, 1)  # floor inside
    P.flat(g, solid & ((X == BX - 23) | (X == BX + 22) | (X == BX - 22) | (X == BX + 21)) & (Y >= 22) & (Y < 25) & (Z >= 52) & (Z < 76), trim, 6)
    underframe(g, 6, 122, y0=9, y1=13)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-load", (BX, 17, L / 2))], data={"loadClass": "gondola", "deck": 17})


def livestock_car(name="wagon-livestock", paint="blood", trim="bone", accent="arcane") -> Stock:
    """A slatted livestock car: open slats along the sides for air, a
    braced sliding door and a peaked roof."""
    g = Grid(BW, 64, L + 1)
    shell = extrude(g, car_profile(22, 15, 52, 57, round_=0.4), 6, 122, paint, 4)
    X, Y, Z = coords(g)
    sides = shell & ((X == BX - 22) | (X == BX + 21))
    slats = sides & (Y >= 18) & (Y < 50)
    P.flat(g, slats & (((Y - 18) % 4) >= 2), "darkwood", 1)  # the gaps between slats
    P.flat(g, sides & ((Z - 6) % 12 == 0) & (Y >= 15), paint, 2)  # posts
    P.flat(g, sides & ((Y == 17) | (Y == 50)), paint, 2)
    door = sides & (Z >= 52) & (Z < 76) & (Y >= 17) & (Y < 51)
    P.flat(g, door, paint, 5)
    P.flat(g, door & ((Z == 52) | (Z == 75) | (Y == 17) | (Y == 50)), trim, 6)
    P.flat(g, door & (np.abs((Z - 52) - (Y - 17) * 23 / 33) < 0.8), trim, 5)  # diagonal brace
    P.flat(g, shell & (Y >= 52), "gray", 4)
    P.flat(g, shell & (Y < 16), accent, 3)
    underframe(g, 6, 122, y0=11, y1=15)
    _end_ladders(g, shell, 6, 121, trim)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 data={"carries": "livestock"})


def refrigerator_car(name="wagon-refrigerator", paint="gold", trim="orange", accent="arcane") -> Stock:
    """An insulated refrigerator car: smooth bright sides, a heavy plug door
    with lever bars and hinges, and ice hatches at the roof corners."""
    g = Grid(BW, 64, L + 1)
    shell = extrude(g, car_profile(22, 15, 53, 57, round_=0.4), 6, 122, paint, 5)
    X, Y, Z = coords(g)
    sides = shell & ((X == BX - 22) | (X == BX + 21))
    P.flat(g, sides & (Y >= 46) & (Y < 53), trim, 4)  # a band along the top
    P.flat(g, sides & (Y < 18), trim, 4)
    door = sides & (Z >= 54) & (Z < 74) & (Y >= 18) & (Y < 46)
    P.flat(g, door, paint, 4)
    P.flat(g, door & ((Z <= 55) | (Z >= 72) | (Y <= 19) | (Y >= 44)), paint, 3)  # the plug's thick frame
    for zb in (58, 69):  # lever bars
        P.flat(g, door & (Z == zb) & (Y >= 21) & (Y < 42), accent, 3)
    for yh in (24, 38):  # hinges
        P.flat(g, sides & (Z >= 52) & (Z < 56) & (Y >= yh) & (Y < yh + 2), accent, 3)
    P.flat(g, shell & (Y >= 53), "gray", 5)
    top = shell & (Y >= 55)
    for xc in (BX - 12, BX + 12):  # ice hatches
        for zc in (14, 114):
            P.flat(g, top & (np.abs(X + 0.5 - xc) < 4) & (np.abs(Z + 0.5 - zc) < 4), "steel", 4)
    underframe(g, 6, 122, y0=11, y1=15)
    _end_ladders(g, shell, 6, 121, accent, 3)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 data={"carries": "chilled goods"})


def container_spine(name="wagon-container-spine", paint="orange", trim="arcane", accent="gold") -> Stock:
    """A skeletal container wagon: a single centre spine with cross bearers
    and corner pedestals; one container (load-container) rides on `socket-load`."""
    g = Grid(BW, 24, L + 1)
    g.box(BX - 5, 8, 6, BX + 5, 16, 122, C(paint, 4))  # spine
    for z0 in (6, 60, 114):  # cross bearers
        g.box(BX - 21, 12, z0, BX + 21, 16, z0 + 8, C(paint, 4))
    for z0 in (6, 118):  # corner pedestals with twist-locks
        for x0 in (BX - 21, BX + 18):
            g.box(x0, 16, z0, x0 + 3, 17, z0 + 4, C(accent, 5))
    X, Y, Z = coords(g)
    solid = g.a > 0
    P.flat(g, solid & (Y == 15) & (np.abs(X + 0.5 - BX) < 5), trim, 3)  # walkway plate on the spine
    P.flat(g, solid & (Y < 10), paint, 2)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-load", (BX, 16, L / 2))], data={"loadClass": "flat", "deck": 16, "carries": "containers"})


def log_car(name="wagon-log", paint="arcane", trim="gold", accent="red") -> Stock:
    """A log wagon: a flat deck between two tall braced end bulkheads, with
    side stakes; carries load-logs on `socket-load`."""
    g = Grid(BW, 60, L + 1)
    deck = extrude(g, [(BX - 22, 13), (BX + 22, 13), (BX + 22, 18), (BX - 22, 18)], 6, 122, paint, 4)
    X, Y, Z = coords(g)
    for z0 in (8, 116):  # bulkheads: a frame with a painted lattice
        g.box(BX - 21, 18, z0, BX + 21, 56, z0 + 4, C(paint, 4))
        bh = (g.a > 0) & (Z >= z0) & (Z < z0 + 4) & (Y >= 18)
        inner = bh & (np.abs(X + 0.5 - BX) < 19) & (Y >= 21) & (Y < 53)
        P.flat(g, inner & (((X - BX) % 8 != 0) & ((Y - 21) % 8 != 0)), "iron", 1)
        P.flat(g, bh & (Y >= 53), trim, 5)
    for z in range(20, 112, 16):  # side stakes
        for x in (BX - 22, BX + 21):
            g.box(x, 18, z, x + 1, 32, z + 2, C(accent, 3))
    P.flat(g, deck & (Y == 17), "wood", 3)
    underframe(g, 6, 122, y0=9, y1=13)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-load", (BX, 18, L / 2))], data={"loadClass": "flat", "deck": 18, "carries": "logs"})


def caboose(name="wagon-caboose", paint="red", trim="gold", accent="arcane") -> Stock:
    """A short crew car for the end of a freight train: a cabin with a
    lookout cupola on the roof, railed end platforms, a stove chimney and
    red marker lamps."""
    Lc = 96
    g = Grid(BW, 72, Lc + 1)
    cabin = extrude(g, car_profile(20, 15, 46, 51, round_=0.6), 18, 78, paint, 4)
    cup = extrude(g, car_profile(12, 50, 61, 65, round_=0.5), 38, 58, paint, 4)
    extrude(g, car_profile(21, 45, 47, 52, round_=0.6), 12, 84, "gray", 4)  # roof, carried over the platforms
    X, Y, Z = coords(g)
    body = cabin | cup
    sides = body & ((X == BX - 20) | (X == BX + 19) | (X == BX - 12) | (X == BX + 11))
    P.flat(g, sides & (Y >= 26) & (Y < 28), trim, 6)
    for z in (24, 64):  # side windows
        pane = sides & (Z >= z) & (Z < z + 8) & (Y >= 30) & (Y < 40)
        P.flat(g, pane, trim, 5)
        glass(g, pane & (Z > z) & (Z < z + 7) & (Y > 30) & (Y < 39))
    glass(g, cup & ((X == BX - 12) | (X == BX + 11)) & (Y >= 54) & (Y < 60) & (((Z - 38) % 7) >= 2))  # cupola glazing
    glass(g, cup & ((Z == 38) | (Z == 57)) & (Y >= 54) & (Y < 60) & (np.abs(X + 0.5 - BX) < 9))
    P.flat(g, cup & (Y >= 61), "gray", 4)
    for zf in (18, 77):  # end doors
        P.flat(g, cabin & (Z == zf) & (np.abs(X + 0.5 - BX) < 5) & (Y >= 15) & (Y < 42), paint, 2)
        glass(g, cabin & (Z == zf) & (np.abs(X + 0.5 - BX) < 3) & (Y >= 30) & (Y < 39))
    disc(g, "y", BX + 10, 30, 1.8, 50, 60, "iron", 2, n=8)  # stove chimney
    g.box(BX - 21, 11, 6, BX + 21, 14, 90, C("wood", 3))  # platforms and floor
    for z0, z1 in ((6, 18), (78, 90)):  # platform railings, open in the middle for the steps
        for x in (BX - 21, BX + 20):
            g.box(x, 14, z0, x + 1, 30, z0 + 1, C(accent, 3))
            g.box(x, 28, z0, x + 1, 30, z1, C(accent, 3))
        zr = z0 if z0 < 18 else z1 - 1
        for xa, xb in ((BX - 21, BX - 6), (BX + 6, BX + 21)):
            g.box(xa, 28, zr, xb, 30, zr + 1, C(accent, 3))
            g.box(xa, 14, zr, xa + 1, 30, zr + 1, C(accent, 3))
        for x in (BX - 21, BX + 18):  # steps
            g.box(x, 5, z0 + 2, x + 3, 6, z0 + 6, C("iron", 3))
    for x in (BX - 20, BX + 19):  # marker lamps at the rear corners
        g.box(x, 40, 84, x + 1, 44, 86, C("ember", 5))
    underframe(g, 6, 90, y0=8, y1=11)
    ends(g, Lc, buffers=False)
    return Stock(name, "wagon", Lc, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=[Bogie("f", 24), Bogie("r", 72)],
                 sockets=[("socket-smoke", (BX + 10, 60, 30)), ("socket-light-r", (BX, 42, 86))], data={"endOfTrain": True})


def brake_van(name="wagon-brake-van", paint="khaki", trim="red", accent="arcane") -> Stock:
    """A short two-axle brake van: a guard's cabin between open verandas
    under one long roof, red ends, heavy buffers."""
    Lc = 96
    g = Grid(BW, 60, Lc + 1)
    cabin = extrude(g, car_profile(20, 15, 46, 52, round_=0.5), 24, 72, paint, 4)
    extrude(g, car_profile(21, 44, 46, 53, round_=0.5), 10, 86, "gray", 4)
    X, Y, Z = coords(g)
    P.flat(g, cabin & ((Z == 24) | (Z == 71)), trim, 4)  # red ends
    for zf in (24, 71):
        glass(g, cabin & (Z == zf) & (np.abs(X + 0.5 - (BX - 9)) < 4) & (Y >= 32) & (Y < 40))
        glass(g, cabin & (Z == zf) & (np.abs(X + 0.5 - (BX + 9)) < 4) & (Y >= 32) & (Y < 40))
        P.flat(g, cabin & (Z == zf) & (np.abs(X + 0.5 - BX) < 4) & (Y >= 15) & (Y < 42), accent, 3)  # doors
    sides = cabin & ((X == BX - 20) | (X == BX + 19))
    P.flat(g, sides & ((Z - 24) % 8 == 0), paint, 2)  # planking joints
    for z in (40, 50):
        pane = sides & (Z >= z) & (Z < z + 6) & (Y >= 32) & (Y < 40)
        P.flat(g, pane, accent, 3)
        glass(g, pane & (Z > z) & (Z < z + 5) & (Y > 32) & (Y < 39))
    g.box(BX - 21, 11, 8, BX + 21, 15, 88, C("wood", 3))  # floor and verandas
    for x in (BX - 21, BX + 20):  # veranda posts and rails
        for z in (10, 85):
            g.box(x, 15, z, x + 1, 46, z + 1, C(accent, 3))
        for z0, z1 in ((10, 24), (72, 86)):
            g.box(x, 26, z0, x + 1, 28, z1, C(accent, 3))
    for zc in (30, 66):  # axleguards outside the wheels
        for x0 in (BX - 21, BX + 18):
            g.box(x0, 3, zc - 4, x0 + 3, 12, zc + 4, C("iron", 2))
    disc(g, "y", BX - 12, 54, 1.6, 50, 57, "iron", 2, n=8)  # stove chimney
    underframe(g, 6, 90, y0=11, y1=15, half=21)
    ends(g, Lc)
    return Stock(name, "wagon", Lc, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 30, 6), Axle("wheel-a2", 66, 6)], guides=(30, 66),
                 sockets=[("socket-smoke", (BX - 12, 57, 54)), ("socket-light-r", (BX, 40, 90))], data={"endOfTrain": True})


def crane_wagon(name="wagon-crane", paint="gold", trim="arcane", accent="red") -> Stock:
    """A breakdown crane wagon: a crane house with cab windows and a striped
    counterweight, and a lattice jib lowered forward onto a rest, its hook
    block hanging at the tip."""
    g = Grid(BW, 60, L + 1)
    deck = extrude(g, [(BX - 22, 13), (BX + 22, 13), (BX + 22, 18), (BX - 22, 18)], 6, 122, trim, 3)
    house = extrude(g, [(BX - 18, 18), (BX + 18, 18), (BX + 18, 44), (BX + 14, 48), (BX - 14, 48), (BX - 18, 44)], 72, 110, paint, 4)
    X, Y, Z = coords(g)
    g.box(BX - 17, 18, 110, BX + 17, 40, 120, C(accent, 4))  # counterweight
    cw = (g.a > 0) & (Z >= 110) & (Z < 120) & (Y >= 18) & (Y < 40)
    pnpaint.hazard(g, cw, period=6, a=(accent, 4), b=("iron", 2))
    P.flat(g, house & (Y >= 44), paint, 3)
    hs = house & ((X == BX - 18) | (X == BX + 17))
    glass(g, hs & (Z >= 76) & (Z < 90) & (Y >= 32) & (Y < 41))
    glass(g, house & (Z == 72) & (np.abs(X + 0.5 - BX) < 12) & (np.abs(X + 0.5 - BX) > 3) & (Y >= 32) & (Y < 42))
    P.flat(g, hs & (Z >= 94) & (Z < 102) & (Y >= 18) & (Y < 40), paint, 2)  # door
    # the lattice jib: two booms from the house front down to a rest near the front of the wagon
    for lo, hi in ((BX - 10, BX - 6), (BX + 6, BX + 10)):
        boom = bar(g, "x", (24, 74), (33, 14), 4, lo, hi, paint, 4)
        P.flat(g, boom & (((Z + Y) % 7) == 0), paint, 2)
        P.flat(g, boom & (((Z - Y) % 7) == 0), paint, 2)
    for z0 in (14, 40):  # cross ties between the booms
        y = 33 - (z0 - 14) * 9 / 60
        g.box(BX - 6, int(y) - 1, z0, BX + 6, int(y) + 2, z0 + 3, C(paint, 3))
    for x in (BX - 9, BX + 7):  # the jib rest
        g.box(x, 18, 18, x + 2, 31, 21, C(trim, 4))
    g.box(BX - 9, 29, 18, BX + 9, 31, 21, C(trim, 4))
    g.box(BX - 1, 24, 13, BX + 1, 32, 15, C("steel", 3))  # hook cable
    g.box(BX - 3, 19, 11, BX + 3, 25, 17, C(accent, 4))  # hook block
    g.box(BX - 1, 18, 13, BX + 1, 19, 15, C("steel", 6))
    for x in (BX - 23, BX + 22):  # outriggers stowed along the sides
        g.box(x, 13, 60, x + 1, 17, 104, C(accent, 3))
    underframe(g, 6, 122, y0=9, y1=13)
    ends(g, L)
    return Stock(name, "wagon", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-cab", (BX, 36, 72))], data={"carries": "crane"})


CATALOG = [
    stock("freight-wagons", boxcar, tier="slice"),
    stock("freight-wagons", flatcar, tier="slice"),
    stock("freight-wagons", covered_hopper),
    stock("freight-wagons", tank_wagon),
    stock("freight-wagons", gondola),
    stock("freight-wagons", livestock_car),
    stock("freight-wagons", refrigerator_car),
    stock("freight-wagons", container_spine),
    stock("freight-wagons", log_car),
    stock("freight-wagons", caboose),
    stock("freight-wagons", brake_van),
    stock("freight-wagons", crane_wagon),
]
