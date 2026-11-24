"""Curve helpers ported from the bean kit (tools/run-bean-people/kit/rig/clips.py):
pose-to-pose strikes with spring overshoot, pulses, ballistics. See the
procedural-animation skill: snap and holds, never sine-everything."""
import math

pi = math.pi
G = 30.0  # m/s^2: game gravity used across RUN kits


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x, p=2.0):
    return 1 - (1 - clamp(x)) ** p


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


