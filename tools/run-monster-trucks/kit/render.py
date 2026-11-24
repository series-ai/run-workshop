"""Review render: GLBs at the concept angle (front toward lower-left, low 3/4)
on light grey, one PNG each plus an optional sheet.

    Blender -b -t 1 --factory-startup --python kit/render.py -- --out DIR [--size 640] [--sheet sheet.png] a.glb ...
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

VIEW = Vector((-math.sin(math.radians(58)), math.cos(math.radians(58)), 0.4)).normalized()


def render(glb: str, png: str, size: int, view: Vector) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    gltf_rest_pose(glb, list(bpy.context.scene.objects))
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


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :]
    out, size, sheet, files, side = None, 640, None, [], False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--out":
            out = argv[i + 1]; i += 2
        elif a == "--size":
            size = int(argv[i + 1]); i += 2
        elif a == "--sheet":
            sheet = argv[i + 1]; i += 2
        elif a == "--side":
            side = True; i += 1
        elif a == "--front":
            side = "front"; i += 1
        elif a in ("--straight", "--back"):
            side = a[2:]; i += 1
        else:
            files.append(a); i += 1
    os.makedirs(out, exist_ok=True)
    view = {True: Vector((-1, 0.0, 0.08)), "front": Vector((math.sin(math.radians(25)), math.cos(math.radians(25)), 0.18)),
            "straight": Vector((0, 1, 0.1)), "back": Vector((0, -1, 0.1))}.get(side, VIEW).normalized()
    pngs = []
    for f in files:
        png = os.path.join(out, os.path.splitext(os.path.basename(f))[0] + ({True: "-side", "front": "-front", "straight": "-straight", "back": "-back"}.get(side, "")) + ".png")
        render(f, png, size, view)
        pngs.append(png)
    if sheet:
        compose_sheet(pngs, sheet, size, cols=min(4, len(pngs)))


main()
sys.stdout.flush()
os._exit(0)
