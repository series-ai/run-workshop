"""Swap the cat tree's carpeted house for a clean procedural one.

blender -b -t 1 --factory-startup -P fix_tree.py -- models/cat-tree.glb      (rewrites it)

Decimated to a game budget, the AI house warps: long thin triangles fan across its flat faces
and drag the painted texture with them, so the round doorway looked pinched (more triangles and
copying the original's normals didn't fix it). This cuts the house out of the optimised mesh
and puts in a rounded box in the same cream with a recessed round doorway: flat faces, a
clean circle, a couple of hundred triangles. HOUSE is the box in this model's space
(Blender: z up, front is -y), measured from optimize.py's output at height 2.4.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Vector

path = sys.argv[sys.argv.index('--') + 1]
HOUSE_MIN, HOUSE_MAX = Vector((-0.06, -0.076, 1.214)), Vector((0.44, 0.43, 1.677))
CREAM, DARK = (0.66, 0.58, 0.45), (0.06, 0.045, 0.035)   # linear: the carpet cream, the shadowed inside

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
tree = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
tree.data.transform(tree.matrix_world)
tree.matrix_world.identity()

# 1. cut the old house: faces whose centre is inside the box grown a little (its own skin sits right
#    on the box), less in z so the platforms under and over it stay
pad = Vector((0.03, 0.03, 0.012))
bm = bmesh.new()
bm.from_mesh(tree.data)
dead = [f for f in bm.faces
        if all(HOUSE_MIN[i] - pad[i] < f.calc_center_median()[i] < HOUSE_MAX[i] + pad[i] for i in range(3))]
bmesh.ops.delete(bm, geom=dead, context='FACES')
bm.to_mesh(tree.data)
bm.free()


def material(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m


# 2. the new house: a rounded box with a round recess in its front face
size = (HOUSE_MAX - HOUSE_MIN) * 1.04   # a touch bigger: covers anything of the old one left at the edges
centre = (HOUSE_MIN + HOUSE_MAX) / 2
bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
house = bpy.context.object
house.scale = size
bpy.ops.object.transform_apply(scale=True)
bev = house.modifiers.new('bevel', 'BEVEL')
bev.width, bev.segments = 0.045, 3
bpy.ops.object.modifier_apply(modifier='bevel')
door_r = 0.3 * min(size.x, size.z)
door_c = Vector((centre.x, centre.y - size.y / 2, centre.z - 0.03))
bpy.ops.mesh.primitive_cylinder_add(radius=door_r, depth=0.6 * size.y, vertices=24, rotation=(math.pi / 2, 0, 0),
                                    location=door_c)
cutter = bpy.context.object
boo = house.modifiers.new('door', 'BOOLEAN')
boo.operation, boo.object = 'DIFFERENCE', cutter
bpy.context.view_layer.objects.active = house
bpy.ops.object.modifier_apply(modifier='door')
bpy.data.objects.remove(cutter)
house.data.materials.append(material('house', CREAM))
house.data.materials.append(material('house-inside', DARK))
for p in house.data.polygons:   # the recess walls and back: dark, so the doorway reads as a hole
    c = p.center
    inside = math.hypot(c.x - door_c.x, c.z - door_c.z) < door_r + 1e-3 and c.y > door_c.y + 0.005
    p.material_index = 1 if inside else 0
    p.use_smooth = False

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = tree
bpy.ops.object.join()
tris = sum(len(p.vertices) - 2 for p in tree.data.polygons)
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85)
print('FIXTREE', path, tris, 'tris')
