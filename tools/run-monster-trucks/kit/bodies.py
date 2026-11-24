"""Vehicle bodies. Each builder returns (root Part, wheelbase class, sockets).

Grids are BW wide with the centre line at x = BW/2; the body's underside is
y = 0 (the mount plane). `zm` is the grid z halfway between the axles, which
becomes the body origin. The front is z = 0 (glTF -Z).
"""
from __future__ import annotations

import math

import numpy as np

from kit import AK, BODY_HALF, CHALK, CREAM, LILAC, MINT, PAINT_ORANGE, PINK, WB, C, Grid, P, Part, box, coords, disc, grunge, last, ngon, radial
from voxgrid import Socket

BW = 64
XC = BW // 2


def _root(name: str, g: Grid, zm: float, cls: str) -> Part:
    root = Part(name, None, pivot=(XC, 0, zm))
    root.add(Part("body", g, pivot=(XC, 0, zm), at=(0, 0, 0)))
    return root


def sock(name: str, x, y, z, zm, parent="body", rot=(0, 0, 0)) -> Socket:
    return Socket(name, at=(x - XC, y, z - zm), parent=parent, rot=rot)


def wheel_socks(cls: str, zm) -> list[Socket]:
    """Where wheel modules bolt on: the axles and (for treads) the belly."""
    return [sock("socket-axle-f", XC, 0, zm - WB[cls] / 2, zm), sock("socket-axle-r", XC, 0, zm + WB[cls] / 2, zm), sock("socket-belly", XC, 0, zm, zm)]


def windows_row(g: Grid, side: str, z0: int, z1: int, y0: int, y1: int, w: int, gap: int, frame, glass=("navy", 2), seed=0) -> np.ndarray:
    """Painted window row on a +x/-x side wall: dark glass, a frame tone,
    one diagonal glint per pane (no transparency)."""
    X, Y, Z = coords(g)
    sidem = (X == g.a.any(axis=(1, 2)).nonzero()[0].max()) if side == "+x" else (X == g.a.any(axis=(1, 2)).nonzero()[0].min())
    m = np.zeros(g.shape, bool)
    z = z0
    while z + w <= z1:
        pane = sidem & (Z >= z) & (Z < z + w) & (Y >= y0) & (Y < y1) & (g.a > 0)
        P.flat(g, pane, *frame)
        inner = pane & (Z >= z + 1) & (Z < z + w - 1) & (Y >= y0 + 1) & (Y < y1 - 1)
        P.flat(g, inner, *glass)
        P.flat(g, inner & ((Z - z + Y - y0) % 7 == 3), glass[0], glass[1] + 3)
        m |= pane
        z += w + gap
    return m


def face_window(g: Grid, zplane: int, x0, x1, y0, y1, frame, glass=("navy", 2)) -> np.ndarray:
    X, Y, Z = coords(g)
    pane = (Z == zplane) & (X >= x0) & (X < x1) & (Y >= y0) & (Y < y1) & (g.a > 0)
    P.flat(g, pane, *frame)
    inner = pane & (X >= x0 + 1) & (X < x1 - 1) & (Y >= y0 + 1) & (Y < y1 - 1)
    P.flat(g, inner, *glass)
    P.flat(g, inner & ((X - x0 + Y - y0) % 9 == 4), glass[0], glass[1] + 3)
    return pane


def headlight(g: Grid, x, y, zface, r=3.2, ramp="gold") -> None:
    g.prism("z", [(x + u, y + v) for u, v in ngon(0, 0, r, 8, math.pi / 8)], zface - 1, zface, C("steel", 5))
    m = last(g)
    rr = radial(g, "z", x, y)
    P.flat(g, m & (rr < r - 1.0), ramp, 7)
    P.flat(g, m & (rr < 1.2), "bone", 7)


def bumper(g: Grid, x0, x1, y0, y1, z0, z1, hazard=True) -> np.ndarray:
    m = box(g, x0, y0, z0, x1, y1, z1, "steel", 4)
    P.outline(g, m, "steel", 2, normal="z")
    if hazard:
        from pnpaint import hazard as hz

        X, Y, Z = coords(g)
        hz(g, m & (Z == z0) & (X >= x0 + 2) & (X < x1 - 2) & (Y > y0) & (Y < y1 - 1), period=6, a=("gold", 5), b=("iron", 2))
    return m


# ---------------------------------------------------------------- bodies


def paint_shell(g: Grid, mask: np.ndarray, ramp: str, base: int = 4, seam: int = 18, z0: int = 0, seed: int = 0) -> None:
    """Flat faded paint: one tone, lit tops, a dark panel seam every `seam`
    voxels along z with a rivet or two, and a few scuffed lighter panels."""
    X, Y, Z = coords(g)
    P.flat(g, mask, ramp, base)
    up = np.zeros_like(mask)
    up[:, :-1, :] = g.a[:, 1:, :] > 0
    P.flat(g, mask & ~up, ramp, base + 1)
    seams = mask & ((Z - z0) % seam == 0)
    P.flat(g, seams, ramp, base - 2)
    P.flat(g, seams & (Y % 7 == 3), ramp, base + 2)
    rng = np.random.default_rng(seed)
    for _ in range(3):
        k = int(rng.integers(0, max(1, g.shape[2] // seam)))
        pane = mask & ((Z - z0) // seam == k) & ((Z - z0) % seam != 0) & (Y > 4)
        P.flat(g, pane & ~up, ramp, base + 1) if rng.random() < 0.5 else P.darken(g, pane & up, 0)


def rust_bloom(g: Grid, seed: int, count: int, paint: str, ys=(4, 40), size=(2.0, 4.5)) -> None:
    """Big rust blooms with drips, like the concepts (not speckle)."""
    rng = np.random.default_rng(seed)
    X, Y, Z = coords(g)
    from voxgrid import PALETTE, RAMP_SHADES

    painted = (g.a // RAMP_SHADES) == PALETTE["ramps"][paint]
    surf = AK.surface(g) & painted
    cand = np.argwhere(surf & (Y >= ys[0]) & (Y < ys[1]))
    if len(cand) == 0:
        return
    for _ in range(count):
        cx, cy, cz = cand[rng.integers(len(cand))]
        r = rng.uniform(*size)
        blob = surf & ((X - cx) ** 2 + ((Y - cy) * 1.6) ** 2 + (Z - cz) ** 2 < r * r)
        P.flat(g, blob, "rust", 3)
        P.flat(g, blob & ((X - cx) ** 2 + ((Y - cy) * 1.6) ** 2 + (Z - cz) ** 2 < (r * 0.5) ** 2), "rust", 2)
        for _ in range(int(rng.integers(1, 4))):  # drips under the bloom
            dz, dx = rng.integers(-int(r), int(r) + 1), rng.integers(-int(r), int(r) + 1)
            length = int(rng.integers(3, 8))
            drip = surf & (Z == cz + dz) & (X == cx + dx) & (Y < cy) & (Y >= cy - length)
            if not drip.any():
                drip = surf & (Z == cz + dz) & (Y < cy) & (Y >= cy - length) & (np.abs(X - cx) < 1)
            P.flat(g, drip, "rust", 3)


def dust(g: Grid, mask: np.ndarray, height: int, seed: int) -> None:
    """Dusty sand creeping up from the bottom edge, ragged."""
    X, Y, Z = coords(g)
    ys = np.nonzero(mask.any(axis=(0, 2)))[0]
    if len(ys) == 0:
        return
    rng = np.random.default_rng(seed)
    wave = np.round(1.5 + 1.5 * np.sin(Z * 0.45 + seed) * np.cos(X * 0.3 + Z * 0.13)).astype(int)
    lim = ys.min() + height + wave
    P.flat(g, mask & (Y < lim), "sand", 3)
    P.flat(g, mask & (Y < lim - 2), "sand", 2)


def bus_hood(name="bus-hood", paint=CHALK, stripe=CREAM, accent=PAINT_ORANGE, seed=11):
    """Old hooded school bus (round 3 bus-3): chalky blue with cream bands, a
    box overhanging both axles, a blower on the hood, an upright spare tyre
    in a tubular roof rack."""
    L, cls = 134, "L"
    zm = 72
    g = Grid(BW, 76, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 22, XC + 22
    hz0 = 22  # where the box starts (behind the hood)
    # main box with big rounded roof edges (prism along z)
    g.prism("z", [(x0, 0), (x1, 0), (x1, 41), (x1 - 2, 45), (x1 - 6, 48), (x0 + 6, 48), (x0 + 2, 45), (x0, 41)], hz0, L - 1, C(paint, 4))
    shell = last(g)
    # hood: short and chunky, sloped nose
    g.prism("x", [(4, 3), (21, 3), (26, 8), (26, hz0 + 1), (4, hz0 + 1)], x0 + 7, x1 - 7, C(paint, 4))
    hood = last(g)
    # big boxy fenders either side of the hood
    for fx0, fx1 in ((x0, x0 + 7), (x1 - 7, x1)):
        g.prism("x", [(4, 6), (16, 6), (20, 11), (20, hz0 + 1), (4, hz0 + 1)], fx0, fx1, C(paint, 4))
        hood |= last(g)
    painted = shell | hood
    paint_shell(g, shell, paint, 4, seam=16, z0=hz0, seed=seed)
    paint_shell(g, hood, paint, 4, seam=99, seed=seed)
    # cream bands along the sides
    side = shell & ((X == x0) | (X == x1 - 1) | (Z == L - 2))
    for ya, yb in ((10, 12), (14, 16), (24, 26)):
        P.flat(g, side & (Y >= ya) & (Y < yb), stripe, 6)
    # side windows (both sides), windscreen, door
    for s in ("+x", "-x"):
        windows_row(g, s, hz0 + 13, L - 6, 28, 41, 9, 2, frame=(paint, 2), seed=seed)
    face_window(g, hz0, x0 + 3, XC - 1, 27, 42, frame=(paint, 2))
    face_window(g, hz0, XC + 1, x1 - 3, 27, 42, frame=(paint, 2))
    for lx in (x0 + 6, x1 - 9):  # roof marker lights
        P.flat(g, (Z == hz0) & (X >= lx) & (X < lx + 3) & (Y >= 43) & (Y < 46), "orange", 6)
    door = (X == x0) & (Z >= hz0 + 2) & (Z < hz0 + 11) & (Y >= 3) & (Y < 41)
    P.flat(g, door, paint, 3)
    P.flat(g, door & (Y >= 27) & (Z >= hz0 + 3) & (Z < hz0 + 10), "navy", 2)
    # riveted scrap patches on the sides
    for s_x, pz, py in ((x0, hz0 + 34, 4), (x1 - 1, hz0 + 60, 18)):
        pm = (X == s_x) & (Z >= pz) & (Z < pz + 16) & (Y >= py) & (Y < py + 8)
        P.flat(g, pm, "rust", 4)
        P.outline(g, pm, "rust", 2, normal="x")
        P.flat(g, pm & ((Z - pz) % 3 == 1) & ((Y == py + 1) | (Y == py + 6)), "steel", 5)
    # rear: emergency door window, tail lights
    face_window(g, L - 2, XC - 7, XC + 7, 24, 40, frame=(paint, 2))
    for tx in (x0 + 2, x1 - 6):
        P.flat(g, (Z == L - 2) & (X >= tx) & (X < tx + 4) & (Y >= 6) & (Y < 11), "red", 5)
    # nose: grille, headlights, bumper
    grille = (Z == 3) & (X >= XC - 9) & (X < XC + 9) & (Y >= 6) & (Y < 20) & (g.a > 0)
    P.flat(g, grille, "steel", 5)
    P.flat(g, grille & (Y % 2 == 0), "iron", 2)
    P.outline(g, grille, "steel", 3, normal="z")
    for hx in (x0 + 3.5, x1 - 3.5):
        headlight(g, hx, 12, 6, r=2.6)
    bm = box(g, x0 - 1, 1, 0, x1 + 1, 8, 4, "steel", 3)
    P.outline(g, bm, "steel", 2, normal="z")
    box(g, x0 + 1, 1, L - 1, x1 - 1, 6, L, "steel", 3)
    rust_bloom(g, seed, 22, paint, size=(2.0, 5.0))
    dust(g, painted, 4, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-roof", XC, 48, L - 30, zm), sock("socket-hood", XC, 26, 12, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-stack-l", x1 - 3, 46, hz0 + 4, zm), sock("socket-stack-r", x0 + 3, 46, hz0 + 4, zm)]
    return _root(name, g, zm, cls), cls, socks


def side_mask(g: Grid, x0: int, x1: int, z_back: int | None = None) -> np.ndarray:
    X, Y, Z = coords(g)
    m = (X == x0) | (X == x1 - 1)
    if z_back is not None:
        m |= Z == z_back
    return m & (g.a > 0)


def bus_flat(name="bus-flat", paint="gold", stripe=("iron", 2), seed=21):
    """Flat-nosed transit school bus (round 3 bus-1 / bus-2): one long box,
    a big split windscreen, overhanging both axles. Yellow with black
    stripes; the cream-and-mint bus is a paint swap (paint bone, trim lime)."""
    L, cls = 136, "L"
    zm = 68
    g = Grid(BW, 76, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 22, XC + 22
    # the box with rounded roof edges, a slightly raked nose
    g.prism("z", [(x0, 0), (x1, 0), (x1, 43), (x1 - 2, 47), (x1 - 6, 50), (x0 + 6, 50), (x0 + 2, 47), (x0, 43)], 4, L - 1, C(paint, 4))
    shell = last(g)
    g.prism("x", [(0, 4), (50, 4), (47, 2), (6, 2), (0, 3)], x0 + 2, x1 - 2, C(paint, 4))
    shell |= last(g)
    paint_shell(g, shell, paint, 4, seam=16, z0=4, seed=seed)
    sides = side_mask(g, x0, x1, L - 2) & shell
    for ya, yb in ((9, 11), (13, 15), (25, 27)):
        P.flat(g, sides & (Y >= ya) & (Y < yb), *stripe)
    P.flat(g, shell & (Z <= 4) & (Y >= 9) & (Y < 11), *stripe)
    for s in ("+x", "-x"):
        windows_row(g, s, 18, L - 6, 29, 42, 9, 2, frame=(paint, 2), seed=seed)
    # windscreen, destination sign, door
    face_window(g, 2, x0 + 3, XC - 1, 24, 43, frame=(paint, 2))
    face_window(g, 2, XC + 1, x1 - 3, 24, 43, frame=(paint, 2))
    P.flat(g, (Z == 2) & (X >= XC - 10) & (X < XC + 10) & (Y >= 44) & (Y < 48) & (g.a > 0), "iron", 1)
    P.flat(g, (Z == 2) & (X >= XC - 8) & (X < XC + 8) & (Y == 46) & (g.a > 0) & (X % 2 == 0), "gold", 7)
    door = (X == x0) & (Z >= 6) & (Z < 15) & (Y >= 3) & (Y < 43)
    P.flat(g, door, paint, 2)
    P.flat(g, door & (Y >= 24) & (Z >= 7) & (Z < 14), "navy", 2)
    P.flat(g, door & (Z == 10), paint, 1)
    # nose: low grille, quad lights, big bumper; tail lights
    grille = (Z == 2) & (X >= XC - 7) & (X < XC + 7) & (Y >= 6) & (Y < 15) & (g.a > 0)
    P.flat(g, grille, "steel", 5)
    P.flat(g, grille & (Y % 2 == 0), "iron", 2)
    for hx in (x0 + 5, x0 + 11, x1 - 5, x1 - 11):
        headlight(g, hx, 11, 2, r=2.4)
    for lx in (x0 + 4, x1 - 7):
        P.flat(g, (Z == 2) & (X >= lx) & (X < lx + 3) & (Y >= 45) & (Y < 48) & (g.a > 0), "red" if paint == "gold" else "orange", 6)
    bm = box(g, x0 - 1, 1, 0, x1 + 1, 7, 3, "steel", 3)
    P.outline(g, bm, "steel", 2, normal="z")
    box(g, x0 + 1, 1, L - 1, x1 - 1, 6, L, "steel", 3)
    for tx in (x0 + 2, x1 - 6):
        P.flat(g, (Z == L - 2) & (X >= tx) & (X < tx + 4) & (Y >= 6) & (Y < 11), "red", 5)
    face_window(g, L - 2, XC - 7, XC + 7, 24, 42, frame=(paint, 2))
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-roof", XC, 50, L // 2, zm), sock("socket-front", XC, 4, 0, zm),
                                    sock("socket-stack-l", x1 - 3, 46, L - 5, zm), sock("socket-stack-r", x0 + 3, 46, L - 5, zm)]
    rust_bloom(g, seed, 22, paint, ys=(4, 44), size=(2.0, 5.0))
    dust(g, shell, 4, seed)
    return _root(name, g, zm, cls), cls, socks


def icecream(name="icecream", seed=31):
    """Ice-cream van (round 3 tread-icecream): short and chunky, cream over
    pink with teal trim, a boxy cab with a split screen, a big serving hatch
    under a scalloped awning, a giant cone lying tilted on the roof."""
    L, cls = 84, "M"
    zm = 44
    g = Grid(BW, 84, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 21, XC + 21
    zb = 24  # box starts
    # cab: boxy, nearly upright split windscreen
    g.prism("x", [(0, 1), (16, 1), (19, 3), (21, 5), (38, 8), (38, zb + 1), (0, zb + 1)], x0 + 1, x1 - 1, C(CREAM, 4))
    cab = last(g)
    # box with chamfered roof edges
    g.prism("z", [(x0, 0), (x1, 0), (x1, 43), (x1 - 3, 47), (x0 + 3, 47), (x0, 43)], zb - 2, L - 1, C(CREAM, 4))
    boxm = last(g)
    shell = cab | boxm
    paint_shell(g, shell, CREAM, 5, seam=99, seed=seed)
    P.flat(g, shell & (Y < 18), PINK, 4)  # pink lower half
    P.flat(g, boxm & (Y >= 44), PINK, 5)  # pink roof
    P.flat(g, boxm & (Y >= 42) & (Y < 44), "teal", 4)  # teal roof edge
    P.flat(g, shell & (((Y >= 18) & (Y < 19)) | ((Y >= 20) & (Y < 21))), "teal", 4)
    P.flat(g, shell & (Y < 3), "teal", 3)
    # rivets on the panel seams of the pink lower body
    P.flat(g, shell & (Y < 18) & (Y > 3) & ((Z - zb) % 15 == 0), PINK, 2)
    P.flat(g, shell & (Y == 15) & ((Z - zb) % 15 == 0), "steel", 6)
    # split windscreen on the cab front
    ws = cab & (Y >= 22) & (Y < 36) & (Z < 5 + (Y - 21) * 0.2 + 2) & (X >= x0 + 3) & (X < x1 - 3) & (np.abs(X - XC + 0.5) > 1)
    P.flat(g, ws, "navy", 2)
    P.flat(g, ws & ((X + Y) % 9 == 3), "navy", 5)
    for xs in (x0 + 1, x1 - 2):
        win = cab & (X == xs) & (Y >= 22) & (Y < 35) & (Z >= 9) & (Z < 21)
        P.flat(g, win, "navy", 2)
        P.outline(g, win, CREAM, 2, normal="x")
        mx = (xs - 3, xs + 1) if xs < XC else (xs, xs + 4)
        box(g, mx[0], 26, 7, mx[1], 32, 9, "teal", 4)  # mirrors
    # big serving hatch on the visible side (-x is the van's right)
    hz0, hz1 = zb + 5, zb + 38
    hatch = (X == x0) & (Z >= hz0) & (Z < hz1) & (Y >= 21) & (Y < 39) & (g.a > 0)
    P.flat(g, hatch, CREAM, 3)
    P.flat(g, hatch & (Z >= hz0 + 1) & (Z < hz1 - 1) & (Y >= 22) & (Y < 38), "navy", 1)
    P.flat(g, hatch & (Z == (hz0 + hz1) // 2), CREAM, 3)
    box(g, x0 - 3, 20, hz0, x0, 22, hz1, "steel", 4)  # counter
    g.prism("z", [(x0, 40), (x0, 42), (x0 - 10, 37), (x0 - 10, 35)], hz0 - 1, hz1 + 1, C(PINK, 5))
    aw = last(g)
    P.flat(g, aw & (((Z - hz0) // 4) % 2 == 0), CREAM, 6)
    box(g, x0 - 10, 33, hz0 - 1, x0 - 8, 35, hz1 + 1, PINK, 5)  # scalloped valance
    val = (X >= x0 - 10) & (X < x0 - 8) & (Y >= 33) & (Y < 35) & (Z >= hz0 - 1) & (Z < hz1 + 1)
    P.flat(g, val & (((Z - hz0) // 4) % 2 == 0), CREAM, 6)
    g.a[(val & ((Z - hz0) % 4 == 3) & (Y == 33))] = 0
    face_window(g, L - 2, XC - 8, XC + 8, 22, 38, frame=(CREAM, 3))
    for tx in (x0 + 2, x1 - 6):
        P.flat(g, (Z == L - 2) & (X >= tx) & (X < tx + 4) & (Y >= 6) & (Y < 11), "red", 5)
    # nose: grille, round lights, teal bumper
    grille = (Z == 1) & (X >= XC - 8) & (X < XC + 8) & (Y >= 4) & (Y < 14) & (g.a > 0)
    P.flat(g, grille, "steel", 5)
    P.flat(g, grille & (Y % 3 == 0), "iron", 2)
    P.outline(g, grille, "steel", 2, normal="z")
    for hx in (x0 + 5, x1 - 5):
        headlight(g, hx, 10, 1, r=3.0, ramp="bone")
    bm = box(g, x0 - 1, 1, 0, x1 + 1, 6, 2, "teal", 3)
    P.outline(g, bm, "teal", 2, normal="z")
    box(g, x0 + 1, 1, L - 1, x1 - 1, 6, L, "teal", 3)
    rust_bloom(g, seed, 10, CREAM, ys=(20, 42), size=(1.5, 3.5))
    rust_bloom(g, seed + 1, 12, PINK, ys=(3, 18), size=(1.5, 3.5))
    dust(g, shell, 3, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-roof", XC, 47, zb + 26, zm), sock("socket-front", XC, 3.5, 0, zm), sock("socket-stack-l", x1 - 3, 46, L - 5, zm), sock("socket-stack-r", x0 + 3, 46, L - 5, zm)]
    return _root(name, g, zm, cls), cls, socks


def muscle(name="muscle", paint=PAINT_ORANGE, trim="teal", seed=41):
    """Long-hood muscle car (round 3 sport-muscle): rust-orange, a giant
    chrome blower through the hood, a small fastback cabin set well back."""
    L, cls = 118, "M"
    zm = 64
    g = Grid(BW, 50, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 20, XC + 20
    # lower body: wedge nose, long flat hood, short tail with a lip
    g.prism("x", [(0, 3), (9, 1), (14, 3), (15, 30), (16, 104), (17, L - 2), (12, L - 1), (0, L - 2)], x0, x1, C(paint, 4))
    low = last(g)
    # cabin: raked windscreen and a long fastback
    g.prism("x", [(16, 56), (27, 68), (28, 82), (16, 108)], x0 + 3, x1 - 3, C(paint, 4))
    cab = last(g)
    shell = low | cab
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    # bulging wheel-arch flares
    for zz in (zm - WB[cls] // 2, zm + WB[cls] // 2):
        for fx0, fx1 in ((x0 - 2, x0), (x1, x1 + 2)):
            g.prism("x", [(2, zz - 13), (11, zz - 10), (11, zz + 10), (2, zz + 13)], fx0, fx1, C(paint, 3))
    # windows on the cabin
    cabside = cab & ((X == x0 + 3) | (X == x1 - 4)) & (Y >= 18) & (Y < 26) & (Z >= 62) & (Z < 98)
    P.flat(g, cabside, "navy", 2)
    P.flat(g, cabside & (Z == 80), paint, 2)
    ws = cab & (Z < 56 + (Y - 16) * 1.0 + 2) & (Y >= 18) & (X > x0 + 4) & (X < x1 - 5)
    P.flat(g, ws, "navy", 2)
    P.flat(g, ws & ((X + Y) % 8 == 2), "navy", 5)
    bw = cab & (Z > 108 - (Y - 16) * 2.1 - 3) & (Y >= 18) & (X > x0 + 4) & (X < x1 - 5)
    P.flat(g, bw, "navy", 2)
    # teal racing trim along the body line and twin hood stripes
    P.flat(g, low & ((X == x0) | (X == x1 - 1)) & (Y >= 10) & (Y < 12), trim, 4)
    # nose: grille, quad round lights, chrome bumper
    grille = (Z <= 2) & (X >= x0 + 3) & (X < x1 - 3) & (Y >= 4) & (Y < 10) & (g.a > 0)
    P.flat(g, grille, "iron", 2)
    P.flat(g, grille & (X % 2 == 0), "steel", 4)
    for hx in (x0 + 6, x0 + 11, x1 - 6, x1 - 11):
        headlight(g, hx, 7, 1, r=2.2)
    bm = box(g, x0, 1, 0, x1, 4, 2, "steel", 6)
    box(g, x0, 1, L - 3, x1, 5, L, "steel", 6)
    for tx in (x0 + 2, x0 + 8, x1 - 6, x1 - 12):
        P.flat(g, (Z == L - 2) & (X >= tx) & (X < tx + 4) & (Y >= 9) & (Y < 12), "red", 5)
    box(g, x0 + 1, 17, L - 6, x1 - 1, 19, L - 2, paint, 3)  # ducktail
    # side pipes
    for sx in (x0 - 2, x1):
        pp = box(g, sx, 3, 40, sx + 2, 5, 80, "steel", 5)
        P.flat(g, pp & (Z % 4 == 0), "steel", 3)
    rust_bloom(g, seed, 18, paint, ys=(2, 28), size=(1.8, 4.0))
    dust(g, shell, 3, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-roof", XC, 28, 74, zm), sock("socket-hood", XC, 15, 29, zm), sock("socket-front", XC, 2.5, 0, zm),
                                    sock("socket-exhaust-l", x1 + 1, 4, 80, zm), sock("socket-exhaust-r", x0 - 1, 4, 80, zm)]
    return _root(name, g, zm, cls), cls, socks


def hatch(name="hatch", paint=MINT, patch="orange", seed=51):
    """Scrap hatchback (round 3 scrap-hatch-1): wide and low two-box shape,
    a short hood, a tall boxy cabin set back, caged windows, orange scrap
    patches, a jerry can in a roof frame, hazard stripes on the tail."""
    L, cls = 70, "S"
    zm = 36
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 22, XC + 22
    # side profile: short hood, raked screen, flat roof, upright tail
    g.prism("x", [(0, 2), (16, 1), (19, 4), (20, 18), (35, 26), (37, 29), (37, L - 3), (34, L - 1), (0, L - 1)], x0, x1, C(paint, 4))
    shell = last(g)
    # slight tumblehome: the cabin is a little narrower than the body
    g.a[(Y >= 21) & ((X == x0) | (X == x1 - 1)) & (Z >= 20)] = 0
    shell &= g.a > 0
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    # screen and windows with welded cages
    ws = shell & (Y >= 21) & (Y < 34) & (Z < 18 + (Y - 18) * 0.47 + 2) & (X >= x0 + 4) & (X < x1 - 4)
    P.flat(g, ws, "navy", 2)
    P.flat(g, ws & ((X + Y) % 9 == 3), "navy", 5)
    for xs, sgn in ((x0 + 1, -1), (x1 - 2, 1)):
        for za, zb in ((29, 45), (47, 63)):
            win = (X == xs) & (Y >= 22) & (Y < 34) & (Z >= za) & (Z < zb) & (g.a > 0)
            P.flat(g, win, "navy", 2)
            P.outline(g, win, paint, 2, normal="x")
            xx = xs + sgn
            for zz in range(za + 3, zb - 1, 4):  # cage bars stand proud
                box(g, xx, 22, zz, xx + 1, 34, zz + 1, "iron", 3)
            box(g, xx, 27, za, xx + 1, 28, zb, "iron", 3)
    face_window(g, L - 2, XC - 14, XC + 14, 22, 34, frame=(paint, 2))
    # orange scrap patches with rivets
    for (px, pz, py, w, h) in ((x0, 6, 5, 12, 8), (x1 - 1, 44, 4, 16, 10), (x0, 50, 10, 12, 8)):
        pm = (X == px) & (Z >= pz) & (Z < pz + w) & (Y >= py) & (Y < py + h) & (g.a > 0)
        P.flat(g, pm, patch, 4)
        P.outline(g, pm, patch, 2, normal="x")
        P.flat(g, pm & ((Z - pz) % 3 == 1) & ((Y == py + 1) | (Y == py + h - 2)), "steel", 5)
    P.flat(g, shell & (Y >= 15) & (Z < 18) & (X >= XC - 9) & (X < XC + 9), patch, 4)  # orange hood panel
    P.flat(g, shell & (Y >= 15) & (Z < 18) & (X >= XC - 9) & (X < XC + 9) & (Z % 5 == 0), patch, 2)
    # hazard tail, grille, square lights
    from pnpaint import hazard as hz

    hz(g, shell & (Z == L - 2) & (Y >= 6) & (Y < 14), period=6, a=("gold", 5), b=("iron", 2))
    grille = (Z <= 2) & (X >= XC - 8) & (X < XC + 8) & (Y >= 5) & (Y < 12) & (g.a > 0)
    P.flat(g, grille, "iron", 2)
    P.flat(g, grille & (X % 2 == 0), "steel", 4)
    for hx in (x0 + 5, x1 - 5):
        P.flat(g, (Z <= 2) & (X >= hx - 3) & (X < hx + 3) & (Y >= 6) & (Y < 11) & (g.a > 0), "bone", 7)
    box(g, x0 - 1, 1, 0, x1 + 1, 5, 3, "steel", 3)
    box(g, x0 - 1, 1, L - 2, x1 + 1, 5, L, "steel", 3)
    rust_bloom(g, seed, 14, paint, ys=(2, 36), size=(1.5, 3.5))
    dust(g, shell, 3, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-roof", XC, 37, 48, zm), sock("socket-hood", XC, 19, 10, zm), sock("socket-front", XC, 3, 0, zm)]
    return _root(name, g, zm, cls), cls, socks


# Ready-made loadouts: front and rear wheel modules (or treads) and parts.
DEFAULTS = {
    "bus-hood": {"front": "monster", "rear": "monster", "roof": "rack-spare", "hood": "blower"},
    "bus-flat": {"front": "monster", "rear": "monster", "roof": "rack-cargo"},
    "icecream": {"front": "treads", "rear": "treads", "roof": "cone"},
    "muscle": {"front": "wire", "rear": "tractor", "hood": "blower-giant", "bumper": "longhorns"},
    "hatch": {"front": "steel", "rear": "steel", "roof": "jerry-frame", "bumper": "roo-bar"},
}

BODIES = {
    "bus-hood": bus_hood,
    "bus-flat": bus_flat,
    "icecream": icecream,
    "muscle": muscle,
    "hatch": hatch,
}

from more_bodies import MORE_BODIES, MORE_DEFAULTS  # noqa: E402  (defined on top of the helpers above)

BODIES.update(MORE_BODIES)
DEFAULTS.update(MORE_DEFAULTS)
from bikes import BIKE_DEFAULTS, BIKES  # noqa: E402

BODIES.update(BIKES)
DEFAULTS.update(BIKE_DEFAULTS)
from more_bodies2 import MORE_BODIES2, MORE_DEFAULTS2  # noqa: E402

BODIES.update(MORE_BODIES2)
DEFAULTS.update(MORE_DEFAULTS2)
for gone in ("sofa",):  # the sofa became the armchair
    BODIES.pop(gone, None)
    DEFAULTS.pop(gone, None)
