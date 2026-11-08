"""Build the swappable head parts.

blender -b -t 1 --factory-startup -P scripts/build_heads.py -- <out_dir>

Papercraft heads are two boxes: a big skull block and a smaller muzzle block
stepped down in front of it, with few, flat planes (8-sided rings, flat top).
Any head goes on any body: bodies end at the top of the neck and export a
socket_head node; head units are "skull height = 1" so the socket scale is the
build's head height.

Each head GLB contains:
  head                 the mesh; COLOR_0 tags nose (R) and eyes (G)
  socket_ear_L/R       where the ear parts attach (extras: uv2 for their colour)
  coat_<type>          optional head fluff for coats that need it
                       (shaggy fringe, curly crown, poodle topknot, puff)
UV sets: TEXCOORD_0 even unwrap for tiling patterns (one tile per 2 x UV_TILE
head units; the viewer scales it by the head size), TEXCOORD_1 maps the head
into the face area of the region masks (u 0.76-1.0, v 0.45-1.0), so face
masks, blazes and brow dots land on every head and stay put when animated.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(__file__))
from dogkit import UV_TILE, Builder, even_uvs, export, ring_points, split_jaw  # noqa: E402

out_dir = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out_dir, exist_ok=True)

SIDES = 8
# Head types, in head units (skull height 1). skull = (length, half-width);
# muzzle = (length, half-width, half-height); drop = muzzle centre below the
# skull centre (the step at the brow); taper = muzzle tip size; roman bows the
# muzzle top up (convex profile); exp > 2 squares the rings off.
HEADS = {
    # Corgi, Shiba, Pomeranian, spitz: broad cheeks, short pointed muzzle.
    'fox': dict(skull=(0.9, 0.56), cheeks=1.25, muzzle=(0.34, 0.22, 0.16), drop=-0.22, taper=0.72,
                roman=0.0, exp=2.8, eye=0.065, nose=1.0, ear=1.0),
    # German Shepherd, Husky, Malinois: longer skull and a long tapering muzzle.
    'wedge': dict(skull=(1.0, 0.46), cheeks=1.1, muzzle=(0.72, 0.2, 0.17), drop=-0.2, taper=0.72,
                  roman=0.0, exp=3.0, eye=0.065, nose=1.0, ear=1.0),
    # Pug, Frenchie, Boston: round-square skull, a short wide flat muzzle, big eyes.
    'flat': dict(skull=(0.82, 0.6), cheeks=1.12, muzzle=(0.14, 0.36, 0.22), drop=-0.16, taper=1.0,
                 roman=0.0, exp=4.0, eye=0.1, nose=1.1, ear=0.85),
}
# Ear parts are authored in "head half-heights" (0.5 head units); a bit under
# that keeps ears in proportion with the bigger papercraft heads.
EAR_UNIT = 0.42


def head_rings(t):
    sl, sw = t['skull']
    ml, mw, mh = t['muzzle']
    d, tp, rm = t['drop'], t['taper'], t['roman']
    # (x, z, half-w, half-h): back of skull, skull, cheeks, brow, then the
    # stepped-down muzzle block.
    spec = [
        (0.0, 0.0, sw * 0.85, 0.42),
        (sl * 0.3, 0.0, sw, 0.5),
        (sl * 0.65, -0.03, sw * t['cheeks'], 0.48),
        (sl, -0.02, sw * 0.92, 0.44),
        (sl + 0.01, d, mw, mh),
        (sl + ml * 0.55, d + rm, mw * (1 + tp) / 2, mh * 0.97),
        (sl + ml, d, mw * tp, mh * tp),
    ]
    rings, centers = [], []
    for i, (x, z, w, h) in enumerate(spec):
        c = Vector((x, 0, z))
        centers.append(c)
        rings.append(ring_points(c, Vector((1, 0, 0)), w, h, SIDES, exp=t['exp'], flat_top=True))
    return rings, centers, spec


def fluff(ring, center, f, phase, spike, drop=0.0, lift=0.0):
    out = []
    for k, p in enumerate(ring):
        d = p - center
        jag = 1 + spike if (k + phase) % 2 == 0 else 1 - spike * 0.45
        q = center + d * f * jag
        if drop and d.z < 0:
            q.z -= drop * (0.75 if (k + phase) % 2 else 1.0)
        if lift and d.z > 0:
            q.z += lift
        out.append(q)
    return out


def build(name, t):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rings, centers, spec = head_rings(t)
    sl, sw = t['skull']
    ml, mw, mh = t['muzzle']
    B = Builder()
    B.tube(rings)

    # Eyes on the front face of the skull, above the muzzle step.
    for side in (1, -1):
        res = bmesh.ops.create_uvsphere(B.bm, u_segments=6, v_segments=4, radius=t['eye'])
        bmesh.ops.translate(B.bm, vec=Vector((sl - 0.015, side * sw * 0.55, 0.13)), verts=res['verts'])
        B.tag_new(res['verts'], 'eye')

    # Nose: a small block on the top front of the muzzle.
    res = bmesh.ops.create_cube(B.bm, size=1.0)
    nv = res['verts']
    n = t['nose']
    bmesh.ops.scale(B.bm, vec=(0.12 * n, mw * 1.05 * n * t['taper'], mh * 0.75 * n), verts=nv)
    for v in nv:
        if v.co.x > 0:
            v.co.y *= 0.8
    bmesh.ops.translate(B.bm, vec=Vector((sl + ml + 0.02, 0, t['drop'] + mh * t['taper'] * 0.45)), verts=nv)
    B.tag_new(nv, 'nose')

    # Attach point: the neck enters under the back of the skull.
    attach = Vector((sl * 0.18, 0, -0.22))
    for v in B.bm.verts:
        v.co -= attach
    # Lower jaw: the muzzle faces below its centre line, hinged at the back of the muzzle.
    hinge = Vector((sl, 0, t['drop'])) - attach
    jaw = split_jaw(B, lambda c: c.x > hinge.x - 0.02 and c.z < hinge.z - 0.01, hinge)
    obj = B.to_object('head')
    jaw.parent = obj
    even_uvs(obj, 2 * UV_TILE)

    # UV2: map the head into the face window of the region masks.
    zs = [v.co.z for v in obj.data.vertices]
    xs = [v.co.x for v in obj.data.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)

    # Piecewise in x so the stop (skull meets muzzle) lands on u = 0.87, the edge
    # of the face masks: masks then cover the muzzle and eyes on every head type.
    x_stop = sl - 0.06 - attach.x

    def face_uv(co):
        if co.x < x_stop:
            u = 0.76 + 0.11 * (co.x - x0) / (x_stop - x0)
        else:
            u = 0.87 + 0.13 * (co.x - x_stop) / (x1 - x_stop)
        return (u, 0.45 + 0.55 * (co.z - z0) / (z1 - z0))

    def add_face_uv(o):
        m = o.data
        proj = m.uv_layers.new(name='Projection')
        for loop in m.loops:
            proj.data[loop.index].uv = face_uv(m.vertices[loop.vertex_index].co)
        m.uv_layers.active = m.uv_layers['UVMap']

    add_face_uv(obj)
    mat = bpy.data.materials.new('dog')
    obj.data.materials.append(mat)
    even_uvs(jaw, 2 * UV_TILE)
    m = jaw.data   # jaw face UVs, in head space (its mesh is stored relative to the hinge)
    proj = m.uv_layers.new(name='Projection')
    for loop in m.loops:
        proj.data[loop.index].uv = face_uv(m.vertices[loop.vertex_index].co + jaw.location)
    m.uv_layers.active = m.uv_layers['UVMap']
    m.materials.append(mat)

    # Ear sockets on top of the skull.
    for side, nm in ((1, 'socket_ear_L'), (-1, 'socket_ear_R')):
        e = bpy.data.objects.new(nm, None)
        e.location = Vector((sl * 0.42, side * sw * 0.6, 0.47)) - attach
        e.scale = (EAR_UNIT * t['ear'],) * 3
        u, v = face_uv(e.location)
        e['uv2'] = [u, 1 - v]          # glTF flips V on export, like TEXCOORD_1
        bpy.context.scene.collection.objects.link(e)

    # Toy anchor under the muzzle (held items) and treat spot on top of the snout.
    for nm, pos in (('socket_mouth', Vector((sl + ml * 0.7, 0, t['drop'] - mh * 0.75))),
                    ('socket_nose', Vector((sl + ml * 0.6, 0, t['drop'] + mh * t['taper'] + 0.04)))):
        e = bpy.data.objects.new(nm, None)
        e.location = pos - attach
        bpy.context.scene.collection.objects.link(e)

    # Head fluff that goes with some body coats.
    coats = {
        'shaggy': [fluff(rings[i], centers[i], f, i, 0.16, drop=0.12) for i, f in
                   enumerate([1.3, 1.4, 1.42, 1.45, 1.6, 1.45, 1.25])],          # fringe over the eyes
        'curly': [fluff(rings[i], centers[i], f, i, 0.07, lift=0.08) for i, f in
                  enumerate([1.15, 1.2, 1.18, 1.1])],                             # curly crown
        'puff': [fluff(rings[i], centers[i], f, i, 0.14) for i, f in
                 enumerate([1.3, 1.35, 1.3])],                                    # pom-pom head ruff
    }
    for coat, rs in list(coats.items()) + [('poodleclip', None)]:
        S = Builder()
        if rs:
            S.tube(rs, cap_start=True, cap_end=False)
        else:   # topknot: a round pom on top of the skull
            res = bmesh.ops.create_icosphere(S.bm, subdivisions=2, radius=0.42)
            bmesh.ops.translate(S.bm, vec=Vector((sl * 0.35, 0, 0.55)), verts=res['verts'])
        for v in S.bm.verts:
            v.co -= attach
        o = S.to_object(f'coat_{coat}')
        even_uvs(o, 2 * UV_TILE)
        add_face_uv(o)
        o.data.materials.append(mat)

    export(os.path.join(out_dir, f'{name}.glb'))
    print('HEAD', name, len(obj.data.polygons), 'tris')


for name, t in HEADS.items():
    build(name, t)
