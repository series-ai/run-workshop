"""Group shot: every base kid and every costume in one scene, one 3/4 camera.

    Blender -b --factory-startup --python lineup.py -- <out.png>
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import importlib.util
import math
import os
import sys

sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
OUT = sys.argv[sys.argv.index("--") + 1]
import bobble  # noqa: E402

COLLECTED = {}
bobble.run = lambda costumes: COLLECTED.update(costumes)  # collect builds instead of rendering them

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import glob  # noqa: E402

SKIP = {"props", "gallery", "lineup"}
for path in sorted(glob.glob(_PKG + "/concepts/costumes/*.py")):
    mod = os.path.basename(path)[:-3]
    if mod in SKIP:
        continue
    spec = importlib.util.spec_from_file_location("c_" + mod.replace("-", "_"), path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = m
    spec.loader.exec_module(m)

# kids in front, then every costume; the buckets are props, not characters
KIDS = [k for k in COLLECTED if k.startswith("kid-")]
COSTUMES = sorted(k for k in COLLECTED if not k.startswith("kid-") and not k.startswith("bucket"))
PER_ROW = 13
ROWS = [KIDS] + [COSTUMES[i:i + PER_ROW] for i in range(0, len(COSTUMES), PER_ROW)]

bpy.ops.wm.read_factory_settings(use_empty=True)
bobble._mats.clear()
scene = bpy.context.scene


def place(slug, x, y):
    before = set(bpy.data.objects)
    COLLECTED[slug]()
    for o in set(bpy.data.objects) - before:
        if o.parent is None:
            o.location.x += x
            o.location.y += y


STEP, DEPTH = 4.8, 8.5
for row, names in enumerate(ROWS):
    off = (len(names) - 1) / 2
    for i, slug in enumerate(names):
        place(slug, (i - off) * STEP + (STEP / 2 if row % 2 else 0), row * DEPTH)

# ground
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.001))
bobble.finish(bpy.context.object, (0.80, 0.74, 0.66))

scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.95, 0.88, 1.0)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.3
sun.data.angle = math.radians(12)
sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = 72
scene.collection.objects.link(cam)
target = Vector((0, DEPTH * (len(ROWS) - 1) / 2, 2.0))
cam.location = target + Vector((0.12, -1.0, 1.25)).normalized() * 120
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.clip_end = 400
scene.camera = cam
scene.render.resolution_x, scene.render.resolution_y = 4800, 3600
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("WROTE", OUT)
