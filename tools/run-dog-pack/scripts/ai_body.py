"""Turn an AI papercraft dog into a kit body, two ways, for comparison.

blender -b -t 1 --factory-startup -P scripts/ai_body.py -- <ai.glb> <template.glb> <out_a.glb> <out_b.glb>

A  "AI body": the AI mesh itself. Ears and tail are cut off (our parts bolt on
   at sockets placed on the cuts), the texture is dropped (our recolour shader
   colours it), eyes become our eye pieces, and it is decimated to ~1k tris.
B  "fitted":  our shared template (same topology, rig, coat shells and sockets
   as every other build) shrink-wrapped onto the AI mesh, so it takes the AI
   shape while keeping everything mix-and-match.
Both are written in dog space (nose +X, length 1, feet at 0) like build_dog.py.
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector, bvhtree, kdtree

sys.path.append(os.path.dirname(__file__))
from dogkit import UV_TILE, even_uvs, export  # noqa: E402

src, template, out_a, out_b = sys.argv[sys.argv.index('--') + 1:][:4]
TARGET_TRIS = 900


def load_joined(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


# --------------------------------------------------------------------------
# 1. AI mesh into dog space, sample its texture for the eyes, then drop colour.
ai = load_joined(src)
me = ai.data
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4 * max(ai.dimensions))
bm.to_mesh(me)
bm.free()

co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(0), co.max(0)
if hi[1] - lo[1] > hi[0] - lo[0]:
    me.transform(Matrix.Rotation(math.pi / 2, 4, 'Z'))
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(0), co.max(0)
length, height = hi[0] - lo[0], hi[2] - lo[2]
upper = co[co[:, 2] > lo[2] + 0.55 * height]
if (upper[:, 0] < lo[0] + 0.3 * length).sum() > (upper[:, 0] > hi[0] - 0.3 * length).sum():
    me.transform(Matrix.Rotation(math.pi, 4, 'Z'))
co = np.array([v.co[:] for v in me.vertices])
lo, hi = co.min(0), co.max(0)
me.transform(Matrix.Scale(1 / (hi[0] - lo[0]), 4) @ Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
co = np.array([v.co[:] for v in me.vertices])

# Per-vertex brightness from the base colour texture (eyes are painted on).
img = next(l.from_node.image for m in me.materials if m and m.use_nodes for l in m.node_tree.links
           if l.to_socket.name == 'Base Color' and l.from_node.type == 'TEX_IMAGE')
img.scale(1024, 1024)
px = np.array(img.pixels[:], dtype=np.float32).reshape(1024, 1024, img.channels)[:, :, :3]
uv = np.zeros(len(me.loops) * 2, dtype=np.float32)
me.uv_layers.active.data.foreach_get('uv', uv)
uv = np.nan_to_num(uv.reshape(-1, 2)) % 1.0
loop_vert = np.zeros(len(me.loops), dtype=np.int64)
me.loops.foreach_get('vertex_index', loop_vert)
luma_loop = px[(uv[:, 1] * 1023).astype(int), (uv[:, 0] * 1023).astype(int)] @ np.array([0.299, 0.587, 0.114])
luma = np.ones(len(me.vertices))
np.minimum.at(luma, loop_vert, luma_loop)

# Eyes: dark vertices on the upper front of the head, away from the nose tip.
x_max = co[:, 0].max()
head = co[:, 0] > 0.22
z_head_mid = np.median(co[head, 2])
upper_face = head & (co[:, 0] < x_max - 0.05) & (co[:, 2] > z_head_mid)
# Eyes are the darkest paint on the upper face (relative: painted eyes are brown/grey, not black).
dark = upper_face & (luma < luma[upper_face].min() + 0.06)
eyes = []
for side in (1, -1):
    pts = co[dark & (np.sign(co[:, 1]) == side)]
    if len(pts):
        eyes.append(Vector(pts.mean(0)))
print('EYES found', len(eyes))

me.materials.clear()
while me.uv_layers:
    me.uv_layers.remove(me.uv_layers[0])
for a in list(me.color_attributes):
    me.color_attributes.remove(a)

# --------------------------------------------------------------------------
# 2. Cut the tail (thin protrusion at the back) and the ears (above the skull).
def fill_cut(bm_, plane_co, plane_no):
    """Bisect, delete the outer side, cap the hole; returns the cap's boundary verts."""
    res = bmesh.ops.bisect_plane(bm_, geom=bm_.verts[:] + bm_.edges[:] + bm_.faces[:], dist=1e-5,
                                 plane_co=plane_co, plane_no=plane_no, clear_outer=True)
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.holes_fill(bm_, edges=[e for e in bm_.edges if e.is_boundary], sides=0)
    return list({v for e in cut for v in e.verts})


bm = bmesh.new()
bm.from_mesh(me)
# Tail: walk forward from the back until slices get as wide as the body.
xs = np.array([v.co.x for v in bm.verts])
ys = np.array([v.co.y for v in bm.verts])
body_w = np.abs(ys).max()
x_cut = xs.min()
for x in np.arange(xs.min(), 0, 0.01):
    sl = np.abs(ys[(xs >= x) & (xs < x + 0.01)])
    if len(sl) and sl.max() > 0.45 * body_w:
        x_cut = x
        break
tail_cut = fill_cut(bm, Vector((x_cut + 0.005, 0, 0)), Vector((-1, 0, 0)))
tail_socket = sum((v.co for v in tail_cut), Vector()) / max(len(tail_cut), 1)

# Ears: the skull top is the highest point near the centreline of the head;
# above it the head splits into two ear blobs. Measure the blobs just above the
# skull (where each ear grows), then cut a little lower than the skull top: the
# ear bases sit lower on the sides of the domed head, and the flat cap gives
# the papercraft flat forehead.
EAR_CUT_DROP = 0.055
hv = [v for v in bm.verts if v.co.x > 0.18]
z_skull = max(v.co.z for v in hv if abs(v.co.y) < 0.02)
z_cut = z_skull - EAR_CUT_DROP
ear_sockets = []
for side in (1, -1):
    vs = [v.co for v in hv if v.co.y * side > 0.02 and z_skull <= v.co.z < z_skull + 0.03]
    if vs:
        c = sum(vs, Vector()) / len(vs)
        span = max(max(v.x for v in vs) - min(v.x for v in vs), max(v.y for v in vs) - min(v.y for v in vs))
        ear_sockets.append((Vector((c.x, c.y, z_cut)), span / 1.1))
fill_cut(bm, Vector((0, 0, z_cut)), Vector((0, 0, 1)))
bm.to_mesh(me)
bm.free()
print('CUTS tail x', round(x_cut, 3), 'skull z', round(z_skull, 3), 'ears', len(ear_sockets))

# Keep a high-res copy as the shrink-wrap target for B.
target_bm = bmesh.new()
target_bm.from_mesh(me)
target_bvh = bvhtree.BVHTree.FromBMesh(target_bm)
t_co = np.array([v.co[:] for v in me.vertices])
t_lo, t_hi = t_co.min(0), t_co.max(0)

# --------------------------------------------------------------------------
# 3. A: decimate, flat shade, add our eyes, tags, UVs, sockets.
tris = sum(len(p.vertices) - 2 for p in me.polygons)
mod = ai.modifiers.new('decimate', 'DECIMATE')
mod.ratio = TARGET_TRIS / tris
mod.use_collapse_triangulate = True
bpy.context.view_layer.objects.active = ai
bpy.ops.object.modifier_apply(modifier=mod.name)

bm = bmesh.new()
bm.from_mesh(me)
tag = bm.faces.layers.int.new('tag')
nose_x = max(v.co.x for v in bm.verts) - 0.03
for f in bm.faces:
    f[tag] = 1 if f.calc_center_median().x > nose_x else 0
eye_r = 0.018
for e in eyes:
    res = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=eye_r)
    bmesh.ops.translate(bm, vec=e, verts=res['verts'])
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f[tag] = 2
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(me)
bm.free()
ai.name = me.name = 'dog'
for p in me.polygons:
    p.use_smooth = False
col = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
tags = [0] * len(me.polygons)
me.attributes['tag'].data.foreach_get('value', tags)
for p in me.polygons:
    for li in p.loop_indices:
        col.data[li].color_srgb = (float(tags[p.index] == 1), float(tags[p.index] == 2), 0.0, 1.0)
me.attributes.remove(me.attributes['tag'])
me.color_attributes.active_color = col


def add_projection(obj, height):
    m = obj.data
    proj = m.uv_layers.new(name='Projection')
    for loop in m.loops:
        c = m.vertices[loop.vertex_index].co
        proj.data[loop.index].uv = (c.x + 0.5, c.z / height)
    m.uv_layers.active = m.uv_layers['UVMap']


def add_socket(name, pos, scale, height):
    e = bpy.data.objects.new(name, None)
    e.location = pos
    e.scale = (scale,) * 3
    e['uv2'] = [pos.x + 0.5, 1 - pos.z / height]
    bpy.context.scene.collection.objects.link(e)


even_uvs(ai, UV_TILE)
height_a = max(v.co.z for v in me.vertices)
add_projection(ai, height_a)
me.materials.append(bpy.data.materials.new('dog'))
ear_sockets.sort(key=lambda s: -s[0].y)            # L (+Y) first
for (pos, scale), name in zip(ear_sockets, ('socket_ear_L', 'socket_ear_R')):
    add_socket(name, pos, scale, height_a)
add_socket('socket_tail', tail_socket, 0.3, height_a)
export(out_a)
print('A', len(me.polygons), 'tris')

# --------------------------------------------------------------------------
# 4. B: our template (corgi build) shrink-wrapped onto the AI shape.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=template)
objs = {o.name: o for o in bpy.context.scene.objects}
body = objs['dog']
b_me = body.data
b_co = np.array([v.co[:] for v in b_me.vertices])
col = b_me.color_attributes[0]
rgb = np.zeros(len(b_me.loops) * 4, dtype=np.float32)
col.data.foreach_get('color_srgb', rgb)
rgb = rgb.reshape(-1, 4)
is_part = np.zeros(len(b_me.vertices), dtype=bool)        # eyes and nose keep their shape
for li, l in enumerate(b_me.loops):
    if rgb[li, 0] > 0.5 or rgb[li, 1] > 0.5:
        is_part[l.vertex_index] = True
core = b_co[~is_part]
c_lo, c_hi = core.min(0), core.max(0)

# Match bounding boxes first so legs land near legs, then snap to the surface.
scale = (t_hi - t_lo) / (c_hi - c_lo)


def to_ai_box(p):
    p = np.asarray(p, dtype=np.float64)
    return (p - c_lo) * scale + t_lo


snapped = np.array([to_ai_box(p) for p in b_co])
for i in np.where(~is_part)[0]:
    hit = target_bvh.find_nearest(Vector(snapped[i]))
    if hit[0] is not None:
        snapped[i] = hit[0]

# Displacement field of the body; eyes, nose, coat shells and sockets follow
# the nearest body vertex so everything stays attached.
kd = kdtree.KDTree(int((~is_part).sum()))
for n, i in enumerate(np.where(~is_part)[0]):
    kd.insert(Vector(b_co[i]), int(i))
kd.balance()
disp = snapped - np.array([to_ai_box(p) for p in b_co])


def follow(p):
    _, i, _ = kd.find(Vector(p))
    return Vector(to_ai_box(p) + disp[i])


for i in np.where(is_part)[0]:
    snapped[i] = np.array(follow(b_co[i]))
b_me.vertices.foreach_set('co', snapped.ravel().astype(np.float32))
for name, o in objs.items():
    if name.startswith('coat_'):
        for v in o.data.vertices:
            v.co = follow(v.co[:])
height_b = max(v.co.z for v in b_me.vertices)
for name, o in objs.items():
    if o.type == 'MESH':
        m = o.data
        if 'Projection' in m.uv_layers:
            proj = m.uv_layers['Projection']
            for loop in m.loops:
                c = m.vertices[loop.vertex_index].co
                proj.data[loop.index].uv = (c.x + 0.5, c.z / height_b)
    elif name.startswith('socket_'):
        o.location = follow(o.location[:])
        o['uv2'] = [o.location.x + 0.5, 1 - o.location.z / height_b]
export(out_b)
print('B', len(b_me.polygons), 'tris')
