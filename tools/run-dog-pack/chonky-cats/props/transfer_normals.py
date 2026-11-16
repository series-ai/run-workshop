"""Shade a decimated prop like its full-detail original: copy the raw mesh's surface normals onto
the optimised one (custom split normals, exported with the GLB). Decimating leaves long thin
triangles fanning across flat faces (the cat tree's house: the doorway looked pinched); with the
original's normals the flat faces shade flat whatever the triangles are. No runtime cost.

blender -b -t 1 --factory-startup -P transfer_normals.py -- <raw.glb> <model.glb>   (rewrites model.glb)
"""
import sys

import bpy

raw, model = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=model)
low = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.import_scene.gltf(filepath=raw)
high = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in low]

# the optimised model was recentred and rescaled from the raw one: fit the raw mesh onto it by bounds
def bounds(obs):
    from mathutils import Vector
    pts = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx

lmn, lmx = bounds(low)
hmn, hmx = bounds(high)
s = (lmx.z - lmn.z) / (hmx.z - hmn.z)
for o in high:
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
    for v in o.data.vertices:
        v.co = (v.co - (hmn + hmx) / 2) * s + (lmn + lmx) / 2
bpy.ops.object.select_all(action='DESELECT')
for o in high:
    o.select_set(True)
bpy.context.view_layer.objects.active = high[0]
if len(high) > 1:
    bpy.ops.object.join()
src = bpy.context.view_layer.objects.active

for o in low:
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new('normals', 'DATA_TRANSFER')
    mod.object = src
    mod.use_loop_data = True
    mod.data_types_loops = {'CUSTOM_NORMAL'}
    mod.loop_mapping = 'POLYINTERP_NEAREST'
    bpy.ops.object.modifier_apply(modifier='normals')
bpy.data.objects.remove(src)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=model, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_normals=True)
print('NORMALS', model)
