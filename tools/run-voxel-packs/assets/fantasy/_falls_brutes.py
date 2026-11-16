"""Shared keying for the fantasy brutes (goblin, minotaur, troll).

Three pieces, all keyed in glTF axes (x right, y up, z forward; the
creatures face -Z, so "back" is +Z):

`plant`: rigid legs whose SOLES stay on the floor while the root moves.
  A rigid leg turned about its hip tips its sole: the toe digs in when the
  foot trails behind, the heel when it reaches ahead. For each leg and
  frame the angle that keeps the foot at its target is solved, then the
  lowest sole corner is put exactly on the floor: the root comes down as
  far as the most hanging leg allows and every other leg slides up into
  its hip by the small difference (hidden in the kilt or loincloth). So no
  foot sinks and none floats, which a whole-model floor lift cannot give.

`knock_hit_base`: the root and the feet of a hit. The blow lands on frame
  0: the root is already moving fast on frame 1, knocked back and up on a
  gravity arc (peak about frame 4, down by frame 8), drifts on, then the
  feet step (or hop) home and the weight carries past rest before it
  settles. The upper body (body, head, arms, weapon, tail) is keyed by
  each creature, so the three hits act differently.

`topple_back`: a death onto the back (toward +Z). The blow rocks it back,
  it teeters onto its toes (a moving hold), then tips over backwards in one
  accelerating stroke about its heels (the heels stay put: the root slides
  so the turn is about the heel line, and the floor lift handles the
  height) into the impact on the floor, squashed flat; one small bounce,
  a hard settle. Loose parts land late and flop.
"""
from __future__ import annotations

import math

F = 1 / 30


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


def smooth(keys, t):
    """Like pl, but smoothstepped inside each span (keys are poses)."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-9, t1 - t0)
            u = u * u * (3 - 2 * u)
            if isinstance(v0, tuple):
                return tuple(a + (b - a) * u for a, b in zip(v0, v1))
            return v0 + (v1 - v0) * u
    return keys[-1][1]


def frames(k, rows):
    """[(frame, v), ...] -> [(seconds, v), ...] with every frame scaled by k."""
    return [(round(fr * k) * F, v) for fr, v in rows]


def sole_need(theta_deg: float, H: float, toe: float, heel: float) -> float:
    """How far the root must rise so a rigid leg turned by theta (about its
    hip, H above the floor) keeps its lowest sole corner on the floor.
    toe/heel: the sole's front and back z relative to the hip (toe < 0)."""
    a = math.radians(theta_deg)
    return max(H * math.cos(a) + z * math.sin(a) for z in (toe, heel)) - H


def plant(root_loc, feet: dict, H: float, toe: float, heel: float, end: float | None = None, smooth_root: bool = True):
    """Legs whose soles stay on the floor while the root moves.

    root_loc: the root's [(t, (x, y, z)), ...] (poses, smoothstepped between
    keys). feet: {leg: [(t, foot_z, lift), ...]}: the foot's z offset from
    its rest place (negative = forward) and how far it is raised off the
    floor (0 = planted). A root y above 0 lifts the whole model (a hop: the
    feet leave the floor with it); below 0 is a crouch (the legs slide up
    into the hips). Keyed every frame. Returns ({leg: {"rot", "loc"}},
    root_loc)."""
    last = end if end is not None else max([root_loc[-1][0]] + [k[-1][0] for k in feet.values()])
    n = round(last * 30)
    interp = smooth if smooth_root else pl
    out = {leg: {"rot": [], "loc": []} for leg in feet}
    new_root = []
    for fr in range(n + 1):
        t = fr * F
        rx, ry, rz = interp(root_loc, t)
        th, need = {}, {}
        for leg, k in feet.items():
            fz = smooth([(a, b) for a, b, _ in k], t)
            s = max(-0.95, min(0.95, (rz - fz) / H))
            th[leg] = math.degrees(math.asin(s))
            need[leg] = sole_need(th[leg], H, toe, heel)
        m = min(need.values())
        for leg, k in feet.items():
            lift = smooth([(a, c) for a, _, c in k], t)
            out[leg]["rot"].append((t, (th[leg], 0.0, 0.0)))
            out[leg]["loc"].append((t, (0.0, need[leg] - m + lift + max(0.0, -ry), 0.0)))
        new_root.append((t, (rx, ry + m, rz)))
    return out, new_root


def step_in(root_loc, H: float, toe: float, heel: float, stride: float, lift_t: float, plant_t: float, back_t: float, home_t: float,
            lead: str = "leg-l", rear: str = "leg-r", lift: float = 2.5, end: float | None = None):
    """A deliberate step for an attack: the rear foot stays planted; the lead
    foot lifts at lift_t, swings `stride` voxels (negative = forward) and
    plants on plant_t (the blow lands with the weight), stays planted
    through the hold, then steps home between back_t and home_t."""
    mid, hmid = (lift_t + plant_t) / 2, (back_t + home_t) / 2
    end = end if end is not None else root_loc[-1][0]
    feet = {lead: [(0, 0, 0), (lift_t, 0, 0), (mid, stride * 0.55, lift), (plant_t, stride, 0), (back_t, stride, 0),
                   (hmid, stride * 0.5, lift * 0.8), (home_t, 0, 0), (max(end, home_t), 0, 0)],
            rear: [(0, 0, 0), (max(end, home_t), 0, 0)]}
    return plant(root_loc, feet, H, toe, heel, end=end)


def knock_hit_base(root: str, H: float, toe: float, heel: float, k: float = 1.0, push: float = 4.0, pop: float = 2.0,
                   twist: float = 0.0, home: str = "steps", legs=("leg-l", "leg-r"), squash: float = 0.06, end: int = 30):
    """Root and feet of a hit (see the module notes). twist: degrees of yaw
    the blow spins it by while it is off the floor (it lands turned and
    turns back as it steps home). home: "steps" (left foot, then right),
    "hop" (both feet together, a small hop home) or "stagger" (one big step
    back with the right foot on landing, then both come home). Returns the
    {part: channels} for the root and the legs."""
    T = lambda fr: round(fr * k) * F  # noqa: E731
    p, h = push, pop
    # the gravity arc is not stretched by k (it is gravity), the recovery is
    loc = [(0, (0, 0, 0)), (1 * F, (0, h * 0.62, p * 0.5)), (4 * F, (0, h, p * 0.86)), (8 * F, (0, 0, p)), (T(12), (0, 0, p * 1.12))]
    if home == "hop":
        # gathers, hops home with both feet, lands past rest, settles
        loc += [(T(14), (0, -0.4, p * 1.08)), (T(17), (0, h * 0.35, p * 0.45)), (T(20), (0, 0, -p * 0.12)), (T(22), (0, -0.3, -p * 0.14)), (T(end), (0, 0, 0))]
        feet = {leg: [(0, 0, 0), (1 * F, 0, 0), (4 * F, p * f, 0), (8 * F, p, 0), (T(14), p, 0), (T(17), p * 0.35, 0), (T(20), 0, 0), (T(end), 0, 0)]
                for leg, f in zip(legs, (0.35, 0.4))}
    elif home == "stagger":
        # the right foot lands a long way back (it caught the weight), the
        # left lands short; the left steps home, then the right
        # (the left is planted again before the right leaves: never both up)
        loc += [(T(16), (0, -0.6, p * 0.75)), (T(22), (0, -0.2, p * 0.15)), (T(26), (0, -0.5, -p * 0.12)), (T(end), (0, 0, 0))]
        feet = {legs[0]: [(0, 0, 0), (1 * F, 0, 0), (4 * F, p * 0.3, 0), (8 * F, p * 0.7, 0), (T(13), p * 0.7, 0), (T(15.5), p * 0.35, 1.8), (T(18), 0, 0), (T(end), 0, 0)],
                legs[1]: [(0, 0, 0), (1 * F, 0, 0), (4 * F, p * 0.5, 0), (8 * F, p * 1.35, 0), (T(19), p * 1.35, 0), (T(21.5), p * 0.6, 2.0), (T(24), 0, 0), (T(end), 0, 0)]}
    else:
        loc += [(T(16), (0, 0, p * 0.55)), (T(21), (0, 0, -p * 0.12)), (T(end), (0, 0, 0))]
        feet = {legs[0]: [(0, 0, 0), (1 * F, 0, 0), (4 * F, p * 0.35, 0), (8 * F, p, 0), (T(12), p, 0), (T(14), p * 0.5, 1.8), (T(16), 0, 0), (T(end), 0, 0)],
                legs[1]: [(0, 0, 0), (1 * F, 0, 0), (4 * F, p * 0.4, 0), (8 * F, p, 0), (T(16), p, 0), (T(18.5), p * 0.5, 1.8), (T(21), 0, 0), (T(end), 0, 0)]}
    legk, root_loc = plant(loc, feet, H, toe, heel, end=T(end))
    out = dict(legk)
    out[root] = {"loc": root_loc,
                 # stretched up as it is thrown off the floor, squashed on the
                 # landing (no key on frame 1: a turning point there would
                 # make the exporter's ease linger just when it must be fastest)
                 "scale": [(0, (1, 1, 1)), (4 * F, (1 - squash * 0.4, 1 + squash, 1 - squash * 0.4)), (8 * F, (1 + squash * 0.6, 1 - squash, 1 + squash * 0.6)),
                           (T(12), (1, 1, 1)), (T(end), (1, 1, 1))]}
    if twist:
        tw = twist
        out[root]["rot"] = [(0, (0, 0, 0)), (1 * F, (0, tw * 0.45, 0)), (4 * F, (0, tw * 0.9, 0)), (8 * F, (0, tw, 0)), (T(12), (0, tw * 1.05, 0)),
                            (T(19), (0, -tw * 0.12, 0)), (T(end), (0, 0, 0))]
    return out


def _rx(a_deg, y, z):
    """(y, z) turned by a_deg about x (glTF: +x tips the top toward +Z)."""
    a = math.radians(a_deg)
    return y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)


def topple_back(root: str, hip, H: float, heel: float, k: float = 1.0, bounce: float = 1.0, rest_lift: float = 0.0, squash: float = 0.1,
                body: str = "body", head: str = "head", arms=("arm-l", "arm-r"), legs=("leg-l", "leg-r"),
                weapon: str | None = None, tail: str | None = None, flat: float = 90.0, rock: float = 0.5, leg_lag: float = 0.0, body_flex: float = 1.0,
                beats=None, arm_up=185.0, arm_spread=26.0, body_land: float = 2.0, head_back: float = 0.0, head_yaw: float = 12.0, head_land=None,
                leg_rest: float = 0.0, leg_spread: float = 6.0, leg_bump: float = 3.0, weapon_land=(20, 0, 0), weapon_fall=(10, 0, 0), weapon_hop=(10, 0, 0),
                tail_land=(20, 0, 25), tail_fall=(-24, 0, -10), arm_pre=45.0, arm_flop=6.0, power: float = 2.4):
    """A fall onto the back (toward +Z) with the heels pinned.

    beats: (rock, teeter, drift_end, impact) frames: the blow rocks it back
    (peak on `rock`), it teeters forward onto its toes (`teeter`) and
    drifts on the balance point (a moving hold) until `drift_end`, then
    tips over in one accelerating stroke into the impact (pass the returned
    time as Clip(impact=...)). Default: (4, 11, 16, 30) scaled by k.
    hip: the hips' (y, z) in ROOT space (to_root of the hip pivot); H the
    hip height and heel the heel's z from the hip. The root's location is
    solved every frame from the leg chain, so the heels stay put while it
    tips. leg_lag: degrees the legs lag the body at the end of the fall (a
    low pelvis or flap then lands WITH the back; the legs come down 2
    frames after the impact).
    ON the impact frame the torso AND the head are in their resting pose,
    flat on the floor, squashed (root z scale); the arms are already
    swinging down past the head (arm_pre degrees short of their rest) and
    land 2 frames later with a small flop; the legs land 2 frames after the
    impact with a small bump (leg_bump degrees); the weapon lands on impact
    + 2 and hops once (weapon_hop) then lies dead. ONE small bounce of the
    whole body (`bounce` voxels, up for 2 frames, down by 4), hard settle.
    head_back / head_yaw: the head's resting angles (x, y) relative to the
    body; head_land: its angles on the impact frame (default: the rest).
    power: how hard the tip-over accelerates into the floor (higher = a
    slower start off the balance point and a faster, heavier slam).
    rest_lift: extra root height after the impact, to lay the lying pose ON
    the floor (probe: lowest 0 at rest, the bounce peak = bounce).
    Returns (clip_keys, land_seconds)."""
    if beats is None:
        beats = (round(4 * k), round(11 * k), round(16 * k), round(30 * k))
    b1, b2, b3, L = beats

    def Q(d):
        return (L + d) * F

    a11, a16 = b2, b3
    v0 = 2.0 / max(1, a16 - a11)  # the drift on the toes, degrees a frame
    D = L - a16

    def theta(fr):
        if fr <= a16:
            return -5.0 + v0 * (fr - a11)
        d = fr - a16
        return -3.0 + v0 * d + (flat + 3.0 - v0 * D) * (d / D) ** power

    def lag(th):
        u = max(0.0, min(1.0, (th - 25.0) / (flat - 25.0)))
        return leg_lag * u * u * (3 - 2 * u)

    hy, hz = hip
    fy, fz = hy - H, hz + heel  # the heel in root space at rest (on the floor)
    rot, loc, lrot, scl = [(0, (0, 0, 0)), (b1 * F, (7.0, 0, 0))], [(0, (0, 0, 0)), (b1 * F, (0, 0, 0))], [(0, (0, 0, 0))], [(0, (1, 1, 1))]
    for fr in range(a11, L + 1):
        th, be = theta(fr), lag(theta(fr))
        ly, lz = _rx(-be, -H, heel)
        wy, wz = _rx(th, hy + ly, hz + lz)
        rot.append((fr * F, (th, 0.0, 0.0)))
        loc.append((fr * F, (0.0, fy - wy, fz - wz)))
        lrot.append((fr * F, (-be, 0.0, 0.0)))
        scl.append((fr * F, (1 + 1e-4 * (fr - a11), 1, 1)))
    yL, zL = loc[-1][1][1], loc[-1][1][2]
    h, b, s = yL + rest_lift, bounce, squash
    loc[-1] = (L * F, (0.0, h - s * max(0.0, h), zL))
    loc += [(Q(2), (0, h + b, zL)), (Q(4), (0, h, zL)), (Q(16), (0, h, zL))]
    rot += [(Q(2), (flat - rock, 0, 0)), (Q(4), (flat, 0, 0)), (Q(16), (flat, 0, 0))]
    scl[-1] = (L * F, (1 + s * 0.4, 1 + s * 0.3, 1 - s))
    scl += [(Q(2), (0.99, 0.99, 1.0 + s * 0.2)), (Q(4), (1, 1, 1)), (Q(16), (1, 1, 1))]
    out = {root: {"rot": rot, "loc": loc, "scale": scl}}
    mid = b3 + round(0.6 * D)  # late in the fall
    # the torso: snaps forward against the blow, arches back as it goes, flat on impact
    bl = body_land
    out[body] = {"rot": [(0, (0, 0, 0)), (b1 * F, (-8, 0, 0)), (b2 * F, (6, 0, 0)), (mid * F, (12, 0, 0)), (L * F, (bl, 0, 0)),
                         (Q(2), (bl - body_flex, 0, 0)), (Q(4), (bl, 0, 0)), (Q(16), (bl, 0, 0))]}
    # the head: whipped back by the blow, lags a little in the fall, flat ON
    # the impact frame, then only lolls to one side (no second hump)
    hb, hy_ = head_back, head_yaw
    hl = head_land if head_land is not None else (hb, hy_, 0.0)
    out[head] = {"rot": [(0, (0, 0, 0)), (b1 * F, (22, 0, 0)), (b2 * F, (-12, 0, 0)), (mid * F, (-18, 0, 0)), (L * F, hl),
                         (Q(3), (hb, hy_, 0)), (Q(16), (hb, hy_, 0))]}
    # the arms: thrown back by the blow, windmill on the teeter, flung up
    # toward the attacker as it goes over, already swinging down past the
    # head on the impact, slam flat 2 frames later, one small flop, dead
    aul, aur = arm_up if isinstance(arm_up, tuple) else (arm_up, arm_up)
    spl, spr = arm_spread if isinstance(arm_spread, tuple) else (arm_spread, arm_spread)

    def arm(sg, spread, au):
        # an arm resting overhead (au > 90) comes down past the head; one
        # resting along the side (au < 90) comes down from above the chest
        d = 1 if au > 90 else -1
        return [(0, (0, 0, 0)), (b1 * F, (-26, 0, -sg * 14)), (b2 * F, (34, 0, -sg * 30)), (b3 * F, (60, 0, -sg * 22)), (mid * F, (100, 0, sg * spread * 0.5)),
                (L * F, (au - d * arm_pre, 0, sg * spread * 0.85)), (Q(2), (au, 0, sg * spread)), (Q(4), (au - d * arm_flop, 0, sg * spread * 1.05)), (Q(7), (au, 0, sg * spread)), (Q(16), (au, 0, sg * spread))]
    out[arms[0]] = {"rot": arm(1, spl, aul)}
    out[arms[1]] = {"rot": arm(-1, spr, aur)}
    # the legs: rigid with the body until late in the fall (then they lag),
    # land 2 frames after the impact, a small bump, flat
    lr, ls = leg_rest, leg_spread
    out[legs[0]] = {"rot": lrot + [(Q(2), (lr, 0, -ls)), (Q(4), (lr + leg_bump, 0, -ls)), (Q(7), (lr, 0, -ls)), (Q(16), (lr, 0, -ls))]}
    out[legs[1]] = {"rot": lrot + [(Q(2), (lr, 0, ls)), (Q(5), (lr + leg_bump * 0.8, 0, ls)), (Q(8), (lr, 0, ls)), (Q(16), (lr, 0, ls))]}
    if weapon:
        w, wf, whp = weapon_land, weapon_fall, weapon_hop
        out[weapon] = {"rot": [(0, (0, 0, 0)), (b2 * F, (8, 0, 0)), (mid * F, tuple(x * 0.8 for x in wf)), (L * F, wf), (Q(2), w), (Q(4), whp), (Q(6), w), (Q(16), w)]}
    if tail:
        tl, tf = tail_land, tail_fall
        out[tail] = {"rot": [(0, (0, 0, 0)), (b2 * F, (-10, 0, 0)), (mid * F, tf), (L * F, tuple(0.5 * (x + y) for x, y in zip(tf, tl))), (Q(2), tl),
                             (Q(4), (tl[0] + 8, tl[1], tl[2] * 0.8)), (Q(7), tl), (Q(16), tl)]}
    return out, L * F
