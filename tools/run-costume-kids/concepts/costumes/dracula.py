"""Dracula: the kid with slicked black hair and a widow's peak, a pale
powdered face with tiny fangs, a huge black cape and a tall red-lined
stand-up collar fanning out behind the giant head, a red waistcoat and a red
medallion. One mitten pokes out of the cape with the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

CAPE, RED, RED_D = (0.12, 0.10, 0.16), (0.86, 0.10, 0.18), (0.62, 0.06, 0.12)
PALE, HAIR, GOLD = (0.97, 0.90, 0.86), (0.08, 0.07, 0.10), (1.0, 0.78, 0.22)


def shell(cy, a, z0, z1, r0, r1, t, rgb_out, rgb_in, n=12):
    """A thick open arc of a cone around the back (angle 0 = +y), from z0 at
    radius r0 to z1 at radius r1, spanning -a..a; outer and inner colours."""
    import bmesh
    for rgb, off in ((rgb_out, 0.0), (rgb_in, -t)):
        me = bpy.data.meshes.new("shell")
        bm = bmesh.new()
        rows = []
        for (z, r) in ((z0, r0 + off), (z1, r1 + off)):
            rows.append([bm.verts.new((r * math.sin(-a + 2 * a * i / n), cy + r * math.cos(-a + 2 * a * i / n), z))
                         for i in range(n + 1)])
        for i in range(n):
            bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
        bm.normal_update()
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new("shell", me)
        bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        finish(o, rgb)


def build():
    body(shirt=WHITE, pants=HAIR, leg_colour=HAIR, shoe=HAIR, arms=False)
    fy = -TD * 0.5 - 0.03
    with part("chest"):
        # the red waistcoat panels and the medallion on a gold chain
        for s in (-1, 1):
            box(s * 0.26, fy, HIP + TH * 0.6, 0.34, 0.06, TH * 0.75, RED, bevel=0.03)
        for s in (-1, 1):
            limb((s * 0.3, fy - 0.05, TOP - 0.02), (0, fy - 0.06, TOP - 0.38), 0.025, GOLD)
        can(0, fy - 0.07, TOP - 0.45, 0.17, 0.06, GOLD, n=8, rot=(math.radians(90), 0, 0))
        ball(0, fy - 0.1, TOP - 0.45, 0.2, 0.08, 0.2, RED, seg=8, ring=5)
    # the cape: a wide flare around the back and sides, open at the front
    with part("chest"):  # open wide enough at the front for the arm and the bucket to swing clear
        shell(0.05, math.radians(112), 0.14, TOP + 0.08, 1.15, 0.62, 0.06, CAPE, RED)
    # a cape point at each front edge, flicked out
    # the right arm pokes out of the cape opening with the bucket
    sx = TW * 0.5 + 0.08
    m = (0.68, -0.42, 0.72)
    with part("arm.l"):
        limb((sx, 0, TOP - 0.15), (m[0], m[1] + 0.12, m[2] + 0.05), 0.11, CAPE)
    with part("hand.l"):
        hand_mitt(*m, 1, MITT, SKIN)
    bucket(m, full=True, size=0.6)
    with part("head"):  # the collar and cowl hug the head; the head, hair, face, fangs and ears
        # the tall stand-up collar fanning out behind the head: black outside, red inside
        shell(0.55, math.radians(86), TOP + 0.2, TOP + 2.75, 0.95, 2.0, 0.08, CAPE, RED, n=10)
        # the cowl: a hood around the back of the head that joins the cape's shoulders to the collar's base
        shell(0.12, math.radians(112), TOP - 0.1, TOP + 1.1, 0.95, 1.52, 0.08, CAPE, RED, n=12)
        # the head: pale, with slicked hair and a widow's peak
        w = HEAD
        box(0, 0, HEAD_Z, w, w * 0.92, w * 0.9, PALE, bevel=w * 0.14, segs=2)
        box(0, w * 0.05, HEAD_Z + w * 0.3, w * 1.04, w * 0.98, w * 0.36, HAIR, bevel=w * 0.14, segs=2)
        box(0, -w * 0.46 - 0.01, HEAD_Z + 0.72, 0.62, 0.08, 0.62, HAIR, rot=(0, math.radians(45), 0))
        box(0, -w * 0.46 - 0.01, HEAD_Z + 0.86, w * 0.86, 0.08, 0.3, HAIR)
        # sideburns, slicked down the sides
        for s in (-1, 1):
            box(s * (w * 0.5 - 0.12), -0.15, HEAD_Z + 0.35, 0.3, w * 0.7, 0.7, HAIR, bevel=0.1)
        face(0, HEAD_Z - w * 0.05, -w * 0.46, w)
        # tiny fangs under the smile
        fz = HEAD_Z - w * 0.05 - w * 0.12 - 0.08
        for s in (-1, 1):
            can(s * 0.1, -w * 0.46 - 0.03, fz, 0.07, 0.04, WHITE, n=3, rot=(math.radians(90), 0, math.radians(180)))
        # pointy little ears
        for s in (-1, 1):
            can(s * (w * 0.5 + 0.05), -0.1, HEAD_Z + 0.05, 0.2, 0.42, PALE, n=4, r2=0.0, rot=(0, s * math.radians(70), 0))


if __name__ == "__main__" or True:
    run({"dracula": build})
