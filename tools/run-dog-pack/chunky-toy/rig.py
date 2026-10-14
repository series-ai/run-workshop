"""Fit the shared dog skeleton to a chunky-toy dog and skin it; optionally write the shared clips.

blender -b -t 1 --factory-startup -P chunky-toy/rig.py -- <in.glb> <out.glb> [preview.png] [clips.glb]

The dog GLB holds the skinned mesh and skeleton only. Pass clips.glb to also write
the shared clips (skeleton + animations, no mesh); every dog plays the same file.

Input is an optimised model (optimize.py): height 1, feet at z=0, centred, head toward -Y.

Every dog gets the same skeleton: same bone names, same hierarchy and the same rest
orientation for every bone (legs point straight down, spine points forward, neck at
a fixed angle...). Only bone positions and lengths are measured from the mesh. Because
the rest orientations match, a rotation keyframe means the same thing on every dog,
so any clip made for one dog plays on all of them. Leg joints sit at fixed fractions
of the leg length, so foot placement measured in leg lengths is the same on every dog
too. Clips are authored in clips_lib.py.

    root
    └─ hips ─┬─ spine ─ chest ─┬─ neck ─ head ─┬─ jaw
             │                 │               └─ mouth          (socket for a held ball)
             │                 ├─ upperarm.L ─ forearm.L ─ hand.L   (and .R)
             ├─ thigh.L ─ shin.L ─ foot.L                           (and .R)
             └─ tail.1 ─ tail.2 ─ tail.3
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import clips_lib  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[:2]
png = args[2] if len(args) > 2 and args[2] else None
clips_path = args[3] if len(args) > 3 else None

NECK_ANGLE = math.radians(55)   # neck elevation from horizontal, same for every dog
TAIL_ANGLE = math.radians(40)   # tail elevation, pointing back

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
# Weld the UV-seam splits the importer makes; heat weighting needs a connected surface.
bm = bmesh.new()
bm.from_mesh(mesh.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(mesh.data)
bm.free()
for poly in mesh.data.polygons:
    poly.use_smooth = True
mesh.data.transform(mesh.matrix_world)  # work in world space throughout
mesh.matrix_world.identity()

P = np.array([tuple(mesh.matrix_world @ v.co) for v in mesh.data.vertices])
x, y, z = P[:, 0], P[:, 1], P[:, 2]
width = x.max() - x.min()


# ---------------------------------------------------------------- landmarks
def two_means(vals):
    lo, hi = np.percentile(vals, 20), np.percentile(vals, 80)
    for _ in range(20):
        split = (lo + hi) / 2
        lo, hi = vals[vals < split].mean(), vals[vals >= split].mean()
    return lo, hi


feet = P[z < 0.04]
y_front, y_back = two_means(feet[:, 1])  # head is at -Y, so the smaller cluster is the front
split = (y_front + y_back) / 2


def leg_x(sel):
    pts = feet[sel]
    return float(np.abs(pts[:, 0]).mean()) if len(pts) else 0.18 * width


x_front = (leg_x((feet[:, 1] < split) & (feet[:, 0] > 0)) + leg_x((feet[:, 1] < split) & (feet[:, 0] < 0))) / 2
x_back = (leg_x((feet[:, 1] >= split) & (feet[:, 0] > 0)) + leg_x((feet[:, 1] >= split) & (feet[:, 0] < 0))) / 2

# Back line and belly from slices of the middle of the body (between the legs, on the centre line).
centre = np.abs(x) < 0.12 * width
tops, bellies = [], []
for t in np.linspace(0.3, 0.9, 7):
    yy = y_front + t * (y_back - y_front)
    s = centre & (np.abs(y - yy) < 0.06)
    if s.sum() < 3:
        continue
    tops.append(z[s].max())
    under = z[s & (z > 0.03)]
    if len(under):
        bellies.append(under.min())
back_z = float(np.median(tops))
belly_z = float(np.median(bellies)) if bellies else 0.35 * back_z
# Coat to the floor (Shih Tzu, Yorkie): lots of floor contact away from the four legs.
axes = np.array([(sx * xx, yy) for sx in (1, -1) for xx, yy in ((x_front, y_front), (x_back, y_back))])
floor_d = np.linalg.norm(feet[:, None, :2] - axes[None], axis=2).min(axis=1)
skirt = bool((floor_d > 0.12).mean() > 0.3) or not 0.12 * back_z < belly_z < 0.7 * back_z
if skirt:
    belly_z = 0.4 * back_z
spine_z = 0.62 * back_z if skirt else belly_z + 0.5 * (back_z - belly_z)

# Head: everything in front of the shoulders and above the back line.
head_pts = P[(y < y_front + 0.05) & (z > back_z * 0.95)]
if len(head_pts) < 10:
    head_pts = P[y < y_front]
head_c = head_pts.mean(axis=0)
sel = (z > spine_z) & (np.abs(x) < 0.15 * width)
snout_y = float(y[sel].min() if sel.any() else y.min())
nose_z = float(z[sel][np.argmin(y[sel])] if sel.any() else head_c[2])

# Tail: fitted to the actual tail, which can hang down (Great Dane, Greyhound), curl
# over the back (Pug, Shiba, Pomeranian) or be a bob (Aussie). It starts at the top of
# the rump; tail vertices are thin bits sticking out behind the rump or up above the back.


def local_width(co):
    """Half-width of the mesh around a point (same height and depth): tails are thin."""
    near = P[(np.abs(y - co[1]) < 0.03) & (np.abs(z - co[2]) < 0.03)]
    return float(np.abs(near[:, 0]).max()) if len(near) else 0.0


# The rump is the back end of the wide part of the body, so a hanging tail never counts.
widths = np.array([local_width(p) if spine_z - 0.1 < p[2] < back_z + 0.02 and p[1] > y_back else 0 for p in P])
sel = widths > 0.08
rump_y = float(y[sel].max()) if sel.any() else float(y.max()) - 0.05
sel = centre & (np.abs(y - (y_front + 0.5 * (y_back - y_front))) < 0.1 * (y_back - y_front) + 0.02)
mid_back_z = float(z[sel].max()) if sel.any() else back_z
# Top of the rump on the centre line, ignoring anything rising well above the back
# (a raised tail right at the rump would otherwise be taken for it).
sel = (np.abs(y - (rump_y - 0.04)) < 0.05) & (np.abs(x) < 0.06) & (z > spine_z - 0.06) & (z < mid_back_z + 0.05)
tail_base = Vector((0, rump_y - 0.03, float(z[sel].max()) - 0.03 if sel.any() else mid_back_z - 0.05))


# Tail vertices: grown along mesh edges from the tail base, through vertices behind the
# rump (or rising above the back, for tails curled over it). Following the mesh means a
# hanging tail is found all the way to its tip, and never jumps across to a leg.
plume_z = max(mid_back_z, spine_z + 0.6 * (back_z - spine_z)) + 0.03
# Only treat "above the back" as tail if something really rises well above it (a curl or
# plume); a slightly higher rump (Bulldog) isn't a tail.
plume = bool(np.any((z > plume_z + 0.05) & (y > y_back - 0.02) & (np.abs(x) < 0.13)))


off_centre = P[(np.abs(x) > 0.07) & (y > y_back - 0.1)]   # thighs, buttocks, body sides
hind_leg = (np.abs(np.abs(x) - x_back) < 0.045) & (z < 0.85 * spine_z) & (np.abs(y - y_back) < 0.12)


def body_back(zz):
    """How far back the body's off-centre surface reaches at this height."""
    s_ = off_centre[np.abs(off_centre[:, 2] - zz) < 0.03]
    return max(float(s_[:, 1].max()), rump_y - 0.08) if len(s_) else rump_y   # top of a round back: use the rump


def tail_candidate(pt):
    if pt[1] < y_back - 0.02 or pt[2] < 0.03 or abs(pt[0]) > 0.13:
        return False
    if plume and (pt[2] > plume_z + 0.04 or (pt[2] > plume_z and pt[1] > rump_y - 0.04)):
        return True                       # clearly above the back behind the hips: plume or curl
    if (Vector(pt) - tail_base).length < 0.045:
        return abs(pt[0]) < 0.06 and pt[2] > tail_base.z - 0.02   # the root of the tail only, not the rump
    # well behind the body only a tail can be there, so a bushy tip (Border Collie) is
    # allowed to be wider than the rest of the tail
    far = pt[1] > rump_y + 0.1
    if abs(pt[0]) > (0.12 if far else 0.08) or pt[1] < body_back(pt[2]) + 0.01:
        return False
    # Narrow: a round bum sticks out in the middle too, but it's broad; a tail isn't. Only
    # the mesh at this height from just in front of the point backward counts: a bum's
    # cross-section there is wide, a tail's isn't, and legs well in front of a hanging tail
    # don't count.
    near = P[(np.abs(z - pt[2]) < 0.025) & (y > pt[1] - 0.05) & (np.abs(x) < 0.25)]
    return float(np.abs(near[:, 0]).max()) < (0.12 if far else 0.075) if len(near) else True


adj = [[] for _ in range(len(P))]
for e in mesh.data.edges:
    i, j = e.vertices
    adj[i].append(j)
    adj[j].append(i)
seeds = [int(i) for i in np.argsort(np.linalg.norm(P - np.array(tail_base), axis=1))[:6]]  # base is just inside the body
tail_set, todo = set(seeds), list(seeds)
while todo:
    i = todo.pop()
    for j in adj[i]:
        if j not in tail_set and tail_candidate(P[j]):
            tail_set.add(j)
            todo.append(j)
tail_kd = KDTree(max(1, len(tail_set)))
for i in tail_set:
    tail_kd.insert(Vector(P[i]), i)
tail_kd.balance()


def tail_like(co):
    """Is this point one of the tail vertices found above (positions survive the mouth cut)."""
    if not tail_set:
        return False
    _, _, d = tail_kd.find(Vector(co))
    return d < 1e-5


# Curled tails (tails.json, picked by hand): the coil lies on the rump, where the search
# above can't tell coil from bum. Every vertex in the coil is tail, and the bones run from
# where it leaves the body through the coil, so the whole curl wags as one piece.
curl_hint = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tails.json'))).get(
    os.path.basename(dst)[:-4])
if curl_hint:
    cy, cz, cr = curl_hint['curl']
    centre_c = Vector((0, cy, cz))
    tail_base = Vector((0, *curl_hint['base']))
    in_coil = (np.linalg.norm(P - np.array(centre_c), axis=1) < cr) & (np.abs(x) < 0.7 * cr + 0.03) & \
        ((z > curl_hint['above_z']) | (y > curl_hint['rear_y']))
    tail_set = set(np.nonzero(in_coil)[0].tolist()) | set(int(i) for i in np.argsort(np.linalg.norm(P - np.array(tail_base), axis=1))[:6])
    tail_kd = KDTree(len(tail_set))
    for i in tail_set:
        tail_kd.insert(Vector(P[i]), i)
    tail_kd.balance()
tail_idx = [i for i in tail_set if (Vector(P[i]) - tail_base).length >= 0.03]

if os.environ.get('TAIL_DEBUG') and tail_set:
    T_ = P[list(tail_set)]
    print('TDBG base', np.round(tail_base, 3), 'n', len(tail_set), 'z range', T_[:, 2].min().round(3), T_[:, 2].max().round(3),
          'y range', T_[:, 1].min().round(3), T_[:, 1].max().round(3), 'x max', np.abs(T_[:, 0]).max().round(3),
          'spine', round(spine_z, 3), 'belly', round(belly_z, 3), 'rump', round(rump_y, 3), 'plume', plume)
if len(tail_idx) >= 8:  # fewer is a stray bit of rump, not a tail (Corgi, Pomeranian)
    pts = P[tail_idx]
    dist = np.linalg.norm(pts - np.array(tail_base), axis=1)
    tail_tip = Vector(pts[int(np.argmax(dist))])

    def along(lo, hi):
        """Centroid of the tail points between two fractions of the tail's reach."""
        sel = (dist >= lo * dist.max()) & (dist <= hi * dist.max())
        return Vector(pts[sel].mean(axis=0)) if sel.any() else tail_base.lerp(tail_tip, (lo + hi) / 2)
    tail_joints = [tail_base, along(0.25, 0.42), along(0.58, 0.75), tail_tip]
    if curl_hint:   # base -> into the coil -> its centre -> out the far side
        out_dir = (centre_c - tail_base).normalized()
        tail_joints = [tail_base, tail_base.lerp(centre_c, 0.5), centre_c, centre_c + out_dir * 0.6 * cr]
    tail_bob = False
else:  # bobbed or no visible tail: a short stub pointing back and up
    stub = Vector((0, math.cos(TAIL_ANGLE), math.sin(TAIL_ANGLE))) * 0.02
    tail_joints = [tail_base + stub * k for k in range(4)]
    tail_bob = True
tail_len = sum((b - a).length for a, b in zip(tail_joints, tail_joints[1:]))


# Head and mouth. The neck leaves the chest at a fixed angle, so its end is known now.
neck_dir = Vector((0, -math.cos(NECK_ANGLE), math.sin(NECK_ANGLE)))
neck_len = max(0.04, (head_c[2] - spine_z) * 0.6 / math.sin(NECK_ANGLE))
neck_end = Vector((0, y_front, spine_z)) + neck_dir * neck_len
head_len = max(0.06, neck_end.y - snout_y)
sel = (y < snout_y + 0.3 * head_len) & (np.abs(x) < 0.2 * width) & (z > belly_z)
chin_z = float(z[sel].min()) if sel.any() else nose_z - 0.08
mouth_z = nose_z - 0.55 * (nose_z - chin_z)  # mouth line, between nose and chin
jaw_len = 0.4 * head_len
hinge_y = snout_y + jaw_len                   # mouth corners
ball_r = float(np.clip(0.5 * (nose_z - chin_z), 0.03, 0.07))
sel = (y < hinge_y) & (np.abs(z - mouth_z) < 0.03)
muzzle_w = float(np.percentile(np.abs(x[sel]), 80)) if sel.sum() > 3 else 0.05

print('LANDMARKS', dict(y_front=y_front, y_back=y_back, x_front=x_front, x_back=x_back, back_z=back_z, belly_z=belly_z,
                       head=tuple(head_c), snout_y=snout_y, rump_y=rump_y, tail_len=tail_len,
                       nose_z=nose_z, chin_z=chin_z, mouth_z=mouth_z, muzzle_w=muzzle_w))

# ---------------------------------------------------------------- mouth
# Cut the muzzle along the mouth line and split it, so the jaw can open. Behind the
# lips: a dark mouth (moves with the head) and a tongue (moves with the jaw). The skin
# is drawn double-sided so an open mouth never shows a see-through gap.
bm = bmesh.new()
bm.from_mesh(mesh.data)
front = [f for f in bm.faces
         if f.calc_center_median().y < hinge_y and chin_z - 0.03 < f.calc_center_median().z < nose_z + 0.03]
geom = list({v for f in front for v in f.verts}) + list({e for f in front for e in f.edges}) + front
cut = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, mouth_z), plane_no=(0, 0, 1))['geom_cut']
lips = [e for e in cut if isinstance(e, bmesh.types.BMEdge) and all(v.co.y < hinge_y - 1e-4 for v in e.verts)]
bmesh.ops.split_edges(bm, edges=lips)
part = bm.verts.layers.int.new('part')  # 1 = lower lip (jaw), 2 = mouth (head), 3 = tongue (jaw)
for v in bm.verts:
    if v.co.y < hinge_y and v.link_faces:
        if sum(f.calc_center_median().z for f in v.link_faces) / len(v.link_faces) < mouth_z:
            v[part] = 1

mats = mesh.data.materials
for m in mats:
    m.use_backface_culling = False


def add_material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = 0.7
    mats.append(mat)
    return len(mats) - 1


def blob(center, radii, mat, tag):
    from mathutils.bvhtree import BVHTree
    coat = BVHTree.FromBMesh(bm)   # the head as it is now (before this blob)
    c = Vector(center)
    # the centre must be inside the head: behind the face surface seen from the front
    # (a fluffy face can bulge back past where the mouth line puts it)
    front = coat.ray_cast(c + Vector((0, -1.0, 0)), Vector((0, 1, 0)), 2.0)[0]
    if front is not None and c.y < front.y + 1.25 * radii[1]:
        c.y = front.y + 1.25 * radii[1]
        center = (c.x, c.y, c.z)
    made = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=1.0)['verts']
    for v in made:
        p = Vector((center[0] + v.co.x * radii[0], center[1] + v.co.y * radii[1], center[2] + v.co.z * radii[2]))
        # stay inside the head: a point past the fur (short fluffy muzzles, the Pomeranian)
        # is pulled back in, so the mouth never hangs out below the chin
        d = p - c
        if d.length > 1e-6:
            hit = coat.ray_cast(c, d.normalized(), d.length)[0]
            if hit is not None:
                p = c + d.normalized() * (hit - c).length * 0.8
        v.co = p
        v[part] = tag
    for f in {f for v in made for f in v.link_faces}:
        f.material_index = mat
        f.smooth = True


gap = nose_z - chin_z
mouth_len = hinge_y - snout_y
# set back from the lips so their tips never poke through a closed mouth
blob((0, snout_y + 0.74 * mouth_len, mouth_z + 0.05 * gap), (0.6 * muzzle_w, 0.32 * mouth_len, 0.26 * gap),
     add_material('mouth', (0.16, 0.03, 0.04)), 2)
blob((0, snout_y + 0.79 * mouth_len, mouth_z - 0.12 * gap), (0.45 * muzzle_w, 0.3 * mouth_len, 0.09 * gap),
     add_material('tongue', (0.85, 0.35, 0.42)), 3)
bm.to_mesh(mesh.data)
bm.free()
mouth_part = [a.value for a in mesh.data.attributes['part'].data]
mesh.data.attributes.remove(mesh.data.attributes['part'])

# ---------------------------------------------------------------- skeleton
arm_obj = bpy.data.objects.new('dog_rig', bpy.data.armatures.new('dog_rig'))
bpy.context.scene.collection.objects.link(arm_obj)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_obj.data.edit_bones
FWD, DOWN, UP = Vector((0, -1, 0)), Vector((0, 0, -1)), Vector((0, 0, 1))


def bone(name, head, direction, length, parent=None, connect=False, deform=True):
    b = eb.new(name)
    b.head = Vector(head)
    b.tail = b.head + direction.normalized() * max(length, 0.02)
    b.roll = 0.0
    b.use_deform = deform
    if parent:
        b.parent = eb[parent]
        b.use_connect = connect
    return b


body = y_back - y_front
bone('root', (0, 0, 0), FWD, 0.15, deform=False)
bone('hips', (0, y_back, spine_z), FWD, body / 3, 'root')
bone('spine', eb['hips'].tail, FWD, body / 3, 'hips', True)
bone('chest', eb['spine'].tail, FWD, body / 3, 'spine', True)
bone('neck', eb['chest'].tail, neck_dir, neck_len, 'chest', True)
bone('head', neck_end, FWD, head_len, 'neck', True)
bone('jaw', (0, hinge_y, mouth_z), FWD, jaw_len, 'head', deform=False)
bone('mouth', (0, snout_y + 0.5 * ball_r, mouth_z), FWD, 0.03, 'head', deform=False)
for k in range(3):  # three bones along the tail, so it can curve, whip and point
    a, b = tail_joints[k], tail_joints[k + 1]
    if (b - a).length < 0.01:  # keep degenerate bits (tight curls) usable
        b = a + (b - a if (b - a).length > 1e-6 else Vector((0, 1, 1))).normalized() * 0.01
        tail_joints[k + 1] = b
    bone(f'tail.{k + 1}', a, b - a, (b - a).length, 'hips' if k == 0 else f'tail.{k}', k > 0)
# Marker at the tail tip (no skin), so the engine can aim the last tail bone too.
bone('tail.tip', tail_joints[3], tail_joints[3] - tail_joints[2], 0.01, 'tail.3', True, deform=False)

for side, sx in (('L', 1), ('R', -1)):  # the dog's left is +X when it faces -Y
    for names, yy, xx, parent in ((('upperarm', 'forearm', 'hand'), y_front, x_front, 'chest'),
                                  (('thigh', 'shin', 'foot'), y_back, x_back, 'hips')):
        top = Vector((sx * xx, yy, spine_z))
        knee = Vector((sx * xx, yy, 0.45 * spine_z))
        ankle = Vector((sx * xx, yy, 0.12 * spine_z))
        bone(f'{names[0]}.{side}', top, DOWN, top.z - knee.z, parent)
        bone(f'{names[1]}.{side}', knee, DOWN, knee.z - ankle.z, f'{names[0]}.{side}', True)
        bone(f'{names[2]}.{side}', ankle, FWD, 0.08, f'{names[1]}.{side}')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------------------------------------------------------- skin
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# If heat weighting failed on much of the mesh (AI meshes aren't always watertight),
# weight a sealed voxel-remeshed copy instead and copy its weights across.
unweighted = sum(1 for v in mesh.data.vertices if not any(g.weight > 1e-4 for g in v.groups))
proxy_used = unweighted > 0.1 * len(mesh.data.vertices)
if proxy_used:
    proxy = mesh.copy()
    proxy.data = mesh.data.copy()
    bpy.context.scene.collection.objects.link(proxy)
    proxy.parent = None
    proxy.modifiers.clear()
    proxy.vertex_groups.clear()
    rm = proxy.modifiers.new('remesh', 'REMESH')
    rm.mode, rm.voxel_size = 'VOXEL', 0.012
    bpy.ops.object.select_all(action='DESELECT')
    proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxy
    bpy.ops.object.modifier_apply(modifier='remesh')
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    mesh.vertex_groups.clear()
    for g in proxy.vertex_groups:
        mesh.vertex_groups.new(name=g.name)
    dt = mesh.modifiers.new('weights', 'DATA_TRANSFER')
    dt.object = proxy
    dt.use_vert_data = True
    dt.data_types_verts = {'VGROUP_WEIGHTS'}
    dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'
    dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.modifier_move_to_index(modifier='weights', index=0)
    bpy.ops.object.modifier_apply(modifier='weights')
    bpy.data.objects.remove(proxy)

# Clean up: a leg may not pull on the other side of the body or on the back.
groups = {g.name: g for g in mesh.vertex_groups}
legs = [n for n in groups if n.split('.')[0] in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot')]
deform = [b.name for b in arm_obj.data.bones if b.use_deform]
for v in mesh.data.vertices:
    co = mesh.matrix_world @ v.co
    for g in list(v.groups):
        name = mesh.vertex_groups[g.group].name
        if name in legs:
            sx = 1 if name.endswith('.L') else -1
            if co.x * sx < -0.01 or co.z > spine_z + 0.05:
                g.weight = 0.0
            elif skirt:
                # Long coats hang from the body: legs only move what's close to them.
                front = name.split('.')[0] in ('upperarm', 'forearm', 'hand')
                axis = Vector((sx * (x_front if front else x_back), y_front if front else y_back))
                d = (co.xy - axis).length
                g.weight *= max(0.0, min(1.0, 1 - (d - 0.07) / 0.07))
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


# Lower-leg bones only move skin below the knee/elbow, and upper legs only skin near the
# leg: otherwise the bum and belly get dragged down toward the feet when the legs fold
# (the German Shepherd's squat). The weight moves up the chain: shin -> thigh -> hips.
knee_z = 0.45 * spine_z
moves = []  # (vertex, from group, to group, weight); applied after the scan
for v in mesh.data.vertices:
    co = mesh.matrix_world @ v.co
    for g in v.groups:
        name = mesh.vertex_groups[g.group].name
        part, _, side = name.partition('.')
        if g.weight <= 0 or part not in ('forearm', 'hand', 'shin', 'foot', 'upperarm', 'thigh'):
            continue
        upper = {'forearm': 'upperarm', 'hand': 'upperarm', 'shin': 'thigh', 'foot': 'thigh'}.get(part)
        if upper and co.z > knee_z + 0.04:
            moves.append((v.index, name, f'{upper}.{side}', g.weight))
        elif part in ('upperarm', 'thigh') and abs(co.y - (y_front if part == 'upperarm' else y_back)) > 0.16:
            moves.append((v.index, name, 'chest' if part == 'upperarm' else 'hips', g.weight))
for i, src, dst_g, w in moves:
    groups[src].remove([i])
    groups[dst_g].add([i], w, 'ADD')
# The tail moves the tail and nothing else: tail weight on body vertices goes back to
# the hips (so a wag doesn't drag the rump and its coat pattern), and every tail vertex
# is fully on the tail bones (so the whole tail swings, plumes included).
hips_g = groups['hips']
tail_names = ('tail.1', 'tail.2', 'tail.3')
tail_segs = {n: (arm_obj.data.bones[n].head_local, arm_obj.data.bones[n].tail_local) for n in tail_names}
for n in tail_names:
    if n not in groups:
        groups[n] = mesh.vertex_groups.new(name=n)
for v in mesh.data.vertices:
    co = mesh.matrix_world @ v.co
    is_tail = tail_like(co) and not tail_bob
    tw = sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name in tail_names)
    if not is_tail and tw > 0:
        for g in v.groups:
            if mesh.vertex_groups[g.group].name in tail_names:
                g.weight = 0.0
        hips_g.add([v.index], tw, 'ADD')
    elif is_tail and tw < 0.95:
        for gi in [g.group for g in v.groups]:
            mesh.vertex_groups[gi].remove([v.index])
        near = sorted((seg_dist(co, *tail_segs[n]), n) for n in tail_names)[:2]
        (da, na), (db, nb) = near
        groups[na].add([v.index], db / (da + db + 1e-6), 'REPLACE')
        groups[nb].add([v.index], da / (da + db + 1e-6), 'REPLACE')
# Any vertex the heat solver missed goes to its nearest bone.
segs = {b.name: (arm_obj.matrix_world @ b.head_local, arm_obj.matrix_world @ b.tail_local)
        for b in arm_obj.data.bones if b.use_deform}


# Vertices the heat solver missed (it can fail on parts of an AI mesh; on the English
# Bulldog it fails almost everywhere) get a smooth blend of their nearest allowed bones
# instead of one rigid bone, following the same rules as above.
def allowed(name, co):
    part = name.split('.')[0]
    if part in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot'):
        sx = 1 if name.endswith('.L') else -1
        return co.x * sx > -0.01 and co.z < spine_z + 0.05 and not skirt
    if part == 'tail':
        return tail_like(co) and not tail_bob
    return True


missed = 0
for v in mesh.data.vertices:
    if sum(g.weight for g in v.groups) < 1e-4:
        co = mesh.matrix_world @ v.co
        near = sorted((seg_dist(co, *segs[n]), n) for n in segs if allowed(n, co))[:3]
        ws = [(1 / (d * d + 1e-4), n) for d, n in near]
        total = sum(w for w, _ in ws)
        for w, n in ws:
            if n not in groups:
                groups[n] = mesh.vertex_groups.new(name=n)
            groups[n].add([v.index], w / total, 'REPLACE')
        missed += 1
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)

# Jaw: hand-weighted rather than heat-weighted. The lower lip goes to the jaw (fading
# toward the mouth corners), the mouth to the head and the tongue to the jaw.
arm_obj.data.bones['jaw'].use_deform = True
jaw_g = mesh.vertex_groups.new(name='jaw')
head_g = mesh.vertex_groups['head']
jaw_verts = 0
for v in mesh.data.vertices:
    tag = mouth_part[v.index]
    if not tag:
        continue
    for gi in [g.group for g in v.groups]:
        mesh.vertex_groups[gi].remove([v.index])
    if tag == 2:
        head_g.add([v.index], 1.0, 'REPLACE')
        continue
    w = 1.0 if tag == 3 else min(1.0, max(0.0, (hinge_y - (mesh.matrix_world @ v.co).y) / (0.25 * jaw_len)))
    jaw_g.add([v.index], w, 'REPLACE')
    if w < 1:
        head_g.add([v.index], 1 - w, 'REPLACE')
    jaw_verts += 1

def clamp(v):
    return min(1.0, max(0.0, v))


# ---------------------------------------------------------------- smooth weights
# Heat weighting switches bones over a short distance, so a bend gets crushed into a thin
# band of triangles. A few rounds of neighbour averaging spread each bend out. The tail
# (past its root) and the mouth stay crisp; the tail root blends softly into the hips.
# Legs are kept off the other side of the body and off the back afterwards.
verts = mesh.data.vertices
names = [g.name for g in mesh.vertex_groups]
W = np.zeros((len(verts), len(names)))
for v in verts:
    for g in v.groups:
        W[v.index, g.group] = g.weight
nbrs = [[] for _ in verts]
for e in mesh.data.edges:
    i, j = e.vertices
    nbrs[i].append(j)
    nbrs[j].append(i)
co_all = np.array([tuple(mesh.matrix_world @ v.co) for v in verts])
locked = np.array([bool(mouth_part[i]) or (tail_like(co_all[i]) and not tail_bob
                   and np.linalg.norm(co_all[i] - np.array(tail_base)) > 0.06) for i in range(len(verts))])
for _ in range(4):
    avg = np.array([W[n].mean(axis=0) if n else W[i] for i, n in enumerate(nbrs)])
    W = np.where(locked[:, None], W, 0.5 * W + 0.5 * avg)
# Tail root: smoothing spreads tail weight unevenly onto the rump (the Pug's bum wobbled
# with every wag), and a hard cut leaves the whole bend in one crease at the root (the tail
# pinches thin when it swings). So the root gets an explicit soft blend: rump vertices close
# to the base follow tail.1 a little (fading to nothing a tail-width away), and the tail's
# first few vertices keep a little hips, so a wag bends over a short distance, not a crease.
tail_cols = [k for k, n in enumerate(names) if n.startswith('tail')]
hip_col = names.index('hips')
t1_col = names.index('tail.1') if 'tail.1' in names else None
if not tail_bob and tail_idx:
    near_base = [np.linalg.norm(P[i] - np.array(tail_base)) for i in tail_idx]
    root_r = float(np.clip(np.percentile(near_base, 20) if near_base else 0.04, 0.035, 0.07))
else:
    root_r = 0.0
for i in range(len(verts)):
    if locked[i]:
        continue
    d = np.linalg.norm(co_all[i] - np.array(tail_base))
    tw = W[i, tail_cols].sum()
    if tail_like(co_all[i]):
        if root_r and d < root_r and tw > 0:      # tail's first vertices keep a little hips
            h = 0.35 * (1 - d / root_r) ** 2
            W[i, tail_cols] *= (1 - h) / tw * tw
            W[i, hip_col] += h * tw
        continue
    if tw > 0:                                     # everything else on the body: no tail
        W[i, tail_cols] = 0
        W[i, hip_col] += tw
    if root_r and t1_col is not None and d < 2 * root_r:   # ...but the rump round the root follows a little
        f = 0.45 * (1 - d / (2 * root_r)) ** 2
        W[i] *= (1 - f)
        W[i, t1_col] += f
leg_cols = [k for k, n in enumerate(names) if n.split('.')[0] in ('upperarm', 'forearm', 'hand', 'thigh', 'shin', 'foot')]
# Legs only move skin on the leg: smoothing (and heat weighting on round bodies) leaves leg
# weight on the belly and flanks, which then swing with every stride. Away from each leg's
# column (radius measured at the knee), leg weight fades out into the chest / hips.
for front in (True, False):
    for sx in (1, -1):
        axis = np.array((sx * (x_front if front else x_back), y_front if front else y_back))
        dxy = np.linalg.norm(co_all[:, :2] - axis, axis=1)
        ring = (np.abs(co_all[:, 2] - knee_z) < 0.04) & (co_all[:, 0] * sx > 0) & (dxy < 0.2)
        leg_r = float(np.percentile(dxy[ring], 70)) if ring.sum() > 4 else 0.06
        fade = np.clip(1 - (dxy - leg_r) / 0.04, 0, 1)
        # not down at the paws (wider than the leg at the knee): below the knee it's all leg
        fade = 1 - (1 - fade) * np.clip((co_all[:, 2] - (knee_z - 0.1)) / 0.08, 0, 1)
        cols = [k for k in leg_cols if names[k].endswith('.L' if sx == 1 else '.R') and
                (names[k].split('.')[0] in ('upperarm', 'forearm', 'hand')) == front]
        lost = W[:, cols].sum(1) * (1 - fade)
        W[:, cols] *= fade[:, None]
        W[:, names.index('chest' if front else 'hips')] += lost
for k in leg_cols:
    sx = 1 if names[k].endswith('.L') else -1
    W[(co_all[:, 0] * sx < -0.01) | (co_all[:, 2] > spine_z + 0.05), k] = 0
for i in range(len(verts)):  # keep the four strongest, normalised
    row = W[i]
    keep = np.argsort(row)[-4:]
    row2 = np.zeros_like(row)
    row2[keep] = row[keep]
    if row2.sum() > 0:
        W[i] = row2 / row2.sum()
for k, n in enumerate(names):
    g = mesh.vertex_groups[n]
    for i in range(len(verts)):
        if W[i, k] > 1e-4:
            g.add([i], float(W[i, k]), 'REPLACE')
        else:
            g.remove([i])

# ---------------------------------------------------------------- eyes and nose
# Separate glossy geometry laid on the face, so eyes and nose read as crisp dark dots on any
# coat and any colorway. Positions and sizes come from faces.json (picked on the original
# textures, glTF space: x left, y up, z forward). Skinned like the face beneath them.
def face_part(center, rx, ry, segs, material, nose=False):
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromPolygons([v.co.copy() for v in mesh.data.vertices], [list(p.vertices) for p in mesh.data.polygons])
    hit, n, *_ = bvh.find_nearest(center)
    # Facing: the average surface normal over the whole part, not one point (a wrinkle under
    # the centre would tip the part up like an eye on a stalk).
    ns = Vector((0, 0, 0))
    for a in range(12):
        t = 2 * math.pi * a / 12
        for r in (0.4, 0.9):
            off = Vector((math.cos(t) * rx * r, 0, math.sin(t) * ry * r))
            off = off - n * off.dot(n)
            _, nn, *_ = bvh.find_nearest(hit + off)
            if nn is not None:
                ns += nn
    if ns.length > 1e-6:
        n = (ns + n * 4).normalized()
    up = Vector((0, 0, 1))
    uy = (up - n * n.dot(up)).normalized()
    ux = uy.cross(n)
    bm2 = bmesh.new()
    if True:
        # A solid rounded part: a squashed sphere (the nose in a rounded-triangle outline),
        # half sunk into the face. It swallows the model's own sculpted nose / eye bumps,
        # so nothing pokes through or curls up around it, whatever the face's shape.
        made = bmesh.ops.create_uvsphere(bm2, u_segments=12 if nose else 10, v_segments=6, radius=1.0)['verts']
        # nose: a squashed dome; eyes: near-round balls sunk a third into the head (forgiving
        # on any face shape, and the far eye still shows from the side)
        depth, sink = (0.55, 0.12) if nose else (0.9, -0.3)
        depth, sink = depth * min(rx, ry), sink * min(rx, ry)
        for v in made:
            a, b, c = v.co   # a: across, b: up, c: out of the face
            a *= 1 + 0.3 * b if nose else 1
            v.co = hit + ux * (a * rx) + uy * (b * ry) + n * (c * depth + sink)
    else:
        rings = (0.0, 0.6, 1.0)
        # Surface height under each vertex (along the centre normal), from a ray down onto the
        # face. Rays near the mouth can catch a lip or fold, so heights are clamped and smoothed
        # round each ring: the part stays a clean dome hugging the face, never a spiky one.
        plan, heights = [], []
        for rho in rings:
            prow, hrow = [], []
            for k in range(segs if rho else 1):
                t = 2 * math.pi * k / segs + math.pi / 2
                sx, sy = math.cos(t), math.sin(t)
                if nose:   # rounded triangle, point down
                    sx *= 1 + 0.3 * sy
                q = hit + (ux * sx * rx + uy * sy * ry) * rho
                loc, *_ = bvh.ray_cast(q + n * 0.06, -n, 0.12)
                h = (loc - hit).dot(n) if loc is not None else 0.0
                prow.append(q)
                hrow.append(max(-0.6 * min(rx, ry), min(0.3 * min(rx, ry), h)))
            plan.append(prow)
            heights.append(hrow)
        for _ in range(2):
            heights = [[(r[(k - 1) % len(r)] + 2 * r[k] + r[(k + 1) % len(r)]) / 4 for k in range(len(r))] for r in heights]
        # the nose sits on a bumpy muzzle tip: lift it more so fur can't poke through
        lift = 0.006 if nose else 0.0045
        grid = []
        for rho, prow, hrow in zip(rings, plan, heights):
            dome = (1 - rho * rho) * min(rx, ry) * (0.35 if nose else 0.4)
            grid.append([bm2.verts.new(q + n * (h + lift + dome)) for q, h in zip(prow, hrow)])
        # Tuck the face under the part: the AI's own sculpted nose / eye bumps would otherwise
        # poke out through the bead ("a nose on top of the nose"). Coat vertices inside the
        # footprint that rise above the bead's underside are pushed just below it.
        ring_h = [sum(r) / len(r) for r in heights]
        domek = min(rx, ry) * (0.35 if nose else 0.4)
        for v in mesh.data.vertices:
            dv = v.co - hit
            h = dv.dot(n)
            if h < -0.05 or h > 0.1:
                continue
            pu, pw = dv.dot(ux) / rx, dv.dot(uy) / ry
            if nose:
                pu /= 1 + 0.3 * max(-1.0, min(1.0, pw))
            rho = math.sqrt(pu * pu + pw * pw)
            if rho > 1.08:
                continue
            r = min(rho, 1.0)
            base = ring_h[0] + (ring_h[1] - ring_h[0]) * min(r / 0.6, 1) + (ring_h[2] - ring_h[1]) * max(0.0, (r - 0.6) / 0.4)
            top = base + lift + (1 - r * r) * domek - 0.004
            if h > top:
                v.co = v.co - n * (h - top)
        for k in range(segs):
            bm2.faces.new((grid[0][0], grid[1][k], grid[1][(k + 1) % segs]))
        for a, b in zip(grid[1:], grid[2:]):
            for k in range(segs):
                bm2.faces.new((a[k], b[k], b[(k + 1) % segs], a[(k + 1) % segs]))
    me = bpy.data.meshes.new(material.name)
    bm2.normal_update()
    bm2.to_mesh(me)
    bm2.free()
    for p in me.polygons:
        p.use_smooth = True

    me.materials.append(material)
    ob = bpy.data.objects.new(material.name, me)
    bpy.context.scene.collection.objects.link(ob)
    # Same weights as the face under each vertex, so the part rides the skin exactly.
    from mathutils.kdtree import KDTree
    kd = KDTree(len(mesh.data.vertices))
    for i, v in enumerate(mesh.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    gname = {g.index: g.name for g in mesh.vertex_groups}
    for v in me.vertices:
        _, i, _ = kd.find(v.co)
        for ge in mesh.data.vertices[i].groups:
            if ge.weight > 1e-4:
                g = ob.vertex_groups.get(gname[ge.group]) or ob.vertex_groups.new(name=gname[ge.group])
                g.add([v.index], ge.weight, 'REPLACE')
    return ob


def glossy(name, rgb, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = rough
    return mat


face = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'faces.json'))).get(
    os.path.basename(dst)[:-4])
if face:
    g2b = lambda p: Vector((p[0], -p[2], p[1]))  # noqa: E731  glTF -> Blender axes
    ec = face.get('eye_color')   # e.g. the Husky's blue eyes
    ec = tuple(((int(ec[i:i + 2], 16) / 255 + 0.055) / 1.055) ** 2.4 for i in (1, 3, 5)) if ec else (0.012, 0.011, 0.011)
    eye_mat, nose_mat = glossy('eye', ec, 0.22), glossy('nose', (0.018, 0.016, 0.016), 0.38)
    ex, ey, ez = face['eye']
    eye_mat_r = glossy('eyeR', ec, 0.22)   # the dog's right eye: its own part, so each eye can differ
    parts = [face_part(g2b((sx * ex, ey, ez)), face['eye_r'], face['eye_r'] * 1.08, 12, m) for sx, m in ((1, eye_mat), (-1, eye_mat_r))]
    parts.append(face_part(g2b(face['nose']), *face['nose_r'], 14, nose_mat, nose=True))
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()

# ---------------------------------------------------------------- one material for the face parts
# Eyes, nose, mouth and tongue share one material (one draw call instead of four). Each
# vertex carries its part's default color (COLOR_0) and a part id (_PART: 0 coat, 1 left eye,
# 2 nose, 3 mouth, 4 tongue, 5 right eye), so a game can still recolor each part (dogcoat.js setFace).
PARTS = {'eye': 1, 'nose': 2, 'mouth': 3, 'tongue': 4, 'eyeR': 5}
mats = mesh.data.materials
part_of_slot = {i: PARTS.get(m.name.split('.')[0], 0) for i, m in enumerate(mats)}
slot_color = {}
for i, m in enumerate(mats):
    if part_of_slot[i]:
        bsdf = m.node_tree.nodes['Principled BSDF']
        slot_color[i] = tuple(bsdf.inputs['Base Color'].default_value)
face_mat = bpy.data.materials.new('face')
face_mat.use_nodes = True
fb = face_mat.node_tree.nodes['Principled BSDF']
fb.inputs['Roughness'].default_value = 0.35
vc = face_mat.node_tree.nodes.new('ShaderNodeVertexColor')
vc.layer_name = 'Col'
face_mat.node_tree.links.new(vc.outputs['Color'], fb.inputs['Base Color'])
mats.append(face_mat)
face_slot = len(mats) - 1
for a in list(mesh.data.color_attributes):   # the AI mesh's own (white) colors would be exported instead
    mesh.data.color_attributes.remove(a)
col = mesh.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
part = mesh.data.attributes.new('_PART', 'FLOAT', 'POINT')
vpart = np.zeros(len(mesh.data.vertices))
vcol = np.ones((len(mesh.data.vertices), 4))
for poly in mesh.data.polygons:
    p = part_of_slot.get(poly.material_index, 0)
    if p:
        for vi in poly.vertices:
            vpart[vi] = p
            vcol[vi] = slot_color[poly.material_index]
        poly.material_index = face_slot
col = mesh.data.color_attributes['Col']   # adding _PART invalidated the earlier reference
col.data.foreach_set('color', vcol.astype(np.float32).ravel())
mesh.data.attributes['_PART'].data.foreach_set('value', vpart.astype(np.float32))
mesh.data.color_attributes.active_color = col
mesh.data.color_attributes.render_color_index = mesh.data.color_attributes.active_color_index
for i in sorted((i for i, p in part_of_slot.items() if p), reverse=True):   # drop the now-empty slots
    mesh.active_material_index = i
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.material_slot_remove()

# ---------------------------------------------------------------- per-dog data
# Leg length is the unit clips use for foot placement and root motion; engines scale
# the root track by leg_length / clips leg_length (see dogclips.js).
arm_obj['leg_length'] = round(spine_z, 4)
arm_obj['ball_radius'] = round(ball_r, 4)
arm_obj['body_length'] = round(body, 4)  # shoulder to hip; long dogs tilt less (dogclips.js)
# tail thickness: how far the tail's surface reaches below its bones (the floor guard in
# dogclips.js keeps the bones this far up)
if not tail_bob and tail_idx:
    segs_t = list(zip(tail_joints, tail_joints[1:]))
    dists = [min(seg_dist(Vector(P[i]), a_, b_) for a_, b_ in segs_t) for i in tail_idx]
    arm_obj['tail_radius'] = round(float(np.percentile(dists, 90)), 4)
if curl_hint:
    arm_obj['tail_curl'] = 1   # curled tails wiggle rather than wag (dogclips.js damps them)
arm_obj['belly_gap'] = round((spine_z - belly_z) / spine_z, 4)  # belly below spine, in leg lengths (lying down)

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85,
                          export_animations=False, export_def_bones=False, export_extras=True,
                          export_vertex_color='ACTIVE', export_attributes=True)
tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)

# Wearables fitted to this dog (wear_lib.py): rigged/wear/<slug>--collar.glb, --bandana.glb
import wear_lib  # noqa: E402
wear_dir = os.path.join(os.path.dirname(dst), 'wear')
os.makedirs(wear_dir, exist_ok=True)
fit = wear_lib.Fitter(mesh, arm_obj)
for kind in ('collar', 'bandana'):
    ob = getattr(fit, kind)()
    wear_lib.export_wear(arm_obj, ob, os.path.join(wear_dir, f'{os.path.basename(dst)[:-4]}--{kind}.glb'))
    bpy.data.objects.remove(ob)
print('RIG', dst, tris, 'tris', 'proxy' if proxy_used else '', 'missed', missed, 'jaw', jaw_verts, 'skirt' if skirt else '',
      'spine_z %.2f belly %.2f back %.2f feet y %.2f/%.2f' % (spine_z, belly_z, back_z, y_front, y_back),
      'tail', 'bob' if tail_bob else '%d verts %.2f long' % (len(tail_idx), tail_len))

# ---------------------------------------------------------------- preview: mid-stride
if png:
    clips_lib.author(arm_obj, spine_z, only=['walk'])
    arm_obj.animation_data.nla_tracks['walk'].is_solo = True
    scene = bpy.context.scene
    scene.frame_set(clips_lib.FPS // 4)
    engines = {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
    scene.render.resolution_x = scene.render.resolution_y = 512
    scene.render.filepath = png
    scene.view_settings.view_transform = 'Standard'
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.86, 0.86, 0.88, 1)
    scene.world = world
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    cam.data.lens = 50
    centre_pt = Vector((0, (y.min() + y.max()) / 2, 0.45))
    cam.location = centre_pt + Vector((-2.6, -0.6, 0.5))  # side view, slightly from the front
    cam.rotation_euler = (centre_pt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(45), 0, math.radians(-60))
    scene.collection.objects.link(sun)
    bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- shared clips file
if clips_path:
    import subprocess
    clips_lib.BACK_UP = (back_z - spine_z) * 1.1
    meta = clips_lib.author(arm_obj, spine_z)
    arm_obj['clips'] = json.dumps(meta)
    bpy.data.objects.remove(mesh)
    for track in arm_obj.animation_data.nla_tracks:
        track.is_solo = False
    bpy.context.scene.render.fps = clips_lib.FPS
    bpy.ops.export_scene.gltf(filepath=clips_path, export_format='GLB', export_animation_mode='NLA_TRACKS',
                              export_force_sampling=False, export_def_bones=False, export_extras=True)
    subprocess.run(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'strip_tracks.py'), clips_path],
                   check=True)
    print('CLIPS', clips_path, ', '.join(meta))
