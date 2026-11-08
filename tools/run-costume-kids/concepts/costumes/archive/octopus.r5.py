"""Octopus: the kid in a squishy purple-pink octopus suit. A big rounded
octopus mantle-hood (a bulb flopping back) with two huge
googly eyes on top; the kid's face looks out of a pale rim at the front.
Eight floppy tentacles with pale sucker dots: six spill out from under the
hood and curl up on the ground round the shoes, and the two arms are
tentacles too (one waves, one ends in the kid's mitt holding the full
bucket)."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
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


def tentacle(pts, r0, r1, side=None):
    """A tapering tentacle through pts with ball knuckles and sucker dots on
    the `side` (a unit vector, default toward the camera)."""
    pts = [Vector(p) for p in pts]
    n = len(pts) - 1
    rs = [r0 + (r1 - r0) * i / n for i in range(n + 1)]
    for i in range(n):
        bar(pts[i], pts[i + 1], rs[i], rs[i + 1], OCTO)
        ball(*pts[i + 1], rs[i + 1] * 2, rs[i + 1] * 2, rs[i + 1] * 2, OCTO, seg=8, ring=6)
    side = Vector(side or (0, -1, 0)).normalized()
    for i in range(1, n + 1):
        for f in (0.0, 0.5):
            if i == n and f:
                continue
            p = pts[i].lerp(pts[min(i + 1, n)], f)
            r = rs[i] + (rs[min(i + 1, n)] - rs[i]) * f
            q = p + side * r * 0.85
            s = max(r * 0.75, 0.07)
            ball(q.x, q.y, q.z, s, s, s, SUCKER, seg=6, ring=4)


def build():
    body(shirt=OCTO, pants=OCTO, leg_colour=OCTO, shoe=SHOE_C, arms=False)
    # six tentacles spilling out from under the hood, draping to the ground and curling up
    for a in (-55, -125, 15, 165, 65, 115):
        r = math.radians(a)
        c, s = math.cos(r), math.sin(r)
        pts = [(1.0 * c, 1.0 * s, 1.75), (1.3 * c, 1.3 * s, 1.0), (1.5 * c, 1.5 * s, 0.32), (1.85 * c, 1.85 * s, 0.14),
               (2.15 * c, 2.15 * s, 0.35), (2.1 * c, 2.1 * s, 0.62)]
        side = (0, -1, 0) if s < 0 else (c, s, -0.3)
        tentacle(pts, 0.3, 0.07, side)
    # arm tentacles: the right waves, the left ends in the mitt holding the bucket
    sx = TW * 0.5 + 0.08
    tentacle([(sx, 0, TOP - 0.15), (1.1, -0.25, TOP - 0.3), (1.7, -0.4, TOP - 0.1), (2.0, -0.45, TOP + 0.4),
              (1.95, -0.45, TOP + 0.85), (1.72, -0.45, TOP + 0.95), (1.6, -0.45, TOP + 0.75)], 0.18, 0.06)
    hx, hy, hz = -1.2, -0.3, TOP - 0.2
    tentacle([(-sx, 0, TOP - 0.15), (-0.9, -0.15, TOP - 0.25), (hx + 0.15, hy, hz + 0.02)], 0.17, 0.14)
    hand_mitt(hx, hy, hz, -1, MITT, SKIN)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the mantle-hood: a big rounded block, a bulb flopping back on top
    hz0, hy0 = HEAD_Z + 0.2, 0.15
    box(0, hy0, hz0, 2.95, 2.6, 2.9, OCTO, bevel=0.95, segs=3)
    box(0, hy0 + 0.6, hz0 + 1.05, 2.4, 2.3, 1.45, OCTO, bevel=0.65, segs=3, rot=(math.radians(18), 0, 0))
    # the face opening at the front
    fy = hy0 - 1.3
    fz = hz0 - 0.55
    disc(0, fy - 0.03, fz, 2.15, 1.75, 0.2, RIM)
    disc(0, fy - 0.08, fz, 1.85, 1.45, 0.2, SKIN)
    face(0, fz + 0.05, fy - 0.18, 1.85, eye=0.15, gap=0.21)
    # huge googly eyes on top
    for s in (-1, 1):
        ex, ey, ez = s * 0.68, fy + 0.25, hz0 + 1.05
        ball(ex, ey, ez, 0.95, 0.85, 0.95, WHITE, seg=10, ring=8)
        ball(ex + s * 0.05, ey - 0.38, ez - 0.05, 0.46, 0.16, 0.5, DARK, seg=8, ring=6)
        ball(ex - 0.06, ey - 0.47, ez + 0.08, 0.14, 0.06, 0.14, WHITE, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"octopus": build})
