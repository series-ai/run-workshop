"""Passenger carriages.

Generic types after well-known real ones; names describe the type only.
Every coach is class L (160 between coupler faces) on two bogies 104 apart,
floor 16 above the rail so it lines up with a platform.
"""
from __future__ import annotations

import numpy as np

from furniture import ends, equipment, underframe
from railkit import C, FLOOR_Y, Grid, P, coords
from shapes import BW, BX, band, car_profile, extrude, flat_ngon, glass, loft, side_planes, window_row
from catalog import stock
from stock import Bogie, Stock

L = 160
BOGIES = [Bogie("f", 28), Bogie("r", 132)]


def _coach_shell(g: Grid, half=21, eave=50, crown=60, z0=7, z1=153, paint="blood", shade=4, round_=1.0):
    shell = extrude(g, car_profile(half, 14, eave, crown, round_=round_), z0, z1, paint, shade)
    X, Y, Z = coords(g)
    P.flat(g, shell & (Y >= eave), "gray", 4)  # roof
    P.flat(g, shell & (Y >= crown - 2), "gray", 5)
    P.flat(g, shell & (Y < 16), "iron", 3)  # solebar
    return shell


def _gangways(g: Grid, z0: int, z1: int, y0=16, y1=50) -> None:
    """Corridor connections at both ends: a dark bellows between the coaches."""
    for a, b in ((z0 - 3, z0), (z1, z1 + 3)):
        g.box(BX - 7, y0, a, BX + 7, y1, b, C("iron", 2))


def classic_coach(name="coach-classic", paint="blood", trim="bone", accent="gold") -> Stock:
    """A wooden-bodied main-line coach in a two-tone livery: dark lower
    panels, cream upper panels, lined panels and a curved roof."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint)
    X, Y, Z = coords(g)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    upper = band(g, sides, 30, 50, trim, 5)
    P.flat(g, sides & ((Y == 29) | (Y == 30)), accent, 5)  # lining
    # panel beading: vertical lines every 12, and the waist rail
    P.flat(g, sides & (Y >= 16) & (Y < 29) & ((Z - 7) % 12 == 0), paint, 2)
    P.flat(g, upper & ((Z - 7) % 12 == 0), trim, 3)
    window_row(g, shell, 12, 148, 34, 46, 8, 4, (trim, 3))
    for zd in (9, 145):  # end doors with droplights
        door = sides & (Z >= zd) & (Z < zd + 6) & (Y >= 16) & (Y < 48)
        P.flat(g, door, paint, 3)
        glass(g, door & (Y >= 36) & (Y < 45) & (Z > zd) & (Z < zd + 5))
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=2)
    _gangways(g, 7, 153)
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4})


def intercity_coach(name="coach-intercity", paint="skin", trim="red", accent="blue") -> Stock:
    """A modern steel express coach: smooth sides, a flatter roof, a long
    band of tinted windows and a bright stripe below them."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint, shade=5, round_=0.6, eave=52, crown=60)
    X, Y, Z = coords(g)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    band(g, sides, 24, 28, trim, 4)
    band(g, sides, 16, 18, accent, 4)
    # one continuous dark window band with thin pillars
    win = sides & (Y >= 32) & (Y < 46) & (Z >= 18) & (Z < 142)
    glass(g, win)
    P.flat(g, win & ((Z - 18) % 15 == 0), paint, 6)
    for zd in (9, 145):  # plug doors at the ends, accent coloured
        door = sides & (Z >= zd) & (Z < zd + 7) & (Y >= 17) & (Y < 50)
        P.flat(g, door, accent, 4)
        glass(g, door & (Y >= 34) & (Y < 46) & (Z > zd) & (Z < zd + 6))
    underframe(g, 7, 153)
    equipment(g, 44, 116, boxes=3)
    _gangways(g, 7, 153)
    ends(g, L, buffers=False)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4})


def _sides(g, shell):
    X = coords(g)[0]
    return shell & ((X == BX - 21) | (X == BX + 20))


def _row_starts(z0: int, z1: int, w: int, gap: int) -> list[int]:
    """Window starts as shapes.window_row lays them out."""
    n = max(1, (z1 - z0 + gap) // (w + gap))
    start = z0 + (z1 - z0 - (n * w + (n - 1) * gap)) // 2
    return [start + k * (w + gap) for k in range(n)]


def _paired_windows(g, shell, z0, z1, y0, y1, w, inner, pair_gap, frame) -> None:
    """Small windows in pairs (one compartment each) along both sides."""
    X, Y, Z = coords(g)
    left, right = side_planes(g, shell)
    planes = left | right
    unit = 2 * w + inner + pair_gap
    n = max(1, (z1 - z0 + pair_gap) // unit)
    start = z0 + (z1 - z0 - (n * unit - pair_gap)) // 2
    for k in range(n):
        for j in range(2):
            z = start + k * unit + j * (w + inner)
            pane = planes & (Z >= z) & (Z < z + w) & (Y >= y0) & (Y < y1)
            P.flat(g, pane, *frame)
            glass(g, pane & (Z >= z + 1) & (Z < z + w - 1) & (Y >= y0 + 1) & (Y < y1 - 1))


def _end_doors(g, sides, paint, shade, zs=(9, 145), w=6, glass_rows=(36, 45)) -> None:
    X, Y, Z = coords(g)
    for zd in zs:
        door = sides & (Z >= zd) & (Z < zd + w) & (Y >= 16) & (Y < 48)
        P.flat(g, door, paint, shade)
        glass(g, door & (Y >= glass_rows[0]) & (Y < glass_rows[1]) & (Z > zd) & (Z < zd + w - 1))


def sleeper_car(name="coach-sleeper", paint="blue", trim="gold", accent="bone") -> Stock:
    """A luxury sleeping car: deep lacquered panels with fine gold lining,
    small windows in pairs (one pair per berth compartment) and a cream
    name board above them."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint, shade=1)
    X, Y, Z = coords(g)
    sides = _sides(g, shell)
    P.flat(g, sides & ((Y == 30) | (Y == 46)) & (Z >= 9) & (Z < 151), trim, 6)  # lining
    P.flat(g, sides & (Y == 20) & (Z >= 9) & (Z < 151), trim, 5)
    P.flat(g, sides & (Y >= 16) & (Y < 29) & ((Z - 7) % 18 == 0), trim, 4)  # panel lines
    _paired_windows(g, shell, 18, 142, 33, 44, 5, 1, 7, (paint, 0))
    P.flat(g, sides & (Y >= 47) & (Y < 50) & (Z >= 48) & (Z < 112), accent, 6)  # name board
    _end_doors(g, sides, paint, 2)
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=2)
    _gangways(g, 7, 153)
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4, "service": "sleeping"})


def dining_car(name="coach-dining", paint="magenta", trim="gold", accent="bone") -> Stock:
    """A dining car: a row of big picture windows with a table lamp glowing
    in each, a kitchen at one end with small high windows and roof vents."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint, shade=3)
    X, Y, Z = coords(g)
    sides = _sides(g, shell)
    band(g, sides, 26, 28, accent, 6)
    P.flat(g, sides & ((Y == 29) | (Y == 49)) & (Z >= 9) & (Z < 151), trim, 6)
    w, gap = 14, 3
    window_row(g, shell, 16, 124, 31, 48, w, gap, (trim, 4))
    for z in _row_starts(16, 124, w, gap):  # table lamps: a glowing shade low in every window
        c = z + w // 2
        P.flat(g, sides & (Y >= 33) & (Y < 35) & (Z >= c - 1) & (Z < c + 1), "ember", 6)
        P.flat(g, sides & (Y == 35) & (Z >= c - 1) & (Z < c + 1), "sand", 7)
    for z in (128, 136):  # kitchen windows, small and high
        pane = sides & (Z >= z) & (Z < z + 5) & (Y >= 40) & (Y < 46)
        P.flat(g, pane, trim, 4)
        glass(g, pane & (Z > z) & (Z < z + 4) & (Y > 40) & (Y < 45))
    for z in (130, 140):  # kitchen roof vents
        g.box(BX - 3, 59, z, BX + 3, 63, z + 4, C("iron", 3))
    _end_doors(g, sides, paint, 2)
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=3)
    _gangways(g, 7, 153)
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4)), ("socket-smoke", (BX, 63, 135))],
                 data={"floorY": FLOOR_Y, "doors": 4, "service": "dining"})


def observation_car(name="coach-observation", paint="forest", trim="gold", accent="red") -> Stock:
    """A heritage observation car: the saloon ends in an open balcony with
    railings and a round tail sign, under the roof carried on to the end posts."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint, shade=3, z1=136)
    X, Y, Z = coords(g)
    sides = _sides(g, shell)
    P.flat(g, sides & ((Y == 29) | (Y == 47)) & (Z >= 9), trim, 6)
    window_row(g, shell, 16, 132, 32, 46, 9, 3, (trim, 4))
    _end_doors(g, sides, paint, 2, zs=(9,))
    # rear wall of the saloon: a glazed door to the balcony, windows either side
    rear = shell & (Z == 135)
    P.flat(g, rear & (np.abs(X + 0.5 - BX) < 6) & (Y >= 16) & (Y < 46), paint, 2)
    glass(g, rear & (np.abs(X + 0.5 - BX) < 4) & (Y >= 30) & (Y < 43))
    for sx in (-1, 1):
        glass(g, rear & (np.abs(X + 0.5 - (BX + sx * 14)) < 4) & (Y >= 32) & (Y < 44))
    # the balcony: a plank deck, railings, end posts holding up the roof
    g.box(BX - 21, 13, 136, BX + 21, 16, 154, C("wood", 4))
    P.flat(g, (g.a > 0) & (Y == 15) & (Z >= 136) & (Z < 154) & ((Z - 136) % 4 == 0), "wood", 2)
    extrude(g, car_profile(21, 48, 50, 60, round_=1.0), 136, 154, "gray", 4)
    for x in (BX - 21, BX + 20):
        g.box(x, 16, 151, x + 1, 50, 154, C(paint, 2))  # end post
        for z in range(137, 151, 4):  # side railings
            g.box(x, 16, z, x + 1, 29, z + 1, C(trim, 3))
        g.box(x, 28, 136, x + 1, 30, 154, C(trim, 6))
    for x in list(range(BX - 21, BX - 5, 4)) + list(range(BX + 6, BX + 21, 4)):  # rear railing, a gate in the middle
        g.box(x, 16, 152, x + 1, 29, 154, C(trim, 3))
    g.box(BX - 21, 28, 152, BX - 5, 30, 154, C(trim, 6))
    g.box(BX + 5, 28, 152, BX + 21, 30, 154, C(trim, 6))
    g.prism("z", flat_ngon(BX - 13, 24, 4.0, 10), 154, 155, C(accent, 4))  # round tail sign on the railing
    P.flat(g, (g.a > 0) & (Z == 154) & ((X + 0.5 - (BX - 13)) ** 2 + (Y + 0.5 - 24) ** 2 < 6), "sand", 7)
    for x in (BX - 20, BX + 19):  # marker lamps
        g.box(x, 44, 153, x + 1, 47, 155, C("ember", 5))
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=2)
    g.box(BX - 7, 16, 4, BX + 7, 50, 7, C("iron", 2))  # gangway at the front end only
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX - 13, 24, 155))],
                 data={"floorY": FLOOR_Y, "doors": 2, "service": "observation", "endOfTrain": True})


def dome_car(name="coach-dome", paint="khaki", trim="red", accent="sky") -> Stock:
    """A streamlined fluted-steel dome car: a glazed observation dome rises
    from the middle of the roof over a long window row."""
    g = Grid(BW, 72, L + 1)
    shell = _coach_shell(g, paint=paint, shade=5, round_=0.8)
    X, Y, Z = coords(g)
    sides = _sides(g, shell)
    P.flat(g, sides & (Y >= 16) & (Y < 30) & (Y % 2 == 0), paint, 3)  # fluting
    band(g, sides, 30, 32, trim, 4)
    P.flat(g, sides & (Y == 47) & (Z >= 9) & (Z < 151), accent, 4)
    window_row(g, shell, 16, 144, 33, 45, 10, 3, (paint, 3))
    dome = loft(g, [(48, 6, 57, 61), (58, 16, 57, 69), (102, 16, 57, 69), (112, 6, 57, 61)], paint, 5, p=2.4, n=16)
    glass(g, dome & (Y >= 61))
    P.flat(g, dome & (Y >= 61) & (((Z - 48) % 9) == 0), paint, 5)  # glazing bars
    P.flat(g, dome & (Y >= 66) & (np.abs(X + 0.5 - BX) < 1), paint, 5)
    _end_doors(g, sides, paint, 4)
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=2)
    _gangways(g, 7, 153)
    ends(g, L, buffers=False)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4, "service": "dome"})


def baggage_mail(name="coach-baggage-mail", paint="blood", trim="bone", accent="gold") -> Stock:
    """A baggage-and-mail van: plain sides with two wide double doors on
    each side, a few small windows for the guard and the sorting desk."""
    g = Grid(BW, 64, L + 1)
    shell = _coach_shell(g, paint=paint, shade=4)
    X, Y, Z = coords(g)
    sides = _sides(g, shell)
    P.flat(g, sides & ((Y == 29) | (Y == 46)) & (Z >= 9) & (Z < 151), accent, 5)
    for z0, z1 in ((38, 62), (98, 122)):  # wide double doors
        door = sides & (Z >= z0) & (Z < z1) & (Y >= 16) & (Y < 47)
        P.flat(g, door, paint, 3)
        P.flat(g, door & ((Z == z0) | (Z == z1 - 1) | (Y == 46) | (Z == (z0 + z1) // 2)), trim, 5)
        glass(g, door & (Y >= 36) & (Y < 43) & (((Z - z0) % 12) >= 3) & (((Z - z0) % 12) < 9))
        P.flat(g, door & (Y >= 24) & (Y < 26) & (np.abs(Z + 0.5 - (z0 + z1) / 2) < 3), "steel", 6)  # handles
    for z in (14, 24, 130, 140):  # small windows near the ends
        pane = sides & (Z >= z) & (Z < z + 6) & (Y >= 35) & (Y < 44)
        P.flat(g, pane, trim, 4)
        glass(g, pane & (Z > z) & (Z < z + 5) & (Y > 35) & (Y < 43))
    P.flat(g, sides & (Y >= 18) & (Y < 23) & (Z >= 74) & (Z < 82), "iron", 2)  # letter slot
    underframe(g, 7, 153)
    equipment(g, 46, 114, boxes=2)
    _gangways(g, 7, 153)
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4, "service": "baggage and mail"})


def double_deck(name="coach-double-deck", paint="skin", trim="sky", accent="blue") -> Stock:
    """A double-deck suburban coach: a tall body with two rows of windows,
    the lower deck dropped between the bogies, doors at the ends."""
    g = Grid(BW, 72, L + 1)
    shell = _coach_shell(g, paint=paint, shade=5, eave=64, crown=70, round_=0.6)
    X, Y, Z = coords(g)
    g.box(BX - 21, 7, 46, BX + 21, 14, 114, C(paint, 4))  # the dropped lower deck
    low = (g.a > 0) & (Z >= 46) & (Z < 114) & (Y >= 7) & (Y < 14) & ((X == BX - 21) | (X == BX + 20))
    sides = _sides(g, shell) | low
    band(g, sides, 34, 38, trim, 4)
    band(g, sides, 7, 10, accent, 4)
    window_row(g, shell, 20, 140, 21, 31, 11, 3, (accent, 3))
    window_row(g, shell, 20, 140, 42, 55, 11, 3, (accent, 3))
    for zd in (9, 145):  # doors at the ends, at platform height
        door = sides & (Z >= zd) & (Z < zd + 7) & (Y >= 16) & (Y < 50)
        P.flat(g, door, accent, 4)
        glass(g, door & (Y >= 36) & (Y < 47) & (Z > zd) & (Z < zd + 6))
    underframe(g, 7, 46)
    underframe(g, 114, 153)
    _gangways(g, 7, 153, y1=56)
    ends(g, L)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent}, bogies=list(BOGIES),
                 sockets=[("socket-light-r", (BX, 40, L - 4))], data={"floorY": FLOOR_Y, "doors": 4, "decks": 2})


CATALOG = [
    stock("passenger-carriages", classic_coach, tier="slice"),
    stock("passenger-carriages", intercity_coach, tier="slice"),
    stock("passenger-carriages", sleeper_car),
    stock("passenger-carriages", dining_car),
    stock("passenger-carriages", observation_car),
    stock("passenger-carriages", dome_car),
    stock("passenger-carriages", baggage_mail),
    stock("passenger-carriages", double_deck),
]
