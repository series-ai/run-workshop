"""Turn a raw Hunyuan3D chunky-toy dog into a small, phone-ready GLB and render a preview.

blender -b -t 1 --factory-startup -P chunky-toy/optimize.py -- <raw.glb> <out.glb> <preview.png> [tris] [tex_px] [height]

Welds UV seams, decimates to `tris` (default 3000) with smooth shading, scales the
base-colour texture to `tex_px` (default 512) and exports it as JPEG. The model is
recentred so it stands on the ground at the origin, facing +Y in Blender
(+Z in glTF), with a height of 1 (or `height`, for props sized to the dogs).
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, dst, png = args[:3]
target = int(args[3]) if len(args) > 3 else 3000
tex_px = int(args[4]) if len(args) > 4 else 512
height = float(args[5]) if len(args) > 5 else 1.0

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
        p.use_smooth = True
    for m in o.data.materials:
        if m and m.use_nodes:
            # Matte vinyl toy: no metal, soft highlights.
            bsdf = m.node_tree.nodes.get('Principled BSDF')
            if bsdf:
                bsdf.inputs['Metallic'].default_value = 0.0
                bsdf.inputs['Roughness'].default_value = 0.6

for img in bpy.data.images:
    if max(img.size) > tex_px:
        img.scale(tex_px, tex_px)

# Normalise: feet on the ground, centred on the origin, height 1.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo = Vector(min(p[i] for p in pts) for i in range(3))
hi = Vector(max(p[i] for p in pts) for i in range(3))
s = height / (hi.z - lo.z)
fix = Matrix.Scale(s, 4) @ Matrix.Translation(Vector(((lo.x + hi.x) / -2, (lo.y + hi.y) / -2, -lo.z)))
for o in meshes:
    o.data.transform(fix)
    o.data.update()

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True,
                          export_image_format='JPEG', export_jpeg_quality=85)

# Preview: three-quarter view, bright soft light, plain background.
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector(min(p[i] for p in pts) for i in range(3))
hi = Vector(max(p[i] for p in pts) for i in range(3))
center, radius = (lo + hi) / 2, (hi - lo).length / 2

scene = bpy.context.scene
engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.filepath = png
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.86, 0.86, 0.88, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
scene.world = world

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
cam.data.lens = 50
d = radius * 2.5
# Hunyuan models face -Y in Blender after import; view from the front-left three-quarter.
cam.location = center + Vector((d * math.sin(-0.7), -d * math.cos(0.7), radius * 0.9))
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(45), 0, math.radians(-30))
scene.collection.objects.link(sun)

bpy.ops.render.render(write_still=True)
print('CHUNKY', dst, sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons))
