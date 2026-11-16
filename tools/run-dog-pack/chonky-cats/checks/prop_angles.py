"""Every prop in props/models from four angles (front 3/4, back 3/4, side, from above), flat-lit
with cavity shading so creases and pinching show: /tmp/chonky-cats/angles/<slug>.png (4 x 300 px).

blender -b -t 1 --factory-startup -P checks/prop_angles.py -- props/models/*.glb
"""
import math
import os
import sys

import bpy
from mathutils import Vector

out = '/tmp/chonky-cats/angles'
os.makedirs(out, exist_ok=True)
for path in sys.argv[sys.argv.index('--') + 1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    c, size = (mn + mx) / 2, max(mx - mn)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_WORKBENCH'
    s.display.shading.light = 'STUDIO'
    s.display.shading.color_type = 'TEXTURE'
    s.display.shading.show_cavity = True
    s.render.resolution_x = s.render.resolution_y = 300
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c'))
    s.collection.objects.link(cam)
    s.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = size * 1.25
    slug = os.path.basename(path)[:-4]
    for k, d in enumerate(((0.8, -1, 0.45), (-0.8, 1, 0.45), (1, 0, 0.1), (0.2, -0.3, 1))):
        cam.location = c + Vector(d).normalized() * size * 4
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        s.render.filepath = f'{out}/{slug}-{k}.png'
        bpy.ops.render.render(write_still=True)
    print('ANGLES', slug)
