"""Shared Workbench render + contact sheet for the dev review tools
(snapshot.py, avatar_sheet.py). Not used by pack builds."""
from __future__ import annotations

import json
import math
import re
import struct

import bpy
from mathutils import Quaternion, Vector

WORLD_VIEW = Vector((math.sin(math.radians(35)), math.cos(math.radians(35)), 0.75)).normalized()  # glTF -Z front
RIG_VIEW = Vector((math.cos(math.radians(35)), -math.sin(math.radians(35)), 0.6)).normalized()  # glTF +X front


def gltf_rest_pose(path: str, objects) -> None:
    """Put imported node objects back in the file's rest TRS.

    The importer poses every object with the first clip, and clearing the
    action keeps that pose. Converts glTF Y-up to Blender Z-up as the importer
    does. Blender adds ".001" to names that already exist; that suffix is ignored."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:4] != b"glTF":
        raise ValueError(f"{path} is not a GLB")
    length = struct.unpack_from("<I", data, 12)[0]
    nodes = json.loads(data[20:20 + length]).get("nodes", [])
    by_name = {n["name"]: n for n in nodes if "name" in n}
    for obj in objects:
        node = by_name.get(re.sub(r"\.\d{3}$", "", obj.name))
        if node is None or "matrix" in node:
            continue
        t = node.get("translation", [0, 0, 0])
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        sc = node.get("scale", [1, 1, 1])
        if obj.animation_data:
            obj.animation_data.action = None
            for track in obj.animation_data.nla_tracks:
                track.mute = True
        obj.location = (t[0], -t[2], t[1])
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = Quaternion((w, x, -z, y))
        obj.scale = (sc[0], sc[2], sc[1])


def show_base_color() -> None:
    """Workbench 'Texture' colour draws each material's active image node.
    PN mecha files also carry an emissive texture on UV 1, which then renders
    black; make the base-colour image the active node everywhere."""
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf is None:
            continue
        stack = [link.from_node for link in bsdf.inputs["Base Color"].links]
        while stack:
            node = stack.pop()
            if node.type == "TEX_IMAGE":
                mat.node_tree.nodes.active = node
                break
            stack.extend(link.from_node for inp in node.inputs for link in inp.links)


def visible_meshes(scene):
    shapes = {pb.custom_shape for o in scene.objects if o.type == "ARMATURE" for pb in o.pose.bones if pb.custom_shape}
    for o in scene.objects:
        if o in shapes:
            o.hide_render = True
    return [o for o in scene.objects if o.type == "MESH" and o not in shapes and not o.hide_render]


def render_scene(png: str, size: int, direction: Vector) -> None:
    scene = bpy.context.scene
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in visible_meshes(scene):
        ev = o.evaluated_get(deps)
        m = ev.to_mesh()
        pts.extend(ev.matrix_world @ v.co for v in m.vertices)
        ev.to_mesh_clear()
    if not pts:
        raise RuntimeError("nothing visible to render")
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, radius = (lo + hi) / 2, max((hi - lo).length / 2, 1e-4)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = radius * 2.3
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = centre + direction * radius * 4
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = radius * 20
    scene.camera = cam
    show_base_color()
    scene.render.engine = "BLENDER_WORKBENCH"
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "TEXTURE"
    shading.show_shadows = True
    shading.show_cavity = False
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.06, 0.08, 0.11)
    scene.render.filepath = png
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def compose_sheet(pngs: list[str], out: str, size: int, cols: int = 4) -> None:
    cols = min(cols, len(pngs))
    rows = math.ceil(len(pngs) / cols)
    sheet = bpy.data.images.new("sheet", cols * size, rows * size)
    pixels = [0.0] * (cols * size * rows * size * 4)
    for i, png in enumerate(pngs):
        img = bpy.data.images.load(png)
        src = list(img.pixels)
        c, r = i % cols, rows - 1 - i // cols
        for y in range(size):
            row0 = ((r * size + y) * cols * size + c * size) * 4
            pixels[row0 : row0 + size * 4] = src[y * size * 4 : (y + 1) * size * 4]
    sheet.pixels.foreach_set(pixels)
    sheet.filepath_raw = out
    sheet.file_format = "PNG"
    sheet.save()
