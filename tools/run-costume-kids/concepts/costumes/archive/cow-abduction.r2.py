"""Cow abduction: a two-person cow costume caught by a flying saucer. The
front kid wears a big white cow head with black patches, a pink snout, little
horns and floppy ears, and looks out a face opening; the mitts poke out under
the head with the full bucket. Behind, the cow's long patched body hides a
second kid: only their sneakers, a swishing tail and a pink udder show. A
little silver saucer (a green alien waving in the dome) hovers over the back
half on a glowing beam of light, as if lifting the cow away."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

COW, PATCH, SNOUT, SNOUT_D = (0.98, 0.98, 0.96), (0.12, 0.11, 0.12), (1.0, 0.62, 0.7), (0.8, 0.38, 0.48)
HORN, SNEAK, HAIR = (0.98, 0.9, 0.62), (0.2, 0.62, 0.98), (0.3, 0.17, 0.09)
UFO, UFO_D, DOME, LIGHT = (0.78, 0.8, 0.86), (0.52, 0.55, 0.62), (0.62, 0.9, 1.0), (1.0, 0.9, 0.25)
ALIEN, BEAM = (0.45, 0.88, 0.32), (1.0, 0.95, 0.55)
X90 = (math.radians(90), 0, 0)


def glow_cone(x, y, z0, z1, r0, r1, rgb, alpha=0.45):
    """A see-through cone of light from z1 (radius r1, top) down to z0 (radius r0)."""
    return see_through(can(x, y, (z0 + z1) / 2, r0, z1 - z0, rgb, n=16, r2=r1), rgb, alpha)


def see_through(o, rgb, alpha, glow=0.6):
    m = bpy.data.materials.new("beam")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*[c ** 2.2 for c in rgb], 1.0)
    bsdf.inputs["Emission Color"].default_value = (*[c ** 2.2 for c in rgb], 1.0)
    bsdf.inputs["Emission Strength"].default_value = glow
    bsdf.inputs["Alpha"].default_value = alpha
    m.surface_render_method = "BLENDED"
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def shoe_pair(y, x0=0.0):
    for s in (-1, 1):
        fx = x0 + s * TW * 0.24
        box(fx, y - FOOT * 0.25, FOOT * 0.22, FOOT * 0.75, FOOT * 1.15, FOOT * 0.44, SNEAK, bevel=FOOT * 0.14, segs=2)
        limb((fx, y, FOOT * 0.4), (fx, y, 0.9), 0.11, COW)


def build():
    body(pants=COW, leg_colour=COW, shoe=SNEAK, torso=False, arms=False)
    # the cow's long body behind the head, hiding the second kid
    by0, by1, bz0, bz1 = 0.2, 3.3, 0.8, 2.45
    byc, bzc = (by0 + by1) / 2, (bz0 + bz1) / 2
    box(0, byc, bzc, 2.3, by1 - by0, bz1 - bz0, COW, bevel=0.5, segs=3)
    for s in (-1, 1):  # patches on the flanks
        box(s * 1.16, 1.3 + (0.25 if s > 0 else 0), 1.9, 0.06, 0.9, 0.6, PATCH, bevel=0.03)
        box(s * 1.16, 2.65 - (0.3 if s > 0 else 0), 1.25, 0.06, 0.7, 0.5, PATCH, bevel=0.03)
    box(0.35, 1.0, bz1 + 0.01, 0.8, 0.7, 0.06, PATCH, bevel=0.03)
    box(-0.4, 2.9, bz1 + 0.01, 0.7, 0.5, 0.06, PATCH, bevel=0.03)
    # the second kid's sneakers under the back half
    shoe_pair(2.6)
    # a pink udder with four teats
    uy = 1.75
    ball(0, uy, bz0 - 0.02, 0.8, 0.7, 0.5, SNOUT, seg=10, ring=6)
    for dx in (-0.18, 0.18):
        for dy in (-0.15, 0.15):
            can(dx, uy + dy, bz0 - 0.3, 0.06, 0.2, SNOUT_D, n=6)
    # the tail, flicking out, with a black tuft
    limb((0, by1 - 0.05, bz1 - 0.25), (0.35, by1 + 0.45, 1.3), 0.06, COW)
    ball(0.38, by1 + 0.5, 1.15, 0.3, 0.3, 0.42, PATCH, seg=8, ring=6)
    # the front kid's mitts poke out under the cow head; the right holds the bucket
    lh = (-1.5, -0.55, 1.35)
    limb((-0.7, -0.3, 1.6), lh, 0.11, COW)
    hand_mitt(*lh, -1, MITT, SKIN)
    rh = (1.55, -0.6, 1.45)
    limb((0.7, -0.3, 1.6), rh, 0.11, COW)
    hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.62)
    # the cow head: a big white rounded cube with patches
    w = HEAD
    hz = HEAD_Z
    fy = -w * 0.46
    box(0, 0, hz, w, w * 0.92, w * 0.9, COW, bevel=w * 0.14, segs=2)
    box(-0.8, 0.1, hz + w * 0.45 + 0.0, 0.9, 1.0, 0.08, PATCH, bevel=0.03)
    box(w * 0.5 + 0.0, 0.45, hz - 0.35, 0.08, 0.7, 0.55, PATCH, bevel=0.03)
    box(-w * 0.5 - 0.0, 0.2, hz - 0.3, 0.08, 0.8, 0.5, PATCH, bevel=0.03)
    box(0.75, fy - 0.01, hz + 0.88, 0.6, 0.06, 0.42, PATCH, bevel=0.03)
    # the face opening (skin, fringe, face)
    fz = hz + 0.3
    box(0, fy - 0.02, fz, 1.5, 0.08, 1.12, PATCH, bevel=0.04)
    box(0, fy - 0.06, fz, 1.36, 0.08, 0.98, SKIN, bevel=0.04)
    box(0, fy - 0.1, fz + 0.36, 1.2, 0.06, 0.2, HAIR, bevel=0.03)
    face(0, fz - 0.02, fy - 0.1, 1.45, eye=0.16, gap=0.2)
    # the big pink snout on the bottom of the face, with nostrils
    sz = hz - 0.82
    box(0, fy - 0.12, sz, 1.9, 0.4, 0.78, SNOUT, bevel=0.2, segs=2)
    for s in (-1, 1):
        ball(s * 0.42, fy - 0.33, sz + 0.03, 0.32, 0.08, 0.24, SNOUT_D, seg=8, ring=5)
    # little horns and floppy ears
    for s in (-1, 1):
        can(s * 0.75, -0.1, hz + w * 0.45 + 0.2, 0.17, 0.45, HORN, n=8, r2=0.05, rot=(0, s * math.radians(25), 0))
        box(s * (w * 0.5 + 0.32), -0.1, hz + 0.45, 0.62, 0.22, 0.34, COW, bevel=0.1, rot=(0, s * math.radians(-25), 0))
        box(s * (w * 0.5 + 0.36), -0.2, hz + 0.43, 0.42, 0.06, 0.2, SNOUT, bevel=0.04, rot=(0, s * math.radians(-25), 0))
    # the flying saucer over the back half
    ux, uy, uz = 0.0, 2.0, 4.65
    glow_cone(ux, uy, bz1 - 0.05, uz - 0.25, 1.25, 0.5, BEAM)
    can(ux, uy, uz - 0.18, 0.75, 0.22, UFO_D, n=16, r2=1.35)
    can(ux, uy, uz + 0.04, 1.35, 0.22, UFO, n=16, r2=1.0)
    see_through(ball(ux, uy, uz + 0.4, 1.3, 1.3, 1.0, DOME, seg=14, ring=8), DOME, 0.4, 0.1)
    for i in range(10):
        a = 2 * math.pi * i / 10
        ball(ux + 1.3 * math.cos(a), uy + 1.3 * math.sin(a), uz - 0.04, 0.2, 0.2, 0.16, LIGHT, seg=6, ring=4)
    # a tiny alien waving in the dome
    ball(ux, uy, uz + 0.45, 0.6, 0.55, 0.62, ALIEN, seg=10, ring=7)
    for s in (-1, 1):
        ball(ux + s * 0.13, uy - 0.25, uz + 0.48, 0.17, 0.08, 0.22, DARK, seg=8, ring=5)
        limb((ux + s * 0.12, uy, uz + 0.7), (ux + s * 0.2, uy, uz + 0.9), 0.025, ALIEN)
        ball(ux + s * 0.2, uy, uz + 0.92, 0.08, 0.08, 0.08, LIGHT, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("cow-abduction", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
