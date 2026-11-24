"""Even more bodies (Sterf's round-2 car notes): an armchair, a round bug
with big wheel-well guards, a 60s cruiser, an El Camino, a hearse, a
frankencar (two cars welded nose to nose), an 18-wheeler tractor, a tow
truck and an RV. Same socket contract as bodies.py.
"""
from __future__ import annotations

import math

import numpy as np

from bodies import BW, XC, _root, dust, face_window, headlight, paint_shell, rust_bloom, sock, wheel_socks
from kit import CREAM, MINT, PAINT_ORANGE, WB, C, Grid, P, box, coords, ngon
from pnshapes import bar, last


# ---------------------------------------------------------------- helpers


def section(w: float, y0: float, y1: float, p: float = 3.0, n: int = 16):
    """Rounded cross-section in (x, y): a superellipse `w` half-wide spanning
    y0..y1 (p = 2 is an ellipse, higher is boxier). Flat on the bottom."""
    cy, h = (y0 + y1) / 2, (y1 - y0) / 2
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        x = XC + w * math.copysign(abs(c) ** (2 / p), c)
        y = cy + h * math.copysign(abs(s) ** (2 / p), s)
        pts.append((x, max(y0, y)))
    return pts


def loft(g: Grid, stations, ramp: str, shade: int = 4, p: float = 3.0, n: int = 16) -> np.ndarray:
    """A rounded body swept along z through `stations` [(z, half_width, y0,
    y1), ...]: frustum prisms between consecutive rounded sections."""
    m = np.zeros(g.shape, bool)
    for (za, wa, a0, a1), (zb, wb, b0, b1) in zip(stations, stations[1:]):
        g.prism("z", section(wa, a0, a1, p, n), za, zb, C(ramp, shade), top=section(wb, b0, b1, p, n))
        m |= last(g)
    return m


def guard(g: Grid, zc: float, r: float, x0: float, x1: float, y0: float, ramp: str, shade: int) -> np.ndarray:
    """A big round wheel-well guard: a half disc standing on the sill,
    bulging out of the body side between x0 and x1."""
    pts = [(y0 + r * math.sin(a), zc + r * math.cos(a)) for a in np.linspace(0, math.pi, 13)]
    g.prism("x", pts, x0, x1, C(ramp, shade))
    return last(g)


def chrome_bumper(g: Grid, x0, x1, y0, y1, z0, z1) -> np.ndarray:
    m = box(g, x0, y0, z0, x1, y1, z1, "steel", 6)
    P.flat(g, m & (coords(g)[1] == int(y0)), "steel", 4)
    return m


def round_lamp(g: Grid, x, y, zface, r=2.6, glass="gold", face=-1) -> None:
    """A round lamp: a steel housing two voxels deep at the body face
    (zface >= 1) with the glass painted on its outer face (-1 front, +1 back)."""
    g.prism("z", [(x + u, y + v) for u, v in ngon(0, 0, r, 10)], zface - 1, zface + 1, C("steel", 5))
    m = last(g)
    X, Y, Z = coords(g)
    outer = (Z == zface - 1) if face < 0 else (Z == zface)
    P.flat(g, m & outer & ((X + 0.5 - x) ** 2 + (Y + 0.5 - y) ** 2 < (r - 0.8) ** 2), glass, 7)


def glass(g: Grid, mask, glint=True) -> None:
    X, Y, Z = coords(g)
    P.flat(g, mask, "navy", 2)
    if glint:
        P.flat(g, mask & ((X + Y + Z) % 9 == 3), "navy", 5)


def finish(g, shell, paint, seed, rust=14, dust_h=4, ys=(2, 40)):
    rust_bloom(g, seed, rust, paint, ys=ys, size=(1.5, 3.5))
    dust(g, shell, dust_h, seed)


# ---------------------------------------------------------------- bodies


def armchair(name="armchair", paint=MINT, cushion=CREAM, piping=PAINT_ORANGE, seed=101):
    """One big overstuffed armchair: a deep seat cushion, a tall rounded back,
    fat rolled arms with orange piping, stubby wooden feet."""
    L, cls = 46, "S"
    zm = 23
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    base = box(g, XC - 18, 0, 2, XC + 18, 9, L - 2, "darkwood", 3)
    back = [(9, L - 15), (36, L - 13), (42, L - 10), (44, L - 6), (42, L - 2), (9, L - 2)]
    g.prism("x", back, XC - 12, XC + 12, C(paint, 4))
    backm = last(g)
    g.prism("x", [(9, 4), (15, 4), (17, 6), (17, L - 14), (9, L - 14)], XC - 11, XC + 11, C(cushion, 5))  # seat cushion
    cush = last(g)
    arms = np.zeros(g.shape, bool)
    for sx in (-1, 1):
        ax = XC + sx * 15
        roll = [(ax - 4, 9), (ax + 4, 9), (ax + 4, 21), (ax + 6, 24), (ax + 5, 28), (ax + 2, 30), (ax - 2, 30), (ax - 5, 28), (ax - 6, 24), (ax - 4, 21)]
        g.prism("z", roll, 3, L - 3, C(paint, 4))
        arms |= last(g)
    shell = backm | arms
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, arms & (np.abs(Y - 21.5) < 0.6), piping, 5)
    P.flat(g, arms & ((Z < 4) | (Z >= L - 4)) & (Y > 9), piping, 5)  # arm ends
    P.flat(g, backm & (np.abs(Y - 43) < 0.6), piping, 5)
    P.flat(g, backm & (np.abs(X - XC + 0.5) < 0.6) & (Y > 18), paint, 2)  # button seam
    for by in (24, 32):
        P.flat(g, backm & (np.abs(X - XC + 0.5) < 1) & (np.abs(Y - by) < 1) & (Z < L - 12), "steel", 3)  # buttons
    P.flat(g, cush & (Y == 16) & ((X - XC) % 11 == 0), cushion, 3)
    for fx in (XC - 17, XC + 14):  # stubby feet
        for fz in (3, L - 6):
            box(g, fx, 0, fz, fx + 3, 2, fz + 3, "wood", 5)
    finish(g, shell, paint, seed, rust=6, dust_h=0)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L - 2, zm), sock("socket-front", XC, 5, 2, zm),
                                    sock("socket-roof", XC, 44, L - 7, zm),
                                    sock("socket-stack-l", XC + 15, 30, L - 8, zm), sock("socket-stack-r", XC - 15, 30, L - 8, zm),
                                    sock("socket-seat", XC, 17, 18, zm)]
    return _root(name, g, zm, cls), cls, socks


def bug(name="bug", paint="sky", trim=CREAM, seed=102):
    """A round little bug: a domed body lofted from bumper to bumper, a
    rounded roof, and four big round wheel-well guards bulging off the sides."""
    L, cls = 66, "S"
    zm = 33
    g = Grid(BW, 60, L)
    X, Y, Z = coords(g)
    st = [(1, 11, 3, 11), (6, 16, 2, 17), (16, 18, 2, 21), (24, 18.5, 2, 33), (34, 18.5, 2, 39), (46, 18.5, 2, 37), (56, 17, 2, 26), (65, 12, 3, 13)]
    shell = loft(g, st, paint, 4, p=2.6)
    for zc in (zm - WB[cls] / 2, zm + WB[cls] / 2):
        for xa, xb in ((XC - 22, XC - 15), (XC + 15, XC + 22)):
            shell |= guard(g, zc, 12, xa, xb, 3, paint, 4)
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    # windows on the dome: screen, sides and the split rear window
    up = (Y >= 24) & (Y < 36)
    glass(g, shell & up & (Z >= 21) & (Z < 27) & (np.abs(X - XC + 0.5) < 12))
    for sx in (-1, 1):
        glass(g, shell & up & (Y < 34) & (Z >= 29) & (Z < 52) & (np.abs(X - XC + 0.5) > 13) & (np.abs(Z - 40) > 1))
    glass(g, shell & (Y >= 25) & (Y < 33) & (Z >= 52) & (Z < 58) & (np.abs(X - XC + 0.5) < 7) & (np.abs(X - XC + 0.5) > 1))
    P.flat(g, shell & (Y >= 10) & (Y < 12), trim, 6)  # waist stripe
    for hx in (XC - 18.5, XC + 18.5):
        round_lamp(g, hx, 12, int(zm - WB[cls] / 2 - 8), r=2.6)  # lamps on the front guards
    chrome_bumper(g, XC - 17, XC + 17, 2, 5, 0, 2)
    chrome_bumper(g, XC - 17, XC + 17, 2, 5, L - 2, L)
    for xa in (XC - 19, XC + 16):  # running boards between the guards
        box(g, xa, 2, zm - 7, xa + 3, 4, zm + 7, "iron", 3)
    finish(g, shell, paint, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 39, 38, zm), sock("socket-hood", XC, 19, 12, zm)]
    return _root(name, g, zm, cls), cls, socks


def cruiser(name="cruiser", paint="red", trim=CREAM, seed=103):
    """A big rounded 60s land yacht: long low lofted body, a bubble roof,
    skirted rear wheels, tail fins and chrome everywhere."""
    L, cls = 120, "M"
    zm = 62
    g = Grid(BW, 50, L)
    X, Y, Z = coords(g)
    st = [(1, 18, 2, 11), (8, 21, 1, 14), (30, 21, 1, 16), (42, 21, 1, 17), (50, 20, 1, 28), (60, 19, 1, 31), (76, 19, 1, 30),
          (86, 20.5, 1, 18), (110, 21, 1, 16), (119, 19, 2, 12)]
    shell = loft(g, st, paint, 4, p=3.4)
    for sx in (-1, 1):  # tail fins
        fx = XC + sx * 18
        g.prism("x", [(14, 88), (16, 88), (24, L - 4), (14, L - 1)], min(fx, fx + sx * 3), max(fx, fx + sx * 3), C(paint, 4))
        shell |= last(g)
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, shell & (Y >= 28), trim, 6)  # white roof
    glass(g, shell & (Y >= 18) & (Y < 28) & (Z >= 47) & (Z < 54) & (np.abs(X - XC + 0.5) < 15))
    glass(g, shell & (Y >= 18) & (Y < 27) & (Z >= 56) & (Z < 82) & (np.abs(X - XC + 0.5) > 15) & (np.abs(Z - 68) > 1))
    glass(g, shell & (Y >= 18) & (Y < 26) & (Z >= 80) & (Z < 86) & (np.abs(X - XC + 0.5) < 15))
    P.flat(g, shell & (Y >= 9) & (Y < 10), "steel", 6)  # chrome side spear
    P.flat(g, shell & (Y < 9) & (Z >= zm + 12) & (Z < zm + 34) & (np.abs(X - XC + 0.5) > 19), paint, 3)  # fender skirts
    for hx in (XC - 15, XC - 10, XC + 10, XC + 15):
        round_lamp(g, hx, 9, 2, r=2.2)
    grille = shell & (Z <= 2) & (np.abs(X - XC + 0.5) < 7) & (Y >= 4) & (Y < 10)
    P.flat(g, grille, "steel", 5)
    P.flat(g, grille & (X % 2 == 0), "iron", 2)
    for tx in (XC - 18, XC + 16):
        P.flat(g, shell & (Z >= L - 6) & (X >= tx) & (X < tx + 2) & (Y >= 17) & (Y < 22), "red", 6)  # fin lights
    chrome_bumper(g, XC - 20, XC + 20, 2, 6, 0, 2)
    chrome_bumper(g, XC - 20, XC + 20, 2, 6, L - 2, L)
    finish(g, shell, paint, seed, ys=(2, 30))
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 31, 66, zm), sock("socket-hood", XC, 15, 24, zm),
                                    sock("socket-stack-l", XC + 16, 17, 96, zm), sock("socket-stack-r", XC - 16, 17, 96, zm)]
    return _root(name, g, zm, cls), cls, socks


def camino(name="camino", paint="orange", stripe="iron", seed=104):
    """El Camino: a muscle car up front, a pickup bed out back."""
    L, cls = 112, "M"
    zm = 60
    g = Grid(BW, 48, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 20, XC + 20
    g.prism("x", [(0, 3), (9, 1), (14, 3), (15, 34), (15, L - 2), (12, L - 1), (0, L - 2)], x0, x1, C(paint, 4))
    low = last(g)
    g.prism("x", [(15, 40), (26, 50), (27, 62), (15, 70)], x0 + 3, x1 - 3, C(paint, 4))  # cab with sail panels
    cab = last(g)
    bed = box(g, x0, 15, 70, x0 + 2, 19, L - 2, paint, 4) | box(g, x1 - 2, 15, 70, x1, 19, L - 2, paint, 4) | box(g, x0 + 2, 15, L - 4, x1 - 2, 18, L - 2, paint, 3)
    shell = low | cab | bed
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, low & (Y >= 14) & (Z >= 72) & (Z < L - 4) & (np.abs(X - XC + 0.5) < 17), "iron", 2)  # bed floor
    P.flat(g, low & (Y >= 14) & (Z >= 72) & (Z < L - 4) & (np.abs(X - XC + 0.5) < 17) & (Z % 4 == 0), "iron", 1)
    glass(g, cab & (Z < 40 + (Y - 15) + 2) & (Y >= 17) & (np.abs(X - XC + 0.5) < 15))
    glass(g, cab & ((X == x0 + 3) | (X == x1 - 4)) & (Y >= 17) & (Y < 25) & (Z >= 46) & (Z < 62))
    P.flat(g, shell & (np.abs(X - XC + 0.5) >= 3) & (np.abs(X - XC + 0.5) < 6) & (Y >= 13), stripe, 2)  # twin stripes
    grille = low & (Z <= 2) & (np.abs(X - XC + 0.5) < 16) & (Y >= 4) & (Y < 10)
    P.flat(g, grille, "iron", 2)
    for hx in (x0 + 4, x1 - 4):
        round_lamp(g, hx, 7, 1, r=2.4)
    chrome_bumper(g, x0, x1, 1, 4, 0, 2)
    chrome_bumper(g, x0, x1, 1, 4, L - 2, L)
    finish(g, shell, paint, seed, ys=(2, 24))
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 3, 0, zm),
                                    sock("socket-roof", XC, 15, 90, zm), sock("socket-hood", XC, 15, 24, zm),
                                    sock("socket-stack-l", x1 - 4, 15, 74, zm), sock("socket-stack-r", x0 + 4, 15, 74, zm)]
    return _root(name, g, zm, cls), cls, socks


def hearse(name="hearse", paint="iron", curtain=CREAM, seed=105):
    """A long black hearse: a low nose, a long tall glasshouse with drawn
    curtains, chrome landau bars on the rear quarters and little tail fins."""
    L, cls = 132, "L"
    zm = 68
    g = Grid(BW, 50, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 20, XC + 20
    g.prism("x", [(0, 3), (9, 1), (14, 3), (16, 40), (16, L - 2), (12, L - 1), (0, L - 2)], x0, x1, C(paint, 3))
    low = last(g)
    g.prism("x", [(16, 38), (31, 50), (33, 56), (33, L - 6), (30, L - 3), (16, L - 3)], x0 + 1, x1 - 1, C(paint, 3))
    top = last(g)
    shell = low | top
    paint_shell(g, shell, paint, 3, seam=99, seed=seed)
    glass(g, top & (Z < 38 + (Y - 16) * 0.85 + 2) & (Y >= 18) & (np.abs(X - XC + 0.5) < 16))
    for xs in (x0 + 1, x1 - 2):
        win = top & (X == xs) & (Y >= 19) & (Y < 30) & (Z >= 52) & (Z < 90)
        P.flat(g, win, "navy", 2)
        P.flat(g, win & (Z >= 56) & (Z < 90) & ((Z % 3) != 0), curtain, 5)  # drawn curtains
        P.flat(g, win & (np.abs(Z - 70) < 1), paint, 2)
        landau = top & (X == xs) & (Z >= 92) & (Z < 122) & (Y >= 19) & (Y < 30)
        P.flat(g, landau, paint, 2)
        P.flat(g, landau & ((np.abs((Z - 107) * 0.35 - (Y - 24.5)) < 0.8) | (np.abs((Z - 107) * -0.35 - (Y - 24.5)) < 0.8)), "steel", 6)  # landau bars
    for sx in (-1, 1):  # little fins
        fx = XC + sx * 18
        g.prism("x", [(14, L - 26), (16, L - 26), (21, L - 4), (14, L - 2)], min(fx, fx + sx * 2), max(fx, fx + sx * 2), C(paint, 3))
    box(g, x0 + 2, 33, 60, x0 + 4, 35, L - 10, "steel", 6)  # roof rails
    box(g, x1 - 4, 33, 60, x1 - 2, 35, L - 10, "steel", 6)
    grille = low & (Z <= 2) & (np.abs(X - XC + 0.5) < 9) & (Y >= 4) & (Y < 12)
    P.flat(g, grille, "steel", 5)
    P.flat(g, grille & (Y % 2 == 0), "iron", 1)
    for hx in (x0 + 4, x0 + 9, x1 - 4, x1 - 9):
        round_lamp(g, hx, 8, 1, r=2.0)
    chrome_bumper(g, x0, x1, 1, 5, 0, 2)
    chrome_bumper(g, x0, x1, 1, 5, L - 2, L)
    finish(g, shell, paint, seed, rust=10)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 33, 90, zm), sock("socket-hood", XC, 16, 22, zm),
                                    sock("socket-stack-l", x1 - 3, 33, L - 10, zm), sock("socket-stack-r", x0 + 3, 33, L - 10, zm)]
    return _root(name, g, zm, cls), cls, socks


def franken(name="franken", paint="lime", other="red", seed=106):
    """Frankencar: the front half of a little hatch welded nose-to-tail onto
    the front half of a van facing the other way, so it has two faces, two
    paint jobs and a stapled seam down the middle."""
    L, cls = 110, "M"
    zm = 55
    g = Grid(BW, 60, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 20, XC + 20
    mid = 52
    # front: hatch nose and cab (z 0..mid)
    g.prism("x", [(0, 2), (14, 1), (17, 3), (19, 14), (34, 24), (36, 28), (36, mid + 1), (0, mid + 1)], x0, x1, C(paint, 4))
    front = last(g)
    # back: a taller van, its own nose pointing backwards (z mid..L)
    g.prism("x", [(0, mid), (44, mid), (44, L - 22), (40, L - 18), (24, L - 8), (20, L - 4), (17, L - 1), (0, L - 1)], x0 - 1, x1 + 1, C(other, 4))
    back = last(g)
    paint_shell(g, front, paint, 4, seam=99, seed=seed)
    paint_shell(g, back, other, 4, seam=99, seed=seed + 1)
    shell = front | back
    glass(g, front & (Y >= 20) & (Y < 33) & (Z < 14 + (Y - 18) * 0.45 + 2) & (np.abs(X - XC + 0.5) < 16))
    glass(g, back & (Y >= 22) & (Y < 38) & (Z > L - 22 + (Y - 40) * -0.9 - 2) & (Z > L - 24) & (np.abs(X - XC + 0.5) < 17))
    for xs in (x0, x1 - 1):
        glass(g, front & (X == xs) & (Y >= 20) & (Y < 32) & (Z >= 22) & (Z < 46))
        glass(g, back & (X == xs + (-1 if xs == x0 else 1)) & (Y >= 24) & (Y < 38) & (Z >= 60) & (Z < L - 26))
    # the weld: a dark seam with staples across it
    seam = shell & (np.abs(Z - mid + 0.5) < 1.2)
    P.flat(g, seam, "iron", 1)
    for k in range(6):
        y = 4 + k * 7
        box(g, x0 - 1, y, mid - 3, x0, y + 1.5, mid + 3, "steel", 6)
        box(g, x1, y, mid - 3, x1 + 1, y + 1.5, mid + 3, "steel", 6)
    for zf, facing in ((0, -1), (L - 1, 1)):  # a face at each end
        grille = shell & (Z == (2 if facing < 0 else L - 2)) & (np.abs(X - XC + 0.5) < 8) & (Y >= 5) & (Y < 12)
        P.flat(g, grille, "iron", 2)
        for hx in (x0 + 4, x1 - 4):
            round_lamp(g, hx, 9, zf + (2 if facing < 0 else -1), r=2.6, face=facing)
    chrome_bumper(g, x0, x1, 1, 5, 0, 2)
    chrome_bumper(g, x0, x1, 1, 5, L - 2, L)
    finish(g, shell, paint, seed, rust=10)
    rust_bloom(g, seed + 5, 10, other, ys=(2, 40), size=(1.5, 3.5))
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 44, 76, zm), sock("socket-hood", XC, 17, 9, zm),
                                    sock("socket-stack-l", x1 - 3, 36, mid - 4, zm), sock("socket-stack-r", x0 + 3, 36, mid - 4, zm)]
    return _root(name, g, zm, cls), cls, socks


def semi(name="semi", paint="red", trim="steel", seed=107):
    """An 18-wheeler tractor: a long square nose with a huge grille, a cab
    and sleeper, chrome fuel tanks, a fifth-wheel plate behind for the
    trailer, and room for a big pair of stacks."""
    L, cls = 126, "L"
    zm = 64
    g = Grid(BW, 72, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 21, XC + 21
    g.prism("x", [(2, 2), (30, 2), (32, 4), (32, 38), (2, 38)], x0 + 3, x1 - 3, C(paint, 4))  # long nose
    nose = last(g)
    cab = box(g, x0, 2, 38, x1, 56, 64, paint, 4)  # cab
    sleeper = box(g, x0, 2, 64, x1, 52, 84, paint, 4)  # sleeper
    shell = nose | cab | sleeper
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    grille = nose & (Z <= 2) & (np.abs(X - XC + 0.5) < 13) & (Y >= 6) & (Y < 30)
    P.flat(g, grille, "steel", 6)
    P.flat(g, grille & (Y % 2 == 0), "steel", 3)
    P.flat(g, nose & (Y >= 31) & (np.abs(X - XC + 0.5) < 1), trim, 6)  # hood ornament strip
    for hx in (x0 + 5, x1 - 5):
        round_lamp(g, hx, 12, 2, r=3.2)
    glass(g, cab & (Z == 38) & (Y >= 40) & (Y < 53) & (np.abs(X - XC + 0.5) < 18) & (np.abs(X - XC + 0.5) > 1))
    for xs in (x0, x1 - 1):
        glass(g, cab & (X == xs) & (Y >= 40) & (Y < 53) & (Z >= 42) & (Z < 60))
        P.flat(g, sleeper & (X == xs) & (Y >= 6) & (Y < 9), trim, 6)
    box(g, x0 + 2, 56, 40, x1 - 2, 60, 60, paint, 3)  # sun visor / roof fairing
    for lx in range(int(x0 + 4), int(x1 - 3), 6):
        P.flat(g, (Z == 40) & (Y == 59) & (X >= lx) & (X < lx + 2) & (g.a > 0), "gold", 7)  # cab lights
    for sx in (-1, 1):  # chrome fuel tanks under the doors
        tx = XC + sx * 21
        g.prism("z", [(tx + u, 9 + v) for u, v in ngon(0, 0, 5, 12)], 42, 60, C("steel", 6))
    deck = box(g, x0 + 2, 2, 84, x1 - 2, 6, L - 2, "iron", 3)  # frame deck
    fifth = box(g, XC - 8, 6, 98, XC + 8, 9, 114, "iron", 2)  # fifth-wheel plate
    P.flat(g, fifth & (Y == 8) & (np.abs(X - XC + 0.5) < 2) & (Z > 106), "iron", 1)
    for mx in (x0 + 1, x1 - 3):  # mud flaps
        box(g, mx, 0, L - 3, mx + 3, 12, L - 1, "iron", 2)
    chrome_bumper(g, x0 - 1, x1 + 1, 1, 7, 0, 2)
    finish(g, shell, paint, seed, rust=16, ys=(2, 56))
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 9, 110, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 60, 50, zm), sock("socket-hood", XC, 38, 18, zm),
                                    sock("socket-stack-l", x1 + 2, 6, 66, zm), sock("socket-stack-r", x0 - 2, 6, 66, zm)]
    return _root(name, g, zm, cls), cls, socks


def tow(name="tow", paint="gold", trim="iron", seed=108):
    """A tow truck: a stubby cab, an amber light bar, side tool boxes and an
    A-frame boom with a cable and a big hook out the back."""
    L, cls = 108, "M"
    zm = 56
    g = Grid(BW, 66, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 20, XC + 20
    g.prism("x", [(2, 2), (18, 1), (21, 4), (22, 22), (40, 30), (42, 34), (42, 52), (2, 52)], x0, x1, C(paint, 4))
    cab = last(g)
    deck = box(g, x0, 2, 52, x1, 12, L - 2, trim, 3)
    boxes = box(g, x0, 12, 54, x0 + 8, 24, L - 18, paint, 3) | box(g, x1 - 8, 12, 54, x1, 24, L - 18, paint, 3)  # tool boxes
    shell = cab | boxes
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.plates(g, deck, trim, 3, size=(8, 6), seed=3)
    P.flat(g, boxes & ((Z - 54) % 12 == 0), paint, 2)
    from pnpaint import hazard as hz

    hz(g, shell & (Y >= 5) & (Y < 9) & ((X == x0) | (X == x1 - 1)), period=6, a=("gold", 5), b=("iron", 2))
    glass(g, cab & (Y >= 24) & (Y < 38) & (Z < 22 + (Y - 22) * 1.1 + 2) & (np.abs(X - XC + 0.5) < 16))
    for xs in (x0, x1 - 1):
        glass(g, cab & (X == xs) & (Y >= 26) & (Y < 38) & (Z >= 34) & (Z < 50))
    for lx in range(int(x0 + 3), int(x1 - 3), 5):  # amber light bar on the cab roof
        box(g, lx, 43, 40, lx + 3, 46, 44, "orange", 6)
    box(g, x0 + 2, 42, 39, x1 - 2, 43, 45, "iron", 2)
    # the boom: an A-frame from the deck up and out over the tail, cable and hook
    for sx in (-1, 1):
        bar(g, "x", (12, 64), (50, L - 6), 3, XC + sx * 6 - 1.5, XC + sx * 6 + 1.5, "steel", 4)
    box(g, XC - 7, 48, L - 9, XC + 7, 52, L - 3, "steel", 4)  # boom head
    box(g, XC - 0.5, 26, L - 6, XC + 0.5, 48, L - 5, "iron", 2)  # cable
    box(g, XC - 1, 22, L - 6.5, XC + 1, 27, L - 4.5, "steel", 5)  # hook shank
    bar(g, "x", (22, L - 5.5), (18, L - 8), 1.8, XC - 1, XC + 1, "steel", 5)  # the J of the hook
    bar(g, "x", (18, L - 8), (20, L - 11), 1.8, XC - 1, XC + 1, "steel", 5)
    for hx in (x0 + 4, x1 - 4):
        round_lamp(g, hx, 11, 1, r=2.6)
    chrome_bumper(g, x0 - 1, x1 + 1, 1, 6, 0, 2)
    finish(g, shell, paint, seed, rust=14)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-roof", XC, 43, 48, zm), sock("socket-hood", XC, 22, 12, zm),
                                    sock("socket-stack-l", x1 - 3, 24, 56, zm), sock("socket-stack-r", x0 + 3, 24, 56, zm)]
    return _root(name, g, zm, cls), cls, socks


def rv(name="rv", paint=CREAM, stripe="orange", stripe2="wood", seed=109):
    """A 70s RV: a bus-length box with a cab-over bunk, a row of windows, a
    door, a ladder, a striped awning and a roof AC unit."""
    L, cls = 140, "L"
    zm = 72
    g = Grid(BW, 66, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 22, XC + 22
    g.prism("x", [(2, 8), (16, 6), (20, 10), (24, 18), (24, 22), (2, 22)], x0 + 3, x1 - 3, C(paint, 4))  # cab nose
    nose = last(g)
    g.prism("z", [(x0, 2), (x1, 2), (x1, 46), (x1 - 3, 50), (x0 + 3, 50), (x0, 46)], 22, L - 1, C(paint, 4))  # box
    boxm = last(g)
    g.prism("x", [(32, 22), (34, 8), (46, 6), (50, 10), (50, 22)], x0 + 1, x1 - 1, C(paint, 4))  # cab-over bunk
    bunk = last(g)
    shell = nose | boxm | bunk
    paint_shell(g, shell, paint, 5, seam=99, seed=seed)
    sides = shell & ((X == x0) | (X == x1 - 1) | (Z == L - 2))
    for (ya, yb, c) in ((14, 17, stripe), (17, 19, stripe2), (19, 20, "gold")):  # 70s stripes
        P.flat(g, sides & (Y >= ya) & (Y < yb), c, 4 if c != "gold" else 5)
    glass(g, nose & (Y >= 12) & (Y < 22) & (Z < 16 + (Y - 10) * 0.6) & (Z >= 10) & (np.abs(X - XC + 0.5) < 17))
    glass(g, bunk & (Z <= 8) & (Y >= 38) & (Y < 44) & (np.abs(X - XC + 0.5) < 14))
    for xs in (x0, x1 - 1):
        for za in range(34, L - 12, 18):
            glass(g, boxm & (X == xs) & (Y >= 26) & (Y < 36) & (Z >= za) & (Z < za + 12))
    door = (X == x0) & (Z >= 26) & (Z < 33) & (Y >= 4) & (Y < 38) & (g.a > 0)
    P.flat(g, door, paint, 3)
    g.prism("z", [(x0, 41), (x0, 43), (x0 - 10, 38), (x0 - 10, 36)], 40, 92, C(stripe, 5))  # awning
    P.flat(g, last(g) & (((Z - 40) // 4) % 2 == 0), "bone", 6)
    for lx in (XC + 8, XC + 12):  # ladder up the back
        box(g, lx, 8, L - 1, lx + 1, 50, L, "steel", 5)
    for ly in range(10, 50, 4):
        box(g, XC + 8, ly, L - 1, XC + 13, ly + 1, L, "steel", 5)
    ac = box(g, XC - 7, 50, 70, XC + 7, 55, 84, "bone", 6)  # roof AC
    P.flat(g, ac & (Z % 2 == 0) & (Y == 54), "steel", 4)
    for hx in (x0 + 6, x1 - 6):
        round_lamp(g, hx, 12, 7, r=2.4)
    chrome_bumper(g, x0, x1, 1, 7, 4, 7)
    chrome_bumper(g, x0, x1, 1, 6, L - 2, L)
    finish(g, shell, paint, seed, rust=22)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 4, zm),
                                    sock("socket-roof", XC, 50, 110, zm), sock("socket-hood", XC, 22, 12, zm),
                                    sock("socket-stack-l", x1 - 3, 46, L - 6, zm), sock("socket-stack-r", x0 + 3, 46, L - 6, zm)]
    return _root(name, g, zm, cls), cls, socks


MORE_BODIES2 = {"armchair": armchair, "bug": bug, "cruiser": cruiser, "camino": camino, "hearse": hearse,
                "franken": franken, "semi": semi, "tow": tow, "rv": rv}
MORE_DEFAULTS2 = {
    "armchair": {"front": "treads", "rear": "treads"},
    "bug": {"front": "balloon", "rear": "balloon", "roof": "surfboard"},
    "cruiser": {"front": "slick", "rear": "slick", "hood": "blower"},
    "camino": {"front": "wire", "rear": "tractor", "hood": "scoop"},
    "hearse": {"front": "spiked", "rear": "spiked", "bumper": "cow-catcher"},
    "franken": {"front": "spiked", "rear": "slick", "roof": "rack-cargo"},
    "semi": {"front": "monster", "rear": "chained", "stacks": "stack", "bumper": "roo-bar"},
    "tow": {"front": "monster", "rear": "monster", "bumper": "winch-bumper"},
    "rv": {"front": "monster", "rear": "monster", "roof": "rack-spare"},
}
MORE_PAINT2 = {"armchair": ("lime", "bone", "orange"), "bug": ("sky", "bone", "steel"), "cruiser": ("red", "bone", "steel"),
               "camino": ("orange", "iron", "steel"), "hearse": ("iron", "bone", "steel"), "franken": ("lime", "red", "steel"),
               "semi": ("red", "steel", "gold"), "tow": ("gold", "iron", "orange"), "rv": ("bone", "orange", "wood")}
