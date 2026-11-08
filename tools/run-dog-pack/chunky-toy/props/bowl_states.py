"""Full / empty states for a bowl prop: the same bowl with a kibble mound or water in it.

blender -b -t 1 --factory-startup -P bowl_states.py -- models/floor-bowl.glb

Writes models/<bowl>--empty.glb (a copy), --food.glb and --water.glb. The bowl's inside is
measured with rays (floor height, inner radius at each height), so the fill sits inside the
walls of whatever bowl the model turned out to be.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

src = sys.argv[sys.argv.index('--') + 1:][0]
stem = src[:-4]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
bowl = [o for o in bpy.context.scene.objects if o.type == 'MESH']
dg = bpy.context.evaluated_depsgraph_get()
polys, verts = [], []
for o in bowl:
    m = o.evaluated_get(dg).to_mesh()
    base = len(verts)
    verts += [o.matrix_world @ v.co for v in m.vertices]
    polys += [[base + i for i in p.vertices] for p in m.polygons]
bvh = BVHTree.FromPolygons(verts, polys)
top = max(v.z for v in verts)
lo_x, hi_x = min(v.x for v in verts), max(v.x for v in verts)
lo_y, hi_y = min(v.y for v in verts), max(v.y for v in verts)
centre = Vector(((lo_x + hi_x) / 2, (lo_y + hi_y) / 2, 0))
floor = bvh.ray_cast(centre + Vector((0, 0, top + 1)), Vector((0, 0, -1)))[0].z


def inner_radius(h):
    rs = []
    for k in range(12):
        d = Vector((math.cos(k * math.pi / 6), math.sin(k * math.pi / 6), 0))
        hit = bvh.ray_cast(centre + Vector((0, 0, h)), d, 2.0)[0]
        if hit:
            rs.append((hit - centre - Vector((0, 0, h))).length)
    return min(rs) if rs else None


# Rim: the highest height whose inner radius is still found (above it the rays escape).
depth = top - floor
heights = [floor + depth * t for t in (0.1, 0.3, 0.5, 0.7, 0.85, 0.95)]
radii = [(h, inner_radius(h)) for h in heights]
print('BOWL floor %.3f top %.3f' % (floor, top), [(round(h, 3), r and round(r, 3)) for h, r in radii])


def mat(name, rgb, rough, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else None
    return m


def disc(h, r, segs, material, dome=0.0, name='fill'):
    bm = bmesh.new()
    c = bm.verts.new(centre + Vector((0, 0, h + dome)))
    ring = [bm.verts.new(centre + Vector((math.cos(a) * r, math.sin(a) * r, h)))
            for a in [2 * math.pi * k / segs for k in range(segs)]]
    mid = [bm.verts.new(centre + Vector((math.cos(a) * r * 0.6, math.sin(a) * r * 0.6, h + dome * 0.7)))
           for a in [2 * math.pi * k / segs for k in range(segs)]]
    for k in range(segs):
        bm.faces.new((c, mid[k], mid[(k + 1) % segs]))
        bm.faces.new((mid[k], ring[k], ring[(k + 1) % segs], mid[(k + 1) % segs]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bowl + objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='JPEG')
    print('BOWL wrote', path)


export([], stem + '--empty.glb')

# Water: a flat surface at 70% depth, just inside the wall.
hw = floor + 0.7 * depth
water = disc(hw, inner_radius(hw) - 0.002, 24, mat('water', (0.25, 0.55, 0.8), 0.08, 0.8), name='water')
export([water], stem + '--water.glb')
bpy.data.objects.remove(water)

# Food: a brown mound up to the rim with chunky kibble pieces on top of it.
hf = floor + 0.8 * depth
rf = inner_radius(hf) - 0.002
kib = mat('kibble', (0.36, 0.18, 0.08), 0.75)
kib2 = mat('kibble_light', (0.5, 0.28, 0.12), 0.75)
mound = disc(hf, rf, 20, kib, dome=0.25 * depth, name='food')
random.seed(3)
bm = bmesh.new()
size = max(0.12 * rf, 0.006)
for _ in range(40):
    a, rr = random.random() * 2 * math.pi, rf * 0.85 * math.sqrt(random.random())
    h = hf + 0.25 * depth * (1 - (rr / rf) ** 2) * 0.95
    made = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size)['verts']
    sx, sy, sz = 1.0, 0.9 + 0.2 * random.random(), 0.6
    rot = random.random() * math.pi
    for v in made:
        x, y, z = v.co.x * sx, v.co.y * sy, v.co.z * sz
        v.co = centre + Vector((math.cos(a) * rr, math.sin(a) * rr, h + size * 0.3)) + \
            Vector((x * math.cos(rot) - y * math.sin(rot), x * math.sin(rot) + y * math.cos(rot), z))
    pick = random.random() < 0.4
    for f in {f for v in made for f in v.link_faces}:
        f.material_index = 1 if pick else 0
me = bpy.data.meshes.new('kibble')
bm.to_mesh(me)
bm.free()
me.materials.append(kib)
me.materials.append(kib2)
pieces = bpy.data.objects.new('kibble', me)
bpy.context.scene.collection.objects.link(pieces)
export([mound, pieces], stem + '--food.glb')
