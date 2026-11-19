"""Rig + animate the boxy-tall bean kit.

    Blender -b --factory-startup --python rig/beanrig.py -- <out dir> parts [part ...]
    Blender -b --factory-startup --python rig/beanrig.py -- <out dir> anim
    Blender -b --factory-startup --python rig/beanrig.py -- <out dir> strips <clip ...>

parts   every kit part (see boxykit.py) skinned to the shared skeleton, plus the toy weapons (prop-<kind>, rig/weapons.py)
anim    base.glb: the base figure + skeleton + every clip in rig/clips.py; clips.json
strips  quick Workbench frame strips of clips, for review

The skeleton (13 bones, all pointing up in rest so rotations read in character space):
    root (ground) > hips (centre of mass) > spine (waist) > chest > arm.L/R > hand.L/R > grip.L/R
                                          > leg.L/R > foot.L/R
Weights are rigid per piece, like a vinyl toy: limbs to their bones, sleeves to the arm,
everything on the body blends spine -> chest by height, weapons ride grip.R.
"""
import json
import math
import os
import sys

_KIT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
_src = open(os.path.join(_KIT, "boxykit.py")).read()
_g = {"__file__": os.path.join(_KIT, "boxykit.py"), "__name__": "boxykit"}
exec(compile(_src[: _src.rindex("\nmain_kit()")], "boxykit.py", "exec"), _g)
globals().update({k: v for k, v in _g.items() if not k.startswith("__")})
exec(compile(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips.py")).read(), "clips.py", "exec"))

# --------------------------------------------------------------------------
# resolution: BEAN_RES scales every mesh generator (1 = the hi-res concept build, 0.35 = mobile)
# --------------------------------------------------------------------------
RES = float(os.environ.get("BEAN_RES", "0.3"))


def apply_res(g, r):
    """Rebind the generators in the kit namespace so every part is built at resolution r."""
    if r >= 0.999:
        return

    def S(n, lo):
        return max(lo, int(round(n * r)))
    build0, ell0, sweep0, garment0 = g["Body"].build, g["ell"], g["sweep"], g["garment"]

    def build(self, segs=72, rings=80, groove=0.0, inset=0.0):
        return build0(self, S(segs, 20), S(rings, 18), groove, inset)

    def ell(bm, c, sc, normal=None, segs=28, rings=16, cut=None):
        return ell0(bm, c, sc, normal, S(segs, 8), S(rings, 5), cut)

    def sweep(bm, pts, radii, segs=16, closed=False, caps=True):
        if closed and len(pts) > 24:                       # girdles and rings: fewer points round the loop
            step = max(1, int(round(1 / max(r, 0.4))))
            pts = pts[::step]
            radii = radii[::step] if isinstance(radii, (list, tuple)) else radii
        return sweep0(bm, pts, radii, S(segs, 6), closed, caps)

    def garment(body, out, keep, mat, parent, thick=0.04, smooth=8):
        ob = garment0(body, out, keep, mat, parent, thick, smooth)
        for m in list(ob.modifiers):
            if m.type == "BEVEL":                          # the rim bevel is most of a garment's triangles
                ob.modifiers.remove(m)
            elif m.type == "SOLIDIFY":                     # outer shell + rim only: the inner layer is never seen
                m.use_rim_only = True
                m.offset = -1.0
        return ob
    g["Body"].build, g["ell"], g["sweep"], g["garment"] = build, ell, sweep, garment
    g["SCREEN_NP"], g["SCREEN_K"] = S(72, 24), S(10, 4)


apply_res(_g, RES)

import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Quaternion, Vector  # noqa: E402

# --------------------------------------------------------------------------
# joints from the kit geometry
# --------------------------------------------------------------------------
def joints():
    spec = dict(BODIES["boxy-tall"])
    body = Body(spec)
    body.z0 = FEET_Z0["chunky"]
    bm = body.build()
    bm.free()
    h, z0 = spec["h"], body.z0
    Z = lambda f: z0 + f * h
    J = {"root": Vector((0, 0, 0)), "hips": Vector((0, 0, 0.9)), "spine": Vector((0, 0, z0 + 0.15)),
         "chest": Vector((0, 0, Z(0.5))), "_Z": Z, "_z0": z0, "_body": body}
    lx = spec["leg"][2]
    for sg, sd in ((1, "L"), (-1, "R")):
        a, d = arm_root(body, sg)
        J[f"arm.{sd}"] = a
        J[f"forearm.{sd}"] = a + d * 0.17                 # the elbow, hidden mid-arm
        J[f"hand.{sd}"] = a + d * 0.34
        J[f"_bend.{sd}"] = d.cross(Vector((0, -1, 0))).normalized()  # elbow hinge: folds the forearm forward
        J[f"grip.{sd}"] = a + d * 0.42
        J[f"_dir.{sd}"] = d
        J[f"leg.{sd}"] = Vector((sg * lx, 0, z0 + 0.05))
        J[f"foot.{sd}"] = Vector((sg * lx, -0.01, 0.1))
    return J


PARENT = {"hips": "root", "spine": "hips", "chest": "spine", "arm.L": "chest", "arm.R": "chest",
          "forearm.L": "arm.L", "forearm.R": "arm.R", "hand.L": "forearm.L", "hand.R": "forearm.R", "grip.L": "hand.L", "grip.R": "hand.R", "leg.L": "hips", "leg.R": "hips",
          "foot.L": "leg.L", "foot.R": "leg.R"}
BONES = ["root"] + list(PARENT)


def make_armature(J):
    arm = bpy.data.armatures.new("rig")
    ob = bpy.data.objects.new("rig", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for n in BONES:
        b = arm.edit_bones.new(n)
        b.head = J[n]
        b.tail = J[n] + Vector((0, 0, 0.12))
        b.roll = 0.0
    for n, p in PARENT.items():
        arm.edit_bones[n].parent = arm.edit_bones[p]
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


# --------------------------------------------------------------------------
# weights
# --------------------------------------------------------------------------
def _smooth(a, b, x):
    u = min(max((x - a) / (b - a), 0.0), 1.0)
    return u * u * (3 - 2 * u)


def islands(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    seen, out = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, isl = [v], []
        seen.add(v.index)
        while stack:
            u = stack.pop()
            isl.append(u.index)
            for e in u.link_edges:
                w = e.other_vert(u)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
        out.append(isl)
    bm.free()
    return out


def bind(ob, rig, J):
    base = ob.name.split(".")[0]
    me = ob.data
    mw = ob.matrix_world
    groups = {n: ob.vertex_groups.new(name=n) for n in BONES}
    side = lambda x: "L" if x > 0 else "R"
    Z = J["_Z"]
    rigid = {"legs": "leg", "seam": "leg", "feet": "foot", "hands": "hand", "pantleg": "leg"}

    def arm_weights(i, sd):
        """Blend upper arm -> forearm across the hidden elbow."""
        a, d = J[f"arm.{sd}"], J[f"_dir.{sd}"]
        u = (mw @ me.vertices[i].co - a).dot(d) / 0.34
        w = _smooth(0.4, 0.6, u)
        if w < 1:
            groups[f"arm.{sd}"].add([i], 1 - w, "REPLACE")
        if w > 0:
            groups[f"forearm.{sd}"].add([i], w, "REPLACE")
    if base == "arms":
        for v in me.vertices:
            arm_weights(v.index, side((mw @ v.co).x))
    elif base in rigid:
        for v in me.vertices:
            groups[f"{rigid[base]}.{side((mw @ v.co).x)}"].add([v.index], 1.0, "REPLACE")
    elif base.startswith("prop"):
        groups["grip.R"].add([v.index for v in me.vertices], 1.0, "REPLACE")
    else:
        for isl in islands(me):
            c = sum((mw @ me.vertices[i].co for i in isl), Vector()) / len(isl)
            to_arm = None
            for sd in ("L", "R"):
                a, d = J[f"arm.{sd}"], J[f"_dir.{sd}"]
                u = (c - a).dot(d)
                perp = (c - a - d * u).length
                if u > 0.06 and perp < 0.2 and abs(c.x) > 0.44:
                    to_arm = sd
            for i in isl:
                if to_arm:
                    arm_weights(i, to_arm)
                    continue
                z = (mw @ me.vertices[i].co).z
                w = _smooth(Z(0.38), Z(0.6), z)
                if w < 1:
                    groups["spine"].add([i], 1 - w, "REPLACE")
                if w > 0:
                    groups["chest"].add([i], w, "REPLACE")
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = rig
    ob.parent = rig


def bake_meshes():
    """Apply every modifier (solidify, bevel) so the skinned GLB matches the static one."""
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.convert(target="MESH")
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            o.parent = None
            o.matrix_world = o.matrix_world.copy()


# --------------------------------------------------------------------------
# weapons: toy guns on grip.R (rig/weapons.py)
# --------------------------------------------------------------------------
exec(compile(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "weapons.py")).read(), "weapons.py", "exec"))


# --------------------------------------------------------------------------
# posing
# --------------------------------------------------------------------------
def _rot(pitch, yaw, roll):
    r = math.radians
    return (Matrix.Rotation(r(yaw), 3, "Z") @ Matrix.Rotation(r(pitch), 3, "X") @ Matrix.Rotation(r(roll), 3, "Y"))


def _frame(v):
    z = Vector((0, 0, 1))
    w = _smooth(0.9, 0.995, abs(v.dot(z)))
    ref = (z * (1 - w) + Vector((0, 1, 0)) * w).normalized()
    u = (ref - v * ref.dot(v)).normalized()
    return Matrix((v, u, v.cross(u))).transposed()


def arm_rot(J, sd, swing, raise_, twist):
    """Raise in the frontal plane (0 down, 90 out, 180 up, < 0 across the body), then swing
    forward about the shoulder, then twist about the arm. Euler, so it never flips."""
    s = 1 if sd == "L" else -1
    R = Matrix.Rotation(math.radians(-swing), 3, "X") @ Matrix.Rotation(math.radians(-s * (raise_ - R0)), 3, "Y")
    D = R @ J[f"_dir.{sd}"]
    return Matrix.Rotation(math.radians(twist) * s, 3, D) @ R


def apply_pose(rig, J, pose):
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    for name, ch in pose.b.items():
        b = pb[name]
        M = rig.data.bones[name].matrix_local.to_3x3()
        Mi = M.inverted()
        Rw = Matrix.Identity(3)
        if "r" in ch:
            Rw = _rot(*ch["r"])
        if "arm" in ch:
            Rw = arm_rot(J, name[-1], *ch["arm"])
        if "leg" in ch:
            s = 1 if name.endswith("L") else -1
            fwd, out = ch["leg"]
            Rw = Matrix.Rotation(math.radians(-fwd), 3, "X") @ Matrix.Rotation(math.radians(-s * out), 3, "Y")
        if "toe" in ch:
            Rw = Matrix.Rotation(math.radians(ch["toe"][0]), 3, "X")
        if "bend" in ch:
            Rw = Matrix.Rotation(math.radians(ch["bend"][0]), 3, J[f"_bend.{name[-1]}"])
        b.rotation_quaternion = (Mi @ Rw @ M).to_quaternion()
        if "loc" in ch:
            x, f, u = ch["loc"]
            b.location = Mi @ Vector((x, -f, u))
        if "s" in ch:
            sw = Vector(ch["s"])
            b.scale = tuple(sum(abs(M[j][i]) * sw[j] for j in range(3)) for i in range(3))


GROUND = ("body", "legs", "feet", "arms", "hands", "proxy")


def add_ground_proxy(rig, J):
    """A hidden shell 5 cm out from the body: the floor contact allows for a typical top."""
    ob = garment(J["_body"], 0.05, lambda c: True, plastic("proxy", (1, 0, 1)), None, thick=0.02, smooth=0)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target="MESH")
    ob.name = "proxy"
    ob.hide_render = True
    bind(ob, rig, J)
    return ob


def lowest(meshes):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    z = 1e9
    for m in meshes:
        e = m.evaluated_get(dg)
        mw = e.matrix_world
        z = min(z, min((mw @ Vector(c)).z for c in e.bound_box))
    return z


def set_root_z(rig, z):
    pb = rig.pose.bones["root"]
    M = rig.data.bones["root"].matrix_local.to_3x3()
    w = M @ pb.location
    w.z = z
    pb.location = M.inverted() @ w


def sample(c, t):
    """The clip at t, with the drag bones taken from slightly earlier (overlap)."""
    dur = c["dur"]

    def ev(tt):
        tt = tt % dur if c["loop"] else min(max(tt, 0.0), dur)
        return c["f"](tt)
    p = ev(t)
    for bone, d in c["drag"].items():
        if not d:
            continue
        lag = ev(t - d)
        if bone in lag.b:
            p.b[bone] = lag.b[bone]
        else:
            p.b.pop(bone, None)
    return p


def bake_clips(rig, J, names=None, record=None):
    """Sample every clip, ground-lock it, keyframe it. record(name, frames) gets the per-frame
    poses for the audit."""
    rig.animation_data_create()
    bpy.context.scene.render.fps = FPS              # Blender defaults to 24: export key times must match the authored 30 fps
    bpy.context.scene.render.fps_base = 1.0
    ground = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name.split(".")[0] in GROUND]
    meta = {}
    for name, c in CLIPS.items():
        if names and name not in names:
            continue
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        rig.animation_data.action = act
        n = max(1, round(c["dur"] * FPS))
        frames = []
        for f in range(n + 1):
            t = 0.0 if (c["loop"] and f == n) else min(f / FPS, c["dur"])  # a loop ends where it starts
            p = sample(c, t)
            apply_pose(rig, J, p)
            if not p.is_free:
                set_root_z(rig, 0.0)
            frames.append((p, lowest(ground)))
        grounded = [i for i, (p, _) in enumerate(frames) if not p.is_free and p.air_h is None]

        def neighbour(i, step):
            j = i
            for _ in range(len(frames)):
                j += step
                if c["loop"]:
                    j %= len(frames)
                elif j < 0 or j >= len(frames):
                    return None
                if j in grounded:
                    return j
            return None
        zs = []
        for i, (p, low) in enumerate(frames):
            if p.is_free:
                zs.append(None)
            elif p.air_h is None:
                zs.append(-low)
            else:
                a, b = neighbour(i, -1), neighbour(i, 1)
                za = -frames[a][1] if a is not None else -low
                zb = -frames[b][1] if b is not None else za
                if a is None:
                    za = zb
                da = (i - a) % len(frames) if a is not None else 0
                db = (b - i) % len(frames) if b is not None else 0
                k = da / (da + db) if da + db else 0.0
                zs.append(za + (zb - za) * k + p.air_h)
        # an airborne stretch that dips through the floor (a flip's head at the bottom of the turn) is lifted
        # by one smooth arch over the whole stretch, never frame by frame (a per-frame clamp kinks the arc)
        i = 0
        while i < len(frames):
            if frames[i][0].air_h is None or zs[i] is None:
                i += 1
                continue
            j = i
            while j + 1 < len(frames) and frames[j + 1][0].air_h is not None and zs[j + 1] is not None:
                j += 1
            n_ = j - i + 1
            shape = [math.sin(math.pi * (q + 1) / (n_ + 1)) for q in range(n_)]
            need = max((-frames[i + q][1] - zs[i + q]) / shape[q] for q in range(n_))
            if need > 0:
                for q in range(n_):
                    zs[i + q] += need * shape[q]
            i = j + 1
        prev = {}
        for f, ((p, _), z) in enumerate(zip(frames, zs)):
            apply_pose(rig, J, p)
            if z is not None:
                set_root_z(rig, z)
            for b in rig.pose.bones:
                q = b.rotation_quaternion.copy()
                if b.name in prev and prev[b.name].dot(q) < 0:
                    q.negate()
                    b.rotation_quaternion = q
                prev[b.name] = q.copy()
                b.keyframe_insert("rotation_quaternion", frame=f)
                b.keyframe_insert("location", frame=f)
                b.keyframe_insert("scale", frame=f)
        act.frame_range = (0, n)
        meta[name] = {"duration": n / FPS, "frames": n + 1, "loop": c["loop"], "tags": c["tags"]}
        if c.get("speed"):
            meta[name]["speed"] = c["speed"]
        if record:
            record(name, frames)
    rig.animation_data.action = None
    for b in rig.pose.bones:
        b.rotation_quaternion = (1, 0, 0, 0)
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    return meta


# --------------------------------------------------------------------------
# export
# --------------------------------------------------------------------------
def export(path, objs, animations=False):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
              export_skins=True, export_animations=animations)
    if animations:
        kw.update(export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_step=1,
                  export_reset_pose_bones=True, export_optimize_animation_size=False)
    bpy.ops.export_scene.gltf(**kw)
    print("WROTE", os.path.basename(path))


def rigged(build, pick):
    """Build a part with boxykit, keep the picked meshes, skin them to a fresh rig."""
    build()
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and not pick(o.name.split(".")[0]):
            bpy.data.objects.remove(o)
    bake_meshes()
    J = joints()
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    rig = make_armature(J)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in meshes:
        bind(o, rig, J)
    return rig, meshes, J


# --------------------------------------------------------------------------
# chest numbers: 1 or 2 digit plates per surface, digits are swappable textures
# --------------------------------------------------------------------------
NUM_SURFACES = {"body": []}   # numbers sit on the bean itself (a top just covers them)
NUM_Z, NUM_H, NUM_W, NUM_GAP = 0.275, 0.4, 0.31, 0.275               # big jersey numbers, under the body seam
DIGITS = {  # chunky athletic stroke font, unit box, y up
    "0": [[(0.5, 0.95), (0.78, 0.86), (0.85, 0.5), (0.78, 0.14), (0.5, 0.05), (0.22, 0.14), (0.15, 0.5), (0.22, 0.86), (0.5, 0.95)]],
    "1": [[(0.28, 0.78), (0.55, 0.95), (0.55, 0.05)], [(0.28, 0.05), (0.82, 0.05)]],
    "2": [[(0.18, 0.74), (0.32, 0.92), (0.6, 0.95), (0.8, 0.8), (0.76, 0.58), (0.2, 0.07), (0.85, 0.07)]],
    "3": [[(0.2, 0.9), (0.8, 0.9), (0.46, 0.56), (0.74, 0.46), (0.8, 0.22), (0.6, 0.06), (0.2, 0.12)]],
    "4": [[(0.7, 0.05), (0.7, 0.95), (0.14, 0.32), (0.88, 0.32)]],
    "5": [[(0.82, 0.93), (0.26, 0.93), (0.22, 0.55), (0.6, 0.6), (0.82, 0.4), (0.75, 0.12), (0.5, 0.05), (0.18, 0.13)]],
    "6": [[(0.76, 0.9), (0.45, 0.94), (0.22, 0.66), (0.17, 0.3), (0.35, 0.06), (0.65, 0.06), (0.83, 0.28), (0.66, 0.5), (0.36, 0.52),
           (0.19, 0.36)]],
    "7": [[(0.15, 0.92), (0.86, 0.92), (0.4, 0.05)]],
    "8": [[(0.5, 0.53), (0.26, 0.63), (0.26, 0.85), (0.5, 0.95), (0.74, 0.85), (0.74, 0.63), (0.5, 0.53), (0.2, 0.39), (0.2, 0.15),
           (0.5, 0.05), (0.8, 0.15), (0.8, 0.39), (0.5, 0.53)]],
}
DIGITS["9"] = [[(1 - x, 1 - y) for x, y in DIGITS["6"][0]]]


def digit_textures(out):
    """num-0..9.png: a bold white glyph, transparent outside (tint the material to recolour)."""
    import numpy as np
    d = os.path.join(out, "numbers")
    os.makedirs(d, exist_ok=True)
    W, H = 128, 160
    ys, xs = np.mgrid[0:H, 0:W]
    px = (xs + 0.5) / W * 1.25 - 0.125                      # glyph box with margin for the outline
    py = 1.15 - (ys + 0.5) / H * 1.3
    def smooth(st):
        """Catmull-Rom through the stroke points: round curves, still passing every point."""
        if len(st) < 3:
            return st
        closed = st[0] == st[-1]
        pts = st[:-1] if closed else st
        n, out_ = len(pts), []
        for k in range(n if closed else n - 1):
            g = lambda i: pts[i % n] if closed else pts[max(0, min(n - 1, i))]
            p0, p1, p2, p3 = g(k - 1), g(k), g(k + 1), g(k + 2)
            for q in range(8):
                u = q / 8
                out_.append(tuple(0.5 * (2 * b_ + (-a_ + c_) * u + (2 * a_ - 5 * b_ + 4 * c_ - d_) * u * u
                                         + (-a_ + 3 * b_ - 3 * c_ + d_) * u ** 3) for a_, b_, c_, d_ in zip(p0, p1, p2, p3)))
        out_.append(pts[0] if closed else pts[-1])
        return out_
    for ch, strokes in DIGITS.items():
        dist = np.full((H, W), 9.0)
        for st in [smooth(st) if ch not in "147" else st for st in strokes]:
            for (x0, y0), (x1, y1) in zip(st, st[1:]):
                vx, vy = x1 - x0, y1 - y0
                L = vx * vx + vy * vy or 1e-9
                tt = np.clip(((px - x0) * vx + (py - y0) * vy) / L, 0, 1)
                dist = np.minimum(dist, np.hypot(px - (x0 + tt * vx), py - (y0 + tt * vy)))
        aa = 1.25 / W
        fill = np.clip((0.135 - dist) / aa + 0.5, 0, 1)        # bold, solid strokes: no outline (it muddied small numbers)
        rgb = np.ones((H, W, 3))
        rgba = np.concatenate([rgb, fill[..., None]], axis=2)[::-1].astype(np.float32)
        img = bpy.data.images.new(f"num-{ch}", W, H, alpha=True)
        img.pixels.foreach_set(rgba.ravel())
        img.filepath_raw = os.path.join(d, f"num-{ch}.png")
        img.file_format = "PNG"
        img.save()
    print("WROTE numbers/num-0..9.png")


def number_plate(digits, surface, out):
    """Plates that follow the chest of `surface`: one slot (num) or two (numL, numR)."""
    kit_fig(items=NUM_SURFACES[surface])
    bake_meshes()
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o.name.split(".")[0] not in ("hands", "arms", "legs", "feet", "seam", "string"):
            tmp = bmesh.new()
            tmp.from_mesh(o.evaluated_get(dg).data)
            tmp.transform(o.matrix_world)
            m = bpy.data.meshes.new("t")
            tmp.to_mesh(m)
            tmp.free()
            bm.from_mesh(m)
            bpy.data.meshes.remove(m)
    tree = BVHTree.FromBMesh(bm)
    J = joints()
    zc = J["_z0"] + NUM_Z * BODIES["boxy-tall"]["h"]
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o)
    tex = os.path.join(out, "numbers", "num-0.png")
    slots = [("num", 0.0)] if digits == 1 else [("numL", -NUM_GAP / 2), ("numR", NUM_GAP / 2)]
    mats = {}
    for side in (-1, 1):                                   # -1 front, +1 back
        for name, xc in slots:
            xc_ = xc if side < 0 else -xc                      # from behind, the first digit is on the bean's left (+x)
            nx, nz = 8, 12
            pb = bmesh.new()
            uv = pb.loops.layers.uv.new("UVMap")
            grid = []
            for j_ in range(nz + 1):
                row = []
                for i_ in range(nx + 1):
                    u, v = i_ / nx, j_ / nz
                    x = xc_ + (u - 0.5) * NUM_W * (1 if side < 0 else -1)   # mirrored on the back: reads left to right
                    z = zc + (v - 0.5) * NUM_H
                    hit = tree.ray_cast(Vector((x, 5 * side, z)), Vector((0, -side, 0)))
                    lift = 0.012 if name != "numR" else 0.014
                    p_ = hit[0] + hit[1] * lift if hit[0] is not None else Vector((x, 0.4 * side, z))
                    row.append((pb.verts.new(p_), (u, v)))
                grid.append(row)
            for j_ in range(nz):
                for i_ in range(nx):
                    q = [grid[j_][i_], grid[j_][i_ + 1], grid[j_ + 1][i_ + 1], grid[j_ + 1][i_]]
                    if side > 0:
                        q = q[::-1]                            # keep the faces pointing outward
                    f = pb.faces.new([a for a, _ in q])
                    f.smooth = True
                    for l, (_, (u, v)) in zip(f.loops, q):
                        l[uv].uv = (u, v)
            mname = name + ("" if side < 0 else "-back")
            me = bpy.data.meshes.new(mname)
            pb.to_mesh(me)
            pb.free()
            if name not in mats:                               # one material per slot: front and back show the same digit
                m = bpy.data.materials.new(name)
                m.use_nodes = True
                nt = m.node_tree
                b = nt.nodes["Principled BSDF"]
                t = nt.nodes.new("ShaderNodeTexImage")
                t.image = bpy.data.images.load(tex)
                nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
                nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
                b.inputs["Roughness"].default_value = 0.6
                for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "CLIP")):
                    try:
                        setattr(m, attr, val)
                    except Exception:
                        pass
                mats[name] = m
            me.materials.append(mats[name])
            ob = bpy.data.objects.new(mname, me)
            bpy.context.scene.collection.objects.link(ob)
    bm.free()


def part(name, out):
    gl = os.path.join(out, "glb")
    os.makedirs(gl, exist_ok=True)
    f = os.path.join(gl, f"{name}.glb")
    if name == "base":
        rig, meshes, J = rigged(lambda: kit_fig(), lambda n: n in BASE_NAMES)
    elif name.startswith("face-"):
        rig, meshes, J = rigged(lambda: kit_fig(face=name[5:]), lambda n: n in FACE_NAMES)
    elif name == "screen":
        rig, meshes, J = rigged(lambda: kit_fig(screen=True), lambda n: n in SCREEN_NAMES)
    elif name.startswith("num-"):
        _, digits, surface = name.split("-")
        if not os.path.exists(os.path.join(out, "numbers", "num-9.png")):
            digit_textures(out)
        def build():
            bpy.ops.wm.read_factory_settings(use_empty=True)
            number_plate(int(digits), surface, out)
        rig, meshes, J = rigged(build, lambda n: n.startswith("num"))
    elif name.startswith("prop-"):
        def build():
            bpy.ops.wm.read_factory_settings(use_empty=True)
            weapon(name[5:], joints())
        rig, meshes, J = rigged(build, lambda n: n.startswith("prop"))
    else:
        slot, kind = name.split("-", 1)
        screen = kind.endswith("-screen")
        kind = kind[:-7] if screen else kind
        rig, meshes, J = rigged(lambda: kit_fig(screen=screen, items=[kind]),
                                lambda n: n not in BASE_NAMES + FACE_NAMES + SCREEN_NAMES)
    if name == "base":
        add_ground_proxy(rig, J)
        meta = bake_clips(rig, J)
        export(f, [rig] + meshes, animations=True)
        with open(os.path.join(out, "clips.json"), "w") as fh:
            json.dump(meta, fh, indent=1)
        print("WROTE clips.json", len(meta), "clips")
    else:
        export(f, [rig] + meshes)


def review_scene(names, gun="blaster"):
    rig, meshes, J = rigged(lambda: (kit_fig(face="x", items=["tee"]), weapon(gun, joints())), lambda n: True)
    add_ground_proxy(rig, J)
    bake_clips(rig, J, names)
    return rig, meshes, J


def review_stage():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_shadows = True
    sc.render.resolution_x, sc.render.resolution_y = 300, 340
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.color = (0.55, 0.55, 0.53)
    bpy.ops.mesh.primitive_plane_add(size=200)
    grid = bpy.context.object
    gm = bpy.data.materials.new("floor")
    gm.diffuse_color = (0.42, 0.42, 0.4, 1)
    grid.data.materials.append(gm)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 50
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc, cam


def weapon_sheet(out, kinds, clip="aim", frame=12):
    """Every weapon held in a pose, from the 3/4 front, the side and the back 3/4: <out>/weapon-<kind>-<view>.png."""
    os.makedirs(out, exist_ok=True)
    views = {"34": Vector((2.0, -2.6, 0.5)), "side": Vector((3.2, 0.3, 0.3)), "back": Vector((-1.6, 2.6, 0.9))}
    for kind in kinds:
        rig, meshes, J = review_scene(["aim", "shoot", "shoot-auto", "run-aim", "walk-aim", "reload"], kind)
        sc, cam = review_stage()
        sc.render.resolution_x, sc.render.resolution_y = 420, 420
        rig.animation_data.action = bpy.data.actions[clip]
        sc.frame_set(frame)
        g = rig.matrix_world @ rig.pose.bones["grip.R"].head
        hip = rig.matrix_world @ rig.pose.bones["hips"].head
        tgt = Vector(((g.x + hip.x) / 2, (g.y + hip.y) / 2 - 0.1, g.z - 0.1))
        for vname, off in views.items():
            cam.location = tgt + off
            cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(out, f"weapon-{kind}-{vname}.png")
            bpy.ops.render.render(write_still=True)
        print("WEAPON", kind, "inside body", weapon_inside(rig, meshes))
        tris = sum(len(p.vertices) - 2 for o in meshes if o.name.startswith("prop") for p in o.data.polygons)
        print("WEAPON", kind, "tris", tris)


def weapon_inside(rig, meshes, clips=("aim", "shoot", "shoot-auto", "run-aim", "walk-aim", "reload")):
    """Worst share of a weapon's vertices inside the body (or the head above it) over the shooter clips."""
    from mathutils.bvhtree import BVHTree
    sc, dg = bpy.context.scene, bpy.context.evaluated_depsgraph_get()
    body = [o for o in meshes if o.name.split(".")[0] == "body"][0]
    props = [o for o in meshes if o.name.startswith("prop")]
    worst = (0.0, "", 0)
    for name in clips:
        if name not in bpy.data.actions:
            continue
        rig.animation_data.action = bpy.data.actions[name]
        for f in range(0, int(bpy.data.actions[name].frame_range[1]) + 1, 3):
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            be = body.evaluated_get(dg)
            tree = BVHTree.FromPolygons([body.matrix_world @ v.co for v in be.data.vertices], [p.vertices for p in be.data.polygons])
            n = inside = 0
            for o in props:
                for v in o.evaluated_get(dg).data.vertices:
                    p = o.matrix_world @ v.co
                    loc, nrm, _, _ = tree.find_nearest(p)
                    n += 1
                    inside += loc is not None and (p - loc).dot(nrm) < -0.01
            if inside / n > worst[0]:
                worst = (inside / n, name, f)
    return f"{worst[0]:.0%} ({worst[1]} f{worst[2]})"


def strips(out, names):
    rig, meshes, J = review_scene(names)
    sc, cam = review_stage()
    os.makedirs(out, exist_ok=True)
    views = {"34": Vector((2.1, -3.7, 0.7)), "side": Vector((4.4, 0.0, 0.35))}
    for name in names:
        act = bpy.data.actions[name]
        rig.animation_data.action = act
        n = int(act.frame_range[1])
        for vname, off in views.items():
            for k in range(8):
                f = round(n * k / 7) if not CLIPS[name]["loop"] else round(n * k / 8)
                sc.frame_set(f)
                hip = rig.matrix_world @ rig.pose.bones["hips"].head
                tgt = Vector((hip.x, hip.y, max(hip.z, 0.45) + 0.15))
                cam.location = tgt + off
                cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
                sc.render.filepath = os.path.join(out, f"{name}-{vname}-{k}.png")
                bpy.ops.render.render(write_still=True)
        print("STRIP", name)


def audit(names):
    """Numbers for every clip: floor penetration, hovering, foot skate, stance-speed error,
    hands / arms inside the body."""
    from mathutils.bvhtree import BVHTree
    rig, meshes, J = review_scene(names)
    body = [o for o in bpy.context.scene.objects if o.name.split(".")[0] == "body"][0]
    ground = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name.split(".")[0] in GROUND]
    sc = bpy.context.scene
    for name in names:
        c = CLIPS[name]
        act = bpy.data.actions[name]
        rig.animation_data.action = act
        n = int(act.frame_range[1])
        pen, hover, inside, prev_ank = 0.0, 0, 0, {}
        skate = {"L": 0.0, "R": 0.0}
        speed_err = []
        free = c["f"](0).is_free
        for f in range(n + 1):
            sc.frame_set(f)
            low = lowest(ground)
            pen = min(pen, low)
            p = c["f"](min(f / FPS, c["dur"]))
            if not p.is_free and p.air_h is None and low > 0.01:
                hover += 1
            dg = bpy.context.evaluated_depsgraph_get()
            eb = body.evaluated_get(dg)
            me = eb.to_mesh()
            bm = bmesh.new()
            bm.from_mesh(me)
            bm.transform(eb.matrix_world)
            tree = BVHTree.FromBMesh(bm)
            bm.free()
            eb.to_mesh_clear()
            for sd in ("L", "R"):
                g = rig.matrix_world @ rig.pose.bones[f"grip.{sd}"].head
                hits, o = 0, g.copy()
                for _ in range(4):
                    h = tree.ray_cast(o, Vector((0.0, 0.0, 1.0)))
                    if h[0] is None:
                        break
                    hits += 1
                    o = h[0] + Vector((0, 0, 1e-4))
                if hits % 2 == 1:
                    inside += 1
                ank = rig.matrix_world @ rig.pose.bones[f"foot.{sd}"].head
                if sd in prev_ank and ank.z < 0.13 and prev_ank[sd].z < 0.13:
                    d = (ank.xy - prev_ank[sd].xy)
                    if c.get("speed"):
                        speed_err.append(abs(d.length * FPS - abs(c["speed"])))
                    else:
                        skate[sd] += d.length
                prev_ank[sd] = ank
        se = (sum(speed_err) / len(speed_err)) if speed_err else 0.0
        print(f"AUDIT {name:20s} pen {pen:+.3f}  hover {hover:3d}  skate {max(skate.values()):.3f}  "
              f"speed_err {se:.2f}  hand_in_body {inside:3d}  free {free}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    out = os.path.abspath(argv[0])
    globals()["OUT"] = out
    _g["OUT"] = out
    os.makedirs(out, exist_ok=True)
    mode, rest = argv[1], argv[2:]
    if mode == "parts":
        for p in rest or (all_parts() + [f"prop-{w}" for w in WEAPONS] + [f"num-{d}-{s_}" for d in (1, 2) for s_ in NUM_SURFACES]):
            part(p, out)
    elif mode == "anim":
        part("base", out)
    elif mode == "strips":
        strips(os.path.join(out, "strips"), rest or list(CLIPS))
    elif mode == "weapons":
        weapon_sheet(os.path.join(out, "weapons"), rest or WEAPONS)
    elif mode == "audit":
        audit(rest or list(CLIPS))
    elif mode == "list":
        nums = " ".join(f"num-{d}-{s_}" for d in (1, 2) for s_ in NUM_SURFACES)
        print("PARTS", " ".join(p for p in all_parts() if p != "base") + " " + " ".join(f"prop-{w}" for w in WEAPONS) + " " + nums)
        print("CLIPS", " ".join(CLIPS))


main()
