"""Rigged limbs for the pot monsters: one smooth mesh per limb (arm + hand, leg + foot) with a 3-bone chain, so there is
no seam at the wrist/ankle and the limbs can bend (walk, swing, wave).

Built like a quick sculpt: simple solids along the limb -> voxel remesh into one surface -> smoothed -> decimated -> rigged
with automatic weights -> GLB. Proportions are measured from concepts/v2/02-monstera.png against the Classic Pot
(bottom width 0.72): leg width ~0.25, visible leg ~0.3 of pot height, arm ~0.85 of the leg, fists ~1.25x the leg width,
feet wider than the leg with five nub toes. Rest pose: arm hanging with a soft elbow bend, leg straight with a slight knee.

Run: Blender -b -t 1 -P scripts/limbs_blender.py -- <out_dir> [--variants]
  default: builds arm.glb + leg.glb from ARM / LEG below
  --variants: builds every entry of ARM_VARIANTS / LEG_VARIANTS into <out_dir>/variants/ plus variants.json (lineup)
glTF axes: +Y up, +Z forward. Both are RIGHT-side limbs (+X = outward); the game mirrors them for the left.
  arm.glb: shoulder at the origin; bones upper -> fore -> hand
  leg.glb: hip at the origin; bones thigh -> shin -> foot
"""
import sys
import os
import bpy
import math
import mathutils

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['.']
out_dir = args[0]
VARIANTS = '--variants' in args
os.makedirs(out_dir, exist_ok=True)
V = mathutils.Vector


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for a in list(bpy.data.armatures):
        bpy.data.armatures.remove(a)


def g2b(v):
    """glTF (Y up, Z forward) -> Blender (Z up, -Y forward)."""
    x, y, z = v
    return V((x, -z, y))


def ball(c, r, sy=1.0, sz=1.0, sx=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1, location=g2b(c))
    o = bpy.context.active_object
    o.scale = (r * sx, r * sz, r * sy)
    return o


def ell(c, radii, axis=(0, 1, 0)):
    """Ellipsoid with radii (across, along `axis`, depth)."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1)
    o = bpy.context.active_object
    o.scale = (radii[0], radii[2], radii[1])
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = V((0, 0, 1)).rotation_difference(g2b(axis).normalized())
    o.location = g2b(c)
    return o


def tube(a, b, ra, rb):
    """Tapered cylinder from a to b (glTF coords) plus round joints."""
    a, b = V(a), V(b)
    d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=ra, radius2=rb, depth=d.length)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = V((0, 0, 1)).rotation_difference(g2b(d).normalized())
    o.location = g2b((a + b) / 2)
    return [o, ball(tuple(a), ra), ball(tuple(b), rb)]


def flatten_below(o, y_gltf):
    """Cut the mesh flat at glTF height y (removes everything below, fills the hole): a flat sole."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    z = y_gltf  # glTF y -> Blender z
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, z), plane_no=(0, 0, 1), clear_inner=True)
    edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.holes_fill(bm, edges=edges)
    bm.to_mesh(o.data)
    bm.free()


def clean_tube(o, hi, path, joints, sides=12, step=0.04, fine=0.016):
    """Hybrid limb: replace everything above the end of `path` with a clean tube of evenly spaced rings (denser at the
    `joints`, so they fold cleanly), snapped onto the sculpt's surface, and stitch it to the sculpted part below (the
    hand or foot keeps its shape). `path`: glTF points from the top of the limb to the cut; `joints`: glTF points."""
    import bmesh
    pts = [g2b(p) for p in path]
    jts = [g2b(p) for p in joints]
    # sample the path: rings every `step`, every `fine` near a joint
    curve = []
    for a, b in zip(pts, pts[1:]):
        L = (b - a).length
        t = 0.0
        while t < L - 1e-6:
            curve.append(a.lerp(b, t / L))
            near = min((((a.lerp(b, t / L)) - jp).length for jp in jts), default=9)
            t += fine if near < 0.06 else step
    curve.append(pts[-1])
    cut_c = pts[-1]
    cut_n = (pts[-1] - pts[-2]).normalized()
    # 1. cut the sculpt at the end of the path, keep the hand / foot side
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=cut_c, plane_no=cut_n, clear_inner=True)
    # the cut edge has many uneven vertices; merge its shortest edges until it has exactly as many as the tube's rings,
    # so the stitch pairs vertex to vertex and bridges as clean quads (no fans)
    while True:
        bnd = [e for e in bm.edges if e.is_boundary]
        if len(bnd) <= sides:
            break
        e = min(bnd, key=lambda e: e.calc_length())
        a, b = e.verts
        bmesh.ops.pointmerge(bm, verts=[a, b], merge_co=(a.co + b.co) / 2)
        bmesh.ops.dissolve_degenerate(bm, dist=1e-6, edges=bm.edges[:])
    bm.to_mesh(o.data)
    bm.free()
    # 2. build the tube: one ring per sample, perpendicular to the path, closed with a cap at the top (hidden in the pot)
    bm = bmesh.new()
    rings = []
    ref = mathutils.Vector((1, 0, 0))
    for k, c in enumerate(curve):
        tan = (curve[min(k + 1, len(curve) - 1)] - curve[max(k - 1, 0)]).normalized()
        u = (ref - tan * ref.dot(tan)).normalized()
        w = tan.cross(u)
        rings.append([bm.verts.new(c + (u * math.cos(2 * math.pi * i / sides) + w * math.sin(2 * math.pi * i / sides)) * 0.08) for i in range(sides)])
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(sides):
            bm.faces.new((r0[i], r0[(i + 1) % sides], r1[(i + 1) % sides], r1[i]))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('tube')
    bm.to_mesh(me)
    bm.free()
    tube = bpy.data.objects.new('tube', me)
    bpy.context.collection.objects.link(tube)
    # 3. snap the rings onto the sculpt's surface (shape of the sculpt, topology of the tube)
    sw = tube.modifiers.new('sw', 'SHRINKWRAP')
    sw.target = hi
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    bpy.context.view_layer.objects.active = tube
    bpy.ops.object.modifier_apply(modifier='sw')
    # 4. join and stitch the tube's last ring to the sculpt's cut edge
    bpy.ops.object.select_all(action='DESELECT')
    tube.select_set(True)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.join()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='EDGE')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=False, use_boundary=True, use_multi_face=False, use_non_contiguous=False, use_verts=False)
    bpy.ops.mesh.bridge_edge_loops(number_cuts=2, interpolation='SURFACE', smoothness=1.0)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


INSTANT_MESHES = os.path.expanduser('~/tools/instant-meshes/build/Instant Meshes.app/Contents/MacOS/Instant Meshes')


def retopo(hi, faces):
    """Clean quad topology for the smooth sculpt `hi` via Instant Meshes (field-aligned remeshing: even quads whose
    edge loops follow the form round the limbs, fingers and toes). Returns the new object."""
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, 'hi.obj')
    dst = os.path.join(tmp, 'quads.obj')
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    bpy.context.view_layer.objects.active = hi
    bpy.ops.wm.obj_export(filepath=src, export_selected_objects=True, export_materials=False, export_uv=False, export_normals=False)
    # -r 4 -p 4: quad orientation and position fields -> pure quads; -d deterministic; -S smoothing/reprojection steps
    subprocess.run([INSTANT_MESHES, '-o', dst, '-f', str(faces), '-r', '4', '-p', '4', '-d', '-S', '3', '-t', '1', src], check=True, capture_output=True)
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=dst)
    q = [o for o in bpy.data.objects if o not in before][0]
    return q


def fuse(name, parts, voxel=0.004, smooth=18, tris=1500, detail=None, flat=None, tube=None, quads=None):
    """Join + voxel remesh + smooth + decimate. `detail(p)` -> 0..1 marks regions (hands, toes) that keep more triangles."""
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    # bake the whole transform in: mesh coordinates = world (glTF-converted) coordinates, which the joint tube relies on
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    rm = o.modifiers.new('rm', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier='rm')
    if flat is not None:
        # cut a flat sole, then remesh again so the cut joins the surface cleanly before smoothing rounds its rim
        flatten_below(o, flat)
        rm = o.modifiers.new('rm', 'REMESH')
        rm.mode = 'VOXEL'
        rm.voxel_size = voxel
        bpy.ops.object.modifier_apply(modifier='rm')
    # melt the creases where the solids meet and iron out voxel ripples, like a sculpt smoothed over
    sm = o.modifiers.new('sm', 'SMOOTH')
    sm.factor = 1.0
    sm.iterations = smooth
    bpy.ops.object.modifier_apply(modifier='sm')
    # keep the smooth high-detail version to borrow its shading from
    hi = o.copy()
    hi.data = o.data.copy()
    bpy.context.collection.objects.link(hi)
    if quads:
        # proper retopology instead of reduction: the sculpt becomes clean quads with real edge loops everywhere
        q = retopo(hi, quads)
        bpy.data.objects.remove(o, do_unlink=True)
        o = q
        o.name = name
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.shade_smooth()
        dt = o.modifiers.new('dt', 'DATA_TRANSFER')
        dt.object = hi
        dt.use_loop_data = True
        dt.data_types_loops = {'CUSTOM_NORMAL'}
        dt.loop_mapping = 'POLYINTERP_NEAREST'
        bpy.ops.object.modifier_apply(modifier='dt')
        bpy.data.objects.remove(hi, do_unlink=True)
        o.data.calc_loop_triangles()
        print(name, 'quads', len(o.data.polygons), 'tris', len(o.data.loop_triangles))
        return o
    # reduce to the budget (edge collapse keeps the thumb and finger shapes), then a light relax
    dec = o.modifiers.new('dec', 'DECIMATE')
    dec.ratio = min(1.0, tris / max(1, 2 * len(o.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='dec')
    sm2 = o.modifiers.new('sm2', 'SMOOTH')
    sm2.factor = 0.5
    sm2.iterations = 4
    bpy.ops.object.modifier_apply(modifier='sm2')
    if tube:
        clean_tube(o, hi, **tube)
    bpy.ops.object.shade_smooth()
    # bake the high-detail surface's normals onto the light mesh: it shades like the smooth sculpt, no facets or jaggies
    dt = o.modifiers.new('dt', 'DATA_TRANSFER')
    dt.object = hi
    dt.use_loop_data = True
    dt.data_types_loops = {'CUSTOM_NORMAL'}
    dt.loop_mapping = 'POLYINTERP_NEAREST'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='dt')
    bpy.data.objects.remove(hi, do_unlink=True)
    o.data.calc_loop_triangles()
    print(name, 'tris', len(o.data.loop_triangles))
    return o


def rig(mesh, chain, names):
    """Armature with a bone per segment of `chain` (glTF points), automatic weights."""
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


# --- arm -----------------------------------------------------------------------------------------------------------
ARM = dict(
    smooth=18,          # smoothing strength: higher = softer, more tubular flow between parts
    hand=1.0,           # hand size
    wrist=0.084,        # radius of the bridge from forearm into the hand (bigger = no wrist dip at all)
    curl=1.0,           # how far the fingertips curl in toward the palm (0 = straight, 1.5 = loose fist)
    spread=0.046,       # finger spacing (smaller = more fused into one soft group)
    finger=1.0,         # finger thickness
    thumb=1.0,          # thumb size
    style='rolls',      # 'rolls': fingers hang off the palm | 'flow': back of the hand runs smoothly into the fingers
    finger_len=1.0,     # finger length
    grade=(1.0, 1.0),   # curl multiplier for the pointer finger and the pinky (e.g. (0.3, 1.8): pointer straight, pinky curled)
)


def build_arm(v, path):
    clear()
    SH = (0.0, 0.0, 0.0)
    EL = (0.035, -0.19, 0.0)
    WR = (0.045, -0.36, 0.025)
    TIP = (0.04, -0.52, 0.035)
    h = v['hand']
    parts = [ball(SH, 0.11)]
    parts += tube(SH, EL, 0.1, 0.095)
    parts += tube(EL, WR, 0.095, 0.09)
    # hand: the forearm flows straight into it (a tapered bridge fills the wrist); relaxed fingers packed side by side
    # (no gaps) bending at the knuckle and curling in toward the palm; a separate thumb resting forward
    hx, hy, hz = WR[0] + 0.005, WR[1] - 0.095 * h, WR[2]
    parts += tube(WR, (hx - 0.004, hy + 0.01, hz), 0.09, v['wrist'])
    parts.append(ell((hx, hy, hz), (0.078 * h, 0.088 * h, 0.1 * h), axis=(-0.1, -1, 0)))  # palm / back of the hand
    c = v['curl']
    f = v['finger'] * h
    L = v['finger_len']
    if v['style'] == 'flow':
        # back of the hand as thick as the fingers' backs, and a wide knuckle mass bridging into them, so the hand
        # runs smoothly into the fingers; the fingers only separate toward the tips and on the palm side
        parts.append(ell((hx + 0.006, hy - 0.06 * h, hz), (0.062 * h, 0.05 * h, 0.098 * h), axis=(-0.15, -1, 0)))  # knuckles
        for k in range(4):
            # k = 0 pinky (back) .. 3 pointer (front, next to the thumb): curl grows toward the pinky, which is also a
            # little shorter, so the knuckles and fingertips make an angled line instead of hanging straight
            g = v['grade'][1] + (v['grade'][0] - v['grade'][1]) * (k / 3)
            ck = c * g
            Lk = L * (0.86 + 0.05 * k)
            z = hz + (k - 1.5) * v['spread'] * h
            parts.append(ell((hx + 0.004, hy - 0.095 * h * Lk, z), (0.048 * f, 0.06 * f * Lk, 0.03 * f), axis=(-0.25 * ck, -1, 0)))
            tip = (hx - (0.004 + 0.03 * ck) * h, hy - (0.15 * Lk - 0.02 * ck) * h + abs(k - 1.5) * 0.007, z)
            parts.append(ell(tip, (0.04 * f, 0.045 * f, 0.028 * f), axis=(-1.2 * ck, -1, 0)))
    else:
        for k in range(4):
            z = hz + (k - 1.5) * v['spread'] * h
            dz = (k - 1.5) * 0.004
            parts.append(ell((hx - 0.008 * h, hy - 0.08 * h, z + dz), (0.036 * f, 0.05 * f, 0.029 * f), axis=(-0.3 * c, -1, 0)))
            tip = (hx - (0.012 + 0.033 * c) * h, hy - (0.13 - 0.015 * c) * h + abs(k - 1.5) * 0.008, z + dz * 1.5)
            parts.append(ell(tip, (0.032 * f, 0.045 * f, 0.027 * f), axis=(-c, -1.0 + 0.55 * min(c, 1.0), 0)))
    t = v['thumb'] * h
    parts.append(ell((hx - 0.03 * h, hy, hz + 0.1 * h), (0.04 * t, 0.068 * t, 0.04 * t), axis=(-0.35, -0.75, 0.55)))
    # clean tube with ring loops from the shoulder through the elbow and wrist; the sculpted hand below the wrist
    ring_tube = dict(path=[(0.0, 0.05, 0.0), SH, EL, WR, (0.047, -0.39, 0.027)], joints=[EL, WR])
    arm = fuse('arm', parts, smooth=v['smooth'], tris=v.get('tris', 2200), tube=None if v.get('quads') else ring_tube, quads=v.get('quads'))
    arm_rig = rig(arm, [SH, EL, WR, TIP], ['upper', 'fore', 'hand'])
    export([arm, arm_rig], path)


# --- leg -----------------------------------------------------------------------------------------------------------
LEG = dict(
    smooth=18,          # smoothing strength
    knee=-0.165,        # knee height below the hip (the ankle is at -0.31): more negative = lower knee
    knee_fwd=0.035,     # how far the knee sits forward (the leg's soft bend)
    cap=1.0,            # knee cap bump size (0 = none)
    thigh=0.118,        # radii: hip, knee, ankle
    kneeR=0.112,
    ankleR=0.122,
    bridge=0.0,         # 0..1: fills the ankle-to-foot crease with a sloped mass (smooth, tubular run into the foot)
    foot=(0.13, 0.065, 0.19),  # foot half-width, half-height, half-length
    toes='soft',        # 'none' | 'soft' (bumps fused into the front) | 'defined'
    toe_sink=0.0,       # pushes the toes back into the foot (more = subtler)
    flat=False,         # flat sole: the foot is cut flat underneath
)


def build_leg(v, path):
    clear()
    HIP = (0.0, 0.0, 0.0)
    KN = (0.0, v['knee'], v['knee_fwd'])
    AN = (0.0, -0.31, 0.0)
    TOE = (0.0, -0.36, 0.2)
    parts = []
    parts += tube(HIP, KN, v['thigh'], v['kneeR'])
    parts += tube(KN, AN, v['kneeR'], v['ankleR'])
    if v['cap'] > 0:
        cs = v['cap']
        parts.append(ell((0.0, KN[1] + 0.005, KN[2] + 0.045), (0.085 * cs, 0.07 * cs, 0.06 * cs)))
    fw, fh, fl = v['foot']
    parts.append(ell((0.0, AN[1] - 0.05, 0.05), (fw, fh, fl)))
    if v['bridge'] > 0:
        b = v['bridge']
        # a sloped wedge from the shin down over the top of the foot: the leg flows into the foot like a boot
        parts.append(ell((0.0, AN[1] - 0.02, 0.06), (fw * 0.85, 0.06 + 0.03 * b, fl * 0.75), axis=(0, 1, -0.35 * b)))
    if v['toes'] != 'none':
        sink = v['toe_sink']
        toes = [(-0.086, 0.047), (-0.038, 0.041), (0.006, 0.038), (0.046, 0.035), (0.082, 0.031)]
        if v['toes'] == 'soft':
            toes = [(x, r * 1.1) for x, r in toes]  # fatter and overlapping: they fuse into one soft front
        for x, r in toes:
            zf = 0.215 - abs(x + 0.012) * 0.6 - sink
            parts.append(ball((x * fw / 0.13, AN[1] - 0.115 + r, zf * fl / 0.19), r, sy=0.95, sz=1.1))
    # clean tube with ring loops from the hip through the knee; the sculpted (squashy) foot and ankle below
    ring_tube = dict(path=[(0.0, 0.07, 0.0), HIP, KN, (0.0, -0.25, 0.02)], joints=[KN])
    leg = fuse('leg', parts, smooth=v['smooth'], tris=v.get('tris', 2200), flat=(AN[1] - 0.105) if v['flat'] else None, tube=None if v.get('quads') else ring_tube, quads=v.get('quads'))
    leg_rig = rig(leg, [HIP, KN, AN, TOE], ['thigh', 'shin', 'foot'])
    export([leg, leg_rig], path)


# Lineup for art review: each changes a few things from the defaults (descriptions go to variants.json).
H2 = dict(style='flow', smooth=28, curl=0.55, spread=0.04)
ARM_VARIANTS = [
    ('H2', 'round 2 pick: flow, fingers fused tighter', H2),
    ('G1', 'H2, gentle curl gradient', {**H2, 'grade': (0.5, 1.5)}),
    ('G2', 'H2, curl gradient', {**H2, 'grade': (0.3, 2.0)}),
    ('G3', 'H2, strong curl gradient', {**H2, 'grade': (0.15, 2.6)}),
]
L12 = dict(knee=-0.21, smooth=38, thigh=0.135, kneeR=0.112, ankleR=0.118, cap=0.0, foot=(0.12, 0.068, 0.16), bridge=0.4, toes='soft', toe_sink=0.01)
LEG_VARIANTS = [
    ('L12', 'pick: chubby baby leg, slight toes', L12),
]

if VARIANTS:
    import json
    vd = os.path.join(out_dir, 'variants')
    os.makedirs(vd, exist_ok=True)
    manifest = {'arms': [], 'legs': []}
    for vid, desc, over in ARM_VARIANTS:
        build_arm({**ARM, **over}, os.path.join(vd, f'arm_{vid}.glb'))
        manifest['arms'].append({'id': vid, 'desc': desc})
    for vid, desc, over in LEG_VARIANTS:
        build_leg({**LEG, **over}, os.path.join(vd, f'leg_{vid}.glb'))
        manifest['legs'].append({'id': vid, 'desc': desc})
    with open(os.path.join(vd, 'variants.json'), 'w') as fh:
        json.dump(manifest, fh, indent=1)
else:
    # the game's limbs: current art picks (G2 hand, L12 leg)
    # light game meshes: the shading is baked from the smooth high-detail sculpt, so few triangles still look smooth
    # retopologized by Instant Meshes: clean quads everywhere (QUADS env var overrides the face budget for tests)
    # Instant Meshes targets (pure-quad output is ~4x this). Art picks: arms 160 (~1350 tris, keeps the hand detail),
    # legs 75 (~640 tris: the foot holds up fine). QUADS overrides both for tests.
    q = os.environ.get('QUADS')
    build_arm({**ARM, **H2, 'grade': (0.3, 2.0), 'quads': int(q or 160)}, os.path.join(out_dir, 'arm.glb'))
    build_leg({**LEG, **L12, 'quads': int(q or 75)}, os.path.join(out_dir, 'leg.glb'))
