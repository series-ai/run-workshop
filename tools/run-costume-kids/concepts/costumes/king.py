"""King: the kid in a huge square gold crown that flares out as it rises
(tall corner spikes, a diamond point mid each side, big square gems, a red
velvet dome with gold arches, an orb and cross on top, an ermine base), a red cape with
a white spotted ermine collar and trim, a purple tunic with a gold belt, a
little brown stick-on beard under the smile, a gold sceptre with a ruby orb
in the right mitten and the full bucket in the left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../.."))  # tools/run-costume-kids
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


def shell(cy, a, z0, z1, r0, r1, t, rgb_out, rgb_in, n=9):
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


def sceptre():
    """The gold sceptre with a ruby orb, around its grip (the origin): the rod
    leans up and out, the orb high over the shoulder."""
    bar((-0.05, 0.03, -0.22), (0.5, -0.25, 1.55), 0.06, 0.06, GOLD)
    top = Vector((0.5, -0.25, 1.55))
    bar(top - Vector((0.03, -0.02, 0.12)), top, 0.16, 0.16, GOLD_D, n=8)
    ball(top.x + 0.04, top.y, top.z + 0.22, 0.42, 0.42, 0.42, RUBY, seg=10, ring=7)
    can(top.x + 0.06, top.y, top.z + 0.5, 0.14, 0.2, GOLD, n=4, r2=0.0)
    ball(top.x - 0.05, top.y - 0.17, top.z + 0.3, 0.1, 0.05, 0.1, WHITE, seg=6, ring=4)


def spots(pts, fy):
    for x, z in pts:
        box(x, fy, z, 0.06, 0.04, 0.14, SPOT)


def build():
    body(shirt=TUNIC, pants=TUNIC, leg_colour=TIGHTS, shoe=RED_D, arms=False)
    fy = -TD * 0.5
    with part("body"):
        # the tunic skirt, the gold belt
        can(0, 0, HIP + 0.08, TW * 0.66, 0.28, TUNIC, n=8, r2=TW * 0.58)
        box(0, 0, HIP + TH * 0.32, TW + 0.06, TD + 0.06, 0.13, GOLD, bevel=0.03)
        box(0, fy - 0.06, HIP + TH * 0.32, 0.22, 0.06, 0.2, GOLD_D, bevel=0.03)
        ball(0, fy - 0.1, HIP + TH * 0.32, 0.1, 0.05, 0.1, RUBY, seg=6, ring=4)
    with part("chest"):
        # the cape: a red flare round the back to the ground, an ermine hem and front edges
        shell(0.05, math.radians(118), 0.08, TOP + 0.05, 1.2, 0.62, 0.08, RED, ERMINE)
        shell(0.05, math.radians(118), 0.04, 0.2, 1.24, 1.16, 0.08, ERMINE, ERMINE, n=9)
        # the big ermine collar round the shoulders
        can(0, 0.02, TOP + 0.02, 0.82, 0.3, ERMINE, n=12, r2=0.6)
        for i in range(8):
            a = i * math.pi / 4 + 0.3
            box(0.74 * math.sin(a), 0.02 - 0.74 * math.cos(a), TOP + 0.02, 0.06, 0.06, 0.15, SPOT, rot=(0, 0, a))
    # standard hanging arms: the right mitten (+x) holds the sceptre, the left carries the bucket
    from props import mount
    hp = hand_points()
    for s_ in (-1, 1):
        sx = s_ * (TW * 0.5 + 0.08)
        with part("arm.l" if s_ > 0 else "arm.r"):
            limb((sx, 0, TOP - 0.15), (sx + s_ * 0.16, -0.05, TOP - ARM_DROP), 0.12, TUNIC)
        with part("hand.l" if s_ > 0 else "hand.r"):
            hand_mitt(*hp[s_], s_, MITT, SKIN)
    mount(sceptre, hp[1], tilt=(0, 40, 0))  # leaning out, clear of the head
    bucket(hp[-1], full=True, size=0.6)
    with part("head"):
        # the head and a little stick-on beard
        w = HEAD
        kid_head(hair=HAIR)
        bf = -w * 0.46
        for x, z, r in ((0, HEAD_Z - 0.82, 0.5), (-0.38, HEAD_Z - 0.68, 0.38), (0.38, HEAD_Z - 0.68, 0.38), (0, HEAD_Z - 1.12, 0.36)):
            ball(x, bf - 0.08, z, r, 0.24, r * 0.9, BEARD, seg=6, ring=4)
        big_crown(HEAD_Z + w * 0.24)


def big_crown(z0):
    """A huge square crown that flares out as it rises: an ermine base, a tall
    gold band with square gems, tall spikes at the four corners, a taller
    diamond point on each side, a red velvet dome and an orb and cross on top."""
    cy = 0.06
    D45 = math.radians(45)
    hb, ht, H = HEAD * 0.58, HEAD * 0.7, 1.25          # half-side at the bottom and top, band height
    box(0, cy, z0 + 0.12, hb * 2 + 0.2, hb * 2 + 0.2, 0.4, ERMINE, bevel=0.14)
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            box(sx * hb * 0.66, cy + sy * (hb + 0.11), z0 + 0.12, 0.08, 0.04, 0.2, SPOT)
            box(sy * (hb + 0.11), cy + sx * hb * 0.66, z0 + 0.12, 0.04, 0.08, 0.2, SPOT)
    zb = z0 + 0.3
    can(0, cy, zb + H / 2, hb / math.cos(D45), H, GOLD, n=4, r2=ht / math.cos(D45), rot=(0, 0, D45))
    can(0, cy, zb + H + 0.06, ht / math.cos(D45) + 0.08, 0.14, GOLD_D, n=4, rot=(0, 0, D45))  # the top lip
    zt = zb + H + 0.12
    # the red velvet dome inside, and an orb with a cross on top
    ball(0, cy, zt + 0.25, ht * 1.8, ht * 1.8, 1.7, RED, seg=8, ring=6)
    for k in range(4):
        a = k * math.pi / 2
        limb((0, cy, zt + 1.1), (ht * 0.9 * math.cos(a), cy + ht * 0.9 * math.sin(a), zt - 0.05), 0.09, GOLD)  # gold arches
    ball(0, cy, zt + 1.25, 0.52, 0.52, 0.52, GOLD, seg=8, ring=5)
    box(0, cy, zt + 1.85, 0.2, 0.2, 0.8, GOLD, bevel=0.04)
    box(0, cy, zt + 1.95, 0.58, 0.2, 0.2, GOLD, bevel=0.04)
    ball(0, cy - 0.12, zt + 1.95, 0.16, 0.08, 0.16, RUBY, seg=6, ring=4)
    # tall spikes at the four corners and a taller diamond point mid each side
    for cx_, cy_ in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = cx_ * ht * 0.92, cy + cy_ * ht * 0.92
        can(x, y, zt + 0.7, 0.36, 1.4, GOLD, n=4, r2=0.0, rot=(0, 0, D45))
        ball(x, y, zt + 1.45, 0.3, 0.3, 0.3, GOLD_D, seg=6, ring=4)
    for k in range(4):
        a = k * math.pi / 2
        ux, uy = math.sin(a), -math.cos(a)                # outward: front, right, back, left
        x, y = ux * ht * 0.95, cy + uy * ht * 0.95
        box(x, y, zt + 0.25, 0.26, 0.26, 0.5, GOLD)
        box(x, y, zt + 1.05, 0.95, 0.2, 0.95, GOLD, rot=(0, D45, a))   # the diamond
        o = box(x + ux * 0.1, y + uy * 0.1, zt + 1.05, 0.42, 0.12, 0.42, RUBY if k % 2 == 0 else SAPPH, rot=(0, D45, a))
        ball(x, y, zt + 1.85, 0.28, 0.28, 0.28, GOLD_D, seg=6, ring=4)
    # big square gems round the band, a ruby in front
    gem = (RUBY, EMER, SAPPH, EMER)
    zg = zb + H * 0.5
    hm = (hb + ht) / 2
    for k in range(4):
        a = k * math.pi / 2
        ux, uy = math.sin(a), -math.cos(a)
        for t in (-0.75, 0.0, 0.75):
            px, py = ux * (hm + 0.04) + uy * -t * 0 + (-uy) * t, cy + uy * (hm + 0.04) + ux * t
            big = t == 0.0
            sz = 0.5 if big else 0.3
            box(px, py, zg, sz, 0.14, sz, gem[k] if big else (SAPPH if k % 2 == 0 else RUBY), rot=(math.radians(-10) if k == 0 else 0, 0, a))


if __name__ == "__main__" or True:
    render_costume("king", build, sys.argv[sys.argv.index("--") + 1], ortho=9.6, target_z=3.9)
