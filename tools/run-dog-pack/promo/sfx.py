"""Sound effects for the trailer, from the cues the page recorded, mixed over the music.

    python3 promo/sfx.py promo/out/events.json promo/out/mix.wav [promo/out/music.wav [music gain]]

Cues: tok (ball bounce), whoosh (throw), yip, rumble (stampede paws), skid,
title (soft riser + chime), pop (card), swap (part swap), tick (recolour),
squeak, gasp, shake (wet-dog shake), ding (late corgi), sparkle (title formed).
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(9)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def tok():
    t = t_(0.12)
    return 0.6 * np.sin(2 * np.pi * 520 * t * (1 - 0.3 * t)) * np.exp(-t / 0.025) + 0.15 * noise(0.12) * np.exp(-t / 0.008)


def whoosh():
    t = t_(0.5)
    n = noise(0.5)
    sweep = lp(n, 900) * np.sin(np.pi * t / 0.5) ** 2
    return 0.9 * sweep


def yip():
    t = t_(0.18)
    f = 900 + 500 * np.sin(np.pi * t / 0.18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return 0.35 * (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.sin(np.pi * t / 0.18)


def rumble(dur=3.5):
    """Many little paw pats plus a low rumble."""
    out = np.zeros(int(dur * SR))
    t = t_(dur)
    out += 0.25 * lp(noise(dur), 120) * np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.8)
    for _ in range(int(dur * 60)):
        i = int(rng.uniform(0, dur - 0.05) * SR)
        tt = t_(0.04)
        pat = np.sin(2 * np.pi * rng.uniform(140, 260) * tt) * np.exp(-tt / 0.01)
        out[i: i + len(pat)] += 0.08 * pat
    return out


def skid():
    t = t_(0.45)
    return 0.4 * lp(noise(0.45), 2500) * np.exp(-t / 0.2)


def chime(f=1318.5, dur=1.2, g=0.3):
    t = t_(dur)
    return g * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.2)) * np.exp(-t / 0.5)


def title():
    t = t_(0.6)
    riser = 0.2 * lp(noise(0.6), 3000) * (t / 0.6) ** 2
    out = np.zeros(int(1.6 * SR))
    out[: len(riser)] += riser
    c = chime(1760, 1.0, 0.25) + np.pad(chime(2217, 0.9, 0.18), (0, int(0.1 * SR)))[: int(1.0 * SR)]
    i = int(0.6 * SR)
    out[i: i + len(c)] += c
    return out


def pop():
    t = t_(0.12)
    f = 400 + 900 * np.exp(-t * 40)
    return 0.4 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)


def swap():
    t = t_(0.14)
    f = 700 + 700 * t / 0.14
    return 0.22 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05)


def tick():
    t = t_(0.06)
    return 0.3 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.008)


def squeak():
    t = t_(0.35)
    f = 1500 + 900 * np.sin(2 * np.pi * 3 * t)
    return 0.3 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.35)


def gasp():
    t = t_(0.6)
    f = 520 - 260 * t / 0.6        # a descending "uh-oh" slide
    ph = 2 * np.pi * np.cumsum(f) / SR
    return 0.35 * (np.sin(ph) + 0.3 * np.sin(3 * ph)) * np.sin(np.pi * t / 0.6) ** 0.5


def shake():
    dur = 1.0
    t = t_(dur)
    flap = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 13 * t))
    return 0.35 * lp(noise(dur), 1800) * flap * np.sin(np.pi * t / dur)


def ding():
    return chime(1568, 1.2, 0.35)


def sparkle():
    out = np.zeros(int(1.6 * SR))
    for k, f in enumerate([1760, 2217, 2637, 3520]):
        c = chime(f, 1.0, 0.16)
        i = int(k * 0.08 * SR)
        out[i: i + len(c)] += c
    return out


SOUNDS = dict(tok=tok, whoosh=whoosh, yip=yip, rumble=rumble, skid=skid, title=title, pop=pop, swap=swap,
              tick=tick, squeak=squeak, gasp=gasp, shake=shake, ding=ding, sparkle=sparkle)


def read(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32767


def main():
    ev = json.load(open(sys.argv[1]))
    total = ev['total']
    out = np.zeros(int((total + 2) * SR))
    for e in ev['events']:
        x = SOUNDS[e['type']]() * e.get('gain', 1)
        i = int(e['t'] * SR)
        out[i: i + len(x)] += x[: len(out) - i]
    if len(sys.argv) > 3:
        m = read(sys.argv[3]) * (float(sys.argv[4]) if len(sys.argv) > 4 else 0.5)
        out[: len(m)] += m
    out = out[: int(total * SR)]
    out /= max(1.0, np.max(np.abs(out)) / 0.95)
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())
    print('wrote', sys.argv[2])


if __name__ == '__main__':
    main()
