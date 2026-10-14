"""Decimate a generated dog GLB to a low-poly mesh and render a preview.

blender -b -P scripts/lowpoly.py -- <in.glb> <out.glb> <preview.png> [target_tris] [flat|smooth] [tex|vc]

`vc` bakes the texture into vertex colours (one colour per face when flat,
per corner when smooth) and drops the texture and UVs.
"""
import math
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, dst, png = args[:3]
target = int(args[3]) if len(args) > 3 else 1500
flat = (args[4] if len(args) > 4 else 'flat') == 'flat'
vertex_colors = (args[5] if len(args) > 5 else 'tex') == 'vc'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

for o in meshes:
    # The glTF import splits vertices along UV seams; weld them so decimation
    # collapses one connected surface instead of tearing islands apart.
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4 * max(o.dimensions))
    bm.to_mesh(o.data)
    bm.free()
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    mod = o.modifiers.new('decimate', 'DECIMATE')
    mod.ratio = min(1.0, target / max(tris, 1))
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in o.data.polygons:
        p.use_smooth = not flat

for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)



def bake_vertex_colors(o):
    """Sample the base-colour texture into a corner colour attribute."""
    me = o.data
    img = next(l.from_node.image for m in me.materials if m and m.use_nodes for l in m.node_tree.links
               if l.to_socket.name == 'Base Color' and l.from_node.type == 'TEX_IMAGE')
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, img.channels)[:, :, :3]
    # Copy UVs out first: adding the colour attribute below invalidates layer references.
    uv = np.zeros(len(me.loops) * 2, dtype=np.float32)
    me.uv_layers.active.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)

    def sample(u, v):
        u, v = np.nan_to_num((u, v))  # decimation can leave degenerate UVs
        x, y = int(u % 1.0 * (w - 1)), int(v % 1.0 * (h - 1))
        # Average a small neighbourhood so a face doesn't pick up a stray texel.
        return px[max(y - 2, 0):y + 3, max(x - 2, 0):x + 3].reshape(-1, 3).mean(axis=0)

    attr = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for poly in me.polygons:
        loops = list(poly.loop_indices)
        if flat:
            c = sample(*uv[loops].mean(axis=0))
            colors = [c] * len(loops)
        else:
            colors = [sample(*uv[i]) for i in loops]
        for i, c in zip(loops, colors):
            attr.data[i].color_srgb = (*c, 1.0)
    me.color_attributes.active_color = attr

    mat = bpy.data.materials.new('dog')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    col = nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    mat.node_tree.links.new(col.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.clear()
    me.materials.append(mat)
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])


if vertex_colors:
    for o in meshes:
        bake_vertex_colors(o)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True)

# Preview: three-quarter view, soft light, plain background.
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector(min(p[i] for p in pts) for i in range(3))
hi = Vector(max(p[i] for p in pts) for i in range(3))
center, radius = (lo + hi) / 2, (hi - lo).length / 2

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items} else 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.filepath = png
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.92, 0.92, 0.94, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
scene.world = world

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
cam.data.lens = 50
d = radius * 3.2
cam.location = center + Vector((d * math.sin(0.7), -d * math.cos(0.7), radius * 0.9))
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
scene.collection.objects.link(sun)

bpy.ops.render.render(write_still=True)
print('LOWPOLY', dst, sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
