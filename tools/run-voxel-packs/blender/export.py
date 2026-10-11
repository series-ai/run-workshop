"""Builds a voxel `Asset` into the Blender scene and exports a GLB, glTF +Y up,
with node-hierarchy clips. World assets get one `atlas` material: a painted
PNG at 1 texel per voxel, meshed by shape (see atlas.py). Avatar-space assets
get the `palette` material (256×1 PNG). Both: nearest + clamp, metallic 0,
roughness 1.

Axis mapping: glTF (x, y, z) == Blender (x, -z, y).
"""
from __future__ import annotations

import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

import atlas
from mesher import greedy_mesh
from voxgrid import CATEGORIES, CLIPS, PALETTE, RIG, Asset, Part, palette_colors, units_per_voxel

# glTF → Blender basis change.
_B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
_B_INV = _B.inverted()


def gl_to_bl(v) -> Vector:
    return Vector((v[0], -v[2], v[1]))


def gl_euler_to_bl_quat(deg) -> Quaternion:
    """XYZ euler (degrees) about glTF axes → Blender quaternion."""
    m = Euler([math.radians(a) for a in deg], "XYZ").to_matrix()
    return (_B @ m @ _B_INV).to_quaternion()


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = CLIPS["fps"]
    scene.frame_start = 0


def palette_material(name: str = "palette") -> bpy.types.Material:
    image = bpy.data.images.new(name, width=256, height=1, alpha=False)
    pixels = []
    for hex_color in PALETTE["colors"]:
        pixels.extend([int(hex_color[i : i + 2], 16) / 255.0 for i in (1, 3, 5)] + [1.0])
    image.pixels.foreach_set(pixels)
    image.file_format = "PNG"
    image.pack()

    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def _image_material(name: str, rgb: np.ndarray) -> bpy.types.Material:
    """Material with a nearest-sampled PNG from an (h, w, 3) uint8 image, row 0 at the top."""
    h, w, _ = rgb.shape
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.concatenate([rgb[::-1].astype(np.float32) / 255.0, np.ones((h, w, 1), np.float32)], axis=2)
    image.pixels.foreach_set(rgba.reshape(-1))
    image.file_format = "PNG"
    image.pack()
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def _hex_rgb(colors: list[str]) -> np.ndarray:
    return np.array([[int(c[i : i + 2], 16) for i in (1, 3, 5)] for c in colors], dtype=np.uint8)


def atlas_objects(asset: Asset) -> dict[str, bpy.types.Object]:
    """World assets: meshes by shape, one painted atlas for the whole asset."""
    meshes = {p.name: atlas.mesh_part(p.grid) for p in asset.root.walk() if p.grid is not None and p.grid.count() > 0}
    faces = [f for m in meshes.values() for f in m.faces]
    width, height = atlas.pack(faces)
    rgb = _hex_rgb(palette_colors(asset.pack))[atlas.atlas_image(faces, width, height)]
    material = _image_material("atlas", rgb)
    objects: dict[str, bpy.types.Object] = {}
    for part in asset.root.walk():
        mesh_data = meshes.get(part.name)
        if mesh_data is None:
            obj = bpy.data.objects.new(part.name, None)
        else:
            verts, polys, uvs = [], [], []
            pivot = np.array(part.pivot, dtype=float)
            for f in mesh_data.faces:
                start = len(verts)
                verts.extend(tuple(gl_to_bl(p - pivot)) for p in f.verts)
                polys.append(list(range(start, start + len(f.verts))))
                uv = atlas.face_uvs(f, width, height)
                uvs.extend((float(u), 1.0 - float(v)) for u, v in uv)
            mesh = bpy.data.meshes.new(part.name)
            mesh.from_pydata(verts, [], polys)
            layer = mesh.uv_layers.new(name="UVMap")
            layer.data.foreach_set("uv", [c for uv in uvs for c in uv])
            mesh.materials.append(material)
            mesh.validate()
            mesh.update()
            obj = bpy.data.objects.new(part.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        objects[part.name] = obj
    return objects


def mesh_object(name: str, part: Part, unit: float, material) -> bpy.types.Object:
    if part.grid is None or part.grid.count() == 0:
        obj = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(obj)
        return obj
    pos, _nrm, uvs, quads = greedy_mesh(part.grid.a, pivot=part.pivot)
    verts = [tuple(gl_to_bl(p * unit)) for p in pos]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], quads.tolist())
    uv_layer = mesh.uv_layers.new(name="UVMap")
    uv_layer.data.foreach_set("uv", np.repeat(uvs, 1, axis=0).reshape(-1).tolist())
    mesh.materials.append(material)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def is_world(asset: Asset) -> bool:
    return CATEGORIES["categories"][asset.category]["space"] == "world"


def build_parts(asset: Asset, material) -> dict[str, bpy.types.Object]:
    unit = units_per_voxel(asset.category)
    objects: dict[str, bpy.types.Object] = {}
    made = atlas_objects(asset) if material is None else None

    def visit(part: Part, parent) -> None:
        obj = made[part.name] if made is not None else mesh_object(part.name, part, unit, material)
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = gl_euler_to_bl_quat(part.rot)
        obj.location = gl_to_bl([c * unit for c in part.at])
        if parent is not None:
            obj.parent = parent
        objects[part.name] = obj
        for child in part.children:
            visit(child, obj)

    visit(asset.root, None)
    return objects


def rest_position(asset: Asset, name: str) -> tuple[float, float, float]:
    """Pivot of part `name` in root pivot space (voxels), at rest."""
    def find(part: Part, acc):
        here = (acc[0] + part.at[0], acc[1] + part.at[1], acc[2] + part.at[2])
        if part.name == name:
            return here
        for child in part.children:
            hit = find(child, here)
            if hit:
                return hit
        return None

    hit = find(asset.root, (0.0, 0.0, 0.0))
    if hit is None:
        raise ValueError(f"{asset.id}: no part named {name!r}")
    root = asset.root.at
    return (hit[0] - root[0], hit[1] - root[1], hit[2] - root[2])


def build_sockets(asset: Asset, objects) -> None:
    unit = units_per_voxel(asset.category)
    for socket in asset.sockets:
        parent_name = socket.parent or asset.root.name
        base = rest_position(asset, parent_name)
        local = [socket.at[i] - base[i] for i in range(3)]
        empty = bpy.data.objects.new(socket.name, None)
        bpy.context.scene.collection.objects.link(empty)
        empty.parent = objects[parent_name]
        empty.rotation_mode = "QUATERNION"
        empty.location = gl_to_bl([c * unit for c in local])
        empty.rotation_quaternion = gl_euler_to_bl_quat(socket.rot)


def build_clips(asset: Asset, objects) -> None:
    unit = units_per_voxel(asset.category)
    fps = CLIPS["fps"]
    for clip in asset.clips:
        action = bpy.data.actions.new(clip.name)
        for part_name, channels in clip.keys.items():
            obj = objects[part_name]
            rest_loc = obj.location.copy()
            rest_rot = obj.rotation_quaternion.copy()
            rest_scale = obj.scale.copy()
            anim = obj.animation_data or obj.animation_data_create()
            anim.action = action
            for channel, keys in channels.items():
                for seconds, value in keys:
                    frame = round(seconds * fps)
                    if channel == "rot":
                        obj.rotation_quaternion = rest_rot @ gl_euler_to_bl_quat(value)
                        obj.keyframe_insert("rotation_quaternion", frame=frame)
                    elif channel == "loc":
                        obj.location = rest_loc + gl_to_bl([c * unit for c in value])
                        obj.keyframe_insert("location", frame=frame)
                    elif channel == "scale":
                        obj.scale = Vector((value[0], value[2], value[1]))
                        obj.keyframe_insert("scale", frame=frame)
                    else:
                        raise ValueError(f"{asset.id}: clip {clip.name!r} has unknown channel {channel!r}")
            slot = anim.action_slot
            track = anim.nla_tracks.new()
            track.name = clip.name
            strip = track.strips.new(clip.name, 0, action)
            strip.action_slot = slot
            track.mute = True  # keep the rest pose unevaluated at export; see export_glb
            anim.action = None
            obj.location, obj.rotation_quaternion, obj.scale = rest_loc, rest_rot, rest_scale


def export_glb(path: str, animated: bool) -> None:
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_vertex_color="NONE",
        export_extras=False,
        export_cameras=False,
        export_lights=False,
        export_animations=animated,
        export_animation_mode="ACTIONS",
        export_merge_animation="ACTION",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_skins=True,
        export_morph=False,
    )


def hand_r_inverse_bl() -> Quaternion:
    """Inverse rest rotation of the PN Hand.R joint, in Blender axes.

    Held items are authored upright in rig-world axes (the character faces
    +X, grip at the origin). Rotating the item root by this makes an identity
    parent to the Hand.R bone show the item as authored at rest."""
    m = next(j["worldMatrix"] for j in RIG["joints"] if j["name"] == "Hand.R")
    rot = Matrix(((m[0], m[4], m[8]), (m[1], m[5], m[9]), (m[2], m[6], m[10])))
    return (_B @ rot @ _B_INV).to_quaternion().inverted()


def center_on_base(asset: Asset, objects) -> None:
    """World assets sit on y = 0 and are centred on x/z by their full rest
    bounds, child parts included, so authors never place the pivot by hand.
    Moves the root before clips are keyed; steps are half voxels."""
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in objects.values() if o.type == "MESH" for v in o.data.vertices]
    if not pts:
        return
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    root = objects[asset.root.name]
    shift = Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
    root.location += Vector([round(c * 2) / 2 for c in shift])


def build_asset(asset: Asset, glb_path: str) -> None:
    asset.validate()
    reset_scene()
    # World assets: painted atlas (PN style). Avatar space: the shared palette.
    material = None if is_world(asset) else palette_material()
    objects = build_parts(asset, material)
    if asset.category == "held-items":
        if any(abs(c) > 1e-9 for c in asset.root.at):
            raise ValueError(f"{asset.id}: held item root must sit at the grip (at = 0)")
        objects[asset.root.name].rotation_quaternion = hand_r_inverse_bl()
    build_sockets(asset, objects)
    if is_world(asset) and CATEGORIES["categories"][asset.category]["origin"] == "base":
        center_on_base(asset, objects)
    build_clips(asset, objects)
    export_glb(glb_path, animated=bool(asset.clips))
