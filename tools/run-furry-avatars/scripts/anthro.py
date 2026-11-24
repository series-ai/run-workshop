"""Procedural low-poly anthro builder (run inside Blender).

Every character is lofted from rings (superellipse cross-sections) into flat
shaded, triangulated meshes. Colours are not baked: each face gets a named
colour region (fur, fur_light, fur_dark, hair, eye_white, ...) and each region
is its own material, so a game or the viewer recolours a character by setting
material colours. All characters share one skeleton (SKELETON) and are skinned
procedurally, so one animation set plays on every species and outfit.

Space: metres, z up, the character faces -y, its left side is +x.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

V = Vector

# Colour regions, in material order. Defaults are the wolf's colours; a species
# or the player changes them by name.
REGIONS = [
    "fur", "fur_light", "fur_dark", "hair", "inner_ear", "nose", "pads", "claws",
    "eye_white", "iris", "pupil", "shine", "mouth",
    "cloth_top", "cloth_top_trim", "cloth_bottom", "cloth_bottom_trim", "accessory", "horn",
]


def C(r, g, b):
    return (r / 255, g / 255, b / 255)


# ---------------------------------------------------------------- rings and lofts

def ring(c, t, w, ht, hb=None, n=12, exp=2.0, up=(0, 0, 1), wl=None, roll=0.0, flat=False):
    """A closed cross-section around centre c, perpendicular to direction t.
    `up` picks which way the section's top points. w = half width (wl: a
    different half width on the -side), ht / hb = half height above / below.
    exp 2 is an ellipse; higher is boxier. Vertex 0 sits on the top ridge
    (or a flat edge spans the top when flat)."""
    t = V(t).normalized()
    u = V(up) - t * V(up).dot(t)
    if u.length < 1e-5:
        u = V((0, -1, 0)) - t * V((0, -1, 0)).dot(t)
    u.normalize()
    s = t.cross(u).normalized()   # with t up the body (+z) and u front (-y): s = +x, the left side
    if roll:
        R = Matrix.Rotation(roll, 3, t)
        u, s = R @ u, R @ s
    hb = ht if hb is None else hb
    wl = w if wl is None else wl
    pts = []
    for k in range(n):
        a = math.pi / 2 + 2 * math.pi * (k + (0.5 if flat else 0)) / n
        ca, sa = math.cos(a), math.sin(a)
        x = math.copysign(abs(ca) ** (2 / exp), ca) * (w if ca >= 0 else wl)
        z = math.copysign(abs(sa) ** (2 / exp), sa) * (ht if sa >= 0 else hb)
        pts.append(V(c) + s * x + u * z)
    return pts


def catmull(points, n):
    """n samples along a Catmull-Rom curve through `points` (tuples of any length)."""
    P = [tuple(p) for p in points]
    P = [tuple(2 * a - b for a, b in zip(P[0], P[1]))] + P + [tuple(2 * a - b for a, b in zip(P[-1], P[-2]))]
    segs = len(P) - 3
    out = []
    for i in range(n):
        t = i / (n - 1) * segs
        k = min(int(t), segs - 1)
        f = t - k
        p0, p1, p2, p3 = P[k:k + 4]
        out.append(tuple(0.5 * ((2 * b) + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (-a + 3 * b - 3 * c + d) * f ** 3)
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return out


class Mesh:
    """A bmesh being built, with a colour region per face."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.reg = self.bm.faces.layers.int.new("region")
        self.decals = set()   # open decal faces keep their own winding (recalc would flip them)
        self.part = self.bm.verts.layers.int.new("part")
        self.parts = ["main"]   # skin groups: each vertex remembers which limb it was built for
        self.cur = 0

    def group(self, name):
        """Tag the vertices made from now on with a skin group (see skin)."""
        if name not in self.parts:
            self.parts.append(name)
        self.cur = self.parts.index(name)
        return self

    def _v(self, p):
        v = self.bm.verts.new(p)
        v[self.part] = self.cur
        return v

    def face(self, verts, region):
        f = self.bm.faces.new(verts)
        f[self.reg] = REGIONS.index(region)
        return f

    def loft(self, rings, region="fur", cap0=True, cap1=True, tip0=None, tip1=None):
        """Quads between consecutive rings; optional caps or pointed tips."""
        vs = [[self._v(p) for p in r] for r in rings]
        n = len(rings[0])
        faces = []
        for a, b in zip(vs, vs[1:]):
            for k in range(n):
                faces.append(self.face((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]), region))
        for end, tip, cap, flip in ((vs[0], tip0, cap0, True), (vs[-1], tip1, cap1, False)):
            if tip is not None:
                tv = self._v(tip)
                for k in range(n):
                    tri = (end[k], end[(k + 1) % n], tv)
                    faces.append(self.face(tri[::-1] if flip else tri, region))
            elif cap:
                faces.append(self.face(end[::-1] if flip else end, region))
        return vs, faces

    def paint(self, fn, only=None):
        """Re-colour faces: fn(centre, normal, current region name) -> region name
        or None. `only`: skin groups to touch (e.g. ["torso"])."""
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f not in self.decals])
        keep = None if only is None else {self.parts.index(g) for g in only if g in self.parts}
        for f in self.bm.faces:
            if keep is not None and f.verts[0][self.part] not in keep:
                continue
            r = fn(f.calc_center_median(), f.normal, REGIONS[f[self.reg]])
            if r:
                f[self.reg] = REGIONS.index(r)

    def obj(self, mats):
        bmesh.ops.recalc_face_normals(self.bm, faces=[f for f in self.bm.faces if f.index not in self.decals and f not in self.decals])
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        regs = [0] * len(me.polygons)
        me.attributes["region"].data.foreach_get("value", regs)
        used = sorted(set(regs))
        for r in used:
            me.materials.append(mats[REGIONS[r]])
        slot = {r: i for i, r in enumerate(used)}
        me.polygons.foreach_set("material_index", [slot[r] for r in regs])
        me.polygons.foreach_set("use_smooth", [False] * len(me.polygons))
        me.attributes.remove(me.attributes["region"])
        o = bpy.data.objects.new(self.name, me)
        o["parts"] = self.parts
        bpy.context.scene.collection.objects.link(o)
        self.bm.free()
        return o


def materials(colours):
    mats = {}
    for r in REGIONS:
        m = bpy.data.materials.new(r)
        rgb = colours.get(r, (1, 0, 1))
        m.diffuse_color = (*rgb, 1)
        m.use_nodes = True
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1)
        b.inputs["Roughness"].default_value = 0.35 if r in ("eye_white", "iris", "pupil", "shine", "nose", "claws") else 0.85
        mats[r] = m
    return mats


# ---------------------------------------------------------------- surface decals

class Surface:
    """Ray casts onto a finished mesh so decals (eyes, brows, mouth) hug it."""

    def __init__(self, mesh):
        bm = mesh.bm.copy()
        bmesh.ops.triangulate(bm, faces=bm.faces)
        self.bvh = BVHTree.FromBMesh(bm)
        bm.free()

    def hit(self, p, d):
        """First hit casting from p along d (normalised), or None."""
        d = V(d).normalized()
        loc, nrm, _, _ = self.bvh.ray_cast(V(p), d)
        if loc is None:
            return None
        return loc, (-nrm if nrm.dot(d) > 0 else nrm)   # face the caster, whatever the winding


def decal(mesh, surf, centre, toward, outline, region, lift=0.004, up=(0, 0, 1)):
    """A flat fan of faces on the surface. `outline` is a list of (x, y) in a
    local frame around the point where a ray from `centre` along `toward` hits
    the surface (x along the surface sideways, y up). Each outline point is
    projected back onto the surface and lifted off it."""
    h = surf.hit(centre, toward)
    if not h:
        return []
    p0, n0 = h
    up = V(up) - n0 * V(up).dot(n0)
    up.normalize()
    side = up.cross(n0).normalized()
    side = -side  # x grows to the viewer's right when looking at the surface
    pts = []
    for x, y in outline:
        q = p0 + side * x + up * y
        hh = surf.hit(q + n0 * 0.05, -n0)
        pts.append((hh[0] + hh[1] * lift) if hh else q + n0 * lift)
    cv = mesh._v(p0 + n0 * lift)
    ring_v = [mesh._v(p) for p in pts]
    m = len(ring_v)
    faces = []
    for k in range(m):
        tri = (cv, ring_v[k], ring_v[(k + 1) % m])
        f = mesh.face(tri, region)
        f.normal_update()
        if f.normal.dot(n0) < 0:
            f.normal_flip()
        faces.append(f)
        mesh.decals.add(f)
    return faces


def patch(mesh, surf, centre, toward, outline, region, lift=0.002, up=(0, 0, 1), rings=4):
    """Like decal, but subdivided into concentric rings, each projected onto the
    surface, so a big marking (an eye mask) hugs a curved head instead of cutting
    through it."""
    h = surf.hit(centre, toward)
    if not h:
        return []
    p0, n0 = h
    up = V(up) - n0 * V(up).dot(n0)
    up.normalize()
    side = -up.cross(n0).normalized()

    def proj(x, y):
        q = p0 + side * x + up * y
        hh = surf.hit(q + n0 * 0.08, -n0)
        return (hh[0] + hh[1] * lift) if hh else q + n0 * lift
    cv = mesh._v(p0 + n0 * lift)
    layers = [[mesh._v(proj(x * f, y * f)) for x, y in outline] for f in [(k + 1) / rings for k in range(rings)]]
    m = len(outline)
    faces = []

    def add(vs):
        f = mesh.face(vs, region)
        f.normal_update()
        if f.normal.dot(n0) < 0:
            f.normal_flip()
        faces.append(f)
        mesh.decals.add(f)
    for k in range(m):
        add((cv, layers[0][k], layers[0][(k + 1) % m]))
    for a, b in zip(layers, layers[1:]):
        for k in range(m):
            add((a[k], b[k], b[(k + 1) % m], a[(k + 1) % m]))
    return faces


def strip(mesh, surf, pts3, toward_fn, width, region, lift=0.004):
    """A thin ribbon along points projected onto the surface (a mouth line, a brow)."""
    hits = []
    for p in pts3:
        h = surf.hit(V(p) - toward_fn(p) * 0.08, toward_fn(p))
        if h:
            hits.append(h)
    vs = []
    for i, (p, n) in enumerate(hits):
        a = hits[max(i - 1, 0)][0]
        b = hits[min(i + 1, len(hits) - 1)][0]
        t = (b - a).normalized()
        s = n.cross(t).normalized() * width * 0.5
        vs.append((mesh._v(p + n * lift + s), mesh._v(p + n * lift - s)))
    for (a0, a1), (b0, b1) in zip(vs, vs[1:]):
        f = mesh.face((a0, b0, b1, a1), region)
        f.normal_update()
        if f.normal.dot(hits[0][1]) < 0:
            f.normal_flip()
        mesh.decals.add(f)


def almond(w, h, n=12, tilt=0.0, inner_drop=0.0):
    """An almond (eye) outline: pointed at both ends, fuller on top."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        x = math.cos(a) * w
        y = math.sin(a) * h * (1.0 if math.sin(a) > 0 else 0.7)
        y *= abs(math.sin(a)) ** 0.15
        y += inner_drop * (x / w)
        c, s = math.cos(tilt), math.sin(tilt)
        pts.append((x * c - y * s, x * s + y * c))
    return pts


def disc(r, n=10, ry=None):
    ry = r if ry is None else ry
    return [(math.cos(2 * math.pi * k / n) * r, math.sin(2 * math.pi * k / n) * ry) for k in range(n)]


# ---------------------------------------------------------------- skeleton and skin

def build_rig(J):
    """J: joint name -> position. The shared anthro skeleton:

    root ─ hips ─ spine ─ chest ─ neck ─ head ─ ear.L/R
             │              └ shoulder.L/R ─ upper_arm ─ forearm ─ hand ─ fingers
             ├ thigh.L/R ─ shin ─ foot ─ toes      (digitigrade: foot is the raised metatarsal)
             └ tail.0 ─ tail.1 ─ tail.2 ─ tail.3 ─ tail.4
    """
    bones = [("root", V((0, 0, 0)), V((0, 0, 0.15)), None),
             ("hips", J["pelvis"], J["spine"], "root"),
             ("spine", J["spine"], J["chest"], "hips"),
             ("chest", J["chest"], J["neck"], "spine"),
             ("neck", J["neck"], J["head"], "chest"),
             ("head", J["head"], J["head_top"], "neck")]
    if "jaw" in J:   # the lower jaw (see parts.split_jaw): opens for bites, barks and roars
        bones.append(("jaw", J["jaw"], J["jaw_tip"], "head"))
    for s, sd in (("L", 1), ("R", -1)):
        m = lambda k: J[f"{k}.{s}"]  # noqa: E731
        bones += [(f"ear.{s}", m("ear"), m("ear_tip"), "head"),
                  (f"shoulder.{s}", J["neck"] + V((sd * 0.03, 0, -0.03)), m("shoulder"), "chest"),
                  (f"upper_arm.{s}", m("shoulder"), m("elbow"), f"shoulder.{s}"),
                  (f"forearm.{s}", m("elbow"), m("wrist"), f"upper_arm.{s}"),
                  (f"hand.{s}", m("wrist"), m("knuckle"), f"forearm.{s}"),
                  (f"fingers.{s}", m("knuckle"), m("fingertip"), f"hand.{s}"),
                  (f"thigh.{s}", m("hip"), m("knee"), "hips"),
                  (f"shin.{s}", m("knee"), m("hock"), f"thigh.{s}"),
                  (f"foot.{s}", m("hock"), m("ball"), f"shin.{s}"),
                  (f"toes.{s}", m("ball"), m("toe"), f"foot.{s}")]
    tail = J["tail"]
    for i in range(len(tail) - 1):
        bones.append((f"tail.{i}", tail[i], tail[i + 1], "hips" if i == 0 else f"tail.{i - 1}"))
    ad = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, parent in bones:
        b = ad.edit_bones.new(name)
        b.head, b.tail = V(h), V(t)
        d = (b.tail - b.head).normalized()
        # roll so local x points to the character's left for every bone where that is defined
        ref = V((1, 0, 0)) if abs(d.x) < 0.9 else V((0, -1, 0))
        b.align_roll((ref - d * ref.dot(d)).normalized().cross(d))
        if parent:
            b.parent = ad.edit_bones[parent]
            b.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, {name: (V(h), V(t)) for name, h, t, _ in bones}


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length, t


def skin(obj, arm, segs, bones, power=4.0, keep=3):
    """Weights by inverse distance to the candidate bones' segments (top
    `keep`). `bones` is a list, or a dict of skin group -> list so each limb
    only takes weight from its own chain (see Mesh.group)."""
    names = list(obj.get("parts", ["main"]))
    by_group = bones if isinstance(bones, dict) else {"main": bones}
    allb = sorted({b for bl in by_group.values() for b in bl})
    groups = {b: obj.vertex_groups.new(name=b) for b in allb}
    tags = [0] * len(obj.data.vertices)
    if "part" in obj.data.attributes:
        obj.data.attributes["part"].data.foreach_get("value", tags)
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        cand = by_group.get(names[tags[v.index]], by_group.get("main", allb))
        ws = []
        for b in cand:
            d, _ = _seg_dist(p, *segs[b])
            ws.append((1.0 / max(d, 0.004) ** power, b))
        ws.sort(reverse=True)
        ws = ws[:keep]
        tot = sum(w for w, _ in ws)
        for w, b in ws:
            if w / tot > 0.02:
                groups[b].add([v.index], w / tot, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return obj


def skin_path(obj, arm, path, i0, chain, root_bone, root_blend=0.12):
    """Skin a chain-like part (a tail) by how far along its *own* centreline each vertex
    is, not by distance to the bones. A tail that curls away from the shared bone chain
    (a cat's, raised and hooked) then bends smoothly along its length instead of the far
    part snapping to whichever bone happens to be nearest. path: centreline points,
    i0: the first point outside the body; chain: bone names root to tip."""
    n = len(path)
    segs = list(zip(path, path[1:]))
    groups = {b: obj.vertex_groups.new(name=b) for b in [root_bone] + chain}
    span = max(1, n - 1 - i0)
    # map by length: a tail shorter than the bone chain only uses its first bones (a deer's flag must not be
    # bent by five bones' worth of curl, or it stretches out like a pole)
    tail_len = sum((path[k + 1] - path[k]).length for k in range(i0, n - 1))
    chain_len = sum(arm.data.bones[b].length for b in chain)
    use = min(1.0, tail_len / max(chain_len, 1e-6))
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        best = min(range(len(segs)), key=lambda k: _seg_dist(p, *segs[k])[0])
        u = best + _seg_dist(p, *segs[best])[1]
        s = (u - i0) / span                                  # 0 at the body, 1 at the tip (< 0 inside the hips)
        w = {}
        if s < root_blend:                                   # ease in from the hips
            h = 1.0 if s <= 0 else 1 - s / root_blend
            w[root_bone] = h
            rest = 1 - h
        else:
            rest = 1.0
        if rest > 0:
            x = min(max(s, 0.0), 0.9999) * use * len(chain)  # position along the bone chain
            k = int(x)
            f = x - k
            w[chain[k]] = w.get(chain[k], 0) + rest * (1 - f)
            if k + 1 < len(chain):
                w[chain[k + 1]] = w.get(chain[k + 1], 0) + rest * f
            else:
                w[chain[k]] += rest * f
        for b, wt in w.items():
            if wt > 0.01:
                groups[b].add([v.index], wt, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return obj


def rigid_parts(obj, arm, bone_of):
    """Each vertex fully to one bone, chosen by its skin group (e.g. {"main": "head", "jaw": "jaw"})."""
    names = list(obj.get("parts", ["main"]))
    tags = [0] * len(obj.data.vertices)
    if "part" in obj.data.attributes:
        obj.data.attributes["part"].data.foreach_get("value", tags)
    groups = {}
    for i, tg in enumerate(tags):
        b = bone_of.get(names[tg], bone_of["main"])
        if b not in groups:
            groups[b] = obj.vertex_groups.new(name=b)
        groups[b].add([i], 1.0, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return obj


def rigid(obj, arm, bone):
    """Skin every vertex fully to one bone (eyes, claws, buttons)."""
    g = obj.vertex_groups.new(name=bone)
    g.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return obj
