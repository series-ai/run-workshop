"""Build the swappable cat ears (tails are built into the body, see build_cat.py).

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
from catkit import UV_TILE, Builder, even_uvs, export, ring_points  # noqa: E402

out_dir = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out_dir, exist_ok=True)

# Ear outlines for the LEFT ear, walked from the front of the base, up/out to
# the tip and back down to the rear of the base.
EARS = {
    # Domestic: upright triangle with a softly rounded tip.
    'standard': [(0.62, 0, 0), (0.38, 0.2, 0.62), (0.1, 0.36, 1.02), (-0.04, 0.38, 1.05), (-0.38, 0.24, 0.55),
                 (-0.62, 0, 0)],
    # Rounded tip: a soft, slightly shorter ear (British, Exotic, Ragdoll).
    'round': [(0.58, 0, 0), (0.42, 0.18, 0.5), (0.22, 0.32, 0.82), (0.0, 0.37, 0.92), (-0.2, 0.33, 0.8),
              (-0.4, 0.2, 0.45), (-0.58, 0, 0)],
    # Oriental, Devon Rex, Sphynx: very big, wide-based, flaring out.
    'large': [(0.62, 0, 0), (0.35, 0.25, 0.85), (0.05, 0.52, 1.5), (-0.08, 0.54, 1.52), (-0.4, 0.3, 0.8),
              (-0.62, 0, 0)],
    # Persian, British, Exotic: small and rounded, set wide.
    'small': [(0.38, 0, 0), (0.28, 0.12, 0.38), (0.12, 0.24, 0.62), (-0.04, 0.27, 0.66), (-0.18, 0.2, 0.5),
              (-0.28, 0.12, 0.3), (-0.38, 0, 0)],
    # Scottish Fold: a small flap folded forward and down over the skull.
    'fold': [(0.4, 0, 0), (0.5, 0.12, 0.28), (0.66, 0.2, 0.2), (0.66, 0.24, 0.05), (0.35, 0.24, 0.14),
             (-0.4, 0.1, 0.14)],
    # American Curl: the top third curls back.
    'curl': [(0.45, 0, 0), (0.35, 0.15, 0.7), (0.05, 0.3, 1.1), (-0.32, 0.33, 1.08), (-0.42, 0.26, 0.8),
             (-0.45, 0, 0)],
    # Maine Coon, Norwegian, Siberian: tall with a lynx tuft at the tip.
    'tufted': [(0.55, 0, 0), (0.3, 0.18, 0.8), (0.06, 0.36, 1.3), (0.0, 0.42, 1.68), (-0.05, 0.37, 1.3),
               (-0.32, 0.22, 0.65), (-0.55, 0, 0)],
}
EAR_THICKNESS = 0.07
EAR_THICKNESS_BY_TYPE = {'fold': 0.1}

# Upright ears are turned to face forward (and a little outward) so they read as
# wide triangles from the front; hanging ears stay flat against the cheeks.
EAR_YAW = {'round': -60, 'standard': -60, 'large': -56, 'small': -58, 'fold': -25, 'curl': -58, 'tufted': -60}


def ear(points, mirror, thickness=EAR_THICKNESS, yaw=0):
    """Closed ear with a little thickness. The front is a furry rim round a pink
    inner ear (tagged 'inner'); the back is plain fur."""
    B = Builder()
    outline = [Vector(p) for p in points]
    # Dip the base corners below the socket so the ear's straight bottom edge is
    # buried in the curved skull instead of hovering over it.
    outline[0] = outline[0] + Vector((0, 0, -0.3))
    outline[-1] = outline[-1] + Vector((0, 0, -0.3))
    inward = Vector((0, -thickness, 0))
    cup = sum(outline, Vector()) / len(outline)
    base = (outline[0] + outline[-1]) / 2
    # Inner outline: pulled toward a point a little above the middle of the base, set back into the cup.
    anchor = base.lerp(cup, 0.5)
    inner = [anchor + (p - anchor) * 0.68 + inward * 0.35 for p in outline]
    f = [B.bm.verts.new(p) for p in outline]
    i_ = [B.bm.verts.new(p) for p in inner]
    b = [B.bm.verts.new(p + inward) for p in outline]
    ic = B.bm.verts.new(anchor + (cup - anchor) * 0.68 + inward * 0.5)
    bc = B.bm.verts.new(cup + inward)
    n = len(outline)
    rim, pink, back = [], [], []
    for k in range(n - 1):
        rim.append((f[k], f[k + 1], i_[k + 1], i_[k]))
        pink.append((ic, i_[k], i_[k + 1]))
        back.append((bc, b[k + 1], b[k]))
        back.append((f[k], b[k], b[k + 1], f[k + 1]))
    pink.append((ic, i_[-1], i_[0]))
    rim.append((f[-1], f[0], i_[0], i_[-1]))
    back.append((bc, b[0], b[-1]))
    back.append((f[-1], b[-1], b[0], f[0]))
    B.faces(rim + back)
    B.faces(pink, 'inner')
    # Lean the ear out a little so it follows the side of the head.
    bmesh.ops.rotate(B.bm, matrix=Matrix.Rotation(math.radians(-14), 4, 'X'), verts=B.bm.verts)
    if yaw:
        bmesh.ops.rotate(B.bm, matrix=Matrix.Rotation(math.radians(yaw), 4, 'Z'), verts=B.bm.verts)
    if mirror:
        bmesh.ops.transform(B.bm, matrix=Matrix.Scale(-1, 4, (0, 1, 0)), verts=B.bm.verts)
    bmesh.ops.recalc_face_normals(B.bm, faces=B.bm.faces)
    return B


def save(B, name, ball=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if ball is not None:
        res = bmesh.ops.create_icosphere(B.bm, subdivisions=1, radius=0.14)
        bmesh.ops.translate(B.bm, vec=ball, verts=res['verts'])
    obj = B.to_object(name)
    even_uvs(obj, 2 * UV_TILE)
    obj.data.materials.append(bpy.data.materials.new('cat'))
    export(os.path.join(out_dir, f'{name}.glb'))
    print('PART', name, len(obj.data.polygons), 'tris')


for kind, pts in EARS.items():
    for side, mirror in (('L', False), ('R', True)):
        save(ear(pts, mirror, EAR_THICKNESS_BY_TYPE.get(kind, EAR_THICKNESS), EAR_YAW.get(kind, 0)),
             f'ear-{kind}-{side}')
