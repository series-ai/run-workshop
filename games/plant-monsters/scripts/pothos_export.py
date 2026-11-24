# Lift single leaves (blade + its short petiole) out of a kit pothos vine.
# Each leaf is exported with its origin where the petiole meets the vine, and a frame measured from the vine:
#   +Y (glTF) = vine tangent at the node, +X = the side the leaf grows out to, +Z = X x Y
# args: -- <kit_vine.gltf> <out_dir> <prefix> <max_leaves>
import bpy, bmesh, sys, os, json, math
import numpy as np
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]; src, outdir, prefix, maxn = a[0], a[1], a[2], int(a[3])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o = [x for x in bpy.data.objects if x.type == 'MESH'][0]; o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
mat = o.data.materials[0]
bm = bmesh.new(); bm.from_mesh(o.data)
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
vine = max(isl, key=len)
VP = np.array([v.co[:] for v in set(v for f in vine for v in f.verts)])
rest = [c for c in isl if c is not vine]
def cen(c): return np.mean([v.co[:] for f in c for v in f.verts], axis=0)
def area(c): return sum(f.calc_area() for f in c)
def mind(c1, c2):
    A_ = np.array([v.co[:] for f in c1 for v in f.verts]); B_ = np.array([v.co[:] for f in c2 for v in f.verts])
    return min(np.linalg.norm(B_ - q, axis=1).min() for q in A_)
# group touching pieces: each group = one leaf (blade sheets + petiole)
par = list(range(len(rest)))
def find(i):
    while par[i] != i: par[i] = par[par[i]]; i = par[i]
    return i
for i in range(len(rest)):
    for j in range(i + 1, len(rest)):
        if np.linalg.norm(cen(rest[i]) - cen(rest[j])) < 0.6 and mind(rest[i], rest[j]) < 0.012: par[find(i)] = find(j)
groups = {}
for i in range(len(rest)): groups.setdefault(find(i), []).extend(rest[i])
leaves = []
for g in groups.values():
    # petiole end = the vertex of the group nearest the vine
    leaves.append((g, g))
print('leaves found', len(leaves))
# sort by size (blade area) to pick a range of sizes
leaves.sort(key=lambda pb: area(pb[1]))
pick = [leaves[int(i * (len(leaves) - 1) / max(1, maxn - 1))] for i in range(min(maxn, len(leaves)))]
meta = []
for k, (p, b) in enumerate(pick):
    pverts = [np.array(v.co[:]) for f in p for v in f.verts]
    b = p
    d = [np.linalg.norm(VP - q, axis=1).min() for q in pverts]
    base = np.mean([q for q, dd in zip(pverts, d) if dd <= min(d) + 0.01], axis=0)
    near = VP[np.argsort(np.linalg.norm(VP - base, axis=1))[:24]]
    c0 = near.mean(0); w_, V_ = np.linalg.eigh(np.cov((near - c0).T)); tang = V_[:, 2]
    if tang[2] < 0: tang = -tang                         # vine tangent pointing 'up/forward' consistently
    sidev = cen(b) - c0; sidev = sidev - tang * sidev.dot(tang); sidev /= np.linalg.norm(sidev)
    # blender axes -> local: x=side, z(blender)=tang (glTF +Y), y(blender) = -(side x tang)... keep right-handed
    X = Vector(sidev.tolist()); Zb = Vector(tang.tolist()); Yb = Zb.cross(X).normalized()
    R = Matrix((X, Yb, Zb)).to_4x4() @ Matrix.Translation(-Vector(c0.tolist()))
    nb = bmesh.new(); vm = {}
    for f in p:
        vs = []
        for v in f.verts:
            if v not in vm: vm[v] = nb.verts.new(v.co)
            vs.append(vm[v])
        try:
            nf = nb.faces.new(vs)
        except ValueError: continue
    uvs = nb.loops.layers.uv.new('UVMap'); ouv = bm.loops.layers.uv.active
    for nf, f in zip(nb.faces, [f for f in p]):
        for nl, ol in zip(nf.loops, f.loops): nl[uvs].uv = ol[ouv].uv
    nb.transform(R)
    me = bpy.data.meshes.new(f'{prefix}_{k}'); nb.to_mesh(me); nb.free()
    ob = bpy.data.objects.new(me.name, me); bpy.context.collection.objects.link(ob); me.materials.append(mat)
    for poly in me.polygons: poly.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, me.name + '.glb'), use_selection=True, export_apply=True)
    meta.append({'name': me.name, 'triangles': sum(len(q.vertices) - 2 for q in me.polygons), 'blade_area': round(area(b), 5)})
# vine stem UV strip (for the procedural vine colour)
ouv = bm.loops.layers.uv.active
us = [l[ouv].uv for f in vine for l in f.loops]
meta_v = {'u': round(sum(u.x for u in us) / len(us), 5), 'v_min': round(1 - max(u.y for u in us), 5), 'v_max': round(1 - min(u.y for u in us), 5),
          'radius': round(float(np.median(np.linalg.norm((VP - VP.mean(0))[:, :2], axis=1))) if False else 0.02, 4)}
json.dump({'leaves': meta, 'vine_uv': meta_v}, open(os.path.join(outdir, prefix + '.json'), 'w'), indent=1)
print('EXPORTED', [m['triangles'] for m in meta], meta_v)
