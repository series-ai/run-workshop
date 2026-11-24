"""Trailers: hitch any number behind any vehicle (and behind each other).

A trailer body rides on one axle module (any kind, socket-axle-t) and hangs
off the tow point in front by an A-frame drawbar:
- origin: the axle mount (centre underside, over the axle);
- `socket-coupler`: the drawbar tip, where the `riser` post stands. The riser
  (10 voxels tall at rest, pivot at its foot) scales up or down so the coupler
  meets the tow vehicle's hitch whatever its ride height;
- `socket-hitch`: the rear tow point, so trailers chain.
Every vehicle body has a `socket-hitch` too (bodies.py).
"""
from __future__ import annotations

import math

import numpy as np

from bodies import dust, rust_bloom, sock
from kit import AK, CHALK, CREAM, C, Grid, P, Part, box, coords, ngon, radial
from pnshapes import bar, last

TW = 64
XC = TW // 2
DL = 18  # drawbar length in front of the body
RISER = 10  # riser rest height


def _frame(g: Grid, L: int, half: int = 20) -> None:
    """Floor rails, the A-frame drawbar and the coupler head."""
    rails = box(g, XC - half + 2, 0, DL, XC - half + 6, 4, DL + L, "steel", 3)
    rails |= box(g, XC + half - 6, 0, DL, XC + half - 2, 4, DL + L, "steel", 3)
    for z in range(DL, DL + L, 14):
        rails |= box(g, XC - half + 2, 1, z, XC + half - 2, 4, z + 3, "steel", 2)
    for sx in (-1, 1):
        bar(g, "y", (XC + sx * (half - 4), DL + 2), (XC + sx * 1.5, 4), 2.6, 0, 3, "steel", 3)
    box(g, XC - 3, 0, 0, XC + 3, 4, 6, "iron", 3)  # coupler head
    box(g, XC - 2, 4, 1, XC + 2, 5, 5, "steel", 5)
    for z in (DL + L - 2,):  # rear crossmember with the tail lights and the hitch
        box(g, XC - half, 0, z, XC + half, 5, z + 2, "steel", 3)
        for tx in (XC - half + 1, XC + half - 5):
            P.flat(g, (coords(g)[2] == z + 1) & (coords(g)[0] >= tx) & (coords(g)[0] < tx + 4) & (coords(g)[1] >= 1) & (coords(g)[1] < 4) & (g.a > 0), "red", 6)
    box(g, XC - 2, 0, DL + L, XC + 2, 3, DL + L + 3, "iron", 3)  # hitch receiver
    AK.rust_patches(g, 9, 10, from_ramps=("steel",), rmin=0.8, rmax=1.6)


def _riser() -> Grid:
    g = Grid(TW, 24, 8)
    m = box(g, XC - 1.5, 4, 1, XC + 1.5, 4 + RISER, 4, "steel", 4)
    P.flat(g, m & (coords(g)[1] % 3 == 0), "steel", 2)
    return g


def _trailer(name: str, g: Grid, L: int, axle_frac: float = 0.64) -> tuple[Part, list]:
    za = DL + round(L * axle_frac)
    root = Part(name, None, pivot=(XC, 0, za))
    root.add(Part("body", g, pivot=(XC, 0, za), at=(0, 0, 0)))
    rg = _riser()
    root.add(Part("riser", rg, pivot=(XC, 4, 2.5), at=(0, 4, 2.5 - za)))
    socks = [sock("socket-axle-t", XC, 0, za, za), sock("socket-coupler", XC, 4, 2.5, za), sock("socket-hitch", XC, 1.5, DL + L + 3, za)]
    return root, socks


def tanker(name="tanker", paint="gold", band="iron", accent="red", seed=81):
    """Fuel tanker: a long faceted tank on saddles, dark bands, a catwalk,
    hatches dribbling oil, a rear ladder and a hazard diamond."""
    L = 92
    g = Grid(TW, 48, DL + L + 4)
    _frame(g, L)
    R, yc, n = 16, 22, 12
    ring = lambda r: [(XC + u, yc + v) for u, v in ngon(0, 0, r, n, math.pi / n)]  # noqa: E731
    g.prism("z", ring(R - 3), DL + 1, DL + 4, C(paint, 4), top=ring(R))  # front cap
    g.prism("z", ring(R), DL + 4, DL + L - 4, C(paint, 4))
    g.prism("z", ring(R), DL + L - 4, DL + L - 1, C(paint, 4), top=ring(R - 3))  # rear cap
    X, Y, Z = coords(g)
    tank = (g.a > 0) & (Y > 5)
    P.flat(g, tank & (Y > yc + 8), paint, 5)  # sunlit top
    for zb in (DL + 4, DL + 30, DL + 58, DL + L - 6):
        P.flat(g, tank & (Z >= zb) & (Z < zb + 2), band, 2)
    for zs in (DL + 14, DL + L - 18):  # saddles
        box(g, XC - 10, 3, zs, XC + 10, 9, zs + 4, "steel", 2)
    box(g, XC - 3, yc + R - 1, DL + 8, XC + 3, yc + R + 1, DL + L - 8, "iron", 3)  # catwalk
    for hz in (DL + 22, DL + 46, DL + 70):
        g.prism("y", [(XC + u, hz + v) for u, v in ngon(0, 0, 3.6, 10)], yc + R, yc + R + 3, C("steel", 4))
        P.flat(g, last(g) & (radial(g, "y", XC, hz) < 1.4), "iron", 2)
        P.flat(g, tank & (np.abs(Z - hz) <= 1) & (Y > yc + 2) & ((X - XC) % 7 == 3), "iron", 1)  # oil drips
    # hazard diamond on both sides
    for sx in (XC - R, XC + R - 1):
        d = (np.abs(Z - (DL + L // 2)) + np.abs(Y - yc)) <= 6
        P.flat(g, tank & d & (np.abs(X - sx) <= 1), accent, 5)
        P.flat(g, tank & ((np.abs(Z - (DL + L // 2)) + np.abs(Y - yc)) <= 3) & (np.abs(X - sx) <= 1), "bone", 7)
    for xl in (XC - 4, XC + 2):  # rear ladder
        box(g, xl, 6, DL + L - 1, xl + 2, yc + R, DL + L + 1, "steel", 4)
    for yl in range(8, yc + R, 4):
        box(g, XC - 4, yl, DL + L - 1, XC + 4, yl + 1, DL + L + 1, "steel", 5)
    rust_bloom(g, seed, 14, paint, ys=(6, 40), size=(1.8, 4.0))
    dust(g, tank, 8, seed)
    root, socks = _trailer(name, g, L)
    return root, socks


def cattle(name="cattle", paint="red", frame="steel", accent="gold", seed=82):
    """Stock trailer: slatted sides with dark gaps, posts, a flat roof, a
    rear gate and reflectors."""
    L = 86
    g = Grid(TW, 48, DL + L + 4)
    _frame(g, L)
    x0, x1 = XC - 20, XC + 20
    walls = box(g, x0, 4, DL + 1, x1, 38, DL + L - 2, paint, 4)
    X, Y, Z = coords(g)
    P.flat(g, walls & ((Y - 4) % 6 >= 4) & (Y < 34), "iron", 1)  # slat gaps
    P.flat(g, walls & ((Y - 4) % 6 == 0), paint, 5)  # lit slat edge
    posts = walls & (((Z - DL - 1) % 14) < 2)
    P.flat(g, posts, frame, 3)
    P.flat(g, walls & (Y >= 34), frame, 4)  # top rail
    roof = box(g, x0 - 1, 38, DL, x1 + 1, 40, DL + L - 1, frame, 3)
    P.plates(g, roof, frame, 3, size=(10, 7), seed=3)
    gate = walls & (Z == DL + L - 3)
    P.flat(g, gate, frame, 2)
    P.flat(g, gate & ((Y - 4) % 8 >= 6), "iron", 1)
    for zr in (DL + 4, DL + L - 6):  # reflectors
        P.flat(g, walls & ((X == x0) | (X == x1 - 1)) & (Z >= zr) & (Z < zr + 3) & (Y >= 6) & (Y < 8), accent, 6)
    rust_bloom(g, seed, 16, paint, ys=(5, 36), size=(1.5, 3.5))
    dust(g, walls, 6, seed)
    return _trailer(name, g, L)


def flatbed(name="flatbed", paint="khaki", frame="steel", accent="red", seed=83):
    """Flatbed with a lashed-down scrap load: crates, drums, a tyre stack, a
    tarp lump."""
    L = 84
    g = Grid(TW, 48, DL + L + 4)
    _frame(g, L)
    x0, x1 = XC - 20, XC + 20
    deck = box(g, x0, 4, DL, x1, 7, DL + L - 2, "rust", 4)
    P.plates(g, deck, "rust", 4, size=(9, 8), seed=4)
    side = box(g, x0 - 1, 3, DL, x0 + 1, 8, DL + L - 2, paint, 4) | box(g, x1 - 1, 3, DL, x1 + 1, 8, DL + L - 2, paint, 4)
    for z in range(DL + 2, DL + L - 4, 12):  # stake posts
        for x in (x0 - 1, x1 - 1):
            box(g, x, 7, z, x + 2, 16, z + 2, frame, 3)
    X, Y, Z = coords(g)
    # load: crates, drums, a tyre stack, a tarp lump
    for (cx, cz, s) in ((x0 + 2, DL + 4, 13), (x0 + 3, DL + 18, 10), (XC + 2, DL + 6, 11)):
        c = box(g, cx, 7, cz, cx + s, 7 + s, cz + s, "wood", 4)
        P.flat(g, c & (((X - cx) % s == 0) | ((Y - 7) % s == 0) | ((Z - cz) % s == 0) | ((X - cx) == s - 1) | ((Z - cz) == s - 1)), "darkwood", 3)
    for k, (dx, dz) in enumerate(((XC + 8, DL + 30), (XC + 14, DL + 32), (XC + 9, DL + 40))):
        g.prism("y", [(dx + u, dz + v) for u, v in ngon(0, 0, 4.3, 10)], 7, 21, C(accent, 4))
        dm = last(g)
        P.flat(g, dm & ((Y == 10) | (Y == 17)), accent, 2)
        P.flat(g, dm & (Y == 20), "steel", 4)
    for k in range(3):  # tyre stack
        g.prism("y", [(XC - 9 + u, DL + 60 + v) for u, v in ngon(0, 0, 8, 12, math.pi / 12)], 7 + k * 5, 11 + k * 5, C("iron", 3))
        P.flat(g, last(g) & (radial(g, "y", XC - 9, DL + 60) < 4), "iron", 1)
    g.prism("x", [(7, DL + 50), (15, DL + 54), (17, DL + 66), (14, DL + 78), (7, DL + 80)], XC + 1, x1 - 2, C(paint, 3))  # tarp
    P.flat(g, last(g) & (Z % 6 == 0), paint, 2)
    box(g, XC + 1, 7, DL + 63, x1 - 2, 17, DL + 64, "orange", 5)  # strap
    rust_bloom(g, seed, 8, paint, ys=(3, 9), size=(1.0, 2.0))
    return _trailer(name, g, L)


def camper(name="camper", paint=CREAM, stripe=CHALK, accent="orange", seed=84):
    """Old camper: a rounded box, a sloped front, a window strip, a door, a
    striped awning and propane bottles on the drawbar."""
    L = 78
    g = Grid(TW, 48, DL + L + 4)
    _frame(g, L)
    x0, x1, y0, y1, rr = XC - 20, XC + 20, 4, 40, 8
    prof = []
    for cx, cy, a0 in ((x1 - rr, y1 - rr, 0), (x0 + rr, y1 - rr, 90)):
        for k in range(5):
            a = math.radians(a0 + k * 22.5)
            prof.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    prof = [(x1, y0)] + prof + [(x0, y0)]
    g.prism("z", prof, DL + 4, DL + L - 2, C(paint, 4))
    g.prism("x", [(y0, DL + 4), (y0, DL), (26, DL + 1), (y1 - 3, DL + 10), (y1 - 3, DL + 12), (y0, DL + 12)], x0 + 2, x1 - 2, C(paint, 4))  # sloped nose
    X, Y, Z = coords(g)
    shell = (g.a > 0) & (Y >= y0)
    P.flat(g, shell & (Y > y1 - 4), paint, 5)
    P.flat(g, shell & (Y >= 15) & (Y < 18), stripe, 4)
    P.flat(g, shell & (Y >= 19) & (Y < 20), stripe, 5)
    for s in ("+x", "-x"):
        from bodies import windows_row

        windows_row(g, s, DL + 14, DL + L - 8, 23, 33, 10, 4, frame=(stripe, 2), seed=seed)
    door = (X == x0) & (Z >= DL + 40) & (Z < DL + 50) & (Y >= 5) & (Y < 36) & (g.a > 0)
    P.flat(g, door, paint, 3)
    P.flat(g, door & (Y >= 24) & (Y < 32) & (Z >= DL + 42) & (Z < DL + 48), "navy", 2)
    g.prism("z", [(x0, 36), (x0, 38), (x0 - 9, 33), (x0 - 9, 31)], DL + 36, DL + 56, C(accent, 5))  # awning
    P.flat(g, last(g) & (((Z - DL) // 4) % 2 == 0), "bone", 6)
    for px in (XC - 5, XC + 5):  # propane bottles on the drawbar
        g.prism("y", [(px + u, DL - 4 + v) for u, v in ngon(0, 0, 3, 10)], 3, 13, C("bone", 6),
                top=[(px + u, DL - 4 + v) for u, v in ngon(0, 0, 2.2, 10)])
    rust_bloom(g, seed, 14, paint, ys=(5, 38), size=(1.5, 3.5))
    dust(g, shell, 5, seed)
    return _trailer(name, g, L)


def box_trailer(name="box", paint="bone", stripe="red", accent="steel", seed=85):
    """The 18-wheeler's long box trailer: ribbed sides, a painted stripe,
    rear doors with lock bars, a side skirt and mud flaps."""
    L = 150
    g = Grid(TW, 64, DL + L + 4)
    _frame(g, L)
    x0, x1 = XC - 22, XC + 22
    bx = box(g, x0, 4, DL + 1, x1, 52, DL + L - 2, paint, 5)
    X, Y, Z = coords(g)
    P.flat(g, bx & ((Z - DL) % 10 == 0), paint, 3)  # ribs
    P.flat(g, bx & (Y >= 50), paint, 6)
    P.flat(g, bx & ((X == x0) | (X == x1 - 1)) & (Y >= 30) & (Y < 34), stripe, 4)  # stripe
    doors = bx & (Z == DL + L - 3)
    P.flat(g, doors & (np.abs(X - XC + 0.5) < 0.6), paint, 2)
    for lx in (XC - 12, XC - 6, XC + 5, XC + 11):  # lock bars
        P.flat(g, doors & (X == lx) & (Y > 6) & (Y < 50), accent, 6)
    skirt = box(g, x0 - 1, 4, DL + 30, x0, 12, DL + L - 40, "iron", 2) | box(g, x1, 4, DL + 30, x1 + 1, 12, DL + L - 40, "iron", 2)
    for mx in (x0 + 1, x1 - 4):
        box(g, mx, 0, DL + L - 4, mx + 3, 8, DL + L - 2, "iron", 2)
    rust_bloom(g, seed, 20, paint, ys=(5, 50), size=(1.5, 4.0))
    dust(g, bx, 8, seed)
    return _trailer(name, g, L, axle_frac=0.82)


TRAILERS = {"tanker": tanker, "cattle": cattle, "flatbed": flatbed, "camper": camper, "box": box_trailer}
# main, trim, accent paint ramps (for the editor's swatches)
TRAILER_PAINT = {"box": ("bone", "red", "steel"), "tanker": ("gold", "iron", "red"), "cattle": ("red", "steel", "gold"), "flatbed": ("khaki", "steel", "red"), "camper": ("bone", "sky", "orange")}
