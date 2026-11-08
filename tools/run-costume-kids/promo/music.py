"""A spooky, high-energy Halloween bed for the trailer, synthesized: 140 BPM in D minor.

    python3 promo/music.py promo/out/music.wav [seconds] [promo/out/events.json]

Dm  Bb  Gm  A (harmonic minor, so the A is major), a bar each. The groove: four-on-the-
floor kick, snare on 2 and 4, sixteenth hats, a pulsing eighth-note bass, a harpsichord
riff in sixteenths doubled by pizzicato, and organ stabs. The Halloween on top: a church
organ under it all, a theremin lead that glides between its notes, a tolling bell, a
thunder rumble on the title, ghostly "ooo" choir swells, and a wolf howl over the street.

The arrangement follows the cut: the page writes the bar each shot starts on into
events.json ("cues"), so moving a shot moves the music with it. One bar = 4 beats =
1.714 s; every hit sits on that grid.
  knock     a ticking clock, a midnight bell, the riff on a soft organ, a low pedal
  title     thunder, a bell, crash, organ chord, theremin swoop; everything drops in
  roll      the theremin melody over the full groove
  skin/faces  ghostly choir swells
  moves     the theremin melody again
  boo       bar 1: drums and bass out, a heartbeat, a riser; bar 2: BOO! crash, bell, stab
  build     the groove, quieter riff (the part snaps are the melody here)
  patrol    a wolf howl, the theremin melody, choir
  brigade   full, with the melody
  end       crash, bell, stab, theremin; then the sting: a held organ chord and a last bell
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 48000
BPM = 140
BEAT = 60 / BPM
BAR = 4 * BEAT
S16 = BEAT / 4
rng = np.random.default_rng(31)

DEFAULT_CUES = {"knock": 0, "title": 2, "roll": 4, "skin": 8, "faces": 10, "moves": 12, "boo": 15, "build": 17,
                "patrol": 20, "brigade": 23, "end": 25, "bars": 27}


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), "high")
    return lfilter(b, a, x)


def lp(x, fc, order=2):
    b, a = butter(order, min(0.99, fc / (SR / 2)), "low")
    return lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return lfilter(b, a, x)


def env(n, a=0.003, d=0.2, s=0.0, r=0.02):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / a) * (s + (1 - s) * np.exp(-t / d))
    k = int(r * SR)
    if 0 < k < n:
        e[-k:] *= np.linspace(1, 0, k)
    return e


# ---------------------------------------------------------------- drums (rendered once, reused)
def kick():
    t = t_(0.32)
    f = 46 + 120 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.25
    return 0.95 * np.tanh(1.8 * (body + click))


def snare():
    t = t_(0.25)
    tone = (np.sin(2 * np.pi * 185 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t / 0.05)
    noise = bp(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t / 0.09)
    return 0.42 * (0.55 * tone + noise)


def hat(open_=False):
    d = 0.22 if open_ else 0.045
    t = t_(d)
    x = hp(rng.standard_normal(len(t)), 7000) * np.exp(-t / (0.07 if open_ else 0.011))
    return 0.14 * x


def crash():
    t = t_(2.2)
    x = hp(rng.standard_normal(len(t)), 4000) * np.exp(-t / 0.7)
    metal = sum(np.sin(2 * np.pi * f * t) for f in (3180, 4630, 5870, 7210)) * 0.04 * np.exp(-t / 0.5)
    return 0.32 * (x + metal)


def tom(f0):
    t = t_(0.3)
    f = f0 * (1 + 0.5 * np.exp(-t * 25))
    return 0.45 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12)


KICK, SNARE, HAT, OHAT, CRASH = kick(), snare(), hat(), hat(True), crash()
TOMS = [tom(f) for f in (180, 140, 110, 85)]


# ---------------------------------------------------------------- pitched voices
def harpsichord(f, dur=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for k in range(1, 14):          # a bright plucked string: many partials, the high ones die first
        x += (1 / k ** 0.9) * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (6 + 2.2 * k))
    x2 = np.zeros(n)                # a second choir, a hair sharp and an octave up, quieter
    for k in range(1, 8):
        x2 += (1 / k) * np.sin(2 * np.pi * 2 * f * 1.002 * k * t) * np.exp(-t * (9 + 3 * k))
    pluck = hp(rng.standard_normal(n), 3000) * np.exp(-t / 0.003) * 0.3
    return 0.11 * (x + 0.35 * x2 + pluck) * env(n, a=0.001, d=10, s=1, r=0.02)


def pizz(f, dur=0.22):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = np.sin(ph) + 0.45 * np.sin(2 * ph) * np.exp(-t * 20) + 0.2 * np.sin(3 * ph) * np.exp(-t * 30)
    return 0.16 * x * env(n, a=0.002, d=0.07, r=0.02)


def bass(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    saw = sum(((-1) ** (k + 1)) / k * np.sin(k * ph) for k in range(1, 12))
    x = lp(saw, 700) + 0.6 * np.sin(ph)
    return 0.32 * np.tanh(1.4 * x) * env(n, a=0.003, d=0.12, s=0.35, r=0.03)


def organ(fs, dur, gain=1.0, attack=0.004, full=False):
    """A tonewheel / church organ: drawbar partials, a rotary wobble; `full` adds the mixture
    ranks (the octave-and-fifth stops) for the big church sound."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    bars = ((0.5, 0.6), (1, 1.0), (1.5, 0.35), (2, 0.7), (3, 0.4), (4, 0.4), (6, 0.25), (8, 0.25)) if full else \
        ((0.5, 0.5), (1, 1.0), (2, 0.6), (3, 0.35), (4, 0.3), (6, 0.15), (8, 0.12))
    x = np.zeros(n)
    for f in fs:
        for k, a in bars:
            x += a * np.sin(2 * np.pi * f * k * t + 0.3 * np.sin(2 * np.pi * 6.2 * t))
    x *= 1 + 0.15 * np.sin(2 * np.pi * 6.8 * t)         # the rotary-speaker wobble
    click = hp(rng.standard_normal(n), 2000) * np.exp(-t / 0.004) * (0.6 if attack < 0.02 else 0)
    return gain * 0.11 * np.tanh(0.6 * (x + click)) * env(n, a=attack, d=10, s=1, r=min(0.3, dur * 0.4))


def theremin(path, dur, gain=1.0):
    """A sine that glides through `path` (list of (time fraction, midi)) with a growing vibrato."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    pts = np.array(path)
    m = np.interp(u, pts[:, 0], pts[:, 1])
    vib = (0.15 + 0.35 * u) * np.sin(2 * np.pi * 6.3 * t)
    f = midi(m + vib)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    a = np.minimum(1, t / 0.12) * np.minimum(1, (dur - t) / 0.4)
    return gain * 0.2 * x * a


def theremin_line(notes, gain=1.0):
    """A theremin melody: notes [(start beat, beats, midi)], one continuous voice that glides
    (portamento) into each note, with vibrato and a breath of a dip between notes."""
    end = max(s + d for s, d, _ in notes)
    n = int((end * BEAT + 0.4) * SR)
    t = np.arange(n) / SR
    pitch = np.full(n, float(notes[0][2]))
    amp = np.zeros(n)
    for s, d, m in notes:
        i0, i1 = int(s * BEAT * SR), int((s + d) * BEAT * SR)
        pitch[i0:] = m
        amp[i0:i1] = 1
    g = int(0.07 * SR)                                   # the glide
    pitch = np.convolve(np.pad(pitch, (g, 0), mode="edge"), np.ones(g) / g, mode="valid")[: n]
    a = int(0.03 * SR)                                   # soft note edges
    amp = np.convolve(np.pad(amp, (a, a), mode="edge"), np.ones(2 * a) / (2 * a), mode="valid")[: n]
    vib = 0.22 * np.sin(2 * np.pi * 6.0 * t) * (0.4 + 0.6 * np.minimum(1, t / 1.0))
    ph = 2 * np.pi * np.cumsum(midi(pitch + vib)) / SR
    x = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    return gain * 0.17 * x * amp


def bell(f, dur=4.0, gain=1.0):
    """A big tolling church bell: inharmonic partials (hum, prime, tierce, quint, nominal...)."""
    t = t_(dur)
    x = np.zeros(len(t))
    for r, a, d in ((0.5, 0.7, 2.6), (1.0, 1.0, 1.8), (1.19, 0.6, 1.4), (1.5, 0.4, 1.1), (2.0, 0.65, 1.0),
                    (2.52, 0.35, 0.7), (2.66, 0.3, 0.6), (3.01, 0.25, 0.5), (4.1, 0.15, 0.3)):
        x += a * np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / d) * (1 + 0.05 * np.sin(2 * np.pi * 1.3 * r * t))
    strike = bp(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.01) * 0.6
    return gain * 0.16 * (x + strike)


def thunder(dur=3.6):
    """A crack and a long rolling rumble."""
    t = t_(dur)
    brown = np.cumsum(rng.standard_normal(len(t)))
    brown = hp(brown - np.mean(brown), 20)
    brown /= np.max(np.abs(brown)) or 1
    roll = lp(brown, 160) * (0.6 + 0.4 * np.abs(np.sin(2 * np.pi * 1.1 * t + 2 * np.sin(2 * np.pi * 0.37 * t))))
    roll *= np.minimum(1, t / 0.05) * np.exp(-t / 1.3)
    crack = bp(rng.standard_normal(len(t)), 300, 4000) * np.exp(-t / 0.08)
    return 0.9 * np.tanh(2.2 * roll) + 0.35 * crack


def choir(notes_midi, dur, gain=1.0):
    """Ghostly "ooo": buzzy voices through an "oo" vowel, with vibrato, swelling in and out."""
    t = t_(dur)
    x = np.zeros(len(t))
    for j, m in enumerate(notes_midi):
        for det in (-0.08, 0.07):
            f = midi(m + det) * (1 + 0.006 * np.sin(2 * np.pi * (5.2 + 0.3 * j) * t + j))
            ph = 2 * np.pi * np.cumsum(f) / SR
            x += sum((1 / k) * np.sin(k * ph) for k in range(1, 10))
    oo = bp(x, 240, 480) + 0.35 * bp(x, 650, 900)
    swell = np.sin(np.pi * np.minimum(1, t / dur)) ** 1.5
    breath = bp(rng.standard_normal(len(t)), 500, 1600) * 0.04
    return gain * 0.05 * (oo + breath) * swell


def howl(dur=2.6, gain=1.0):
    """A wolf howl: a voice sliding up, holding with a wobble, then falling away (oo -> ah -> oo)."""
    t = t_(dur)
    u = t / dur
    m = np.interp(u, [0, 0.18, 0.6, 1.0], [62, 74, 75, 64])
    f = midi(m) * (1 + 0.01 * np.sin(2 * np.pi * 5.5 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    v = sum((1 / k ** 1.2) * np.sin(k * ph) for k in range(1, 14))
    open_ = np.interp(u, [0, 0.3, 0.6, 1], [0, 1, 1, 0])         # how far the "mouth" opens
    voice = (1 - open_) * bp(v, 250, 600) + open_ * (bp(v, 600, 1200) + 0.5 * bp(v, 1100, 1700))
    a = np.minimum(1, t / 0.15) * np.minimum(1, (dur - t) / 0.7)
    return gain * 0.35 * voice * a


def riser(dur):
    t = t_(dur)
    x = hp(rng.standard_normal(len(t)), 1200) * (t / dur) ** 2.5
    f = 220 * 2 ** (2.5 * t / dur)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur) ** 2
    return 0.12 * x + 0.06 * tone


# ---------------------------------------------------------------- the song
CHORDS = [  # root (midi), chord tones above the root (minor or major third), for Dm Bb Gm A
    (50, [0, 3, 7]), (46, [0, 4, 7]), (43, [0, 3, 7]), (45, [0, 4, 7]),
]
RIFF = [0, 2, 3, 2, 4, 3, 2, 3, 0, 2, 3, 2, 4, 3, 1, 2]   # indices into [root, 3rd, 5th, octave, octave+3rd]
# the theremin melody, one four-bar phrase (beats from the phrase start, beats long, midi); D harmonic minor
MELODY = [
    [(0, 1.5, 74), (1.5, 0.5, 73), (2, 2, 74), (4, 1.5, 77), (5.5, 0.5, 76), (6, 2, 74),
     (8, 1, 79), (9, 1, 77), (10, 1, 74), (11, 1, 70), (12, 1.5, 73), (13.5, 0.5, 76), (14, 2, 81)],
    [(0, 1.5, 81), (1.5, 0.5, 79), (2, 2, 77), (4, 1, 77), (5, 1, 74), (6, 2, 70),
     (8, 1.5, 70), (9.5, 0.5, 74), (10, 2, 79), (12, 1, 76), (13, 1, 73), (14, 2, 69)],
]


def render(seconds, cues):
    n = int((seconds + 4) * SR)
    out = np.zeros(n)

    def add(x, t, g=1.0):
        i = int(round(t * SR))
        if i >= n or i < 0:
            return
        x = x[: n - i]
        out[i: i + len(x)] += g * x

    TITLE, BREAK, END = cues["title"], cues["boo"], cues["end"]
    BOO, STING = BREAK + 1, END + 1
    starts = sorted(v for k, v in cues.items() if k != "bars")
    section = lambda b: max((k for k in cues if k != "bars" and cues[k] <= b), key=lambda k: cues[k])
    nbars = int(np.ceil(seconds / BAR))
    for b in range(min(nbars, STING)):
        t0 = b * BAR
        root, tones = CHORDS[b % 4]
        ladder = [root, root + tones[1], root + tones[2], root + 12, root + 12 + tones[1]]
        sec = section(b)
        intro, brk = b < TITLE, b == BREAK
        full = not intro and not brk
        voic = [midi(root + 12 + x) for x in tones] + [midi(root + 24)]
        # the riff: harpsichord sixteenths two octaves up, pizzicato eighths an octave up
        rg = 0.5 if intro else (0.45 if brk else (0.6 if sec == "build" else 1.0))
        for k, ix in enumerate(RIFF):
            note = ladder[ix] + 24
            add(harpsichord(midi(note)), t0 + k * S16, rg)
            if k % 2 == 0 and not intro:
                add(pizz(midi(ladder[ix] + 12)), t0 + k * S16, 0.9 if full else 0.5)
        if intro:
            for k in range(8):                       # a ticking clock under the knocks
                add(HAT, t0 + k * BEAT / 2, 0.5 if k % 2 else 0.8)
            add(organ([midi(root - 12), midi(root)], BAR, 1.1, attack=0.25, full=True), t0)   # a low pedal
            add(organ(voic, BAR, 0.45, attack=0.3), t0)
            if b == 0:
                add(bell(midi(50 - 12), 4.0, 0.9), t0)
            continue
        if brk:                                      # the Boo! set-up: tick, heartbeat, riser, an eerie organ
            for k in range(4):
                add(KICK, t0 + k * BEAT, 0.55)
                add(KICK, t0 + k * BEAT + 0.16, 0.35)
            for k in range(16):
                add(HAT, t0 + k * S16, 0.35)
            add(riser(BAR), t0)
            add(organ([midi(50), midi(53), midi(56)], BAR, 0.7, attack=0.4, full=True), t0)   # a diminished chord
            add(choir([62, 65, 68], BAR, 0.9), t0)
            continue
        # drums
        for k in range(4):
            add(KICK, t0 + k * BEAT)
        for k in (1, 3):
            add(SNARE, t0 + k * BEAT)
        for k in range(16):
            if k % 4 == 2:
                add(OHAT, t0 + k * S16, 0.7)
            else:
                add(HAT, t0 + k * S16, 0.9 if k % 2 == 0 else 0.55)
        if b + 1 == BREAK:                           # a snare roll into the breakdown
            for k in range(8, 16):
                add(SNARE, t0 + k * S16, 0.35 + 0.05 * (k - 8))
        elif b + 1 in starts and b + 1 < STING:      # a tom fill into every new shot
            for j, k in enumerate((12, 13, 14, 15)):
                add(TOMS[j], t0 + k * S16, 0.9)
        # bass: pulsing eighths, root and octave
        for k in range(8):
            add(bass(midi(root - 12 + (12 if k % 4 == 3 else 0)), BEAT / 2 * 0.9), t0 + k * BEAT / 2)
        # the church organ under everything, and the stabs on top
        add(organ([midi(root), midi(root + 12 + tones[1]), midi(root + 12 + tones[2])], BAR, 0.38, attack=0.08, full=True), t0)
        if b % 2 == 0:
            add(organ(voic, BEAT * 0.7), t0, 1.0)
        add(organ(voic, BEAT * 0.3), t0 + 3.5 * BEAT, 0.6)
        # ghostly choir swells on the slower shots and over the street
        if sec in ("skin", "faces", "patrol") and (b - cues[sec]) % 2 == 0:
            add(choir([root + 12, root + 12 + tones[1], root + 12 + tones[2], root + 24], 2 * BAR, 1.0), t0)
    # the theremin melody: four-bar phrases over the roll call, moves, patrol and the brigade
    for i, (sec, nb) in enumerate((("roll", 4), ("moves", 3), ("patrol", 3), ("brigade", 2))):
        b0 = cues[sec]
        o = (b0 % 4) * 4                              # where in the chord cycle the shot starts
        song = MELODY[i % 2] + [(s + 16, d, m) for s, d, m in MELODY[(i + 1) % 2]]
        notes = [(s - o, min(d, o + nb * 4 - s), m) for s, d, m in song if o <= s < o + nb * 4]
        add(theremin_line(notes, 1.4), b0 * BAR)
    add(howl(2.6, 0.9), cues["patrol"] * BAR + BEAT * 0.5)

    # the big moments
    for bb in (TITLE, BOO, END):
        t0 = bb * BAR
        add(CRASH, t0, 1.0)
        add(bell(midi(50 - 12), 3.5, 0.8), t0)
        root, tones = CHORDS[bb % 4]
        add(organ([midi(root + 12 + x) for x in tones] + [midi(root + 24)], BAR * 0.9, 1.3, full=True), t0)
    add(thunder(3.8), TITLE * BAR, 1.0)
    add(theremin([(0, 62), (0.18, 74), (0.42, 86), (0.6, 81), (0.82, 77), (1, 74)], BAR * 1.6, 1.0), TITLE * BAR - 0.15)
    add(theremin([(0, 86), (0.3, 74), (0.6, 70), (1, 62)], BAR * 0.9, 0.7), BOO * BAR + 0.05)
    add(theremin([(0, 62), (0.25, 81), (0.5, 86), (0.75, 79), (1, 74)], BAR * 1.2, 0.9), END * BAR)
    # the sting: one held D minor chord on the full organ, a last kick, crash and bell, a theremin falling away
    ts = STING * BAR
    add(KICK, ts, 1.2)
    add(CRASH, ts, 1.2)
    add(bell(midi(38), 4.0, 1.1), ts)
    add(organ([midi(x) for x in (38, 50, 62, 65, 69, 74)], BAR * 1.0, 1.5, full=True), ts)
    add(bass(midi(38), BAR * 0.9), ts, 1.2)
    for k, m in enumerate((74, 77, 81, 86)):
        add(harpsichord(midi(m), 1.2), ts + k * S16 / 2, 1.3)
    add(theremin([(0, 86), (0.5, 81), (1, 62)], BAR * 1.0, 0.8), ts + 0.1)

    out = out[: int(seconds * SR)]
    fade = int(0.35 * SR)
    out[-fade:] *= np.linspace(1, 0, fade)
    out = np.tanh(1.2 * out / (np.max(np.abs(out)) or 1)) / np.tanh(1.2)   # glue the peaks a little
    return out / (np.max(np.abs(out)) or 1) * 0.89


def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    path = sys.argv[1]
    cues = dict(DEFAULT_CUES)
    if len(sys.argv) > 3:
        cues.update(json.load(open(sys.argv[3])).get("cues", {}))
    secs = float(sys.argv[2]) if len(sys.argv) > 2 else cues["bars"] * BAR
    write(path, render(secs, cues))
    print("wrote", path, f"{secs:.2f} s at {BPM} BPM")
