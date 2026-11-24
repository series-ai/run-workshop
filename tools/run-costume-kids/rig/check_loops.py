"""Check the exported GLBs play smoothly: every clip's last frame equals its first (a seamless
loop), and no part's motion changes abruptly from one frame to the next (a pop or twitch:
a spike in the frame-to-frame change, measured round the loop, so fast but smooth moves pass).

    python3 rig/check_loops.py [previewer/chars]   -> one line per problem, then a summary
"""
import glob
import json
import os
import struct
import sys

LOOP_TOL = 1e-3   # first vs last frame
ONESHOT = {"death"}  # clips that end in a different pose: no loop check, and no wrap for pops
POP_TOL = {"rotation": 0.22, "translation": 0.3}  # second difference per frame; the run's foot strike and the jump's arm fling reach ~0.18, a real pop ~0.3+

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "previewer", "chars")
bad = 0
files = sorted(glob.glob(os.path.join(d, "*.glb")))
for path in files:
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[12:16])[0]
    j = json.loads(data[20:20 + n])
    binary = data[20 + n + 8:]

    def read(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        k = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[a["type"]]
        start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        return [struct.unpack_from("<" + "f" * k, binary, start + 4 * k * c) for c in range(a["count"])]

    slug = os.path.basename(path)[:-4]
    for an in j.get("animations", []):
        for ch in an["channels"]:
            vals = read(an["samplers"][ch["sampler"]]["output"])
            node = j["nodes"][ch["target"]["node"]]["name"]
            path_ = ch["target"]["path"]
            one = an["name"] in ONESHOT
            gap = max(abs(a - b) for a, b in zip(vals[0], vals[-1]))
            if gap > LOOP_TOL and not one:
                bad += 1
                print(f"LOOP {slug} {an['name']} {node}.{path_} first/last differ by {gap:.3f}")
            if path_ == "scale":
                continue
            loop = vals if one else vals[:-1]  # a loop's last frame repeats the first
            m = len(loop)
            for i in (range(1, m - 1) if one else range(m)):
                a, b, c = loop[i - 1], loop[i], loop[(i + 1) % m]
                if path_ == "rotation" and sum(x * y for x, y in zip(a, b)) < 0:
                    a = tuple(-x for x in a)
                if path_ == "rotation" and sum(x * y for x, y in zip(c, b)) < 0:
                    c = tuple(-x for x in c)
                if one and path_ == "translation":
                    continue  # a one-shot may stop dead on purpose (the death slam)
                pop = max(abs(x - 2 * y + z) for x, y, z in zip(a, b, c))
                if pop > POP_TOL[path_] * (1.6 if one else 1.0):  # a one-shot's impact may snap a little harder
                    bad += 1
                    print(f"POP {slug} {an['name']} {node}.{path_} frame {i} jerk {pop:.3f}")
print(f"{len(files)} files checked, {bad} problems")
sys.exit(1 if bad else 0)
