"""Cowboy horse: the inflatable "riding" costume. A puffy tan horse body
round the kid's waist with a red saddle blanket and a leather saddle; a
puffy horse head with googly eyes, a toothy grin and a dark mane juts out in
front at belly height so the kid's face stays clear. Fake cowboy legs in
jeans and pointy boots hang in stirrups on the sides; the kid's real legs and
shoes are the horse's brown legs and hooves. A huge cowboy hat, a red
bandana, a lasso twirled overhead in one mitt and the full bucket in the
other (holding the reins)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

HORSE, HORSE_D, MANE, HOOF = (0.84, 0.48, 0.2), (0.6, 0.32, 0.12), (0.3, 0.16, 0.08), (0.24, 0.16, 0.12)
MUZZLE, BLANKET, SADDLE = (0.98, 0.9, 0.78), (0.88, 0.2, 0.22), (0.55, 0.3, 0.14)
JEANS, BOOT, HAT, HAT_D = (0.25, 0.42, 0.78), (0.62, 0.36, 0.16), (0.98, 0.96, 0.9), (0.85, 0.2, 0.25)
BANDANA, ROPE, SHIRT, HAIR = (0.92, 0.2, 0.25), (0.9, 0.78, 0.48), (0.95, 0.75, 0.2), (0.3, 0.17, 0.09)
X90 = (math.radians(90), 0, 0)


def build():
    body(pants=HORSE_D, leg_colour=HORSE_D, shoe=HOOF, torso=False, arms=False)
    with part("body"):  # the whole horse: body, saddle, tail, the fake legs, and the head with every feature on it
        # the puffy horse body round the waist
        bz = 1.06
        box(0, 0.35, bz, 2.5, 3.1, 1.3, HORSE, bevel=0.6, segs=2)
        # saddle blanket and saddle
        box(0, 0.15, bz + 0.6, 1.9, 1.5, 0.12, BLANKET, bevel=0.05)
        box(0, 0.2, bz + 0.7, 1.4, 1.2, 0.16, SADDLE, bevel=0.06)
        can(0, -0.65, bz + 0.85, 0.12, 0.3, SADDLE, n=8)  # the saddle horn
        # a yarn tail
        for k in (-1, 0, 1):
            limb((k * 0.1, 1.85, bz + 0.3), (k * 0.25, 2.35, 0.55), 0.09, MANE, n=6)
        # fake cowboy legs in stirrups
        for s in (-1, 1):
            k = (s * 1.42, -0.2, bz + 0.45)
            limb((s * 0.75, -0.2, bz + 0.72), k, 0.14, JEANS)
            ball(*k, 0.29, 0.29, 0.29, JEANS, seg=6, ring=4)
            f = (s * 1.48, -0.25, bz - 0.35)
            limb(k, f, 0.13, JEANS)
            box(f[0], f[1] - 0.12, f[2] - 0.15, 0.32, 0.55, 0.26, BOOT, bevel=0.07)
            can(f[0], f[1] - 0.45, f[2] - 0.2, 0.1, 0.18, BOOT, n=4, r2=0.02, rot=(math.radians(90), 0, 0))  # pointy toe
            limb((s * 1.25, -0.25, bz + 0.6), (f[0], f[1] - 0.1, f[2] - 0.3), 0.03, SADDLE, n=4)  # stirrup strap
            box(f[0], f[1] - 0.1, f[2] - 0.32, 0.4, 0.3, 0.06, (0.75, 0.75, 0.78))
        # the horse neck and head jutting out in front, below the kid's face
        box(0, -1.35, bz + 0.2, 1.1, 0.9, 0.9, HORSE, bevel=0.4, segs=2, rot=(math.radians(-25), 0, 0))
        hy, hz = -2.0, 1.6
        box(0, hy, hz, 1.2, 1.05, 0.95, HORSE, bevel=0.38, segs=2)
        box(0, hy - 0.52, hz + 0.3, 0.3, 0.06, 0.35, MUZZLE, bevel=0.05)  # a white blaze
        box(0, hy - 0.75, hz - 0.18, 1.0, 0.8, 0.68, MUZZLE, bevel=0.25, segs=2)
        fy = hy - 1.15
        for s in (-1, 1):
            ball(s * 0.25, fy, hz - 0.02, 0.18, 0.06, 0.12, HOOF, seg=6, ring=4)  # nostrils
            ex, ey, ez = s * 0.42, hy - 0.42, hz + 0.32
            ball(ex, ey, ez, 0.4, 0.3, 0.42, WHITE, seg=8, ring=4)
            ball(ex, ey - 0.13, ez - 0.03, 0.2, 0.08, 0.24, DARK, seg=6, ring=4)
            box(ex - 0.03, ey - 0.17, ez + 0.03, 0.07, 0.03, 0.07, WHITE)
            can(s * 0.5, hy + 0.25, hz + 0.52, 0.13, 0.3, HORSE, n=4, r2=0.02, rot=(0, s * math.radians(20), math.radians(45)))  # ears
        box(0, fy + 0.02, hz - 0.3, 0.6, 0.06, 0.08, DARK)  # the grin
        for k in (-1, 1):
            box(k * 0.1, fy, hz - 0.38, 0.16, 0.06, 0.12, WHITE)  # buck teeth
        # the mane: dark tufts down the head and neck
        for i, (y, z) in enumerate(((hy + 0.25, hz + 0.5), (hy + 0.65, hz + 0.4), (-1.3, bz + 0.62), (-0.95, bz + 0.62))):
            box(0, y, z, 0.46, 0.42, 0.5, MANE, bevel=0.12, rot=(math.radians(-20), 0, 0))
    # the kid: a red bandana under the chin
    w = HEAD
    kid_head(hair=HAIR)
    with part("head"):
        can(0, -w * 0.46 + 0.05, HEAD_Z - w * 0.45 + 0.05, 0.42, 0.06, BANDANA, n=3, rot=(math.radians(90), 0, math.radians(180)))
    # the left mitt holds the reins and the bucket: the rider's arm sits steady on the horse,
    # so arm, mitt, reins and bucket all ride the horse body (the reins stay on the horse's mouth)
    lh = (-1.45, -0.75, 1.85)
    with part("body"):
        limb((-0.6, -0.2, 1.75), lh, 0.11, SHIRT)
        hand_mitt(*lh, -1, MITT, SKIN)
        limb(lh, (-0.45, hy - 0.3, hz - 0.15), 0.03, SADDLE, n=4)
    before = set(bpy.data.objects)
    bucket(lh, full=True, size=0.6)
    for o in set(bpy.data.objects) - before:
        o["part"] = "body"
    # the right arm twirls the lasso overhead: arm, mitt, rope and loop are one
    # connected piece rising from the side of the head (it rides on the head)
    with part("head"):  # the lasso arm, its mitt, the rope and the loop are one unit on the head side
        rh = (1.65, -0.35, 2.55)
        limb((0.95, -0.15, HEAD_Z - 0.85), rh, 0.11, SHIRT)
        hand_mitt(*rh, 1, MITT, SKIN)
        lc = (2.25, 0.1, 4.75)
        rot = (math.radians(15), math.radians(-10), 0)
        from mathutils import Euler
        grip = Vector(lc) + Euler(rot, "XYZ").to_matrix() @ Vector((0, -0.75, 0))   # where the rope meets the loop
        limb(rh, tuple(grip), 0.05, ROPE, n=5)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.06, major_segments=16, minor_segments=4,
                                         location=lc, rotation=rot)
        finish(bpy.context.object, ROPE)
    # the huge cowboy hat
    with part("head"):
        tz = HEAD_Z + w * 0.45
        box(0, 0.05, tz + 0.02, 3.4, 2.9, 0.14, HAT, bevel=0.06)
        for s in (-1, 1):  # brim curled up at the sides
            box(s * 1.78, 0.05, tz + 0.2, 0.14, 2.7, 0.44, HAT, bevel=0.06, rot=(0, s * math.radians(35), 0))
        box(0, 0.05, tz + 0.55, 1.9, 1.7, 1.05, HAT, bevel=0.3, segs=2)
        box(0, 0.05, tz + 1.04, 0.3, 1.2, 0.14, (0.86, 0.83, 0.76), bevel=0.05)  # the crease on top
        box(0, 0.05, tz + 0.18, 1.95, 1.75, 0.22, HAT_D, bevel=0.06)  # the band
        can(0.65, -0.86, tz + 0.18, 0.12, 0.05, (1.0, 0.85, 0.25), n=5, rot=X90)  # a sheriff star


if __name__ == "__main__" or True:
    render_costume("cowboy-horse", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
