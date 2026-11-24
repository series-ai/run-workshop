"""Baked clips for the anthro rig (run inside Blender, used by build.py).

  walk  a bouncy, dog-like digitigrade walk, in place, one stride per cycle
  run   the same legs at a run: shorter contact, longer reach, a flight phase
  idle  standing: breathing, a slow weight shift, ear flicks and a lazy tail

Every leg bone is rolled so its local X axis points to the character's left,
so a pitch (rotation about local X) swings a bone in the side plane and
pitches along a leg simply add up. That lets the gaits be written as pitch
angles per bone and checked with 2D forward kinematics: each frame the root
is moved up or down so the lowest paw sits exactly on the floor, which gives
the bob its timing (low on contact while the knee absorbs, high as the
standing leg passes under the hips and pushes off) without guessing.
Signs: +pitch swings thigh, upper arm and foot tips backward, folds the knee
(shin heel goes up behind) and curls the toes down.
"""
import math

import bpy
from mathutils import Euler, Vector

FPS = 24
STANCES = {}   # per-leg stance of each baked gait (gaitcheck reads it)

# stance: share of the cycle a paw is down. reach/back: thigh angle at contact and at
# lift-off. absorb/push: knee bend soaking up the landing and at push-off. fold: knee
# bend at the top of the swing. lean: forward lean from the hips. spring: extra bob
# after each push-off. flight: lift while both paws are off the ground (runs only).
# Dog hind-leg terms (degrees). reach / back: thigh angle at touch-down and lift-off (the
# stride). knee: how much knee and hock compress together under the weight. drive: how far
# the metatarsal kicks up behind as the hock straightens at push-off. lift: extra thigh
# swing forward mid-swing, so the knee comes up and the paw clears the floor. fold: knee
# bend that tucks the paw up. tuck: how far forward the folded metatarsal swings under the
# body. knuckle: toe curl just after lift-off. toe_up: toes tipping up as the paw reaches.
# lean, spring (extra bounce), flight (hang time, runs), arm, sway, wag.
CROUCH = dict(thigh=-15, knee=22, meta=14)   # never straight: the knee forward, the heel up
GAITS = {
    "walk": dict(frames=20, stance=0.56, clear=0.14, reach=-32, back=30, knee=26, drive=50, lift=36, fold=60, tuck=-18, knuckle=18, toe_up=32,
                 lean=9, spring=0.042, flight=0.0, arm=22, sway=5, wag=14, crouch=1.0),
    "trot": dict(frames=18, stance=0.22, bound=30.0, match=2.4, clear=0.3, reach=-18, back=22, knee=36, drive=64, lift=34, fold=84, tuck=-26, knuckle=40, toe_up=30,
                lean=17, spring=0.085, flight=0.0, arm=38, sway=4, wag=20, crouch=1.15),
    # sprint: all-out. Big foot flex (the heel rises hard over planted toes, the toes flick shut in the air and tip up to land),
    # a deep forward lean, very short contacts, long flat flights, the heel folded to the
    # rump, big pumping arms, ears pinned and the tail streaming straight back
    "sprint": dict(frames=14, stance=0.18, bound=30.0, match=3.0, clear=0.4, reach=-22, back=30, knee=40, drive=96, lift=40, fold=104, tuck=-32,
                   knuckle=78, toe_up=52, lean=28, spring=0.1, flight=0.0, arm=64, sway=3, wag=6, crouch=1.25),
    # gallop: the legs land one-two in quick succession (offset), then one long flight per stride; the arms
    # reach and pull together; one big bounce per stride instead of two
    "gallop": dict(frames=14, stance=0.2, offset=0.18, gallop=True, lead=1.2, trail=0.78, bound=30.0, match=2.0, clear=0.4, reach=-22, back=26, knee=38, drive=88,
                   lift=38, fold=96, tuck=-30, knuckle=70, toe_up=46, lean=22, spring=0.1, flight=0.0, arm=36, sway=2, roll=1.5, wag=8, crouch=1.2),
}


def keys(v, pts):
    """Smooth (cosine) interpolation through (t, value) keys, t in 0..1."""
    for (t0, a), (t1, b) in zip(pts, pts[1:]):
        if t0 <= v <= t1:
            f = (v - t0) / (t1 - t0) if t1 > t0 else 0
            return a + (b - a) * (0.5 - 0.5 * math.cos(math.pi * f))
    return pts[-1][1]


def leg_pose(phase, G):
    """One dog-style hind leg: thigh pitch, knee bend, metatarsal angle in the world
    (0 = its rest angle, + = heel up / paw back) and toe curl (+ down, - tips up).

    Stance: touch down on the toe pads with the leg reaching, knee and hock compress
    together as the weight comes on (the body dips), then the hock straightens and the
    metatarsal kicks up behind: the heel lifts and the toes push off.
    Swing: lift-off snaps the knee and hock shut so the paw tucks up behind with the toes
    knuckled; the thigh swings through and up so the knee leads and the paw clears the
    floor; then the hock opens, the toes tip up and the paw reaches out to land."""
    if phase < G["stance"]:
        u = phase / G["stance"]
        thigh = keys(u, [(0, G["reach"]), (1, G["back"])])
        knee = keys(u, [(0, 2), (0.3, 2 + G["knee"]), (0.72, 2 + G["knee"] * 0.5), (1, 0)])
        meta = keys(u, [(0, -4), (0.3, -G["knee"] * 0.6), (0.68, 0), (1, G["drive"])])
        curl = keys(u, [(0, -G["toe_up"] * 0.7), (0.16, 0), (1, 0)])   # toes still tipped up at touch-down, then flat
        return thigh, knee, meta, curl
    v = (phase - G["stance"]) / (1 - G["stance"])
    thigh = keys(v, [(0, G["back"]), (0.3, G["back"] * 0.3), (0.65, G["reach"] - G["lift"] * 0.5), (0.85, G["reach"] - G["lift"] * 0.15), (1, G["reach"])])
    knee = keys(v, [(0, 0), (0.25, G["fold"]), (0.55, G["fold"] * 0.85), (0.82, G["fold"] * 0.2), (1, 2)])
    meta = keys(v, [(0, G["drive"]), (0.25, G["drive"] * 0.75), (0.55, G["tuck"]), (0.85, G["tuck"] * 0.4), (1, -4)])
    curl = keys(v, [(0, -6), (0.12, -4), (0.3, G["knuckle"]), (0.5, G["knuckle"] * 0.3), (0.75, -G["toe_up"]), (1, -G["toe_up"] * 0.5)])
    return thigh, knee, meta, curl


def rot(p, deg):
    """Rotate a (y, z) point by a pitch about +x."""
    a = math.radians(deg)
    return Vector((p.x * math.cos(a) - p.y * math.sin(a), p.x * math.sin(a) + p.y * math.cos(a)))


def yz(v):
    return Vector((v.y, v.z))


def new_action(arm, name):
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    for b in arm.pose.bones:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
    return act


def key(arm, frame, R, root_up, root_fwd=0.0):
    """Key every bone (unlisted ones at rest): a clip never leaves a bone where the last clip put it
    (three.js keeps un-keyed bones as they were, e.g. a jaw left open after a roar)."""
    pb = arm.pose.bones
    for b in pb:
        x, y, z = R.get(b.name, (0, 0, 0))
        b.rotation_euler = Euler((math.radians(x), math.radians(y), math.radians(z)))
        b.keyframe_insert("rotation_euler", frame=frame)
        if b.name != "root":
            b.location, b.scale = (0, 0, 0), (1, 1, 1)   # never let a stale location (from IK matrix posing) into a clip
    pb["root"].location = Vector((0, root_up, root_fwd))   # root's local y is up (z: toward the back)
    pb["root"].keyframe_insert("location", frame=frame)


def smooth01(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def smooth_loop(vals, keep):
    """Low-pass a looping signal: keep the first `keep` harmonics (removes pops and kinks)."""
    n = len(vals)
    out = [0.0] * n
    for k in range(keep + 1):
        re = sum(v * math.cos(2 * math.pi * k * i / n) for i, v in enumerate(vals)) / n
        im = sum(v * math.sin(2 * math.pi * k * i / n) for i, v in enumerate(vals)) / n
        for i in range(n):
            out[i] += (1 if k == 0 else 2) * (re * math.cos(2 * math.pi * k * i / n) + im * math.sin(2 * math.pi * k * i / n))
    return out


def leg_fk(J, s, lean, thigh, shin, foot, toes):
    """Side-plane forward kinematics of one leg: (y, z) of hip, knee, hock, ball, toe."""
    pel = yz(J["pelvis"])
    hip = pel + rot(yz(J[f"hip.{s}"]) - pel, lean)
    a = lean + thigh
    knee = hip + rot(yz(J[f"knee.{s}"]) - yz(J[f"hip.{s}"]), a)
    a += shin
    hock = knee + rot(yz(J[f"hock.{s}"]) - yz(J[f"knee.{s}"]), a)
    a += foot
    ball = hock + rot(yz(J[f"ball.{s}"]) - yz(J[f"hock.{s}"]), a)
    toe = ball + rot(yz(J[f"toe.{s}"]) - yz(J[f"ball.{s}"]), a + toes)
    return [hip, knee, hock, ball, toe], a


def ik_leg(J, s, lean, ball_t, meta, hip_off=None):
    """Two-bone IK in the side plane: thigh, knee and foot pitches that put the ball of the
    paw at ball_t (y, z in the body frame) with the metatarsal at world angle `meta`, knee
    forward like a dog's stifle. Returns (thigh, shin, foot, overstretch)."""
    hock_t = ball_t - rot(yz(J[f"ball.{s}"]) - yz(J[f"hock.{s}"]), meta)
    pel = yz(J["pelvis"])
    hip = pel + rot(yz(J[f"hip.{s}"]) - pel, lean)
    if hip_off is not None:   # the hip joint moved by the hips' turn and roll
        hip = hip + hip_off
    v1, v2 = yz(J[f"knee.{s}"]) - yz(J[f"hip.{s}"]), yz(J[f"hock.{s}"]) - yz(J[f"knee.{s}"])
    l1, l2 = v1.length, v2.length
    d = hock_t - hip
    dist = min(max(d.length, abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    ang = math.atan2(d.y, d.x)
    alpha = math.acos(max(-1, min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))))
    kn = min((hip + Vector((math.cos(ang + sg * alpha), math.sin(ang + sg * alpha))) * l1 for sg in (1, -1)), key=lambda k: k.x)
    hk = hip + d.normalized() * dist
    a1 = math.degrees(math.atan2((kn - hip).y, (kn - hip).x) - math.atan2(v1.y, v1.x))
    a2 = math.degrees(math.atan2((hk - kn).y, (hk - kn).x) - math.atan2(v2.y, v2.x))
    a1 = (a1 + 180) % 360 - 180
    a2 = a1 + ((a2 - a1 + 180) % 360 - 180)
    return a1 - lean, a2 - a1, meta - a2, d.length - dist


def stand_legs(J, R, sink, lean=2.0, meta=None, place=None):
    """A fursuit stand: both paws flat on the floor, the body sunk by `sink` so the knees and
    hocks stay flexed (never the straight humanoid leg). `place` sets each paw: {side: (dy
    forward-/back+, splay degrees out to the side)}; the default is a relaxed, slightly wide
    stance. Fills R; returns the root bob."""
    meta = CROUCH["meta"] if meta is None else meta
    place = place or {"L": (0.0, 9.0), "R": (0.0, 9.0)}
    for s, sd in (("L", 1), ("R", -1)):
        dy, splay, *rest = place[s]
        leg_meta = meta + (rest[0] if rest else 0.0)   # extra heel lift for this paw
        # splaying the leg out tilts it, which lifts the paw: reach a little further down to keep it planted
        drop = (J[f"hip.{s}"].z - J[f"ball.{s}"].z) * (1 - math.cos(math.radians(splay)))
        # the paws sit back under the hips so the weight is over them and the thighs come near upright
        ball_t = Vector((J[f"ball.{s}"].y + 0.075 + dy, J[f"ball.{s}"].z - sink - drop))   # body frame: the root carries the sink
        thigh, shin, foot, _ = ik_leg(J, s, lean, ball_t, leg_meta)
        _, a = leg_fk(J, s, lean, thigh, shin, foot, 0)
        # out to the side at the hip, and the foot levelled back so the paw stays flat
        R.update({f"thigh.{s}": (thigh, 0, -sd * splay), f"shin.{s}": (shin, 0, 0), f"foot.{s}": (foot, 0, sd * splay * 0.8),
                  f"toes.{s}": (-a, 0, sd * splay * 0.2)})
    R["hips"] = (lean, 0, 0)
    return sink


def bake_gait(arm, J, name, plot=None):
    G = GAITS[name]
    act = new_action(arm, name)
    n, lean, st = G["frames"], G["lean"], G["stance"]
    OFF = G.get("offset", 0.5)          # the right leg's phase behind the left (0.5: alternating; less: a gallop)
    BF = 2 if G.get("gallop") else 4    # body bounces per cycle x 2 (one bound per stride in a gallop)
    c = G.get("crouch", 1.0)
    # the hips turn (yaw) and roll with the stride but keep a fixed pitch (the bounce lives in the spine):
    # a hip pitch swings the whole leg (4 degrees is ~6 cm at the paw) and was the walk's pop. The turn and
    # roll move the hip joints, so the leg IK takes that offset, and the thighs counter-rotate (below) so a
    # planted paw stays put sideways too.
    sway_a, roll_a = G["sway"], G.get("roll", 4.0)
    Mh = arm.data.bones["hips"].matrix_local.to_3x3()
    Mhi = Mh.inverted()

    def hips_rot(t):
        w_ = 2 * math.pi * t
        return sway_a * math.sin(w_), roll_a * math.cos(w_)

    def hip_off(s, t):
        yaw, roll = hips_rot(t)
        v = J[f"hip.{s}"] - J["pelvis"]
        full = Mh @ Euler((math.radians(lean), math.radians(yaw), math.radians(roll))).to_matrix() @ Mhi
        flat_ = Mh @ Euler((math.radians(lean), 0, 0)).to_matrix() @ Mhi
        d = full @ v - flat_ @ v
        return Vector((d.y, d.z))

    def ball_of(s, thigh, shin, meta):
        foot = meta - (lean + thigh + shin)
        return leg_fk(J, s, lean, thigh, shin, foot, 0)[0][3]

    # per-leg gait (a gallop's legs differ: the leap leg reaches further and stays down longer, the hop leg takes
    # a short quick step; stance times scale with the strides so both planted paws slide at the same speed)
    GS = {"L": G, "R": G}
    if G.get("lead"):
        GS = {"L": dict(G, reach=G["reach"] * G["lead"], back=G["back"] * G["lead"], clear=G["clear"] * 1.15),
              "R": dict(G, reach=G["reach"] * G["trail"], back=G["back"] * G["trail"], clear=G["clear"] * 0.7)}
        Dl = {k: ball_of(k, GS[k]["back"] + CROUCH["thigh"] * c - lean, 0 + CROUCH["knee"] * c, G["drive"] + CROUCH["meta"] * c).x
              - ball_of(k, GS[k]["reach"] + CROUCH["thigh"] * c - lean, 2 + CROUCH["knee"] * c, -4 + CROUCH["meta"] * c).x for k in "LR"}
        for k in "LR":
            GS[k]["stance"] = st * 2 * Dl[k] / (Dl["L"] + Dl["R"])
        print(name.upper(), "per-leg stance", {k: round(GS[k]["stance"], 3) for k in "LR"})
    STS = {k: GS[k]["stance"] for k in "LR"}
    STANCES[name] = STS

    def touch_points(s):
        y0 = ball_of(s, GS[s]["reach"] + CROUCH["thigh"] * c - lean, 2 + CROUCH["knee"] * c, -4 + CROUCH["meta"] * c).x
        y1 = ball_of(s, GS[s]["back"] + CROUCH["thigh"] * c - lean, 0 + CROUCH["knee"] * c, G["drive"] + CROUCH["meta"] * c).x
        return y0, y1


    def solve_thigh(s, target_y, shin, meta, guess):
        """Find the thigh angle that puts the ball of the paw at target_y (bisection)."""
        lo, hi = guess - 60, guess + 60
        f_lo = ball_of(s, lo, shin, meta).x - target_y
        for _ in range(40):
            mid = (lo + hi) / 2
            f_mid = ball_of(s, mid, shin, meta).x - target_y
            if (f_mid > 0) == (f_lo > 0):
                lo, f_lo = mid, f_mid
            else:
                hi = mid
        return (lo + hi) / 2

    frames = []
    for f in range(n):   # pass 1: pose the legs and find where the paws are
        t = f / n
        legs, need, low_any = {}, [], []
        for s, ph in (("L", t), ("R", (t + OFF) % 1)):
            thigh, shin, meta, curl = leg_pose(ph, GS[s])
            thigh, shin, meta = thigh + CROUCH["thigh"] * c - lean, shin + CROUCH["knee"] * c, meta + CROUCH["meta"] * c
            planted = ph < STS[s]
            if planted:
                # lock the planted paw to the floor: it must slide back at exactly the body's speed,
                # so solve the thigh for a ball position moving back linearly from touch-down to lift-off
                u = ph / STS[s]
                y0, y1 = touch_points(s)
                thigh = solve_thigh(s, y0 + (y1 - y0) * u, shin, meta, thigh)
            foot = meta - (lean + thigh + shin)   # the metatarsal is posed by its angle in the world (pitches add down the chain)
            _, a = leg_fk(J, s, lean, thigh, shin, foot, 0)
            # planted toes lie flat on the floor; just after lift-off they stay flat (peeling off the floor) before curling
            flat = 1.0 if planted else keys((ph - STS[s]) / (1 - STS[s]), [(0, 1.0), (0.22, 0.0), (1, 0.0)])
            toes = -a * (0.6 + 0.4 * flat) + curl
            pts, _ = leg_fk(J, s, lean, thigh, shin, foot, toes)
            low = min(pts[3].y - J[f"ball.{s}"].z, pts[4].y - J[f"toe.{s}"].z)
            low_any.append(low)
            if planted:
                need.append(low)
            legs[s] = dict(thigh=thigh, shin=shin, foot=foot, toes=toes, pts=pts, planted=planted, low=low)
        frames.append(dict(t=t, legs=legs, need=-min(need) if need else None, any=-min(low_any)))
    # pass 2: the bounce. Author the body's height as a spring: lowest as the standing leg
    # compresses mid-stance, highest as it pushes off and the body flies (twice per stride).
    # The baseline is the crouched pose's own height, so the legs fit.
    raw = [fr["need"] if fr["need"] is not None else fr["any"] for fr in frames]
    base = sum(raw) / n
    low_t = st * 0.55
    if G.get("gallop"):
        # one contact window (both paws, one-two) and one flight per stride
        Tc = n / FPS
        # the right paw's phase runs OFF ahead, so it lands first (at t = 1 - OFF), then the left lands (t = 0)
        # and is the last off the ground (t = its stance): the contact window runs from the right's touch-down
        # to the left's lift-off, and the flight is everything else
        win = OFF + STS["L"]
        tc_, tf = win * Tc, (1 - win) * Tc
        g = G["bound"]
        v_land = g * tf / 2
        A_dip = min(0.16, v_land * tc_ / math.pi)
        print(name.upper(), f"gallop: flight {tf:.3f}s, peak {g * tf * tf / 8 * 100:.1f}cm, ground dip {A_dip * 100:.1f}cm")

        def authored(t):
            tau = (t + OFF) % 1.0   # 0 at the first paw's touch-down
            if tau < win:
                h = -A_dip * math.sin(math.pi * tau / win)
            else:
                tt = (tau - win) * Tc
                h = v_land * tt - g * tt * tt / 2
            return base + A_dip * 0.5 + h
    elif G.get("bound"):
        # a bounding run: real gravity in the air (a parabola, constant g), a half-sine spring on the
        # ground whose speed at touch-down and take-off matches the flight's, so nothing pops
        Tc = n / FPS
        ts, tf = st * Tc, (0.5 - st) * Tc
        g = G["bound"]
        v_land = g * tf / 2
        A_dip = v_land * ts / math.pi
        print(name.upper(), f"bound: flight {tf:.3f}s, peak {g * tf * tf / 8 * 100:.1f}cm, ground dip {A_dip * 100:.1f}cm")

        def authored(t):
            tau = t % 0.5
            if tau < st:
                h = -A_dip * math.sin(math.pi * tau / st)
            else:
                tt = (tau - st) * Tc
                h = v_land * tt - g * tt * tt / 2
            return base + A_dip * 0.5 + h
    else:
        def authored(t):
            return base + G["spring"] * -math.cos(4 * math.pi * (t - low_t))
    bob = [authored(fr["t"]) for fr in frames]
    bob_table = {}

    def bob_at(t):
        """The body's height at time t: the authored curve, or the reach-corrected table on frames."""
        key_ = round(t % 1, 6)
        if key_ in bob_table:
            return bob_table[key_]
        return authored(t)

    def ik(s, ph):
        """Planted leg at phase ph, solved so the paw stays exactly on the floor (two-bone IK)."""
        t = ph if s == "L" else (ph - OFF) % 1
        u = min(1.0, max(0.0, ph / STS[s]))
        _, _, meta, curl = leg_pose(min(ph, STS[s] - 1e-6), GS[s])
        meta += CROUCH["meta"] * c
        y0, y1 = touch_points(s)
        ball_t = Vector((y0 + (y1 - y0) * u, J[f"ball.{s}"].z - bob_at(t)))   # in the body's frame (the root carries the bob)
        thigh, shin, foot, over = ik_leg(J, s, lean, ball_t, meta, hip_off(s, t))
        return thigh, shin, foot, curl, over

    def swing(s, ph):
        """The swing as an animator would key it: plan the paw's path, then solve the leg to
        follow it. The paw peels up from where it left the floor, rises to `clear` (the knee
        comes up for it), swings forward and eases down onto the touch-down spot, so it never
        drops or hops onto the floor. The metatarsal angle and toe curl come from the curves."""
        t = ph if s == "L" else (ph - OFF) % 1
        v = (ph - STS[s]) / (1 - STS[s])
        _, _, meta, curl = leg_pose(ph, GS[s])
        meta += CROUCH["meta"] * c
        y0, y1 = touch_points(s)
        # Hermite path from lift-off (y1) to touch-down (y0) that leaves and arrives moving back at the
        # floor's speed: the paw carries on back a touch after lift-off and lands already matching the
        # ground, so there's no reversal pop at contact (match caps the speed for short-contact gaits)
        D = y1 - y0
        m = D * min((1 - STS[s]) / STS[s], G.get("match", 1.0))
        h00, h10, h01, h11 = 2 * v ** 3 - 3 * v ** 2 + 1, v ** 3 - 2 * v ** 2 + v, -2 * v ** 3 + 3 * v ** 2, v ** 3 - v ** 2
        y = h00 * y1 + h10 * m + h01 * y0 + h11 * m
        if G.get("bound"):   # a bound: fold up hard right after push-off, stay tucked through the air, reach down late
            lift = GS[s]["clear"] * (smooth01(v / 0.28) ** 0.7) * (1 - smooth01((v - 0.66) / 0.34) ** 1.6)
        else:
            lift = GS[s]["clear"] * math.sin(math.pi * min(1.0, v ** 0.72)) ** 1.4   # up quickly, settle down softly
        ball_t = Vector((y, J[f"ball.{s}"].z + lift - bob_at(t)))
        thigh, shin, foot, _ = ik_leg(J, s, lean, ball_t, meta, hip_off(s, t))
        return thigh, shin, foot, curl

    for _ in range(3):   # make every touch-down reachable: sink the body where a planted leg falls short
        fix = [0.0] * n
        for i, fr in enumerate(frames):
            for s, L in fr["legs"].items():
                if L["planted"]:
                    ph = fr["t"] if s == "L" else (fr["t"] + OFF) % 1
                    fix[i] = max(fix[i], ik(s, ph)[4])
        if max(fix) < 1e-4:
            break
        bob = smooth_loop([b - f - 0.004 * (f > 0) for b, f in zip(bob, fix)], 6)
        bob_table = {round(fr["t"], 6): b for fr, b in zip(frames, bob)}
    worst = 0.0
    for i, fr in enumerate(frames):
        for s, L in fr["legs"].items():
            ph = fr["t"] if s == "L" else (fr["t"] + OFF) % 1
            if L["planted"]:
                thigh, shin, foot, curl, over = ik(s, ph)
                worst = max(worst, over)
                flat = 1.0
            else:
                thigh, shin, foot, curl = swing(s, ph)
                flat = keys((ph - STS[s]) / (1 - STS[s]), [(0, 1.0), (0.22, 0.0), (1, 0.0)])
            _, a = leg_fk(J, s, lean, thigh, shin, foot, 0)
            toes = -a * (0.6 + 0.4 * flat) + curl
            pts, _ = leg_fk(J, s, lean, thigh, shin, foot, toes)
            L.update(thigh=thigh, shin=shin, foot=foot, toes=toes, pts=pts)
    jumps = {}
    for s_ in ("L", "R"):
        for j in ("thigh", "shin", "foot"):
            seq = [fr["legs"][s_][j] for fr in frames]
            jumps[f"{s_}.{j}"] = max(abs(seq[i] - seq[i - 1]) for i in range(n))
    print(name.upper(), "largest frame-to-frame joint change (deg)", {k: round(v) for k, v in jumps.items()})
    for f in range(n + 1):
        fr = frames[f % n]
        t = fr["t"]
        w = 2 * math.pi * t
        R = {}
        yaw, roll = hips_rot(t)
        Bh = Euler((math.radians(lean), math.radians(yaw), math.radians(roll))).to_matrix()
        Bh0 = Euler((math.radians(lean), 0, 0)).to_matrix()
        for s, L in fr["legs"].items():
            # the thighs exactly undo the hips' turn and roll, so each leg stays in its stride plane and a planted
            # paw doesn't slip sideways: thigh basis = Tr^-1 Hr Bh^-1 Bh0 Hr^-1 Tr Rx(pitch)
            Tr = arm.data.bones[f"thigh.{s}"].matrix_local.to_3x3()
            Bt = Tr.inverted() @ Mh @ Bh.inverted() @ Bh0 @ Mhi @ Tr @ Euler((math.radians(L["thigh"]), 0, 0)).to_matrix()
            e = Bt.to_euler("XYZ")
            R.update({f"thigh.{s}": tuple(math.degrees(a) for a in e), f"shin.{s}": (L["shin"], 0, 0), f"foot.{s}": (L["foot"], 0, 0),
                      f"toes.{s}": (L["toes"], 0, 0)})
        sway = G["sway"]
        # the body: hips turn and drop toward the swinging leg, the chest counter-turns; the spine
        # takes the bounce (the hips' pitch is fixed, see hip_off) and the head follows a beat late
        bounce = math.cos(BF * math.pi * (t - st * 0.5))
        if G.get("gallop"):   # rock: dive forward over the landing paws, then rear up and stretch through the flight
            bounce = 2.2 * math.cos(2 * math.pi * ((t + OFF) % 1 - 0.2))
        R["hips"] = (lean, yaw, roll)
        R["spine"] = (-2 + 4 * bounce - 1.5 * math.cos(BF * math.pi * (t - st * 0.5) - 0.6), -0.6 * sway * math.sin(w), -2 * math.cos(w))
        R["chest"] = (-lean * 0.5 - 1.5 * math.cos(BF * math.pi * (t - st * 0.5) - 1.0), -0.9 * sway * math.sin(w), -2 * math.cos(w))
        R["neck"] = (-lean * 0.3 + 2 * math.cos(BF * math.pi * (t - st * 0.5) - 1.5), 3 * math.sin(w), 0)
        R["head"] = (-lean * 0.3 - 3 * math.cos(BF * math.pi * (t - st * 0.5) - 2.0), 3 * math.sin(w), 1.5 * math.cos(w))
        # each arm counters its own leg (half a cycle out from it), so a gallop's arms share its one-two rhythm
        for s, sd, ph in (("L", 1, (t + 0.5) % 1), ("R", -1, (t + OFF + 0.5) % 1)):   # arms swing against the legs   # arms swing against the legs with the forearms dragging behind
            sw = math.cos(2 * math.pi * ph)
            R[f"upper_arm.{s}"] = (-G["arm"] * sw, 0, -sd * 6)
            R[f"forearm.{s}"] = (-20 - G["arm"] * 0.6 - G["arm"] * 0.45 * math.cos(2 * math.pi * ph - 0.9), 0, 0)
            R[f"hand.{s}"] = (8 * math.sin(2 * math.pi * ph - 1.4), 0, 0)
            R[f"fingers.{s}"] = (10, 0, 0)
            R[f"shoulder.{s}"] = (0, 0, -sd * 2 * math.sin(2 * w))
        # the tail counterbalances: it streams and wags against the hips' turn, and it rises as the body drops and
        # dips as the body rises (a beat late down its length), bigger the harder the gait
        cb = {"walk": 5, "trot": 12, "sprint": 14, "gallop": 9}.get(name, 6)
        for i in range(5):
            R[f"tail.{i}"] = (cb * math.cos(BF * math.pi * (t - st * 0.5) - 1.0 - 0.7 * i) + {"trot": 2, "sprint": 5, "gallop": 9}.get(name, 0), 0,     # (+ raises the tail: a gallop carries it high, clear of the legs)
                              -G["wag"] * math.sin(w - 0.9 - 0.6 * i))
        for s in ("L", "R"):   # the ears bounce late and settle (and sit back at a run)
            R[f"ear.{s}"] = ({"trot": -14, "sprint": -32, "gallop": -24}.get(name, -2) - 6 * math.cos(BF * math.pi * (t - st * 0.5) - 2.2), 0, 0)
        key(arm, f, R, bob[f % n])
    print(name.upper(), "bob range", round(min(bob), 3), round(max(bob), 3), "| planted leg overstretched by up to", round(worst, 3))
    if plot:
        import json
        json.dump(dict(name=name, stance=st, frames=[dict(t=fr["t"], bob=b, legs={s: dict(planted=L["planted"], pts=[[p.x, p.y] for p in L["pts"]])
                                                                                      for s, L in fr["legs"].items()}) for fr, b in zip(frames, bob)]),
                  open(plot.format(name=name), "w"))
    return act


STAND_SINK = -0.07   # how far the body sinks into the flexed fursuit stand


def bake_idle(arm, J, frames=72):
    """Standing still but alive, in a fursuit stand: knees and hocks flexed, breathing, a slow
    bob of weight, the head looking around, ear flicks, a lazy tail."""
    act = new_action(arm, "idle")
    for f in range(frames + 1):
        t = (f % frames) / frames
        w = 2 * math.pi * t
        br = math.sin(2 * w)            # two breaths per loop
        flick = max(0.0, math.sin(w * 3 + 0.4) - 0.85) / 0.15   # quick ear flicks now and then
        R = {}
        bob = stand_legs(J, R, STAND_SINK - 0.008 * (1 + br), lean=3 + br, place={"L": (-0.06, 8.0), "R": (0.17, 14.0, 40.0)})
        R["hips"] = (3 + br, 4 + 1.5 * math.sin(w), 1.5 * math.sin(w))   # turned a little toward the forward paw
        R.update({
            "spine": (-1, -1 * math.sin(w), -0.8 * math.sin(w)),
            "chest": (-2 + 1.5 * br, 0, 0),
            "neck": (0, 4 * math.sin(w + 1.0), 0),
            "head": (-1.5 * br + 2 * math.sin(w * 2 + 2), 8 * math.sin(w + 1.3), 2 * math.sin(w)),
            "ear.L": (-18 * flick, 0, 0),
            "ear.R": (-10 * max(0.0, math.sin(w * 2 + 2.2) - 0.9) / 0.1, 0, 0),
        })
        for s, sd in (("L", 1), ("R", -1)):
            R[f"upper_arm.{s}"] = (-4 + 2 * br, 0, -sd * (4 + 1.5 * br))
            R[f"forearm.{s}"] = (-16, 0, 0)
            R[f"fingers.{s}"] = (8 + 3 * math.sin(w + sd), 0, 0)
        for i in range(5):
            R[f"tail.{i}"] = (2 * math.sin(w * 2 - 0.4 * i), 0, 8 * math.sin(w * 2 - 0.6 * i))
        key(arm, f, R, bob)
    return act


def snap_loop(t, pts, dur, over=1.70158):
    """Pose to pose on a loop (t in 0..1): each (time, value) key is hit fast (an ease-out-back
    over `dur`, about 10% overshoot that settles), then held until the next key."""
    pts = sorted(pts)
    i = max([k for k, (tk, _) in enumerate(pts) if tk <= t] or [len(pts) - 1])
    tk, v = pts[i]
    prev = pts[i - 1][1]
    f = ((t - tk) % 1.0) / dur
    if f >= 1:
        return v
    e = 1 + (over + 1) * (f - 1) ** 3 + over * (f - 1) ** 2
    return prev + (v - prev) * e


def bake_wave(arm, J, frames=24):
    """A friendly wave from the fursuit stand. Upper arm out to the side just above the shoulder,
    forearm upright so the paw sits beside the head (clear of the face), palm to the front. The
    forearm swings side to side from the elbow, pose to pose: 3-frame snaps with a little overshoot
    and short holds, the paw flicking a frame behind it."""
    act = new_action(arm, "wave")
    D = 3 / frames   # a 3-frame move (0.125 s at 24 fps)
    for f in range(frames + 1):
        t = (f % frames) / frames
        R = {}
        bob = stand_legs(J, R, STAND_SINK, lean=3, place={"L": (-0.03, 12.0), "R": (0.04, 14.0)})
        swing = snap_loop(t, [(0.0, 14), (0.25, -18), (0.5, 14), (0.75, -18)], D)               # forearm: out, in
        flick = snap_loop((t - 1 / frames) % 1, [(0.0, 12), (0.25, -10), (0.5, 12), (0.75, -10)], D)   # the paw follows a frame late
        lean = snap_loop(t, [(0.0, -1.5), (0.25, 1.5), (0.5, -1.5), (0.75, 1.5)], D * 1.6)          # body answers each swing a touch
        R.update({
            "upper_arm.R": (-4, 0, 86), "forearm.R": (-4, 0, 72 + swing), "hand.R": (0, 80, flick),
            "fingers.R": (2, 0, 0), "upper_arm.L": (-4, 0, -4), "forearm.L": (-16, 0, 0), "fingers.L": (8, 0, 0),
            "chest": (-2, 0, -4 + lean), "head": (0, -8, -8 + lean), "ear.L": (-8, 0, 0), "ear.R": (-8, 0, 0),
        })
        w = 2 * math.pi * t
        for i in range(5):
            R[f"tail.{i}"] = (4, 0, 16 * math.sin(2 * w - 0.6 * i))
        key(arm, f, R, bob)
    return act


def bake_tpose(arm, J):
    """Arms straight out for setup and fitting, legs in the flexed fursuit stand."""
    act = new_action(arm, "tpose")
    for f in (0, 1):
        R = {}
        bob = stand_legs(J, R, STAND_SINK, lean=0, place={"L": (0.0, 10.0), "R": (0.0, 10.0)})
        R.update({"upper_arm.L": (0, 0, -72), "upper_arm.R": (0, 0, 72)})
        key(arm, f, R, bob)
    return act


def bake_all(arm, J, plot=None):
    acts = {name: bake_gait(arm, J, name, plot) for name in GAITS}
    acts["idle"] = bake_idle(arm, J)
    acts["tpose"] = bake_tpose(arm, J)
    import actions
    acts.update(actions.bake_actions(arm, J))
    for act in acts.values():
        for fc in getattr(act, "fcurves", []):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    arm.animation_data.action = acts["walk"]
    bpy.context.scene.render.fps = FPS
    return acts
