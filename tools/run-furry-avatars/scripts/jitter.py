"""Find wobble and pops in baked clips from a JITTER_DUMP json (see build.py).

  WOBBLE  a point's motion reverses direction and reverses back within a few frames (back-forth-back),
          with real size: reads as jitter/shake. Intended trembles (roar) show up here too; read the clip name.
  POP     a one-frame spike: the frame's acceleration is many times its neighbours' (a teleport-ish snap).
Ordinary moves (speed up, then slow down) are NOT flagged.
usage: python3 scripts/jitter.py dump.json [clip ...]"""
import json
import sys


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return dot(a, a) ** 0.5


d = json.load(open(sys.argv[1]))
only = set(sys.argv[2:])
total = 0
for clip, D in sorted(d.items()):
    if only and clip not in only:
        continue
    out = []
    for k, P in D["tracks"].items():
        n = len(P)
        V = [sub(P[i + 1], P[i]) for i in range(n - 1)]
        for i in range(len(V) - 2):
            a, b, c = V[i], V[i + 1], V[i + 2]
            if min(norm(a), norm(b), norm(c)) > 0.004 and dot(a, b) < 0 and dot(b, c) < 0:
                out.append(f"WOBBLE {k:10s} frames {i + 1}-{i + 3}  ({norm(a) * 100:.1f}, {norm(b) * 100:.1f}, {norm(c) * 100:.1f} cm/f)")
        A = [sub(V[i + 1], V[i]) for i in range(len(V) - 1)]
        for i in range(1, len(A) - 1):
            m = norm(A[i])
            nb = max(norm(A[i - 1]), norm(A[i + 1]), 0.003)
            if m > 0.03 and m > 4 * nb:
                out.append(f"POP    {k:10s} frame {i + 1}  ({m * 100:.1f} cm/f2 vs {nb * 100:.1f})")
    if out:
        print(f"== {clip} ({len(out)})")
        for o in out[:12]:
            print("  ", o)
        total += len(out)
print("total", total)
