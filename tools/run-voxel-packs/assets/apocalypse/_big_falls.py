"""Frame-baked one-shots (attack, hit, death) for the big apocalypse creatures
(mutant behemoth, raider bot, giant scorpion, mutant vulture, scavenger
drone).

These clips are keyed pose to pose here and baked to one key a frame, so
the timing is exactly what is written: a fall accelerates all the way into
its impact, a hit is shoved back on frame 1, a bounce is a gravity arc.
Clips built this way go out with `Clip(ease=0)` (the exporter's stroke
re-timing would warp the baked timing a second time).

- `track(*keys)`: a smooth curve through keys `(frame, (x, y, z))` or
  `(frame, (x, y, z), tags)`. Between keys it is a cubic Hermite whose
  tangents are monotone (a key where a channel turns round dwells, a key
  in the middle of a stroke is passed through at speed, never a stop).
  Tags on a key: ">" arrives fast (twice the mean speed of the span, as a
  gravity fall or a strike does) and, unless "<" too, stops dead there;
  "<" leaves fast (a launch, a bounce off the floor); "0" stops there.
- `bake(tracks, end)`: {part: {channel: track}} -> clip keys, every frame.
- `ground(...)`: per frame, slide a part (the one that carries the body)
  so the lowest point of the posed rig sits at a given height over the
  floor (0 = touching it), and optionally pin a model point in x/z (a
  heel while the body topples about it). The rig is posed by forward
  kinematics in the exporter's euler order and parent chain, so the
  frames come out on the floor as keyed, not lifted after the fact.
- `react_body` / `react_lag`: hit keys (the blow on frame 0-1, a pop on a
  gravity arc that peaks on f4 and lands on f8, a drifting beat, a
  recovery past rest).
"""
from __future__ import annotations

import math

import numpy as np

from voxgrid import PRISM_PLANE, _AXIS_INDEX, Part

FPS = 30
F = 1.0 / FPS


# ------------------------------------------------------------------ curves
def _tagged(k):
    f, v = k[0], tuple(float(c) for c in k[1])
    tags = k[2] if len(k) > 2 else ""
    return float(f), v, tags


class Track:
    """A per-component cubic Hermite through frame keys (see module doc)."""

    def __init__(self, keys):
        ks = sorted((_tagged(k) for k in keys), key=lambda k: k[0])
        self.f = [k[0] for k in ks]
        self.v = [np.asarray(k[1], dtype=float) for k in ks]
        self.tags = [k[2] for k in ks]
        n = len(ks)
        dim = len(self.v[0])
        slope = [(self.v[i + 1] - self.v[i]) / max(1e-9, self.f[i + 1] - self.f[i]) for i in range(n - 1)]
        tin = [np.zeros(dim) for _ in range(n)]
        tout = [np.zeros(dim) for _ in range(n)]
        for i in range(n):
            if 0 < i < n - 1:
                d0, d1 = slope[i - 1], slope[i]
                m = np.where(d0 * d1 > 0, np.sign(d0) * np.minimum(np.abs(d0 + d1) / 2, 3 * np.minimum(np.abs(d0), np.abs(d1))), 0.0)
                tin[i] = tout[i] = m
            t = self.tags[i]
            if "0" in t:
                tin[i] = tout[i] = np.zeros(dim)
            if ">" in t and i > 0:
                tin[i] = 2 * slope[i - 1]
                if "<" not in t:
                    tout[i] = np.zeros(dim)
            if "<" in t and i < n - 1:
                tout[i] = 2 * slope[i]
                if ">" not in t:
                    tin[i] = tin[i] if 0 < i else np.zeros(dim)
        self.tin, self.tout = tin, tout

    def __call__(self, frame: float) -> np.ndarray:
        f, v = self.f, self.v
        if frame <= f[0]:
            return v[0].copy()
        if frame >= f[-1]:
            return v[-1].copy()
        i = max(j for j in range(len(f) - 1) if f[j] <= frame)
        h = f[i + 1] - f[i]
        u = (frame - f[i]) / h
        h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
        return h00 * v[i] + h10 * h * self.tout[i] + h01 * v[i + 1] + h11 * h * self.tin[i + 1]

    @property
    def end(self) -> float:
        return self.f[-1]


def track(*keys) -> Track:
    return Track(keys)


class Fall:
    """A gravity fall spliced between two tracks: `pre` up to frame f0, then
    from the value and speed `pre` has at f0 it accelerates all the way into
    `a1` at frame f1 (value = a0 + w0 t + c t^power, so it is fastest at
    f1), then `post` from f1 on (its first key should be (f1, a1))."""

    def __init__(self, pre: Track, f0: int, f1: int, a1, post: Track | None = None, power: float = 2.0):
        self.pre, self.f0, self.f1, self.post, self.p = pre, float(f0), float(f1), post, power
        self.a0 = pre(f0)
        self.w0 = pre(f0) - pre(f0 - 1)
        self.a1 = np.asarray(a1, dtype=float)
        T = self.f1 - self.f0
        self.c = (self.a1 - self.a0 - self.w0 * T)

    def __call__(self, frame: float) -> np.ndarray:
        if frame <= self.f0:
            return self.pre(frame)
        if frame >= self.f1:
            return self.post(frame) if self.post is not None else self.a1.copy()
        t = frame - self.f0
        T = self.f1 - self.f0
        return self.a0 + self.w0 * t + self.c * (t / T) ** self.p

    def speed(self, frame: float) -> np.ndarray:
        return self(frame) - self(frame - 1)

    @property
    def end(self) -> float:
        return self.post.end if self.post is not None else self.f1


def bake(tracks: dict, end: int | None = None) -> dict:
    """{part: {channel: Track}} -> {part: {channel: [(seconds, xyz), ...]}},
    one key a frame from 0 to `end` (default: the last key of any track)."""
    last = int(round(end if end is not None else max(t.end for ch in tracks.values() for t in ch.values())))
    out = {}
    for part, chans in tracks.items():
        out[part] = {}
        for ch, tr in chans.items():
            out[part][ch] = [(f * F, tuple(float(c) for c in tr(f))) for f in range(last + 1)]
    return out


def spin(end: int, axis: str, degrees_per_second: float, frames=None):
    """A steady spin keyed every frame (rotor, saw): rot keys."""
    ax = "xyz".index(axis)
    out = []
    for f in range(end + 1):
        a = degrees_per_second * f * F if frames is None else frames(f)
        v = [0.0, 0.0, 0.0]
        v[ax] = a
        out.append((f * F, tuple(v)))
    return out


# ------------------------------------------------------------------ pose
def euler(deg) -> np.ndarray:
    """XYZ euler degrees about glTF axes as a matrix (X first, then Y, then Z)."""
    a, b, c = (math.radians(v) for v in deg)
    rx = np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])
    ry = np.array([[math.cos(b), 0, math.sin(b)], [0, 1, 0], [-math.sin(b), 0, math.cos(b)]])
    rz = np.array([[math.cos(c), -math.sin(c), 0], [math.sin(c), math.cos(c), 0], [0, 0, 1]])
    return rz @ ry @ rx


def hull_points(part: Part) -> np.ndarray:
    """Points that hold the convex hull of a part, in its pivot space."""
    g = part.grid
    if g is None:
        return np.zeros((0, 3))
    occ = (g.a > 0) & ~g.solid_mask()
    pts = []
    cols = occ.any(axis=1)
    if cols.any():
        ny = g.shape[1]
        lo = np.argmax(occ, axis=1)
        hi = ny - np.argmax(occ[:, ::-1, :], axis=1)
        xs, zs = np.nonzero(cols)
        for ys in (lo[xs, zs], hi[xs, zs]):
            for dx in (0, 1):
                for dz in (0, 1):
                    pts.append(np.stack([xs + dx, ys, zs + dz], axis=1).astype(float))
    for s in g.solids:
        t = _AXIS_INDEX[s.axis]
        u, v = PRISM_PLANE[s.axis]
        for poly, along in ((s.poly, s.lo), (s.upper, s.hi)):
            for pu, pv in poly:
                p = [0.0, 0.0, 0.0]
                p[u], p[v], p[t] = pu, pv, along
                pts.append(np.array([p]))
    if not pts:
        return np.zeros((0, 3))
    return np.concatenate(pts) - np.asarray(part.pivot, dtype=float)


def _at(keys, frame):
    """The key at a frame (baked clips have one a frame)."""
    i = min(len(keys) - 1, max(0, int(round(frame))))
    return np.asarray(keys[i][1], dtype=float)


def floor_y(poser) -> float:
    """The real floor in rig coordinates. The exporter stands a model on
    the floor by its rest bounds, rounded to half voxels, so the rest pose
    can sit a fraction above it; contacts are keyed onto the real floor."""
    lo = poser.lowest({}, 0)
    return -round(-lo * 2) / 2


class Poser:
    """Forward kinematics over a rig for baked clip keys."""

    def __init__(self, root: Part):
        self.root = root
        self.cache: dict = {}

    def world(self, keys: dict, frame: int, only=None):
        """{part: (M, o, points)} world transforms (and hull points) at a frame."""
        out = {}

        def visit(p, M, o):
            ch = keys.get(p.name, {})
            loc = np.asarray(p.at, dtype=float) + (_at(ch["loc"], frame) if "loc" in ch else 0.0)
            R = euler(p.rot) @ (euler(_at(ch["rot"], frame)) if "rot" in ch else np.eye(3))
            if "scale" in ch:
                R = R @ np.diag(_at(ch["scale"], frame))
            Mw, ow = M @ R, o + M @ loc
            if p.name not in self.cache:
                self.cache[p.name] = hull_points(p)
            out[p.name] = (Mw, ow, self.cache[p.name])
            for c in p.children:
                visit(c, Mw, ow)

        visit(self.root, np.eye(3), np.zeros(3))
        return out

    def chain_low(self, keys: dict, frame: int, name: str) -> float:
        """The lowest point of one part, posing only its chain of parents."""
        if not hasattr(self, "_paths"):
            self._paths = {}

            def walk(p, path):
                path = path + [p]
                self._paths[p.name] = path
                for c in p.children:
                    walk(c, path)
            walk(self.root, [])
        M, o = np.eye(3), np.zeros(3)
        for p in self._paths[name]:
            ch = keys.get(p.name, {})
            loc = np.asarray(p.at, dtype=float) + (_at(ch["loc"], frame) if "loc" in ch else 0.0)
            R = euler(p.rot) @ (euler(_at(ch["rot"], frame)) if "rot" in ch else np.eye(3))
            if "scale" in ch:
                R = R @ np.diag(_at(ch["scale"], frame))
            M, o = M @ R, o + M @ loc
        if name not in self.cache:
            self.cache[name] = hull_points(next(p for p in self._paths[name] if p.name == name))
        pts = self.cache[name]
        return float((pts @ M.T + o)[:, 1].min()) if len(pts) else math.inf

    def lowest(self, keys: dict, frame: int, skip=()) -> float:
        best = math.inf
        for name, (M, o, pts) in self.world(keys, frame).items():
            if len(pts) and name not in skip:
                best = min(best, float((pts @ M.T + o)[:, 1].min()))
        return best

    def lows(self, keys: dict, frame: int) -> dict:
        return {n: float((pts @ M.T + o)[:, 1].min()) for n, (M, o, pts) in self.world(keys, frame).items() if len(pts)}

    def point(self, keys: dict, frame: int, part: str, local) -> np.ndarray:
        M, o, _ = self.world(keys, frame)[part]
        return M @ np.asarray(local, dtype=float) + o


def joint_of(root: Part, name: str, origin) -> np.ndarray:
    """A part's joint in the shared rig frame (origin + the chain of `at`)."""
    def find(p, acc):
        acc = acc + np.asarray(p.at, dtype=float)
        if p.name == name:
            return acc
        for c in p.children:
            r = find(c, acc)
            if r is not None:
                return r
        return None

    return np.asarray(origin, dtype=float) + find(root, np.zeros(3))


def ground(root: Part, keys: dict, carrier: str, height=None, pin=None, frames=None, skip=()) -> dict:
    """Slide `carrier` (a part whose parent frame is the unrotated world, the
    root or a child of an unanimated root) frame by frame:

    - `pin=(part, local_point, (f0, f1), axes)`: keep that point's world x/z
      (axes "xz", "z", ...) where it is at f0, over frames f0..f1 (a heel
      the body topples about). The slide reached at f1 carries on after it,
      so the body does not jump back when the pin lets go.
    - `height(frame) -> float | None`: the lowest point of the rig is put at
      that height over the floor (0 touches it; the floor is the rest pose's
      lowest point); None leaves the frame's height as keyed. Applied after
      the pin.
    Edits the carrier's "loc" keys in place and returns `keys`."""
    poser = Poser(root)
    floor = floor_y(poser)
    ch = keys.setdefault(carrier, {})
    n = max(len(c) for chans in keys.values() for c in chans.values())
    if "loc" not in ch:
        ch["loc"] = [(f * F, (0.0, 0.0, 0.0)) for f in range(n)]
    loc = [np.asarray(v, dtype=float) for _, v in ch["loc"]]
    while len(loc) < n:
        loc.append(loc[-1].copy())
    rng = range(n) if frames is None else frames
    anchor = None
    carry = np.zeros(3)

    def sync():
        ch["loc"] = [(i * F, tuple(v)) for i, v in enumerate(loc)]

    for f in rng:
        if pin is not None:
            part, local, (f0, f1), axes = pin
            if f0 <= f <= f1:
                sync()
                p = poser.point(keys, f, part, local)
                if anchor is None:
                    anchor = p.copy()
                d = np.zeros(3)
                for ax in axes:
                    a = "xyz".index(ax)
                    d[a] = anchor[a] - p[a]
                loc[f] += d
                carry = d  # the last correction carries on past f1
            elif f > f1:
                loc[f] = loc[f] + carry
        if height is not None:
            h = height(f)
            if h is not None:
                sync()
                loc[f][1] += floor + h - poser.lowest(keys, f, skip=skip)
    ch["loc"] = [(i * F, tuple(float(c) for c in v)) for i, v in enumerate(loc)]
    return keys


def arc(f0: int, f1: int, peak: float):
    """height(frame) for a gravity arc off the floor between f0 and f1."""
    def h(f):
        if f <= f0 or f >= f1:
            return 0.0
        u = (f - f0) / (f1 - f0)
        return 4 * peak * u * (1 - u)
    return h


def floor_report(root: Part, keys: dict, label: str = "") -> str:
    poser = Poser(root)
    n = max(len(c) for chans in keys.values() for c in chans.values())
    return label + " " + " ".join(f"{f}:{poser.lowest(keys, f):.2f}" for f in range(n))


# ------------------------------------------------------------------ hits
def react_body(push: float = 2.5, pop: float = 1.0, lean: float = 10.0, side: float = 0.0, settle: float = 1.0) -> dict:
    """Tracks (frames) for the part that carries the body in a hit: shoved
    back (+Z) from frame 0, most of it by frame 2, easing out by frame 4,
    drifting on through the beat; leaning back with the blow; then a
    recovery forward past rest and a settle. `settle` stretches the
    recovery only (heavy creatures), never the blow. The pop is applied by
    `ground` with `arc(0, 8, pop)` so it lands on f8 exactly."""
    s = settle
    r = lambda k: 8 + (k - 8) * s  # noqa: E731
    loc = track((0, (0, 0, 0), "<"), (1, (side * 0.3, 0, push * 0.5)), (2, (side * 0.5, 0, push * 0.78)), (4, (side * 0.7, 0, push)),
                (8, (side * 0.75, 0, push * 1.08)), (r(12), (side * 0.6, 0, push * 1.12), ""), (r(18), (side * 0.2, 0, push * 0.3)),
                (r(23), (0, 0, -push * 0.1)), (r(29), (0, 0, 0)))
    rot = track((0, (0, 0, 0), "<"), (1, (lean * 0.55, side * lean * 0.3, -side * lean * 0.25)), (3, (lean * 0.95, side * lean * 0.55, -side * lean * 0.4)),
                (6, (lean * 1.1, side * lean * 0.7, -side * lean * 0.45)), (r(11), (lean * 0.75, side * lean * 0.45, -side * lean * 0.25)),
                (r(17), (-lean * 0.3, -side * lean * 0.1, side * lean * 0.1)), (r(22), (lean * 0.08, 0, 0)), (r(28), (0, 0, 0)))
    return {"loc": loc, "rot": rot}


def react_lag(amp=(14.0, 0.0, 0.0), delay: int = 1, settle: float = 1.0) -> Track:
    """A loose part in a hit: it lags at the blow, whips past a beat later,
    swings back and settles last."""
    ax = np.asarray(amp, dtype=float)
    d = delay
    r = lambda k: 8 + (k - 8) * settle  # noqa: E731
    return track((0, (0, 0, 0)), (1 + d, tuple(-ax * 0.35)), (4 + d, tuple(ax)), (r(9 + d), tuple(ax * 0.3)),
                 (r(14 + d), tuple(-ax * 0.4)), (r(19 + d), tuple(ax * 0.15)), (r(26 + d), (0, 0, 0)))


# ------------------------------------------------------------------ contacts
def reach(root: Part, keys: dict, part: str, axis: str, frames, height: float = 0.0, fade_in: int = 3, fade_out: int = 6,
          span: float = 30.0, others=(), channel: str = "rot", by: str | None = None, step: float = 1.0) -> dict:
    """Turn `part` about one rot axis, frame by frame over `frames`, so its
    lowest point sits exactly `height` over the floor (a fist or a sting
    planted on the ground through a contact, no sinking, no hovering). The
    correction fades in over `fade_in` frames before and out over `fade_out`
    frames after, so the motion stays continuous. `others` get the same
    angle correction (a mirrored arm: give (name, sign) pairs). Edits
    `keys` in place and returns it. With `channel="loc"` it slides the part
    instead (voxels); `by` measures another part's lowest point (move the
    body so the fist it carries meets the floor)."""
    poser = Poser(root)
    floor = floor_y(poser)
    rot = keys[part][channel]
    probe = by or part
    a = "xyz".index(axis)
    frames = list(frames)
    delta = {}

    def low_with(f, d):
        v = list(rot[f][1])
        old = rot[f]
        v[a] += d
        rot[f] = (rot[f][0], tuple(v))
        lo = poser.chain_low(keys, f, probe)
        rot[f] = old
        return lo - floor

    prev = 0.0
    for f in frames:
        # scan for the crossing nearest the last frame's correction (the
        # keyed angle on the first frame), then bisect it
        cache = {}

        def val(d):
            if d not in cache:
                cache[d] = low_with(f, d) - height
            return cache[d]

        base = float(np.round(prev / step) * step)
        best = None
        if abs(val(base)) < 1e-6:
            delta[f] = prev = base
            continue
        for i in range(1, int(span / step) + 1):
            for d0, d1 in ((base + (i - 1) * step, base + i * step), (base - (i - 1) * step, base - i * step)):
                if val(d0) * val(d1) <= 0:
                    best = (d0, d1)
                    break
            if best:
                break
        if best is None:
            delta[f] = prev = min(cache, key=lambda d: abs(cache[d]))
            continue
        vals = cache
        lo_a, hi_a = best
        f_lo = vals[lo_a]
        for _ in range(30):
            mid = 0.5 * (lo_a + hi_a)
            fm = low_with(f, mid) - height
            if fm * f_lo > 0:
                lo_a, f_lo = mid, fm
            else:
                hi_a = mid
        delta[f] = prev = 0.5 * (lo_a + hi_a)
    f0, f1 = frames[0], frames[-1]
    for i in range(1, fade_in + 1):
        delta.setdefault(f0 - i, delta[f0] * (1 - i / (fade_in + 1)) ** 2)
    for i in range(1, fade_out + 1):
        u = i / (fade_out + 1)
        delta.setdefault(f1 + i, delta[f1] * (1 - u * u * (3 - 2 * u)))
    for name, sign in ((part, 1),) + tuple(others):
        r = keys[name][channel]
        for f, d in delta.items():
            if 0 <= f < len(r):
                v = list(r[f][1])
                v[a] += sign * d
                r[f] = (r[f][0], tuple(v))
    return keys


def fill(root: Part, keys: dict) -> dict:
    """Key every part of the rig that a baked clip leaves out at rest (a
    zero rot on each frame), so a viewer that does not reset untouched
    nodes between clips never shows another clip's pose on them."""
    n = max(len(c) for chans in keys.values() for c in chans.values())

    def visit(p):
        if p.grid is not None or p.children:
            ch = keys.setdefault(p.name, {})
            if not ch:
                ch["rot"] = [(f * F, (0.0, 0.0, 0.0)) for f in range(n)]
        for c in p.children:
            visit(c)

    visit(root)
    return keys


# ------------------------------------------------------------------ loose parts
def to_euler(M) -> tuple:
    """XYZ euler degrees of a rotation matrix (the inverse of `euler`)."""
    b = math.asin(max(-1.0, min(1.0, -M[2, 0])))
    a = math.atan2(M[2, 1], M[2, 2])
    c = math.atan2(M[1, 0], M[0, 0])
    return tuple(math.degrees(v) for v in (a, b, c))


def axis_angle(axis, deg) -> np.ndarray:
    ax = np.asarray(axis, dtype=float)
    ax = ax / max(1e-9, np.linalg.norm(ax))
    t = math.radians(deg)
    K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
    return np.eye(3) + math.sin(t) * K + (1 - math.cos(t)) * K @ K


def _ortho(M):
    u, _, vt = np.linalg.svd(M)
    return u @ vt


def _parent_of(root: Part, name: str):
    def find(p):
        for c in p.children:
            if c.name == name:
                return p, c
            r = find(c)
            if r:
                return r
        return None
    return find(root)


def place(root: Part, keys: dict, part: str, frame: int, origin, R) -> None:
    """Key a part so that, at `frame`, its joint sits at world `origin`
    with world rotation `R`, whatever its parent is doing (a head knocked
    off a falling body)."""
    poser = Poser(root)
    parent, child = _parent_of(root, part)
    Mp, op, _ = poser.world(keys, frame)[parent.name]
    Minv = np.linalg.inv(Mp)
    loc = Minv @ (np.asarray(origin, dtype=float) - op) - np.asarray(child.at, dtype=float)
    Rl = euler(child.rot).T @ _ortho(Mp).T @ R
    ch = keys.setdefault(part, {})
    for name, val in (("loc", loc), ("rot", to_euler(Rl))):
        k = ch.setdefault(name, [])
        while len(k) <= frame:
            k.append((len(k) * F, (0.0, 0.0, 0.0)))
        k[frame] = (frame * F, tuple(float(c) for c in val))


def part_centre(root: Part, name: str) -> np.ndarray:
    """A part's volume centre (the mean of its filled voxels), from its joint."""
    def find(p):
        if p.name == name:
            return p
        for c in p.children:
            r = find(c)
            if r is not None:
                return r
        return None
    p = find(root)
    occ = np.argwhere(p.grid.a > 0).astype(float) + 0.5
    return occ.mean(0) - np.asarray(p.pivot, dtype=float)


def knock_off(root: Part, keys: dict, part: str, f0: int, end: int, up: float, side, axis, total: float,
              g: float = 0.32, bounce: float = 1.0, roll_to: int | None = None, radius: float = 5.0, centre=None) -> int:
    """Knock a part loose at frame f0 (it leaves with its pose there): it
    flies on a gravity arc (`up` voxels a frame upward, `side` the unit
    horizontal direction it travels), tumbling about the horizontal `axis`
    (perpendicular to `side`, the way it rolls), lands, hops once
    (`bounce` voxels), then rolls on along the floor at the speed it
    landed with, slowing steadily to a stop at `roll_to`: no stop-start.
    Its spin is one steady rate in the air that dies away on the floor,
    and the whole turn is `total` degrees (a multiple of 90 for a box, so
    it comes to rest on a face); the horizontal speed matches the spin
    (rolling, not sliding). Keys every frame from f0 to end. Returns the
    landing frame."""
    poser = Poser(root)
    floor = floor_y(poser)
    M0, o0, pts = poser.world(keys, f0)[part]
    R0 = _ortho(M0)
    # it tumbles about its own middle (the voxel centroid, or `centre`: the
    # middle the eye reads, from its joint), not its joint, so that middle
    # flies at a constant sideways speed
    cl = part_centre(root, part) if centre is None else np.asarray(centre, dtype=float)
    side = np.asarray(side, dtype=float)
    side = side / np.linalg.norm(side)
    axis = np.asarray(axis, dtype=float)
    roll_to = roll_to or end

    def run(w, write):
        pos, vy, ang, landed = o0 + R0 @ cl, up, 0.0, None
        rows = []
        for f in range(f0, end + 1):
            if landed is None:
                R = axis_angle(axis, ang) @ R0
                low = float(((pts - cl) @ R.T + pos)[:, 1].min()) - floor
                if f > f0 and low <= 0:
                    landed = f
                    pos[1] -= low
            if landed is None:
                rows.append((f, pos.copy(), R))
                pos = pos + side * math.radians(w) * radius + np.array([0.0, vy, 0.0])
                vy -= g
                ang += w
                continue
            T = max(1, roll_to - landed)
            u = min(1.0, (f - landed) / T)
            wf = w * (1 - u)
            R = axis_angle(axis, ang) @ R0
            low = float(((pts - cl) @ R.T + pos)[:, 1].min()) - floor
            t = (f - landed) / 4
            hop = 4 * bounce * t * (1 - t) if t < 1 else 0.0
            pos[1] += -low
            rows.append((f, pos + np.array([0.0, hop, 0.0]), R))
            pos = pos + side * math.radians(wf) * radius
            ang += wf
        return rows, landed, ang

    w = 10.0
    for _ in range(4):  # the spin rate that makes the whole turn come out at `total`
        rows, landed, ang = run(w, False)
        if landed is None:
            break
        Tf, T = landed - f0, max(1, roll_to - landed)
        w = total / (Tf + T / 2)
    rows, landed, ang = run(w, True)
    for f, pos, R in rows:
        place(root, keys, part, f, pos - R @ cl, R)
    return landed if landed is not None else end


def plant(root: Part, keys: dict, part: str, local, frames, axis: str = "x", coord: str = "z", at: int | None = None) -> dict:
    """Swing `part` about one rot axis, frame by frame, so a point of it (a
    foot) keeps the world `coord` it has at rest: the leg swings under a
    lunging body instead of the foot sliding. Edits `keys` in place."""
    poser = Poser(root)
    a, c = "xyz".index(axis), "xyz".index(coord)
    target = poser.point({} if at is None else keys, 0 if at is None else at, part, local)[c]
    rot = keys[part]["rot"]
    prev = 0.0
    for f in frames:
        def err(d):
            old = rot[f]
            v = list(old[1])
            v[a] += d
            rot[f] = (old[0], tuple(v))
            e = poser.point(keys, f, part, local)[c] - target
            rot[f] = old
            return e
        lo, hi = prev - 40.0, prev + 40.0
        elo, ehi = err(lo), err(hi)
        if elo * ehi > 0:
            continue
        for _ in range(30):
            mid = 0.5 * (lo + hi)
            em = err(mid)
            if em * elo > 0:
                lo, elo = mid, em
            else:
                hi = mid
        prev = 0.5 * (lo + hi)
        v = list(rot[f][1])
        v[a] += prev
        rot[f] = (rot[f][0], tuple(v))
    return keys


def walk_feet(root: Part, keys: dict, legs: dict, carrier: str, frames, axis: str = "x") -> dict:
    """Plant feet and step them home, for a body that moves over its legs.

    `legs` = {leg: (foot_local, steps)} where steps is a list of
    (f_lift, f_plant, lift) windows. Outside a window the foot keeps the
    world z it had when it last planted (the leg swings under the moving
    body, no skating); inside one it lifts by `lift` on an arc and travels
    to where the rest pose puts it under the body (a step), landing on
    f_plant. Frames before the first plant just follow the keys (a foot in
    the air through a pop). Turns each leg about `axis` (its swing) and
    lifts it with its "loc" y. Edits `keys` in place."""
    poser = Poser(root)
    frames = list(frames)
    for leg, (local, steps) in legs.items():
        rot = keys[leg]["rot"]
        n = len(rot)
        loc = keys[leg].setdefault("loc", [(f * F, (0.0, 0.0, 0.0)) for f in range(n)])
        a = "xyz".index(axis)
        planted = None
        prev = 0.0
        for f in frames:
            win = next(((s0, s1, h) for s0, s1, h in steps if s0 < f <= s1), None)
            if planted is None:
                planted = poser.point(keys, f, leg, local)[2]
                continue
            if win:
                s0, s1, h = win
                u = (f - s0) / (s1 - s0)
                # where the rest pose would put this foot now (the leg straight)
                old = rot[f]
                rot[f] = (old[0], tuple(0.0 if i == a else old[1][i] for i in range(3)))
                home = poser.point(keys, f, leg, local)[2]
                rot[f] = old
                target = planted + (home - planted) * (u * u * (3 - 2 * u))
                lift = 4 * h * u * (1 - u)
                if f == s1:
                    planted = home
            else:
                target, lift = planted, 0.0

            def err(d):
                old = rot[f]
                v = list(old[1]); v[a] += d
                rot[f] = (old[0], tuple(v))
                e = poser.point(keys, f, leg, local)[2] - target
                rot[f] = old
                return e
            lo, hi = prev - 35.0, prev + 35.0
            elo, ehi = err(lo), err(hi)
            if elo * ehi <= 0:
                for _ in range(30):
                    mid = 0.5 * (lo + hi)
                    em = err(mid)
                    if em * elo > 0:
                        lo, elo = mid, em
                    else:
                        hi = mid
                prev = 0.5 * (lo + hi)
            v = list(rot[f][1]); v[a] += prev
            rot[f] = (rot[f][0], tuple(v))
            lv = list(loc[f][1]); lv[1] += lift
            loc[f] = (loc[f][0], tuple(lv))
    return keys


def pin_tip(root: Part, keys: dict, part: str, local, frames, target, iters: int = 14) -> dict:
    """IK for a one-bone limb with no knee: swing `part` (rot x and z on top
    of its keys) and stretch it (a uniform scale, like a knee taking up
    the slack) frame by frame so its point `local` sits exactly at
    `target(frame) -> world (x, y, z)` (a leg tip held where it stands, on
    the floor). Gauss-Newton from the previous frame's answer, so the
    solution stays continuous (no branch snaps). Edits `keys` in place."""
    poser = Poser(root)
    ch = keys[part]
    rot = ch["rot"]
    n = len(rot)
    sc = ch.setdefault("scale", [(i * F, (1.0, 1.0, 1.0)) for i in range(n)])
    sol = np.zeros(3)  # rot x, rot z (degrees), scale - 1 (x100)
    for f in frames:
        base = np.asarray(rot[f][1], dtype=float)
        bsc = np.asarray(sc[f][1], dtype=float)
        tgt = np.asarray(target(f), dtype=float)

        def at(d):
            rot[f] = (rot[f][0], (base[0] + d[0], base[1], base[2] + d[1]))
            sc[f] = (sc[f][0], tuple(bsc * (1 + d[2] / 100.0)))
            return poser.point(keys, f, part, local)

        x = sol.copy()
        for _ in range(iters):
            p = at(x)
            e = tgt - p
            if np.linalg.norm(e) < 1e-3:
                break
            J = np.zeros((3, 3))
            for i in range(3):
                dx = np.zeros(3); dx[i] = 0.5
                J[:, i] = (at(x + dx) - p) / 0.5
            step = np.linalg.solve(J.T @ J + 0.02 * np.eye(3), J.T @ e)
            x = x + np.clip(step, -12, 12)
        sol = x
        at(sol)
    return keys
