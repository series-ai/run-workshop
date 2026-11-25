"""Review renders: GLBs on light grey, one PNG each plus an optional sheet.
Ported from tools/run-monster-trucks/kit/render.py.

    blender -b -t 1 --factory-startup --python kit/render.py -- --out DIR [--size 640] [--sheet sheet.png]
        [--side|--front|--top|--back] [--scene] a.glb ...

--scene imports every GLB into one scene (they already carry their own
placement, e.g. from lint/scene.mjs) and renders it once.
"""
from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Vector

RVX = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "run-voxel-packs", "blender"))
sys.path.insert(0, RVX)
from render_util import compose_sheet, gltf_rest_pose, scene_bounds, show_base_color  # noqa: E402

VIEW = Vector((-math.sin(math.radians(58)), math.cos(math.radians(58)), 0.45)).normalized()
VIEWS = {"side": Vector((-1, 0.0, 0.08)), "front": Vector((math.sin(math.radians(25)), math.cos(math.radians(25)), 0.18)),
         "top": Vector((0.0, 0.25, 1.0)),
         "back": Vector((math.sin(math.radians(25)), -math.cos(math.radians(25)), 0.18))}


def setup(png: str, size: int, view: Vector) -> None:
    scene = bpy.context.scene
    lo, hi = scene_bounds(scene)
    centre, radius = (lo + hi) / 2, max((hi - lo).length / 2, 1e-4)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = radius * 2.05
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = centre + view * radius * 4
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam_data.clip_end = radius * 20
    scene.camera = cam
    show_base_color()
    for mat in bpy.data.materials:  # matte, like the shipped look
        bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat.use_nodes else None
        if bsdf:
            bsdf.inputs["Roughness"].default_value = 1.0
            bsdf.inputs["Specular IOR Level"].default_value = 0.0
    scene.render.engine = "BLENDER_EEVEE"
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.2
    sun.angle = math.radians(8)
    so = bpy.data.objects.new("sun", sun)
    scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(38), 0, math.radians(-150))
    scene.render.film_transparent = False
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.world = bpy.data.worlds.new("w")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.62, 0.64, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    scene.eevee.taa_render_samples = 16
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = png
    bpy.ops.render.render(write_still=True)


def load(glb: str) -> None:
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    gltf_rest_pose(glb, [o for o in bpy.context.scene.objects if o not in before])


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out, size, sheet, files, view_name, as_scene = None, 640, None, [], None, False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--out":
            out = argv[i + 1]; i += 2
        elif a == "--size":
            size = int(argv[i + 1]); i += 2
        elif a == "--sheet":
            sheet = argv[i + 1]; i += 2
        elif a in ("--side", "--front", "--top", "--back"):
            view_name = a[2:]; i += 1
        elif a == "--scene":
            as_scene = True; i += 1
        else:
            files.append(a); i += 1
    out = os.path.abspath(out)  # Blender resolves relative render paths against the drive root
    sheet = os.path.abspath(sheet) if sheet else None
    os.makedirs(out, exist_ok=True)
    view = VIEWS.get(view_name, VIEW).normalized()
    suffix = f"-{view_name}" if view_name else ""
    if as_scene:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        for f in files:
            load(f)
        setup(os.path.join(out, f"scene{suffix}.png"), size, view)
        return
    pngs = []
    for f in files:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        load(f)
        png = os.path.join(out, os.path.splitext(os.path.basename(f))[0] + suffix + ".png")
        setup(png, size, view)
        pngs.append(png)
    if sheet:
        compose_sheet(pngs, sheet, size, cols=min(4, len(pngs)))


main()
sys.stdout.flush()
os._exit(0)
