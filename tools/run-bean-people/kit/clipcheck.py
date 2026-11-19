"""Clipping test for the boxy-tall kit GLBs.

For each layered combination (base + top, top + extra, ...), checks the
exported geometry for
    pokes  inner-layer vertices that sit outside the outer layer's surface
           where the outer layer covers them (they show through)
    sunk   outer-layer vertices buried inside the inner garment (they vanish)
and writes clip-report.json plus, with --render, a card per combo with the
offending vertices marked in red.

    Blender -b --factory-startup --python clipcheck.py -- <kit dir> [--render <out dir>] [combo ...]
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
KIT = os.path.abspath(argv[0])
RENDER = None
if "--render" in argv:
    RENDER = os.path.abspath(argv[argv.index("--render") + 1])
    argv = argv[:argv.index("--render")] + argv[argv.index("--render") + 2:]
ONLY = argv[1:]
kit = json.load(open(os.path.join(KIT, "kit.json")))

POKE_DEPTH = 0.2   # how far below an inner vertex to look for the outer layer's outer wall
EMBED_REACH = 0.25
TOL = 0.004        # ignore tangential grazes thinner than this


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(KIT, "glb", f"{name}.glb"))
    obs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    for o in obs:
        o["part"] = name
    return obs


def world_bm(obs):
    bm = bmesh.new()
    for o in obs:
        me = o.data
        tmp = bmesh.new()
        tmp.from_mesh(me)
        tmp.transform(o.matrix_world)
        m2 = bpy.data.meshes.new("tmp")
        tmp.to_mesh(m2)
        tmp.free()
        bm.from_mesh(m2)
        bpy.data.meshes.remove(m2)
    bm.normal_update()
    return bm


def verts(obs):
    out = []
    for o in obs:
        mw = o.matrix_world
        nm = mw.to_3x3().inverted().transposed()
        for v in o.data.vertices:
            out.append((o.name, mw @ v.co, (nm @ v.normal).normalized()))
    return out


def check(inner_obs, outer_obs, skip_inner=()):
    """pokes: inner verts outside the outer layer; sunk: outer verts inside inner garments."""
    obm = world_bm(outer_obs)
    outer = BVHTree.FromBMesh(obm)
    pokes = []
    own = {}
    for o in inner_obs:
        b = world_bm([o])
        own[o.name] = BVHTree.FromBMesh(b)
        b.free()
    for name, p, n in verts([o for o in inner_obs if o.name.split(".")[0] not in skip_inner]):
        start = p + n * 1e-3
        hit = outer.ray_cast(start, -n, POKE_DEPTH)
        if hit[0] is None or hit[3] < TOL:
            continue
        far = own[name].ray_cast(p - n * 2e-3, -n, POKE_DEPTH)
        if far[0] is not None and far[3] < hit[3]:
            continue  # the outer layer is beyond this part's own far side
        if hit[1].dot(-n) < 0:  # hit an outward-facing wall below us: we are outside the layer
            up = outer.ray_cast(start, n, EMBED_REACH)
            if up[0] is None or up[1].dot(n) > 0:
                pokes.append((name.split(".")[0], p, hit[3]))
    sunk = []
    garments = [o for o in inner_obs if not o["part"].startswith(("base", "face", "screen"))]
    if garments:
        ibm = world_bm(garments)
        inner = BVHTree.FromBMesh(ibm)
        for name, p, n in verts(outer_obs):
            hit = inner.ray_cast(p + n * 1e-3, n, EMBED_REACH)
            if hit[0] is not None and hit[1].dot(n) > 0 and hit[3] > TOL:
                sunk.append((name.split(".")[0], p, hit[3]))
        ibm.free()
    obm.free()
    return pokes, sunk


def combos():
    tops, heads, extras, hooded = kit["tops"], kit["heads"], kit["extras"], kit["hooded"]
    out = []
    for t in tops:
        out.append((f"top-{t}", ["base", "face-x"], [f"top-{t}"]))
    for t in hooded:
        out.append((f"top-{t}-screen", ["base", "screen"], [f"top-{t}-screen"]))
    for h in heads:
        out.append((f"head-{h}", ["base", "face-x"], [f"head-{h}"]))
    for e in extras:
        out.append((f"extra-{e}", ["base"], [f"extra-{e}"]))
    for t in tops:
        for e in extras:
            out.append((f"top-{t}+extra-{e}", ["base", f"top-{t}"], [f"extra-{e}"]))
        if t not in hooded:
            for h in heads:
                out.append((f"top-{t}+head-{h}", ["base", f"top-{t}"], [f"head-{h}"]))
    return out


def mark_render(name, layers, pokes, sunk, out):
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.get("part") not in layers:
            o.hide_render = True
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = 520, 700
    red = bpy.data.materials.get("clip-red") or bpy.data.materials.new("clip-red")
    red.use_nodes = True
    b = red.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (1, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (1, 0, 0, 1)
    b.inputs["Emission Strength"].default_value = 3
    mk = []
    me = bpy.data.meshes.new("marks")
    bm = bmesh.new()
    for _, p, _ in (pokes + sunk)[::3]:
        r = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.018)
        bmesh.ops.translate(bm, vec=p, verts=r["verts"])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("marks", me)
    me.materials.append(red)
    sc.collection.objects.link(ob)
    for view, loc in (("front", (1.2, -5.0, 1.9)), ("back", (-1.2, 5.0, 1.9))):
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.lens = 50
        sc.collection.objects.link(cam)
        cam.location = loc
        cam.rotation_euler = (Vector((0, 0, 1.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam
        sc.render.filepath = os.path.join(out, f"clip-{name}-{view}.png")
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)
    bpy.data.objects.remove(ob)


def main():
    report = {}
    for name, inner_parts, outer_parts in combos():
        if ONLY and name not in ONLY:
            continue
        bpy.ops.wm.read_factory_settings(use_empty=True)
        inner = [o for p in inner_parts for o in load(p)]
        outer = [o for p in outer_parts for o in load(p)]
        # arms legitimately pass through sleeveless armholes; report them apart
        pokes, sunk = check(inner, outer)
        by = {}
        for nm, _, d in pokes:
            e = by.setdefault(nm, [0, 0.0])
            e[0] += 1
            e[1] = max(e[1], d)
        report[name] = {"pokes": {k: {"verts": v[0], "max_depth": round(v[1], 3)} for k, v in by.items()},
                        "sunk": {"verts": len(sunk), "max_depth": round(max([d for *_, d in sunk], default=0), 3)}}
        tot = sum(v[0] for v in by.values())
        print(f"CLIP {name:34s} pokes {tot:5d} {dict((k, v[0]) for k, v in by.items())}  sunk {len(sunk)}")
        if RENDER and (tot or sunk):
            os.makedirs(RENDER, exist_ok=True)
            sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
            sun.data.energy = 3
            sun.rotation_euler = (0.8, 0.2, 0.6)
            bpy.context.scene.collection.objects.link(sun)
            w = bpy.data.worlds.new("w")
            w.use_nodes = True
            w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
            bpy.context.scene.world = w
            mark_render(name, inner_parts + outer_parts, pokes, sunk, RENDER)
    with open(os.path.join(KIT, "clip-report.json"), "w") as fh:
        json.dump(report, fh, indent=1)
    print("WROTE clip-report.json")


main()
