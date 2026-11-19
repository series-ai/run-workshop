"""Turn a vertex-coloured low-poly dog into a recolourable body mesh.

blender -b -P scripts/prep_body.py -- <in.glb> <out.glb>

Aligns every body to the same "dog space" so pattern masks land in the same
place on any breed: nose toward +X, feet on the floor, centred on the spine,
nose-to-tail length of 1. The original colours are replaced by a feature mask
(R = 1 on the nose faces at the tip of the snout) so the shader can
paint those separately from the coat.
"""
import math
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

src, dst = sys.argv[sys.argv.index('--') + 1:][:2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.ops.object.select_all(action='SELECT')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
o.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = o.data

co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(0), co.max(0)

# Length runs along the longer horizontal axis. Rotate it onto X.
if hi[1] - lo[1] > hi[0] - lo[0]:
    me.transform(Matrix.Rotation(np.pi / 2, 4, 'Z'))
    co = np.array([v.co[:] for v in me.vertices])
    lo, hi = co.min(0), co.max(0)

# The head is the end with more geometry up high (the tail is thin).
length, height = hi[0] - lo[0], hi[2] - lo[2]
upper = co[co[:, 2] > lo[2] + 0.55 * height]
front = (upper[:, 0] > hi[0] - 0.3 * length).sum()
back = (upper[:, 0] < lo[0] + 0.3 * length).sum()
if back > front:
    me.transform(Matrix.Rotation(np.pi, 4, 'Z'))
    co = np.array([v.co[:] for v in me.vertices])
    lo, hi = co.min(0), co.max(0)

# Normalise: length 1, centred on X/Y, feet at Z = 0.
scale = 1.0 / (hi[0] - lo[0])
me.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
me.transform(Matrix.Scale(scale, 4))

# Feature mask: the nose is the front tip of the snout. Eyes don't survive
# at 300 tris, so they're left to a later decal/geometry pass.
col = me.color_attributes.get('Col') or me.color_attributes[0]
nose_x = max(v.co.x for v in me.vertices) - 0.035
feature = np.zeros(len(me.loops), dtype=np.float32)
for poly in me.polygons:
    if poly.center.x > nose_x:
        feature[list(poly.loop_indices)] = 1.0
out = np.zeros((len(me.loops), 4), dtype=np.float32)
out[:, 0] = feature
out[:, 3] = 1.0
col.data.foreach_set('color_srgb', out.ravel())

# UVs for surface patterns (spots, merle, brindle). Layouts differ per body,
# which is fine for random patterns; what matters is an even texel density, so
# one texture tile always covers UV_TILE of dog length and spots never stretch.
UV_TILE = 0.5
while me.uv_layers:
    me.uv_layers.remove(me.uv_layers[0])
me.uv_layers.new(name='UVMap')
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0,
                         correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
uv = np.zeros(len(me.loops) * 2, dtype=np.float32)
me.uv_layers.active.data.foreach_get('uv', uv)
uv = uv.reshape(-1, 2)
area_3d = sum(p.area for p in me.polygons)
area_uv = 0.0
for p in me.polygons:
    a, b, c = (uv[i] for i in list(p.loop_indices)[:3])
    area_uv += abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
uv *= math.sqrt(area_3d / area_uv) / UV_TILE
me.uv_layers.active.data.foreach_set('uv', uv.ravel())

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True)
print('BODY', dst, len(me.polygons), 'tris', int(feature.sum() / 3), 'feature faces',
      f'uv span {uv.max(0) - uv.min(0)}')
