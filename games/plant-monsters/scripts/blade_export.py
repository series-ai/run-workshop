# Export a blade-only version of a leaf model, origin at the stalk attach point.
# Frame (glTF, Y-up): stalk tangent at the tip -> +Y, blade hangs out toward +Z, X across.
# Also writes stalk metadata (kit stalk length/radii/UV strip) next to the .glb as .json.
# args: -- <in.glb|gltf> <out.glb> <name>
import bpy, bmesh, sys, json, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; src, out, name = a[:3]
NO_FIX = len(a) > 3 and a[3] == 'nofix'   # our own rolled leaf already continues its stalk exactly
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=src)
objs = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
for o in objs: o.data.transform(o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4)
if len(objs) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join()
ob = objs[0]
bm = bmesh.new(); bm.from_mesh(ob.data); uvl = bm.loops.layers.uv.active
seen = set(); isl = []
for f in bm.faces:
    if f in seen: continue
    st, cur = [f], []
    while st:
        g = st.pop()
        if g in seen: continue
        seen.add(g); cur.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen: st.append(h)
    isl.append(cur)
stem_isl = [c for c in isl if min(v.co.z for f in c for v in f.verts) < 0.02 and len(c) < 0.5 * len(bm.faces)]
stem = [f for c in stem_isl for f in c]; sset = set(stem)
blade = [f for f in bm.faces if f not in sset]
sv = list(set(v for f in stem for v in f.verts)); bv = list(set(v for f in blade for v in f.verts))
base = min(sv, key=lambda v: v.co.z).co.copy()
tipv = max(sv, key=lambda v: (v.co - base).length).co.copy()
ring = [v.co for v in sorted(sv, key=lambda v: (v.co - tipv).length)[:8]]; c_tip = sum(ring, Vector()) / len(ring)
behind = [v.co for v in sv if 0.06 < (v.co - c_tip).length < 0.13 and (v.co - base).length < (c_tip - base).length]
c_back = sum(behind, Vector()) / len(behind) if behind else base
tang = (c_tip - c_back).normalized()
bring = [v.co for v in sorted(sv, key=lambda v: v.co.z)[:8]]; c_base = sum(bring, Vector()) / len(bring)
def radius(center, pts, ax): return max(((p - center) - ax * (p - center).dot(ax)).length for p in pts)
r_tip = radius(c_tip, ring, tang); r_base = radius(c_base, bring, Vector((0, 0, 1)))
# stalk length along its verts (approx: base -> tip polyline through sorted slices)
stalk_len = (c_tip - c_base).length * 1.12
# UV strip of the stalk (Blender space; converted to glTF space v' = 1 - v)
s_uv_base = [l[uvl].uv.copy() for f in stem for l in f.loops if (l.vert.co - c_base).length < 0.05]
s_uv_tip = [l[uvl].uv.copy() for f in stem for l in f.loops if (l.vert.co - c_tip).length < 0.05]
avg = lambda L: (sum(u.x for u in L) / len(L), sum(u.y for u in L) / len(L))
ub, ut = avg(s_uv_base), avg(s_uv_tip)
# frame: tangent -> Blender +Z (glTF +Y); blade centroid direction (perp. to tangent) -> Blender -Y (glTF +Z)
# Frame tied to the stalk's own bend so the procedural stalk can reproduce it exactly:
#   +Y (glTF) = stalk tangent at the tip
#   +Z (glTF) = 'out' = component of (tip - base) perpendicular to the tangent (the outside of the arch)
out_ = (c_tip - c_base); out_ = (out_ - tang * out_.dot(tang)).normalized()
z = tang; y = -out_; x = y.cross(z).normalized(); y = z.cross(x).normalized()
# kit stalk shape, for reference: lean (angle from vertical at the base) and total turn to the tip
lo = [v.co for v in sorted(sv, key=lambda v: v.co.z)[:40]]
c_lo2 = sum(lo, Vector()) / len(lo)
base_dir = (c_lo2 - c_base); base_dir = base_dir.normalized() if base_dir.length > 1e-6 else Vector((0, 0, 1))
kit_lean = math.acos(max(-1, min(1, base_dir.z))); kit_turn = math.acos(max(-1, min(1, base_dir.dot(tang))))
R = Matrix((x, y, z))                       # rows = new axes -> world-to-local rotation
M = R.to_4x4() @ Matrix.Translation(-c_tip)
bmesh.ops.delete(bm, geom=stem, context='FACES')
bm.transform((Matrix.Identity(4) if NO_FIX else Matrix.Rotation(math.radians(90), 4, 'X')) @ M)   # measured kit tangent is 90deg off; verified against the kit leaf in the debug view
bm.to_mesh(ob.data); bm.free()
for p in ob.data.polygons: p.use_smooth = True
for m in ob.data.materials: m.use_backface_culling = False
ob.name = name
tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True)
vs = [v.co for v in ob.data.vertices]
meta = {'name': name, 'triangles': tris, 'kit_lean': round(kit_lean, 3), 'kit_turn': round(kit_turn, 3),
        'blade_bounds_gltf': {'min': [min(v.x for v in vs), min(v.z for v in vs), -max(v.y for v in vs)],
                              'max': [max(v.x for v in vs), max(v.z for v in vs), -min(v.y for v in vs)]},
        'kit_stalk': {'length': round(stalk_len, 4), 'base_radius': round(r_base, 4), 'tip_radius': round(r_tip, 4),
                      'uv_gltf': {'u': round((ub[0] + ut[0]) / 2, 5), 'v_base': round(1 - ub[1], 5), 'v_tip': round(1 - ut[1], 5)}}}
json.dump(meta, open(out[:-4] + '.json', 'w'), indent=1)
print('BLADE', name, tris, json.dumps(meta['kit_stalk']))
