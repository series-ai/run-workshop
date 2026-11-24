"""The shared dog clips, authored on one rigged dog and played by all of them.

Used by rig.py (inside Blender). `author(arm, leg_length)` adds one NLA track per clip
to the armature and returns the clip metadata that goes into clips.glb.

How a clip is described: each frame, a clip function poses the body with rotations
(world-aligned axes, relative to the parent bone) and places the feet with targets
measured in leg lengths from where each foot stands at rest. Feet are solved with
two-bone IK, so a body that crouches, bows or squats keeps its paws on the ground.
Every dog's leg joints sit at the same fractions of its leg length, so foot targets
in leg lengths give the same leg angles on every dog. Root motion (bounce, crouch,
jump) is also in leg lengths; engines scale the root track by each dog's leg length.

Axes (Blender, dog facing -Y): X = the dog's left, Y = backward, Z = up.
  R(X, +a): nose down / leg swings back / tail lifts (tail points backward).
  R(Y, +a): rolls the top toward the dog's left.  R(Z, +a): turns the nose to its left.
"""
import math

import bpy
from mathutils import Quaternion, Vector

FPS = 24
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
FRONT = ('upperarm', 'forearm', 'hand')
HIND = ('thigh', 'shin', 'foot')
LEGS = ('LF', 'RF', 'LH', 'RH')


def leg_bones(leg):
    names = FRONT if leg[1] == 'F' else HIND
    return [f'{n}.{leg[0]}' for n in names]


def R(*rots):
    """Rotation from (axis, degrees) pairs, applied in order."""
    q = Quaternion()
    for axis, deg in rots:
        q = Quaternion(axis, math.radians(deg)) @ q
    return q


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(x):
    x = clamp01(x)
    return x * x * (3 - 2 * x)


def ramp(t, a, b):
    """0 before a, 1 after b, smooth in between."""
    return ease((t - a) / (b - a)) if b > a else float(t >= a)


def window(t, a, b, c, d):
    """Rises over a..b, holds, falls over c..d."""
    return ramp(t, a, b) * (1 - ramp(t, c, d))


def bump(t, a, b):
    """A single smooth hump from a to b (sine shaped)."""
    return math.sin(math.pi * clamp01((t - a) / (b - a)))


def pulse(t, at, rise, fall):
    """Snap: rises over `rise` to 1 at `at`, then decays with time constant `fall`."""
    if t < at - rise:
        return 0.0
    if t < at:
        return ease((t - (at - rise)) / rise)
    return math.exp(-(t - at) / fall)


def wave(t, cycles, phase=0.0):
    return math.sin(2 * math.pi * (cycles * t + phase))


def tail_wag(p, t, amount, cycles, lift=0.0, lag=0.12):
    """Wag down the three tail bones, each a little later than the one before, so the
    tail whips instead of swinging like a stick. `lift` raises it from the base."""
    p.brot('tail.1', (X, lift), (Z, 0.5 * amount * wave(t, cycles)))
    p.brot('tail.2', (Z, 0.6 * amount * wave(t, cycles, -lag)))
    p.brot('tail.3', (Z, 0.7 * amount * wave(t, cycles, -2 * lag)))


class Pose:
    """One frame: root motion, local bone rotations, world-aimed bones and foot targets."""

    def __init__(self):
        self.root_t = Vector()     # leg lengths: (side to the dog's left, forward, up)
        self.root_q = Quaternion()
        self.local = {}
        self.world = {}
        self.feet = {leg: (0.0, 0.0, 0.0) for leg in LEGS}  # (left, forward, up) in leg lengths
        self.paws = {}             # leg -> world rotation of the paw (default flat)
        self.scale = {}
        self.bone_local = {}       # rotations in the bone's own frame (tails)
        self.ik_weight = {}        # leg -> 0..1 blend from rot() pose (0) to foot target (1)
        self.feet_in_root = False  # foot targets turn with the root (spins, twirls)

    def root(self, left=0.0, fwd=0.0, up=0.0, *rots):
        self.root_t = Vector((left, fwd, up))
        self.root_q = R(*rots)

    def rot(self, name, *rots):
        self.local[name] = R(*rots) @ self.local.get(name, Quaternion())

    def brot(self, name, *rots):
        """Rotate in the bone's own frame: X lifts/lowers along the bone, Z swings it
        side to side, whichever way the bone points (used for fitted tails)."""
        self.bone_local[name] = R(*rots) @ self.bone_local.get(name, Quaternion())

    def aim(self, name, *rots):
        """Orientation for a bone relative to the dog as a whole (the root), whatever the
        spine and neck do in between."""
        self.world[name] = R(*rots)

    def foot(self, leg, left=0.0, fwd=0.0, up=0.0):
        self.feet[leg] = (left, fwd, up)

    def free(self, leg):
        """Pose this leg with rot() instead of a foot target."""
        self.feet.pop(leg, None)

    def blend(self, leg, w):
        """Mix this leg between its rot() pose (w=0) and its foot target (w=1), so a leg
        can leave the ground and be posed by hand without popping."""
        if w <= 1e-4:
            self.free(leg)
        else:
            self.ik_weight[leg] = min(1.0, w)

    def pivot(self, point, q, extra=(0.0, 0.0, 0.0)):
        """Rotate the whole dog by q about a point (left, fwd, up in leg lengths), e.g. the
        hind feet for a twirl or the ground beside the body for falling onto its side."""
        pv = Vector((point[0], -point[1], point[2]))   # to (x, y back, z)
        t = pv - q @ pv
        self.root_t = Vector((t.x + extra[0], -t.y + extra[1], t.z + extra[2]))
        self.root_q = q


class Rig:
    def __init__(self, arm, leg_length):
        self.arm, self.L = arm, leg_length
        bones = arm.data.bones
        self.rest_q = {b.name: b.matrix_local.to_quaternion() for b in bones}
        self.head = {b.name: b.head_local.copy() for b in bones}
        self.parent = {b.name: b.parent.name if b.parent else None for b in bones}
        self.order = []
        stack = [b for b in bones if not b.parent]
        while stack:
            b = stack.pop(0)
            self.order.append(b.name)
            stack.extend(b.children)
        ub, lb, pb = leg_bones('LF')
        self.a = (self.head[lb] - self.head[ub]).length   # upper leg length
        self.b = (self.head[pb] - self.head[lb]).length   # lower leg length
        self.ankle = {leg: self.head[leg_bones(leg)[2]].copy() for leg in LEGS}

    def solve(self, pose):
        """World deltas and local rotations for every bone, IK for the planted feet."""
        L = self.L
        D, pos, local = {}, {}, {}
        root_world = Vector((pose.root_t.x * L, -pose.root_t.y * L, pose.root_t.z * L))
        leg_of = {leg_bones(leg)[0]: leg for leg in pose.feet}
        skip = set()
        for name in self.order:
            if name in skip:
                continue
            par = self.parent[name]
            if par is None:
                D[name] = pose.root_q.copy()
                pos[name] = self.head[name] + root_world
                local[name] = pose.root_q.copy()
                continue
            pos[name] = pos[par] + D[par] @ (self.head[name] - self.head[par])
            if name in leg_of:
                leg = leg_of[name]
                self._ik(leg, pose, D, pos, local)
                w = pose.ik_weight.get(leg, 1.0)
                if w < 1.0:  # blend with the hand-posed leg, then redo the chain
                    ub, lb, pb = leg_bones(leg)
                    for b in (ub, lb, pb):
                        local[b] = pose.local.get(b, Quaternion()).slerp(local[b], w)
                    D[ub] = D[par] @ local[ub]
                    D[lb] = D[ub] @ local[lb]
                    D[pb] = D[lb] @ local[pb]
                skip.update(leg_bones(leg)[1:])
                continue
            if name in pose.bone_local:
                r = self.rest_q[name]
                local[name] = r @ pose.bone_local[name] @ r.inverted()
                D[name] = D[par] @ local[name]
            elif name in pose.world:
                D[name] = pose.root_q @ pose.world[name]   # aimed relative to the body, so spins and rolls carry it
                local[name] = D[par].inverted() @ D[name]
            else:
                local[name] = pose.local.get(name, Quaternion())
                D[name] = D[par] @ local[name]
        return local

    def _ik(self, leg, pose, D, pos, local):
        L, a, b = self.L, self.a, self.b
        upper, lower, paw = leg_bones(leg)
        par = self.parent[upper]
        left, fwd, up = pose.feet[leg]
        offset = Vector((left * L, -fwd * L, up * L))
        # Feet turning with the root: solve in the root's turned frame.
        Q = pose.root_q if pose.feet_in_root else Quaternion()
        root_pos = self.head['root'] + Vector((pose.root_t.x, -pose.root_t.y, pose.root_t.z)) * L
        target = root_pos + Q @ (self.ankle[leg] - self.head['root'] + offset) if pose.feet_in_root \
            else self.ankle[leg] + offset
        top = pos[upper]
        rel = Q.inverted() @ (target - top)
        vy, vz = rel.y, rel.z
        d = max(abs(a - b) + 1e-4, min(a + b - 1e-4, math.hypot(vy, vz)))
        phi = math.atan2(-vy, -vz)                     # direction to the foot, forward of straight down
        alpha = math.acos(max(-1, min(1, (a * a + d * d - b * b) / (2 * a * d))))
        beta = math.acos(max(-1, min(1, (a * a + b * b - d * d) / (2 * a * b))))
        k = -1 if leg[1] == 'F' else 1                 # elbows point back, stifles forward
        up_ang = phi + k * alpha
        lo_ang = up_ang - k * (math.pi - beta)
        Du = Q @ Quaternion(X, -up_ang)
        Dl = Q @ Quaternion(X, -lo_ang)
        Dp = Q @ pose.paws.get(leg, Quaternion())
        local[upper] = D[par].inverted() @ Du
        local[lower] = Du.inverted() @ Dl
        local[paw] = Dl.inverted() @ Dp
        D[upper], D[lower], D[paw] = Du, Dl, Dp
        pos[lower] = top + Du @ (self.head[lower] - self.head[upper])
        pos[paw] = pos[lower] + Dl @ (self.head[paw] - self.head[lower])


def make_clip(rig, name, seconds, fn, loop=True):
    arm = rig.arm
    frames = max(1, round(seconds * FPS))
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = act
    pbones = arm.pose.bones
    root_inv = rig.rest_q['root'].inverted()
    for f in range(frames + 1):
        t = f / frames
        pose = Pose()
        fn(pose, t)
        local = rig.solve(pose)
        for pb in pbones:
            pb.rotation_mode = 'QUATERNION'
            r = rig.rest_q[pb.name]
            pb.rotation_quaternion = r.inverted() @ local.get(pb.name, Quaternion()) @ r
            pb.keyframe_insert('rotation_quaternion', frame=f)
            s = pose.scale.get(pb.name, (1.0, 1.0, 1.0))
            pb.scale = s
            pb.keyframe_insert('scale', frame=f)
        root_world = Vector((pose.root_t.x, -pose.root_t.y, pose.root_t.z)) * rig.L
        pbones['root'].location = root_inv @ root_world
        pbones['root'].keyframe_insert('location', frame=f)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    arm.animation_data.action = None
    return frames / FPS


# ---------------------------------------------------------------- gaits
def airborne_windows(phases, duty, n=400):
    """(start, length) of each stretch of the cycle with no foot on the ground."""
    air = [all((u / n - ph) % 1.0 >= duty for ph in phases.values()) for u in range(n)]
    if all(air) or not any(air):
        return []
    k0 = air.index(False)  # walk the cycle starting on a planted sample
    wins, run = [], None
    for i in range(n):
        j = (k0 + i) % n
        if air[j] and run is None:
            run = j
        elif not air[j] and run is not None:
            wins.append((run / n, ((j - run) % n) / n))
            run = None
    if run is not None:
        wins.append((run / n, ((k0 - run) % n) / n))
    return wins


def gait(cycles, phases, duty, stride, lift, crouch=0.04, bounce=0.03, bounce_per_cycle=2, flight=0.0,
         paw_curl=60, tail=18, extra=None, duties=None, front_lift=1.0):
    """In-place locomotion. Each foot is planted for `duty` of its cycle and slides back
    `stride` leg lengths (so the dog travels stride / duty per cycle), then swings forward
    lifted by `lift`. The body rises by `flight` while all four feet are in the air,
    timed from the footfall pattern, and bobs by `bounce` while supported."""
    wins = airborne_windows(phases, duty)

    def fn(p, t):
        tc = t * cycles
        for leg, ph in phases.items():
            u = (tc - ph) % 1.0
            dl = (duties or {}).get(leg, duty)
            if u < dl:
                s = u / dl
                p.foot(leg, fwd=stride * (0.5 - s))
            else:
                s = (u - dl) / (1 - dl)
                fl = front_lift if leg[1] == 'F' else 1.0   # front legs fold against the chest: keep it softer
                p.foot(leg, fwd=stride * (-0.5 + ease(s)), up=lift * fl * math.sin(math.pi * s))
                p.paws[leg] = R((X, paw_curl * fl * math.sin(math.pi * s) * (1 if leg[1] == 'F' else 0.5)))
        up = -crouch + bounce * 0.5 * (1 - math.cos(2 * math.pi * bounce_per_cycle * tc))
        for a, n in wins:
            k = ((tc % 1.0) - a) % 1.0
            if k < n:
                up += flight * math.sin(math.pi * k / n)
        p.root(0, 0, up)
        tail_wag(p, tc, tail, 1)
        if extra:
            extra(p, t, tc)
    return fn


def head_bob(amount, per_cycle=2):
    def extra(p, t, tc):
        p.rot('neck', (X, amount * wave(tc, per_cycle)))
        p.rot('head', (X, -amount * 0.6 * wave(tc, per_cycle)))
    return extra


def run_rock(p, t, tc):
    """Rocking-horse canter: chest rises then dips. The head reaches forward and low and
    bobs into the wind, lagging a little behind the body."""
    p.rot('hips', (X, 6 * wave(tc, 1)))
    p.rot('neck', (X, 22 + 9 * wave(tc, 1, -0.12)))
    p.rot('head', (X, -14 - 5 * wave(tc, 1, -0.2)), (Y, 3 * wave(tc, 1)))


def gallop_flex(p, t, tc):
    """Spine gathers (arches) when the hind feet land and stretches out in flight. The
    head stretches forward, nose into the wind, bobbing with the stride."""
    flex = wave(tc, 1, 0.15)
    p.rot('spine', (X, -10 * flex))
    p.rot('chest', (X, 8 * flex))
    p.rot('neck', (X, 30 + 10 * wave(tc, 1, 0.2)))
    p.rot('head', (X, -20 - 6 * wave(tc, 1, 0.1)))
    p.brot('tail.1', (X, 10 * flex))


WALK4 = {'LH': 0.0, 'LF': 0.25, 'RH': 0.5, 'RF': 0.75}       # lateral-sequence walk
DIAG = {'LF': 0.0, 'RH': 0.0, 'RF': 0.5, 'LH': 0.5}          # trot
CANTER = {'RH': 0.0, 'LH': 0.18, 'RF': 0.22, 'LF': 0.4}
GALLOP = {'RH': 0.0, 'LH': 0.08, 'LF': 0.36, 'RF': 0.44}

# name: (seconds, cycles, gait kwargs). Strides and timings tuned on the Labrador.
GAITS = {
    # Stiff, quick, even little steps: reads as a wind-up robot dog.
    'robot': (0.36, 1, dict(phases=WALK4, duty=0.55, stride=0.28, lift=0.2, crouch=0.03, bounce=0.035,
                            bounce_per_cycle=4, paw_curl=70, extra=head_bob(4, 4))),
    'walk': (0.9, 1, dict(phases=WALK4, duty=0.62, stride=0.62, lift=0.16, crouch=0.07, bounce=0.06,
                          extra=head_bob(4))),
    # The bouncy, animated little trot (the "tippy-tap").
    'trot': (0.46, 1, dict(phases=DIAG, duty=0.42, stride=0.75, lift=0.3, crouch=0.08, bounce=0.05,
                           flight=0.1, paw_curl=75, tail=24, extra=head_bob(5))),
    # Canter: long strides, modest airtime, head forward into the wind.
    'run': (0.42, 1, dict(phases=CANTER, duty=0.34, stride=1.0, lift=0.32, crouch=0.13, bounce=0.0,
                          bounce_per_cycle=1, flight=0.11, front_lift=0.8, extra=run_rock)),
    'gallop': (0.34, 1, dict(phases=GALLOP, duty=0.24, stride=1.45, lift=0.4, crouch=0.16, bounce=0.0,
                             bounce_per_cycle=1, flight=0.18, paw_curl=85, front_lift=0.75, extra=gallop_flex)),
}


# ---------------------------------------------------------------- actions
def idle(p, t):
    s = wave(t, 1)
    p.rot('chest', (X, -1.5 * s))
    p.rot('head', (Y, 6 * s), (X, -3 * s))
    tail_wag(p, t, 15 * (0.4 + 0.6 * settle_env(t, 0.2)), 2, lag=0.0)


def wag(p, t, speed=4, amount=25, lift=15):
    tail_wag(p, t, amount, speed, lift)


def play_bow(p, t):
    """Drop into a bow, wiggle the bum, pop back up. 2.4 s."""
    down = window(t, 0.03, 0.18, 0.72, 0.86)
    p.rot('hips', (X, 22 * down), (Y, 2.5 * down * wave(t, 5)))
    p.root(0.012 * down * wave(t, 5), 0, -0.04 * down + 0.05 * bump(t, 0.86, 0.98))
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.42 * down)
    p.aim('head', (X, -12 * down), (Y, 10 * down * wave(t, 1.2)))
    p.rot('neck', (X, -25 * down))
    wag(p, t, speed=9, amount=40 * down + 10, lift=15 * down)


def catch(p, t):
    """Look up, load the back legs, spring up with the front legs reaching forward and
    down, snap the ball, land. 1.2 s; catch at 0.42."""
    T = t * 1.2
    look = ramp(T, 0.0, 0.12) * (1 - 0.85 * ramp(T, 0.66, 0.95))
    load = window(T, 0.08, 0.26, 0.28, 0.33)            # bum down, ready to spring
    up = T - 0.3                                       # quick ballistic hop, 0.3 to 0.62 s
    hop = max(0.0, 4 * up / 0.32 * (1 - up / 0.32)) if 0 < up < 0.32 else 0.0
    land = pulse(T, 0.64, 0.03, 0.07)                  # squash on landing
    p.root(0, 0.06 * hop, -0.16 * load + 0.62 * hop - 0.12 * land)
    p.rot('hips', (X, -12 * load + 6 * land))
    reach = ramp(T, 0.3, 0.38) * (1 - ramp(T, 0.54, 0.62))
    for leg in ('LF', 'RF'):                           # front legs point forward and down
        p.foot(leg, fwd=0.32 * reach, up=0.62 * hop - 0.04 * reach)
        p.paws[leg] = R((X, 25 * reach))
    for leg in ('LH', 'RH'):                           # back legs trail
        p.foot(leg, fwd=-0.18 * reach, up=0.62 * hop + 0.1 * reach)
        p.paws[leg] = R((X, -30 * reach))
    p.rot('neck', (X, -28 * look))
    p.rot('head', (X, -18 * look + 8 * land))
    p.rot('jaw', (X, 34 * window(T, 0.36, 0.42, 0.47, 0.49)))
    wag(p, t, speed=5, amount=30 * ramp(T, 0.5, 0.65), lift=20)


def drop_ball(p, t):
    """Lower the head and let the ball go, then look up wagging. 1.8 s; release at 0.45."""
    nod = window(t, 0.05, 0.4, 0.55, 0.85)
    p.rot('neck', (X, 32 * nod))
    p.rot('head', (X, 18 * nod))
    p.rot('chest', (X, 6 * nod))
    p.rot('jaw', (X, 26 * window(t, 0.4, 0.46, 0.55, 0.65)))
    p.rot('head', (Y, 8 * bump(t, 0.75, 1.0)))
    wag(p, t, speed=5, amount=30 * ramp(t, 0.5, 0.7) + 8, lift=20)


def stretch(p, t):
    """Downward dog: front legs walk out, then a long slow sink into the stretch (chest
    down, bum up), held with a quiver and a yawn, then a brisk stand back up as the front
    legs walk in. 4.6 s."""
    T = t * 4.6
    reach = ease(clamp01((T - 0.1) / 1.7))              # slow sink into the stretch
    full = window(T, 1.6, 2.2, 3.1, 3.4)               # pushing all the way out
    reach = reach * (1 - ease(clamp01((T - 3.35) / 0.45)))   # stands up briskly, done
    quiver = math.sin(T * 50) * full * 1.2
    p.rot('hips', (X, 24 * reach + 6 * full))
    p.rot('chest', (X, quiver), (Y, 0.6 * quiver))
    p.root(0, -0.05 * full, -0.05 * reach - 0.03 * full)
    for leg, d in (('LF', 0.0), ('RF', 0.15)):         # walk out, then back in
        out = ease(clamp01((T - 2 * d) / 0.7)) * (1 - ease(clamp01((T - 3.35 - d) / 0.4)))
        p.foot(leg, fwd=0.75 * out + 0.12 * full,
               up=0.12 * (bump(T, 2 * d, 2 * d + 0.7) + bump(T, 3.35 + d, 3.75 + d)))
    p.aim('head', (X, -18 * reach - 8 * full))
    p.rot('neck', (X, -20 * reach))
    p.rot('jaw', (X, 40 * window(T, 2.0, 2.4, 2.8, 3.2)))   # yawn at full stretch
    tail_wag(p, t, 8, 3, lift=20 * reach)


def bark(p, t):
    """One bark from a wide, planted front stance: the head draws back as the chest
    fills, then a short burst that snaps in fast and eases out slow (belly in, chest
    drops into bent elbows, mouth pops open), with only a little forward travel.
    0.7 s; bark at 0.18."""
    T = t * 0.7
    back = window(T, 0.0, 0.14, 0.16, 0.32)            # draw back, released into the bark
    snap = pulse(T, 0.18, 0.015, 0.11)                 # fast in, slow out
    for leg, side in (('LF', 1), ('RF', -1)):          # front feet planted wide
        p.foot(leg, left=0.14 * side, fwd=0.04)
    p.rot('spine', (X, 6 * snap))                      # belly snaps in
    p.rot('chest', (X, -5 * back + 9 * snap))
    p.rot('neck', (X, -12 * back + 5 * snap))          # head back, then only a little forward
    p.rot('head', (X, -6 * back - 8 * snap))
    p.rot('jaw', (X, 38 * window(T, 0.16, 0.175, 0.22, 0.32)))
    p.root(0, -0.03 * back + 0.02 * snap, -0.03 + 0.015 * back - 0.05 * snap)
    tail_wag(p, t, 8, 2, lift=30)


def bark_rapid(p, t):
    """Incessant barking: oof-oof-oof-oof, one every 0.22 s from a planted stance, the
    head bobbing with each one, never quite settling. Loops (0.88 s, four barks)."""
    T = t * 0.88
    for leg, side in (('LF', 1), ('RF', -1)):
        p.foot(leg, left=0.13 * side, fwd=0.04)
    snap = sum(pulse(T, 0.05 + 0.22 * i, 0.012, 0.09) for i in range(4))
    snap += pulse(T, 0.05 + 0.88, 0.012, 0.09)        # the next loop's first bark, for a clean wrap
    p.rot('spine', (X, 4 * snap))
    p.rot('chest', (X, -3 + 6 * snap))
    p.rot('neck', (X, -8 + 5 * snap))
    p.rot('head', (X, -4 - 7 * snap))
    p.rot('jaw', (X, 34 * clamp01(snap * 1.3)))
    p.root(0, 0.01 * snap, -0.04 - 0.035 * snap)
    tail_wag(p, t, 10, 4, lift=30)


def sniff(p, t):
    """Intent sniffing: nose to the ground (the engine lowers the neck until it touches),
    slow searching sweep, little sniff pulses, shuffling forward. 3.0 s, loops."""
    T = t * 3.0
    sweep = math.sin(2 * math.pi * t) * 0.8 + math.sin(4 * math.pi * t + 1) * 0.2
    p.rot('chest', (X, 16))
    shuffle = (bump(T, 0.9, 1.15), bump(T, 1.05, 1.3))
    for leg, k in (('LF', shuffle[0]), ('RF', shuffle[1])):
        p.foot(leg, fwd=0.1 + 0.06 * ramp(T, 0.9, 1.3) * (1 - ramp(T, 2.6, 3.0)), up=0.1 * k)
    bursts = [0.25, 0.4, 0.55, 1.5, 1.65, 1.8, 2.3, 2.45]
    sniffs = sum(pulse(T, a, 0.04, 0.07) for a in bursts)
    p.rot('neck', (X, 55), (Z, 18 * sweep))
    p.rot('head', (X, 16 + 2.5 * sniffs), (Z, 8 * sweep))
    p.root(0, 0.04 + 0.006 * sniffs, -0.1)
    tail_wag(p, t, 10, 6, lift=25)


def point(p, t):
    """Pointer: freeze with a front leg raised, elbow forward and paw hanging curled, nose
    and tail in one line (the engine straightens the tail, whatever its natural shape).
    3.0 s."""
    T = t * 3.0
    on = window(T, 0.0, 0.35, 2.6, 3.0)
    tense = math.sin(T * 30) * window(T, 0.5, 0.7, 2.4, 2.6) * 0.5
    p.root(0, 0.06 * on, -0.02 * on)
    p.rot('chest', (X, 4 * on))
    p.free('LF')
    ua, fa, hd = leg_bones('LF')
    p.rot(ua, (X, -55 * on))                           # upper leg swings forward, elbow toward the nose
    p.rot(fa, (X, 70 * on))                            # forearm hangs down
    p.rot(hd, (X, 75 * on))                            # paw curled under
    p.aim('neck', (X, 28 * on))
    p.aim('head', (X, 2 * on + tense))


def pee_male(p, t):
    """Lift the left back leg, bent and up. 5.0 s; pee from 1.7 to 3.7."""
    T = t * 5.0
    shift = window(T, 0.0, 0.6, 4.3, 4.9)
    lift = window(T, 0.7, 1.4, 3.8, 4.4)
    p.root(-0.1 * shift, 0, -0.03 * shift)
    p.rot('hips', (Y, -16 * lift))                     # left hip tips up with the leg
    p.free('LH')
    th, sh, ft = leg_bones('LH')
    p.rot(th, (X, -40 * lift), (Y, -70 * lift))        # thigh forward and up/out
    p.rot(sh, (X, 75 * lift))                          # knee bent
    p.rot(ft, (X, -35 * lift))                         # paw relaxed
    p.foot('RH', left=-0.08 * shift)
    tail_wag(p, t, 0, 1, lift=20 * lift)
    p.aim('head', (Z, 25 * window(T, 2.0, 2.5, 3.2, 3.7)))


def pee_female(p, t):
    """Long, deep squat. 4.8 s; pee from 1.2 to 3.6."""
    T = t * 4.8
    sq = window(T, 0.1, 0.9, 3.8, 4.6)
    p.root(0, 0, -0.36 * sq)
    p.rot('hips', (X, -10 * sq))                       # mostly a drop: tipping the hips swings the bum into the floor
    for leg in ('LH', 'RH'):
        p.foot(leg, fwd=0.3 * sq)
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=-0.06 * sq)
    tail_wag(p, t, 0, 1, lift=50 * sq)                 # tail lifts up out of the way
    p.brot('tail.2', (X, -15 * sq))
    p.aim('head', (X, -5 * sq), (Z, 15 * sq * wave(T / 4.8, 0.5)))


def poop(p, t):
    """Hunch and strain (the quiver builds), plop, a little relief, stand. 6.4 s; plop at 4.4."""
    T = t * 6.4
    h = window(T, 0.2, 1.1, 5.0, 5.8)
    strain = sum(window(T, a, a + 0.25, a + 0.6, a + 0.8) for a in (1.4, 2.4, 3.4))
    build = ramp(T, 1.3, 4.3) * (1 - ramp(T, 4.35, 4.45))
    tremble = math.sin(T * 45) * (0.6 + 1.6 * build) * (strain + 0.4 * build)
    relief = pulse(T, 4.5, 0.05, 0.25)
    p.root(0, 0, -0.28 * h - 0.04 * strain + 0.05 * relief)
    p.rot('hips', (X, -18 * h - 3 * strain), (Y, 2 * tremble))   # rounded back from the spine, not the hips
    p.rot('spine', (X, 20 * h + 3 * strain))
    p.rot('chest', (X, 14 * h), (Y, -tremble))
    for leg in ('LH', 'RH'):
        p.foot(leg, fwd=0.45 * h)
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=-0.1 * h)
    tail_wag(p, t, 0, 1, lift=75 * h)                  # tail up and tucked over
    p.brot('tail.2', (X, -25 * h))
    p.aim('head', (X, -4 * h - 6 * relief), (Z, 20 * window(T, 1.5, 2.0, 3.6, 4.2)))


# ---------------------------------------------------------------- poses and tricks
# Measured on the authoring dog in author(): where the hind feet are and how wide the
# body is, in leg lengths (for pivots: twirling on the hind feet, falling onto a side).
DIM = {'hind_fwd': -0.8, 'front_fwd': 0.6, 'half_w': 0.5, 'back_up': 0.65}


# Tail carriage (lift, degrees) in each state. Every pose clip starts and ends with the
# tail exactly here and centred, so clips chain without a tail pop.
# Upright poses tip the hips back, which swings the tail down: lift it to compensate so
# it lies along the floor instead of going through it.
TAIL_LIFT = {'stand': 0, 'sit': 15, 'down': -10, 'comfy': -10, 'sploot': -5, 'beg': 60,
             'dance': 50, 'dead': -10}


def settle_env(t, edge=0.12):
    return ramp(t, 0.0, edge) * (1 - ramp(t, 1 - edge, 1.0))


def pose_tail(p, t, a, b, amount, cycles, k=None):
    """Wag that is still and centred at both ends of the clip, carried from state a's tail
    lift to state b's (k: blend, defaults to eased t)."""
    k = ease(t) if k is None else k
    lift = TAIL_LIFT[a] + (TAIL_LIFT[b] - TAIL_LIFT[a]) * k
    tail_wag(p, t, amount * settle_env(t), cycles, lift=lift)


def breathe(p, t, amount=1.5, cycles=1):
    p.rot('chest', (X, -amount * wave(t, cycles)))


def sit_pose(p, k):
    """Sitting: the rear drops and the body tips up about the shoulders, so the front
    legs stay straight and planted; the back legs fold under."""
    p.root(0, 0, -0.58 * k)
    p.rot('hips', (X, -27 * k))
    p.rot('chest', (X, 6 * k))
    for leg in ('LH', 'RH'):
        p.foot(leg, fwd=0.25 * k)
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.04 * k)
    p.rot('neck', (X, 8 * k))


# How far the body drops to lie down, in leg lengths. Dogs' bellies hang from 0.3 (Pug) to
# 0.7 (Samoyed) leg lengths below the spine; this is the middle, and dogclips.js nudges
# each dog toward its own belly line (lie clips, meta 'lie').
LIE = 0.45
LIE_CLIPS = ('down_', 'comfy_', 'sploot_', 'roll_over')


def down_pose(p, k):
    """Lying down like a sphinx: belly on the floor, forearms flat out in front, back legs
    folded alongside."""
    p.root(0, 0, -LIE * k)
    p.rot('hips', (X, -3 * k))
    p.rot('chest', (X, 4 * k))
    for leg, side in (('LF', 1), ('RF', -1)):
        p.foot(leg, fwd=0.5 * k, left=0.02 * side * k)
    for leg, side in (('LH', 1), ('RH', -1)):
        p.foot(leg, fwd=0.3 * k, left=0.1 * side * k)
    p.aim('head', (X, -6 * k))


def comfy_pose(p, k):
    """From down: rolled onto the right hip, the top back leg kicked out to the side,
    front legs stretched out unevenly, head resting a little to the side."""
    down_pose(p, 1)
    p.root(-0.08 * k, 0, -LIE + 0.1 * k)             # rolled: the lower flank needs room
    p.rot('hips', (Y, -28 * k))                       # onto the right hip: left side comes up
    p.rot('chest', (Y, -8 * k))
    p.blend('LH', 1 - k)
    th, sh, ft = leg_bones('LH')
    p.rot(th, (Y, -32 * k), (X, -25 * k))            # top leg out to the side and forward, resting on the floor
    p.rot(sh, (X, 30 * k))
    p.rot(ft, (X, -30 * k))
    p.foot('LF', fwd=0.5 + 0.18 * k, left=0.02)
    p.aim('head', (X, -6 + 4 * k), (Z, 14 * k), (Y, -10 * k))


def sploot_pose(p, k):
    """Belly flat on the floor with both back legs straight out behind, pads up. Staged:
    lie down first, then slide the back legs out (reversed on the way out)."""
    lie = clamp01(k / 0.6) ** 0.7 if k > 0 else 0.0
    out = ease(clamp01((k - 0.45) / 0.55))
    p.root(0, -0.05 * out, -LIE * lie + 0.02 * out)
    p.rot('hips', (X, 2 * out))
    for leg, side in (('LH', 1), ('RH', -1)):
        # Folded alongside (like down), then the foot slides back along the floor until
        # the leg lies straight out behind; the paw rolls over so the pads face up.
        p.foot(leg, fwd=0.3 * lie * (1 - out) - 1.0 * out, left=0.1 * side * lie * (1 - out),
               up=0.3 * out)
        p.paws[leg] = R((X, -178 * out))                 # paw flat behind, in line with the leg, pads up
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.5 * lie)
    p.aim('head', (X, -4 * lie))


def beg_pose(p, k):
    """Sit pretty: from sitting, the body comes up nearly upright on the haunches with
    the front paws tucked up against the chest."""
    sit_pose(p, 1)
    p.rot('hips', (X, -42 * k))
    p.rot('chest', (X, -4 * k))
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.04 - 0.02 * k, up=0.8 * k)
        p.paws[leg] = R((X, 95 * k))
    p.rot('neck', (X, 30 * k))


def stand_up_pose(p, k):
    """Up on the hind legs, front paws tucked, for dancing."""
    p.rot('hips', (X, -72 * k))
    p.rot('chest', (X, -4 * k))
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.1 * k, up=1.25 * k)
        p.paws[leg] = R((X, 95 * k))
    p.rot('neck', (X, 45 * k))
    p.aim('head', (X, -6 * k))


def dead_pose(p, f, legs):
    """Lying flat on the right side. f: how far over (0..1); legs: how far the legs have
    gone limp (0..1): the underneath legs rest on the floor with soft bends, the top legs
    flop down across the body under their own weight instead of sticking out stiff."""
    p.pivot((-DIM['half_w'], 0, 0), R((Y, -86 * f)), extra=(0, 0, 0.06 * f))   # onto the right side
    flop = legs * f
    for leg in LEGS:
        p.blend(leg, 1 - legs)
        ub, lb, pb = leg_bones(leg)
        front = leg[1] == 'F'
        top = leg[0] == 'L'
        if top:   # falls toward the floor (the body's right), folded a little at elbow / knee
            p.rot(ub, (Y, DROOP * flop), (X, (-18 if front else 14) * legs))
            p.rot(lb, (X, (28 if front else -22) * legs))
        else:     # resting on the floor, slightly bent
            p.rot(ub, (Y, 6 * legs), (X, (-10 if front else 10) * legs))
            p.rot(lb, (X, (18 if front else -14) * legs))
        p.rot(pb, (X, 25 * legs))
    p.rot('neck', (Y, -6 * f))                         # head rests on the floor, not through it
    p.rot('head', (Y, -4 * f))


DROOP = 38   # degrees the top legs fall toward the floor


def snap(t):
    """Quick pose change: most of the move in the first 70% (fast start, eased stop), then
    a small settle (about 5% past the pose and back). 0 at t=0, exactly 1 at t=1."""
    x = clamp01(t / 0.7)
    return 1 - (1 - x) ** 3 + 0.05 * math.sin(math.pi * clamp01((t - 0.45) / 0.55))


def enter_exit(pose_fn, a, b, curve=None):
    """Enter (a -> b) and exit (b -> a) clips from one pose function."""
    curve = curve or snap

    def enter(p, t):
        pose_fn(p, curve(t))
        pose_tail(p, t, a, b, 12, 1)

    def leave(p, t):
        pose_fn(p, 1 - curve(t))
        pose_tail(p, t, b, a, 12, 1)
    return enter, leave


def sit_loop(p, t):
    sit_pose(p, 1)
    breathe(p, t)
    p.rot('head', (Y, 7 * bump(t, 0.45, 0.85)))      # a little head tilt
    pose_tail(p, t, 'sit', 'sit', 30, 2)              # tail sweeping the floor


def down_loop(p, t):
    down_pose(p, 1)
    breathe(p, t, 2)
    p.rot('head', (Z, 10 * wave(t, 1)))
    pose_tail(p, t, 'down', 'down', 18, 1)


def comfy_loop(p, t):
    comfy_pose(p, 1)
    breathe(p, t, 2.5)
    pose_tail(p, t, 'comfy', 'comfy', 8, 1)


def sploot_loop(p, t):
    sploot_pose(p, 1)
    breathe(p, t, 2)
    p.rot('head', (Z, 8 * wave(t, 1)))
    pose_tail(p, t, 'sploot', 'sploot', 20, 2)


def beg_loop(p, t):
    beg_pose(p, 1)
    p.rot('hips', (Y, 4 * wave(t, 1)), (X, 3 * wave(t, 2)))   # wobbling for balance
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.02, up=0.8 + 0.06 * wave(t, 2))    # little paw paddle
    pose_tail(p, t, 'beg', 'beg', 30, 3)


def dance_loop(p, t):
    """Up on the hind legs, twirling once around on little steps."""
    stand_up_pose(p, 1)
    p.feet_in_root = True
    p.pivot((0, DIM['hind_fwd'], 0), R((Z, 360 * t)))
    for leg, ph in (('LH', 0.0), ('RH', 0.5)):
        p.foot(leg, up=0.1 * max(0.0, math.sin(2 * math.pi * (4 * t + ph))))
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=0.1, up=1.25 + 0.08 * wave(t, 4))
    p.rot('neck', (Z, 10 * wave(t, 2)))
    pose_tail(p, t, 'dance', 'dance', 40, 4)


def play_dead_enter(p, t):
    """"Bang!": rear back in shock (up on the toes, front end lifting), a wobble, then
    topple and SLAM onto the side: overshoot and bounce, legs and head flopping after the
    body lands, tongue out. 1.4 s."""
    T = t * 1.4
    shock = window(T, 0.0, 0.12, 0.3, 0.45)            # rearing back
    wob = math.sin(T * 22) * window(T, 0.3, 0.38, 0.5, 0.6)
    fall = clamp01((T - 0.5) / 0.28)
    f = fall ** 2.2                                     # accelerating fall
    impact = T - 0.78
    bounce = 0.12 * math.exp(-impact * 9) * math.sin(impact * 28) if impact > 0 else 0.0
    f = f + bounce
    legs = ramp(T, 0.55, 0.8)
    flop = 0.35 * math.exp(-max(impact - 0.05, 0) * 7) * math.sin(max(impact - 0.05, 0) * 24) if impact > 0.05 else 0.0
    # rear back onto the haunches, front end up off the floor, head thrown back
    p.root(0, -0.14 * shock, 0.02 * shock)
    p.rot('hips', (X, -14 * shock), (Y, 8 * wob))
    p.rot('chest', (X, -16 * shock))
    for leg in ('LF', 'RF'):
        p.foot(leg, up=0.35 * shock * (1 - f), fwd=0.1 * shock * (1 - f))
    for leg in ('LH', 'RH'):
        p.foot(leg, fwd=0.1 * shock * (1 - f))
    dead_pose(p, f, legs * (1 + flop))
    p.rot('neck', (X, -28 * shock), (Y, -10 * flop))
    p.rot('head', (X, -14 * shock), (Y, -8 * flop))
    p.rot('jaw', (X, 25 * shock + 14 * ramp(T, 0.9, 1.1)))
    pose_tail(p, t, 'stand', 'dead', 0, 1, k=legs)
    if impact > 0:
        tail_wag(p, t, 0, 1, lift=-25 * math.exp(-impact * 6) * math.cos(impact * 20))


def play_dead_loop(p, t):
    dead_pose(p, 1, 1)
    breathe(p, t, 2)
    p.rot('jaw', (X, 12))
    pose_tail(p, t, 'dead', 'dead', 18 * bump(t, 0.6, 0.75), 2)    # the odd tail twitch


def play_dead_exit(p, t):
    T = t * 1.4
    f = 1 - ease(clamp01(T / 0.6))
    legs = 1 - ramp(T, 0.3, 0.7)
    dead_pose(p, f, legs)
    p.rot('jaw', (X, 12 * (1 - ramp(T, 0.0, 0.3))))
    p.rot('neck', (Z, 25 * math.sin(T * 30) * window(T, 0.8, 0.9, 1.15, 1.3)))  # shake it off
    pose_tail(p, t, 'dead', 'stand', 30, 3, k=ramp(T, 0.3, 0.9))


def front_paw(p, side, up_ang, fore, paw, w):
    """Lift a front leg into a hand-posed position, blended by w."""
    leg = 'RF' if side < 0 else 'LF'
    p.blend(leg, 1 - w)
    ub, lb, pb = leg_bones(leg)
    p.rot(ub, (Y, 12 * w * (1 if side < 0 else -1)), (X, -up_ang * w))   # slightly out to the side
    p.rot(lb, (X, fore * w))
    p.rot(pb, (X, paw * w))
    p.root(p.root_t.x + 0.03 * side * -w, p.root_t.y, p.root_t.z)


def paw(p, t):
    """Give paw from sitting: right paw up and forward, a little shake, back down. 1.6 s."""
    T = t * 1.6
    sit_pose(p, 1)
    w = window(T, 0.15, 0.4, 1.1, 1.35)
    front_paw(p, -1, 75 + 6 * math.sin(T * 18) * window(T, 0.55, 0.65, 0.95, 1.05), 20, 40, w)
    p.rot('head', (Y, -8 * w))
    pose_tail(p, t, 'sit', 'sit', 8, 1)            # a little tail sweep, not a wag


def roll_over(p, t):
    """From lying down: legs tuck, roll right over (quickly through the on-its-back part),
    legs back down. 1.6 s."""
    T = t * 1.6
    down_pose(p, 1)
    tuck = window(T, 0.0, 0.2, 1.2, 1.45)
    u = ease(clamp01((T - 0.2) / 0.95))
    f = u - 0.12 * math.sin(2 * math.pi * u)      # slow on the sides, fast over the back
    th = 2 * math.pi * f
    c2, s2 = math.cos(th) ** 2, math.sin(th) ** 2
    belly, side, back = 1 - LIE, 1.15 * DIM['half_w'], 1.15 * DIM['back_up']   # spine height needed on each
    h = (belly if math.cos(th) >= 0 else back) * c2 + side * s2
    p.pivot((0, 0, 1.0), R((Y, -360 * f)), extra=(0, 0, h - 1.0))   # pivot at the spine (1 leg length up)
    p.rot('neck', (X, 60 * bump(f, 0.1, 0.9) ** 0.6))  # chin tucked to the chest so the head clears the floor
    for leg in LEGS:
        p.blend(leg, 1 - tuck)
        ub, lb, pb = leg_bones(leg)
        front = leg[1] == 'F'
        p.rot(ub, (X, (-50 if front else -55) * tuck))
        p.rot(lb, (X, (95 if front else 100) * tuck))
        p.rot(pb, (X, 40 * tuck))
    pose_tail(p, t, 'down', 'down', 20, 2)


def spin(p, t):
    """A leaping twirl, built on the principles: sink into a deep squat and hold it, head
    down, gathering (anticipation); an explosive stretch up off the floor (squash and
    stretch); a whip round that does most of the turn early and eases into a slight
    overshoot (slow out); legs folded tight in the air; a squash on landing that settles,
    with the head and tail dragging behind the turn and swinging through after it
    (follow-through). 2.1 s."""
    T = t * 2.1
    squat = ease(clamp01(T / 0.45)) * (1 - ease(clamp01((T - 0.85) / 0.08)))   # down, hold, release
    gather = window(T, 0.45, 0.6, 0.75, 0.85) * math.sin(T * 30) * 0.5          # a little wiggle while held
    air = clamp01((T - 0.9) / 0.55)                    # 0.9 .. 1.45 in the air
    up = 4 * air * (1 - air)
    stretch_up = window(T, 0.85, 0.92, 1.0, 1.15)      # long and lean leaving the floor
    land = T - 1.45
    squash = math.exp(-land * 7) * math.cos(land * 12) if land > 0 else 0.0
    x = clamp01(air * 1.1)
    a = 375 * (1 - (1 - x) ** 3) - 15 * ramp(T, 1.45, 1.9)   # whip, overshoot 15, settle back
    p.feet_in_root = True
    p.root(0, 0.04 * squat, -0.3 * squat + 0.6 * up + 0.04 * stretch_up - 0.1 * max(squash, 0), (Z, a))
    tuck = clamp01(up * 1.8)
    planted = 0.3 * squat + 0.1 * max(squash, 0)      # feet ride with the body: keep them on the floor
    for leg in LEGS:
        front = leg[1] == 'F'
        p.foot(leg, up=planted, fwd=-(0.04 if front else -0.03) * squat)
        p.blend(leg, 1 - tuck)                         # in the air: folded by hand, not by foot targets
        ub, lb, pb = leg_bones(leg)
        p.rot(ub, (X, (-45 if front else -50) * tuck))
        p.rot(lb, (X, (85 if front else 90) * tuck))
        p.rot(pb, (X, 30 * tuck))
    p.rot('hips', (X, -16 * squat + 6 * tuck - 6 * stretch_up + 2 * gather))
    p.rot('chest', (X, 12 * squat - 6 * tuck + 6 * stretch_up))
    lag = clamp01((1 - x) * 3) * up                    # head and tail drag behind the turn...
    swing = math.exp(-max(land, 0) * 5) * math.sin(max(land, 0) * 11) if land > 0 else 0.0
    p.rot('neck', (X, 20 * squat - 12 * stretch_up), (Z, -28 * lag + 18 * swing))   # ...and swing through
    p.rot('head', (X, 8 * squat))
    pose_tail(p, t, 'stand', 'stand', 0, 1)
    tail_wag(p, t, 0, 1, lift=-20 * squat + 30 * tuck)
    p.brot('tail.1', (Z, 35 * lag - 22 * swing + 10 * gather))


SIT_IN, SIT_OUT = enter_exit(sit_pose, 'stand', 'sit')
DOWN_IN, DOWN_OUT = enter_exit(down_pose, 'stand', 'down')
COMFY_IN, COMFY_OUT = enter_exit(comfy_pose, 'down', 'comfy', curve=ease)   # a roll, not a drop: stays smooth
SPLOOT_IN, SPLOOT_OUT = enter_exit(sploot_pose, 'stand', 'sploot')
BEG_IN, BEG_OUT = enter_exit(beg_pose, 'sit', 'beg')
DANCE_IN, DANCE_OUT = enter_exit(stand_up_pose, 'stand', 'dance')

# name: (seconds, fn, loop, from state, to state). Loops have from == to.
POSES = {
    'sit_enter': (0.5, SIT_IN, False, 'stand', 'sit'), 'sit_loop': (3.0, sit_loop, True, 'sit', 'sit'),
    'sit_exit': (0.45, SIT_OUT, False, 'sit', 'stand'),
    'down_enter': (0.65, DOWN_IN, False, 'stand', 'down'), 'down_loop': (3.0, down_loop, True, 'down', 'down'),
    'down_exit': (0.55, DOWN_OUT, False, 'down', 'stand'),
    'comfy_enter': (0.9, COMFY_IN, False, 'down', 'comfy'), 'comfy_loop': (3.0, comfy_loop, True, 'comfy', 'comfy'),
    'comfy_exit': (0.8, COMFY_OUT, False, 'comfy', 'down'),
    'sploot_enter': (0.9, SPLOOT_IN, False, 'stand', 'sploot'),
    'sploot_loop': (3.0, sploot_loop, True, 'sploot', 'sploot'),
    'sploot_exit': (0.75, SPLOOT_OUT, False, 'sploot', 'stand'),
    'beg_enter': (0.5, BEG_IN, False, 'sit', 'beg'), 'beg_loop': (2.0, beg_loop, True, 'beg', 'beg'),
    'beg_exit': (0.45, BEG_OUT, False, 'beg', 'sit'),
    'dance_enter': (0.55, DANCE_IN, False, 'stand', 'dance'), 'dance_loop': (2.0, dance_loop, True, 'dance', 'dance'),
    'dance_exit': (0.5, DANCE_OUT, False, 'dance', 'stand'),
    'play_dead_enter': (1.4, play_dead_enter, False, 'stand', 'dead'),
    'play_dead_loop': (2.4, play_dead_loop, True, 'dead', 'dead'),
    'play_dead_exit': (1.4, play_dead_exit, False, 'dead', 'stand'),
    'paw': (1.6, paw, False, 'sit', 'sit'), 'roll_over': (1.6, roll_over, False, 'down', 'down'),
    'spin': (2.1, spin, False, 'stand', 'stand'),
}


# Clips where the engine lowers the neck until the nose touches the ground (dogclips.js),
# since neck and leg lengths vary too much between breeds for one angle to fit all.
NOSE_GROUND = {'sniff'}
# Clips where the engine points the tail straight out behind: (fade in, hold until, fade out) in s.
TAIL_LINE = {'point': (0.0, 0.35, 2.6, 3.0)}

ACTIONS = {
    # name: (seconds, fn, loop, events as fractions of the clip)
    'idle': (2.0, idle, True, {}),
    'play_bow': (2.4, play_bow, True, {}),
    'catch': (1.2, catch, False, {'catch': 0.42 / 1.2}),
    'drop_ball': (1.8, drop_ball, False, {'release': 0.45}),
    'stretch': (4.6, stretch, False, {}),
    'bark': (0.7, bark, True, {'bark': 0.18 / 0.7}),
    'bark_rapid': (0.88, bark_rapid, True, {f'bark{i}': (0.05 + 0.22 * i) / 0.88 for i in range(4)}),
    'sniff': (3.0, sniff, True, {'sniff': 0.1}),
    'point': (3.0, point, False, {}),
    'pee_male': (5.0, pee_male, False, {'pee_start': 1.7 / 5.0, 'pee_end': 3.7 / 5.0}),
    'pee_female': (4.8, pee_female, False, {'pee_start': 1.2 / 4.8, 'pee_end': 3.6 / 4.8}),
    'poop': (6.4, poop, False, {'poop': 4.4 / 6.4}),
}


BACK_UP = 0.0  # set by rig.py: back line above the spine bone


def author(arm, leg_length, only=None):
    """Add every clip (or just `only`) as NLA tracks; return metadata for the engine."""
    rig = Rig(arm, leg_length)
    DIM['hind_fwd'] = -rig.ankle['LH'].y / leg_length
    DIM['front_fwd'] = -rig.ankle['LF'].y / leg_length
    DIM['half_w'] = 1.4 * abs(rig.ankle['LF'].x) / leg_length
    DIM['back_up'] = BACK_UP / leg_length if BACK_UP else 0.65
    meta = {}
    for name, (secs, cycles, kw) in GAITS.items():
        if only and name not in only:
            continue
        dur = make_clip(rig, name, secs, gait(cycles, **kw))
        meta[name] = {'duration': dur, 'loop': True, 'gait': True,
                      'stride': round(cycles * kw['stride'] / kw['duty'], 4), 'events': {}}
    for name, (secs, fn, loop, events) in ACTIONS.items():
        if only and name not in only:
            continue
        dur = make_clip(rig, name, secs, fn)
        meta[name] = {'duration': dur, 'loop': loop, 'gait': False,
                      'events': {k: round(v * dur, 4) for k, v in events.items()},
                      'nose_ground': name in NOSE_GROUND, 'tail_line': TAIL_LINE.get(name)}
    for name, (secs, fn, loop, a, b) in POSES.items():
        if only and name not in only:
            continue
        dur = make_clip(rig, name, secs, fn)
        meta[name] = {'duration': dur, 'loop': loop, 'gait': False, 'events': {}, 'from': a, 'to': b,
                      'full_tilt': True, **({'lie': LIE} if name.startswith(LIE_CLIPS) else {}),
                      **({'clear_floor': True} if name in ('roll_over', 'play_dead_enter') else {})}  # body tips up (sit, beg, dance): long dogs need the full tilt
    if 'idle' in meta:
        meta['idle'].update({'from': 'stand', 'to': 'stand'})
    return meta
