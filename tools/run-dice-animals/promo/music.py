"""A jazzy little bed for the promo: a swing combo at 120 BPM in F, synthesized.

    python3 promo/music.py promo/out/music.wav [seconds]

Walking upright bass, an electric piano comping on the off-beats, brushes and a
swung ride, and a vibraphone tune that comes in after the intro. I–vi–ii–V
(Fmaj7 Dm7 Gm7 C7), with a little turnaround and a final sting.
"""
import sys
import wave

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM
SWING = 0.64  # the off-beat lands at 64% of the beat
rng = np.random.default_rng(11)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def adsr(n, a=0.005, d=0.2, s=0.0, r=0.05, sustain_time=None):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / a) * (s + (1 - s) * np.exp(-t / d))
    rel = int(r * SR)
    if rel and n > rel:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def bass_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f_ = f * (1 + 0.01 * np.exp(-t * 30))  # a little pitch thump on the pluck
    ph = 2 * np.pi * np.cumsum(f_) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    return 0.55 * x * adsr(n, a=0.004, d=0.35, s=0.25, r=0.04)


def epiano(fs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f in fs:
        ph = 2 * np.pi * f * t
        tine = np.sin(7 * ph) * np.exp(-t * 18) * 0.15
        out += (np.sin(ph) + 0.35 * np.sin(2 * ph) * np.exp(-t * 4) + tine) * adsr(n, a=0.003, d=0.5, s=0.15, r=0.06)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 5 * t)
    return 0.12 * out * trem


def vibes(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.25 * np.sin(4 * ph) * np.exp(-t * 9)
    return 0.22 * x * adsr(n, a=0.002, d=0.7, s=0.0, r=0.1) * (1 + 0.25 * np.sin(2 * np.pi * 6 * t))


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def ride(gain=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hp = noise - onepole_lp(noise, 5000)
    ping = sum(np.sin(2 * np.pi * f * t) for f in (3150, 4270, 5340)) * 0.12
    return 0.11 * gain * (hp * 0.5 + ping) * np.exp(-t * 7)


def hat_foot():
    n = int(0.06 * SR)
    noise = rng.standard_normal(n)
    hp = noise - onepole_lp(noise, 6000)
    return 0.05 * hp * np.exp(-np.arange(n) / SR * 60)


def brush():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    bp = onepole_lp(noise, 3500) - onepole_lp(noise, 600)
    return 0.12 * bp * np.sin(np.pi * t / 0.22) ** 1.5


def kick():
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return 0.35 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)


# chords (bar by bar) as root + voicing (midi), and walking-bass lines
F, Dm, Gm, C7 = 0, 1, 2, 3
VOICING = {F: [57, 60, 64, 69], Dm: [57, 60, 65, 69], Gm: [58, 62, 65, 69], C7: [58, 62, 64, 69]}  # rootless-ish, around middle C
WALK = {F: [41, 45, 48, 49], Dm: [50, 48, 45, 44], Gm: [43, 46, 50, 52], C7: [48, 46, 45, 42]}  # four quarter notes per bar


def put(mix, x, t):
    i = int(t * SR)
    if i >= len(mix):
        return
    j = min(len(mix), i + len(x))
    mix[i:j] += x[: j - i]


def swung(beat_pos):
    """Time (in beats) of a swung eighth: 0, 0.5 -> 0, SWING."""
    whole = np.floor(beat_pos)
    frac = beat_pos - whole
    return whole + (SWING if abs(frac - 0.5) < 1e-6 else frac)


# the tune: (bar, beat, midi, length in beats); comes in at bar 2, loops every 4 bars
TUNE = [(0, 0.5, 72, 0.5), (0, 1, 74, 0.5), (0, 1.5, 76, 0.5), (0, 2, 77, 1), (0, 3.5, 76, 0.5),
        (1, 0, 74, 1.5), (1, 2, 69, 0.5), (1, 2.5, 72, 1.5),
        (2, 0.5, 70, 0.5), (2, 1, 72, 0.5), (2, 1.5, 74, 0.5), (2, 2, 77, 1), (2, 3, 76, 0.5), (2, 3.5, 74, 0.5),
        (3, 0, 72, 1), (3, 1.5, 70, 0.5), (3, 2, 69, 2)]


def main():
    dst = sys.argv[1]
    total = float(sys.argv[2]) if len(sys.argv) > 2 else 44.0
    bars = int(np.ceil(total / (4 * BEAT)))
    mix = np.zeros(int((total + 3) * SR))
    prog = [F, Dm, Gm, C7]
    for b in range(bars):
        chord = prog[b % 4]
        t0 = b * 4 * BEAT
        full = b >= 1          # the intro bar: just bass, ride and hats
        last = b == bars - 1
        if last:  # the sting: a big F6/9 hit and a rising vibes run
            put(mix, bass_note(midi(41), 2.5), t0)
            put(mix, epiano([midi(n) for n in (57, 62, 67, 69, 74)], 2.5) * 1.4, t0)
            for k, n in enumerate((72, 74, 77, 81, 84)):
                put(mix, vibes(midi(n), 1.2), t0 + k * 0.12)
            put(mix, kick(), t0)
            put(mix, ride(1.6), t0)
            break
        for q in range(4):  # walking bass
            put(mix, bass_note(midi(WALK[chord][q]), BEAT * 0.95), t0 + q * BEAT)
        for pos in (0, 1, 1.5, 2, 3, 3.5):  # the ride: ding, ding-da, ding, ding-da
            put(mix, ride(1.0 if pos == int(pos) else 0.7), t0 + swung(pos) * BEAT)
        for q in (1, 3):
            put(mix, hat_foot(), t0 + q * BEAT)
            if full:
                put(mix, brush(), t0 + q * BEAT)
        if full:
            put(mix, kick() * 0.7, t0)
            for pos in ((1.5, 0.45), (3.5, 0.45)) if b % 2 == 0 else ((0.5, 0.4), (2.5, 0.5)):  # piano comps, swung, short
                put(mix, epiano([midi(n) for n in VOICING[chord]], pos[1] * BEAT * 2), t0 + swung(pos[0]) * BEAT)
        if b >= 2:  # the tune
            for (bb, beat, n, ln) in TUNE:
                if bb == (b - 2) % 4:
                    put(mix, vibes(midi(n), ln * BEAT + 0.3), t0 + swung(beat) * BEAT)
    mix = mix[: int((total + 2.5) * SR)]
    mix /= max(1e-9, np.abs(mix).max() / 0.85)
    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("wrote", dst, f"{bars} bars at {BPM} BPM")


if __name__ == "__main__":
    main()
