"""Walk and trot `move` loops for rigid-leg creatures (one part per leg,
pivoting at the hip): imp, phantom knight, patchwork giant, bone hound and
mummy in the monster pack.

Every channel is keyed once per frame (play with ease=0), so contacts are
exact. A stance foot's forward offset from its hip slides back at a steady
ground speed (the leg angle is asin(offset / leg length)); the swing foot
comes forward on a cubic that leaves and lands at that same speed, lifted
off the floor. The root (hips/body) height is set every frame so the lowest
corner of the lowest stance sole sits exactly on the floor: with straight
legs it drops into each footfall, lowest at the double support.
Keys: rot x + swings the foot forward (toward -Z, the front).
"""
from __future__ import annotations

import math

FPS = 30


def fr(n: float) -> float:
    return n / FPS


def _swing(w: float, R: float, m: float) -> float:
    """The swing foot's forward offset, w 0-1: from -R to +R (Hermite),
    leaving and landing moving back at m (offset per unit w, negative)."""
    h00 = 2 * w ** 3 - 3 * w ** 2 + 1
    h10 = w ** 3 - 2 * w ** 2 + w
    h01 = -2 * w ** 3 + 3 * w ** 2
    h11 = w ** 3 - w ** 2
    return h00 * -R + h10 * m + h01 * R + h11 * m


def _low(theta: float, corners) -> float:
    """The lowest sole corner (dy, dz from the hip; dz + = behind) with the
    leg turned theta radians (+ = the foot forward)."""
    c, s = math.cos(theta), math.sin(theta)
    return min(dy * c - dz * s for dy, dz in corners)


def gait(P: int, stance: int, legs: dict, root: str, lift: float = 2.0, give: float = 0.0, slide: bool = False,
         lift_first: float = 0.6) -> tuple[dict, list[float], dict]:
    """A gait loop of P frames (one whole stride).

    legs: {name: (H, corners, phase, R)}: hip height above the sole, the
    sole's corners [(dy, dz), ...] from the hip pivot, the phase (0-1) at
    which the foot touches down, and the reach R (the foot's forward offset
    at touch-down; it lifts off at -R).
    slide: legs slide in and out of the body (loc y) so every stance foot
    touches the floor while the body keeps a smooth height (quadrupeds whose
    rigid paws roll heel to toe); `give` sinks the body at mid-stance and
    the legs slide in to match. Without slide, the root sits on the foot that touched down
    last (the trailing foot hands over in 2 frames, then its heel rises), and
    the swing leg lifts by sliding up `lift`.
    Returns (keys, root_y per frame, touch-down frames per leg)."""
    out = {name: {"rot": [], "loc": []} for name in legs}
    touch = {name: round(ph * P) % P for name, (_, _, ph, _) in legs.items()}
    per = []
    for f in range(P + 1):
        st = {}
        sw = {}
        for name, (H, corners, ph, R) in legs.items():
            p = (f - ph * P) % P
            v = 2 * R / stance  # ground speed per frame
            if p <= stance:
                F = R - v * p
                th = math.asin(max(-1.0, min(1.0, F / H)))
                st[name] = (th, -H - _low(th, corners), give * math.sin(math.pi * p / stance), p)  # root lift this foot needs
            else:
                S = P - stance
                w = (p - stance) / S
                F = _swing(w, R, -v * S)
                th = math.asin(max(-1.0, min(1.0, F / H)))
                sw[name] = (th, w, -H - _low(th, corners))
        if not st:
            y = None  # airborne: filled in below with a ballistic arc
        elif slide:
            y = -max(s[2] for s in st.values())  # + the mean need, below
        else:
            # the root rides the foot that touched down last; through the
            # double support the trailing foot (up on its toe) hands the
            # weight over in 2 frames and then rises off the floor (slides)
            lead = min(st.values(), key=lambda s: s[3])
            y_all = max(s[1] for s in st.values())
            y = lead[1] + (y_all - lead[1]) * max(0.0, 1.0 - lead[3] / 2.0)
        per.append([st, sw, y])
    if slide:
        # the body rides at the stance feet's mean height; each stance leg
        # slides in or out by what its own (rolling) paw needs
        needs = [n for st, _, _ in per[:P] for _, n, _, _ in st.values()]
        base = sum(needs) / len(needs)
        for row in per:
            if row[2] is not None:
                row[2] += base
    # Flight (no foot down, e.g. a trot's suspension): a parabola under
    # G 30 m/s^2 (750 voxels/s^2) from the lift-off height to the landing.
    g = 750.0 / FPS ** 2
    for f in range(P):
        if per[f][2] is not None or per[(f - 1) % P][2] is None:
            continue
        a = (f - 1) % P
        n = 1
        while per[(a + n) % P][2] is None:
            n += 1
        y0, y1 = per[a][2], per[(a + n) % P][2]
        for k in range(1, n):
            per[(a + k) % P][2] = y0 + (y1 - y0) * k / n + 0.5 * g * k * (n - k)
    per[P][2] = per[0][2]
    root_y = [y for _, _, y in per]
    slid = {name: {} for name in legs}  # stance slides per frame
    for f, (st, sw, y) in enumerate(per):
        for name, (th, need, _, _) in st.items():
            slid[name][f % P] = (need - y) if slide else max(0.0, need - y)
    for f, (st, sw, y) in enumerate(per):
        t = fr(f)
        for name, (th, need, _, _) in st.items():
            out[name]["rot"].append((t, (math.degrees(th), 0.0, 0.0)))
            out[name]["loc"].append((t, (0.0, slid[name][f % P], 0.0)))
        for name, (th, w, need) in sw.items():
            # from the lift-off slide to the touch-down slide, lifting fast
            # off the floor and never dipping below it
            a = b = f % P
            while a not in slid[name]:
                a = (a - 1) % P
            while b not in slid[name]:
                b = (b + 1) % P
            base = slid[name][a] + (slid[name][b] - slid[name][a]) * w
            up = lift * math.sin(math.pi * w) ** lift_first if w < 0.5 else lift * math.sin(math.pi * w)
            up = max(base + up, need - y + 0.4)
            out[name]["rot"].append((t, (math.degrees(th), 0.0, 0.0)))
            out[name]["loc"].append((t, (0.0, up, 0.0)))
    return out, root_y, touch


def sole_points(grid, pivot, below: float = 5.0) -> list[tuple[float, float]]:
    """(dy, dz) of every voxel corner within `below` of the floor in a leg's
    grid, from the hip pivot (x, y, z): the rigid sole's real outline."""
    import numpy as np
    idx = np.argwhere(grid.a > 0)
    idx = idx[idx[:, 1] < below]
    pts = set()
    for _, y, z in idx:
        for yy in (y, y + 1):
            for zz in (z, z + 1):
                pts.add((float(yy - pivot[1]), float(zz - pivot[2])))
    return sorted(pts)


def per_frame(P: int, fn) -> list:
    """Keys for every frame 0..P of fn(frame) -> (x, y, z), wrapping at P."""
    return [(fr(f), tuple(float(c) for c in fn(f % P))) for f in range(P + 1)]


def since(f: int, t0: int, P: int) -> int:
    """Frames since the touch-down at t0 (0..P-1)."""
    return (f - t0) % P


def accent(f: int, touches, P: int, shape) -> float:
    """Sum a per-footfall accent `shape` (a list indexed by frames since the
    touch-down) over every touch-down frame in `touches`."""
    total = 0.0
    for t0 in touches:
        d = since(f, t0, P)
        if d < len(shape):
            total += shape[d]
    return total


def wave(f: int, P: int, amp: float, cycles: float = 1.0, lag: float = 0.0) -> float:
    """A smooth swing for arms, tails and heads: amp * sin over the loop."""
    return amp * math.sin(2 * math.pi * cycles * (f - lag) / P)


# ------------------------------------------------------------------ creatures
# Each returns the `move` clip's keys (play it with Clip("move", keys, ease=0)).


def _merge(*dicts) -> dict:
    out: dict = {}
    for d in dicts:
        for part, chans in d.items():
            out.setdefault(part, {}).update(chans)
    return out


def phantom_knight_move() -> dict:
    """A heavy armoured march, 1.2 s (36 frames, two steps): straight plate
    legs, each heel striking with the body dropping onto it, the free arm
    swinging against its leg, the sword arm steady, the torso counter-turning,
    a dip in the armour after each footfall and the cape trailing."""
    P, ST = 36, 20
    sole = [(-20.0, -7.0), (-20.0, 3.0)]
    legs, root, touch = gait(P, ST, {"leg-l": (20.0, sole, 0.0, 6.0), "leg-r": (20.0, sole, 0.5, 6.0)}, "hips", lift=2.5)
    dip = [0.0, -0.6, -0.9, -0.6, -0.25]
    hits = list(touch.values())
    cyc = lambda f, lag=0.0: math.cos(2 * math.pi * (f - lag) / P)  # noqa: E731  1 with the left foot forward
    keys = {
        "hips": {"loc": per_frame(P, lambda f: (0, root[f], 0))},
        "torso": {"loc": per_frame(P, lambda f: (0, accent(f, hits, P, dip), 0)),
                  "rot": per_frame(P, lambda f: (-2.0, 4.0 * cyc(f, 1), 2.0 * math.cos(2 * math.pi * (f - 10) / P)))},
        "head": {"rot": per_frame(P, lambda f: (2.0 * accent(f, hits, P, [0, 0, 0.5, 1.0, 0.8, 0.4]), -3.0 * cyc(f, 2), 0))},
        "arm-l": {"rot": per_frame(P, lambda f: (-16.0 * cyc(f, 2), 0, 0))},
        "arm-r": {"rot": per_frame(P, lambda f: (5.0 * cyc(f, 2), 0, 0))},
        "cape": {"rot": per_frame(P, lambda f: (-8.0 - 3.0 * math.cos(4 * math.pi * (f - 4) / P), 0, 2.0 * cyc(f, 4)))},
    }
    return _merge(legs, keys)


def patchwork_giant_move() -> dict:
    """A thundering giant's walk, 1.6 s (48 frames, two steps): long heavy
    strides, the whole body dropping hard onto each heel (the torso sags a
    further 2 voxels on the frames after), weight rolling over the stance
    leg, the heavy left arm and the small right arm swinging against the
    legs, the head nodding a beat late."""
    P, ST = 48, 28
    sole = [(-25.0, -10.0), (-25.0, 6.5)]
    legs, root, touch = gait(P, ST, {"leg-l": (25.0, sole, 0.0, 6.5), "leg-r": (25.0, sole, 0.5, 6.5)}, "hips", lift=3.0)
    dip = [0.0, -1.6, -2.2, -1.7, -1.0, -0.4]
    hits = list(touch.values())
    cyc = lambda f, lag=0.0: math.cos(2 * math.pi * (f - lag) / P)  # noqa: E731
    keys = {
        "hips": {"loc": per_frame(P, lambda f: (0, root[f], 0))},
        "torso": {"loc": per_frame(P, lambda f: (0, accent(f, hits, P, dip), 0)),
                  "rot": per_frame(P, lambda f: (-3.0 + 1.5 * accent(f, hits, P, [0, -0.5, -1, -0.7, -0.3]), 5.0 * cyc(f, 2),
                                                 3.5 * math.cos(2 * math.pi * (f - 14) / P)))},
        "head": {"rot": per_frame(P, lambda f: (5.0 * accent(f, hits, P, [0, 0, 0.4, 1.0, 0.9, 0.5, 0.2]), -4.0 * cyc(f, 3), -2.0 * math.cos(2 * math.pi * (f - 18) / P)))},
        "arm-l": {"rot": per_frame(P, lambda f: (-12.0 * cyc(f, 3), 0, 0))},
        "arm-r": {"rot": per_frame(P, lambda f: (16.0 * cyc(f, 3), 0, 0))},
    }
    return _merge(legs, keys)


def mummy_move(soles: dict | None = None) -> dict:
    """A stiff-legged mummy shamble, 1.6 s (48 frames, two short steps): the
    feet barely clear the floor, the wrapped body lurches from side to side
    over each stance leg and sags after every footfall, the outstretched arms
    bob, the head lolls a beat behind."""
    P, ST = 48, 30
    soles = soles or {}
    legs, root, touch = gait(P, ST, {"leg-l": (15.0, soles.get("leg-l", [(-15.0, -6.5), (-15.0, 1.5)]), 0.0, 3.5),
                                     "leg-r": (15.0, soles.get("leg-r", [(-15.0, -2.5), (-15.0, 5.5)]), 0.5, 3.5)}, "hips", lift=1.2)
    dip = [0.0, -0.7, -1.0, -0.7, -0.3]
    hits = list(touch.values())
    cyc = lambda f, lag=0.0: math.cos(2 * math.pi * (f - lag) / P)  # noqa: E731
    lurch = lambda f, lag=0.0: math.cos(2 * math.pi * (f - ST / 2 - lag) / P)  # noqa: E731  1 over the left foot
    keys = {
        "hips": {"loc": per_frame(P, lambda f: (0, root[f], 0))},
        "torso": {"loc": per_frame(P, lambda f: (0, accent(f, hits, P, dip), 0)),
                  "rot": per_frame(P, lambda f: (-4.0, 6.0 * cyc(f, 2), 6.0 * lurch(f, 2)))},
        "head": {"rot": per_frame(P, lambda f: (3.0 * accent(f, hits, P, [0, 0, 0.5, 1, 0.8, 0.4]), 0, 9.0 * lurch(f, 6)))},
        "arm-l": {"rot": per_frame(P, lambda f: (-5.0 * cyc(f, 3) + 4.0 * accent(f, hits, P, [0, 0, -0.6, -1, -0.7, -0.3]), 0, 0))},
        "arm-r": {"rot": per_frame(P, lambda f: (5.0 * cyc(f, 3) + 4.0 * accent(f, hits, P, [0, 0, -0.6, -1, -0.7, -0.3]), 0, 0))},
    }
    return _merge(legs, keys)


def bone_hound_move(soles: dict | None = None) -> dict:
    """A skeleton hound's trot, 0.93 s (28 frames, two strides): diagonal
    pairs (front-left with back-right), each paw planted for 11 of the 14
    frames and sliding back at the ground speed, a 2-frame flight between
    the pairs, the body sinking at mid-stance,
    the head nodding a beat late, the tail swinging and the jaw chattering."""
    P, ST = 28, 11
    soles = soles or {}
    fore = [(-18.5, -5.8), (-17.5, 1.0)]
    hind = [(-20.5, -4.8), (-19.5, 2.0)]
    sole = lambda n, d: soles.get(n, d)  # noqa: E731
    legs, root, touch = gait(P, ST, {"leg-fl": (18.5, sole("leg-fl", fore), 0.0, 4.5), "leg-br": (20.5, sole("leg-br", hind), 0.0, 4.5),
                                     "leg-fr": (18.5, sole("leg-fr", fore), 0.5, 4.5), "leg-bl": (20.5, sole("leg-bl", hind), 0.5, 4.5)},
                             "body", lift=3.5, give=1.0, slide=True, lift_first=0.7)
    lo, hi = min(root), max(root)
    bounce = lambda f: (root[f % P] - lo) / (hi - lo) - 0.5 if hi > lo else 0.0  # noqa: E731
    keys = {
        "body": {"loc": per_frame(P, lambda f: (0, root[f], 0)),
                 "rot": per_frame(P, lambda f: (0, 0, 1.5 * math.cos(2 * math.pi * f / P)))},
        "head": {"rot": per_frame(P, lambda f: (-6.0 * bounce(f - 2), 3.0 * math.cos(2 * math.pi * (f - 3) / P), 0))},
        "jaw": {"rot": per_frame(P, lambda f: (5.0 + 5.0 * bounce(f - 1), 0, 0))},
        "tail": {"rot": per_frame(P, lambda f: (-10.0 + 5.0 * bounce(f - 3), 16.0 * math.cos(2 * math.pi * (f - 4) / P), 0))},
    }
    return _merge(legs, keys)


def imp_move() -> dict:
    """A cheeky imp skip, 1.0 s (30 frames, three hops): leaning forward, it
    lands in a squash, loads, pushes off on a wing downbeat in a stretch and
    flies a true ballistic arc (G 30 m/s^2, about 4 voxels high); the wings
    flare up on the landing, the tail and head trail a frame or two."""
    P, H = 30, 10  # loop, frames per hop
    HIPY = 8.0
    sole = [(-HIPY + 0.2, -6.0), (-HIPY, 1.5)]
    g = 750.0 / 900.0  # G 30 m/s^2 in voxels (about 4 cm) per frame^2
    TO = 4  # the take-off frame (the last on the ground)
    air = H - TO
    v0 = g * air / 2
    sq = {0: 0.84, 1: 0.87, 2: 0.95, 3: 1.06, 4: 1.1, 5: 1.06, 6: 1.0, 7: 1.0, 8: 1.0, 9: 1.03}
    lean = {0: -15.0, 1: -16.0, 2: -14.0, 3: -10.0, 4: -7.0, 5: -7.0, 6: -8.0, 7: -9.0, 8: -11.0, 9: -13.0}

    def pose(f):
        d = f % H
        sy = sq[d]
        sxz = 1.0 / math.sqrt(sy)
        a = math.radians(lean[d])
        c, s = math.cos(a), math.sin(a)
        low = min(dy * sy * c - dz * sxz * s for dy, dz in sole)  # the lowest sole corner, from the pivot
        y = -HIPY - low  # on the floor
        if d > TO:
            t = d - TO
            y += v0 * t - g * t * t / 2
        return y, sy, sxz, lean[d]

    wing = {0: -30.0, 1: -34.0, 2: -14.0, 3: 16.0, 4: 34.0, 5: 30.0, 6: 10.0, 7: -10.0, 8: -22.0, 9: -28.0}
    tail = {0: 14.0, 1: 16.0, 2: 8.0, 3: -6.0, 4: -14.0, 5: -14.0, 6: -8.0, 7: 0.0, 8: 6.0, 9: 10.0}
    head = {0: 8.0, 1: 10.0, 2: 6.0, 3: 0.0, 4: -4.0, 5: -4.0, 6: -2.0, 7: 0.0, 8: 2.0, 9: 5.0}
    arm = {0: 20.0, 1: 22.0, 2: 10.0, 3: -10.0, 4: -24.0, 5: -22.0, 6: -12.0, 7: 0.0, 8: 8.0, 9: 14.0}
    lag = lambda tbl, f, n: tbl[(f - n) % H]  # noqa: E731
    return {
        "body": {"loc": per_frame(P, lambda f: (0, pose(f)[0], 0)),
                 "rot": per_frame(P, lambda f: (pose(f)[3], 0, 0)),
                 "scale": per_frame(P, lambda f: (pose(f)[2], pose(f)[1], pose(f)[2]))},
        "wing-l": {"rot": per_frame(P, lambda f: (0, 0, wing[f % H]))},
        "wing-r": {"rot": per_frame(P, lambda f: (0, 0, -wing[f % H]))},
        "tail": {"rot": per_frame(P, lambda f: (lag(tail, f, 1), 0, 0))},
        "head": {"rot": per_frame(P, lambda f: (lag(head, f, 1), 0, 0))},
        "arm-l": {"rot": per_frame(P, lambda f: (lag(arm, f, 1), 0, -6))},
        "arm-r": {"rot": per_frame(P, lambda f: (lag(arm, f, 1), 0, 6))},
    }


def giant_spider_move(angles, reach_x, hip_x: float = 3.0) -> dict:
    """A tomb spider's scuttle, 0.8 s (24 frames, two strides): alternating
    groups of four legs (left 0 and 2 with right 1 and 3), each tip planted
    for half a stride and swept back by a yaw about the hip at one ground
    speed for every leg, the swing legs lifting at the femur and folding at
    the knee. The body glides level (a tilt would drag the planted tips)."""
    P, STRIDE = 24, 12
    ST = STRIDE // 2
    D = 6.0  # voxels the tips travel back per stance
    group_a = {"l0", "r1", "l2", "r3"}
    out = {}
    for side, s in (("l", -1), ("r", 1)):
        for i in range(4):
            r = reach_x[i] - hip_x
            amp = math.degrees((D / 2) / (r * math.cos(math.radians(angles[i]))))
            ph = 0 if f"{side}{i}" in group_a else ST
            fem, shin = [], []
            for f in range(P + 1):
                p = (f - ph) % STRIDE
                if p <= ST:
                    psi = amp * (1 - 2 * p / ST)
                    lift = 0.0
                    knee = 0.0
                else:
                    w = (p - ST) / (STRIDE - ST)
                    psi = _swing(w, amp, -2 * amp)
                    lift = 20.0 * math.sin(math.pi * w)
                    knee = 14.0 * math.sin(math.pi * w)
                fem.append((fr(f), (0.0, s * psi, s * lift)))
                shin.append((fr(f), (0.0, 0.0, -s * knee)))
            out[f"leg-{side}{i}"] = {"rot": fem}
            out[f"leg-{side}{i}-shin"] = {"rot": shin}
    return out
