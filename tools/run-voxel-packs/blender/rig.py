"""Avatar-space builds on the Pirate Nation rig: part files and full-body skins.

The PN avatar GLB is imported as a template and stripped to its armature:
every PN mesh and every PN action is deleted, so no PN mesh or clip data
reaches the output. The bone rest pose stays (needed to skin to the PN rig);
those files ship in the `3D/characters` leaf, whose licence file keeps the
Proof of Play MIT notice for that armature data.

Skinning is rigid. Each voxel takes a bone by the joint rule in
rigspace.rule_bone (limited to the bones its slot may follow), each bone's
voxels are meshed separately so no quad spans two bones, and the sub-meshes
join into one node per part — the PN part-node convention.
"""
from __future__ import annotations

import os

import bpy
import numpy as np
from mathutils import Quaternion, Vector

import export
from mesher import greedy_mesh
from rigspace import RIG_UNIT, gl_to_bl, restricted_bone
from voxgrid import CLIPS, RIG, Asset, Part

ALL_BONES = [j["name"] for j in RIG["joints"]]
HEAD = ["Head"]
SLOT_BONES: dict[str, list[str]] = {
    "species": ALL_BONES,
    "face": HEAD,
    "eyebrow": HEAD,
    "hair": HEAD,
    "facialhair": HEAD,
    "ears": HEAD,
    "eyewear": HEAD,
    "headwear": HEAD,
    "tops": ["Body", "Chest", "Arm.L", "ForeArm.L", "Hand.L", "Arm.R", "ForeArm.R", "Hand.R"],
    "bottoms": ["Root", "Body", "Leg.L", "LowerLeg.L", "Foot.L", "Leg.R", "LowerLeg.R", "Foot.R"],
    "shoes": ["Foot.L", "LowerLeg.L", "Foot.R", "LowerLeg.R"],
    "back": ["Chest"],
}

def split_by_bone(part: Part, bones: list[str]) -> dict[str, np.ndarray]:
    """Per-bone copies of the part grid (other voxels cleared), by the joint rule."""
    a = part.grid.a
    label_grid = np.full(a.shape, -1, dtype=np.int16)
    for x, y, z in zip(*np.nonzero(a)):
        p = tuple((c - part.pivot[i] + 0.5) * RIG_UNIT for i, c in enumerate((x, y, z)))
        label_grid[x, y, z] = ALL_BONES.index(restricted_bone(p, bones))
    out = {}
    for bone_index in np.unique(label_grid[label_grid >= 0]).tolist():
        out[ALL_BONES[bone_index]] = np.where(label_grid == bone_index, a, 0).astype(np.uint8)
    return out


def load_template(pirate_avatar_glb: str) -> bpy.types.Object:
    export.reset_scene()
    bpy.ops.import_scene.gltf(filepath=pirate_avatar_glb)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    for obj in list(bpy.data.objects):
        if obj is not arm:
            bpy.data.objects.remove(obj, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.actions):
        for block in list(coll):
            coll.remove(block)
    if arm.animation_data:
        arm.animation_data.action = None
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)
    arm.data.pose_position = "POSE"
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.location, pb.rotation_quaternion, pb.scale = Vector(), Quaternion(), Vector((1, 1, 1))
    if sorted(b.name for b in arm.data.bones) != sorted(ALL_BONES):
        raise ValueError(f"template armature bones {[b.name for b in arm.data.bones]} differ from the rig contract")
    return arm


def skinned_part(arm, part: Part, bones: list[str], material) -> bpy.types.Object:
    verts, faces, uvs, groups = [], [], [], {}
    for bone, sub in split_by_bone(part, bones).items():
        pos, _n, uv, quads = greedy_mesh(sub, pivot=part.pivot)
        base = len(verts)
        verts.extend(tuple(gl_to_bl(p * RIG_UNIT)) for p in pos)
        faces.extend((quads + base).tolist())
        uvs.append(uv)
        groups.setdefault(bone, []).extend(range(base, base + len(pos)))
    if not verts:
        raise ValueError(f"part {part.name!r} has no voxels")
    mesh = bpy.data.meshes.new(part.name)
    mesh.from_pydata(verts, [], faces)
    layer = mesh.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", np.concatenate(uvs).reshape(-1).tolist())
    mesh.materials.append(material)
    mesh.validate()
    obj = bpy.data.objects.new(part.name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = arm
    obj.matrix_parent_inverse = arm.matrix_world.inverted()
    for bone, indices in groups.items():
        obj.vertex_groups.new(name=bone).add(indices, 1.0, "REPLACE")
    obj.modifiers.new("Armature", "ARMATURE").object = arm
    return obj


def world_axis_rotation(arm, bone_name: str, deg) -> Quaternion:
    """Pose-bone local rotation for a rotation about rig-space (glTF) axes."""
    rest = arm.data.bones[bone_name].matrix_local.to_quaternion()
    arm_rot = arm.matrix_world.to_quaternion()
    world = export.gl_euler_to_bl_quat(deg)
    in_armature = arm_rot.inverted() @ world @ arm_rot
    return rest.inverted() @ in_armature @ rest


def world_offset(arm, bone_name: str, voxels) -> Vector:
    rest = arm.data.bones[bone_name].matrix_local.to_quaternion()
    arm_rot = arm.matrix_world.to_quaternion()
    v = gl_to_bl([c * RIG_UNIT for c in voxels])
    return rest.inverted() @ (arm_rot.inverted() @ v)


def build_clips(arm, asset: Asset) -> None:
    fps = CLIPS["fps"]
    anim = arm.animation_data or arm.animation_data_create()
    for clip in asset.clips:
        action = bpy.data.actions.new(clip.name)
        anim.action = action
        frames = sorted({round(t * fps) for chans in clip.keys.values() for keys in chans.values() for t, _ in keys})
        first, last = frames[0], frames[-1]
        for bone in ALL_BONES:
            pb = arm.pose.bones[bone]
            chans = clip.keys.get(bone, {})
            for channel in ("rot", "loc"):
                keys = chans.get(channel) or [(first / fps, (0, 0, 0)), (last / fps, (0, 0, 0))]
                for t, value in keys:
                    frame = round(t * fps)
                    if channel == "rot":
                        pb.rotation_quaternion = world_axis_rotation(arm, bone, value)
                        pb.keyframe_insert("rotation_quaternion", frame=frame)
                    else:
                        pb.location = world_offset(arm, bone, value)
                        pb.keyframe_insert("location", frame=frame)
            pb.location, pb.rotation_quaternion = Vector(), Quaternion()
        slot = anim.action_slot
        track = anim.nla_tracks.new()
        track.name = clip.name
        strip = track.strips.new(clip.name, 0, action)
        strip.action_slot = slot
        track.mute = True
        anim.action = None


def build_rig_asset(asset: Asset, glb_path: str, rig_config: dict | None) -> None:
    if not rig_config or "pirateAvatar" not in rig_config:
        raise ValueError("rig builds need jobs.rig = {pirateAvatar}")
    asset.validate()
    arm = load_template(rig_config["pirateAvatar"])
    material = export.palette_material()
    if asset.category == "avatar":
        parts_meta = []
        for part in asset.root.children:
            slot = part.name.split(" ", 1)[0]
            skinned_part(arm, part, SLOT_BONES[slot], material)
            index = int(part.name.rsplit("-", 1)[1])
            parts_meta.append({"nodeName": part.name, "slot": slot, "index": index, **part.meta})
        asset.extra_meta = {"parts": parts_meta, "avatarClips": [c.name for c in asset.clips]}
    else:
        skinned_part(arm, asset.root, ALL_BONES, material)
    build_clips(arm, asset)
    export.export_glb(glb_path, animated=bool(asset.clips))
