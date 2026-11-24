"""The pack cover: a night glade assembled from the pack's own builders.

    Blender -b --factory-startup -t 1 --python cover.py -- /tmp/glowdrop-cover   (writes rgb.png + emit.png)
    python3 cover_title.py /tmp/glowdrop-cover out.png
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "concepts"))
sys.path.insert(0, os.path.join(HERE, "..", "..", "shared"))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import kit  # noqa: E402
from kit import at, C  # noqa: E402
import bugs  # noqa: E402
import plants  # noqa: E402
import props  # noqa: E402
import sea  # noqa: E402
import shrooms  # noqa: E402

out = sys.argv[sys.argv.index("--") + 1]
os.makedirs(out, exist_ok=True)
kit._clear()
scene = kit._setup(dark=True)
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.eevee.taa_render_samples = 32

# ground: a dark mossy glade with a glow pond in the middle
kit.lathe([(6.0, 0), (6.0, -0.05), (0, -0.05)], (0, 0, 0), C(40, 70, 64), n=32)
with at((0.15, 0.35, 0)):
    props.pond("large")()
for loc, s, fn in [
    ((-1.35, 0.9, 0), 1.45, lambda: shrooms.umbrella(3)),
    ((1.25, 0.75, 0), 1.9, lambda: shrooms.lantern(3)),
    ((0.95, -0.25, 0), 1.55, lambda: shrooms.moon_disc(3)),
    ((-0.85, -0.35, 0), 1.6, lambda: plants.moonflower(3)),
    ((0.2, -0.6, 0), 1.35, lambda: shrooms.puffball(4)),
    ((-1.65, -0.2, 0), 1.2, lambda: shrooms.fairy_ring(3)),
    ((1.85, 0.05, 0), 1.5, lambda: plants.glowbulb(3)),
    ((-0.35, -0.95, 0), 1.3, lambda: shrooms.pixie_cup(3)),
    ((0.35, 1.3, 0), 1.6, lambda: plants.cattail(3)),
    ((-0.45, 1.25, 0), 1.5, lambda: plants.fiddlehead(3)),
    ((-1.25, -1.05, 0), 1.3, lambda: shrooms.lantern(4)),
]:
    with at(loc, s=s, rz=-20):
        fn()
# floating things fill the sky
for loc, s, rz, fn in [
    ((-0.55, 0.45, 1.05), 1.6, 0, lambda: sea.moon_jelly(2)),
    ((0.55, 0.55, 1.45), 1.35, 0, lambda: sea.comb_jelly(2)),
    ((0.15, -0.1, 1.95), 1.5, 25, sea.anglerfish),
    ((1.55, 0.35, 1.9), 1.2, 0, lambda: sea.crown_jelly(2)),
    ((-1.45, 0.4, 1.95), 1.15, 0, lambda: sea.lions_mane(2)),
    ((1.05, -0.4, 2.45), 1.2, 0, lambda: sea.box_jelly(2)),
    ((-0.75, -0.2, 2.55), 1.1, -20, sea.guppy),
]:
    with at(loc, s=s, rz=rz):
        fn()
for loc, rz in [((-0.1, -0.6, 1.35), -40), ((1.75, -0.4, 1.3), 60), ((-1.6, -0.6, 1.25), 10), ((0.85, 0.2, 2.75), 30), ((-0.4, 0.6, 2.85), -70)]:
    with at(loc, s=1.0, rz=rz):
        bugs.firefly(2)
kit.ell((0, 0, 0), 0.001, (0, 0, 0))

# camera: low 3/4 over the glade, leaving the top for the title
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 30
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((1.9, -3.55, 1.05))
cam.rotation_euler = (Vector((0.0, 0.2, 1.35)) - cam.location).to_track_quat("-Z", "Y").to_euler()
# fully lit: strong moonlight key plus a bright blue sky fill, so the bodies read and the glow still pops
bpy.data.lights["sun"].energy = 3.4
bpy.data.lights["sun"].color = (0.85, 0.88, 1.0)
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.5, 0.9, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.5
scene.camera = cam
scene.render.film_transparent = True  # keep the moonlit world as ambient; the sky goes in behind in PIL
scene.render.filepath = os.path.join(out, "rgb.png")
bpy.ops.render.render(write_still=True)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
bpy.data.lights["sun"].energy = 0.0
scene.render.filepath = os.path.join(out, "emit.png")
bpy.ops.render.render(write_still=True)
