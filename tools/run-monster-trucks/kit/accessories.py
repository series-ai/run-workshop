"""Bolt-on parts for the body sockets: roof, hood and stacks.

Each builder returns a Part whose origin is its attach point (the bottom
centre where it meets the body), +Y up, front -Z. Round shapes are faceted
prisms (true slopes), like the tyres, never voxel stair-steps.
"""
from __future__ import annotations

import math

import numpy as np

from gear import knobby_tyre
from kit import CREAM, PINK, C, Grid, P, Part, box, coords, ngon, radial
from pnshapes import bar, last

AW, AH, AD = 48, 48, 56
XC, ZC = AW // 2, AD // 2


def _part(name: str, g: Grid, rot=(0.0, 0.0, 0.0)) -> Part:
    root = Part(name, None, pivot=(XC, 0, ZC))
    root.add(Part(f"{name}-mesh", g, pivot=(XC, 0, ZC), at=(0, 0, 0), rot=rot))
    return root


def _rack(g: Grid, half_w: int, half_l: int, y: int = 0, h: int = 4) -> None:
    """Tubular roof rack: corner feet, rails, cross bars."""
    x0, x1, z0, z1 = XC - half_w, XC + half_w, ZC - half_l, ZC + half_l
    for x in (x0, x1 - 2):
        for z in (z0, ZC - 1, z1 - 2):
            box(g, x, y, z, x + 2, y + h, z + 2, "steel", 3)
    for x in (x0, x1 - 2):
        box(g, x, y + h, z0, x + 2, y + h + 2, z1, "steel", 5)
    for z in (z0, z1 - 2):
        box(g, x0, y + h, z, x1, y + h + 2, z + 2, "steel", 5)
    for z in range(z0 + 6, z1 - 4, 6):
        box(g, x0, y + h, z, x1, y + h + 1, z + 2, "steel", 4)


def jerry_can(g: Grid, x, y, z, ramp="red") -> None:
    m = box(g, x, y, z, x + 4, y + 8, z + 7, ramp, 4)
    P.flat(g, m & (coords(g)[1] == y + 7), ramp, 5)
    P.flat(g, m & (coords(g)[2] == z + 3), ramp, 2)
    box(g, x + 1, y + 8, z + 1, x + 3, y + 9, z + 3, "steel", 3)


def rack_spare() -> Part:
    """A rack heaped with spares: one standing up, one lying flat, one
    tipped over against it."""
    g = Grid(AW, AH, AD)
    _rack(g, 16, 20)
    knobby_tyre(g, XC + 4, 6 + 11, ZC + 8, 11, 9, lugs=11, depth=2.2, rim=("orange", 5), hub=("orange", 3))  # standing
    g.prism("y", [(XC - 6 + u, ZC - 8 + v) for u, v in ngon(0, 0, 10, 14, math.pi / 14)], 6, 11, C("iron", 3))  # lying flat
    flat = last(g)
    rr = radial(g, "y", XC - 6, ZC - 8)
    P.flat(g, flat & (rr < 5.5), "orange", 5)
    P.flat(g, flat & (rr > 9), "iron", 2)
    P.flat(g, flat & (rr > 5.5) & (rr < 9) & ((np.floor(np.arctan2(coords(g)[2] - ZC + 8, coords(g)[0] - XC + 6) * 3) % 2) == 0), "iron", 2)  # lugs
    root = Part("roof-rack-spare", None, pivot=(XC, 0, ZC))
    root.add(Part("roof-rack-spare-mesh", g, pivot=(XC, 0, ZC), at=(0, 0, 0)))
    tg = Grid(AW, AH, AD)  # a third tyre tipped over, leaning on the stack
    knobby_tyre(tg, XC, 11, ZC, 10, 8, lugs=11, depth=2.0, rim=("orange", 5), hub=("orange", 3))
    root.add(Part("roof-rack-spare-tipped", tg, pivot=(XC, 0, ZC), at=(-8, 8, -6), rot=(0.0, 20.0, 62.0)))
    return root


def rack_cargo() -> Part:
    g = Grid(AW, AH, AD)
    _rack(g, 16, 22)
    cans = ((XC - 12, ZC - 18, "red"), (XC - 6, ZC - 18, "khaki"), (XC, ZC - 18, "red"), (XC - 12, ZC - 9, "steel"), (XC + 6, ZC + 12, "red"), (XC + 10, ZC + 12, "khaki"))
    for x, z, ramp in cans:
        jerry_can(g, x, 7, z, ramp)
    g.prism("x", [(7, ZC - 4), (13, ZC - 4), (15, ZC - 1), (15, ZC + 8), (7, ZC + 8)], XC - 12, XC + 12, C("khaki", 3))  # tarp roll
    P.flat(g, last(g) & ((coords(g)[2] % 5) == 0), "khaki", 2)
    box(g, XC - 13, 11, ZC - 3, XC + 13, 12, ZC + 7, "orange", 4)  # strap
    return _part("roof-rack-cargo", g)


def jerry_frame() -> Part:
    g = Grid(AW, AH, AD)
    for x in (XC - 8, XC + 6):
        box(g, x, 0, ZC - 6, x + 2, 16, ZC - 4, "iron", 3)
    box(g, XC - 8, 14, ZC - 6, XC + 8, 16, ZC - 4, "iron", 3)
    box(g, XC - 9, 0, ZC - 6, XC + 9, 2, ZC + 6, "iron", 3)
    jc = box(g, XC - 5, 2, ZC - 4, XC + 5, 18, ZC + 4, "red", 4)
    X, Y, Z = coords(g)
    P.flat(g, jc & (Y >= 16), "red", 5)
    P.flat(g, jc & ((X == XC - 5) | (X == XC + 4)) & (((Y - 2) % 6) == 3), "red", 2)
    box(g, XC - 2, 18, ZC - 3, XC + 2, 21, ZC, "steel", 3)
    return _part("roof-jerry-frame", g)


def cone() -> Part:
    """Giant ice cream: a faceted waffle cone and stacked soft-serve tiers,
    built upright and tipped over as one part, scoop toward the front."""
    g = Grid(AW, 64, AD)
    n = 12
    # cone from a point at y=0 up to r=11 at y=26, along y
    g.prism("y", [(XC + u, ZC + v) for u, v in ngon(0, 0, 0.6, n, math.pi / n)], 0, 26, C("wood", 6),
            top=[(XC + u, ZC + v) for u, v in ngon(0, 0, 11, n, math.pi / n)])
    cm = last(g)
    X, Y, Z = coords(g)
    ang = (np.arctan2(Z + 0.5 - ZC, X + 0.5 - XC) / (2 * math.pi) * 24).astype(int)
    P.flat(g, cm & (((Y + ang) % 4 == 0) | ((Y - ang) % 4 == 0)), "wood", 4)  # waffle grid
    g.prism("y", [(XC + u, ZC + v) for u, v in ngon(0, 0, 12.5, n, math.pi / n)], 26, 29, C("wood", 5))  # rim
    # soft serve: three swirl tiers and a curl on top
    y = 29
    for k, (r0, r1, h) in enumerate(((13, 11, 6), (11, 8, 6), (8, 5, 5), (5, 1, 5))):
        g.prism("y", [(XC + u, ZC + v) for u, v in ngon(0, 0, r0, n, k * 0.25)], y, y + h, C(CREAM, 6),
                top=[(XC + u, ZC + v) for u, v in ngon(0, 0, r1, n, k * 0.25 + 0.3)])
        P.flat(g, last(g) & (Y == y), CREAM, 4)  # shadowed underside of each tier
        y += h
    cone_r = lambda y: 0.6 + (11 - 0.6) * y / 26  # noqa: E731
    root = Part("roof-cone", None, pivot=(XC, 0, ZC))
    # tip it over: lean the scoop forward (-z) and lift so the cone tip rests on the roof
    root.add(Part("roof-cone-mesh", g, pivot=(XC, 0, ZC), at=CONE_AT, rot=(-CONE_TILT, 0.0, 0.0)))
    root.add(Part("roof-cone-stand", _cone_stand(cone_r), pivot=(XC, 0, ZC), at=(0, 0, 0)))
    return root


CONE_AT, CONE_TILT, POSTS = (0, 7, 14), 62.0, (9.0, 20.0)


def _cone_stand(cone_r) -> Grid:
    """Two little posts from the roof up to the tipped cone's underside."""
    g = Grid(AW, AH, AD)
    ca, sa = math.cos(math.radians(CONE_TILT)), math.sin(math.radians(CONE_TILT))
    for t in POSTS:
        r = cone_r(t)
        y = CONE_AT[1] + ca * t - sa * r  # underside of the cone at this point
        z = ZC + CONE_AT[2] - sa * t - ca * r
        box(g, XC - 1.5, 0, z - 1.5, XC + 1.5, y + 1.5, z + 1.5, "steel", 4)
        box(g, XC - 2.5, 0, z - 2.5, XC + 2.5, 1, z + 2.5, "steel", 2)  # foot
    return g


def light_bar() -> Part:
    g = Grid(AW, AH, AD)
    for x in (XC - 14, XC + 12):
        box(g, x, 0, ZC - 1, x + 2, 6, ZC + 1, "iron", 3)
    box(g, XC - 15, 6, ZC - 2, XC + 15, 10, ZC + 2, "iron", 2)
    for k in range(5):
        x = XC - 13 + k * 6
        g.prism("z", [(x + u, 8 + v) for u, v in ngon(0, 0, 2.4, 8, math.pi / 8)], ZC - 3, ZC - 2, C("gold", 7))
    return _part("roof-light-bar", g)


def blower(size: str = "small") -> Part:
    """Supercharger with chrome twin intakes; `giant` sticks way up."""
    g = Grid(AW, AH, AD)
    w, d, h, st = (12, 10, 6, 5) if size == "small" else (16, 18, 10, 10)
    bl = box(g, XC - w // 2, 0, ZC - d // 2, XC + w // 2, h, ZC + d // 2, "steel", 5)
    X, Y, Z = coords(g)
    P.flat(g, bl & (Z % 2 == 0) & (Y < h - 1), "steel", 3)
    for sx in (XC - w // 4, XC + w // 4):
        r = 2.6 if size == "small" else 3.6
        g.prism("y", [(sx + u, ZC + v) for u, v in ngon(0, 0, r, 10)], h, h + st, C("steel", 6),
                top=[(sx + u, ZC + v) for u, v in ngon(0, 0, r + 0.8, 10)])
        m = last(g)
        P.flat(g, m & (Y >= h + st - 1) & (radial(g, "y", sx, ZC) < r - 0.6), "iron", 1)
    if size != "small":
        box(g, XC - w // 2 - 1, h + st, ZC - 6, XC + w // 2 + 1, h + st + 1, ZC + 6, "steel", 4)  # scoop plate
    return _part(f"hood-blower{'' if size == 'small' else '-giant'}", g)


def stack() -> Part:
    """One tall exhaust stack with a bent rain cap (pairs go on both sockets)."""
    g = Grid(AW, AH, AD)
    g.prism("y", [(XC + u, ZC + v) for u, v in ngon(0, 0, 2.2, 8, math.pi / 8)], 0, 38, C("steel", 5))
    m = last(g)
    X, Y, Z = coords(g)
    P.flat(g, m & (Y % 7 == 0), "steel", 3)
    P.flat(g, m & (Y >= 32), "iron", 2)  # soot
    g.prism("z", [(XC - 2.6, 38), (XC + 2.6, 38), (XC + 2.6, 40), (XC - 2.6, 41.5)], ZC - 2.6, ZC + 2.6, C("steel", 3))  # flap
    return _part("stack", g)


# ---------------------------------------------------------------- front (socket-front)
# Front parts: origin on the bumper's front face at bumper height; they build
# forward (-z) from the back plane ZB and may hang below the bumper.
FW, FH, FD = 76, 60, 40
FXC, FY0, ZB = FW // 2, 18, 36


def _front(name: str, g: Grid) -> Part:
    root = Part(name, None, pivot=(FXC, FY0, ZB))
    root.add(Part(f"{name}-mesh", g, pivot=(FXC, FY0, ZB), at=(0, 0, 0)))
    return root


def _rust(g: Grid, seed: int, n: int = 10) -> None:
    from kit import AK

    AK.rust_patches(g, seed, n, from_ramps=("steel", "red", "gold", "iron", "khaki"), rmin=0.8, rmax=1.8)


def cow_catcher() -> Part:
    """Locomotive pilot: slanted bars in a forward V, a top rail on the
    bumper and a bent bottom rail."""
    g = Grid(FW, FH, FD)
    y0 = FY0
    for xk in range(-21, 22, 3):
        reach = 18 - abs(xk) * 0.55  # the V: middle bars reach furthest forward
        x = FXC + xk
        bar(g, "x", (y0 + 2, ZB - 2), (y0 - 14, ZB - 4 - reach), 2.0, x - 1, x + 1, "red", 4)
    # bottom rail along the V (prism along y, polygon in x-z)
    pts_f = [(FXC + xk, ZB - 4 - (18 - abs(xk) * 0.55) - 1.2) for xk in (-22, 0, 22)]
    pts_b = [(FXC + xk, ZB - 4 - (18 - abs(xk) * 0.55) + 1.2) for xk in (22, 0, -22)]
    g.prism("y", pts_f + pts_b, y0 - 15, y0 - 12, C("steel", 3))
    box(g, FXC - 23, y0 - 1, ZB - 4, FXC + 23, y0 + 3, ZB, "steel", 4)  # top rail on the bumper
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Y == y0 + 2) & (X % 4 == 0), "steel", 6)  # bolt heads
    _rust(g, 61, 14)
    return _front("cow-catcher", g)


def longhorns() -> Part:
    """Steer horns on a riveted mount plate: tapering faceted segments that
    sweep out, up and a touch forward."""
    g = Grid(FW, FH, FD)
    plate = box(g, FXC - 7, FY0 - 3, ZB - 4, FXC + 7, FY0 + 6, ZB, "steel", 3)
    P.plates(g, plate, "steel", 3, size=(7, 5), seed=2)
    n, x_in, x_out = 7, 5, 33
    xs = [x_in + (x_out - x_in) * k / n for k in range(n + 1)]
    yc = lambda x: FY0 + 2 + 0.016 * (x - x_in) ** 2  # noqa: E731
    zc = lambda x: ZB - 4 - 0.006 * (x - x_in) ** 2  # noqa: E731
    rc = lambda x: 4.2 - 3.6 * ((x - x_in) / (x_out - x_in)) ** 1.3  # noqa: E731
    for sgn in (-1, 1):
        for k in range(n):
            xa, xb = xs[k], xs[k + 1]
            ring = lambda x: [(yc(x) + v, zc(x) + u) for u, v in ngon(0, 0, rc(x), 8, math.pi / 8)]  # noqa: E731
            if sgn > 0:
                g.prism("x", ring(xa), FXC + xa, FXC + xb, C("bone", 6), top=ring(xb))
            else:
                g.prism("x", ring(xb), FXC - xb, FXC - xa, C("bone", 6), top=ring(xa))
            m = last(g)
            if k == 0:
                P.flat(g, m, "bone", 4)  # darker base ring
            if k >= n - 2:
                P.flat(g, m, "darkwood", 3 if k == n - 1 else 4)  # dark tips
    return _front("longhorns", g)


def roo_bar() -> Part:
    """Kangaroo bar: chunky tube frame with hoops over the headlights and a
    pair of spot lights on top."""
    g = Grid(FW, FH, FD)
    z0, z1 = ZB - 6, ZB - 3
    t = []
    t.append(box(g, FXC - 21, FY0 - 2, z0, FXC + 21, FY0 + 1, z1, "iron", 3))  # bottom bar
    for x in (-20, -8, 5, 17):
        t.append(box(g, FXC + x, FY0 - 2, z0, FXC + x + 3, FY0 + 22, z1, "iron", 3))  # uprights
    for xa, xb in ((-20, -5), (5, 20)):
        t.append(box(g, FXC + xa, FY0 + 20, z0, FXC + xb, FY0 + 23, z1, "iron", 3))  # hoop tops
    for x in (-20, 17):  # braces back to the bumper
        bar(g, "x", (FY0 + 20, z0), (FY0 + 2, ZB), 2.0, FXC + x, FXC + x + 3, "iron", 2)
    box(g, FXC - 10, FY0 - 1, ZB - 3, FXC + 10, FY0 + 2, ZB, "iron", 2)  # mounting plate
    m = t[0]
    for b in t[1:]:
        m |= b
    X, Y, Z = coords(g)
    P.flat(g, m & (Z == z0) & ((X + Y) % 9 == 0), "steel", 5)  # chipped paint to bare metal
    for x in (-13, 12):  # spot lights on the hoops
        g.prism("z", [(FXC + x + u, FY0 + 23 + 3 + v) for u, v in ngon(0, 0, 3.2, 10)], z0 - 3, z1, C("iron", 2))
        g.prism("z", [(FXC + x + u, FY0 + 26 + v) for u, v in ngon(0, 0, 2.3, 10)], z0 - 4, z0 - 3, C("gold", 7))
        box(g, FXC + x - 1, FY0 + 23, z0, FXC + x + 1, FY0 + 24, z1, "iron", 3)
    _rust(g, 63, 10)
    return _front("roo-bar", g)


def dozer_blade() -> Part:
    """Curved plough blade with hazard stripes along the top edge."""
    g = Grid(FW, FH, FD)
    front, back = [], []
    for k in range(9):
        tt = -1 + 2 * k / 8
        y = FY0 + 2 + 13 * tt
        z = ZB - 9 - 5 * tt * tt  # concave face: edges forward of the middle
        front.append((y, z))
        back.append((y, z + 2.5))
    g.prism("x", front + list(reversed(back)), FXC - 23, FXC + 23, C("gold", 4))
    blade = last(g)
    X, Y, Z = coords(g)
    from pnpaint import hazard as hz

    hz(g, blade & (Y >= FY0 + 11), period=6, a=("gold", 5), b=("iron", 2))
    P.flat(g, blade & (Y < FY0 - 9), "steel", 3)  # cutting edge
    for x in (-14, 11):  # push arms
        box(g, FXC + x, FY0 - 1, ZB - 9, FXC + x + 3, FY0 + 3, ZB, "steel", 3)
    _rust(g, 64, 16)
    return _front("dozer-blade", g)


def spike_ram() -> Part:
    """Riveted ram plate studded with faceted spikes."""
    g = Grid(FW, FH, FD)
    plate = box(g, FXC - 19, FY0 - 7, ZB - 4, FXC + 19, FY0 + 10, ZB, "rust", 4)
    P.plates(g, plate, "rust", 4, size=(9, 6), seed=5)
    for x in (-13, 0, 13):
        for y in (-2, 6):
            cx, cy = FXC + x + (3 if y > 0 else 0), FY0 + y
            g.prism("z", [(cx + u, cy + v) for u, v in ngon(0, 0, 0.4, 8)], ZB - 15, ZB - 4, C("steel", 6),
                    top=[(cx + u, cy + v) for u, v in ngon(0, 0, 2.8, 8)])
    return _front("spike-ram", g)


def winch_bumper() -> Part:
    """Chunky steel bumper with a winch drum, a hook and two light pods."""
    g = Grid(FW, FH, FD)
    bm = box(g, FXC - 22, FY0 - 6, ZB - 7, FXC + 22, FY0 + 4, ZB, "steel", 2)
    P.plates(g, bm, "steel", 2, size=(11, 5), seed=6)
    g.prism("x", [(FY0 - 1 + v, ZB - 9 + u) for u, v in ngon(0, 0, 3.4, 10)], FXC - 7, FXC + 7, C("iron", 3))  # drum
    X, Y, Z = coords(g)
    P.flat(g, last(g) & (X % 2 == 0), "steel", 5)  # cable wraps
    box(g, FXC - 1, FY0 - 9, ZB - 12, FXC + 1, FY0 - 2, ZB - 10, "steel", 5)  # cable
    box(g, FXC - 2, FY0 - 11, ZB - 13, FXC + 2, FY0 - 8, ZB - 9, "red", 5)  # hook
    for x in (-19, 15):
        box(g, FXC + x, FY0 - 8, ZB - 9, FXC + x + 4, FY0 - 5, ZB - 7, "red", 4)  # shackles
        g.prism("z", [(FXC + x + 2 + u, FY0 + 7 + v) for u, v in ngon(0, 0, 2.6, 10)], ZB - 8, ZB - 4, C("iron", 2))
        g.prism("z", [(FXC + x + 2 + u, FY0 + 7 + v) for u, v in ngon(0, 0, 1.8, 10)], ZB - 9, ZB - 8, C("gold", 7))
        box(g, FXC + x + 1, FY0 + 4, ZB - 6, FXC + x + 3, FY0 + 5, ZB - 4, "iron", 3)
    _rust(g, 66, 12)
    return _front("winch-bumper", g)


# ---------------------------------------------------------------- more roof / hood / stack parts


def _ring(cu, cv, r, n=10, turn=0.0):
    return [(cu + u, cv + v) for u, v in ngon(0, 0, r, n, turn)]


def harpoon() -> Part:
    """Harpoon gun on a swivel turret: barrel forward, a barbed head, a reel
    of rope at the back."""
    g = Grid(AW, AH, AD)
    g.prism("y", _ring(XC, ZC + 6, 6, 10), 0, 3, C("steel", 3))  # turret ring
    box(g, XC - 1.5, 3, ZC + 4.5, XC + 1.5, 10, ZC + 7.5, "steel", 4)  # post
    box(g, XC - 4, 9, ZC - 2, XC + 4, 14, ZC + 12, "khaki", 4)  # gun body
    g.prism("z", _ring(XC, 12, 1.8, 8), ZC - 18, ZC - 2, C("steel", 5))  # barrel
    g.prism("z", _ring(XC, 12, 0.3, 8), ZC - 26, ZC - 18, C("steel", 6), top=_ring(XC, 12, 2.8, 8))  # head
    for sx in (-1, 1):  # barbs
        bar(g, "z", (XC + sx * 1, 12), (XC + sx * 4.5, 15.5), 1.2, ZC - 20, ZC - 17, "steel", 6)
    g.prism("x", [(12 + v, ZC + 14 + u) for u, v in ngon(0, 0, 4.5, 10)], XC - 4, XC + 4, C("wood", 5))  # rope reel
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (np.abs(X - XC) < 4) & (Z > ZC + 9) & ((Y + Z) % 2 == 0), "wood", 3)
    _rust(g, 72, 8)
    return _part("roof-harpoon", g)


def searchlights() -> Part:
    """Two big searchlights on a bar, glass faces forward."""
    g = Grid(AW, AH, AD)
    for x in (XC - 14, XC + 12):
        box(g, x, 0, ZC - 1, x + 2, 7, ZC + 1, "iron", 3)
    box(g, XC - 16, 6, ZC - 2, XC + 16, 8, ZC + 2, "iron", 3)
    for x in (XC - 8, XC + 8):
        g.prism("z", _ring(x, 14, 5.2, 12), ZC - 5, ZC + 3, C("red", 4))  # housing
        g.prism("z", _ring(x, 14, 4.2, 12), ZC - 6, ZC - 5, C("gold", 7))  # glass
        box(g, x - 1, 8, ZC - 1, x + 1, 10, ZC + 1, "iron", 3)
    return _part("roof-searchlights", g)


def tyre_stack() -> Part:
    """Two spare tyres lying flat, strapped down."""
    g = Grid(AW, AH, AD)
    for k in range(2):
        g.prism("y", _ring(XC, ZC, 12, 14, math.pi / 14), 1 + k * 6, 6 + k * 6, C("iron", 3))
        m = last(g)
        rr = radial(g, "y", XC, ZC)
        P.flat(g, m & (rr < 6.5), "steel", 4)
        P.flat(g, m & (rr < 6.5) & (rr > 5.3), "steel", 2)
        P.flat(g, m & (rr > 11), "iron", 2)
    box(g, XC - 13, 0, ZC - 1.5, XC + 13, 14, ZC + 1.5, "orange", 4)  # strap
    box(g, XC - 12, 0, ZC - 12, XC + 12, 1, ZC + 12, "steel", 3)  # base plate
    return _part("roof-tyre-stack", g)


def dish() -> Part:
    """Scrap satellite dish on a post, tipped toward the sky."""
    g = Grid(AW, AH, AD)
    g.prism("y", _ring(XC, ZC, 2.5, 12), 1, 9, C("bone", 6), top=_ring(XC, ZC, 13, 12))
    m = last(g)
    rr = radial(g, "y", XC, ZC)
    P.flat(g, m & ((rr.astype(int)) % 4 == 0), "bone", 4)  # panel rings
    box(g, XC - 0.8, 6, ZC - 0.8, XC + 0.8, 22, ZC + 0.8, "steel", 5)  # feed horn
    root = Part("roof-dish", None, pivot=(XC, 0, ZC))
    root.add(Part("roof-dish-mesh", g, pivot=(XC, 0, ZC), at=(0, 9, 0), rot=(30.0, 0.0, 0.0)))
    post = Grid(AW, AH, AD)
    box(post, XC - 1.5, 0, ZC - 1.5, XC + 1.5, 10, ZC + 1.5, "steel", 3)
    box(post, XC - 4, 0, ZC - 4, XC + 4, 1.5, ZC + 4, "steel", 2)
    root.add(Part("roof-dish-post", post, pivot=(XC, 0, ZC), at=(0, 0, 0)))
    return root


def surfboard() -> Part:
    """A beat-up surfboard on two rack bars."""
    g = Grid(AW, AH, AD)
    for z in (ZC - 12, ZC + 12):
        box(g, XC - 12, 0, z - 1, XC + 12, 4, z + 1, "steel", 3)
    half, w = 26, 7
    pts = [(XC + w * math.sin(math.pi * k / 16), ZC - half * math.cos(math.pi * k / 16)) for k in range(17)]
    pts += [(XC - w * math.sin(math.pi * k / 16), ZC + half * math.cos(math.pi * k / 16)) for k in range(17)]
    g.prism("y", pts, 4, 6, C("teal", 5))
    m = last(g)
    X, Y, Z = coords(g)
    P.flat(g, m & (np.abs(X - XC) < 1.5), "bone", 6)  # stripe
    P.flat(g, m & (Z > ZC + 20), "teal", 3)
    _rust(g, 75, 4)
    return _part("roof-surfboard", g)


def scoop() -> Part:
    """Shaker hood scoop with a dark intake mouth."""
    g = Grid(AW, AH, AD)
    g.prism("x", [(0, ZC - 9), (6, ZC - 8), (8, ZC + 4), (7, ZC + 9), (0, ZC + 10)], XC - 7, XC + 7, C("red", 4))
    X, Y, Z = coords(g)
    P.flat(g, (g.a > 0) & (Z <= ZC - 8) & (Y >= 2) & (Y < 6) & (np.abs(X - XC + 0.5) < 5.5), "iron", 1)
    P.flat(g, (g.a > 0) & (Y >= 7), "red", 5)
    return _part("hood-scoop", g)


def velocity_stacks() -> Part:
    """An open engine top: eight flared chrome intake trumpets."""
    g = Grid(AW, AH, AD)
    box(g, XC - 8, 0, ZC - 9, XC + 8, 4, ZC + 9, "steel", 3)
    for x in (XC - 4, XC + 4):
        for z in (ZC - 6, ZC - 2, ZC + 2, ZC + 6):
            g.prism("y", _ring(x, z, 1.4, 8), 4, 9, C("steel", 6), top=_ring(x, z, 1.9, 8))
            P.flat(g, last(g) & (coords(g)[1] == 8) & (radial(g, "y", x, z) < 1.0), "iron", 1)
    return _part("hood-velocity-stacks", g)


def turbo() -> Part:
    """A big snail turbo with a glowing-hot housing and an outlet pipe."""
    g = Grid(AW, AH, AD)
    box(g, XC - 5, 0, ZC - 5, XC + 5, 3, ZC + 5, "steel", 3)
    g.prism("x", [(10 + v, ZC + u) for u, v in ngon(0, 0, 7, 12)], XC - 4, XC + 4, C("steel", 5))  # housing
    P.flat(g, last(g) & (radial(g, "x", 10, ZC) > 5.5), "orange", 4)  # heat-blued rim
    g.prism("x", [(10 + v, ZC + u) for u, v in ngon(0, 0, 3, 10)], XC + 4, XC + 7, C("iron", 2))  # intake
    box(g, XC - 2, 14, ZC - 12, XC + 2, 18, ZC, "steel", 4)  # outlet
    return _part("hood-turbo", g)


def zoomies() -> Part:
    """Two chrome zoomie pipes swept up and back."""
    g = Grid(AW, AH, AD)
    for dx, h, back in ((-2, 26, 14), (2, 20, 10)):
        g.prism("y", _ring(XC + dx, ZC, 1.8, 8), 0, h, C("steel", 6), top=_ring(XC + dx, ZC + back, 1.8, 8))
        P.flat(g, last(g) & (coords(g)[1] >= h - 3), "iron", 2)
    return _part("zoomies", g)


def flame_stack() -> Part:
    """A short stack belching a frozen lick of flame."""
    g = Grid(AW, AH, AD)
    g.prism("y", _ring(XC, ZC, 2.4, 8), 0, 24, C("steel", 5))
    P.flat(g, last(g) & (coords(g)[1] >= 20), "iron", 1)
    for k, (dx, h, c) in enumerate(((0, 14, ("orange", 6)), (-1.5, 9, ("red", 5)), (1.5, 10, ("gold", 7)))):
        g.prism("y", _ring(XC + dx, ZC, 2.0 - k * 0.3, 6), 24, 24 + h, C(*c), top=_ring(XC + dx * 1.6, ZC + 2, 0.3, 6))
    return _part("flame-stack", g)


# ---------------------------------------------------------------- more bumpers


def tusks() -> Part:
    """Two mammoth tusks curving forward and up off a riveted plate."""
    g = Grid(FW, FH, FD)
    plate = box(g, FXC - 12, FY0 - 4, ZB - 3, FXC + 12, FY0 + 5, ZB, "steel", 3)
    P.plates(g, plate, "steel", 3, size=(8, 5), seed=7)
    n, L = 7, 30
    for sx in (-1, 1):
        cx = lambda u: FXC + sx * (8 + 5 * u)  # noqa: E731
        cy = lambda u: FY0 + 1 + 14 * u ** 2  # noqa: E731
        cr = lambda u: 3.6 - 3.0 * u  # noqa: E731
        for k in range(n):
            ua, ub = k / n, (k + 1) / n
            za, zb = ZB - 3 - L * ua, ZB - 3 - L * ub  # zb < za (forward)
            ring = lambda u: [(cx(u) + p, cy(u) + q) for p, q in ngon(0, 0, cr(u), 8, math.pi / 8)]  # noqa: E731
            g.prism("z", ring(ub), zb, za, C("bone", 6), top=ring(ua))
            if k == n - 1:
                P.flat(g, last(g), "bone", 4)
    return _front("tusks", g)


def tyre_bumper() -> Part:
    """A fat tyre bolted on the nose like a tugboat fender."""
    g = Grid(FW, FH, FD)
    g.prism("z", _ring(FXC, FY0 + 2, 12, 14, math.pi / 14), ZB - 10, ZB - 2, C("iron", 3))
    m = last(g)
    rr = radial(g, "z", FXC, FY0 + 2)
    P.flat(g, m & (rr < 6), "steel", 4)
    P.flat(g, m & (rr > 11), "iron", 2)
    for x in (-8, 6):
        box(g, FXC + x, FY0 - 1, ZB - 4, FXC + x + 2, FY0 + 5, ZB, "steel", 5)
    return _front("tyre-bumper", g)


def log_ram() -> Part:
    """A big log slung across the nose on two chains."""
    g = Grid(FW, FH, FD)
    g.prism("x", [(FY0 - 4 + v, ZB - 10 + u) for u, v in ngon(0, 0, 6, 10)], FXC - 25, FXC + 25, C("wood", 4))
    m = last(g)
    X, Y, Z = coords(g)
    P.flat(g, m & ((Y + Z) % 3 == 0), "darkwood", 3)  # bark
    P.flat(g, m & ((X <= FXC - 24) | (X >= FXC + 24)), "wood", 6)  # cut ends
    for x in (-14, 12):
        box(g, FXC + x, FY0 - 4, ZB - 11, FXC + x + 2, FY0 + 2, ZB, "steel", 5)  # chain bracket
        P.flat(g, (g.a > 0) & (X >= FXC + x) & (X < FXC + x + 2) & (Y % 2 == 0) & (Y > FY0 - 4), "steel", 3)
    return _front("log-ram", g)


ACCESSORIES = {
    "roof": {"rack-spare": rack_spare, "rack-cargo": rack_cargo, "jerry-frame": jerry_frame, "cone": cone, "light-bar": light_bar,
             "harpoon": harpoon, "searchlights": searchlights, "tyre-stack": tyre_stack, "dish": dish, "surfboard": surfboard},
    "hood": {"blower": lambda: blower("small"), "blower-giant": lambda: blower("giant"), "scoop": scoop, "velocity-stacks": velocity_stacks, "turbo": turbo},
    "stacks": {"stack": stack, "zoomies": zoomies, "flame-stack": flame_stack},
    "bumper": {"cow-catcher": cow_catcher, "longhorns": longhorns, "roo-bar": roo_bar, "dozer-blade": dozer_blade,
              "spike-ram": spike_ram, "winch-bumper": winch_bumper, "tusks": tusks, "tyre-bumper": tyre_bumper, "log-ram": log_ram},
}
