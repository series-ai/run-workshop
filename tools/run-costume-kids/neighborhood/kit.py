"""Shared helpers for the neighbourhood props: the kids' primitives plus
finish / export / render for phone-ready single-mesh props.

A prop script does:

    import os, sys
    sys.dont_write_bytecode = True
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    from kit import *

then builds pieces with box / ball / can / limb / hull (pieces made inside
`with glow():` become the emissive GLOW part), and calls
`finish_prop(name)`, `export_prop(name, path)` and `render_sheet(name, out)`.

Units match the kids (a kid is ~5.5 tall). Pivot at the base centre on z = 0,
front facing -y.
"""
import json
import math
import os
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, "..", "concepts", "blockout.py")).read()
exec(compile(_src[: _src.rindex("\nmain()")], "blockout.py", "exec"))  # box, ball, can, limb, mat, _mats, ...

GLB_DIR = os.path.join(HERE, "glb")
GLOW_RGB = (1.0, 0.64, 0.26)   # the one warm emissive colour (sRGB)
GLOW_STRENGTH = 1.3


@contextmanager
def glow():
    """Every piece made inside the block is emissive (lit windows, door, lanterns)."""
    before = set(bpy.data.objects)
    yield
    for o in set(bpy.data.objects) - before:
        o["glow"] = 1


def hull(points, rgb, bevel=0.0, segs=1):
    """A convex solid from points (wedges, prisms, frustums)."""
    me = bpy.data.meshes.new("hull")
    bm = bmesh.new()
    for p in points:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("hull", me)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, rgb, bevel, segs)


def prism(x, y, z, w, h, d, rgb, bevel=0.0):
    """A triangular prism (a gable): base w wide at z, apex h above, d deep along y, centred on (x, y)."""
    pts = []
    for yy in (y - d / 2, y + d / 2):
        pts += [(x - w / 2, yy, z), (x + w / 2, yy, z), (x, yy, z + h)]
    return hull(pts, rgb, bevel)


def frustum(x, y, z, w, d, h, w2, d2, rgb, bevel=0.0):
    """A box that narrows to w2 x d2 at the top (hip roofs, chimneys, bases)."""
    pts = [(x + sx * w / 2, y + sy * d / 2, z) for sx in (-1, 1) for sy in (-1, 1)]
    pts += [(x + sx * w2 / 2, y + sy * d2 / 2, z + h) for sx in (-1, 1) for sy in (-1, 1)]
    return hull(pts, rgb, bevel)


def _shared_mats():
    pal = bpy.data.materials.get("PALETTE") or bpy.data.materials.new("PALETTE")
    pal.use_nodes = True
    nt = pal.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 0.9
    if not any(n.type == "VERTEX_COLOR" for n in nt.nodes):
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    gl = bpy.data.materials.get("GLOW") or bpy.data.materials.new("GLOW")
    gl.use_nodes = True
    b = gl.node_tree.nodes.get("Principled BSDF")
    lin = (*[c ** 2.2 for c in GLOW_RGB], 1.0)
    b.inputs["Base Color"].default_value = lin
    b.inputs["Emission Color"].default_value = lin
    b.inputs["Emission Strength"].default_value = GLOW_STRENGTH
    gl.diffuse_color = (*GLOW_RGB, 1.0)
    return pal, gl


def finish_prop(name, recentre=True):
    """Apply modifiers, bake each piece's colour into vertex colours, put every
    face on PALETTE or GLOW and join all mesh pieces into one object `name`.
    recentre=False keeps the build's own origin (kit parts that assemble in place).
    Returns the triangle count."""
    pal, gl = _shared_mats()
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        src = o.data.materials[0].diffuse_color if o.data.materials else (0.5, 0.5, 0.5, 1)
        lin = (*[c ** 2.2 for c in src[:3]], 1.0)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear()
        o.data = me
        me.materials.clear()
        me.materials.append(pal)
        me.materials.append(gl)
        is_glow = bool(o.get("glow"))
        for p in me.polygons:
            p.material_index = 1 if is_glow else 0
            p.use_smooth = False
        ca = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for d in ca.data:
            d.color = lin
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    ob.data.name = name
    ob.data.color_attributes.active_color = ob.data.color_attributes["Col"]
    if not any(p.material_index == 1 for p in ob.data.polygons):
        ob.data.materials.pop(index=1)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if not recentre:
        return sum(len(p.vertices) - 2 for p in ob.data.polygons)
    vs = [v.co for v in ob.data.vertices]  # pivot: base centre on z = 0
    lo = Vector([min(v[i] for v in vs) for i in range(3)])
    hi = Vector([max(v[i] for v in vs) for i in range(3)])
    shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for v in ob.data.vertices:
        v.co += shift
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def export_prop(name, path):
    ob = bpy.data.objects[name]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True,
                              export_apply=True, export_vertex_color="ACTIVE", export_lights=False,
                              export_cameras=False)
    return len(ob.data.materials)


def update_index(entries):
    """Merge [{"slug", "tris", "kind"}] into glb/index.json by slug."""
    path = os.path.join(GLB_DIR, "index.json")
    old = json.load(open(path)) if os.path.exists(path) else []
    by = {e["slug"]: e for e in old}
    for e in entries:
        by[e["slug"]] = e
    os.makedirs(GLB_DIR, exist_ok=True)
    with open(path, "w") as fh:
        json.dump(sorted(by.values(), key=lambda e: (e["kind"], e["slug"])), fh, indent=1)


VIEWS = (("34", (0.62, -1.0, 0.42)), ("front", (0.0, -1.0, 0.18)), ("back", (-0.35, 1.0, 0.3)))


def render_sheet(name, out_dir):
    """Render 3/4 front, front and back of object `name` on a light background, plus a sheet."""
    scene = bpy.context.scene
    ob = bpy.data.objects[name]
    pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    size = max(max(p[i] for p in pts) - min(p[i] for p in pts) for i in range(3))
    height = max(p.z for p in pts)
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.3
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
    scene.collection.objects.link(sun)
    scene.render.resolution_x, scene.render.resolution_y = 700, 820
    scene.render.film_transparent = True
    os.makedirs(out_dir, exist_ok=True)
    pngs = []
    for view, d in VIEWS:
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = size * 1.3
        scene.collection.objects.link(cam)
        target = Vector((0, 0, height * 0.5))
        cam.location = target + Vector(d).normalized() * (size * 4 + 20)
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = size * 10 + 100
        scene.camera = cam
        png = os.path.join(out_dir, f"{name}-{view}.png")
        scene.render.filepath = png
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)
        pngs.append(png)
    _sheet(pngs, os.path.join(out_dir, f"{name}-sheet.png"))
    bpy.data.objects.remove(sun)


def _sheet(pngs, out):
    import numpy as np
    imgs = [bpy.data.images.load(p) for p in pngs]
    w, h = imgs[0].size
    bg = np.array([0.86, 0.83, 0.78])
    tiles = []
    for img in imgs:
        a = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        a = a.reshape(h, w, 4)
        tiles.append(a[..., :3] * a[..., 3:4] + bg * (1 - a[..., 3:4]))
    rgb = np.concatenate(tiles, axis=1)
    full = np.concatenate([rgb, np.ones(rgb.shape[:2] + (1,))], axis=2).astype(np.float32)
    sheet = bpy.data.images.new("sheet", w * len(imgs), h, alpha=False)
    sheet.pixels.foreach_set(full.ravel())
    sheet.filepath_raw = out
    sheet.file_format = "PNG"
    sheet.save()


def build_and_ship(slug, kind, build, out_dir):
    """Fresh scene -> build() -> one mesh -> GLB + sheet. Returns the index entry."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    build()
    tris = finish_prop(slug)
    calls = export_prop(slug, os.path.join(GLB_DIR, f"{slug}.glb"))
    render_sheet(slug, out_dir)
    print(f"PROP {slug}: {tris} tris, {calls} draw calls")
    return {"slug": slug, "tris": tris, "kind": kind}


def out_dir_arg():
    import sys
    return sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.join(HERE, "renders")
