"""Review strips: frames of clips from a dice GLB, one row per clip, from a
camera that stays fixed for the whole clip (so travel, drops and slams show).

    Blender -b --factory-startup -t 1 --python strip.py -- <glb> <out png> <frames> clip [clip ...]
"""
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
glb, out, nfr, clips = args[0], args[1], int(args[2]), args[3:]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=glb)
objs = list(scene.objects)


def play(clip):
    a = next(x for x in bpy.data.actions if x.name.split(".")[0] == clip)
    for o in objs:
        ad = o.animation_data
        if not ad:
            continue
        for tr in ad.nla_tracks:
            tr.mute = True
            for st in tr.strips:
                if st.action == a:
                    ad.action, ad.action_slot = a, st.action_slot
    return round(a.frame_range[1])


def bounds():
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.98, 0.94, 0.88, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.3
sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
scene.collection.objects.link(sun)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
g = bpy.data.materials.new("g")
g.use_nodes = True
g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.78, 0.42, 1)
bpy.context.object.data.materials.append(g)
size = 300
scene.render.resolution_x = scene.render.resolution_y = size
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
scene.collection.objects.link(cam)
scene.camera = cam
tmp = tempfile.mkdtemp()
rows = []
for clip in clips:
    last = play(clip)
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for f in range(0, last + 1, 2):
        scene.frame_set(f)
        a, b = bounds()
        lo, hi = Vector(map(min, lo, a)), Vector(map(max, hi, b))
    centre = (lo + hi) / 2
    span = max((hi - lo).length, 4.0)
    cam.data.ortho_scale = span * 1.05
    cam.location = centre + Vector((1.0, -0.9, 0.45)).normalized() * 60
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 300
    times = [round(last * i / (nfr - 1)) for i in range(nfr)]
    row = []
    for f in times:
        scene.frame_set(f)
        p = os.path.join(tmp, f"{clip}-{f:03d}.png")
        scene.render.filepath = p
        bpy.ops.render.render(write_still=True)
        row.append((f, p))
    rows.append((clip, row))

# compose with Blender's image API (no PIL inside Blender)
import numpy as np  # noqa: E402
W, H = nfr * size, len(rows) * size
sheet = np.ones((H, W, 4), dtype=np.float32)
for r, (clip, row) in enumerate(rows):
    for c, (f, p) in enumerate(row):
        img = bpy.data.images.load(p)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
        y0 = H - (r + 1) * size
        sheet[y0:y0 + size, c * size:(c + 1) * size] = px
out_img = bpy.data.images.new("sheet", W, H, alpha=True)
out_img.pixels = sheet.ravel()
out_img.filepath_raw = out
out_img.file_format = "PNG"
out_img.save()
print("STRIP", out, [c for c, _ in rows])
