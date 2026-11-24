"""The trailer score: an over-the-top movie-trailer parody, synthesized. 120 BPM.

    python3 promo/music.py promo/out/music.wav promo/out/events.json

The page lists what every bar is (events.json "sections"), so the score follows the cut:
  drone     dusk: a sub drone, a dark pad and a ticking string ostinato (D minor)
  braam     the same, with a huge low BRAAM on the downbeat (timpani roll into it)
  title     a record scratch, a beat of nothing, then an orchestra hit and the theme's pickup
  theme     the cheeky theme in F: tuba oom-pah, marching snare, pizzicato off-beats,
            a brassy tune doubled on glockenspiel
  theme_up  the same a whole step up (the shameless key change)
  bang      a timpani hit and an orchestra stab on beat 3 (the play-dead slam), then air
  sad       a sad trombone, alone
  sneak     tiptoe: pizzicato and glockenspiel only (the hydrant gag)
  sweet     soft: glockenspiel tune, pizzicato and a warm pad
  finale    the theme at full tilt, crash cymbals on every bar
  end       the last BRAAM and a big major chord
"""
import json
import sys
import wave

import numpy as np

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(4)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.004, d=0.3, s=0.0, r=0.04):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * (s + (1 - s) * np.exp(-t / d))
    rel = int(r * SR)
    if rel and n > rel:
        e[-rel:] *= np.linspace(1, 0, rel)
    return e


def lp(x, fc):
    """One-pole low-pass; fc may be an array (a sweep)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def saw(f, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    return 2 * (((f * (1 + detune)) * t + phase) % 1.0) - 1


def supersaw(f, n, voices=5, spread=0.012):
    return sum(saw(f, n, spread * (k - voices // 2) / voices, rng.random()) for k in range(voices)) / voices


# ------------------------------------------------------------------ instruments
def braam(dur=2.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = sum(supersaw(midi(m), n) * g for m, g in ((26, 1.0), (38, 0.9), (45, 0.6), (50, 0.5)))
    cut = 180 + 1600 * np.exp(-((t - 0.35) / 0.45) ** 2) + 300 * np.exp(-t * 2)
    y = lp(lp(x, cut), cut)
    return 0.6 * y * env(n, a=0.06, d=1.4, s=0.0, r=0.3) + 0.4 * np.sin(2 * np.pi * midi(26) * t) * env(n, a=0.02, d=1.5)


def timpani(f=midi(38), gain=1.0):
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.08 * np.exp(-t * 12))) / SR
    body = np.sin(ph) + 0.4 * np.sin(1.5 * ph) + 0.2 * np.sin(2 * ph)
    noise = lp(rng.standard_normal(n), 900) * np.exp(-t * 30)
    return 0.6 * gain * (body * np.exp(-t * 3.5) + noise)


def roll(dur, gain=0.5):  # timpani roll, swelling
    out = np.zeros(int(dur * SR) + SR)
    k = 0
    while k * 0.05 < dur:
        g = gain * (0.25 + 0.75 * (k * 0.05 / dur))
        x = timpani(midi(38), g)[: int(0.3 * SR)]
        i = int(k * 0.05 * SR)
        out[i:i + len(x)] += x
        k += 1
    return out


def drone(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sub = 0.35 * np.sin(2 * np.pi * midi(26) * t)
    pad = lp(supersaw(midi(38), n, 4) * 0.5 + supersaw(midi(45), n, 4) * 0.4, 420)
    return (sub + 0.5 * pad) * np.clip(t / 0.3, 0, 1)


def pluck(f, dur=0.18, gain=0.2, bright=2500):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp(saw(f, n), bright * np.exp(-t * 14) + 150)
    return gain * x * env(n, a=0.002, d=0.08)


def tuba(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = lp(saw(f, n) + 0.5 * np.sin(2 * np.pi * f * t), 600 + 400 * np.exp(-t * 10))
    return 0.95 * x * env(n, a=0.015, d=0.25, s=0.3, r=0.04)


def brass(f, dur, gain=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.25, 0, 1)
    ph = np.cumsum(f * vib) / SR
    x = sum((2 * ((ph * (1 + d) + rng.random()) % 1.0) - 1) for d in (-0.004, 0, 0.004)) / 3
    cut = 900 + 2200 * np.clip(t / 0.06, 0, 1) * np.exp(-t * 2)
    return gain * lp(x, cut) * env(n, a=0.025, d=0.5, s=0.6, r=0.05)


def stab(fs, gain=0.5):  # orchestra hit
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    x = sum(supersaw(f, n, 3) for f in fs) / len(fs)
    return gain * lp(x, 3500 * np.exp(-t * 5) + 300) * env(n, a=0.003, d=0.18) + 0.5 * gain * timpani(fs[0], 0.6)[:n]


def glock(f, dur=0.5, gain=0.14):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return gain * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 4.2 * f * t) * np.exp(-t * 12)) * np.exp(-t * 3.5)


def snare(gain=1.0):
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    return 0.22 * gain * ((lp(noise, 4500) - lp(noise, 1200)) * np.exp(-t * 20) + 0.8 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30))


def kick(gain=1.0):
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    return 0.5 * gain * np.sin(2 * np.pi * np.cumsum(48 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 11)


def crash(gain=1.0):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    return 0.12 * gain * (lp(noise, 9000) - lp(noise, 2500)) * np.exp(-t * 2.2)


def riser(dur):  # a reversed-cymbal swell into a downbeat
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    return 0.22 * (lp(noise, 8000) - lp(noise, 1500)) * (t / dur) ** 2.5


def fill(t0, beats, mix, gain=1.0):  # a snare fill: 16ths, getting louder, ending on the next downbeat
    k = int(beats * 4)
    for i in range(k):
        put(mix, snare(gain * (0.35 + 0.65 * i / k)), t0 + i * BEAT / 4)


def scratch():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    rate = 1 + 0.9 * np.sin(2 * np.pi * 3.2 * t)  # the record speeds up and backs up
    ph = np.cumsum(rate) / SR
    tone_ = np.sin(2 * np.pi * 300 * ph * 3) * 0.5 + rng.standard_normal(n) * 0.5
    return 0.6 * lp(tone_, 2500 * np.abs(rate) + 300) * np.sin(np.pi * t / 0.45)


def sad_trombone():  # wah wah wah waaaah
    out = []
    for k, (m, d) in enumerate(((58, 0.42), (57, 0.42), (56, 0.42), (55, 1.4))):
        n = int(d * SR)
        t = np.arange(n) / SR
        wob = 1 + (0.012 * np.sin(2 * np.pi * 6 * t) if k == 3 else 0) - 0.01 * t
        ph = np.cumsum(midi(m) * wob) / SR
        x = sum((2 * ((ph * (1 + dd)) % 1.0) - 1) for dd in (-0.003, 0.003)) / 2
        mute = 700 + 1300 * (0.5 + 0.5 * np.sin(np.pi * np.clip(t / d, 0, 1)))  # the plunger: wah
        out.append(0.35 * lp(x, mute) * env(n, a=0.03, d=0.6, s=0.7, r=0.08))
    return np.concatenate(out)


# the theme: (bar, beat, semitone above F4, beats); chords per bar for the oom-pah and pizz
THEME = [(0, 0, 0, 0.5), (0, 0.5, 2, 0.5), (0, 1, 4, 1), (0, 2, 7, 0.75), (0, 2.75, 5, 0.25), (0, 3, 4, 1),
         (1, 0, 2, 0.5), (1, 0.5, 4, 0.5), (1, 1, 5, 1), (1, 2, 9, 1.5), (1, 3.5, 7, 0.5),
         (2, 0, 12, 0.75), (2, 0.75, 11, 0.25), (2, 1, 9, 0.5), (2, 1.5, 7, 0.5), (2, 2, 5, 0.5), (2, 2.5, 4, 0.5), (2, 3, 2, 1),
         (3, 0, 7, 0.5), (3, 0.5, 7, 0.5), (3, 1, 9, 0.5), (3, 1.5, 11, 0.5), (3, 2, 12, 2)]
CHORDS = [(0, (0, 4, 7)), (5, (5, 9, 12)), (-2, (-2, 2, 5)), (7, (7, 11, 14))]   # F  Bb  Gm/Bb  C7-ish (semitones from F)
F4 = 65


def put(mix, x, t):
    i = int(t * SR)
    if i < 0 or i >= len(mix):
        return
    j = min(len(mix), i + len(x))
    mix[i:j] += x[: j - i]


def theme_bar(mix, t0, k, up=0, full=False, soft=False, pad=True):
    root, triad = CHORDS[k % 4]
    if not soft:
        for q in range(4):   # oom-pah
            if q % 2 == 0:
                put(mix, tuba(midi(F4 - 24 + root + up), BEAT * 0.8), t0 + q * BEAT)
                put(mix, kick(0.9), t0 + q * BEAT)
            else:
                put(mix, tuba(midi(F4 - 24 + root + 7 + up), BEAT * 0.6) * 0.7, t0 + q * BEAT)
                put(mix, snare(), t0 + q * BEAT)
        for e in range(8):   # marching snare ghost notes
            put(mix, snare(0.12), t0 + e * BEAT / 2 + BEAT / 4)
    for q in range(4):       # pizzicato on the off-beats
        for s in triad:
            put(mix, pluck(midi(F4 - 12 + s + up), gain=0.14 if soft else 0.16, bright=1600), t0 + q * BEAT + BEAT / 2)
    for (bb, beat, semi, ln) in THEME:
        if bb == k % 4:
            f = midi(F4 + semi + up)
            if not soft:
                put(mix, brass(f, ln * BEAT * 0.95, 0.7 if full else 0.55), t0 + beat * BEAT)
                if full:
                    put(mix, brass(f / 2, ln * BEAT * 0.95, 0.35), t0 + beat * BEAT)
            put(mix, glock(f * 2, gain=0.16 if soft else 0.1), t0 + beat * BEAT)
    if soft and pad:
        n = int(BAR * SR)
        pad = lp(sum(supersaw(midi(F4 - 12 + s + up), n, 3) for s in triad) / 3, 700) * 0.12
        put(mix, pad * np.clip(np.arange(n) / SR / 0.3, 0, 1), t0)
    if full:
        put(mix, crash(1.0), t0)


def main():
    dst, ev = sys.argv[1], json.load(open(sys.argv[2]))
    sections = ev["sections"]
    total = len(sections) * BAR
    mix = np.zeros(int((total + 4) * SR))
    k = 0   # theme bar counter (so the tune carries across shots)
    for b, sec in enumerate(sections):
        t0 = b * BAR
        if sec in ("drone", "braam"):
            put(mix, drone(BAR) * 0.8, t0)
            for e in range(8):   # the ticking ostinato, getting busier
                put(mix, pluck(midi(50 if e % 2 else 62), 0.12, 0.08 + 0.02 * b), t0 + e * BEAT / 2)
            if sec == "braam":
                put(mix, braam(), t0)
            if b + 1 < len(sections) and sections[b + 1] == "braam":
                put(mix, roll(BEAT * 1.5, 0.35), t0 + BAR - BEAT * 1.5)
        elif sec == "title":
            put(mix, scratch(), t0)
            put(mix, stab([midi(n) for n in (41, 53, 57, 60, 65)], 0.8), t0 + BEAT * 2)
            put(mix, crash(1.2), t0 + BEAT * 2)
            for q, semi in enumerate((7, 9, 11)):   # pickup into the theme
                put(mix, brass(midi(F4 + semi - 12), BEAT * 0.45), t0 + BEAT * (2.5 + q * 0.5))
        elif sec in ("theme", "theme_up", "finale"):
            theme_bar(mix, t0, k, up=2 if sec == "theme_up" else (2 if sec == "finale" else 0), full=sec == "finale")
            if k % 4 == 0 and sec != "finale":
                put(mix, crash(0.7), t0)
            k += 1
        elif sec == "sneak":
            theme_bar(mix, t0, k, soft=True, pad=False)
            k += 1
        elif sec == "sweet":
            theme_bar(mix, t0, k, soft=True)
            k += 1
        elif sec == "bang":
            theme_bar(mix, t0, k, up=0)
            put(mix, timpani(midi(38), 1.6), t0 + BEAT * 2)
            put(mix, stab([midi(n) for n in (38, 50, 53, 57)], 0.9), t0 + BEAT * 2)
            k += 1
        elif sec == "sad":
            put(mix, sad_trombone(), t0 + BEAT * 0.25)
        elif sec == "end":
            put(mix, braam(3.0) * 0.9, t0)
            put(mix, stab([midi(n) for n in (43, 55, 59, 62, 67)], 0.9), t0)   # G major: up from the key change
            put(mix, crash(1.5), t0)
            for q, n in enumerate((79, 83, 86, 91)):
                put(mix, glock(midi(n), 1.5, 0.16), t0 + 0.08 * q)
    # transitions: wherever the music changes character, lead into it (a riser or a snare
    # fill on the bar before) and land it (a crash on the downbeat), so cuts never just stop
    FAMILY = {"drone": "dark", "braam": "dark", "title": "hit", "theme": "band", "theme_up": "band", "finale": "band",
              "bang": "band", "sad": "gag", "sneak": "soft", "sweet": "soft", "end": "end"}
    for b in range(1, len(sections)):
        a, c = FAMILY[sections[b - 1]], FAMILY[sections[b]]
        if a == c and sections[b - 1] == sections[b]:
            continue
        t0 = b * BAR
        if c == "hit" or (a == "dark" and c != "dark"):
            put(mix, riser(BEAT * 1.5), t0 - BEAT * 1.5)
        elif c == "band" and a in ("soft", "gag"):
            fill(t0 - BEAT, 1, mix, 1.1)
            put(mix, crash(0.9), t0)
        elif c == "band" and sections[b] != sections[b - 1]:   # theme -> theme_up, theme_up -> finale
            fill(t0 - BEAT * 0.5, 0.5, mix, 0.9)
            put(mix, crash(0.8), t0)
        elif c == "soft" and a == "band":
            put(mix, glock(midi(F4 + 24), 1.0, 0.12), t0)
        elif c == "end":
            fill(t0 - BEAT, 1, mix, 1.2)
            put(mix, riser(BEAT), t0 - BEAT)
    mix = mix[: int((total + 3) * SR)]
    mix /= max(1e-9, np.abs(mix).max() / 0.88)
    mix = 0.9 * np.tanh(mix / 0.9)
    with wave.open(dst, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print("wrote", dst, len(sections), "bars:", " ".join(sections))


if __name__ == "__main__":
    main()
