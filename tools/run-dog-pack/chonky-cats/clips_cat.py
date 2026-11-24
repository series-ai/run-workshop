"""The Chonky Cats clips: the Chonky Hounds rig and clip machinery (../chunky-toy/clips_lib.py)
with a cat clip set, authored on the Moggy and played by every cat body through dogclips.js.

rig.py loads this instead of clips_lib when CLIPS_MODULE=clips_cat (see rig_all.sh). It
reuses the Hounds' IK, gaits and pose states (sit, down, comfy, roll over, stretch, sniff)
and replaces the dog-only clips (fetch, barks, potty, begging, dancing) with cat ones.

Cats carry their tails up: every cat body's tail is rigged in its own sculpted (raised)
pose, and clip rotations are relative to it, so lift 0 keeps each cat's own carriage.

New clips are pose to pose (see .claude/skills/procedural-animation): `strike()` hits each
key on its time with a fast start, a small overshoot and a hold; airborne stretches are
ballistic parabolas; nothing performs on a sine.

Axes as in clips_lib: R(X, +a) tips the front down (nose down, leg back, tail lifts),
R(Y, +a) rolls the top to the cat's left, R(Z, +a) turns the nose to its left.
"""
import math
import os
import sys

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'chunky-toy'))
import clips_lib as base  # noqa: E402
from clips_lib import (CANTER, DIAG, GALLOP, LEGS, POSES, WALK4, X, Y, Z, R, clamp01, down_pose,  # noqa: E402
                       ease, enter_exit, front_paw, gait, leg_bones, pose_tail, sit_pose, wave)

FPS = base.FPS
BACK_UP = 0.0   # set by rig.py, handed to clips_lib in author()


# ---------------------------------------------------------------- pose-to-pose helpers
def strike(T, keys, dur=0.15, over=0.08):
    """Value at time T for keys [(time, value), ...]: holds each value, then moves to the
    next so it arrives ON the key's time. The move takes `dur` (at least 4 frames), gets up to
    speed over its first ~third (a full-speed start pops: 70% of a 3-frame move landed in its
    first frame), lands `over` past the target and settles back."""
    dur = max(dur, 4 / FPS)
    val = keys[0][1]
    prev_t = keys[0][0]
    for t1, b in keys[1:]:
        a = val
        t0 = max(prev_t, t1 - dur)
        if T < t0:
            return val
        if T < t1:
            x = (T - t0) / (t1 - t0)
            return a + (b - a) * (1 + over) * (1 - (1 - x) ** 3) * ease(min(1.0, x / 0.3))
        k = T - t1
        settle = math.exp(-k / (0.4 * dur))
        val = b + (b - a) * over * settle
        if over:   # a fully settled value starts the next stroke
            val = b if settle < 0.02 else val
        prev_t = t1
    return val


def arc(T, t0, t1, h):
    """Ballistic hop height: a parabola from t0 to t1 peaking at h (constant gravity)."""
    if T <= t0 or T >= t1:
        return 0.0
    s = (T - t0) / (t1 - t0)
    return 4 * h * s * (1 - s)


def tail_wag(p, t, amount, cycles, lift=0.0, lag=0.12):
    """clips_lib.tail_wag for cats (install() swaps it in, so the reused dog pose clips use it
    too). Cat tails are rigged raised, so lying or sitting lowers them by 75-80 degrees: put
    all of that on tail.1 and the soft root twists into spikes on the rump. The lift is
    spread down the chain instead (half at the root), the same as the tail stress test."""
    p.brot('tail.1', (X, 0.5 * lift), (Z, 0.5 * amount * wave(t, cycles)))
    p.brot('tail.2', (X, 0.3 * lift), (Z, 0.6 * amount * wave(t, cycles, -lag)))
    p.brot('tail.3', (X, 0.2 * lift), (Z, 0.7 * amount * wave(t, cycles, -2 * lag)))


def pupils(p, v):
    """Pupil size, 0 slit .. 1 round: the dilate bone's x scale (dogclips.js turns it into the
    eyes' dilate shape key). Calm and sleepy cats narrow them; hunting, playing and scared cats open
    them wide."""
    p.scale['dilate'] = (1.0 + v, 1.0, 1.0)


def pupils_extra(v):
    def extra(p, t, tc):
        pupils(p, v)
    return extra


def cat_tail(p, lift=0.0, curl=0.0, side=0.0):
    """Tail carriage on top of the sculpted pose: lift at the base, curl at the tip (the
    question-mark hook), swing to the side."""
    p.brot('tail.1', (X, lift), (Z, side))
    p.brot('tail.2', (X, 0.4 * curl))
    p.brot('tail.3', (X, curl))


TAIL = ('tail.1', 'tail.2', 'tail.3')


def swish(p, T, curve, amps=(0.45, 0.8, 1.0), lag=2 / FPS, axis=Z, period=None):
    """Motion down the tail: each bone follows the one before it `lag` later (two frames:
    overlap, not rubber) and swings further toward the tip. axis Z swings it side to side,
    X lifts it. `period` wraps the lagged times so loops stay seamless."""
    for k, b in enumerate(TAIL):
        tt = T - k * lag
        if period:
            tt %= period
        p.brot(b, (axis, amps[k] * curve(tt)))


def tail_extra(lift, curl, sway=0.0, cycles=1, bob=0.0):
    """A gait `extra`: tail carriage, swaying with the stride. The base leads and each bone
    follows a little later, so the tail swings in an S rather than as a stick; `bob` lifts
    the tip with each footfall."""
    def extra(p, t, tc):
        cat_tail(p, lift, curl)
        for k, b in enumerate(TAIL):
            p.brot(b, (Z, (0.45, 0.8, 1.0)[k] * sway * wave(tc, cycles, -0.1 - 0.09 * k)),
                   (X, (0.2, 0.5, 1.0)[k] * bob * wave(tc, 2 * cycles, -0.15 - 0.06 * k)))
    return extra


def both(*fns):
    def extra(p, t, tc):
        for f in fns:
            f(p, t, tc)
    return extra


def head_bob(amount, per_cycle=2):
    def extra(p, t, tc):
        p.rot('neck', (X, amount * wave(tc, per_cycle)))
        p.rot('head', (X, -amount * 0.7 * wave(tc, per_cycle)))
    return extra


def stream(p, t, tc):
    """Running: the spine flexes with the stride and the tail streams out behind."""
    flex = wave(tc, 1, 0.15)
    p.rot('spine', (X, -9 * flex))
    p.rot('chest', (X, 7 * flex))
    p.rot('neck', (X, 22 + 6 * wave(tc, 1, 0.2)))
    p.rot('head', (X, -16 - 4 * wave(tc, 1, 0.1)))
    cat_tail(p, -45 + 8 * flex, -10)
    for k, b in enumerate(TAIL):   # the tail lashes up and down behind the stride
        p.brot(b, (X, (0.3, 0.7, 1.0)[k] * 12 * wave(tc, 1, -0.2 - 0.1 * k)))


# ---------------------------------------------------------------- gaits (in place)
# Cats walk low and smooth with the tail up and the tip hooked; they trot rarely, and run
# in a bounding gallop with the tail streaming back.
GAITS = {
    'walk': (1.0, 1, dict(phases=WALK4, duty=0.64, stride=0.55, lift=0.15, crouch=0.06, bounce=0.03,
                          paw_curl=55, tail=0, extra=both(head_bob(2), tail_extra(8, 28, 18, bob=5), pupils_extra(0.15)))),
    'trot': (0.5, 1, dict(phases=DIAG, duty=0.44, stride=0.7, lift=0.26, crouch=0.07, bounce=0.04,
                          flight=0.06, paw_curl=70, tail=0, extra=both(head_bob(3), tail_extra(5, 22, 16, bob=6), pupils_extra(0.3)))),
    'run': (0.42, 1, dict(phases=CANTER, duty=0.34, stride=1.0, lift=0.3, crouch=0.12, bounce=0.0,
                          bounce_per_cycle=1, flight=0.1, tail=4, front_lift=0.8, extra=both(stream, pupils_extra(0.6)))),
    'gallop': (0.34, 1, dict(phases=GALLOP, duty=0.24, stride=1.45, lift=0.38, crouch=0.15, bounce=0.0,
                             bounce_per_cycle=1, flight=0.17, paw_curl=85, tail=4, front_lift=0.75,
                             extra=both(stream, pupils_extra(0.75)))),
}


# ---------------------------------------------------------------- actions (standing)
def idle(p, t):
    """Stands and looks about: head snaps left, holds, snaps right, holds, back. The tail
    tip flicks twice. 4 s loop."""
    T = t * 4.0
    pupils(p, strike(T, [(0, 0), (2.7, 0.5), (3.45, 0.5), (3.85, 0)], dur=0.3, over=0.0))   # curious glance right
    yaw = strike(T, [(0, 0), (0.7, 22), (1.8, 22), (2.1, 0), (2.7, -18), (3.5, -18), (3.85, 0)], dur=0.18)
    tilt = strike(T, [(0, 0), (0.75, 8), (1.8, 8), (2.1, 0), (3.6, 0)], dur=0.2, over=0.05)
    p.rot('neck', (Z, 0.35 * yaw))
    p.rot('head', (Z, 0.65 * yaw), (Y, tilt))
    flick = strike(T, [(0, 0), (1.1, 25), (1.32, -10), (1.54, 0), (3.0, 0), (3.2, -25), (3.42, 10), (3.64, 0)],
                   dur=0.22, over=0.1)   # each flick stroke ~5 frames: the tip whipped 28 degrees in one
    cat_tail(p, 0, 0)   # standing carriage is the sculpted pose in every standing clip (seams)
    swish(p, T, lambda u: strike(u, [(0, 0), (0.9, 22), (1.9, 22), (2.4, -16), (3.4, -16), (3.65, 0)],
                                 dur=0.45, over=0.12), period=4.0)
    p.brot('tail.3', (Z, flick))
    p.brot('tail.2', (Z, 0.3 * flick))
    p.rot('chest', (X, -1.2 * wave(t, 2)))


def meow(p, t):
    """Head up, mouth opens on 'mee', wider on 'ow', closes; the tail lifts. 1.1 s; meow at 0.3."""
    T = t * 1.1
    pupils(p, strike(T, [(0, 0), (0.25, 0.65), (0.8, 0.65), (1.05, 0)], dur=0.2, over=0.0))
    up = strike(T, [(0, 0), (0.22, -16), (0.75, -16), (0.98, 0)], dur=0.15)
    jaw = strike(T, [(0, 0), (0.3, 18), (0.45, 30), (0.68, 30), (0.82, 0)], dur=0.12, over=0.05)
    p.rot('neck', (X, up))
    p.rot('head', (X, 0.5 * up))
    p.rot('chest', (X, 0.15 * up))
    p.rot('jaw', (X, jaw))
    up_t = ease(clamp01(T / 0.3)) * (1 - ease(clamp01((T - 0.8) / 0.3)))
    cat_tail(p, 12 * up_t, 20 * up_t)
    q = up_t * 7 * math.sin(2 * math.pi * 4 * T)          # 4 Hz quiver (6 frames a cycle), tip only
    p.brot('tail.3', (X, q))
    p.brot('tail.2', (X, 0.4 * q))


HISS = dict(spine=-14, chest=24, hips=0, neck=-8, head=14, lift=0.0, puff=0.45)   # lift: cat legs stand
# nearly straight, so any root lift pulls the feet off the floor (0.14: 4-6.5 cm; 0.04: 1-1.5 cm)


def hiss(p, t, k=None):
    """The Halloween cat: snaps up into an arched back on stiff legs, tail and body fur
    puffed, a hiss with the mouth wide, a held tremble, then lets it go. 2.4 s; hiss at 0.45."""
    T = t * 2.4
    pupils(p, strike(T, [(0, 0), (0.15, 1.0), (1.85, 1.0), (2.3, 0)], dur=0.12, over=0.0))   # wide: scared and cross
    arch = strike(T, [(0, 0), (0.15, 1), (1.8, 1), (2.1, 0)], dur=0.15, over=0.06)
    puff = strike(T, [(0, 0), (0.3, 1), (1.75, 1), (2.05, 0)], dur=0.2, over=0.1)   # inside the tail_line window
    shake = 1.2 * math.sin(2 * math.pi * 4 * T) * clamp01((T - 0.25) / 0.1) * (1 - clamp01((T - 1.7) / 0.1))
    k = k or HISS
    p.root(0, -0.03 * arch, k['lift'] * arch)         # up on stiff legs, leaning back
    p.rot('hips', (X, k['hips'] * arch))
    p.rot('spine', (X, k['spine'] * arch))            # the back humps up...
    p.rot('chest', (X, k['chest'] * arch), (Y, shake))   # ...and the shoulders come back down
    p.rot('neck', (X, k['neck'] * arch))
    hiss_back = strike(T, [(0, 0), (0.45, -10), (1.2, -10), (1.4, 0)], dur=0.12)
    p.rot('head', (X, k['head'] * arch + hiss_back))
    p.rot('jaw', (X, strike(T, [(0, 0), (0.45, 38), (1.15, 38), (1.35, 0)], dur=0.1, over=0.05)))
    for leg in LEGS:
        p.foot(leg, fwd=(0.05 if leg[1] == 'F' else -0.05) * arch)
    s = 1 + k['puff'] * puff
    # The tail goes straight out behind and puffs up. dogclips.js straightens it (meta
    # tail_line, the same as the dogs' point); the puff is a scale on tail.1 only, which
    # tail.2 and tail.3 inherit. Scaling every bone of a curved tail compounded and sheared it
    # (and a puffed chest sheared the neck): with the chain straight, one scale inflates it evenly.
    p.scale['tail.1'] = (s, 1.0, s)


def pounce(p, t):
    """Crouch, bum wiggle, leap forward onto the prey with the front paws reaching, pin it,
    then spring back to the start. 2.6 s; lands at 1.38."""
    T = t * 2.6
    pupils(p, strike(T, [(0, 0), (0.3, 1.0), (1.9, 1.0), (2.5, 0)], dur=0.2, over=0.0))   # hunting: wide from the crouch
    crouch = strike(T, [(0, 0), (0.22, 1), (0.95, 1), (1.02, 0.6), (1.4, 0.35), (1.9, 0.35), (2.05, 0.15),
                        (2.4, 0)], dur=0.14, over=0.05)
    # bum wiggle while crouched: alternate 5-frame strikes, hips rolling side to side
    wig = strike(T, [(0, 0), (0.35, 0), (0.45, 1), (0.6, -1), (0.75, 1), (0.88, 0)], dur=0.1, over=0.0)
    # leap 1.05 -> 1.38 forward 0.7 leg lengths; spring back 2.05 -> 2.3
    LEAP, BACK = 1.3, 1.3
    fwd = LEAP * clamp01((T - 1.05) / 0.33) - BACK * clamp01((T - 2.05) / 0.25)
    hop = arc(T, 1.05, 1.38, 0.4) + arc(T, 2.05, 2.3, 0.15)
    land = math.exp(-(T - 1.38) / 0.06) if T > 1.38 else 0.0
    p.root(0.02 * wig, fwd, -0.24 * crouch + hop - 0.1 * land)
    p.rot('hips', (X, 8 * crouch - 10 * clamp01((T - 1.0) / 0.1) * (1 - clamp01((T - 1.3) / 0.1))),
          (Y, 7 * wig))
    p.rot('chest', (X, 6 * crouch))
    p.rot('neck', (X, -14 * crouch + 26 * strike(T, [(0, 0), (1.4, 1), (1.9, 1), (2.1, 0)], dur=0.12)))
    p.rot('head', (X, 6 * crouch))
    air1 = 1.05 < T < 1.38
    air2 = 2.05 < T < 2.3
    reach = ease(clamp01((T - 1.05) / 0.12)) * (1 - ease(clamp01((T - 1.22) / 0.16)))
    for leg in LEGS:
        front = leg[1] == 'F'
        p.foot(leg, fwd=fwd + (0.08 if front else -0.06) * crouch, up=hop if (air1 or air2) else 0.0)
        if air1:   # front paws reach out and down, hind legs trail
            p.foot(leg, fwd=fwd + (0.35 if front else -0.25) * reach, up=hop + (0.0 if front else 0.12) * reach)
            p.paws[leg] = R((X, (30 if front else -40) * reach))
    cat_tail(p, -30 * crouch + 20 * wig * 0.3, 10 * crouch)
    swish(p, T, lambda u: strike(u, [(0, 0), (0.25, 0), (0.44, 18), (0.64, -18), (0.84, 16), (1.0, 0)],
                                 dur=0.2, over=0.08), amps=(0.35, 0.7, 1.0))   # lash: ~5 frames a stroke
    p.brot('tail.3', (Z, 15 * wig))                   # the tip twitches with the wiggle


# ---------------------------------------------------------------- sitting
def cat_sit_loop(p, t):
    """Sits tall, tail along the floor; the tip flicks; a slow blink of a head tilt. 4 s."""
    T = t * 4.0
    pupils(p, strike(T, [(0, 0), (1.4, 0.4), (2.6, 0.4), (2.9, 0)], dur=0.3, over=0.0))   # with the head tilt
    sit_pose(p, 1)
    p.rot('chest', (X, -1.5 * wave(t, 2)))
    p.rot('head', (Y, strike(T, [(0, 0), (1.4, 9), (2.6, 9), (2.9, 0)], dur=0.2, over=0.05)))
    pose_tail(p, t, 'sit', 'sit', 0, 1)
    swish(p, T, lambda u: strike(u, [(0, 0), (1.0, 24), (1.7, 24), (2.3, -12), (3.2, -12), (3.7, 0)],
                                 dur=0.4, over=0.1), amps=(0.3, 0.7, 1.0), period=4.0)
    p.brot('tail.3', (Z, strike(T, [(0, 0), (0.9, 20), (1.05, 0), (3.2, 0), (3.35, -20), (3.5, 0)],
                                dur=0.13, over=0.1)))


GROOM = dict(up=95, fore=125, wipe_up=25, wipe_fore=-15, paw=60, neck=22, head=10)


def groom(p, t, k=None):
    """From sitting: right paw up to the mouth, three licks, two wipes over the face, paw
    down. 3.2 s."""
    T = t * 3.2
    sit_pose(p, 1)
    # raise and lower over ~8 frames: the paw travels ~120 degrees, and at 0.22 s it dropped 78 in one frame
    w = strike(T, [(0, 0), (0.4, 1), (2.65, 1), (3.0, 0)], dur=0.35, over=0.03)
    wipe = strike(T, [(0, 0), (1.75, 0), (1.95, 1), (2.12, 0), (2.32, 1), (2.5, 0)], dur=0.15, over=0.0)
    k = k or GROOM
    front_paw(p, -1, k['up'] + k['wipe_up'] * wipe, k['fore'] + k['wipe_fore'] * wipe, k['paw'], w)
    lick = strike(T, [(0, 0), (0.45, 0), (0.6, 1), (0.75, 0), (0.92, 1), (1.07, 0), (1.24, 1), (1.4, 0)],
                  dur=0.12, over=0.0)
    p.rot('neck', (X, (k['neck'] + 8 * lick + 6 * wipe) * w))
    p.rot('head', (X, (k['head'] + 10 * lick) * w), (Y, -10 * w), (Z, -12 * w))
    p.rot('jaw', (X, 10 * lick))
    pose_tail(p, t, 'sit', 'sit', 0, 1)
    swish(p, T, lambda u: strike(u, [(0, 0), (0.6, 18), (1.6, 18), (2.3, -10), (2.9, 0)], dur=0.4),
          amps=(0.3, 0.7, 1.0))


BAT = dict(up=95, swing=-30, fore=75, fore_swing=-75, paw=30)   # cocked high, then struck straight out


def bat(p, t, k=None):
    """From sitting: eyes on something, then two quick swipes with the right paw. 1.6 s."""
    T = t * 1.6
    pupils(p, strike(T, [(0, 0), (0.25, 0.9), (1.15, 0.9), (1.5, 0)], dur=0.15, over=0.0))   # play
    sit_pose(p, 1)
    w = strike(T, [(0, 0), (0.25, 1), (1.15, 1), (1.4, 0)], dur=0.13, over=0.05)
    swipe = strike(T, [(0, 0), (0.42, 1), (0.55, 0), (0.72, 1), (0.85, 0)], dur=0.12, over=0.1)
    k = k or BAT
    front_paw(p, -1, k['up'] + k['swing'] * swipe, k['fore'] + k['fore_swing'] * swipe, k['paw'], w)
    # leans into each swipe with the chest only: moving the root pulled the shoulder past the
    # reach of the locked-straight support leg, which snapped 40 degrees in a frame
    p.rot('chest', (X, 4 * swipe * w))
    p.rot('neck', (X, 12 * w))
    p.rot('head', (X, 6 * swipe * w))
    pose_tail(p, t, 'sit', 'sit', 0, 1)
    p.brot('tail.3', (Z, strike(T, [(0, 0), (0.3, 25), (0.45, 0), (0.75, -25), (0.9, 0)], dur=0.12)))


# ---------------------------------------------------------------- lying
def loaf_pose(p, k):
    """The loaf, from standing: the body sinks to the floor while all four legs fold under
    it at once, front paws tucked away under the chest, hind feet drawn in close (no spread),
    tail wrapped along the side."""
    p.root(0, 0, -(base.LIE + 0.05) * k)
    p.rot('hips', (X, -3 * k))
    p.rot('chest', (X, 4 * k))
    for leg in ('LF', 'RF'):
        p.foot(leg, fwd=-0.03 * k, up=0.1 * k)
        p.paws[leg] = R((X, 110 * k))
    for leg, side in (('LH', 1), ('RH', -1)):
        p.foot(leg, fwd=0.3 * k, left=0.03 * side * k, up=0.02 * k)
        p.paws[leg] = R((X, -30 * k))
    p.aim('head', (X, 4 * k))


def loaf_tail(p, t, k):
    tail_wag(p, t, 0, 1, lift=CAT_TAIL_LIFT['loaf'] * k)
    p.brot('tail.1', (Z, 55 * k))


def loaf_loop(p, t):
    """Dozing loaf: the head drifts down, then snaps back up awake, and drifts again; the
    tail tip twitches. 4 s."""
    T = t * 4.0
    loaf_pose(p, 1)
    p.rot('chest', (X, -2 * wave(t, 1)))
    nod = 10 * ease(clamp01(T / 2.4)) if T < 2.6 else strike(T, [(2.6, 10), (2.8, 0)], dur=0.15, over=0.1)
    p.aim('head', (X, 4 + nod))   # the head is aimed in the loaf: a p.rot on it would be ignored
    loaf_tail(p, t, 1)
    swish(p, T, lambda u: strike(u, [(0, 0), (1.2, 0), (1.35, 22), (1.55, 0), (3.0, 0), (3.15, 16), (3.35, 0)],
                                 dur=0.13, over=0.1), amps=(0.0, 0.4, 1.0), period=4.0)


def loaf_enter(p, t):
    k = base.snap(t)
    loaf_pose(p, k)
    loaf_tail(p, t, ease(t))


def loaf_exit(p, t):
    k = 1 - base.snap(t)
    loaf_pose(p, k)
    loaf_tail(p, t, 1 - ease(t))


# ---------------------------------------------------------------- the flop (replaces the dogs' comfy)
def flop_pose(p, k):
    """From lying down, rolls over onto the right side: legs go loose together (no kicked-out
    leg), the head comes down to rest, the tail lies out along the floor."""
    down_pose(p, 1)                                   # feet, body and head as lying down...
    # ...rolled over onto its right side about the spine, which stays low the whole way (a
    # roll round a point on the floor lifts the body mid-roll, as if standing up first) and
    # nearly in place. The root sits on the floor, the spine 1 leg length above it.
    hw = base.DIM['half_w']
    a = math.radians(78 * k)
    spine_h = (1 - base.LIE) * (1 - k) + (hw + 0.05) * k
    p.root(-0.3 * hw * k + math.sin(a), 0, spine_h - math.cos(a), (Y, -78 * k))
    if k < 1e-4:
        return
    # Foot targets turn with the body: solved in the side plane, an underside leg chasing a
    # target fixed to the floor wraps round as the shoulder sinks to it (the right forearm
    # flipped 163 degrees in one frame).
    p.feet_in_root = True
    for leg in LEGS:
        p.blend(leg, (1 - k) ** 2)                    # feet let go of their lying spots early in the roll
        ub, lb, pb = leg_bones(leg)
        front = leg[1] == 'F'
        top = leg[0] == 'L'
        # top legs droop over toward the floor under their own weight; all of them soft-bent,
        # loosely together and a little forward (no stiff legs sticking out)
        # mid-roll the legs fold in (as in the dogs' roll over): straight legs would reach for
        # the floor and prop the body up, as if standing before it flops
        tuck = math.sin(math.pi * k)
        p.rot(ub, (Y, (40 if top else 6) * k), (X, (-30 if front else 22) * k + (-45 if front else -50) * tuck))
        p.rot(lb, (X, (55 if front else -50) * k + (85 if front else 90) * tuck))
        p.rot(pb, (X, 35 * k + 30 * tuck))
    p.rot('neck', (Y, -10 * k), (X, 6 * k))
    p.aim('head', (X, -6), (Y, -8 * k))   # down_pose aims the head, so the rest goes into the aim


def flop_loop(p, t):
    """Flopped out: slow breathing, the tail sweeping lazily along the floor, a paw twitch. 4 s."""
    T = t * 4.0
    flop_pose(p, 1)
    p.rot('chest', (X, -2.5 * wave(t, 1)))
    tail_wag(p, t, 0, 1, lift=CAT_TAIL_LIFT['flop'])
    swish(p, T, flop_swish, amps=(0.3, 0.7, 1.0), period=4.0)
    tw = strike(T, [(0, 0), (2.2, 0), (2.32, 1), (2.5, 0)], dur=0.12, over=0.0)
    p.rot('hand.L', (X, 25 * tw))


def flop_swish(u):
    return 20 * math.sin(2 * math.pi * u / 4.0)


def flop_enter(p, t):
    flop_pose(p, ease(t))   # a roll, not a drop: smooth, like the dogs' comfy
    tail_wag(p, t, 0, 1, lift=CAT_TAIL_LIFT['down'] + (CAT_TAIL_LIFT['flop'] - CAT_TAIL_LIFT['down']) * ease(t))
    swish(p, 0.0, lambda u: ease(t) * flop_swish(u), amps=(0.3, 0.7, 1.0), period=4.0)   # ends on flop_loop's start


def flop_exit(p, t):
    flop_pose(p, 1 - ease(t))
    tail_wag(p, t, 0, 1, lift=CAT_TAIL_LIFT['flop'] + (CAT_TAIL_LIFT['down'] - CAT_TAIL_LIFT['flop']) * ease(t))
    swish(p, 0.0, lambda u: (1 - ease(t)) * flop_swish(u), amps=(0.3, 0.7, 1.0), period=4.0)


def knead(p, t):
    """Sitting up, kneading: the front paws take turns, each one's whole stroke (rise, push
    down and forward with the toes spreading, draw back) inside its half of the second, so
    one paw is always moving and both are at rest on the loop's first frame (it starts and
    ends on the sit pose). The chest rocks onto the pressing side and the head follows a frame
    later; the tail sweeps slowly. A rhythm rather than a performance, so it flows. 2 s, 4 presses."""
    T = t * 2.0
    pupils(p, 0.3)   # content
    sit_pose(p, 1)
    for leg, t0 in (('LF', 0.0), ('RF', 0.5)):
        s_ = ((T - t0) % 1.0) / 0.5                     # 0..1 through this paw's stroke, > 1 resting
        if s_ >= 1:
            continue
        lift = math.sin(math.pi * min(1.0, s_ / 0.6)) ** 1.5 if s_ < 0.6 else 0.0
        press = math.sin(math.pi * (s_ - 0.45) / 0.35) if 0.45 < s_ < 0.8 else 0.0
        reach = 0.5 - 0.5 * math.cos(2 * math.pi * s_)  # forward on the push, back by the end
        p.foot(leg, fwd=0.04 + 0.1 * reach, up=0.24 * lift)
        p.paws[leg] = R((X, 50 * lift - 12 * press))  # paw curls up, toes spread on the push
    rock = math.sin(2 * math.pi * T)                  # onto the left paw, then the right
    p.rot('chest', (Y, 3 * rock), (X, 2.5 * abs(rock)))
    nod = math.sin(2 * math.pi * (T - 1 / FPS))
    p.rot('head', (Y, -2 * nod), (X, 3 * abs(nod)))
    pose_tail(p, t, 'sit', 'sit', 0, 1)
    # sin^3: flat through zero, so the lagged tail bones are still at rest on the first frame
    # (a plain sine left the tip 8 degrees off the sit pose)
    swish(p, T, lambda u: 16 * math.sin(math.pi * u) ** 3, amps=(0.3, 0.7, 1.0), period=2.0)


LOAF_IN, LOAF_OUT = loaf_enter, loaf_exit
# Tail carriage per state (clips_lib.pose_tail reads this). Cat tails are rigged raised, so
# sitting and lying lower them toward the floor (dogclips.js keeps them just above it).
CAT_TAIL_LIFT = {'stand': 0, 'sit': -55, 'down': -115, 'comfy': -115, 'loaf': -115, 'flop': -115}   # lying: well
# down onto the floor (-75 left lying tails sticking out); dogclips.js tailFloor keeps them above it

# ---------------------------------------------------------------- the clip set
KEEP_POSES = ('sit_enter', 'sit_exit', 'down_enter', 'down_loop', 'down_exit', 'roll_over')   # the dogs' comfy
# (rolled on a hip, a leg kicked out) looked odd on cats: the flop replaces it
CAT_POSES = {
    'sit_loop': (4.0, cat_sit_loop, True, 'sit', 'sit'),
    'groom': (3.2, groom, False, 'sit', 'sit'),
    'bat': (1.6, bat, False, 'sit', 'sit'),
    'loaf_enter': (0.75, LOAF_IN, False, 'stand', 'loaf'),
    'loaf_loop': (4.0, loaf_loop, True, 'loaf', 'loaf'),
    'loaf_exit': (0.6, LOAF_OUT, False, 'loaf', 'stand'),
    'flop_enter': (0.9, flop_enter, False, 'down', 'flop'),
    'flop_loop': (4.0, flop_loop, True, 'flop', 'flop'),
    'flop_exit': (0.8, flop_exit, False, 'flop', 'down'),
    'knead': (2.0, knead, True, 'sit', 'sit'),
}
ACTIONS = {
    'idle': (4.0, idle, True, {}),
    'meow': (1.1, meow, False, {'meow': 0.3 / 1.1}),
    'hiss': (2.4, hiss, False, {'hiss': 0.45 / 2.4}),
    'pounce': (2.6, pounce, False, {'land': 1.38 / 2.6}),
    'stretch': base.ACTIONS['stretch'],
    'sniff': base.ACTIONS['sniff'],
}


# Tuning: CAT_VARIANTS=1 adds parameter variants as extra clips (groom_1, bat_2...) to compare
# in the viewer; the chosen values go back into GROOM / BAT / HISS.
# 2026-11-08: a raised groom paw (up 110-130) hides under the big head on every body, so the
# groom licks a paw held under the chin; bat and hiss took their tamest/strongest variants.
VARIANTS = {
    'groom': (GROOM, [dict(up=120, fore=100)]),
    'bat': (BAT, [dict(up=85, swing=-25, fore=60, fore_swing=-55, paw=40)]),
    'hiss': (HISS, [dict(spine=-40, chest=65, lift=0.16, puff=0.12)]),   # folded the chunky bodies into a V
}


def install():
    """Swap the cat clip set into clips_lib, whose author() reads these tables."""
    poses = {k: POSES[k] for k in KEEP_POSES}
    poses.update(CAT_POSES)
    base.GAITS.clear()
    base.GAITS.update(GAITS)
    base.ACTIONS.clear()
    base.ACTIONS.update(ACTIONS)
    base.POSES.clear()
    base.POSES.update(poses)
    base.TAIL_LIFT.update(CAT_TAIL_LIFT)
    base.tail_wag = tail_wag   # pose_tail() and gait() in clips_lib look it up at call time
    base.TAIL_LINE['hiss'] = (0.05, 0.22, 2.05, 2.35)   # tail straight out behind while hissing
    base.LIE_CLIPS = tuple(base.LIE_CLIPS) + ('loaf_', 'flop_')   # lying: dogclips.js fits each cat's belly line
    if os.environ.get('CAT_VARIANTS'):
        fns = {'groom': groom, 'bat': bat, 'hiss': hiss}
        for name, (defaults, vs) in VARIANTS.items():
            for i, v in enumerate(vs, 1):
                k = {**defaults, **v}
                fn = (lambda f, k: lambda p, t: f(p, t, k))(fns[name], k)
                if name in base.POSES:
                    secs, _, loop, a, b = base.POSES[name]
                    base.POSES[f'{name}_{i}'] = (secs, fn, loop, a, b)
                else:
                    secs, _, loop, ev = base.ACTIONS[name]
                    base.ACTIONS[f'{name}_{i}'] = (secs, fn, loop, ev)


def author(arm, leg_length, only=None):
    install()
    base.BACK_UP = BACK_UP
    meta = base.author(arm, leg_length, only)
    for name in meta:   # standing one-shots: start and end standing
        if name.startswith(('pounce', 'hiss', 'meow')):
            meta[name].update({'from': 'stand', 'to': 'stand'})
    return meta
