"""Bridges, a viaduct, a pier and a tunnel portal.

The three bridges are track pieces: same frame and contract as track.py
(origin on connector `a` at track level, running toward -Z, rail top 8), with
routes and connectors in kit.json, so trains run over them like any straight.
Their structure reaches BELOW y = 0, down to abutments or piers, so laid at
track level they span a dip in the ground (a river, a road, a valley).

The pier and the portal are not track: the pier stands under the joint
between two bridges (its origin is that joint, at track level), the portal
goes over a straight (its origin is that straight's connector `a`; the
opening runs toward -Z) and clears the loading gauge with pantographs up.
"""
from __future__ import annotations

import math

import numpy as np

import track as T
from catalog import plain
from pnshapes import bar, last
from railkit import BALLAST_HALF_BASE, GAUGE_HALF, GAUGE_TOP, RAIL_TOP, SLEEPER_TOP, UNIT, C, Grid, P, Part, coords

FOLDER = "bridges-tunnels"


class Frame:
    """A grid covering piece-frame x [x0, x1), y [y0, y1), z [z0, z1) (z1 <= 0),
    with helpers to fill it in piece coordinates."""

    def __init__(self, x0, x1, y0, y1, z0, z1):
        self.x0, self.y0, self.z0 = x0, y0, z0
        self.g = Grid(x1 - x0, y1 - y0, z1 - z0)

    def box(self, x0, y0, z0, x1, y1, z1, ramp, shade=4):
        self.g.box(x0 - self.x0, y0 - self.y0, z0 - self.z0, x1 - self.x0, y1 - self.y0, z1 - self.z0, C(ramp, shade))
        return P.region(self.g, x0 - self.x0, y0 - self.y0, z0 - self.z0, x1 - self.x0, y1 - self.y0, z1 - self.z0) & (self.g.a > 0)

    def yz(self, y, z):
        return (y - self.y0, z - self.z0)

    def xy(self, x, y):
        return (x - self.x0, y - self.y0)

    def coords(self):
        X, Y, Z = coords(self.g)
        return X + self.x0, Y + self.y0, Z + self.z0  # piece coordinates of each voxel's low corner

    def part(self, name: str) -> Part:
        return Part(name, self.g, pivot=(-self.x0, -self.y0, -self.z0))


def _spec(name: str, length: int, extras: dict) -> T.PieceSpec:
    return T.PieceSpec(name, [T.Route("main", "a", "b", [T.Line((0, 0, 0), (0, 0, -length))])],
                       {"a": T.Connector((0, 0, 0), 180), "b": T.Connector((0, 0, -length), 0)}, kind="bridge", extras=extras)


def _abutments(f: Frame, length: int, depth: int, half: int = 30, reach: int = 14) -> np.ndarray:
    """Stone abutments under both ends, from the bottom of the gap up to the deck."""
    m = f.box(-half, -depth, -reach, half, SLEEPER_TOP - 2, 0, "stone", 4)
    m |= f.box(-half, -depth, -length, half, SLEEPER_TOP - 2, -length + reach, "stone", 4)
    P.stone(f.g, m, "stone", 4, block=(8, 4))
    X, Y, Z = f.coords()
    P.flat(f.g, m & (Y >= SLEEPER_TOP - 4), "stone", 6)  # bed stones
    return m


def _deck(f: Frame, length: int, ramp=("steel", 2)) -> None:
    """Two plate girders under the rails, cross girders, walkways and handrails."""
    X, Y, Z = f.coords()
    for x0 in (-18, 12):
        g = f.box(x0, -12, -length + 4, x0 + 6, SLEEPER_TOP - 2, -4, *ramp)
        P.flat(f.g, g & ((Z % 8) == 0), ramp[0], ramp[1] + 1)  # stiffeners
        P.flat(f.g, g & (Y >= SLEEPER_TOP - 3), ramp[0], ramp[1] + 2)  # top flange
    for z in range(-length + 8, -4, 16):
        f.box(-18, 0, z, 18, SLEEPER_TOP - 2, z + 3, *ramp)
    for sx in (-1, 1):
        lo, hi = (20, 28) if sx > 0 else (-28, -20)
        f.box(lo, 0, -length + 4, hi, 2, -4, "steel", 3)  # walkway plates on brackets
        px = 26 if sx > 0 else -28
        for z in range(-length + 6, -4, 16):
            f.box(px, 2, z, px + 2, 14, z + 2, "iron", 3)  # handrail posts
        f.box(px, 12, -length + 6, px + 2, 14, -4, "iron", 4)  # top rail
        f.box(px, 7, -length + 6, px + 2, 8, -4, "iron", 4)  # mid rail


def girder_bridge(name="bridge-girder"):
    """A steel plate-girder bridge 128 long on stone abutments, open deck,
    walkways and handrails both sides."""
    L, depth = 2 * UNIT, 48
    spec = _spec(name, L, {"span": L, "depth": depth})
    root, socks = T.piece_part(spec, ballast=False)
    f = Frame(-32, 32, -depth, 15, -L, 0)
    _abutments(f, L, depth)
    _deck(f, L)
    root.add(f.part("bridge-structure"))
    return root, socks, [], spec.json()


def truss_bridge(name="bridge-truss"):
    """A through-truss bridge 192 long: riveted red-oxide trusses either side
    with top bracing high enough for raised pantographs."""
    L, depth, top = 3 * UNIT, 48, RAIL_TOP + GAUGE_TOP + 24  # top chord clears pantographs
    spec = _spec(name, L, {"span": L, "depth": depth, "clearance": top - 4})
    root, socks = T.piece_part(spec, ballast=False)
    f = Frame(-36, 36, -depth, top + 1, -L, 0)
    _abutments(f, L, depth, half=36)
    _deck(f, L)
    panels = 8
    z_a, z_b = -10, -L + 10
    pz = [z_a + (z_b - z_a) * k / panels for k in range(panels + 1)]
    chord_lo, chord_hi = -6, 2
    for sx in (-1, 1):
        x0, x1 = (30, 34) if sx > 0 else (-34, -30)
        f.box(x0, chord_lo, z_b - 2, x1, chord_hi, z_a + 2, "rust", 3)  # bottom chord
        f.box(x0, top - 4, min(pz[1], pz[-2]) - 2, x1, top, max(pz[1], pz[-2]) + 2, "rust", 3)  # top chord
        for z in pz[1:-1]:  # verticals
            f.box(x0, chord_hi, int(z) - 1, x1, top - 4, int(z) + 2, "rust", 4)
        # inclined end posts and Pratt diagonals (true slopes), set in from the chord faces
        lo, hi = x0 - f.x0 + 0.5, x1 - f.x0 - 0.5
        g = f.g
        bar(g, "x", f.yz(chord_hi - 1, pz[0]), f.yz(top - 2, pz[1]), 4, lo, hi, "rust", 3)
        bar(g, "x", f.yz(chord_hi - 1, pz[-1]), f.yz(top - 2, pz[-2]), 4, lo, hi, "rust", 3)
        mid = panels // 2
        for k in range(1, panels - 1):
            # diagonals lean toward mid-span as they go down
            if k < mid:
                bar(g, "x", f.yz(top - 3, pz[k]), f.yz(chord_hi, pz[k + 1]), 2.5, lo, hi, "rust", 4)
            else:
                bar(g, "x", f.yz(top - 3, pz[k + 1]), f.yz(chord_hi, pz[k]), 2.5, lo, hi, "rust", 4)
    for z in pz[1:-1]:  # top lateral bracing between the trusses
        f.box(-34, top - 4, int(z) - 1, 34, top - 1, int(z) + 2, "rust", 3)
    X, Y, Z = f.coords()
    steel = f.g.a == C("rust", 3)
    P.flat(f.g, steel & ((X + Y + Z) % 5 == 0) & (np.abs(X) >= 30), "rust", 5)  # rivet heads
    root.add(f.part("bridge-structure"))
    return root, socks, [], spec.json()


def viaduct(name="bridge-viaduct-arch"):
    """One 128-long span of a stone arch viaduct: half a pier at each end, so
    spans laid end to end make full piers. Ballasted track on top, parapets."""
    L, depth, spring, crown, r = 2 * UNIT, 96, -60, -8, 52
    spec = _spec(name, L, {"span": L, "depth": depth, "repeat": True})
    root, socks = T.piece_part(spec, ballast=True)
    f = Frame(-30, 30, -depth, 12, -L, 0)
    zc = -L / 2
    arc = [(spring + r * math.sin(math.pi * k / 16), zc + r * math.cos(math.pi * k / 16)) for k in range(17)]
    poly = [(-depth, 0), (-depth, zc + r)] + arc + [(-depth, zc - r), (-depth, -L), (0, -L), (0, 0)]
    f.g.prism("x", [f.yz(y, z) for y, z in poly], 1, 59, C("stone", 4))
    wall = last(f.g)
    par = f.box(-30, 0, -L, -26, 11, 0, "stone", 5) | f.box(26, 0, -L, 30, 11, 0, "stone", 5)
    P.stone(f.g, wall, "stone", 4, block=(8, 4))
    P.stone(f.g, par, "stone", 5, block=(8, 3))
    X, Y, Z = f.coords()
    rr = np.hypot(Y + 0.5 - spring, Z + 0.5 - zc)
    ring = wall & (rr >= r) & (rr < r + 6) & (Y + 0.5 >= spring)
    P.flat(f.g, ring, "stone", 3)  # voussoirs
    ang = np.degrees(np.arctan2(Y + 0.5 - spring, Z + 0.5 - zc))
    P.flat(f.g, ring & ((np.round(ang) % 9) == 0), "stone", 2)
    P.flat(f.g, (wall | par) & ((Y == -2) | (Y == 10)), "stone", 6)  # string course, coping
    P.flat(f.g, wall & (Y < spring) & ((Z == -13) | (Z == -116)), "stone", 6)  # pier faces' quoins
    root.add(f.part("viaduct-masonry"))
    return root, socks, [], spec.json()


def pier(name="bridge-pier"):
    """A tapered stone pier with a cap, to stand under the joint between two
    bridges. Origin: the joint at track level; the cap top meets the girders."""
    top, depth = -12, 110
    f = Frame(-34, 34, -depth, top, -14, 14)
    rect = lambda hx, hz: [(-hx - f.x0, -hz - f.z0), (hx - f.x0, -hz - f.z0), (hx - f.x0, hz - f.z0), (-hx - f.x0, hz - f.z0)]  # noqa: E731
    f.g.prism("y", rect(26, 10), 6, depth + top - 6, C("stone", 4), top=rect(22, 7))  # battered shaft
    shaft = last(f.g)
    P.stone(f.g, shaft, "stone", 4, block=(8, 4))
    cap = f.box(-30, top - 6, -12, 30, top, 12, "stone", 6)
    f.box(-32, -depth, -14, 32, -depth + 6, 14, "stone", 3)  # footing
    P.flat(f.g, cap & (coords(f.g)[1] == f.g.shape[1] - 1), "stone", 5)
    root = f.part(name)
    return root, [], [], {"kind": "pier", "frame": "track joint", "top": top, "depth": depth}


def tunnel_portal(name="tunnel-portal", tracks=1):
    """A stone tunnel mouth over a straight: a horseshoe opening that clears
    the loading gauge with pantographs raised, voussoirs, a keystone and a dark
    lined bore running back into the hill. tracks=2 is one wide arch over a
    double track (centres one track unit apart, the origin midway between), so
    side-by-side lines share a mouth instead of two portals overlapping."""
    if tracks == 2:
        # the arch must clear the gauge corner of each track: x = UNIT/2 + GAUGE_HALF at gauge height
        half, spring, W, H, deep = UNIT, 52, 92, 136, 48
        corner = UNIT // 2 + GAUGE_HALF
        assert spring + math.sqrt(half * half - corner * corner) >= RAIL_TOP + GAUGE_TOP, "double portal arch fouls the gauge"
    else:
        half, spring, W, H, deep = 32, 68, 60, 124, 48
    f = Frame(-W, W, 0, H, -16 - deep, 0)
    arch = lambda rad: [(rad * math.cos(math.pi * k / 16), spring + rad * math.sin(math.pi * k / 16)) for k in range(17)]  # noqa: E731
    inner = [(-half, 0)] + arch(half)[::-1] + [(half, 0)]
    face = [(-W, 0)] + inner + [(W, 0), (W, H), (-W, H)]
    f.g.prism("z", [f.xy(x, y) for x, y in face], deep, deep + 16, C("stone", 4))
    wall = last(f.g)
    outer = [(-half - 4, 0)] + arch(half + 4)[::-1] + [(half + 4, 0)]
    lining = outer + inner[::-1]
    f.g.prism("z", [f.xy(x, y) for x, y in lining], 0, deep, C("iron", 2))
    bore = last(f.g)
    P.stone(f.g, wall, "stone", 4, block=(10, 5))
    X, Y, Z = f.coords()
    rr = np.hypot(X + 0.5, Y + 0.5 - spring)
    ring = wall & (rr >= half) & (rr < half + 8) & (Y + 0.5 >= spring)
    P.flat(f.g, ring, "stone", 6)
    ang = np.degrees(np.arctan2(Y + 0.5 - spring, X + 0.5))
    P.flat(f.g, ring & ((np.round(ang) % 12) == 0), "stone", 3)
    P.flat(f.g, ring & (np.abs(X + 0.5) < 3.5), "stone", 7)  # keystone
    P.flat(f.g, wall & (Y >= H - 6), "stone", 6)  # coping
    P.flat(f.g, wall & (Y >= H - 7) & (Y < H - 6), "stone", 2)
    P.flat(f.g, bore & ((Z % 12) == 0), "iron", 3)  # lining rings
    root = f.part(name)
    data = {"kind": "portal", "frame": "track", "opening": {"halfWidth": half, "height": spring + half}, "bore": deep + 16,
            "clearsGauge": [GAUGE_HALF, RAIL_TOP + GAUGE_TOP]}
    if tracks == 2:
        data.update(tracks=2, trackOffsets=[-UNIT // 2, UNIT // 2])
    return root, [], [], data


def tunnel_portal_double(name="tunnel-portal-double"):
    return tunnel_portal(name, tracks=2)


CATALOG = [
    plain(FOLDER, girder_bridge, "terrain-nature", "terrain", "civil"),
    plain(FOLDER, truss_bridge, "terrain-nature", "terrain", "civil"),
    plain(FOLDER, viaduct, "terrain-nature", "terrain", "civil"),
    plain(FOLDER, pier, "terrain-nature", "terrain", "civil"),
    plain(FOLDER, tunnel_portal, "terrain-nature", "terrain", "civil"),
    plain(FOLDER, tunnel_portal_double, "terrain-nature", "terrain", "civil"),
]
