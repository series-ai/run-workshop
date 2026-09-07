#!/usr/bin/env python3
"""Combine the approved RUN model and its clips. Run with Blender."""

import json
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import math


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source-assets/assembled"
OUTPUT = ROOT / "public/assets/assembled.glb"
CLIPS = ("idle", "walk")
REQUIRED_BONES = {
    "Hips", "Head", "headfront", "Spine02",
    "RightArm", "RightForeArm", "RightHand",
    "LeftArm", "LeftForeArm", "LeftHand",
}


def import_model():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "rigged.glb"))
    rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(rigs) != 1:
        raise RuntimeError(f"Expected one skeleton, found {len(rigs)}")
    rig = rigs[0]
    missing = REQUIRED_BONES - set(rig.data.bones.keys())
    if missing:
        raise RuntimeError(f"The game requires these bones: {sorted(missing)}")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"
              and any(mod.type == "ARMATURE" for mod in obj.modifiers)]
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH" and obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in meshes:
        for material in mesh.data.materials:
            if not material or not material.use_nodes:
                continue
            shader = material.node_tree.nodes.get("Principled BSDF")
            if shader:
                shader.inputs["Emission Strength"].default_value = 0
                shader.inputs["Metallic"].default_value = 0
                shader.inputs["Roughness"].default_value = 0.88
                shader.inputs["Specular IOR Level"].default_value = 0.2
                shader.inputs["Specular Tint"].default_value = (1, 1, 1, 1)
    if not meshes:
        raise RuntimeError("The generated model contains no mesh")
    return rig, meshes


def add_stitches(rig, character):
    tree = BVHTree.FromPolygons([v.co for v in character.data.vertices],
        [list(p.vertices) for p in character.data.polygons])
    vertices, faces, weights = [], [], {}

    def surface(x, z):
        point, normal, _, _ = tree.ray_cast(Vector((x, -60, z)), Vector((0, 1, 0)))
        return point + normal * 0.22 if point is not None else None

    def tube(points, radius, bone):
        start = len(vertices)
        for index, point in enumerate(points):
            tangent = points[min(index + 1, len(points) - 1)] - points[max(index - 1, 0)]
            tangent.normalize()
            axis = tangent.cross(Vector((0, 1, 0))).normalized()
            other = tangent.cross(axis).normalized()
            for side in range(6):
                angle = side * math.tau / 6
                vertices.append(point + radius * (axis * math.cos(angle) + other * math.sin(angle)))
        for ring in range(len(points) - 1):
            for side in range(6):
                i = start + ring * 6 + side
                j = start + ring * 6 + (side + 1) % 6
                faces.append((i, j, j + 6, i + 6))
        weights.setdefault(bone, []).extend(range(start, len(vertices)))

    def seam(start, end, count, bone):
        direction = Vector((end[0] - start[0], end[1] - start[1])).normalized()
        cross = Vector((-direction.y, direction.x)) * 0.65
        for i in range(count):
            t = (i + 0.5) / count
            x, z = start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t
            points = [surface(x + cross.x * k, z + cross.y * k) for k in (-1, 0, 1)]
            if all(p is not None for p in points):
                points[1].y -= 0.22
                tube(points, 0.14, bone)

    seam((-1.5, 208), (-3.2, 199), 7, "Head")
    seam((-3.2, 199), (5.4, 198), 6, "Head")
    seam((-7.2, 186.7), (7.4, 188.2), 11, "Head")
    seam((-5.8, 176.5), (6.8, 177.5), 10, "neck")
    seam((-56, 112), (-46, 108), 6, "RightForeArm")
    seam((48, 114), (60, 117), 8, "LeftForeArm")
    mesh = bpy.data.meshes.new("RaisedStitches")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("raised-stitches", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.matrix_world = character.matrix_world.copy()
    modifier = obj.modifiers.new("Follow skeleton", "ARMATURE")
    modifier.object = rig
    for bone, indices in weights.items():
        obj.vertex_groups.new(name=bone).add(indices, 1, "REPLACE")
    material = bpy.data.materials.new("Dark surgical thread")
    material.diffuse_color = (0.009, 0.006, 0.004, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = material.diffuse_color
    shader.inputs["Roughness"].default_value = 0.9
    mesh.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = True
    return obj


def attach_clips(rig):
    source_objects = set(bpy.context.scene.objects)
    rig.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    rig.animation_data_create()
    for label in CLIPS:
        previous = set(bpy.data.actions)
        bpy.ops.import_scene.gltf(filepath=str(SOURCE / f"animations/anim_{label}.glb"))
        imported = set(bpy.data.actions) - previous
        if len(imported) != 1:
            raise RuntimeError(f"Expected one {label} clip, found {len(imported)}")
        action = imported.pop()
        action.name = label
        track = rig.animation_data.nla_tracks.new()
        track.name = label
        strip = track.strips.new(label, int(action.frame_range[0]), action)
        if action.slots:
            strip.action_slot = action.slots[0]
        for obj in list(bpy.context.scene.objects):
            if obj not in source_objects:
                bpy.data.objects.remove(obj, do_unlink=True)


def export_model(rig, meshes):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (rig, *meshes):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    temporary = OUTPUT.with_name("assembled.pending.glb")
    bpy.ops.export_scene.gltf(
        filepath=str(temporary), export_format="GLB", use_selection=True,
        export_animations=True, export_nla_strips=True,
        export_image_format="JPEG", export_image_quality=90,
        export_draco_mesh_compression_enable=True,
    )
    # Inspect the exact exported model before replacing the runtime asset.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(temporary))
    exported = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(exported) != 1:
        raise RuntimeError("The export must contain one skeleton")
    if {action.name for action in bpy.data.actions} != set(CLIPS):
        raise RuntimeError("The export must contain exactly idle and walk")
    temporary.replace(OUTPUT)
    return exported[0]


def bounds():
    points = [obj.matrix_world @ Vector(corner)
              for obj in bpy.context.scene.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)
              for corner in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


def render(rig, name, position, target, resolution):
    rig.animation_data_create()
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = bpy.data.actions["idle"]
    if rig.animation_data.action.slots:
        rig.animation_data.action_slot = rig.animation_data.action.slots[0]
    bpy.context.scene.frame_set(4)
    camera_data = bpy.data.cameras.new("Preview")
    camera_data.lens = 58
    camera = bpy.data.objects.new("Preview", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = position
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(ROOT / f"docs/{name}.png")
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(camera, do_unlink=True)


def main():
    rig, meshes = import_model()
    meshes.append(add_stitches(rig, meshes[0]))
    for mesh in meshes:
        if len(mesh.data.polygons) > 90000:
            bpy.context.view_layer.objects.active = mesh
            modifier = mesh.modifiers.new("Game mesh budget", "DECIMATE")
            modifier.ratio = 80000 / len(mesh.data.polygons)
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    attach_clips(rig)
    rig = export_model(rig, meshes)
    low, high = bounds()
    report = {
        "asset": str(OUTPUT.relative_to(ROOT)), "bytes": OUTPUT.stat().st_size,
        "bones": len(rig.data.bones), "clips": list(CLIPS),
        "bounds": {"min": low, "max": high},
        "meshes": [obj.name for obj in bpy.context.scene.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers)],
    }
    (SOURCE / "build.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))

    world = bpy.data.worlds.new("PreviewWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.035, 0.035, 0.028, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    for name, location, energy, color in [
        ("Key", (-1.5, -2, 2.6), 350, (1, 0.89, 0.72)),
        ("Fill", (1.6, -1, 1.8), 140, (0.7, 0.78, 0.69)),
        ("Rim", (1.2, 1, 2.5), 300, (0.55, 0.65, 0.6)),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.color, data.shape, data.size = energy, color, "DISK", 1.6
        light = bpy.data.objects.new(name, data)
        bpy.context.scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((0, 0, 1.5)) - light.location).to_track_quat("-Z", "Y").to_euler()
    render(rig, "assembled-body", (0, -4.5, 1.3), (0, 0, 1.2), (800, 1100))
    render(rig, "assembled-face", (0.35, -1.65, 2.07), (0, 0, 2.02), (900, 900))


if __name__ == "__main__":
    main()
