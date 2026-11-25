"""Word-level lyric timing and beat analysis for the trailer song.

    <python with stable-ts, librosa> trailer/analyse.py <song> <out.json>

Forced alignment of the known lyrics (stable-ts, Whisper large-v3), a free
transcription alongside it (what was really sung), and the beat grid and
drum onsets (librosa). Follows the trailer toolkit notes: align the plain
lyrics, one sung line per line, with section tags stripped.
"""
import json
import sys

import librosa
import stable_whisper

LYRICS = """Here it comes!
End of the platform, camera in my hand
Notebook full of numbers, I'm the biggest fan!
Trains! Trains! I love the trains!
Rain or shine I'm by the line, I know them all by name!
Hear that horn, my heart is gone, wave it down the track!
Trainspotter, trainspotter, catch it coming back!
Got the shot!"""

song, out = sys.argv[1], sys.argv[2]
model = stable_whisper.load_model("large-v3", device="cuda")
al = model.align(song, LYRICS, language="en")
lines = []
for seg in al.segments:
    lines.append({"s": round(seg.start, 3), "e": round(seg.end, 3), "text": seg.text.strip(),
                  "words": [{"s": round(w.start, 3), "e": round(w.end, 3), "w": w.word.strip()} for w in seg.words]})
raw = model.transcribe(song, language="en", word_timestamps=True, vad=True)
sung = [{"s": round(s.start, 3), "e": round(s.end, 3), "text": s.text.strip()} for s in raw.segments]

y, sr = librosa.load(song, sr=None, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", start_bpm=175)
onsets = librosa.onset.onset_detect(y=y, sr=sr, units="time", backtrack=False)
rms = librosa.feature.rms(y=y, hop_length=512)[0]
times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=512)
energy = [[round(float(t), 3), round(float(v), 4)] for t, v in list(zip(times, rms))[::4]]
data = {"duration": round(len(y) / sr, 3), "tempo": float(tempo if not hasattr(tempo, "__len__") else tempo[0]),
        "beats": [round(float(b), 3) for b in beats], "onsets": [round(float(o), 3) for o in onsets],
        "lines": lines, "sung": sung, "energy": energy}
with open(out, "w", encoding="utf-8", newline="") as fh:
    json.dump(data, fh, indent=1)
for ln in lines:
    print(f"{ln['s']:6.2f}-{ln['e']:6.2f}  {ln['text']}")
print("--- transcription")
for s in sung:
    print(f"{s['s']:6.2f}-{s['e']:6.2f}  {s['text']}")
print(f"tempo {data['tempo']:.1f}, {len(data['beats'])} beats, {len(data['onsets'])} onsets, duration {data['duration']}")
