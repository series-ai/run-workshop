"""Export Glowdrop Critters as game-ready GLBs from the same procedural builders
the concept boards use.

    cd tools/run-theme-packs/glowdrop/build
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 1 --python export.py -- out [path-prefix ...]

Each asset becomes one GLB, +Y up with the front facing +Z. Parts tagged with
common.part() become child nodes (pivot at their joint) so clips can move them;
everything else merges into the root mesh. Clips (clips.py) are node TRS
animations, one glTF animation per clip.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "concepts"))
sys.path.insert(0, os.path.join(HERE, "..", "..", "shared"))

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import kit  # noqa: E402
import catalog  # noqa: E402
import clips as cliplib  # noqa: E402

FPS = 30


def merge(objs, name):
    """Join mesh objects (world space) into one new object; materials unioned."""
    mats, bm = [], bmesh.new()
    for o in objs:
        tmp = o.data.copy()
        tmp.transform(o.matrix_world)
        remap = []
        for m in tmp.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        for p in tmp.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = False
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def assemble(asset_id, center=False):
    """Group the built primitives into a root + part hierarchy, pivots at joints."""
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    groups, pivots, parents = {}, {}, {}
    for o in meshes:
        p = o.get("part", "") or ""
        groups.setdefault(p, []).append(o)
        if p:
            pivots[p] = Vector(o["pivot"])
            parents[p] = o.get("parent_part", "") or ""
    offset = Vector((0, 0, 0))
    if center:  # swimmers and fliers: origin at the body centre, not the floor
        pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        offset = -(lo + hi) / 2
    root_parts = groups.pop("", [])
    root = merge(root_parts, asset_id) if root_parts else bpy.data.objects.new(asset_id, None)
    if not root_parts:
        bpy.context.scene.collection.objects.link(root)
    root.data and root.data.transform(Matrix.Translation(offset))
    nodes = {"": root}
    # parents first
    order, seen = [], set()

    def visit(p):
        if p in seen or p == "":
            return
        visit(parents.get(p, ""))
        seen.add(p)
        order.append(p)
    for p in list(groups) + list(parents.values()):
        visit(p)
    for p in order:
        piv = pivots.get(p, Vector((0, 0, 0))) + offset
        if p in groups:
            ob = merge(groups[p], f"{asset_id}.{p}")
            ob.data.transform(Matrix.Translation(offset - piv))  # verts are world space; move into the shifted pivot frame
        else:
            ob = bpy.data.objects.new(f"{asset_id}.{p}", None)
            bpy.context.scene.collection.objects.link(ob)
        par = nodes[parents.get(p, "")]
        ob.parent = par
        par_piv = pivots.get(parents.get(p, ""), Vector((0, 0, 0))) + offset if parents.get(p, "") else Vector((0, 0, 0))
        ob.location = piv - par_piv
        ob.rotation_mode = "QUATERNION"
        nodes[p] = ob
    for o in meshes:
        bpy.data.objects.remove(o, do_unlink=True)
    root.rotation_mode = "QUATERNION"
    return root, nodes


def export(path, animated):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_yup=True, export_apply=False,
        export_texcoords=False, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_vertex_color="NONE", export_extras=False,
        export_cameras=False, export_lights=False,
        export_animations=animated, export_animation_mode="ACTIONS", export_merge_animation="ACTION",
        export_force_sampling=True, export_optimize_animation_size=True,
        export_skins=False, export_morph=False,
    )


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = os.path.abspath(argv[0] if argv else "out")
    only = argv[1:]
    bpy.context.scene.render.fps = FPS
    report = []
    for a in catalog.ASSETS:
        if only and not any(a["path"].startswith(o) for o in only):
            continue
        kit._clear()
        with kit.at((0, 0, 0), rz=a.get("turn", 0), s=a.get("scale", 1.0)):
            a["fn"]()
        root, nodes = assemble(os.path.basename(a["path"]), center=a.get("center", False))
        for sname, pos in a.get("sockets", {}).items():  # named empty nodes games attach things to
            e = bpy.data.objects.new(sname, None)
            bpy.context.scene.collection.objects.link(e)
            e.parent = root
            e.location = Vector(pos)
        names = []
        for clip in a.get("clips", []):
            cliplib.bake(clip, nodes, FPS, a.get("turn", 0))
            names.append(clip["name"])
        tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == "MESH" for p in o.data.polygons)
        export(os.path.join(out, a["path"] + ".glb"), bool(names))
        for act in list(bpy.data.actions):  # clip names must stay clean ("swim", not "swim.012") in the next asset
            bpy.data.actions.remove(act)
        report.append({"path": a["path"], "tris": tris, "parts": len(nodes) - 1, "clips": names})
        print(f"[export] {a['path']}  tris={tris}  parts={len(nodes) - 1}  clips={names}")
    json.dump(report, open(os.path.join(out, "report.json" if not only else "report-partial.json"), "w"), indent=1)


main()
