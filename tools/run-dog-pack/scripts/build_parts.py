"""Build the swappable ear and tail parts.

blender -b -t 1 --factory-startup -P scripts/build_parts.py -- <out_dir>

Parts are authored in socket space and attach to the socket nodes every body
exports (see build_dog.py):
  ears   unit = the build's head half-height. Origin on the top-side of the
         skull, +X toward the nose, +Y outward (left ear), +Z up.
         Each type is exported as ear-<type>-L.glb and a mirrored -R.
  tails  unit = the build's tail length. Origin at the base of the tail,
         -X is straight back, +Z up.
UVs: TEXCOORD_0 has one tile per (2 x UV_TILE) part units; the viewer scales it
by the socket scale so spots stay the same size as on the body.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.append(os.path.dirname(__file__))
from dogkit import UV_TILE, Builder, even_uvs, export, ring_points  # noqa: E402

out_dir = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out_dir, exist_ok=True)

# Ear outlines for the LEFT ear, walked from the front of the base, up/out to
# the tip and back down to the rear of the base.
EARS = {
    # Wide base, splayed out, blunt tip (papercraft corgi/shepherd).
    'prick': [(0.58, 0, 0), (0.3, 0.25, 0.92), (0.08, 0.5, 1.4), (-0.1, 0.52, 1.42), (-0.48, 0.25, 0.75), (-0.58, 0, 0)],
    'bat': [(0.5, 0, 0), (0.26, 0.3, 1.2), (-0.05, 0.7, 2.2), (-0.44, 0.36, 1.1), (-0.5, 0, 0)],
    'tipped': [(0.36, 0, 0), (0.24, 0.12, 0.8), (0.5, 0.38, 1.05), (0.06, 0.32, 1.28), (-0.24, 0.18, 0.8), (-0.36, 0, 0)],
    # Button: a big flap folding forward so the tip points toward the eye.
    'button': [(0.4, 0, 0), (0.55, 0.3, 0.45), (0.85, 0.45, 0.05), (0.75, 0.5, -0.3), (0.3, 0.45, 0.25),
               (-0.4, 0.1, 0.1)],
    'rose': [(0.35, 0, 0), (0.1, 0.35, 0.5), (-0.7, 0.85, 0.35), (-0.6, 0.5, -0.1), (-0.35, 0, 0)],
    'drop': [(0.42, 0, 0), (0.62, 0.55, -0.3), (0.58, 0.92, -1.3), (0.18, 0.98, -1.7), (-0.3, 0.88, -1.25),
             (-0.42, 0.5, -0.25), (-0.42, 0, 0)],
    'long': [(0.38, 0, 0), (0.55, 0.5, -0.4), (0.56, 0.85, -1.6), (0.32, 0.92, -2.2), (0.0, 0.95, -2.35),
             (-0.32, 0.9, -2.1), (-0.42, 0.75, -1.2), (-0.38, 0.45, -0.2), (-0.38, 0, 0)],
    # Papillon: big ears flaring out at 45 degrees with a long wavy fringe down the back edge.
    'butterfly': [(0.35, 0, 0), (0.5, 0.5, 1.0), (0.3, 1.1, 1.8), (0.0, 1.45, 1.6), (-0.05, 1.32, 1.35),
                  (-0.22, 1.6, 1.2), (-0.25, 1.42, 0.95), (-0.42, 1.6, 0.75), (-0.4, 1.28, 0.5),
                  (-0.48, 0.9, 0.3), (-0.35, 0, 0)],
    # Bell: round, thick, puffy lobe (poodles, doodles, water dogs).
    'bell': [(0.35, 0, 0), (0.6, 0.5, -0.4), (0.7, 0.85, -1.2), (0.55, 1.0, -1.9), (0.15, 1.05, -2.2),
             (-0.25, 1.0, -2.0), (-0.45, 0.85, -1.3), (-0.4, 0.5, -0.4), (-0.35, 0, 0)],
    # Feathered: long ear with a wavy fringe at the bottom (spaniels, setters, Cavalier).
    'feathered': [(0.38, 0, 0), (0.55, 0.5, -0.4), (0.6, 0.85, -1.5), (0.7, 0.95, -2.1), (0.45, 0.95, -2.0),
                  (0.4, 1.0, -2.5), (0.15, 0.98, -2.25), (0.0, 1.02, -2.6), (-0.15, 0.98, -2.3),
                  (-0.3, 1.0, -2.5), (-0.4, 0.9, -2.0), (-0.45, 0.7, -1.2), (-0.38, 0.45, -0.2), (-0.38, 0, 0)],
}
EAR_THICKNESS = 0.07
EAR_THICKNESS_BY_TYPE = {'bell': 0.26, 'feathered': 0.12}  # puffier ears are thicker

# Tails, in tail units (1 = the build's tail length). Angles in degrees:
# 180 = straight back, 90 = up, 270 = down. `turns` bends each segment, `radii`
# is the thickness along the tail (base to tip), `lead` pushes the start out of
# the body before the tail bends. Fluffy tails (plume, curl) bulge in the middle.
TAILS = {
    'sabre': dict(start=245, turns=[-12] * 6, length=1.0, radii=[.1, .095, .085, .075, .06, .05, .035]),
    'otter': dict(start=200, turns=[-4] * 6, length=0.9, radii=[.2, .2, .18, .15, .12, .08, .04]),
    'whip': dict(start=252, turns=[-16] * 6, length=1.1, radii=[.06, .055, .05, .04, .032, .025, .016]),
    'carrot': dict(start=118, turns=[0, -25, 0, 0], length=0.6, radii=[.11, .095, .08, .06, .03]),
    'sickle': dict(start=110, turns=[-22] * 6, length=0.9, radii=[.09, .09, .08, .07, .06, .045, .03]),
    'curl': dict(start=100, turns=[-50] * 6, length=0.95, radii=[.11, .17, .21, .22, .2, .15, .07], sides=8),
    'screw': dict(start=150, lead=0.15, turns=[-100] * 5, length=0.5, radii=[.12, .13, .13, .12, .1, .06]),
    'plume': dict(start=172, turns=[-6] * 6, length=1.0, radii=[.07, .14, .2, .22, .2, .15, .06], sides=8),
    'bob': dict(start=160, turns=[0, 0], length=0.15, radii=[.12, .12, .1]),
    'pompom': dict(start=115, turns=[-5] * 4, length=0.6, radii=[.06, .055, .05, .045, .04]),
}


# Upright ears are turned to face forward (and a little outward) so they read as
# wide triangles from the front; hanging ears stay flat against the cheeks.
EAR_YAW = {'prick': -62, 'bat': -58, 'tipped': -62, 'butterfly': -40, 'button': -45}


def ear(points, mirror, thickness=EAR_THICKNESS, yaw=0):
    """Closed ear with a little thickness: front fan + back fan + rim, so normals can be recalculated."""
    B = Builder()
    outline = [Vector(p) for p in points]
    inward = Vector((0, -thickness, 0))
    cup = sum(outline, Vector()) / len(outline)
    back_outline = [p + inward for p in outline]
    back_cup = cup + inward
    f = [B.bm.verts.new(p) for p in outline]
    b = [B.bm.verts.new(p) for p in back_outline]
    fc, bc = B.bm.verts.new(cup), B.bm.verts.new(back_cup)
    n = len(outline)
    faces = []
    for i in range(n - 1):
        faces.append((fc, f[i], f[i + 1]))
        faces.append((bc, b[i + 1], b[i]))
        faces.append((f[i], b[i], b[i + 1], f[i + 1]))
    faces.append((fc, f[-1], f[0]))       # base edge closes the fan
    faces.append((bc, b[0], b[-1]))
    faces.append((f[-1], b[-1], b[0], f[0]))
    B.faces(faces)
    if yaw:
        bmesh.ops.rotate(B.bm, matrix=Matrix.Rotation(math.radians(yaw), 4, 'Z'), verts=B.bm.verts)
    if mirror:
        bmesh.ops.transform(B.bm, matrix=Matrix.Scale(-1, 4, (0, 1, 0)), verts=B.bm.verts)
    bmesh.ops.recalc_face_normals(B.bm, faces=B.bm.faces)
    return B


def tail(start, turns, length, radii, lead=0.0, sides=6):
    B = Builder()
    ang = math.radians(start)
    step = length / len(turns)
    p = Vector((math.cos(ang), 0, math.sin(ang))) * lead
    pts = [Vector((0.03, 0, 0)), p.copy()]   # first ring sits inside the body
    for turn in turns:
        p = p + Vector((math.cos(ang), 0, math.sin(ang))) * step
        pts.append(p.copy())
        ang += math.radians(turn)
    rings = []
    for i, c in enumerate(pts):
        t = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        rad = radii[max(i - 1, 0)]
        rings.append(ring_points(c, t, rad, rad, sides, exp=2.0))
    B.tube(rings)
    return B, pts[-1]


def save(B, name, ball=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ball is not None:
        res = bmesh.ops.create_icosphere(B.bm, subdivisions=1, radius=0.14)
        bmesh.ops.translate(B.bm, vec=ball, verts=res['verts'])
    obj = B.to_object(name)
    even_uvs(obj, 2 * UV_TILE)
    obj.data.materials.append(bpy.data.materials.new('dog'))
    export(os.path.join(out_dir, f'{name}.glb'))
    print('PART', name, len(obj.data.polygons), 'tris')


for kind, pts in EARS.items():
    for side, mirror in (('L', False), ('R', True)):
        save(ear(pts, mirror, EAR_THICKNESS_BY_TYPE.get(kind, EAR_THICKNESS), EAR_YAW.get(kind, 0)),
             f'ear-{kind}-{side}')
for kind, spec in TAILS.items():
    B, tip = tail(**spec)
    save(B, f'tail-{kind}', ball=tip if kind == 'pompom' else None)
