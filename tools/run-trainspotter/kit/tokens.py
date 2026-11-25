"""Board-game tokens for route-building games: chunky, readable pieces with
paint, trim and accent roles, so a game recolours them per player (the same
ramp swap the vehicles use). Each token's origin is the centre of its base."""
from __future__ import annotations

import numpy as np

from catalog import plain
from railkit import C, Grid, P, Part, coords


def _chamfer_box(w: float, h: float, c: float, x0: float = 0, y0: float = 0):
    """(x, y) outline of a box w wide, h tall with its top corners cut by c."""
    return [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h - c), (x0 + w - c, y0 + h), (x0 + c, y0 + h), (x0, y0 + h - c)]


def train_car(name="token-train-car", paint="red", trim="bone", accent="gold"):
    """A little train-car piece: a chamfered body, a rounded roof, windows and
    four wheel studs. Lay a row of them along a route."""
    W, L = 18, 34
    g = Grid(W, 18, L)
    g.prism("z", _chamfer_box(W - 2, 9, 2, 1, 3), 1, L - 1, C(paint, 4))
    g.prism("z", _chamfer_box(W - 4, 5, 2.5, 2, 12), 2, L - 2, C(trim, 5))  # roof
    X, Y, Z = coords(g)
    body = (g.a > 0) & (Y < 12)
    P.flat(g, body & (Y >= 6) & (Y < 10) & ((X == 1) | (X == W - 2)) & ((Z - 4) % 7 < 4) & (Z >= 4) & (Z < L - 4), "navy", 3)
    P.flat(g, body & (Y == 4), trim, 4)  # waist stripe
    for z in (7, L - 9):  # wheel studs
        for x in (0, W - 2):
            g.box(x, 0, z, x + 2, 4, z + 3, C("iron", 2))
    for z0, z1 in ((0, 1), (L - 1, L)):  # coupler studs
        g.box(W // 2 - 2, 4, z0, W // 2 + 2, 7, z1, C(accent, 5))
    root = Part(name, g, pivot=(W / 2, 0, L / 2))
    return root, [], [], {"kind": "token", "paint": paint, "trim": trim, "accent": accent, "length": L}


def station_marker(name="token-station", paint="bone", trim="blue", accent="red"):
    """A station marker: a little house with a pitched roof on a round-cornered
    base plate in the player colour."""
    S = 26
    g = Grid(S, 28, S)
    g.prism("y", [(2, 0), (S - 2, 0), (S, 2), (S, S - 2), (S - 2, S), (2, S), (0, S - 2), (0, 2)], 0, 3, C(trim, 4))  # base
    g.box(6, 3, 6, S - 6, 15, S - 6, C(paint, 5))  # house
    g.prism("x", [(15, 4), (15, S - 4), (25, S / 2)], 4, S - 4, C(accent, 4))  # roof, ridge along x
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Z == S - 7) & (X >= 11) & (X < 15) & (Y >= 3) & (Y < 11), trim, 2)  # door
    for x in (7, S - 9):
        P.flat(g, (g.a > 0) & (Z == S - 7) & (X >= x) & (X < x + 2) & (Y >= 8) & (Y < 12), "navy", 3)  # windows
    g.box(S - 10, 18, 9, S - 7, 26, 12, C(trim, 3))  # chimney
    root = Part(name, g, pivot=(S / 2, 0, S / 2))
    return root, [], [], {"kind": "token", "paint": paint, "trim": trim, "accent": accent}


def route_segment(name="token-route", paint="teal", trim="skin", accent="gold"):
    """A route segment tile: a bevelled slab with a painted track stripe and a
    stud at each end. Claim a route by laying segments along it."""
    W, H, L = 16, 5, 46
    g = Grid(W, H + 1, L)
    g.prism("z", _chamfer_box(W, H, 1.5), 0, L, C(paint, 4))
    X, Y, Z = coords(g)
    top = (g.a > 0) & (Y == H - 1)
    P.flat(g, top & ((X == 5) | (X == W - 6)), trim, 6)  # rails
    P.flat(g, top & (X > 5) & (X < W - 6) & (Z % 6 == 3), trim, 4)  # sleepers
    for z0 in (2, L - 6):
        g.box(W // 2 - 2, H, z0, W // 2 + 2, H + 1, z0 + 4, C(accent, 5))
    P.flat(g, (g.a > 0) & ((Z < 2) | (Z >= L - 2)) & (Y >= 1) & (Y < H), accent, 5)  # end caps
    root = Part(name, g, pivot=(W / 2, 0, L / 2))
    return root, [], [], {"kind": "token", "paint": paint, "trim": trim, "accent": accent, "length": L}


CATALOG = [
    plain("board-game-tokens", train_car, "props", "kit", "tokens"),
    plain("board-game-tokens", station_marker, "props", "kit", "tokens"),
    plain("board-game-tokens", route_segment, "props", "kit", "tokens"),
]
