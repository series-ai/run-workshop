"""Build-time fitting guide: voxelize PN avatar bodies into rig-space grids.

    Blender -b --factory-startup --python blender/extract_body_ref.py -- <pn avatar glb> <out.npz>

Writes, per body ("species 1", "species 2"), occupancy (uint8, 1 = inside)
on the rig grid:
0.01 units per voxel, shape RIG_SHAPE, rig origin at voxel RIG_PIVOT.
Only used to fit clothes and skins; it never ships in a pack.
"""
from __future__ import annotations

import os
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rigspace import RIG_SHAPE, cell_center_gl, gl_to_bl  # noqa: E402

BODIES = ["species 1", "species 2"]


def voxelize(obj) -> np.ndarray:
    deps = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(deps)
    mesh = ev.to_mesh()
    mw = obj.matrix_world
    verts = [mw @ v.co for v in mesh.vertices]
    polys = [tuple(p.vertices) for p in mesh.polygons]
    bvh = BVHTree.FromPolygons(verts, polys)
    occ = np.zeros(RIG_SHAPE, np.uint8)
    sx, sy, sz = RIG_SHAPE
    ray = gl_to_bl((0.0, 0.0, 1.0))  # cast along glTF +z
    for i in range(sx):
        for j in range(sy):
            for k in range(sz):
                c = cell_center_gl(i, j, k)
                origin = gl_to_bl(c)
                # parity test: count hits along one ray
                hits, o = 0, origin.copy()
                while True:
                    loc, _n, _idx, _d = bvh.ray_cast(o, ray)
                    if loc is None:
                        break
                    hits += 1
                    o = loc + ray * 1e-5
                if hits % 2 == 1:
                    occ[i, j, k] = 1
    ev.to_mesh_clear()
    return occ


def main() -> None:
    src, out = sys.argv[sys.argv.index("--") + 1 :][:2]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    # Evaluate at rest: no action applied.
    for o in bpy.data.objects:
        if o.animation_data:
            o.animation_data.action = None
    arm.data.pose_position = "REST"
    arrays = {}
    for name in BODIES:
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise SystemExit(f"body {name!r} not found in {src}")
        occ = voxelize(obj)
        arrays[f"{name.replace(' ', '_')}_occ"] = occ
        print(f"BODY {name}: {int(occ.sum())} voxels")
    np.savez_compressed(out, **arrays)
    print("WROTE", out)


main()
