"""Spaceman: the classic kid astronaut. A giant round fishbowl helmet (clear,
with a big white glint) sits on a chunky silver collar, the kid's own head
inside it; a puffy white suit with ring-quilted sleeves and legs, a chest
control box, chunky grey gloves and moon boots; a backpack life-support box
with two hoses curling round to the collar; a little flag (a planet on a
pennant) in one glove and the full bucket in the other."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

SUIT, SUIT_D, GREY, SILVER = (0.97, 0.97, 0.95), (0.80, 0.82, 0.86), (0.62, 0.64, 0.70), (0.78, 0.80, 0.86)
ORANGE, BLUE, RED, YEL, GREEN = (1.0, 0.5, 0.1), (0.2, 0.5, 0.95), (0.95, 0.25, 0.25), (1.0, 0.85, 0.15), (0.3, 0.8, 0.4)
HAIR = (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def glass(o, rgb=(0.7, 0.88, 1.0), alpha=0.16):
    """Swap an object's material for a clear tinted glass."""
    m = bpy.data.materials.new("glass")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1.0)
    # a bubble: nearly clear face-on, frosted towards the rim so the bowl's outline reads
    nt = m.node_tree
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.0
    ma = nt.nodes.new("ShaderNodeMath")
    ma.operation = "MULTIPLY_ADD"
    ma.inputs[1].default_value = 0.75
    ma.inputs[2].default_value = alpha * 0.25
    nt.links.new(lw.outputs["Facing"], pw.inputs[0])
    nt.links.new(pw.outputs[0], ma.inputs[0])
    nt.links.new(ma.outputs[0], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    m.diffuse_color = (*rgb, alpha)
    try:
        m.surface_render_method = "BLENDED"
    except AttributeError:
        m.blend_method = "BLEND"
    m.use_backface_culling = False
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def puff_limb(p0, p1, r, rgb, rings=2, ring_rgb=None):
    """A puffy padded sleeve: a bar with fat quilted rings along it."""
    limb(p0, p1, r, rgb, n=8)
    for k in range(rings):
        t = (k + 0.5) / rings
        p = tuple(a + (b - a) * t for a, b in zip(p0, p1))
        ball(*p, r * 2.7, r * 2.7, r * 2.2, ring_rgb or rgb, seg=8, ring=6)


def glove(x, y, z, s):
    hand_mitt(x, y, z, s, MITT * 1.1, GREY)
    can(x, y, z + 0.3, 0.22, 0.16, SUIT_D, n=8)  # the cuff ring


def helmet(cz, r=1.6, collar_rgb=SILVER):
    """The fishbowl: a kid head inside a clear ball on a collar ring."""
    head_cube(0, cz - 0.05, 2.1, SKIN, HAIR)
    o = ball(0, 0, cz, r * 2, r * 2, r * 2, WHITE, seg=20, ring=14)
    glass(o)
    # the collar ring the bowl sits on
    can(0, 0, cz - r * 0.86, r * 0.62, 0.34, collar_rgb, n=16)
    can(0, 0, cz - r * 0.86 + 0.2, r * 0.56, 0.08, SUIT_D, n=16)
    glint(cz, r)


def glint(cz, r, x0=0.0):
    """A curved white streak and a dot on the bowl's upper left, lying on the surface."""
    segs = [(-142 + 1.6 * k, 10 + 4.5 * k, 0.13, 0.27) for k in range(11)] + [(-112, 66, 0.15, 0.15)]
    for az, el, w, l in segs:
        a, e = math.radians(az), math.radians(el)
        n = Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
        p = Vector((x0, 0, cz)) + n * (r + 0.01)
        o = box(0, 0, 0, w, l, 0.03, WHITE)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = n.to_track_quat("Z", "Y")
        o.location = p


def suit(trim=ORANGE):
    """The puffy white suit, backpack and hoses (shared look with the space cat)."""
    body(shirt=SUIT, pants=SUIT, leg_colour=SUIT, shoe=SUIT_D, torso=False, arms=False)
    for s in (-1, 1):  # chunky moon-boot cuffs over the shoes
        box(s * TW * 0.24, -0.05, FOOT * 0.62, 0.48, 0.5, 0.26, SUIT_D, bevel=0.1, segs=2)
        box(s * TW * 0.24, -FOOT * 0.25, 0.06, FOOT * 0.8, FOOT * 1.2, 0.12, GREY, bevel=0.04)  # sole
    # puffy torso: wider than the base torso, with a belt and a chest box
    box(0, 0, HIP + TH * 0.5, TW + 0.25, TD + 0.25, TH + 0.12, SUIT, bevel=0.22, segs=2)
    box(0, 0, HIP + 0.12, TW + 0.3, TD + 0.3, 0.16, GREY, bevel=0.06)
    fy = -(TD + 0.25) / 2
    box(0, fy - 0.04, HIP + 0.55, 0.62, 0.14, 0.38, SUIT_D, bevel=0.06)
    for k, c in enumerate((RED, YEL, GREEN)):
        can(-0.18 + k * 0.18, fy - 0.12, HIP + 0.6, 0.06, 0.06, c, n=8, rot=X90)
    box(0, fy - 0.12, HIP + 0.45, 0.4, 0.04, 0.08, BLUE)
    for s in (-1, 1):  # trim stripes on the shoulders
        box(s * 0.42, fy + 0.02, TOP - 0.1, 0.18, 0.08, 0.16, trim, bevel=0.03)
    # the backpack life-support box with two hoses up to the collar
    by = (TD + 0.25) / 2 + 0.28
    box(0, by, HIP + 0.75, 1.15, 0.6, 1.25, SUIT_D, bevel=0.14, segs=2)
    box(0, by + 0.3, HIP + 0.9, 0.7, 0.06, 0.5, SILVER, bevel=0.04)
    for s in (-1, 1):
        can(s * 0.36, by + 0.32, HIP + 0.4, 0.09, 0.06, trim, n=8, rot=X90)
        pts = [(s * 0.5, by - 0.1, HIP + 1.25), (s * 0.85, by - 0.25, HIP + 1.35), (s * 0.95, -0.05, TOP + 0.25), (s * 0.7, -0.35, TOP + 0.35)]
        for a, b in zip(pts, pts[1:]):
            limb(a, b, 0.08, GREY, n=8)
            ball(*b, 0.17, 0.17, 0.17, GREY, seg=6, ring=4)


def planet(x, y, z, rgb=BLUE):
    can(x, y - 0.04, z, 0.15, 0.04, rgb, n=10, rot=X90)
    box(x, y - 0.06, z, 0.42, 0.04, 0.05, YEL, rot=(0, math.radians(20), 0))


def arms_flag_bucket(flag=ORANGE, emblem=planet):
    """Puffy arms: the left glove raises a little flag, the right carries the full bucket."""
    sx = TW * 0.5 + 0.18
    lh = (-1.25, -0.25, TOP - 0.1)
    puff_limb((-sx, 0, TOP - 0.15), (lh[0] + 0.1, lh[1], lh[2] - 0.05), 0.13, SUIT, rings=2)
    glove(*lh, -1)
    # the flag: a pole through the glove, a pennant with a planet on it
    px, py = lh[0] - 0.02, lh[1] - 0.2
    limb((px, py, lh[2] - 0.4), (px, py, lh[2] + 1.55), 0.035, SILVER)
    ball(px, py, lh[2] + 1.6, 0.12, 0.12, 0.12, YEL, seg=6, ring=4)
    box(px - 0.4, py, lh[2] + 1.27, 0.78, 0.04, 0.5, flag, bevel=0.02)
    emblem(px - 0.4, py, lh[2] + 1.27)
    rh = (sx + 0.22, -0.1, TOP - 0.68)
    puff_limb((sx, 0, TOP - 0.15), (rh[0], rh[1], rh[2] + 0.3), 0.13, SUIT, rings=2)
    glove(*rh, 1)
    bucket(rh, full=True, size=0.6)


def build():
    suit()
    arms_flag_bucket()
    helmet(HEAD_Z + 0.15)


if __name__ == "__main__" or True:
    run({"spaceman": build})
