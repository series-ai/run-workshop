"""Review sheet for one asset: four rest views (front 3/4, back 3/4, side,
top), optional clip frames, and a native-scale lineup with references and
the person gauge. Every asset is looked at this way before it counts as done.

blender -b --factory-startup --python review.py -- --out sheet.png [--size 480] --asset a.glb [--ref r.glb …] [--clip idle@0.5 …]
"""
import math
import os
import sys
import tempfile

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lineup import VIEW as LINEUP_VIEW, build_lineup  # noqa: E402
from render_util import compose_sheet, gltf_rest_pose, render_scene  # noqa: E402

VIEWS = {
    "front": Vector((math.sin(math.radians(35)), math.cos(math.radians(35)), 0.75)).normalized(),
    "back": Vector((-math.sin(math.radians(35)), -math.cos(math.radians(35)), 0.75)).normalized(),
    "side": Vector((1.0, -0.15, 0.3)).normalized(),
    "top": Vector((0.05, 0.12, 1.0)).normalized(),
}


def args():
    argv = sys.argv[sys.argv.index("--") + 1:]
    out, size, asset, refs, clips = None, 480, None, [], []
    i = 0
    while i < len(argv):
        flag = argv[i]
        if flag in ("--out", "--size", "--asset", "--ref", "--clip"):
            value = argv[i + 1]
            i += 2
            if flag == "--out":
                out = value
            elif flag == "--size":
                size = int(value)
            elif flag == "--asset":
                asset = value
            elif flag == "--ref":
                refs.append(value)
            else:
                clips.append(value)
        else:
            raise SystemExit(f"unknown argument {flag}")
    if not out or not asset:
        raise SystemExit("usage: review.py -- --out <png> --asset <glb> [--ref <glb>] [--clip name@t]")
    return out, size, asset, refs, clips


def load(path: str) -> list:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = list(bpy.context.scene.objects)
    gltf_rest_pose(path, objects)
    return objects


def play(name: str, seconds: float) -> None:
    scene = bpy.context.scene
    action = bpy.data.actions.get(name)
    if action is None:
        raise SystemExit(f"no clip {name!r} in the asset")
    for obj in scene.objects:
        ad = obj.animation_data
        if not ad:
            continue
        for track in ad.nla_tracks:
            for strip in track.strips:
                if strip.action == action:
                    ad.action = action
                    ad.action_slot = strip.action_slot
            track.mute = True
    scene.frame_set(round(seconds * scene.render.fps))


def main() -> None:
    out, size, asset, refs, clips = args()
    tmp = tempfile.mkdtemp()
    pngs = []
    for name, view in VIEWS.items():
        load(asset)
        png = os.path.join(tmp, f"view-{name}.png")
        render_scene(png, size, view)
        pngs.append(png)
    for clip in clips:
        name, _, t = clip.partition("@")
        load(asset)
        play(name, float(t or 0.5))
        png = os.path.join(tmp, f"clip-{len(pngs):02d}-{name}-{t or '0.5'}.png")  # unique per clip and time
        render_scene(png, size, VIEWS["front"])
        pngs.append(png)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_lineup([asset] + refs)
    bpy.context.scene.display.shading.color_type = "TEXTURE"
    png = os.path.join(tmp, "lineup.png")
    render_scene(png, size, LINEUP_VIEW)
    pngs.append(png)
    compose_sheet(pngs, out, size, cols=4)
    print(f"REVIEW {out}")


main()
