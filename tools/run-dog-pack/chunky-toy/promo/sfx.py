"""Synthesize the trailer's sound effects from the cues the page recorded.

    python3 promo/sfx.py promo/out/events.json promo/out/sfx.wav [promo/out/music.wav [music gain]]

Woofs (big and small), yips, paw patters, a thud for the play-dead slam, a whoosh for
the spin, pops for captions, a squeaky-toy honk, a boop, a heart chime and a growing
slide whistle. Pass a music bed (promo/music.py) to lay it underneath.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(9)


def env(n, attack=0.003, decay=0.08):
    t = np.arange(n) / SR
    return np.clip(t / attack, 0, 1) * np.exp(-t / decay)


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def tone(freq, dur, decay, partials=((1, 1.0),), sweep=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + sweep * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return sum(a * np.sin(k * ph) for k, a in partials) * env(n, decay=decay)


def mixs(*xs):
    n = max(len(x) for x in xs)
    return sum(np.pad(x, (0, n - len(x))) for x in xs)


def woof(pitch=1.0):
    """A cartoon bark: a buzzy voiced burst whose pitch jumps up and falls, through two
    vowel-ish formants, with a breathy attack."""
    dur = 0.22 / pitch ** 0.3
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = pitch * (210 + 120 * np.exp(-((t - 0.03) / 0.04) ** 2) - 90 * t / dur)
    ph = 2 * np.pi * np.cumsum(f0) / SR
    buzz = np.sign(np.sin(ph)) * 0.5 + np.sin(ph)
    voiced = lp(buzz, 1800 * pitch) - 0.6 * lp(buzz, 350 * pitch)
    shape = np.clip(t / 0.012, 0, 1) * np.exp(-((t - 0.05) / (0.09 / pitch ** 0.3)) ** 2 * 0.8)
    breath = (rng.standard_normal(n)) * np.exp(-t / 0.02) * 0.3
    return 0.9 * (voiced * shape + lp(breath, 3000)) / max(1e-6, np.abs(voiced).max())


def yip():
    return woof(1.9) * 0.8


def patter():  # little paw steps
    return mixs(*[np.pad(0.25 * tone(600 + rng.uniform(-80, 80), 0.04, 0.008), (int(k * 0.07 * SR), 0)) for k in range(4)])


def thud():
    return mixs(1.1 * tone(90, 0.35, 0.08, ((1, 1), (2.1, 0.3)), sweep=-0.4), 0.5 * lp(rng.standard_normal(int(0.15 * SR)), 700) * env(int(0.15 * SR), decay=0.03))


def whoosh():
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    sweep = np.sin(np.pi * t / 0.7) ** 2
    return 0.5 * (lp(noise, 2500) - lp(noise, 400)) * sweep


def pop():
    return 0.5 * tone(520, 0.12, 0.04, sweep=1.5)


def squeak():  # a squeaky toy: two quick honks
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    one = np.sin(2 * np.pi * np.cumsum(900 + 500 * np.sin(np.pi * t / 0.16)) / SR) * np.sin(np.pi * t / 0.16)
    return 0.35 * np.concatenate([one, np.zeros(int(0.05 * SR)), one])


def boop():
    return 0.55 * tone(380, 0.18, 0.06, ((1, 1), (2, 0.2)), sweep=0.8)


def chime():
    notes = [np.pad(tone(f, 0.9, 0.35, ((1, 1), (2, 0.3))), (int(d * SR), 0)) for f, d in ((784, 0), (988, 0.08), (1175, 0.16), (1568, 0.24))]
    return 0.45 * mixs(*notes)


def grow():  # a rising slide whistle
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    f = 400 * 2 ** (t / 1.6 * 1.5)
    return 0.22 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(t / 0.05, 0, 1) * np.clip((1.6 - t) / 0.1, 0, 1)


def ball():  # a tennis ball bounce
    return mixs(0.6 * tone(240, 0.12, 0.03, ((1, 1), (2.4, 0.4))), 0.2 * lp(rng.standard_normal(int(0.05 * SR)), 2500) * env(int(0.05 * SR), decay=0.01))


def zip_():  # a quick swap
    return 0.25 * tone(700, 0.09, 0.05, ((1, 1), (2, 0.3)), sweep=1.2)


# the mix: how loud each kind of cue sits against the score
MIX = {"grow": 0.45, "yip": 0.55, "chime": 0.6, "thud": 0.8, "zip": 0.7, "pop": 0.8}

SOUNDS = {"woof": woof, "bigwoof": lambda: woof(0.75), "yip": yip, "patter": patter, "thud": thud, "whoosh": whoosh,
          "pop": pop, "squeak": squeak, "boop": boop, "chime": chime, "grow": grow, "ball": ball, "zip": zip_}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    total = data["total"] + 1.0
    mix = np.zeros(int(total * SR))
    for e in data["events"]:
        snd = SOUNDS.get(e["type"])
        if not snd:
            continue
        x = snd() * e.get("gain", 1.0) * MIX.get(e["type"], 1.0)
        i = int(e["t"] * SR)
        j = min(len(mix), i + len(x))
        mix[i:j] += x[: j - i]
    mix = 0.8 * np.tanh(mix / 0.8)
    if len(sys.argv) > 3:
        with wave.open(sys.argv[3]) as w:
            bed = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32767.0
        bed = bed[: len(mix)] * (float(sys.argv[4]) if len(sys.argv) > 4 else 0.45)
        mix[: len(bed)] += bed
    mix /= max(1.0, np.abs(mix).max() / 0.9)
    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("wrote", dst, len(data["events"]), "cues")


if __name__ == "__main__":
    main()
