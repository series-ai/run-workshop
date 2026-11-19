"""Octopus: the kid in a squishy purple-pink octopus suit. A big rounded
octopus mantle-hood enclosing the head (a bulb flopping back) with two
huge googly eyes on top; the kid's full-size face looks out of a pale rim.
Eight floppy tentacles with pale sucker dots: six spill out from under the
hood and curl up on the ground round the shoes, and the two arms are
tentacles too (one waves, one ends in the kid's mitt holding the full
bucket)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from _kit5 import hood
from props import bucket

OCTO, OCTO_D, SPOT, SUCKER = (0.86, 0.36, 0.66), (0.66, 0.22, 0.50), (0.72, 0.26, 0.56), (1.0, 0.80, 0.86)
RIM, SHOE_C = (1.0, 0.72, 0.80), (0.36, 0.20, 0.52)


def bar(p0, p1, r0, r1, rgb, n=8):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def disc(x, y, z, w, h, d, rgb, n=16):
    """A flat oval disc facing -y: w wide, h tall, d deep."""
    o = can(x, y, z, 0.5, d, rgb, n=n, rot=(math.radians(90), 0, 0))
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.scale = (w, 1, h)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return o


def sweep(pts, radii, rgb, m=6):
    """One round tube through `pts` (a ring of m corners at each point, mitred so
    the bends keep their thickness), capped at both ends: a whole tentacle in one
    cheap piece instead of a bar and a ball per segment."""
    verts, faces = [], []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        t, k = (b - a).normalized(), 1.0
        if 0 < i < len(pts) - 1:
            t0, t1 = (p - a).normalized(), (b - p).normalized()
            t = (t0 + t1).normalized()
            k = 1.0 / max(0.5, t0.dot(t))  # mitre: keep the tube's thickness through the bend
        u = t.cross(Vector((0, -1, 0)))
        if u.length < 1e-4:
            u = t.cross(Vector((0, 0, 1)))
        u.normalize()
        v = u.cross(t).normalized()
        for j in range(m):
            ang = 2 * math.pi * (j + 0.5) / m
            verts.append(p + (u * math.cos(ang) * k + v * math.sin(ang)) * radii[i])
    for i in range(len(pts) - 1):
        for j in range(m):
            faces.append((i * m + j, i * m + (j + 1) % m, (i + 1) * m + (j + 1) % m, (i + 1) * m + j))
    faces.append(tuple(range(m - 1, -1, -1)))
    faces.append(tuple((len(pts) - 1) * m + j for j in range(m)))
    me = bpy.data.meshes.new("tube")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new("tube", me)
    bpy.context.scene.collection.objects.link(ob)
    return finish(ob, rgb)


def tentacle(pts, r0, r1, side=None):
    """A tapering tentacle through pts with ball knuckles and sucker dots on
    the `side` (a unit vector, default toward the camera)."""
    pts = [Vector(p) for p in pts]
    n = len(pts) - 1
    rs = [r0 + (r1 - r0) * i / n for i in range(n + 1)]
    sweep(pts, rs, OCTO, m=7)  # one smooth tube
    side = Vector(side or (0, -1, 0)).normalized()
    for i in range(1, n + 1):  # one sucker per knuckle
        p, r = pts[i], rs[i]
        q = p + side * r * 0.85
        sz = max(r * 0.9, 0.09)
        ball(q.x, q.y, q.z, sz, sz, sz, SUCKER, seg=6, ring=3)

def build():
    body(shirt=OCTO, pants=OCTO, leg_colour=OCTO, shoe=SHOE_C, arms=False)
    with part("body"):  # every tentacle is the octopus suit's, even the two arms
        # six tentacles spilling out from under the hood, draping to the ground and curling up
        for a in (-55, -125, 15, 165, 65, 115):
            r = math.radians(a)
            c, s = math.cos(r), math.sin(r)
            pts = [(1.0 * c, 1.0 * s, 1.75), (1.3 * c, 1.3 * s, 1.0), (1.5 * c, 1.5 * s, 0.32), (1.85 * c, 1.85 * s, 0.14),
                   (2.15 * c, 2.15 * s, 0.35), (2.1 * c, 2.1 * s, 0.62)]
            side = (0, -1, 0) if s < 0 else (c, s, -0.3)
            tentacle(pts, 0.3, 0.07, side)
        # arm tentacles: one waves from under the hood (clear of the shoulder, so it stays the suit's)
        sx = TW * 0.5 + 0.08
        tentacle([(0.95, -0.05, 1.45), (1.1, -0.25, TOP - 0.3), (1.7, -0.4, TOP - 0.1), (2.0, -0.45, TOP + 0.4),
                  (1.95, -0.45, TOP + 0.85), (1.72, -0.45, TOP + 0.95), (1.6, -0.45, TOP + 0.75)], 0.18, 0.06)
    # the other is the kid's arm in a tentacle sleeve, hanging, its mitt holding the bucket
    hp = hand_points()[-1]
    with part("arm.r"):
        tentacle([(-sx, 0, TOP - 0.15), (-sx - 0.16, -0.05, TOP - ARM_DROP)], 0.17, 0.14)
    with part("hand.r"):
        hand_mitt(*hp, -1, MITT, SKIN)
    bucket(hp, full=True, size=0.6)
    # the mantle-hood: a big rounded hood enclosing the standard head, the kid's
    # full-size face in a pale rim, and a big bulb flopping back on top
    hd = hood(OCTO, RIM, w=HEAD * 1.22, d=HEAD * 1.08, h=HEAD * 1.08, y=0.15, zc=HEAD_Z + 0.25, bevel=0.55,  # its bottom up off the shoulders
              ow=HEAD * 0.88, oh=HEAD * 0.74, rt=0.15)
    with part("head"):
        hf, top = hd["front"], hd["top"]
        box(0, 0.75, top + 0.45, HEAD * 1.04, HEAD * 1.0, 1.9, OCTO, bevel=0.8, segs=2, rot=(math.radians(-16), 0, 0))
        # huge googly eyes sitting on the hood's front top edge
        for s in (-1, 1):
            ex, ey, ez = s * 0.72, hf + 0.5, top + 0.1
            ball(ex, ey, ez, 1.05, 0.9, 1.05, WHITE, seg=8, ring=6)
            ball(ex + s * 0.05, ey - 0.4, ez - 0.05, 0.5, 0.16, 0.54, DARK, seg=8, ring=5)
            ball(ex - 0.06, ey - 0.5, ez + 0.1, 0.15, 0.06, 0.15, WHITE, seg=6, ring=4)


if __name__ == "__main__" or True:
    render_costume("octopus", build, sys.argv[sys.argv.index("--") + 1], ortho=8.5, target_z=3.0)
