"""A clean, modern bed for the trailer: plucky synth, claps, soft sub, 120 BPM.

    python3 promo/music.py promo/out/music.wav [seconds]

Four-chord loop in A major (A  F#m  D  E), a plucked arpeggio, a warm pad, a
sub bass on the downbeats, claps on 2 and 4, a soft hat on the off-beats, and a
little lift every 8 bars. The intro (first 4 s) is just the pluck; the drums
drop in with the stampede.
"""
import sys
import wave

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(5)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.004, d=0.25, s=0.0, r=0.03):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / a) * (s + (1 - s) * np.exp(-t / d))
    k = int(r * SR)
    if 0 < k < n:
        e[-k:] *= np.linspace(1, 0, k)
    return e


def pluck(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    # a bright square-ish pluck that closes quickly (like a filtered synth pluck)
    bright = np.exp(-t * 14)
    x = np.sin(ph) + bright * (0.45 * np.sin(3 * ph) + 0.25 * np.sin(5 * ph)) + 0.2 * np.sin(2 * ph)
    return 0.16 * x * env(n, a=0.002, d=0.22)


def pad(fs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in fs:
        for det in (-0.004, 0.004):
            out += np.sin(2 * np.pi * f * (1 + det) * t) + 0.15 * np.sin(4 * np.pi * f * (1 + det) * t)
    a = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.3)
    return 0.025 * out * a


def sub(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f_ = f * (1 + 0.6 * np.exp(-t * 40))
    return 0.42 * np.sin(2 * np.pi * np.cumsum(f_) / SR) * env(n, a=0.003, d=0.35, s=0.25, r=0.05)


def clap(dur=0.25):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))       # brighter
    e = np.zeros(n)
    for k, o in enumerate((0, 0.009, 0.018)):   # three quick hits = a clap
        i = int(o * SR)
        e[i:] += np.exp(-(t[: n - i]) / (0.012 if k < 2 else 0.07))
    return 0.16 * x * e


def hat(dur=0.06):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    return 0.05 * x * np.exp(-t / 0.012)


def kick(dur=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


CHORDS = [  # (root midi, chord tones)
    (45, [57, 61, 64, 69]),   # A
    (42, [54, 57, 61, 66]),   # F#m
    (38, [50, 54, 57, 62]),   # D
    (40, [52, 56, 59, 64]),   # E
]


def render(seconds):
    n = int(seconds * SR) + SR
    out = np.zeros(n)

    def add(x, t):
        i = int(t * SR)
        if i >= n:
            return
        x = x[: n - i]
        out[i: i + len(x)] += x

    bar = 4 * BEAT
    nbars = int(np.ceil(seconds / bar))
    for b in range(nbars):
        t0 = b * bar
        root, tones = CHORDS[b % 4]
        drums = t0 >= 4.0
        end = t0 >= seconds - 2 * bar           # last bars: thinner, then the sting
        add(pad([midi(x) for x in tones[:3]], bar), t0)
        # arpeggio in 8ths: up and down the chord, an octave up every other bar
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for k, ix in enumerate(pattern):
            note = tones[ix] + 12 * (b % 2 == 1 and k % 4 == 3)
            add(pluck(midi(note + 12), BEAT * 0.5), t0 + k * BEAT / 2)
        if drums and not end:
            add(sub(midi(root - 12), BEAT * 1.5), t0)
            add(sub(midi(root - 12), BEAT * 0.9), t0 + 2.5 * BEAT)
            add(kick(), t0)
            add(kick(), t0 + 2 * BEAT)
            for k in (1, 3):
                add(clap(), t0 + k * BEAT)
            for k in range(4):
                add(hat(), t0 + k * BEAT + BEAT / 2)
            if b % 8 == 7:                        # a lift into every 8th bar
                for k in range(4):
                    add(clap(0.15) * 0.6, t0 + 3 * BEAT + k * BEAT / 4)
    # final sting: A major chord pluck stack
    t_end = seconds - 1.5
    for k, m in enumerate([69, 73, 76, 81]):
        add(pluck(midi(m), 1.4) * 1.4, t_end + k * 0.03)
    add(sub(midi(33), 1.2), t_end)
    # fade the very end
    fade = int(0.5 * SR)
    e = int(seconds * SR)
    out[e - fade: e] *= np.linspace(1, 0, fade)
    out[e:] = 0
    peak = np.max(np.abs(out)) or 1
    return (out[: int(seconds * SR)] / peak * 0.85)


def write(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == '__main__':
    path = sys.argv[1]
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else 54
    write(path, render(secs))
    print('wrote', path, secs, 's')
