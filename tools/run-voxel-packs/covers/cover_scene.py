"""A pack cover scene, assembled from the pack's own staged GLBs.

    Blender -b --factory-startup --python covers/cover_scene.py -- <spec.json> <out.png>

The spec (see covers/specs.py) lists rows of models from front to back. Each row is
laid out left to right at its true scale, centred, with the front row nearest the
camera. A model can be posed at a frame of one of its clips. The camera is a low 3/4
view that frames everything with room at the bottom for the logo; the background is
transparent so the compositor paints the sky.
"""
from __future__ import annotations

import json
import math
import sys

import bpy
from mathutils import Vector

spec_path, out_path = sys.argv[sys.argv.index("--") + 1:][:2]
spec = json.load(open(spec_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = spec.get("size", 1024)
scene.render.film_transparent = True
# Standard keeps the voxel palette true (AgX greyed it out); moderate light, no contrast look.
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
for attr, value in (("use_gtao", True), ("use_fast_gi", True), ("fast_gi_method", "GLOBAL_ILLUMINATION")):
    try:  # soft contact shadows where models meet the ground (names differ across EEVEE versions)
        setattr(scene.eevee, attr, value)
    except (AttributeError, TypeError):
        pass
try:
    scene.eevee.taa_render_samples = 48
    scene.eevee.use_shadows = True
except AttributeError:
    pass


def import_model(path: str):
    """Import one GLB under a new empty and return (empty, meshes). Parts rest in their
    bind pose: the importer's active actions are cleared and the clip tracks muted."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.name in scene.objects]
    # the importer also makes a bone-display shape per rig (a 2 m icosphere): drop it, or it
    # counts toward the model's size and shows in the render
    shapes = {pb.custom_shape.name for o in new if o.type == "ARMATURE" for pb in o.pose.bones if pb.custom_shape}
    new = [o for o in new if o.name not in shapes]
    for name in shapes:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    holder = bpy.data.objects.new("holder", None)
    scene.collection.objects.link(holder)
    for o in new:
        if o.parent is None:
            o.parent = holder
    return holder, new


def pose(objs, clip: str, t: float) -> None:
    """Freeze every part at time t of the named clip (or at rest when clip is empty)."""
    frame = round(t * 30)
    keep = {}
    for o in objs:
        ad = o.animation_data
        if not ad:
            continue
        ad.action = None
        for track in ad.nla_tracks:
            track.mute = True
            if clip:
                for strip in track.strips:
                    if strip.action and strip.action.name.split(".")[0] == clip:
                        ad.action = strip.action
                        ad.action_slot = strip.action_slot
    if clip:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        keep = {o: o.matrix_basis.copy() for o in objs}
    for o in objs:
        if o.animation_data:
            o.animation_data.action = None
    if clip:
        for o, m in keep.items():
            o.matrix_basis = m
    scene.frame_set(0) if not clip else None


def relax_arms(objs, angle: float) -> None:
    """Swing a T-posed rig's upper arms down toward its sides (avatars rest in a T-pose)."""
    from mathutils import Matrix
    for o in objs:
        if o.type != "ARMATURE":
            continue
        for name in ("Arm.L", "Arm.R"):
            pb = o.pose.bones.get(name)
            if pb is None:
                continue
            d = (pb.tail - pb.head).normalized()
            axis = d.cross(Vector((0, 0, -1)))
            if axis.length < 1e-6:
                continue
            r = Matrix.Translation(pb.head) @ Matrix.Rotation(math.radians(angle), 4, axis.normalized()) @ Matrix.Translation(-pb.head)
            pb.matrix = r @ pb.matrix
    bpy.context.view_layer.update()


def bounds(objs):
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


# Rows: front first. Blender +Y is the models' front (glTF -Z), so the camera sits at +Y and
# the front row is laid out at the largest Y.
placed, framed = [], []  # framed: the rows the camera fits; the others (buildings) may crop
y = 0.0
for r, row in enumerate(spec["rows"]):
    items = []
    for item in row["items"]:
        holder, objs = import_model(item["path"])
        pose(objs, item.get("clip", ""), item.get("t", 0.0))
        if item.get("arms"):
            relax_arms(objs, item["arms"])
        holder.scale = (item.get("scale", 1.0),) * 3
        holder.rotation_euler = (0, 0, math.radians(item.get("turn", 0.0)))
        lo, hi = bounds(objs)
        if "height" in item:  # size to a height in metres (models of different categories differ wildly)
            holder.scale = (item["height"] / max(1e-6, hi.z - lo.z),) * 3
            lo, hi = bounds(objs)
        items.append((holder, objs, lo, hi, item))
    widths = [hi.x - lo.x for _, _, lo, hi, _ in items]
    gap = row.get("gap", 0.4)
    if "gap_widths" in row:  # a gap measured in the row's own mean model width (packs use different units)
        gap = row["gap_widths"] * sum(widths) / len(widths)
    total = sum(widths) + gap * (len(items) - 1)
    depth = max(hi.y - lo.y for _, _, lo, hi, _ in items)
    x = -total / 2 + row.get("shift", 0.0)  # a sideways shift, so a row can stand in the gaps of the one in front
    row_y = y - depth / 2
    for k, ((holder, objs, lo, hi, item), w) in enumerate(zip(items, widths)):
        cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
        stagger = row.get("stagger", 0.0) * (1 if k % 2 else -1)  # a zigzag in depth, not a lineup
        holder.location.x += x + w / 2 - cx + item.get("dx", 0.0)
        holder.location.y += row_y - cy + item.get("dy", 0.0) + stagger
        holder.location.z += -lo.z + item.get("dz", 0.0)  # stand on the ground
        x += w + gap
        placed.extend(objs)
        if row.get("frame", True):
            framed.extend(objs)
    y -= depth + row.get("behind", 0.3)

# Ground: a broad plane in the theme colour.
lo, hi = bounds(placed)
size = max(hi.x - lo.x, hi.y - lo.y) * 12
bpy.ops.mesh.primitive_plane_add(size=size, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0))
ground = bpy.context.active_object
mat = bpy.data.materials.new("ground")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (*spec["ground"], 1.0)
bsdf.inputs["Roughness"].default_value = 1.0
# The ground fades out with distance from the models, so it melts into the painted sky
# instead of ending on a hard horizon line.
nodes, links = mat.node_tree.nodes, mat.node_tree.links
coord = nodes.new("ShaderNodeTexCoord")
length = nodes.new("ShaderNodeVectorMath")
length.operation = "LENGTH"
fade = nodes.new("ShaderNodeMapRange")
reach = max(hi.x - lo.x, hi.y - lo.y)
fade.inputs["From Min"].default_value = reach * spec.get("fade_from", 0.9)
fade.inputs["From Max"].default_value = reach * spec.get("fade_to", 2.2)
fade.inputs["To Min"].default_value, fade.inputs["To Max"].default_value = 1.0, 0.0
links.new(coord.outputs["Object"], length.inputs[0])
links.new(length.outputs["Value"], fade.inputs["Value"])
links.new(fade.outputs["Result"], bsdf.inputs["Alpha"])
ground.data.materials.append(mat)

# Light: a low warm key from the front-left (long, soft shadows that model the voxels),
# a cool sky fill, and a cool rim from behind so silhouettes separate from the town.
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (*spec.get("fill", (0.62, 0.72, 1.0)), 1.0)
bg.inputs["Strength"].default_value = spec.get("fill_strength", 0.4)
sun = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
sun.data.energy = spec.get("key_strength", 5.2)
sun.data.color = spec.get("key", (1.0, 0.84, 0.64))
sun.data.angle = math.radians(14)
sun.rotation_euler = (math.radians(spec.get("key_tilt", 63)), 0, math.radians(spec.get("key_turn", -122)))  # from the front-left (a sun points down its local -Z)
scene.collection.objects.link(sun)
rim = bpy.data.objects.new("rim", bpy.data.lights.new("rim", "SUN"))
rim.data.energy = spec.get("rim_strength", 3.0)
rim.data.color = spec.get("rim", (0.7, 0.82, 1.0))
rim.data.angle = math.radians(10)
rim.rotation_euler = (math.radians(65), 0, math.radians(25))  # from behind-right
scene.collection.objects.link(rim)

# Camera: a low 3/4 from the front, fitted so the models fill the frame above the logo band.
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = spec.get("lens", 50)
cam.data.clip_start, cam.data.clip_end = 0.05, 1e6
lo, hi = bounds(framed)
centre = (lo + hi) / 2
yaw = math.radians(spec.get("yaw", 20))
pitch = math.radians(spec.get("pitch", 14))
d = Vector((math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
logo = spec.get("logo_band", 0.26)  # share of the frame height kept for the logo at the bottom
target = centre.copy()
dist = (hi - lo).length * 2
for _ in range(6):  # fit: push the camera until every corner lands inside the frame above the band
    cam.location = target + d * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    from bpy_extras.object_utils import world_to_camera_view
    xs, ys = [], []
    for o in framed:
        if o.type != "MESH":
            continue
        mw = o.matrix_world
        for v in list(o.data.vertices)[:: max(1, len(o.data.vertices) // 200)]:
            p = world_to_camera_view(scene, cam, mw @ v.co)
            xs.append(p.x)
            ys.append(p.y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # Want x in [m, 1-m] and y in [logo*0.55, 1-m] (the content may run a little under the logo).
    m = spec.get("margin", 0.03)
    bottom = spec.get("bottom", logo * 0.3)  # where the lowest feet land: may tuck under the logo's word
    want_w, want_h = spec.get("overflow", 1.2) * (1 - 2 * m), 1 - m - bottom  # the sides may crop: a cover, not a catalogue
    k = max((x1 - x0) / want_w, (y1 - y0) / want_h)
    dist *= k
    # shift the aim so the content box sits where we want it
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    want_cy = (bottom + 1 - m) / 2
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
    span = 2 * dist * math.tan(cam.data.angle / 2)
    if spec.get("align") == "feet":
        # pin the lowest feet to `bottom` (e.g. tucked under the logo's word) even when the
        # width decides the zoom: the group then fills upward instead of floating in the middle
        y0_after = 0.5 + (y0 - 0.5) / k
        target += right * (cx - 0.5) * span * k + up * (y0_after - bottom) * span * k
    else:
        target += right * (cx - 0.5) * span * k + up * (cy - want_cy) * span * k
cam.location = target + d * dist
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()

scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
print("wrote", out_path)
