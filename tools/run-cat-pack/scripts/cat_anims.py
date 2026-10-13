"""Cat clips (run inside Blender, called by build_cat.py). Cats have their own
skeleton (build_cat.py) and their own clips; nothing is shared with the dogs.

Poses are {bone: (pitch, side, twist)} in degrees in each bone's local space
(rig.py rolls every bone so local X points to the cat's right). On this rig:
  root     +pitch tips the whole cat nose-up / rump-down
  spine,   +pitch lifts the front end            pelvis  +pitch drops the rump
  chest
  neck     -pitch brings the head down/forward   head    +pitch lifts the nose
  legs     +pitch swings the paw forward
  tail.N   (8 bones) -pitch curls up / forward, +pitch lets it fall; +side to the left
  ear.L/R  +pitch lays the ear back, +side tips it outward, twist swivels it
".*" applies to both sides, mirroring side and twist.

Extra pose keys:
  '_plant'  legs pinned by IK: 'all', 'hind', 'front' or FL / FR / HL / HR.
            A planted paw stays on its footprint on the floor (no sliding, no
            floating); back legs are planted in everything except sits, loafs
            and lying down, where the rump is on the floor.
  '_feet'   {leg: (dx, dz)} moves a planted paw's target (walk cycles, kneading,
            stretches) - body lengths, from its resting footprint
  '_scale'  {bone: s or (sx, sy, sz)}: legs shrink into the body for the loaf
  '_fwd'    root offset forward (pounces), '_air' height above the floor (jumps)
  '_drop'   gaits: body height set directly (below standing), legs follow by IK
  '_tuck'   hind legs folded under a sitting cat by IK: hock flat on the floor,
            heel under the hip, paw forward (the haunch of a real sit)
  '_tf'     tail laid along the floor (tail_floor): it drops to the floor behind
            the rump and curls round the side; lying, sitting and sleeping tails
  '_breath' 0..~0.05: the ribs and belly swell (leaf bones spine_breath /
            chest_breath) - breathing without rocking the body
  '_blink'  0 open .. 1 shut: the lids bone squashes the eyes (viewer / game)
Clips are set on the floor every frame (lowest point of the body touches it)
unless the pose gives '_drop'. Transitions are short and eased hard ("snappy").
"""
import math

import bpy
from mathutils import Euler, Matrix, Vector

FPS = 30
NT = 8                     # tail bones
LEGS = {
    'FL': ('upperarm.L', 'forearm.L', 'wrist.L', 'paw.L'),
    'FR': ('upperarm.R', 'forearm.R', 'wrist.R', 'paw.R'),
    'HL': ('thigh.L', 'shin.L', 'hock.L', 'hind_paw.L'),
    'HR': ('thigh.R', 'shin.R', 'hock.R', 'hind_paw.R'),
}
PLANT_SETS = {'all': ['FL', 'FR', 'HL', 'HR'], 'hind': ['HL', 'HR'], 'front': ['FL', 'FR']}

# --------------------------------------------------------------------------
# Pose helpers


def legs_of(spec):
    out = []
    for s in spec or []:
        out += PLANT_SETS.get(s, [s])
    return sorted(set(out))


def mirror(pose):
    out = {}
    for bone, val in pose.items():
        if bone.startswith('_'):
            out[bone] = val
        elif bone.endswith('.*'):
            p, s, t = val
            out[bone[:-2] + '.L'] = (p, s, t)
            out[bone[:-2] + '.R'] = (p, -s, -t)
        else:
            out[bone] = val
    if '_scale' in out:
        sc = {}
        for bone, v in out['_scale'].items():
            if bone.endswith('.*'):
                sc[bone[:-2] + '.L'] = v
                sc[bone[:-2] + '.R'] = v
            else:
                sc[bone] = v
        out['_scale'] = sc
    return out


def merge(*poses):
    out = {}
    for p in poses:
        for k, v in p.items():
            if k in ('_scale', '_feet'):
                out[k] = {**out.get(k, {}), **v}
            else:
                out[k] = v
    return out


def tail(lift=0.0, curl=0.0, wrap=0.0, tip=0.0):
    """Tail shape over the 8 bones: `lift` bends the root (+ down), `curl`
    bends along the length (- curls up/forward), `wrap` sweeps it round to the
    left (+) or right, `tip` bends just the last few bones."""
    out = {}
    for k in range(NT):
        f = k / (NT - 1)
        out[f'tail.{k}'] = (lift * (1 - f) ** 2 * (2.2 if k == 0 else 1) + curl + tip * max(0.0, f - 0.5) * 2,
                            wrap * (0.5 + f), 0)
    return out


def tail_wave(t, amp=10.0, speed=0.5, start=0, lag=0.55, base=None):
    """A side-to-side wave travelling down the tail (each bone lags the last)."""
    out = dict(base or {})
    for k in range(start, NT):
        p, s, tw = out.get(f'tail.{k}', (0, 0, 0))
        g = (k - start + 1) / (NT - start)
        out[f'tail.{k}'] = (p, s + amp * (0.25 + 0.75 * g) * math.sin(2 * math.pi * speed * t - k * lag), tw)
    return out


def tail_lift_wave(t, amp=8.0, speed=0.5, start=4, base=None):
    """The tip lifting and falling (a thump when lying, a curl when standing)."""
    out = dict(base or {})
    for k in range(start, NT):
        p, s, tw = out.get(f'tail.{k}', (0, 0, 0))
        g = (k - start + 1) / (NT - start)
        out[f'tail.{k}'] = (p - amp * g * max(0.0, math.sin(2 * math.pi * speed * t - (k - start) * 0.5)), s, tw)
    return out


def ears(pitch=0.0, side=0.0, twist=0.0, left=None):
    """Both ears, or a left ear tuple plus (pitch, side, twist) for the right."""
    if left is not None:
        return {'ear.L': left, 'ear.R': (pitch, -side, -twist)}
    return {'ear.*': (pitch, side, twist)}


def ear_flick(t, at, which='L', dur=0.25, amount=35):
    """One quick ear flick (back and outward, then back up) starting at `at`."""
    u = (t - at) / dur
    if u < 0 or u > 1:
        return {}
    k = math.sin(math.pi * u)
    s = 1 if which == 'L' else -1
    return {f'ear.{which}': (amount * k, s * amount * 0.5 * k, s * 20 * k)}


def breathe(pose, t, amp=0.035, period=3.0):
    """The ribs and belly swell and settle (bone scale, no rocking). In-breath
    a bit quicker than the out-breath."""
    ph = (t / period) % 1.0
    k = math.sin(math.pi * ph / 0.4) ** 2 if ph < 0.4 else math.cos(math.pi * (ph - 0.4) / 1.2) ** 2
    p = dict(pose)
    p['_breath'] = amp * k
    return p


def blink(t, at, dur=0.2, depth=1.0):
    """Eyes shut fast and open a little slower, starting at `at` (0 outside)."""
    u = (t - at) / dur
    if u <= 0 or u >= 1:
        return 0.0
    return depth * (math.sin(math.pi * u / 0.4) if u < 0.4 else math.cos(math.pi * (u - 0.4) / 1.2))


def blinks(pose, t, times, dur=0.2, base=0.0):
    p = dict(pose)
    p['_blink'] = max([base] + [blink(t, a, dur) for a in times])
    return p


def tail_floor(side=1, bend=22.0, tip=20.0, offs=None, w=1.0):
    """Tail laid on the floor: down to the floor behind the rump, then curving
    `bend` degrees per bone round to the left (side=1) or right, the last bones
    lifting `tip` degrees. `offs` adds per-bone heading offsets (swishes along
    the floor). Solved in world space at bake time (lay_tail), so it works
    whatever the body is doing (sitting up, curled, rolled on its side)."""
    o = list(offs or [0.0] * NT)
    return {'_tf': (w, side, bend, tip, *o)}


def floor_wave(t, amp=10.0, speed=0.5, start=2, lag=0.6):
    """Per-bone heading offsets for a wave travelling along a floor tail."""
    return [0.0 if k < start else amp * ((k - start + 1) / (NT - start)) * math.sin(2 * math.pi * speed * t - k * lag)
            for k in range(NT)]


def look(t, keys, dur=0.14):
    """Snappy head turns: keys = [(time, (neck_side, head_side, head_twist)), ...];
    the head darts to each look in `dur` seconds and holds (cats look in jumps)."""
    cur = (0.0, 0.0, 0.0)
    for at, tgt in keys:
        if t < at:
            break
        u = min(1.0, (t - at) / dur)
        e = 1 - (1 - u) ** 3
        cur = tuple(a + (b - a) * e for a, b in zip(cur, tgt))
    return cur


def add(pose, extra):
    """Add rotations on top of a pose (layering ear flicks, tail waves...)."""
    out = mirror(dict(pose))
    for k, v in mirror(extra).items():
        if k.startswith('_'):
            out[k] = v
            continue
        a = out.get(k, (0, 0, 0))
        out[k] = tuple(x + y for x, y in zip(a, v))
    return out


# --------------------------------------------------------------------------
# Key poses

STAND = merge({'_plant': ['all']}, tail())

# Sit: rump on the floor, front paws planted where they stood, head level.
# The hind legs fold under by IK (heel under the hip, hock flat on the floor:
# the round haunch of a real sit) and the tail lies round the side of the paws.
SIT = merge({
    # Front paws step back under the chest so the cat sits up tall.
    '_plant': ['front'], '_tuck': ['hind'], '_seated': 1.0, '_feet': {'FL': (-0.24, 0), 'FR': (-0.24, 0)},
    'root': (52, 0, 0), 'spine': (4, 0, 0), 'chest': (4, 0, 0),
    'neck': (-30, 0, 0), 'head': (-16, 0, 0),
    'thigh.*': (95, 0, 0), 'shin.*': (-150, 0, 0), 'hock.*': (52, 0, 0), 'hind_paw.*': (40, 0, 0),
}, tail(lift=25, curl=6), tail_floor(side=1, bend=40, tip=24))

# Loaf: legs tucked right up into the body (cartoony), body on the floor, the
# tail laid round the side.
LOAF = merge({
    'neck': (-22, 0, 0), 'head': (8, 0, 0),
    'upperarm.*': (-60, 0, 0), 'thigh.*': (60, 0, 0),
    '_scale': {'upperarm.*': 0.12, 'thigh.*': 0.12},
}, tail(lift=18, curl=4, wrap=34), tail_floor(side=1, bend=36, tip=18))

# Lie (sphinx): belly down, front legs out in front, hind legs tucked, the
# tail out behind on the floor, curving round.
LIE = merge({
    'neck': (-12, 0, 0), 'head': (2, 0, 0),
    'upperarm.*': (78, 0, 0), 'forearm.*': (4, 0, 0), 'wrist.*': (6, 0, 0), 'paw.*': (-8, 0, 0),
    'thigh.*': (60, 0, 0),
    '_scale': {'thigh.*': 0.35, 'upperarm.*': 0.9},
}, tail(lift=20, curl=3, wrap=20), tail_floor(side=1, bend=27, tip=22))

# Sleep: curled into a donut to the left - head and rump both bend round to the
# same side (a C, not an S) - head resting on its side, eyes shut, tail wrapped
# round to the nose.
SLEEP = merge(LOAF, {
    'spine': (0, 30, 0), 'chest': (0, 30, 0), 'pelvis': (0, 34, 0),
    'neck': (-6, 50, 0), 'head': (4, 36, 36), '_blink': 1.0,
}, ears(24, 14, 0), tail_floor(side=1, bend=46, tip=6))

# Crouch: low and ready, eyes on the target. The legs are solved by IK
# (planted), so they bend at the joints instead of folding up.
CROUCH = merge({
    '_plant': ['all'], '_air': -0.07,
    'root': (-4, 0, 0), 'neck': (-14, 0, 0), 'head': (18, 0, 0),
}, ears(-12, 4, 0), tail(lift=30, curl=6))

# Front stretch (play bow): chest right down, front paws reaching far forward
# (forearms nearly flat on the floor), rump high, tail straight up, eyes squeezed.
STRETCH_FRONT = merge({
    '_plant': ['all'], '_feet': {'FL': (0.3, 0, -10), 'FR': (0.32, 0, -10)},
    'root': (-22, 0, 0), 'spine': (-2, 0, 0), 'chest': (2, 0, 0),
    'neck': (40, 0, 0), 'head': (2, 0, 0), '_blink': 0.75,
}, ears(22, 10, 0), tail(lift=-12, curl=-1, tip=-10))

# Back stretch: weight forward on the front paws, one back leg pushed out
# straight behind, toes pointed, just off the floor.
STRETCH_BACK = merge({
    '_plant': ['front', 'HR'], '_feet': {'HR': (-0.04, 0)},
    'root': (8, 0, 0), 'neck': (-10, 0, 0), 'head': (0, 0, 0),
    'thigh.L': (-58, 0, 0), 'shin.L': (18, 0, 0), 'hock.L': (-8, 0, 0), 'hind_paw.L': (-30, 0, 0),
}, ears(6, 4, 0), tail(lift=10, curl=-1))

# Arch: spooked Halloween cat. Up on its toes, legs straight and tall, back
# humped in the middle, head low, ears flat, tail straight up and puffed.
ARCH = merge({
    # Held pose with hand-set legs (the IK would tip the body and lose the hump).
    # The peak is mid-back at the ribs: spine +14 rises from the waist to the
    # ribs, chest -46 drops the shoulders (net -32), pelvis +36 drops the rump
    # (net 22 down, it's a child of spine). Legs are turned back to vertical
    # (thigh -50 undoes spine + pelvis, upperarm +32 the chest) and the cat
    # stands up on its toes.
    'spine': (14, 0, 0), 'pelvis': (36, 0, 0), 'chest': (-46, 0, 0),
    'thigh.*': (-50, 0, 0), 'hind_paw.*': (-12, 0, 0),
    'upperarm.*': (32, 0, 0), 'paw.*': (-12, 0, 0),
    'neck': (20, 0, 0), 'head': (-24, 0, 0),
    '_scale': {'tail.0': (1.45, 1.0, 1.45)},
}, ears(55, 30, 0), tail(lift=-13, tip=30))   # pelvis tilt already swings the tail forward

# Flop: rolled onto the left side, the body in a lazy curve, legs loose and
# bent (the top ones a little apart from the bottom ones), head down on its
# cheek, tail out behind along the floor.
FLOP = merge({
    'spine': (0, 8, -75), 'chest': (0, 6, -8), 'pelvis': (0, 6, 0),
    'neck': (-8, 6, -12), 'head': (6, 4, -16),
    'upperarm.L': (40, 0, 0), 'forearm.L': (-30, 0, 0), 'wrist.L': (20, 0, 0), 'paw.L': (10, 0, 0),
    'upperarm.R': (58, -6, 0), 'forearm.R': (-45, 0, 0), 'wrist.R': (30, 0, 0), 'paw.R': (15, 0, 0),
    'thigh.L': (-10, 0, 0), 'shin.L': (-25, 0, 0), 'hock.L': (25, 0, 0), 'hind_paw.L': (10, 0, 0),
    'thigh.R': (12, 6, 0), 'shin.R': (-40, 0, 0), 'hock.R': (30, 0, 0), 'hind_paw.R': (12, 0, 0),
}, ears(14, 10, 0), tail(lift=35, curl=4), tail_floor(side=1, bend=7, tip=14))

# Groom: sitting, the right foreleg held straight out in front of the face,
# head down licking it.
GROOM = merge(SIT, {
    # The right paw is held up in front of the mouth by IK (a target, not angles,
    # so it lands at the mouth on every build).
    '_plant': ['FL', 'FR'], '_feet': {'FR': (0.06, 0.44)},   # reaching out in front of the face
    'neck': (-22, -8, 0), 'head': (-30, -8, 0), '_blink': 0.5,
}, ears(8, 6, 0))

# Knead: leaning forward, front paws pressing down in turn ("making biscuits").
KNEAD = merge({
    '_plant': ['all'], 'root': (-6, 0, 0), 'neck': (-10, 0, 0), 'head': (-14, 0, 0),
}, ears(10, 14, 0), tail(lift=-30, curl=-2))


# --------------------------------------------------------------------------
# Gaits: paw paths, solved with IK. In place (the game moves the cat): during
# stance a paw slides back along the floor at the walking speed, then swings
# forward in an arc.

def gait(t, period, phases, duty, stride, lift, bob=0.01, base=None, drop=0.0, flex=0.0, tail_amp=6):
    u0 = (t / period) % 1.0
    pose = merge(base or {}, {'_plant': ['all']})
    feet = {}
    for leg, ph in phases.items():
        u = (u0 + ph) % 1.0
        if u < duty:                                  # stance: on the floor, sliding back
            dx, dz = stride / 2 - stride * (u / duty), 0.0
        else:                                         # swing: forward in an arc
            v = (u - duty) / (1 - duty)
            dx = -stride / 2 + stride * (v * v * (3 - 2 * v))
            dz = lift * math.sin(math.pi * v)
        feet[leg] = (dx, dz)
    pose['_feet'] = feet
    w = 2 * math.pi * u0
    pose['_drop'] = drop + bob * (1 - math.cos(2 * w)) / 2
    pose['spine'] = (flex * math.sin(w), 2.5 * math.sin(w), 0)
    pose['chest'] = (0, -2.5 * math.sin(w), 0)
    if flex:   # gallop: the back bunches and stretches, the body rocks
        pose['root'] = (flex * 0.5 * math.sin(w + 0.7), 0, 0)
        pose['pelvis'] = (-flex * 0.7 * math.sin(w), 0, 0)
    h = (base or {}).get('head', (0, 0, 0))
    pose['head'] = (h[0] - 1.5 * math.sin(2 * w), h[1] - 1.5 * math.sin(w), h[2])
    return tail_wave(t, tail_amp, 1 / period, base=pose)


WALK = dict(phases={'HL': 0.0, 'FL': 0.25, 'HR': 0.5, 'FR': 0.75}, duty=0.68)
TROT = dict(phases={'HL': 0.0, 'FR': 0.0, 'HR': 0.5, 'FL': 0.5}, duty=0.5)
GALLOP = dict(phases={'HL': 0.0, 'HR': 0.1, 'FL': 0.5, 'FR': 0.6}, duty=0.32)


def walk_fn(t):
    return add(gait(t, 1.0, WALK['phases'], WALK['duty'], 0.2, 0.07, bob=0.008, tail_amp=6, base=tail(curl=-2)),
               ears(-4, 0, 0))


def trot_fn(t):
    return gait(t, 0.56, TROT['phases'], TROT['duty'], 0.28, 0.09, bob=0.012, tail_amp=5, base=tail(lift=8))


def run_fn(t, period=0.44):
    """Rotary gallop, timed to the footfalls (u = 0..1 per stride):
      hind L lands 0.00, hind R 0.08, front L 0.48, front R 0.56; each paw is
      down for 30% of the stride.
    The back bunches up (hump) just before the hind paws land and stretches flat
    as the front paws reach; two short flights; the body pitches nose-up off
    the hind push and nose-down onto the front landing; the head stays level;
    the tail and ears trail behind. Swinging paws fold and curl, reach forward
    at the end of the swing, then plant."""
    u0 = (t / period) % 1.0
    duty, stride, lift = 0.3, 0.5, 0.15
    phases = {'HL': 0.0, 'HR': -0.08, 'FL': -0.48, 'FR': -0.56}
    feet = {}
    for leg, ph in phases.items():
        u = (u0 + ph) % 1.0
        front = leg[0] == 'F'
        if u < duty:                                   # stance: planted, sliding back
            v = u / duty
            feet[leg] = (stride / 2 - stride * v, 0.0, 0.0, 0.0)
        else:                                          # swing: fold up, carry forward, reach, plant
            v = (u - duty) / (1 - duty)
            reach = stride * 0.12 * math.sin(math.pi * min(1.0, v / 0.85)) ** 2 if v > 0.5 else 0.0
            dx = -stride / 2 + stride * (v * v * (3 - 2 * v)) + reach
            dz = lift * math.sin(math.pi * v) ** 0.8
            fold = math.sin(math.pi * min(1.0, v * 1.25))
            if front:   # wrist folds back, paw curls; straightens to reach at the end
                feet[leg] = (dx, dz, -70 * fold, -55 * fold)
            else:       # hock flexes up, paw curls under
                feet[leg] = (dx, dz, -50 * fold, 35 * fold)
    # Spine: +1 = bunched (hump) at u ~0.93, -1 = stretched at u ~0.43.
    F = math.cos(2 * math.pi * (u0 - 0.93))
    pitch = 9 * math.sin(2 * math.pi * (u0 - 0.12))        # nose up after the hind push, down onto the fronts
    flight = 0.035 * max(0.0, math.cos(2 * math.pi * (u0 - 0.97))) ** 4 \
        + 0.02 * max(0.0, math.cos(2 * math.pi * (u0 - 0.44))) ** 4
    pose = merge(tail(lift=26 + 10 * math.sin(2 * math.pi * (u0 - 0.3)), curl=-1 - 5 * F),
                 ears(28, 6, 0), {
        '_plant': ['all'], '_feet': feet, '_drop': -flight + 0.01,
        'root': (pitch, 0, 0),
        'spine': (-12 * F, 2 * math.sin(2 * math.pi * u0), 0),
        'pelvis': (26 * F, 0, 0),
        'chest': (5 * F, -2 * math.sin(2 * math.pi * u0), 0),
        # Head stays level: undo the body's pitch at the neck.
        'neck': (-pitch * 0.8 + 6 * F, 0, 0), 'head': (-pitch * 0.3 + 4, 0, 0),
    })
    return tail_wave(t, 4, 1 / period, start=4, lag=0.8, base=pose)


def sneak_fn(t):
    base = {k: v for k, v in CROUCH.items() if k not in ('_air', '_plant')}
    return gait(t, 1.5, WALK['phases'], 0.75, 0.15, 0.04, bob=0.004, drop=0.07, tail_amp=2, base=base)


# --------------------------------------------------------------------------
# Idles and tail moves (functions of time, sampled to keys)

def head_look(pose, t, keys, dur=0.14):
    ns, hs, ht = look(t, keys, dur)
    return add(pose, {'neck': (0, ns, 0), 'head': (0, hs, ht)})


def idle_fn(t):
    """Standing, alert and busy: looks off left (ears swivel after it), back,
    a curious head tilt, blinks; the tail waves slowly; breathing."""
    p = merge(STAND, tail(curl=-1))
    p = tail_wave(t, 8, 0.25, base=breathe(p, t, 0.03, 2.0))
    p = head_look(p, t, [(0.5, (10, 14, 4)), (1.7, (0, 0, 0)), (2.5, (-4, -6, -16)), (3.5, (0, 0, 0))])
    sw = look(t, [(0.62, (0, 0, 1)), (1.8, (0, 0, 0))])[2]
    p = add(p, merge(ears(left=(0, 0, 30 * sw), pitch=0, side=0, twist=-18 * sw), ear_flick(t, 3.0, 'R', amount=25)))
    return blinks(p, t, [1.15, 3.2])


def tip_taps(t, times, amp=40, dur=0.32):
    """The tail tip lifting off the floor and tapping back down at `times`."""
    return max([0.0] + [math.sin(math.pi * (t - a) / dur) for a in times if 0 <= t - a <= dur]) * amp


def loaf_idle_fn(t):
    """Contented loaf: eyes half shut with a slow blink, ears swivelling to
    listen, the tail sweeping lazily along the floor and the tip curling up and
    tapping down."""
    p = breathe(LOAF, t, 0.04, 3.0)
    tip = 18 + tip_taps(t, [1.0, 1.45, 4.2])
    p = merge(p, tail_floor(1, 36, tip, floor_wave(t, 12, 1 / 6, start=3)))
    sw = 18 * math.sin(2 * math.pi * t / 6.0)
    p = add(p, merge(ears(left=(4, 0, sw)), ear_flick(t, 2.2, 'R', amount=30)))
    slow = 0.0 if not 3.0 < t < 4.4 else math.sin(math.pi * (t - 3.0) / 1.4) ** 0.5
    return blinks(p, t, [0.6], base=0.35 + 0.65 * slow)


def sit_idle_fn(t):
    """Sitting tall: breathing, looking about, a blink; the tail stays wrapped
    round the paws and just the tip lifts and taps."""
    p = breathe(SIT, t, 0.035, 2.0)
    p = merge(p, tail_floor(1, 40, 24 + tip_taps(t, [0.9, 2.6, 3.0], 34), floor_wave(t, 5, 0.25, start=4)))
    p = head_look(p, t, [(0.4, (-8, -10, 0)), (1.4, (6, 8, 6)), (2.4, (0, 0, 0))])
    p = add(p, ear_flick(t, 1.6, 'L', amount=28))
    return blinks(p, t, [2.0])


def lie_idle_fn(t):
    """Sphinx: breathing, tail tip thumping on the floor, ears and head
    turning to sounds, a blink."""
    p = breathe(LIE, t, 0.04, 2.0)
    p = merge(p, tail_floor(1, 27, 22 + tip_taps(t, [0.3, 0.75, 2.3], 30, 0.26), floor_wave(t, 8, 0.5, start=4)))
    p = head_look(p, t, [(1.0, (8, 10, 4)), (2.5, (0, 0, 0))])
    p = add(p, ears(left=(0, 0, 12 * math.sin(2 * math.pi * t / 4))))
    return blinks(p, t, [1.8])


def sleep_idle_fn(t):
    """Deep slow breathing; now and then an ear twitches and the tail tip
    flicks (dreaming)."""
    p = breathe(SLEEP, t, 0.06, 3.0)
    p = merge(p, tail_floor(1, 46, 6 + tip_taps(t, [3.6], 25, 0.3)))
    return add(p, ear_flick(t, 1.7, 'R', dur=0.2, amount=30))


def flop_idle_fn(t):
    """Lazing on its side: breathing, the tail sweeping along the floor, a
    slow blink, and the top front paw kneading the air (toe beans)."""
    p = breathe(FLOP, t, 0.045, 2.0)
    p = merge(p, tail_floor(1, 7, 14 + tip_taps(t, [1.2], 30), floor_wave(t, 16, 0.25, start=2, lag=0.5)))
    kn = math.sin(math.pi * (t - 2.2) / 1.2) if 2.2 < t < 3.4 else 0.0
    paw = math.sin(2 * math.pi * (t - 2.2) / 0.4) * kn
    p = add(p, {'upperarm.R': (12 * kn, 0, 0), 'wrist.R': (-25 * kn + 12 * paw, 0, 0), 'paw.R': (-30 * kn, 0, 0)})
    p = add(p, {'head': (0, 0, 6 * math.sin(2 * math.pi * t / 4))})
    slow = 0.0 if not 0.4 < t < 1.8 else math.sin(math.pi * (t - 0.4) / 1.4) ** 0.5
    return blinks(p, t, [], base=0.2 + 0.8 * slow)


def whack(t, at, out=0.07, hold=0.06, back=0.22):
    """0 -> 1 fast, hold, ease back to 0: one sharp tail strike."""
    u = t - at
    if u <= 0 or u >= out + hold + back:
        return 0.0
    if u < out:
        return 1 - (1 - u / out) ** 2
    if u < out + hold:
        return 1.0
    return smooth(1 - (u - out - hold) / back)


def tail_flick_fn(t):
    """Irritated flicks: the top third whips over to the side and back, twice."""
    p = tail(curl=-1)
    for k in range(4, NT):
        g = (k - 3) / (NT - 4)
        lag = (k - 4) * 0.012
        f = whack(t, 0.12 + lag, 0.06, 0.03, 0.2) - 0.8 * whack(t, 0.55 + lag, 0.06, 0.03, 0.22)
        a, b_, c = p[f'tail.{k}']
        p[f'tail.{k}'] = (a - 24 * abs(f) * g, b_ + 55 * f * g, c)
    return p


def tail_question_fn(t):
    """Friendly hello: the tail goes up tall and straight and the top hooks over
    into a question mark, holds with a little sway, relaxes."""
    rise = smooth(min(1.0, t / 0.3)) * (1 - smooth(max(0.0, (t - 1.35) / 0.35)))
    hook = smooth(min(1.0, max(0.0, (t - 0.12) / 0.3))) * (1 - smooth(max(0.0, (t - 1.3) / 0.4)))
    p = tail(lift=-6 * rise, curl=-1 - 2 * rise, tip=-62 * hook)
    return tail_wave(t, 6 * hook, 1.2, start=5, lag=0.5, base=p)


def tail_bat_fn(t):
    """Batting: the tail held low, striking hard to one side then the other -
    each a fast whip from the base with the tip lagging - then a pause."""
    p = tail(lift=22, curl=2)
    for k in range(NT):
        g = 0.35 + 0.65 * k / (NT - 1)
        lag = k * 0.018
        f = whack(t, 0.08 + lag) - whack(t, 0.5 + lag)
        a, b_, c = p[f'tail.{k}']
        p[f'tail.{k}'] = (a - 10 * abs(f) * g, b_ + 32 * f * g, c)
    return p


def tail_quiver_fn(t):
    """Happy greeting: tail straight up, the top quivering fast."""
    k = smooth(min(1.0, t / 0.2))
    p = tail(lift=-14 * k, curl=-0.6 * k, tip=8 * k)        # straight up like a flagpole
    q = k * (0.6 + 0.4 * math.sin(2 * math.pi * t / 1.0))
    for i in range(4, NT):
        a, b_, c = p[f'tail.{i}']
        p[f'tail.{i}'] = (a, b_ + 7 * q * math.sin(2 * math.pi * 12 * t - i * 0.6), c)
    return p


TAIL_MOVES = {
    'tail_flick': (tail_flick_fn, 1.0, False),
    # Annoyed: big fast lashes from the base.
    'tail_swish': (lambda t: tail_wave(t, 22, 1 / 0.72, start=0, lag=0.4, base=tail(lift=6)), 0.72, True),
    # Content: a slow wave like seaweed.
    'tail_wave': (lambda t: tail_wave(t, 12, 0.5, start=1, lag=0.7, base=tail(curl=-2)), 2.0, True),
    'tail_question': (tail_question_fn, 1.8, False),
    'tail_bat': (tail_bat_fn, 1.0, True),
    'tail_quiver': (tail_quiver_fn, 1.0, True),
}


def fn_clip(fn, seconds, steps=None):
    n = steps or max(2, int(seconds * FPS))
    return [(seconds * i / n, fn(seconds * i / n)) for i in range(n + 1)]


def snap(u):
    """Fast start, soft landing: most of the move happens in the first half."""
    return 1 - (1 - u) ** 3


def smooth(u):
    return u * u * (3 - 2 * u)


def wiggle_keys(start, seconds, base, hop=0.012):
    """Butt wiggle before a jump: hips swaying, back paws paddling in turn."""
    keys = []
    n = int(seconds * 12)
    for i in range(n + 1):
        t = seconds * i / n
        s = math.sin(2 * math.pi * t / 0.35)
        p = merge(base, {'pelvis': (0, 9 * s, 0), '_feet': {'HL': (0, hop * max(0.0, s)), 'HR': (0, hop * max(0.0, -s))}})
        p = tail_wave(t, 8, 3, start=5, base=p)
        keys.append((start + t, p))
    return keys


COIL = merge(CROUCH, {'_air': -0.09, 'root': (-8, 0, 0), 'pelvis': (-10, 0, 0), 'neck': (-18, 0, 0),
                      'head': (22, 0, 0)}, ears(-18, 0, 0))
# Buck: the front lifts first, the whole body tips nose-up on planted back legs.
BUCK = merge(STAND, {'_plant': ['hind'], 'root': (34, 0, 0), 'neck': (-10, 0, 0), 'head': (-10, 0, 0),
                     'upperarm.*': (40, 0, 0), 'forearm.*': (-60, 0, 0), 'wrist.*': (30, 0, 0)},
             ears(-10, 0, 0), tail(lift=30))
STRETCHED = merge({'_plant': [], 'root': (6, 0, 0), 'spine': (4, 0, 0),
                   'upperarm.*': (70, 0, 0), 'forearm.*': (6, 0, 0), 'paw.*': (-10, 0, 0),
                   'thigh.*': (-60, 0, 0), 'shin.*': (30, 0, 0), 'hock.*': (-10, 0, 0), 'hind_paw.*': (-20, 0, 0)},
                  ears(-6, 0, 0), tail(lift=20))
# Landing: front paws reach down first, nose-down.
LAND = merge({'_plant': ['front'], 'root': (-24, 0, 0), 'neck': (14, 0, 0), 'head': (10, 0, 0),
              'thigh.*': (-25, 0, 0), 'shin.*': (30, 0, 0)}, tail(lift=-10))


def pounce_fn(t):
    """A frame-by-frame pounce:
      0.00-0.25  sink into a crouch, eyes locked on the target
      0.25-1.05  butt wiggle, getting faster, back paws paddling; the head stays
                 fixed on the target while the rump sways
      1.05-1.20  dead still, coiled lower
      1.20-1.30  explosive push off the back legs, front lifting
      1.30-1.58  flight along an arc: body stretched, front paws reaching out
                 and down at the target, back legs trailing, tail streaming
      1.58-1.72  front paws land and pin, the back end keeps coming and the
                 back bunches up, head dips to "bite"
      1.72-2.30  hold over the catch, tail lashing, then settle
    """
    target_fwd = 0.85
    if t < 0.25:                                   # sink
        k = smooth(t / 0.25)
        p = lerp_pose(STAND, CROUCH, k)
        return p
    if t < 1.05:                                   # wiggle, speeding up, head locked
        w = t - 0.25
        freq = 2.2 + 3.0 * (w / 0.8)
        sway = math.sin(2 * math.pi * (2.2 * w + 1.5 * w * w / 0.8))
        amp = 8 + 5 * (w / 0.8)
        p = merge(CROUCH, {'pelvis': (0, amp * sway, 0), 'spine': (0, -amp * 0.35 * sway, 0),
                           'neck': (-14, amp * 0.25 * sway, 0), 'head': (18, amp * 0.2 * sway, 0),
                           '_feet': {'HL': (0, 0.014 * max(0.0, sway)), 'HR': (0, 0.014 * max(0.0, -sway))}})
        p = tail_wave(t, 7, freq * 0.8, start=5, lag=0.4, base=p)
        return add(p, ears(-16, 4, 0))
    if t < 1.2:                                    # dead still, coiled
        k = smooth((t - 1.05) / 0.15)
        return lerp_pose(CROUCH, COIL, k)
    if t < 1.3:                                    # push off: hind planted, front lifting, nose up
        k = (t - 1.2) / 0.1
        e = 1 - (1 - k) ** 2
        p = merge(STAND, {'_plant': ['hind'], '_fwd': 0.08 * e, '_air': 0.0,
                          'root': (22 * e, 0, 0), 'spine': (-6 * e, 0, 0), 'pelvis': (10 * e, 0, 0),
                          # front legs fold up tight as they leave the floor
                          'upperarm.*': (60 * e, 0, 0), 'forearm.*': (-95 * e, 0, 0), 'wrist.*': (50 * e, 0, 0),
                          'neck': (-20 * e, 0, 0), 'head': (-4, 0, 0)},
                  ears(-10, 0, 0), tail(lift=30 - 10 * e))
        return lerp_pose(COIL, p, e) if k < 0.5 else p
    if t < 1.58:                                   # flight along an arc
        k = (t - 1.3) / 0.28
        fwd = 0.08 + (target_fwd - 0.08) * k
        air = 0.2 * 4 * k * (1 - k)                # parabola
        pitch = 18 - 40 * k                        # nose up -> nose down
        reach = math.sin(math.pi * min(1.0, k * 1.3))
        p = merge({'_plant': [], '_fwd': fwd, '_air': air,
                   'root': (pitch, 0, 0), 'spine': (-4, 0, 0), 'pelvis': (-8, 0, 0),
                   # front paws reach out then down at the target
                   'upperarm.*': (70 - 25 * k, 0, 0), 'forearm.*': (-10 + 10 * k, 0, 0), 'wrist.*': (-20 * reach, 0, 0),
                   'paw.*': (-25 * reach, 0, 0),
                   # back legs trail, extended from the push
                   'thigh.*': (-55 + 20 * k, 0, 0), 'shin.*': (30, 0, 0), 'hock.*': (-15, 0, 0),
                   'hind_paw.*': (-30, 0, 0),
                   'neck': (-pitch * 0.6, 0, 0), 'head': (6 - 10 * k, 0, 0)},
                  # the tail counters the body's pitch so it keeps streaming level behind
                  ears(-8, 0, 0), tail(lift=24 - 6 * k - 0.8 * pitch, curl=-1))
        return p
    if t < 1.72:                                   # land: front pins first, back end catches up
        k = (t - 1.58) / 0.14
        e = smooth(k)
        p = merge({'_plant': ['front'], '_fwd': target_fwd, '_feet': {'FL': (0.02, 0), 'FR': (0.02, 0)},
                   'root': (-22 + 16 * e, 0, 0), 'spine': (-10 * e, 0, 0), 'pelvis': (24 * e, 0, 0),
                   'thigh.*': (-35 + 75 * e, 0, 0), 'shin.*': (30 - 70 * e, 0, 0), 'hock.*': (-10 + 30 * e, 0, 0),
                   'neck': (10, 0, 0), 'head': (-14 * e, 0, 0)},
                  ears(-14, 0, 0), tail(lift=22 + 8 * e + 0.8 * (22 - 16 * e), curl=-1))   # trailing low
        return p
    # Over the catch: crouched, front paws pinning, tail lashing, head nibbling.
    k = min(1.0, (t - 1.72) / 0.58)
    p = merge(CROUCH, {'_fwd': target_fwd, '_feet': {'FL': (0.02, 0), 'FR': (0.02, 0)},
                       'neck': (6, 0, 0), 'head': (-18 + 5 * math.sin(2 * math.pi * t / 0.3) * (1 - k), 0, 0)})
    p = tail_wave(t, 16 * (1 - 0.5 * k), 2.2, start=2, lag=0.5, base=p)
    return add(p, ears(-10 * (1 - k), 0, 0))


def jump_keys():
    k = [(0.0, STAND), (0.18, CROUCH)]
    k += wiggle_keys(0.18, 0.6, CROUCH)
    k += [(0.85, COIL), (1.0, BUCK),
          (1.2, merge(STRETCHED, {'_fwd': 0.15, '_air': 0.45, 'root': (40, 0, 0)})),
          (1.36, merge(STAND, {'_fwd': 0.28, '_air': 0.34, '_plant': [], 'root': (-10, 0, 0),
                               'upperarm.*': (30, 0, 0), 'thigh.*': (-20, 0, 0)})),
          (1.52, merge(LAND, {'_fwd': 0.35})),
          (1.64, merge(CROUCH, {'_fwd': 0.38})),
          (1.9, merge(STAND, {'_fwd': 0.38}))]
    return k


def knead_fn(t):
    """Making biscuits: the front paws take turns pressing into the floor - a
    small lift, then a push down with the toes spreading - the shoulders sink
    into each push, eyes half shut, tail up with the tip quivering."""
    s_ = math.sin(2 * math.pi * t / 0.8)
    lift_l, lift_r = max(0.0, s_), max(0.0, -s_)
    press_l, press_r = max(0.0, -s_), max(0.0, s_)
    p = merge(KNEAD, {'_feet': {'FL': (0.04 + 0.02 * lift_l, 0.05 * lift_l, -25 * lift_l + 10 * press_l),
                                'FR': (0.04 + 0.02 * lift_r, 0.05 * lift_r, -25 * lift_r + 10 * press_r)},
                      'chest': (-6 - 3 * abs(s_), 0, 0), 'head': (-14 - 3 * abs(s_), 0, 0),
                      '_blink': 0.55})
    p = breathe(p, t, 0.03, 1.6)
    return tail_wave(t, 5, 3.0, start=6, base=p)


def knead_lie_fn(t):
    """Kneading the blanket from a sphinx lie: front paws out in front taking
    turns to push, toes spreading, eyes nearly shut, purring breaths."""
    s_ = math.sin(2 * math.pi * t / 0.8)
    l, r = max(0.0, s_), max(0.0, -s_)
    p = merge(LIE, {'upperarm.L': (78 - 14 * l, 0, 0), 'wrist.L': (6 - 25 * l, 0, 0), 'paw.L': (-8 + 20 * (1 - l), 0, 0),
                    'upperarm.R': (78 - 14 * r, 0, 0), 'wrist.R': (6 - 25 * r, 0, 0), 'paw.R': (-8 + 20 * (1 - r), 0, 0),
                    'head': (-2 - 2 * abs(s_), 0, 6), '_blink': 0.7})
    p = breathe(p, t, 0.04, 1.6)
    return merge(p, tail_floor(1, 27, 22, floor_wave(t, 6, 0.625, start=4)))


def groom_fn(t):
    lick = math.sin(2 * math.pi * t / 0.35)
    p = merge(GROOM, {'head': (-26 + 9 * lick, -6, 0), 'neck': (-46 + 3 * lick, -6, 0)})
    return merge(p, tail_floor(1, 40, 24 + tip_taps(t, [0.5], 25)))


def scratch_fn(t):
    """Sitting, the right hind leg swung out and up so the paw reaches the ear,
    scratching fast; the head tips down and over toward it. Cartoony on purpose:
    the leg stretches a little (bone scale) so it reaches on every build, and it
    is posed by hand rather than IK so it swings clear of the flank instead of
    lying along it."""
    k = math.sin(2 * math.pi * t / 0.14)
    return merge(SIT, {'_plant': ['FL', 'FR'], '_tuck': ['HL'],
                       'thigh.R': (82, -70, 0), 'shin.R': (-12 + 18 * k, 0, 0), 'hock.R': (8, 0, 0),
                       'hind_paw.R': (-35, 0, 0),
                       '_scale': {'thigh.R': 1.35}, '_blink': 0.8,
                       'neck': (-42, -36, 0), 'head': (-10, -34, -36),
                       'ear.L': (0, 0, 0), 'ear.R': (45, -25, 0)})


def slow_blink_fn(t):
    """The cat "I love you": sitting, eyes close slowly, stay shut a beat and
    open slowly, the head dipping a little with them; ears soft."""
    k = smooth(min(1.0, t / 0.6)) * (1 - smooth(max(0.0, (t - 1.3) / 0.6)))
    p = breathe(SIT, t, 0.03, 2.0)
    p = add(p, merge({'neck': (-4 * k, 0, 0), 'head': (-6 * k, 0, 4 * k)}, ears(10 * k, 8 * k, 0)))
    p['_blink'] = 0.92 * k
    return p


def head_tilt_fn(t):
    """Curious: sitting, the head tips right over to one side, ears forward,
    a pause, a little re-tilt to the other side, back."""
    a = look(t, [(0.15, (0, 4, 26)), (0.95, (0, -2, -18)), (1.55, (0, 0, 0))], 0.12)
    p = breathe(SIT, t, 0.03, 1.0)
    p = add(p, merge({'neck': (4, a[0], 0), 'head': (6, a[1], a[2])}, ears(-14, -4, 0)))
    return blinks(p, t, [1.25])


def paw_swipe_fn(t):
    """Sitting, the right paw bats at something in front: up, a fast swipe
    down and forward, back up, a second swipe, then down to the floor."""
    def swipe(at):
        return whack(t, at, 0.07, 0.05, 0.16)
    up = smooth(min(1.0, t / 0.18)) * (1 - smooth(max(0.0, (t - 1.0) / 0.2)))
    hit = swipe(0.25) + swipe(0.62)
    p = merge(SIT, {'_feet': {'FR': (-0.24 + 0.1 * up + 0.14 * hit, 0.3 * up - 0.16 * hit, -40 * up + 30 * hit)},
                    'upperarm.R': (0, -10 * up, 0), 'neck': (-26 - 8 * hit, 0, 0), 'head': (-18 - 6 * hit, 0, 0)},
              ears(-16 * up, 0, 0))
    p['_plant'] = ['FL', 'FR']
    return merge(p, tail_floor(1, 40, 24 + 30 * hit, floor_wave(t, 10 * up, 1.0, start=4)))


def wake_keys():
    """Waking: still curled, an ear flicks; the head lifts groggily, eyes
    blinking open; a big lying stretch - front legs reaching out, head up,
    eyes squeezed shut; then settled in a sphinx, eyes open."""
    peek = merge(SLEEP, {'neck': (-2, 40, 0), 'head': (8, 26, 22), '_blink': 0.55}, ears(8, 6, 0))
    up = merge(LOAF, {'spine': (0, 14, 0), 'chest': (0, 12, 0), 'pelvis': (0, 16, 0),
                      'neck': (-8, 12, 0), 'head': (4, 8, 6), '_blink': 0.2}, ears(0, 0, 0))
    reach = merge(LIE, {'upperarm.*': (82, 0, 0), 'forearm.*': (2, 0, 0), 'wrist.*': (4, 0, 0), 'paw.*': (-22, 0, 0),
                        '_scale': {'thigh.*': 0.35, 'upperarm.*': 1.3},
                        'spine': (-3, 0, 0), 'neck': (20, 0, 0), 'head': (22, 0, 0), '_blink': 0.9},
                  ears(30, 14, 0), tail_floor(1, 27, 40))
    return [(0.0, SLEEP), (0.3, merge(SLEEP, ear_flick(0.1, 0.0, 'R'))), (0.6, peek),
            (0.8, merge(peek, {'_blink': 1.0})), (1.1, up), (1.25, merge(up, {'_blink': 0.7})),
            (1.4, merge(up, {'_blink': 0.0})), (1.75, reach), (2.25, reach), (2.6, LIE)]


# --------------------------------------------------------------------------
# Baking


def vec3(v):
    return v if isinstance(v, (tuple, list)) else (v, v, v)


def apply(arm, pose):
    pose = mirror(pose)
    scales = pose.get('_scale', {})
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        p, s, t = pose.get(pb.name, (0, 0, 0))
        pb.rotation_euler = Euler((math.radians(p), math.radians(t), math.radians(s)), 'XYZ')
        pb.scale = Vector(vec3(scales.get(pb.name, 1.0)))
    b = pose.get('_breath', 0.0)
    if 'chest_breath' in arm.pose.bones:
        arm.pose.bones['chest_breath'].scale = Vector((1 + b, 1, 1 + b))
        arm.pose.bones['spine_breath'].scale = Vector((1 + 0.8 * b, 1, 1 + 1.2 * b))
    if 'lids' in arm.pose.bones:
        arm.pose.bones['lids'].scale = Vector((1, 1 - 0.88 * min(1.0, max(0.0, pose.get('_blink', 0.0))), 1))


def lerp_pose(a, b, u):
    a, b = mirror(a), mirror(b)
    out = {}
    for k in set(a) | set(b):
        if k == '_scale':
            sa, sb = a.get('_scale', {}), b.get('_scale', {})
            out['_scale'] = {n: tuple(x + (y - x) * u for x, y in zip(vec3(sa.get(n, 1.0)), vec3(sb.get(n, 1.0))))
                             for n in set(sa) | set(sb)}
        elif k == '_feet':
            fa, fb = a.get('_feet', {}), b.get('_feet', {})
            def pad(v):
                return tuple(v) + (0.0,) * (4 - len(v))
            out['_feet'] = {n: tuple(x + (y - x) * u for x, y in zip(pad(fa.get(n, ())), pad(fb.get(n, ()))))
                            for n in set(fa) | set(fb)}
        elif k in ('_plant', '_tuck', '_tuckw'):
            continue
        elif k == '_tf':
            fa, fb = a.get('_tf'), b.get('_tf')
            if fa and fb:
                out['_tf'] = tuple(x + (y - x) * u for x, y in zip(fa, fb))
            elif fa:
                out['_tf'] = (fa[0] * (1 - u),) + tuple(fa[1:])
            else:
                out['_tf'] = (fb[0] * u,) + tuple(fb[1:])
        elif k in ('_fwd', '_air', '_drop', '_seated', '_lift', '_breath', '_blink'):
            out[k] = a.get(k, 0.0) + (b.get(k, 0.0) - a.get(k, 0.0)) * u
        elif not k.startswith('_'):
            va, vb = a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0))
            out[k] = tuple(x + (y - x) * u for x, y in zip(va, vb))
    # Planted through a transition only if planted at both ends. A leg planted at
    # one end and tucked at the other stays on IK, its target sliding between.
    pa, pb_ = set(legs_of(a.get('_plant'))), set(legs_of(b.get('_plant')))
    ta, tb = tuck_weights(a), tuck_weights(b)
    tw = {}
    for leg in set(ta) | set(tb):
        if (leg in ta or leg in pa) and (leg in tb or leg in pb_):
            tw[leg] = ta.get(leg, 0.0) * (1 - u) + tb.get(leg, 0.0) * u
    out['_plant'] = sorted((pa & pb_) - set(tw))
    if tw:
        out['_tuckw'] = tw
    if '_drop' in out and not ('_drop' in a and '_drop' in b):
        out.pop('_drop')
    return out


def tuck_weights(p):
    if '_tuckw' in p:
        return dict(p['_tuckw'])
    return {leg: 1.0 for leg in legs_of(p.get('_tuck'))}


SEAT = []   # vertex indices of the rump, haunches and belly (set in bake_all)


def lowest(body, verts=None):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    m = ev.matrix_world
    vs = me.vertices
    z = min((m @ vs[i].co).z for i in verts) if verts else min((m @ v.co).z for v in vs)
    ev.to_mesh_clear()
    return z


def set_root(arm, fwd, up):
    # The root bone points up: its local Y is up, local Z points backward.
    arm.pose.bones['root'].location = Vector((0, up, -fwd))


def update():
    bpy.context.view_layer.update()


def angle_xz(v):
    return math.degrees(math.atan2(v.z, v.x))


def wrap180(a):
    return (a + 180) % 360 - 180


class IK:
    """Planted paws by 2-bone IK in the side plane. The lower two bones of each
    leg (cannon / hock, paw) keep the world angle they have at rest, the upper
    two are solved so the paw joint lands on its target. Knees bend forward,
    elbows back."""

    def __init__(self, arm):
        self.arm = arm
        apply(arm, {})
        set_root(arm, 0, 0)
        update()
        pb = arm.pose.bones
        self.rest = {}
        for leg, (b1, b2, b3, b4) in LEGS.items():
            self.rest[leg] = dict(joint=pb[b4].head.copy(), a3=angle_xz(pb[b3].tail - pb[b3].head),
                                  a4=angle_xz(pb[b4].tail - pb[b4].head))
        # Which way does +pitch turn a leg bone in the side plane? Measure once.
        b = pb['thigh.L']
        a0 = angle_xz(b.tail - b.head)
        b.rotation_euler.x += math.radians(10)
        update()
        self.sign = 1.0 if wrap180(angle_xz(b.tail - b.head) - a0) > 0 else -1.0
        b.rotation_euler.x -= math.radians(10)
        update()

    def turn(self, bone, target_deg):
        pb = self.arm.pose.bones[bone]
        cur = angle_xz(pb.tail - pb.head)
        pb.rotation_euler.x += math.radians(wrap180(target_deg - cur)) * self.sign
        update()

    def solve(self, leg, target, paw=0.0, lower=0.0, absolute=None):
        """`paw` and `lower` add to the paw's and the cannon / hock's world angle
        (degrees): a swinging paw folds and curls instead of staying rigid.
        `absolute` = (a3, a4) gives those world angles directly (tucked legs)."""
        b1, b2, b3, b4 = LEGS[leg]
        pb = self.arm.pose.bones
        r = self.rest[leg]
        a3 = r['a3'] + lower if absolute is None else absolute[0]
        l3 = (pb[b3].tail - pb[b3].head).length
        d3 = Vector((math.cos(math.radians(a3)), 0, math.sin(math.radians(a3))))
        goal = target - d3 * l3                           # where the 2-bone chain must end
        hip = pb[b1].head
        a = (pb[b1].tail - pb[b1].head).length
        b = (pb[b2].tail - pb[b2].head).length
        D = Vector((goal.x - hip.x, 0, goal.z - hip.z))
        d = max(abs(a - b) + 1e-4, min(a + b - 1e-4, D.length))
        theta = math.degrees(math.atan2(D.z, D.x))
        alpha = math.degrees(math.acos(max(-1, min(1, (a * a + d * d - b * b) / (2 * a * d)))))
        self.turn(b1, theta + alpha if leg[0] == 'H' else theta - alpha)     # knee forward, elbow back
        knee = pb[b1].tail
        self.turn(b2, angle_xz(Vector((goal.x - knee.x, 0, goal.z - knee.z))))
        self.turn(b3, a3)
        self.turn(b4, r['a4'] + paw if absolute is None else absolute[1])
        j = pb[b4].head
        return math.hypot(j.x - target.x, j.z - target.z), D.length - (a + b)


SIT_LEAN = 30     # sits lean forward at most this far (degrees) to reach the floor
BEND_SIGN = 1.0   # rotation_euler.x sign for +pitch (pose pitch maps straight to euler x)
TUCK_FOLD = 0.3   # tucked legs: hip-to-heel = thigh - TUCK_FOLD * shin
TAIL_Z = 0.03   # height of a floor tail's centre line; measured from the tail mesh in bake_all


def aim(arm, pb, d, xref=None):
    """Point pose bone `pb` along armature-space `d`, rolled to keep its X axis
    as close to `xref` (the parent's X) as possible, so a chain aimed bone by
    bone doesn't build up twist (which pinches the skinned tail)."""
    M = pb.matrix.copy()
    head = M.translation.copy()
    sc = M.to_scale()
    y = d.normalized()
    x = (xref if xref is not None else M.col[0].to_3d()).copy()
    x = x - y * x.dot(y)
    if x.length < 1e-5:
        x = M.col[0].to_3d() - y * M.col[0].to_3d().dot(y)
    x.normalize()
    z = x.cross(y)
    R = Matrix((x, y, z)).transposed().to_4x4()
    pb.matrix = Matrix.Translation(head) @ R @ Matrix.Diagonal(sc.to_4d())
    update()


BODY_R = 0.12   # half the body's width plus a tail radius; set in bake_all


def _seg_dist2d(p, a, b):
    ab = Vector((b.x - a.x, b.y - a.y))
    ap = Vector((p.x - a.x, p.y - a.y))
    t = max(0.0, min(1.0, ap.dot(ab) / max(ab.length_squared, 1e-9)))
    return (ap - ab * t).length


def lay_tail(arm, tf):
    """Lay the tail along the floor (see tail_floor), blended with its posed
    shape by tf[0]. The tail follows a path on the floor, seen from above: from
    behind the rump, round the rump on a circle just wider than the body, then
    forward along the side - `bend` sets how far round it wraps (x3 degrees:
    40 wraps to the front paws, 18 is a lazy curve). Each bone aims at its point
    along the path, its slope changing only so much per bone so the tail arcs
    down from the rump to the floor instead of folding. Per-bone `offs` turn
    bones off the path (swishes); the last two lift `tip`."""
    w, side, bend, tip = tf[:4]
    offs = list(tf[4:4 + NT]) + [0.0] * NT
    if w <= 1e-3:
        return
    pbs = arm.pose.bones
    rump = pbs['pelvis'].tail.copy()
    f = pbs['chest'].tail - rump
    f = Vector((f.x, f.y, 0)).normalized()             # forward along the body, on the floor
    sv = Vector((-f.y, f.x, 0)) * side                  # toward the side the tail wraps to
    C = Vector((rump.x, rump.y, TAIL_Z))
    R = BODY_R
    A = math.radians(min(150.0, 3.0 * bend))            # how far round the rump it wraps

    def path(a):
        """Point at arc length `a` along the floor path (starts behind the rump)."""
        arc = R * A
        if a <= arc:
            th = a / R
            return C + (-f * math.cos(th) + sv * math.sin(th)) * R
        end_dir = f * math.sin(A) + sv * math.cos(A)   # tangent at the end of the arc
        return C + (-f * math.cos(A) + sv * math.sin(A)) * R + end_dir * (a - arc)

    root = pbs['tail.0'].head.copy()
    drop = max(0.0, root.z - TAIL_Z)
    max_step = math.radians(30)            # most the slope can change from one bone to the next
    elev = None
    xref = pbs['pelvis'].matrix.col[0].to_3d()
    cum = 0.0
    for k in range(NT):
        pb = pbs[f'tail.{k}']
        head, end = pb.head.copy(), pb.tail.copy()
        L = (end - head).length
        cur = (end - head).normalized()
        if elev is None:
            elev = math.asin(max(-1.0, min(1.0, cur.z)))
        cum += L
        tgt = path(max(0.0, cum - 0.8 * drop))
        v = tgt - head
        hk = math.atan2(v.y, v.x) + math.radians(offs[k])
        want = math.atan2(v.z, Vector((v.x, v.y, 0)).length)
        elev = max(elev - max_step, min(elev + max_step, want))
        if head.z - TAIL_Z < 0.25 * L:
            elev = max(elev, -math.asin(min(1.0, max(0.0, head.z - TAIL_Z) / L)))   # not into the floor
        e = elev + math.radians(tip) * max(0.0, (k - (NT - 3)) / 2)
        d = Vector((math.cos(hk) * math.cos(e), math.sin(hk) * math.cos(e), math.sin(e)))
        if w < 1:
            d = (cur * (1 - w) + d * w)
            if d.length < 1e-4:
                d = cur
        aim(arm, pb, d, xref)
        xref = pb.matrix.col[0].to_3d()


def keep_tail_up(arm, margin=0.02):
    """Lift any tail bone that dips below the floor (curl it up from that joint)."""
    for k in range(NT):
        pb = arm.pose.bones[f'tail.{k}']
        for _ in range(24):
            tip = (arm.matrix_world @ pb.matrix @ Vector((0, pb.length, 0))).z
            if tip >= margin:
                break
            e = pb.rotation_euler
            pb.rotation_euler = Euler((e.x - math.radians(5), e.y, e.z), 'XYZ')
            update()


def bake_clip(arm, body, ik, name, keys, ease=None, report=None):
    ease = ease or (lambda u: u)
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.use_nla = False
    arm.animation_data.action = action
    times = [t for t, _ in keys]
    last = 1 + round(times[-1] * FPS)
    worst = 0.0
    for frame in range(1, last + 1):
        t = (frame - 1) / FPS
        i = max(0, min(len(times) - 2, next((k for k in range(len(times) - 1) if t <= times[k + 1] + 1e-6),
                                            len(times) - 2)))
        u = ease(min(1.0, max(0.0, (t - times[i]) / max(times[i + 1] - times[i], 1e-6))))
        pose = lerp_pose(keys[i][1], keys[i + 1][1], u)
        bpy.context.scene.frame_set(frame)
        apply(arm, pose)
        fwd, air = pose.get('_fwd', 0.0), pose.get('_air', 0.0)
        planted = legs_of(pose.get('_plant'))
        feet = pose.get('_feet', {})
        if '_drop' in pose:          # gaits: body height set directly, legs follow by IK
            up = -pose['_drop'] + air
        else:
            set_root(arm, fwd, 0.0)
            update()
            seat = SEAT if pose.get('_seated', 0.0) > 0.5 else None
            up = air - lowest(body, seat)
            if planted and (air < 0 or len(planted) == 4):
                # All four paws planted (or a crouch): start from standing height and
                # let the legs decide; the lowest point would be thrown off by tilts.
                up = air
            if pose.get('_lift'):    # stand tall (arch): raise the body, the legs straighten to reach
                up = pose['_lift']
        set_root(arm, fwd, up)
        update()
        tucks = tuck_weights(pose)

        def solve_tucks():
            # Hind legs folded under a sitting cat: heel under the hip on the
            # floor, hock and paw flat forward; blended from the standing footprint.
            for leg, tw in tucks.items():
                b1, _b2, b3, _b4 = LEGS[leg]
                pbs = arm.pose.bones
                r = ik.rest[leg]
                dx, dz, paw, lower = (tuple(feet.get(leg, ())) + (0.0, 0.0, 0.0, 0.0))[:4]
                stand = r['joint'] + Vector((fwd + dx, 0, dz))
                l3 = (pbs[b3].tail - pbs[b3].head).length
                hip = pbs[b1].head
                # The long thigh (the haunch) lies forward along the floor, the
                # shin drops back down to the heel: heel this far from the hip.
                la = (pbs[b1].tail - pbs[b1].head).length
                lb = (pbs[LEGS[leg][1]].tail - pbs[LEGS[leg][1]].head).length
                D = max(abs(la - lb) + 0.01, min(la + lb - 0.01, la - TUCK_FOLD * lb))
                hz = hip.z - r['joint'].z
                tuck = Vector((hip.x + math.sqrt(max(0.0, D * D - hz * hz)) + l3 * 0.97, r['joint'].y, r['joint'].z))
                ik.solve(leg, stand.lerp(tuck, tw), absolute=(
                    (r['a3'] + lower) * (1 - tw) + 3 * tw, (r['a4'] + paw) * (1 - tw) - 2 * tw))
        if tucks:
            solve_tucks()
        if planted:

            def solve_all():
                solve_tucks()
                worst_, short = 0.0, {}
                for leg in planted:
                    dx, dz, paw, lower = (tuple(feet.get(leg, ())) + (0.0, 0.0, 0.0, 0.0))[:4]
                    tgt = ik.rest[leg]['joint'] + Vector((fwd + dx, 0, dz))
                    res, deficit = ik.solve(leg, tgt, paw, lower)
                    if dz < 0.01:            # only paws on the floor count (raised ones may not reach)
                        worst_ = max(worst_, res)
                        short[leg] = deficit
                return worst_, short
            err, short = solve_all()
            root_pitch = pose.get('root', (0, 0, 0))[0]
            prev = None
            for _ in range(20):
                front = max([short.get(k, -1) for k in ('FL', 'FR')])
                hind = max([short.get(k, -1) for k in ('HL', 'HR')])
                worst_short = max(front, hind)
                # Close enough to read as on the floor, or no longer improving: stop.
                if worst_short <= 0.008 or (prev is not None and worst_short > prev - 0.0002):
                    break
                prev = worst_short
                seated = pose.get('_seated', 0.0) > 0.5
                if '_drop' in pose:                 # gaits: just lower the body onto the short leg
                    up -= max(front, hind, 0.0)
                elif not seated:
                    rb = arm.pose.bones['root']
                    has_f = any(k in planted for k in ('FL', 'FR'))
                    has_h = any(k in planted for k in ('HL', 'HR'))
                    if has_f and has_h and front > 0 and hind > 0:
                        # Both ends short (standing tall): lower by the smaller gap and
                        # tip toward the shorter end, so all four legs end up straight.
                        up -= min(front, hind)
                        root_pitch -= math.degrees(math.atan2(front - hind, 0.5))
                        rb.rotation_euler = Euler((math.radians(root_pitch), rb.rotation_euler.y,
                                                   rb.rotation_euler.z), 'XYZ')
                    else:
                        up -= max(front, hind)      # one end short: lower the body onto it
                else:
                    # Sitting, front paws short: lean forward onto them. Bisect the
                    # body's pitch so the front paws just reach with the rump seated.
                    rb = arm.pose.bones['root']

                    def seated_at(pitch):
                        rb.rotation_euler = Euler((math.radians(pitch), rb.rotation_euler.y,
                                                   rb.rotation_euler.z), 'XYZ')
                        set_root(arm, fwd, 0.0)
                        update()
                        u_ = air - lowest(body, SEAT)
                        set_root(arm, fwd, u_)
                        update()
                        e_, sh_ = solve_all()
                        return u_, e_, sh_, max([sh_.get(k, -1) for k in ('FL', 'FR')])
                    # Lean forward at most SIT_LEAN degrees (more and it stops reading
                    # as a sit); past that, round the back instead: the chest bends
                    # down to the paws and the neck lifts the head back level
                    # (long-bodied and short-legged builds).
                    lo, hi = root_pitch - SIT_LEAN, root_pitch
                    if seated_at(lo)[3] > 0.004:
                        hi = lo
                        ch, nk = arm.pose.bones['chest'], arm.pose.bones['neck']
                        cx, nx = ch.rotation_euler.x, nk.rotation_euler.x

                        def bend(deg):
                            ch.rotation_euler.x = cx + math.radians(deg) * BEND_SIGN
                            nk.rotation_euler.x = nx - math.radians(deg) * BEND_SIGN
                            return seated_at(lo)[3]
                        a_, b_ = 0.0, -40.0
                        for _b in range(12):
                            m_ = (a_ + b_) / 2
                            if bend(m_) > 0.004:
                                a_ = m_
                            else:
                                b_ = m_
                        bend(b_)
                    for _b in range(12):
                        mid = (lo + hi) / 2
                        if seated_at(mid)[3] > 0.004:
                            hi = mid
                        else:
                            lo = mid
                    root_pitch = lo
                    up, err, short, _f = seated_at(lo)
                    break
                set_root(arm, fwd, up)
                update()
                err, short = solve_all()
            # Fallback: if a planted paw is still short, lower the body until it
            # reaches (lowering never makes a planted paw shorter, so this converges).
            for _ in range(8):
                gap = max([v for v in short.values()] + [0.0])
                if gap <= 0.008 or pose.get('_seated', 0.0) > 0.5:
                    break
                up -= gap
                set_root(arm, fwd, up)
                update()
                err, short = solve_all()
            worst = max(worst, err)
        tf = pose.get('_tf')
        if tf:
            lay_tail(arm, tf)
        if not tf or tf[0] < 0.99:
            keep_tail_up(arm)
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_euler', frame=frame)
            pb.keyframe_insert('scale', frame=frame)
        arm.pose.bones['root'].keyframe_insert('location', frame=frame)
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    arm.animation_data.action = None
    arm.animation_data.use_nla = True
    apply(arm, {})
    set_root(arm, 0, 0)
    if report is not None:
        report[name] = worst


def bake_all(arm, body, only=None):
    # Blender's default scene is 24 fps; the clips are keyed at FPS. Without this
    # every clip exported 25% slow (a 0.3 s sit played in 0.42 s).
    bpy.context.scene.render.fps = FPS
    bpy.context.scene.render.fps_base = 1.0
    global TAIL_Z
    # A floor tail's centre line sits one tail radius up (the 'long' tail, mid-length).
    tail = bpy.data.objects.get('tail_long')
    if tail:
        apply(arm, {})
        set_root(arm, 0, 0)
        update()
        pb = arm.pose.bones['tail.4']
        a, b = pb.head, pb.tail
        g = tail.vertex_groups.get('tail.4')
        ds = [((v.co - a) - (b - a).normalized() * (v.co - a).dot((b - a).normalized())).length
              for v in tail.data.vertices if g and any(x.group == g.index and x.weight > 0.6 for x in v.groups)]
        if ds:
            TAIL_Z = 0.85 * sum(ds) / len(ds)
    SEAT[:] = [v.index for v in body.data.vertices
               if v.groups and body.vertex_groups[max(v.groups, key=lambda g: g.weight).group].name
               in ('pelvis', 'spine_breath')]
    global BODY_R
    BODY_R = 1.05 * max(abs(v.co.y) for v in body.data.vertices) + TAIL_Z
    ik = IK(arm)
    report = {}
    for name, keys, _loop, ease in CLIPS:
        if only and name not in only:
            continue
        bake_clip(arm, body, ik, name, keys, ease, report)
    # Self-check: worst distance of a planted paw from its target, in body lengths.
    print('PLANT', ' '.join(f'{k}={v:.3f}' for k, v in report.items()))


# --------------------------------------------------------------------------
# The clip list (at the end: some clips are sampled from functions that use
# the blending helpers above).

CLIPS = [
    # name, keys, loop, ease
    ('idle', fn_clip(idle_fn, 4.0, 60), True, None),
    ('walk', fn_clip(walk_fn, 1.0), True, None),
    ('trot', fn_clip(trot_fn, 0.56), True, None),
    ('run', fn_clip(run_fn, 0.44, 13), True, None),
    ('sneak', fn_clip(sneak_fn, 1.5), True, None),

    ('sit', [(0, STAND), (0.3, SIT)], False, snap),
    ('sit_idle', fn_clip(sit_idle_fn, 4.0, 60), True, None),
    ('sit_to_stand', [(0, SIT), (0.25, STAND)], False, snap),
    ('slow_blink', fn_clip(slow_blink_fn, 2.0, 30), False, None),
    ('head_tilt', fn_clip(head_tilt_fn, 2.0, 40), False, None),
    ('paw_swipe', fn_clip(paw_swipe_fn, 1.3, 39), False, None),

    ('loaf', [(0, STAND), (0.16, merge(CROUCH, {'_scale': {'upperarm.*': 0.7, 'thigh.*': 0.7}, '_plant': []})),
              (0.36, LOAF)], False, snap),
    ('loaf_idle', fn_clip(loaf_idle_fn, 6.0, 90), True, None),
    ('loaf_to_stand', [(0, LOAF), (0.14, merge(CROUCH, {'_scale': {'upperarm.*': 0.7, 'thigh.*': 0.7}, '_plant': []})),
                       (0.32, STAND)], False, snap),

    ('lie_down', [(0, STAND), (0.15, merge(SIT, {'root': (20, 0, 0)})), (0.4, LIE)], False, snap),
    ('lie_idle', fn_clip(lie_idle_fn, 4.0, 60), True, None),
    ('knead_lie', fn_clip(knead_lie_fn, 1.6, 32), True, None),
    ('lie_to_stand', [(0, LIE), (0.3, STAND)], False, snap),

    ('sleep', [(0, LOAF), (0.3, merge(LOAF, {'_blink': 0.6})), (0.9, SLEEP)], False, smooth),
    ('sleep_idle', fn_clip(sleep_idle_fn, 6.0, 72), True, None),
    ('wake', wake_keys(), False, smooth),

    ('flop', [(0, LIE), (0.35, FLOP)], False, snap),
    ('flop_idle', fn_clip(flop_idle_fn, 4.0, 60), True, None),

    ('stretch', [(0, STAND), (0.35, STRETCH_FRONT), (0.8, merge(STRETCH_FRONT, {'_feet': {'FL': (0.34, 0, -16), 'FR': (0.36, 0, -16)}})),
                 (1.2, STRETCH_FRONT), (1.5, STRETCH_BACK), (2.1, STRETCH_BACK), (2.45, STAND)], False, smooth),
    ('groom', fn_clip(groom_fn, 1.4, 42), True, None),
    ('knead', fn_clip(knead_fn, 1.6, 48), True, None),
    ('scratch_ear', fn_clip(scratch_fn, 0.56, 34), True, smooth),
    ('wiggle', wiggle_keys(0.0, 1.4, CROUCH), True, smooth),
    ('pounce', fn_clip(pounce_fn, 2.3, 69), False, None),
    ('jump', jump_keys(), False, smooth),
    ('arch', [(0, STAND), (0.22, ARCH), (1.6, ARCH), (1.9, STAND)], False, snap),
] + [(name, fn_clip(lambda t, fn=fn: merge(STAND, fn(t)), secs, max(12, int(secs * FPS))), loop, None)
     for name, (fn, secs, loop) in TAIL_MOVES.items()]
LOOPING = [name for name, _k, loop, _e in CLIPS if loop]
