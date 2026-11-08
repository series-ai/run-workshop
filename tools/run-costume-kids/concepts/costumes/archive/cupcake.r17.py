"""Cupcake: the kid's own head wears a gigantic round cupcake-top hat: a
huge pink frosting swirl of four fat round tiers stepping up to a curly
point, drips over the brim, rainbow sprinkles and a big glossy cherry on
top, towering way over the head. The body is the cake: a chocolate muffin
top over a big pleated blue cupcake-wrapper skirt; white tights, mitts out
over the rim, the right one holding the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import random
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket
from mathutils import Quaternion, Vector

PINK, PINK_D, CHERRY, STEM = (1.0, 0.66, 0.8), (0.95, 0.5, 0.7), (0.9, 0.08, 0.15), (0.35, 0.55, 0.15)
WRAP, WRAP_D, CAKE = (0.45, 0.76, 0.98), (0.3, 0.58, 0.88), (0.55, 0.32, 0.18)
SPRINKLES = [(1.0, 0.95, 0.3), (0.3, 0.8, 1.0), (0.5, 0.9, 0.4), (1.0, 1.0, 1.0), (0.7, 0.4, 0.95), (1.0, 0.45, 0.2)]


def sprinkles(rnd, cx, cy, z, w, d, n, ang):
    for i in range(n):
        u, v = rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5)
        x = cx + u * w * math.cos(ang) - v * d * math.sin(ang)
        y = cy + u * w * math.sin(ang) + v * d * math.cos(ang)
        box(x, y, z, 0.2, 0.06, 0.06, SPRINKLES[i % len(SPRINKLES)], rot=(0, 0, rnd.uniform(0, 3.1)))


def on_ellipsoid(rnd, cx, cy, cz, w, d, h, n, by_colour, zmin=0.2, zmax=0.8):
    """n chunky sprinkles spread evenly round the upper band of an ellipsoid
    (a golden-angle spiral, lightly jittered), each lying on the surface at a
    random spin with a slight tilt."""
    golden = math.pi * (3 - math.sqrt(5))
    a0 = rnd.uniform(0, 2 * math.pi)
    for i in range(n):
        a = a0 + i * golden + rnd.uniform(-0.15, 0.15)
        e = zmin + (zmax - zmin) * (i + rnd.uniform(0.2, 0.8)) / n
        ce = math.sqrt(1 - e * e)
        dx, dy, dz = w / 2 * ce * math.cos(a), d / 2 * ce * math.sin(a), h / 2 * e
        nrm = Vector((dx / (w / 2) ** 2, dy / (d / 2) ** 2, dz / (h / 2) ** 2)).normalized()
        rgb = SPRINKLES[rnd.randrange(len(SPRINKLES))]
        o = box(0, 0, 0, 0.36, 0.11, 0.11, rgb)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = (nrm.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), rnd.uniform(0, math.pi))
                                 @ Quaternion((1, 0, 0), rnd.uniform(-0.3, 0.3)))
        o.location = Vector((cx + dx, cy + dy, cz + dz)) + nrm * 0.02
        by_colour.setdefault(rgb, []).append(o)


def join_by_colour(by_colour):
    """One mesh per sprinkle colour (fewer objects, same look)."""
    for c, objs in enumerate(by_colour.values()):
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f"sprinkles_{c}"


def build():
    rnd = random.Random(5)
    body(shirt=CAKE, pants=WRAP, leg_colour=(0.97, 0.97, 0.97), shoe=(0.95, 0.4, 0.6), torso=False, arms=False)
    with part("body"):
        # the pleated wrapper skirt: a big flared cup with ribs
        z0, z1, r0, r1 = 0.5, 1.5, 0.95, 1.4
        cup = can(0, 0, (z0 + z1) / 2, r0, z1 - z0, WRAP, n=16, r2=r1)
        import bmesh   # the cup is open underneath, so the legs tuck up inside it
        bm = bmesh.new()
        bm.from_mesh(cup.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.9], context="FACES_ONLY")
        bm.to_mesh(cup.data)
        bm.free()
        for k in range(16):
            a = 2 * math.pi * (k + 0.5) / 16
            limb((r0 * math.cos(a), r0 * math.sin(a), z0 + 0.02), (r1 * math.cos(a), r1 * math.sin(a), z1 - 0.02), 0.07, WRAP_D, n=4)
        can(0, 0, z1, r1 + 0.03, 0.08, WRAP_D, n=16)
        # the chocolate muffin top over the rim
        ball(0, 0, 1.62, 3.0, 2.8, 0.7, CAKE, seg=16, ring=8)
    # arms out over the rim; the right mitt holds the bucket
    # (the sleeves are part of the cake suit; the mitts flap where they leave it)
    lh = (-1.85, -0.3, 1.2)
    rh = (1.9, -0.35, 1.3)
    with part("body"):
        limb((-1.2, -0.1, 1.6), lh, 0.12, CAKE)
        limb((1.2, -0.1, 1.65), rh, 0.12, CAKE)
    with part("hand.r"):
        hand_mitt(*lh, -1, MITT, SKIN)
    with part("hand.l"):
        hand_mitt(*rh, 1, MITT, SKIN)
    bucket(rh, full=True, size=0.68)
    with part("head"):  # the head, the frosting swirl, its drips and sprinkles, the cherry
        # the head: no hair (it is under the frosting)
        box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
        face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
        # the giant frosting swirl: four fat round tiers, each nudged round a little
        tiers = [(0.0, 4.25, 4.6, 4.0, 1.35, PINK), (0.14, 5.1, 3.7, 3.25, 1.2, PINK_D), (-0.1, 5.85, 2.7, 2.4, 1.1, PINK), (0.06, 6.48, 1.7, 1.55, 0.95, PINK_D)]
        for x, z, w, d, h, c in tiers:
            ball(x, 0.05, z, w, d, h, c, seg=16, ring=8)
        can(0.02, 0.05, 7.08, 0.55, 0.6, PINK, n=12, r2=0.05, rot=(0, 0.15, 0))   # the curly point
        # drips over the brim, down the brow and the sides
        for x, h, w in ((-1.6, 0.55, 0.45), (-0.85, 0.4, 0.4), (0.0, 0.6, 0.5), (0.85, 0.42, 0.42), (1.6, 0.5, 0.42)):
            y = -1.85 * math.sqrt(max(0.0, 1 - (x / 2.3) ** 2))
            ball(x, y + 0.08, 3.8 - h * 0.1, w, 0.4, h * 0.75 + 0.2, PINK, seg=8, ring=6)
        for s in (-1, 1):
            ball(s * 2.2, -0.3, 3.85, 0.42, 0.5, 0.6, PINK, seg=8, ring=6)
        by_colour = {}
        for x, z, w, d, h, c in tiers:
            on_ellipsoid(rnd, x, 0.05, z, w, d, h, int(3 + w * 2), by_colour)
        join_by_colour(by_colour)
        # the cherry
        ball(0, 0, 7.65, 0.9, 0.9, 0.85, CHERRY, seg=12, ring=8)
        ball(-0.18, -0.38, 7.83, 0.18, 0.08, 0.16, WHITE, seg=6, ring=4)
        limb((0, 0, 8.02), (0.25, 0.08, 8.4), 0.05, STEM)


if __name__ == "__main__" or True:
    render_costume("cupcake", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.9)
