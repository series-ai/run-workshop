"""Shared death keying for the fantasy four-legged creatures (centaur,
griffin, owlbear, unicorn): a weighted roll onto the side.

`quad_roll` keys a death that reads with weight: a flinch, the legs
buckle, it rolls onto its left side accelerating into the floor on the
impact frame (pass the returned time as Clip(impact=...)), rocks back once
with a small lift (the bounce) and settles, the loose parts landing late.

The export keeps creature deaths on the floor, so the root is never lifted
by hand here (only the bounce is keyed).
"""
from __future__ import annotations

F = 1 / 30


def _scale(v, f):
    return tuple(a * f for a in v)


def quad_roll(body: str, about, roll: float = 88.0, k: float = 1.0, bounce: float = 2.0, legs: dict | None = None,
              loose: dict | None = None, leg_loc=None, sink=(0.0, 0.0), buckle: int = 14, hold_legs: bool = False):
    """Keys for a four-legged death: a flinch (it rears away from the blow),
    the legs buckle, it rolls onto its left side accelerating into the
    floor (impact on the landing: pass the returned time as Clip(impact=)),
    rolls back once with a small lift (the bounce) and settles.

    about(deg) -> the body's `loc` offset that makes a z roll of `deg` act
    about the left feet. legs: {name: (buckle, land)} rotations. loose:
    {name: (wind, land)} rotations for heads, necks, tails, wings and arms:
    they lag the fall, land after the body, overshoot into a flop and
    settle. leg_loc: an optional constant leg `loc` (e.g. a hoof lift).
    sink: (buckle, lying) body drops in voxels, so the body comes down as
    the legs fold instead of hanging in the air (the export lifts it back
    if a pose would go under the floor).
    buckle: the frame the legs have given way and the roll starts (later =
    a shorter, faster topple after a longer, moving buckle). hold_legs: keep
    the legs straight through the flinch, so they fold in step with the drop.
    Returns (clip_keys, land_seconds)."""
    def T(fr):
        return round(fr * k) * F

    land = round(27 * k)
    sb, sl = sink
    beats = [(0, 0.0, 0.0), (5, -6.0, 0.0), (10, -3.0, 0.0), (buckle, 6.0, sb), (27, roll, sl), (31, roll - 5.0, sl + bounce), (37, roll + 1.0, sl), (44, roll, sl)]
    out = {body: {"rot": [(T(fr), (0, 0, a)) for fr, a, _ in beats],
                  "loc": [(T(fr), tuple(o + d for o, d in zip(about(a), (0, lift, 0)))) for fr, a, lift in beats]}}
    for name, (bend, land_pose) in (legs or {}).items():
        held = [(T(10), (0, 0, 0))] if hold_legs else []  # the legs stay straight until the body starts to drop
        out[name] = {"rot": [(0, (0, 0, 0)), (T(5), (0, 0, 0))] + held + [(T(buckle), bend), (T(27), land_pose), (T(31), _scale(land_pose, 1.3)),
                             (T(37), _scale(land_pose, 0.9)), (T(44), land_pose)]}
        if leg_loc is not None:
            out[name]["loc"] = [(0, (0, 0, 0)), (T(2), leg_loc), (T(44), leg_loc)]
    for name, (wind, land_pose) in (loose or {}).items():
        out[name] = {"rot": [(0, (0, 0, 0)), (T(5), wind), (T(12), _scale(wind, 0.6)), (T(24), _scale(land_pose, 0.5)), (T(30), _scale(land_pose, 0.8)),
                             (T(34), _scale(land_pose, 1.25)), (T(40), _scale(land_pose, 0.85)), (T(48), land_pose)]}
    return out, land * F


# ---------------------------------------------------------------- helpers
def pl(keys, t):
    """Piecewise-linear value of [(t, v), ...] (v a number or a tuple) at t."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-9, t1 - t0)
            if isinstance(v0, tuple):
                return tuple(a + (b - a) * u for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * u
    return keys[-1][1]


def planted(root_loc, feet: dict, L: float, extra_times=()):
    """Legs that keep their feet where `feet` says while the root moves.

    root_loc: the root's [(t, (x, y, z)), ...]. feet: {leg: [(t, foot_z,
    lift), ...]} (piecewise linear; a foot is planted while its z holds and
    lift is 0, a step lifts and moves it). L: hip-to-ankle length in voxels.
    A rigid leg turns by asin((root_z - foot_z) / L) about the hip (+x
    swings the foot forward). Returns ({leg: {"rot", "loc"}}, root_loc with
    the hips lowered by the drop of the most upright planted leg, so the
    feet stay on the floor)."""
    times = sorted({round(t * 30) for t, _ in root_loc} | {round(t * 30) for k in feet.values() for t, _, _ in k} | {round(t * 30) for t in extra_times})
    out = {leg: {"rot": [], "loc": []} for leg in feet}
    new_root = []
    for fr in times:
        t = fr * F
        rx, ry, rz = pl(root_loc, t)
        drops = []
        for leg, k in feet.items():
            fz = pl([(a, b) for a, b, _ in k], t)
            lift = pl([(a, c) for a, _, c in k], t)
            s = max(-0.95, min(0.95, (rz - fz) / L))
            ang = math.degrees(math.asin(s))
            out[leg]["rot"].append((t, (ang, 0.0, 0.0)))
            out[leg]["loc"].append((t, (0.0, lift, 0.0)))
            if lift < 1e-6:
                drops.append(L * (1 - math.cos(math.radians(ang))))
        new_root.append((t, (rx, ry - (min(drops) if drops else 0.0), rz)))
    return out, new_root


def mirror_x(v):
    """An (x, y, z) rotation for the part on the other side (x flips sign)."""
    x, y, z = v
    return (x, -y, -z)


def _rows(rows, k, flip=False):
    return [(round(fr * k) * F, mirror_x(v) if flip else v) for fr, v in rows]


import math  # noqa: E402


def back_fall(root: str, k: float = 1.0, bounce: float = 2.5, body: str = "body", head: str = "head",
              arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"), weapon: str | None = None, tail: str | None = None,
              arm_down: float = 15.0, flat: float = 90.0, weapon_land=(30, 0, 0), tail_land=(25, 0, 30), bounce_rot: float = 3.0, head_back: float = 2.0):
    """A heavy fall onto the back, away from the attacker (toward +Z).

    A blow rocks it back, it teeters forward onto its toes, hangs, then
    tips over backwards in ONE accelerating stroke into the floor (impact:
    pass the returned time as Clip(impact=...)): slow off the balance
    point, fastest at contact. A heavy thud, one small bounce, settle. The
    arms are flung up toward the attacker as it goes, slam down spread on
    the floor with the body, pop up and settle; the head lags, whips back
    on the landing and lolls to the side; the legs kick up and drop last.
    The export keeps it on the floor and holds that lift from the impact
    on, so the settle pose is never deeper in the floor than the landing.
    k stretches every beat (heavier creatures fall slower). Returns
    (clip_keys, land_seconds)."""
    L = round(30 * k)
    fall = flat
    # the settle ends 1.5 degrees deeper than the landing, so the held floor
    # lift never leaves the body floating at rest
    root_rot = [(0, (0, 0, 0)), (5, (5, 0, 0)), (11, (-4, 0, 0)), (14, (-3.5, 0, 0)), (30, (fall - 1.5, 4, 3)), (34, (fall - 1.5 - bounce_rot, 4, 3)),
                (40, (fall, 4, 3)), (48, (fall, 4, 3))]
    root_loc = [(0, (0, 0, 0)), (30, (0, 0, 0)), (34, (0, bounce, 0)), (40, (0, 0, 0)), (48, (0, 0, 0))]
    body_rot = [(0, (0, 0, 0)), (5, (10, 0, 0)), (11, (-8, 0, 0)), (22, (-14, 0, 0)), (30, (2, 0, 0)), (34, (-6, 0, 0)), (40, (2, 0, 0)), (48, (2, 0, 0))]
    hb = head_back  # how far the head rolls back onto the floor at rest
    head_rot = [(0, (0, 0, 0)), (5, (20, 0, 0)), (12, (-10, 0, 0)), (24, (-26, 0, 0)), (31, (2, 0, 0)), (35, (-14, 6, 0)),
                (41, (hb, 20, 0)), (50, (hb, 24, 0))]
    a = arm_down
    # the arms settle 4 degrees further down than they slam, so they rest on
    # the floor rather than hover above the held lift
    arm_l = [(0, (0, 0, 0)), (5, (-20, 0, -18)), (11, (20, 0, -10)), (22, (75, 0, -40)), (30, (-a, 0, -70)), (34, (-a + 18, 0, -58)),
             (40, (-a - 4, 0, -72)), (48, (-a - 4, 0, -70))]
    arm_r = [(0, (0, 0, 0)), (5, (-18, 0, 16)), (11, (16, 0, 12)), (24, (68, 0, 46)), (30, (-a, 0, 64)), (34, (-a + 16, 0, 54)),
             (40, (-a - 4, 0, 66)), (48, (-a - 4, 0, 64))]
    leg_l = [(0, (0, 0, 0)), (14, (0, 0, 0)), (24, (22, 0, -4)), (30, (14, 0, -6)), (35, (26, 0, -6)), (42, (12, 0, -6)), (50, (14, 0, -6))]
    leg_r = [(0, (0, 0, 0)), (14, (0, 0, 0)), (26, (14, 0, 4)), (30, (6, 0, 6)), (36, (18, 0, 7)), (44, (4, 0, 6)), (52, (6, 0, 6))]
    out = {root: {"rot": _rows(root_rot, k), "loc": _rows(root_loc, k)},
           body: {"rot": _rows(body_rot, k)}, head: {"rot": _rows(head_rot, k)},
           arms[0]: {"rot": _rows(arm_l, k)}, arms[1]: {"rot": _rows(arm_r, k)}}
    if legs:
        out[legs[0]] = {"rot": _rows(leg_l, k)}
        out[legs[1]] = {"rot": _rows(leg_r, k)}
    if weapon:
        w = weapon_land
        out[weapon] = {"rot": _rows([(0, (0, 0, 0)), (11, (8, 0, 0)), (24, (-20, 0, 0)), (30, w), (35, tuple(x * 0.6 for x in w)), (42, w), (50, w)], k)}
    if tail:
        tl = tail_land
        out[tail] = {"rot": _rows([(0, (0, 0, 0)), (11, (-10, 0, 0)), (24, (-20, 0, -10)), (31, tl), (36, (tl[0] - 15, 0, tl[2] * 0.6)), (44, tl), (52, tl)], k)}
    return out, L * F


def shove_hit(root: str, L: float, push: float = 3.0, pop: float = 1.5, k: float = 1.0, body: str = "body", head: str = "head",
              arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"), weapon: str | None = None, tail: str | None = None):
    """A hit that reads as a shove: in 2 frames the blow knocks it back and
    a little up off its feet (impact f2), it lands a step back with the
    upper body thrown back and the arms flung out, a beat, then it steps
    back in (left foot, then right) and the weight comes forward past rest
    before it settles; the head settles last. Feet planted whenever down.
    Returns (clip_keys, impact_seconds)."""
    T = lambda fr: round(fr * k) * F  # noqa: E731
    p = push
    root_loc = [(0, (0, 0, 0)), (T(2), (0, pop * 0.7, p * 0.45)), (T(4), (0, pop, p * 0.85)), (T(7), (0, 0, p)), (T(11), (0, 0, p)),
                (T(16), (0, 0, p * 0.45)), (T(21), (0, 0, -0.3)), (T(26), (0, 0, 0))]
    out = {}
    if legs:
        feet = {legs[0]: [(0, 0, 0), (T(2), 0, 0), (T(4), p * 0.5, 0.6), (T(7), p, 0), (T(11), p, 0), (T(13.5), p * 0.5, 1.6), (T(16), 0, 0), (T(26), 0, 0)],
                legs[1]: [(0, 0, 0), (T(2), 0, 0), (T(4), p * 0.6, 0.4), (T(7), p, 0), (T(16), p, 0), (T(18.5), p * 0.5, 1.6), (T(21), 0, 0), (T(26), 0, 0)]}
        # in the air the feet trail toward the attacker (they leave the floor last)
        feet[legs[0]][2] = (T(4), p * 0.35, pop * 0.9)
        feet[legs[1]][2] = (T(4), p * 0.4, pop * 0.9)
        legk, root_loc = planted(root_loc, feet, L)
        # the root never drops while it is airborne: keep the keyed pop
        out.update(legk)
    out[root] = {"loc": root_loc}
    out[body] = {"rot": [(0, (0, 0, 0)), (T(2), (16, 0, 6)), (T(5), (21, 0, 8)), (T(8), (11, 0, 4)), (T(11), (9, 0, 3)), (T(17), (2, 0, 1)),
                         (T(22), (-6, 0, -2)), (T(28), (0, 0, 0))]}
    out[head] = {"rot": [(0, (0, 0, 0)), (T(2), (18, -10, 6)), (T(6), (30, -14, 8)), (T(9), (14, -8, 4)), (T(12), (17, -8, 5)),
                         (T(19), (0, -2, 0)), (T(24), (-8, 2, -1)), (T(30), (0, 0, 0))]}
    if arms:
        out[arms[0]] = {"rot": [(0, (0, 0, 0)), (T(2), (-20, 0, -24)), (T(6), (-30, 0, -32)), (T(10), (-10, 0, -16)), (T(18), (8, 0, -4)),
                                (T(24), (-3, 0, 0)), (T(30), (0, 0, 0))]}
        out[arms[1]] = {"rot": [(0, (0, 0, 0)), (T(2), (-16, 0, 20)), (T(6), (-26, 0, 28)), (T(10), (-8, 0, 14)), (T(18), (8, 0, 4)),
                                (T(24), (-3, 0, 0)), (T(30), (0, 0, 0))]}
    if weapon:
        # the weapon swings with the shove but never dips its head below rest
        out[weapon] = {"rot": [(0, (0, 0, 0)), (T(3), (8, 0, 0)), (T(7), (20, 0, 5)), (T(12), (6, 0, 0)), (T(20), (3, 0, -2)), (T(27), (1, 0, 0)), (T(32), (0, 0, 0))]}
    if tail:
        out[tail] = {"rot": [(0, (0, 0, 0)), (T(3), (-20, 0, 0)), (T(8), (-28, 0, 6)), (T(14), (8, 0, -6)), (T(22), (-4, 0, 2)), (T(30), (0, 0, 0))]}
    return out, T(2)


def lunge(root_loc, L: float, stride: float, lift_t: float, plant_t: float, back_t: float, home_t: float,
          lead: str = "leg-l", rear: str = "leg-r", lift: float = 2.5):
    """Feet for a lunge: the rear foot stays planted; the lead foot lifts at
    lift_t, steps `stride` voxels (negative = forward, toward the target)
    and plants on plant_t (the blow), then steps home between back_t and
    home_t. Returns (leg_keys, root_loc) from `planted`."""
    mid = (lift_t + plant_t) / 2
    hmid = (back_t + home_t) / 2
    feet = {lead: [(0, 0, 0), (lift_t, 0, 0), (mid, stride * 0.45, lift), (plant_t, stride, 0), (back_t, stride, 0),
                   (hmid, stride * 0.5, lift * 0.8), (home_t, 0, 0)],
            rear: [(0, 0, 0), (home_t, 0, 0)]}
    end = root_loc[-1][0]
    if end > home_t:
        feet[lead].append((end, 0, 0))
        feet[rear].append((end, 0, 0))
    return planted(root_loc, feet, L)


# ------------------------------------------------------------------ planted feet
# Rigid legs only stay planted if the body and the legs move on exactly the
# same frames. `sample` turns sparse pose keys into a pose per frame (eased
# like the export eases one-shots: each stroke between turning points lingers
# a little at its ends; the stroke into the impact accelerates), and `Planter`
# then solves each planted leg's swing per frame so its sole stays where it
# was put, and lifts or lowers the body so the planted feet sit on the floor.
# Key the result with `per_frame` and Clip(ease=0.0): the timing is already
# baked in.

import numpy as np  # noqa: E402


def rmat(deg):
    """XYZ euler degrees -> matrix (as the export reads clip rotations)."""
    x, y, w = (math.radians(v) for v in deg)
    rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(w), -math.sin(w), 0], [math.sin(w), math.cos(w), 0], [0, 0, 1]])
    return rz @ ry @ rx


REST = {"rot": (0.0, 0.0, 0.0), "loc": (0.0, 0.0, 0.0), "scale": (1.0, 1.0, 1.0)}


def _turns(frames, vals):
    out = {frames[0], frames[-1]}
    for i in range(1, len(frames) - 1):
        if float(np.dot(vals[i] - vals[i - 1], vals[i + 1] - vals[i])) <= 1e-12:
            out.add(frames[i])
    return out


def sample(spec: dict, last: int, impact: int | None = None, ease: float = 0.3, power: float = 2.0) -> dict:
    """spec {part: {chan: [(frame, (x, y, z)), ...]}} -> {part: {chan:
    [np.array per frame 0..last]}}. A part's channels share stroke bounds.
    power: how hard the stroke into the impact accelerates (2 arrives at twice
    its mean speed, 3 at three times)."""
    out = {}
    for part, chans in spec.items():
        prep, bounds = {}, set()
        for ch, ks in chans.items():
            ks = sorted(ks, key=lambda k: k[0])
            fr = [int(round(k[0])) for k in ks]
            vals = [np.array(k[1], dtype=float) for k in ks]
            if fr[0] > 0:
                fr.insert(0, 0)
                vals.insert(0, np.array(REST[ch]))
            if fr[-1] < last:
                fr.append(last)
                vals.append(vals[-1].copy())
            bounds |= _turns(fr, vals)
            prep[ch] = (fr, vals)
        b = sorted(bounds)
        out[part] = {}
        for ch, (fr, vals) in prep.items():
            seq = []
            for f in range(last + 1):
                t = float(f)
                for a, c in zip(b, b[1:]):
                    if a <= f <= c:
                        u = (f - a) / (c - a)
                        w = u ** power if c == impact else (1 - ease) * u + ease * u * u * (3 - 2 * u)
                        t = a + w * (c - a)
                        break
                for (f0, v0), (f1, v1) in zip(zip(fr, vals), zip(fr[1:], vals[1:])):
                    if f0 <= t <= f1:
                        seq.append(v0 + (v1 - v0) * ((t - f0) / max(1e-9, f1 - f0)))
                        break
                else:
                    seq.append(vals[-1].copy())
            out[part][ch] = seq
    return out


def per_frame(samples: dict) -> dict:
    """Per-frame samples -> clip keys (one key a frame)."""
    return {part: {ch: [(i * F, tuple(float(v) for v in val)) for i, val in enumerate(seq)] for ch, seq in chans.items()}
            for part, chans in samples.items()}


def _positions(root):
    pos = {}

    def walk(p, acc):
        here = acc + np.array(p.at, dtype=float)
        pos[p.name] = here
        for c in p.children:
            walk(c, here)
    walk(root, np.zeros(3))
    return pos


def _soles(part, below: float | None = None):
    """Bottom corners of every voxel column of a part, relative to its pivot
    (only columns whose bottom is under `below`, if given)."""
    a = part.grid.a
    occ = a > 0
    if below is None:
        # every corner of every voxel in the lowest third of the part (the
        # meshed true slopes, claws and toes poke past the column bottoms)
        xs, ys, zs = np.nonzero(occ)
        keep = ys <= ys.min() + max(6, (ys.max() - ys.min()) // 3)
        xs, ys, zs = xs[keep], ys[keep], zs[keep]
        base = np.stack([xs, ys, zs], axis=1).astype(float)
        corners = np.array([[dx, dy, dz] for dx in (0, 1) for dy in (0, 1) for dz in (0, 1)], dtype=float)
        pts = [(base[:, None, :] + corners[None]).reshape(-1, 3)]
        cut = ys.max() + 1.0
        for sol in getattr(part.grid, "solids", []):  # the meshed prisms' own corners (thin claws can miss every voxel centre)
            ai = "xyz".index(sol.axis)
            ui, vi = {"x": (1, 2), "y": (0, 2), "z": (0, 1)}[sol.axis]
            for t, poly in ((sol.lo, sol.poly), (sol.hi, sol.upper)):
                for u, v in poly:
                    q = [0.0, 0.0, 0.0]
                    q[ai], q[ui], q[vi] = t, u, v
                    if q[1] <= cut:
                        pts.append(np.array([q]))
        return np.unique(np.concatenate(pts), axis=0) - np.array(part.pivot, dtype=float)
    has = occ.any(axis=1)
    ymin = np.argmax(occ, axis=1).astype(float)
    xs, zs = np.nonzero(has)
    ys = ymin[xs, zs]
    if below is not None:
        keep = ys < below
        xs, zs, ys = xs[keep], zs[keep], ys[keep]
    pts = []
    for dx in (0.0, 1.0):
        for dz in (0.0, 1.0):
            pts.append(np.stack([xs + dx, ys, zs + dz], axis=1))
    return np.concatenate(pts) - np.array(part.pivot, dtype=float)


class Planter:
    """Planted feet for one body part with rigid leg children.

    root: the part tree; body: the part the legs hang from (may be the
    root); legs: leg part names; fixed: extra floor contacts that are part
    of the body itself (e.g. paws modelled in the body grid), as a height in
    body-grid voxels under which the body's columns count as feet."""

    def __init__(self, root, body: str, legs, fixed: float | None = None, top: str | None = None):
        parts = {p.name: p for p in root.walk()}
        pos = _positions(root)
        self.body, self.legs, self.top = body, list(legs), top
        self.B = pos[body]
        self.H = {n: pos[n] - self.B for n in self.legs}
        self.pts = {n: _soles(parts[n]) for n in self.legs}
        self.sole = {}
        for n in self.legs:
            p = self.pts[n]
            lo = p[:, 1].min()
            self.sole[n] = p[p[:, 1] < lo + 1.5].mean(axis=0)
        self.fixed = _soles(parts[body], fixed) if fixed is not None else None
        self.rest = {n: self._world(n, np.zeros(3), np.zeros(3), np.ones(3), np.zeros(3), None)[1] for n in self.legs}

    def _fixed_low(self, loc, rot, sc, top):
        """Lowest point of the body's own floor contacts (0 if it has none)."""
        if self.fixed is None:
            return 0.0
        tl, tm = top
        m = rmat(rot) @ np.diag(sc)
        p = tl + (tm @ (self.B + loc + (m @ self.fixed.T).T).T).T
        return p[:, 1].min()

    def _frame(self, s, f, part, ch):
        try:
            return s[part][ch][f]
        except KeyError:
            return np.array(REST[ch])

    def _top(self, s, f):
        if self.top is None:
            return np.zeros(3), np.eye(3)
        return self._frame(s, f, self.top, "loc"), rmat(self._frame(s, f, self.top, "rot")) @ np.diag(self._frame(s, f, self.top, "scale"))

    def _world(self, n, loc, rot, scale, leg_rot, top, leg_scale=None):
        """(lowest y of leg n, world position of its sole centre)."""
        tl, tm = top if top is not None else (np.zeros(3), np.eye(3))
        m = rmat(rot) @ np.diag(scale)
        r = rmat(leg_rot) if leg_scale is None else rmat(leg_rot) @ np.diag(leg_scale)
        base = self.B + loc + m @ self.H[n]
        pts = (base + (m @ (r @ self.pts[n].T)).T)
        sole = base + m @ (r @ self.sole[n])
        pts = tl + (tm @ pts.T).T
        sole = tl + tm @ sole
        return pts[:, 1].min(), sole

    def solve(self, s: dict, last: int, planted: dict, anchors: dict | None = None, lift=None):
        """Rewrite s in place. planted {leg: [(frame, weight), ...]} (linear
        between keys, 0 = free as keyed, 1 = planted); anchors {leg: [(frame,
        dz), ...]} where the sole is planted, as a z offset from its rest spot
        (held between keys: a step moves it). lift [(frame, weight), ...]:
        how much the body is set down onto (or lifted off) the floor by the
        planted feet (default: the strongest planted weight); 0 lets a keyed
        pop leave the floor while the soles still keep their spot."""
        anchors = anchors or {}

        def weight(rows, f):
            for (f0, w0), (f1, w1) in zip(rows, rows[1:]):
                if f0 <= f <= f1:
                    return w0 + (w1 - w0) * (f - f0) / max(1, f1 - f0)
            return rows[-1][1] if f > rows[-1][0] else rows[0][1]

        captured = {}

        def anchor(n, f):
            """(target z, touch?) for leg n at frame f. A row value of
            "touch" sets the foot down on the floor at that frame (its swing
            solved for height) and keeps that spot until the next row."""
            rows = anchors.get(n, [(0, 0.0)])
            row = rows[0]
            for r in rows:
                if f >= r[0]:
                    row = r
            if row[1] == "touch":
                if row[0] == f or (n, row[0]) not in captured:
                    return None, row[0]
                return captured[(n, row[0])], row[0]
            return self.rest[n][2] + row[1], None

        s.setdefault(self.body, {}).setdefault("loc", [np.zeros(3) for _ in range(last + 1)])
        for n in self.legs:
            s.setdefault(n, {}).setdefault("rot", [np.zeros(3) for _ in range(last + 1)])
        world0 = self._world
        for f in range(last + 1):
            # a leg keyed with a scale (stretched to reach) is measured stretched
            self._world = lambda n, lc, rt, sc_, lr, tp, _f=f, _s=s: world0(n, lc, rt, sc_, lr, tp, _s[n]["scale"][_f] if "scale" in _s.get(n, {}) else None)
            loc = self._frame(s, f, self.body, "loc").copy()
            rot = self._frame(s, f, self.body, "rot")
            sc = self._frame(s, f, self.body, "scale")
            top = self._top(s, f)
            lows, wsum = [], 0.0
            for n in self.legs:
                w = weight(planted.get(n, [(0, 0.0)]), f)
                keyed = s[n]["rot"][f].copy()
                target, touch = anchor(n, f) if w > 0 else (None, None)
                if w > 0 and target is None:
                    # set it down: the swing nearest the keyed one that puts the sole on the floor
                    floor = self._fixed_low(loc, rot, sc, top)
                    best = None
                    for d in np.arange(0.0, 70.0, 0.5):
                        for a in (keyed[0] - d, keyed[0] + d):
                            if self._world(n, loc, rot, sc, (a, keyed[1], keyed[2]), top)[0] <= floor:
                                best = a
                                break
                        if best is not None:
                            break
                    keyed[0] = keyed[0] if best is None else best
                    captured[(n, touch)] = self._world(n, loc, rot, sc, keyed, top)[1][2]
                    s[n]["rot"][f] = keyed
                    lows.append((self._world(n, loc, rot, sc, keyed, top)[0], w))
                elif w > 0:
                    lo_a, hi_a = keyed[0] - 85.0, keyed[0] + 85.0
                    zl = self._world(n, loc, rot, sc, (lo_a, keyed[1], keyed[2]), top)[1][2]
                    zh = self._world(n, loc, rot, sc, (hi_a, keyed[1], keyed[2]), top)[1][2]
                    inc = zh > zl
                    for _ in range(50):
                        mid = (lo_a + hi_a) / 2
                        z = self._world(n, loc, rot, sc, (mid, keyed[1], keyed[2]), top)[1][2]
                        if (z < target) == inc:
                            lo_a = mid
                        else:
                            hi_a = mid
                    solved = (lo_a + hi_a) / 2
                    keyed[0] = keyed[0] * (1 - w) + solved * w
                    s[n]["rot"][f] = keyed
                    lows.append((self._world(n, loc, rot, sc, keyed, top)[0], w))
            if self.fixed is not None:
                tl, tm = top
                m = rmat(rot) @ np.diag(sc)
                p = tl + (tm @ (self.B + loc + (m @ self.fixed.T).T).T).T
                lows.append((p[:, 1].min(), 1.0))
            if lows:
                lowest = min(lo for lo, _ in lows)
                w = weight(lift, f) if lift else max(w for _, w in lows)
                ty = top[1][1, 1] if self.top is not None else 1.0
                loc[1] -= w * lowest / ty
                s[self.body]["loc"][f] = loc
                if w > 0.99:
                    self._reach(s, f, loc, rot, sc, top, ty, [n for n in self.legs if weight(planted.get(n, [(0, 0.0)]), f) > 0.99])
        self._world = world0
        return s

    def _reach(self, s, f, loc, rot, sc, top, ty, legs):
        """Rigid legs solved for their spot alone can leave some feet hanging
        (a pitched or swung body puts the hips at different heights). Put
        every fully planted foot ON the floor: lower the body if a leg could
        not reach even straight down (unless the body has its own floor
        contacts), then swing each leg the least that sets its sole at 0,
        accepting a small slide of the spot."""
        if not legs:
            return

        def low(n, a, lc):
            k = s[n]["rot"][f]
            return self._world(n, lc, rot, sc, (a, k[1], k[2]), top)[0]

        def deepest(n, lc):
            k0 = s[n]["rot"][f][0]
            grid = np.arange(k0 - 70.0, k0 + 70.1, 2.0)
            vals = [low(n, a, lc) for a in grid]
            i = int(np.argmin(vals))
            lo_a, hi_a = grid[max(0, i - 1)], grid[min(len(grid) - 1, i + 1)]
            for _ in range(20):  # golden-ish refine of the straight-down swing
                m1, m2 = lo_a + (hi_a - lo_a) / 3, hi_a - (hi_a - lo_a) / 3
                if low(n, m1, lc) < low(n, m2, lc):
                    hi_a = m2
                else:
                    lo_a = m1
            a = (lo_a + hi_a) / 2
            return a, low(n, a, lc)

        if self.fixed is None:
            need = max(deepest(n, loc)[1] for n in legs)
            if need > 0.05:
                loc[1] -= need / ty
                s[self.body]["loc"][f] = loc
        for n in legs:
            k = s[n]["rot"][f].copy()
            a0 = k[0]
            h0 = low(n, a0, loc)
            if abs(h0) < 0.08:
                continue
            av, hv = deepest(n, loc)
            if h0 > 0:  # hanging: swing toward straight down until it touches
                if hv > 0:
                    k[0] = av
                else:
                    lo_a, hi_a = a0, av
                    for _ in range(30):
                        m = (lo_a + hi_a) / 2
                        if low(n, m, loc) > 0:
                            lo_a = m
                        else:
                            hi_a = m
                    k[0] = (lo_a + hi_a) / 2
            else:  # digging in: swing away from straight down until it clears
                step = 1.0 if a0 >= av else -1.0
                a1 = a0
                for _ in range(60):
                    a1 += step
                    if low(n, a1, loc) >= 0:
                        break
                lo_a, hi_a = a0, a1
                for _ in range(30):
                    m = (lo_a + hi_a) / 2
                    if low(n, m, loc) < 0:
                        lo_a = m
                    else:
                        hi_a = m
                k[0] = (lo_a + hi_a) / 2
            s[n]["rot"][f] = k


def bake(clip: dict, impact_frame: int | None = None, planter: Planter | None = None, planted: dict | None = None, anchors: dict | None = None,
         lift=None, ease: float = 0.3) -> dict:
    """Clip keys in seconds -> per-frame keys with the feet planted (see
    `Planter`). Use the result with Clip(ease=0.0)."""
    spec = {part: {ch: [(round(t / F), v) for t, v in ks] for ch, ks in chans.items()} for part, chans in clip.items()}
    last = max(fr for chans in spec.values() for ks in chans.values() for fr, _ in ks)
    smp = sample(spec, last, impact_frame, ease)
    if planter is not None and planted is not None:
        planter.solve(smp, last, planted, anchors, lift=lift)
    return per_frame(smp)
