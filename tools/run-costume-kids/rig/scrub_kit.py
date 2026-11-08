"""Scrub test for the avatar kit: scrub.py's checks (a piece detaching from what it touched at
rest, sinking below the floor, poking into a big piece of another part) on combinations of
wardrobe items, posed with exactly the kit's motion (the clips baked on the stand-in kid,
wardrobe.kit_proxy). Every clip, SAMPLES moments each.

    Blender -b --factory-startup --python scrub_kit.py -- [<set> ...]   (no sets: all)

Sets: layers (every top over every bottoms), hair (every hairstyle with the tops that reach the
neck), props (every prop with the widest skirts and coats), feet (every shoe with every bottoms).
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys

SETS = sys.argv[sys.argv.index("--") + 1:]
_s = open(_PKG + "/rig/scrub.py").read()
exec(compile(_s[:_s.index("\nfor slug in CHARS")], "scrub.py", "exec"))  # toyanim, pose_guarded, shells, depth_inside, ...

import os  # noqa: E402

import wardrobe as WD  # noqa: E402

SAMPLES = 10
BUILDS["kit-proxy"] = WD.kit_proxy
parts, rest = build_rig("kit-proxy")
PLANS = {}
for label, clip, period, _ in CLIPS:
    n = max(2, round(period * FPS))
    PLANS[label] = (n, guard_plan(parts, rest, clip, period, n))


def clear():
    for e in parts.values():
        e.location, e.rotation_euler, e.scale = rest[e.name], (0, 0, 0), (1, 1, 1)
    for o in [o for o in bpy.data.objects if o.type == "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.view_layer.update()


def dressed(look):
    """Build the look at rest and hang every piece on its part. Expression pieces are left out."""
    clear()
    WD.dress(look)
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in [o for o in objs if "expr" in o]:
        bpy.data.objects.remove(o, do_unlink=True)
    objs = [o for o in bpy.data.objects if o.type == "MESH"]
    tags = tagged_parts(objs)
    bone = {o: ANCHOR[tags[o]] for o in objs}
    for o in objs:
        e = parts[bone[o]]
        mw = o.matrix_world.copy()
        o.parent = e
        o.matrix_world = mw
    return bone


def scrub(name, look):
    owner = dressed(look)
    objs = list(owner)
    trees = shells(objs)
    movers = [o for o in objs if not owner[o].startswith(("hips", "root")) and not o.name.startswith("neck_stub")]
    samples = {o: [Vector(v.co) for v in o.data.vertices][:: max(1, len(o.data.vertices) // 40)] for o in movers}

    def pokes():
        out = {}
        for b, tree in trees.items():
            inv = b.matrix_world.inverted()
            for o in movers:
                if owner[o] == owner[b] or o is b:
                    continue
                d = depth_inside(tree, inv, [o.matrix_world @ v for v in samples[o]])
                if d > 0:
                    out[(o, b)] = d
        return out
    bpy.context.view_layer.update()
    poke0, b0 = pokes(), boxes(objs)
    nbrs = {o: [q for q in objs if q is not o and gap(b0[o], b0[q]) < TOUCH] for o in objs}
    worst, sink, poke = {}, {}, {}
    for label, clip, period, _ in CLIPS:
        n, plan = PLANS[label]
        last = n if clip.__name__ in ONESHOT else n - 1
        for f in sorted({round(last * i / (SAMPLES - 1)) for i in range(SAMPLES)}):
            pose_guarded(parts, rest, clip, period, f, n, plan)
            bpy.context.view_layer.update()
            t = round(period * f / n, 2)
            b = boxes(objs)
            for o in objs:
                if nbrs[o]:
                    sep = min(gap(b[o], b[q]) for q in nbrs[o])
                    if sep > TOL and sep > worst.get(o, (0,))[0]:
                        worst[o] = (sep, label, t)
                if b[o][0].z < FLOOR and b[o][0].z < sink.get(o, (0,))[0]:
                    sink[o] = (b[o][0].z, label, t)
            for key, d in pokes().items():
                extra = d - poke0.get(key, 0.0)
                if extra > POKE and extra > poke.get(key, (0,))[0]:
                    poke[key] = (extra, label, t)
    for o, (sep, label, t) in worst.items():
        print("DETACH", name, owner[o], _colour(o), f"sep={sep:.2f}", label, t, flush=True)
    for o, (z, label, t) in sink.items():
        print("SINK", name, owner[o], _colour(o), f"z={z:.2f}", label, t, flush=True)
    for (o, bq), (extra, label, t) in sorted(poke.items(), key=lambda kv: -kv[1][0]):
        print("POKE", name, owner[o], _colour(o), "into", owner[bq], _colour(bq), f"depth=+{extra:.2f}", label, t, flush=True)
    print("DONE", name, len(worst), len(sink), len(poke), flush=True)


def look(**kw):
    L = {"hair": ("crop", "black"), "face": ("none", "-"), "top": ("tee", "white"), "bottom": ("pants", "charcoal"),
         "shoes": ("sneakers", "white"), "prop": ("none", "-")}
    L.update({k: (v, next(iter(WD.ITEMS[k][v]["ways"]))) for k, v in kw.items()})
    return L


I = {slot: list(WD.ITEMS[slot]) for slot in WD.SLOTS}
COMBOS = {
    "layers": [(f"{t}+{b}", look(top=t, bottom=b)) for t in I["top"] for b in I["bottom"]],
    "hair": [(f"{h}+{t}", look(hair=h, top=t)) for h in I["hair"] for t in ("puffer", "raincoat", "sweater", "hoodie")],
    "props": [(f"{p}+{b}+{t}", look(prop=p, bottom=b, top=t)) for p in I["prop"] if p != "none"
              for b, t in (("tutu", "tee"), ("skirt", "tee"), ("pants", "raincoat"), ("pants", "puffer"))],
    "feet": [(f"{s}+{b}", look(shoes=s, bottom=b)) for s in I["shoes"] for b in I["bottom"]],
}
ONLY = os.environ.get("KIT_ONLY", "")  # a substring: only the combinations whose name has it
for s in SETS or list(COMBOS):
    for name, L in COMBOS[s]:
        if ONLY not in name:
            continue
        try:
            scrub(name, L)
        except Exception as ex:
            print("FAIL", name, repr(ex), flush=True)
