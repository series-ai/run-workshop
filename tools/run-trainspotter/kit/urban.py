"""Urban rail: trams, a hill cable car, metro cars and a double-deck commuter car.

Trams and metro cars couple with a centre coupler only (no buffers). Doors
are separate leaves (moving.sliding_doors) with `open` / `close` clips;
pantographs come from moving.pantograph, raised by `open`, lowered by `close`.
"""
from __future__ import annotations

import numpy as np

from catalog import stock
from furniture import ends, equipment, underframe
from highspeed import oct_section, panto
from moving import merge_clips, sliding_doors
from pnshapes import cone, last
from railkit import C, FLOOR_Y, Grid, P, coords
from shapes import BW, BX, car_profile, extrude, glass, loft, round_lamp
from stock import Axle, Bogie, Stock

SIDES = {"-x": BX - 21, "+x": BX + 21}  # side face planes of a 21-half-wide shell


def _doors(spans, y0, y1, ramp, glass_rows=None, slide=None):
    """Door leaves on both sides at each (z0, z1) span; each leaf slides toward +z by its width."""
    doors = []
    for k, (z0, z1) in enumerate(spans, 1):
        for side in ("-x", "+x"):
            doors.append((f"door-{side[1]}{'l' if side[0] == '-' else 'r'}{k}", side, z0, z1, y0, y1, slide or (z1 - z0)))
    return sliding_doors(doors, SIDES, ramp=ramp, glass_rows=glass_rows)


def _truck(g, z0: int, z1: int) -> None:
    """A rigid single truck under the floor: a frame inside the wheels and
    side frames with axle boxes outside them."""
    g.box(BX - 11, 10, z0, BX + 11, 14, z1, C("iron", 3))
    for x0 in (BX - 21, BX + 18):
        g.box(x0, 6, z0, x0 + 3, 13, z1, C("iron", 3))


# ---------------------------------------------------------------- trams
def heritage_tram(name="tram-heritage", paint="red", trim="bone", accent="gold") -> Stock:
    """A four-wheel heritage tram: a single rigid truck, a panelled saloon with
    a clerestory roof, open end platforms with dashes and a small pantograph."""
    L = 96
    g = Grid(BW, 70, L + 1)
    X, Y, Z = coords(g)
    # saloon: panelled lower sides, windows above, clerestory roof
    saloon = extrude(g, [(BX - 20, 14), (BX + 20, 14), (BX + 20, 54), (BX - 20, 54)], 22, 74, paint, 4)
    P.flat(g, saloon & (Y >= 34), trim, 6)
    P.flat(g, saloon & ((Y == 33) | (Y == 34)), accent, 5)  # lining
    P.flat(g, saloon & (Y < 33) & ((Z - 22) % 13 == 0), paint, 2)  # panels
    for x in (BX - 20, BX + 19):
        for z in range(24, 72, 8):
            glass(g, saloon & (X == x) & (Z >= z) & (Z < z + 6) & (Y >= 37) & (Y < 50))
    # roof over saloon and platforms, and the raised clerestory
    roof = extrude(g, [(BX - 22, 54), (BX + 22, 54), (BX + 20, 57), (BX - 20, 57)], 6, 90, "gray", 4)
    cl = extrude(g, [(BX - 11, 57), (BX + 11, 57), (BX + 11, 61), (BX - 11, 61)], 24, 72, "gray", 5)
    for x in (BX - 11, BX + 10):
        for z in range(26, 70, 6):
            glass(g, cl & (X == x) & (Z >= z) & (Z < z + 4) & (Y >= 58) & (Y < 60), glint=False)
    # open platforms: floor, curved dash at each end, corner stanchions, steps
    for z0, z1, dash in ((6, 22, (6, 9)), (74, 90, (87, 90))):
        g.box(BX - 20, 14, z0, BX + 20, 17, z1, C("wood", 4))
        g.box(BX - 20, 17, dash[0], BX + 20, 36, dash[1], C(paint, 4))
        P.flat(g, (Z >= dash[0]) & (Z < dash[1]) & (Y >= 33) & (Y < 36) & (g.a > 0), accent, 5)
        for x in (BX - 20, BX + 18):
            g.box(x, 17, z0 + (1 if z0 == 6 else 12), x + 2, 54, z0 + (3 if z0 == 6 else 14), C("steel", 5))
        g.box(BX - 22, 8, z0 + 4, BX + 22, 10, z1 - 4, C("iron", 3))  # step
    round_lamp(g, BX, 28, 6, r=2.6)
    round_lamp(g, BX, 28, 90, r=2.6, front=False)
    _truck(g, 26, 70)
    ends(g, L, buffers=False, beam=(paint, 3))
    parts, clips = panto(BX, 61, 48, arm=10, width=16)
    return Stock(name, "tram", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 34, 6), Axle("wheel-a2", 62, 6)], powered=True, extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 28, 4)), ("socket-cab", (BX, 40, 14)), ("socket-panto", (BX, 61, 48))],
                 data={"traction": "electric", "floorY": FLOOR_Y, "doors": 0, "bidirectional": True})


def modern_tram(name="tram-modern", paint="skin", trim="lime", accent="arcane") -> Stock:
    """A modern low-floor tram: rounded cabs at both ends, deep windows, a
    skirt hiding the bogies, two pairs of plug doors per side and a pantograph."""
    L = 160
    g = Grid(BW, 66, L + 1)
    body = loft(g, [(3, 15, 12, 44), (9, 19.5, 11, 54), (20, 21, 10, 60), (140, 21, 10, 60), (151, 19.5, 11, 54), (157, 15, 12, 44)],
                paint, 6, p=3.0, n=20)
    X, Y, Z = coords(g)
    P.flat(g, body & ((Z < 22) | (Z >= 138)), trim, 4)  # coloured cab ends
    P.flat(g, body & (Y < 15), trim, 4)  # skirt
    P.flat(g, body & (Y >= 24) & (Y < 26), accent, 3)
    win = body & ((X == BX - 21) | (X == BX + 20)) & (Y >= 28) & (Y < 52) & (Z >= 24) & (Z < 136)
    P.flat(g, win, accent, 3)
    glass(g, win & (Y >= 29) & (Y < 51) & ((Z - 24) % 14 != 0))
    for front, z in ((True, (3, 16)), (False, (144, 157))):
        ws = body & (Z >= z[0]) & (Z < z[1]) & (Y >= 34) & (Y < 54) & (np.abs(X + 0.5 - BX) < 17)
        glass(g, ws)
        for sx in (-1, 1):
            P.flat(g, body & (Z >= z[0]) & (Z < z[1]) & (np.abs(X + 0.5 - (BX + sx * 10)) < 2) & (Y >= 20) & (Y < 23),
                   "sand", 7) if front else P.flat(g, body & (Z >= z[0]) & (Z < z[1]) & (np.abs(X + 0.5 - (BX + sx * 10)) < 2) & (Y >= 20) & (Y < 23), "ember", 4)
    g.box(BX - 14, 60, 56, BX + 14, 63, 104, C("iron", 4))  # roof equipment
    ends(g, L, buffers=False)
    door_parts, door_clips = _doors([(42, 54), (106, 118)], 12, 54, (accent, 4), glass_rows=(24, 50))
    p_parts, p_clips = panto(BX, 63, 80)
    return Stock(name, "tram", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 30), Bogie("r", 130)], powered=True, extra_parts=door_parts + p_parts,
                 extra_clips=merge_clips(door_clips, p_clips),
                 sockets=[("socket-light-f", (BX, 22, 4)), ("socket-cab", (BX, 44, 12)), ("socket-panto", (BX, 63, 80))],
                 data={"traction": "electric", "floorY": FLOOR_Y, "doors": 4, "bidirectional": True})


def cable_car(name="cable-car-hill", paint="red", trim="bone", accent="gold") -> Stock:
    """A wooden hill cable car: an enclosed centre cabin, open bench sections
    at each end under one long roof, running boards and a roof bell."""
    L = 96
    g = Grid(BW, 64, L + 1)
    X, Y, Z = coords(g)
    g.box(BX - 21, 14, 4, BX + 21, 18, 92, C("wood", 4))  # deck
    P.flat(g, (g.a > 0) & (Y == 17) & ((Z % 6) == 0), "wood", 2)
    cabin = extrude(g, [(BX - 20, 18), (BX + 20, 18), (BX + 20, 52), (BX - 20, 52)], 32, 64, paint, 4)
    P.flat(g, cabin & (Y >= 30), trim, 6)
    P.flat(g, cabin & ((Y == 29) | (Y == 30)), accent, 5)
    for x in (BX - 20, BX + 19):
        for z in range(34, 62, 9):
            glass(g, cabin & (X == x) & (Z >= z) & (Z < z + 6) & (Y >= 34) & (Y < 48))
    roof = extrude(g, [(BX - 22, 52), (BX + 22, 52), (BX + 18, 56), (BX - 18, 56)], 4, 92, paint, 3)
    P.flat(g, roof & (Y >= 55), "gray", 5)
    # open sections: corner posts, outward-facing benches with backs, grab rails
    for z0, z1 in ((4, 32), (64, 92)):
        for x in (BX - 21, BX + 19):
            for z in (z0, z0 + (z1 - z0) // 2 - 1, z1 - 2):
                g.box(x, 18, z, x + 2, 52, z + 2, C(trim, 5))
        g.box(BX - 2, 18, z0 + 2, BX + 2, 34, z1 - 2, C("wood", 3))  # back-to-back bench backs
        for sx in (-1, 1):
            g.box(BX + (2 if sx > 0 else -12), 24, z0 + 3, BX + (12 if sx > 0 else -2), 27, z1 - 3, C("wood", 5))
        g.box(BX - 21, 44, z0, BX - 19, 45, z1, C("ember", 5))  # brass grab rails
        g.box(BX + 19, 44, z0, BX + 21, 45, z1, C("ember", 5))
    for x in (BX - 24, BX + 21):  # running boards
        g.box(x, 10, 6, x + 3, 12, 90, C("wood", 3))
    cone(g, "y", BX, 48, 3.0, 56, 61, "ember", 5, n=8, r_top=1.5)  # bell
    round_lamp(g, BX, 40, 4, r=2.4)
    round_lamp(g, BX, 40, 92, r=2.4, front=False)
    _truck(g, 22, 74)
    g.box(BX - 2, 4, 44, BX + 2, 14, 52, C("iron", 2))  # cable grip
    ends(g, L, buffers=False, beam=(paint, 3))
    return Stock(name, "cable-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 30, 6), Axle("wheel-a2", 66, 6)], powered=True,
                 sockets=[("socket-light-f", (BX, 40, 3)), ("socket-bell", (BX, 61, 48))],
                 data={"traction": "cable", "floorY": FLOOR_Y, "doors": 0, "bidirectional": True})


# ---------------------------------------------------------------- metro
def _metro_body(g, paint, trim, accent, cab: bool, L: int):
    X, Y, Z = coords(g)
    z0 = 10 if cab else 4
    shell = extrude(g, car_profile(21, 14, 52, 60, round_=0.5), z0, L - 4, paint, 5)
    if cab:  # a slightly raked flat cab front
        g.prism("x", [(14, 4), (14, 10), (60, 10), (56, 5), (30, 4)], BX - 21, BX + 21, C(paint, 5))
        shell |= last(g)
    P.flat(g, shell & (Y >= 52), paint, 6)
    P.flat(g, shell & (Y >= 26) & (Y < 29), trim, 4)
    P.flat(g, shell & (Y < 16), "iron", 3)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    P.flat(g, sides & ((Y - 14) % 6 == 0) & (Y < 26), paint, 4)  # fluted lower panels
    spans = [(20 + k * 36, 32 + k * 36) for k in range(4)]
    for k in range(5):  # windows between the doors
        za = (z0 + 4) if k == 0 else spans[k - 1][1] + 3
        zb = spans[k][0] - 3 if k < 4 else L - 8
        if zb - za >= 6:
            glass(g, sides & (Y >= 32) & (Y < 46) & (Z >= za) & (Z < zb))
    return shell, sides, spans


def metro_cab(name="metro-cab-car", paint="khaki", trim="blue", accent="red") -> Stock:
    """A metro driving car: stainless body, a flat cab front with a big
    windscreen and headlights, four sliding doors a side."""
    L = 160
    g = Grid(BW, 62, L + 1)
    shell, sides, spans = _metro_body(g, paint, trim, accent, True, L)
    X, Y, Z = coords(g)
    front = shell & (Z < 10)
    glass(g, front & (Y >= 34) & (Y < 50) & (np.abs(X + 0.5 - BX) < 17))
    P.flat(g, front & (Y >= 34) & (Y < 50) & (np.abs(X + 0.5 - BX) < 1), paint, 5)
    P.flat(g, front & (Y >= 52) & (Y < 56) & (np.abs(X + 0.5 - BX) < 10), "iron", 2)  # destination blind
    P.flat(g, front & (Y >= 20) & (Y < 26), accent, 4)
    for sx in (-1, 1):
        P.flat(g, front & (Y >= 20) & (Y < 24) & (np.abs(X + 0.5 - (BX + sx * 13)) < 2.5), "sand", 7)
    underframe(g, 12, 156, y0=10, y1=14)
    equipment(g, 46, 114, boxes=3)
    ends(g, L, buffers=False)
    g.box(BX - 7, 16, L - 4, BX + 7, 50, L, C("iron", 2))
    parts, clips = _doors(spans, 16, 50, (paint, 4), glass_rows=(32, 46))
    return Stock(name, "metro", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28), Bogie("r", 132)], powered=True, extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 22, 4)), ("socket-cab", (BX, 42, 10))],
                 data={"traction": "third-rail", "floorY": FLOOR_Y, "doors": 8, "set": "metro"})


def metro_middle(name="metro-middle-car", paint="khaki", trim="blue", accent="red") -> Stock:
    """The matching metro middle car: gangways at both ends, four doors a side."""
    L = 160
    g = Grid(BW, 62, L + 1)
    shell, sides, spans = _metro_body(g, paint, trim, accent, False, L)
    underframe(g, 6, 156, y0=10, y1=14)
    equipment(g, 46, 114, boxes=3)
    ends(g, L, buffers=False)
    for z0, z1 in ((0, 4), (L - 4, L)):
        g.box(BX - 7, 16, z0, BX + 7, 50, z1, C("iron", 2))
    parts, clips = _doors(spans, 16, 50, (paint, 4), glass_rows=(32, 46))
    return Stock(name, "metro", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28), Bogie("r", 132)], powered=True, extra_parts=parts, extra_clips=clips,
                 data={"traction": "third-rail", "floorY": FLOOR_Y, "doors": 8, "set": "metro"})


# ---------------------------------------------------------------- commuter
def double_deck_cab(name="commuter-double-deck-cab-car", paint="skin", trim="teal", accent="arcane") -> Stock:
    """A double-deck commuter driving car: two rows of windows, a raked cab
    end with a deep windscreen, doors at both ends and buffers."""
    L = 160
    g = Grid(BW, 72, L + 1)
    shell = extrude(g, oct_section(21, 14, 70, 7), 18, 156, paint, 6)
    g.prism("z", oct_section(16, 14, 40, 4), 4, 18, C(paint, 6), top=oct_section(21, 14, 70, 7))
    shell |= last(g)
    X, Y, Z = coords(g)
    P.flat(g, shell & (Y < 18), trim, 4)
    P.flat(g, shell & (Y >= 18) & (Y < 20), accent, 3)
    P.flat(g, shell & (Z < 20), trim, 4)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    for y0, y1 in ((24, 36), (46, 60)):  # lower and upper deck
        win = sides & (Y >= y0) & (Y < y1) & (Z >= 34) & (Z < 140)
        P.flat(g, win, accent, 3)
        glass(g, win & (Y >= y0 + 1) & (Y < y1 - 1) & ((Z - 34) % 13 != 0))
    ws = shell & (Z >= 4) & (Z < 18) & (Y >= 40) & (Y < 62) & (np.abs(X + 0.5 - BX) < 17)
    glass(g, ws)
    for sx in (-1, 1):
        P.flat(g, shell & (Z < 10) & (Y >= 26) & (Y < 30) & (np.abs(X + 0.5 - (BX + sx * 11)) < 2.5), "sand", 7)
    underframe(g, 20, 156, y0=10, y1=14)
    equipment(g, 50, 110, boxes=2)
    ends(g, L)
    g.box(BX - 7, 16, L - 4, BX + 7, 56, L, C("iron", 2))
    parts, clips = _doors([(22, 32), (142, 152)], 16, 52, (accent, 4), glass_rows=(36, 48))
    return Stock(name, "commuter", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32), Bogie("r", 132)], powered=False, extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 28, 4)), ("socket-cab", (BX, 50, 16))],
                 data={"traction": "push-pull", "floorY": FLOOR_Y, "doors": 4, "decks": 2})


CATALOG = [
    stock("trams-metro", heritage_tram),
    stock("trams-metro", modern_tram),
    stock("trams-metro", cable_car),
    stock("trams-metro", metro_cab),
    stock("trams-metro", metro_middle),
    stock("trams-metro", double_deck_cab),
]
