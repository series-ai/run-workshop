"""King: the kid in a big gold crown (eight jewelled points with gold balls
on top, red velvet inside, an ermine band round the bottom), a red cape with
a white spotted ermine collar and trim, a purple tunic with a gold belt, a
little brown stick-on beard under the smile, a gold sceptre with a ruby orb
in the right mitten and the full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

GOLD, GOLD_D, RED, RED_D = (1.0, 0.80, 0.16), (0.88, 0.60, 0.1), (0.85, 0.10, 0.16), (0.62, 0.06, 0.12)
ERMINE, SPOT, TUNIC, TIGHTS = (0.99, 0.98, 0.95), (0.08, 0.07, 0.09), (0.48, 0.24, 0.78), (0.98, 0.85, 0.3)
RUBY, SAPPH, EMER, HAIR, BEARD = (0.92, 0.1, 0.25), (0.2, 0.45, 1.0), (0.15, 0.8, 0.4), (0.42, 0.24, 0.1), (0.48, 0.28, 0.12)

X90 = (math.radians(90), 0, 0)


def arm(s, hand, sleeve, r=0.11, mitt=True):
    """A sleeve from the shoulder to a mitten at `hand`."""
    sh = (s * (TW * 0.5 + 0.08), 0, TOP - 0.15)
    d = [h - a for a, h in zip(sh, hand)]
    L = math.sqrt(sum(c * c for c in d))
    limb(sh, tuple(h - c / L * 0.14 for h, c in zip(hand, d)), r, sleeve)
    if mitt:
        hand_mitt(*hand, s, MITT, SKIN)


def bar(p0, p1, r0, r1, rgb, n=6):
    """A tapered bar between two points."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def mesh_obj(verts, faces, rgb, t=0.0):
    me = bpy.data.meshes.new("m")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("m", me)
    bpy.context.scene.collection.objects.link(o)
    if t:
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        sol.offset = 0
    return finish(o, rgb)


def star(cx, y, cz, r, t, rgb, n=5, inner=0.45, spin=0.0):
    """A flat n-pointed star facing -y."""
    v = [(cx, y, cz)]
    for i in range(2 * n):
        a = math.pi / 2 + spin + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        v.append((cx + rr * math.cos(a), y, cz + rr * math.sin(a)))
    return mesh_obj(v, [(0, 1 + i, 1 + (i + 1) % (2 * n)) for i in range(2 * n)], rgb, t)


def slab(pts, t, rgb):
    """A flat quad (4 corner points) given thickness t."""
    return mesh_obj(pts, [(0, 1, 2, 3)], rgb, t)


def shell(cy, a, z0, z1, r0, r1, t, rgb_out, rgb_in, n=12):
    """A thick open arc of a cone around the back (from dracula.py)."""
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
        sol = o.modifiers.new("s", "SOLIDIFY")
        sol.thickness = t
        finish(o, rgb)


def spots(pts, fy):
    for x, z in pts:
        box(x, fy, z, 0.06, 0.04, 0.14, SPOT)


def build():
    body(shirt=TUNIC, pants=TUNIC, leg_colour=TIGHTS, shoe=RED_D, arms=False)
    fy = -TD * 0.5
    # the tunic skirt, the gold belt
    can(0, 0, HIP + 0.04, TW * 0.68, 0.36, TUNIC, n=8, r2=TW * 0.58)
    box(0, 0, HIP + TH * 0.32, TW + 0.06, TD + 0.06, 0.13, GOLD, bevel=0.03)
    box(0, fy - 0.06, HIP + TH * 0.32, 0.22, 0.06, 0.2, GOLD_D, bevel=0.03)
    ball(0, fy - 0.1, HIP + TH * 0.32, 0.1, 0.05, 0.1, RUBY, seg=6, ring=4)
    # the cape: a red flare round the back to the ground, an ermine hem and front edges
    shell(0.05, math.radians(118), 0.08, TOP + 0.05, 1.2, 0.62, 0.08, RED, ERMINE)
    shell(0.05, math.radians(118), 0.04, 0.2, 1.24, 1.16, 0.08, ERMINE, ERMINE, n=12)
    # the big ermine collar round the shoulders
    can(0, 0.02, TOP + 0.02, 0.82, 0.3, ERMINE, n=12, r2=0.6)
    for i in range(10):
        a = i * math.pi / 5 + 0.3
        box(0.74 * math.sin(a), 0.02 - 0.74 * math.cos(a), TOP + 0.02, 0.06, 0.06, 0.15, SPOT, rot=(0, 0, a))
    # the right mitten holds the sceptre; the left carries the bucket
    rh = (0.9, -0.5, 0.9)
    arm(1, rh, TUNIC, r=0.12)
    bar((rh[0] - 0.12, rh[1] + 0.08, rh[2] - 0.5), (rh[0] + 0.5, rh[1] - 0.25, rh[2] + 1.55), 0.06, 0.06, GOLD)
    top = Vector((rh[0] + 0.5, rh[1] - 0.25, rh[2] + 1.55))
    bar(top - Vector((0.03, -0.02, 0.12)), top, 0.16, 0.16, GOLD_D, n=8)
    ball(top.x + 0.04, top.y, top.z + 0.22, 0.42, 0.42, 0.42, RUBY, seg=10, ring=7)
    can(top.x + 0.06, top.y, top.z + 0.5, 0.14, 0.2, GOLD, n=4, r2=0.0)
    ball(top.x - 0.05, top.y - 0.17, top.z + 0.3, 0.1, 0.05, 0.1, WHITE, seg=6, ring=4)
    hand_mitt(*rh, 1, MITT, SKIN)
    lh = (-0.82, -0.2, 0.75)
    arm(-1, lh, TUNIC, r=0.12)
    bucket(lh, full=True, size=0.6)
    # the head and a little stick-on beard
    w = HEAD
    kid_head(hair=HAIR)
    bf = -w * 0.46
    for x, z, r in ((0, HEAD_Z - 0.82, 0.5), (-0.38, HEAD_Z - 0.68, 0.38), (0.38, HEAD_Z - 0.68, 0.38), (0, HEAD_Z - 1.12, 0.36)):
        ball(x, bf - 0.08, z, r, 0.24, r * 0.9, BEARD, seg=8, ring=5)
    # the crown: an octagonal gold band, eight points with balls, velvet, an ermine base
    cz = HEAD_Z + w * 0.27
    octa(0, 0.03, cz + 0.42, 1.3, 0.3, ERMINE)
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x, y = 1.36 * math.sin(a) * 0.98, 0.03 - 1.36 * math.cos(a) * 0.98
        box(x, y, cz + 0.42, 0.05, 0.06, 0.16, SPOT, rot=(0, 0, a))
    octa(0, 0.03, cz + 0.85, 1.26, 0.58, GOLD)
    ball(0, 0.03, cz + 1.25, 2.2, 2.2, 1.3, RED, seg=10, ring=7)
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        x, y = 1.1 * math.sin(a), 0.03 - 1.1 * math.cos(a)
        can(x, y, cz + 1.32, 0.3, 0.4, GOLD, n=4, r2=0.0, rot=(0, 0, a))
        ball(x, y, cz + 1.58, 0.24, 0.24, 0.24, GOLD_D, seg=6, ring=4)
    ball(0, 0.03, cz + 1.88, 0.26, 0.26, 0.26, GOLD, seg=8, ring=5)
    # jewels round the band
    gem = (RUBY, SAPPH, EMER, SAPPH)
    for i in range(8):
        a = i * math.pi / 4
        r = 1.26 * math.cos(math.pi / 8) + 0.04
        x, y = r * math.sin(a), 0.03 - r * math.cos(a)
        o = ball(x, y, cz + 0.85, 0.3 if i == 0 else 0.22, 0.12, 0.3 if i == 0 else 0.22, gem[i % 4], seg=8, ring=5)
        o.rotation_euler = (0, 0, a)


if __name__ == "__main__" or True:
    run({"king": build})
