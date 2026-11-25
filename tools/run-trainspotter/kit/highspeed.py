"""High-speed trainsets: a power car with a streamlined nose and matching
intermediate cars. Sets couple nose-out at both ends (run a second power car
reversed at the rear)."""
from __future__ import annotations

import numpy as np

from furniture import ends, equipment, underframe
from railkit import C, FLOOR_Y, Grid, P, coords
from shapes import BW, BX, glass, loft, round_lamp
from catalog import stock
from stock import Bogie, Stock

L = 160


def _paint_set(g, body, paint, trim, accent, X, Y, Z):
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 24) & (Y < 30), trim, 4)  # wide band under the windows
    P.flat(g, body & (Y >= 30) & (Y < 32), accent, 5)


def bullet_nose(name="highspeed-bullet-power-car", paint="skin", trim="blue", accent="sky") -> Stock:
    """A classic round-nosed high-speed power car: a long bulbous nose with a
    domed headlight cluster, a wrap-around windscreen and a blue band."""
    g = Grid(BW, 62, L + 1)
    body = loft(g, [(2, 7, 16, 26), (8, 13, 15, 36), (18, 17.5, 14, 45), (32, 20.5, 14, 53), (48, 21, 14, 57), (156, 21, 14, 57)],
                paint, 5, p=2.6, n=20)
    X, Y, Z = coords(g)
    _paint_set(g, body, paint, trim, accent, X, Y, Z)
    nose_band = body & (Z < 22) & (Y >= 20) & (Y < 30)
    P.flat(g, nose_band, trim, 4)
    ws = body & (Z >= 28) & (Z < 44) & (Y >= 45) & (Y < 54) & (np.abs(X + 0.5 - BX) < 19)
    glass(g, ws)
    P.flat(g, ws & (np.abs(X + 0.5 - BX) < 1), paint, 5)  # centre pillar
    sides = body & ((X == BX - 21) | (X == BX + 20))
    win = sides & (Y >= 34) & (Y < 44) & (Z >= 60) & (Z < 150)
    glass(g, win)
    P.flat(g, win & ((Z - 60) % 12 == 0), paint, 5)
    for x in (BX - 21, BX + 20):  # crew door behind the cab
        P.flat(g, body & (X == x) & (Z >= 46) & (Z < 52) & (Y >= 17) & (Y < 50), paint, 3)
    round_lamp(g, BX, 22, 2, r=3.0, lens=("sand", 7))
    for sx in (-1, 1):
        P.flat(g, body & (Z < 16) & (np.abs(X + 0.5 - (BX + sx * 9)) < 2.5) & (Y >= 20) & (Y < 25), "ember", 6)
    underframe(g, 20, 156, y0=10, y1=15)
    equipment(g, 56, 110, boxes=2)
    ends(g, L, buffers=False, front=False)
    g.box(BX - 7, 16, L - 3, BX + 7, 50, L, C("iron", 2))  # gangway to the next car
    return Stock(name, "power-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 44), Bogie("r", 136)], powered=True, idle="electric",
                 sockets=[("socket-light-f", (BX, 22, 0)), ("socket-cab", (BX, 40, 38)), ("socket-panto", (BX, 57, 110))],
                 data={"traction": "electric", "set": "bullet", "floorY": FLOOR_Y})


def bullet_car(name="highspeed-bullet-car", paint="skin", trim="blue", accent="sky") -> Stock:
    """The matching intermediate car: same section, a long row of windows."""
    g = Grid(BW, 62, L + 1)
    body = loft(g, [(3, 21, 14, 57), (157, 21, 14, 57)], paint, 5, p=2.6, n=20)
    X, Y, Z = coords(g)
    _paint_set(g, body, paint, trim, accent, X, Y, Z)
    sides = body & ((X == BX - 21) | (X == BX + 20))
    win = sides & (Y >= 34) & (Y < 44) & (Z >= 16) & (Z < 144)
    glass(g, win)
    P.flat(g, win & ((Z - 16) % 12 == 0), paint, 5)
    for zd in (6, 148):
        P.flat(g, sides & (Z >= zd) & (Z < zd + 6) & (Y >= 17) & (Y < 50), trim, 3)
    underframe(g, 4, 156, y0=10, y1=15)
    equipment(g, 44, 116, boxes=3)
    for z0, z1 in ((0, 3), (L - 3, L)):
        g.box(BX - 7, 16, z0, BX + 7, 50, z1, C("iron", 2))
    ends(g, L, buffers=False)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28), Bogie("r", 132)], data={"set": "bullet", "floorY": FLOOR_Y})


# ---------------------------------------------------------------- shared for the newer sets
def panto(x: float, y: float, z: float, prefix: str = "panto", arm: float = 14, width: int = 22):
    """moving.pantograph, with its insulators repainted from a swappable ramp
    to a fixed one so a livery swap never touches them."""
    from moving import pantograph

    parts, clips = pantograph(x, y, z, prefix=prefix, arm=arm, width=width)
    for p in parts[0].walk():
        if p.grid is not None:
            p.grid.a[p.grid.a == C("bone", 6)] = C("sand", 6)
    return parts, clips


def oct_section(half: float, y0: float, y1: float, cham: float, cx: float = BX):
    """An eight-sided section: flat floor, flat sides, chamfered roof and sills."""
    c = min(cham, half - 0.5, (y1 - y0) / 2 - 0.5)
    return [(cx - half + c * 0.5, y0), (cx + half - c * 0.5, y0), (cx + half, y0 + c * 0.5), (cx + half, y1 - c),
            (cx + half - c, y1), (cx - half + c, y1), (cx - half, y1 - c), (cx - half, y0 + c * 0.5)]


def _windows(g, body, z0, z1, y0, y1, pitch, paint, shade):
    X, Y, Z = coords(g)
    sides = body & ((X == BX - 21) | (X == BX + 20))
    win = sides & (Y >= y0) & (Y < y1) & (Z >= z0) & (Z < z1)
    glass(g, win)
    P.flat(g, win & ((Z - z0) % pitch == 0), paint, shade)
    return sides


def _intermediate(name, paint, trim, accent, roof_y, setname, stripe):
    """An intermediate car for a set: the power car's section, windows, gangways."""
    from pnshapes import last

    g = Grid(BW, 62, L + 1)
    g.prism("z", oct_section(21, 14, roof_y, 6) if stripe == "wedge" else _round(21, 14, roof_y), 3, 157, C(paint, 5))
    body = last(g)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 17), "iron", 3)
    sides = _windows(g, body, 16, 144, 34, 44, 12, paint, 5)
    if stripe == "wedge":
        P.flat(g, body & (Y >= 17) & (Y < 28), trim, 4)
        P.flat(g, sides & (Y >= 33) & (Y < 45) & ((Z < 16) | (Z >= 144)), accent, 3)
    else:
        P.flat(g, body & (Y >= 29) & (Y < 31), trim, 4)
        P.flat(g, sides & (Y >= 33) & (Y < 45) & (Z >= 16) & (Z < 144) & ((Z - 16) % 12 == 0), accent, 5)
    for zd in (6, 148):  # doors at the car ends
        P.flat(g, sides & (Z >= zd) & (Z < zd + 6) & (Y >= 17) & (Y < 50), trim if stripe != "wedge" else accent, 3)
    underframe(g, 4, 156, y0=10, y1=15)
    equipment(g, 44, 116, boxes=3)
    for z0, z1 in ((0, 3), (L - 3, L)):
        g.box(BX - 7, 16, z0, BX + 7, 50, z1, C("iron", 2))
    ends(g, L, buffers=False)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28), Bogie("r", 132)], data={"set": setname, "floorY": FLOOR_Y})


def _round(half, y0, y1):
    from shapes import section

    return section(half, y0, y1, 2.6, 20)


# ---------------------------------------------------------------- long-nose set
def longnose_power(name="highspeed-longnose-power-car", paint="skin", trim="red", accent="khaki") -> Stock:
    """A sleek pointed-nose power car: a long tapering snout, a raked
    windscreen, a thin red stripe and a silver window band."""
    g = Grid(BW, 62, L + 1)
    body = loft(g, [(1, 4, 20, 27), (9, 10, 17, 36), (22, 15.5, 15, 45), (38, 19.5, 14, 52), (56, 21, 14, 56), (156, 21, 14, 56)],
                paint, 5, p=2.4, n=20)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 28) & (Y < 31), trim, 4)
    ws = body & (Z >= 27) & (Z < 46) & (Y >= 42) & (Y < 53) & (np.abs(X + 0.5 - BX) < 18)
    glass(g, ws)
    sides = _windows(g, body, 62, 150, 34, 44, 12, paint, 5)
    P.flat(g, sides & (Y >= 33) & (Y < 45) & (Z >= 46) & (Z < 62), accent, 4)  # silver band behind the cab
    for x in (BX - 21, BX + 20):
        P.flat(g, body & (X == x) & (Z >= 50) & (Z < 56) & (Y >= 17) & (Y < 48), paint, 3)  # crew door
    P.flat(g, body & (Z < 12) & (Y >= 18) & (Y < 23), trim, 4)  # red chin
    for sx in (-1, 1):
        P.flat(g, body & (Z >= 9) & (Z < 18) & (np.abs(X + 0.5 - (BX + sx * 8)) < 2.5) & (Y >= 24) & (Y < 28), "sand", 7)
    underframe(g, 22, 156, y0=10, y1=15)
    equipment(g, 60, 112, boxes=2)
    ends(g, L, buffers=False, front=False)
    # a sloped pilot under the nose, over the covered coupler (reaches the coupler face)
    g.prism("x", [(6, 0), (13, 0), (19, 12), (19, 26), (6, 26)], BX - 14, BX + 14, C("iron", 3))
    g.box(BX - 7, 16, L - 3, BX + 7, 50, L, C("iron", 2))
    parts, clips = panto(BX, 56, 112)
    return Stock(name, "power-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 46), Bogie("r", 136)], powered=True, idle="electric", extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 26, 9)), ("socket-cab", (BX, 47, 32)), ("socket-panto", (BX, 57, 112))],
                 data={"traction": "electric", "set": "long-nose", "floorY": FLOOR_Y})


def longnose_car(name="highspeed-longnose-car", paint="skin", trim="red", accent="khaki") -> Stock:
    """The matching intermediate car for the long-nose set."""
    return _intermediate(name, paint, trim, accent, 56, "long-nose", "line")


# ---------------------------------------------------------------- wedge set
def wedge_power(name="highspeed-wedge-power-car", paint="skin", trim="orange", accent="arcane") -> Stock:
    """An angular wedge-nosed power car: a faceted nose sloping straight up to
    the cab roof, a bold orange lower body and a dark window surround."""
    g = Grid(BW, 62, L + 1)
    from pnshapes import last

    g.prism("z", oct_section(9, 14, 22, 3), 2, 20, C(paint, 5), top=oct_section(18, 14, 38, 5))
    m = last(g)
    g.prism("z", oct_section(18, 14, 38, 5), 20, 44, C(paint, 5), top=oct_section(21, 14, 56, 6))
    m |= last(g)
    g.prism("z", oct_section(21, 14, 56, 6), 44, 157, C(paint, 5))
    body = m | last(g)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 17) & (Y < 28), trim, 4)  # orange lower body and nose
    P.flat(g, body & (Z < 22), trim, 4)
    ws = body & (Z >= 22) & (Z < 42) & (Y >= 36) & (Y < 54) & (np.abs(X + 0.5 - BX) < 17)
    P.flat(g, body & (Z >= 20) & (Z < 44) & (Y >= 34) & (Y < 56) & (np.abs(X + 0.5 - BX) < 19), accent, 3)
    glass(g, ws)
    sides = _windows(g, body, 60, 150, 34, 44, 12, paint, 5)
    P.flat(g, sides & (Y >= 33) & (Y < 45) & (Z >= 44) & (Z < 60), accent, 3)
    for sx in (-1, 1):
        P.flat(g, body & (Z < 8) & (np.abs(X + 0.5 - (BX + sx * 6)) < 2) & (Y >= 16) & (Y < 20), "sand", 7)
    underframe(g, 20, 156, y0=10, y1=15)
    equipment(g, 58, 112, boxes=2)
    ends(g, L, buffers=False, front=False)
    # a sloped pilot under the nose, over the covered coupler (reaches the coupler face)
    g.prism("x", [(6, 0), (13, 0), (19, 12), (19, 26), (6, 26)], BX - 14, BX + 14, C("iron", 3))
    g.box(BX - 7, 16, L - 3, BX + 7, 50, L, C("iron", 2))
    parts, clips = panto(BX, 56, 112)
    return Stock(name, "power-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 44), Bogie("r", 136)], powered=True, idle="electric", extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 18, 3)), ("socket-cab", (BX, 45, 30)), ("socket-panto", (BX, 57, 112))],
                 data={"traction": "electric", "set": "wedge", "floorY": FLOOR_Y})


def wedge_car(name="highspeed-wedge-car", paint="skin", trim="orange", accent="arcane") -> Stock:
    """The matching intermediate car for the wedge set."""
    return _intermediate(name, paint, trim, accent, 56, "wedge", "wedge")


# ---------------------------------------------------------------- double-deck set
DD_ROOF = 66  # ten voxels taller than the single-deck sets, still inside the loading gauge
DD_LIVERIES = {
    "yellow-line": {"paint": "skin", "trim": "blue", "accent": "gold"},
    "pink-line": {"paint": "skin", "trim": "blue", "accent": "pink"},
}


def _dd_paint(g, body, trim, accent, Y):
    """White above, the lower body (and the lower nose) in the trim colour, a stripe between."""
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 17) & (Y < 34), trim, 4)
    P.flat(g, body & (Y >= 34) & (Y < 37), accent, 5)


def _dd_windows(g, body, z0, z1, paint):
    """Two decks of windows: an upper row under the roof and a lower row just above
    the floor, framed in white so it reads on the blue. The tall section's sides curve
    in toward the roof, so windows go on the whole side-facing skin, not one plane."""
    X, Y, Z = coords(g)
    sides = body & (np.abs(X + 0.5 - BX) >= 17.5)
    span = (Z >= z0) & (Z < z1)
    P.flat(g, sides & span & (Y >= 21) & (Y < 31), paint, 5)  # the lower deck's white frame
    for y0, y1 in ((46, 55), (22, 30)):
        win = sides & span & (Y >= y0) & (Y < y1)
        glass(g, win)
        P.flat(g, win & ((Z - z0) % 10 == 0), paint, 5)  # pillars between the windows
    return sides


def double_deck_power(name="highspeed-double-deck-power-car", paint="skin", trim="blue", accent="gold") -> Stock:
    """A double-deck high-speed power car with a very long nose: it rises from a
    low pointed tip over half the car's length to a cab set high and far back,
    then runs at full double-deck height with two rows of windows. White above,
    a blue lower body and a yellow stripe between."""
    g = Grid(BW, 72, L + 1)
    body = loft(g, [(1, 5, 17, 23), (12, 10, 15.5, 28), (26, 15, 14.5, 34), (42, 18.5, 14, 41), (56, 20.5, 14, 48),
                    (66, 21, 14, 55), (76, 21, 14, 61), (88, 21, 14, DD_ROOF), (156, 21, 14, DD_ROOF)],
                paint, 5, p=2.4, n=20)
    X, Y, Z = coords(g)
    _dd_paint(g, body, trim, accent, Y)
    ws = body & (Z >= 62) & (Z < 80) & (Y >= 50) & (Y < 62) & (np.abs(X + 0.5 - BX) < 17)  # the high, raked cab
    glass(g, ws)
    P.flat(g, ws & (np.abs(X + 0.5 - BX) < 1), paint, 5)
    _dd_windows(g, body, 96, 150, paint)
    for x in (BX - 21, BX + 20):  # crew door behind the cab
        P.flat(g, body & (X == x) & (Z >= 86) & (Z < 92) & (Y >= 17) & (Y < 56), paint, 3)
    for sx in (-1, 1):  # headlights low on the nose
        P.flat(g, body & (Z >= 14) & (Z < 24) & (np.abs(X + 0.5 - (BX + sx * 9)) < 2.5) & (Y >= 24) & (Y < 28), "sand", 7)
    underframe(g, 24, 156, y0=10, y1=15)
    equipment(g, 96, 140, boxes=2)
    ends(g, L, buffers=False, front=False)
    # a sloped pilot under the nose, over the covered coupler (reaches the coupler face)
    g.prism("x", [(6, 0), (13, 0), (19, 12), (19, 26), (6, 26)], BX - 14, BX + 14, C("iron", 3))
    g.box(BX - 7, 16, L - 3, BX + 7, 50, L, C("iron", 2))
    parts, clips = panto(BX, DD_ROOF, 118)
    return Stock(name, "power-car", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 50), Bogie("r", 136)], powered=True, idle="electric", extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 26, 14)), ("socket-cab", (BX, 56, 70)), ("socket-panto", (BX, DD_ROOF + 1, 118))],
                 data={"traction": "electric", "set": "double-deck", "floorY": FLOOR_Y, "decks": 2, "liveries": DD_LIVERIES})


def double_deck_car(name="highspeed-double-deck-car", paint="skin", trim="blue", accent="gold") -> Stock:
    """The matching double-deck intermediate car: the tall section, two decks of
    windows, doors at both ends."""
    from pnshapes import last

    g = Grid(BW, 72, L + 1)
    g.prism("z", _round(21, 14, DD_ROOF), 3, 157, C(paint, 5))
    body = last(g)
    X, Y, Z = coords(g)
    _dd_paint(g, body, trim, accent, Y)
    sides = _dd_windows(g, body, 18, 142, paint)
    for zd in (6, 148):  # doors at the car ends
        P.flat(g, sides & (Z >= zd) & (Z < zd + 6) & (Y >= 17) & (Y < 50), paint, 3)
    underframe(g, 4, 156, y0=10, y1=15)
    equipment(g, 44, 116, boxes=3)
    for z0, z1 in ((0, 3), (L - 3, L)):
        g.box(BX - 7, 16, z0, BX + 7, 50, z1, C("iron", 2))
    ends(g, L, buffers=False)
    return Stock(name, "coach", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 28), Bogie("r", 132)], data={"set": "double-deck", "floorY": FLOOR_Y, "decks": 2, "liveries": DD_LIVERIES})


CATALOG = [
    stock("high-speed-trains", bullet_nose, tier="slice"),
    stock("high-speed-trains", bullet_car, tier="slice"),
    stock("high-speed-trains", longnose_power),
    stock("high-speed-trains", longnose_car),
    stock("high-speed-trains", wedge_power),
    stock("high-speed-trains", wedge_car),
    stock("high-speed-trains", double_deck_power),
    stock("high-speed-trains", double_deck_car),
]
