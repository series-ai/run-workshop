"""Cleopatra: the kid in a striped blue-and-gold nemes headdress (lappets
falling past the shoulders, a gold brow band, a little gold cobra on the
forehead), a black fringe, kohl wings, a wide jewelled gold collar, a long
white dress with a gold belt and a blue sash, gold arm cuffs. A gold staff
topped with a curled green cobra in the right mitten, the full bucket in the
left."""
_PKG = __import__("os").path.normpath(__import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "../../.."))  # tools/run-costume-kids
import math
import sys
sys.path.insert(0, _PKG + "/concepts")
sys.path.insert(0, _PKG + "/concepts/costumes")
from bobble import *  # noqa: F401,F403
from props import bucket

R = math.radians
FY = -HEAD * 0.46          # the face's front plane
CAP_Z = HEAD_Z + HEAD * 0.3
FRONT = -TD * 0.5
SX = TW * 0.5 + 0.08       # shoulder x


def bar(p0, p1, r0, r1, rgb, n=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    o = can(0, 0, 0, r0, d.length, rgb, n=n, r2=r1)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Z", "Y")
    o.location = (p0 + p1) / 2
    return o


def prism(pts, y0, y1, rgb, bevel=0.04):
    """A flat polygon (x, z points) extruded along y from y0 to y1."""
    n = len(pts)
    verts = [(x, y0, z) for x, z in pts] + [(x, y1, z) for x, z in pts]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    me = bpy.data.meshes.new("prism")
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new("prism", me)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return finish(o, rgb, bevel)


def arm(s, hand, rgb, r=0.11, mitt=True):
    """An arm from the shoulder on side s to a mitten centred at `hand`."""
    x, y, z = hand
    limb((s * SX, 0, TOP - 0.15), (x - s * 0.02, y + 0.05, z + 0.12), r, rgb)
    if mitt:
        hand_mitt(x, y, z, s, MITT, SKIN)


def head_skin():
    box(0, 0, HEAD_Z, HEAD, HEAD * 0.92, HEAD * 0.9, SKIN, bevel=HEAD * 0.14, segs=2)


def cap(hair, lift=0.0, back=0.0):
    box(0, HEAD * 0.05 + back * 0.5, CAP_Z + lift, HEAD * 1.04, HEAD * 0.98 + back, HEAD * 0.36, hair, bevel=HEAD * 0.14, segs=2)


def shades(rgb=DARK, lens=None, frame=None, w=0.62, h=0.42, y=FY - 0.06, z=HEAD_Z + 0.02, round_=False):
    """Sunglasses over the eyes (they hide the eyes)."""
    for s in (-1, 1):
        if round_:
            can(s * 0.55, y, z, w * 0.5, 0.08, lens or rgb, n=12, rot=(R(90), 0, 0))
        else:
            box(s * 0.55, y, z, w, 0.1, h, lens or rgb, bevel=0.1, segs=2)
    box(0, y, z + 0.08, 0.5, 0.08, 0.08, frame or rgb)
    for s in (-1, 1):
        box(s * 1.2, y + 0.4, z + 0.08, 0.08, 0.9, 0.08, frame or rgb)

GOLD, BLUE, WHITE_D = (1.0, 0.78, 0.18), (0.14, 0.30, 0.78), (0.98, 0.97, 0.94)
HAIR, RED, TURQ, SNAKE = (0.08, 0.07, 0.09), (0.88, 0.22, 0.18), (0.20, 0.75, 0.75), (0.30, 0.68, 0.30)
SANDAL = (0.85, 0.62, 0.20)


def stripes_box(x, y, z, w, d, h, n, bevel=0.1):
    """A box made of n horizontal bands, alternating gold and blue."""
    step = h / n
    for i in range(n):
        box(x, y, z - h / 2 + step * (i + 0.5), w, d, step * 1.02, GOLD if i % 2 == 0 else BLUE, bevel=min(bevel, step * 0.3))


def slab(x, y, z, w, d, h, r, rgb, n=3):
    """A flat slab, rounded in plan only (corner radius r)."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90), (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    m = len(pts)
    verts = [(px, py, -h / 2) for px, py in pts] + [(px, py, h / 2) for px, py in pts]
    faces = [list(range(m))[::-1], list(range(m, 2 * m))] + [[i, (i + 1) % m, m + (i + 1) % m, m + i] for i in range(m)]
    me = bpy.data.meshes.new("slab")
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new("slab", me)
    o.location = (x, y, z)
    bpy.context.scene.collection.objects.link(o)
    return finish(o, rgb)


def build():
    body(shirt=WHITE_D, pants=WHITE_D, leg_colour=SKIN, shoe=SANDAL, arms=False, torso=False)
    # the dress: a long white column flaring to the ankles, a gold belt and a blue sash
    can(0, 0, (0.3 + TOP) / 2, 0.82, TOP - 0.3, WHITE_D, n=10, r2=0.55)
    can(0, 0, HIP + 0.36, 0.67, 0.14, GOLD, n=10)
    box(0, FRONT - 0.2, HIP - 0.05, 0.22, 0.08, 0.8, BLUE, bevel=0.02, rot=(R(-10), 0, 0))
    box(0, FRONT - 0.14, HIP + 0.36, 0.2, 0.08, 0.2, GOLD, bevel=0.03)
    # the broad collar: stacked gold, blue and red rings, a little drop of beads
    for r, c, z in ((0.92, GOLD, TOP - 0.06), (0.8, TURQ, TOP - 0.01), (0.7, GOLD, TOP + 0.04), (0.6, RED, TOP + 0.09), (0.52, GOLD, TOP + 0.14)):
        can(0, 0, z, r, 0.1, c, n=12)
    for k in range(9):
        a = R(-90 + (k - 4) * 16)
        ball(0.92 * math.cos(a), 0.92 * math.sin(a), TOP - 0.16, 0.12, 0.12, 0.16, BLUE if k % 2 else GOLD, seg=6, ring=4)
    # bare arms with gold cuffs; right: the cobra staff, left: the bucket
    rh = (1.55, -0.62, TOP - 0.25)
    lh = (-1.15, -0.3, TOP - 0.2)
    for s, hand in ((1, rh), (-1, lh)):
        arm(s, hand, SKIN, r=0.11, mitt=False)
        bar((s * SX + (hand[0] - s * SX) * 0.55, (hand[1]) * 0.55, TOP - 0.15 + (hand[2] - TOP + 0.15) * 0.55),
            (s * SX + (hand[0] - s * SX) * 0.75, (hand[1]) * 0.75, TOP - 0.15 + (hand[2] - TOP + 0.15) * 0.75), 0.14, 0.14, GOLD)
        hand_mitt(*hand, s, MITT, SKIN)
    bucket(lh, full=True, size=0.6)
    sx, sy = rh[0] + 0.02, rh[1] - 0.12
    limb((sx, sy, 0.15), (sx, sy, 3.5), 0.06, GOLD)
    can(sx, sy, 0.12, 0.1, 0.06, GOLD, n=6)
    # the cobra: a coil round the top of the staff, rising into a hooded head
    for k in range(10):
        a = 2 * math.pi * k / 7
        ball(sx + 0.15 * math.cos(a), sy + 0.15 * math.sin(a), 2.7 + k * 0.08, 0.17, 0.17, 0.17, SNAKE, seg=6, ring=4)
    bar((sx, sy - 0.05, 3.45), (sx, sy - 0.1, 3.9), 0.1, 0.09, SNAKE)
    o = ball(sx, sy - 0.12, 3.95, 0.5, 0.12, 0.55, SNAKE, seg=8, ring=5)  # the hood
    box(sx, sy - 0.2, 3.9, 0.12, 0.04, 0.3, (0.95, 0.85, 0.35))
    ball(sx, sy - 0.24, 4.2, 0.24, 0.3, 0.2, SNAKE, seg=8, ring=5)   # the head
    for s in (-1, 1):
        ball(sx + s * 0.07, sy - 0.38, 4.24, 0.06, 0.04, 0.06, DARK, seg=6, ring=4)
    can(sx, sy - 0.44, 4.14, 0.03, 0.12, RED, n=4, rot=(R(90), 0, 0))  # the tongue
    # the head: black fringe and kohl wings
    head_skin()
    face(0, HEAD_Z - HEAD * 0.05, FY, HEAD)
    for s in (-1, 1):
        box(s * 0.84, FY - 0.03, HEAD_Z + 0.06, 0.22, 0.04, 0.07, DARK, rot=(0, s * R(-25), 0))
    box(0, FY - 0.03, CAP_Z - 0.16, HEAD * 0.9, 0.2, 0.32, HAIR, bevel=0.06)  # the straight fringe
    # the nemes: a striped cap over the head, lappets down past the shoulders
    cw, cd, cz = HEAD * 1.08, HEAD * 1.0, CAP_Z + 0.05
    box(0, 0.08, cz, cw, cd, 1.6, GOLD, bevel=0.5, segs=3)
    for z in (cz - 0.22, cz + 0.12):
        slab(0, 0.08, z, cw + 0.03, cd + 0.03, 0.14, 0.5, BLUE)
    for x in (-0.6, 0.0, 0.6):  # stripes over the crown, front to back
        box(x, 0.08, cz + 0.8, 0.22, cd * 0.62, 0.04, BLUE)
    for s in (-1, 1):
        prism([(s * 1.22, CAP_Z - 0.1), (s * 1.62, CAP_Z - 0.1), (s * 1.72, HEAD_Z - 0.6), (s * 1.6, TOP - 0.45), (s * 1.05, TOP - 0.45), (s * 1.28, HEAD_Z - 0.6)],
              -0.55, 0.15, GOLD, bevel=0.05)
        for k in range(5):
            z = TOP - 0.3 + k * 0.42
            box(s * (1.42 + (0.04 if k > 1 else -0.06)), -0.2, z, 0.62 if k > 1 else 0.6, 0.74, 0.16, BLUE, bevel=0.02)
        # the wings of the cap out over the temples
        box(s * 1.28, -0.05, CAP_Z - 0.05, 0.35, HEAD * 0.95, 0.5, GOLD, bevel=0.1)
    # the brow band across the forehead and the gold cobra
    box(0, FY - 0.06, CAP_Z + 0.02, HEAD * 1.06, 0.14, 0.18, GOLD, bevel=0.03)
    for s in (-1, 1):
        box(s * 0.6, FY - 0.1, CAP_Z + 0.02, 0.18, 0.04, 0.1, TURQ)
    bar((0, FY - 0.14, CAP_Z - 0.05), (0, FY - 0.2, CAP_Z + 0.45), 0.07, 0.06, GOLD)
    ball(0, FY - 0.22, CAP_Z + 0.5, 0.3, 0.1, 0.32, GOLD, seg=8, ring=5)
    ball(0, FY - 0.28, CAP_Z + 0.5, 0.1, 0.04, 0.12, RED, seg=6, ring=4)
    # the tail at the back
    bar((0, HEAD * 0.5, HEAD_Z + 0.2), (0, HEAD * 0.52, TOP + 0.1), 0.35, 0.2, GOLD, n=8)
    box(0, HEAD * 0.52, HEAD_Z - 0.3, 0.6, 0.2, 0.12, BLUE)


if __name__ == "__main__" or True:
    run({"cleopatra": build})
