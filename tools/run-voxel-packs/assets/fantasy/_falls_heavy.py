"""Death keying for the heavy fantasy giants (cyclops, ent): a slam onto the back.

`heavy_back_fall` keys a giant's death: the blow rocks it back, it teeters
forward onto its toes (a moving hold, the body never stops), then tips over
backwards (toward +Z, away from the attacker) in ONE accelerating stroke
into the floor: slow off the balance point, fastest at contact (pass the
returned time as Clip(impact=...)). A hard thud squashed flat on the
floor, ONE small bounce, a hard settle. The arms are flung up toward the
attacker as it goes, slam down spread on the floor with the body, pop up a
little and settle; the head lags, whips back on the landing and lolls; the
legs bounce off the floor and drop last; a held weapon lands late and flops.

Why the root has NO key between the tip and the impact: the exporter
splits a part's strokes at every key where any of its channels holds or
turns, and eases each stroke (a hang at both ends). A loc or scale key just
before the impact would make the fall slow down into it. So the fall is
one stroke on every root channel, and the lift that keeps the lying body
on the floor is keyed only on the impact and after (the exporter lifts any
sinking frame before that, which pins the heels as it tips).

`lift` is how far the root must be raised so the lying pose touches the
floor. A float holds from the impact on; a {frame: lift} dict keys each
frame (the pose changes as the arms and head land). Measure it: build with
FH_CAL=1 (`cal_floor()` then turns the export's floor fix off), read the
lowest point per frame and correct the table (keyed lift minus the error;
frames before the impact are keyed at 92% of theirs). Repeat until the
impact and the rest read 0 and the bounce reads its height.
"""
from __future__ import annotations

import os

F = 1 / 30


def cal_floor():
    """Clip(floor=...): None (the export keeps the clip on the floor), or
    False under FH_CAL=1 to measure the raw sink when calibrating a lift."""
    return False if os.environ.get("FH_CAL") else None


def _sec(rows):
    return [(fr * F, v) for fr, v in rows]


def _lerp(a, b, u):
    return tuple(x + (y - x) * u for x, y in zip(a, b))


def heavy_back_fall(root: str, *, rock: int = 5, teeter: int = 11, tip: int = 14, land: int = 30, settle: int = 18,
                    lift=0.0, bounce: float = 0.8, bounce_rot: float = 1.5, flat: float = 90.0, squash: float = 0.9,
                    body: str = "body", head: str = "head", arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"),
                    weapon: str | None = None, rock_deg: float = 5.0, teeter_deg: float = -4.0,
                    body_land: float = 0.0, body_pop: float = 6.0, head_land=(0.0, 0.0, 0.0), head_loll: float = 20.0, head_flop: float = 1.0,
                    arm_fling=(70.0, 0.0, 40.0), arm_land=(-8.0, 0.0, 70.0), arm_pop: float = 14.0, arm_r_drop: float = 0.0,
                    leg_land=(0.0, 0.0, 6.0), leg_pop: float = 8.0, weapon_land=(10.0, 0.0, 0.0),
                    fall_mid=None, head_late=None, head_shake: float = 0.0, head_press: float = 0.0, head_wobble: float = 0.0):
    """Keys for a heavy fall onto the back. Frames: rock (blown back), teeter
    (forward on the toes), tip (leaves the balance point, still moving),
    land (impact), then the bounce (up 2 frames, down 2) and a settle over
    `settle` frames. Rotations for arm-l are given; arm-r mirrors them (y, z
    flip; arm_r_drop adds to its x on the floor, for a hand that holds
something). Returns (clip_keys, land_seconds)."""
    L, S = land, land + settle
    up, down = L + 2, L + 4

    def lift_at(fr):
        if isinstance(lift, dict):
            ks = sorted(lift)
            if fr <= ks[0]:
                return lift[ks[0]]
            for a, b in zip(ks, ks[1:]):
                if a <= fr <= b:
                    return lift[a] + (lift[b] - lift[a]) * (fr - a) / (b - a)
            return lift[ks[-1]]
        return float(lift)

    # the root: rock back, teeter forward (still drifting), one stroke to flat
    # fall_mid (frame, angle): a rising key inside the fall (not a turning
    # point, so still one stroke) that holds the angle back early, so the
    # last frames into the floor are the fastest (snap_impact arrives at
    # twice the last span's mean speed)
    mid = [(fall_mid[0], (fall_mid[1], 0, 0))] if fall_mid else []
    root_rot = [(0, (0, 0, 0)), (rock, (rock_deg, 0, 0)), (teeter, (teeter_deg, 0, 0)), (tip, (teeter_deg + 0.6, 0, 0))] + mid + [(L, (flat, 0, 0)),
                (up, (flat - bounce_rot, 0, 0)), (down, (flat + 0.2 * bounce_rot, 0, 0)), (S, (flat, 0, 0))]
    # Before the impact the lift is keyed only where `lift` gives it, a bit
    # under the measured sink and rising (a rising key is not a turning
    # point, so the fall stays one stroke); the export lifts the rest, which
    # pins the heels. From the impact on it is keyed at the floor.
    pre, last = [], 0.0
    if isinstance(lift, dict):
        for fr in sorted(f for f in lift if tip < f < L):
            v = 0.92 * lift[fr]
            if v > last + 1e-3:
                pre.append((fr, (0, v, 0)))
                last = v
    # ONE small bounce off the floor over 4 frames: up 2, down 2, a hard settle
    hop = {L + 1: 0.55, L + 2: 1.0, L + 3: 0.5}
    post = sorted({L, L + 1, up, L + 3, down, S} | ({fr for fr in lift if fr >= L} if isinstance(lift, dict) else set()))
    root_loc = [(0, (0, 0, 0)), (tip, (0, 0, 0))] + pre
    for fr in post:
        root_loc.append((fr, (0, lift_at(fr) + bounce * hop.get(fr, 0.0), 0)))
    # squashed flat on the impact (the root's z is the vertical once it lies
    # on its back), stretched on the bounce, settled; no key in the fall
    sq = [(0, (1, 1, 1)), (tip, (1, 1, 1)), (L, (1.05, 1.03, squash)), (up, (0.99, 0.99, 1.0 + 0.3 * (1.0 - squash))), (down + 1, (1, 1, 1)), (S, (1, 1, 1))]

    # the upper body: whipped back by the blow, curls forward on the teeter,
    # arches back as it goes, lands flat, rebounds once
    bl = body_land
    body_rot = [(0, (0, 0, 0)), (rock, (10, 0, 0)), (teeter, (-8, 0, 0)), (tip + 4, (-12, 0, 0)), (L, (bl, 0, 0)), (up + 1, (bl - body_pop, 0, 0)),
                (down + 3, (bl + 0.2 * body_pop, 0, 0)), (S, (bl, 0, 0))]
    hx, hy, hz = head_land
    hf = head_flop
    head_rot = [(0, (0, 0, 0)), (rock, (20, 0, 0)), (teeter + 1, (-10, 0, 0)), (L - 6, (-24, 0, 0)), (L + 1, (hx + 3 * hf, hy, hz)),
                (L + 4, (hx - 12 * hf, hy + head_loll * 0.3, hz)), (L + 10, (hx + 2 * hf, hy + head_loll * 0.9, hz)), (S + 4, (hx, hy + head_loll, hz))]
    if head_late is not None:
        # a big head (a crown) lands LATE instead of cushioning down: still held
        # up by head_late on the impact, it slams into the floor 2 frames later
        # (pressed head_press further), rebounds once (head_shake, about a
        # voxel) at L+4, lands again at L+6, and a twist wobble (head_wobble
        # degrees about its own axis, a little roll) dies out over 8 frames
        w = head_wobble
        head_rot = [(0, (0, 0, 0)), (rock, (20, 0, 0)), (teeter + 1, (-10, 0, 0)), (L - 6, (-24, 0, 0)), (L, (hx + head_late, hy, hz)),
                    (L + 2, (hx + head_press, hy, hz)), (L + 3, (hx + head_shake * 0.6, hy + w, hz + 0.4 * w)),
                    (L + 4, (hx + head_shake, hy + 0.2 * w, hz)), (L + 5, (hx + head_shake * 0.5, hy - 0.8 * w, hz - 0.3 * w)),
                    (L + 6, (hx, hy - 0.3 * w, hz)), (L + 7, (hx, hy + 0.5 * w, hz + 0.15 * w)), (L + 9, (hx, hy - 0.25 * w, hz)),
                    (L + 11, (hx, hy + 0.1 * w, hz)), (L + 13, (hx, hy, hz)), (S + 4, (hx, hy, hz))]
    ax, ay, az = arm_land
    fx, fy, fz = arm_fling
    arm_l = [(0, (0, 0, 0)), (rock, (-20, 0, -16)), (teeter, (18, 0, -10)), (L - 6, (fx, -fy, -fz)), (L, (ax, -ay, -az)),
             (L + 3, (ax + arm_pop, -ay, -az + 6)), (L + 7, (ax + 1.5, -ay, -az - 2)), (S, (ax, -ay, -az))]
    lx, ly, lz = leg_land
    out = {root: {"rot": _sec(root_rot), "loc": _sec(root_loc), "scale": _sec(sq)},
           body: {"rot": _sec(body_rot)}, head: {"rot": _sec(head_rot)},
           arms[0]: {"rot": _sec(arm_l)},
           arms[1]: {"rot": _sec([(fr, (x + (arm_r_drop if fr >= L else 0.0), -y, -z)) for fr, (x, y, z) in arm_l])}}
    if legs:
        # pinned while it tips (the export holds the heels on the floor), they
        # slam down with the body, bounce up off the floor and drop last
        for s, name in ((-1, legs[0]), (1, legs[1])):
            out[name] = {"rot": _sec([(0, (0, 0, 0)), (tip, (0, 0, 0)), (L, (lx, ly, s * lz)), (L + 3 + (s > 0), (lx + leg_pop, ly, s * lz)),
                                      (L + 7 + (s > 0), (lx + 0.5, ly, s * lz)), (L + 10 + (s > 0), (lx + leg_pop * 0.25, ly, s * lz)), (S + 2, (lx, ly, s * lz))])}
    if weapon:
        w = weapon_land
        # still swinging over as the body lands, it tips onto the floor late
        # (L+4), flops up once and lies still
        out[weapon] = {"rot": _sec([(0, (0, 0, 0)), (teeter, (8, 0, 0)), (L - 4, (-20, 0, 0)), (L, _lerp(w, (0, 0, 0), 0.55)), (L + 4, w),
                                    (L + 7, _lerp(w, (0, 0, 0), 0.15)), (L + 10, w), (S + 2, w)])}
    return out, L * F


# ------------------------------------------------------------------ hits
def _pl(keys, t):
    """Piecewise-linear value of [(t, v), ...] (v a number) at t."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            return v0 + (v1 - v0) * (t - t0) / max(1e-9, t1 - t0)
    return keys[-1][1]


def feet_keys(root_loc, feet: dict, L: float):
    """Legs that keep their feet where `feet` says while the root moves
    (a copy of _falls.planted that also knows airborne feet).

    root_loc: the root's [(frame, (x, y, z)), ...]. feet: {leg: [(frame,
    foot_z, lift), ...]}: a foot is planted while lift is 0, stepping (lifted
    by `lift` voxels) while lift > 0, and in the air with the body while lift
    is None (no lift of its own and it does not hold the hips down). A rigid
    leg of length L turns by asin((root_z - foot_z) / L) about the hip (+x
    swings the foot forward). Returns ({leg: {"rot", "loc"}}, root_loc with
    the hips lowered by the drop of the most upright planted leg), in seconds."""
    import math
    frames = sorted({fr for fr, _ in root_loc} | {fr for k in feet.values() for fr, _, _ in k})
    out = {leg: {"rot": [], "loc": []} for leg in feet}
    new_root = []
    for fr in frames:
        rx = _pl([(a, v[0]) for a, v in root_loc], fr)
        ry = _pl([(a, v[1]) for a, v in root_loc], fr)
        rz = _pl([(a, v[2]) for a, v in root_loc], fr)
        drops = []
        for leg, k in feet.items():
            fz = _pl([(a, b) for a, b, _ in k], fr)
            lifts = [(a, c) for a, _, c in k]
            air = any(c is None and abs(a - fr) < 1e-6 for a, c in lifts)
            lift = 0.0 if air else _pl([(a, c or 0.0) for a, c in lifts], fr)
            s = max(-0.95, min(0.95, (rz - fz) / L))
            ang = math.degrees(math.asin(s))
            out[leg]["rot"].append((fr * F, (ang, 0.0, 0.0)))
            out[leg]["loc"].append((fr * F, (0.0, lift, 0.0)))
            if not air and lift < 1e-6:
                drops.append(L * (1 - math.cos(math.radians(ang))))
        new_root.append((fr * F, (rx, ry - (min(drops) if drops else 0.0), rz)))
    return out, new_root


def heavy_hit(root: str, L: float, *, push: float = 5.0, pop: float = 1.8, step: float = 1.4, k: float = 1.0,
              body: str = "body", head: str = "head", arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"),
              weapon: str | None = None, squash: float = 0.975):
    """A heavy giant knocked back: the blow lands on frame 0, by frame 1 it is
    flying back and up off its feet (the feet trail), easing out at the peak
    of a short gravity arc (about f4); it lands by f8 with a squash, the
    weight still going back, so the right foot takes a heavy step back
    (lift, move, plant) to catch it; a drifting beat as the upper body,
    head and arms swing on; then it steps back in (right foot, then left)
    and the weight comes forward past rest before it settles. No impact key:
    the blow is at the start. push: how far the hips are knocked back
    (voxels); step: how far past that the right foot steps back (x push).
    Returns (clip_keys, None)."""
    def T(fr):
        return round(fr * k)

    p = push
    root_loc = [(0, (0, 0, 0)), (1, (0, pop * 0.55, p * 0.4)), (4, (0, pop, p * 0.78)), (8, (0, 0, p * 0.95)), (T(11), (0, 0, p * 1.06)),
                (T(15), (0, 0, p * 1.12)), (T(19), (0, 0, p * 0.92)), (T(25), (0, 0, p * 0.2)), (T(29), (0, 0, -p * 0.12)), (T(35), (0, 0, 0))]
    out = {}
    if legs:
        sb = p * step
        feet = {legs[0]: [(0, 0, 0), (1, p * 0.1, None), (4, p * 0.25, None), (8, p * 0.35, 0), (T(24), p * 0.35, 0), (T(26.5), p * 0.17, 1.6),
                          (T(29), 0, 0), (T(35), 0, 0)],
                legs[1]: [(0, 0, 0), (1, p * 0.12, None), (4, p * 0.3, None), (8, p * 0.45, 0), (T(9), p * 0.45, 0), (T(11), (p * 0.45 + sb) / 2, 2.4),
                          (T(13), sb, 0), (T(18), sb, 0), (T(21), sb * 0.5, 2.2), (T(24), 0, 0), (T(35), 0, 0)]}
        legk, root_loc = feet_keys(root_loc, feet, L)
        out.update(legk)
    else:
        root_loc = [(fr * F, v) for fr, v in root_loc]
    out[root] = {"loc": root_loc,
                 "scale": [(0, (1, 1, 1)), (T(7) * F, (1, 1, 1)), (T(8.5) * F, (1.04, squash, 1.04)), (T(11) * F, (0.99, 1.01, 0.99)),
                           (T(14) * F, (1, 1, 1)), (T(35) * F, (1, 1, 1))]}
    def r(rows):  # the blow's first beats stay fast; the rest stretch with k
        return [((T(fr) if fr > 4 else fr) * F, v) for fr, v in rows]
    out[body] = {"rot": r([(0, (0, 0, 0)), (1, (17, 0, 6)), (4, (31, 0, 9)), (8, (17, 0, 5)), (12, (22, 0, 6)), (17, (8, 0, 3)),
                           (23, (-4, 0, -1)), (28, (-8, 0, -2)), (35, (0, 0, 0))])}
    out[head] = {"rot": r([(0, (0, 0, 0)), (1, (12, -6, 4)), (5, (38, -14, 8)), (9, (14, -8, 4)), (13, (22, -9, 5)), (19, (2, -2, 0)),
                           (25, (-9, 2, -1)), (31, (3, 0, 0)), (37, (0, 0, 0))])}
    if arms:
        out[arms[0]] = {"rot": r([(0, (0, 0, 0)), (1, (-22, 0, -24)), (6, (-40, 0, -42)), (10, (-14, 0, -18)), (14, (-22, 0, -24)), (20, (8, 0, -4)),
                                  (27, (12, 0, 2)), (33, (-2, 0, 0)), (38, (0, 0, 0))])}
        out[arms[1]] = {"rot": r([(0, (0, 0, 0)), (1, (-16, 0, 18)), (6, (-30, 0, 32)), (10, (-10, 0, 14)), (14, (-16, 0, 18)), (20, (6, 0, 4)),
                                  (27, (10, 0, -2)), (33, (-2, 0, 0)), (38, (0, 0, 0))])}
    if weapon:
        out[weapon] = {"rot": r([(0, (0, 0, 0)), (2, (10, 0, 2)), (7, (24, 0, 6)), (11, (6, 0, 0)), (15, (14, 0, 3)), (22, (-4, 0, -2)),
                                 (29, (-6, 0, 0)), (35, (1, 0, 0)), (40, (0, 0, 0))])}
    return out, None
