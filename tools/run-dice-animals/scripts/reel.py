"""Clip reel: one dice GLB playing every clip in turn, each from a fixed
camera fitted to that clip, every frame rendered (for the review video).

    Blender -b --factory-startup -t 1 --python reel.py -- <glb> <frames dir> clip [clip ...]

Writes <frames dir>/NNNN.png and labels.txt (one clip name per frame).
"""
import math
import os
import shutil
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
glb, out, clips = args[0], args[1], args[2:]
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
    for o in objs:
        if o.type == "MESH":
            for c in o.bound_box:
                p = o.matrix_world @ Vector(c)
                lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
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
sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
scene.collection.objects.link(sun)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
g = bpy.data.materials.new("g")
g.use_nodes = True
g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.78, 0.42, 1)
bpy.context.object.data.materials.append(g)
scene.render.resolution_x, scene.render.resolution_y = 960, 640
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.clip_end = 300
scene.collection.objects.link(cam)
scene.camera = cam
os.makedirs(out, exist_ok=True)
labels = []
k = 0
for item in clips:
    # clips joined with + (spin_start+spin_loop+spin_end) play back to back under one camera
    parts = item.split("+")
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for clip in parts:
        last = play(clip)
        for f in range(0, last + 1, 2):
            scene.frame_set(f)
            a, b = bounds()
            lo, hi = Vector(map(min, lo, a)), Vector(map(max, hi, b))
    centre = (lo + hi) / 2
    centre.z = max(centre.z, 1.4)
    aspect = scene.render.resolution_x / scene.render.resolution_y
    span = max((hi - lo).length * 0.95, 5.5, ((hi.z - lo.z) + 1.6) * aspect)  # tall clips (drops) fit top to bottom
    cam.data.ortho_scale = span
    cam.location = centre + Vector((0.9, -1.0, 0.5)).normalized() * 60
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    for i, clip in enumerate(parts):
        last = play(clip)
        # back-to-back parts skip the first frame of the next part (it repeats the last one)
        for f in range(1 if i else 0, last + 1):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(out, f"{k:04d}.png")
            if not os.path.exists(scene.render.filepath):
                bpy.ops.render.render(write_still=True)
            labels.append(clip)
            k += 1
    # a short beat holding the last frame between clips
    held = scene.render.filepath
    for _ in range(8):
        p = os.path.join(out, f"{k:04d}.png")
        if not os.path.exists(p):
            shutil.copyfile(held, p)
        labels.append(parts[-1])
        k += 1
open(os.path.join(out, "labels.txt"), "w").write("\n".join(labels))
print("FRAMES", k)
