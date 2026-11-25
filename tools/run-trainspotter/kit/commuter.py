"""Big-city commuter and subway cars: four pairs of sliding doors a side,
centre couplers only, floor level with a platform.

Two commuter styles (a modern unpainted stainless car with a line-colour band
and a dark-faced cab; an older car painted all over in a bright line colour)
and two subway styles (a round-fronted car with a band and a wave line; a
retro rounded-roof car). Every car lists named colour presets in its data
("liveries"), all built from the swappable paint / trim / accent roles; the
default colours are one of them.
"""
from __future__ import annotations

import math

import numpy as np

from catalog import stock
from furniture import ends, equipment, underframe
from locokit import panto_socket
from moving import merge_clips, pantograph, sliding_doors
from pnshapes import last
from railkit import C, FLOOR_Y, Grid, P, coords
from shapes import BW, BX, car_profile, extrude, glass, loft, round_lamp
from stock import Bogie, Stock

L = 160
SIDES = {"-x": BX - 21, "+x": BX + 21}
BOGIES = [Bogie("f", 28), Bogie("r", 132)]
SPANS = [(20 + k * 36, 32 + k * 36) for k in range(4)]  # door openings, 12 wide, evenly along the car


def _door_pairs(y0: int, y1: int, ramp, glass_rows=(32, 46)):
    """Double-leaf sliding doors at every span on both sides: each pair parts from its middle."""
    doors = []
    for k, (z0, z1) in enumerate(SPANS, 1):
        zm = (z0 + z1) // 2
        for side in ("-x", "+x"):
            s = "l" if side == "-x" else "r"
            doors.append((f"door-{s}{k}a", side, z0, zm, y0, y1, -(zm - z0)))
            doors.append((f"door-{s}{k}b", side, zm, z1, y0, y1, z1 - zm))
    return sliding_doors(doors, SIDES, ramp=ramp, glass_rows=glass_rows)


def _side_windows(g, sides, z_first: int, z_last: int, y0: int, y1: int, frame=("iron", 2)) -> np.ndarray:
    """Windows between and beyond the doors, each framed in a thin line."""
    X, Y, Z = coords(g)
    out = np.zeros(g.shape, bool)
    edges = [z_first] + [v for span in SPANS for v in (span[0] - 3, span[1] + 3)] + [z_last]
    for za, zb in zip(edges[0::2], edges[1::2]):
        if zb - za < 6:
            continue
        pane = sides & (Y >= y0) & (Y < y1) & (Z >= za) & (Z < zb)
        P.flat(g, pane, *frame)
        glass(g, pane & (Y >= y0 + 1) & (Y < y1 - 1) & (Z >= za + 1) & (Z < zb - 1))
        out |= pane
    return out


def _door_openings(g, sides, y0: int, y1: int) -> None:
    """Dark recesses behind the leaves, seen when the doors open."""
    X, Y, Z = coords(g)
    for z0, z1 in SPANS:
        P.flat(g, sides & (Y >= y0) & (Y < y1) & (Z >= z0) & (Z < z1), "iron", 1)


def _gangway(g, front: bool, rear: bool) -> None:
    for on, (z0, z1) in ((front, (0, 4)), (rear, (L - 4, L))):
        if on:
            g.box(BX - 7, 16, z0, BX + 7, 50, z1, C("iron", 2))


def _flat_cab(g, ramp, shade: int, crown: int) -> np.ndarray:
    """A flat cab front at z = 4 with a short chamfer up to the roof."""
    g.prism("x", [(14, 4), (14, 10), (crown, 10), (crown, 8), (crown - 4, 4)], BX - 21, BX + 21, C(ramp, shade))
    return last(g)


def _finish(g, cab: bool) -> None:
    underframe(g, 10 if cab else 6, L - 4, y0=10, y1=14)
    equipment(g, 46, 114, boxes=3)
    ends(g, L, buffers=False)


def _stock(name, g, roles, parts, clips, sockets, data, powered=True) -> Stock:
    return Stock(name, "metro" if data.get("traction") == "third-rail" else "commuter", L, g, roles, bogies=list(BOGIES),
                 powered=powered, extra_parts=parts, extra_clips=clips, sockets=sockets,
                 data={"floorY": FLOOR_Y, "doors": 8, **data})


# ---------------------------------------------------------------- modern stainless commuter
STAINLESS_LIVERIES = {
    "green-band": {"paint": "leaf", "trim": "arcane", "accent": "khaki"},
    "orange-band": {"paint": "orange", "trim": "arcane", "accent": "khaki"},
    "sky-band": {"paint": "sky", "trim": "arcane", "accent": "khaki"},
    "yellow-band": {"paint": "gold", "trim": "arcane", "accent": "khaki"},
    "blue-band": {"paint": "blue", "trim": "arcane", "accent": "khaki"},
    "pink-band": {"paint": "pink", "trim": "arcane", "accent": "khaki"},
}


def _stainless_body(g, paint, cab: bool):
    X, Y, Z = coords(g)
    crown = 61
    shell = extrude(g, car_profile(21, 14, 54, crown, round_=0.5), 10 if cab else 4, L - 4, "steel", 6)
    if cab:
        shell |= _flat_cab(g, "steel", 6, crown)
    P.flat(g, shell & (Y >= 54), "gray", 5)  # roof
    P.flat(g, shell & (Y < 16), "iron", 3)  # solebar
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    P.flat(g, sides & (Y >= 16) & (Y < 26) & ((Z % 4) == 0), "steel", 5)  # beads on the lower panels
    P.flat(g, sides & (Y >= 27) & (Y < 30), paint, 4)  # line band under the windows
    P.flat(g, sides & (Y >= 48) & (Y < 51), paint, 4)  # and over them
    _door_openings(g, sides, 16, 50)
    _side_windows(g, sides, 12 if cab else 8, L - 8, 32, 47)
    g.box(BX - 12, crown, 24, BX + 12, crown + 2, 36, C("gray", 4))  # roof cooling units
    g.box(BX - 12, crown, 124, BX + 12, crown + 2, 136, C("gray", 4))
    return shell, sides


def stainless_cab(name="commuter-stainless-cab-car", paint="leaf", trim="arcane", accent="khaki") -> Stock:
    """A modern four-door commuter cab car: unpainted stainless sides with a
    line-colour band over and under the windows, a flat front with a big
    dark-surround windscreen, a colour panel, low headlights and a skirt."""
    g = Grid(BW, 72, L + 1)
    shell, sides = _stainless_body(g, paint, True)
    X, Y, Z = coords(g)
    ax = np.abs(X + 0.5 - BX)
    front = shell & (Z < 10)
    P.flat(g, front & (Y >= 30) & (Y < 58) & (ax < 20), trim, 2)  # dark face
    glass(g, front & (Y >= 36) & (Y < 54) & (ax < 17) & (ax > 1))
    P.flat(g, front & (Y >= 18) & (Y < 30) & (ax < 21), paint, 4)  # line-colour panel
    P.flat(g, front & (Y >= 54) & (Y < 57) & (ax < 8), "iron", 1)  # destination display
    P.flat(g, front & (Y == 55) & (ax < 6) & (X % 2 == 0), "ember", 6)
    for sx in (-1, 1):
        P.flat(g, front & (Y >= 21) & (Y < 25) & (np.abs(X + 0.5 - (BX + sx * 14)) < 3), "sand", 7)
    g.box(BX - 19, 3, 5, BX + 19, 10, 8, C(accent, 4))  # skirt
    P.flat(g, sides & (Z >= 12) & (Z < 17) & (Y >= 34) & (Y < 46), "iron", 2)  # cab side window
    glass(g, sides & (Z >= 13) & (Z < 16) & (Y >= 35) & (Y < 45))
    _finish(g, True)
    _gangway(g, False, True)
    d_parts, d_clips = _door_pairs(16, 50, ("steel", 6))
    p_parts, p_clips = pantograph(BX, 63, 44)
    sock, pdata = panto_socket((BX, 63, 44))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts + p_parts, merge_clips(d_clips, p_clips),
                  [("socket-light-f", (BX, 23, 4)), ("socket-cab", (BX, 45, 4)), ("socket-panto", sock)],
                  {"traction": "electric", "set": "commuter-stainless", "liveries": STAINLESS_LIVERIES, **pdata})


def stainless_middle(name="commuter-stainless-middle-car", paint="leaf", trim="arcane", accent="khaki") -> Stock:
    """The matching stainless middle car: gangways at both ends."""
    g = Grid(BW, 72, L + 1)
    _stainless_body(g, paint, False)
    _finish(g, False)
    _gangway(g, True, True)
    d_parts, d_clips = _door_pairs(16, 50, ("steel", 6))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts, d_clips, [],
                  {"traction": "electric", "set": "commuter-stainless", "liveries": STAINLESS_LIVERIES})


# ---------------------------------------------------------------- older painted commuter
PAINTED_LIVERIES = {
    "orange": {"paint": "orange", "trim": "arcane", "accent": "khaki"},
    "green": {"paint": "lime", "trim": "arcane", "accent": "khaki"},
    "sky": {"paint": "sky", "trim": "arcane", "accent": "khaki"},
    "yellow": {"paint": "gold", "trim": "arcane", "accent": "khaki"},
    "blue": {"paint": "blue", "trim": "arcane", "accent": "khaki"},
}


def _painted_body(g, paint, accent, cab: bool):
    X, Y, Z = coords(g)
    crown = 61
    shell = extrude(g, car_profile(21, 14, 53, crown, round_=0.8), 10 if cab else 4, L - 4, paint, 4)
    if cab:
        shell |= _flat_cab(g, paint, 4, crown)
    P.flat(g, shell & (Y >= 53), "gray", 4)  # grey roof
    P.flat(g, shell & (Y < 16), "iron", 3)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    P.flat(g, sides & (Y == 16), paint, 3)  # sill line
    _door_openings(g, sides, 16, 50)
    _side_windows(g, sides, 12 if cab else 8, L - 8, 31, 47, frame=(accent, 4))  # silver sashes
    g.box(BX - 4, crown, 14, BX + 4, crown + 2, L - 14, C("gray", 3))  # roof duct along the middle
    for z in range(22, L - 20, 24):  # roof ventilators either side of it
        for sx in (-1, 1):
            g.box(BX + sx * 9 - 2, crown - 1, z, BX + sx * 9 + 2, crown + 2, z + 6, C("gray", 5))
    return shell, sides


def painted_cab(name="commuter-painted-cab-car", paint="orange", trim="arcane", accent="khaki") -> Stock:
    """The classic older commuter cab car: steel body painted all over in one
    bright line colour, a two-pane front, raised headlights, a small route
    indicator, a grey roof with a duct and ventilators."""
    g = Grid(BW, 72, L + 1)
    shell, sides = _painted_body(g, paint, accent, True)
    X, Y, Z = coords(g)
    ax = np.abs(X + 0.5 - BX)
    front = shell & (Z < 10)
    for sx in (-1, 1):  # two big front panes in dark rubber surrounds
        pane = front & (Y >= 35) & (Y < 51) & (np.abs(X + 0.5 - (BX + sx * 10)) < 7.5)
        P.flat(g, pane, trim, 2)
        glass(g, pane & (Y >= 36) & (Y < 50) & (np.abs(X + 0.5 - (BX + sx * 10)) < 6.5))
    P.flat(g, front & (Y >= 40) & (Y < 46) & (ax < 2), "iron", 1)  # route indicator between the panes
    P.flat(g, front & (Y >= 42) & (Y < 44) & (ax < 1.5), "sand", 7)
    P.flat(g, front & (Y >= 54) & (Y < 57) & (ax < 9), trim, 2)  # headlight housing over the panes
    for sx in (-1, 1):
        round_lamp(g, BX + sx * 5, 55.5, 4, r=1.8, lens=("sand", 7))
        P.flat(g, front & (Y >= 22) & (Y < 25) & (np.abs(X + 0.5 - (BX + sx * 15)) < 2), "ember", 6)  # tail lamps
    g.box(BX - 19, 4, 5, BX + 19, 9, 8, C("iron", 3))  # front bumper and hoses
    P.flat(g, sides & (Z >= 12) & (Z < 17) & (Y >= 33) & (Y < 47), trim, 2)
    glass(g, sides & (Z >= 13) & (Z < 16) & (Y >= 34) & (Y < 46))
    _finish(g, True)
    _gangway(g, False, True)
    d_parts, d_clips = _door_pairs(16, 50, (paint, 4))
    p_parts, p_clips = pantograph(BX, 63, 44)
    sock, pdata = panto_socket((BX, 63, 44))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts + p_parts, merge_clips(d_clips, p_clips),
                  [("socket-light-f", (BX, 55, 4)), ("socket-cab", (BX, 44, 4)), ("socket-panto", sock)],
                  {"traction": "electric", "set": "commuter-painted", "liveries": PAINTED_LIVERIES, **pdata})


def painted_middle(name="commuter-painted-middle-car", paint="orange", trim="arcane", accent="khaki") -> Stock:
    """The matching painted middle car."""
    g = Grid(BW, 72, L + 1)
    _painted_body(g, paint, accent, False)
    _finish(g, False)
    _gangway(g, True, True)
    d_parts, d_clips = _door_pairs(16, 50, (paint, 4))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts, d_clips, [],
                  {"traction": "electric", "set": "commuter-painted", "liveries": PAINTED_LIVERIES})


# ---------------------------------------------------------------- round-fronted subway
ROUNDED_LIVERIES = {
    "red": {"paint": "red", "trim": "skin", "accent": "khaki"},
    "silver-green": {"paint": "khaki", "trim": "leaf", "accent": "skin"},
    "blue": {"paint": "blue", "trim": "skin", "accent": "khaki"},
}


def _rounded_body(g, paint, trim, accent, cab: bool):
    X, Y, Z = coords(g)
    top = 59
    if cab:
        stations = [(3, 17, 14, 47), (7, 19.5, 14, 54), (14, 21, 14, top), (L - 4, 21, 14, top)]
    else:
        stations = [(4, 21, 14, top), (L - 4, 21, 14, top)]
    shell = loft(g, stations, paint, 4, p=3.6, n=20)
    P.flat(g, shell & (Y >= top - 4), "gray", 5)  # roof
    P.flat(g, shell & (Y < 16), "iron", 3)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    band = sides & (Y >= 25) & (Y < 31)
    P.flat(g, band, trim, 6)  # light band under the windows ...
    wave = np.round(28 + 1.6 * np.sin(2 * math.pi * Z / 24)).astype(int)
    P.flat(g, band & ((Y == wave) | (Y == wave + 1)), accent, 3)  # ... carrying a thin wave line
    _door_openings(g, sides, 16, 49)
    _side_windows(g, sides, 16 if cab else 8, L - 8, 33, 47)
    return shell, sides


def rounded_cab(name="metro-rounded-cab-car", paint="red", trim="skin", accent="khaki") -> Stock:
    """A subway cab car with a gently rounded front and a central emergency
    door, a bold body colour, a light band and a wave line along the sides."""
    g = Grid(BW, 66, L + 1)
    shell, sides = _rounded_body(g, paint, trim, accent, True)
    X, Y, Z = coords(g)
    ax = np.abs(X + 0.5 - BX)
    front = shell & (Z < 14)
    door = front & (ax < 4.5) & (Y >= 16) & (Y < 50)
    P.flat(g, door, paint, 3)  # emergency door
    glass(g, door & (ax < 3.5) & (Y >= 36) & (Y < 48))
    for sx in (-1, 1):
        glass(g, front & (Y >= 34) & (Y < 50) & (np.abs(X + 0.5 - (BX + sx * 11)) < 5.5))
        P.flat(g, front & (Y >= 21) & (Y < 25) & (np.abs(X + 0.5 - (BX + sx * 13)) < 2.5), "sand", 7)
    P.flat(g, front & (Y >= 51) & (Y < 54) & (ax < 7), "iron", 1)  # destination
    P.flat(g, front & (Y >= 25) & (Y < 31) & (ax >= 4.5), trim, 6)  # band round the front
    _finish(g, True)
    _gangway(g, False, True)
    d_parts, d_clips = _door_pairs(16, 49, ("steel", 6), glass_rows=(33, 46))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts, d_clips,
                  [("socket-light-f", (BX, 23, 4)), ("socket-cab", (BX, 42, 4))],
                  {"traction": "third-rail", "set": "metro-rounded", "liveries": ROUNDED_LIVERIES})


def rounded_middle(name="metro-rounded-middle-car", paint="red", trim="skin", accent="khaki") -> Stock:
    """The matching round-fronted subway middle car."""
    g = Grid(BW, 66, L + 1)
    _rounded_body(g, paint, trim, accent, False)
    _finish(g, False)
    _gangway(g, True, True)
    d_parts, d_clips = _door_pairs(16, 49, ("steel", 6), glass_rows=(33, 46))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts, d_clips, [],
                  {"traction": "third-rail", "set": "metro-rounded", "liveries": ROUNDED_LIVERIES})


# ---------------------------------------------------------------- retro subway
RETRO_LIVERIES = {
    "yellow": {"paint": "gold", "trim": "arcane", "accent": "khaki"},
    "orange": {"paint": "orange", "trim": "arcane", "accent": "khaki"},
}


def retro_cab(name="metro-retro-cab-car", paint="gold", trim="arcane", accent="khaki") -> Stock:
    """A retro-style subway cab car: bright body, deep rounded roof, a dark
    window surround all round, small round headlights and a centre door."""
    g = Grid(BW, 66, L + 1)
    X, Y, Z = coords(g)
    crown = 60
    shell = extrude(g, car_profile(21, 14, 49, crown, round_=1.0), 4, L - 4, paint, 4)
    ax = np.abs(X + 0.5 - BX)
    P.flat(g, shell & (Y >= 52), paint, 5)  # roof in a lighter shade of the body colour
    P.flat(g, shell & (Y < 16), "iron", 3)
    sides = shell & ((X == BX - 21) | (X == BX + 20))
    P.flat(g, sides & (Y >= 31) & (Y < 48), trim, 2)  # dark window band
    _door_openings(g, sides, 16, 48)
    _side_windows(g, sides, 12, L - 8, 33, 46, frame=(trim, 2))
    P.flat(g, sides & (Y >= 18) & (Y < 20), accent, 5)  # thin silver line low down
    front = shell & (Z < 6)
    P.flat(g, front & (Y >= 31) & (Y < 48), trim, 2)
    for sx in (-1, 1):
        glass(g, front & (Y >= 33) & (Y < 46) & (np.abs(X + 0.5 - (BX + sx * 12)) < 6))
        round_lamp(g, BX + sx * 13, 24, 4, r=2.0, lens=("sand", 7))
    door = front & (ax < 4) & (Y >= 16) & (Y < 48)
    P.flat(g, door, paint, 4)
    glass(g, door & (ax < 3) & (Y >= 34) & (Y < 45))
    P.flat(g, front & (Y >= 49) & (Y < 52) & (ax < 6), "iron", 1)  # small destination
    g.box(BX - 18, 4, 5, BX + 18, 9, 8, C(accent, 4))  # silver bumper
    _finish(g, True)
    _gangway(g, False, True)
    d_parts, d_clips = _door_pairs(16, 48, (paint, 4), glass_rows=(33, 45))
    return _stock(name, g, {"paint": paint, "trim": trim, "accent": accent}, d_parts, d_clips,
                  [("socket-light-f", (BX, 24, 4)), ("socket-cab", (BX, 40, 4))],
                  {"traction": "third-rail", "set": "metro-retro", "liveries": RETRO_LIVERIES})


CATALOG = [
    stock("trams-metro", stainless_cab),
    stock("trams-metro", stainless_middle),
    stock("trams-metro", painted_cab),
    stock("trams-metro", painted_middle),
    stock("trams-metro", rounded_cab),
    stock("trams-metro", rounded_middle),
    stock("trams-metro", retro_cab),
]
