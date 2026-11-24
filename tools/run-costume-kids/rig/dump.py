"""Print every piece's final rig part, colour, centre and size."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys
CHARS = sys.argv[sys.argv.index("--") + 1:]
sys.argv = [sys.argv[0], "--", _PKG + "/rig/dbg", "x"]
src = open(_PKG + "/rig/toyanim.py").read().split("\nfor slug in SLUGS:")[0]
exec(compile(src, "toyanim.py", "exec"))
for slug in CHARS:
    parts, rest = build_rig(slug)
    for name, e in parts.items():
        for o in e.children:
            if o.type != "MESH":
                continue
            c, size = bounds(o)
            print("P", slug, name, _colour(o), tuple(round(v, 2) for v in c), tuple(round(v, 2) for v in size), o.name)
