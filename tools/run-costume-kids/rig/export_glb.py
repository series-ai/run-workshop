"""Bake the toy clips into one GLB per character for the web previewer.

Uses toyanim.py's rig (build_rig) and clips unchanged: every part is an empty,
the pieces hang off the empties, and each clip becomes one glTF animation
(one NLA track per part, merged by name on export). Materials drawn in SKIN
are renamed "SKIN" so the previewer can swap skin tones.

    Blender -b --factory-startup --python export_glb.py -- <out dir> [<slug> ...]   (no slugs: all)
"""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), ".."))  # tools/run-costume-kids
import sys

ARGS = sys.argv[sys.argv.index("--") + 1:]
PARTS_MODE = "--parts" in ARGS  # the old export: one node per piece (for debugging); default is packed
ARGS = [a for a in ARGS if a != "--parts"]
OUT_DIR, ONLY = ARGS[0], ARGS[1:]
sys.argv = [sys.argv[0], "--", _PKG + "/rig/glb-scratch", "x"]
_src = open(_PKG + "/rig/toyanim.py").read().split("\nfor slug in SLUGS:")[0]
exec(compile(_src, "toyanim.py", "exec"))

import json  # noqa: E402
import os  # noqa: E402

FPS = 30
os.makedirs(OUT_DIR, exist_ok=True)


def pose_loop(parts, rest, clip, t, period):
    """toyanim.pose, with the prop lag wrapped around the loop so every clip closes."""
    p = clip(t)
    lag = clip(max(0.0, t - 0.12)) if clip.__name__ in ONESHOT else clip((t - 0.12) % period)
    for side in ("l", "r"):
        ar = lag.get(f"arm.{side}", ((0, 0, 0), (0, 0, 0), None))[1]
        now = p.get(f"arm.{side}", ((0, 0, 0), (0, 0, 0), None))[1]
        c = PROP_CANCEL[side]
        # forward/back: a tall prop leans with the arm (c < 1); sideways: every prop stays upright,
        # so nothing tips in toward the head when the arms fling out
        p[f"prop.{side}"] = ((0, 0, 0), (-c * ar[0] + 0.25 * (ar[0] - now[0]), -0.92 * now[1], 0), None)
    if WINDOW["on"]:
        p.pop("head", None)
        p.pop("chest", None)
    for name, e in parts.items():
        if name.startswith("expr.") or name == "bucket":
            continue
        loc, rot, scl = p.get(name, ((0, 0, 0), (0, 0, 0), None))
        e.location = rest[name] + Vector(loc)
        e.rotation_euler = Euler((R(rot[0]), R(rot[1]), R(rot[2])), "XYZ")
        e.scale = scl or (1, 1, 1)
    apply_face(parts, p)


GROUND = -0.02  # how far below the floor a piece may dip


def floor_guard_lying(parts):
    """The floor guard for a body lying down (death): its parts' own axes no longer point up, so
    nothing is lifted part by part (that pulls the legs off sideways); the whole toy is raised just
    enough to rest on the floor."""
    bpy.context.view_layer.update()
    ms = [o for e in parts.values() for o in e.children_recursive if o.type == "MESH"]
    m = min((min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in ms if o.matrix_world.to_scale().length > 1e-3), default=0)
    if m < GROUND:
        parts["root"].location.z += GROUND - m


def floor_guard(parts):
    """After a pose, push everything that went through the floor back above it, using the real
    geometry: a sinking leg lifts, a floor-length costume makes the hips crouch less, low costume
    parts lift the whole toy a touch, an arm holding something swings out until it clears, a long
    beard or hair eases the head's nod."""
    def low(ms):
        bpy.context.view_layer.update()
        return min((min((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in ms), default=1e9)
    def own(*names):
        return [o for n in names for o in parts[n].children if o.type == "MESH"]
    def tree(name):
        return [o for o in parts[name].children_recursive if o.type == "MESH"]
    for side in ("l", "r"):
        foot = parts[f"foot.{side}"]
        for _ in range(8):  # a long shoe tipping its toe into the floor: flatten the foot first
            if low(tree(f"foot.{side}")) >= GROUND:
                break
            foot.rotation_euler = tuple(a * 0.7 for a in foot.rotation_euler)
        m = low(tree(f"leg.{side}"))
        if m < GROUND:
            parts[f"leg.{side}"].location.z += GROUND - m
    m = low(own("hips", "chest"))
    if m < GROUND:
        parts["hips"].location.z += GROUND - m
    m = low(own("root"))
    if m < GROUND:
        parts["root"].location.z += GROUND - m
    for side, sg in (("l", -1), ("r", 1)):
        arm = parts[f"arm.{side}"]
        for _ in range(26):
            if low(tree(f"arm.{side}")) >= GROUND:
                break
            arm.rotation_euler.y += sg * R(7)  # swing the arm out to the side, which lifts the hand
            parts[f"prop.{side}"].rotation_euler.y -= sg * R(7) * 0.92  # the held prop stays upright, as exported
    head = parts["head"]
    for _ in range(8):
        if low(tree("head")) >= GROUND:
            break
        head.rotation_euler = tuple(a * 0.7 for a in head.rotation_euler)  # long hair or a beard: ease the head
    m = low(tree("head"))
    if m < GROUND:  # still on the floor (hair to the ground, legs on a hood): crouch less
        parts["hips"].location.z += GROUND - m


SMOOTH = 4  # frames: corrections ease in and out over about a quarter second
CHANNELS = ("leg.l", "leg.r", "hips", "root")  # location z lifts


def _smooth(vals, loop=True):
    """Max-filter then box-blur (round the loop, or clamped at the ends of a one-shot): smooth, and
    never below the raw value."""
    n, r = len(vals), SMOOTH
    at = (lambda i: vals[i % n]) if loop else (lambda i: vals[min(max(i, 0), n - 1)])
    mx = [max(at(i + d) for d in range(-r, r + 1)) for i in range(n)]
    at2 = (lambda i: mx[i % n]) if loop else (lambda i: mx[min(max(i, 0), n - 1)])
    return [sum(at2(i + d) for d in range(-r, r + 1)) / (2 * r + 1) for i in range(n)]


def guard_plan(parts, rest, clip, period, n):
    """The floor guard's corrections for a whole loop, smoothed. Per frame, floor_guard says how
    far each part has to lift, how far each arm has to swing out and how much the head has to
    ease; applied frame by frame those switch on and off and the arms twitch. Here they are
    gathered over the loop first and eased in and out, never below what each frame needs."""
    raw = []
    loop = clip.__name__ not in ONESHOT
    for k in range(n if loop else n + 1):  # a one-shot also has its last frame (it doesn't wrap)
        pose_loop(parts, rest, clip, period * k / n, period)
        before = {nm: (parts[nm].location.z, tuple(parts[nm].rotation_euler)) for nm in parts}
        (floor_guard_lying if clip.__name__ in ONESHOT else floor_guard)(parts)
        d = {nm: parts[nm].location.z - before[nm][0] for nm in CHANNELS}
        for side in ("l", "r"):
            d["arm." + side] = abs(parts["arm." + side].rotation_euler.y - before["arm." + side][1][1])
        for nm in ("head", "foot.l", "foot.r"):  # how much each had to ease its rotation (0 none, 1 flat)
            hb = Vector(before[nm][1]).length
            d[nm] = 1 - Vector(tuple(parts[nm].rotation_euler)).length / hb if hb > 1e-6 else 0.0
        raw.append(d)
    keys = list(raw[0])
    sm = {key: _smooth([f[key] for f in raw], loop) for key in keys}
    return [{key: sm[key][k] for key in keys} for k in range(len(raw))]


def pose_guarded(parts, rest, clip, period, k, n, plan):
    """Frame k of a loop of n, with the smoothed floor corrections."""
    pose_loop(parts, rest, clip, period * k / n, period)
    d = plan[k]
    for nm in CHANNELS:
        parts[nm].location.z += d[nm]
    parts["arm.l"].rotation_euler.y -= d["arm.l"]  # out to the kid's left
    parts["arm.r"].rotation_euler.y += d["arm.r"]
    parts["prop.l"].rotation_euler.y += 0.92 * d["arm.l"]  # a held prop stays upright as the arm swings out
    parts["prop.r"].rotation_euler.y -= 0.92 * d["arm.r"]
    for nm in ("head", "foot.l", "foot.r"):
        parts[nm].rotation_euler = tuple(a * (1 - d[nm]) for a in parts[nm].rotation_euler)


def hide_rest_expressions(path):
    """Post-process the written GLB: every expression switch but the resting one (FACE_REST) gets
    a rest scale of zero, so a model shown without an animation wears one face; and the bucket
    switch loses its (constant) animation tracks, so a game can hide the bucket."""
    import struct
    data = open(path, "rb").read()
    n = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + n])
    shown = {f"expr.{k}.{v}" for k, v in FACE_REST.items() if v}
    for node in doc.get("nodes", []):
        if node.get("name", "").startswith("expr.") and node["name"] not in shown:
            node["scale"] = [0.0, 0.0, 0.0]
    # the bucket switch isn't animated: drop its tracks so a game's "hide the bucket" (scale 0) sticks
    bucket = {i for i, node in enumerate(doc.get("nodes", [])) if node.get("name") == "bucket"}
    for an in doc.get("animations", []):
        keep = [c for c in an["channels"] if c["target"].get("node") not in bucket]
        used = sorted({c["sampler"] for c in keep})
        remap = {old: new for new, old in enumerate(used)}
        an["samplers"] = [an["samplers"][i] for i in used]
        for c in keep:
            c["sampler"] = remap[c["sampler"]]
        an["channels"] = keep
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    rest = data[20 + n:]
    body = struct.pack("<II", len(js), 0x4E4F534A) + js + rest
    open(path, "wb").write(struct.pack("<III", 0x46546C67, 2, 12 + len(body)) + body)


def export(slug):
    parts, rest = build_rig(slug)
    scene = bpy.context.scene
    scene.render.fps = FPS
    for e in parts.values():
        e.animation_data_create()
    for label, clip, period, _ in CLIPS:
        n = max(2, round(period * FPS))
        plan = guard_plan(parts, rest, clip, period, n)
        for k in range(n + 1):  # a loop's last key repeats the first; a one-shot ends on its own pose
            pose_guarded(parts, rest, clip, period, k if clip.__name__ in ONESHOT else k % n, n, plan)
            for e in parts.values():
                for path in ("location", "rotation_euler", "scale"):
                    e.keyframe_insert(path, frame=k)
        for e in parts.values():
            act = e.animation_data.action
            act.name = f"{label}.{e.name}"
            track = e.animation_data.nla_tracks.new()
            track.name = label
            strip = track.strips.new(label, 0, act)
            strip.extrapolation = "NOTHING"  # no clip holds its pose into another clip's frames (a frame-0 flash)
            e.animation_data.action = None
    for e in parts.values():  # the clips are read from the tracks; the static pose comes from
        for tr in e.animation_data.nla_tracks:  # the objects, so no track may play over it
            tr.mute = True
    for e in parts.values():  # rest pose, every expression switch at full scale: the exporter
        e.location, e.rotation_euler, e.scale = rest[e.name], (0, 0, 0), (1, 1, 1)  # places each
    # child relative to its parent's rest transform, so a switch must not be at zero here; the
    # hidden ones are set to zero in the file afterwards (hide_rest_expressions)
    skin = tuple(round(c, 3) for c in B.SKIN)
    for m in bpy.data.materials:
        if tuple(round(c, 3) for c in m.diffuse_color[:3]) == skin:
            m.name = "SKIN"
    bpy.ops.object.select_all(action="SELECT")
    path = os.path.join(OUT_DIR, f"{slug}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                              export_lights=False, export_cameras=False)
    hide_rest_expressions(path)
    return path


def _bake_mesh(o):
    """Apply an object's modifiers (bevels) into its mesh, so pieces can be joined."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me


def skeleton(parts, rest):
    """One bone per part, at the part's pivot, pointing +y with no roll, so a bone's frame is the
    world's and its pose matrix is just the part's world matrix. Leaves every part at rest (every
    switch at full scale: the bind pose). Returns the armature and the bone order (parents first)."""
    scene = bpy.context.scene
    order = []
    def walk(e):
        order.append(e.name)
        for c in e.children:
            if c.name in parts:
                walk(c)
    walk(parts["root"])
    for e in parts.values():
        e.location, e.rotation_euler, e.scale = rest[e.name], (0, 0, 0), (1, 1, 1)
    bpy.context.view_layer.update()
    arm_data = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    for o in scene.objects:
        o.select_set(o is arm)
    bpy.ops.object.mode_set(mode="EDIT")
    for name in order:
        e = parts[name]
        b = arm_data.edit_bones.new(name)
        h = e.matrix_world.translation.copy()
        b.head, b.tail, b.roll = h, h + Vector((0, 0.25, 0)), 0.0
        if e.parent is not None and e.parent.name in parts:
            b.parent = arm_data.edit_bones[e.parent.name]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, order


def kit_material(name, rgb=(1, 1, 1), vertex_colours=True):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.9
    bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1)
    if vertex_colours:
        vc = m.node_tree.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        m.node_tree.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def pack(pieces, arm, name, paint):
    """Bake `pieces` ({mesh: bone}) into one mesh skinned rigidly to `arm`, every piece weighted 100%
    to its bone. paint(object) -> (linear rgba for its vertices, material, extra) decides each
    piece's colour; extra(o) may add more per-piece data before the join."""
    out = []
    for o, bone in pieces.items():
        mw = o.matrix_world.copy()
        _bake_mesh(o)
        o.parent = None
        o.matrix_world = mw
        rgba, m, extra = paint(o)
        attr = o.data.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for d in attr.data:
            d.color = rgba
        o.data.materials.clear()
        o.data.materials.append(m)
        if extra:
            extra(o)
        vg = o.vertex_groups.new(name=bone)
        vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        out.append(o)
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        o.select_set(o in out)
    bpy.context.view_layer.objects.active = out[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    body.parent = arm
    mod = body.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return body


def bake_clips(arm, parts, rest, order):
    """Pose the part rig through every clip (with the smoothed floor guard) and copy each part's
    world matrix onto its bone, frame by frame: one action and NLA track per clip."""
    bpy.context.scene.render.fps = FPS
    arm.animation_data_create()
    pbs = [arm.pose.bones[n] for n in order]
    keyed = [pb for pb in pbs if pb.name != "bucket"]  # the bucket switch is left to the game (scale 0 hides it)
    for label, clip, period, _ in CLIPS:
        n = max(2, round(period * FPS))
        plan = guard_plan(parts, rest, clip, period, n)
        act = bpy.data.actions.new(label)
        arm.animation_data.action = act
        for k in range(n + 1):
            pose_guarded(parts, rest, clip, period, k if clip.__name__ in ONESHOT else k % n, n, plan)
            bpy.context.view_layer.update()
            for pb in pbs:
                pb.matrix = parts[pb.name].matrix_world.copy()
                bpy.context.view_layer.update()
            for pb in keyed:
                pb.keyframe_insert("location", frame=k)
                pb.keyframe_insert("rotation_quaternion", frame=k)
                pb.keyframe_insert("scale", frame=k)
        track = arm.animation_data.nla_tracks.new()
        track.name = label
        strip = track.strips.new(label, 0, act)
        strip.extrapolation = "NOTHING"
        arm.animation_data.action = None
    for tr in arm.animation_data.nla_tracks:
        tr.mute = True
    for pb in pbs:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)


def export_skinned(arm, body, path, animations=True):
    for o in bpy.context.scene.objects:
        o.select_set(o in (arm, body))
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, use_selection=True, export_apply=False,
                              export_animations=animations, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                              export_skins=True, export_vertex_color="ACTIVE", export_all_vertex_colors=False,
                              export_lights=False, export_cameras=False)


def export_packed(slug):
    """The game-ready export: the whole kid as ONE skinned mesh on a 14-bone toy skeleton (plus
    the expression switches), every vertex pinned rigidly to its part's bone, colours in the
    vertices. Two draw calls per kid (the costume, and the skin so it can be retinted) instead of
    one per piece. The motion is the same rigid toy motion as the part export."""
    parts, rest = build_rig(slug)
    arm, order = skeleton(parts, rest)
    skin = tuple(round(c, 3) for c in B.SKIN)
    palette = kit_material("PALETTE")
    skin_mat = kit_material("SKIN", B.SKIN, vertex_colours=False)

    def paint(o):
        col = tuple(o.active_material.diffuse_color[:3]) if o.active_material else (1, 1, 1)
        if tuple(round(c, 3) for c in col) == skin:
            return (1.0, 1.0, 1.0, 1.0), skin_mat, None
        return (*[c ** 2.2 for c in col], 1.0), palette, None
    pieces = {o: name for name in order for o in parts[name].children if o.type == "MESH"}
    body = pack(pieces, arm, slug, paint)
    bake_clips(arm, parts, rest, order)
    path = os.path.join(OUT_DIR, f"{slug}.glb")
    export_skinned(arm, body, path)
    hide_rest_expressions(path)
    return path


def write_index():
    """chars/index.json: every exported character, in cast order (rewritten after each export)."""
    order = [s.strip() for s in open(_PKG + "/rig/slugs.txt") if s.strip()]
    have = {f[:-4] for f in os.listdir(OUT_DIR) if f.endswith(".glb")}
    json.dump([s for s in order if s in have], open(os.path.join(OUT_DIR, "index.json"), "w"))


slugs = ONLY or [s.strip() for s in open(_PKG + "/rig/slugs.txt") if s.strip()]
done = []
for slug in slugs:
    try:
        (export if PARTS_MODE else export_packed)(slug)
        done.append(slug)
        write_index()
        print("EXPORTED", slug, flush=True)
    except Exception as ex:  # keep going; report at the end
        print("FAILED", slug, repr(ex), flush=True)
write_index()
