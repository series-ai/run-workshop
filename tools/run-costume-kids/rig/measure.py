"""Per-character cost from the exported GLBs: draw calls (mesh primitives), materials, triangles,
nodes, animation channels and bytes (geometry vs animation). Plain Python, no Blender.

    python3 rig/measure.py [previewer/chars]
"""
import glob
import json
import os
import struct
import sys

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "previewer", "chars")
rows = []
for path in sorted(glob.glob(os.path.join(d, "*.glb"))):
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[12:16])[0]
    j = json.loads(data[20:20 + n])
    acc, bvs = j["accessors"], j["bufferViews"]
    prims = [p for m in j["meshes"] for p in m["primitives"]]
    tris = sum((acc[p["indices"]]["count"] if "indices" in p else acc[p["attributes"]["POSITION"]]["count"]) // 3 for p in prims)
    verts = sum(acc[p["attributes"]["POSITION"]]["count"] for p in prims)
    used = set()
    def nbytes(i):
        a = acc[i]
        used.add(a["bufferView"])
        return bvs[a["bufferView"]]["byteLength"]
    anim_bytes = sum(nbytes(s["input"]) + nbytes(s["output"]) for a in j.get("animations", []) for s in a["samplers"])
    chans = sum(len(a["channels"]) for a in j.get("animations", []))
    rows.append((os.path.basename(path)[:-4], len(prims), len(j.get("materials", [])), tris, verts, len(j["nodes"]), chans,
                 os.path.getsize(path), anim_bytes))
rows.sort(key=lambda r: -r[1])
print(f"{'character':<24}{'draws':>6}{'mats':>5}{'tris':>8}{'verts':>8}{'nodes':>6}{'chans':>6}{'KB':>7}{'animKB':>7}")
for r in rows[:15]:
    print(f"{r[0]:<24}{r[1]:>6}{r[2]:>5}{r[3]:>8}{r[4]:>8}{r[5]:>6}{r[6]:>6}{r[7] // 1024:>7}{r[8] // 1024:>7}")
k = len(rows)
avg = [sum(r[i] for r in rows) / k for i in range(1, 9)]
print(f"{'AVERAGE (' + str(k) + ')':<24}{avg[0]:>6.0f}{avg[1]:>5.0f}{avg[2]:>8.0f}{avg[3]:>8.0f}{avg[4]:>6.0f}{avg[5]:>6.0f}{avg[6] / 1024:>7.0f}{avg[7] / 1024:>7.0f}")
print(f"{'MIN':<24}" + "".join(f"{min(r[i] for r in rows):>{w}}" for i, w in zip(range(1, 9), (6, 5, 8, 8, 6, 6, 7, 7))))
