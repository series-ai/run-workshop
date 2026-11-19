"""Move loops for the fantasy creatures with rigid one-piece legs (harpy,
minotaur, owlbear, phoenix, skeleton knight, slime, troll, unicorn).

`Gait` solves walking legs a frame at a time, in place (the root never
travels), facing -Z:

- Each leg is one rigid part turned about its hip (rot x). In stance its
  sole centre slides back along the floor at one constant ground speed
  (contact at the front, lift-off at the back); in swing it lifts, carries
  forward and drops onto the floor at the front.
- The body height is the highest it can be with no foot below the floor
  and no leg pulled out of its hip: each leg slides up into its hip (a
  small leg `loc`) by whatever its sole would otherwise sink. A swing foot
  coming down near its contact pulls the body down with it, so the body
  drops INTO each footfall, and `drop(f)` adds a heavy creature's extra
  thump on top (the legs take it by sliding a little further into the
  hips, hidden by the body).
- The lowest point of every planted sole is exactly on the floor (y 0).

Every channel is keyed once per frame (use Clip(ease=0.0)); frame T equals
frame 0, so the loop is seamless.
"""
from __future__ import annotations

import math

import numpy as np

from _quad_falls import _positions, _soles, per_frame, rmat


def snap(u: float) -> float:
    """Fast out, settles into the end (1 - (1-u)^2)."""
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 2


def acc(u: float, p: float = 2.0) -> float:
    """Starts slow, arrives fast (gravity)."""
    u = min(1.0, max(0.0, u))
    return u ** p


def smooth(u: float) -> float:
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def loop_rows(rows, T: int):
    """A periodic per-frame curve from [(frame, value[, curve])] poses over
    0..T (the first row's value is used again at T). Curves: lin, snap,
    acc, smooth. Returns a function of the frame (any integer)."""
    rows = sorted(rows, key=lambda r: r[0])
    if rows[0][0] != 0:
        raise ValueError("loop_rows: the first row must be at frame 0")
    full = list(rows) + [(T, rows[0][1], rows[0][2] if len(rows[0]) > 2 else "smooth")]
    curves = {"lin": lambda u: u, "snap": snap, "acc": acc, "smooth": smooth}

    def at(f):
        f = f % T
        for a, b in zip(full, full[1:]):
            if a[0] <= f <= b[0]:
                u = (f - a[0]) / max(1e-9, b[0] - a[0])
                k = curves[b[2] if len(b) > 2 else "smooth"](u)
                va, vb = np.array(a[1], float), np.array(b[1], float)
                return va + (vb - va) * k
        return np.array(rows[0][1], float)
    return at


class Gait:
    """Rigid legs hanging from `body` (which hangs from the root, or is the
    root). Positions are in the root's frame, y 0 = the floor."""

    def __init__(self, root, body: str, legs):
        parts = {p.name: p for p in root.walk()}
        pos = _positions(root)
        self.body, self.legs = body, list(legs)
        self.B = pos[body]
        self.H = {n: pos[n] - self.B for n in self.legs}
        self.pts = {n: _soles(parts[n]) for n in self.legs}
        self.sole = {}
        for n in self.legs:
            p = self.pts[n]
            lo = p[:, 1].min()
            self.sole[n] = p[p[:, 1] < lo + 1.5].mean(axis=0)
        self.rest_z = {n: float((self.B + self.H[n] + self.sole[n])[2]) for n in self.legs}

    def _leg(self, n, brot, a, lloc=0.0):
        """(lowest y, sole centre) of leg n with the body at loc 0 (only
        turned by brot) and the leg turned by a about x and slid up lloc."""
        rb = rmat(brot)
        ra = rmat((a, 0.0, 0.0))
        base = self.B + rb @ (self.H[n] + np.array((0.0, lloc, 0.0)))
        pts = base + (rb @ (ra @ self.pts[n].T)).T
        return pts[:, 1].min(), base + rb @ (ra @ self.sole[n])

    def angle(self, n, brot, z, lloc=0.0):
        """The leg angle that puts its sole centre at world z."""
        lo, hi = -75.0, 75.0
        zl, zh = self._leg(n, brot, lo, lloc)[1][2], self._leg(n, brot, hi, lloc)[1][2]
        inc = zh > zl
        for _ in range(48):
            mid = (lo + hi) / 2
            zm = self._leg(n, brot, mid, lloc)[1][2]
            if (zm < z) == inc:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    def walk(self, T: int, phase: dict, duty: float, stride: float, lift: float, body_rot=None, drop=None,
             fwd: float = 0.0, carry: float = 0.8, land: float = 0.3, extra_lift=None, height=None) -> dict:
        """Per-frame samples {part: {chan: [array per frame 0..T]}} for the
        body and the legs.

        phase {leg: 0..1}: where in the cycle each foot touches down.
        duty: the share of the cycle a foot is planted. stride: how far a
        foot slides back while planted (voxels). lift: the swing foot's
        height. body_rot(f) -> (x, y, z) degrees; drop(f) -> voxels the
        body sinks below the height its legs allow (>= 0). fwd: the stance
        centre's z offset from the rest spot (negative = forward). carry:
        the share of the swing in which the foot travels forward (it then
        hangs over its spot and drops); land: the share of the swing it
        spends coming down (accelerating). height(f) -> a designed body
        height curve: the body follows it wherever it is lower than the
        legs allow (a heave that falls with gravity into each footfall)."""
        body_rot = body_rot or (lambda f: (0.0, 0.0, 0.0))
        drop = drop or (lambda f: 0.0)
        out = {self.body: {"loc": [], "rot": []}}
        for n in self.legs:
            out[n] = {"rot": [], "loc": []}
        for f in range(T + 1):
            br = np.array(body_rot(f % T), float)
            per = {}
            for n in self.legs:
                p = ((f % T) / T - phase[n]) % 1.0
                z0 = self.rest_z[n] + fwd
                if p < duty:  # planted: the sole slides back at ground speed
                    z = z0 - stride / 2 + stride * p / duty
                    up = 0.0
                else:
                    q = (p - duty) / (1 - duty)
                    z = z0 + stride / 2 - stride * smooth(q / carry)
                    if q < 1 - land:
                        up = lift * snap(q / max(1e-6, 0.35 * (1 - land)))
                    else:
                        up = lift * (1 - acc((q - (1 - land)) / land))
                    if extra_lift is not None:
                        up += extra_lift(n, q)
                a = self.angle(n, br, z)
                low = self._leg(n, br, a)[0]
                per[n] = (a, low, up, z)
            ty = rmat(br)[1, 1]
            by = min(-low + up for _, low, up, _ in per.values())
            if height is not None:
                by = min(by, height(f % T))
            by -= drop(f % T)
            out[self.body]["loc"].append(np.array((0.0, by, 0.0)))
            out[self.body]["rot"].append(br)
            for n, (a, low, up, z) in per.items():
                ll = max(0.0, (-by - low + up) / ty)
                a = self.angle(n, br, z, ll)  # the slide shifts the hip a hair in a pitched body
                out[n]["rot"].append(np.array((a, 0.0, 0.0)))
                out[n]["loc"].append(np.array((0.0, ll, 0.0)))
        return out


def periodic(fn, T: int):
    """[fn(f) per frame 0..T] (f taken mod T, so frame T equals frame 0)."""
    return [np.array(fn(f % T), float) for f in range(T + 1)]


def thump(T: int, contacts, depth: float, fall: int = 3, past: int = 2, rise: int | None = None):
    """A heavy footfall drop, periodic: before each contact frame the body
    starts falling (accelerating over `fall` frames), keeps falling `past`
    frames after it and stops dead at `depth`, then climbs back over
    `rise` frames (default: until halfway to the next contact)."""
    contacts = sorted(c % T for c in contacts)

    def at(f):
        best = 0.0
        for c in contacts:
            gaps = [((c2 - c) % T) or T for c2 in contacts]
            r = rise if rise is not None else max(3, min(gaps) // 2)
            d = (f - c) % T
            if d > T / 2:
                d -= T
            if -fall <= d <= past:
                v = depth * acc((d + fall) / (fall + past), 2.0)
            elif past < d <= past + r:
                v = depth * (1 - smooth((d - past) / r))
            else:
                v = 0.0
            best = max(best, v)
        return best
    return at


def to_keys(samples: dict) -> dict:
    return per_frame(samples)


def add(samples: dict, part: str, chan: str, seq) -> None:
    samples.setdefault(part, {})[chan] = list(seq)


def keep_rest(root, clip: dict) -> dict:
    """Give every part with a grid at least a rest key in the clip."""
    for part in root.walk():
        if part.grid is not None and part.name not in clip:
            clip[part.name] = {"rot": [(0.0, (0.0, 0.0, 0.0))]}
    return clip


def deg(x):
    return math.degrees(x)


def cyc(rows, T: int):
    """Per-frame values 0..T of a periodic pose curve (see loop_rows)."""
    at = loop_rows(rows, T)
    return [at(f) for f in range(T + 1)]


def mix(*seqs):
    """Sum per-frame sequences of equal length."""
    return [sum(vals) for vals in zip(*seqs)]


class World:
    """Forward kinematics of a part tree under per-frame samples."""

    def __init__(self, root):
        self.parts = {p.name: p for p in root.walk()}
        self.parent = {}
        for p in root.walk():
            for c in p.children:
                self.parent[c.name] = p.name

    def _chan(self, s, f, name, ch, rest):
        try:
            return np.array(s[name][ch][f], float)
        except (KeyError, IndexError):
            return np.array(rest, float)

    def frame(self, s, f, name):
        """(translation, matrix) of the part's pivot frame in the root's frame."""
        chain = [name]
        while chain[-1] in self.parent:
            chain.append(self.parent[chain[-1]])
        t, m = np.zeros(3), np.eye(3)
        for n in reversed(chain):
            p = self.parts[n]
            lt = np.array(p.at, float) + self._chan(s, f, n, "loc", (0, 0, 0))
            lm = rmat(p.rot) @ rmat(self._chan(s, f, n, "rot", (0, 0, 0))) @ np.diag(self._chan(s, f, n, "scale", (1, 1, 1)))
            t, m = t + m @ lt, m @ lm
        return t, m

    def low(self, s, f, name, pts):
        t, m = self.frame(s, f, name)
        return (t + (m @ pts.T).T)[:, 1].min()


def solve_low(world, s, f, part, pts, chan_part, axis, target, lo=-60.0, hi=60.0):
    """Set s[chan_part]["rot"][f][axis] so `part`'s lowest point sits at
    `target` (bisection; the height must change monotonically)."""
    def h(a):
        s[chan_part]["rot"][f][axis] = a
        return world.low(s, f, part, pts)
    hl, hh = h(lo), h(hi)
    inc = hh > hl
    for _ in range(40):
        mid = (lo + hi) / 2
        if (h(mid) < target) == inc:
            lo = mid
        else:
            hi = mid
    s[chan_part]["rot"][f][axis] = (lo + hi) / 2


def _seam_bad(seq) -> bool:
    """The pack's loop check (out/compare/check-clips.mjs) on one channel:
    does its speed jump across the loop point?"""
    v = np.array(seq, float)
    st = np.linalg.norm(np.diff(v, axis=0), axis=1)
    mean = st.mean()
    if mean < 1e-4:
        return False
    a0, a1 = st[0], st[-1]
    hi, lo = max(a0, a1), min(a0, a1)
    return hi > 0.5 * mean and hi > 2.5 * lo + 0.05 * mean


def turn_loop(samples: dict, T: int, at: int | None = None):
    """Start a periodic per-frame loop at another frame (every channel
    shifted alike, so the motion is unchanged): the frame where the fewest
    channels turn or kick across the loop point, so the seam is mid-stroke.
    Returns (samples, the old frame that is now frame 0)."""
    def shifted(seq, k):
        body = seq[:T]
        out = [body[(f + k) % T] for f in range(T)]
        return out + [out[0]]
    chans = [(p, c) for p, cs in samples.items() for c in cs]
    if at is None:
        scores = []
        for k in range(T):
            bad = sum(_seam_bad(shifted(samples[p][c], k)) for p, c in chans)
            scores.append((bad, k))
        at = min(scores)[1]
    out = {p: {c: shifted(seq, at) for c, seq in cs.items()} for p, cs in samples.items()}
    return out, at
