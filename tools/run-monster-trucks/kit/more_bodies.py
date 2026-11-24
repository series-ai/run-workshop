"""More vehicle bodies (round 3 concepts: sport-wedge, sport-rally,
sport-roadster, harpoon-buggy-1, tread-sofa; plus a pickup). Same contract
as bodies.py: origin on the underside halfway between the axles, every
socket a body can offer.
"""
from __future__ import annotations

import numpy as np

from bodies import BW, XC, _root, dust, face_window, headlight, paint_shell, rust_bloom, sock, wheel_socks
from kit import CREAM, LILAC, MINT, PAINT_ORANGE, C, Grid, P, box, coords, ngon
from pnshapes import bar, last


def _nose(g: Grid, x0, x1, y0, y1, zface, lights=2, r=2.4) -> None:
    grille = (coords(g)[2] <= zface + 1) & (coords(g)[0] >= x0) & (coords(g)[0] < x1) & (coords(g)[1] >= y0) & (coords(g)[1] < y1) & (g.a > 0)
    P.flat(g, grille, "iron", 2)
    P.flat(g, grille & (coords(g)[0] % 2 == 0), "steel", 4)


def wedge(name="wedge", paint="iron", stripe="toxic", seed=61):
    """Wedge supercar: a flat black doorstop on the ground, a glass canopy on
    the slope, toxic-green stripes and a giant rear wing on two posts."""
    L, cls = 104, "M"
    zm = 54
    g = Grid(BW, 48, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 21, XC + 21
    g.prism("x", [(0, 1), (3, 0), (8, 2), (21, 52), (22, 64), (18, 92), (17, L - 1), (0, L - 1)], x0, x1, C(paint, 3))
    shell = last(g)
    paint_shell(g, shell, paint, 3, seam=99, seed=seed)
    canopy = shell & (Y >= 12) & (Z >= 32) & (Z < 66) & (X >= x0 + 6) & (X < x1 - 6)
    P.flat(g, canopy, "navy", 2)
    P.flat(g, canopy & ((X + Z) % 11 == 4), "navy", 5)
    for xs in (x0 + 3, x1 - 6):  # twin stripes over the top
        P.flat(g, shell & (X >= xs) & (X < xs + 3) & ~canopy, stripe, 5)
    for sx in (x0, x1 - 1):  # side intakes
        m = (X == sx) & (Z >= 64) & (Z < 80) & (Y >= 6) & (Y < 13) & (g.a > 0)
        P.flat(g, m, "iron", 1)
        P.flat(g, m & (Y % 2 == 0), stripe, 4)
    for hx in (x0 + 4, x1 - 8):  # pop-up headlight slits
        P.flat(g, shell & (X >= hx) & (X < hx + 4) & (Z >= 6) & (Z < 9), "bone", 7)
    P.flat(g, shell & (Z == L - 1) & (Y >= 6) & (Y < 10), "red", 5)  # light bar
    for px in (x0 + 4, x1 - 7):  # wing posts and the wing
        box(g, px, 17, L - 12, px + 3, 31, L - 8, paint, 2)
    wing = box(g, x0 - 2, 31, L - 16, x1 + 2, 34, L - 3, paint, 3)
    P.flat(g, wing & (Y == 33), stripe, 5)
    box(g, x0, 1, 0, x1, 3, 2, "steel", 3)
    rust_bloom(g, seed, 10, paint, ys=(2, 20), size=(1.5, 3.0))
    dust(g, shell, 3, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 2, 0, zm),
                                    sock("socket-roof", XC, 21, 62, zm), sock("socket-hood", XC, 16, 80, zm),
                                    sock("socket-stack-l", x1 - 5, 17, 86, zm), sock("socket-stack-r", x0 + 5, 17, 86, zm)]
    return _root(name, g, zm, cls), cls, socks


def rally(name="rally", paint=LILAC, trim="gold", seed=62):
    """Tiny rally mini: a tall rounded box, a stubby bonnet, a white roof, a
    pod of four rally lamps on the nose and mud flaps."""
    L, cls = 58, "S"
    zm = 30
    g = Grid(BW, 56, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 19, XC + 19
    # a round little box: rounded cabin cross-section on a rounded-nose bonnet
    g.prism("x", [(0, 1), (10, 0), (14, 2), (16, 6), (16, 19), (0, 19)], x0 + 1, x1 - 1, C(paint, 4))  # bonnet
    cab = [(x0, 0), (x1, 0), (x1, 26), (x1 - 2, 32), (x1 - 6, 36), (x0 + 6, 36), (x0 + 2, 32), (x0, 26)]
    g.prism("z", cab, 18, L - 1, C(paint, 4))
    g.prism("x", [(16, 16), (34, 22), (34, 24), (16, 24)], x0 + 3, x1 - 3, C(paint, 4))  # raked screen
    shell = g.a > 0
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, shell & (Y >= 33), "bone", 6)  # white roof
    ws = shell & (Y >= 18) & (Y < 32) & (Z < 16 + (Y - 16) * 0.42 + 2) & (Z >= 15) & (X >= x0 + 4) & (X < x1 - 4)
    P.flat(g, ws, "navy", 2)
    P.flat(g, ws & ((X + Y) % 9 == 3), "navy", 5)
    for xs in (x0, x1 - 1):
        for za, zb in ((22, 37), (39, L - 6)):
            win = (X == xs) & (Y >= 18) & (Y < 26) & (Z >= za) & (Z < zb) & (g.a > 0)
            P.flat(g, win, "navy", 2)
            P.outline(g, win, paint, 2, normal="x")
    face_window(g, L - 2, XC - 12, XC + 12, 20, 32, frame=(paint, 2))
    P.flat(g, shell & (Y >= 13) & (Y < 15), trim, 5)  # rally stripe
    _nose(g, XC - 7, XC + 7, 5, 11, 0)
    for hx in (x0 + 4, x1 - 4):
        headlight(g, hx, 9, 1, r=2.6)
    for lx in (XC - 11, XC - 4, XC + 4, XC + 11):  # rally lamp pod on the roof's front edge
        g.prism("z", [(lx + u, 40 + v) for u, v in ngon(0, 0, 3.0, 10)], 20, 24, C(trim, 4))
        g.prism("z", [(lx + u, 40 + v) for u, v in ngon(0, 0, 2.2, 10)], 19, 20, C("gold", 7))
    box(g, XC - 14, 35, 21, XC + 14, 37, 23, "iron", 3)
    for lx in (XC - 11, XC + 11):
        box(g, lx - 1, 35, 22, lx + 1, 38, 24, "iron", 3)
    box(g, x0 - 1, 1, 0, x1 + 1, 4, 2, "steel", 3)
    for fx in (x0 + 1, x1 - 4):  # mud flaps
        box(g, fx, 0, L - 3, fx + 3, 6, L - 1, "iron", 2)
    rust_bloom(g, seed, 10, paint, ys=(2, 30), size=(1.5, 3.0))
    dust(g, shell, 4, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 3, 0, zm),
                                    sock("socket-roof", XC, 36, 40, zm), sock("socket-hood", XC, 16, 8, zm)]
    return _root(name, g, zm, cls), cls, socks


def roadster(name="roadster", paint="khaki", fender="red", seed=63):
    """Open roadster: a long louvred bonnet, a little windscreen, two bucket
    seats in an open cockpit, flowing red fenders and a round tail."""
    L, cls = 98, "M"
    zm = 52
    g = Grid(BW, 40, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 18, XC + 18
    # built round an open cockpit (z 46..76): a full-length tub up to the
    # floor, the bonnet and tail on top, and the two door sides
    g.prism("x", [(0, 2), (9, 0), (9, L - 1), (6, L - 1), (0, L - 2)], x0, x1, C(paint, 4))
    g.prism("x", [(9, 0), (12, 0), (15, 3), (16, 46), (9, 46)], x0, x1, C(paint, 4))  # bonnet
    g.prism("x", [(9, 76), (16, 76), (16, 86), (13, L - 2), (9, L - 1)], x0, x1, C(paint, 4))  # tail
    for dx0, dx1 in ((x0, x0 + 3), (x1 - 3, x1)):
        box(g, dx0, 9, 46, dx1, 16, 76, paint, 4)  # doors
    shell = g.a > 0
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, shell & (Z < 44) & (Y >= 14) & ((Z % 4) == 0) & (np.abs(X - XC) > 4), paint, 2)  # bonnet louvres
    zs = 52  # two bucket seats
    for sx0, sx1 in ((XC - 12, XC - 2), (XC + 2, XC + 12)):
        box(g, sx0, 9, zs, sx1, 13, zs + 9, "darkwood", 3)
        box(g, sx0, 13, zs + 7, sx1, 22, zs + 9, "darkwood", 4)
    box(g, XC - 4, 14, 46, XC + 4, 18, 48, "iron", 2)  # dash
    g.prism("z", [(XC + u, 18 + v) for u, v in ngon(0, 0, 3, 8)], 47, 48, C("iron", 3))  # wheel
    ws = box(g, x0 + 3, 16, 44, x1 - 3, 24, 45, "steel", 5)
    P.flat(g, ws & (Y >= 17) & (Y < 23) & (np.abs(X - XC) < 13), "navy", 4)
    # flowing fenders over each axle
    for zz in (zm - 22, zm + 22):
        for fx0, fx1 in ((x0 - 3, x0 + 1), (x1 - 1, x1 + 3)):
            g.prism("x", [(4, zz - 16), (12, zz - 12), (14, zz), (12, zz + 12), (6, zz + 16)], fx0, fx1, C(fender, 4))
    rad = box(g, XC - 7, 2, 1, XC + 7, 24, 5, fender, 4)  # tall hot-rod radiator shell
    P.flat(g, rad & (Z == 1) & (np.abs(X - XC + 0.5) < 5.5) & (Y >= 4) & (Y < 22), "iron", 2)
    P.flat(g, rad & (Z == 1) & (np.abs(X - XC + 0.5) < 5.5) & (Y >= 4) & (Y < 22) & (X % 2 == 0), "steel", 5)
    box(g, XC - 1, 24, 2, XC + 1, 27, 4, "steel", 6)  # radiator cap
    for hx in (x0 + 2, x1 - 2):
        g.prism("z", [(hx + u, 13 + v) for u, v in ngon(0, 0, 3.0, 10)], 6, 10, C("steel", 5))
        g.prism("z", [(hx + u, 13 + v) for u, v in ngon(0, 0, 2.2, 10)], 5, 6, C("gold", 7))
    box(g, x0, 1, 0, x1, 3, 2, "steel", 6)
    P.flat(g, shell & (Z >= L - 3) & (Y >= 6) & (Y < 9) & ((X < x0 + 4) | (X >= x1 - 4)), "red", 6)
    rust_bloom(g, seed, 14, paint, ys=(2, 16), size=(1.5, 3.0))
    dust(g, shell, 3, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 3, 0, zm),
                                    sock("socket-hood", XC, 16, 24, zm), sock("socket-roof", XC, 16, 86, zm),
                                    sock("socket-stack-l", x1 - 1, 12, 36, zm), sock("socket-stack-r", x0 + 1, 12, 36, zm)]
    return _root(name, g, zm, cls), cls, socks


def buggy(name="buggy", tube="khaki", joint="orange", seed=64):
    """Tube-frame dune buggy: a floor pan, a tall birdcage of tubes with
    painted joints, a bucket seat and an exposed engine at the back."""
    L, cls = 70, "S"
    zm = 36
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 17, XC + 17
    pan = box(g, x0, 0, 4, x1, 4, L - 4, "steel", 2)
    P.plates(g, pan, "steel", 2, size=(8, 8), seed=4)
    t = 1.8
    nodes = ((4, 2), (16, 4), (52, 20), (54, 48), (34, L - 6), (4, L - 4))
    for xs in (x0, x1 - 2):  # side frames: a tall birdcage hoop from nose to tail
        for p0, p1 in zip(nodes, nodes[1:]):
            bar(g, "x", p0, p1, t, xs, xs + 2, tube, 4)
        bar(g, "x", nodes[0], nodes[-1], t, xs, xs + 2, tube, 4)
        bar(g, "x", (16, 4), (34, L - 6), t, xs, xs + 2, tube, 3)  # diagonal brace
    for (y, z) in nodes[1:5]:  # cross tubes
        bar(g, "z", (x0, y), (x1, y), t, z - 0.9, z + 0.9, tube, 4)
    for xs in (XC - 6, XC + 4):  # roof bars
        bar(g, "x", (52, 20), (54, 48), t, xs, xs + 2, tube, 4)
    for (y, z) in nodes:  # painted joints
        P.flat(g, (g.a > 0) & (np.abs(Y - y) < 1.6) & (np.abs(Z - z) < 1.6), joint, 5)
    box(g, XC - 6, 4, 32, XC + 6, 9, 42, "darkwood", 3)  # bucket seat
    box(g, XC - 6, 9, 40, XC + 6, 24, 43, "darkwood", 4)
    eng = box(g, XC - 8, 4, 48, XC + 8, 16, 62, "iron", 3)  # engine
    P.flat(g, eng & (Y % 3 == 0), "steel", 5)
    for ex in (XC - 5, XC + 3):
        box(g, ex, 16, 52, ex + 2, 20, 58, "steel", 6)
    _nose(g, XC - 5, XC + 5, 2, 8, 2)
    box(g, XC - 8, 4, 2, XC + 8, 10, 6, tube, 3)  # nose box
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 4, 2, zm),
                                    sock("socket-roof", XC, 55, 34, zm), sock("socket-hood", XC, 16, 55, zm),
                                    sock("socket-stack-l", XC + 6, 16, 58, zm), sock("socket-stack-r", XC - 6, 16, 58, zm)]
    return _root(name, g, zm, cls), cls, socks


def sofa(name="sofa", paint=MINT, cushion=CREAM, piping=PAINT_ORANGE, seed=65):
    """A puffy three-seat sofa as a body: a base frame, chamfered seat
    cushions, a tall back, rolled arms, orange piping and an exhaust stack
    poking out of the back."""
    L, cls = 84, "M"
    zm = 44
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 22, XC + 22
    base = box(g, x0, 0, 4, x1, 8, L - 4, "darkwood", 3)
    # tall back rest with a rounded top (the sofa faces forward)
    back = [(8, L - 22), (34, L - 20), (40, L - 17), (43, L - 13), (43, L - 9), (40, L - 5), (8, L - 4)]
    g.prism("x", back, x0 + 6, x1 - 6, C(paint, 4))
    # rolled arms down both sides: a fat roll on a post (prism along z)
    for sx in (-1, 1):
        ax = XC + sx * 18
        roll = [(ax - 4, 8), (ax + 4, 8), (ax + 4, 20), (ax + 6, 23), (ax + 5, 27), (ax + 2, 29), (ax - 2, 29), (ax - 5, 27), (ax - 6, 23), (ax - 4, 20)]
        g.prism("z", roll, 6, L - 6, C(paint, 4))
    # three seat cushions (chamfered tops)
    for k in range(3):
        cx0 = x0 + 8 + k * 9.4
        g.prism("x", [(8, 8), (15, 8), (17, 10), (17, L - 24), (8, L - 22)], cx0 + 0.3, cx0 + 9.1, C(cushion, 5))
    shell = (g.a > 0) & (Y >= 8)
    P.flat(g, shell & (np.abs(Y - 20.5) < 0.6) & (np.abs(np.abs(X - XC + 0.5) - 18) < 7), piping, 5)  # arm piping
    P.flat(g, shell & ((Z < 7) | (Z >= L - 7)) & (np.abs(np.abs(X - XC + 0.5) - 18) < 7) & (Y > 8), piping, 5)  # arm ends
    P.flat(g, shell & (np.abs(Y - 42) < 0.6), piping, 5)
    P.flat(g, shell & ((X - x0) % 15 == 0) & (Y > 22) & (Z > L - 24), paint, 2)  # back tufting seams
    P.flat(g, (g.a > 0) & (Y < 8) & (X % 6 == 0), "darkwood", 2)
    for fx in (x0 + 1, x1 - 4):  # stubby feet
        for fz in (6, L - 9):
            box(g, fx, 0, fz, fx + 3, 2, fz + 3, "wood", 5)
    rust_bloom(g, seed, 8, paint, ys=(10, 38), size=(1.5, 2.5))
    dust(g, base, 4, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L - 4, zm), sock("socket-front", XC, 4, 4, zm),
                                    sock("socket-roof", XC, 43, L - 11, zm),
                                    sock("socket-stack-l", x1 - 4, 22, L - 10, zm), sock("socket-stack-r", x0 + 4, 22, L - 10, zm)]
    return _root(name, g, zm, cls), cls, socks


def pickup(name="pickup", paint="red", roof="bone", seed=66):
    """Classic pickup: a square hood, a cab with a cream roof, an open bed
    with stake pockets and a drop tailgate."""
    L, cls = 108, "M"
    zm = 58
    g = Grid(BW, 56, L)
    X, Y, Z = coords(g)
    x0, x1 = XC - 21, XC + 21
    cab_back, bed_end = 60, L - 2
    g.prism("x", [(2, 2), (18, 1), (21, 4), (22, 30), (26, 34), (40, 38), (41, cab_back), (2, cab_back)], x0, x1, C(paint, 4))
    cab = last(g)
    bed = box(g, x0, 2, cab_back, x1, 8, bed_end, paint, 4)
    bed |= box(g, x0, 8, cab_back, x0 + 3, 22, bed_end, paint, 4) | box(g, x1 - 3, 8, cab_back, x1, 22, bed_end, paint, 4)
    bed |= box(g, x0 + 3, 8, bed_end - 2, x1 - 3, 21, bed_end, paint, 3)  # tailgate
    shell = cab | bed
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, cab & (Y >= 38), roof, 6)
    ws = cab & (Y >= 24) & (Y < 37) & (Z < 30 + (Y - 22) * 0.55 + 2) & (X >= x0 + 3) & (X < x1 - 3)
    P.flat(g, ws, "navy", 2)
    P.flat(g, ws & ((X + Y) % 9 == 3), "navy", 5)
    for xs in (x0, x1 - 1):
        win = (X == xs) & (Y >= 24) & (Y < 36) & (Z >= 40) & (Z < 56) & (g.a > 0)
        P.flat(g, win, "navy", 2)
        P.outline(g, win, paint, 2, normal="x")
        P.flat(g, (X == xs) & (Z == 38) & (Y >= 6) & (Y < 36) & (g.a > 0), paint, 2)  # door seam
    P.flat(g, bed & (Y >= 21) & ((Z - cab_back) % 12 == 2), "steel", 3)  # stake pockets
    _nose(g, XC - 10, XC + 10, 6, 18, 1)
    for hx in (x0 + 4, x1 - 4):
        headlight(g, hx, 13, 1, r=3.0)
    box(g, x0 - 1, 1, 0, x1 + 1, 6, 2, "steel", 5)
    for tx in (x0 + 1, x1 - 4):
        P.flat(g, (Z == bed_end - 1) & (X >= tx) & (X < tx + 3) & (Y >= 12) & (Y < 18), "red", 6)
    rust_bloom(g, seed, 16, paint, ys=(2, 36), size=(1.8, 4.0))
    dust(g, shell, 4, seed)
    socks = wheel_socks(cls, zm) + [sock("socket-hitch", XC, 3, L, zm), sock("socket-front", XC, 3.5, 0, zm),
                                    sock("socket-roof", XC, 41, 50, zm), sock("socket-hood", XC, 22, 14, zm),
                                    sock("socket-stack-l", x1 - 3, 22, cab_back + 2, zm), sock("socket-stack-r", x0 + 3, 22, cab_back + 2, zm)]
    return _root(name, g, zm, cls), cls, socks


MORE_BODIES = {"pickup": pickup, "wedge": wedge, "rally": rally, "roadster": roadster, "buggy": buggy, "sofa": sofa}
MORE_DEFAULTS = {
    "pickup": {"front": "monster", "rear": "monster", "roof": "light-bar", "bumper": "roo-bar", "stacks": "stack"},
    "wedge": {"front": "slick", "rear": "slick", "hood": "velocity-stacks"},
    "rally": {"front": "balloon", "rear": "balloon", "roof": "rack-spare"},
    "roadster": {"front": "spiked", "rear": "spiked", "hood": "blower", "bumper": "spike-ram"},
    "buggy": {"front": "wire", "rear": "tractor", "roof": "harpoon", "stacks": "zoomies"},
    "sofa": {"front": "treads", "rear": "treads", "stacks": "flame-stack"},
}
# main, trim, accent paint ramps for the editor swatches
MORE_PAINT = {"pickup": ("red", "bone", "steel"), "wedge": ("iron", "toxic", "steel"), "rally": ("purple", "gold", "steel"),
              "roadster": ("khaki", "red", "steel"), "buggy": ("khaki", "orange", "steel"), "sofa": ("lime", "bone", "orange")}
