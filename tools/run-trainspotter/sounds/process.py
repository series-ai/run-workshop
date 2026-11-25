"""Process generated takes into library-ready sounds.

    python sounds/process.py

Reads out/sounds/raw/<id>_NN.wav (sounds/generate.mjs), and for each take:
- one-shots: trims silence at both ends (-50 dBFS), short fade in, gentle fade out;
- loops: keeps the steady body (generated takes often fade in and out), then crossfades the
  tail into the head, so the loop has no seam, click or gap;
- cut: sounds are single hits (a chuff, a wheel over a rail joint) cut from another sound's
  takes: the loudest, crispest attacks, peak-normalised to -3 dBFS;
- normalises loudness (ffmpeg ebur128): one-shots -16 LUFS, loops and ambience -20 LUFS, then a
  look-ahead limiter holds peaks near -1 dBFS;
- writes out/sounds/ogg/<id>_NN.ogg (Vorbis q6, 44.1 kHz stereo), out/sounds/sounds.json and a
  listening page, out/sounds/listen.html.
Needs numpy and ffmpeg on PATH.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "out", "sounds"))
RAW, OGG = os.path.join(OUT, "raw"), os.path.join(OUT, "ogg")
SPEC = json.load(open(os.path.join(HERE, "sounds.json"), encoding="utf-8"))


def read(path):
    with wave.open(path) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    return x.reshape(-1, ch), sr


def write(path, x, sr):
    y = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(y.shape[1])
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((y * 32767).astype(np.int16).tobytes())


def trim(x, sr, floor_db=-50):
    level = np.abs(x).max(axis=1)
    on = np.nonzero(level > 10 ** (floor_db / 20))[0]
    if not len(on):
        return x
    a, b = max(0, on[0] - int(0.01 * sr)), min(len(x), on[-1] + int(0.05 * sr))
    return x[a:b]


def fades(x, sr, fin=0.005, fout=0.06):
    x = x.copy()
    i, o = min(len(x) // 4, int(fin * sr)), min(len(x) // 3, int(fout * sr))
    if i:
        x[:i] *= np.linspace(0, 1, i)[:, None]
    if o:
        x[-o:] *= np.linspace(1, 0, o)[:, None] ** 2
    return x


def db_env(x, sr, hop_s):
    hop = max(1, int(hop_s * sr))
    n = len(x) // hop
    p = (x[: n * hop].mean(axis=1) ** 2).reshape(n, hop).mean(axis=1)
    return 10 * np.log10(p + 1e-12), hop


def steady(x, sr, drop_db=6.0, min_s=1.5):
    """Loop: keep the steady body of a take. Generated takes often fade in and out, and a
    crossfade between two quiet ends leaves an audible gap every time the loop comes round."""
    db, hop = db_env(x, sr, 0.05)
    k = 8  # smooth over 0.4 s, so the gaps between individual beats don't count as quiet
    sm = 10 * np.log10(np.convolve(10 ** (db / 10), np.ones(k) / k, mode="same") + 1e-12)
    loud = sm >= np.median(sm) - drop_db
    best, run = (0, 0), None
    for i, on in enumerate(np.append(loud, False)):
        if on and run is None:
            run = i
        elif not on and run is not None:
            best = max(best, (run, i), key=lambda r: r[1] - r[0])
            run = None
    a, b = best
    return x[a * hop: b * hop] if (b - a) * hop >= min_s * sr else x


def onsets(x, sr):
    """Sharp attacks: a rise of more than 6 dB over 15 ms, at least 60 ms apart (seconds)."""
    db, hop = db_env(x, sr, 0.005)
    rise = db[3:] - db[:-3]
    out = []
    for i in range(1, len(rise) - 1):
        if rise[i] > 6 and rise[i] >= rise[i - 1] and rise[i] >= rise[i + 1] and (not out or i - out[-1] > 12):
            out.append(i)
    return [(i + 3) * hop / sr for i in out], db, hop


def bandpass(x, sr, lo, hi):
    """Keep lo..hi Hz (soft 20% shoulders), via the FFT of the whole take."""
    f = np.fft.rfftfreq(len(x), 1 / sr)
    gain = np.clip(np.minimum((f - lo * 0.8) / (lo * 0.2), (hi * 1.2 - f) / (hi * 0.2)), 0, 1)
    return np.fft.irfft(np.fft.rfft(x, axis=0) * gain[:, None], n=len(x), axis=0).astype(np.float32)


def cut_hits(paths, takes, max_s, min_s=0.06, band=None):
    """The loudest, crispest single hits in some takes: each runs from its attack to just before
    the next one (at most max_s), fades out over its second half, and peaks at -3 dBFS. band:
    [lo, hi] Hz to listen in (and keep), e.g. birdsong out of a breezy countryside take."""
    found = []
    load = lambda path: (lambda x, sr: (bandpass(x, sr, *band) if band else x, sr))(*read(path))  # noqa: E731
    for path in paths:
        x, sr = load(path)
        t, db, hop = onsets(x, sr)
        for j, t0 in enumerate(t):
            a = max(0, int((t0 - 0.005) * sr))
            end = t[j + 1] - 0.005 if j + 1 < len(t) else len(x) / sr
            b = min(len(x), int(min(end, t0 + max_s) * sr))
            if (b - a) < min_s * sr:
                continue
            i = int(t0 * sr / hop)
            peak, pre = db[i: i + 12].max(), db[max(0, i - 8): max(1, i - 1)].mean()
            found.append((peak + (peak - pre), path, a, b, sr))  # loud, and standing clear of what came before
    found.sort(key=lambda f: -f[0])
    hits = []
    for _, path, a, b, sr in found[:takes]:
        x, _ = load(path)
        h = x[a:b].copy()
        f_in, f_out = int(0.002 * sr), (b - a) // 2
        h[:f_in] *= np.linspace(0, 1, f_in)[:, None]
        h[-f_out:] *= np.linspace(1, 0, f_out)[:, None] ** 2
        hits.append((h / max(1e-6, np.abs(h).max()) * 10 ** (-3 / 20), sr, os.path.basename(path), round(a / sr, 3)))
    return hits


def seamless(x, sr):
    """Loop: the last `xf` seconds crossfade into the first, and are then cut off (equal power)."""
    xf = min(int(0.35 * sr), len(x) // 5)
    t = np.linspace(0, 1, xf)[:, None]
    out = x[: len(x) - xf].copy()
    out[:xf] = x[:xf] * np.sin(t * np.pi / 2) + x[len(x) - xf:] * np.cos(t * np.pi / 2)
    return out


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    summary = r[r.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summary).group(1)) if "I:" in summary else -70.0
    peak = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    return lufs, float(peak.group(1)) if peak and peak.group(1) != "-inf" else -70.0


def main():
    os.makedirs(OGG, exist_ok=True)
    tmp = os.path.join(OUT, "_tmp.wav")
    manifest = {"about": SPEC["about"], "sounds": {}}
    for s in SPEC["sounds"]:
        if s.get("cut"):
            c = s["cut"]
            src = sorted(os.path.join(RAW, f) for f in os.listdir(RAW) if re.fullmatch(re.escape(c["from"]) + r"_\d\d\.wav", f))
            entries = []
            for k, (h, sr, origin, at) in enumerate(cut_hits(src, c["takes"], c["max"], band=c.get("band"))):
                name = f"{s['id']}_{k + 1:02d}.ogg"
                write(tmp, h, sr)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libvorbis", "-q:a", "6", os.path.join(OGG, name)], check=True)
                entries.append({"file": name, "seconds": round(len(h) / sr, 3), "peak": -3.0, "cutFrom": origin, "at": at})
                print(f"{name:34s} {len(h) / sr:5.2f}s  cut from {origin} at {at:.3f}s")
            manifest["sounds"][s["id"]] = {"group": s["group"], "loop": False, "takes": entries}
            continue
        takes = sorted(f for f in os.listdir(RAW) if re.fullmatch(re.escape(s["id"]) + r"_\d\d\.wav", f))
        entries = []
        for f in takes:
            x, sr = read(os.path.join(RAW, f))
            x = seamless(steady(x, sr), sr) if s.get("loop") else fades(trim(x, sr), sr)
            write(tmp, x, sr)
            lufs, peak = loudness(tmp)
            target = -20.0 if s.get("loop") else -16.0
            gain = min(18.0, target - lufs) if lufs > -60 else 0.0
            name = f[:-4] + ".ogg"
            # gain to the target, then a look-ahead limiter holds peaks at -1 dB (transient-heavy takes)
            chain = f"volume={gain:.2f}dB,alimiter=limit=0.85:attack=3:release=60:level=disabled"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", chain, "-c:a", "libvorbis", "-q:a", "6", os.path.join(OGG, name)], check=True)
            lufs2, peak2 = loudness(os.path.join(OGG, name))
            entries.append({"file": name, "seconds": round(len(x) / sr, 3), "lufs": round(lufs2, 1), "peak": round(peak2, 1)})
            print(f"{name:34s} {len(x) / sr:5.2f}s  {lufs2:6.1f} LUFS  peak {peak2:5.1f}")
        manifest["sounds"][s["id"]] = {"group": s["group"], "loop": bool(s.get("loop")), "takes": entries}
    os.remove(tmp)
    json.dump(manifest, open(os.path.join(OUT, "sounds.json"), "w", encoding="utf-8", newline=""), indent=1)
    # a page to listen to every take side by side (out/sounds/listen.html)
    rows = []
    for sid, m in manifest["sounds"].items():
        players = "".join(f'<audio controls preload="none" {"loop" if m["loop"] else ""} src="ogg/{t["file"]}"></audio>' for t in m["takes"])
        rows.append(f'<tr><td><b>{sid}</b><br><small>{m["group"]}{" · loop" if m["loop"] else ""}</small></td><td>{players}</td></tr>')
    html = ('<!doctype html><meta charset="utf-8"><title>Trainspotter sounds</title><style>body{font:14px system-ui;margin:24px}'
            'td{padding:6px 12px;border-bottom:1px solid #ddd;vertical-align:middle}audio{margin-right:8px}</style>'
            '<h1>Trainspotter sounds</h1><table>' + "".join(rows) + '</table>')
    open(os.path.join(OUT, "listen.html"), "w", encoding="utf-8", newline="").write(html)


if __name__ == "__main__":
    main()
