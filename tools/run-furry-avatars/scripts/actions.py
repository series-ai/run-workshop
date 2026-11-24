"""Action clips for the anthro rig (run inside Blender, called from gait.bake_all).

Pose to pose, per the procedural-animation skill. Each clip is a list of keys; a key sets some channels,
each arriving ON the key's time (the move takes `d` seconds before it). Every channel is its own track,
so moves on different channels overlap freely: that's how the spine unrolls hips-first when standing up,
or the paw flicks a frame after the forearm. Strikes "snap" (3+ frames, spring overshoot), wind-ups and
recoveries "ease", falls accelerate ("in").

The legs are never keyed directly. Every frame they're re-solved by IK from the timeline's body and paw
channels, so planted paws stay exactly on the floor through crouches, lunges and rears, and stepping
paws follow their own planted spots while the body moves (staggering back). Airborne height is ballistic
(G = 30 m/s²), a death topples under gravity, and hands that touch the floor are solved onto it.

Channels in a key: any bone name -> (x, y, z) degrees, plus
  sink   body drop for the leg IK (negative = lower)      lean   hip pitch (+ = forward)
  tuck   leg fold in the air (paws pulled up)              up     extra root height (jumps)
  back   body moved backward, m (the paws stay planted)    root   whole-body rotation (death)
  plantL/plantR  where that paw is planted, m back from its stance spot
  liftL/liftR    that paw lifted off the floor, m          reachL/reachR  that paw moved forward under the body (knees up)
"""
import math
import os

import bpy
from mathutils import Euler, Matrix, Vector

from gait import CROUCH, FPS, STAND_SINK, ik_leg, key, leg_fk, new_action

G = 30.0
SIDE = ("L", "R")
META = ("t", "d", "e", "o")
NEUTRAL = {
    "sink": STAND_SINK, "lean": 3.0, "tuck": 0.0, "up": 0.0, "back": 0.0, "root": (0, 0, 0),
    "plantL": 0.0, "plantR": 0.0, "liftL": 0.0, "liftR": 0.0, "reachL": 0.0, "reachR": 0.0, "kneesOut": 0.0,
    "spine": (-1, 0, 0), "chest": (-2, 0, 0), "neck": (0, 0, 0), "head": (0, 0, 0), "jaw": (0, 0, 0),
    "ear.L": (0, 0, 0), "ear.R": (0, 0, 0),
    "upper_arm.L": (-4, 0, -4), "upper_arm.R": (-4, 0, 4), "forearm.L": (-16, 0, 0), "forearm.R": (-16, 0, 0),
    "hand.L": (0, 0, 0), "hand.R": (0, 0, 0), "fingers.L": (8, 0, 0), "fingers.R": (8, 0, 0),
    **{f"tail.{i}": (0, 0, 0) for i in range(5)},
}
STANCE = {"L": (-0.06, 8.0), "R": (0.17, 14.0, 40.0)}          # the idle's relaxed stand: one paw forward, one back
FIGHT = {"L": (-0.1, 13.0), "R": (0.2, 16.0, 30.0)}            # wider, longer: braced for attacks
SQUARE = {"L": (0.03, 12.0), "R": (0.03, 12.0)}                # paws level (jumps, roars, all fours)

# Where swing trails run (seconds, the claw-tip bone): the editor draws them, games can attach their own FX
TRAILS = {}


def mirror(pose):
    """Left <-> right: swap .L/.R names (incl. plantL-style channels) and flip y twist / z bend."""
    out = {}
    for k, v in pose.items():
        if k.endswith((".L", ".R")):
            k2 = k[:-2] + (".R" if k.endswith(".L") else ".L")
        elif k[-1:] in ("L", "R") and k[:-1] in ("plant", "lift", "reach"):
            k2 = k[:-1] + ("R" if k.endswith("L") else "L")
        else:
            k2 = k
        out[k2] = (v[0], -v[1], -v[2]) if isinstance(v, tuple) else v
    return out


def mirror_keys(keys):
    return [dict({m: k[m] for m in META if m in k}, **mirror({c: v for c, v in k.items() if c not in META})) for k in keys]


def mirror_place(place):
    return {"L": place["R"], "R": place["L"]}


def ease_f(f, kind, over):
    f = max(0.0, min(1.0, f))
    if kind == "snap":       # fast out, overshoot `over`, settle (ease-out-back)
        return 1 + (over + 1) * (f - 1) ** 3 + over * (f - 1) ** 2
    if kind == "whip":       # big strikes: build speed INTO the hit, then a small overshoot (ease-in-out-back);
        c2 = over * 1.525    # a fast-out ease would cover most of a 1 m slam in one frame and read as a teleport
        if f < 0.5:   # (a pure build-up: no wind-back at the start, the anticipation is its own key)
            return 4 * f ** 3
        return ((2 * f - 2) ** 2 * ((c2 + 1) * (2 * f - 2) + c2) + 2) / 2
    if kind == "in":         # accelerating (into an impact, a fall)
        return f * f
    if kind == "out":        # decelerating (a throw settling)
        return 1 - (1 - f) * (1 - f)
    if kind == "lin":
        return f
    return f * f * (3 - 2 * f)   # "ease": wind-ups, recoveries, drifting holds


class Timeline:
    """Per-channel tracks built from keys: dict(t=arrival s, d=move s, e=ease, o=overshoot, **channels)."""

    def __init__(self, keys, base=NEUTRAL):
        self.tracks = {c: [(-1e9, 0.0, "lin", 0.0, v)] for c, v in base.items()}
        for k in keys:
            for c, v in k.items():
                if c in META:
                    continue
                tr = self.tracks.setdefault(c, [(-1e9, 0.0, "lin", 0.0, v)])
                tr.append((k["t"], k.get("d", 0.12), k.get("e", "snap"), k.get("o", 1.2), v))
        for tr in self.tracks.values():
            tr.sort(key=lambda r: r[0])
    def at(self, t):
        out = {}
        for c, tr in self.tracks.items():
            i = 0
            for j in range(1, len(tr)):
                if t >= tr[j][0] - tr[j][1]:
                    i = j
            if i == 0:
                out[c] = tr[0][4]
                continue
            t1, d, e, o, vb = tr[i]
            va = tr[i - 1][4]
            f = ease_f((t - (t1 - d)) / d if d > 0 else 1.0, e, o)
            out[c] = tuple(x + (y - x) * f for x, y in zip(va, vb)) if isinstance(vb, tuple) else va + (vb - va) * f
        return out


def add(R, bone, dx=0.0, dy=0.0, dz=0.0):
    x, y, z = R.get(bone, (0, 0, 0))
    R[bone] = (x + dx, y + dy, z + dz)


# ---------------------------------------------------------------- legs: planted, stepping, tucked

def legs(J, R, st, place):
    """The fursuit stand IK with per-paw stepping. A paw's body-frame spot is its stance spot plus where
    it's planted in the world (plant) minus how far the body has moved back (back), lifted by lift and
    pulled forward under the body by reach (knees up)."""
    sink, lean = st["sink"] + st["tuck"], st["lean"]
    for s, sd in (("L", 1), ("R", -1)):
        dy, splay, *rest = place[s]
        meta = CROUCH["meta"] + (rest[0] if rest else 0.0)
        drop = (J[f"hip.{s}"].z - J[f"ball.{s}"].z) * (1 - math.cos(math.radians(splay)))
        lift = st[f"lift{s}"]
        y = J[f"ball.{s}"].y + 0.075 + dy + st[f"plant{s}"] - st["back"] - st[f"reach{s}"]
        ball_t = Vector((y, J[f"ball.{s}"].z - sink - drop + lift))
        # a lifted paw tips its heel down a little and curls its toes (it isn't flat on anything)
        lifted = min(1.0, (lift + max(0.0, -st["tuck"])) / 0.08)
        thigh, shin, foot, _ = ik_leg(J, s, lean, ball_t, meta - 10 * lifted)
        _, a = leg_fk(J, s, lean, thigh, shin, foot, 0)
        R.update({f"thigh.{s}": (thigh, -sd * st.get("kneesOut", 0.0), -sd * splay), f"shin.{s}": (shin, 0, 0), f"foot.{s}": (foot, 0, sd * splay * 0.8),
                  f"toes.{s}": (-a + 25 * lifted, 0, sd * splay * 0.2)})
    R["hips"] = (lean, 0, 0)   # hips only pitch: the leg IK accounts for exactly that


# ---------------------------------------------------------------- hands onto a surface (floor, ground items)

def _apply(arm, R, root_up, root_fwd):
    pb = arm.pose.bones
    for b in pb:
        x, y, z = R.get(b.name, (0, 0, 0))
        b.rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))
        b.location = (0, 0, 0)          # only rotations are posed (setting a bone's matrix also writes its location:
        b.scale = (1, 1, 1)             # a stale one would offset the next solve and leak into the export)
    pb["root"].location = Vector((0, root_up, root_fwd))
    bpy.context.view_layer.update()


def _solve(A, b):
    """Small dense linear solve (Gaussian elimination with pivoting); None if singular."""
    n = len(b)
    M = [list(A[i]) + [b[i]] for i in range(n)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[p][c]) < 1e-9:
            return None
        M[c], M[p] = M[p], M[c]
        for r in range(n):
            if r != c:
                f = M[r][c] / M[c][c]
                M[r] = [x - f * y for x, y in zip(M[r], M[c])]
    return [M[i][n] / M[i][i] for i in range(n)]


CUR = ["", 0]   # clip and frame being baked (for DEBUG_IK=<clip>)
_LAST = {}   # last frame's arm answer per side (reset per clip): a warm start that keeps the hands continuous


def hands_to(arm, R, root_up, root_fwd, targets, weight=1.0, palm_down=True, fingers=-8.0, fwd=(0, -1, -0.12), orient_only=False,
             side_dof="upper"):
    """Put each listed hand's knuckle on its target and (palm_down) turn it fingers along `fwd`, palm down.

    Continuous by construction (no twitch, no swinging round through the head): the target slides from
    where the KEYED arm already puts the knuckle to the goal as weight goes 0 -> 1, and every frame the
    solve starts from the keyed angles, so at weight 0 it returns exactly the keyed pose. The hand's turn
    blends by quaternion slerp (shortest way), never by lerping Euler angles.
    targets: side -> (y, z), or (x, y, z) to also place the hand sideways (the upper arm's side swing
    becomes a third unknown). Numerical: pose the rig, read the knuckle back, Newton steps."""
    weight = min(1.0, weight)
    if weight <= 0:
        for s in targets:
            _LAST.pop(s, None)
        return
    pb = arm.pose.bones
    for s, goal_ in targets.items():
        three = len(goal_) == 3
        goal = Vector(goal_) if three else Vector((0.0,) + tuple(goal_))
        keyed_hand = R.get(f"hand.{s}", (0, 0, 0))
        keyed_fing = R.get(f"fingers.{s}", (0, 0, 0))

        def knuckle(q):
            # the sideways unknown swings the whole arm out at the shoulder ("upper"), or keeps the elbow where the
            # keyed pose puts it (shoulder-width) and angles the forearm in ("forearm")
            ua, fa = R[f"upper_arm.{s}"], R[f"forearm.{s}"]
            fore_side = three and side_dof == "forearm"
            R[f"upper_arm.{s}"] = (q[0], ua[1], q[2] if three and not fore_side else ua[2])
            R[f"forearm.{s}"] = (q[1], fa[1], q[2] if fore_side else fa[2])
            _apply(arm, R, root_up, root_fwd)
            p = arm.matrix_world @ pb[f"fingers.{s}"].head
            return Vector((p.x if three else 0.0, p.y, p.z))
        if not orient_only:
            q = [R[f"upper_arm.{s}"][0], R[f"forearm.{s}"][0], R[f"forearm.{s}"][2] if side_dof == "forearm" else R[f"upper_arm.{s}"][2]]
            q_keyed = list(q)
            p_fk = knuckle(q)
            tgt = p_fk.lerp(goal, weight)
            # keep the target within reach (continuously: pull it toward the shoulder), so the solve never flails
            sh = arm.matrix_world @ pb[f"upper_arm.{s}"].head
            reach = 0.94 * (pb[f"upper_arm.{s}"].length + pb[f"forearm.{s}"].length + pb[f"hand.{s}"].length)
            p_fk3 = Vector((p_fk.x if three else sh.x, p_fk.y, p_fk.z))
            reach = max(reach, (p_fk3 - sh).length)   # never pull in closer than where the keyed arm already is
            d3 = Vector((tgt.x if three else sh.x, tgt.y, tgt.z)) - sh
            if d3.length > reach:
                d3 = d3 * (reach / d3.length)
                tgt = Vector(((sh + d3).x if three else 0.0, (sh + d3).y, (sh + d3).z))
            nv = 3 if three else 2

            def newton(q):
                q = list(q)
                for _ in range(40):
                    p = knuckle(q)
                    err = tgt - p
                    if err.length < 0.0005:
                        break
                    cols = []
                    for jj in range(nv):
                        q2 = list(q)
                        q2[jj] += 1.0
                        cols.append(knuckle(q2) - p)
                    rows = [0, 1, 2] if three else [1, 2]
                    # damped least squares: (J^T J + l^2 I) dq = J^T e. Stays tame near a straight arm, where the
                    # plain solve takes wild steps (the source of one-frame jumps)
                    Jm = [[cols[jj][r] for jj in range(nv)] for r in rows]
                    lam2 = 0.0004
                    JTJ = [[sum(Jm[r][a] * Jm[r][b] for r in range(len(rows))) + (lam2 if a == b else 0.0) for b in range(nv)] for a in range(nv)]
                    JTe = [sum(Jm[r][a] * err[rows[r]] for r in range(len(rows))) for a in range(nv)]
                    dq = _solve(JTJ, JTe)
                    if dq is None:
                        break
                    sc = min(1.0, 12.0 / max(max(abs(v) for v in dq), 1e-9))
                    for jj in range(nv):
                        q[jj] += dq[jj] * sc
                    q[1] = max(-150.0, min(10.0, q[1]))   # the elbow only bends one way
                return q, (knuckle(q) - tgt).length
            # two starts: the keyed angles (exact at weight 0) and the previous frame's answer (continuity);
            # keep whichever lands better, preferring the one closer to last frame on a tie
            # always from the keyed pose (same input -> same answer): a warm start from last frame let an
            # unreachable target's solution slide a little more each frame and snap back at the loop
            q = newton(q_keyed)[0]
            cands = [q]
            if os.environ.get("DEBUG_IK") == CUR[0]:
                print("IK", CUR[0], CUR[1], s, f"w={weight:.3f}", "keyed", [round(v, 1) for v in q_keyed], "fk", [round(v, 3) for v in p_fk],
                      "tgt", [round(v, 3) for v in tgt], "pick", [round(v, 1) for v in q])
            _LAST[s] = list(q)
            knuckle(q)
        if palm_down:
            # the palm faces in (to the thigh) at rest, i.e. along -X on the left hand, +X on the right:
            # turn the hand so its length runs along `fwd` and that face points at the floor
            sd = 1 if s == "L" else -1
            Yw = Vector(fwd).normalized()
            Xw = Vector((0, 0, sd))
            Xw = (Xw - Yw * Xw.dot(Yw)).normalized()
            Zw = Xw.cross(Yw)
            _apply(arm, R, root_up, root_fwd)
            hb = pb[f"hand.{s}"]
            M = Matrix((Xw, Yw, Zw)).transposed().to_4x4()
            M.translation = hb.head
            hb.matrix = M
            bpy.context.view_layer.update()
            q_goal = hb.rotation_euler.to_quaternion()
            hb.location, hb.scale = (0, 0, 0), (1, 1, 1)
            k_eul = Euler([math.radians(a) for a in keyed_hand])
            q_k = k_eul.to_quaternion()
            if q_k.dot(q_goal) < 0:   # same rotation, other hemisphere: flip it or the blend swings the long way round
                q_goal.negate()
            q = q_k.slerp(q_goal, weight)
            e = q.to_euler("XYZ", k_eul)   # compatible with the keyed angles: no 360-degree flips
            R[f"hand.{s}"] = tuple(math.degrees(a) for a in e)
            if fingers is not None:
                R[f"fingers.{s}"] = (keyed_fing[0] + (fingers - keyed_fing[0]) * weight, 0, 0)


# ---------------------------------------------------------------- the clip baker

def bake_action(arm, J, name, keys, place, length=None, loop=False, hook=None, trails=None):
    tl = Timeline(keys)
    _LAST.clear()
    T = length or max(k["t"] for k in keys)
    n = max(2, round(T * FPS))
    act = new_action(arm, name)
    for f in range(n + 1):
        t = (f % n) / FPS if loop else f / FPS
        st = tl.at(t)
        CUR[0], CUR[1] = name, f
        R = {}
        legs(J, R, st, place)
        for c, v in st.items():
            if isinstance(v, tuple) and c != "root":
                R[c] = v
        if any(st["root"]):
            R["root"] = st["root"]
        root_up, root_fwd = st["sink"] + st["up"], -st["back"]
        if hook:
            # detach the clip while hooks pose the rig to measure it: otherwise the first refresh after new keys
            # re-applies the action and overwrites the test pose (a one-frame wrong reading: the all-fours twitch)
            arm.animation_data.action = None
            root_up, root_fwd = hook(t, st, R, root_up, root_fwd)
            arm.animation_data.action = act
        key(arm, f, R, root_up, root_fwd)
    act["loop"] = loop
    if trails:
        TRAILS[name] = trails
    return act


def tail_lash(R, t, amp=14, rate=1.5, lift=0.0):
    for i in range(5):
        add(R, f"tail.{i}", lift, 0, amp * math.sin(2 * math.pi * rate * t - 0.7 * i))


def ears_flick(R, t):
    k = max(0.0, math.sin(2 * math.pi * 0.7 * t) - 0.85) / 0.15
    add(R, "ear.L", -14 * k)


def lash(amp=10, rate=1.5):
    return lambda t, st, R, u, f: (tail_lash(R, t, amp, rate), (u, f))[1]


# ---------------------------------------------------------------- poses

def arms(lu, lf, ru=None, rf=None, **extra):
    """Arm shorthand: upper arm and forearm for each side (right defaults to the mirror of left)."""
    ru = ru if ru is not None else (lu[0], -lu[1], -lu[2])
    rf = rf if rf is not None else (lf[0], -lf[1], -lf[2])
    return dict({"upper_arm.L": lu, "forearm.L": lf, "upper_arm.R": ru, "forearm.R": rf}, **extra)


EARS_BACK = {"ear.L": (-24, 0, 0), "ear.R": (-24, 0, 0)}
EARS_UP = {"ear.L": (8, 0, 0), "ear.R": (8, 0, 0)}

# a right-paw slash: cocked high and back, then raked down across the body, the body corkscrewing into it
SLASH_WIND_R = dict(sink=-0.13, lean=4, spine=(0, -10, 0), chest=(0, -22, 0), neck=(0, 6, 0), head=(8, 14, 0), jaw=(12, 0, 0),
                    **{"upper_arm.R": (2, 0, 138), "forearm.R": (-100, 0, 0), "hand.R": (0, 0, -26), "fingers.R": (38, 0, 0),
                       "upper_arm.L": (-50, 0, -30), "forearm.L": (-80, 0, 0), "fingers.L": (30, 0, 0), **EARS_BACK})
SLASH_HIT_R = dict(sink=-0.17, lean=20, spine=(5, 12, 0), chest=(9, 26, 0), neck=(0, -6, 0), head=(4, -12, 0), jaw=(4, 0, 0),
                   **{"upper_arm.R": (-82, 0, -32), "forearm.R": (-6, 0, 0), "hand.R": (0, 0, 28), "fingers.R": (46, 0, 0),
                      "upper_arm.L": (-10, 0, -30), "forearm.L": (-88, 0, 0)})
SLASH_FOLLOW_R = {"chest": (8, 20, 0), "upper_arm.R": (-76, 0, -26), "sink": -0.16}

FOURS = dict(sink=-0.32, lean=80, spine=(12, 0, 0), chest=(4, 0, 0), neck=(-42, 0, 0), head=(-42, 0, 0),
             **arms((-70, 0, -24), (-10, 0, 0)), **{"fingers.L": (-8, 0, 0), "fingers.R": (-8, 0, 0)}, **EARS_UP,
             **{f"tail.{i}": (-10, 0, 0) for i in range(5)})
FOURS_HANDS = (-0.48, 0.03)   # knuckles: forward of the hips (y) and just off the floor (z); thighs squat up under the body


# ---------------------------------------------------------------- clips

def bake_actions(arm, J):
    acts = {}

    def clip(nm, keys, place, **kw):
        acts[nm] = bake_action(arm, J, nm, keys, place, **kw)

    def floor_hands(sides, w_of, y=FOURS_HANDS[0], z=FOURS_HANDS[1], palm_down=True):
        def h(t, st, R, u, f):
            w = w_of(t)
            w = w * w * (3 - 2 * w)   # ease the hands on and off the floor (no snap)
            if w > 0:
                # each hand under its own shoulder, a little wider than the hips
                hands_to(arm, R, u, f, {s: (J[f"hip.{s}"].x * 1.9, J[f"hip.{s}"].y + y, z) for s in sides}, w, palm_down)
            return u, f
        return h

    # --- slashes (with swing trails on the striking claws)
    slash_r = [dict(t=0.0, **NEUTRAL),
               dict(t=0.17, d=0.17, e="ease", **SLASH_WIND_R),
               dict(t=0.31, d=0.15, e="whip", o=1.1, **SLASH_HIT_R),
               dict(t=0.33, d=0.06, e="ease", **{"hand.R": (0, 0, 40)}),           # the paw flicks through a frame late
               dict(t=0.48, d=0.19, e="ease", **SLASH_FOLLOW_R, **{"hand.R": (0, 0, 24)}),
               dict(t=0.85, d=0.37, e="ease", **NEUTRAL)]
    clip("slash_r", slash_r, FIGHT, hook=lash(12), trails=[dict(bone="R", start=0.18, end=0.4)])
    clip("slash_l", mirror_keys(slash_r), mirror_place(FIGHT), hook=lash(12), trails=[dict(bone="L", start=0.18, end=0.4)])
    combo = [dict(t=0.0, **NEUTRAL),
             dict(t=0.17, d=0.17, e="ease", **SLASH_WIND_R),
             dict(t=0.31, d=0.15, e="whip", o=1.1, **SLASH_HIT_R),
             dict(t=0.46, d=0.17, e="ease", **dict(mirror(SLASH_WIND_R), **{"upper_arm.R": (-72, 0, -22), "forearm.R": (-40, 0, 0)})),
             dict(t=0.6, d=0.15, e="whip", o=1.1, **dict(mirror(SLASH_HIT_R), **{"upper_arm.R": (-30, 0, 24), "forearm.R": (-84, 0, 0)})),
             dict(t=0.77, d=0.19, e="ease", **mirror(SLASH_FOLLOW_R)),
             dict(t=1.14, d=0.37, e="ease", **NEUTRAL)]
    clip("slash_combo", combo, FIGHT, hook=lash(14), trails=[dict(bone="R", start=0.18, end=0.4), dict(bone="L", start=0.47, end=0.69)])

    # --- maul: both paws up high, slammed down together
    maul = [dict(t=0.0, **NEUTRAL),
            dict(t=0.25, d=0.25, e="ease", sink=-0.12, lean=-2, spine=(-6, 0, 0), chest=(-12, 0, 0), head=(-10, 0, 0), jaw=(16, 0, 0),
                 **arms((-165, 0, -14), (-34, 0, 0)), **{"fingers.L": (36, 0, 0), "fingers.R": (36, 0, 0)}, **EARS_BACK),
            dict(t=0.4, d=0.16, e="whip", o=1.0, sink=-0.2, lean=26, spine=(8, 0, 0), chest=(14, 0, 0), head=(14, 0, 0), jaw=(2, 0, 0),
                 **arms((-60, 0, -18), (-6, 0, 0)), **{"fingers.L": (44, 0, 0), "fingers.R": (44, 0, 0)}),
            dict(t=0.48, d=0.08, e="ease", sink=-0.175),   # the impact rebounds
            dict(t=0.62, d=0.17, e="ease", sink=-0.18, chest=(12, 0, 0)),
            dict(t=1.0, d=0.38, e="ease", **NEUTRAL)]
    clip("maul", maul, FIGHT, trails=[dict(bone="L", start=0.26, end=0.46), dict(bone="R", start=0.26, end=0.46)])

    # --- bite: rear back with the mouth open, lunge, snap shut, shake, recover
    def shake(t, st, R, u, f):
        if 0.42 <= t <= 0.72:
            add(R, "head", 0, 14 * math.sin(2 * math.pi * (t - 0.42) / 0.2), 0)   # two shakes, 5 frames each
        return u, f
    bite = [dict(t=0.0, **NEUTRAL),
            dict(t=0.21, d=0.21, e="ease", sink=-0.12, lean=-2, chest=(-10, 0, 0), neck=(-12, 0, 0), head=(-14, 0, 0), jaw=(34, 0, 0),
                 **arms((-35, 0, -30), (-60, 0, 0)), **{"fingers.L": (34, 0, 0), "fingers.R": (34, 0, 0)}, **EARS_BACK),
            dict(t=0.33, d=0.12, e="snap", o=1.4, sink=-0.17, lean=30, spine=(10, 0, 0), chest=(12, 0, 0), neck=(22, 0, 0), head=(6, 0, 0)),
            dict(t=0.42, d=0.09, e="snap", o=0.8, jaw=(-2, 0, 0), head=(14, 0, 0), chest=(14, 0, 0)),   # chomp
            dict(t=0.72, d=0.3, e="ease", head=(14, 0, 0)),
            dict(t=1.08, d=0.36, e="ease", **NEUTRAL)]
    clip("bite", bite, FIGHT, hook=shake)

    # --- bark: two barks a second (loops). Each one gathers (a small dip, chin down), then barks UP: the chest
    # lifts, the snout tips up, the mouth opens, the ears perk; then it settles
    ks = [dict(t=0.0, **NEUTRAL)]
    for t0 in (0.0, 0.5):
        ks += [dict(t=t0 + 0.12, d=0.1, e="ease", head=(10, 0, 0), neck=(4, 0, 0), chest=(3, 0, 0), jaw=(0, 0, 0), sink=STAND_SINK - 0.03, lean=6,
                    **arms((4, 0, -6), (-30, 0, 0))),
               dict(t=t0 + 0.25, d=0.1, e="snap", o=1.5, head=(-26, 0, 0), neck=(-2, 0, 0), chest=(-9, 0, 0), spine=(-3, 0, 0), jaw=(32, 0, 0),
                    sink=STAND_SINK + 0.02, lean=1, **arms((-14, 0, -12), (-44, 0, 0)), **EARS_UP),
               dict(t=t0 + 0.44, d=0.15, e="ease", head=(0, 0, 0), neck=(0, 0, 0), chest=(-2, 0, 0), spine=(-1, 0, 0), jaw=(0, 0, 0),
                    sink=STAND_SINK, lean=3, **arms((-4, 0, -4), (-16, 0, 0)), **{"ear.L": (0, 0, 0), "ear.R": (0, 0, 0)})]
    clip("bark", ks, STANCE, length=1.0, loop=True, hook=lash(18, 2.0))

    # --- roar: gather, rear up chest-out, arms flung wide, the jaw wide; the chin stays well clear of the chest
    def tremble(t, st, R, u, f):
        if 0.42 <= t <= 1.15:
            k = min(1.0, (t - 0.42) / 0.1, (1.15 - t) / 0.1)
            add(R, "head", 0, 2.5 * k * math.sin(2 * math.pi * 7 * t), 0)   # 7 Hz: slower than the 12 Hz jitter limit
            add(R, "jaw", 3 * k * math.sin(2 * math.pi * 7 * t + 1.0))
            add(R, "chest", 1.2 * k * math.sin(2 * math.pi * 7 * t + 2.0))
        return u, f
    roar = [dict(t=0.0, **NEUTRAL),
            dict(t=0.25, d=0.25, e="ease", sink=-0.16, lean=14, chest=(10, 0, 0), neck=(6, 0, 0), head=(12, 0, 0),
                 **arms((-20, 0, -6), (-95, 0, 0)), **{"fingers.L": (40, 0, 0), "fingers.R": (40, 0, 0), "ear.L": (-10, 0, 0), "ear.R": (-10, 0, 0)}),
            # roar OUT: the body drives forward, the chest thrusts (spine arched), the arms sweep back and
            # wide with the claws spread, and the neck throws the head out AHEAD of the chest, snout level,
            # so the open jaw swings down in front of the chest instead of into it
            dict(t=0.42, d=0.17, e="snap", o=1.3, sink=-0.1, lean=12, spine=(-10, 0, 0), chest=(-14, 0, 0), neck=(30, 0, 0), head=(-26, 0, 0),
                 jaw=(34, 0, 0), **arms((38, 0, -38), (-22, 0, 0)), **{"fingers.L": (46, 0, 0), "fingers.R": (46, 0, 0), "ear.L": (-36, 0, 0),
                                                                        "ear.R": (-36, 0, 0), **{f"tail.{i}": (-8, 0, 0) for i in range(5)}}),
            dict(t=1.15, d=0.73, e="lin", jaw=(37, 0, 0), chest=(-16, 0, 0), neck=(32, 0, 0)),
            dict(t=1.6, d=0.45, e="ease", **NEUTRAL)]
    clip("roar", roar, SQUARE, hook=tremble)

    # --- hurt: knocked back, guard up, recover
    hurt = [dict(t=0.0, **NEUTRAL),
            dict(t=0.08, d=0.08, e="snap", o=1.0, sink=-0.12, lean=-8, chest=(-14, 0, 0), neck=(-6, 0, 0), head=(-10, 10, 0), jaw=(12, 0, 0),
                 **arms((-40, 0, -22), (-85, 0, 0)), **{"ear.L": (-30, 0, 0), "ear.R": (-30, 0, 0), **{f"tail.{i}": (10, 0, 0) for i in range(5)}}),
            dict(t=0.25, d=0.17, e="ease", chest=(-10, 0, 0), head=(-7, 8, 0)),
            dict(t=0.75, d=0.5, e="ease", **NEUTRAL)]
    clip("hurt", hurt, STANCE)

    # --- death: hit, stagger back two steps (arms wheeling), knees buckle, topple back under gravity, lie still
    L_FALL, T_BUCKLE = 1.0, 0.92   # a stiffer, taller fall (barely buckled) reads bigger
    th, om, tt, fall = 0.05, 1.1, 0.0, []
    while th < math.pi / 2:   # rigid fall about the heels: theta'' = (g / L) sin(theta)
        om += (G / L_FALL) * math.sin(th) / FPS / 4
        th += om / FPS / 4
        tt += 1 / FPS / 4
        fall.append((tt, min(th, math.pi / 2)))
    T_HIT = T_BUCKLE + fall[-1][0]

    def topple(t, st, R, u, f):
        if t <= T_BUCKLE:
            a = 0.0
        elif t < T_HIT:
            a = next(th_ for tt_, th_ in fall if tt_ >= t - T_BUCKLE)
        else:   # bounce off the floor: 6 degrees, then 2, then still
            dt = t - T_HIT
            a = math.pi / 2 - math.radians(10) * abs(math.sin(math.pi * dt / 0.2)) * (dt < 0.2) \
                - math.radians(3) * abs(math.sin(math.pi * (dt - 0.2) / 0.12)) * (0.2 <= dt < 0.32)
        k = a / (math.pi / 2)
        R["root"] = (-math.degrees(a), 0, 0)
        if T_BUCKLE < t < T_HIT:   # going over: the arms fling up and back, the head whips back, the mouth opens
            for s, sd in (("L", 1), ("R", -1)):
                R[f"upper_arm.{s}"] = (-60 - 90 * k, 0, -sd * (20 + 30 * k))
                R[f"forearm.{s}"] = (-30 + 20 * k, 0, 0)
            add(R, "head", -24 * k)
            add(R, "jaw", 18 * k)
        slam = 0.0
        if t >= T_HIT:   # the slam: the body bounces, the legs kick up and flop, the arms slap out, the head knocks
            dt = t - T_HIT
            add(R, "head", -16 * math.exp(-dt / 0.08) * math.cos(2 * math.pi * dt / 0.16))
            for s, sd in (("L", 1), ("R", -1)):   # (back is down when lying)
                R[f"upper_arm.{s}"] = (34, 0, -sd * (12 + 50 * min(1.0, dt / 0.12)))
                R[f"forearm.{s}"] = (-14, 0, 0)
            kick = math.exp(-dt / 0.14) * max(0.0, math.sin(math.pi * min(1.0, dt / 0.3)))
            st2 = dict(st, reachL=0.32 * kick, reachR=0.26 * kick, liftL=0.22 * kick, liftR=0.16 * kick)
            legs(J, R, st2, SQUARE)
            slam = 0.06 * max(0.0, math.sin(math.pi * dt / 0.16)) * (dt < 0.16) + 0.015 * max(0.0, math.sin(math.pi * (dt - 0.16) / 0.1)) * (0.16 <= dt < 0.26)
            for i in range(5):
                add(R, f"tail.{i}", 0, 0, 30 * math.exp(-dt / 0.12) * math.sin(2 * math.pi * dt / 0.2 - 0.6 * i))
        for i in range(5):   # the tail swings round to lie along the floor, not through it
            add(R, f"tail.{i}", (-34 if i == 0 else -10) * k)
        # as it tips over, trade the crouch's drop for the body's half thickness: it lies on its back, not in the floor
        return (u - st["sink"]) + st["sink"] * (1 - k) + 0.13 * k + slam, f
    flail = arms((-70, 0, -60), (-60, 0, 0))
    death = [dict(t=0.0, **NEUTRAL),
             dict(t=0.1, d=0.1, e="snap", o=1.0, sink=-0.12, lean=-10, chest=(-16, 0, 0), head=(-18, 8, 0), jaw=(20, 0, 0),
                  **{"ear.L": (-30, 0, 0), "ear.R": (-30, 0, 0)}, **arms((-50, 0, -10), (-90, 0, 0))),
             # the body reels back; each paw steps back to catch it (the planted one stays put)
             dict(t=0.75, d=0.65, e="out", back=0.5, lean=-14),
             dict(t=0.36, d=0.22, e="ease", plantR=0.3), dict(t=0.27, d=0.12, e="ease", liftR=0.09), dict(t=0.36, d=0.09, e="in", liftR=0.0),
             dict(t=0.62, d=0.24, e="ease", plantL=0.52), dict(t=0.52, d=0.12, e="ease", liftL=0.1), dict(t=0.62, d=0.1, e="in", liftL=0.0),
             dict(t=0.4, d=0.22, e="ease", **arms((-90, 0, -70), (-40, 0, 0))),        # arms wheel for balance
             dict(t=0.7, d=0.25, e="ease", **flail, head=(-10, -10, 0)),
             dict(t=T_BUCKLE, d=0.2, e="in", sink=-0.16, lean=-4, head=(10, 0, 0), jaw=(10, 0, 0), **arms((-40, 0, -30), (-30, 0, 0))),
             dict(t=T_HIT + 0.6, d=0.3, e="ease", head=(-6, 20, 0), jaw=(16, 0, 0),
                  **{"ear.L": (-10, 0, 0), "ear.R": (-10, 0, 0), **{f"tail.{i}": (0, 0, 6) for i in range(5)}})]
    clip("death", death, SQUARE, length=T_HIT + 0.9, hook=topple)

    # --- jump: fast crouch, a 3-frame push with the paws planted (arms lead), high ballistic air with the
    # knees driven up to the chest, then reach down, land and absorb
    T0, AIR = 0.25, 0.42
    v0 = G * AIR / 2

    def ballistic(t, st, R, u, f):
        if T0 <= t <= T0 + AIR:
            tau = t - T0
            u += v0 * tau - G * tau * tau / 2
        return u, f
    jump = [dict(t=0.0, **NEUTRAL),
            dict(t=0.13, d=0.11, e="ease", sink=-0.26, lean=18, head=(10, 0, 0), spine=(4, 0, 0),
                 **arms((30, 0, -10), (-30, 0, 0)), **{f"tail.{i}": (8, 0, 0) for i in range(5)}),
            dict(t=T0, d=0.12, e="in", sink=0.0, lean=2, head=(-10, 0, 0), spine=(-4, 0, 0),
                 **arms((-160, 0, -24), (-16, 0, 0)), **EARS_BACK, **{f"tail.{i}": (-8, 0, 0) for i in range(5)}),
            # knees up to the chest at the top: the left leg pulls up first, the right a beat (2 frames) later
            dict(t=T0 + 0.13, d=0.13, e="out", liftL=0.42, reachL=0.22, lean=10, spine=(10, 0, 0), head=(6, 0, 0), **arms((-80, 0, -30), (-70, 0, 0))),
            dict(t=T0 + 0.21, d=0.14, e="out", liftR=0.38, reachR=0.18),
            # legs reach for the floor, the left first again
            dict(t=T0 + AIR - 0.03, d=0.16, e="ease", liftL=0.0, reachL=0.0, spine=(0, 0, 0), **arms((-50, 0, -50), (-30, 0, 0))),
            dict(t=T0 + AIR + 0.04, d=0.16, e="ease", liftR=0.0, reachR=0.0),
            dict(t=T0 + AIR + 0.08, d=0.08, e="snap", o=0.6, sink=-0.28, lean=20, head=(12, 0, 0),   # land: squash
                 **{"ear.L": (8, 0, 0), "ear.R": (8, 0, 0), **{f"tail.{i}": (10, 0, 0) for i in range(5)}}),
            dict(t=T0 + AIR + 0.45, d=0.37, e="ease", **NEUTRAL)]
    clip("jump", jump, SQUARE, hook=ballistic)

    # --- waves (loops, arm raised): two quick wrist flicks then two big elbow swings; and a princess wave
    UP_R = {"upper_arm.R": (-4, 0, 86), "forearm.R": (-4, 0, 72), "hand.R": (0, 80, 0), "fingers.R": (2, 0, 0)}
    rest_l = {"upper_arm.L": (-4, 0, -4), "forearm.L": (-16, 0, 0), "fingers.L": (8, 0, 0)}
    wave = [dict(t=0.0, sink=STAND_SINK, lean=3, chest=(-2, 0, -4), head=(0, -8, -8), **UP_R, **rest_l)]
    for t0, amp in ((0.25, 1), (0.45, 1)):
        # (with the palm turned forward, flexing the wrist reads as a side-to-side flick)
        wave += [dict(t=t0, d=0.09, e="snap", o=1.0, **{"hand.R": (-26, 80, 0)}), dict(t=t0 + 0.12, d=0.09, e="ease", **{"hand.R": (14, 80, 0)})]
    for t0 in (0.8, 1.2):
        wave += [dict(t=t0, d=0.16, e="snap", o=1.2, **{"forearm.R": (-4, 0, 102), "hand.R": (-20, 80, 0)}, chest=(-2, 0, -1), head=(0, -8, -5)),
                 dict(t=t0 + 0.2, d=0.16, e="snap", o=1.2, **{"forearm.R": (-4, 0, 44), "hand.R": (16, 80, 0)}, chest=(-2, 0, -6), head=(0, -8, -10))]
    wave += [dict(t=0.72, d=0.12, e="ease", **{"hand.R": (0, 80, 0)}),
             dict(t=1.75, d=0.15, e="ease", **{"forearm.R": (-4, 0, 72), "hand.R": (0, 80, 0)}, chest=(-2, 0, -4), head=(0, -8, -8))]
    clip("wave", wave, STANCE, length=1.85, loop=True, hook=lash(10, 1.08))
    # princess: elbow tucked in, forearm up, the cupped paw turning at the wrist like screwing in a bulb, head tilted
    PR = {"upper_arm.R": (-12, 0, 50), "forearm.R": (-8, 0, 68), "fingers.R": (22, 0, 0)}   # paw up beside the head, elbow soft
    princess = [dict(t=0.0, sink=STAND_SINK, lean=3, chest=(-2, 0, 0), head=(4, -6, 10), **PR, **{"hand.R": (0, 60, 0)}, **rest_l)]
    for t0 in (0.0, 0.6):   # the paw turns at the wrist AND sweeps a small arc out and back (forearm), like a bulb-screw on a swing
        princess += [dict(t=t0 + 0.3, d=0.28, e="ease", **{"hand.R": (0, 20, 0), "forearm.R": (-20, 0, 98), "upper_arm.R": (-12, 0, 56)}, head=(4, -8, 12)),
                     dict(t=t0 + 0.6, d=0.28, e="ease", **{"hand.R": (0, 60, 0), "forearm.R": (-8, 0, 68), "upper_arm.R": (-12, 0, 50)}, head=(4, -6, 10))]
    clip("wave_princess", princess, {"L": (-0.04, 7.0), "R": (0.08, 10.0, 25.0)}, length=1.2, loop=True, hook=lash(6, 0.83))

    # --- all fours: drop onto the hands (palms down, thighs squatted up under the body), an idle, and back up
    FOURS_FULL = dict(NEUTRAL, **FOURS)
    down = [dict(t=0.0, **NEUTRAL),
            dict(t=0.32, d=0.32, e="ease", sink=-0.18, lean=34, spine=(8, 0, 0), head=(-10, 0, 0), **arms((-60, 0, -20), (-14, 0, 0))),
            dict(t=0.66, d=0.34, e="ease", **FOURS),
            dict(t=0.8, d=0.14, e="snap", o=0.4, sink=-0.34),      # the weight settles onto the hands
            dict(t=1.05, d=0.25, e="ease", sink=-0.32)]
    # the hands reach and arrive gradually (from 0.26 s to 0.66 s) instead of snapping onto the floor at the end
    clip("fours_down", down, SQUARE, hook=floor_hands(SIDE, lambda t: max(0.0, min(1.0, (t - 0.26) / 0.4))))

    def fours_life(t, st, R, u, f):
        br = math.sin(2 * math.pi * t)   # one slow breath a second
        add(R, "chest", 1.5 * br)
        add(R, "head", 2 * math.sin(2 * math.pi * 0.5 * t + 1), 14 * math.sin(2 * math.pi * 0.5 * t), 0)
        tail_lash(R, t, 16, 1.0)
        ears_flick(R, t)
        return floor_hands(SIDE, lambda _t: 1.0)(t, st, R, u - 0.006 * (1 + br), f)
    clip("fours_idle", [dict(t=0.0, **FOURS_FULL), dict(t=2.0, d=0.1, **FOURS_FULL)], SQUARE, length=2.0, loop=True, hook=fours_life)

    # standing up: push into the hands, then unroll from the hips up (hips, spine, chest, neck lead in turn),
    # the arms swinging back and the head staying level, a small overshoot to settle
    up = [dict(t=0.0, **FOURS_FULL),
          dict(t=0.12, d=0.12, e="ease", sink=-0.36),                                   # push down into the hands
          dict(t=0.42, d=0.3, e="ease", sink=-0.2, lean=40),                             # hips rise and swing back first
          dict(t=0.52, d=0.32, e="ease", spine=(6, 0, 0)),
          dict(t=0.6, d=0.34, e="ease", chest=(2, 0, 0), neck=(-14, 0, 0), head=(-14, 0, 0)),
          dict(t=0.5, d=0.26, e="ease", **arms((-20, 0, -16), (-50, 0, 0))),          # hands leave the floor, arms swing back
          dict(t=0.82, d=0.32, e="snap", o=0.5, sink=STAND_SINK, lean=3),
          dict(t=0.92, d=0.34, e="snap", o=0.6, spine=(-1, 0, 0), chest=(-2, 0, 0), neck=(0, 0, 0), head=(0, 0, 0),
               **arms((-4, 0, -4), (-16, 0, 0)), **{"ear.L": (0, 0, 0), "ear.R": (0, 0, 0)}),
          dict(t=1.0, d=0.4, e="ease", **{f"tail.{i}": (0, 0, 0) for i in range(5)}),
          dict(t=1.15, d=0.2, e="ease", **{"fingers.L": (8, 0, 0), "fingers.R": (8, 0, 0)})]
    clip("fours_up", up, SQUARE, hook=floor_hands(SIDE, lambda t: max(0.0, min(1.0, 1 - (t - 0.28) / 0.3))))

    # --- interaction: pick up from the floor, grab-and-stash, press something in front, gather (loop)
    def pick_hand(t, st, R, u, f):
        w = max(0.0, min(1.0, (t - 0.32) / 0.18, (0.86 - t) / 0.16))
        w = w * w * (3 - 2 * w)
        if w > 0:   # down to the floor for it
            hands_to(arm, R, u, f, {"R": (J["hip.R"].y - 0.36, 0.05)}, w, palm_down=True)
            R["fingers.R"] = st["fingers.R"]   # open to reach, then the grab
        w2 = max(0.0, min(1.0, (t - 0.9) / 0.3, (1.62 - t) / 0.22))
        w2 = w2 * w2 * (3 - 2 * w2)
        if w2 > 0:   # up to just in front of the nose and stop: a sniff, never into the face
            _apply(arm, R, u, f)
            hj = arm.matrix_world @ arm.pose.bones["head"].head
            hands_to(arm, R, u, f, {"R": (hj.x - 0.11, hj.y - 0.5, hj.z + 0.02)}, w2, palm_down=False)   # beside and just ahead of the nose, within reach
        return u, f
        return u, f
    pickup = [dict(t=0.0, **NEUTRAL),
              dict(t=0.2, d=0.2, e="ease", head=(22, 0, 0), neck=(8, 0, 0)),             # spot it
              dict(t=0.55, d=0.38, e="ease", sink=-0.36, lean=42, spine=(16, 0, 0), chest=(8, 0, 0), head=(10, 0, 0),
                   **arms((-12, 0, -14), (-30, 0, 0), (-60, 0, 14), (-10, 0, 0))),      # squat and reach
              dict(t=0.62, d=0.07, e="snap", o=0.6, **{"fingers.R": (68, 0, 0)}),        # grab
              dict(t=1.05, d=0.4, e="ease", sink=STAND_SINK - 0.02, lean=4, spine=(-1, 0, 0), chest=(-2, 0, 0), neck=(6, 0, 0), head=(22, -12, 0),
                   **arms((-4, 0, -4), (-16, 0, 0), (-40, 0, 14), (-40, 0, 0)), **{"hand.R": (0, 40, 0)}),   # rise holding it low...
              dict(t=1.35, d=0.12, e="ease", head=(20, -16, 6), **EARS_UP),
              dict(t=1.75, d=0.4, e="ease", **NEUTRAL)]
    clip("pickup", pickup, STANCE, hook=pick_hand)

    def happy(t, st, R, u, f):
        if 0.42 <= t <= 0.9:   # a little hop of joy (ballistic, 0.16 s of air) and a fast wag
            tau = t - 0.5
            if 0 <= tau <= 0.16:
                u += G * 0.16 / 2 * tau - G * tau * tau / 2
            tail_lash(R, t, 22, 3.0)
        return u, f
    collect = [dict(t=0.0, **NEUTRAL),
               dict(t=0.16, d=0.16, e="snap", o=0.25, lean=4, sink=-0.1, head=(-6, 22, 0), chest=(0, 16, 0),           # reach out to the side and up
                    **arms((-4, 0, -4), (-16, 0, 0), (-30, 0, 78), (-14, 0, 0)), **{"fingers.R": (-6, 0, 0), "ear.R": (10, 0, 0)}),
               dict(t=0.22, d=0.06, e="snap", o=0.5, **{"fingers.R": (72, 0, 0)}),                                    # snatch
               dict(t=0.42, d=0.2, e="ease", sink=-0.12, lean=8, head=(14, 0, 0), chest=(4, 0, 0),                    # hug it in
                    **arms((-40, 0, 10), (-100, 0, 0), (-46, 0, -10), (-108, 0, 0)), **EARS_UP),
               dict(t=0.5, d=0.08, e="in", sink=STAND_SINK + 0.01),                                                     # push off for the hop
               dict(t=0.7, d=0.06, e="snap", o=0.6, sink=-0.11),                                                        # land
               dict(t=1.05, d=0.35, e="ease", **NEUTRAL)]
    clip("collect", collect, SQUARE, hook=happy)

    press = dict(lean=8, sink=STAND_SINK - 0.02, head=(8, 0, 0), chest=(2, 0, 0))
    interact = [dict(t=0.0, **NEUTRAL),
                dict(t=0.22, d=0.22, e="ease", **press, **arms((-4, 0, -4), (-16, 0, 0), (-80, 0, 6), (-26, 0, 0)),
                     **{"fingers.R": (-4, 0, 0), "hand.R": (-10, 0, 0)}),                  # reach out to it
                dict(t=0.34, d=0.08, e="snap", o=0.6, **{"forearm.R": (-4, 0, 0), "hand.R": (-30, 0, 0)}, lean=11),   # press
                dict(t=0.46, d=0.1, e="ease", **{"forearm.R": (-26, 0, 0), "hand.R": (-10, 0, 0)}, lean=8),
                dict(t=0.56, d=0.08, e="snap", o=0.6, **{"forearm.R": (-4, 0, 0), "hand.R": (-30, 0, 0)}, lean=11),   # press again
                dict(t=0.7, d=0.12, e="ease", **{"forearm.R": (-26, 0, 0), "hand.R": (-10, 0, 0)}, lean=8, head=(4, 6, 6), **EARS_UP),
                dict(t=1.1, d=0.35, e="ease", **NEUTRAL)]
    clip("interact", interact, STANCE)

    # gather (loop): squatting low, the paws taking turns to pluck at the ground and drop it in a pile beside
    G_POSE = dict(sink=-0.38, lean=40, spine=(14, 0, 0), chest=(8, 0, 0), neck=(-6, 0, 0), head=(18, 0, 0), **EARS_UP)
    gather = [dict(t=0.0, **dict(NEUTRAL, **G_POSE, **arms((-50, 0, -12), (-30, 0, 0))))]
    for t0, s in ((0.0, "R"), (0.6, "L")):
        sd = -1 if s == "R" else 1
        gather += [dict(t=t0 + 0.18, d=0.16, e="snap", o=0.6, **{f"upper_arm.{s}": (-62, 0, -sd * 8), f"forearm.{s}": (-6, 0, 0), f"fingers.{s}": (0, 0, 0)},
                        head=(22, sd * 6, 0)),
                   dict(t=t0 + 0.24, d=0.06, e="snap", o=0.5, **{f"fingers.{s}": (70, 0, 0)}),                    # pluck
                   dict(t=t0 + 0.44, d=0.18, e="snap", o=0.6, **{f"upper_arm.{s}": (-30, 0, -sd * 40), f"forearm.{s}": (-60, 0, 0)}),   # toss aside
                   dict(t=t0 + 0.5, d=0.06, e="ease", **{f"fingers.{s}": (8, 0, 0)}),
                   dict(t=t0 + 0.6, d=0.12, e="ease", **{f"upper_arm.{s}": (-50, 0, -sd * 12), f"forearm.{s}": (-30, 0, 0)})]
    def typing_keys(base, t_len=2.0):
        """Both paws over a keyboard at waist height, fingers tapping in turn every 3 frames, the head bent to
        the screen; one emphatic Enter near the end."""
        ks = [dict(t=0.0, **base)]
        step = 3 / FPS
        tt, i = step, 0
        while tt < t_len - 0.45:
            s, o = ("L", "R") if i % 2 == 0 else ("R", "L")
            # (palm down, the hand's sideways axis is z: flexing there taps DOWN; the forearm bobs the paw up and down)
            fs, fo = base[f"forearm.{s}"][0], base[f"forearm.{o}"][0]
            ks += [dict(t=tt, d=0.06, e="snap", o=0.4, **{f"fingers.{s}": (0, 0, -28 if s == "L" else 28), f"forearm.{s}": (fs + 4, 0, 0),
                                                         f"fingers.{o}": (0, 0, 0), f"forearm.{o}": (fo - 3, 0, 0)})]
            tt += step * (1 + (i % 5 == 3))   # a tiny pause every so often
            i += 1
        ks += [dict(t=t_len - 0.32, d=0.12, e="ease", **{"forearm.R": (base["forearm.R"][0] - 22, 0, 0), "fingers.R": (0, 0, 0)},
                    head=(base["head"][0] - 4, 0, 4)),                                                                   # wind up...
               dict(t=t_len - 0.22, d=0.08, e="snap", o=0.6, **{"forearm.R": (base["forearm.R"][0] + 5, 0, 0), "fingers.R": (0, 0, 30)},
                    head=base["head"]),                                                                                  # ...Enter
               dict(t=t_len, d=0.18, e="ease", **{k: base[k] for k in ("forearm.L", "forearm.R", "fingers.L", "fingers.R")})]
        return ks
    TYPE = dict(NEUTRAL, lean=8, sink=STAND_SINK - 0.01, neck=(8, 0, 0), head=(12, 0, 0),
                **arms((-34, 0, -14), (-66, 0, 0)), **{"hand.L": (-4, 0, 0), "hand.R": (-4, 0, 0), "fingers.L": (6, 0, 0), "fingers.R": (6, 0, 0)})
    def keys_down(t, st, R, u, f):   # paws palm-down on the keyboard (the taps stay in the fingers)
        tail_lash(R, t, 6, 0.5)
        hands_to(arm, R, u, f, {"L": (0, 0), "R": (0, 0)}, 1.0, palm_down=True, fingers=None, fwd=(0, -1, -0.25), orient_only=True)
        return u, f
    clip("type", typing_keys(TYPE), STANCE, length=2.0, loop=True, hook=keys_down)

    # ---- sitting (on a seat about knee height): down, idle, up, and things done seated
    SEAT_H = 0.46   # top of the seat (the editor shows a stool this high during sit clips)
    # knees turned out from the hip (with the thighs level, a plain hip splay only swings the feet out and the
    # knees stay pinched together); a slight forward lean so the paws reach the knees
    SIT = dict(sink=-0.4, lean=8, kneesOut=24.0, reachL=0.42, reachR=0.42, spine=(2, 0, 0), chest=(2, 0, 0),
               **arms((-4, 0, -16), (-60, 0, 0)), **{"fingers.L": (20, 0, 0), "fingers.R": (20, 0, 0)},   # elbows hanging relaxed, paws on the knees
               **{f"tail.{i}": (-14 if i == 0 else -4, 0, 22 if i == 0 else 10) for i in range(5)})               # tail draped off the side of the seat
    SIT_FULL = dict(NEUTRAL, **SIT)
    SEAT = {"L": (0.0, 8.0), "R": (0.0, 8.0)}     # (the spread comes from kneesOut)   # knees comfortably apart
    def on_knees(sides, w_of):
        """Paws resting on top of the knees, fingers draped over them (solved to the knee each frame)."""
        def h(t, st, R, u, f):
            w = max(0.0, min(1.0, w_of(t)))
            w = w * w * (3 - 2 * w)
            if w > 0:
                _apply(arm, R, u, f)
                tg = {}
                for s in sides:
                    k = arm.matrix_world @ arm.pose.bones[f"shin.{s}"].head
                    # on top of the thigh just behind the knee: the knee joint is the thigh's centre, so lift by the
                    # thigh's thickness plus the paw's (both chunky) or the mitten sinks into the knee
                    # the paw's centre sits on the knee (the top leg joint): the knuckle a little ahead of it
                    tg[s] = (k.x, k.y - 0.06, k.z + 0.03)   # resting on the knee (a touch of overlap is fine, never hovering)
                # paws tipped up a little (fingers forward, not curled down into the knee); elbows stay out at
                # shoulder width, the forearms angle in to the knees
                hands_to(arm, R, u, f, tg, w, palm_down=True, fingers=14.0, fwd=(0, -1, -0.5), side_dof="forearm")   # paw tipped down over the knee
            return u, f
        return h

    sit_down = [dict(t=0.0, **NEUTRAL),
                dict(t=0.18, d=0.18, e="ease", head=(-4, 18, 0), neck=(0, 10, 0)),                      # glance back at the seat
                dict(t=0.42, d=0.3, e="ease", sink=-0.2, lean=22, reachL=0.16, reachR=0.16, head=(4, 0, 0), neck=(0, 0, 0),
                     **arms((-30, 0, -14), (-30, 0, 0))),                                              # bend and lower, arms forward to balance
                dict(t=0.78, d=0.36, e="ease", sink=-0.41, lean=12, reachL=0.42, reachR=0.42, kneesOut=24.0),   # down onto the seat, knees opening
                dict(t=0.9, d=0.12, e="snap", o=0.5, lean=8, sink=-0.4),                                # settle
                dict(t=1.0, d=0.3, e="ease", **{k: v for k, v in SIT.items() if k.startswith(("upper_arm", "forearm", "fingers", "spine", "chest", "tail"))},
                     head=(0, 0, 0))]
    clip("sit_down", sit_down, SEAT, hook=on_knees(SIDE, lambda t: (t - 0.7) / 0.3))

    def sit_life(t, st, R, u, f, knees=SIDE):
        br = math.sin(2 * math.pi * t / 1.5)
        add(R, "chest", 1.2 * br)
        add(R, "head", 1.5 * math.sin(2 * math.pi * t / 3), 16 * math.sin(2 * math.pi * t / 3), 0)
        tail_lash(R, t, 10, 1 / 3)
        ears_flick(R, t)
        u -= 0.004 * (1 + br)
        return on_knees(knees, lambda _t: 1.0)(t, st, R, u, f) if knees else (u, f)
    sit_idle = [dict(t=0.0, **SIT_FULL),
                dict(t=1.9, d=0.1, e="ease", liftR=0.03), dict(t=2.0, d=0.1, e="snap", o=0.4, liftR=0.0),   # a paw tap
                dict(t=2.25, d=0.1, e="ease", liftR=0.03), dict(t=2.35, d=0.1, e="snap", o=0.4, liftR=0.0),
                dict(t=3.0, d=0.1, **{k: SIT_FULL[k] for k in ("liftR",)})]
    clip("sit_idle", sit_idle, SEAT, length=3.0, loop=True, hook=sit_life)
    sit_up = [dict(t=0.0, **SIT_FULL),
              dict(t=0.25, d=0.25, e="ease", lean=28, sink=-0.39, reachL=0.26, reachR=0.26, head=(-6, 0, 0),
                   **arms((-10, 0, -10), (-70, 0, 0))),                                                      # lean forward, paws on the thighs
              dict(t=0.6, d=0.35, e="snap", o=0.4, sink=-0.12, lean=10, reachL=0.0, reachR=0.0, kneesOut=0.0),  # push up
              dict(t=0.95, d=0.35, e="ease", **NEUTRAL)]
    clip("sit_up", sit_up, SEAT, hook=on_knees(SIDE, lambda t: 1 - t / 0.55))   # paws peel off the knees as it leans and rises

    SIT_TYPE = dict(SIT_FULL, lean=6, neck=(8, 0, 0), head=(12, 0, 0), **arms((-36, 0, -14), (-68, 0, 0)),
                    **{"hand.L": (-4, 0, 0), "hand.R": (-4, 0, 0), "fingers.L": (6, 0, 0), "fingers.R": (6, 0, 0)})
    clip("sit_type", typing_keys(SIT_TYPE), SEAT, length=2.0, loop=True, hook=keys_down)

    # eat: lift the snack up under the snoot, open, chomp, chew, lower (loops)
    SNACK_LAP = {"upper_arm.R": (-26, 0, 8), "forearm.R": (-50, 0, 0), "hand.R": (0, 40, 0), "fingers.R": (50, 0, 0)}
    SNACK_UP = {"upper_arm.R": (-50, 0, 16), "forearm.R": (-104, 0, 0), "hand.R": (0, 50, 0)}
    eat = [dict(t=0.0, **dict(SIT_FULL, **SNACK_LAP)),
           dict(t=0.35, d=0.3, e="ease", **SNACK_UP, head=(10, 0, 0), neck=(10, 0, 0)),
           dict(t=0.42, d=0.1, e="ease", jaw=(26, 0, 0), **EARS_UP),
           dict(t=0.54, d=0.08, e="snap", o=0.6, jaw=(0, 0, 0), head=(14, 0, 0)),                     # chomp
           dict(t=0.7, d=0.16, e="ease", **SNACK_LAP, head=(4, 0, 0), neck=(0, 0, 0))]
    for i, t0 in enumerate((0.78, 0.96, 1.14, 1.32)):                                                   # chew, chew, chew
        eat += [dict(t=t0, d=0.08, e="ease", jaw=(10, 0, 0), head=(4 + 2 * (i % 2), 0, 2 * (-1) ** i)),
                dict(t=t0 + 0.09, d=0.08, e="ease", jaw=(0, 0, 0))]
    eat += [dict(t=1.6, d=0.12, e="ease", head=(0, 0, 0), **{"ear.L": (0, 0, 0), "ear.R": (0, 0, 0)}), dict(t=2.0, d=0.1, e="ease", head=(0, 0, 0))]
    clip("sit_eat", eat, SEAT, length=2.0, loop=True, hook=lambda t, st, R, u, f: sit_life(t, st, R, u, f, knees=("L",)))

    # talk: chatting seated, the jaw flapping syllables, paws gesturing palm-up in turn, nods
    talk = [dict(t=0.0, **SIT_FULL)]
    syll = [0.1, 0.24, 0.34, 0.5, 0.62, 0.78, 1.0, 1.12, 1.3, 1.42, 1.6, 1.76, 1.9, 2.1]
    for i, t0 in enumerate(syll):
        talk += [dict(t=t0, d=0.06, e="ease", jaw=(8 + 8 * ((i * 7) % 3) / 2, 0, 0)), dict(t=t0 + 0.07, d=0.05, e="ease", jaw=(1, 0, 0))]
    talk += [dict(t=0.4, d=0.2, e="snap", o=0.6, **{"upper_arm.R": (-40, 0, 20), "forearm.R": (-60, 0, 0), "hand.R": (0, 70, 0), "fingers.R": (4, 0, 0)},
                  head=(4, -10, 6)),
             dict(t=0.9, d=0.25, e="ease", **{"upper_arm.R": (-26, 0, -8), "forearm.R": (-50, 0, 0), "hand.R": (0, 0, 0), "fingers.R": (20, 0, 0)}),
             dict(t=1.2, d=0.2, e="snap", o=0.6, **{"upper_arm.L": (-40, 0, -20), "forearm.L": (-60, 0, 0), "hand.L": (0, -70, 0), "fingers.L": (4, 0, 0)},
                  head=(6, 10, -6)),
             dict(t=1.7, d=0.25, e="ease", **{"upper_arm.L": (-26, 0, 8), "forearm.L": (-50, 0, 0), "hand.L": (0, 0, 0), "fingers.L": (20, 0, 0)},
                  head=(-2, 0, 0)),
             dict(t=1.95, d=0.12, e="snap", o=0.6, head=(8, 0, 0)), dict(t=2.25, d=0.2, e="ease", head=(0, 0, 0)),   # a nod
             dict(t=2.4, d=0.1, e="ease", jaw=(0, 0, 0))]
    clip("sit_talk", talk, SEAT, length=2.4, loop=True, hook=lambda t, st, R, u, f: sit_life(t, st, R, u, f, knees=()))

    clip("gather", gather, {"L": (-0.02, 18.0), "R": (0.08, 18.0, 20.0)}, length=1.2, loop=True, hook=lash(8, 0.83))
    return acts
