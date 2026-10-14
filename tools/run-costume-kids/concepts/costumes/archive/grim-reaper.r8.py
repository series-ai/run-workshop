"""Grim reaper: an oversized charcoal hood over the kid's own head (a tall
floppy peak curling back with a little tassel); the kid's full-size face
looks out of a big rounded opening under a soft drooping fold. A long ragged robe to the shoes with a rope belt, wide
bell sleeves with the mitts poking out. One mitt holds a big chunky toy
scythe (a tall staff, a foam-grey crescent blade with a shiny edge and a
purple grip); the other carries the full bucket."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

ROBE, ROBE_D, ROBE_L, SHADOW = (0.25, 0.23, 0.30), (0.17, 0.15, 0.21), (0.36, 0.34, 0.42), (0.05, 0.04, 0.08)
ROPE, STAFF, GRIP = (0.86, 0.70, 0.42), (0.52, 0.34, 0.22), (0.58, 0.32, 0.82)
BLADE, BLADE_EDGE, BLADE_D = (0.72, 0.76, 0.84), (0.95, 0.97, 1.0), (0.50, 0.54, 0.62)
BONE = (0.98, 0.96, 0.88)


def plate(pts, y, t, rgb):
    """A flat polygon in the x-z plane at depth y, thickness t."""
    me = bpy.data.meshes.new("plate")
    me.from_pydata([(x, y, z) for x, z in pts], [], [list(range(len(pts)))])
    o = bpy.data.objects.new("plate", me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    sol = o.modifiers.new("s", "SOLIDIFY")
    sol.thickness = t
    sol.offset = 0
    return finish(o, rgb)


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


def scythe(x, y, z0, z1):
    """A toy scythe: the staff from z0 to z1 at (x, y), the blade sweeping over to -x."""
    can(x, y, (z0 + z1) / 2, 0.1, z1 - z0, STAFF, n=8)
    can(x, y, 1.12, 0.11, 0.5, GRIP, n=8)
    can(x, y, z1 + 0.02, 0.13, 0.12, BLADE_D, n=8)
    ball(x, y, z1 + 0.12, 0.2, 0.2, 0.2, BLADE_D, seg=8, ring=6)
    n = 10
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        bx = x - 1.95 * t
        zt = z1 - 0.05 + 0.4 * math.sin(math.pi * t * 0.75) - 0.95 * t ** 2.2
        th = 0.85 * (1 - t) ** 0.7 + 0.03
        top.append((bx, zt))
        bot.append((bx + 0.05 * t, zt - th))
    plate(top + bot[::-1], y, 0.2, BLADE)
    # the shiny cutting edge along the underside
    for a, b in zip(bot, bot[1:]):
        bar((a[0], y - 0.02, a[1] + 0.05), (b[0], y - 0.02, b[1] + 0.05), 0.08, 0.07, BLADE_EDGE, n=6)
    box(x - 0.45, y - 0.11, z1 - 0.05, 0.14, 0.03, 0.14, BLADE_EDGE)  # a sparkle


def build():
    body(shoe=ROBE_D, legs=False, torso=False, arms=False)
    # the long robe: a flared bell to the shoes with a ragged hem and a rope belt
    hem = 0.36
    can(0, 0, (hem + TOP + 0.1) / 2, 1.0, TOP + 0.1 - hem, ROBE, n=8, r2=0.6, rot=(0, 0, math.radians(22.5)))
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        can(0.95 * math.cos(a), 0.95 * math.sin(a), hem - 0.08, 0.16, 0.18, ROBE, n=4, r2=0.0, rot=(math.pi, 0, a))
    can(0, 0, HIP + 0.45, 0.8, 0.1, ROPE, n=8, r2=0.76, rot=(0, 0, math.radians(22.5)))
    for k, dx in enumerate((-0.12, 0.02)):
        limb((0.25 + dx, -0.78, HIP + 0.42), (0.3 + dx * 1.5, -0.86, HIP - 0.05 - k * 0.08), 0.04, ROPE)
    # right arm: a bell sleeve to the scythe
    sx = TW * 0.5 + 0.08
    m = (1.62, -0.3, 1.12)
    bar((sx, 0, TOP - 0.1), (m[0] - 0.12, m[1] + 0.03, m[2] + 0.03), 0.13, 0.25, ROBE)
    scythe(1.75, -0.3, 0.05, 5.15)
    hand_mitt(*m, 1, MITT, SKIN)
    # left arm: a bell sleeve to the bucket
    hx, hy, hz = -1.15, -0.3, TOP - 0.2
    bar((-sx, 0, TOP - 0.1), (hx + 0.12, hy + 0.03, hz + 0.05), 0.13, 0.25, ROBE)
    hand_mitt(hx, hy, hz, -1, MITT, SKIN)
    bucket((hx, hy, hz), full=True, size=0.6)
    # the kid's own head at the standard spot, inside the hood
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)
    face(0, HEAD_Z - HEAD * 0.05, -HEAD * 0.46, HEAD)
    # the oversized hood enclosing the head, a big opening cut for the face
    HW, HD, HH = HEAD * 1.18, HEAD * 1.08, HEAD * 1.12
    hz0, hy0 = HEAD_Z + 0.08, 0.12
    hood = box(0, hy0, hz0, HW, HD, HH, ROBE, bevel=0.85, segs=3)
    fy = hy0 - HD / 2
    oz, ow, oh = HEAD_Z - 0.06, HEAD * 0.9, HEAD * 0.86
    cutter = box(0, -0.6 - 1.3, oz, ow, 2.6, oh, SHADOW, bevel=0.7, segs=4)
    m = hood.modifiers.new("cut", "BOOLEAN")
    m.object, m.operation, m.material_mode = cutter, "DIFFERENCE", "TRANSFER"
    cutter.hide_render = True
    # a soft fold of the hood drooping over the top of the opening
    bar((-ow * 0.5 - 0.05, fy + 0.1, oz + oh * 0.5 - 0.02), (ow * 0.5 + 0.05, fy + 0.1, oz + oh * 0.5 - 0.02), 0.17, 0.17, ROBE, n=8)
    for s_ in (-1, 1):
        ball(s_ * (ow * 0.5 + 0.05), fy + 0.1, oz + oh * 0.5 - 0.02, 0.34, 0.34, 0.34, ROBE, seg=8, ring=6)
    box(0, -HEAD * 0.46 - 0.02, oz + oh * 0.5 - 0.28, HEAD * 0.72, 0.1, 0.24, (0.3, 0.17, 0.09), bevel=0.08)   # the fringe
    # the long floppy peak: up off the crown, curling back and down at the tip
    top = hz0 + HH / 2
    pts = [(0, hy0 + 0.15, top - 0.6, 1.08), (0, hy0 + 0.6, top + 0.1, 0.78), (0, hy0 + 1.2, top + 0.5, 0.5),
           (0, hy0 + 1.8, top + 0.55, 0.28), (0, hy0 + 2.2, top + 0.15, 0.1)]
    for (x0, y0, z0, r0), (x1, y1, z1, r1) in zip(pts, pts[1:]):
        bar((x0, y0, z0), (x1, y1, z1), r0, r1, ROBE, n=8)
        ball(x1, y1, z1, r1 * 2, r1 * 2, r1 * 2, ROBE, seg=8, ring=6)
    ball(0, hy0 + 2.22, top + 0.05, 0.3, 0.3, 0.3, ROBE_L, seg=8, ring=6)      # a little tassel on the tip
    # a little bone clasp under the chin
    cy = fy + 0.35
    box(0, cy - 0.1, hz0 - HH / 2 + 0.02, 0.5, 0.12, 0.14, BONE, bevel=0.05)
    for s in (-1, 1):
        ball(s * 0.27, cy - 0.1, hz0 - HH / 2 + 0.02, 0.16, 0.14, 0.2, BONE, seg=6, ring=4)


if __name__ == "__main__" or True:
    run({"grim-reaper": build})
