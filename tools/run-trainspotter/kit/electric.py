"""Electric locomotives. Every one carries one or two single-arm pantographs
(moving.pantograph): down at rest, `open` raises them, `close` lowers them.
socket-panto sits on the lowered head; the catalogue's `pantoRaise` says how
far the head rises to the wire."""
from __future__ import annotations

import numpy as np

from catalog import stock
from furniture import ends
from locokit import (chamfer_box, end_lamps, louvres, off_axis, panto_socket, roof_fans, side_region, side_windows, warning_end,
                     windscreen)
from moving import merge_clips, pantograph
from railkit import C, Grid, P, coords
from pnshapes import last
from shapes import BW, BX, extrude, glass, loft, round_lamp
from stock import Axle, Bogie, Rods, Stock

L = 160


def _pantos(roof_y: float, zs, x: float = BX):
    """Pantographs on the roof at the given z (body-grid); -> (parts, clips, socket, data)."""
    parts, clips = [], []
    for k, z in enumerate(zs):
        p, c = pantograph(x, roof_y, z, prefix="panto" if k == 0 else "panto-b")
        parts += p
        clips.append(c)
    # insulators on a fixed ramp, so a livery swap to cream never touches them
    for part in (q for top in parts for q in top.walk()):
        if part.grid is not None:
            for shade in range(8):
                part.grid.a[part.grid.a == C("bone", shade)] = C("sand", shade)
    sock, data = panto_socket((x, roof_y, zs[0]))
    return parts, merge_clips(*clips), sock, data


def _roof_gear(g: Grid, y: int, zs, half: int = 10) -> None:
    """Insulators and cable runs on the roof between the pantographs."""
    for z in zs:
        for sx in (-1, 1):
            g.box(BX + sx * half - 1, y, z - 1, BX + sx * half + 1, y + 3, z + 1, C("sand", 7))
    g.box(BX - 1, y, min(zs), BX + 1, y + 1, max(zs) + 1, C("steel", 4))


def streamlined_deco(name="electric-streamlined-deco", paint="magenta", trim="gold", accent="arcane") -> Stock:
    """An art-deco streamlined express engine: a smooth body rounded at both
    ends, gold stripes that sweep together at each nose, two pantographs."""
    g = Grid(BW, 66, L + 1)
    st = [(3, 11, 14, 30), (10, 16.5, 14, 42), (20, 20, 14, 52), (34, 21, 14, 59)]
    body = loft(g, st + [(L - z, w, a, b) for z, w, a, b in reversed(st)], paint, 4, p=2.8, n=20)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 17), "iron", 3)
    # three bold pinstripes that close up toward each nose
    taper = np.clip(np.minimum(Z - 3, L - 3 - Z) / 34.0, 0.15, 1.0)
    for k in (-1, 0, 1):
        stripe = body & (np.abs(Y + 0.5 - (31 + 5 * k * taper)) < 1.0) & (off_axis(g) > 14)
        P.flat(g, stripe, trim, 6)
    for front in (True, False):
        zr = (14, 30) if front else (L - 30, L - 14)
        glass(g, body & (Z >= zr[0]) & (Z < zr[1]) & (Y >= 42) & (Y < 52) & (off_axis(g) > 1.5) & (off_axis(g) < 15))
    side_windows(g, body, 21, 34, 44, 40, 50)
    side_windows(g, body, 21, L - 44, L - 34, 40, 50)
    louvres(g, body, 21, 56, 104, 42, 52, pitch=2)
    round_lamp(g, BX, 24, 4, r=2.6, lens=("sand", 7))
    round_lamp(g, BX, 24, L - 4, r=2.6, lens=("sand", 7), front=False)
    ends(g, L, buffers=False)
    parts, clips, sock, pdata = _pantos(59, (60, 100))
    _roof_gear(g, 58, (68, 92))
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 32, r=9, wheelbase=26), Bogie("r", 128, r=9, wheelbase=26)], powered=True, idle="electric",
                 extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 24, 2)), ("socket-cab", (BX, 46, 18)), ("socket-panto", sock)],
                 data={"traction": "electric", **pdata})


def articulated_freight(name="electric-articulated-freight", paint="forest", trim="arcane", accent="red") -> Stock:
    """A heavy articulated freight engine: long low hoods sloping down to
    each end, a tall centre cab, side rods on two groups of coupled wheels."""
    g = Grid(BW, 72, L + 1)
    X, Y, Z = coords(g)
    deck = extrude(g, [(BX - 22, 13), (BX + 22, 13), (BX + 22, 17), (BX - 22, 17)], 4, 156, trim, 3)
    P.flat(g, deck & (Y == 16) & (off_axis(g) > 20), accent, 5)
    front = loft(g, [(6, 15, 17, 34), (54, 15, 17, 46)], paint, 4, p=6, n=16)
    rear = loft(g, [(106, 15, 17, 46), (154, 15, 17, 34)], paint, 4, p=6, n=16)
    cab = extrude(g, chamfer_box(20, 17, 64, ch=4), 54, 106, paint, 4)
    P.flat(g, cab & (Y >= 61), "iron", 3)
    for hood in (front, rear):
        P.flat(g, hood & (Z % 10 == 0) & (Y > 18), paint, 3)  # hood doors
    louvres(g, front, 15, 14, 50, 22, 32, pitch=2)
    louvres(g, rear, 15, 110, 146, 22, 32, pitch=2)
    windscreen(g, cab, True, 48, 58, xhalf=16, depth=1)
    windscreen(g, cab, False, 48, 58, xhalf=16, depth=1)
    side_windows(g, cab, 20, 60, 100, 46, 58, w=10, gap=4)
    for z in (66, 90):  # cab doors
        P.flat(g, side_region(g, cab, 20, z, z + 6, 18, 44), paint, 3)
    round_lamp(g, BX, 28, 6, r=2.2, lens=("sand", 7))
    round_lamp(g, BX, 28, 154, r=2.2, lens=("sand", 7), front=False)
    ends(g, L, beam=(accent, 4))
    parts, clips, sock, pdata = _pantos(64, (80,))
    face = dict(face=("iron", 3), spokes=0, counterweight=True)
    rods = [Rods(["wheel-a1", "wheel-a2"], "wheel-a2", crank=4, slide_y=9, main_len=14, x=20),
            Rods(["wheel-a3", "wheel-a4"], "wheel-a3", crank=4, slide_y=9, main_len=14, x=20, tag="-b")]
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 axles=[Axle("wheel-a1", 22, 9, face), Axle("wheel-a2", 42, 9, face), Axle("wheel-a3", 118, 9, face), Axle("wheel-a4", 138, 9, face)],
                 rods=rods, powered=True, idle="electric", extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 28, 4)), ("socket-cab", (BX, 53, 54)), ("socket-panto", sock)],
                 data={"traction": "electric", "articulated": True, **pdata})


def boxcab(name="electric-boxcab", paint="arcane", trim="gold", accent="red") -> Stock:
    """An early box-cab electric: a riveted box body with three-window ends,
    louvres along the sides and roof equipment between two pantographs."""
    Lb = 128
    g = Grid(BW, 64, Lb + 1)
    body = extrude(g, chamfer_box(21, 14, 56, ch=3), 6, 122, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y >= 54), "gray", 3)
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 24) & (Y < 26), trim, 5)  # lining
    rivets = side_region(g, body, 21, 6, 122, 17, 53) & ((Z - 6) % 6 == 0) & ((Y - 17) % 6 == 0)
    P.flat(g, rivets, paint, 2)
    for front in (True, False):
        m = windscreen(g, body, front, 40, 50, xhalf=17, depth=1, pillar=False)
        P.flat(g, m & (np.abs(off_axis(g) - 6) < 0.8), paint, 3)  # two pillars: three panes
    louvres(g, body, 21, 26, 102, 34, 46, pitch=2)
    for z in (14, 108):  # cab doors
        P.flat(g, side_region(g, body, 21, z, z + 6, 17, 50), paint, 3)
        glass(g, side_region(g, body, 21, z + 1, z + 5, 40, 48))
    end_lamps(g, 6, True, y=22, spread=12, top=52)
    end_lamps(g, 122, False, y=22, spread=12, top=52)
    g.box(BX - 8, 56, 44, BX + 8, 60, 84, C("iron", 3))  # resistor box
    _roof_gear(g, 56, (40, 88))
    ends(g, Lb, beam=(accent, 4))
    parts, clips, sock, pdata = _pantos(56, (26, 102))
    return Stock(name, "locomotive", Lb, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 26, r=9, wheelbase=24), Bogie("r", 102, r=9, wheelbase=24)], powered=True, idle="electric",
                 extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 22, 4)), ("socket-cab", (BX, 45, 6)), ("socket-panto", sock)],
                 data={"traction": "electric", **pdata})


def modern(name="electric-modern", paint="red", trim="skin", accent="khaki") -> Stock:
    """A modern four-axle electric: a smooth body with steeply sloped cab
    fronts, big windscreens, flush louvres and two pantographs."""
    g = Grid(BW, 66, L + 1)
    st = [(4, 18, 14, 38), (10, 20.5, 14, 50), (20, 21, 14, 58)]
    body = loft(g, st + [(L - z, w, a, b) for z, w, a, b in reversed(st)], paint, 4, p=4.5, n=20)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 18), "iron", 3)
    P.flat(g, body & (Y >= 18) & (Y < 21), accent, 5)  # skirt line
    P.flat(g, body & (Y >= 46) & (Z >= 26) & (Z < L - 26), trim, 6)  # light upper band
    for front in (True, False):
        zr = (8, 20) if front else (L - 20, L - 8)
        glass(g, body & (Z >= zr[0]) & (Z < zr[1]) & (Y >= 40) & (Y < 53) & (off_axis(g) > 1) & (off_axis(g) < 18))
        warning_end(g, body, front, accent, 6, 22, 36, depth=4, xhalf=16)
    side_windows(g, body, 21, 22, 30, 42, 52)
    side_windows(g, body, 21, L - 30, L - 22, 42, 52)
    louvres(g, body, 21, 44, 116, 30, 44, pitch=2)
    end_lamps(g, 5, True, y=26, spread=11, top=None)
    end_lamps(g, L - 5, False, y=26, spread=11, top=None)
    _roof_gear(g, 58, (62, 98))
    ends(g, L, buffers=True)
    parts, clips, sock, pdata = _pantos(58, (52, 108))
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 36, r=9, wheelbase=26), Bogie("r", 124, r=9, wheelbase=26)], powered=True, idle="electric",
                 extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 26, 3)), ("socket-cab", (BX, 46, 14)), ("socket-panto", sock)],
                 data={"traction": "electric", **pdata})


def express_blue(name="electric-express-blue", paint="blue", trim="khaki", accent="skin") -> Stock:
    """A blue express electric with raked-back cab fronts, a wide silver
    band along the body and fine white lining."""
    g = Grid(BW, 66, L + 1)
    # side silhouette (y, z): low nose, windscreen raked back to the roof, the same at the rear
    sil = [(14, 4), (14, L - 4), (40, L - 4), (58, L - 18), (58, 18), (40, 4)]
    g.prism("x", sil, BX - 21, BX + 21, C(paint, 4))
    body = last(g)
    X, Y, Z = coords(g)
    P.flat(g, body & (Y < 17), "iron", 3)
    P.flat(g, body & (Y >= 24) & (Y < 34) & (Z >= 10) & (Z < L - 10), trim, 6)  # silver band
    P.flat(g, body & ((Y == 23) | (Y == 34)) & (Z >= 10) & (Z < L - 10), accent, 6)
    P.flat(g, body & (Y >= 56), "gray", 4)
    for front in (True, False):
        zr = (6, 18) if front else (L - 18, L - 6)
        ws = body & (Z >= zr[0]) & (Z < zr[1]) & (Y >= 42) & (Y < 56) & (off_axis(g) > 1) & (off_axis(g) < 18)
        glass(g, ws)
    side_windows(g, body, 21, 20, 30, 42, 52)
    side_windows(g, body, 21, L - 30, L - 20, 42, 52)
    louvres(g, body, 21, 40, 120, 38, 50, pitch=2)
    end_lamps(g, 4, True, y=22, spread=12)
    end_lamps(g, L - 4, False, y=22, spread=12)
    _roof_gear(g, 58, (64, 96))
    ends(g, L)
    parts, clips, sock, pdata = _pantos(58, (54, 106))
    return Stock(name, "locomotive", L, g, {"paint": paint, "trim": trim, "accent": accent},
                 bogies=[Bogie("f", 36, r=9, wheelbase=26), Bogie("r", 124, r=9, wheelbase=26)], powered=True, idle="electric",
                 extra_parts=parts, extra_clips=clips,
                 sockets=[("socket-light-f", (BX, 22, 2)), ("socket-cab", (BX, 48, 12)), ("socket-panto", sock)],
                 data={"traction": "electric", **pdata})


CATALOG = [
    stock("electric-locomotives", streamlined_deco),
    stock("electric-locomotives", articulated_freight),
    stock("electric-locomotives", boxcab),
    stock("electric-locomotives", modern),
    stock("electric-locomotives", express_blue),
]
