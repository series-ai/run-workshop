"""Slim the animation in exported GLBs, in place: drop every key that linear
interpolation (slerp for rotations) between its neighbours already
reproduces within a hair, and repack the binary chunk. The clips are baked at
30 fps, so holds and straight moves carry many redundant keys. Plain Python,
no dependencies. (From tools/run-dice-animals; the cat pack adds the
quantising below.)

Geometry is copied through, except that bone weights (WEIGHTS_0) and the tag
colours (COLOR_0) are stored as normalised unsigned bytes instead of floats -
core glTF, so every loader reads them, at a quarter of the size.

    python3 scripts/slim.py kit/builds/*.glb
"""
import json
import math
import struct
import sys

TOL = 1e-4  # units for translation and scale, quaternion components for rotation
COMP = {5126: ("f", 4), 5123: ("H", 2), 5125: ("I", 4), 5121: ("B", 1), 5120: ("b", 1), 5122: ("h", 2)}
NUM = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read(j, binc, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    fmt, size = COMP[a["componentType"]]
    n = NUM[a["type"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    vals = struct.unpack_from(f"<{a['count'] * n}{fmt}", binc, off)
    return [vals[k * n:(k + 1) * n] for k in range(a["count"])]


def slerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b, d = [-x for x in b], -d
    if d > 0.9995:
        r = [x + (y - x) * t for x, y in zip(a, b)]
    else:
        th = math.acos(d)
        s = math.sin(th)
        wa, wb = math.sin((1 - t) * th) / s, math.sin(t * th) / s
        r = [wa * x + wb * y for x, y in zip(a, b)]
    m = math.sqrt(sum(x * x for x in r)) or 1.0
    return [x / m for x in r]


def lerp(a, b, t):
    return [x + (y - x) * t for x, y in zip(a, b)]


def close(v, ref, quat):
    if quat and sum(x * y for x, y in zip(v, ref)) < 0:
        ref = [-x for x in ref]
    return all(abs(x - y) <= TOL for x, y in zip(v, ref))


def reduce(times, vals, quat):
    """Greedy: from each kept key, reach as far as every skipped key still
    sits on the straight (or slerped) line."""
    interp = slerp if quat else lerp
    keep = [0]
    i = 0
    while i < len(times) - 1:
        j = i + 2
        while j < len(times):
            ok = all(close(vals[k], interp(vals[i], vals[j], (times[k] - times[i]) / (times[j] - times[i])), quat)
                     for k in range(i + 1, j))
            if not ok:
                break
            j += 1
        i = j - 1
        keep.append(i)
    return keep


def slim(path):
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    binc = data[20 + jlen + 8:]
    anim_acc = {s[k] for a in j.get("animations", []) for s in a["samplers"] for k in ("input", "output")}

    out = bytearray()
    views = []

    def add_view(blob, target=None):
        while len(out) % 4:
            out.append(0)
        v = {"buffer": 0, "byteOffset": len(out), "byteLength": len(blob)}
        if target:
            v["target"] = target
        out.extend(blob)
        views.append(v)
        return len(views) - 1

    # geometry: weights and colours to normalised bytes, the rest copied through
    quant = {p["attributes"][k] for m in j.get("meshes", []) for p in m["primitives"]
             for k in ("WEIGHTS_0", "COLOR_0") if k in p["attributes"]}
    weights = {p["attributes"]["WEIGHTS_0"] for m in j.get("meshes", []) for p in m["primitives"]
               if "WEIGHTS_0" in p["attributes"]}
    remap = {}
    for i, a in enumerate(j["accessors"]):
        if i in anim_acc or "bufferView" not in a:
            continue
        if i in quant and a["componentType"] == 5126:
            rows = read(j, binc, i)
            q = []
            for r in rows:
                b = [max(0, min(255, round(x * 255))) for x in r]
                if i in weights:                  # weights must still sum to exactly 1
                    b[b.index(max(b))] += 255 - sum(b)
                q += b
            a["bufferView"] = add_view(struct.pack(f"<{len(q)}B", *q), 34962)
            a.pop("byteOffset", None)
            a["componentType"], a["normalized"] = 5121, True
            a.pop("min", None), a.pop("max", None)
            continue
        bvi = a["bufferView"]
        if bvi not in remap:
            bv = j["bufferViews"][bvi]
            o = bv.get("byteOffset", 0)
            remap[bvi] = add_view(data[20 + jlen + 8 + o:20 + jlen + 8 + o + bv["byteLength"]], bv.get("target"))
            if "byteStride" in bv:
                views[remap[bvi]]["byteStride"] = bv["byteStride"]
        a["bufferView"] = remap[bvi]

    # animation: reduced keys, all in one view; identical arrays (the many
    # holds repeat from clip to clip) become one shared accessor
    accessors = j["accessors"]
    anim = bytearray()
    anim_view = len(views)
    cache = {}
    before = after = 0

    def add_acc(blob, typ, count, minmax=None):
        if (blob, typ) not in cache:
            acc = {"bufferView": anim_view, "byteOffset": len(anim), "componentType": 5126, "count": count, "type": typ}
            if minmax:
                acc["min"], acc["max"] = minmax
            anim.extend(blob)
            accessors.append(acc)
            cache[blob, typ] = len(accessors) - 1
        return cache[blob, typ]

    # a node path that sits at its rest value in every clip is never touched
    # by any clip, so its channels go (no engine has anything to reset). Paths
    # that move in any clip keep a channel in every clip, holds included.
    rest = {"translation": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1]}
    moving = set()
    for a in j.get("animations", []):
        for ch in a["channels"]:
            t = ch["target"]
            r = j["nodes"][t["node"]].get(t["path"], rest[t["path"]])
            if any(not close(v, r, t["path"] == "rotation") for v in read(j, binc, a["samplers"][ch["sampler"]]["output"])):
                moving.add((t["node"], t["path"]))

    for a in j.get("animations", []):
        channels, samplers, shared = [], [], {}
        for ch in a["channels"]:
            if (ch["target"]["node"], ch["target"]["path"]) not in moving:
                continue
            s = a["samplers"][ch["sampler"]]
            times = [t[0] for t in read(j, binc, s["input"])]
            vals = read(j, binc, s["output"])
            quat = ch["target"]["path"] == "rotation"
            linear = s.get("interpolation", "LINEAR") == "LINEAR"
            keep = reduce(times, vals, quat) if linear and len(times) > 2 else list(range(len(times)))
            before += len(times)
            after += len(keep)
            kt = [times[k] for k in keep]
            kv = [x for k in keep for x in vals[k]]
            ns = {"input": add_acc(struct.pack(f"<{len(kt)}f", *kt), "SCALAR", len(kt), ([kt[0]], [kt[-1]])),
                  "output": add_acc(struct.pack(f"<{len(kv)}f", *kv), accessors[s["output"]]["type"], len(keep))}
            if not linear:  # LINEAR is the default
                ns["interpolation"] = s["interpolation"]
            key = json.dumps(ns, sort_keys=True)
            if key not in shared:  # channels with identical keys share a sampler
                samplers.append(ns)
                shared[key] = len(samplers) - 1
            channels.append({"sampler": shared[key], "target": ch["target"]})
        a["channels"], a["samplers"] = channels, samplers
    if anim:
        add_view(bytes(anim))

    # drop the old animation accessors, renumbering every reference
    idx, new_acc = {}, []
    for i, a in enumerate(accessors):
        if i in anim_acc:
            continue
        idx[i] = len(new_acc)
        new_acc.append(a)
    j["accessors"] = new_acc
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            p["attributes"] = {k: idx[v] for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = idx[p["indices"]]
            for t in p.get("targets", []):
                for k in t:
                    t[k] = idx[t[k]]
    for a in j.get("animations", []):
        for s in a["samplers"]:
            s["input"], s["output"] = idx[s["input"]], idx[s["output"]]

    j["bufferViews"] = views
    while len(out) % 4:
        out.append(0)
    j["buffers"] = [{"byteLength": len(out)}]
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
    glb += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + bytes(out)
    open(path, "wb").write(glb)
    print(f"{path}: {len(data) // 1024} -> {len(glb) // 1024} KB, keys {before} -> {after}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        slim(p)
