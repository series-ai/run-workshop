"""Dev tool: render frames of one clip of a GLB as a strip, from a camera
that stays fixed for the whole clip, so lunges, recoils and drops show.

    Blender -b --factory-startup --python blender/clip_strip.py -- \
        --out strip.png --clip attack [--frames 8 | --at 0,12,20] [--size 320] a.glb

Three rows: the front 3/4 view, the front view and the side view (the
model faces glTF −Z), over a grey floor at height 0 so contact, sinking and
floating read. Frame times are spread over the clip, first and last frame
included.
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
FRONT_VIEW = Vector((0.0, 1.0, 0.2)).normalized()  # straight at the face (glTF −Z is Blender +Y)


def add_floor(lo: Vector, hi: Vector) -> None:
    """A grey floor at height 0 under the whole clip, a little wider than it."""
    size = max(hi.x - lo.x, hi.y - lo.y) * 1.6 + 1.0
    bpy.ops.mesh.primitive_plane_add(size=size, location=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0.0))
    mat = bpy.data.materials.new("floor")
    mat.diffuse_color = (0.42, 0.45, 0.5, 1.0)
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.45, 0.5, 1.0)
    bpy.context.object.data.materials.append(mat)
    bpy.context.object.name = "strip-floor"


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    opts = {"out": None, "clip": None, "frames": 8, "size": 320, "at": None}
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
    at = [int(f) for f in opts["at"].split(",")] if opts["at"] else None
    return opts["out"], opts["clip"], int(opts["frames"]), int(opts["size"]), files[0], at


def play(clip: str) -> int:
    """Assign `clip` on every animated object; return its last frame."""
    action = bpy.data.actions.get(clip)
    if action is None:
        raise SystemExit(f"no clip {clip!r}")
    for obj in bpy.context.scene.objects:
        ad = obj.animation_data
        if not ad:
            continue
        ad.action = None  # a part this clip doesn't key stays at rest, not in the importer's last clip
        for track in ad.nla_tracks:
            for strip in track.strips:
                if strip.action == action:
                    ad.action = action
                    ad.action_slot = strip.action_slot
            track.mute = True
    return round(action.frame_range[1])


def main() -> None:
    out, clip, frames, size, path, at = args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = 30  # the packs' clip rate; the importer keys frames at the scene rate
    bpy.ops.import_scene.gltf(filepath=path)
    last = play(clip)
    # `--at 0,12,20,24` renders exactly those frames (an impact, a contact pose)
    times = at or [round(last * i / (frames - 1)) for i in range(frames)]
    frames = len(times)
    lo, hi = Vector((math.inf,) * 3), Vector((-math.inf,) * 3)
    for f in range(last + 1):
        scene.frame_set(f)
        a, b = scene_bounds(scene)
        lo = Vector(map(min, lo, a))
        hi = Vector(map(max, hi, b))
    lo.z = min(lo.z, 0.0)
    add_floor(lo, hi)
    tmp = tempfile.mkdtemp()
    pngs = []
    for view in (WORLD_VIEW, FRONT_VIEW, SIDE_VIEW):
        for f in times:
            scene.frame_set(f)
            png = os.path.join(tmp, f"{len(pngs)}.png")
            render_scene(png, size, view, (lo, hi))
            pngs.append(png)
    compose_sheet(pngs, out, size, cols=frames)
    print("STRIP", out, "frames", times, "fps", scene.render.fps)


main()
