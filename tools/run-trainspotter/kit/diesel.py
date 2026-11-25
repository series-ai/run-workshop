"""Diesel locomotives."""
from __future__ import annotations

import numpy as np

from catalog import stock
from furniture import ends
from locokit import (chamfer_box, chevrons, end_lamps, handrails, hood_section, louvres, off_axis, roof_fans, side_region,
                     side_windows, warning_end, windscreen)
from moving import sliding_doors
from pnshapes import disc
from railkit import FLOOR_Y, C, Grid, P, coords
from shapes import BW, BX, car_profile, extrude, glass, loft, round_lamp
from stock import Axle, Bogie, Rods, Stock

L = 160


def streamliner(name="diesel-streamlined-cab", paint="khaki", trim="red", accent="gold") -> Stock:
    """A mid-century streamlined cab unit: a rounded 'bulldog' nose ahead of
    a raised cab, a smooth carbody with grilles and roof fans, two bogies."""
    g = Grid(BW, 66, L + 1)
    body = loft(g, [(5, 15, 14, 33), (11, 18.5, 14, 42), (19, 20.5, 14, 50), (29, 21, 14, 58), (36, 21, 14, 62), (154, 21, 14, 62)],
                paint, 4, p=3.2, n=20)
    X, Y, Z = coords(g)
    # nose wrap in the trim colour, sweeping back along the sides, with a stripe
    nose = body & (Z < 30) | (body & (Y < 34) & (Z < 60 - (Y - 14)))
    P.flat(g, nose, trim, 4)
    P.flat(g, body & (Y >= 30) & (Y < 33) & (Z >= 8), accent, 5)
    P.flat(g, body & (Y < 17), "iron", 3)  # skirt
    # windscreen on the sloped cab front, cab side windows
    ws = body & (Z >= 21) & (Z < 32) & (Y >= 46) & (Y < 56) & (np.abs(X + 0.5 - BX) > 1.5) & (np.abs(X + 0.5 - BX) < 16)
    glass(g, ws)
    for x in (BX - 21, BX + 20):
        glass(g, body & (X == x) & (Z >= 30) & (Z < 40) & (Y >= 44) & (Y < 54))
    # grilles high on the sides, roof fans
    side = body & ((X == BX - 21) | (X == BX + 20))
    grille = side & (Y >= 44) & (Y < 54) & (Z >= 60) & (Z < 140)
    P.flat(g, grille, "iron", 3)
    P.flat(g, grille & ((Z % 3) == 0), "iron", 5)
    top = body & (Y >= 60)
    for zc in (80, 104, 128):
        P.flat(g, top & ((X + 0.5 - BX) ** 2 + (Z + 0.5 - zc) ** 2 < 49), "iron", 3)
        P.flat(g, top & ((X + 0.5 - BX) ** 2 + (Z + 0.5 - zc) ** 2 < 6), "steel", 5)
    round_lamp(g, BX, 30, 6, r=3.2, lens=("sand", 7))
    round_lamp(g, BX, 57, 31, r=2.0, lens=("ember", 6))
    # fuel tank between the bogies, and a pilot under the nose
    g.box(BX - 16, 5, 48, BX + 16, 13, 112, C("iron", 2))
    g.prism("x", [(4, 4), (14, 4), (14, 10)], BX - 18, BX + 18, C("iron", 3))
    ends(g, L, buffers=False, front=False)
    g.box(BX - 3, 8, 0, BX + 3, 12, 4, C("iron", 2))  # front coupler
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32), Bogie("r", 130)], powered=True, idle="diesel",
                 sockets=[("socket-light-f", (BX, 30, 4)), ("socket-cab", (BX, 40, 34)), ("socket-smoke", (BX, 63, 92))],
                 data={"traction": "diesel"})


def road_switcher(name="diesel-road-switcher", paint="orange", trim="arcane", accent="gold") -> Stock:
    """A general-purpose hood unit: a narrow long hood, a cab near the front,
    a short nose, open walkways with handrails all round, two bogies."""
    g = Grid(BW, 66, L + 1)
    X, Y, Z = coords(g)
    deck = extrude(g, [(BX - 22, 13), (BX + 22, 13), (BX + 22, 17), (BX - 22, 17)], 6, 154, trim, 3)
    P.flat(g, deck & (Y == 13), accent, 5)  # frame edge stripe
    nose = extrude(g, hood_section(13, 17, 42), 10, 30, paint, 4)
    cab = extrude(g, chamfer_box(20, 17, 62, ch=3), 30, 52, paint, 4)
    hood = extrude(g, hood_section(13, 17, 50), 52, 150, paint, 4)
    body = nose | cab | hood
    P.flat(g, cab & (Y >= 59), "iron", 3)  # cab roof
    windscreen(g, cab, True, 46, 57, xhalf=17)
    windscreen(g, cab, False, 46, 57, xhalf=17)
    side_windows(g, cab, 20, 34, 48, 46, 57, w=6, gap=2)
    louvres(g, hood, 13, 60, 144, 30, 44, pitch=3)
    P.flat(g, hood & (Z % 12 == 0) & (Y > 17), paint, 3)  # hood door seams
    roof_fans(g, hood, (110, 132), 48, r=5)
    disc(g, "y", BX, 70, 2.2, 50, 56, "iron", 2, n=8)  # exhaust stack
    round_lamp(g, BX, 36, 10, r=2.4, lens=("sand", 7))  # nose headlight
    round_lamp(g, BX, 44, 150, r=2.4, lens=("sand", 7), front=False)
    handrails(g, 8, 152, 28, 21, ramp=(accent, 5), post_every=12)
    for zs in (6, 150):  # end steps striped in the accent
        m = P.region(g, BX - 22, 8, zs, BX + 22, 17, zs + 4) & (g.a > 0)
        chevrons(g, m, accent, 5)
    g.box(BX - 16, 5, 50, BX + 16, 13, 110, C("iron", 2))  # fuel tank
    ends(g, L)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32, r=9, wheelbase=24), Bogie("r", 128, r=9, wheelbase=24)], powered=True, idle="diesel",
                 sockets=[("socket-light-f", (BX, 36, 8)), ("socket-cab", (BX, 52, 30)), ("socket-smoke", (BX, 56, 70))],
                 data={"traction": "diesel"})


def wedge_power_car(name="diesel-express-power-car", paint="skin", trim="blue", accent="gold") -> Stock:
    """A high-speed diesel set's power car: a long wedge nose with a wrapped
    windscreen and a warning-yellow front, one cab, a gangway at the rear."""
    g = Grid(BW, 62, L + 1)
    body = loft(g, [(3, 13, 14, 24), (14, 18.5, 14, 38), (28, 21, 14, 52), (42, 21, 14, 58), (156, 21, 14, 58)], paint, 5, p=3.6, n=20)
    X, Y, Z = coords(g)
    P.flat(g, body & (Z < 24), accent, 5)  # warning nose
    P.flat(g, body & (Y >= 24) & (Y < 32) & (Z >= 24), trim, 4)  # body band
    P.flat(g, body & (Y < 17), "iron", 3)
    ws = body & (Z >= 20) & (Z < 38) & (Y >= 40) & (Y < 52) & (off_axis(g) < 19)
    glass(g, ws)
    side_windows(g, body, 21, 40, 48, 40, 50)
    louvres(g, body, 21, 60, 140, 38, 52, pitch=2)
    for z in (52, 146):  # body-side doors
        P.flat(g, side_region(g, body, 21, z, z + 6, 17, 50), trim, 3)
    roof_fans(g, body, (84, 108, 132), 56, r=5)
    round_lamp(g, BX - 10, 22, 7, r=2.0, lens=("sand", 7))
    round_lamp(g, BX + 10, 22, 7, r=2.0, lens=("sand", 7))
    g.box(BX - 16, 5, 56, BX + 16, 13, 112, C("iron", 2))
    g.prism("x", [(3, 3), (13, 3), (13, 9)], BX - 18, BX + 18, C("iron", 3))  # nose fairing
    ends(g, L, buffers=False, front=False)
    g.box(BX - 3, 8, 0, BX + 3, 12, 4, C("iron", 2))  # covered front coupler
    g.box(BX - 7, 16, L - 3, BX + 7, 50, L, C("iron", 2))  # gangway
    return Stock(name, "power-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 40), Bogie("r", 132)], powered=True, idle="diesel",
                 sockets=[("socket-light-f", (BX, 22, 5)), ("socket-cab", (BX, 46, 30)), ("socket-smoke", (BX, 58, 96))],
                 data={"traction": "diesel", "set": "wedge"})


def twin_cab(name="diesel-twin-cab", paint="blue", trim="skin", accent="gold") -> Stock:
    """A mainline box-body diesel with a cab at each end: flat ends with
    two-pane windscreens and warning panels, louvred sides, roof fans."""
    g = Grid(BW, 66, L + 1)
    body = extrude(g, chamfer_box(21, 14, 60, ch=4), 8, 152, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y >= 24) & (Y < 27), trim, 6)  # body stripe
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 57), "gray", 4)  # roof
    for front in (True, False):
        warning_end(g, body, front, accent, 5, 17, 44, depth=1)
        windscreen(g, body, front, 44, 54, xhalf=17, depth=1)
        side_windows(g, body, 21, 12 if front else 136, 24 if front else 148, 44, 53)
        for z in ((26,) if front else (130,)):  # cab doors
            P.flat(g, side_region(g, body, 21, z, z + 5, 17, 54), paint, 3)
    louvres(g, body, 21, 40, 120, 40, 54, pitch=3)
    roof_fans(g, body, (60, 80, 100), 58, r=6)
    end_lamps(g, 8, True, y=24, spread=12, top=56)
    end_lamps(g, 152, False, y=24, spread=12, top=56)
    g.box(BX - 16, 5, 48, BX + 16, 13, 112, C("iron", 2))
    ends(g, L)
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32, r=9, wheelbase=26), Bogie("r", 128, r=9, wheelbase=26)], powered=True, idle="diesel",
                 sockets=[("socket-light-f", (BX, 24, 6)), ("socket-cab", (BX, 49, 8)), ("socket-smoke", (BX, 60, 90))],
                 data={"traction": "diesel"})


def yard_shunter(name="diesel-yard-shunter", paint="forest", trim="arcane", accent="gold") -> Stock:
    """A small six-wheel yard engine: a low bonnet, a tall cab at the back,
    coupled wheels driven by side rods, striped buffer beams."""
    Ls = 96
    g = Grid(BW, 64, Ls + 1)
    X, Y, Z = coords(g)
    frame = extrude(g, [(BX - 19, 12), (BX + 19, 12), (BX + 19, 17), (BX - 19, 17)], 6, 90, trim, 3)
    hood = extrude(g, hood_section(15, 17, 44), 8, 58, paint, 4)
    cab = extrude(g, chamfer_box(20, 17, 62, ch=4), 58, 88, paint, 4)
    P.flat(g, cab & (Y >= 59), "iron", 3)
    louvres(g, hood, 15, 12, 54, 26, 40, pitch=2)
    windscreen(g, cab, True, 46, 56, xhalf=16)
    windscreen(g, cab, False, 46, 56, xhalf=16)
    side_windows(g, cab, 20, 62, 84, 44, 56)
    disc(g, "y", BX, 20, 2.0, 44, 50, "iron", 2, n=8)  # exhaust
    round_lamp(g, BX, 34, 8, r=2.2, lens=("sand", 7))
    round_lamp(g, BX, 50, 88, r=2.2, lens=("sand", 7), front=False)
    handrails(g, 10, 56, 25, 18, ramp=("steel", 5), post_every=23)
    ends(g, Ls, beam=(accent, 4))
    for zs in (4, Ls - 8):  # striped buffer beams
        m = P.region(g, BX - 20, 6, zs, BX + 20, 15, zs + 4) & (g.a > 0)
        chevrons(g, m, "iron", 2)
    rods = Rods(["wheel-a1", "wheel-a2", "wheel-a3"], "wheel-a1", crank=4, slide_y=9, main_len=14, x=20)
    face = dict(face=("iron", 3), spokes=0, counterweight=True)
    return Stock(name, "locomotive", Ls, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 26, 9, face), Axle("wheel-a2", 48, 9, face), Axle("wheel-a3", 70, 9, face)],
                 rods=rods, powered=True, idle="diesel",
                 sockets=[("socket-light-f", (BX, 34, 6)), ("socket-cab", (BX, 51, 58)), ("socket-smoke", (BX, 50, 20))],
                 data={"traction": "diesel", "wheelArrangement": "0-6-0"})


def rural_railcar(name="diesel-rural-railcar", paint="red", trim="bone", accent="gold") -> Stock:
    """A single-unit diesel railcar for quiet branch lines: a cab at each end,
    a row of passenger windows, sliding doors, an exhaust up the end."""
    g = Grid(BW, 66, L + 1)
    body = extrude(g, car_profile(21, 14, 50, 60, round_=0.9), 7, 153, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y >= 50), "gray", 4)
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, side_region(g, body, 21, 7, 153, 28, 31), trim, 6)  # waist band
    P.flat(g, side_region(g, body, 21, 7, 153, 46, 49), trim, 6)  # cant band
    side_windows(g, body, 21, 30, 130, 33, 45, w=10, gap=4)
    for front in (True, False):
        warning_end(g, body, front, accent, 5, 17, 32, depth=1)
        windscreen(g, body, front, 34, 46, xhalf=16, depth=1)
    side_windows(g, body, 21, 10, 20, 34, 46)
    side_windows(g, body, 21, 140, 150, 34, 46)
    end_lamps(g, 7, True, y=24, spread=12)
    end_lamps(g, 153, False, y=24, spread=12)
    g.box(BX - 14, 5, 52, BX + 14, 12, 108, C("iron", 2))  # underfloor engine
    g.box(BX + 17, 40, 148, BX + 20, 62, 151, C("iron", 2))  # exhaust up the end
    ends(g, L)
    doors = [(f"door-{s}{k}", side, z, z + 7, 17, 48, slide) for k, (z, slide) in enumerate(((21, 7), (132, -7)), 1)
             for s, side in (("l", "-x"), ("r", "+x"))]
    parts, clips = sliding_doors(doors, {"-x": BX - 21, "+x": BX + 21}, ramp=(accent, 4), glass_rows=(34, 45))
    return Stock(name, "railcar", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32), Bogie("r", 128)], powered=True, idle="diesel", extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 24, 5)), ("socket-cab", (BX, 40, 7)), ("socket-smoke", (BX + 18, 62, 149))],
                 data={"traction": "diesel", "floorY": FLOOR_Y, "doors": 4})


CATALOG = [
    stock("diesel-locomotives", streamliner, tier="slice"),
    stock("diesel-locomotives", road_switcher),
    stock("diesel-locomotives", wedge_power_car),
    stock("diesel-locomotives", twin_cab),
    stock("diesel-locomotives", yard_shunter),
    stock("diesel-locomotives", rural_railcar),
]
