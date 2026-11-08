"""Fit wearables (collar, bandana, harness, vest, sweater) to every dog build.

blender -b -t 1 --factory-startup -P scripts/build_wearables.py -- <builds_dir> <out_dir> [build ...]

Run after build_dog.py: each kit/builds/<build>.glb is imported, its neck and
torso are measured by casting rays out from the bones, and the wearables are
built to hug that surface. They're skinned like the coat shells (weights copied
from the nearest torso vertex), so they bend with every clip.

Output per build: <out_dir>/<build>.glb with
  * the build's skeleton (same bone names, so a viewer/engine binds the meshes
    to the dog's own skeleton by name; vertices are in the dog's bind space);
  * one skinned mesh per wearable, plus `<item>@<coat>` refits for the fluffy
    coat shells where the coat sits proud of the body (ruff, puff...);
  * attachment points as empties named `socket_<item>.<point>` with extras
    {bone}: e.g. socket_harness.leash, socket_harness.pack_L, socket_collar.tag.
    They're placed in dog space at rest; parent them to `bone` keeping the
    rest transform.
Materials are named by role (collar, strap, pad, hardware...) for recolouring.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, kdtree
from mathutils.bvhtree import BVHTree

sys.path.append(os.path.dirname(__file__))
from propkit import Prop  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:]
builds_dir, out_dir = args[:2]
only = args[2:]
os.makedirs(out_dir, exist_ok=True)
BUILDS = only or sorted(f[:-4] for f in os.listdir(builds_dir)
                        if f.endswith('.glb') and not f.startswith(('ai-', 'fit-')))
COATS = ['ruff', 'puff', 'feathered', 'curly', 'shaggy', 'poodleclip']
TORSO_BONES = {'root', 'spine', 'pelvis', 'chest', 'neck', 'head'}
SIDE = Vector((0, 1, 0))


# --------------------------------------------------------------------------
# Measuring the body

class Body:
    def __init__(self, mesh_objs):
        self.dog = mesh_objs[0]
        self.bvh = []
        for o in mesh_objs:
            me = o.data
            self.bvh.append(BVHTree.FromPolygons([v.co.copy() for v in me.vertices],
                                                 [tuple(p.vertices) for p in me.polygons]))
        self.coat_bvh = self.bvh[1] if len(self.bvh) > 1 else None

    def exit(self, c, d, limit=1.0):
        """Distance from c (inside the body) along d to where the ray leaves the
        whole body: count volumes entered/exited (legs overlap the torso)."""
        bvh = self.bvh[0]
        depth, t, first = 1, 0.0, None
        o = c.copy()
        for _ in range(16):
            loc, nrm, _i, dist = bvh.ray_cast(o, d, limit - t)
            if loc is None:
                break
            t += dist
            first = first or t
            depth += -1 if nrm.dot(d) > 0 else 1
            if depth <= 0:
                return t
            o = loc + d * 1e-5
            t += 1e-5
        return first

    def outer(self, c, d, limit=1.0):
        """Body exit distance, pushed out to the coat shell if one sits further out."""
        r = self.exit(c, d, limit)
        if r is None:
            return None
        body_r = r
        for bvh in self.bvh[1:]:
            o, t = c.copy(), 0.0
            for _ in range(8):
                loc, nrm, _i, dist = bvh.ray_cast(o, d, body_r * 1.7 - t)
                if loc is None:
                    break
                t += dist
                if nrm.dot(d) > 0:   # leaving the coat shell (not entering another tuft)
                    r = max(r, t)
                o = loc + d * 1e-5
                t += 1e-5
        return r

    def front(self, p, back=Vector((-1, 0, 0)), reach=0.6):
        """Frontmost surface point behind p (casting from in front along `back`)."""
        best = None
        for bvh in self.bvh:
            loc, nrm, _i, dist = bvh.ray_cast(p - back * reach, back, reach * 2)
            if loc is not None and (best is None or dist < best[2]):
                best = (loc, nrm, dist)
        return best


def ring_frame(normal):
    """In-plane axes for a cross-section: `up` points to the top of the dog
    (the nape on the neck), `side` to the dog's left."""
    n = normal.normalized()
    side = SIDE - n * SIDE.dot(n)
    side.normalize()
    up = n.cross(side).normalized()
    if up.z < 0 and abs(n.z) < 0.9:
        up = -up
    if abs(n.z) >= 0.9 and up.x > 0:   # near-vertical neck: up = toward the back of the neck
        up = -up
    return up, side


def probe_ring(body, c, normal, n=12, pad=0.0, scale=1.0):
    """Points around a cross-section, `pad` outside the surface. Angle 0 = top,
    pi/2 = left side, pi = underneath (throat / chest)."""
    up, side = ring_frame(normal)
    radii = []
    for k in range(n):
        a = 2 * math.pi * k / n
        d = up * math.cos(a) + side * math.sin(a)
        radii.append(body.outer(c, d))
    good = sorted(r for r in radii if r)
    if not good:   # centre outside the mesh: nudge it back down the axis
        return probe_ring(body, c - normal.normalized() * 0.02, normal, n, pad, scale)
    median = good[len(good) // 2]
    # A ray that runs down inside a leg exits far away: clamp to the ring's median.
    radii = [min(r, median * 1.3) if r else median for r in radii]
    mean = sum(radii) / len(radii)
    pts = []
    for k, r in enumerate(radii):
        a = 2 * math.pi * k / n
        d = up * math.cos(a) + side * math.sin(a)
        pts.append(c + d * (r * scale + pad))
    return pts, mean


# --------------------------------------------------------------------------
# Geometry helpers on top of Prop

def band(P, body, c, normal, width, thick, gap, mat, n=12):
    """Closed strap round the body: rectangular section, hugging the surface at
    both of its edges. Returns (rings, mean radius)."""
    nn = normal.normalized()
    lo, r0 = probe_ring(body, c - nn * width / 2, nn, n, gap)
    hi, r1 = probe_ring(body, c + nn * width / 2, nn, n, gap)
    lo_out, _ = probe_ring(body, c - nn * width / 2, nn, n, gap + thick)
    hi_out, _ = probe_ring(body, c + nn * width / 2, nn, n, gap + thick)
    bm = P.bm
    rings = [[bm.verts.new(p) for p in ring] for ring in (lo, lo_out, hi_out, hi)]
    # Faces between the four loops, closed round the section and round the body.
    rings.append(rings[0])
    P._quads(rings, mat)
    return (lo, hi, lo_out, hi_out), (r0 + r1) / 2


def strap_between(P, body, ca, da, cb, db, width, thick, gap, mat, steps=8):
    """Flat strap lying on the body from (centre a, direction a) to (b) — the
    direction is interpolated and the strap is laid on the body's surface."""
    pts, normals = [], []
    for i in range(steps + 1):
        t = i / steps
        c = ca.lerp(cb, t)
        d = da.slerp(db, t) if da.angle(db) > 1e-3 else da
        r = body.outer(c, d) or 0.05
        pts.append(c + d * (r + gap + thick / 2))
        normals.append(d)
    rings = []
    for i, (p, nrm) in enumerate(zip(pts, normals)):
        tng = (pts[min(i + 1, steps)] - pts[max(i - 1, 0)]).normalized()
        across = nrm.cross(tng).normalized()
        rings.append([P.bm.verts.new(p + across * sx * width / 2 + nrm * sz * thick / 2)
                      for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    P._quads(rings, mat, cap_start=True, cap_end=True)
    return pts, normals


def d_ring(P, at, outward, along, size, mat='hardware'):
    """Metal D-ring standing off the strap: returns the point a clip hooks onto."""
    centre = at + outward * size * 0.9
    P.torus(size * 0.75, size * 0.16, center=centre, mat=mat, seg=8, sides=4, axis=along.cross(outward))
    return centre + outward * size * 0.7


def socket(P, name, pos, bone):
    P.sockets[name] = (Vector(pos), bone)


# --------------------------------------------------------------------------
# The wearables. Each takes the measured skeleton (bone heads/tails in dog
# space) and the Body, and draws into a Prop.

def neck_axis(B):
    a, b = B['neck'][0], B['head'][0]
    return a, (b - a)


def collar(P, body, B):
    a, v = neck_axis(B)
    n = v.normalized()
    c = a + v * 0.42
    _, rn = probe_ring(body, c, n)
    w, t, g = min(rn * 0.42, v.length * 0.4), rn * 0.1, rn * 0.03   # short necks (bulldog) get a narrower collar
    (lo, hi, lo_out, hi_out), rn = band(P, body, c, n, w, t, g, 'collar')
    # Buckle on the left side, D-ring under the throat for a tag or a leash.
    k = len(lo) // 4
    side_p = (lo_out[k] + hi_out[k]) / 2
    out = (side_p - c - n * (side_p - c).dot(n)).normalized()
    P.box((w * 0.35, w * 0.25, w * 1.15), side_p + out * t * 0.3, 'hardware', rot=None)
    k = len(lo) // 2
    throat = (lo_out[k] + hi_out[k]) / 2
    down = (throat - c - n * (throat - c).dot(n)).normalized()
    hook = d_ring(P, throat, down, n, w * 0.45)
    socket(P, 'tag', hook, 'neck')
    socket(P, 'leash', hook, 'neck')


def bandana(P, body, B):
    a, v = neck_axis(B)
    n = v.normalized()
    c = a + v * 0.3
    _, rn = probe_ring(body, c, n)
    w, t, g = min(rn * 0.3, v.length * 0.3), rn * 0.07, rn * 0.02
    (lo, hi, lo_out, hi_out), _ = band(P, body, c, n, w, t, g, 'bandana@2s', n=12)
    # Triangle hanging down the chest from the front half of the band.
    N = 12
    top = [(lo_out[k] + hi_out[k]) / 2 for k in range(N // 2 - 2, N // 2 + 3)]   # left ... throat ... right
    throat = top[2]
    L = rn * 1.9
    apex = throat + Vector((L * 0.35, 0, -L))
    hit = body.front(apex)
    if hit:
        apex = hit[0] + hit[1] * t * 2
    rows, cols = 5, len(top)
    grid = []
    for i in range(rows + 1):
        v_ = i / rows
        row = []
        for j in range(cols):
            p = top[j].lerp(apex, v_)
            if 0 < i:
                h = body.front(p)
                if h and h[0].x > p.x - rn * 0.6:
                    p = h[0] + h[1] * (t * 1.5)
            row.append(p)
        grid.append(row)
    bm = P.bm
    vs = [[bm.verts.new(p) for p in row] for row in grid]
    fs = []
    for i in range(rows):
        for j in range(cols - 1):
            fs.append(bm.faces.new((vs[i][j], vs[i][j + 1], vs[i + 1][j + 1], vs[i + 1][j])))
    P._faces(fs, 'bandana@2s')
    # Contrast hem along the two lower edges.
    P.sweep([vs[i][0].co.copy() for i in range(rows + 1)], t * 0.6, 'bandana_trim', sides=4)
    P.sweep([vs[i][-1].co.copy() for i in range(rows + 1)], t * 0.6, 'bandana_trim', sides=4)
    # Knot at the nape with two short tails.
    nape = (lo_out[0] + hi_out[0]) / 2
    up = (nape - c - n * (nape - c).dot(n)).normalized()
    P.sphere(w * 0.45, nape + up * w * 0.2, 'bandana', subdiv=1)
    for s in (1, -1):
        tail = nape + up * w * 0.3 + n * (-w * 0.2) + SIDE * s * w * 0.4
        P.cyl(w * 0.28, w * 1.1, base=nape + up * w * 0.2, axis=tail - nape + Vector((0, 0, -w * 0.4)), r_top=w * 0.1,
              mat='bandana', sides=4)


def girth_plane(B):
    """Behind the elbows: on the chest bone's head (the ribs), perpendicular to the back."""
    spine_a, chest_b = B['spine'][0], B['chest'][1]
    n = (chest_b - spine_a).normalized()
    return B['chest'][0] + n * 0.0, n


def harness(P, body, B):
    a, v = neck_axis(B)
    nn = v.normalized()
    cn = a + v * 0.12
    _, rn = probe_ring(body, cn, nn)
    w, t, g = min(rn * 0.38, v.length * 0.3), rn * 0.1, rn * 0.03
    neck_rings, _ = band(P, body, cn, nn, w, t, g, 'strap')
    cg, ng = girth_plane(B)
    girth_rings, rg = band(P, body, cg, ng, w * 1.1, t, g, 'strap', n=14)
    up_n, _ = ring_frame(nn)
    up_g, _ = ring_frame(ng)
    # Back strap (top) and chest strap (between the front legs).
    back_pts, back_nrm = strap_between(P, body, cn, up_n, cg, up_g, w, t, g, 'strap')
    strap_between(P, body, cn, -up_n, cg, -up_g, w, t, g, 'strap')
    # Padded saddle on the back where the straps meet, D-ring for the leash.
    top = back_pts[-2]
    pad_n = back_nrm[-2]
    P.pillow(rg * 0.75, rg * 0.9, t * 3, center=top + pad_n * t * 0.8, mat='pad', boxy=4, corner=4, nx=4, ny=4,
             rot=None)
    hook = d_ring(P, top + pad_n * t * 2.2, pad_n, ng, w * 0.55)
    socket(P, 'leash', hook, 'chest')
    socket(P, 'back', back_pts[len(back_pts) // 2] + back_nrm[len(back_pts) // 2] * t * 2, 'chest')
    # Saddlebags hang from the girth on each side, high on the ribs.
    for side, s in (('L', 1), ('R', -1)):
        d = (up_g * math.cos(math.radians(55)) + SIDE * s * math.sin(math.radians(55))).normalized()
        r = body.outer(cg, d) or rg
        socket(P, f'pack_{side}', cg + d * (r + g + t) - ng * w * 0.2, 'chest')


def skin_garment(P, dog, B, coat_bvh, neck_t, back_to, gap, mat, stripes=None):
    """Garment cut from the dog's own torso surface: copy the body, drop the leg
    faces, cut at a neck plane and a plane across the back, and push it out
    along the normals (and over the coat shell, if any). Returns the boundary
    loops at the (neck, back) cuts so they can get a trim."""
    bm = bmesh.new()
    bm.from_mesh(dog.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    deform = bm.verts.layers.deform.active
    names = {g.index: g.name for g in dog.vertex_groups}

    def torso(v):
        w = v[deform]
        return bool(w) and names[max(w.items(), key=lambda kv: kv[1])[0]] in TORSO_BONES

    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(torso(v) for v in f.verts)], context='FACES')
    a, v = neck_axis(B)
    neck_c, neck_n = a + v * neck_t, v.normalized()
    back_x = B['chest'][0].lerp(B['spine'][0], back_to)
    for co, no in ((neck_c, neck_n), (back_x, Vector((-1, 0, 0)))):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=co, plane_no=no, clear_outer=True, dist=1e-6)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    x0, x1 = back_x.x, a.x
    if stripes:   # cut along the stripe edges so the colour bands are straight
        for k in range(1, len(stripes)):
            geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((x0 + (x1 - x0) * k / len(stripes), 0, 0)),
                                   plane_no=Vector((1, 0, 0)), dist=1e-6)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.normal_update()
    moved = {}
    for vert in bm.verts:
        nrm = vert.normal
        p = vert.co + nrm * gap
        if coat_bvh:   # over the coat shell, if it's within reach and we're leaving it
            o, t = vert.co.copy(), 0.0
            for _ in range(6):
                loc, cn, _i, dist = coat_bvh.ray_cast(o, nrm, gap * 14 - t)
                if loc is None:
                    break
                t += dist
                if cn.dot(nrm) > 0:
                    p = loc + nrm * gap
                o = loc + nrm * 1e-5
                t += 1e-5
        moved[vert] = p
    for vert, p in moved.items():
        vert.co = p
    # Into the Prop, painting stripes by position along the body.
    remap = {vert: P.bm.verts.new(vert.co) for vert in bm.verts}
    fs = []
    for f in bm.faces:
        nf = P.bm.faces.new([remap[x] for x in f.verts])
        fs.append(nf)
    P._faces(fs, mat)
    if stripes:
        P.paint(fs, lambda c: stripes[min(len(stripes) - 1, max(0, int((c.x - x0) / (x1 - x0) * len(stripes))))])
    loops = boundary_loops([e for e in bm.edges if e.is_boundary], remap)
    bm.free()
    # Neck loop first, then the back one.
    loops.sort(key=lambda lp: -sum(p.dot(neck_n) for p in lp) / len(lp))
    return loops


def boundary_loops(edges, remap):
    """Order boundary edges into closed loops of positions."""
    nbr = {}
    for e in edges:
        a, b = e.verts
        nbr.setdefault(a, []).append(b)
        nbr.setdefault(b, []).append(a)
    seen, loops = set(), []
    for start in nbr:
        if start in seen:
            continue
        loop, prev, cur = [], None, start
        while cur not in seen:
            seen.add(cur)
            loop.append(remap[cur].co.copy())
            nxt = [x for x in nbr[cur] if x is not prev and x not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
        if len(loop) > 4:
            loops.append(loop)
    return loops


def vest(P, body, B):
    a, v = neck_axis(B)
    _, rn = probe_ring(body, a + v * 0.1, v)
    loops = skin_garment(P, body.dog, B, body.coat_bvh, 0.08, 0.35, rn * 0.06, 'vest@2s')
    for lp in loops:   # piped edges
        P.sweep(lp, rn * 0.06, 'trim', sides=4, closed=True)
    # Leash ring and a handle on the back, sockets for bags.
    cg, ng = girth_plane(B)
    up = Vector((0, 0, 1))
    r = body.outer(cg, up) or rn
    top = cg + up * (r + rn * 0.06)
    hook = d_ring(P, top, up, ng, rn * 0.3)
    socket(P, 'leash', hook, 'chest')
    socket(P, 'back', top + Vector((-rn * 0.6, 0, 0)), 'chest')
    for side, s in (('L', 1), ('R', -1)):
        d = (up * math.cos(math.radians(55)) + SIDE * s * math.sin(math.radians(55))).normalized()
        rr = body.outer(cg, d) or r
        socket(P, f'pack_{side}', cg + d * (rr + rn * 0.08), 'chest')


def sweater(P, body, B):
    a, v = neck_axis(B)
    _, rn = probe_ring(body, a + v * 0.2, v)
    knit = ['knit', 'knit', 'knit_stripe', 'knit', 'knit_stripe', 'knit', 'knit', 'knit']
    loops = skin_garment(P, body.dog, B, body.coat_bvh, 0.34, 0.9, rn * 0.08, 'knit@2s',
                         stripes=[k + '@2s' for k in knit])
    if loops:
        P.sweep(loops[0], rn * 0.16, 'knit', sides=5, closed=True)          # rolled turtleneck
        for lp in loops[1:]:
            P.sweep(lp, rn * 0.07, 'knit_stripe', sides=4, closed=True)     # ribbed hem


ITEMS = {'collar': collar, 'bandana': bandana, 'harness': harness, 'vest': vest, 'sweater': sweater}


# --------------------------------------------------------------------------

def copy_torso_weights(target, source):
    """Weights of the nearest source vertex whose main bone is a torso bone, so
    garments follow the body but don't get dragged by the legs."""
    names = {g.index: g.name for g in source.vertex_groups}
    cand = []
    for v in source.data.vertices:
        if not v.groups:
            continue
        main = max(v.groups, key=lambda g: g.weight)
        if names[main.group] in TORSO_BONES:
            cand.append(v)
    kd = kdtree.KDTree(len(cand))
    for i, v in enumerate(cand):
        kd.insert(v.co, i)
    kd.balance()
    groups = {}
    for v in target.data.vertices:
        _, i, _ = kd.find(v.co)
        for g in cand[i].groups:
            nm = names[g.group]
            if nm not in groups:
                groups[nm] = target.vertex_groups.new(name=nm)
            groups[nm].add([v.index], g.weight, 'REPLACE')


def build(build_name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(builds_dir, f'{build_name}.glb'))
    arm = bpy.data.objects['rig']
    arm.animation_data_clear()
    dog = bpy.data.objects['dog']
    coats = {c: bpy.data.objects.get(f'coat_{c}') for c in COATS}
    B = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones}
    made = []
    sockets = {}
    for coat in [None] + COATS:
        if coat and not coats.get(coat):
            continue
        body = Body([dog] + ([coats[coat]] if coat else []))
        for item, fn in ITEMS.items():
            P = Prop(item if coat is None else f'{item}@{coat}')
            fn(P, body, B)
            if coat and not _wider(P, next(o for o in made if o.name == item)):
                P.bm.free()   # the coat doesn't change the fit: the base one is used
                continue
            obj = P.to_object()
            copy_torso_weights(obj, dog)
            obj.parent = arm
            mod = obj.modifiers.new('rig', 'ARMATURE')
            mod.object = arm
            made.append(obj)
            for name, (pos, bone) in P.sockets.items():
                sockets[f'{obj.name}.{name}'] = (pos, bone)
    for o in list(bpy.context.scene.objects):
        if o not in made and o != arm:
            bpy.data.objects.remove(o)
    for name, (pos, bone) in sockets.items():
        e = bpy.data.objects.new(f'socket_{name}', None)
        e.location = pos
        e['bone'] = bone
        bpy.context.scene.collection.objects.link(e)
    bpy.ops.object.select_all(action='SELECT')
    dst = os.path.join(out_dir, f'{build_name}.glb')
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_extras=True,
                              export_animations=False, export_apply=False, export_skins=True)
    print('WEAR', build_name, ', '.join(f'{o.name} {len(o.data.polygons)}' for o in made))


def _wider(P, base):
    """True if the refit sits noticeably further out than the base fit anywhere."""
    kd = kdtree.KDTree(len(base.data.vertices))
    for v in base.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    worst = 0.0
    for v in P.bm.verts:
        _, _, d = kd.find(v.co)
        worst = max(worst, d)
    size = max(base.dimensions)
    return worst > size * 0.06


for b in BUILDS:
    build(b)
