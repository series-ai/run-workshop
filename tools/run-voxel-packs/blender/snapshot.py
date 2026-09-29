"""Dev tool: render GLBs to a PNG contact sheet for art review.

    Blender -b --factory-startup --python blender/snapshot.py -- \
        --out sheet.png [--size 320] [--clip open@0.5] a.glb b.glb ...

Uses Workbench flat lighting so palette colours read true. Not the shipped
previews: those come from the showcase three.js route, like Pirate Nation's.
"""
from __future__ import annotations

import math
import os
import sys
import tempfile

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_util import RIG_VIEW, WORLD_VIEW, compose_sheet, gltf_rest_pose, render_scene  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out, size, clip, files = None, 320, None, []
    global CLIP_FROM
    i = 0
    while i < len(argv):
        if argv[i] == "--out":
            out = argv[i + 1]; i += 2
        elif argv[i] == "--size":
            size = int(argv[i + 1]); i += 2
        elif argv[i] == "--clip":
            clip = argv[i + 1]; i += 2
        elif argv[i] == "--clip-from":
            CLIP_FROM = argv[i + 1]; i += 2
        else:
            files.append(argv[i]); i += 1
    if not out or not files:
        raise SystemExit("usage: -- --out sheet.png [--size N] [--clip name@seconds] files...")
    return out, size, clip, files


CLIP_FROM = None


def borrow_clip(clip_name: str) -> None:
    """Import CLIP_FROM, keep only its actions, and play `clip_name` on the
    first armature of the scene (same PN bone names)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=CLIP_FROM)
    for obj in set(bpy.data.objects) - before:
        bpy.data.objects.remove(obj, do_unlink=True)
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    action = bpy.data.actions.get(clip_name)
    if action is None:
        raise SystemExit(f"clip {clip_name!r} not in {CLIP_FROM}")
    ad = arm.animation_data or arm.animation_data_create()
    for track in ad.nla_tracks:
        track.mute = True
    ad.action = action
    ad.action_slot = action.slots[0]


def render_one(path: str, size: int, clip: str | None, png: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    scene = bpy.context.scene
    if clip and CLIP_FROM:
        name, _, t = clip.partition("@")
        borrow_clip(name)
        scene.frame_set(round(float(t or 0) * scene.render.fps))
    elif not clip:
        # The importer poses objects with the first clip; show the rest pose instead.
        if not any(o.type == "ARMATURE" for o in scene.objects):  # rigs use pose_position REST below
            gltf_rest_pose(path, list(scene.objects))
        for obj in scene.objects:
            ad = obj.animation_data
            if ad:
                ad.action = None
                for track in ad.nla_tracks:
                    track.mute = True
            if obj.type == "ARMATURE":
                obj.data.pose_position = "REST"
        scene.frame_set(0)
    elif clip:
        name, _, t = clip.partition("@")
        action = bpy.data.actions.get(name)
        if action:
            for obj in scene.objects:
                ad = obj.animation_data
                if not ad:
                    continue
                for track in ad.nla_tracks:
                    for strip in track.strips:
                        if strip.action == action:
                            ad.action = action
                            ad.action_slot = strip.action_slot
                for track in ad.nla_tracks:
                    track.mute = True
            scene.frame_set(round(float(t or 0) * scene.render.fps))
    rig = "--rig-front" in sys.argv or any(o.type == "ARMATURE" for o in scene.objects)
    render_scene(png, size, RIG_VIEW if rig else WORLD_VIEW)


def main() -> None:
    out, size, clip, files = args()
    tmp = tempfile.mkdtemp()
    pngs = []
    for i, path in enumerate(files):
        png = os.path.join(tmp, f"{i}.png")
        render_one(path, size, clip, png)
        pngs.append(png)
    compose_sheet(pngs, out, size)
    print("SHEET", out)


main()
