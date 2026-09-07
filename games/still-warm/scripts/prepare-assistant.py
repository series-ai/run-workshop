#!/usr/bin/env python3
"""Build the rigged Still Warm assistant as a Victorian corpse.

The script deforms the source face and adds exposed decay, a damaged jaw, and
a ruined frock coat. Each added vertex is weighted to an existing rig bone.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-assistant.py
"""

import math
import os
import sys

try:
    import bpy
    from mathutils import Euler, Vector
except ImportError:
    print("Run this script in Blender.")
    sys.exit(1)


CWD = os.getcwd()
RIGGED_PATH = os.path.join(CWD, "source-assets/assistant-rigged.glb")
OUT_PATH = os.path.join(CWD, "public/assets/assistant.glb")
BODY_PREVIEW_PATH = "/tmp/still-warm-zombie-body.png"
FACE_PREVIEW_PATH = "/tmp/still-warm-zombie-face.png"
THREE_QUARTER_PREVIEW_PATH = "/tmp/still-warm-zombie-three-quarter.png"

CLIPS = [
    ("idle", os.path.join(CWD, "source-assets/animations/anim_idle.glb")),
    ("walk", os.path.join(CWD, "source-assets/animations/anim_walk.glb")),
    ("crouch", os.path.join(CWD, "source-assets/animations/anim_crouch.glb")),
    ("hit", os.path.join(CWD, "source-assets/animations/anim_hit.glb")),
    ("wave", os.path.join(CWD, "source-assets/animations/anim_wave.glb")),
]


def make_material(name, color, roughness=0.9, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return material


class GeometryBuilder:
    """Collect small parts in the rig's centimetre coordinate space."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.face_materials = []
        self.bone_vertices = {}

    def _append(self, vertices, faces, material_index, bone_name):
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        self.faces.extend(tuple(offset + index for index in face) for face in faces)
        self.face_materials.extend([material_index] * len(faces))
        self.bone_vertices.setdefault(bone_name, []).extend(
            range(offset, offset + len(vertices))
        )

    def add_box(self, center, size, rotation, material_index, bone_name):
        hx, hy, hz = (value * 0.5 for value in size)
        corners = [
            Vector((x, y, z))
            for x, y, z in [
                (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz),
            ]
        ]
        matrix = Euler(rotation, "XYZ").to_matrix()
        vertices = [tuple(matrix @ corner + Vector(center)) for corner in corners]
        faces = [
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
            (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ]
        self._append(vertices, faces, material_index, bone_name)

    def add_ellipsoid(
        self,
        center,
        scale,
        material_index,
        bone_name,
        segments=12,
        rings=6,
        rotation=(0.0, 0.0, 0.0),
        omit_face=None,
    ):
        matrix = Euler(rotation, "XYZ").to_matrix()
        vertices = []
        for ring in range(rings + 1):
            latitude = -math.pi * 0.5 + math.pi * ring / rings
            for segment in range(segments):
                longitude = math.tau * segment / segments
                local = Vector((
                    scale[0] * math.cos(latitude) * math.cos(longitude),
                    scale[1] * math.cos(latitude) * math.sin(longitude),
                    scale[2] * math.sin(latitude),
                ))
                vertices.append(tuple(matrix @ local + Vector(center)))

        faces = []
        for ring in range(rings):
            for segment in range(segments):
                next_segment = (segment + 1) % segments
                face = (
                    ring * segments + segment,
                    ring * segments + next_segment,
                    (ring + 1) * segments + next_segment,
                    (ring + 1) * segments + segment,
                )
                if omit_face:
                    midpoint = sum((Vector(vertices[index]) for index in face), Vector()) / 4
                    if omit_face(midpoint):
                        continue
                faces.append(face)
        self._append(vertices, faces, material_index, bone_name)

    def add_prism(self, front_points, depth, material_index, bone_name):
        count = len(front_points)
        front = [Vector(point) for point in front_points]
        back = [point + Vector((0.0, depth, 0.0)) for point in front]
        vertices = [tuple(point) for point in front + back]
        faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
        for index in range(count):
            next_index = (index + 1) % count
            faces.append((index, next_index, count + next_index, count + index))
        self._append(vertices, faces, material_index, bone_name)

    def add_segment(self, start, end, radius, sides, material_index, bone_name):
        start = Vector(start)
        end = Vector(end)
        axis = end - start
        if axis.length < 0.01:
            return
        direction = axis.normalized()
        reference = Vector((0, 0, 1))
        if abs(direction.dot(reference)) > 0.9:
            reference = Vector((0, 1, 0))
        side = direction.cross(reference).normalized()
        up = direction.cross(side).normalized()
        vertices = []
        for point in (start, end):
            for index in range(sides):
                angle = math.tau * index / sides
                vertices.append(tuple(point + radius * (math.cos(angle) * side + math.sin(angle) * up)))
        faces = [tuple(range(sides - 1, -1, -1)), tuple(range(sides, sides * 2))]
        for index in range(sides):
            next_index = (index + 1) % sides
            faces.append((index, next_index, sides + next_index, sides + index))
        self._append(vertices, faces, material_index, bone_name)


def load_animation_clips(armature, character):
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)

    for label, clip_path in CLIPS:
        if not os.path.exists(clip_path):
            raise FileNotFoundError(f"Animation clip is missing: {clip_path}")
        before_actions = set(bpy.data.actions.keys())
        bpy.ops.import_scene.gltf(filepath=clip_path)
        new_actions = set(bpy.data.actions.keys()) - before_actions
        if len(new_actions) != 1:
            raise RuntimeError(f"Expected one action in {clip_path}, found {len(new_actions)}")
        bpy.data.actions[next(iter(new_actions))].name = label
        for obj in list(bpy.context.scene.objects):
            if obj not in (armature, character):
                bpy.data.objects.remove(obj, do_unlink=True)


def build_horror_geometry(armature):
    materials = [
        make_material("CorpseFlesh", (0.095, 0.115, 0.086, 1.0), 0.97),
        make_material("BruisedFlesh", (0.022, 0.007, 0.009, 1.0), 0.98),
        make_material("SocketAndMouth", (0.002, 0.001, 0.001, 1.0), 1.0),
        make_material("CloudedEye", (0.070, 0.085, 0.065, 1.0), 0.78),
        make_material("DryBlood", (0.050, 0.002, 0.002, 1.0), 0.96),
        make_material("RottenTeeth", (0.19, 0.145, 0.065, 1.0), 0.90),
        make_material("MortuaryBlack", (0.004, 0.006, 0.006, 1.0), 0.99),
        make_material("Waistcoat", (0.010, 0.004, 0.005, 1.0), 0.97),
        make_material("AgedBrass", (0.17, 0.105, 0.035, 1.0), 0.70, 0.42),
    ]
    flesh, bruise, void, eye, blood, teeth, coat, waistcoat, brass = range(len(materials))
    geometry = GeometryBuilder()

    # The source head stays exposed. These shapes replace its soft facial read.
    geometry.add_ellipsoid((-3.65, -7.10, 198.0), (0.38, 0.18, 0.48), eye, "Head", 10, 6)
    geometry.add_segment((1.6, -7.25, 195.8), (5.5, -7.0, 195.5), 0.14, 6, blood, "Head")

    geometry.add_segment((-3.0, -6.25, 188.2), (2.8, -6.20, 187.55), 0.11, 6, blood, "Head")
    geometry.add_box((0.15, -6.25, 188.55), (0.34, 0.30, 0.62), (0.0, 0.10, 0.10), teeth, "Head")

    geometry.add_segment((4.8, -8.75, 202.0), (6.8, -8.35, 190.5), 0.30, 5, blood, "Head")
    for x, z in [(5.0, 200.9), (5.4, 198.6), (5.8, 196.3), (6.2, 194.0), (6.5, 191.7)]:
        geometry.add_segment((x - 0.65, -9.05, z - 0.2), (x + 0.65, -9.0, z + 0.2), 0.14, 4, teeth, "Head")
    geometry.add_box((-7.0, -0.5, 177.2), (5.0, 10.0, 12.0), (0.0, -0.20, -0.18), coat, "neck")
    geometry.add_box((7.0, -0.5, 177.2), (5.0, 10.0, 12.0), (0.0, 0.20, 0.18), coat, "neck")
    geometry.add_prism([(-8.2, -20.8, 174.5), (-1.0, -21.6, 165.0), (-10.8, -21.3, 151.0), (-16.8, -20.6, 168.0)], 1.2, coat, "Spine01")
    geometry.add_prism([(8.2, -20.8, 174.5), (1.0, -21.6, 165.0), (10.8, -21.3, 151.0), (16.8, -20.6, 168.0)], 1.2, coat, "Spine01")
    geometry.add_prism([(-10.2, -21.2, 162.0), (9.7, -21.2, 162.0), (12.8, -21.4, 126.0), (8.0, -21.5, 105.0), (0.0, -21.7, 109.0), (-8.8, -21.5, 104.0), (-12.5, -21.4, 128.0)], 1.2, waistcoat, "Spine01")

    geometry.add_prism([(-19.0, -20.5, 151.0), (-1.0, -21.5, 143.0), (-2.0, -21.7, 74.0), (-9.0, -21.6, 78.0), (-15.0, -21.2, 70.0), (-20.0, -20.8, 83.0)], 1.2, coat, "Spine01")
    geometry.add_prism([(1.0, -21.5, 143.0), (19.0, -20.5, 151.0), (20.0, -20.8, 86.0), (14.0, -21.2, 76.0), (8.0, -21.6, 82.0), (2.0, -21.7, 72.0)], 1.2, coat, "Spine01")
    geometry.add_prism([(-20.0, 3.0, 148.0), (20.0, 3.0, 148.0), (18.0, 5.5, 75.0), (4.0, 6.5, 84.0), (-7.0, 6.2, 72.0), (-18.0, 5.5, 82.0)], 2.8, coat, "Spine01")

    for z, x in [(156.0, -0.4), (146.5, 0.2), (137.0, -0.5), (127.5, 0.1), (117.8, -0.4)]:
        geometry.add_ellipsoid((x, -22.25, z), (0.78, 0.42, 0.78), brass, "Spine01", 8, 4)
    geometry.add_segment((0.0, -21.9, 164.5), (-0.2, -22.0, 111.0), 0.15, 5, brass, "Spine01")
    geometry.add_segment((-16.5, -21.5, 146.0), (-18.8, -21.0, 109.0), 0.20, 5, bruise, "Spine01")

    geometry.add_box((42.0, -0.5, 128.5), (8.0, 8.5, 9.0), (0.0, -0.15, 0.15), coat, "LeftForeArm")
    geometry.add_box((-42.5, -0.8, 128.5), (8.0, 8.5, 9.0), (0.0, 0.15, -0.15), coat, "RightForeArm")

    mesh = bpy.data.meshes.new("horror_geometry")
    mesh.from_pydata(geometry.vertices, [], geometry.faces)
    mesh.update()
    obj = bpy.data.objects.new("horror_geometry", mesh)
    bpy.context.scene.collection.objects.link(obj)
    for material in materials:
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, geometry.face_materials):
        polygon.material_index = material_index

    obj.parent = armature
    for bone_name, indices in geometry.bone_vertices.items():
        group = obj.vertex_groups.new(name=bone_name)
        group.add(indices, 1.0, "REPLACE")
    bevel = obj.modifiers.new("Soft worn edges", type="BEVEL")
    bevel.width = 0.42
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    modifier = obj.modifiers.new("Armature", type="ARMATURE")
    modifier.object = armature
    return obj


def deform_and_repaint_source(character):
    flesh = make_material("DeadFlesh", (0.100, 0.120, 0.088, 1.0), 0.96)
    uniform = make_material("RuinedUniform", (0.003, 0.005, 0.005, 1.0), 0.99)
    mottle = make_material("MottledDecay", (0.026, 0.040, 0.021, 1.0), 0.98)
    hair = make_material("DeadHair", (0.004, 0.003, 0.002, 1.0), 0.99)
    cavity = make_material("RecessedDecay", (0.002, 0.002, 0.001, 1.0), 1.0)
    character.data.materials.append(flesh)
    character.data.materials.append(uniform)
    character.data.materials.append(mottle)
    character.data.materials.append(hair)
    character.data.materials.append(cavity)
    flesh_index = len(character.data.materials) - 5
    uniform_index = len(character.data.materials) - 4
    mottle_index = len(character.data.materials) - 3
    hair_index = len(character.data.materials) - 2
    cavity_index = len(character.data.materials) - 1

    for polygon in character.data.polygons:
        center = sum(
            (character.data.vertices[index].co for index in polygon.vertices),
            Vector(),
        ) / len(polygon.vertices)
        is_head = center.z > 177.0
        is_hand = abs(center.x) > 43.0 and 96.0 < center.z < 145.0
        is_mottled = is_head and center.y < 1.0 and (
            (center.x < -4.5 and center.z > 200.5)
            or (center.x > 3.5 and 190.0 < center.z < 196.0)
            or (center.x < -4.5 and 184.0 < center.z < 190.0)
        )
        is_socket = center.y < 0.0 and 195.5 < center.z < 200.3 and (
            -5.3 < center.x < -2.0 or 1.5 < center.x < 5.8
        )
        is_mouth = center.y < 0.0 and -3.6 < center.x < 3.4 and 187.2 < center.z < 189.7
        if is_socket or is_mouth:
            polygon.material_index = cavity_index
        elif is_head and center.z > 202.5:
            polygon.material_index = hair_index
        elif is_mottled:
            polygon.material_index = mottle_index
        else:
            polygon.material_index = flesh_index if is_head or is_hand else uniform_index

    for vertex in character.data.vertices:
        point = vertex.co
        if point.z <= 177.0:
            continue
        if 185.5 < point.z < 194.5 and 2.0 < abs(point.x) < 8.5 and point.y < 0.0:
            point.y += 2.4 * (1.0 - abs(point.z - 190.0) / 5.0)
        if 195.0 < point.z < 201.0 and 1.5 < abs(point.x) < 6.5 and point.y < 0.0:
            point.y += 1.8
        if 187.0 < point.z < 190.2 and abs(point.x) < 4.2 and point.y < 0.0:
            point.y += 1.2
            if point.x > 0.0:
                point.z -= 0.85 * min(1.0, point.x / 4.0)
        if point.z < 187.0 and point.y < 1.0:
            jaw_drop = max(0.0, min(1.0, (187.0 - point.z) / 8.0))
            point.z -= jaw_drop * (1.0 + 1.6 * max(0.0, point.x / 8.0))
            point.x += jaw_drop * 0.8
        if point.z > 199.0:
            point.x *= 0.96
            if point.x > 0.0:
                point.z -= 0.7 * min(1.0, point.x / 8.0)


def shrink_hands(character):
    pivots = {
        "LeftHand": Vector((55.66, -1.28, 120.45)),
        "RightHand": Vector((-56.49, -1.93, 120.33)),
    }
    for group_name, pivot in pivots.items():
        group = character.vertex_groups.get(group_name)
        for vertex in character.data.vertices:
            weight = next(
                (entry.weight for entry in vertex.groups if entry.group == group.index),
                0.0,
            )
            if weight > 0.0:
                scale = 1.0 - 0.34 * weight
                vertex.co = pivot + (vertex.co - pivot) * scale


def configure_animations(armature):
    armature.animation_data_create()
    for clip_name in ("crouch", "hit", "idle", "walk", "wave"):
        action = bpy.data.actions.get(clip_name)
        if not action:
            raise RuntimeError(f"Expected animation action is missing: {clip_name}")
        track = armature.animation_data.nla_tracks.new()
        track.name = clip_name
        track.strips.new(clip_name, int(action.frame_range[0]), action)


def add_light(name, light_type, energy, color, location, size=1.0):
    data = bpy.data.lights.new(name, type=light_type)
    data.energy = energy
    data.color = color
    if hasattr(data, "shape"):
        data.shape = "DISK"
        data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    return obj


def render_preview(armature, output_path, camera_location, target, lens, resolution):
    for track in armature.animation_data.nla_tracks:
        track.mute = True
    armature.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(0)

    camera_data = bpy.data.cameras.new("PreviewCamera")
    camera_data.lens = lens
    camera = bpy.data.objects.new("PreviewCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = camera_location
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.004, 0.006, 0.007, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

    key = add_light("PreviewKey", "AREA", 1050.0, (0.62, 0.68, 0.58), (-1.7, -2.2, 2.35), 2.0)
    key.rotation_euler = (Vector((0.0, 0.0, 1.55)) - key.location).to_track_quat("-Z", "Y").to_euler()
    rim = add_light("PreviewRim", "AREA", 1250.0, (0.16, 0.24, 0.29), (1.5, 1.1, 2.15), 1.4)
    rim.rotation_euler = (Vector((0.0, 0.0, 1.65)) - rim.location).to_track_quat("-Z", "Y").to_euler()

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = output_path
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.render.render(write_still=True)

    armature.animation_data.action = None
    for track in armature.animation_data.nla_tracks:
        track.mute = False
    for obj in (camera, key, rim):
        bpy.data.objects.remove(obj, do_unlink=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not os.path.exists(RIGGED_PATH):
        raise FileNotFoundError(f"Base rigged model is missing: {RIGGED_PATH}")

    bpy.ops.import_scene.gltf(filepath=RIGGED_PATH)
    armature = bpy.data.objects.get("Armature")
    character = bpy.data.objects.get("char1")
    if not armature or not character:
        raise RuntimeError("The source GLB must contain Armature and char1.")

    load_animation_clips(armature, character)
    deform_and_repaint_source(character)
    shrink_hands(character)
    horror_geometry = build_horror_geometry(armature)
    configure_animations(armature)
    for obj in list(bpy.data.objects):
        if obj not in (armature, character, horror_geometry):
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (armature, character, horror_geometry):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_PATH,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_image_format="JPEG",
        export_image_quality=82,
        export_draco_mesh_compression_enable=True,
    )

    geometry_vertices = len(horror_geometry.data.vertices)
    geometry_faces = len(horror_geometry.data.polygons)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=OUT_PATH)
    exported_armature = bpy.data.objects.get("Armature")
    if not exported_armature:
        raise RuntimeError("The exported GLB has no Armature.")
    render_preview(
        exported_armature,
        BODY_PREVIEW_PATH,
        (0.0, -3.65, 1.13),
        (0.0, 0.0, 1.10),
        56,
        (800, 1000),
    )
    render_preview(
        exported_armature,
        FACE_PREVIEW_PATH,
        (0.0, -1.80, 1.95),
        (0.0, 0.0, 1.93),
        62,
        (900, 900),
    )
    render_preview(
        exported_armature,
        THREE_QUARTER_PREVIEW_PATH,
        (0.82, -1.72, 1.95),
        (0.0, 0.0, 1.94),
        62,
        (900, 900),
    )

    print(f"Body preview: {BODY_PREVIEW_PATH}")
    print(f"Face preview: {FACE_PREVIEW_PATH}")
    print(f"Three-quarter preview: {THREE_QUARTER_PREVIEW_PATH}")
    print(f"Geometry: {geometry_vertices} vertices, {geometry_faces} faces before bevel")
    print(f"Output: {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
