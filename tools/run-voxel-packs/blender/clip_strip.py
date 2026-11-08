"""Dev tool: render frames of one clip of a GLB as a strip, from a camera
that stays fixed for the whole clip, so lunges, recoils and drops show.

    Blender -b --factory-startup --python blender/clip_strip.py -- \
        --out strip.png --clip attack [--frames 8] [--size 240] a.glb

Two rows: the front 3/4 view and the side view (the model faces glTF −Z).
Frame times are spread over the clip, first and last frame included.
"""
from __future__ import annotations

import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_util import WORLD_VIEW, compose_sheet, render_scene, scene_bounds  # noqa: E402

SIDE_VIEW = Vector((1.0, 0.0, 0.25)).normalized()  # from glTF +X: the front (−Z) is on the right


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    opts = {"out": None, "clip": None, "frames": 8, "size": 240}
    files = []
    i = 0
    while i < len(argv):
        key = argv[i][2:] if argv[i].startswith("--") else None
        if key in opts:
            opts[key] = argv[i + 1]
            i += 2
        else:
            files.append(argv[i])
            i += 1
    if not opts["out"] or not opts["clip"] or len(files) != 1:
        raise SystemExit("usage: -- --out strip.png --clip name [--frames N] [--size N] file.glb")
    return opts["out"], opts["clip"], int(opts["frames"]), int(opts["size"]), files[0]


def play(clip: str) -> int:
    """Assign `clip` on every animated object; return its last frame."""
    action = bpy.data.actions.get(clip)
    if action is None:
        raise SystemExit(f"no clip {clip!r}")
    for obj in bpy.context.scene.objects:
        ad = obj.animation_data
        if not ad:
            continue
        for track in ad.nla_tracks:
            for strip in track.strips:
                if strip.action == action:
                    ad.action = action
                    ad.action_slot = strip.action_slot
            track.mute = True
    return round(action.frame_range[1])


def main() -> None:
    out, clip, frames, size, path = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30  # the packs' clip rate; the importer keys frames at the scene rate
    bpy.ops.import_scene.gltf(filepath=path)
    last = play(clip)
    times = [round(last * i / (frames - 1)) for i in range(frames)]
    lo, hi = Vector((math.inf,) * 3), Vector((-math.inf,) * 3)
    for f in range(last + 1):
        scene.frame_set(f)
        a, b = scene_bounds(scene)
        lo = Vector(map(min, lo, a))
        hi = Vector(map(max, hi, b))
    tmp = tempfile.mkdtemp()
    pngs = []
    for view in (WORLD_VIEW, SIDE_VIEW):
        for f in times:
            scene.frame_set(f)
            png = os.path.join(tmp, f"{len(pngs)}.png")
            render_scene(png, size, view, (lo, hi))
            pngs.append(png)
    compose_sheet(pngs, out, size, cols=frames)
    print("STRIP", out, "frames", times, "fps", scene.render.fps)


main()
