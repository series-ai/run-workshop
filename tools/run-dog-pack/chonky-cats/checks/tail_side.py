"""Flat side render of a body for tracing its tail (tails.json works in this view's units).

blender -b -t 1 --factory-startup -P checks/tail_side.py -- lowpoly/<body>.glb <out.png>

700 px, orthographic, 1.4 units across, centred on (y 0.1, z 0.55): pixel (px, py) is
y = 0.1 + (px - 350) * 0.002, z = 0.55 - (py - 350) * 0.002. checks/tail_overlay.py draws
the traced path on it.
"""
import math
import sys

import bpy

src, png = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
s = bpy.context.scene
s.render.engine = 'BLENDER_WORKBENCH'
s.display.shading.light = 'FLAT'
s.display.shading.color_type = 'TEXTURE'
s.render.resolution_x = s.render.resolution_y = 700
cam = bpy.data.objects.new('c', bpy.data.cameras.new('c'))
s.collection.objects.link(cam)
s.camera = cam
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 1.4
cam.location = (5, 0.1, 0.55)
cam.rotation_euler = (math.radians(90), 0, math.radians(90))
s.render.filepath = png
bpy.ops.render.render(write_still=True)
