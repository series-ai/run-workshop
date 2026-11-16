"""Shared reaction keys for the five apocalypse zombies (walker, runner,
crawler, soldier, bloated).

`hit_body` is the shove-and-pop: the blow lands on frame 0, the body is
thrown back (+Z, the zombies face -Z) at once, most of the push in the
first 2 frames, and pops up on a short gravity arc that peaks at frame 4
and lands by frame 8. The lean back pivots on the heels (and the sway
forward past rest on the toes), so the feet stay on the floor instead of
digging in. The push keeps drifting through a short beat, then the body
recovers with weight: it sways forward past rest and settles.

`lag` keys a loose part (head, arms, a rifle) that lags at the blow,
whips past a beat later and settles last.

`pin_rest` keys a death's landing and resting pose at the floor (a copy
of the approach in `_react.pin_rest`, kept here so the zombies don't
depend on a module other helpers are editing).
"""
import math

F = 1 / 30


def _t(k: float, slow: float) -> float:
    return round(k * slow) * F


def _sample(keys, t: float):
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            return tuple(a + (b - a) * f for a, b in zip(v0, v1))
    return keys[-1][1]


def pivot_x(rot, loc, heel: float, toe: float, y0: float = 0.0):
    """Add to `loc` what keeps a pitch (rot x, degrees) of the root pivoting
    on the heels (lean back, rot x > 0) or the toes (lean forward), instead
    of about the root origin. `heel`/`toe` are the z of the back of the heels
    and the front of the toes from the root origin, in voxels (heel > 0,
    toe < 0). `y0` is the pivot height above the root origin (0: the floor).
    Returns new loc keys on the union of both key times."""
    times = sorted({t for t, _ in rot} | {t for t, _ in loc})
    # where the pitch crosses upright the pivot jumps from heel to toe, so
    # key every frame across each crossing to keep the feet on the floor
    extra = set()
    for (t0, v0), (t1, v1) in zip(rot, rot[1:]):
        if v0[0] * v1[0] < 0:
            extra |= {round(t0 / F + k) * F for k in range(1, round((t1 - t0) / F))}
    times = sorted(set(times) | extra)
    out = []
    for t in times:
        th = math.radians(_sample(rot, t)[0])
        zh = heel if th > 0 else toe
        x, y, z = _sample(loc, t)
        dy = y0 - (y0 * math.cos(th) - zh * math.sin(th))
        dz = zh - (y0 * math.sin(th) + zh * math.cos(th))
        out.append((float(t), (float(x), float(y + dy), float(z + dz))))
    return out


def hit_body(push: float = 2.5, pop: float = 1.2, lean: float = 10.0, side: float = 0.0, slow: float = 1.0,
             heel: float = 4.0, toe: float = -8.0, y0: float = 0.0, front: bool = False, past: float | None = None) -> dict:
    """loc/rot keys for the root of a zombie taking a blow from the front.
    `front` puts nearly all the shove and the rear-up into frames 1-2 and
    lets frames 3-6 drift (no second push). `past` (voxels) sways the body
    forward that far past rest around frames 17-19 before it settles."""
    t = lambda k: _t(k, slow)  # noqa: E731
    p, h, L = push, pop, lean
    if front:
        head = [(0, (0, 0, 0)), (t(1), (side * 0.4, h * 0.5, p * 0.72)), (t(2), (side * 0.55, h * 0.8, p * 0.92)), (t(4), (side * 0.65, h, p * 1.0)),
                (t(6), (side * 0.7, h * 0.72, p * 1.04)), (t(8), (side * 0.7, 0, p * 1.07)), (t(12), (side * 0.5, 0, p * 0.95))]
        # a twist (y) but only a slight roll (z), so the trailing foot doesn't hang off the floor
        rhead = [(0, (0, 0, 0)), (t(1), (L * 0.75, side * L * 0.35, -side * L * 0.12)), (t(2), (L, side * L * 0.55, -side * L * 0.15)),
                 (t(4), (L * 1.05, side * L * 0.65, -side * L * 0.15)), (t(7), (L * 1.1, side * L * 0.7, -side * L * 0.08)), (t(11), (L * 0.6, side * L * 0.4, -side * L * 0.03))]
    else:
        head = [(0, (0, 0, 0)), (t(1), (side * 0.3, h * 0.45, p * 0.58)), (t(2), (side * 0.45, h * 0.75, p * 0.82)), (t(4), (side * 0.6, h, p * 0.98)),
                (t(6), (side * 0.7, h * 0.72, p * 1.05)), (t(8), (side * 0.7, 0, p * 1.1)), (t(12), (side * 0.5, 0, p * 1.0))]
        rhead = [(0, (0, 0, 0)), (t(1), (L * 0.5, side * L * 0.25, -side * L * 0.2)), (t(2), (L * 0.8, side * L * 0.4, -side * L * 0.3)), (t(4), (L, side * L * 0.6, -side * L * 0.4)),
                 (t(7), (L * 1.1, side * L * 0.7, -side * L * 0.45)), (t(11), (L * 0.6, side * L * 0.4, -side * L * 0.2))]
    if past is None:
        tail = [(t(17), (side * 0.15, 0, p * 0.35)), (t(21), (0, 0, -p * 0.08)), (t(26), (0, 0, 0))]
        rtail = [(t(16), (-L * 0.28, 0, side * L * 0.08)), (t(21), (L * 0.07, 0, 0)), (t(26), (0, 0, 0))]
    else:
        tail = [(t(15), (side * 0.15, 0, p * 0.15)), (t(18), (0, 0, -past)), (t(23), (0, 0, past * 0.2)), (t(28), (0, 0, 0))]
        rtail = [(t(16), (-L * 0.2, 0, side * L * 0.08)), (t(19), (-L * 0.25, 0, 0)), (t(24), (L * 0.06, 0, 0)), (t(28), (0, 0, 0))]
    loc = [(float(a), tuple(float(c) for c in v)) for a, v in head + tail]
    rot = [(float(a), tuple(float(c) for c in v)) for a, v in rhead + rtail]
    return {"loc": pivot_x(rot, loc, heel, toe, y0), "rot": rot}


def lag(amp=(14.0, 0.0, 0.0), slow: float = 1.0, delay: int = 1) -> list:
    """rot keys for a loose part: it lags at the blow, whips past the body
    a beat later, swings back and settles last."""
    t = lambda k: _t(k + delay, slow)  # noqa: E731
    ax, ay, az = amp
    out = [(0.0, (0.0, 0.0, 0.0)), (t(2), (-ax * 0.3, -ay * 0.3, -az * 0.3)), (t(5), (ax, ay, az)), (t(9), (ax * 0.35, ay * 0.35, az * 0.35)),
           (t(14), (-ax * 0.35, -ay * 0.35, -az * 0.35)), (t(19), (ax * 0.12, ay * 0.12, az * 0.12)), (t(25), (0.0, 0.0, 0.0))]
    return [(float(a), tuple(float(c) for c in v)) for a, v in out]


def pin_rest(asset, clip_name: str = "death", part: str | None = None, trim: float = 0.0, spread: bool = False):
    """Key a death's landing at the floor: lift the body by what its final
    resting pose needs to sit on the ground, on every location key from the
    impact on, and drop the impact key onto the floor if a loose part that
    lands later holds it up. The exporter only corrects sinking frame by
    frame, so with this a keyed bounce really leaves the floor."""
    from _rep_creatures import lowest, sample

    clip = next(c for c in asset.clips if c.name == clip_name)
    part = part or asset.root.name
    end = max(k[-1][0] for ch in clip.keys.values() for k in ch.values())
    cache: dict = {}
    floor = lowest(asset.root, None, 0.0, cache)
    lift = max(0.0, floor - lowest(asset.root, clip, end, cache))
    imp = clip.impact or 0.0
    t0 = imp - 1e-6
    ch = clip.keys.setdefault(part, {})
    keys = sorted(ch.get("loc") or [(0.0, (0.0, 0.0, 0.0))], key=lambda k: k[0])
    if lift > 1e-6:
        if not any(t >= t0 for t, _ in keys):
            keys = keys + [(imp or end, keys[-1][1])]
        pre = imp - F
        if not spread and pre > 0 and not any(pre - 1e-6 <= t < t0 for t, _ in keys):
            keys.append((pre, tuple(float(c) for c in sample(keys, pre))))
            keys.sort(key=lambda k: k[0])
        keys = [(t, (v[0], v[1] + lift - trim, v[2]) if t >= t0 else v) for t, v in keys]
    ch["loc"] = keys
    if clip.impact is not None:
        over = lowest(asset.root, clip, imp, cache) - floor
        if over > 0.05:
            if not any(abs(t - imp) < 1e-6 for t, _ in ch["loc"]):
                ch["loc"].append((imp, tuple(float(c) for c in sample(ch["loc"], imp))))
                ch["loc"].sort(key=lambda k: k[0])
            ch["loc"] = [(t, (v[0], v[1] - over, v[2]) if abs(t - imp) < 1e-6 else v) for t, v in ch["loc"]]
    return asset


def fr(*rows) -> list:
    """Keys by whole frame: fr((frame, x, y, z), ...) -> [(seconds, (x, y, z))]."""
    return [(float(r[0]) * F, tuple(float(c) for c in r[1:])) for r in rows]
