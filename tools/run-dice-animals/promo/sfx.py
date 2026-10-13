"""Synthesize the promo's sound track from the cues the page recorded.

    python3 promo/sfx.py promo/out/events.json promo/out/sfx.wav [promo/out/music.wav [music gain]]

Every cue is a little procedural sound: wooden clacks and ticks for dice on
a board, a thud and a squish for landings, a button click, a gate whirr and
clank, a spring boing, a chime, a pop, a spin whir, a fan hum. Pass a music bed
(from promo/music.py) to lay it underneath at a lower level.
"""
import json
import sys
import wave

import numpy as np

SR = 48000
rng = np.random.default_rng(3)


def env(n, attack=0.002, decay=0.08):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-t / decay)


def tone(freq, dur, decay, partials=((1, 1.0),), sweep=0.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + sweep * t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = sum(a * np.sin(k * ph) for k, a in partials)
    return out * env(n, decay=decay)


def noise(dur, decay, lo=200, hi=6000):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    # a crude band-pass: difference of two one-pole smoothers
    def smooth(x, fc):
        a = np.exp(-2 * np.pi * fc / SR)
        y = np.zeros_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        return y
    return (smooth(x, hi) - smooth(x, lo)) * env(n, decay=decay)


def mixs(*xs):
    """Add sounds of different lengths (shorter ones padded with silence)."""
    n = max(len(x) for x in xs)
    return sum(np.pad(x, (0, n - len(x))) for x in xs)


def clack():  # a die face hitting a wooden board
    return mixs(0.9 * tone(900 + rng.uniform(-120, 120), 0.12, 0.018, ((1, 1), (2.7, 0.5), (5.1, 0.25))), 0.5 * noise(0.06, 0.01, 800, 7000))


def tick():
    return 0.6 * tone(1500 + rng.uniform(-200, 200), 0.06, 0.01, ((1, 1), (3.1, 0.4)))


def thud():
    return mixs(1.0 * tone(110, 0.3, 0.07, ((1, 1), (2.1, 0.3)), sweep=-0.4), 0.4 * noise(0.12, 0.03, 60, 900))


def squish():
    return 0.5 * tone(260, 0.32, 0.12, ((1, 1), (1.5, 0.4)), sweep=-0.6)


def click():
    return mixs(0.8 * tone(1800, 0.05, 0.008, ((1, 1), (2, 0.6))), tone(600, 0.08, 0.02))


def gate():  # a little motor whirr
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 120 + 60 * t
    w = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.15
    return w * np.clip(t / 0.05, 0, 1) * np.clip((0.5 - t) / 0.1, 0, 1)


def clank():
    return 0.7 * tone(420, 0.6, 0.18, ((1, 1), (2.76, 0.6), (5.4, 0.35), (8.9, 0.2)))


def chime():
    notes = [np.pad(tone(f, 0.9, 0.35, ((1, 1), (2, 0.3))), (int(d * SR), 0)) for f, d in ((1046, 0), (1318, 0.08), (1568, 0.16))]
    return 0.5 * mixs(*notes)


def pop():
    return 0.6 * tone(500, 0.12, 0.04, sweep=1.5)


def boing():
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    f = 180 + 260 * np.exp(-t * 6) + 25 * np.sin(2 * np.pi * 9 * t)
    return 0.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, decay=0.25)


def whir():
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    f = 300 + 500 * t
    return 0.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 1.2) ** 2


def hum():
    n = int(4.0 * SR)
    t = np.arange(n) / SR
    x = 0.08 * np.sin(2 * np.pi * 95 * t) + 0.04 * np.sin(2 * np.pi * 190 * t)
    return x * np.clip(t / 0.3, 0, 1) * np.clip((4.0 - t) / 0.5, 0, 1)


SOUNDS = {"clack": clack, "tick": tick, "thud": thud, "squish": squish, "click": click, "gate": gate, "clank": clank,
          "chime": chime, "pop": pop, "boing": boing, "whir": whir, "hum": hum}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    total = data["total"] + 1.0
    mix = np.zeros(int(total * SR))
    for e in data["events"]:
        snd = SOUNDS.get(e["type"])
        if not snd:
            continue
        x = snd() * e.get("gain", 1.0)
        i = int(e["t"] * SR)
        j = min(len(mix), i + len(x))
        mix[i:j] += x[: j - i]
    mix = 0.8 * np.tanh(mix / 0.8)  # soft-limit pile-ups (the throw's clacks) so they don't push the whole track down
    if len(sys.argv) > 3:  # the music bed, under the cues
        with wave.open(sys.argv[3]) as w:
            bed = np.frombuffer(w.readframes(w.getnframes()), np.int16) / 32767.0
        bed = bed[: len(mix)] * (float(sys.argv[4]) if len(sys.argv) > 4 else 0.45)
        mix[: len(bed)] += bed
    mix /= max(1.0, np.abs(mix).max() / 0.9)
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", dst, len(data["events"]), "cues")


if __name__ == "__main__":
    main()
