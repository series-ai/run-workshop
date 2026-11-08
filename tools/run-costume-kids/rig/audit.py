"""Audit: pieces that touch nothing at rest (floating), per character, after the rig rules."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys
CHARS = sys.argv[sys.argv.index("--") + 1:]
sys.argv = [sys.argv[0], "--", _PKG + "/rig/dbg", "x"]
src = open(_PKG + "/rig/toyanim.py").read().split("\nfor slug in SLUGS:")[0]
exec(compile(src, "toyanim.py", "exec"))
for slug in CHARS or [s.strip() for s in open(_PKG + "/rig/slugs.txt") if s.strip()]:
    try:
        parts, rest = build_rig(slug)
    except Exception as ex:
        print("FAIL", slug, repr(ex)); continue
    ms = [(o, n) for n, e in parts.items() for o in e.children if o.type == "MESH"]
    bb = {o: bounds(o) for o, _ in ms}
    def gap(a, b):
        (ca, za), (cb, zb) = bb[a], bb[b]
        return max(max((cb[i] - zb[i] / 2) - (ca[i] + za[i] / 2), (ca[i] - za[i] / 2) - (cb[i] + zb[i] / 2)) for i in range(3))
    for o, n in ms:
        if not any(gap(o, q) < 0.06 for q, _ in ms if q is not o):
            c, z = bb[o]
            print("FLOAT", slug, n, _colour(o), tuple(round(v, 2) for v in c), tuple(round(v, 2) for v in z), flush=True)
