"""Donut: the kid wears a gigantic frosted donut standing on edge round the
head: the head goes right through the head-sized hole, so the whole face
looks out framed by golden dough. Thick strawberry-pink frosting with wavy
drips over the edges covers the front, scattered with rainbow sprinkles.
Under it, plain pink clothes and white sneakers; mitts poke out of the
donut's sides, the right one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

DOUGH, DOUGH_D = (0.93, 0.66, 0.32), (0.8, 0.5, 0.22)
ICING, ICING_D = (1.0, 0.55, 0.75), (0.93, 0.42, 0.65)
CLOTHES = (1.0, 0.6, 0.78)
SPRINKLES = [(1.0, 0.95, 0.3), (0.3, 0.7, 1.0), (1.0, 1.0, 1.0), (0.6, 0.4, 0.95), (1.0, 0.45, 0.2), (0.45, 0.85, 0.35)]
X90 = (math.radians(90), 0, 0)

R, r, SZ = 2.35, 0.78, 0.76    # the donut: centre-line radius, tube radius, vertical squash
CY = -0.45                     # pushed forward so the face sits inside the hole
CZ = HEAD_Z + 0.1              # the ring's centre (the head fills the hole)


def torus(y, major, minor, rgb, sy=1.0, sz=SZ):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=28, minor_segments=12,
                                     location=(0, y, CZ), rotation=X90)
    o = bpy.context.object
    o.scale = (1.0, sz, sy)       # local z is world y after the 90 degree turn
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return finish(o, rgb)


def ring_point(a, rad):
    """A point on the donut's front face plane, at angle a and radius rad (unsquashed)."""
    return rad * math.cos(a), CZ + rad * math.sin(a) * SZ


def build():
    rnd = random.Random(11)
    body(shirt=CLOTHES, pants=CLOTHES, shoe=(0.97, 0.97, 0.97), arms=False)
    for s in (-1, 1):  # pink sneaker laces stripe
        with part("foot.l" if s > 0 else "foot.r"):
            box(s * TW * 0.24, -FOOT * 0.25 - FOOT * 0.58, FOOT * 0.25, FOOT * 0.5, 0.04, 0.08, ICING_D)
    kid_head(hair=(0.3, 0.17, 0.09))
    with part("body"):  # the donut is a suit round the head: dough, frosting, drips and sprinkles move as one
        # the dough ring
        torus(CY, R, r, DOUGH)
        # the frosting: a flattened, thinner ring over the front, dough showing round the edges
        torus(CY - r * 0.62, R, r * 0.8, ICING, sy=0.6)
        # a wavy scalloped frosting edge, with a few drips hanging down the dough
        for k in range(20):
            a = 2 * math.pi * (k + 0.2) / 20
            x, z = ring_point(a, R + r * 0.68)
            ball(x, CY - r * 0.55, z, 0.5, 0.42, 0.45, ICING, seg=8, ring=6)
            if k % 3 == 1 and math.sin(a) < 0.5:
                L = 0.3 + 0.15 * (k % 2)
                limb((x, CY - r * 0.55, z), (x, CY - r * 0.5, z - L), 0.15, ICING, n=8)
                ball(x, CY - r * 0.5, z - L, 0.34, 0.34, 0.38, ICING, seg=8, ring=6)
        for k in range(9):
            a = 2 * math.pi * (k + 0.5) / 9
            x, z = ring_point(a, R - r * 0.66)
            ball(x, CY - r * 0.75, z, 0.4, 0.36, 0.34, ICING, seg=8, ring=6, rot=(0, -a, 0))
        # sprinkles on the frosting's front face
        for i in range(60):
            a = rnd.uniform(0, 2 * math.pi)
            t = rnd.uniform(-0.6, 0.6)
            x, z = ring_point(a, R + t * r * 0.8)
            y = CY - r * 0.62 - r * 0.8 * 0.6 * math.sqrt(max(0.0, 1 - t * t)) - 0.02
            box(x, y, z, 0.24, 0.07, 0.07, SPRINKLES[i % len(SPRINKLES)], rot=(0, rnd.uniform(0, 3.14), 0))
    # the mitts hold the donut's bottom rim from the front; the right one carries the bucket
    for s_ in (-1, 1):
        a = math.radians(-90 + s_ * 42)
        x, z = ring_point(a, R + r * 0.55)
        hand = (x + s_ * 0.15, CY - r - 0.12, z - 0.1)
        with part("body"):  # the mitts grip the donut's rim: sleeves and mitts move with the donut suit
            hand_mitt(*hand, s_, MITT, SKIN)
            limb((hand[0] + s_ * 0.05, hand[1] + 0.2, hand[2] - 0.1), (hand[0] + s_ * 0.1, CY - 0.2, hand[2] - 0.25), 0.15, CLOTHES)
        if s_ > 0:
            before = set(bpy.data.objects)
            bucket(hand, full=True, size=0.62)
            for o in set(bpy.data.objects) - before:
                o["part"] = "body"  # it hangs from a mitt that is gripping the donut

if __name__ == "__main__" or True:
    render_costume("donut", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
