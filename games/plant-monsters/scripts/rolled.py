# Unopened (rolled) monstera leaf in Tiny Treats style: kit stalk + a tightly rolled, tapering scroll at its tip.
# args: -- <kit_leaf.gltf> <out.glb> <name> [turns] [length_frac]
import bpy, bmesh, sys, math
import numpy as np
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; src_f, out_f, name = a[:3]
TURNS = float(a[3]) if len(a) > 3 else 2.4
LFRAC = float(a[4]) if len(a) > 4 else 0.55
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=src_f)
ob = [o for o in set(bpy.data.objects) - before if o.type == 'MESH'][0]
ob.data.transform(ob.matrix_world); ob.parent = None; ob.matrix_world = Matrix.Identity(4)
mat = ob.data.materials[0]; mat.use_backface_culling = False
bm = bmesh.new(); bm.from_mesh(ob.data); uvl = bm.loops.layers.uv.active
# islands -> stem (touches z ~ 0) and blade (everything else)
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
stem = [c for c in isl if min(v.co.z for f in c for v in f.verts) < 0.02 and len(c) < 0.5 * len(bm.faces)]
blade = [f for c in isl if not any(c is s_ for s_ in stem) for f in c]
bus = [l[uvl].uv.copy() for f in blade for l in f.loops]
u0, u1 = min(u.x for u in bus), max(u.x for u in bus); v0, v1 = min(u.y for u in bus), max(u.y for u in bus)
bh = max(v.co.z for f in blade for v in f.verts) - min(v.co.z for f in blade for v in f.verts)
# stem top point and direction
sv = [v for c in stem for f in c for v in f.verts]
top = max(sv, key=lambda v: v.co.z).co.copy()
near = sorted(sv, key=lambda v: (v.co - top).length)
ring = [v.co for v in near[:12]]; lower = [v.co for v in sv if 0.05 < (v.co - top).length < 0.12]
c_top = sum(ring, Vector()) / len(ring); c_low = sum(lower, Vector()) / max(1, len(lower)) if lower else c_top - Vector((0, 0, 0.1))
axis = (c_top - c_low).normalized()
axis = (axis + Vector((0, 0, 1)) * 0.5).normalized()            # mostly continue the stalk, leaning upright
r_stem = sum(((v - c_top) - axis * (v - c_top).dot(axis)).length for v in ring) / len(ring)
# delete the blade, keep the stem
bmesh.ops.delete(bm, geom=blade, context='FACES')
bm.to_mesh(ob.data); bm.free()
# scroll: sheet (s along length, u across width) wrapped in a tightening spiral
L = LFRAC * max(bh, 0.5); NS, NU = 12, 30
r0 = max(r_stem * 3.0, 0.1 * L)
sb = bmesh.new(); uvs_ = sb.loops.layers.uv.new('UVMap')
side = axis.cross(Vector((1, 0, 0)));
if side.length < 0.1: side = axis.cross(Vector((0, 1, 0)))
side = side.normalized(); fwd = axis.cross(side).normalized()
grid = []
for i in range(NS + 1):
    s = i / NS
    taper = (1 - s ** 2.2) ** 0.6 * (0.75 + 0.25 * math.sin(math.pi * min(1, s * 1.6))) + 0.03   # cigar: swells, stays fat, narrows near the tip
    bend = 0.12 * L * s * s                                    # a gentle lean
    row = []
    for j in range(NU + 1):
        u = j / NU
        th = u * TURNS * 2 * math.pi
        r = r0 * taper * (1 - 0.72 * u) + 0.002                # spiral: outer edge -> inner core
        p = c_top + axis * (s * L - 0.03) + side * (math.cos(th) * r) + fwd * (math.sin(th) * r + bend)
        row.append(sb.verts.new(p))
    grid.append(row)
for i in range(NS):
    for j in range(NU):
        f = sb.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
        for l in f.loops:
            ii = next(k for k in range(NS + 1) if l.vert in grid[k]); jj = grid[ii].index(l.vert)
            # gradient like the kit leaf: lighter toward the tip, a little variation across the roll
            l[uvs_].uv = (u0 + (u1 - u0) * (0.35 + 0.3 * jj / NU), v0 + (v1 - v0) * (0.15 + 0.8 * ii / NS))
bmesh.ops.recalc_face_normals(sb, faces=sb.faces[:])
sme = bpy.data.meshes.new('scroll'); sb.to_mesh(sme); sb.free()
so = bpy.data.objects.new('scroll', sme); bpy.context.collection.objects.link(so); sme.materials.append(mat)
for p in sme.polygons: p.use_smooth = True
ob.data.uv_layers.active.name = 'UVMap'
bpy.ops.object.select_all(action='DESELECT'); so.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.join(); ob.name = name
bm2 = bmesh.new(); bm2.from_mesh(ob.data); bmesh.ops.triangulate(bm2, faces=bm2.faces[:]); bm2.to_mesh(ob.data); bm2.free()
for p in ob.data.polygons: p.use_smooth = True
print('TRIS', name, len(ob.data.polygons))
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out_f, use_selection=True, export_apply=True)
