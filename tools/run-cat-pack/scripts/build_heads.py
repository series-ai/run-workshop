"""Build the swappable cat heads.

blender -b -t 1 --factory-startup -P scripts/build_heads.py -- <out_dir>

Art direction: concepts/singles/D-sleek-*.png. A big rounded head with a
flat-ish front face: small dark eyes (treated like the dog pack's), a tiny pink
nose, a little "w" smile, and a small muzzle and chin. Head units: head
height = 1 (the body's socket_head scale is the build's head height); +X is
the face, the origin is where the neck enters, under the back of the skull.

Each head GLB contains:
  head              the mesh; COLOR_0 tags nose, eye, ink (mouth) - see
                    catkit.TAG_RGB. Eyes are small dark spheres, as on the dogs.
  socket_ear_L/R    where the ear parts attach (extras: uv2 for their colour)
  socket_mouth      toy anchor under the chin
  coat_<type>       cheek ruffs for the semilong and long coats
UV sets: TEXCOORD_0 even unwrap for tiling patterns; TEXCOORD_1 maps the head
into the face window of the region masks (u 0.76-1.0 back of skull to nose,
v 0.45-1.0 chin to crown), so face masks (Siamese points, tuxedo muzzle,
tabby M) land on every head type.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.append(os.path.dirname(__file__))
from catkit import UV_TILE, Builder, even_uvs, export, ring_points  # noqa: E402

out_dir = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out_dir, exist_ok=True)

SIDES = 14   # round heads: more sides, still faceted
# Head types. skull = (half-length, half-width, half-height) of the cranium;
# cheeks = extra width low on the face; face = how flat the front is (0 round,
# 1 flat); muzzle = (forward, half-width, half-height) of the muzzle pad;
# eye = iris radius, eye_gap = half distance between eyes, eye_slant (deg,
# almond eyes), ear = ear size.
HEADS = {
    # Domestic Shorthair: round with a small muzzle.
    'domestic': dict(skull=(0.42, 0.5, 0.48), cheeks=1.08, face=0.55, muzzle=(0.07, 0.17, 0.11), eye=0.183,
                     eye_gap=0.224, eye_slant=0, ear=1.0),
    # British Shorthair, Chartreux, Scottish Fold: very round, chubby cheeks.
    'round': dict(skull=(0.4, 0.56, 0.47), cheeks=1.18, face=0.6, muzzle=(0.06, 0.19, 0.11), eye=0.199,
                  eye_gap=0.246, eye_slant=0, ear=0.9),
    # Siamese, Oriental: a longer wedge, narrow muzzle, almond eyes.
    'wedge': dict(skull=(0.48, 0.44, 0.44), cheeks=0.96, face=0.4, muzzle=(0.14, 0.13, 0.1), eye=0.174,
                  eye_gap=0.213, eye_slant=14, ear=1.15),
    # Persian, Exotic: flat face, huge round eyes, the nose set high.
    'flat': dict(skull=(0.38, 0.56, 0.48), cheeks=1.2, face=0.85, muzzle=(0.02, 0.2, 0.1), eye=0.222,
                 eye_gap=0.258, eye_slant=0, ear=0.85),
    # Devon / Cornish Rex, Sphynx: big cheekbones, enormous eyes, small chin.
    'pixie': dict(skull=(0.42, 0.52, 0.47), cheeks=1.15, face=0.5, muzzle=(0.08, 0.13, 0.09), eye=0.222,
                  eye_gap=0.235, eye_slant=6, ear=1.1),
    # Maine Coon, Norwegian: longer, a square muzzle.
    'lynx': dict(skull=(0.46, 0.5, 0.47), cheeks=1.05, face=0.5, muzzle=(0.11, 0.2, 0.13), eye=0.174,
                 eye_gap=0.224, eye_slant=4, ear=1.05),
}
EAR_UNIT = 0.42


def head_spec(t):
    """Rings from the back of the skull to the face, (x, z, half-w, half-h): an
    ellipsoid profile (round from every side), widest at the cheeks, with the
    front flattened into a face."""
    L, W, H = t['skull']
    f = t['face']
    out = []
    for tt in (-0.96, -0.85, -0.65, -0.38, -0.1, 0.18, 0.45, 0.68, 0.84, 0.94):
        q = max(0.0, 1 - tt * tt) ** 0.5
        if tt > 0.5:                      # flatten the front into a face
            q = max(q, (0.5 + 0.3 * f) * (1 - (tt - 0.5) * 0.6))
        cheek = 1 + (t['cheeks'] - 1) * max(0.0, 1 - abs(tt - 0.25) * 2.2)
        out.append((tt * L * 1.05, -0.04 * max(0.0, tt), W * q * cheek, H * q * (1 - 0.06 * max(0.0, tt))))
    return out


def disc(B, center, normal, radius, depth, tag, segs=8):
    """A flat faceted lens on the face (iris, pupil, highlight)."""
    res = bmesh.ops.create_uvsphere(B.bm, u_segments=segs, v_segments=4, radius=radius)
    vs = res['verts']
    bmesh.ops.scale(B.bm, vec=(depth / radius, 1, 1), verts=vs)
    rot = Vector((1, 0, 0)).rotation_difference(normal)
    bmesh.ops.transform(B.bm, matrix=Matrix.Translation(center) @ rot.to_matrix().to_4x4(), verts=vs)
    B.tag_new(vs, tag)
    return vs


def build(name, t):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    spec = head_spec(t)
    rings = []
    for i, (x, z, w, h) in enumerate(spec):
        rings.append(ring_points(Vector((x, 0, z)), Vector((1, 0, 0)), w, h, SIDES, exp=2.05))
    B = Builder()
    B.tube(rings)
    front_x = spec[-1][0]
    L, W, H = t['skull']

    # Muzzle pad and chin: a small rounded block low on the face.
    mx, mw, mh = t['muzzle']
    res = bmesh.ops.create_uvsphere(B.bm, u_segments=8, v_segments=5, radius=1.0)
    bmesh.ops.scale(B.bm, vec=(0.12 + mx, mw, mh), verts=res['verts'])
    bmesh.ops.translate(B.bm, vec=Vector((front_x - 0.06 + mx * 0.6, 0, -0.2)), verts=res['verts'])

    # Eyes: iris (eye colour), pupil (ink), highlight (shine), facing forward and a little out.
    # Eyes are treated like the dogs': one small dark faceted sphere each,
    # set into the face (placed on the real head surface by a ray cast).
    # They are their own object ('eyes', origin at the eye centre) so the rig's
    # lids bone can squash them shut: sleeping, blinking.
    e = t['eye'] * 0.5
    bvh = BVHTree.FromBMesh(B.bm)
    E = Builder()
    eye_at = []
    for side in (1, -1):
        target = Vector((0, side * t['eye_gap'] * 0.95, 0.06))
        hit, hn, _i, _d = bvh.ray_cast(target + Vector((2, 0, 0)), Vector((-1, 0, 0)))
        if hit is None:
            hit, hn = Vector((front_x, target.y, target.z)), Vector((1, 0, 0))
        res = bmesh.ops.create_uvsphere(E.bm, u_segments=6, v_segments=4, radius=e)
        eye_at.append(hit - hn.normalized() * e * 0.35)
        bmesh.ops.translate(E.bm, vec=eye_at[-1], verts=res['verts'])
        E.tag_new(res['verts'], 'eye')
    eye_c = (eye_at[0] + eye_at[1]) / 2

    # Nose: a small pink triangle on the top front of the muzzle.
    muzzle_front = front_x + 0.06 + 1.6 * mx
    nz = -0.2 + mh * 0.75
    nx = muzzle_front - 0.005
    k = 1.5
    nose = [B.bm.verts.new(v) for v in ((nx, 0.055 * k, nz + 0.025 * k), (nx, -0.055 * k, nz + 0.025 * k),
                                         (nx + 0.012, 0, nz - 0.03 * k), (nx - 0.04, 0.05 * k, nz + 0.03 * k),
                                         (nx - 0.04, -0.05 * k, nz + 0.03 * k), (nx - 0.035, 0, nz - 0.035 * k))]
    B.faces([(nose[0], nose[2], nose[1]), (nose[3], nose[4], nose[5]), (nose[0], nose[1], nose[4], nose[3]),
             (nose[1], nose[2], nose[5], nose[4]), (nose[2], nose[0], nose[3], nose[5])], 'nose')

    # Mouth: a little "w" of two ink strokes under the nose.
    for side in (1, -1):
        a = Vector((nx - 0.01, 0, nz - 0.035))
        b = Vector((nx - 0.025, side * 0.045, nz - 0.075))
        c2 = Vector((nx - 0.045, side * 0.085, nz - 0.055))
        for p0, p1 in ((a, b), (b, c2)):
            d = (p1 - p0)
            res = bmesh.ops.create_cube(B.bm, size=1.0)
            bmesh.ops.scale(B.bm, vec=(0.02, d.length + 0.012, 0.018), verts=res['verts'])
            rot = Vector((0, 1, 0)).rotation_difference(d.normalized())
            bmesh.ops.transform(B.bm, matrix=Matrix.Translation((p0 + p1) / 2) @ rot.to_matrix().to_4x4(),
                                verts=res['verts'])
            B.tag_new(res['verts'], 'ink')

    # Attach point: the neck enters under the back of the skull.
    attach = Vector((-L * 0.35, 0, -H * 0.8))
    for v in B.bm.verts:
        v.co -= attach
    obj = B.to_object('head')
    even_uvs(obj, 2 * UV_TILE)

    xs = [v.co.x for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)

    def face_uv(co):
        return (0.76 + 0.24 * (co.x - x0) / (x1 - x0), 0.45 + 0.55 * (co.z - z0) / (z1 - z0))

    def add_face_uv(o):
        m = o.data
        proj = m.uv_layers.new(name='Projection')
        for loop in m.loops:
            proj.data[loop.index].uv = face_uv(m.vertices[loop.vertex_index].co)
        m.uv_layers.active = m.uv_layers['UVMap']

    add_face_uv(obj)
    mat = bpy.data.materials.new('cat')
    obj.data.materials.append(mat)
    for v in E.bm.verts:
        v.co -= eye_c
    eyes = E.to_object('eyes')
    eyes.location = eye_c - attach
    even_uvs(eyes, 2 * UV_TILE)
    eyes.data.materials.append(mat)

    # Ears high on the skull, set wide, their base sunk into the skull surface
    # (found by casting down onto the finished head) so they grow out of it.
    head_bvh = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
    for side, nm in ((1, 'socket_ear_L'), (-1, 'socket_ear_R')):
        s = bpy.data.objects.new(nm, None)
        p = Vector((-L * 0.05, side * W * 0.5, 0)) - attach
        hit, _n, _i, _d = head_bvh.ray_cast(Vector((p.x, p.y, 5.0)), Vector((0, 0, -1)))
        p.z = (hit.z if hit else H * 0.82 - attach.z) - 0.05 * t['ear']
        s.location = p
        s.scale = (EAR_UNIT * t['ear'],) * 3
        # Ears take their colour from a fixed spot of the region masks (the "ear" sample).
        s['uv2'] = [0.80, 1 - 0.99]
        bpy.context.scene.collection.objects.link(s)
    s = bpy.data.objects.new('socket_mouth', None)
    s.location = Vector((front_x + mx, 0, -0.3)) - attach
    bpy.context.scene.collection.objects.link(s)

    # Cheek ruffs for the long coats: fluffed copies of the back and cheek rings.
    def fluff(ring, center, f, phase, spike):
        return [center + (p - center) * f * (1 + spike if (k + phase) % 2 == 0 else 1 - spike * 0.45)
                for k, p in enumerate(ring)]
    centers = [Vector((x, 0, z)) for x, z, _, _ in spec]
    for coat, prof in (('semilong', [1.15, 1.2, 1.18, 1.12]), ('long', [1.3, 1.38, 1.35, 1.25])):
        S = Builder()
        S.tube([fluff(rings[i], centers[i], f, i, 0.16) for i, f in enumerate(prof)], cap_start=True, cap_end=False)
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
