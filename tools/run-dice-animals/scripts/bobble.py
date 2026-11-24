"""The Bobble kid: shared body and renderer for the Halloween costume concepts.

Concept blockouts from plain Blender primitives (flat shaded, Workbench), not
the asset pipeline. Every costume is a function `build()` that draws one kid
at the origin with `body()` (the shared Bobble body) and its own pieces, then
`render_costume(slug, build)` writes three views (3/4, front, side) and a
sheet. Blender units; the ground is z = 0; the kid faces -y.

The Bobble body: a giant head (about two thirds of the height) on a tiny
body: chunky shoes, stub legs, a short boxy torso, short arms, mitten hands.

    Blender -b --factory-startup --python <costume file> -- <out dir>
"""
import math
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "blockout.py")).read()
exec(compile(_src[: _src.rindex("\nmain()")], "blockout.py", "exec"))  # box, ball, can, limb, hand_mitt, face, mat, ...

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

# -- proportions (shared by every costume) --
FOOT = 0.5
LEG = 0.3
TW, TH, TD = 0.95, 0.85, 0.7   # torso width, height, depth
HIP = FOOT * 0.4 + LEG          # top of the legs
TOP = HIP + TH                  # shoulders / neck
HEAD = 2.5                      # head size (the cube head is HEAD wide)
HEAD_Z = TOP + 0.3 + HEAD * 0.5  # head centre
MITT = 0.4
ARM_DROP = 0.55

SKIN = SKINS[1]
# Skin tones a kid can have, light to deep. Every costume draws exposed skin
# in SKIN; render_costume swaps that colour for the chosen tone.
SKIN_TONES = [(0.99, 0.86, 0.74), (0.95, 0.78, 0.62), (0.88, 0.66, 0.48), (0.74, 0.50, 0.32), (0.56, 0.35, 0.21), (0.38, 0.23, 0.14)]


def apply_skin(tone):
    """Recolour every material drawn in SKIN to `tone` (sRGB 0-1)."""
    for m in bpy.data.materials:
        c = m.diffuse_color
        if all(abs(c[i] - SKIN[i]) < 1e-3 for i in range(3)):
            m.diffuse_color = (*tone, 1.0)
            bsdf = m.node_tree.nodes.get("Principled BSDF") if m.use_nodes else None
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in tone], 1.0)


def hand_points():
    """Mitten centres (left, right)."""
    return {s: (s * (TW * 0.5 + 0.08) + s * 0.18, -0.08, TOP - 0.66) for s in (-1, 1)}


def body(skin=SKIN, shirt=(0.30, 0.68, 0.40), pants=PANTS, shoe=SHOE, sleeve=None, mitt=None, legs=True, arms=True, torso=True,
         leg_colour=None):
    """The shared Bobble body, from the shoes to the shoulders. Colour any
    part; turn parts off when a costume replaces them. Returns anchors."""
    sleeve = sleeve or shirt
    mitt = mitt or skin
    for s in (-1, 1):
        fx = s * TW * 0.24
        box(fx, -FOOT * 0.25, FOOT * 0.22, FOOT * 0.75, FOOT * 1.15, FOOT * 0.44, shoe, bevel=FOOT * 0.14, segs=2)
        if legs:
            limb((fx, 0, FOOT * 0.4), (fx, 0, HIP), 0.11, leg_colour or pants)
    if torso:
        box(0, 0, HIP + TH * 0.18, TW, TD, TH * 0.36, pants, bevel=0.06)
        box(0, 0, HIP + TH * 0.66, TW, TD, TH * 0.68, shirt, bevel=0.08)
    if arms:
        for s in (-1, 1):
            sx = s * (TW * 0.5 + 0.08)
            limb((sx, 0, TOP - 0.15), (sx + s * 0.16, -0.05, TOP - ARM_DROP), 0.11, sleeve)
            hand_mitt(sx + s * 0.18, -0.08, TOP - 0.66, s, MITT, mitt)
    return {"hip": HIP, "top": TOP, "head_z": HEAD_Z, "head": HEAD, "hands": hand_points()}


def kid_head(skin=SKIN, hair=(0.25, 0.15, 0.09), eyes=True):
    """The default giant rounded-cube kid head with a hair cap and a face."""
    head_cube(0, HEAD_Z, HEAD, skin, hair)


def front_y(width=HEAD, depth_ratio=0.92):
    """The y of a box head's front face."""
    return -width * depth_ratio * 0.5


def octa(x, y, z, r, h, rgb, r2=None, flat_front=True, rot=(0, 0, 0)):
    """An 8-sided can; with flat_front a flat face points at the camera."""
    rz = math.radians(22.5) if flat_front else 0.0
    return can(x, y, z, r, h, rgb, n=8, r2=r2, rot=(rot[0], rot[1], rot[2] + rz))


VIEWS = (("34", (0.62, -1.0, 0.42)), ("front", (0.0, -1.0, 0.25)), ("side", (1.0, 0.0, 0.25)))


def render_costume(slug, build, out_dir, ortho=6.6, target_z=2.4):
    """Build one costume in a fresh scene and render the three views and a sheet."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    scene = bpy.context.scene
    build()
    tone = os.environ.get("RVX_SKIN")
    if tone is not None:
        apply_skin(SKIN_TONES[int(tone)])
        slug = f"{slug}-skin{tone}"
    scene.render.engine = "BLENDER_EEVEE"
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.97, 0.93, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    scene.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.3
    sun.data.angle = math.radians(12)
    sun.rotation_euler = (math.radians(40), math.radians(18), math.radians(35))
    scene.collection.objects.link(sun)
    scene.render.resolution_x, scene.render.resolution_y = 700, 820
    scene.render.film_transparent = True
    os.makedirs(out_dir, exist_ok=True)
    pngs = []
    for name, view in VIEWS:
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = ortho
        scene.collection.objects.link(cam)
        target = Vector((0, 0, target_z))
        cam.location = target + Vector(view).normalized() * 40
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = 200
        scene.camera = cam
        png = os.path.join(out_dir, f"{slug}-{name}.png")
        scene.render.filepath = png
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(cam)
        pngs.append(png)
    _sheet(pngs, os.path.join(out_dir, f"{slug}-sheet.png"))
    print("WROTE", slug)


def _sheet(pngs, out):
    import numpy as np
    imgs = [bpy.data.images.load(p) for p in pngs]
    w, h = imgs[0].size
    bg = np.array([0.86, 0.83, 0.78])
    tiles = []
    for img in imgs:
        a = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(a)
        a = a.reshape(h, w, 4)
        tiles.append(a[..., :3] * a[..., 3:4] + bg * (1 - a[..., 3:4]))
    rgb = np.concatenate(tiles, axis=1)
    full = np.concatenate([rgb, np.ones(rgb.shape[:2] + (1,))], axis=2).astype(np.float32)
    sheet = bpy.data.images.new("sheet", w * len(imgs), h, alpha=False)
    sheet.pixels.foreach_set(full.ravel())
    sheet.filepath_raw = out
    sheet.file_format = "PNG"
    sheet.save()


def run(costumes):
    """Render costumes = {slug: build}. Out dir is the argument after '--'."""
    out = sys.argv[sys.argv.index("--") + 1]
    only = sys.argv[sys.argv.index("--") + 2:] if len(sys.argv) > sys.argv.index("--") + 2 else None
    for slug, build in costumes.items():
        if only and slug not in only:
            continue
        render_costume(slug, build, out)
