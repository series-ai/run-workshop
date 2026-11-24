"""Clean-topology limbs: a skeleton of points with a thickness each -> Blender Skin modifier (a ring of quads at every
point, quads along every edge) -> Subdivision Surface (smooth, evenly spaced loops) -> rig -> GLB.

Unlike the sculpt-and-reduce build (limbs_blender.py), this gives real edge loops all the way down each limb, evenly
spaced, including through the knee, ankle, elbow and wrist, so the joints fold cleanly when the limbs bend.

Run: Blender -b -t 1 -P scripts/limbs_skin.py -- <out_dir> [subsurf_levels]
(The game uses public/assets/body/arm.glb + leg.glb: build into public/assets/body/skin, then copy over.)
Same conventions as limbs_blender.py (glTF +Y up, +Z forward, RIGHT-side limbs):
  arm.glb: shoulder at the origin; bones upper -> fore -> hand
  leg.glb: hip at the origin; bones thigh -> shin -> foot
"""
import sys
import os
import bpy
import mathutils

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['.']
out_dir = args[0]
LEVELS = int(args[1]) if len(args) > 1 else 2
os.makedirs(out_dir, exist_ok=True)
V = mathutils.Vector


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for a in list(bpy.data.armatures):
        bpy.data.armatures.remove(a)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def g2b(v):
    """glTF (Y up, Z forward) -> Blender (Z up, -Y forward)."""
    x, y, z = v
    return V((x, -z, y))


def resample(points, step):
    """Insert points along a polyline of (pos, (rx, ry)) so rings are evenly spaced about `step` apart."""
    out = [points[0]]
    for (a, ra), (b, rb) in zip(points, points[1:]):
        a, b = V(a), V(b)
        n = max(1, round((b - a).length / step))
        for i in range(1, n + 1):
            t = i / n
            out.append((tuple(a.lerp(b, t)), (ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t)))
    return out


def skin_limb(name, chains, step=0.05, levels=LEVELS):
    """Build a skinned tube network. `chains`: list of polylines [(glTF pos, (radius_x, radius_y)), ...]; the first
    point of the first chain is the root; later chains branch off the vertex nearest their first point."""
    verts, radii, edges = [], [], []

    def add(p, r):
        verts.append(g2b(p))
        radii.append(r)
        return len(verts) - 1

    for ci, chain in enumerate(chains):
        pts = resample(chain, step)
        if ci == 0:
            prev = add(*pts[0])
        else:
            start = V(g2b(pts[0][0]))
            prev = min(range(len(verts)), key=lambda i: (verts[i] - start).length)
        for p, r in pts[1:]:
            i = add(p, r)
            edges.append((prev, i))
            prev = i
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], edges, [])
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    sk = o.modifiers.new('skin', 'SKIN')
    sk.use_smooth_shade = True
    sk.branch_smoothing = 1.0
    for i, r in enumerate(radii):
        d = me.skin_vertices[0].data[i]
        d.radius = r
        d.use_root = i == 0
    ss = o.modifiers.new('subsurf', 'SUBSURF')
    ss.levels = levels
    ss.render_levels = levels
    bpy.ops.object.modifier_apply(modifier='skin')
    bpy.ops.object.modifier_apply(modifier='subsurf')
    bpy.ops.object.shade_smooth()
    o.data.calc_loop_triangles()
    print(name, 'tris', len(o.data.loop_triangles), 'verts', len(o.data.vertices))
    return o


def rig(mesh, chain, names):
    arm = bpy.data.armatures.new(mesh.name + '_rig')
    rig_obj = bpy.data.objects.new(mesh.name + '_rig', arm)
    bpy.context.collection.objects.link(rig_obj)
    bpy.context.view_layer.objects.active = rig_obj
    bpy.ops.object.mode_set(mode='EDIT')
    parent = None
    for i, n in enumerate(names):
        b = arm.edit_bones.new(n)
        b.head = g2b(chain[i])
        b.tail = g2b(chain[i + 1])
        if parent:
            b.parent = parent
            b.use_connect = True
        parent = b
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig_obj.select_set(True)
    bpy.context.view_layer.objects.active = rig_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return rig_obj


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format='GLB', export_materials='NONE',
                              export_normals=True, export_texcoords=False, export_skins=True, export_animations=False)


# --- arm: shoulder -> elbow -> wrist -> a soft mitten that curls in at the tips, thumb as a branch ------------------
clear()
SH, EL, WR, TIP = (0.0, 0.0, 0.0), (0.035, -0.19, 0.0), (0.045, -0.36, 0.025), (0.0, -0.58, 0.035)
arm_main = [
    (SH, (0.11, 0.11)),
    (EL, (0.094, 0.094)),
    (WR, (0.086, 0.086)),
    ((0.05, -0.43, 0.03), (0.072, 0.1)),   # palm: flatter, wider front to back
    ((0.047, -0.47, 0.03), (0.062, 0.096)),  # knuckles: the fingers start inside here, so the back flows into them
]
# four fingers packed side by side with no gaps (each overlaps its neighbour), starting inside the knuckles; curl grows
# from the pointer (front, next to the thumb: almost straight) to the pinky (back: curled in toward the palm)
fingers = []
for k in range(4):  # k = 0 pinky .. 3 pointer
    z = 0.03 + (k - 1.5) * 0.044
    c = 1.9 - 1.6 * (k / 3)  # curl
    L = 0.86 + 0.05 * k
    fingers.append([
        ((0.05, -0.43, z), (0.046, 0.032)),
        ((0.047 - 0.006 * c, -0.47 - 0.04 * L, z), (0.044, 0.031)),
        ((0.038 - 0.03 * c, -0.47 - (0.09 - 0.025 * c) * L, z), (0.037, 0.028)),
        ((0.032 - 0.055 * c, -0.47 - (0.115 - 0.05 * c) * L, z), (0.029, 0.024)),
    ])
thumb = [
    ((0.05, -0.425, 0.03), (0.05, 0.05)),
    ((0.035, -0.435, 0.08), (0.047, 0.047)),
    ((0.015, -0.47, 0.115), (0.042, 0.042)),
    ((-0.002, -0.495, 0.128), (0.034, 0.034)),
]
# each piece is its own clean tube (branching inside one Skin makes the hull fold into spikes), joined into one mesh;
# where they overlap reads as the creases at the base of the thumb and between the fingers
arm = skin_limb('arm', [arm_main])
pieces = [skin_limb('thumb', [thumb], step=0.06, levels=2)] + [skin_limb(f'finger{k}', [f], step=0.06, levels=2) for k, f in enumerate(fingers)]
bpy.ops.object.select_all(action='DESELECT')
for p_ in pieces:
    p_.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.join()
arm.data.calc_loop_triangles()
print('arm total tris', len(arm.data.loop_triangles))
arm_rig = rig(arm, [SH, EL, WR, TIP], ['upper', 'fore', 'hand'])
export([arm, arm_rig], os.path.join(out_dir, 'arm.glb'))

# --- leg: chubby leg, soft knee, ankle -> a soft flat foot (heel branch + forefoot) ---------------------------------
clear()
HIP, KN, AN, TOE = (0.0, 0.0, 0.0), (0.0, -0.21, 0.035), (0.0, -0.31, 0.0), (0.0, -0.36, 0.2)
leg_main = [
    (HIP, (0.135, 0.135)),
    (KN, (0.114, 0.114)),
    (AN, (0.118, 0.118)),
    ((0.0, -0.355, 0.06), (0.12, 0.07)),   # top of the foot
    ((0.0, -0.37, 0.15), (0.12, 0.055)),   # ball of the foot / toes
    ((0.0, -0.372, 0.2), (0.095, 0.045)),  # toe tip
]
heel = [
    (AN, (0.118, 0.118)),
    ((0.0, -0.37, -0.03), (0.095, 0.055)),
]
leg = skin_limb('leg', [leg_main, heel])
leg_rig = rig(leg, [HIP, KN, AN, TOE], ['thigh', 'shin', 'foot'])
export([leg, leg_rig], os.path.join(out_dir, 'leg.glb'))
