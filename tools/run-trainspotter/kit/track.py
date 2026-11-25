"""Track pieces: exact route paths, connectors, and the voxel geometry swept
along them.

Every piece is described twice from one source: as path segments (lines,
arcs and graded polylines, in the piece frame, at ground level) that a game can run trains along,
and as prisms swept along those paths (ballast, sleepers, rails) that the
pipeline meshes and paints. Geometry and data cannot disagree.

Frame (see railkit): origin on connector `a`, at ground level; the track
leaves `a` toward -Z. Headings are degrees about +Y with 0 = -Z and
270 = +X. "Right" means +X when you look along -Z from `a`.

Pure Python + numpy; no Blender import.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from railkit import (BALLAST_HALF_BASE, BALLAST_HALF_TOP, BALLAST_TOP, LATTICE, RAIL_HALF, RAIL_TOP, RAIL_X, SLEEPER_DEPTH, SLEEPER_HALF,
                     SLEEPER_PITCH, SLEEPER_TOP, UNIT, C, Clip, Grid, P, Part, Socket, coords, snap)
from pnshapes import flat_ngon, last


# ---------------------------------------------------------------- path segments
def heading_of(tx: float, tz: float) -> float:
    """Heading (degrees, 0 = -Z, 270 = +X) of a direction in x/z."""
    return math.degrees(math.atan2(-tx, -tz)) % 360


def direction(yaw: float) -> tuple[float, float]:
    r = math.radians(yaw)
    return (-math.sin(r), -math.cos(r))


@dataclass
class Line:
    p0: tuple[float, float, float]
    p1: tuple[float, float, float]

    @property
    def length(self) -> float:
        return math.dist(self.p0, self.p1)

    def point(self, s: float):
        f = s / self.length
        return tuple(a + (b - a) * f for a, b in zip(self.p0, self.p1))

    def tangent(self, s: float):
        d = [b - a for a, b in zip(self.p0, self.p1)]
        n = math.sqrt(sum(c * c for c in d))
        return tuple(c / n for c in d)

    def facets(self) -> int:
        return 1

    def mirrored(self) -> "Line":
        return Line((-self.p0[0], self.p0[1], self.p0[2]), (-self.p1[0], self.p1[1], self.p1[2]))

    def json(self) -> dict:
        return {"t": "line", "p0": list(self.p0), "p1": list(self.p1)}


@dataclass
class Arc:
    """Points c + r (cos a, sin a) in (x, z), a from a0 to a1 (degrees), at height y."""

    cx: float
    cz: float
    r: float
    a0: float
    a1: float
    y: float = 0.0

    @property
    def length(self) -> float:
        return self.r * math.radians(abs(self.a1 - self.a0))

    def _a(self, s: float) -> float:
        return math.radians(self.a0 + (self.a1 - self.a0) * s / self.length)

    def point(self, s: float):
        a = self._a(s)
        return (self.cx + self.r * math.cos(a), self.y, self.cz + self.r * math.sin(a))

    def tangent(self, s: float):
        a, sign = self._a(s), (1 if self.a1 > self.a0 else -1)
        return (-math.sin(a) * sign, 0.0, math.cos(a) * sign)

    def facets(self) -> int:
        step = 7.5 if self.r <= 192 else 5.625  # 12 or 16 facets per quarter turn
        return max(2, math.ceil(abs(self.a1 - self.a0) / step - 1e-9))

    def mirrored(self) -> "Arc":
        return Arc(-self.cx, self.cz, self.r, 180 - self.a0, 180 - self.a1, self.y)

    def json(self) -> dict:
        return {"t": "arc", "c": [self.cx, self.cz], "r": self.r, "a0": self.a0, "a1": self.a1, "y": self.y}


@dataclass
class Poly:
    """A polyline of 3D points (graded track: ramps). Straight between
    vertices; the vertices are exact and the geometry is swept through them."""

    pts: list[tuple[float, float, float]]

    def _chunks(self) -> list[float]:
        return [math.dist(a, b) for a, b in zip(self.pts, self.pts[1:])]

    @property
    def length(self) -> float:
        return sum(self._chunks())

    def _find(self, s: float):
        chunks = self._chunks()
        for k, L in enumerate(chunks):
            if s <= L + 1e-9 or k == len(chunks) - 1:
                return k, (min(max(s / L, 0.0), 1.0) if L else 0.0)
            s -= L
        return len(chunks) - 1, 1.0

    def point(self, s: float):
        k, f = self._find(s)
        a, b = self.pts[k], self.pts[k + 1]
        return tuple(x + (y - x) * f for x, y in zip(a, b))

    def tangent(self, s: float):
        k, _ = self._find(s)
        a, b = self.pts[k], self.pts[k + 1]
        d = [y - x for x, y in zip(a, b)]
        n = math.sqrt(sum(c * c for c in d))
        return tuple(c / n for c in d)

    def facets(self) -> int:
        return len(self.pts) - 1

    def vertices(self) -> list[tuple[tuple, tuple]]:
        """(point, tangent) at every vertex; an inner vertex's tangent bisects its two chunks."""
        out = []
        for k, p in enumerate(self.pts):
            ds = []
            for a, b in ((k - 1, k), (k, k + 1)):
                if a >= 0 and b < len(self.pts):
                    d = [y - x for x, y in zip(self.pts[a], self.pts[b])]
                    n = math.sqrt(sum(c * c for c in d))
                    ds.append([c / n for c in d])
            t = [sum(c) / len(ds) for c in zip(*ds)]
            n = math.sqrt(sum(c * c for c in t))
            out.append((tuple(p), tuple(c / n for c in t)))
        return out

    def mirrored(self) -> "Poly":
        return Poly([(-x, y, z) for x, y, z in self.pts])

    def json(self) -> dict:
        return {"t": "poly", "pts": [[round(c, 6) for c in p] for p in self.pts]}


@dataclass
class Route:
    id: str
    frm: str
    to: str | None
    segs: list
    state: str | None = None  # switch routes: the clip/state that selects them

    @property
    def length(self) -> float:
        return sum(s.length for s in self.segs)

    def locate(self, s: float):
        for seg in self.segs:
            if s <= seg.length + 1e-9:
                return seg, max(0.0, s)
            s -= seg.length
        return self.segs[-1], self.segs[-1].length

    def point(self, s: float):
        seg, u = self.locate(s)
        return seg.point(u)

    def tangent(self, s: float):
        seg, u = self.locate(s)
        return seg.tangent(u)

    def samples(self) -> list[tuple[tuple, tuple]]:
        """(point, tangent) at every facet corner, ends included, exact on arcs."""
        out = []
        for seg in self.segs:
            if isinstance(seg, Poly):
                pts = seg.vertices()
            else:
                n = seg.facets()
                pts = [(seg.point(seg.length * k / n), seg.tangent(seg.length * k / n)) for k in range(n + 1)]
            out += pts[1:] if out else pts
        return out

    def mirrored(self) -> "Route":
        return Route(self.id, self.frm, self.to, [s.mirrored() for s in self.segs], self.state)

    def json(self) -> dict:
        d = {"id": self.id, "from": self.frm, "to": self.to, "length": round(self.length, 6), "segs": [s.json() for s in self.segs]}
        if self.state:
            d["state"] = self.state
        return d


@dataclass
class Connector:
    p: tuple[float, float, float]
    yaw: float

    def json(self) -> dict:
        return {"p": [round(c, 6) for c in self.p], "yaw": round(self.yaw % 360, 6)}


@dataclass
class PieceSpec:
    name: str
    routes: list[Route]
    connectors: dict[str, Connector]
    kind: str = "track"
    extras: dict = field(default_factory=dict)
    long_timbers: bool = False  # switches: shared timbers where the routes are close

    def mirrored(self, name: str) -> "PieceSpec":
        cons = {k: Connector((-c.p[0], c.p[1], c.p[2]), (-c.yaw) % 360) for k, c in self.connectors.items()}
        extras = dict(self.extras)
        if "hand" in extras:
            extras["hand"] = {"right": "left", "left": "right"}[extras["hand"]]
        return PieceSpec(name, [r.mirrored() for r in self.routes], cons, self.kind, extras, self.long_timbers)

    def json(self) -> dict:
        return {"kind": self.kind, "railTop": RAIL_TOP, "connectors": {k: c.json() for k, c in self.connectors.items()},
                "routes": [r.json() for r in self.routes], **self.extras}


# ---------------------------------------------------------------- the pieces
SHIFT_R = 272.0  # two arcs of this radius move a track sideways by UNIT over 4 UNIT
SHIFT_DEG = math.degrees(2 * math.atan(UNIT / (4 * UNIT)))  # 28.07...


def straight(length: int) -> PieceSpec:
    return PieceSpec(f"track-straight-{length}", [Route("main", "a", "b", [Line((0, 0, 0), (0, 0, -length))])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, -length), 0)})


def curve(radius: int, degrees: int = 90) -> PieceSpec:
    """A curve turning right (toward +X); run it from `b` to turn left."""
    arc = Arc(radius, 0, radius, 180, 180 + degrees)
    end = arc.point(arc.length)
    return PieceSpec(f"track-curve-{degrees}-r{radius}", [Route("main", "a", "b", [arc])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((snap(end[0]), 0, snap(end[2])), (360 - degrees) % 360)})


def _shift_segs() -> list:
    """S-bend from (0, 0, 0) heading -Z to (UNIT, 0, -4 UNIT) heading -Z."""
    t = SHIFT_DEG
    first = Arc(SHIFT_R, 0, SHIFT_R, 180, 180 + t)
    p = first.point(first.length)
    cx, cz = p[0] - SHIFT_R * math.cos(math.radians(t)), p[2] - SHIFT_R * math.sin(math.radians(t))
    return [first, Arc(cx, cz, SHIFT_R, t, 0)]


def shift() -> PieceSpec:
    return PieceSpec("track-shift-right", [Route("main", "a", "b", _shift_segs())],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((UNIT, 0, -4 * UNIT), 0)})


def switch() -> PieceSpec:
    """Points: the straight route (`close`) and a diverging route (`open`) that
    ends one track spacing (UNIT) to the right, both 4 UNIT long."""
    through = Route("through", "a", "b", [Line((0, 0, 0), (0, 0, -4 * UNIT))], state="close")
    diverge = Route("diverge", "a", "c", _shift_segs(), state="open")
    return PieceSpec("track-switch-right", [through, diverge],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, -4 * UNIT), 0), "c": Connector((UNIT, 0, -4 * UNIT), 0)},
                     kind="switch", extras={"hand": "right", "blades": "switch-blades", "lever": "switch-lever"}, long_timbers=True)


def buffer_stop() -> PieceSpec:
    return PieceSpec("track-buffer-stop", [Route("main", "a", None, [Line((0, 0, 0), (0, 0, -LATTICE))])],
                     {"a": Connector((0, 0, 0), 180)}, kind="track", extras={"stopAt": LATTICE - 10})


# The 45-degree system. A curve-45 is a short lead straight then an arc, so it
# ends on the 32 lattice: 64 across and 192 along, heading 315. The diagonal
# straight, laid on a diagonal, spans one track spacing each way (64 x 64).
# Right-hand curve-45s and left-hand ones run backwards, alternating, close a
# circle of 8.
C45_R = UNIT / (1 - math.cos(math.radians(45)))  # 218.51
C45_LEAD = 3 * UNIT - C45_R * math.sin(math.radians(45))  # 37.49
DIAGONAL = UNIT * math.sqrt(2)  # 90.51


def curve45() -> PieceSpec:
    """A 45-degree bend to the right, from the grid onto the diagonal."""
    lead = Line((0, 0, 0), (0, 0, -C45_LEAD))
    arc = Arc(C45_R, -C45_LEAD, C45_R, 180, 225)
    return PieceSpec("track-curve-45-right", [Route("main", "a", "b", [lead, arc])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((UNIT, 0, -3 * UNIT), 315)})


def diagonal() -> PieceSpec:
    """A straight for diagonal runs: laid at 45 degrees it spans one track spacing each way."""
    return PieceSpec("track-straight-diagonal", [Route("main", "a", "b", [Line((0, 0, 0), (0, 0, -DIAGONAL))])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, -DIAGONAL), 0)}, extras={"diagonal": True})


def crossing() -> PieceSpec:
    """A square crossing: two straights 128 long crossing at right angles, both always open."""
    main = Route("main", "a", "b", [Line((0, 0, 0), (0, 0, -2 * UNIT))])
    cross = Route("cross", "c", "d", [Line((-UNIT, 0, -UNIT), (UNIT, 0, -UNIT))])
    return PieceSpec("track-crossing-90", [main, cross],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, -2 * UNIT), 0),
                      "c": Connector((-UNIT, 0, -UNIT), 90), "d": Connector((UNIT, 0, -UNIT), 270)}, kind="crossing")


LEVEL_ROAD = (-8, -56)  # z span of the road over a level crossing (near, far)
ROAD_HALF = 48  # how far the road deck reaches either side of the track centre


def level_crossing() -> PieceSpec:
    """A straight with a road deck across it, flush with the rail top."""
    return PieceSpec("track-level-crossing", [Route("main", "a", "b", [Line((0, 0, 0), (0, 0, -UNIT))])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, -UNIT), 0)}, kind="level-crossing",
                     extras={"road": {"z": list(LEVEL_ROAD), "halfWidth": ROAD_HALF, "top": RAIL_TOP}})


RAMP_RISE, RAMP_RUN, RAMP_STEPS = 32, 4 * UNIT, 16


def ramp() -> PieceSpec:
    """A gradient up RAMP_RISE over RAMP_RUN, easing in and out, on an embankment.
    Its route is a graded polyline; run it from `b` to go down."""
    pts = []
    for k in range(RAMP_STEPS + 1):
        t = k / RAMP_STEPS
        pts.append((0.0, snap(RAMP_RISE * t * t * (3 - 2 * t)), snap(-RAMP_RUN * t)))
    return PieceSpec(f"track-ramp-{RAMP_RISE}", [Route("main", "a", "b", [Poly(pts)])],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, RAMP_RISE, -RAMP_RUN), 0)}, kind="ramp",
                     extras={"rise": RAMP_RISE})


TT_CENTRE, TT_BRIDGE, TT_PIT = (0, 0, -3 * LATTICE), 88, 3 * LATTICE  # centre, bridge half-length, pit radius


def turntable() -> PieceSpec:
    """A turntable: a bridge turning in a pit, lining up a-b (`close`) or c-d (`open`)."""
    cz = TT_CENTRE[2]
    ab = Route("ab", "a", "b", [Line((0, 0, 0), (0, 0, 2 * cz))], state="close")
    cd = Route("cd", "c", "d", [Line((TT_PIT, 0, cz), (-TT_PIT, 0, cz))], state="open")
    return PieceSpec("track-turntable", [ab, cd],
                     {"a": Connector((0, 0, 0), 180), "b": Connector((0, 0, 2 * cz), 0),
                      "c": Connector((TT_PIT, 0, cz), 270), "d": Connector((-TT_PIT, 0, cz), 90)}, kind="turntable",
                     extras={"turntable": {"centre": list(TT_CENTRE), "bridge": "turntable-bridge", "radius": TT_PIT,
                                           "turn": {"close": 0, "open": 90}}})


def pieces(tier: str = "slice") -> list[PieceSpec]:
    out = [straight(UNIT), straight(2 * UNIT), curve(192), switch(), switch().mirrored("track-switch-left"), buffer_stop()]
    if tier != "slice":
        out += [straight(UNIT // 2), straight(4 * UNIT), curve(128), curve(256), shift(), shift().mirrored("track-shift-left"),
                curve45(), curve45().mirrored("track-curve-45-left"), diagonal(), crossing(), level_crossing(), ramp(), turntable()]
    return out


# ---------------------------------------------------------------- geometry
def _right(t) -> np.ndarray:
    """Unit vector to the right of a heading, in (x, z)."""
    return np.array([-t[2], t[0]]) / math.hypot(t[0], t[2])


def _band(samples, d0: float, d1: float) -> list[tuple[float, float]]:
    """Polygon (x, z) between two lateral offsets of a sampled route."""
    a = [np.array([p[0], p[2]]) + _right(t) * d0 for p, t in samples]
    b = [np.array([p[0], p[2]]) + _right(t) * d1 for p, t in samples]
    return [(snap(q[0]), snap(q[1])) for q in a + b[::-1]]


def _rect(p, t, half_across: float, half_along: float, left: float | None = None, right: float | None = None):
    c = np.array([p[0], p[2]])
    r = _right(t)
    f = np.array([t[0], t[2]]) / math.hypot(t[0], t[2])
    lo, hi = (-half_across if left is None else left), (half_across if right is None else right)
    pts = [c + r * lo - f * half_along, c + r * hi - f * half_along, c + r * hi + f * half_along, c + r * lo + f * half_along]
    return [(snap(q[0]), snap(q[1])) for q in pts]


def _sleeper_stations(route: Route) -> list[float]:
    n = int((route.length - SLEEPER_DEPTH) // SLEEPER_PITCH)
    first = (route.length - (n - 1) * SLEEPER_PITCH) / 2 if n > 0 else route.length / 2
    return [first + k * SLEEPER_PITCH for k in range(max(1, n))]


def _lateral_at_z(route: Route, z: float) -> float | None:
    """x of a route at a given z (routes that run steadily toward -Z)."""
    pts = [p for p, _ in route.samples()]
    for p, q in zip(pts, pts[1:]):
        if (p[2] - z) * (q[2] - z) <= 0 and p[2] != q[2]:
            f = (z - p[2]) / (q[2] - p[2])
            return p[0] + (q[0] - p[0]) * f
    return None


def _near_route(route: Route, p, dist: float) -> bool:
    """Is (x, z) of p within `dist` of a straight route's centre line?"""
    a, b = route.point(0), route.point(route.length)
    ax, az, bx, bz = a[0], a[2], b[0], b[2]
    L2 = (bx - ax) ** 2 + (bz - az) ** 2
    f = max(0.0, min(1.0, ((p[0] - ax) * (bx - ax) + (p[2] - az) * (bz - az)) / L2))
    return math.hypot(p[0] - (ax + (bx - ax) * f), p[2] - (az + (bz - az) * f)) < dist


def sleepers(spec: PieceSpec) -> list[list[tuple[float, float]]]:
    """Sleeper footprints. Switches share long timbers while the routes are
    closer than two sleeper lengths, then each route gets its own; on a
    crossing each route drops the sleepers that would sit on the other."""
    gap = 2 * SLEEPER_HALF + 6
    if spec.kind == "crossing":
        out = []
        for r in spec.routes:
            others = [o for o in spec.routes if o is not r]
            for s in _sleeper_stations(r):
                p = r.point(s)
                if not any(_near_route(o, p, SLEEPER_HALF + SLEEPER_DEPTH) for o in others):
                    out.append(_rect(p, r.tangent(s), SLEEPER_HALF, SLEEPER_DEPTH / 2))
        return out
    if not spec.long_timbers:
        return [_rect(r.point(s), r.tangent(s), SLEEPER_HALF, SLEEPER_DEPTH / 2) for r in spec.routes for s in _sleeper_stations(r)]
    through, branch = spec.routes
    out = []
    for s in _sleeper_stations(through):
        p, t = through.point(s), through.tangent(s)
        x = _lateral_at_z(branch, p[2])
        if x is not None and abs(x) < gap:
            out.append(_rect(p, t, SLEEPER_HALF, SLEEPER_DEPTH / 2, min(-SLEEPER_HALF, x - SLEEPER_HALF), max(SLEEPER_HALF, x + SLEEPER_HALF)))
        else:
            out.append(_rect(p, t, SLEEPER_HALF, SLEEPER_DEPTH / 2))
    for s in _sleeper_stations(branch):
        p, t = branch.point(s), branch.tangent(s)
        x = _lateral_at_z(branch, p[2])
        if x is not None and abs(x) >= gap:
            out.append(_rect(p, t, SLEEPER_HALF, SLEEPER_DEPTH / 2))
    return out


def connector_sockets(spec: PieceSpec) -> list[Socket]:
    return [Socket(f"socket-track-{k}", at=c.p, parent=spec.name, rot=(0, c.yaw, 0)) for k, c in spec.connectors.items()]


def piece_part(spec: PieceSpec, ballast: bool = True) -> tuple[Part, list[Socket]]:
    """The piece as one Part whose origin is connector `a`, plus connector
    sockets. ballast=False lays the sleepers on nothing (bridge decks)."""
    bands = []  # (axis-y polygon, lo, hi, colour, top polygon or None, role)
    for r in (spec.routes if ballast else []):
        smp = r.samples()
        bands.append((_band(smp, -BALLAST_HALF_BASE, BALLAST_HALF_BASE), 0, BALLAST_TOP, C("gray", 4), _band(smp, -BALLAST_HALF_TOP, BALLAST_HALF_TOP), "ballast"))
    for poly in sleepers(spec):
        bands.append((poly, BALLAST_TOP, SLEEPER_TOP, C("darkwood", 4), None, "sleeper"))
    for r in spec.routes:
        smp = r.samples()
        for side in (-1, 1):
            x = side * RAIL_X
            bands.append((_band(smp, x - RAIL_HALF, x + RAIL_HALF), SLEEPER_TOP, RAIL_TOP, C("steel", 3), None, "rail"))
    xs = [u for b in bands for u, _ in b[0]]
    zs = [v for b in bands for _, v in b[0]]
    ox, oz = math.ceil(-min(xs)) + 2, math.ceil(-min(zs)) + 2
    g = Grid(int(math.ceil(max(xs))) + ox + 3, RAIL_TOP + 1, int(math.ceil(max(zs))) + oz + 3)
    shift = lambda poly: [(u + ox, v + oz) for u, v in poly]  # noqa: E731
    masks = {"ballast": np.zeros(g.shape, bool), "sleeper": np.zeros(g.shape, bool), "rail": np.zeros(g.shape, bool)}
    for poly, lo, hi, c, top, role in bands:
        before = g.a.copy()
        g.prism("y", shift(poly), lo, hi, c, None if top is None else shift(top))
        masks[role] |= g.a != before
    paint_track(g, masks)
    root = Part(spec.name, g, pivot=(ox, 0, oz))
    return root, connector_sockets(spec)


def paint_track(g: Grid, masks) -> None:
    X, Y, Z = coords(g)
    ballast, sleeper, rail = masks["ballast"], masks["sleeper"], masks["rail"]
    rng = np.random.default_rng(7)
    noise = rng.integers(0, 3, g.shape)
    g.a[ballast] = np.choose(noise[ballast], [C("gray", 3), C("gray", 4), C("gray", 5)])
    g.a[ballast & (Y == 0)] = C("gray", 2)
    g.a[sleeper] = C("darkwood", 4)
    g.a[sleeper & (Y == SLEEPER_TOP - 1)] = C("darkwood", 5)
    g.a[rail] = C("steel", 3)
    g.a[rail & (Y == RAIL_TOP - 1)] = C("steel", 6)


def buffer_stop_part(spec: PieceSpec) -> tuple[Part, list[Socket]]:
    """Buffer stop: the piece's track plus a sleeper-built stop at its far end."""
    root, socks = piece_part(spec)
    g = Grid(52, 24, 14)
    # two stout posts and a striped beam across the rails; buffers face the train (+Z)
    for x0 in (8, 40):
        g.box(x0, 0, 4, x0 + 4, 22, 12, C("darkwood", 4))
    g.box(4, 12, 6, 48, 20, 12, C("red", 4))
    X, Y, Z = coords(g)
    stripes = (Y >= 12) & (Y < 20) & (Z >= 6) & (((X + Y) // 4) % 2 == 0)
    g.a[stripes & (g.a > 0)] = C("bone", 6)
    for bx in (8, 40):  # buffer heads at coupler height above the rail
        g.box(bx - 1, 12, 12, bx + 5, 17, 14, C("steel", 5))
    # local z 14 is the buffer face; it sits `stopAt` from connector a
    stop = Part("buffer-stop", g, pivot=(26, 0, 14), at=(0, BALLAST_TOP, -spec.extras["stopAt"]))
    root.add(stop)
    return root, socks


def _keys(t0: float, t1: float, v0, v1, steps: int = 8):
    out = []
    for k in range(steps + 1):
        f = k / steps
        f = f * f * (3 - 2 * f)
        out.append((t0 + (t1 - t0) * k / steps, tuple(a + (b - a) * f for a, b in zip(v0, v1))))
    return out


BLADE_GAP = 1.0  # each blade's travel either side of its middle position
BLADE_LEN = 44


def switch_part(spec: PieceSpec) -> tuple[Part, list[Socket], list[Clip]]:
    """Points with sliding blades and a ground-frame lever. At rest (`close`,
    the straight route) the blade on the diverging side lies against its stock
    rail; `open` throws both blades across to the other side."""
    root, socks = piece_part(spec)
    side = 1 if spec.extras["hand"] == "right" else -1
    L, gx = BLADE_LEN, 20
    g = Grid(2 * gx, 3, L + 2)
    inner = RAIL_X - RAIL_HALF - BLADE_GAP  # blade outer faces at the middle position
    for sx in (-1, 1):
        face = gx + sx * inner  # the face toward its stock rail
        heel, toe = 1.8, 0.6
        g.prism("y", [(face, 1.0), (face - sx * heel, 1.0), (face - sx * toe, L + 1.0), (face, L + 1.0)], 0, 3, C("steel", 5))
    X, Y, Z = coords(g)
    g.a[(g.a > 0) & (Y == 2)] = C("steel", 6)
    # grid z L+1 is the toe, 2 from connector a; z 1 the heel
    root.add(Part("switch-blades", g, pivot=(gx, 0, L + 1), at=(side * BLADE_GAP, SLEEPER_TOP, -2)))
    # a ground frame beside the line, away from the diverging side, with its lever
    frame = Grid(10, 6, 12)
    frame.box(0, 0, 0, 10, 6, 12, C("darkwood", 4))
    frame.box(0, 5, 0, 10, 6, 12, C("darkwood", 5))
    lever = Grid(2, 18, 2)
    lever.box(0, 0, 0, 2, 15, 2, C("red", 4))
    lever.box(0, 15, 0, 2, 18, 2, C("bone", 6))
    fx = -side * 36
    root.add(Part("switch-frame", frame, pivot=(5, 0, 6), at=(fx, 0, -16)))
    root.add(Part("switch-lever", lever, pivot=(1, 0, 1), at=(fx, 6, -16), rot=(0, 0, side * 25)))
    throw = (-side * 2 * BLADE_GAP, 0, 0)
    pull = (0, 0, -side * 50)
    clips = [
        Clip("open", {"switch-blades": {"loc": _keys(0, 0.6, (0, 0, 0), throw)},
                      "switch-lever": {"rot": _keys(0, 0.6, (0, 0, 0), pull)}}, loop=False, ease=0),
        Clip("close", {"switch-blades": {"loc": _keys(0, 0.6, throw, (0, 0, 0))},
                       "switch-lever": {"rot": _keys(0, 0.6, pull, (0, 0, 0))}}, loop=False, ease=0),
    ]
    return root, socks, clips


def level_crossing_part(spec: PieceSpec) -> tuple[Part, list[Socket]]:
    """A straight with a road deck across it, flush with the rail top, open
    only where the wheels run (the rails and a flangeway inside each)."""
    root, socks = piece_part(spec)
    near, far = spec.extras["road"]["z"]
    depth = near - far
    W = 2 * ROAD_HALF
    g = Grid(W, RAIL_TOP, depth)
    X, Y, Z = coords(g)
    ax = np.abs(X + 0.5 - ROAD_HALF)
    on_bed = ax < BALLAST_HALF_BASE  # over the track bed the deck lies on the sleepers
    gap = (ax > RAIL_X - RAIL_HALF - 2) & (ax < RAIL_X + RAIL_HALF)
    deck = (Y >= np.where(on_bed, SLEEPER_TOP, 0)) & ~gap
    g.where(deck, C("gray", 3))
    topm = deck & (Y == RAIL_TOP - 1)
    P.flat(g, topm & on_bed, "wood", 4)  # timber panels between and beside the rails
    P.flat(g, topm & on_bed & ((Z % 6) == 0), "wood", 2)
    P.flat(g, topm & ~on_bed & ((Z == 2) | (Z == depth - 3)), "sand", 7)  # road edge lines
    root.add(Part("road-deck", g, pivot=(ROAD_HALF, 0, depth), at=(0, 0, near)))
    for sx in (-1, 1):  # the road eases down to the ground beyond the deck
        g2 = Grid(16, RAIL_TOP, depth)
        poly = [(0, 0), (16, 0), (0, RAIL_TOP)] if sx > 0 else [(0, 0), (16, 0), (16, RAIL_TOP)]
        g2.prism("z", poly, 0, depth, C("gray", 3))
        root.add(Part(f"road-ramp-{'r' if sx > 0 else 'l'}", g2, pivot=(0 if sx > 0 else 16, 0, depth), at=(sx * ROAD_HALF, 0, near)))
    return root, socks


def ramp_part(spec: PieceSpec) -> tuple[Part, list[Socket]]:
    """A graded straight on an embankment. Every solid is a prism along x with
    a (y, z) profile, so the slope is exact."""
    route = spec.routes[0]
    smp = [p for p, _ in route.samples()]
    rise = int(math.ceil(max(p[1] for p in smp)))
    run = int(round(-smp[-1][2]))
    oz = 2
    g = Grid(2 * BALLAST_HALF_BASE + 4, rise + RAIL_TOP + 2, run + 2 * oz)
    cx = BALLAST_HALF_BASE + 2
    yz = lambda y, z: (snap(y), snap(z + run + oz))  # noqa: E731  piece (y, z) -> grid (y, z)
    top = [yz(p[1] + BALLAST_TOP, p[2]) for p in smp]
    g.prism("x", [yz(0, 0), yz(0, smp[-1][2])] + top[::-1], cx - BALLAST_HALF_BASE, cx + BALLAST_HALF_BASE, C("moss", 4))
    bank = last(g)
    sl = np.zeros(g.shape, bool)
    dz = SLEEPER_DEPTH / 2
    for s in _sleeper_stations(route):
        p, t = route.point(s), route.tangent(s)
        quad = [yz(p[1] + BALLAST_TOP + t[1] * k * dz, p[2] + t[2] * k * dz) for k in (-1, 1)]
        quad += [yz(p[1] + SLEEPER_TOP + t[1] * k * dz, p[2] + t[2] * k * dz) for k in (1, -1)]
        g.prism("x", quad, cx - SLEEPER_HALF, cx + SLEEPER_HALF, C("darkwood", 4))
        sl |= last(g)
    rails = np.zeros(g.shape, bool)
    for x in (-RAIL_X, RAIL_X):
        prof = [yz(p[1] + SLEEPER_TOP, p[2]) for p in smp] + [yz(p[1] + RAIL_TOP, p[2]) for p in smp][::-1]
        g.prism("x", prof, cx + x - RAIL_HALF, cx + x + RAIL_HALF, C("steel", 3))
        rails |= last(g)
    X, Y, Z = coords(g)
    along = -((Z + 0.5) - (run + oz))  # distance from connector a toward b
    bed = np.interp(along, [-p[2] for p in smp], [p[1] for p in smp])  # track bed height over each column
    under = bank & (Y + 0.5 < bed + BALLAST_TOP - 2)
    rng = np.random.default_rng(5)
    stones = bank & ~under
    g.a[stones] = np.choose(rng.integers(0, 3, g.shape)[stones], [C("gray", 3), C("gray", 4), C("gray", 5)])
    g.a[under] = C("moss", 4)  # a grassy bank
    g.a[under & (rng.random(g.shape) < 0.25)] = C("moss", 3)
    g.a[under & (Y == 0)] = C("moss", 2)
    g.a[sl] = C("darkwood", 4)
    g.a[sl & (Y >= np.floor(bed + SLEEPER_TOP - 1))] = C("darkwood", 5)
    g.a[rails] = C("steel", 3)
    g.a[rails & (Y >= np.floor(bed + RAIL_TOP - 1))] = C("steel", 6)
    return Part(spec.name, g, pivot=(cx, 0, run + oz)), connector_sockets(spec)


def turntable_part(spec: PieceSpec) -> tuple[Part, list[Socket], list[Clip]]:
    """A stone-walled pit with a girder bridge that turns on its centre, and
    short rail stubs across the pit wall at each stall connector."""
    tt = spec.extras["turntable"]
    R, B, n = tt["radius"], TT_BRIDGE, 32
    c = R + 2
    g = Grid(2 * c, SLEEPER_TOP, 2 * c)
    g.prism("y", flat_ngon(c, c, R, n), 0, 1, C("stone", 3))  # pit floor
    floor = last(g)
    outer, inner = flat_ngon(c, c, R, n), flat_ngon(c, c, B + 3, n)
    wall = np.zeros(g.shape, bool)
    for k in range(n):  # the pit wall as a ring of segments
        g.prism("y", [outer[k], outer[(k + 1) % n], inner[(k + 1) % n], inner[k]], 1, SLEEPER_TOP, C("stone", 5))
        wall |= last(g)
    X, Y, Z = coords(g)
    rr = np.hypot(X + 0.5 - c, Z + 0.5 - c)
    P.flat(g, floor & (np.abs(rr - (B - 3)) < 1.0), "steel", 4)  # the circular running rail
    P.flat(g, wall & (Y == SLEEPER_TOP - 1), "stone", 6)  # coping
    root = Part(spec.name, g, pivot=(c, 0, c - tt["centre"][2]))
    # rail stubs across the wall top at each stall connector
    span = R - B + 2
    stub = Grid(2 * RAIL_X + 4, 3, span)
    for x in (2, 2 * RAIL_X + 2):
        stub.box(x - 1, 0, 0, x + 1, 3, span, C("steel", 3))
        stub.box(x - 1, 2, 0, x + 1, 3, span, C("steel", 6))
    mid = B + span / 2 - 1
    for name in ("a", "b", "c", "d"):
        yaw = spec.connectors[name].yaw
        dx, dz = -math.sin(math.radians(yaw)), -math.cos(math.radians(yaw))  # outward
        at = (tt["centre"][0] + dx * mid, SLEEPER_TOP, tt["centre"][2] + dz * mid)
        root.add(Part(f"stall-{name}", stub, pivot=(RAIL_X + 2, 0, span / 2), at=at, rot=(0, yaw, 0)))
    # the bridge: two girders, cross timbers and the rails, turning about the centre
    bw = 2 * RAIL_X + 10
    gx = bw // 2
    br = Grid(bw, RAIL_TOP, 2 * B)
    for x0 in (2, bw - 7):
        br.box(x0, 1, 0, x0 + 5, SLEEPER_TOP - 2, 2 * B, C("iron", 3))
    for z in range(2, 2 * B - 2, 8):
        br.box(1, SLEEPER_TOP - 2, z, bw - 1, SLEEPER_TOP, z + 4, C("darkwood", 4))
    for x in (gx - RAIL_X - 1, gx + RAIL_X - 1):
        br.box(x, SLEEPER_TOP, 0, x + 2, RAIL_TOP, 2 * B, C("steel", 3))
        br.box(x, RAIL_TOP - 1, 0, x + 2, RAIL_TOP, 2 * B, C("steel", 6))
    for z0 in (0, 2 * B - 3):  # red end beams
        br.box(0, 1, z0, bw, SLEEPER_TOP - 2, z0 + 3, C("red", 4))
    root.add(Part(tt["bridge"], br, pivot=(gx, 0, B), at=tuple(tt["centre"])))
    from voxgrid import turn

    clips = [Clip("spin", {tt["bridge"]: {"rot": turn(24.0, "y", 15.0)}}, loop=True, ease=0)]
    return root, connector_sockets(spec), clips


def build_piece(spec: PieceSpec) -> tuple[Part, list[Socket], list]:
    """-> (root Part, connector sockets, clips)."""
    if spec.name == "track-buffer-stop":
        return (*buffer_stop_part(spec), [])
    if spec.kind == "switch":
        return switch_part(spec)
    if spec.kind == "level-crossing":
        return (*level_crossing_part(spec), [])
    if spec.kind == "ramp":
        return (*ramp_part(spec), [])
    if spec.kind == "turntable":
        return turntable_part(spec)
    return (*piece_part(spec), [])
