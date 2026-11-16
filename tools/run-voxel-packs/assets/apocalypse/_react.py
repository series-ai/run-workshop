"""Shared hit-reaction keys for the apocalypse creatures.

A hit reads as a blow landing: the body is shoved back (+Z, the creatures
face -Z) at once and pops up in a short arc, drifts on a touch through a
short beat as it lands, then recovers with weight: it sways forward
past the rest pose and settles. Loose parts (heads, tails, wings) whip a
beat behind the body and settle last. `slow` stretches the timing for
heavy creatures; `side` adds a twist so the blow seems to come from one
side.
"""

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
