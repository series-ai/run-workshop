"""Death, hit and lunge keying for the fantasy flyers and the skeleton knight
(harpy, phoenix, forest wisp, skeleton knight).

A private copy of the helpers in `_falls.py` (back_fall, shove_hit, lunge,
planted), so these creatures keep their timing while other packs tune the
shared module, plus `flap_struggle`, the dramatic wing struggle before a
flyer's backward fall.
"""
from __future__ import annotations

import math

F = 1 / 30


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


def flap_fall(root: str, rest_loc, rest_rot, k: float = 1.0, apex: float = 6.8, bounce: float = 1.2,
              wings=("wing-l", "wing-r"), head: str = "head", body: str | None = None, legs=None, tail: str | None = None,
              wing_land=(-20, 0, -8), head_land=(-60, 80, 0), body_land: float = 0.0, tail_land=(80, 0, 0),
              leg_land=((14, 0, -6), (6, 0, 6)), fall: int = 11, wing_after=None, impact_drop: float = 0.0):
    """A flyer's death: the blow rocks it back, it struggles in the air with
    three big frantic wingbeats (each downstroke heaves it higher, each
    upstroke drops it back a little; the body pitches and rolls, the head
    thrashes, the legs kick, the tail fans), the last beat fails and it
    stalls at the top still drifting up and tipping back (a moving hold),
    then drops over backwards (toward +Z, away from the attacker) with
    gravity: height and tilt both fall as t^2, one key a frame, so it is
    fastest on the impact frame (pass the returned time as Clip(impact=)).
    A thud with a squash, ONE small bounce (2 frames up, 2 down), a hard
    settle. The wings trail up as it drops and slap the floor two frames
    late with a small flop; the head lands late and lolls; the legs and
    the tail drop last.

    rest_loc / rest_rot: the root's lying pose, keyed AT the floor (the
    export only lifts sinking poses). Wing keys are wing-l's; wing-r
    mirrors them. wing_after: optional [(frames from the landing, (x, y, z)),
    ...] wing-l keys that replace the default ones from the stall on (for
    big wings that must be near their landed spread as the body lands).
    Returns (clip_keys, land_seconds)."""
    def T(fr):
        return round(fr * k) * F

    top = 27  # the stall at the top of the struggle
    land = top + fall
    L = round(land * k)
    rx, ry, rz = rest_loc
    ax, ay, az = rest_rot
    # the struggle: (frame, loc y, loc z, pitch x, roll z)
    climb = [(0, 0.0, 0.0, 0, 0), (2, 0.3, 0.8, 11, -3), (5, 0.8, 1.2, 6, 2), (7, 2.4 / 6.8, 1.4, -6, 6), (11, 2.0 / 6.8, 1.6, 7, -5),
             (15, 4.4 / 6.8, 1.8, -4, 7), (19, 4.0 / 6.8, 2.0, 9, -6), (23, 6.2 / 6.8, 2.2, 1, 4), (top, 1.0, 2.4, 16, -2)]
    loc, rot = [], []
    for fr, y, z, px, pz in climb:
        yy = y * apex if fr >= 7 or fr == top else y
        loc.append((T(fr), (0.0, yy, z)))
        rot.append((T(fr), (px, 0.0, pz)))
    # the drop: one key an OUTPUT frame (so a stretched k leaves no frame
    # unkeyed), accelerating (t^2) in height and in tilt
    t0 = round(top * k)
    for of in range(t0 + 1, L + 1):
        u = (of - t0) / (L - t0)
        g = u * u
        # (impact_drop: the squash lifts the back off the floor on the impact
        # frame, so key that frame that much lower)
        loc.append((of * F, (rx * u, apex + (ry - apex) * g - (impact_drop if of == L else 0.0), 2.4 + (rz - 2.4) * u)))
        rot.append((of * F, (16 + (ax - 16) * g, ay * u, -2 + (az + 2) * u)))
    loc += [(T(land + 2), (rx, ry + bounce, rz)), (T(land + 4), (rx, ry, rz)), (T(land + 24), (rx, ry, rz))]
    rot += [(T(land + 2), (ax - 0.5, ay, az)), (T(land + 4), (ax, ay, az)), (T(land + 24), (ax, ay, az))]
    out = {root: {"loc": loc, "rot": rot,
                  "scale": [(0, (1, 1, 1)), ((L - 1) * F, (1, 1, 1)), (L * F, (1.05, 1.03, 0.88)), (T(land + 2), (0.99, 0.99, 1.04)),
                            (T(land + 5), (1, 1, 1)), (T(land + 24), (1, 1, 1))]}}
    wl, wd, wz = wing_land
    wing = [(0, (0, 0, 0)), (2, (0, -10, -34)), (4, (0, 14, -72)), (7, (0, -20, 48)), (11, (0, 20, -78)), (15, (0, -22, 52)), (19, (0, 24, -86)),
            (23, (0, -10, 28)), (top, (0, 18, -58)), (top + 6, (8, 26, -88)), (land, (wl * 0.5, 8, -40)), (land + 2, (wl, wd, wz)),
            (land + 4, (wl * 0.8, wd, wz - 7)), (land + 7, (wl, wd, wz + 1)), (land + 10, (wl, wd, wz)), (land + 24, (wl, wd, wz))]
    if wing_after is not None:
        wing = [(fr, v) for fr, v in wing if fr <= top] + [(land + df, v) for df, v in wing_after]
    out[wings[0]] = {"rot": [(T(fr), v) for fr, v in wing]}
    out[wings[1]] = {"rot": [(T(fr), mirror_x(v)) for fr, v in wing]}
    hx, hy, hz = head_land
    hrows = [(0, (0, 0, 0)), (2, (26, 4, 0)), (7, (-14, 12, 0)), (11, (22, -14, 0)), (15, (-12, 14, 0)), (19, (26, -12, 0)), (23, (-6, 8, 0)),
             (top, (30, 0, 0)), (top + 7, (-22, hy * 0.3, 0)), (land, (hx * 0.4, hy * 0.75, hz * 0.75)), (land + 3, (hx, hy * 0.9, hz * 0.9)),
             (land + 5, (hx * 0.9, hy * 0.97, hz)), (land + 9, (hx, hy, hz)), (land + 24, (hx, hy, hz))]
    out[head] = {"rot": [(T(fr), v) for fr, v in hrows]}
    if body:
        bl = body_land
        brows = [(0, (0, 0, 0)), (2, (-8, 0, 0)), (7, (12, 0, 0)), (11, (-10, 0, 0)), (15, (12, 0, 0)), (19, (-12, 0, 0)), (23, (8, 0, 0)),
                 (top, (-14, 0, 0)), (top + 7, (-18, 0, 0)), (land, (bl, 0, 0)), (land + 2, (bl - 1, 0, 0)), (land + 4, (bl, 0, 0)), (land + 24, (bl, 0, 0))]
        out[body] = {"rot": [(T(fr), v) for fr, v in brows]}
    if legs:
        for i, (leg, ll) in enumerate(zip(legs, leg_land)):
            d = 2 * i  # the second leg kicks two frames behind the first
            lx, ly, lz = ll
            lrows = [(0, (0, 0, 0)), (4 + d, (12, 0, lz * 0.5)), (8 + d, (-14, 0, 0)), (12 + d, (22, 0, lz)), (16 + d, (-10, 0, 0)), (20 + d, (26, 0, lz)),
                     (24 + d, (-6, 0, 0)), (top + 1 + d, (18, 0, lz)), (top + 7, (34, 0, lz)), (land + 1, (lx + 8, ly, lz)), (land + 3 + d, (lx + 4, ly, lz)),
                     (land + 6 + d, (lx, ly, lz)), (land + 24, (lx, ly, lz))]
            out[leg] = {"rot": [(T(fr), v) for fr, v in lrows]}
    if tail:
        tx, ty, tz = tail_land
        trows = [(0, (0, 0, 0)), (3, (-24, 0, 0)), (7, (14, 0, 0)), (11, (-20, 0, 4)), (15, (14, 0, -4)), (19, (-20, 0, 4)), (23, (10, 0, 0)),
                 (top, (-14, 0, 0)), (top + 7, (-10, 0, 0)), (land + 1, (tx, ty, tz)), (land + 3, (tx * 0.88, ty, tz * 0.88)), (land + 7, (tx, ty, tz)),
                 (land + 24, (tx, ty, tz))]
        out[tail] = {"rot": [(T(fr), v) for fr, v in trows]}
    return out, L * F


# ------------------------------------------------- per-frame pose helpers
def smooth_at(rows, fr: float):
    """Value at frame `fr` of [(frame, (x, y, z)), ...] on a monotone cubic
    (Fritsch-Carlson, like Blender's auto-clamped curves: flat at every
    turning point, no overshoot), so keys can be baked one a frame."""
    if fr <= rows[0][0]:
        return tuple(rows[0][1])
    if fr >= rows[-1][0]:
        return tuple(rows[-1][1])
    i = max(j for j in range(len(rows) - 1) if rows[j][0] <= fr)
    out = []
    for c in range(len(rows[0][1])):
        ts = [r[0] for r in rows]
        vs = [r[1][c] for r in rows]

        def slope(j):
            return (vs[j + 1] - vs[j]) / (ts[j + 1] - ts[j])

        def tangent(j):
            if j == 0 or j == len(ts) - 1:
                return 0.0
            a, b = slope(j - 1), slope(j)
            if a * b <= 0:
                return 0.0
            return 2 * a * b / (a + b)  # the harmonic mean keeps it monotone

        h = ts[i + 1] - ts[i]
        u = (fr - ts[i]) / h
        m0, m1 = tangent(i) * h, tangent(i + 1) * h
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        out.append(h00 * vs[i] + h10 * m0 + h01 * vs[i + 1] + h11 * m1)
    return tuple(out)


def euler_m(deg):
    """3x3 matrix of an XYZ euler in degrees about glTF axes (the exporter's
    convention: Rz @ Ry @ Rx)."""
    import numpy as np
    x, y, z = (math.radians(a) for a in deg)
    rx = np.array([[1, 0, 0], [0, math.cos(x), -math.sin(x)], [0, math.sin(x), math.cos(x)]])
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rz = np.array([[math.cos(z), -math.sin(z), 0], [math.sin(z), math.cos(z), 0], [0, 0, 1]])
    return rz @ ry @ rx


def m_euler(m):
    """XYZ euler degrees of a rotation matrix (the inverse of euler_m)."""
    sy = max(-1.0, min(1.0, -m[2][0]))
    y = math.asin(sy)
    if abs(sy) < 0.9999:
        x = math.atan2(m[2][1], m[2][2])
        z = math.atan2(m[1][0], m[0][0])
    else:
        x = math.atan2(-m[1][2], m[1][1])
        z = 0.0
    return (math.degrees(x), math.degrees(y), math.degrees(z))


def axis_m(axis, deg):
    """Rotation matrix about a unit axis (Rodrigues)."""
    import numpy as np
    a = math.radians(deg)
    k = np.asarray(axis, dtype=float)
    k = k / np.linalg.norm(k)
    K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(a) * K + (1 - math.cos(a)) * (K @ K)


def slerp_m(a, b, w):
    """Rotation matrix part way (w) from a to b, the short way."""
    import numpy as np
    r = a.T @ b
    ang = math.acos(max(-1.0, min(1.0, (np.trace(r) - 1) / 2)))
    if ang < 1e-6:
        return a
    axis = np.array([r[2][1] - r[1][2], r[0][2] - r[2][0], r[1][0] - r[0][1]]) / (2 * math.sin(ang))
    return a @ axis_m(axis, math.degrees(ang) * w)
