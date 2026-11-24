"""Animation clip library for the bean rig, authored as code.

Each clip is a function f(t) -> Pose, sampled at FPS by beanrig.py, which then
    * ground-locks every frame: the figure's lowest point is put on the floor, so feet plant,
      lying / sitting poses rest on the ground and crouches (legs retracting) lower the body;
    * airborne frames (p.air(h)) ride h above a line between the grounded frames either side;
      p.free() frames skip the floor entirely (climb, hang, swim, mid-air loops);
    * adds overlap: chest, arms and hands sample the clip slightly in the past (DRAG).

Angles are degrees in character-friendly axes:
    spine / chest / hips / root  r=(pitch, yaw, roll)   pitch + leans forward, yaw + turns to the
                                                        character's left, roll + leans to its left
    arms   (swing, raise, twist)   raise 0 = down, 90 = out sideways, 180 = up, < 0 across the body;
                                   then swing + forward
    legs   (fwd, out, lift)        fwd + swings the foot forward; lift retracts the leg (a toy crouch)
    feet   toe                     + points the toe down
    root / hips loc (x, fwd, up)   metres; fwd + moves forward. Root 'up' only counts in free clips.
Side s: +1 is the character's left (+x), -1 its right.
"""
import math

FPS = 30
CLIPS = {}
R0 = 51.5     # rest arm raise (the A-pose)
RELAX = 47.0  # relaxed arms: a touch closer than rest, still clear of bulky tops
ELBOW = 8.0   # relaxed elbow bend
LEG = 0.35    # hip pivot to sole
ANKLE = 0.25  # hip pivot to ankle: a flat planted foot travels with the ankle
BEAT = 0.5    # dance tempo: 120 bpm
UP = 148.0    # highest arm raise that keeps the hands clear of the head (a V)
HIPW = 0.2    # leg spacing (hip pivots at x = +-HIPW)
pi = math.pi
DRAG = {"chest": 0.02, "arm.L": 0.03, "arm.R": 0.03, "forearm.L": 0.045, "forearm.R": 0.045, "hand.L": 0.06, "hand.R": 0.06}
G = 30.0      # game-feel gravity, m/s^2: toys drop fast and land hard


def clip(name, dur, loop=True, tags=(), drag=None, speed=None, tempo=1.0):
    """tempo > 1 plays the authored clip faster (and shortens it)."""
    def deco(f):
        g = f if tempo == 1.0 else (lambda t, f=f: f(t * tempo))
        CLIPS[name] = dict(f=g, dur=dur / tempo, loop=loop, tags=list(tags), drag=DRAG if drag is None else drag,
                           speed=speed)
        return f
    return deco


# --------------------------------------------------------------------------
# curves
# --------------------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ease_out(x, p=2.0):
    return 1 - (1 - clamp(x)) ** p


def ease_in(x, p=2.0):
    return clamp(x) ** p


def snap(x):
    """Fast out of the gate, settles hard: the default for one-shot moves (no floaty slow-in)."""
    x = clamp(x)
    return 1 - (1 - x ** 1.35) ** 3


def lerp(a, b, k):
    if isinstance(a, tuple):
        return tuple(lerp(x, y, k) for x, y in zip(a, b))
    return a + (b - a) * k


def K(t, keys, fn=snap):
    """Eased keys [(time, value), ...]; holds before the first / after the last."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return lerp(v0, v1, fn((t - t0) / max(t1 - t0, 1e-6)))
    return keys[-1][1]


def C(t, keys, loop=None):
    """Catmull-Rom through keys: smooth, keeps momentum through every key. With loop=T the
    keys wrap (first and last key must match)."""
    n = len(keys)
    if loop:
        t = t % loop
    if t <= keys[0][0]:
        return keys[0][1]
    if t >= keys[-1][0]:
        return keys[-1][1]
    i = max(j for j in range(n - 1) if keys[j][0] <= t)

    def at(j):
        if loop:
            if j < 0:
                return keys[n - 2][1]
            if j > n - 1:
                return keys[1][1]
        return keys[min(max(j, 0), n - 1)][1]
    p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
    u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])

    def cr(a, b, c, d):
        return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u ** 3)
    if isinstance(p1, tuple):
        return tuple(cr(a, b, c, d) for a, b, c, d in zip(p0, p1, p2, p3))
    return cr(p0, p1, p2, p3)


def bump(t, a, b):
    """0 -> 1 -> 0 smoothly across [a, b]."""
    if t <= a or t >= b:
        return 0.0
    return math.sin(pi * (t - a) / (b - a)) ** 2


def pulse(t, at, width=0.08, sharp=3.0):
    """A quick hit at time `at`: rises fast, decays slower."""
    if t < at - width * 0.25:
        return 0.0
    if t < at:
        return ease((t - (at - width * 0.25)) / (width * 0.25))
    return math.exp(-sharp * (t - at) / width)


def loop_pulse(t, T, at, width=0.08, sharp=3.0):
    """pulse() that repeats every T (and stays seamless across the loop)."""
    u = (t - at) % T
    return pulse(at + u, at, width, sharp) + pulse(at + u - T, at, width, sharp)


def wave(t, T, phase=0.0):
    return math.sin(2 * pi * (t / T + phase))


# --------------------------------------------------------------------------
# physics: gravity arcs, rigid topples, hard impacts
# --------------------------------------------------------------------------
def flight(h):
    """Take-off speed and airtime for a jump of height h."""
    v = math.sqrt(2 * G * h)
    return v, 2 * v / G


def ballistic(t, t0, h):
    """Height of a jump of apex h that leaves the ground at t0 (real gravity)."""
    v, T = flight(h)
    u = t - t0
    return v * u - 0.5 * G * u * u if 0 < u < T else 0.0


def _step(tau, dur, over):
    """Damped-spring step response that first peaks (at 1 + over) at tau = dur."""
    if tau <= 0:
        return 0.0
    over = max(over, 1e-4)
    z = -math.log(over) / math.sqrt(pi * pi + math.log(over) ** 2)
    wd = pi / dur
    wn = wd / math.sqrt(1 - z * z)
    return 1 - math.exp(-z * wn * tau) * (math.cos(wd * tau) + z / math.sqrt(1 - z * z) * math.sin(wd * tau))


def strike(t, keys, dur=0.1, over=0.1, loop=None):
    """Pose to pose: hit each key value exactly on its time (the move takes `dur`, arrives with
    an `over` overshoot and settles like a spring), then hold. keys = [(time, value), ...];
    values may be tuples. With loop=T the keys repeat every T (seamless)."""
    tup = isinstance(keys[0][1], tuple)
    def val(i):
        return keys[i % len(keys)][1]
    def sub(a, b):
        return tuple(x - y for x, y in zip(a, b)) if tup else a - b
    if loop:
        t = t % loop
        base = val(-1)
        shifts = (-loop, 0.0, loop)
        steps = [(k, s) for s in shifts for k in range(len(keys))]
        acc = list(base) if tup else base
        for k, sh in steps:
            d = sub(val(k), val(k - 1))
            w = _step(t - (keys[k][0] + sh - dur), dur, over)
            acc = [a + w * x for a, x in zip(acc, d)] if tup else acc + w * d
        return tuple(acc) if tup else acc
    acc = list(val(0)) if tup else val(0)
    for k in range(1, len(keys)):
        d = sub(val(k), val(k - 1))
        w = _step(t - (keys[k][0] - dur), dur, over)
        acc = [a + w * x for a, x in zip(acc, d)] if tup else acc + w * d
    return tuple(acc) if tup else acc


_TOPPLE = {}


def topple(t, t0, w0=2.5, a0=0.0, L=1.6, bounce=0.22, end=88.0):
    """A rigid figure tipping over its base edge under gravity: starts at a0 degrees with
    angular speed w0 (rad/s) at t0, accelerates, slams at `end` and bounces. Returns
    (degrees, impact times)."""
    key = (w0, a0, L, bounce, end)
    if key not in _TOPPLE:
        k, dt = 1.5 * G / L, 1 / 600
        th, w, tt, lim = math.radians(a0), w0, 0.0, math.radians(end)
        track, hits = [th], []
        while tt < 4.0:
            if th >= lim and w > 0:
                hits.append(tt)
                w = -w * bounce if w * bounce > 0.6 else 0.0
                th = lim
            if not (th >= lim and w == 0.0):
                w += k * math.sin(th) * dt
                th = min(th + w * dt, lim)
            tt += dt
            track.append(th)
        _TOPPLE[key] = (track, hits)
    track, hits = _TOPPLE[key]
    i = min(max(int((t - t0) * 600), 0), len(track) - 1)
    return math.degrees(track[i]), [h + t0 for h in hits]


def takeoff(t, T0, down=0.07, push=0.067):
    """Crouch and push-off for a jump that leaves the ground at T0. Drops fast into the crouch
    (`down` s), then the legs extend over `push` s (2 frames, accelerating) with the feet planted,
    so the body is already rising when the arc starts. Returns (crouch 0..1, push 0..1)."""
    t1 = T0 - push                                   # bottom of the crouch
    if t <= t1:
        return ease_out(t / min(down, t1), 2.0), 0.0
    k = ease_in((t - t1) / push, 1.6)
    return 1 - k, k


def impacts(t, hits, width=0.07, decay=0.3):
    """A hard squash spike at each impact, smaller for each bounce."""
    return sum(pulse(t, h, width, 3.0) * decay ** i for i, h in enumerate(hits))


def pivot_fwd(deg, f):
    """Forward shift that makes a pitch of `deg` pivot on a base edge f metres ahead (f < 0: heel)."""
    return f * (1 - math.cos(math.radians(deg)))


# --------------------------------------------------------------------------
# pose
# --------------------------------------------------------------------------
class Pose:
    def __init__(self):
        self.b = {}
        self.air_h = None
        self.is_free = False

    def _add(self, bone, key, v):
        d = self.b.setdefault(bone, {})
        if key in d and key != "s":
            d[key] = tuple(a + b for a, b in zip(d[key], v))
        else:
            d[key] = tuple(v)
        return self

    def root(self, loc=(0, 0, 0), r=(0, 0, 0)):
        return self._add("root", "loc", loc)._add("root", "r", r)

    def hips(self, loc=(0, 0, 0), r=(0, 0, 0)):
        return self._add("hips", "loc", loc)._add("hips", "r", r)

    def spine(self, r=(0, 0, 0), loc=(0, 0, 0)):
        return self._add("spine", "r", r)._add("spine", "loc", loc)

    def chest(self, r=(0, 0, 0)):
        return self._add("chest", "r", r)

    def squash(self, k):
        """Volume-keeping squash (k < 1) / stretch (k > 1) of the body."""
        k = max(k, 0.05)
        w = 1 / math.sqrt(k)
        self.b.setdefault("spine", {})["s"] = (w, w, k)
        return self

    def scale_all(self, k):
        self.b.setdefault("hips", {})["s"] = (k, k, k)
        return self

    def arm(self, s, swing=0.0, raise_=RELAX, twist=0.0, bend=None):
        """bend: elbow flex in degrees (folds the forearm forward; twist the arm to aim the fold).
        Left unset, the elbow keeps a relaxed 8 degree bend."""
        sd = "L" if s > 0 else "R"
        self.b.setdefault(f"arm.{sd}", {})["arm"] = (swing, raise_, twist)
        self.b.setdefault(f"forearm.{sd}", {})["bend"] = (ELBOW if bend is None else bend,)
        return self

    def arms(self, swing=0.0, raise_=RELAX, twist=0.0, bend=None):
        return self.arm(1, swing, raise_, twist, bend).arm(-1, swing, raise_, twist, bend)

    def hand(self, s, r=(0, 0, 0)):
        return self._add(f"hand.{'L' if s > 0 else 'R'}", "r", r)

    def leg(self, s, fwd=0.0, out=0.0, lift=0.0):
        n = f"leg.{'L' if s > 0 else 'R'}"
        self._add(n, "leg", (fwd, out))
        return self._add(n, "loc", (0, 0, lift))

    def foot(self, s, toe=0.0):
        return self._add(f"foot.{'L' if s > 0 else 'R'}", "toe", (toe,))

    def crouch(self, d):
        """Retract both legs by d: with the ground lock this lowers the body by d."""
        return self.leg(1, 0, 0, d).leg(-1, 0, 0, d)

    def air(self, h=0.0):
        """Mark the frame airborne, h above the floor line. h <= 0 means on the ground (not airborne)."""
        if h > 1e-6:
            self.air_h = (self.air_h or 0.0) + h
        return self

    def free(self):
        self.is_free = True
        return self


def P():
    return Pose()


# --------------------------------------------------------------------------
# locomotion: plant the feet properly
# --------------------------------------------------------------------------
def foot_target(u, beta, A, lift, back=False, plateau=False):
    """One foot over a cycle phase u in [0, 1): stance first (the foot slides back at a
    constant speed, flat on the floor, rolling heel to toe), then the swing arc.
    Returns (y forward, lift, toe roll)."""
    u %= 1.0
    if u < beta:
        k = u / beta
        y = A * (1 - 2 * k)
        toe = -12 * (1 - ease(k / 0.18)) + 24 * ease((k - 0.75) / 0.25)
        h = 0.0
    else:
        k = (u - beta) / (1 - beta)
        # Hermite swing: leaves and lands at the stance speed, so the leg never kinks at lift-off
        m = -2 * A / beta * (1 - beta)                 # end speeds = floor speed exactly (ground-speed matching)
        h00, h10, h01, h11 = 2 * k ** 3 - 3 * k ** 2 + 1, k ** 3 - 2 * k ** 2 + k, -2 * k ** 3 + 3 * k ** 2, k ** 3 - k ** 2
        y = h00 * -A + h10 * m + h01 * A + h11 * m
        if plateau:                                    # a bound: fold right after push-off, stay tucked, reach down late
            h = lift * ease(k / 0.25) * ease((1 - k) / 0.3)
        else:
            h = lift * math.sin(pi * k) ** 1.3
        toe = lerp(24, -12, ease(k)) - 10 * math.sin(pi * k)
    if back:
        y, toe = -y, -toe * 0.6
    return y, h, toe


def legs_gait(p, t, T, beta, A, lift, out=4.0, back=False, side=0, plateau=False):
    """Plant both feet. side=+1/-1 strafes to the character's left/right instead of forward.
    Returns the left foot's phase."""
    u = t / T
    for s, off in ((1, 0.0), (-1, 0.5)):
        y, h, toe = foot_target(u + off, beta, A, lift, back, plateau)
        a = math.degrees(math.asin(clamp(y / ANKLE, -0.95, 0.95)))
        if side:
            p.leg(s, 0, out + a * side * s, h)
            p.foot(s, 6 * h / max(lift, 1e-3))
        else:
            p.leg(s, a, out, h)
            p.foot(s, a + toe)
    return u % 1.0


def plant_x(p, s, foot_x, body_x, out0=4.0, lift=0.0):
    """Put foot s at world x = foot_x while the body is at body_x (sideways planting)."""
    a = math.degrees(math.asin(clamp((foot_x - body_x - s * HIPW) / ANKLE * s, -0.95, 0.95)))
    p.leg(s, 0, a, lift)


def in_stance(u, beta):
    return (u % 1.0) < beta or ((u + 0.5) % 1.0) < beta


def gait_speed(T, beta, A):
    return round(2 * A / (beta * T), 2)


def body_gait(p, uL, beta, sway=3.0, twist=6.0, lean=3.0, bounce=0.03, arm=24.0, arm_raise=RELAX, arm_lag=0.04,
              elbow=12.0, elbow_swing=14.0):
    """Weight shift, hip / shoulder counter-twist, contact squash and arm swing for a gait."""
    c = 2 * pi
    p.spine((lean, twist * 0.5 * math.sin(c * uL), sway * math.cos(c * (uL - beta / 2))))
    p.chest((0.8 * math.cos(2 * c * uL), -twist * math.sin(c * uL), -sway * 0.5 * math.cos(c * (uL - beta / 2))))
    contact = max(0.0, math.cos(2 * c * (uL - 0.03))) ** 6
    if bounce:                                              # bounce 0: the caller (bound) owns the squash
        p.squash(1 - bounce * contact + bounce * 0.4 * (1 - contact))
    if arm:
        for s, off in ((1, 0.5), (-1, 0.0)):
            sw = arm * math.cos(c * (uL - off - arm_lag))
            p.arm(s, sw, arm_raise + 3 * math.cos(2 * c * uL), 0, elbow + elbow_swing * max(0.0, sw / arm))
            p.hand(s, (-0.25 * sw, 0, 0))


def breathe(p, t, period=3.0, amt=1.0):
    ph = 2 * pi * t / period
    p.squash(1 + 0.014 * amt * math.sin(ph))
    p.chest((1.5 * amt * math.sin(ph + 0.6), 0, 0))
    p.arms(0, RELAX - 2.5 * amt * math.sin(ph))
    return p


# --------------------------------------------------------------------------
# idle
# --------------------------------------------------------------------------
@clip("idle", 4.0, tags=["base"])
def _(t):
    p = breathe(P(), t, 4.0, 1.0)
    shift = wave(t, 4.0)                       # weight from foot to foot
    p.spine((0.6 * wave(t, 2.0, 0.2), 1.5 * wave(t, 4.0, 0.15), 2.2 * shift))
    p.chest((0, -1.0 * wave(t, 4.0, 0.15), -1.2 * shift))
    p.leg(1, 0, 4).leg(-1, 0, 4)
    p.arm(1, 2 * wave(t, 4.0, 0.3), RELAX - 2 * wave(t, 4.0)).arm(-1, 2 * wave(t, 4.0, 0.8), RELAX - 2 * wave(t, 4.0, 0.5))
    return p


@clip("idle-look", 5.0, tags=["base"])
def _(t):
    p = breathe(P(), t, 2.5, 0.8)
    yaw = strike(t, [(0.0, 0.0), (0.85, 32.0), (2.0, 28.0), (2.9, -30.0), (4.0, -26.0), (4.7, 0.0)], 0.17, 0.08, loop=5.0)
    pitch = strike(t, [(0.0, 0.0), (0.85, -4.0), (2.9, -2.0), (4.7, 0.0)], 0.17, 0.05, loop=5.0)
    p.chest((pitch, yaw, 0)).spine((0, yaw * 0.3, -yaw * 0.06))
    tap = loop_pulse(t, 5.0, 1.35, 0.25, 4) + loop_pulse(t, 5.0, 1.65, 0.25, 4)
    p.foot(-1, -16 * min(tap, 1))
    p.leg(1, 0, 4).leg(-1, 0, 4)
    return p


# --------------------------------------------------------------------------
# locomotion
# --------------------------------------------------------------------------
WALK = dict(T=1.0, beta=0.6, A=0.12, lift=0.07)
RUN = dict(T=0.68, beta=0.25, A=0.16, lift=0.17)       # a bound: 0.17 s of flight per step, ~11 cm of real lift
SPRINT = dict(T=0.52, beta=0.22, A=0.15, lift=0.18)    # 0.16 s of flight per step, longer and lower
SNEAK = dict(T=1.6, beta=0.7, A=0.1, lift=0.09)


def _spd(cfg):
    return gait_speed(cfg["T"], cfg["beta"], cfg["A"])


@clip("walk", WALK["T"], tags=["move"], speed=_spd(WALK))
def _(t):
    p = P()
    uL = legs_gait(p, t, **WALK)
    body_gait(p, uL, WALK["beta"], sway=6, twist=9, lean=3, bounce=0.045, arm=30)   # a toy waddle
    return p


@clip("walk-back", 1.1, tags=["move"], speed=-gait_speed(1.1, 0.62, 0.1))
def _(t):
    p = P()
    uL = legs_gait(p, t, 1.1, 0.62, 0.1, 0.07, back=True)
    body_gait(p, uL, 0.62, lean=-4, twist=4, arm=14, arm_raise=RELAX + 4)
    p.chest((-3, 0, 0))
    return p


def strafe(t, side):
    p = P()
    T, beta = 0.8, 0.6
    uL = legs_gait(p, t, T, beta, 0.13, 0.08, out=6, side=side)
    c = 2 * pi
    p.spine((2, 6 * side, side * 7 + 3 * math.cos(c * (uL - beta / 2))))
    p.chest((0, -4 * side, -side * 2))
    contact = max(0.0, math.cos(2 * c * uL)) ** 6
    p.squash(1 - 0.03 * contact)
    for s in (1, -1):
        p.arm(s, 6, RELAX + 6 + 5 * math.cos(2 * c * (uL - 0.05)) + (8 if s == side else -4))
    return p


@clip("strafe-left", 0.8, tags=["move"], speed=gait_speed(0.8, 0.6, 0.13))
def _(t):
    return strafe(t, 1)


@clip("strafe-right", 0.8, tags=["move"], speed=gait_speed(0.8, 0.6, 0.13))
def _(t):
    return strafe(t, -1)


def bound(p, t, cfg):
    """Bounding gait body: ballistic flight between steps (constant g), and on each contact a half-sine dip whose
    speed at touch-down matches the fall speed (no pop), with a landing squash and a take-off stretch.
    Returns the left foot's phase."""
    uL = legs_gait(p, t, **cfg, plateau=True)
    T, beta = cfg["T"], cfg["beta"]
    FT, Tc = (0.5 - beta) * T, beta * T                    # flight and contact time per step
    v = G * FT / 2                                          # speed at take-off and touch-down
    dip = min(v * Tc / pi, 0.09)                            # a contact dip that meets the landing speed
    w = uL % 0.5
    if w < beta:                                            # on the ground: sink and push
        k = w / beta
        p.crouch(dip * math.sin(pi * k))
        p.squash(1 - 0.12 * math.sin(pi * k) ** 2)
        p.spine((4 * math.sin(pi * k), 0, 0))              # a forward accent on every contact
    else:                                                   # in the air
        tau = (w - beta) * T
        p.air(v * tau - 0.5 * G * tau * tau)
        p.squash(1 + 0.08 * math.exp(-(tau / 0.05) ** 2))  # stretched off the toe
    return uL


def run_body(p, t, cfg, lean, arm, arm_raise, flight_h=None):
    uL = bound(p, t, cfg)
    body_gait(p, uL, cfg["beta"], sway=2, twist=10, lean=lean, bounce=0.0, arm=arm, arm_raise=arm_raise, arm_lag=0.06,
              elbow=80, elbow_swing=12)
    return uL


@clip("run", RUN["T"], tags=["move"], speed=_spd(RUN))
def _(t):
    p = P()
    run_body(p, t, RUN, lean=12, arm=48, arm_raise=RELAX - 12, flight_h=0.06)
    return p


@clip("sprint", SPRINT["T"], tags=["move"], speed=_spd(SPRINT))
def _(t):
    p = P()
    uL = run_body(p, t, SPRINT, lean=22, arm=0, arm_raise=RELAX, flight_h=0.08)
    p.arms(-62 + 6 * math.cos(4 * pi * uL), 34, 0, 14)  # arms swept back
    p.chest((-4, 0, 0))
    return p


@clip("sneak", SNEAK["T"], tags=["move"], speed=_spd(SNEAK))
def _(t):
    p = P()
    uL = legs_gait(p, t, SNEAK["T"], SNEAK["beta"], SNEAK["A"], 0.13)
    body_gait(p, uL, SNEAK["beta"], sway=6, twist=6, lean=16, bounce=0.02, arm=0)
    p.crouch(0.07)
    for s, off in ((1, 0.5), (-1, 0.0)):
        y, h, toe = foot_target(uL + (0.0 if s > 0 else 0.5), SNEAK["beta"], SNEAK["A"], 0.13)
        p.foot(s, 22 * h / 0.13)                          # tiptoe as each foot lifts
        p.arm(s, 26 + 6 * math.cos(2 * pi * (uL - off)), 20, 0, 115)   # paws up by the chest
        p.hand(s, (55, 0, 0))
    p.chest((-8, 14 * math.sin(2 * pi * uL / 1.0), 0))
    return p


@clip("crouch-idle", 2.4, tags=["move"])
def _(t):
    p = breathe(P(), t, 2.4, 1.2)
    p.crouch(0.1).squash(0.88 + 0.012 * wave(t, 2.4))
    p.spine((12, 6 * wave(t, 2.4, 0.1), 2 * wave(t, 2.4)))
    p.chest((-8, -4 * wave(t, 2.4, 0.1), 0))
    p.arms(24, RELAX + 14, 0, 40)
    p.leg(1, 0, 10).leg(-1, 0, 10)
    return p


# --------------------------------------------------------------------------
# jumps
# --------------------------------------------------------------------------
def arc(t, t0, t1, h):
    if t <= t0 or t >= t1:
        return 0.0
    u = (t - t0) / (t1 - t0)
    return 4 * h * u * (1 - u)


@clip("jump", 0.93, loop=False, tags=["jump"])
def _(t):
    p = P()
    T0, H = 0.14, 0.9
    T1 = T0 + flight(H)[1]                                    # touchdown (about 0.5 s of air)
    pre, push = takeoff(t, T0) if t <= T0 else (0.0, 0.0)
    land = impacts(t, [T1], 0.09, 1) - 0.25 * bump(t, T1 + 0.08, T1 + 0.3)   # hit, then a little rebound
    p.crouch(0.13 * pre + 0.14 * max(land, 0))
    p.foot(1, 25 * push).foot(-1, 25 * push)                                   # up onto the toes
    p.air(ballistic(t, T0, H))
    up = clamp(1 - (t - T0) / (T1 - T0)) if T0 < t < T1 else 0.0               # 1 at take-off, 0 at landing
    p.squash(1 - 0.2 * pre + 0.2 * up ** 3 + 0.04 * bump(t, T1 - 0.12, T1) - 0.26 * max(land, 0) + 0.05 * max(-land, 0))
    p.spine((12 * pre - 6 * up ** 2 + 14 * max(land, 0), 0, 0))
    sw = strike(t, [(0, 0.0), (0.1, -50.0), (T0 + 0.01, 30.0), (T1 - 0.1, 12.0), (T1 + 0.05, 34.0), (0.93, 0.0)], 0.1, 0.1)
    ra = strike(t, [(0, RELAX), (0.1, RELAX - 6), (T0 + 0.01, UP), (T1 - 0.14, 118.0), (T1 + 0.05, 68.0), (0.93, RELAX)], 0.1, 0.06)
    p.arm(1, sw, ra, 0, 20).arm(-1, sw * 0.9, ra - 6, 0, 24)
    tuck = bump(t, T0 + 0.04, T1 - 0.02)
    p.leg(1, 26 * tuck, 6 * tuck, 0.08 * tuck).leg(-1, 14 * tuck, 6 * tuck, 0.06 * tuck)
    p.foot(1, 25 * tuck).foot(-1, 20 * tuck)
    return p


@clip("jump-start", 0.2, loop=False, tags=["jump"])
def _(t):
    # crouch (2 frames), push off (2 frames, feet planted, arms leading), end ON take-off:
    # no height baked in, because jump-air hands the vertical to the game
    p = P()
    T0 = 0.2
    pre, push = takeoff(t, T0, down=0.067, push=0.1)
    p.crouch(0.13 * pre)
    p.squash(1 - 0.2 * pre + 0.15 * push)
    p.spine((12 * pre - 6 * push, 0, 0))
    sw = strike(t, [(0, 0.0), (0.067, -50.0), (0.2, 22.0)], 0.1, 0.05)        # arms swing up a frame ahead
    ra = strike(t, [(0, RELAX), (0.067, RELAX - 6), (0.2, 138.0)], 0.1, 0.05)
    p.arm(1, sw, ra, 0, 20).arm(-1, sw * 0.9, ra - 6, 0, 24)
    p.foot(1, 22 * push).foot(-1, 22 * push)
    return p


@clip("jump-air", 1.0, tags=["jump"])
def _(t):
    p = P().free().squash(1.03 + 0.015 * wave(t, 1.0))
    for s, ph in ((1, 0.0), (-1, 0.18)):
        p.arm(s, 22 + 8 * wave(t, 1.0, ph), 128 + 10 * wave(t, 1.0, ph + 0.25))
        p.leg(s, 14 + 10 * wave(t, 1.0, ph + 0.4), 6, 0.06)
        p.foot(s, 22 + 6 * wave(t, 1.0, ph))
    p.spine((-3 + 2 * wave(t, 1.0, 0.3), 0, 2 * wave(t, 1.0, 0.1)))
    return p


@clip("jump-land", 0.36, loop=False, tags=["jump"])
def _(t):
    p = P()
    imp = impacts(t, [0.0], 0.09, 1) - 0.22 * bump(t, 0.08, 0.3)
    p.crouch(0.15 * max(imp, 0))
    p.squash(1 - 0.28 * max(imp, 0) + 0.06 * max(-imp, 0))
    p.spine((15 * max(imp, 0), 0, 0)).chest((7 * max(imp, 0), 0, 0))
    p.arms(K(t, [(0, 12), (0.05, 36), (0.36, 0)]), K(t, [(0, 118), (0.05, 66), (0.36, RELAX)]), 0, 24)
    return p


@clip("double-jump", 0.6, loop=False, tags=["jump"])
def _(t):
    p = P().free()
    p.root(loc=(0, 0, ballistic(t, 0.0, 0.45)))
    flip = K(t, [(0.0, 0), (0.4, 360)], fn=lambda u: 1 - (1 - u) ** 2.2)   # whips round, slows as it opens
    p.hips(r=(flip, 0, 0))
    tuck = K(t, [(0, 0), (0.06, 1), (0.3, 1), (0.46, 0)], fn=ease)
    p.squash(1 - 0.22 * tuck + 0.08 * bump(t, 0.4, 0.6))
    p.arms(70 * tuck + 15, lerp(UP - 20, 25, tuck), 0, 20 + 60 * tuck)
    for s in (1, -1):
        p.leg(s, 82 * tuck, 0, 0.1 * tuck)
        p.foot(s, 35 * tuck)
    return p


@clip("fall", 0.8, tags=["jump"])
def _(t):
    p = P().free()
    p.squash(1.05 + 0.02 * wave(t, 0.4))
    for s, ph in ((1, 0.0), (-1, 0.37)):
        a = 2 * pi * (t / 0.8 + ph)
        p.arm(s, 70 * math.sin(a), 145 + 22 * math.cos(a))          # windmill, out of step
        p.leg(s, 28 * wave(t, 0.4, ph), 10, 0.05)
        p.foot(s, 20 + 12 * wave(t, 0.4, ph + 0.2))
    p.spine((-12 + 5 * wave(t, 0.8), 3 * wave(t, 0.8, 0.3), 7 * wave(t, 0.8, 0.15)))
    p.chest((-5 * wave(t, 0.4), 0, 0))
    return p


@clip("dive", 0.85, loop=False, tags=["jump", "obstacle"])
def _(t):
    p = P()
    T0, H, V = 0.13, 0.32, 3.6
    FT = flight(H)[1]
    T1 = T0 + FT
    pre, push = takeoff(t, T0) if t <= T0 else (0.0, 0.0)
    p.crouch(0.11 * pre)
    if t <= T0:
        x = 0.0
    elif t <= T1:
        x = V * (t - T0)
    else:
        x = V * FT + V * (1 - math.exp(-7 * (t - T1))) / 7           # belly-slides to a stop
    p.root(loc=(0, x, 0))
    p.air(ballistic(t, T0, H))
    pitch = K(t, [(0, 0), (0.07, -8), (T1 - 0.04, 84), (0.85, 88)], fn=lambda u: ease_out(u, 1.6))
    p.hips(r=(pitch, 0, 0))
    hit = impacts(t, [T1], 0.08, 1)
    p.squash(1 - 0.18 * pre + 0.12 * bump(t, T0, T1) - 0.2 * hit)
    p.arms(K(t, [(0, 0), (0.07, -55), (T0 + 0.08, 14), (0.85, 10)]),
           K(t, [(0, RELAX), (0.07, RELAX), (T0 + 0.08, 160), (0.85, 165)]), 0, K(t, [(0, ELBOW), (T0 + 0.08, 4)]))
    for s in (1, -1):
        p.leg(s, K(t, [(0, 0), (T0 + 0.1, -26), (0.85, -14)]) + 14 * hit * (1 if s > 0 else 0.6), 8)
        p.foot(s, 20)
    return p


@clip("belly-slide", 0.8, tags=["obstacle"])
def _(t):
    p = P()
    p.hips(r=(88 + 1.5 * wave(t, 0.8), 0, 3 * wave(t, 0.8, 0.2)))
    for s, ph in ((1, 0), (-1, 0.35)):
        p.arm(s, 10 + 4 * wave(t, 0.8, ph), 165)
        p.leg(s, -14 + 8 * wave(t, 0.4, ph), 8)
        p.foot(s, 20)
    p.squash(0.97 + 0.02 * wave(t, 0.8, 0.25))
    return p


@clip("get-up", 0.8, loop=False, tags=["obstacle"])
def _(t):
    # from the belly: hands push (2 frames), knees tuck under, pop upright, land, settle
    p = P()
    k = strike(t, [(0, 0.0), (0.12, 0.08), (0.42, 1.0)], 0.2, 0.06)
    a = 88 * (1 - k)                                        # pivots up on the toes (the toes stay put)
    p.root(loc=(0, pivot_fwd(a, 0.2), 0), r=(a, 0, 0))
    p.hips(r=(0, 0, 5 * bump(t, 0.1, 0.4)))
    tuck = strike(t, [(0, 0.0), (0.16, 1.0), (0.42, 0.0)], 0.12, 0.0)
    for s in (1, -1):
        p.leg(s, -14 * (1 - k), 6, 0.08 * tuck)
    p.arms(K(t, [(0, 10), (0.1, 70), (0.3, 40), (0.5, 10), (0.8, 0)]), K(t, [(0, 165), (0.1, 40), (0.3, 30), (0.5, 70), (0.8, RELAX)]))
    land = pulse(t, 0.44, 0.1, 3)
    p.squash(1 - 0.16 * land + 0.06 * bump(t, 0.3, 0.42))
    p.crouch(0.06 * land)
    return p


@clip("splat", 0.95, loop=False, tags=["obstacle", "hit"])
def _(t):
    p = P()
    T0 = 0.08
    a, hits = topple(t, T0, w0=1.6, L=1.6, bounce=0.2, end=88)        # trip, teeter, faceplant
    th = hits[0] if hits else 0.5
    p.root(loc=(0, pivot_fwd(a, 0.2), 0), r=(a, 0, 0))
    p.hips(r=(0, 0, 4 * bump(t, T0, th)))
    imp = impacts(t, hits, 0.07, 0.3)
    p.squash(1 - 0.34 * imp + 0.06 * bump(t, T0, th))
    p.crouch(0.06 * K(t, [(0, 0), (0.05, 1), (T0 + 0.05, 0)]))          # the trip
    sw = K(t, [(0, 0), (T0, 40), (th - 0.05, 20), (th, 12), (0.95, 14)])
    p.arm(1, sw + 25 * imp, K(t, [(0, RELAX), (T0 + 0.05, 130), (th, 160), (0.95, 160)]), 0, K(t, [(0, ELBOW), (th, 4)]))
    p.arm(-1, sw * 0.8 + 30 * imp, K(t, [(0, RELAX), (T0 + 0.08, 120), (th, 154), (0.95, 155)]), 0, K(t, [(0, ELBOW), (th, 6)]))
    for s, d in ((1, 0.0), (-1, 0.03)):
        p.leg(s, K(t, [(0, 0), (T0, -14), (th, -22), (0.95, -18)]) - 24 * pulse(t, th + d, 0.1, 2.5), 12)
        p.foot(s, 24)
    return p


@clip("stumble", 0.8, loop=False, tags=["obstacle", "hit"])
def _(t):
    # trip (foot catches), lurch forward, two quick catching steps, recover with a little overshoot
    p = P()
    lean = strike(t, [(0, 0.0), (0.08, 32.0), (0.28, 22.0), (0.45, 8.0), (0.62, -4.0), (0.74, 0.0)], 0.1, 0.15)
    roll = strike(t, [(0, 0.0), (0.1, 12.0), (0.3, -8.0), (0.5, 3.0), (0.66, 0.0)], 0.1, 0.15)
    p.spine((lean, 0, roll))
    # two catching steps with real foot targets: the planted foot holds still while the body and the other foot move
    c1, c2 = ease(clamp((t - 0.06) / 0.14)), ease(clamp((t - 0.22) / 0.14))
    body = 0.15 * c1 + 0.15 * c2
    fL, fR = 0.3 * c1, 0.3 * c2                             # left steps first, then right closes past it
    p.root(loc=(0, body, 0))
    for s_, f in ((1, fL), (-1, fR)):
        a = math.degrees(math.asin(clamp((f - body) / ANKLE, -0.95, 0.95)))
        lift = 0.09 * (bump(t, 0.06, 0.2) if s_ > 0 else bump(t, 0.22, 0.36))
        p.leg(s_, a, 6, lift)
    flail = strike(t, [(0, 0.0), (0.08, 1.0), (0.45, 0.4), (0.7, 0.0)], 0.1, 0.1)
    p.arm(1, 50 * flail, RELAX + 75 * flail, 0, 30).arm(-1, -20 * flail, RELAX + 60 * flail, 0, 30)
    p.squash(1 - 0.1 * pulse(t, 0.2, 0.06) - 0.1 * pulse(t, 0.36, 0.06))
    return p


@clip("knockback", 0.95, loop=False, tags=["hit"])
def _(t):
    p = P()
    T0, H, V = 0.03, 0.3, 3.4                                   # blasted off the feet at 3.4 m/s
    FT = flight(H)[1]
    T1 = T0 + FT
    if t <= T0:
        x = 0.0
    elif t <= T1:
        x = V * (t - T0)
    else:
        x = V * FT + V * (1 - math.exp(-9 * (t - T1))) / 9          # skids to a stop
    p.root(loc=(0, -x, 0))
    p.air(ballistic(t, T0, H))
    hit = pulse(t, 0.02, 0.1, 2.5)
    land = impacts(t, [T1], 0.08, 1)
    lean = K(t, [(0, 0), (0.05, -42), (T1 - 0.04, -22), (T1 + 0.06, 18), (T1 + 0.2, -5), (0.95, 0)])
    p.spine((lean, 6 * bump(t, 0, T1), 4 * bump(t, 0.05, T1))).chest((-12 * hit, 0, 0))
    p.squash(1 - 0.22 * hit - 0.24 * land)
    p.crouch(0.12 * land)
    for s, d in ((1, 0.0), (-1, 0.03)):
        p.arm(s, K(t, [(0, 0), (0.06 + d, 75), (T1, 40), (T1 + 0.12, 15), (0.95, 0)]),
              K(t, [(0, RELAX), (0.06 + d, 145), (T1, 115), (T1 + 0.15, 70), (0.95, RELAX)]), 0, 15)
        p.leg(s, K(t, [(0, 0), (0.06 + d, 40), (T1 - 0.05, 12), (T1, 0), (T1 + 0.08, -8), (0.95, 0)]), 8)
    return p


@clip("hit", 0.38, loop=False, tags=["hit", "shooter"])
def _(t):
    p = P()
    k = pulse(t, 0.025, 0.16, 2.8)
    back = K(t, [(0, 0), (0.025, -24), (0.12, -6), (0.22, 4), (0.38, 0)])
    p.spine((back, 10 * k, 6 * k), loc=(0, -0.06 * k, 0)).chest((-9 * k, -5 * k, 0)).squash(1 - 0.18 * k)
    p.arms(30 * k, RELAX + 42 * k, 0, ELBOW + 45 * k)
    p.crouch(0.035 * k)
    return p


@clip("tumble", 0.5, tags=["obstacle"])
def _(t):
    p = P()
    p.hips(r=(360 * t / 0.5, 0, 4 * wave(t, 0.5)))
    p.squash(0.58 + 0.03 * wave(t, 0.25))
    p.arms(80, 26, 0, 70)
    for s in (1, -1):
        p.leg(s, 85, 2, 0.08)
        p.foot(s, 30)
    return p


@clip("spin-out", 1.6, loop=False, tags=["hit"], tempo=1.3)
def _(t):
    p = P()
    yaw = K(t, [(0, 0), (1.0, 720)], fn=lambda u: ease_out(u, 2.2))
    p.root(r=(0, yaw, 0))
    spin = (1 - ease(t / 1.0)) * ease(t / 0.15)
    p.arms(0, lerp(RELAX, 100, ease(t / 0.2)) * (1 - ease((t - 0.9) / 0.4)) + RELAX * ease((t - 0.9) / 0.4))
    dizzy = bump(t, 0.8, 1.6)
    a = 2 * pi * t / 0.55
    p.spine((5 * dizzy * math.cos(a), 0, 9 * dizzy * math.sin(a) + 6 * spin)).chest((4 * dizzy * math.sin(a), 0, 0))
    p.leg(1, 6 * dizzy * math.sin(a), 6, 0.05 * bump(t, 1.0, 1.25))
    p.leg(-1, 0, 6)
    p.squash(1 + 0.04 * spin)
    return p


@clip("climb", 1.2, tags=["obstacle"])
def _(t):
    p = P().free()
    ks = {}
    for s, ph in ((1, 0.0), (-1, 0.5)):
        u = (t / 1.2 + ph) % 1.0
        k = 0.5 - 0.5 * math.cos(2 * pi * u)            # 0 = hand pulled down to the chest, 1 = full reach
        ks[s] = k
        p.arm(s, 30 + 14 * k, 112 + (UP - 110) * k, 0, lerp(95, 6, k))   # reach straight, pull with a bent elbow
        p.hand(s, (-25 * k, 0, 0))
        p.leg(s, 18 + 34 * (1 - k), 6, 0.11 * (1 - k))    # the opposite leg steps up as the hand pulls
        p.foot(s, -20 + 15 * (1 - k))
    p.root(loc=(0, 0, 0.09 * math.sin(4 * pi * t / 1.2 - pi / 2) + 0.09))
    p.spine((8, 0, 6 * (ks[1] - ks[-1]))).chest((-4, 0, -3 * (ks[1] - ks[-1])))
    p.squash(1 + 0.03 * math.sin(4 * pi * t / 1.2))
    return p


@clip("hang", 2.4, tags=["obstacle"])
def _(t):
    p = P().free()
    sw = 12 * wave(t, 2.4)
    p.hips(r=(sw, 0, 2 * wave(t, 2.4, 0.3)))
    p.arms(10 - sw, UP + 4)                             # hands stay on the bar while the body swings
    for s, ph in ((1, -0.1), (-1, -0.16)):
        p.leg(s, 10 + 18 * wave(t, 2.4, ph), 4)
        p.foot(s, 25 + 8 * wave(t, 2.4, ph - 0.1))
    p.squash(1.07 + 0.015 * wave(t, 1.2))
    p.chest((-4 - 0.3 * sw, 0, 0))
    return p


@clip("push", 1.4, tags=["obstacle"], speed=gait_speed(1.4, 0.7, 0.1))
def _(t):
    p = P()
    uL = legs_gait(p, t, 1.4, 0.7, 0.1, 0.05)
    body_gait(p, uL, 0.7, sway=3, twist=3, lean=26, bounce=0.02, arm=0)
    strain = 0.6 * math.sin(2 * pi * t / 0.14)
    p.arms(86 + strain, 24, 0, 38)                          # braced elbows
    p.hand(1, (-35, 0, 0)).hand(-1, (-35, 0, 0))
    p.chest((-6, 0, strain * 0.5))
    return p


@clip("carry", 1.0, tags=["obstacle"], speed=gait_speed(1.0, 0.6, 0.1))
def _(t):
    p = P()
    uL = legs_gait(p, t, 1.0, 0.6, 0.1, 0.06)
    body_gait(p, uL, 0.6, sway=4, twist=3, lean=-5, bounce=0.04, arm=0)
    p.arms(52 + 4 * math.cos(4 * pi * (uL - 0.1)), 26, 0, 62)  # holding a box
    p.chest((-4, 0, 0))
    return p


@clip("balance", 2.4, tags=["obstacle"])
def _(t):
    # on one foot, arms out: a held teeter, then it TIPS (snap with overshoot), the arms windmill hard for a beat, it
    # catches itself and holds; then the same to the other side
    p = P()
    tip = strike(t, [(0.0, 0.0), (0.55, 0.0), (0.66, 15.0), (0.95, -2.0), (1.15, 0.0), (1.75, 0.0), (1.86, -15.0),
                     (2.15, 2.0), (2.4, 0.0)], 0.1, 0.15, loop=2.4)
    wob = 1.5 * math.sin(2 * pi * t / 0.6)                       # the held teeter: small
    p.spine((2, 0, tip + wob)).chest((0, 0, -0.35 * tip))
    flail = bump(t % 1.2, 0.6, 1.02)                             # one windmill beat per tip
    a = 2 * pi * ((t % 1.2) - 0.6) / 0.21
    for s in (1, -1):
        p.arm(s, 50 * flail * math.sin(a + (0 if s > 0 else pi)), 92 + s * 1.6 * tip + 45 * flail * math.cos(a + (0 if s > 0 else pi)),
              0, 10 + 30 * flail)
    p.leg(1, 4, 12 + 0.6 * abs(tip), 0.1)                       # the left foot up
    p.leg(-1, 0, 2)
    p.squash(1 - 0.05 * (loop_pulse(t, 2.4, 0.66, 0.07, 3) + loop_pulse(t, 2.4, 1.86, 0.07, 3)))
    return p


@clip("whoa", 1.3, loop=False, tags=["obstacle", "hit"])
def _(t):
    # losing your balance: up on the toes, it pitches forward (accelerating), arms WINDMILL backwards, the back foot
    # kicks up, it rocks back past centre (catch), a relieved squash, back to idle
    p = P()
    a, _h = topple(t, 0.06, w0=1.2, L=1.6, bounce=0.0, end=26)                  # tips forward like a block...
    back = strike(t, [(0, 0.0), (0.5, 0.0), (0.66, -36.0), (0.9, -4.0), (1.15, 0.0)], 0.12, 0.15)   # ...then rocks back
    pitch = a * (1 - ease(clamp((t - 0.45) / 0.12))) + back
    p.spine((pitch, 0, 3 * math.sin(2 * pi * t / 0.35) * bump(t, 0.15, 0.6))).chest((0.3 * pitch, 0, 0))
    mill = bump(t, 0.12, 0.85)
    for s, ph in ((1, 0.0), (-1, 0.35)):
        ang = -2 * pi * (t / 0.24 + ph)                                         # backwards windmill, out of step
        p.arm(s, 80 * mill * math.sin(ang), RELAX + mill * (95 + 40 * math.cos(ang)), 0, 10)
    p.leg(-1, -30 * bump(t, 0.2, 0.62), 6, 0.1 * bump(t, 0.2, 0.62))           # the back foot kicks up
    p.leg(1, 0, 6)
    p.foot(1, 22 * bump(t, 0.05, 0.5))                                          # up on the toes
    relief = pulse(t, 0.95, 0.12, 2.5)
    p.squash(1 + 0.05 * bump(t, 0.1, 0.4) - 0.12 * relief)
    p.crouch(0.04 * relief)
    return p


@clip("swim", 1.2, tags=["obstacle"])
def _(t):
    p = P().free()
    p.root(loc=(0, 0, 0.35 + 0.03 * wave(t, 0.6)))
    p.hips(r=(78, 0, 8 * wave(t, 1.2)))
    for s, ph in ((1, 0.0), (-1, 0.5)):
        u = (t / 1.2 + ph) % 1.0
        p.arm(s, 60 + 70 * math.sin(2 * pi * u), 115 + 45 * math.cos(2 * pi * u))
        p.leg(s, -16 + 18 * wave(t, 0.4, ph * 0.5), 6)
        p.foot(s, 30)
    p.chest((0, 10 * wave(t, 1.2, 0.25), 0))
    return p


# --------------------------------------------------------------------------
# shooter
# --------------------------------------------------------------------------
AIM_R = (86, 2, 0)      # blaster arm: straight forward
AIM_L = (40, 26, 0)     # free arm: fist up by the chest


def stance(p, t, period=2.0):
    p.leg(1, 4, 10).leg(-1, -4, 10)
    p.spine((4, 12, 0)).chest((0, -4, 0))
    p.squash(1 + 0.01 * wave(t, period))
    return p


def aim_arms(p, kick=0.0, sway=0.0):
    p.arm(-1, AIM_R[0] + kick + sway, AIM_R[1], AIM_R[2], 2 + 0.5 * kick)      # the elbow gives a little on recoil
    p.arm(1, AIM_L[0] + 0.4 * kick + sway * 1.5, AIM_L[1], AIM_L[2], 85)
    p.hand(-1, (-0.6 * kick, 0, 0))
    return p


NO_ARM_DRAG = {"chest": 0.035, "hand.L": 0.05}


@clip("aim", 2.0, tags=["shooter"], drag=NO_ARM_DRAG)
def _(t):
    p = stance(P(), t)
    aim_arms(p, sway=1.0 * wave(t, 2.0))
    p.chest((1.2 * wave(t, 2.0, 0.3), 0, 0))
    return p


@clip("shoot", 0.45, loop=False, tags=["shooter"], drag=NO_ARM_DRAG, tempo=1.15)
def _(t):
    k = pulse(t, 0.025, 0.12, 2.4)
    p = stance(P(), t)
    aim_arms(p, kick=28 * k)
    p.spine((-9 * k, 0, 0)).chest((-5 * k, 0, 0)).squash(1 - 0.06 * k)
    p.spine(loc=(0, -0.025 * k, 0))
    return p


@clip("shoot-auto", 0.3, tags=["shooter"], drag=NO_ARM_DRAG)
def _(t):
    k = sum(loop_pulse(t, 0.3, a, 0.035, 3.5) for a in (0.0, 0.1, 0.2))   # three hard kicks
    p = stance(P(), t, 0.3)
    aim_arms(p, kick=11 * k)
    p.spine((-4 * k, 0, 0), loc=(0, -0.015 * k, 0)).squash(1 - 0.04 * k)
    return p


@clip("run-aim", RUN["T"], tags=["shooter", "move"], drag=NO_ARM_DRAG, speed=_spd(RUN))
def _(t):
    p = P()
    uL = bound(p, t, RUN)
    body_gait(p, uL, RUN["beta"], sway=2, twist=2, lean=8, bounce=0.0, arm=0)
    p.spine((0, 10, 0))
    aim_arms(p, sway=3 * math.cos(4 * pi * uL))
    return p


@clip("walk-aim", WALK["T"], tags=["shooter", "move"], drag=NO_ARM_DRAG, speed=_spd(WALK))
def _(t):
    p = P()
    uL = legs_gait(p, t, **WALK)
    body_gait(p, uL, WALK["beta"], twist=2, arm=0)
    p.spine((0, 10, 0))
    return aim_arms(p, sway=1.5 * math.cos(4 * pi * uL))


@clip("reload", 1.4, loop=False, tags=["shooter"], tempo=1.25)
def _(t):
    p = stance(P(), t)
    down = C(t, [(0, 0), (0.22, 1.05), (0.3, 1), (1.05, 1), (1.25, -0.04), (1.4, 0)])
    slap = pulse(t, 0.55, 0.12, 2.5) + pulse(t, 0.88, 0.12, 2.5)
    p.arm(-1, lerp(AIM_R[0], 40, down), lerp(AIM_R[1], 18, down), lerp(0, -30, down), lerp(2, 75, down))  # gun up by the chest
    p.arm(1, lerp(AIM_L[0], 58, down) + 14 * slap, lerp(AIM_L[1], -12, down), 0, lerp(85, 70, down) - 25 * slap)
    p.hand(-1, (-12 * slap, 0, 0))
    p.spine((8 * down, 12 - 16 * down, 0)).chest((12 * down + 4 * slap, 0, 0))
    p.squash(1 - 0.03 * slap)
    return p


@clip("throw", 1.0, loop=False, tags=["shooter"], tempo=1.2)
def _(t):
    p = P()
    R = 0.44                                   # release
    p.arm(-1, C(t, [(0, 0), (0.3, -40), (R, 120), (0.6, 70), (0.8, 20), (1.0, 0)]),
          C(t, [(0, RELAX), (0.3, 130), (R, 40), (0.7, 20), (1.0, RELAX)]), 0,
          C(t, [(0, ELBOW), (0.3, 105), (R - 0.04, 60), (R, 4), (0.6, 10), (1.0, ELBOW)]))   # cock, then whip straight
    p.arm(1, C(t, [(0, 0), (0.3, 70), (R, -25), (0.7, -10), (1.0, 0)]), RELAX + 20 * bump(t, 0.0, 1.0), 0, 30 * bump(t, 0.1, 0.8) + ELBOW)
    p.spine((C(t, [(0, 0), (0.3, -12), (R + 0.04, 22), (0.75, 6), (1.0, 0)]),
             C(t, [(0, 0), (0.3, -30), (R + 0.04, 26), (0.75, 8), (1.0, 0)]), 0))
    p.chest((0, C(t, [(0, 0), (0.3, -14), (R + 0.04, 18), (1.0, 0)]), 0))
    p.leg(1, K(t, [(0.18, 0), (0.36, 24), (0.8, 24), (0.98, 0)]), 8, 0.07 * (bump(t, 0.18, 0.37) + bump(t, 0.8, 0.98)))
    p.squash(1 - 0.05 * pulse(t, R, 0.1))
    return p


@clip("punch", 0.7, loop=False, tags=["shooter"])
def _(t):
    # fists up (guard), chamber, JAB (fist arrives first), hold a beat, back to guard, drop
    p = P()
    g = strike(t, [(0, 0.0), (0.1, 1.0), (0.5, 1.0), (0.62, 0.0)], 0.1, 0.08)
    jab = strike(t, [(0, 0.0), (0.12, -0.25), (0.2, 1.0), (0.36, 1.0), (0.46, 0.0)], 0.08, 0.12)
    p.arm(1, lerp(lerp(0, 24, g), 92, jab), lerp(lerp(RELAX, 26, g), 10, jab), 0, max(0.0, lerp(lerp(ELBOW, 115, g), 0, max(jab, 0))))
    p.arm(-1, 34 * g, lerp(RELAX, 26, g), 0, lerp(ELBOW, 108, g))
    p.spine((9 * jab, -14 * jab, 0), loc=(0, 0.07 * max(jab, 0), 0)).chest((0, -6 * jab, 0))
    step = strike(t, [(0, 0.0), (0.16, 1.0), (0.44, 0.0)], 0.1, 0.0)           # swings only inside the lifts
    p.leg(1, 20 * step, 6, 0.07 * (bump(t, 0.05, 0.18) + bump(t, 0.33, 0.46)))
    p.squash(1 + 0.05 * max(jab, 0) - 0.07 * pulse(t, 0.16, 0.06))
    return p


@clip("death", 0.95, loop=False, tags=["shooter", "hit"])
def _(t):
    p = P()
    T0 = 0.04
    hit = pulse(t, T0, 0.12, 2.5)
    a, hits = topple(t, T0, w0=3.4, L=1.6, bounce=0.24, end=90)       # shot, then over like a plank
    th = hits[0] if hits else 0.5
    p.root(loc=(0, pivot_fwd(-a, -0.16) - 0.07 * ease_out((t - T0) / 0.12), 0), r=(-a, 0, 0))
    p.hips(r=(0, 22 * ease_out(t / 0.35), 4 * bump(t, 0, th)))
    imp = impacts(t, hits, 0.07, 0.3)
    p.squash(1 - 0.12 * hit - 0.32 * imp)
    p.spine((-14 * hit, 0, 0))
    p.arms(K(t, [(0, 0), (0.1, 35), (th, -20), (th + 0.06, 0), (0.95, -8)]),
           K(t, [(0, RELAX), (0.1, 128), (th, 166), (th + 0.07, 140), (0.95, 146)]), 0,
           K(t, [(0, ELBOW), (0.1, 30), (th, 4), (th + 0.08, 25), (0.95, 18)]))
    for s, d in ((1, 0.0), (-1, 0.03)):
        p.leg(s, K(t, [(0, 0), (th - 0.04, 22), (th + d, 62), (th + 0.08 + d, 78), (th + 0.25, 56), (0.95, 58)]), 12)
        p.foot(s, -10)
    return p


@clip("respawn", 0.6, loop=False, tags=["shooter"])
def _(t):
    p = P()
    k = K(t, [(0, 0.05), (0.14, 1.22), (0.26, 0.9), (0.38, 1.04), (0.5, 0.99), (0.6, 1.0)])
    p.scale_all(k)
    p.squash(K(t, [(0, 1), (0.12, 1.22), (0.26, 0.84), (0.38, 1.05), (0.6, 1)]))
    p.root(r=(0, K(t, [(0, -200), (0.3, 0)], fn=lambda u: ease_out(u, 3)), 0))
    p.arms(K(t, [(0, 0), (0.3, 15), (0.6, 0)]), K(t, [(0, UP), (0.2, 140), (0.4, 95), (0.6, RELAX)]), 0, 20)
    return p


# --------------------------------------------------------------------------
# celebrate
# --------------------------------------------------------------------------
@clip("victory", 1.0, tags=["celebrate"])
def _(t):
    # punch the air on the beat, hold it, pull down, punch again
    p = P()
    pump = strike(t, [(0.0, 1.0), (0.3, 0.2), (0.5, 1.0), (0.8, 0.2)], 0.1, 0.15, loop=1.0)
    p.arm(-1, 14, 116 + (UP - 112) * pump, 10, 60 - 50 * pump)
    p.arm(1, -14, 62, 90, 85)                                            # other fist on the hip
    hit = loop_pulse(t, 1.0, 0.0, 0.07, 3) + loop_pulse(t, 1.0, 0.5, 0.07, 3)
    p.squash(1 + 0.05 * pump - 0.07 * hit)
    p.spine((-5, -6, -7 * pump)).chest((-5 * pump, 0, 0))
    p.leg(1, 0, 8).leg(-1, 0, 8)
    p.crouch(0.04 * (1 - pump))
    return p


@clip("cheer", 0.56, tags=["celebrate"])
def _(t):
    # bouncing for joy: a big hop, land, sink, spring straight back up. Never stands still.
    p = P()
    H = 0.3
    FT = flight(H)[1]                                             # ~0.28 s of air
    GND = 0.56 - FT                                               # ~0.28 s of contact: squash, sink, push
    p.air(ballistic(t, 0.0, H))
    crouch, push = takeoff(t - FT, GND, down=GND - 0.067, push=0.067) if t > FT else (0.0, 0.0)  # sink the whole contact
    land = impacts(t, [FT], 0.08, 1)
    up = clamp(1 - t / FT) if t < FT else 0.0
    p.crouch(0.1 * crouch)
    p.squash(1 - 0.24 * land - 0.06 * crouch + 0.12 * push + 0.14 * up ** 2)
    arms = strike(t, [(0.0, 1.0), (FT + 0.04, 0.55), (0.56 - 0.02, 1.0)], 0.1, 0.12, loop=0.56)   # punch up on every hop
    tuck = bump(t, 0.04, FT - 0.02)
    for s, d in ((1, 0.0), (-1, 5.0)):
        p.arm(s, 14 + d, lerp(RELAX + 40, UP, arms), 10, lerp(70, 15, arms))
        p.leg(s, 16 * tuck, 12 * tuck, 0.06 * tuck)
        p.foot(s, 30 * up + 12 * push)
    p.spine((6 * crouch - 6 * up, 0, 0))
    return p


@clip("jumping-jacks", 0.8, tags=["celebrate"])
def _(t):
    # a rubber ball: hop OUT, land, sink and spring straight back up into the hop IN. Never stands still.
    p = P()
    HALF, H = 0.4, 0.15
    FT = flight(H)[1]                                             # ~0.2 s of air per hop
    GND = HALF - FT                                               # ~0.2 s of contact: sink, then push
    u = t % HALF
    first = t < HALF                                              # this hop goes out (else back in)
    p.air(ballistic(u, 0.0, H))
    if u > FT:                                                    # on the ground: land -> sink -> push
        crouch, push = takeoff(u - FT, GND, down=GND - 0.067, push=0.067)   # sink the whole contact
    else:
        crouch, push = 0.0, 0.0
    land = impacts(t, [FT, HALF + FT], 0.08, 1)
    p.crouch(0.08 * crouch)
    up = clamp(1 - u / FT) if u < FT else 0.0                     # 1 at take-off, fading through the air
    p.squash(1 - 0.22 * land - 0.06 * crouch + 0.12 * push + 0.12 * up ** 2)
    # legs open / close only while airborne (planted feet never slide)
    out = K(t, [(0.02, 0), (FT - 0.02, 1), (HALF + 0.02, 1), (HALF + FT - 0.02, 0)], fn=ease)
    for s in (1, -1):
        p.leg(s, 0, lerp(2, 26, out))
        p.foot(s, 18 * up + 10 * push)
    arms = strike(t, [(0.0, 0.0), (FT - 0.03, 1.0), (HALF, 1.0), (HALF + FT - 0.03, 0.0)], 0.12, 0.12, loop=0.8)
    p.arm(1, 0, lerp(RELAX - 8, UP + 8, arms), 0, 12)
    p.arm(-1, 0, lerp(RELAX - 8, UP + 4, arms), 0, 16)            # a touch out of step: not a robot
    p.spine((5 * crouch, 0, 0)).chest((-4 * up, 0, 0))
    return p

@clip("wave", 1.4, tags=["celebrate", "social"])
def _(t):
    # the free (left) hand: snap up beside the head (upper arm just above shoulder height, out to the side, forearm
    # upright, palm to the front), then elbow strikes +-16 deg round upright with short holds, hand a frame behind
    p = P()
    on = 1.0                                                # a loop: the hand stays up (the game blends in and out)
    keys = [(0.0, 1.0), (0.35, -1.0), (0.7, 1.0), (1.05, -1.0), (1.4, 1.0)]
    w = strike(t, keys, 0.1, 0.1, loop=1.4)
    wh = strike(t - 1 / FPS, keys, 0.1, 0.15, loop=1.4)    # the hand flicks one frame behind the forearm
    p.arm(1, lerp(0, 3, on), lerp(RELAX, 96, on), lerp(0, -90, on), lerp(ELBOW, 78 + 16 * w, on))   # 78 = forearm about upright, a hand clear of the head
    p.hand(1, (0, 0, 14 * wh * on))
    p.spine((0, 6 * on, -4 * on)).chest((0, 0, 1.5 * on * w))
    p.squash(1 + 0.03 * on)
    p.leg(1, 0, 5).leg(-1, 0, 5)
    return p


@clip("wave-big", 0.72, tags=["celebrate", "social"])
def _(t):
    # a FAST, wide wave to get attention: the calm wave's pose (upper arm out just above the shoulder, forearm up beside
    # the head) but the forearm whips +-30 deg about upright at 0.18 s a stroke, the whole arm rocking with it, the hand
    # flicking a frame behind, and the body bouncing on every stroke, up on the toes
    p = P()
    keys = [(0.0, 1.0), (0.18, -1.0), (0.36, 1.0), (0.54, -1.0), (0.72, 1.0)]
    w = strike(t, keys, 0.1, 0.08, loop=0.72)
    wh = strike(t - 1 / FPS, keys, 0.1, 0.15, loop=0.72)
    p.arm(1, 4, 97 + 10 * w, -90, 42 + 26 * w)                       # shoulder and elbow both swing: hand stays clear of the head
    p.hand(1, (0, 0, 22 * wh))
    p.arm(-1, 6, RELAX + 4)
    beat = loop_pulse(t, 0.18, 0.0, 0.06, 3)
    p.spine((-4, 6 * w, 0)).chest((-3, 3 * w, 0))                    # the body twists with the stroke, no tilt
    p.squash(1 + 0.03 - 0.05 * beat)
    p.crouch(0.02 * beat)
    p.foot(1, 12 + 6 * beat).foot(-1, 12 + 6 * beat)
    p.leg(1, 0, 6).leg(-1, 0, 6)
    return p

@clip("celebrate-backflip", 1.45, loop=False, tags=["celebrate"])
def _(t):
    p = P()
    T0, H = 0.14, 1.1
    T1 = T0 + flight(H)[1]
    pre, push = takeoff(t, T0) if t <= T0 else (0.0, 0.0)
    land = impacts(t, [T1], 0.09, 1) - 0.22 * bump(t, T1 + 0.08, T1 + 0.3)
    p.crouch(0.13 * pre + 0.13 * max(land, 0))
    p.air(ballistic(t, T0, H))
    u = clamp((t - T0) / (T1 - T0))
    spin = u - 0.16 * math.sin(2 * pi * u) / (2 * pi) * 2              # spins fastest tucked, slows opening out
    p.hips(r=(-360 * clamp(spin) if t > T0 else 0, 0, 0))
    tuck = bump(t, T0 + 0.03, T1 - 0.06)
    p.squash(1 - 0.2 * pre - 0.16 * tuck + 0.12 * bump(t, T0, T0 + 0.08) - 0.25 * max(land, 0))
    p.arms(K(t, [(0, 0), (0.09, -45), (T0 + 0.05, 25), (T1 - 0.06, 30), (T1 + 0.05, 10), (1.12, 4), (1.4, 0)]),
           K(t, [(0, RELAX), (0.09, RELAX), (T0 + 0.05, UP), (T0 + 0.2, 100), (T1 - 0.05, 120), (T1 + 0.06, UP), (1.12, UP - 6),
                 (1.4, RELAX)]),
           0, K(t, [(0, ELBOW), (T0 + 0.1, 70), (T1 - 0.05, 20), (1.12, 10), (1.4, ELBOW)]))
    for s in (1, -1):
        p.leg(s, 80 * tuck, 0, 0.1 * tuck)
        p.foot(s, 30 * tuck)
    p.spine((-8 * bump(t, T1 + 0.1, 1.35), 0, 0))
    return p


# --------------------------------------------------------------------------
# dance (120 bpm: a beat is 0.5 s)
# --------------------------------------------------------------------------
def groove(t, period=BEAT, depth=0.04):
    """Down on every beat."""
    return depth * max(0.0, math.cos(2 * pi * t / period)) ** 2


@clip("dance-bob", 4 * BEAT, tags=["dance"])
def _(t):
    # step-touch, hit on every beat: step right, touch, step left, touch; arms hit a pose per beat
    p = P()
    W, S = HIPW + 0.03, 0.22
    R = strike(t, [(0.0, -W), (0.5, -W - S)], 0.12, 0.001, loop=2.0)   # feet never overshoot
    L = strike(t, [(1.0, W - S), (1.5, W)], 0.12, 0.001, loop=2.0)
    body = (L + R) / 2
    p.root(loc=(body, 0, 0))
    liftR = bump(t % 2.0, 0.36, 0.5) + bump(t % 2.0, 1.86, 2.0)
    liftL = bump(t % 2.0, 0.86, 1.0) + bump(t % 2.0, 1.36, 1.5)
    plant_x(p, -1, R, body, lift=0.07 * liftR)
    plant_x(p, 1, L, body, lift=0.07 * liftL)
    p.foot(-1, 14 * liftR).foot(1, 14 * liftL)
    beat = sum(loop_pulse(t, 2.0, b * BEAT, 0.08, 3) for b in range(4))
    p.crouch(0.05 * beat).squash(1 - 0.08 * beat)
    lean = strike(t, [(0.0, -1.0), (0.5, 1.0), (1.0, -1.0), (1.5, 1.0)], 0.1, 0.12, loop=2.0)
    p.spine((6 * beat, 0, -10 * lean)).chest((0, 0, 6 * lean))
    for s in (1, -1):
        a = strike(t, [(0.0, 1.0), (0.5, -1.0), (1.0, 1.0), (1.5, -1.0)], 0.1, 0.12, loop=2.0) * s
        p.arm(s, 32 + 34 * a, RELAX - 4 + 10 * a, 0, 72 + 14 * a)
    return p


@clip("dance-disco", 4 * BEAT, tags=["dance"])
def _(t):
    p = P()
    up = C(t, [(0, 0), (0.12, 1.05), (0.5, 1), (0.62, -0.05), (1.0, 0), (1.12, 1.05), (1.5, 1), (1.62, -0.05), (2.0, 0)], loop=2.0)
    p.arm(-1, lerp(30, 24, up), lerp(55, UP, up), 0)                     # point up...
    p.arm(1, lerp(40, 22, up), lerp(105, 34, up), 0)                     # ...and down
    p.spine((0, 14 * (2 * up - 1), 10 * (2 * up - 1))).chest((0, -8 * (2 * up - 1), 0))
    p.crouch(groove(t) * 1.5)
    p.leg(1, 0, 10).leg(-1, 0, 10)
    p.spine(loc=(0.05 * (2 * up - 1), 0, 0))
    p.foot(1, -14 * up).foot(-1, -14 * (1 - up))
    return p


@clip("dance-spin", 4 * BEAT, tags=["dance"])
def _(t):
    # load (beat 1), whip round fast (beat 2), hit the pose (beat 3), hold, reset (beat 4)
    p = P()
    yaw = K(t, [(0.5, 0), (0.95, 360)], fn=lambda u: ease_out(u, 2.2))
    fx, fy = -HIPW, -0.01
    c, sn = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    p.root(loc=(fx - (c * fx - sn * fy), -(fy - (sn * fx + c * fy)), 0), r=(0, yaw, 0))
    prep = strike(t, [(0.0, 0.0), (0.4, 1.0), (0.6, 0.0)], 0.1, 0.1, loop=2.0)
    spin = strike(t, [(0.0, 0.0), (0.45, 1.0), (0.95, 0.0)], 0.1, 0.08, loop=2.0)
    hitp = strike(t, [(0.0, 0.0), (1.0, 1.0), (1.85, 0.0)], 0.1, 0.12, loop=2.0)
    p.crouch(0.09 * prep + 0.05 * hitp)
    p.arm(1, 10 + 25 * prep, RELAX + 10 * prep - 20 * spin + 75 * hitp, 0, ELBOW + 90 * spin)
    p.arm(-1, 10 + 25 * prep, RELAX + 10 * prep - 20 * spin + 100 * hitp, 0, ELBOW + 90 * spin)
    p.leg(1, 14 * spin, 4, 0.14 * spin).foot(1, 35 * spin)
    p.squash(1 - 0.12 * prep + 0.08 * spin - 0.07 * hitp + 0.05 * loop_pulse(t, 2.0, 1.0, 0.07, 3) * -1)
    p.spine((9 * prep - 5 * hitp, 0, 4 * hitp))
    return p


@clip("dance-robot", 4 * BEAT, tags=["dance"], drag={})
def _(t):
    poses = [  # (right arm swing, raise, twist, elbow), (left ...), chest yaw, crouch
        ((0, RELAX, 0, ELBOW), (0, RELAX, 0, ELBOW), 0, 0.0), ((20, 30, 0, 90), (0, RELAX, 0, ELBOW), 20, 0.03),
        ((20, 30, 0, 90), (20, 30, 0, 90), 0, 0.0), ((0, 92, 90, 90), (0, 92, 90, 90), -18, 0.03),
        ((0, 92, 90, 90), (0, 92, -90, 90), 0, 0.0), ((90, 6, 0, 0), (0, 92, 90, 90), 18, 0.03),
        ((0, 92, -90, 90), (90, 6, 0, 0), -20, 0.0), ((-20, 30, 0, 90), (-20, 30, 0, 90), 0, 0.04),
        ((0, RELAX, 0, ELBOW), (0, RELAX, 0, ELBOW), 0, 0.0)]
    seg = 4 * BEAT / (len(poses) - 1)
    i = min(int(t / seg), len(poses) - 2)
    u = (t - i * seg) / 0.12
    k = ease(u) + 0.1 * math.sin(pi * clamp(u - 1)) * (1 - clamp(u - 2))   # snap, tiny overshoot, hold
    a, b = poses[i], poses[i + 1]
    p = P()
    p.arm(-1, *[lerp(x, y, k) for x, y in zip(a[0], b[0])])
    p.arm(1, *[lerp(x, y, k) for x, y in zip(a[1], b[1])])
    p.chest((0, lerp(a[2], b[2], k), 0))
    p.crouch(lerp(a[3], b[3], k))
    return p


@clip("dance-floss", 2 * BEAT, tags=["dance"])
def _(t):
    # hips snap one way, arms swing the other, hit on every half beat
    p = P()
    h = BEAT / 2
    c = strike(t, [(0.0, -1.0), (h * 2, 1.0)], 0.12, 0.08, loop=2 * BEAT)
    s2 = strike(t, [(0.0, 1.0), (h, -1.0), (2 * h, 1.0), (3 * h, -1.0)], 0.1, 0.08, loop=2 * BEAT)
    p.spine((0, 0, 12 * c), loc=(0.07 * c, 0, 0)).chest((0, 0, -6 * c))
    p.arm(1, 62 * s2, 30 - 28 * c, 0, 4)
    p.arm(-1, -62 * s2, 30 + 28 * c, 0, 4)
    beat = sum(loop_pulse(t, 2 * BEAT, b * h, 0.06, 3) for b in range(4))
    p.crouch(0.025 * beat)
    p.leg(1, 0, 8).leg(-1, 0, 8)
    return p


@clip("dance-hop", 2 * BEAT, tags=["dance"])
def _(t):
    # a hop on every beat, kicking alternate legs: land ON the beat, sink with the groove, push into the next
    p = P()
    side = 1 if t < BEAT else -1
    u = t % BEAT
    H = 0.16
    FT = flight(H)[1]                                             # ~0.2 s of air
    GND = BEAT - FT                                               # ~0.3 s of contact
    T0 = BEAT - FT                                                # leave the floor so the landing is on the beat
    p.air(ballistic(u, T0, H))
    if u < T0:
        crouch, push = takeoff(u, T0, down=T0 - 0.067, push=0.067)      # sink through the groove, then push
    else:
        crouch, push = 0.0, 0.0
    land = loop_pulse(t, BEAT, 0.0, 0.08, 2.5)
    p.crouch(0.08 * crouch)
    air = bump(u, T0, BEAT)
    kick = air
    p.leg(-side, 38 * kick, 10, 0.06 * kick).foot(-side, 28 * kick)
    p.leg(side, 0, 6).foot(side, 14 * push)
    p.spine((5 * crouch, 0, 12 * side * air)).chest((0, 8 * side * air, 0))
    for s in (1, -1):
        p.arm(s, 30 * air * (1 if s == side else -0.5), RELAX + 30 + 24 * air - 10 * crouch, 0, 30)
    p.squash(1 - 0.16 * land - 0.05 * crouch + 0.1 * push + 0.05 * air)
    return p


# --------------------------------------------------------------------------
# social
# --------------------------------------------------------------------------
@clip("bow", 1.5, loop=False, tags=["social"])
def _(t):
    # a courtly flourish: rise and fling the free arm up and out, sweep it round to the heart while the right foot steps
    # back and the gun arm swings out behind, BOW deep (overshoot, hold), then pop back up with the foot returning
    p = P()
    D, O = 0.12, 0.1
    sw = strike(t, [(0, 0.0), (0.14, -20.0), (0.3, 50.0), (0.44, 62.0), (1.08, 62.0), (1.34, 0.0)], D, O)
    ra = strike(t, [(0, RELAX), (0.14, 128.0), (0.3, 70.0), (0.44, -4.0), (1.08, -4.0), (1.34, RELAX)], D, O)
    be = strike(t, [(0, ELBOW), (0.14, 8.0), (0.3, 30.0), (0.44, 100.0), (1.08, 100.0), (1.34, ELBOW)], D, 0.06)
    p.arm(1, sw, ra, 0, be)
    twirl = strike(t, [(0, 0.0), (0.14, -50.0), (0.3, 40.0), (0.44, 0.0)], D, 0.1)            # the wrist rolls through it
    p.hand(1, (0, 0, twirl))
    p.arm(-1, strike(t, [(0, 0.0), (0.4, -48.0), (1.08, -48.0), (1.34, 0.0)], D, O),
          strike(t, [(0, RELAX), (0.4, 72.0), (1.08, 72.0), (1.34, RELAX)], D, O))            # out behind
    bow = strike(t, [(0, 0.0), (0.14, -7.0), (0.52, 50.0), (1.06, 46.0), (1.3, -5.0), (1.44, 0.0)], 0.14, 0.12)
    p.spine((bow, 0, 0)).chest((0.25 * max(bow, 0), 0, 0))
    step = strike(t, [(0, 0.0), (0.32, -26.0), (1.22, -26.0), (1.4, 0.0)], 0.12, 0.0)
    p.leg(-1, step, 6, 0.07 * (bump(t, 0.19, 0.33) + bump(t, 1.27, 1.41)))
    p.leg(1, 0, 6)
    p.squash(1 + 0.05 * bump(t, 0.05, 0.22) - 0.07 * pulse(t, 0.52, 0.08) + 0.04 * pulse(t, 1.32, 0.08))
    return p


@clip("taunt", 1.0, tags=["social"])
def _(t):
    # "come on": two sharp beckons, hold the palms-up pose between them
    p = P()
    beckon = strike(t, [(0.0, 0.0), (0.12, 1.0), (0.22, 0.0), (0.36, 1.0), (0.46, 0.0)], 0.1, 0.1, loop=1.0)
    p.arms(58, 24, 0, 34 + 46 * beckon)
    p.hand(1, (-45 * beckon, 0, 70)).hand(-1, (-45 * beckon, 0, -70))
    nod = strike(t, [(0.0, 0.0), (0.12, 1.0), (0.46, 0.0)], 0.1, 0.1, loop=1.0)
    p.spine((-8, 0, 0)).chest((-6 - 6 * nod, 0, 4 * nod))
    p.squash(1.03 + 0.03 * beckon)
    p.leg(1, 6, 10).leg(-1, -6, 10)
    return p


@clip("thumbs-up", 1.1, loop=False, tags=["social"])
def _(t):
    # wind up (arm pulled in tight, body turned away), THRUST the fist up and out with the whole body behind it, two
    # little pumps, a nod, back
    p = P()
    wind = strike(t, [(0, 0.0), (0.12, 1.0), (0.2, 0.0)], 0.1, 0.0)
    k = strike(t, [(0, 0.0), (0.24, 1.0), (0.9, 1.0), (1.06, 0.0)], 0.1, 0.12)
    pump = strike(t, [(0, 0.0), (0.46, 1.0), (0.54, 0.0), (0.64, 1.0), (0.72, 0.0)], 0.08, 0.1)
    p.arm(1, -25 * wind + 64 * k + 8 * pump, lerp(RELAX, 34, k) - 15 * wind, 15 * k, lerp(ELBOW, 72, k) + 40 * wind - 14 * pump)
    p.hand(1, (0, 0, -80 * k))
    p.spine((5 * k - 4 * wind, -12 * wind + 16 * k, -4 * k)).chest((-4 * k + 6 * pump, 6 * k, 0))
    p.squash(1 - 0.06 * wind + 0.08 * pulse(t, 0.24, 0.1) - 0.04 * pump)
    p.leg(1, 10 * k, 8, 0.06 * (bump(t, 0.12, 0.3) + bump(t, 0.86, 1.08)))   # a little step into it, and back
    p.arm(-1, -10 * k, RELAX + 6 * k)
    return p


@clip("yes", 1.0, loop=False, tags=["social"], tempo=1.15)
def _(t):
    nod = strike(t, [(0, 0.0), (0.1, -4.0), (0.24, 15.0), (0.38, -2.0), (0.52, 13.0), (0.66, 0.0)], 0.1, 0.1)
    return P().chest((nod, 0, 0)).spine((nod * 0.3, 0, 0)).squash(1 - 0.01 * max(nod, 0) / 15)


@clip("no", 0.8, loop=False, tags=["social"])
def _(t):
    sh = strike(t, [(0, 0.0), (0.12, -24.0), (0.26, 20.0), (0.4, -14.0), (0.56, 0.0)], 0.1, 0.1)
    return P().chest((3 * bump(t, 0, 0.7), sh, 0)).spine((0, sh * 0.25, 0))


# --------------------------------------------------------------------------
# emotions
# --------------------------------------------------------------------------
@clip("sad", 4.0, tags=["emote"])
def _(t):
    # slumped, with beats: hold the slump, a sniff (head drops, shoulders hitch), hold, a heavy sigh, hold
    p = P()
    drop = strike(t, [(0.0, 0.0), (0.9, 1.0), (1.5, 0.3), (2.6, 1.1), (3.3, 0.0)], 0.13, 0.08, loop=4.0)
    hitch = loop_pulse(t, 4.0, 0.9, 0.1, 3) + 0.6 * loop_pulse(t, 4.0, 1.05, 0.1, 3)
    br = 0.02 * math.sin(2 * pi * t / 4.0)                  # breathing only
    p.spine((26 + 4 * drop, 0, 2 + 2 * drop)).chest((22 + 6 * drop - 3 * hitch, 0, 3))
    p.squash(0.95 + br - 0.025 * drop + 0.02 * hitch)
    p.arm(1, 24 + 4 * drop, 34 - 6 * drop + 5 * hitch).arm(-1, 26 + 4 * drop, 32 - 6 * drop + 5 * hitch)
    p.leg(1, 0, 2).leg(-1, 3, -2)
    p.foot(1, -6 * strike(t, [(0.0, 0.0), (1.9, 1.0), (2.2, 0.0)], 0.12, 0.05, loop=4.0))   # a scuff
    return p


@clip("sigh", 2.4, loop=False, tags=["emote"], tempo=1.2)
def _(t):
    p = P()
    k = C(t, [(0, 0), (0.5, -0.5), (0.65, -0.55), (1.1, 1.05), (1.8, 1), (2.4, 0.15)])
    p.spine((24 * max(k, 0) - 4 * min(k, 0), 0, 0)).chest((18 * max(k, 0) - 6 * min(k, 0), 0, 0))
    p.squash(1 + 0.08 * max(-k, 0) - 0.06 * max(k, 0))
    p.arms(20 * max(k, 0) - 10 * min(k, 0), lerp(RELAX, 34, max(k, 0)) + 14 * max(-k, 0))
    return p


@clip("cry", 1.2, tags=["emote"])
def _(t):
    p = P()
    sob = sum(loop_pulse(t, 1.2, a, 0.12, 3) for a in (0.0, 0.3, 0.45, 0.8))
    p.arms(62, -2, 0, 98)                                    # hands to the face
    p.spine((22 + 3 * sob, 0, 2 * wave(t, 1.2))).chest((10 + 6 * sob, 0, 0))
    p.squash(0.95 - 0.03 * sob + 0.015 * wave(t, 1.2))
    p.leg(1, 0, -2).leg(-1, 0, -2)
    return p


@clip("defeat", 1.5, loop=False, tags=["emote"])
def _(t):
    # "oh no" (a small lift), then the knees buckle and it DROPS to its knees (accelerating), hits hard with a bounce,
    # and a beat later the torso flops forward and the arms slap down limp
    p = P()
    lift = strike(t, [(0, 0.0), (0.1, 1.0), (0.18, 0.0)], 0.08, 0.0)            # the gasp: up on the toes
    T0, T1 = 0.16, 0.3
    k = ease_in(clamp((t - T0) / (T1 - T0)), 2.6)                                    # free-fall into the kneel
    for s in (1, -1):
        p.leg(s, 86 * k, 14 * k, 0.08 * bump(t, T0, T1 + 0.04))
        p.foot(s, -20 * k + 12 * lift)
    p.hips(r=(-6 * k, 0, 0))
    hit = impacts(t, [T1, T1 + 0.17], 0.07, 0.3)
    flop = strike(t, [(0, 0.0), (T1 + 0.14, 1.0)], 0.12, 0.18)                       # the torso goes 2 frames after the knees
    head = strike(t, [(0, 0.0), (T1 + 0.2, 1.0)], 0.1, 0.25)                         # the head last, with a bounce
    p.spine((-3 * lift + 36 * flop, 0, 0)).chest((24 * head, 0, 0))
    p.squash(1 + 0.04 * lift - 0.32 * hit - 0.05 * flop)
    arm_sw = strike(t, [(0, 0.0), (T0 + 0.04, 30.0), (T1 + 0.16, -6.0)], 0.1, 0.2)
    arm_ra = strike(t, [(0, RELAX), (T0 + 0.04, 95.0), (T1 + 0.16, 10.0)], 0.1, 0.15)  # fly up on the drop, slap down limp
    p.arms(arm_sw, arm_ra, 0, ELBOW + 20 * clamp(1 - flop))
    return p


@clip("sit", 4.0, tags=["emote"])
def _(t):
    p = breathe(P(), t, 4.0)
    for s, ph in ((1, 0.0), (-1, 0.3)):
        p.leg(s, 84, 12)
        p.foot(s, -20 + 8 * max(0, wave(t, 2.0, ph)))
    p.hips(r=(-14, 0, 0))
    p.spine((4, 4 * wave(t, 4.0), 0))
    p.arms(-34, 34)
    return p


@clip("sleep", 4.0, tags=["emote"])
def _(t):
    p = P()
    br = wave(t, 4.0)
    for s in (1, -1):
        p.leg(s, 84, 12)
        p.foot(s, -20)
    p.hips(r=(-6, 0, 0))
    nod = C(t, [(0, 0), (1.6, 0.2), (2.2, 1.0), (2.4, 0.6), (4.0, 0)], loop=4.0)
    p.spine((24 + 4 * br, 0, 7)).chest((12 + 8 * nod, 0, 5))
    p.squash(0.95 + 0.04 * br)
    p.arms(20, 24)
    return p


@clip("shrug", 0.9, loop=False, tags=["emote", "social"])
def _(t):
    k = strike(t, [(0, 0.0), (0.06, -0.1), (0.2, 1.0), (0.6, 1.0), (0.78, 0.0)], 0.1, 0.12)
    p = P()
    p.arms(30 * k, lerp(RELAX, 66, k), -75 * k, lerp(ELBOW, 75, k))
    p.squash(1 + 0.08 * k)
    p.chest((0, 0, 7 * clamp(k) * (1 if t < 0.6 else 0.5)))
    p.spine((-3 * k, 0, 0))
    return p


@clip("laugh", 1.6, tags=["emote"])
def _(t):
    # throw the head back and cackle (hands on the belly, a shoulder hitch on every "ha"), then fold forward and
    # slap the knee twice, then back up
    p = P()
    fold = strike(t, [(0.0, 0.0), (0.82, 1.0), (1.42, 0.0)], 0.14, 0.12, loop=1.6)       # 0 = leaning back, 1 = folded
    has = [0.1, 0.26, 0.42, 0.58]                                                         # four "ha"s while leaning back
    ha = sum(loop_pulse(t, 1.6, a, 0.07, 3.5) for a in has)
    slaps = [0.98, 1.2]
    slap = sum(loop_pulse(t, 1.6, a, 0.06, 3.5) for a in slaps)
    p.spine((lerp(-16, 26, fold) + 4 * ha, 0, lerp(3, -4, fold))).chest((lerp(-14, 12, fold) + 8 * ha, 0, 0))
    p.squash(1 + 0.04 * (1 - fold) - 0.07 * ha - 0.08 * slap)
    p.crouch(0.03 * ha + 0.06 * fold + 0.03 * slap)
    # hands: on the belly while leaning back; the free hand slaps the knee while folded
    p.arm(-1, lerp(40, 22, fold) + 4 * ha, lerp(-6, 6, fold), 0, lerp(70, 40, fold))
    up = strike(t, [(0.0, 0.0), (0.9, 1.0), (0.98, 0.0), (1.12, 1.0), (1.2, 0.0), (1.4, 0.0)], 0.07, 0.1, loop=1.6)
    p.arm(1, lerp(40, 18 + 30 * up, fold) + 4 * ha, lerp(-6, 20 + 20 * up, fold), 0, lerp(70, 15 + 40 * up, fold))
    p.leg(1, 0, 10).leg(-1, 0, 10)
    return p


@clip("angry", 1.0, tags=["emote"])
def _(t):
    # stomp, stomp: each foot snaps up and slams down on the half beat, fists pump with it
    p = P()
    for s, at in ((1, 0.25), (-1, 0.75)):
        up = strike(t, [(at - 0.12, 0.0), (at - 0.04, 1.0), (at, 0.0)], 0.1, 0.05, loop=1.0)
        p.leg(s, 12 * up, 8, 0.14 * max(up, 0)).foot(s, -14 * up)
    stomp = loop_pulse(t, 1.0, 0.25, 0.07, 3) + loop_pulse(t, 1.0, 0.75, 0.07, 3)
    p.squash(1 - 0.12 * stomp).crouch(0.04 * stomp)
    side = strike(t, [(0.25, 1.0), (0.75, -1.0)], 0.1, 0.15, loop=1.0)
    p.spine((16 + 6 * stomp, 0, 7 * side)).chest((-6, 0, -3 * side))
    for s in (1, -1):
        pump = loop_pulse(t, 1.0, 0.25 if s > 0 else 0.75, 0.1, 2.5)
        p.arm(s, 30 + 18 * pump, 30, 0, 65 - 30 * pump)
    return p


@clip("scared", 2.4, tags=["emote"])
def _(t):
    # cowering, trembling; every so often a flinch: snaps to look left, then right, then cowers again
    p = P()
    tr = 0.6 * math.sin(2 * pi * t / 0.1)              # tremble: 3-frame period (30 fps can show it)
    look = strike(t, [(0.0, 0.0), (0.5, 1.0), (1.0, -1.0), (1.4, 0.0)], 0.1, 0.12, loop=2.4)
    flinch = loop_pulse(t, 2.4, 0.5, 0.08, 3) + loop_pulse(t, 2.4, 1.0, 0.08, 3)
    p.arms(66 + 2 * tr, 8, 0, 88)
    p.squash(0.86 + 0.008 * tr - 0.05 * flinch)
    p.crouch(0.06 + 0.03 * flinch)
    p.spine((-8 - 4 * flinch, 10 * look, 1.5 * tr)).chest((0, 14 * look, 0))
    p.spine(loc=(0.006 * tr, 0, 0))
    p.leg(1, 0, -4).leg(-1, 0, -4)
    return p


@clip("think", 3.0, tags=["emote"])
def _(t):
    p = breathe(P(), t, 3.0, 0.6)
    tap = loop_pulse(t, 0.75, 0.0, 0.12, 2.5)
    p.arm(-1, 76, 2, 0, 86 + 4 * tap)                        # hand to the chin
    p.arm(1, 52, 4, 0, 78)                                    # the other arm folded under
    look = wave(t, 3.0)
    p.chest((-8 + 3 * look, 14, 6)).spine((0, 4 * look, 3))
    p.leg(1, 0, 4).leg(-1, 6, 4)
    return p
