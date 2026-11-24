"""Motorcycle bodies. Same socket contract as every body, on the bike
wheelbase class "B"; put a `mono-*` wheel module on each axle for a
motorcycle, or a pair on one axle for a trike.
"""
from __future__ import annotations

import math

import numpy as np

from bodies import BW, XC, dust, paint_shell, rust_bloom, sock
from kit import CREAM, MINT, WB, C, Grid, P, Part, box, coords, ngon
from voxgrid import Socket
from pnshapes import bar, last

CLS = "B"
PART_SCALE = None  # set below: bolt-ons on a bike are scaled to match
DESIGN_WB = 76  # bikes are drawn at this wheelbase, then shrunk to WB["B"]
K = WB[CLS] / DESIGN_WB
PART_SCALE = K
HALF = DESIGN_WB // 2
SAG = 8  # the whole body hangs this far (design units) below the mount plane, so tanks and seats sit down between the wheels
BELLY = 40  # belly grids: y = BELLY is the mount plane; the engine hangs below it


def _bars(g: Grid, y, z, half, rise=0.0, ramp="steel") -> None:
    """Handlebars across the head tube, with black grips."""
    box(g, XC - half, y, z - 1.5, XC + half, y + 2, z + 1.5, ramp, 5)
    for sx in (-1, 1):
        box(g, XC + sx * half - (4 if sx > 0 else 0), y - 0.5, z - 2, XC + sx * half + (0 if sx > 0 else 4), y + 2.5, z + 2, "iron", 2)


def _finish(name, g, zm, L, low, socks, cls=CLS, side=None, extra=()):
    """Bring a bike drawn at design size down to bike scale. The design-size
    meshes (the body and the belly: engine, frame tubes, pegs and low pipes
    hung under the mount plane between the wheels) hang from an unscaled
    `body` node (the squash/paint node) with a node scale of K; the sockets
    move to bike scale, and bolt-ons on a bike are scaled by K too.
    `side`: (x, z) of a third wheel mount (a sidecar wheel); `extra`: more
    design-size parts [(name, grid, pivot x)] drawn in belly coordinates."""
    half = WB[cls] / K / 2
    root = Part(name, None, pivot=(XC, 0, zm))
    body = root.add(Part("body", None, pivot=(XC, 0, zm), at=(0, 0, 0)))
    drop = (0, -SAG * K, 0)
    body.add(Part("body-mesh", g, pivot=(XC, 0, zm), at=drop, meta={"scale": K}))
    bg = Grid(BW, 64, L)
    low(bg)
    body.add(Part("belly", bg, pivot=(XC, BELLY, zm), at=drop, meta={"scale": K}))
    for nm, eg, px in extra:
        body.add(Part(nm, eg, pivot=(px, BELLY, zm), at=drop, meta={"scale": K}))
    axles = [sock("socket-axle-f", XC, 0, zm - half, zm), sock("socket-axle-r", XC, 0, zm + half, zm), sock("socket-belly", XC, 0, zm, zm)]
    if side:
        axles.append(sock("socket-axle-s", side[0], 0, side[1], zm))
    socks = [Socket(s.name, at=tuple(v * K for v in s.at), parent=s.parent, rot=s.rot) for s in axles] + \
            [Socket(s.name, at=(s.at[0] * K, (s.at[1] - SAG) * K, s.at[2] * K), parent=s.parent, rot=s.rot) for s in socks]
    return root, cls, socks


def rloft(g: Grid, stations, ramp: str, shade: int = 4, cx=XC, p: float = 2.4, n: int = 14) -> np.ndarray:
    """A round body swept along z through `stations` [(z, half width, y0,
    y1), ...]: fat tanks, cowls, fairings, the sidecar tub."""
    def sec(w, y0, y1):
        cy, h = (y0 + y1) / 2, (y1 - y0) / 2
        return [(cx + w * math.copysign(abs(math.cos(a)) ** (2 / p), math.cos(a)), cy + h * math.copysign(abs(math.sin(a)) ** (2 / p), math.sin(a)))
                for a in (2 * math.pi * k / n + math.pi / n for k in range(n))]
    m = np.zeros(g.shape, bool)
    for (za, wa, a0, a1), (zb, wb, b0, b1) in zip(stations, stations[1:]):
        g.prism("z", sec(wa, a0, a1), za, zb, C(ramp, shade), top=sec(wb, b0, b1))
        m |= last(g)
    return m


def _pads(g: Grid, zf, zr) -> None:
    """The two mount pads on the mount plane (the wheel modules bolt on here)."""
    for z in (zf, zr):
        box(g, XC - 4, 0, z - 4, XC + 4, SAG, z + 4, "steel", 3)  # up to the mount plane


def _beachbars(g: Grid, zf, y, half, sweep=14) -> None:
    """Low, very wide bars that run straight out and curve back to the rider."""
    box(g, XC - 3, y - 3, zf - 2, XC + 3, y, zf + 2, "steel", 4)  # clamp on the neck
    for sx in (-1, 1):
        pts = [(XC, zf), (XC + sx * (half - 6), zf - 1), (XC + sx * half, zf + 5), (XC + sx * half, zf + sweep)]
        for p0, p1 in zip(pts, pts[1:]):
            bar(g, "y", p0, p1, 3.2, y, y + 3, "steel", 6)
        gx = XC + sx * half
        box(g, gx - 1.8, y - 0.4, zf + sweep - 1, gx + 1.8, y + 3, zf + sweep + 7, "iron", 2)  # grip


def _engine(g: Grid, z0, z1, y0, ramp="iron", twin=True) -> None:
    """Engine hung low: a block, finned cylinders up to the frame, a sump."""
    eng = box(g, XC - 6, y0, z0, XC + 6, y0 + 12, z1, ramp, 3)
    X, Y, Z = coords(g)
    P.flat(g, eng & (Y == y0 + 6), "steel", 4)
    zc = (z0 + z1) / 2
    for dz in ((-5, 5) if twin else (0,)):
        bar(g, "x", (y0 + 11, zc + dz * 0.6), (BELLY + 1, zc + dz * 1.8), 6, XC - 4, XC + 4, "steel", 5)
    P.flat(g, (g.a > 0) & (Y > y0 + 12) & (Y <= BELLY) & (np.abs(Z - zc) < 16) & (Y % 2 == 0), "steel", 3)  # fins


def _pegs(g: Grid, z, y) -> None:
    box(g, XC - 12, y, z - 1.5, XC + 12, y + 2, z + 1.5, "steel", 4)
    for sx in (-1, 1):
        box(g, XC + sx * 12 - (3 if sx > 0 else 0), y - 0.5, z - 2, XC + sx * 12 + (0 if sx > 0 else 3), y + 2.5, z + 2, "iron", 2)


def _fresnel(g: Grid, cx, cy, zface, r=6.0, ramp="steel") -> None:
    """A big round headlamp with a Fresnel lens: a steel bucket, a chrome
    rim and concentric ribbed rings of glass painted on its face."""
    g.prism("z", [(cx + u, cy + v) for u, v in ngon(0, 0, r, 14, math.pi / 14)], zface, zface + 5, C(ramp, 4))
    m = last(g)
    X, Y, Z = coords(g)
    rr = np.sqrt((X + 0.5 - cx) ** 2 + (Y + 0.5 - cy) ** 2)
    face = m & (Z == int(zface))
    P.flat(g, face & (rr > r - 1.2), ramp, 6)  # chrome rim
    lens = face & (rr <= r - 1.2)
    P.flat(g, lens, "gold", 7)
    P.flat(g, lens & ((rr.astype(int)) % 2 == 1), "bone", 7)  # Fresnel rings
    P.flat(g, lens & (rr < 1.2), "bone", 6)


def _nose(g: Grid, zf, y, r, paint) -> np.ndarray:
    """A nose cowl hung off the neck: a tapered faceted nacelle reaching
    forward of the steering head, with the Fresnel lamp in its mouth."""
    g.prism("z", [(XC + u, y + v) for u, v in ngon(0, 0, r - 1.5, 12)], zf - 12, zf + 2, C(paint, 4),
            top=[(XC + u, y + v) for u, v in ngon(0, 0, r + 0.5, 12)])
    m = last(g)
    _fresnel(g, XC, y, zf - 13, r=r)
    return m


def _widebars(g: Grid, zf, y_top, half, rise=12) -> None:
    """Wide high bars: two risers off the neck and a long bar with grips."""
    for sx in (-1, 1):
        bar(g, "z", (XC + sx * 2, y_top - rise), (XC + sx * 6, y_top), 2.2, zf - 1, zf + 1, "steel", 5)
    box(g, XC - half, y_top - 1, zf - 1.2, XC + half, y_top + 1, zf + 1.2, "steel", 6)
    for sx in (-1, 1):
        gx = XC + sx * half
        box(g, min(gx, gx - sx * 6), y_top - 1.5, zf - 1.8, max(gx, gx - sx * 6), y_top + 1.5, zf + 1.8, "iron", 2)


def chopper(name="chopper", paint="sky", trim="orange", seed=91):
    """Chopper: a big fat round tank up front, a huge Fresnel lamp, low wide
    beach bars that curve back to the rider, a scooped solo seat, a bobbed
    tail and a tall sissy bar."""
    L = 150
    zm = 70
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - HALF, zm + HALF
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 30, zf + 3, "steel", 4)  # neck
    nose = _nose(g, zf - 2, 23, 7.5, paint)
    g.prism("x", [(3, zf + 2), (13, zf + 3), (13, zf + 40), (3, zf + 46)], XC - 3, XC + 3, C("iron", 3))  # frame under the tank
    tank = rloft(g, [(zf + 3, 4, 18, 28), (zf + 8, 11, 12, 37), (zf + 18, 14.5, 11, 42), (zf + 29, 12.5, 11, 38), (zf + 37, 7, 12, 28), (zf + 41, 3, 12, 20)],
                 paint, 4, p=2.2, n=16)  # the fat round tank
    oil = box(g, XC - 5, 2, zf + 44, XC + 5, 10, zr - 4, "iron", 2)  # oil tank under the seat
    P.flat(g, oil & (Y == 6), "steel", 5)
    g.prism("x", [(8, zf + 40), (11, zf + 37), (17, zf + 39), (14, zr - 10), (21, zr + 1), (20, zr + 6), (8, zr + 6)], XC - 6.5, XC + 6.5, C("darkwood", 3))  # scooped solo seat
    g.prism("x", [(3, zr + 2), (19, zr + 4), (21, zr + 12), (15, zr + 20), (6, zr + 16)], XC - 6.5, XC + 6.5, C(paint, 4))  # bobbed tail
    fender = last(g)
    for sx in (-1, 1):  # tall sissy bar off the tail
        bar(g, "x", (14, zr + 14), (48, zr + 21), 2, XC + sx * 5 - 1, XC + sx * 5 + 1, "steel", 5)
    box(g, XC - 6, 46, zr + 19, XC + 6, 49, zr + 22, "steel", 5)
    _beachbars(g, zf, 31, 30, sweep=18)
    shell = tank | fender | nose
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, tank & (np.abs(X - XC + 0.5) < 1.5), trim, 5)  # pinstripe
    rust_bloom(g, seed, 5, paint, ys=(4, 30), size=(1.2, 2.2))
    dust(g, fender, 2, seed)

    def low(b):  # V-twin, down tubes, forward pegs and a long low pipe between the wheels
        _engine(b, zf + 26, zf + 50, BELLY - 22)
        bar(b, "x", (BELLY + 1, zf + 1), (BELLY - 20, zf + 26), 3, XC - 1.5, XC + 1.5, "iron", 3)
        bar(b, "x", (BELLY - 20, zf + 50), (BELLY + 1, zr - 2), 3, XC - 1.5, XC + 1.5, "iron", 3)
        _pegs(b, zf + 22, BELLY - 16)
        pipe = box(b, XC - 15, BELLY - 13, zf + 38, XC - 12, BELLY - 10, zr + 14, "steel", 5)
        P.flat(b, pipe & (coords(b)[2] % 5 == 0), "steel", 3)
        box(b, XC - 12, BELLY - 13, zf + 38, XC - 6, BELLY - 10, zf + 41, "steel", 5)

    socks = [sock("socket-hitch", XC, 3, zr + 18, zm), sock("socket-front", XC, 18, zf - 12, zm),
             sock("socket-hood", XC, 41, zf + 18, zm), sock("socket-roof", XC, 20, zr + 12, zm),
             sock("socket-stack-l", XC + 7, 6, zr + 10, zm), sock("socket-stack-r", XC - 7, 6, zr + 10, zm),
             sock("socket-seat", XC, 15, zr - 10, zm)]
    return _finish(name, g, zm, L, low, socks)


def dirt(name="dirt", paint="orange", plate=CREAM, seed=92):
    """Dirt bike: tall and skinny, a number plate with a lamp and a peak, a
    humped tank, a long flat seat, and a long tail fender sweeping up off the
    back."""
    L = 190
    zm = 64
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - HALF, zm + HALF
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 40, zf + 3, "steel", 4)  # head tube
    plate_m = box(g, XC - 7, 26, zf - 7, XC + 7, 42, zf - 4, plate, 6)  # number plate
    P.outline(g, plate_m, plate, 3, normal="z")
    _fresnel(g, XC, 34, zf - 9, r=4.5)  # lamp in the plate, nothing crossing it
    g.prism("x", [(42, zf - 13), (44, zf - 13), (45, zf - 3), (42, zf - 3)], XC - 6, XC + 6, C(paint, 5))  # peak over the plate
    # frame: a loop under the tank and seat, open in the middle
    g.prism("x", [(0, zf - 3), (18, zf + 2), (27, zf + 24), (27, zr), (12, zr + 4), (0, zr + 4), (0, zr - 5), (16, zr - 9), (16, zf + 22), (0, zf + 6)],
            XC - 2.5, XC + 2.5, C("iron", 3))
    tank = rloft(g, [(zf + 3, 4, 19, 31), (zf + 8, 7.5, 17, 39), (zf + 16, 8, 17, 42), (zf + 24, 6.5, 19, 36), (zf + 29, 5, 21, 31)], paint, 4, p=2.4)
    g.prism("x", [(27, zf + 24), (33, zf + 27), (31, zr - 4), (37, zr + 30), (34, zr + 31), (27, zr + 2)], XC - 5, XC + 5, C("iron", 2))  # long flat seat
    g.prism("x", [(14, zf + 24), (27, zf + 24), (27, zr + 2), (34, zr + 31), (42, zr + 68), (40, zr + 70), (30, zr + 40), (19, zr + 8), (10, zr + 2), (10, zf + 30)],
            XC - 6, XC + 6, C(paint, 4))  # side panels and the long tail
    tail = last(g)
    box(g, XC - 4, 39.5, zr + 62, XC + 4, 41.5, zr + 67, "red", 4)  # tail light
    bar(g, "x", (4, zf + 22), (22, zf + 38), 2.4, XC - 9, XC - 6, "steel", 5)  # high pipe
    bar(g, "x", (22, zf + 38), (27, zr + 22), 2.4, XC - 9, XC - 6, "steel", 5)
    _bars(g, 40, zf, 19)
    box(g, XC - 12, 43, zf - 1, XC + 12, 45, zf + 1, "steel", 4)  # cross brace
    shell = tank | tail
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, tail & (np.abs(Y - 22) < 1.2) & (Z < zr + 6), plate, 6)  # side number panel stripe
    rust_bloom(g, seed, 6, paint, ys=(8, 34), size=(1.2, 2.0))
    dust(g, shell, 3, seed)

    def low(b):  # single, skid plate, cradle tubes, pegs
        _engine(b, zf + 26, zf + 50, BELLY - 20, twin=False)
        skid = box(b, XC - 7, BELLY - 23, zf + 24, XC + 7, BELLY - 20, zf + 52, "steel", 4)
        P.plates(b, skid, "steel", 4, size=(7, 7), seed=2)
        bar(b, "x", (BELLY + 1, zf + 1), (BELLY - 21, zf + 26), 3, XC - 1.5, XC + 1.5, "iron", 3)
        bar(b, "x", (BELLY - 21, zf + 52), (BELLY + 1, zr - 2), 3, XC - 1.5, XC + 1.5, "iron", 3)
        _pegs(b, zf + 46, BELLY - 15)

    socks = [sock("socket-hitch", XC, 3, zr + 8, zm), sock("socket-front", XC, 20, zf - 8, zm),
             sock("socket-hood", XC, 42, zf + 16, zm), sock("socket-roof", XC, 36, zr + 26, zm),
             sock("socket-stack-l", XC + 7, 20, zr + 10, zm), sock("socket-stack-r", XC - 7, 20, zr + 10, zm),
             sock("socket-seat", XC, 32, zr - 14, zm)]
    return _finish(name, g, zm, L, low, socks)


TH = WB["T"] / K / 2  # half the design wheelbase of the tiny bikes


def scooter(name="scooter", paint=MINT, trim=CREAM, seed=94):
    """Scooter: short, with the seat close behind the bars. A tall leg
    shield, a low step-through floor, a big round egg of a rear cowl with a
    bench seat, a headset lamp and a little rear rack."""
    L = 150
    zm = 50
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - TH, zm + TH
    g.prism("x", [(0, zf - 4), (26, zf - 9), (40, zf - 6), (42, zf - 1), (40, zf + 3), (0, zf + 5)], XC - 11, XC + 11, C(paint, 4))  # leg shield
    shield = last(g)
    rear = rloft(g, [(zr - 38, 6, 0, 15), (zr - 31, 11, 0, 24), (zr - 14, 13.5, 0, 28), (zr + 24, 13, 2, 27), (zr + 44, 9.5, 6, 23), (zr + 54, 5, 10, 18)],
                 paint, 4, p=2.3, n=16)  # the egg cowl, over the rear wheel
    g.prism("x", [(24, zr - 34), (30, zr - 32), (31, zr + 14), (28, zr + 18), (24, zr + 18)], XC - 7.5, XC + 7.5, C("darkwood", 3))  # bench seat
    box(g, XC - 3, 30, zf - 7, XC + 3, 42, zf - 1, paint, 4)  # steering column
    head = box(g, XC - 7, 40, zf - 9, XC + 7, 46, zf + 2, paint, 4)  # headset
    _fresnel(g, XC, 43, zf - 14, r=5.0)
    _bars(g, 44, zf - 2, 15)
    box(g, XC - 7, 26, zr + 30, XC + 7, 28, zr + 46, "steel", 5)  # rack
    for z in (zr + 32, zr + 43):
        box(g, XC - 6, 22, z, XC + 6, 26, z + 2, "steel", 4)
    shell = shield | rear | head
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, shield & (Y >= 6) & (Y < 9), trim, 6)
    P.flat(g, rear & (np.abs(Y - 13) < 1.3), trim, 6)  # side flash
    rust_bloom(g, seed, 6, paint, ys=(2, 30), size=(1.2, 2.2))
    dust(g, shell, 3, seed)

    def low(b):  # a low step-through floor between the wheels, swept up at both ends
        b.prism("x", [(BELLY + 1, zf + 2), (BELLY + 1, zf + 8), (BELLY - 8, zf + 17), (BELLY - 12, zf + 17), (BELLY - 12, zf + 11)], XC - 10, XC + 10, C(paint, 4))
        fl = box(b, XC - 10, BELLY - 12, zf + 15, XC + 10, BELLY - 8, zr - 28, "iron", 3)
        P.flat(b, fl & (coords(b)[1] == BELLY - 9) & (coords(b)[2] % 3 == 0), "iron", 1)  # rubber ribs
        b.prism("x", [(BELLY - 12, zr - 30), (BELLY + 1, zr - 36), (BELLY + 1, zr - 8), (BELLY - 12, zr - 14)], XC - 10, XC + 10, C(paint, 4))
        eng = box(b, XC - 4, BELLY - 14, zr - 12, XC + 9, BELLY - 3, zr - 2, "steel", 4)
        P.flat(b, eng & (coords(b)[1] % 2 == 0), "steel", 2)

    socks = [sock("socket-hitch", XC, 8, zr + 52, zm), sock("socket-front", XC, 10, zf - 7, zm),
             sock("socket-hood", XC, 46, zf - 3, zm), sock("socket-roof", XC, 28, zr + 38, zm),
             sock("socket-stack-l", XC + 9, 8, zr + 40, zm), sock("socket-stack-r", XC - 9, 8, zr + 40, zm),
             sock("socket-seat", XC, 30, zr - 8, zm)]
    return _finish(name, g, zm, L, low, socks, cls="T")


def minibike(name="minibike", paint="red", trim=CREAM, seed=95):
    """Minibike: tiny, with a fat peanut tank, a thick slab of a seat, tall
    wide bars and a big lamp, all too big for it."""
    L = 120
    zm = 50
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - TH, zm + TH
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 30, zf + 3, "steel", 4)  # neck
    _fresnel(g, XC, 23, zf - 9, r=6.0)
    g.prism("x", [(0, zf - 3), (9, zf + 2), (9, zr + 4), (0, zr + 4), (0, zr - 5), (5, zr - 8), (5, zf + 12), (0, zf + 6)], XC - 2.5, XC + 2.5, C("iron", 3))  # frame loop
    tank = rloft(g, [(zf + 3, 4, 10, 18), (zf + 8, 8.5, 8, 25), (zf + 15, 10, 8, 27), (zf + 23, 8, 8, 23), (zf + 28, 4, 8, 16)], paint, 4, p=2.2, n=16)
    g.prism("x", [(8, zf + 26), (17, zf + 27), (18, zr + 8), (15, zr + 12), (8, zr + 12)], XC - 8, XC + 8, C("darkwood", 3))  # thick slab seat
    seat = last(g)
    P.flat(g, seat & (np.abs(Y - 12) < 0.7), trim, 6)  # piping
    _widebars(g, zf, 48, 18, rise=18)
    box(g, XC - 5, 4, zr + 6, XC + 5, 8, zr + 16, paint, 4)  # stub tail
    tailm = last(g)
    box(g, XC - 3, 5, zr + 16, XC + 3, 7.5, zr + 17.5, "red", 4)
    paint_shell(g, tank | tailm, paint, 4, seam=99, seed=seed)
    P.flat(g, tank & (np.abs(Y - 16) < 1.2), trim, 6)  # tank stripe
    rust_bloom(g, seed, 4, paint, ys=(4, 24), size=(1.0, 1.8))

    def low(b):  # a little flat single with a pull-start, a fat can, pegs
        eng = box(b, XC - 6, BELLY - 16, zf + 16, XC + 6, BELLY - 2, zf + 34, "steel", 3)
        P.flat(b, eng & (coords(b)[1] % 2 == 0) & (coords(b)[1] > BELLY - 10), "steel", 5)  # fins
        b.prism("x", [(BELLY - 9 + v, zf + 25 + u) for u, v in ngon(0, 0, 4.5, 10)], XC + 6, XC + 9, C("iron", 2))  # pull-start
        box(b, XC - 11, BELLY - 12, zf + 26, XC - 7, BELLY - 6, zr - 4, "steel", 5)  # fat exhaust can
        bar(b, "x", (BELLY + 1, zf + 1), (BELLY - 12, zf + 16), 3, XC - 1.5, XC + 1.5, "iron", 3)
        bar(b, "x", (BELLY - 12, zf + 34), (BELLY + 1, zr - 2), 3, XC - 1.5, XC + 1.5, "iron", 3)
        _pegs(b, zf + 30, BELLY - 15)

    socks = [sock("socket-hitch", XC, 5, zr + 16, zm), sock("socket-front", XC, 14, zf - 9, zm),
             sock("socket-hood", XC, 27, zf + 15, zm), sock("socket-roof", XC, 8, zr + 11, zm),
             sock("socket-stack-l", XC + 7, 4, zr + 6, zm), sock("socket-stack-r", XC - 7, 4, zr + 6, zm),
             sock("socket-seat", XC, 18, zr - 4, zm)]
    return _finish(name, g, zm, L, low, socks, cls="T")


def sport(name="sport", paint="lime", trim="iron", seed=96):
    """Sport bike: a big bullet nose fairing with a bubble screen, a tall
    humped tank, a tiny seat and a pointed tail kicked way up, clip-ons and
    a belly pan."""
    L = 188
    zm = 84
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - HALF, zm + HALF
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 26, zf + 3, "steel", 4)  # neck
    nose = rloft(g, [(zf - 40, 3.5, 13, 19), (zf - 26, 7.5, 8, 25), (zf - 8, 10.5, 3, 32), (zf + 8, 11, 2, 34), (zf + 16, 9, 2, 32)], paint, 4, p=3.4, n=16)
    for sx in (-1, 1):  # twin lamps either side of the beak
        _fresnel(g, XC + sx * 5.5, 19, zf - 30, r=2.6)
    g.prism("x", [(26, zf - 20), (42, zf + 2), (39, zf + 6), (31, zf + 4)], XC - 7, XC + 7, C("navy", 2))  # bubble screen
    scr = last(g)
    P.flat(g, scr & ((X + Y + Z) % 7 == 3), "navy", 5)
    g.prism("x", [(3, zf + 2), (14, zf + 3), (14, zr - 2), (3, zr + 3)], XC - 3, XC + 3, C("iron", 3))  # frame spar
    tank = rloft(g, [(zf + 12, 8.5, 14, 33), (zf + 20, 10, 14, 39), (zf + 30, 9.5, 14, 38), (zf + 39, 6, 14, 28)], paint, 4, p=2.6, n=16)
    g.prism("x", [(14, zf + 35), (25, zf + 37), (23, zr - 8), (31, zr + 6), (14, zr + 6)], XC - 6, XC + 6, C("iron", 2))  # tiny seat
    g.prism("x", [(14, zr - 12), (23, zr - 8), (31, zr + 6), (37, zr + 12), (46, zr + 40), (43, zr + 42), (30, zr + 22), (16, zr + 8)], XC - 6.5, XC + 6.5, C(paint, 4))  # kicked-up tail
    tail = last(g)
    box(g, XC - 4, 42, zr + 38, XC + 4, 44.5, zr + 41.5, "red", 4)  # tail light
    _bars(g, 27, zf + 4, 13)  # clip-ons
    shell = nose | tank | tail
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, shell & (np.abs(Y - 20) < 1.5) & (Z < zf + 12), trim, 3)  # nose stripe
    P.flat(g, tail & (np.abs(X - XC + 0.5) < 1.5), trim, 3)
    rust_bloom(g, seed, 5, paint, ys=(4, 36), size=(1.2, 2.2))
    dust(g, shell, 2, seed)

    def low(b):  # a belly pan round the engine, rear-set pegs, a stubby underslung can
        pan = b.prism("x", [(BELLY + 1, zf + 10), (BELLY + 1, zr - 12), (BELLY - 14, zr - 20), (BELLY - 23, zf + 44), (BELLY - 23, zf + 24), (BELLY - 12, zf + 13)],
                      XC - 8, XC + 8, C(paint, 4))
        pm = last(b)
        paint_shell(b, pm, paint, 4, seam=99, seed=seed + 1)
        P.flat(b, pm & (np.abs(coords(b)[1] - (BELLY - 8)) < 1.3), trim, 3)
        eng = box(b, XC - 9.5, BELLY - 16, zf + 26, XC + 9.5, BELLY - 6, zf + 42, "iron", 3)  # engine cases showing through
        P.flat(b, eng & (coords(b)[1] % 2 == 0), "steel", 4)
        _pegs(b, zr - 16, BELLY - 10)
        box(b, XC - 12, BELLY - 20, zf + 40, XC - 8, BELLY - 14, zr - 6, "steel", 5)

    socks = [sock("socket-hitch", XC, 3, zr + 8, zm), sock("socket-front", XC, 8, zf - 36, zm),
             sock("socket-hood", XC, 39, zf + 22, zm), sock("socket-roof", XC, 40, zr + 30, zm),
             sock("socket-stack-l", XC + 7, 16, zr + 12, zm), sock("socket-stack-r", XC - 7, 16, zr + 12, zm),
             sock("socket-seat", XC, 24, zr - 12, zm)]
    return _finish(name, g, zm, L, low, socks)


def bagger(name="bagger", paint="purple", trim=CREAM, seed=97):
    """Bagger: a huge batwing fairing with a tall screen and three lamps, a
    fat tank, a sofa of a seat with a backrest, big saddlebags either side of
    the rear wheel and a top trunk."""
    L = 186
    zm = 72
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - HALF, zm + HALF
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 30, zf + 3, "steel", 4)  # neck
    wing = [(XC - 22, 25), (XC - 18, 37), (XC - 9, 43), (XC + 9, 43), (XC + 18, 37), (XC + 22, 25), (XC + 11, 15), (XC - 11, 15)]
    g.prism("z", [(XC + (x - XC) * 0.7, 29 + (y - 29) * 0.75) for x, y in wing], zf - 13, zf - 7, C(paint, 4), top=wing)  # batwing, rounded forward
    bat = last(g)
    g.prism("z", wing, zf - 7, zf - 2, C(paint, 4))
    bat |= last(g)
    g.prism("z", [(XC - 10, 43), (XC - 8, 56), (XC + 8, 56), (XC + 10, 43)], zf - 6, zf - 4, C("navy", 2))  # tall screen
    scr = last(g)
    P.flat(g, scr & ((X + Y) % 7 == 3), "navy", 5)
    _fresnel(g, XC, 30, zf - 17, r=6.0)
    for sx in (-1, 1):
        _fresnel(g, XC + sx * 12, 26, zf - 14, r=3.0)
    g.prism("x", [(3, zf + 2), (13, zf + 3), (13, zr - 2), (3, zr + 3)], XC - 3, XC + 3, C("iron", 3))  # frame spar
    tank = rloft(g, [(zf + 2, 6, 14, 26), (zf + 10, 11, 12, 33), (zf + 22, 11.5, 12, 33), (zf + 33, 7, 12, 26)], paint, 4, p=2.3, n=16)
    g.prism("x", [(12, zf + 30), (21, zf + 33), (19, zr - 12), (25, zr - 3), (42, zr + 3), (42, zr + 8), (12, zr + 8)], XC - 8.5, XC + 8.5, C("darkwood", 3))  # sofa seat and backrest
    trunk = rloft(g, [(zr + 9, 9, 16, 34), (zr + 14, 11.5, 14, 37), (zr + 32, 11.5, 14, 37), (zr + 38, 9, 16, 33)], paint, 4, p=3.2, n=16)  # top trunk
    box(g, XC - 3, 8, zr + 8, XC + 3, 16, zr + 34, "iron", 3)  # trunk post
    _beachbars(g, zf, 34, 21, sweep=12)
    shell = bat | tank | trunk
    paint_shell(g, shell, paint, 4, seam=99, seed=seed)
    P.flat(g, tank & (np.abs(Y - 22) < 1.2), trim, 6)
    P.flat(g, trunk & (np.abs(Y - 25) < 1.2), trim, 6)
    P.flat(g, bat & (Y < 18.5), trim, 6)
    rust_bloom(g, seed, 6, paint, ys=(6, 36), size=(1.2, 2.2))

    def low(b):  # V-twin, floorboards, crash bars, and the saddlebags either side of the rear wheel
        _engine(b, zf + 26, zf + 50, BELLY - 22)
        bar(b, "x", (BELLY + 1, zf + 1), (BELLY - 20, zf + 26), 3, XC - 1.5, XC + 1.5, "iron", 3)
        bar(b, "x", (BELLY - 20, zf + 50), (BELLY + 1, zr - 2), 3, XC - 1.5, XC + 1.5, "iron", 3)
        for sx in (-1, 1):
            box(b, XC + sx * 9 - 4, BELLY - 19, zf + 22, XC + sx * 9 + 4, BELLY - 17, zf + 40, "steel", 4)  # floorboard
            bar(b, "y", (XC + sx * 6, zf + 14), (XC + sx * 14, zf + 20), 2.4, BELLY - 12, BELLY - 9.6, "steel", 6)  # crash bar
            bag = rloft(b, [(zr + 10, 4, BELLY - 20, BELLY + 2), (zr + 16, 6, BELLY - 24, BELLY + 4), (zr + 56, 6, BELLY - 24, BELLY + 4), (zr + 64, 4, BELLY - 18, BELLY + 2)],
                        paint, 4, cx=XC + sx * 19, p=3.0)
            paint_shell(b, bag, paint, 4, seam=99, seed=seed + 2)
            P.flat(b, bag & (np.abs(coords(b)[1] - (BELLY - 8)) < 1.2), trim, 6)
            box(b, XC + sx * 13 - 2, BELLY - 2, zr + 4, XC + sx * 13 + 2, BELLY + 1, zr + 14, "steel", 4)  # bag bracket to the frame
        box(b, XC - 14, BELLY - 2, zr + 2, XC + 14, BELLY + 1, zr + 6, "steel", 4)
        pipe = box(b, XC - 13, BELLY - 15, zf + 40, XC - 10, BELLY - 12, zr + 8, "steel", 5)

    socks = [sock("socket-hitch", XC, 6, zr + 40, zm), sock("socket-front", XC, 12, zf - 12, zm),
             sock("socket-hood", XC, 33, zf + 16, zm), sock("socket-roof", XC, 37, zr + 23, zm),
             sock("socket-stack-l", XC + 8, 6, zr + 40, zm), sock("socket-stack-r", XC - 8, 6, zr + 40, zm),
             sock("socket-seat", XC, 21, zr - 12, zm)]
    return _finish(name, g, zm, L, low, socks)


def sidecar(name="sidecar", paint="khaki", trim=CREAM, seed=98):
    """Sidecar rig: an old upright bike with sprung saddles and a round
    tank, and a bullet-nosed tub on its right with its own wheel (the rear
    wheel's kind, as a single, on `socket-axle-s`)."""
    L = 160
    zm = 72
    g = Grid(BW, 64, L)
    X, Y, Z = coords(g)
    zf, zr = zm - HALF, zm + HALF
    _pads(g, zf, zr)
    box(g, XC - 2.5, 0, zf - 3, XC + 2.5, 32, zf + 3, "steel", 4)  # neck
    _fresnel(g, XC, 25, zf - 10, r=6.5)
    g.prism("x", [(0, zf - 3), (14, zf + 2), (14, zr + 4), (0, zr + 4), (0, zr - 5), (8, zr - 9), (8, zf + 14), (0, zf + 6)], XC - 2.5, XC + 2.5, C("iron", 3))  # frame loop
    tank = rloft(g, [(zf + 3, 4, 15, 23), (zf + 8, 9, 13, 30), (zf + 18, 10.5, 13, 32), (zf + 28, 8.5, 13, 28), (zf + 33, 4, 13, 21)], paint, 4, p=2.2, n=16)
    for z0, w in ((zf + 37, 7), (zr - 6, 6.5)):  # two sprung saddles
        g.prism("x", [(19, z0), (23, z0 + 1), (24, z0 + 15), (21, z0 + 18), (19, z0 + 17)], XC - w, XC + w, C("darkwood", 3))
        for sx in (-1, 1):
            sp = box(g, XC + sx * 4 - 1.5, 14, z0 + 11, XC + sx * 4 + 1.5, 19, z0 + 14, "steel", 5)
            P.flat(g, sp & (Y % 2 == 0), "steel", 2)
    g.prism("x", [(3, zr + 2), (16, zr + 4), (18, zr + 14), (12, zr + 20), (5, zr + 16)], XC - 6.5, XC + 6.5, C(paint, 4))  # tail
    tailm = last(g)
    _bars(g, 33, zf, 17)
    paint_shell(g, tank | tailm, paint, 4, seam=99, seed=seed)
    P.flat(g, tank & (np.abs(Y - 21) < 1.2), trim, 6)
    rust_bloom(g, seed, 5, paint, ys=(4, 30), size=(1.2, 2.2))

    def low(b):  # flat twin, cradle tubes, pegs
        _engine(b, zf + 26, zf + 50, BELLY - 22)
        for sx in (-1, 1):  # boxer cylinders sticking out
            cyl = box(b, min(XC + sx * 6, XC + sx * 13), BELLY - 18, zf + 32, max(XC + sx * 6, XC + sx * 13), BELLY - 11, zf + 42, "steel", 5)
            P.flat(b, cyl & (coords(b)[0] % 2 == 0), "steel", 3)
        bar(b, "x", (BELLY + 1, zf + 1), (BELLY - 20, zf + 26), 3, XC - 1.5, XC + 1.5, "iron", 3)
        bar(b, "x", (BELLY - 20, zf + 50), (BELLY + 1, zr - 2), 3, XC - 1.5, XC + 1.5, "iron", 3)
        _pegs(b, zf + 48, BELLY - 16)

    # the tub, drawn in its own grid (belly coordinates): TC is the tub's centre line, 36 right of the bike's
    TC, OFF = 44, 36
    za, zb = zf + 16, zr + 16  # the tub sits back, beside the rear wheel (which trails behind its mount)
    tg = Grid(96, 64, L)
    tub = rloft(tg, [(za - 8, 3, BELLY - 10, BELLY - 2), (za + 2, 9, BELLY - 18, BELLY + 6), (za + 20, 12.5, BELLY - 22, BELLY + 12), (zb - 8, 12.5, BELLY - 22, BELLY + 12),
                     (zb + 14, 10.5, BELLY - 20, BELLY + 10), (zb + 24, 6, BELLY - 14, BELLY + 4)], paint, 4, cx=TC, p=2.4, n=16)
    TX_, TY, TZ = coords(tg)
    paint_shell(tg, tub, paint, 4, seam=99, seed=seed + 3)
    P.flat(tg, tub & (np.abs(TY - (BELLY - 4)) < 1.3), trim, 6)  # stripe
    P.flat(tg, tub & (TY >= BELLY + 9) & (TZ > za + 26) & (TZ < zb + 2) & (np.abs(TX_ - TC + 0.5) < 8.5), "iron", 1)  # cockpit opening
    tg.prism("x", [(BELLY + 9, zb - 4), (BELLY + 24, zb + 1), (BELLY + 24, zb + 5), (BELLY + 9, zb + 6)], TC - 8, TC + 8, C("darkwood", 3))  # seat back
    tg.prism("x", [(BELLY + 10, za + 18), (BELLY + 22, za + 25), (BELLY + 22, za + 27), (BELLY + 10, za + 23)], TC - 8.5, TC + 8.5, C("navy", 2))  # little screen
    scr = last(tg)
    P.flat(tg, scr & ((TX_ + TY) % 7 == 3), "navy", 5)
    side_x = TC - 20  # the sidecar wheel's mount, outboard of the tub
    box(tg, side_x - 4, BELLY - 3, zb + 10, TC - 8, BELLY + SAG, zb + 18, "steel", 3)  # outrigger to the wheel mount
    for z in (zf + 30, zr):  # struts across to the bike's frame
        box(tg, TC + 8, BELLY - 3, z - 1.5, TC + OFF, BELLY, z + 1.5, "steel", 4)
    socks = [sock("socket-hitch", XC, 3, zr + 18, zm), sock("socket-front", XC, 18, zf - 12, zm),
             sock("socket-hood", XC, 31, zf + 17, zm), sock("socket-roof", XC - OFF, 14, zf + 26, zm),
             sock("socket-stack-l", XC + 7, 6, zr + 10, zm), sock("socket-stack-r", XC - 7, 6, zr + 10, zm),
             sock("socket-seat", XC, 24, zf + 46, zm)]
    return _finish(name, g, zm, L, low, socks, side=(XC - OFF - 20, zr + 30), extra=[("tub", tg, TC + OFF)])


BIKES = {"chopper": chopper, "dirt": dirt, "sport": sport, "bagger": bagger, "sidecar": sidecar, "scooter": scooter, "minibike": minibike}
BIKE_DEFAULTS = {
    "chopper": {"front": "mono-road", "rear": "mono-road", "stacks": "zoomies"},
    "dirt": {"front": "mono-enduro", "rear": "mono-enduro"},
    "sport": {"front": "mono-road", "rear": "mono-road"},
    "bagger": {"front": "mono-road", "rear": "mono-road"},
    "sidecar": {"front": "mono-road", "rear": "mono-road"},
    "scooter": {"front": "mono-scooter", "rear": "mono-scooter"},
    "minibike": {"front": "mono-scooter", "rear": "mono-scooter"},
}
BIKE_PAINT = {"chopper": ("sky", "orange", "steel"), "dirt": ("orange", "bone", "steel"), "sport": ("lime", "iron", "steel"),
              "bagger": ("purple", "bone", "steel"), "sidecar": ("khaki", "bone", "steel"), "scooter": ("lime", "bone", "steel"),
              "minibike": ("red", "bone", "steel")}
