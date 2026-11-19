"""Move loops for the fantasy creatures with rigid legs (basilisk, centaur,
cyclops, dragon, ent, goblin, griffin): a foot-plant gait keyed once a
frame (use with Clip(ease=0, floor=False)).

`gait` walks rigid legs in place, facing -Z: each stance foot's sole slides
back at a constant ground speed on the floor (its swing angle solved per
frame, a small slide along the leg puts its lowest point exactly on the
floor, and an optional x lock keeps it from skating sideways when the body
rolls or yaws); each swing foot follows a lift curve from behind to in
front, leaving and landing at close to the ground speed. The body's height
is solved from the planted legs (it vaults over them: highest at mid
stance), then the creature's own body offsets go on top: a thud on each
footfall, a weight shift, a pitch or yaw. Creature files key the rest
(heads, arms, tails, wings) from the per-frame phase info it returns.
"""
from __future__ import annotations

import math
import os

import numpy as np

from _quad_falls import _positions, _soles, rmat

F = 1 / 30


def mesh_pts(part, below: float | None = None):
    """The exported mesh's vertices of a part (atlas.mesh_part: voxels owned
    by true-slope prisms are not drawn, so voxel corners can sit outside the
    real surface), relative to its pivot; only those under `below` (pivot
    relative y) if given, else the lowest third."""
    import atlas
    m = atlas.mesh_part(part.grid)
    p = np.unique(np.array([v for f in m.faces for v in f.verts], dtype=float), axis=0) - np.array(part.pivot, dtype=float)
    lo, hi = p[:, 1].min(), p[:, 1].max()
    cut = below if below is not None else lo + max(6.0, (hi - lo) / 3)
    return p[p[:, 1] <= cut]


def lerp(rows, x):
    """Piecewise linear through [(x, value), ...] (clamped at the ends)."""
    if x <= rows[0][0]:
        return rows[0][1]
    for (a, va), (b, vb) in zip(rows, rows[1:]):
        if a <= x <= b:
            return va + (vb - va) * (x - a) / max(1e-9, b - a)
    return rows[-1][1]


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def hermite(w, p0, p1, m0, m1):
    h00, h10, h01, h11 = 2 * w ** 3 - 3 * w ** 2 + 1, w ** 3 - 2 * w ** 2 + w, -2 * w ** 3 + 3 * w ** 2, w ** 3 - w ** 2
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1


def heavy_lift(h, hang=0.15, drop=0.3):
    """A swing height curve for heavy feet: a slow lift to h, a short hang,
    then a drop over the last `drop` of the swing that accelerates into the
    floor (gravity: fastest at contact)."""
    def f(w):
        top = 1.0 - drop
        if w <= top - hang:
            return h * smooth(w / (top - hang))
        if w <= top:
            return h
        v = (w - top) / drop
        return h * (1 - v * v)
    return f


def quick_lift(h):
    """A light, quick foot: up fast, down fast (a sine arc, a little early)."""
    return lambda w: h * math.sin(math.pi * min(1.0, w ** 0.85))


class Rig:
    """Geometry of one body part with rigid leg children (and optional
    floor contacts modelled in the body itself)."""

    def __init__(self, root, body: str, legs, fixed: float | None = None):
        parts = {p.name: p for p in root.walk()}
        pos = _positions(root)
        self.body, self.legs = body, list(legs)
        self.B = pos[body]
        self.H = {n: pos[n] - self.B for n in self.legs}
        self.pts = {n: mesh_pts(parts[n]) for n in self.legs}
        self.sole = {}
        for n in self.legs:
            p = self.pts[n]
            lo = p[:, 1].min()
            self.sole[n] = p[p[:, 1] < lo + 1.5].mean(axis=0)
        self.fixed = mesh_pts(parts[body], fixed - self._piv(parts[body])) if fixed is not None else None
        rest = [self.leg(n, np.zeros(3), np.eye(3), np.zeros(3), np.zeros(3))[0] for n in self.legs]
        if self.fixed is not None:
            rest.append(self.fixed_low(np.zeros(3), np.eye(3)))
        self.floor = min(rest)  # the export grounds the lowest rest vertex: that height is the floor
        self.rest_sole = {n: self.leg(n, np.zeros(3), np.eye(3), np.zeros(3), np.zeros(3))[1] for n in self.legs}

    @staticmethod
    def _piv(part):
        return float(part.pivot[1])

    def leg(self, n, bloc, R, lrot, lloc):
        """(lowest y, sole centre) of leg n in the body's parent space."""
        base = self.B + bloc + R @ (self.H[n] + lloc)
        r = R @ rmat(lrot)
        pts = base + (r @ self.pts[n].T).T
        return pts[:, 1].min(), base + r @ self.sole[n]

    def fixed_low(self, bloc, R):
        p = self.B + bloc + (R @ self.fixed.T).T
        return p[:, 1].min()

    def solve_x(self, n, bloc, R, lrot, z, lloc=None):
        """Leg x angle that puts the sole centre at z (+x swings it forward)."""
        lloc = np.zeros(3) if lloc is None else lloc
        lo, hi = -80.0, 80.0
        for _ in range(40):
            m = (lo + hi) / 2
            if self.leg(n, bloc, R, (m, lrot[1], lrot[2]), lloc)[1][2] > z:
                lo = m
            else:
                hi = m
        return (lo + hi) / 2

    def solve_zrot(self, n, bloc, R, lrot, lloc, x):
        """Leg z angle (splay) that puts the sole centre at x."""
        c0 = lrot[2]
        lo, hi = c0 - 30.0, c0 + 30.0
        x_lo = self.leg(n, bloc, R, (lrot[0], lrot[1], lo), lloc)[1][0]
        x_hi = self.leg(n, bloc, R, (lrot[0], lrot[1], hi), lloc)[1][0]
        inc = x_hi > x_lo
        for _ in range(40):
            m = (lo + hi) / 2
            if (self.leg(n, bloc, R, (lrot[0], lrot[1], m), lloc)[1][0] < x) == inc:
                lo = m
            else:
                hi = m
        return (lo + hi) / 2


def about(R, p, B):
    """The body `loc` that makes rotation R act about point p (parent space)
    instead of the body's pivot B."""
    q = np.asarray(p, dtype=float) - B
    return q - R @ q


def gait(rig: Rig, N: int, legs: dict, stride: float, duty: float, lift, body=None, lean: float = 1.0,
         xlock: bool = False, splay: dict | None = None, bias: dict | None = None, swing_speed: float = 0.6,
         smooth_passes: int = 2, rest_body=None, fixed_stance=None, lift_extra=None):
    """Per-frame keys for the body and legs of an in-place gait loop.

    N: frames in the loop (key N repeats key 0). legs: {leg: (phase, cycles)}:
    the loop phase (0-1) the foot touches down and how many strides it takes
    in the loop. stride: sole travel in voxels. duty: share of a stride on
    the ground. lift(w) -> swing height (w 0-1) in voxels; a dict {leg: fn}
    for different feet. body(f, info) -> dict of body offsets on top of the
    solved height: "rot" (deg), "pivot" (parent-space point the rotation acts
    about), "dy" (<= 0 drops it: a thud), "dx", "dz", "scale". lean: share of
    the stance travel done by swinging the leg (the rest slides it along z,
    for feet that should stay flat). xlock: stance feet keep their x
    (sideways) as the body rolls or yaws, solved with the leg's z angle.
    splay {leg: z angle}. bias {leg: dz} moves a foot's track. fixed_stance(f)
    -> True while the body's own floor contacts are planted (they set the
    height then). lift_extra(f) adds to the solved height (a hop).

    Returns (keys, info): keys {part: {"rot"/"loc"(/"scale"): [(t, xyz)]}},
    info[f] = {"legs": {leg: {"stance", "u", "w", "z" (-1 front .. 1 back),
    "since" (frames since its touchdown)}}, "since": frames since any touchdown}."""
    splay = splay or {}
    bias = bias or {}
    lifts = lift if isinstance(lift, dict) else {n: lift for n in legs}

    def phase(n, f):
        ph, cyc = legs[n]
        u = (f / N * cyc - ph) % 1.0
        frames = N / cyc  # frames per stride
        return u, frames

    def track(n, f):
        """(stance?, target sole z, target height, u, w)."""
        u, frames = phase(n, f)
        zc = rig.rest_sole[n][2] + bias.get(n, 0.0)
        if u < duty:
            return True, zc - stride / 2 + stride * u / duty, 0.0, u, 0.0
        w = (u - duty) / (1 - duty)
        v = stride / duty  # ground speed in voxels per stride-unit of u
        m = -v * (1 - duty) * swing_speed  # forward travel speed at lift-off and touchdown, per unit w
        z = zc + hermite(w, stride / 2, -stride / 2, m, m)
        return False, z, lifts[n](w), u, w

    def body_pose(f):
        o = body(f, None) if body else {}
        rot = np.array(o.get("rot", (0.0, 0.0, 0.0)), dtype=float)
        R = rmat(rot)
        loc = np.array((o.get("dx", 0.0), 0.0, o.get("dz", 0.0)))
        if "pivot" in o:
            loc = loc + about(R, o["pivot"], rig.B)
        return rot, R, loc, o

    # pass 1: the natural height (the body vaults over its planted legs)
    nat = []
    for f in range(N):
        rot, R, loc, o = body_pose(f)
        need = []
        if fixed_stance is not None and rig.fixed is not None and fixed_stance(f):
            nat.append(rig.floor - rig.fixed_low(loc, R))
            continue
        for n in legs:
            st, z, h, u, w = track(n, f)
            if not st:
                continue
            lr = (0.0, 0.0, splay.get(n, 0.0))
            a = rig.solve_x(n, loc, R, lr, z) * lean if lean < 1.0 else rig.solve_x(n, loc, R, lr, z)
            low = rig.leg(n, loc, R, (a, 0.0, lr[2]), np.zeros(3))[0]
            need.append(low - rig.floor)
        nat.append(-max(need) if need else None)
    if os.environ.get("FMOVE_NAT"):
        print("nat", [None if v is None else round(v, 2) for v in nat])
    known = [i for i, v in enumerate(nat) if v is not None]
    for i in range(N):  # no planted leg: ease across
        if nat[i] is None:
            a = max([j for j in known if j < i] or [known[-1] - N])
            c = min([j for j in known if j > i] or [known[0] + N])
            w = (i - a) / (c - a)
            nat[i] = nat[a % N] * (1 - w) + nat[c % N] * w
    for _ in range(smooth_passes):
        nat = [(nat[i - 1] + 2 * nat[i] + nat[(i + 1) % N]) / 4 for i in range(N)]

    # where each stance foot keeps its sideways spot: under its (splayed) leg at rest
    home_x = {n: rig.leg(n, np.zeros(3), np.eye(3), (0.0, 0.0, splay.get(n, 0.0)), np.zeros(3))[1][0] for n in legs}

    # pass 2: key every frame
    keys = {rig.body: {"rot": [], "loc": []}}
    for n in legs:
        keys[n] = {"rot": [], "loc": []}
    info = []
    last_td = {}
    for f in range(N + 1):
        j = f % N
        t = f * F
        rot, R, loc, o = body_pose(j)
        loc = loc + np.array((0.0, nat[j] + o.get("dy", 0.0) + (lift_extra(j) if lift_extra else 0.0), 0.0))
        keys[rig.body]["rot"].append((t, tuple(float(v) for v in rot)))
        keys[rig.body]["loc"].append((t, tuple(float(v) for v in loc)))
        if "scale" in o:
            keys[rig.body].setdefault("scale", []).append((t, tuple(float(v) for v in o["scale"])))
        Rt = R.T
        legi = {}
        for n in legs:
            st, z, h, u, w = track(n, j)
            lr = [0.0, 0.0, splay.get(n, 0.0)]
            lloc = np.zeros(3)
            for it in range(5):
                if lean >= 1.0 or it == 0:
                    lr[0] = rig.solve_x(n, loc, R, lr, z, lloc) * lean  # swing feet lean the same share, so nothing pops at touchdown
                low, sole = rig.leg(n, loc, R, lr, lloc)
                dz = (z - sole[2]) if lean < 1.0 else 0.0
                lloc = lloc + Rt @ np.array((0.0, rig.floor + h - low, dz))
                if xlock:  # swing feet too: they travel straight, no sideways flick at lift-off
                    lr[2] = rig.solve_zrot(n, loc, R, lr, lloc, home_x[n])
            keys[n]["rot"].append((t, tuple(float(v) for v in lr)))
            keys[n]["loc"].append((t, tuple(float(v) for v in lloc)))
            frames = N / legs[n][1]
            since = (u * frames) if st else None
            legi[n] = {"stance": st, "u": u, "w": w, "z": (z - rig.rest_sole[n][2] - bias.get(n, 0.0)) / (stride / 2), "since": since,
                       "slide": float(lloc[1])}
        sinces = [v["since"] for v in legi.values() if v["since"] is not None]
        info.append({"legs": legi, "since": min(sinces) if sinces else None})
    if os.environ.get("FMOVE_AUDIT"):
        print("fmove audit", rig.body, audit(rig, keys, N, info))
    return keys, info


def wave_keys(N, fn):
    """Per-frame keys [(t, xyz)] from fn(f) over a loop (key N = key 0)."""
    return [(f * F, tuple(float(v) for v in fn(f % N))) for f in range(N + 1)]


def since_touchdown(N, legs: dict, duty_unused=None):
    """frames since the latest touchdown of any of `legs` ({leg: (phase,
    cycles)}), per frame of the loop."""
    out = []
    for f in range(N):
        best = None
        for ph, cyc in legs.values():
            frames = N / cyc
            d = ((f / N * cyc - ph) % 1.0) * frames
            best = d if best is None else min(best, d)
        out.append(best)
    return out


def audit(rig: Rig, keys: dict, N: int, info):
    """Planted-foot check in plain Python: (max skate in voxels per frame off
    the ground speed, max |height| of a planted foot, max downward slide,
    min swing height). Print it while authoring."""
    skate, hover, ext, swing_low = 0.0, 0.0, 0.0, 9e9
    prev = {}
    speeds = []
    for f in range(N + 1):
        bl = np.array(keys[rig.body]["loc"][f][1])
        R = rmat(keys[rig.body]["rot"][f][1])
        for n in rig.legs:
            if n not in keys:
                continue
            lr = keys[n]["rot"][f][1]
            ll = np.array(keys[n]["loc"][f][1])
            low, sole = rig.leg(n, bl, R, lr, ll)
            st = info[f]["legs"][n]["stance"]
            if st:
                hover = max(hover, abs(low - rig.floor))
                ext = max(ext, -ll[1])
                if n in prev and prev[n][0]:
                    speeds.append((n, f, sole[2] - prev[n][1][2], sole[0] - prev[n][1][0]))
            else:
                swing_low = min(swing_low, low - rig.floor)
            prev[n] = (st, sole)
    if speeds:
        dz = np.array([s[2] for s in speeds])
        dx = np.array([s[3] for s in speeds])
        skate = float(np.max(np.abs(dz - np.median(dz))))
        side = float(np.max(np.abs(dx)))
    else:
        side = 0.0
    return {"skate_z": round(skate, 3), "skate_x": round(side, 3), "hover": round(hover, 3), "extend": round(ext, 3), "swing_low": round(swing_low, 3),
            "ground_speed": round(float(np.median(dz)) if speeds else 0.0, 3)}


def heavy_biped(root, pelvis: str, hip, N: int = 48, stride: float = 14.0, lift: float = 5.0, thud: float = 2.6, duty: float = 0.62,
                lean: float = 0.7, roll: float = 2.5, pitch: float = -3.0, torso: str = "body", head: str = "head",
                arms=("arm-l", "arm-r"), arm_swing=(20.0, 20.0), flare: float = 6.0, nod: float = 7.0, squash: float = 0.05,
                twist: float = 3.0):
    """A thundering two-legged walk (cyclops, ent), keyed every frame.

    Each foot is lifted slowly, hangs, and drops in the last third of its
    swing, accelerating into the floor. The body keeps falling 2 frames past
    each footfall and stops dead (a squash on the torso, a small decaying
    shake), the head nods down a frame late and the arms flare, then the body
    heaves itself up over the new stance leg (its weight rolls over that
    foot). The loop starts mid-heave (footfalls at 1/4 and 3/4 of the loop),
    so the seam never lands on a jolt. hip: the hip centre (the pelvis
    rotations act about it). Returns the clip keys."""
    half = N // 2
    legs = {"leg-l": (0.25, 1), "leg-r": (0.75, 1)}
    t3 = round(half * 0.8)
    drop = [(0, 0.0), (1, -0.45 * thud), (2, -thud), (3, -0.86 * thud), (4, -0.95 * thud), (6, -0.9 * thud), (9, -0.85 * thud),
            (t3, 0.1 * thud), (half - 2, 0.12 * thud), (half, 0.0)]
    shake = [(0, 0.0), (2, 0.0), (3, 1.4), (5, -0.9), (7, 0.4), (9, 0.0), (half, 0.0)]

    def since(f):
        return ((f / N - 0.25) % 0.5) * N

    def carrier(f):  # -1 while the left foot carries it (from its footfall at N/4)
        return -1 if 0.25 <= (f / N) % 1.0 < 0.75 else 1

    def body(f, _):
        d = since(f)
        c = carrier(f)
        lean_in = smooth(d / 8.0) * (1 - smooth((d - (half - 6)) / 6))  # the weight rolls over the stance foot, back to centre at the next fall
        return {"rot": (pitch + 1.2 * lerp(drop, d) / thud, twist * math.cos(2 * math.pi * (f / N - 0.25)), -c * roll * lean_in + c * lerp(shake, d)),
                "pivot": hip, "dy": lerp(drop, d)}

    rig = Rig(root, pelvis, list(legs))
    keys, info = gait(rig, N, legs, stride=stride, duty=duty, lift=heavy_lift(lift, hang=0.12, drop=0.3), body=body, lean=lean, smooth_passes=3, xlock=True)

    def zof(n, f):
        return info[f % N]["legs"][n]["z"]

    def sq(f):
        return lerp([(0, 0.0), (1, 0.4), (2, 1.0), (3, 0.6), (5, 0.0), (half, 0.0)], since(f % N))

    def nd(f):
        return lerp([(0, 0.0), (1, 0.0), (3, -1.0), (5, 0.25), (7, -0.3), (10, 0.0), (half, 0.0)], since(f % N))

    def fl(f):
        return lerp([(0, 0.0), (1, 0.0), (3, 1.0), (6, 0.35), (9, 0.5), (13, 0.0), (half, 0.0)], since(f % N))
    if torso:
        keys[torso] = {"rot": wave_keys(N, lambda f: (0.0, -0.6 * twist * math.cos(2 * math.pi * (f / N - 0.25)), 0.0)),
                       "scale": wave_keys(N, lambda f: (1 + squash * sq(f), 1 - 1.4 * squash * sq(f), 1 + squash * sq(f)))}
    if head:
        keys[head] = {"rot": wave_keys(N, lambda f: (nod * nd(f), 0.4 * twist * math.cos(2 * math.pi * (f / N - 0.25)), 0.0))}
    for arm, s, amp in zip(arms, (-1, 1), arm_swing):
        if arm is None:
            continue
        leg = "leg-l" if s < 0 else "leg-r"
        keys[arm] = {"rot": wave_keys(N, lambda f, leg=leg, s=s, amp=amp: (amp * zof(leg, f), 0.0, s * flare * fl(f)))}
    return keys, since
