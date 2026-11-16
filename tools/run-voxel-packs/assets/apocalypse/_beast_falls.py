"""Hit-reaction and death-landing keys for the apocalypse four-legged
beasts (mutant boar, mutant cow, mutant dog, rad rat, sewer croc).

A private copy of the shared `_react` keys, so work on that module cannot
shift these creatures. A hit reads as a blow landing: the body is shoved
back (+Z, the creatures face -Z) at once and pops up in a short arc,
drifts on through a short beat as it lands, then recovers with weight past
rest and settles. Loose parts whip a beat behind. `pin_rest` keys a
death's landing and rest at the floor.
"""

import math

import numpy as np

from voxgrid import Clip

F = 1 / 30


def _t(k: float, slow: float) -> float:
    return round(k * slow) * F


def body(push: float = 2.5, pop: float = 1.0, lean: float = 12.0, side: float = 0.0, slow: float = 1.0) -> dict:
    """loc/rot keys for the part that carries the body (often the root).

    The blow lands on frame 0: the body is thrown back fast (most of the
    push in the first 2 frames), the pop is a short gravity arc that peaks
    about frame 4 and lands by frame 8, the push keeps drifting a little
    through the beat instead of freezing, then it recovers with weight:
    sways forward past rest and settles."""
    t = lambda k: _t(k, slow)  # noqa: E731
    loc = [(0, (0, 0, 0)), (t(2), (side * 0.4, pop * 0.75, push * 0.7)), (t(4), (side * 0.6, pop, push)), (t(6), (side * 0.7, pop * 0.6, push * 1.1)),
           (t(8), (side * 0.7, 0, push * 1.15)), (t(12), (side * 0.5, 0, push * 1.0)), (t(17), (0, 0, push * 0.35)), (t(21), (0, 0, -push * 0.05)), (t(26), (0, 0, 0))]
    rot = [(0, (0, 0, 0)), (t(2), (lean * 0.7, side * lean * 0.4, -side * lean * 0.3)), (t(4), (lean, side * lean * 0.6, -side * lean * 0.4)),
           (t(7), (lean * 1.1, side * lean * 0.7, -side * lean * 0.45)), (t(11), (lean * 0.6, side * lean * 0.4, -side * lean * 0.2)),
           (t(16), (-lean * 0.25, 0, side * lean * 0.08)), (t(21), (lean * 0.06, 0, 0)), (t(26), (0, 0, 0))]
    return {"loc": [(float(a), tuple(float(c) for c in v)) for a, v in loc],
            "rot": [(float(a), tuple(float(c) for c in v)) for a, v in rot]}


def lag(amp=(14.0, 0.0, 0.0), slow: float = 1.0, delay: int = 1) -> list:
    """rot keys for a loose part: it lags at the blow, whips past the body
    a beat later, swings back and settles last."""
    t = lambda k: _t(k + delay, slow)  # noqa: E731
    ax, ay, az = amp
    out = [(0.0, (0.0, 0.0, 0.0)), (t(2), (-ax * 0.3, -ay * 0.3, -az * 0.3)), (t(5), (ax, ay, az)), (t(9), (ax * 0.35, ay * 0.35, az * 0.35)),
           (t(14), (-ax * 0.35, -ay * 0.35, -az * 0.35)), (t(19), (ax * 0.12, ay * 0.12, az * 0.12)), (t(25), (0.0, 0.0, 0.0))]
    return [(float(a), tuple(float(c) for c in v)) for a, v in out]


def pin_rest(asset, clip_name: str = "death", part: str | None = None):
    """Key a death's landing at the floor: lift the body by what its final
    resting pose needs to sit on the ground (no sinking, no floating), on
    every location key from the impact on. The exporter only corrects
    sinking frame by frame, so without this a keyed bounce is eaten by the
    correction; with it the rest pose touches the floor and a bounce keyed
    on top really leaves it. `part` is the part whose loc carries the body
    (the root by default)."""
    from _rep_creatures import lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    part = part or asset.root.name
    end = max(k[-1][0] for ch in clip.keys.values() for k in ch.values())
    cache: dict = {}
    floor = lowest(asset.root, None, 0.0, cache)
    lift = max(0.0, floor - lowest(asset.root, clip, end, cache))
    if lift <= 1e-6:
        return asset
    from _rep_creatures import sample

    imp = clip.impact or 0.0
    t0 = imp - 1e-6
    ch = clip.keys.setdefault(part, {})
    keys = sorted(ch.get("loc") or [(0.0, (0.0, 0.0, 0.0))], key=lambda k: k[0])
    if not any(t >= t0 for t, _ in keys):
        keys = keys + [(imp or end, keys[-1][1])]
    # Hold the unlifted fall up to one frame before the impact, so the body
    # does not rise off the floor while it topples; the lift lands with it.
    pre = imp - F
    if pre > 0 and not any(pre - 1e-6 <= t < t0 for t, _ in keys):
        keys.append((pre, tuple(float(c) for c in sample(keys, pre))))
        keys.sort(key=lambda k: k[0])
    ch["loc"] = [(t, (v[0], v[1] + lift, v[2]) if t >= t0 else v) for t, v in keys]
    # The thud frame must touch the floor too: if the landing pose sits
    # higher than the rest pose (a loose part that lands later ends up
    # lowest), drop the body onto the floor on the impact key.
    if clip.impact is not None:
        over = lowest(asset.root, clip, imp, cache) - floor
        if over > 0.05:
            if not any(abs(t - imp) < 1e-6 for t, _ in ch["loc"]):
                ch["loc"].append((imp, tuple(float(c) for c in sample(ch["loc"], imp))))
                ch["loc"].sort(key=lambda k: k[0])
            ch["loc"] = [(t, (v[0], v[1] - over, v[2]) if abs(t - imp) < 1e-6 else v) for t, v in ch["loc"]]
    return asset


# ------------------------------------------------------------------ floor tracking
def _dense(keys, n: int, impact: int | None, kick: bool) -> list:
    """One key a frame (0..n) through [(seconds, (x, y, z)), ...].

    Each span is a cubic Hermite with clamped tangents (flat where a value
    turns or holds, Catmull-Rom elsewhere), close to the exporter's Bezier
    keys. The span into the impact frame keeps its incoming speed and
    arrives at twice its mean speed, then stops hard (as export.snap_impact
    does). `kick`: the first span leaves its key at speed (a blow)."""
    keys = sorted(keys, key=lambda k: k[0])
    ts = [k[0] * 30 for k in keys]
    vs = [tuple(float(c) for c in k[1]) for k in keys]
    if ts[-1] < n:
        ts.append(float(n))
        vs.append(vs[-1])
    m = len(ts)
    tan = [[0.0, 0.0, 0.0] for _ in range(m)]
    for i in range(m):
        for c in range(3):
            if 0 < i < m - 1:
                d0 = vs[i][c] - vs[i - 1][c]
                d1 = vs[i + 1][c] - vs[i][c]
                if d0 * d1 > 0:
                    s = (vs[i + 1][c] - vs[i - 1][c]) / (ts[i + 1] - ts[i - 1])
                    lim = 3 * min(abs(d0) / (ts[i] - ts[i - 1]), abs(d1) / (ts[i + 1] - ts[i]))
                    tan[i][c] = max(-lim, min(lim, s))
            elif i == 0 and kick and m > 1:
                tan[i][c] = 2 * (vs[1][c] - vs[0][c]) / (ts[1] - ts[0])
    tin = [list(t) for t in tan]  # the tangent arriving at each key
    if impact is not None:
        for i in range(1, m):
            if abs(ts[i] - impact) < 1e-3:
                for c in range(3):
                    tin[i][c] = 2 * (vs[i][c] - vs[i - 1][c]) / (ts[i] - ts[i - 1])
                    tan[i][c] = 0.0
    out = []
    for f in range(n + 1):
        if f <= ts[0]:
            out.append((f / 30, vs[0]))
            continue
        i = next((j for j in range(1, m) if f <= ts[j] + 1e-9), m - 1)
        t0, t1 = ts[i - 1], ts[i]
        h = t1 - t0
        u = 0.0 if h <= 0 else min(1.0, (f - t0) / h)
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        m0 = tan[i - 1]
        m1 = tin[i]
        out.append((f / 30, tuple(h00 * vs[i - 1][c] + h10 * h * m0[c] + h01 * vs[i][c] + h11 * h * m1[c] for c in range(3))))
    return out


def track_floor(asset, clip_name: str, air=None, kick: bool = False, report: bool = False):
    """Key a one-shot on every frame and set the root's height so the lowest
    point of the rig sits exactly at floor + air(frame) on every frame:
    nothing sinks and nothing floats. `air` (frame -> voxels, default 0)
    keys the deliberate lifts: a hit's pop arc, a death's bounce. The clip
    is then exported as keyed (ease 0): the spans already ease at their
    turning points and accelerate into the impact."""
    from _rep_creatures import lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    end = max(k[-1][0] for ch in clip.keys.values() for k in ch.values())
    n = round(end * 30)
    imp = round(clip.impact * 30) if clip.impact is not None else None
    dense = {p: {ch: _dense(k, n, imp, kick) for ch, k in chans.items()} for p, chans in clip.keys.items()}
    root = asset.root.name
    dense.setdefault(root, {}).setdefault("loc", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
    cache: dict = {}
    floor = lowest(asset.root, None, 0.0, cache)
    posed = Clip(clip.name, dense, False)
    fix = []
    for f in range(n + 1):
        want = floor + (air(f) if air else 0.0)
        d = want - lowest(asset.root, posed, f / 30, cache)
        t, v = dense[root]["loc"][f]
        dense[root]["loc"][f] = (t, (v[0], v[1] + d, v[2]))
        fix.append(d)
    clip.keys = dense
    clip.ease = 0.0
    if report:
        print(f"TRACK {asset.id} {clip_name}", " ".join(f"{f}:{d:+.2f}" for f, d in enumerate(fix)))
    return asset


def arc(peak: float, up: int, down: int, start: int = 0):
    """A gravity arc as air(frame): leaves the floor at `start`, peaks
    `up` frames later at `peak`, lands `down` frames after that."""
    def air(f: int) -> float:
        k = f - start
        if k <= 0 or k >= up + down:
            return 0.0
        s = (k - up) / (up if k < up else down)
        return peak * (1 - s * s)
    return air


def pivot_roll(theta: float, px: float, py: float = 0.0) -> tuple:
    """loc (x, y) that turns a roll of `theta` degrees about the root's z
    axis into a roll about the point (px, py) of the root's x-y plane."""
    a = math.radians(theta)
    return (px - (px * math.cos(a) - py * math.sin(a)), py - (px * math.sin(a) + py * math.cos(a)))


# ------------------------------------------------------------------ planted feet
def _chain(root, name: str) -> list:
    """The parts from the root down to `name`."""
    def walk(p, path):
        path = path + [p]
        if p.name == name:
            return path
        for c in p.children:
            r = walk(c, path)
            if r:
                return r
        return None
    return walk(root, [])


def _pose(chain, keys: dict, f: int, override=None):
    """World matrix and origin of the last part of `chain` at frame f, from
    per-frame keys; `override` = (part, channel, value) replaces one value."""
    from _rep_creatures import euler

    M, o = np.eye(3), np.zeros(3)
    for p in chain:
        ch = keys.get(p.name, {})
        def val(c, d):
            if override and override[0] == p.name and override[1] == c:
                return np.asarray(override[2], dtype=float)
            return np.asarray(ch[c][f][1], dtype=float) if c in ch else np.asarray(d, dtype=float)
        loc = np.asarray(p.at, dtype=float) + val("loc", (0, 0, 0))
        R = euler(p.rot) @ euler(val("rot", (0, 0, 0)))
        if "scale" in ch:
            R = R @ np.diag(val("scale", (1, 1, 1)))
        o = o + M @ loc
        M = M @ R
    return M, o


def _foot(part) -> np.ndarray:
    """The sole of a leg in its pivot space: the mean of its lowest points."""
    from _rep_creatures import hull_points

    pts = hull_points(part)
    lo = pts[:, 1].min()
    return pts[pts[:, 1] < lo + 0.6].mean(axis=0)


def step_legs(asset, clip_name: str, steps: dict, axis: int = 0, kick: bool = False, report: bool = False):
    """Keep each listed leg's foot planted on the ground (in z, front-back)
    and step it where told: `steps` = {leg: [(lift_frame, plant_frame, dz,
    lift), ...]}. Between steps the foot holds its spot while the body moves
    over it (the leg's rotation about `axis` is solved every frame); during
    a step the foot travels to rest + dz with a smoothstep and lifts `lift`
    voxels on an arc (the leg's loc y), then plants. Keys the clip on every
    frame; call track_floor afterwards (it keeps the per-frame values)."""
    from _rep_creatures import lowest  # noqa: F401  (same import path as track_floor)

    clip = next(c for c in asset.clips if c.name == clip_name)
    end = max(k[-1][0] for ch in clip.keys.values() for k in ch.values())
    n = round(end * 30)
    imp = round(clip.impact * 30) if clip.impact is not None else None
    dense = {p: {ch: _dense(k, n, imp, kick) for ch, k in chans.items()} for p, chans in clip.keys.items()}
    for leg, plan in steps.items():
        chain = _chain(asset.root, leg)
        part = chain[-1]
        sole = _foot(part)
        M0, o0 = _pose(chain, {}, 0)
        z0 = float((M0 @ sole + o0)[2])
        ch = dense.setdefault(leg, {})
        ch.setdefault("rot", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
        ch.setdefault("loc", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
        plan = sorted(plan)
        errs = []
        for f in range(n + 1):
            dz, lift, prev = 0.0, 0.0, 0.0
            for a, b, d, h in plan:
                if f >= b:
                    dz = prev = d
                elif f > a:
                    u = (f - a) / (b - a)
                    s = u * u * (3 - 2 * u)
                    dz = prev + (d - prev) * s
                    lift = h * math.sin(math.pi * u)
                    break
                else:
                    dz = prev
                    break
            t, lv = ch["loc"][f]
            ch["loc"][f] = (t, (lv[0], lv[1] + lift, lv[2]))
            want = z0 + dz
            r = list(ch["rot"][f][1])

            def zf(ang):
                rr = list(r)
                rr[axis] = ang
                M, o = _pose(chain, dense, f, (leg, "rot", rr))
                return float((M @ sole + o)[2])
            ang = r[axis]
            for _ in range(12):
                e = zf(ang) - want
                if abs(e) < 1e-3:
                    break
                d = (zf(ang + 0.5) - zf(ang - 0.5)) / 1.0
                if abs(d) < 1e-6:
                    break
                ang -= max(-15.0, min(15.0, e / d))
            r[axis] = ang
            ch["rot"][f] = (ch["rot"][f][0], tuple(r))
            errs.append(zf(ang) - want)
        if report:
            print(f"STEP {asset.id} {clip_name} {leg} maxerr {max(abs(e) for e in errs):.2f}",
                  " ".join(f"{f}:{ch['rot'][f][1][axis]:.0f}" + (f"!{errs[f]:+.1f}" if abs(errs[f]) > 0.3 else "") for f in range(n + 1)))
    clip.keys = dense
    return asset


def foot_report(asset, clip_name: str, legs) -> None:
    """Print each leg's lowest point per frame above the rest floor (after
    track_floor), so hovering or sinking planted feet show up."""
    from _rep_creatures import hull_points, lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    n = len(next(iter(next(iter(clip.keys.values())).values()))) - 1
    floor = lowest(asset.root, None, 0.0, {})
    for leg in legs:
        chain = _chain(asset.root, leg)
        pts = hull_points(chain[-1])
        hs = []
        for f in range(n + 1):
            M, o = _pose(chain, clip.keys, f)
            hs.append(float((pts @ M.T + o)[:, 1].min()) - floor)
        print(f"FEET {clip_name} {leg}", " ".join(f"{f}:{h:.1f}" for f, h in enumerate(hs)))


# ------------------------------------------------------------------ gait
def _leg_world(chain, keys, f, leg, rot=None, loc=None):
    """World points of a leg's hull at frame f, with its rot/loc replaced."""
    from _rep_creatures import hull_points

    over = keys[leg]
    saved = {c: over[c][f] for c in ("rot", "loc") if c in over}
    if rot is not None:
        over["rot"][f] = (saved["rot"][0], tuple(rot))
    if loc is not None:
        over["loc"][f] = (saved["loc"][0], tuple(loc))
    M, o = _pose(chain, keys, f)
    for c, v in saved.items():
        over[c][f] = v
    return hull_points(chain[-1]) @ M.T + o


def gait(asset, clip_name: str, legs: dict, stride: float, swing: float, body_y, axis: int = 0):
    """Key a looping gait on every frame. `legs` = {leg: (contact_frame,
    stance_frames)}: from contact the sole slides back (+z) at a steady rate
    over `stride` voxels while planted on the floor, then swings forward,
    lifted up to `swing` voxels at the crossing. `body_y(f)` keys the root's
    height. Each leg's rotation about `axis` is solved so its sole is at the
    wanted z, and its loc y so its lowest point sits on the floor (stance)
    or at the swing height: the leg sinks into the hip a little to show the
    body's weight landing, and reaches out at push-off."""
    from _rep_creatures import hull_points, lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    end = max(k[-1][0] for ch in clip.keys.values() for k in ch.values())
    n = round(end * 30)
    dense = {p: {ch: _dense(k, n, None, False) for ch, k in chans.items()} for p, chans in clip.keys.items()}
    root = asset.root.name
    rl = dense.setdefault(root, {}).setdefault("loc", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
    for f in range(n + 1):
        t, v = rl[f]
        rl[f] = (t, (v[0], body_y(f), v[2]))
    floor = lowest(asset.root, None, 0.0, {})
    for leg, (c0, S) in legs.items():
        chain = _chain(asset.root, leg)
        sole = _foot(chain[-1])
        pts = hull_points(chain[-1])
        M0, o0 = _pose(chain, {}, 0)
        z0 = float((M0 @ sole + o0)[2])
        ch = dense.setdefault(leg, {})
        ch.setdefault("rot", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
        ch.setdefault("loc", [(f / 30, (0.0, 0.0, 0.0)) for f in range(n + 1)])
        for f in range(n + 1):
            u = (f - c0) % n
            if u <= S:
                z = z0 - stride / 2 + stride * u / S
                h = 0.0
            else:
                w = (u - S) / (n - S)
                z = z0 + stride / 2 - stride * w * w * (3 - 2 * w)
                h = swing * math.sin(math.pi * w)
            r = list(ch["rot"][f][1])
            lv = list(ch["loc"][f][1])
            for _ in range(3):
                def zf(ang):
                    rr = list(r)
                    rr[axis] = ang
                    M, o = _pose(chain, dense, f, (leg, "rot", rr))
                    return float((M @ sole + o)[2])
                ang = r[axis]
                for _ in range(10):
                    e = zf(ang) - z
                    if abs(e) < 1e-3:
                        break
                    d = zf(ang + 0.5) - zf(ang - 0.5)
                    if abs(d) < 1e-6:
                        break
                    ang -= max(-15.0, min(15.0, e / d))
                r[axis] = ang
                ch["rot"][f] = (ch["rot"][f][0], tuple(r))
                low = float(_leg_world(chain, dense, f, leg)[:, 1].min()) - floor
                lv[1] += h - low
                ch["loc"][f] = (ch["loc"][f][0], tuple(lv))
    clip.keys = dense
    clip.ease = 0.0
    return asset


# ------------------------------------------------------------------ hits, round 2
def body2(push: float = 2.5, pop: float = 1.0, lean: float = 12.0, side: float = 0.0, slow: float = 1.0,
          over: float = 0.7, past: float = 6.0) -> dict:
    """Like body(), but the recovery carries real weight past rest: the
    body sways forward `over` voxels past the spot (about frame 20) and
    pitches `past` degrees nose-down past level (about frame 17), then
    settles back. The shove, the pop and the drifting beat are body()'s."""
    t = lambda k: _t(k, slow)  # noqa: E731
    loc = [(0, (0, 0, 0)), (t(2), (side * 0.4, pop * 0.75, push * 0.7)), (t(4), (side * 0.6, pop, push)), (t(6), (side * 0.7, pop * 0.6, push * 1.1)),
           (t(8), (side * 0.7, 0, push * 1.15)), (t(12), (side * 0.5, 0, push * 1.0)), (t(16), (side * 0.2, 0, push * 0.3)), (t(20), (0, 0, -over)),
           (t(24), (0, 0, over * 0.2)), (t(28), (0, 0, 0))]
    rot = [(0, (0, 0, 0)), (t(2), (lean * 0.7, side * lean * 0.4, -side * lean * 0.3)), (t(4), (lean, side * lean * 0.6, -side * lean * 0.4)),
           (t(7), (lean * 0.9, side * lean * 0.7, -side * lean * 0.45)), (t(11), (lean * 0.3, side * lean * 0.4, -side * lean * 0.2)),
           (t(17), (-past, 0, side * lean * 0.08)), (t(22), (past * 0.25, 0, 0)), (t(27), (0, 0, 0))]
    return {"loc": [(float(a), tuple(float(c) for c in v)) for a, v in loc],
            "rot": [(float(a), tuple(float(c) for c in v)) for a, v in rot]}


def hit_steps(push: float, front, hind, slow: float = 1.0, lift: float = 1.3, hind_lift: float | None = None, gap: int = 3) -> dict:
    """step_legs plans for a hit: the feet fly back with the body in the
    pop and land with it (f8), stay planted through the drift, then the
    front feet and then the hind feet step home with a lift, left and right
    `gap` frames apart (never both hind feet at once, which would buck)."""
    t = lambda k: round(k * slow)  # noqa: E731
    hl = lift * 0.6 if hind_lift is None else hind_lift
    plans = {}
    for i, leg in enumerate(front):
        plans[leg] = [(0, t(8), push * 1.15, 0.0), (t(11) + i * 2, t(15) + i * 2, 0.0, lift)]
    for i, leg in enumerate(hind):
        plans[leg] = [(0, t(8), push * 1.15, 0.0), (t(17) + i * gap, t(22) + i * gap, 0.0, hl + 0.7 * i)]  # the second foot steps once the nose-down sway has passed
    return plans


def clear_legs(asset, clip_name: str, legs, frames, clear, axis: int = 2, sign=None) -> None:
    """After track_floor: turn each leg about `axis` (the splay) so its
    lowest point sits `clear(frame)` voxels above the floor, on the given
    frames. The legs give way out from under the body but stay just off the
    floor, so they never prop the body and never fly up. `sign(leg)` is the
    splay direction (+1/-1) the solve keeps to."""
    from _rep_creatures import lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    floor = lowest(asset.root, None, 0.0, {})
    for leg in legs:
        chain = _chain(asset.root, leg)
        ch = clip.keys[leg]
        sg = sign(leg) if sign else 1.0
        for f in frames:
            r = list(ch["rot"][f][1])
            want = clear(f)

            def h(ang):
                rr = list(r)
                rr[axis] = ang
                return float(_leg_world(chain, clip.keys, f, leg, rot=rr)[:, 1].min()) - floor
            lo_a, hi_a = 0.0, 100.0 * sg  # bisection along the splay, from hanging to flat-out
            if h(lo_a) > want:  # even hanging straight down it can't reach: let it hang
                r[axis] = lo_a
                ch["rot"][f] = (ch["rot"][f][0], tuple(r))
                continue
            if h(hi_a) < want:
                continue
            for _ in range(30):
                mid = (lo_a + hi_a) / 2
                if (h(mid) - want) * (h(lo_a) - want) > 0:
                    lo_a = mid
                else:
                    hi_a = mid
            r[axis] = (lo_a + hi_a) / 2
            ch["rot"][f] = (ch["rot"][f][0], tuple(r))


def pin_feet(asset, clip_name: str, steps: dict, tol: float = 0.05) -> None:
    """After track_floor: a planted foot (between its steps in a step_legs
    plan) that hovers above the floor reaches down onto it (the leg's loc y),
    so planted really means planted."""
    from _rep_creatures import lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    floor = lowest(asset.root, None, 0.0, {})
    for leg, plan in steps.items():
        chain = _chain(asset.root, leg)
        ch = clip.keys[leg]
        n = len(ch["rot"]) - 1
        for f in range(n + 1):
            if any(a < f < b for a, b, _, _ in plan):
                continue
            h = float(_leg_world(chain, clip.keys, f, leg)[:, 1].min()) - floor
            if h > tol:
                t, v = ch["loc"][f]
                ch["loc"][f] = (t, (v[0], v[1] - h, v[2]))


def sink_on_legs(asset, clip_name: str, legs, f0: int, f1: int, axis: int = 2, sign=None, power: float = 2.0) -> None:
    """After track_floor: the body sinks from frame f0 into its landing at
    f1 on a gravity curve (slow, then fastest at contact), and the legs give
    way under it: each leg's splay is solved so it stays on the floor as
    the body comes down (where a leg can't reach, it is left as keyed)."""
    from _rep_creatures import lowest

    clip = next(c for c in asset.clips if c.name == clip_name)
    floor = lowest(asset.root, None, 0.0, {})
    rl = clip.keys[asset.root.name]["loc"]
    y0, y1 = rl[f0][1][1], rl[f1][1][1]
    for f in range(f0 + 1, f1):
        t, v = rl[f]
        rl[f] = (t, (v[0], y0 + (y1 - y0) * ((f - f0) / (f1 - f0)) ** power, v[2]))
    for leg in legs:
        chain = _chain(asset.root, leg)
        ch = clip.keys[leg]
        sg = sign(leg) if sign else 1.0
        for f in range(f0 + 1, f1):
            r = list(ch["rot"][f][1])

            def h(ang):
                rr = list(r)
                rr[axis] = ang
                return float(_leg_world(chain, clip.keys, f, leg, rot=rr)[:, 1].min()) - floor
            a0 = r[axis]
            if h(a0) >= 0:  # above the floor: splay back in (toward hanging) until it touches
                lo_, hi_ = a0, a0
                while abs(lo_) > 1e-6 and h(lo_) > 0 and abs(lo_ - a0) < 130:
                    lo_ -= 5.0 * sg
                if h(lo_) > 0:
                    continue
                inside, outside = lo_, hi_  # h(inside) <= 0 < h(outside)
            else:  # through the floor: splay out until it clears
                if h(100.0 * sg) < 0:
                    continue
                inside, outside = a0, 100.0 * sg
            for _ in range(30):
                mid = (inside + outside) / 2
                if h(mid) < 0:
                    inside = mid
                else:
                    outside = mid
            r[axis] = outside
            ch["rot"][f] = (ch["rot"][f][0], tuple(r))
    # Nothing may float: where no leg could reach, the body comes down to the floor.
    for f in range(f0 + 1, f1):
        low = lowest(asset.root, clip, f / 30, {}) - floor
        if low > 0.02:
            t, v = rl[f]
            rl[f] = (t, (v[0], v[1] - low, v[2]))


def smooth_root(asset, clip_name: str, frames, radius: int = 2) -> None:
    """After track_floor: smooth the root's height over `frames` from above
    (an upper envelope, then a soft blur that never dips below the tracked
    height), so the lowest point hopping between parts can't jitter the
    body; nothing sinks, a tucked limb may hover a little."""
    clip = next(c for c in asset.clips if c.name == clip_name)
    rl = clip.keys[asset.root.name]["loc"]
    n = len(rl) - 1
    ys = [v[1] for _, v in rl]
    env = [max(ys[max(0, f - radius):min(n, f + radius) + 1]) for f in range(n + 1)]
    blur = [(env[max(0, f - 1)] + 2 * env[f] + env[min(n, f + 1)]) / 4 for f in range(n + 1)]
    for f in frames:
        t, v = rl[f]
        rl[f] = (t, (v[0], max(ys[f], blur[f]), v[2]))
