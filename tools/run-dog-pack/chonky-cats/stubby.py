"""Shorten the legs of an optimised body (the Munchkin): squash everything below `below`
(height, model units) to `factor` of its height and drop the rest of the body to match.

blender -b -t 1 --factory-startup -P stubby.py -- <in.glb> <out.glb> [below] [factor]
"""
import sys
import bpy

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[:2]
below = float(args[2]) if len(args) > 2 else 0.22
factor = float(args[3]) if len(args) > 3 else 0.5

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in bpy.context.scene.objects:
    if o.type != 'MESH':
        continue
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
    for v in o.data.vertices:
        z = v.co.z
        # continuous at `below`: the legs squash, the body above just drops
        v.co.z = z * factor if z < below else z - below * (1 - factor)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
print('STUBBY', dst)
