"""Check the exported GLBs play smoothly: every clip's last frame equals its first (a seamless
loop), and no part's motion changes abruptly from one frame to the next (a pop or twitch:
a spike in the frame-to-frame change, measured round the loop, so fast but smooth moves pass).

    python3 rig/check_loops.py [rigged/glb]  (adapted from run-costume-kids)   -> one line per problem, then a summary
"""
import glob
import json
import os
import struct
import sys

LOOP_TOL = 1e-3   # first vs last frame
ONESHOT = {k for k, v in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rigged", "clips.json"))).items() if not v["loop"]}
LAUNCH_TOL = 0.15  # m/frame^2 of upward kick in the root: more is a teleport off the floor
HARD_CAP = 0.9  # rad: past this a frame-to-frame change always counts as a pop
SNAPS = {"dance-robot", "throw", "punch"}  # the jab is meant to snap  # deliberate snaps: the robot pops between poses, the throw whips
POP_TOL = {"rotation": 0.22, "translation": 0.3}  # second difference per frame; the run's foot strike and the jump's arm fling reach ~0.18, a real pop ~0.3+

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rigged", "glb")
bad = 0
files = [os.path.join(d, "base.glb")]
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
            if node == "root" and path_ == "translation":
                # launch pop: the body leaves the floor in one frame (a landing brake is fine) (bone-local y is up). Lift-off needs a
                # push phase (legs extend over 2+ frames); landings may stop dead, so only upward kicks count.
                for i in range(1, len(vals) - 1):
                    v0, v1 = vals[i][1] - vals[i - 1][1], vals[i + 1][1] - vals[i][1]
                    kick = v1 - v0
                    if kick > LAUNCH_TOL and v0 > -0.03 and v1 > 0.1:     # still before, shooting up after
                        bad += 1
                        print(f"LAUNCH {slug} {an['name']} frame {i} up-kick {kick:.3f} m")
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
                # a pop is a one-frame glitch: a jerk spike whose neighbours jerk the other way. A snap
                # (fast but smooth over 3+ frames) accelerates then decelerates a few frames apart.
                if HARD_CAP > pop > POP_TOL[path_] and m > 3 and not one:
                    def jerk(j):
                        u, v, w = loop[(j - 1) % m], loop[j % m], loop[(j + 1) % m]
                        if path_ == "rotation":
                            if sum(p_ * q for p_, q in zip(u, v)) < 0: u = tuple(-x for x in u)
                            if sum(p_ * q for p_, q in zip(w, v)) < 0: w = tuple(-x for x in w)
                        return [x - 2 * y + z for x, y, z in zip(u, v, w)]
                    j0, jm, jp = jerk(i), jerk(i - 1), jerk(i + 1)
                    k = max(range(len(j0)), key=lambda q: abs(j0[q]))
                    if not (jm[k] * j0[k] < 0 and jp[k] * j0[k] < 0 and min(abs(jm[k]), abs(jp[k])) > 0.4 * abs(j0[k])):
                        continue
                if pop > POP_TOL[path_] * (3.0 if one else 1.0) and an["name"] not in SNAPS:  # one-shots hit hard on purpose; loops stay smooth  # a one-shot's impact may snap a little harder
                    bad += 1
                    print(f"POP {slug} {an['name']} {node}.{path_} frame {i} jerk {pop:.3f}")
print(f"{len(files)} files checked, {bad} problems")
sys.exit(1 if bad else 0)
