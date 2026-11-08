"""Concept blockouts: many chibi kid silhouettes from plain primitives, flat
shaded, rendered side by side from a 3/4 camera. A sketch tool, not the
asset pipeline.

    Blender -b --factory-startup --python blockout.py -- out.png
"""
import math
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]

SKINS = [(0.88, 0.64, 0.48), (0.95, 0.78, 0.62), (0.62, 0.40, 0.26), (0.42, 0.26, 0.17), (0.80, 0.55, 0.38)]
DARK = (0.08, 0.06, 0.05)
WHITE = (1, 1, 1)
PANTS = (0.18, 0.30, 0.58)
SHOE = (0.22, 0.15, 0.12)
CHEEK = (0.95, 0.55, 0.65)

_mats = {}


def mat(rgb):
    key = tuple(round(c, 3) for c in rgb)
    if key not in _mats:
        m = bpy.data.materials.new(f"m{len(_mats)}")
        m.diffuse_color = (*rgb, 1.0)
        m.use_backface_culling = True  # every part is a closed solid: single-sided halves the raster work
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1.0)  # sRGB picks to linear
            bsdf.inputs["Roughness"].default_value = 0.9
        _mats[key] = m
    return _mats[key]


SMOOTH_ANGLE = math.radians(60)  # wider than an 8-sided ball's steps (45), narrower than a box corner (90)


def finish(obj, rgb, bevel=0.0, segs=1):
    obj.data.materials.append(mat(rgb))
    if bevel > 0:
        b = obj.modifiers.new("b", "BEVEL")
        b.width = bevel
        b.segments = segs
        b.limit_method = "NONE"
        b.harden_normals = True  # the flat faces stay flat; only the rounding shades smooth
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.set_sharp_from_angle(angle=SMOOTH_ANGLE)  # smooth across bevel steps and round sides, crisp at real corners
    return obj


def box(x, y, z, sx, sy, sz, rgb, bevel=0.0, segs=1, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z), rotation=rot)
    o = bpy.context.object
    o.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, rgb, bevel, segs)


def ball(x, y, z, sx, sy, sz, rgb, seg=8, ring=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, location=(x, y, z), rotation=rot)
    o = bpy.context.object
    o.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, rgb)


def can(x, y, z, r, h, rgb, n=8, r2=None, rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=(x, y, z), rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r2, depth=h, location=(x, y, z), rotation=rot)
    return finish(bpy.context.object, rgb)


def limb(p0, p1, r, rgb, n=6):
    """A round bar between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=d.length, location=(p0 + p1) / 2)
    o = bpy.context.object
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    return finish(o, rgb)


def label(x, text, sub):
    for i, (t, size) in enumerate(((text, 0.42), (sub, 0.26))):
        bpy.ops.object.text_add(location=(x, 0, -0.75 - i * 0.5))
        o = bpy.context.object
        o.data.body = t
        o.data.size = size
        o.data.align_x = "CENTER"
        o.rotation_euler = (math.radians(62), 0, math.radians(30))
        o.data.materials.append(mat(DARK if i == 0 else (0.35, 0.33, 0.3)))


# -- heads (centre at z = cz, size ~w), all face -y --

def face(x, cz, front_y, w, eye=0.16, gap=0.22, cheeks=True, smile=True):
    for s in (-1, 1):
        ex = x + s * w * gap
        can(ex, front_y - 0.02, cz + w * 0.05, w * eye * 0.5, 0.06, DARK, n=10, rot=(math.radians(90), 0, 0))
        can(ex - w * 0.03, front_y - 0.06, cz + w * 0.09, w * eye * 0.17, 0.04, WHITE, n=6, rot=(math.radians(90), 0, 0))
        if cheeks:
            box(x + s * w * 0.33, front_y - 0.01, cz - w * 0.08, w * 0.12, 0.04, w * 0.06, CHEEK)
    if smile:
        # a little U smile: a bottom bar and two corners tipped up
        my = cz - w * 0.14
        box(x, front_y - 0.02, my, w * 0.09, 0.04, w * 0.035, DARK)
        for s in (-1, 1):
            box(x + s * w * 0.058, front_y - 0.02, my + w * 0.018, w * 0.05, 0.04, w * 0.035, DARK, rot=(0, s * math.radians(-40), 0))


def head_cube(x, cz, w, skin, hair):
    box(x, 0, cz, w, w * 0.92, w * 0.9, skin, bevel=w * 0.14, segs=2)
    box(x, w * 0.05, cz + w * 0.3, w * 1.04, w * 0.98, w * 0.36, hair, bevel=w * 0.14, segs=2)
    face(x, cz - w * 0.05, -w * 0.46, w)


def head_ball(x, cz, w, skin, hair):
    ball(x, 0, cz, w, w, w * 0.95, skin, seg=10, ring=7)
    ball(x, w * 0.06, cz + w * 0.12, w * 1.04, w * 1.02, w * 0.8, hair, seg=10, ring=7)
    box(x, -w * 0.25, cz + w * 0.22, w * 0.7, w * 0.3, w * 0.28, hair)  # fringe
    face(x, cz - w * 0.08, -w * 0.47, w)


def head_egg(x, cz, w, skin, hair):
    ball(x, 0, cz, w * 0.9, w * 0.88, w * 1.3, skin, seg=10, ring=8)
    can(x, 0, cz + w * 0.62, w * 0.12, w * 0.3, hair, n=6, r2=0.0)  # a single tuft
    face(x, cz - w * 0.12, -w * 0.43, w * 0.9)


def head_wide(x, cz, w, skin, hair):
    box(x, 0, cz, w * 1.35, w * 0.8, w * 0.7, skin, bevel=w * 0.1, segs=2)
    box(x, w * 0.04, cz + w * 0.3, w * 1.4, w * 0.86, w * 0.18, hair, bevel=w * 0.06)
    face(x, cz - w * 0.04, -w * 0.4, w * 1.1, gap=0.3)


def head_tall(x, cz, w, skin, hair):
    box(x, 0, cz, w * 0.78, w * 0.8, w * 1.25, skin, bevel=w * 0.12, segs=2)
    box(x, w * 0.04, cz + w * 0.58, w * 0.84, w * 0.86, w * 0.22, hair, bevel=w * 0.08)
    face(x, cz + w * 0.02, -w * 0.4, w * 0.85)


def head_bean(x, cz, w, skin, hair):
    """A trapezoid head, wide jaw, narrow top."""
    can(x, 0, cz, w * 0.66, w * 1.0, skin, n=8, r2=w * 0.46)
    can(x, 0, cz + w * 0.56, w * 0.5, w * 0.16, hair, n=8, r2=w * 0.3)
    face(x, cz - w * 0.08, -w * 0.6, w)


def head_onion(x, cz, w, skin, hair):
    ball(x, 0, cz, w * 1.05, w, w * 0.9, skin, seg=8, ring=6)
    can(x, 0, cz + w * 0.55, w * 0.35, w * 0.45, hair, n=8, r2=0.02)  # a swirl point on top
    face(x, cz - w * 0.05, -w * 0.48, w)


def head_can(x, cz, w, skin, hair):
    can(x, 0, cz, w * 0.52, w * 0.95, skin, n=10)
    can(x, 0, cz + w * 0.52, w * 0.56, w * 0.12, hair, n=10)
    face(x, cz, -w * 0.52, w)


# -- hands at a point --

def hand_mitt(x, y, z, s, w, skin):
    box(x, y, z, w * 0.8, w, w * 1.1, skin, bevel=w * 0.2, segs=2)
    box(x - s * w * 0.42, y - w * 0.25, z + w * 0.15, w * 0.3, w * 0.34, w * 0.5, skin, bevel=w * 0.1)


def hand_ball(x, y, z, s, w, skin):
    ball(x, y, z, w, w, w, skin, seg=8, ring=6)


def hand_fingers(x, y, z, s, w, skin):
    """A cartoon three-finger hand."""
    box(x, y, z + w * 0.1, w * 0.7, w * 0.6, w * 0.6, skin, bevel=w * 0.1)
    for i, dy in enumerate((-0.25, 0.0, 0.25)):
        box(x, y + dy * w, z - w * 0.38, w * 0.22, w * 0.22, w * 0.5, skin, bevel=w * 0.06)
    box(x - s * w * 0.42, y - w * 0.15, z + w * 0.05, w * 0.3, w * 0.22, w * 0.22, skin)


def hand_paddle(x, y, z, s, w, skin):
    box(x, y, z, w * 1.0, w * 0.3, w * 1.3, skin, bevel=w * 0.12, segs=2)


def hand_paw(x, y, z, s, w, skin):
    ball(x, y, z, w * 1.15, w * 1.15, w * 0.95, skin, seg=8, ring=6)
    for dy in (-0.3, 0.0, 0.3):
        ball(x, y - w * 0.45 + 0, z - w * 0.15 + 0, w * 0.0 + w * 0.32, w * 0.32, w * 0.32, (0.95, 0.75, 0.75), seg=6, ring=4) if dy == 0.0 else None


HANDS = {"mitt": hand_mitt, "ball": hand_ball, "fingers": hand_fingers, "paddle": hand_paddle, "paw": hand_paw}
HEADS = {"cube": head_cube, "ball": head_ball, "egg": head_egg, "wide": head_wide, "tall": head_tall, "bean": head_bean, "onion": head_onion, "can": head_can}


def kid(x, spec):
    """Build one kid at x. Heights in units; the ground is z = 0."""
    leg, legr, torso_w, torso_h, torso_d, torso_shape = spec["leg"], spec["leg_r"], spec["tw"], spec["th"], spec["td"], spec.get("torso", "box")
    skin, hair, shirt = spec["skin"], spec["hair"], spec["shirt"]
    foot = spec.get("foot", 0.5)
    # feet: big rounded shoes
    for s in (-1, 1):
        fx = x + s * torso_w * 0.24
        box(fx, -foot * 0.25, foot * 0.22, foot * 0.75, foot * 1.15, foot * 0.44, SHOE, bevel=foot * 0.14, segs=2)
        if leg > 0:
            limb((fx, 0, foot * 0.4), (fx, 0, foot * 0.4 + leg), legr, PANTS)
    hip = foot * 0.4 + leg
    # torso
    if torso_shape == "box":
        box(x, 0, hip + torso_h * 0.18, torso_w, torso_d, torso_h * 0.36, PANTS, bevel=0.08)
        box(x, 0, hip + torso_h * 0.68, torso_w, torso_d, torso_h * 0.64, shirt, bevel=0.1)
    elif torso_shape == "pear":
        can(x, 0, hip + torso_h * 0.2, torso_w * 0.55, torso_h * 0.4, PANTS, n=8, r2=torso_w * 0.52)
        can(x, 0, hip + torso_h * 0.7, torso_w * 0.52, torso_h * 0.6, shirt, n=8, r2=torso_w * 0.32)
    elif torso_shape == "wedge":
        can(x, 0, hip + torso_h * 0.18, torso_w * 0.3, torso_h * 0.36, PANTS, n=4, r2=torso_w * 0.36, rot=(0, 0, math.radians(45)))
        can(x, 0, hip + torso_h * 0.68, torso_w * 0.36, torso_h * 0.64, shirt, n=4, r2=torso_w * 0.62, rot=(0, 0, math.radians(45)))
    elif torso_shape == "ball":
        ball(x, 0, hip + torso_h * 0.5, torso_w, torso_d * 1.2, torso_h, shirt, seg=10, ring=7)
        box(x, 0, hip + torso_h * 0.2, torso_w * 0.9, torso_d * 0.95, torso_h * 0.3, PANTS, bevel=0.1)
    top = hip + torso_h
    # arms and hands
    hw = spec["hand"]
    arm_len = spec.get("arm", torso_h * 0.75)
    for s in (-1, 1):
        sx = x + s * (torso_w * 0.5 + 0.08)
        hx, hz = sx + s * 0.18, top - 0.15 - arm_len
        if not spec.get("float_hands"):
            limb((sx, 0, top - 0.15), (hx, 0, hz + hw * 0.3), spec.get("arm_r", 0.13), shirt)
        else:
            hx += s * 0.25
        HANDS[spec["hand_shape"]](hx, -0.05, hz, s, hw, skin)
    # neck gap and head
    hs = spec["head"]
    HEADS[spec["head_shape"]](x, top + hs * 0.48 + spec.get("neck", 0.0), hs, skin, hair)


SPECS = [
    dict(name="Stilts", note="spindly legs, ball head", leg=2.4, leg_r=0.07, tw=0.9, th=1.0, td=0.7, head=1.5, head_shape="ball", hand=0.36, hand_shape="ball", skin=SKINS[0], hair=(0.22, 0.14, 0.08), shirt=(0.30, 0.68, 0.32), foot=0.45),
    dict(name="No Legs", note="feet on the hips, cube head", leg=0.0, leg_r=0.1, tw=1.3, th=1.1, td=1.0, head=2.0, head_shape="cube", hand=0.62, hand_shape="mitt", skin=SKINS[1], hair=(0.88, 0.40, 0.17), shirt=(0.55, 0.36, 0.85), foot=0.62),
    dict(name="Floaty", note="no arms, floating paddles", leg=0.25, leg_r=0.16, tw=1.2, th=1.2, td=0.9, head=1.9, head_shape="egg", hand=0.5, hand_shape="paddle", float_hands=True, skin=SKINS[2], hair=(0.08, 0.07, 0.06), shirt=(0.95, 0.62, 0.20), foot=0.55),
    dict(name="Noodle", note="arms to the floor, tall head", leg=0.9, leg_r=0.1, tw=0.9, th=1.2, td=0.7, head=1.6, head_shape="tall", hand=0.5, hand_shape="fingers", arm=2.0, arm_r=0.08, skin=SKINS[3], hair=(0.10, 0.08, 0.06), shirt=(0.90, 0.30, 0.38), foot=0.5),
    dict(name="Pear", note="bottom-heavy, wide head", leg=0.35, leg_r=0.18, tw=1.6, th=1.3, td=1.2, torso="pear", head=1.5, head_shape="wide", hand=0.5, hand_shape="ball", skin=SKINS[4], hair=(0.95, 0.80, 0.30), shirt=(0.25, 0.62, 0.82), foot=0.55),
    dict(name="Brick", note="square shoulders, stub legs", leg=0.3, leg_r=0.2, tw=1.9, th=1.4, td=1.0, torso="wedge", head=1.6, head_shape="cube", hand=0.75, hand_shape="mitt", skin=SKINS[0], hair=(0.15, 0.10, 0.08), shirt=(0.85, 0.28, 0.25), foot=0.6),
    dict(name="Gumball", note="ball body, can head", leg=0.5, leg_r=0.12, tw=1.4, th=1.4, td=1.1, torso="ball", head=1.5, head_shape="can", hand=0.42, hand_shape="ball", skin=SKINS[1], hair=(0.62, 0.20, 0.55), shirt=(0.35, 0.80, 0.70), foot=0.5),
    dict(name="Bigfoot", note="clown feet, onion head", leg=0.6, leg_r=0.1, tw=1.0, th=1.0, td=0.8, head=1.6, head_shape="onion", hand=0.4, hand_shape="fingers", skin=SKINS[2], hair=(0.30, 0.18, 0.10), shirt=(0.95, 0.85, 0.30), foot=1.05),
    dict(name="Pawsy", note="huge paws, bean head", leg=0.4, leg_r=0.16, tw=1.2, th=1.2, td=0.9, head=1.7, head_shape="bean", hand=0.9, hand_shape="ball", skin=SKINS[4], hair=(0.12, 0.10, 0.10), shirt=(0.45, 0.45, 0.85), foot=0.55),
    dict(name="Bobble", note="giant head, tiny all else", leg=0.3, leg_r=0.1, tw=0.85, th=0.8, td=0.65, head=2.5, head_shape="cube", hand=0.38, hand_shape="mitt", skin=SKINS[3], hair=(0.92, 0.55, 0.20), shirt=(0.30, 0.70, 0.40), foot=0.45),
    dict(name="Stork", note="long legs, wide torso", leg=1.8, leg_r=0.09, tw=1.6, th=0.9, td=1.0, head=1.5, head_shape="wide", hand=0.55, hand_shape="mitt", skin=SKINS[1], hair=(0.20, 0.12, 0.08), shirt=(0.80, 0.35, 0.70), foot=0.55),
    dict(name="Pebble", note="no legs, ball everything", leg=0.0, leg_r=0.1, tw=1.5, th=1.5, td=1.3, torso="ball", head=1.8, head_shape="ball", hand=0.45, hand_shape="ball", float_hands=True, skin=SKINS[0], hair=(0.40, 0.25, 0.15), shirt=(0.95, 0.45, 0.30), foot=0.5),
]


def main():
    import json, os
    out_dir = OUT
    os.makedirs(out_dir, exist_ok=True)
    index = []
    for i, spec in enumerate(SPECS):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        _mats.clear()
        scene = bpy.context.scene
        kid(0.0, spec)
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        cam.data.type = "ORTHO"
        cam.data.ortho_scale = 6.6  # the same for every kid, so sizes compare
        scene.collection.objects.link(cam)
        d = Vector((0.62, -1.0, 0.42)).normalized()
        target = Vector((0, 0, 2.5))
        cam.location = target + d * 40
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.clip_end = 200
        scene.camera = cam
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.view_settings.view_transform = "Standard"
        sh = scene.display.shading
        sh.light = "STUDIO"
        sh.color_type = "MATERIAL"
        sh.show_shadows = True
        sh.shadow_intensity = 0.2
        scene.display.light_direction = (0.4, -0.3, 0.85)
        scene.render.resolution_x, scene.render.resolution_y = 560, 700
        scene.render.film_transparent = True
        scene.world = bpy.data.worlds.new("w")
        scene.world.color = (0.86, 0.83, 0.78)
        png = os.path.join(out_dir, f"{i:02d}.png")
        scene.render.filepath = png
        bpy.ops.render.render(write_still=True)
        index.append({"png": os.path.basename(png), "name": spec["name"], "note": spec["note"]})
    with open(os.path.join(out_dir, "index.json"), "w") as fh:
        json.dump(index, fh)
    print("WROTE", out_dir)


main()
