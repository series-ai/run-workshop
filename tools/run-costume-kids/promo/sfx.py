"""Sound effects for the trailer, from the cues the page recorded, mixed over the music.

    python3 promo/sfx.py promo/out/events.json promo/out/mix.wav [promo/out/music.wav [music gain]]

Cues: knock (a knuckle on a wooden door), creak (the door creaking open), candy (a
rattle into a bucket), title (a whoosh into a sparkle), pop (a costume hops in; pitched
up a D minor scale by the cue's "pitch"), tick (a skin tone swap), blip (a face swap),
swap (a move or palette swap), boo (a wobbly ghost "booo" with a low hit), eek (a kid's
squeak of fright), cackle (the ghost's witchy laugh), snap (a house part clunking into
place: a tuned wood-block "thock" over a thump, up the scale part by part), march (many
little footsteps), cheer (a crowd of kids going "yay"), sparkle.

The page puts every cue tied to the music exactly on the 140 BPM beat grid.
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, lfilter

SR = 48000
rng = np.random.default_rng(9)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def lp(x, fc):
    b, a = butter(2, min(0.99, fc / (SR / 2)), "low")
    return lfilter(b, a, x)


def hp(x, fc):
    b, a = butter(2, fc / (SR / 2), "high")
    return lfilter(b, a, x)


def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], "band")
    return lfilter(b, a, x)


def knock():
    """Two quick raps (a knuckle-knock is a double hit) on a hollow wooden door."""
    out = np.zeros(int(0.35 * SR))
    for k, (dt, g) in enumerate(((0.0, 1.0), (0.085, 0.8))):
        t = t_(0.2)
        body = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((95, 1.0), (180, 0.6), (310, 0.35), (520, 0.2))) * np.exp(-t / 0.045)
        tap = bp(noise(0.2), 600, 3500) * np.exp(-t / 0.006)
        x = g * (0.8 * body + 0.5 * tap)
        i = int(dt * SR)
        out[i: i + len(x)] += x[: len(out) - i]
    return 0.8 * np.tanh(1.5 * out)


def chime(f, dur=1.0, g=0.25):
    t = t_(dur)
    return g * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.15)) * np.exp(-t / 0.4)


def sparkle():
    out = np.zeros(int(1.6 * SR))
    for k, f in enumerate([1760, 2217, 2637, 3520, 4186]):
        c = chime(f, 1.0, 0.14)
        i = int(k * 0.06 * SR)
        out[i: i + len(c)] += c
    return out


def candy():
    out = np.zeros(int(0.6 * SR))
    for _ in range(14):                      # wrapped sweets rattling into a plastic bucket
        i = int(rng.uniform(0, 0.35) * SR)
        t = t_(0.05)
        x = bp(noise(0.05), 2000, 7000) * np.exp(-t / 0.008) * rng.uniform(0.3, 0.8)
        out[i: i + len(x)] += x
    return 0.5 * out + np.pad(chime(2637, 0.5, 0.12), (int(0.1 * SR), 0))[: len(out)]


def whoosh(dur=0.6):
    t = t_(dur)
    x = noise(dur)
    sweep = np.zeros_like(x)
    seg = len(x) // 8                         # a band-pass that climbs
    for j in range(8):
        lo = 300 * 2 ** (j * 0.45)
        sweep[j * seg:(j + 1) * seg] = bp(x, lo, lo * 3)[j * seg:(j + 1) * seg]
    return 0.6 * sweep * np.sin(np.pi * t / dur) ** 2


def title():
    out = np.zeros(int(1.8 * SR))
    w = whoosh(0.5)
    out[: len(w)] += w
    s = sparkle()
    i = int(0.35 * SR)
    out[i: i + len(s)] += s[: len(out) - i]
    return out


SCALE = [62, 64, 65, 67, 69, 70, 73, 74, 76, 77, 79, 81]   # D harmonic minor, from D4


def note(i):
    return 440.0 * 2 ** ((SCALE[int(i) % len(SCALE)] - 69) / 12)


def pop(pitch=None):
    t = t_(0.12)
    k = 1.0 if pitch is None else note(pitch) / note(0)
    f = (380 + 1000 * np.exp(-t * 40)) * k ** 0.5
    return 0.45 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035)


def tick():
    t = t_(0.08)
    return 0.35 * (np.sin(2 * np.pi * 2200 * t) + 0.5 * np.sin(2 * np.pi * 3300 * t)) * np.exp(-t / 0.012)


def blip():
    t = t_(0.13)
    f = 700 + 900 * t / 0.13
    return 0.3 * np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t / 0.04) * 0.6


def swap():
    t = t_(0.16)
    f = 500 + 900 * t / 0.16
    return 0.28 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.06) + 0.15 * whoosh(0.16)


def boo():
    """A ghost's wobbly "booooo": a buzzy voice through an "oo" vowel, sliding down, with a low hit."""
    dur = 1.5
    t = t_(dur)
    f0 = 240 * 2 ** (-0.6 * t / dur) * (1 + 0.035 * np.sin(2 * np.pi * 5.5 * t))
    ph = 2 * np.pi * np.cumsum(f0) / SR
    voice = sum((1 / k) * np.sin(k * ph) for k in range(1, 18))
    oo = bp(voice, 220, 520) + 0.4 * bp(voice, 650, 1000)     # "oo" formants
    a = np.minimum(1, t / 0.05) * np.minimum(1, (dur - t) / 0.5)
    hit_t = t_(0.6)
    hit = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-hit_t * 25)) / SR) * np.exp(-hit_t / 0.25)
    out = 1.6 * oo * a
    out[: len(hit)] += 0.8 * hit
    return 0.5 * np.tanh(out)


def eek():
    t = t_(0.45)
    f = 900 + 900 * np.minimum(1, t / 0.08) + 60 * np.sin(2 * np.pi * 18 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    a = np.minimum(1, t / 0.02) * np.exp(-np.maximum(0, t - 0.15) / 0.12)
    return 0.22 * (np.sin(ph) + 0.3 * np.sin(2 * ph)) * a


def snap(pitch=0):
    """A part landing: a tuned wood-block "thock" (up the D minor scale part by part, like the
    palette swaps' rising chirp) over a short low thump and a click, all starting on the sample."""
    t = t_(0.3)
    f = note(pitch)
    block = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-t / 0.02)
             + 0.2 * np.sin(2 * np.pi * 3.9 * f * t) * np.exp(-t / 0.01)) * np.exp(-t / 0.07)
    thump = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t * 40)) / SR) * np.exp(-t / 0.06)
    click = bp(noise(0.3), 1500, 6000) * np.exp(-t / 0.004)
    return 0.5 * np.tanh(1.2 * (0.55 * block + 0.8 * thump + 0.35 * click))


def creak(dur=0.9):
    """A door creaking open: a slow, irregular stick-slip buzz that bends up and down."""
    t = t_(dur)
    f = 95 + 60 * np.sin(np.pi * t / dur) + 25 * np.sin(2 * np.pi * 1.7 * t)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.15 * rng.standard_normal(len(t)).cumsum() / np.sqrt(len(t)))) / SR
    pulses = np.maximum(0, np.sin(ph)) ** 12                       # stick-slip: sharp little pulses
    body = bp(pulses, 400, 2800) + 0.5 * bp(pulses, 900, 1300)
    a = np.minimum(1, t / 0.06) * np.minimum(1, (dur - t) / 0.25)
    return 0.6 * body / (np.max(np.abs(body)) or 1) * a


def cackle():
    """A witchy ghost cackle: "heh-heh-heh-hahh", each burst a raspy voice stepping down."""
    out = np.zeros(int(1.2 * SR))
    for j in range(6):
        d = 0.11 if j < 5 else 0.3
        tt = t_(d)
        f0 = 620 * 2 ** (-j / 18) * (1 + 0.25 * np.exp(-tt / 0.02))
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.03 * np.sin(2 * np.pi * 30 * tt))) / SR
        v = sum((1 / k) * np.sin(k * ph) for k in range(1, 16))
        v = bp(v, 700, 1300) + 0.6 * bp(v, 1800, 2800) + 0.2 * bp(noise(d), 2000, 5000)
        v *= np.sin(np.pi * tt / d) ** 0.6
        i = int(j * 0.13 * SR)
        out[i: i + len(v)] += v[: len(out) - i]
    return 0.3 * out / (np.max(np.abs(out)) or 1) * 1.6


def march(dur=3.4):
    out = np.zeros(int(dur * SR))
    for _ in range(int(dur * 40)):            # lots of little feet
        i = int(rng.uniform(0, dur - 0.05) * SR)
        t = t_(0.04)
        x = (np.sin(2 * np.pi * rng.uniform(150, 280) * t) + 0.4 * bp(noise(0.04), 800, 3000)) * np.exp(-t / 0.009)
        out[i: i + len(x)] += 0.12 * x
    t = t_(dur)
    return out * np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.5)


def cheer(dur=2.6):
    """A crowd of kids: many short rising "yay"s and a breathy swell."""
    out = np.zeros(int(dur * SR))
    t = t_(dur)
    out += 0.1 * bp(noise(dur), 900, 3500) * np.minimum(1, t / 0.15) * np.exp(-t / 1.2)
    for _ in range(40):
        st = rng.uniform(0, 0.8)
        d = rng.uniform(0.25, 0.5)
        tt = t_(d)
        f0 = rng.uniform(380, 700)
        f = f0 * (1 + 0.35 * np.minimum(1, tt / 0.12)) * (1 + 0.02 * np.sin(2 * np.pi * 7 * tt))
        ph = 2 * np.pi * np.cumsum(f) / SR
        v = sum((1 / k) * np.sin(k * ph) for k in range(1, 7))
        v = bp(v, 500, 2600) * np.sin(np.pi * tt / d) ** 0.7
        i = int(st * SR)
        out[i: i + len(v)] += 0.06 * v[: len(out) - i]
    return out


SOUNDS = dict(knock=knock, creak=creak, candy=candy, title=title, pop=pop, tick=tick, blip=blip, swap=swap, boo=boo,
              eek=eek, cackle=cackle, snap=snap, march=march, cheer=cheer, sparkle=sparkle)
PITCHED = {"pop", "snap"}


def read(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32767


def main():
    ev = json.load(open(sys.argv[1]))
    total = ev["total"]
    out = np.zeros(int((total + 3) * SR))
    cache = {}
    for e in ev["events"]:
        if e["type"] not in SOUNDS:
            continue
        key = (e["type"], e.get("pitch"))
        if key not in cache or e["type"] in ("candy", "march", "cheer"):
            p = e.get("pitch")
            cache[key] = SOUNDS[e["type"]](p) if e["type"] in PITCHED and p is not None else SOUNDS[e["type"]]()
        x = cache[key] * e.get("gain", 1)
        i = int(round(e["t"] * SR))
        out[i: i + len(x)] += x[: len(out) - i]
    if len(sys.argv) > 3:
        m = read(sys.argv[3]) * (float(sys.argv[4]) if len(sys.argv) > 4 else 0.5)
        out[: len(m)] += m[: len(out)]
    out = out[: int(total * SR)]
    out = np.tanh(out / 0.9) * 0.9                  # a soft limiter, so a loud hit doesn't duck the whole mix
    out /= max(1.0, np.max(np.abs(out)) / 0.95)
    with wave.open(sys.argv[2], "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())
    print("wrote", sys.argv[2])


if __name__ == "__main__":
    main()
