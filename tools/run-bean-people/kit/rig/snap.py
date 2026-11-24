"""Snap score: measure how floaty each clip is (see .claude/skills/procedural-animation/principles.md §8).

    python3 rig/snap.py [clip ...]        -> one line per clip, FLOATY flags first

Pose speed per frame = the summed change of every pose channel (degrees, centimetres, squash %).
    contrast = p90 speed / median speed        sine motion ~1.5, good pose-to-pose >= 3
    hold     = share of frames under 30% of peak speed (action / emote clips want >= 0.35)
Floaty = hold < 0.35, or contrast < 3 without at least 60% holds.
Locomotion cycles, breathing idles, free-fall loops and chain pieces under 0.3 s are exempt.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
exec(compile(open(os.path.join(HERE, "clips.py")).read(), "clips.py", "exec"))

EXEMPT_TAGS = {"move"}
EXEMPT = {"idle", "idle-look", "jump-air", "fall", "tumble", "swim", "hang", "climb", "sleep", "sit",
          "crouch-idle", "belly-slide", "aim", "carry", "push", "shoot-auto", "cheer", "jumping-jacks", "dance-hop", "wave-big"}  # hop cycles are gaits; wave-big is a rapid cycle by design
MIN_CONTRAST, MIN_HOLD = 3.0, 0.35


def flat(p):
    out = {}
    for b, ch in p.b.items():
        for k, v in ch.items():
            scale = 100.0 if k in ("loc", "s") else 1.0
            if b == "root" and k == "loc":
                v = v[2:]                       # root x / forward is root motion, not performance
            for i, x in enumerate(v):
                out[(b, k, i)] = x * scale
    if p.air_h:
        out[("air",)] = p.air_h * 100
    return out


def score(name):
    c = CLIPS[name]
    n = max(2, round(c["dur"] * FPS))
    frames = [flat(c["f"](min(f / FPS, c["dur"]))) for f in range(n + 1)]
    speeds = []
    for a, b in zip(frames, frames[1:]):
        keys = set(a) | set(b)
        speeds.append(sum(abs(b.get(k, 0.0) - a.get(k, 0.0)) for k in keys))
    s = sorted(speeds)
    med = s[len(s) // 2] or 1e-6
    p90 = s[int(len(s) * 0.9)]
    peak = s[-1] or 1e-6
    hold = sum(1 for v in speeds if v < 0.3 * peak) / len(speeds)
    return p90 / med, hold, peak


def main():
    names = sys.argv[1:] or list(CLIPS)
    rows = []
    for n in names:
        con, hold, peak = score(n)
        exempt = n in EXEMPT or set(CLIPS[n]["tags"]) & EXEMPT_TAGS or CLIPS[n]["dur"] < 0.3  # chain pieces are all transition
        bad = (not exempt) and (hold < MIN_HOLD or (con < MIN_CONTRAST and hold < 0.6))
        rows.append((not bad, n, con, hold, peak, exempt))
    rows.sort()
    for ok, n, con, hold, peak, exempt in rows:
        flag = "exempt" if exempt else ("ok" if ok else "FLOATY")
        print(f"{flag:7s} {n:20s} contrast {con:5.2f}  hold {hold:4.2f}  peak {peak:6.1f}")
    bad = sum(1 for r in rows if not r[0])
    print(f"{len(rows)} clips, {bad} floaty")
    sys.exit(1 if bad else 0)


main()
