"""Shared death keying for the fantasy bipeds: a weighted fall onto the side.

`side_fall` keys a death that reads with weight instead of a stiff plank
topple: a blow rocks the upper body back (anticipation), it stumbles out
onto the foot on the falling side, then topples sideways and a little
forward, accelerating into the floor on the impact frame (pass the
returned `land` time as Clip(impact=...)). The arms swing out as it goes
and slam the ground with the body, pop up and settle; the body bounces
once; the head lands late and flops; the top leg and any tail drop last.

The export keeps creature deaths on the floor, so the root is never lifted
by hand here (only the bounce is keyed).
"""
from __future__ import annotations

F = 1 / 30


def _m(v, s):
    """Mirror an (x, y, z) rotation for a fall to the other side."""
    x, y, z = v
    return (x, y, z) if s > 0 else (x, -y, -z)


def side_fall(root: str, s: int = 1, k: float = 1.0, bounce: float = 2.5, body: str = "body", head: str = "head",
              arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"), weapon: str | None = None, tail: str | None = None,
              lean: float = -14.0, edge: float = 0.0, hop: dict | None = None, roll_keys: dict | None = None):
    """Keys for a side fall. s=+1 falls onto its left side (glTF -X), s=-1
    onto its right. k stretches the timing (heavier = slower anticipation
    and settle). edge: how far out (voxels) the body's side lies from the
    centre line: the roll then turns about that edge, so the body lands on
    its side instead of sinking and being lifted back by the export (which
    would swallow the bounce). Keep it a little under the real width: the
    export lifts the rest. hop: {frame: (dx, dy, dz)} extra root offsets
    (an airborne flyer). roll_keys: {frame: (x, y, z)} extra root rotation
    keys (e.g. a flyer that turns over in the air). Returns (clip_keys, land_seconds)."""
    land = round(30 * k)
    L = land
    # (frame, rotation) rows in the s=+1 frame: falls toward -X (its left)
    root_rot = [(0, (0, 0, 0)), (12, (0, 0, -2)), (16, (-3, 0, 5)), (30, (lean, 0, 88)), (34, (lean + 1, 0, 85)), (40, (lean, 0, 89)), (48, (lean, 0, 88))]
    body_rot = [(0, (0, 0, 0)), (5, (14, 0, -3)), (9, (16, 0, -4)), (16, (-12, 0, 6)), (30, (-8, 0, 4)), (48, (-8, 0, 4))]
    head_rot = [(0, (0, 0, 0)), (5, (24, 0, -4)), (10, (26, 0, -6)), (18, (-16, 0, 8)), (26, (-10, 0, -20)), (33, (-14, 10, 20)), (38, (-10, 6, 8)),
                (44, (-12, 10, 16)), (52, (-12, 10, 14))]
    low_arm = [(0, (0, 0, 0)), (5, (-20, 0, -14)), (12, (-6, 0, -20)), (24, (60, 0, -30)), (30, (78, 0, -8)), (34, (64, 0, -14)), (40, (80, 0, -6)), (48, (78, 0, -8))]
    top_arm = [(0, (0, 0, 0)), (5, (-18, 0, 14)), (12, (-4, 0, 30)), (24, (40, 0, 95)), (30, (80, 70, 0)), (34, (70, 48, 0)), (40, (82, 74, 0)), (48, (80, 72, 0))]
    if roll_keys:
        root_rot = sorted({**dict(root_rot), **roll_keys}.items())
    low_leg = [(0, (0, 0, 0)), (8, (0, 0, 0)), (12, (4, 0, -6)), (16, (2, 0, -10)), (30, (8, 0, -10)), (48, (8, 0, -10))]
    top_leg = [(0, (0, 0, 0)), (16, (0, 0, 2)), (30, (10, 0, 4)), (34, (6, 0, 10)), (42, (16, 0, 2)), (52, (14, 0, 3))]

    def t(fr):  # heavier creatures stretch every beat, the fall included
        return fr * k

    def rows(r):
        return [(round(t(fr)) * F, _m(v, s)) for fr, v in r]

    import math
    hop = dict(hop or {})
    frames = sorted({fr for fr, _ in root_rot} | set(hop))
    zs = [(fr, v[2]) for fr, v in root_rot]

    def roll_at(fr):  # the keyed z roll, linear between keys
        for (f0, a0), (f1, a1) in zip(zs, zs[1:]):
            if f0 <= fr <= f1:
                return a0 + (a1 - a0) * (fr - f0) / max(1, f1 - f0)
        return zs[-1][1]

    qx = -edge  # the edge on the falling side (s=+1 frame: -X)
    root_loc = []
    for fr in frames:
        a = math.radians(roll_at(fr))
        x, y = qx * (1 - math.cos(a)), -qx * math.sin(a)
        dx, dy, dz = hop.get(fr, (0.0, bounce if fr == 34 else 0.0, 0.0))
        root_loc.append((round(t(fr)) * F, (s * (x + dx), y + dy, dz)))

    lo_arm, hi_arm = (arms[0], arms[1]) if s > 0 else (arms[1], arms[0])
    lo_leg, hi_leg = (legs[0], legs[1]) if s > 0 else (legs[1], legs[0])
    out = {
        root: {"rot": rows(root_rot), "loc": root_loc},
        body: {"rot": rows(body_rot)},
        head: {"rot": rows(head_rot)},
        lo_arm: {"rot": rows(low_arm)},
        hi_arm: {"rot": rows(top_arm)},
        lo_leg: {"rot": rows(low_leg),
                 "loc": [(0, (0, 0, 0)), (round(t(8)) * F, (0, 0, 0)), (round(t(12)) * F, (0, 2.0, 0)), (round(t(16)) * F, (0, 0, 0)), (round(t(48)) * F, (0, 0, 0))]},
        hi_leg: {"rot": rows(top_leg)},
    }
    if weapon:
        out[weapon] = {"rot": rows([(0, (0, 0, 0)), (12, (10, 0, 0)), (24, (30, 0, -20)), (30, (40, 0, -30)), (35, (60, 0, -40)), (42, (52, 0, -34)), (50, (55, 0, -36))])}
    if tail:
        out[tail] = {"rot": rows([(0, (0, 0, 0)), (10, (-20, 0, 0)), (24, (30, 0, -10)), (30, (50, 0, -20)), (36, (30, 0, -26)), (44, (55, 0, -20)), (52, (50, 0, -22))])}
    return out, L * F


def _scale(v, f):
    return tuple(a * f for a in v)


def quad_roll(body: str, about, roll: float = 88.0, k: float = 1.0, bounce: float = 2.0, legs: dict | None = None,
              loose: dict | None = None, leg_loc=None, sink=(0.0, 0.0)):
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
    Returns (clip_keys, land_seconds)."""
    def T(fr):
        return round(fr * k) * F

    land = round(27 * k)
    sb, sl = sink
    beats = [(0, 0.0, 0.0), (5, -6.0, 0.0), (10, -3.0, 0.0), (14, 6.0, sb), (27, roll, sl), (31, roll - 5.0, sl + bounce), (37, roll + 1.0, sl), (44, roll, sl)]
    out = {body: {"rot": [(T(fr), (0, 0, a)) for fr, a, _ in beats],
                  "loc": [(T(fr), tuple(o + d for o, d in zip(about(a), (0, lift, 0)))) for fr, a, lift in beats]}}
    for name, (buckle, land_pose) in (legs or {}).items():
        out[name] = {"rot": [(0, (0, 0, 0)), (T(5), (0, 0, 0)), (T(14), buckle), (T(27), land_pose), (T(31), _scale(land_pose, 1.3)),
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
              arm_down: float = 15.0, flat: float = 90.0, weapon_land=(30, 0, 0), tail_land=(25, 0, 30), bounce_rot: float = 0.0, head_back: float = 2.0, body_land: float = 2.0, head_yaw: float = 24.0,
              rest_lift: float = 0.0):
    """A heavy fall onto the back, away from the attacker (toward +Z).

    A blow rocks it back, it teeters forward onto its toes, hangs, then
    tips over backwards in ONE accelerating stroke into the floor (impact:
    pass the returned time as Clip(impact=...)): slow off the balance
    point, fastest at contact. A heavy thud, one small bounce, settle. The
    arms are flung up toward the attacker as it goes, slam down spread on
    the floor with the body, pop up and settle; the head lags, whips back
    on the landing and lolls to the side; the legs kick up and drop last.
    The export keeps it on the floor (from the impact on, never lower than
    the resting pose needs). Tune arm_down, head_back and body_land so the
    TORSO is what rests on the floor, not an arm, a weapon or the head.
    k stretches every beat (heavier creatures fall slower). Returns
    (clip_keys, land_seconds)."""
    L = round(30 * k)
    fall = flat
    # the bounce is a lift of the whole body (the export never lets the lift
    # after the impact drop below what the resting pose needs, so rocking
    # the angle back would only add to it)
    root_rot = [(0, (0, 0, 0)), (5, (5, 0, 0)), (11, (-4, 0, 0)), (13, (-3.5, 0, 0)), (30, (fall, 4, 3)), (34, (fall - bounce_rot, 4, 3)),
                (40, (fall, 4, 3)), (48, (fall, 4, 3))]
    # ONE short bounce off the floor: up for 2 frames, down by 4, a hard settle
    root_loc = [(0, (0, 0, 0)), (30, (0, 0, 0)), (32, (0, bounce, 0)), (34, (0, 0, 0)), (48, (0, 0, 0))]
    bl = body_land  # the torso bends back onto the floor at rest (over a tail or a big pelvis)
    body_rot = [(0, (0, 0, 0)), (5, (10, 0, 0)), (11, (-8, 0, 0)), (22, (-14, 0, 0)), (30, (bl, 0, 0)), (34, (bl - 8, 0, 0)), (40, (bl, 0, 0)), (48, (bl, 0, 0))]
    hb = head_back  # how far the head rolls back onto the floor at rest
    head_rot = [(0, (0, 0, 0)), (5, (20, 0, 0)), (12, (-10, 0, 0)), (24, (-26, 0, 0)), (30, (hb, 0, 0)), (33, (hb - 14, 6, 0)),
                (41, (hb, head_yaw * 0.8, 0)), (50, (hb, head_yaw, 0))]
    a = arm_down
    # the arms settle 4 degrees further down than they slam, so they rest on
    # the floor rather than hover above the held lift
    arm_l = [(0, (0, 0, 0)), (5, (-20, 0, -18)), (11, (20, 0, -10)), (22, (75, 0, -40)), (30, (-a, 0, -70)), (34, (-a + 18, 0, -58)),
             (40, (-a - 4, 0, -72)), (48, (-a - 4, 0, -70))]
    arm_r = [(0, (0, 0, 0)), (5, (-18, 0, 16)), (11, (16, 0, 12)), (24, (68, 0, 46)), (30, (-a, 0, 64)), (34, (-a + 16, 0, 54)),
             (40, (-a - 4, 0, 66)), (48, (-a - 4, 0, 64))]
    leg_l = [(0, (0, 0, 0)), (14, (0, 0, 0)), (24, (22, 0, -4)), (30, (14, 0, -6)), (35, (26, 0, -6)), (42, (12, 0, -6)), (50, (14, 0, -6))]
    leg_r = [(0, (0, 0, 0)), (14, (0, 0, 0)), (26, (14, 0, 4)), (30, (6, 0, 6)), (36, (18, 0, 7)), (44, (4, 0, 6)), (52, (6, 0, 6))]
    # the thud: squashed flat against the floor on the impact frame (standing
    # z is the vertical once it lies on its back), springing back as it bounces
    sq = [(0, (1, 1, 1)), (29, (1, 1, 1)), (30, (1.04, 1.03, 0.9)), (32, (0.99, 0.99, 1.03)), (35, (1, 1, 1)), (48, (1, 1, 1))]
    if rest_lift:
        # keyed AT the floor from the impact on (rest_lift = how far the
        # lying pose would sink about the root pivot): the export only fixes
        # sinking, so without this the bounce would be swallowed. Before the
        # impact the export pins the heels as it tips.
        h, b = rest_lift, bounce
        root_loc = [(0, (0, 0, 0)), ((L - 1) / k, (0, 0, 0)), (30, (0, h, 0)), (32, (0, h + b, 0)), (34, (0, h, 0)), (48, (0, h, 0))]
    out = {root: {"rot": _rows(root_rot, k), "loc": _rows(root_loc, k), "scale": [(round(fr * k) * F if fr != 29 else (L - 1) * F, v) for fr, v in sq]},
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
    """A hit that reads as a shove. The blow lands on frame 0: by frame 1
    it is already moving fast, knocked back and up off its feet, easing out
    into the push pose (a short gravity arc: the peak about frame 4, down
    by frame 8); it keeps drifting back a little as the upper body and the
    arms settle (no freeze), then steps back in (left foot, then right) and
    the weight comes forward past rest before it settles; the head settles
    last. Feet planted whenever down. No impact key: the blow is at the
    start. Returns (clip_keys, None)."""
    T = lambda fr: round(fr * k) * F  # noqa: E731
    p = push
    root_loc = [(0, (0, 0, 0)), (T(1), (0, pop * 0.65, p * 0.4)), (T(4), (0, pop, p * 0.8)), (T(8), (0, 0, p)), (T(12), (0, 0, p * 1.08)),
                (T(16), (0, 0, p * 0.5)), (T(21), (0, 0, -0.3)), (T(26), (0, 0, 0))]
    out = {}
    if legs:
        # in the air the feet trail toward the attacker (they leave the floor
        # last), then land a step back and stay put until each steps home
        feet = {legs[0]: [(0, 0, 0), (T(1), 0, 0), (T(4), p * 0.35, pop * 0.9), (T(8), p, 0), (T(12), p, 0), (T(14), p * 0.5, 1.6), (T(16), 0, 0), (T(26), 0, 0)],
                legs[1]: [(0, 0, 0), (T(1), 0, 0), (T(4), p * 0.4, pop * 0.9), (T(8), p, 0), (T(16), p, 0), (T(18.5), p * 0.5, 1.6), (T(21), 0, 0), (T(26), 0, 0)]}
        legk, root_loc = planted(root_loc, feet, L)
        # the root never drops while it is airborne: keep the keyed pop
        out.update(legk)
    out[root] = {"loc": root_loc}
    out[body] = {"rot": [(0, (0, 0, 0)), (T(1), (13, 0, 5)), (T(5), (21, 0, 8)), (T(8), (12, 0, 4)), (T(12), (8, 0, 3)), (T(17), (2, 0, 1)),
                         (T(22), (-6, 0, -2)), (T(28), (0, 0, 0))]}
    out[head] = {"rot": [(0, (0, 0, 0)), (T(1), (14, -8, 5)), (T(6), (30, -14, 8)), (T(9), (14, -8, 4)), (T(12), (17, -8, 5)),
                         (T(19), (0, -2, 0)), (T(24), (-8, 2, -1)), (T(30), (0, 0, 0))]}
    if arms:
        out[arms[0]] = {"rot": [(0, (0, 0, 0)), (T(1), (-16, 0, -20)), (T(6), (-30, 0, -32)), (T(10), (-10, 0, -16)), (T(18), (8, 0, -4)),
                                (T(24), (-3, 0, 0)), (T(30), (0, 0, 0))]}
        out[arms[1]] = {"rot": [(0, (0, 0, 0)), (T(1), (-13, 0, 16)), (T(6), (-26, 0, 28)), (T(10), (-8, 0, 14)), (T(18), (8, 0, 4)),
                                (T(24), (-3, 0, 0)), (T(30), (0, 0, 0))]}
    if weapon:
        # the weapon swings with the shove but never dips its head below rest
        out[weapon] = {"rot": [(0, (0, 0, 0)), (T(3), (8, 0, 0)), (T(7), (20, 0, 5)), (T(12), (6, 0, 0)), (T(20), (3, 0, -2)), (T(27), (1, 0, 0)), (T(32), (0, 0, 0))]}
    if tail:
        out[tail] = {"rot": [(0, (0, 0, 0)), (T(3), (-20, 0, 0)), (T(8), (-28, 0, 6)), (T(14), (8, 0, -6)), (T(22), (-4, 0, 2)), (T(30), (0, 0, 0))]}
    return out, None


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
