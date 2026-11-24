"""The Terra Tots trailer score, synthesized and cut to the page's music cues.

    python3 promo/music.py promo/out/events.json promo/out/music.wav

112 BPM in C. Sections start where the page put a `music:<cue>` event:
  intro    marimba alone, a hopeful little vamp
  full     marimba + bass + kick + shaker + a whistled hook
  drop     the dance break: four-on-the-floor, claps, the hook up an octave
  stop     silence (the first aphid)
  strings  horror-movie tremolo strings in A minor, low drum hits, a rising siren
  soft     a music-box lullaby, no drums
  end      full band for the end card, landing on a big ringing C chord
"""
import json
import sys
import wave

import numpy as np

SR = 48000
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(5)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.004, d=0.3, s=0.0, r=0.03):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / a) * (s + (1 - s) * np.exp(-t / d))
    k = int(r * SR)
    if k and n > k:
        e[-k:] *= np.linspace(1, 0, k)
    return e


def marimba(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.3 * np.sin(4 * ph) * np.exp(-t * 30) + 0.12 * np.sin(10 * ph) * np.exp(-t * 60)
    return 0.32 * x * env(n, a=0.002, d=0.28)


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    return 0.5 * (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env(n, a=0.004, d=0.4, s=0.3, r=0.05)


def whistle(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.008 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.15)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    air = rng.standard_normal(n) * 0.04
    return 0.2 * (np.sin(ph) + air) * env(n, a=0.03, d=0.6, s=0.6, r=0.06)


def musicbox(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.4 * np.sin(2.01 * ph) * np.exp(-t * 6) + 0.2 * np.sin(5.4 * ph) * np.exp(-t * 18)
    return 0.16 * x * env(n, a=0.001, d=0.9)


def kick(dur=0.3):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 30)
    return 0.8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)


def hat(dur=0.05, g=0.12):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = np.diff(np.concatenate([[0], x]))
    return g * x * np.exp(-np.arange(n) / SR * 70)


def clap(dur=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    e = sum(np.exp(-np.maximum(0, t - d) * 40) * (t >= d) for d in (0, 0.012, 0.024))
    return 0.25 * x * e


def taiko(dur=0.8):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 55 + 40 * np.exp(-t * 12)
    return 0.9 * (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * rng.standard_normal(n) * np.exp(-t * 30)) * np.exp(-t * 4)


def strings(notes, dur, trem=True):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.11):
            f = midi(m + det * 0.1)
            ph = 2 * np.pi * f * t + rng.uniform(0, 6)
            saw = sum(np.sin(k * ph) / k for k in range(1, 9))
            out += saw
    tr = 0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 7 * t)) if trem else 1
    return 0.05 * out * tr * env(n, a=0.25, d=99, s=1, r=0.2)


# C  Am  F  G, one chord a bar: root notes and triads (MIDI)
PROG = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [53, 57, 60]), (43, [55, 59, 62])]
# the whistled hook: (beat offset in a two-bar phrase, MIDI note, length in beats)
HOOK = [(0, 76, 1), (1, 79, 0.5), (1.5, 81, 0.5), (2, 79, 1), (3, 76, 1), (4, 74, 0.5), (4.5, 76, 0.5), (5, 72, 1.5), (7, 67, 1)]
LULLABY = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 79, 76, 74, 72]


def put(buf, x, t):
    i = int(t * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i]


def render(cues, total):
    buf = np.zeros(int((total + 3) * SR))
    cues = sorted(cues) + [(total, 'fin')]
    for (t0, kind), (t1, _) in zip(cues, cues[1:]):
        b0 = int(np.ceil(t0 / BEAT - 1e-6))
        b1 = int(np.floor(t1 / BEAT - 1e-6))
        if kind == 'strings':
            # tremolo strings in A minor, a low drum on each bar, a siren rising under it
            put(buf, strings([45, 57, 60, 64], t1 - t0 + 0.3), t0)
            for b in range(b0, b1 + 1, 4):
                put(buf, taiko(), b * BEAT)
            n = int((t1 - t0) * SR)
            tt = np.arange(n) / SR
            f = 600 + 500 * (tt / max(1e-3, t1 - t0)) + 60 * np.sin(2 * np.pi * 3 * tt)
            put(buf, 0.04 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, tt / 0.5), t0)
            continue
        if kind == 'stop':
            continue
        for b in range(b0, b1 + 1):
            t = b * BEAT
            bar = b // 4
            root, triad = PROG[bar % 4]
            beat = b % 4
            if kind == 'soft':
                note = LULLABY[(b * 2) % len(LULLABY)]
                put(buf, musicbox(midi(note), 1.4), t)
                put(buf, musicbox(midi(LULLABY[(b * 2 + 1) % len(LULLABY)]), 1.2), t + BEAT / 2)
                if beat == 0:
                    put(buf, 0.6 * bass(midi(root), BAR), t)
                continue
            # marimba: an off-beat vamp on the chord (all sections but stop/strings/soft)
            for k, m in enumerate(triad):
                put(buf, marimba(midi(m + 12), 0.4), t + BEAT / 2 + k * 0.012)
            put(buf, marimba(midi(triad[beat % 3] + 24), 0.3) * 0.6, t)
            if kind == 'intro':
                continue
            put(buf, bass(midi(root), BEAT * 0.9), t)
            if beat in (0, 2) or kind == 'drop':
                put(buf, kick(), t)
            for h in range(2):
                put(buf, hat(g=0.1 if h else 0.06), t + h * BEAT / 2)
            if kind == 'drop' and beat in (1, 3):
                put(buf, clap(), t)
            # the whistled hook, every two bars
            if b % 8 == 0:
                for off, m, ln in HOOK:
                    st = t + off * BEAT
                    if st < t1:
                        put(buf, whistle(midi(m + (12 if kind == 'drop' else 0)), ln * BEAT), st)
        if kind == 'end':
            # the final chord rings out at the end
            for m in (36, 48, 60, 64, 67, 72, 76):
                put(buf, marimba(midi(m), 2.5) * 1.2, t1 - 0.02)
                put(buf, strings([m], 2.4, trem=False) * 0.5, t1 - 0.02)
    peak = np.max(np.abs(buf)) or 1
    return buf / peak * 0.8


def main():
    ev = json.load(open(sys.argv[1]))
    cues = [(e['t'], e['type'].split(':', 1)[1]) for e in ev['events'] if e['type'].startswith('music:')]
    # the end card's chord lands a second before the end, so it rings out under the logo
    total = ev['total']
    x = render(cues, total - 1.0)
    x = x[: int((total + 0.5) * SR)]
    with wave.open(sys.argv[2], 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == '__main__':
    main()
