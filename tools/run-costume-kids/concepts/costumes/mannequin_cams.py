_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import sys
sys.path.insert(0, _PKG + "/concepts"); sys.path.insert(0, _PKG + "/concepts/costumes")
sys.argv = sys.argv[:sys.argv.index("--") + 2]
exec(open(_PKG + "/concepts/costumes/mannequin.py").read().replace('run({"mannequin": build})', ''))
out = sys.argv[-1]
for o, t in ((8.5, 3.0), (9.6, 3.9), (10.5, 4.3)):
    render_costume(f"mannequin-o{o}", build, out, ortho=o, target_z=t)
