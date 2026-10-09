"""Renders GLBs side by side at their native scale, next to a person gauge
(personVoxels tall, from contracts/data/scale.json), for scale review.

blender -b --factory-startup --python lineup.py -- --out lineup.png [--size 1600] a.glb b.glb …
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_util import gltf_rest_pose, render_scene  # noqa: E402
from voxgrid import SCALE  # noqa: E402

GAP = 12
VIEW = Vector((math.sin(math.radians(30)), math.cos(math.radians(30)), 0.35)).normalized()  # glTF -Z front


def person_gauge(x: float) -> float:
    """A red column personVoxels tall, one tile wide; returns its width."""
    h, w = SCALE["personVoxels"], 12
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x + w / 2, 0, h / 2))
    gauge = bpy.context.active_object
    gauge.scale = (w, 8, h)
    mat = bpy.data.materials.new("gauge")
    mat.diffuse_color = (0.85, 0.12, 0.1, 1)
    gauge.data.materials.append(mat)
    return w


def build_lineup(files: list[str]) -> None:
    """Person gauge, then each GLB left to right at native scale, in rest pose."""
    x = person_gauge(0.0) + GAP
    for f in files:
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=f)
        new = list(set(bpy.data.objects) - before)
        gltf_rest_pose(f, new)
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ v.co for o in new if o.type == "MESH" for v in o.data.vertices]
        lo, hi = min(p.x for p in pts), max(p.x for p in pts)
        for root in (o for o in new if o.parent is None):
            root.location.x += x - lo
        x += (hi - lo) + GAP


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1:]
    out, size, files = None, 1600, []
    i = 0
    while i < len(argv):
        if argv[i] == "--out":
            out, i = argv[i + 1], i + 2
        elif argv[i] == "--size":
            size, i = int(argv[i + 1]), i + 2
        else:
            files.append(argv[i])
            i += 1
    if not out or not files:
        raise SystemExit("usage: lineup.py -- --out <png> [--size N] <glb> …")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_lineup(files)
    bpy.context.scene.display.shading.color_type = "TEXTURE"
    render_scene(out, size, VIEW)
    print(f"LINEUP {out}")


if __name__ == "__main__":
    main()
