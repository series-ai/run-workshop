"""Synthesize the trailer's sound effects from the cues the page recorded, and mix them over the music.

    python3 promo/sfx.py promo/out/events.json promo/out/mix.wav [promo/out/music.wav [music gain]]

Every cue is a small procedural sound: a pop when feet come out, a boing, a clay tok when a pot lands, leaf rustles,
pitter-patter feet, a sneaker squeak, a whoosh, water sploshes and a dog-shake, a chime, chalk on a slate, a clock
tick, a horror sting, a crowd of tiny panicked squeaks, a protest, and the hiss of a spray bottle. `music:*` cues are
for promo/music.py and are skipped here.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(3)


def env(n, a=0.002, d=0.08):
    t = np.arange(n) / SR
    return np.clip(t / a, 0, 1) * np.exp(-t / d)


def sweep(f0, f1, dur, d=0.1, shape=1.0):
    n = int(dur * SR)
    u = (np.arange(n) / n) ** shape
    f = f0 + (f1 - f0) * u
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, d=d)


def noise(dur, d, lo=200, hi=6000):
    n = int(dur * SR)
    x = rng.standard_normal(n)

    def smooth(x, fc):
        a = np.exp(-2 * np.pi * fc / SR)
        y = np.zeros_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = a * acc + (1 - a) * x[i]
            y[i] = acc
        return y

    return (smooth(x, hi) - smooth(x, lo)) * env(n, a=0.003, d=d)


def pop():
    return 0.5 * sweep(500, 1400, 0.09, d=0.03)


def boing():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 220 + 160 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 5) + 120 * t
    return 0.35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, a=0.004, d=0.18)


def tok():
    x = sweep(320, 180, 0.12, d=0.03)
    x[: int(0.05 * SR)] += 0.4 * noise(0.05, 0.01, 800, 4000)
    return 0.6 * x


def rustle():
    return 0.35 * noise(0.35, 0.12, 1500, 8000)


def patter():
    out = np.zeros(int(1.6 * SR))
    for k in range(14):
        x = 0.3 * sweep(900 + 200 * rng.random(), 600, 0.04, d=0.012)
        i = int(k * 0.11 * SR + rng.integers(0, 600))
        out[i : i + len(x)] += x
    return out


def squeak():
    return 0.3 * sweep(1800, 2600, 0.18, d=0.12)


def whoosh():
    n = int(0.5 * SR)
    x = noise(0.5, 0.5, 300, 3000)
    return 0.6 * x * np.sin(np.linspace(0, np.pi, n))


def splash():
    out = 0.4 * noise(0.5, 0.18, 400, 6000)
    for k in range(8):
        x = 0.15 * sweep(1200 + 900 * rng.random(), 400, 0.06, d=0.02)
        i = int(rng.random() * 0.3 * SR)
        out[i : i + len(x)] += x
    return out


def shake():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    x = noise(0.9, 0.9, 500, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 14 * t)) * np.sin(np.linspace(0, np.pi, n))
    return 0.6 * x


def chime():
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((1047, 1), (1568, 0.6), (2093, 0.4)))
    return 0.25 * out * env(n, d=0.6)


def chalk():
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    x = noise(0.6, 0.6, 2000, 9000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 6 * t)))
    return 0.35 * x * np.minimum(1, (0.6 - t) / 0.1)


def tick():
    x = 0.5 * noise(0.04, 0.008, 2000, 8000)
    x[: int(0.03 * SR)] += 0.2 * sweep(2400, 2400, 0.03, d=0.005)
    return x


def sting():
    # a horror-movie stab: a cluster of detuned saws and a low boom
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in (220, 233, 311, 330, 466):
        ph = 2 * np.pi * f * t
        out += sum(np.sin(k * ph) / k for k in range(1, 7))
    boom = np.sin(2 * np.pi * np.cumsum(45 + 60 * np.exp(-t * 8)) / SR)
    return 0.12 * out * env(n, a=0.005, d=0.7) + 0.7 * boom * env(n, d=0.5)


def panic():
    out = np.zeros(int(1.8 * SR))
    for k in range(18):
        x = 0.16 * sweep(1400 + 1200 * rng.random(), 2600 + 1200 * rng.random(), 0.12, d=0.08)
        i = int(rng.random() * 1.6 * SR)
        out[i : i + len(x)] += x
    return out


def protest():
    out = np.zeros(int(1.4 * SR))
    for k in range(5):
        x = 0.25 * sweep(700, 1100 + 200 * (k % 2), 0.16, d=0.1)
        i = int(k * 0.24 * SR)
        out[i : i + len(x)] += x
    return out


def spray():
    n = int(0.4 * SR)
    x = noise(0.4, 0.4, 3000, 10000)
    return 0.5 * x * np.minimum(1, np.arange(n) / (0.02 * SR)) * np.linspace(1, 0.2, n)


SOUNDS = {k: v for k, v in globals().items() if callable(v) and k not in ('env', 'sweep', 'noise', 'main')}


def main():
    ev = json.load(open(sys.argv[1]))
    total = ev['total']
    buf = np.zeros(int((total + 2) * SR))
    cache = {}
    for e in ev['events']:
        kind = e['type']
        if kind.startswith('music:') or kind not in SOUNDS:
            continue
        if kind not in cache:
            cache[kind] = SOUNDS[kind]()
        x = cache[kind] * e['gain']
        i = int(e['t'] * SR)
        j = min(len(buf), i + len(x))
        buf[i:j] += x[: j - i]
    if len(sys.argv) > 3:
        g = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
        with wave.open(sys.argv[3]) as w:
            m = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32767
        n = min(len(buf), len(m))
        buf[:n] += g * m[:n]
    buf = buf[: int((total + 0.3) * SR)]
    buf /= max(1.0, np.max(np.abs(buf)) / 0.95)
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((buf * 32767).astype(np.int16).tobytes())


if __name__ == '__main__':
    main()
